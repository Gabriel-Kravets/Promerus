'use client';
import {useGame,presets} from '@/store/game';
import {memberStatus} from '@/lib/party';
import {PlayerPortrait} from './ui/GamePrimitives';
export default function PartyRoster({panel,onSelect}:{panel:string;onSelect:(index:number)=>void}){
 const state=useGame(),names=[state.name,'Maya','Kai','Jules'],here=names.filter((_,i)=>i===0||state.online[i]).length;
 return <aside className="party-roster" aria-label="Your greenhouse party"><span className="party-caption">ROOM MEMBERS <b>{here}/{names.length}</b></span>{names.map((name,index)=>{const activity=memberStatus(state,index,panel),offline=activity==='Offline';return <button key={index} className={`party-member ${offline?'offline':''} ${index===0?'is-you':''}`} onClick={()=>onSelect(index)} aria-label={`${name}${index===0?' (you)':''} · ${activity} · view details`}><PlayerPortrait avatar={index===0?state.avatar:presets[index]} name={name} offline={offline}/><span className="party-copy"><strong>{name}{index===0&&<small> YOU</small>}</strong><span><i className={`activity-gem ${activity.toLowerCase().replace(/\s+/g,'-')}`} aria-hidden="true"/>{activity}</span></span><span className="party-hover" role="tooltip">{name} · {activity}{index>0?' · simulated':''}</span></button>;})}<span className="party-demo">LOCAL DEMO PARTY</span></aside>;
}
