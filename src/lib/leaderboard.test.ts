import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekStart,weeklyLeaderboard,daysUntilReset} from './leaderboard';

const wednesday=new Date(2026,9,14,15,0).getTime();
test('weeks start on Monday at local midnight',()=>{
 assert.equal(weekStart(wednesday),new Date(2026,9,12,0,0).getTime());
 assert.equal(daysUntilReset(wednesday),5);
});
test('only lessons from this week add to placeholder totals, ranked highest first',()=>{
 const names=['You','Maya','Kai','Jules'];
 const rows=weeklyLeaderboard(names,[
  {id:'a',player:0,lesson:'x',at:wednesday-1000},
  {id:'b',player:0,lesson:'y',at:new Date(2026,9,5).getTime()},
  {id:'c',player:0,lesson:'z'},
  {id:'d',player:3,lesson:'w',at:wednesday-5000},
  {id:'e',player:3,lesson:'v',at:wednesday-6000}
 ],wednesday);
 assert.deepEqual(rows.map(r=>[r.name,r.energy,r.rank]),[['Maya',140,1],['Kai',100,2],['Jules',100,2],['You',20,4]]);
});
