// Owner 2026-11-03 (AUTO_CARE_3D_20261103): the auto-feeder and the cleaner are consumables (one core = one
// hour, batteries stack to 24 h, the royal dual core runs both), drawn as 3D machines: a cleaning robot that
// strolls its cage's connected cluster and drives to droppings, and a feeding tower that lobs the player's own
// meat (-1 餵食 a throw) at partners showing the hungry bubble. No banner over the cage any more.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { FRIENDS_PLAYTEST_POLICY } from '../src/championship/app/friendsPlaytestPolicy.js';
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from '../src/championship/app/championshipStandaloneSave.js';
import { AUTOMATION_ITEMS, AUTOMATION_RULES, cageAutomation, formatRunClock } from '../src/championship/gacha/ranchAutomation.js';
import { normalizeCyberGacha, deployAutomationCore, tickAutomationRuns, settleRanchAutomation, grantGachaAutomation } from '../src/championship/gacha/cyberGacha.js';
import { AUTO_CARE_RULES, AUTO_CARE_WORLD_UNIT, createCleanerBot, stepCleanerBot, cleanerCuriosity, stepCleanerRider, createFeederTower,
  stepFeederTower, planMachineRoute, machineComponent, meatArc } from '../src/championship/raising/autoCareMachines.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const source = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const species = read('src/data/championship/catalogs/creature-species.r1.json');
const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;

function harness({ seed = null } = {}) {
  const data = new Map(seed ? [[CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(seed)]] : []), storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
  const make = () => createChampionshipStandaloneApp({ playtestPolicy: FRIENDS_PLAYTEST_POLICY, storage, locks: null, cages, catalog: species });
  return { data, make, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)) };
}
const grant = (state, id, n) => grantGachaAutomation(state, id, n).state;
const meatOf = (app) => app.getShopFrame().listings.find((row) => row.shopRecordIndex === 0).owned;

// ---- consumable quantity rules ----------------------------------------------------------

test('three cores: the robot, the feeder and the royal dual core (both machines)', () => {
  const cores = AUTOMATION_ITEMS.filter((i) => i.kind === 'CORE');
  assert.deepEqual(cores.map((i) => [i.id, i.name, i.modules]), [
    ['auto:clean-core', '奈米掃地機器人', ['AUTO_CLEAN']],
    ['auto:feed-core', '智慧自動餵食機', ['AUTO_FEED']],
    ['auto:royal-core', '皇家雙效核心', ['AUTO_CLEAN', 'AUTO_FEED']]]);
  assert.equal(AUTOMATION_RULES.runSeconds, 3600);
  assert.equal(AUTOMATION_RULES.runCapSeconds, 24 * 3600);
  assert.equal(formatRunClock(3600), '1:00:00');
  assert.equal(formatRunClock(3550), '59:10');
});

test('each deploy uses one core and adds 3600 s; a battery stacks the hours, up to 24', () => {
  let state = grant(normalizeCyberGacha(null), 'auto:feed-core', 3);
  const cage = 'cage:instance:7';
  let r = deployAutomationCore(state, 'auto:feed-core', cage);
  assert.equal(r.ok, true); assert.equal(r.extended, false);
  state = r.state;
  assert.equal(state.automation['auto:feed-core'], 2, 'one core used up');
  assert.deepEqual(state.runs[cage], { AUTO_FEED: 3600 });
  r = deployAutomationCore(state, 'auto:feed-core', cage);
  assert.equal(r.extended, true); state = r.state;
  assert.equal(state.runs[cage].AUTO_FEED, 7200, 'battery: 2 hours');
  assert.equal(state.automation['auto:feed-core'], 1);
  // Another, unconnected cage takes the last one: two towers at once.
  state = deployAutomationCore(state, 'auto:feed-core', 'cage:instance:9').state;
  assert.equal(state.automation?.['auto:feed-core'] ?? 0, 0);
  assert.equal(deployAutomationCore(state, 'auto:feed-core', cage).reason, 'NOT_OWNED');
  const auto = cageAutomation(state, cage);
  assert.equal(auto.feed, true); assert.equal(auto.clean, false); assert.equal(auto.feedSeconds, 7200);
  // The cap.
  let capped = grant(normalizeCyberGacha(null), 'auto:clean-core', 30);
  for (let i = 0; i < 24; i++) capped = deployAutomationCore(capped, 'auto:clean-core', cage).state;
  assert.equal(capped.runs[cage].AUTO_CLEAN, 86400);
  assert.equal(deployAutomationCore(capped, 'auto:clean-core', cage).reason, 'RUN_FULL');
  assert.equal(capped.automation['auto:clean-core'], 6);
});

test('the royal dual core runs both machines for an hour each', () => {
  const state = deployAutomationCore(grant(normalizeCyberGacha(null), 'auto:royal-core', 1), 'auto:royal-core', 'cage:instance:3').state;
  assert.deepEqual(state.runs['cage:instance:3'], { AUTO_CLEAN: 3600, AUTO_FEED: 3600 });
  const auto = cageAutomation(state, 'cage:instance:3');
  assert.equal(auto.clean && auto.feed, true);
});

test('runs count down; a tower out of meat holds its time; an empty run folds away', () => {
  let state = grant(normalizeCyberGacha(null), 'auto:royal-core', 1);
  state = deployAutomationCore(state, 'auto:royal-core', 'cage:instance:3').state;
  let t = tickAutomationRuns(state, 600, { paused: { 'cage:instance:3': ['AUTO_FEED'] } });
  assert.deepEqual(t.state.runs['cage:instance:3'], { AUTO_CLEAN: 3000, AUTO_FEED: 3600 }, 'the feeder waited');
  t = tickAutomationRuns(t.state, 3000);
  assert.deepEqual(t.expired, [{ instanceId: 'cage:instance:3', module: 'AUTO_CLEAN' }]);
  assert.deepEqual(t.state.runs['cage:instance:3'], { AUTO_FEED: 600 });
  t = tickAutomationRuns(t.state, 600);
  assert.equal(t.state.runs, undefined, 'nothing left running');
});

test('a core still mounted in an older save comes back into the bag once; a removed cage refunds whole hours', () => {
  const old = normalizeCyberGacha({ version: 1, automation: { 'auto:feed-core': 1 }, mounts: { 'cage:instance:4': ['AUTO_CLEAN', 'AUTO_FEED'] } });
  assert.equal(old.mounts, undefined);
  assert.deepEqual(old.automation, { 'auto:feed-core': 2, 'auto:clean-core': 1 });
  let state = deployAutomationCore(grant(normalizeCyberGacha(null), 'auto:clean-core', 2), 'auto:clean-core', 'cage:instance:5').state;
  state = deployAutomationCore(state, 'auto:clean-core', 'cage:instance:5').state;
  state = tickAutomationRuns(state, 1200).state;          // 1 h 40 min left
  const settled = settleRanchAutomation(state, { liveInstanceIds: [] }).state;
  assert.equal(settled.runs, undefined);
  assert.equal(settled.automation['auto:clean-core'], 1, 'one whole hour came back');
});

// ---- the machines, on a small synthetic ground ----------------------------------------------
// Two cages joined by an open seam (component 0) and a third, separate cage (component 1).
function syntheticGround() {
  const width = 60, height = 20, terrain = new Uint8Array(width * height).fill(1), owners = new Int16Array(width * height).fill(-1);
  const fill = (x0, x1, owner) => { for (let y = 2; y < 18; y++) for (let x = x0; x < x1; x++) { terrain[y * width + x] = 0; owners[y * width + x] = owner; } };
  fill(2, 18, 0); fill(18, 34, 1); fill(42, 58, 2);
  const component = new Int32Array(width * height).fill(-1);
  for (let i = 0; i < terrain.length; i++) if (!terrain[i]) component[i] = (i % width) < 40 ? 0 : 1;
  return { width, height, readTerrain: (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 1 : terrain[y * width + x]),
    readClearance: () => 2, cageAt: (x, y) => { const o = owners[Math.floor(y / 8) * width + Math.floor(x / 8)]; return o >= 0 ? { ownerIndex: o } : null; },
    navigation: { component } };
}

test('the robot strolls the whole connected cluster at 0.8 units/s and never leaves it', () => {
  const ground = syntheticGround();
  const bot = createCleanerBot({ id: 'clean:a', instanceId: 'a', home: [40, 80], ground });
  assert.equal(bot.component, 0);
  const seen = new Set(); let travelled = 0, maxSpeed = 0, last = [bot.x, bot.y];
  for (let i = 0; i < 60 * 240; i++) {
    stepCleanerBot(bot, 1 / 60, { ground });
    assert.equal(machineComponent(ground, bot.x, bot.y), 0, `left the cluster at ${bot.x},${bot.y}`);
    const step = Math.hypot(bot.x - last[0], bot.y - last[1]); travelled += step; maxSpeed = Math.max(maxSpeed, step * 60); last = [bot.x, bot.y];
    seen.add(ground.cageAt(bot.x, bot.y)?.ownerIndex);
  }
  assert.ok(travelled > 300, `it keeps moving (${travelled.toFixed(0)} px)`);
  assert.ok(maxSpeed <= AUTO_CARE_RULES.strollSpeed + 0.01, `stroll speed ${maxSpeed}`);
  assert.equal(Math.round(AUTO_CARE_RULES.strollSpeed / AUTO_CARE_WORLD_UNIT * 10), 8);
  assert.ok(seen.has(0) && seen.has(1), `both joined cages visited: ${[...seen]}`);
  assert.ok(!seen.has(2), 'the separate cage is not part of its patrol');
});

test('a dropping in the cluster: lock on, drive there at 2.0 units/s, sweep 0.4 s', () => {
  const ground = syntheticGround();
  const bot = createCleanerBot({ id: 'clean:b', instanceId: 'a', home: [40, 80], ground });
  const waste = [{ key: 'w1', x: 250, y: 90 }, { key: 'far', x: 400, y: 90 }];
  const events = []; let maxSpeed = 0, last = [bot.x, bot.y], sweepStart = null;
  for (let i = 0; i < 60 * 20 && !events.some((e) => e.kind === 'SWEPT'); i++) {
    for (const e of stepCleanerBot(bot, 1 / 60, { ground, waste })) events.push({ ...e, at: i / 60 });
    maxSpeed = Math.max(maxSpeed, Math.hypot(bot.x - last[0], bot.y - last[1]) * 60); last = [bot.x, bot.y];
    if (bot.mode === 'SWEEP' && sweepStart === null) sweepStart = i / 60;
  }
  assert.equal(events[0].kind, 'LOCK'); assert.equal(events[0].key, 'w1', 'the dropping in its own cluster, not the one in the other cage');
  const swept = events.find((e) => e.kind === 'SWEPT');
  assert.ok(swept, JSON.stringify(events));
  assert.ok(Math.hypot(bot.x - 250, bot.y - 90) <= AUTO_CARE_RULES.arriveRadius + 1, 'it drove to the dropping');
  assert.ok(maxSpeed > AUTO_CARE_RULES.strollSpeed * 1.5 && maxSpeed <= AUTO_CARE_RULES.seekSpeed + 0.01, `seek speed ${maxSpeed}`);
  assert.ok(Math.abs(swept.at - sweepStart - AUTO_CARE_RULES.sweepSeconds) < 0.05, `sweep took ${swept.at - sweepStart}s`);
  assert.equal(bot.mode, 'STROLL', 'back to its stroll');
});

test('routes stay on the floor of one cluster', () => {
  const ground = syntheticGround();
  const route = planMachineRoute(ground, [40, 80], [250, 120], 0);
  assert.ok(route && route.length >= 1);
  assert.equal(planMachineRoute(ground, [40, 80], [400, 80], 0), null, 'no route into another cluster');
});

test('young partners get curious; a baby sometimes rides the robot for three seconds', () => {
  const ground = syntheticGround();
  let rides = 0, curious = 0;
  for (let n = 0; n < 60; n++) {
    const bot = createCleanerBot({ id: `clean:${n}`, instanceId: 'a', home: [40, 80], ground });
    const events = cleanerCuriosity(bot, [{ id: 'baby', x: 50, y: 82, generation: 1 }, { id: 'adult', x: 44, y: 78, generation: 3 },
      { id: 'far', x: 140, y: 80, generation: 1 }]);
    assert.ok(events.every((e) => e.partnerId === 'baby'), 'only the young partner nearby reacts');
    rides += events.filter((e) => e.kind === 'RIDE').length; curious += events.filter((e) => e.kind === 'CURIOUS').length;
    if (bot.rider) {
      let off = null;
      for (let i = 0; i < 60 * 3 + 2 && !off; i++) off = stepCleanerRider(bot, 1 / 60);
      assert.equal(off, 'baby'); assert.equal(bot.rider, null);
    }
  }
  assert.ok(rides > 0 && curious > rides, `rides ${rides}, curious ${curious}`);
});

test('the feeder aims 0.2 s, lobs for 0.55 s and lands the meat in front of the hungry partner', () => {
  const ground = syntheticGround();
  const tower = createFeederTower({ id: 'feed:a', instanceId: 'a', home: [30, 120], ground });
  const hungry = [{ id: 'p1', x: 120, y: 60 }];
  const events = [];
  for (let i = 0; i < 60 * 2; i++) for (const e of stepFeederTower(tower, 1 / 60, { ground, hungry, meat: 5 })) events.push({ ...e, at: (i + 1) / 60 });
  const [aim, thrown, land] = ['AIM', 'THROW', 'LAND'].map((k) => events.find((e) => e.kind === k));
  assert.ok(aim && thrown && land, JSON.stringify(events));
  assert.ok(Math.abs(thrown.at - aim.at - AUTO_CARE_RULES.aimSeconds) < 0.04);
  assert.ok(Math.abs(land.at - thrown.at - AUTO_CARE_RULES.throwSeconds) < 0.04);
  assert.equal(land.targetId, 'p1');
  assert.ok(Math.hypot(land.x - 120, land.y - 60) < 9, 'lands just in front of the partner');
  const top = Math.max(...Array.from({ length: 11 }, (_, i) => meatArc(thrown.from, thrown.to, i / 10).z));
  assert.ok(top > 34, 'a high lob');
  // No meat: it waits and says so.
  const empty = createFeederTower({ id: 'feed:b', instanceId: 'a', home: [30, 120], ground });
  assert.deepEqual(stepFeederTower(empty, 1 / 60, { ground, hungry, meat: 0 }), []);
  assert.equal(empty.noMeat, true);
});

// ---- the app: real ranch, real save --------------------------------------------------------

async function ranchWith(h, { cores, hungry = false, droppings = false }) {
  let app = h.make(), cageId = null;
  try {
    await app.continueGame();
    const placed = app.getCageEditFrame().placements.filter((p) => p.instanceId);
    cageId = placed[0].instanceId;
    for (const [id, n] of cores) assert.equal(app.grantAutomationItem(id, n, 'TEST').ok, true);
    app.save();
  } finally { await app.dispose(); }
  const saved = h.saved();
  const grown = saved.raising.collection.filter((e) => (e.nativeProfile?.fields?.['000'] ?? 0) >= 8);
  for (const entry of grown) {
    saved.raising.nativeHome.cageAssignments = { ...saved.raising.nativeHome.cageAssignments, [entry.instanceId]: cageId };
    if (hungry) Object.assign(entry.nativeProfile.fields, { '008': 1 });
    if (droppings) Object.assign(entry.nativeProfile.fields, { '014': 25, '1c0': 0, '1c4': 0, '190': 99999 });
  }
  saved.raising.nativeHome.foods = []; saved.raising.nativeHome.waste = [];
  h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  app = h.make();
  await app.continueGame();
  return { app, cageId, partners: grown.map((e) => e.instanceId) };
}

test('app: a deployed feeder throws meat at hungry partners, -1 餵食 for each, and they are fed', async () => {
  const h = harness({ seed: read('qa/championship-full-qa-save.json') });
  const { app, cageId, partners } = await ranchWith(h, { cores: [['auto:feed-core', 2]], hungry: true });
  try {
    assert.ok(partners.length >= 1);
    const deploy = app.gachaDeployCore('auto:feed-core', cageId);
    assert.equal(deploy.ok, true, deploy.reason); assert.equal(deploy.kind, 'DEPLOY'); assert.equal(deploy.feedSeconds, 3600);
    assert.equal(app.getCyberGachaFrame().automation.find((i) => i.id === 'auto:feed-core').owned, 1, 'one left in the bag');
    const meatBefore = meatOf(app);
    assert.ok(meatBefore > partners.length, `meat in the bag: ${meatBefore}`);
    let sawThrow = false;
    for (let i = 0; i < 60 * 20; i++) {
      app.advanceNaturalClock({ frames: 1 });
      const tower = app.getAutoCareFrame().feeders[0];
      if (tower?.phase === 'THROW' && tower.from && tower.to) sawThrow = true;
    }
    const feeds = app.getAutomationEvents().filter((e) => e.kind === 'FEED');
    assert.ok(sawThrow, 'the tower threw');
    assert.ok(feeds.length >= 1 && feeds.every((e) => e.meat === 1 && e.cageInstanceId === cageId), JSON.stringify(feeds));
    assert.equal(meatOf(app), meatBefore - feeds.length, 'exactly one 餵食 per piece of meat');
    app.save();
    const after = h.saved();
    for (const e of feeds) {
      const fields = after.raising.collection.find((c) => c.instanceId === e.instanceId).nativeProfile.fields;
      assert.ok((fields['008'] | 0) > AUTOMATION_RULES.hungrySatiety, `${e.instanceId} is full`);
    }
    // The hour ran down while it worked; the bag shows the run.
    const left = after.progression.cyberGacha.runs[cageId].AUTO_FEED;
    assert.ok(left < 3600 && left >= 3600 - 21, `seconds left ${left}`);
    // A battery: +1 hour on the same tower.
    const battery = app.gachaDeployCore('auto:feed-core', cageId);
    assert.equal(battery.kind, 'EXTEND'); assert.ok(battery.feedSeconds > 3600 + 3500);
  } finally { await app.dispose(); }
});

test('app: with no meat the tower throws nothing and its hour waits', async () => {
  const h = harness({ seed: read('qa/championship-full-qa-save.json') });
  const { app, cageId } = await ranchWith(h, { cores: [['auto:feed-core', 1]], hungry: true });
  try {
    assert.equal(app.gachaDeployCore('auto:feed-core', cageId).ok, true);
    app.save();
    const saved = h.saved(); saved.shop.quantities[0] = 0;
    h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  } finally { await app.dispose(); }
  const app2 = h.make();
  try {
    await app2.continueGame();
    for (let i = 0; i < 60 * 8; i++) app2.advanceNaturalClock({ frames: 1 });
    assert.equal(app2.getAutomationEvents().filter((e) => e.kind === 'FEED').length, 0, 'no free meat');
    const tag = app2.getCageAutomationFrame().find((t) => t.kind === 'FEED');
    assert.equal(tag.noMeat, true, 'the tag says 缺肉待補');
    assert.equal(tag.seconds, 3600, 'the hour did not run down');
  } finally { await app2.dispose(); }
});

test('app: the robot patrols and sweeps the droppings in its cluster (+50 bits each)', async () => {
  // A wallet below the cap, so every sweep's +50 is paid.
  const seed = read('qa/championship-full-qa-save.json'); seed.shop.bits = 1000;
  const h = harness({ seed });
  const { app, cageId } = await ranchWith(h, { cores: [['auto:clean-core', 1]], droppings: true });
  try {
    assert.equal(app.gachaDeployCore('auto:clean-core', cageId).ok, true);
    const bitsBefore = app.getShopFrame().bits;
    const path = [];
    for (let i = 0; i < 60 * 60; i++) {
      app.advanceNaturalClock({ frames: 1 });
      const bot = app.getAutoCareFrame().cleaners[0];
      if (i % 30 === 0 && bot) path.push([bot.x, bot.y]);
    }
    const moved = path.some(([x, y]) => Math.hypot(x - path[0][0], y - path[0][1]) > 24);
    assert.ok(moved, 'the robot moves about');
    const events = app.getAutomationEvents();
    const cleans = events.filter((e) => e.kind === 'CLEAN');
    assert.ok(events.some((e) => e.kind === 'LOCK'), 'it locked on to a dropping');
    assert.ok(cleans.length >= 1 && cleans.every((e) => e.bits === 50), JSON.stringify(cleans));
    assert.equal(app.getShopFrame().bits, bitsBefore + 50 * cleans.length);
    const tags = app.getCageAutomationFrame();
    assert.equal(tags.length, 1); assert.equal(tags[0].kind, 'CLEAN'); assert.ok(tags[0].seconds <= 3600 - 59);
  } finally { await app.dispose(); }
});

test('the banner and the floor stickers are gone; the machines are 3D props in the ranch scene', () => {
  const view = source('src/championship/app/raisingHomeP1RView.js'), css = source('src/championship/app/intRh2Styles.css');
  assert.doesNotMatch(view, /全自動飼育運轉中|int-rh2-cage-device|int-rh2-cage-auto/);
  assert.doesNotMatch(css, /int-rh2-cage-auto|int-rh2-cage-device/);
  assert.match(view, /int-rh2-care-tag/);
  const scene = source('src/championship/presentation/ranchThreeScene.js');
  assert.match(scene, /createRanchAutoCareProps/);
  const props = source('src/championship/presentation/ranchAutoCareProps.js');
  assert.match(props, /auto_cleaner_bot\.glb/); assert.match(props, /auto_feeder_tower\.glb/);
  for (const glb of ['auto_cleaner_bot.glb', 'auto_feeder_tower.glb']) {
    const bytes = fs.readFileSync(new URL(`../assets/production/items/auto-care-3d-r1/${glb}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'glTF', glb);
  }
  assert.ok(fs.existsSync(new URL('../scripts/blender/build_auto_care_3d_props.py', import.meta.url)));
});
