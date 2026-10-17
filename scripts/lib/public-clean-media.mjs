import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export const CLEAN_MEDIA_RECIPE='docs/contracts/championship/PUBLIC_CLEAN_MEDIA_SOURCES.v1.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function stripPngMetadata(bytes){
 const signature=Buffer.from([137,80,78,71,13,10,26,10]);if(!bytes.subarray(0,8).equals(signature))throw Error('PNG_SIGNATURE');
 const parts=[signature];let ended=false;
 for(let offset=8;offset<bytes.length;){if(offset+12>bytes.length)throw Error('PNG_CHUNK_TRUNCATED');const size=bytes.readUInt32BE(offset),end=offset+12+size,type=bytes.toString('ascii',offset+4,offset+8);if(end>bytes.length)throw Error('PNG_CHUNK_SIZE');if(!['tEXt','iTXt','zTXt','eXIf'].includes(type))parts.push(bytes.subarray(offset,end));offset=end;if(type==='IEND'){ended=true;if(offset!==bytes.length)throw Error('PNG_TRAILING_BYTES');}}
 if(!ended)throw Error('PNG_IEND');return Buffer.concat(parts);
}
export function publicCleanMedia({root,write=false}){
 const recipe=JSON.parse(fs.readFileSync(path.join(root,CLEAN_MEDIA_RECIPE),'utf8')),files=[];
 for(const row of recipe.files){const original=fs.readFileSync(path.join(root,row.sourcePath));if(sha(original)!==row.sourceSha256)throw Error('CLEAN_MEDIA_SOURCE_CHANGED_REVIEW_REQUIRED:'+row.sourcePath);const bytes=stripPngMetadata(original);if(sha(bytes)!==row.sha256)throw Error('CLEAN_MEDIA_RECIPE_CHANGED');const target=path.join(root,row.path);if(write){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}else if(!fs.readFileSync(target).equals(bytes))throw Error('CLEAN_MEDIA_EXPORT_REQUIRED');files.push({...row,bytesData:bytes});}
 return files;
}
