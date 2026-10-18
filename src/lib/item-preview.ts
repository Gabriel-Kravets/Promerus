import {Container,Graphics,Sprite,type Texture} from 'pixi.js';
import {getItemDefinition,itemSprites,type InventoryItem,type ItemType} from './items';

// The canvas loads shop sprites once and registers them before drawing items.
const spriteTextures=new Map<ItemType,Texture>();
export const registerItemTextures=(textures:ReadonlyMap<ItemType,Texture>)=>textures.forEach((texture,type)=>spriteTextures.set(type,texture));

/** Shared art keeps an item's own theme when a ghost becomes permanent. */
export function createItemArt(item:InventoryItem,temporary=false):Container {
  const root=new Container();root.eventMode='none';root.alpha=temporary?.72:1;root.scale.x=item.mirrored?-1:1;
  const g=new Graphics();root.addChild(g);
  const classic=item.theme==='Classic';
  const wood=classic?0x65504a:0xad7445,top=classic?0xa88d73:0xdfb77c;
  const leaf=classic?0x668883:0x85ad58,leafLight=classic?0x93b3a7:0xb8cf75;
  const ink=classic?0xd6e4dd:0xffebba;
  const {width,height}=getItemDefinition(item.type,item.theme).dimensions;
  // Project the centered grid footprint with the room's 36 x 18 iso basis.
  const corners=[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]];
  const footprint=corners.flatMap(([x,y])=>[(x-y)*36,(x+y)*18]);
  if(temporary&&item.type!=='tree')g.poly(footprint).fill({color:ink,alpha:.12}).stroke({color:ink,width:1.5,alpha:.8});
  const art=itemSprites[item.type],texture=spriteTextures.get(item.type);
  if(art&&texture){
    const sprite=new Sprite(texture);sprite.anchor.set(.5,1);sprite.width=art.width;sprite.height=art.width*texture.height/texture.width;sprite.y=art.offsetY;
    root.addChild(sprite);return root;
  }
  if(art){g.poly(footprint.map((v,i)=>v-(i%2?24:0))).fill(top).stroke({color:wood,width:3});return root;}
  if(item.type==='carpet'){
    g.poly(footprint).fill(classic?0x525765:0x74945d).stroke({color:top,width:3});
    g.poly(footprint.map(v=>v*.8)).stroke({color:ink,width:2});
    g.poly([0,-12,24,0,0,12,-24,0]).fill(top);
  }else if(item.type==='desk'){
    for(const [x,y] of corners){const px=(x-y)*36*.8,py=(x+y)*18*.8;
      g.moveTo(px,py-36).lineTo(px,py).stroke({color:wood,width:7});}
    g.poly(footprint.map((v,i)=>v-(i%2?36:0))).fill(top).stroke({color:wood,width:3});
    g.poly([-9,-38,9,-47,24,-40,6,-31]).fill(classic?0xd2d5cf:0xf5e7bc);
    g.moveTo(6,-32).lineTo(6,-41).stroke({color:wood,width:1});
  }else{
    g.ellipse(0,0,22,10).fill(wood);
    g.poly([-22,-26,22,-26,15,0,-15,0]).fill(classic?0x849397:0xb87950).stroke({color:wood,width:2});
    g.ellipse(0,-26,22,8).fill(top);
    g.moveTo(0,-27).lineTo(0,-91).moveTo(0,-57).lineTo(-24,-78).moveTo(0,-70).lineTo(21,-99).stroke({color:wood,width:7});
    g.circle(-23,-85,26).circle(24,-101,25).circle(-1,-120,29).fill(leaf);
    g.circle(-10,-124,18).circle(30,-106,16).fill(leafLight);
  }
  return root;
}

export const createItemPreview=(item:InventoryItem)=>createItemArt(item,true);
