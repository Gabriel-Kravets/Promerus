import {create} from 'zustand';
import {persist,createJSONStorage} from 'zustand/middleware';
import type {Theme} from './game';
import {isItemTheme,isItemType,type InventoryItem,type ItemType} from '../lib/items';
import {resolvePlacements,validatePlacement,type ItemPlacement,type PlacementCheck} from '../lib/placement';
import type {Point} from '../lib/movement';
import type {Shape} from '../lib/world-geometry';
import {fixtureItem,roomFixture,roomFixtures,type FixturePositions} from '../lib/room-fixtures';

export type RoomInventory={initialized:boolean;theme:Theme;items:InventoryItem[];tutorialSeen:boolean;placements:ItemPlacement[];fixturePositions?:FixturePositions;storedFixtures?:string[]};
type InventoryState=RoomInventory&{
  /** A count uses member-0..member-(N-1); live rooms should supply stable IDs. */
  initializeRoom:(people:number|readonly string[],theme:Theme)=>void;
  personJoined:(memberId:string)=>void;
  setTheme:(theme:Theme)=>void;
  markTutorialSeen:()=>void;
  placeItem:(itemId:string,position:Point,extraObstacles?:readonly Shape[],mirrored?:boolean)=>PlacementCheck;
  moveItem:(itemId:string,position:Point,extraObstacles?:readonly Shape[],mirrored?:boolean)=>PlacementCheck;
  moveFixture:(itemId:string,position:Point,extraObstacles?:readonly Shape[],mirrored?:boolean)=>PlacementCheck;
  returnItem:(itemId:string)=>void;
  /** Adds a new copy to the room's shared Collection; every member can place it. */
  buyItem:(type:ItemType)=>InventoryItem|null;
  reset:()=>void;
};

/** Rooms used to start with a potted tree; the shared garden fixture replaced it. */
const RETIRED_STARTER_TREE='starter:tree';
const emptyInventory=():RoomInventory=>({initialized:false,theme:'Stardew',items:[],tutorialSeen:false,placements:[],fixturePositions:undefined,storedFixtures:undefined});
const orient=(items:InventoryItem[],id:string,mirrored:boolean)=>items.some(item=>item.id===id&&!!item.mirrored!==mirrored)
  ?items.map(item=>item.id===id?{...item,mirrored}:item):items;

function participantIds(people:number|readonly string[]):string[] {
  if(typeof people==='number'){
    if(!Number.isSafeInteger(people)||people<0)throw new RangeError('Room population must be a non-negative integer.');
    return Array.from({length:people},(_,index)=>`member-${index}`);
  }
  if(people.some(id=>typeof id!=='string'||!id.trim()))throw new TypeError('Participants need non-empty stable IDs.');
  return [...new Set(people)];
}

function addDesks(items:InventoryItem[],members:readonly string[],theme:Theme):InventoryItem[] {
  const granted=new Set(items.filter(item=>item.type==='desk').map(item=>item.grantedTo));
  const additions=members.filter(id=>!granted.has(id)).map((id):InventoryItem=>({
    id:`desk:member:${id}`,type:'desk',theme,grantedTo:id,
  }));
  return additions.length?[...items,...additions]:items;
}

/** Saved data never replaces store actions or trusts saved dimensions/layer rules. */
export function readRoomInventory(value:unknown):RoomInventory|null {
  if(!value||typeof value!=='object')return null;
  const saved=value as Record<string,unknown>;
  if(saved.initialized!==true||!isItemTheme(saved.theme)||!Array.isArray(saved.items))return null;
  if(saved.tutorialSeen!==undefined&&typeof saved.tutorialSeen!=='boolean')return null;
  const items:InventoryItem[]=[],ids=new Set<string>(),members=new Set<string>();
  for(const raw of saved.items){
    if(!raw||typeof raw!=='object')return null;
    const item=raw as Record<string,unknown>;
    if(typeof item.id!=='string'||!item.id.trim()||ids.has(item.id)||!isItemType(item.type)||!isItemTheme(item.theme))return null;
    if(item.grantedTo!==undefined){
      if(item.type!=='desk'||typeof item.grantedTo!=='string'||!item.grantedTo.trim()||members.has(item.grantedTo))return null;
      members.add(item.grantedTo);
    }
    ids.add(item.id);
    // The retired starter potted tree is dropped, along with any placement of it.
    if(item.id===RETIRED_STARTER_TREE)continue;
    items.push({id:item.id,type:item.type,theme:item.theme,...(typeof item.grantedTo==='string'?{grantedTo:item.grantedTo}:{}),...(typeof item.mirrored==='boolean'?{mirrored:item.mirrored}:{})});
  }
  const fixtures:FixturePositions={};
  const savedStored=Array.isArray(saved.storedFixtures)?saved.storedFixtures:[];
  const storedFixtures=roomFixtures.filter(f=>savedStored.includes(f.id)).map(f=>f.id);
  if(saved.fixturePositions&&typeof saved.fixturePositions==='object')for(const fixture of roomFixtures){
    const p=(saved.fixturePositions as Record<string,Partial<Point>&{mirrored?:unknown}>)[fixture.id];
    if(p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y))fixtures[fixture.id]={x:p.x,y:p.y,...(p.mirrored===true?{mirrored:true}:{})};
  }
  // Rejecting one override restores its original obstacle, so recheck the rest
  // until every saved position is also clear of those restored fixtures.
  let removed=true;
  while(removed){
    removed=false;
    for(const fixture of roomFixtures)if(fixtures[fixture.id]&&!storedFixtures.includes(fixture.id)&&!validatePlacement(fixtureItem(fixture.id,saved.theme,fixtures[fixture.id].mirrored)!,fixtures[fixture.id],[],[],fixtures,storedFixtures).valid){delete fixtures[fixture.id];removed=true;}
  }
  // Older saves have no placements. Invalid coordinates never discard owned items.
  const placements:ItemPlacement[]=[];
  if(Array.isArray(saved.placements))for(const raw of saved.placements){
    if(!raw||typeof raw!=='object')continue;
    const candidate=raw as Record<string,unknown>,position=candidate.position as Partial<Point>|undefined;
    const item=items.find(item=>item.id===candidate.itemId);
    if(!item||!position||typeof position.x!=='number'||typeof position.y!=='number'||placements.some(p=>p.itemId===item.id))continue;
    const point={x:position.x,y:position.y};
    if(validatePlacement(item,point,resolvePlacements(items,placements),[],fixtures,storedFixtures).valid)placements.push({itemId:item.id,position:point});
  }
  // Step 1 saves predate the tutorial flag and should receive the introduction.
  return {initialized:true,theme:saved.theme,items,tutorialSeen:saved.tutorialSeen===true,placements,...(saved.fixturePositions?{fixturePositions:fixtures}:{}),...(saved.storedFixtures?{storedFixtures}:{})};
}

export const useInventory=create<InventoryState>()(persist<InventoryState,[],[],RoomInventory>((set,get)=>({
  ...emptyInventory(),
  initializeRoom:(people,theme)=>{
    const members=participantIds(people);
    if(!isItemTheme(theme))throw new TypeError('Unknown room theme.');
    set(state=>{
      const items=addDesks(state.initialized?state.items:[],members,theme);
      if(state.initialized&&state.theme===theme&&items===state.items)return state;
      return {initialized:true,theme,items};
    });
  },
  personJoined:memberId=>{
    const members=participantIds([memberId]);
    set(state=>{
      if(!state.initialized)throw new Error('Initialize the room before handling joins.');
      const items=addDesks(state.items,members,state.theme);
      return items===state.items?state:{items};
    });
  },
  // Existing pieces retain their style; new grants use the current room theme.
  setTheme:theme=>{
    if(!isItemTheme(theme))throw new TypeError('Unknown room theme.');
    set(state=>state.theme===theme?state:{theme});
  },
  markTutorialSeen:()=>set(state=>state.initialized&&!state.tutorialSeen?{tutorialSeen:true}:state),
  placeItem:(itemId,position,extraObstacles=[],mirrored)=>{
    const state=get(),item=state.initialized?state.items.find(item=>item.id===itemId):undefined;
    if(!item||state.placements.some(p=>p.itemId===itemId))return {valid:false,reason:'unavailable',message:'This item is already placed or no longer available.'};
    const reflected=mirrored??!!item.mirrored;
    const result=validatePlacement({...item,mirrored:reflected},position,resolvePlacements(state.items,state.placements),extraObstacles,state.fixturePositions,state.storedFixtures);
    if(result.valid)set({items:orient(state.items,itemId,reflected),placements:[...state.placements,{itemId,position:{...position}}]});
    return result;
  },
  returnItem:itemId=>set(state=>{
    if(!state.initialized)return state;
    if(roomFixture(itemId))return state.storedFixtures?.includes(itemId)?state:{storedFixtures:[...state.storedFixtures??[],itemId]};
    return state.placements.some(p=>p.itemId===itemId)?{placements:state.placements.filter(p=>p.itemId!==itemId)}:state;
  }),
  moveItem:(itemId,position,extraObstacles=[],mirrored)=>{
    const state=get(),item=state.initialized?state.items.find(item=>item.id===itemId):undefined;
    if(!item||!state.placements.some(p=>p.itemId===itemId))return {valid:false,reason:'unavailable',message:'This item is no longer in the room.'};
    const others=state.placements.filter(p=>p.itemId!==itemId);
    const reflected=mirrored??!!item.mirrored;
    const result=validatePlacement({...item,mirrored:reflected},position,resolvePlacements(state.items,others),extraObstacles,state.fixturePositions,state.storedFixtures);
    if(result.valid)set({items:orient(state.items,itemId,reflected),placements:state.placements.map(p=>p.itemId===itemId?{itemId,position:{...position}}:p)});
    return result;
  },
  moveFixture:(itemId,position,extraObstacles=[],mirrored)=>{
    const state=get(),reflected=mirrored??!!state.fixturePositions?.[itemId]?.mirrored;
    // Validate the footprint the player sees, including a temporary flip.
    const item=fixtureItem(itemId,state.theme,reflected);
    if(!state.initialized||!item)return {valid:false,reason:'unavailable',message:'This room item is unavailable.'};
    const result=validatePlacement(item,position,resolvePlacements(state.items,state.placements),extraObstacles,state.fixturePositions,state.storedFixtures);
    if(result.valid)set({fixturePositions:{...state.fixturePositions,[itemId]:{x:position.x,y:position.y,...(reflected?{mirrored:true}:{})}},...(state.storedFixtures?.includes(itemId)?{storedFixtures:state.storedFixtures.filter(id=>id!==itemId)}:{})});
    return result;
  },
  buyItem:type=>{
    const state=get();
    if(!state.initialized||!isItemType(type))return null;
    let n=state.items.filter(item=>item.type===type).length+1;
    while(state.items.some(item=>item.id===`shop:${type}:${n}`))n++;
    const item:InventoryItem={id:`shop:${type}:${n}`,type,theme:state.theme};
    set({items:[...state.items,item]});return item;
  },
  reset:()=>set(emptyInventory()),
}),{
  name:'sproutbound-inventory-v1',
  version:1,
  skipHydration:true,
  storage:createJSONStorage(()=>({
    getItem:key=>{try{return localStorage.getItem(key);}catch{return null;}},
    setItem:(key,value)=>{try{localStorage.setItem(key,value);}catch{}},
    removeItem:key=>{try{localStorage.removeItem(key);}catch{}},
  })),
  partialize:({initialized,theme,items,tutorialSeen,placements,fixturePositions,storedFixtures})=>({initialized,theme,items,tutorialSeen,placements,...(fixturePositions?{fixturePositions}:{}),...(storedFixtures?{storedFixtures}:{})}),
  merge:(saved,current)=>({...current,fixturePositions:undefined,storedFixtures:undefined,...(readRoomInventory(saved)??emptyInventory())}),
}));
