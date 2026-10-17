export type Point={x:number;y:number};
export const iso=(x:number,y:number):Point=>({x:660+(x-y)*36,y:200+(x+y)*18});
export const uniso=(x:number,y:number):Point=>({x:((x-660)/36+(y-200)/18)/2,y:((y-200)/18-(x-660)/36)/2});
export const blocked=(x:number,y:number)=> x<0||y<0||x>11||y>11||(x>=4&&x<=7&&y>=4&&y<=7)||[[1,6],[9,1],[4,10],[10,6]].some(([a,b])=>x===a&&y===b);
export function pathfind(start:Point,end:Point):Point[]{
 const s={x:Math.round(start.x),y:Math.round(start.y)},e={x:Math.round(end.x),y:Math.round(end.y)};
 if(blocked(e.x,e.y))return []; const key=(p:Point)=>`${p.x},${p.y}`;const queue=[s],prev=new Map<string,Point|null>([[key(s),null]]);
 while(queue.length){const p=queue.shift()!;if(key(p)===key(e)){const result:Point[]=[];let cur:Point|null=p;while(cur&&key(cur)!==key(s)){result.unshift(cur);cur=prev.get(key(cur))??null;}return result;}
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(!blocked(n.x,n.y)&&!prev.has(key(n))){prev.set(key(n),p);queue.push(n);}}}return [];
}
export const stageFor=(energy:number)=>energy>=300?3:energy>=180?2:energy>=100?1:0;
export const stages=['Seed','Sprout','Bloom','Sanctuary'];
