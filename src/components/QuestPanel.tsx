'use client';
import {useEffect,useState} from 'react';
import {Check,Leaf} from 'lucide-react';
import {useGame} from '@/store/game';
import {dailyQuests,readStudySave,defaultStudySave} from '@/lib/study-progress';
import {ProgressMeter} from './ui/GamePrimitives';

// Nonmodal quest widget keeps the room interactive.
export default function QuestPanel({onStudy}:{onStudy:()=>void}) {
  const game=useGame(),lessons=game.completions.filter(c=>c.player===0).length;
  const [save,setSave]=useState(()=>defaultStudySave(lessons));
  useEffect(()=>{setSave(readStudySave(lessons));},[lessons]);
  return <><h2>Daily quests</h2>
    <ul className="room-quests">{dailyQuests(save,lessons).map(q=><li key={q.text}><span className="quest-check">{q.value>=q.max?<Check aria-label="Complete"/>:<Leaf aria-label="In progress"/>}</span><div><strong>{q.text}</strong><ProgressMeter value={q.value} max={q.max} label={q.text}/><small>{q.value} / {q.max} {q.unit}</small></div></li>)}</ul>
    <button className="primary" onClick={onStudy}>Study ? +20 energy</button></>;
}
