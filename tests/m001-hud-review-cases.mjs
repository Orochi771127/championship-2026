import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyM001HudReview} from '../src/championship/presentation/m001CharacterHudReview.js';
import {battlePartyAdmission} from '../src/championship/battle/battleParty.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const review=read('assets/production/internal-character-review/m001-r05-anchored/hud-r01/manifest.json');
const baseline=read('assets/production/internal-faithful-baseline/character-hud-v1/manifest.json');
const inputs=m=>({baseUrl:'http://127.0.0.1:8732/championship.html?characterArtReview=m001',
 fetchImpl:async()=>({ok:true,json:async()=>structuredClone(m)}),
 portraits:new Map(baseline.portraits.map(p=>[p.speciesId,p])),
 battle:new Map(baseline.battle.map(b=>[b.speciesId,{sequences:b.sequences,cells:new Map(b.cells.map(c=>[c.cell,c]))}]))});
test('original portrait and Sub result animations replace only species 008',async()=>{
 const args=inputs(review),other=args.portraits.get('species-009');await applyM001HudReview(args);
 assert.match(args.portraits.get('species-008').src,/m001-r05-anchored/);
 assert.equal(args.portraits.get('species-009'),other);
 assert.deepEqual(args.battle.get('species-008').sequences,review.battle.sequences);
});
test('HUD review rejects remote/default URLs, missing frames and timing drift before changing maps',async()=>{
 for(const change of [a=>a.baseUrl='https://example.com/?characterArtReview=m001',a=>a.baseUrl='http://127.0.0.1/championship.html']){
  const a=inputs(review);change(a);await assert.rejects(()=>applyM001HudReview(a),/REQUIRES_LOCAL_REVIEW/);
 }
 for(const mutate of [m=>m.battle.sequences[0].frames[0].ticks++,m=>m.battle.cells=[],m=>m.portrait.src='../source.png']){
  const m=structuredClone(review);mutate(m);const a=inputs(m);const prior=a.portraits.get('species-008');
  await assert.rejects(()=>applyM001HudReview(a),/M001_HUD_/);assert.equal(a.portraits.get('species-008'),prior);
 }
});
test('m001 battle gameplay remains ineligible due to donor generation, despite complete art',()=>{
 const species=nativeHuntSpeciesByIndex(8);assert.equal(species.generation,1);
 const profile=nativeIndividualProfile(createNativeHuntIndividual({species,rng:{next:()=>11}}));
 assert.equal(battlePartyAdmission(profile).reason,'TOO_YOUNG');
});
