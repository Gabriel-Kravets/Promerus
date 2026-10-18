import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,classmateQuizMinute,classmateQuizId,GROUP_QUIZ_PENALTY,logQuiz,MAX_CATCH_UP_DAYS,planGroupQuizzes,quizzesOn,requiredQuizzes} from './group-quizzes';
import {questDay} from './daily-quests';
import {useGame} from '../store/game';

// Noon in New York on 14 October 2026.
const noon=new Date('2026-10-14T12:00:00-04:00');

test('the group needs one quiz per member',()=>{
 assert.equal(requiredQuizzes(4),4);assert.equal(requiredQuizzes(2),2);assert.equal(requiredQuizzes(0),1);
});
test('quest days step across month and year boundaries',()=>{
 assert.equal(addDays('2026-10-31',1),'2026-11-01');assert.equal(addDays('2027-01-01',-1),'2026-12-31');
});
test('a quiz counts once per member per day and old days are pruned',()=>{
 let log=logQuiz({'2026-09-01':['0:old']},0,'python:0',noon);
 log=logQuiz(log,0,'python:0',noon);log=logQuiz(log,1,'python:0',noon);
 assert.deepEqual(log,{'2026-10-14':['0:python:0','1:python:0']});assert.equal(quizzesOn(log,'2026-10-14'),2);
});
test('the first check starts tracking today without charging earlier days',()=>{
 const plan=planGroupQuizzes({log:{},settledThrough:'',members:4,classmates:[],now:noon});
 assert.deepEqual(plan,{classmateQuizzes:[],penalties:[],settledThrough:'2026-10-13'});
});
test('a finished day short of one quiz per member is charged for each missing quiz',()=>{
 const plan=planGroupQuizzes({log:{'2026-10-13':['0:a','0:b']},settledThrough:'2026-10-12',members:4,classmates:[],now:noon});
 assert.deepEqual(plan.penalties,[{day:'2026-10-13',missing:2}]);
 // Today is never charged before midnight.
 assert.ok(!plan.penalties.some(p=>p.day==='2026-10-14'));
});
test('a day with enough quizzes is not charged',()=>{
 const plan=planGroupQuizzes({log:{'2026-10-13':['0:a','0:b','0:c','0:d']},settledThrough:'2026-10-12',members:4,classmates:[],now:noon});
 assert.deepEqual(plan.penalties,[]);
});
test('classmates finish their quizzes on their own schedule',()=>{
 const plan=planGroupQuizzes({log:{},settledThrough:'2026-10-12',members:4,classmates:[1,2,3],now:noon});
 const yesterday=[1,2,3].filter(m=>classmateQuizMinute('2026-10-13',m)!==null);
 const today=[1,2,3].filter(m=>{const at=classmateQuizMinute('2026-10-14',m);return at!==null&&at<=12*60;});
 assert.deepEqual(plan.classmateQuizzes,[...yesterday.map(member=>({day:'2026-10-13',member})),...today.map(member=>({day:'2026-10-14',member}))]);
 // Classmates alone never cover a four-person goal, so yesterday still needed the player.
 assert.deepEqual(plan.penalties,[{day:'2026-10-13',missing:4-yesterday.length}]);
});
test('classmate schedules are deterministic and fall inside the study day',()=>{
 for(let d=0;d<60;d++)for(const m of [1,2,3]){const day=addDays('2026-10-01',d),at=classmateQuizMinute(day,m);assert.equal(at,classmateQuizMinute(day,m));if(at!==null)assert.ok(at>=9*60&&at<21*60);}
});
test('days missed while away are charged for at most a week',()=>{
 const plan=planGroupQuizzes({log:{},settledThrough:'2026-09-01',members:2,classmates:[],now:noon});
 assert.equal(plan.penalties.length,MAX_CATCH_UP_DAYS);
 assert.equal(plan.penalties[0].day,addDays('2026-10-14',-MAX_CATCH_UP_DAYS));
});

test('buying with gold subtracts from the balance and never goes negative',()=>{
 const g=()=>useGame.getState();g().reset();g().set({coins:100});
 assert.equal(g().spend(60),true);assert.equal(g().coins,40);
 assert.equal(g().spend(50),false);assert.equal(g().coins,40);
 assert.equal(g().spend(-5),false);assert.equal(g().coins,40);g().reset();
});
test('quizzes pay nutrients and gold once, but replays still count toward today’s goal',()=>{
 const g=()=>useGame.getState();g().reset();
 assert.equal(g().complete(0,'gemini:q1',50,10),true);assert.equal(g().energy,110);assert.equal(g().coins,10);
 assert.equal(g().complete(0,'gemini:q1',50,10),false);assert.equal(g().energy,110);assert.equal(g().coins,10);
 assert.equal(quizzesOn(g().quizLog,questDay()),1);
 g().complete(0,'python:0',20,4);assert.equal(quizzesOn(g().quizLog,questDay()),2);assert.equal(g().coins,14);g().reset();
});
test('settling charges the tree once per missed day and stops at zero',()=>{
 const g=()=>useGame.getState();g().reset();
 g().set({online:[true,false,false,false],energy:100,quizSettledThrough:'2026-10-12',quizLog:{'2026-10-13':['0:a']}});
 g().settleGroupQuizzes(noon);
 assert.equal(g().energy,100-3*GROUP_QUIZ_PENALTY);assert.equal(g().quizSettledThrough,'2026-10-13');
 g().settleGroupQuizzes(noon);assert.equal(g().energy,100-3*GROUP_QUIZ_PENALTY);
 g().set({energy:10,quizSettledThrough:'2026-10-12'});g().settleGroupQuizzes(noon);assert.equal(g().energy,0);g().reset();
});
test('classmate quizzes grow the tree and are credited only once',()=>{
 const g=()=>useGame.getState();g().reset();g().set({quizSettledThrough:'2026-10-13'});
 const due=[1,2,3].filter(m=>{const at=classmateQuizMinute('2026-10-14',m);return at!==null&&at<=12*60;});
 g().settleGroupQuizzes(noon);
 assert.equal(g().energy,60+20*due.length);assert.equal(quizzesOn(g().quizLog,'2026-10-14'),due.length);
 assert.deepEqual(g().completions.map(c=>c.id),due.map(m=>`${m}:${classmateQuizId('2026-10-14')}`));
 g().settleGroupQuizzes(noon);assert.equal(g().energy,60+20*due.length);g().reset();
});
