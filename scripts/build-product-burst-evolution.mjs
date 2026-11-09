// Builds src/data/championship/product-burst-evolution.r1.json (OWNER_APPROVED_ADAPTATION 2026-11-02,
// STAGE_REDESIGN_BURST_20261102). Deterministic: the same tables always give the same file.
//
// Every 成熟期 (generation 4) gets 1-2 tier-1 forms (former 覺醒體) from its own native routes, and up to 2
// tier-2 forms (former 究極體) from the native routes of its tier-1 forms. Every form is reached by at least
// one 成熟期 and by at most FORM_CAP of them, which breaks the native funnel where seven species fell into
// one 覺醒體. Unlock conditions are the native route thresholds; a lifetime-only route gets the standard
// condition of its tier (the form's race counter, battles, win percent). Original characters that are not
// active yet stay out; the two alternate battle forms ride on their base form as a choice.
//
// usage (repo root): node scripts/build-product-burst-evolution.mjs [--check]
import fs from 'node:fs';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const lifecycle = read('src/data/championship/catalogs/raising-lifecycle.r1.json');
const species = read('src/data/championship/catalogs/creature-species.r1.json').records;
const taxonomy = new Map(read('src/data/championship/species-taxonomy.v1.json').entries.map(e => [e.speciesIndex, e]));
const extensions = read('src/data/championship/product-species-extensions.r1.json').entries;
const originals = read('src/data/championship/product-species-originals.r1.json').entries;
const OUT = 'src/data/championship/product-burst-evolution.r1.json';
const FORM_CAP = 3, TIER1_PER_BASE = 2, TIER2_PER_BASE = 2;
// Native attribute counter index (thresholds 0..10) of each race: the standard condition's counter.
const RACE_COUNTER = {DRAGON: 3, BEAST: 4, AQUATIC: 5, AVIAN: 6, SYLVAN: 7, ASTRAL: 8, NETHER: 9, MECHANOID: 10};

const generation = i => species[i]?.generationIndex;
const ids = g => species.map((s, i) => [s, i]).filter(([s, i]) => s.generationIndex === g && i >= 8 && i < 224).map(([, i]) => i);
const MA = ids(4), AW = ids(5), UL = ids(6);
const branches = i => (lifecycle.rules[i - 8] ?? []);
const standard = (form, tier) => {
  const t = Array(26).fill(0), counter = RACE_COUNTER[taxonomy.get(form)?.race];
  if (counter !== undefined) t[counter] = tier === 1 ? 30 : 60;
  t[22] = tier === 1 ? 8 : 16;
  if (tier === 2) t[23] = 50;
  return t;
};
const conditionOf = (rule, tier) => rule.kind === 1
  ? {thresholds: standard(rule.target, tier), source: 'STANDARD_FOR_LIFETIME_ROUTE'}
  : {thresholds: [...rule.thresholds], source: 'NATIVE_ROUTE'};

// ---- tier 1 ----
const tier1 = new Map(MA.map(m => [m, []])), sources1 = new Map(AW.map(a => [a, []]));
const cand1 = m => branches(m).filter(r => generation(r.target) === 5);
const add1 = (m, rule) => { tier1.get(m).push({form: rule.target, tier: 1, via: null, ...conditionOf(rule, 1)}); sources1.get(rule.target).push(m); };
const fanIn = a => MA.filter(m => cand1(m).some(r => r.target === a)).length;
for (const a of [...AW].sort((x, y) => fanIn(x) - fanIn(y) || x - y)) {
  const options = MA.map(m => ({m, rule: cand1(m).find(r => r.target === a)})).filter(o => o.rule && tier1.get(o.m).length < TIER1_PER_BASE);
  options.sort((x, y) => tier1.get(x.m).length - tier1.get(y.m).length || x.rule.kind - y.rule.kind || x.m - y.m);
  if (options[0]) add1(options[0].m, options[0].rule);
}
for (const m of MA) {
  if (!tier1.get(m).length) {
    const rule = [...cand1(m)].sort((x, y) => sources1.get(x.target).length - sources1.get(y.target).length || x.kind - y.kind)[0];
    if (rule) add1(m, rule);
  }
  for (const rule of cand1(m)) {
    if (tier1.get(m).length >= TIER1_PER_BASE) break;
    if (tier1.get(m).some(f => f.form === rule.target) || sources1.get(rule.target).length >= FORM_CAP) continue;
    add1(m, rule);
  }
}
// ---- tier 2 ----
const tier2 = new Map(MA.map(m => [m, []])), sources2 = new Map(UL.map(u => [u, []]));
const cand2 = m => tier1.get(m).flatMap(f => branches(f.form).filter(r => generation(r.target) === 6).map(rule => ({rule, via: f.form})));
const add2 = (m, {rule, via}) => { tier2.get(m).push({form: rule.target, tier: 2, via, ...conditionOf(rule, 2)}); sources2.get(rule.target).push(m); };
const fanIn2 = u => MA.filter(m => cand2(m).some(c => c.rule.target === u)).length;
for (const u of [...UL].sort((x, y) => fanIn2(x) - fanIn2(y) || x - y)) {
  const options = MA.map(m => ({m, c: cand2(m).find(c => c.rule.target === u)})).filter(o => o.c && tier2.get(o.m).length < TIER2_PER_BASE);
  options.sort((x, y) => tier2.get(x.m).length - tier2.get(y.m).length || x.m - y.m);
  if (options[0]) add2(options[0].m, options[0].c);
}
for (const m of MA) {
  if (tier2.get(m).length) continue;
  const c = cand2(m).find(c => sources2.get(c.rule.target).length < FORM_CAP);
  if (c) add2(m, c);
}
// Alternate battle forms (product extensions) are a choice on their base form.
for (const e of extensions.filter(e => e.runtimeReady && e.evolutionReady)) {
  for (const m of sources2.get(e.baseSpeciesIndex) ?? []) tier2.get(m).find(f => f.form === e.baseSpeciesIndex).alternates = [e.speciesIndex];
}

// Playable original 成熟期 (Owner 2026-11-03) come after every native base, so native assignments never move.
// Their tier-1 forms are their own ready routes and tier 2 follows those forms' native routes, under the same
// fan-in cap; a form already at the cap is taken only when it is the base's only one.
const playable = new Set(originals.filter(e => e.runtimeReady && e.evolutionReady).map(e => e.speciesIndex));
const capped = (candidates, sources, limit) => {
  const open = candidates.filter(f => (sources.get(f.form)?.length ?? 0) < FORM_CAP);
  return (open.length ? open : candidates.slice(0, 1)).slice(0, limit);
};
const originalBases = originals.filter(e => playable.has(e.speciesIndex) && e.generationIndex === 4).map(e => {
  const t1 = capped(e.evolution.filter(r => (playable.has(r.target) || r.target < 224) && generation(r.target) === 5)
    .map(rule => ({form: rule.target, tier: 1, via: null, ...conditionOf(rule, 1)})), sources1, TIER1_PER_BASE);
  for (const f of t1) sources1.get(f.form)?.push(e.speciesIndex);
  const t2 = capped(t1.flatMap(f => branches(f.form).filter(r => generation(r.target) === 6)
    .map(rule => ({form: rule.target, tier: 2, via: f.form, ...conditionOf(rule, 2)})))
    .filter((f, i, all) => all.findIndex(o => o.form === f.form) === i), sources2, TIER2_PER_BASE);
  for (const f of t2) sources2.get(f.form)?.push(e.speciesIndex);
  return {base: e.speciesIndex, forms: [...t1, ...t2]};
});

const missing1 = AW.filter(a => !sources1.get(a).length), missing2 = UL.filter(u => !sources2.get(u).length);
if (missing1.length || missing2.length) throw new Error(`BURST_FORM_UNREACHED ${missing1} ${missing2}`);
const document = {
  schemaVersion: 1,
  contract: 'PRODUCT_BURST_EVOLUTION.v1',
  authority: 'OWNER_APPROVED_ADAPTATION_STAGE_REDESIGN_20261102',
  generator: 'scripts/build-product-burst-evolution.mjs',
  note: 'A 成熟期 partner bursts in battle into a former 覺醒體 (tier 1) or 究極體 (tier 2). Thresholds use the native 26-value evolution layout and are read on the 成熟期 itself; stat percentages refer to its own curve.',
  // Awakening raising (Owner 2026-11-02): forms are raised on the ranch and learned in a ceremony; no tamer
  // rank gate. Items push a target's progress (shards and SSR metals at most itemCap percent, a UR metal fills
  // it); remembered forms halve their point and battle thresholds; transcendence stars count as rebirths.
  rules: {tierMultiplier: {1: 1.4, 2: 1.7}, oncePerBattle: true, durationSeconds: 20, durationRounds: 3, weaknessSeconds: 5,
    weaknessMultiplier: 0.85, minimumTamerRank: {1: 0, 2: 0}, unlockMetalRarity: {1: 'SSR', 2: 'UR'}, gaugeMaximum: 100,
    // GACHA_FULL_EFFECTS_20261109 (Owner 2026-11-09 balance): awakening point and battle thresholds are scaled
    // per tier (natural pace about 20 matches for tier 1 and 48 in all for tier 2), and item energy is smaller.
    awakening: {shardEnergy: {R: 5, SR: 10, SSR: 15}, metalEnergy: {SSR: {1: 30, 2: 20}}, itemCap: 40, fillRarity: 'UR',
      thresholdScale: {1: 2.5, 2: 3}, memoryThresholdPercent: 50, glowPercent: 80, ceremonyDisplaySeconds: 600,
      transcendence: {bondMinimum: 80, maxStars: 5, metalRarities: ['SSR', 'UR']}},
    battle: {manualSeconds: 6, pinchHpPercent: 30, pinchTakenMultiplier: 1.5, bondChargeBonus: 0.2, warnGauge: 80, chainFrames: 18},
    bloodlinePerks: {emma: {chargeMultiplier: 1.2}, beta: {noWeakness: true}, chronoOre: {extraSeconds: 4},
      chronoMetal: {healPercent: 15}, chronoAlloy: {cooldownMultiplier: 0.85, speedPercent: 15}, supernova: {multiplierBonus: 0.1}},
    training: {cooldownSeconds: 300, dwellSeconds: 300, afterMatchMinimumSeconds: 60, counterBestGain: 10}},
  bases: [...MA.map(m => ({base: m, forms: [...tier1.get(m), ...tier2.get(m)]})), ...originalBases]
};
const text = JSON.stringify(document, null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(OUT, 'utf8') !== text) { console.error('product-burst-evolution.r1.json is stale'); process.exit(1); }
  console.log('up to date');
} else {
  fs.writeFileSync(OUT, text);
  const fan = [...sources1.values(), ...sources2.values()].map(l => l.length);
  console.log(JSON.stringify({bases: MA.length, tier1Forms: AW.length, tier2Forms: UL.length, maxFanIn: Math.max(...fan),
    basesWithoutTier2: MA.filter(m => !tier2.get(m).length)}));
}
