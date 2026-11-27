// PB-Rank Battle Base Upgrade regression & contract tests (2026-11-27):
// verifies melee knockback displacement floor, body separation, guard-deflect bounce + angle,
// lunge threat detection, pixel-snapped brush kit, and all 14 declarative PB choreography templates.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createDataArenaSimulation } from "../src/championship/modes/dataArena/dataArenaSimulation.js";
import { detectIncomingThreat, pbRankSpacingVector } from "../src/championship/modes/dataArena/dataArenaUnifiedAI.js";
import {
  createPixelBrushKit,
  createPbTemplateEngine,
  PB_TEMPLATE_NAMES,
  pbTemplateBodyCue
} from "../src/championship/presentation/dataArena/dataArenaPbMoveTemplates.js";

const run = (sim, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.step(input);
};

function makeMockGfx() {
  let ops = 0;
  const g = {
    rect() { ops++; return g; },
    poly() { ops++; return g; },
    circle() { ops++; return g; },
    ellipse() { ops++; return g; },
    moveTo() { ops++; return g; },
    lineTo() { ops++; return g; },
    fill() { return g; },
    stroke() { return g; },
    get ops() { return ops; }
  };
  return g;
}

test("PB-Rank melee lunge applies visible knockback displacement and maintains clean separation", () => {
  const sim = createDataArenaSimulation({ mode: "RELAY", partnerId: "relay-species-121", controlMode: "MANUAL", seed: 19 });
  run(sim, 2.2);
  const st = sim.getState();
  st.reviewHoldRivals = true;
  st.player.kit = { ...st.player.kit, moves: ["pb-256", "pb-127", "pb-001"] };
  st.player.x = 420; st.player.y = 480; st.player.energy = 100;
  const rival = st.rivals[0];
  rival.x = 660; rival.y = 480; rival.hp = rival.maxHp = 10000;
  const beforeRivalX = rival.x;
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  let peakKnock = 0;
  for (let i = 0; i < 160; i++) {
    sim.step({});
    peakKnock = Math.max(peakKnock, Math.hypot(rival.x - beforeRivalX, rival.y - 480));
  }
  const sep = Math.hypot(rival.x - st.player.x, rival.y - st.player.y);
  assert.ok(peakKnock >= 90, `pb-256 knockback displacement should be >= 90px, got ${peakKnock.toFixed(1)}`);
  assert.ok(sep >= 55, `post-hit separation should be >= 55px, got ${sep.toFixed(1)}`);
});

test("PB-Rank guard block emits incoming angle and bounces melee attacker back", () => {
  const sim = createDataArenaSimulation({ mode: "RELAY", partnerId: "relay-species-121", controlMode: "MANUAL", seed: 19 });
  run(sim, 2.2);
  const st = sim.getState();
  st.reviewHoldRivals = true;
  st.player.kit = { ...st.player.kit, moves: ["pb-001", "pb-127", "pb-256"] };
  st.player.x = 460; st.player.y = 480; st.player.energy = 100;
  const rival = st.rivals[0];
  rival.x = 600; rival.y = 480; rival.hp = rival.maxHp = 10000;
  sim.drainEvents();
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  let sawGuardBlock = null;
  let attackerRebounded = false;
  for (let i = 0; i < 60; i++) {
    if (i === 16) sim.internals.tryStartGuard(rival);
    sim.step({});
    const evs = sim.drainEvents();
    const gb = evs.find((e) => e.type === "GUARD_BLOCK");
    if (gb) sawGuardBlock = gb;
    if (sawGuardBlock && st.player.kbx < -100) attackerRebounded = true;
  }
  assert.ok(sawGuardBlock, "expected GUARD_BLOCK event");
  assert.equal(typeof sawGuardBlock.angle, "number", "GUARD_BLOCK carries incoming angle");
  assert.ok(attackerRebounded, "melee attacker bounces back off an active guard");
});

test("detectIncomingThreat flags incoming hostile lunges and pbRankSpacingVector retreats during recovery", () => {
  const threat = detectIncomingThreat({
    body: { x: 520, y: 380, radius: 20 },
    hostileOwner: "rival",
    hostileTeam: "rival",
    hostileBody: { x: 380, y: 380, hp: 100, lunge: { actionId: 7, dirX: 1, dirY: 0, speed: 900, left: 260, width: 48 } },
    projectiles: [],
    zones: [],
    telegraphs: [],
    threatSeen: new Set(),
    horizon: 0.45
  });
  assert.ok(threat && threat.kind === "LUNGE", "incoming hostile lunge should be detected as an immediate threat");

  const retreat = pbRankSpacingVector({
    body: { x: 400, y: 380 },
    target: { x: 500, y: 380 },
    idealDist: 160,
    strafeDir: 1,
    strafeWeight: 0.34,
    retreating: true
  });
  assert.ok(retreat.x < 0, `retreating fighter at 100px should step back away from target, got x=${retreat.x}`);
});

test("pixel-snapped brush kit and all 14 declarative PB templates compile and draw cleanly (pure ASCII)", () => {
  const src = fs.readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPbMoveTemplates.js", import.meta.url), "utf8");
  assert.ok(/^[\x00-\x7F]*$/.test(src), "dataArenaPbMoveTemplates.js must be pure ASCII");
  assert.equal(PB_TEMPLATE_NAMES.length, 14);

  const spawned = [];
  const heroes = [];
  const decals = [];
  const api = {
    spawnP(p) { spawned.push(p); },
    addHero(h) { heroes.push(h); },
    addDecal(d) { decals.push(d); },
    rand: () => 0.5
  };
  const px = createPixelBrushKit(api);
  const gTop = makeMockGfx();
  const gAdd = makeMockGfx();
  px.puff(gTop, 100, 100, 18, 0x8e7c66, 0.9);
  px.ring(gTop, 100, 100, 48, 0xff8c1c, 0xfff0a8, 0.9, 6);
  px.burst(gAdd, 100, 100, 36, 8, 0xffb830, 0xffffff, 0.95, 1);
  px.slash(gAdd, 100, 100, 40, 0.7, 1.1, 12, 0x7ce2ff, 0xffffff, 0.95);
  px.crater(gTop, 100, 100, 40, 0x30261e, 0x8e7a64, 0.9, 1);
  px.honeycombShield(gTop, 100, 100, 44, 0, 0.95, true);
  assert.ok(gTop.ops > 20 && gAdd.ops > 5, "pixel brush primitives should emit draw ops");

  const engine = createPbTemplateEngine(api, px);
  const specs = {};
  for (let i = 0; i < PB_TEMPLATE_NAMES.length; i++) {
    const tmpl = PB_TEMPLATE_NAMES[i];
    const id = `pb-test-${i}`;
    specs[id] = { key: `tmpl_${i}`, template: tmpl, palette: "fire", scale: 1.0 };
    const cue = pbTemplateBodyCue({ id, ...specs[id] });
    assert.ok(cue && cue.key === `tmpl_${i}`, `body cue for ${tmpl}`);
  }
  const compiled = engine.compileAll(specs);
  for (let i = 0; i < PB_TEMPLATE_NAMES.length; i++) {
    const sc = compiled[`tmpl_${i}`];
    assert.ok(sc && sc.cast && sc.release && sc.projectile && sc.hit && sc.blocked);
    sc.cast({ follow: () => ({ x: 100, y: 100, footY: 124 }), angle: 0.4, windup: 0.3 });
    sc.release({ follow: () => ({ x: 120, y: 100, footY: 124, alpha: 1 }), angle: 0.4 });
    sc.projectile({ follow: () => ({ x: 160, y: 100, footY: 124 }), angle: 0.4, life: 0.6 });
    sc.hit({ x: 200, y: 100, groundY: 124, angle: 0.4, heavy: true });
    sc.blocked({ x: 200, y: 100, angle: 0.4, parry: false });
  }
  for (const h of heroes) {
    h.age = h.life * 0.4;
    h.seed = 1;
    h.draw(h, 0.4, 0.016, { top: gTop, add: gAdd });
  }
  assert.ok(heroes.length >= PB_TEMPLATE_NAMES.length * 4, "all templates spawn hero effects");
  assert.ok(spawned.length > 0 && decals.length > 0, "templates emit particles and decals");
});
