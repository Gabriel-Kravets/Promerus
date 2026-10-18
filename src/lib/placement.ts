import {getItemDefinition,type InventoryItem} from './items.ts';
import {iso,type Point} from './movement.ts';
import {contains,fenceFootprint,gardenFootprint,type Shape} from './world-geometry.ts';
import {studyStations} from './world-layout.ts';
import {fixtureShape,fixtureObstacles,roomFixture,type FixturePositions} from './room-fixtures.ts';

export type ItemPlacement={itemId:string;position:Point};
export type PlacedItem={item:InventoryItem;position:Point};
export type PlacementCheck={valid:true}|{valid:false;reason:'outside'|'collision'|'unavailable'|'moving';message:string};
type Polygon={kind:'polygon';points:number[]};
/** Circumscribe ellipses so polygon collision checks retain their whole rim. */
export function ellipsePolygon(shape:Extract<Shape,{kind:'ellipse'}>):Polygon {
  const padding=1/Math.cos(Math.PI/32);
  return {kind:'polygon',points:Array.from({length:32},(_,i)=>{
    const angle=i*Math.PI/16;return [shape.x+Math.cos(angle)*shape.rx*padding,shape.y+Math.sin(angle)*shape.ry*padding];
  }).flat()};
}
const EPS=1e-7;
const vertices=(shape:Polygon):Point[]=>Array.from({length:shape.points.length/2},(_,i)=>({x:shape.points[i*2],y:shape.points[i*2+1]}));
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const lerp=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const onSegment=(p:Point,a:Point,b:Point)=>Math.abs(cross(sub(p,a),sub(b,a)))<=EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
const inside=(polygon:Polygon,p:Point)=>contains(polygon,p)||vertices(polygon).some((a,i,all)=>onSegment(p,a,all[(i+1)%all.length]));

function intersectionParameters(a:Point,b:Point,c:Point,d:Point):number[]{
  const r=sub(b,a),s=sub(d,c),denom=cross(r,s),offset=sub(c,a);
  if(Math.abs(denom)<=EPS){
    if(Math.abs(cross(offset,r))>EPS)return [];
    const length=r.x*r.x+r.y*r.y;if(length<=EPS)return [];
    return [c,d].filter(p=>onSegment(p,a,b)).map(p=>((p.x-a.x)*r.x+(p.y-a.y)*r.y)/length);
  }
  const t=cross(offset,s)/denom,u=cross(offset,r)/denom;
  return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?[Math.max(0,Math.min(1,t))]:[];
}

/** All edges must stay inside, including across concave corners of the floor. */
export function polygonInside(outer:Polygon,inner:Polygon):boolean {
  const a=vertices(inner),b=vertices(outer);
  return a.every((p,i)=>{
    if(!inside(outer,p))return false;
    const next=a[(i+1)%a.length],cuts=[0,1,...b.flatMap((q,j)=>intersectionParameters(p,next,q,b[(j+1)%b.length]))].sort((x,y)=>x-y);
    return cuts.slice(1).every((t,j)=>inside(outer,lerp(p,next,(cuts[j]+t)/2)));
  });
}

/** Exact polygon/ellipse checks catch thin edge crossings and complete enclosure. */
export function footprintIntersects(footprint:Polygon,shape:Shape):boolean {
  const a=vertices(footprint);
  if(shape.kind==='ellipse'){
    const normalized=a.map(p=>({x:(p.x-shape.x)/shape.rx,y:(p.y-shape.y)/shape.ry}));
    if(inside({kind:'polygon',points:normalized.flatMap(p=>[p.x,p.y])},{x:0,y:0}))return true;
    return normalized.some((p,i)=>{
      const q=normalized[(i+1)%normalized.length],v=sub(q,p),length=v.x*v.x+v.y*v.y;
      const t=length?Math.max(0,Math.min(1,-(p.x*v.x+p.y*v.y)/length)):0;
      const closest=lerp(p,q,t);return closest.x*closest.x+closest.y*closest.y<=1+EPS;
    });
  }
  const b=vertices(shape);
  return a.some(p=>inside(shape,p))||b.some(p=>inside(footprint,p))||a.some((p,i)=>b.some((q,j)=>intersectionParameters(p,a[(i+1)%a.length],q,b[(j+1)%b.length]).length>0));
}

export function itemFootprint(item:InventoryItem,position:Point):Polygon {
  if(roomFixture(item.id)){
    const shape=fixtureShape(item.id,position,false,!!item.mirrored);
    return shape.kind==='polygon'?shape:ellipsePolygon(shape);
  }
  if(item.type==='tree'){
    const center=iso(position.x,position.y);
    // Procedural potted-tree art has a 22 x 10 ground ellipse. Include its rim,
    // rather than blocking the room with the canopy's old 2 x 2 grid diamond.
    return ellipsePolygon({kind:'ellipse',...center,rx:26,ry:12});
  }
  const {width,height}=getItemDefinition(item.type,item.theme).dimensions;
  const scale=item.type==='desk'?1.1:1,down=item.type==='desk'?6:0;
  const center=iso(position.x,position.y);
  return {kind:'polygon',points:[[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([x,y])=>{
    const p=iso(position.x+x*width*scale/2,position.y+y*height*scale/2);
    return [center.x+(p.x-center.x)*(item.mirrored?-1:1),p.y+down];
  })};
}

// These are ground footprints in the original scene, not tall interaction silhouettes.
const builtInFurnitureFootprints:Shape[]=[
  {kind:'polygon',points:[535,225,595,208,642,227,641,252,577,281,545,269]}, // lantern table
  {kind:'polygon',points:[716,220,765,238,800,257,816,245,804,280,760,269,716,243]}, // bookshelf and ladder
  {kind:'polygon',points:[268,365,307,349,331,375,322,406,279,421,254,403]}, // armchair
  {kind:'polygon',points:[301,337,348,319,391,337,390,355,334,379,302,363]}, // side table
  {kind:'polygon',points:[1124,349,1165,364,1155,384,1120,368]}, // hearth
  {kind:'ellipse',x:1100,y:514,rx:35,ry:20}, // telescope base
];
// The walking floor stays conservative around the left-middle corner. For placement,
// follow the visible floorboards up to the drawer cabinet and armchair instead;
// their own footprints above still keep furniture off them.
export const placementFloorShape:Polygon={kind:'polygon',points:[660,240,1106,363,1140,389,1120,414,1024,462,672,584,512,568,248,448,279,425,324,409,334,381,390,357,395,305,487,265]};
// Reserve ten scene pixels in front of the railing for projecting feet and pots.
export const placementFenceFootprint:Shape={kind:'polygon',points:(fenceFootprint as Polygon).points.map((v,i)=>v-(i%2?10:0))};
export const fixedPlacementObstacles:Shape[]=[gardenFootprint,placementFenceFootprint,...studyStations.map(station=>fixtureShape(`fixture:${station.id}`,station.position)),...builtInFurnitureFootprints];
export const permanentRoomObstacles:Shape[]=[placementFenceFootprint,...builtInFurnitureFootprints];

export function withinRoom(item:InventoryItem,position:Point):boolean {
  // The authored rear desks straddle the irregular back-wall edge. Preserve
  // these original anchors when flipping or restoring a piece from Collection.
  const original=roomFixture(item.id)?.position;
  if(original&&position.x===original.x&&position.y===original.y)return true;
  return Number.isFinite(position.x)&&Number.isFinite(position.y)&&polygonInside(placementFloorShape,itemFootprint(item,position));
}

/** Keep the entire preview in the room, stopping at its boundary along the drag. */
export function constrainItemPosition(item:InventoryItem,requested:Point,previous:Point={x:8,y:8}):Point {
  if(withinRoom(item,requested))return {...requested};
  let safe=withinRoom(item,previous)?previous:{x:8,y:8};
  if(!withinRoom(item,safe)){
    // Fallback for future larger items, without assuming a rectangular floor.
    const candidates:Point[]=[];
    for(let x=-2;x<=16;x+=.5)for(let y=-2;y<=16;y+=.5)if(withinRoom(item,{x,y}))candidates.push({x,y});
    safe=candidates.sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y))[0]??safe;
  }
  if(!Number.isFinite(requested.x)||!Number.isFinite(requested.y))return {...safe};
  let low=0,high=1;
  for(let i=0;i<30;i++){const mid=(low+high)/2;if(withinRoom(item,lerp(safe,requested,mid)))low=mid;else high=mid;}
  return lerp(safe,requested,low);
}

export function resolvePlacements(items:readonly InventoryItem[],placements:readonly ItemPlacement[]):PlacedItem[]{
  return placements.flatMap(placement=>{const item=items.find(item=>item.id===placement.itemId);return item?[{item,position:placement.position}]:[];});
}

export function validatePlacement(item:InventoryItem,position:Point,placed:readonly PlacedItem[],extraObstacles:readonly Shape[]=[],fixtures:FixturePositions={},storedFixtures:readonly string[]=[]):PlacementCheck {
  if(!withinRoom(item,position))return {valid:false,reason:'outside',message:'Keep the whole item inside the greenhouse.'};
  const footprint=itemFootprint(item,position),definition=getItemDefinition(item.type,item.theme);
  // Carpets can go under furniture. Furniture never collides with a floor-layer carpet.
  const solids=[...permanentRoomObstacles,...fixtureObstacles(fixtures,item.id,storedFixtures),...placed.filter(p=>getItemDefinition(p.item.type,p.item.theme).solid).map(p=>itemFootprint(p.item,p.position))];
  if(definition.solid&&solids.some(shape=>footprintIntersects(footprint,shape)))return {valid:false,reason:'collision',message:'This spot overlaps solid furniture. Drag to a clear spot.'};
  if(definition.solid&&extraObstacles.some(shape=>footprintIntersects(footprint,shape)))return {valid:false,reason:'collision',message:'Leave space around gardeners and the Sproutling.'};
  // Baked-in room art cannot be sorted above rugs; keep their ground bases clear.
  // The separately rendered fixed desks can still overlap floor pieces.
  if(!definition.solid&&[...permanentRoomObstacles,...(storedFixtures.includes('fixture:garden')?[]:[fixtureShape('fixture:garden',fixtures['fixture:garden']??roomFixture('fixture:garden')!.position)])].some(shape=>footprintIntersects(footprint,shape)))return {valid:false,reason:'collision',message:'Keep the carpet clear of built-in fixtures and the garden bed.'};
  return {valid:true};
}

export function itemRenderOrder(item:InventoryItem,position:Point){
  const definition=getItemDefinition(item.type,item.theme);
  return {layer:definition.layer,depth:iso(position.x,position.y).y+definition.zIndex*.01};
}
