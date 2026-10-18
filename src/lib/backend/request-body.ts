export class PayloadTooLarge extends Error{}
export async function readJsonBody(request:Request,limit=16384):Promise<unknown>{
 if(!request.body)throw new Error('A JSON body is required');
 const reader=request.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw new PayloadTooLarge('Request is too large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}finally{reader.releaseLock();}
}
