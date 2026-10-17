'use client';
import {useEffect} from 'react';
import {friendDirectory,useFriends} from '@/store/friends';
import {useGame} from '@/store/game';
import {PlayerPortrait} from './ui/GamePrimitives';

export default function FriendsList(){
  const {accepted,accept,remove}=useFriends(),online=useGame(s=>s.online);
  useEffect(()=>{void useFriends.persist.rehydrate();},[]);
  return <div className="saved-friends"><h2>Accepted friends</h2><p className="fineprint">Your circle stays here even when friends are outside this greenhouse.</p>
    {!accepted.length&&<p>No friends yet. Accept a demo request below to start your circle.</p>}
    {friendDirectory.filter(friend=>accepted.includes(friend.id)).map(friend=><div className="saved-friend" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name}/><div className="friend-copy"><strong>{friend.name}</strong><small>{friend.roomMember===undefined?'Outside this greenhouse':online[friend.roomMember]?'In the greenhouse':'Offline'}</small></div><button className="text-button" onClick={()=>remove(friend.id)} aria-label={`Remove ${friend.name} from friends`}>Remove</button></div>)}
    <h3>Demo friend requests</h3><p className="fineprint">These requests are simulated. Accepted friends are saved in this browser.</p>
    {friendDirectory.filter(friend=>!accepted.includes(friend.id)).map(friend=><div className="saved-friend" key={friend.id}><PlayerPortrait avatar={friend.avatar} name={friend.name}/><div className="friend-copy"><strong>{friend.name}</strong><small>{friend.roomMember===undefined?'From another greenhouse':'Greenhouse member'}</small></div><button className="secondary" onClick={()=>accept(friend.id)} aria-label={`Accept friend request from ${friend.name}`}>Accept</button></div>)}
    {accepted.length===friendDirectory.length&&<p>All demo requests accepted.</p>}
  </div>;
}
