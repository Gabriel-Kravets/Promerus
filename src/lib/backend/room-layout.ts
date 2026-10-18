import {z} from 'zod';
import {readRoomInventory} from '../room-inventory-data.ts';
import {getItemDefinition,type InventoryItem} from '../items.ts';
import {shopCatalog} from '../shop.ts';
import {fixtureItem,roomFixture,fixtureObstacles,type FixturePositions} from '../room-fixtures.ts';
import {validatePlacement,resolvePlacements,itemFootprint,permanentRoomObstacles,type ItemPlacement} from '../placement.ts';
import {iso,setMovementObstacles} from '../movement.ts';
import type {Point} from '../movement.ts';
import type {Shape} from '../world-geometry.ts';
export type RoomLayout={items:InventoryItem[];placements:ItemPlacement[];fixturePositions:FixturePositions;storedFixtures:string[]};
const point=z.object({x:z.number().finite().min(-2).max(16),y:z.number().finite().min(-2).max(16)}).strict();
export const layoutCommand=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('initialize')}).strict(),
 z.object({kind:z.literal('buy'),type:z.string().refine(type=>shopCatalog.some(item=>item.type===type)),theme:z.enum(['Classic','Stardew'])}).strict(),
 z.object({kind:z.literal('place'),id:z.string().min(1).max(160),position:point,mirrored:z.boolean()}).strict(),
 z.object({kind:z.literal('return'),id:z.string().min(1).max(160)}).strict()
]);
export function parseRoomLayout(raw:unknown,members:string[]):RoomLayout{
 const initial:RoomLayout={items:[{id:'starter:tree',type:'tree',theme:'Stardew'}],placements:[],fixturePositions:{},storedFixtures:[]};
 const saved=raw===null?initial:raw as RoomLayout;
 const parsed=readRoomInventory({...saved,initialized:true,theme:'Stardew',tutorialSeen:true});
 if(!parsed)throw new Error('Room layout is unavailable');
 const result:RoomLayout={items:parsed.items,placements:parsed.placements,fixturePositions:parsed.fixturePositions??{},storedFixtures:parsed.storedFixtures??[]};
 for(const member of members)if(!result.items.some(item=>item.type==='desk'&&item.grantedTo===member))result.items.push({id:`desk:member:${member}`,type:'desk',theme:'Stardew',grantedTo:member});
 return result;
}
export function applyLayoutCommand(raw:unknown,members:string[],input:unknown,occupied:Point[]=[]):RoomLayout{
 const command=layoutCommand.parse(input),state=parseRoomLayout(raw,members);
 if(command.kind==='initialize')return state;
 if(command.kind==='buy'){
  if(state.items.length>=200)throw new Error('Room collection is full');
  const type=command.type as InventoryItem['type'];let n=state.items.filter(item=>item.type===type).length+1;
  while(state.items.some(item=>item.id===`shop:${type}:${n}`))n++;
  state.items.push({id:`shop:${type}:${n}`,type,theme:command.theme});return state;
 }
 const fixture=roomFixture(command.id),owned=state.items.find(item=>item.id===command.id);
 if(!fixture&&!owned)throw new Error('Room item unavailable');
 if(command.kind==='return'){
  if(fixture){if(!state.storedFixtures.includes(command.id))state.storedFixtures.push(command.id);}
  else state.placements=state.placements.filter(p=>p.itemId!==command.id);
  return state;
 }
 const item=fixture?fixtureItem(command.id,'Stardew',command.mirrored)!:{...owned!,mirrored:command.mirrored};
 const others=resolvePlacements(state.items,state.placements.filter(p=>p.itemId!==command.id));
 const obstacles:Shape[]=occupied.map(position=>{const p=iso(position.x,position.y);return {kind:'ellipse',x:p.x,y:p.y,rx:12,ry:10};});
 const check=validatePlacement(item,command.position,others,obstacles,state.fixturePositions,state.storedFixtures);
 if(!check.valid)throw new Error(check.message);
 if(fixture){state.fixturePositions[command.id]={...command.position,mirrored:command.mirrored};state.storedFixtures=state.storedFixtures.filter(id=>id!==command.id);}
 else{state.items=state.items.map(i=>i.id===command.id?item:i);state.placements=[...state.placements.filter(p=>p.itemId!==command.id),{itemId:command.id,position:command.position}];}
 return state;
}
/** Synchronous scope: never leave one world's obstacles in a shared Edge worker. */
export function withRoomGeometry<T>(layout:RoomLayout,run:()=>T):T{
 const solids=resolvePlacements(layout.items,layout.placements).filter(p=>getItemDefinition(p.item.type,p.item.theme).solid).map(p=>itemFootprint(p.item,p.position));
 setMovementObstacles([...permanentRoomObstacles,...fixtureObstacles(layout.fixturePositions,undefined,layout.storedFixtures,true),...solids],true);
 try{return run();}finally{setMovementObstacles([],false);}
}
