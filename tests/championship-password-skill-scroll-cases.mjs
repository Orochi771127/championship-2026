import assert from 'node:assert/strict';
import test from 'node:test';
import qaSave from '../qa/championship-full-qa-save.json' with {type:'json'};
import {encodeChampionshipPasswordTeamFromProfiles, decodeChampionshipPasswordTeam, NATIVE_PASSWORD_MAX_LENGTH}
  from '../src/championship/battle/nativePasswordBattle.js';
import {decodeProductPasswordData} from '../src/championship/contracts/productPasswordTransport.js';
import {listMoveRecordsForCombatant} from '../src/championship/battle/battleCatalogs.js';
import {normalizeCyberGacha, engraveGachaScroll, engravedSkillsOf} from '../src/championship/gacha/cyberGacha.js';

// SKILL_IMPRINT_SCROLL 2026-11-17 (Owner: an engraved skill must work in online battles too). Online defence teams
// and password battles travel as password codes; link and room battles already carry every individual word.

const team = () => qaSave.raising.collection.slice(0, 3).map(entry => structuredClone(entry.nativeProfile));
const pair = profile => [profile.fields['12c'], profile.fields['130']];
const rebuiltPair = profile => pair(decodeChampionshipPasswordTeam(encodeChampionshipPasswordTeamFromProfiles([profile])).members[0].nativeProfile);

test('without an engraved slot the original password is kept, even for a partner whose own skills differ', () => {
  const profiles = team();
  // An evolved partner keeps its earlier skills natively; the original password still rebuilds them.
  profiles[0].fields['12c'] = rebuiltPair(profiles[0])[0] === 3 ? 4 : 3;
  const password = encodeChampionshipPasswordTeamFromProfiles(profiles);
  assert.ok([...password].length <= NATIVE_PASSWORD_MAX_LENGTH, 'still the original short code');
  const decoded = decodeChampionshipPasswordTeam(password);
  assert.deepEqual(pair(decoded.members[0].nativeProfile), rebuiltPair(profiles[0]), 'rebuilt exactly as the original does');
});

test('an engraved slot switches to the product code, which carries only that slot to the opponent', () => {
  const profiles = team();
  const rebuilt = rebuiltPair(profiles[1]);
  const skill = rebuilt[0] === 28 ? 29 : 28;
  const scroll = `scroll:SSR:${skill}`;
  const done = engraveGachaScroll(normalizeCyberGacha({version: 1, scrolls: {[scroll]: 1}}),
    {scrollId: scroll, profile: {...profiles[1], fields: {...profiles[1].fields, '12c': 0}}, slot: '12c', instanceId: 'partner-b'});
  assert.ok(done.ok, done.reason);
  assert.deepEqual(engravedSkillsOf(done.state, 'partner-b'), {'12c': skill}, 'the ledger names the slot');
  profiles[1] = structuredClone(done.profile);
  const engraved = [null, engravedSkillsOf(done.state, 'partner-b'), null];
  const password = encodeChampionshipPasswordTeamFromProfiles(profiles, {engraved});
  assert.ok(password.startsWith('CM26-PASSWORD-2.'), 'the product code');
  const data = decodeProductPasswordData(password);
  assert.deepEqual(data.members[1].compact.skills, [skill, rebuilt[1]], 'the engraved slot, and the rebuilt one beside it');
  assert.equal(Object.hasOwn(data.members[0].compact, 'skills'), false, 'an untouched partner sends no skills');
  const decoded = decodeChampionshipPasswordTeam(password);
  assert.deepEqual(pair(decoded.members[1].nativeProfile), [skill, rebuilt[1]]);
  assert.equal(decoded.members[1].battleCreature.source12C, skill);
  const combatant = {speciesId: decoded.members[1].nativeProfile.fields['000'], source12C: skill, source130: rebuilt[1]};
  assert.ok(listMoveRecordsForCombatant(combatant).some(move => move.recordIndex === skill), 'the opponent battles with it');
  // Once another skill replaces it, the ledger no longer matches and the slot falls back to the original rule.
  profiles[1].fields['12c'] = skill === 28 ? 29 : 28;
  assert.ok([...encodeChampionshipPasswordTeamFromProfiles(profiles, {engraved})].length <= NATIVE_PASSWORD_MAX_LENGTH);
});

test('the product code and the ledger refuse a skill outside the thirty special skills', () => {
  assert.throws(() => normalizeCyberGacha({version: 1, engraved: {a: {'12c': 31}}}), /INVALID_ENGRAVED_SKILLS/);
  assert.throws(() => normalizeCyberGacha({version: 1, engraved: {a: {'0c4': 3}}}), /INVALID_ENGRAVED_SKILLS/);
  const profiles = team();
  const skill = rebuiltPair(profiles[0])[0] === 3 ? 4 : 3;
  profiles[0].fields['12c'] = skill;
  const password = encodeChampionshipPasswordTeamFromProfiles(profiles, {engraved: [{'12c': skill}]});
  const body = password.split('.')[2];
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  payload.members[0].compact.skills = [31, 0];
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  let sum = 0x811c9dc5; for (const byte of bytes) { sum ^= byte; sum = Math.imul(sum, 0x01000193) >>> 0; }
  const forged = `CM26-PASSWORD-2.${sum.toString(16).padStart(8, '0')}.${bytes.toString('base64url')}`;
  assert.throws(() => decodeChampionshipPasswordTeam(forged), /INVALID_SKILL/);
});
