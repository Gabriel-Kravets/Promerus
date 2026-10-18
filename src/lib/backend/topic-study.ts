import type {Difficulty,StudySession,QuizResult} from '../study-quiz';
import type {OnlinePath,OnlineLesson,GradeFeedback} from './contracts';

type Services={invoke:<T>(action:string,payload:unknown)=>Promise<T>;rpc:<T>(name:string,args?:Record<string,unknown>)=>Promise<T>;world:()=>string|null;refresh:()=>Promise<void>;wait?:()=>Promise<void>};
export type OnlineStudySession={lesson:string;attempt:string;questions:string[]};
export function createTopicStudyService(service:Services){
 const begin=async(lesson:OnlineLesson,topic:string,difficulty:Difficulty):Promise<StudySession>=>{
  const world=service.world();if(!world)throw new Error('Enter a greenhouse before starting a shared lesson.');
  const mc=lesson.questions.filter(q=>q.kind==='multiple_choice'),short=lesson.questions.find(q=>q.kind==='short_answer');
  if(mc.length!==4||!short)throw new Error('This saved lesson is not a five-question topic quiz.');
  const attempt=await service.rpc<string>('begin_attempt',{p_lesson:lesson.id,p_world:world,p_key:crypto.randomUUID()});
  // Private answer keys stay on the server. The online UI displays graded feedback,
  // never the local-demo answer-key fields required by the existing book model.
  return {id:attempt,topic,difficulty,online:{lesson:lesson.id,attempt,questions:[...mc.map(q=>q.id),short.id]},quiz:{multiple_choice:mc.map(q=>({question:q.prompt,A:q.options?.[0]??'',B:q.options?.[1]??'',C:q.options?.[2]??'',D:q.options?.[3]??'',correct_answer:'A',explanation:''})),short_answer:{question:short.prompt,correct_answer:'',explanation:'',grading_criteria:''}}};
 };
 const savedLesson=async(id:string)=>{const paths=await service.rpc<OnlinePath[]>('learning_snapshot');const lesson=paths.flatMap(p=>p.lessons).find(l=>l.id===id);if(!lesson)throw new Error('Saved lesson is unavailable for this account.');return lesson;};
 return {
  async generate(topic:string,difficulty:Difficulty){
   if(!service.world())throw new Error('Enter a greenhouse before starting a shared lesson.');
   const requestId=crypto.randomUUID();let job=await service.invoke<{state:string;path_id?:string|null;error_code?:string|null}>('generate',{topic,difficulty,goal:'',minutes:'15',requestId,source:'gemini'});
   for(let i=0;job.state!=='succeeded'&&job.state!=='failed'&&i<60;i++){await(service.wait?.()??new Promise(resolve=>setTimeout(resolve,2000)));job=await service.invoke('job',{requestId});}
   if(job.state!=='succeeded'||!job.path_id)throw new Error('Course generation is unavailable or still running. Please try again later.');
   const paths=await service.rpc<OnlinePath[]>('learning_snapshot'),path=paths.find(p=>p.id===job.path_id),lesson=path?.lessons.find(l=>!l.completed)??path?.lessons[0];
   if(!lesson)throw new Error('Generated lesson is not available yet.');return begin(lesson,topic,difficulty);
  },
  async replay(session:StudySession){if(!session.online)throw new Error('Generate an online quiz to earn shared nutrients.');return begin(await savedLesson(session.online.lesson),session.topic,session.difficulty);},
  async grade(session:StudySession,answers:string[],answer:string):Promise<{result:QuizResult;session:StudySession}>{
   if(!session.online)throw new Error('This browser quiz is not an authenticated lesson. Generate an online quiz first.');
   const lesson=await savedLesson(session.online.lesson),ids=[...lesson.questions.filter(q=>q.kind==='multiple_choice').map(q=>q.id),...lesson.questions.filter(q=>q.kind==='short_answer').map(q=>q.id)];
   if(ids.length!==5||ids.some((id,i)=>id!==session.online!.questions[i]))throw new Error('Lesson questions changed. Reopen the saved lesson.');
   const feedback:GradeFeedback[]=[];
   for(let i=0;i<4;i++)feedback.push(await service.rpc('submit_multiple_choice',{p_attempt:session.online.attempt,p_question:ids[i],p_answer:String(['A','B','C','D'].indexOf(answers[i]))}));
   feedback.push(await service.invoke('short-answer',{attempt:session.online.attempt,question:ids[4],answer}));
   const correct=feedback.map(f=>f.correct),score=correct.filter(Boolean).length;
   let nutrients=0;if(score===5){const result=await service.invoke<{rewarded:boolean}>('finish',{attempt:session.online.attempt});nutrients=result.rewarded?20:0;}
   await service.refresh();
   return {result:{score,correct,nutrients,coins:0},session:{...session,quiz:{multiple_choice:session.quiz.multiple_choice.map((q,i)=>({...q,explanation:feedback[i].explanation})),short_answer:{...session.quiz.short_answer,explanation:feedback[4].explanation}}}};
  }
 };
}
