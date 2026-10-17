'use client';
import {useEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Sprite,Texture,Rectangle,Text,FederatedPointerEvent} from 'pixi.js';
import {useGame,presets} from '@/store/game';
import {avatarAsset,loadImage} from '@/lib/sprite-assets';
import {iso,uniso,planRoute,approachRoute,distance,stageFor,blocked,Point} from '@/lib/movement';
import {studyStations,deskOutline,approaches,gardenApproaches,treeCenter} from '@/lib/world-layout';
import {contains,floorShape,gardenHotspot,furnitureRegions,pickInteraction,Shape} from '@/lib/world-geometry';
import {createWalkCycle} from '@/lib/walk-cycle';
import {createWorldEffects} from '@/lib/world-effects';

type Props={suspended?:boolean;onOpen:(panel:string,player?:number)=>void;onHint:(text:string)=>void};
type Interaction={id:string;name:string;action:string;symbol:string;priority:number;contains:(p:Point)=>boolean;shape:Shape;approaches:Point[];activate:()=>void;lookAt?:Point;preferFirst?:boolean};
const drawShape=(g:Graphics,shape:Shape)=>shape.kind==='ellipse'?g.ellipse(shape.x,shape.y,shape.rx,shape.ry):g.poly(shape.points);

export default function GameCanvas({onOpen,onHint,suspended=false}:Props){
 const host=useRef<HTMLDivElement>(null),handlers=useRef({onOpen,onHint,suspended});handlers.current={onOpen,onHint,suspended};
 const [error,setError]=useState(false);
 useEffect(()=>{
  let disposed=false,unsubscribe=()=>{},observer:ResizeObserver|undefined,visibility=()=>{},destroyEffects=()=>{};
  const app=new Application();
  const run=async()=>{
   await app.init({backgroundAlpha:0,antialias:false,resolution:Math.min(devicePixelRatio,2),autoDensity:true,width:1320,height:744});
   if(disposed){app.destroy(true);return;}host.current!.appendChild(app.canvas);
   const scene=new Container();app.stage.addChild(scene);
   const resize=()=>{if(!host.current)return;const r=host.current.getBoundingClientRect();app.renderer.resize(r.width,r.height);const scale=Math.min(r.width/1320,r.height/744);scene.scale.set(scale);scene.position.set((r.width-1320*scale)/2,(r.height-744*scale)/2);};
   observer=new ResizeObserver(resize);observer.observe(host.current!);resize();
   const texture=async(url:string)=>{const t=Texture.from(await loadImage(url));t.source.scaleMode='nearest';return t;};
   const [room,propSheet,gardenSheet]=await Promise.all(['/assets/greenhouse-room.png','/assets/study-and-companions.png','/assets/garden-stages.png'].map(texture));
   if(disposed)return;
   // One scene-level pointer dispatcher: visual sprites never compete with the floor for events.
   scene.eventMode='static';scene.hitArea=new Rectangle(0,0,1320,744);
   const plate=new Sprite(room);plate.width=1320;plate.height=744;plate.eventMode='none';scene.addChild(plate);
   const frame=(sheet:Texture,col:number,row:number)=>new Texture({source:sheet.source,frame:new Rectangle(sheet.width/2*col,sheet.height/2*row,sheet.width/2,sheet.height/2)});
   const gardenTextures=[new Rectangle(0,0,768,480),new Rectangle(768,0,768,480),new Rectangle(0,480,768,544),new Rectangle(768,480,768,544)].map(frame=>new Texture({source:gardenSheet.source,frame}));
   const deskTextures=[frame(propSheet,0,0),frame(propSheet,1,0)],petTextures=[frame(propSheet,0,1),frame(propSheet,1,1)];
   const ground=new Container();ground.eventMode='none';scene.addChild(ground);
   const world=new Container();world.sortableChildren=true;world.eventMode='none';scene.addChild(world);
   const effects=createWorldEffects(scene,room);destroyEffects=effects.destroy;
   const feedback=new Container();feedback.eventMode='none';scene.addChild(feedback);
   const sprite=(t:Texture,x:number,y:number,width:number)=>{const s=new Sprite(t);s.anchor.set(.5,1);s.width=width;s.height=width*t.height/t.width;s.position.set(x,y);s.zIndex=y;s.eventMode='none';world.addChild(s);return s;};
   let state=useGame.getState(),position:Point={x:8,y:8},route:Point[]=[],pending:Interaction|undefined,selected:Interaction|undefined,hovered:Interaction|undefined;
   let seconds=0,reactionStart=-10,speed=0,facing=1,selectionTime=0,confirmation=0,highlightAlpha=0,displayed:Interaction|undefined,seated=false,cursorMode='var(--leaf-default)',pressedUntil=0;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const interactions:Interaction[]=[];
   const marker=new Graphics().ellipse(0,0,12,5).stroke({color:0xc9e9ad,width:1.5}).moveTo(-4,0).lineTo(4,0).moveTo(0,-2).lineTo(0,2).stroke({color:0xe1edc3,width:1});marker.visible=false;ground.addChild(marker);
   const floorHover=new Graphics();floorHover.visible=false;ground.addChild(floorHover);
   const highlight=new Graphics();highlight.alpha=0;ground.addChild(highlight);
   const contour=new Graphics();contour.alpha=0;feedback.addChild(contour);
   const tooltip=new Container();tooltip.visible=false;feedback.addChild(tooltip);
   const tooltipBg=new Graphics();tooltip.addChild(tooltipBg);
   const tooltipText=new Text({text:'',style:{fontFamily:'Georgia',fontSize:12,fill:0xefe2c2,align:'center'}});tooltipText.anchor.set(.5);tooltip.addChild(tooltipText);
   // Alpha checks use the actual atlas pixels, excluding empty margins around desks and characters.
   const propImage=await loadImage('/assets/study-and-companions.png');if(disposed)return;
   const pixels=document.createElement('canvas');pixels.width=propImage.width;pixels.height=propImage.height;
   const context=pixels.getContext('2d',{willReadFrequently:true})!;context.drawImage(propImage,0,0);const alpha=context.getImageData(0,0,pixels.width,pixels.height).data;
   const spriteContains=(s:Sprite,p:Point)=>{const local=s.toLocal(scene.toGlobal(p)),f=s.texture.frame;
    const x=Math.floor(local.x+s.texture.width*.5),y=Math.floor(local.y+s.texture.height);
    return x>=0&&y>=0&&x<f.width&&y<f.height&&alpha[((Math.floor(f.y)+y)*pixels.width+Math.floor(f.x)+x)*4+3]>90;
   };
   const add=(item:Interaction)=>{interactions.push(item);return item;};
   const deskSprites:Sprite[]=[];
   studyStations.forEach((station,i)=>{const p=iso(station.position.x,station.position.y),desk=sprite(deskTextures[station.atlasColumn],p.x,p.y+36,station.width);desk.zIndex=p.y;deskSprites.push(desk);
    const shape:Shape={kind:'polygon',points:deskOutline(i).map((value,n)=>value+(n%2?p.y:p.x))};
    add({id:station.id,name:station.label,action:'Begin Studying',symbol:'▤',priority:30,contains:q=>contains(shape,q)&&spriteContains(desk,q),shape,approaches:[station.seat,...station.alternatives],preferFirst:true,lookAt:{x:p.x,y:p.y-25},activate:()=>handlers.current.onOpen('learn')});
   });
   furnitureRegions.forEach(item=>add({...item,priority:20,contains:p=>contains(item.shape,p),activate:()=>handlers.current.onOpen(item.panel)}));
   const gp=iso(treeCenter.x,treeCenter.y),garden=sprite(gardenTextures[stageFor(state.energy)],gp.x,gp.y+83,365);garden.zIndex=gp.y+40;
   add({id:'garden',name:'Shared Garden',action:'View Garden Progress',symbol:'❧',priority:10,contains:p=>contains(gardenHotspot,p),shape:gardenHotspot,approaches:gardenApproaches,activate:()=>handlers.current.onOpen('garden')});
   // Animate only small outer leaf clusters, never scale the complete garden/tree.
   const branches=[-1,1].map(side=>{const c=new Container();c.eventMode='none';c.zIndex=garden.zIndex+1;world.addChild(c);const leaf=new Sprite(garden.texture);leaf.anchor.set(.5,1);leaf.width=365;leaf.height=365*leaf.texture.height/leaf.texture.width;leaf.position.set(garden.x,garden.y);c.addChild(leaf);const mask=new Graphics();c.addChild(mask);leaf.mask=mask;return {c,leaf,mask,side};});
   const updateBranches=()=>{const stage=stageFor(state.energy);branches.forEach(({leaf,mask,side})=>{leaf.texture=garden.texture;leaf.width=365;leaf.height=365*leaf.texture.height/leaf.texture.width;
    const y=stage<2?garden.y-leaf.height+54:garden.y-leaf.height+45;const x=gp.x+side*(stage<2?35:58);mask.clear().poly([x-19,y+9,x-10,y-9,x+13,y-5,x+22,y+14,x+5,y+25,x-15,y+19]).fill(0xffffff);
   });};updateBranches();
   const moonflower=new Graphics();moonflower.moveTo(0,0).lineTo(0,-23).stroke({color:0x9ad7ae,width:2});for(let i=0;i<5;i++)moonflower.circle(Math.cos(i*1.256)*5,-27+Math.sin(i*1.256)*5,4).fill(0xd3f2dd);moonflower.circle(0,-27,3).fill(0xf5dda0);moonflower.position.set(gp.x+65,gp.y+24);moonflower.zIndex=gp.y+60;moonflower.eventMode='none';world.addChild(moonflower);
   const avatars=[state.avatar,...presets.slice(1)];
   const standing=await Promise.all(avatars.map(async a=>texture(await avatarAsset(a))));
   const strides=await Promise.all(avatars.map(a=>Promise.all([0,1,2,3].map(async frame=>texture(await avatarAsset(a,false,frame))))));
   const cycle=createWalkCycle(iso(position.x,position.y));
   const reading=await Promise.all(avatars.map(async a=>texture(await avatarAsset(a,true))));if(disposed)return;
   const players=standing.map((t,i)=>{const p=iso(approaches[i].x,approaches[i].y);return sprite(t,p.x,p.y+4,i===2?88:72);});
   // Online classmates use tight body ellipses, not their atlas cell bounds.
   players.forEach((s,i)=>{if(!i)return;const shape:Shape={kind:'ellipse',x:s.x,y:s.y-28,rx:17,ry:25};add({id:`friend-${i}`,name:['', 'Maya','Kai','Jules'][i],action:'View Gardener',symbol:'✧',priority:40,shape,contains:p=>state.online[i]&&contains(shape,p),approaches:[approaches[i]],activate:()=>handlers.current.onOpen('profile',i)});});
   const petPoint={x:gp.x+86,y:gp.y-4},pet=sprite(petTextures[state.energy>=100?1:0],petPoint.x,petPoint.y,125);pet.zIndex=gp.y+25;
   add({id:'pet',name:'Sproutling',action:'Interact with Sproutling',symbol:'♡',priority:50,shape:{kind:'ellipse',x:pet.x+5,y:pet.y-32,rx:25,ry:29},contains:p=>spriteContains(pet,p),approaches:[{x:8,y:4},{x:8.5,y:4.5}],activate:()=>{reactionStart=seconds;useGame.getState().set({reaction:['happy','watering','sleeping'][Math.floor(Math.random()*3)]});handlers.current.onHint('A happy little Sproutling. Every lesson helps it grow.');}});
   const sleep=new Text({text:'z z',style:{fontFamily:'Georgia',fontSize:14,fill:0xeee4c4}});sleep.position.set(petPoint.x+18,petPoint.y-75);sleep.visible=false;feedback.addChild(sleep);
   const cues=interactions.filter(i=>i.id.startsWith('desk-')||['garden','board','pet'].includes(i.id)).map(item=>{const g=new Text({text:item.symbol,style:{fontFamily:'Georgia',fontSize:17,fill:0xd8e6ac,stroke:{color:0x30372a,width:3}}});g.anchor.set(.5);feedback.addChild(g);return {item,g};});
   const setActivity=(activity:'Exploring'|'Idle'|'Studying')=>{if(useGame.getState().localActivity!==activity)useGame.getState().set({localActivity:activity});};
   const reportPosition=()=>{if(host.current){host.current.dataset.playerTile=`${position.x.toFixed(2)},${position.y.toFixed(2)}`;host.current.dataset.destination=route.length?`${route[route.length-1].x},${route[route.length-1].y}`:'';host.current.dataset.facing=String(facing);host.current.dataset.selected=selected?.id??'';host.current.dataset.onlineAvatars=String(state.online.filter(Boolean).length);}};
   const beginMove=(path:Point[],destination:Point,item?:Interaction)=>{route=path;pending=item;selected=item;selectionTime=seconds;confirmation=0;seated=false;setActivity(path.length?'Exploring':'Idle');
    const p=iso(destination.x,destination.y);marker.position.set(p.x,p.y);marker.visible=path.length>0;reportPosition();
    if(!path.length&&item){confirmation=.3;if(item.lookAt){const look=item.lookAt.x-iso(position.x,position.y).x;if(Math.abs(look)>1)facing=look<0?1:-1;}if(item.id.startsWith('desk-')){seated=true;setActivity('Studying');}}
   };
   const resetHint=()=>handlers.current.onHint('Click the floor to wander · choose a desk to learn');
   scene.on('pointermove',(event:FederatedPointerEvent)=>{if(handlers.current.suspended)return;const point=scene.toLocal(event.global),next=pickInteraction(interactions,point);
    if(next!==hovered){hovered=next;if(next)handlers.current.onHint(`${next.name} · ${next.action}`);else resetHint();}
    const tile=uniso(point.x,point.y),snapped={x:Math.round(tile.x*2)/2,y:Math.round(tile.y*2)/2},inFloor=contains(floorShape,point),valid=!blocked(snapped.x,snapped.y),center=iso(snapped.x,snapped.y);
    floorHover.clear();floorHover.visible=!next&&inFloor;
    if(floorHover.visible){floorHover.poly([center.x,center.y-8,center.x+16,center.y,center.x,center.y+8,center.x-16,center.y]).fill({color:valid?0xbcebd7:0xb39783,alpha:.035}).stroke({color:valid?0xbcebd7:0xb39783,width:1,alpha:.5});if(!valid)floorHover.moveTo(center.x-3,center.y-2).lineTo(center.x+3,center.y+2).moveTo(center.x+3,center.y-2).lineTo(center.x-3,center.y+2).stroke({color:0xb39783,width:1,alpha:.6});}
    cursorMode=next?'var(--leaf-interactive)':inFloor?(valid?'var(--leaf-walk)':'var(--leaf-blocked)'):'var(--leaf-default)';scene.cursor=cursorMode;
   });
   scene.on('pointerdown',()=>{if(!handlers.current.suspended){pressedUntil=seconds+.14;scene.cursor='var(--leaf-pressed)';}});
   scene.on('pointerleave',()=>{hovered=undefined;floorHover.visible=false;cursorMode='var(--leaf-default)';resetHint();});
   scene.on('pointertap',(event:FederatedPointerEvent)=>{
    if(handlers.current.suspended)return;const point=scene.toLocal(event.global),item=pickInteraction(interactions,point);
    if(item){if(selected===item&&(pending||seconds-selectionTime<.6))return;const plan=approachRoute(position,item.approaches,item.preferFirst);
     if(!plan){handlers.current.onHint('There’s no clear approach to that object.');return;}
     beginMove(plan.path,plan.destination,item);handlers.current.onHint(`${item.name} · on my way`);return;
    }
    if(!contains(floorShape,point))return;
    const plan=planRoute(position,uniso(point.x,point.y),true);if(!plan)return;beginMove(plan.path,plan.destination);resetHint();
   });
   const updateGarden=()=>{garden.texture=gardenTextures[stageFor(state.energy)];garden.width=365;garden.height=365*garden.texture.height/garden.texture.width;moonflower.visible=new Set(state.completions.map(c=>c.player)).size>=2;updateBranches();};updateGarden();
   unsubscribe=useGame.subscribe((next,previous)=>{state=next;if(next.online!==previous.online)reportPosition();if(next.energy!==previous.energy||next.completions!==previous.completions)updateGarden();if(next.reaction!==previous.reaction)reactionStart=seconds;
    if(next.avatar!==previous.avatar)Promise.all([avatarAsset(next.avatar),avatarAsset(next.avatar,true),...[0,1,2,3].map(frame=>avatarAsset(next.avatar,false,frame))]).then(async urls=>{const textures=await Promise.all(urls.map(texture));if(!disposed&&next.avatar===useGame.getState().avatar){standing[0]=textures[0];reading[0]=textures[1];strides[0]=textures.slice(2);}});
   });
   app.ticker.add(tick=>{
    const dt=Math.min(tick.deltaMS/1000,.05);seconds+=dt;const motion=state.settings.motion&&!reduced.matches;
    if(handlers.current.suspended){if(route.length||pending){route=[];pending=undefined;selected=undefined;confirmation=0;speed=0;marker.visible=false;setActivity('Idle');reportPosition();}hovered=undefined;floorHover.visible=false;}
    scene.cursor=seconds<pressedUntil?'var(--leaf-pressed)':cursorMode;
    const walking=route.length>0;
    if(walking){const remaining=route.reduce((total,p,i)=>total+distance(i?route[i-1]:position,p),0),targetSpeed=Math.min(112,Math.sqrt(2*260*remaining));
     speed+=Math.max(-260*dt,Math.min(260*dt,targetSpeed-speed));let travel=speed*dt;
     while(route.length&&travel>0){const next=route[0],d=distance(position,next);const projected=iso(next.x,next.y),current=iso(position.x,position.y);if(Math.abs(projected.x-current.x)>.1)facing=projected.x<current.x?1:-1;
      if(d<=travel+.05){position={...next};route.shift();travel-=d;}else{position.x+=(next.x-position.x)*travel/d;position.y+=(next.y-position.y)*travel/d;travel=0;}}
     if(!route.length){speed=0;marker.visible=false;confirmation=pending?.3:0;setActivity('Idle');if(pending?.lookAt){const look=pending.lookAt.x-iso(position.x,position.y).x;if(Math.abs(look)>1)facing=look<0?1:-1;}if(pending?.id.startsWith('desk-')){seated=true;setActivity('Studying');}reportPosition();}
    }
    if(confirmation>0){confirmation-=dt;if(confirmation<=0&&pending){const done=pending;pending=undefined;selected=undefined;done.activate();}}
    const p=iso(position.x,position.y),stride=cycle(p,motion&&!handlers.current.suspended&&!seated);players[0].texture=seated?reading[0]:stride.frame>=0?strides[0][stride.frame]:standing[0];players[0].width=76;players[0].height=76*players[0].texture.height/players[0].texture.width;
    players[0].scale.x=Math.abs(players[0].scale.x)*facing;players[0].position.set(p.x,p.y+4+stride.bob);players[0].rotation=stride.lean;players[0].zIndex=p.y+6;
    for(let i=1;i<4;i++){const base=iso(approaches[i].x,approaches[i].y);players[i].texture=state.memberActivities[i]==='Studying'?reading[i]:standing[i];players[i].position.set(base.x,base.y+4);players[i].zIndex=base.y+6;players[i].visible=state.online[i];}
    const active=seconds-reactionStart<4,celebrate=active&&['happy','celebrating','evolving'].includes(state.reaction);
    pet.texture=petTextures[state.energy>=100||active&&state.reaction==='watering'?1:0];pet.y=petPoint.y+(motion?(celebrate?-Math.abs(Math.sin(seconds*7))*9:Math.sin(seconds*2)*1.2):0);pet.rotation=motion&&active&&state.reaction==='watering'?Math.sin(seconds*4)*.06:0;sleep.visible=state.reaction==='sleeping'&&active;pet.alpha=sleep.visible?.8:1;
    garden.tint=active&&state.reaction==='evolving'?0xedffd2:0xffffff;
    // Frame-rate independent 150ms fade. Only one object owns hover/selected feedback.
    const wanted=handlers.current.suspended?undefined:hovered??selected;if(wanted!==displayed){highlightAlpha=Math.max(0,highlightAlpha-dt/.15);if(highlightAlpha===0){displayed=wanted;highlight.clear();contour.clear();if(displayed){const dest=approachRoute(position,displayed.approaches,displayed.preferFirst)?.destination;
       if(dest){const a=iso(dest.x,dest.y);highlight.poly([a.x,a.y-8,a.x+16,a.y,a.x,a.y+8,a.x-16,a.y]).fill({color:0xbae5bf,alpha:.14}).stroke({color:0xbcebd7,width:1});}
       drawShape(contour,displayed.shape).fill({color:0xc9e4af,alpha:.045}).stroke({color:0xc9e6bf,width:1.2,alpha:.65});tooltipText.text=`${displayed.symbol}  ${displayed.name}\n${displayed.action}`;
       tooltipBg.clear().roundRect(-tooltipText.width/2-10,-tooltipText.height/2-7,tooltipText.width+20,tooltipText.height+14,3).fill({color:0x292a25,alpha:.95}).stroke({color:0xb59868,width:1});
      }}}
    else highlightAlpha=Math.min(1,highlightAlpha+dt/.15);
    if(!wanted)highlightAlpha=Math.max(0,highlightAlpha-dt/.15);
    highlight.alpha=contour.alpha=highlightAlpha;tooltip.visible=!!displayed&&highlightAlpha>0;tooltip.alpha=highlightAlpha;
    if(displayed){const shape=displayed.shape,center=shape.kind==='ellipse'?{x:shape.x,y:shape.y-shape.ry-28}:{x:shape.points[0]+45,y:Math.min(...shape.points.filter((_,i)=>i%2===1))-28};tooltip.position.set(Math.max(120,Math.min(1200,center.x)),Math.max(30,center.y));}
    marker.alpha=motion?.65+Math.sin(seconds*3)*.16:.8;
    cues.forEach(({item,g},i)=>{const near=item.approaches.some(a=>distance(position,a)<115),shape=item.shape;g.visible=!handlers.current.suspended&&(near||hovered===item||selected===item);g.alpha=(hovered===item||selected===item)?.8:motion?.22+Math.max(0,Math.sin(seconds*.7+i*2))*.25:.3;
     const x=shape.kind==='ellipse'?shape.x:shape.points[0]+30,y=shape.kind==='ellipse'?shape.y-shape.ry:shape.points[1];g.position.set(x,y-10+(motion?Math.sin(seconds*1.5+i)*1.5:0));
    });
    deskSprites.forEach((desk,i)=>{desk.tint=(hovered?.id===studyStations[i].id||selected?.id===studyStations[i].id)?0xfff1d2:0xffffff;});
    branches.forEach(({c,side})=>{c.visible=motion&&state.settings.graphics==='Full'&&stageFor(state.energy)>0;c.alpha=.7;c.x=motion?Math.sin(seconds*(side===1?.61:.43)+side)*1.3:0;c.y=motion?Math.sin(seconds*.37+side)*.45:0;});
    effects.update(seconds,dt,motion,state.settings.graphics==='Full',celebrate);
   });
   reportPosition();visibility=()=>{if(document.hidden)app.ticker.stop();else app.ticker.start();};document.addEventListener('visibilitychange',visibility);visibility();
  };
  run().catch(e=>{console.error(e);if(!disposed)setError(true);});
  return()=>{disposed=true;unsubscribe();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);if(app.renderer){destroyEffects();app.destroy(true,{children:true,texture:false});}};
 },[]);
 return <div className="canvas-host reference-world" ref={host} role="application" aria-label="Interactive greenhouse. Click clear floor tiles to walk; use the navigation buttons to access every activity.">{error&&<div className="canvas-error">The world artwork couldn’t load. You can still use every lesson and garden control in the navigation.</div>}</div>;
}
