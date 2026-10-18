import type {InventoryItem} from './items.ts';
import {deskFootprint,deskPlacementFootprint,iso,type Point} from './movement.ts';
import {studyStations,treeCenter} from './world-layout.ts';
import {gardenFootprint,type Shape} from './world-geometry.ts';

export type FixturePositions=Record<string,Point&{mirrored?:boolean}>;
export const roomFixtures=[
  ...studyStations.map(station=>({id:`fixture:${station.id}`,type:'desk' as const,name:station.label,position:station.position})),
  {id:'fixture:garden',type:'tree' as const,name:'Shared garden',position:treeCenter},
];
export const roomFixture=(id:string)=>roomFixtures.find(fixture=>fixture.id===id);
export const fixtureItem=(id:string,theme:InventoryItem['theme'],mirrored=false):InventoryItem|undefined=>{
  const fixture=roomFixture(id);return fixture?{id,type:fixture.type,theme,...(mirrored?{mirrored:true}:{})}:undefined;
};
export function translateShape(shape:Shape,dx:number,dy:number):Shape {
  return shape.kind==='ellipse'?{...shape,x:shape.x+dx,y:shape.y+dy}:{kind:'polygon',points:shape.points.map((v,i)=>v+(i%2?dy:dx))};
}
/** Atlas column 0 draws the stool on the right; column 1 and mirrored desks swap sides. */
export const deskChairSide=(id:string,mirrored=false):1|-1=>{
  const station=studyStations.find(station=>`fixture:${station.id}`===id);
  return ((station?.atlasColumn??0)===0)!==mirrored?1:-1;
};
export function fixtureShape(id:string,position:Point&{mirrored?:boolean},navigation=false,mirrored=!!position.mirrored):Shape {
  if(id!=='fixture:garden')return navigation?deskFootprint(position):deskPlacementFootprint(position,deskChairSide(id,mirrored));
  const origin=iso(treeCenter.x,treeCenter.y),at=iso(position.x,position.y);
  return translateShape(gardenFootprint,at.x-origin.x,at.y-origin.y);
}
export const fixtureObstacles=(positions:FixturePositions={},exclude?:string,stored:readonly string[]=[],navigation=false)=>roomFixtures.filter(f=>f.id!==exclude&&!stored.includes(f.id)).map(f=>fixtureShape(f.id,positions[f.id]??f.position,navigation));
