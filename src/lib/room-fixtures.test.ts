import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {useInventory,readRoomInventory} from '../store/inventory';
import {useItemDrag,checkItemPreview,listenForItemDragInventory} from '../store/item-drag';
import {fixtureItem,fixtureObstacles,fixtureShape} from './room-fixtures';
import {itemFootprint,permanentRoomObstacles,validatePlacement} from './placement';
import {blocked,planRoute,setMovementObstacles} from './movement';
import {studyStations,treeCenter} from './world-layout';
import {chairPose} from './avatar-seating';

const inventory=()=>useInventory.getState(),drag=()=>useItemDrag.getState();
afterEach(()=>{drag().cancel();inventory().reset();setMovementObstacles([]);});

test('the original desks can be edited, moved, cancelled and saved without minting Collection copies',t=>{
  inventory().initializeRoom(1,'Classic');t.after(listenForItemDragInventory());
  const items=inventory().items,id='fixture:desk-0',destination={x:6,y:9};
  assert.ok(drag().edit(id));assert.deepEqual(drag().preview?.position,studyStations[0].position);
  drag().beginDrag(studyStations[0].position,1);drag().move(destination,1);drag().endDrag(1);
  assert.ok(checkItemPreview().valid);assert.equal(inventory().fixturePositions,undefined);
  drag().cancel();assert.equal(inventory().fixturePositions,undefined);
  drag().edit(id);drag().beginDrag(studyStations[0].position,1);drag().move(destination,1);drag().endDrag(1);
  assert.ok(drag().confirm().valid);assert.equal(drag().preview,null);
  assert.deepEqual(inventory().fixturePositions?.[id],destination);assert.equal(inventory().items,items);
  const restored=readRoomInventory(inventory());assert.deepEqual(restored?.fixturePositions?.[id],destination);
  assert.ok(drag().edit(id));assert.deepEqual(drag().preview?.position,destination);
});

test('the shared garden uses its full bed footprint and cannot overlap another fixture or owned furniture',()=>{
  inventory().initializeRoom(1,'Classic');const id='fixture:garden';
  assert.ok(drag().edit(id));assert.deepEqual(drag().preview?.position,treeCenter);
  assert.deepEqual(fixtureShape(id,treeCenter),{kind:'ellipse',x:660,y:410,rx:96,ry:44});
  assert.equal(inventory().moveFixture(id,studyStations[0].position).valid,false);
  const desk=inventory().items.find(item=>item.type==='desk')!;
  assert.ok(inventory().placeItem(desk.id,{x:6,y:9}).valid);
  assert.equal(inventory().moveFixture(id,{x:6,y:9}).valid,false);
  assert.equal(inventory().moveFixture(id,{x:100,y:100}).valid,false);
  assert.equal(inventory().fixturePositions,undefined);
});

test('moving the garden frees its old footprint, updates navigation and persists without changing its identity',()=>{
  inventory().initializeRoom(1,'Classic');const id='fixture:garden',destination={x:7.5,y:7.5};
  assert.ok(inventory().moveFixture(id,destination).valid);
  const positions=inventory().fixturePositions;
  setMovementObstacles([...permanentRoomObstacles,...fixtureObstacles(positions)],true);
  assert.equal(blocked(treeCenter.x,treeCenter.y),false);
  assert.equal(blocked(destination.x,destination.y),true);
  assert.ok(planRoute({x:8.5,y:5},treeCenter));
  const desk=fixtureItem('fixture:desk-0','Classic')!;
  assert.ok(validatePlacement(desk,treeCenter,[],[],positions).valid);
  assert.deepEqual(readRoomInventory(inventory())?.fixturePositions,positions);
  inventory().reset();assert.equal(inventory().fixturePositions,undefined);
});

test('moving a desk updates its navigation footprint and reading pose by the same offset',()=>{
  inventory().initializeRoom(1,'Classic');const destination={x:6,y:9};
  assert.ok(inventory().moveFixture('fixture:desk-0',destination).valid);
  setMovementObstacles([...permanentRoomObstacles,...fixtureObstacles(inventory().fixturePositions)],true);
  assert.equal(blocked(studyStations[0].position.x,studyStations[0].position.y),false);
  assert.equal(blocked(destination.x,destination.y),true);
  const before=chairPose(0),after=chairPose(0,561/701,destination);
  assert.notEqual(before.x,after.x);assert.notEqual(before.y,after.y);
  assert.deepEqual(itemFootprint(fixtureItem('fixture:desk-0','Classic')!,destination),fixtureShape('fixture:desk-0',destination));
});
