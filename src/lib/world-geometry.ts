/** All geometry uses the original 1320 × 744 scene, independent of viewport size. */
export type XY={x:number;y:number};
export type Shape={kind:'polygon';points:number[]}|{kind:'ellipse';x:number;y:number;rx:number;ry:number};
export const floorShape:Shape={kind:'polygon',points:[660,240,1106,363,1140,389,1120,414,672,570,251,438,430,345]};
export function contains(shape:Shape,p:XY):boolean {
 if(shape.kind==='ellipse')return ((p.x-shape.x)/shape.rx)**2+((p.y-shape.y)/shape.ry)**2<=1;
 let inside=false;const v=shape.points;
 for(let i=0,j=v.length-2;i<v.length;j=i,i+=2){const x=v[i],y=v[i+1],a=v[j],b=v[j+1];if((y>p.y)!==(b>p.y)&&p.x<(a-x)*(p.y-y)/(b-y)+x)inside=!inside;}
 return inside;
}
export const gardenFootprint:Shape={kind:'ellipse',x:660,y:438,rx:108,ry:45};
// The canopy is decorative. Only the stone bed/trunk area opens the garden panel.
export const gardenHotspot:Shape={kind:'ellipse',x:660,y:433,rx:104,ry:43};
export const furnitureRegions=[
 {id:'library',name:'Bookshelf',action:'View Learning Journey',symbol:'▤',panel:'learn',shape:{kind:'polygon',points:[692,83,817,115,815,262,772,254,770,222,692,204]} as Shape,approaches:[{x:3,y:1.5},{x:3.5,y:1.5}]},
 {id:'board',name:'Quest Board',action:'View Group Goals',symbol:'✧',panel:'friends',shape:{kind:'polygon',points:[854,145,996,202,995,282,854,226]} as Shape,approaches:[{x:8,y:.5},{x:8.5,y:1}]},
 {id:'observatory',name:'Telescope',action:'Look at the Stars',symbol:'✧',panel:'observatory',shape:{kind:'polygon',points:[1066,476,1137,407,1149,415,1107,463,1130,523,1123,528,1098,480,1080,529,1073,526,1089,473,1073,484]} as Shape,approaches:[{x:11,y:4},{x:10.5,y:3.5}]},
 {id:'hearth',name:'Fireplace',action:'Take a Quiet Breath',symbol:'♧',panel:'hearth',shape:{kind:'polygon',points:[1130,280,1159,286,1165,314,1165,367,1155,382,1121,366,1124,320,1131,317]} as Shape,approaches:[{x:11.5,y:-.5},{x:11,y:-.5},{x:11.5,y:0}],lookAt:{x:1145,y:346},preferFirst:true},
 {id:'plants',name:'Plant Shelf',action:'Discover What’s Growing',symbol:'❧',panel:'plants',shape:{kind:'polygon',points:[546,175,615,183,628,217,584,244,546,225]} as Shape,approaches:[{x:1.5,y:3.5},{x:2,y:4}]},
 {id:'entrance',name:'Sproutbound Sign',action:'Welcome Home',symbol:'❧',panel:'entrance',shape:{kind:'polygon',points:[96,355,150,360,203,407,204,481,105,440]} as Shape,approaches:[{x:2,y:10.5},{x:2.5,y:11}]}
];
export function pickInteraction<T extends {contains:(p:XY)=>boolean;priority:number}>(items:T[],point:XY):T|undefined {
 return items.filter(item=>item.contains(point)).sort((a,b)=>b.priority-a.priority)[0];
}
