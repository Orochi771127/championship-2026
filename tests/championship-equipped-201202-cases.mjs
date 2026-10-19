import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash}from'node:crypto';
import {databaseHeroPortrait}from'../src/championship/presentation/databaseHeroPortraits.js';
import {getDatabaseDisplayEntry}from'../src/championship/database/databaseDisplayCatalog.js';
import {makeView}from'./helpers/dex-conditions-ui-fixture.mjs';
import {setLocale}from'../src/championship/text/locale.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('docs/art/production/characters/approved-equipped-201202-20261019/manifest.json');
const registry=read('src/data/championship/database-hero-portraits.public.v1.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
test('201/202 use only the newly approved equipped originals and preserve all previous182 images',()=>{
 assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),[201,202]);
 assert.equal(manifest.approval.messageId,'Sentinel_e0c3b3d5f0e08191994201ed99309bed');
 const prior=registry.entries.filter(e=>![126,169,170,173,201,202].includes(e.speciesIndex));
 assert.equal(prior.length,182);assert.equal(sha(Buffer.from(JSON.stringify(prior))),manifest.priorEntriesSha256);
 const masters={201:'503bbb48f1bfbb0665039d8ce70bc482238c28434d0068ce384f09fdfee9ec4f',202:'cd06efa67f8ab341b07beee21a699ba2b5f3e8e9f1223bf50b8d904746b814cf'};
 for(const row of manifest.entries){
  assert.equal(row.master.sha256,masters[row.speciesIndex]);assert.equal(row.displayCode,getDatabaseDisplayEntry(row.speciesIndex).displayCode);
  for(const [kind,media]of[['display',databaseHeroPortrait(row.speciesIndex)],['thumbnail',databaseHeroPortrait(row.speciesIndex).thumbnail]]){
   const bytes=fs.readFileSync(media.src);assert.equal(sha(bytes),row[kind].sha256);assert.equal(bytes.length,row[kind].bytes);
   assert.equal(row[kind].alphaExactlyMatchesResizedMaster,true);
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
