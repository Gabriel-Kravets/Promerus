/** A soft, narrow edge around the same opaque pixels used for pointer hits. */
export function spriteHoverPixels(source:Uint8ClampedArray,width:number,height:number,radius=2.5){
 const pixels=new Uint8ClampedArray(source.length),reach=Math.ceil(radius+.5);
 let left=width,top=height,right=0,bottom=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4,solid=source[at+3]>90;
  let opacity=solid?12:0;
  if(solid){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  else{
   let nearest=Infinity;
   for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&nx<width&&ny>=0&&ny<height&&source[(ny*width+nx)*4+3]>90)nearest=Math.min(nearest,Math.hypot(dx,dy));
   }
   opacity=180*Math.max(0,Math.min(1,radius+.5-nearest));
  }
  pixels.set([201,230,191,opacity],at);
 }
 return {pixels,bounds:{left,top,right,bottom}};
}

/** Treat transparent pockets enclosed by artwork as solid, so only the outer silhouette is outlined. */
export function fillEnclosedGaps(source:Uint8ClampedArray,width:number,height:number){
 const filled=new Uint8ClampedArray(source),outside=new Uint8Array(width*height),stack:number[]=[];
 const visit=(x:number,y:number)=>{const at=y*width+x;if(!outside[at]&&source[at*4+3]<=90){outside[at]=1;stack.push(at);}};
 for(let x=0;x<width;x++){visit(x,0);visit(x,height-1);}
 for(let y=0;y<height;y++){visit(0,y);visit(width-1,y);}
 while(stack.length){const at=stack.pop()!,x=at%width,y=(at-x)/width;if(x>0)visit(x-1,y);if(x<width-1)visit(x+1,y);if(y>0)visit(x,y-1);if(y<height-1)visit(x,y+1);}
 for(let at=0;at<outside.length;at++)if(!outside[at])filled[at*4+3]=Math.max(filled[at*4+3],255);
 return filled;
}
