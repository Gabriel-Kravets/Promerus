'use client';
import {useBackend} from './backend/BackendProvider';
import {rpc} from '@/lib/backend/client';
import {sharedSproutlingAt,sproutlingClock} from '@/lib/backend/shared-sproutling';
import {BackendError} from '@/lib/backend/contracts';
import {useEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Sprite,Texture,Rectangle,Text,FederatedPointerEvent} from 'pixi.js';
import {useGame,presets,type MemberActivity} from '@/store/game';
import {avatarCanvas,loadImage} from '@/lib/sprite-assets';
import {createWalkCycle} from '@/lib/walk-cycle';
import {RUN_FRAME_COUNT} from '@/lib/sprite-locomotion';
import {createSproutlingWander} from '@/lib/sproutling-wander';
import {iso,uniso,planRoute,approachRoute,distance,stageFor,blocked,setMovementObstacles,walkableTiles,Point} from '@/lib/movement';
import {facingSign,memberTile,otherGardeners,seatIndex} from '@/lib/room-characters';
import {studyStations,gardenApproaches,treeCenter} from '@/lib/world-layout';
import {contains,floorShape,gardenHotspot,furnitureRegions,inGardenBase,pickInteraction,Shape} from '@/lib/world-geometry';
import {chairPose,placedChairPose} from '@/lib/avatar-seating';
import {objectTooltipPosition} from '@/lib/tooltip-position';
import {createWorldEffects} from '@/lib/world-effects';
import {createPuffs,stoveSmoke} from '@/lib/ambient-puffs';
import {useItemDrag,useMoveLesson,checkItemPreview,attachPlacementOccupants,setPreviewAnchor,type PlacementOccupantPlan} from '@/store/item-drag';
import {useInventory} from '@/store/inventory';
import {getItemDefinition,itemInteractions,itemSprites,stovePipeMouth,studyDeskSprite,type ItemType} from '@/lib/items';
import {permanentRoomObstacles,itemFootprint,itemRenderOrder,resolvePlacements} from '@/lib/placement';
import {fixtureObstacles,roomFixture,translateShape} from '@/lib/room-fixtures';
import {pointerRoomPosition} from '@/lib/item-drag';
import {attachItemDragInput} from '@/lib/item-drag-input';
import {createItemArt,createItemFront,createItemPreview,registerItemTextures} from '@/lib/item-preview';
import {createItemHover,itemHoverContains,type ItemHover} from '@/lib/item-hover';
import {fillEnclosedGaps,spriteHoverPixels} from '@/lib/sprite-hover';
import {occupantShape,planPlacementNudges,type PlacementOccupant} from '@/lib/placement-occupants';
import sceneAssets from '@/lib/scene-assets.json';

type Props={suspended?:boolean;activityOverride?:MemberActivity;onOpen:(panel:string,player?:number)=>void;onHint:(text:string)=>void};
type Interaction={id:string;name:string;action:string;symbol:string;priority:number;contains:(p:Point)=>boolean;shape:Shape;approaches:Point[];activate:()=>void;lookAt?:Point;preferFirst?:boolean;tooltipShape?:Shape;instant?:boolean;seat?:ReturnType<typeof chairPose>};
const drawShape=(g:Graphics,shape:Shape)=>shape.kind==='ellipse'?g.ellipse(shape.x,shape.y,shape.rx,shape.ry):g.poly(shape.points);

export default function GameCanvas({onOpen,onHint,suspended=false,activityOverride}:Props){
 const backend=useBackend();
 const host=useRef<HTMLDivElement>(null),handlers=useRef({onOpen,onHint,suspended,activityOverride,backend});handlers.current={onOpen,onHint,suspended,activityOverride,backend};
 const [error,setError]=useState(false);
 useEffect(()=>{if(suspended)useItemDrag.getState().cancel();},[suspended]);
 useEffect(()=>{
  let disposed=false,unsubscribe=()=>{},unsubscribePreview=()=>{},unsubscribePlacements=()=>{},cleanupOccupants=()=>{},cleanupPreviewInput=()=>{},observer:ResizeObserver|undefined,visibility=()=>{},destroyEffects=()=>{};
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
   const floorItems=new Container();floorItems.sortableChildren=true;floorItems.eventMode='none';ground.addChild(floorItems);
   const world=new Container();world.sortableChildren=true;world.eventMode='none';scene.addChild(world);
   // Shop sprites are smooth downscales of large art, so sample them linearly.
   const spriteEntries=Object.entries(itemSprites) as [ItemType,{src:string}][];
   const spriteTextures=await Promise.all(spriteEntries.map(async([,art])=>{const t=await texture(art.src);t.source.scaleMode='linear';return t;}));
   if(disposed)return;
   const itemTextures=new Map<ItemType,Texture>(spriteEntries.map(([type],i)=>[type,spriteTextures[i]]));
   itemTextures.set('desk',deskTextures[0]);
   registerItemTextures(itemTextures);
   const effects=createWorldEffects(scene,room);destroyEffects=effects.destroy;
   const feedback=new Container();feedback.eventMode='none';scene.addChild(feedback);
   const sprite=(t:Texture,x:number,y:number,width:number)=>{const s=new Sprite(t);s.anchor.set(.5,1);s.width=width;s.height=width*t.height/t.width;s.position.set(x,y);s.zIndex=y;s.eventMode='none';world.addChild(s);return s;};
   let state=useGame.getState(),position:Point={x:8.5,y:8.5},route:Point[]=[],pending:Interaction|undefined,selected:Interaction|undefined,hovered:Interaction|undefined;
   let seconds=0,reactionStart=-10,speed=0,facing=1,selectionTime=0,confirmation=0,highlightAlpha=0,displayed:Interaction|undefined,seated=false,seatedStation:number|undefined=undefined,seatedItem:Interaction|undefined=undefined,seatActivity:'Studying'|'Idle'='Studying',cursorMode='var(--leaf-default)',pressedUntil=0,pointer:Point|undefined,treeAlpha=1;
   let networkSignature='',networkGeneration=0,networkSent='',networkAt=0,networkBusy=false,networkSequence=0,networkSession='',networkWorld='';
   const remotePeers=()=>otherGardeners(handlers.current.backend.snapshot?.members,handlers.current.backend.profile?.player_id);
   const remotePositions:Point[]=[];
   const remoteCycles:ReturnType<typeof createWalkCycle>[]=[],remoteStrides:Texture[][]=[];
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
   const spriteContains=(s:Sprite,p:Point,hitTexture:Texture=s.texture)=>{if(!s.visible)return false;const local=s.toLocal(scene.toGlobal(p)),f=hitTexture.frame;
    const x=Math.floor((local.x/s.texture.width+.5)*hitTexture.width),y=Math.floor((local.y/s.texture.height+1)*hitTexture.height);
    return x>=0&&y>=0&&x<f.width&&y<f.height&&alpha[((Math.floor(f.y)+y)*pixels.width+Math.floor(f.x)+x)*4+3]>90;
   };
   const gardenImage=await loadImage('/assets/garden-stages.webp');if(disposed)return;
   const gardenPixels=document.createElement('canvas');gardenPixels.width=gardenImage.width;gardenPixels.height=gardenImage.height;
   const gardenContext=gardenPixels.getContext('2d',{willReadFrequently:true})!;gardenContext.drawImage(gardenImage,0,0);const gardenAlpha=gardenContext.getImageData(0,0,gardenPixels.width,gardenPixels.height).data;
   const add=(item:Interaction)=>{interactions.push(item);return item;};
   // Pixel outlines that hug sprite artwork instead of drawing a hit-shape contour.
   const outlines=new Map<string,Sprite>();
   const ownedMasks=new Map<Container,ItemHover>(),itemHoverCache=new Map<string,ItemHover>();
   const getItemHover=(item:Parameters<typeof createItemHover>[1])=>{
    const key=`${item.type}:${item.theme}`;let mask=itemHoverCache.get(key);
    if(!mask){mask=createItemHover(app.renderer,item);itemHoverCache.set(key,mask);hoverTextures.push(mask.texture);}
    return mask;
   };
   const fixtureArt=new Map<string,Sprite>();
   const stationPositions=studyStations.map(station=>({...station.position}));
   const stationMirrors=studyStations.map(()=>false),stationStored=studyStations.map(()=>false);
   let gardenStored=false,gardenMirrored=false;
   const approaches=studyStations.map(station=>({...station.seat}));
   const stationAlternatives=studyStations.map(station=>station.alternatives.map(p=>({...p})));
   const deskHover=sceneAssets.desk.bounds.map((bounds,col)=>({
    texture:new Texture({source:deskHoverSheet.source,frame:new Rectangle(col*sceneAssets.desk.width,0,sceneAssets.desk.width,sceneAssets.desk.height)}),
    bounds,pad:sceneAssets.desk.pad,density:sceneAssets.desk.density/studyDeskSprite.scale
   }));
   studyStations.forEach((station,index)=>{const p=iso(station.position.x,station.position.y),desk=sprite(deskTextures[station.atlasColumn],p.x,p.y+36,station.width);desk.zIndex=p.y;fixtureArt.set(`fixture:${station.id}`,desk);const hover=deskHover[station.atlasColumn],outline=new Sprite(hover.texture);
    outline.scale.set(1/hover.density);outline.position.set(desk.x-desk.width/2-hover.pad/hover.density,desk.y-desk.height-hover.pad/hover.density);
    outline.zIndex=desk.zIndex+.1;outline.alpha=0;outline.eventMode='none';world.addChild(outline);outlines.set(station.id,outline);
    const b=hover.bounds,left=outline.x+b.left/hover.density,top=outline.y+b.top/hover.density,right=outline.x+b.right/hover.density,bottom=outline.y+b.bottom/hover.density;
    const shape:Shape={kind:'polygon',points:[left,top,right,top,right,bottom,left,bottom]};
    add({id:station.id,name:station.label,action:'Begin Studying',symbol:'▤',priority:30,contains:q=>spriteContains(desk,q),shape,approaches:[approaches[index],...stationAlternatives[index]],preferFirst:true,lookAt:{x:p.x,y:p.y-25},activate:()=>handlers.current.onOpen('learn')});
   });
   furnitureRegions.forEach(item=>add({...item,priority:20,contains:p=>contains(item.shape,p),activate:()=>handlers.current.onOpen(item.panel)}));
   const treeScale=.85,treeWidth=365*treeScale;
   const gp=iso(treeCenter.x,treeCenter.y),garden=sprite(gardenTextures[stageFor(state.energy)],gp.x,gp.y+83,treeWidth);garden.zIndex=gp.y+40;
   fixtureArt.set('fixture:garden',garden);
   let gardenOffset={x:0,y:0};
   // The stone bed stays the click target; the outline and tooltip follow the whole tree.
   const gardenTooltip:Shape={kind:'polygon',points:[]},gardenOutline=new Sprite();gardenOutline.eventMode='none';gardenOutline.alpha=0;gardenOutline.zIndex=garden.zIndex+2;world.addChild(gardenOutline);outlines.set('garden',gardenOutline);
   const gardenHover=sceneAssets.garden.cells.map(cell=>({texture:new Texture({source:gardenHoverSheet.source,frame:new Rectangle(cell.x,0,cell.width,cell.height)}),bounds:cell.bounds}));
   const updateGardenOutline=()=>{const {pad}=sceneAssets.garden,density=sceneAssets.garden.density/treeScale,hover=gardenHover[stageFor(state.energy)],b=hover.bounds;
    const sign=gardenMirrored?-1:1;
    gardenOutline.texture=hover.texture;gardenOutline.scale.set(sign/density,1/density);gardenOutline.position.set(garden.x+sign*(-garden.width/2-pad/density),garden.y-garden.height-pad/density);
    const x1=gardenOutline.x+sign*b.left/density,x2=gardenOutline.x+sign*b.right/density,left=Math.min(x1,x2),right=Math.max(x1,x2),top=gardenOutline.y+b.top/density,bottom=gardenOutline.y+b.bottom/density;gardenTooltip.points=[left,top,right,top,right,bottom,left,bottom];
   };
   // True where opaque tree pixels cover a scene point (scene coordinates).
   const treeCovers=(p:Point)=>{if(!garden.visible)return false;const f=garden.texture.frame,local=garden.toLocal(scene.toGlobal(p)),x=Math.floor((local.x/garden.texture.width+.5)*f.width),y=Math.floor((local.y/garden.texture.height+1)*f.height);
    return x>=0&&y>=0&&x<f.width&&y<f.height&&gardenAlpha[((Math.floor(f.y)+y)*gardenPixels.width+Math.floor(f.x)+x)*4+3]>90;};
   // While the local character stands behind the see-through tree, the canopy above the bed is clickable too.
   let playerBehindTree=false;
   const gardenInteraction=add({id:'garden',name:'Shared Garden',action:'View Garden Progress',symbol:'❧',priority:10,instant:true,contains:p=>garden.visible&&(inGardenBase({x:p.x-gardenOffset.x,y:p.y-gardenOffset.y})||(playerBehindTree&&p.y<gp.y&&treeCovers(p))),shape:{...gardenHotspot},tooltipShape:gardenTooltip,approaches:gardenApproaches.map(p=>({...p})),activate:()=>handlers.current.onOpen('garden')});
   // Animate only small outer leaf clusters, never scale the complete garden/tree.
   const branches=[-1,1].map(side=>{const c=new Container();c.eventMode='none';c.zIndex=garden.zIndex+1;world.addChild(c);const leaf=new Sprite(garden.texture);leaf.anchor.set(.5,1);leaf.width=treeWidth;leaf.height=treeWidth*leaf.texture.height/leaf.texture.width;leaf.position.set(garden.x,garden.y);c.addChild(leaf);const mask=new Graphics();c.addChild(mask);leaf.mask=mask;return {c,leaf,mask,side};});
   const updateBranches=()=>{const stage=stageFor(state.energy);branches.forEach(({leaf,mask,side})=>{leaf.texture=garden.texture;leaf.width=treeWidth;leaf.height=treeWidth*leaf.texture.height/leaf.texture.width;
    leaf.position.set(garden.x,garden.y);
    const y=garden.y-leaf.height+(stage<2?54:45)*treeScale;const x=gp.x+side*(stage<2?35:58)*treeScale;mask.position.set(x,y);mask.scale.set(treeScale);mask.clear().poly([-19,9,-10,-9,13,-5,22,14,5,25,-15,19]).fill(0xffffff);
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
   // Keep gardeners above room lighting. Depth stays on each sprite so nearer feet still draw in front.
   const cast=new Container();cast.sortableChildren=true;cast.eventMode='none';players.forEach(s=>{world.removeChild(s);cast.addChild(s);});scene.addChildAt(cast,scene.getChildIndex(feedback));
   const friendShapes:({kind:'ellipse';x:number;y:number;rx:number;ry:number}|undefined)[]=[];
   const friendPositions:(Point|undefined)[]=[];
   // Online classmates use tight body ellipses, not their atlas cell bounds.
   players.forEach((s,i)=>{if(!i)return;const shape={kind:'ellipse' as const,x:s.x,y:s.y-28,rx:17,ry:25};friendShapes[i]=shape;add({id:`friend-${i}`,get name(){return remotePeers()[i-1]?.name??'Gardener';},action:'View Gardener',symbol:'✧',priority:40,shape,contains:p=>(handlers.current.backend.enabled?!!remotePeers()[i-1]:state.online[i])&&contains(shape,p),approaches:[approaches[i]],activate:()=>handlers.current.onOpen(handlers.current.backend.enabled?'friends':'profile',i)});});
   let wander=createSproutlingWander();const petPoint=iso(8,4),pet=sprite(petTextures[state.energy>=100?1:0],petPoint.x,petPoint.y,125);pet.zIndex=petPoint.y+6;
   const petRuns=[0,1].map(stage=>Array.from({length:sceneAssets.run.frames},(_,frame)=>new Texture({source:petRunSheet.source,frame:new Rectangle(frame*sceneAssets.run.width,stage*sceneAssets.run.height,sceneAssets.run.width,sceneAssets.run.height)})));
   let petHitTexture=petTextures[state.energy>=100?1:0];
   const petCycle=createWalkCycle(petPoint);
   let sharedPet={position:{x:8,y:4},moving:false,facing:1};
   const petShape={kind:'ellipse' as const,x:pet.x+5,y:pet.y-32,rx:25,ry:29};
   // Sproutling gets the same traced edge as the desks and tree. Its art changes as it
   // walks and grows, so each frame's outline is traced on first use and cached.
   const petOutline=new Sprite();petOutline.eventMode='none';petOutline.alpha=0;pet.addChild(petOutline);outlines.set('pet',petOutline);
   const petOutlineTextures=new Map<Texture,{texture:Texture;pad:number;resolution:number}>();
   const updatePetOutline=()=>{
    const source=pet.texture;let traced=petOutlineTextures.get(source);
    if(!traced){
     const resolution=Math.min(1,250/source.width),pad=Math.ceil(6/resolution),art=new Sprite(source),frame=new Container();art.position.set(pad,pad);frame.addChild(art);
     let data:ReturnType<typeof app.renderer.extract.pixels>;
     try{data=app.renderer.extract.pixels({target:frame,frame:new Rectangle(0,0,source.width+pad*2,source.height+pad*2),resolution,antialias:true});}finally{frame.destroy({children:true});}
     const hover=spriteHoverPixels(fillEnclosedGaps(data.pixels,data.width,data.height),data.width,data.height,3);
     const canvas=document.createElement('canvas');canvas.width=data.width;canvas.height=data.height;canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(hover.pixels),data.width,data.height),0,0);
     traced={texture:Texture.from(canvas),pad,resolution};traced.texture.source.scaleMode='linear';hoverTextures.push(traced.texture);petOutlineTextures.set(source,traced);
    }
    petOutline.texture=traced.texture;petOutline.scale.set(1/traced.resolution);petOutline.position.set(-source.width*pet.anchor.x-traced.pad,-source.height*pet.anchor.y-traced.pad);
   };
   const petInteraction=add({id:'pet',name:'Sproutling',action:'Interact with Sproutling',symbol:'♡',priority:50,shape:petShape,contains:p=>spriteContains(pet,p,petHitTexture),approaches:[{x:8,y:4}],activate:()=>{const net=handlers.current.backend;const reaction=['happy','watering','sleeping'][Math.floor(Math.random()*3)];if(net.enabled&&net.client&&net.lease){void rpc(net.client,'react_sproutling',{p_session:net.lease.id,p_reaction:reaction}).catch(()=>handlers.current.onHint('Sproutling is reconnecting. Try again in a moment.'));}else{reactionStart=seconds;useGame.getState().set({reaction});}handlers.current.onHint('A happy little Sproutling. Every lesson helps it grow.');}});
   const sleep=new Text({text:'z z',style:{fontFamily:'Georgia',fontSize:14,fill:0xeee4c4}});sleep.position.set(petPoint.x+18,petPoint.y-75);sleep.visible=false;feedback.addChild(sleep);
   const cues=interactions.filter(i=>i.id.startsWith('desk-')||['garden','board','pet'].includes(i.id)).map(item=>{const g=new Text({text:item.symbol,style:{fontFamily:'Georgia',fontSize:17,fill:0xd8e6ac,stroke:{color:0x30372a,width:3}}});g.anchor.set(.5);feedback.addChild(g);return {item,g};});
   const setActivity=(activity:MemberActivity)=>{if(useGame.getState().localActivity!==activity)useGame.getState().set({localActivity:activity});};
   const reportPosition=()=>{if(!host.current||!Number.isFinite(position.x)||!Number.isFinite(position.y))return;host.current.dataset.playerTile=`${position.x.toFixed(2)},${position.y.toFixed(2)}`;host.current.dataset.destination=route.length?`${route[route.length-1].x},${route[route.length-1].y}`:'';host.current.dataset.facing=String(facing);host.current.dataset.selected=selected?.id??'';host.current.dataset.seatedAt=seatedItem?.id??(seatedStation===undefined?'':studyStations[seatedStation].id);host.current.dataset.onlineAvatars=String(handlers.current.backend.enabled?1+remotePeers().length:state.online.filter(Boolean).length);};
   const sitAt=(item:Interaction)=>{
    if(item.seat){seatedItem=item;seated=true;facing=item.seat.facing;seatActivity=itemInteractions.desk?.action===item.action?'Studying':'Idle';confirmation=.65;setActivity(seatActivity);return;}
    const index=studyStations.findIndex(station=>station.id===item.id);if(index<0)return;seatedStation=index;seated=true;seatActivity='Studying';facing=chairPose(index).facing;confirmation=.65;setActivity('Studying');};
   const beginMove=(path:Point[],destination:Point,item?:Interaction)=>{route=path;pending=item;selected=item;selectionTime=seconds;confirmation=0;seated=false;seatedStation=undefined;seatedItem=undefined;setActivity(path.length?'Exploring':'Idle');
    const p=iso(destination.x,destination.y);marker.position.set(p.x,p.y);marker.visible=path.length>0;reportPosition();
    if(!path.length&&item){confirmation=.3;if(item.lookAt){const look=item.lookAt.x-iso(position.x,position.y).x;if(Math.abs(look)>1)facing=look<0?1:-1;}sitAt(item);}
   };
   const resetHint=()=>handlers.current.onHint('Click the floor to wander · choose a desk to learn');
   const roomInputBlocked=()=>handlers.current.suspended||!!useItemDrag.getState().preview;
   const stopRoomMove=()=>{route=[];pending=undefined;selected=undefined;confirmation=0;speed=0;marker.visible=false;setActivity(seated?seatActivity:'Idle');reportPosition();};
   const placedArt=new Map<string,Container>(),placedFronts=new Map<string,Container>(),stoveSmokes:ReturnType<typeof createPuffs>[]=[];
   const artContains=(art:Container,at:Point)=>{const local=art.toLocal(scene.toGlobal(at)),mask=ownedMasks.get(art);return mask?itemHoverContains(mask,local):art.getLocalBounds().containsPoint(local.x,local.y);};
   const syncFixtures=()=>{
    const inventory=useInventory.getState(),positions=inventory.fixturePositions??{};
    studyStations.forEach((station,index)=>{
     const tile=positions[`fixture:${station.id}`]??station.position,at=iso(tile.x,tile.y),desk=fixtureArt.get(`fixture:${station.id}`)!,outline=outlines.get(station.id)!;
     const mirrored=!!positions[`fixture:${station.id}`]?.mirrored,sign=mirrored?-1:1,hover=deskHover[station.atlasColumn],b=hover.bounds;
     stationMirrors[index]=mirrored;stationStored[index]=!!inventory.storedFixtures?.includes(`fixture:${station.id}`);
     desk.position.set(at.x,at.y+36);desk.zIndex=at.y;desk.scale.x=Math.abs(desk.scale.x)*sign;
     outline.scale.set(sign/hover.density,1/hover.density);outline.position.set(desk.x+sign*(-desk.width/2-hover.pad/hover.density),desk.y-desk.height-hover.pad/hover.density);outline.zIndex=at.y+.1;
     const interaction=interactions.find(item=>item.id===station.id)!;
     const x1=outline.x+sign*b.left/hover.density,x2=outline.x+sign*b.right/hover.density,left=Math.min(x1,x2),right=Math.max(x1,x2),top=outline.y+b.top/hover.density,bottom=outline.y+b.bottom/hover.density;
     interaction.shape={kind:'polygon',points:[left,top,right,top,right,bottom,left,bottom]};interaction.lookAt={x:at.x,y:at.y-25};
     Object.assign(stationPositions[index],{x:tile.x,y:tile.y});
     const approach=(p:Point)=>{const dx=p.x-station.position.x,dy=p.y-station.position.y;return {x:tile.x+(mirrored?dy:dx),y:tile.y+(mirrored?dx:dy)};};
     Object.assign(approaches[index],approach(station.seat));
     station.alternatives.forEach((p,i)=>Object.assign(stationAlternatives[index][i],approach(p)));
    });
    const tile=positions['fixture:garden']??treeCenter,at=iso(tile.x,tile.y),original=iso(treeCenter.x,treeCenter.y);
    Object.assign(gp,at);gardenOffset={x:at.x-original.x,y:at.y-original.y};
    gardenMirrored=!!positions['fixture:garden']?.mirrored;gardenStored=!!inventory.storedFixtures?.includes('fixture:garden');
    garden.position.set(at.x,at.y+83);garden.scale.x=Math.abs(garden.scale.x)*(gardenMirrored?-1:1);garden.zIndex=at.y+40;gardenOutline.zIndex=garden.zIndex+2;
    gardenInteraction.shape=translateShape(gardenHotspot,gardenOffset.x,gardenOffset.y);
    gardenInteraction.approaches=gardenApproaches.map(p=>({x:p.x+tile.x-treeCenter.x,y:p.y+tile.y-treeCenter.y}));
    branches.forEach(({c})=>{c.zIndex=garden.zIndex+1;});
    moonflower.position.set(gp.x+(gardenMirrored?-65:65),gp.y+24);moonflower.zIndex=gp.y+60;updateBranches();updateGardenOutline();
   };
   const nearestClear=(point:Point)=>[...walkableTiles].filter(p=>!blocked(p.x,p.y)).sort((a,b)=>distance(a,point)-distance(b,point))[0]??point;
   const syncPlacements=()=>{
    syncFixtures();
    placedArt.forEach((art,id)=>{outlines.delete(`owned:${id}`);ownedMasks.delete(art);art.destroy({children:true});});placedArt.clear();
    placedFronts.forEach(front=>front.destroy({children:true}));placedFronts.clear();stoveSmokes.length=0;
    for(let i=interactions.length-1;i>=0;i--)if(interactions[i].id.startsWith('owned:'))interactions.splice(i,1);
    const inventory=useInventory.getState(),placed=resolvePlacements(inventory.items,inventory.placements);
    setMovementObstacles([...permanentRoomObstacles,...fixtureObstacles(inventory.fixturePositions,undefined,inventory.storedFixtures,true),...placed.filter(p=>getItemDefinition(p.item.type,p.item.theme).solid).map(p=>itemFootprint(p.item,p.position))],true);
    route=[];pending=undefined;selected=undefined;confirmation=0;speed=0;marker.visible=false;hovered=undefined;
    if(blocked(position.x,position.y))position={...nearestClear(position)};
    if(seatedStation!==undefined){if(stationStored[seatedStation]){seated=false;seatedStation=undefined;setActivity('Idle');}else position={...approaches[seatedStation]};}
    const petTile=petInteraction.approaches[0];if(blocked(petTile.x,petTile.y)){const clear=nearestClear(petTile);wander=createSproutlingWander(clear);petInteraction.approaches=[clear];}
    for(let i=1;i<avatars.length;i++)if(state.online[i]){
     const at=friendPositions[i]??approaches[i];if(blocked(at.x,at.y))friendPositions[i]={...nearestClear(at)};
    }
    for(const {item,position:tile} of placed){
     const art=createItemArt(item),at=iso(tile.x,tile.y),order=itemRenderOrder(item,tile);art.position.set(at.x,at.y);art.zIndex=order.depth;
     (order.layer==='floor'?floorItems:world).addChild(art);placedArt.set(item.id,art);
     // Above a seated avatar (depth +2) so the armrest covers its legs.
     const front=createItemFront(item);if(front){front.position.set(at.x,at.y);front.zIndex=at.y+2.5;world.addChild(front);placedFronts.set(item.id,front);}
     if(item.type==='stove'){const smoke=createPuffs(stoveSmoke,item.id.length);smoke.root.position.set(stovePipeMouth.x,stovePipeMouth.y);art.addChild(smoke.root);stoveSmokes.push(smoke);}
     const interaction=itemInteractions[item.type];
     if(interaction&&getItemDefinition(item.type,item.theme).solid){
      const mask=getItemHover(item),bounds=mask.bounds,outline=new Sprite(mask.texture);
      outline.scale.set(1/mask.resolution);outline.position.set(mask.left,mask.top);outline.alpha=0;outline.eventMode='none';
      art.addChild(outline);ownedMasks.set(art,mask);outlines.set(`owned:${item.id}`,outline);
      const sign=item.mirrored?-1:1,left=at.x+Math.min(sign*bounds.left,sign*bounds.right),right=at.x+Math.max(sign*bounds.left,sign*bounds.right),shape:Shape={kind:'polygon',points:[left,at.y+bounds.top,right,at.y+bounds.top,right,at.y+bounds.bottom,left,at.y+bounds.bottom]};
      const options=walkableTiles.filter(p=>!blocked(p.x,p.y)&&distance(p,tile)<150).sort((a,b)=>distance(a,tile)-distance(b,tile)).slice(0,8);
      add({id:`owned:${item.id}`,name:getItemDefinition(item.type,item.theme).name,action:interaction.action,symbol:'✧',priority:35,shape,contains:p=>art.visible&&artContains(art,p),approaches:options,seat:placedChairPose(item,tile,(itemTextures.get(item.type)?.height??1)/(itemTextures.get(item.type)?.width??1)),activate:()=>handlers.current.onOpen(interaction.panel)});
     }
    }
    if(seatedItem){const id=seatedItem.id;seatedItem=interactions.find(item=>item.id===id&&!!item.seat);if(!seatedItem){seated=false;setActivity('Idle');}}
    if(host.current)host.current.dataset.placedItems=String(placed.length);reportPosition();
   };
   syncPlacements();
   const roomOccupants=():PlacementOccupant[]=>[
    {id:'local',position:{...position},rx:10,ry:8},
    {id:'pet',position:{...petInteraction.approaches[0]},rx:14,ry:10},
    ...approaches.flatMap((p,i)=>i&&state.online[i]?[{id:`friend-${i}`,position:{...friendPositions[i]??p},rx:10,ry:8}]:[]),
   ];
   // Preview planning never moves actors. A successful drop applies the complete
   // short-step plan after the new placement has passed every collision check.
   let cachedPlanKey='',cachedPlan:PlacementOccupantPlan|null=null;
   cleanupOccupants=attachPlacementOccupants(()=>roomOccupants().map(occupantShape),preview=>{
    const inventory=useInventory.getState(),occupants=roomOccupants();
    const key=JSON.stringify([preview.item,preview.position,inventory.items,inventory.placements,inventory.fixturePositions,inventory.storedFixtures,occupants]);
    if(key===cachedPlanKey)return cachedPlan;
    cachedPlanKey=key;cachedPlan=null;
    const obstacles=[...permanentRoomObstacles,...fixtureObstacles(inventory.fixturePositions,preview.item.id,inventory.storedFixtures,true),
     ...resolvePlacements(inventory.items,inventory.placements.filter(p=>p.itemId!==preview.item.id)).filter(p=>getItemDefinition(p.item.type,p.item.theme).solid).map(p=>itemFootprint(p.item,p.position))];
    const moves=planPlacementNudges(preview.item,preview.position,occupants,obstacles);
    if(!moves)return null;
    const destinations=new Map(moves.map(move=>[move.id,move.position]));
    cachedPlan={obstacles:occupants.map(actor=>occupantShape({...actor,position:destinations.get(actor.id)??actor.position})),apply:()=>{
     for(const move of moves){
      if(move.id==='local'){
       stopRoomMove();seated=false;seatedStation=undefined;seatedItem=undefined;position={...move.position};setActivity('Idle');
      }else if(move.id==='pet'){
       wander=createSproutlingWander(move.position);petInteraction.approaches=[{...move.position}];
      }else{
       const index=Number(move.id.slice('friend-'.length));friendPositions[index]={...move.position};
       const interaction=interactions.find(item=>item.id===move.id);if(interaction)interaction.approaches=[friendPositions[index]!];
      }
     }
     reportPosition();
    }};return cachedPlan;
   });
   const previewOutline=new Graphics();previewOutline.eventMode='none';feedback.addChild(previewOutline);
   let previewArt:Container|undefined,previewItem:object|undefined,wasPreviewing=false;
   const updatePreview=()=>{
    const {preview}=useItemDrag.getState();
    placedArt.forEach((art,id)=>{art.visible=!(preview?.originalPosition&&preview.item.id===id);const front=placedFronts.get(id);if(front)front.visible=art.visible;});
    if(preview?.item!==previewItem){previewArt?.destroy({children:true});previewArt=undefined;previewItem=preview?.item;
     if(preview){
      const original=fixtureArt.get(preview.item.id);
      if(original){const ghost=new Sprite(original.texture);ghost.anchor.copyFrom(original.anchor);ghost.width=original.width;ghost.height=original.height;ghost.scale.x=Math.abs(ghost.scale.x)*(preview.item.mirrored?-1:1);ghost.alpha=.65;ghost.eventMode='none';previewArt=ghost;}
      else previewArt=createItemPreview(preview.item);
      (getItemDefinition(preview.item.type,preview.item.theme).layer==='floor'?floorItems:world).addChild(previewArt);
     }}
    fixtureArt.forEach((art,id)=>{art.visible=preview?.item.id!==id&&!useInventory.getState().storedFixtures?.includes(id);});
    effects.setGarden(garden.visible?{x:gp.x,y:gp.y+23}:null);
    if(preview&&previewArt){const at=iso(preview.position.x,preview.position.y),fixture=roomFixture(preview.item.id);previewArt.position.set(at.x,at.y+(fixture?(fixture.type==='desk'?36:83):0));
     previewArt.zIndex=fixture?at.y+(fixture.type==='tree'?40:0):itemRenderOrder(preview.item,preview.position).depth;
     const valid=checkItemPreview().valid;previewArt.tint=valid?0xffffff:0xffa7a0;
     previewOutline.clear().poly(itemFootprint(preview.item,preview.position).points).fill({color:valid?0xaedc97:0xf49286,alpha:.15}).stroke({color:valid?0xaedc97:0xf49286,width:2});
     if(!wasPreviewing){route=[];pending=undefined;selected=undefined;confirmation=0;speed=0;marker.visible=false;setActivity(seated?seatActivity:'Idle');reportPosition();}
     hovered=undefined;pointer=undefined;floorHover.visible=false;tooltip.visible=false;pressedUntil=0;
     highlightAlpha=0;highlight.alpha=contour.alpha=0;outlines.forEach(outline=>outline.alpha=0);
     cursorMode=preview.phase==='idle'?'grab':'grabbing';scene.cursor=cursorMode;app.canvas.style.cursor=cursorMode;
     if(host.current){host.current.dataset.previewItem=preview.item.id;host.current.dataset.previewTile=`${preview.position.x.toFixed(3)},${preview.position.y.toFixed(3)}`;host.current.dataset.previewPhase=preview.phase;host.current.dataset.previewValid=String(valid);}
    }else if(wasPreviewing){cursorMode='var(--leaf-default)';scene.cursor=cursorMode;app.canvas.style.cursor=cursorMode;resetHint();
     previewOutline.clear();if(host.current){delete host.current.dataset.previewItem;delete host.current.dataset.previewTile;delete host.current.dataset.previewPhase;delete host.current.dataset.previewValid;}}
    wasPreviewing=!!preview;publishAnchor();
   };
   const publishAnchor=()=>{
    if(!previewArt||!useItemDrag.getState().preview){setPreviewAnchor(null);return;}
    const b=previewArt.getBounds(),r=app.canvas.getBoundingClientRect();
    setPreviewAnchor({x:r.left+b.x+b.width/2,top:r.top+b.y,bottom:r.top+b.y+b.height});
   };
   unsubscribePreview=useItemDrag.subscribe(updatePreview);updatePreview();
   unsubscribePlacements=useInventory.subscribe((next,previous)=>{if(next.placements!==previous.placements||next.fixturePositions!==previous.fixturePositions||next.storedFixtures!==previous.storedFixtures||next.items!==previous.items)syncPlacements();updatePreview();});
   const roomPoint=(event:PointerEvent)=>pointerRoomPosition({x:event.clientX,y:event.clientY},app.canvas.getBoundingClientRect(),app.screen,{x:scene.x,y:scene.y,scaleX:scene.scale.x,scaleY:scene.scale.y});
   const overPreview=(point:Point)=>!!previewArt&&artContains(previewArt,iso(point.x,point.y));
   const pickPlacedItem=(point:Point)=>{
    // Editing follows the placed artwork rather than room-action priorities:
    // a passing pet or classmate must not make a piece impossible to grab.
    const at=iso(point.x,point.y);
    const hits:[string,Container][]=[...[...placedArt].filter(([,art])=>art.visible&&artContains(art,at)),
     ...[...fixtureArt].filter(([id,art])=>art.visible&&(id==='fixture:garden'?treeCovers(at):spriteContains(art,at)))];
    hits.sort((a,b)=>Number(b[1].parent===world)-Number(a[1].parent===world)||b[1].zIndex-a[1].zIndex);
    return hits[0]?.[0];
   };
   cleanupPreviewInput=attachItemDragInput(app.canvas,{point:roomPoint,hitTest:overPreview,suspended:()=>handlers.current.suspended,pickItem:pickPlacedItem,onTap:point=>{if(useMoveLesson.getState().active){useMoveLesson.setState(s=>({taps:s.taps+1}));return;}activatePoint(iso(point.x,point.y));},onHoldStart:stopRoomMove});
   scene.on('pointermove',(event:FederatedPointerEvent)=>{if(roomInputBlocked())return;const point=scene.toLocal(event.global),next=pickInteraction(interactions,point);pointer=point;
    if(next!==hovered){hovered=next;if(next)handlers.current.onHint(`${next.name} · ${next.action}`);else resetHint();}
    const tile=uniso(point.x,point.y),snapped={x:Math.round(tile.x*2)/2,y:Math.round(tile.y*2)/2},inFloor=contains(floorShape,point),valid=!blocked(snapped.x,snapped.y),center=iso(snapped.x,snapped.y);
    floorHover.clear();floorHover.visible=!next&&inFloor;
    if(floorHover.visible){floorHover.poly([center.x,center.y-8,center.x+16,center.y,center.x,center.y+8,center.x-16,center.y]).fill({color:valid?0xbcebd7:0xb39783,alpha:.035}).stroke({color:valid?0xbcebd7:0xb39783,width:1,alpha:.5});if(!valid)floorHover.moveTo(center.x-3,center.y-2).lineTo(center.x+3,center.y+2).moveTo(center.x+3,center.y-2).lineTo(center.x-3,center.y+2).stroke({color:0xb39783,width:1,alpha:.6});}
    cursorMode=next?'var(--leaf-interactive)':inFloor?(valid?'var(--leaf-walk)':'var(--leaf-blocked)'):'var(--leaf-default)';scene.cursor=cursorMode;
   });
   scene.on('pointerdown',()=>{if(!roomInputBlocked()){pressedUntil=seconds+.14;scene.cursor='var(--leaf-pressed)';}});
   scene.on('pointerleave',()=>{if(roomInputBlocked())return;hovered=undefined;pointer=undefined;floorHover.visible=false;cursorMode='var(--leaf-default)';resetHint();});
   function activatePoint(point:Point){
    if(roomInputBlocked())return;const item=pickInteraction(interactions,point);
    // Instant objects open from anywhere; the character stays put.
    if(item?.instant){item.activate();return;}
    if(item){if(selected===item&&(pending||seconds-selectionTime<.6))return;const plan=approachRoute(position,item.approaches,item.preferFirst);
     if(!plan){handlers.current.onHint('There’s no clear approach to that object.');return;}
     beginMove(plan.path,plan.destination,item);handlers.current.onHint(`${item.name} · on my way`);return;
    }
    if(!contains(floorShape,point))return;
    const plan=planRoute(position,uniso(point.x,point.y),true);if(!plan)return;beginMove(plan.path,plan.destination);resetHint();
   }
   scene.on('pointertap',(event:FederatedPointerEvent)=>activatePoint(scene.toLocal(event.global)));
   const updateGarden=()=>{garden.texture=gardenTextures[stageFor(state.energy)];garden.width=treeWidth;garden.height=treeWidth*garden.texture.height/garden.texture.width;moonflower.visible=state.cloud?state.sharedBloom:new Set(state.completions.map(c=>c.player)).size>=2;updateBranches();updateGardenOutline();};updateGarden();
   unsubscribe=useGame.subscribe((next,previous)=>{state=next;if(next.online!==previous.online){
     reportPosition();
     if(useItemDrag.getState().preview)updatePreview();
     for(let i=1;i<avatars.length;i++)if(next.online[i]&&!previous.online[i]){
      void avatarCanvas(avatars[i],true).then(texture).then(t=>{if(!disposed)reading[i]=t;}).catch(console.error);
     }
    }if(next.energy!==previous.energy||next.completions!==previous.completions||next.sharedBloom!==previous.sharedBloom)updateGarden();if(next.reaction!==previous.reaction)reactionStart=seconds;
    if(next.avatar!==previous.avatar){
     strides=[];strideGeneration++;
     Promise.all([avatarCanvas(next.avatar),avatarCanvas(next.avatar,true)]).then(async canvases=>{
      const textures=await Promise.all(canvases.map(texture));
      if(!disposed&&next.avatar===useGame.getState().avatar){standing[0]=textures[0];reading[0]=textures[1];void warmStrides(next.avatar).catch(console.error);}
     }).catch(console.error);
    }
   });
   app.ticker.add(tick=>{try{
    if(previewArt)publishAnchor();
    const dt=Math.min(tick.deltaMS/1000,.05);seconds+=dt;const motion=state.settings.motion&&!reduced.matches;
    if(roomInputBlocked()){if(route.length||pending){route=[];pending=undefined;selected=undefined;confirmation=0;speed=0;marker.visible=false;setActivity(handlers.current.activityOverride??'Idle');reportPosition();}hovered=undefined;floorHover.visible=false;}
    scene.cursor=seconds<pressedUntil?'var(--leaf-pressed)':cursorMode;
    const walking=route.length>0;
    if(walking){const remaining=route.reduce((total,p,i)=>total+distance(i?route[i-1]:position,p),0),targetSpeed=Math.min(112,Math.sqrt(2*260*remaining));
     speed+=Math.max(-260*dt,Math.min(260*dt,targetSpeed-speed));let travel=speed*dt;
     while(route.length&&travel>0){const next=route[0],d=distance(position,next);const projected=iso(next.x,next.y),current=iso(position.x,position.y);if(Math.abs(projected.x-current.x)>.1)facing=projected.x<current.x?1:-1;
      if(d<=travel+.05){position={...next};route.shift();travel-=d;}else{position.x+=(next.x-position.x)*travel/d;position.y+=(next.y-position.y)*travel/d;travel=0;}}
     if(!route.length){speed=0;marker.visible=false;confirmation=pending?.3:0;setActivity('Idle');if(pending?.lookAt){const look=pending.lookAt.x-iso(position.x,position.y).x;if(Math.abs(look)>1)facing=look<0?1:-1;}if(pending)sitAt(pending);reportPosition();}
    }
    if(confirmation>0){confirmation-=dt;if(confirmation<=0&&pending){const done=pending;pending=undefined;selected=undefined;done.activate();}}
    if(!Number.isFinite(position.x)||!Number.isFinite(position.y))position={x:8.5,y:8.5};
    facing=facingSign(facing);
    const net=handlers.current.backend,peers=remotePeers();
    if(net.lease?.id!==networkSession){networkSession=net.lease?.id??'';networkSequence=net.lease?.sequence??0;networkSent='';const local=net.snapshot?.members.find(m=>m.player_id===net.profile?.player_id);if(local){position=memberTile(local,local.slot??0);facing=facingSign(local.facing);route=[];pending=undefined;reportPosition();}}
    const p=iso(position.x,position.y),stride=cycle(p);
    const seat=seated&&seatedStation!==undefined?chairPose(seatedStation,deskTextures[0].height/deskTextures[0].width,stationPositions[seatedStation],stationMirrors[seatedStation]):seated?seatedItem?.seat:undefined;
    const localTexture=seat?reading[0]:stride.frame>=0?(strides[stride.frame]??standing[0]):standing[0];
    if(localTexture?.width)players[0].texture=localTexture;players[0].anchor.set(seat?.anchorX??.5,seat?.anchorY??1);players[0].width=76;players[0].height=76*(players[0].texture.height||1)/(players[0].texture.width||1);
    players[0].scale.x=(Math.abs(players[0].scale.x)||1)*facingSign(seat?.facing??facing);const localX=seat?.x??p.x,localY=seat?.y??p.y+4+stride.bob;if(Number.isFinite(localX)&&Number.isFinite(localY))players[0].position.set(localX,localY);players[0].rotation=seat?0:stride.lean;players[0].zIndex=seat?.depth??(Number.isFinite(p.y)?p.y+6:500);players[0].visible=true;players[0].alpha=1;
    const signature=peers.map(peer=>`${peer.player_id}:${peer.appearance_version}`).join('|');
    if(net.enabled&&signature!==networkSignature){reportPosition();networkSignature=signature;const generation=++networkGeneration;peers.forEach((peer,j)=>{const tile=memberTile(peer,peer.slot??j);remoteCycles[j+1]=createWalkCycle(iso(tile.x,tile.y));remoteStrides[j+1]=[];void(async()=>{const portrait=peer.avatar??useGame.getState().avatar;const [idle,study]=await Promise.all([avatarCanvas(portrait),avatarCanvas(portrait,true)].map(async canvas=>texture(await canvas)));if(disposed||generation!==networkGeneration||!idle.width)return;standing[j+1]=idle;reading[j+1]=study;const frames:Texture[]=[];for(let frame=0;frame<RUN_FRAME_COUNT;frame++){await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));if(disposed||generation!==networkGeneration)return;frames.push(await texture(await avatarCanvas(portrait,false,frame)));}if(!disposed&&generation===networkGeneration)remoteStrides[j+1]=frames;})().catch(()=>handlers.current.onHint('A gardener’s portrait is still loading.'));});}
    if((net.snapshot?.world.id??'')!==networkWorld){networkWorld=net.snapshot?.world.id??'';remotePositions.length=0;if(net.snapshot)sharedPet=sharedSproutlingAt(net.snapshot.world.id,sproutlingClock(Date.now()+net.snapshot.clockOffset,net.snapshot.world.pet_pause_total,net.snapshot.world.pet_pause_until));}
    for(let i=1;i<4;i++){const ground=friendPositions[i]??approaches[i];if(!net.enabled&&state.online[i]&&blocked(ground.x,ground.y))friendPositions[i]={...nearestClear(ground)};const at=friendPositions[i]??approaches[i];const peer=net.enabled?peers[i-1]:undefined,tile=peer?memberTile(peer,peer.slot??i-1):at,target=iso(tile.x,tile.y);if(!remotePositions[i]||!Number.isFinite(remotePositions[i].x)||!Number.isFinite(remotePositions[i].y))remotePositions[i]={...target};if(Number.isFinite(target.x)&&Number.isFinite(target.y)){remotePositions[i].x+=(target.x-remotePositions[i].x)*Math.min(1,dt*12);remotePositions[i].y+=(target.y-remotePositions[i].y)*Math.min(1,dt*12);}const base=net.enabled?remotePositions[i]:target,chairSeat=seatIndex(peer?.seat),sitting=net.enabled?chairSeat!==undefined:!friendPositions[i]&&!stationStored[i]&&state.memberActivities[i]==='Studying',chair=sitting?chairPose(chairSeat??i,deskTextures[0].height/deskTextures[0].width,stationPositions[chairSeat??i],stationMirrors[chairSeat??i]):undefined;
     const gait=net.enabled&&!sitting?remoteCycles[i]?.(base):undefined,worn=sitting?reading[i]:gait&&gait.frame>=0?(remoteStrides[i]?.[gait.frame]??standing[i]):standing[i];if(worn?.width)players[i].texture=worn;players[i].rotation=gait?.lean??0;players[i].anchor.set(chair?.anchorX??.5,chair?.anchorY??1);const width=net.enabled?(peer?.avatar?.style===1?88:72):i===2?88:72;players[i].width=width;players[i].height=width*(players[i].texture.height||1)/(players[i].texture.width||1);players[i].scale.x=(Math.abs(players[i].scale.x)||1)*facingSign(chair?.facing??peer?.facing);const footX=chair?.x??base.x,footY=chair?.y??base.y+4+(gait?.bob??0);if(Number.isFinite(footX)&&Number.isFinite(footY))players[i].position.set(footX,footY);players[i].zIndex=chair?.depth??(Number.isFinite(base.y)?base.y+6:500);players[i].visible=net.enabled?!!peer:state.online[i];players[i].alpha=1;if(peer){const hit=interactions.find(item=>item.id===`friend-${i}`);if(hit){hit.name=peer.name;hit.approaches=[{x:tile.x,y:tile.y}];}}
     const shape=friendShapes[i];if(shape){shape.x=players[i].x;shape.y=players[i].y-(sitting?22:28);}
    }
    if(net.enabled&&net.lease&&Number.isFinite(position.x)&&seconds-networkAt>=.2&&!networkBusy){
     const signature=`${net.lease.id}:${position.x.toFixed(3)}:${position.y.toFixed(3)}:${facing}:${state.localActivity}:${seatedStation??-1}`;
     if(signature!==networkSent){networkAt=seconds;networkBusy=true;const session=net.lease.id;const sample={session,geometryVersion:'moonlit-v2',layoutVersion:net.snapshot?.world.room_layout_version??0,x:position.x,y:position.y,facing,sequence:++networkSequence,activity:state.localActivity,seat:seatedStation??-1};
      void net.invoke('move',sample).then(()=>{if(handlers.current.backend.lease?.id===session)networkSent=signature;}).catch(e=>{
       if(handlers.current.backend.lease?.id!==session)return;
       const recovered=e instanceof BackendError?e.details?.position:undefined;
       if(recovered&&Number.isFinite(recovered.x)&&Number.isFinite(recovered.y)){position={x:recovered.x,y:recovered.y};route=[];pending=undefined;seatedStation=undefined;seated=false;marker.visible=false;reportPosition();}
       handlers.current.onHint(e instanceof BackendError?e.message:'Your movement is reconnecting. Please try that destination again.');
      }).finally(()=>{networkBusy=false;});
     }
    }
    const active=seconds-reactionStart<4,celebrate=active&&['happy','celebrating','evolving'].includes(state.reaction);
    const petPaused=net.enabled?false:roomInputBlocked()||hovered===petInteraction||selected===petInteraction||active;
    if(net.enabled&&net.snapshot&&!petPaused)sharedPet=sharedSproutlingAt(net.snapshot.world.id,sproutlingClock(Date.now()+net.snapshot.clockOffset,net.snapshot.world.pet_pause_total,net.snapshot.world.pet_pause_until));
    const roaming=net.enabled?{...sharedPet,moving:!petPaused&&sharedPet.moving}:wander(dt,petPaused);
    const petFloor=iso(roaming.position.x,roaming.position.y),petStride=petCycle(petFloor);
    petInteraction.approaches=[roaming.position];
    const petStage=state.energy>=100||active&&state.reaction==='watering'?1:0;petHitTexture=petTextures[petStage];pet.texture=petStride.frame>=0?petRuns[petStage][petStride.frame]:petTextures[petStage];pet.width=125;pet.height=125*petTextures[0].height/petTextures[0].width;pet.x=petFloor.x;pet.y=petFloor.y+petStride.bob+(motion?(celebrate?-Math.abs(Math.sin(seconds*7))*9:roaming.moving?0:Math.sin(seconds*2)*1.2):0);pet.rotation=petStride.frame>=0?petStride.lean:motion&&active&&state.reaction==='watering'?Math.sin(seconds*4)*.06:0;sleep.visible=state.reaction==='sleeping'&&active;pet.alpha=sleep.visible?.8:1;
    pet.scale.x=Math.abs(pet.scale.x)*roaming.facing;pet.zIndex=petFloor.y+6;if(displayed?.id==='pet'||petOutline.alpha>0)updatePetOutline();
    petShape.x=pet.x+5*roaming.facing;petShape.y=pet.y-32;sleep.position.set(pet.x+18,pet.y-75);
    garden.tint=active&&state.reaction==='evolving'?0xedffd2:0xffffff;
    // See-through canopy: fade the tree while the cursor is over it or a character is standing behind it. Visual only; the garden click target reads playerBehindTree.
    {// Cursor must be over the tree's actual silhouette, not just its bounding box.
     const over=!!pointer&&treeCovers(pointer);
     // Only the local character, and only where opaque tree pixels actually cover its body.
     const me=players[0],behind=me.zIndex<garden.zIndex&&[[0,.25],[0,.5],[0,.75],[-.2,.5],[.2,.5]].some(([dx,dy])=>treeCovers({x:me.x+dx*me.width,y:me.y-dy*me.height}));
     playerBehindTree=behind;
     const target=handlers.current.suspended?1:over||behind?.25:1;treeAlpha+=(target-treeAlpha)*Math.min(1,dt/.12);garden.alpha=treeAlpha;}
    // Frame-rate independent 150ms fade. Only one object owns hover/selected feedback.
    const wanted=roomInputBlocked()?undefined:hovered??selected;if(wanted!==displayed){highlightAlpha=Math.max(0,highlightAlpha-dt/.15);if(highlightAlpha===0){displayed=wanted;highlight.clear();contour.clear();if(displayed){const dest=displayed.instant?undefined:approachRoute(position,displayed.approaches,displayed.preferFirst)?.destination;
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
    cues.forEach(({item,g},i)=>{const near=item.approaches.some(a=>distance(position,a)<115),shape=item.shape;g.visible=!roomInputBlocked()&&!useInventory.getState().storedFixtures?.includes(`fixture:${item.id}`)&&(near||hovered===item||selected===item);g.alpha=(hovered===item||selected===item)?.8:motion?.22+Math.max(0,Math.sin(seconds*.7+i*2))*.25:.3;
     const x=shape.kind==='ellipse'?shape.x:shape.points[0]+30,y=shape.kind==='ellipse'?shape.y-shape.ry:shape.points[1];g.position.set(x,y-10+(motion?Math.sin(seconds*1.5+i)*1.5:0));
    });
    outlines.forEach((outline,id)=>{outline.alpha=displayed?.id===id?highlightAlpha:0;});
    const movingGarden=useItemDrag.getState().preview?.item.id==='fixture:garden';
    moonflower.visible=!movingGarden&&!gardenStored&&new Set(state.completions.map(c=>c.player)).size>=2;
    branches.forEach(({c,side})=>{c.visible=!movingGarden&&!gardenStored&&motion&&state.settings.graphics==='Full'&&stageFor(state.energy)>0;c.alpha=.7*treeAlpha;c.pivot.x=gp.x;c.scale.x=gardenMirrored?-1:1;c.x=gp.x+(motion?Math.sin(seconds*(side===1?.61:.43)+side)*1.3:0);c.y=motion?Math.sin(seconds*.37+side)*.45:0;});
    effects.update(seconds,dt,motion,state.settings.graphics==='Full',celebrate);
    stoveSmokes.forEach(smoke=>smoke.update(seconds));
   }catch(e){console.error(e);}});
   void warmStrides(state.avatar).catch(console.error);
   reportPosition();visibility=()=>{if(document.hidden)app.ticker.stop();else app.ticker.start();};document.addEventListener('visibilitychange',visibility);visibility();
  };
  run().catch(e=>{console.error(e);if(!disposed)setError(true);});
  return()=>{disposed=true;unsubscribe();unsubscribePlacements();unsubscribePreview();cleanupOccupants();cleanupPreviewInput();setPreviewAnchor(null);setMovementObstacles([]);observer?.disconnect();document.removeEventListener('visibilitychange',visibility);if(app.renderer){destroyEffects();app.destroy(true,{children:true,texture:false});}hoverTextures.forEach(texture=>texture.destroy(true));};
 },[]);
 return <div className="canvas-host reference-world" ref={host} role="application" aria-label="Interactive greenhouse. Click clear floor tiles to walk; use the navigation buttons to access every activity.">{error&&<div className="canvas-error">The world artwork couldn’t load. You can still use every lesson and garden control in the navigation.</div>}</div>;
}
