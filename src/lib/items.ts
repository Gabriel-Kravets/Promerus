import type {Theme} from './theme.ts';

export type ItemType='desk'|'tree'|'carpet'|'botanical-desk'|'lantern'|'armchair'|'stove'|'telescope';
export type ItemLayer='floor'|'furniture';

export type ItemDefinition={
  type:ItemType;
  name:string;
  theme:Theme;
  /** Footprint in unprojected room grid units, not sprite pixels. */
  dimensions:{width:number;height:number};
  layer:ItemLayer;
  /** Layer priority; within-layer depth sorting is added with placement. */
  zIndex:number;
  solid:boolean;
};

/** Each copy has its own identity, even when its type and theme match. */
export type InventoryItem={
  id:string;
  type:ItemType;
  theme:Theme;
  /** Stable participant identity for a desk granted by room membership. */
  grantedTo?:string;
  /** Horizontal sprite reflection, retained when returned to Collection. */
  mirrored?:boolean;
};

const footprints={
  desk:{dimensions:{width:2,height:1.5},layer:'furniture',zIndex:1,solid:true},
  tree:{dimensions:{width:2,height:2},layer:'furniture',zIndex:1,solid:true},
  carpet:{dimensions:{width:4,height:3},layer:'floor',zIndex:0,solid:false},
  'botanical-desk':{dimensions:{width:2.7,height:1.6},layer:'furniture',zIndex:1,solid:true},
  lantern:{dimensions:{width:.6,height:.6},layer:'furniture',zIndex:1,solid:true},
  armchair:{dimensions:{width:1.3,height:1.3},layer:'furniture',zIndex:1,solid:true},
  stove:{dimensions:{width:1.2,height:1.2},layer:'furniture',zIndex:1,solid:true},
  telescope:{dimensions:{width:1.3,height:1.3},layer:'furniture',zIndex:1,solid:true},
} as const;

/** Shop pieces share one sprite across themes. */
const shopNames={'botanical-desk':'Botanical writing desk',lantern:'Brass lantern',armchair:'Teal lounge chair',stove:'Cast-iron wood stove',telescope:'Brass telescope'} as const;

/** The study desk is the upper-left atlas cell, including its reading stool. */
const studyDeskScale=1.05*.9;
export const studyDeskSprite={src:'/assets/study-and-companions.webp',width:178*studyDeskScale,scale:studyDeskScale,offsetY:36,frameWidth:701,frameHeight:561} as const;

/**
 * Sprite art for shop pieces: width in scene pixels, anchored bottom-centre
 * offsetY pixels below the footprint centre so the legs sit on the footprint.
 * front outlines, in texture pixels, the art drawn over a seated avatar.
 * footprint is where the piece meets the floor (legs, feet, base), traced from the
 * art in scene pixels around the footprint centre; collisions use it, not the canopy.
 */
export const itemSprites:Partial<Record<ItemType,{src:string;width:number;offsetY:number;front?:readonly number[];footprint?:readonly number[]}>>={
  'botanical-desk':{src:'/assets/items/botanical-desk.png',width:180*.85*.8,offsetY:56,footprint:[-56,23,-17,1,50,33,13,59]},
  lantern:{src:'/assets/items/brass-lantern.png',width:40,offsetY:13,footprint:[-20,6,-4,-1,13,6,-4,14]},
  armchair:{src:'/assets/items/lounge-chair.png',width:82*1.15*1.15,offsetY:25,
    front:[91,143,99,134,112,131,128,127,150,114,168,103,186,100,190,100,190,175,160,195,128,221,91,221],footprint:[-46,2,-8,-21,45,2,6,25]},
  stove:{src:'/assets/items/wood-stove.png',width:78*1.15*1.05,offsetY:27,footprint:[-46,9,-2,-9,47,9,3,28]},
  telescope:{src:'/assets/items/brass-telescope.png',width:100,offsetY:30,footprint:[-19,23,5,11,27,27,22,33,-15,30]},
};

/** Where the wood-stove pipe's elbow opens, in item-local pixels (art is 180 x 280, mouth at 174,18). */
const stoveScale=itemSprites.stove!.width/180;
export const stovePipeMouth={x:(174-90)*stoveScale,y:itemSprites.stove!.offsetY-(280-18)*stoveScale} as const;

/** What clicking a placed piece offers, and which panel it opens. Pieces without an entry are decorative. */
export const itemInteractions:Partial<Record<ItemType,{action:string;panel:string}>>={
  desk:{action:'Begin Studying',panel:'learn'},
  'botanical-desk':{action:'Begin Studying',panel:'learn'},
  armchair:{action:'Take a Rest',panel:'hearth'},
};

const names:Record<Theme,Record<ItemType,string>>={
  Classic:{desk:'Walnut study desk',tree:'Potted indoor tree',carpet:'Woven charcoal carpet',...shopNames},
  Stardew:{desk:'Rustic oak desk',tree:'Potted woodland tree',carpet:'Moss woven carpet',...shopNames},
};

export function getItemDefinition(type:ItemType,theme:Theme):ItemDefinition {
  const definition=footprints[type];
  return {type,name:names[theme][type],theme,...definition,dimensions:{...definition.dimensions}};
}

export const isItemType=(value:unknown):value is ItemType=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(footprints,value);
export const isItemTheme=(value:unknown):value is Theme=>value==='Classic'||value==='Stardew';
