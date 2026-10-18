import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberTopic,type TopicHistoryEntry} from './topic-history';
test('revisiting a topic moves it to the top without duplicating the same difficulty',()=>{
 const old:TopicHistoryEntry[]=[{topic:'Python loops',difficulty:'Beginner',studiedAt:1},{topic:'Python loops',difficulty:'Advanced',studiedAt:2}];
 const history=rememberTopic(old,{topic:' python LOOPS ',difficulty:'Beginner',studiedAt:3});
 assert.equal(history.length,2);assert.equal(history[0].topic,'python LOOPS');assert.equal(history[0].studiedAt,3);assert.equal(history[1].difficulty,'Advanced');assert.equal(old[0].studiedAt,1);
});
test('the study journal retains three pages of the most recent topic and difficulty pairs',()=>{
 const old:TopicHistoryEntry[]=Array.from({length:50},(_,i)=>({topic:`Topic ${i}`,difficulty:'Beginner',studiedAt:i}));
 const history=rememberTopic(old,{topic:'New topic',difficulty:'Intermediate',studiedAt:100});
 assert.equal(history.length,18);assert.equal(history[0].topic,'New topic');assert.equal(history.at(-1)?.topic,'Topic 16');
});
