import {contains,fenceFootprint,floorShape,gardenFootprint,type Shape} from './world-geometry.ts';
import {desks} from './world-layout.ts';
export type Point={x:number;y:number};
export const iso=(x:number,y:number):Point=>({x:660+(x-y)*36,y:200+(x+y)*18});
export const uniso=(x:number,y:number):Point=>({x:((x-660)/36+(y-200)/18)/2,y:((y-200)/18-(x-660)/36)/2});
export const GRID_STEP=.5,AVATAR_RADIUS=7;
export const deskFootprint=(d:Point)=>({kind:'polygon' as const,points:[-64,-10,0,-32,64,-10,0,20].map((v,i)=>v+(i%2?iso(d.x,d.y).y:iso(d.x,d.y).x))});
/** Placement reserves extra space around desk feet while keeping walking aisles open. */
// The lobe on the chair side covers the stool's feet, which stand below the desk's diamond.
// chairSide is 1 when the stool is drawn to the right of the desk and -1 when it is on the left.
export const deskPlacementFootprint=(d:Point,chairSide:1|-1=1)=>({kind:'polygon' as const,points:[-70,-4,0,-28,70,-4,60,20,30,35,0,26].map((v,i)=>i%2?v+iso(d.x,d.y).y:v*chairSide+iso(d.x,d.y).x)});
const isolatedTiles=new Set<string>();
let placedObstacles:readonly Shape[]=[];
let replaceFixtures=false;
/** Rebuild navigation from the floor whenever permanent furniture changes. */
export function setMovementObstacles(obstacles:readonly Shape[],replaceRoomFixtures=false){
 placedObstacles=obstacles;replaceFixtures=replaceRoomFixtures;neighborCache.clear();
 // The original desk and garden tiles must become reachable after a move.
 tileKeys.clear();walkableTiles.length=0;
 for(const p of floorTiles)if(!blocked(p.x,p.y)){walkableTiles.push(p);tileKeys.add(key(p));}
}
export function blocked(x:number,y:number):boolean {
 if(!replaceFixtures&&isolatedTiles.has(`${x},${y}`))return true;
 const p=iso(x,y),obstacles=[fenceFootprint,...(replaceFixtures?[]:[gardenFootprint,...desks.map(deskFootprint)]),...placedObstacles];
 return [[0,0],...Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8)*(AVATAR_RADIUS+1),Math.sin(i*Math.PI/8)*(AVATAR_RADIUS+1)])].some(([dx,dy])=>{
  const q={x:p.x+dx,y:p.y+dy};return !contains(floorShape,q)||obstacles.some(shape=>contains(shape,q));
 });
}
export function clearSegment(a:Point,b:Point){
 const steps=Math.max(1,Math.ceil(distance(a,b)));
 for(let i=0;i<=steps;i++){const t=i/steps;if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}
 return true;
}
const key=(p:Point)=>`${p.x},${p.y}`;
const snap=(p:Point)=>({x:Math.round(p.x/GRID_STEP)*GRID_STEP,y:Math.round(p.y/GRID_STEP)*GRID_STEP});
export const walkableTiles:Point[]=[];
for(let x=-2;x<=16;x+=GRID_STEP)for(let y=-2;y<=16;y+=GRID_STEP)if(!blocked(x,y))walkableTiles.push({x,y});
const tileKeys=new Set(walkableTiles.map(key));
const floorTiles:Point[]=[];
for(let x=-2;x<=16;x+=GRID_STEP)for(let y=-2;y<=16;y+=GRID_STEP){
 const p=iso(x,y);if(contains(floorShape,p))floorTiles.push({x,y});
}
const neighborCache=new Map<string,Point[]>();
function neighbors(p:Point){const cached=neighborCache.get(key(p));if(cached)return cached;const result:Point[]=[];for(const [dx,dy] of [[.5,0],[-.5,0],[0,.5],[0,-.5],[.5,.5],[.5,-.5],[-.5,.5],[-.5,-.5]]){
 const n={x:p.x+dx,y:p.y+dy};if(!tileKeys.has(key(n))||blocked(n.x,n.y))continue;
 // Never cut the corner of a desk or the garden with a diagonal step.
 if(dx&&dy&&(!tileKeys.has(key({x:p.x+dx,y:p.y}))||!tileKeys.has(key({x:p.x,y:p.y+dy}))||blocked(p.x+dx,p.y)||blocked(p.x,p.y+dy)))continue;
 if(clearSegment(p,n))result.push(n);
 }neighborCache.set(key(p),result);return result;}
// Slivers behind solid furniture that cannot fit a connected passage are not destinations.
const floodStart=[...walkableTiles].sort((a,b)=>distance(a,{x:8,y:8})-distance(b,{x:8,y:8}))[0];
const connected=new Set<string>([key(floodStart)]),flood:Point[]=[floodStart];
while(flood.length){const p=flood.pop()!;for(const n of neighbors(p))if(!connected.has(key(n))){connected.add(key(n));flood.push(n);}}
for(let i=walkableTiles.length-1;i>=0;i--)if(!connected.has(key(walkableTiles[i]))){isolatedTiles.add(key(walkableTiles[i]));tileKeys.delete(key(walkableTiles[i]));walkableTiles.splice(i,1);}
/** Dijkstra on a half-tile mesh. Costs are screen distance, so diagonal speed is consistent. */
function search(start:Point){const s=snap(start),source=tileKeys.has(key(s))&&!blocked(s.x,s.y)&&clearSegment(start,s)?s:[...walkableTiles].filter(p=>!blocked(p.x,p.y)&&(blocked(start.x,start.y)||clearSegment(start,p))).sort((a,b)=>distance(a,start)-distance(b,start))[0];
 if(!source)return null;
 const prev=new Map<string,Point|null>([[key(source),null]]),cost=new Map<string,number>([[key(source),0]]),queue=[source],visited=new Set<string>();
 while(queue.length){queue.sort((a,b)=>cost.get(key(a))!-cost.get(key(b))!);const p=queue.shift()!,pk=key(p);if(visited.has(pk))continue;visited.add(pk);
 for(const n of neighbors(p)){const nk=key(n),next=cost.get(pk)!+distance(p,n);if(next<(cost.get(nk)??Infinity)){cost.set(nk,next);prev.set(nk,p);queue.push(n);}}
 }return {source,prev,cost};}
export function distance(a:Point,b:Point){const p=iso(a.x,a.y),q=iso(b.x,b.y);return Math.hypot(p.x-q.x,p.y-q.y);}
export function planRoute(start:Point,end:Point,nearest=false):{path:Point[];destination:Point}|null {
 const e=snap(end),found=search(start);if(!found)return null;let destination=e;
 if(!found.prev.has(key(e))){if(!nearest||!contains(floorShape,iso(end.x,end.y)))return null;
  destination=walkableTiles.filter(p=>found.prev.has(key(p))).sort((a,b)=>distance(a,end)-distance(b,end))[0];if(!destination)return null;}
 const path:Point[]=[];let p:Point|null=destination;while(p&&key(p)!==key(found.source)){path.unshift(p);p=found.prev.get(key(p))??null;}
 // Finish the current fractional step without teleporting when redirected mid-walk.
 if(distance(start,found.source)>.1)path.unshift(found.source);
 return {path,destination};
}
export function pathfind(start:Point,end:Point):Point[]{return planRoute(start,end)?.path??[];}
export function approachRoute(start:Point,options:Point[],preferFirst=false){if(preferFirst){for(const option of options){const plan=planRoute(start,option);if(plan)return plan;}return null;}return options.map(p=>planRoute(start,p)).filter((r):r is NonNullable<typeof r>=>!!r).sort((a,b)=>{
 const length=(path:Point[])=>path.reduce((total,p,i)=>total+distance(i?path[i-1]:start,p),0);return length(a.path)-length(b.path);
 })[0]??null;}
export const stageFor=(energy:number)=>energy>=300?3:energy>=180?2:energy>=100?1:0;
export const stages=['Seed','Sprout','Bloom','Sanctuary'];
