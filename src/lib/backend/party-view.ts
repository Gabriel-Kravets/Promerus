import type {RoomMember} from './contracts';
import type {LeaderboardRow} from '../leaderboard';
export function orderedRoomMembers(members:RoomMember[],ownId?:string){
 return members.slice().sort((a,b)=>Number(b.player_id===ownId)-Number(a.player_id===ownId)||Number(b.online)-Number(a.online)||(a.slot??99)-(b.slot??99)||a.player_id.localeCompare(b.player_id)).slice(0,4);
}
export function rankContributions(rows:Omit<LeaderboardRow,'rank'>[]):LeaderboardRow[]{
 const ranked=rows.slice().sort((a,b)=>b.energy-a.energy||a.index-b.index);
 return ranked.map(row=>({...row,rank:ranked.findIndex(r=>r.energy===row.energy)+1}));
}
