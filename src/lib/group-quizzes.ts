import {questDay,QUEST_TIME_ZONE} from './daily-quests';

/** Quizzes logged per quest day, as `${member}:${quizId}`. Each quiz counts once per day. */
export type QuizLog=Record<string,string[]>;
/** Nutrients the shared tree loses for each quiz the group is short at midnight. */
export const GROUP_QUIZ_PENALTY=15;
/** Nutrients a simulated classmate's daily quiz adds to the tree. */
export const CLASSMATE_QUIZ_NUTRIENTS=20;
/** Days missed while the greenhouse was closed that still count; older days are forgiven. */
export const MAX_CATCH_UP_DAYS=7;
/** Chance (out of 100) that a simulated classmate skips their quiz on a given day. */
const CLASSMATE_SKIP_PERCENT=20;

/** The group needs one quiz per member every day. */
export const requiredQuizzes=(members:number)=>Math.max(1,members);

export function addDays(day:string,days:number){
 const [y,m,d]=day.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}
function minutesIntoDay(at:Date){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:QUEST_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
 const part=(type:string)=>Number(parts.find(p=>p.type===type)?.value??0);
 return part('hour')*60+part('minute');
}
function hash(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

/** Minute of the quest day when a simulated classmate finishes their quiz, or null if they skip that day. */
export function classmateQuizMinute(day:string,member:number):number|null{
 const h=hash(`${day}:${member}`);
 if(h%100<CLASSMATE_SKIP_PERCENT)return null;
 return 9*60+Math.floor(h/100)%(12*60);
}
export const classmateQuizId=(day:string)=>`classmate-quiz:${day}`;

export function logQuiz(log:QuizLog,member:number,quizId:string,now=new Date()):QuizLog{
 const today=questDay(now),entry=`${member}:${quizId}`,keep=addDays(today,-MAX_CATCH_UP_DAYS-1);
 const next=Object.fromEntries(Object.entries(log).filter(([day])=>day>=keep));
 const entries=next[today]??[];
 if(!entries.includes(entry))next[today]=[...entries,entry];
 return next;
}
export const quizzesOn=(log:QuizLog,day:string)=>new Set(log[day]??[]).size;

export type GroupQuizPlan={classmateQuizzes:{day:string;member:number}[];penalties:{day:string;missing:number}[];settledThrough:string};
/**
 * Works out what happened since the last check: classmate quizzes that are now due,
 * and finished days where the group did fewer quizzes than it has members.
 * `classmates` are the simulated members who are around to study.
 */
export function planGroupQuizzes({log,settledThrough,members,classmates,now=new Date()}:{log:QuizLog;settledThrough:string;members:number;classmates:readonly number[];now?:Date}):GroupQuizPlan{
 const today=questDay(now),minute=minutesIntoDay(now),oldest=addDays(today,-MAX_CATCH_UP_DAYS);
 let day=settledThrough?addDays(settledThrough,1):today;
 if(day<oldest)day=oldest;
 const classmateQuizzes:GroupQuizPlan['classmateQuizzes']=[],penalties:GroupQuizPlan['penalties']=[];
 for(;day<=today;day=addDays(day,1)){
  const done=new Set(log[day]??[]);
  for(const member of classmates){
   const at=classmateQuizMinute(day,member),entry=`${member}:${classmateQuizId(day)}`;
   if(at===null||done.has(entry)||day===today&&minute<at)continue;
   done.add(entry);classmateQuizzes.push({day,member});
  }
  const missing=requiredQuizzes(members)-done.size;
  if(day<today&&missing>0)penalties.push({day,missing});
 }
 const yesterday=addDays(today,-1);
 return {classmateQuizzes,penalties,settledThrough:settledThrough>yesterday?settledThrough:yesterday};
}
