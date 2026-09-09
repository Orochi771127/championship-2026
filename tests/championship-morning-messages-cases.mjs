import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectNativeMorningMessages,createNativeRaisingMessages,enqueueNativeRaisingMessage,
  openNativeRaisingMessage,ageNativeRaisingMessages,closeNativeRaisingMessage} from '../src/championship/raising/nativeRaisingMessages.js';
const cpu=JSON.parse(readFileSync(new URL('../docs/research/MORNING_MESSAGES_CPU_CHECK_2026-09-09.json',import.meta.url)));
test('1200 morning CPU vectors preserve letter order, cursor and RNG call sequence',()=>{
  for(const [i,v] of cpu.vectors.entries()){
    const draws=[];const r=selectNativeMorningMessages(v.input,{next(c){draws.push(c);return v.input.random[c];}});
    let s=createNativeRaisingMessages();for(const id of r.ids)s=enqueueNativeRaisingMessage(s,id);
    const queue=s.queue.map(q=>[q.system?0:1,q.sender,q.textId,q.minutes,q.required?1:0,q.effectId,0]);
    assert.deepEqual({cursor:r.cursor,draws,selected:r.selected,queue},v.output,`CPU morning ${i}`);
  }
});
test('mail cap, lifetime and acknowledgement retain the original queue behavior',()=>{
  let s=createNativeRaisingMessages();for(let i=3;i<8;i++)s=enqueueNativeRaisingMessage(s,i);
  assert.equal(s.queue.length,4);s=openNativeRaisingMessage(s);s=ageNativeRaisingMessages(s,361);
  assert.equal(s.queue.length,1);assert.equal(s.queue[0].opened,true);s=closeNativeRaisingMessage(s);assert.equal(s.queue.length,0);
});
