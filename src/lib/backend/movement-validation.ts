import {blocked,clearSegment,planRoute,distance,type Point} from '../movement.ts';
export function validMovement(previous:Point,next:Point,elapsedSeconds:number){
 if(!Number.isFinite(next.x)||!Number.isFinite(next.y)||blocked(next.x,next.y))return false;
 const budget=112*Math.min(2,Math.max(0,elapsedSeconds))+12;
 if(clearSegment(previous,next))return distance(previous,next)<=budget;
 // A sample can straddle a path corner. Check the legal polyline's travel cost,
 // not an impossible straight chord through the furniture at that corner.
 const route=planRoute(previous,next);if(!route)return false;
 let cost=0,last=previous;for(const p of route.path){cost+=distance(last,p);last=p;}
 return cost<=budget&&distance(last,next)<1;
}
