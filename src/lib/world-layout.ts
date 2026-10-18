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
