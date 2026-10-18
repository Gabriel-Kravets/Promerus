import {create} from 'zustand';
import {persist,createJSONStorage} from 'zustand/middleware';
import {presets,type Avatar} from './game';

export type FriendProfile={id:string;name:string;avatar:Avatar;roomMember?:number};
// The demo directory is independent from the greenhouse membership list.
export const friendDirectory:FriendProfile[]=[
  {id:'maya',name:'Maya',avatar:presets[1]},
  {id:'kai',name:'Kai',avatar:presets[2]},
  {id:'jules',name:'Jules',avatar:presets[3]},
  {id:'rowan',name:'Rowan',avatar:{...presets[0],hair:'#86758d',outfit:'#577b60'}}
];
export function validFriendIds(value:unknown):string[] {
  return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&friendDirectory.some(p=>p.id===id)))]:[];
}
type FriendsState={accepted:string[];accept:(id:string)=>void;remove:(id:string)=>void};
export const useFriends=create<FriendsState>()(persist((set)=>({
  accepted:[],
  accept:id=>set(s=>({accepted:validFriendIds([...s.accepted,id])})),
  remove:id=>set(s=>({accepted:s.accepted.filter(value=>value!==id)}))
}),{name:'sproutbound-friends',storage:createJSONStorage(()=>({getItem:key=>{try{return localStorage.getItem(key);}catch{return null;}},setItem:(key,value)=>{try{localStorage.setItem(key,value);}catch{}},removeItem:key=>{try{localStorage.removeItem(key);}catch{}}})),skipHydration:true,
  merge:(saved,current)=>({...current,accepted:validFriendIds((saved as Partial<FriendsState>)?.accepted)})}));
