'use client';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,Check,ChevronRight,Hourglass,Leaf,ScrollText,Sparkles,Sprout} from 'lucide-react';
import {useGame} from '@/store/game';
import {dailyQuests,readStudySave,defaultStudySave,STUDY_STORAGE_KEY,STUDY_PROGRESS_EVENT} from '@/lib/study-progress';
import {ProgressMeter} from './ui/GamePrimitives';

const questIcons=[BookOpen,Hourglass,Sprout];
const untilReset=()=>{const now=new Date(),next=new Date(now);next.setHours(24,0,0,0);const minutes=Math.ceil((next.getTime()-now.getTime())/60000);return `${Math.floor(minutes/60)}h ${minutes%60}m`;};

// Nonmodal quest widget keeps the room interactive.
export default function QuestPanel({onStudy}:{onStudy:()=>void}) {
  const lessons=useGame(s=>s.completions.filter(c=>c.player===0).length);
  const [save,setSave]=useState(()=>defaultStudySave(lessons)),[reset,setReset]=useState(''),[bloomed,setBloomed]=useState<string[]>([]);
  const completed=useRef<Set<string>|null>(null);
  // Focus time and flashcards are saved by the study room; keep the widget current while it stays open.
  useEffect(()=>{const refresh=()=>{setSave(readStudySave(lessons));setReset(untilReset());};refresh();
    const id=setInterval(refresh,5000);window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
    return()=>{clearInterval(id);window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);};
  },[lessons]);
  const quests=dailyQuests(save,lessons),done=quests.filter(q=>q.value>=q.max);
  // Celebrate quests that finish while the widget is open, not the ones already done on load.
  useEffect(()=>{const now=new Set(done.map(q=>q.text)),before=completed.current;completed.current=now;if(!before)return;
    const fresh=[...now].filter(text=>!before.has(text));if(!fresh.length)return;
    setBloomed(b=>[...b,...fresh]);const t=setTimeout(()=>setBloomed(b=>b.filter(text=>!fresh.includes(text))),1800);return()=>clearTimeout(t);
  },[done.map(q=>q.text).join('|')]);
  return <>
    <header className="quest-head"><span className="quest-crest" aria-hidden="true"><ScrollText size={18}/></span><div><h2>Daily Quests</h2><small>{reset&&`Renews in ${reset}`}</small></div></header>
    <div className="quest-vine" role="img" aria-label={`${done.length} of ${quests.length} quests complete`}>
      {quests.map((q,i)=><span key={q.text} className={q.value>=q.max?'grown':''} style={{['--i' as string]:i}}><Leaf size={15}/></span>)}
      <em>{done.length}/{quests.length}</em>
    </div>
    <ul className="room-quests quest-list">{quests.map((q,i)=>{const Icon=questIcons[i]??Leaf,complete=q.value>=q.max;
      return <li key={q.text} className={`${complete?'is-complete':''} ${bloomed.includes(q.text)?'just-bloomed':''}`}>
        <button className="quest-row" onClick={onStudy} aria-label={`${q.text}: ${q.value} of ${q.max} ${q.unit}. ${complete?'Complete.':'Open the study room.'}`}>
          <span className="quest-check" aria-hidden="true">{complete?<Check/>:<Icon/>}</span>
          <span className="quest-copy">
            <strong>{q.text}</strong>
            {q.max<=5?<span className="quest-pips" aria-hidden="true">{Array.from({length:q.max},(_,k)=><i key={k} className={k<q.value?'filled':''}/>)}</span>:<ProgressMeter value={q.value} max={q.max} label={q.text}/>}
            <small>{complete?'Complete':`${q.value} / ${q.max} ${q.unit}`}</small>
          </span>
          <ChevronRight className="quest-go" size={16} aria-hidden="true"/>
        </button>
      </li>;})}</ul>
    {done.length===quests.length&&<p className="quest-complete" role="status"><Sparkles size={15}/> Every quest done. The garden thanks you!</p>}
    <button className="primary quest-study" onClick={onStudy}>Study · +20 nutrients</button>
  </>;
}
