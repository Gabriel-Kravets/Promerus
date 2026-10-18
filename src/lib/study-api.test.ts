import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/study/route';
import {useGame} from '../store/game';
import type {StudyQuiz,StudySession,QuizResult} from './study-quiz';

const quiz:StudyQuiz={
 multiple_choice:Array.from({length:4},(_,i)=>({question:`Plant question ${i+1}`,A:'Roots',B:'Leaves',C:'Flowers',D:'Seeds',correct_answer:'A',explanation:'Roots take up water.'})),
 short_answer:{question:'What do roots do?',correct_answer:'Take up water.',explanation:'Roots absorb water and minerals.',grading_criteria:'Mentions water uptake.'},
};
const post=(data:unknown,origin='http://localhost:3000')=>POST(new Request('http://localhost:3000/api/study',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(data)}));

test('study API generates, grades and replays a quiz without duplicating game rewards',async t=>{
 const previousKey=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY='test-only-signing-key';
 t.after(()=>{if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;useGame.getState().reset();});
 const requests:{generationConfig:{responseFormat:{text:{mimeType:string}}}}[]=[];
 t.mock.method(globalThis,'fetch',async(_url:unknown,options:RequestInit)=>{
  const body=JSON.parse(options.body as string);requests.push(body);
  const content=requests.length===1?quiz:{is_correct:true};
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(content)}]}}]});
 });
 useGame.getState().reset();
 useGame.getState().set({course:'python'});
 useGame.getState().complete(0,'python:0');
 const generated=await post({action:'generate',topic:'Roots',difficulty:'Intermediate'});
 assert.equal(generated.status,200);
 const session=await generated.json() as StudySession;
 assert.equal(session.topic,'Roots');assert.ok(session.signature);
 assert.equal(requests[0].generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');
 const grade=await post({action:'grade',id:session.id,session,answers:['A','B','A','A'],answer:'Roots take up water.'});
 assert.equal(grade.status,200);
 const result=await grade.json() as QuizResult;
 assert.deepEqual(result,{score:4,correct:[true,false,true,true,true],nutrients:80,coins:16});
 assert.equal(useGame.getState().complete(0,`gemini:${session.id}`,result.nutrients,result.coins),true);
 const repeated=await post({action:'grade',id:session.id,session,answers:['B','B','B','B'],answer:'Changed answer.'});
 assert.deepEqual(await repeated.json(),result);assert.equal(requests.length,2);
 const replay=await post({action:'replay',session});
 assert.equal(replay.status,200);
 const reopened=await replay.json() as StudySession;
 assert.notEqual(reopened.id,session.id);assert.equal(reopened.rewardId,session.id);
 const regraded=await post({action:'grade',id:reopened.id,session:reopened,answers:['A','A','A','A'],answer:'Absorb water.'});
 assert.equal(regraded.status,200);
 const retryResult=await regraded.json() as QuizResult;
 assert.equal(useGame.getState().complete(0,`gemini:${reopened.rewardId}`,retryResult.nutrients,retryResult.coins),false);
 assert.equal(useGame.getState().energy,160);assert.equal(useGame.getState().coins,16);
 assert.equal(useGame.getState().course,'python');
 assert.equal(useGame.getState().complete(0,'python:1'),true);
 assert.equal(useGame.getState().energy,180);assert.equal(useGame.getState().coins,16);
});

test('study API rejects invalid topics, foreign origins and altered replay sessions before calling Gemini',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('Unexpected Gemini request');});
 assert.equal((await post({action:'generate',topic:'',difficulty:'Beginner'})).status,400);
 assert.equal((await post({action:'generate',topic:'Roots',difficulty:'Unknown'})).status,400);
 assert.equal((await post({action:'generate',topic:'Roots',difficulty:'Beginner'},'https://other.example')).status,403);
 assert.equal((await post({action:'replay',session:{id:'tampered',topic:'Roots',difficulty:'Beginner',quiz,signature:'0'.repeat(64)}})).status,400);
 assert.equal(fetch.mock.callCount(),0);
});


test('study API uses the public host when Next normalizes the internal request URL',async()=>{
 const request=(origin:string,host:string,forwarded?:{host:string;protocol:string})=>new Request('http://localhost:3100/api/study',{
  method:'POST',headers:{origin,host,'Content-Type':'application/json',...(forwarded?{'x-forwarded-host':forwarded.host,'x-forwarded-proto':forwarded.protocol}:{})},
  body:JSON.stringify({action:'generate',topic:'',difficulty:'Beginner'}),
 });
 assert.equal((await POST(request('http://127.0.0.1:3100','127.0.0.1:3100'))).status,400);
 assert.equal((await POST(request('https://sprout.example','localhost:3100',{host:'sprout.example',protocol:'https'}))).status,400);
 assert.equal((await POST(request('https://other.example','localhost:3100',{host:'sprout.example',protocol:'https'}))).status,403);
});
