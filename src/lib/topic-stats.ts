import type {QuizLog,TopicHistoryEntry} from './topic-history';
export type TopicStats={topic:string;lessons:number;seconds:number;questions:number;flashcards:number;events:string[]};
const key='sproutbound-topic-stats';
export function addTopicActivity(stats:TopicStats[],topic:string,activity:{seconds?:number;event?:string;kind?:'lessons'|'questions'|'flashcards'}):TopicStats[]{
 topic=topic.trim();if(!topic)return stats;
 const index=stats.findIndex(s=>s.topic.toLowerCase()===topic.toLowerCase());
 const row:TopicStats=index<0?{topic,lessons:0,seconds:0,questions:0,flashcards:0,events:[]}:stats[index];
 if(activity.event&&row.events.includes(activity.event))return stats;
 const next={...row,seconds:row.seconds+Math.max(0,activity.seconds||0),events:activity.event?[...row.events,activity.event]:row.events};
 if(activity.kind)next[activity.kind]++;
 return index<0?[...stats,next]:stats.map((s,i)=>i===index?next:s);
}
export function recordQuizActivity(stats:TopicStats[],log:QuizLog){
 log.answers.forEach((answer,i)=>{if(answer)stats=addTopicActivity(stats,log.session.topic,{kind:'questions',event:`question:${log.session.id}:${i}`});});
 if(log.answer.trim())stats=addTopicActivity(stats,log.session.topic,{kind:'questions',event:`question:${log.session.id}:4`});
 if(log.result)stats=addTopicActivity(stats,log.session.topic,{kind:'lessons',event:`lesson:${log.session.id}`});
 return stats;
}
export function readTopicStats(history:TopicHistoryEntry[]=[]):TopicStats[]{
 let stats:TopicStats[]=[];
 try{const raw=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(raw))stats=raw.filter(s=>s&&typeof s.topic==='string'&&['lessons','seconds','questions','flashcards'].every(k=>Number.isFinite(s[k])&&s[k]>=0)&&Array.isArray(s.events)&&s.events.every((e:unknown)=>typeof e==='string'));}catch{}
 for(const entry of history)if(entry.log)stats=recordQuizActivity(stats,entry.log);
 return stats;
}
export function writeTopicStats(stats:TopicStats[]){try{localStorage.setItem(key,JSON.stringify(stats));}catch{}}
export function mostStudiedTopics(stats:TopicStats[]){return stats.filter(s=>s.lessons||s.seconds||s.questions||s.flashcards).slice().sort((a,b)=>b.lessons-a.lessons||b.seconds-a.seconds||b.questions+b.flashcards-a.questions-a.flashcards||a.topic.localeCompare(b.topic)).slice(0,3);}
