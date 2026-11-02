// Builds src/data/championship/product-hunt-overlay.r1.json (OWNER_APPROVED_ADAPTATION 2026-11-02,
// STAGE_REDESIGN_BURST_20261102). Deterministic: the same tables always give the same file.
//
// Former 覺醒體/究極體 are battle burst forms and cannot be caught. Each one's slot in a biome catalog is
// taken by a 成熟期 that bursts into it (one not already in that biome), keeping its position and its
// encounter weights; when every such 成熟期 is already there, the slot goes to a capturable species that no
// hunt offers yet, chosen by the biome's habitat (element, race) and the gate's fee tier; failing that, the
// slot's encounters are dropped. Catalog lengths never change, so saved hunt modifiers stay aligned.
// The native hunt-entry file is not modified; the app reads it through this overlay.
//
// usage (repo root): node scripts/build-product-hunt-overlay.mjs [--check]
import fs from 'node:fs';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hunt = read('src/data/championship/catalogs/hunt-entry.r1.json');
const species = read('src/data/championship/catalogs/creature-species.r1.json').records;
const gates = read('src/data/championship/catalogs/gate-table.r1.json').records.filter(g => g.recordIndex !== 16);
const burst = read('src/data/championship/product-burst-evolution.r1.json');
const taxonomy = new Map(read('src/data/championship/species-taxonomy.v1.json').entries.map(e => [e.speciesIndex, e]));
const OUT = 'src/data/championship/product-hunt-overlay.r1.json';

const generation = i => species[i]?.generationIndex;
const basesOf = new Map();
for (const entry of burst.bases) for (const form of entry.forms) for (const i of [form.form, ...(form.alternates ?? [])]) {
  basesOf.set(i, [...(basesOf.get(i) ?? []), entry.base]);
}
// Habitat of each gate (product taxonomy, not ROM): preferred elements and races.
const HABITAT = {
  0: {el: ['SUN', 'WIND', 'WOOD'], race: ['BEAST', 'DRAGON']}, 1: {el: ['SUN', 'WIND', 'EARTH'], race: ['BEAST', 'AVIAN']},
  2: {el: ['WOOD', 'MOON'], race: ['SYLVAN', 'BEAST']}, 3: {el: ['WOOD', 'THUNDER'], race: ['SYLVAN', 'DRAGON']},
  4: {el: ['WATER', 'WOOD'], race: ['AQUATIC', 'NETHER']}, 5: {el: ['WATER', 'WIND'], race: ['AQUATIC', 'AVIAN']},
  6: {el: ['EARTH', 'WIND'], race: ['AVIAN', 'DRAGON']}, 7: {el: ['METAL', 'EARTH'], race: ['MECHANOID']},
  8: {el: ['METAL', 'THUNDER'], race: ['MECHANOID']}, 9: {el: ['WATER', 'MOON'], race: ['NETHER', 'AQUATIC']},
  10: {el: ['ICE', 'WATER'], race: ['BEAST', 'AQUATIC']}, 11: {el: ['EARTH', 'WIND'], race: ['AVIAN', 'BEAST']},
  12: {el: ['FIRE', 'EARTH'], race: ['DRAGON']}, 13: {el: ['FIRE', 'SUN'], race: ['BEAST', 'NETHER']},
  14: {el: ['WATER', 'SUN', 'WOOD'], race: ['AQUATIC', 'ASTRAL']}, 15: {el: ['MOON', 'THUNDER', 'METAL'], race: ['ASTRAL', 'NETHER', 'MECHANOID']}
};
const FEE_TIER = fee => fee <= 110 ? 0 : fee <= 600 ? 1 : fee <= 1350 ? 2 : 3;
const STAGE_TIERS = {1: [0, 1], 2: [0, 1, 2], 3: [0, 1, 2, 3], 4: [1, 2, 3]};
const gateOfBiome = new Map(gates.map(g => [g.dayFieldId >> 1, g]));

const catalogs = hunt.catalogs.map(c => c.map(e => e.speciesIndex));
const replacements = [], freed = [];
catalogs.forEach((catalog, biome) => catalog.forEach((index, position) => {
  if (generation(index) !== 5 && generation(index) !== 6) return;
  const base = (basesOf.get(index) ?? []).find(b => !catalog.includes(b)) ?? null;
  if (base !== null) { catalog[position] = base; replacements.push({biome, position, from: index, to: base, reason: 'BURST_BASE'}); }
  else freed.push({biome, position, from: index});
}));
// Capturable natives no hunt encounter offers once the forms are gone.
const offered = new Set();
hunt.encounters.forEach((seasons, field) => {
  const catalog = catalogs[field >> 1], original = hunt.catalogs[field >> 1];
  for (const s of seasons) for (const e of s.entries) offered.add(catalog[original.findIndex(c => c.speciesIndex === e.speciesIndex)]);
});
const missing = species.map((s, i) => i).filter(i => i >= 8 && i < 224 && [1, 2, 3, 4].includes(generation(i)) && !offered.has(i));
const score = (i, biome) => {
  const g = gateOfBiome.get(biome), t = taxonomy.get(i), habitat = HABITAT[g.recordIndex];
  return (habitat.el.includes(t?.element) ? 3 : 0) + (habitat.race.includes(t?.race) ? 2 : 0)
    + (STAGE_TIERS[generation(i)].includes(FEE_TIER(g.entranceFeeBits)) ? 2 : -5);
};
const placed = [], unplaced = [];
for (const i of missing) {
  const options = freed.filter(slot => !catalogs[slot.biome].includes(i)).sort((a, b) => score(i, b.biome) - score(i, a.biome) || a.biome - b.biome || a.position - b.position);
  const slot = options[0];
  if (!slot) { unplaced.push(i); continue; }
  freed.splice(freed.indexOf(slot), 1);
  catalogs[slot.biome][slot.position] = i;
  replacements.push({biome: slot.biome, position: slot.position, from: slot.from, to: i, reason: 'NEVER_IN_HUNT'});
  placed.push(i);
}
const dropped = freed.map(slot => ({biome: slot.biome, position: slot.position, species: slot.from}));
replacements.sort((a, b) => a.biome - b.biome || a.position - b.position);

const document = {
  schemaVersion: 1,
  contract: 'PRODUCT_HUNT_OVERLAY.v1',
  authority: 'OWNER_APPROVED_ADAPTATION_STAGE_REDESIGN_20261102',
  generator: 'scripts/build-product-hunt-overlay.mjs',
  note: 'Former 覺醒體/究極體 cannot be caught: each catalog slot keeps its position and encounter weights for a 成熟期 that bursts into it, or for a species no hunt offered. Dropped slots spawn nothing.',
  replacements,
  dropped
};
const text = JSON.stringify(document, null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) { console.error('product-hunt-overlay.r1.json is stale'); process.exit(1); }
  console.log('up to date');
} else {
  fs.writeFileSync(OUT, text);
  console.log(JSON.stringify({replaced: replacements.filter(r => r.reason === 'BURST_BASE').length, added: placed, unplaced, dropped: dropped.length}));
}
