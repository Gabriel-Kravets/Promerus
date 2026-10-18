const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs/promises');

async function main() {
 const source=path.join(__dirname,'../public/assets/study-icons-source.png');
 const output=path.join(__dirname,'../public/assets/study-icons');
 await fs.mkdir(output,{recursive:true});
 const {width,height}=await sharp(source).metadata();
 const names=['science','history','math','english','python','spanish','stats','book'];
 for(let i=0;i<names.length;i++){
  const left=Math.round((i%4)*width/4),top=Math.round(Math.floor(i/4)*height/2);
  const right=Math.round(((i%4)+1)*width/4),bottom=Math.round((Math.floor(i/4)+1)*height/2);
  const cell=await sharp(source).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
  await sharp(cell).trim({threshold:10}).resize(60,60,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(output,`${names[i]}.png`));
 }
 console.log('Built eight 64px study sprites.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
