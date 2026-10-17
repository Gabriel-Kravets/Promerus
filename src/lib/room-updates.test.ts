import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHairPixel,hairPixel} from './avatar-hair';
import {createWalkCycle} from './walk-cycle';
import {defaultStudySave,dailyQuests} from './study-progress';
import {friendDirectory,validFriendIds,useFriends} from '../store/friends';
import {studyStations,treeCenter} from './world-layout';
import {iso,approachRoute} from './movement';

test('hair masks include crowns, lower bangs and long locks in both poses',()=>{
  for(const [column,reading,x,y] of [[0,false,180,100],[0,false,210,190],[0,true,220,145],[1,false,180,100],[1,true,190,140],[2,false,105,300],[2,false,280,315],[2,true,120,240],[2,true,310,300],[3,false,250,70],[3,true,240,70]] as const)assert.ok(isHairPixel(column,reading,x,y),`${column}/${reading}/${x}/${y}`);
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
  assert.equal(step({x:30,y:11},false).frame,-1);
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
