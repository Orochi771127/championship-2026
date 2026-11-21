// Open Blind-Box Evolution v1 (OWNER_APPROVED_ADAPTATION 2026-11-21):
//
// Expands natural ranch evolution (幼年期 I -> 幼年期 II -> 成長期 -> 成熟期) beyond narrow
// single-line corridors into a playful, cause-and-effect 3-axis blind-box candidate pool:
//   Axis 1: 8 Race points accumulated in breeding cages (fields 10c..128)
//   Axis 2: 3 Faction points (fields 104 LUMEN / 108 IRON / 100 RIFT)
//   Axis 3: Care mistake tier (narrowFields['03d']: 0-1 PRISTINE / 2-4 STEADY / 5+ WILD)
// Plus soft affinity for classic native lineage targets and a 2.5x Discovery Bias for
// species not yet registered in the player's Database so exploration feels rewarding.
//
// Pure & deterministic: reads existing native profile fields and taxonomy catalogs only,
// mutates no native tables, and never leaks undiscovered species names in aura previews.

import { deepFreeze } from '../contracts/championshipContracts.js';
import { PRODUCT_FINAL_NATURAL_GENERATION, PRODUCT_GROWTH_RULES, productGeneration } from '../contracts/productGrowthRules.js';
import { isKnownSpeciesIndex, isProductSpeciesIndex, productSpeciesRecord } from '../contracts/productSpeciesData.js';
import { SPECIES_TAXONOMY } from '../contracts/speciesTaxonomy.js';
import { taxonomyText } from '../text/taxonomyText.js';
import { openEvolutionText } from '../text/openEvolutionText.js';
import { speciesName } from '../text/zhHant.js';
import { getLocale } from '../text/locale.js';

// Verified exact offsets from nativeRaisingLifecycle.js:9:
// counts = [0x104, 0x108, 0x100, 0x10c, 0x110, 0x114, 0x118, 0x124, 0x120, 0x128, 0x11c]
export const OPEN_EVOLUTION_FACTION_FIELDS = deepFreeze([
  { faction: 'LUMEN', field: '104' },
  { faction: 'IRON', field: '108' },
  { faction: 'RIFT', field: '100' }
]);

export const OPEN_EVOLUTION_RACE_FIELDS = deepFreeze([
  { race: 'DRAGON', field: '10c' },
  { race: 'BEAST', field: '110' },
  { race: 'AQUATIC', field: '114' },
  { race: 'AVIAN', field: '118' },
  { race: 'SYLVAN', field: '124' },
  { race: 'ASTRAL', field: '120' },
  { race: 'NETHER', field: '128' },
  { race: 'MECHANOID', field: '11c' }
]);

export const OPEN_EVOLUTION_RULES = deepFreeze({
  poolSize: 6,
  discoveryMultiplier: 2.5,
  nativeAffinityBonus: 22,
  carePristineMax: 1,
  careSteadyMax: 4
});

const signed = (v) => (v | 0);

// Pre-index all playable taxonomy species by generation (1..4) once at module load.
const PLAYABLE_BY_GENERATION = (() => {
  const byGen = new Map();
  for (const entry of SPECIES_TAXONOMY.entries) {
    const idx = entry.speciesIndex;
    if (idx < 8 || (idx >= 224 && !isProductSpeciesIndex(idx)) || !isKnownSpeciesIndex(idx)) continue;
    const rec = productSpeciesRecord(idx);
    const gen = rec?.generationIndex;
    if (!Number.isInteger(gen) || gen < 1 || gen > PRODUCT_FINAL_NATURAL_GENERATION) continue;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen).push(Object.freeze({
      speciesIndex: idx,
      generation: gen,
      race: entry.race,
      faction: entry.faction,
      element: entry.element
    }));
  }
  for (const list of byGen.values()) list.sort((a, b) => a.speciesIndex - b.speciesIndex);
  return byGen;
})();

/** Classify care mistakes (narrowFields['03d'], 0..7) into 3 expressive tiers. */
export function careMistakeTier(careMistakes) {
  const n = Math.max(0, Number(careMistakes) | 0);
  if (n <= OPEN_EVOLUTION_RULES.carePristineMax) return 'PRISTINE';
  if (n <= OPEN_EVOLUTION_RULES.careSteadyMax) return 'STEADY';
  return 'WILD';
}

/** Extract the 3-axis ranch raising profile from a native individual profile. */
export function extractRaisingAxes(profile) {
  const fields = profile?.fields;
  const narrow = profile?.narrowFields;
  if (!fields || !narrow) return null;
  const speciesIndex = fields['000'] | 0;
  const generation = productGeneration(speciesIndex);
  if (!Number.isInteger(generation) || generation < 1 || generation >= PRODUCT_FINAL_NATURAL_GENERATION) return null;

  const races = OPEN_EVOLUTION_RACE_FIELDS
    .map(({ race, field }) => ({ race, points: Math.max(0, signed(fields[field])) }))
    .sort((a, b) => b.points - a.points);
  const factions = OPEN_EVOLUTION_FACTION_FIELDS
    .map(({ faction, field }) => ({ faction, points: Math.max(0, signed(fields[field])) }))
    .sort((a, b) => b.points - a.points);
  const careMistakes = Math.max(0, Number(narrow['03d'] ?? 0) | 0);
  const careTier = careMistakeTier(careMistakes);

  return Object.freeze({
    speciesIndex,
    generation,
    nextGeneration: generation + 1,
    dominantRace: races[0].points > 0 ? races[0].race : null,
    dominantRacePoints: races[0].points,
    secondaryRace: races[1].points > 0 ? races[1].race : null,
    secondaryRacePoints: races[1].points,
    dominantFaction: factions[0].points > 0 ? factions[0].faction : null,
    dominantFactionPoints: factions[0].points,
    careMistakes,
    careTier,
    races: Object.freeze(races),
    factions: Object.freeze(factions)
  });
}

function nativeTargetsOf(speciesIndex) {
  const rules = PRODUCT_GROWTH_RULES.rules[speciesIndex - 8];
  const targets = new Set();
  if (Array.isArray(rules)) {
    for (const rule of rules) {
      if (rule && Number.isInteger(rule.target) && rule.target >= 8) targets.add(rule.target);
    }
  }
  return targets;
}

function careTierBonus(candidate, careTier) {
  if (careTier === 'PRISTINE') {
    if (candidate.race === 'ASTRAL' || candidate.race === 'DRAGON' || candidate.faction === 'LUMEN') return 18;
    if (candidate.race === 'BEAST' || candidate.race === 'AVIAN' || candidate.race === 'SYLVAN') return 10;
    return 0;
  }
  if (careTier === 'STEADY') {
    if (candidate.race === 'BEAST' || candidate.race === 'MECHANOID' || candidate.race === 'AQUATIC' || candidate.race === 'SYLVAN' || candidate.faction === 'IRON') return 12;
    return 4;
  }
  // WILD (5+ care mistakes): unlocks dark / rift / quirky mutant forms with strong excitement!
  if (candidate.race === 'NETHER' || candidate.faction === 'RIFT') return 38;
  if (candidate.race === 'MECHANOID' || candidate.race === 'DRAGON') return 14;
  return 0;
}

/**
 * Score all playable next-generation species against this individual's 3 raising axes,
 * soft native lineage affinity, and blind-box discovery bias, returning the Top-N pool.
 */
export function scoreOpenEvolutionPool(profile, { registeredSpecies = [], nativeTarget = null, poolSize = OPEN_EVOLUTION_RULES.poolSize } = {}) {
  const axes = extractRaisingAxes(profile);
  if (!axes) return null;
  const allNext = PLAYABLE_BY_GENERATION.get(axes.nextGeneration) ?? [];
  if (!allNext.length) return null;

  const registered = registeredSpecies instanceof Set
    ? registeredSpecies
    : new Set(Array.isArray(registeredSpecies) ? registeredSpecies : []);
  const nativeTargets = nativeTargetsOf(axes.speciesIndex);
  if (Number.isInteger(nativeTarget) && nativeTarget >= 8) nativeTargets.add(nativeTarget);

  const scored = allNext.map((cand) => {
    let baseScore = 10;
    if (axes.dominantRace && cand.race === axes.dominantRace) {
      baseScore += 40 + Math.min(60, axes.dominantRacePoints);
    } else if (axes.secondaryRace && cand.race === axes.secondaryRace) {
      baseScore += 18 + Math.min(25, axes.secondaryRacePoints);
    }
    if (axes.dominantFaction && cand.faction === axes.dominantFaction) {
      baseScore += 26 + Math.min(40, axes.dominantFactionPoints);
    }
    baseScore += careTierBonus(cand, axes.careTier);
    const isNativeLineage = nativeTargets.has(cand.speciesIndex);
    if (isNativeLineage) baseScore += OPEN_EVOLUTION_RULES.nativeAffinityBonus;

    const isUnknown = !registered.has(cand.speciesIndex);
    const weight = Math.max(1, Math.round(baseScore * (isUnknown ? OPEN_EVOLUTION_RULES.discoveryMultiplier : 1)));
    return Object.freeze({
      ...cand,
      baseScore,
      weight,
      isUnknown,
      isNativeLineage
    });
  });

  scored.sort((a, b) => {
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.speciesIndex - b.speciesIndex;
  });

  const limit = Math.max(1, Math.min(scored.length, poolSize | 0 || OPEN_EVOLUTION_RULES.poolSize));
  const pool = scored.slice(0, limit);
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  return deepFreeze({ axes, pool, totalWeight });
}

/**
 * Deterministically draw one blind-box evolution target from the Top-N 3-axis pool.
 * Returns the chosen speciesIndex plus the honest numeric causal recipe for post-evolution reveal.
 */
export function selectOpenEvolutionTarget(profile, { registeredSpecies = [], nativeTarget = null, rng = null, poolSize = OPEN_EVOLUTION_RULES.poolSize } = {}) {
  const scored = scoreOpenEvolutionPool(profile, { registeredSpecies, nativeTarget, poolSize });
  if (!scored || !scored.pool.length) return null;

  const rawDraw = typeof rng?.next === 'function'
    ? (rng.next(0x26) >>> 0)
    : (((profile?.fields?.['000'] | 0) * 2654435761 + (scored.axes.dominantRacePoints * 31) + scored.axes.careMistakes) >>> 0);
  let cursor = rawDraw % scored.totalWeight;
  let picked = scored.pool[0];
  for (const cand of scored.pool) {
    if (cursor < cand.weight) {
      picked = cand;
      break;
    }
    cursor -= cand.weight;
  }

  return deepFreeze({
    target: picked.speciesIndex,
    firstDiscovery: picked.isUnknown,
    matchedNative: picked.isNativeLineage,
    dominantRace: scored.axes.dominantRace,
    dominantRacePoints: scored.axes.dominantRacePoints,
    dominantFaction: scored.axes.dominantFaction,
    dominantFactionPoints: scored.axes.dominantFactionPoints,
    careTier: scored.axes.careTier,
    careMistakes: scored.axes.careMistakes,
    poolSize: scored.pool.length
  });
}

/**
 * Pure read-only "Evolution Aura Sense" projection for the partner card.
 * Strictly protects blind-box mystery & Dex discovery privacy: ONLY already-registered
 * species may appear by name in `knownPreviewNames`; undiscovered forms are counted only.
 */
export function buildOpenEvolutionAura(profile, { registeredSpecies = [], locale = getLocale() } = {}) {
  const scored = scoreOpenEvolutionPool(profile, { registeredSpecies });
  if (!scored) return null;
  const unknownCount = scored.pool.filter((c) => c.isUnknown).length;
  const knownPreviewNames = scored.pool
    .filter((c) => !c.isUnknown)
    .slice(0, 3)
    .map((c) => speciesName(c.speciesIndex, locale));

  return deepFreeze({
    speciesIndex: scored.axes.speciesIndex,
    nextGeneration: scored.axes.nextGeneration,
    dominantRace: scored.axes.dominantRace,
    dominantRacePoints: scored.axes.dominantRacePoints,
    dominantFaction: scored.axes.dominantFaction,
    dominantFactionPoints: scored.axes.dominantFactionPoints,
    careTier: scored.axes.careTier,
    careMistakes: scored.axes.careMistakes,
    poolSize: scored.pool.length,
    unknownCount,
    hasUnknown: unknownCount > 0,
    knownPreviewNames
  });
}

/** Format the honest post-evolution causal chronicle line in the requested locale. */
export function formatEvolutionCausalLine(causal, locale = getLocale()) {
  if (!causal) return '';
  const raceLabel = causal.dominantRace
    ? openEvolutionText('aura.raceValue', {
      race: taxonomyText(`race.${causal.dominantRace}`, {}, locale),
      points: causal.dominantRacePoints ?? 0
    }, locale)
    : openEvolutionText('aura.raceNone', {}, locale);
  const factionLabel = causal.dominantFaction
    ? openEvolutionText('aura.factionValue', {
      faction: taxonomyText(`faction.${causal.dominantFaction}`, {}, locale)
    }, locale)
    : openEvolutionText('aura.factionNone', {}, locale);
  const careLabel = openEvolutionText(`care.${causal.careTier ?? 'STEADY'}`, {}, locale);
  const first = causal.firstDiscovery ? openEvolutionText('causal.firstDiscovery', {}, locale) : '';
  return openEvolutionText('causal.line', {
    first,
    race: raceLabel,
    faction: factionLabel,
    care: careLabel,
    mistakes: causal.careMistakes ?? 0
  }, locale);
}
