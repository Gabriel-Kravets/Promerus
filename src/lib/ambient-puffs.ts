import {Container,Graphics} from 'pixi.js';

export type PuffStyle={count:number;color:number;alpha:number;size:number;growth:number;life:number;rise:number;drift:number;sway:number;spread:number};

/** Smoke from the wood-stove pipe: grey, larger, leaves the elbow sideways then rises. */
export const stoveSmoke:PuffStyle={count:22,color:0xd2ccc4,alpha:.75,size:6,growth:18,life:5.5,rise:24,drift:20,sway:9,spread:3.5};
/** A faint wisp of steam over a teapot. */
export const teaSteam:PuffStyle={count:7,color:0xffffff,alpha:.75,size:1.6,growth:2.6,life:2.4,rise:8,drift:0,sway:2,spread:1.2};

/** A small looping puff emitter positioned at its own origin. Purely visual. */
export function createPuffs(style:PuffStyle,phase=0){
 const root=new Container();root.eventMode='none';root.interactiveChildren=false;
 // Each puff is a unit disc with a soft falloff; scale sets its radius in scene pixels.
 const puffs=Array.from({length:style.count},(_,i)=>{const g=new Graphics().circle(0,0,1).fill({color:style.color,alpha:.35}).circle(0,0,.7).fill({color:style.color,alpha:.5}).circle(0,0,.4).fill({color:style.color,alpha:.7});root.addChild(g);return {g,offset:i/style.count*style.life,seed:phase+i*2.17};});
 const place=(time:number)=>puffs.forEach(p=>{
  const age=((time+p.offset)%style.life)/style.life;
  p.g.position.set(style.drift*Math.sqrt(age)+Math.sin(time*1.3+p.seed)*style.sway*age+Math.sin(p.seed*3.1)*style.spread,-style.rise*age*style.life);
  p.g.scale.set(style.size+style.growth*age);
  p.g.alpha=style.alpha*Math.sin(Math.min(1,age*1.25)*Math.PI)*(1-age*.4);
 });
 place(0);
 return {
  root,
  // Always animated: the drift is slow and small, and a frozen puff reads as a smudge.
  update(time:number){place(time);}
 };
}
