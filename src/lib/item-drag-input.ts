import {useItemDrag} from '../store/item-drag';
import type {Point} from './movement';

type Options={
  point:(event:PointerEvent)=>Point|null;
  hitTest:(point:Point)=>boolean;
  suspended:()=>boolean;
  pickItem?:(point:Point)=>string|undefined;
  onTap?:(point:Point)=>void;
  onHoldStart?:()=>void;
  root?:Window;
};

/** Capture preview presses before Pixi's canvas listener can record a room click. */
export const ITEM_HOLD_MS=500,ITEM_HOLD_SLOP=8;
export function attachItemDragInput(canvas:HTMLCanvasElement,{point,hitTest,suspended,pickItem,onTap,onHoldStart,root=window}:Options):()=>void {
  let captured:number|undefined;
  let hold:{id:string;pointerId:number;x:number;y:number;at:Point;opened:boolean;timer:ReturnType<typeof setTimeout>}|undefined;
  const release=()=>{const id=captured;captured=undefined;if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);};
  const stop=useItemDrag.subscribe(state=>{if(!hold&&state.preview?.phase!=='dragging')release();});
  const clearHold=()=>{if(hold)clearTimeout(hold.timer);hold=undefined;release();};
  const intercept=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  const move=(event:PointerEvent)=>{
    if(hold){
      intercept(event);if(hold.pointerId!==event.pointerId)return;
      if(suspended()){clearHold();useItemDrag.getState().cancel();return;}
      // A drag is also a way to start moving an item. Keep the original grab
      // point so grabbing the top of a tree or desk does not snap its center.
      if(Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>ITEM_HOLD_SLOP){
        const at=point(event);if(!at)return;
        const previous=hold;clearTimeout(previous.timer);
        if(useItemDrag.getState().edit(previous.id)){
          useItemDrag.getState().beginDrag(previous.at,event.pointerId);
          hold=undefined;
          useItemDrag.getState().move(at,event.pointerId);
        }else clearHold();
      }
      return;
    }
    if(!useItemDrag.getState().preview||suspended())return;
    intercept(event);if(!event.isPrimary)return;
    const at=point(event);if(at)useItemDrag.getState().move(at,event.pointerId);
  };
  const down=(event:PointerEvent)=>{
    const {preview}=useItemDrag.getState();
    // Other UI controls remain usable while previewing.
    if(event.target!==canvas||suspended())return;
    if(hold){intercept(event);return;}
    if(!preview){
      if(!event.isPrimary||event.button!==0)return;
      const at=point(event),id=at&&pickItem?.(at);if(!id)return;
      intercept(event);onHoldStart?.();
      const timer=setTimeout(()=>{
        // Holding opens the in-place place/flip/return toolbar without moving the piece.
        if(hold?.pointerId===event.pointerId&&!suspended())hold.opened=useItemDrag.getState().edit(id);
      },ITEM_HOLD_MS);
      hold={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,at,opened:false,timer};
      canvas.setPointerCapture(event.pointerId);captured=event.pointerId;return;
    }
    intercept(event);if(!event.isPrimary||event.button!==0||preview.phase==='dragging')return;
    const at=point(event);if(!at||preview.phase==='idle'&&!hitTest(at))return;
    useItemDrag.getState().beginDrag(at,event.pointerId);
    canvas.setPointerCapture(event.pointerId);captured=event.pointerId;
  };
  const up=(event:PointerEvent)=>{
    if(hold){
      intercept(event);if(hold.pointerId!==event.pointerId)return;
      const previous=hold,at=point(event);clearHold();
      if(!previous.opened&&!suspended()&&at&&pickItem?.(at)===previous.id)onTap?.(at);
      return;
    }
    const preview=useItemDrag.getState().preview;if(!preview)return;
    intercept(event);if(preview.pointerId!==event.pointerId)return;
    if(suspended()){useItemDrag.getState().cancel();return;}
    // Releasing pauses the preview beside its confirm/flip/return controls;
    // nothing is saved until the player confirms the spot.
    const at=point(event);if(at)useItemDrag.getState().move(at,event.pointerId);
    useItemDrag.getState().endDrag(event.pointerId);
  };
  const cancelPointer=(event:PointerEvent)=>{if(hold?.pointerId===event.pointerId){clearHold();useItemDrag.getState().cancel();}else if(useItemDrag.getState().preview?.pointerId===event.pointerId)useItemDrag.getState().cancel();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(hold||useItemDrag.getState().preview)){intercept(event);clearHold();useItemDrag.getState().cancel();}};
  const blur=()=>{clearHold();useItemDrag.getState().cancel();};
  const contextMenu=(event:MouseEvent)=>{const at=point(event as PointerEvent);if(hold||at&&pickItem?.(at))event.preventDefault();};
  const capture={capture:true};
  // Pointer capture delivers movement and release outside the canvas, including touch.
  root.addEventListener('pointerdown',down,capture);
  canvas.addEventListener('pointermove',move,capture);canvas.addEventListener('pointerup',up,capture);
  canvas.addEventListener('pointercancel',cancelPointer,capture);canvas.addEventListener('lostpointercapture',cancelPointer);
  canvas.addEventListener('contextmenu',contextMenu);
  root.addEventListener('keydown',escape,capture);root.addEventListener('blur',blur);
  const previousTouchAction=canvas.style.touchAction;canvas.style.touchAction='none';
  return()=>{
    root.removeEventListener('pointerdown',down,capture);
    canvas.removeEventListener('pointermove',move,capture);canvas.removeEventListener('pointerup',up,capture);
    canvas.removeEventListener('pointercancel',cancelPointer,capture);canvas.removeEventListener('lostpointercapture',cancelPointer);
    canvas.removeEventListener('contextmenu',contextMenu);
    root.removeEventListener('keydown',escape,capture);root.removeEventListener('blur',blur);
    stop();clearHold();canvas.style.touchAction=previousTouchAction;useItemDrag.getState().cancel();
  };
}
