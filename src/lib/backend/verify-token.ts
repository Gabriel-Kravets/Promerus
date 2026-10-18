import {jwtVerify,type JWTVerifyGetKey,type CryptoKey} from 'jose';
export async function verifyPlayerToken(token:string,issuer:string,audience:string,key:JWTVerifyGetKey|CryptoKey|Uint8Array){
 const {payload}=await jwtVerify(token,key as JWTVerifyGetKey,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','exp','iat']});
 if(payload.role!=='authenticated'||!payload.sub||payload.sub.length>256)throw new Error('Invalid player identity');
 return {issuer:payload.iss!,subject:payload.sub};
}
