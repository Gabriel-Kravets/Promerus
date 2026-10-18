'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useBackend} from './BackendProvider';
import {rpc} from '@/lib/backend/client';
import {DAILY_QUEST_REFRESH,type DailyQuestStatus,type QuestActivity} from '@/lib/daily-quests';
type Context={online:boolean;status:DailyQuestStatus|null;error:string;record:(action:QuestActivity,card?:number,token?:string)=>Promise<void>};
const DailyContext=createContext<Context>({online:false,status:null,error:'',record:async()=>{}});
export const useDailyQuests=()=>useContext(DailyContext);
export default function DailyQuestProvider({children}:{children:ReactNode}){
 const {enabled,client,profile}=useBackend();
 const [status,setStatus]=useState<DailyQuestStatus|null>(null),[error,setError]=useState('');
 const actor=useRef(profile?.player_id);actor.current=profile?.player_id;
 const accept=useCallback((next:DailyQuestStatus,player:string)=>{if(actor.current===player){setStatus(old=>old&&old.day>next.day?old:old?.day===next.day?{...next,science_cards:Math.max(old.science_cards,next.science_cards),focus_seconds:Math.max(old.focus_seconds,next.focus_seconds),lesson_completed:old.lesson_completed||next.lesson_completed}:next);setError('');}},[]);
 const refresh=useCallback(async()=>{
  if(!client||!profile)return;const player=profile.player_id;
  try{accept(await rpc<DailyQuestStatus>(client,'daily_quest_status'),player);}catch{if(actor.current===player)setError('Daily quest progress could not sync. Reconnect to confirm completion.');}
 },[client,profile?.player_id,accept]);
 const record=useCallback(async(action:QuestActivity,card?:number,token?:string)=>{
  if(!client||!profile)return;const player=profile.player_id;
  try{accept(await rpc<DailyQuestStatus>(client,'record_daily_study',{p_action:action,p_card:card??null,p_token:token??null}),player);}catch{if(actor.current===player)setError('Daily quest progress could not sync. Reconnect to confirm completion.');}
 },[client,profile?.player_id,accept]);
 useEffect(()=>{
  setStatus(null);setError('');if(!enabled||!profile)return;
  void refresh();const timer=setInterval(()=>void refresh(),30000),update=()=>void refresh();
  window.addEventListener(DAILY_QUEST_REFRESH,update);window.addEventListener('online',update);window.addEventListener('focus',update);
  return()=>{clearInterval(timer);window.removeEventListener(DAILY_QUEST_REFRESH,update);window.removeEventListener('online',update);window.removeEventListener('focus',update);};
 },[enabled,profile?.player_id,refresh]);
 return <DailyContext.Provider value={{online:enabled,status,error,record}}>{children}</DailyContext.Provider>;
}
// Focus is credited using server time; background/offline gaps and concurrent tabs cannot multiply it.
export function useDailyFocus(running:boolean){
 const {online,record}=useDailyQuests();
 useEffect(()=>{
  if(!online||!running)return;const token=crypto.randomUUID();let active=false;
  let queue=Promise.resolve();const send=(action:QuestActivity)=>{queue=queue.then(()=>record(action,undefined,token));};
  const update=()=>{const visible=document.visibilityState==='visible'&&document.hasFocus()&&navigator.onLine;
   if(visible){send(active?'focus_tick':'focus_start');active=true;}else if(active){send('focus_stop');active=false;}
  };
  update();const timer=setInterval(update,15000);
  document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);window.addEventListener('blur',update);window.addEventListener('online',update);window.addEventListener('offline',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);window.removeEventListener('blur',update);window.removeEventListener('online',update);window.removeEventListener('offline',update);if(active)send('focus_stop');};
 },[online,running,record]);
}
