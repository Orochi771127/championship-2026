// Data Arena (OWNER_APPROVED_ADAPTATION 2026-10-15) -- rule contract tests.
// Pure simulation only: no DOM, Pixi, timers or storage beyond an in-memory map.
import test from "node:test";
import assert from "node:assert/strict";
import { createDataArenaSimulation } from "../src/championship/modes/dataArena/dataArenaSimulation.js";
import { createDataArenaGrid } from "../src/championship/modes/dataArena/dataArenaGrid.js";
import { createFlowField } from "../src/championship/modes/dataArena/dataArenaNav.js";
import { DATA_ARENA_UPGRADES, createArenaRandom, drawUpgradeOffer, upgradeValue } from "../src/championship/modes/dataArena/dataArenaUpgrades.js";
import { createDataArenaRecordStore, DATA_ARENA_RECORD_SCHEMA } from "../src/championship/modes/dataArena/dataArenaSave.js";
import { createChampionshipDataArenaPort, CHAMPIONSHIP_DATA_ARENA_KEY } from "../src/championship/app/ChampionshipPersistentSavePort.js";
import {
  DATA_ARENA_CROWD, DATA_ARENA_GRID_RULES, DATA_ARENA_PARTNERS, DATA_ARENA_PLAYER, DATA_ARENA_STEP_SECONDS, DATA_ARENA_TERRAIN
} from "../src/championship/modes/dataArena/dataArenaConfig.js";
import { dataArenaCast, DATA_ARENA_SEQUENCES } from "../src/championship/presentation/dataArena/dataArenaRoster.js";
import { createDataArenaCamera, dataArenaBaseZoom } from "../src/championship/presentation/dataArena/dataArenaCamera.js";

const DT = DATA_ARENA_STEP_SECONDS;
const C = 64;
const center = (c, r) => ({ x: (c + 0.5) * C, y: (r + 0.5) * C });

/** A quiet arena: no spawns, the mate holds fire, so a test controls every actor. */
function quietArena(options = {}) {
  const sim = createDataArenaSimulation({ seed: 99, ...options });
  const s = sim.getState();
  s.spawnTimer = Infinity;
  s.mate.jetTimer = Infinity;
  return { sim, s };
}
function run(sim, seconds, input = {}) {
  const events = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    sim.step(typeof input === "function" ? input(sim) : input);
    events.push(...sim.drainEvents());
  }
  return events;
}
function idleEnemy(sim, kind, x, y) {
  const enemy = sim.internals.spawnEnemy(kind, x, y);
  enemy.shotTimer = Infinity;
  sim.drainEvents();
  return enemy;
}

test("laser damage accrues with time held, not per click", () => {
  const { sim, s } = quietArena();
  const enemy = idleEnemy(sim, "sentinel", s.player.x + 200, s.player.y);
  const aim = { aimX: enemy.x, aimY: enemy.y, fire: true };
  run(sim, 0.5, aim);
  const half = enemy.maxHp - enemy.hp;
  run(sim, 0.5, aim);
  const full = enemy.maxHp - enemy.hp;
  const dps = DATA_ARENA_PARTNERS[0].laserDps;
  assert.ok(Math.abs(half - dps * 0.5) <= dps * DT * 2, `half-second damage ${half}`);
  assert.ok(Math.abs(full - dps) <= dps * DT * 3, `one-second damage ${full}`);
  assert.ok(s.laser.heat > 0, "holding the beam builds heat");
  assert.equal(s.laser.endKind, "TARGET");
});

test("the beam follows the aim at a bounded turn rate", () => {
  const { sim, s } = quietArena();
  run(sim, DT, { aimX: s.player.x, aimY: s.player.y - 300, fire: true });
  assert.ok(s.laser.angle < 0 && s.laser.angle > -Math.PI / 2, "one step turns only part of the way");
  run(sim, 0.3, { aimX: s.player.x, aimY: s.player.y - 300, fire: true });
  assert.ok(Math.abs(s.laser.angle + Math.PI / 2) < 0.01, "then locks onto the aim");
});

test("holding the laser overheats, locks out, and cools down", () => {
  const { sim, s } = quietArena();
  const events = run(sim, 4, { aimX: s.player.x + 300, aimY: s.player.y, fire: true });
  assert.ok(events.some((event) => event.type === "OVERHEAT"));
  assert.equal(s.laser.firing, false);
  const cooled = run(sim, 3, { aimX: s.player.x + 300, aimY: s.player.y, fire: false });
  assert.ok(cooled.some((event) => event.type === "LASER_READY"));
  assert.equal(s.laser.overheated, false);
});

test("solid cover occludes the laser", () => {
  const { sim, s } = quietArena();
  // Container at cols 7-9, rows 7-8.
  Object.assign(s.player, center(5, 7)); s.player.y = 8 * C;
  const enemy = idleEnemy(sim, "sentinel", 11.5 * C, 8 * C);
  run(sim, 0.8, { aimX: enemy.x, aimY: enemy.y, fire: true });
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(s.laser.endKind, "WALL");
  assert.ok(s.laser.x1 <= 7 * C + 1);
});

test("move collision: the laser erases static orbs and keeps going", () => {
  const { sim, s } = quietArena();
  const enemy = idleEnemy(sim, "sentinel", s.player.x + 260, s.player.y);
  const orb = sim.internals.spawnProjectile({ kind: "ORB", owner: "boss", x: s.player.x + 120, y: s.player.y, vx: 0, vy: 0, radius: 10, damage: 9 });
  const events = run(sim, 0.25, { aimX: enemy.x, aimY: enemy.y, fire: true });
  assert.equal(orb.dead, true);
  assert.ok(events.some((event) => event.type === "CANCEL" && event.rule === "LASER_ERASES_ORB"));
  assert.ok(enemy.hp < enemy.maxHp, "the target behind the orb still takes damage");
});

test("move collision: a null shard blocks the beam until it breaks", () => {
  const { sim, s } = quietArena();
  const enemy = idleEnemy(sim, "sentinel", s.player.x + 260, s.player.y);
  const shard = sim.internals.spawnProjectile({ kind: "SHARD", owner: "boss", x: s.player.x + 120, y: s.player.y, vx: 0, vy: 0, radius: 13, damage: 15, hp: 26 });
  s.mate.state = "DOWNED"; s.mate.downedTime = -1e9; // keep the mate out of the shot line
  run(sim, 0.25, { aimX: enemy.x, aimY: enemy.y, fire: true });
  assert.equal(enemy.hp, enemy.maxHp, "shielded while the shard stands");
  assert.equal(s.laser.endKind, "SHARD");
  assert.ok(shard.hp < 26 && !shard.dead);
  const events = run(sim, 0.9, { aimX: enemy.x, aimY: enemy.y, fire: true });
  assert.ok(events.some((event) => event.type === "CANCEL" && event.rule === "LASER_BREAKS_SHARD"));
  assert.ok(enemy.hp < enemy.maxHp, "the beam reaches the target once the shard breaks");
});

test("move collision: water quenches embers (tide bolt is spent, ember gone)", () => {
  const { sim, s } = quietArena();
  const ember = sim.internals.spawnProjectile({ kind: "EMBER", owner: "enemy", x: 600, y: 600, vx: 0, vy: 0, radius: 9, damage: 10 });
  const bolt = sim.internals.spawnProjectile({ kind: "TIDE", owner: "mate", x: 560, y: 600, vx: 400, vy: 0, radius: 9, damage: 12 });
  const events = run(sim, 0.2);
  assert.equal(ember.dead, true);
  assert.equal(bolt.dead, true);
  assert.ok(events.some((event) => event.rule === "WATER_QUENCHES_EMBER"));
  assert.equal(s.stats.embersQuenched, 1);
});

test("fire spreads deterministically over flammable cells; water puts it out and keeps it out", () => {
  const grid = createDataArenaGrid();
  const i = grid.index(10, 22);
  assert.equal(grid.flammable[i], 1);
  const events = [];
  assert.ok(grid.ignite(i, events));
  for (let t = 0; t < 2.0; t += DT) grid.step(DT, events);
  const neighbours = [grid.index(11, 22), grid.index(9, 22), grid.index(10, 21), grid.index(10, 23)];
  assert.ok(neighbours.every((n) => grid.fire[n] > 0), "four neighbours caught after three heat ticks");
  assert.equal(grid.fire[grid.index(12, 22)], 0, "spread is gradual, not instant");
  const out = grid.applyWater(10.5 * C, 22.5 * C, 2.5, events);
  assert.ok(out >= 5);
  assert.ok([i, ...neighbours].every((n) => grid.fire[n] === 0 && grid.wet[n] > 0));
  assert.equal(grid.ignite(i, events), false, "a wet cell will not ignite");
  // Non-flammable plating never burns.
  assert.equal(grid.ignite(grid.index(30, 5), events), false);
});

test("the mate's surge puts out a fire core and the fire around it", () => {
  const { sim, s } = quietArena();
  sim.internals.enterPhase(1); // EMBERS
  run(sim, 3.0);
  const core = s.cores[0];
  assert.ok(sim.grid.burningAt(core.x, core.y + 64) || sim.grid.burningCount > 0, "the core has lit its yard");
  Object.assign(s.mate, { x: core.x + 260, y: core.y });
  Object.assign(s.player, { x: core.x + 320, y: core.y });
  const events = run(sim, 1.4, (arena) => ({ aimX: core.x, aimY: core.y, surge: arena.getState().time < 3.05 }));
  assert.equal(core.out, true);
  assert.ok(events.some((event) => event.type === "CORE_OUT"));
  assert.ok(events.some((event) => event.type === "FIRE_OUT"));
  assert.ok(events.some((event) => event.type === "ELEMENT_CHAIN" && event.kind === "STEAM"));
  assert.equal(sim.grid.burningAt(core.x, core.y), false);
});

test("cryo pod bridge: forms, warns, cracks, melts back to water", () => {
  const grid = createDataArenaGrid();
  const events = [];
  const frozen = grid.applyCryoColumn(9.5 * C, 27.5 * C, DATA_ARENA_GRID_RULES.podIceSeconds, events);
  assert.equal(frozen, 12, "three cells wide, four rows across the channel");
  assert.equal(grid.surfaceAt(9.5 * C, 29.5 * C), "ICE");
  assert.equal(grid.blocksMoveAt(9, 29, "walker"), false);
  let warnedAt = null, meltedAt = null;
  for (let t = 0; t < 13; t += DT) {
    const step = [];
    grid.step(DT, step);
    if (warnedAt === null && step.some((event) => event.type === "ICE_CRACK_WARN")) warnedAt = t;
    if (meltedAt === null && step.some((event) => event.type === "ICE_MELT")) meltedAt = t;
    if (warnedAt !== null && meltedAt === null) assert.equal(grid.surfaceAt(9.5 * C, 29.5 * C), "ICE_CRACKING");
  }
  assert.ok(Math.abs(meltedAt - warnedAt - DATA_ARENA_GRID_RULES.iceWarnSeconds) < 0.05, "warning comes a fixed time before the melt");
  assert.equal(grid.surfaceAt(9.5 * C, 29.5 * C), "WATER");
  assert.equal(grid.blocksMoveAt(9, 29, "walker"), true);
});

test("an ember landing on ice shortens the bridge", () => {
  const grid = createDataArenaGrid();
  grid.applyCryoColumn(9.5 * C, 27.5 * C, 12, []);
  const i = grid.index(9, 29);
  grid.meltAt(9.5 * C, 29.5 * C, DATA_ARENA_GRID_RULES.emberIceMelt, []);
  assert.ok(Math.abs(grid.ice[i] - (12 - DATA_ARENA_GRID_RULES.emberIceMelt)) < 1e-4);
});

test("safe fallback: a melting bridge drops the player, who recovers on the nearest bank", () => {
  const { sim, s } = quietArena();
  sim.internals.burstPod(s.pods[0]);
  Object.assign(s.player, center(9, 29));
  const hp = s.player.hp;
  const events = run(sim, DATA_ARENA_GRID_RULES.podIceSeconds + DATA_ARENA_PLAYER.fall.sink + 0.2);
  assert.ok(events.some((event) => event.type === "ICE_CRACK_WARN"));
  assert.ok(events.some((event) => event.type === "FELL_IN_WATER"));
  assert.ok(events.some((event) => event.type === "RECOVERED"));
  assert.equal(s.player.state, "NORMAL");
  assert.equal(sim.grid.surfaceAt(s.player.x, s.player.y), "GROUND");
  assert.equal(s.player.hp, hp - DATA_ARENA_PLAYER.fall.damage);
  assert.ok(s.player.invulnerable > 0);
});

test("walking stops at the bank; a dash can still reach open water and recovers safely", () => {
  const { sim, s } = quietArena();
  sim.internals.enterPhase(2);
  Object.assign(s.player, center(14, 27));
  run(sim, 1.0, { moveY: 1, aimX: 14.5 * C, aimY: 31 * C });
  assert.equal(sim.grid.surfaceAt(s.player.x, s.player.y), "GROUND");
  assert.equal(s.player.state, "NORMAL");
  const events = run(sim, 1.2, (arena) => ({ moveY: 1, dash: arena.getState().time < 1.0 + DT * 2, aimX: 14.5 * C, aimY: 31 * C }));
  assert.ok(events.some((event) => event.type === "FELL_IN_WATER"), "the dash ends over the channel");
  assert.ok(events.some((event) => event.type === "RECOVERED"));
  assert.equal(s.player.state, "NORMAL");
  assert.equal(sim.grid.surfaceAt(s.player.x, s.player.y), "GROUND");
});

test("ice and fire change AI routes", () => {
  const grid = createDataArenaGrid();
  const field = createFlowField(grid, "walker");
  const north = center(30, 22), south = center(10, 35);
  field.update(north.x, north.y, 1);
  assert.ok(field.reachable(south.x, south.y), "the retractable bridge connects the pier");
  grid.openTide([]);
  field.update(north.x, north.y, 1);
  assert.equal(field.reachable(south.x, south.y), false, "after the tide opens, walkers cannot cross");
  grid.applyCryoColumn(21.5 * C, 27.5 * C, 12, []);
  field.update(north.x, north.y, 1);
  assert.ok(field.reachable(south.x, south.y), "an ice bridge reopens the route");
  const swimmer = createFlowField(grid, "swimmer");
  swimmer.update(north.x, north.y, 1);
  assert.ok(swimmer.reachable(center(40, 30).x, center(40, 30).y), "the mate swims the open channel");
  // A burning yard is avoided when a clear path exists.
  const clear = createFlowField(grid, "walker");
  clear.update(center(17, 22).x, center(17, 22).y, 1);
  const before = clear.distance[grid.index(4, 22)];
  for (let c = 6; c <= 15; c++) grid.ignite(grid.index(c, 22), []);
  clear.update(center(17, 22).x, center(17, 22).y, 1);
  assert.ok(clear.distance[grid.index(4, 22)] > before, "fire raises the route cost");
});

test("riding the mate: mount, swim, hits go to the mount, downed mount throws the rider safely", () => {
  const { sim, s } = quietArena();
  sim.internals.enterPhase(2);
  Object.assign(s.mate, center(20, 27));
  Object.assign(s.player, { x: s.mate.x - 40, y: s.mate.y });
  let events = run(sim, DT, { ride: true });
  assert.equal(s.player.state, "MOUNTING");
  events = run(sim, 0.4);
  assert.equal(s.player.state, "RIDING");
  assert.ok(events.some((event) => event.type === "MOUNTED"));
  run(sim, 0.9, { moveY: 1 });
  assert.equal(sim.grid.surfaceAt(s.mate.x, s.mate.y), "WATER");
  assert.equal(s.player.x, s.mate.x);
  const hp = s.player.hp, mateHp = s.mate.hp;
  sim.internals.hurtPlayer(10, "TEST", s.player.x, s.player.y);
  assert.equal(s.player.hp, hp, "the rider is shielded");
  assert.equal(s.mate.hp, mateHp - 5, "the mount takes half");
  sim.internals.hurtMate(10_000, "TEST", s.mate.x, s.mate.y);
  events = run(sim, DATA_ARENA_PLAYER.fall.sink + 0.1);
  assert.equal(s.mate.state, "DOWNED");
  assert.equal(sim.grid.surfaceAt(s.mate.x, s.mate.y), "GROUND", "a mate downed in the water washes ashore, so it can be rescued");
  assert.ok(events.some((event) => event.type === "RECOVERED"));
  assert.equal(s.player.state, "NORMAL");
  assert.equal(sim.grid.surfaceAt(s.player.x, s.player.y), "GROUND");
});

test("riding: dismount on land, hop to a near bank from the water", () => {
  const { sim, s } = quietArena();
  sim.internals.enterPhase(2);
  Object.assign(s.mate, center(20, 25));
  Object.assign(s.player, { x: s.mate.x - 30, y: s.mate.y });
  run(sim, DT, { ride: true }); run(sim, 0.4);
  let events = run(sim, DT, { ride: true });
  assert.equal(s.player.state, "NORMAL");
  assert.ok(events.some((event) => event.type === "DISMOUNT" && event.mode === "LAND"));
  Object.assign(s.mate, center(20, 28)); s.mate.state = "FOLLOW";
  Object.assign(s.player, { x: s.mate.x - 30, y: s.mate.y - 30 });
  run(sim, DT, { ride: true }); run(sim, 0.4);
  assert.equal(s.player.state, "RIDING");
  events = run(sim, DT, { dash: true });
  assert.ok(events.some((event) => event.type === "DISMOUNT" && event.mode === "HOP"));
  assert.equal(sim.grid.surfaceAt(s.player.x, s.player.y), "GROUND");
});

test("a downed mate is revived by standing beside it (a rescue)", () => {
  const { sim, s } = quietArena();
  sim.internals.hurtMate(10_000, "TEST", s.mate.x, s.mate.y);
  Object.assign(s.player, { x: s.mate.x + 30, y: s.mate.y });
  const events = run(sim, 2.2);
  assert.ok(events.some((event) => event.type === "MATE_REVIVED" && event.rescued));
  assert.equal(s.stats.rescues, 1);
  assert.ok(events.some((event) => event.type === "CROWD" && event.source === "RESCUE"));
});

test("a dash through a shot is a perfect dodge, not a hit", () => {
  const { sim, s } = quietArena();
  sim.internals.spawnProjectile({ kind: "EMBER", owner: "enemy", x: s.player.x + 70, y: s.player.y, vx: -300, vy: 0, radius: 9, damage: 10 });
  const events = run(sim, 0.4, (arena) => ({ dash: arena.getState().time < DT * 3, moveX: 1 }));
  assert.ok(events.some((event) => event.type === "PERFECT_DODGE"));
  assert.equal(events.some((event) => event.type === "PLAYER_HIT"), false);
});

test("enemy shots are telegraphed for their full windup", () => {
  const { sim, s } = quietArena();
  const enemy = sim.internals.spawnEnemy("ember", s.player.x + 280, s.player.y - 20);
  enemy.shotTimer = 0.05;
  let telegraphSince = null, shotAt = null;
  for (let i = 0; i < 120 && shotAt === null; i++) {
    sim.step({});
    if (telegraphSince === null && s.telegraphs.some((t) => t.owner === enemy.id)) telegraphSince = s.time;
    if (sim.drainEvents().some((event) => event.type === "ENEMY_SHOT")) shotAt = s.time;
  }
  assert.ok(telegraphSince !== null && shotAt !== null);
  assert.ok(shotAt - telegraphSince >= 0.5 - DT, `telegraph lasted ${shotAt - telegraphSince}`);
});

test("level-up offers pause every hazard until a choice is made", () => {
  const { sim, s } = quietArena();
  const shot = sim.internals.spawnProjectile({ kind: "EMBER", owner: "enemy", x: 300, y: 300, vx: 100, vy: 0, radius: 9, damage: 10 });
  s.xp = 6;
  run(sim, DT);
  assert.equal(s.mode, "LEVEL_UP");
  assert.equal(s.offer.length, 3);
  const time = s.time, x = shot.x;
  assert.equal(sim.step({ moveX: 1 }), false);
  assert.equal(s.time, time);
  assert.equal(shot.x, x);
  const pick = s.offer[0];
  assert.ok(sim.choose(pick));
  assert.equal(s.mode, "PLAY");
  assert.equal(s.upgrades[pick] >= 1 || pick === "patch", true);
  assert.equal(sim.choose("focusLens"), false, "no choice outside an offer");
});

test("upgrade offers: nine-plus options in three tracks, distinct, no maxed, capped, seeded", () => {
  assert.ok(DATA_ARENA_UPGRADES.length >= 9);
  for (const track of ["LASER", "DASH", "TIDE"]) assert.ok(DATA_ARENA_UPGRADES.filter((u) => u.track === track).length >= 3);
  const a = drawUpgradeOffer({}, createArenaRandom(5)), b = drawUpgradeOffer({}, createArenaRandom(5));
  assert.deepEqual(a, b, "same seed, same offer");
  assert.equal(new Set(a).size, 3);
  assert.equal(new Set(a.map((id) => DATA_ARENA_UPGRADES.find((u) => u.id === id).track)).size, 3, "one per track when possible");
  const maxed = Object.fromEntries(DATA_ARENA_UPGRADES.map((u) => [u.id, u.max]));
  delete maxed.focusLens;
  const random = createArenaRandom(9);
  for (let i = 0; i < 20; i++) {
    const offer = drawUpgradeOffer(maxed, random);
    assert.ok(offer.includes("focusLens") && offer.includes("patch"), "only non-maxed options, padded by the heal");
  }
  assert.ok(Math.abs(upgradeValue({ focusLens: 99 }, "laserDps") - 0.6) < 1e-9, "levels cap at max");
});

test("crowd hype is bounded: per-source cooldown, window cap, cheer score cap", () => {
  const { sim, s } = quietArena();
  for (let i = 0; i < 8; i++) { sim.internals.addHype("PERFECT_DODGE"); run(sim, 1.25); }
  assert.ok(s.hype <= DATA_ARENA_CROWD.windowCap, `hype ${s.hype}`);
  const score = s.score;
  s.hype = 99; s.crowd.window.length = 0;
  run(sim, 1.3);
  sim.internals.addHype("RESCUE");
  assert.ok(s.cheerTimer > 0);
  assert.equal(s.score, score + DATA_ARENA_CROWD.cheerScore);
  sim.internals.addHype("BEACON");
  assert.equal(s.hype, 0, "no gain during a cheer");
  // Past the scoring cap, cheers still happen but add no score.
  s.cheers = DATA_ARENA_CROWD.cheerScoreCap; s.cheerTimer = 0; s.cheerCooldown = 0; s.hype = 99; s.crowd.window.length = 0;
  s.crowd.cheerEnded = s.cheers;
  run(sim, 1.3);
  const capped = s.score;
  sim.internals.addHype("CORE_OUT");
  assert.equal(s.cheers, DATA_ARENA_CROWD.cheerScoreCap + 1);
  assert.equal(s.score, capped);
});

test("same seed and same inputs replay the same match", () => {
  const script = (arena) => {
    const st = arena.getState();
    const t = st.time;
    if (st.mode === "LEVEL_UP") arena.choose(st.offer[0]);
    return { moveX: Math.sin(t * 0.7), moveY: Math.cos(t * 0.45), aimX: st.player.x + Math.cos(t) * 300, aimY: st.player.y + Math.sin(t) * 300,
      fire: Math.floor(t) % 3 !== 0, dash: Math.floor(t * 10) % 37 === 0, surge: Math.floor(t * 10) % 113 === 0, ride: false };
  };
  const play = () => {
    const sim = createDataArenaSimulation({ seed: 4242, partnerId: "corona-cub" });
    for (let i = 0; i < 60 * 50; i++) { sim.step(script(sim)); sim.drainEvents(); }
    return JSON.stringify(sim.getSnapshot());
  };
  assert.equal(play(), play());
});

test("arena records use their own key through the one writer and never touch the game save", () => {
  const map = new Map([["championshipModernSave:v1", "{\"keep\":true}"], ["championshipModernSave:preferences:v1", "{}"]]);
  const storage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  const port = createChampionshipDataArenaPort({ storage });
  const store = createDataArenaRecordStore({ port });
  assert.equal(DATA_ARENA_RECORD_SCHEMA, "dataArena.v1");
  assert.equal(store.key, CHAMPIONSHIP_DATA_ARENA_KEY);
  const { newBest } = store.recordResult({ partnerId: "frost-drake", outcome: "VICTORY", score: 9100, timeSeconds: 238.5 });
  store.setSettings({ shake: false, quality: "low" });
  assert.ok(newBest);
  assert.equal(map.get("championshipModernSave:v1"), "{\"keep\":true}");
  assert.equal(map.get("championshipModernSave:preferences:v1"), "{}");
  assert.deepEqual([...map.keys()].sort(), [CHAMPIONSHIP_DATA_ARENA_KEY, "championshipModernSave:preferences:v1", "championshipModernSave:v1"].sort());
  const saved = JSON.parse(map.get(CHAMPIONSHIP_DATA_ARENA_KEY));
  assert.equal(saved.schema, "dataArena.v1");
  assert.equal(saved.wins, 1); assert.equal(saved.bestScore, 9100); assert.equal(saved.settings.shake, false);
  assert.equal(createDataArenaRecordStore({ port }).get().bestScore, 9100, "records survive a reload");
  // Corrupt or hostile records fall back to defaults without throwing.
  map.set(CHAMPIONSHIP_DATA_ARENA_KEY, "{not json");
  assert.equal(createDataArenaRecordStore({ port }).get().runs, 0);
  map.set(CHAMPIONSHIP_DATA_ARENA_KEY, JSON.stringify({ schemaVersion: 1, kind: "DATA_ARENA_RECORDS", runs: -5, wins: 99, bestScore: "x", settings: { quality: "ultra" } }));
  const sane = createDataArenaRecordStore({ port }).get();
  assert.deepEqual([sane.runs, sane.wins, sane.bestScore, sane.settings.quality], [0, 0, 0, "auto"]);
  // Blocked storage still lets the mode run.
  const blockedPort = createChampionshipDataArenaPort({ storage: { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } } });
  const blocked = createDataArenaRecordStore({ port: blockedPort });
  assert.equal(blocked.persistent, false);
  assert.equal(blocked.recordResult({ partnerId: "ember-lizard", outcome: "DEFEAT", score: 10 }).saved, false);
  assert.equal(createDataArenaRecordStore({ port: null }).recordResult({ partnerId: "ember-lizard", outcome: "DEFEAT", score: 10 }).saved, false);
});

test("the cast reuses shipped creatures only where the selection is approved", () => {
  const local = dataArenaCast("http://127.0.0.1:8732/championship.html");
  assert.equal(local.partners.length, 3);
  assert.ok(local.partners.every((p) => p.art?.runtimeUrl.includes("/assets/production/characters/accepted-20261010/")));
  assert.ok(local.mate.art && local.boss.art);
  const pages = dataArenaCast("https://orochi771127.github.io/championship-2026/championship.html");
  assert.ok(pages.boss.art.runtimeUrl.startsWith("https://orochi771127.github.io/championship-2026/assets/production/"));
  const elsewhere = dataArenaCast("https://example.com/mirror/championship.html");
  assert.equal(elsewhere.mate.art, null, "unapproved hosts draw the procedural fallback");
});

test("map authoring: channel, bridge, stage and stands exist where the timeline needs them", () => {
  const grid = createDataArenaGrid();
  assert.equal(grid.terrain[grid.index(30, 29)], DATA_ARENA_TERRAIN.BRIDGE);
  assert.equal(grid.terrain[grid.index(5, 29)], DATA_ARENA_TERRAIN.WATER);
  assert.equal(grid.terrain[grid.index(30, 15)], DATA_ARENA_TERRAIN.STAGE);
  assert.equal(grid.terrain[grid.index(30, 1)], DATA_ARENA_TERRAIN.STANDS);
  assert.equal(grid.cols * C, 3840);
  assert.equal(grid.rows * C, 2560);
});

test("camera keeps the player in frame, stays inside the harbor, and honours reduced motion", () => {
  assert.ok(dataArenaBaseZoom(1280, 720) > dataArenaBaseZoom(390, 844), "a phone sees a wider slice of the harbor");
  assert.ok(390 / dataArenaBaseZoom(390, 844) >= 559, "never narrower than 560 world px");
  const camera = createDataArenaCamera({ worldWidth: 3840, worldHeight: 2560 });
  const viewport = { width: 1280, height: 720 };
  let view = camera.update({ dtMs: 16, viewport, target: { x: 60, y: 60 } });
  for (let i = 0; i < 120; i++) view = camera.update({ dtMs: 16, viewport, target: { x: 60, y: 60 } });
  assert.ok(view.centerX - view.halfW >= -1e-6 && view.centerY - view.halfH >= -1e-6, "clamped at the corner");
  // A fast dash: the player never leaves the frame even before the follow catches up.
  for (let i = 0; i < 10; i++) {
    view = camera.update({ dtMs: 16, viewport, target: { x: 1500 + i * 20, y: 1500 }, velocity: { x: 1250, y: 0 } });
    assert.ok(Math.abs(1500 + i * 20 - view.centerX) < view.halfW, "player inside the view");
  }
  const calm = createDataArenaCamera({ worldWidth: 3840, worldHeight: 2560, reducedMotion: true, shake: true });
  calm.addTrauma(1);
  assert.equal(calm.update({ dtMs: 16, viewport, target: { x: 1900, y: 1300 } }).trauma, 0, "no shake with reduced motion");
  assert.deepEqual(DATA_ARENA_SEQUENCES, { STAND: 0, WALK: 2, ATTACK: 7, HIT: 6, DOWN: 15, WIN: 33 });
});

// ---------------------------------------------------------------------------
// Round 2: four-move kits, rivals and the short tournament.
import { DATA_ARENA_ENERGY, DATA_ARENA_KITS, DATA_ARENA_MOVES, DATA_ARENA_RIVALS, DATA_ARENA_TOURNAMENT } from "../src/championship/modes/dataArena/dataArenaConfig.js";

/** A tournament with the intro skipped: round 1 is live, the rival waits idle unless a test wakes it. */
function liveDuel(options = {}) {
  const sim = createDataArenaSimulation({ seed: 5, mode: "TOURNAMENT", ...options });
  run(sim, DATA_ARENA_TOURNAMENT.introSeconds + DT * 2);
  const s = sim.getState();
  assert.equal(s.tournament.status, "FIGHT");
  const rival = s.rivals[0];
  rival.attackDelay = Infinity; rival.dashCooldown = Infinity; rival.speed = 0; rival.ult = 0;
  return { sim, s, rival };
}
function place(body, c, r) { const p = center(c, r); body.x = p.x; body.y = p.y; body.vx = 0; body.vy = 0; }

test("skills spend energy and start a cooldown; empty energy or a cooling move refuses the cast", () => {
  const { sim, s } = liveDuel();
  const first = DATA_ARENA_KITS["ember-lizard"].moves[0];
  const before = s.player.energy;
  let events = run(sim, DT, { cast: 0, autoAim: true });
  assert.ok(events.some((e) => e.type === "CAST" && e.moveId === first && e.team === "player"));
  assert.ok(Math.abs(s.player.energy - (before - DATA_ARENA_MOVES[first].energy)) < 1);
  assert.ok(s.player.cooldowns[first] > 0);
  run(sim, DATA_ARENA_MOVES[first].windup + DT * 2);
  events = run(sim, DT, { cast: 0, autoAim: true });
  assert.ok(events.some((e) => e.type === "CAST_REFUSED" && e.reason === "COOLDOWN"));
  run(sim, DATA_ARENA_MOVES[first].cooldown + 0.1);
  s.player.energy = 0; s.player.energySpentAt = s.time;
  events = run(sim, DT, { cast: 0, autoAim: true });
  assert.ok(events.some((e) => e.type === "CAST_REFUSED" && e.reason === "ENERGY"));
  // Energy refills after a short delay.
  run(sim, DATA_ARENA_ENERGY.regenDelay + 1);
  assert.ok(s.player.energy > 10);
});

test("auto-aim locks the nearest rival only with a clear line; pillars break the lock", () => {
  const { sim, s, rival } = liveDuel();
  place(s.player, 10, 7);
  place(rival, 10, 3); // straight through the pillar at (9-10, 5)
  assert.equal(sim.getSnapshot().rivals[0].sight, false);
  assert.equal(sim.internals.autoAim(s.player, 900).target, null);
  place(rival, 5, 4);
  assert.equal(sim.getSnapshot().rivals[0].sight, true);
  assert.equal(sim.internals.autoAim(s.player, 900).target, rival);
  // A bolt fired into the pillar stops there.
  place(rival, 10, 3);
  sim.internals.beginCast(s.player, "emberBolt", rival.x, rival.y);
  const hp = rival.hp;
  run(sim, 1.2);
  assert.equal(rival.hp, hp, "cover absorbs the shot");
});

test("every rival attack is telegraphed: windups and delayed zones give time to step out", () => {
  for (const definition of DATA_ARENA_RIVALS) {
    const kit = DATA_ARENA_KITS[definition.kit];
    for (const id of kit.moves) assert.ok(DATA_ARENA_MOVES[id].windup >= 0.3, `${id} windup`);
    assert.ok(DATA_ARENA_MOVES[kit.ultimate].windup >= 1, `${kit.ultimate} ultimate windup`);
  }
  for (const stepOut of [false, true]) {
    const { sim, s, rival } = liveDuel();
    place(s.player, 12, 13); place(rival, 12, 11);
    s.player.invulnerable = 0;
    const hp = s.player.hp;
    assert.ok(sim.internals.beginCast(rival, "quakeSlam", s.player.x, s.player.y));
    assert.ok(s.telegraphs.some((g) => g.owner === `cast:${rival.id}`), "windup telegraph is shown");
    run(sim, DATA_ARENA_MOVES.quakeSlam.windup + DT * 2);
    assert.equal(s.zones.length, 1, "the zone is placed before it detonates");
    assert.equal(s.player.hp, hp, "nothing lands during the warning");
    run(sim, DATA_ARENA_MOVES.quakeSlam.delay + 0.2, stepOut ? { moveX: 1 } : {});
    if (stepOut) assert.equal(s.player.hp, hp, "stepping out of the circle avoids it");
    else assert.ok(s.player.hp < hp, "standing in it is punished");
  }
});

test("the light shield blocks hostile shots from the front only", () => {
  for (const front of [true, false]) {
    const { sim, s, rival } = liveDuel({ partnerId: "corona-cub" });
    place(s.player, 12, 13); place(rival, 12, 3);
    s.player.invulnerable = 0;
    assert.ok(sim.internals.beginCast(s.player, "sunShield", s.player.x, s.player.y - 100)); // facing north
    run(sim, DT * 2);
    const fromY = front ? s.player.y - 200 : s.player.y + 200;
    sim.internals.spawnProjectile({ kind: "RBOLT", owner: "rival", team: "rival", moveId: "tideBolt", x: s.player.x, y: fromY, vx: 0, vy: front ? 600 : -600,
      radius: 11, damage: 16, range: 600, travelled: 0, hits: new Set() });
    const hp = s.player.hp;
    const events = run(sim, 0.5);
    if (front) {
      assert.equal(s.player.hp, hp);
      assert.ok(events.some((e) => e.type === "CANCEL" && e.rule === "BARRIER_BLOCKS_SHOT"));
      assert.equal(s.stats.barrierBlocks, 1);
    } else assert.ok(s.player.hp < hp, "a shot from behind gets through");
  }
});

test("a spent rival breaks line of sight behind cover instead of trading hits", () => {
  const { sim, s, rival } = liveDuel();
  place(s.player, 12, 13); place(rival, 12, 4);
  rival.energy = 0;
  sim.internals.chooseRivalGoal(rival);
  assert.equal(rival.wantsCover, true);
  assert.equal(sim.grid.raycast(rival.goal.x, rival.goal.y, (s.player.x - rival.goal.x) / Math.hypot(s.player.x - rival.goal.x, s.player.y - rival.goal.y),
    (s.player.y - rival.goal.y) / Math.hypot(s.player.x - rival.goal.x, s.player.y - rival.goal.y), Math.hypot(s.player.x - rival.goal.x, s.player.y - rival.goal.y))
    < Math.hypot(s.player.x - rival.goal.x, s.player.y - rival.goal.y) - 1, true, "the chosen spot is hidden from the player");
  rival.energy = DATA_ARENA_ENERGY.max;
  sim.internals.chooseRivalGoal(rival);
  assert.equal(rival.wantsCover, false, "with energy back it re-engages");
});

test("tournament: KO -> between-round upgrade -> next rival; three wins crown the champion", () => {
  const { sim, s } = liveDuel();
  for (let round = 0; round < DATA_ARENA_TOURNAMENT.rounds; round++) {
    if (round > 0) {
      run(sim, DATA_ARENA_TOURNAMENT.introSeconds + DT * 2);
      assert.equal(s.tournament.status, "FIGHT");
    }
    assert.equal(s.rivals[0].definitionId, s.tournament.order[round]);
    s.rivals[0].attackDelay = Infinity;
    sim.internals.damageRival(s.rivals[0], 1e6, "TEST");
    let events = run(sim, DT * 2);
    assert.ok(events.some((e) => e.type === "ROUND_WON" && e.round === round));
    events = run(sim, DATA_ARENA_TOURNAMENT.koSeconds + DT * 2);
    if (round < DATA_ARENA_TOURNAMENT.rounds - 1) {
      assert.equal(s.mode, "LEVEL_UP");
      assert.equal(s.offer.length, 3);
      assert.equal(s.player.hp, s.player.maxHp, "each round starts at full HP");
      assert.ok(sim.choose(s.offer[0]));
      assert.equal(s.mode, "PLAY");
      assert.equal(s.tournament.round, round + 1);
    } else {
      const result = events.find((e) => e.type === "RESULT");
      assert.equal(result?.outcome, "VICTORY");
    }
  }
  assert.equal(s.tournament.order.at(-1), "storm", "the champion is always the final");
  assert.equal(s.result.tournament.roundsWon, 3);
  assert.equal(s.result.mode, "TOURNAMENT");
  assert.ok(s.result.breakdown.victory > 0 && s.result.breakdown.time === 0, "no harbor time-limit bonus in the cup");
});

test("tournament: a lost round ends the cup; time-out goes to the higher HP share", () => {
  const lost = liveDuel();
  lost.s.player.invulnerable = 0;
  lost.sim.internals.hurtPlayer(1e6, "TEST", lost.s.player.x, lost.s.player.y);
  let events = run(lost.sim, DATA_ARENA_TOURNAMENT.koSeconds + 0.5);
  assert.ok(events.some((e) => e.type === "ROUND_LOST"));
  assert.equal(events.find((e) => e.type === "RESULT")?.outcome, "DEFEAT");
  assert.equal(lost.s.result.tournament.reachedRound, 1);

  const timed = liveDuel();
  timed.rival.hp = timed.rival.maxHp * 0.5;
  timed.s.player.hp = timed.s.player.maxHp * 0.6;
  timed.s.tournament.roundTime = DATA_ARENA_TOURNAMENT.roundSeconds - DT;
  events = run(timed.sim, DT * 3);
  assert.ok(events.some((e) => e.type === "ROUND_WON" && e.reason === "TIME"));
});

test("modes stay separate: the cup has no swarm, mate or harbor upgrades; the harbor keeps its phases and gains the kit", () => {
  const duel = createDataArenaSimulation({ seed: 1, mode: "TOURNAMENT" });
  run(duel, 20, { moveX: 0.3 });
  const d = duel.getState();
  assert.equal(d.enemies.length, 0);
  assert.equal(d.mate.state, "ABSENT");
  assert.equal(d.boss, null);
  assert.equal(duel.getSnapshot().phase, "DUEL", "harbor phases never run in the cup");
  for (let seed = 0; seed < 200; seed++) {
    const offer = drawUpgradeOffer({}, createArenaRandom(seed), 3, "TOURNAMENT");
    assert.ok(!offer.includes("surgePlus") && !offer.includes("guardianFin"), `seed ${seed}: ${offer}`);
  }
  const harbor = createDataArenaSimulation({ seed: 1, mode: "HARBOR" });
  const events = run(harbor, 0.2, { cast: 0, autoAim: true });
  assert.ok(events.some((e) => e.type === "CAST" && e.team === "player"), "the harbor partner casts skills too");
  assert.equal(harbor.getState().rivals.length, 0);
  harbor.getState().spawnTimer = Infinity;
  run(harbor, 50);
  assert.equal(harbor.getState().mode, "PLAY");
  assert.notEqual(harbor.getSnapshot().phase, "WARMUP");
});

test("records keep one entry per mode and remember the last mode", () => {
  const storage = new Map();
  const port = createChampionshipDataArenaPort({ storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) } });
  const store = createDataArenaRecordStore({ port });
  store.recordResult({ outcome: "DEFEAT", score: 1800, partnerId: "ember-lizard", mode: "TOURNAMENT", timeSeconds: 70,
    tournament: { roundsWon: 1, rounds: 3, reachedRound: 2, results: [] } });
  store.recordResult({ outcome: "VICTORY", score: 9000, partnerId: "ember-lizard", mode: "HARBOR", timeSeconds: 260, tournament: null });
  const saved = store.get();
  assert.equal(saved.modes.TOURNAMENT.bestScore, 1800);
  assert.equal(saved.modes.TOURNAMENT.bestRound, 2);
  assert.equal(saved.modes.TOURNAMENT.wins, 0);
  assert.equal(saved.modes.HARBOR.wins, 1);
  assert.equal(saved.lastMode, "HARBOR");
  assert.deepEqual([...storage.keys()], [CHAMPIONSHIP_DATA_ARENA_KEY]);
});

test("duel camera keeps both the player and the rival on screen", () => {
  const camera = createDataArenaCamera({ worldWidth: 1920, worldHeight: 1280 });
  const viewport = { width: 1280, height: 720 };
  const player = { x: 960, y: 1120 }, rival = { x: 900, y: 220 };
  let view;
  for (let i = 0; i < 240; i++) view = camera.update({ dtMs: 16.7, viewport, target: player, opponent: rival });
  const onScreen = (body) => { const sx = view.x + body.x * view.zoom, sy = view.y + body.y * view.zoom; return sx > 40 && sx < viewport.width - 40 && sy > 150 && sy < viewport.height - 90; }; // clear of the HUD bands
  assert.ok(onScreen(player) && onScreen(rival), JSON.stringify({ zoom: view.zoom, x: view.x, y: view.y }));
  assert.ok(view.zoom >= 0.42);
  // Close together, the camera does not zoom out needlessly.
  const near = createDataArenaCamera({ worldWidth: 1920, worldHeight: 1280 });
  for (let i = 0; i < 240; i++) view = near.update({ dtMs: 16.7, viewport, target: player, opponent: { x: 1000, y: 1000 } });
  assert.ok(Math.abs(view.zoom - dataArenaBaseZoom(1280, 720)) < 0.01);
});

test("a skill tapped mid-dash or mid-windup is buffered and cast when free, not dropped", () => {
  const { sim, s } = liveDuel();
  run(sim, DT, { dash: true, moveX: 1 });
  assert.equal(s.player.state, "DASH");
  run(sim, DT, { cast: 0, autoAim: true });
  assert.equal(s.player.cast, null);
  const events = run(sim, 0.3);
  assert.ok(events.some((e) => e.type === "CAST" && e.team === "player"), "the buffered cast fires after the dash");
  // A second tap during the windup resolves after it: a cooldown refusal the HUD can show.
  run(sim, 1.2);
  run(sim, DT, { cast: 0, autoAim: true });
  assert.ok(s.player.cast, "winding up");
  const again = run(sim, DT, { cast: 0, autoAim: true });
  const later = run(sim, 0.4);
  assert.ok([...again, ...later].some((e) => e.type === "CAST_REFUSED" && e.reason === "COOLDOWN"));
});

test("knockback into a pillar is a wall slam; into the channel is a splash", () => {
  const { sim, s, rival } = liveDuel();
  // Rival just south of the pillar at (9-10, 5), launched north into it.
  place(s.player, 14, 13); place(rival, 10, 6);
  rival.kbx = 0; rival.kby = -600;
  const hp = rival.hp;
  const events = run(sim, 0.2);
  const slam = events.find((e) => e.type === "WALL_SLAM" && e.target === "rival");
  assert.ok(slam, "a fast push into cover hurts");
  assert.ok(hp - rival.hp >= Math.max(DATA_ARENA_ENERGY.slamMin, rival.maxHp * DATA_ARENA_ENERGY.slamShare) - 1);
  // Pushed into open water: splashed back to a bank with damage.
  const duel = liveDuel();
  place(duel.rival, 8, 7); duel.rival.kbx = 0; duel.rival.kby = 500;
  const splash = run(duel.sim, 0.4);
  assert.ok(splash.some((e) => e.type === "RIVAL_SPLASH"));
  // A slow nudge against a wall is not a slam.
  const soft = liveDuel();
  place(soft.rival, 10, 6); soft.rival.kby = -120;
  assert.ok(!run(soft.sim, 0.3).some((e) => e.type === "WALL_SLAM"));
});

test("in the cup the dodge is a resource: a longer recharge than the harbor", () => {
  const { sim, s } = liveDuel();
  run(sim, DT, { dash: true, moveX: 1 });
  run(sim, DATA_ARENA_PLAYER.dash.cooldown + 0.2);
  assert.equal(s.player.dashCharges, 0, "still recharging after the harbor cooldown");
  run(sim, DATA_ARENA_TOURNAMENT.dashCooldown - DATA_ARENA_PLAYER.dash.cooldown);
  assert.equal(s.player.dashCharges, 1);
});
