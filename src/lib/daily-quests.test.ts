import {test} from 'node:test';
import assert from 'node:assert/strict';
import {questDay,nextQuestReset,hasDailyQuest} from './daily-quests';
test('all members share New York days regardless of browser time zone',()=>{
 assert.equal(questDay(new Date('2026-10-20T03:59:59Z')),'2026-10-19');
 assert.equal(questDay(new Date('2026-10-20T04:00:00Z')),'2026-10-20');
});
test('New York daily deadlines respect 23 and 25 hour daylight-saving days',()=>{
 const spring=new Date('2026-03-08T05:00:00Z'),fall=new Date('2026-11-01T04:00:00Z');
 assert.equal(nextQuestReset(spring).getTime()-spring.getTime(),23*3600000);
 assert.equal(nextQuestReset(fall).getTime()-fall.getTime(),25*3600000);
});
test('one complete quest protects the player; partial progress does not',()=>{
 const empty={science_cards:0,focus_seconds:0,lesson_completed:false};
 assert.equal(hasDailyQuest(empty),false);
 assert.equal(hasDailyQuest({...empty,science_cards:2,focus_seconds:1199}),false);
 assert.equal(hasDailyQuest({...empty,science_cards:3}),true);
 assert.equal(hasDailyQuest({...empty,focus_seconds:1200}),true);
 assert.equal(hasDailyQuest({...empty,lesson_completed:true}),true);
});

test('quest protection is shown only after confirmed progress and synchronization errors take priority',async()=>{
 const {dailyQuestNotice}=await import('./daily-quests');
 const status={day:'2026-10-19',resets_at:'2026-10-20T04:00:00Z',time_zone:'America/New_York',science_cards:0,focus_seconds:0,lesson_completed:false,penalties_start_on:'2026-10-19',eligible_from:'2026-10-19'};
 assert.match(dailyQuestNotice(true,null,''),/Confirming/);
 assert.match(dailyQuestNotice(true,status,''),/10 nutrients/);
 assert.match(dailyQuestNotice(true,{...status,lesson_completed:true},''),/protected/);
 assert.equal(dailyQuestNotice(true,{...status,lesson_completed:true},'Sync failed'),'Sync failed');
 assert.match(dailyQuestNotice(true,{...status,eligible_from:'2026-10-20'},''),/begin.*2026-10-20/);
 assert.match(dailyQuestNotice(true,{...status,eligible_from:null},''),/Join a greenhouse/);
});
