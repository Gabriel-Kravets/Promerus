import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderedRoomMembers,rankContributions} from './party-view';
import {presets} from '../../store/game';
import type {RoomMember} from './contracts';
const member=(id:string,slot:number,online=true):RoomMember=>({player_id:id,name:id,avatar:presets[0] as RoomMember['avatar'],appearance_version:1,online,activity:'Idle',x:8,y:8,facing:1,slot,seat:-1,sequence:0});
test('main UI member indexes keep you first and use stable live slot ordering without duplicate characters',()=>{
 const rows=[member('offline',0,false),member('third',3),member('you',2),member('first',1)];
 assert.deepEqual(orderedRoomMembers(rows,'you').map(m=>m.player_id),['you','first','third','offline']);
 assert.equal(rows[0].player_id,'offline');
});
test('real weekly contributions have no simulated baseline and keep main competition ranks',()=>{
 assert.deepEqual(rankContributions([{index:0,name:'A',energy:0},{index:1,name:'B',energy:40},{index:2,name:'C',energy:40}]).map(r=>[r.index,r.rank,r.energy]),[[1,1,40],[2,1,40],[0,3,0]]);
});

import {partyNames} from './party-view';
test('pre-world roster keeps its own player name while the member snapshot is empty',()=>{assert.deepEqual(partyNames([],'Alex'),['Alex']);assert.deepEqual(partyNames([],''),['Gardener']);});
