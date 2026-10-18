export const difficulties = ['Beginner', 'Intermediate', 'Advanced'] as const;
export type Difficulty = typeof difficulties[number];
export type QuizQuestion = {question:string; A:string; B:string; C:string; D:string; correct_answer:'A'|'B'|'C'|'D'; explanation:string};
export type StudyQuiz = {multiple_choice:QuizQuestion[]; short_answer:{question:string;correct_answer:string;explanation:string;grading_criteria:string}};
export type StudySession = {id:string;topic:string;difficulty:Difficulty;quiz:StudyQuiz;signature?:string;rewardId?:string};
export type QuizResult = {score:number;correct:boolean[];nutrients:number;coins:number};
export function rewards(score:number,difficulty:Difficulty){const nutrients=score*({Beginner:10,Intermediate:20,Advanced:30}[difficulty]);return {nutrients,coins:Math.floor(nutrients/5)};}
export function validQuiz(value:unknown):value is StudyQuiz {
 const q=value as StudyQuiz;
 const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=5000;
 return !!q&&Array.isArray(q.multiple_choice)&&q.multiple_choice.length===4&&q.multiple_choice.every(x=>x&&text(x.question)&&text(x.explanation)&&['A','B','C','D'].includes(x.correct_answer)&&[x.A,x.B,x.C,x.D].every(text)&&new Set([x.A,x.B,x.C,x.D].map(v=>v.trim().toLowerCase())).size===4)&&!!q.short_answer&&[q.short_answer.question,q.short_answer.correct_answer,q.short_answer.explanation,q.short_answer.grading_criteria].every(text);
}
