import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DATABASE_DISPLAY_CATALOG,getDatabaseDisplayEntry,databaseDisplayRows} from '../src/championship/database/databaseDisplayCatalog.js';
import {DATABASE_ORIGINAL_PROFILES,databaseStory,databaseVerifiedData} from '../src/championship/database/databaseStories.js';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {speciesName} from '../src/championship/text/zhHant.js';
import {setLocale} from '../src/championship/text/locale.js';
import {BATTLE_MOVE_NAMES} from '../src/championship/text/battleMoveNames.js';
import {acceptedDatabasePortraitConfig} from '../src/championship/presentation/acceptedDatabasePortraits.js';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {restoreLegacyIndividual} from './fixtures/championship-legacy-collection.mjs';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
import baseline from './fixtures/database-lion-preservation-20261017.json' with {type:'json'};
import unarmedStoryBefore from './fixtures/dex-unarmed-stories-before-20261018.json' with {type:'json'};
import lifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import rawMoves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type:'json'};

const locales=['zh-Hant','en','ja','th','vi'];
const pathIds=[62,64,121,125,171,182,220];
const savedOffsets=pathIds.flatMap(id=>(lifecycle.rules[id-8]??[]).map((_,i)=>(id-8)*5+i));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('MA50 and MA62 resolve to the approved stable identities, with unique sorted codes in every filter and locale',()=>{
  const expected=[[121,'species-121','MA50','聖焰獅皇'],[125,'species-125','MA62','日焰獅']];
  const book=projectDatabase({registeredSpecies:pathIds});
  assert.equal(new Set(DATABASE_DISPLAY_CATALOG.entries.map(e=>e.displayCode)).size,DATABASE_DISPLAY_CATALOG.entries.length);
  const native=JSON.parse(fs.readFileSync('src/data/championship/database-display.r1.json','utf8'));
  try {for(const locale of locales){setLocale(locale);
    for(const [id,speciesId,code,name] of expected){
      const active=getDatabaseDisplayEntry(id),archived=native.entries.find(e=>e.speciesIndex===id);
      assert.equal(active.speciesId,speciesId);assert.equal(active.displayCode,code);assert.equal(speciesName(id),name);
      for(const key of ['entryKey','speciesIndex','speciesId','numberingStageIndex','legacyBookOrdinal'])assert.equal(active[key],archived[key]);
      assert.equal(DATABASE_ORIGINAL_PROFILES.entries.find(e=>e.speciesIndex===id).displayCode,code);
      assert.equal(databaseDisplayRows(book,4).find(e=>e.displayCode===code).speciesId,speciesId);
    }
    const mature=databaseDisplayRows(book,4);
    assert.deepEqual(mature.map(e=>e.serial),Array.from({length:mature.length},(_,i)=>i+1));
  }}finally{setLocale('zh-Hant');}
});

test('upstream and downstream routes keep their original ordered targets, offsets and conditions',()=>{
  for(const chain of [[64,125,182,220],[62,121,171]]){
    assert.deepEqual(chain.map(id=>getDatabaseDisplayEntry(id).displayCode),chain[0]===64?['GR18','MA62','AW31','UL01']:['GR38','MA50','AW43']);
    for(let i=0;i<chain.length-1;i++){
      const source=chain[i],target=chain[i+1];
      const selected=projectDatabase({registeredSpecies:pathIds,evolutionBranches:savedOffsets,selectedSpeciesIndex:source}).selected;
      const targets=lifecycle.rules[source-8].map(rule=>rule.target);
      assert.deepEqual(selected.evolutionRoutes.map(r=>r.targetSpeciesIndex),targets);
      const route=selected.evolutionRoutes.find(r=>r.targetSpeciesIndex===target);
      assert.ok(route?.revealed);assert.equal(route.legacyBranchOffset,(source-8)*5+targets.indexOf(target));
      assert.ok(route.conditions);assert.equal(route.historyState,'RECORDED');
    }
  }
  // Native extra branches remain valid; this is a label correction, not pruning.
  assert.deepEqual(lifecycle.rules[125-8].map(r=>r.target),[182,171]);
  assert.deepEqual(lifecycle.rules[121-8].map(r=>r.target),[171,177]);
});

test('both five-language profiles describe lions without invented swords, and solar moves no longer imply fists',()=>{
  const swordTerms=/佩刀|名刀|拔刀|劍士|獅子王|sword|blade|Shishio|剣士|名刀|刀を|ดาบ|kiếm|đao/iu;
  const fourFeet=[/四足/,/four paws/,/四つの足/,/สี่เท้า/,/bốn chân/];
  const mechanical=[/機械護甲/,/mechanical armor/,/機械の装甲/,/เกราะกล/,/giáp máy/];
  for(const [i,locale] of locales.entries()){
    assert.match(databaseStory(125,locale),fourFeet[i]);assert.match(databaseStory(121,locale),mechanical[i]);
    for(const id of [121,125])assert.doesNotMatch(databaseStory(id,locale),swordTerms);
    assert.doesNotMatch(databaseVerifiedData(125,locale).moves.map(m=>m.name).join(' '),/拳|Fist|หมัด|Quyền/iu);
    for(const id of [121,125]){
      const originalMoves=rawMoves.records.filter(m=>m.speciesId===id);
      assert.deepEqual(databaseVerifiedData(id,locale).moves.map(m=>[m.recordIndex,m.power,m.actionCost,m.kind]),originalMoves.map(m=>[m.recordIndex,m.power,m.actionCost,m.kind]));
    }
  }
});

test('normal Database component selects corrected codes, navigates both routes and leaves state untouched in five languages',()=>{
  try {for(const locale of locales)for(const [source,target,code,name] of [[64,125,'MA62','日焰獅'],[62,121,'MA50','聖焰獅皇']]){
    const f=makeView({locale,selectedSpeciesIndex:source,registeredSpecies:pathIds,evolutionBranches:savedOffsets,collection:[]});
    try {
      const buttons=f.root.querySelectorAll('.cm-dex-routes__target');
      const button=Array.from(buttons).find(b=>b.getAttribute('aria-label')?.startsWith(code+' · '+name+' · '));
      assert.ok(button);button.click();assert.equal(f.frame().database.selected.speciesIndex,target);
      assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(target,locale));
      assert.match(f.root.querySelector('.cm-dex-routes__source').textContent,new RegExp(code));
      f.assertUnchanged();
    }finally{f.dispose();}
  }}finally{setLocale('zh-Hant');}
});

test('native data stays pinned, separately authorized savev7 is reviewed, the original95 heroes stay intact and only the approved MA62 hero is added',()=>{
  // The later Owner-authorized100-cell save extension supersedes this one source pin only.
  const followup=JSON.parse(fs.readFileSync("docs/contracts/championship/CAGE100_PLAYTEST_20261019.json","utf8"));
  assert.deepEqual(Object.keys(followup.sourceLocks),["src/championship/app/championshipStandaloneSave.js"]);
  // Owner-authorized MA05 replacement preserves the deployed AW40/GR01 trial and all other221 selections;
  // all unrelated native/gameplay pins remain exact. This pins the entire reviewed new file.
  const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  const claritySelection=JSON.parse(fs.readFileSync('src/data/championship/accepted-original-character-selection.r1.json','utf8'));
  const clarityEntities=new Set(['m303_ikkakumon']);
  const unrelatedCharacters=claritySelection.characters.filter(c=>!clarityEntities.has(c.entityId));
  assert.equal(unrelatedCharacters.length,221);assert.equal(hash(JSON.stringify(stable(unrelatedCharacters))),'7db493f46530c65cf896685ba7c2dbe944def17c6a311c5ec6fbc103b8d48eea','All other221 character selections retain exact canonical content');
  const clarityTrialLocks={'src/data/championship/accepted-original-character-selection.r1.json':'d0574afef0b12ad67eb8c0c54f8c0317ddb140bdda5d9df4c6fb6b6ebb468c13'};
  for(const [path,sha256] of Object.entries(baseline.unchangedFiles))assert.equal(hash(fs.readFileSync(path)),followup.sourceLocks[path]??clarityTrialLocks[path]??sha256,path);
  for(const [id,entity] of [[121,'m363_leomon'],[125,'m368_firamon']]){
    assert.equal(acceptedDatabasePortraitConfig(id).entityId,entity);
  }
  const before=JSON.parse(fs.readFileSync('tests/fixtures/database-lion-hero-baseline-20261017.json','utf8'));
  const current=JSON.parse(fs.readFileSync('src/data/championship/database-hero-portraits.r1.json','utf8'));
  assert.equal(current.entries.length,before.entries.length+1);
  for(const entry of before.entries)assert.deepEqual(current.entries.find(e=>e.speciesIndex===entry.speciesIndex),entry);
  assert.equal(databaseHeroPortrait(121),null);
  assert.equal(databaseHeroPortrait(125).displayCode,'MA62');
  assert.equal(current.entries.find(e=>e.speciesIndex===125).sha256,'2b59a46a702490d43d726166b0df35386dbd5016b8c4fa013ae7a0f4ad6454a6');
  const display=JSON.parse(fs.readFileSync('docs/contracts/championship/DATABASE_HERO_DISPLAY_RENDITIONS.v1.json','utf8')).rows.find(e=>e.speciesIndex===125);assert.equal(databaseHeroPortrait(125).sha256,display.display.sha256);assert.equal(display.source.sha256,current.entries.find(e=>e.speciesIndex===125).sha256);
  assert.deepEqual([databaseHeroPortrait(125).width,databaseHeroPortrait(125).height],[864,648]);
});

test('212 unrelated profiles retain exact content with the approved 077/078 copy correction isolated; unrelated move labels remain intact',()=>{
  const unrelatedProfiles=DATABASE_ORIGINAL_PROFILES.entries.filter(e=>![121,125].includes(e.speciesIndex));
  assert.equal(unrelatedProfiles.length,214);
  assert.equal(hash(JSON.stringify(unrelatedProfiles.map(row=>unarmedStoryBefore.entries.find(old=>old.speciesIndex===row.speciesIndex)??row))),baseline.unaffectedProfilesSha256);
  const currentText=fs.readFileSync('src/championship/text/battleMoveNames.js','utf8');
  const exclude=new Set([273,274,285,286,287,288]);
  const unrelated=text=>text.split(/\r?\n/).filter(line=>!exclude.has(Number(/^\s*(\d+):/.exec(line)?.[1]))).join('\n');
  assert.equal(hash(unrelated(currentText)),baseline.unaffectedMoveNamesSha256);
  for(const id of exclude)assert.equal(BATTLE_MOVE_NAMES[id].length,5);
});

test('legacy MA50/MA62 individuals retain stable IDs, nicknames, branch history and canonical save bytes when browsed',async()=>{
  const entries=new Map(),key='championshipModernSave:v1';
  const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};
  const catalog=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json','utf8'));
  const cages=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json','utf8')).cages;
  const create=()=>createChampionshipStandaloneApp({storage,catalog,cages,now:()=> '2026-10-17T00:00:00.000Z'});
  const app=create();let reloaded;
  try {
    await app.newGame();
    for(const id of [121,125])await restoreLegacyIndividual(app,storage,`My lion ${id}`,`species-${id}`);
    assert.equal(app.save().phase,'SAVED');
    const saved=storage.getItem(key),state=JSON.stringify(app.getRaisingState());
    app.openDatabase();
    for(const id of [121,125]){
      app.selectDatabaseSpecies(id);const selected=app.getDatabaseFrame().selected;
      assert.equal(selected.speciesId,`species-${id}`);assert.equal(selected.instances[0].displayName,`My lion ${id}`);
      assert.equal(getDatabaseDisplayEntry(id).displayCode,id===121?'MA50':'MA62');
    }
    app.selectDatabaseSpecies(null);app.leaveScreen();
    assert.equal(JSON.stringify(app.getRaisingState()),state);assert.equal(storage.getItem(key),saved);
    await app.dispose();reloaded=create();await reloaded.continueGame();
    assert.equal(JSON.stringify(reloaded.getRaisingState()),state);assert.equal(storage.getItem(key),saved);
  }finally{await app.dispose();if(reloaded)await reloaded.dispose();}
});

