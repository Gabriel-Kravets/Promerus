'use client';
import {useBackend} from './backend/BackendProvider';
import {Trophy} from 'lucide-react';
import {useGame,presets} from '@/store/game';
import {weeklyLeaderboard,daysUntilReset} from '@/lib/leaderboard';
import {PlayerPortrait} from './ui/GamePrimitives';

// Replaces the Learning Seeds card: who has contributed the most energy since Monday.
export default function WeeklyLeaderboard({onSelect}:{onSelect:(index:number)=>void}){
 const backend=useBackend();const state=useGame(),names=[state.name,'Maya','Kai','Jules'];
 if(backend.enabled){
  const members=(backend.snapshot?.members??[]).slice().sort((a,b)=>Number(b.player_id===backend.profile?.player_id)-Number(a.player_id===backend.profile?.player_id)||Number(b.online)-Number(a.online)).slice(0,4);
  const rows=members.map((member,index)=>({member,index,energy:backend.snapshot?.contributions.find(c=>c.player_id===member.player_id)?.energy??0})).sort((a,b)=>b.energy-a.energy||a.index-b.index),top=Math.max(1,...rows.map(r=>r.energy));
  return <section className="weekly-board" aria-label="Greenhouse contributions"><header><Trophy size={16} aria-hidden="true"/><h2>Growing Together</h2><small>All time</small></header><ol>{rows.map(row=><li key={row.member.player_id}><button className={`board-row ${row.member.player_id===backend.profile?.player_id?'is-you':''}`} onClick={()=>onSelect(row.index)} aria-label={`${row.member.name}, ${row.energy} verified energy. View details.`}><span className="board-rank" aria-hidden="true">✧</span><PlayerPortrait avatar={row.member.avatar} name={row.member.name} offline={!row.member.online}/><span className="board-copy"><strong>{row.member.name}{row.member.player_id===backend.profile?.player_id&&<small> YOU</small>}</strong><span className="board-bar" aria-hidden="true"><span style={{width:`${row.energy/top*100}%`}}/></span></span><span className="board-energy">{row.energy}</span></button></li>)}</ol><p className="board-note">Verified contributions to this greenhouse</p></section>;
 }
 const rows=weeklyLeaderboard(names,state.completions),top=Math.max(1,...rows.map(r=>r.energy)),days=daysUntilReset();
 return <section className="weekly-board" aria-label="Weekly leaderboard">
  <header><Trophy size={16} aria-hidden="true"/><h2>Weekly Leaderboard</h2><small>{days===1?'Resets tomorrow':`Resets in ${days} days`}</small></header>
  <ol>{rows.map(row=><li key={row.index}><button className={`board-row ${row.index===0?'is-you':''} rank-${row.rank}`} onClick={()=>onSelect(row.index)} aria-label={`Rank ${row.rank}: ${row.name}${row.index===0?' (you)':''}, ${row.energy} energy this week. View details.`}>
   <span className="board-rank" aria-hidden="true">{row.rank}</span>
   <PlayerPortrait avatar={row.index===0?state.avatar:presets[row.index]} name={row.name} offline={row.index>0&&!state.online[row.index]}/>
   <span className="board-copy"><strong>{row.name}{row.index===0&&<small> YOU</small>}</strong><span className="board-bar" aria-hidden="true"><span style={{width:`${row.energy/top*100}%`}}/></span></span>
   <span className="board-energy">{row.energy}</span>
  </button></li>)}</ol>
  <p className="board-note">Classmate totals are placeholder data</p>
 </section>;
}
