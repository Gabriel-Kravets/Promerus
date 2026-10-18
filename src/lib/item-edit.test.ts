import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {attachItemDragInput,ITEM_HOLD_MS} from './item-drag-input';
import {useInventory} from '../store/inventory';
import {useItemDrag,checkItemPreview,listenForItemDragInventory} from '../store/item-drag';
import {studyStations} from './world-layout';

const inventory=()=>useInventory.getState(),drag=()=>useItemDrag.getState();
const original={x:6,y:9},destination={x:9,y:6};
afterEach(()=>{drag().cancel();inventory().reset();});
function placedDesk(){
  inventory().initializeRoom(['alex','maya'],'Classic');
  const item=inventory().items.find(item=>item.grantedTo==='alex')!;
  assert.ok(inventory().placeItem(item.id,original).valid);return item;
}

test('moving an existing item keeps its saved placement until confirmed and cancel restores it',t=>{
  t.after(listenForItemDragInventory());const item=placedDesk(),saved=inventory().placements;
  assert.ok(drag().edit(item.id));
  assert.ok(checkItemPreview().valid,'the original footprint does not collide with itself');
  drag().beginDrag(original,1);drag().move(destination,1);drag().endDrag(1);
  assert.equal(inventory().placements,saved);assert.equal(drag().select(item.id),false);
  drag().cancel();assert.equal(inventory().placements,saved);assert.equal(drag().preview,null);
});

test('confirm move updates one owned instance and preserves its theme and inventory availability',t=>{
  t.after(listenForItemDragInventory());const item=placedDesk(),owned=inventory().items;
  assert.ok(drag().edit(item.id));drag().beginDrag(original,1);drag().move(destination,1);drag().endDrag(1);
  inventory().setTheme('Stardew');assert.ok(drag().confirm().valid);
  assert.equal(drag().preview,null);assert.equal(inventory().items,owned);
  assert.deepEqual(inventory().placements,[{itemId:item.id,position:destination}]);
  assert.equal(inventory().items.find(i=>i.id===item.id)?.theme,'Classic');
  assert.equal(drag().select(item.id),false);
});

test('invalid move keeps both the original permanent item and its editable ghost',()=>{
  const item=placedDesk(),saved=inventory().placements;assert.ok(drag().edit(item.id));
  drag().beginDrag(original,1);drag().move({x:5.5,y:5.5},1);drag().endDrag(1);
  assert.equal(drag().confirm().valid,false);assert.equal(inventory().placements,saved);assert.ok(drag().preview);
  drag().cancel();assert.deepEqual(inventory().placements,[{itemId:item.id,position:original}]);
});

test('deleting from the room restores Collection availability and dismisses stale controls',t=>{
  t.after(listenForItemDragInventory());const item=placedDesk(),owned=inventory().items;
  assert.ok(drag().edit(item.id));inventory().returnItem(item.id);
  assert.equal(drag().preview,null);assert.equal(inventory().items,owned);assert.equal(inventory().placements.length,0);
  assert.ok(drag().select(item.id));assert.equal(drag().edit('missing'),false);
});

function inputHarness(itemId:string){
  const canvasTarget=new EventTarget(),rootTarget=new EventTarget(),captures=new Set<number>();
  const canvas=Object.assign(canvasTarget,{
    style:{touchAction:'pan-y'},setPointerCapture:(id:number)=>captures.add(id),hasPointerCapture:(id:number)=>captures.has(id),releasePointerCapture:(id:number)=>captures.delete(id),
  }) as unknown as HTMLCanvasElement;
  let hits=true,suspended=false,taps=0,starts=0;
  const cleanup=attachItemDragInput(canvas,{root:rootTarget as unknown as Window,
    point:event=>({x:event.clientX,y:event.clientY}),hitTest:()=>true,suspended:()=>suspended,
    pickItem:()=>hits?itemId:undefined,onTap:()=>{taps++;},onHoldStart:()=>{starts++;},
  });
  const send=(type:string,values:Record<string,unknown>={})=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperties(event,Object.fromEntries(Object.entries({pointerId:1,isPrimary:true,button:0,clientX:6,clientY:9,pointerType:'touch',...values}).map(([key,value])=>[key,{value}])));
    if(type==='pointerdown'){Object.defineProperty(event,'target',{value:canvasTarget});rootTarget.dispatchEvent(event);}
    else (type==='keydown'||type==='blur'?rootTarget:canvasTarget).dispatchEvent(event);
    return event;
  };
  return {send,cleanup,captures,taps:()=>taps,starts:()=>starts,setHits:(value:boolean)=>{hits=value;},setSuspended:(value:boolean)=>{suspended=value;}};
}

test('short clicks preserve normal furniture activation without opening item controls',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  assert.ok(h.send('pointerdown').defaultPrevented);assert.equal(h.starts(),1);
  t.mock.timers.tick(ITEM_HOLD_MS-1);h.send('pointerup');t.mock.timers.tick(1000);
  assert.equal(drag().preview,null);assert.equal(h.taps(),1);assert.equal(h.captures.size,0);
});

test('holding opens the in-place toolbar and releasing does not activate furniture or walk',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  const saved=inventory().placements;
  h.send('pointerdown');t.mock.timers.tick(ITEM_HOLD_MS);
  assert.equal(drag().preview?.item.id,item.id);assert.equal(drag().preview?.phase,'idle');
  assert.deepEqual(drag().preview?.position,drag().preview?.originalPosition);
  assert.ok(h.captures.has(1));h.send('pointerup');assert.equal(h.taps(),0);assert.equal(h.captures.size,0);
  assert.equal(drag().preview?.phase,'idle');assert.equal(inventory().placements,saved);
  // Flipping in place and placing keeps the spot but saves the new orientation.
  drag().flip();assert.ok(drag().confirm().valid);assert.equal(drag().preview,null);
  assert.deepEqual(inventory().placements,saved);
  assert.equal(inventory().items.find(owned=>owned.id===item.id)?.mirrored,true);
});

test('cancelling after moving and flipping restores the original placement and orientation',t=>{
  const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);const saved=inventory().placements;
  drag().edit(item.id);h.send('pointerdown');h.send('pointerup',{clientX:9,clientY:6});
  assert.notDeepEqual(drag().preview?.position,drag().preview?.originalPosition);
  drag().flip();drag().cancel();
  assert.equal(drag().preview,null);assert.equal(inventory().placements,saved);
  assert.ok(!inventory().items.find(owned=>owned.id===item.id)?.mirrored);
});

test('dragging a placed item waits for confirmation after release',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  const saved=inventory().placements;
  h.send('pointerdown');h.send('pointermove',{clientX:15,clientY:6});
  assert.equal(drag().preview?.phase,'dragging');assert.ok(h.captures.has(1));
  t.mock.timers.tick(ITEM_HOLD_MS);assert.equal(drag().preview?.phase,'dragging');
  assert.equal(inventory().placements,saved);
  h.send('pointerup',{clientX:9,clientY:6});
  assert.equal(drag().preview?.phase,'idle');assert.equal(h.taps(),0);assert.equal(h.captures.size,0);
  assert.equal(inventory().placements,saved);
  assert.ok(drag().confirm().valid);assert.equal(drag().preview,null);
  assert.deepEqual(inventory().placements,[{itemId:item.id,position:destination}]);
});

test('holding then dragging uses the same pointer and preserves the grab offset',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  h.send('pointerdown',{clientX:7});t.mock.timers.tick(ITEM_HOLD_MS);
  assert.equal(drag().preview?.phase,'idle');
  h.send('pointermove',{clientX:16,clientY:6});
  assert.equal(drag().preview?.phase,'dragging');assert.ok(h.captures.has(1));
  h.send('pointermove',{pointerId:2,isPrimary:false,clientX:30});
  h.send('pointerup',{pointerId:2,isPrimary:false});assert.equal(drag().preview?.phase,'dragging');
  h.send('pointerup',{clientX:10,clientY:6});
  assert.equal(drag().preview?.phase,'idle');assert.equal(h.taps(),0);
  assert.ok(drag().confirm().valid);
  assert.deepEqual(inventory().placements,[{itemId:item.id,position:destination}]);
});

test('the same native hold-and-drag gesture moves an original desk without a Collection placement',t=>{
  t.mock.timers.enable({apis:['setTimeout']});inventory().initializeRoom(1,'Classic');
  const id='fixture:desk-0',at=studyStations[0].position,h=inputHarness(id);t.after(h.cleanup);
  h.send('pointerdown',{clientX:at.x,clientY:at.y});t.mock.timers.tick(ITEM_HOLD_MS);
  assert.equal(drag().preview?.item.id,id);assert.equal(drag().preview?.phase,'idle');
  h.send('pointermove',{clientX:at.x+10,clientY:at.y});assert.equal(drag().preview?.phase,'dragging');
  h.send('pointerup',{clientX:6,clientY:9});assert.equal(drag().preview?.phase,'idle');
  assert.ok(drag().confirm().valid);assert.equal(drag().preview,null);
  assert.deepEqual(inventory().fixturePositions?.[id],original);
  assert.equal(inventory().placements.length,0);assert.equal(h.taps(),0);assert.equal(h.captures.size,0);
});

test('an invalid release keeps the old placement and can be dragged to a valid spot before confirming',t=>{
  const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);const saved=inventory().placements;
  drag().edit(item.id);h.send('pointerdown');h.send('pointerup',{clientX:5.5,clientY:5.5});
  assert.equal(drag().preview?.phase,'idle');assert.equal(inventory().placements,saved);assert.equal(h.captures.size,0);
  h.send('pointerdown',{clientX:5.5,clientY:5.5});h.send('pointerup',{clientX:9,clientY:6});
  assert.equal(inventory().placements,saved);assert.ok(drag().confirm().valid);assert.equal(drag().preview,null);assert.deepEqual(inventory().placements,[{itemId:item.id,position:destination}]);
});

test('small pointer jitter preserves a short click and suspension cancels a pending drag',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  h.send('pointerdown');h.send('pointermove',{clientX:7});h.send('pointerup');
  assert.equal(h.taps(),1);assert.equal(drag().preview,null);
  h.send('pointerdown');h.setSuspended(true);h.send('pointermove',{clientX:20});
  t.mock.timers.tick(ITEM_HOLD_MS);h.send('pointerup');
  assert.equal(drag().preview,null);assert.equal(h.captures.size,0);assert.equal(h.taps(),1);
});

test('Escape, blur, cancellation and lost capture clear pending and completed holds',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  for(const opened of [false,true])for(const type of ['keydown','blur','pointercancel','lostpointercapture']){
    h.send('pointerdown');t.mock.timers.tick(opened?ITEM_HOLD_MS:100);
    h.send(type,{key:'Escape'});t.mock.timers.tick(ITEM_HOLD_MS);h.send('pointerup');
    assert.equal(drag().preview,null,type);assert.equal(h.captures.size,0,type);assert.equal(h.taps(),0,type);
  }
});

test('suspension and an item removed during a hold cannot open stale controls',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);t.after(h.cleanup);
  h.send('pointerdown');h.setSuspended(true);t.mock.timers.tick(ITEM_HOLD_MS);h.send('pointerup');
  assert.equal(drag().preview,null);assert.equal(h.taps(),0);
  h.setSuspended(false);h.send('pointerdown');inventory().returnItem(item.id);h.setHits(false);
  t.mock.timers.tick(ITEM_HOLD_MS);h.send('pointerup');assert.equal(drag().preview,null);assert.equal(h.taps(),0);
});

test('cleanup cancels the timer and a second pointer cannot take over a hold',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const item=placedDesk(),h=inputHarness(item.id);
  h.send('pointerdown');h.send('pointerdown',{pointerId:2,isPrimary:false});h.send('pointerup',{pointerId:2,isPrimary:false});
  assert.ok(h.captures.has(1));h.cleanup();t.mock.timers.tick(ITEM_HOLD_MS);
  assert.equal(h.captures.size,0);assert.equal(drag().preview,null);
  assert.equal(h.send('pointerdown').defaultPrevented,false);
});
