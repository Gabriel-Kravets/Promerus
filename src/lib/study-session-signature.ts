import {createHmac,timingSafeEqual} from 'node:crypto';
import {difficulties,validQuiz,type StudySession} from './study-quiz';
function payload(session:StudySession){return JSON.stringify([session.id,session.topic,session.difficulty,session.quiz,session.rewardId||session.id]);}
export function signSession(session:StudySession,key:string):StudySession{return {...session,signature:createHmac('sha256',key).update(payload(session)).digest('hex')};}
export function verifySession(value:unknown,key:string):value is StudySession{
 const s=value as StudySession;if(!s||typeof s.id!=='string'||typeof s.topic!=='string'||!difficulties.includes(s.difficulty)||!validQuiz(s.quiz)||typeof s.signature!=='string'||!/^[0-9a-f]{64}$/.test(s.signature))return false;
 const expected=signSession(s,key).signature!;return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(s.signature,'hex'));
}
