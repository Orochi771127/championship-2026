import {growthAuthoredSelection} from './lib/growth-authored-selection.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {publicRanchRenderProjection} from './lib/public-ranch-render-projection.mjs';
import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceSelection=read('src/data/championship/ranch-streaming-selection.r1.json');
const publicSelectionPath='src/data/championship/ranch-render-selection.v1.json';
const fields=value=>{const keys=new Set();const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const [key,item]of Object.entries(v)){keys.add(key);visit(item);}};visit(value);return [...keys].sort();};
const write=(file,value)=>{const bytes=Buffer.from(JSON.stringify(value)+'\n');assertPublicBytes(file,bytes,{jsonFields:fields(value)});fs.writeFileSync(path.join(root,file),bytes);return hash(bytes);};
const characters=[];
for(const row of sourceSelection.characters){
  if(!/^assets\/production\/characters\/accepted-20261010\/[^/]+\/ranch-streaming-v1\/[a-f0-9]{16}\/runtime\.review\.json$/.test(row.runtimePath))throw Error('RANCH_RENDER_SOURCE_PATH');
  const sourceBytes=fs.readFileSync(path.join(root,row.runtimePath));
  if(hash(sourceBytes)!==row.runtimeSha256)throw Error('RANCH_RENDER_SOURCE_HASH: '+row.entityId);
  const source=JSON.parse(sourceBytes);
  if(source.entityId!==row.entityId||source.streaming.sourceRuntimeSha256!==row.sourceRuntimeSha256
    ||source.streaming.sourceImageSha256!==row.sourceImageSha256)throw Error('RANCH_RENDER_SOURCE_IDENTITY');
  const runtimePath=row.runtimePath.replace(/runtime\.review\.json$/,'runtime.render.json');
  const runtimeSha256=write(runtimePath,publicRanchRenderProjection(source));
  characters.push({entityId:row.entityId,speciesId:row.speciesId,runtimePath,runtimeSha256,
    sourceRuntimeSha256:row.sourceRuntimeSha256,sourceImageSha256:row.sourceImageSha256});
}
for(const row of growthAuthoredSelection(root)){const c=characters.find(c=>c.entityId===row.entityId);if(c){c.runtimePath=row.runtimePath;c.runtimeSha256=row.runtimeSha256;}}
write(publicSelectionPath,{schemaVersion:1,characters});
console.log(JSON.stringify({projected:characters.length,privateSourceFilesChanged:0,selector:publicSelectionPath}));
