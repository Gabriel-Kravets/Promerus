import type {Theme} from './theme.ts';
import {isItemTheme,isItemType,type InventoryItem} from './items.ts';
import {resolvePlacements,validatePlacement,type ItemPlacement} from './placement.ts';
import type {Point} from './movement.ts';
import {fixtureItem,roomFixtures,type FixturePositions} from './room-fixtures.ts';
export type RoomInventory={initialized:boolean;theme:Theme;items:InventoryItem[];tutorialSeen:boolean;placements:ItemPlacement[];fixturePositions?:FixturePositions;storedFixtures?:string[]};
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
    items.push({id:item.id,type:item.type,theme:item.theme,...(typeof item.grantedTo==='string'?{grantedTo:item.grantedTo}:{}),...(typeof item.mirrored==='boolean'?{mirrored:item.mirrored}:{})});
  }
  if(!items.some(item=>item.id==='starter:tree'&&item.type==='tree'))return null;
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
