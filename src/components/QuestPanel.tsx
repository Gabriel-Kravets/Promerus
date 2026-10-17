'use client';
import {useEffect,useState} from 'react';
import {Check,Leaf} from 'lucide-react';
import {useGame} from '@/store/game';
import {dailyQuests,readStudySave,defaultStudySave,STUDY_STORAGE_KEY,STUDY_PROGRESS_EVENT} from '@/lib/study-progress';
import {ProgressMeter} from './ui/GamePrimitives';

// Nonmodal quest widget keeps the room interactive.
export default function QuestPanel({onStudy}:{onStudy:()=>void}) {
  const game=useGame(),lessons=game.completions.filter(c=>c.player===0).length;
  const [save,setSave]=useState(()=>defaultStudySave(lessons));
  useEffect(()=>{
    const refresh=()=>{const next=readStudySave(lessons);setSave(previous=>previous.date===next.date&&JSON.stringify(dailyQuests(previous,lessons))===JSON.stringify(dailyQuests(next,lessons))?previous:next);};
    const storage=(event:StorageEvent)=>{if(event.key===null||event.key===STUDY_STORAGE_KEY)refresh();};
    refresh();
    window.addEventListener(STUDY_PROGRESS_EVENT,refresh);
    window.addEventListener('storage',storage);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    const midnightCheck=setInterval(refresh,60000);
    return()=>{window.removeEventListener(STUDY_PROGRESS_EVENT,refresh);window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(midnightCheck);};
  },[lessons]);
  return <><h2 id="daily-quests-title">Daily quests</h2>
    <ul className="room-quests">{dailyQuests(save,lessons).map(q=><li key={q.text}><span className="quest-check">{q.value>=q.max?<Check aria-label="Complete"/>:<Leaf aria-label="In progress"/>}</span><div><strong>{q.text}</strong><ProgressMeter value={q.value} max={q.max} label={q.text}/><small>{q.value} / {q.max} {q.unit}</small></div></li>)}</ul>
    <button className="primary" onClick={onStudy}>Study → +20 energy</button></>;
}
