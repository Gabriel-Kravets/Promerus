import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyLayoutCommand,parseRoomLayout,withRoomGeometry} from './room-layout';
import {blocked} from '../movement';
test('server initializes stable member grants and never accepts forged items or authority fields',()=>{
 const first=parseRoomLayout(null,['alice','bob']);
 assert.deepEqual(parseRoomLayout(first,['alice','bob']),first);
 assert.equal(first.items.filter(i=>i.grantedTo).length,2);
 assert.throws(()=>applyLayoutCommand(first,['alice'],{kind:'buy',type:'carpet',theme:'Stardew'}));
 assert.throws(()=>applyLayoutCommand(first,['alice'],{kind:'buy',type:'lantern',theme:'Stardew',energy:999}));
 assert.throws(()=>applyLayoutCommand(first,['alice'],{kind:'place',id:'forged',position:{x:8,y:8},mirrored:false}),/unavailable/);
});
test('server owns purchase identity, validates main geometry and rejects placements over gardeners',()=>{
 const state=applyLayoutCommand(null,['alice'],{kind:'buy',type:'lantern',theme:'Stardew'}),id=state.items.at(-1)!.id;
 assert.equal(id,'shop:lantern:1');
 assert.throws(()=>applyLayoutCommand(state,['alice'],{kind:'place',id,position:{x:16,y:16},mirrored:false}),/inside/);
 let found:{x:number;y:number}|undefined;
 for(let x=0;x<14&&!found;x+=.5)for(let y=0;y<14;y+=.5)try{applyLayoutCommand(state,['alice'],{kind:'place',id,position:{x,y},mirrored:false});found={x,y};break;}catch{}
 assert.ok(found);
 const placed=applyLayoutCommand(state,['alice'],{kind:'place',id,position:found,mirrored:true});assert.equal(placed.placements.length,1);
 assert.throws(()=>applyLayoutCommand(state,['alice'],{kind:'place',id,position:found,mirrored:false},[found!]),/gardeners/);
 assert.equal(applyLayoutCommand(placed,['alice'],{kind:'return',id}).placements.length,0);
});
test('worker collision state is reset after each world validation, including exceptions',()=>{
 const layout=parseRoomLayout(null,['alice']);layout.storedFixtures=['fixture:garden'];
 assert.equal(blocked(5.5,5.5),true);
 assert.equal(withRoomGeometry(layout,()=>blocked(5.5,5.5)),false);
 assert.equal(blocked(5.5,5.5),true);
 assert.throws(()=>withRoomGeometry(layout,()=>{throw new Error('fixture');}));
 assert.equal(blocked(5.5,5.5),true);
});
test('server keeps desk spots beyond the member count out of the room',()=>{
 const layout=parseRoomLayout(null,['alice']);
 assert.throws(()=>applyLayoutCommand(layout,['alice'],{kind:'place',id:'fixture:desk-1',position:{x:8,y:8},mirrored:false}),/unavailable/);
 assert.throws(()=>applyLayoutCommand(layout,['alice'],{kind:'return',id:'fixture:desk-3'}),/unavailable/);
 assert.doesNotThrow(()=>applyLayoutCommand(layout,['alice','bob'],{kind:'return',id:'fixture:desk-1'}));
});
