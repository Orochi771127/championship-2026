import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {attachReviewedCharacterAnimation,reviewedSpeciesForEntity,reviewedReplacesOriginal} from '../src/championship/presentation/reviewedCharacterLoader.js';
import {isOriginalLoopbackLocation} from '../src/championship/presentation/originalRuntimeLocation.js';
import {stageBodyScale,scaleNativeGeometry} from '../src/championship/presentation/stageBodySize.js';
// Expected identities below are the three existing, already-public measured
// profiles in huntContactShadow.js. No private authoring receipt is read here.
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const contact=await import(new URL('src/championship/presentation/vs2/huntContactShadow.js',root));
const catalog=JSON.parse(read('src/data/championship/public-character-catalog.v1.json'));
const expectedProfiles={
 m104_tunomon:{folder:'m104_tunomon-early64-raw-v2-r01',sourceBankSha256:'665c888f35c0520c976180087991c5713e46b4f7eef4a231992bd86a395557c2'},
 m006_punimon:{folder:'m006_punimon-early64-raw-v2-r01',sourceBankSha256:'b4a30d79d84bb3b1a9a3d7a0cfd1cb7ea23227722d32c56bbf93b873a7983787'},
 m203_elecmon:{folder:'m203_elecmon-final-growth38-20261007',sourceBankSha256:'ea39060f0570245b72161ec7a5d4ec3745043125cdbb5f2262f02908910f1b8c'}
};
let assertions=0;
for(const eid of ['m104_tunomon','m006_punimon','m203_elecmon']){
 const config=catalog.characters.find(c=>c.entityId===eid),receipt=expectedProfiles[eid];
 const art=contact.getPublicReviewedRaisingContactArt(config);
 assert.deepEqual(art,{entityId:eid,folder:receipt.folder,side:'main',sourceBankSha256:receipt.sourceBankSha256});assert.ok(Object.isFrozen(art));assertions+=2;
 for(const bad of [null,{}, {...config,entityId:'unknown'}, {...config,runtimeSha256:null},{...config,runtimeSha256:'0'.repeat(64)},{...config,geometrySha256:null},{...config,geometrySha256:'0'.repeat(64)}]){assert.equal(contact.getPublicReviewedRaisingContactArt(bad),null);assertions++;}
 assert.equal(contact.getPublicReviewedRaisingContactArt(config,'sub'),null);assertions++;
 const runtime=JSON.parse(read(config.runtimePath));
 const geometry=runtime.geometry.frames[eid+'/main/cell_024'];const frame={sequenceId:14,cell:24,geometry};
 assert.ok(contact.huntContactShadow(config.speciesId,frame,0,art));assertions++;
 for(const bad of [null,{}, {...art,sourceBankSha256:'0'.repeat(64)},{...art,folder:'wrong'},{...art,side:'sub'},{...art,entityId:'wrong'}]){assert.equal(contact.huntContactShadow(config.speciesId,frame,0,bad),null);assertions++;}
 assert.equal(contact.huntContactShadow(config.speciesId,{...frame,geometry:{...geometry,origin:[0,0]}},0,art),null);assertions++;
 for(const lift of [8,32]){assert.deepEqual(contact.huntContactShadow(config.speciesId,frame,lift,art).ellipses,contact.huntContactShadow(config.speciesId,frame,0,art).ellipses);assertions++;}
 if(eid==='m006_punimon'){
  assert.deepEqual(contact.huntContactShadow(config.speciesId,frame,0,art).ellipses,[{x:-.25,y:-.5,radiusX:6.25,radiusY:1.5}]);assertions++;
  const pose={...frame,sequenceId:13,cell:23,geometry:runtime.geometry.frames[eid+'/main/cell_023']};
  assert.deepEqual(contact.huntContactShadow(config.speciesId,pose,0,art).ellipses,[{x:-2,y:0,radiusX:9.5,radiusY:1.25}]);assertions++;
  assert.deepEqual(contact.huntContactShadow(config.speciesId,pose,8,art).ellipses,contact.huntContactShadow(config.speciesId,frame,0,art).ellipses);assertions++;
 }
}
const approved=catalog.characters.filter(c=>contact.getPublicReviewedRaisingContactArt(c));assert.equal(approved.length,3);assert.equal(catalog.characters.length,226);assertions+=2;
// Exercise actual public loader validation and actual new wrapper, mocking only
// GPU bundle/core dependencies. No hash validation or helper is replaced.
let source=read('src/championship/presentation/publicCharacterRoster.js').replace(/^import .*;\n/gm,'').replace(/^export \{.*;\n/gm,'');
source=`const {catalog,PUBLIC_CHARACTER_CATALOG,loadCharacterRosterCore,loadPixiCharacterRuntimeBundle,PUBLIC_CHARACTER_RENDER_KIND,canonicalRenderValue,getPublicReviewedRaisingContactArt,attachReviewedCharacterAnimation,reviewedSpeciesForEntity,reviewedReplacesOriginal,isOriginalLoopbackLocation,stageBodyScale,scaleNativeGeometry}=globalThis.__publicContactTest;\n`+source;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
for(const config of approved){
 const raw=read(config.runtimePath),runtime=JSON.parse(raw);let activeBundle;
 globalThis.__publicContactTest={catalog,PUBLIC_CHARACTER_CATALOG:'src/data/championship/public-character-catalog.v1.json',PUBLIC_CHARACTER_RENDER_KIND:runtime.kind,canonicalRenderValue:canonical,getPublicReviewedRaisingContactArt:contact.getPublicReviewedRaisingContactArt,attachReviewedCharacterAnimation,reviewedSpeciesForEntity,reviewedReplacesOriginal,isOriginalLoopbackLocation,stageBodyScale,scaleNativeGeometry,
  loadPixiCharacterRuntimeBundle:async args=>({runtime:args.runtimeDocument,createActor:()=>({entityId:config.entityId,sprite:{unchanged:true}})}),
  loadCharacterRosterCore:async options=>{const record=options.manifest.records.find(r=>r.entityId===config.entityId);activeBundle=await options.loadBundle({runtimeUrl:new URL(record.runtime,options.manifestUrl).href});return {createActor:o=>activeBundle.createActor(o),getDiagnostics:()=>({})};}};
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+config.entityId).toString('base64'));
 const roster=await mod.loadPublicCharacterRoster({PIXI:{},speciesIds:[config.speciesId],fetchImpl:async()=>({ok:true,text:async()=>raw})},'https://example.test/');
 const actor=roster.createActor({presentation:'raising',nativeFramePresentation:true});assert.ok(actor.contactShadowArt);assert.equal(actor.sprite.unchanged,true);assertions+=2;
 assert.equal(roster.createActor({presentation:'hunt'}).contactShadowArt,undefined);assert.equal(roster.createActor({presentation:'raising',side:'sub'}).contactShadowArt,undefined);assertions+=2;
 // Future alternate packed runtime with valid JSON/geometry but different
 // actual hash must not inherit the normal delivery's reviewed identity.
 const packedRaw=raw+' ',packedConfig={...config,battleRuntimePath:config.runtimePath+'.packed',battleRuntimeSha256:crypto.createHash('sha256').update(packedRaw).digest('hex')};
 globalThis.__publicContactTest.catalog={...catalog,characters:catalog.characters.map(c=>c.entityId===config.entityId?packedConfig:c)};
 const packedModule=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//packed-'+config.entityId).toString('base64'));
 const packedRoster=await packedModule.loadPublicCharacterRoster({PIXI:{},speciesIds:[config.speciesId],battleAtlas:true,fetchImpl:async()=>({ok:true,text:async()=>packedRaw})},'https://example.test/');
 assert.equal(packedRoster.createActor({presentation:'raising'}).contactShadowArt,undefined);assertions++;
 await assert.rejects(()=>mod.loadPublicCharacterRoster({PIXI:{},speciesIds:[config.speciesId],fetchImpl:async()=>({ok:true,text:async()=>raw+' '})},'https://example.test/'),/PUBLIC_CHARACTER_RUNTIME_HASH/);assertions++;
}
delete globalThis.__publicContactTest;
console.log(JSON.stringify({status:'PASS',assertions,supportedReviewedProfiles:3,otherFormsUnchanged:223,scope:'Actual public runtime hash/motion/geometry validation with mocked GPU dependencies; not GPU contact proof'}));
