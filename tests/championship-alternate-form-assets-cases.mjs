import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ALTERNATE_FORM_ASSET_CANDIDATES as configs,ACTIVE_ALTERNATE_FORM_ASSETS,validateAlternateFormAsset,rekeyAlternateDonorRuntime,mergeAlternateFormConfigs,bindAlternateFormManifest} from '../src/championship/presentation/alternateFormAssetContracts.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const source=fs.readFileSync(path.join(root,'src/championship/presentation/completedOriginalCharacters.js'),'utf8');
const validator=source.slice(source.indexOf('export function validateCompletedOriginalRuntime'),source.indexOf('/** Reuse the reviewed density-four adapter'));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const check=new Function('canonical',validator.replace('export function','function')+';return validateCompletedOriginalRuntime;')(canonical);
assert.equal(configs.length,4);assert.equal(ACTIVE_ALTERNATE_FORM_ASSETS.length,0,'Candidates must not activate without normal-path evidence.');
const identities=new Set();let cells=0;
for(const c of configs){
 assert(!identities.has(c.entityId));identities.add(c.entityId);assert.equal(c.runtimeReady,false);assert.notEqual(c.speciesIndex,228);
 const donorPath=`assets/production/internal-faithful-baseline/characters-v1/${c.motionDonorEntityId}/runtime.json`;
 assert.equal(hash(donorPath),c.baselineRuntimeSha256);
 const original=read(donorPath),before=JSON.stringify(original),baseline=rekeyAlternateDonorRuntime(original,c);
 assert.equal(JSON.stringify(original),before);assert.equal(baseline.entityId,c.entityId);
 const folder=c.assetRoot+c.folder;const runtime=read(folder+'/runtime.review.json');check(runtime,c,baseline);
 assert.equal(hash(folder+'/runtime.review.json'),c.runtimeSha256);assert.equal(hash(folder+'/origin-geometry.json'),c.originGeometryContractSha256);assert.equal(hash(folder+'/motion-contract.json'),c.motionContractSha256);
 for(const side of ['main','sub']){
  const keys=new Set();
  for(const a of runtime.sides[side].atlases){const atlas=read(folder+'/'+a.data);assert(atlas.meta.size.w<=2048&&atlas.meta.size.h<=2048);for(const key of Object.keys(atlas.frames)){assert(!keys.has(key));keys.add(key);assert(key.startsWith(c.entityId+'/'+side+'/'));}}
  assert.equal(keys.size,Object.keys(c.frameOrigins).filter(k=>k.includes('/'+side+'/')).length);cells+=keys.size;
 }
 const drift=structuredClone(runtime);drift.sides.main.animations[0].frames[0].ticks++;assert.throws(()=>check(drift,c,baseline),/MOTION_DRIFT/);
 const badOrigin=structuredClone(runtime);badOrigin.reviewGeometry.frames[Object.keys(badOrigin.reviewGeometry.frames)[0]].origin[0]++;assert.throws(()=>check(badOrigin,c,baseline),/ORIGIN_DRIFT/);
 const hud=read(folder+'/hud-r01/manifest.json');assert.deepEqual(hud.battle.sequences,c.hudSequences);assert.equal(hud.portrait.speciesId,c.speciesId);
 for(const cell of [hud.portrait,...hud.battle.cells])assert.equal(hash(cell.src),cell.sha256);
 assert.throws(()=>validateAlternateFormAsset({...c,motionDonorEntityId:'m999_fake'}),/INVALID/);
 assert.throws(()=>rekeyAlternateDonorRuntime({...original,entityId:'m999_fake'},c),/WRONG_DONOR/);
}
assert.equal(cells,306);
const donorIds=[...new Set(configs.map(c=>c.motionDonorEntityId))];const manifest={records:donorIds.map(entityId=>({entityId,runtime:entityId+'/runtime.json',sides:{main:{cells:entityId==='m540_imperialdramon_fm'?63:entityId==='m506_griffomon'?61:55}}})),speciesBindings:[{speciesId:'species-211',entityId:'m528_metaletemon'},{speciesId:'species-222',entityId:'m540_imperialdramon_fm'}]};
const before=JSON.stringify(manifest),bound=bindAlternateFormManifest(manifest,configs);assert.equal(JSON.stringify(manifest),before);assert.equal(bound.records.find(r=>r.entityId==='m540_imperialdramon_fm').sides.main.cells,61);assert.equal(bound.records.find(r=>r.entityId==='oc_celestyrant_battle_r10').sides.main.cells,63);assert.equal(bound.speciesBindings.length,4);assert.equal(mergeAlternateFormConfigs([{entityId:'m528_metaletemon',old:true}],configs).length,4);
console.log('PASS: 4 independent identities; 306 cells; 212 donor sequences; donor hashes; geometry/origin; atlas <=2048; HUD hashes; motion/origin drift rejection; immutable source; disabled pending normal-path QA.');
// Exercise the real loader adapter with deterministic decoded-bundle/fetch doubles.
const stripped=source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const origin='https://example.test/';
const baseRoot='assets/production/internal-faithful-baseline/characters-v1/';
const calls=[];
const fetchImpl=async url=>{const pathname=new URL(url).pathname.slice(1);const target=pathname;const text=fs.readFileSync(path.join(root,target),'utf8');return {ok:true,text:async()=>text,json:async()=>JSON.parse(text)};};
const bundleLoader=async args=>{calls.push(args.runtimeUrl);const runtime=await(await fetchImpl(args.runtimeUrl)).json();return {runtime,dispose:async()=>{},createActor:opts=>({entityId:runtime.entityId,...opts,nativeSizing:{packedPixelsPerNativePixel:1}})};};
const rosterLoader=async opts=>{const bundles=new Map();for(const binding of opts.manifest.speciesBindings){if(!configs.some(c=>c.speciesId===binding.speciesId))continue;const bundle=await opts.loadBundle({runtimeUrl:origin+baseRoot+binding.entityId+'/runtime.json'});bundles.set(binding.entityId,bundle);}return {createActor:opts=>bundles.get(opts.entityId).createActor(opts),getDiagnostics:()=>({})};};
const getLoader=new Function('acceptedSelection','battlePacking','isApprovedOriginalPublicLocation','isOriginalRuntimeLocation','loadLicensedCharacterRoster','loadPixiCharacterRuntimeBundle','COMPLETED_ORIGINAL_CHARACTERS','readHudManifest','alternateFormAsset','mergeAlternateFormConfigs','bindAlternateFormManifest','rekeyAlternateDonorRuntime','fetch',stripped+';return loadCompletedOriginalCharacters;');
const loader=getLoader({characters:[],root:'unused/'},{characters:[]},()=>true,()=>true,rosterLoader,bundleLoader,[],()=>{},()=>null,x=>mergeAlternateFormConfigs(x,configs),m=>bindAlternateFormManifest(m,configs),rekeyAlternateDonorRuntime,fetchImpl);
const roster=await loader({manifest,speciesIds:configs.map(c=>c.speciesId),sides:['main'],battleAtlas:true},origin);
assert.equal(calls.length,4);assert(calls.every(url=>url.includes('/alternate-forms-20261015/')),'Never select stale packed atlases for alternates.');
for(const c of configs){const actor=roster.createActor({entityId:c.entityId,nativeFramePresentation:true,battleGeometry:{}});assert.equal(actor.entityId,c.entityId);assert.equal(actor.nativeSizing.packedPixelsPerNativePixel,4);assert(actor.nativeGeometry.frames[c.entityId+'/main/cell_000']);}
console.log('PASS: real completed-original loader adapter with fetch/decode doubles; four bindings; donor hash/motion checks; geometry handed to actor; stale packed atlas bypassed. This is not a browser/gameplay playback test.');
// Generated gameplay presentation adapters are activated only with the same asset contract.
for(const [filename,symbol] of [['battleCharacterProfiles.js','BATTLE_CHARACTER_PROFILES'],['battleCharacterGeometry.js','BATTLE_CHARACTER_GEOMETRY'],['characterNativeSizing.js','CHARACTER_NATIVE_SIZING']]){
 const file=fs.readFileSync(path.join(root,'src/data/championship',filename),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const names=filename==='battleCharacterProfiles.js'?[symbol,'BATTLE_SPECIES_ENTITIES','BATTLE_SPECIES_MOVEMENT']:[symbol];
 const result=new Function('ACTIVE_ALTERNATE_FORM_ASSETS',file+';return {'+names.join(',')+'};')(configs);
 assert(result[symbol].oc_crownbrass_mandrill);assert(result[symbol].oc_celestyrant_battle_r10);
 if(filename==='battleCharacterProfiles.js'){
  assert.equal(result.BATTLE_SPECIES_ENTITIES[228],null);assert.equal(result.BATTLE_SPECIES_ENTITIES[229],'oc_crownbrass_mandrill');assert.equal(result.BATTLE_SPECIES_ENTITIES[230],'oc_celestyrant_battle_r10');
  assert.equal(Object.keys(result[symbol].m540_imperialdramon_fm.cells).length,61);assert.equal(Object.keys(result[symbol].oc_celestyrant_battle_r10.cells).length,63);
  assert.deepEqual(result.BATTLE_SPECIES_MOVEMENT[229],result.BATTLE_SPECIES_MOVEMENT[211]);assert.deepEqual(result.BATTLE_SPECIES_MOVEMENT[230],result.BATTLE_SPECIES_MOVEMENT[222]);
 }
}
assert.throws(()=>validateAlternateFormAsset({...configs[0],runtimeReady:true}),/QA_REQUIRED/);
console.log('PASS: explicit entity allowlist; quad m506 61 main cells vs humanoid m540 63; 228 remains null; inherited movement; missing normal-path QA rejects activation.');
