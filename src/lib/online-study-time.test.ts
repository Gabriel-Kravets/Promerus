import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceOnlineTime,formatStudyTime} from './online-study-time';
test('daily app time accumulates across visits without counting overlapping tabs or offline gaps',()=>{
 const start=new Date(2026,9,18,12).getTime();
 let saved=advanceOnlineTime(null,start,start+1000);assert.equal(saved.seconds,1);
 saved=advanceOnlineTime(saved,start,start+1000);assert.equal(saved.seconds,1);
 saved=advanceOnlineTime(saved,start+500,start+2000);assert.equal(saved.seconds,2);
 saved=advanceOnlineTime(saved,start+60000,start+61000);assert.equal(saved.seconds,3);
});
test('local midnight resets the total and only includes the new-day part of an interval',()=>{
 const midnight=new Date(2026,9,19).getTime();
 const previous=advanceOnlineTime(null,midnight-11000,midnight-1000);
 const next=advanceOnlineTime(previous,midnight-1000,midnight+1000);
 assert.equal(previous.seconds,10);assert.equal(next.seconds,1);assert.notEqual(next.day,previous.day);
});
test('study duration uses hours, minutes and seconds',()=>{
 assert.equal(formatStudyTime(0),'00:00:00');assert.equal(formatStudyTime(59),'00:00:59');assert.equal(formatStudyTime(3661),'01:01:01');assert.equal(formatStudyTime(86399),'23:59:59');
});
