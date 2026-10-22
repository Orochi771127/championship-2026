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
const manifest=read('docs/art/production/characters/confirmed-dex-next-four-20261019/manifest.json');
// Preserve historical subset counts/hashes after independently validating all214 records.
const registry={entries:assertApproved20Registry(read('src/data/championship/database-hero-portraits.public.v1.json'))};
const sha=b=>createHash('sha256').update(b).digest('hex');
test('four confirmed revisions preserve the previous184 selected images',()=>{
 assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),[126,169,170,173]);
 assert.ok(manifest.entries.every(e=>e.approval.status==='owner_approved'));
 const prior=registry.entries.filter(e=>![126,140,159,160,162,169,170,171,172,173].includes(e.speciesIndex));
 assert.equal(prior.length,184);assert.equal(sha(Buffer.from(JSON.stringify(prior))),manifest.priorEntriesSha256);
 const masters={"126": "60b176f6c4ef2e3314c3bd1435b59b90dfd0a2967a748f3724b80448ba419641", "169": "8e194fcfd408e80ac502b2c74ae8f5414feebba6d930a9056c94d2448daf2b74", "170": "eb0da79b79cb49a495f915868883ae4c8881fa34182c79596f906ed243089d5d", "173": "f4c30e15489143da8826c107577592cc11f46446b43f41286a4f5d853f9ab65f"};
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
