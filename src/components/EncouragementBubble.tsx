'use client';
import {useEffect,useRef,useState} from 'react';

const messages=[
 'Every small step helps you grow.',
 'You are learning more with every try.',
 'Take your time and trust yourself.',
 'Your curiosity is making roots.',
 'A little practice brings you closer.',
 'Keep going, your garden believes in you.'
];

export default function EncouragementBubble({notice,onNoticeComplete}:{notice:string;onNoticeComplete:()=>void}){
 const [index,setIndex]=useState(0);
 const bubble=useRef<HTMLParagraphElement>(null);
 const complete=useRef(onNoticeComplete);complete.current=onNoticeComplete;
 useEffect(()=>{
  const node=bubble.current;if(!node)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // One animation owns the entire cycle; text changes only after its hidden pause.
  const animation=node.animate(reduced?[{opacity:1},{opacity:1}]:[
   {opacity:0,offset:0},
   {opacity:1,offset:2/12},
   {opacity:1,offset:7/12},
   {opacity:0,offset:10/12},
   {opacity:0,offset:1}
  ],{duration:12000,easing:'linear',fill:'both'});
  animation.onfinish=()=>{if(notice)complete.current();else setIndex(previous=>(previous+1)%messages.length);};
  return()=>{animation.onfinish=null;animation.cancel();};
 },[index,notice]);
 return <p ref={bubble} className="companion-encouragement" role={notice?'status':undefined} aria-live={notice?'polite':'off'}>{notice||messages[index]}</p>;
}
