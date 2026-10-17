import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHairPixel,hairPixel,isFacePixel,isHairAccessoryPixel} from './avatar-hair';
import {avatarColumn} from './sprite-assets';
import {presets} from '../store/game';
import {avatarPixel} from './avatar-palette';
import {chairPose} from './avatar-seating';
import {objectTooltipPosition} from './tooltip-position';
import {createWalkCycle} from './walk-cycle';
import {defaultStudySave,dailyQuests} from './study-progress';
import {friendDirectory,validFriendIds,useFriends} from '../store/friends';
import {studyStations,treeCenter} from './world-layout';
import {iso,approachRoute} from './movement';

test('hair masks include crowns, lower bangs and long locks in both poses',()=>{
  for(const [column,reading,x,y] of [[0,false,180,100],[0,false,210,190],[0,true,220,145],[1,false,180,100],[1,true,190,140],[2,false,105,300],[2,false,280,315],[2,true,120,240],[2,true,310,300],[3,false,250,70],[3,true,250,35]] as const)assert.ok(isHairPixel(column,reading,x,y),`${column}/${reading}/${x}/${y}`);
  assert.equal(isHairPixel(0,false,165,235),false);
  assert.equal(isHairPixel(2,false,160,240),false);
  assert.equal(isHairPixel(2,true,170,210),false);
  assert.equal(isHairPixel(2,false,280,80),false); // Hat stays intact.
  assert.deepEqual(hairPixel([170,100,50],[0,180,0]).filter((_,i)=>i!==1),[0,0]);
});

test('walking responds to coordinate changes and restores idle immediately',()=>{
  const step=createWalkCycle({x:0,y:0});
  const frames=[step({x:11,y:0}).frame,step({x:22,y:0}).frame,step({x:22,y:11}).frame];
  assert.equal(new Set(frames).size,3);
  assert.deepEqual(step({x:22,y:11}),{frame:-1,bob:0,lean:0});
  assert.notEqual(step({x:30,y:11}).frame,-1); // Movement always resumes animation.
});

test('daily quests retain distinct reviews, focus progress and lesson baseline',()=>{
  const save={...defaultStudySave(4),seen:['Science:0','Science:0','Science:1'],focusSeconds:1199};
  assert.deepEqual(dailyQuests(save,4).map(q=>q.value),[2,19,0]);
  assert.deepEqual(dailyQuests({...save,seen:[...save.seen,'Science:2'],focusSeconds:1200},5).map(q=>q.value),[3,20,1]);
});

test('friends are accepted independently of membership and deduplicated',()=>{
  assert.equal(friendDirectory.find(f=>f.id==='rowan')?.roomMember,undefined);
  assert.deepEqual(validFriendIds(['rowan','maya','rowan','unknown',4]),['rowan','maya']);
  useFriends.setState({accepted:[]});
  useFriends.getState().accept('rowan');useFriends.getState().accept('rowan');
  assert.deepEqual(useFriends.getState().accepted,['rowan']);
  useFriends.getState().remove('rowan');assert.deepEqual(useFriends.getState().accepted,[]);
});

test('four fixed tables form two mirrored pairs around the tree with reachable seats',()=>{
  const center=iso(treeCenter.x,treeCenter.y);
  assert.equal(studyStations.length,4);
  assert.equal(studyStations.filter(s=>iso(s.position.x,s.position.y).x<center.x).length,2);
  assert.equal(studyStations.filter(s=>iso(s.position.x,s.position.y).x>center.x).length,2);
  for(const [left,right] of [[0,1],[2,3]]){
    const a=iso(studyStations[left].position.x,studyStations[left].position.y),b=iso(studyStations[right].position.x,studyStations[right].position.y);
    assert.equal(center.x-a.x,b.x-center.x);assert.equal(a.y,b.y);
  }
  for(const s of studyStations)assert.ok(approachRoute({x:8,y:8},[s.seat],true));
});

test('foreheads, cheeks and ears use only the skin palette across hair selections',()=>{
  const samples=[[0,false,165,235],[0,true,180,200],[1,false,157,155],[1,true,168,160],[2,false,160,240],[2,true,170,210],[3,false,160,240],[3,true,170,220],[3,false,230,231],[3,true,239,203]] as const;
  for(const [column,reading,x,y] of samples){
    assert.ok(isFacePixel(column,reading,x,y),`Unprotected face ${column}/${reading}/${x}/${y}`);
    assert.equal(isHairPixel(column,reading,x,y),false);
    const palette={skin:[100,200,50],hair:[0,255,255],outfit:[70,100,80]};
    const a=avatarPixel(column,reading,x,y,[220,140,90],palette),b=avatarPixel(column,reading,x,y,[220,140,90],{...palette,hair:[255,0,255]});
    assert.deepEqual(a,b);assert.ok(Math.abs(a[1]-2*a[0])<=1);assert.ok(Math.abs(a[0]-2*a[2])<=1);
    assert.deepEqual(avatarPixel(column,reading,x,y,[17,12,7],palette),[17,12,7]);
  }
});

test('seated sprites anchor hips to the mirrored cushions, not the floor approach',()=>{
  for(let i=0;i<studyStations.length;i++){
    const station=studyStations[i],chair=chairPose(i),desk=iso(station.position.x,station.position.y),approach=iso(station.seat.x,station.seat.y);
    assert.equal(chair.anchorY,.74);assert.equal(chair.anchorX,.5);
    assert.ok(Math.abs(chair.x-desk.x)>30);assert.ok(chair.y<approach.y-40);
    assert.equal(chair.facing,i%2?-1:1);assert.ok(chair.depth>desk.y);
  }
});

test('hover descriptions sit above the item and stay inside scene bounds',()=>{
  assert.deepEqual(objectTooltipPosition({kind:'ellipse',x:500,y:400,rx:70,ry:30},160,40),{x:500,y:338});
  assert.deepEqual(objectTooltipPosition({kind:'polygon',points:[100,300,200,320,190,390,110,370]},160,40),{x:150,y:268});
  const edge=objectTooltipPosition({kind:'ellipse',x:1310,y:10,rx:10,ry:10},200,40);
  assert.equal(edge.x,1212);assert.equal(edge.y,28);
});

test('legacy accessories and cuts cannot replace the selected character',()=>{
 for(const avatar of presets)for(const accessory of ['None','Hat','Glasses','Ribbon'])for(const cut of [0,1,2,3])assert.equal(avatarColumn({...avatar,accessory,cut}),avatarColumn(avatar));
});
test('cheek and ear edges are independent of hair color',()=>{
 for(const [reading,x,y] of [[false,193,245],[true,207,218],[false,180,258]] as const){
 const palette={skin:[244,212,175],hair:[0,255,255],outfit:[100,100,100]};
 assert.ok(isFacePixel(2,reading,x,y));
 assert.deepEqual(avatarPixel(2,reading,x,y,[210,150,95],palette),avatarPixel(2,reading,x,y,[210,150,95],{...palette,hair:[255,0,255]}));
 }
});


test('character choices cover all four atlas characters',()=>{
 assert.deepEqual(presets.map(avatarColumn).sort(),[0,1,2,3]);
});

test('every protected face pixel is invariant under hair palette changes',()=>{
 const palette={skin:[229,183,141],hair:[0,255,255],outfit:[103,143,141]};
 for(let column=0;column<4;column++)for(const reading of [false,true]){
  for(let y=0;y<(reading?486:538);y+=2)for(let x=0;x<384;x+=2){
   if(!isFacePixel(column,reading,x,y))continue;
   for(const source of [[220,140,90],[17,12,7],[170,140,55]])
    assert.deepEqual(avatarPixel(column,reading,x,y,source,palette),avatarPixel(column,reading,x,y,source,{...palette,hair:[255,0,255]}));
  }
 }
});


test('witch forehead gaps remain skin-colored with vivid hair selections',()=>{
 for(const [reading,x,y] of [[false,166,190],[true,170,180]] as const){
  const palette={skin:[229,183,141],hair:[0,255,255],outfit:[103,143,141]},source=[220,160,110];
  assert.equal(isHairPixel(2,reading,x,y),false);
  assert.deepEqual(avatarPixel(2,reading,x,y,source,palette),avatarPixel(2,reading,x,y,source,{...palette,hair:[255,0,255]}));
 }
});


test('bun ribbon and bow fabric retain original pixels in both poses',()=>{
 for(const [reading,x,y] of [[false,215,92],[false,284,130],[true,231,78],[true,297,105]] as const){
  assert.ok(isHairAccessoryPixel(3,reading,x,y));assert.equal(isHairPixel(3,reading,x,y),false);
  const source=[184,178,120];
  for(const hair of [[0,255,255],[255,0,255],[30,20,10]])assert.deepEqual(avatarPixel(3,reading,x,y,source,{skin:[229,183,141],hair,outfit:[100,100,100]}),source);
 }
});

test('all character foreheads and temples are independent of hair color',()=>{
 for(const [column,reading,x,y] of [[0,false,164,160],[0,true,190,140],[1,false,146,150],[1,true,152,130],[2,false,168,195],[2,true,171,180],[3,false,138,180],[3,true,144,160]] as const){
  const palette={skin:[229,183,141],hair:[0,255,255],outfit:[103,143,141]},source=[200,130,75];
  assert.ok(isFacePixel(column,reading,x,y));assert.equal(isHairPixel(column,reading,x,y),false);
  assert.deepEqual(avatarPixel(column,reading,x,y,source,palette),avatarPixel(column,reading,x,y,source,{...palette,hair:[255,0,255]}));
 }
});

test('witch locks between cheek and ear recolor as hair in both poses',()=>{
 for(const [reading,x,y] of [[false,216,240],[true,232,218]] as const){
  assert.ok(isHairPixel(2,reading,x,y));
  const source=[220,190,140],palette={skin:[229,183,141],hair:[80,50,40],outfit:[103,143,141]};
  assert.deepEqual(avatarPixel(2,reading,x,y,source,palette),hairPixel(source,palette.hair,2));
 }
 const mid=hairPixel([200,170,130],[0,255,255],2),light=hairPixel([250,225,180],[0,255,255],2);
 assert.notDeepEqual(mid,light);assert.ok(mid[1]<255);assert.ok(light[0]>0);
});
