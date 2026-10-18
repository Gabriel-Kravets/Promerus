import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db:PGlite;
const issuer='https://dev-phu3idfk55gl1dkn.us.auth0.com/',aud='uiuwR5J2A8HJpHRTLyaoKsyDURhC2tMK';
async function as(subject:string,run:()=>Promise<void>,overrides:Record<string,unknown>={}){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:issuer,aud,sub:subject,role:'authenticated',...overrides})]);await db.exec('set role authenticated');
 try{await run();}finally{await db.exec('reset role');}
}
async function scalar<T>(sql:string,args:unknown[]=[]){return (await db.query<{value:T}>(`select ${sql} as value`,args)).rows[0].value;}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.jwt() to authenticated,service_role;`);
 await db.exec(`create schema realtime;create table realtime.messages(extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select on realtime.messages to authenticated;insert into realtime.messages values('broadcast');`);
 await db.exec(await readFile(new URL('../migrations/202610170001_identity_worlds.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/202610170002_learning_rewards.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/202610170003_live_sessions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/202610170004_membership_lifecycle.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/202610180005_four_permanent_members.sql',import.meta.url),'utf8'));
});
after(async()=>{await db.close();});
let alice:string,bob:string,world:string,invite:string;
test('Auth0 text subjects bootstrap one identity and reject a different audience/issuer',async()=>{
 await as('auth0|alice',async()=>{const a=await scalar<{profile:{player_id:string}}>('bootstrap_player()');alice=a.profile.player_id;assert.ok(alice);assert.equal((await scalar<typeof a>('bootstrap_player()')).profile.player_id,alice);});
 await as('auth0|alice',async()=>{await assert.rejects(()=>scalar('bootstrap_player()'),/Invalid identity/);},{aud:'another-app'});
 await as('auth0|alice',async()=>{await assert.rejects(()=>scalar('bootstrap_player()'),/Invalid identity/);},{iss:'https://untrusted.example/'});
 await as('auth0|bob',async()=>{bob=(await scalar<{profile:{player_id:string}}>('bootstrap_player()')).profile.player_id;assert.notEqual(alice,bob);});
});
test('profile mutations whitelist fields and RLS hides another player',async()=>{
 await as('auth0|alice',async()=>{
  await scalar('save_profile($1::jsonb)',[JSON.stringify({name:'Alice',intro:'skipped',onboardingComplete:true})]);
  assert.equal((await db.query('select * from profiles')).rows.length,1);
  await assert.rejects(()=>db.query('update profiles set name=$1 where player_id=$2',['Forged',bob]),/permission denied/);
  await assert.rejects(()=>scalar('save_profile($1::jsonb)',[JSON.stringify({player_id:bob,name:'Forged'})]),/Invalid profile/);
  await assert.rejects(()=>scalar('save_profile($1::jsonb)',[JSON.stringify({avatar:{skin:'bad'}})]),/Invalid avatar/);
 });
});
test('private worlds deny nonmembers; invitations grant membership without ownership',async()=>{
 await as('auth0|alice',async()=>{world=await scalar<string>("create_greenhouse('Moonlit',false,false)");invite=await scalar<string>('issue_invite($1)',[world]);});
 await as('auth0|bob',async()=>{
  assert.equal((await db.query('select * from greenhouses')).rows.length,0);
  await assert.rejects(()=>scalar('enter_greenhouse($1,false)',[world]),/access denied/);
  assert.equal(await scalar('join_greenhouse($1)',[invite]),world);
  assert.equal((await db.query('select * from greenhouses')).rows.length,1);
  await assert.rejects(()=>scalar('issue_invite($1)',[world]),/Owner permission/);
  await assert.rejects(()=>db.query('update greenhouses set energy=300 where id=$1',[world]),/permission denied/);
 });
});
test('session takeover replaces the lease and removal revokes an already connected actor',async()=>{
 let session:string;
 await as('auth0|bob',async()=>{
  session=(await scalar<{id:string}>('enter_greenhouse($1,false)',[world])).id;
  await assert.rejects(()=>scalar('enter_greenhouse($1,false)',[world]),/Already controlled/);
  const takeover=await scalar<{id:string}>('enter_greenhouse($1,true)',[world]);assert.notEqual(session,takeover.id);
  await assert.rejects(()=>scalar('heartbeat($1)',[session]),/Session expired/);session=takeover.id;
 });
 await as('auth0|alice',async()=>{await scalar('remove_member($1,$2)',[world,bob]);});
 await as('auth0|bob',async()=>{
  await assert.rejects(()=>scalar('heartbeat($1)',[session]),/Session expired/);
  assert.equal((await db.query('select * from room_sessions')).rows.length,0);
  assert.equal((await db.query('select * from greenhouses')).rows.length,0);
 });
});
test('public browsing exposes only safe listing; visitor cannot mutate owner state',async()=>{
 await as('auth0|alice',async()=>{await scalar("manage_greenhouse($1,'Moonlit',true,true)",[world]);});
 await as('auth0|bob',async()=>{
  const rows=await scalar<{id:string;stage:number}[]>('list_greenhouses()');assert.equal(rows[0].id,world);assert.equal(rows[0].stage,0);
  await scalar('request_visit($1)',[world]);await scalar('enter_greenhouse($1,false)',[world]);
  await assert.rejects(()=>scalar("manage_greenhouse($1,'Stolen',true,true)",[world]),/Owner permission/);
 });
 await as('auth0|alice',async()=>{await scalar("manage_greenhouse($1,'Moonlit',false,false)",[world]);});
 await as('auth0|bob',async()=>{assert.equal((await db.query('select * from greenhouses')).rows.length,0);});
});
test('four-slot capacity is enforced and a failed switch preserves the old world',async()=>{
 let oldWorld:string;
 await as('auth0|bob',async()=>{oldWorld=await scalar<string>("create_greenhouse('Old world')");await scalar('enter_greenhouse($1,false)',[oldWorld]);});
 await as('auth0|alice',async()=>{await scalar("manage_greenhouse($1,'Moonlit',true,true)",[world]);});
 for(let i=0;i<4;i++)await as(`auth0|occupant${i}`,async()=>{await scalar('bootstrap_player()');await scalar('request_visit($1)',[world]);await scalar('enter_greenhouse($1,false)',[world]);});
 await as('auth0|bob',async()=>{await scalar('request_visit($1)',[world]);await assert.rejects(()=>scalar('enter_greenhouse($1,false)',[world]),/full/);assert.equal((await db.query<{greenhouse_id:string}>('select greenhouse_id from room_sessions where player_id=$1',[bob])).rows[0].greenhouse_id,oldWorld);});
});

let firstLesson:string,aliceAttempt:string;
async function seedPath(player:string,topic='python'){
 const lessons=Array.from({length:5},(_,i)=>({title:`Lesson ${i}`,text:'Study this explanation.',questions:[{kind:'multiple_choice',prompt:'Which answer is correct?',options:['Correct','B','C','D'],answer:'0',explanation:'The first option is correct.'}]}));
 return await scalar<string>('publish_learning_path($1,$2,$3,$4,$5,$6::jsonb)',[player,'Python Basics',topic,'Beginner','authored',JSON.stringify(lessons)]);
}
test('solution keys stay private and learners cannot finalize or assign grades directly',async()=>{
 const path=await seedPath(alice);firstLesson=(await db.query<{id:string}>('select id from lessons where path_id=$1 and ordinal=0',[path])).rows[0].id;
 await as('auth0|alice',async()=>{
  const snapshot=await scalar<any[]>('learning_snapshot()');assert.ok(snapshot[0].lessons.length===5);assert.equal(JSON.stringify(snapshot).includes('The first option is correct.'),false);
  await assert.rejects(()=>db.query('select * from private.lesson_solutions'),/permission denied/);
  await assert.rejects(()=>scalar('finalize_attempt(gen_random_uuid())'),/permission denied/);
  await assert.rejects(()=>db.query("insert into lesson_completions(player_id,canonical_key,lesson_id,attempt_id) values($1,'fake',$2,gen_random_uuid())",[alice,firstLesson]),/permission denied/);
 });
});
test('verified rewards are atomic, replay safe and retain their original greenhouse',async()=>{
 let rewardWorld='';
 await as('auth0|alice',async()=>{
  rewardWorld=await scalar<string>("create_greenhouse('Study rewards')");
  aliceAttempt=await scalar<string>('begin_attempt($1,$2,gen_random_uuid())',[firstLesson,rewardWorld]);
 });
 await assert.rejects(()=>scalar('finalize_attempt($1)',[aliceAttempt]),/verified correct/);
 const question=(await db.query<{id:string}>('select id from lesson_questions where lesson_id=$1',[firstLesson])).rows[0].id;
 await as('auth0|alice',async()=>{
  const wrong=await scalar<{correct:boolean}>('submit_multiple_choice($1,$2,$3)',[aliceAttempt,question,'2']);assert.equal(wrong.correct,false);
  const right=await scalar<{correct:boolean}>('submit_multiple_choice($1,$2,$3)',[aliceAttempt,question,'0']);assert.equal(right.correct,true);
 });
 const first=await scalar<{rewarded:boolean;energy:number}>('finalize_attempt($1)',[aliceAttempt]);assert.deepEqual([first.rewarded,first.energy],[true,80]);
 const retry=await scalar<typeof first>('finalize_attempt($1)',[aliceAttempt]);assert.deepEqual([retry.rewarded,retry.energy],[false,80]);
 assert.equal((await db.query('select * from energy_ledger where greenhouse_id=$1',[rewardWorld])).rows.length,1);
 await as('auth0|bob',async()=>{await assert.rejects(()=>scalar('submit_multiple_choice($1,$2,$3)',[aliceAttempt,question,'0']),/Attempt unavailable/);});
});
test('repeating an authored lesson in another world does not mint rewards',async()=>{
 let attempt='';
 await as('auth0|alice',async()=>{
  const world2=await scalar<string>("create_greenhouse('Second reward world')");
  attempt=await scalar<string>('begin_attempt($1,$2,gen_random_uuid())',[firstLesson,world2]);
  const q=(await db.query<{id:string}>('select id from lesson_questions where lesson_id=$1',[firstLesson])).rows[0].id;
  await scalar('submit_multiple_choice($1,$2,$3)',[attempt,q,'0']);
 });
 const result=await scalar<{rewarded:boolean;energy:number}>('finalize_attempt($1)',[attempt]);assert.equal(result.rewarded,false);assert.equal(result.energy,60);
});
test('two verified contributors unlock Moonlight Bloom exactly once',async()=>{
 let w='',code='';
 await as('auth0|alice',async()=>{w=await scalar<string>("create_greenhouse('Cooperative rewards')");code=await scalar<string>('issue_invite($1)',[w]);});
 await as('auth0|bob',async()=>{await scalar('join_greenhouse($1)',[code]);});
 for(const [subject,player] of [['auth0|alice',alice],['auth0|bob',bob]]){
  const path=await seedPath(player,'algebra'),lesson=(await db.query<{id:string}>('select id from lessons where path_id=$1 and ordinal=0',[path])).rows[0].id;
  let attempt='';
  await as(subject,async()=>{attempt=await scalar<string>('begin_attempt($1,$2,gen_random_uuid())',[lesson,w]);const q=(await db.query<{id:string}>('select id from lesson_questions where lesson_id=$1',[lesson])).rows[0].id;await scalar('submit_multiple_choice($1,$2,$3)',[attempt,q,'0']);});
  await scalar('finalize_attempt($1)',[attempt]);await scalar('finalize_attempt($1)',[attempt]);
 }
 const world=(await db.query<{energy:number;moonlight_bloom:boolean;stage:number}>('select energy,moonlight_bloom,stage from greenhouses where id=$1',[w])).rows[0];
 assert.deepEqual(world,{energy:100,moonlight_bloom:true,stage:1});
 assert.equal((await db.query('select * from greenhouse_quests where greenhouse_id=$1',[w])).rows.length,1);
});

test('owner departure requires a valid successor and preserves the greenhouse history',async()=>{
 let w='',code='';
 await as('auth0|alice',async()=>{w=await scalar<string>("create_greenhouse('Transferable world')");code=await scalar<string>('issue_invite($1)',[w]);});
 await as('auth0|bob',async()=>{await scalar('join_greenhouse($1)',[code]);});
 await as('auth0|alice',async()=>{
  await assert.rejects(()=>scalar('leave_greenhouse($1)',[w]),/Choose a current member/);
  await scalar('leave_greenhouse($1,$2)',[w,bob]);assert.equal((await db.query('select * from greenhouses where id=$1',[w])).rows.length,0);
 });
 await as('auth0|bob',async()=>{assert.equal((await db.query<{owner_id:string}>('select owner_id from greenhouses where id=$1',[w])).rows[0].owner_id,bob);await scalar('issue_invite($1)',[w]);});
});
test('failed invite redemptions retain rate-limit accounting',async()=>{
 await as('auth0|invite-prober',async()=>{
  await scalar('bootstrap_player()');for(let i=0;i<20;i++)assert.equal(await scalar('join_greenhouse($1)',['invalid']),null);
  await assert.rejects(()=>scalar('join_greenhouse($1)',['invalid']),/Request limit/);
 });
});
test('generation publish is idempotent and service-only operations obey their grants',async()=>{
 let job='';
 await as('auth0|alice',async()=>{job=(await scalar<{id:string}>('generation_job(gen_random_uuid())')).id;await assert.rejects(()=>scalar('claim_generation($1)',[job]),/permission denied/);});
 await db.exec('set role service_role');
 try{
  assert.equal(await scalar('claim_generation($1)',[job]),true);assert.equal(await scalar('claim_generation($1)',[job]),false);
  const content=JSON.stringify(Array.from({length:5},(_,i)=>({title:`Lesson ${i}`,text:'A complete lesson.',questions:[{kind:'multiple_choice',prompt:'Pick A',options:['A','B','C','D'],answer:'0',explanation:'A is correct.'}]})));
  const args=[job,'Job course','python','Beginner','authored',content];
  const p=await scalar('publish_generation($1,$2,$3,$4,$5,$6::jsonb)',args),retry=await scalar('publish_generation($1,$2,$3,$4,$5,$6::jsonb)',args);assert.equal(p,retry);
 }finally{await db.exec('reset role');}
});
test('anonymous callers cannot bootstrap identities or read profile/world data',async()=>{
 await db.exec('set role anon');try{
  await assert.rejects(()=>scalar('bootstrap_player()'),/permission denied/);
  await assert.rejects(()=>db.query('select * from greenhouses'),/permission denied/);
  await assert.rejects(()=>db.query('select * from profiles'),/permission denied/);
 }finally{await db.exec('reset role');}
});

test('private Realtime authorization is scoped to current room access and epoch',async()=>{
 const row=(await db.query<{id:string;access_epoch:number}>('select id,access_epoch from greenhouses where owner_id=$1 and not archived limit 1',[alice])).rows[0];
 await db.query("select set_config('realtime.topic',$1,false)",[`world:${row.id}:${row.access_epoch}`]);
 await as('auth0|alice',async()=>{assert.equal((await db.query('select * from realtime.messages')).rows.length,1);});
 await db.query("select set_config('realtime.topic',$1,false)",[`world:${row.id}:0`]);
 await as('auth0|alice',async()=>{assert.equal((await db.query('select * from realtime.messages')).rows.length,0);});
 await db.query("select set_config('realtime.topic',$1,false)",[`world:${row.id}:${row.access_epoch}`]);
 await as('auth0|uninvited',async()=>{await scalar('bootstrap_player()');assert.equal((await db.query('select * from realtime.messages')).rows.length,0);});
});

test('service movement rejects stale concurrent writes and clients cannot apply raw movement',async()=>{
 let session='',player='';
 await as('auth0|mover',async()=>{player=(await scalar<{profile:{player_id:string}}>('bootstrap_player()')).profile.player_id;const w=await scalar<string>("create_greenhouse('Motion world')");session=(await scalar<{id:string}>('enter_greenhouse($1,false)',[w])).id;await assert.rejects(()=>scalar("apply_movement($1,$2,8.5,8.5,1,1,'Idle',-1,0)",[player,session]),/permission denied/);});
 await db.exec('set role service_role');try{
  const first=await scalar<{sequence:number}>("apply_movement($1,$2,8.5,8.5,1,1,'Idle',-1,0)",[player,session]);assert.equal(first.sequence,1);
  await assert.rejects(()=>scalar("apply_movement($1,$2,8.5,8.5,1,2,'Idle',-1,0)",[player,session]),/state changed/);
  await assert.rejects(()=>scalar("apply_movement($1,$2,15,15,1,2,'Idle',-1,1)",[player,session]),/too fast/);
 }finally{await db.exec('reset role');}
});
test('Sproutling reactions require an active actor-bound session and never grant energy',async()=>{
 await as('auth0|mover',async()=>{const s=(await db.query<{id:string;greenhouse_id:string}>('select id,greenhouse_id from room_sessions where player_id=private.actor()')).rows[0];await scalar("react_sproutling($1,'watering')",[s.id]);const w=(await db.query<{energy:number;pet_pause_total:number}>('select energy,pet_pause_total from greenhouses where id=$1',[s.greenhouse_id])).rows[0];assert.equal(w.energy,60);assert.ok(w.pet_pause_total>=3.9);});
 await as('auth0|bob',async()=>{await assert.rejects(()=>scalar("react_sproutling(gen_random_uuid(),'happy')"),/Session expired/);});
});

test('permanent-member limit includes offline members and preserves existing membership on rejection',async()=>{
 let limited='',code='';
 await as('auth0|limit-owner',async()=>{await scalar('bootstrap_player()');limited=await scalar<string>("create_greenhouse('Permanent limit test')");code=await scalar<string>('issue_invite($1)',[limited]);});
 for(let i=0;i<3;i++)await as(`auth0|limit-member-${i}`,async()=>{await scalar('bootstrap_player()');assert.equal(await scalar('join_greenhouse($1)',[code]),limited);});
 const uses=await scalar<number>('(select uses from private.greenhouse_invites where greenhouse_id=$1)',[limited]);
 await as('auth0|limit-fifth',async()=>{await scalar('bootstrap_player()');await assert.rejects(()=>scalar('join_greenhouse($1)',[code]),/four permanent members/);});
 assert.equal(await scalar<number>('(select count(*)::integer from greenhouse_memberships where greenhouse_id=$1)',[limited]),4);
 assert.equal(await scalar<number>('(select count(*)::integer from room_sessions where greenhouse_id=$1)',[limited]),0);
 assert.equal(await scalar<number>('(select uses from private.greenhouse_invites where greenhouse_id=$1)',[limited]),uses);
 await as('auth0|limit-member-0',async()=>{assert.equal(await scalar('join_greenhouse($1)',[code]),limited);});
});
