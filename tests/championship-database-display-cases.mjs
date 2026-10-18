import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DATABASE_DISPLAY_CATALOG as dex,databaseDisplayRows,getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {listDatabaseSlots,getDatabaseSlot} from '../src/championship/database/databaseCatalog.js';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {openingEggChoices} from '../src/championship/app/openingEggChoices.js';
import {setLocale} from '../src/championship/text/locale.js';
import {generationName} from '../src/championship/text/zhHant.js';
import {uiText} from '../src/championship/text/uiText.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {resolveProductSpeciesDefinition} from '../src/championship/contracts/productSpeciesExtensions.js';
const species=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json','utf8'));
const nativeDisplay=JSON.parse(fs.readFileSync('src/data/championship/database-display.r1.json','utf8'));
const nativeEntries=new Map(nativeDisplay.entries.map(e=>[e.speciesIndex,e]));

test('production display joins 216 native rows, eight eggs and two explicit product forms without sentinel or alias rows',()=>{
  assert.equal(nativeDisplay.entries.length,224);assert.equal(species.records.length,228);
  assert.equal(dex.entries.length,232);
  for(const field of ['entryKey','speciesIndex','speciesId','displayCode'])assert.equal(new Set(dex.entries.map(e=>e[field])).size,232,field);
  assert.deepEqual(dex.stagePrefixes,['EG','B1','B2','GR','MA','AW','UL']);
  assert.deepEqual(dex.stagePrefixes.map((_,s)=>dex.entries.filter(e=>e.numberingStageIndex===s).length),[8,12,14,38,64,51,39]);
  for(const entry of dex.entries.filter(e=>e.kind!=='ILLUSTRATION')){
    assert.equal(entry.speciesId,`species-${String(entry.speciesIndex).padStart(3,'0')}`);
    const definition=resolveProductSpeciesDefinition(entry.speciesIndex,species.records);
    assert.equal(entry.numberingStageIndex,definition.generationIndex);
    assert.equal(entry.displayCode,dex.stagePrefixes[entry.numberingStageIndex]+String(entry.serial).padStart(2,'0'));
    const native=nativeEntries.get(entry.speciesIndex);
    assert.equal(entry.firstPublishedRevision,native?1:2);assert.equal(entry.contentStatus,'PUBLISHED');
    assert.equal(entry.legacyBookOrdinal,native?.legacyBookOrdinal??null);
    if(native){
      for(const field of ['entryKey','speciesId','numberingStageIndex','legacyBookOrdinal'])assert.equal(entry[field],native[field],`${entry.speciesIndex}:${field}`);
      if([121,125].includes(entry.speciesIndex)){const expected=entry.speciesIndex===121?50:62;assert.equal(entry.serial,expected);assert.equal(entry.displayCode,`MA${expected}`);}else if(entry.numberingStageIndex!==6){assert.equal(entry.serial,native.serial);assert.equal(entry.displayCode,native.displayCode);}
    }else{assert.ok([229,230].includes(entry.speciesIndex));assert.equal(species.records[entry.speciesIndex],undefined);assert.equal(getDatabaseSlot(entry.speciesIndex).bookOrdinal,entry.speciesIndex-13);}
  }
  for(let s=0;s<7;s++)assert.deepEqual(dex.entries.filter(e=>e.numberingStageIndex===s).map(e=>e.serial),Array.from({length:[8,12,14,38,64,51,39][s]},(_,i)=>i+1));
  for(let i=224;i<=228;i++)assert.equal(getDatabaseDisplayEntry(i),null);
  assert.deepEqual([222,230,211,229].map(id=>getDatabaseDisplayEntry(id).displayCode),['UL02','UL03','UL33','UL34']);
  assert.equal(dex.entries.filter(e=>e.numberingStageIndex===6).at(-1).displayCode,'UL39');
  assert.equal(getDatabaseDisplayEntry(19).displayCode,'B106');assert.equal(getDatabaseDisplayEntry(19).legacyBookOrdinal,5);
  assert.deepEqual(dex.entries.filter(e=>e.numberingStageIndex===0).map(e=>e.speciesIndex),openingEggChoices().map(e=>e.speciesIndex));
});

test('archived revision-one identity receipt stays immutable while the explicit product UL projection is separate',()=>{
  // Preserve the original 224-row receipt as source evidence. The approved
  // product-only Ultimate ordering is tested above, never written into this oracle.
  const vector=Array.from({length:224},(_,i)=>{const e=nativeEntries.get(i);assert.ok(e);return [e.entryKey,e.speciesIndex,e.speciesId,e.numberingStageIndex,e.serial,e.displayCode,e.legacyBookOrdinal];});
  assert.equal(createHash('sha256').update(JSON.stringify(vector)).digest('hex'),'121321ce0fad08d324f379c75c6c846f8f24f04bb0ac33eaff834995d2469195');
  const future=[...dex.entries.map(e=>({...e,contentStatus:e.speciesIndex===19?'RETIRED':e.contentStatus})).reverse(),{numberingStageIndex:4,serial:65,displayCode:'MA65'}];
  assert.equal(Math.max(...future.filter(e=>e.numberingStageIndex===4).map(e=>e.serial))+1,66);
  assert.equal(future.find(e=>e.speciesIndex===19).displayCode,'B106');
  assert.equal('MA'+String(100).padStart(2,'0'),'MA100');
  assert.ok(Object.isFrozen(dex.entries[0]));
});

test('eggs stay an untracked content index outside normal registration and selectors',()=>{
  const book=projectDatabase({starterSpeciesId:'species-000'}),before=JSON.stringify(book);
  const rows=databaseDisplayRows(book);
  assert.equal(rows.length,232);assert.equal(book.slotCount,218);assert.equal(book.registeredCount,0);
  assert.ok(rows.filter(e=>e.kind==='EGG').every(e=>e.state==='NOT_TRACKED'&&e.legacyBookOrdinal===null));
  assert.ok(rows.filter(e=>e.kind==='REGULAR').every(e=>e.state==='UNDISCOVERED'));
  assert.throws(()=>getDatabaseSlot(0),/UNKNOWN_DATABASE_SLOT/);
  assert.equal(JSON.stringify(book),before);
});

test('seven filters and five-language labels retain the same codes and shared Awakened terms',()=>{
  const book=projectDatabase({registeredSpecies:[20]}),all=databaseDisplayRows(book);
  try{for(const locale of ['zh-Hant','en','ja','th','vi']){
    setLocale(locale);
    for(let stage=0;stage<7;stage++){
      const rows=databaseDisplayRows(book,stage);assert.ok(rows.every(e=>e.numberingStageIndex===stage));
      assert.deepEqual(rows.map(e=>e.displayCode),all.filter(e=>e.numberingStageIndex===stage).map(e=>e.displayCode));
      assert.ok(generationName(stage));
    }
    for(const key of ['DEX_STAGE','DEX_ALL','DEX_EGG_INDEX'])assert.notEqual(uiText(key),key);
  }}finally{setLocale('zh-Hant');}
});

test('browsing with target registered preserves independent branch history, RNG, IDs and canonical save',async()=>{
  for(const branchHistory of [[],[5],[0]]){
    const save=JSON.parse(fs.readFileSync('qa/championship-full-qa-save.json','utf8'));
    save.progression.registeredSpecies=[8,20];save.raising.nativeHome.evolutionBranches=branchHistory;
    const key='championshipModernSave:v1',map=new Map([[key,JSON.stringify(save)]]);
    const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
    const cages=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json','utf8')).cages;
    const app=createChampionshipStandaloneApp({storage,catalog:species,cages,now:()=>save.updatedAt});
    await app.continueGame();app.save();
    const before=storage.getItem(key),raising=JSON.stringify(app.getRaisingState()),status=JSON.stringify(app.savePort.getStatus());
    app.openDatabase();
    for(let stage=0;stage<7;stage++)databaseDisplayRows(app.getDatabaseFrame(),stage);
    app.selectDatabaseSpecies(20);assert.equal(app.getDatabaseFrame().selected.state,'REGISTERED');
    app.selectDatabaseSpecies(8);assert.equal(app.getDatabaseFrame().selected.state,'REGISTERED');
    const route=app.getDatabaseFrame().selected.evolutionRoutes[0];
    assert.equal(route.targetSpeciesIndex,20);assert.equal(route.legacyBranchOffset,0);
    assert.equal(route.targetRegistered,true);
    assert.equal(route.historyState,branchHistory.includes(0)?'RECORDED':'NOT_RECORDED');
    assert.equal(route.revealed,branchHistory.includes(0));
    assert.deepEqual(app.getRaisingState().nativeHome.evolutionBranches,branchHistory);
    assert.equal(app.getRaisingState().nativeHome.evolutionBranches.includes(0),branchHistory.includes(0),'registration never invents source8 branch0');
    app.selectDatabaseSpecies(null);app.leaveScreen();
    assert.equal(JSON.stringify(app.getRaisingState()),raising);assert.equal(JSON.stringify(app.savePort.getStatus()),status);
    assert.equal(storage.getItem(key),before);assert.deepEqual([...map.keys()],[key]);
    await app.dispose();
  }
});
