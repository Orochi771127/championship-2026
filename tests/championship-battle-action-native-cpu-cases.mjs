import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {callBattleNative} from '../src/championship/battle/battleScriptNatives.js';
import {rewriteMoveScriptPointers,runMoveScript} from '../src/championship/battle/battleMoveScriptRun.js';
import {getBattleCatalogRecord} from '../src/championship/battle/battleCatalogs.js';
import {BATTLE_SPECIES_MOVEMENT} from '../src/data/championship/battleCharacterProfiles.js';
const cpu=JSON.parse(fs.readFileSync('docs/research/BATTLE_ACTION_NATIVES_CPU_2026-09-07.json','utf8'));

test('all 228 species preserve actual ARM9 soft-float movement helper results',()=>{
  assert.equal(cpu.speciesSpeeds.length,228);
  for(const s of cpu.speciesSpeeds)assert.deepEqual(BATTLE_SPECIES_MOVEMENT[s.speciesId],{walkQ12:s.walkQ12,runQ12:s.runQ12});
});

test('90 original CPU actor-native cases agree on returned values, writes and delegated animation calls',()=>{
  assert.equal(cpu.cases.length,90);
  for(const sample of cpu.cases){
    const memory=new Map(),calls=[];
    const write=(base,off,value,size)=>{for(let i=0;i<size;i++)memory.set(base+off+i,(value>>>(i*8))&255);};
    const read=(base,off,size)=>{let value=0;for(let i=0;i<size;i++)value|=(memory.get(base+off+i)??0)<<(i*8);return value>>>0;};
    for(const [base,off,value] of sample.memory)write(base,off,value,4);
    const host={readU32:(b,o)=>read(b,o,4),readU16:(b,o)=>read(b,o,2),readU8:(b,o)=>read(b,o,1),
      readS16:(b,o)=>(read(b,o,2)<<16)>>16,writeU32:(b,o,v)=>write(b,o,v,4),writeU8:(b,o,v)=>write(b,o,v,1),
      call:(address,...args)=>{calls.push({address,args});return sample.helperValue;},yield(){}};
    const label=sample.address.toString(16)+' '+JSON.stringify(sample.args);
    assert.equal(callBattleNative(sample.address,sample.args,host),sample.result,label);
    assert.deepEqual(calls,sample.calls,label);
    for(const [base,off,value] of sample.writes)assert.equal(host.readU32(base,off),value,label+` write ${base}:${off}`);
  }
});

test('the original DS square-root boundary stays Q12 for all fourteen CPU samples',()=>{
  const host={readU32(){},readU8(){},writeU32(){},writeU8(){},call(){},yield(){}};
  for(const sample of cpu.sqrt)assert.equal(callBattleNative(0x0211e2c4,[sample.input],host),sample.result,String(sample.input));
});

test('all 64 CPU launch pointer combinations include the field0C=2 reverse branch',()=>{
  for(const sample of cpu.rewrites){
    const output=rewriteMoveScriptPointers(sample);
    assert.equal(output.pointer1C,sample.result1C,JSON.stringify(sample));
    assert.equal(output.pointer28,sample.result28,JSON.stringify(sample));
  }
});

test('resumed VM calls use this frame host and report this frame diagnostics',()=>{
  const state={},record=getBattleCatalogRecord('moves',1),memory=new Map();
  const results=[];let frame=0;
  for(;frame<10;frame++)results.push(runMoveScript({record,field:'pointer3C',frames:1,state,memory,
    pointer0:0x1000,pointer1:0x2000,callNative(){return frame===0?0:undefined;}}));
  assert.ok(results.slice(1).some(r=>r.calls.length>0),'resume must not append calls into the closed first-frame result');
  assert.ok(results.slice(1).every(r=>r.resumed),'same invocation resumes rather than restarting');
});
