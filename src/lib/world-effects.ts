import {Container,Graphics,Rectangle,Sprite,Texture} from 'pixi.js';
import {contains,Shape} from './world-geometry';

/** A bounded, pooled effect layer. Called from the world's existing Pixi ticker. */
export function createWorldEffects(scene:Container,room:Texture){
 const layer=new Container();layer.eventMode='none';layer.interactiveChildren=false;scene.addChild(layer);
 const owned:Texture[]=[];
 // Trace only exposed water; the platform, steps, pillars and boat are excluded.
 const waterShapes:Shape[]=[
  {kind:'polygon',points:[0,520,48,542,47,607,147,638,147,654,288,704,327,744,0,744]},
  {kind:'polygon',points:[697,722,905,631,932,664,964,700,1100,744,697,744]},
  {kind:'polygon',points:[1190,710,1320,665,1320,744,1190,744]},
  {kind:'polygon',points:[0,610,75,624,69,642,0,635]}
 ];
 const water=new Container();water.eventMode='none';layer.addChild(water);
 const waterMask=new Graphics();waterShapes.forEach(s=>{if(s.kind==='polygon')waterMask.poly(s.points).fill(0xffffff);});layer.addChild(waterMask);water.mask=waterMask;
 const waterCopy=new Sprite(room);waterCopy.width=1320;waterCopy.height=744;waterCopy.alpha=.38;water.addChild(waterCopy);
 const waveBands=Array.from({length:21},(_,i)=>{const g=new Graphics().moveTo(-12,0).lineTo(-3,-1).lineTo(7,-1).lineTo(15,0).stroke({color:i%3?0x94c7bb:0xffd990,width:1,alpha:.4});water.addChild(g);return g;});
 const ripples=Array.from({length:8},()=>{const g=new Graphics().ellipse(0,0,13,3).stroke({color:0xc1ddd0,width:1,alpha:.4});water.addChild(g);return g;});
 const lights=[[649,75,40,0xffc765],[31,325,30,0xffc765],[1025,510,37,0xffcf78],[369,665,31,0xffc765],[1100,178,32,0xffcd79],[1081,690,26,0xffc76b],[586,194,30,0xffce85],[1148,342,44,0xff9e46],[775,38,23,0x84edee],[660,421,112,0xb2ee83]].map(([x,y,r,color],i)=>{
  const g=new Graphics();for(let n=5;n>0;n--)g.ellipse(0,0,r*n/5,r*n/5*(i===9?.45:1)).fill({color,alpha:.018});g.blendMode='add';g.position.set(x,y);layer.addChild(g);return g;
 });
 // Cropped leaf-only contours retain the original texture and palette. Anchors stay on stems.
 const foliage=[
  {x:343,y:130,w:69,h:110,points:[13,0,43,1,62,29,64,70,40,108,27,84,7,49],phase:.3,amp:.014},
  {x:908,y:74,w:60,h:65,points:[22,0,42,7,58,24,53,52,30,64,8,50,0,21],phase:2.4,amp:.022},
  {x:984,y:107,w:63,h:83,points:[24,0,44,5,62,33,45,72,24,82,4,58,0,28],phase:4.1,amp:.016},
  {x:405,y:221,w:58,h:57,points:[7,3,36,0,54,15,45,37,26,53,9,48,0,22],phase:1.7,amp:.019},
  {x:800,y:217,w:58,h:51,points:[25,0,35,8,56,12,45,30,30,47,13,40,0,16],phase:5.3,amp:.017}
 ].map(item=>{
  const crop=new Texture({source:room.source,frame:new Rectangle(item.x*room.width/1320,item.y*room.height/744,item.w*room.width/1320,item.h*room.height/744)});owned.push(crop);
  const c=new Container();c.position.set(item.x+item.w/2,item.y);const sprite=new Sprite(crop);sprite.width=item.w;sprite.height=item.h;sprite.x=-item.w/2;c.addChild(sprite);
  const mask=new Graphics().poly(item.points.map((v,i)=>i%2?v:v-item.w/2)).fill(0xffffff);c.addChild(mask);sprite.mask=mask;layer.addChild(c);return {c,...item};
 });
 const flames=new Container();flames.position.set(1148,345);layer.addChild(flames);
 const flameShapes=Array.from({length:4},(_,i)=>{const g=new Graphics().poly([-4,0,-5,-6,-2,-10,0,-18,3,-11,5,-5,4,0]).fill(i%2?0xffe68b:0xffa742);g.x=(i-1.5)*3;flames.addChild(g);return g;});
 let seed=4231;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const waterPoint=()=>{for(let n=0;n<100;n++){const p={x:random()*1320,y:605+random()*139};if(waterShapes.some(s=>contains(s,p)))return p;}return {x:20,y:680};};
 const rippleSeeds=ripples.map(()=>({...waterPoint(),offset:random()*7,life:4+random()*4}));
 const waves=waveBands.map(()=>({...waterPoint(),phase:random()*6.28}));
 type Particle={g:Graphics;kind:number;life:number;age:number;x:number;y:number;vx:number;vy:number};
 const particles:Particle[]=Array.from({length:48},(_,i)=>{const kind=i<18?0:i<30?1:i<36?2:i<40?3:4;const g=new Graphics();
  if(kind===3)g.poly([0,-3,3,0,0,3,-2,0]).fill(0xb3c580);else g.rect(-1,-1,i%6===0?2:1,i%6===0?2:1).fill(kind===2?0xffca76:kind===0||kind===4?0xc5ed9b:0xebdab0);
  g.blendMode=kind===3?'normal':'add';layer.addChild(g);return {g,kind,life:2+random()*8,age:random()*9,x:0,y:0,vx:0,vy:0};
 });
 const reset=(p:Particle,burst=false)=>{p.life=3+random()*6;p.age=0;
  if(p.kind===0){p.x=560+random()*200;p.y=400+random()*60;p.vx=(random()-.5)*7;p.vy=-4-random()*7;}
  else if(p.kind===1){p.x=230+random()*860;p.y=230+random()*260;p.vx=2+random()*3;p.vy=-1-random()*3;}
  else if(p.kind===2){p.x=1144+random()*9;p.y=337;p.vx=(random()-.5)*5;p.vy=-6-random()*7;p.life=2+random()*2;}
  else if(p.kind===3){p.x=350+random()*600;p.y=140+random()*70;p.vx=6+random()*6;p.vy=9+random()*6;p.life=9+random()*4;}
  else {p.x=420+random()*450;p.y=280+random()*220;p.vx=(660-p.x)/2;p.vy=(426-p.y)/2;p.life=2;p.g.visible=burst;}
 };
 particles.forEach(p=>{reset(p);p.age=random()*p.life;});
 let milestone=-100,lastReaction=false;
 return {
  update(time:number,dt:number,motion:boolean,full:boolean,achievement:boolean){
   if(achievement&&!lastReaction){milestone=time;particles.filter(p=>p.kind===4).forEach(p=>reset(p,true));}lastReaction=achievement;
   layer.visible=true;waterCopy.x=motion?Math.sin(time*.47)*1.7:0;waterCopy.y=motion?Math.sin(time*.31)*.65:0;waterCopy.alpha=motion?.32+Math.sin(time*.37)*.045:.28;
   waveBands.forEach((g,i)=>{const p=waves[i];g.visible=full;g.position.set(p.x+(motion?Math.sin(time*.25+p.phase)*5:0),p.y);g.alpha=motion?.17+(Math.sin(time*.6+p.phase)+1)*.16:.2;});
   ripples.forEach((g,i)=>{const p=rippleSeeds[i],phase=motion?((time+p.offset)%p.life)/p.life:.5;g.visible=full&&i< (motion?8:3);g.position.set(p.x,p.y);g.scale.set(.3+phase*1.8);g.alpha=Math.sin(phase*Math.PI)*.4;});
   lights.forEach((g,i)=>{const organic=Math.sin(time*(1.1+i*.137)+i*2.3)*.055+Math.sin(time*(2.7+i*.12)+i)*.025;g.alpha=motion&&full?.91+organic:.91;if(motion&&i===9&&time-milestone<2)g.alpha+=Math.sin((time-milestone)/2*Math.PI)*.7;});
   foliage.forEach(p=>{p.c.rotation=motion&&full?Math.sin(time*(.43+p.phase*.06)+p.phase)*p.amp:0;p.c.alpha=motion&&full?.72:0;});
   flameShapes.forEach((g,i)=>{g.scale.y=motion?.8+Math.sin(time*(3.1+i*.7)+i)*.12: .9;g.x=(i-1.5)*3+(motion?Math.sin(time*2.3+i)*.8:0);g.alpha=motion?.68+Math.sin(time*2+i)*.09:.7;});
   particles.forEach(p=>{p.g.visible=full&&motion&&(p.kind!==4||time-milestone<2);if(!p.g.visible)return;p.age+=dt;if(p.age>=p.life)reset(p,p.kind===4&&time-milestone<2);
    p.g.position.set(p.x+p.vx*p.age+(p.kind===3?Math.sin(time+p.x)*3:Math.sin(time*.4+p.x)*2),p.y+p.vy*p.age);p.g.alpha=Math.sin(Math.min(1,p.age/p.life)*Math.PI)*(p.kind===3?.55:.65);if(p.kind===3)p.g.rotation=Math.sin(time*.7+p.x)*.4;
   });
  },
  destroy(){layer.destroy({children:true});owned.forEach(t=>t.destroy(false));}
 };
}
