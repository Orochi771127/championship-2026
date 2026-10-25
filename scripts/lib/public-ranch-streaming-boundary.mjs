import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PUBLIC_CHARACTER_RENDER_KIND} from '../../src/championship/presentation/publicCharacterRenderContract.js';

export const RANCH_STREAMING_SELECTION='src/data/championship/ranch-render-selection.v1.json';
// A dynamic descriptor URL must be selected too. A closed module graph alone
// cannot prove that the next resident will have its metadata in the artifact.
export function assertPublicRanchStreaming({root,files,allowlist,assertBytes}){
 if(!files.includes(RANCH_STREAMING_SELECTION))return {required:false};
 const selection=JSON.parse(fs.readFileSync(path.join(root,RANCH_STREAMING_SELECTION),'utf8'));
 if(selection?.schemaVersion!==1||!Array.isArray(selection.characters))throw Error('PUBLIC_RANCH_SELECTION_SCHEMA');
 const rows=new Map(allowlist.files.map(row=>[row.path,row])),ids=new Set(),available=new Set(files);
 for(const character of selection.characters){
  const file=character.runtimePath,row=rows.get(file);
  if(typeof character.entityId!=='string'||ids.has(character.entityId)||typeof file!=='string'
    ||!file.startsWith('assets/production/characters/')||file.includes('\\')||file.split('/').some(x=>!x||x==='.'||x==='..')
    ||!available.has(file)||!row||row.sha256!==character.runtimeSha256)
   throw Error('PUBLIC_RANCH_RUNTIME_NOT_SELECTED: '+character.entityId);
  ids.add(character.entityId);
  const bytes=fs.readFileSync(path.join(root,file));
  if(createHash('sha256').update(bytes).digest('hex')!==character.runtimeSha256)throw Error('PUBLIC_RANCH_RUNTIME_HASH: '+character.entityId);
  assertBytes(file,bytes,{jsonFields:row.jsonFields});
  const runtime=JSON.parse(bytes),meta=runtime.streaming;
  if(runtime.kind!==PUBLIC_CHARACTER_RENDER_KIND||runtime.entityId!==character.entityId||meta?.side!=='main'
    ||meta.sourceRuntimeSha256!==character.sourceRuntimeSha256||meta.sourceImageSha256!==character.sourceImageSha256
    ||!Array.isArray(meta.pages)||!Array.isArray(runtime.sides?.main?.atlases)
    ||meta.pages.length!==runtime.sides.main.atlases.length||runtime.sides?.sub?.atlases?.length!==0)
    throw Error('PUBLIC_RANCH_RENDER_SCHEMA: '+character.entityId);
  for(const [i,page]of meta.pages.entries())for(const [field,hashField,extension]of [['data','dataSha256','json'],['image','imageSha256','webp']]){
    if(!page[field].endsWith('.'+extension)||page[field].includes('://')||page[field].startsWith('/')||runtime.sides.main.atlases[i][field]!==page[field])
      throw Error('PUBLIC_RANCH_PAGE_PATH: '+character.entityId);
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),page[field]));
    if(!available.has(target)||rows.get(target)?.sha256!==page[hashField])throw Error('PUBLIC_RANCH_PAGE_NOT_SELECTED: '+target);
  }
 }
 return {required:true,characters:ids.size};
}
