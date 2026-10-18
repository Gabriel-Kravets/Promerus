import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createJSONStorage} from 'zustand/middleware';
import {contains,floorShape,type Shape} from './world-geometry';
import {approachRoute,blocked,clearSegment,deskFootprint,iso,planRoute,setMovementObstacles,uniso,type Point} from './movement';
import {studyStations,approaches,gardenApproaches} from './world-layout';
import {constrainItemPosition,footprintIntersects,itemFootprint,itemRenderOrder,polygonInside,validatePlacement,withinRoom,fixedPlacementObstacles} from './placement';
import type {InventoryItem} from './items';
import {useInventory,readRoomInventory,type RoomInventory} from '../store/inventory';
import {fixtureItem} from './room-fixtures';
import {useItemDrag,attachPlacementOccupants,checkItemPreview,listenForItemDragInventory} from '../store/item-drag';

const desk:InventoryItem={id:'desk:a',type:'desk',theme:'Classic'};
const tree:InventoryItem={id:'tree:a',type:'tree',theme:'Stardew'};
const carpet:InventoryItem={id:'carpet:a',type:'carpet',theme:'Stardew'};
const clearSpot={x:6,y:9};
const inventory=()=>useInventory.getState(),drag=()=>useItemDrag.getState();
afterEach(()=>{drag().cancel();inventory().reset();setMovementObstacles([]);});
function prepare(){inventory().initializeRoom(['alex','maya'],'Classic');return inventory().items.find(item=>item.grantedTo==='alex')!;}
function pauseAt(id:string,position:Point){assert.ok(drag().select(id));drag().beginDrag(position,1);drag().endDrag(1);}

test('the whole footprint must fit even when its center is inside the floor',()=>{
  const center=uniso(1120,400);assert.ok(contains(floorShape,iso(center.x,center.y)));
  for(const item of [desk,tree,carpet]){
    assert.equal(withinRoom(item,center),false);
    assert.equal(validatePlacement(item,center,[]).valid,false);
    assert.ok(withinRoom(item,clearSpot));
  }
});

test('concave room edges cannot cut through a footprint with all four corners inside',()=>{
  const room={kind:'polygon' as const,points:[0,0,10,0,10,10,6,10,6,4,4,4,4,10,0,10]};
  const spanning={kind:'polygon' as const,points:[2,8,8,8,8,9,2,9]};
  for(const p of [{x:2,y:8},{x:8,y:8},{x:8,y:9},{x:2,y:9}])assert.ok(contains(room,p));
  assert.equal(polygonInside(room,spanning),false);
  assert.equal(polygonInside(room,{kind:'polygon',points:[1,1,9,1,9,3,1,3]}),true);
});

test('dragging clamps the full footprint inside every side of the room for all item sizes',()=>{
  for(const item of [desk,tree,carpet])for(const requested of [{x:-100,y:50},{x:50,y:-100},{x:100,y:100},{x:-100,y:-100}]){
    const actual=constrainItemPosition(item,requested,clearSpot);
    assert.ok(withinRoom(item,actual));assert.notDeepEqual(actual,requested);
  }
  assert.deepEqual(constrainItemPosition(desk,clearSpot),clearSpot);
});

test('collision geometry catches thin crossings, enclosed shapes and ellipse edges',()=>{
  const horizontal={kind:'polygon' as const,points:[0,4,10,4,10,6,0,6]};
  assert.ok(footprintIntersects(horizontal,{kind:'polygon',points:[4,0,6,0,6,10,4,10]}));
  assert.ok(footprintIntersects(horizontal,{kind:'ellipse',x:5,y:5,rx:.1,ry:.1}));
  assert.ok(footprintIntersects(horizontal,{kind:'ellipse',x:5,y:0,rx:1,ry:5}));
  assert.equal(footprintIntersects(horizontal,{kind:'ellipse',x:20,y:20,rx:1,ry:1}),false);
});

test('fixed desks, the central garden, furniture bases and railing use real scene geometry',()=>{
  assert.ok(validatePlacement(desk,clearSpot,[]).valid);
  for(const position of [{x:10,y:3},{x:5.5,y:5.5}]){
    const result=validatePlacement(desk,position,[]);assert.equal(result.valid,false);
    if(!result.valid)assert.equal(result.reason,'collision');
  }
  // Check overlaps away from the center of a large footprint too.
  assert.ok(fixedPlacementObstacles.some(shape=>footprintIntersects(itemFootprint(desk,{x:10,y:3}),shape)));
  assert.equal(validatePlacement(desk,uniso(589,260),[]).valid,false);
  assert.equal(validatePlacement(desk,uniso(660,548),[]).valid,false);
});

test('solid furniture cannot overlap; carpets can sit under either placed or fixed desks',()=>{
  const rugSpot={x:5,y:9.5};
  assert.ok(validatePlacement(carpet,rugSpot,[]).valid);
  // Clear of the front-left desk's stool, which now belongs to its hitbox.
  const deskOnRug={x:4,y:2.5};
  assert.ok(validatePlacement(desk,deskOnRug,[{item:carpet,position:deskOnRug}]).valid);
  assert.ok(validatePlacement(carpet,rugSpot,[{item:desk,position:rugSpot}]).valid);
  assert.equal(validatePlacement(tree,clearSpot,[{item:desk,position:clearSpot}]).valid,false);
  assert.equal(validatePlacement(desk,clearSpot,[{item:tree,position:{x:6.5,y:9}}]).valid,false);
  assert.equal(validatePlacement(carpet,{x:5.5,y:5.5},[]).valid,false);
  const underDesk={x:5,y:9.5};assert.ok(validatePlacement(carpet,underDesk,[]).valid);
  assert.ok(footprintIntersects(itemFootprint(carpet,underDesk),deskFootprint(studyStations[2].position)));
});

test('render order keeps carpets below furniture and sorts depth within each layer',()=>{
  assert.equal(itemRenderOrder(carpet,clearSpot).layer,'floor');assert.equal(itemRenderOrder(desk,clearSpot).layer,'furniture');
  for(const item of [desk,tree,carpet])assert.ok(itemRenderOrder(item,{x:8,y:8}).depth>itemRenderOrder(item,{x:7,y:7}).depth);
});

test('release remains temporary; explicit confirmation commits once without losing ownership or theme',()=>{
  const item=prepare(),owned=inventory().items;pauseAt(item.id,clearSpot);
  assert.equal(inventory().placements.length,0);assert.ok(checkItemPreview().valid);
  inventory().setTheme('Stardew');assert.ok(drag().confirm().valid);
  assert.equal(drag().preview,null);assert.equal(inventory().items,owned);
  assert.deepEqual(inventory().placements,[{itemId:item.id,position:clearSpot}]);
  assert.equal(inventory().items.find(owned=>owned.id===item.id)?.theme,'Classic');
  assert.equal(drag().select(item.id),false);assert.equal(inventory().placeItem(item.id,{x:9,y:6}).valid,false);
  assert.equal(inventory().placements.length,1);
});

test('invalid confirmation retains the ghost and availability; moving it clear enables confirmation',()=>{
  const item=prepare(),owned=inventory().items;pauseAt(item.id,{x:5.5,y:5.5});
  assert.equal(checkItemPreview().valid,false);assert.equal(drag().confirm().valid,false);
  assert.ok(drag().preview);assert.equal(inventory().placements.length,0);assert.equal(inventory().items,owned);
  drag().beginDrag({x:5.5,y:5.5},1);drag().move(clearSpot,1);drag().endDrag(1);
  assert.ok(drag().confirm().valid);assert.equal(inventory().placements.length,1);
});

test('confirmation rechecks current collisions, ownership and pointer release',()=>{
  const item=prepare(),other=inventory().items.find(item=>item.grantedTo==='maya')!;
  assert.ok(drag().select(item.id));assert.equal(drag().confirm().valid,false);
  drag().beginDrag(clearSpot,1);assert.equal(drag().confirm().valid,false);drag().endDrag(1);
  assert.ok(inventory().placeItem(other.id,clearSpot).valid);
  assert.equal(drag().confirm().valid,false);assert.ok(drag().preview);
  inventory().reset();assert.equal(drag().confirm().valid,false);
});

test('live room occupants are rechecked on confirmation',t=>{
  let occupants:Shape[]=[];t.after(attachPlacementOccupants(()=>occupants));
  const item=prepare();pauseAt(item.id,clearSpot);assert.ok(checkItemPreview().valid);
  occupants=[{kind:'ellipse',...iso(clearSpot.x,clearSpot.y),rx:10,ry:8}];
  assert.equal(drag().confirm().valid,false);assert.ok(drag().preview);
  occupants=[];assert.ok(drag().confirm().valid);
});

test('returning a piece restores availability and a new greenhouse clears all placements',t=>{
  t.after(listenForItemDragInventory());const item=prepare();pauseAt(item.id,clearSpot);assert.ok(drag().confirm().valid);
  inventory().returnItem(item.id);assert.equal(inventory().placements.length,0);assert.ok(drag().select(item.id));
  inventory().reset();assert.equal(drag().preview,null);assert.equal(inventory().placements.length,0);
});

test('placement persistence round-trips and excludes temporary ghosts',async t=>{
  const previousStorage=useInventory.persist.getOptions().storage,memory=new Map<string,string>();
  useInventory.persist.setOptions({storage:createJSONStorage<RoomInventory>(()=>({
    getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,value);},removeItem:key=>{memory.delete(key);},
  }))});t.after(()=>useInventory.persist.setOptions({storage:previousStorage}));
  const item=prepare();pauseAt(item.id,clearSpot);assert.ok(drag().confirm().valid);
  assert.ok(drag().select('starter:tree'));
  const saved=memory.get('sproutbound-inventory-v1')!;assert.equal(saved.includes('preview'),false);
  inventory().reset();memory.set('sproutbound-inventory-v1',saved);await useInventory.persist.rehydrate();
  assert.deepEqual(inventory().placements,[{itemId:item.id,position:clearSpot}]);assert.equal(drag().select(item.id),false);
  assert.equal(inventory().items.length,3);
});

test('legacy and malformed placement saves preserve inventory while rejecting invalid permanent copies',()=>{
  const item=prepare(),state=inventory();
  const legacy={initialized:true,theme:state.theme,items:state.items,tutorialSeen:true};
  assert.deepEqual(readRoomInventory(legacy)?.placements,[]);
  const restored=readRoomInventory({...legacy,placements:[
    {itemId:'unknown',position:clearSpot},null,{itemId:item.id,position:{x:Infinity,y:0}},
    {itemId:item.id,position:{x:5.5,y:5.5}},{itemId:item.id,position:clearSpot},
    {itemId:item.id,position:{x:9,y:6}},{itemId:'starter:tree',position:clearSpot},
  ]});
  assert.deepEqual(restored?.placements,[{itemId:item.id,position:clearSpot}]);assert.deepEqual(restored?.items,state.items);
});

test('new solids invalidate cached walking edges and removing them restores routes',()=>{
  const start={x:4,y:8},end={x:8,y:9};assert.ok(planRoute(start,end));assert.equal(blocked(clearSpot.x,clearSpot.y),false);
  setMovementObstacles([itemFootprint(desk,clearSpot)]);assert.equal(blocked(clearSpot.x,clearSpot.y),true);
  assert.equal(planRoute(start,clearSpot),null);
  const route=planRoute(start,end);assert.ok(route);let previous=start;
  for(const point of route.path){assert.ok(clearSegment(previous,point));previous=point;}
  setMovementObstacles([]);assert.equal(blocked(clearSpot.x,clearSpot.y),false);assert.ok(planRoute(start,clearSpot));
});

test('ground footprints preserve approaches to the existing study stations and garden',()=>{
  setMovementObstacles(fixedPlacementObstacles);
  for(const point of [...approaches,...gardenApproaches])assert.ok(planRoute({x:8.5,y:8.5},point),JSON.stringify(point));
  for(const station of studyStations)assert.ok(approachRoute({x:8.5,y:8.5},[station.seat,...station.alternatives],true));
});

test('an original desk hitbox includes its stool and flips with the desk',()=>{
  const spot={x:7,y:7},at=iso(spot.x,spot.y),stool={x:at.x+40,y:at.y+25},mirroredStool={x:at.x-40,y:at.y+25};
  const left=itemFootprint(fixtureItem('fixture:desk-0','Classic')!,spot),flipped=itemFootprint(fixtureItem('fixture:desk-0','Classic',true)!,spot);
  assert.ok(contains(left,stool));assert.ok(!contains(left,mirroredStool));
  assert.ok(contains(flipped,mirroredStool));assert.ok(!contains(flipped,stool));
  // The right-hand atlas desks draw their stool on the other side.
  assert.ok(contains(itemFootprint(fixtureItem('fixture:desk-1','Classic')!,spot),mirroredStool));
});

test('a desk stool cannot poke through the bottom-right wall',()=>{
  // Close to the lower-right floor edge: the diamond fits, the stool does not.
  const item=fixtureItem('fixture:desk-0','Classic')!,flipped=fixtureItem('fixture:desk-0','Classic',true)!;
  const spot=uniso(720,532);
  assert.ok(polygonInside(floorShape as Extract<Shape,{kind:'polygon'}>,{kind:'polygon',points:[-70,-4,0,-28,70,-4,0,26].map((v,i)=>v+(i%2?iso(spot.x,spot.y).y:iso(spot.x,spot.y).x))}));
  assert.equal(withinRoom(item,spot),false);assert.ok(withinRoom(flipped,spot));
});

test('items can be placed right up against the left-middle drawer cabinet',()=>{
  const stored=['fixture:desk-0','fixture:desk-2'];
  for(const point of [{x:428,y:340},{x:422,y:320},{x:370,y:385}])
    assert.ok(validatePlacement(tree,uniso(point.x,point.y),[],[],{},stored).valid,JSON.stringify(point));
  // The cabinet itself stays solid.
  assert.equal(validatePlacement(tree,uniso(350,345),[],[],{},stored).valid,false);
});
