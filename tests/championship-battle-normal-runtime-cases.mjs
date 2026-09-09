import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNormalBattle} from '../scripts/audit-battle-normal-flow.mjs';
import {getBattleCatalogRecord} from '../src/championship/battle/battleCatalogs.js';

test('R9 normal scheduled match: native ready stands, approach before launch, repeated attacks and complete cleanup',()=>{
 const s=auditNormalBattle({match:0,seed:20});
 assert.deepEqual(s.initial.filter(Boolean).map(x=>x.point),[[128,108,0],[128,188,0],[304,148,0]].map(p=>p.map(x=>x*4096)));
 assert.ok(s.initial.filter(Boolean).every(x=>x.ownerLock===0&&x.launches.every(a=>a===null)));
 const changes=s.normalEvents.filter(e=>e.type==='STATE_CHANGED');
 assert.ok(changes.some(e=>e.from===4&&e.to===14));
 const launches=s.normalEvents.filter(e=>e.type==='LAUNCHED');
 assert.ok(launches.length>10,'successful release permits repeated normal AI attacks');
 for(const launch of launches){
  const approach=s.normalEvents.find(e=>e.slot===launch.slot&&e.type==='SELECTED'&&e.state===4);
  assert.ok(approach&&approach.frame<launch.frame,'selection must move before allocating a launch');
  assert.equal(launch.resourceBefore-launch.resourceAfter,getBattleCatalogRecord('moves',launch.moveId).actionCost);
 }
 assert.ok(s.events.some(e=>e.type==='LANDED'));assert.ok(s.events.some(e=>e.type==='ACTION_INTERRUPTED'));
 assert.equal(s.outcome.ended,true);assert.equal(s.outcome.reason,'TEAM_DOWN');assert.equal(s.activeLaunchesAfter,0);
 assert.ok(s.slotsAfter.filter(Boolean).every(x=>x.ownerLock===0&&x.launches.every(a=>a===null)));
 assert.equal(s.impacts.active,0);assert.equal(s.impacts.created,s.impacts.released);assert.deepEqual(s.issues,[]);
});

test('R9 closure enters status1 through normal play, pursues and launches again',()=>{
 // R13 action-duration engagement changes RNG scheduling; seed1 retains this witness.
 const s=auditNormalBattle({match:1,seed:1});
 const selected=s.normalEvents.filter(e=>e.type==='PURSUIT_MOVE_SELECTED');assert.ok(selected.length>0);
 for(const e of selected){
  assert.ok(s.normalEvents.some(x=>x.slot===e.slot&&x.frame>=e.frame&&x.type==='STATE_CHANGED'&&x.from===8&&x.to===14));
  assert.ok(s.normalEvents.some(x=>x.slot===e.slot&&x.frame>e.frame&&x.type==='LAUNCHED'&&x.moveId===e.moveId));
 }
 assert.equal(s.outcome.ended,true);assert.equal(s.activeLaunchesAfter,0);assert.equal(s.impacts.active,0);
 assert.ok(s.worldFlags&2,'normal HP-zero ending sets the original abort bit');
 assert.ok(s.exclusiveFlags.samples>0);assert.equal(s.exclusiveFlags.cleared,s.exclusiveFlags.samples,'exclusive prelude still runs the original flag head');
});

test('R10 normal AI launches resource-backed projectiles, writes hits and frees every effect at settlement',()=>{
 // R13 NCER cell bounds replace alpha bounds; seed 2 covers both banks and a rejected contact.
 const s=auditNormalBattle({match:1,seed:2});
 assert.ok(s.contacts.projectileCalls>s.contacts.projectileHits,'contact rejection remains meaningful');
 assert.ok(s.contacts.projectileHits>0);assert.ok(s.movingEffectFrames>0);
 assert.deepEqual(new Set(s.effectBanks),new Set([1,19,81]));
 assert.ok(s.effectSequences.length>3,'normal scripts switch sequences in the dedicated banks');
 for(const event of s.contacts.history){assert.ok(event.sourcePoint.every(Number.isInteger));
  assert.ok(s.events.some(e=>e.type==='HIT_STATE_WRITTEN'&&e.frame===event.frame&&e.slot===event.targetSlot));}
 assert.deepEqual(s.issues,[],'camera, audio and impact delegates are all bound');
 assert.equal(s.outcome.ended,true);assert.equal(s.activeLaunchesAfter,0);
 assert.equal(s.effectPool.active,0);assert.equal(s.effectPool.free,496);assert.deepEqual(s.effectPool.unavailable,[]);
 assert.equal(s.effectPool.created,s.effectPool.released);assert.equal(s.impacts.created,s.impacts.released);
});
