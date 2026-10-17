import {hairPixel,isFacePixel,isHairPixel,isHairAccessoryPixel} from './avatar-hair';
export type Palette={skin:number[];hair:number[];outfit:number[]};
/** Shared by full sprites, stride frames, portraits and customization previews. */
export function avatarPixel(column:number,reading:boolean,x:number,y:number,source:number[],palette:Palette):number[]{
  const [r,g,b]=source,l=(r+g+b)/3;
  if(isHairAccessoryPixel(column,reading,x,y))return source;
  const face=isFacePixel(column,reading,x,y);
  const warm=r>g*1.08&&g>b*1.04;
  // Preserve dark eye/outline pixels and the gold eyeglass frames.
  const glasses=column===1&&g/r>.68&&b/g<.67;
  if(face){
    if(l>35&&warm&&!glasses){const shade=Math.max(.25,Math.min(1.5,l/145));return palette.skin.map(c=>Math.round(Math.min(255,c*shade)));}
    return source;
  }
  const hairSource=column!==2||(r>g*1.03&&g>b*1.08); // Blonde locks, excluding purple hat and clothing.
  if(isHairPixel(column,reading,x,y)&&hairSource&&!(column===1&&r>g*1.15&&g>b*1.15))return hairPixel(source,palette.hair,column);
  if(l<32)return source;
  const isSkin=r>g*1.12&&g>b*1.12&&r>145;
  const height=reading?486:538,normalized=y/height;
  // Never use height alone to identify hair or facial skin.
  if(normalized>.51&&normalized<.79&&!isSkin&&Math.max(r,g,b)-Math.min(r,g,b)>12){
    const shade=Math.max(.22,Math.min(1.45,l/130));return source.map((c,i)=>Math.round(c*.2+Math.min(255,palette.outfit[i]*shade)*.8));
  }
  return source;
}
