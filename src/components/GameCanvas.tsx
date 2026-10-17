'use client';
import {useEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Sprite,Texture,Rectangle,Text,FederatedPointerEvent} from 'pixi.js';
import {useGame,presets} from '@/store/game';
import {avatarAsset,loadImage} from '@/lib/sprite-assets';
import {iso,uniso,pathfind,stageFor,Point} from '@/lib/movement';
import {desks,approaches,gardenApproach} from '@/lib/world-layout';

type Props={onOpen:(panel:string,player?:number)=>void;onHint:(text:string)=>void};
export default function GameCanvas({onOpen,onHint}:Props){
 const host=useRef<HTMLDivElement>(null),handlers=useRef({onOpen,onHint});handlers.current={onOpen,onHint};
 const [error,setError]=useState(false);
 useEffect(()=>{
  let disposed=false,unsubscribe=()=>{},observer:ResizeObserver|undefined;
  const app=new Application(),timers:ReturnType<typeof setTimeout>[]=[];
  const run=async()=>{
   await app.init({backgroundAlpha:0,antialias:false,resolution:Math.min(devicePixelRatio,2),autoDensity:true,width:1320,height:744});
   if(disposed){app.destroy(true);return;}host.current!.appendChild(app.canvas);
   const scene=new Container();app.stage.addChild(scene);
   const resize=()=>{if(!host.current)return;const r=host.current.getBoundingClientRect();app.renderer.resize(r.width,r.height);const scale=Math.min(r.width/1320,r.height/744);scene.scale.set(scale);scene.position.set((r.width-1320*scale)/2,(r.height-744*scale)/2);};
   observer=new ResizeObserver(resize);observer.observe(host.current!);resize();
   const texture=async(url:string)=>{const t=Texture.from(await loadImage(url));t.source.scaleMode='nearest';return t;};
   const [room,propSheet,gardenSheet]=await Promise.all(['/assets/greenhouse-room.png','/assets/study-and-companions.png','/assets/garden-stages.png'].map(texture));
   if(disposed)return;
   const plate=new Sprite(room);plate.width=1320;plate.height=744;scene.addChild(plate);
   const frame=(sheet:Texture,col:number,row:number,cols=2,rows=2)=>new Texture({source:sheet.source,frame:new Rectangle(sheet.width/cols*col,sheet.height/rows*row,sheet.width/cols,sheet.height/rows)});
   const gardenTextures=[new Texture({source:gardenSheet.source,frame:new Rectangle(0,0,768,480)}),new Texture({source:gardenSheet.source,frame:new Rectangle(768,0,768,480)}),new Texture({source:gardenSheet.source,frame:new Rectangle(0,480,768,544)}),new Texture({source:gardenSheet.source,frame:new Rectangle(768,480,768,544)})];
   const deskTextures=[frame(propSheet,0,0),frame(propSheet,1,0)],petTextures=[frame(propSheet,0,1),frame(propSheet,1,1)];
   const floor=new Graphics().poly([660,200,1092,416,660,632,228,416]).fill({color:0xffffff,alpha:.001});floor.eventMode='static';floor.cursor='crosshair';scene.addChild(floor);
   const world=new Container();world.sortableChildren=true;scene.addChild(world);
   const sprite=(t:Texture,x:number,y:number,width:number,parent:Container=world)=>{const s=new Sprite(t);s.anchor.set(.5,1);s.width=width;s.height=width*t.height/t.width;s.position.set(x,y);s.zIndex=y;parent.addChild(s);return s;};
   let state=useGame.getState(),position:Point={x:8,y:8},route:Point[]=[],action:(()=>void)|undefined,seated=false,seconds=0,reactionStart=-10;
   const marker=new Graphics().ellipse(0,0,17,8).stroke({color:0xd8edac,width:2});marker.visible=false;scene.addChild(marker);
   const move=(destination:Point,callback?:()=>void)=>{const path=pathfind(position,destination);if(!path.length&&Math.hypot(position.x-destination.x,position.y-destination.y)>.1){handlers.current.onHint('That spot is occupied. Choose a clear wooden tile.');return;}seated=false;route=path;action=callback;const p=iso(destination.x,destination.y);marker.position.set(p.x,p.y);marker.visible=true;if(!route.length){marker.visible=false;callback?.();action=undefined;}};
   floor.on('pointertap',(e:FederatedPointerEvent)=>{const p=scene.toLocal(e.global),tile=uniso(p.x,p.y);move({x:Math.round(tile.x),y:Math.round(tile.y)});});
   const interactive=(target:Container,title:string,destination:Point,callback:()=>void)=>{target.eventMode='static';target.cursor='pointer';target.on('pointerover',()=>{target.tint=0xffe8b2;handlers.current.onHint(title);});target.on('pointerout',()=>{target.tint=0xffffff;handlers.current.onHint('Click the floor to wander · choose a desk to learn');});target.on('pointertap',(e:FederatedPointerEvent)=>{e.stopPropagation();move(destination,callback);});};
   desks.forEach((d,i)=>{const p=iso(d.x,d.y),desk=sprite(deskTextures[i%2],p.x,p.y+36,178);desk.zIndex=p.y;interactive(desk,i===0?'Your study desk · begin a lesson':`${['Alex','Maya','Kai','Jules'][i]}'s study desk`,approaches[i],()=>{handlers.current.onOpen(i===0?'learn':'profile',i);});});
   // Furniture already present in the room plate has independent hit regions.
   const library=new Graphics().poly([690,75,835,106,835,285,690,250]).fill({color:0xffffff,alpha:.001});scene.addChild(library);interactive(library,'The library · your learning journey',{x:2,y:1},()=>handlers.current.onOpen('learn'));
   const board=new Graphics().poly([850,155,1000,210,1000,310,850,255]).fill({color:0xffffff,alpha:.001});scene.addChild(board);interactive(board,'Quest board · The Moonlight Bloom',{x:6,y:1},()=>handlers.current.onOpen('friends'));
   const details=[{title:'The observatory · a moment under the stars',panel:'observatory',x:1110,y:460,w:95,h:100,d:{x:11,y:4}},{title:'The hearth · take a quiet breath',panel:'hearth',x:1155,y:280,w:65,h:105,d:{x:10,y:0}},{title:'Plant shelf · little things are growing',panel:'plants',x:475,y:135,w:155,h:110,d:{x:1,y:3}},{title:'Sproutbound · welcome home',panel:'entrance',x:85,y:360,w:110,h:120,d:{x:0,y:10}}];
   details.forEach(item=>{const hit=new Graphics().rect(item.x,item.y,item.w,item.h).fill({color:0xffffff,alpha:.001});scene.addChild(hit);interactive(hit,item.title,item.d,()=>handlers.current.onOpen(item.panel));});
   const atmosphere=new Container();scene.addChild(atmosphere);
   const lanterns=[[649,75],[31,325],[1025,529],[369,687],[1110,198]].map(([x,y])=>{const glow=new Graphics().circle(0,0,22).fill({color:0xffca68,alpha:.09}).circle(0,0,11).fill({color:0xffd989,alpha:.12});glow.position.set(x,y);atmosphere.addChild(glow);return glow;});
   const ripples=[[90,645],[1080,704],[740,707],[1220,650]].map(([x,y])=>{const ring=new Graphics().ellipse(0,0,23,4).stroke({color:0x93c8c6,alpha:.25,width:1});ring.position.set(x,y);atmosphere.addChild(ring);return ring;});
   const gp=iso(5.5,5.5),garden=sprite(gardenTextures[stageFor(state.energy)],gp.x,gp.y+83,365);garden.zIndex=gp.y+15;
   interactive(garden,'Shared garden · see what your learning has grown',gardenApproach,()=>handlers.current.onOpen('garden'));
   const moonflower=new Graphics();moonflower.moveTo(0,0).lineTo(0,-23).stroke({color:0x9ad7ae,width:2});for(let i=0;i<5;i++)moonflower.circle(Math.cos(i*1.256)*5,-27+Math.sin(i*1.256)*5,4).fill(0xd3f2dd);moonflower.circle(0,-27,3).fill(0xf5dda0);moonflower.position.set(gp.x+65,gp.y+24);moonflower.zIndex=gp.y+60;world.addChild(moonflower);
   const avatars=[state.avatar,...presets.slice(1)];
   const standing=await Promise.all(avatars.map(async a=>texture(await avatarAsset(a))));
   const reading=await Promise.all(avatars.map(async a=>texture(await avatarAsset(a,true))));if(disposed)return;
   const players=standing.map((t,i)=>{const p=iso(approaches[i].x,approaches[i].y);const s=sprite(t,p.x,p.y+4,i===2?88:72);if(i){s.eventMode='static';s.cursor='pointer';s.on('pointertap',()=>handlers.current.onOpen('profile',i));}return s;});
   const petPoint={x:gp.x+86,y:gp.y-4},pet=sprite(petTextures[state.energy>=100?1:0],petPoint.x,petPoint.y,125);pet.zIndex=gp.y+25;pet.eventMode='static';pet.cursor='pointer';pet.on('pointertap',()=>{reactionStart=seconds;useGame.getState().set({reaction:['happy','watering','sleeping'][Math.floor(Math.random()*3)]});handlers.current.onHint('A happy little Sproutling. Every lesson helps it grow.');});
   const sleep=new Text({text:'z z',style:{fontFamily:'Georgia',fontSize:14,fill:0xeee4c4}});sleep.position.set(petPoint.x+18,petPoint.y-75);sleep.visible=false;scene.addChild(sleep);
   const bubble=(x:number,y:number,word:string)=>{const c=new Container();c.position.set(x,y);const g=new Graphics().roundRect(-16,-15,32,26,5).fill(0xf0dfbd).stroke({color:0x6d5034,width:1});g.poly([-3,11,3,11,-3,18]).fill(0xf0dfbd);c.addChild(g);const t=new Text({text:word,style:{fontFamily:'Georgia',fontSize:17,fill:0x654b36}});t.anchor.set(.5);t.y=-2;c.addChild(t);scene.addChild(c);return c;};
   const speech=approaches.map((p,i)=>{const xy=iso(p.x,p.y);return bubble(xy.x+24,xy.y-87,['▤','✧','✦','❧'][i]);});
   const effects=new Container();scene.addChild(effects);const particles=Array.from({length:35},(_,i)=>{const g=new Graphics().circle(0,0,i%7===0?2:1).fill(i%3?0xddf3ae:0xffda94);effects.addChild(g);return g;});
   const updateGarden=()=>{garden.texture=gardenTextures[stageFor(state.energy)];garden.width=365;garden.height=365*garden.texture.height/garden.texture.width;pet.texture=petTextures[state.energy>=100?1:0];moonflower.visible=new Set(state.completions.map(c=>c.player)).size>=2;};updateGarden();
   unsubscribe=useGame.subscribe((next,previous)=>{state=next;if(next.energy!==previous.energy||next.completions!==previous.completions)updateGarden();if(next.reaction!==previous.reaction)reactionStart=seconds;if(next.avatar!==previous.avatar){Promise.all([avatarAsset(next.avatar),avatarAsset(next.avatar,true)]).then(async urls=>{const textures=await Promise.all(urls.map(texture));if(!disposed){standing[0]=textures[0];reading[0]=textures[1];}});}});
   app.ticker.add(tick=>{
    const dt=Math.min(tick.deltaMS/1000,.05);seconds+=dt;const motion=state.settings.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    const walking=route.length>0;let facing=players[0].scale.x<0?-1:1;
    if(walking){const next=route[0],dx=next.x-position.x,dy=next.y-position.y,d=Math.hypot(dx,dy),step=dt*3;facing=dx-dy<0?1:-1;if(d<=step){position={...next};route.shift();}else{position.x+=dx/d*step;position.y+=dy/d*step;}if(!route.length){marker.visible=false;if(action){const done=action;action=undefined;timers.push(setTimeout(()=>{if(!disposed)done();},350));}}}
    const p=iso(position.x,position.y);players[0].texture=seated?reading[0]:standing[0];players[0].width=76;players[0].height=76*players[0].texture.height/players[0].texture.width;players[0].scale.x=Math.abs(players[0].scale.x)*facing;players[0].position.set(p.x,p.y+4+(motion&&walking?Math.sin(seconds*15)*2:0));players[0].zIndex=p.y+6;speech[0].visible=!walking&&seated;
    for(let i=1;i<4;i++){const base=iso(approaches[i].x,approaches[i].y),wander=motion?Math.max(0,Math.sin(seconds*.16+i)-.9)*55:0;players[i].texture=wander>0?standing[i]:reading[i];players[i].position.set(base.x+wander,base.y+4+wander*.5);players[i].zIndex=players[i].y;players[i].visible=state.online[i];speech[i].visible=state.online[i]&&wander===0;}
    const active=seconds-reactionStart<4,celebrate=active&&['happy','celebrating','evolving'].includes(state.reaction);pet.texture=petTextures[state.energy>=100||active&&state.reaction==='watering'?1:0];pet.y=petPoint.y+(motion?(celebrate?-Math.abs(Math.sin(seconds*7))*12:Math.sin(seconds*2)*1.5):0);pet.rotation=motion&&active&&state.reaction==='watering'?Math.sin(seconds*4)*.09:0;sleep.visible=state.reaction==='sleeping'&&active;pet.alpha=sleep.visible ? .8 : 1;
    garden.tint=active&&state.reaction==='evolving'?0xedffd2:0xffffff;garden.scale.set(365/garden.texture.width*(motion&&active&&state.reaction==='evolving'?1+Math.sin(seconds*6)*.025:1));
    atmosphere.visible=state.settings.graphics==='Full';lanterns.forEach((g,i)=>{g.alpha=motion?.65+Math.sin(seconds*2.5+i)*.2: .7;});ripples.forEach((g,i)=>{const phase=motion?(seconds*.2+i*.24)%1:.5;g.scale.set(.7+phase);g.alpha=1-phase;});
    particles.forEach((g,i)=>{g.visible=state.settings.graphics==='Full';g.x=gp.x+Math.sin(i*6.12)*170;g.y=gp.y-15+(i*37)%120-(motion?(seconds*(celebrate?35:12)+i*5)%150:0);g.alpha=motion ? .25+Math.sin(seconds*2+i)*.22 : .3;});
   });
  };
  run().catch(e=>{console.error(e);if(!disposed)setError(true);});
  return()=>{disposed=true;unsubscribe();observer?.disconnect();timers.forEach(clearTimeout);if(app.renderer)app.destroy(true,{children:true,texture:false});};
 },[]);
 return <div className="canvas-host reference-world" ref={host} role="application" aria-label="Interactive greenhouse. Click clear floor tiles to walk; use the navigation buttons to access every activity.">{error&&<div className="canvas-error">The world artwork couldn’t load. You can still use every lesson and garden control in the navigation.</div>}</div>;
}
