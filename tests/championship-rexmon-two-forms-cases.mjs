// Rexmon v8 (2026-10-29 Owner handoff): one character, two ultimate forms, art-only Dex identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assertDatabaseIllustrationCatalog,databaseIllustrationForms,getDatabaseIllustration,listDatabaseIllustrations} from '../src/championship/database/databaseIllustrations.js';
import {DATABASE_DISPLAY_CATALOG,databaseDisplayRows,getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {getDatabaseSlot,listDatabaseSlots} from '../src/championship/database/databaseCatalog.js';
import {normalizeRegisteredSpecies} from '../src/championship/database/nativeBookRegistration.js';
import {getProductExtension,listProductExtensions} from '../src/championship/contracts/productSpeciesExtensions.js';
import {databaseStory,databaseVerifiedData} from '../src/championship/database/databaseStories.js';
import {databaseHeroPortrait,databaseHeroSilhouette,databaseHeroFace} from '../src/championship/presentation/databaseHeroPortraits.js';
import {publicRuntimeAsset} from '../src/championship/presentation/publicRuntimeAssets.js';
import {acceptedDatabasePortraitConfig,acceptedDatabaseIllustrationPreview} from '../src/championship/presentation/acceptedDatabasePortraits.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
import {setLocale} from '../src/championship/text/locale.js';
import {speciesName} from '../src/championship/text/zhHant.js';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=read('docs/art/production/characters/rexmon-two-forms-v8-20261029/manifest.json');
const FORMS=[[243,'dragon','雷克斯獸','UL41',41,'989c4b8054b3822931cfa14019affa0c3c1a8e27343e11296086f264ab334d9b','abb20ebf88014e118f334e98991619118d2cbef15f21d30ad449ae7aa0512c41'],
  [244,'battle','雷克斯獸·戰鬥型態','UL42',42,'b0655ca5a2c5bfe2413e4340df69e8bdf7fb38e5c6eaa0ace654a75ae4709039','2a08062def998dbf3508de290bba67546dcae67e4d15dac71f77b8fd1e15de4a']];
const ids=FORMS.map(f=>f[0]);

test('two forms of one character take fresh IDs, unique names and the next ultimate codes',()=>{
  for(const [id,form,name,code,serial] of FORMS){
    const entry=getDatabaseIllustration(id);
    assert.deepEqual({...entry},{speciesIndex:id,speciesId:`species-${id}`,displayCode:code,numberingStageIndex:6,serial,displayName:name,form:{characterKey:'rexmon',formKey:form}});
    assert.equal(getDatabaseDisplayEntry(id).displayCode,code);
    assert.equal(DATABASE_DISPLAY_CATALOG.entries.filter(e=>e.speciesIndex===id||e.displayCode===code).length,1);
    assert.equal(DATABASE_DISPLAY_CATALOG.entries.filter(e=>e.displayName===name).length,1);
  }
  // No other identity of any stage or kind is named Rexmon; every ultimate serial stays unique and consecutive.
  const names=DATABASE_DISPLAY_CATALOG.entries.filter(e=>!ids.includes(e.speciesIndex)).map(e=>speciesName(e.speciesIndex,e.displayName));
  assert.ok(names.every(name=>!String(name).includes('雷克斯')));
  const ultimate=DATABASE_DISPLAY_CATALOG.entries.filter(e=>e.numberingStageIndex===6).map(e=>e.serial).sort((a,b)=>a-b);
  assert.deepEqual(ultimate,Array.from({length:42},(_,i)=>i+1));
  assert.equal(listProductExtensions().some(e=>ids.includes(e.speciesIndex)),false);
});

test('the form link joins exactly the two Rexmon forms at one stage and rejects malformed links',()=>{
  for(const id of ids)assert.deepEqual(databaseIllustrationForms(id).map(e=>[e.speciesIndex,e.form.formKey]),[[243,'dragon'],[244,'battle']]);
  assert.deepEqual(databaseIllustrationForms(242),[]);
  assert.equal(listDatabaseIllustrations().filter(e=>e.form).length,2,'the twelve earlier identities keep their exact shape');
  const pair=listDatabaseIllustrations().filter(e=>e.form).map(e=>structuredClone(e));
  assert.doesNotThrow(()=>assertDatabaseIllustrationCatalog(pair));
  for(const broken of [
    [pair[0],{...pair[1],form:{characterKey:'rexmon',formKey:'dragon'}}],
    [pair[0],{...pair[1],numberingStageIndex:5}],
    [pair[0],{...pair[1],form:{characterKey:'rexmon',formKey:'battle',stage:'ultimate'}}],
    [pair[0],{...pair[1],form:{characterKey:'Rexmon',formKey:'battle'}}],
    [pair[0],{...pair[1],form:null}],
    [pair[0]]
  ])assert.throws(()=>assertDatabaseIllustrationCatalog(broken),/DATABASE_ILLUSTRATION_FORM/);
});

test('both forms are browsable ultimate art only: no slot, registration, extension, stats, story or evolution',()=>{
  assert.equal(listDatabaseSlots().length,218);
  const book=projectDatabase();
  assert.deepEqual(databaseDisplayRows(book,6).filter(e=>e.kind==='ILLUSTRATION').map(e=>e.speciesIndex),[242,243,244]);
  for(const id of ids){
    assert.throws(()=>getDatabaseSlot(id),/UNKNOWN_DATABASE_SLOT/);
    assert.throws(()=>normalizeRegisteredSpecies([id]));
    assert.equal(getProductExtension(id),null);assert.equal(acceptedDatabasePortraitConfig(id),null);assert.equal(acceptedDatabaseIllustrationPreview(id),null);
    assert.equal(databaseStory(id),null);assert.equal(databaseVerifiedData(id),null);
    const selected=projectDatabase({selectedSpeciesIndex:id,registeredSpecies:[id],collection:[{speciesId:`species-${id}`,instanceId:'invalid-art-instance'}]});
    assert.equal(selected.registeredCount,0);assert.equal(selected.selected.kind,'ILLUSTRATION');assert.equal(selected.selected.state,'NOT_TRACKED');
    assert.deepEqual(selected.selected.instances,[]);assert.deepEqual(selected.selected.evolutionRoutes,[]);
  }
});

test('the Dex detail loads each selected main image with its silhouette and head, and no playable controls',()=>{
  try{for(const locale of ['zh-Hant','en','ja','th','vi'])for(const [id,,name] of FORMS){
    const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:[],collection:[]});
    try{
      const hero=f.root.querySelector('.cm-dex-hero__image'),art=databaseHeroPortrait(id);
      assert.equal(hero.src,art.src);hero.naturalWidth=art.width;hero.naturalHeight=art.height;hero.onload();
      assert.equal(f.root.querySelector('.cm-dex-hero').dataset.art,'ready');
      assert.ok(f.root.querySelector('.cm-vs2-database__detail-title').textContent.includes(name));
      for(const selector of ['.cm-dex-data','.cm-dex-conditions__toggle','input','.cm-dex-profile__text'])assert.equal(f.root.querySelector(selector),null);
      f.assertUnchanged();
    }finally{f.dispose();}
  }}finally{setLocale('zh-Hant');}
  for(const id of ids){
    const art=databaseHeroPortrait(id);assert.ok(databaseHeroSilhouette(art));
    const [cx,cy,size]=databaseHeroFace(art);assert.ok(size<Math.max(art.width,art.height)/3,'head box, not the whole body');
    assert.ok(cy<art.height*0.4,'the head sits in the upper body');
  }
  // Reviewed heads: the dragon's jaw at the left, the battle form's helmet above the gem-eyed chest dragon head.
  assert.ok(databaseHeroFace(databaseHeroPortrait(243))[0]<databaseHeroPortrait(243).width*0.2);
  assert.ok(databaseHeroFace(databaseHeroPortrait(244))[1]<databaseHeroPortrait(244).height*0.22);
});

test('selected art matches the v8 pack manifest, the public selection and the build inputs; references never ship',()=>{
  assert.equal(manifest.artPack.sha256,'4990677778c0a9428484cbb1cf7654fa4df1d037c83231be5d6c586cb09a235f');
  assert.equal(manifest.artPack.designVersion,'rexmon-v8');assert.equal(manifest.character.sameCharacter,true);assert.equal(manifest.character.stage,'ultimate');
  assert.deepEqual(manifest.entries.map(e=>e.speciesIndex),ids);
  const allow=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'),input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
  for(const [i,[id,form,name,code,serial,main,turnaround]] of FORMS.entries()){
    const record=manifest.entries[i],hero=databaseHeroPortrait(id);
    assert.equal(record.master.sha256,main);assert.equal(record.turnaround.sha256,turnaround);assert.equal(record.turnaround.use,'DESIGN_REFERENCE_ONLY_NOT_RUNTIME');
    assert.deepEqual([record.displayName,record.form.formKey,record.displayCode,record.serial],[name,form,code,serial]);
    for(const [role,asset] of [['display',hero],['thumbnail',hero.thumbnail]]){
      const bytes=fs.readFileSync(asset.src);assert.equal(sha(bytes),asset.sha256);assert.equal(bytes.length,record[role].bytes);
      for(const key of ['src','sha256','width','height'])assert.equal(asset[key],record[role][key]);
      assert.ok(asset.src.startsWith('assets/production/database-rexmon-v8-20261029/'));
      assert.equal(Math.max(asset.width,asset.height),role==='display'?768:96);
      assert.deepEqual(publicRuntimeAsset(`species-${id}:database-${role==='display'?'hero':'thumbnail'}`),{id:`species-${id}:database-${role==='display'?'hero':'thumbnail'}`,src:asset.src,sha256:asset.sha256,width:asset.width,height:asset.height});
      assert.ok(allow.files.some(e=>e.path===asset.src&&e.sha256===asset.sha256));
      assert.ok(input.files.includes(asset.src));
      assert.ok(input.publicPlaytest.files.some(e=>e.path===asset.src&&e.sha256===asset.sha256));
      if(role==='thumbnail')assert.ok(bytes.includes(Buffer.from('VP8L')));
    }
  }
  // Turnarounds, the combined sheet and the v1 story reference stay on R: no shipped file carries their bytes.
  const references=new Set([...manifest.entries.flatMap(e=>[e.master.sha256,e.turnaround.sha256]),manifest.excludedFromRuntime.dual_main,manifest.excludedFromRuntime.STORY_PORTRAIT_REFERENCE]);
  assert.equal(references.size,6);
  assert.equal(allow.files.some(e=>references.has(e.sha256)),false);
  for(const file of fs.readdirSync('assets/production/database-rexmon-v8-20261029'))assert.match(file,/^species-24[34]\.(display|thumbnail)\.[a-f0-9]{16}\.webp$/);
});

test('opening both forms through the application leaves the canonical save, RNG and branch history unchanged',async()=>{
  const save=read('qa/championship-full-qa-save.json'),key='championshipModernSave:v1',map=new Map([[key,JSON.stringify(save)]]);
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
  const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,now:()=>save.updatedAt});
  try{
    await app.continueGame();app.save();const stored=storage.getItem(key),raising=JSON.stringify(app.getRaisingState()),status=JSON.stringify(app.savePort.getStatus());
    app.openDatabase();
    for(const id of ids){app.selectDatabaseSpecies(id);assert.equal(app.getDatabaseFrame().selected.kind,'ILLUSTRATION');}
    app.selectDatabaseSpecies(null);app.leaveScreen();
    assert.equal(storage.getItem(key),stored);assert.equal(JSON.stringify(app.getRaisingState()),raising);assert.equal(JSON.stringify(app.savePort.getStatus()),status);
    assert.deepEqual([...map.keys()],[key]);
  }finally{await app.dispose();}
});
