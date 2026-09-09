import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createOpeningStoryState,advanceOpeningStory,openingStoryProjection,openingStoryTrajectory} from '../src/championship/app/nativeOpeningStory.js';
const receipt=JSON.parse(readFileSync(new URL('../docs/research/OPENING_STORY_CPU_CHECK_2026-09-09.json',import.meta.url)));
test('opening cards match every frame of the original controller for automatic and touch-release paths',()=>{
  for(const c of receipt.cases){
    const s=createOpeningStoryState(),releases=new Set(c.releaseFrames),rows=[openingStoryProjection(s)];
    while(!s.done&&s.frame<3000){advanceOpeningStory(s,releases.has(s.frame+1));rows.push(openingStoryProjection(s));}
    assert.equal(s.frame,c.frames,c.name);
    for(const checkpoint of c.checkpoints)assert.deepEqual(rows[checkpoint[0]],checkpoint,`${c.name} frame ${checkpoint[0]}`);
    assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),c.sha256,c.name);
  }
});
test('presentation trajectory can resume at a released card without mutating its caller',()=>{
  const s=createOpeningStoryState();for(let i=0;i<100;i++)advanceOpeningStory(s);
  const before=structuredClone(s);const slow=openingStoryTrajectory(s);assert.deepEqual(s,before);
  advanceOpeningStory(s,true);const fast=openingStoryTrajectory(s);
  assert.ok(fast.length<slow.length);assert.ok(fast.at(-1).done);
  const ended=structuredClone(fast.at(-1));advanceOpeningStory(ended,true);assert.deepEqual(ended,fast.at(-1));
});
