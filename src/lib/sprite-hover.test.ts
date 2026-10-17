import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spriteHoverPixels} from './sprite-hover';

test('hover follows opaque artwork instead of outlining its bounding rectangle',()=>{
 const width=24,height=24,source=new Uint8ClampedArray(width*height*4);
 for(let y=5;y<19;y++)for(let x=5;x<19;x++)if(x<9||y>14)source[(y*width+x)*4+3]=255;
 // A faint atlas speck must not expand the clickable silhouette.
 source[(2*width+2)*4+3]=80;
 const {pixels,bounds}=spriteHoverPixels(source,width,height);
 const alpha=(x:number,y:number)=>pixels[(y*width+x)*4+3];
 assert.deepEqual(bounds,{left:5,top:5,right:19,bottom:19});
 assert.equal(alpha(6,10),12,'subtle tint stays inside the artwork');
 assert.ok(alpha(4,10)>100,'thin edge hugs the opaque boundary');
 assert.equal(alpha(17,5),0,'empty area inside the bounding rectangle stays clear');
 assert.equal(alpha(2,2),0,'faint specks do not produce stray outlines');
});
