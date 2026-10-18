import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {verifyPlayerToken} from './verify-token';
import {avatarSchema,profilePatchSchema,positionSchema} from './contracts';

test('JWT verification rejects forged identities, expired tokens and wrong trust claims',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),other=await generateKeyPair('RS256');
 const sign=(claims:Record<string,unknown>={},key=privateKey)=>new SignJWT({role:'authenticated',...claims}).setProtectedHeader({alg:'RS256'}).setIssuer('https://test.auth0.com/').setAudience('app').setSubject('auth0|player').setIssuedAt().setExpirationTime('5m').sign(key);
 assert.deepEqual(await verifyPlayerToken(await sign(),'https://test.auth0.com/','app',publicKey),{issuer:'https://test.auth0.com/',subject:'auth0|player'});
 await assert.rejects(()=>verifyPlayerToken('forged','https://test.auth0.com/','app',publicKey));
 await assert.rejects(async()=>verifyPlayerToken(await sign({},other.privateKey),'https://test.auth0.com/','app',publicKey));
 await assert.rejects(async()=>verifyPlayerToken(await sign(),'https://evil.example/','app',publicKey));
 await assert.rejects(async()=>verifyPlayerToken(await sign(),'https://test.auth0.com/','wrong-app',publicKey));
 await assert.rejects(async()=>verifyPlayerToken(await sign({role:'service_role'}),'https://test.auth0.com/','app',publicKey));
 const expired=await new SignJWT({role:'authenticated'}).setProtectedHeader({alg:'RS256'}).setIssuer('https://test.auth0.com/').setAudience('app').setSubject('auth0|player').setIssuedAt(1).setExpirationTime(2).sign(privateKey);
 await assert.rejects(()=>verifyPlayerToken(expired,'https://test.auth0.com/','app',publicKey));
});
test('avatar, profile and movement contracts reject authority fields and invalid coordinates',()=>{
 assert.equal(positionSchema.safeParse({geometryVersion:'moonlit-v1',x:8,y:8,facing:1,sequence:1,activity:'Idle'}).success,false);
 assert.equal(positionSchema.parse({geometryVersion:'moonlit-v2',x:8,y:8,facing:1,sequence:1,activity:'Idle'}).seat,-1);
 assert.equal(profilePatchSchema.safeParse({player_id:'another-user',energy:300}).success,false);
 assert.equal(avatarSchema.safeParse({skin:'javascript:alert(1)'}).success,false);
 assert.equal(positionSchema.safeParse({geometryVersion:'moonlit-v2',x:NaN,y:8,facing:1,sequence:1,activity:'Idle'}).success,false);
 assert.equal(positionSchema.safeParse({geometryVersion:'moonlit-v2',x:8,y:8,facing:1,sequence:1,activity:'Idle',player_id:'another-user'}).success,false);
});

test('shared Sproutling uses identical server time and stays on clear floor',async()=>{
 const {sharedSproutlingAt}=await import('./shared-sproutling');const {blocked}=await import('../movement');
 for(let seconds=0;seconds<500;seconds+=.5){const a=sharedSproutlingAt('room-a',seconds*1000),b=sharedSproutlingAt('room-a',seconds*1000);assert.deepEqual(a,b);assert.equal(blocked(a.position.x,a.position.y),false);}
 assert.notDeepEqual(sharedSproutlingAt('room-a',100000),sharedSproutlingAt('room-b',100000));
});

test('cloud cache keys cannot overwrite the legacy demo or another account',async()=>{
 const {setPlayerStorageScope,scopedStorageKey}=await import('./storage-scope');
 setPlayerStorageScope(null);assert.equal(scopedStorageKey('sproutbound-v1'),'sproutbound-v1');
 setPlayerStorageScope('player-a');const a=scopedStorageKey('sproutbound-v1');assert.notEqual(a,'sproutbound-v1');
 setPlayerStorageScope('player-b');assert.notEqual(scopedStorageKey('sproutbound-v1'),a);setPlayerStorageScope(null);
});

test('movement validation rejects furniture, water and impossible speed',async()=>{
 const {validMovement}=await import('./movement-validation');
 assert.equal(validMovement({x:8.5,y:8.5},{x:8.5,y:8.4},.2),true);
 assert.equal(validMovement({x:8.5,y:8.5},{x:100,y:100},1),false);
 assert.equal(validMovement({x:8.5,y:8.5},{x:5.5,y:5.5},1),false);
 assert.equal(validMovement({x:8.5,y:8.5},{x:2.5,y:7.5},.01),false);
});

test('online mode never accepts local simulated reward completions',async()=>{
 const {useGame}=await import('../../store/game');useGame.getState().reset();useGame.getState().set({cloud:true});
 assert.equal(useGame.getState().complete(0,'forged-lesson'),false);assert.equal(useGame.getState().energy,60);assert.equal(useGame.getState().completions.length,0);useGame.getState().reset();
});

test('server-anchored Sproutling clock freezes during a shared celebration and resumes continuously',async()=>{
 const {sproutlingClock}=await import('./shared-sproutling');
 const until=new Date(14000).toISOString();assert.equal(sproutlingClock(10000,4,until),10000);assert.equal(sproutlingClock(12000,4,until),10000);assert.equal(sproutlingClock(14000,4,until),10000);assert.equal(sproutlingClock(15000,4,until),11000);
});

test('request body bounds apply while streaming, before decoding an oversized JSON payload',async()=>{
 const {readJsonBody,PayloadTooLarge}=await import('./request-body');
 assert.deepEqual(await readJsonBody(new Request('https://fixture.example',{method:'POST',body:'{"ok":true}'})),{ok:true});
 await assert.rejects(()=>readJsonBody(new Request('https://fixture.example',{method:'POST',body:JSON.stringify({text:'a'.repeat(17000)})})),PayloadTooLarge);
});

test('server key configuration supports named platform keys and fails closed without secrets',async()=>{
 const {serverKeys}=await import('./server-keys');
 const values:Record<string,string>={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEYS:JSON.stringify({default:'fixture-private-key'}),SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'fixture-public-key'})};
 assert.equal(serverKeys(name=>values[name]).publishable,'fixture-public-key');
 assert.throws(()=>serverKeys(()=>undefined),/configuration is incomplete/);
 const legacy:Record<string,string>={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-legacy-private',SUPABASE_ANON_KEY:'fixture-legacy-public'};
 assert.equal(serverKeys(name=>legacy[name]).secret,'fixture-legacy-private');
});
