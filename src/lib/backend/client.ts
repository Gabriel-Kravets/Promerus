import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {backendConfig} from './config';
import {BackendError,type Bootstrap,type WorldSnapshot,type SessionLease} from './contracts';
export function createBackend(getToken:()=>Promise<string>){
 const config=backendConfig();
 if(!config)return null;
 return createClient(config.url,config.key,{accessToken:getToken,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function rpc<T>(client:SupabaseClient,name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await client.rpc(name,args);
 if(error)throw new BackendError(error.message,error.code);
 return data as T;
}
export const bootstrap=(client:SupabaseClient)=>rpc<Bootstrap>(client,'bootstrap_player');
export async function worldSnapshot(client:SupabaseClient,id:string){const start=Date.now();const data=await rpc<WorldSnapshot>(client,'world_snapshot',{p_world:id});return {...data,clockOffset:Date.parse(data.server_time)-(start+Date.now())/2};}
export const enterWorld=(client:SupabaseClient,id:string,takeover=false)=>rpc<SessionLease>(client,'enter_greenhouse',{p_world:id,p_takeover:takeover});
