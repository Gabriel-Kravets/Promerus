import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultStudySave,readStudySave,writeStudySave,dailyQuests,currentStudyDay,STUDY_STORAGE_KEY,STUDY_PROGRESS_EVENT} from './study-progress';
import {createWalkCycle} from './walk-cycle';

// Isolated browser primitives; no real account or stored game data is accessed.
function browserFixture(run:(events:EventTarget,storage:Map<string,string>)=>void){
 const storage=new Map<string,string>(),events=new EventTarget();
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:events});
 try{run(events,storage);}finally{
  if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');
  if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
 }
}

test('study writes notify the mounted greenhouse after persisting fresh quest progress',()=>browserFixture((events)=>{
 let progress:number[]=[];
 events.addEventListener(STUDY_PROGRESS_EVENT,()=>{progress=dailyQuests(readStudySave(4),4).map(q=>q.value);});
 writeStudySave({...defaultStudySave(4),seen:['Science:0','Science:1','Science:2'],focusSeconds:1200});
 assert.deepEqual(progress,[3,20,0]);
}));

test('old-day quests reset without destroying a running focus session',()=>browserFixture((_,storage)=>{
 const endAt=Date.now()+60000;
 storage.set(STUDY_STORAGE_KEY,JSON.stringify({...defaultStudySave(2),date:'2000-01-01',seen:['Science:0'],focusSeconds:1200,endAt}));
 const save=readStudySave(5);
 assert.deepEqual(dailyQuests(save,5).map(q=>q.value),[0,0,0]);
 assert.equal(save.endAt,endAt);assert.ok(save.seconds>0&&save.seconds<=60);
}));

test('corrupt study saves and invalid lesson baselines cannot complete quests',()=>browserFixture((_,storage)=>{
 storage.set(STUDY_STORAGE_KEY,'{invalid');assert.deepEqual(readStudySave(4),defaultStudySave(4));
 storage.set(STUDY_STORAGE_KEY,JSON.stringify({...defaultStudySave(4),lessonBaseline:-10}));
 assert.equal(dailyQuests(readStudySave(4),4)[2].value,0);
}));

test('system reduced motion suppresses gait without losing movement or resume state',()=>{
 const cycle=createWalkCycle({x:0,y:0});
 assert.deepEqual(cycle({x:50,y:0},false),{frame:-1,bob:0,lean:0});
 assert.deepEqual(cycle({x:50,y:0}),{frame:-1,bob:0,lean:0});
 assert.ok(cycle({x:61,y:0}).frame>=0);
});

test('day rollover keeps its baseline when the next lesson finishes',()=>browserFixture((_,storage)=>{
 storage.set(STUDY_STORAGE_KEY,JSON.stringify({...defaultStudySave(2),date:'2000-01-01'}));
 assert.equal(readStudySave(5).lessonBaseline,5);
 assert.equal(dailyQuests(readStudySave(6),6)[2].value,1);
 const stale={...defaultStudySave(2),date:'2000-01-01',seen:['Science:0'],focusSeconds:500};
 const next=currentStudyDay(stale,5);
 assert.deepEqual(next.seen,[]);assert.equal(next.focusSeconds,0);assert.equal(next.lessonBaseline,5);
 assert.equal(currentStudyDay(next,6),next);
}));
