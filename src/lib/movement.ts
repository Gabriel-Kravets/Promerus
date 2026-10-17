import {contains,floorShape,gardenFootprint} from './world-geometry';
import {desks} from './world-layout';
export type Point={x:number;y:number};
export const iso=(x:number,y:number):Point=>({x:660+(x-y)*36,y:200+(x+y)*18});
export const uniso=(x:number,y:number):Point=>({x:((x-660)/36+(y-200)/18)/2,y:((y-200)/18-(x-660)/36)/2});
export const GRID_STEP=.5,AVATAR_RADIUS=7;
export const deskFootprint=(d:Point)=>({kind:'ellipse' as const,x:iso(d.x,d.y).x,y:iso(d.x,d.y).y-10,rx:58,ry:17});
const isolatedTiles=new Set<string>();
export function blocked(x:number,y:number):boolean {
 if(isolatedTiles.has(`${x},${y}`))return true;
 const p=iso(x,y),obstacles=[gardenFootprint,...desks.map(deskFootprint)];
 return [[0,0],[AVATAR_RADIUS,0],[-AVATAR_RADIUS,0],[0,AVATAR_RADIUS],[0,-AVATAR_RADIUS]].some(([dx,dy])=>{
  const q={x:p.x+dx,y:p.y+dy};return !contains(floorShape,q)||obstacles.some(shape=>contains(shape,q));
 });
}
const key=(p:Point)=>`${p.x},${p.y}`;
const snap=(p:Point)=>({x:Math.round(p.x/GRID_STEP)*GRID_STEP,y:Math.round(p.y/GRID_STEP)*GRID_STEP});
export const walkableTiles:Point[]=[];
for(let x=-2;x<=16;x+=GRID_STEP)for(let y=-2;y<=16;y+=GRID_STEP)if(!blocked(x,y))walkableTiles.push({x,y});
const tileKeys=new Set(walkableTiles.map(key));
function neighbors(p:Point){const result:Point[]=[];for(const [dx,dy] of [[.5,0],[-.5,0],[0,.5],[0,-.5],[.5,.5],[.5,-.5],[-.5,.5],[-.5,-.5]]){
 const n={x:p.x+dx,y:p.y+dy};if(!tileKeys.has(key(n)))continue;
 // Never cut the corner of a desk or the garden with a diagonal step.
 if(dx&&dy&&(!tileKeys.has(key({x:p.x+dx,y:p.y}))||!tileKeys.has(key({x:p.x,y:p.y+dy}))))continue;
 result.push(n);
 }return result;}
// Slivers behind solid furniture that cannot fit a connected passage are not destinations.
const connected=new Set<string>(['8,8']),flood:Point[]=[{x:8,y:8}];
while(flood.length){const p=flood.pop()!;for(const n of neighbors(p))if(!connected.has(key(n))){connected.add(key(n));flood.push(n);}}
for(let i=walkableTiles.length-1;i>=0;i--)if(!connected.has(key(walkableTiles[i]))){isolatedTiles.add(key(walkableTiles[i]));tileKeys.delete(key(walkableTiles[i]));walkableTiles.splice(i,1);}
/** Dijkstra on a half-tile mesh. Costs are screen distance, so diagonal speed is consistent. */
function search(start:Point){const s=snap(start),source=tileKeys.has(key(s))?s:[...walkableTiles].sort((a,b)=>distance(a,start)-distance(b,start))[0];
 const prev=new Map<string,Point|null>([[key(source),null]]),cost=new Map<string,number>([[key(source),0]]),queue=[source],visited=new Set<string>();
 while(queue.length){queue.sort((a,b)=>cost.get(key(a))!-cost.get(key(b))!);const p=queue.shift()!,pk=key(p);if(visited.has(pk))continue;visited.add(pk);
 for(const n of neighbors(p)){const nk=key(n),next=cost.get(pk)!+distance(p,n);if(next<(cost.get(nk)??Infinity)){cost.set(nk,next);prev.set(nk,p);queue.push(n);}}
 }return {source,prev,cost};}
export function distance(a:Point,b:Point){const p=iso(a.x,a.y),q=iso(b.x,b.y);return Math.hypot(p.x-q.x,p.y-q.y);}
export function planRoute(start:Point,end:Point,nearest=false):{path:Point[];destination:Point}|null {
 const e=snap(end),found=search(start);let destination=e;
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
