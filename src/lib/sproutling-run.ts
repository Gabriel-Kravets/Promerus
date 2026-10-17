/** Bend the lower body continuously so a stride never separates the feet from it. */
export function sproutlingRunPixels(source:Uint8ClampedArray,width:number,height:number,frame:number,stage:number){
 const stride=[0,1,0,-1][frame%4];
 if(!stride)return new Uint8ClampedArray(source);
 const result=new Uint8ClampedArray(source.length),hip=Math.floor(height*.72);
 const split=width*(stage===0?.56:.44);
 for(let x=0;x<width;x++){
  // Blend between the legs instead of cutting the sprite into separate pieces.
  const side=Math.tanh((x-split)/(width*.045));
  const stretch=1+stride*side*.14;
  for(let y=0;y<height;y++){
   const sy=y<=hip?y:Math.round(hip+(y-hip)/stretch);
   if(sy<0||sy>=height)continue;
   const from=(sy*width+x)*4,to=(y*width+x)*4;
   result.set(source.subarray(from,from+4),to);
  }
 }
 return result;
}
