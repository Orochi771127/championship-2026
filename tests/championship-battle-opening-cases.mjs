import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleOpeningPhase, BATTLE_OPENING_TIMING} from '../src/championship/battle/battleOpeningPhase.js';
import {battleOpeningText} from '../src/championship/text/battleOpeningText.js';
import {setLocale} from '../src/championship/text/locale.js';


test('unarmed baseline is immediately active; prepare/ready are idempotent',()=>{
 const phase=createBattleOpeningPhase();assert.equal(phase.advance(),true);
 phase.prepare();assert.equal(phase.snapshot().phase,'WAITING_ASSETS');
 for(let i=0;i<1000;i++)assert.equal(phase.advance(),false);
 assert.equal(phase.snapshot().ticks,0);phase.ready();phase.advance();
 const before=phase.snapshot();phase.prepare();phase.ready();assert.deepEqual(phase.snapshot(),before);
 assert.equal('skip' in phase,false);assert.equal('reset' in phase,false);assert.equal('pause' in phase,false);
});
test('every default tick has an explicit phase and combat release; no 83-tick HUD shortcut',()=>{
 const p=createBattleOpeningPhase();p.prepare();p.ready();const rows=[];
 for(let tick=1;tick<=149;tick++){
  const before=p.snapshot(),combat=p.advance(),after=p.snapshot();
  rows.push({tick,before:before.phase,beforeTicks:before.ticks,beforeRemaining:before.remaining,after:after.phase,afterTicks:after.ticks,afterRemaining:after.remaining,combat});
  assert.equal(combat,tick>=148);
  assert.equal(after.phase,tick<86?'READY':tick<147?'FIGHT':'ACTIVE');
 }
});
test('custom durations, quiet pause by no tick, dispose blocks any further advance',()=>{
 const p=createBattleOpeningPhase({readyTicks:2,fightTicks:3});p.prepare();p.ready();
 const saved=p.snapshot();for(let i=0;i<20;i++)assert.deepEqual(p.snapshot(),saved);
 assert.deepEqual(Array.from({length:6},()=>p.advance()),[false,false,false,false,false,true]);
 p.prepare();assert.equal(p.snapshot().phase,'ACTIVE');p.dispose();assert.equal(p.advance(),false);p.ready();
 assert.equal(p.snapshot().phase,'ACTIVE');
 for(const bad of [0,-1,1.1,NaN,Infinity])assert.throws(()=>createBattleOpeningPhase({readyTicks:bad}));
});
test('both cues use all five existing UI locale choices; locale never advances phase',()=>{
 const p=createBattleOpeningPhase();p.prepare();p.ready();const frozen=p.snapshot();
 for(const locale of ['zh-Hant','en','ja','th','vi']){
  setLocale(locale);assert.ok(battleOpeningText('READY'));assert.ok(battleOpeningText('FIGHT'));
  assert.equal(battleOpeningText(null),'');assert.deepEqual(p.snapshot(),frozen);
 }
 setLocale('zh-Hant');
});

import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createChannelRng} from '../src/championship/battle/battleRngChannel.js';
const plain=value=>JSON.parse(JSON.stringify(value));
const strip=view=>{const {opening,...rest}=view;return rest};
function fixture(seed=20){
 const rng=createChannelRng(seed);let calls=0;const next=rng.next;rng.next=ch=>{calls++;return next(ch)};
 const runtime=createBattleRuntime({mode:0,rng});runtime.chooseChampionshipRound({category:0,teamIndex:1});
 return {runtime,source:runtime.startMatch(),rng,calls:()=>calls};
}
test('integrated opening holds real native state, clock, AI and all RNG channels through 147 ticks',()=>{
 const control=fixture(),candidate=fixture();candidate.runtime.prepareOpening();
 const initial=strip(control.source.getView()),diag=control.runtime.getPersonalityDiagnostics(),rng=control.rng.snapshot();
 for(let i=0;i<30;i++)candidate.source.tick();assert.equal(candidate.runtime.getOpening().phase,'WAITING_ASSETS');
 candidate.runtime.markOpeningReady();
 for(let tick=1;tick<=147;tick++){
  const out=candidate.source.tick();assert.equal(out.frame,0);assert.deepEqual(out.events,[]);
  assert.deepEqual(strip(candidate.source.getView()),initial,`view tick ${tick}`);
  assert.deepEqual(candidate.runtime.getPersonalityDiagnostics(),diag,`AI tick ${tick}`);
  assert.deepEqual(candidate.rng.snapshot(),rng,`RNG tick ${tick}`);assert.equal(candidate.calls(),control.calls());
 }
 assert.deepEqual(plain(candidate.source.tick()),plain(control.source.tick()));
 assert.deepEqual(strip(candidate.source.getView()),strip(control.source.getView()));
 assert.deepEqual(candidate.rng.snapshot(),control.rng.snapshot());
 candidate.runtime.prepareOpening();candidate.runtime.markOpeningReady();assert.equal(candidate.runtime.getOpening().phase,'ACTIVE');
 candidate.runtime.dispose();const before=candidate.calls();candidate.source.tick();assert.equal(candidate.calls(),before);control.runtime.dispose();
});
test('late opening arm is refused and new ordinary runtime has independent opening lifecycle',()=>{
 const first=fixture();first.source.tick();assert.throws(()=>first.runtime.prepareOpening(),/OPENING_ALREADY_ACTIVE/);first.runtime.dispose();
 const next=fixture();assert.equal(next.runtime.getOpening().armed,false);next.runtime.prepareOpening();assert.equal(next.runtime.getOpening().phase,'WAITING_ASSETS');next.runtime.dispose();
});
