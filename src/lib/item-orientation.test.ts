import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {useInventory,readRoomInventory} from '../store/inventory';
import {useItemDrag,listenForItemDragInventory,checkItemPreview} from '../store/item-drag';
import {fixtureItem,fixtureObstacles,roomFixtures} from './room-fixtures';
import {chairPose} from './avatar-seating';
import {iso,blocked,setMovementObstacles,planRoute,deskFootprint,deskPlacementFootprint} from './movement';
import {itemFootprint,permanentRoomObstacles,validatePlacement,withinRoom} from './placement';
import {studyStations,treeCenter} from './world-layout';
import {furnitureRegions} from './world-geometry';

const inventory=()=>useInventory.getState(),drag=()=>useItemDrag.getState(),spot={x:6,y:9};
afterEach(()=>{drag().cancel();inventory().reset();setMovementObstacles([]);});

test('Flip stays temporary until confirmation and survives returning and re-placing an owned piece',t=>{
  inventory().initializeRoom(1,'Classic');t.after(listenForItemDragInventory());
  const item=inventory().items.find(i=>i.type==='desk')!;
  assert.ok(inventory().placeItem(item.id,spot).valid);
  drag().edit(item.id);drag().flip();assert.equal(drag().preview?.item.mirrored,true);
  assert.equal(inventory().items.find(i=>i.id===item.id)?.mirrored,undefined);
  drag().cancel();assert.equal(inventory().items.find(i=>i.id===item.id)?.mirrored,undefined);
  drag().edit(item.id);drag().flip();assert.ok(drag().confirm().valid);
  assert.equal(inventory().items.find(i=>i.id===item.id)?.mirrored,true);
  drag().edit(item.id);drag().returnToCollection();
  assert.equal(drag().preview,null);assert.equal(inventory().placements.length,0);
  assert.ok(drag().select(item.id));assert.equal(drag().preview?.item.mirrored,true);
  drag().beginDrag(spot,1);drag().endDrag(1);assert.ok(drag().confirm().valid);
  assert.equal(readRoomInventory(inventory())?.items.find(i=>i.id===item.id)?.mirrored,true);
});

test('the original room pieces return to Collection and re-place without duplicate instances',t=>{
  inventory().initializeRoom(1,'Classic');t.after(listenForItemDragInventory());const owned=inventory().items;
  for(const fixture of roomFixtures){
    assert.ok(drag().edit(fixture.id));drag().returnToCollection();
    assert.equal(drag().preview,null);assert.ok(inventory().storedFixtures?.includes(fixture.id));
    inventory().returnItem(fixture.id);assert.equal(inventory().storedFixtures?.filter(id=>id===fixture.id).length,1);
    assert.equal(drag().edit(fixture.id),false);
    assert.ok(drag().select(fixture.id));drag().beginDrag(fixture.position,1);drag().endDrag(1);
    assert.ok(checkItemPreview().valid);assert.ok(drag().confirm().valid);
    assert.ok(!inventory().storedFixtures?.includes(fixture.id));assert.equal(inventory().items,owned);
  }
});

test('stored garden removes its collision, survives hydration and cancelling its preview keeps it stored',()=>{
  inventory().initializeRoom(1,'Classic');inventory().returnItem('fixture:garden');
  const state=inventory();assert.deepEqual(readRoomInventory(state)?.storedFixtures,['fixture:garden']);
  setMovementObstacles([...permanentRoomObstacles,...fixtureObstacles(state.fixturePositions,undefined,state.storedFixtures,true)],true);
  assert.equal(blocked(treeCenter.x,treeCenter.y),false);
  assert.ok(drag().select('fixture:garden'));drag().flip();drag().cancel();
  assert.deepEqual(inventory().storedFixtures,['fixture:garden']);
});

test('flipping an original desk persists and mirrors its chair location and seated facing',()=>{
  inventory().initializeRoom(1,'Classic');const id='fixture:desk-0';
  drag().edit(id);drag().flip();assert.ok(drag().confirm().valid);
  assert.equal(inventory().fixturePositions?.[id]?.mirrored,true);
  assert.equal(readRoomInventory(inventory())?.fixturePositions?.[id]?.mirrored,true);
  const normal=chairPose(0),flipped=chairPose(0,561/701,studyStations[0].position,true),center=iso(studyStations[0].position.x,studyStations[0].position.y);
  assert.ok(Math.abs((normal.x-center.x)-(center.x-flipped.x))<1e-8);assert.equal(normal.y,flipped.y);assert.equal(normal.facing,-flipped.facing);
  drag().edit(id);drag().returnToCollection();drag().select(id);assert.equal(drag().preview?.item.mirrored,true);
});

test('a flipped original desk is confirmed against the flipped footprint the preview shows',()=>{
  inventory().initializeRoom(1,'Classic');const id='fixture:desk-0';
  const plain=fixtureItem(id,'Classic')!,flipped=fixtureItem(id,'Classic',true)!;
  // A spot by the wall that only the flipped footprint fits inside.
  let target:{x:number;y:number}|undefined;
  for(let x=-2;x<=16&&!target;x+=.25)for(let y=-2;y<=16&&!target;y+=.25)
    if(withinRoom(flipped,{x,y})&&!withinRoom(plain,{x,y})&&validatePlacement(flipped,{x,y},[],[],{},[]).valid)target={x,y};
  assert.ok(target,'expected a wall spot that only fits when flipped');
  drag().edit(id);drag().flip();drag().beginDrag(drag().preview!.position,1);drag().move(target,1);drag().endDrag(1);
  assert.deepEqual(drag().preview?.position,target);
  if(checkItemPreview().valid){assert.ok(drag().confirm().valid);assert.equal(inventory().fixturePositions?.[id]?.mirrored,true);}
  assert.ok(inventory().moveFixture(id,target,[],true).valid);
  assert.equal(inventory().moveFixture(id,target,[],false).valid,false);
});

test('placement buffers keep desk feet and tree pots off the lower fence without closing walking aisles',()=>{
  const desk={id:'desk:test',type:'desk' as const,theme:'Classic' as const},tree={id:'tree:test',type:'tree' as const,theme:'Classic' as const};
  const center=iso(spot.x,spot.y),deskPoints=itemFootprint(desk,spot).points,treePoints=itemFootprint(tree,spot).points;
  const ys=(points:number[])=>points.filter((_,i)=>i%2===1),xs=(points:number[])=>points.filter((_,i)=>i%2===0);
  assert.ok(Math.max(...xs(deskPoints))-center.x>63);
  assert.equal((Math.min(...ys(deskPoints))+Math.max(...ys(deskPoints)))/2,center.y+6);
  assert.equal((Math.min(...ys(treePoints))+Math.max(...ys(treePoints)))/2,center.y);
  assert.ok(Math.max(...xs(treePoints))-center.x<27,'the tree footprint follows its pot, not its canopy');
  assert.ok(Math.max(...xs(deskPlacementFootprint(spot).points))>Math.max(...xs(deskFootprint(spot).points)));
  const carpet={id:'rug',type:'carpet' as const,theme:'Classic' as const};
  assert.equal(validatePlacement(carpet,spot,[]).valid,false,'a rug reaching the lower fence must be rejected');
  assert.ok(validatePlacement(carpet,{x:5,y:9.5},[]).valid);
  setMovementObstacles([...permanentRoomObstacles,...fixtureObstacles({},undefined,[],true)],true);
  assert.ok(planRoute({x:8,y:8},{x:0,y:5}));
  for(const region of furnitureRegions)assert.ok(region.approaches.some(p=>planRoute({x:8,y:8},p)),region.id);
});
