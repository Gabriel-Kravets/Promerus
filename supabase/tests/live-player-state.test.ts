import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {shopCatalog} from '../../src/lib/shop.ts';

let db:PGlite;
const issuer='https://dev-phu3idfk55gl1dkn.us.auth0.com/',aud='uiuwR5J2A8HJpHRTLyaoKsyDURhC2tMK';
async function as(subject:string,run:()=>Promise<void>){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub:subject,role:'authenticated'})]);
 await db.exec('set role authenticated');
 try{await run();}finally{await db.exec('reset role');}
}
async function scalar<T>(sql:string,args:unknown[]=[]){return (await db.query<{value:T}>(`select ${sql} as value`,args)).rows[0].value;}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.jwt() to authenticated,service_role;`);
 await db.exec(`create schema realtime;create table realtime.messages(extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select on realtime.messages to authenticated;insert into realtime.messages values('broadcast');`);
 for(const file of ['202610170001_identity_worlds.sql','202610170002_learning_rewards.sql','202610170003_live_sessions.sql','202610170004_membership_lifecycle.sql','202610180005_four_permanent_members.sql','202610180006_world_membership_counts.sql','202610180007_shared_room_layout.sql','202610180008_daily_quest_penalties.sql','202610180009_live_player_state.sql'])
  await db.exec(await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
});
after(async()=>{await db.close();});

test('server shop prices match the existing catalog',async()=>{
 const sql=await readFile(new URL('../migrations/202610180009_live_player_state.sql',import.meta.url),'utf8');
 for(const item of shopCatalog)assert.match(sql,new RegExp(`when '${item.type}' then ${item.price}`));
});

let alice='',bob='',code='';
test('daily login is UTC, idempotent, and clients cannot forge a balance',async()=>{
 await as('auth0|economy-alice',async()=>{
  alice=(await scalar<{profile:{player_id:string}}>('bootstrap_player()')).profile.player_id;
  const first=await scalar<{gold:number;nutrients:number;login:{streak:number};resets_in_seconds:number}>('player_state()');
  const second=await scalar<typeof first>('player_state()');
  assert.equal(first.gold,5);assert.equal(first.nutrients,10);assert.equal(first.login.streak,1);
  const {resets_in_seconds:firstReset,...firstRest}=first,{resets_in_seconds:secondReset,...secondRest}=second;
  assert.deepEqual(secondRest,firstRest);
  assert.ok(Math.abs(secondReset-firstReset)<=1);
  await assert.rejects(()=>db.query('update player_wallets set gold=9999 where player_id=$1',[alice]),/permission denied/);
  await assert.rejects(()=>db.query("insert into currency_ledger(player_id,kind,amount,balance_after,idempotency_key,reason) values($1,'gold',100,100,gen_random_uuid(),'forged')",[alice]),/permission denied/);
 });
 assert.equal((await db.query("select * from currency_ledger where reason='daily-login' and player_id=$1",[alice])).rows.length,2);
});

test('a missed UTC day resets the streak and does not repeat yesterday’s reward',async()=>{
 await as('auth0|economy-streak',async()=>{
  const player=(await scalar<{profile:{player_id:string}}>('bootstrap_player()')).profile.player_id;
  await db.exec('reset role');
  await db.query('insert into login_days(player_id,day,streak) values($1,private.utc_day()-2,6)',[player]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub:'auth0|economy-streak',role:'authenticated'})]);
  await db.exec('set role authenticated');
  const state=await scalar<{login:{streak:number};gold:number}>('player_state()');
  assert.equal(state.login.streak,1);assert.equal(state.gold,5);
 });
});

test('verified lessons credit nutrients and gold once and advance the lesson quest once',async()=>{
 const lessons=Array.from({length:5},(_,i)=>({title:`Lesson ${i}`,text:'Study this explanation.',questions:[{kind:'multiple_choice',prompt:'Which answer is correct?',options:['Correct','B','C','D'],answer:'0',explanation:'The first option is correct.'}]}));
 const path=await scalar<string>('publish_learning_path($1,$2,$3,$4,$5,$6::jsonb)',[alice,'Python Basics','python','Beginner','authored',JSON.stringify(lessons)]);
 const lesson=(await db.query<{id:string}>('select id from lessons where path_id=$1 and ordinal=0',[path])).rows[0].id;
 let world='',attempt='';
 await as('auth0|economy-alice',async()=>{
  world=await scalar<string>("create_greenhouse('Reward world')");
  attempt=await scalar<string>('begin_attempt($1,$2,gen_random_uuid())',[lesson,world]);
  const question=(await db.query<{id:string}>('select id from lesson_questions where lesson_id=$1',[lesson])).rows[0].id;
  await scalar('submit_multiple_choice($1,$2,$3)',[attempt,question,'0']);
 });
 await scalar('finalize_attempt($1)',[attempt]);
 await scalar('finalize_attempt($1)',[attempt]);
 const wallet=(await db.query<{gold:number;nutrients:number}>('select gold,nutrients from player_wallets where player_id=$1',[alice])).rows[0];
 assert.deepEqual(wallet,{gold:14,nutrients:45});
 assert.equal((await db.query("select * from currency_ledger where player_id=$1 and reason='verified-lesson'",[alice])).rows.length,2);
 const quest=(await db.query<{progress:number;claimed:boolean}>('select progress,claimed from quest_progress where player_id=$1 and quest_key=$2',[alice,'complete-lesson'])).rows[0];
 assert.deepEqual(quest,{progress:1,claimed:true});
 const grown=(await db.query<{last_growth_at:string|null;stage:number}>('select last_growth_at,stage from greenhouses where id=$1',[world])).rows[0];
 assert.ok(grown.last_growth_at);assert.equal(grown.stage,0);
});

test('science and focus quests cap progress and pay a reward only once',async()=>{
 await as('auth0|economy-alice',async()=>{
  await scalar('record_science_card(gen_random_uuid())');
  await scalar('record_science_card(gen_random_uuid())');
  await db.exec('reset role');
  await db.query('update private.quest_ticks set science_at=clock_timestamp()-interval \'1 minute\' where player_id=$1',[alice]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub:'auth0|economy-alice',role:'authenticated'})]);
  await db.exec('set role authenticated');
  await scalar('record_science_card(gen_random_uuid())');
  await db.exec('reset role');
  await db.query('update private.quest_ticks set science_at=clock_timestamp()-interval \'1 minute\' where player_id=$1',[alice]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub:'auth0|economy-alice',role:'authenticated'})]);
  await db.exec('set role authenticated');
  const board=await scalar<{quests:{text:string;value:number;claimed:boolean}[];nutrients:number}>('record_science_card(gen_random_uuid())');
  const science=board.quests.find(quest=>quest.text==='Review 3 Science cards')!;
  assert.equal(science.value,3);assert.equal(science.claimed,true);
  const before=board.nutrients;
  await db.exec('reset role');
  await db.query('update private.quest_ticks set science_at=clock_timestamp()-interval \'1 minute\' where player_id=$1',[alice]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub:'auth0|economy-alice',role:'authenticated'})]);
  await db.exec('set role authenticated');
  const again=await scalar<typeof board>('record_science_card(gen_random_uuid())');
  assert.equal(again.nutrients,before);
  const focus=await scalar<typeof board>('record_focus_minute()');
  assert.equal(focus.quests.find(quest=>quest.text==='Focus for 20 minutes')!.value,1);
  const repeat=await scalar<typeof board>('record_focus_minute()');
  assert.equal(repeat.quests.find(quest=>quest.text==='Focus for 20 minutes')!.value,1);
 });
});

test('gold spends are atomic, idempotent, and reject forged prices or overdrafts',async()=>{
 let world='';
 await as('auth0|economy-alice',async()=>{world=(await db.query<{id:string}>('select id from greenhouses where owner_id=$1 limit 1',[alice])).rows[0].id;});
 await scalar("private.post_currency($1,'gold',200,gen_random_uuid(),'test-seed')",[alice]);
 const layout=JSON.stringify({items:[],placements:[],fixturePositions:{},storedFixtures:[]});
 const key=crypto.randomUUID();
 await db.exec('set role service_role');
 try{
  const first=await scalar<{layout_version:number}>('commit_purchased_layout($1,$2,0,$3::jsonb,$4,$5)',[alice,world,layout,'lantern',key]);
  assert.equal(first.layout_version,1);
  await assert.rejects(()=>scalar('commit_purchased_layout($1,$2,0,$3::jsonb,$4,$5)',[alice,world,layout,'lantern',crypto.randomUUID()]),/Room layout changed/);
  assert.equal((await db.query<{gold:number}>('select gold from player_wallets where player_id=$1',[alice])).rows[0].gold,157);
  const replay=await scalar<{layout_version:number}>('commit_purchased_layout($1,$2,1,$3::jsonb,$4,$5)',[alice,world,layout,'lantern',key]);
  assert.equal(replay.layout_version,2);
  assert.equal((await db.query<{gold:number}>('select gold from player_wallets where player_id=$1',[alice])).rows[0].gold,157);
  await assert.rejects(()=>scalar('commit_purchased_layout($1,$2,2,$3::jsonb,$4,gen_random_uuid())',[alice,world,layout,'telescope']),/Insufficient balance/);
  await assert.rejects(()=>scalar('commit_purchased_layout($1,$2,2,$3::jsonb,$4,gen_random_uuid())',[alice,world,layout,'forged']),/Room item unavailable/);
 }finally{await db.exec('reset role');}
 await as('auth0|economy-alice',async()=>{await assert.rejects(()=>scalar('commit_purchased_layout($1,$2,1,$3::jsonb,$4,gen_random_uuid())',[alice,world,layout,'lantern']),/permission denied/);});
 assert.equal((await db.query<{gold:number}>('select gold from player_wallets where player_id=$1',[alice])).rows[0].gold,157);
});

test('friend requests stay private, acceptance is required for presence, and greenhouse access is unchanged',async()=>{
 await as('auth0|economy-bob',async()=>{
  bob=(await scalar<{profile:{player_id:string}}>('bootstrap_player()')).profile.player_id;
  code=(await scalar<{friend_code:string}>('player_state()')).friend_code;
  assert.equal((await db.query('select * from friend_links')).rows.length,0);
 });
 let link='';
 await as('auth0|economy-alice',async()=>{
  await assert.rejects(()=>scalar('request_friend($1)',['not-a-code']),/Gardener not found/);
  const state=await scalar<{friends:{id:string;status:string;online:boolean;player_id:string}[]}>('request_friend($1)',[code]);
  assert.equal(state.friends.length,1);assert.equal(state.friends[0].status,'pending');assert.equal(state.friends[0].online,false);
  link=state.friends[0].id;
  await assert.rejects(()=>scalar('respond_friend($1,true)',[link]),/Friend request unavailable/);
 });
 await as('auth0|economy-stranger',async()=>{
  await scalar('bootstrap_player()');
  await scalar('player_state()');
  assert.equal((await db.query('select * from friend_links')).rows.length,0);
  assert.equal((await db.query('select * from player_wallets')).rows.length,1);
 });
 await as('auth0|economy-bob',async()=>{
  const pending=await scalar<{friends:{id:string;incoming:boolean;online:boolean}[]}>('player_state()');
  assert.equal(pending.friends[0].incoming,true);assert.equal(pending.friends[0].online,false);
  const accepted=await scalar<{friends:{online:boolean;status:string}[]}>('respond_friend($1,true)',[link]);
  assert.equal(accepted.friends[0].status,'accepted');assert.equal(accepted.friends[0].online,false);
  assert.equal(JSON.stringify(accepted.friends[0]).includes('greenhouse'),false);
 });
 await as('auth0|economy-bob',async()=>{await scalar('remove_friend($1)',[link]);assert.equal((await scalar<{friends:unknown[]}>('player_state()')).friends.length,0);});
});

test('saved character positions restore inside room bounds and raw movement stays service-only',async()=>{
 let session='',world='';
 await as('auth0|economy-alice',async()=>{
  world=(await db.query<{id:string}>('select id from greenhouses where owner_id=$1 order by created_at desc limit 1',[alice])).rows[0].id;
  session=(await scalar<{id:string}>('enter_greenhouse($1,false)',[world])).id;
  await assert.rejects(()=>scalar("apply_movement($1,$2,9,9,1,1,'Idle',-1,0)",[alice,session]),/permission denied/);
 });
 await db.exec('set role service_role');
 try{await scalar("apply_movement($1,$2,8.6,8.6,1,1,'Idle',-1,0)",[alice,session]);}
 finally{await db.exec('reset role');}
 await as('auth0|economy-alice',async()=>{
  await scalar('leave_session($1)',[session]);
  const restored=await scalar<{x:number;y:number}>('enter_greenhouse($1,false)',[world]);
  assert.equal(restored.x,8.6);assert.equal(restored.y,8.6);
 });
});
