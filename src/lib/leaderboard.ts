import type {Completion} from '@/store/game';
/** Monday 00:00 local time of the week containing `now`. */
export function weekStart(now=Date.now()){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d.getTime();}
export function daysUntilReset(now=Date.now()){return Math.ceil((weekStart(now)+7*864e5-now)/864e5);}
export type LeaderboardRow={index:number;name:string;energy:number;rank:number};
/** 20 energy for every timestamped lesson completed since Monday, highest first. */
export function weeklyLeaderboard(names:string[],completions:Completion[],now=Date.now()):LeaderboardRow[]{
 const start=weekStart(now);
 const rows=names.map((name,index)=>({index,name,energy:completions.filter(c=>c.player===index&&c.at!==undefined&&c.at>=start&&c.at<=now).length*20}));
 rows.sort((a,b)=>b.energy-a.energy||a.index-b.index);
 // Ties share a rank (1, 2, 2, 4).
 return rows.map(row=>({...row,rank:rows.findIndex(r=>r.energy===row.energy)+1}));
}
