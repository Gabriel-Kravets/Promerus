type Position={x:number;y:number};
/** Observe actual scene-coordinate changes, not merely a pending destination. */
export function createWalkCycle(initial:Position){
 let previous={...initial},phase=0;
 return (position:Position,motion=true)=>{
  const travelled=Math.hypot(position.x-previous.x,position.y-previous.y);previous={...position};
  if(!motion||travelled<.01){phase=0;return {frame:-1,bob:0,lean:0};}
  phase=(phase+travelled/42) % 1;
  return {frame:Math.floor(phase*4),bob:-Math.abs(Math.sin(phase*Math.PI*2))*2.5,lean:Math.sin(phase*Math.PI*2)*.035};
 };
}
