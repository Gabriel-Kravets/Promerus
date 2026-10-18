export function backendConfig(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url&&!key)return null;
 if(!url||!key)throw new Error('Both public Supabase configuration values are required.');
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)))throw new Error('Supabase requires HTTPS outside local development.');
 return {url:parsed.origin,key};
}
