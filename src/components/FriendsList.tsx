'use client';
import {useEffect,useState} from 'react';
import {Mail,UserPlus} from 'lucide-react';
import {friendDirectory,useFriends} from '@/store/friends';
import {useGame} from '@/store/game';
import {useBackend} from './backend/BackendProvider';
import {rpc} from '@/lib/backend/client';
import {PlayerPortrait,HeartMeter} from './ui/GamePrimitives';

export default function FriendsList(){
  const backend=useBackend();
  const {accepted,accept,remove}=useFriends(),online=useGame(s=>s.online),completions=useGame(s=>s.completions);
  const [code,setCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{void useFriends.persist.rehydrate();},[]);
  useEffect(()=>{if(!backend.enabled)return;const id=setInterval(()=>void backend.refresh().catch(()=>{}),5000);return()=>clearInterval(id);},[backend.enabled,backend.refresh]);
  const hearts=(member?:number)=>member===undefined?1:completions.filter(c=>c.player===member).length;
  const pending=friendDirectory.filter(friend=>!accepted.includes(friend.id));
  if(backend.enabled&&backend.client){
    const friends=backend.economy?.friends??[],acceptedFriends=friends.filter(friend=>friend.status==='accepted'),incoming=friends.filter(friend=>friend.status==='pending'&&friend.incoming);
    const act=async(run:()=>Promise<unknown>)=>{setBusy(true);setNotice('');try{await run();await backend.refresh();}catch(error){setNotice(error instanceof Error?error.message:'Friend request unavailable');}finally{setBusy(false);}};
    return <div className="saved-friends"><h2>Accepted friends</h2><p className="fineprint">Your friend code is {backend.economy?.friend_code??'…'}. Online status is visible only to accepted friends.</p>
      {!acceptedFriends.length&&<p className="empty-slot">No friends yet. Share your code or enter a friend’s code.</p>}
      {acceptedFriends.map(friend=><div className="saved-friend" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name} offline={!friend.online}/><div className="friend-copy"><strong>{friend.name}</strong><small>{friend.online?'Online':'Offline'}</small></div><button className="text-button danger" disabled={busy} onClick={()=>void act(()=>rpc(backend.client!,'remove_friend',{p_link:friend.id}))} aria-label={`Remove ${friend.name} from friends`}>Remove</button></div>)}
      <h3><Mail size={17}/> Friend requests{incoming.length>0&&<span className="mail-count">{incoming.length}</span>}</h3>
      {incoming.map(friend=><div className="saved-friend friend-letter" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name}/><div className="friend-copy"><strong>A letter from {friend.name}</strong><small>Wants to be friends</small></div><button className="secondary accept" disabled={busy} onClick={()=>void act(()=>rpc(backend.client!,'respond_friend',{p_link:friend.id,p_accept:true}))} aria-label={`Accept friend request from ${friend.name}`}><UserPlus size={14}/> Accept</button><button className="text-button" disabled={busy} onClick={()=>void act(()=>rpc(backend.client!,'respond_friend',{p_link:friend.id,p_accept:false}))}>Decline</button></div>)}
      {!incoming.length&&<p className="empty-slot">Your mailbox is empty.</p>}
      <label>Friend code<input value={code} maxLength={12} onChange={event=>setCode(event.target.value)}/></label>
      <button className="secondary" disabled={busy||code.trim().length!==12} onClick={()=>void act(()=>rpc(backend.client!,'request_friend',{p_code:code.trim()}))}>Send request</button>
      <p className="copy-status" role="status">{notice}</p>
    </div>;
  }
  return <div className="saved-friends"><h2>Accepted friends</h2><p className="fineprint">Your circle stays here even when friends are outside this greenhouse.</p>
    {!accepted.length&&<p className="empty-slot">No friends yet. Open a letter below to start your circle.</p>}
    {friendDirectory.filter(friend=>accepted.includes(friend.id)).map(friend=>{const here=friend.roomMember!==undefined&&online[friend.roomMember];
      return <div className="saved-friend" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name} offline={!here}/><div className="friend-copy"><strong>{friend.name}</strong><small>{friend.roomMember===undefined?'Outside this greenhouse':here?'In the greenhouse':'Offline'}</small><HeartMeter value={hearts(friend.roomMember)} label={`Friendship with ${friend.name}`}/></div><button className="text-button danger" onClick={()=>remove(friend.id)} aria-label={`Remove ${friend.name} from friends`}>Remove</button></div>;})}
    <h3><Mail size={17}/> Friend requests{pending.length>0&&<span className="mail-count">{pending.length}</span>}</h3><p className="fineprint">These requests are simulated. Accepted friends are saved in this browser.</p>
    {pending.map(friend=><div className="saved-friend friend-letter" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name}/><div className="friend-copy"><strong>A letter from {friend.name}</strong><small>{friend.roomMember===undefined?'From another greenhouse':'Greenhouse member'} · wants to be friends</small></div><button className="secondary accept" onClick={()=>accept(friend.id)} aria-label={`Accept friend request from ${friend.name}`}><UserPlus size={14}/> Accept</button></div>)}
    {!pending.length&&<p className="empty-slot">All demo requests accepted. Your mailbox is empty.</p>}
  </div>;
}
