import {create} from 'zustand';
import type {InventoryItem} from '../lib/items';
import type {Point} from '../lib/movement';
import {useInventory} from './inventory';
import {constrainItemPosition,resolvePlacements,validatePlacement,type PlacementCheck} from '../lib/placement';
import type {Shape} from '../lib/world-geometry';
import {fixtureItem,roomFixture} from '../lib/room-fixtures';

export type ItemPreview={
  item:InventoryItem;
  /** Center of the footprint in unprojected room-grid units. */
  position:Point;
  phase:'following'|'dragging'|'idle';
  pointerId:number|null;
  grabOffset:Point;
  /** Saved placement remains intact until a valid drop is committed. */
  originalPosition?:Point;
};
type ItemDragState={
  preview:ItemPreview|null;
  edit:(itemId:string)=>boolean;
  select:(itemId:string)=>boolean;
  move:(point:Point,pointerId:number)=>void;
  beginDrag:(point:Point,pointerId:number)=>void;
  endDrag:(pointerId:number)=>void;
  drop:(pointerId:number)=>PlacementCheck;
  flip:()=>void;
  returnToCollection:()=>void;
  cancel:()=>void;
  confirm:(extraObstacles?:readonly Shape[])=>PlacementCheck;
};
const finite=(point:Point)=>Number.isFinite(point.x)&&Number.isFinite(point.y);
let readOccupants:()=>readonly Shape[]=()=>[];
export type PlacementOccupantPlan={obstacles:readonly Shape[];apply:()=>void};
let planOccupants:((preview:ItemPreview)=>PlacementOccupantPlan|null)|undefined;
/** Preview and release share a side-effect-free plan; only a valid drop applies it. */
export function attachPlacementOccupants(reader:()=>readonly Shape[],planner?:(preview:ItemPreview)=>PlacementOccupantPlan|null):()=>void {
  readOccupants=reader;planOccupants=planner;
  return()=>{if(readOccupants===reader){readOccupants=()=>[];planOccupants=undefined;}};
}

/** Preview state stays ephemeral until a valid drop or keyboard placement. */
export const useItemDrag=create<ItemDragState>((set,get)=>({
  preview:null,
  edit:itemId=>{
    const inventory=useInventory.getState(),fixture=roomFixture(itemId),item=fixtureItem(itemId,inventory.theme,inventory.fixturePositions?.[itemId]?.mirrored)??inventory.items.find(item=>item.id===itemId),placement=fixture&&!inventory.storedFixtures?.includes(itemId)?{position:inventory.fixturePositions?.[itemId]??fixture.position}:inventory.placements.find(p=>p.itemId===itemId);
    if(!inventory.initialized||!item||!placement)return false;
    const position={x:placement.position.x,y:placement.position.y};
    set({preview:{item:{...item},position,originalPosition:{...position},phase:'idle',pointerId:null,grabOffset:{x:0,y:0}}});return true;
  },
  select:itemId=>{
    const inventory=useInventory.getState();
    const item=inventory.initialized?(roomFixture(itemId)&&inventory.storedFixtures?.includes(itemId)?fixtureItem(itemId,inventory.theme,inventory.fixturePositions?.[itemId]?.mirrored):inventory.items.find(item=>item.id===itemId)):undefined;
    if(!item||inventory.placements.some(p=>p.itemId===itemId))return false;
    set({preview:{item:{...item},position:constrainItemPosition(item,{x:8,y:8}),phase:'following',pointerId:null,grabOffset:{x:0,y:0}}});
    return true;
  },
  move:(point,pointerId)=>set(state=>{
    const p=state.preview;
    if(!p||!finite(point)||p.phase==='idle'||p.phase==='dragging'&&p.pointerId!==pointerId)return state;
    return {preview:{...p,position:constrainItemPosition(p.item,{x:point.x-p.grabOffset.x,y:point.y-p.grabOffset.y},p.position)}};
  }),
  beginDrag:(point,pointerId)=>set(state=>{
    const p=state.preview;
    if(!p||!finite(point)||p.phase==='dragging')return state;
    const following=p.phase==='following';
    return {preview:{...p,phase:'dragging',pointerId,
      position:following?constrainItemPosition(p.item,point,p.position):p.position,
      grabOffset:following?{x:0,y:0}:{x:point.x-p.position.x,y:point.y-p.position.y}}};
  }),
  endDrag:pointerId=>set(state=>{
    const p=state.preview;
    return p?.phase==='dragging'&&p.pointerId===pointerId
      ?{preview:{...p,phase:'idle',pointerId:null,grabOffset:{x:0,y:0}}}:state;
  }),
  drop:pointerId=>{
    const preview=get().preview;
    if(preview?.phase!=='dragging'||preview.pointerId!==pointerId)return {valid:false,reason:'moving',message:'Finish dragging this piece first.'};
    get().endDrag(pointerId);return get().confirm();
  },
  flip:()=>set(state=>state.preview?{preview:{...state.preview,item:{...state.preview.item,mirrored:!state.preview.item.mirrored}}}:state),
  returnToCollection:()=>{
    const id=get().preview?.item.id;
    if(id)useInventory.getState().returnItem(id);
    set({preview:null});
  },
  cancel:()=>set(state=>state.preview?{preview:null}:state),
  confirm:extraObstacles=>{
    const preview=get().preview;
    if(!preview)return {valid:false,reason:'unavailable',message:'Choose an available item first.'};
    if(preview.phase!=='idle')return {valid:false,reason:'moving',message:'Release the preview before confirming placement.'};
    const staticCheck=checkItemPreview([]);if(!staticCheck.valid)return staticCheck;
    const plan=extraObstacles===undefined?planOccupants?.(preview):undefined;
    if(plan===null)return {valid:false,reason:'collision',message:'There is no clear spot nearby for a gardener or the Sproutling to step aside.'};
    const obstacles=extraObstacles??plan?.obstacles??readOccupants(),inventory=useInventory.getState();
    const result=roomFixture(preview.item.id)?inventory.moveFixture(preview.item.id,preview.position,obstacles,!!preview.item.mirrored):preview.originalPosition?inventory.moveItem(preview.item.id,preview.position,obstacles,!!preview.item.mirrored):inventory.placeItem(preview.item.id,preview.position,obstacles,!!preview.item.mirrored);
    if(result.valid){plan?.apply();set({preview:null});}
    return result;
  },
}));

/** Viewport position of the preview art, published by the canvas so the
 * placement controls can sit beside the piece being moved. */
export type PreviewAnchor={x:number;top:number;bottom:number};
export const usePreviewAnchor=create<{anchor:PreviewAnchor|null}>(()=>({anchor:null}));
export function setPreviewAnchor(anchor:PreviewAnchor|null){
  const current=usePreviewAnchor.getState().anchor;
  if(anchor===current||anchor&&current&&Math.abs(anchor.x-current.x)<.5&&Math.abs(anchor.top-current.top)<.5&&Math.abs(anchor.bottom-current.bottom)<.5)return;
  usePreviewAnchor.setState({anchor});
}

export function checkItemPreview(extraObstacles?:readonly Shape[]):PlacementCheck {
  const preview=useItemDrag.getState().preview,inventory=useInventory.getState();
  if(extraObstacles===undefined&&preview&&planOccupants){
    const staticCheck=checkItemPreview([]);if(!staticCheck.valid)return staticCheck;
    const plan=planOccupants(preview);
    return plan?checkItemPreview(plan.obstacles):{valid:false,reason:'collision',message:'There is no clear spot nearby for a gardener or the Sproutling to step aside.'};
  }
  const obstacles=extraObstacles??readOccupants();
  if(preview&&roomFixture(preview.item.id))return inventory.initialized&&(!!preview.originalPosition!==!!inventory.storedFixtures?.includes(preview.item.id))?validatePlacement(preview.item,preview.position,resolvePlacements(inventory.items,inventory.placements),obstacles,inventory.fixturePositions,inventory.storedFixtures):{valid:false,reason:'unavailable',message:'This room item is unavailable.'};
  const isPlaced=!!preview&&inventory.placements.some(p=>p.itemId===preview.item.id);
  if(!preview||!inventory.initialized||!inventory.items.some(item=>item.id===preview.item.id)||isPlaced!==!!preview.originalPosition)return {valid:false,reason:'unavailable',message:'Choose an available item first.'};
  return validatePlacement(preview.item,preview.position,resolvePlacements(inventory.items,inventory.placements.filter(p=>p.itemId!==preview.item.id)),obstacles,inventory.fixturePositions,inventory.storedFixtures);
}

/** A reset or loss of ownership also clears the temporary selection. */
export function listenForItemDragInventory():()=>void {
  return useInventory.subscribe(inventory=>{
    const {preview}=useItemDrag.getState();
    if(preview&&roomFixture(preview.item.id)&&!!preview.originalPosition===!!inventory.storedFixtures?.includes(preview.item.id))useItemDrag.getState().cancel();
    if(preview&&(!inventory.initialized||!roomFixture(preview.item.id)&&(inventory.placements.some(p=>p.itemId===preview.item.id)!==!!preview.originalPosition||!inventory.items.some(item=>
      item.id===preview.item.id&&item.type===preview.item.type&&item.theme===preview.item.theme
    ))))useItemDrag.getState().cancel();
  });
}
