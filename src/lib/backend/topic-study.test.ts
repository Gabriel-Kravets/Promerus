import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTopicStudyService} from './topic-study';
import type {StudySession} from '../study-quiz';
const lesson={id:'lesson',title:'Roots',text:'A lesson about roots.',ordinal:0,completed:false,questions:[...Array.from({length:4},(_,i)=>({id:`mc${i}`,kind:'multiple_choice' as const,prompt:`Root ${i}?`,options:['Water','Sun','Air','Soil']})),{id:'short',kind:'short_answer' as const,prompt:'Explain roots.'}]};
function fixture(score=5,rewarded=true){
 const calls:{name:string;args:any}[]=[];let refreshes=0;
 const service=createTopicStudyService({world:()=> 'world',wait:async()=>{},refresh:async()=>{refreshes++;},rpc:async<T>(name:string,args?:Record<string,unknown>)=>{calls.push({name,args});if(name==='learning_snapshot')return [{id:'path',title:'Roots',lessons:[lesson]}] as T;if(name==='begin_attempt')return 'attempt' as T;return {correct:Number(String(args?.p_question).slice(2))<score,explanation:'Verified explanation'} as T;},invoke:async<T>(name:string,args:unknown)=>{calls.push({name,args});return (name==='generate'?{state:'pending'}:name==='job'?{state:'succeeded',path_id:'path'}:name==='finish'?{rewarded}:{correct:score===5,explanation:'Server feedback'}) as T;}});
 return {service,calls,refreshes:()=>refreshes};
}
test('current topic book uses existing generation job and starts an authenticated attempt',async()=>{
 const f=fixture(),s=await f.service.generate('Roots','Beginner');assert.equal(s.online?.attempt,'attempt');assert.equal(s.quiz.multiple_choice.length,4);assert.equal(s.quiz.short_answer.correct_answer,'');assert.deepEqual(f.calls.map(c=>c.name),['generate','job','learning_snapshot','begin_attempt']);
});
test('shared rewards come only from verified finish; duplicate rewards stay zero',async()=>{
 for(const rewarded of [true,false]){const f=fixture(5,rewarded),s=await f.service.generate('Roots','Beginner'),graded=await f.service.grade(s,['A','B','C','D'],'Water uptake');assert.equal(graded.result.nutrients,rewarded?20:0);assert.equal(graded.result.coins,0);assert.equal(graded.result.score,5);assert.equal(graded.session.quiz.multiple_choice[0].explanation,'Verified explanation');assert.equal(f.refreshes(),1);assert.equal(f.calls.filter(c=>c.name==='finish').length,1);assert.deepEqual(f.calls.filter(c=>c.name==='submit_multiple_choice').map(c=>c.args.p_answer),['0','1','2','3']);}
});
test('partial grades and forged question lists cannot create shared energy',async()=>{
 const f=fixture(2),s=await f.service.generate('Roots','Beginner'),graded=await f.service.grade(s,['A','A','A','A'],'Water');assert.equal(graded.result.nutrients,0);assert.equal(f.calls.filter(c=>c.name==='finish').length,0);await assert.rejects(f.service.grade({...s,online:{...s.online!,questions:['forged']}} as StudySession,['A','A','A','A'],'Water'),/questions changed/);await assert.rejects(f.service.grade({...s,online:undefined},[],'Water'),/not an authenticated/);
});
