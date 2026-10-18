import {getItemDefinition,type InventoryItem} from './items';
import {distance,iso,type Point} from './movement';
import {ellipsePolygon,footprintIntersects,itemFootprint,polygonInside} from './placement';
import {floorShape,type Shape} from './world-geometry';

export type PlacementOccupant={id:string;position:Point;rx:number;ry:number};
export type OccupantNudge={id:string;position:Point};
export const MAX_PLACEMENT_NUDGE=96;
export const occupantShape=(occupant:PlacementOccupant):Extract<Shape,{kind:'ellipse'}>=>({kind:'ellipse',...iso(occupant.position.x,occupant.position.y),rx:occupant.rx,ry:occupant.ry});

/** Plan every relocation before saving the furniture or moving any occupant. */
export function planPlacementNudges(item:InventoryItem,position:Point,occupants:readonly PlacementOccupant[],obstacles:readonly Shape[]):OccupantNudge[]|null {
  if(!getItemDefinition(item.type,item.theme).solid)return [];
  const target=itemFootprint(item,position),current=occupants.map(o=>({...o,position:{...o.position}})),moves:OccupantNudge[]=[];
  for(let index=0;index<current.length;index++){
    const actor=current[index];if(!footprintIntersects(target,occupantShape(actor)))continue;
    const otherShapes=current.filter((_,i)=>i!==index).map(occupantShape);
    const clear=(point:Point)=>{
      const body=ellipsePolygon(occupantShape({...actor,position:point}));
      return polygonInside(floorShape as Extract<Shape,{kind:'polygon'}>,body)&&![...obstacles,...otherShapes].some(shape=>footprintIntersects(body,shape));
    };
    const candidates:Point[]=[];
    for(let dx=-3;dx<=3;dx+=.5)for(let dy=-3;dy<=3;dy+=.5){
      const candidate={x:actor.position.x+dx,y:actor.position.y+dy},d=distance(actor.position,candidate);
      if(d>0&&d<=MAX_PLACEMENT_NUDGE)candidates.push(candidate);
    }
    candidates.sort((a,b)=>distance(actor.position,a)-distance(actor.position,b));
    const destination=candidates.find(candidate=>{
      if(footprintIntersects(target,occupantShape({...actor,position:candidate}))||!clear(candidate))return false;
      // Check the short step aside against existing furniture, walls and people.
      // The preview itself has not been placed yet, so actors can step out of it.
      const steps=Math.ceil(distance(actor.position,candidate)/4);
      for(let i=1;i<=steps;i++)if(!clear({x:actor.position.x+(candidate.x-actor.position.x)*i/steps,y:actor.position.y+(candidate.y-actor.position.y)*i/steps}))return false;
      return true;
    });
    if(!destination)return null;
    actor.position=destination;moves.push({id:actor.id,position:{...destination}});
  }
  return moves;
}
