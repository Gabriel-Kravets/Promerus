import {iso} from './movement';
import {studyStations} from './world-layout';

/** Align the reading sprite's hips with the cushion, independently of the floor approach. */
export function chairPose(index:number,deskAspect=561/701){
  const station=studyStations[index],origin=iso(station.position.x,station.position.y);
  return {x:origin.x+(station.chair.x-.5)*station.width,
    y:origin.y+36-(1-station.chair.y)*station.width*deskAspect,
    anchorX:.5,anchorY:.74,facing:station.atlasColumn===0?1:-1,depth:origin.y+2};
}
