// One calendar shared by every room member, including across daylight-saving changes.
export const QUEST_TIME_ZONE='America/New_York';
export const DAILY_PENALTY=10;
export const DAILY_QUEST_REFRESH='sproutbound:daily-quests-refresh';
export type DailyQuestStatus={day:string;resets_at:string;time_zone:string;science_cards:number;focus_seconds:number;lesson_completed:boolean;penalties_start_on:string;eligible_from?:string|null;last_penalty?:{day:string;amount:number;greenhouse_name:string}|null};
export type QuestActivity='science_card'|'focus_start'|'focus_tick'|'focus_stop';
export function questDay(at=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:QUEST_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);}
export function hasDailyQuest(status:Pick<DailyQuestStatus,'science_cards'|'focus_seconds'|'lesson_completed'>){return status.science_cards>=3||status.focus_seconds>=1200||status.lesson_completed;}
export function onlineDailyQuests(status:DailyQuestStatus){return [
 {text:'Review 3 Science cards',value:Math.min(status.science_cards,3),max:3,unit:'cards'},
 {text:'Focus for 20 minutes',value:Math.min(20,Math.floor(status.focus_seconds/60)),max:20,unit:'min'},
 {text:'Complete a lesson',value:status.lesson_completed?1:0,max:1,unit:'lesson'}
];}

export function nextQuestReset(at=new Date()){
 const day=questDay(at);let low=at.getTime(),high=low+36*60*60*1000;
 while(high-low>1){const middle=Math.floor((low+high)/2);if(questDay(new Date(middle))===day)low=middle;else high=middle;}
 return new Date(high);
}

export function dailyQuestNotice(online:boolean,status:DailyQuestStatus|null,error:string){
 if(!online)return `Online rooms lose ${DAILY_PENALTY} nutrients per member who misses every daily quest.`;
 if(error)return error;
 if(!status)return 'Confirming today’s quest progress…';
 if(status.eligible_from===null)return 'Join a greenhouse to share a tree. Visitors are not penalized.';
 if(status.eligible_from&&status.day<status.eligible_from)return `Daily penalties begin with quests for ${status.eligible_from}.`;
 if(hasDailyQuest(status))return 'Your shared trees are protected from your daily penalty today.';
 return `Complete any one quest today. Each member who misses all quests costs the shared tree ${DAILY_PENALTY} nutrients.`;
}
