import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signSession,verifySession} from './study-session-signature';
import {validLog,updateQuizLog,type QuizLog,type TopicHistoryEntry} from './topic-history';
import type {StudySession} from './study-quiz';
const session:StudySession={id:'original',topic:'Plants',difficulty:'Beginner',quiz:{multiple_choice:Array.from({length:4},(_,i)=>({question:`Question ${i}`,A:'Roots',B:'Leaves',C:'Flowers',D:'Seeds',correct_answer:'A',explanation:'Roots take in water.'})),short_answer:{question:'Explain roots.',correct_answer:'They take in water.',explanation:'Roots absorb water.',grading_criteria:'Mention water uptake.'}}};
test('saved quizzes can be verified after restart; altered questions and reward identities are rejected',()=>{
 const signed=signSession(session,'test-key');assert.equal(verifySession(JSON.parse(JSON.stringify(signed)),'test-key'),true);
 assert.equal(verifySession({...signed,topic:'Other'},'test-key'),false);assert.equal(verifySession({...signed,rewardId:'another'},'test-key'),false);assert.equal(verifySession(signed,'other-key'),false);assert.equal(verifySession({...signed,signature:'x'},'test-key'),false);
 const replay=signSession({...signed,id:'attempt-two',rewardId:signed.id},'test-key');assert.equal(verifySession(replay,'test-key'),true);assert.equal(replay.rewardId,session.id);assert.deepEqual(replay.quiz,session.quiz);
});
test('quiz logs retain questions, selected answers and current page independently',()=>{
 const log:QuizLog={session,answers:['A','','',''],answer:'',result:null,page:1};
 assert.equal(validLog(log),true);assert.equal(validLog({...log,page:5}),false);assert.equal(validLog({...log,answers:['invalid']}),false);
 const history:TopicHistoryEntry[]=[{topic:session.topic,difficulty:session.difficulty,studiedAt:1,log}];
 const next=updateQuizLog(history,{...log,answers:['A','B','',''],page:2});assert.equal(next[0].log?.page,2);assert.equal(next[0].log?.answers[1],'B');assert.equal(history[0].log?.page,1);assert.deepEqual(next[0].log?.session.quiz,session.quiz);
});
