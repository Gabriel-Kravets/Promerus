import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sproutlingRunPixels} from './sproutling-run';
import {RUN_FRAME_COUNT} from './sprite-locomotion';
import assets from './scene-assets.json';

test('both growth stages have an attached, visible stride and restore the rest pose',()=>{
 const width=120,height=100,source=new Uint8ClampedArray(width*height*4);
 for(let y=50;y<95;y++)for(let x=30;x<80;x++){
  if(y<80||x<46||x>60)source.set([200,170,110,255],(y*width+x)*4);
 }
 for(const stage of [0,1]){
  const forward=sproutlingRunPixels(source,width,height,3,stage);
  const backward=sproutlingRunPixels(source,width,height,9,stage);
  assert.notDeepEqual(forward,source,`stage ${stage} must animate`);
  assert.notDeepEqual(forward,backward,`stage ${stage} must alternate feet`);
  assert.deepEqual(sproutlingRunPixels(source,width,height,0,stage),source);
  assert.deepEqual(forward.slice(0,70*width*4),source.slice(0,70*width*4),'upper body stays intact');
  // Every solid foot pixel must still connect to the torso.
  const visited=new Set<number>(),queue=[55*width+50];
  while(queue.length){const p=queue.pop()!;if(visited.has(p)||forward[p*4+3]<90)continue;visited.add(p);
   const x=p%width,y=Math.floor(p/width);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)queue.push(p+dy*width+dx);
  }
  for(let i=0;i<width*height;i++)if(forward[i*4+3]>=90)assert.ok(visited.has(i),'foot is attached to torso');
 }
});

test('the prebuilt animation sheet includes a complete cycle for both growth stages',()=>{
 const png=readFileSync('public/assets/sproutling-run.png');
 assert.equal(assets.run.frames,RUN_FRAME_COUNT);
 assert.equal(png.readUInt32BE(16),assets.run.width*RUN_FRAME_COUNT);
 assert.equal(png.readUInt32BE(20),assets.run.height*2);
});
