import assert from 'node:assert/strict';
import test from 'node:test';
import receipt from '../docs/research/PASSWORD_BATTLE_CODEC_CPU_2026-09-14.json' with {type:'json'};
import teamPack from '../docs/research/PASSWORD_TEAM_PACK_CPU_2026-09-15.json' with {type:'json'};
import qaSave from '../qa/championship-full-qa-save.json' with {type:'json'};
import {
  NATIVE_PASSWORD_ALPHABET,
  NATIVE_PASSWORD_TEAM_DEFAULTS,
  createNativePasswordPlaceholders,
  decodeNativePasswordTeam,
  encodeNativePasswordTeam,
  encodeNativePasswordTeamFromProfiles,
  normalizeNativePassword,
  nativePasswordCompactFromProfile,
  nativePasswordProfileAdmission,
  nativePasswordTeamAdmission
} from '../src/championship/battle/nativePasswordBattle.js';

const COMPACT_ORDER=['speciesIndex','personalityIndex','levelTens','hpSteps','tpSteps','level84','level88','level8C','level90','level94','level98','level9C','levelA0','levelA4'];
const profileOf=member=>({fields:member.fields,narrowFields:{'044':member.narrow044}});

test('live-profile packing matches all 61 original encoder vectors, including overflow',()=>{
  assert.equal(teamPack.vectorCount,61);
  for(const vector of teamPack.vectors){
    for(const member of vector.members.filter(Boolean)){
      const compact=nativePasswordCompactFromProfile(profileOf(member));
      assert.deepEqual(COMPACT_ORDER.map(key=>compact[key]),member.compact);
    }
    const profiles=vector.members.map(member=>member?profileOf(member):null);
    const extras=vector.members.map(member=>member?.extra);
    assert.equal(encodeNativePasswordTeamFromProfiles(profiles,{extras,teamField:vector.teamField}),vector.password,vector.kind);
  }
});

test('a fresh-team code from the QA save decodes back to the same individuals',()=>{
  assert.deepEqual(NATIVE_PASSWORD_TEAM_DEFAULTS,{extra:1,teamField:1});
  const profiles=qaSave.raising.collection.slice(0,3).map(entry=>entry.nativeProfile);
  const password=encodeNativePasswordTeamFromProfiles(profiles);
  assert.ok(password.length>0&&password.length<=22);
  const decoded=decodeNativePasswordTeam(password);
  assert.equal(decoded.teamField,1);assert.equal(decoded.presenceMask,7);
  assert.equal(nativePasswordTeamAdmission(decoded).ok,true);
  decoded.members.forEach((member,slot)=>{
    assert.equal(member.extra,1);
    assert.deepEqual({...member.compact},{...nativePasswordCompactFromProfile(profiles[slot])});
    assert.equal(member.nativeProfile.fields['000'],profiles[slot].fields['000']);
  });
});

test('password-making refuses what Password Battle would refuse',()=>{
  const adult=qaSave.raising.collection[0].nativeProfile;
  assert.equal(nativePasswordProfileAdmission(adult).ok,true);
  const egg=structuredClone(adult);egg.fields['000']=0;
  assert.equal(nativePasswordProfileAdmission(egg).reason,'INELIGIBLE_SPECIES');
  assert.equal(nativePasswordProfileAdmission(null).reason,'PROFILE_UNAVAILABLE');
  assert.throws(()=>encodeNativePasswordTeamFromProfiles([]),/PASSWORD_BATTLE_TEAM_SIZE/);
  assert.throws(()=>encodeNativePasswordTeamFromProfiles([adult,adult,adult,adult]),/PASSWORD_BATTLE_TEAM_SIZE/);
});

test('password alphabet matches the CPU-observed constructor',()=>{
  assert.equal(NATIVE_PASSWORD_ALPHABET.length,receipt.alphabet.length);
  assert.equal(NATIVE_PASSWORD_ALPHABET[0],'ぁ');
  assert.equal(new Set(NATIVE_PASSWORD_ALPHABET).size,257);
});

test('password rebuild preserves the three native species-34 placeholder stat rolls',()=>{
  let value=0;
  const placeholders=createNativePasswordPlaceholders({next:channel=>(value=(value+channel+17)%103)});
  const decoded=decodeNativePasswordTeam(receipt.vectors[1].password,{placeholders,instancePrefix:'team-a'});
  for(const member of decoded.members.filter(Boolean)){
    assert.equal(member.nativeProfile.fields['060'],placeholders[member.slot].fields['060']);
    assert.equal(member.instanceId,`team-a:${member.slot}`);
  }
  assert.equal(nativePasswordTeamAdmission(decoded).ok,true);
  assert.equal(nativePasswordTeamAdmission(decodeNativePasswordTeam(receipt.vectors[2].password)).reason,'INELIGIBLE_SPECIES');
});

test('all native password vectors decode and encode without losing team data',()=>{
  for(const vector of receipt.vectors){
    const decoded=decodeNativePasswordTeam(vector.password);
    assert.equal(decoded.presenceMask,vector.decoded.mask);
    assert.equal(decoded.teamField,vector.decoded.teamField);
    assert.equal(encodeNativePasswordTeam(decoded),vector.password);
    for(let slot=0;slot<3;slot++){
      const expected=vector.decoded.members[slot],actual=decoded.members[slot];
      if(!expected){assert.equal(actual,null);continue;}
      const f=actual.nativeProfile.fields,n=actual.nativeProfile.narrowFields;
      assert.deepEqual({
        speciesIndex:f['000'],personalityIndex:f['018'],levelTens:n['044'],maxHp:f['058'],maxTp:f['05c'],
        levels:['084','088','08c','090','094','098','09c','0a0','0a4'].map(key=>f[key]),
        sources:[f['12c'],f['130']],extra:actual.extra
      },expected);
      assert.equal(actual.battleCreature.maxHp,expected.maxHp);
      assert.equal(actual.battleCreature.metricBase,expected.maxTp);
    }
  }
});

test('alternate input glyphs normalize and a checksum change is rejected',()=>{
  assert.equal(normalizeNativePassword('ー一二＝十'),'－－ニニ＋');
  const original=receipt.vectors[0].password;
  const replacement=NATIVE_PASSWORD_ALPHABET[(NATIVE_PASSWORD_ALPHABET.indexOf(original[0])+1)%257];
  assert.throws(()=>decodeNativePasswordTeam(replacement+original.slice(1)),/PASSWORD_BATTLE_CHECKSUM/);
  assert.throws(()=>decodeNativePasswordTeam('中'),/PASSWORD_BATTLE_CHARACTER/);
});

test('half-width phone keyboard input and copied spaces decode as the shown code',()=>{
  const wide=c=>c.charCodeAt(0)>=0xff01&&c.charCodeAt(0)<=0xff5e;
  const vector=receipt.vectors.find(v=>[...v.password].some(wide));
  assert.ok(vector,'a receipt password must contain a full-width letter, digit or symbol');
  const typed=[...vector.password].map(c=>wide(c)?String.fromCharCode(c.charCodeAt(0)-0xfee0):c).join('');
  assert.notEqual(typed,vector.password);
  const decoded=decodeNativePasswordTeam(` ${typed.slice(0,4)}　${typed.slice(4)}\n`);
  assert.equal(decoded.password,vector.password);
  assert.equal(encodeNativePasswordTeam(decoded),vector.password);
  assert.equal(normalizeNativePassword(typed),vector.password);
  // Lookalike letters still land on their canonical symbols after widening.
  assert.equal(normalizeNativePassword('lIOo'),'１１００');
});
