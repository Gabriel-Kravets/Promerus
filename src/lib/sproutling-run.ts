import {connectedLegPixels} from './sprite-locomotion';

/** Use the same attached-leg stride for both sproutling growth stages. */
export function sproutlingRunPixels(source:Uint8ClampedArray,width:number,height:number,frame:number,stage:number){
 return connectedLegPixels(source,width,height,frame,stage===0?.72:.70,stage===0?.56:.44,stage===0?.024:.035);
}
