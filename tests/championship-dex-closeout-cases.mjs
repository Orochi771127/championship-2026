import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import {getDatabaseIllustration} from '../src/championship/database/databaseIllustrations.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
import {setLocale} from '../src/championship/text/locale.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('docs/art/production/characters/approved-dex-closeout-20261019/manifest.json');
const registry=read('src/data/championship/database-hero-portraits.public.v1.json');
const equipped=read('docs/art/production/characters/approved-equipped-closeout-20261019/manifest.json');

test('closeout preserves all 140 previous portraits and selects only six approved complete single images',()=>{
  assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),[237,238,239,240,241,242]);
  assert.equal(manifest.priorEntries.length,140);
  assert.deepEqual(registry.entries.filter(e=>manifest.priorEntries.some(old=>old.speciesIndex===e.speciesIndex)),manifest.priorEntries);
  const allow=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
  for(const row of manifest.entries){
    assert.equal(row.approval.status,'owner_approved');assert.match(row.approval.evidence,/^Sentinel_/);
    assert.equal(row.evolutionStageAssigned,false);
    assert.equal(getDatabaseIllustration(row.speciesIndex).displayCode,row.displayCode);
    for(const [kind,asset] of [['display',databaseHeroPortrait(row.speciesIndex)],['thumbnail',databaseHeroPortrait(row.speciesIndex).thumbnail]]){
      const bytes=fs.readFileSync(asset.src);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),row[kind].sha256);
      assert.equal(bytes.length,row[kind].bytes);
      if(kind==='thumbnail')assert.ok(bytes.includes(Buffer.from('VP8L')));
      assert.ok(allow.files.some(f=>f.path===asset.src&&f.sha256===asset.sha256));
      assert.equal(Math.max(asset.width,asset.height),kind==='display'?768:96);
    }
  }
});

test('the nine explicitly approved equipped versions use their own identity and retain registration masking',()=>{
  assert.deepEqual(equipped.entries.map(e=>e.speciesIndex),[142,143,145,149,151,155,156,158,183]);
  assert.equal(equipped.approval.status,'owner_approved');
  assert.match(equipped.approval.evidence,/確認，9 張持裝圖都採用並整合/);
  assert.equal(registry.entries.length,182);
  try{for(const row of equipped.entries){
    assert.match(row.master.path,/equipped_hero/);
    for(const media of [row.display,row.thumbnail]){
      const bytes=fs.readFileSync(media.src);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
    }
    for(const locale of ['zh-Hant','en','ja','th','vi'])for(const registered of [false,true]){
      const view=makeView({locale,selectedSpeciesIndex:row.speciesIndex,registeredSpecies:registered?[row.speciesIndex]:[],collection:[]});
      try{
        const image=view.root.querySelector('.cm-dex-hero__image');
        if(registered)assert.equal(image.src,row.display.src);
        else assert.equal(image,null);
        view.assertUnchanged();
      }finally{view.dispose();}
    }
  }}finally{setLocale('zh-Hant');}
});

test('new art browses in five locales without exposing gameplay data or changing player state',()=>{
  try{for(const locale of ['zh-Hant','en','ja','th','vi'])for(const row of manifest.entries){
    const view=makeView({locale,selectedSpeciesIndex:row.speciesIndex,registeredSpecies:[],collection:[]});
    try{
      const image=view.root.querySelector('.cm-dex-hero__image');
      assert.equal(image.src,row.display.src);
      image.naturalWidth=row.display.width;image.naturalHeight=row.display.height;image.onload();
      assert.equal(view.root.querySelector('.cm-dex-hero').dataset.art,'ready');
      assert.equal(view.root.querySelector('.cm-dex-data'),null);
      assert.equal(view.root.querySelector('.cm-dex-conditions__toggle'),null);
      view.assertUnchanged();
    }finally{view.dispose();}
  }}finally{setLocale('zh-Hant');}
});
