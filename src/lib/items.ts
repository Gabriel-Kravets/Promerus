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

/**
 * Sprite art for shop pieces: width in scene pixels, anchored bottom-centre
 * offsetY pixels below the footprint centre so the legs sit on the footprint.
 */
export const itemSprites:Partial<Record<ItemType,{src:string;width:number;offsetY:number}>>={
  'botanical-desk':{src:'/assets/items/botanical-desk.png',width:180,offsetY:56},
  lantern:{src:'/assets/items/brass-lantern.png',width:40,offsetY:13},
  armchair:{src:'/assets/items/lounge-chair.png',width:82,offsetY:25},
  stove:{src:'/assets/items/wood-stove.png',width:78,offsetY:27},
  telescope:{src:'/assets/items/brass-telescope.png',width:100,offsetY:30},
};

/** What clicking a placed piece offers, and which panel it opens. */
export const itemInteractions:Record<ItemType,{action:string;panel:string}>={
  desk:{action:'Begin Studying',panel:'learn'},
  'botanical-desk':{action:'Begin Studying',panel:'learn'},
  tree:{action:'View Garden Progress',panel:'garden'},
  carpet:{action:'View Garden Progress',panel:'garden'},
  lantern:{action:'Admire the Glow',panel:'plants'},
  armchair:{action:'Take a Rest',panel:'hearth'},
  stove:{action:'Warm Up',panel:'hearth'},
  telescope:{action:'Stargaze',panel:'observatory'},
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
