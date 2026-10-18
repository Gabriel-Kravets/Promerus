import type {Point} from './movement';

const spawns:Point[]=[{x:8.5,y:8.5},{x:9,y:8},{x:8,y:9},{x:9.5,y:7.5}];

export function facingSign(value:unknown):1|-1{
 return value===-1||value==='-1'?-1:1;
}

/** A chair index. Null and -1 mean standing; `null >= 0` is true in JavaScript and must not count. */
export function seatIndex(seat:unknown):number|undefined{
 const n=typeof seat==='number'?seat:typeof seat==='string'&&seat.trim()!==''?Number(seat):NaN;
 if(!Number.isInteger(n)||n<0||n>3)return undefined;
 return n;
}

export function memberTile(member:{x?:unknown;y?:unknown;slot?:number|null},fallback=0):Point{
 const x=typeof member.x==='number'?member.x:NaN,y=typeof member.y==='number'?member.y:NaN;
 if(Number.isFinite(x)&&Number.isFinite(y))return {x,y};
 const slot=typeof member.slot==='number'&&member.slot>=0&&member.slot<spawns.length?member.slot:fallback;
 return {...spawns[slot]??spawns[0]};
}

export function isPresent(member:{online?:unknown;activity?:unknown}){
 if(member.online===false||member.online==='false'||member.online===0)return false;
 if(member.online===true||member.online==='true'||member.online===1)return true;
 return member.activity!=='Offline';
}

export function otherGardeners<T extends {player_id?:string;online?:unknown;activity?:unknown;slot?:number|null}>(members:readonly T[]|undefined,selfId?:string){
 if(!members?.length)return [];
 return members.filter(member=>!!member.player_id&&member.player_id!==selfId&&isPresent(member)).sort((a,b)=>(a.slot??99)-(b.slot??99)).slice(0,3);
}
