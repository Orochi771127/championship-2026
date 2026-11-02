// Owner-approved provisional data (2026-10-29) for original identities: species record fields, moves and
// ordered evolution branches. Attributes and fine settings will be revised for every character later.
// An entry takes effect only when runtimeReady and evolutionReady (Owner 2026-11-03: the ones with motion
// art); the rest stay art-only Dex entries and are left out of registration, capture, battle and evolution.
// A ready entry keeps its own record, lifecycle, moves and branches; tables traced from the cartridge that
// have no row for it (cage reactions, walk flags, battle eligibility rows) read its behaviorDonor's row.
import catalog from '../../data/championship/product-species-originals.r1.json' with {type:'json'};
import battleMoves from '../../data/championship/catalogs/battle-moves.r1.json' with {type:'json'};
import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import statCurve from '../../data/championship/catalogs/creature-stat-curve.r1.json' with {type:'json'};
import nativeLifecycle from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {deepFreeze} from './championshipContracts.js';

const LOCALES=['zh-Hant','en','ja','th','vi'];
const MOVE_KIND=Object.freeze({MELEE:0,RANGED:1});
const int=(v,min,max=Infinity)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const thresholdsOk=t=>Array.isArray(t)&&t.length===26&&t.every(v=>int(v,0));

// Validates a catalog against the native tables; the game loads only a catalog that passes.
export function assertProductOriginalCatalog(source,{species=nativeSpecies.records,curveRows=statCurve.rows,rules=nativeLifecycle.rules,moves=battleMoves.records}={}){
  const fail=code=>{throw new Error('PRODUCT_ORIGINAL_'+code);};
  const byIndex=new Map(),entities=new Set(),moveRecords=new Set();
  for(const e of source.entries){
    if(!int(e.speciesIndex,231)||e.speciesId!==`species-${e.speciesIndex}`||byIndex.has(e.speciesIndex)
      ||!/^oc_[a-z0-9_]+$/.test(e.entityId)||entities.has(e.entityId))fail('IDENTITY');
    if(!int(e.generationIndex,1,6)||!int(e.statCurveIndex,0,curveRows.length-1)||!int(e.attributeIndex,0,4)
      ||!int(e.familyBits,1,255)||(e.familyBits&(e.familyBits-1))!==0||!int(e.huntClassByte,0,255)||!int(e.generationScaledByte,0,255))fail('RECORD');
    const l=e.lifecycle;
    if(!l||!int(l.sleepMin,1)||!int(l.sleepMax,l.sleepMin)||!int(l.life,1)||!int(l.capacity,1)||l.family!==e.familyBits)fail('LIFECYCLE');
    if(!Array.isArray(e.moves)||e.moves.length<1||e.moves.length>4)fail('MOVES');
    const keys=new Set();
    e.moves.forEach((m,i)=>{
      if(!/^oc_[a-z0-9_]+$/.test(m.moveKey)||keys.has(m.moveKey)||!['MELEE','RANGED'].includes(m.kind)||!int(m.power,1)||!int(m.actionCost,0)
        ||!int(m.elementSelect,0,5)||!int(m.statusCode,0)||!int(m.targetMode,0,1)||typeof m.nameByLocale?.['zh-Hant']!=='string'||!m.nameByLocale['zh-Hant'].trim())fail('MOVE');
      if(i===0&&(m.kind!=='MELEE'||m.power!==100||m.actionCost!==0))fail('FIRST_MOVE');
      keys.add(m.moveKey);
    });
    if(typeof e.runtimeReady!=='boolean'||typeof e.evolutionReady!=='boolean'||(e.evolutionReady&&!e.runtimeReady))fail('READINESS');
    // Move records continue after the cartridge's table; ids are stable for every entry, ready or not.
    for(const m of e.moves){if(!int(m.battleMoveRecord,moves.length)||moveRecords.has(m.battleMoveRecord))fail('MOVE_RECORD');moveRecords.add(m.battleMoveRecord);}
    // Ready means the battle lane and every locale can carry the entry; otherwise it stays data only. A ready
    // move borrows a native move of its kind for timing and effect banks; its own numbers replace the donor's.
    if(e.runtimeReady&&e.moves.some(m=>!int(m.donorMoveRecord,1,moves.length-1)||moves[m.donorMoveRecord].kind!==MOVE_KIND[m.kind]
      ||LOCALES.some(k=>typeof m.nameByLocale[k]!=='string'||!m.nameByLocale[k].trim())))fail('NOT_BOUND');
    // The behavior donor is a native species of the same stage and race.
    const donor=species[e.behaviorDonor];
    if(e.runtimeReady&&(!int(e.behaviorDonor,8,223)||donor?.recordIndex!==e.behaviorDonor||donor.generationIndex!==e.generationIndex||donor.familyBits!==e.familyBits))fail('BEHAVIOR_DONOR');
    byIndex.set(e.speciesIndex,e);entities.add(e.entityId);
  }
  const generation=i=>byIndex.get(i)?.generationIndex??species[i]?.generationIndex;
  const nextStage=(from,to)=>generation(to)===generation(from)+1;
  for(const e of byIndex.values()){
    if(!Array.isArray(e.evolution)||e.evolution.length>5)fail('EVOLUTION');
    for(const r of e.evolution)if(![0,1].includes(r.kind)||!thresholdsOk(r.thresholds)||generation(r.target)===undefined||r.target===228||!nextStage(e.speciesIndex,r.target))fail('EVOLUTION');
  }
  // position is the 1-based place in the source's final list once all of its inserts apply.
  const added=new Map();
  for(const x of source.nativeInserts)added.set(x.source,[...(added.get(x.source)??[]),x.position]);
  for(const x of source.nativeInserts){
    const list=rules[x.source-8],total=(list?.length??0)+added.get(x.source).length;
    if(!int(x.source,8,223)||!Array.isArray(list)||!byIndex.has(x.target)||!nextStage(x.source,x.target)
      ||![0,1].includes(x.kind)||!thresholdsOk(x.thresholds)||!int(x.position,1,total))fail('INSERT');
    if(new Set(added.get(x.source)).size!==added.get(x.source).length)fail('INSERT');
    if(total>5)fail('INSERT_BRANCH_LIMIT');
  }
  return byIndex;
}

const byIndex=assertProductOriginalCatalog(catalog);
export const PRODUCT_ORIGINAL_SPECIES=deepFreeze(catalog);
export function getProductOriginal(index){return byIndex.get(index)??null;}
export function listProductOriginals(){return [...byIndex.values()];}
export function isPlayableProductOriginal(index){const e=byIndex.get(index);return Boolean(e?.runtimeReady&&e.evolutionReady);}
// Same shape as a native creature-species record, with its own identity.
export function productOriginalSpeciesRecord(index){
  const e=byIndex.get(index);
  return e?{recordIndex:e.speciesIndex,statCurveIndex:e.statCurveIndex,identifier:e.entityId.toUpperCase(),generationIndex:e.generationIndex,
    attributeIndex:e.attributeIndex,familyBits:e.familyBits,lookupKey:e.entityId,generationScaledByte:e.generationScaledByte,
    huntClassByte:e.huntClassByte,sourceEvidence:'PRODUCT_ORIGINAL_PROVISIONAL'}:null;
}
export function productOriginalMoves(index){return byIndex.get(index)?.moves??null;}
/** The native species whose traced per-species rows a playable original reads, or null. */
export function productOriginalBehaviorDonor(index){return isPlayableProductOriginal(index)?byIndex.get(index).behaviorDonor:null;}

// Battle move records of the playable originals: the donor record's timing and effect banks with the
// original's own owner, kind, power, cost, element, status and target. Ids continue after the native table.
const moveRecordsById=new Map(),moveNamesById=new Map();
for(const e of byIndex.values())if(isPlayableProductOriginal(e.speciesIndex))for(const m of e.moves){
  moveRecordsById.set(m.battleMoveRecord,deepFreeze({...battleMoves.records[m.donorMoveRecord],recordIndex:m.battleMoveRecord,speciesId:e.speciesIndex,
    kind:MOVE_KIND[m.kind],power:m.power,actionCost:m.actionCost,elementSelect:m.elementSelect,statusCode:m.statusCode,targetMode:m.targetMode,
    productDonorRecord:m.donorMoveRecord}));
  moveNamesById.set(m.battleMoveRecord,Object.freeze(LOCALES.map(k=>m.nameByLocale[k])));
}
/** A playable original's battle move record by id, or null. */
export function productOriginalMoveRecord(id){return moveRecordsById.get(id)??null;}
/** Every playable original's battle move record, in id order. */
export function listProductOriginalMoveRecords(){return [...moveRecordsById.values()];}
/** [zh-Hant, en, ja, th, vi] names of the playable originals' moves, keyed by record id. */
export function productOriginalMoveNames(){return Object.fromEntries(moveNamesById);}

// The lifecycle tables the raising engine reads, with ready originals merged in: their own species
// parameters and ordered branches, plus branches inserted into native sources at their positions.
// With no ready entry the native tables are returned unchanged.
export function withReadyProductOriginals(lifecycle,source=catalog){
  const entries=source===catalog?listProductOriginals():[...assertProductOriginalCatalog(source,{rules:lifecycle.rules}).values()];
  const ready=new Set(entries.filter(e=>e.runtimeReady&&e.evolutionReady).map(e=>e.speciesIndex));
  if(!ready.size)return lifecycle;
  const species={...lifecycle.species},rules=[...lifecycle.rules];
  for(const e of entries)if(ready.has(e.speciesIndex)){
    const {sleepMin,sleepMax,life,capacity,family}=e.lifecycle;
    species[e.speciesIndex]={sleepMin,sleepMax,life,capacity,family};
    rules[e.speciesIndex-8]=e.evolution.filter(r=>ready.has(r.target)||!byIndexOf(entries,r.target)).map(({target,kind,thresholds})=>({target,kind,thresholds:[...thresholds]}));
  }
  // Ascending positions rebuild the final order; a missing (unready) earlier insert just shifts later ones up.
  const inserts=source.nativeInserts.filter(x=>ready.has(x.target)).sort((a,b)=>a.source-b.source||a.position-b.position);
  for(const x of inserts){
    const list=[...rules[x.source-8]];list.splice(x.position-1,0,{target:x.target,kind:x.kind,thresholds:[...x.thresholds]});rules[x.source-8]=list;
  }
  return {...lifecycle,species,rules};
}
const byIndexOf=(entries,index)=>entries.some(e=>e.speciesIndex===index);
