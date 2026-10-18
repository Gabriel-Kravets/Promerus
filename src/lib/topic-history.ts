import {difficulties,validQuiz,type Difficulty,type StudySession,type QuizResult} from './study-quiz';
export type QuizLog={session:StudySession;answers:string[];answer:string;result:QuizResult|null;page:number};
export type TopicHistoryEntry={topic:string;difficulty:Difficulty;studiedAt:number;log?:QuizLog};
export const TOPICS_PER_PAGE=6;
export const MAX_TOPIC_HISTORY=TOPICS_PER_PAGE*3;
const key='sproutbound-topic-history';
export function readTopicHistory():TopicHistoryEntry[]{
 try{const value:unknown=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter((v):v is TopicHistoryEntry=>!!v&&typeof v.topic==='string'&&!!v.topic.trim()&&v.topic.length<=200&&difficulties.includes(v.difficulty)&&Number.isFinite(v.studiedAt)).slice(0,MAX_TOPIC_HISTORY).map(v=>({...v,log:validLog(v.log)?v.log:undefined})):[];}catch{return [];}
}
export function validLog(value:unknown):value is QuizLog{
 const v=value as QuizLog;
 return !!v&&!!v.session&&typeof v.session.id==='string'&&typeof v.session.topic==='string'&&difficulties.includes(v.session.difficulty)&&validQuiz(v.session.quiz)&&Array.isArray(v.answers)&&v.answers.length===4&&v.answers.every(a=>['','A','B','C','D'].includes(a))&&typeof v.answer==='string'&&v.answer.length<=3000&&Number.isInteger(v.page)&&v.page>=0&&v.page<=5&&(v.result===null||(!!v.result&&Number.isInteger(v.result.score)&&v.result.score>=0&&v.result.score<=5&&Array.isArray(v.result.correct)&&v.result.correct.length===5&&v.result.correct.every(a=>typeof a==='boolean')&&Number.isFinite(v.result.nutrients)&&Number.isFinite(v.result.coins)))&&(v.page!==5||v.result!==null);
}
export function updateQuizLog(history:TopicHistoryEntry[],log:QuizLog){
 const next=history.map(entry=>entry.log?.session.id===log.session.id?{...entry,log}:entry);
 try{localStorage.setItem(key,JSON.stringify(next));}catch{}
 return next;
}
export function rememberTopic(history:TopicHistoryEntry[],entry:TopicHistoryEntry){
 const next=[{...entry,topic:entry.topic.trim()},...history.filter(v=>v.topic.trim().toLowerCase()!==entry.topic.trim().toLowerCase()||v.difficulty!==entry.difficulty)].slice(0,MAX_TOPIC_HISTORY);
 try{localStorage.setItem(key,JSON.stringify(next));}catch{}
 return next;
}
