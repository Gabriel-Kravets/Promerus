import {planRoute,distance,type Point} from '../movement.ts';
// One closed, obstacle-safe route anchored to server time, with different phase
// per greenhouse. No client election, payload identity or frame-rate dependency.
const stops:Point[]=[{x:8,y:4},{x:10,y:4},{x:10,y:1},{x:4,y:2},{x:3,y:4},{x:3,y:8},{x:4,y:10},{x:9,y:8},{x:8,y:4}];
type Segment={from:Point;to:Point;duration:number;moving:boolean};
let cached:Segment[]|undefined;
function route(){
 if(cached)return cached;
 const segments:Segment[]=[];let from=stops[0];
 for(const target of stops.slice(1)){
  const path=planRoute(from,target,true);if(!path)continue;
  for(const to of path.path){const length=distance(from,to);if(length>0)segments.push({from:{...from},to:{...to},duration:length/38,moving:true});from=to;}
  segments.push({from:{...from},to:{...from},duration:3,moving:false});
 }
 const home=planRoute(from,stops[0]);for(const to of home?.path??[]){segments.push({from:{...from},to:{...to},duration:distance(from,to)/38,moving:true});from=to;}
 cached=segments;return cached;
}
export function sharedSproutlingAt(world:string,serverMilliseconds:number){
 const segments=route(),period=segments.reduce((t,s)=>t+s.duration,0);
 let hash=2166136261;for(const c of world)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 let phase=((serverMilliseconds/1000+hash%1000)%period+period)%period;
 for(const s of segments){if(phase<=s.duration){const t=s.duration?phase/s.duration:0;return {position:{x:s.from.x+(s.to.x-s.from.x)*t,y:s.from.y+(s.to.y-s.from.y)*t},moving:s.moving,facing:s.to.x-s.to.y<s.from.x-s.from.y?1:-1};}phase-=s.duration;}
 return {position:{...stops[0]},moving:false,facing:1};
}

export function sproutlingClock(serverMilliseconds:number,pauseTotal:number,pauseUntil:string|null){
 const remaining=pauseUntil?Math.max(0,Date.parse(pauseUntil)-serverMilliseconds):0;
 return serverMilliseconds-pauseTotal*1000+remaining;
}
