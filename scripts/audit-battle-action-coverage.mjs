// Static, exhaustive inventory. Reachability proves dependencies, not that a
// match reaches every branch. No private art is imported into the product.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {battleScriptBlob,BATTLE_SCRIPT_BLOB_ORIGIN,rewriteMoveScriptPointers} from '../src/championship/battle/battleMoveScriptRun.js';
import {decodeBattleScriptInstruction} from '../src/championship/battle/battleScriptVm.js';
import {isBattleNativeImplemented,nativeCallSiteCoverage} from '../src/championship/battle/battleScriptNatives.js';
import {battleSpecialPreludeInputs} from '../src/championship/battle/battleSpecialPrelude.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../src/data/championship/battleCharacterProfiles.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const moves=read('src/data/championship/catalogs/battle-moves.r1.json');
const blob=battleScriptBlob(),cache=new Map();
function reachable(entry){
  if(!entry)return {instructions:0,natives:[]};
  if(cache.has(entry))return cache.get(entry);
  const visited=new Set(),natives=new Set(),queue=[entry];
  while(queue.length){
    const pc=queue.pop();if(visited.has(pc))continue;
    assert.ok(pc>=BATTLE_SCRIPT_BLOB_ORIGIN && pc<BATTLE_SCRIPT_BLOB_ORIGIN+blob.length);
    visited.add(pc);const ins=decodeBattleScriptInstruction(blob,pc,BATTLE_SCRIPT_BLOB_ORIGIN);
    if(ins.code===0x32)natives.add(ins.operand);
    if(ins.target!==undefined)queue.push(ins.target);
    if(![0x28,0x33].includes(ins.code))queue.push(pc+ins.bytes);
  }
  const result={instructions:visited.size,natives:[...natives].sort((a,b)=>a-b)};
  cache.set(entry,result);return result;
}
const rows=moves.records.map(move=>{
  const entityId=BATTLE_SPECIES_ENTITIES[move.speciesId],profile=BATTLE_CHARACTER_PROFILES[entityId];
  assert.ok(profile,`species ${move.speciesId}`);
  const pointers=rewriteMoveScriptPointers(move);
  const columns=['pointer1C','pointer28','pointer3C'].map(field=>({field,address:pointers[field],...reachable(pointers[field])}));
  const natives=[...new Set(columns.flatMap(c=>c.natives))].sort((a,b)=>a-b);
  const unknownNatives=natives.filter(a=>!isBattleNativeImplemented(a));
  // Records without a primary script are not ordinary species attacks:
  // 02113E0C..02113E48 also
  // appends records indexed by creature +12C/+130 to the caller's move list.
  // Their animation belongs to that caller. Do not infer the caller from the
  // table's reserved species value or report a missing egg attack as geometry.
  const callerRequired=!move.pointer28;
  return {moveId:move.recordIndex,speciesId:move.speciesId,entityId:callerRequired?null:entityId,rawAttackSequence:callerRequired?null:move.field10+7,
    animationSpeciesSource:move.recordIndex===0?'SOURCE_SENTINEL_NO_ACTION':callerRequired?'CALLER_REQUIRED_NO_PRIMARY_SCRIPT':'RECORD_SPECIES',
    attackSequenceAvailable:callerRequired?null:profile.sequences.some(s=>s.id===move.field10+7),
    specialPrelude:battleSpecialPreludeInputs(move.speciesId,move),
    // Encoded selectors are retained. Never infer a model from element/name.
    encodedEffectSelectors:{field24:move.field24??0,field30:move.field30??0,field36:move.field36??0,field44:move.field44??0},
    columns,nativeBodyCoverage:{required:natives.length,implemented:natives.length-unknownNatives.length,unknownNatives},
    runtimeStatus:move.recordIndex===0?'SOURCE_SENTINEL_NO_ACTION':'PARTIAL_OBJECT_GRAPH_LAUNCH_AND_EFFECT_BINDINGS',
    normalGameplayAccepted:false};
});
const report={schemaVersion:1,date:'2026-09-07',kind:'EXHAUSTIVE_STATIC_BATTLE_ACTION_COVERAGE',
  romSha256:moves.rom.sha256,scriptSha256:createHash('sha256').update(blob).digest('hex'),
  sourceHashes:Object.fromEntries(['src/championship/battle/battleScriptNatives.js','src/championship/battle/battleMoveScriptRun.js',
    'src/championship/battle/battleRemainingNatives.js','src/championship/battle/battleNativeMath.js',
    'src/data/championship/battleNativeMathTables.js',
    'src/data/championship/battleCharacterProfiles.js'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),
  summary:{moveRecords:rows.length,sourceSentinelRecords:1,nonSentinelRecords:rows.length-1,
    speciesBindings:BATTLE_SPECIES_ENTITIES.length,entityAssets:Object.keys(BATTLE_CHARACTER_PROFILES).length,
    regularEntities:Object.keys(BATTLE_CHARACTER_PROFILES).filter(id=>id.startsWith('m')).length,eggEntities:8,
    rawMainSequences:Object.values(BATTLE_CHARACTER_PROFILES).reduce((n,p)=>n+p.sequences.length,0),
    mainCells:Object.values(BATTLE_CHARACTER_PROFILES).reduce((n,p)=>n+Object.keys(p.cells).length,0),
    specialPreludeRecords:rows.filter(r=>r.specialPrelude).length,
    specialPreludeSpecies:new Set(rows.filter(r=>r.specialPrelude).map(r=>r.speciesId)).size,
    callerSpeciesRequiredRecords:rows.filter(r=>r.animationSpeciesSource==='CALLER_REQUIRED_NO_PRIMARY_SCRIPT').map(r=>r.moveId),
    missingAttackSequenceRecords:rows.filter(r=>r.attackSequenceAvailable===false).map(r=>r.moveId),
    nativeBodies:nativeCallSiteCoverage(),normalGameplayAcceptedRecords:0},
  boundaries:['All registered baseline Main frames bind; automatic appearance replacements retain their independent geometry guard.',
    'A raw sequence existing is not proof of its gameplay trigger. Conditional notification entries have a separate CPU receipt.',
    'All 596 records are inventoried, including the zero sentinel and special/carry records. They are not all ordinary species attacks.',
    'Static call dependencies include alternate branches. Translated native bodies can still require unbound engine helpers.',
    'Full approach/launch/return states, per-action effect resource pools, auxiliary VM ownership and normal-path party selection remain partial.',
    'No original pixels are copied, no production approvals are changed, and this report is not shipping acceptance.'],rows};
const target='docs/research/BATTLE_ALL_ACTIONS_COVERAGE_2026-09-07.json';
const output=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),output);else fs.writeFileSync(target,output);
console.log(JSON.stringify(report.summary,null,2));
