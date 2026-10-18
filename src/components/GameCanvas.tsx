'use client';
import {useEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Sprite,Texture,Rectangle,Text,FederatedPointerEvent} from 'pixi.js';
import {useGame,presets} from '@/store/game';
import {avatarCanvas,loadImage} from '@/lib/sprite-assets';
import {createWalkCycle} from '@/lib/walk-cycle';
import {RUN_FRAME_COUNT} from '@/lib/sprite-locomotion';
import {createSproutlingWander} from '@/lib/sproutling-wander';
import {iso,uniso,planRoute,approachRoute,distance,stageFor,blocked,Point} from '@/lib/movement';
import {studyStations,approaches,gardenApproaches,treeCenter} from '@/lib/world-layout';
import {contains,floorShape,gardenHotspot,furnitureRegions,pickInteraction,Shape} from '@/lib/world-geometry';
import {chairPose} from '@/lib/avatar-seating';
import {objectTooltipPosition} from '@/lib/tooltip-position';
import {createWorldEffects} from '@/lib/world-effects';
import sceneAssets from '@/lib/scene-assets.json';

type Props={suspended?:boolean;onOpen:(panel:string,player?:number)=>void;onHint:(text:string)=>void};
type Interaction={id:string;name:string;action:string;symbol:string;priority:number;contains:(p:Point)=>boolean;shape:Shape;approaches:Point[];activate:()=>void;lookAt?:Point;preferFirst?:boolean;tooltipShape?:Shape};
const drawShape=(g:Graphics,shape:Shape)=>shape.kind==='ellipse'?g.ellipse(shape.x,shape.y,shape.rx,shape.ry):g.poly(shape.points);

export default function GameCanvas({onOpen,onHint,suspended=false}:Props){
 const host=useRef<HTMLDivElement>(null),handlers=useRef({onOpen,onHint,suspended});handlers.current={onOpen,onHint,suspended};
 const [error,setError]=useState(false);
 useEffect(()=>{
  let disposed=false,unsubscribe=()=>{},observer:ResizeObserver|undefined,visibility=()=>{},destroyEffects=()=>{};
  const app=new Application();
  const hoverTextures:Texture[]=[];
  const run=async()=>{
   await app.init({backgroundAlpha:0,antialias:false,resolution:Math.min(devicePixelRatio,2),autoDensity:true,width:1320,height:744});
   if(disposed){app.destroy(true);return;}host.current!.appendChild(app.canvas);
   const scene=new Container();app.stage.addChild(scene);
   const resize=()=>{if(!host.current)return;const r=host.current.getBoundingClientRect();app.renderer.resize(r.width,r.height);const scale=Math.min(r.width/1320,r.height/744);scene.scale.set(scale);scene.position.set((r.width-1320*scale)/2,(r.height-744*scale)/2);};
   observer=new ResizeObserver(resize);observer.observe(host.current!);resize();
   const texture=async(source:string|HTMLCanvasElement)=>{const t=Texture.from(typeof source==='string'?await loadImage(source):source);t.source.scaleMode='nearest';return t;};
   const [room,propSheet,gardenSheet,petRunSheet,deskHoverSheet,gardenHoverSheet]=await Promise.all(['/assets/greenhouse-room.webp','/assets/study-and-companions.webp','/assets/garden-stages.webp','/assets/sproutling-run.png','/assets/desk-hover.png','/assets/garden-hover.png'].map(texture));
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
   let state=useGame.getState(),position:Point={x:8.5,y:8.5},route:Point[]=[],pending:Interaction|undefined,selected:Interaction|undefined,hovered:Interaction|undefined;
   let seconds=0,reactionStart=-10,speed=0,facing=1,selectionTime=0,confirmation=0,highlightAlpha=0,displayed:Interaction|undefined,seated=false,seatedStation:number|undefined=undefined,cursorMode='var(--leaf-default)',pressedUntil=0,pointer:Point|undefined,treeAlpha=1;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const interactions:Interaction[]=[];
   const marker=new Graphics().ellipse(0,0,12,5).stroke({color:0xc9e9ad,width:1.5}).moveTo(-4,0).lineTo(4,0).moveTo(0,-2).lineTo(0,2).stroke({color:0xe1edc3,width:1});marker.visible=false;ground.addChild(marker);
   const floorHover=new Graphics();floorHover.visible=false;ground.addChild(floorHover);
   const highlight=new Graphics();highlight.alpha=0;ground.addChild(highlight);
   const contour=new Graphics();contour.alpha=0;feedback.addChild(contour);
   const tooltip=new Container();tooltip.visible=false;feedback.addChild(tooltip);
   const tooltipBg=new Graphics();tooltip.addChild(tooltipBg);
   const tooltipText=new Text({text:'',style:{fontFamily:'Pixelify Sans, Georgia',fontSize:13,fontWeight:'600',fill:0x3f1a04,align:'center'}});
   // Tooltip colours per UI theme: [fill, outline, inner frame, text].
   const tooltipPalette={Classic:[0x292a25,0xb59868,0x4a4032,0xefe2c2],Stardew:[0xfbe1a6,0x5c2706,0x5c2706,0x3f1a04]};tooltipText.anchor.set(.5);tooltip.addChild(tooltipText);
   // Alpha checks use the actual atlas pixels, excluding empty margins around desks and characters.
   const propImage=await loadImage('/assets/study-and-companions.webp');if(disposed)return;
   const pixels=document.createElement('canvas');pixels.width=propImage.width;pixels.height=propImage.height;
   const context=pixels.getContext('2d',{willReadFrequently:true})!;context.drawImage(propImage,0,0);const alpha=context.getImageData(0,0,pixels.width,pixels.height).data;
   const spriteContains=(s:Sprite,p:Point,hitTexture:Texture=s.texture)=>{const local=s.toLocal(scene.toGlobal(p)),f=hitTexture.frame;
    const x=Math.floor((local.x/s.texture.width+.5)*hitTexture.width),y=Math.floor((local.y/s.texture.height+1)*hitTexture.height);
    return x>=0&&y>=0&&x<f.width&&y<f.height&&alpha[((Math.floor(f.y)+y)*pixels.width+Math.floor(f.x)+x)*4+3]>90;
   };
   const gardenImage=await loadImage('/assets/garden-stages.webp');if(disposed)return;
   const gardenPixels=document.createElement('canvas');gardenPixels.width=gardenImage.width;gardenPixels.height=gardenImage.height;
   const gardenContext=gardenPixels.getContext('2d',{willReadFrequently:true})!;gardenContext.drawImage(gardenImage,0,0);const gardenAlpha=gardenContext.getImageData(0,0,gardenPixels.width,gardenPixels.height).data;
   const add=(item:Interaction)=>{interactions.push(item);return item;};
   // Pixel outlines that hug sprite artwork instead of drawing a hit-shape contour.
   const outlines=new Map<string,Sprite>();
   const deskHover=sceneAssets.desk.bounds.map((bounds,col)=>({
    texture:new Texture({source:deskHoverSheet.source,frame:new Rectangle(col*sceneAssets.desk.width,0,sceneAssets.desk.width,sceneAssets.desk.height)}),
    bounds,pad:sceneAssets.desk.pad,density:sceneAssets.desk.density
   }));
   studyStations.forEach(station=>{const p=iso(station.position.x,station.position.y),desk=sprite(deskTextures[station.atlasColumn],p.x,p.y+36,station.width);desk.zIndex=p.y;const hover=deskHover[station.atlasColumn],outline=new Sprite(hover.texture);
    outline.scale.set(1/hover.density);outline.position.set(desk.x-desk.width/2-hover.pad/hover.density,desk.y-desk.height-hover.pad/hover.density);
    outline.zIndex=desk.zIndex+.1;outline.alpha=0;outline.eventMode='none';world.addChild(outline);outlines.set(station.id,outline);
    const b=hover.bounds,left=outline.x+b.left/hover.density,top=outline.y+b.top/hover.density,right=outline.x+b.right/hover.density,bottom=outline.y+b.bottom/hover.density;
    const shape:Shape={kind:'polygon',points:[left,top,right,top,right,bottom,left,bottom]};
    add({id:station.id,name:station.label,action:'Begin Studying',symbol:'▤',priority:30,contains:q=>spriteContains(desk,q),shape,approaches:[station.seat,...station.alternatives],preferFirst:true,lookAt:{x:p.x,y:p.y-25},activate:()=>handlers.current.onOpen('learn')});
   });
   furnitureRegions.forEach(item=>add({...item,priority:20,contains:p=>contains(item.shape,p),activate:()=>handlers.current.onOpen(item.panel)}));
   const gp=iso(treeCenter.x,treeCenter.y),garden=sprite(gardenTextures[stageFor(state.energy)],gp.x,gp.y+83,365);garden.zIndex=gp.y+40;
   // The stone bed stays the click target; the outline and tooltip follow the whole tree.
   const gardenTooltip:Shape={kind:'polygon',points:[]},gardenOutline=new Sprite();gardenOutline.eventMode='none';gardenOutline.alpha=0;gardenOutline.zIndex=garden.zIndex+2;world.addChild(gardenOutline);outlines.set('garden',gardenOutline);
   const gardenHover=sceneAssets.garden.cells.map(cell=>({texture:new Texture({source:gardenHoverSheet.source,frame:new Rectangle(cell.x,0,cell.width,cell.height)}),bounds:cell.bounds}));
   const updateGardenOutline=()=>{const {density,pad}=sceneAssets.garden,hover=gardenHover[stageFor(state.energy)],b=hover.bounds;
    gardenOutline.texture=hover.texture;gardenOutline.scale.set(1/density);gardenOutline.position.set(garden.x-garden.width/2-pad/density,garden.y-garden.height-pad/density);
    const left=gardenOutline.x+b.left/density,top=gardenOutline.y+b.top/density,right=gardenOutline.x+b.right/density,bottom=gardenOutline.y+b.bottom/density;gardenTooltip.points=[left,top,right,top,right,bottom,left,bottom];
   };
   add({id:'garden',name:'Shared Garden',action:'View Garden Progress',symbol:'❧',priority:10,contains:p=>contains(gardenHotspot,p),shape:gardenHotspot,tooltipShape:gardenTooltip,approaches:gardenApproaches,activate:()=>handlers.current.onOpen('garden')});
   // Animate only small outer leaf clusters, never scale the complete garden/tree.
   const branches=[-1,1].map(side=>{const c=new Container();c.eventMode='none';c.zIndex=garden.zIndex+1;world.addChild(c);const leaf=new Sprite(garden.texture);leaf.anchor.set(.5,1);leaf.width=365;leaf.height=365*leaf.texture.height/leaf.texture.width;leaf.position.set(garden.x,garden.y);c.addChild(leaf);const mask=new Graphics();c.addChild(mask);leaf.mask=mask;return {c,leaf,mask,side};});
   const updateBranches=()=>{const stage=stageFor(state.energy);branches.forEach(({leaf,mask,side})=>{leaf.texture=garden.texture;leaf.width=365;leaf.height=365*leaf.texture.height/leaf.texture.width;
    const y=stage<2?garden.y-leaf.height+54:garden.y-leaf.height+45;const x=gp.x+side*(stage<2?35:58);mask.clear().poly([x-19,y+9,x-10,y-9,x+13,y-5,x+22,y+14,x+5,y+25,x-15,y+19]).fill(0xffffff);
   });};updateBranches();
   const moonflower=new Graphics();moonflower.moveTo(0,0).lineTo(0,-23).stroke({color:0x9ad7ae,width:2});for(let i=0;i<5;i++)moonflower.circle(Math.cos(i*1.256)*5,-27+Math.sin(i*1.256)*5,4).fill(0xd3f2dd);moonflower.circle(0,-27,3).fill(0xf5dda0);moonflower.position.set(gp.x+65,gp.y+24);moonflower.zIndex=gp.y+60;moonflower.eventMode='none';world.addChild(moonflower);
   const avatars=[state.avatar,...presets.slice(1)];
   const standing=await Promise.all(avatars.map(async a=>texture(await avatarCanvas(a))));
   let strides:Texture[]=[],strideGeneration=0;
   const warmStrides=async(avatar:typeof state.avatar)=>{
    const generation=++strideGeneration,frames:Texture[]=[];
    for(let frame=0;frame<RUN_FRAME_COUNT;frame++){
     // Let the initial scene paint and keep input responsive between frames.
     await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
     if(disposed||generation!==strideGeneration)return;
     frames.push(await texture(await avatarCanvas(avatar,false,frame)));
    }
    if(!disposed&&generation===strideGeneration)strides=frames;
   };
   const cycle=createWalkCycle(iso(position.x,position.y));
   const reading=await Promise.all(avatars.map(async (a,i)=>i===0||state.online[i]?texture(await avatarCanvas(a,true)):standing[i]));if(disposed)return;
   const players=standing.map((t,i)=>{const p=iso(approaches[i].x,approaches[i].y);return sprite(t,p.x,p.y+4,i===2?88:72);});
   const friendShapes:({kind:'ellipse';x:number;y:number;rx:number;ry:number}|undefined)[]=[];
   // Online classmates use tight body ellipses, not their atlas cell bounds.
   players.forEach((s,i)=>{if(!i)return;const shape={kind:'ellipse' as const,x:s.x,y:s.y-28,rx:17,ry:25};friendShapes[i]=shape;add({id:`friend-${i}`,name:['', 'Maya','Kai','Jules'][i],action:'View Gardener',symbol:'✧',priority:40,shape,contains:p=>state.online[i]&&contains(shape,p),approaches:[approaches[i]],activate:()=>handlers.current.onOpen('profile',i)});});
   const wander=createSproutlingWander(),petPoint=iso(8,4),pet=sprite(petTextures[state.energy>=100?1:0],petPoint.x,petPoint.y,125);pet.zIndex=petPoint.y+6;
   const petRuns=[0,1].map(stage=>Array.from({length:sceneAssets.run.frames},(_,frame)=>new Texture({source:petRunSheet.source,frame:new Rectangle(frame*sceneAssets.run.width,stage*sceneAssets.run.height,sceneAssets.run.width,sceneAssets.run.height)})));
   let petHitTexture=petTextures[state.energy>=100?1:0];
   const petCycle=createWalkCycle(petPoint);
   const petShape={kind:'ellipse' as const,x:pet.x+5,y:pet.y-32,rx:25,ry:29};
   const petInteraction=add({id:'pet',name:'Sproutling',action:'Interact with Sproutling',symbol:'♡',priority:50,shape:petShape,contains:p=>spriteContains(pet,p,petHitTexture),approaches:[{x:8,y:4}],activate:()=>{reactionStart=seconds;useGame.getState().set({reaction:['happy','watering','sleeping'][Math.floor(Math.random()*3)]});handlers.current.onHint('A happy little Sproutling. Every lesson helps it grow.');}});
   const sleep=new Text({text:'z z',style:{fontFamily:'Georgia',fontSize:14,fill:0xeee4c4}});sleep.position.set(petPoint.x+18,petPoint.y-75);sleep.visible=false;feedback.addChild(sleep);
   const cues=interactions.filter(i=>i.id.startsWith('desk-')||['garden','board','pet'].includes(i.id)).map(item=>{const g=new Text({text:item.symbol,style:{fontFamily:'Georgia',fontSize:17,fill:0xd8e6ac,stroke:{color:0x30372a,width:3}}});g.anchor.set(.5);feedback.addChild(g);return {item,g};});
   const setActivity=(activity:'Exploring'|'Idle'|'Studying')=>{if(useGame.getState().localActivity!==activity)useGame.getState().set({localActivity:activity});};
   const reportPosition=()=>{if(host.current){host.current.dataset.playerTile=`${position.x.toFixed(2)},${position.y.toFixed(2)}`;host.current.dataset.destination=route.length?`${route[route.length-1].x},${route[route.length-1].y}`:'';host.current.dataset.facing=String(facing);host.current.dataset.selected=selected?.id??'';host.current.dataset.seatedAt=seatedStation===undefined?'':studyStations[seatedStation].id;host.current.dataset.onlineAvatars=String(state.online.filter(Boolean).length);}};
   const sitAt=(item:Interaction)=>{const index=studyStations.findIndex(station=>station.id===item.id);if(index<0)return;seatedStation=index;seated=true;facing=chairPose(index).facing;confirmation=.65;setActivity('Studying');};
   const beginMove=(path:Point[],destination:Point,item?:Interaction)=>{route=path;pending=item;selected=item;selectionTime=seconds;confirmation=0;seated=false;seatedStation=undefined;setActivity(path.length?'Exploring':'Idle');
    const p=iso(destination.x,destination.y);marker.position.set(p.x,p.y);marker.visible=path.length>0;reportPosition();
    if(!path.length&&item){confirmation=.3;if(item.lookAt){const look=item.lookAt.x-iso(position.x,position.y).x;if(Math.abs(look)>1)facing=look<0?1:-1;}if(item.id.startsWith('desk-'))sitAt(item);}
   };
   const resetHint=()=>handlers.current.onHint('Click the floor to wander · choose a desk to learn');
   scene.on('pointermove',(event:FederatedPointerEvent)=>{if(handlers.current.suspended)return;const point=scene.toLocal(event.global),next=pickInteraction(interactions,point);pointer=point;
    if(next!==hovered){hovered=next;if(next)handlers.current.onHint(`${next.name} · ${next.action}`);else resetHint();}
    const tile=uniso(point.x,point.y),snapped={x:Math.round(tile.x*2)/2,y:Math.round(tile.y*2)/2},inFloor=contains(floorShape,point),valid=!blocked(snapped.x,snapped.y),center=iso(snapped.x,snapped.y);
    floorHover.clear();floorHover.visible=!next&&inFloor;
    if(floorHover.visible){floorHover.poly([center.x,center.y-8,center.x+16,center.y,center.x,center.y+8,center.x-16,center.y]).fill({color:valid?0xbcebd7:0xb39783,alpha:.035}).stroke({color:valid?0xbcebd7:0xb39783,width:1,alpha:.5});if(!valid)floorHover.moveTo(center.x-3,center.y-2).lineTo(center.x+3,center.y+2).moveTo(center.x+3,center.y-2).lineTo(center.x-3,center.y+2).stroke({color:0xb39783,width:1,alpha:.6});}
    cursorMode=next?'var(--leaf-interactive)':inFloor?(valid?'var(--leaf-walk)':'var(--leaf-blocked)'):'var(--leaf-default)';scene.cursor=cursorMode;
   });
   scene.on('pointerdown',()=>{if(!handlers.current.suspended){pressedUntil=seconds+.14;scene.cursor='var(--leaf-pressed)';}});
   scene.on('pointerleave',()=>{hovered=undefined;pointer=undefined;floorHover.visible=false;cursorMode='var(--leaf-default)';resetHint();});
   scene.on('pointertap',(event:FederatedPointerEvent)=>{
    if(handlers.current.suspended)return;const point=scene.toLocal(event.global),item=pickInteraction(interactions,point);
    if(item){if(selected===item&&(pending||seconds-selectionTime<.6))return;const plan=approachRoute(position,item.approaches,item.preferFirst);
     if(!plan){handlers.current.onHint('There’s no clear approach to that object.');return;}
     beginMove(plan.path,plan.destination,item);handlers.current.onHint(`${item.name} · on my way`);return;
    }
    if(!contains(floorShape,point))return;
    const plan=planRoute(position,uniso(point.x,point.y),true);if(!plan)return;beginMove(plan.path,plan.destination);resetHint();
   });
   const updateGarden=()=>{garden.texture=gardenTextures[stageFor(state.energy)];garden.width=365;garden.height=365*garden.texture.height/garden.texture.width;moonflower.visible=new Set(state.completions.map(c=>c.player)).size>=2;updateBranches();updateGardenOutline();};updateGarden();
   unsubscribe=useGame.subscribe((next,previous)=>{state=next;if(next.online!==previous.online){
     reportPosition();
     for(let i=1;i<avatars.length;i++)if(next.online[i]&&!previous.online[i]){
      void avatarCanvas(avatars[i],true).then(texture).then(t=>{if(!disposed)reading[i]=t;}).catch(console.error);
     }
    }if(next.energy!==previous.energy||next.completions!==previous.completions)updateGarden();if(next.reaction!==previous.reaction)reactionStart=seconds;
    if(next.avatar!==previous.avatar){
     strides=[];strideGeneration++;
     Promise.all([avatarCanvas(next.avatar),avatarCanvas(next.avatar,true)]).then(async canvases=>{
      const textures=await Promise.all(canvases.map(texture));
      if(!disposed&&next.avatar===useGame.getState().avatar){standing[0]=textures[0];reading[0]=textures[1];void warmStrides(next.avatar).catch(console.error);}
     }).catch(console.error);
    }
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
     if(!route.length){speed=0;marker.visible=false;confirmation=pending?.3:0;setActivity('Idle');if(pending?.lookAt){const look=pending.lookAt.x-iso(position.x,position.y).x;if(Math.abs(look)>1)facing=look<0?1:-1;}if(pending?.id.startsWith('desk-'))sitAt(pending);reportPosition();}
    }
    if(confirmation>0){confirmation-=dt;if(confirmation<=0&&pending){const done=pending;pending=undefined;selected=undefined;done.activate();}}
    const p=iso(position.x,position.y),stride=cycle(p,!reduced.matches);
    const seat=seated&&seatedStation!==undefined?chairPose(seatedStation,deskTextures[0].height/deskTextures[0].width):undefined;
    players[0].texture=seat?reading[0]:stride.frame>=0?(strides[stride.frame]??standing[0]):standing[0];players[0].anchor.set(seat?.anchorX??.5,seat?.anchorY??1);players[0].width=76;players[0].height=76*players[0].texture.height/players[0].texture.width;
    players[0].scale.x=Math.abs(players[0].scale.x)*(seat?.facing??facing);players[0].position.set(seat?.x??p.x,seat?.y??p.y+4+stride.bob);players[0].rotation=seat?0:stride.lean;players[0].zIndex=seat?.depth??p.y+6;
    for(let i=1;i<4;i++){const base=iso(approaches[i].x,approaches[i].y),sitting=state.memberActivities[i]==='Studying',chair=sitting?chairPose(i,deskTextures[0].height/deskTextures[0].width):undefined;
     players[i].texture=sitting?reading[i]:standing[i];players[i].anchor.set(chair?.anchorX??.5,chair?.anchorY??1);players[i].width=i===2?88:72;players[i].height=players[i].width*players[i].texture.height/players[i].texture.width;players[i].scale.x=Math.abs(players[i].scale.x)*(chair?.facing??1);players[i].position.set(chair?.x??base.x,chair?.y??base.y+4);players[i].zIndex=chair?.depth??base.y+6;players[i].visible=state.online[i];
     const shape=friendShapes[i];if(shape){shape.x=players[i].x;shape.y=players[i].y-(sitting?22:28);}
    }
    const active=seconds-reactionStart<4,celebrate=active&&['happy','celebrating','evolving'].includes(state.reaction);
    const roaming=wander(dt,!motion||handlers.current.suspended||hovered===petInteraction||selected===petInteraction||active);
    const petFloor=iso(roaming.position.x,roaming.position.y),petStride=petCycle(petFloor,!reduced.matches);
    petInteraction.approaches=[roaming.position];
    const petStage=state.energy>=100||active&&state.reaction==='watering'?1:0;petHitTexture=petTextures[petStage];pet.texture=petStride.frame>=0?petRuns[petStage][petStride.frame]:petTextures[petStage];pet.width=125;pet.height=125*petTextures[0].height/petTextures[0].width;pet.x=petFloor.x;pet.y=petFloor.y+petStride.bob+(motion?(celebrate?-Math.abs(Math.sin(seconds*7))*9:roaming.moving?0:Math.sin(seconds*2)*1.2):0);pet.rotation=petStride.frame>=0?petStride.lean:motion&&active&&state.reaction==='watering'?Math.sin(seconds*4)*.06:0;sleep.visible=state.reaction==='sleeping'&&active;pet.alpha=sleep.visible?.8:1;
    pet.scale.x=Math.abs(pet.scale.x)*roaming.facing;pet.zIndex=petFloor.y+6;
    petShape.x=pet.x+5*roaming.facing;petShape.y=pet.y-32;sleep.position.set(pet.x+18,pet.y-75);
    garden.tint=active&&state.reaction==='evolving'?0xedffd2:0xffffff;
    // See-through canopy: fade the tree while the cursor is over it or a character is standing behind it. Visual only: walking and click targets are unchanged.
    {const [cl,ct,cr,,,cb]=gardenTooltip.points,over=!!pointer&&pointer.x>cl&&pointer.x<cr&&pointer.y>ct&&pointer.y<cb;
     // Only the local character, and only where opaque tree pixels actually cover its body.
     const me=players[0],f=garden.texture.frame,treeCovers=(p:Point)=>{const local=garden.toLocal(scene.toGlobal(p)),x=Math.floor((local.x/garden.texture.width+.5)*f.width),y=Math.floor((local.y/garden.texture.height+1)*f.height);
      return x>=0&&y>=0&&x<f.width&&y<f.height&&gardenAlpha[((Math.floor(f.y)+y)*gardenPixels.width+Math.floor(f.x)+x)*4+3]>90;};
     const behind=me.zIndex<garden.zIndex&&[[0,.25],[0,.5],[0,.75],[-.2,.5],[.2,.5]].some(([dx,dy])=>treeCovers({x:me.x+dx*me.width,y:me.y-dy*me.height}));
     const target=handlers.current.suspended?1:over||behind?.25:1;treeAlpha+=(target-treeAlpha)*Math.min(1,dt/.12);garden.alpha=treeAlpha;}
    // Frame-rate independent 150ms fade. Only one object owns hover/selected feedback.
    const wanted=handlers.current.suspended?undefined:hovered??selected;if(wanted!==displayed){highlightAlpha=Math.max(0,highlightAlpha-dt/.15);if(highlightAlpha===0){displayed=wanted;highlight.clear();contour.clear();if(displayed){const dest=approachRoute(position,displayed.approaches,displayed.preferFirst)?.destination;
       if(dest){const a=iso(dest.x,dest.y);highlight.poly([a.x,a.y-8,a.x+16,a.y,a.x,a.y+8,a.x-16,a.y]).fill({color:0xbae5bf,alpha:.14}).stroke({color:0xbcebd7,width:1});}
       // Room-art objects get the same soft glow edge as the sprite outlines on desks and the tree.
       if(!outlines.has(displayed.id)){drawShape(contour,displayed.shape).fill({color:0xc9e4af,alpha:.05}).stroke({color:0xc9e6bf,width:5,alpha:.18,join:'round'});drawShape(contour,displayed.shape).stroke({color:0xc9e6bf,width:1.5,alpha:.85,join:'round'});}tooltipText.text=`${displayed.symbol}  ${displayed.name}\n${displayed.action}`;
       {const [fill,outline,frame,ink]=tooltipPalette[state.settings.theme]??tooltipPalette.Stardew,w=tooltipText.width+20,h=tooltipText.height+14;tooltipText.style.fill=ink;
        tooltipBg.clear().rect(-w/2+1,-h/2+4,w,h).fill({color:0x000000,alpha:.3}).roundRect(-w/2,-h/2,w,h,3).fill(fill).stroke({color:outline,width:2}).roundRect(-w/2+3,-h/2+3,w-6,h-6,2).stroke({color:frame,width:1.5});}
      }}}
    else highlightAlpha=Math.min(1,highlightAlpha+dt/.15);
    if(!wanted)highlightAlpha=Math.max(0,highlightAlpha-dt/.15);
    highlight.alpha=contour.alpha=highlightAlpha;tooltip.visible=!!hovered&&displayed===hovered&&highlightAlpha>0&&!handlers.current.suspended;tooltip.alpha=highlightAlpha;
    if(displayed){const at=objectTooltipPosition(displayed.tooltipShape??displayed.shape,tooltipText.width+20,tooltipText.height+14);tooltip.position.set(at.x,at.y);}
    marker.alpha=motion?.65+Math.sin(seconds*3)*.16:.8;
    cues.forEach(({item,g},i)=>{const near=item.approaches.some(a=>distance(position,a)<115),shape=item.shape;g.visible=!handlers.current.suspended&&(near||hovered===item||selected===item);g.alpha=(hovered===item||selected===item)?.8:motion?.22+Math.max(0,Math.sin(seconds*.7+i*2))*.25:.3;
     const x=shape.kind==='ellipse'?shape.x:shape.points[0]+30,y=shape.kind==='ellipse'?shape.y-shape.ry:shape.points[1];g.position.set(x,y-10+(motion?Math.sin(seconds*1.5+i)*1.5:0));
    });
    outlines.forEach((outline,id)=>{outline.alpha=displayed?.id===id?highlightAlpha:0;});
    branches.forEach(({c,side})=>{c.visible=motion&&state.settings.graphics==='Full'&&stageFor(state.energy)>0;c.alpha=.7*treeAlpha;c.x=motion?Math.sin(seconds*(side===1?.61:.43)+side)*1.3:0;c.y=motion?Math.sin(seconds*.37+side)*.45:0;});
    effects.update(seconds,dt,motion,state.settings.graphics==='Full',celebrate);
   });
   void warmStrides(state.avatar).catch(console.error);
   reportPosition();visibility=()=>{if(document.hidden)app.ticker.stop();else app.ticker.start();};document.addEventListener('visibilitychange',visibility);visibility();
  };
  run().catch(e=>{console.error(e);if(!disposed)setError(true);});
  return()=>{disposed=true;unsubscribe();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);if(app.renderer){destroyEffects();app.destroy(true,{children:true,texture:false});}};
 },[]);
 return <div className="canvas-host reference-world" ref={host} role="application" aria-label="Interactive greenhouse. Click clear floor tiles to walk; use the navigation buttons to access every activity.">{error&&<div className="canvas-error">The world artwork couldn’t load. You can still use every lesson and garden control in the navigation.</div>}</div>;
}
