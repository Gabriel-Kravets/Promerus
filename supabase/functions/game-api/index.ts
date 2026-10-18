import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {createRemoteJWKSet} from 'jose';
import {z} from 'zod';
import {serverKeys} from '../../../src/lib/backend/server-keys.ts';
import {readJsonBody,PayloadTooLarge} from '../../../src/lib/backend/request-body.ts';
import {verifyPlayerToken} from '../../../src/lib/backend/verify-token.ts';
import {positionSchema} from '../../../src/lib/backend/contracts.ts';
import {generatedCourse,generationInput,courseInstructions,gradingInstructions,geminiJson,generationFailureCode} from '../../../src/lib/backend/generation.ts';
import {studyStations} from '../../../src/lib/world-layout.ts';
import {unusedDesks} from '../../../src/lib/room-fixtures.ts';
import {validMovement} from '../../../src/lib/backend/movement-validation.ts';
import {applyLayoutCommand,parseRoomLayout,withRoomGeometry,layoutCommand} from '../../../src/lib/backend/room-layout.ts';
import {distance} from '../../../src/lib/movement.ts';
import {courses} from '../../../src/lib/courses.ts';

declare const EdgeRuntime:{waitUntil:(work:Promise<unknown>)=>void};
const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error('Server configuration is incomplete');return value;};
const issuer=required('AUTH0_ISSUER'),audience=required('AUTH0_CLIENT_ID');
if(!issuer.startsWith('https://')||!issuer.endsWith('/'))throw new Error('Invalid Auth0 issuer configuration');
const jwks=createRemoteJWKSet(new URL('.well-known/jwks.json',issuer));
const keys=serverKeys(name=>Deno.env.get(name));
const admin=createClient(keys.url,keys.secret,{auth:{persistSession:false,autoRefreshToken:false}});
const allowedOrigins=new Set(required('APP_ORIGINS').split(',').map(v=>v.trim()));
async function rpc<T>(client:SupabaseClient,fn:string,args:Record<string,unknown>={}):Promise<T>{const {data,error}=await client.rpc(fn,args);if(error)throw new Error(error.message);return data as T;}
const uuid=z.uuid();
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')??'',headers={'Content-Type':'application/json','Vary':'Origin',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowedOrigins.has(origin))return reply({error:'Origin is not permitted'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 let token:string;
 try{const match=req.headers.get('Authorization')?.match(/^Bearer (.+)$/);if(!match)return reply({error:'Sign-in required'},401);token=match[1];await verifyPlayerToken(token,issuer,audience,jwks);}catch{return reply({error:'Your sign-in expired or could not be verified'},401);}
 try{
  const input=await readJsonBody(req);
  const body=z.object({action:z.enum(['move','layout','generate','job','short-answer','finish']),payload:z.unknown()}).strict().parse(input);
  const user=createClient(keys.url,keys.publishable,{accessToken:async()=>token,auth:{persistSession:false,autoRefreshToken:false}});
  const boot=await rpc<{profile:{player_id:string}}>(user,'bootstrap_player'),actor=boot.profile.player_id;
  await rpc(user,'consume_api_quota',{p_kind:'request'});
  if(body.action==='layout'){
   const p=z.object({session:uuid,expectedVersion:z.number().int().nonnegative(),command:layoutCommand}).strict().parse(body.payload);
   const {data:session}=await admin.from('room_sessions').select('greenhouse_id').eq('id',p.session).eq('player_id',actor).gt('lease_until',new Date().toISOString()).maybeSingle();
   if(!session)return reply({error:'Session unavailable'},403);
   const [{data:world},{data:members,error:memberError},{data:occupants,error:occupantError}]=await Promise.all([
    admin.from('greenhouses').select('room_layout,room_layout_version').eq('id',session.greenhouse_id).eq('archived',false).maybeSingle(),
    admin.from('greenhouse_memberships').select('player_id').eq('greenhouse_id',session.greenhouse_id),
    admin.from('room_sessions').select('x,y').eq('greenhouse_id',session.greenhouse_id).gt('lease_until',new Date().toISOString())]);
   if(memberError||occupantError||!world||!members?.some(m=>m.player_id===actor))return reply({error:'Membership required'},403);
   if(world.room_layout_version!==p.expectedVersion)return reply({error:'Room layout changed; reload before editing'},409);
   try{
    const layout=applyLayoutCommand(world.room_layout,members.map(m=>m.player_id),p.command,occupants??[]);
    if(p.command.kind==='initialize'&&JSON.stringify(layout)===JSON.stringify(world.room_layout))return reply({layout,layout_version:world.room_layout_version});
    if(p.command.kind==='buy')return reply(await rpc(admin,'commit_purchased_layout',{p_player:actor,p_world:session.greenhouse_id,p_expected_version:p.expectedVersion,p_layout:layout,p_item:p.command.type,p_key:crypto.randomUUID()}));
    return reply(await rpc(admin,'commit_room_layout',{p_player:actor,p_world:session.greenhouse_id,p_expected_version:p.expectedVersion,p_layout:layout}));
   }catch(error){
    const known=['Room collection is full','Room item unavailable','Keep the whole item inside the greenhouse.','This spot overlaps solid furniture. Drag to a clear spot.','Leave space around gardeners and the Sproutling.','Keep the carpet clear of built-in fixtures and the garden bed.'];
    return reply({error:error instanceof Error&&known.includes(error.message)?error.message:'Room layout changed or is unavailable. Reload before editing.'},409);
   }
  }
  if(body.action==='move'){
   const {session,...movement}=z.object({session:uuid,...positionSchema.shape}).strict().parse(body.payload);
   const {data:s,error}=await admin.from('room_sessions').select('id,player_id,greenhouse_id,x,y,sequence,moved_at').eq('id',session).eq('player_id',actor).maybeSingle();
   if(error||!s)return reply({error:'Session unavailable'},403);
   if(movement.sequence<=s.sequence)return reply(s);
   const [{data:layoutWorld,error:layoutError},{count:memberCount,error:countError}]=await Promise.all([
    admin.from('greenhouses').select('room_layout,room_layout_version').eq('id',s.greenhouse_id).maybeSingle(),
    admin.from('greenhouse_memberships').select('player_id',{count:'exact',head:true}).eq('greenhouse_id',s.greenhouse_id)]);
   if(layoutError||countError||!layoutWorld)return reply({error:'Session unavailable'},403);
   if(layoutWorld.room_layout&&movement.layoutVersion!==layoutWorld.room_layout_version)return reply({error:'Room layout changed; reload before editing',position:{x:s.x,y:s.y}},409);
   const layout=layoutWorld.room_layout?parseRoomLayout(layoutWorld.room_layout,[]):null,unused=unusedDesks(memberCount??0);
   const valid=()=>validMovement({x:s.x,y:s.y},movement,(Date.now()-Date.parse(s.moved_at))/1000);
   if(!(layout?withRoomGeometry(layout,valid,unused):valid()))return reply({error:'Please choose a clear floor destination',position:{x:s.x,y:s.y}},409);
   if(movement.seat>=0&&!(()=>{const station=studyStations[movement.seat],id=`fixture:${station.id}`,at=layout?.fixturePositions[id]??station.position;if(layout?.storedFixtures.includes(id)||unused.includes(id))return false;return [station.seat,...station.alternatives].map(p=>{const dx=p.x-station.position.x,dy=p.y-station.position.y;return {x:at.x+('mirrored' in at&&at.mirrored?dy:dx),y:at.y+('mirrored' in at&&at.mirrored?dx:dy)};}).some(p=>distance(p,movement)<30);})())return reply({error:'Choose an accessible chair',position:{x:s.x,y:s.y}},409);
   try{return reply(await rpc(admin,'apply_movement',{p_player:actor,p_session:session,p_x:movement.x,p_y:movement.y,p_facing:movement.facing,p_sequence:movement.sequence,p_activity:movement.activity,p_seat:movement.seat,p_previous_sequence:s.sequence}));}
   catch{return reply({error:'Movement could not be accepted',position:{x:s.x,y:s.y}},409);}
  }
  if(body.action==='job'){
   const payload=z.object({requestId:uuid}).strict().parse(body.payload);
   // The actor-scoped RPC never returns someone else's job.
   return reply(await rpc(user,'generation_job',{p_key:payload.requestId}));
  }
  if(body.action==='generate'){
   const input=generationInput.parse(body.payload);
   if(input.source==='authored'){
    if(!Object.hasOwn(courses,input.topic))return reply({error:'Choose an available authored subject'},400);
    const authored=courses[input.topic],lessons=authored.lessons.map(l=>({title:l.title,text:l.text,questions:l.questions.map(q=>({kind:'multiple_choice',prompt:q.prompt,options:q.options,answer:String(q.answer),explanation:q.explanation}))}));
    const path=await rpc<string>(admin,'publish_learning_path',{p_player:actor,p_title:authored.title,p_topic:input.topic,p_difficulty:'Beginner',p_source:'authored',p_lessons:lessons});
    return reply({state:'succeeded',path_id:path});
   }
   const job=await rpc<{id:string;state:string;path_id:string|null}>(user,'generation_job',{p_key:input.requestId});
   if(job.state!=='pending')return reply(job);
   if(!await rpc<boolean>(admin,'claim_generation',{p_job:job.id}))return reply(job,202);
   try{await rpc(user,'consume_api_quota',{p_kind:'generation'});}catch{await rpc(admin,'finish_generation',{p_job:job.id,p_path:null,p_error:'generation_quota'});return reply({error:'Your generation limit has been reached'},429);}
   const work=async()=>{
    try{
     let course:{title:string;lessons:unknown[]};
     const model=Deno.env.get('GEMINI_MODEL')||'gemini-3.8-flash';
     const generated=await geminiJson(required('GEMINI_API_KEY'),model,courseInstructions,{topic:input.topic,difficulty:input.difficulty,goal:input.goal,minutes:input.minutes},z.toJSONSchema(generatedCourse));
     course=generatedCourse.parse(generated);
     const path=await rpc<string>(admin,'publish_generation',{p_job:job.id,p_title:course.title,p_topic:input.topic,p_difficulty:input.difficulty,p_source:input.source,p_lessons:course.lessons});
     // Publishing commits the course and job result in one database transaction.
     void path;
    }catch(error){const code=generationFailureCode(error);console.warn('Course generation failed',code);await rpc(admin,'finish_generation',{p_job:job.id,p_path:null,p_error:code});}
   };
   EdgeRuntime.waitUntil(work());return reply(job,202);
  }
  if(body.action==='short-answer'){
   const p=z.object({attempt:uuid,question:uuid,answer:z.string().trim().min(1).max(4000)}).strict().parse(body.payload);
   const context=await rpc<{player_id:string;status:string;kind:string;prompt:string;answer:string;rubric:string;explanation:string}|null>(admin,'grading_context',{p_attempt:p.attempt,p_question:p.question});
   if(!context||context.player_id!==actor||context.status!=='open'||context.kind!=='short_answer')return reply({error:'Attempt unavailable'},403);
   await rpc(user,'consume_api_quota',{p_kind:'grading'});
   try{
    const schema=z.object({is_correct:z.boolean()}).strict();
    const grade=schema.parse(await geminiJson(required('GEMINI_API_KEY'),Deno.env.get('GEMINI_MODEL')||'gemini-3.8-flash',gradingInstructions,{question:context.prompt,reference_answer:context.answer,grading_criteria:context.rubric,student_answer:p.answer},z.toJSONSchema(schema)));
    return reply(await rpc(admin,'record_short_grade',{p_attempt:p.attempt,p_question:p.question,p_answer:p.answer,p_correct:grade.is_correct}));
   }catch{return reply({error:'Grading is pending. Your answer was not awarded credit; please retry.'},503);}
  }
  const p=z.object({attempt:uuid}).strict().parse(body.payload);
  const {data:attempt,error}=await admin.from('lesson_attempts').select('id,player_id').eq('id',p.attempt).eq('player_id',actor).maybeSingle();
  if(error||!attempt)return reply({error:'Attempt unavailable'},403);
  return reply(await rpc(admin,'finalize_attempt',{p_attempt:p.attempt}));
 }catch(error){
  // No raw provider responses, JWTs, credentials, or private student answers in logs.
  if(error instanceof PayloadTooLarge)return reply({error:'Request is too large'},413);
  if(error instanceof z.ZodError)return reply({error:'Please check the supplied fields'},400);
  const message=error instanceof Error?error.message:'Request unavailable';
  const safe=['All answers must be verified correct','Membership revoked; study answers remain saved','Session expired','Movement is too fast','Request limit reached','Insufficient balance','Room item unavailable','Gardener not found','Friend request unavailable'];
  return reply({error:safe.includes(message)?message:'This request could not be completed. Please retry.'},400);
 }
});
