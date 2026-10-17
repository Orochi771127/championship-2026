import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {projectPublicMetadata,METADATA_RECIPE} from '../scripts/lib/public-metadata-projection.mjs';
import {validatePublicMetadata,loadPublicMetadata} from '../src/championship/presentation/publicMetadata.js';
import {cageForegroundPlan} from '../src/championship/presentation/cageForeground.js';
import {sampleNitroVisibility,sampleNitroMaterialAnimation} from '../src/championship/presentation/vfx/nitroVfxAnimationSidecar.js';
import {validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {mountDataArenaEnvironment} from '../src/championship/presentation/dataArena/dataArenaEnvironment.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'),recipe=read(METADATA_RECIPE),projection=projectPublicMetadata({root:process.cwd(),input});
const row=role=>projection.descriptors.find(r=>r.role===role),source=r=>projection.sources.get(r.sourcePath);
const sha=b=>createHash('sha256').update(b).digest('hex');
test('52 source descriptions remain byte-identical; only 33 required runtime descriptions are selected',()=>{
 assert.equal(recipe.sources.length,52);assert.equal(projection.descriptors.length,33);
 for(const r of recipe.sources){assert.equal(sha(fs.readFileSync(r.path)),r.sha256);assert.ok(!input.files.includes(r.path));}
 for(const r of projection.descriptors){assert.ok(input.files.includes(r.path));assert.ok(fs.readFileSync(r.path).equals(r.bytes));validatePublicMetadata(r.value);}
});
test('public descriptions cannot contain source archives, authoring flags or unknown root fields',()=>{
 for(const r of projection.descriptors){assert.doesNotMatch(r.bytes.toString(),/libfile_|Sentinel_|"(?:sourceArchive|sourceLibraryId|masterSha256|sourceComposite|sourceFormat|runtimeEligible|shippingReady|localOnly|reviewOnly|humanApproved|rightsStatus|weights|customNodes)"/);
  if(r.type!=='BATTLE_MAP')assert.throws(()=>validatePublicMetadata({...r.value,sourceArchive:'private'}),/PUBLIC_METADATA_SCHEMA/);
 }
});
test('all 23 Hunt occlusion piece arrays remain exactly equal, with no collision or actor-state data added',()=>{
 const geometry=projection.descriptors.filter(r=>r.type==='HUNT_DEPTH');assert.equal(geometry.length,23);
 for(const r of geometry){assert.deepEqual(r.value.pieces,source(r).pieces);assert.deepEqual(Object.keys(r.value),['schemaVersion','renderType','pieces']);}
 const selected=[...read('assets/production/public-runtime/hunt-accepted.map.v1.json').fields,...read('assets/production/public-runtime/hunt-night.map.v1.json').fields];
 for(const field of selected)if(field.depthOccluders){const d=geometry.find(r=>r.path===field.depthOccluders.pieces.src);assert.ok(d);assert.equal(field.depthOccluders.pieces.sha256,d.sha256);}
});
test('battle projections retain every field/frame/duration/native coordinate',()=>{
 for(const role of ['battle-original','battle-baseline']){const r=row(role),a=validateRuntimeMapArtBundle(source(r)),b=validateRuntimeMapArtBundle(r.value);assert.equal(a.fields.length,b.fields.length);assert.equal(a.memoryPolicy,b.memoryPolicy);for(let i=0;i<a.fields.length;i++){assert.equal(a.fields[i].fieldId,b.fields[i].fieldId);assert.equal(a.fields[i].worldWidthPx,b.fields[i].worldWidthPx);assert.equal(a.fields[i].worldHeightPx,b.fields[i].worldHeightPx);assert.deepEqual(a.fields[i].frames.map(f=>[f.src,f.sha256.toLowerCase(),f.durationMs]),b.fields[i].frames.map(f=>[f.src,f.sha256,f.durationMs]));}}
});
test('CM03/CM24 public foreground produces exactly the same masks and depth plan as its authoring source',()=>{
 for(const role of ['cage-foreground-cm03','cage-foreground-cm24']){const r=row(role),s=source(r),placements=[{fieldId:s.fieldId,x:400,y:96,slotIndex:2}];const actual=cageForegroundPlan(r.value,placements);assert.deepEqual(actual,cageForegroundPlan(s,placements));assert.ok(actual.length);assert.ok(actual.every(p=>[p.x,p.y,p.width,p.height,p.depth].every(Number.isFinite)));}
});
test('arena mounted sprites, depth, animation and reduced-motion sampling equal the original renderer inputs',()=>{
 class Display{constructor(texture){Object.assign(this,{texture: texture?.texture??texture,x:0,y:0,alpha:1,rotation:0,visible:true,children:[],tilePosition:{x:0,y:0},position:{set:(x,y)=>{this.x=x;this.y=y;}},tileScale:{set:(x,y=x)=>{this.tileScale.x=x;this.tileScale.y=y;}},anchor:{set(){}}});if(texture?.texture)Object.assign(this,{width:texture.width,height:texture.height});}addChild(...nodes){this.children.push(...nodes);return nodes.at(-1);}addChildAt(node,i){this.children.splice(i,0,node);}removeChildren(){return this.children.splice(0);}clear(){}circle(){return this;}fill(){return this;}destroy(){}}
 const PIXI={Sprite:Display,TilingSprite:Display,Graphics:Display};
 const take=node=>({x:node.x,y:node.y,width:node.width,height:node.height,zIndex:node.zIndex,alpha:node.alpha,rotation:node.rotation,visible:node.visible,texture:node.texture?.src,tilePosition:node.tilePosition,tileScale:{x:node.tileScale?.x,y:node.tileScale?.y},children:node.children.map(take)});
 for(const role of ['arena-harbor','arena-tournament'])for(const tier of ['high','low']){
  const r=row(role),s=source(r),textures=new Map();const collect=v=>{if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object'){if(v.src)textures.set(v.src,{src:v.src,width:v.pixelWidth,height:v.pixelHeight});Object.values(v).forEach(collect);}};collect(s);
  const mount=manifest=>{const layers=Object.fromEntries(['ground','objects','water','bridge'].map(k=>[k,new Display()]));return {layers,view:mountDataArenaEnvironment({PIXI,environment:{manifest,textures,tier},...layers})};};
  const before=mount(s),after=mount(r.value);
  for(const reducedMotion of [false,true])for(const elapsed of [0,.125,1,6]){const frame={elapsed,reducedMotion,left:0,right:5000,top:-200,bottom:3000,low:tier==='low',focus:{x:700,y:1450},reaction:{t:1}};before.view.update(frame);after.view.update(frame);for(const k of Object.keys(before.layers))assert.deepEqual(take(after.layers[k]),take(before.layers[k]),role+':'+tier+':'+k);}
 }
});
test('arena render projections retain sprite placement, quality pixels, timing and immutable map signature',()=>{
 for(const role of ['arena-harbor','arena-tournament','arena-interactions']){
  const r=row(role),s=source(r);assert.equal(r.value.id,s.id);
  for(const key of ['layoutSignature','decodedBytes','actorFloorOffsets','frameDurationMs','crowdCount','waterFxRect'])assert.deepEqual(r.value[key],s[key]);
  const collect=value=>{const out=[];const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v.src)out.push([v.src,v.pixelWidth,v.pixelHeight]);Object.values(v).forEach(visit);}};visit(value);return out;};
  for(const [key,value]of Object.entries(r.value))if(value&&typeof value==='object')assert.deepEqual(collect(value),collect(s[key]),role+':'+key);
 }
});
test('VFX visibility and material samplers are equal on every original frame, with the same model bindings',()=>{
 for(const role of ['vfx-visibility','vfx-material']){const r=row(role),s=source(r),sample=role==='vfx-visibility'?sampleNitroVisibility:sampleNitroMaterialAnimation;assert.equal(r.value.frameCount,s.frameCount);for(let f=0;f<s.frameCount;f++)assert.deepEqual(sample(r.value,f),sample(s,f));}
 const r=row('vfx-runtime'),s=source(r);assert.deepEqual(r.value.systems.map(x=>[x.systemId,x.model,x.triggerBinding,x.playback]),s.systems.map(x=>[x.systemId,x.model,x.triggerBinding,x.playback]));assert.equal(r.value.tickerPolicy,s.tickerPolicy);
});
test('runtime metadata fetch is hash-bound; changed bytes and private fields fail closed',async()=>{
 const r=row('arena-interactions');let calls=0;const fetchImpl=async()=>{calls++;return {ok:true,status:200,text:async()=>r.bytes.toString()};};assert.deepEqual(await loadPublicMetadata(r.role,{fetchImpl}),r.value);assert.equal(calls,1);
 await assert.rejects(()=>loadPublicMetadata(r.role,{fetchImpl:async()=>({ok:true,status:200,text:async()=>'{"sourceArchive":"private"}'})}),/PUBLIC_METADATA_HASH/);
});
