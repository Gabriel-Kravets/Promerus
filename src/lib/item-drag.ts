import {uniso,type Point} from './movement';

type CanvasRect={left:number;top:number;width:number;height:number};
type SceneTransform={x:number;y:number;scaleX:number;scaleY:number};

/** Client pixels -> logical canvas pixels -> scene -> unprojected room grid.
 * Renderer dimensions are logical pixels (app.screen), never the DPR backing size.
 * Positions intentionally remain unrestricted until placement validation is added.
 */
export function pointerRoomPosition(client:Point,rect:CanvasRect,screen:{width:number;height:number},scene:SceneTransform):Point|null {
  if(rect.width<=0||rect.height<=0||scene.scaleX<=0||scene.scaleY<=0)return null;
  const x=((client.x-rect.left)*screen.width/rect.width-scene.x)/scene.scaleX;
  const y=((client.y-rect.top)*screen.height/rect.height-scene.y)/scene.scaleY;
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return uniso(x,y);
}
