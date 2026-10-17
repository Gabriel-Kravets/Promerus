// Run with npm run assets:generate after changing the source artwork or stride.
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const sharp=require('sharp');
const cache=new Map();
function sourceModule(file){
 const absolute=path.resolve(file);
 if(cache.has(absolute))return cache.get(absolute);
 const result={exports:{}};cache.set(absolute,result.exports);
 const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports','module',js)(id=>sourceModule(path.resolve(path.dirname(absolute),`${id}.ts`)),result.exports,result);
 return result.exports;
}
const {RUN_FRAME_COUNT}=sourceModule('src/lib/sprite-locomotion.ts');
const {sproutlingRunPixels}=sourceModule('src/lib/sproutling-run.ts');
const {spriteHoverPixels}=sourceModule('src/lib/sprite-hover.ts');

async function main(){
 const layers=[],width=192,height=154;
 for(let stage=0;stage<2;stage++){
  const data=await sharp('public/assets/study-and-companions.png').extract({left:stage*701,top:561,width:701,height:561}).ensureAlpha().raw().toBuffer();
  for(let frame=0;frame<RUN_FRAME_COUNT;frame++){
   const pixels=sproutlingRunPixels(new Uint8ClampedArray(data),701,561,frame,stage);
   layers.push({input:await sharp(Buffer.from(pixels),{raw:{width:701,height:561,channels:4}}).resize(width,height).png().toBuffer(),left:frame*width,top:stage*height});
  }
 }
 await sharp({create:{width:width*RUN_FRAME_COUNT,height:height*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile('public/assets/sproutling-run.png');
 const outlines=[],bounds=[];
 for(let col=0;col<2;col++){
  const data=await sharp('public/assets/study-and-companions.png').extract({left:col*701,top:0,width:701,height:561}).resize(356,285).extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
  const hover=spriteHoverPixels(new Uint8ClampedArray(data),364,293);bounds.push(hover.bounds);
  outlines.push({input:Buffer.from(hover.pixels),raw:{width:364,height:293,channels:4},left:col*364,top:0});
 }
 await sharp({create:{width:728,height:293,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(outlines).png().toFile('public/assets/desk-hover.png');
 fs.writeFileSync('src/lib/scene-assets.json',JSON.stringify({run:{width,height,frames:RUN_FRAME_COUNT},desk:{width:364,height:293,density:2,pad:4,bounds}},null,2)+'\n');
 for(const name of ['greenhouse-room','garden-stages','study-and-companions','gardeners','cozy-study-room']){
  await sharp(`public/assets/${name}.png`).webp({lossless:['gardeners','study-and-companions'].includes(name),quality:90,effort:6}).toFile(`public/assets/${name}.webp`);
 }
 console.log('Generated both running stages, desk highlights, and optimized WebP artwork.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
