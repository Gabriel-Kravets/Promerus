import {test} from 'node:test';
import assert from 'node:assert/strict';
import {iso,uniso,pathfind,blocked,stageFor} from './movement';
import {courses} from './courses';
import {approaches} from './world-layout';
import {useGame} from '../store/game';
test('isometric projection round-trips',()=>{for(let x=0;x<12;x++)for(let y=0;y<12;y++){assert.deepEqual(uniso(iso(x,y).x,iso(x,y).y),{x,y});}});
test('navigation takes only adjacent walkable steps around garden',()=>{const path=pathfind({x:3,y:5},{x:8,y:5});assert.ok(path.length>5);let last={x:3,y:5};for(const p of path){assert.equal(blocked(p.x,p.y),false);assert.equal(Math.abs(p.x-last.x)+Math.abs(p.y-last.y),1);last=p;}assert.deepEqual(last,{x:8,y:5});assert.deepEqual(pathfind({x:2,y:3},{x:5,y:5}),[]);assert.deepEqual(pathfind({x:2,y:3},{x:12,y:3}),[]);});
test('all interactive approaches are reachable',()=>{for(const p of [...approaches,{x:2,y:1},{x:6,y:1},{x:5,y:8},{x:11,y:4},{x:10,y:0},{x:1,y:3},{x:0,y:10}]){assert.ok(pathfind({x:0,y:0},p).length>0);}});
test('fifteen complete lessons have four choices and valid answers',()=>{assert.equal(Object.keys(courses).length,3);for(const c of Object.values(courses)){assert.equal(c.lessons.length,5);for(const l of c.lessons){assert.equal(l.questions.length,3);for(const q of l.questions){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(q.explanation.length>10);}}}});
test('replays cannot mint energy and quest needs distinct identities',()=>{useGame.getState().reset();const g=()=>useGame.getState();assert.equal(g().complete(0,'python:0'),true);assert.equal(g().energy,80);assert.equal(g().complete(0,'python:0'),false);assert.equal(g().energy,80);g().complete(0,'python:1');assert.equal(new Set(g().completions.map(c=>c.player)).size,1);g().complete(1,'algebra:0');assert.equal(new Set(g().completions.map(c=>c.player)).size,2);assert.equal(g().energy,120);g().reset();});
test('garden thresholds are stable',()=>{assert.deepEqual([0,99,100,179,180,299,300].map(stageFor),[0,0,1,1,2,2,3]);});

test('classmates start offline without changing progression',()=>{useGame.getState().reset();assert.deepEqual(useGame.getState().online,[true,false,false,false]);useGame.getState().set({online:[true,true,false,false]});assert.equal(useGame.getState().energy,60);useGame.getState().reset();});
