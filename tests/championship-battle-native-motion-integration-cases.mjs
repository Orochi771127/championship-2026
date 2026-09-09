import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleNativeMemory} from '../src/championship/battle/battleNativeMemory.js';
import {runMoveScript} from '../src/championship/battle/battleMoveScriptRun.js';
import {getBattleCatalogRecord} from '../src/championship/battle/battleCatalogs.js';
import {createNativeMotionReview} from './fixtures/championship-native-motion-host.mjs';
import {createBattlePresentationSource} from '../src/championship/app/battlePresentationSource.js';
import {createBattleSession,createSessionCombatant} from '../src/championship/battle/battleSession.js';
import {createChannelRng} from '../src/championship/battle/battleRngChannel.js';

test('native memory aliases position pointers and mixed byte/halfword fields',()=>{
  const m=createBattleNativeMemory();
  m.writeU32(0x1000,0x24,0x12345678);
  assert.equal(m.readU32(0x1024,0),0x12345678);
  m.writeU8(0x1000,0x25,0xab);
  assert.equal(m.readU16(0x1024,0),0xab78);
  assert.equal(m.readS16(0x1024,0),-21640);
  assert.equal(m.readU32(0x1000,0x24),0x1234ab78);
});

test('the ordinary VM frame consumes supplied memory access instead of an unrelated empty map',()=>{
  const m=createBattleNativeMemory();
  m.writeU32(0x2300000,0xe4,0x2302000);
  const run=runMoveScript({record:getBattleCatalogRecord('moves',337),field:'pointer28',
    inFlightObject:0x2300000,memoryAccess:m,frames:1});
  assert.equal(run.unimplemented.length,0);
  // The actual bytecode reads the owner from frame argument 2, then asks for
  // its actor. It must carry the nonzero address despite the missing graph.
  assert.ok(run.calls.some(c=>c.args.includes(0x2302000)));
});

test('both controlled native motion segments reach recovery through the existing session projection',()=>{
  for(const moveId of [337,455]){
    const review=createNativeMotionReview(moveId);
    const session=createBattleSession({roster:[createSessionCombatant({speciesId:review.move.speciesId,currentHp:100,maxHp:100}),null,null,
      createSessionCombatant({speciesId:81,currentHp:100,maxHp:100}),null,null],rng:createChannelRng(1)});
    const source=createBattlePresentationSource({session,getNativeActor:review.project,step:s=>{s.frame++;review.step();}});
    const before=source.getView(),states=new Set(),requests=[];let minimumAlpha=1,maximumHeight=0;
    for(let i=0;i<100;i++){
      source.tick();const snap=review.snapshot(),view=source.getView();states.add(snap.state);
      minimumAlpha=Math.min(minimumAlpha,view.combatants[0].nativeMotion.alpha);
      maximumHeight=Math.max(maximumHeight,view.combatants[0].nativeMotion.heightNativePx);
      if(snap.request.sequenceInitialFrame && !requests.includes(snap.request.sequenceInitialFrame))requests.push(snap.request.sequenceInitialFrame);
      assert.equal(view.combatants[0].stand.x,snap.positionQ12[0]/4096/416);
      assert.equal(view.combatants[0].hp.current,100,'presentation must not invent contact/damage');
    }
    assert.equal(review.snapshot().complete,true);
    assert.equal(minimumAlpha,0);
    assert.ok(source.getView().combatants[0].stand.x!==before.combatants[0].stand.x);
    assert.deepEqual(requests,[2,3]);
    if(moveId===455)assert.ok(maximumHeight>0);
    assert.equal(source.getView().animationFrame,100);
    source.dispose();
  }
});
