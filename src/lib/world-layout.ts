/** Original atlas cells and 178px render size are preserved. All station geometry follows position. */
export const studyStations=[
 {id:'desk-0',label:'Left study nook',position:{x:.5,y:6.5},seat:{x:1.5,y:7.5},alternatives:[{x:2,y:7.5}],atlasColumn:0,width:178},
 {id:'desk-1',label:'Rear window desk',position:{x:6.5,y:1},seat:{x:7.5,y:2},alternatives:[{x:7.5,y:2.5}],atlasColumn:1,width:178},
 {id:'desk-2',label:'Fireplace study corner',position:{x:10,y:0},seat:{x:11,y:1},alternatives:[{x:11,y:1.5}],atlasColumn:0,width:178},
 {id:'desk-3',label:'Front-right study desk',position:{x:10,y:5},seat:{x:10.5,y:5.5},alternatives:[{x:11,y:5}],atlasColumn:1,width:178}
];
export const desks=studyStations.map(station=>station.position);
export const approaches=studyStations.map(station=>station.seat);
export const gardenApproaches=[{x:4,y:8},{x:8,y:4},{x:8.5,y:4},{x:6,y:9.5}];
export const gardenApproach=gardenApproaches[0];
/** Simplified visible contours, in scene pixels relative to each desk's floor origin. */
export function deskOutline(index:number){const station=studyStations[index],mirror=station.atlasColumn===1?-1:1;
 const points=[-64,-59,-54,-86,-32,-91,-16,-87,19,-85,36,-73,40,-58,58,-56,70,-39,69,-30,58,-20,56,13,46,21,46,29,32,32,14,21,-24,21,-40,18,-48,-6,-62,-22];
 return points.map((value,i)=>i%2?value:value*mirror);
}
