export type OnlineStudyTime={day:string;seconds:number;lastEnd:number};
export const ONLINE_TIME_KEY='sproutbound-online-time';
export const ONLINE_TIME_EVENT='sproutbound:online-time';
const dayOf=(time:number)=>new Date(time).toLocaleDateString('en-CA');
export function advanceOnlineTime(previous:OnlineStudyTime|null,from:number,to:number):OnlineStudyTime{
 const day=dayOf(to),midnight=new Date(to);midnight.setHours(0,0,0,0);
 const current=previous?.day===day?previous:{day,seconds:0,lastEnd:midnight.getTime()};
 const start=Math.max(from,current.lastEnd,midnight.getTime());
 return {day,seconds:current.seconds+Math.max(0,to-start)/1000,lastEnd:Math.max(to,current.lastEnd)};
}
export function readOnlineStudyTime():OnlineStudyTime|null{
 try{const v=JSON.parse(localStorage.getItem(ONLINE_TIME_KEY)||'null');return v&&typeof v.day==='string'&&Number.isFinite(v.seconds)&&v.seconds>=0&&Number.isFinite(v.lastEnd)?v:null;}catch{return null;}
}
export function onlineSecondsToday(){const saved=readOnlineStudyTime();return saved?.day===dayOf(Date.now())?Math.floor(saved.seconds):0;}
export function formatStudyTime(seconds:number){seconds=Math.max(0,Math.floor(seconds));return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');}
