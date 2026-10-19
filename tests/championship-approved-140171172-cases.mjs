import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash}from'node:crypto';
import {databaseHeroPortrait}from'../src/championship/presentation/databaseHeroPortraits.js';
import {getDatabaseDisplayEntry}from'../src/championship/database/databaseDisplayCatalog.js';
import {makeView}from'./helpers/dex-conditions-ui-fixture.mjs';
import {setLocale}from'../src/championship/text/locale.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('docs/art/production/characters/approved-dex-140171172-20261020/manifest.json');
const registry=read('src/data/championship/database-hero-portraits.public.v1.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
test('three approved revisions preserve the previous188 selected images',()=>{
 assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),[140,171,172]);
 assert.ok(manifest.entries.every(e=>e.approval.status==='owner_approved'));
 const prior=registry.entries.filter(e=>![140,159,160,162,171,172].includes(e.speciesIndex));
 assert.equal(prior.length,188);assert.equal(sha(Buffer.from(JSON.stringify(prior))),manifest.priorEntriesSha256);
 const masters={"140": "81b361ae2c8a3cccae307554cba55334146544fbc8a30a92a20e70dfa4e8f3ed", "171": "77e05781e2ae3b609b29b3154f491f8f691998f95a7fa31fb07b8b06856c8baa", "172": "9329adfcc317be8e42e23eb522199a4d96e954c101b028c80fc56a72565e7080"};
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
