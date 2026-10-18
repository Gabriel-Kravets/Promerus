import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createJSONStorage} from 'zustand/middleware';
import {getItemDefinition,type ItemType} from './items';
import {useInventory,readRoomInventory,type RoomInventory} from '../store/inventory';
import {useGame} from '../store/game';
import {listenForRoomJoins} from './room-inventory';

const inventory=()=>useInventory.getState();
const ofType=(type:ItemType)=>inventory().items.filter(item=>item.type===type);
afterEach(()=>{useGame.getState().reset();inventory().reset();});

test('room initialization grants exactly N distinct desks and no starter tree, including an empty room',()=>{
  for(const count of [0,1,4,12]){
    inventory().reset();
    inventory().initializeRoom(count,'Stardew');
    assert.equal(ofType('desk').length,count);
    assert.equal(ofType('tree').length,0);
    assert.equal(inventory().items.length,count);
    assert.equal(new Set(inventory().items.map(item=>item.id)).size,count);
    assert.ok(inventory().items.every(item=>item.theme==='Stardew'));
  }
});

test('initialization and participant grants are idempotent and independent of input order',()=>{
  inventory().initializeRoom(['alex','maya','maya'],'Classic');
  const items=inventory().items;
  inventory().initializeRoom(['maya','alex'],'Classic');
  inventory().personJoined('maya');
  assert.equal(inventory().items,items);
  inventory().personJoined('kai');
  assert.equal(ofType('desk').length,3);
  assert.equal(ofType('tree').length,0);
  assert.ok(inventory().items.every(item=>item.theme==='Classic'));
});

test('invalid populations and identities cannot partially modify inventory',()=>{
  for(const count of [-1,1.5,NaN,Infinity])assert.throws(()=>inventory().initializeRoom(count,'Classic'),RangeError);
  assert.throws(()=>inventory().initializeRoom([''],'Classic'),TypeError);
  assert.throws(()=>inventory().personJoined('alex'),/Initialize the room/);
  assert.equal(inventory().initialized,false);
  assert.deepEqual(inventory().items,[]);
});

test('item definitions express world footprints, floor layering and both room themes',()=>{
  for(const theme of ['Classic','Stardew'] as const){
    for(const type of ['desk','tree','carpet'] as const){
      const definition=getItemDefinition(type,theme);
      assert.equal(definition.theme,theme);
      assert.ok(definition.dimensions.width>0&&definition.dimensions.height>0);
    }
    const carpet=getItemDefinition('carpet',theme),desk=getItemDefinition('desk',theme);
    assert.equal(carpet.layer,'floor');
    assert.equal(carpet.solid,false);
    assert.equal(desk.layer,'furniture');
    assert.equal(desk.solid,true);
    assert.ok(carpet.zIndex<desk.zIndex);
  }
  assert.notEqual(getItemDefinition('desk','Classic').name,getItemDefinition('desk','Stardew').name);
});

test('presence listener catches joins even when population is unchanged and does not mint on reconnect',t=>{
  useGame.getState().set({online:[true,false,false,true]});
  const stop=listenForRoomJoins();t.after(stop);
  assert.deepEqual(ofType('desk').map(item=>item.grantedTo),['member-0','member-3']);
  useGame.getState().set({online:[true,true,false,false]});
  assert.equal(ofType('desk').length,3);
  useGame.getState().set({online:[true,true,false,true]});
  useGame.getState().set({online:[true,true,false,true]});
  assert.equal(ofType('desk').length,3);
  stop();
  useGame.getState().set({online:[true,true,true,true]});
  assert.equal(ofType('desk').length,3);
  // Remount reconciles participants who joined while the listener was detached.
  const stopAgain=listenForRoomJoins();t.after(stopAgain);
  assert.equal(ofType('desk').length,4);
  assert.equal(ofType('tree').length,0);
});

test('a simultaneous theme change and join grants the new theme without changing existing pieces',t=>{
  const stop=listenForRoomJoins();t.after(stop);
  const initialItems=inventory().items;
  useGame.getState().set({settings:{...useGame.getState().settings,theme:'Classic'},online:[true,false,true,false]});
  assert.equal(ofType('desk').find(item=>item.grantedTo==='member-2')?.theme,'Classic');
  assert.deepEqual(inventory().items.slice(0,initialItems.length),initialItems);
  assert.equal(inventory().theme,'Classic');
});

test('resetting a created greenhouse starts a fresh inventory',t=>{
  useGame.getState().set({created:true,online:[true,true,true,true]});
  const stop=listenForRoomJoins();t.after(stop);
  assert.equal(ofType('desk').length,4);
  useGame.getState().reset();
  assert.equal(ofType('desk').length,1);
  assert.equal(ofType('tree').length,0);
});

test('save validation rejects malformed and duplicate items and only restores data fields',()=>{
  inventory().initializeRoom(2,'Classic');
  const saved={initialized:true,theme:inventory().theme,items:inventory().items,tutorialSeen:false,placements:[]};
  assert.deepEqual(readRoomInventory({...saved,personJoined:'untrusted',extra:42}),saved);
  for(const malformed of [
    null,{}, {...saved,theme:'unknown'}, {...saved,tutorialSeen:'true'},
    {...saved,items:[...saved.items,saved.items[0]]},
    {...saved,items:[{id:'bad',type:'unknown',theme:'Classic'}]},
    {...saved,items:[...saved.items,{id:'duplicate-owner',type:'desk',theme:'Classic',grantedTo:'member-0'}]},
  ])assert.equal(readRoomInventory(malformed),null);
});

test('inventory survives storage hydration and reinitialization without duplicate starter grants',async t=>{
  const previousStorage=useInventory.persist.getOptions().storage;
  const memory=new Map<string,string>();
  useInventory.persist.setOptions({storage:createJSONStorage<RoomInventory>(()=>({
    getItem:key=>memory.get(key)??null,
    setItem:(key,value)=>{memory.set(key,value);},
    removeItem:key=>{memory.delete(key);},
  }))});
  t.after(()=>useInventory.persist.setOptions({storage:previousStorage}));
  inventory().initializeRoom(2,'Classic');
  inventory().markTutorialSeen();
  const saved=memory.get('sproutbound-inventory-v1')!;
  const expected=inventory().items;
  inventory().reset();
  memory.set('sproutbound-inventory-v1',saved);
  await useInventory.persist.rehydrate();
  inventory().initializeRoom(2,'Classic');
  assert.deepEqual(inventory().items,expected);
  assert.equal(inventory().tutorialSeen,true);
  assert.equal(typeof inventory().personJoined,'function');
});

test('the tutorial waits for initialization, stays seen on joins, and re-arms on reset',()=>{
  inventory().markTutorialSeen();
  assert.equal(inventory().tutorialSeen,false);
  inventory().initializeRoom(2,'Stardew');
  assert.equal(inventory().tutorialSeen,false);
  const items=inventory().items;
  inventory().markTutorialSeen();
  inventory().markTutorialSeen();
  assert.equal(inventory().tutorialSeen,true);
  assert.equal(inventory().items,items);
  inventory().personJoined('maya');
  inventory().initializeRoom(2,'Classic');
  assert.equal(inventory().tutorialSeen,true);
  inventory().reset();
  inventory().initializeRoom(1,'Classic');
  assert.equal(inventory().tutorialSeen,false);
});

test('Step 1 saves retain their items and receive the new tutorial',()=>{
  inventory().initializeRoom(3,'Classic');
  const legacy={initialized:true,theme:inventory().theme,items:inventory().items};
  const restored=readRoomInventory(legacy);
  assert.ok(restored);
  assert.deepEqual(restored.items,legacy.items);
  assert.equal(restored.tutorialSeen,false);
});

test('saves with the retired starter tree drop it and its placement',()=>{
  inventory().initializeRoom(1,'Classic');
  const tree={id:'starter:tree',type:'tree',theme:'Classic'};
  const restored=readRoomInventory({initialized:true,theme:'Classic',items:[tree,...inventory().items],tutorialSeen:true,placements:[{itemId:tree.id,position:{x:9,y:6}}]});
  assert.ok(restored);
  assert.deepEqual(restored.items,inventory().items);
  assert.deepEqual(restored.placements,[]);
});
