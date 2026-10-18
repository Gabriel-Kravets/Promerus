import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spriteHoverPixels,fillEnclosedGaps} from './sprite-hover';
import {avatarPixel} from './avatar-palette';

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

test('enclosed gaps are filled so only the outer silhouette is outlined',()=>{
 const width=12,height=12,source=new Uint8ClampedArray(width*height*4);
 for(let y=2;y<10;y++)for(let x=2;x<10;x++)if(x===2||x===9||y===2||y===9)source[(y*width+x)*4+3]=255;
 const filled=fillEnclosedGaps(source,width,height);
 assert.equal(filled[(5*width+5)*4+3],255,'pocket inside the ring becomes solid');
 assert.equal(filled[(0*width+0)*4+3],0,'outside stays transparent');
});

test('hands take the same chosen skin tone as the face',()=>{
 const palette={skin:[104,71,55],hair:[40,33,38],outfit:[103,143,141]},source=[236,170,120];
 const face=avatarPixel(0,false,180,220,source,palette),hand=avatarPixel(0,false,100,380,source,palette);
 assert.deepEqual(hand,face);
 assert.notDeepEqual(avatarPixel(0,false,100,380,[232,216,190],palette),face,'cream cuffs are not skin');
});
