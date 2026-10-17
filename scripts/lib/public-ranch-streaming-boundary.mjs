import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const RANCH_STREAMING_SELECTION='src/data/championship/ranch-streaming-selection.r1.json';
// A dynamic descriptor URL must be selected too. A closed module graph alone
// cannot prove that the next resident will have its metadata in the artifact.
export function assertPublicRanchStreaming({root,files,allowlist,assertBytes}){
 if(!files.includes(RANCH_STREAMING_SELECTION))return {required:false};
 const selection=JSON.parse(fs.readFileSync(path.join(root,RANCH_STREAMING_SELECTION),'utf8'));
 if(selection?.schemaVersion!==1||!Array.isArray(selection.characters))throw Error('PUBLIC_RANCH_SELECTION_SCHEMA');
 const rows=new Map(allowlist.files.map(row=>[row.path,row])),ids=new Set();
 for(const character of selection.characters){
  const file=character.runtimePath,row=rows.get(file);
  if(typeof character.entityId!=='string'||ids.has(character.entityId)||typeof file!=='string'
    ||!file.startsWith('assets/production/characters/')||file.includes('\\')||file.split('/').some(x=>!x||x==='.'||x==='..')
    ||!files.includes(file)||!row||row.sha256!==character.runtimeSha256)
   throw Error('PUBLIC_RANCH_RUNTIME_NOT_SELECTED: '+character.entityId);
  ids.add(character.entityId);
  const bytes=fs.readFileSync(path.join(root,file));
  if(createHash('sha256').update(bytes).digest('hex')!==character.runtimeSha256)throw Error('PUBLIC_RANCH_RUNTIME_HASH: '+character.entityId);
  assertBytes(file,bytes,{jsonFields:row.jsonFields});
 }
 return {required:true,characters:ids.size};
}
