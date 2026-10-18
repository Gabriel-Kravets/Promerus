import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerEntryStep} from './entry-flow';
import type {BackendProfile,SessionLease} from './contracts';
const profile:BackendProfile={player_id:'player',name:'Gardener',level:'Beginner',goal:'',minutes:'15',interests:[],onboarding_complete:false,intro_state:'pending',last_greenhouse_id:'saved-room'};
const lease={id:'session',greenhouse_id:'saved-room',slot:0,lease_until:'',sequence:0} as SessionLease;
test('character creation precedes the introduction and room entry',()=>{
 assert.equal(playerEntryStep(null,null),'character');
 assert.equal(playerEntryStep(profile,lease),'character');
 assert.equal(playerEntryStep({...profile,onboarding_complete:true},lease),'intro');
});
test('returning players skip completed introductions and can select or resume a room',()=>{
 for(const intro_state of ['seen','skipped']){
  const saved={...profile,onboarding_complete:true,intro_state};
  assert.equal(playerEntryStep(saved,null),'greenhouses');
  assert.equal(playerEntryStep(saved,lease),'world');
 }
});
