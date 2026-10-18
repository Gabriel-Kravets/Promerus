'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,GripVertical,Leaf,Pause,Play,RotateCcw} from 'lucide-react';

const collapsedKey='sproutbound-focus-menu-collapsed';
const positionKey='sproutbound-focus-widget-position';
type Position={x:number;y:number};
export default function FocusTimerWidget({seconds,duration,running,onToggle,onReset}:{seconds:number;duration:number;running:boolean;onToggle:()=>void;onReset:()=>void}){
 const [collapsed,setCollapsed]=useState(true);
 const widget=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;origin:Position}|null>(null);
 const [position,setPosition]=useState<Position|null>(null),[dragging,setDragging]=useState(false);
 const latest=useRef<Position|null>(null);
 function move(p:Position){const rect=widget.current?.getBoundingClientRect();const next={x:Math.max(8,Math.min(p.x,window.innerWidth-(rect?.width||180)-8)),y:Math.max(8,Math.min(p.y,window.innerHeight-(rect?.height||40)-8))};latest.current=next;setPosition(next);}
 function save(){if(latest.current)try{localStorage.setItem(positionKey,JSON.stringify(latest.current));}catch{}}
 function finish(){drag.current=null;setDragging(false);save();}
 const panelId=useId();
 const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 useEffect(()=>{try{setCollapsed(localStorage.getItem(collapsedKey)!=='false');}catch{}},[]);
 useEffect(()=>{
  let saved:Position|null=null;try{const value=JSON.parse(localStorage.getItem(positionKey)||'null');if(value&&Number.isFinite(value.x)&&Number.isFinite(value.y))saved=value;}catch{}
  move(saved||{x:window.innerWidth-188,y:8});
  const resize=()=>{if(latest.current){move(latest.current);save();}};
  window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
 },[]);
 useEffect(()=>{if(latest.current){move(latest.current);save();}},[collapsed]);
 function toggle(){const next=!collapsed;setCollapsed(next);try{localStorage.setItem(collapsedKey,String(next));}catch{}}
 return <div ref={widget} className={`focus-widget focus-menu ${collapsed?'collapsed':''} ${dragging?'dragging':''}`} style={position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined}>
  <div className="focus-menu-header">
  <button type="button" className="focus-menu-grip" aria-label="Move focus timer; use arrow keys to reposition" title="Drag to move" onPointerDown={e=>{if(e.button!==0)return;const rect=widget.current!.getBoundingClientRect();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,origin:{x:rect.left,y:rect.top}};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}} onPointerMove={e=>{const start=drag.current;if(start&&start.id===e.pointerId)move({x:start.origin.x+e.clientX-start.x,y:start.origin.y+e.clientY-start.y});}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{if(drag.current)finish();}} onKeyDown={e=>{const step=e.shiftKey?20:5;const directions:Record<string,Position>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};const delta=directions[e.key];if(!delta)return;e.preventDefault();const rect=widget.current!.getBoundingClientRect();move({x:rect.left+delta.x,y:rect.top+delta.y});save();}}><GripVertical size={14} aria-hidden="true"/></button>
  <button type="button" className="focus-widget-handle" aria-expanded={!collapsed} aria-controls={panelId} aria-label={`${collapsed?'Expand':'Collapse'} focus timer, ${time} remaining`} onClick={toggle}><Leaf size={13} aria-hidden="true"/><span>Focus</span><span className="focus-menu-summary" aria-hidden="true">{time}</span><ChevronDown size={14} aria-hidden="true" style={{transform:collapsed?undefined:'rotate(180deg)'}}/></button>
  </div>
  <div id={panelId} hidden={collapsed}>
   <div className="focus-widget-body"><div className="focus-widget-dial" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" className="focus-ring-track"/><circle cx="20" cy="20" r="16" className="focus-ring-progress" pathLength="100" strokeDasharray={`${Math.max(0,Math.min(100,(1-seconds/(duration*60))*100))} 100`}/></svg><Leaf size={15}/></div><div className="focus-widget-time" role="timer" aria-live="off" aria-label={`${Math.floor(seconds/60)} minutes ${seconds%60} seconds remaining`}><strong>{time}</strong><span>{running?'Growing your focus':'A moment to focus'}</span></div></div>
   <div className="focus-widget-controls"><button type="button" onClick={onToggle} aria-label={running?'Pause focus timer':'Start focus timer'}>{running?<Pause size={13}/>:<Play size={13}/>}<span>{running?'Pause':'Start'}</span></button><button type="button" onClick={onReset} aria-label="Reset focus timer"><RotateCcw size={13}/><span>Reset</span></button></div>
  </div>
 </div>;
}
