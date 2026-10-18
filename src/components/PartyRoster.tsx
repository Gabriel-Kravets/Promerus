'use client';
import {useWorldParty,useWorldLeaderboard} from '@/hooks/useWorldParty';
import {Coins} from 'lucide-react';
import {useGame} from '@/store/game';
import {stages,stageFor,STAGE_THRESHOLDS} from '@/lib/movement';
import {PlayerPortrait} from './ui/GamePrimitives';
export default function PartyRoster({panel,onSelect}:{panel:string;onSelect:(index:number)=>void}){
 const party=useWorldParty(),state=useGame(),gold=state.coins||0,names=party.names,here=names.filter((_,i)=>i===0||party.online[i]).length;
 // The person playing (index 0) always stays at the top of their own list.
 const order=[0,...names.map((_,i)=>i).filter(i=>i!==0)];
 // Shared nutrients toward the next garden tree stage.
 const stage=stageFor(state.energy),floor=STAGE_THRESHOLDS[stage],next=STAGE_THRESHOLDS[stage+1] as number|undefined,toNext=next===undefined?0:next-state.energy,progress=next===undefined?100:Math.round((state.energy-floor)/(next-floor)*100);
 return <aside className="party-roster" aria-label="Your greenhouse party"><span className="party-caption">ROOM MEMBERS <b>{here}/{names.length}</b></span>{order.map(index=>{const name=names[index],you=index===0,activity=party.status(index,panel),offline=activity==='Offline';return <button key={index} className={`party-member ${offline?'offline':''} ${you?'is-you':''}`} onClick={()=>onSelect(index)} aria-label={`${name}${you?` (you) · ${gold} gold`:''} · ${activity} · view details`}><PlayerPortrait avatar={party.avatar(index)} name={name} offline={offline}/><span className="party-copy"><strong>{name}{you&&<small> YOU</small>}</strong><span><i className={`activity-gem ${activity.toLowerCase().replace(/\s+/g,'-')}`} aria-hidden="true"/>{activity}{you&&<span className="party-gold" title="Your gold" aria-hidden="true"><Coins size={12}/>{gold}</span>}</span></span><span className="party-hover" role="tooltip">{name} · {activity}{index>0&&!party.backend.enabled?' · simulated':''}</span></button>;})}<span className="party-demo">{party.backend.enabled?party.backend.status.toUpperCase():'LOCAL DEMO PARTY'}</span>
  <div className="room-sprout"><span className="room-sprout-title">Room sprout progress</span><div className="room-sprout-bar" role="progressbar" aria-label="Room sprout progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={next===undefined?`${stages[stage]} reached`:`${toNext} nutrients until ${stages[stage+1]}`}><span style={{width:`${progress}%`}}/></div><span className="room-sprout-next">{next===undefined?`${stages[stage]} tree complete`:`${toNext} nutrients to ${stages[stage+1]} tree`}</span></div>
 </aside>;
}
