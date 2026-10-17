export type RoomSave={date:string;seen:string[];focusSeconds:number;lessonBaseline:number;duration:number;seconds:number;endAt:number|null};
export const studyDay=()=>new Date().toLocaleDateString('en-CA');
export function defaultStudySave(lessons:number):RoomSave {
  return {date:studyDay(),seen:[],focusSeconds:0,lessonBaseline:lessons,duration:25,seconds:1500,endAt:null};
}
export function readStudySave(lessons:number):RoomSave {
  const fallback=defaultStudySave(lessons);
  try {
    const raw=JSON.parse(localStorage.getItem('sproutbound-study-room')||'null');
    if(!raw||!Array.isArray(raw.seen)||!raw.seen.every((v:unknown)=>typeof v==='string')||!Number.isFinite(raw.duration)||raw.duration<1||raw.duration>60||!Number.isFinite(raw.seconds)||raw.seconds<0||!Number.isFinite(raw.focusSeconds)||raw.focusSeconds<0||(raw.endAt!==null&&!Number.isFinite(raw.endAt)))return fallback;
    const seconds=raw.endAt?Math.max(0,Math.ceil((raw.endAt-Date.now())/1000)):raw.seconds;
    return {...raw,seconds,endAt:seconds>0?raw.endAt:null,lessonBaseline:Number.isInteger(raw.lessonBaseline)?raw.lessonBaseline:lessons,...(raw.date!==studyDay()?{date:studyDay(),seen:[],focusSeconds:0,lessonBaseline:lessons}:{})};
  } catch {return fallback;}
}
export function dailyQuests(save:RoomSave,lessons:number) {
  const science=new Set(save.seen.filter(x=>x.startsWith('Science:'))).size;
  return [
    {text:'Review 3 Science cards',value:Math.min(science,3),max:3,unit:'cards'},
    {text:'Focus for 20 minutes',value:Math.min(20,Math.floor(save.focusSeconds/60)),max:20,unit:'min'},
    {text:'Complete a lesson',value:Math.min(1,Math.max(0,lessons-save.lessonBaseline)),max:1,unit:'lesson'}
  ];
}
