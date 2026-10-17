export const treeCenter={x:5.5,y:5.5};
/** Fixed mirrored pairs: exactly two tables on each screen side of the tree. */
const offsets=[{x:-4,y:1},{x:1,y:-4},{x:-2.5,y:4.5},{x:4.5,y:-2.5}];
export const studyStations=offsets.map((offset,index)=>{
 const position={x:treeCenter.x+offset.x,y:treeCenter.y+offset.y};
 return {id:`desk-${index}`,label:`${index%2?'Right':'Left'} ${index<2?'rear':'front'} study desk`,position,
  seat:{x:position.x+1,y:position.y+1},alternatives:[{x:position.x+1.5,y:position.y+1}],atlasColumn:index%2,width:178,
  chair:{x:index%2?.32:.68,y:.68}};
});
export const desks=studyStations.map(station=>station.position);
export const approaches=studyStations.map(station=>station.seat);
export const gardenApproaches=[{x:4,y:8},{x:8,y:4},{x:8.5,y:4},{x:6,y:9.5}];
export const gardenApproach=gardenApproaches[0];
/** Simplified visible contours, in scene pixels relative to each desk's floor origin. */
export function deskOutline(index:number){const station=studyStations[index],mirror=station.atlasColumn===1?-1:1;
 const points=[-64,-59,-54,-86,-32,-91,-16,-87,19,-85,36,-73,40,-58,58,-56,70,-39,69,-30,58,-20,56,13,46,21,46,29,32,32,14,21,-24,21,-40,18,-48,-6,-62,-22];
 return points.map((value,i)=>i%2?value:value*mirror);
}
