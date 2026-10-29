// Owner 2026-10-29: provisional stats, moves and evolution for the 14 art-only identities 231-244.
// The data rides the species authority but stays inert until an entry is ready and wired.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertProductOriginalCatalog,listProductOriginals,getProductOriginal,isPlayableProductOriginal,productOriginalMoves,withReadyProductOriginals} from '../src/championship/contracts/productOriginalSpecies.js';
import {productSpeciesRecord,isKnownSpeciesIndex,productEvolutionOptions,PRODUCT_RAISING_LIFECYCLE_RULES,requiresProductSaveVersion} from '../src/championship/contracts/productSpeciesData.js';
import {getProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
import {getDatabaseIllustration,listDatabaseIllustrations} from '../src/championship/database/databaseIllustrations.js';
import {getDatabaseSlot,listDatabaseSlots} from '../src/championship/database/databaseCatalog.js';
import {normalizeRegisteredSpecies} from '../src/championship/database/nativeBookRegistration.js';
import {databaseVerifiedData} from '../src/championship/database/databaseStories.js';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const catalog=read('src/data/championship/product-species-originals.r1.json');
const proposal=read('docs/planning/roster14-stats-skills-evolution-20261029/PROPOSAL.v1.json');
const lifecycle=read('src/data/championship/catalogs/raising-lifecycle.r1.json');
const ids=[231,232,233,234,235,236,237,238,239,240,241,242,243,244];
const ATTR=['無','疫苗','病毒','資料','自由'],FAM=['無','獸','機械','昆蟲植物','鳥','龍','水','聖','暗黑'];
const clone=value=>structuredClone(value);
// A test-only ready copy: moves bound to placeholder battle records and named in every locale.
const ready=(source,which)=>{const c=clone(source);for(const e of c.entries)if(which.includes(e.speciesIndex)){
  e.runtimeReady=e.evolutionReady=true;
  e.moves.forEach((m,i)=>{m.battleMoveRecord=600+i;for(const k of ['en','ja','th','vi'])m.nameByLocale[k]=m.nameByLocale['zh-Hant'];});
}return c;};

test('the 14 art-only identities carry exactly the reviewed proposal numbers, moves and branches',()=>{
  assert.deepEqual(listProductOriginals().map(e=>e.speciesIndex),ids);
  assert.equal(catalog.authority,'OWNER_APPROVED_PROVISIONAL_ORIGINAL_DATA_20261029');
  for(const s of proposal.species){
    const e=getProductOriginal(s.speciesIndex),art=getDatabaseIllustration(s.speciesIndex);
    assert.equal(e.displayCode,art.displayCode);assert.equal(e.generationIndex,art.numberingStageIndex,'stage matches the Dex identity');
    assert.deepEqual([e.statCurveIndex,ATTR[e.attributeIndex],FAM[Math.log2(e.familyBits)+1]],[s.statCurveIndex,s.attribute,s.family]);
    assert.deepEqual(e.moves.map(m=>[m.nameByLocale['zh-Hant'],m.kind==='MELEE'?'近戰':'射擊',m.power,m.actionCost,m.elementSelect]),s.moves.map(m=>[m.name,m.kind,m.power,m.tp,m.elementSelect]));
    assert.deepEqual(e.evolution.map(r=>[r.target,r.kind,r.thresholds]),s.evolvesTo.map(r=>[r.target,r.kind==='LIFETIME_FALLBACK'?1:0,r.thresholds]));
    assert.deepEqual(productOriginalMoves(s.speciesIndex),e.moves);
  }
  assert.deepEqual(catalog.nativeInserts.map(x=>[x.source,x.position,x.target,x.thresholds]),proposal.nativeInserts.map(x=>[x.source,x.position,x.target,x.thresholds]));
  assert.equal(listDatabaseIllustrations().length,ids.length);
});

test('the species authority answers each original with its own record, but none is known, registrable or playable',()=>{
  assert.equal(listDatabaseSlots().length,218);
  for(const id of ids){
    const record=productSpeciesRecord(id),e=getProductOriginal(id);
    assert.equal(record.recordIndex,id);assert.equal(record.lookupKey,e.entityId);assert.equal(record.statCurveIndex,e.statCurveIndex);
    assert.equal(record.sourceEvidence,'PRODUCT_ORIGINAL_PROVISIONAL');
    assert.equal(isPlayableProductOriginal(id),false);assert.equal(isKnownSpeciesIndex(id),false);assert.equal(getProductExtension(id),null);
    assert.throws(()=>getDatabaseSlot(id),/UNKNOWN_DATABASE_SLOT/);assert.throws(()=>normalizeRegisteredSpecies([id]));
    assert.equal(databaseVerifiedData(id),null,'the Dex keeps showing art only');
    assert.equal(requiresProductSaveVersion({speciesIndex:id}),false);
  }
  // Native evolution, species parameters and product choices are byte-identical while nothing is ready.
  assert.deepEqual(PRODUCT_RAISING_LIFECYCLE_RULES.rules,lifecycle.rules);
  for(const id of ids)assert.equal(PRODUCT_RAISING_LIFECYCLE_RULES.species[id],undefined);
  for(const x of catalog.nativeInserts)assert.deepEqual(productEvolutionOptions(x.source),[x.source]);
  assert.equal(withReadyProductOriginals(lifecycle),lifecycle);
});

test('readiness merges an original and its inserted branches at their exact positions, nothing else',()=>{
  const wolf=[238,239,240,241,242];
  const merged=withReadyProductOriginals(lifecycle,ready(catalog,wolf));
  // Own branches; MA69's fallback to the native AW49 stays, a branch to an unready original would be dropped.
  assert.deepEqual(merged.rules[240-8].map(r=>r.target),[241,178]);
  assert.deepEqual(merged.rules[242-8],[]);
  assert.deepEqual(merged.species[240],{...getProductOriginal(240).lifecycle});
  // B112 gains the thunder pup third, before its fallback; every other native list is untouched.
  assert.deepEqual(merged.rules[18-8].map(r=>r.target),[lifecycle.rules[10][0].target,lifecycle.rules[10][1].target,238,lifecycle.rules[10][2].target]);
  for(let i=0;i<lifecycle.rules.length;i++)if(i!==10)assert.deepEqual(merged.rules[i],lifecycle.rules[i]);
  assert.deepEqual(lifecycle.rules[10].length,3,'the source catalog itself is not mutated');
  // AW45 takes both Rexmon forms third and fourth; with only the battle form ready it moves up to third.
  const both=withReadyProductOriginals(lifecycle,ready(catalog,[243,244]));
  assert.deepEqual(both.rules[173-8].map(r=>r.target),[...lifecycle.rules[165].map(r=>r.target),243,244]);
  const battleOnly=withReadyProductOriginals(lifecycle,ready(catalog,[244]));
  assert.deepEqual(battleOnly.rules[173-8].map(r=>r.target),[...lifecycle.rules[165].map(r=>r.target),244]);
  // First-position inserts (star boar into B205) come before every existing branch.
  const boar=withReadyProductOriginals(lifecycle,ready(catalog,[231]));
  assert.deepEqual(boar.rules[23-8].map(r=>r.target),[231,...lifecycle.rules[15].map(r=>r.target)]);
  assert.deepEqual(boar.rules[231-8].map(r=>r.target),[],'GR39 to MA65 waits until MA65 is ready too');
});

test('the catalog refuses identities, numbers or branches the engine cannot carry',()=>{
  const bad=mutate=>{const c=clone(catalog);mutate(c);return ()=>assertProductOriginalCatalog(c);};
  assert.doesNotThrow(()=>assertProductOriginalCatalog(clone(catalog)));
  assert.throws(bad(c=>{c.entries[1].speciesIndex=231;c.entries[1].speciesId='species-231';}),/PRODUCT_ORIGINAL_IDENTITY/);
  assert.throws(bad(c=>{c.entries[0].statCurveIndex=27;}),/PRODUCT_ORIGINAL_RECORD/);
  assert.throws(bad(c=>{c.entries[0].familyBits=3;}),/PRODUCT_ORIGINAL_RECORD/);
  assert.throws(bad(c=>{c.entries[0].lifecycle.family=2;}),/PRODUCT_ORIGINAL_LIFECYCLE/);
  assert.throws(bad(c=>{c.entries[0].moves[0].kind='RANGED';}),/PRODUCT_ORIGINAL_FIRST_MOVE/);
  assert.throws(bad(c=>{c.entries[0].moves.push(...c.entries[1].moves,...c.entries[2].moves);}),/PRODUCT_ORIGINAL_MOVES|PRODUCT_ORIGINAL_MOVE/);
  assert.throws(bad(c=>{c.entries[0].evolution[0].target=233;}),/PRODUCT_ORIGINAL_EVOLUTION/,'growth cannot skip to awakened');
  assert.throws(bad(c=>{c.entries[0].evolution[0].thresholds.pop();}),/PRODUCT_ORIGINAL_EVOLUTION/);
  assert.throws(bad(c=>{c.nativeInserts[0].position=9;}),/PRODUCT_ORIGINAL_INSERT/);
  assert.throws(bad(c=>{c.nativeInserts.push({...c.nativeInserts[6],position:5},{...c.nativeInserts[6],position:1,target:244});}),/PRODUCT_ORIGINAL_INSERT/);
  assert.throws(bad(c=>{c.entries[0].evolutionReady=true;}),/PRODUCT_ORIGINAL_READINESS/);
  assert.throws(bad(c=>{c.entries[0].runtimeReady=true;}),/PRODUCT_ORIGINAL_NOT_BOUND/,'ready needs bound battle moves and five-locale names');
  assert.doesNotThrow(()=>assertProductOriginalCatalog(ready(catalog,ids)));
});
