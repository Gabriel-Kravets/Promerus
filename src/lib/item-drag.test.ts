import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {iso,type Point} from './movement';
import {pointerRoomPosition} from './item-drag';
import {attachItemDragInput} from './item-drag-input';
import {withinRoom} from './placement';
import {useInventory} from '../store/inventory';
import {useItemDrag,listenForItemDragInventory} from '../store/item-drag';

const drag=()=>useItemDrag.getState();
const inventory=()=>useInventory.getState();
afterEach(()=>{drag().cancel();inventory().reset();});
function selectDesk(){inventory().initializeRoom(['alex','maya'],'Classic');assert.ok(drag().select('desk:member:maya'));}
const near=(actual:Point|null,expected:Point)=>{
  assert.ok(actual);assert.ok(Math.abs(actual.x-expected.x)<1e-8);assert.ok(Math.abs(actual.y-expected.y)<1e-8);
};

test('client coordinates account for canvas CSS size, offset, letterboxing and scene scale',()=>{
  const expected={x:3.25,y:8.75},scenePoint=iso(expected.x,expected.y);
  for(const screen of [{width:1320,height:744},{width:800,height:1000},{width:1920,height:900}]){
    const scale=Math.min(screen.width/1320,screen.height/744);
    const scene={x:(screen.width-1320*scale)/2,y:(screen.height-744*scale)/2,scaleX:scale,scaleY:scale};
    // CSS display can be scaled independently of renderer logical pixels/DPR.
    for(const cssScale of [.5,1,1.5]){
      const rect={left:-160,top:95,width:screen.width*cssScale,height:screen.height*cssScale};
      const client={x:rect.left+(scene.x+scenePoint.x*scale)*cssScale,y:rect.top+(scene.y+scenePoint.y*scale)*cssScale};
      near(pointerRoomPosition(client,rect,screen,scene),expected);
    }
  }
});

test('coordinate conversion rejects hidden canvases and retains positions beyond room borders',()=>{
  const rect={left:0,top:0,width:1320,height:744},screen={width:1320,height:744},scene={x:0,y:0,scaleX:1,scaleY:1};
  near(pointerRoomPosition(iso(-20,40),rect,screen,scene),{x:-20,y:40});
  assert.equal(pointerRoomPosition({x:1,y:2},{...rect,width:0},screen,scene),null);
  assert.equal(pointerRoomPosition({x:NaN,y:2},rect,screen,scene),null);
});

test('selection requires ownership and retains the exact instance and its original theme',()=>{
  assert.equal(drag().select('shop:lantern:1'),false);
  selectDesk();inventory().setTheme('Stardew');inventory().personJoined('kai');
  assert.equal(drag().preview?.item.id,'desk:member:maya');assert.equal(drag().preview?.item.theme,'Classic');
  assert.equal(drag().select('unknown'),false);assert.equal(drag().preview?.item.id,'desk:member:maya');
  assert.ok(drag().select('desk:member:kai'));assert.equal(drag().preview?.item.theme,'Stardew');
  const lantern=inventory().buyItem('lantern')!;
  assert.ok(drag().select(lantern.id));assert.equal(drag().preview?.item.type,'lantern');
  // Selecting again replaces the only ghost instead of making additional copies.
  assert.ok(drag().select(lantern.id));assert.equal(drag().preview?.phase,'following');
});

test('ghost follows, pauses on release, and re-grabs without jumping or consuming inventory',()=>{
  selectDesk();const owned=inventory().items;
  drag().move({x:4,y:5},1);near(drag().preview!.position,{x:4,y:5});
  drag().beginDrag({x:4,y:5},1);drag().move({x:8,y:8},1);drag().endDrag(1);
  assert.equal(drag().preview?.phase,'idle');near(drag().preview!.position,{x:8,y:8});
  drag().move({x:20,y:20},1);near(drag().preview!.position,{x:8,y:8});
  drag().beginDrag({x:9,y:8},1);near(drag().preview!.position,{x:8,y:8});
  drag().move({x:8,y:7},1);near(drag().preview!.position,{x:7,y:7});drag().endDrag(1);
  assert.equal(inventory().items,owned);drag().cancel();assert.equal(inventory().items,owned);
  assert.equal(drag().preview,null);
});

test('a second pointer cannot steal, move or release an active drag',()=>{
  selectDesk();drag().beginDrag({x:4,y:5},7);
  drag().beginDrag({x:9,y:9},8);drag().move({x:20,y:20},8);drag().endDrag(8);
  assert.equal(drag().preview?.pointerId,7);near(drag().preview!.position,{x:4,y:5});
  drag().move({x:Infinity,y:0},7);near(drag().preview!.position,{x:4,y:5});
  drag().endDrag(7);assert.equal(drag().preview?.phase,'idle');
});

test('inventory reset clears the ghost; room-theme changes preserve it',t=>{
  const stop=listenForItemDragInventory();t.after(stop);selectDesk();
  inventory().setTheme('Stardew');assert.equal(drag().preview?.item.theme,'Classic');
  inventory().reset();assert.equal(drag().preview,null);
});

// Native EventTargets exercise the real input handlers without a browser renderer.
function inputHarness(){
  const canvasTarget=new EventTarget(),rootTarget=new EventTarget();
  const captures=new Set<number>(),released:number[]=[];
  const canvas=Object.assign(canvasTarget,{
    style:{touchAction:'pan-y'},
    setPointerCapture:(id:number)=>captures.add(id),hasPointerCapture:(id:number)=>captures.has(id),
    releasePointerCapture:(id:number)=>{captures.delete(id);released.push(id);},
  }) as unknown as HTMLCanvasElement;
  let suspended=false,hit=true;
  const cleanup=attachItemDragInput(canvas,{root:rootTarget as unknown as Window,
    point:event=>({x:event.clientX,y:event.clientY}),hitTest:()=>hit,suspended:()=>suspended});
  const send=(type:string,values:Record<string,unknown>={},target=canvasTarget)=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperties(event,Object.fromEntries(Object.entries({pointerId:1,isPrimary:true,button:0,clientX:4,clientY:5,...values}).map(([key,value])=>[key,{value}])));
    if(type==='pointerdown'){
      Object.defineProperty(event,'target',{value:target});rootTarget.dispatchEvent(event);
    }else target.dispatchEvent(event);
    return event;
  };
  return {canvas,rootTarget,send,cleanup,captures,released,setSuspended:(value:boolean)=>{suspended=value;},setHit:(value:boolean)=>{hit=value;}};
}

test('preview input intercepts room presses, captures dragging, releases outside the room and resumes normally',t=>{
  const h=inputHarness();t.after(h.cleanup);selectDesk();
  assert.ok(h.send('pointerdown').defaultPrevented);assert.ok(h.captures.has(1));
  h.send('pointermove',{clientX:-40,clientY:100});assert.ok(withinRoom(drag().preview!.item,drag().preview!.position));
  assert.ok(h.send('pointerup',{clientX:-50,clientY:110}).defaultPrevented);
  assert.ok(withinRoom(drag().preview!.item,drag().preview!.position));assert.equal(drag().preview?.phase,'idle');
  assert.deepEqual(h.released,[1]);assert.equal(h.captures.size,0);
  h.setHit(false);h.send('pointerdown');assert.equal(drag().preview?.phase,'idle');
  h.setHit(true);h.send('pointerdown',{clientX:-50,clientY:110});assert.equal(drag().preview?.phase,'dragging');
  drag().cancel();assert.equal(h.captures.size,0);
  assert.equal(h.send('pointerdown').defaultPrevented,false);
});

test('secondary buttons, secondary pointers, suspension and UI buttons cannot start preview drags',t=>{
  const h=inputHarness();t.after(h.cleanup);selectDesk();
  h.send('pointerdown',{button:2});h.send('pointerdown',{isPrimary:false});
  h.setSuspended(true);h.send('pointerdown');h.setSuspended(false);
  const buttonPress=h.send('pointerdown',{},h.rootTarget);assert.equal(buttonPress.defaultPrevented,false);
  assert.equal(drag().preview?.phase,'following');assert.equal(h.captures.size,0);
});

test('Escape, focus loss, pointer cancellation and capture loss cancel previews and release capture',t=>{
  const h=inputHarness();t.after(h.cleanup);
  for(const kind of ['pointercancel','lostpointercapture','keydown','blur']){
    selectDesk();h.send('pointerdown');
    const event=h.send(kind,{key:'Escape'},kind==='keydown'||kind==='blur'?h.rootTarget:undefined);
    assert.equal(drag().preview,null,kind);assert.equal(h.captures.size,0,kind);
    if(kind==='keydown')assert.ok(event.defaultPrevented);
  }
});

test('input cleanup removes listeners, clears preview and restores canvas state',()=>{
  const h=inputHarness();selectDesk();h.send('pointerdown');h.cleanup();
  assert.equal(drag().preview,null);assert.equal(h.captures.size,0);assert.equal(h.canvas.style.touchAction,'pan-y');
  selectDesk();assert.equal(h.send('pointerdown').defaultPrevented,false);
  assert.equal(h.send('keydown',{key:'Escape'},h.rootTarget).defaultPrevented,false);
  assert.ok(drag().preview);
});
