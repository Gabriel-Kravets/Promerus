import {blocked,clearSegment,distance,iso,planRoute,walkableTiles,type Point} from './movement';

/** A small autonomous walker using the same obstacle-safe routes as gardeners. */
export function createSproutlingWander(start:Point={x:8,y:4},random:()=>number=Math.random){
 let position={...start},route:Point[]=[],pause=1,facing=1;
 return (dt:number,paused=false)=>{
  let moving=false;
  if(!paused){
   if(route.length&&!clearSegment(position,route[0])){route=[];pause=.2;}
   if(!route.length){
    pause-=dt;
    if(pause<=0){
     const choices=walkableTiles.filter(p=>!blocked(p.x,p.y)&&distance(position,p)>100&&distance(position,p)<320);
     const destination=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
     route=destination?planRoute(position,destination)?.path??[]:[];
     pause=2+random()*3;
    }
   }
   let travel=Math.max(0,dt)*38;
   while(route.length&&travel>0){
    const next=route[0],d=distance(position,next),a=iso(position.x,position.y),b=iso(next.x,next.y);
    if(Math.abs(b.x-a.x)>.1)facing=b.x<a.x?1:-1;
    if(d<=travel){position={...next};route.shift();travel-=d;}
    else{position.x+=(next.x-position.x)*travel/d;position.y+=(next.y-position.y)*travel/d;travel=0;}
    moving=true;
   }
  }
  return {position:{...position},moving,facing};
 };
}
