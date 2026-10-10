import publishedCages from '../assets/production/cage/original-opus-v1/manifest.json' with {type:'json'};
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '../assets/production/cage/shop-final-20261008/manifest.json' with {type:'json'};
import {originalShopCageThumbnail,validateOriginalShopCageArt} from '../src/championship/presentation/originalShopCageArt.js';
import {shopCageUiImage,cageUiImage} from '../src/championship/presentation/cageUiArt.js';
import {assembledShopArt,assembledCageArt} from '../src/championship/presentation/assembledUiArt.js';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {isShippingArtEntry} from '../scripts/lib/public-art-boundary.mjs';
const local='http://127.0.0.1:8766/championship.html';
test('35 final thumbnails keep exact delivery hashes and full transparent 256x192 canvas',()=>{
 for(const r of manifest.records){
  const bytes=readFileSync(r.src);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);
  assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[256,192]);
  assert.equal(shopCageUiImage(r.shopRecordIndex,local),r.src);
  assert.equal(r.sourceCrop,null);
 }
 assert.equal(manifest.records.length,35);
});
test('shop order maps to canonical field identity, including CM03 CM24 and mini cages',()=>{
 for(const [record,definition,field] of [[84,27,'field_cm30_01'],[86,2,'field_cm03_01'],[90,23,'field_cm24_01'],[112,15,'field_cm16_01']]){
  const a=originalShopCageThumbnail(record,local);
  assert.equal(a.itemIndex,definition);assert.equal(a.fieldId,field);
 }
 assert.equal(originalShopCageThumbnail(118,local),null);
 assert.equal(originalShopCageThumbnail('83',local),null);
});
test('wrong IDs, duplicate rows, unregistered art and altered crop/origin fail closed',()=>{
 for(const change of [m=>m.records.pop(),m=>m.records[0].itemIndex=1,m=>m.records[1]=m.records[0],
   m=>m.records[0].fieldId='field_cm28_01',m=>m.records[0].src='../escape.png',
   m=>m.records[0].rasterOrigin=[128,96],m=>m.records[0].sourceCrop=[0,0,256,192],
   m=>m.localOnly=false]){
  const copy=structuredClone(manifest);change(copy);assert.throws(()=>validateOriginalShopCageArt(copy),/ORIGINAL_SHOP_CAGE_ART_INVALID/);
 }
 assert.throws(()=>validateOriginalShopCageArt(manifest,{entries:[]}),/LOCAL_REGISTRATION/);
});
test('local thumbnails preserve outside-host fallback, editor art and goods CAGES exclusion',()=>{
 for(const host of ['https://example.com/','https://localhost.evil.test/','file:///test','http://orochi771127.github.io/championship-2026/','https://orochi771127.github.io/other-project/']){
  for(const r of manifest.records)assert.equal(originalShopCageThumbnail(r.shopRecordIndex,host),null);
 }
 const publicUrl='https://orochi771127.github.io/championship-2026/';
 for(const r of manifest.records){
  assert.equal(shopCageUiImage(r.shopRecordIndex,publicUrl),r.src);
  assert.equal(cageUiImage(r.moduleId,local),publishedCages.fields.find(f=>f.fieldId===r.fieldId).frames[0].src);
  assert.equal(shopGoodsPresentation(r.shopRecordIndex,local),null);
 }
 assert.equal(manifest.publicReleasePermitted,false);assert.equal(manifest.shippingReady,false);
 assert.equal(isShippingArtEntry({...manifest,manifestPath:'assets/production/cage/shop-final-20261008/manifest.json'}),false);
});
