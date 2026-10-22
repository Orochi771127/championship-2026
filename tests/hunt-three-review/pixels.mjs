// Dependency-free PNG RGBA/RGB decoder for actual displayed-canvas captures.
// Reject unsupported formats rather than treating missing pixels as proof.
import {inflateSync} from 'node:zlib';import assert from 'node:assert/strict';
const paeth=(a,b,c)=>{const p=a+b-c,A=Math.abs(p-a),B=Math.abs(p-b),C=Math.abs(p-c);return A<=B&&A<=C?a:B<=C?b:c;};
export function decodePNG(input){
 const b=Buffer.isBuffer(input)?input:Buffer.from(input.replace(/^data:image\/png;base64,/,''),'base64');assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG_SIGNATURE');
 let w,h,channels,parts=[],ended=false;for(let p=8;p<b.length;){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);assert(p+12+n<=b.length,'PNG_CHUNK_BOUNDS');const d=b.subarray(p+8,p+8+n);if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);assert(w>0&&h>0&&w*h<=16000000,'PNG_PIXEL_BUDGET');assert(d[8]===8&&[2,6].includes(d[9])&&d[10]===0&&d[11]===0&&d[12]===0,'PNG_FORMAT');channels=d[9]===6?4:3;}else if(type==='IDAT')parts.push(d);else if(type==='IEND'){ended=true;break;}p+=12+n;}
 assert(ended&&channels,'PNG_COMPLETE');const stride=w*channels,raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*h});assert.equal(raw.length,(stride+1)*h);const out=Buffer.alloc(w*h*4),previous=Buffer.alloc(stride);let q=0;
 for(let y=0;y<h;y++){const filter=raw[q++];assert(filter<=4,'PNG_FILTER');const row=Buffer.alloc(stride);for(let x=0;x<stride;x++){const left=x>=channels?row[x-channels]:0,up=previous[x],ul=x>=channels?previous[x-channels]:0;row[x]=(raw[q++]+[0,left,up,Math.floor((left+up)/2),paeth(left,up,ul)][filter])&255;}for(let x=0;x<w;x++){for(let c=0;c<3;c++)out[(y*w+x)*4+c]=row[x*channels+c];out[(y*w+x)*4+3]=channels===4?row[x*channels+3]:255;}row.copy(previous);}
 return {width:w,height:h,data:out};
}
export function difference(a,b,{rect=null,tolerance=2,mask=null}={}){
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);const selected=new Uint8Array(a.width*a.height);let changed=0,total=0,max=0,sum=0;
 const r=rect??{x:0,y:0,width:a.width,height:a.height};for(let y=Math.max(0,Math.floor(r.y));y<Math.min(a.height,Math.ceil(r.y+r.height));y++)for(let x=Math.max(0,Math.floor(r.x));x<Math.min(a.width,Math.ceil(r.x+r.width));x++){const p=y*a.width+x;if(mask&&!mask[p])continue;total++;let d=0;for(let c=0;c<4;c++)d=Math.max(d,Math.abs(a.data[p*4+c]-b.data[p*4+c]));max=Math.max(max,d);sum+=d;if(d>tolerance){selected[p]=1;changed++;}}
 return {pixels:total,changed,max,mean:total?sum/total:0,mask:selected};
}
export const scalarDifference=r=>({pixels:r.pixels,changed:r.changed,max:r.max,mean:r.mean});
