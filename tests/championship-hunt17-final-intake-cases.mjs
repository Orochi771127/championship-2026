import {sourceAsset,sourceHash,huntPackaging} from './helpers/packaged-hunt-art.mjs';
import {isShippingArtEntry} from '../scripts/lib/public-art-boundary.mjs';
import test from 'node:test';

import assert from 'node:assert/strict';

import fs from 'node:fs';

import crypto from 'node:crypto';

import {validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';

import {validateHuntDepthPieces} from '../src/championship/presentation/vs2/huntDepthOccluders.js';

import {factoryShutterSpec} from '../src/championship/presentation/vs2/huntFactoryShutters.js';

import {finalHuntArtManifestUrl} from '../src/championship/presentation/finalHuntArt20261008.js';

import {resolveNativeHuntSceneSources} from '../src/championship/hunt/capture/nativeHuntSceneSources.js';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));

const dir='assets/production/hunt/final-intake-20261008/';
const publicDir='assets/production/hunt/accepted-20261010/';

const bundles=['manifest.json','hm10-night.manifest.json'].map(n=>validateRuntimeMapArtBundle(read(publicDir+n)));

const old=huntPackaging.nativeBaselineManifest;

const hash=src=>crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');

const loc={protocol:'http:',hostname:'127.0.0.1',search:''};

test('17 terrain families retain 30 native field IDs; all 48 phases and matching atlas/piece bytes are intact',()=>{

 assert.deepEqual(bundles[0].fields.map(f=>f.fieldId).sort(),old.fields.map(f=>f.fieldId).sort());

 assert.equal(new Set(bundles[0].fields.map(f=>f.fieldId.slice(6,10))).size,17);

 let phases=0;

 for(const b of bundles)for(const f of b.fields){

  const previous=old.fields.find(p=>p.fieldId===f.fieldId);

  for(const k of ['worldWidthPx','worldHeightPx','gameplayBinding','gateMapping','collisionBinding'])assert.equal(f[k],previous[k]);

  assert.deepEqual(f.frames.map(x=>[x.durationRawTicks??null,x.durationMs]),previous.frames.map(x=>[x.durationRawTicks??null,x.durationMs]));

  assert.equal(f.depthOccluders.animationFrames.length,f.frames.length);

  assert.deepEqual(f.depthOccluders.atlases,f.depthOccluders.animationFrames[0].atlases);

  const pieces=validateHuntDepthPieces(read(f.depthOccluders.pieces.src),2048,2048,f.depthOccluders.atlases.length);

  assert.equal(pieces.length,f.depthOccluders.pieceCount);

  for(const asset of [...f.frames,f.depthOccluders.pieces,...f.depthOccluders.animationFrames.flatMap(g=>g.atlases)]){

   assert.ok(asset.src.startsWith(publicDir));sourceAsset(asset);assert.equal(hash(asset.src),asset.sha256.toLowerCase());

  }

  phases+=f.frames.length;

 }

 assert.equal(phases,48);

});

test('HM10 night selects art from native index 17 without inventing a second scene identity or changing native geometry',()=>{

 const day=Array.from({length:14},(_,i)=>resolveNativeHuntSceneSources({biomeId:'Factory',hour:i+7,season:0})).find(x=>x.nativeHuntIndex===16);

 const night=Array.from({length:14},(_,i)=>resolveNativeHuntSceneSources({biomeId:'Factory',hour:i+7,season:0})).find(x=>x.nativeHuntIndex===17);

 assert.equal(day.fieldId,'field_hm10_01');assert.equal(night.fieldId,day.fieldId);

 assert.equal(finalHuntArtManifestUrl(day.fieldId,16,loc),dir+'manifest.json');

 assert.equal(finalHuntArtManifestUrl(night.fieldId,17,loc),dir+'hm10-night.manifest.json');

 assert.equal(finalHuntArtManifestUrl('field_hm11_01',17,loc),dir+'manifest.json');

 for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(day.environment.readTerrain(x,y),night.environment.readTerrain(x,y));

 const nf=bundles[1].fields[0];assert.equal(nf.intakeProvenance.sourceRuntimeBinding,'DEFERRED_IN_STATIC_DELIVERY');

 assert.equal(nf.intakeProvenance.bindingAuthority,'OWNER_AUTHORIZED_PRESENTATION_ADAPTATION_20261009');

 assert.equal(nf.intakeProvenance.shutterPalette,'EXISTING_R3_COLORS_PROPOSAL_NOT_APPLIED');

});

test('local final R3 preserves the verified portal geometry and existing review gates; remote locations cannot bind',()=>{

 const factory=huntPackaging.factoryR3SourceField;

 const expected=factoryShutterSpec(factory,'art:hunt:factory-r3:20261008',{...loc,search:'?factoryShutters=r3'});

 for(const b of bundles){

  const f=b.fields.find(f=>f.fieldId==='field_hm10_01');

  assert.deepEqual(factoryShutterSpec(f,b.assetId,loc),expected);

  assert.equal(factoryShutterSpec(f,b.assetId,{...loc,hostname:'example.com'}),null);

 }

 for(const location of [{...loc,hostname:'example.com'},{...loc,protocol:'file:'}])assert.equal(finalHuntArtManifestUrl(factory.fieldId,17,location),null);

});

test('explicit legacy cave and industrial reviews retain their existing selection',()=>{

 for(const search of ['?industrialReview=r1','?caveReview=natural-r10','?caveReview=natural-r11'])

  assert.equal(finalHuntArtManifestUrl('field_hm01_01',0,{...loc,search}),null);

 assert.equal(finalHuntArtManifestUrl('field_hm01_01',0,{...loc,search:'?caveReview=unknown'}),dir+'manifest.json');

});

test('intake registration permits only local runtime and does not promote static art to complete QA or publication',()=>{

 const index=read('assets/production/ART_PRODUCTION_INDEX.json');

 for(const b of bundles){

  for(const k of ['runtimeAccepted','runtimeQaPassed','shippingReady','publicReleasePermitted'])assert.equal(b[k],false);

  assert.equal(b.localOnly,true);assert.equal(b.runtimeScope,'LOOPBACK_ONLY');

  const entry=index.entries.find(x=>x.assetId===b.assetId);assert.equal(entry.localOnly,true);assert.equal(entry.publicReleasePermitted,false);assert.equal(isShippingArtEntry(entry),false);

 }

});


test("approved public hunts select only packaged normal manifests while other hosts stay closed",()=>{const url="https://orochi771127.github.io/championship-2026/";assert.equal(finalHuntArtManifestUrl("field_hm10_01",17,url),publicDir+"hm10-night.manifest.json");assert.equal(finalHuntArtManifestUrl("field_hm01_01",0,url+"?caveReview=natural-r11"),publicDir+"manifest.json");for(const u of ["http://orochi771127.github.io/championship-2026/","https://orochi771127.github.io/other/","https://orochi771127.github.io.evil.test/championship-2026/"])assert.equal(finalHuntArtManifestUrl("field_hm01_01",0,u),null);});
