'use client';
import {useEffect,useRef} from 'react';
import {useBackend} from '@/components/backend/BackendProvider';
import {useInventory,readRoomInventory} from '@/store/inventory';
import {useGame} from '@/store/game';
import type {RoomLayout} from '@/lib/backend/room-layout';

/** Main's existing synchronous controls stay intact; authoritative writes are
 * serialized, checked by game-api, and reconciled into that same inventory store. */
export function useSharedRoomLayout(onNotice:(message:string)=>void){
 const backend=useBackend(),latest=useRef(backend);latest.current=backend;
 const pending=useRef(false),confirmed=useRef<{layout:RoomLayout;version:number}|null>(null),roomSize=useRef(1);
 const apply=(layout:RoomLayout)=>{const state=useInventory.getState(),saved=readRoomInventory({...layout,initialized:true,theme:useGame.getState().settings.theme,tutorialSeen:state.tutorialSeen});if(saved)useInventory.setState({...saved,tutorialSeen:state.tutorialSeen});useInventory.getState().setRoomSize(roomSize.current);};
 const world=backend.snapshot?.world;
 useEffect(()=>{
  if(!backend.enabled||!world?.room_layout||pending.current)return;
  confirmed.current={layout:world.room_layout,version:world.room_layout_version??0};apply(world.room_layout);
 },[backend.enabled,world?.id,world?.room_layout_version]);
 const members=(backend.snapshot?.members??[]).map(m=>m.player_id).sort().join('|');
 // Starting desks follow the room's permanent members, the same count game-api checks.
 useEffect(()=>{
  if(!backend.enabled||!backend.client||!world?.id)return;let active=true;
  roomSize.current=backend.snapshot?.members.length||1;useInventory.getState().setRoomSize(roomSize.current);
  void backend.client.from('greenhouse_memberships').select('player_id',{count:'exact',head:true}).eq('greenhouse_id',world.id).then(({count,error})=>{
   if(active&&!error&&count!==null){roomSize.current=count;useInventory.getState().setRoomSize(count);}
  });
  return()=>{active=false;};
 },[backend.enabled,backend.client,world?.id,members]);
 useEffect(()=>{
  if(!backend.enabled||!backend.lease)return;
  const session=backend.lease.id,original=useInventory.getState();let active=true;
  confirmed.current=world?.room_layout?{layout:world.room_layout,version:world.room_layout_version??0}:null;
  if(confirmed.current)apply(confirmed.current.layout);else{original.reset();useInventory.getState().setRoomSize(roomSize.current);}
  const save=async(command:unknown)=>{
   pending.current=true;
   try{
    const b=latest.current;
    const result=await b.invoke<{layout:RoomLayout;layout_version:number}>('layout',{session,expectedVersion:confirmed.current?.version??b.snapshot?.world.room_layout_version??0,command});
    if(!active||latest.current.lease?.id!==session)return;
    confirmed.current={layout:result.layout,version:result.layout_version};apply(result.layout);await latest.current.refresh();
   }catch(error){if(active&&latest.current.lease?.id===session){if(confirmed.current)apply(confirmed.current.layout);onNotice(error instanceof Error?error.message:'The room edit could not be saved.');await latest.current.refresh().catch(()=>{});}}
   finally{if(active)pending.current=false;}
  };
  const blocked=()=>{if(pending.current||!confirmed.current){onNotice('Saving the room. Please try again in a moment.');return true;}return false;};
  const denied={valid:false as const,reason:'unavailable' as const,message:'Saving the room. Please try again in a moment.'};
  const wrappers={
   buyItem:((type:Parameters<typeof original.buyItem>[0])=>{if(blocked())return null;const item=original.buyItem(type);if(item)void save({kind:'buy',type,theme:item.theme});return item;}) as typeof original.buyItem,
   returnItem:((id:string)=>{if(blocked())return;original.returnItem(id);void save({kind:'return',id});}) as typeof original.returnItem,
   placeItem:((id,position,obstacles,mirrored)=>{if(blocked())return denied;const result=original.placeItem(id,position,obstacles,mirrored);if(result.valid)void save({kind:'place',id,position,mirrored:mirrored??!!useInventory.getState().items.find(i=>i.id===id)?.mirrored});return result;}) as typeof original.placeItem,
   moveItem:((id,position,obstacles,mirrored)=>{if(blocked())return denied;const result=original.moveItem(id,position,obstacles,mirrored);if(result.valid)void save({kind:'place',id,position,mirrored:mirrored??!!useInventory.getState().items.find(i=>i.id===id)?.mirrored});return result;}) as typeof original.moveItem,
   moveFixture:((id,position,obstacles,mirrored)=>{if(blocked())return denied;const result=original.moveFixture(id,position,obstacles,mirrored);if(result.valid)void save({kind:'place',id,position,mirrored:mirrored??!!useInventory.getState().fixturePositions?.[id]?.mirrored});return result;}) as typeof original.moveFixture,
  };
  useInventory.setState(wrappers);
  void save({kind:'initialize'});
  return()=>{active=false;pending.current=false;for(const key of Object.keys(wrappers) as (keyof typeof wrappers)[])if(useInventory.getState()[key]===wrappers[key])useInventory.setState({[key]:original[key]});};
 },[backend.enabled,backend.lease?.id,members]);
}
