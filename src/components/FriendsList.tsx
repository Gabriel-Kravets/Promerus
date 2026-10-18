'use client';
import {useEffect} from 'react';
import {Mail,UserPlus} from 'lucide-react';
import {friendDirectory,useFriends} from '@/store/friends';
import {useGame} from '@/store/game';
import {PlayerPortrait,HeartMeter} from './ui/GamePrimitives';

export default function FriendsList(){
  const {accepted,accept,remove}=useFriends(),online=useGame(s=>s.online),completions=useGame(s=>s.completions);
  useEffect(()=>{void useFriends.persist.rehydrate();},[]);
  const hearts=(member?:number)=>member===undefined?1:completions.filter(c=>c.player===member).length;
  const pending=friendDirectory.filter(friend=>!accepted.includes(friend.id));
  return <div className="saved-friends"><h2>Accepted friends</h2><p className="fineprint">Your circle stays here even when friends are outside this greenhouse.</p>
    {!accepted.length&&<p className="empty-slot">No friends yet. Open a letter below to start your circle.</p>}
    {friendDirectory.filter(friend=>accepted.includes(friend.id)).map(friend=>{const here=friend.roomMember!==undefined&&online[friend.roomMember];
      return <div className="saved-friend" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name} offline={!here}/><div className="friend-copy"><strong>{friend.name}</strong><small>{friend.roomMember===undefined?'Outside this greenhouse':here?'In the greenhouse':'Offline'}</small><HeartMeter value={hearts(friend.roomMember)} label={`Friendship with ${friend.name}`}/></div><button className="text-button danger" onClick={()=>remove(friend.id)} aria-label={`Remove ${friend.name} from friends`}>Remove</button></div>;})}
    <h3><Mail size={17}/> Friend requests{pending.length>0&&<span className="mail-count">{pending.length}</span>}</h3><p className="fineprint">These requests are simulated. Accepted friends are saved in this browser.</p>
    {pending.map(friend=><div className="saved-friend friend-letter" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name}/><div className="friend-copy"><strong>A letter from {friend.name}</strong><small>{friend.roomMember===undefined?'From another greenhouse':'Greenhouse member'} · wants to be friends</small></div><button className="secondary accept" onClick={()=>accept(friend.id)} aria-label={`Accept friend request from ${friend.name}`}><UserPlus size={14}/> Accept</button></div>)}
    {!pending.length&&<p className="empty-slot">All demo requests accepted. Your mailbox is empty.</p>}
  </div>;
}
