import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=read('docs/art/production/characters/approved-dex-gap-20261018/manifest.json');
const registry=read('src/data/championship/database-hero-portraits.public.v1.json');
const allowlist=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
const inputs=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
const ids=[122,123,127,128,129,130,131,132,133,134,135,137,144,150,152,153,154,157,161,163,164,165,166,167];

test('the missing approved full-art batch selects exactly its 24 immutable identities',()=>{
  assert.deepEqual(manifest.entries.map(row=>row.speciesIndex),ids);
  assert.equal(registry.entries.length,140);
  assert.equal(new Set(registry.entries.map(row=>row.speciesIndex)).size,140);
  for(const row of manifest.entries){
    assert.ok(row.approval.evidence,'Explicit approval evidence is required');
    assert.match(row.approval.status,/^owner_approved$/i);
    assert.doesNotMatch(row.purpose,/EMPTY_HAND|THREEVIEW|HISTORICAL|PALETTE/);
    const hero=databaseHeroPortrait(row.speciesIndex);
    assert.equal(hero.displayCode,row.displayCode);
    for(const [role,asset] of [['display',hero],['thumbnail',hero.thumbnail]]){
      for(const key of ['src','sha256','width','height'])assert.equal(asset[key],row[role][key]);
      const bytes=fs.readFileSync(new URL('../'+asset.src,import.meta.url));
      assert.equal(sha(bytes),asset.sha256);assert.equal(bytes.length,row[role].bytes);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
      if(role==='thumbnail')assert.ok(bytes.includes(Buffer.from('VP8L')));
      assert.equal(row[role].alphaExactlyMatchesResizedMaster,true);
      assert.ok(allowlist.files.some(file=>file.path===asset.src&&file.sha256===asset.sha256));
      assert.ok(inputs.files.includes(asset.src));
      assert.ok(inputs.publicPlaytest.files.some(file=>file.path===asset.src&&file.sha256===asset.sha256));
    }
  }
});

test('the 110 published selections and raw authoring registry remain intact',()=>{
  const preserved={schemaVersion:1,entries:registry.entries.filter(row=>row.speciesIndex<231&&!ids.includes(row.speciesIndex))};
  assert.equal(preserved.entries.length,110);
  assert.equal(sha(Buffer.from(JSON.stringify(preserved,null,2)+'\n')),'8686f2e91e776cd465ee427622b3bde0de08377024d144821e654da3ec93f1e1');
  assert.equal(read('src/data/championship/database-hero-portraits.r1.json').entries.length,96);
  for(const id of [82,136,138,139,140,141,142,143,145,146,147,148,149,151,155,156,158,159,160,162,168,183])assert.equal(databaseHeroPortrait(id),null);
  assert.ok(!inputs.files.some(file=>file.includes('approved-dex-gap-20261018')||file.includes('source-masters')));
});
