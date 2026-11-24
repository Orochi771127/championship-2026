// UNIFIED_DATA_ARENA_COMBAT_20261121: unified 666-move choreography, shared fighter AI
// (MANUAL / COMMANDER / AUTO + Trainer Callout), Precision 0.5 s Guard, Lunge/Shot Clash,
// Sudden Death 4x pacing, Dynamic Cover Pillars, and live Matchup/Range HUD telemetry.
import test from "node:test";
import assert from "node:assert/strict";
import { createDataArenaSimulation } from "../src/championship/modes/dataArena/dataArenaSimulation.js";
import { createRelayReplayRecorder, createRelayReplayPlayer } from "../src/championship/modes/dataArena/dataArenaReplay.js";
import { GUARD_RULES, suddenDeathMultiplier, AI_DIFFICULTIES, pbRankInterceptDodge, pbRankCornerWaypoint, pbRankSpacingVector, detectIncomingThreat, pickUnifiedMove, evaluateSmartSwitch } from "../src/championship/modes/dataArena/dataArenaUnifiedAI.js";
import { weatherDamageMultiplier } from "../src/championship/modes/dataArena/dataArenaTacticalArts.js";
import { DATA_ARENA_RELAY } from "../src/championship/modes/dataArena/dataArenaRelay.js";
import { RELAY_ROSTER } from "../src/championship/modes/dataArena/dataArenaRelayRoster.js";
import { RELAY_POOL_MOVE_ELEMENT } from "../src/championship/modes/dataArena/dataArenaRelayKits.js";
import { listProductOriginalMoveRecords } from "../src/championship/contracts/productOriginalSpecies.js";
import { moveVfxChoreography } from "../src/championship/presentation/vfx/moveVfxChoreography.js";
import { MOVE_VFX_SET_PIECES, MOVE_VFX_PIECE_DRAWINGS, MOVE_VFX_SUPPORT_PIECES, MOVE_VFX_00GAMEDEVS_KEYS, LEGACY_3D_TO_00GD, createMoveVfxSetPieces, loadMoveVfx00GameDevsSprites, resolve00GameDevsPiece, resolve00GameDevsProjectile } from "../src/championship/presentation/vfx/moveVfxSetPieces.js";
import { MOVE_VFX_3D_PIECE_GROUP } from "../src/championship/presentation/vfx/moveVfxPieceSprites3dIndex.js";
import { MOVE_VFX_PIECE_SPRITES } from "../src/championship/presentation/vfx/moveVfxPieceSprites.js";
import { V2_ARCHETYPES, V2_ARCHETYPE_COMBAT_TUNING, resolveMoveSpecV2, calibrateV2Move } from "../src/championship/modes/dataArena/dataArenaMoveCatalogV2.js";
import { createDataArenaPixelFxV2 } from "../src/championship/presentation/dataArena/dataArenaPixelFxV2.js";
import { createDataArenaAudio } from "../src/championship/presentation/dataArena/dataArenaAudio.js";
import { createCombatMoveAudioEngine, movePitchRate, canonicalAudioElement } from "../src/championship/presentation/combatMoveAudioEngine.js";
import { createBattleImpactAudio } from "../src/championship/presentation/battleFx/battleImpactAudio.js";
import {
  CANONICAL_TEN_ELEMENTS, SURFACE_KINDS, normalizeCanonicalElement,
  inferMoveAilment, inferMoveSurfacePatch, resolveVortexTransform, resolveWallElementReaction, buildWallShatterShards
} from "../src/championship/modes/dataArena/dataArenaCombos.js";
import { BATTLE_MOVE_NAMES } from "../src/championship/text/battleMoveNames.js";
import { defaultDataArenaRecords } from "../src/championship/modes/dataArena/dataArenaSave.js";
import { DATA_ARENA_TEXT } from "../src/championship/text/dataArenaText.js";
import { readFileSync } from "node:fs";

function startRelayFight(opts = {}) {
  const partnerId = opts.partnerId ?? RELAY_ROSTER[0].id;
  const sim = createDataArenaSimulation({ mode: "RELAY", seed: 20261121, partnerId, ...opts });
  // Step past 2.0 s INTRO
  for (let i = 0; i < 130; i++) sim.step({});
  sim.drainEvents();
  return sim;
}

test("unified 666-move VFX: all 49 Data Arena pool moves and all 22 original-species moves have valid choreography", () => {
  const validPiece = (name) => MOVE_VFX_SET_PIECES.includes(name) || Boolean(MOVE_VFX_3D_PIECE_GROUP[name]);
  for (const id of Object.keys(RELAY_POOL_MOVE_ELEMENT)) {
    const c = moveVfxChoreography(id);
    assert.ok(c && c.contact, `pool move ${id} has contact choreography`);
    for (const phase of ["release", "contact"]) {
      if (!c[phase]) continue;
      assert.ok(validPiece(c[phase].piece), `pool ${id} ${phase} piece ${c[phase].piece}`);
      if (c[phase].sprite) assert.ok(MOVE_VFX_PIECE_DRAWINGS.includes(c[phase].sprite), `pool ${id} sprite ${c[phase].sprite}`);
    }
  }
  for (const rec of listProductOriginalMoveRecords()) {
    const c = moveVfxChoreography(rec.recordIndex);
    assert.ok(c && c.contact, `original move ${rec.recordIndex} has contact choreography`);
    assert.ok(validPiece(c.contact.piece), `original ${rec.recordIndex} piece ${c.contact.piece}`);
  }
});

test("unified AI: AUTO mode moves and casts autonomously; COMMANDER moves without auto-casting", () => {
  const autoSim = startRelayFight({ controlMode: "AUTO" });
  const startPos = { ...autoSim.getSnapshot().player };
  for (let i = 0; i < 240; i++) autoSim.step({});
  const autoSnap = autoSim.getSnapshot();
  assert.equal(autoSnap.controlMode, "AUTO");
  assert.ok(Math.hypot(autoSnap.player.x - startPos.x, autoSnap.player.y - startPos.y) > 20, "AUTO fighter repositions");
  assert.ok(autoSnap.stats.movesCast >= 1, `AUTO fighter casts autonomously (${autoSnap.stats.movesCast})`);

  const cmdSim = startRelayFight({ controlMode: "COMMANDER" });
  const cmdStart = { ...cmdSim.getSnapshot().player };
  for (let i = 0; i < 180; i++) cmdSim.step({});
  const cmdSnap = cmdSim.getSnapshot();
  assert.equal(cmdSnap.controlMode, "COMMANDER");
  assert.ok(Math.hypot(cmdSnap.player.x - cmdStart.x, cmdSnap.player.y - cmdStart.y) > 20, "COMMANDER fighter moves/repositions");
  assert.equal(cmdSnap.stats.movesCast, 0, "COMMANDER never casts without player command");
});

test("trainer priority callout in AUTO mode emits TRAINER_CALLOUT and executes the called move", () => {
  const sim = startRelayFight({ controlMode: "AUTO" });
  sim.step({ cast: 0 });
  const ev = sim.drainEvents();
  const callout = ev.find((e) => e.type === "TRAINER_CALLOUT");
  assert.ok(callout, "pressing a skill in AUTO emits TRAINER_CALLOUT");
  let sawCast = ev.some((e) => e.type === "CAST" && e.team === "player" && e.moveId === callout.moveId);
  for (let i = 0; i < 40 && !sawCast; i++) {
    sim.step({});
    if (sim.drainEvents().some((e) => e.type === "CAST" && e.team === "player" && e.moveId === callout.moveId)) sawCast = true;
  }
  assert.ok(sawCast, "called move executes cleanly");
});

test("precision 0.5 s Guard reduces damage by 65%, suppresses knockback, blocks during hitstun, and applies 3.0 s miss cooldown", () => {
  const sim = startRelayFight({ controlMode: "MANUAL" });
  const st = sim.getState();
  // Unhit guard -> expires after 0.5 s -> 3.0 s miss cooldown
  sim.step({ guard: true });
  let ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === "GUARD_START" && e.side === "player"), "GUARD_START emitted");
  assert.equal(sim.getSnapshot().player.guard.active, true);
  for (let i = 0; i < 35; i++) sim.step({});
  ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === "GUARD_MISS" && e.side === "player"), "unhit guard emits GUARD_MISS");
  assert.ok(sim.getSnapshot().player.guard.cooldown > 2.5, "miss cooldown is ~3.0 s");

  // Fresh sim: compare unguarded vs guarded hit damage
  const simA = startRelayFight({ controlMode: "MANUAL" });
  const hpBeforeA = simA.getState().player.hp;
  simA.internals.hurtPlayer(100, "RBOLT", 0, 0);
  const unguardedDmg = hpBeforeA - simA.getState().player.hp;

  const simB = startRelayFight({ controlMode: "MANUAL" });
  const hpBeforeB = simB.getState().player.hp;
  simB.step({ guard: true });
  simB.drainEvents();
  simB.internals.hurtPlayer(100, "RBOLT", 0, 0);
  const guardedDmg = hpBeforeB - simB.getState().player.hp;
  const blockEv = simB.drainEvents();
  assert.ok(blockEv.some((e) => e.type === "GUARD_BLOCK" && e.side === "player"), "GUARD_BLOCK emitted");
  assert.ok(Math.abs(guardedDmg / unguardedDmg - GUARD_RULES.damageScale) < 0.05, `guarded damage is ~35% (${guardedDmg} vs ${unguardedDmg})`);

  // Guard cannot start while in hitstun
  st.player.guardCooldown = 0;
  st.player.guardTimer = 0;
  st.player.hitstun = 0.2;
  assert.equal(sim.internals.tryStartGuard(st.player), false, "cannot start Guard during hitstun");
});

test("lunge-vs-lunge clash bounces both fighters and emits LUNGE_CLASH", () => {
  const sim = startRelayFight({ controlMode: "MANUAL" });
  const st = sim.getState();
  const rival = st.rivals[0];
  st.player.x = 500; st.player.y = 400;
  rival.x = 530; rival.y = 400;
  st.player.lunge = { actionId: 1, moveId: "fangRush", dirX: 1, dirY: 0, left: 200, speed: 600, width: 48, damage: 25, hits: new Set() };
  rival.lunge = { actionId: 2, moveId: "surfRush", dirX: -1, dirY: 0, left: 200, speed: 600, width: 48, damage: 25, hits: new Set() };
  sim.step({});
  const ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === "CLASH" && e.kind === "LUNGE_CLASH"), "LUNGE_CLASH emitted");
  assert.equal(st.player.lunge, null, "player lunge cancelled on bounce");
  assert.equal(rival.lunge, null, "rival lunge cancelled on bounce");
});

test("sudden death scales damage up to 4x in the final 25% of the Relay match", () => {
  assert.equal(suddenDeathMultiplier(100, 180), 1);
  assert.equal(suddenDeathMultiplier(135, 180), 1);
  assert.ok(suddenDeathMultiplier(157.5, 180) > 2.4 && suddenDeathMultiplier(157.5, 180) < 2.6);
  assert.equal(suddenDeathMultiplier(180, 180), 4);

  const sim = startRelayFight({ controlMode: "MANUAL" });
  sim.getState().tournament.roundTime = DATA_ARENA_RELAY.seconds - 1;
  sim.step({});
  const snap = sim.getSnapshot();
  assert.equal(snap.suddenDeath.active, true);
  assert.ok(snap.suddenDeath.multiplier > 3.8, `near-end Sudden Death multiplier near 4x (${snap.suddenDeath.multiplier})`);
});

test("dynamic cover pillars spawn cleanly, block raycast, and expire after TTL", () => {
  const sim = startRelayFight({ controlMode: "MANUAL" });
  const st = sim.getState();
  const rival = st.rivals[0];
  // Put player & rival far from center target tile
  const px = 640, py = 440;
  st.player.x = 300; st.player.y = 440;
  rival.x = 960; rival.y = 440;
  const prop = sim.internals.tryRaiseTempPillar(px, py, "iceCage", "frost");
  assert.ok(prop && prop.temporary && prop.material === "ICE", "temporary ICE pillar spawned");
  const cx = (prop.col + 0.5) * sim.grid.cell;
  const cy = (prop.row + 0.5) * sim.grid.cell;
  assert.equal(sim.grid.surfaceAt(cx, cy), "SOLID", "temporary pillar is SOLID");
  // Fast-forward past 12 s TTL
  prop.ttl = 0.01;
  sim.step({});
  assert.equal(prop.destroyed, true, "temporary pillar expires after TTL");
  assert.notEqual(sim.grid.surfaceAt(cx, cy), "SOLID", "tile reopens after expiry");
});

test("relay.matchups reports real-time effectiveness, range and ready state for HUD badges", () => {
  const sim = startRelayFight({ controlMode: "MANUAL" });
  const snap = sim.getSnapshot();
  assert.ok(snap.relay?.matchups, "matchups present in relay snapshot");
  assert.equal(snap.relay.matchups.moves.length, snap.kit.moves.length);
  for (const m of snap.relay.matchups.moves) {
    assert.ok(["SUPER", "NEUTRAL", "RESIST"].includes(m.effectiveness), `valid effectiveness ${m.effectiveness}`);
    assert.equal(typeof m.inRange, "boolean");
    assert.equal(typeof m.ready, "boolean");
    assert.ok(m.reach > 0);
  }
});

test("phase 2: rallyCry boosts ATK/SPD stages (capped at 2 per stay) and vitalPulse heals 30% (capped at 2 per battle)", () => {
  const sim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "rallyCry" });
  sim.step({ tactical: true });
  let ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === "STAT_BUFF" && e.atkStage === 1 && e.spdStage === 1), "first rallyCry raises ATK+1 SPD+1");
  sim.getState().player.tacticalCooldown = 0; sim.getState().player.recovery = 0; sim.getState().player.energy = 100;
  sim.step({ tactical: true });
  ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === "STAT_BUFF" && e.atkStage === 2 && e.buffsUsed === 2), "second rallyCry raises ATK+2");
  sim.getState().player.tacticalCooldown = 0; sim.getState().player.recovery = 0; sim.getState().player.energy = 100;
  sim.step({ tactical: true });
  assert.equal(sim.getState().player.buffsUsed, 2, "third rallyCry blocked by 2-per-stay cap");

  // vitalPulse 30% heal cap (2 per battle)
  const healSim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "vitalPulse" });
  const p = healSim.getState().player;
  p.hp = Math.round(p.maxHp * 0.25);
  const before = p.hp;
  healSim.step({ tactical: true });
  assert.ok(p.hp >= before + Math.round(p.maxHp * 0.29), "vitalPulse restores ~30% max HP");
  p.tacticalCooldown = 0; p.recovery = 0; p.energy = 100;
  healSim.step({ tactical: true });
  assert.equal(p.healsUsed, 2);
  const hpAfterTwo = p.hp;
  p.tacticalCooldown = 0; p.recovery = 0; p.energy = 100;
  healSim.step({ tactical: true });
  assert.equal(p.hp, hpAfterTwo, "third heal blocked by 2-per-battle cap");
});

test("phase 2: rapidFlurry auto-approaches into contact and lands a 4-hit combo", () => {
  const sim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "rapidFlurry" });
  const st = sim.getState();
  const rival = st.rivals[0];
  st.player.x = 460; st.player.y = 420;
  rival.x = 620; rival.y = 420; // 160 px away -> triggers Auto-Approach sprint!
  sim.step({ tactical: true });
  let ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === "APPROACH_START"), "out-of-reach flurry triggers Auto-Approach");
  let hits = 0;
  for (let i = 0; i < 80; i++) {
    sim.step({});
    hits += sim.drainEvents().filter((e) => e.type === "FLURRY_HIT").length;
  }
  assert.ok(hits >= 3, `rapidFlurry landed multi-hit combo (${hits} hits)`);
  assert.equal(st.player.defStage, -1, "rapidFlurry applies DEF -1 tradeoff");
});

test("phase 2: ironCounter reflects 1.6x damage and shadowAmbush teleports behind rival", () => {
  const cSim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "ironCounter" });
  const st = cSim.getState();
  const rival = st.rivals[0];
  st.player.x = 500; st.player.y = 420;
  rival.x = 620; rival.y = 420;
  const rivalHpBefore = rival.hp;
  cSim.step({ tactical: true });
  assert.equal(cSim.getSnapshot().player.tactical.counterActive, true);
  cSim.internals.hurtPlayer(50, "RBOLT", rival.x, rival.y);
  const ev = cSim.drainEvents();
  assert.ok(ev.some((e) => e.type === "COUNTER_RIPOSTE" && e.side === "player"), "COUNTER_RIPOSTE emitted");
  assert.ok(rival.hp < rivalHpBefore - 40, "rival took 1.6x reflected counter damage");

  const bSim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "shadowAmbush" });
  const bst = bSim.getState();
  const br = bst.rivals[0];
  bst.player.x = 420; bst.player.y = 420;
  br.x = 620; br.y = 420; br.facing = -1;
  bSim.step({ tactical: true });
  let sawBackstab = false;
  for (let i = 0; i < 30; i++) {
    bSim.step({});
    if (bSim.drainEvents().some((e) => e.type === "BACKSTAB_HIT")) sawBackstab = true;
  }
  assert.ok(sawBackstab, "shadowAmbush landed BACKSTAB_HIT after vanish");
  assert.ok(bst.player.x > br.x, "shadowAmbush blinked behind rival");
});

test("phase 2: spikeTrap lays hazards that chip on switch-in and clear cleanly", () => {
  const sim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "spikeTrap" });
  sim.step({ tactical: true });
  assert.equal(sim.getSnapshot().hazards.rival, 1);
  const rival = sim.getState().rivals[0];
  const hpBefore = rival.hp;
  sim.internals.triggerSwitchHazard(rival, "rival");
  assert.ok(rival.hp < hpBefore, "entry hazard chipped switching fighter");
});

test("phase 2: manual Guard Parry resets cooldown to 0s, Guard-Break shatters active Guard, and AI autoAttack=false disables auto-casting", () => {
  // Manual Guard Parry Reset
  const pSim = startRelayFight({ controlMode: "MANUAL" });
  pSim.step({ guard: true });
  pSim.internals.hurtPlayer(60, "RBOLT", 0, 0);
  for (let i = 0; i < 35; i++) pSim.step({});
  const pEv = pSim.drainEvents();
  assert.ok(pEv.some((e) => e.type === "GUARD_PARRY"), "manual Guard catch emits GUARD_PARRY");
  assert.equal(pSim.getSnapshot().player.guard.cooldown, 0, "manual Parry resets Guard cooldown to 0s");

  // Guard-Break smashes Guard
  const gbSim = startRelayFight({ controlMode: "MANUAL" });
  gbSim.step({ guard: true });
  gbSim.drainEvents();
  gbSim.internals.hurtPlayer(80, "LUNGE", 0, 0, { guardBreak: true });
  const gbEv = gbSim.drainEvents();
  assert.ok(gbEv.some((e) => e.type === "GUARD_BROKEN"), "guardBreak shatters active Guard");
  assert.equal(gbSim.getSnapshot().player.guard.active, false);

  // Granular AI toggle: AUTO with autoAttack=false moves without casting
  const aiSim = startRelayFight({ controlMode: "AUTO", aiSettings: { autoAttack: false, autoGuard: true, inputBuffer: true } });
  const p0 = { ...aiSim.getSnapshot().player };
  for (let i = 0; i < 160; i++) aiSim.step({});
  const aiSnap = aiSim.getSnapshot();
  assert.ok(Math.hypot(aiSnap.player.x - p0.x, aiSnap.player.y - p0.y) > 20, "AUTO with autoAttack=false still moves");
  assert.equal(aiSnap.stats.movesCast, 0, "AUTO with autoAttack=false never auto-casts");
});

test("phase 3: weatherShift applies 18s weather (1.5x/0.5x Fire/Water) and decoyShell absorbs hits until broken", () => {
  assert.equal(weatherDamageMultiplier("SUN", "fire"), 1.5);
  assert.equal(weatherDamageMultiplier("SUN", "water"), 0.5);
  assert.equal(weatherDamageMultiplier("RAIN", "water"), 1.5);
  assert.equal(weatherDamageMultiplier("RAIN", "fire"), 0.5);

  const wSim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "weatherShift" });
  wSim.step({ tactical: true });
  const wSnap = wSim.getSnapshot();
  assert.ok(["SUN", "RAIN", "SAND", "HAIL"].includes(wSnap.weather.kind), "weatherShift activates arena weather");
  assert.ok(wSnap.weather.remaining > 17 && wSnap.weather.remaining <= 18, "weather lasts 18s");

  const dSim = startRelayFight({ controlMode: "MANUAL", tacticalArt: "decoyShell" });
  const hp0 = dSim.getState().player.hp;
  dSim.step({ tactical: true });
  const hpAfterSpawn = dSim.getState().player.hp;
  assert.ok(hpAfterSpawn < hp0, "decoyShell spends 25% HP");
  assert.ok(dSim.getSnapshot().player.decoy?.hp > 0, "decoy active in snapshot");
  dSim.internals.hurtPlayer(25, "RBOLT", 0, 0);
  assert.equal(dSim.getState().player.hp, hpAfterSpawn, "decoy absorbs hit protecting real HP");
  dSim.internals.hurtPlayer(999, "RBOLT", 0, 0);
  const dEv = dSim.drainEvents();
  assert.ok(dEv.some((e) => e.type === "DECOY_BREAK"), "lethal hit breaks decoy cleanly");
  assert.equal(dSim.getSnapshot().player.decoy, null);
});

test("phase 3: deterministic replay recorder & playback reproduce identical match state", () => {
  const cfg = { mode: "RELAY", seed: 20261121, partnerId: RELAY_ROSTER[0].id, controlMode: "AUTO", tacticalArt: "rallyCry" };
  const sim1 = createDataArenaSimulation(cfg);
  const rec = createRelayReplayRecorder(cfg);
  for (let i = 0; i < 240; i++) {
    const inp = i === 145 ? { cast: 0 } : i === 170 ? { guard: true } : {};
    rec.record(inp);
    sim1.step(inp);
  }
  const replay = rec.finalize(sim1.getSnapshot());
  assert.ok(replay.frames.length < 20, `RLE compressed 240 steps into ${replay.frames.length} frames`);

  const sim2 = createDataArenaSimulation(replay.config);
  const player = createRelayReplayPlayer(replay);
  while (!player.isDone()) sim2.step(player.nextInput());
  assert.deepEqual(
    { hp: sim2.getSnapshot().player.hp, x: sim2.getSnapshot().player.x, movesCast: sim2.getSnapshot().stats.movesCast, rivalHp: sim2.getSnapshot().rivals[0]?.hp },
    { hp: sim1.getSnapshot().player.hp, x: sim1.getSnapshot().player.x, movesCast: sim1.getSnapshot().stats.movesCast, rivalHp: sim1.getSnapshot().rivals[0]?.hp }
  );
});

test("phase 4 / V2: all 666 moves resolve to valid V2 archetypes and baked patch-gg/pixelfx sprite keys", () => {
  const allIds = [...Object.keys(RELAY_POOL_MOVE_ELEMENT)];
  for (let i = 31; i <= 622; i++) allIds.push(`own-${i}`);
  assert.ok(allIds.length >= 640, `expected >= 640 moves, got ${allIds.length}`);
  const validPieces = new Set([...MOVE_VFX_SET_PIECES, ...MOVE_VFX_SUPPORT_PIECES, ...Object.keys(MOVE_VFX_PIECE_SPRITES)]);
  const archetypeCounts = new Map();
  for (const id of allIds) {
    const spec = resolveMoveSpecV2(id);
    assert.ok(V2_ARCHETYPES.includes(spec.v2Archetype), `${id} archetype ${spec.v2Archetype}`);
    assert.ok(MOVE_VFX_PIECE_SPRITES[spec.flightLook], `${id} flightLook ${spec.flightLook} exists in MOVE_VFX_PIECE_SPRITES`);
    assert.ok(validPieces.has(spec.contactLook), `${id} contactLook ${spec.contactLook} is playable`);
    assert.ok(validPieces.has(spec.releaseLook), `${id} releaseLook ${spec.releaseLook} is playable`);
    assert.ok(validPieces.has(spec.groundLook), `${id} groundLook ${spec.groundLook} is playable`);
    archetypeCounts.set(spec.v2Archetype, (archetypeCounts.get(spec.v2Archetype) ?? 0) + 1);
  }
  assert.ok(archetypeCounts.size >= 14, `diverse coverage across V2 archetypes (${archetypeCounts.size}/18)`);
});

test("phase 4 / V2: shield moves raise physical destructible elemental cover walls on the battlefield", () => {
  const partnerId = RELAY_ROSTER[0].id;
  const sim = startRelayFight({ partnerId, moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  s.player.kit = { ...s.player.kit, moves: ["rockGuard", "glacierGuard", "barkGuard"] };
  s.player.energy = 100;
  s.player.x = 640; s.player.y = 480;
  const rival = s.rivals[0];
  rival.x = 960; rival.y = 480;
  // Cast rockGuard -> raises physical STONE wall right in front of caster!
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  for (let i = 0; i < 25; i++) sim.step({});
  const evs = sim.drainEvents();
  const wallEv = evs.find((e) => e.type === "TEMP_PROP_SPAWN");
  assert.ok(wallEv, "casting rockGuard spawns a physical temporary barrier prop on the field");
  assert.equal(wallEv.material, "STONE", "rockGuard spawns a STONE barrier wall");
  const liveWall = sim.grid.props.find((p) => p.id === wallEv.id && !p.destroyed);
  assert.ok(liveWall, "spawned barrier wall exists on grid and blocks projectiles/movement");
  assert.ok(sim.grid.isSolid(liveWall.cells[0]), "barrier cell is physically solid on the grid");

  // Cast glacierGuard -> raises ICE wall
  s.player.energy = 100; s.player.recovery = 0;
  sim.step({ cast: 1, aimX: rival.x, aimY: rival.y + 80 });
  for (let i = 0; i < 25; i++) sim.step({});
  const evs2 = sim.drainEvents();
  assert.ok(evs2.some((e) => e.type === "TEMP_PROP_SPAWN" && e.material === "ICE"), "glacierGuard spawns an ICE barrier wall");

  // Verify enemy projectile is physically stopped by the raised wall!
  const wallProp = sim.grid.props.find((p) => p.temporary && !p.destroyed && p.owner === s.player.id);
  const beforeHp = wallProp.hp;
  sim.grid.damageProp(wallProp, 40, [], "PROJECTILE", "fire");
  assert.ok(wallProp.hp < beforeHp, "barrier wall absorbs projectile damage");
});

test("phase 4 / V2: V2 combat archetypes execute flurry, backstab, homing, vortex pull, and pure PixelFX engine lifecycle", () => {
  const partnerId = RELAY_ROSTER[0].id;
  const sim = startRelayFight({ partnerId, moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  s.player.kit = { ...s.player.kit, moves: ["fangRush", "shadeStep", "emberBolt"] };
  const rival = s.rivals[0];
  s.player.x = 640; s.player.y = 480;
  rival.x = 750; rival.y = 480;
  s.player.energy = 100;

  // Slot 0: fangRush -> V2 FLURRY_COMBO (3-hit martial-arts flurry)
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  const events = [];
  for (let i = 0; i < 45; i++) { sim.step({}); events.push(...sim.drainEvents()); }
  assert.ok(events.some((e) => e.type === "FLURRY_START"), "V2 fangRush triggers FLURRY_COMBO");
  assert.ok(events.filter((e) => e.type === "FLURRY_HIT").length >= 2, "V2 FLURRY_COMBO lands multi-hit strikes");

  // Slot 1: shadeStep -> V2 SHADOW_BACKSTAB
  s.player.energy = 100; s.player.recovery = 0;
  sim.step({ cast: 1, aimX: rival.x, aimY: rival.y });
  const bsEvents = [];
  for (let i = 0; i < 35; i++) { sim.step({}); bsEvents.push(...sim.drainEvents()); }
  assert.ok(bsEvents.some((e) => e.type === "BACKSTAB_VANISH"), "V2 shadeStep vanishes");
  assert.ok(bsEvents.some((e) => e.type === "BACKSTAB_HIT"), "V2 shadeStep strikes from behind");

  // Slot 2: emberBolt -> V2 HOMING_ORB
  s.player.energy = 100; s.player.recovery = 0;
  rival.x = 980; rival.y = 540;
  sim.step({ cast: 2, aimX: rival.x, aimY: 420 });
  let sawHoming = false;
  for (let i = 0; i < 30; i++) {
    sim.step({});
    if (s.projectiles.some((p) => p.moveId === "emberBolt" && p.homing > 0)) sawHoming = true;
  }
  assert.ok(sawHoming, "V2 emberBolt spawns a gently homing projectile");

  // Pure PixelFX V2 presentation engine lifecycle smoke test (headless mock PIXI)
  class MockNode {
    constructor() { this.children = []; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { set() {} }; this.visible = true; this.alpha = 1; }
    addChild(c) { this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
    destroy() { this.destroyed = true; }
  }
  const MockPIXI = { Container: MockNode, Sprite: MockNode, Texture: { from: () => ({ source: {}, destroy() {} }) } };
  const fx = createDataArenaPixelFxV2({ PIXI: MockPIXI, ground: new MockNode(), front: new MockNode(), quality: "high" });
  assert.ok(fx && fx.isPixelFxV2, "createDataArenaPixelFxV2 mounts cleanly");
  fx.cast({ x: 100, y: 100, moveId: "coreNova", windup: 0.4 });
  fx.release({ x: 100, y: 100, angle: 0, moveId: "fangRush", melee: true });
  fx.hit({ x: 200, y: 100, groundY: 120, moveId: "fangRush", heavy: true });
  fx.area({ x: 200, y: 120, radius: 110, moveId: "flameRing" });
  fx.ult({ moveId: "coreNova", center: { x: 200, y: 120 } });
  fx.buff({ x: 100, y: 100 });
  fx.heal({ x: 100, y: 100 });
  fx.parry({ x: 100, y: 100 });
  fx.clash({ x: 150, y: 100 });
  fx.prop({ x: 160, y: 110, material: "ICE", broken: true });
  assert.equal(fx.eventRing({ x: 100, y: 100, radius: 50, tint: 0xffe066 }), true);
  fx.update(16.67);
  const diag = fx.getDiagnostics();
  assert.equal(diag.engine, "pixelfx-v2");
  assert.ok(diag.hits >= 2 && diag.ults >= 1 && diag.props >= 1 && diag.clashes >= 1);
  fx.dispose();
});

test("phase 4 / V2: leap-slam, shockwave-ring, grab-slam, telekinesis-slam physics & pure pixelfx visual hygiene", () => {
  // 1. Verify NO move in V2 maps to mismatched custom cartoon props OR wrong-element VFX!
  const allIds = [...Object.keys(RELAY_POOL_MOVE_ELEMENT)];
  for (let i = 31; i <= 622; i++) allIds.push(`own-${i}`);
  const banned = new Set(["flurry-spore", "flurry-heart", "flurry-note", "drop-bomb", "drop-rock", "shot-fish", "shot-heart", "shot-xp"]);
  for (const id of allIds) {
    const spec = resolveMoveSpecV2(id);
    assert.ok(!banned.has(spec.contactLook), `${id} contactLook must not be mismatched prop ${spec.contactLook}`);
    assert.ok(!banned.has(spec.flightLook), `${id} flightLook must not be mismatched prop ${spec.flightLook}`);
    if (["flurry-leaf", "vines"].includes(spec.contactLook) || spec.flightLook === "shot-leaf") {
      assert.ok(["nature", "wind"].includes(spec.paletteKey), `${id} leaf/vine VFX matches nature/wind palette (got ${spec.paletteKey})`);
    }
    if (["flurry-bubble", "wave"].includes(spec.contactLook) || spec.flightLook === "shot-water") {
      assert.ok(["water", "ice"].includes(spec.paletteKey), `${id} water/bubble VFX matches water/ice palette (got ${spec.paletteKey})`);
    }
  }

  // 2. Verify live physics: LEAP_SLAM (brutalCharge), SHOCKWAVE_RING (quakeSlam), GRAB_SLAM (thornRush), TELEKINESIS_SLAM (shadeField)
  const partnerId = RELAY_ROSTER[0].id;
  const sim = startRelayFight({ partnerId, moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  s.player.kit = { ...s.player.kit, moves: ["brutalCharge", "quakeSlam", "thornRush"] };
  const rival = s.rivals[0];
  s.player.x = 640; s.player.y = 480;
  rival.x = 760; rival.y = 480;
  s.player.energy = 100;

  // Slot 0: brutalCharge -> LEAP_SLAM (character leaps up airZ > 40, then slams down with shockwave)
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  let peakPlayerAirZ = 0;
  const leapEvs = [];
  for (let i = 0; i < 65; i++) {
    sim.step({});
    peakPlayerAirZ = Math.max(peakPlayerAirZ, s.player.airZ ?? 0);
    leapEvs.push(...sim.drainEvents());
  }
  assert.ok(peakPlayerAirZ >= 50, `LEAP_SLAM lifted fighter into mid-air (peak airZ=${peakPlayerAirZ})`);
  assert.ok(leapEvs.some((e) => e.type === "LEAP_SLAM_HIT"), "LEAP_SLAM triggers ground slam impact");

  // Slot 1: quakeSlam -> SHOCKWAVE_RING (expanding floor shockwave)
  s.player.energy = 100; s.player.recovery = 0;
  sim.step({ cast: 1, aimX: rival.x, aimY: rival.y });
  let sawShockwave = false;
  for (let i = 0; i < 35; i++) {
    sim.step({});
    if (s.shockwaves.length > 0) sawShockwave = true;
  }
  const swEvs = sim.drainEvents();
  assert.ok(sawShockwave && swEvs.some((e) => e.type === "SHOCKWAVE_START"), "SHOCKWAVE_RING spawns expanding floor shockwave");

  // Slot 2: thornRush -> GRAB_SLAM (rushes in, lifts rival airZ > 30, slams into floor!)
  s.player.energy = 100; s.player.recovery = 0;
  rival.x = s.player.x + 80; rival.y = s.player.y;
  sim.step({ cast: 2, aimX: rival.x, aimY: rival.y });
  let peakGrabRivalZ = 0;
  const grabEvs = [];
  for (let i = 0; i < 75; i++) {
    sim.step({});
    peakGrabRivalZ = Math.max(peakGrabRivalZ, rival.airZ ?? 0);
    grabEvs.push(...sim.drainEvents());
  }
  assert.ok(peakGrabRivalZ >= 35, `GRAB_SLAM lifted rival overhead (peak airZ=${peakGrabRivalZ})`);
  assert.ok(grabEvs.some((e) => e.type === "GRAB_SLAM_HIT"), "GRAB_SLAM slams rival onto the floor");

  // TELEKINESIS_SLAM (shadeField): levitates rival from range (airZ >= 60, tkHeld = 1) then slams down!
  const tkSim = startRelayFight({ partnerId, moveSystem: "v2", controlMode: "MANUAL" });
  const ts = tkSim.getState();
  ts.player.kit = { ...ts.player.kit, moves: ["shadeField", "emberBolt", "rockGuard"] };
  const tr = ts.rivals[0];
  ts.player.x = 560; ts.player.y = 480;
  tr.x = 800; tr.y = 480;
  ts.player.energy = 100;
  tkSim.step({ cast: 0, aimX: tr.x, aimY: tr.y });
  let peakTkZ = 0;
  const tkEvs = [];
  for (let i = 0; i < 85; i++) {
    tkSim.step({});
    peakTkZ = Math.max(peakTkZ, tr.airZ ?? 0);
    tkEvs.push(...tkSim.drainEvents());
  }
  assert.ok(peakTkZ >= 60, `TELEKINESIS_SLAM levitated rival from range (peak airZ=${peakTkZ})`);
  assert.ok(tkEvs.some((e) => e.type === "TK_SLAM_HIT"), "TELEKINESIS_SLAM slams rival onto floor");
});

test("phase 4 / V2: directional PixelFX pieces (wave, slash, lance, stream) rotate in 360 deg without flipping upside-down", () => {
  const sprites = [];
  class MockScale { constructor() { this.x = 1; this.y = 1; } set(x, y = x) { this.x = x; this.y = y; } }
  class MockNode {
    constructor() { this.children = []; this.anchor = { set() {} }; this.scale = new MockScale(); this.position = { set() {} }; this.visible = true; this.alpha = 1; this.rotation = 0; }
    addChild(c) { this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
    destroy() { this.destroyed = true; }
  }
  const MockPIXI = {
    Container: MockNode,
    Rectangle: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
    Texture: class {
      constructor(opts) { this.source = opts?.source ?? {}; }
      static from() { return { source: {}, destroy() {} }; }
      destroy() {}
    },
    Sprite: class extends MockNode { constructor(t) { super(); this.texture = t; sprites.push(this); } }
  };
  const fakeDoc = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} })
    })
  };
  const layer = new MockNode();
  const pal = { core: 0xffffff, main: 0x38bdf8, edge: 0x0369a1 };
  const pieces = createMoveVfxSetPieces({ PIXI: MockPIXI, layer, doc: fakeDoc, sprites: MOVE_VFX_PIECE_SPRITES });

  // Cast slash DOWN (+PI/2) -> rotates to +PI/2!
  assert.equal(pieces.play("slash", { x: 100, y: 100, angle: Math.PI / 2, palette: pal }), true);
  const slashDown = sprites.at(-1);
  assert.ok(Math.abs(slashDown.rotation - Math.PI / 2) < 1e-6, "directional slash rotates to downward heading (+PI/2)");

  // Cast slash LEFT (PI) -> rotates to PI and flips scale.y < 0 so arc stays right-side-up!
  assert.equal(pieces.play("slash", { x: 100, y: 100, angle: Math.PI, palette: pal }), true);
  const slashLeft = sprites.at(-1);
  assert.ok(Math.abs(slashLeft.rotation - Math.PI) < 1e-6, "directional slash rotates to leftward heading (PI)");
  assert.ok(slashLeft.scale.x > 0 && slashLeft.scale.y < 0, "leftward slash stays right-side-up via scale.y < 0");

  // Cast wave diagonally LEFT (3*PI/4) -> stays upright on floor (rotation === 0) and mirrors horizontally!
  assert.equal(pieces.play("wave", { x: 100, y: 100, angle: (3 * Math.PI) / 4, palette: pal }), true);
  const waveLeft = sprites.at(-1);
  assert.equal(waveLeft.rotation, 0, "wave never tilts diagonally like a flat sticker");
  assert.ok(waveLeft.scale.x < 0 && waveLeft.scale.y > 0, "leftward wave mirrors horizontally while staying upright");

  // Cast quake at diagonal angle -> stays upright (rotation === 0)!
  assert.equal(pieces.play("quake", { x: 100, y: 100, angle: 1.1, palette: pal }), true);
  const quakeDiag = sprites.at(-1);
  assert.equal(quakeDiag.rotation, 0, "ground-anchored quake stays upright");
  pieces.dispose();
});

test("move #1 & #2: surfRush carries surfRider wave & 3D tornado vortex lifts and spirals enemies midair", () => {
  assert.equal(resolveMoveSpecV2("surfRush").surfRider, true, "surfRush carries a 3D surf wave under the rider");
  for (const stormId of ["vortex", "whiteout", "shardStorm", "own-94", "own-167", "own-380"]) {
    assert.equal(resolveMoveSpecV2(stormId).v2Archetype, "VORTEX_PULL", `${stormId} resolves to lifting 3D VORTEX_PULL`);
  }

  const partnerId = RELAY_ROSTER[0].id;
  const sim = startRelayFight({ partnerId, moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  s.player.kit = { ...s.player.kit, moves: ["foamZone", "surfRush", "tideWave"], ultimate: "vortex" };
  const rival = s.rivals[0];
  s.player.x = 560; s.player.y = 480;
  rival.x = 640; rival.y = 480;
  rival.guardTimer = 0;
  s.player.energy = 100;

  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  let maxAirZ = 0;
  let sawPlaced = false;
  let sawOrbitMotion = false;
  const startY = rival.y;
  for (let i = 0; i < 85; i++) {
    sim.step({});
    const evs = sim.drainEvents();
    if (evs.some((e) => e.type === "ZONE_PLACED" && e.vortexLift)) sawPlaced = true;
    if ((rival.airZ ?? 0) > maxAirZ) maxAirZ = rival.airZ;
    if (Math.abs(rival.y - startY) > 12) sawOrbitMotion = true;
  }
  assert.ok(sawPlaced, "casting storm/vortex emits ZONE_PLACED with vortexLift: true");
  assert.ok(maxAirZ >= 55, `tornado lifts caught rival into midair (maxAirZ=${maxAirZ})`);
  assert.ok(sawOrbitMotion, "tornado spirals caught rival tangentially around the funnel eye");
});

test("move #3 & #4: organic shield wall angle, BURROW_AMBUSH tunnel+erupt launch, GROUND_SPIKES chain & 2x quake counterplay", () => {
  assert.equal(resolveMoveSpecV2("own-63").v2Archetype, "BURROW_AMBUSH", "穿地三爪 resolves to BURROW_AMBUSH");
  assert.equal(resolveMoveSpecV2("shardVolley").v2Archetype, "GROUND_SPIKES", "碎晶連射 resolves to GROUND_SPIKES");

  const partnerId = RELAY_ROSTER[0].id;
  const sim = startRelayFight({ partnerId, moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  s.player.kit = { ...s.player.kit, moves: ["own-63", "shardVolley", "rockGuard"] };
  const rival = s.rivals[0];
  s.player.x = 560; s.player.y = 480;
  rival.x = 740; rival.y = 480;
  rival.guardTimer = 0;
  s.player.energy = 100;

  // 1. BURROW_AMBUSH: dives underground, rushes, erupts launching rival midair!
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  let sawBurrowed = false, sawErupt = false, maxRivalAirZ = 0;
  for (let i = 0; i < 65; i++) {
    sim.step({});
    const evs = sim.drainEvents();
    if (s.player.burrowed) sawBurrowed = true;
    if (evs.some((e) => e.type === "BURROW_ERUPT")) sawErupt = true;
    if ((rival.airZ ?? 0) > maxRivalAirZ) maxRivalAirZ = rival.airZ;
  }
  assert.ok(sawBurrowed, "BURROW_AMBUSH submerges caster underground");
  assert.ok(sawErupt, "BURROW_AMBUSH erupts violently underneath target");
  assert.ok(maxRivalAirZ >= 60, `BURROW_AMBUSH launches target into midair (maxAirZ=${maxRivalAirZ})`);

  // 2. GROUND_SPIKES: sequential traveling 3D spires erupting along attack vector!
  s.player.x = 500; s.player.y = 480; s.player.energy = 100; s.player.recovery = 0;
  rival.x = 640; rival.y = 480; rival.airZ = 0;
  sim.step({ cast: 1, aimX: rival.x, aimY: rival.y });
  let spikeCount = 0;
  for (let i = 0; i < 55; i++) {
    sim.step({});
    const evs = sim.drainEvents();
    spikeCount += evs.filter((e) => e.type === "GROUND_SPIKE_ERUPT").length;
  }
  assert.ok(spikeCount >= 3, `GROUND_SPIKES erupts sequential chain of spires (count=${spikeCount})`);
});

test("move #5-#8: Batch 2 3D volumetric crater shockwave, spiral beam, meteor/thunder drop, and psychic cage mount cleanly", async () => {
  const {
    createVolumetricCraterShockwaveSprite,
    createVolumetricBeamSprite,
    createVolumetricMeteorSprite,
    createVolumetricPsychicCageSprite
  } = await import("../src/championship/presentation/dataArena/dataArenaVolumetricCombat3D.js");
  const noop = () => {};
  const fakeCtx = {
    clearRect: noop, save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, ellipse: noop, fill: noop, stroke: noop, fillRect: noop
  };
  const fakeDoc = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }) };
  class Node {
    constructor() { this.children = []; this.anchor = { set: noop }; this.scale = { set: noop }; this.position = { set: noop }; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
    destroy() { this.destroyed = true; }
  }
  const MockPIXI = {
    Texture: { from: () => ({ source: { update: noop }, destroy: noop }) },
    Sprite: class extends Node { constructor(t) { super(); this.texture = t; } }
  };
  const layer = new Node();
  const fxList = [
    createVolumetricCraterShockwaveSprite({ PIXI: MockPIXI, layer, x: 100, y: 100, paletteKey: "earth", durationSec: 0.4, doc: fakeDoc }),
    createVolumetricBeamSprite({ PIXI: MockPIXI, layer, x: 100, y: 100, angle: 0.7, paletteKey: "light", durationSec: 0.4, doc: fakeDoc }),
    createVolumetricMeteorSprite({ PIXI: MockPIXI, layer, x: 100, y: 100, paletteKey: "thunder", variant: "thunder", durationSec: 0.4, doc: fakeDoc }),
    createVolumetricPsychicCageSprite({ PIXI: MockPIXI, layer, x: 100, y: 100, paletteKey: "dark", mode: "telekinesis", durationSec: 0.4, doc: fakeDoc })
  ];
  assert.equal(fxList.every(Boolean), true, "all 4 Batch 2 3D volumetric FX instantiate cleanly");
  assert.equal(layer.children.length, 4, "all 4 sprites mounted onto Pixi layer");
  for (const fx of fxList) {
    assert.equal(fx.update(0.15), true);
    assert.equal(fx.update(0.45), false, "disposes cleanly after duration");
  }
  assert.equal(layer.children.length, 0, "all 4 sprites removed and disposed with zero leaks");
});

test("web crash-proof LRU GPU sheet cache: zero per-frame re-bakes, strict VRAM & concurrency caps, and 100% dispose", async () => {
  const { createVolumetricSheetCache } = await import("../src/championship/presentation/dataArena/dataArenaVolumetricCache.js");
  const noop = () => {};
  const fakeCtx = { clearRect: noop, drawImage: noop };
  const fakeDoc = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }) };
  let destroyedBases = 0;
  class Node {
    constructor() { this.children = []; this.anchor = { set: noop }; this.scale = { set: noop }; this.position = { set: noop }; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
    destroy() { this.destroyed = true; }
  }
  const MockPIXI = {
    Rectangle: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
    Texture: class {
      constructor(opts) { this.source = opts?.source ?? {}; }
      static from() { return { source: { scaleMode: "linear" }, destroy() { destroyedBases++; } }; }
      destroy() {}
    },
    Sprite: class extends Node { constructor(t) { super(); this.texture = t; } }
  };
  const layer = new Node();
  const cache = createVolumetricSheetCache({ PIXI: MockPIXI, maxSheets: 4, maxLive: 3, doc: fakeDoc });

  let renderCalls = 0;
  // Spawn same 3D move 10 times at same direction -> MUST bake ONLY ONCE (8 frames) and hit cache 9 times!
  for (let i = 0; i < 10; i++) {
    cache.spawn({
      layer, keyPrefix: "wave|water", width: 64, height: 64, frameCount: 8, directional: true, angle: 0,
      durationSec: 0.5, renderForAngle: () => { renderCalls++; }
    });
  }
  assert.equal(renderCalls, 8, "identical 3D move bakes 8 frames ONCE, zero per-cast or per-frame re-bakes");
  assert.equal(cache.getDiagnostics().cacheHits, 9, "subsequent casts hit GPU cache");
  assert.ok(cache.getDiagnostics().liveSprites <= 3, "strict concurrent sprite cap enforced (<= 3)");

  // Spawn 8 distinct sheets -> LRU evicts oldest so cachedSheets never exceeds maxSheets (4)!
  for (let i = 0; i < 8; i++) {
    cache.spawn({
      layer, keyPrefix: `test|${i}`, width: 64, height: 64, frameCount: 6, directional: false,
      durationSec: 0.2, renderForAngle: noop
    });
    cache.update(0.3); // expire live sprite so eviction can immediately free GPU memory
  }
  const d = cache.getDiagnostics();
  assert.ok(d.cachedSheets <= 4, `LRU cache strictly capped at maxSheets=4 (got ${d.cachedSheets})`);
  assert.ok(destroyedBases >= 4, `evicted GPU base textures cleanly destroyed (${destroyedBases})`);

  cache.dispose();
  assert.equal(cache.getDiagnostics().cachedSheets, 0, "dispose releases 100% of cached GPU sheets");
  assert.equal(cache.getDiagnostics().estimatedVramMb, 0, "dispose zeroes VRAM estimate");
  assert.equal(layer.children.length, 0, "dispose removes all live sprites");
});

test("666-move procedural SFX & fighting-game impact audio: all 20 archetypes, 13 elements, 6 wall materials, and hit tiers synthesize cleanly", () => {
  let oscCount = 0, noiseCount = 0;
  const makeParam = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  let clock = 0;
  const mockContext = {
    sampleRate: 44100,
    state: "running",
    get currentTime() { return clock; },
    createGain() { return { gain: makeParam(), connect() {}, disconnect() {} }; },
    createBiquadFilter() { return { type: "bandpass", frequency: makeParam(), Q: makeParam(), connect() {} }; },
    createOscillator() { oscCount++; return { type: "sine", frequency: makeParam(), connect() {}, start() {}, stop() {} }; },
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource() { noiseCount++; return { buffer: null, playbackRate: makeParam(), connect() {}, start() {}, stop() {} }; }
  };
  const audio = createDataArenaAudio({ bus: { output: () => ({ context: mockContext, destination: {} }) } });
  assert.equal(audio.available, true);

  const elements = ["fire", "water", "ice", "thunder", "wind", "earth", "nature", "light", "dark", "metal", "toxic", "psychic", "neutral"];
  for (let i = 0; i < V2_ARCHETYPES.length; i++) {
    clock += 0.25;
    audio.playMove({ archetype: V2_ARCHETYPES[i], element: elements[i % elements.length], phase: "release", ultimate: i % 5 === 0, step: i });
  }
  for (const material of ["STONE", "WOOD", "ICE", "BASALT", "CRYSTAL", "METAL"]) {
    clock += 0.25;
    audio.playMove({ archetype: "PROTECT_COUNTER", element: "earth", phase: "wall", material });
  }
  for (const impact of [
    { amount: 8 },
    { amount: 18, combo: 3 },
    { amount: 36, effectiveness: "super", combo: 5 },
    { amount: 12, effectiveness: "resist" },
    { guarded: true },
    { parry: true },
    { guardBreak: true },
    { clash: true }
  ]) {
    clock += 0.25;
    audio.playImpact(impact);
  }
  const diag = audio.getDiagnostics();
  assert.ok(diag.movesPlayed >= 15, `played procedural move SFX (${diag.movesPlayed})`);
  assert.ok(diag.impactsPlayed >= 5, `played fighting-game impact SFX (${diag.impactsPlayed})`);
  assert.ok(oscCount > 20 && noiseCount > 10, `layered oscillators (${oscCount}) + noise bursts (${noiseCount})`);
  for (const cue of ["shatter", "combo", "igniteBoom", "freezeSnap", "shockArc", "sleep", "poison", "paralyze", "refused"]) {
    clock += 0.3;
    audio.play(cue);
  }
  assert.ok(audio.getDiagnostics().played >= diag.played + 9, "all reaction & ailment SFX cues play cleanly");
  audio.dispose();
});

test("phase 6 / 10-element physical-chemistry: all 638 moves resolve across canonical 10 elements with surface & ailment coverage", () => {
  const allIds = [...Object.keys(RELAY_POOL_MOVE_ELEMENT), ...Object.keys(BATTLE_MOVE_NAMES).map((n) => `own-${n}`)];
  assert.ok(allIds.length >= 630, `expected >= 630 catalog moves, got ${allIds.length}`);
  const elemCounts = Object.fromEntries(CANONICAL_TEN_ELEMENTS.map((e) => [e, 0]));
  const surfaceCounts = {};
  const ailmentCounts = {};
  for (const id of allIds) {
    const spec = resolveMoveSpecV2(id);
    const el = normalizeCanonicalElement(RELAY_POOL_MOVE_ELEMENT[id] ?? spec.paletteKey, id);
    if (el && elemCounts[el] !== undefined) elemCounts[el]++;
    const surf = inferMoveSurfacePatch(id, spec.paletteKey, el, { v2Archetype: spec.v2Archetype });
    if (surf) surfaceCounts[surf.kind] = (surfaceCounts[surf.kind] ?? 0) + 1;
    const ail = inferMoveAilment(id, spec.paletteKey, el, { type: "ZONE" });
    if (ail) {
      const k = ail.sleep ? "SLEEP" : ail.root ? "FREEZE" : ail.paralyze ? "PARALYZE" : ail.poison ? "POISON" : ail.burn ? "BURN" : ail.wet ? "WET" : "SLOW";
      ailmentCounts[k] = (ailmentCounts[k] ?? 0) + 1;
    }
  }
  for (const el of CANONICAL_TEN_ELEMENTS) {
    assert.ok(elemCounts[el] > 0, `canonical element ${el} has active moves (${elemCounts[el]})`);
  }
  assert.ok((surfaceCounts.POISON_POOL ?? 0) >= 8, `poison/sludge moves deposit POISON_POOL (${surfaceCounts.POISON_POOL})`);
  assert.ok((surfaceCounts.WATER_PUDDLE ?? 0) >= 20, `water moves deposit WATER_PUDDLE (${surfaceCounts.WATER_PUDDLE})`);
  assert.ok((surfaceCounts.ICE_PATCH ?? 0) >= 10, `ice moves deposit ICE_PATCH (${surfaceCounts.ICE_PATCH})`);
  assert.ok((surfaceCounts.FIRE_PATCH ?? 0) >= 15, `fire moves deposit FIRE_PATCH (${surfaceCounts.FIRE_PATCH})`);
  assert.ok((surfaceCounts.VINE_PATCH ?? 0) >= 8, `wood moves deposit VINE_PATCH (${surfaceCounts.VINE_PATCH})`);
  for (const k of ["SLEEP", "FREEZE", "PARALYZE", "POISON", "BURN"]) {
    assert.ok((ailmentCounts[k] ?? 0) > 0, `ailment ${k} covered across 666 moves (${ailmentCounts[k]})`);
  }
});

test("phase 6 / ground surfaces: poison pool + fire chain-detonates like gasoline; water + ice freezes; water + thunder electrifies; fire + wind spreads", () => {
  const sim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  const rival = s.rivals[0];
  rival.x = 700; rival.y = 480;
  s.player.x = 500; s.player.y = 480;

  // 1) Two touching POISON_POOLs -> FIRE triggers gasoline-like POISON_IGNITE chain detonation!
  sim.internals.spawnSurfacePatch({ kind: SURFACE_KINDS.POISON_POOL, x: 690, y: 480, radius: 74, ttl: 8, team: "player", moveId: "own-440" });
  sim.internals.spawnSurfacePatch({ kind: SURFACE_KINDS.POISON_POOL, x: 760, y: 480, radius: 74, ttl: 8, team: "player", moveId: "own-440" });
  sim.drainEvents();
  const hpBeforeIgnite = rival.hp;
  const rxCount = sim.internals.triggerSurfaceReactionAt(690, 480, "FIRE", "emberBolt", "player", 0);
  const evIgnite = sim.drainEvents();
  assert.equal(rxCount, 2, "touching poison pools chain-detonate together like gasoline");
  assert.equal(evIgnite.filter((e) => e.type === "SURFACE_REACT" && e.kind === "POISON_IGNITE").length, 2, "emits POISON_IGNITE for both pools");
  assert.ok(rival.hp < hpBeforeIgnite, "gasoline poison detonation deals AoE blast damage");
  assert.ok(rival.burn > 0, "gasoline poison detonation burns targets");
  assert.ok(s.puddles.every((p) => p.kind === SURFACE_KINDS.FIRE_PATCH), "poison pools transform into lingering FIRE_PATCH");

  // 2) FIRE_PATCH + WIND fans a new forward FIRE_PATCH along wind heading!
  const beforeCount = s.puddles.length;
  sim.internals.triggerSurfaceReactionAt(690, 480, "WIND", "relayGust", "player", 0);
  const evWind = sim.drainEvents();
  assert.ok(evWind.some((e) => e.type === "SURFACE_REACT" && e.kind === "FIRE_FAN"), "wind fans fire patch");
  assert.ok(s.puddles.length > beforeCount, "wind spawns forward FIRE_PATCH along wind heading");

  // 3) WATER_PUDDLE + ICE -> WATER_FREEZE transforms to ICE_PATCH & flash-freezes rival inside!
  s.puddles.length = 0;
  rival.root = 0; rival.ccImmune = 0;
  sim.internals.spawnSurfacePatch({ kind: SURFACE_KINDS.WATER_PUDDLE, x: rival.x, y: rival.y, radius: 80, ttl: 8, team: "player" });
  sim.drainEvents();
  sim.internals.triggerSurfaceReactionAt(rival.x, rival.y, "ICE", "iceShard", "player", 0);
  const evFreeze = sim.drainEvents();
  assert.ok(evFreeze.some((e) => e.type === "SURFACE_REACT" && e.kind === "WATER_FREEZE"), "ice freezes water puddle");
  assert.equal(s.puddles[0].kind, SURFACE_KINDS.ICE_PATCH, "water puddle becomes ICE_PATCH");
  assert.ok(rival.root > 0, "rival standing in water puddle is flash-frozen");

  // 4) ICE_PATCH + FIRE -> ICE_MELT turns back into WATER_PUDDLE, then + THUNDER -> WATER_ELECTRIFY!
  sim.internals.triggerSurfaceReactionAt(rival.x, rival.y, "FIRE", "emberBolt", "player", 0);
  assert.equal(s.puddles[0].kind, SURFACE_KINDS.WATER_PUDDLE, "fire melts ice patch back to WATER_PUDDLE");
  sim.internals.triggerSurfaceReactionAt(rival.x, rival.y, "THUNDER", "arcBolt", "player", 0);
  assert.equal(s.puddles[0].kind, SURFACE_KINDS.ELECTRIFIED_WATER, "thunder electrifies water puddle");
  assert.ok(rival.paralyze > 0, "rival standing in electrified water is paralyzed");
});

test("phase 6 / spell-to-spell vortex evolutions: Water Tornado + Ice Ray -> ICE_TORNADO freezing trapped foe", () => {
  const sim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  const rival = s.rivals[0];
  s.player.x = 540; s.player.y = 480;
  rival.x = 720; rival.y = 480;
  // Cast Water Vortex (`foamZone`) centered on rival
  s.player.kit = { ...s.player.kit, moves: ["foamZone", "iceShard", "emberBolt"] };
  s.player.energy = 100;
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  for (let i = 0; i < 35; i++) sim.step({});
  const vZone = s.zones.find((z) => z.vortexLift);
  assert.ok(vZone, "active 3D water vortex zone exists");

  // Shoot Ice Shard right into the Water Tornado -> evolves into ICE_TORNADO!
  sim.drainEvents();
  const tx = sim.internals.tryTransformVortexAt(vZone.x, vZone.y, "ICE", "iceShard", "player");
  const evs = sim.drainEvents();
  assert.equal(tx?.kind, "ICE_TORNADO", "water vortex + ice evolves into ICE_TORNADO");
  assert.equal(vZone.evolvedKind, "ICE_TORNADO");
  assert.equal(vZone.paletteKey, "ice");
  assert.ok(evs.some((e) => e.type === "ZONE_TRANSFORM" && e.kind === "ICE_TORNADO"), "emits ZONE_TRANSFORM");
  assert.ok(rival.root > 0, "ICE_TORNADO immediately freezes rival trapped inside");

  // Verify remaining 10-element vortex combos directly via pure rules
  assert.equal(resolveVortexTransform({ vortexLift: true, arenaElement: "wind" }, "FIRE")?.kind, "FIRE_TORNADO");
  assert.equal(resolveVortexTransform({ vortexLift: true, arenaElement: "water" }, "THUNDER")?.kind, "STORM_TORNADO");
  assert.equal(resolveVortexTransform({ vortexLift: true, arenaElement: "wind" }, "MOON")?.kind, "MOON_TORNADO");
  assert.equal(resolveVortexTransform({ vortexLift: true, canonicalElement: "MOON" }, "SUN")?.kind, "ECLIPSE_BURST");
  assert.equal(resolveVortexTransform({ vortexLift: true, canonicalElement: "ICE" }, "FIRE")?.kind, "STEAM_TORNADO");
});

test("phase 6 / directional destructible shield walls: melee 2.5x wall-breaker shatters wall into 6 directional shards hitting foe behind it", () => {
  const sim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL" });
  const s = sim.getState();
  const rival = s.rivals[0];
  s.player.x = 560; s.player.y = 480;
  // Spawn temporary ICE shield wall between player and rival
  const col = sim.grid.cellOf(650), row = sim.grid.cellOf(480);
  const prop = sim.grid.spawnTemporaryProp({ col, row, material: "ICE", hp: 90, ttl: 12, owner: rival.id, events: [] });
  assert.ok(prop, "temporary ICE shield wall spawned");
  const wallX = (prop.col + 0.5) * sim.grid.cell;
  const wallY = (prop.row + 0.5) * sim.grid.cell;
  rival.x = wallX + 120; rival.y = wallY;
  const rivalHpBefore = rival.hp;

  // Melee strike (40 base dmg * 2.5x melee wall-breaker = 100 >= 90 HP -> instant shatter!)
  sim.drainEvents();
  sim.internals.reactAndShatterWall(prop, 40, "METAL", "fangRush", "player", 0, { melee: true, cause: "LUNGE" });
  const evs = sim.drainEvents();
  assert.equal(prop.destroyed, true, "melee 2.5x wall-breaker shatters 90 HP wall in one blow");
  assert.ok(evs.some((e) => e.type === "WALL_SHATTER" && e.material === "ICE" && e.count === 6), "emits WALL_SHATTER with 6 shards");
  const shards = s.projectiles.filter((p) => p.isWallShard);
  assert.equal(shards.length, 6, "6 directional wall shard projectiles spawned");
  assert.ok(shards.every((sh) => sh.vx > 0), "all 6 shards fly forward along strikeAngle=0 toward enemy behind wall");

  // Step simulation so flying shards strike rival standing behind the shattered wall!
  for (let i = 0; i < 30; i++) sim.step({});
  assert.ok(rival.hp < rivalHpBefore, "directional wall shards hit and damage enemy behind the shattered wall");

  // Verify Metal/Ice + Thunder CONDUCT wall reaction paralyzes nearby rival!
  const prop2 = sim.grid.spawnTemporaryProp({ col, row, material: "METAL", hp: 160, ttl: 12, owner: rival.id, events: [] });
  rival.x = wallX + 96; rival.y = wallY;
  rival.paralyze = 0; rival.invulnerable = 0; rival.guardTimer = 0;
  sim.internals.reactAndShatterWall(prop2, 20, "THUNDER", "arcBolt", "player", 0, { melee: false });
  assert.ok(rival.paralyze > 0, "THUNDER hitting METAL shield wall conducts electricity & paralyzes nearby rival");
  assert.equal(resolveWallElementReaction({ material: "WOOD", destroyed: false }, "FIRE")?.kind, "WOOD_BURN");
  assert.equal(resolveWallElementReaction({ material: "ICE", destroyed: false }, "FIRE")?.kind, "ICE_MELT_STEAM");
  assert.equal(resolveWallElementReaction({ material: "BASALT", destroyed: false }, "WATER")?.kind, "QUENCH_BLAST");
  assert.equal(resolveWallElementReaction({ material: "STONE", destroyed: false }, "WOOD")?.kind, "ROOT_CRACK");
  assert.equal(buildWallShatterShards({ material: "WOOD" }, 0, "player", 30).shards.length, 6);
});

test("phase 6 / 6 ailments & tactical art responsiveness: SLEEP+WAKE_SLAP, PARALYZE twitch, POISON stacks, tactical buffer & TACTICAL_REFUSED", () => {
  const sim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL", tacticalArt: "rallyCry" });
  const s = sim.getState();
  const rival = s.rivals[0];
  s.player.x = 600; s.player.y = 480;
  rival.x = 700; rival.y = 480;

  // 1) SLEEP immobilizes rival; direct hit triggers 1.35x WAKE_SLAP & grants ccImmune
  rival.sleep = 2.4;
  sim.drainEvents();
  s.player.kit = { ...s.player.kit, moves: ["emberBolt", "iceShard", "tideBolt"] };
  s.player.energy = 100;
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  for (let i = 0; i < 35; i++) sim.step({});
  const wakeEvs = sim.drainEvents();
  assert.ok(wakeEvs.some((e) => e.type === "STATUS_REACT" && e.kind === "WAKE_SLAP"), "hitting sleeping foe triggers WAKE_SLAP");
  assert.equal(rival.sleep, 0, "sleeping foe wakes immediately upon taking damage");
  assert.ok(rival.ccImmune > 2.5, "anti-stunlock ccImmune granted after sleep ends");

  // 2) PARALYZE triggers periodic PARALYZE_TWITCH interrupting cast windup
  rival.paralyze = 3.0; rival.paralyzeTick = 0.05;
  for (let i = 0; i < 10; i++) sim.step({});
  assert.ok(sim.drainEvents().some((e) => e.type === "PARALYZE_TWITCH"), "paralyzed fighter twitches periodically");

  // 3) Tactical Art input buffering during recovery + TACTICAL_REFUSED on cooldown/energy/spent!
  s.player.energy = 100;
  s.player.tacticalCooldown = 0;
  s.player.recovery = 0.12;
  sim.step({ tactical: true });
  assert.ok(s.player.tacticalBuffer, "pressing tactical during recovery buffers the press instead of silently dropping it");
  for (let i = 0; i < 12; i++) sim.step({});
  assert.ok(sim.drainEvents().some((e) => e.type === "STAT_BUFF"), "buffered tactical art fires automatically once recovery ends");

  // Pressing again immediately while on cooldown emits TACTICAL_REFUSED (never fails silently!)
  sim.step({ tactical: true });
  assert.ok(sim.drainEvents().some((e) => e.type === "TACTICAL_REFUSED" && e.reason === "COOLDOWN"), "emits TACTICAL_REFUSED(COOLDOWN)");

  // Pressing with insufficient energy emits TACTICAL_REFUSED(ENERGY)
  s.player.tacticalCooldown = 0;
  s.player.energy = 0;
  sim.step({ tactical: true });
  assert.ok(sim.drainEvents().some((e) => e.type === "TACTICAL_REFUSED" && e.reason === "ENERGY"), "emits TACTICAL_REFUSED(ENERGY)");
});

test("phase 7 / remastered broadcast-grade battle & 666-move audio engine: mastering chain, FM, colored noise, 10 elements, stereo pan & turn-based playMove/playStatus", () => {
  let oscCount = 0, noiseCount = 0, compCount = 0, shaperCount = 0, panCount = 0, bufferCount = 0;
  const makeParam = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  let clock = 0;
  const mockContext = {
    sampleRate: 44100,
    state: "running",
    get currentTime() { return clock; },
    createGain() { return { gain: makeParam(), connect() {}, disconnect() {} }; },
    createBiquadFilter() { return { type: "bandpass", frequency: makeParam(), Q: makeParam(), gain: makeParam(), connect() {}, disconnect() {} }; },
    createDynamicsCompressor() { compCount++; return { threshold: makeParam(), knee: makeParam(), ratio: makeParam(), attack: makeParam(), release: makeParam(), connect() {}, disconnect() {} }; },
    createWaveShaper() { shaperCount++; return { curve: null, oversample: "none", connect() {}, disconnect() {} }; },
    createStereoPanner() { panCount++; return { pan: makeParam(), connect() {}, disconnect() {} }; },
    createOscillator() { oscCount++; return { type: "sine", frequency: makeParam(), connect() {}, start() {}, stop() {} }; },
    createBuffer(ch, len) { bufferCount++; return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource() { noiseCount++; return { buffer: null, playbackRate: makeParam(), connect() {}, start() {}, stop() {} }; }
  };

  // Verify deterministic pitch rate & canonical 10-element mapping
  assert.ok(movePitchRate("emberBolt") >= 0.95 && movePitchRate("emberBolt") <= 1.05);
  assert.equal(movePitchRate("own-440"), movePitchRate("own-440"));
  assert.equal(canonicalAudioElement("frost", "iceShard"), "ICE");
  assert.equal(canonicalAudioElement("shadow", "shadeStep"), "MOON");

  const engine = createCombatMoveAudioEngine({ getOutput: () => ({ context: mockContext, destination: {} }), now: () => clock * 1000 });
  clock += 0.2;
  assert.equal(engine.playWindup({ archetype: "STREAM_BEAM", element: "FIRE", moveId: "own-440", pan: -0.3 }), true);
  assert.equal(compCount, 2, "dual-stage mastering compressor + brickwall limiter mounted");
  assert.equal(shaperCount, 1, "warm soft-clip waveshaper mounted");
  assert.equal(bufferCount, 4, "4 pre-baked deterministic noise banks (white/pink/brown/crackle)");
  assert.ok(panCount >= 1, "stereo panner engaged for spatialized moves");

  for (const el of CANONICAL_TEN_ELEMENTS) {
    clock += 0.25;
    assert.equal(engine.playMove({ archetype: "HOMING_ORB", element: el, moveId: `test-${el}`, pan: 0.25 }), true, `10-element timbre ${el} plays cleanly`);
  }
  clock += 0.25;
  assert.equal(engine.playImpact({ amount: 38, critical: true, effectiveness: "super", element: "THUNDER", moveId: "arcBolt", pan: -0.2 }), true);
  assert.ok(engine.getDiagnostics().windupsPlayed >= 1);
  assert.ok(engine.getDiagnostics().movesPlayed >= 10);
  assert.ok(engine.getDiagnostics().impactsPlayed >= 1);
  assert.ok(oscCount >= 20 && noiseCount >= 10, `FM + colored noise synthesis active (osc=${oscCount}, noise=${noiseCount})`);
  engine.dispose();

  // Verify Turn-Based Battle impactAudio now plays all 666 moves & 6 statuses cleanly!
  let wallMs = 5000;
  const turnAudio = createBattleImpactAudio({ getOutput: () => ({ context: mockContext, destination: {} }), now: () => wallMs });
  assert.equal(turnAudio.playMove({ moveId: 112, element: "WATER", pan: -0.22 }), true, "turn-based battle plays per-move elemental sound");
  wallMs += 200;
  assert.equal(turnAudio.playHit({ tier: "heavy", critical: true, combo: 3, element: "ICE", moveId: 112, pan: 0.22 }), true);
  wallMs += 250;
  assert.equal(turnAudio.playStatus({ status: "SLEEP", pan: 0.2 }), true);
  wallMs += 250;
  assert.equal(turnAudio.playSupport("heal", { pan: -0.2 }), true);
  wallMs += 250;
  assert.equal(turnAudio.playKo({ pan: 0.2 }), true);
  assert.ok(turnAudio.getDiagnostics().played >= 5);
  turnAudio.dispose();
});

test("phase 8 / PbRank overhaul (Batch A+B+C): decluttered lobby/HUD, native skill absorption, 3-tier AI, bench cleanse, energy orbs & directional hit-feel", () => {
  // Batch A: Lobby & HUD declutter verification
  const screenSrc = readFileSync(new URL("../src/championship/app/dataArenaScreen.js", import.meta.url), "utf8");
  const cssSrc = readFileSync(new URL("../src/championship/app/dataArena.css", import.meta.url), "utf8");
  assert.ok(screenSrc.includes('t("ai.diff.heading")'), "lobby renders clean single-row AI difficulty selector");
  assert.ok(!screenSrc.includes('t("v2.system.heading")'), "lobby removed developer V2/legacy toggle");
  assert.ok(!screenSrc.includes('t("tactical.heading")'), "lobby removed cluttered 8-pill Tactical Art bar");
  assert.ok(!screenSrc.includes('t("ai.settings.heading")'), "lobby removed granular AI developer toggle bar");
  assert.ok(cssSrc.includes(".da-tbtn--tactical,\n.da-chip--tactical { display: none !important; }"), "redundant tactical button hidden in CSS");

  // Batch A: Native skill absorption (GROUND_SPIKES lays entry hazards, weather moves shift weather)
  const absSim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL" });
  const ast = absSim.getState();
  ast.player.kit = { ...ast.player.kit, moves: ["shardVolley", "flameRing", "emberBolt"] };
  ast.player.energy = 100;
  absSim.step({ cast: 0, aimX: ast.rivals[0].x, aimY: ast.rivals[0].y });
  for (let i = 0; i < 25; i++) absSim.step({});
  assert.ok(absSim.getSnapshot().hazards.rival >= 1, "GROUND_SPIKES move natively lays enemy entry hazard");

  ast.player.energy = 100; ast.player.recovery = 0;
  absSim.step({ cast: 1, aimX: ast.rivals[0].x, aimY: ast.rivals[0].y });
  for (let i = 0; i < 25; i++) absSim.step({});
  assert.ok(Boolean(absSim.getSnapshot().weather.kind), "weather move natively activates arena weather");

  // Batch B: PbRank 3-tier AI primitives (intercept dodge, corner-waypoint pathing, spacing)
  assert.equal(Object.keys(AI_DIFFICULTIES).length, 3);
  assert.ok(AI_DIFFICULTIES.hard.lead > AI_DIFFICULTIES.normal.lead && AI_DIFFICULTIES.normal.lead > AI_DIFFICULTIES.easy.lead);
  const incoming = pbRankInterceptDodge({
    body: { x: 500, y: 400, radius: 20 },
    hostileOwner: "player",
    projectiles: [{ id: 1, dead: false, owner: "player", x: 380, y: 400, vx: 500, vy: 0, radius: 12 }],
    dangerRadius: 180
  });
  assert.ok(incoming && incoming.t > 0 && incoming.t < 0.6, "pbRankInterceptDodge detects incoming linear shot");
  const receding = pbRankInterceptDodge({
    body: { x: 500, y: 400, radius: 20 },
    hostileOwner: "player",
    projectiles: [{ id: 2, dead: false, owner: "player", x: 380, y: 400, vx: -500, vy: 0, radius: 12 }],
    dangerRadius: 180
  });
  assert.equal(receding, null, "pbRankInterceptDodge ignores receding shots");

  const corner = pbRankCornerWaypoint({
    body: { x: 200, y: 200 },
    target: { x: 500, y: 200 },
    props: [{ col: 6, row: 3, width: 2, height: 2, destroyed: false }],
    cell: 48,
    pad: 45,
    blocked: () => false,
    hasSight: (x0, y0, x1, y1) => !(Math.abs(y0 - 200) < 20 && Math.abs(y1 - 200) < 20 && x0 < 300 && x1 > 400)
  });
  assert.ok(corner && Math.abs(corner.y - 200) > 20, "pbRankCornerWaypoint routes around cover prop corners");

  const spFar = pbRankSpacingVector({ body: { x: 0, y: 0 }, target: { x: 500, y: 0 }, idealDist: 280, strafeDir: 1, strafeWeight: 0.34 });
  assert.ok(spFar.x > 0.7, "pbRankSpacingVector advances when beyond ideal range");
  const spClose = pbRankSpacingVector({ body: { x: 0, y: 0 }, target: { x: 100, y: 0 }, idealDist: 280, strafeDir: 1, strafeWeight: 0.34 });
  assert.ok(spClose.x < -0.7, "pbRankSpacingVector backs off when inside 0.65x ideal range");

  // Batch B: Bench 6s cleanse + periodic Energy Orb pickup + aiDifficulty config
  const pbSim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL", aiDifficulty: "hard" });
  assert.equal(pbSim.getSnapshot().aiDifficulty, "hard");
  const pst = pbSim.getState();
  pst.relay.team[1].burn = 5;
  pst.relay.team[1].poison = 5;
  pst.relay.team[1].benchTime = 5.95;
  for (let i = 0; i < 6; i++) pbSim.step({});
  assert.equal(pst.relay.team[1].burn, 0, "6s bench cleanse purifies burn off-field");
  assert.equal(pst.relay.team[1].poison, 0, "6s bench cleanse purifies poison off-field");

  pst.player.energy = 40;
  pst.player.cooldowns[pst.player.kit.moves[0]] = 4.0;
  pst.energyOrbs.push({ id: 999, x: pst.player.x + 8, y: pst.player.y, bornAt: pst.time });
  pbSim.step({});
  const orbEvs = pbSim.drainEvents();
  assert.ok(orbEvs.some((e) => e.type === "ENERGY_ORB_PICKUP" && e.side === "player"), "stepping on Arena Energy Orb triggers ENERGY_ORB_PICKUP");
  assert.ok(pst.player.energy >= 68, "Energy Orb restores +28 TP");
  assert.ok(pst.player.cooldowns[pst.player.kit.moves[0]] <= 2.6, "Energy Orb trims active move cooldowns by 1.5s");

  // Batch C: Directional hurtTimer (0.23s) + PbRank hitstun + Manual Parry +18 TP reward
  pbSim.internals.hurtPlayer(24, "RBOLT", pst.player.x + 120, pst.player.y);
  assert.ok(pst.player.hurtTimer > 0.2, "unguarded hit sets 230ms directional hurtTimer");
  assert.ok(pst.player.hitDirX < -0.9, "hitDir points away from attacker");
  assert.ok(pst.player.hitstun >= 0.12 && pst.player.hitstun <= 0.20, "PbRank hitstun clamped in [0.12, 0.20]s");
});

test("phase 9 / Plan A single PB-Rank manual battle mode: unified RELAY entry, hidden legacy mode bar, 1-tap Manual/Auto toggle, crisp 0.26s dodge & rapid TP flow", () => {
  // 1) Default records & copy converge cleanly to ONE unified PB-Rank 3v3 real-time arena
  assert.equal(defaultDataArenaRecords().lastMode, "RELAY", "default Data Arena mode is unified RELAY");
  assert.ok(!DATA_ARENA_TEXT["zh-Hant"]["entry.description"].includes("數據錦標賽"), "ZH entry description advertises single 3v3 real-time arena");
  assert.ok(!DATA_ARENA_TEXT.en["entry.description"].includes("Tournament / Harbor"), "EN entry description advertises single 3v3 real-time arena");

  // 2) dataArenaScreen.js locks default player entry to RELAY, hides legacy mode cartridges, uses 1-tap MANUAL/AUTO toggle, and skips repeat briefing
  const screenSrc = readFileSync(new URL("../src/championship/app/dataArenaScreen.js", import.meta.url), "utf8");
  const cssSrc = readFileSync(new URL("../src/championship/app/dataArena.css", import.meta.url), "utf8");
  assert.ok(screenSrc.includes('let gameMode = campaign ? "RELAY" : (urlMode ?? "RELAY");'), "player manual battle always enters unified RELAY unless ?mode= override");
  assert.ok(screenSrc.includes("if (campaign || !urlMode) modes.hidden = true;"), "legacy 4-mode cartridge bar hidden in single-mode lobby");
  assert.ok(screenSrc.includes('controlModePref = current === "MANUAL" ? "AUTO" : "MANUAL";'), "in-battle control toggle is 1-tap MANUAL/AUTO");
  assert.ok(screenSrc.includes("if (records.get().briefingSeen) void startMatch();"), "repeat runs jump straight into combat without modal friction");
  assert.ok(cssSrc.includes(".da-modes[hidden] { display: none !important; }"), "hidden mode bar takes zero layout space");

  // 3) Unified RELAY V2 combat rhythm: 0.26s PB-Rank dodge invulnerability + rapid 0.20s-delay 26 TP/s recovery
  const sim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL" });
  const st = sim.getState();
  sim.step({ dash: true, moveX: 1, moveY: 0 });
  assert.ok(Math.abs(st.player.dashGrace - 0.26) < 0.02, "RELAY V2 dodge grants PB-Rank 0.26 s invulnerability");
  assert.ok(Math.abs(st.player.dashTimer - 0.20) < 0.02, "RELAY V2 dodge runs 0.20 s crisp evasive roll");
  for (let i = 0; i < 15; i++) sim.step({});

  st.player.energy = 30;
  st.player.energySpentAt = st.time;
  for (let i = 0; i < 60; i++) sim.step({}); // 1.0 s total: 0.20 s delay + 0.80 s * 26 TP/s = +20.8 TP
  assert.ok(st.player.energy >= 49, `RELAY V2 rapid TP regen prevents mana drought (got ${st.player.energy.toFixed(1)})`);
});

test("phase 10 / 00GameDevs MIT 3D->PixelFX Batch 1 + 2 + 3 (FINAL): all 78 baked sheets load, carry verbatim MIT notices, map all 20 V2 archetypes & 10 elements & play cleanly", async () => {
  const spritesSrc1 = readFileSync(new URL("../src/championship/presentation/vfx/moveVfx00GameDevsSprites.js", import.meta.url), "utf8");
  const spritesSrc2 = readFileSync(new URL("../src/championship/presentation/vfx/moveVfx00GameDevsBatch2Sprites.js", import.meta.url), "utf8");
  const spritesSrc3 = readFileSync(new URL("../src/championship/presentation/vfx/moveVfx00GameDevsBatch3Sprites.js", import.meta.url), "utf8");
  assert.ok(spritesSrc1.includes("The MIT License") && spritesSrc1.includes("00GameDevs (@00vchannel)"), "Batch 1 verbatim MIT notice preserved");
  assert.ok(spritesSrc2.includes("The MIT License") && spritesSrc2.includes("00GameDevs (@00vchannel)"), "Batch 2 verbatim MIT notice preserved");
  assert.ok(spritesSrc3.includes("The MIT License") && spritesSrc3.includes("00GameDevs (@00vchannel)"), "Batch 3 verbatim MIT notice preserved");
  const loaded = await loadMoveVfx00GameDevsSprites();
  assert.ok(loaded, "lazy 00GameDevs PixelFX Batch 1 + 2 + 3 sprite modules load cleanly");
  assert.equal(MOVE_VFX_00GAMEDEVS_KEYS.length, 78, "Batch 1 + 2 + 3 register all 78 combat move & telegraph animations");
  for (const key of MOVE_VFX_00GAMEDEVS_KEYS) {
    const entry = loaded[key];
    assert.ok(entry && entry.w > 16 && entry.h >= 14, `${key} has valid dimensions`);
    assert.ok(Array.isArray(entry.frames) && entry.frames.length >= 8, `${key} has >= 8 baked frames`);
    assert.ok(Array.isArray(entry.glow) && entry.glow.length === entry.frames.length, `${key} has matching half-res additive glow`);
    assert.ok(Array.isArray(entry.palette) && entry.palette.length >= 2, `${key} has valid quantised palette`);
  }
  // Every single V2 archetype across all 10 canonical elements resolves to an upgraded gd-* hero piece!
  for (const arch of V2_ARCHETYPES) {
    for (const pal of ["fire", "ice", "thunder", "dark", "nature", "earth", "light", "metal", "water", "wind"]) {
      const resolved = resolve00GameDevsPiece({ archetype: arch, paletteKey: pal, tier: "ultimate" });
      assert.ok(typeof resolved === "string" && resolved.startsWith("gd-") && loaded[resolved], `V2 ${arch}/${pal} upgrades to baked ${resolved}`);
    }
  }
  // Spot-check Batch 2 & Batch 3 elemental routing distinctions (projectiles, beams, shields, portals, telegraphs, smoke)
  assert.equal(resolve00GameDevsPiece({ archetype: "METEOR_RAIN", paletteKey: "fire", tier: "ultimate" }), "gd-hellfire-pillar");
  assert.equal(resolve00GameDevsPiece({ archetype: "METEOR_RAIN", paletteKey: "light", tier: "ultimate" }), "gd-sacred-relic");
  assert.equal(resolve00GameDevsPiece({ archetype: "METEOR_RAIN", paletteKey: "metal", tier: "standard" }), "gd-golden-chain-rain");
  assert.equal(resolve00GameDevsPiece({ archetype: "HOMING_ORB", paletteKey: "thunder" }), "gd-plasma-bolt");
  assert.equal(resolve00GameDevsPiece({ archetype: "HOMING_ORB", paletteKey: "ice" }), "gd-ice-shard");
  assert.equal(resolve00GameDevsPiece({ archetype: "HOMING_ORB", paletteKey: "light" }), "gd-arcane-missile");
  assert.equal(resolve00GameDevsPiece({ archetype: "STREAM_BEAM", paletteKey: "thunder", tier: "standard" }), "gd-sustained-arc");
  assert.equal(resolve00GameDevsPiece({ archetype: "STREAM_BEAM", paletteKey: "water", tier: "standard" }), "gd-steam-jet");
  assert.equal(resolve00GameDevsPiece({ archetype: "SHADOW_BACKSTAB", paletteKey: "light" }), "gd-astral-gate");
  assert.equal(resolve00GameDevsPiece({ archetype: "SELF_BUFF", piece: "buff-def", paletteKey: "ice" }), "gd-ice-shield");
  assert.equal(resolve00GameDevsPiece({ archetype: "SELF_BUFF", piece: "buff-def", paletteKey: "fire" }), "gd-flame-shield");
  assert.equal(resolve00GameDevsPiece({ archetype: "SELF_BUFF", piece: "buff-def", paletteKey: "metal" }), "gd-aegis-weave");
  assert.equal(resolve00GameDevsPiece({ archetype: "SELF_BUFF", piece: "buff-def", paletteKey: "dark" }), "gd-magic-barrier");
  assert.equal(resolve00GameDevsPiece({ piece: "sigil-cast", paletteKey: "fire" }), "gd-telegraph-circle");
  assert.equal(resolve00GameDevsPiece({ piece: "mark-sector", paletteKey: "fire" }), "gd-telegraph-sector");
  assert.equal(resolve00GameDevsPiece({ piece: "mark-rect", paletteKey: "fire" }), "gd-telegraph-rect");
  assert.equal(resolve00GameDevsPiece({ piece: "ring-pop", paletteKey: "thunder" }), "gd-comic-ink-arcs");
  // Mock Pixi playback smoke test across all 78 pieces (recolored dynamically!)
  class MockNode { constructor() { this.children = []; this.scale = { set() {} }; this.anchor = { set() {} }; this.position = { set() {} }; } addChild(c) { c.parent = this; this.children.push(c); } removeChild(c) { this.children = this.children.filter((x) => x !== c); } destroy() {} }
  const MockPIXI = {
    Container: MockNode,
    Sprite: MockNode,
    Rectangle: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
    Texture: class { static from() { return { source: { scaleMode: "nearest" }, destroy() {} }; } destroy() {} }
  };
  const mockDoc = {
    createElement() {
      return {
        width: 0, height: 0,
        getContext() {
          return {
            createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData() {}
          };
        }
      };
    }
  };
  const pieces = createMoveVfxSetPieces({ PIXI: MockPIXI, layer: new MockNode(), doc: mockDoc });
  for (const key of MOVE_VFX_00GAMEDEVS_KEYS) {
    assert.equal(pieces.play(key, { x: 100, y: 120, angle: 0.4, palette: { core: 0xffe8a3, main: 0xff6b2b, edge: 0x5c180a }, size: 80 }), true, `${key} plays cleanly in setPieces`);
  }
  pieces.update(50);
  pieces.dispose();
});

test("phase 11 / 666-move clean single-layer PixelFX + 00GameDevs audit: zero legacy stacking, zero 3d-* fallback leaks & zero procedural 3D canvas hacks", async () => {
  const { MOVE_VFX_CHOREOGRAPHY } = await import("../src/championship/presentation/vfx/moveVfxChoreography.js");
  const { moveVfxSignature } = await import("../src/championship/presentation/vfx/moveVfxSignatures.js");
  const loaded00 = await loadMoveVfx00GameDevsSprites();
  const validPixelFx = new Set([...MOVE_VFX_SET_PIECES, ...MOVE_VFX_SUPPORT_PIECES, ...Object.keys(MOVE_VFX_PIECE_SPRITES)]);

  // 1) All 71 legacy 3d-* keys map cleanly to loaded 00GameDevs gd-* sheets
  assert.ok(Object.keys(LEGACY_3D_TO_00GD).length >= 71, "all 71 legacy 3d-* keys mapped to 00GameDevs gd-*");
  for (const [old3d, gdKey] of Object.entries(LEGACY_3D_TO_00GD)) {
    assert.ok(loaded00[gdKey], `${old3d} -> ${gdKey} is loaded`);
    assert.equal(resolve00GameDevsPiece({ piece: old3d }), gdKey, `resolve00GameDevsPiece upgrades ${old3d} -> ${gdKey}`);
  }

  // 2) All 638 Turn-Based Auto Battle moves resolve 100% to 00GameDevs gd-* or pure PixelFX (ZERO leftover 3d-*!)
  for (const [k, c] of Object.entries(MOVE_VFX_CHOREOGRAPHY)) {
    const key = /^\d+$/.test(k) ? Number(k) : k;
    const sig = moveVfxSignature(key);
    const resolved = resolve00GameDevsPiece({ piece: c.contact.piece, paletteKey: sig?.paletteKey ?? "fire", tier: sig?.tier ?? "standard" });
    assert.ok(!resolved.startsWith("3d-"), `Auto move ${k} has zero 3d-* fallback (got ${resolved})`);
    assert.ok(Boolean(loaded00[resolved]) || validPixelFx.has(resolved), `Auto move ${k} resolves to pure PixelFX/00GD (${resolved})`);
  }

  // 3) All 641+ Manual 3v3 PB-Rank moves resolve cleanly to 00GameDevs + PixelFX projectiles & impacts
  const allIds = [...Object.keys(RELAY_POOL_MOVE_ELEMENT)];
  for (let i = 31; i <= 622; i++) allIds.push(`own-${i}`);
  for (const id of allIds) {
    const spec = resolveMoveSpecV2(id);
    const hero = resolve00GameDevsPiece({ archetype: spec.v2Archetype, piece: spec.contactLook, paletteKey: spec.paletteKey, tier: spec.tier });
    assert.ok(hero && loaded00[hero], `Manual V2 move ${id} resolves to baked 00GameDevs ${hero}`);
    const proj = resolve00GameDevsProjectile({ archetype: spec.v2Archetype, paletteKey: spec.paletteKey, tier: spec.tier });
    assert.ok((proj && loaded00[proj]) || Boolean(MOVE_VFX_PIECE_SPRITES[spec.flightLook]), `Manual V2 move ${id} has pure PixelFX/00GD projectile`);
  }
  // Semantic checks fixed during 666-move audit
  assert.equal(resolveMoveSpecV2("own-341").v2Archetype, "METEOR_RAIN", "廢都毒雨 -> METEOR_RAIN");
  assert.equal(resolveMoveSpecV2("own-352").v2Archetype, "METEOR_RAIN", "潮鑄落雷 -> METEOR_RAIN");

  // 4) Zero old+new stacking in battleFxLayer & zero procedural volCache canvas spawns in dataArenaPixelFxV2
  const battleSrc = readFileSync(new URL("../src/championship/presentation/battleFx/battleFxLayer.js", import.meta.url), "utf8");
  const v2Src = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixelFxV2.js", import.meta.url), "utf8");
  const sceneSrc = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixiScene.js", import.meta.url), "utf8");
  assert.ok(battleSrc.includes("if (vfx && !hasOwnContact)"), "Auto Battle suppresses legacy ROM cells when clean PixelFX/00GD contact plays");
  assert.ok(battleSrc.includes("if (kit && signature && !hasOwnContact)"), "Auto Battle suppresses legacy kit.burst when clean PixelFX/00GD contact plays");
  assert.ok(battleSrc.includes("if (!hasOwnContact && (tier !== 'light'"), "Auto Battle suppresses duplicate pixelHits explosion when clean PixelFX/00GD contact plays");
  assert.ok(!v2Src.includes("volCache.spawn("), "Manual 3v3 Data Arena has ZERO procedural 3D canvas volCache spawns");
  assert.ok(sceneSrc.includes('case "BARRIER_UP":\n          if (purePixelFx)'), "Data Arena BARRIER_UP plays clean 00GameDevs shield instead of legacy ring");
});

test("phase 12 / Combat Wave 1: 666-move calibrated ranges/windups, 8px anti-tunneling sub-stepping, baked CAST_TELEGRAPH indicators & 0.35s DEPLOY_SHIELD", async () => {
  await loadMoveVfx00GameDevsSprites();
  // 1) All 20 V2 archetypes & all 641+ moves expose calibrated range, windup, recovery, radius & telegraphShape
  for (const arch of V2_ARCHETYPES) {
    const t = V2_ARCHETYPE_COMBAT_TUNING[arch];
    assert.ok(t && t.windup >= 0.08 && t.recovery >= 0.14, `${arch} has calibrated windup/recovery`);
    assert.ok(["circle", "sector", "rect", "none"].includes(t.telegraphShape), `${arch} has valid telegraphShape`);
  }
  const beamSpec = resolveMoveSpecV2("sunSpear");
  const flurrySpec = resolveMoveSpecV2("fangRush");
  const ultSpec = resolveMoveSpecV2("coreNova");
  assert.ok(beamSpec.combatRange >= 750 && flurrySpec.combatRange <= 200, "STREAM_BEAM strictly outranges close-range FLURRY_COMBO");
  assert.equal(beamSpec.telegraphShape, "rect", "STREAM_BEAM uses rect lane telegraph");
  assert.equal(ultSpec.telegraphShape, "circle", "METEOR_RAIN ultimate uses circle AoE telegraph");
  assert.ok(ultSpec.combatRadius > V2_ARCHETYPE_COMBAT_TUNING.METEOR_RAIN.radius, "ultimate scales AoE radius above standard");

  const allIds = [...Object.keys(RELAY_POOL_MOVE_ELEMENT)];
  for (let i = 31; i <= 622; i++) allIds.push(`own-${i}`);
  for (const id of allIds) {
    const s = resolveMoveSpecV2(id);
    assert.ok(s.combatWindup >= 0.08 && s.combatWindup <= 0.45, `${id} windup in crisp playable bounds (${s.combatWindup})`);
    assert.ok(s.combatRecovery >= 0.12 && s.combatRecovery <= 0.45, `${id} recovery in crisp playable bounds (${s.combatRecovery})`);
    assert.ok(["circle", "sector", "rect", "none"].includes(s.telegraphShape), `${id} valid telegraphShape`);
  }
  const calibrated = calibrateV2Move("sunSpear", { type: "BOLT", energy: 22, cooldown: 1.6, windup: 0.1, range: 300, speed: 600, radius: 12, damage: 30 });
  assert.ok(calibrated.range >= 750 && calibrated.speed >= 1100 && calibrated.telegraphShape === "rect", "calibrateV2Move applies STREAM_BEAM range/speed/telegraph");

  // 2) Deployment >= 0.35s spawn invulnerability shield on partner switch-in & KO replacement
  const sim = startRelayFight({ moveSystem: "v2", controlMode: "MANUAL" });
  const st = sim.getState();
  sim.step({ switchPartner: true });
  const swEvs = sim.drainEvents();
  const deployEv = swEvs.find((e) => e.type === "DEPLOY_SHIELD" && e.team === "player");
  assert.ok(deployEv && deployEv.duration >= 0.35, `partner switch-in emits DEPLOY_SHIELD >= 0.35s (got ${deployEv?.duration})`);
  assert.ok(st.player.invulnerable >= 0.32, `switched-in partner holds 0.35s spawn invulnerability after 1 tick (got ${st.player.invulnerable})`);
  const hpBefore = st.player.hp;
  sim.internals.hurtPlayer(30, "TEST", st.player.x, st.player.y);
  assert.equal(st.player.hp, hpBefore, "0.35s deployment invulnerability blocks frame-1 burst damage on tag-in");
  // Advance past spawn shield
  for (let i = 0; i < 40; i++) sim.step({});
  sim.drainEvents();

  // 3) Casting a calibrated beam/AoE move emits CAST_TELEGRAPH with shape/range/radius
  st.player.kit = { ...st.player.kit, moves: ["sunSpear", "flameRing", "fangRush"] };
  st.player.energy = 100;
  st.player.recovery = 0;
  const rival = st.rivals[0];
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  const castEvs = sim.drainEvents();
  const tele = castEvs.find((e) => e.type === "CAST_TELEGRAPH" && e.moveId === "sunSpear");
  assert.ok(tele && tele.shape === "rect" && tele.range >= 750, "sunSpear emits rect CAST_TELEGRAPH with calibrated range");

  // 4) 8px anti-tunneling sub-stepping: a 2400 px/s enemy beam (40 px/tick!) aimed straight at player through a 1-cell shield wall stops on the wall!
  st.player.x = 640; st.player.y = 480;
  rival.x = 960; rival.y = 480;
  st.player.cast = null; st.player.recovery = 0; st.player.energy = 100;
  st.player.kit = { ...st.player.kit, moves: ["glacierGuard", "sunSpear", "fangRush"] };
  sim.step({ cast: 0, aimX: rival.x, aimY: rival.y });
  for (let i = 0; i < 25; i++) sim.step({});
  const wallEv = sim.drainEvents().find((e) => e.type === "TEMP_PROP_SPAWN");
  assert.ok(wallEv, "glacierGuard spawns temporary shield wall");
  // Fire a 2400 px/s shot (40px per 1/60s tick) from the opposite side of the wall directly through the wall center toward player!
  sim.internals.spawnProjectile({
    owner: "rival", team: "rival", kind: "LASER", moveId: "sunSpear",
    x: wallEv.x + 120, y: wallEv.y, vx: -2400, vy: 0, radius: 10, damage: 20, range: 600, travelled: 0, hits: new Set()
  });
  let sawBlocked = false;
  for (let i = 0; i < 12; i++) {
    sim.step({});
    if (sim.drainEvents().some((e) => e.type === "SHOT_BLOCKED")) { sawBlocked = true; break; }
  }
  assert.ok(sawBlocked, "2400 px/s ultra-fast projectile stops on thin cover wall via 8px sub-stepping (zero tunneling)");
});

test("phase 13 / Combat Wave 2: 3v3 smart AI partner switching, AoE telegraph dodge, Guard-Break punish, off-screen ray arrow & 4s PixelFX battle scars", async () => {
  // 1) Smart 3v3 Partner Switch Evaluator
  const active = { hp: 55, maxHp: 200, burn: 0, poison: 0, paralyze: 0 };
  const bench = [
    active,
    { hp: 180, maxHp: 200, burn: 0, poison: 0, paralyze: 0 }, // neutral reserve
    { hp: 170, maxHp: 200, burn: 0, poison: 0, paralyze: 0 }  // counter-element reserve!
  ];
  assert.equal(evaluateSmartSwitch({ active, bench, activeIdx: 0, difficulty: "easy", roundTime: 20 }), -1, "Easy AI never aggressively tag-switches");
  const pickNormal = evaluateSmartSwitch({
    active, bench, activeIdx: 0, difficulty: "normal", roundTime: 15,
    incomingMultOf: (_c, i) => (i === 0 ? 1.5 : i === 2 ? 0.5 : 1.0),
    outgoingMultOf: (_c, i) => (i === 2 ? 1.5 : 1.0)
  });
  assert.equal(pickNormal, 2, "Normal/Hard AI tags in the counter-element healthy reserve (#2 over neutral #1)");

  const ailedActive = { hp: 100, maxHp: 200, burn: 3.0, poison: 0, paralyze: 0 };
  const pickCleanse = evaluateSmartSwitch({
    active: ailedActive, bench: [ailedActive, { hp: 190, maxHp: 200 }], activeIdx: 0,
    difficulty: "hard", roundTime: 8
  });
  assert.equal(pickCleanse, 1, "Hard AI tags out severely burned fighter for 6s bench cleanse");

  // 2) Proactive AoE & beam telegraph threat detection
  const circleThreat = detectIncomingThreat({
    body: { x: 400, y: 400, radius: 20 }, hostileOwner: "player", hostileTeam: "player",
    projectiles: [], zones: [],
    telegraphs: [{ owner: "cast:p", team: "player", moveId: "flameRing", kind: "CIRCLE", x: 420, y: 400, radius: 130, duration: 0.3, t: 0.05 }],
    threatSeen: new Set(), horizon: 0.45
  });
  assert.equal(circleThreat?.kind, "TELEGRAPH_CIRCLE", "AI proactively detects hostile AoE circle windup telegraph");
  const lineThreat = detectIncomingThreat({
    body: { x: 520, y: 405, radius: 20 }, hostileOwner: "player", hostileTeam: "player",
    projectiles: [], zones: [],
    telegraphs: [{ owner: "cast:p", team: "player", moveId: "sunSpear", kind: "LINE", x: 300, y: 400, angle: 0, length: 600, width: 32, duration: 0.28, t: 0.05 }],
    threatSeen: new Set(), horizon: 0.45
  });
  assert.equal(lineThreat?.kind, "TELEGRAPH_LINE", "AI proactively detects hostile beam lane windup telegraph");

  // 3) Guard-Break punish priority when foe is guarding
  const moveDefs = {
    jab: { type: "LUNGE", distance: 160, damage: 24, energy: 15 },
    breaker: { type: "LUNGE", distance: 170, damage: 24, energy: 20 }
  };
  const gbPick = pickUnifiedMove({
    body: { hp: 200, maxHp: 200, energy: 100 },
    foe: { hp: 200, maxHp: 200, guardTimer: 0.35, vx: 0, vy: 0 },
    dist: 120, canCast: () => true, moveFor: (id) => moveDefs[id],
    kitMoveIds: ["jab", "breaker"],
    moveArchetype: (id) => (id === "breaker" ? "GUARD_BREAK_SLAM" : "FLURRY_COMBO"),
    choiceNoise: 0, random: () => 0.5
  });
  assert.equal(gbPick?.id, "breaker", "AI prioritizes Guard-Break moves to shatter actively guarding foes");

  // 4) 4-second pure-PixelFX ground battle scars lifecycle & cap in dataArenaPixelFxV2
  const { loadMoveVfxPieceSprites } = await import("../src/championship/presentation/vfx/moveVfxSetPieces.js");
  await loadMoveVfxPieceSprites();
  class Node {
    constructor() { this.children = []; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { set() {} }; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); }
    destroy() { this.destroyed = true; }
  }
  const MockPIXI = {
    Container: Node,
    Sprite: class extends Node { constructor(t) { super(); this.texture = t; } },
    Rectangle: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
    Texture: class { static from() { return { width: 48, height: 48, source: { scaleMode: "nearest" }, destroy() {} }; } destroy() {} }
  };
  const origDoc = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} })
    })
  };
  try {
    const fx = createDataArenaPixelFxV2({ PIXI: MockPIXI, ground: new Node(), front: new Node(), quality: "high" });
    for (let i = 0; i < 60; i++) fx.area({ x: 100 + i * 5, y: 200, radius: 110, moveId: "quakeSlam" });
    assert.ok(fx.getDiagnostics().scars > 0 && fx.getDiagnostics().scars <= 48, `battle scars stamped & capped <= 48 (got ${fx.getDiagnostics().scars})`);
    for (let i = 0; i < 45; i++) fx.update(100); // 4.5s > 4.0s TTL
    assert.equal(fx.getDiagnostics().scars, 0, "battle scars fade out & dispose cleanly after 4.0s TTL");
    fx.dispose();
  } finally {
    globalThis.document = origDoc;
  }

  // 5) Off-screen directional ray-box indicator covers rivals & Energy Orbs
  const sceneSrc = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixiScene.js", import.meta.url), "utf8");
  assert.ok(sceneSrc.includes("for (const orb of state.energyOrbs ?? []) pointTo("), "off-screen HUD indicator arrow tracks Energy Orbs alongside active rivals");
});

test("phase 14 / Combat Wave 3: Living Arena 22s pure-PixelFX zone events, team-aware AI/AUTO contest & mobile touch layout presets", async () => {
  const { createRelayArenaEvents } = await import("../src/championship/modes/dataArena/dataArenaRelayArena.js");
  const { DATA_ARENA_TOUCH_LAYOUTS, sanitizeDataArenaRecords, createDataArenaRecordStore } = await import("../src/championship/modes/dataArena/dataArenaSave.js");
  const { arenaText } = await import("../src/championship/text/dataArenaText.js");
  const { loadMoveVfxPieceSprites } = await import("../src/championship/presentation/vfx/moveVfxSetPieces.js");
  await loadMoveVfxPieceSprites();
  await loadMoveVfx00GameDevsSprites();

  // 1) Team-aware zoneTargetFor(body, team) + Super Core priority for player AUTO/COMMANDER
  const events = [];
  const pBody = { x: 820, y: 610, hp: 120, maxHp: 200, energy: 40, cooldowns: {} };
  const rBody = { x: 820, y: 610, hp: 120, maxHp: 200, energy: 40, cooldowns: {} };
  const arena = createRelayArenaEvents({
    map: { battleFieldId: "field_bm06_01", cell: 32, cols: 50, rows: 38, arenaZones: [[25, 19], [26, 20]] },
    grid: { props: [] },
    emit: (e) => events.push(e),
    now: () => 0,
    bodies: () => [pBody, rBody],
    effects: { tpMax: 100, heal() {}, dashMissing: () => false, refillDash() {}, triLinkRush() {} }
  });
  // Activate 22s cycle (firstWarning=8, warning=2.5 -> active at 11.0s)
  arena.step(0.1, 11.0);
  const pTarget = arena.zoneTargetFor(pBody, 0);
  const rTarget = arena.zoneTargetFor(rBody, 1);
  assert.ok(pTarget && pTarget.kind === "RECHARGE", "team 0 (player AUTO) targets active RECHARGE zone");
  assert.ok(rTarget && rTarget.kind === "RECHARGE", "team 1 (rival) targets active RECHARGE zone");
  // Claim for rival only -> rival stops targeting it, player STILL targets it!
  arena.state.claimed[1] = true;
  assert.equal(arena.zoneTargetFor(rBody, 1), null, "rival stops targeting after claiming");
  assert.ok(arena.zoneTargetFor(pBody, 0), "player AUTO still targets unclaimed zone independently of rival");
  // Super Core spawns at t=60s -> player AUTO prioritizes SUPER_CORE
  arena.step(0.1, 61.0);
  const scTarget = arena.zoneTargetFor(pBody, 0);
  assert.equal(scTarget?.kind, "SUPER_CORE", "player AUTO prioritizes active SUPER_CORE objective");

  // 2) Pure baked PixelFX / 00GameDevs arenaZone bursts across all 7 zone types
  class Node {
    constructor() { this.children = []; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { set() {} }; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); }
    destroy() { this.destroyed = true; }
  }
  const MockPIXI = {
    Container: Node,
    Sprite: class extends Node { constructor(t) { super(); this.texture = t; } },
    Rectangle: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; } },
    Texture: class { static from() { return { width: 48, height: 48, source: { scaleMode: "nearest" }, destroy() {} }; } destroy() {} }
  };
  const origDoc = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} })
    })
  };
  try {
    const fx = createDataArenaPixelFxV2({ PIXI: MockPIXI, ground: new Node(), front: new Node(), quality: "high" });
    for (const kind of ["ECHO", "BLOOM", "VENT", "TIDE", "UPDRAFT", "RECHARGE", "SUPER_CORE"]) {
      for (const phase of ["WARNING", "ACTIVE", "CLAIM"]) {
        assert.doesNotThrow(() => fx.arenaZone({ x: 300, y: 300, kind, phase, radius: 72 }), `arenaZone(${kind}, ${phase}) renders cleanly`);
      }
    }
    fx.dispose();
  } finally {
    globalThis.document = origDoc;
  }

  // 3) Scene wiring: dual capture rings, numeric superCore.channel fix, arenaZone FX & off-screen arrows
  const sceneSrc = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixiScene.js", import.meta.url), "utf8");
  assert.ok(sceneSrc.includes('typeof sc.channel === "number" ? sc.channel'), "Super Core numeric channel progress arc bug fixed");
  assert.ok(sceneSrc.includes("elementFx.arenaZone?.("), "Living Arena zone events route through pure PixelFX arenaZone");
  assert.ok(sceneSrc.includes("if (arena?.superCore?.phase === \"ACTIVE\""), "off-screen directional arrow tracks active Super Core & Arena zones");

  // 4) Mobile touch layout presets persisted & sanitized cleanly
  assert.deepEqual([...DATA_ARENA_TOUCH_LAYOUTS], ["standard", "compact", "wide", "leftHand"], "all 4 touch layout presets exported");
  const badSan = sanitizeDataArenaRecords({ schemaVersion: 1, kind: "DATA_ARENA_RECORDS", settings: { touchLayout: "broken" } });
  assert.equal(badSan.settings.touchLayout, "standard", "invalid touchLayout sanitizes to standard");
  let savedJson = null;
  const store = createDataArenaRecordStore({
    port: { storageKey: "test", read: () => ({ text: savedJson, error: null }), write: (t) => { savedJson = t; return { ok: true, error: null }; } }
  });
  store.setSettings({ touchLayout: "leftHand" });
  assert.equal(store.get().settings.touchLayout, "leftHand", "touchLayout preset persists cleanly");
  for (const preset of DATA_ARENA_TOUCH_LAYOUTS) {
    assert.ok(arenaText(`pause.touchLayout.${preset}`).length > 0, `touchLayout.${preset} copy exists`);
  }
  const screenSrc = readFileSync(new URL("../src/championship/app/dataArenaScreen.js", import.meta.url), "utf8");
  const cssSrc = readFileSync(new URL("../src/championship/app/dataArena.css", import.meta.url), "utf8");
  assert.ok(screenSrc.includes('const isMove = touchLayout === "leftHand" ? !left : left;'), "leftHand preset mirrors floating move/aim sticks");
  assert.ok(screenSrc.includes('root.dataset.touchLayout = touchLayout;'), "screen applies data-touch-layout attribute");
  assert.ok(cssSrc.includes('[data-touch-layout="leftHand"]') && cssSrc.includes('[data-touch-layout="compact"]') && cssSrc.includes('[data-touch-layout="wide"]'), "CSS defines compact, wide, and leftHand touch layouts");
});

test("phase 15 / Combat Wave 4: STREAM_BEAM mouth/hand energy conduit in PixelFX V2, dramatic KO slow-mo finisher & zero-overlap wide/landscape-leftHand touch CSS", () => {
  const sceneSrc = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixiScene.js", import.meta.url), "utf8");
  const v2Src = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixelFxV2.js", import.meta.url), "utf8");
  const screenSrc = readFileSync(new URL("../src/championship/app/dataArenaScreen.js", import.meta.url), "utf8");
  const cssSrc = readFileSync(new URL("../src/championship/app/dataArena.css", import.meta.url), "utf8");

  // 1) STREAM_BEAM dynamic conduit owned cleanly by PixelFX V2 (0.65s, zero shadowBlur, capped at 8, disposed cleanly)
  assert.ok(sceneSrc.includes('look?.v2Archetype === "STREAM_BEAM"') && sceneSrc.includes("elementFx.beamStream({"), "scene delegates STREAM_BEAM conduit cleanly to PixelFX V2 kit");
  assert.ok(v2Src.includes("beamConduits.push(") && v2Src.includes("beamConduitGfx.clear()"), "PixelFX V2 renders beamConduits on GPU Graphics without shadowBlur");
  assert.ok(v2Src.includes("beamConduits.length = 0;"), "beamConduits clean up on PixelFX V2 dispose");

  // 2) Dramatic KO slow-mo finisher & time-scale integration
  assert.ok(sceneSrc.includes("koSlowMo = Math.max(koSlowMo, isFinalKo ? 0.44 : 0.22)"), "RIVAL_KO triggers dramatic slow-motion finisher");
  assert.ok(sceneSrc.includes("getTimeScale() { return koSlowMo > 0 ? koSlowMoScale : 1; }"), "scene exposes getTimeScale() for ticker slow-mo");
  assert.ok(screenSrc.includes("const timeScale = scene.getTimeScale?.() ?? 1;"), "dataArenaScreen applies scene timeScale during PLAY");

  // 3) Live-QA CSS fixes: narrow portrait wide preset + landscape leftHand specificity override
  assert.ok(cssSrc.includes('@media (max-width: 440px)') && cssSrc.includes('[data-touch-layout="wide"] .da-tbtn.da-tbtn--switch'), "narrow portrait wide preset prevents overlap with guard/dash");
  assert.ok(cssSrc.includes('.da-root.da-root[data-mode="RELAY"][data-touch-layout="leftHand"] .da-tbtn.da-tbtn--switch { left: auto; right: var(--da-control-right); bottom: calc(var(--da-control-bottom) + 122px); }'), "landscape leftHand mirrors reserve switch buttons cleanly to the right");
});

test("phase 16 / Combat Wave 5: PB-Rank Bronze->Champion ladder persistence & 10 Signature Passive Abilities in combat", async () => {
  const { DATA_ARENA_RANKS, pbRankForPoints, applyPbRankMatch, sanitizeDataArenaRecords, createDataArenaRecordStore } = await import("../src/championship/modes/dataArena/dataArenaSave.js");
  const { DATA_ARENA_ABILITIES, partnerAbilityFor } = await import("../src/championship/modes/dataArena/dataArenaRelay.js");
  const { RELAY_ROSTER } = await import("../src/championship/modes/dataArena/dataArenaRelayRoster.js");
  const { arenaText } = await import("../src/championship/text/dataArenaText.js");

  // 1) PB-Rank 6-tier ladder math, promotion, streak bonus & floor protection
  assert.equal(DATA_ARENA_RANKS.length, 6, "PB-Rank has 6 tiers (Bronze -> Champion)");
  assert.equal(pbRankForPoints(0).id, "BRONZE");
  assert.equal(pbRankForPoints(150).id, "SILVER");
  assert.equal(pbRankForPoints(350).id, "GOLD");
  assert.equal(pbRankForPoints(650).id, "PLATINUM");
  assert.equal(pbRankForPoints(1050).id, "MASTER");
  assert.equal(pbRankForPoints(1600).id, "CHAMPION");

  const promo = applyPbRankMatch({ rp: 130, peakRp: 130, streak: 1, bestStreak: 1 }, { won: true, fainted: 0 });
  assert.equal(promo.before.id, "BRONZE");
  assert.equal(promo.after.id, "SILVER");
  assert.equal(promo.promoted, true, "winning across 150 RP promotes Bronze -> Silver");
  assert.equal(promo.rpDelta, 35 + 16 + 12, "win RP includes streak + flawless bonus");

  const protectedLoss = applyPbRankMatch({ rp: 155, peakRp: 155, streak: 2, bestStreak: 2 }, { won: false });
  assert.equal(protectedLoss.after.rp, 150, "defeat protects Silver tier floor at 150 RP");
  assert.equal(protectedLoss.next.streak, 0, "defeat resets current streak while keeping bestStreak");

  // Persistence round-trip via recordResult
  let savedJson = null;
  const store = createDataArenaRecordStore({
    port: { storageKey: "test", read: () => ({ text: savedJson, error: null }), write: (t) => { savedJson = t; return { ok: true, error: null }; } }
  });
  const res = store.recordResult({ partnerId: "ember-lizard", mode: "RELAY", outcome: "VICTORY", score: 4200, timeSeconds: 48, relayFainted: 0 });
  assert.ok(res.rankUpdate && res.rankUpdate.rpDelta > 0 && store.get().rank.rp === res.rankUpdate.after.rp, "RELAY win persists RP update");
  const san = sanitizeDataArenaRecords(JSON.parse(savedJson));
  assert.equal(san.rank.rp, store.get().rank.rp, "rank survives sanitizeDataArenaRecords");

  // 2) Every partner in the entire RELAY roster maps to one of the 10 signature abilities with copy
  assert.equal(Object.keys(DATA_ARENA_ABILITIES).length, 10, "10 canonical passive abilities defined");
  for (const p of RELAY_ROSTER) {
    const ab = partnerAbilityFor(p);
    assert.ok(ab && DATA_ARENA_ABILITIES[ab.id], `${p.id} maps to valid passive ability (${ab?.id})`);
    assert.ok(arenaText(`ability.${ab.id}`).length > 0, `ability.${ab.id} copy exists`);
  }

  // 3) Live combat checks: STURDY survives lethal hit at 1 HP; REGENERATOR heals 18% on switch-out; INTIMIDATE lowers foe damage!
  const earthP = RELAY_ROSTER.find((p) => p.element === "earth");
  const natureP = RELAY_ROSTER.find((p) => p.element === "nature");
  const lightP = RELAY_ROSTER.find((p) => p.element === "light");
  assert.ok(earthP && natureP && lightP, "earth, nature, and light roster partners exist");

  const sim = startRelayFight({ partnerId: earthP.id, relayReserveId: natureP.id, relayThirdId: lightP.id, moveSystem: "v2", controlMode: "MANUAL" });
  const st = sim.getState();
  st.player.invulnerable = 0;
  st.player.hp = st.player.maxHp;
  sim.internals.hurtPlayer(9999, "TEST", st.player.x, st.player.y);
  const sturdyEv = sim.drainEvents().find((e) => e.type === "ABILITY_PROC" && e.abilityId === "STURDY");
  assert.ok(sturdyEv && st.player.hp === 1, `STURDY survives lethal hit from >50% HP at 1 HP (got hp=${st.player.hp})`);

  // Switch to nature partner -> hurt -> switch to light partner -> verify REGENERATOR healed outgoing nature partner AND INTIMIDATE debuffed rival!
  st.relay.switchCooldown = 0;
  sim.step({ switchPartner: 2 }); // 1-based -> slot 1 (natureP)
  sim.drainEvents();
  st.relay.switchCooldown = 0;
  st.player.invulnerable = 0;
  st.player.hp = Math.round(st.player.maxHp * 0.5);
  const hpBeforeRegen = st.player.hp;
  sim.step({ switchPartner: 3 }); // 1-based -> slot 2 (lightP)
  const swEvs = sim.drainEvents();
  assert.ok(swEvs.some((e) => e.type === "ABILITY_PROC" && e.abilityId === "REGENERATOR"), "outgoing nature partner triggers REGENERATOR +18% HP");
  assert.ok(swEvs.some((e) => e.type === "ABILITY_PROC" && e.abilityId === "INTIMIDATE"), "incoming light partner triggers INTIMIDATE on rival");
  const natureSlot = st.relay.team.find((m) => m.partnerId === natureP.id);
  assert.ok(natureSlot.hp > hpBeforeRegen, `REGENERATOR restored bench HP (${hpBeforeRegen} -> ${natureSlot.hp})`);
  assert.ok((st.rivals[0].intimidateTimer ?? 0) > 0, "INTIMIDATE applied 6s attack debuff to active rival");
});

test("phase 17 / Combat Wave 6: CPU vs CPU Spectator Mode (wide neutral camera, 1x/1.5x/2x bar, takeover, zero RP/reward impact)", async () => {
  const { createDataArenaCamera } = await import("../src/championship/presentation/dataArena/dataArenaCamera.js");
  const screenSrc = readFileSync(new URL("../src/championship/app/dataArenaScreen.js", import.meta.url), "utf8");
  const sceneSrc = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixiScene.js", import.meta.url), "utf8");
  const cssSrc = readFileSync(new URL("../src/championship/app/dataArena.css", import.meta.url), "utf8");

  // 1) Spectator camera frames neutrally between both fighters at a wider zoom than player-biased duel framing
  const viewport = { width: 1280, height: 720 };
  const target = { x: 420, y: 500 };
  const opponent = { x: 940, y: 500 };
  const camNormal = createDataArenaCamera({ worldWidth: 1600, worldHeight: 1100, reducedMotion: false });
  const camSpec = createDataArenaCamera({ worldWidth: 1600, worldHeight: 1100, reducedMotion: false });
  let vNorm = null, vSpec = null;
  for (let i = 0; i < 40; i++) {
    vNorm = camNormal.update({ dtMs: 33, viewport, target, opponent, spectator: false });
    vSpec = camSpec.update({ dtMs: 33, viewport, target, opponent, spectator: true });
  }
  assert.ok(vSpec.zoom < vNorm.zoom, `spectator camera zooms out wider (${vSpec.zoom.toFixed(3)} < ${vNorm.zoom.toFixed(3)})`);
  const exactMidX = (target.x + opponent.x) * 0.5;
  assert.ok(Math.abs(vSpec.centerX - exactMidX) < Math.abs(vNorm.centerX - exactMidX),
    `spectator camera centers closer to exact midpoint (${vSpec.centerX.toFixed(1)} vs normal ${vNorm.centerX.toFixed(1)}, mid=${exactMidX})`);

  // 2) Full 3v3 AI vs AI autonomous simulation runs smoothly with zero faults and active combat exchange
  const autoSim = startRelayFight({ moveSystem: "v2", controlMode: "AUTO", aiDifficulty: "hard" });
  const pStart = { x: autoSim.getState().player.x, y: autoSim.getState().player.y };
  let totalEvents = 0;
  for (let i = 0; i < 420; i++) {
    autoSim.step({});
    totalEvents += autoSim.drainEvents().length;
    if (autoSim.getState().mode === "ENDED") break;
  }
  const st = autoSim.getState();
  assert.ok(Number.isFinite(st.player.x) && Number.isFinite(st.player.y), "AI vs AI player coordinates stay finite");
  assert.ok(Math.hypot(st.player.x - pStart.x, st.player.y - pStart.y) > 25, "AI-controlled player side actively moves in Spectator mode");
  assert.ok(totalEvents > 0, "AI vs AI match generates active combat events");

  // 3) Screen, Scene, CSS & bilingual text contracts for Spectator mode
  assert.ok(sceneSrc.includes("setSpectator(enabled)") && sceneSrc.includes("spectator: spectatorCamera"), "scene exposes setSpectator camera wiring");
  assert.ok(screenSrc.includes('da-btn--spectate') && screenSrc.includes('da-spectator-bar'), "lobby spectate button and floating spectator pill bar exist");
  assert.ok(screenSrc.includes('root.appendChild(spectatorBar)'), "spectator bar mounts on root so partner-switch buildHud() never wipes it");
  assert.ok(screenSrc.includes('const skipScoring = fromReplay || wasSpectator;'), "spectator matches skip PB-Rank RP, ranch rewards & sponsor settlement");
  assert.ok(screenSrc.includes('!(typeof spectatorMode !== "undefined" && spectatorMode)'), "spectator matches never stake sponsor contracts");
  assert.ok(screenSrc.includes('[1, 1.5, 2]') && screenSrc.includes('spectator.takeover'), "spectator bar offers 1x/1.5x/2x speeds and live Take Over");
  assert.ok(cssSrc.includes('.da-root[data-spectator="1"] .da-touch') && cssSrc.includes('.da-spectator-bar .da-chip-btn'), "CSS hides manual touch/bottom HUD and sets high-contrast pill buttons in spectator mode");
  for (const key of ["select.spectate", "spectator.badge", "spectator.takeover", "spectator.exit", "spectator.resultTitle", "spectator.resultNote", "spectator.rematch", "spectator.takeoverCall"]) {
    assert.ok(DATA_ARENA_TEXT["zh-Hant"][key], `ZH copy has ${key}`);
    assert.ok(DATA_ARENA_TEXT.en[key], `EN copy has ${key}`);
  }
});

test("phase 18 / Combat Wave 8: All 324 PB-Rank moves across 10 Canonical Elements replace old 666 RELAY kits + procedural pixel-particle VFX & 8 Hit-Feel systems", async () => {
  const {
    PB324_ELEMENTS, PB324_ELEMENT_META, PB324_MOVES, PB324_BY_ID, PB324_BY_ELEMENT,
    isPb324MoveId, pb324Move, pb324ToRelayMove, pb324MoveName, pb324MoveDesc
  } = await import("../src/championship/modes/dataArena/dataArenaPb324Catalog.js");
  const { RELAY_LOADOUTS, relayKit, relayMove, relayMoveElement, relayEffectStyle } = await import("../src/championship/modes/dataArena/dataArenaRelay.js");
  const { RELAY_ROSTER } = await import("../src/championship/modes/dataArena/dataArenaRelayRoster.js");

  // 1) Exact 324 moves across 10 Canonical Elements (金木水火土日月雷冰風) with 324 unique ZH & EN names
  assert.equal(PB324_MOVES.length, 324, "exact 324 PB-Rank-modeled original moves exist");
  assert.deepEqual([...PB324_ELEMENTS], ["METAL", "WOOD", "EARTH", "WATER", "FIRE", "SUN", "ICE", "WIND", "THUNDER", "MOON"], "exact 10 canonical elements");
  const zhSet = new Set(PB324_MOVES.map((m) => m.nameZh));
  const enSet = new Set(PB324_MOVES.map((m) => m.nameEn));
  assert.equal(zhSet.size, 324, "all 324 ZH names are unique");
  assert.equal(enSet.size, 324, "all 324 EN names are unique");
  let sumEl = 0;
  for (const el of PB324_ELEMENTS) {
    const bucket = PB324_BY_ELEMENT[el];
    assert.ok(bucket.all.length >= 14, `${el} has rich move pool (${bucket.all.length})`);
    assert.ok(bucket.skills.length >= 12, `${el} has >=12 skills (${bucket.skills.length})`);
    assert.ok(bucket.ultimates.length >= 2, `${el} has >=2 ultimates (${bucket.ultimates.length})`);
    assert.ok(PB324_ELEMENT_META[el]?.zh && PB324_ELEMENT_META[el]?.en, `${el} metadata complete`);
    sumEl += bucket.all.length;
  }
  assert.equal(sumEl, 324, "10 elements partition all 324 moves with zero leaks");

  // 2) Every partner in RELAY_ROSTER + 3 pilots exclusively equips PB-324 moves (ZERO legacy own-* 666 moves!)
  const allPartnerIds = [...RELAY_ROSTER.map((p) => p.id), "ember-lizard", "corona-cub", "frost-drake"];
  const coveredMoveIds = new Set();
  for (const pid of allPartnerIds) {
    const pool = RELAY_LOADOUTS[pid];
    assert.ok(Array.isArray(pool) && pool.length >= 12, `${pid} has selectable PB-324 element pool (${pool?.length})`);
    for (const mid of pool) {
      assert.ok(isPb324MoveId(mid), `${pid} pool move ${mid} is a PB-324 ID (zero legacy own-* moves)`);
      coveredMoveIds.add(mid);
    }
    const kit = relayKit(pid);
    assert.equal(kit.moves.length, 3, `${pid} default kit has 3 skills`);
    for (const mid of kit.moves) assert.ok(isPb324MoveId(mid), `${pid} default move ${mid} is PB-324`);
    assert.ok(isPb324MoveId(kit.ultimate), `${pid} ultimate ${kit.ultimate} is PB-324`);
    coveredMoveIds.add(kit.ultimate);
    // Legacy save resilience: passing stale own-31 / emberBolt falls back cleanly to PB-324 kit
    const migrated = relayKit(pid, ["own-31", "emberBolt"]);
    assert.equal(migrated.moves.length, 3);
    assert.ok(migrated.moves.every(isPb324MoveId), `${pid} old save loadout migrates cleanly to PB-324`);
  }
  // Every single non-ultimate skill across all 10 elements is selectable in RELAY_LOADOUTS!
  const allSkillCount = PB324_MOVES.filter((m) => !m.ultimate).length;
  const coveredSkills = [...coveredMoveIds].filter((id) => !PB324_BY_ID[id].ultimate).length;
  assert.equal(coveredSkills, allSkillCount, `all ${allSkillCount} PB-324 skills are reachable across the 10-element roster`);

  // 3) Every one of the 324 moves resolves cleanly through relayMove, resolveMoveSpecV2, relayMoveElement & relayEffectStyle
  for (const m of PB324_MOVES) {
    const rm = relayMove(m.id, m.ultimate);
    assert.ok(rm && rm.type && Number.isFinite(rm.windup) && Number.isFinite(rm.recovery), `${m.id} converts cleanly to relayMove`);
    const spec = resolveMoveSpecV2(m.id, rm);
    assert.equal(spec.v2Archetype, m.archetype, `${m.id} preserves exact archetype`);
    assert.equal(spec.element10, m.element, `${m.id} preserves canonical element`);
    assert.ok(spec.pb324 === m, `${m.id} attaches pb324 metadata`);
    assert.ok(relayMoveElement(m.id), `${m.id} resolves relayMoveElement`);
    assert.ok(relayEffectStyle(m.id)?.tint !== undefined, `${m.id} resolves relayEffectStyle`);
    assert.ok(pb324MoveName(m.id, "zh-Hant") === m.nameZh && pb324MoveName(m.id, "en") === m.nameEn);
    assert.ok(pb324MoveDesc(m.id, "zh-Hant").includes(`[${PB324_ELEMENT_META[m.element].zh}]`));
    assert.ok(pb324ToRelayMove(m.id));
    assert.ok(pb324Move(m.id));
  }

  // 4) Procedural Pixel-Particle VFX engine & 8 Global Hit-Feel systems verified in source (ZERO blocky 00GameDevs sprites!)
  const v2Src = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixelFxV2.js", import.meta.url), "utf8");
  const sceneSrc = readFileSync(new URL("../src/championship/presentation/dataArena/dataArenaPixiScene.js", import.meta.url), "utf8");
  const screenSrc = readFileSync(new URL("../src/championship/app/dataArenaScreen.js", import.meta.url), "utf8");
  assert.ok(!v2Src.includes("00GameDevs") && !v2Src.includes("outline: true"), "PixelFX V2 completely purged blocky 00GameDevs square sprites & dark outline blobs");
  assert.ok(v2Src.includes("PB_PARTICLE_PALETTES") && v2Src.includes("playPbMoveVfx") && v2Src.includes("emitElementBurst") && v2Src.includes("pxpuff"), "PB-Rank procedural pixel-particle engine active");
  assert.ok(sceneSrc.includes("0.22 * fRatio") && sceneSrc.includes("0.18 * fRatio"), "PB-Rank hit squash-and-stretch active");
  assert.ok(sceneSrc.includes("46") && sceneSrc.includes("lastImpactAt < 1.0"), "PB-Rank 46-wedge anime Impact Frame with 1.0s cooldown active");
  assert.ok(sceneSrc.includes("recent.total") && sceneSrc.includes("0.62"), "PB-Rank rapid multi-hit damage number merging active");
  assert.ok(screenSrc.includes("pb324Move") && screenSrc.includes("da-skill__el10"), "Lobby displays 10-element PB-324 badges and procedural preview");
});
