import {itemSprites,type ItemType} from './items.ts';

export type ShopCategory='Furniture'|'Lighting'|'Curios';
export type ShopEntry={type:ItemType;category:ShopCategory;price:number;description:string;image:string};

/** Draft gold prices; purchases are free previews until a real wallet exists. */
export const shopCatalog:ShopEntry[]=([
  {type:'botanical-desk',category:'Furniture',price:180,description:'A rustic writing desk with a lantern, tea tray and trailing ivy.'},
  {type:'armchair',category:'Furniture',price:140,description:'A cozy teal lounge chair with a leaf-stitched cushion.'},
  {type:'stove',category:'Furniture',price:160,description:'A little cast-iron stove with a bronze kettle on top.'},
  {type:'lantern',category:'Lighting',price:60,description:'A brass lantern with leafy cutouts and a warm candle.'},
  {type:'telescope',category:'Curios',price:200,description:'A brass telescope on an oak tripod, pointed at the stars.'},
] as const).map(entry=>({...entry,image:itemSprites[entry.type]!.src}));

export const shopCategories:ShopCategory[]=['Furniture','Lighting','Curios'];
