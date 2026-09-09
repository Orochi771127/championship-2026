import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {callBattleNative,nativeCallSiteCoverage} from '../src/championship/battle/battleScriptNatives.js';
import { battleVectorQ12, battleAngleQ12, battleAngleIndex } from '../src/championship/battle/battleNativeMath.js';
const receipts=['BATTLE_REMAINING_NATIVES_CPU_2026-09-07','BATTLE_REAL_MOTION_CPU_2026-09-07'];

for(const receipt of receipts)test(receipt+': all remaining 18 native bodies agree with CPU calls, state changes and coordinates',()=>{
  const cpu=JSON.parse(fs.readFileSync(`docs/research/${receipt}.json`,'utf8'));
  assert.equal(new Set(cpu.cases.map(c=>c.address)).size,18);
  for(const sample of cpu.cases){
    const bytes=new Map();
    const write=(at,value,size=4)=>{for(let i=0;i<size;i++)bytes.set(at+i,(value>>>(i*8))&255);};
    const read=(at,size=4)=>{let value=0;for(let i=0;i<size;i++)value|=(bytes.get(at+i)??0)<<(i*8);return value>>>0;};
    for(const [at,value] of sample.initial)write(at,value);
    let calls=[],writes=new Set();
    const host={vmAddress:sample.vmAddress,readU32:(b,o)=>read(b+o),readU16:(b,o)=>read(b+o,2),readU8:(b,o)=>read(b+o,1),
      writeU32:(b,o,v)=>{write(b+o,v);for(let i=0;i<4;i++)writes.add(b+o+i);},writeU8:(b,o,v)=>{write(b+o,v,1);writes.add(b+o);},yield(){},
      call(address,...args){
        if(cpu.nativeMath){
          if(address===0x02003098)return battleAngleIndex(...args);
          if(address===0x02066a40)return battleVectorQ12(...args);
          if(address===0x020669d8)return battleAngleQ12((read(args[1]+4)-read(args[0]+4))|0,(read(args[1])-read(args[0]))|0);
        }
        const result=address===0x02066a40?[Math.floor(args[1]/2),Math.floor(-args[1]/4),0]:sample.settings[address]??3;
        calls.push({address,args,result});return result;
      }};
    for(let i=0;i<sample.frames.length;i++){
      calls=[];writes.clear();const expected=sample.frames[i],label=`${sample.address.toString(16)} args ${sample.args} frame ${i}`;
      assert.equal(callBattleNative(sample.address,sample.args,host),expected.result,label);
      assert.deepEqual(calls,expected.calls,label+' delegates');
      for(const [at,value] of expected.writes)assert.equal(read(at,1),value,label+' byte '+at.toString(16));
      assert.deepEqual([...writes].sort((a,b)=>a-b),expected.writes.map(([at])=>at),label+' exact write set');
    }
  }
});

test('the complete native registry covers all original script call sites',()=>{
  assert.deepEqual(nativeCallSiteCoverage(),{covered:3014,total:3014,implemented:67,natives:67});
});
