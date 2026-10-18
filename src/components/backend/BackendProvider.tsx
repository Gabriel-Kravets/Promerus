'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {useAuth} from '../AuthGate';
import {useGame} from '@/store/game';
import {backendConfig} from '@/lib/backend/config';
import {createBackend,rpc,bootstrap,enterWorld,worldSnapshot} from '@/lib/backend/client';
import {profilePatchSchema,type BackendProfile,type SessionLease,type WorldSnapshot,type Bootstrap,type PlayerState,BackendError} from '@/lib/backend/contracts';
import {z} from 'zod';
import {DAILY_QUEST_REFRESH} from '@/lib/daily-quests';
import {scopedStorageKey,setPlayerStorageScope} from '@/lib/backend/storage-scope';

type Context={enabled:boolean;client:SupabaseClient|null;profile:BackendProfile|null;snapshot:WorldSnapshot|null;lease:SessionLease|null;economy:PlayerState|null;status:string;error:string;switchWorld:(id:string,takeover?:boolean)=>Promise<void>;saveProfile:(patch:unknown)=>Promise<void>;leaveWorld:()=>Promise<void>;refresh:()=>Promise<void>;invoke:<T>(action:string,payload:unknown)=>Promise<T>};
const unavailable=async()=>{throw new Error('Online greenhouse is not configured');};
const local:Context={enabled:false,client:null,profile:null,snapshot:null,lease:null,economy:null,status:'Local demo',error:'',switchWorld:unavailable,saveProfile:unavailable,leaveWorld:unavailable,refresh:async()=>{},invoke:unavailable};
const BackendContext=createContext<Context>(local);
export const useBackend=()=>useContext(BackendContext);
export default function BackendProvider({children}:{children:ReactNode}){
 const auth=useAuth(),authRef=useRef(auth);authRef.current=auth;
 let configValue:ReturnType<typeof backendConfig>=null,configError='';
 try{configValue=backendConfig();}catch(e){configError=(e as Error).message;}
 const client=useMemo(()=>configValue?createBackend(()=>authRef.current!.getToken()):null,[configValue?.url,configValue?.key]);
 const [profile,setProfile]=useState<BackendProfile|null>(null),[snapshot,setSnapshot]=useState<WorldSnapshot|null>(null),[lease,setLease]=useState<SessionLease|null>(null),[economy,setEconomy]=useState<PlayerState|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(configError),[status,setStatus]=useState('Connecting');
 const appearanceVersion=useRef(0),controller=useRef('');
 const current=useRef({profile,lease,snapshot});current.current={profile,lease,snapshot};
 const refresh=useCallback(async()=>{
  if(!client)return;
  const {profile,lease}=current.current;
  if(!profile)return;
  const {data:completions,error:completionError}=await client.from('lesson_completions').select('id,canonical_key').eq('player_id',profile.player_id);
  if(completionError)throw new BackendError(completionError.message,completionError.code);
  const world=lease?await worldSnapshot(client,lease.greenhouse_id):null;
  if(current.current.profile?.player_id!==profile.player_id||current.current.lease?.id!==lease?.id)return;
  const account=await rpc<PlayerState>(client,'player_state');
  if(current.current.profile?.player_id!==profile.player_id||current.current.lease?.id!==lease?.id)return;
  setEconomy(account);
  useGame.getState().set({coins:account.gold,nutrients:account.nutrients,completions:(completions??[]).map(c=>({id:c.id,player:0,lesson:c.canonical_key})),...(world?{energy:world.world.energy,sharedBloom:world.world.moonlight_bloom}:{})});
  window.dispatchEvent(new Event(DAILY_QUEST_REFRESH));
  if(world){const own=world.members.find(m=>m.player_id===profile.player_id);if(own&&own.appearance_version>appearanceVersion.current){appearanceVersion.current=own.appearance_version;useGame.getState().set({name:own.name,avatar:own.avatar});setProfile(p=>p?{...p,name:own.name}:p);}setSnapshot(world);}
 },[client]);
 const switchWorld=useCallback(async(id:string,takeover=false)=>{
  if(!client)throw new Error('Online mode is unavailable');
  setError('');const actor=current.current.profile?.player_id;const next=await enterWorld(client,id,takeover),world=await worldSnapshot(client,id);if(!actor||current.current.profile?.player_id!==actor)throw new BackendError('This session ended');
  current.current={...current.current,lease:next,snapshot:world};
  setLease(next);setSnapshot(world);setStatus('Connected');
  sessionStorage.setItem(`sproutbound-session:${current.current.profile!.player_id}`,JSON.stringify({id:next.id,controller:controller.current}));
  useGame.getState().set({energy:world.world.energy,sharedBloom:world.world.moonlight_bloom,localActivity:'Idle'});
 },[client]);
 const leaveWorld=useCallback(async()=>{if(!client)return;const old=current.current.lease;if(old)await rpc(client,'leave_session',{p_session:old.id});if(current.current.profile)sessionStorage.removeItem(`sproutbound-session:${current.current.profile.player_id}`);current.current.lease=null;current.current.snapshot=null;setLease(null);setSnapshot(null);setStatus('Choose a greenhouse');},[client]);
 const invoke=useCallback(async<T,>(action:string,payload:unknown):Promise<T>=>{
  if(!client)throw new Error('Online mode is unavailable');
  const {data,error}=await client.functions.invoke('game-api',{body:{action,payload}});
  if(error){let message='The server could not complete this request',details;try{const body=await error.context?.json();message=body?.error||message;details=body;}catch{}throw new BackendError(message,'backend_error',details);}
  if(data?.error)throw new BackendError(data.error);
  return data as T;
 },[client]);
 const saveProfile=useCallback(async(patch:unknown)=>{
  if(!client)throw new Error('Online mode is unavailable');
  const saved=await rpc<Bootstrap>(client,'save_profile',{p_patch:{...profilePatchSchema.parse(patch),appearanceVersion:appearanceVersion.current}});
  if(current.current.profile?.player_id!==saved.profile.player_id)throw new BackendError('This session ended');
  appearanceVersion.current=saved.appearance.version;current.current.profile=saved.profile;setProfile(saved.profile);
  useGame.getState().set({name:saved.profile.name,avatar:saved.appearance.avatar,created:saved.profile.onboarding_complete,level:saved.profile.level,goal:saved.profile.goal,minutes:saved.profile.minutes});
 },[client]);
 useEffect(()=>{
  if(!client)return;let cancelled=false;
  void(async()=>{
   try{
    const saved=await bootstrap(client);if(cancelled)return;
    setPlayerStorageScope(saved.profile.player_id);let preferences;try{const cached=JSON.parse(localStorage.getItem(scopedStorageKey('sproutbound-v1'))||'null');const parsed=z.object({motion:z.boolean(),audio:z.boolean(),scale:z.enum(['Comfortable','Large']),graphics:z.enum(['Full','Simple']),theme:z.enum(['Classic','Stardew']).default('Classic')}).safeParse(cached?.state?.settings);if(parsed.success)preferences=parsed.data;}catch{}useGame.getState().reset();
    useGame.getState().set({cloud:true,...(preferences?{settings:preferences}:{}),name:saved.profile.name,avatar:saved.appearance.avatar,created:saved.profile.onboarding_complete,level:saved.profile.level,goal:saved.profile.goal,minutes:saved.profile.minutes});
    appearanceVersion.current=saved.appearance.version;current.current.profile=saved.profile;setProfile(saved.profile);
    if(!window.name.startsWith('sproutbound-controller:'))window.name=`sproutbound-controller:${crypto.randomUUID()}`;controller.current=window.name;
    let stored:{id:string;controller:string}|null=null;try{stored=JSON.parse(sessionStorage.getItem(`sproutbound-session:${saved.profile.player_id}`)||'null');}catch{}
    if(stored?.controller===controller.current)try{
     const resumed=await rpc<SessionLease>(client,'heartbeat',{p_session:stored.id});if(cancelled)return;
     const world=await worldSnapshot(client,resumed.greenhouse_id);if(cancelled)return;
     current.current.lease=resumed;current.current.snapshot=world;setLease(resumed);setSnapshot(world);useGame.getState().set({energy:world.world.energy,sharedBloom:world.world.moonlight_bloom});
    }catch{sessionStorage.removeItem(`sproutbound-session:${saved.profile.player_id}`);}
    await refresh();if(!cancelled){setStatus('Connected');setReady(true);}
   }catch(e){if(!cancelled){setError((e as Error).message);setStatus('Connection unavailable');}}
  })();
  return()=>{cancelled=true;current.current={profile:null,lease:null,snapshot:null};setPlayerStorageScope('signed-out');useGame.getState().reset();};
 },[client,refresh]);
 useEffect(()=>{
  if(!client||!lease||!profile)return;
  let disposed=false,refreshing=false,again=false,retryDelay=500,retryTimer:ReturnType<typeof setTimeout>|undefined;
  const synchronize=async(renew=false)=>{
   if(disposed||current.current.lease?.id!==lease.id)return;if(refreshing){again=true;return;}refreshing=true;
   try{
    if(renew)await rpc(client,'heartbeat',{p_session:lease.id,p_activity:useGame.getState().localActivity});await refresh();
    if(!disposed){setStatus('Connected');setError('');retryDelay=500;}
   }catch(e){
    if(!disposed&&current.current.lease?.id===lease.id){
     setStatus('Reconnecting');setError((e as Error).message);
     if(e instanceof BackendError&&e.code==='42501'){setSnapshot(null);setLease(null);current.current.lease=null;current.current.snapshot=null;setStatus('Choose a greenhouse');}
     else{retryTimer=setTimeout(()=>void synchronize(true),retryDelay+Math.random()*250);retryDelay=Math.min(15000,retryDelay*2);}
    }
   }finally{refreshing=false;if(again&&!disposed){again=false;void synchronize();}}
  };
  const channel=client.channel(`world:${lease.greenhouse_id}:${snapshot?.world.access_epoch??1}`,{config:{private:true}})
   .on('postgres_changes',{event:'*',schema:'public',table:'room_sessions',filter:`greenhouse_id=eq.${lease.greenhouse_id}`},()=>void synchronize())
   .on('postgres_changes',{event:'*',schema:'public',table:'player_appearances'},()=>void synchronize())
   .on('postgres_changes',{event:'*',schema:'public',table:'greenhouses',filter:`id=eq.${lease.greenhouse_id}`},()=>void synchronize())
   .on('postgres_changes',{event:'*',schema:'public',table:'world_events',filter:`greenhouse_id=eq.${lease.greenhouse_id}`},event=>{
    const row=event.new as {id?:number;kind?:string;reaction?:string};if(row.id===undefined)return;const id=String(row.id);const key=`sproutbound-event:${profile.player_id}:${lease.greenhouse_id}`;
    const last=sessionStorage.getItem(key);if(!last||BigInt(id)>BigInt(last)){sessionStorage.setItem(key,id);if(row.kind!=='daily-penalty')useGame.getState().set({reaction:row.kind==='growth'?'evolving':row.kind==='sproutling'&&['happy','watering','sleeping'].includes(row.reaction??'')?row.reaction!:'celebrating'});}
    void synchronize();
   }).subscribe(state=>{if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')setStatus('Reconnecting');});
  const heartbeat=setInterval(()=>void synchronize(true),20000),onOnline=()=>{void client.realtime.setAuth().catch(()=>setStatus('Sign-in expired'));void synchronize(true);};
  window.addEventListener('online',onOnline);const visible=()=>{if(document.visibilityState==='visible')onOnline();};document.addEventListener('visibilitychange',visible);
  const activity=useGame.subscribe((next,previous)=>{if(next.localActivity!==previous.localActivity)void synchronize(true);});
  void synchronize(true);
  return()=>{disposed=true;clearInterval(heartbeat);clearTimeout(retryTimer);window.removeEventListener('online',onOnline);document.removeEventListener('visibilitychange',visible);activity();void client.removeChannel(channel);};
 },[client,lease?.id,profile?.player_id,snapshot?.world.access_epoch,refresh]);
 if(configError||client&&!ready)return <main className="boot" role="status"><p>{error||configError||'Opening your greenhouse account…'}</p>{(error||configError)&&<button className="secondary" onClick={()=>window.location.reload()}>Retry connection</button>}{(error||configError)&&<button className="text-button" onClick={()=>auth?.logout()}>Sign in again</button>}</main>;
 return <BackendContext.Provider value={client?{enabled:true,client,profile,snapshot,lease,economy,status,error,switchWorld,saveProfile,leaveWorld,refresh,invoke}:local}>{children}</BackendContext.Provider>;
}
