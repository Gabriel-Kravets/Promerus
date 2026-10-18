import {RUN_FRAME_COUNT} from './sprite-locomotion';
type Position={x:number;y:number};
/** Locomotion always animates actual movement, independently of ambient preferences; system reduced motion can suppress the gait. */
export function createWalkCycle(initial:Position){
 let previous={...initial},phase=0;
 return (position:Position,animate=true)=>{
  const travelled=Math.hypot(position.x-previous.x,position.y-previous.y);previous={...position};
  if(!animate||travelled<.01){phase=0;return {frame:-1,bob:0,lean:0};}
  phase=(phase+travelled/42) % 1;
  return {frame:Math.floor(phase*RUN_FRAME_COUNT),bob:-Math.abs(Math.sin(phase*Math.PI*2))*1.5,lean:Math.sin(phase*Math.PI*2)*.02};
 };
}
