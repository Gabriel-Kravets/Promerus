'use client';
import {Trophy} from 'lucide-react';
import {useGame,presets} from '@/store/game';
import {weeklyLeaderboard,daysUntilReset} from '@/lib/leaderboard';
import {PlayerPortrait} from './ui/GamePrimitives';

// Replaces the Learning Seeds card: who has contributed the most energy since Monday.
export default function WeeklyLeaderboard({onSelect}:{onSelect:(index:number)=>void}){
 const state=useGame(),names=[state.name,'Maya','Kai','Jules'];
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
