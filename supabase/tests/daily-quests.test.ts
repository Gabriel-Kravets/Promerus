import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db:PGlite;
const issuer='https://dev-phu3idfk55gl1dkn.us.auth0.com/',aud='uiuwR5J2A8HJpHRTLyaoKsyDURhC2tMK';
const token='00000000-0000-0000-0000-000000000001';
async function scalar<T=unknown>(sql:string,args:unknown[]=[]){return (await db.query<{v:T}>(`select ${sql} as v`,args)).rows[0].v;}
async function clock(time:string){await scalar("set_config('sproutbound.test_now',$1,false)",[time]);}
async function as<T>(sub:string,run:()=>Promise<T>){
 await scalar("set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub,role:'authenticated'})]);await db.exec('set role authenticated');
 try{return await run();}finally{await db.exec('reset role');}
}
async function room(sub:string){await clock('2026-10-18T12:00:00Z');return as(sub,async()=>{await scalar('bootstrap_player()');return scalar<string>("create_greenhouse('Daily quest test')");});}
async function member(owner:string,sub:string,w:string){const invite=await as(owner,()=>scalar('issue_invite($1)',[w]));return as(sub,async()=>{const p=await scalar<{profile:{player_id:string}}>('bootstrap_player()');await scalar('join_greenhouse($1)',[invite]);return p.profile.player_id;});}
async function settle(){await clock('2026-10-20T04:02:00Z');return scalar<number>('settle_daily_quest_penalties()');}
async function balance(w:string){return scalar<number>('(select energy from greenhouses where id=$1)',[w]);}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.jwt() to authenticated,service_role;create schema realtime;create table realtime.messages(extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select on realtime.messages to authenticated;`);
 // Install every migration, then replace only the private clock in this disposable test database.
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  if(file==='202610180008_daily_quest_penalties.sql'){
   // The rollout date is deterministic; the policy table still follows the production SQL.
   const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
   await db.exec(sql.replace('select clock_timestamp()','select coalesce(nullif(current_setting(\'sproutbound.test_now\',true),\'\')::timestamptz,\'2026-10-18T12:00:00Z\'::timestamptz)'));
  }else await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 }
});
after(async()=>{await db.close();});
test('rollout and join day have no retroactive penalties; first complete day loses exactly ten',async()=>{
 const w=await room('daily|one');
 await clock('2026-10-19T04:02:00Z');await scalar('settle_daily_quest_penalties()');assert.equal(await balance(w),60);
 await settle();assert.equal(await balance(w),50);
 await scalar('settle_daily_quest_penalties()');assert.equal(await balance(w),50);
});
test('each inactive permanent member costs ten; visitors are exempt',async()=>{
 const w=await room('daily|owner');await member('daily|owner','daily|member',w);
 await as('daily|visitor',async()=>{await scalar('bootstrap_player()');});
 await settle();assert.equal(await balance(w),40);
 assert.equal(await scalar<number>('(select count(*)::integer from daily_quest_penalties where greenhouse_id=$1)',[w]),2);
});
test('three distinct Science reviews protect a player in all their rooms; duplicates do not count',async()=>{
 const w=await room('daily|reader'),w2=await room('daily|reader');
 await clock('2026-10-19T16:00:00Z');
 await as('daily|reader',async()=>{
  for(const card of [0,0,1])await scalar('record_daily_study($1,$2)', ['science_card',card]);
  assert.equal((await scalar<{science_cards:number}>('daily_quest_status()')).science_cards,2);
  await scalar('record_daily_study($1,$2)', ['science_card',2]);
 });
 await settle();assert.equal(await balance(w),60);assert.equal(await balance(w2),60);
});
test('only the missing member is penalized; completed progress is not shared between members',async()=>{
 const w=await room('daily|active');await member('daily|active','daily|absent',w);
 await clock('2026-10-19T15:00:00Z');await as('daily|active',async()=>{for(const c of [0,1,2])await scalar('record_daily_study($1,$2)',['science_card',c]);});
 await settle();assert.equal(await balance(w),50);
});
test('partial quests and multiple missed offline days accumulate once each, with no negative balance',async()=>{
 const w=await room('daily|offline');
 await clock('2026-10-19T15:00:00Z');await as('daily|offline',()=>scalar("record_daily_study('science_card',0)"));
 await clock('2026-10-29T04:02:00Z');await scalar('settle_daily_quest_penalties()');assert.equal(await balance(w),0);
 await scalar('settle_daily_quest_penalties()');assert.equal(await balance(w),0);
 assert.equal(await scalar<number>('(select count(*)::integer from daily_quest_penalties where greenhouse_id=$1)',[w]),10);
});
test('member removal retains full missed days but exempts the partial departure day',async()=>{
 const w=await room('daily|remove-owner'),p=await member('daily|remove-owner','daily|removed',w);
 await clock('2026-10-20T04:00:30Z');await as('daily|remove-owner',()=>scalar('remove_member($1,$2)',[w,p]));
 await settle();assert.equal(await balance(w),40);
 assert.equal(await scalar<number>('(select count(*)::integer from daily_quest_penalties where greenhouse_id=$1 and player_id=$2)',[w,p]),1);
});
test('focus uses server time and deduplicates simultaneous tabs, with no offline catch-up',async()=>{
 const w=await room('daily|focus');await clock('2026-10-19T16:00:00Z');
 await as('daily|focus',()=>scalar("record_daily_study('focus_start',null,$1)",[token]));
 for(let i=1;i<=40;i++){
  await clock(new Date(Date.parse('2026-10-19T16:00:00Z')+i*30000).toISOString());
  await as('daily|focus',async()=>{
   await scalar("record_daily_study('focus_tick',null,$1)",[token]);
   await scalar("record_daily_study('focus_tick',null,$1)",[token]);
  });
 }
 assert.equal((await as('daily|focus',()=>scalar<{focus_seconds:number}>('daily_quest_status()'))).focus_seconds,1200);
 await clock('2026-10-19T18:00:00Z');await as('daily|focus',()=>scalar("record_daily_study('focus_tick',null,$1)",[token]));
 assert.equal((await as('daily|focus',()=>scalar<{focus_seconds:number}>('daily_quest_status()'))).focus_seconds,1200);
 await settle();assert.equal(await balance(w),60);
});
test('focus intervals split across New York midnight, and status exposes the next server deadline',async()=>{
 await room('daily|midnight');await clock('2026-10-20T03:59:50Z');await as('daily|midnight',()=>scalar("record_daily_study('focus_start',null,$1)",[token]));
 await clock('2026-10-20T04:00:10Z');const s=await as('daily|midnight',()=>scalar<{day:string;focus_seconds:number;resets_at:string}>("record_daily_study('focus_stop',null,$1)",[token]));
 assert.equal(s.day,'2026-10-20');assert.equal(s.focus_seconds,10);assert.equal(Date.parse(s.resets_at),Date.parse('2026-10-21T04:00:00Z'));
});
test('clients cannot forge completion, dates, balances, or run the settlement job',async()=>{
 const w=await room('daily|secure');
 await as('daily|secure',async()=>{
  await assert.rejects(()=>scalar('settle_daily_quest_penalties()'),/permission denied/);
  await assert.rejects(()=>scalar("record_daily_study('lesson_completed')"),/Invalid quest action/);
  await assert.rejects(()=>scalar("record_daily_study('science_card',99)"),/Invalid Science card/);
  await assert.rejects(()=>db.exec("update private.daily_quest_progress set lesson_completed=true"),/permission denied/);
  await assert.rejects(()=>db.query('update greenhouses set energy=999 where id=$1',[w]),/permission denied/);
  await assert.rejects(()=>db.exec('insert into daily_quest_penalties default values'),/permission denied/);
 });
 await db.exec('set role anon');try{await assert.rejects(()=>scalar('daily_quest_status()'),/permission denied/);}finally{await db.exec('reset role');}
});

test('verified lessons protect the day, practice counts once, and future rewards preserve penalties',async()=>{
 const w=await room('daily|learner');
 const player=await as('daily|learner',()=>scalar<string>('private.actor()'));
 const content=Array.from({length:5},(_,i)=>({title:`Lesson ${i}`,text:'Roots absorb water.',questions:[{kind:'multiple_choice',prompt:'What do roots absorb?',options:['Water','Bees','Flowers','Seeds'],answer:'0',explanation:'Roots take up water.'}]}));
 const path=await scalar<string>("publish_learning_path($1,'Plants','plants','Beginner','authored',$2::jsonb)",[player,JSON.stringify(content)]);
 const lesson=await scalar<string>('(select id from lessons where path_id=$1 and ordinal=0)',[path]);
 const question=await scalar<string>('(select id from lesson_questions where lesson_id=$1)',[lesson]);
 await settle();assert.equal(await balance(w),50);
 const complete=async()=>{
  const attempt=await as('daily|learner',()=>scalar<string>('begin_attempt($1,$2,gen_random_uuid())',[lesson,w]));
  await as('daily|learner',()=>scalar('submit_multiple_choice($1,$2,$3)',[attempt,question,'0']));
  const result=await scalar<{rewarded:boolean}>('finalize_attempt($1)',[attempt]);return {attempt,result};
 };
 const first=await complete();assert.equal(first.result.rewarded,true);assert.equal(await balance(w),70);
 assert.equal((await as('daily|learner',()=>scalar<{lesson_completed:boolean}>('daily_quest_status()'))).lesson_completed,true);
 await clock('2026-10-21T16:00:00Z');
 await scalar('finalize_attempt($1)',[first.attempt]);
 assert.equal((await as('daily|learner',()=>scalar<{lesson_completed:boolean}>('daily_quest_status()'))).lesson_completed,false);
 assert.equal((await complete()).result.rewarded,false);
 assert.equal((await as('daily|learner',()=>scalar<{lesson_completed:boolean}>('daily_quest_status()'))).lesson_completed,true);
 assert.equal(await balance(w),70);
 await clock('2026-10-22T04:02:00Z');await scalar('settle_daily_quest_penalties()');assert.equal(await balance(w),70);
});
test('focus cannot credit long offline gaps or a second active browser token',async()=>{
 await room('daily|focus-gap');await clock('2026-10-19T16:00:00Z');await as('daily|focus-gap',()=>scalar("record_daily_study('focus_start',null,$1)",[token]));
 await clock('2026-10-19T16:00:10Z');
 await as('daily|focus-gap',()=>scalar("record_daily_study('focus_start',null,'00000000-0000-0000-0000-000000000002')"));
 const ten=await as('daily|focus-gap',()=>scalar<{focus_seconds:number}>("record_daily_study('focus_tick',null,$1)",[token]));assert.equal(ten.focus_seconds,10);
 await clock('2026-10-19T18:00:00Z');const after=await as('daily|focus-gap',()=>scalar<{focus_seconds:number}>("record_daily_study('focus_tick',null,$1)",[token]));assert.equal(after.focus_seconds,10);
});
test('new memberships start the next complete day and archived rooms are exempt',async()=>{
 const w=await room('daily|late-owner');await clock('2026-10-19T23:50:00-04:00');const p=await member('daily|late-owner','daily|late-member',w);
 await settle();assert.equal(await scalar<number>('(select count(*)::integer from daily_quest_penalties where greenhouse_id=$1 and player_id=$2)',[w,p]),0);
 await db.query('update greenhouses set archived=true where id=$1',[w]);await clock('2026-10-22T04:02:00Z');await scalar('settle_daily_quest_penalties()');assert.equal(await balance(w),50);
});
