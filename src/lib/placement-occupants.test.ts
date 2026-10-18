import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {useInventory} from '../store/inventory';
import {attachPlacementOccupants,checkItemPreview,useItemDrag} from '../store/item-drag';
import {MAX_PLACEMENT_NUDGE,occupantShape,planPlacementNudges,type PlacementOccupant} from './placement-occupants';
import {ellipsePolygon,footprintIntersects,itemFootprint,permanentRoomObstacles,validatePlacement} from './placement';
import {fixtureObstacles} from './room-fixtures';
import {distance,iso,uniso} from './movement';

const spot={x:6,y:9},desk={id:'desk:test',type:'desk' as const,theme:'Classic' as const};
const inventory=()=>useInventory.getState(),drag=()=>useItemDrag.getState();
afterEach(()=>{drag().cancel();inventory().reset();});

test('a gardener and the Sproutling get separate nearby spots clear of the dropped item',()=>{
  const actors:PlacementOccupant[]=[{id:'gardener',position:spot,rx:10,ry:8},{id:'pet',position:{x:6.5,y:8.5},rx:14,ry:10}];
  const before=structuredClone(actors),obstacles=[...permanentRoomObstacles,...fixtureObstacles({},undefined,[],true)];
  const moves=planPlacementNudges(desk,spot,actors,obstacles);assert.ok(moves);assert.equal(moves.length,2);assert.deepEqual(actors,before);
  const shifted=actors.map(a=>({...a,position:moves.find(m=>m.id===a.id)!.position}));
  for(let i=0;i<shifted.length;i++){
    assert.ok(distance(actors[i].position,shifted[i].position)<=MAX_PLACEMENT_NUDGE);
    assert.equal(footprintIntersects(itemFootprint(desk,spot),occupantShape(shifted[i])),false);
    assert.ok(!obstacles.some(s=>footprintIntersects(ellipsePolygon(occupantShape(shifted[i])),s)));
  }
  assert.equal(footprintIntersects(ellipsePolygon(occupantShape(shifted[0])),occupantShape(shifted[1])),false);
});

test('a trapped occupant prevents placement and planning never moves anyone',()=>{
  const actor={id:'local',position:spot,rx:10,ry:8},at=iso(spot.x,spot.y);
  const enclosure={kind:'polygon' as const,points:[at.x-20,at.y-20,at.x+20,at.y-20,at.x+20,at.y+20,at.x-20,at.y+20]};
  assert.equal(planPlacementNudges(desk,spot,[actor],[enclosure]),null);assert.deepEqual(actor.position,spot);
});

test('floor pieces and occupants outside the new footprint require no nudges',()=>{
  const actor={id:'local',position:spot,rx:10,ry:8};
  assert.deepEqual(planPlacementNudges({...desk,type:'carpet'},spot,[actor],[]),[]);
  assert.deepEqual(planPlacementNudges(desk,{x:9,y:6},[actor],[]),[]);
});

test('release plans occupants, commits once and applies nudges only for valid drops',t=>{
  inventory().initializeRoom(1,'Classic');const item=inventory().items.find(i=>i.type==='desk')!;
  let actor:PlacementOccupant={id:'local',position:spot,rx:10,ry:8},applied=0,planned=0;
  const obstacles=[...permanentRoomObstacles,...fixtureObstacles({},undefined,[],true)];
  t.after(attachPlacementOccupants(()=>[occupantShape(actor)],preview=>{
    planned++;const moves=planPlacementNudges(preview.item,preview.position,[actor],obstacles);if(!moves)return null;
    const destination=moves[0]?.position??actor.position;
    return {obstacles:[occupantShape({...actor,position:destination})],apply:()=>{applied++;actor={...actor,position:destination};}};
  }));
  drag().select(item.id);drag().beginDrag({x:5.5,y:5.5},1);
  assert.equal(drag().drop(2).valid,false);assert.equal(drag().preview?.phase,'dragging');
  assert.equal(drag().drop(1).valid,false);assert.equal(applied,0);assert.equal(planned,0);assert.equal(inventory().placements.length,0);
  drag().beginDrag({x:5.5,y:5.5},1);drag().move(spot,1);
  assert.ok(checkItemPreview().valid);assert.equal(applied,0);assert.deepEqual(actor.position,spot);
  assert.ok(drag().drop(1).valid);assert.equal(applied,1);assert.equal(drag().preview,null);
  assert.deepEqual(inventory().placements,[{itemId:item.id,position:spot}]);assert.notDeepEqual(actor.position,spot);
  assert.equal(drag().drop(1).valid,false);assert.equal(applied,1);
});

test('failed relocation leaves the ghost and original saved placement intact',t=>{
  inventory().initializeRoom(1,'Classic');const item=inventory().items.find(i=>i.type==='desk')!;
  inventory().placeItem(item.id,spot);const saved=inventory().placements;
  t.after(attachPlacementOccupants(()=>[{kind:'ellipse',...iso(9,6),rx:10,ry:8}],()=>null));
  drag().edit(item.id);drag().beginDrag(spot,1);drag().move({x:9,y:6},1);
  assert.equal(drag().drop(1).valid,false);assert.equal(drag().preview?.phase,'idle');assert.equal(inventory().placements,saved);
});

test('potted trees collide at their pot rims while overlapping foliage remains allowed',()=>{
  const tree={id:'tree:test',type:'tree' as const,theme:'Classic' as const};
  const center=iso(spot.x,spot.y);
  assert.equal(validatePlacement(tree,spot,[{item:{...tree,id:'other'},position:uniso(center.x+40,center.y)}]).valid,false);
  assert.ok(validatePlacement(tree,spot,[{item:{...tree,id:'other'},position:uniso(center.x+56,center.y)}]).valid);
});
