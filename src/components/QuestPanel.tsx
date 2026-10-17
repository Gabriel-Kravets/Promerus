'use client';
import {useEffect,useState} from 'react';
import {Check,Leaf} from 'lucide-react';
import {useGame} from '@/store/game';
import {dailyQuests,readStudySave,defaultStudySave} from '@/lib/study-progress';
import {GamePanelHeader,ProgressMeter} from './ui/GamePrimitives';

// Rendered inside the room's shared accessible modal (Escape, focus trap, backdrop).
export default function QuestPanel({onStudy}:{onStudy:()=>void}) {
  const game=useGame(),lessons=game.completions.filter(c=>c.player===0).length;
  const [save,setSave]=useState(()=>defaultStudySave(lessons));
  useEffect(()=>{setSave(readStudySave(lessons));},[lessons]);
  const contributors=new Set(game.completions.map(c=>c.player)).size;
  return <><GamePanelHeader eyebrow="A LITTLE DAILY MAGIC" title="Greenhouse quests">Small discoveries, shared growth.</GamePanelHeader>
    <ul className="room-quests">{dailyQuests(save,lessons).map(q=><li key={q.text}><span className="quest-check">{q.value>=q.max?<Check aria-label="Complete"/>:<Leaf aria-label="In progress"/>}</span><div><strong>{q.text}</strong><ProgressMeter value={q.value} max={q.max} label={q.text}/><small>{q.value} / {q.max} {q.unit}</small></div></li>)}</ul>
    <div className="garden-unlock"><Leaf/><div><strong>The Moonlight Bloom</strong><p>{contributors>=2?'Complete! Your Moonlight Flower is growing.':`${contributors} / 2 different gardeners have completed a lesson.`}</p></div></div>
    <p className="fineprint">Daily quests reset each day. Complete a new lesson to earn 20 garden energy.</p><button className="primary" onClick={onStudy}>Go to your study desk</button></>;
}
