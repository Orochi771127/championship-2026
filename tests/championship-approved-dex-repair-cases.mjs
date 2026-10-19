import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import {getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {publicRuntimeAsset} from '../src/championship/presentation/publicRuntimeAssets.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
import {setLocale} from '../src/championship/text/locale.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('docs/art/production/characters/approved-dex-repair-20261019/manifest.json');
const registry=read('src/data/championship/database-hero-portraits.public.v1.json');
const ids=[103,105,119,120,124,136,138,139,141,146,168,178,182,185,190,191,192,193,194,195,196,197,198,199,203,204,205];
const sha=b=>createHash('sha256').update(b).digest('hex');

test('approved repair selects exact species identities and retains all 155 previous selections',()=>{
  assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),ids);
  const prior=registry.entries.filter(e=>!ids.includes(e.speciesIndex)&&![126,140,159,160,162,169,170,171,172,173,201,202].includes(e.speciesIndex));
  assert.equal(prior.length,155);
  assert.equal(sha(Buffer.from(JSON.stringify(prior))),manifest.priorEntriesSha256);
  assert.equal(registry.entries.length,194);
  const allow=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
  const inputs=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
  for(const row of manifest.entries){
    assert.equal(row.approval.status,'owner_approved');
    assert.equal(row.displayCode,getDatabaseDisplayEntry(row.speciesIndex).displayCode);
    assert.match(row.master.sha256,/^[a-f0-9]{64}$/);
    for(const [kind,media] of [['display',databaseHeroPortrait(row.speciesIndex)],['thumbnail',databaseHeroPortrait(row.speciesIndex).thumbnail]]){
      const bytes=fs.readFileSync(media.src);
      assert.equal(sha(bytes),row[kind].sha256);assert.equal(bytes.length,row[kind].bytes);
      assert.deepEqual(publicRuntimeAsset(`${row.speciesId}:database-${kind==='display'?'hero':'thumbnail'}`),{id:`${row.speciesId}:database-${kind==='display'?'hero':'thumbnail'}`,src:media.src,sha256:media.sha256,width:media.width,height:media.height});
      assert.ok(allow.files.some(e=>e.path===media.src&&e.sha256===media.sha256));
      assert.ok(inputs.files.includes(media.src));
      assert.ok(inputs.publicPlaytest.files.some(e=>e.path===media.src&&e.sha256===media.sha256));
      if(kind==='thumbnail')assert.ok(bytes.includes(Buffer.from('VP8L')));
    }
  }
  assert.equal(manifest.entries.find(e=>e.speciesIndex===105).master.sha256,'90b4834b1048497840aaadf9142791e08158f0771c27e01a69e99ce362481804');
  for(const id of [82,184,186,187,188,200])assert.equal(databaseHeroPortrait(id),null);
});

test('new hero and thumbnail load in five locales while registration masking and player state remain unchanged',()=>{
  try{for(const locale of ['zh-Hant','en','ja','th','vi'])for(const row of manifest.entries)for(const registered of [false,true]){
    const f=makeView({locale,selectedSpeciesIndex:row.speciesIndex,registeredSpecies:registered?[row.speciesIndex]:[],collection:[]});
    try{
      const image=f.root.querySelector('.cm-dex-hero__image');
      if(!registered)assert.equal(image,null);
      else{
        assert.equal(image.src,row.display.src);
        image.naturalWidth=row.display.width;image.naturalHeight=row.display.height;image.onload();
        assert.equal(f.root.querySelector('.cm-dex-hero').dataset.art,'ready');
        image.onerror();assert.equal(f.root.querySelector('.cm-dex-hero').dataset.art,'missing');
        assert.equal(f.root.querySelector(`[data-species-index="${row.speciesIndex}"] .cm-dex-list-thumb`).src,row.thumbnail.src);
      }
      f.assertUnchanged();
    }finally{f.dispose();}
  }}finally{setLocale('zh-Hant');}
});
