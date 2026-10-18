/** All geometry uses the original 1320 × 744 scene, independent of viewport size. */
export type XY={x:number;y:number};
export type Shape={kind:'polygon';points:number[]}|{kind:'ellipse';x:number;y:number;rx:number;ry:number};
export const floorShape:Shape={kind:'polygon',points:[660,240,1106,363,1140,389,1120,414,1024,462,672,584,512,568,248,448,430,345,428,333,412,303,487,265]};
export function contains(shape:Shape,p:XY):boolean {
 if(shape.kind==='ellipse')return ((p.x-shape.x)/shape.rx)**2+((p.y-shape.y)/shape.ry)**2<=1;
 let inside=false;const v=shape.points;
 for(let i=0,j=v.length-2;i<v.length;j=i,i+=2){const x=v[i],y=v[i+1],a=v[j],b=v[j+1];if((y>p.y)!==(b>p.y)&&p.x<(a-x)*(p.y-y)/(b-y)+x)inside=!inside;}
 return inside;
}
// The bottom-middle railing and its planter box are solid, so nobody walks onto the fence.
export const fenceFootprint:Shape={kind:'polygon',points:[360,487,400,503,450,522,505,540,560,536,620,542,655,564,685,575,750,552,820,527,820,640,360,640]};
// Ground bed in the garden atlas: below the trunk, excluding canopy and glow.
export const gardenFootprint:Shape={kind:'ellipse',x:660,y:410,rx:96,ry:44};
// The canopy is decorative. Only the stone bed/trunk area opens the garden panel.
export const gardenHotspot:Shape={kind:'ellipse',x:660,y:433,rx:104,ry:43};
// The rest of the base: the walk-blocking bed footprint plus the trunk column, so clicks there open the panel instead of walking.
export const gardenTrunk:Shape={kind:'ellipse',x:660,y:322,rx:30,ry:38};
export const inGardenBase=(p:XY)=>contains(gardenHotspot,p)||contains(gardenFootprint,p)||contains(gardenTrunk,p);
export const furnitureRegions=[
 {id:'library',name:'Bookshelf',action:'View Learning Journey',symbol:'▤',panel:'learn',shape:{kind:'polygon',points:[720,46,853,72,853,215,820,222,800,272,765,262,763,220,722,197]} as Shape,approaches:[{x:3,y:1.5},{x:3.5,y:1.5}]},
 {id:'board',name:'Quest Board',action:'View Group Goals',symbol:'✧',panel:'quests',shape:{kind:'polygon',points:[850,113,1002,165,1002,268,985,272,850,216]} as Shape,approaches:[{x:8,y:.5},{x:8.5,y:1}]},
 {id:'observatory',name:'Telescope',action:'Look at the Stars',symbol:'✧',panel:'observatory',shape:{kind:'polygon',points:[1066,476,1137,407,1149,415,1107,463,1130,523,1123,528,1098,480,1080,529,1073,526,1089,473,1073,484]} as Shape,approaches:[{x:11,y:4},{x:10.5,y:4.5}]},
 {id:'hearth',name:'Fireplace',action:'Take a Quiet Breath',symbol:'♧',panel:'hearth',shape:{kind:'polygon',points:[1130,280,1159,286,1165,314,1165,367,1155,382,1121,366,1124,320,1131,317]} as Shape,approaches:[{x:11.5,y:-.5},{x:11,y:-.5},{x:11.5,y:0}],lookAt:{x:1145,y:346},preferFirst:true},
 // The potted-plant shelf behind the lantern table, traced around its leaves and legs.
 {id:'plants',name:'Plant Shelf',action:'Discover What’s Growing',symbol:'❧',panel:'plants',shape:{kind:'polygon',points:[632,148,634,134,638,122,648,118,655,114,672,116,684,124,693,121,700,128,714,134,712,148,708,158,709,174,697,180,696,223,686,224,655,215,652,180,632,160]} as Shape,approaches:[{x:2,y:2},{x:1.5,y:2}]},
 {id:'entrance',name:'Sproutbound Sign',action:'Welcome Home',symbol:'❧',panel:'entrance',shape:{kind:'polygon',points:[96,355,150,360,203,407,204,481,105,440]} as Shape,approaches:[{x:2,y:11},{x:2.5,y:11.5}]}
];
export function pickInteraction<T extends {contains:(p:XY)=>boolean;priority:number}>(items:T[],point:XY):T|undefined {
 return items.filter(item=>item.contains(point)).sort((a,b)=>b.priority-a.priority)[0];
}
