'use client';
import {useEffect,useId,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
import type {Avatar} from '@/store/game';
import {avatarHeadAsset} from '@/lib/sprite-assets';
export function PlayerPortrait({avatar,name,offline=false}:{avatar:Avatar;name:string;offline?:boolean}){
 const [url,setURL]=useState('');useEffect(()=>{let active=true;avatarHeadAsset(avatar).then(src=>{if(active)setURL(src);}).catch(()=>{});return()=>{active=false;};},[avatar]);
 return <span className={`player-head ${offline?'is-offline':''}`}>{url?<img src={url} alt={`${name}’s avatar head`}/>:<span aria-label={`${name}’s portrait loading`}>{name.charAt(0)}</span>}<i aria-hidden="true"/></span>;
}
export function GameIconButton({label,tooltip,children,selected=false,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string;tooltip:string;selected?:boolean;children:ReactNode}){
 const id=useId();return <span className="game-icon-control"><button {...props} aria-label={label} aria-describedby={id} aria-pressed={selected}>{children}</button><span id={id} role="tooltip" className="game-tooltip">{tooltip}</span></span>;
}
export function GamePanelHeader({eyebrow,title,children}:{eyebrow:string;title:string;children?:ReactNode}){return <header className="game-panel-header"><span className="eyebrow">{eyebrow}</span><h1 id="panel-title">{title}</h1>{children&&<p className="lead">{children}</p>}</header>;}
export function GameBadge({children,muted=false}:{children:ReactNode;muted?:boolean}){return <span className={`game-badge ${muted?'muted':''}`}>{children}</span>;}
export function ProgressMeter({value,max,label}:{value:number;max:number;label:string}){return <div className="bar game-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value,max)}><span style={{width:`${Math.min(value/max*100,100)}%`}}/></div>;}
/** Stardew-style friendship row: chunky pixel hearts, filled up to value. */
export function HeartMeter({value,max=5,label}:{value:number;max?:number;label:string}){return <span className="heart-meter" role="img" aria-label={`${label}: ${Math.min(value,max)} of ${max} hearts`}>{Array.from({length:max},(_,i)=><svg key={i} viewBox="0 0 7 6" className={i<value?'full':''} aria-hidden="true"><path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/></svg>)}</span>;}
