import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {getDatabaseIllustration,listDatabaseIllustrations,databaseIllustrationText,DATABASE_ILLUSTRATION_COPY} from '../src/championship/database/databaseIllustrations.js';
import {inspectScopedLocaleCopy} from '../scripts/check-locale-coverage.mjs';
import {DATABASE_DISPLAY_CATALOG,databaseDisplayRows} from '../src/championship/database/databaseDisplayCatalog.js';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {getDatabaseSlot,listDatabaseSlots} from '../src/championship/database/databaseCatalog.js';
import {normalizeRegisteredSpecies} from '../src/championship/database/nativeBookRegistration.js';
import {getProductExtension,requirePlayableProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
import {databaseStory,databaseVerifiedData} from '../src/championship/database/databaseStories.js';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
import {setLocale} from '../src/championship/text/locale.js';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const ids=[231,232,233,234,235,236,237,238,239,240,241,242];
const manifest=read('docs/art/production/characters/approved-six-illustrations-20261018/manifest.json');

test('gallery locale coverage recognizes only the exact complete five-language dictionary',()=>{
  const file='src/championship/database/databaseIllustrations.js';
  const checked=inspectScopedLocaleCopy(file,DATABASE_ILLUSTRATION_COPY);
  assert.deepEqual(checked.gaps,[]);assert.deepEqual(checked.keys.sort(),['label','status']);
  assert.equal(checked.covers({file,text:'未登記的新顯示文字'}),false);
  const incomplete=JSON.parse(JSON.stringify(DATABASE_ILLUSTRATION_COPY));delete incomplete.vi.status;
  assert.equal(inspectScopedLocaleCopy(file,incomplete).gaps.length,1);
  assert.equal(databaseIllustrationText('constructor'), '');
});

test('every art-only detail shows its selected full illustration and omits playable controls in five locales',()=>{
  try{for(const locale of ['zh-Hant','en','ja','th','vi'])for(const id of ids){
    const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:[],collection:[]});
    try{
      const hero=f.root.querySelector('.cm-dex-hero__image'),art=databaseHeroPortrait(id);
      assert.equal(hero.src,art.src);hero.naturalWidth=art.width;hero.naturalHeight=art.height;hero.onload();
      assert.equal(f.root.querySelector('.cm-dex-hero').dataset.art,'ready');
      for(const selector of ['.cm-dex-profile','.cm-dex-data','.cm-dex-conditions__toggle','input'])assert.equal(f.root.querySelector(selector),null);
      assert.ok(f.root.textContent.includes(databaseIllustrationText('status',locale)));
      f.assertUnchanged();
    }finally{f.dispose();}
  }}finally{setLocale('zh-Hant');}
});

test('all 134 prior published hero selections remain exact',()=>{
  const registry=read('src/data/championship/database-hero-portraits.public.v1.json');
  const preserved={...registry,entries:registry.entries.filter(e=>e.speciesIndex<231&&![142,143,145,149,151,155,156,158,183].includes(e.speciesIndex))};
  assert.equal(preserved.entries.length,134);
  assert.equal(sha(Buffer.from(JSON.stringify(preserved,null,2)+'\n')),'5c6491b57edad00bb1caba25398aca1a5da432be7dba25aa463ee07fe41d705b');
});

test('twelve immutable encyclopedia identities use independent ART codes without assigning evolution stages',()=>{
  assert.deepEqual(listDatabaseIllustrations().map(e=>e.speciesIndex),ids);
  const codes=ids.map(id=>getDatabaseIllustration(id).displayCode);
  assert.deepEqual(codes,['ART01','ART02','ART03','ART04','ART05','ART06','ART07','ART08','ART09','ART10','ART11','ART12']);
  assert.equal(DATABASE_DISPLAY_CATALOG.entries.length,238);
  assert.equal(new Set(DATABASE_DISPLAY_CATALOG.entries.map(e=>e.speciesIndex)).size,238);
  assert.equal(new Set(DATABASE_DISPLAY_CATALOG.entries.map(e=>e.displayCode)).size,238);
  const book=projectDatabase(),rows=databaseDisplayRows(book,'ART');
  assert.deepEqual(rows.map(e=>e.speciesIndex),ids);
  for(const row of rows){
    assert.equal(row.kind,'ILLUSTRATION');assert.equal(row.state,'NOT_TRACKED');assert.equal(row.viewable,true);
    assert.equal(row.numberingStageIndex,null);assert.equal(row.legacyBookOrdinal,null);assert.equal(row.instanceCount,0);
  }
  for(let stage=0;stage<7;stage++)assert.ok(!databaseDisplayRows(book,stage).some(e=>ids.includes(e.speciesIndex)));
  for(const locale of ['zh-Hant','en','ja','th','vi'])for(const key of ['label','status'])assert.ok(databaseIllustrationText(key,locale).length>0);
});

test('art-only browsing cannot register, instantiate or invent gameplay/evolution data',()=>{
  assert.equal(listDatabaseSlots().length,218);
  for(const id of ids){
    assert.throws(()=>getDatabaseSlot(id),/UNKNOWN_DATABASE_SLOT/);
    assert.throws(()=>normalizeRegisteredSpecies([id]));
    assert.equal(getProductExtension(id),null);assert.throws(()=>requirePlayableProductExtension(id));
    assert.equal(databaseStory(id),null);assert.equal(databaseVerifiedData(id),null);
    const book=projectDatabase({selectedSpeciesIndex:id,registeredSpecies:[id],starterSpeciesId:`species-${id}`,collection:[{speciesId:`species-${id}`,instanceId:'invalid-art-instance'}]});
    assert.equal(book.slotCount,218);assert.equal(book.regularCount,218);assert.equal(book.registeredCount,0);
    assert.equal(book.entries.length,218);assert.equal(book.selected.state,'NOT_TRACKED');assert.equal(book.selected.source,null);
    assert.deepEqual(book.selected.instances,[]);assert.deepEqual(book.selected.evolutionRoutes,[]);
  }
  assert.throws(()=>projectDatabase({selectedSpeciesIndex:243}),/UNKNOWN_DATABASE_SLOT/);
});

test('approved new boar revisions and all six hero/thumbnail pairs match public selected bytes',()=>{
  assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),ids.slice(0,6));
  assert.equal(manifest.entries[1].master.sha256,'79541efce40c55a366c21116509d4dd4a8356d9a62713980170fb0b8bb55e004');
  assert.equal(manifest.entries[2].master.sha256,'8b91df854871ed98da64c0b776246209efcdadedf08da6d25c7be27a092abf59');
  const allow=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
  const input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
  for(const entry of manifest.entries){
    assert.equal(entry.approval.status,'owner_approved');assert.equal(entry.evolutionStageAssigned,false);
    const hero=databaseHeroPortrait(entry.speciesIndex);assert.equal(hero.displayCode,getDatabaseIllustration(entry.speciesIndex).displayCode);
    for(const [role,asset] of [['display',hero],['thumbnail',hero.thumbnail]]){
      const bytes=fs.readFileSync(asset.src);assert.equal(sha(bytes),asset.sha256);assert.equal(bytes.length,entry[role].bytes);
      for(const key of ['src','sha256','width','height'])assert.equal(asset[key],entry[role][key]);
      assert.equal(entry[role].alphaExactlyMatchesResizedMaster,true);
      assert.ok(Math.max(asset.width,asset.height)<=(role==='display'?768:128));
      assert.ok(allow.files.some(e=>e.path===asset.src&&e.sha256===asset.sha256));
      assert.ok(input.publicPlaytest.files.some(e=>e.path===asset.src&&e.sha256===asset.sha256));
      if(role==='thumbnail')assert.ok(bytes.includes(Buffer.from('VP8L')));
    }
  }
});

test('opening each illustration through the application preserves canonical save, RNG and branch history',async()=>{
  const save=read('qa/championship-full-qa-save.json'),key='championshipModernSave:v1',map=new Map([[key,JSON.stringify(save)]]);
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
  const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,now:()=>save.updatedAt});
  try{
    await app.continueGame();app.save();const stored=storage.getItem(key),raising=JSON.stringify(app.getRaisingState()),status=JSON.stringify(app.savePort.getStatus());
    app.openDatabase();
    for(const id of ids){app.selectDatabaseSpecies(id);assert.equal(app.getDatabaseFrame().selected.kind,'ILLUSTRATION');}
    app.selectDatabaseSpecies(20);assert.equal(app.getDatabaseFrame().selected.kind,'REGULAR');
    app.selectDatabaseSpecies(null);app.leaveScreen();
    assert.equal(storage.getItem(key),stored);assert.equal(JSON.stringify(app.getRaisingState()),raising);assert.equal(JSON.stringify(app.savePort.getStatus()),status);
    assert.deepEqual([...map.keys()],[key]);
  }finally{await app.dispose();}
});
