'use client';
import {useEffect,useState} from 'react';
import {useBackend} from '@/components/backend/BackendProvider';
import {useGame,presets,type MemberActivity} from '@/store/game';
import {memberStatus} from '@/lib/party';
import {weekStart,weeklyLeaderboard,type LeaderboardRow} from '@/lib/leaderboard';
import {orderedRoomMembers,rankContributions,partyNames} from '@/lib/backend/party-view';

/** Data adapter for main's existing roster, leaderboard and social renderers. */
export function useWorldParty(){
 const backend=useBackend(),state=useGame();
 const members=orderedRoomMembers(backend.snapshot?.members??[],backend.profile?.player_id);
 const names=backend.enabled?partyNames(members,backend.profile?.name||state.name):[state.name,'Maya','Kai','Jules'];
 const online=backend.enabled?members.map(m=>m.online):state.online;
 return {backend,members,names,online,
  avatar:(i:number)=>backend.enabled?members[i]?.avatar??state.avatar:i===0?state.avatar:presets[i],
  status:(i:number,panel=''):MemberActivity|'Offline'=>backend.enabled?(!members[i]?.online?'Offline':i===0?memberStatus(state,0,panel):members[i].activity):memberStatus(state,i,panel),
  energy:(i:number)=>backend.enabled?backend.snapshot?.contributions.find(c=>c.player_id===members[i]?.player_id)?.energy??0:state.completions.filter(c=>c.player===i).length*20,
 };
}
export function useWorldLeaderboard(){
 const party=useWorldParty(),state=useGame();
 const [totals,setTotals]=useState<Record<string,number>>({}),[notice,setNotice]=useState('');
 const {backend}=party,world=backend.snapshot?.world;
 useEffect(()=>{
  if(!backend.client||!world)return;let active=true;setTotals({});setNotice('Loading verified weekly contributions…');
  void backend.client.from('energy_ledger').select('player_id,amount').eq('greenhouse_id',world.id).gte('created_at',new Date(weekStart()).toISOString()).then(({data,error})=>{
   if(!active)return;
   if(error){setTotals({});setNotice('Weekly contributions are unavailable.');return;}
   const totals:Record<string,number>={};for(const row of data??[])totals[row.player_id]=(totals[row.player_id]??0)+row.amount;
   setTotals(totals);setNotice('Verified greenhouse contributions this week');
  });
  return()=>{active=false;};
 },[backend.client,world?.id,world?.version]);
 const rows:LeaderboardRow[]=backend.enabled?rankContributions(party.members.map((member,index)=>({index,name:member.name,energy:totals[member.player_id]??0}))):weeklyLeaderboard(party.names,state.completions);
 return {...party,rows,notice};
}
