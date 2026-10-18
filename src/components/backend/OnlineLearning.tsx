'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,Check,Leaf,Lock,Sparkles,Code2,Calculator,Globe,FlaskConical,PenLine,Palette} from 'lucide-react';
import {useBackend} from './BackendProvider';
import {useGame} from '@/store/game';
import {courses} from '@/lib/courses';
import {stageFor} from '@/lib/movement';
import {rpc} from '@/lib/backend/client';
import type {OnlinePath,OnlineLesson,GradeFeedback} from '@/lib/backend/contracts';
export default function OnlineLearning({onBack}:{onBack:()=>void}){
 const state=useGame();
 const subjects=[['Programming','python',Code2],['Mathematics','algebra',Calculator],['Languages','spanish',Globe],['Science','Science',FlaskConical],['Writing','Writing',PenLine],['Art','Art',Palette]] as const;
 const backend=useBackend(),[paths,setPaths]=useState<OnlinePath[]>([]),[pathId,setPathId]=useState(''),[view,setView]=useState('path'),[lesson,setLesson]=useState<OnlineLesson|null>(null),[attempt,setAttempt]=useState(''),[index,setIndex]=useState(-1),[answer,setAnswer]=useState(''),[feedback,setFeedback]=useState<GradeFeedback|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[topic,setTopic]=useState('python'),[custom,setCustom]=useState(''),[difficulty,setDifficulty]=useState(backend.profile?.level||'Beginner'),[goal,setGoal]=useState(backend.profile?.goal||''),[minutes,setMinutes]=useState(backend.profile?.minutes||'15'),[job,setJob]=useState<string|null>(null),[reward,setReward]=useState(false);
 const request=useRef(crypto.randomUUID()),alive=useRef(true),jobStarted=useRef(0);
 const load=async()=>{const rows=await rpc<OnlinePath[]>(backend.client!,'learning_snapshot');setPaths(rows);return rows;};
 useEffect(()=>{alive.current=true;void load().then(rows=>{if(!alive.current)return;if(rows.length)setPathId(rows[rows.length-1].id);else setView('setup');}).catch(e=>setNotice(e.message));return()=>{alive.current=false;};},[backend.client]);
 useEffect(()=>{
  if(!job)return;let cancelled=false,inflight=false;
  const poll=async()=>{
   if(inflight)return;inflight=true;
   try{
    const result=await backend.invoke<{state:string;path_id:string|null;error_code:string|null}>('job',{requestId:job});if(cancelled)return;
    if(result.state==='succeeded'){const rows=await load();if(cancelled)return;setPathId(result.path_id||rows[rows.length-1]?.id||'');setView('path');setJob(null);setBusy(false);}
    else if(result.state==='failed'){setJob(null);setBusy(false);setView('setup');setNotice('Course generation is unavailable. Retry later or choose an authored course.');}
    else if(Date.now()-jobStarted.current>120000){setNotice('Your course is still being prepared. You can return later and check again.');setBusy(false);}
   }catch(e){if(!cancelled){setNotice((e as Error).message);setBusy(false);}}finally{inflight=false;}
  };
  const timer=setInterval(()=>void poll(),2000);void poll();return()=>{cancelled=true;clearInterval(timer);};
 },[job,backend.client]);
 const act=async(work:()=>Promise<void>)=>{setBusy(true);setNotice('');try{await work();}catch(e){setNotice((e as Error).message);}finally{if(alive.current)setBusy(false);}};
 const generate=(source:'authored'|'gemini')=>void act(async()=>{
  request.current=crypto.randomUUID();jobStarted.current=Date.now();
  await backend.saveProfile({level:difficulty,goal,minutes});
  const generated=await backend.invoke<{state:string;path_id?:string}>('generate',{topic:source==='authored'?topic:custom.trim()||topic,difficulty,goal,minutes,requestId:request.current,source});
  if(generated.state==='succeeded'&&generated.path_id){await load();setPathId(generated.path_id);setView('path');return;}
  setJob(request.current);setView('loading');
 });
 const begin=(next:OnlineLesson)=>void act(async()=>{
  if(!backend.lease)throw new Error('Enter a greenhouse as a member before studying for shared nutrients.');
  const id=await rpc<string>(backend.client!,'begin_attempt',{p_lesson:next.id,p_world:backend.lease.greenhouse_id,p_key:crypto.randomUUID()});
  setLesson(next);setAttempt(id);setIndex(-1);setAnswer('');setFeedback(null);setView('lesson');
 });
 const path=paths.find(p=>p.id===pathId),question=lesson?.questions[index];
 const check=()=>void act(async()=>{
  if(!question)return;
  const result=question.kind==='multiple_choice'?await rpc<GradeFeedback>(backend.client!,'submit_multiple_choice',{p_attempt:attempt,p_question:question.id,p_answer:answer}):await backend.invoke<GradeFeedback>('short-answer',{attempt,question:question.id,answer});
  setFeedback(result);
 });
 const next=()=>void act(async()=>{
  if(!lesson)return;
  if(index<lesson.questions.length-1){setIndex(index+1);setAnswer('');setFeedback(null);return;}
  const result=await backend.invoke<{rewarded:boolean;energy:number}>('finish',{attempt});setReward(result.rewarded);await backend.refresh();await load();setView('results');
 });
 return <section className="learning"><header className="study-header"><button className="text-button" onClick={onBack}><ArrowLeft size={17}/> Back to greenhouse</button><span className="brand-small"><Leaf size={19}/> SPROUTBOUND <span>/ THE STUDY NOOK</span></span><span className="study-energy"><Leaf size={16}/>{state.energy} nutrients</span></header><div className="study-layout"><main className="study-main">
 {notice&&<p className="online-learning-notice" role="status">{notice}</p>}
 {!backend.lease&&<p className="online-learning-notice">Choose a greenhouse first to earn shared nutrients. Your previous learning paths remain saved.</p>}
 {view==='loading'&&<div className="loading-state"><Sparkles size={45}/><h1>Planting possibilities…</h1><p>Your personalized course is being prepared on the server.</p><button className="text-button" onClick={()=>setView('path')}>View saved paths</button></div>}
 {view==='setup'&&<><span className="eyebrow">A NEW CHAPTER BEGINS</span><h1>What will you<br/><em>grow today?</em></h1><p className="lead">Choose a curiosity. We’ll give it a little room to bloom.</p><div className="subjects">{subjects.map(([name,key,Icon])=><button className={topic===key&&!custom?'selected':''} key={key} onClick={()=>{setTopic(key);setCustom('');}}><Icon size={26}/><span>{name}</span>{topic===key&&!custom&&<Check size={15}/>}</button>)}</div><label>Your own curiosity<input maxLength={200} value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Or describe something you’d love to learn…"/></label><div className="form-row"><label>Experience<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{['Beginner','Intermediate','Advanced'].map(x=><option key={x}>{x}</option>)}</select></label><label>Daily time<select value={minutes} onChange={e=>setMinutes(e.target.value)}>{['5','15','30'].map(x=><option value={x} key={x}>{x} minutes</option>)}</select></label></div><label>Your learning goal<input value={goal} maxLength={500} onChange={e=>setGoal(e.target.value)}/></label><button className="primary" disabled={busy} onClick={()=>generate(custom.trim()||!Object.hasOwn(courses,topic)?'gemini':'authored')}>Plant my learning journey <ArrowRight size={17}/></button><p className="fineprint">Authored courses stay introductory. Generated courses adapt to your preferences and require the learning service. All online rewards are verified by the server.</p>{paths.length>0&&<button className="text-button" onClick={()=>setView('path')}>Back to saved paths</button>}</>}
 {view==='path'&&<><span className="eyebrow">YOUR LEARNING JOURNEY</span><h1>{path?.title||'A new path awaits'}</h1><p className="lead">Five small steps. Something wonderful at the end.</p>{paths.length>0&&<label>Saved learning journeys<select className="online-path-select" value={pathId} onChange={e=>setPathId(e.target.value)}>{paths.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}<div className="path-list">{path?.lessons.map((l,i)=>{const locked=i>0&&!path.lessons[i-1].completed;return <button className={`path-node ${l.completed?'complete':''}`} disabled={locked||busy||!backend.lease} key={l.id} onClick={()=>begin(l)}><span className="node-circle">{l.completed?<Check/>:locked?<Lock/>:<BookOpen/>}</span><span><small>CHAPTER 0{i+1} · {l.completed?'COMPLETE':locked?'LOCKED':'READY TO GROW'}</small><strong>{l.title}</strong></span><ArrowRight size={18}/></button>;})}</div><button className="text-button" onClick={()=>setView('setup')}>Explore another subject</button></>}
 {view==='lesson'&&lesson&&<><button className="text-button" onClick={()=>setView('path')}><ArrowLeft size={17}/> Your learning path</button><span className="eyebrow">CHAPTER 0{lesson.ordinal+1} · {index<0?'DISCOVER':`QUESTION ${index+1} OF ${lesson.questions.length}`}</span><h1>{lesson.title}</h1><div className="quiz-progress">{lesson.questions.map((_,n)=><span key={n} className={n<=index?'active':''}/>)}</div>{index<0?<><article className="parchment"><span className="eyebrow">A SEED OF KNOWLEDGE</span><h2>{lesson.title}</h2><p className="lesson-text">{lesson.text}</p></article><button className="primary" onClick={()=>setIndex(0)}>Let’s practice <ArrowRight size={18}/></button></>:question&&<><article className="parchment"><small>LET YOUR KNOWLEDGE TAKE ROOT</small><h2>{question.prompt}</h2></article>{question.kind==='multiple_choice'?<div className="answers">{question.options?.map((option,i)=><button className={`${answer===String(i)?'selected':''} ${feedback?.correct&&answer===String(i)?'correct':''}`} key={i} disabled={busy||!!feedback} onClick={()=>setAnswer(String(i))}><span>{String.fromCharCode(65+i)}</span>{option}{feedback?.correct&&answer===String(i)&&<Check size={19}/>}</button>)}</div>:<label>Your answer<textarea className="online-short-answer" maxLength={4000} value={answer} disabled={busy||!!feedback} onChange={e=>setAnswer(e.target.value)} placeholder="One or two thoughtful sentences…"/></label>}{feedback&&<div className={`feedback ${feedback.correct?'success':''}`} role="status"><strong>{feedback.correct?'Beautifully done. A little more growth.':'Every attempt is part of growing.'}</strong><p>{feedback.explanation}</p></div>}{!feedback?<button className="primary" disabled={busy||!answer.trim()} onClick={check}>{busy?'Checking…':'Check answer'}</button>:feedback.correct?<button className="primary" disabled={busy} onClick={next}>{index===lesson.questions.length-1?'Collect your reward':'Next question'}</button>:<button className="primary" onClick={()=>{setAnswer('');setFeedback(null);}}>Try again</button>}</>}</>}
 {view==='results'&&<div className="results"><div className="reward-icon"><Leaf size={45}/></div><h1>You grew something<br/><em>wonderful.</em></h1><div className="reward"><Sparkles/>{reward?'+20 shared nutrients':'Practice complete'}<small>{reward?'Verified and saved to the greenhouse where you began.':'This lesson’s reward was already collected.'}</small></div><button className="primary" onClick={onBack}>Return to greenhouse</button><button className="text-button" onClick={()=>setView('path')}>Keep learning</button></div>}
 </main><aside className="study-companion"><div className="hanging-lantern">✧</div><span className="eyebrow">YOUR QUIET CHEERLEADER</span><div className="speech">{view==='results'?'Look at you grow!':!!feedback&&!feedback.correct?'Mistakes help us put down roots.':"Every big skill starts with a small seed."}</div><div className={`pixel-companion ${stageFor(state.energy)>0?"evolved":""}`} role="img" aria-label="Sproutling, your little leaf-topped companion"/><div className="companion-ground"/><h3>One small step at a time.</h3><p>There’s no rush here.<br/>Just you, a little curiosity, and a growing garden.</p><div className="study-note"><Leaf size={18}/><span>Every new lesson nourishes<br/>your shared greenhouse.</span></div></aside></div></section>;
}
