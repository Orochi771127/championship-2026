import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {validateRuntimeMapArtBundle,PUBLIC_MAP_KIND,PUBLIC_MAP_FIELDS} from '../../src/championship/presentation/runtimeMapArtBundle.js';
export {PUBLIC_MAP_FIELDS};
export const MAP_RECIPE='docs/contracts/championship/PUBLIC_MAP_RENDER_SOURCES.v1.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pick=(value,fields)=>Object.fromEntries(fields.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
const media=value=>({...pick(value,['src','sha256','width','height']),sha256:value.sha256.toLowerCase()});
export function publicMapProjection(source){
 validateRuntimeMapArtBundle(source);
 const result={schemaVersion:1,kind:PUBLIC_MAP_KIND,...pick(source,['assetId','family','fieldCount','defaultPreviewFieldId','tutorialFieldId','memoryPolicy','filter']),fields:source.fields.map(field=>{
  const out=pick(field,['fieldId','worldWidthPx','worldHeightPx','nativeWidthPx','nativeHeightPx','visualRole','gameplayBinding','gateMapping','collisionBinding','rasterPixelsPerNative']);
  if(field.visualPaddingNative)out.visualPaddingNative=pick(field.visualPaddingNative,['left','top','right','bottom']);
  out.frames=field.frames.map(frame=>({...pick(frame,['src','sha256','durationMs','rasterWidthPx','rasterHeightPx']),sha256:frame.sha256.toLowerCase()}));
  if(field.thumbnail)out.thumbnail=media(field.thumbnail);
  const depth=field.depthOccluders;
  if(depth)out.depthOccluders={atlases:depth.atlases.map(media),
   ...(depth.animationFrames?{animationFrames:depth.animationFrames.map(frame=>({atlases:frame.atlases.map(media)}))}:{}),
   pieces:media(depth.pieces),...pick(depth,['pieceCount','bandNativePx'])};
  return out;
 })};
 validateRuntimeMapArtBundle(result);return result;
}
export function selectedMapProjections({root,input}){
 const recipe=JSON.parse(fs.readFileSync(path.join(root,MAP_RECIPE),'utf8'));
 const policy=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/public-playtest.r1.json'),'utf8'));
 if(recipe.schemaVersion!==1||recipe.policyId!==policy.id||policy.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'
  ||policy.origin!=='https://orochi771127.github.io'||policy.basePath!=='/championship-2026/'
  ||policy.acceptedOriginalRuntime?.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'
  ||policy.acceptedOriginalRuntime.selectionId!=='ACCEPTED_ORIGINAL_RUNTIME_20261010')throw Error('PUBLIC_MAP_SOURCE_POLICY');
 const approved=new Map(input.publicPlaytest.files.map(row=>[row.path,row.sha256]));
 const mediaPins=new Map(recipe.mediaPins.map(row=>[row.path,row.sha256])),files=new Map(),descriptors=[];
 const metadataPath=path.join(root,'docs/contracts/championship/PUBLIC_METADATA_SOURCES.v1.json');
 const geometry=new Map(fs.existsSync(metadataPath)?JSON.parse(fs.readFileSync(metadataPath,'utf8')).sources.filter(row=>row.type==='HUNT_DEPTH').map(row=>[row.path,row]):[]);
 for(const row of recipe.sources){
  const bytes=fs.readFileSync(path.join(root,row.path));if(sha(bytes)!==row.sha256)throw Error('PUBLIC_MAP_SOURCE_CHANGED_REVIEW_REQUIRED:'+row.role);
  const value=publicMapProjection(JSON.parse(bytes));
  const visit=item=>{if(Array.isArray(item)){item.forEach(visit);return;}if(item&&typeof item==='object'){
   if(typeof item.src==='string'&&typeof item.sha256==='string'){
    const source=geometry.get(item.src);
    if(source){
     const raw=fs.readFileSync(path.join(root,source.path));if(sha(raw)!==source.sha256||mediaPins.get(item.src)!==source.sha256||item.sha256!==source.sha256)throw Error('PUBLIC_HUNT_GEOMETRY_SOURCE_CHANGED');
     const bytes=Buffer.from(JSON.stringify({schemaVersion:1,renderType:'HUNT_DEPTH',pieces:JSON.parse(raw).pieces},null,2)+'\n');
     item.src=`assets/production/public-runtime/metadata/${source.role}.v1.json`;item.sha256=sha(bytes);
    }else if(mediaPins.get(item.src)!==item.sha256||approved.get(item.src)!==item.sha256)throw Error('PUBLIC_MAP_MEDIA_NOT_APPROVED:'+item.src);
    files.set(item.src,item.sha256);
   }
   Object.values(item).forEach(visit);
  }};visit(value);
  const output=Buffer.from(JSON.stringify(value,null,2)+'\n');descriptors.push({id:`art:public:map:${row.role}:v1`,role:row.role,path:`assets/production/public-runtime/${row.role}.map.v1.json`,value,bytes:output,sha256:sha(output)});
 }
 return {descriptors,files};
}
