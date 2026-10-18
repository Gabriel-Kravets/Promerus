import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addTopicActivity,mostStudiedTopics,recordQuizActivity,type TopicStats} from './topic-stats';
import type {QuizLog} from './topic-history';
const log:QuizLog={session:{id:'quiz-1',topic:'Plants',difficulty:'Beginner',quiz:{multiple_choice:[],short_answer:{question:'',correct_answer:'',explanation:'',grading_criteria:''}}},answers:['A','B','',''],answer:'Water uptake',result:null,page:2};
test('answer changes and reopening a quiz do not inflate totals; retries count as separate attempts',()=>{
 let stats=recordQuizActivity([],log);assert.equal(stats[0].questions,3);
 stats=recordQuizActivity(stats,{...log,answers:['C','B','','']});assert.equal(stats[0].questions,3);
 const finished={...log,result:{score:3,correct:[true,true,false,false,true],nutrients:30,coins:6}};
 stats=recordQuizActivity(stats,finished);stats=recordQuizActivity(stats,finished);assert.equal(stats[0].lessons,1);
 stats=recordQuizActivity(stats,{...finished,session:{...log.session,id:'retry-1'}});assert.equal(stats[0].lessons,2);assert.equal(stats[0].questions,6);
});
test('topic names merge regardless of case and flashcard reveals are deduplicated',()=>{
 let stats=addTopicActivity([],' Plants ',{kind:'flashcards',event:'card:1'});
 stats=addTopicActivity(stats,'plants',{kind:'flashcards',event:'card:1'});stats=addTopicActivity(stats,'PLANTS',{seconds:12});
 assert.equal(stats.length,1);assert.equal(stats[0].flashcards,1);assert.equal(stats[0].seconds,12);
});
test('top three prioritize completed lessons then time and keep the underlying data unchanged',()=>{
 const stats:TopicStats[]=Array.from({length:7},(_,i)=>({topic:`Topic ${i}`,lessons:i===6?1:0,seconds:i*20,questions:0,flashcards:0,events:[]}));
 const ranked=mostStudiedTopics(stats);assert.equal(ranked.length,3);assert.equal(ranked[0].topic,'Topic 6');assert.equal(ranked[1].topic,'Topic 5');assert.equal(stats[0].topic,'Topic 0');
});
