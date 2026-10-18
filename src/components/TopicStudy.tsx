'use client';
import {useEffect,useRef,useState} from 'react';
import {useBackend} from './backend/BackendProvider';
import {createTopicStudyService} from '@/lib/backend/topic-study';
import {rpc} from '@/lib/backend/client';
import {useGame} from '@/store/game';
import StudyRewardIcon from './StudyRewardIcon';
import {type QuizLog} from '@/lib/topic-history';
import {difficulties,type Difficulty,type StudySession,type QuizResult} from '@/lib/study-quiz';
function PageArrow({back=false}:{back?:boolean}){return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true" style={back?{transform:'rotate(180deg)'}:undefined}><path d="M8 2h2v2h2v2h2v4h-2v2h-2v2H8v-2h2v-2H2V6h8V4H8z"/></svg>;}
export default function TopicStudy({subject,initialDifficulty,initialLog,onLogChange,onBusyChange,onGenerated}:{subject:string;initialDifficulty?:Difficulty;initialLog?:QuizLog;onLogChange?:(log:QuizLog)=>void;onBusyChange?:(busy:boolean)=>void;onGenerated:(session:StudySession)=>void}){
 const game=useGame(),backend=useBackend();
 const online=createTopicStudyService({invoke:backend.invoke,rpc:(name,args)=>rpc(backend.client!,name,args),world:()=>backend.lease?.greenhouse_id??null,refresh:backend.refresh});
 const [topic,setTopic]=useState(subject),[difficulty,setDifficulty]=useState<Difficulty>(initialDifficulty||(difficulties.includes(game.level as Difficulty)?game.level as Difficulty:'Beginner'));
 const [session,setSession]=useState<StudySession|null>(initialLog?.session||null),[answers,setAnswers]=useState<string[]>(initialLog?.answers||['','','','']),[answer,setAnswer]=useState(initialLog?.answer||''),[result,setResult]=useState<QuizResult|null>(initialLog?.result||null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const [page,setPage]=useState(initialLog?.page||0),[setup,setSetup]=useState(!initialLog);const heading=useRef<HTMLHeadingElement>(null);
 const saveLog=useRef(onLogChange);saveLog.current=onLogChange;
 useEffect(()=>{if(session)saveLog.current?.({session,answers,answer,result,page});},[session,answers,answer,result,page]);
 useEffect(()=>{onBusyChange?.(!!busy);},[busy,onBusyChange]);
 useEffect(()=>{if(!setup)heading.current?.focus();},[page,setup]);
 async function call(data:unknown){const response=await fetch('/api/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await response.text();let value;try{value=JSON.parse(body);}catch{throw new Error('The study server could not complete the request. Refresh the page and try again.');}if(!response.ok)throw new Error(value.error||'Study request failed. Please try again.');return value;}
 async function generate(){setBusy('Preparing your topic and difficulty…');setError('');try{const next:StudySession=await (backend.enabled?online.generate(topic,difficulty):call({action:'generate',topic,difficulty}));setSession(next);setResult(null);setAnswers(['','','','']);setAnswer('');setPage(0);setSetup(false);game.set({studyTopic:next.topic,level:next.difficulty});onGenerated(next);}catch(e){setError(e instanceof Error?e.message:'Could not generate your quiz.');}finally{setBusy('');}}
 async function grade(){if(!session)return;const missing=answers.findIndex(a=>!a);if(missing!==-1){setPage(missing);setError('Choose an answer for this question first.');return;}if(!answer.trim()){setPage(4);setError('Write your short answer first.');return;}setBusy('Checking your answers…');setError('');try{const graded=backend.enabled?await online.grade(session,answers,answer):null;const next:QuizResult=graded?.result??await call({action:'grade',id:session.id,session,answers,answer});if(graded){setSession(graded.session);onGenerated(graded.session);}setResult(next);setPage(5);if(!backend.enabled)game.complete(0,`gemini:${session.rewardId||session.id}`,next.nutrients,next.coins);}catch(e){setError(e instanceof Error?e.message:'Could not grade your quiz.');}finally{setBusy('');}}
 async function replay(){if(!session)return;setBusy('Reopening your saved quiz...');setError('');try{const next:StudySession=await (backend.enabled?online.replay(session):call({action:'replay',session}));setSession(next);setAnswers(['','','','']);setAnswer('');setResult(null);setPage(0);setSetup(false);onGenerated(next);}catch(e){setError(e instanceof Error?e.message:'Could not reopen this quiz.');}finally{setBusy('');}}
 const question=session&&page<4?session.quiz.multiple_choice[page]:null;
 const canAdvance=!!result||(page<4?!!answers[page]:!!answer.trim());
 const turn=(next:number)=>{setError('');setPage(next);};
 return <div className="topic-study paged-study">
 {setup&&<><p>Choose what you want to learn. Your quiz and flashcards will match your topic and difficulty.</p><form onSubmit={e=>{e.preventDefault();void generate();}}><label>Learning topic<input required maxLength={200} value={topic} disabled={!!busy} onChange={e=>setTopic(e.target.value)} placeholder="e.g. photosynthesis or Python loops"/></label><label>Difficulty<select value={difficulty} disabled={!!busy} onChange={e=>setDifficulty(e.target.value as Difficulty)}>{difficulties.map(d=><option key={d}>{d}</option>)}</select></label><button className="wood-button" disabled={!!busy||!topic.trim()}>{session?'Generate a new quiz':'Start studying'}</button></form>{session&&<button className="quiz-text-button" disabled={!!busy} onClick={()=>setSetup(false)}>Return to current quiz</button>}</>}
 {busy&&<p role="status">{busy}</p>}{error&&<p role="alert" className="study-error">{error}</p>}
 {session&&!setup&&<><div className="quiz-page-heading"><span>{session.topic} · {session.difficulty}</span></div>
 <h3 ref={heading} tabIndex={-1} className={`quiz-page-title ${page===5?'quiz-results-title':''}`}>{page===5?'Your results':`Question ${page+1} of 5`}</h3>
 <div className="quiz-page-content" key={`${session.id}:${page}`}>
 {page<5&&<form onSubmit={e=>{e.preventDefault();if(page===4)void grade();else if(canAdvance)turn(page+1);}}>
 {question?<fieldset disabled={!!busy||!!result}><legend>{question.question}</legend>{(['A','B','C','D'] as const).map(letter=><label className="quiz-choice" key={letter}><input type="radio" required name={`question-${page}`} checked={answers[page]===letter} onChange={()=>setAnswers(previous=>previous.map((v,n)=>n===page?letter:v))}/><span>{letter}. {question[letter]}</span></label>)}{result&&<p className="quiz-explanation">{result.correct[page]?'Correct.':'Not quite.'} {!session?.online&&<>Answer: {question.correct_answer}. </>}{question.explanation}</p>}</fieldset>:<fieldset disabled={!!busy||!!result}><legend>{session.quiz.short_answer.question}</legend><label>Your answer (one or two sentences)<textarea required maxLength={3000} value={answer} onChange={e=>setAnswer(e.target.value)}/></label>{result&&<p className="quiz-explanation">{result.correct[4]?'Correct.':'Not quite.'} {session.quiz.short_answer.correct_answer} {session.quiz.short_answer.explanation}</p>}</fieldset>}
 {page===4&&!result&&<button className="wood-button" disabled={!!busy||!canAdvance}>Check my answers</button>}
 </form>}
 {page===5&&result&&<div role="status" className="quiz-result"><h3>Your score: {result.score}/5</h3><p className="study-rewards"><span><StudyRewardIcon kind="nutrients"/> +{result.nutrients} nutrients</span><span><StudyRewardIcon kind="coins"/> +{result.coins} coins</span></p><p>Rewards are collected once per quiz. Flip back to review your answers or retry the same questions.</p><button className="wood-button" disabled={!!busy} onClick={()=>void replay()}>Answer this quiz again</button><button className="quiz-text-button" onClick={()=>setSetup(true)}>Study another topic</button></div>}
 </div>
 <nav className="quiz-page-turns" aria-label="Quiz pages"><button type="button" className="quiz-page-arrow" aria-label="Previous question" disabled={page===0||!!busy} onClick={()=>turn(page-1)}><PageArrow back/></button><span aria-live="polite">{page===5?'Results':`${page+1} / 5`}</span><button type="button" className="quiz-page-arrow" aria-label={page===4?'View results':'Next question'} disabled={!!busy||page===5||!canAdvance||(page===4&&!result)} onClick={()=>turn(page+1)}><PageArrow/></button></nav>
 </>}
 </div>;
}
