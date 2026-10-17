export const RUN_FRAME_COUNT=12;

/** A continuous, hip-anchored bend; never cut limbs away from the torso. */
export function connectedLegPixels(source:Uint8ClampedArray,width:number,height:number,frame:number,hipRatio:number,splitRatio:number,amplitude=.014){
 const stride=Math.sin((frame%RUN_FRAME_COUNT)/RUN_FRAME_COUNT*Math.PI*2);
 if(Math.abs(stride)<1e-8)return new Uint8ClampedArray(source);
 const result=new Uint8ClampedArray(source),hip=Math.floor(height*hipRatio);
 for(let x=0;x<width;x++){
  const side=Math.tanh((x-width*splitRatio)/(width*.08));
  for(let y=hip+1;y<height;y++){
   // Zero displacement and zero slope at the hips keep the join stationary.
   const t=Math.min(1,(y-hip)/(height*.18)),ease=t*t*(3-2*t);
   const sy=y+stride*side*height*amplitude*ease;
   const y0=Math.floor(sy),blend=sy-y0,to=(y*width+x)*4;
   const a=y0>=0&&y0<height?(y0*width+x)*4:-1;
   const b=y0+1>=0&&y0+1<height?((y0+1)*width+x)*4:-1;
   const alphaA=a<0?0:source[a+3],alphaB=b<0?0:source[b+3];
   const alpha=alphaA*(1-blend)+alphaB*blend;
   // Interpolate premultiplied colors so the outlines retain their opacity.
   for(let c=0;c<3;c++)result[to+c]=alpha?((a<0?0:source[a+c])*alphaA*(1-blend)+(b<0?0:source[b+c])*alphaB*blend)/alpha:0;
   result[to+3]=alpha;
  }
 }
 return result;
}
