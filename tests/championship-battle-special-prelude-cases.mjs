import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleBattleSpecialPrelude,battleSpecialCamera,battleSpecialPreludeInputs} from '../src/championship/battle/battleSpecialPrelude.js';
import {getBattleCatalogRecord} from '../src/championship/battle/battleCatalogs.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {battleFocusViewport} from '../src/championship/presentation/battleFocusViewport.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));

test('166 original CPU yielded frames match zoom, camera operands, raw pose, hold and return',()=>{
  const cpu=read('docs/research/BATTLE_FOCUS_CPU_2026-09-07.json');
  let count=0;
  for(const c of cpu.cases)for(const expected of c.frames){
    const actual=sampleBattleSpecialPrelude(c.input,expected.frame);
    for(const key of ['sequence','sequenceStart','zoomQ12','cameraEnabled','tintIndex','active'])
      assert.equal(actual[key],expected[key],`${JSON.stringify(c.input)} frame ${expected.frame} ${key}`);
    assert.deepEqual(battleSpecialCamera({ownerX:180*4096,ownerY:120*4096,midX:0,midY:-16*4096,cosQ12:4096,sinQ12:0},actual),expected.camera);
    count++;
  }
  assert.equal(count,166);
});

test('only traced prelude/character combinations bind; durations match current numeric production metadata',()=>{
  for(const [species,entity,moves] of [[50,'m223_toyagumon',[99]],[81,'m313_gargomon',[180,181]],[113,'m353_meramon',[255]]]){
    const animations=read(`assets/production/internal-faithful-baseline/characters-v1/${entity}/runtime.json`).sides.main.animations;
    for(const id of moves){
      const input=battleSpecialPreludeInputs(species,getBattleCatalogRecord('moves',id));
      assert.equal(input.poseTicks,animations.find(a=>a.id===33).frames.reduce((n,f)=>n+f.ticks,0));
      assert.equal(input.returnTicks,animations.find(a=>a.id===input.restoredSequence).frames[0].ticks);
    }
  }
  assert.equal(battleSpecialPreludeInputs(81,getBattleCatalogRecord('moves',179)),null);
  assert.equal(battleSpecialPreludeInputs(0,getBattleCatalogRecord('moves',180)),null);
});

test('normal AI entry plays a complete special prelude without advancing clock, HP or cooldown, then settles',()=>{
  const runtime=createBattleRuntime({schedule:{entryMode:0,scheduleSlotA:2,scheduleSlotB:6,progressCounter:4}});
  runtime.chooseMatch(1);const source=runtime.startMatch();
  const beforeLaunch=source.getView();
  for(let i=0;i<2000&&!source.getView().specialPrelude&&!source.getView().outcome.ended;i++)source.tick();
  const start=source.getView();
  assert.ok(start.specialPrelude);
  const launchedMove=getBattleCatalogRecord('moves',start.specialPrelude.moveId);
  assert.equal(start.specialPrelude.frame,0);
  assert.equal(start.combatants[start.specialPrelude.slot].resource.current,
    beforeLaunch.combatants[start.specialPrelude.slot].resource.current-launchedMove.actionCost,
    'launch charges exactly once before prelude, from current rather than maximum resource');
  // This clock is the current normal-dispatch fixture, not a ROM match trace.
  // Hit interruption/recovery legitimately changes when the AI next commits.
  assert.ok(start.clock.frames>=900);
  const state=view=>view.combatants.map(c=>c.present?[c.hp.current,c.cooldown,c.resource.current,c.status]:null);
  let preludeFrames=0;
  for(let i=1;i<=500&&source.getView().specialPrelude.active;i++){
    source.tick();const view=source.getView();
    assert.equal(view.specialPrelude.frame,i);
    assert.equal(view.combatants[view.specialPrelude.slot].animationRequest.sequenceStartFrame,
      view.specialPrelude.startFrame+view.specialPrelude.sequenceStart,
      'late GPU rendering retains the prelude restore frame rather than the earlier action commit');
    assert.equal(view.clock.frames,start.clock.frames);
    assert.equal(view.animationFrame,start.animationFrame+i);
    assert.deepEqual(state(view),state(start));
    preludeFrames++;
  }
  assert.ok(preludeFrames>0);
  assert.equal(source.getView().specialPrelude.active,false);
  const lockedClock=source.getView().clock.frames;
  const launch=source.getView().nativeLifecycle.active.find(a=>a.moveId===start.specialPrelude.moveId);
  assert.ok(launch,'original C714 completion keeps the action and engagement alive');
  let primaryFrames=0;
  while(source.getView().nativeLifecycle.active.some(a=>a.object===launch.object)&&primaryFrames<1000){
    source.tick();primaryFrames++;
    assert.equal(source.getView().clock.frames,lockedClock,'exclusive attack/auxiliary phase still pauses ordinary clock');
  }
  assert.ok(primaryFrames>0&&primaryFrames<1000);
  source.tick();assert.equal(source.getView().clock.frames,lockedClock+1,'ordinary clock resumes after action disposal');
  for(let i=0;i<16000&&!source.getView().outcome.ended;i++)source.tick();
  assert.equal(source.getView().outcome.ended,true);
  assert.equal(source.getView().specialPrelude,null);
  assert.equal(runtime.getSettlementResult().roundCursor,1);
  runtime.dispose();
});

test('phone focus restores the identity transform; reduced motion never zooms the field',()=>{
  for(const width of [320,390])for(const anchorX of [width*.26,width*.5,width*.74]){
    const args={width,height:width*2/3,anchorX,anchorY:width*.4};
    const end=battleFocusViewport({...args,zoomQ12:4096});
    assert.equal(end.zoom,1);assert.equal(end.x,0);assert.equal(end.y,0);
    const peak=battleFocusViewport({...args,zoomQ12:8192});
    assert.ok(Math.abs(peak.anchorX-width*.5)<1e-10);
    assert.deepEqual(battleFocusViewport({...args,zoomQ12:8192,reducedMotion:true}),end);
  }
});
