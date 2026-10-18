'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {advanceOnlineTime,readOnlineStudyTime,onlineSecondsToday,ONLINE_TIME_EVENT,ONLINE_TIME_KEY} from '@/lib/online-study-time';
function subscribe(update:()=>void){window.addEventListener(ONLINE_TIME_EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(ONLINE_TIME_EVENT,update);window.removeEventListener('storage',update);};}
export function useOnlineStudySeconds(){return useSyncExternalStore(subscribe,onlineSecondsToday,()=>0);}
export default function OnlineStudyTime(){
 useEffect(()=>{
  let last=Date.now();let counting=document.visibilityState==='visible'&&navigator.onLine;
  const tick=()=>{
   const now=Date.now();
   if(counting){const next=advanceOnlineTime(readOnlineStudyTime(),Math.max(last,now-2000),now);try{localStorage.setItem(ONLINE_TIME_KEY,JSON.stringify(next));}catch{}}
   last=now;counting=document.visibilityState==='visible'&&navigator.onLine;
   window.dispatchEvent(new Event(ONLINE_TIME_EVENT));
  };
  const timer=setInterval(tick,1000);
  document.addEventListener('visibilitychange',tick);window.addEventListener('online',tick);window.addEventListener('offline',tick);window.addEventListener('pagehide',tick);
  return()=>{tick();clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('online',tick);window.removeEventListener('offline',tick);window.removeEventListener('pagehide',tick);};
 },[]);
 return null;
}
