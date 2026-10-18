import {Rectangle,Texture,type Renderer} from 'pixi.js';
import type {InventoryItem} from './items';
import type {Point} from './movement';
import {createItemArt} from './item-preview';
import {fillEnclosedGaps,spriteHoverPixels} from './sprite-hover';

export type ItemHover={
  texture:Texture;left:number;top:number;resolution:number;
  width:number;height:number;pixels:Uint8ClampedArray;
  bounds:{left:number;top:number;right:number;bottom:number};
};

/** Render the actual sprite/procedural artwork once, with room for its soft edge. */
export function createItemHover(renderer:Renderer,item:InventoryItem):ItemHover {
  const source=createItemArt({...item,mirrored:false}),bounds=source.getLocalBounds(),pad=4,resolution=2;
  const left=Math.floor(bounds.minX)-pad,top=Math.floor(bounds.minY)-pad;
  const frame=new Rectangle(left,top,Math.ceil(bounds.maxX)+pad-left,Math.ceil(bounds.maxY)+pad-top);
  let data:ReturnType<Renderer['extract']['pixels']>;
  try{data=renderer.extract.pixels({target:source,frame,resolution,antialias:true});}
  finally{source.destroy({children:true});}
  const {pixels,width,height}=data;
  const hover=spriteHoverPixels(fillEnclosedGaps(pixels,width,height),width,height,3);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(hover.pixels),width,height),0,0);
  const texture=Texture.from(canvas);texture.source.scaleMode='linear';
  return {texture,left,top,resolution,width,height,pixels,bounds:{
    left:left+hover.bounds.left/resolution,top:top+hover.bounds.top/resolution,
    right:left+hover.bounds.right/resolution,bottom:top+hover.bounds.bottom/resolution,
  }};
}

/** Coordinates are local to the unmirrored art; callers invert its world transform. */
export function itemHoverContains(mask:Pick<ItemHover,'left'|'top'|'resolution'|'width'|'height'|'pixels'>,point:Point):boolean {
  const x=Math.floor((point.x-mask.left)*mask.resolution),y=Math.floor((point.y-mask.top)*mask.resolution);
  return x>=0&&y>=0&&x<mask.width&&y<mask.height&&mask.pixels[(y*mask.width+x)*4+3]>90;
}
