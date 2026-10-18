'use client';
import {useWorldParty,useWorldLeaderboard} from '@/hooks/useWorldParty';
import {useEffect,useState} from 'react';
import {Trophy,X} from 'lucide-react';
import {useGame,presets} from '@/store/game';
import {weeklyLeaderboard,daysUntilReset} from '@/lib/leaderboard';
import {PlayerPortrait} from './ui/GamePrimitives';

const OPEN_KEY='sproutbound-leaderboard-open';

// Replaces the Learning Seeds card: who has contributed the most energy since Monday.
// Minimizes to a launcher like the quest window; the choice is remembered per browser.
export default function WeeklyLeaderboard({onSelect}:{onSelect:(index:number)=>void}){
 const [open,setOpen]=useState(true);
 useEffect(()=>{try{if(localStorage.getItem(OPEN_KEY)==='false')setOpen(false);}catch{}},[]);
 const toggle=(next:boolean)=>{setOpen(next);try{localStorage.setItem(OPEN_KEY,String(next));}catch{}};
 const party=useWorldLeaderboard(),state=useGame(),names=party.names;
 const rows=party.rows,top=Math.max(1,...rows.map(r=>r.energy)),days=daysUntilReset();
 if(!open)return <div className="board-widget"><button className="quest-launcher secondary board-launcher" aria-expanded={false} aria-controls="weekly-board" onClick={()=>toggle(true)}><Trophy size={18} aria-hidden="true"/> Leaderboard</button></div>;
 return <div className="board-widget"><section id="weekly-board" className="weekly-board" aria-label="Weekly leaderboard">
  <button className="quest-close" aria-label="Minimize leaderboard" onClick={()=>toggle(false)}><X size={18}/></button>
  <header><Trophy size={16} aria-hidden="true"/><h2>Weekly Leaderboard</h2><small>{days===1?'Resets tomorrow':`Resets in ${days} days`}</small></header>
  <ol>{rows.map(row=><li key={row.index}><button className={`board-row ${row.index===0?'is-you':''} rank-${row.rank}`} onClick={()=>onSelect(row.index)} aria-label={`Rank ${row.rank}: ${row.name}${row.index===0?' (you)':''}, ${row.energy} energy this week. View details.`}>
   <span className="board-rank" aria-hidden="true">{row.rank}</span>
   <PlayerPortrait avatar={party.avatar(row.index)} name={row.name} offline={row.index>0&&!party.online[row.index]}/>
   <span className="board-copy"><strong>{row.name}{row.index===0&&<small> YOU</small>}</strong><span className="board-bar" aria-hidden="true"><span style={{width:`${row.energy/top*100}%`}}/></span></span>
   <span className="board-energy">{row.energy}</span>
  </button></li>)}</ol>
  <p className="board-note">{party.backend.enabled?party.notice:'Your lessons this week'}</p>
 </section></div>;
}
