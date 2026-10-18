import {scopedStorageKey} from '../lib/backend/storage-scope';
import {stageFor} from '../lib/movement';
import {CLASSMATE_NAMES} from '../lib/party';
import {CLASSMATE_QUIZ_NUTRIENTS,GROUP_QUIZ_PENALTY,classmateQuizId,logQuiz,planGroupQuizzes,type QuizLog} from '../lib/group-quizzes';
import {create} from 'zustand';
import {persist,createJSONStorage} from 'zustand/middleware';
export type Avatar={skin:string;hair:string;style:number;outfit:string;cut:number;accessory:string};
export const presets:Avatar[]=[{skin:'#e5b78d',hair:'#53372e',style:0,outfit:'#678f8d',cut:0,accessory:'None'},{skin:'#9c664d',hair:'#282126',style:2,outfit:'#b17d83',cut:1,accessory:'Glasses'},{skin:'#d29c73',hair:'#d8b166',style:1,outfit:'#8a85b7',cut:2,accessory:'Hat'},{skin:'#ba8261',hair:'#3e3039',style:4,outfit:'#af955c',cut:3,accessory:'Ribbon'}];
// `at` is set on new lessons so weekly totals can be computed; older saves omit it.
export type Completion={id:string;player:number;lesson:string;at?:number;/** Older saves omit it; those lessons paid 20. */nutrients?:number};
export type Theme='Classic'|'Stardew';
export const themes:Theme[]=['Classic','Stardew'];
export type MemberActivity='Online'|'Studying'|'Exploring'|'Idle'|'Taking a break';
export const memberActivities:MemberActivity[]=['Online','Studying','Exploring','Idle','Taking a break'];
/** Bumped when the simulated classmates came back, so saves from the solo-room builds start with everyone present. */
const ROSTER_VERSION=2;
type State={/** Set once the first-run welcome tour has been finished or skipped. */tourDone:boolean;cloud:boolean;sharedBloom:boolean;memberActivities:MemberActivity[];localActivity:MemberActivity;online:boolean[];rosterVersion:number;created:boolean;name:string;avatar:Avatar;course:string;studyTopic:string;level:string;goal:string;minutes:string;energy:number;nutrients:number;coins:number;completions:Completion[];/** Quizzes finished each quest day by anyone in the room. */quizLog:QuizLog;/** Last quest day whose group quiz goal has been checked. */quizSettledThrough:string;activity:string[];settings:{motion:boolean;audio:boolean;scale:string;graphics:string;theme:Theme};reaction:string;set:(v:Partial<State>)=>void;complete:(player:number,lesson:string,nutrients?:number,coins?:number)=>boolean;/** Takes gold from the wallet; false (and nothing spent) when the balance is too low. */spend:(amount:number)=>boolean;/** Credits due classmate quizzes and charges the tree for days the group fell short. */settleGroupQuizzes:(now?:Date)=>void;reset:()=>void};
const initial={tourDone:false,cloud:false,sharedBloom:false,memberActivities:['Idle','Studying','Online','Taking a break'] as MemberActivity[],localActivity:'Idle' as MemberActivity,online:[true,true,true,true],rosterVersion:ROSTER_VERSION,created:false,name:'Alex',avatar:presets[0],course:'',studyTopic:'',level:'Beginner',goal:'',minutes:'15',energy:60,nutrients:0,coins:0,completions:[] as Completion[],quizLog:{} as QuizLog,quizSettledThrough:'',activity:['The greenhouse is ready for a little magic.'],settings:{motion:true,audio:false,scale:'Comfortable',graphics:'Full',theme:'Stardew' as Theme},reaction:'idle'};
const memberName=(s:Pick<State,'name'>,player:number)=>player===0?s.name:CLASSMATE_NAMES[player-1]??'A gardener';
const validQuizLog=(value:unknown):value is QuizLog=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([day,entries])=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Array.isArray(entries)&&entries.every(e=>typeof e==='string'));
export const useGame=create<State>()(persist((set,get)=>({...initial,set:v=>set(v),
 complete:(player,lesson,nutrients=20,coins=0)=>{
  const s=get();if(s.cloud)return false;const id=`${player}:${lesson}`;
  // Replays still count toward today's group quiz goal; rewards are paid once per quiz.
  const quizLog=logQuiz(s.quizLog,player,lesson);
  if(s.completions.some(c=>c.id===id)){set({quizLog});return false;}
  set({quizLog,energy:s.energy+nutrients,nutrients:(s.nutrients||0)+nutrients,coins:(s.coins||0)+coins,completions:[...s.completions,{id,player,lesson,at:Date.now(),nutrients}],activity:[`${memberName(s,player)} finished a quiz. +${nutrients} nutrients`,...s.activity].slice(0,8),reaction:stageFor(s.energy+nutrients)>stageFor(s.energy)?'evolving':'celebrating'});return true;
 },
 spend:amount=>{const s=get();if(s.cloud||!Number.isFinite(amount)||amount<0||(s.coins||0)<amount)return false;set({coins:(s.coins||0)-amount});return true;},
 settleGroupQuizzes:(now=new Date())=>{
  const s=get();if(s.cloud)return;
  const classmates=s.online.flatMap((present,index)=>index>0&&present?[index]:[]);
  const plan=planGroupQuizzes({log:s.quizLog,settledThrough:s.quizSettledThrough,members:s.online.length,classmates,now});
  let {energy,quizLog,completions,activity}=s;const before=energy;
  for(const {day,member} of plan.classmateQuizzes){
   const lesson=classmateQuizId(day);
   quizLog={...quizLog,[day]:[...(quizLog[day]??[]),`${member}:${lesson}`]};
   if(!completions.some(c=>c.id===`${member}:${lesson}`)){energy+=CLASSMATE_QUIZ_NUTRIENTS;completions=[...completions,{id:`${member}:${lesson}`,player:member,lesson,at:now.getTime(),nutrients:CLASSMATE_QUIZ_NUTRIENTS}];}
   activity=[`${memberName(s,member)} finished a quiz. +${CLASSMATE_QUIZ_NUTRIENTS} nutrients`,...activity];
  }
  for(const {day,missing} of plan.penalties){
   const lost=Math.min(energy,missing*GROUP_QUIZ_PENALTY);energy-=lost;
   activity=[`The group was ${missing} ${missing===1?'quiz':'quizzes'} short on ${day}. The tree lost ${lost} nutrients`,...activity];
  }
  if(!plan.classmateQuizzes.length&&!plan.penalties.length&&plan.settledThrough===s.quizSettledThrough)return;
  set({energy,quizLog,completions,activity:activity.slice(0,8),quizSettledThrough:plan.settledThrough,...(energy>before&&stageFor(energy)>stageFor(before)?{reaction:'evolving'}:{})});
 },
 reset:()=>set({...initial})}),{name:'sproutbound-v1',storage:createJSONStorage(()=>({getItem:(k)=>{try{return localStorage.getItem(scopedStorageKey(k))}catch{return null}},setItem:(k,v)=>{try{localStorage.setItem(scopedStorageKey(k),v)}catch{}},removeItem:(k)=>{try{localStorage.removeItem(scopedStorageKey(k))}catch{}}})),skipHydration:true,merge:(saved,current)=>{const s=saved as Partial<State>|undefined;if(!s||typeof s.name!=='string'||typeof s.created!=='boolean'||typeof s.course!=='string'||!Array.isArray(s.activity)||!s.activity.every(a=>typeof a==='string')||!Array.isArray(s.completions)||!s.completions.every(c=>c&&typeof c.id==='string'&&typeof c.lesson==='string'&&Number.isInteger(c.player)&&c.player>=0&&c.player<4)||typeof s.energy!=='number'||!Number.isFinite(s.energy)||s.energy<0||!s.avatar||!['skin','hair','outfit'].every(k=>/^#[0-9a-f]{6}$/i.test(String(s.avatar?.[k as keyof Avatar])))||!Number.isInteger(s.avatar.style)||!Number.isInteger(s.avatar.cut)||typeof s.avatar.accessory!=='string'||!s.settings||typeof s.settings.motion!=='boolean'||typeof s.settings.audio!=='boolean')return current;/* Saves from before the tour belong to existing players, who skip it. */return {...current,...s,/* Only the local demo hydrates from this save; online accounts load from the server. */cloud:false,coins:typeof s.coins==='number'&&Number.isFinite(s.coins)&&s.coins>=0?s.coins:current.coins,quizLog:validQuizLog(s.quizLog)?s.quizLog:current.quizLog,quizSettledThrough:typeof s.quizSettledThrough==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.quizSettledThrough)?s.quizSettledThrough:current.quizSettledThrough,tourDone:typeof s.tourDone==='boolean'?s.tourDone:s.created,settings:{...current.settings,...s.settings,theme:themes.includes(s.settings.theme)?s.settings.theme:current.settings.theme},localActivity:'Idle',memberActivities:Array.isArray(s.memberActivities)&&s.memberActivities.length===4&&s.memberActivities.every(v=>memberActivities.includes(v))?s.memberActivities:current.memberActivities,rosterVersion:ROSTER_VERSION,online:s.rosterVersion===ROSTER_VERSION&&Array.isArray(s.online)&&s.online.length===4&&s.online.every(v=>typeof v==='boolean')?[true,...s.online.slice(1)]:current.online,reaction:'idle'};}}));
