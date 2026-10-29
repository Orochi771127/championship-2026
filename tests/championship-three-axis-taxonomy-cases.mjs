// Three-axis taxonomy (Owner 2026-10-29): data, dual-ring matchups, faction resonance in both battle
// systems, race habitats, five-locale copy and emoji-free emblems.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SPECIES_TAXONOMY, speciesTaxonomy, assertSpeciesTaxonomyCatalog, TAXONOMY_ELEMENTS, TAXONOMY_RINGS, elementMatchup, elementMultiplierPercent,
  elementResistanceAxis, TAXONOMY_RESISTANCE_AXES, factionResonance, habitatMatch, cageHabitat, TAXONOMY_HABITATS} from '../src/championship/contracts/speciesTaxonomy.js';
import {createBattleTaxonomyAdaptation, BATTLE_TAXONOMY_V1, BATTLE_TAXONOMY_ORIGINAL, BATTLE_TAXONOMY_REGEN_FRAMES} from '../src/championship/battle/battleTaxonomyAdaptation.js';
import {resolveBattleDamage} from '../src/championship/battle/battleDamageResolver.js';
import {settleOwnedBattleIndividual} from '../src/championship/battle/battleParty.js';
import {applyNativeTrainingCommand} from '../src/championship/raising/nativeRaisingTraining.js';
import {strollFindChance} from '../src/championship/raising/ranchPartnerLife.js';
import {createDataArenaSimulation} from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import {RELAY_ROSTER} from '../src/championship/modes/dataArena/dataArenaRelayRoster.js';
import {TAXONOMY_COPY} from '../src/championship/text/taxonomyText.js';
import {databaseVerifiedData} from '../src/championship/database/databaseStories.js';
import {DATABASE_DISPLAY_CATALOG} from '../src/championship/database/databaseDisplayCatalog.js';

const FACTION = {'心輝': 'LUMEN', '黑鐵': 'IRON', '裂隙': 'RIFT'};
const RACE = {'龍族': 'DRAGON', '獸族': 'BEAST', '羽翼族': 'AVIAN', '森羅族': 'SYLVAN', '海淵族': 'AQUATIC', '機巧族': 'MECHANOID', '星靈族': 'ASTRAL', '幽冥族': 'NETHER'};
const ELEMENT = {'金': 'METAL', '木': 'WOOD', '土': 'EARTH', '水': 'WATER', '火': 'FIRE', '日': 'SUN', '冰': 'ICE', '風': 'WIND', '雷': 'THUNDER', '月': 'MOON'};
const csv = fs.readFileSync('docs/planning/three-axis-taxonomy-20261029/三軸歸屬定案_232.csv', 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1)
  .map(line => line.slice(1, -1).split('","'));
const byCode = new Map(SPECIES_TAXONOMY.entries.map(e => [e.displayCode, e]));
const count = key => SPECIES_TAXONOMY.entries.reduce((a, e) => (a[e[key]] = (a[e[key]] ?? 0) + 1, a), {});

test('all 232 partners carry exactly the Owner-final faction, race and element of the reviewed table', () => {
  assert.equal(SPECIES_TAXONOMY.entries.length, 232);
  assert.equal(csv.length, 232);
  for (const [code, name, , faction, race, element, , , , , , speciesIndex] of csv) {
    const e = speciesTaxonomy(Number(speciesIndex));
    assert.ok(e, `${code} ${name}`);
    assert.equal(e.displayCode, code);
    assert.equal(e.faction, FACTION[faction.replace(/（.*）$/, '')] ?? null, `${code} faction`);
    assert.equal(e.race, RACE[race] ?? null, `${code} race`);
    assert.equal(e.element, ELEMENT[element], `${code} element`);
  }
  // Every non-egg Dex identity is classified, and nothing else is.
  assert.deepEqual(SPECIES_TAXONOMY.entries.map(e => e.speciesIndex).sort((a, b) => a - b),
    DATABASE_DISPLAY_CATALOG.entries.filter(e => e.numberingStageIndex > 0).map(e => e.speciesIndex).sort((a, b) => a - b));
  assert.deepEqual(count('faction'), {null: 27, LUMEN: 75, IRON: 68, RIFT: 62});
  assert.deepEqual(count('element'), {METAL: 32, FIRE: 29, MOON: 29, SUN: 26, EARTH: 24, WATER: 21, WIND: 19, WOOD: 18, THUNDER: 18, ICE: 16});
});

test('Owner decisions: ten former free partners join the three factions and 25 elements are corrected', () => {
  const moves = {GR27: 'LUMEN', GR32: 'LUMEN', UL02: 'LUMEN', UL05: 'LUMEN', GR02: 'IRON', MA60: 'IRON', UL03: 'IRON', MA04: 'RIFT', UL04: 'RIFT', UL08: 'RIFT'};
  for (const [code, faction] of Object.entries(moves)) assert.equal(byCode.get(code).faction, faction, code);
  const fixes = {MA28: 'THUNDER', GR23: 'METAL', AW04: 'METAL', UL19: 'METAL', MA62: 'SUN', AW31: 'SUN', UL01: 'SUN', AW32: 'MOON', GR11: 'FIRE', MA19: 'FIRE', UL31: 'FIRE',
    MA29: 'EARTH', MA56: 'EARTH', MA08: 'WIND', AW12: 'WIND', UL15: 'WIND', UL02: 'WIND', UL03: 'WIND', GR06: 'WIND', AW35: 'WIND', MA30: 'WIND', MA68: 'WIND',
    GR37: 'ICE', AW30: 'ICE', AW37: 'ICE'};
  assert.equal(Object.keys(fixes).length, 25);
  for (const [code, element] of Object.entries(fixes)) assert.equal(byCode.get(code).element, element, code);
  // Babies keep no faction; B202 stays a dragon and the star-core bean a mechanoid (family points unchanged).
  assert.equal(byCode.get('B202').race, 'DRAGON');
  assert.equal(byCode.get('GR40').race, 'MECHANOID');
});

test('the catalog cannot drift from the ROM attribute and family it renames', () => {
  const entries = structuredClone(SPECIES_TAXONOMY.entries);
  assert.doesNotThrow(() => assertSpeciesTaxonomyCatalog(entries));
  const vaccine = entries.find(e => e.faction === 'LUMEN' && !['GR27', 'GR32', 'UL02', 'UL05'].includes(e.displayCode));
  assert.throws(() => assertSpeciesTaxonomyCatalog(entries.map(e => e === vaccine ? {...e, faction: 'RIFT'} : e)), /SPECIES_TAXONOMY_FACTION/);
  assert.throws(() => assertSpeciesTaxonomyCatalog(entries.map(e => e === vaccine ? {...e, race: 'NETHER'} : e)), /SPECIES_TAXONOMY_RACE/);
  assert.throws(() => assertSpeciesTaxonomyCatalog(entries.map(e => e === vaccine ? {...e, element: 'LIGHT'} : e)), /SPECIES_TAXONOMY_ELEMENT/);
  assert.throws(() => assertSpeciesTaxonomyCatalog([...entries, entries[0]]), /SPECIES_TAXONOMY_IDENTITY/);
});

test('the dual ring is one-to-one: each element beats one and falls to one, rings never cross', () => {
  assert.equal(elementMultiplierPercent('METAL', 'WOOD'), 150);
  assert.equal(elementMultiplierPercent('WOOD', 'METAL'), 75);
  assert.equal(elementMultiplierPercent('SUN', 'ICE'), 150);
  assert.equal(elementMultiplierPercent('MOON', 'SUN'), 150);
  assert.equal(elementMultiplierPercent('SUN', 'MOON'), 75);
  assert.equal(elementMultiplierPercent('FIRE', 'ICE'), 100, 'no cross-ring rule');
  assert.equal(elementMultiplierPercent('FIRE', 'FIRE'), 100);
  assert.equal(elementMultiplierPercent(null, 'FIRE'), 100);
  for (const ring of Object.values(TAXONOMY_RINGS)) ring.forEach((element, i) => {
    assert.deepEqual(elementMatchup(element), {beats: ring[(i + 1) % 5], beatenBy: ring[(i + 4) % 5]});
    const strong = TAXONOMY_ELEMENTS.filter(other => elementMultiplierPercent(element, other) === 150);
    const weak = TAXONOMY_ELEMENTS.filter(other => elementMultiplierPercent(element, other) === 75);
    assert.deepEqual([strong.length, weak.length], [1, 1], element);
  });
  // The five resistance bars keep their meaning and each carries one old and one new element.
  assert.deepEqual(TAXONOMY_RESISTANCE_AXES, {HEAT: ['FIRE', 'WOOD'], COLD: ['ICE', 'WATER'], LIGHT: ['SUN', 'WIND'], DARK: ['MOON', 'EARTH'], THUNDER: ['THUNDER', 'METAL']});
  for (const element of TAXONOMY_ELEMENTS) assert.ok(elementResistanceAxis(element));
});

test('faction resonance needs two of a faction, or one of each for the tri-core', () => {
  assert.deepEqual(factionResonance(['LUMEN']), []);
  assert.deepEqual(factionResonance(['LUMEN', 'LUMEN']), ['LUMEN']);
  assert.deepEqual(factionResonance(['IRON', 'IRON', 'RIFT']), ['IRON']);
  assert.deepEqual(factionResonance(['LUMEN', 'IRON', 'RIFT']), ['TRI']);
  assert.deepEqual(factionResonance(['RIFT', 'RIFT', 'LUMEN', 'IRON']), ['RIFT', 'TRI']);
  assert.deepEqual(factionResonance([null, undefined, 'NONE']), []);
});

const species = faction => SPECIES_TAXONOMY.entries.filter(e => e.faction === faction).map(e => e.speciesIndex);
const [L1, L2] = species('LUMEN'), [I1, I2] = species('IRON'), [R1, R2] = species('RIFT');
const teamOf = slot => slot < 3 ? 0 : 1;

test('auto battle: the ORIGINAL policy changes nothing; TAXONOMY_V1 scales both teams alike', () => {
  const original = createBattleTaxonomyAdaptation({policy: BATTLE_TAXONOMY_ORIGINAL, speciesBySlot: [L1, L2, null, I1, I2, null], teamOf});
  assert.equal(original.scaleDamage({attackerSlot: 0, defenderSlot: 3, elementSelector: 1, damage: 100}), 100);
  assert.equal(original.critBonus(0), 0);
  assert.deepEqual(original.resonance(0), []);
  const slots = [{metricBase: 50, metricLimit: 50}, {metricBase: 40, metricLimit: 40}, null, {metricBase: 60, metricLimit: 60}, {metricBase: 30, metricLimit: 30}, null];
  const lumenVsIron = createBattleTaxonomyAdaptation({policy: BATTLE_TAXONOMY_V1, speciesBySlot: [L1, L2, null, I1, I2, null], teamOf});
  assert.deepEqual([lumenVsIron.resonance(0), lumenVsIron.resonance(1)], [['LUMEN'], ['IRON']]);
  lumenVsIron.applyStart(slots);
  assert.deepEqual(slots.map(c => c?.metricLimit ?? null), [50, 40, null, 72, 36, null], 'only the Black Iron team opens at 120% TP');
  // Physical: Lumen takes 90%; Iron takes 1/1.08.
  assert.equal(lumenVsIron.scaleDamage({attackerSlot: 3, defenderSlot: 0, elementSelector: 0, damage: 100}), 90);
  assert.equal(lumenVsIron.scaleDamage({attackerSlot: 0, defenderSlot: 3, elementSelector: 0, damage: 108}), 100);
  assert.equal(lumenVsIron.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 1}), 1, 'a landed hit never drops to 0');
  // Elemental: attacker element vs defender element on the dual ring.
  const fire = SPECIES_TAXONOMY.entries.find(e => e.element === 'FIRE' && !e.faction), metal = SPECIES_TAXONOMY.entries.find(e => e.element === 'METAL' && !e.faction);
  const duel = createBattleTaxonomyAdaptation({policy: BATTLE_TAXONOMY_V1, speciesBySlot: [fire?.speciesIndex ?? L1, null, null, metal?.speciesIndex ?? I1, null, null], teamOf});
  if (fire && metal) {
    assert.equal(duel.scaleDamage({attackerSlot: 0, defenderSlot: 3, elementSelector: 1, damage: 100}), 150);
    assert.equal(duel.scaleDamage({attackerSlot: 3, defenderSlot: 0, elementSelector: 5, damage: 100}), 75);
    assert.equal(duel.scaleDamage({attackerSlot: 0, defenderSlot: 3, elementSelector: 0, damage: 100}), 100, 'physical stays neutral');
  }
  // Rift: crit threshold +10 and the costliest move +15%.
  const rift = createBattleTaxonomyAdaptation({policy: BATTLE_TAXONOMY_V1, speciesBySlot: [R1, R2, null, I1, null, null], teamOf});
  assert.equal(rift.critBonus(0), 10);
  assert.equal(rift.critBonus(3), 0);
  assert.equal(rift.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100, signature: true}), 115);
  assert.equal(rift.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100, signature: false}), 100);
  // Tri-core: x1.08 dealt, /1.08 taken, +15% rewards.
  const tri = createBattleTaxonomyAdaptation({policy: BATTLE_TAXONOMY_V1, speciesBySlot: [L1, I1, R1, null, null, null], teamOf});
  assert.deepEqual(tri.resonance(0), ['TRI']);
  assert.equal(tri.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), 108);
  assert.equal(tri.rewardPercent(0), 115);
  assert.equal(tri.rewardPercent(1), 100);
  // Lumen regen: 1% max HP every 5 seconds, never above max, never for the fallen.
  const hp = [{currentHp: 50, maxHp: 200}, {currentHp: 0, maxHp: 200}, null, {currentHp: 10, maxHp: 100}, null, null];
  assert.deepEqual(lumenVsIron.regen(BATTLE_TAXONOMY_REGEN_FRAMES - 1, hp), []);
  assert.deepEqual(lumenVsIron.regen(BATTLE_TAXONOMY_REGEN_FRAMES, hp), [0]);
  assert.deepEqual(hp.map(c => c?.currentHp ?? null), [52, 0, null, 10, null, null]);
});

test('the resolver crit seam defaults to the original threshold and rejects negatives', () => {
  const base = {attackerIndex: 10, defenderIndex: 10, power: 100, rng: {next: () => 4}};
  assert.equal(resolveBattleDamage({...base, applyVariance: false}).critical, false, 'roll 4 misses the tier-0 threshold of 2');
  assert.equal(resolveBattleDamage({...base, applyVariance: false, critBonus: 10}).critical, true);
  assert.throws(() => resolveBattleDamage({...base, critBonus: -1}), /critBonus/);
});

test('tri-core rewards: affection gain scales by the percent, and the percent is bounded', () => {
  const profile = {fields: {'020': 0, '024': 0, '028': 0, '040': 0, '050': 10, '054': 5, '058': 20, '05c': 10}, narrowFields: {}};
  const won = rewardPercent => settleOwnedBattleIndividual(profile, {currentHp: 10, metricLimit: 5, verdict: 4, mode: 0, event: 1, rewardPercent}).fields['020'];
  assert.equal(won(100), 10);
  assert.equal(won(115), 11);
  assert.throws(() => won(90), /BATTLE_PARTY_UNTRACED_RESULT_CONTEXT/);
});

test('race habitats: matching cages lift stat growth 20% and stroll finds 25%, never evolution points', () => {
  const dragon = SPECIES_TAXONOMY.entries.find(e => e.race === 'DRAGON').speciesIndex;
  assert.equal(habitatMatch(dragon, 6), 'DRAGON', 'volcano');
  assert.equal(habitatMatch(dragon, 8), null, 'beach');
  assert.deepEqual(cageHabitat(17).races, ['SYLVAN', 'ASTRAL'], 'the garden suits two races');
  assert.equal(cageHabitat(35).sharedCare, true, 'waiting room');
  for (const cages of Object.values(TAXONOMY_HABITATS)) for (const c of cages) assert.ok(Number.isInteger(c) && c >= 0 && c <= 35);
  // A real individual from the CPU-verified training receipt, with room to grow.
  const receipt = JSON.parse(fs.readFileSync('docs/research/RAISING_LIFECYCLE_CPU_CHECK_2026-09-08.json', 'utf8'));
  const profile = {version: 1, ...receipt.training.find(row => row.kind === 11 && row.before.fields['134'] === 0).before};
  profile.fields = {...profile.fields, '070': 10};
  const rng = {next: () => 51};
  const stat = growthPercent => applyNativeTrainingCommand(profile, {kind: 11, delta: 10, season: 0, growthPercent}, rng);
  const point = growthPercent => applyNativeTrainingCommand(profile, {kind: 0, delta: 10, season: 0, growthPercent}, rng);
  assert.ok(stat(100).delta > 0);
  assert.equal(stat(120).delta, Math.trunc(stat(100).delta * 1.2));
  assert.equal(point(120).delta, point(100).delta, 'attribute and family points keep their original pace');
  assert.equal(strollFindChance('neutral', 'calm'), 0.6);
  assert.equal(strollFindChance('neutral', 'calm', {raceHabitat: true}), 0.75);
  assert.equal(strollFindChance('cozy', 'happy', {raceHabitat: true}), 0.95, 'the existing ceiling holds');
});

test('Data Arena: dual-ring damage and the relay pair\'s resonance (cooldown, damage taken)', () => {
  const pick = faction => RELAY_ROSTER.filter(p => SPECIES_TAXONOMY.entries.find(e => `species-${String(e.speciesIndex).padStart(3, '0')}` === p.speciesId)?.faction === faction).map(p => p.id);
  const [i1, i2] = pick('IRON'), [l1, l2] = pick('LUMEN');
  // Same lead, same seed: an Iron reserve lights the resonance, a Lumen reserve does not.
  const castCooldown = reserve => {
    const sim = createDataArenaSimulation({mode: 'RELAY', partnerId: i1, relayReserveId: reserve, relayArenaId: 'field_bm01_01', seed: 3});
    for (let i = 0; i < 130; i++) sim.step({});
    const move = sim.getState().player.kit.moves[0];
    sim.step({cast: 0, autoAim: true});
    return {resonance: sim.getState().relay.resonance, cooldown: sim.getState().player.cooldowns[move]};
  };
  const lit = castCooldown(i2), plain = castCooldown(l1);
  assert.deepEqual([lit.resonance, plain.resonance], [['IRON'], []]);
  assert.ok(plain.cooldown > 0);
  const tick = 1 / 60; // the sample is taken one simulation step after the cast
  assert.ok(Math.abs((lit.cooldown + tick) - (plain.cooldown + tick) * 0.9) < 1e-9, `${lit.cooldown} vs ${plain.cooldown}`);
  const lumen = createDataArenaSimulation({mode: 'RELAY', partnerId: l1, relayReserveId: l2, relayArenaId: 'field_bm01_01', seed: 3});
  assert.deepEqual(lumen.getState().relay.resonance, ['LUMEN']);
  const mixed = createDataArenaSimulation({mode: 'RELAY', partnerId: l1, relayReserveId: i1, relayArenaId: 'field_bm01_01', seed: 3, relayCompanionSpecies: [pick('RIFT').map(id => RELAY_ROSTER.find(p => p.id === id).speciesId)[0]]});
  assert.deepEqual(mixed.getState().relay.resonance, ['TRI'], 'a companion completes the tri-core');
});

test('five locales cover every taxonomy key; Dex data names faction, race and element', () => {
  const keys = Object.keys(TAXONOMY_COPY['zh-Hant']);
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) assert.deepEqual(Object.keys(TAXONOMY_COPY[locale]).sort(), [...keys].sort(), locale);
  const data = databaseVerifiedData(48, 'zh-Hant');
  assert.deepEqual([data.labels.attribute, data.attributeName, data.labels.family, data.familyName, data.labels.element, data.elementName], ['陣營', '心輝', '種族', '獸族', '屬性', '土']);
});

test('taxonomy emblems, chart and copy use drawn SVG only, with no emoji', () => {
  const emoji = /\p{Extended_Pictographic}/u;
  for (const file of ['src/championship/text/taxonomyText.js', 'src/championship/presentation/taxonomyBadgeArt.js', 'src/championship/app/elementChartModal.js', 'src/championship/app/ui/taxonomy.css',
    'src/championship/contracts/speciesTaxonomy.js', 'src/championship/battle/battleTaxonomyAdaptation.js'])
    assert.equal(emoji.test(fs.readFileSync(file, 'utf8')), false, file);
  for (const table of Object.values(TAXONOMY_COPY)) for (const text of Object.values(table)) assert.equal(emoji.test(text), false, text);
});
