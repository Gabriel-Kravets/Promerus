/** Supports named platform keys and legacy projects without exposing either to the SPA. */
export function serverKeys(read:(name:string)=>string|undefined){
 const named=(name:string)=>{try{const data=JSON.parse(read(name)||'{}');return typeof data.default==='string'?data.default:undefined;}catch{return undefined;}};
 const url=read('SUPABASE_URL'),secret=read('SUPABASE_SECRET_KEY')||named('SUPABASE_SECRET_KEYS')||read('SUPABASE_SERVICE_ROLE_KEY'),publishable=read('SUPABASE_PUBLISHABLE_KEY')||named('SUPABASE_PUBLISHABLE_KEYS')||read('SUPABASE_ANON_KEY');
 if(!url||!secret||!publishable)throw new Error('Server configuration is incomplete');
 return {url,secret,publishable};
}
