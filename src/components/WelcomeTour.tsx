'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Archive,BookOpen,Flower2,ShoppingBag,Users,UserRound,Settings,Sparkles,ArrowRight,ArrowLeftRight,Check,Undo2,X,Hand} from 'lucide-react';
import {useGame} from '@/store/game';
import {useItemDrag,useMoveLesson} from '@/store/item-drag';
import './welcome-tour.css';

type Step={
  id:string;
  /** Element to spotlight; steps without one sit centred (or docked while waiting). */
  target?:string;
  title:string;
  body:ReactNode;
  /** Waiting steps leave the room playable and advance when the player acts. */
  wait?:'pickup'|'place';
};

const menu:[typeof Archive,string][]=[
  [Archive,'Collection'],[BookOpen,'Learn'],[Flower2,'Garden'],[ShoppingBag,'Shop'],
  [Users,'Friends'],[UserRound,'You'],[Settings,'Settings'],
];
const actions:[typeof Archive,string,string][]=[
  [Check,'Place','keep it'],[ArrowLeftRight,'Flip','turn it'],[Undo2,'Cancel','undo'],[X,'X','put away'],
];

// One short idea per card: the spotlight does the explaining.
const steps:Step[]=[
  {id:'welcome',title:'Welcome to your greenhouse',body:<p>Let’s take a quick look around.</p>},
  {id:'menu',target:'.hud nav',title:'Your menu',body:<ul className="tour-chips">{menu.map(([Icon,name])=><li key={name}><Icon size={15} aria-hidden="true"/>{name}</li>)}</ul>},
  {id:'party',target:'.party-roster',title:'Your room',body:<p>Who’s here, your gold, and how close the tree is to growing.</p>},
  // Outline what is actually on screen: the open scroll, or the launcher when minimised.
  {id:'quests',target:'.quest-widget>:is(.quest-menu,.quest-launcher)',title:'Daily quests',body:<p>Small goals that reset each day.</p>},
  {id:'board',target:'.board-widget>*',title:'Leaderboard',body:<p>This week’s top learners.</p>},
  {id:'pickup',wait:'pickup',title:'Move furniture',body:<p className="tour-gesture"><Hand size={22} aria-hidden="true"/><span><strong>Press and hold</strong> on a desk, then <strong>drag</strong> it to a new spot.</span></p>},
  {id:'place',wait:'place',target:'.item-placer',title:'Set it down',body:<><p>Hold and drag it again to adjust, then choose:</p><ul className="tour-chips">{actions.map(([Icon,name,text])=><li key={name}><Icon size={15} aria-hidden="true"/><strong>{name}</strong>{text}</li>)}</ul></>},
  {id:'collection',target:'.collection-launcher',title:'Collection',body:<p>Put-away and new furniture waits here.</p>},
  {id:'done',title:'You’re all set!',body:<p>Sit at a desk to start learning.</p>},
];

type Layout={rect:{left:number;top:number;width:number;height:number}|null;vw:number;vh:number;cw:number;ch:number};
const sameLayout=(a:Layout,b:Layout)=>a.vw===b.vw&&a.vh===b.vh&&a.cw===b.cw&&a.ch===b.ch&&(a.rect===b.rect||!!a.rect&&!!b.rect&&
  Math.abs(a.rect.left-b.rect.left)<.5&&Math.abs(a.rect.top-b.rect.top)<.5&&Math.abs(a.rect.width-b.rect.width)<.5&&Math.abs(a.rect.height-b.rect.height)<.5);

/** Beside the target where it fits: below, above, right, then left. Docked cards
 * sit at the bottom centre, below the floor, so the room stays free to use. */
function cardPosition({rect,vw,vh,cw,ch}:Layout,docked:boolean){
  const gap=14,m=16,clampX=(x:number)=>Math.max(m,Math.min(x,vw-cw-m)),clampY=(y:number)=>Math.max(m,Math.min(y,vh-ch-m));
  if(docked)return {left:clampX((vw-cw)/2),top:vh-ch-m};
  if(!rect)return {left:clampX((vw-cw)/2),top:clampY((vh-ch)/2)};
  const cx=clampX(rect.left+rect.width/2-cw/2),cy=clampY(rect.top+rect.height/2-ch/2);
  if(rect.top+rect.height+gap+ch<=vh-m)return {left:cx,top:rect.top+rect.height+gap};
  if(rect.top-gap-ch>=m)return {left:cx,top:rect.top-gap-ch};
  if(rect.left+rect.width+gap+cw<=vw-m)return {left:rect.left+rect.width+gap,top:cy};
  if(rect.left-gap-cw>=m)return {left:rect.left-gap-cw,top:cy};
  return {left:cx,top:vh-ch-m};
}

export default function WelcomeTour({paused,onClose,onShowQuests}:{paused:boolean;onClose:()=>void;onShowQuests:()=>void}){
  const name=useGame(state=>state.name);
  const preview=useItemDrag(state=>state.preview);
  const taps=useMoveLesson(state=>state.taps);
  const [index,setIndex]=useState(0);
  const [layout,setLayout]=useState<Layout>({rect:null,vw:0,vh:0,cw:0,ch:0});
  const card=useRef<HTMLElement>(null),primary=useRef<HTMLButtonElement>(null);
  const step=steps[index],last=index===steps.length-1;
  const next=()=>last?onClose():setIndex(index+1);
  // The placement step only makes sense while a piece is being moved.
  const back=()=>setIndex(steps[index-1]?.wait==='place'?index-2:index-1);

  // Waiting steps follow the player's own drag rather than a Next button.
  useEffect(()=>{
    if(step.wait==='pickup'&&preview)setIndex(i=>i+1);
    else if(step.wait==='place'&&!preview)setIndex(i=>i+1);
  },[step.wait,preview]);

  // Unfold the quest scroll so the spotlight has something to show.
  useEffect(()=>{if(step.id==='quests')onShowQuests();},[step.id,onShowQuests]);

  // While teaching furniture moves, a quick click explains itself instead of walking off to study.
  useEffect(()=>{
    if(!step.wait||paused)return;
    useMoveLesson.setState({active:true,taps:0});
    return()=>useMoveLesson.setState({active:false,taps:0});
  },[step.wait,paused]);

  // Targets move (the placement toolbar follows the piece), so track them each frame.
  useEffect(()=>{
    if(paused)return;
    let frame=0;
    const tick=()=>{
      const box=step.target?document.querySelector(step.target)?.getBoundingClientRect():undefined;
      const next:Layout={rect:box&&box.width>0?{left:box.left,top:box.top,width:box.width,height:box.height}:null,
        vw:window.innerWidth,vh:window.innerHeight,cw:card.current?.offsetWidth??0,ch:card.current?.offsetHeight??0};
      setLayout(current=>sameLayout(current,next)?current:next);
      frame=requestAnimationFrame(tick);
    };
    tick();
    return()=>cancelAnimationFrame(frame);
  },[step.target,paused]);

  // Waiting steps keep focus in the room so Enter still places the piece.
  useEffect(()=>{if(!paused&&!step.wait)primary.current?.focus({preventScroll:true});},[index,paused,step.wait]);

  if(paused)return null;
  const pad=8,spot=layout.rect&&{left:layout.rect.left-pad,top:layout.rect.top-pad,width:layout.rect.width+pad*2,height:layout.rect.height+pad*2};
  const position=layout.cw?cardPosition(layout,!!step.wait):undefined;
  return <div className={`welcome-tour${step.wait?' is-waiting':''}`}>
    {!step.wait&&<div className={`tour-blocker${spot?'':' is-dim'}`} aria-hidden="true"/>}
    {spot&&<div key={step.id} className="tour-spotlight" style={spot} aria-hidden="true"/>}
    <section ref={card} key={`card-${step.id}`} className={`tour-card${step.id==='welcome'?' is-intro':''}${step.wait?' is-docked':''}${position?'':' is-measuring'}`} style={position} role="dialog" aria-modal={!step.wait} aria-labelledby="tour-title" aria-describedby="tour-body">
      <header>
        {step.id==='welcome'
          ?<span className="tour-count"><Sparkles size={13} aria-hidden="true"/> New here?</span>
          :<span className="tour-progress" aria-label={`Step ${index} of ${steps.length-1}`}><b>{index}</b><span aria-hidden="true">/</span>{steps.length-1}<span className="tour-dots" aria-hidden="true">{steps.slice(1).map((s,i)=><i key={s.id} className={i<index?'is-done':''}/>)}</span></span>}
        {!last&&<button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>}
      </header>
      <h2 id="tour-title">{step.id==='welcome'?`Welcome, ${name}!`:step.title}</h2>
      <div id="tour-body" className="tour-body">{step.body}</div>
      {step.id==='place'&&preview?.phase==='dragging'&&<p className="tour-tip" role="status">Let go to drop it.</p>}
      {step.id==='pickup'&&taps>0&&<p className="tour-tip is-nudge" role="status">Almost! Keep the button held down while you move the mouse.</p>}
      <footer>
        {index>0&&!step.wait&&<button type="button" className="secondary" onClick={back}>Back</button>}
        {step.wait
          ?<button type="button" className="secondary" onClick={()=>step.wait==='place'?useItemDrag.getState().cancel():setIndex(index+2)}>Skip this part</button>
          :<button ref={primary} type="button" className="primary" onClick={next}>{step.id==='welcome'?'Show me around':last?'Start exploring':'Next'} <ArrowRight size={16} aria-hidden="true"/></button>}
      </footer>
    </section>
  </div>;
}
