import {assertApproved20Registry} from './approved20-20261022-contract.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash}from'node:crypto';
import {databaseHeroPortrait}from'../src/championship/presentation/databaseHeroPortraits.js';
import {getDatabaseDisplayEntry}from'../src/championship/database/databaseDisplayCatalog.js';
import {makeView}from'./helpers/dex-conditions-ui-fixture.mjs';
import {setLocale}from'../src/championship/text/locale.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('docs/art/production/characters/approved-equipped-159160162-20261020/manifest.json');
// Preserve historical subset counts/hashes after independently validating all214 records.
const registry={entries:assertApproved20Registry(read('src/data/championship/database-hero-portraits.public.v1.json'))};
const sha=b=>createHash('sha256').update(b).digest('hex');
test('three equipped originals preserve the previous191 selected images',()=>{
 assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),[159,160,162]);
 assert.ok(manifest.entries.every(e=>e.approval.status==='owner_approved_equipped_for_dex'));
 const prior=registry.entries.filter(e=>![159,160,162].includes(e.speciesIndex));
 assert.equal(prior.length,191);assert.equal(sha(Buffer.from(JSON.stringify(prior))),manifest.priorEntriesSha256);
 const masters={"159": "c5111cf1720479b220dcd3eec6bb85c5bfc30e48fc14080d187aa3e4f1ea9371", "160": "a840927493e4ee09a2591d7ccdf4e7bfc3ac4915945fb0f612a13e53a42045bd", "162": "c5e88262e3fc761bcf928a9f68b03690909a6443e27de724054b55108733a69e"};
 for(const row of manifest.entries){
  assert.equal(row.master.sha256,masters[row.speciesIndex]);assert.equal(row.approval.messageId,'Sentinel_de491859e2f081918d538a162a8f91fb');assert.equal(row.approval.generatedEditBodyPixelParityClaim,false);assert.equal(row.normalization.alphaNoiseThresholdBeforeResize,8);assert.equal(row.normalization.cropApplied,false);assert.equal(row.displayCode,getDatabaseDisplayEntry(row.speciesIndex).displayCode);
  for(const [kind,media]of[['display',databaseHeroPortrait(row.speciesIndex)],['thumbnail',databaseHeroPortrait(row.speciesIndex).thumbnail]]){
   const bytes=fs.readFileSync(media.src);assert.equal(sha(bytes),row[kind].sha256);assert.equal(bytes.length,row[kind].bytes);
   assert.equal(row[kind].alphaExactlyMatchesNormalizedContain,true);const box=row[kind].normalizedAlphaBBox,pad=row[kind].paddingPx;assert.ok(pad>=4&&box[0]>=pad&&box[1]>=pad&&box[2]<=row[kind].width-pad&&box[3]<=row[kind].height-pad);
   if(kind==='thumbnail')assert.ok(bytes.includes(Buffer.from('VP8L')));
  }
 }
});
test('equipped images decode without changing registration masking or player state in five locales',()=>{
 try{for(const locale of['zh-Hant','en','ja','th','vi'])for(const row of manifest.entries)for(const registered of[false,true]){
  const f=makeView({locale,selectedSpeciesIndex:row.speciesIndex,registeredSpecies:registered?[row.speciesIndex]:[],collection:[]});
  try{const image=f.root.querySelector('.cm-dex-hero__image');if(!registered)assert.equal(image,null);else{assert.equal(image.src,row.display.src);image.naturalWidth=row.display.width;image.naturalHeight=row.display.height;image.onload();assert.equal(f.root.querySelector('.cm-dex-hero').dataset.art,'ready');}f.assertUnchanged();}finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});
