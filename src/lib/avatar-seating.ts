import {iso} from './movement';
import {studyStations} from './world-layout';
import {itemSprites,type InventoryItem} from './items';
import type {Point} from './movement';

export function placedChairPose(item:InventoryItem,position:Point,aspect:number){
  if(item.type==='desk')return chairPose(0,aspect,position,!!item.mirrored);
  if(item.type!=='armchair')return undefined;
  const origin=iso(position.x,position.y),art=itemSprites.armchair!,sign=item.mirrored?-1:1;
  return {x:origin.x-.15*art.width*sign,y:origin.y+art.offsetY-.35*art.width*aspect,
    anchorX:.5,anchorY:.74,facing:sign,depth:origin.y+2};
}

/** Align the reading sprite's hips with the cushion, independently of the floor approach. */
export function chairPose(index:number,deskAspect=561/701,position=studyStations[index].position,mirrored=false){
  const station=studyStations[index],origin=iso(position.x,position.y);
  return {x:origin.x+(station.chair.x-.5)*station.width*(mirrored?-1:1),
    y:origin.y+36-(1-station.chair.y)*station.width*deskAspect,
    anchorX:.5,anchorY:.74,facing:(station.atlasColumn===0?1:-1)*(mirrored?-1:1),depth:origin.y+2};
}
