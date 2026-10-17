import type {Shape} from './world-geometry';
export function objectTooltipPosition(shape:Shape,width:number,height:number){
  const xs=shape.kind==='ellipse'?[shape.x-shape.rx,shape.x+shape.rx]:shape.points.filter((_,i)=>i%2===0);
  const top=shape.kind==='ellipse'?shape.y-shape.ry:Math.min(...shape.points.filter((_,i)=>i%2===1));
  const center=(Math.min(...xs)+Math.max(...xs))/2;
  return {x:Math.max(width/2+8,Math.min(1320-width/2-8,center)),y:Math.max(height/2+8,top-height/2-12)};
}
