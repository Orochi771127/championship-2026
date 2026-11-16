// Data Arena SURVIVAL (P4 prototype, OWNER_APPROVED_ADAPTATION delegated 2026-11-16) -- rule contract tests.
// Pure rules (dataArenaSurvival.js) and the simulation's survival flow. No DOM, Pixi or storage.
import test from "node:test";
import assert from "node:assert/strict";
import { createDataArenaSimulation, DATA_ARENA_MODES } from "../src/championship/modes/dataArena/dataArenaSimulation.js";
import {
  DATA_ARENA_SURVIVAL, createSurvivalStorm, survivalCircleAt, outsideCircle, createSurvivalField, survivalRank
} from "../src/championship/modes/dataArena/dataArenaSurvival.js";
import { selectDataArenaMusic } from "../src/championship/presentation/originalMusicCatalog.js";
import { sanitizeDataArenaRecords } from "../src/championship/modes/dataArena/dataArenaSave.js";

const W = 2400, H = 1600;
const seeded = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); };

/** Step a sim, keeping the player topped up so a test can watch the flow without dying to wild data. */
function run(sim, seconds, { keepAlive = true, input = {} } = {}) {
  const seen = [];
  for (let i = 0; i < Math.round(seconds * 60) && !sim.getState().result; i++) {
    const st = sim.getState();
    if (st.mode === "LEVEL_UP") { sim.choose(st.offer[0]); continue; }
    if (keepAlive && st.player.hp > 0) st.player.hp = st.player.maxHp;
    sim.step(input);
    seen.push(...sim.drainEvents());
  }
  return seen;
}

test("survival is a fourth Data Arena mode with its own record and the harbor's music", () => {
  assert.ok(DATA_ARENA_MODES.includes("SURVIVAL"));
  assert.equal(selectDataArenaMusic("SURVIVAL"), selectDataArenaMusic("HARBOR"));
  const records = sanitizeDataArenaRecords({ schemaVersion: 1, kind: "DATA_ARENA_RECORDS", lastMode: "SURVIVAL",
    modes: { SURVIVAL: { runs: 3, wins: 1, bestScore: 900 } } });
  assert.equal(records.modes.SURVIVAL.runs, 3);
  assert.equal(records.modes.SURVIVAL.wins, 1);
  assert.equal(records.lastMode, "SURVIVAL");
});

test("the opening circle covers the whole map and its centre sits in the middle half", () => {
  for (const seed of [1, 2, 3, 99]) {
    const storm = createSurvivalStorm({ random: seeded(seed), worldWidth: W, worldHeight: H });
    assert.ok(storm.cx >= W * 0.3 && storm.cx <= W * 0.7 && storm.cy >= H * 0.3 && storm.cy <= H * 0.7);
    const circle = survivalCircleAt(storm, 0);
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) assert.equal(outsideCircle(circle, x, y), false);
  }
});

test("the circle closes in six steps, never grows, and shuts at the end", () => {
  const storm = createSurvivalStorm({ random: seeded(5), worldWidth: W, worldHeight: H });
  const steps = DATA_ARENA_SURVIVAL.storm;
  assert.equal(steps.length, 6);
  const open = survivalCircleAt(storm, 0);
  assert.equal(open.stage, 0);
  assert.equal(open.closing, false);
  assert.equal(open.nextAt, steps[0].at);
  assert.equal(open.radius, storm.radius0);
  const mid = survivalCircleAt(storm, steps[0].at + steps[0].over / 2);
  assert.equal(mid.stage, 1);
  assert.equal(mid.closing, true);
  assert.ok(mid.radius < storm.radius0 && mid.radius > storm.radius0 * steps[0].share);
  const held = survivalCircleAt(storm, steps[0].at + steps[0].over + 1);
  assert.equal(held.closing, false);
  assert.ok(Math.abs(held.radius - storm.radius0 * steps[0].share) < 1e-6);
  assert.equal(held.nextAt, steps[1].at);
  let last = Infinity;
  for (let t = 0; t <= 340; t += 0.5) {
    const c = survivalCircleAt(storm, t);
    assert.ok(c.radius <= last + 1e-9, `radius grew at ${t}`);
    last = c.radius;
  }
  const end = survivalCircleAt(storm, 330);
  assert.equal(end.stage, 6);
  assert.equal(end.radius, 0);
  assert.equal(end.nextAt, null);
  // The drain rises with each step.
  const drains = steps.map((s) => s.drain);
  assert.deepEqual([...drains].sort((a, b) => a - b), drains);
});

test("the field seats eleven tamers: six come to the player in order, five fall beyond sight, all seeded", () => {
  const definitions = ["a", "b", "c", "d"];
  const field = createSurvivalField({ random: seeded(11), definitions });
  assert.equal(field.length, DATA_ARENA_SURVIVAL.tamers);
  assert.deepEqual(field.map((t) => t.index).sort((a, b) => a - b), [...Array(11).keys()]);
  const encounters = field.filter((t) => t.fate === "ENCOUNTER");
  assert.equal(encounters.length, DATA_ARENA_SURVIVAL.encounters);
  assert.deepEqual(encounters.map((t) => t.at).sort((a, b) => a - b), [...DATA_ARENA_SURVIVAL.encounterAt]);
  const offscreen = field.filter((t) => t.fate === "OFFSCREEN");
  assert.equal(offscreen.length, 5);
  for (const t of offscreen) assert.ok(t.at >= DATA_ARENA_SURVIVAL.offscreenFrom && t.at <= DATA_ARENA_SURVIVAL.offscreenTo);
  for (const t of field) {
    assert.equal(t.state, "WAITING");
    assert.equal(t.definitionId, definitions[t.index % definitions.length]);
  }
  assert.deepEqual(createSurvivalField({ random: seeded(11), definitions }), field);
  assert.notDeepEqual(createSurvivalField({ random: seeded(12), definitions }), field);
});

test("rank is one for the last one standing, otherwise one more than those still in", () => {
  assert.equal(survivalRank({ won: true, othersLeft: 0 }), 1);
  assert.equal(survivalRank({ won: false, othersLeft: 11 }), 12);
  assert.equal(survivalRank({ won: false, othersLeft: 3 }), 4);
  assert.equal(survivalRank({ won: false, othersLeft: -1 }), 1);
});

test("a survival match opens with the storm, eleven others and a survival objective; other modes carry none", () => {
  const sim = createDataArenaSimulation({ seed: 4, mode: "SURVIVAL" });
  const st = sim.getState();
  assert.equal(st.phaseId, "SURVIVAL");
  assert.ok(st.survival && st.survival.circle.radius > 0);
  const objective = sim.objective();
  assert.equal(objective.id, "SURVIVAL");
  assert.equal(objective.left, 11);
  assert.equal(objective.stage, 0);
  assert.equal(objective.outside, false);
  assert.equal(sim.getSnapshot().survival.left, 11);
  for (const mode of ["HARBOR", "TOURNAMENT"]) {
    const other = createDataArenaSimulation({ seed: 4, mode });
    assert.equal(other.getState().survival, null);
    assert.notEqual(other.objective().id, "SURVIVAL");
    assert.equal(other.getSnapshot().survival, null);
  }
});

test("the harbor run stays seeded and never sees the storm", () => {
  const a = createDataArenaSimulation({ seed: 21, mode: "HARBOR" });
  const b = createDataArenaSimulation({ seed: 21, mode: "HARBOR" });
  const ea = run(a, 20, { keepAlive: false }).map((e) => e.type).join(",");
  const eb = run(b, 20, { keepAlive: false }).map((e) => e.type).join(",");
  assert.equal(ea, eb);
  assert.ok(!/STORM|SURVIVAL/.test(ea));
});

test("the storm closes on schedule, the field thins and tamers come to the player one at a time", () => {
  const sim = createDataArenaSimulation({ seed: 8, mode: "SURVIVAL" });
  const events = run(sim, 75);
  const types = events.map((e) => e.type);
  const close = events.filter((e) => e.type === "STORM_CLOSE");
  assert.deepEqual(close.map((e) => e.stage), [1]);
  assert.ok(types.includes("SURVIVAL_ENCOUNTER"), "the first tamer arrives at 60 s");
  const st = sim.getState();
  const fighting = st.rivals.filter((r) => r.tamerIndex != null && r.hp > 0);
  assert.ok(fighting.length <= 1, "never more than one tamer on the player at once");
  for (const r of fighting) assert.equal(outsideCircle(st.survival.circle, r.x, r.y), false, "a tamer arrives inside the safe circle");
  const outs = events.filter((e) => e.type === "SURVIVAL_OUT");
  for (const e of outs) assert.ok(["STORM", "TAMER", "PLAYER"].includes(e.by));
  assert.equal(sim.objective().left, 11 - outs.length);
  // Same seed, same match.
  const again = createDataArenaSimulation({ seed: 8, mode: "SURVIVAL" });
  assert.equal(run(again, 75).map((e) => e.type).join(","), types.join(","));
});

test("beating a tamer counts it out by the player, drops XP crystals and clears its body", () => {
  const sim = createDataArenaSimulation({ seed: 8, mode: "SURVIVAL" });
  run(sim, 62);
  const st = sim.getState();
  const rival = st.rivals.find((r) => r.tamerIndex != null && r.hp > 0);
  assert.ok(rival, "an encounter tamer is on the field");
  const pickups = st.pickups.length;
  rival.hp = 0;
  const events = run(sim, 0.1);
  const out = events.find((e) => e.type === "SURVIVAL_OUT" && e.tamer === rival.tamerIndex);
  assert.ok(out);
  assert.equal(out.by, "PLAYER");
  assert.equal(st.survival.knockouts, 1);
  assert.ok(st.pickups.length >= pickups + 3);
  run(sim, 2);
  assert.ok(!sim.getState().rivals.includes(rival), "the beaten tamer leaves the field");
});

test("standing in the storm drains the player through dodges and ends the run with a place", () => {
  const sim = createDataArenaSimulation({ seed: 3, mode: "SURVIVAL" });
  run(sim, 60);
  const st = sim.getState();
  // Stand in the far corner, well outside the first circle.
  const c = st.survival.circle;
  const mw = sim.map.cols * sim.map.cell, mh = sim.map.rows * sim.map.cell;
  const corner = [[60, 60], [mw - 60, 60], [60, mh - 60], [mw - 60, mh - 60]]
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => Math.hypot(b.x - c.cx, b.y - c.cy) - Math.hypot(a.x - c.cx, a.y - c.cy))[0];
  assert.ok(outsideCircle(c, corner.x, corner.y), "the far corner is outside the first circle");
  let hits = 0;
  for (let i = 0; i < 60 * 120 && !sim.getState().result; i++) {
    const now = sim.getState();
    if (now.mode === "LEVEL_UP") { sim.choose(now.offer[0]); continue; }
    if (now.player.state !== "DOWNED" && now.player.state !== "DEFEATED") {
      now.player.x = corner.x; now.player.y = corner.y; now.player.invulnerable = 9;
    }
    sim.step({});
    for (const e of sim.drainEvents()) if (e.type === "STORM_HIT") hits++;
  }
  const result = sim.getState().result;
  assert.ok(hits > 0, "the storm hits the player outside the circle");
  assert.ok(result, "the run ends");
  assert.equal(result.outcome === "VICTORY", false);
  assert.ok(result.survival.rank >= 2 && result.survival.rank <= 12);
  assert.equal(result.survival.of, 12);
});

test("the last one standing wins with first place", () => {
  const sim = createDataArenaSimulation({ seed: 6, mode: "SURVIVAL" });
  run(sim, 2);
  for (const tamer of sim.getState().survival.tamers) tamer.state = "OUT";
  const events = run(sim, 4);
  assert.ok(events.some((e) => e.type === "SURVIVAL_WIN"));
  const result = sim.getState().result;
  assert.equal(result.outcome, "VICTORY");
  assert.equal(result.survival.rank, 1);
  assert.equal(result.survival.of, 12);
});
