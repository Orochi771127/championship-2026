// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): former 覺醒體/究極體 leave the hunts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import overlay from '../src/data/championship/product-hunt-overlay.r1.json' with {type: 'json'};
import {NATIVE_HUNT_MODIFIER_COUNTS,nativeHuntCatalogForBiome,productHuntCatalogForBiome,
  resolveNativeHuntPoolSources,resolveProductHuntPoolSources} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {burstBasesFor} from '../src/championship/contracts/productBurstEvolution.js';

const gen = i => species.records[i]?.generationIndex;
const modifiers = () => NATIVE_HUNT_MODIFIER_COUNTS.map(n => Array(n).fill(0));

test('no hunt offers a burst form; catalogs keep their length so saved modifiers stay aligned', () => {
  assert.equal(spawnSync(process.execPath, ['scripts/build-product-hunt-overlay.mjs', '--check'], {encoding: 'utf8'}).status, 0, 'overlay is current');
  for (let biome = 0; biome < 16; biome++) {
    const product = productHuntCatalogForBiome(biome), native = nativeHuntCatalogForBiome(biome);
    assert.equal(product.length, NATIVE_HUNT_MODIFIER_COUNTS[biome]);
    assert.ok(product.every(e => gen(e.speciesIndex) < 5), `biome ${biome}`);
    product.forEach((e, position) => assert.equal(e.releaseMatchValue, native[position].releaseMatchValue));
  }
  for (let field = 0; field < 32; field++) for (let season = 0; season < 4; season++) {
    const product = resolveProductHuntPoolSources({nativeHuntIndex: field, season, modifiers: modifiers()});
    const native = resolveNativeHuntPoolSources({nativeHuntIndex: field, season, modifiers: modifiers()});
    assert.ok(product.candidateInput.entries.every(e => gen(e.speciesIndex) < 5));
    assert.deepEqual(product.candidateInput.entries.map(e => e.weight), native.candidateInput.entries.map(e => e.weight), 'weights keep their slots');
    assert.equal(product.baseCount, native.baseCount);
  }
});

test('a burst form slot goes to a 成熟期 that bursts into it, or to a species no hunt offered', () => {
  const nativelyOffered = new Set();
  for (let field = 0; field < 32; field++) for (let season = 0; season < 4; season++) {
    for (const e of resolveNativeHuntPoolSources({nativeHuntIndex: field, season, modifiers: modifiers()}).candidateInput.entries) nativelyOffered.add(e.speciesIndex);
  }
  for (const r of overlay.replacements) {
    assert.ok([5, 6].includes(gen(r.from)));
    if (r.reason === 'BURST_BASE') assert.ok(burstBasesFor(r.from).includes(r.to), `${r.from} -> ${r.to}`);
    else { assert.equal(r.reason, 'NEVER_IN_HUNT'); assert.ok([1, 2, 3, 4].includes(gen(r.to))); assert.equal(nativelyOffered.has(r.to), false); }
  }
  assert.equal(overlay.replacements.length + overlay.dropped.length, 59, 'every former 覺醒體 slot is accounted for');
});
