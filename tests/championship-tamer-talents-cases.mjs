import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {TALENT_NODES, TALENT_KEYSTONES, TALENT_LINES, TALENT_TREE_POINTS, TALENT_WIRED_KEYS, TAMER_LEVEL_MAX, TAMER_EXP,
  tamerExpRequired, tamerTalentPoints, normalizeTamerTalents, createTamerTalentState, talentRefusal, learnTalent, keystoneRefusal,
  chooseKeystone, respecTalents, talentRespecCost, talentSpent, talentSpentInLine, talentValue, grantTamerExp, tamerCaptureExp,
  tamerBattleExp, commanderCappedTalents, talentOpen} from '../src/championship/contracts/productTamerTalents.js';
import {gradeFromNoise, fusionLineMultiplier, fusionExp} from '../src/championship/contracts/productLineFusion.js';
import {huntHerdCount} from '../src/championship/hunt/capture/productHuntHerds.js';
import {syncExpRequired, syncBattleExp} from '../src/championship/contracts/productSyncLevel.js';

// TAMER_TALENTS_20261117 T1 (docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md sections 3-4).

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

test('the tree costs 124 points: four lines of three tiers, nine points a tier, and a four-point keystone', () => {
  assert.equal(TALENT_NODES.length, 36); assert.equal(TALENT_KEYSTONES.length, 8);
  for (const line of TALENT_LINES) {
    const nodes = TALENT_NODES.filter(node => node.line === line);
    for (const tier of [1, 2, 3]) assert.equal(nodes.filter(node => node.tier === tier).reduce((sum, node) => sum + node.max * node.cost, 0), 9, `${line} tier ${tier}`);
    assert.equal(TALENT_KEYSTONES.filter(key => key.line === line).length, 2);
  }
  assert.equal(TALENT_NODES.reduce((sum, node) => sum + node.max * node.cost, 0) + 4 * 4, TALENT_TREE_POINTS);
  assert.equal(new Set(TALENT_NODES.map(node => node.key)).size, 36, 'one effect key a node');
});

test('points are worked out from the level, the title rank and the Dex, about 76 at the top', () => {
  assert.equal(tamerTalentPoints({level: 1, rank: 0, registered: 0}), 0);
  assert.equal(tamerTalentPoints({level: 10, rank: 2, registered: 60}), 9 + 4 + 2);
  assert.equal(tamerTalentPoints({level: 50, rank: 9, registered: 232}), 49 + 18 + 9);
  assert.equal(tamerTalentPoints({level: 99, rank: 40, registered: 0}), 49 + 18, 'level and rank stop at their own caps');
});

test('the level curve is 40 x level^1.3 and EXP carries over levels, stopping at Lv.50', () => {
  assert.equal(tamerExpRequired(1), 40);
  let total = 0; for (let level = 1; level < 10; level++) total += tamerExpRequired(level);
  assert.equal(total, 3078, 'the plan table: Lv.10 at 3,078');
  const first = grantTamerExp(null, 40);
  assert.deepEqual(first.gain.after, {level: 2, exp: 0, next: tamerExpRequired(2)}); assert.equal(first.gain.levels, 1);
  const top = grantTamerExp({version: 1, level: 49, exp: 0, nodes: {}, keystones: {}, respecs: 0}, 10 ** 7);
  assert.equal(top.state.level, TAMER_LEVEL_MAX); assert.equal(top.state.exp, 0);
  assert.equal(tamerCaptureExp('S'), 32); assert.equal(tamerCaptureExp('C'), 16); assert.equal(tamerCaptureExp(null), 20);
  assert.equal(tamerBattleExp('TITLE', true), 60); assert.equal(tamerBattleExp('FREE', false), 12); assert.equal(tamerBattleExp('LINK', true), 0);
});

test('a node needs its tier open, a free point and a wired effect; a rank is one point', () => {
  let state = createTamerTalentState();
  assert.equal(talentRefusal(state, 'hunter.memory', 0), 'TALENT_NO_POINTS');
  assert.equal(talentRefusal(state, 'hunter.herdSense', 10), 'TALENT_TIER_LOCKED', 'tier two opens at six points in the line');
  assert.equal(talentRefusal(state, 'nope', 10), 'TALENT_UNKNOWN');
  const closed = TALENT_NODES.find(node => !TALENT_WIRED_KEYS.has(node.key));
  assert.equal(talentRefusal(state, closed.id, 99), 'TALENT_NOT_OPEN', 'a node whose effect is not wired cannot take a point');
  for (const id of ['hunter.memory', 'hunter.memory', 'hunter.memory', 'hunter.breath', 'hunter.breath', 'hunter.breath']) state = learnTalent(state, id, 10);
  assert.equal(talentRefusal(state, 'hunter.memory', 10), 'TALENT_MAX');
  assert.equal(talentSpentInLine(state, 'hunter'), 6); assert.equal(talentSpent(state), 6);
  state = learnTalent(state, 'hunter.herdSense', 10);
  assert.equal(talentValue(state, 'memoryG'), 24); assert.equal(talentValue(state, 'huntSeconds'), 15); assert.equal(talentValue(state, 'herdExtra'), 1);
  assert.equal(learnTalent(state, 'hunter.herdSense', 7), null, 'seven points are all spent');
  assert.equal(talentValue(null, 'memoryG'), 0);
});

test('every line can reach tier two with the nodes open in T1 where its tier two has an open node', () => {
  for (const line of TALENT_LINES) {
    const open = tier => TALENT_NODES.filter(node => node.line === line && node.tier === tier && talentOpen(node.id));
    if (open(2).length === 0) continue;
    assert.ok(open(1).reduce((sum, node) => sum + node.max * node.cost, 0) >= 6, `${line}: tier one has six points to spend`);
  }
});

test('a line takes one of its two keystones at 22 points, and a respec gives everything back', () => {
  const full = {version: 1, level: 50, exp: 0, respecs: 0, keystones: {},
    nodes: Object.fromEntries(TALENT_NODES.filter(node => node.line === 'hunter').map(node => [node.id, node.max]))};
  assert.equal(talentSpentInLine(full, 'hunter'), 27);
  assert.equal(keystoneRefusal(full, 'hunter.keenEye', 76), 'TALENT_NOT_OPEN', 'keystones open in a later batch');
  assert.equal(chooseKeystone(full, 'hunter.keenEye', 76), null);
  const saved = normalizeTamerTalents({...full, keystones: {hunter: 'hunter.keenEye', breeder: 'hunter.chainHunt'}});
  assert.deepEqual(saved.keystones, {hunter: 'hunter.keenEye'}, 'a keystone of another line is dropped');
  assert.equal(talentSpentInLine(saved, 'hunter'), 31);
  assert.equal(talentRespecCost(saved), 0, 'the first respec is free');
  const reset = respecTalents(saved);
  assert.deepEqual([reset.nodes, reset.keystones, reset.respecs, reset.level], [{}, {}, 1, 50]);
  assert.equal(talentRespecCost(reset), 500);
  assert.equal(respecTalents(reset), null, 'nothing to give back');
});

test('an unknown save shape starts again, and ranks are clamped to the node', () => {
  assert.deepEqual(normalizeTamerTalents('x'), createTamerTalentState());
  assert.deepEqual(normalizeTamerTalents({version: 2, level: 9}), createTamerTalentState());
  const fixed = normalizeTamerTalents({version: 1, level: 99, exp: -4, nodes: {'hunter.memory': 9, 'trader.belt': 3, bogus: 2}, keystones: {hunter: 'x'}, respecs: 2});
  assert.deepEqual(fixed, {version: 1, level: 50, exp: 0, nodes: {'hunter.memory': 3, 'trader.belt': 1}, keystones: {}, respecs: 2});
});

test('title matches count only the first 6 + 3 x rank commander points, in the tree order', () => {
  const state = {version: 1, level: 50, exp: 0, respecs: 0, keystones: {commander: 'commander.triColor'},
    nodes: {...Object.fromEntries(TALENT_NODES.filter(node => node.line === 'commander').map(node => [node.id, 3])), 'hunter.memory': 3}};
  const rank0 = commanderCappedTalents(state, 0);
  // Six points: one rank of each tier-one node, then the second rank of each.
  assert.deepEqual(Object.entries(rank0.nodes).filter(([id]) => id.startsWith('commander.')),
    [['commander.syncTraining', 2], ['commander.opening', 2], ['commander.goodMood', 2]]);
  assert.equal(rank0.keystones.commander, undefined);
  assert.equal(rank0.nodes['hunter.memory'], 3, 'the other lines are not battle talents and are left alone');
  assert.equal(talentValue(commanderCappedTalents(state, 1), 'syncExpPercent'), 15, 'nine points cover all of tier one');
  const rank7 = commanderCappedTalents(state, 7);
  assert.equal(Object.entries(rank7.nodes).filter(([id]) => id.startsWith('commander.')).reduce((sum, [, rank]) => sum + rank, 0), 27);
  assert.equal(rank7.keystones.commander, undefined, '27 points leave none of the four a keystone costs');
  assert.equal(commanderCappedTalents(state, 9).keystones.commander, 'commander.triColor', '33 points: the whole line');
});

test('the wired effects change what the rules work out, inside their caps', () => {
  // 識貨: S and A each up by a tenth of themselves a rank, taken from C.
  const share = percent => { const out = {S: 0, A: 0, B: 0, C: 0}; for (let i = 0; i < 10000; i++) out[gradeFromNoise((i + 0.5) / 10000, percent)]++; return out; };
  assert.deepEqual(share(0), {S: 500, A: 2000, B: 3500, C: 4000});
  assert.deepEqual(share(30), {S: 650, A: 2600, B: 3500, C: 3250});
  // 同線親和: the lower-stage share 0.6 -> 0.9 and no further; the same species stays 1.
  const ancestors = index => ({5: [4], 4: []})[index] ?? [];
  assert.deepEqual([0, 0.1, 0.3, 0.9].map(bonus => fusionLineMultiplier(5, 4, ancestors, bonus)), [0.6, 0.7, 0.9, 0.9]);
  assert.equal(fusionLineMultiplier(5, 5, ancestors, 0.3), 1);
  // 同調融合: +10 % a rank on the base share, not on the EXP the fodder carried.
  const required = syncExpRequired(20);
  assert.equal(fusionExp({required, grade: 'B', line: 1, bonusPercent: 30}), Math.round(required * 0.25 * 1.3));
  assert.equal(fusionExp({required, grade: 'B', line: 1, carried: 100, bonusPercent: 30}), Math.round(required * 0.25 * 1.3) + 50);
  // 群聚嗅覺: one more partner a rank, never past twenty.
  assert.deepEqual([huntHerdCount(8, 8, 3), huntHerdCount(16, 16, 3), huntHerdCount(19, 19, 3)], [6, 4, 1]);
});

// ---- The application ----

function qaHarness(options = {}) {
  const data = new Map(), storage = {failing: false, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (this.failing) throw new Error('QUOTA'); data.set(key, value); }};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-17T00:00:00.000Z', ...options});
  return {data, storage, cages, make};
}
const idOf = n => `championship:2026:instance:000${n}`;
async function talentApp(talents, extra = save => save) {
  const {data, storage, cages, make} = qaHarness();
  const first = make();
  await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  if (talents) save.progression.tamerTalents = talents;
  extra(save);
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make();
  await app.continueGame();
  return {app, storage, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

test('the tree frame shows the level, the points worked out and why each node can or cannot be taken', async () => {
  const {app} = await talentApp({version: 1, level: 10, exp: 5, nodes: {}, keystones: {}, respecs: 0});
  try {
    const frame = app.getTamerTalentFrame();
    assert.equal(frame.level, 10); assert.equal(frame.exp, 5); assert.equal(frame.next, tamerExpRequired(10));
    assert.ok(frame.points >= 9, 'nine from the level, more from the QA rank and Dex');
    assert.equal(frame.spent, 0); assert.equal(frame.free, frame.points);
    assert.deepEqual(frame.lines.map(line => line.line), ['hunter', 'breeder', 'commander', 'trader']);
    const memory = frame.lines[0].nodes.find(node => node.id === 'hunter.memory');
    assert.deepEqual([memory.rank, memory.max, memory.open, memory.refusal], [0, 3, true, null]);
    assert.equal(frame.lines[0].nodes.find(node => node.id === 'hunter.herdSense').refusal, 'TALENT_TIER_LOCKED');
    assert.equal(frame.lines[0].nodes.find(node => node.id === 'hunter.swift').refusal, 'TALENT_NOT_OPEN');
    assert.ok(frame.lines.every(line => line.keystones.every(key => key.refusal === 'TALENT_NOT_OPEN')));
  } finally { await app.dispose(); }
});

test('learning a node is one save: a failed save spends nothing; a respec returns the points and costs crystals after the first', async () => {
  const {app, storage, saved, make} = await talentApp({version: 1, level: 12, exp: 0, nodes: {}, keystones: {}, respecs: 0},
    save => { save.progression.syncLevels = {version: 1, partners: {}, crystals: 600}; });
  let reloaded = null;
  try {
    const before = saved();
    storage.failing = true;
    assert.deepEqual(app.learnTamerTalent('hunter.memory'), {ok: false, reason: 'SAVE_FAILED'});
    storage.failing = false;
    assert.equal(app.getTamerTalentFrame().spent, 0); assert.deepEqual(saved(), before);
    assert.deepEqual(app.learnTamerTalent('hunter.swift'), {ok: false, reason: 'TALENT_NOT_OPEN'});
    assert.deepEqual(app.learnTamerTalent('hunter.memory'), {ok: true, id: 'hunter.memory'});
    assert.equal(saved().progression.tamerTalents.nodes['hunter.memory'], 1);
    assert.deepEqual(app.respecTamerTalents(), {ok: true, cost: 0});
    assert.deepEqual(saved().progression.tamerTalents.nodes, {});
    assert.deepEqual(app.respecTamerTalents(), {ok: false, reason: 'TALENT_NOTHING_SPENT'});
    app.learnTamerTalent('hunter.memory');
    assert.deepEqual(app.respecTamerTalents(), {ok: true, cost: 500});
    assert.equal(saved().progression.syncLevels.crystals, 100);
    app.learnTamerTalent('hunter.memory');
    assert.deepEqual(app.respecTamerTalents(), {ok: false, reason: 'TALENT_NO_CRYSTALS', cost: 500});
    await app.dispose();
    reloaded = make(); await reloaded.continueGame();
    const frame = reloaded.getTamerTalentFrame();
    assert.equal(frame.level, 12); assert.equal(frame.spent, 1);
    assert.equal(frame.lines[0].nodes.find(node => node.id === 'hunter.memory').rank, 1);
  } finally { await (reloaded ?? app).dispose(); }
});

test('a save from before talents loads at Lv.1 with nothing spent, and a ranch fusion pays 8 tamer EXP a fodder in its own save', async () => {
  const {app, saved} = await talentApp(null, save => {
    const row = n => save.raising.collection.find(entry => entry.instanceId === idOf(n));
    row(2).nativeProfile.fields['000'] = 87; row(2).speciesId = 'species-087';
  });
  try {
    assert.equal(saved().progression.tamerTalents, undefined);
    assert.deepEqual([app.getTamerTalentFrame().level, app.getTamerTalentFrame().spent], [1, 0]);
    assert.equal(app.fusePartners(idOf(1), [idOf(2)]).ok, true);
    assert.equal(app.getTamerTalentFrame().exp, TAMER_EXP.FUSION);
    assert.equal(saved().progression.tamerTalents.exp, TAMER_EXP.FUSION, 'paid in the fusion save');
    assert.equal(app.getTamerTalentFrame().lastGain.amount, TAMER_EXP.FUSION);
  } finally { await app.dispose(); }
});

test('fusion talents change the preview and the fusion alike', async () => {
  const state = {version: 1, level: 30, exp: 0, keystones: {}, respecs: 0,
    nodes: {'breeder.care': 3, 'breeder.nightWatch': 3, 'breeder.syncFusion': 3, 'breeder.lineAffinity': 3}};
  const setup = save => {
    const row = n => save.raising.collection.find(entry => entry.instanceId === idOf(n));
    row(2).nativeProfile.fields['000'] = 87; row(2).speciesId = 'species-087';
    row(3).nativeProfile.fields['000'] = 34; row(3).speciesId = 'species-034';
  };
  const plain = await talentApp(null, setup), skilled = await talentApp(state, setup);
  try {
    const lines = app => app.getFusionCandidates(idOf(1)).fodders.map(fodder => fodder.line);
    assert.deepEqual(lines(plain.app), [1, 0.6]); assert.deepEqual(lines(skilled.app), [1, 0.9]);
    const need = syncExpRequired(1);
    assert.equal(plain.app.previewPartnerFusion(idOf(1), [idOf(2)]).amount, fusionExp({required: need, line: 1}));
    assert.equal(skilled.app.previewPartnerFusion(idOf(1), [idOf(2)]).amount, fusionExp({required: need, line: 1, bonusPercent: 30}));
    const done = skilled.app.fusePartners(idOf(1), [idOf(2)]);
    assert.equal(done.gain.amount, fusionExp({required: need, line: 1, bonusPercent: 30}));
  } finally { await plain.app.dispose(); await skilled.app.dispose(); }
});
