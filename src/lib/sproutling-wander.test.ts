import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSproutlingWander} from './sproutling-wander';
import {blocked,distance} from './movement';

test('sproutling wanders across clear floor, pauses, and resumes without teleporting',()=>{
 let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const step=createSproutlingWander({x:8,y:4},random),visited=new Set<string>();
 let previous={x:8,y:4},movingFrames=0,restingFrames=0;
 for(let i=0;i<3600;i++){
  const result=step(1/30);
  assert.ok(!blocked(result.position.x,result.position.y),'stays clear of furniture and floor edges');
  assert.ok(distance(previous,result.position)<=38/30+.001,'moves at a bounded speed');
  visited.add(Math.round(result.position.x)+','+Math.round(result.position.y));
  if(result.moving)movingFrames++;else restingFrames++;
  previous=result.position;
  if(i===600){for(let j=0;j<90;j++){const paused=step(1/30,true);assert.deepEqual(paused.position,previous);assert.equal(paused.moving,false);}}
 }
 assert.ok(visited.size>8);assert.ok(movingFrames>100);assert.ok(restingFrames>60);
});


test('desk edges block crossing and fractional reroutes stay clear',async()=>{
 const {clearSegment,iso,uniso,planRoute}=await import('./movement');
 const {desks}=await import('./world-layout');
 for(const desk of desks){
  const center=iso(desk.x,desk.y);
  assert.equal(clearSegment(uniso(center.x-85,center.y),uniso(center.x+85,center.y)),false);
 }
 const start={x:8.5,y:8.5},plan=planRoute(start,{x:3,y:8});assert.ok(plan);
 let previous=start;
 for(const next of plan.path){
  assert.ok(clearSegment(previous,next));
  const halfway={x:(previous.x+next.x)/2,y:(previous.y+next.y)/2};
  const redirected=planRoute(halfway,start);assert.ok(redirected);
  let from=halfway;for(const to of redirected.path){assert.ok(clearSegment(from,to));from=to;}
  previous=next;
 }
});
