import assert from 'node:assert/strict';
import test from 'node:test';
import {facingSign,isPresent,memberTile,otherGardeners,seatIndex} from './room-characters';

test('a missing chair is standing, not seated',()=>{
 assert.equal(seatIndex(null),undefined);
 assert.equal(seatIndex(undefined),undefined);
 assert.equal(seatIndex(-1),undefined);
 assert.equal(seatIndex(0),0);
 assert.equal(seatIndex(3),3);
 assert.equal(seatIndex(4),undefined);
});

test('facing never collapses a sprite',()=>{
 assert.equal(facingSign(1),1);
 assert.equal(facingSign(-1),-1);
 assert.equal(facingSign(null),1);
 assert.equal(facingSign(0),1);
 assert.equal(facingSign(undefined),1);
});

test('missing coordinates use the greenhouse spawn for that seat',()=>{
 assert.deepEqual(memberTile({x:9,y:8,slot:1}),{x:9,y:8});
 assert.deepEqual(memberTile({x:null,y:null,slot:2}),{x:8,y:9});
 assert.deepEqual(memberTile({slot:0}),{x:8.5,y:8.5});
});

test('everyone else in the room is drawn, including when online arrives as text',()=>{
 const members=[
  {player_id:'me',online:true,slot:0,activity:'Idle'},
  {player_id:'friend',online:'true',slot:1,activity:'Exploring'},
  {player_id:'away',online:false,slot:2,activity:'Offline'}
 ];
 assert.deepEqual(otherGardeners(members,'me').map(member=>member.player_id),['friend']);
 assert.equal(isPresent({online:null,activity:'Idle'}),true);
 assert.equal(isPresent({activity:'Offline'}),false);
});
