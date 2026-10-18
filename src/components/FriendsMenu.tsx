'use client';
import {useWorldParty} from '@/hooks/useWorldParty';
import {useState} from 'react';
import FriendsList from './FriendsList';
import {Copy,Flower2,ArrowRight,DoorOpen} from 'lucide-react';
import {useGame} from '@/store/game';
import {getCourse} from '@/lib/courses';
import {rpc} from '@/lib/backend/client';
import {PlayerPortrait,GamePanelHeader,GameBadge,ProgressMeter,HeartMeter} from './ui/GamePrimitives';

/** Join someone's study room with their invite code, or share one for the room you're in. */
function JoinStudyRoom({onJoined}:{onJoined:()=>void}){
 const backend=useWorldParty().backend;
 const [code,setCode]=useState(''),[roomName,setRoomName]=useState('My study room'),[invite,setInvite]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[takeover,setTakeover]=useState<string|null>(null);
 const owner=!!backend.snapshot&&backend.snapshot.world.owner_id===backend.profile?.player_id;
 const online=backend.enabled;
 const create=async()=>{
  setBusy(true);setMessage('');
  try{
   const id=await rpc<string>(backend.client!,'create_greenhouse',{p_name:roomName.trim()||'My study room',p_public:false,p_visits:false});
   await backend.switchWorld(id);
   const value=await rpc<string>(backend.client!,'issue_invite',{p_world:id});
   setInvite(value);
   try{await navigator.clipboard.writeText(value);setMessage('Study room created. Invite code copied. Send it to a friend. It works for 24 hours.');}
   catch{setMessage('Study room created. Copy the invite code below and send it to a friend. It works for 24 hours.');}
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 };
 const join=async(take=false)=>{
  setBusy(true);setMessage('');
  try{
   const world=takeover??await rpc<string|null>(backend.client!,'join_greenhouse',{p_code:code.trim()});
   if(!world)throw new Error('That invite code is unavailable or expired. Ask for a new one.');
   try{await backend.switchWorld(world,take);}
   catch(e){if((e as Error).message.includes('Already controlled')){setTakeover(world);throw new Error('You’re already in this room in another tab or browser.');}throw e;}
   setCode('');setTakeover(null);onJoined();
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 };
 const share=async()=>{
  setBusy(true);setMessage('');
  try{
   const value=await rpc<string>(backend.client!,'issue_invite',{p_world:backend.lease!.greenhouse_id});setInvite(value);
   try{await navigator.clipboard.writeText(value);setMessage('Invite code copied. It works for 24 hours.');}catch{setMessage('Invite code ready. It works for 24 hours. Select it to copy.');}
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 };
 return <section className="invite join-room" aria-labelledby="join-room-title"><div><small>STUDY ROOMS</small><strong id="join-room-title">Join a study room</strong><p className="fineprint">{online?'Paste the invite code a friend sent you. You’ll move into their room right away.':'Joining works in the online version. This copy is a local demo, so it can’t connect to other gardeners yet.'}</p></div>
  <form className="form-row" onSubmit={e=>{e.preventDefault();if(online&&code.trim())void join();}}><label className="join-room-code"><span className="sr-only">Invite code</span><input value={code} maxLength={100} onChange={e=>{setCode(e.target.value);setTakeover(null);}} placeholder="Paste an invite code" autoComplete="off" spellCheck={false} disabled={!online}/></label><button type="submit" className="primary" disabled={!online||busy||!code.trim()}><DoorOpen size={16} aria-hidden="true"/> Join</button></form>
  {takeover&&<button type="button" className="secondary" disabled={busy} onClick={()=>void join(true)}>Continue in this browser</button>}
  {online&&!backend.lease&&<form className="form-row" onSubmit={e=>{e.preventDefault();void create();}}><label className="join-room-code"><span className="sr-only">Study room name</span><input value={roomName} maxLength={60} onChange={e=>setRoomName(e.target.value)} placeholder="Name your study room"/></label><button type="submit" className="secondary" disabled={busy||!roomName.trim()}>Create study room</button></form>}
  {(owner||invite)&&<div className="join-room-share">{owner&&<button type="button" className="secondary" disabled={busy||!backend.lease} onClick={()=>void share()}><Copy size={15} aria-hidden="true"/> {invite?'Copy a new invite code':'Invite friends to this room'}</button>}{invite&&<input readOnly value={invite} aria-label="Invite code for this room" onFocus={e=>e.currentTarget.select()}/>}</div>}
  {online&&<button type="button" className="text-button" onClick={()=>window.dispatchEvent(new Event('sproutbound:open-worlds'))}>See all your rooms <ArrowRight size={14} aria-hidden="true"/></button>}
  <p className="copy-status" role="status">{message}</p>
 </section>;
}

export default function FriendsMenu({selected,onSelect,onCustomize,onJoined}:{selected:number|null;onSelect:(index:number|null)=>void;onCustomize:()=>void;onJoined:()=>void}){
 const [tab,setTab]=useState('members');
 const party=useWorldParty(),backend=party.backend;
 const state=useGame(),names=party.names;
 const subject=(index:number)=>index===0?(state.course?getCourse(state.course).title:'Your learning journey'):party.status(index);
 const contributors=backend.enabled?party.members.flatMap((_,i)=>party.energy(i)>0?[i]:[]):[...new Set(state.completions.filter(c=>c.player===0).map(c=>c.player))],complete=backend.enabled?state.sharedBloom:false;
 const lessonsBy=(index:number)=>party.energy(index)/20;
 const avatarOf=(index:number)=>party.avatar(index);
 return <><GamePanelHeader eyebrow="YOUR LITTLE CIRCLE" title="Your study circle">Different journeys. The same little greenhouse.</GamePanelHeader><GameBadge muted={!backend.enabled}>{backend.enabled?backend.status:'Local demo'}</GameBadge>
 <JoinStudyRoom onJoined={onJoined}/>
 <div className="social-tabs" role="tablist" aria-label="Social views">{([['members','Room members'],['friends','Friends List']] as const).map(([id,title])=><button key={id} role="tab" className="social-tab" aria-selected={tab===id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{title}</button>)}</div>
 <div className="social-page">{tab==='friends'?<FriendsList/>:<><div className="friend-list botanical-friends">{names.map((name,index)=>{const status=party.status(index);return <button className={`${party.online[index]?'online':'offline'} ${selected===index?'selected':''}`} key={index} onClick={()=>onSelect(selected===index?null:index)} aria-expanded={selected===index} aria-controls="friend-detail"><PlayerPortrait avatar={avatarOf(index)} name={name} offline={!party.online[index]}/><span className="friend-copy"><strong>{name}{index===0&&<small> · YOU</small>}</strong><small>{subject(index)}</small><HeartMeter value={lessonsBy(index)} label={`${name}'s study hearts`}/></span><span className="friend-status"><GameBadge muted={!party.online[index]}>{status}</GameBadge><small>{lessonsBy(index)*20} nutrients</small></span></button>;})}</div>
 {names.length===1&&<p className="empty-slot">{backend.enabled?'Just you for now. Invite a friend or join their room above.':'Just you in this local demo.'}</p>}
 {selected!==null&&selected<names.length&&<section className="friend-detail dialogue-box" id="friend-detail" aria-label={`${names[selected]} details`}><div className="dialogue-text"><span className="eyebrow">{selected===0?'YOUR JOURNEY':'FELLOW GARDENER'}</span><p>{selected===0?'Every little discovery helps our garden grow.':party.online[selected]?'A warm lantern and a little company for the next chapter.':'Offline for now. Their study station is waiting for another visit.'}</p><small>{lessonsBy(selected)} lessons completed</small>{selected===0&&<button className="secondary" onClick={onCustomize}>Customize character <ArrowRight size={14}/></button>}</div><div className="dialogue-portrait"><PlayerPortrait avatar={avatarOf(selected)} name={names[selected]} offline={!party.online[selected]}/><h2>{names[selected]}</h2></div></section>}
 <section className={`garden-unlock bloom-quest ${complete?'complete':''}`} aria-label="Moonlight Bloom quest"><Flower2 size={28}/><div><span className="eyebrow">SHARED GARDEN GOAL</span><strong>The Moonlight Bloom</strong><p>{complete?'A Moonlight Flower is now growing in your garden.':'Two different gardeners each complete a lesson to awaken a Moonlight Flower.'}</p><ProgressMeter value={contributors.length} max={2} label="Different gardeners contributing to Moonlight Bloom"/><span className="quest-progress-copy">{complete?'✧ Bloom awakened':`${contributors.length} / 2 gardeners`}<small>{contributors.map(i=>names[i]).join(' + ')||'Your first lesson starts the story.'}</small></span></div></section>
 <h3>Around the greenhouse</h3><div className="activity-list">{state.activity.map((activity,i)=><p key={i}><span/> {activity.replace(/(finished a lesson\. \+\d+) energy$/,'$1 nutrients')}</p>)}</div></>}</div></>;
}
