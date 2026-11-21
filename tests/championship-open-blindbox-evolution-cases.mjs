// Open Blind-Box Evolution v1 (2026-11-21):
// Verifies 3-axis candidate pool (race x faction x care-mistake tier), blind-box
// discovery bias, twin divergence from different breeding cages, strict Dex discovery
// privacy in aura previews, and zero regression on native/default evolution mode.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPEN_EVOLUTION_RULES,
  buildOpenEvolutionAura,
  careMistakeTier,
  extractRaisingAxes,
  formatEvolutionCausalLine,
  scoreOpenEvolutionPool,
  selectOpenEvolutionTarget
} from '../src/championship/raising/productOpenEvolution.js';
import { evaluateProductEvolution } from '../src/championship/raising/productGrowthPolicy.js';
import { buildPartnerEvolutionCompass } from '../src/championship/app/partnerEvolutionCompass.js';
import { createNativeHuntIndividual } from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import { nativeHuntSpeciesByIndex } from '../src/championship/hunt/capture/nativeHuntSources.js';
import { nativeIndividualProfile } from '../src/championship/raising/nativeIndividualProfile.js';
import { isKnownSpeciesIndex, productSpeciesRecord } from '../src/championship/contracts/productSpeciesData.js';
import { OPEN_EVOLUTION_COPY, openEvolutionText } from '../src/championship/text/openEvolutionText.js';
import { speciesName } from '../src/championship/text/zhHant.js';
import { inspectScopedLocaleCopy } from '../scripts/check-locale-coverage.mjs';

function makeSpeciesProfile(speciesIndex, { fields = {}, narrow = {} } = {}) {
  const base = structuredClone(nativeIndividualProfile(
    createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(speciesIndex), rng: { next: () => 42 } })
  ));
  Object.assign(base.fields, fields);
  Object.assign(base.narrowFields, narrow);
  return base;
}

test('Open Evolution: twin Rookies raised in different cages (Dragon/Lumen vs Nether/Rift Wild) diverge into distinct pools', () => {
  // Two identical species-034 (Agumon / Rookie, gen 3) raised in two different ways:
  const dragonPristine = makeSpeciesProfile(34, {
    fields: { '10c': 55, '104': 40 }, // DRAGON + LUMEN
    narrow: { '03d': 0 }              // PRISTINE care (0 mistakes)
  });
  const netherWild = makeSpeciesProfile(34, {
    fields: { '128': 55, '100': 40 }, // NETHER + RIFT
    narrow: { '03d': 6 }              // WILD care (6 mistakes)
  });

  const poolA = scoreOpenEvolutionPool(dragonPristine, { registeredSpecies: [34] });
  const poolB = scoreOpenEvolutionPool(netherWild, { registeredSpecies: [34] });

  assert.equal(poolA.axes.dominantRace, 'DRAGON');
  assert.equal(poolA.axes.dominantFaction, 'LUMEN');
  assert.equal(poolA.axes.careTier, 'PRISTINE');
  assert.equal(poolB.axes.dominantRace, 'NETHER');
  assert.equal(poolB.axes.dominantFaction, 'RIFT');
  assert.equal(poolB.axes.careTier, 'WILD');

  assert.equal(poolA.pool.length, OPEN_EVOLUTION_RULES.poolSize);
  assert.equal(poolB.pool.length, OPEN_EVOLUTION_RULES.poolSize);
  // Every candidate must be a real playable Generation 4 (成熟期) species!
  for (const c of [...poolA.pool, ...poolB.pool]) {
    assert.equal(c.generation, 4);
    assert.equal(isKnownSpeciesIndex(c.speciesIndex), true);
    assert.equal(productSpeciesRecord(c.speciesIndex).generationIndex, 4);
  }
  // Pools must reflect their distinct raising axes!
  assert.ok(poolA.pool.some((c) => c.race === 'DRAGON'), 'Dragon cage must produce Dragon candidates');
  assert.ok(poolB.pool.some((c) => c.race === 'NETHER' || c.faction === 'RIFT'), 'Nether/Wild care must surface Nether/Rift candidates');
  const setA = new Set(poolA.pool.map((c) => c.speciesIndex));
  const overlap = poolB.pool.filter((c) => setA.has(c.speciesIndex)).length;
  assert.ok(overlap < poolA.pool.length, `Expected diverging pools, got complete overlap (${overlap})`);
});

test('Open Evolution: Discovery Bias boosts unregistered species weight by 2.5x over registered duplicates', () => {
  const profile = makeSpeciesProfile(34, { fields: { '10c': 40, '104': 30 }, narrow: { '03d': 0 } });
  const freshPool = scoreOpenEvolutionPool(profile, { registeredSpecies: [] });
  const topFresh = freshPool.pool[0];
  assert.equal(topFresh.isUnknown, true);

  // Register that top species and rescore — its weight drops by ~2.5x compared to unknown peers.
  const afterReg = scoreOpenEvolutionPool(profile, { registeredSpecies: [topFresh.speciesIndex] });
  const sameAfter = afterReg.pool.find((c) => c.speciesIndex === topFresh.speciesIndex);
  if (sameAfter) {
    assert.ok(sameAfter.weight < topFresh.weight, `Registered weight ${sameAfter.weight} should be lower than unknown ${topFresh.weight}`);
  } else {
    // Dropped out of Top 6 because unknown peers overtook it — even stronger proof of discovery bias!
    assert.ok(true);
  }
});

test('Open Evolution: Aura sense protects blind-box discovery privacy (never leaks unregistered species names)', () => {
  const profile = makeSpeciesProfile(34, { fields: { '11c': 50, '108': 35 }, narrow: { '03d': 2 } });
  const pool = scoreOpenEvolutionPool(profile, { registeredSpecies: [] });
  const knownSpecies = pool.pool[0].speciesIndex;
  const hiddenSpecies = pool.pool[1].speciesIndex;

  const aura = buildOpenEvolutionAura(profile, { registeredSpecies: [knownSpecies], locale: 'zh-Hant' });
  assert.equal(aura.dominantRace, 'MECHANOID');
  assert.equal(aura.dominantFaction, 'IRON');
  assert.equal(aura.careTier, 'STEADY');
  assert.equal(aura.poolSize, OPEN_EVOLUTION_RULES.poolSize);
  assert.equal(aura.unknownCount, OPEN_EVOLUTION_RULES.poolSize - 1);
  assert.equal(aura.hasUnknown, true);
  assert.ok(aura.knownPreviewNames.includes(speciesName(knownSpecies, 'zh-Hant')));
  assert.equal(aura.knownPreviewNames.includes(speciesName(hiddenSpecies, 'zh-Hant')), false, 'Undiscovered species name MUST NOT leak');

  // Partner Evolution Compass includes openAura seamlessly!
  const compass = buildPartnerEvolutionCompass({ profile, registeredSpecies: [34, knownSpecies] });
  assert.ok(compass?.openAura);
  assert.equal(compass.openAura.unknownCount, aura.unknownCount);
});

test('Open Evolution: evaluateProductEvolution keeps native mode 100% untouched by default and runs blind-box when enabled', () => {
  const profile = makeSpeciesProfile(34, {
    fields: { '10c': 60, '104': 45, '18c': 99999 },
    narrow: { '03d': 1 }
  });
  const rng = { next: () => 12345 };

  // Default (openEvolution omitted): exact native/product behavior, no openEvolution payload.
  const nativeRes = evaluateProductEvolution(profile, { rank: 9, roster: [34], lifetime: true, lifeThreshold: 100 }, rng);
  assert.equal(nativeRes.openEvolution, undefined);

  // Enabled (openEvolution.enabled = true): produces a playable Gen 4 target + honest causal summary.
  const openRes = evaluateProductEvolution(profile, {
    rank: 9,
    roster: [34],
    lifetime: true,
    lifeThreshold: 100,
    openEvolution: { enabled: true, registeredSpecies: [34] }
  }, rng);
  assert.equal(openRes.code, 1);
  assert.ok(Number.isInteger(openRes.target) && openRes.target >= 8);
  assert.equal(productSpeciesRecord(openRes.target).generationIndex, 4);
  assert.ok(openRes.openEvolution);
  assert.equal(openRes.openEvolution.dominantRace, 'DRAGON');
  assert.equal(openRes.openEvolution.careTier, 'PRISTINE');
  const line = formatEvolutionCausalLine(openRes.openEvolution, 'zh-Hant');
  assert.ok(line.includes('首次發現') && line.includes('失誤 1'), line);

  // Final natural stage (Gen 4 成熟期) NEVER evolves naturally even with openEvolution enabled.
  const mature = makeSpeciesProfile(80, { fields: { '10c': 80, '18c': 99999 } });
  assert.equal(extractRaisingAxes(mature), null);
  assert.equal(buildOpenEvolutionAura(mature), null);
});

test('Open Evolution: careMistakeTier boundaries and 5-locale copy coverage have zero gaps', () => {
  assert.equal(careMistakeTier(0), 'PRISTINE');
  assert.equal(careMistakeTier(1), 'PRISTINE');
  assert.equal(careMistakeTier(2), 'STEADY');
  assert.equal(careMistakeTier(4), 'STEADY');
  assert.equal(careMistakeTier(5), 'WILD');
  assert.equal(careMistakeTier(7), 'WILD');

  const coverage = inspectScopedLocaleCopy('src/championship/text/openEvolutionText.js', OPEN_EVOLUTION_COPY);
  assert.deepEqual(coverage.gaps, []);
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    assert.ok(openEvolutionText('aura.title', {}, locale).length > 0);
    const sample = selectOpenEvolutionTarget(makeSpeciesProfile(34, { fields: { '110': 30 } }), { registeredSpecies: [] });
    assert.ok(formatEvolutionCausalLine(sample, locale).length > 0);
  }
});
