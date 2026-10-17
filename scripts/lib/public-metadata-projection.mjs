import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {publicMapProjection} from './public-map-projection.mjs';
export const METADATA_RECIPE='docs/contracts/championship/PUBLIC_METADATA_SOURCES.v1.json';
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));
const sha=b=>createHash('sha256').update(b).digest('hex');
const tex=v=>pick(v,['src','pixelWidth','pixelHeight']);
const tiers=v=>Object.fromEntries(['high','low'].filter(k=>v[k]).map(k=>[k,tex(v[k])]));
const sprite=v=>({...pick(v,['id','x','y','width','height','sortY','colliderId','frameCount','frameDurationMs','pivot','rect','footprint','kind','renderInMechanism']),
 ...(v.src?tex(v):{}),...(v.textures?{textures:tiers(v.textures)}:{}),...(v.frames?{frames:v.frames.map(tiers)}:{}),
 ...(v.states?{states:Object.fromEntries(Object.entries(v.states).map(([k,x])=>[k,sprite(x)]))}:{})});
const keysOf=value=>{const fields=new Set();const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){fields.add(k);visit(x);}};visit(value);return [...fields].sort();};
export function metadataProjection(source,row,paths){
 const type=row.type;
 if(type==='BATTLE_MAP')return publicMapProjection(source);
 if(type==='HUNT_DEPTH')return {schemaVersion:1,renderType:type,pieces:structuredClone(source.pieces)};
 if(type==='CAGE_FOREGROUND')return {schemaVersion:1,renderType:type,...pick(source,['fieldId','width','height','pixelScale','nativeOrigin']),objects:source.objects.map(o=>pick(o,['id','src','sha256','x','y','width','height','depthNative','maskRects']))};
 if(type==='VFX_VISIBILITY')return {renderType:type,...pick(source,['schemaVersion','kind','animationName','frameCount','nodeCount','nodeNames','frames'])};
 if(type==='VFX_MATERIAL')return {renderType:type,...pick(source,['schemaVersion','kind','animationName','frameCount']),tracks:source.tracks.map(t=>({materialName:t.materialName,channels:{diffuse:pick(t.channels.diffuse,['rgb8']),polygonAlpha:{...pick(t.channels.polygonAlpha,['storage','value','denominator']),...(t.channels.polygonAlpha.runs?{runs:t.channels.polygonAlpha.runs.map(r=>pick(r,['startFrame','endFrame','value']))}:{})}}}))};
 if(type==='VFX_RUNTIME')return {schemaVersion:1,renderType:type,...pick(source,['assetId','family','tickerPolicy','gateEarthMounted']),systems:source.systems.map(s=>({...pick(s,['systemId','logicalGroup','model','triggerBinding','playback']),sidecars:s.sidecars.map(file=>{if(!paths.has(file))throw Error('UNPROJECTED_VFX_SIDECAR:'+file);return paths.get(file);})}))};
 if(type==='ARENA_INTERACTIONS')return {schemaVersion:source.schemaVersion,renderType:type,id:source.id,
  props:Object.fromEntries(Object.entries(source.props).map(([k,v])=>[k,tiers(v)])),
  ice:{...pick(source.ice,['anchor','worldSize','floorOffsetPx']),...Object.fromEntries(['ICE','ICE_CRACKED','ICE_MELT'].map(k=>[k,tiers(source.ice[k])]))},harborPatches:source.harborPatches.map(sprite)};
 if(type==='ARENA_HARBOR')return {renderType:type,...pick(source,['schemaVersion','id','kind','layoutSignature','decodedBytes','actorFloorOffsets','pylonLampHeightPx','waterFxRect','waterWaveAlpha','causticsAlpha','crowdCount']),
  world:pick(source.world,['width','height']),layout:{pylons:source.layout.pylons},ground:Object.fromEntries(['high','low'].map(k=>[k,source.ground[k].map(sprite)])),
  props:source.props.map(sprite),mechanisms:source.mechanisms.map(sprite),bridge:sprite(source.bridge),waves:tiers(source.waves),caustics:tiers(source.caustics),
  ...Object.fromEntries(['shoreDecor','dynamicProps','crowdFrames','foregroundBanks'].filter(k=>source[k]).map(k=>[k,source[k].map(sprite)]))};
 if(type==='ARENA_TOURNAMENT')return {renderType:type,...pick(source,['schemaVersion','id','kind','layoutSignature','decodedBytes','crowdCount','frameDurationMs']),world:pick(source.world,['cols','rows','cell','width','height']),projection:pick(source.projection,['waterSurfaceOffset']),
  ground:source.ground.map(sprite),foreground:sprite(source.foreground),props:source.props.map(sprite),dynamicProps:source.dynamicProps.map(sprite),crowd:source.crowd.map(sprite),pennants:source.pennants.map(sprite),waves:tiers(source.waves)};
 throw Error('UNKNOWN_METADATA_PROJECTION:'+type);
}
export function projectPublicMetadata({root,input}){
 const recipe=JSON.parse(fs.readFileSync(path.join(root,METADATA_RECIPE),'utf8')),policy=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/public-playtest.r1.json'),'utf8'));
 if(recipe.policyId!==policy.id||policy.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST')throw Error('PUBLIC_METADATA_POLICY');
 const paths=new Map(recipe.sources.filter(r=>r.role).map(r=>[r.path,`assets/production/public-runtime/metadata/${r.role}.v1.json`]));
 const descriptors=[],sources=new Map(),media=new Map();
 const approved=new Map(input.publicPlaytest.files.map(r=>[r.path,r.sha256]));
 for(const row of recipe.sources){
  const bytes=fs.readFileSync(path.join(root,row.path));if(sha(bytes)!==row.sha256)throw Error('METADATA_SOURCE_CHANGED_REVIEW_REQUIRED:'+row.path);
  const source=JSON.parse(bytes);sources.set(row.path,source);if(!row.role)continue;
  const value=metadataProjection(source,row,paths),out=Buffer.from(JSON.stringify(value,null,2)+'\n');
  const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){
   if(typeof v.src==='string'&&!v.src.endsWith('.json')){const hash=approved.get(v.src);if(!hash)throw Error('METADATA_MEDIA_NOT_APPROVED:'+v.src);media.set(v.src,hash);}
   if(typeof v.model==='string'){const hash=approved.get(v.model);if(!hash)throw Error('METADATA_MODEL_NOT_APPROVED:'+v.model);media.set(v.model,hash);}
   Object.values(v).forEach(visit);
  }};visit(value);
  descriptors.push({role:row.role,type:row.type,id:`art:public:metadata:${row.role}:v1`,path:paths.get(row.path),sourcePath:row.path,value,bytes:out,sha256:sha(out),jsonFields:keysOf(value)});
 }
 return {descriptors,paths,sources,media};
}
