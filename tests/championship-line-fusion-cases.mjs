import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {fusionLineMultiplier, fusionExp, fusionGradeMultiplier, FUSION_MAX_FODDER} from '../src/championship/contracts/productLineFusion.js';
import {syncExpRequired, fuseSyncPartners, syncTotalExp, syncOf, normalizeSyncLevels, SYNC_LEVEL_MAX}
  from '../src/championship/contracts/productSyncLevel.js';

// LINE_FUSION_20261117 P2 (docs/planning/LINE_FUSION_AND_HUNT_HERDS_PLAN_2026-11-17_ZH_TW.md section 4).

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const ancestorsOf = index => nativeHuntSpeciesByIndex(index).ancestors;
const S_GRADE = {grade: 'S', q: [90, 90, 90, 90, 90, 90]};

test('only the base species and the lower stages of its own line can be fused', () => {
  // Species 87 grows from 34 or 66; 34 grows from 21. 96 also grows from 34: a side branch of 87.
  assert.equal(fusionLineMultiplier(87, 87, ancestorsOf), 1);
  assert.equal(fusionLineMultiplier(87, 34, ancestorsOf), 0.6);
  assert.equal(fusionLineMultiplier(87, 21, ancestorsOf), 0.6, 'two stages down is still its line');
  assert.equal(fusionLineMultiplier(87, 96, ancestorsOf), 0, 'a side branch that shares a baby stage is refused');
  assert.equal(fusionLineMultiplier(34, 87, ancestorsOf), 0, 'a higher stage is never fodder for a lower one');
  assert.equal(fusionLineMultiplier(87, 79, ancestorsOf), 0);
  assert.equal(fusionLineMultiplier(87, null, ancestorsOf), 0);
});

test('one B fodder of the base species pays a quarter of the level, as the plan table says', () => {
  const table = {1: 20, 10: 448, 20: 1141, 30: 1973, 40: 2910, 49: 3827};
  for (const [level, exp] of Object.entries(table)) assert.equal(fusionExp({required: syncExpRequired(Number(level)), grade: 'B', line: 1}), exp);
  assert.deepEqual(['S', 'A', 'B', 'C', null].map(fusionGradeMultiplier), [1.6, 1.25, 1, 0.8, 1]);
  const required = syncExpRequired(20);
  assert.equal(fusionExp({required, grade: S_GRADE, line: 0.6}), Math.round(required * 0.25 * 1.6 * 0.6));
  assert.equal(fusionExp({required, grade: 'B', line: 1, carried: 301}), 1141 + 150, 'half of the Sync EXP the fodder had gathered');
  assert.equal(fusionExp({required, grade: 'B', line: 0}), 0);
});

test('each fodder is paid on the level the base has at that moment, and a saved fodder loses its record', () => {
  const state = {version: 1, crystals: 0, partners: {base: {level: 1, exp: 0, rebirths: 0}, old: {level: 3, exp: 10, rebirths: 0, grade: S_GRADE}}};
  assert.equal(syncTotalExp(state, 'old'), syncExpRequired(1) + syncExpRequired(2) + 10);
  const fused = fuseSyncPartners(state, 'base', [{instanceId: 'old', grade: S_GRADE, line: 1}, {grade: null, line: 1}, {grade: 'C', line: 0.6}]);
  let level = 1, exp = 0, total = 0;
  for (const [grade, line, carried] of [[S_GRADE, 1, syncTotalExp(state, 'old')], [null, 1, 0], ['C', 0.6, 0]]) {
    let gain = fusionExp({required: syncExpRequired(level), grade, line, carried}); total += gain;
    while (gain > 0) { const need = syncExpRequired(level) - exp; if (gain < need) { exp += gain; gain = 0; } else { gain -= need; level += 1; exp = 0; } }
  }
  assert.equal(fused.total, total);
  assert.deepEqual(syncOf(fused.state, 'base'), {level, exp, next: syncExpRequired(level)});
  assert.equal(fused.state.partners.old, undefined, 'the fodder has no Sync record left');
  assert.deepEqual(state.partners.old.grade, S_GRADE, 'the input state is not changed');
  assert.equal(fused.summary.amount, total); assert.equal(fused.summary.before.level, 1); assert.equal(fused.summary.after.level, level);
});

test('fusion refuses more than five fodder, the base itself and a fodder outside the line; Lv.50 turns it into crystals', () => {
  const state = normalizeSyncLevels({version: 1, crystals: 5, partners: {base: {level: SYNC_LEVEL_MAX, exp: 0, rebirths: 0}}});
  assert.equal(fuseSyncPartners(state, 'base', []), null);
  assert.equal(fuseSyncPartners(state, 'base', Array.from({length: FUSION_MAX_FODDER + 1}, () => ({line: 1}))), null);
  assert.equal(fuseSyncPartners(state, 'base', [{instanceId: 'base', line: 1}]), null);
  assert.equal(fuseSyncPartners(state, 'base', [{line: 0}]), null);
  const fused = fuseSyncPartners(state, 'base', [{line: 1}]);
  assert.equal(syncOf(fused.state, 'base').level, SYNC_LEVEL_MAX);
  assert.equal(fused.overflow, fused.total);
  assert.equal(fused.state.crystals, 5 + fused.total);
});

// ---- The application: ranch fusion in one save ----

function harness() {
  const data = new Map();
  const storage = {failing: false, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (this.failing) throw new Error('QUOTA'); data.set(key, value); }};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages,
    catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-17T00:00:00.000Z'});
  return {data, storage, cages, make};
}
const idOf = n => `championship:2026:instance:000${n}`;

/** The QA ranch (species 87, 96, 101, 79, 97) with partner 2 made a second 87 and partner 3 its lower stage 34. */
async function fusionApp() {
  const {data, storage, cages, make} = harness();
  const first = make();
  await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  const byId = id => save.raising.collection.find(entry => entry.instanceId === id);
  for (const [n, species] of [[2, 87], [3, 34]]) {
    const entry = byId(idOf(n));
    entry.nativeProfile.fields['000'] = species; entry.speciesId = `species-${String(species).padStart(3, '0')}`;
  }
  save.progression.syncLevels = {version: 1, crystals: 0, partners: {
    [idOf(1)]: {level: 12, exp: 100, rebirths: 0},
    [idOf(2)]: {level: 3, exp: 10, rebirths: 0, grade: S_GRADE}}};
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make();
  await app.continueGame();
  return {app, storage, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

test('the ranch lists only same-line fodder, with the line, grade and what a fodder would lose', async () => {
  const {app} = await fusionApp();
  try {
    const frame = app.getFusionCandidates(idOf(1));
    assert.deepEqual(frame.fodders.map(f => [f.instanceId, f.line, f.grade, f.refusal]), [[idOf(2), 1, 'S', null], [idOf(3), 0.6, null, null]]);
    assert.equal(frame.max, 5);
    assert.equal(frame.base.level, 12);
    assert.equal(app.getFusionCandidates(idOf(4)).fodders.length, 0, 'species 79 has no line mate here');
    const preview = app.previewPartnerFusion(idOf(1), [idOf(2), idOf(3)]);
    const first = fusionExp({required: syncExpRequired(12), grade: S_GRADE, line: 1, carried: syncExpRequired(1) + syncExpRequired(2) + 10});
    assert.ok(preview.amount > first);
    assert.equal(app.previewPartnerFusion(idOf(1), [idOf(4)]), null, 'another line');
    assert.equal(app.previewPartnerFusion(idOf(1), [idOf(2), idOf(2)]), null, 'the same fodder twice');
    const mainId = app.getRaisingInstances().find(entry => !entry.instanceId.startsWith('championship:2026:instance:')).instanceId;
    assert.deepEqual(app.fusePartners(idOf(1), [mainId]), {ok: false, reason: 'FUSION_ACTIVE_PARTNER'});
    assert.deepEqual(app.fusePartners(idOf(1), [idOf(4)]), {ok: false, reason: 'FUSION_LINE_MISMATCH'});
  } finally { await app.dispose(); }
});

test('a failed save leaves the ranch, the Sync records and the save exactly as they were', async () => {
  const {app, storage, saved} = await fusionApp();
  try {
    const before = saved(), roster = app.getRaisingInstances().map(entry => entry.instanceId), level = app.getSyncLevel(idOf(1));
    storage.failing = true;
    assert.deepEqual(app.fusePartners(idOf(1), [idOf(2), idOf(3)]), {ok: false, reason: 'SAVE_FAILED'});
    storage.failing = false;
    assert.deepEqual(app.getRaisingInstances().map(entry => entry.instanceId), roster);
    assert.deepEqual(app.getSyncLevel(idOf(1)), level);
    assert.equal(app.getPartnerGrade(idOf(2)).grade, 'S');
    assert.deepEqual(saved(), before);
  } finally { await app.dispose(); }
});

test('fusing pays the base, removes the fodder and their records, keeps the Dex, and survives a reload', async () => {
  const {app, make, saved} = await fusionApp();
  let reloaded = null;
  try {
    const expected = app.previewPartnerFusion(idOf(1), [idOf(2), idOf(3)]);
    const registered = () => app.getDatabaseFrame().entries.filter(row => row.state === 'REGISTERED').map(row => row.speciesId);
    const dexBefore = registered();
    const done = app.fusePartners(idOf(1), [idOf(2), idOf(3)]);
    assert.equal(done.ok, true);
    assert.deepEqual(done.gain, expected);
    assert.deepEqual(done.fused, [idOf(2), idOf(3)]);
    const roster = app.getRaisingInstances().map(entry => entry.instanceId);
    assert.ok(roster.includes(idOf(1)) && !roster.includes(idOf(2)) && !roster.includes(idOf(3)));
    assert.deepEqual(app.getSyncLevel(idOf(1)), {level: expected.after.level, exp: expected.after.exp, next: expected.after.next});
    assert.equal(app.getPartnerGrade(idOf(2)), null);
    assert.deepEqual(registered(), dexBefore, 'a fused species stays registered');
    const save = saved();
    assert.deepEqual(save.raising.collection.map(entry => entry.instanceId).filter(id => [idOf(2), idOf(3)].includes(id)), []);
    assert.deepEqual(Object.keys(save.progression.syncLevels.partners), [idOf(1)]);
    assert.equal(save.progression.syncLevels.partners[idOf(1)].level, expected.after.level);
    await app.dispose();
    reloaded = make();
    await reloaded.continueGame();
    assert.deepEqual(reloaded.getRaisingInstances().map(entry => entry.instanceId), roster);
    assert.deepEqual(reloaded.getSyncLevel(idOf(1)), {level: expected.after.level, exp: expected.after.exp, next: expected.after.next});
  } finally { await (reloaded ?? app).dispose(); }
});

// ---- The application: fusing on the Hunt Result ----

/** Enter the Grass gate; returns the hunt runtime. */
async function enterHunt(app) {
  app.openGate(); app.selectGate(app.getGates().find(gate => gate.biomeId === 'Grass').gateId); app.confirmGate();
  // The loadout already holds the best rope the QA ranch owns.
  await app.beginHunt();
  return app.getHuntRuntime();
}
const speciesIndexOf = wild => Number(wild.speciesIndex ?? String(wild.speciesId).replace(/\D/g, ''));

/** Rope, wear down and hand-catch one wild partner with the gestures a player uses (as the capture-save test does). */
function catchWild(runtime, id) {
  const frame = 1000 * 560190 / 33513982, find = () => runtime.getWildCreatures().find(actor => actor.wildId === id);
  runtime.selectTool('ROPE'); runtime.tick(frame);
  let target = find();
  for (let attempt = 0; attempt < 3 && !target?.bound; attempt++) {
    const x = target.worldX, y = target.worldY - 10;
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2, p = [x + 70 * Math.cos(angle), y + 70 * Math.sin(angle)];
      if (i === 0) runtime.toolPointerDown(...p); else runtime.toolPointerMove(...p);
      runtime.tick(frame);
    }
    runtime.toolPointerUp(x + 70, y); runtime.tick(frame);
    for (let i = 0; i < 35; i++) runtime.tick(frame);
    target = find();
  }
  if (!target?.bound) return false;
  runtime.toolPointerDown(target.worldX, target.worldY - 10);
  for (let i = 0; i < 6000; i++) {
    target = find();
    if (!target || target.currentHp <= 0) break;
    const tool = runtime.getToolState();
    if (!tool.rope) { runtime.selectTool('ROPE'); runtime.toolPointerDown(target.worldX, target.worldY - 10); }
    runtime.toolPointerMove(target.worldX + (tool.rope?.durability < 30 ? 40 : 180), target.worldY - 20);
    runtime.tick(frame);
  }
  if (!target || target.currentHp > 0) return false;
  runtime.toolPointerUp(target.worldX, target.worldY); for (let i = 0; i < 25; i++) runtime.tick(frame);
  runtime.selectTool('HAND'); target = find();
  if (target) { runtime.toolPointerDown(target.worldX, target.worldY - 5); runtime.toolPointerUp(target.worldX, target.worldY - 5); }
  for (let i = 0; i < 100; i++) runtime.tick(frame);
  return runtime.getOnCardEntries().some(entry => entry.wildId === id);
}

/** The QA ranch with partner 2 turned into `species`, so a catch of that species has a base of its line. */
async function huntApp(species) {
  const {data, cages, make} = harness();
  const first = make();
  await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  if (species !== null) {
    const entry = save.raising.collection.find(row => row.instanceId === idOf(2));
    entry.nativeProfile.fields['000'] = species; entry.speciesId = `species-${String(species).padStart(3, '0')}`;
  }
  save.progression.syncLevels = {version: 1, crystals: 0, partners: {[idOf(2)]: {level: 5, exp: 0, rebirths: 0}}};
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make();
  await app.continueGame();
  return {app, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

test('a catch fused on the Hunt Result never comes Home, and its EXP is paid by the Home commit', async () => {
  // Which species the Grass gate shows is the hunt's own business: look first, then give the ranch a base of that species.
  const scout = await huntApp(null);
  let species;
  try { species = speciesIndexOf((await enterHunt(scout.app)).getWildCreatures().sort((a, b) => a.maxHp - b.maxHp)[0]); }
  finally { await scout.app.dispose(); }
  const {app, saved} = await huntApp(species);
  try {
    const runtime = await enterHunt(app);
    const wild = runtime.getWildCreatures().filter(actor => speciesIndexOf(actor) === species).sort((a, b) => a.maxHp - b.maxHp)[0];
    assert.ok(wild, `the hunt still shows species ${species}`);
    assert.equal(catchWild(runtime, wild.wildId), true, 'the wild partner is on the memory card');
    app.exitHunt();
    const before = app.getRaisingInstances().map(entry => entry.instanceId), saveBefore = saved();
    let result = app.getHuntResult();
    const card = result.rows.find(row => row.kind === 'CARD');
    assert.equal(card.canFuse, true);
    assert.equal(app.requestHuntResultFusion(card.key), true);
    result = app.getHuntResult();
    // The same species pays in full; a saved partner that is a higher stage of the catch takes it at 0.6.
    assert.ok(result.pendingFusion.bases.every(base => base.line === 1 || base.line === 0.6));
    assert.equal(result.pendingFusion.bases.some(base => base.instanceId === idOf(4) && base.line === 1), false);
    const chosen = result.pendingFusion.bases.find(base => base.instanceId === idOf(2));
    assert.equal(chosen.line, 1);
    const preview = chosen.preview;
    assert.equal(preview.amount, fusionExp({required: syncExpRequired(5), grade: card.grade, line: 1}));
    assert.equal(app.confirmHuntResult(), app.getScreen(), 'Home is held while a fusion is being chosen');
    assert.equal(app.getHuntResult().pendingFusion.row.key, card.key);
    assert.equal(app.confirmHuntResultFusion(idOf(2)), true);
    result = app.getHuntResult();
    assert.equal(result.rows.some(row => row.kind === 'CARD'), false, 'the catch left the memory card');
    const base = result.rows.find(row => row.id === idOf(2));
    assert.equal(base.fusionGain.amount, preview.amount);
    assert.equal(base.canRelease, false, 'a partner promised EXP can no longer be released on this screen');
    assert.deepEqual(saved(), saveBefore, 'nothing is written before the Home commit');
    assert.deepEqual(app.getSyncLevel(idOf(2)), {level: 5, exp: 0, next: syncExpRequired(5)});
    await app.confirmHuntResult();
    assert.deepEqual(app.getRaisingInstances().map(entry => entry.instanceId), before, 'no new resident');
    assert.deepEqual(app.getSyncLevel(idOf(2)), {level: preview.after.level, exp: preview.after.exp, next: preview.after.next});
    assert.equal(saved().progression.syncLevels.partners[idOf(2)].exp, preview.after.exp);
    assert.equal(app.getHuntResult(), null);
  } finally { await app.dispose(); }
});
