import type {Avatar} from '@/store/game';
const imageCache=new Map<string,Promise<HTMLImageElement>>();
export function loadImage(url:string){if(!imageCache.has(url))imageCache.set(url,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;}));return imageCache.get(url)!;}
export const avatarColumn=(a:Avatar)=>a.accessory==='Hat'?2:a.accessory==='Glasses'?1:a.accessory==='Ribbon'?3:([0,2,1,0,3,2][a.style]??0);
const avatarCache=new Map<string,Promise<string>>();
// Palette adaptation is performed at render time; authored atlas files remain unchanged.
export function avatarAsset(a:Avatar,reading=false):Promise<string>{
 const key=JSON.stringify([a,reading]);if(avatarCache.has(key))return avatarCache.get(key)!;
 const result=loadImage('/assets/gardeners.png').then(img=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;
  const w=img.width/4,split=Math.round(img.height*.525),h=reading?img.height-split:split;canvas.width=w;canvas.height=h;
  ctx.drawImage(img,avatarColumn(a)*w,reading?split:0,w,h,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h),data=pixels.data;
  const rgb=(hex:string)=>[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16));const outfit=rgb(a.outfit),hair=rgb(a.hair),skin=rgb(a.skin);
  for(let i=0;i<data.length;i+=4){if(data[i+3]<80)continue;const y=Math.floor(i/4/w)/h,x=(i/4%w)/w;const [r,g,b]=[data[i],data[i+1],data[i+2]];const l=(r+g+b)/3;if(l<32)continue;
   const isSkin=r>g*1.12&&g>b*1.12&&r>145;
   let target:number[]|undefined;
   if(isSkin&&y>.27&&y<.53)target=skin;
   else if(y<.29&&a.accessory!=='Hat'&&x>.12&&x<.9)target=hair;
   else if(y>.51&&y<.79&&!isSkin&&Math.max(r,g,b)-Math.min(r,g,b)>12)target=outfit;
   if(target){const shade=Math.max(.22,Math.min(1.45,l/130));for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*.2+Math.min(255,target[c]*shade)*.8);}
  }
  ctx.putImageData(pixels,0,0);
  // Four compatible costume trims retain the atlas silhouette and its shading.
  if(a.cut>0){ctx.globalAlpha=.7;ctx.fillStyle=a.cut===1?'#d8c5a0':a.cut===2?'#819c73':'#d0ad70';const x=w*.4,y=h*(reading?.69:.65);ctx.fillRect(x,y,w*.16,Math.max(2,h*.007));if(a.cut===2)ctx.fillRect(x,y+h*.03,w*.16,Math.max(2,h*.007));}
  return canvas.toDataURL('image/png');
 });avatarCache.set(key,result);return result;
}

const headCache=new Map<string,Promise<string>>();
/** Head-only view of the customized standing sprite; original atlas stays intact. */
export function avatarHeadAsset(avatar:Avatar):Promise<string>{
 const key=JSON.stringify(avatar);if(headCache.has(key))return headCache.get(key)!;
 const result=avatarAsset(avatar).then(loadImage).then(img=>{const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  const height=img.height*.54,width=img.width*.92,x=img.width*.04,scale=Math.min(96/width,96/height);
  ctx.drawImage(img,x,0,width,height,(96-width*scale)/2,(96-height*scale)/2,width*scale,height*scale);return canvas.toDataURL('image/png');
 });headCache.set(key,result);return result;
}
