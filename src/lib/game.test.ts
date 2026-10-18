import {test} from 'node:test';
import assert from 'node:assert/strict';
import {iso,uniso,pathfind,blocked,stageFor,planRoute,walkableTiles,approachRoute,clearSegment,GRID_STEP} from './movement';
import {courses} from './courses';
import {approaches,gardenApproaches,desks,studyStations} from './world-layout';
import {contains,floorShape,gardenHotspot,furnitureRegions,pickInteraction} from './world-geometry';
import {useGame,type MemberActivity} from '../store/game';
import {memberStatus} from './party';
test('isometric projection round-trips',()=>{for(let x=0;x<12;x++)for(let y=0;y<12;y++){assert.deepEqual(uniso(iso(x,y).x,iso(x,y).y),{x,y});}});
test('navigation routes around the round garden without corner cutting',()=>{
 const start={x:4,y:8},end={x:8,y:4},path=pathfind(start,end);assert.ok(path.length>8);let last=start;
 for(const p of path){assert.equal(blocked(p.x,p.y),false);assert.ok(Math.abs(p.x-last.x)<=GRID_STEP&&Math.abs(p.y-last.y)<=GRID_STEP);
  for(let t=0;t<=1;t+=.1)assert.equal(blocked(last.x+(p.x-last.x)*t,last.y+(p.y-last.y)*t),false);last=p;
 }assert.deepEqual(last,end);assert.deepEqual(pathfind(start,{x:6.5,y:6.5}),[]);assert.equal(planRoute(start,{x:30,y:30},true),null);
});
test('all object approaches and walkable regions are reachable from spawn',()=>{
 const spawn={x:8,y:8};for(const p of [...approaches,...gardenApproaches,...furnitureRegions.flatMap(x=>x.approaches)])assert.ok(planRoute(spawn,p),JSON.stringify(p));
 for(const p of walkableTiles)assert.ok(planRoute(spawn,p),`Disconnected floor: ${JSON.stringify(p)}`);
 for(const item of furnitureRegions)assert.ok(approachRoute(spawn,item.approaches));
});
test('solid furniture, garden and platform boundaries reject walking',()=>{
 for(const desk of desks)assert.equal(blocked(desk.x,desk.y),true);
 assert.equal(blocked(6.5,6.5),true);for(const p of walkableTiles)assert.equal(contains(floorShape,iso(p.x,p.y)),true);
 assert.equal(blocked(0,0),true);assert.equal(blocked(14,14),true);
});
test('occupied floor clicks resolve to a reachable perimeter without leaving the platform',()=>{
 const route=planRoute({x:8,y:8},{x:6.5,y:6.5},true);assert.ok(route);assert.equal(blocked(route.destination.x,route.destination.y),false);
 assert.notDeepEqual(route.destination,{x:6.5,y:6.5});assert.equal(planRoute({x:8,y:8},{x:-10,y:-10},true),null);
 const redirect=planRoute({x:8.2,y:8},{x:4,y:8});assert.ok(redirect);assert.ok(redirect.path.length);
});
test('canopy and empty floor do not claim garden clicks, and object priority is deterministic',()=>{
 assert.equal(contains(gardenHotspot,{x:660,y:330}),false);assert.equal(contains(gardenHotspot,{x:660,y:433}),true);
 assert.equal(contains(gardenHotspot,{x:540,y:430}),false);
 const items=[{id:'garden',priority:10,contains:(p:{x:number;y:number})=>contains(gardenHotspot,p)},{id:'pet',priority:50,contains:(p:{x:number;y:number})=>p.x>700&&p.x<750&&p.y>400&&p.y<450}];
 assert.equal(pickInteraction(items,{x:720,y:430})?.id,'pet');assert.equal(pickInteraction([...items].reverse(),{x:720,y:430})?.id,'pet');assert.equal(pickInteraction(items,{x:660,y:330}),undefined);
 for(const item of furnitureRegions)assert.equal(contains(item.shape,{x:660,y:530}),false);
});
test('fifteen complete lessons have four choices and valid answers',()=>{assert.equal(Object.keys(courses).length,3);for(const c of Object.values(courses)){assert.equal(c.lessons.length,5);for(const l of c.lessons){assert.equal(l.questions.length,3);for(const q of l.questions){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(q.explanation.length>10);}}}});
test('replays cannot mint energy and quest needs distinct identities',()=>{useGame.getState().reset();const g=()=>useGame.getState();assert.equal(g().complete(0,'python:0'),true);assert.equal(g().energy,80);assert.equal(g().complete(0,'python:0'),false);assert.equal(g().energy,80);g().complete(0,'python:1');assert.equal(new Set(g().completions.map(c=>c.player)).size,1);g().complete(1,'algebra:0');assert.equal(new Set(g().completions.map(c=>c.player)).size,2);assert.equal(g().energy,120);g().reset();});
test('garden thresholds are stable',()=>{assert.deepEqual([0,399,400,999,1000,1999,2000].map(stageFor),[0,0,1,1,2,2,3]);});

test('simulated classmates start in the room without changing progression',()=>{useGame.getState().reset();assert.deepEqual(useGame.getState().online,[true,true,true,true]);useGame.getState().set({online:[true,true,false,false]});assert.equal(useGame.getState().energy,60);useGame.getState().reset();});

test('station layout retains original desk cells and keeps chairs reachable',()=>{
 for(const [index,station] of studyStations.entries()){
  assert.ok(Math.abs(station.width-168.21)<1e-8);assert.equal(station.atlasColumn,index%2);assert.deepEqual(desks[index],station.position);assert.deepEqual(approaches[index],station.seat);
  assert.ok(approachRoute({x:8,y:8},[station.seat,...station.alternatives],true));assert.equal(blocked(station.position.x,station.position.y),true);
 }
});
test('fireplace uses the preferred front tile and has reachable fallbacks',()=>{
 const stove=furnitureRegions.find(item=>item.id==='hearth')!;
 const route=approachRoute({x:8,y:8},stove.approaches,true);assert.ok(route);assert.deepEqual(route.destination,{x:11.5,y:-.5});
 const point=iso(route.destination.x,route.destination.y);assert.ok(point.x>1060&&point.x<1121);assert.ok(point.y>380&&point.y<420);assert.ok(stove.lookAt!.x>point.x);
 const alternate=approachRoute({x:8,y:8},[{x:100,y:100},...stove.approaches.slice(1)],true);assert.ok(alternate);assert.deepEqual(alternate.destination,stove.approaches[1]);
});
test('party activity respects offline presence and contextual local actions',()=>{
 const state={online:[true,true,false,true],memberActivities:['Idle','Studying','Exploring','Taking a break'] as MemberActivity[],localActivity:'Exploring' as MemberActivity};
 assert.equal(memberStatus(state,0),'Exploring');assert.equal(memberStatus(state,0,'learn'),'Studying');assert.equal(memberStatus(state,0,'hearth'),'Taking a break');
 assert.equal(memberStatus(state,1),'Studying');assert.equal(memberStatus(state,2),'Offline');assert.equal(memberStatus(state,3),'Taking a break');
});
test('floor behind the left rear desk is reachable without crossing the desk',()=>{
 const behind={x:0,y:5};assert.equal(blocked(behind.x,behind.y),false);
 const route=planRoute({x:8,y:8},behind);assert.ok(route);assert.deepEqual(route.destination,behind);
 for(let i=1;i<route.path.length;i++)assert.ok(clearSegment(route.path[i-1],route.path[i]));
});
