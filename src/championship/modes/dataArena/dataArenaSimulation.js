// Data Arena: Tidal Data Harbor Challenge -- the match simulation.
//
// OWNER_APPROVED_ADAPTATION 2026-10-15. An original real-time 1vE mode built
// beside, not inside, the Championship parity product: it imports no Battle,
// Raising or save module and writes nothing they read.
//
// Pure and deterministic: (seed, partner, quality, the per-step input list)
// fully determine the match. It advances only through step(input) at the
// fixed DATA_ARENA_STEP_SECONDS; it owns no clock, no ticker and no DOM.
// The presentation reads getState() (read-only by contract) and drains the
// event queue to drive camera, sound, crowd and particles.
//
// MOVE-COLLISION RULES (pinned by tests):
//  * Laser vs ORB (static data shot): the orb is erased; the beam continues.
//  * Laser vs SHARD (null data shot): the beam STOPS at the shard and grinds its
//    HP down; the shard breaks when it reaches 0. Until then it shields what
//    stands behind it.
//  * Water (mate's tide bolt or surge) vs EMBER: the ember is extinguished
//    (steam). A tide bolt is spent by the ember; a surge wave keeps going.
//  * EMBER vs ICE: an ember that lands on an ice cell shortens that ice.
//  * Solid cover stops the laser, every shot and every body.

import {
  DATA_ARENA_BEACON, DATA_ARENA_BOSS, DATA_ARENA_CROWD, DATA_ARENA_ENEMIES, DATA_ARENA_GRID_RULES, DATA_ARENA_LEVELS,
  DATA_ARENA_MAP, DATA_ARENA_MATE, DATA_ARENA_PARTNERS, DATA_ARENA_PLAYER, DATA_ARENA_PROJECTILES, DATA_ARENA_SCAN,
  DATA_ARENA_SCORE, DATA_ARENA_SPAWN, DATA_ARENA_STEP_SECONDS, DATA_ARENA_TIMELINE,
  DATA_ARENA_DUEL_MAP, DATA_ARENA_ENERGY, DATA_ARENA_KITS, DATA_ARENA_MOVES, DATA_ARENA_RIVALS, DATA_ARENA_TOURNAMENT
} from "./dataArenaConfig.js";
import { createDataArenaGrid } from "./dataArenaGrid.js";
import { createFlowField } from "./dataArenaNav.js";
import { createArenaRandom, dataArenaUpgrade, drawUpgradeOffer, upgradeValue } from "./dataArenaUpgrades.js";
import { DATA_ARENA_SURVIVAL, createSurvivalStorm, survivalCircleAt, outsideCircle, createSurvivalField, survivalRank } from "./dataArenaSurvival.js";

import { relayPartner, RELAY_ROSTER } from './dataArenaRelayRoster.js';
import { relayBattleMap } from './dataArenaRelayMaps.js';
import { DATA_ARENA_RELAY, RELAY_ACTION_PROFILES, relayTeamIds, relayMove, relayFacing8, relayKit, relayMoveElement, partnerAbilityFor } from './dataArenaRelay.js';
import { pb324PartnerKit } from './dataArenaPb324Catalog.js';
import { relaySpeciesKit } from './dataArenaRelayKits.js';
import { createRelayArenaEvents } from './dataArenaRelayArena.js';
import {
  CONTROL_MODES, normalizeControlMode, AI_DIFFICULTIES, normalizeAiDifficulty, DEFAULT_AI_SETTINGS, normalizeAiSettings, GUARD_RULES, suddenDeathMultiplier,
  threatOfShot, detectIncomingThreat, pbRankInterceptDodge, pbRankCornerWaypoint, pbRankSpacingVector,
  chooseUnifiedGoal, pickUnifiedMove, evaluateMoveMatchups, shouldUseTacticalArt, evaluateSmartSwitch
} from './dataArenaUnifiedAI.js';
import {
  statStageMultiplier, speedStageMultiplier, TACTICAL_CAPS, WEATHER_RULES, desiredWeatherForElement, weatherDamageMultiplier, weatherImmune,
  DATA_ARENA_TACTICAL_ARTS, TACTICAL_ART_IDS,
  tacticalArtById, defaultTacticalArtForElement, moveCombatTraits, speedScaledDodgeChance
} from './dataArenaTacticalArts.js';
import { normalizeMoveSystem, resolveMoveSpecV2, calibrateV2Move } from './dataArenaMoveCatalogV2.js';
import {
  normalizeCanonicalElement, AILMENT_RULES, SURFACE_KINDS, inferMoveAilment,
  inferMoveSurfacePatch, resolveSurfaceReaction,
  resolveVortexTransform, resolveWallElementReaction, buildWallShatterShards
} from './dataArenaCombos.js';
import { speciesTaxonomyForId, elementMultiplierPercent, factionResonance, TAXONOMY_RESONANCE } from '../../contracts/speciesTaxonomy.js';
import { BURST_RULES, BURST_BATTLE_RULES, BLOODLINE_BURST_PERKS, burstFormsFor, burstHpRatio, burstMultiplier } from '../../contracts/productBurstEvolution.js';
import { OVER_LIMIT_RULES } from '../../contracts/productAwakeningOverdrive.js';

const DT = DATA_ARENA_STEP_SECONDS;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Ray (origin, unit dir) vs circle: entry distance along the ray, or -1. */
export function rayCircle(ox, oy, dx, dy, cx, cy, radius) {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy, c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0 || b > 0) return -1;
  return -b - Math.sqrt(disc);
}

/** Distance from point to segment. */
export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, length2 = vx * vx + vy * vy;
  const t = length2 > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / length2, 0, 1) : 0;
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

const NEUTRAL_INPUT = Object.freeze({ moveX: 0, moveY: 0, aimX: null, aimY: null, fire: false, dash: false, guard: false, tactical: false, surge: false, ride: false, cast: null, ult: false, autoAim: false });
// SURVIVAL (P4 prototype, 2026-11-16): the harbor match with a closing storm and eleven rival tamers.
export const DATA_ARENA_MODES = Object.freeze(["TOURNAMENT", "HARBOR", "RELAY", "SURVIVAL"]);

export function createDataArenaSimulation({ seed = 1, partnerId = DATA_ARENA_PARTNERS[0].id, quality = "high", mode = "HARBOR", moveSystem = "legacy", controlMode = "MANUAL", aiDifficulty = null, aiSettings = null, tacticalArt = null, relayLoadouts = {}, relayReserveId = null, relayThirdId = null, relayCompanionSpecies = [], relayArenaId = null, portrait = false, partnerPower = {}, relayBurstPlans = {}, relayManualBurst = false, rivalBoostPercent = 0, relayRivals = null, relayBuffPicks = false } = {}) {
  const v2Mode = mode === "RELAY" && normalizeMoveSystem(moveSystem) === "v2";
  const pbRankAi = v2Mode || (mode === "RELAY" && aiDifficulty !== null);
  const initialAiDifficulty = normalizeAiDifficulty(aiDifficulty);
  // A sponsor contract's rift gambit (AWAKENING_OVERDRIVE_20261109): every rival has this much more HP and damage.
  const rivalBoost = 1 + (Number.isSafeInteger(rivalBoostPercent) && rivalBoostPercent > 0 && rivalBoostPercent <= 100 ? rivalBoostPercent : 0) / 100;
  if (!DATA_ARENA_MODES.includes(mode)) throw new RangeError(`DATA_ARENA_UNKNOWN_MODE:${mode}`);
  const relayMode = mode === "RELAY";
  const survivalMode = mode === "SURVIVAL";
  const tournamentMode = mode === "TOURNAMENT" || relayMode;
  const moveFor = (id, ultimate = false) => {
    const base = relayMode ? relayMove(id, ultimate) : DATA_ARENA_MOVES[id];
    return v2Mode && base ? calibrateV2Move(id, base, { ultimate }) : base;
  };
  const dashCooldown = tournamentMode ? DATA_ARENA_TOURNAMENT.dashCooldown : DATA_ARENA_PLAYER.dash.cooldown;
  const hasMate = !tournamentMode;
  const map = relayMode ? relayBattleMap(relayArenaId,portrait) : tournamentMode ? DATA_ARENA_DUEL_MAP : DATA_ARENA_MAP;
  let partner = relayMode ? relayPartner(partnerId) : DATA_ARENA_PARTNERS.find((entry) => entry.id === partnerId);
  if (!partner) throw new RangeError(`DATA_ARENA_UNKNOWN_PARTNER:${partnerId}`);
  // Entry power (Owner 2026-11-02): a partner raised on the ranch fights at
  // 1.1, a practice loan at 0.85, a Dex-registered one at 1. It scales the
  // partner's HP and every hit it deals; rivals and the course are unchanged.
  const powerOf = (id) => { const value = Number(partnerPower?.[id]); return Number.isFinite(value) && value > 0 ? value : 1; };
  const random = createArenaRandom(seed);
  const grid = createDataArenaGrid({ map });
  const cell = map.cell;
  const worldWidth = grid.cols * cell, worldHeight = grid.rows * cell;
  const at = ([c, r]) => ({ x: (c + 0.5) * cell, y: (r + 0.5) * cell });
  const walkerField = createFlowField(grid, "walker");
  const fireproofField = createFlowField(grid, "fireproof");
  const mateField = createFlowField(grid, "swimmer");
  const events = [];
  const emit = (event) => { event.t = state.time; events.push(event); return event; };
  let relayArena = null; // RELAY stage three timed zones; created with the relay match below.
  let nextId = 1;
  let nextActionId = 1;

  const upgrades = { ...partner.startingUpgrades };
  const playerSpawn = at(map.playerSpawn), mateSpawn = at(map.mateSpawn);

  const player = {
    partnerId, formPartnerId: null, speciesId: partner.speciesId, facing8: 2, recovery: 0, action: null,
    canSwim: partner.canSwim === true,
    id: nextId++, x: playerSpawn.x, y: playerSpawn.y, vx: 0, vy: 0, radius: DATA_ARENA_PLAYER.radius,
    hp: partner.hp, maxHp: partner.hp, state: "NORMAL", stateTime: 0, facing: 1,
    invulnerable: 0, dashGrace: 0, dashTimer: 0, dashDirX: 1, dashDirY: 0, dashCharges: 1, dashRecharge: 0,
    perfectThisDash: false, dashHits: new Set(), revives: tournamentMode ? 0 : DATA_ARENA_PLAYER.revives, hitFlash: 0, hurtTimer: 0, hitDirX: 0, hitDirY: 0,
    fallFromX: 0, fallFromY: 0,
    // Kit: slots 2-4 spend energy and have cooldowns; the ultimate charges.
    team: "player", kit: relayMode ? relayKit(partnerId, relayLoadouts[partnerId]) : DATA_ARENA_KITS[partnerId], energy: DATA_ARENA_ENERGY.max, energySpentAt: -Infinity,
    cooldowns: Object.create(null), ult: 0, cast: null, lunge: null, barrier: 0, barrierAngle: 0,
    guardTimer: 0, guardCooldown: 0, guardBlocked: false, barrierStreak: 0,
    atkStage: 0, defStage: 0, spdStage: 0, buffsUsed: 0, healsUsed: 0,
    decoy: null, decoyUsed: false,
    tacticalArt: tacticalArt ? tacticalArtById(tacticalArt).id : defaultTacticalArtForElement(partner.element),
    tacticalCooldown: 0, tacticalBuffer: null, counterTimer: 0, flurry: null, backstab: null, approach: null,
    ai: { goal: null, goalTimer: 0, strafe: 1, strafeTimer: 1.2, threatSeen: new Set(), attackDelay: 0.35, field: createFlowField(grid, "walker"), wantsCover: false, calledMove: null },
    slow: 0, slowTimer: 0, root: 0, burn: 0, paralyze: 0, paralyzeTick: 0, poison: 0, poisonStacks: 0, sleep: 0, wet: 0, ccImmune: 0, damageScale: 1, tagShield: 0
  };
  if (tournamentMode) { player.maxHp = Math.round(partner.hp * DATA_ARENA_TOURNAMENT.playerHpScale); player.hp = player.maxHp; }
  if (powerOf(partnerId) !== 1) { player.maxHp = Math.round(player.maxHp * powerOf(partnerId)); player.hp = player.maxHp; }
  const laser = {
    angle: 0, firing: false, heat: 0, overheated: false, overheatTimer: 0,
    x0: 0, y0: 0, x1: 0, y1: 0, endKind: "RANGE", igniteCell: -1, igniteAccum: 0, hitTimer: 0
  };
  const mate = {
    canSwim: DATA_ARENA_MATE.canSwim === true,
    id: nextId++, x: mateSpawn.x, y: mateSpawn.y, vx: 0, vy: 0, radius: DATA_ARENA_MATE.radius,
    hp: DATA_ARENA_MATE.hp, maxHp: DATA_ARENA_MATE.hp, state: hasMate ? "FOLLOW" : "ABSENT", stateTime: 0, facing: -1,
    jetTimer: 0.6, surgeCooldown: 0, surgeAim: null, reviveProgress: 0, downedTime: 0, hitFlash: 0, swimming: false
  };

  const state = {
    seed, partnerId, quality, gameMode: mode, moveSystem: v2Mode ? "v2" : "legacy", controlMode: normalizeControlMode(controlMode),
    aiDifficulty: initialAiDifficulty,
    aiSettings: normalizeAiSettings(aiSettings),
    hazards: { player: 0, rival: 0 },
    weather: { kind: null, remaining: 0, tickTimer: 0 },
    suddenDeath: { active: false, multiplier: 1 }, lastHit: null,
    time: 0, mode: "PLAY", phaseIndex: 0, phaseId: tournamentMode ? "DUEL" : survivalMode ? "SURVIVAL" : "WARMUP", warnedPhase: 0,
    rivals: [], zones: [], puddles: [], shockwaves: [], groundSpikes: [], energyOrbs: [], energyOrbTimer: 10.5, tournament: null, relay: null,
    player, laser, mate, boss: null, enemies: [], projectiles: [], pickups: [], telegraphs: [], scans: [],
    pods: map.pods.map(([c, r]) => ({ id: nextId++, ...at([c, r]), hp: DATA_ARENA_GRID_RULES.podHp, respawn: 0, radius: 20 })),
    beacons: map.beacons.map(([c, r]) => ({ id: nextId++, ...at([c, r]), active: false, progress: 0, captured: false })),
    cores: [], surges: [],
    xp: 0, level: 1, upgrades, offer: null, pendingLevels: 0,
    score: 0, kills: 0, warmupDone: false,
    hype: 0, cheerTimer: 0, cheerCooldown: 0, cheers: 0,
    stats: { perfectDodges: 0, chains: 0, rescues: 0, falls: 0, coresOut: 0, beaconsCaptured: 0, shardsBroken: 0, orbsErased: 0,
      embersQuenched: 0, bridgesFormed: 0, rides: 0, damageTaken: 0, laserSeconds: 0,
      movesCast: 0, ultimates: 0, barrierBlocks: 0, rivalDodges: 0, roundsWon: 0 },
    spawnTimer: 1.2, scanRingTimer: 0, result: null, endTimer: 0, victoryAt: null,
    crowd: { lastBySource: Object.create(null), window: [] },
    killWindow: [],
    combo: { count: 0, timer: 0, max: 0 }
  };
  // Lens freeze bookkeeping and laser ignition use the grid; nothing else does.
  const maxAlive = DATA_ARENA_SPAWN.maxAlive[quality] ?? DATA_ARENA_SPAWN.maxAlive.high;
  // SURVIVAL: the storm and the field of rival tamers, both seeded at the start (dataArenaSurvival.js).
  state.survival = null;
  if (survivalMode) {
    const storm = createSurvivalStorm({ random, worldWidth, worldHeight });
    state.survival = { storm, circle: survivalCircleAt(storm, 0), tamers: createSurvivalField({ random, definitions: DATA_ARENA_RIVALS.map((r) => r.id) }),
      stage: 0, stormTick: 0, knockouts: 0, won: false };
  }

  // ------------------------------------------------------------------ derived stats
  const stat = {
    get speed() { return partner.speed * (1 + upgradeValue(upgrades, "speed")); },
    get laserDps() { return partner.laserDps * (1 + upgradeValue(upgrades, "laserDps")) * (state.cheerTimer > 0 ? DATA_ARENA_CROWD.cheerLaserDps : 1) * powerOf(partner.powerId ?? partner.id); },
    get heatCapacity() { return partner.heatCapacity * (1 + upgradeValue(upgrades, "heatCapacity")); },
    get cooling() { return partner.coolPerSecond * (1 + upgradeValue(upgrades, "cooling")) * (state.cheerTimer > 0 ? DATA_ARENA_CROWD.cheerCooling : 1); },
    get pierce() { return upgradeValue(upgrades, "pierce"); },
    get laserWidth() { return partner.laserWidth; },
    get dashCharges() { return DATA_ARENA_PLAYER.dash.charges + upgradeValue(upgrades, "dashCharges"); },
    get dashDamage() { return upgradeValue(upgrades, "dashDamage"); },
    get nearMiss() { return DATA_ARENA_PLAYER.dash.nearMiss + upgradeValue(upgrades, "nearMiss"); },
    get perfectRefund() { return upgradeValue(upgrades, "perfectRefund") > 0; },
    get frostLens() { return upgradeValue(upgrades, "frostLens") > 0; },
    get iceScale() { return 1 + upgradeValue(upgrades, "iceDuration"); },
    get surgeRadius() { return 1 + upgradeValue(upgrades, "surgeRadius"); },
    get surgeCooldown() { return DATA_ARENA_MATE.surge.cooldown * (1 + upgradeValue(upgrades, "surgeCooldown")); },
    get mateHp() { return DATA_ARENA_MATE.hp * (1 + upgradeValue(upgrades, "mateHp")); },
    get reviveSpeed() { return 1 + upgradeValue(upgrades, "reviveSpeed"); },
    get hypeGain() { return 1 + upgradeValue(upgrades, "hypeGain"); },
    get energyRegen() { return DATA_ARENA_ENERGY.regen * (1 + upgradeValue(upgrades, "energyRegen")); },
    get cooldownScale() { return Math.max(0.5, 1 + upgradeValue(upgrades, "cooldown")); },
    get ultGain() { return 1 + upgradeValue(upgrades, "ultGain"); },
    get skillDamage() { return (1 + upgradeValue(upgrades, "skillDamage")) * powerOf(partner.powerId ?? partner.id); }
  };
  player.dashCharges = stat.dashCharges;

  // ------------------------------------------------------------------ movement
  const movementKind = (body) => body.canSwim === true ? "swimmer" : "walker";
  function blocked(x, y, radius, kind) {
    if (x - radius < 0 || y - radius < 0 || x + radius > worldWidth || y + radius > worldHeight) return true;
    const c0 = grid.cellOf(x - radius), c1 = grid.cellOf(x + radius), r0 = grid.cellOf(y - radius), r1 = grid.cellOf(y + radius);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!grid.blocksMoveAt(c, r, kind)) continue;
      const nx = clamp(x, c * cell, (c + 1) * cell), ny = clamp(y, r * cell, (r + 1) * cell);
      if ((nx - x) ** 2 + (ny - y) ** 2 < radius * radius) return true;
    }
    return false;
  }
  /** Push a body (knockback velocity, decays); see stepKnock for walls and water. */
  function launch(body, dirX, dirY, speed) {
    if (!speed || (body === player && player.state !== "NORMAL")) return;
    if ((body.guardTimer ?? 0) > 0) return; // active Guard braces against knockback
    body.kbx = (body.kbx ?? 0) + dirX * speed; body.kby = (body.kby ?? 0) + dirY * speed;
  }

  /** Precision Active Guard (0.5 s brace, -65 % dmg, no knockback; 3.0 s miss CD; blocked in hitstun). */
  function tryStartGuard(body) {
    if (!body || body.hp <= 0 || body.lunge) return false;
    if (body === player && player.state !== "NORMAL") return false;
    if ((body.guardTimer ?? 0) > 0 || (body.guardCooldown ?? 0) > 0 || (body.hitstun ?? 0) > 0) return false;
    if (body.cast) { removeTelegraph(`cast:${body.id}`); body.cast = null; }
    body.guardTimer = GUARD_RULES.duration;
    body.guardBlocked = false;
    emit({ type: "GUARD_START", side: body === player ? "player" : "rival", x: body.x, y: body.y, duration: GUARD_RULES.duration });
    return true;
  }

  function tickGuard(body) {
    if (!body) return;
    if (body.guardCooldown > 0) body.guardCooldown = Math.max(0, body.guardCooldown - DT);
    if (body.guardTimer > 0) {
      body.guardTimer = Math.max(0, body.guardTimer - DT);
      if (body.guardTimer <= 0) {
        const manualParry = body === player && state.controlMode === "MANUAL" && body.guardBlocked;
        body.guardCooldown = manualParry ? GUARD_RULES.manualParryCooldown
          : body.guardBlocked ? GUARD_RULES.hitCooldown : GUARD_RULES.missCooldown;
        if (manualParry) {
          if (relayMode) {
            player.energy = Math.min(DATA_ARENA_RELAY.tpMax, player.energy + 18);
            const foe = state.rivals[0];
            if (foe && foe.active && foe.hp > 0 && distance(foe.x, foe.y, player.x, player.y) < 175) {
              foe.hitstun = Math.max(foe.hitstun ?? 0, 0.42);
              foe.cast = null; removeTelegraph(`cast:${foe.id}`);
            }
          }
          emit({ type: "GUARD_PARRY", side: "player", x: body.x, y: body.y });
        }
        else if (!body.guardBlocked) emit({ type: "GUARD_MISS", side: body === player ? "player" : "rival", x: body.x, y: body.y });
      }
    }
  }

  function applyStatDelta(body, { atk = 0, def = 0, spd = 0 }) {
    if (!body) return;
    body.atkStage = clamp((body.atkStage ?? 0) + atk, -2, 4);
    body.defStage = clamp((body.defStage ?? 0) + def, -2, 4);
    body.spdStage = clamp((body.spdStage ?? 0) + spd, -2, 4);
  }

  /** Execute one of the 8 universal Tactical Arts (same deterministic rules for BOTH player & rivals). */
  function tacticalRefusalReason(body) {
    if (!relayMode || !body || body.hp <= 0) return "BUSY";
    const art = tacticalArtById(body.tacticalArt);
    if (art.kind === "BUFF" && (body.buffsUsed ?? 0) >= TACTICAL_CAPS.buffsPerStay) return "SPENT";
    if (art.kind === "HEAL" && (body.healsUsed ?? 0) >= TACTICAL_CAPS.healsPerBattle) return "SPENT";
    if (art.kind === "DECOY" && (body.decoyUsed || body.decoy || body.hp <= Math.ceil(body.maxHp * art.hpShare))) return "SPENT";
    if ((body.tacticalCooldown ?? 0) > 0) return "COOLDOWN";
    if (body.energy < art.energy) return "ENERGY";
    if (body.cast || body.lunge || body.flurry || body.backstab || (body.recovery ?? 0) > 0 || (body.sleep ?? 0) > 0 || (body.root ?? 0) > 0) return "BUSY";
    if (body === player && player.state !== "NORMAL") return "BUSY";
    return null;
  }

  function canUseTacticalArt(body) {
    return tacticalRefusalReason(body) === null;
  }

  function tryStartTacticalArt(body, foe = null, { allowApproach = true, aimX = null, aimY = null, fromPlayerPress = false } = {}) {
    const refusal = tacticalRefusalReason(body);
    if (refusal) {
      if (fromPlayerPress && body === player) {
        if (refusal === "BUSY") {
          player.tacticalBuffer = { ttl: 0.28, aimX, aimY };
        } else {
          emit({ type: "TACTICAL_REFUSED", reason: refusal, artId: body.tacticalArt, x: body.x, y: body.y });
        }
      }
      return false;
    }
    const art = tacticalArtById(body.tacticalArt);
    const side = body === player ? "player" : "rival";
    const target = foe ?? (body === player ? state.rivals[0] : player);
    const explicitAim = Number.isFinite(aimX) && Number.isFinite(aimY);
    const dirAngle = explicitAim
      ? Math.atan2(aimY - body.y, aimX - body.x)
      : target && target.hp > 0 ? Math.atan2(target.y - body.y, target.x - body.x) : (body.facing >= 0 ? 0 : Math.PI);
    if (!art.selfOnly && target && target.hp > 0 && !explicitAim) {
      const dist = distance(body.x, body.y, target.x, target.y);
      if (dist > art.reach + 16) {
        if (!allowApproach) return false;
        // Auto-Approach-to-Cast: sprint seamlessly into contact range before unleashing!
        body.approach = { kind: "TACTICAL", artId: art.id, target, reach: art.reach + 8, ttl: TACTICAL_CAPS.autoApproachMaxSeconds };
        emit({ type: "APPROACH_START", side, moveId: art.id, x: body.x, y: body.y });
        return true;
      }
    }
    body.approach = null;
    body.energy = Math.max(0, body.energy - art.energy);
    body.energySpentAt = state.time;
    body.tacticalCooldown = art.cooldown;
    body.recovery = art.recovery;
    if (body === player) state.stats.movesCast++;
    if (art.kind === "BUFF") {
      body.buffsUsed = (body.buffsUsed ?? 0) + 1;
      applyStatDelta(body, { atk: art.atkDelta ?? 1, spd: art.spdDelta ?? 1 });
      emit({ type: "STAT_BUFF", side, artId: art.id, atkStage: body.atkStage, spdStage: body.spdStage, buffsUsed: body.buffsUsed, x: body.x, y: body.y });
      return true;
    }
    if (art.kind === "HEAL") {
      body.healsUsed = (body.healsUsed ?? 0) + 1;
      const amt = Math.round(body.maxHp * art.healShare);
      body.hp = Math.min(body.maxHp, body.hp + amt);
      emit({ type: "TACTICAL_HEAL", side, artId: art.id, amount: amt, healsUsed: body.healsUsed, x: body.x, y: body.y });
      return true;
    }
    if (art.kind === "COUNTER") {
      body.counterTimer = art.duration;
      emit({ type: "COUNTER_UP", side, artId: art.id, duration: art.duration, x: body.x, y: body.y });
      return true;
    }
    if (art.kind === "HAZARD") {
      const enemySide = side === "player" ? "rival" : "player";
      state.hazards[enemySide] = Math.min(TACTICAL_CAPS.maxHazardLayers, (state.hazards[enemySide] ?? 0) + 1);
      const hx = explicitAim ? clamp(aimX, 56, worldWidth - 56) : (target ? target.x : body.x + Math.cos(dirAngle) * 140);
      const hy = explicitAim ? clamp(aimY, 56, worldHeight - 56) : (target ? target.y : body.y + Math.sin(dirAngle) * 140);
      emit({ type: "HAZARD_PLACED", side, enemySide, layers: state.hazards[enemySide], x: hx, y: hy, angle: dirAngle });
      return true;
    }
    if (art.kind === "DECOY") {
      const cost = Math.max(1, Math.round(body.maxHp * art.hpShare));
      body.hp = Math.max(1, body.hp - cost);
      body.decoyUsed = true;
      body.decoy = { hp: cost, maxHp: cost };
      emit({ type: "DECOY_SPAWN", side, hp: cost, x: body.x, y: body.y });
      return true;
    }
    if (art.kind === "WEATHER") {
      const kind = desiredWeatherForElement(casterElement(body));
      state.weather = { kind, remaining: art.duration ?? WEATHER_RULES.duration, tickTimer: WEATHER_RULES.chipInterval };
      emit({ type: "WEATHER_START", side, kind, duration: state.weather.remaining, x: body.x, y: body.y });
      return true;
    }
    if (art.kind === "FLURRY") {
      body.facing = Math.cos(dirAngle) >= 0 ? 1 : -1;
      body.facing8 = relayFacing8(dirAngle);
      body.flurry = { artId: art.id, hitsLeft: art.hits, timer: 0, interval: art.interval, damagePerHit: art.damagePerHit, dirX: Math.cos(dirAngle), dirY: Math.sin(dirAngle), target };
      applyStatDelta(body, { def: art.selfDefDelta ?? -1 });
      emit({ type: "FLURRY_START", side, artId: art.id, x: body.x, y: body.y, angle: dirAngle });
      return true;
    }
    if (art.kind === "BACKSTAB") {
      body.facing = Math.cos(dirAngle) >= 0 ? 1 : -1;
      body.facing8 = relayFacing8(dirAngle);
      body.invulnerable = Math.max(body.invulnerable ?? 0, art.vanishSeconds + 0.08);
      body.backstab = { artId: art.id, timer: art.vanishSeconds, damage: art.damage, target, angle: dirAngle };
      emit({ type: "BACKSTAB_VANISH", side, artId: art.id, x: body.x, y: body.y, angle: dirAngle });
      return true;
    }
    return false;
  }

  function triggerSwitchHazard(body, side) {
    const layers = state.hazards?.[side] ?? 0;
    if (!relayMode || layers <= 0 || !body || body.hp <= 0) return;
    const share = TACTICAL_CAPS.hazardDamageShares[Math.min(layers, TACTICAL_CAPS.maxHazardLayers)] ?? 0.1;
    const dmg = Math.max(1, Math.round(body.maxHp * share));
    body.hp = Math.max(1, body.hp - dmg);
    body.hitFlash = 0.2;
    emit({ type: "HAZARD_TRIGGERED", side, layers, amount: dmg, x: body.x, y: body.y });
  }

  function tickTacticalStates(body) {
    if (!relayMode || !body) return;
    const side = body === player ? "player" : "rival";
    if (body.tacticalCooldown > 0) body.tacticalCooldown = Math.max(0, body.tacticalCooldown - DT);
    if (body.counterTimer > 0) body.counterTimer = Math.max(0, body.counterTimer - DT);
    // Multi-hit close-range martial-arts flurry (3-4 rapid hits with micro-steps & crescent slashes)
    if (body.flurry) {
      if (body.hp <= 0 || (body.hitstun ?? 0) > 0) { body.flurry = null; }
      else {
        body.flurry.timer -= DT;
        if (body.flurry.timer <= 0) {
          body.flurry.timer = body.flurry.interval;
          body.flurry.hitsLeft--;
          const target = body.flurry.target;
          if (target && target.hp > 0) {
            const d = distance(body.x, body.y, target.x, target.y) || 1;
            body.flurry.dirX = (target.x - body.x) / d;
            body.flurry.dirY = (target.y - body.y) / d;
            const step = Math.min(32, Math.max(12, d - 34));
            moveBody(body, body.flurry.dirX * step, body.flurry.dirY * step, movementKind(body));
          } else {
            moveBody(body, body.flurry.dirX * 16, body.flurry.dirY * 16, movementKind(body));
          }
          if (target && target.hp > 0 && distance(body.x, body.y, target.x, target.y) <= TACTICAL_CAPS.flurryReach + 34) {
            const scale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
            const finalHit = body.flurry.hitsLeft <= 0;
            const dmg = body.flurry.damagePerHit * scale * (finalHit ? 1.35 : 1);
            strike(target, dmg, "FLURRY", null, target.x, target.y, body.flurry.arenaElement ?? "physical", body.flurry.attackElement ?? null, false, { moveId: body.flurry.moveId ?? body.flurry.artId });
            if (finalHit) launch(target, body.flurry.dirX, body.flurry.dirY, 260);
            emit({ type: "FLURRY_HIT", side, hitIndex: TACTICAL_CAPS.flurryHits - body.flurry.hitsLeft, final: finalHit, x: target.x, y: target.y, angle: Math.atan2(body.flurry.dirY, body.flurry.dirX) });
          }
          // Martial-arts flurry punches shatter nearby temporary shield walls directionally (2.5x wall breaker)!
          if (relayMode) {
            const fAng = Math.atan2(body.flurry.dirY, body.flurry.dirX);
            const fScale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
            for (const prop of grid.props) {
              if (prop.destroyed || !prop.temporary) continue;
              const px = (prop.col + prop.width / 2) * cell, py = (prop.row + prop.height / 2) * cell;
              if (distance(body.x, body.y, px, py) <= TACTICAL_CAPS.flurryReach + 48) {
                reactAndShatterWall(prop, body.flurry.damagePerHit * fScale, body.flurry.attackElement ?? body.flurry.arenaElement ?? "METAL", body.flurry.moveId ?? body.flurry.artId, body.team, fAng, { melee: true, cause: "FLURRY" });
              }
            }
          }
          if (body.flurry.hitsLeft <= 0) body.flurry = null;
        }
      }
    }
    // Shadow Ambush vanish -> teleport behind target -> crit cross-slash!
    if (body.backstab) {
      if (body.hp <= 0) { body.backstab = null; }
      else {
        body.backstab.timer -= DT;
        if (body.backstab.timer <= 0) {
          const { target, damage, artId } = body.backstab;
          body.backstab = null;
          if (target && target.hp > 0) {
            const behindDir = -(target.facing || 1);
            const tx = clamp(target.x + behindDir * 44, 48, worldWidth - 48);
            const ty = clamp(target.y, 48, worldHeight - 48);
            if (!blocked(tx, ty, body.radius * 0.8, movementKind(body))) { body.x = tx; body.y = ty; }
            const ang = Math.atan2(target.y - body.y, target.x - body.x);
            body.facing = Math.cos(ang) >= 0 ? 1 : -1;
            body.facing8 = relayFacing8(ang);
            const scale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
            const dmg = damage * scale * TACTICAL_CAPS.backstabCritMultiplier;
            strike(target, dmg, "BACKSTAB", { slow: 0.35, slowSeconds: 0.9 }, target.x, target.y, "shadow", null, false);
            launch(target, Math.cos(ang), Math.sin(ang), 220);
            emit({ type: "BACKSTAB_HIT", side, artId, x: target.x, y: target.y, fromX: body.x, fromY: body.y, angle: ang });
          }
        }
      }
    }
    // Auto-Approach-to-Cast sprint into melee reach
    if (body.approach) {
      const ap = body.approach;
      ap.ttl -= DT;
      const target = ap.target;
      if (ap.ttl <= 0 || body.hp <= 0 || !target || target.hp <= 0 || body.cast || body.lunge || (body.hitstun ?? 0) > 0) {
        body.approach = null;
      } else {
        const d = distance(body.x, body.y, target.x, target.y) || 1;
        if (d <= ap.reach) {
          body.approach = null;
          if (ap.kind === "TACTICAL") tryStartTacticalArt(body, target, { allowApproach: false });
          else if (ap.kind === "CAST") beginCast(body, ap.moveId, target.x, target.y, { ultimate: Boolean(ap.ultimate) });
        } else {
          const spd = (body === player ? stat.speed : body.speed) * moveScale(body) * 1.18;
          const dx = (target.x - body.x) / d, dy = (target.y - body.y) / d;
          body.vx = dx * spd; body.vy = dy * spd;
          body.facing = dx >= 0 ? 1 : -1;
          body.facing8 = relayFacing8(Math.atan2(dy, dx));
          moveBody(body, body.vx * DT, body.vy * DT, movementKind(body));
        }
      }
    }
    // V2 LEAP_SLAM: jump high into the air on a parabolic arc -> dive slam with Guard-Break & shockwave!
    if (body.leapSlam) {
      const ls = body.leapSlam;
      ls.t += DT;
      const p = clamp(ls.t / ls.duration, 0, 1);
      body.airZ = Math.round(Math.sin(p * Math.PI) * 86);
      body.invulnerable = Math.max(body.invulnerable ?? 0, p < 0.85 ? 0.08 : 0);
      const nx = ls.startX + (ls.destX - ls.startX) * p;
      const ny = ls.startY + (ls.destY - ls.startY) * p;
      if (!blocked(nx, ny, body.radius * 0.8, movementKind(body))) { body.x = nx; body.y = ny; }
      if (p >= 1 || body.hp <= 0) {
        body.airZ = 0;
        body.leapSlam = null;
        if (body.hp > 0) {
          const scale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
          const radius = ls.radius ?? 112;
          for (const target of targetsFor(body.team)) {
            if (distance(target.x, target.y, body.x, body.y) > radius + (target.radius ?? 20)) continue;
            strike(target, ls.damage * scale, "LEAP_SLAM", { slow: 0.3, slowSeconds: 0.9 }, body.x, body.y, ls.arenaElement, ls.attackElement, false, { guardBreak: true });
            const d = distance(target.x, target.y, body.x, body.y) || 1;
            launch(target, (target.x - body.x) / d, (target.y - body.y) / d, 300);
          }
          for (const prop of grid.props) {
            if (prop.destroyed) continue;
            const px = (prop.col + prop.width / 2) * cell, py = (prop.row + prop.height / 2) * cell;
            if (distance(px, py, body.x, body.y) <= radius + cell * 0.6) {
              const wAng = Math.atan2(py - body.y, px - body.x);
              reactAndShatterWall(prop, ls.damage * 0.85, ls.attackElement ?? ls.arenaElement, ls.moveId, body.team, wAng, { melee: true, cause: "IMPACT" });
            }
          }
          triggerSurfaceReactionAt(body.x, body.y, ls.attackElement ?? ls.arenaElement, ls.moveId, body.team, Math.atan2(ls.destY - ls.startY, ls.destX - ls.startX));
          maybeSpawnMoveSurface(body.x, body.y, ls.moveId, ls.arenaElement, ls.attackElement, { v2Archetype: "LEAP_SLAM" }, body.team, false);
          spawnShockwave({ team: body.team, x: body.x, y: body.y, moveId: ls.moveId, maxRadius: radius * 1.45, duration: 0.36, damage: ls.damage * 0.42 * scale, arenaElement: ls.arenaElement, attackElement: ls.attackElement });
          emit({ type: "LEAP_SLAM_HIT", side, moveId: ls.moveId, x: body.x, y: body.y, radius });
        }
      }
    }
    // V2 GRAB_SLAM: rush-in grab -> lift enemy overhead -> slam violently into the arena floor!
    if (body.grabSlam) {
      const gs = body.grabSlam;
      gs.t += DT;
      const target = gs.target;
      if (body.hp <= 0 || !target || target.hp <= 0) {
        if (target) { target.airZ = 0; target.tkHeld = 0; }
        body.grabSlam = null;
      } else if (gs.phase === "RUSH") {
        const d = distance(body.x, body.y, target.x, target.y) || 1;
        const step = 680 * DT;
        moveBody(body, ((target.x - body.x) / d) * Math.min(step, d), ((target.y - body.y) / d) * Math.min(step, d), movementKind(body));
        if (distance(body.x, body.y, target.x, target.y) <= 72 || gs.t >= 0.36) {
          if (distance(body.x, body.y, target.x, target.y) <= 88) {
            gs.phase = "LIFT";
            gs.t = 0;
            target.hitstun = Math.max(target.hitstun ?? 0, 0.48);
            emit({ type: "GRAB_LIFT", side, moveId: gs.moveId, x: target.x, y: target.y });
          } else {
            body.grabSlam = null;
          }
        }
      } else if (gs.phase === "LIFT") {
        const p = clamp(gs.t / 0.34, 0, 1);
        target.hitstun = Math.max(target.hitstun ?? 0, 0.14);
        const holdX = clamp(body.x + (body.facing || 1) * 28, 44, worldWidth - 44);
        const holdY = clamp(body.y - 4, 44, worldHeight - 44);
        if (!blocked(holdX, holdY, target.radius * 0.7, movementKind(target))) { target.x = holdX; target.y = holdY; }
        target.airZ = Math.round(Math.sin(p * Math.PI * 0.85) * 62);
        if (p >= 1) {
          target.airZ = 0;
          const scale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
          strike(target, gs.damage * scale, "GRAB_SLAM", { slow: 0.35, slowSeconds: 1.0 }, body.x, body.y, gs.arenaElement, gs.attackElement, false, { guardBreak: true });
          launch(target, body.facing || 1, 0.15, 340);
          spawnShockwave({ team: body.team, x: target.x, y: target.y, moveId: gs.moveId, maxRadius: 120, duration: 0.32, damage: gs.damage * 0.3 * scale, arenaElement: gs.arenaElement, attackElement: gs.attackElement });
          emit({ type: "GRAB_SLAM_HIT", side, moveId: gs.moveId, x: target.x, y: target.y });
          body.grabSlam = null;
        }
      }
    }
    // V2 TELEKINESIS_SLAM: levitate foe high in mid-air with psychic force -> slam straight down into the floor!
    if (body.tkSlam) {
      const tk = body.tkSlam;
      tk.t += DT;
      const target = tk.target;
      if (body.hp <= 0 || !target || target.hp <= 0) {
        if (target) { target.airZ = 0; target.tkHeld = 0; }
        body.tkSlam = null;
      } else if (tk.phase === "LIFT") {
        const p = clamp(tk.t / 0.42, 0, 1);
        target.hitstun = Math.max(target.hitstun ?? 0, 0.16);
        target.tkHeld = 1;
        target.airZ = Math.round(p * 78 + Math.sin(tk.t * 24) * 3);
        if (p >= 1) { tk.phase = "SLAM"; tk.t = 0; }
      } else if (tk.phase === "SLAM") {
        const p = clamp(tk.t / 0.12, 0, 1);
        target.tkHeld = 1;
        target.airZ = Math.round((1 - p) * 78);
        if (p >= 1) {
          target.airZ = 0;
          target.tkHeld = 0;
          const scale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
          strike(target, tk.damage * scale, "TK_SLAM", { slow: 0.4, slowSeconds: 1.1 }, body.x, body.y, tk.arenaElement, tk.attackElement, false, { guardBreak: true });
          spawnShockwave({ team: body.team, x: target.x, y: target.y, moveId: tk.moveId, maxRadius: 135, duration: 0.34, damage: tk.damage * 0.32 * scale, arenaElement: tk.arenaElement, attackElement: tk.attackElement });
          emit({ type: "TK_SLAM_HIT", side, moveId: tk.moveId, x: target.x, y: target.y });
          body.tkSlam = null;
        }
      }
    }
    if (body.burrow) {
      const bw = body.burrow;
      bw.t += DT;
      if (body.hp <= 0) {
        body.burrowed = false;
        body.burrow = null;
      } else if (bw.phase === "DIVE") {
        body.burrowed = true;
        body.invulnerable = Math.max(body.invulnerable ?? 0, 0.16);
        if (bw.t >= 0.12) { bw.phase = "TUNNEL"; bw.t = 0; }
      } else if (bw.phase === "TUNNEL") {
        body.burrowed = true;
        body.invulnerable = Math.max(body.invulnerable ?? 0, 0.16);
        const p = clamp(bw.t / bw.duration, 0, 1);
        const nx = bw.startX + (bw.destX - bw.startX) * p;
        const ny = bw.startY + (bw.destY - bw.startY) * p;
        if (!blocked(nx, ny, body.radius * 0.72, "forced")) { body.x = nx; body.y = ny; }
        if (p >= 1) {
          body.burrowed = false;
          body.burrow = null;
          body.airZ = 34; // pops dramatically upward out of the earth!
          const scale = body === player ? stat.skillDamage * playerDealtScale(false) : (body.damageScale ?? 1);
          for (const target of targetsFor(body.team)) {
            if (distance(body.x, body.y, target.x, target.y) <= bw.radius + (target.radius ?? 20)) {
              strike(target, bw.damage * scale, "BURROW_ERUPT", { slow: 0.3, slowSeconds: 0.9 }, body.x, body.y, bw.arenaElement, bw.attackElement, false, { guardBreak: true });
              target.airZ = Math.max(target.airZ ?? 0, 76);
              const dx = target.x - body.x, dy = target.y - body.y, d = Math.hypot(dx, dy) || 1;
              launch(target, dx / d, dy / d, 280);
            }
          }
          emit({ type: "BURROW_ERUPT", side: body === player ? "player" : "rival", moveId: bw.moveId, x: body.x, y: body.y, angle: bw.angle });
        }
      }
    }
    if ((body.vortexHeld ?? 0) > 0) body.vortexHeld = Math.max(0, body.vortexHeld - DT);
    if (!body.leapSlam && !(body.tkHeld > 0) && !(body.vortexHeld > 0) && body.airZ > 0) {
      const grabbedByOther = (body === player ? state.rivals : [player]).some((o) => o.grabSlam?.target === body || o.tkSlam?.target === body);
      if (!grabbedByOther) body.airZ = Math.max(0, body.airZ - 420 * DT);
    }
  }
  /** Advance a push. Solids stop it; a fast stop is a wall slam. Water does not stop it. */
  function stepKnock(body) {
    const speed = Math.hypot(body.kbx ?? 0, body.kby ?? 0);
    if (speed < 1) { body.kbx = body.kby = 0; return; }
    const x0 = body.x, y0 = body.y;
    moveBody(body, body.kbx * DT, body.kby * DT, "forced");
    const moved = Math.hypot(body.x - x0, body.y - y0);
    if (speed >= DATA_ARENA_ENERGY.slamSpeed && moved < speed * DT * 0.5) {
      const amount = Math.max(DATA_ARENA_ENERGY.slamMin, body.maxHp * DATA_ARENA_ENERGY.slamShare);
      body.kbx = body.kby = 0;
      if (body === player) hurtPlayer(amount, "SLAM", player.x, player.y);
      else if (body.rival) { damageRival(body, amount, "SLAM"); addHype("WALL_SLAM", body.x, body.y); }
      emit({ type: "WALL_SLAM", target: body === player ? "player" : "rival", x: body.x, y: body.y, amount: Math.round(amount) });
      return;
    }
    // RELAY slides further (PB: a struck body is pushed a visible distance, 2026-11-27 blind review).
    const decay = Math.exp(-(relayMode ? 5.5 : 8) * DT);
    body.kbx *= decay; body.kby *= decay;
  }
  function moveBody(body, dx, dy, kind) {
    const radius = body.radius * 0.8;
    if (dx && !blocked(body.x + dx, body.y, radius, kind)) body.x += dx;
    else if (dx) body.vx *= 0.3;
    if (dy && !blocked(body.x, body.y + dy, radius, kind)) body.y += dy;
    else if (dy) body.vy *= 0.3;
  }

  // ------------------------------------------------------------------ crowd
  function addHype(source, x = player.x, y = player.y) {
    const last = state.crowd.lastBySource[source] ?? -Infinity;
    if (state.time - last < DATA_ARENA_CROWD.sourceCooldown) return;
    state.crowd.lastBySource[source] = state.time;
    emit({ type: "CROWD", source, x, y });
    chargeUlt(DATA_ARENA_ENERGY.ultPerCrowd);
    if (state.cheerTimer > 0 || state.cheerCooldown > 0) return;
    const window = state.crowd.window;
    while (window.length && state.time - window[0].t > DATA_ARENA_CROWD.windowSeconds) window.shift();
    const used = window.reduce((sum, entry) => sum + entry.gain, 0);
    const gain = Math.min((DATA_ARENA_CROWD.gains[source] ?? 0) * stat.hypeGain, Math.max(0, DATA_ARENA_CROWD.windowCap - used));
    if (gain <= 0) return;
    window.push({ t: state.time, gain });
    state.hype = Math.min(100, state.hype + gain);
    if (state.hype >= 100) {
      state.hype = 0;
      state.cheerTimer = DATA_ARENA_CROWD.cheerSeconds;
      state.cheers++;
      if (state.cheers <= DATA_ARENA_CROWD.cheerScoreCap) state.score += DATA_ARENA_CROWD.cheerScore;
      emit({ type: "CHEER", count: state.cheers });
    }
  }
  const lastChain = Object.create(null);
  function chain(kind, x, y) {
    // A sustained effect (a beam freezing water frame after frame) is one chain.
    if (state.time - (lastChain[kind] ?? -Infinity) < 1.2) return;
    lastChain[kind] = state.time;
    state.stats.chains++;
    emit({ type: "ELEMENT_CHAIN", kind, x, y });
    addHype("ELEMENT_CHAIN", x, y);
  }

  // ------------------------------------------------------------------ damage
  function hurtPlayer(amount, source, x, y, { guardBreak = false } = {}) {
    if (state.mode !== "PLAY" && state.mode !== "VICTORY_POSE") return false;
    if (player.state === "DOWNED" || player.state === "DEFEATED" || player.state === "FALLING") return false;
    if (player.state === "RIDING") { hurtMate(amount * DATA_ARENA_MATE.ride.damageShare, source, x, y); return true; }
    if (player.invulnerable > 0) return false;
    // Data Decoy absorbs hits until broken, shielding real HP & hitstun!
    if (relayMode && player.decoy && player.decoy.hp > 0 && source !== "BURN" && source !== "FIRE" && source !== "WATER" && source !== "WEATHER") {
      player.decoy.hp -= amount;
      emit({ type: "DECOY_HIT", side: "player", amount: Math.round(amount), remaining: Math.max(0, Math.round(player.decoy.hp)), x: player.x, y: player.y });
      if (player.decoy.hp <= 0) {
        player.decoy = null;
        emit({ type: "DECOY_BREAK", side: "player", x: player.x, y: player.y });
      }
      return false;
    }
    // 360-degree Protect Dome (RELAY BARRIER): blocks non-DOT attacks unless Guard-Break smashes through!
    if (relayMode && player.barrier > 0 && source !== "BURN" && source !== "FIRE" && source !== "WATER") {
      if (guardBreak) {
        player.barrier = 0;
        emit({ type: "GUARD_BROKEN", side: "player", x: player.x, y: player.y });
      } else {
        state.stats.barrierBlocks++;
        emit({ type: "GUARD_BLOCK", side: "player", amount: 0, dome: true, x: player.x, y: player.y });
        return false;
      }
    }
    amount *= playerTakenScale();
    if (player.tagShield > 0) amount *= 0.55;
    if (relayMode) {
      const attacker = state.rivals[0];
      amount *= statStageMultiplier(attacker?.atkStage ?? 0) / statStageMultiplier(player.defStage ?? 0);
      if (state.suddenDeath.multiplier > 1) amount *= state.suddenDeath.multiplier;
    }
    // Counter Riposte Stance: absorbs 70% damage and fires a 1.6x counter shockwave back!
    if (relayMode && player.counterTimer > 0 && source !== "BURN" && source !== "FIRE" && source !== "WATER") {
      player.counterTimer = 0;
      const reflected = Math.max(18, Math.round(amount * TACTICAL_CAPS.counterReflectMultiplier));
      amount *= TACTICAL_CAPS.counterDamageScale;
      const foe = state.rivals[0];
      emit({ type: "COUNTER_RIPOSTE", side: "player", reflected, x: player.x, y: player.y });
      if (foe && foe.active && foe.hp > 0 && distance(player.x, player.y, foe.x, foe.y) < 380) {
        damageRival(foe, reflected, "COUNTER");
        const d = distance(foe.x, foe.y, player.x, player.y) || 1;
        launch(foe, (foe.x - player.x) / d, (foe.y - player.y) / d, 300);
      }
    }
    let guarded = player.guardTimer > 0 && source !== "BURN" && source !== "FIRE" && source !== "WATER";
    if (guarded && guardBreak) {
      guarded = false;
      player.guardTimer = 0;
      player.guardCooldown = GUARD_RULES.missCooldown;
      emit({ type: "GUARD_BROKEN", side: "player", x: player.x, y: player.y });
    } else if (guarded) {
      amount *= GUARD_RULES.damageScale;
      player.guardBlocked = true;
      emit({ type: "GUARD_BLOCK", side: "player", amount: Math.round(amount), x: player.x, y: player.y });
    }
    // Burst evolution (relay): every hit on the fighter is scaled by both sides' burst and fills both gauges.
    amount = scaleArenaBurst(player, amount); chargeArenaBurst(player, amount);
    // Combat Wave 5: STURDY passive ability (earth) survives a lethal hit from >50% HP at 1 HP once per partner!
    const playerAbility = relayMode ? partnerAbilityFor(partner) : null;
    if (relayMode && playerAbility?.id === "STURDY" && !player.sturdyUsed && player.hp > player.maxHp * 0.5 && player.hp - amount <= 0) {
      player.sturdyUsed = true;
      amount = Math.max(0, player.hp - 1);
      player.invulnerable = Math.max(player.invulnerable ?? 0, 0.5);
      emit({ type: "ABILITY_PROC", side: "player", abilityId: "STURDY", x: player.x, y: player.y });
    }
    player.hp -= amount;
    chargeUlt(amount * DATA_ARENA_ENERGY.ultPerDamageTaken);
    state.stats.damageTaken += amount;
    player.invulnerable = guarded ? Math.min(DATA_ARENA_PLAYER.hitInvulnerable, 0.12) : DATA_ARENA_PLAYER.hitInvulnerable;
    player.hitFlash = 0.2;
    player.hurtTimer = guarded ? 0.1 : 0.23;
    const hdx = player.x - (Number.isFinite(x) ? x : player.x - player.facing);
    const hdy = player.y - (Number.isFinite(y) ? y : player.y);
    const hd = Math.hypot(hdx, hdy) || 1;
    player.hitDirX = hdx / hd;
    player.hitDirY = hdy / hd;
    if (relayMode && !guarded && source !== "BURN" && source !== "FIRE" && source !== "WATER" && source !== "WEATHER") {
      player.hitstun = Math.max(player.hitstun ?? 0, clamp(0.12 + amount / 1500, 0.12, 0.2));
    }
    state.lastHit = { target: "player", amount: Math.round(amount), source, guarded, hitstun: !guarded && relayMode, at: state.time };
    emit({ type: "PLAYER_HIT", amount, source, guarded, x: player.x, y: player.y, fromX: x, fromY: y });
    if (player.hp <= 0) {
      player.hp = 0;
      setPlayerState(player.revives > 0 ? "DOWNED" : "DEFEATED");
      laser.firing = false;
      emit({ type: "PLAYER_DOWN", revivesLeft: player.revives, x: player.x, y: player.y });
    }
    return true;
  }
  function healPlayer(amount) {
    if (player.state === "DOWNED" || player.state === "DEFEATED") return;
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + amount);
    if (player.hp > before) emit({ type: "PLAYER_HEAL", amount: Math.round(player.hp - before), x: player.x, y: player.y });
  }
  function hurtMate(amount, source, x, y) {
    if (mate.state === "DOWNED") return false;
    mate.hp -= amount;
    mate.hitFlash = 0.2;
    emit({ type: "MATE_HIT", amount, source, x: mate.x, y: mate.y });
    if (mate.hp <= 0) {
      mate.hp = 0;
      const wasRidden = mate.state === "RIDDEN";
      mate.state = "DOWNED"; mate.stateTime = 0; mate.downedTime = 0; mate.reviveProgress = 0; mate.surgeAim = null;
      emit({ type: "MATE_DOWN", x: mate.x, y: mate.y, wasRidden });
      if (wasRidden) dismount(true);
      // Downed in open water, the mate washes onto the nearest bank so a rescue is reachable.
      if (grid.surfaceAt(mate.x, mate.y) === "WATER") {
        const bank = grid.nearestSafeCell(mate.x, mate.y);
        if (bank) { mate.x = bank.x; mate.y = bank.y; mate.swimming = false; emit({ type: "MATE_WASHED_ASHORE", x: mate.x, y: mate.y }); }
      }
    }
    return true;
  }
  function damageEnemy(enemy, amount, cause, x = enemy.x, y = enemy.y) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.hitFlash = 0.12;
    if (enemy.hp <= 0) killEnemy(enemy, cause, x, y);
  }
  function killEnemy(enemy, cause) {
    enemy.dead = true;
    const def = DATA_ARENA_ENEMIES[enemy.kind];
    state.kills++;
    state.score += def.score;
    state.pickups.push({ id: nextId++, x: enemy.x, y: enemy.y, value: def.xp, age: 0 });
    emit({ type: "ENEMY_KILLED", kind: enemy.kind, cause, x: enemy.x, y: enemy.y });
    if (cause === "FIRE" || cause === "DROWN") chain(cause === "FIRE" ? "BURN" : "DROWN", enemy.x, enemy.y);
    state.killWindow.push(state.time);
    while (state.killWindow.length && state.time - state.killWindow[0] > 0.6) state.killWindow.shift();
    if (state.killWindow.length >= 3) { addHype("MULTI_KILL", enemy.x, enemy.y); state.killWindow.length = 0; }
  }
  function damageBoss(amount, cause) {
    const boss = state.boss;
    if (!boss || boss.state !== "FIGHT") return;
    const shielded = state.beacons.some((beacon) => !beacon.captured);
    boss.hp -= amount * (shielded ? 1 - DATA_ARENA_BOSS.shieldReduction : 1);
    boss.hitFlash = 0.1;
    if (!boss.enraged && boss.hp <= boss.maxHp * DATA_ARENA_BOSS.enrageShare) {
      boss.enraged = true;
      emit({ type: "BOSS_ENRAGE", x: boss.x, y: boss.y });
    }
    if (boss.hp <= 0) {
      boss.hp = 0; boss.state = "DOWN";
      state.score += DATA_ARENA_BOSS.score;
      emit({ type: "BOSS_DOWN", x: boss.x, y: boss.y, cause });
      addHype("BOSS_DOWN", boss.x, boss.y);
      state.telegraphs.length = 0;
      for (const projectile of state.projectiles) if (projectile.owner !== "mate") projectile.dead = true;
      for (const enemy of state.enemies) if (!enemy.dead) killEnemy(enemy, "BOSS_DOWN");
      state.mode = "VICTORY_POSE";
      state.endTimer = 2.2;
      state.victoryAt = state.time;
    }
  }

  // ------------------------------------------------------------------ player
  function setPlayerState(next) { player.state = next; player.stateTime = 0; }

  function startDash(input) {
    let dx = input.moveX, dy = input.moveY;
    if (!dx && !dy) { dx = Math.cos(laser.angle); dy = Math.sin(laser.angle); }
    const length = Math.hypot(dx, dy) || 1;
    player.dashDirX = dx / length; player.dashDirY = dy / length;
    // Plan A (PbRank rhythm): crisp 0.26 s invulnerable evasive roll in unified RELAY V2 mode.
    player.dashTimer = v2Mode ? 0.20 : DATA_ARENA_PLAYER.dash.duration;
    player.dashGrace = v2Mode ? 0.26 : DATA_ARENA_PLAYER.dash.invulnerable;
    player.invulnerable = Math.max(player.invulnerable, player.dashGrace);
    player.dashCharges--;
    if (player.dashRecharge <= 0) player.dashRecharge = dashCooldown;
    player.perfectThisDash = false;
    player.dashHits.clear();
    laser.firing = false;
    setPlayerState("DASH");
    emit({ type: "DASH", x: player.x, y: player.y, dirX: player.dashDirX, dirY: player.dashDirY });
  }

  /** A shot or hazard reached the player while the dash grace protects them. */
  function perfectDodge(x, y) {
    if (player.perfectThisDash) return;
    player.perfectThisDash = true;
    state.stats.perfectDodges++;
    emit({ type: "PERFECT_DODGE", x: player.x, y: player.y, fromX: x, fromY: y });
    addHype("PERFECT_DODGE", player.x, player.y);
    if (stat.perfectRefund) {
      player.dashCharges = Math.min(stat.dashCharges, player.dashCharges + 1);
      laser.heat = Math.max(0, laser.heat - 30);
    }
  }

  function startFall() {
    if (player.canSwim || ["FALLING","DOWNED","DEFEATED"].includes(player.state)) return;
    player.lunge=null;player.cast=null;player.kbx=player.kby=player.vx=player.vy=0;player.dashTimer=0;
    removeTelegraph(`cast:${player.id}`);
    player.fallFromX = player.x; player.fallFromY = player.y;
    laser.firing = false;
    setPlayerState("FALLING");
    state.stats.falls++;
    emit({ type: "FELL_IN_WATER", x: player.x, y: player.y });
  }

  function finishFall() {
    const safe = grid.nearestSafeCell(player.x, player.y) ?? playerSpawn;
    player.x = safe.x; player.y = safe.y; player.vx = 0; player.vy = 0;
    player.hp = Math.max(1, player.hp - DATA_ARENA_PLAYER.fall.damage);
    player.invulnerable = DATA_ARENA_PLAYER.fall.invulnerable;
    setPlayerState("NORMAL");
    emit({ type: "RECOVERED", x: player.x, y: player.y, fromX: player.fallFromX, fromY: player.fallFromY });
  }

  function tryMount() {
    if (!hasMate || mate.state === "DOWNED" || mate.state === "RIDDEN") return false;
    if (distance(player.x, player.y, mate.x, mate.y) > DATA_ARENA_MATE.ride.reach) {
      emit({ type: "RIDE_REFUSED", reason: "TOO_FAR", x: player.x, y: player.y });
      return false;
    }
    setPlayerState("MOUNTING");
    mate.state = "RIDDEN"; mate.stateTime = 0; mate.vx = 0; mate.vy = 0;
    state.stats.rides++;
    emit({ type: "MOUNT_START", x: mate.x, y: mate.y });
    return true;
  }

  /** Leave the mount. Over open water: hop to a bank within reach, else fall in safely. */
  function dismount(thrown = false) {
    if (player.state !== "RIDING" && player.state !== "MOUNTING") return;
    if (mate.state === "RIDDEN") { mate.state = "FOLLOW"; mate.stateTime = 0; }
    const surface = grid.surfaceAt(player.x, player.y);
    if (surface === "WATER" && !player.canSwim) {
      const safe = grid.nearestSafeCell(player.x, player.y);
      if (!thrown && safe && distance(safe.x, safe.y, player.x, player.y) <= DATA_ARENA_MATE.ride.hopReach) {
        player.x = safe.x; player.y = safe.y;
        player.invulnerable = Math.max(player.invulnerable, 0.3);
        setPlayerState("NORMAL");
        emit({ type: "DISMOUNT", mode: "HOP", x: player.x, y: player.y });
      } else {
        emit({ type: "DISMOUNT", mode: thrown ? "THROWN" : "INTO_WATER", x: player.x, y: player.y });
        startFall();
      }
      return;
    }
    // On land: step off beside the mount.
    const side = player.facing >= 0 ? 1 : -1;
    const offX = player.x + side * 34;
    if (!blocked(offX, player.y + 10, player.radius * 0.8, movementKind(player))) player.x = offX;
    player.y += 10;
    player.invulnerable = Math.max(player.invulnerable, thrown ? 1.0 : 0.2);
    setPlayerState("NORMAL");
    emit({ type: "DISMOUNT", mode: thrown ? "THROWN" : "LAND", x: player.x, y: player.y });
  }

  function updatePlayer(input) {
    player.stateTime += DT;
    player.invulnerable = Math.max(0, player.invulnerable - DT);
    player.dashGrace = Math.max(0, player.dashGrace - DT);
    player.hitFlash = Math.max(0, player.hitFlash - DT);
    if (player.dashCharges < stat.dashCharges) {
      player.dashRecharge -= DT;
      if (player.dashRecharge <= 0) {
        player.dashCharges++;
        player.dashRecharge = player.dashCharges < stat.dashCharges ? dashCooldown : 0;
        emit({ type: "DASH_READY", charges: player.dashCharges });
      }
    }
    if (input.aimX !== null && Number.isFinite(input.aimX)) {
      const target = Math.atan2(input.aimY - player.y, input.aimX - player.x);
      const delta = wrapAngle(target - laser.angle), maxTurn = DATA_ARENA_PLAYER.laser.turnRate * DT;
      laser.angle = wrapAngle(laser.angle + clamp(delta, -maxTurn, maxTurn));
    }
    const cos = Math.cos(laser.angle);
    if (Math.abs(cos) > 0.15) player.facing = cos >= 0 ? 1 : -1;

    switch (player.state) {
      case "NORMAL": {
        if (player.lunge || player.flurry || player.backstab) break; // active martial-arts motion owns movement
        if (player.approach) {
          if (Math.hypot(input.moveX, input.moveY) > 0.25 && state.controlMode === "MANUAL") player.approach = null;
          else break;
        }
        const speed = stat.speed * moveScale(player);
        const tx = input.moveX * speed, ty = input.moveY * speed;
        const k = Math.min(1, DT * 14);
        player.vx += (tx - player.vx) * k; player.vy += (ty - player.vy) * k;
        if (player.hitstun > 0) player.vx = player.vy = 0; // staggered: no walking drift; knockback is separate
        moveBody(player, player.vx * DT, player.vy * DT, movementKind(player));
        if (input.ride) { if (tryMount()) break; }
        if (input.guard) tryStartGuard(player);
        if (input.tactical && relayMode) {
          const explicit = !input.autoAim && Number.isFinite(input.aimX) && Number.isFinite(input.aimY);
          tryStartTacticalArt(player, null, { aimX: explicit ? input.aimX : null, aimY: explicit ? input.aimY : null, fromPlayerPress: true });
        } else if (player.tacticalBuffer && relayMode) {
          player.tacticalBuffer.ttl -= DT;
          if (canUseTacticalArt(player)) {
            const buf = player.tacticalBuffer;
            player.tacticalBuffer = null;
            tryStartTacticalArt(player, null, { aimX: buf.aimX, aimY: buf.aimY });
          } else if (player.tacticalBuffer.ttl <= 0) {
            player.tacticalBuffer = null;
          }
        }
        if (input.dash && player.dashCharges > 0 && player.root <= 0 && player.guardTimer <= 0) {
          if (player.cast) { removeTelegraph(`cast:${player.id}`); player.cast = null; } // a dash cancels a windup
          startDash(input); break;
        }
        if (grid.surfaceAt(player.x, player.y) === "WATER") startFall();
        break;
      }
      case "DASH": {
        const dashSpeed = v2Mode ? 1050 : DATA_ARENA_PLAYER.dash.speed;
        const step = dashSpeed * DT;
        moveBody(player, player.dashDirX * step, player.dashDirY * step, movementKind(player));
        player.vx = player.dashDirX * stat.speed; player.vy = player.dashDirY * stat.speed;
        if (stat.dashDamage > 0) {
          for (const enemy of state.enemies) {
            if (enemy.dead || player.dashHits.has(enemy.id)) continue;
            if (distance(enemy.x, enemy.y, player.x, player.y) <= enemy.radius + player.radius) {
              player.dashHits.add(enemy.id);
              damageEnemy(enemy, stat.dashDamage, "DASH");
            }
          }
        }
        player.dashTimer -= DT;
        if (player.dashTimer <= 0) {
          setPlayerState("NORMAL");
          if (grid.surfaceAt(player.x, player.y) === "WATER") startFall();
        }
        break;
      }
      case "MOUNTING": {
        const k = Math.min(1, player.stateTime / DATA_ARENA_MATE.ride.mount);
        player.x += (mate.x - player.x) * k; player.y += (mate.y - player.y) * k;
        if (mate.state !== "RIDDEN") { setPlayerState("NORMAL"); break; }
        if (player.stateTime >= DATA_ARENA_MATE.ride.mount) {
          player.x = mate.x; player.y = mate.y;
          setPlayerState("RIDING");
          emit({ type: "MOUNTED", x: mate.x, y: mate.y });
        }
        break;
      }
      case "RIDING": {
        const onWater = grid.surfaceAt(mate.x, mate.y) === "WATER";
        const speed = (onWater ? DATA_ARENA_MATE.rideSpeedWater : DATA_ARENA_MATE.rideSpeedLand) * (1 + upgradeValue(upgrades, "speed") * 0.5);
        const k = Math.min(1, DT * 9);
        mate.vx += (input.moveX * speed - mate.vx) * k; mate.vy += (input.moveY * speed - mate.vy) * k;
        moveBody(mate, mate.vx * DT, mate.vy * DT, "swimmer");
        mate.swimming = grid.surfaceAt(mate.x, mate.y) === "WATER";
        if (Math.abs(mate.vx) > 8) mate.facing = mate.vx > 0 ? 1 : -1;
        player.x = mate.x; player.y = mate.y; player.vx = mate.vx; player.vy = mate.vy;
        if (input.ride || input.dash) dismount(false);
        break;
      }
      case "FALLING":
        if (player.stateTime >= DATA_ARENA_PLAYER.fall.sink) finishFall();
        break;
      case "DOWNED":
        if (player.stateTime >= DATA_ARENA_PLAYER.respawn.delay) {
          const anchor = hasMate && mate.state !== "DOWNED" ? mate : playerSpawn;
          const safe = grid.nearestSafeCell(anchor.x, anchor.y + 40) ?? playerSpawn;
          player.x = safe.x; player.y = safe.y; player.vx = 0; player.vy = 0;
          player.revives--;
          player.hp = Math.round(player.maxHp * DATA_ARENA_PLAYER.respawn.hpShare);
          player.invulnerable = DATA_ARENA_PLAYER.respawn.invulnerable;
          laser.heat = 0; laser.overheated = false;
          setPlayerState("NORMAL");
          emit({ type: "PLAYER_RESPAWN", x: player.x, y: player.y, revivesLeft: player.revives });
        }
        break;
      case "DEFEATED":
        // In the tournament the round flow decides what a knockout means.
        if (!tournamentMode && player.stateTime >= 1.6 && !state.result) finish("DEFEAT");
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ kits (player and rivals)
  const isRival = (body) => body && body.rival === true;
  const hostileTo = (team) => (team === "player" ? "rival" : "player");

  function chargeUlt(amount) {
    if (state.mode !== "PLAY") return;
    const before = player.ult;
    player.ult = Math.min(DATA_ARENA_ENERGY.ultMax, player.ult + amount * stat.ultGain);
    if (before < DATA_ARENA_ENERGY.ultMax && player.ult >= DATA_ARENA_ENERGY.ultMax) emit({ type: "ULT_READY" });
  }

  /** Bodies a caster's attacks may hit (enemies, guardian and rivals for the player; the player for rivals). */
  function targetsFor(team) {
    if (team !== "player") return player.state === "DOWNED" || player.state === "DEFEATED" || player.state === "FALLING" ? [] : [player];
    const list = [];
    for (const enemy of state.enemies) if (!enemy.dead) list.push(enemy);
    for (const rival of state.rivals) if (rival.hp > 0 && rival.active) list.push(rival);
    if (state.boss && state.boss.state === "FIGHT") list.push(state.boss);
    return list;
  }

  function hasSight(x0, y0, x1, y1) {
    const d = distance(x0, y0, x1, y1);
    if (d < 1) return true;
    return grid.raycast(x0, y0, (x1 - x0) / d, (y1 - y0) / d, d) >= d - 1;
  }

  /** Nearest hostile within range with a clear path (pillars block it); else straight ahead. */
  function autoAim(caster, range) {
    let best = null, bestD = range;
    for (const target of targetsFor(caster.team)) {
      const d = distance(target.x, target.y, caster.x, caster.y);
      if (d < bestD && hasSight(caster.x, caster.y, target.x, target.y)) { best = target; bestD = d; }
    }
    if (best) return { x: best.x, y: best.y, target: best };
    const angle = caster === player ? laser.angle : caster.facing >= 0 ? 0 : Math.PI;
    return { x: caster.x + Math.cos(angle) * 200, y: caster.y + Math.sin(angle) * 200, target: null };
  }

  /** Apply damage from a kit attack to whatever body it struck. */
  function strike(target, amount, cause, onHit, x = target.x, y = target.y, element = null, attackElement = null, isBasic = false, { guardBreak = false, moveId = null, move = null } = {}) {
    // Owner 2026-10-29: an elemental hit uses the caster's taxonomy element on the dual ring (x1.5 / x0.75).
    const mult = relayMode && element ? taxonomyMultiplier(attackElement, target) : 1;
    amount *= mult;
    if (relayMode && state.weather.kind && element) amount *= weatherDamageMultiplier(state.weather.kind, element);
    // Burn weakens attacker's outgoing damage by 15%
    const attackerBody = target === player ? state.rivals[0] : (isRival(target) ? player : null);
    if (relayMode && attackerBody && (attackerBody.burn ?? 0) > 0) amount *= AILMENT_RULES.burnAtkScale;
    // Combat Wave 5: Passive Abilities (FLASH_FIRE / WATER_ABSORB / VOLT_ABSORB / THICK_FAT / GUTS / INTIMIDATE)
    const canonicalHit = normalizeCanonicalElement(element ?? attackElement, moveId);
    if (relayMode && attackerBody) {
      if ((attackerBody.intimidateTimer ?? 0) > 0) amount *= 0.85;
      const atkAb = partnerAbilityFor(attackerBody === player ? partner : attackerBody);
      if (atkAb?.id === "GUTS" && ((attackerBody.burn ?? 0) > 0 || (attackerBody.poison ?? 0) > 0 || (attackerBody.slow ?? 0) > 0 || (attackerBody.paralyze ?? 0) > 0)) {
        amount *= 1.22;
      }
    }
    if (relayMode && target && target.hp > 0 && amount > 0 && cause !== "BURN" && cause !== "WEATHER") {
      const defAb = partnerAbilityFor(target === player ? partner : target);
      const defSide = target === player ? "player" : "rival";
      const cdReady = (target.abilityCooldown ?? 0) <= 0;
      if (defAb?.id === "WATER_ABSORB" && canonicalHit === "WATER" && cdReady) {
        target.abilityCooldown = 8.0;
        const healAmt = Math.max(1, Math.round(target.maxHp * 0.1));
        target.hp = Math.min(target.maxHp, target.hp + healAmt);
        emit({ type: "ABILITY_PROC", side: defSide, abilityId: "WATER_ABSORB", amount: healAmt, x: target.x, y: target.y });
        return false;
      }
      if (defAb?.id === "VOLT_ABSORB" && (canonicalHit === "THUNDER" || canonicalHit === "WIND") && cdReady) {
        target.abilityCooldown = 8.0;
        target.energy = Math.min(DATA_ARENA_RELAY.tpMax, (target.energy ?? 0) + 22);
        target.spdStage = Math.min(2, (target.spdStage ?? 0) + 1);
        emit({ type: "ABILITY_PROC", side: defSide, abilityId: "VOLT_ABSORB", amount: 22, x: target.x, y: target.y });
        return false;
      }
      if (defAb?.id === "FLASH_FIRE" && canonicalHit === "FIRE") {
        amount *= 0.65;
        if (!target.flashFireBoosted) {
          target.flashFireBoosted = true;
          target.atkStage = Math.min(2, (target.atkStage ?? 0) + 1);
          emit({ type: "ABILITY_PROC", side: defSide, abilityId: "FLASH_FIRE", x: target.x, y: target.y });
        }
      } else if (defAb?.id === "THICK_FAT" && (canonicalHit === "FIRE" || canonicalHit === "ICE")) {
        amount *= 0.75;
      }
    }
    // Cross-ring physical-chemistry combatant status reactions (6 ailments + wet): follow the move's element first!
    const reactions = [];
    if (relayMode && target && target.hp > 0) {
      if ((target.sleep ?? 0) > 0 && amount > 0) {
        target.sleep = 0;
        target.ccImmune = Math.max(target.ccImmune ?? 0, AILMENT_RULES.ccImmunitySeconds);
        amount *= AILMENT_RULES.wakeSlapMultiplier;
        reactions.push({ kind: "WAKE_SLAP", bonus: Math.round(amount * 0.26), paletteKey: "light" });
      }
      if ((target.root ?? 0) > 0) {
        if (canonicalHit === "FIRE" || canonicalHit === "SUN") {
          target.root = 0;
          target.ccImmune = Math.max(target.ccImmune ?? 0, AILMENT_RULES.ccImmunitySeconds);
          amount *= AILMENT_RULES.meltMultiplier;
          reactions.push({ kind: "MELT", bonus: Math.round(amount * 0.26), paletteKey: "fire" });
        } else if (guardBreak || canonicalHit === "METAL" || canonicalHit === "EARTH") {
          target.root = 0;
          target.ccImmune = Math.max(target.ccImmune ?? 0, AILMENT_RULES.ccImmunitySeconds);
          amount *= AILMENT_RULES.shatterCritMultiplier;
          reactions.push({ kind: "SHATTER_CRIT", bonus: Math.round(amount * 0.26), paletteKey: "ice" });
        }
      }
      if ((target.burn ?? 0) > 0 && (canonicalHit === "WATER" || canonicalHit === "ICE")) {
        target.burn = 0;
        amount += AILMENT_RULES.steamBurstBonus;
        reactions.push({ kind: "STEAM", bonus: AILMENT_RULES.steamBurstBonus, paletteKey: "water" });
      }
      if ((target.poison ?? 0) > 0 && canonicalHit === "FIRE") {
        const stacks = Math.max(1, target.poisonStacks ?? 1);
        const blast = AILMENT_RULES.toxicBlastBonus + (stacks - 1) * 10;
        target.poison = 0;
        target.poisonStacks = 0;
        amount += blast;
        reactions.push({ kind: "TOXIC_BLAST", bonus: blast, paletteKey: "fire" });
      }
      if ((target.wet ?? 0) > 0 && canonicalHit === "ICE" && !(target.root > 0)) {
        target.wet = 0;
        reactions.push({ kind: "FLASH_FREEZE", bonus: 12, paletteKey: "ice", forceStatus: { root: AILMENT_RULES.freezeSeconds } });
        amount += 12;
      }
      if (((target.paralyze ?? 0) > 0 && (canonicalHit === "WATER" || canonicalHit === "ICE"))
        || ((target.wet ?? 0) > 0 && canonicalHit === "THUNDER")) {
        target.wet = 0;
        amount += AILMENT_RULES.electroChargeBonus;
        reactions.push({ kind: "ELECTRO_CHARGE", bonus: AILMENT_RULES.electroChargeBonus, paletteKey: "thunder", forceStatus: { paralyze: AILMENT_RULES.paralyzeSeconds } });
      }
    }
    // Rift resonance: a player hit on a rival may land critical (x1.5) one time in ten.
    if (relayMode && isRival(target) && resonant('RIFT') && random() < TAXONOMY_RESONANCE.RIFT.critChancePercent / 100) { amount *= 1.5; emit({ type: 'RESONANCE_CRIT', x, y }); }
    const effectiveOnHit = onHit ?? (relayMode && v2Mode && !isBasic && (moveId || element || attackElement)
      ? inferMoveAilment(moveId, element, attackElement, move, { isBasic })
      : null);
    if (target === player) {
      const applied=hurtPlayer(amount, cause, x, y, { guardBreak });
      if (applied && relayMode) {
        relayAfterHit(player, amount, element, mult, x, y);
        for (const rx of reactions) {
          emit({ type: "STATUS_REACT", kind: rx.kind, bonus: rx.bonus, paletteKey: rx.paletteKey, target: "player", x: player.x, y: player.y });
          if (rx.kind === "MELT") emit({ type: "STATUS_CLEARED", status: "ROOT", by: "fire", x: player.x, y: player.y });
          if (rx.kind === "STEAM") chain("STEAM", player.x, player.y);
          if (rx.forceStatus) applyStatus(player, rx.forceStatus);
        }
      }
      if (applied && effectiveOnHit) applyStatus(player, effectiveOnHit);
      return applied;
    }
    if (isRival(target)) {
      const applied=damageRival(target, amount, cause, { guardBreak });
      if(relayMode&&!applied)return false;
      if (relayMode) {
        if (isBasic) player.energy = Math.min(DATA_ARENA_RELAY.tpMax, player.energy + (DATA_ARENA_RELAY.basicTpGain ?? 5));
        relayAfterHit(target, amount, element, mult, x, y);
        for (const rx of reactions) {
          emit({ type: "STATUS_REACT", kind: rx.kind, bonus: rx.bonus, paletteKey: rx.paletteKey, target: "rival", x: target.x, y: target.y });
          if (rx.kind === "MELT") emit({ type: "STATUS_CLEARED", status: "ROOT", by: "fire", x: target.x, y: target.y });
          if (rx.kind === "STEAM") chain("STEAM", target.x, target.y);
          if (rx.forceStatus) applyStatus(target, rx.forceStatus);
        }
      }
    }
    else if (target === state.boss) damageBoss(amount, cause);
    else damageEnemy(target, amount, cause, x, y);
    if (effectiveOnHit && !target.dead) applyStatus(target, effectiveOnHit);
    state.combo.count++;
    state.combo.timer = 2.6;
    if (state.combo.count > state.combo.max) state.combo.max = state.combo.count;
    if (state.combo.count >= 2) emit({ type: "COMBO_HIT", count: state.combo.count, x, y });
    chargeUlt(amount * DATA_ARENA_ENERGY.ultPerDamageDealt);
    return true;
  }

  // RELAY stage four (2026-10-28): what a landed hit does beyond its damage.
  //  - hitstun 0.10-0.20 s (by damage) pauses the target's windup and walking;
  //  - fire thaws a root, frost puts a burn out (a steam chain);
  //  - an effective or resisted matchup is announced.
  function relayAfterHit(target, amount, element, mult, x, y) {
    const guarded = (target.guardTimer ?? 0) > 0;
    if (amount > 0 && !guarded) target.hitstun = Math.max(target.hitstun ?? 0, clamp(0.1 + amount / 400, 0.1, 0.2));
    if (element === 'fire' && target.root > 0) { target.root = 0; emit({ type: 'STATUS_CLEARED', status: 'ROOT', by: 'fire', x: target.x, y: target.y }); }
    if (element === 'frost' && target.burn > 0) { target.burn = 0; chain('STEAM', target.x, target.y); }
    if (mult !== 1) emit({ type: 'EFFECTIVE', mult, element, target: target === player ? 'player' : 'rival', x: target.x, y: target.y });
  }

  function applyStatus(body, effect) {
    if (!body || !effect) return;
    let applied = null;
    if (effect.wet) {
      body.wet = Math.max(body.wet ?? 0, effect.wet);
      if ((body.burn ?? 0) > 0) { body.burn = 0; emit({ type: "STATUS_CLEARED", status: "BURN", by: "water", x: body.x, y: body.y }); }
    }
    if (effect.slow) {
      body.slow = Math.max(body.slow ?? 0, effect.slow);
      body.slowTimer = Math.max(body.slowTimer ?? 0, effect.slowSeconds ?? 1.5);
      applied = applied ?? "SLOW";
    }
    if (effect.sleep) {
      if ((body.ccImmune ?? 0) <= 0) {
        body.sleep = Math.max(body.sleep ?? 0, effect.sleep);
        if (body.cast) { removeTelegraph(`cast:${body.id}`); body.cast = null; }
        body.lunge = null; body.approach = null;
        applied = "SLEEP";
      }
    }
    if (effect.root) {
      if ((body.ccImmune ?? 0) <= 0 || !relayMode) {
        body.root = Math.max(body.root ?? 0, effect.root);
        applied = applied ?? "ROOT";
      }
    }
    if (effect.paralyze) {
      const was = (body.paralyze ?? 0) > 0;
      body.paralyze = Math.max(body.paralyze ?? 0, effect.paralyze);
      if (!was) body.paralyzeTick = AILMENT_RULES.paralyzeTwitchInterval * 0.65;
      applied = applied ?? "PARALYZE";
    }
    if (effect.poison) {
      body.poison = Math.max(body.poison ?? 0, effect.poison);
      body.poisonStacks = Math.min(AILMENT_RULES.poisonMaxStacks, (body.poisonStacks ?? 0) + (effect.poisonStacks ?? 1));
      applied = applied ?? "POISON";
    }
    if (effect.burn) {
      if ((body.wet ?? 0) > 0) { body.wet = 0; }
      body.burn = Math.max(body.burn ?? 0, effect.burn);
      applied = applied ?? "BURN";
    }
    if (applied) {
      emit({
        type: "STATUS",
        status: applied,
        stacks: applied === "POISON" ? (body.poisonStacks ?? 1) : 1,
        x: body.x,
        y: body.y,
        target: body === player ? "PLAYER" : "HOSTILE"
      });
    }
  }

  function tickStatus(body) {
    if (body.hitstun > 0) body.hitstun = Math.max(0, body.hitstun - DT);
    if ((body.ccImmune ?? 0) > 0) body.ccImmune = Math.max(0, body.ccImmune - DT);
    if ((body.wet ?? 0) > 0) body.wet = Math.max(0, body.wet - DT);
    if (body.slowTimer > 0) { body.slowTimer -= DT; if (body.slowTimer <= 0) body.slow = 0; }
    if ((body.sleep ?? 0) > 0) {
      body.sleep = Math.max(0, body.sleep - DT);
      if (body.sleep <= 0) body.ccImmune = Math.max(body.ccImmune ?? 0, AILMENT_RULES.ccImmunitySeconds);
    }
    if (body.root > 0) {
      body.root = Math.max(0, body.root - DT);
      if (body.root <= 0 && relayMode) body.ccImmune = Math.max(body.ccImmune ?? 0, AILMENT_RULES.ccImmunitySeconds);
    }
    if ((body.paralyze ?? 0) > 0) {
      body.paralyze = Math.max(0, body.paralyze - DT);
      body.paralyzeTick = (body.paralyzeTick ?? AILMENT_RULES.paralyzeTwitchInterval) - DT;
      if (body.paralyzeTick <= 0 && body.paralyze > 0) {
        body.paralyzeTick = AILMENT_RULES.paralyzeTwitchInterval;
        body.hitstun = Math.max(body.hitstun ?? 0, AILMENT_RULES.paralyzeTwitchStun);
        if (body.cast) { removeTelegraph(`cast:${body.id}`); body.cast = null; }
        emit({ type: "PARALYZE_TWITCH", side: body === player ? "player" : "rival", x: body.x, y: body.y });
      }
    }
    if ((body.poison ?? 0) > 0) {
      body.poison = Math.max(0, body.poison - DT);
      const stacks = clamp(body.poisonStacks ?? 1, 1, AILMENT_RULES.poisonMaxStacks);
      const share = AILMENT_RULES.poisonHpSharePerSec[stacks] ?? 0.014;
      const dps = Math.max(4, (body.maxHp ?? 200) * share) * DT;
      if (body === player) { if (player.invulnerable <= 0) { player.hp = Math.max(1, player.hp - dps); state.stats.damageTaken += dps; chargeArenaBurst(player, dps); } }
      else if (isRival(body)) damageRival(body, dps, "BURN");
      else if (body !== state.boss) damageEnemy(body, dps, "POISON");
      if (body.poison <= 0) body.poisonStacks = 0;
    }
    if (body.burn > 0) {
      body.burn = Math.max(0, body.burn - DT);
      const dps = AILMENT_RULES.burnDps * DT;
      if (body === player) { if (player.invulnerable <= 0) { player.hp = Math.max(1, player.hp - dps); state.stats.damageTaken += dps; chargeArenaBurst(player, dps); } }
      else if (isRival(body)) damageRival(body, dps, "BURN");
      else if (body !== state.boss) damageEnemy(body, dps, "FIRE");
    }
  }
  const moveScale = (body) => ((body.root > 0 || (body.sleep ?? 0) > 0) ? 0 : 1 - (body.slow ?? 0))
    * ((body.paralyze ?? 0) > 0 ? AILMENT_RULES.paralyzeMoveScale : 1)
    * (body.cast ? (body === player ? DATA_ARENA_ENERGY.playerCastMove : DATA_ARENA_ENERGY.rivalCastMove) : 1)
    * (relayArena?.speedScale(body) ?? 1) * (body.hitstun > 0 ? 0 : 1) * (relayMode ? speedStageMultiplier(body.spdStage ?? 0) : 1);

  function kitMoveIds(caster) { return caster.kit.moves; }

  function canCast(caster, moveId) {
    const move = moveFor(moveId);
    if (!move || caster.cast || caster.lunge || (caster.sleep ?? 0) > 0 || (relayMode && (caster.root > 0 || caster.recovery > 0))) return false;
    if ((caster.cooldowns[moveId] ?? 0) > 0) return false;
    return caster.energy >= (move.energy ?? 0);
  }

  /** Begin a cast: spend energy, start the cooldown, show the windup telegraph. */
  function beginCast(caster, moveId, aimX, aimY, { ultimate = false } = {}) {
    const move = moveFor(moveId, ultimate);
    if (!ultimate && !canCast(caster, moveId)) return false;
    if (ultimate && (caster.cast || caster.lunge || (relayMode && (caster.recovery > 0 || caster.energy < move.energy || (caster.cooldowns[moveId] ?? 0) > 0)))) return false;
    const angle = Math.atan2(aimY - caster.y, aimX - caster.x);
    const range = move.range ?? move.distance ?? 0;
    const reach = Math.min(range || Infinity, distance(aimX, aimY, caster.x, caster.y));
    const targetX = move.type === "ZONE" ? caster.x + Math.cos(angle) * Math.min(reach, range) : aimX;
    const targetY = move.type === "ZONE" ? caster.y + Math.sin(angle) * Math.min(reach, range) : aimY;
    if (relayMode && move.type === 'ZONE' && !hasSight(caster.x, caster.y, targetX, targetY)) return false;
    if (ultimate && !relayMode) caster.ult = 0;
    else {
      caster.energy -= move.energy ?? 0;
      if(!relayMode||(move.energy??0)>0)caster.energySpentAt = state.time;
      // A burst 時輪 bloodline shortens its cooldowns (awakening raising, 2026-11-02).
      const castBurst = relayMode && caster === player ? burstOfBody(player) : null;
      const scale = caster === player ? stat.cooldownScale * (resonant('IRON') ? TAXONOMY_RESONANCE.IRON.cooldownPercent / 100 : 1)
        * (castBurst?.phase === 'BURST' ? castBurst.cooldownScale / (castBurst.overLimit ? 1 + OVER_LIMIT_RULES.speedBonus : 1) : 1) : 1;
      const barrierPenalty = relayMode && move.type === "BARRIER" ? (caster.barrierStreak ?? 0) * GUARD_RULES.barrierEscalateStep : 0;
      if (relayMode && move.type === "BARRIER") caster.barrierStreak = Math.min(GUARD_RULES.maxBarrierEscalate, (caster.barrierStreak ?? 0) + 1);
      caster.cooldowns[moveId] = (move.cooldown ?? 0) * scale + barrierPenalty;
    }
    caster.cast = { actionId: nextActionId++, moveId, move, t: 0, windup: move.windup ?? 0, angle, aimX: targetX, aimY: targetY, ultimate };
    caster.facing = Math.cos(angle) >= 0 ? 1 : -1;
    if (relayMode) {
      caster.facing8 = relayFacing8(angle);
      caster.action = { id: caster.cast.actionId, moveId, startedAt: state.time, releasedAt: null, windup: move.windup, recovery: move.recovery, angle, ultimate: Boolean(ultimate) };
    }
    if (caster === player) { state.stats.movesCast++; if (ultimate) state.stats.ultimates++; }
    const telegraph = { owner: `cast:${caster.id}`, team: caster.team, moveId, duration: Math.max(0.12, move.windup ?? 0), follow: null };
    if (move.type === "BOLT" || move.type === "WAVE") addTelegraph({ ...telegraph, kind: "LINE", x: caster.x, y: caster.y, angle, length: move.range, width: move.radius * 2 });
    else if (move.type === "SPREAD" || move.type === "LANCE") addTelegraph({ ...telegraph, kind: "CONE", x: caster.x, y: caster.y, angle, spread: move.spread, length: Math.min(move.range, 520), count: move.count });
    else if (move.type === "LUNGE") addTelegraph({ ...telegraph, kind: "LINE", x: caster.x, y: caster.y, angle, length: move.distance, width: move.width });
    else if (move.type === "ZONE") addTelegraph({ ...telegraph, kind: "CIRCLE", x: targetX, y: targetY, radius: move.radius, danger: caster.team !== "player" });
    else if (move.type === "NOVA") addTelegraph({ ...telegraph, kind: "CIRCLE", x: caster.x, y: caster.y, radius: move.radius, danger: caster.team !== "player" });
    emit({ type: ultimate ? "ULT_CAST" : "CAST", actionId: caster.cast.actionId, casterId: caster.id, team: caster.team, moveId, moveType: move.type, windup: move.windup, recovery: move.recovery, x: caster.x, y: caster.y, angle });
    // PB-Rank Wave 1: emit structured ground telegraph event for baked 00GameDevs circle/sector/rect indicators!
    if (v2Mode && (move.energy ?? 0) > 0 && (move.windup ?? 0) >= 0.14) {
      const v2Spec = resolveMoveSpecV2(moveId, move);
      if (v2Spec.telegraphShape && v2Spec.telegraphShape !== "none") {
        const atTarget = v2Spec.telegraphShape === "circle" && (move.type === "ZONE" || ["METEOR_RAIN", "VORTEX_PULL", "TELEKINESIS_SLAM", "LEAP_SLAM"].includes(v2Spec.v2Archetype));
        emit({
          type: "CAST_TELEGRAPH", actionId: caster.cast.actionId, casterId: caster.id, team: caster.team,
          moveId, shape: v2Spec.telegraphShape,
          x: atTarget ? targetX : caster.x, y: atTarget ? targetY : caster.y,
          angle, radius: v2Spec.combatRadius, range: v2Spec.combatRange, windup: move.windup, ultimate
        });
      }
    }
    if (caster.cast.windup <= 0) finishCast(caster);
    return true;
  }

  function updateCast(caster) {
    if (!caster.cast) return;
    if (caster.hitstun > 0) return; // RELAY: a staggered windup waits (hitstun is only set in RELAY)
    caster.cast.t += DT;
    if (caster.cast.t >= caster.cast.windup) finishCast(caster);
  }

  function shootBolt(caster, move, angle, extra = {}) {
    const team = caster.team;
    const hostileKind = move.shard ? "SHARD" : move.type === "WAVE" ? "WAVE" : move.onTerrain === "IGNITE" ? "EMBER" : "RBOLT";
    const damageScale = (caster === player ? stat.skillDamage : caster.damageScale ?? 1);
    return spawnProjectile({ casterId: caster.id, kind: team === "player" ? "PBOLT" : hostileKind, owner: team === "player" ? "player" : "rival", moveId: Object.keys(DATA_ARENA_MOVES).find((key) => DATA_ARENA_MOVES[key] === move),
      x: caster.x + Math.cos(angle) * (caster.radius + 8), y: caster.y + Math.sin(angle) * (caster.radius + 8),
      vx: Math.cos(angle) * move.speed, vy: Math.sin(angle) * move.speed, radius: move.radius, damage: move.damage * damageScale * (extra.damageBonus ?? 1),
      range: move.range, travelled: 0, pierce: move.pierce ?? 0, hits: new Set(), onHit: move.onHit ?? null, onTerrain: move.onTerrain ?? null,
      knockback: move.knockback ?? 0, hp: move.shard ?? 0, element: move.onTerrain ?? null, ...extra });
  }

  /** Raise a physical elemental barrier wall right in front of the caster to block shots & movement. */
  function spawnShieldWall(caster, angle, moveId, arenaElement) {
    if (!relayMode) return null;
    const elem = arenaElement ?? coverElement(caster, moveId) ?? "physical";
    const material = elem === "frost" ? "ICE"
      : elem === "nature" ? "WOOD"
        : elem === "earth" ? "STONE"
          : elem === "fire" ? "BASALT"
            : (elem === "light" || elem === "water" || elem === "shadow") ? "CRYSTAL"
              : "METAL";
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const px = -dy, py = dx;
    const candidates = [
      [caster.x + dx * 68, caster.y + dy * 68],
      [caster.x + dx * 88, caster.y + dy * 88],
      [caster.x + dx * 64 + px * 52, caster.y + dy * 64 + py * 52],
      [caster.x + dx * 64 - px * 52, caster.y + dy * 64 - py * 52]
    ];
    const bodies = [player, ...(state.rivals ?? []).filter((r) => r.active && r.hp > 0)];
    for (const [wx, wy] of candidates) {
      const c = grid.cellOf(wx), r = grid.cellOf(wy);
      const cx = (c + 0.5) * grid.cell, cy = (r + 0.5) * grid.cell;
      if (bodies.some((b) => distance(b.x, b.y, cx, cy) < b.radius + 26)) continue;
      const before = events.length;
      const prop = grid.spawnTemporaryProp({ col: c, row: r, material, element: elem, owner: caster.id, hp: 135, ttl: 8.5, maxPerOwner: 2, events });
      if (prop) {
        prop.angle = angle;
        for (let k = before; k < events.length; k++) { events[k].t = state.time; events[k].angle = angle; }
        return prop;
      }
    }
    return null;
  }

  function finishCast(caster) {
    const { actionId, moveId, move, angle, aimX, aimY, ultimate } = caster.cast;
    const owner = `cast:${caster.id}`;
    removeTelegraph(owner);
    caster.cast = null;
    if (relayMode) { caster.recovery = move.recovery; if (caster.action) caster.action.releasedAt = state.time; }
    emit({ type: 'CAST_RELEASE' , actionId, casterId: caster.id, team: caster.team, moveId, moveType: move.type,
      x: caster.x, y: caster.y, angle, ultimate, windup: move.windup, recovery: move.recovery });
    const damageBonus = caster === player ? playerDealtScale(ultimate) : 1;
    const damageScale = (caster === player ? stat.skillDamage : caster.damageScale ?? 1) * damageBonus;
    const arenaElement = relayMode ? coverElement(caster, moveId) : null, attackElement = relayMode ? attackElementOf(caster, moveId) : null;
    const isBasic = relayMode && caster === player && !ultimate && (move.energy ?? 0) === 0;
    const traits = relayMode ? moveCombatTraits(moveId, move) : null;
    const v2 = v2Mode ? resolveMoveSpecV2(moveId, move) : null;
    if (relayMode && traits?.clearsHazards) {
      const ownSide = caster === player ? "player" : "rival";
      if ((state.hazards[ownSide] ?? 0) > 0) {
        state.hazards[ownSide] = 0;
        emit({ type: "HAZARD_CLEARED", side: ownSide, moveId, x: caster.x, y: caster.y });
      }
    }
    // V2 Re-Architected 18-Archetype Execution (for skills & ultimates when moveSystem === 'v2')
    if (v2 && !isBasic) {
      const foe = caster === player ? state.rivals[0] : player;
      const side = caster === player ? "player" : "rival";
      // Native skill absorption (replaces bolted-on Tactical Art button):
      // hazard moves lay switch-in spikes, illusion moves spawn a decoy, weather moves shift arena weather!
      if (v2.laysHazard && relayMode) {
        const enemySide = side === "player" ? "rival" : "player";
        if ((state.hazards[enemySide] ?? 0) < TACTICAL_CAPS.maxHazardLayers) {
          state.hazards[enemySide] = (state.hazards[enemySide] ?? 0) + 1;
          emit({ type: "HAZARD_PLACED", side, enemySide, layers: state.hazards[enemySide], x: foe?.x ?? aimX, y: foe?.y ?? aimY, angle });
        }
      }
      if (v2.spawnsDecoy && relayMode && !caster.decoyUsed && !caster.decoy && caster.hp > Math.ceil(caster.maxHp * 0.35)) {
        const cost = Math.max(1, Math.round(caster.maxHp * TACTICAL_CAPS.decoyHpShare));
        caster.hp = Math.max(1, caster.hp - cost);
        caster.decoyUsed = true;
        caster.decoy = { hp: cost, maxHp: cost };
        emit({ type: "DECOY_SPAWN", side, hp: cost, x: caster.x, y: caster.y });
      }
      if (v2.shiftsWeather && relayMode) {
        const wKind = desiredWeatherForElement(arenaElement ?? casterElement(caster));
        if (wKind && state.weather.kind !== wKind) {
          state.weather = { kind: wKind, remaining: WEATHER_RULES.duration, tickTimer: WEATHER_RULES.chipInterval };
          emit({ type: "WEATHER_START", side, kind: wKind, duration: WEATHER_RULES.duration, x: caster.x, y: caster.y });
        }
      }
      if (v2.v2Archetype === "FLURRY_COMBO" && foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) <= (move.distance ?? 220) + 80) {
        const hits = v2.flurryHits || 3;
        const dmgPerHit = Math.max(8, ((move.damage ?? 24) * 1.15) / hits);
        caster.flurry = { artId: moveId, moveId, hitsLeft: hits, timer: 0, interval: 0.11, damagePerHit: dmgPerHit, dirX: Math.cos(angle), dirY: Math.sin(angle), target: foe, arenaElement, attackElement };
        emit({ type: "FLURRY_START", side, artId: moveId, moveId, x: caster.x, y: caster.y, angle });
        return;
      }
      if (v2.v2Archetype === "SHADOW_BACKSTAB" && foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) <= 360) {
        caster.invulnerable = Math.max(caster.invulnerable ?? 0, 0.26);
        caster.backstab = { artId: moveId, moveId, timer: 0.2, damage: Math.max(26, (move.damage ?? 28) * 1.05), target: foe, arenaElement, attackElement };
        emit({ type: "BACKSTAB_VANISH", side, artId: moveId, moveId, x: caster.x, y: caster.y });
        return;
      }
      if (v2.v2Archetype === "SELF_BUFF" && (caster.buffsUsed ?? 0) < TACTICAL_CAPS.buffsPerStay) {
        caster.buffsUsed = (caster.buffsUsed ?? 0) + 1;
        applyStatDelta(caster, { atk: 1, spd: 1 });
        emit({ type: "STAT_BUFF", side, artId: moveId, moveId, atkStage: caster.atkStage, spdStage: caster.spdStage, buffsUsed: caster.buffsUsed, x: caster.x, y: caster.y });
        if (move.type === "NOVA") nova(caster, move, damageScale * 0.65, moveId, false);
        return;
      }
      if (v2.v2Archetype === "RECOVERY_SUPPORT" && (caster.healsUsed ?? 0) < TACTICAL_CAPS.healsPerBattle) {
        caster.healsUsed = (caster.healsUsed ?? 0) + 1;
        const amt = Math.round(caster.maxHp * TACTICAL_CAPS.healShare);
        caster.hp = Math.min(caster.maxHp, caster.hp + amt);
        caster.burn = 0; caster.slow = 0; caster.slowTimer = 0; caster.root = 0;
        caster.paralyze = 0; caster.paralyzeTick = 0; caster.poison = 0; caster.poisonStacks = 0; caster.sleep = 0; caster.wet = 0;
        emit({ type: "TACTICAL_HEAL", side, artId: moveId, moveId, amount: amt, healsUsed: caster.healsUsed, x: caster.x, y: caster.y });
        return;
      }
      if (v2.v2Archetype === "LEAP_SLAM") {
        const leapDist = Math.min(240, foe && foe.hp > 0 ? distance(caster.x, caster.y, foe.x, foe.y) : 180);
        const destX = clamp(caster.x + Math.cos(angle) * leapDist, 48, worldWidth - 48);
        const destY = clamp(caster.y + Math.sin(angle) * leapDist, 48, worldHeight - 48);
        caster.leapSlam = { moveId, t: 0, duration: 0.44, startX: caster.x, startY: caster.y, destX, destY, radius: 112, damage: Math.max(26, (move.damage ?? 28) * 1.1), arenaElement, attackElement };
        emit({ type: "LEAP_START", side, moveId, x: caster.x, y: caster.y, destX, destY });
        return;
      }
      if (v2.v2Archetype === "SHOCKWAVE_RING") {
        const maxR = Math.max(185, (move.radius ?? 140) * 1.4);
        spawnShockwave({ team: caster.team, x: caster.x, y: caster.y, moveId, maxRadius: maxR, duration: 0.46, damage: Math.max(22, (move.damage ?? 26) * damageScale), arenaElement, attackElement, guardBreak: false });
        emit({ type: "SHOCKWAVE_START", side, moveId, x: caster.x, y: caster.y, maxRadius: maxR });
        return;
      }
      if (v2.v2Archetype === "GRAB_SLAM" && foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) <= Math.max(280, move.distance ?? 280)) {
        caster.grabSlam = { moveId, phase: "RUSH", t: 0, damage: Math.max(30, (move.damage ?? 30) * 1.15), target: foe, arenaElement, attackElement };
        return;
      }
      if (v2.v2Archetype === "TELEKINESIS_SLAM" && foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) <= 390) {
        caster.tkSlam = { moveId, phase: "LIFT", t: 0, damage: Math.max(28, (move.damage ?? 28) * 1.12), target: foe, arenaElement, attackElement };
        emit({ type: "TK_LIFT", side, moveId, x: foe.x, y: foe.y, fromX: caster.x, fromY: caster.y });
        return;
      }
      if (v2.v2Archetype === "BURROW_AMBUSH") {
        const dist = Math.min(280, foe && foe.hp > 0 ? distance(caster.x, caster.y, foe.x, foe.y) : 210);
        const destX = clamp(caster.x + Math.cos(angle) * dist, 56, worldWidth - 56);
        const destY = clamp(caster.y + Math.sin(angle) * dist, 56, worldHeight - 56);
        caster.burrowed = true;
        caster.invulnerable = Math.max(caster.invulnerable ?? 0, 0.65);
        caster.burrow = { moveId, phase: "DIVE", t: 0, duration: 0.44, startX: caster.x, startY: caster.y, destX, destY, radius: 108, damage: Math.max(28, (move.damage ?? 28) * 1.15), angle, arenaElement, attackElement };
        emit({ type: "BURROW_START", side, casterId: caster.id, moveId, x: caster.x, y: caster.y, angle, duration: 0.56 });
        return;
      }
      if (v2.v2Archetype === "GROUND_SPIKES") {
        state.groundSpikes.push({
          id: nextId++, team: caster.team, moveId,
          startX: caster.x + Math.cos(angle) * 56, startY: caster.y + Math.sin(angle) * 56,
          angle, stepIndex: 0, count: 4, spacing: 64, interval: 0.085, timer: 0,
          damage: Math.max(16, ((move.damage ?? 24) * 0.82) * damageScale),
          arenaElement, attackElement, hits: new Set()
        });
        emit({ type: "GROUND_SPIKES_START", side, moveId, x: caster.x, y: caster.y, angle });
        return;
      }
      if (v2.v2Archetype === "VORTEX_PULL") {
        // Spawn a true lifting 3D storm/tornado vortex centered on target/aim (or around caster for NOVA)
        const vx = move.type === "NOVA" && foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) <= 290
          ? foe.x : (move.type === "NOVA" ? caster.x : aimX);
        const vy = move.type === "NOVA" && foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) <= 290
          ? foe.y : (move.type === "NOVA" ? caster.y : aimY);
        const radius = Math.max(110, move.radius ?? 124);
        const delay = Math.max(0.95, Math.min(1.25, move.delay ?? 1.05));
        state.zones.push({
          id: nextId++, moveId, team: caster.team, x: vx, y: vy,
          radius, delay, t: 0, move,
          damage: Math.max(24, (move.damage ?? 26) * damageScale),
          caster: caster.id, arenaElement, attackElement,
          pullForce: v2.pullForce || 235,
          vortexLift: true,
          angle,
          guardBreak: Boolean(traits?.guardBreak || v2?.guardBreak)
        });
        emit({ type: "ZONE_PLACED", moveId, team: caster.team, x: vx, y: vy, radius, delay, angle, vortexLift: true });
        return;
      }
      if (v2.v2Archetype === "PROTECT_COUNTER") {
        caster.barrier = move.duration ?? 1.2;
        caster.barrierAngle = angle; caster.barrierArc = move.arc ?? 2.2; caster.barrierRadius = move.radius ?? 64;
        caster.counterTimer = Math.max(caster.counterTimer ?? 0, 0.85);
        spawnShieldWall(caster, angle, moveId, arenaElement);
        emit({ type: "BARRIER_UP", x: caster.x, y: caster.y, angle, moveId });
        emit({ type: "COUNTER_UP", side, artId: moveId, duration: 0.85, x: caster.x, y: caster.y });
        return;
      }
    }
    const v2GuardBreak = Boolean(traits?.guardBreak || v2?.guardBreak);
    const v2Homing = v2?.homing ? 3.2 : 0;
    const v2Pull = v2?.pullForce ?? 0;
    const v2Rebound = Boolean(v2?.rebound);
    const v2SecondDash = Boolean(v2?.v2Archetype === "MULTI_DASH");
    switch (move.type) {
      case "BOLT": case "WAVE": shootBolt(caster, move, angle, { actionId, moveId, arenaElement, attackElement, damageBonus, moveType: move.type, isBasic, guardBreak: v2GuardBreak, homing: move.type === "BOLT" ? v2Homing : 0, knockback: v2?.v2Archetype === "DRAG_WAVE" ? Math.max(move.knockback ?? 0, 340) : (move.knockback ?? 0) }); break;
      case "SPREAD": case "LANCE":
        for (let i = 0; i < move.count; i++) shootBolt(caster, move, angle - move.spread / 2 + (move.spread * i) / (move.count - 1), { actionId, moveId, arenaElement, attackElement, damageBonus, moveType: move.type, isBasic, guardBreak: v2GuardBreak });
        break;
      case "LUNGE":
        caster.lunge = { actionId, moveId, arenaElement, attackElement, isBasic, guardBreak: v2GuardBreak, rebound: v2Rebound, secondDash: v2SecondDash, dirX: Math.cos(angle), dirY: Math.sin(angle), left: move.distance, speed: move.speed, width: move.width,
          damage: move.damage * damageScale, hits: new Set() };
        if (caster === player && move.invulnerable) { player.invulnerable = Math.max(player.invulnerable, move.distance / move.speed + 0.08); player.dashGrace = player.invulnerable; player.perfectThisDash = false; }
        if (isRival(caster)) caster.invulnerable = Math.max(caster.invulnerable ?? 0, 0.1);
        break;
      case "ZONE":
        state.zones.push({ id: nextId++, actionId, moveId, team: caster.team, x: aimX, y: aimY, radius: move.radius, delay: move.delay, t: 0, move, damage: move.damage * damageScale, caster: caster.id, arenaElement, attackElement, pullForce: v2Pull, guardBreak: v2GuardBreak });
        emit({ type: "ZONE_PLACED", moveId, team: caster.team, x: aimX, y: aimY, radius: move.radius, delay: move.delay });
        break;
      case "BARRIER":
        caster.barrier = move.duration; caster.barrierAngle = angle; caster.barrierArc = move.arc; caster.barrierRadius = move.radius;
        if (relayMode) spawnShieldWall(caster, angle, moveId, arenaElement);
        emit({ type: "BARRIER_UP", actionId, casterId: caster.id, moveId, x: caster.x, y: caster.y, angle });
        break;
      case "BLINK": blink(caster, move, angle, moveId, actionId); break;
      case "NOVA": nova(caster, move, damageScale, moveId, isBasic, actionId); break;
      default: break;
    }
  }

  function blink(caster, move, angle, moveId, actionId) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const fromX = caster.x, fromY = caster.y;
    let travelled = 0;
    for (let s = 16; s <= move.distance; s += 16) {
      const x = fromX + dx * s, y = fromY + dy * s;
      // A frost blink creates actual walkable ice before occupying it. Hard
      // cover still stops the cast; ordinary movement never gets this bypass.
      if (blocked(x, y, caster.radius * 0.8, "forced")) break;
      if (move.freezeTrail) {
        const radius=caster.radius*.8,before=events.length;
        for(let r=grid.cellOf(y-radius);r<=grid.cellOf(y+radius);r++)for(let c=grid.cellOf(x-radius);c<=grid.cellOf(x+radius);c++)
          if(grid.inBounds(c,r))grid.freezeCell(grid.index(c,r),6*stat.iceScale,events,"BLINK");
        for(let k=before;k<events.length;k++)events[k].t=state.time;
      }
      if(blocked(x,y,caster.radius*.8,movementKind(caster)))break;
      travelled = s;
    }
    caster.x = fromX + dx * travelled; caster.y = fromY + dy * travelled;
    if (caster === player) { player.invulnerable = Math.max(player.invulnerable, 0.18); player.dashGrace = Math.max(player.dashGrace, 0.18); player.perfectThisDash = false; }
    emit({ type: "BLINK", actionId, casterId: caster.id, moveId, angle, fromX, fromY, x: caster.x, y: caster.y });
  }

  // RELAY stage three: the element a caster's hit carries against cover.
  const rosterElement = new Map(RELAY_ROSTER.map(p => [p.speciesId, p.element]));
  const casterElement = (caster) => caster === player ? partner.element ?? rosterElement.get(player.speciesId) ?? null : rosterElement.get(caster.speciesId) ?? null;
  const coverElement = (caster, moveId) => relayMoveElement(moveId, casterElement(caster));
  // Player-side faction resonance (relay only). Rivals fight alone and carry none.
  const resonant = key => relayMode && (state.relay?.resonance?.includes(key) ?? false);
  // Burst evolution (OWNER_APPROVED_ADAPTATION 2026-11-02, STAGE_REDESIGN_BURST_20261102), RELAY only: a 成熟期
  // fighter's gauge fills from damage dealt (150 per foe max HP) and taken (200 per own max HP); full, it bursts once
  // per match for 20 s (dealt x1.4 / x1.7, taken divided by the same), then is weakened (x0.85) for 5 s. Switching
  // out ends a burst. Its form is drawn while it lasts. Awakening raising (2026-11-02): a ranch partner bursts into
  // the form it learned (relayBurstPlans[partnerId]) with its bloodline perk and bond; Owner 2026-11-08: a fighter
  // that learned none (Dex-only, rental, or a species with no form) never bursts. A rival bursts into its first tier-1
  // form. The player's fighter waits READY for the call when relayManualBurst until the player presses it (Owner 2026-11-08: never on a timer or a pinch); damage taken in a pinch fills the
  // gauge faster. Burst true form (BURST_TRUE_FORM_20261108): while burst the fighter IS the form -- the player takes
  // the form's relay role (kit, basic attack, element, speed) and every fighter its species and HP curve -- and is
  // itself again when the burst ends or it is switched out. Damage dealt keeps the tier multiplier; damage taken is
  // only raised while weakened, since the form's own HP carries its toughness.
  const arenaBurstPlan = (speciesId, own = undefined, manual = false) => {
    if (own === null) return null;
    let plan = own;
    if (plan === undefined) {
      const idx = Number(String(speciesId).split('-').at(-1));
      const form = burstFormsFor(idx).find(f => f.tier === 1);
      plan = form ? { form: form.form, tier: 1 } : null;
    }
    if (!plan || !Number.isInteger(plan.form)) return null;
    const tier = plan.tier === 2 ? 2 : 1, perk = BLOODLINE_BURST_PERKS[plan.bloodline] ?? {}, bond = Math.max(0, Math.min(100, Number(plan.bond) || 0));
    return { form: plan.form, tier, via: tier === 2 && Number.isInteger(plan.via) ? plan.via : null,
      bloodline: BLOODLINE_BURST_PERKS[plan.bloodline] ? plan.bloodline : null, manual,
      charge: (1 + BURST_BATTLE_RULES.bondChargeBonus * bond / 100) * (perk.chargeMultiplier ?? 1),
      multiplier: burstMultiplier(tier) + (perk.multiplierBonus ?? 0), seconds: BURST_RULES.durationSeconds + (perk.extraSeconds ?? 0),
      weak: perk.noWeakness !== true, heal: perk.healPercent ?? 0, cooldownScale: perk.cooldownMultiplier ?? 1,
      gauge: 0, phase: 'CHARGING', until: 0, startedAt: null, readyAt: null, requested: false, overLimit: false, foe: null };
  };
  const arenaPinched = body => body && body.hp > 0 && body.hp * 100 < (body.maxHp || 1) * BURST_BATTLE_RULES.pinchHpPercent;
  const burstOfBody = body => !relayMode || !body ? null : body === player ? state.relay?.team?.[state.relay.active]?.burst ?? null : body.burst ?? null;
  // Over-limit burst (AWAKENING_OVERDRIVE_20261109): the player's long press -- cooldowns reset, damage +50 %,
  // cooldowns run 1.5x faster, 10 s; if the rival it faced still stands at the end, 3 s of exhaustion (no move or
  // cast, damage taken x1.3), unless the fighter carries the beta bloodline.
  const burstFactor = b => !b ? 1 : b.phase === 'BURST' ? b.multiplier * (b.overLimit ? 1 + OVER_LIMIT_RULES.damageBonus : 1)
    : b.phase === 'WEAK' ? BURST_RULES.weaknessMultiplier : 1;
  const burstTakenFactor = b => b?.phase === 'WEAK' ? BURST_RULES.weaknessMultiplier : b?.phase === 'EXHAUSTED' ? 1 / OVER_LIMIT_RULES.exhaustTakenMultiplier : 1;
  const burstAttackerOf = target => target === player ? state.rivals[0] ?? null : isRival(target) ? player : null;
  function scaleArenaBurst(target, amount) {
    if (!relayMode) return amount;
    const attacker = burstAttackerOf(target);
    return attacker ? amount * burstFactor(burstOfBody(attacker)) / burstTakenFactor(burstOfBody(target)) : amount;
  }
  function chargeArenaBurst(target, amount) {
    if (!relayMode || !(amount > 0)) return;
    const charge = (b, value) => { if (b && b.phase === 'CHARGING') b.gauge = Math.min(BURST_RULES.gaugeMaximum, b.gauge + value * b.charge); };
    const maxHp = target.maxHp || 1, pinch = arenaPinched(target) ? BURST_BATTLE_RULES.pinchTakenMultiplier : 1;
    charge(burstOfBody(burstAttackerOf(target)), 150 * amount / maxHp);
    charge(burstOfBody(target), 200 * amount / maxHp * pinch);
  }
  const speciesIndexOf = id => Number(String(id).split('-').at(-1));
  const resizeBody = (body, maxHp) => { const share = body.maxHp > 0 ? body.hp / body.maxHp : 1; body.maxHp = maxHp; body.hp = body.hp > 0 ? Math.min(maxHp, Math.max(1, share * maxHp)) : 0; };
  function becomeArenaForm(body, b) {
    if (!body || b.saved) return;
    b.saved = { speciesId: body.speciesId, maxHp: body.maxHp };
    const form = body === player ? relayPartner(`relay-species-${String(b.form).padStart(3, '0')}`) : null;
    if (form) {
      // Its partner power (raised, registered, rental) stays the fighter's own; movement ability stays too, so a
      // burst never strands a swimmer mid-channel.
      b.saved.partner = partner; b.saved.kit = player.kit;
      partner = Object.freeze({ ...form, powerId: partner.powerId ?? partner.id });
      player.formPartnerId = form.id; player.kit = relayKit(form.id, relayLoadouts[form.id]);
    }
    resizeBody(body, Math.round(b.saved.maxHp * burstHpRatio(speciesIndexOf(body.speciesId), b.form)));
    body.speciesId = `species-${String(b.form).padStart(3, '0')}`;
  }
  function revertArenaForm(body, b) {
    const saved = b?.saved;
    if (!saved || !body) return;
    b.saved = null;
    if (saved.partner) { partner = saved.partner; player.kit = saved.kit; player.formPartnerId = null; }
    body.speciesId = saved.speciesId; resizeBody(body, saved.maxHp);
  }
  function stepArenaBurst(body, b, side, silent = false) {
    if (!b) return;
    const down = !body || body.hp <= 0, display = body === player ? 'burstPartnerId' : 'burstSpeciesId';
    const formId = `species-${String(b.form).padStart(3, '0')}`;
    const begin = () => {
      b.phase = 'BURST'; b.until = state.time + (b.overLimit ? OVER_LIMIT_RULES.seconds : b.seconds); b.startedAt = state.time;
      if (b.overLimit) { b.foe = burstAttackerOf(body); if (body?.cooldowns) body.cooldowns = {}; }
      // A bloodline that heals at the burst (時鋼) restores HP as the shell opens.
      becomeArenaForm(body, b);
      if (b.heal > 0 && body.hp > 0) body.hp = Math.min(body.maxHp, body.hp + body.maxHp * b.heal / 100);
      if (!silent) { body[display] = body === player ? `relay-${formId}` : formId;
        emit({ type: 'BURST', side, form: b.form, tier: b.tier, via: b.via, bloodline: b.bloodline, overLimit: b.overLimit, x: body.x, y: body.y }); }
    };
    if (b.phase === 'CHARGING' && !down && b.gauge >= BURST_RULES.gaugeMaximum) {
      if (b.manual) { b.phase = 'READY'; b.readyAt = state.time; b.requested = false; if (!silent) emit({ type: 'BURST_READY', side, form: b.form }); }
      else begin();
    } else if (b.phase === 'READY') {
      if (down) b.phase = 'SPENT';
      else if (b.requested) begin();
    } else if (b.phase === 'BURST' && (down || state.time >= b.until)) {
      const exhausted = b.overLimit && !down && b.foe && b.foe.hp > 0 && b.bloodline !== OVER_LIMIT_RULES.immuneBloodline;
      b.phase = down ? 'SPENT' : exhausted ? 'EXHAUSTED' : b.overLimit || !b.weak ? 'SPENT' : 'WEAK';
      b.until = state.time + (exhausted ? OVER_LIMIT_RULES.exhaustSeconds : BURST_RULES.weaknessSeconds);
      revertArenaForm(body, b);
      if (!silent && body) { body[display] = null; emit({ type: 'BURST_END', side, form: b.form, exhausted, x: body.x, y: body.y }); }
    } else if ((b.phase === 'WEAK' || b.phase === 'EXHAUSTED') && (down || state.time >= b.until)) b.phase = 'SPENT';
  }
  const burstSnapshot = b => b ? { phase: b.phase, gauge: Math.round(b.gauge), tier: b.tier, form: b.form, startedAt: b.startedAt, via: b.via,
    bloodline: b.bloodline, manual: b.manual, warn: b.phase === 'CHARGING' && b.gauge >= BURST_BATTLE_RULES.warnGauge,
    overLimit: b.overLimit, until: b.phase === 'BURST' || b.phase === 'EXHAUSTED' ? b.until : null } : null;
  const playerTakenScale = () => (resonant('LUMEN') ? TAXONOMY_RESONANCE.LUMEN.damageTakenPercent / 100 : 1) * (resonant('TRI') ? 100 / TAXONOMY_RESONANCE.TRI.defensePercent : 1);
  const playerDealtScale = ultimate => (resonant('TRI') ? TAXONOMY_RESONANCE.TRI.attackPercent / 100 : 1) * (ultimate && resonant('RIFT') ? TAXONOMY_RESONANCE.RIFT.signaturePercent / 100 : 1);
  // The taxonomy element an elemental hit from this caster carries; physical hits carry none.
  const attackElementOf = (caster, moveId) => { const cover = coverElement(caster, moveId); return cover && cover !== 'physical' ? speciesTaxonomyForId(caster.speciesId)?.element ?? null : null; };
  const taxonomyMultiplier = (attackElement, target) => attackElement ? elementMultiplierPercent(attackElement, speciesTaxonomyForId(target.speciesId)?.element) / 100 : 1;

  function nova(caster, move, damageScale, moveId, isBasic, actionId) {
    const team = caster.team;
    for (const target of targetsFor(team)) {
      if (distance(target.x, target.y, caster.x, caster.y) > move.radius + (target.radius ?? 20)) continue;
      if (target === player && player.dashGrace > 0) { perfectDodge(caster.x, caster.y); continue; }
      if(relayMode&&!hasSight(caster.x,caster.y,target.x,target.y))continue;
      const hit=strike(target, move.damage * damageScale, move.type, zoneStatus(move), target.x, target.y, relayMode ? coverElement(caster, moveId) : null, relayMode ? attackElementOf(caster, moveId) : null, isBasic, { moveId, move });
      if(relayMode&&!hit)continue;
      if (move.effect !== "ROOT") {
        const d = distance(target.x, target.y, caster.x, caster.y) || 1;
        launch(target, (target.x - caster.x) / d, (target.y - caster.y) / d, DATA_ARENA_ENERGY.launch.NOVA);
      }
    }
    const novaEl = relayMode ? (attackElementOf(caster, moveId) ?? coverElement(caster, moveId)) : null;
    areaElement(caster.x, caster.y, move.radius, move,move.damage*damageScale,relayMode?coverElement(caster,moveId):null);
    if (relayMode) {
      tryTransformVortexAt(caster.x, caster.y, novaEl, moveId, team);
      triggerSurfaceReactionAt(caster.x, caster.y, novaEl, moveId, team, caster.facing >= 0 ? 0 : Math.PI);
      maybeSpawnMoveSurface(caster.x, caster.y, moveId, coverElement(caster, moveId), attackElementOf(caster, moveId), move, team, isBasic);
    }
    tryRaiseTempPillar(caster.x, caster.y, moveId, relayMode ? coverElement(caster, moveId) : null);
    emit({ type: "NOVA", actionId, casterId: caster.id, team, moveId, x: caster.x, y: caster.y, radius: move.radius, effect: move.effect });
  }

  /** Heavy earth/ice area moves in RELAY can raise a temporary destructible cover pillar on a clear nearby tile. */
  const PILLAR_MOVES = new Set(["quakeSlam", "iceCage", "shardStorm", "whiteout"]);
  function tryRaiseTempPillar(x, y, moveId, arenaElement) {
    if (!relayMode || !PILLAR_MOVES.has(moveId)) return null;
    const activeTemp = grid.props.filter((p) => p.temporary && !p.destroyed).length;
    if (activeTemp >= 4) return null;
    const c0 = grid.cellOf(x), r0 = grid.cellOf(y);
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const actors = [player, ...state.rivals.filter((r) => r.active && r.hp > 0)];
    for (const [dc, dr] of offsets) {
      const c = c0 + dc, r = r0 + dr;
      const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell;
      if (actors.some((a) => distance(a.x, a.y, cx, cy) < cell * 0.92)) continue;
      const before = events.length;
      const prop = grid.spawnTemporaryProp({ col: c, row: r, material: arenaElement === "frost" ? "ICE" : "STONE", hp: 110, ttl: 12, events });
      if (prop) {
        for (let k = before; k < events.length; k++) events[k].t = state.time;
        return prop;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ 10-element physical-chemistry combos, ground surfaces, vortex evolutions & directional wall shatter
  const MAX_ACTIVE_PUDDLES = 12;

  function spawnSurfacePatch({ kind, x, y, radius = 72, ttl = 8.0, team = "player", moveId = null } = {}) {
    if (!relayMode || !kind) return null;
    const px = clamp(x, 42, worldWidth - 42);
    const py = clamp(y, 42, worldHeight - 42);
    // Merge into an overlapping patch of the same kind so fields stay clean & bounded.
    for (const existing of state.puddles) {
      if (!existing.done && existing.kind === kind && distance(existing.x, existing.y, px, py) <= existing.radius * 0.6) {
        existing.ttl = Math.max(existing.ttl, ttl);
        existing.maxTtl = Math.max(existing.maxTtl, ttl);
        existing.radius = Math.min(130, Math.max(existing.radius, radius));
        return existing;
      }
    }
    while (state.puddles.length >= MAX_ACTIVE_PUDDLES) {
      const oldest = state.puddles.shift();
      if (oldest && !oldest.done) {
        oldest.done = true;
        emit({ type: "SURFACE_EXPIRE", id: oldest.id, kind: oldest.kind, x: oldest.x, y: oldest.y });
      }
    }
    const patch = { id: nextId++, kind, x: px, y: py, radius, ttl, maxTtl: ttl, team, moveId, tickTimer: 0.25, done: false };
    state.puddles.push(patch);
    emit({ type: "SURFACE_SPAWN", id: patch.id, kind, x: px, y: py, radius, ttl, team, moveId });
    return patch;
  }

  function maybeSpawnMoveSurface(x, y, moveId, arenaElement, attackElement, move, team, isBasic = false) {
    if (!relayMode || !v2Mode || isBasic) return null;
    const spec = inferMoveSurfacePatch(moveId, arenaElement, attackElement, move, { isBasic });
    if (!spec) return null;
    return spawnSurfacePatch({ kind: spec.kind, x, y, radius: spec.radius, ttl: spec.ttl, team, moveId });
  }

  function triggerSurfaceReactionAt(x, y, rawElement, moveId, team, strikeAngle = 0, { depth = 0 } = {}) {
    if (!relayMode || !state.puddles.length || depth > 3) return 0;
    let triggered = 0;
    const snapshot = state.puddles.slice();
    for (const patch of snapshot) {
      if (patch.done) continue;
      if (distance(x, y, patch.x, patch.y) > patch.radius + 36) continue;
      const rx = resolveSurfaceReaction(patch, rawElement, moveId);
      if (!rx) continue;
      triggered++;
      const prevKind = patch.kind;
      const rxRadius = rx.burstRadius ?? patch.radius;
      if (rx.consume) {
        patch.done = true;
        emit({ type: "SURFACE_EXPIRE", id: patch.id, kind: prevKind, x: patch.x, y: patch.y });
      } else if (rx.nextKind) {
        patch.kind = rx.nextKind;
        patch.ttl = rx.nextTtl ?? 6.0;
        patch.maxTtl = patch.ttl;
        patch.radius = Math.min(132, Math.round(patch.radius * (rx.nextRadiusMult ?? 1)));
        patch.team = team ?? patch.team;
      } else if (rx.growRadiusMult) {
        patch.radius = Math.min(138, Math.round(patch.radius * rx.growRadiusMult));
        patch.ttl = Math.max(patch.ttl, rx.extendTtl ?? 5.0);
        patch.maxTtl = Math.max(patch.maxTtl, patch.ttl);
      }
      if (rx.spreadForward && rx.spawnKind) {
        const sx = clamp(patch.x + Math.cos(strikeAngle) * (patch.radius * 1.15), 44, worldWidth - 44);
        const sy = clamp(patch.y + Math.sin(strikeAngle) * (patch.radius * 1.15), 44, worldHeight - 44);
        spawnSurfacePatch({ kind: rx.spawnKind, x: sx, y: sy, radius: Math.round(patch.radius * 0.92), ttl: rx.spawnTtl ?? 5.5, team, moveId });
      }
      if ((rx.burstDamage ?? 0) > 0 || rx.status) {
        const victims = [player, ...state.rivals.filter((r) => r.active && r.hp > 0)];
        for (const target of victims) {
          const isHostile = team ? target.team !== team : true;
          if (!isHostile && rx.kind !== "POISON_IGNITE") continue;
          const d = distance(target.x, target.y, patch.x, patch.y);
          if (d > rxRadius + (target.radius ?? 20)) continue;
          const dmg = (rx.burstDamage ?? 0) * (isHostile ? 1 : 0.4);
          if (dmg > 0) {
            strike(target, dmg, "SURFACE_REACT", rx.status ?? null, patch.x, patch.y, rx.paletteKey, null, false);
          } else if (rx.status) {
            applyStatus(target, rx.status);
          }
          if (rx.knockback && d > 1) {
            launch(target, (target.x - patch.x) / d, (target.y - patch.y) / d, rx.knockback);
          }
        }
      }
      emit({
        type: "SURFACE_REACT",
        kind: rx.kind,
        fromKind: prevKind,
        nextKind: rx.nextKind ?? (rx.consume ? null : patch.kind),
        paletteKey: rx.paletteKey,
        x: patch.x,
        y: patch.y,
        radius: rxRadius,
        team
      });
      // Chain-detonate touching puddles of the same kind (e.g. Poison Pool chain explosion like gasoline, Water Freeze/Electrify chain)!
      if (rx.chainSameKind) {
        for (const neighbor of state.puddles) {
          if (neighbor.done || neighbor === patch || neighbor.kind !== prevKind) continue;
          if (distance(patch.x, patch.y, neighbor.x, neighbor.y) <= patch.radius + neighbor.radius + 28) {
            triggered += triggerSurfaceReactionAt(neighbor.x, neighbor.y, rawElement, moveId, team, strikeAngle, { depth: depth + 1 });
          }
        }
      }
    }
    if (state.puddles.some((p) => p.done)) state.puddles = state.puddles.filter((p) => !p.done);
    return triggered;
  }

  function updateSurfacePatches() {
    if (!state.puddles.length) return;
    const actors = [player, ...state.rivals.filter((r) => r.active && r.hp > 0)];
    for (const patch of state.puddles) {
      if (patch.done) continue;
      patch.ttl -= DT;
      if (patch.ttl <= 0) {
        patch.done = true;
        emit({ type: "SURFACE_EXPIRE", id: patch.id, kind: patch.kind, x: patch.x, y: patch.y });
        continue;
      }
      patch.tickTimer -= DT;
      if (patch.tickTimer <= 0) {
        patch.tickTimer = 0.48;
        for (const body of actors) {
          if (body.hp <= 0 || body.burrowed || (body.airZ ?? 0) > 16) continue;
          if (distance(body.x, body.y, patch.x, patch.y) > patch.radius + (body.radius ?? 18) * 0.45) continue;
          if (patch.kind === SURFACE_KINDS.POISON_POOL) {
            applyStatus(body, { poison: AILMENT_RULES.poisonSeconds, poisonStacks: 1, slow: 0.22, slowSeconds: 0.9 });
          } else if (patch.kind === SURFACE_KINDS.WATER_PUDDLE) {
            applyStatus(body, { wet: AILMENT_RULES.wetSeconds });
          } else if (patch.kind === SURFACE_KINDS.ICE_PATCH) {
            applyStatus(body, { slow: 0.38, slowSeconds: 0.9 });
          } else if (patch.kind === SURFACE_KINDS.FIRE_PATCH) {
            applyStatus(body, { burn: 3.0 });
          } else if (patch.kind === SURFACE_KINDS.VINE_PATCH) {
            if (body.team !== patch.team) applyStatus(body, { slow: 0.42, slowSeconds: 1.0, poison: AILMENT_RULES.poisonSeconds, poisonStacks: 1 });
          } else if (patch.kind === SURFACE_KINDS.ELECTRIFIED_WATER) {
            applyStatus(body, { paralyze: 2.2 });
            if (body.team !== patch.team) strike(body, 9, "SHOCK", null, patch.x, patch.y, "storm", "THUNDER", false);
          } else if (patch.kind === SURFACE_KINDS.MUD_PATCH) {
            applyStatus(body, { slow: 0.52, slowSeconds: 1.0 });
          }
        }
      }
    }
    if (state.puddles.some((p) => p.done)) state.puddles = state.puddles.filter((p) => !p.done);
  }

  function tryTransformVortexAt(x, y, rawElement, moveId, team) {
    if (!relayMode || !state.zones.length) return null;
    for (const zone of state.zones) {
      if (!zone.vortexLift || zone.done || zone.evolvedKind) continue;
      if (distance(x, y, zone.x, zone.y) > zone.radius + 36) continue;
      const tx = resolveVortexTransform(zone, rawElement, moveId);
      if (!tx) continue;
      zone.evolvedKind = tx.kind;
      zone.canonicalElement = tx.canonicalElement;
      zone.paletteKey = tx.paletteKey;
      zone.radius = Math.round(zone.radius * tx.radiusMult);
      zone.damage = Math.round(zone.damage * tx.damageMult);
      zone.delay = Math.max(zone.delay, zone.t + (tx.extraDelay ?? 0.35));
      zone.evolvedStatus = tx.status ?? null;
      // Immediately apply evolved status to any enemies trapped inside the tornado!
      if (tx.status) {
        for (const target of targetsFor(zone.team)) {
          if (distance(target.x, target.y, zone.x, zone.y) <= zone.radius * 1.45) {
            applyStatus(target, tx.status);
          }
        }
      }
      if (tx.freezeGround) {
        const before = events.length;
        for (let r = grid.cellOf(zone.y - zone.radius); r <= grid.cellOf(zone.y + zone.radius); r++) {
          for (let c = grid.cellOf(zone.x - zone.radius); c <= grid.cellOf(zone.x + zone.radius); c++) {
            if (grid.inBounds(c, r) && distance((c + 0.5) * cell, (r + 0.5) * cell, zone.x, zone.y) <= zone.radius) {
              grid.freezeCell(grid.index(c, r), 6 * stat.iceScale, events, "COMBO");
            }
          }
        }
        for (let k = before; k < events.length; k++) events[k].t = state.time;
      }
      if (tx.igniteGround) {
        const before = events.length;
        for (let r = grid.cellOf(zone.y - zone.radius); r <= grid.cellOf(zone.y + zone.radius); r++) {
          for (let c = grid.cellOf(zone.x - zone.radius); c <= grid.cellOf(zone.x + zone.radius); c++) {
            if (grid.inBounds(c, r) && distance((c + 0.5) * cell, (r + 0.5) * cell, zone.x, zone.y) <= zone.radius) {
              grid.ignite(grid.index(c, r), events, "COMBO");
            }
          }
        }
        for (let k = before; k < events.length; k++) events[k].t = state.time;
      }
      if (tx.spawnPatch) {
        spawnSurfacePatch({ kind: tx.spawnPatch, x: zone.x, y: zone.y, radius: Math.round(zone.radius * 0.9), ttl: 7.5, team: team ?? zone.team, moveId });
      }
      emit({
        type: "ZONE_TRANSFORM",
        id: zone.id,
        kind: tx.kind,
        paletteKey: tx.paletteKey,
        x: zone.x,
        y: zone.y,
        radius: zone.radius,
        delay: Math.max(0.15, zone.delay - zone.t),
        team: team ?? zone.team
      });
      return tx;
    }
    return null;
  }

  function reactAndShatterWall(prop, damage, rawElement, moveId, team, strikeAngle, { melee = false, cause = "IMPACT" } = {}) {
    if (!prop || prop.destroyed) return false;
    const wasDestroyed = prop.destroyed;
    const px = (prop.col + prop.width / 2) * cell;
    const py = (prop.row + prop.height / 2) * cell;
    let totalDamage = damage * (melee && prop.temporary ? 2.5 : 1.0);
    const rx = relayMode ? resolveWallElementReaction(prop, rawElement, moveId) : null;
    if (rx) {
      totalDamage *= rx.damageMult ?? 1;
      if (rx.igniteRadius) {
        const beforeIgn = events.length;
        grid.igniteAt(px, py, events, "COMBO");
        for (let k = beforeIgn; k < events.length; k++) events[k].t = state.time;
      }
      if (rx.spawnPatch) {
        spawnSurfacePatch({ kind: rx.spawnPatch, x: px, y: py, radius: 74, ttl: 7.0, team: team ?? "player", moveId });
      }
      const rxRadius = rx.conductRadius ?? rx.steamRadius ?? rx.igniteRadius ?? 100;
      for (const target of targetsFor(team ?? "player")) {
        const d = distance(target.x, target.y, px, py);
        if (d > rxRadius + (target.radius ?? 20)) continue;
        if (rx.burstDamage) strike(target, rx.burstDamage, "WALL_REACT", rx.status ?? null, px, py, rawElement, null, false);
        else if (rx.status) applyStatus(target, rx.status);
        if (rx.knockback && d > 1) launch(target, (target.x - px) / d, (target.y - py) / d, rx.knockback);
      }
      emit({ type: "WALL_REACT", kind: rx.kind, material: prop.material, x: px, y: py, radius: rxRadius, team });
    }
    const before = events.length;
    const hit = grid.damageProp(prop, totalDamage, events, cause, rawElement);
    for (let k = before; k < events.length; k++) events[k].t = state.time;
    if (!wasDestroyed && prop.destroyed && prop.temporary && relayMode) {
      const shatter = buildWallShatterShards(prop, strikeAngle, team ?? "player", Math.max(18, damage));
      for (const s of shatter.shards) {
        spawnProjectile({
          casterId: team === "player" ? player.id : (state.rivals[0]?.id ?? 0),
          kind: s.kind, owner: s.owner, moveId: s.moveId,
          x: px + Math.cos(s.angle) * 18, y: py + Math.sin(s.angle) * 18,
          vx: s.vx, vy: s.vy, radius: s.radius, damage: s.damage,
          range: s.range, travelled: 0, pierce: 0, hits: new Set(),
          onHit: s.onHit, onTerrain: null, knockback: s.knockback, hp: 0,
          arenaElement: s.arenaElement, attackElement: s.attackElement,
          guardBreak: s.guardBreak, isWallShard: true, shardMaterial: s.shardMaterial
        });
      }
      emit({ type: "WALL_SHATTER", material: shatter.material, canonical: shatter.canonical, x: px, y: py, angle: strikeAngle, count: shatter.shards.length, team });
    }
    return hit;
  }

  function zoneStatus(move) {
    if (move.effect === "ROOT") return { root: move.rootSeconds ?? 1 };
    if (move.effect === "SLOW") return { slow: move.slow ?? 0.5, slowSeconds: move.slowSeconds ?? 2 };
    if (move.effect === "IGNITE") return { burn: 2 };
    return null;
  }

  /** One resolved burst: fire thaws ice or lights fuel; frost freezes water. */
  function areaElement(x, y, radius, move,damage=move.damage,element=null) {
    const before = events.length;
    if(damage>0)grid.damagePropsInRadius(x,y,radius,damage,events,move.effect==="IGNITE"?"FIRE":"SKILL",element);
    const span = radius / cell;
    for (let r = grid.cellOf(y - radius); r <= grid.cellOf(y + radius); r++) for (let c = grid.cellOf(x - radius); c <= grid.cellOf(x + radius); c++) {
      if (!grid.inBounds(c, r) || Math.hypot(c + 0.5 - x / cell, r + 0.5 - y / cell) > span) continue;
      const i = grid.index(c, r);
      if (move.effect === "IGNITE") {
        if(grid.ice[i]>0)grid.meltAt((c+.5)*cell,(r+.5)*cell,DATA_ARENA_GRID_RULES.emberIceMelt,events);
        else grid.ignite(i, events, "SKILL");
      }
      if (move.freezeWater || (!relayMode && move.effect === "ROOT")) grid.freezeCell(i, 7 * stat.iceScale, events, "SKILL");
    }
    // Ice puts fire out: a freezing burst douses burning ground in its radius.
    if (move.freezeWater || (!relayMode && move.effect === "ROOT")) grid.applyWater(x, y, span, events);
    for (let k = before; k < events.length; k++) events[k].t = state.time;
    if (move.effect === "IGNITE" && events.slice(before).some(e=>e.type==='FIRE_IGNITE'||e.type==='PROP_HIT'&&e.cause==='FIRE')) chain("BURN", x, y);
    if ((move.freezeWater || (!relayMode && move.effect === "ROOT")) && events.slice(before).some((e) => e.type === "FIRE_OUT")) chain("STEAM", x, y);
    if ((move.freezeWater || (!relayMode && move.effect === "ROOT")) && events.slice(before).some((e) => e.type === "ICE_FORM")) chain("FROST", x, y);
  }

  // Report only a recipient whose HP actually changed during this resolved contact.
  // The existing damage events retain their HUD/audio roles and share this contact identity.
  function confirmMoveContact(start, oldHp, target, source, casterId, x, y, angle) {
    if (!source.moveId || source.actionId == null || !(target.hp < oldHp)) return;
    const contact = { actionId: source.actionId, instanceId: source.id ?? source.actionId,
      casterId, targetId: target.id, moveId: source.moveId, x, y, angle };
    for (let i = start; i < events.length; i++) {
      if (['RIVAL_HIT', 'PLAYER_HIT', 'SKILL_HIT'].includes(events[i].type)) events[i].contact = contact;
    }
    emit({ type: 'MOVE_CONTACT', contact });
  }

  function updateLunge(caster) {
    const lunge = caster.lunge;
    if (!lunge) return;
    const step = Math.min(lunge.left, lunge.speed * DT);
    const kind = movementKind(caster);
    const nx = caster.x + lunge.dirX * step, ny = caster.y + lunge.dirY * step;
    if (blocked(nx, ny, caster.radius * 0.8, kind)) {
      const strikeAngle = Math.atan2(lunge.dirY, lunge.dirX);
      for(const prop of grid.props) {
        if(prop.destroyed||lunge.hits.has(prop.id))continue;
        const px=clamp(nx,prop.col*cell,(prop.col+prop.width)*cell),py=clamp(ny,prop.row*cell,(prop.row+prop.height)*cell);
        if(distance(nx,ny,px,py)<=caster.radius*.8+4){
          reactAndShatterWall(prop, lunge.damage, lunge.attackElement ?? lunge.arenaElement, lunge.moveId, caster.team, strikeAngle, { melee: true, cause: "LUNGE" });
          lunge.hits.add(prop.id);
        }
      }
      lunge.left = 0;
    }
    else { caster.x = nx; caster.y = ny; lunge.left -= step; }
    if (relayMode) {
      const strikeAngle = Math.atan2(lunge.dirY, lunge.dirX);
      tryTransformVortexAt(caster.x, caster.y, lunge.attackElement ?? lunge.arenaElement, lunge.moveId, caster.team);
      triggerSurfaceReactionAt(caster.x, caster.y, lunge.attackElement ?? lunge.arenaElement, lunge.moveId, caster.team, strikeAngle);
    }
    for (const target of targetsFor(caster.team)) {
      if (lunge.hits.has(target.id)) continue;
      if (distance(target.x, target.y, caster.x, caster.y) <= lunge.width / 2 + (target.radius ?? 20)) {
        lunge.hits.add(target.id);
        if (target === player && player.dashGrace > 0) { perfectDodge(caster.x, caster.y); continue; }
        if(relayMode&&!hasSight(caster.x,caster.y,target.x,target.y))continue;
        const beforeContact = events.length, oldHp = target.hp;
        const hit=strike(target, lunge.damage, "LUNGE", { slow: 0.3, slowSeconds: 0.6 }, target.x, target.y, lunge.arenaElement, lunge.attackElement, lunge.isBasic, { guardBreak: Boolean(lunge.guardBreak), moveId: lunge.moveId });
        if (hit) confirmMoveContact(beforeContact, oldHp, target, lunge, caster.id, target.x, target.y, Math.atan2(lunge.dirY, lunge.dirX));
        if(relayMode&&!hit)continue;
        launch(target, lunge.dirX, lunge.dirY, DATA_ARENA_ENERGY.launch.LUNGE);
        // RELAY: a dash that connects stops at arm's reach instead of running into the body
        // (2026-11-26 blind review: "the caster ends clipped inside the target").
        if (relayMode && !lunge.rebound && !target.lunge) {
          // Drawn bodies are wider than their hit circles: stand a body-width off (2026-11-27 review: sprites overlapped).
          const reach = ((target.radius ?? 20) + (caster.radius ?? 18)) * 1.8, gap = distance(target.x, target.y, caster.x, caster.y);
          if (gap < reach && gap > 0.01) { caster.x = target.x - (target.x - caster.x) / gap * reach; caster.y = target.y - (target.y - caster.y) / gap * reach; }
          lunge.left = 0;
        }
        if (lunge.rebound) {
          // UTURN_STRIKE: strike then spring back cleanly to safe spacing!
          launch(caster, -lunge.dirX, -lunge.dirY, 310);
          lunge.left = 0;
          break;
        }
      }
    }
    if (lunge.left <= 0) {
      if (lunge.secondDash) {
        const foe = caster === player ? state.rivals[0] : player;
        if (foe && foe.hp > 0 && distance(caster.x, caster.y, foe.x, foe.y) < 320) {
          const ang = Math.atan2(foe.y - caster.y, foe.x - caster.x);
          lunge.secondDash = false;
          lunge.dirX = Math.cos(ang); lunge.dirY = Math.sin(ang);
          lunge.left = 110; lunge.damage *= 0.72; lunge.hits.clear();
          caster.facing = lunge.dirX >= 0 ? 1 : -1;
          caster.facing8 = relayFacing8(ang);
          emit({ type: "DASH", x: caster.x, y: caster.y, dirX: lunge.dirX, dirY: lunge.dirY });
          return;
        }
      }
      caster.lunge = null;
      if (caster === player && grid.surfaceAt(player.x, player.y) === "WATER") startFall();
    }
  }

  function updateZones() {
    for (const zone of state.zones) {
      zone.t += DT;
      // V2 VORTEX_PULL: draws enemies inward, lifts them physically off the ground (`airZ`),
      // and spirals them around the 3D tornado funnel before flinging them down on burst!
      if (zone.pullForce > 0 && zone.t < zone.delay && !zone.done) {
        const liftProg = clamp(zone.t / Math.max(0.25, zone.delay * 0.72), 0, 1);
        for (const target of targetsFor(zone.team)) {
          const dx = target.x - zone.x;
          const dy = target.y - zone.y;
          const d = Math.hypot(dx, dy);
          if (d <= zone.radius * 1.48 && (target.guardTimer ?? 0) <= 0) {
            const nx = d > 1 ? dx / d : Math.cos(zone.t * 8);
            const ny = d > 1 ? dy / d : Math.sin(zone.t * 8);
            // Radial inward pull toward funnel wall (keeps a tight ~22px spiral orbit radius)
            const radialSpeed = d > 22 ? zone.pullForce : -zone.pullForce * 0.25;
            // Tangential whirlwind orbit around the tornado eye!
            const swirlSpeed = zone.vortexLift ? 215 : 0;
            const mx = (-nx * radialSpeed - ny * swirlSpeed) * DT;
            const my = (-ny * radialSpeed + nx * swirlSpeed) * DT;
            moveBody(target, mx, my, movementKind(target));
            if (zone.vortexLift) {
              target.vortexHeld = 0.16;
              target.vortexSpin = (target.vortexSpin ?? 0) + DT * 16;
              const targetZ = Math.round(Math.sin(liftProg * Math.PI * 0.5) * 74 + Math.sin(zone.t * 18) * 6);
              target.airZ = Math.max(target.airZ ?? 0, targetZ);
            }
          }
        }
      }
      if (zone.t < zone.delay || zone.done) continue;
      zone.done = true;
      for (const target of targetsFor(zone.team)) {
        const d = distance(target.x, target.y, zone.x, zone.y);
        if (d > zone.radius + (target.radius ?? 20) * 0.5) continue;
        if (target === player && player.dashGrace > 0) { perfectDodge(zone.x, zone.y); continue; }
        if(relayMode&&!hasSight(zone.x,zone.y,target.x,target.y))continue;
        strike(target, zone.damage, "ZONE", zone.evolvedStatus ?? zoneStatus(zone.move), zone.x, zone.y, zone.arenaElement, zone.canonicalElement ?? zone.attackElement, false, { guardBreak: Boolean(zone.guardBreak), moveId: zone.moveId, move: zone.move });
        if (zone.vortexLift) {
          target.vortexHeld = 0;
          const ox = d > 1 ? (target.x - zone.x) / d : Math.cos(zone.angle ?? 0);
          const oy = d > 1 ? (target.y - zone.y) / d : Math.sin(zone.angle ?? 0);
          launch(target, ox, oy, 290);
        }
      }
      areaElement(zone.x, zone.y, zone.radius, zone.move,zone.damage,zone.arenaElement);
      if (relayMode) {
        triggerSurfaceReactionAt(zone.x, zone.y, zone.canonicalElement ?? zone.attackElement ?? zone.arenaElement, zone.moveId, zone.team, zone.angle ?? 0);
        maybeSpawnMoveSurface(zone.x, zone.y, zone.moveId, zone.arenaElement, zone.canonicalElement ?? zone.attackElement, zone.move, zone.team, false);
      }
      tryRaiseTempPillar(zone.x, zone.y, zone.moveId, zone.arenaElement);
      emit({ type: "ZONE_BURST", actionId: zone.actionId, instanceId: zone.id, casterId: zone.caster, moveId:zone.moveId, team: zone.team, x: zone.x, y: zone.y, radius: zone.radius, effect: zone.move.effect });
    }
    if (state.zones.some((zone) => zone.done)) state.zones = state.zones.filter((zone) => !zone.done);
  }

  function spawnShockwave({ team, x, y, moveId, maxRadius = 200, duration = 0.45, damage = 24, arenaElement = null, attackElement = null, guardBreak = false }) {
    state.shockwaves.push({
      id: nextId++, team, x, y, moveId,
      radius: 26, maxRadius, t: 0, duration,
      damage, arenaElement, attackElement, guardBreak,
      hits: new Set()
    });
  }

  function updateShockwaves() {
    if (!state.shockwaves.length) return;
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.t += DT;
      const p = clamp(sw.t / sw.duration, 0, 1);
      sw.radius = 26 + (sw.maxRadius - 26) * p;
      const band = 34;
      for (const target of targetsFor(sw.team)) {
        if (sw.hits.has(target.id)) continue;
        const d = distance(target.x, target.y, sw.x, sw.y);
        if (Math.abs(d - sw.radius) <= band + (target.radius ?? 20) * 0.5) {
          sw.hits.add(target.id);
          if (target === player && player.dashGrace > 0) { perfectDodge(sw.x, sw.y); continue; }
          // Authentic Dig vs Earthquake counterplay: ground shockwave hits burrowed foes for 2x damage & pops them out!
          const burrowedMult = target.burrowed ? 2.0 : 1.0;
          if (target.burrowed) { target.burrowed = false; target.burrow = null; target.invulnerable = 0; target.airZ = 52; }
          strike(target, sw.damage * burrowedMult, "SHOCKWAVE", { slow: 0.25, slowSeconds: 0.7 }, sw.x, sw.y, sw.arenaElement, sw.attackElement, false, { guardBreak: sw.guardBreak || burrowedMult > 1, moveId: sw.moveId });
          const nx = d > 1 ? (target.x - sw.x) / d : 1, ny = d > 1 ? (target.y - sw.y) / d : 0;
          launch(target, nx, ny, 240);
        }
      }
      // Expanding shockwaves shatter temporary shield walls radially outward!
      if (relayMode) {
        for (const prop of grid.props) {
          if (prop.destroyed || !prop.temporary || sw.hits.has(prop.id)) continue;
          const px = (prop.col + prop.width / 2) * cell, py = (prop.row + prop.height / 2) * cell;
          const d = distance(px, py, sw.x, sw.y);
          if (Math.abs(d - sw.radius) <= band + cell * 0.5) {
            sw.hits.add(prop.id);
            reactAndShatterWall(prop, sw.damage, sw.attackElement ?? sw.arenaElement, sw.moveId, sw.team, Math.atan2(py - sw.y, px - sw.x), { melee: true, cause: "SHOCKWAVE" });
          }
        }
      }
      if (p >= 1) {
        if (relayMode) {
          triggerSurfaceReactionAt(sw.x, sw.y, sw.attackElement ?? sw.arenaElement, sw.moveId, sw.team, 0);
          maybeSpawnMoveSurface(sw.x, sw.y, sw.moveId, sw.arenaElement, sw.attackElement, { v2Archetype: "SHOCKWAVE_RING" }, sw.team, false);
        }
        state.shockwaves.splice(i, 1);
      }
    }
  }

  function updateGroundSpikes() {
    if (!state.groundSpikes.length) return;
    for (let i = state.groundSpikes.length - 1; i >= 0; i--) {
      const gs = state.groundSpikes[i];
      gs.timer -= DT;
      if (gs.timer <= 0 && gs.stepIndex < gs.count) {
        const sx = clamp(gs.startX + Math.cos(gs.angle) * (gs.stepIndex * gs.spacing), 42, worldWidth - 42);
        const sy = clamp(gs.startY + Math.sin(gs.angle) * (gs.stepIndex * gs.spacing), 42, worldHeight - 42);
        gs.stepIndex++;
        gs.timer = gs.interval;
        if (blocked(sx, sy, 14, "forced")) { state.groundSpikes.splice(i, 1); continue; }
        emit({ type: "GROUND_SPIKE_ERUPT", moveId: gs.moveId, team: gs.team, x: sx, y: sy, angle: gs.angle, index: gs.stepIndex });
        if (relayMode) {
          triggerSurfaceReactionAt(sx, sy, gs.attackElement ?? gs.arenaElement, gs.moveId, gs.team, gs.angle);
          if (gs.stepIndex === gs.count) maybeSpawnMoveSurface(sx, sy, gs.moveId, gs.arenaElement, gs.attackElement, { v2Archetype: "GROUND_SPIKES" }, gs.team, false);
        }
        for (const target of targetsFor(gs.team)) {
          if (distance(target.x, target.y, sx, sy) <= 56 + (target.radius ?? 20) * 0.5) {
            if (target === player && player.dashGrace > 0) { perfectDodge(sx, sy); continue; }
            const hitMult = gs.hits.has(target.id) ? 0.45 : 1.0;
            gs.hits.add(target.id);
            strike(target, gs.damage * hitMult, "GROUND_SPIKE", { slow: 0.25, slowSeconds: 0.65 }, sx, sy, gs.arenaElement, gs.attackElement, false, { guardBreak: gs.stepIndex === gs.count, moveId: gs.moveId });
            target.airZ = Math.max(target.airZ ?? 0, 36);
            launch(target, Math.cos(gs.angle), Math.sin(gs.angle), 185);
          }
        }
      }
      if (gs.stepIndex >= gs.count) state.groundSpikes.splice(i, 1);
    }
  }

  function tickKit(caster, regenScale = 1) {
    if ((caster.hurtTimer ?? 0) > 0) caster.hurtTimer = Math.max(0, caster.hurtTimer - DT);
    if (relayMode) {
      caster.recovery = Math.max(0, (caster.recovery ?? 0) - DT);
      if ((caster.abilityCooldown ?? 0) > 0) caster.abilityCooldown = Math.max(0, caster.abilityCooldown - DT);
      if ((caster.intimidateTimer ?? 0) > 0) caster.intimidateTimer = Math.max(0, caster.intimidateTimer - DT);
      if (state.tournament?.status === "FIGHT" && caster.hp > 0) {
        const ab = partnerAbilityFor(caster === player ? partner : caster);
        if (ab?.id === "SPEED_BOOST" && (caster.spdStage ?? 0) < 2) {
          caster.speedBoostTimer = (caster.speedBoostTimer ?? 0) + DT;
          if (caster.speedBoostTimer >= 6.0) {
            caster.speedBoostTimer = 0;
            caster.spdStage = Math.min(2, (caster.spdStage ?? 0) + 1);
            emit({ type: "ABILITY_PROC", side: caster === player ? "player" : "rival", abilityId: "SPEED_BOOST", x: caster.x, y: caster.y });
          }
        }
      }
      if (!caster.cast && !caster.lunge && caster.recovery <= 0) caster.action = null;
      if (caster.hp <= 0) { caster.cast = caster.lunge = caster.action = null; removeTelegraph(`cast:${caster.id}`); return; }
    }
    for (const id in caster.cooldowns) if (caster.cooldowns[id] > 0) caster.cooldowns[id] = Math.max(0, caster.cooldowns[id] - DT);
    // Plan A (PbRank rhythm): unified RELAY V2 uses rapid low-delay TP recovery so 4 active moves flow cleanly on independent cooldowns.
    const regenDelay = v2Mode ? 0.2 : DATA_ARENA_ENERGY.regenDelay;
    if (state.time - caster.energySpentAt >= regenDelay) {
      const baseRegen = v2Mode ? 26 : DATA_ARENA_ENERGY.regen;
      const regen = caster === player
        ? (v2Mode ? Math.max(stat.energyRegen, baseRegen * (1 + upgradeValue(upgrades, "energyRegen"))) : stat.energyRegen)
        : baseRegen * regenScale;
      caster.energy = Math.min(DATA_ARENA_ENERGY.max, caster.energy + regen * DT);
    }
    if (caster.barrier > 0) caster.barrier = Math.max(0, caster.barrier - DT);
    tickGuard(caster);
    tickTacticalStates(caster);
    tickStatus(caster);
    updateCast(caster);
    updateLunge(caster);
  }

  /** The player's slot 2-4 and ultimate inputs. A press made mid-dash, mid-windup or
   * mid-lunge is buffered briefly and fires on the first usable step, so no tap is lost. */
  let kitBuffer = null;
  function playerKitInput(input) {
    if (input.ult || Number.isInteger(input.cast)) {
      const usableNow = (player.state === "NORMAL" || player.state === "RIDING") && !player.cast && !player.lunge && (!relayMode || player.recovery <= 0);
      if (usableNow || state.aiSettings.inputBuffer !== false) {
        // A pointed press keeps its aim relative to the caster, so a buffered cast still goes where it was pointed.
        const pointed = !input.autoAim && input.aimX !== null ? { dx: input.aimX - player.x, dy: input.aimY - player.y } : null;
        kitBuffer = { ult: input.ult, cast: Number.isInteger(input.cast) ? input.cast : null, autoAim: input.autoAim, pointed, left: DATA_ARENA_ENERGY.inputBuffer };
      }
    }
    if (!kitBuffer) return;
    const usable = (player.state === "NORMAL" || player.state === "RIDING") && !player.cast && !player.lunge && (!relayMode || player.recovery <= 0);
    if (!usable) {
      kitBuffer.left -= DT;
      if (kitBuffer.left <= 0) kitBuffer = null;
      return;
    }
    const request = kitBuffer;
    kitBuffer = null;
    const ids = kitMoveIds(player);
    const aimFor = (range) => (request.pointed ? { x: player.x + request.pointed.dx, y: player.y + request.pointed.dy } : autoAim(player, range));
    if (request.ult) {
      if (relayMode ? canCast(player, player.kit.ultimate) && player.energy >= DATA_ARENA_RELAY.ultimateTp : player.ult >= DATA_ARENA_ENERGY.ultMax) {
        const move = moveFor(player.kit.ultimate, true);
        const aim = aimFor(move.range ?? 600);
        beginCast(player, player.kit.ultimate, aim.x, aim.y, { ultimate: true });
        return;
      }
      emit({ type: "CAST_REFUSED", reason: "ULT_NOT_READY" });
    }
    if (request.cast !== null && request.cast >= 0 && request.cast < ids.length) {
      const id = ids[request.cast], move = moveFor(id);
      if (!canCast(player, id)) emit({ type: "CAST_REFUSED", reason: (player.cooldowns[id] ?? 0) > 0 ? "COOLDOWN" : "ENERGY", slot: request.cast });
      else {
        const foe = relayMode ? state.rivals[0] : null;
        const closeMelee = relayMode && (move.type === "LUNGE" || move.type === "NOVA") && request.autoAim && foe && foe.active && foe.hp > 0;
        const reach = move.type === "LUNGE" ? (move.distance ?? 200) + 18 : (move.radius ?? 110) + 10;
        if (closeMelee && distance(player.x, player.y, foe.x, foe.y) > reach && distance(player.x, player.y, foe.x, foe.y) < reach + 230) {
          player.approach = { kind: "CAST", moveId: id, ultimate: false, target: foe, reach, ttl: TACTICAL_CAPS.autoApproachMaxSeconds };
          emit({ type: "APPROACH_START", side: "player", moveId: id, x: player.x, y: player.y });
        } else {
          const aim = aimFor(move.range ?? move.distance ?? 400);
          beginCast(player, id, aim.x, aim.y);
        }
      }
    }
  }

  // ------------------------------------------------------------------ laser
  function updateLaser(input) {
    if (relayMode) {
      laser.firing = false; laser.heat = 0;
      if (input.fire && player.state === 'NORMAL' && canCast(player, RELAY_ACTION_PROFILES[partner.id].basic)) {
        const aim = input.autoAim || input.aimX === null ? autoAim(player, 620) : { x: input.aimX, y: input.aimY };
        beginCast(player, RELAY_ACTION_PROFILES[partner.id].basic, aim.x, aim.y);
      }
      return;
    }
    laser.hitTimer = Math.max(0, laser.hitTimer - DT);
    const canFire = (player.state === "NORMAL" || player.state === "RIDING") && !laser.overheated && !player.cast && !player.lunge && (!relayMode || player.recovery <= 0);
    laser.firing = Boolean(input.fire && canFire);
    if (!laser.firing) {
      laser.heat = Math.max(0, laser.heat - stat.cooling * DT);
      if (laser.overheated) {
        laser.overheatTimer -= DT;
        if (laser.overheatTimer <= 0 && laser.heat <= stat.heatCapacity * 0.35) {
          laser.overheated = false;
          emit({ type: "LASER_READY" });
        }
      }
      laser.igniteAccum = 0;
      return;
    }
    state.stats.laserSeconds += DT;
    laser.heat += partner.heatPerSecond * DT;
    if (laser.heat >= stat.heatCapacity) {
      laser.heat = stat.heatCapacity;
      laser.overheated = true;
      laser.overheatTimer = DATA_ARENA_PLAYER.laser.overheatLock;
      laser.firing = false;
      emit({ type: "OVERHEAT", x: player.x, y: player.y });
      return;
    }
    const dx = Math.cos(laser.angle), dy = Math.sin(laser.angle);
    const ox = player.x + dx * (player.radius + 4), oy = player.y + dy * (player.radius + 4);
    const range = DATA_ARENA_PLAYER.laser.range;
    const wall = grid.raycast(ox, oy, dx, dy, range);
    const halfWidth = stat.laserWidth / 2;
    const hits = [];
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const t = rayCircle(ox, oy, dx, dy, enemy.x, enemy.y, enemy.radius + halfWidth);
      if (t >= 0 && t <= wall) hits.push({ t, kind: "ENEMY", target: enemy });
    }
    const boss = state.boss;
    if (boss && boss.state === "FIGHT") {
      const t = rayCircle(ox, oy, dx, dy, boss.x, boss.y, boss.radius + halfWidth);
      if (t >= 0 && t <= wall) hits.push({ t, kind: "BOSS", target: boss });
    }
    for (const rival of state.rivals) {
      if (!rival.active || rival.hp <= 0) continue;
      const t = rayCircle(ox, oy, dx, dy, rival.x, rival.y, rival.radius + halfWidth);
      if (t >= 0 && t <= wall) hits.push({ t, kind: "RIVAL", target: rival });
    }
    for (const pod of state.pods) {
      if (pod.respawn > 0) continue;
      const t = rayCircle(ox, oy, dx, dy, pod.x, pod.y, pod.radius + halfWidth);
      if (t >= 0 && t <= wall) hits.push({ t, kind: "POD", target: pod });
    }
    for (const projectile of state.projectiles) {
      if (projectile.dead || (projectile.kind !== "ORB" && projectile.kind !== "SHARD")) continue;
      const t = rayCircle(ox, oy, dx, dy, projectile.x, projectile.y, projectile.radius + halfWidth);
      if (t >= 0 && t <= wall) hits.push({ t, kind: projectile.kind, target: projectile });
    }
    hits.sort((a, b) => a.t - b.t);
    const damage = stat.laserDps * DT;
    let pierceLeft = stat.pierce;
    let end = wall, endKind = wall < range ? "WALL" : "RANGE";
    const flash = laser.hitTimer <= 0;
    for (const hit of hits) {
      if (hit.kind === "ORB") {
        hit.target.dead = true;
        state.stats.orbsErased++;
        emit({ type: "CANCEL", rule: "LASER_ERASES_ORB", x: hit.target.x, y: hit.target.y });
        continue;
      }
      if (hit.kind === "SHARD") {
        hit.target.hp -= damage;
        end = hit.t; endKind = "SHARD";
        if (flash) emit({ type: "SHARD_BLOCK", x: hit.target.x, y: hit.target.y });
        if (hit.target.hp <= 0) {
          hit.target.dead = true;
          state.stats.shardsBroken++;
          emit({ type: "CANCEL", rule: "LASER_BREAKS_SHARD", x: hit.target.x, y: hit.target.y });
        }
        break;
      }
      if (hit.kind === "POD") {
        hit.target.hp -= damage;
        if (hit.target.hp <= 0) burstPod(hit.target);
        end = hit.t; endKind = "TARGET";
        break;
      }
      if (hit.kind === "BOSS") damageBoss(damage, "LASER");
      else if (hit.kind === "RIVAL") damageRival(hit.target, damage * DATA_ARENA_TOURNAMENT.rivalBeamScale, "LASER");
      else damageEnemy(hit.target, damage, "LASER", ox + dx * hit.t, oy + dy * hit.t);
      chargeUlt(damage * DATA_ARENA_ENERGY.ultPerDamageDealt);
      if (flash) emit({ type: "LASER_HIT", x: ox + dx * hit.t, y: oy + dy * hit.t, target: hit.kind });
      if (pierceLeft <= 0) { end = hit.t; endKind = "TARGET"; break; }
      pierceLeft--;
    }
    if (flash) laser.hitTimer = 0.08;
    laser.x0 = ox; laser.y0 = oy; laser.x1 = ox + dx * end; laser.y1 = oy + dy * end; laser.endKind = endKind;
    if(endKind==="WALL") {
      const before=events.length;
      grid.damageProp(grid.propAt(laser.x1+dx*.5,laser.y1+dy*.5),damage,events,"LASER");
      for(let k=before;k<events.length;k++)events[k].t=state.time;
    }
    // Where the beam strikes the floor (not a body or shard), it heats an oil
    // spill until it catches: aim at the yard on purpose to set it alight.
    const floorHit = endKind === "WALL" || endKind === "RANGE";
    const ec=grid.cellOf(laser.x1+dx*.5),er=grid.cellOf(laser.y1+dy*.5);
    const endCell = !floorHit || !grid.inBounds(ec,er) ? -1 : grid.index(ec,er);
    if(stat.frostLens&&endCell>=0){const before=events.length;grid.applyWater(laser.x1,laser.y1,.35,events);for(let k=before;k<events.length;k++)events[k].t=state.time;}
    if (!stat.frostLens && endCell >= 0 && grid.flammable[endCell] && grid.fire[endCell] <= 0) {
      laser.igniteAccum = endCell === laser.igniteCell ? laser.igniteAccum + DT : DT;
      laser.igniteCell = endCell;
      if (laser.igniteAccum >= DATA_ARENA_PLAYER.laser.igniteSeconds && grid.ignite(endCell, events, "LASER")) {
        laser.igniteAccum = 0;
        events[events.length - 1].t = state.time;
      }
    } else { laser.igniteAccum = 0; laser.igniteCell = endCell; }
    // Frost lens: the beam freezes the open water it passes over.
    if (stat.frostLens) {
      const seconds = DATA_ARENA_GRID_RULES.lensIceSeconds * stat.iceScale;
      let formed = 0;
      for (let s = 0; s <= end; s += 24) {
        const c = grid.cellOf(ox + dx * s), r = grid.cellOf(oy + dy * s);
        if (!grid.inBounds(c, r)) continue;
        const i = grid.index(c, r);
        if (grid.isWaterTerrain(i) && grid.ice[i] < seconds - 0.5) {
          const before = events.length;
          if (grid.freezeCell(i, seconds, events, "LENS")) { formed++; for (let k = before; k < events.length; k++) events[k].t = state.time; }
        }
      }
      if (formed >= 3) chain("FROST", laser.x1, laser.y1);
    }
  }

  function burstPod(pod) {
    pod.hp = 0;
    pod.respawn = DATA_ARENA_GRID_RULES.podRespawn;
    const before = events.length;
    const frozen = grid.applyCryoColumn(pod.x, pod.y, DATA_ARENA_GRID_RULES.podIceSeconds * stat.iceScale, events);
    for (let k = before; k < events.length; k++) events[k].t = state.time;
    emit({ type: "POD_BURST", x: pod.x, y: pod.y, frozen });
    if (frozen > 0) { state.stats.bridgesFormed++; chain("CRYO_BRIDGE", pod.x, pod.y); }
  }

  // ------------------------------------------------------------------ mate
  function updateMate(input) {
    if (!hasMate) return;
    mate.stateTime += DT;
    mate.hitFlash = Math.max(0, mate.hitFlash - DT);
    mate.surgeCooldown = Math.max(0, mate.surgeCooldown - DT);
    if (mate.state === "DOWNED") {
      mate.downedTime += DT;
      const near = (player.state === "NORMAL") && distance(player.x, player.y, mate.x, mate.y) <= DATA_ARENA_MATE.revive.radius;
      if (near) mate.reviveProgress += DT * stat.reviveSpeed / DATA_ARENA_MATE.revive.seconds;
      else mate.reviveProgress = Math.max(0, mate.reviveProgress - DT * 0.5);
      const rescued = mate.reviveProgress >= 1;
      if (rescued || mate.downedTime >= DATA_ARENA_MATE.revive.autoSeconds) {
        mate.state = "FOLLOW"; mate.stateTime = 0;
        mate.hp = Math.round(mate.maxHp * DATA_ARENA_MATE.revive.hpShare);
        emit({ type: "MATE_REVIVED", rescued, x: mate.x, y: mate.y });
        if (rescued) { state.stats.rescues++; addHype("RESCUE", mate.x, mate.y); }
      }
      return;
    }
    // Command: Tide Surge toward the aim point (also from the saddle).
    if (input.surge) {
      if (mate.surgeCooldown > 0 || mate.surgeAim) emit({ type: "SURGE_REFUSED", reason: "COOLDOWN" });
      else if (input.aimX === null) emit({ type: "SURGE_REFUSED", reason: "NO_AIM" });
      else {
        mate.surgeAim = { x: input.aimX, y: input.aimY, windup: DATA_ARENA_MATE.surge.windup };
        mate.surgeCooldown = stat.surgeCooldown;
        emit({ type: "SURGE_WINDUP", x: mate.x, y: mate.y, aimX: input.aimX, aimY: input.aimY });
      }
    }
    if (mate.surgeAim) {
      mate.surgeAim.windup -= DT;
      if (mate.surgeAim.windup <= 0) { launchSurge(mate.surgeAim.x, mate.surgeAim.y); mate.surgeAim = null; }
    }
    if (mate.state === "RIDDEN") return;
    // Follow: hold a spot behind the player; swim the channel when it is shorter.
    // Hold a spot behind and slightly north of the player, so the large mate is
    // drawn behind and never hides the player.
    const goalX = player.x - player.facing * DATA_ARENA_MATE.followDistance;
    const goalY = player.y - 34;
    const gap = distance(mate.x, mate.y, goalX, goalY);
    let ax = 0, ay = 0;
    if (gap > 40) {
      mateField.update(goalX, goalY, DT, 0.35);
      const direct = gap < cell * 1.6 && grid.raycast(mate.x, mate.y, (goalX - mate.x) / gap, (goalY - mate.y) / gap, gap) >= gap - 1;
      const dir = direct ? { x: (goalX - mate.x) / gap, y: (goalY - mate.y) / gap } : mateField.direction(mate.x, mate.y);
      if (dir) { ax = dir.x; ay = dir.y; }
    }
    mate.swimming = grid.surfaceAt(mate.x, mate.y) === "WATER";
    const speed = (mate.swimming ? DATA_ARENA_MATE.speedWater : DATA_ARENA_MATE.speedLand) * clamp(gap / 160, 0.35, 1.25);
    const k = Math.min(1, DT * 8);
    mate.vx += (ax * speed - mate.vx) * k; mate.vy += (ay * speed - mate.vy) * k;
    moveBody(mate, mate.vx * DT, mate.vy * DT, "swimmer");
    if (gap > 900) { // never strand the mate far behind (e.g. after a fall recovery)
      const safe = grid.nearestSafeCell(goalX, goalY);
      if (safe) { mate.x = safe.x; mate.y = safe.y; emit({ type: "MATE_REGROUP", x: mate.x, y: mate.y }); }
    }
    if (Math.abs(mate.vx) > 10) mate.facing = mate.vx > 0 ? 1 : -1;
    if (grid.burningAt(mate.x, mate.y)) hurtMate(DATA_ARENA_GRID_RULES.fireDps * 0.5 * DT, "FIRE", mate.x, mate.y);
    // Water jet at the nearest visible threat.
    mate.jetTimer -= DT;
    if (mate.jetTimer <= 0) {
      mate.jetTimer = DATA_ARENA_MATE.jet.interval;
      const target = nearestThreat(mate.x, mate.y, DATA_ARENA_MATE.jet.range);
      if (target) {
        const d = distance(target.x, target.y, mate.x, mate.y) || 1;
        const dx = (target.x - mate.x) / d, dy = (target.y - mate.y) / d;
        spawnProjectile({ kind: "TIDE", owner: "mate", x: mate.x + dx * 26, y: mate.y - 18 + dy * 26, vx: dx * DATA_ARENA_MATE.jet.speed, vy: dy * DATA_ARENA_MATE.jet.speed,
          radius: DATA_ARENA_MATE.jet.radius, damage: DATA_ARENA_MATE.jet.damage });
        mate.facing = dx >= 0 ? 1 : -1;
      }
    }
  }

  function nearestThreat(x, y, range) {
    let best = null, bestD = range;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const d = distance(enemy.x, enemy.y, x, y);
      if (d < bestD && grid.raycast(x, y, (enemy.x - x) / (d || 1), (enemy.y - y) / (d || 1), d) >= d - 1) { best = enemy; bestD = d; }
    }
    const boss = state.boss;
    if (!best && boss?.state === "FIGHT" && distance(boss.x, boss.y, x, y) < range + boss.radius) best = boss;
    return best;
  }

  function launchSurge(aimX, aimY) {
    const d = distance(aimX, aimY, mate.x, mate.y) || 1;
    const dx = (aimX - mate.x) / d, dy = (aimY - mate.y) / d;
    const length = Math.min(DATA_ARENA_MATE.surge.range, Math.max(120, d));
    state.surges.push({ id: nextId++, x: mate.x, y: mate.y, ox: mate.x, oy: mate.y, dx, dy, length, travelled: 0, lastWater: -999,
      width: DATA_ARENA_MATE.surge.width * Math.sqrt(stat.surgeRadius), hit: new Set(), done: false });
    mate.facing = dx >= 0 ? 1 : -1;
    emit({ type: "SURGE", x: mate.x, y: mate.y, dirX: dx, dirY: dy, length });
  }

  function updateSurges() {
    const surge = DATA_ARENA_MATE.surge;
    for (const wave of state.surges) {
      if (wave.done) continue;
      const stepLength = Math.min(surge.speed * DT, wave.length - wave.travelled);
      // Cover blocks the wave too.
      const clear = grid.raycast(wave.x, wave.y, wave.dx, wave.dy, stepLength + 1);
      if(clear<stepLength+1){
        const before=events.length,prop=grid.propAt(wave.x+wave.dx*(clear+.5),wave.y+wave.dy*(clear+.5));
        if(prop&&!wave.hit.has(prop.id)){grid.damageProp(prop,surge.damage,events,"SURGE");wave.hit.add(prop.id);}
        grid.applyWater(wave.x+wave.dx*clear,wave.y+wave.dy*clear,surge.pathRadius,events);
        for(let k=before;k<events.length;k++)events[k].t=state.time;
      }
      const advance = Math.min(stepLength, clear);
      wave.x += wave.dx * advance; wave.y += wave.dy * advance; wave.travelled += advance;
      const radius = wave.width / 2;
      for (const enemy of state.enemies) {
        if (enemy.dead || wave.hit.has(enemy.id)) continue;
        if (distance(enemy.x, enemy.y, wave.x, wave.y) <= radius + enemy.radius) {
          wave.hit.add(enemy.id);
          enemy.kbx += wave.dx * surge.knockback; enemy.kby += wave.dy * surge.knockback;
          damageEnemy(enemy, surge.damage, "SURGE");
        }
      }
      const boss = state.boss;
      if (boss?.state === "FIGHT" && !wave.hit.has(boss.id) && distance(boss.x, boss.y, wave.x, wave.y) <= radius + boss.radius) {
        wave.hit.add(boss.id); damageBoss(surge.damage * 2, "SURGE");
      }
      for (const projectile of state.projectiles) {
        if (projectile.dead || projectile.kind !== "EMBER") continue;
        if (distance(projectile.x, projectile.y, wave.x, wave.y) <= radius + projectile.radius) {
          projectile.dead = true;
          state.stats.embersQuenched++;
          emit({ type: "CANCEL", rule: "WATER_QUENCHES_EMBER", x: projectile.x, y: projectile.y });
        }
      }
      if (wave.travelled - wave.lastWater >= 32) {
        wave.lastWater = wave.travelled;
        douse(wave.x, wave.y, surge.pathRadius);
      }
      for (const core of state.cores) {
        if (!core.out && distance(core.x, core.y, wave.x, wave.y) <= radius + 24) extinguishCore(core);
      }
      if (wave.travelled >= wave.length - 0.01 || advance < stepLength - 0.01) {
        wave.done = true;
        douse(wave.x, wave.y, surge.extinguishRadius * stat.surgeRadius);
        for (const core of state.cores) {
          if (!core.out && distance(core.x, core.y, wave.x, wave.y) <= surge.coreRadius * stat.surgeRadius) extinguishCore(core);
        }
        emit({ type: "SURGE_SPLASH", x: wave.x, y: wave.y, radius: surge.extinguishRadius * stat.surgeRadius * cell });
      }
    }
    state.surges = state.surges.filter((wave) => !wave.done);
  }

  function douse(x, y, radiusCells) {
    const before = events.length;
    const out = grid.applyWater(x, y, radiusCells, events);
    for (let k = before; k < events.length; k++) events[k].t = state.time;
    if (out > 0) chain("STEAM", x, y);
    return out;
  }

  function extinguishCore(core) {
    core.out = true;
    state.stats.coresOut++;
    state.score += DATA_ARENA_SCORE.coreOut;
    healPlayer(DATA_ARENA_SCORE.coreHeal);
    emit({ type: "CORE_OUT", x: core.x, y: core.y, remaining: state.cores.filter((c) => !c.out).length });
    addHype("CORE_OUT", core.x, core.y);
    douse(core.x, core.y, 2.4);
  }

  // ------------------------------------------------------------------ projectiles
  function spawnProjectile(spec) {
    if (state.projectiles.length >= DATA_ARENA_PROJECTILES.cap) return null;
    const projectile = { id: nextId++, life: 0, hp: 0, dead: false, ...spec };
    state.projectiles.push(projectile);
    return projectile;
  }

  function hitsPlayerBody(x, y, radius) {
    if (player.state === "RIDING" || player.state === "MOUNTING") return distance(x, y, mate.x, mate.y) <= radius + mate.radius;
    return distance(x, y, player.x, player.y) <= radius + player.radius;
  }

  /** Where a skillshot lands or breaks: fire lights oil, frost freezes open water, 666 moves deposit/react with surfaces. */
  function terrainEffect(projectile, backStep = 0) {
    const v = Math.hypot(projectile.vx, projectile.vy) || 1;
    const x = projectile.x + (projectile.vx / v) * backStep * 20, y = projectile.y + (projectile.vy / v) * backStep * 20;
    if (relayMode && !projectile.isWallShard) {
      const ang = Math.atan2(projectile.vy, projectile.vx);
      const team = projectile.owner === "player" ? "player" : "rival";
      const rxCount = triggerSurfaceReactionAt(x, y, projectile.arenaElement ?? projectile.attackElement, projectile.moveId, team, ang);
      if (rxCount === 0) {
        maybeSpawnMoveSurface(x, y, projectile.moveId, projectile.arenaElement, projectile.attackElement, { type: projectile.moveType ?? "BOLT" }, team, Boolean(projectile.isBasic));
      }
    }
    if (!projectile.onTerrain) return;
    const c = grid.cellOf(x), r = grid.cellOf(y);
    if (!grid.inBounds(c, r)) return;
    const before = events.length;
    if (projectile.onTerrain === "IGNITE") {
      if(grid.ice[grid.index(c,r)]>0)grid.meltAt(x,y,DATA_ARENA_GRID_RULES.emberIceMelt,events);
      else grid.ignite(grid.index(c, r), events, "SKILL");
    }
    if (projectile.onTerrain === "FREEZE") {
      // Ice freezes open water and puts out a burning cell where it lands.
      if (!grid.freezeCell(grid.index(c, r), 5 * stat.iceScale, events, "SKILL")) grid.applyWater(x, y, 0.75, events);
    }
    for (let k = before; k < events.length; k++) events[k].t = state.time;
  }

  function barrierBlocks(projectile) {
    const d = distance(projectile.x, projectile.y, player.x, player.y);
    if (d > (player.barrierRadius ?? 64) + projectile.radius) return false;
    const angle = Math.atan2(projectile.y - player.y, projectile.x - player.x);
    return Math.abs(wrapAngle(angle - player.barrierAngle)) <= (player.barrierArc ?? 2) / 2;
  }

  function updatePlayerShot(projectile) {
    for (const target of targetsFor("player")) {
      if (projectile.hits.has(target.id)) continue;
      if (distance(target.x, target.y, projectile.x, projectile.y) > (target.radius ?? 20) + projectile.radius) continue;
      projectile.hits.add(target.id);
      const beforeContact = events.length, oldHp = target.hp;
      const applied=strike(target, projectile.damage, "SKILL", projectile.onHit, projectile.x, projectile.y, projectile.arenaElement, projectile.attackElement, projectile.isBasic, { guardBreak: Boolean(projectile.guardBreak), moveId: projectile.moveId });
      if(relayMode&&!applied)return;
      // A shot pushes what it hits along its flight (PB: nearly every hit slides the body back;
      // 2026-11-26 blind review: "the promised knockback never happens"). Basics give a small shove.
      if (relayMode && target !== player) {
        const v = Math.hypot(projectile.vx, projectile.vy) || 1;
        launch(target, projectile.vx / v, projectile.vy / v, projectile.knockback || (projectile.isBasic ? 60 : 110));
      }
      emit({ type: "SKILL_HIT", actionId: projectile.actionId, x: projectile.x, y: projectile.y, moveId: projectile.moveId });
      if (applied) confirmMoveContact(beforeContact, oldHp, target, projectile, projectile.casterId, projectile.x, projectile.y, Math.atan2(projectile.vy, projectile.vx));
      if (projectile.pierce <= 0) { projectile.dead = true; terrainEffect(projectile); return; }
      projectile.pierce--;
    }
    // Player skillshots erase static orbs and chip shards on contact. RELAY
    // resolves every shot pair in relayClash() instead, the same both ways.
    if (!relayMode) for (const other of state.projectiles) {
      if (other.dead || other === projectile || (other.kind !== "ORB" && other.kind !== "SHARD")) continue;
      if (distance(other.x, other.y, projectile.x, projectile.y) > other.radius + projectile.radius) continue;
      if (other.kind === "ORB") { other.dead = true; emit({ type: "CANCEL", rule: "SKILL_ERASES_ORB", x: other.x, y: other.y }); }
      else { other.hp -= projectile.damage; projectile.dead = true; if (other.hp <= 0) { other.dead = true; emit({ type: "CANCEL", rule: "SKILL_BREAKS_SHARD", x: other.x, y: other.y }); } return; }
    }
  }

  // RELAY stage four: opposing shots meet in the air, both ways.
  //  - water or frost meeting fire: both vanish in steam (an element chain);
  //  - a wave swallows ordinary shots;
  //  - otherwise the larger shot survives (a piercing one spends a pierce);
  //    equal shots trade and both vanish.
  function relayClash() {
    const shots = state.projectiles;
    for (let i = 0; i < shots.length; i++) {
      const a = shots[i];
      for (let j = i + 1; j < shots.length && !a.dead; j++) {
        const b = shots[j];
        if (b.dead || a.owner === b.owner || distance(a.x, a.y, b.x, b.y) > a.radius + b.radius) continue;
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        const douses = (p, q) => ['water', 'frost'].includes(p.arenaElement) && q.arenaElement === 'fire';
        if (douses(a, b) || douses(b, a)) { a.dead = b.dead = true; chain('STEAM', x, y); emit({ type: 'CANCEL', rule: 'STEAM_CLASH', x, y }); emit({ type: 'CLASH', kind: 'STEAM_CLASH', x, y }); continue; }
        const wave = (p) => p.moveType === 'WAVE';
        if (wave(a) !== wave(b)) { (wave(a) ? b : a).dead = true; emit({ type: 'CANCEL', rule: 'WAVE_SWALLOWS_SHOT', x, y }); emit({ type: 'CLASH', kind: 'WAVE_CLASH', x, y }); continue; }
        const weight = (p) => p.radius * 4 + p.damage;
        if (Math.abs(weight(a) - weight(b)) < 1e-6) { a.dead = b.dead = true; emit({ type: 'CANCEL', rule: 'SHOTS_TRADE', x, y }); emit({ type: 'CLASH', kind: 'SHOT_CLASH', x, y }); continue; }
        const [big, small] = weight(a) > weight(b) ? [a, b] : [b, a];
        small.dead = true;
        if (big.pierce > 0) big.pierce--;
        emit({ type: 'CANCEL', rule: 'HEAVY_SHOT_WINS', x, y });
        emit({ type: 'CLASH', kind: 'HEAVY_CLASH', x, y });
      }
    }
    if (shots.some((p) => p.dead)) state.projectiles = shots.filter((p) => !p.dead);
    // Lunge-vs-Lunge bounce: colliding rushes deflect both fighters cleanly with a Clash spark.
    if (player.lunge && player.hp > 0) {
      for (const rival of state.rivals) {
        if (!rival.active || rival.hp <= 0 || !rival.lunge) continue;
        const reach = ((player.lunge.width ?? 44) + (rival.lunge.width ?? 44)) * 0.5 + 14;
        if (distance(player.x, player.y, rival.x, rival.y) <= reach) {
          const mx = (player.x + rival.x) * 0.5, my = (player.y + rival.y) * 0.5;
          const dx = player.x - rival.x, dy = player.y - rival.y, d = Math.hypot(dx, dy) || 1;
          player.lunge = null; rival.lunge = null;
          launch(player, dx / d, dy / d, 240);
          launch(rival, -dx / d, -dy / d, 240);
          emit({ type: 'CLASH', kind: 'LUNGE_CLASH', x: mx, y: my });
        }
      }
    }
  }

  function updateProjectiles() {
    for (const projectile of state.projectiles) {
      if (projectile.dead) continue;
      projectile.life += DT;
      // V2 HOMING_ORB: smoothly curves flight heading toward nearest active hostile
      if (projectile.homing > 0) {
        const foe = projectile.owner === "player" ? state.rivals[0] : player;
        if (foe && foe.hp > 0 && (foe === player || foe.active)) {
          const spd = Math.hypot(projectile.vx, projectile.vy);
          if (spd > 1) {
            const cur = Math.atan2(projectile.vy, projectile.vx);
            const want = Math.atan2(foe.y - projectile.y, foe.x - projectile.x);
            const next = cur + clamp(wrapAngle(want - cur), -projectile.homing * DT, projectile.homing * DT);
            projectile.vx = Math.cos(next) * spd;
            projectile.vy = Math.sin(next) * spd;
          }
        }
      }
      // PB-Rank Wave 1: 8px anti-tunneling sub-stepping so fast beams/darts never skip past thin cover or fighters!
      const totalDx = projectile.vx * DT, totalDy = projectile.vy * DT;
      const stepDist = Math.hypot(totalDx, totalDy);
      const subSteps = Math.max(1, Math.min(12, Math.ceil(stepDist / 8)));
      const subDx = totalDx / subSteps, subDy = totalDy / subSteps, subDist = stepDist / subSteps;
      for (let sub = 0; sub < subSteps && !projectile.dead; sub++) {
        projectile.x += subDx; projectile.y += subDy;
        if (projectile.life > DATA_ARENA_PROJECTILES.maxLifetime || projectile.x < -40 || projectile.y < -40
          || projectile.x > worldWidth + 40 || projectile.y > worldHeight + 40) { projectile.dead = true; break; }
        const c = grid.cellOf(projectile.x), r = grid.cellOf(projectile.y);
        if (projectile.range) {
          projectile.travelled += subDist;
          if (projectile.travelled >= projectile.range) { projectile.dead = true; terrainEffect(projectile); break; }
        }
        if (grid.inBounds(c, r) && grid.blocksLaser(grid.index(c, r))) {
          const before=events.length,prop=grid.propAtCell(grid.index(c,r));
          const strikeAngle = Math.atan2(projectile.vy, projectile.vx);
          const cause = projectile.onTerrain==="IGNITE"||projectile.kind==="EMBER"?"FIRE":"PROJECTILE";
          const pTeam = projectile.owner === "player" ? "player" : "rival";
          reactAndShatterWall(prop, projectile.damage, projectile.attackElement ?? projectile.arenaElement, projectile.moveId, pTeam, strikeAngle, { melee: false, cause });
          if(projectile.onTerrain==="IGNITE"||projectile.kind==="EMBER")grid.ignite(grid.index(c,r),events,"PROJECTILE");
          if(projectile.kind==="WAVE"||projectile.kind==="TIDE"||projectile.onTerrain==="FREEZE")grid.applyWater(projectile.x,projectile.y,.8,events);
          for(let k=before;k<events.length;k++)events[k].t=state.time;
          projectile.dead = true;
          terrainEffect(projectile, -1);
          emit({ type: "SHOT_BLOCKED", kind: projectile.kind, x: projectile.x, y: projectile.y });
          break;
        }
        // Cross-ring mid-flight combos: evolve active vortexes, detonate/freeze/electrify ground surfaces, & fan flames along wind!
        if (relayMode && !projectile.isWallShard) {
          const pTeam = projectile.owner === "player" ? "player" : "rival";
          const pAngle = Math.atan2(projectile.vy, projectile.vx);
          const pEl = projectile.arenaElement ?? projectile.attackElement;
          if (tryTransformVortexAt(projectile.x, projectile.y, pEl, projectile.moveId, pTeam)) {
            if (projectile.pierce <= 0 && projectile.kind !== "WAVE") { projectile.dead = true; break; }
          }
          if (triggerSurfaceReactionAt(projectile.x, projectile.y, pEl, projectile.moveId, pTeam, pAngle) > 0) {
            const canon = normalizeCanonicalElement(pEl, projectile.moveId);
            if (canon !== "WIND" && projectile.pierce <= 0 && projectile.kind !== "WAVE") { projectile.dead = true; break; }
          }
          if (grid.inBounds(c, r) && grid.fire[grid.index(c, r)] > 0 && normalizeCanonicalElement(pEl, projectile.moveId) === "WIND") {
            const beforeSpread = events.length;
            for (const stepDist2 of [cell, cell * 2]) {
              const fx = projectile.x + Math.cos(pAngle) * stepDist2;
              const fy = projectile.y + Math.sin(pAngle) * stepDist2;
              grid.igniteAt(fx, fy, events, "WIND_SPREAD");
            }
            for (let k = beforeSpread; k < events.length; k++) events[k].t = state.time;
          }
        }
        if (projectile.kind === "WAVE") {
          const before = events.length;
          if (grid.applyWater(projectile.x, projectile.y, 0.8, events) > 0) chain("STEAM", projectile.x, projectile.y);
          for (let k = before; k < events.length; k++) events[k].t = state.time;
          // RELAY waves meet shots in relayClash() (steam against fire, both ways).
          if (!relayMode) for (const other of state.projectiles) {
            if (!other.dead && other.owner === "player" && distance(other.x, other.y, projectile.x, projectile.y) <= other.radius + projectile.radius) {
              other.dead = true; emit({ type: "CANCEL", rule: "WAVE_SWALLOWS_SHOT", x: other.x, y: other.y });
            }
          }
        }
        if ((projectile.kind === "EMBER" || projectile.onTerrain === "IGNITE") && grid.inBounds(c, r) && grid.ice[grid.index(c, r)] > 0) {
          projectile.dead = true;
          const before = events.length;
          grid.meltAt(projectile.x, projectile.y, DATA_ARENA_GRID_RULES.emberIceMelt, events);
          for (let k = before; k < events.length; k++) events[k].t = state.time;
          break;
        }
        if (projectile.owner === "player") { updatePlayerShot(projectile); continue; }
        if (projectile.owner !== "mate" && player.barrier > 0 && barrierBlocks(projectile)) {
          projectile.dead = true;
          state.stats.barrierBlocks++;
          emit({ type: "CANCEL", rule: "BARRIER_BLOCKS_SHOT", x: projectile.x, y: projectile.y });
          break;
        }
        if (projectile.owner === "mate") {
          for (const other of state.projectiles) {
            if (other.dead || other.kind !== "EMBER") continue;
            if (distance(other.x, other.y, projectile.x, projectile.y) <= other.radius + projectile.radius) {
              other.dead = true; projectile.dead = true;
              state.stats.embersQuenched++;
              emit({ type: "CANCEL", rule: "WATER_QUENCHES_EMBER", x: other.x, y: other.y });
              break;
            }
          }
          if (projectile.dead) break;
          for (const enemy of state.enemies) {
            if (enemy.dead) continue;
            if (distance(enemy.x, enemy.y, projectile.x, projectile.y) <= enemy.radius + projectile.radius) {
              damageEnemy(enemy, projectile.damage, "TIDE"); projectile.dead = true; break;
            }
          }
          const boss = state.boss;
          if (!projectile.dead && boss?.state === "FIGHT" && distance(boss.x, boss.y, projectile.x, projectile.y) <= boss.radius + projectile.radius) {
            damageBoss(projectile.damage, "TIDE"); projectile.dead = true;
          }
          continue;
        }
        // Hostile shot vs the player (perfect dodge window) and the mate.
        const near = player.state !== "RIDING" && player.state !== "MOUNTING"
          && distance(projectile.x, projectile.y, player.x, player.y) <= projectile.radius + player.radius + stat.nearMiss;
        if (near && player.dashGrace > 0) perfectDodge(projectile.x, projectile.y);
        if (hitsPlayerBody(projectile.x, projectile.y, projectile.radius)) {
          if (player.dashGrace > 0 && player.state !== "RIDING") continue; // passes through the dash
          const mult = relayMode && projectile.arenaElement ? taxonomyMultiplier(projectile.attackElement, player) : 1;
          const beforeContact = events.length, oldHp = player.hp;
          if (hurtPlayer(projectile.damage * mult, projectile.kind, projectile.x, projectile.y, { guardBreak: Boolean(projectile.guardBreak) })) {
            confirmMoveContact(beforeContact, oldHp, player, projectile, projectile.casterId, projectile.x, projectile.y, Math.atan2(projectile.vy, projectile.vx));
            if (relayMode) relayAfterHit(player, projectile.damage * mult, projectile.arenaElement, mult, projectile.x, projectile.y);
            const hostileAilment = projectile.onHit ?? (relayMode && v2Mode && !projectile.isBasic ? inferMoveAilment(projectile.moveId, projectile.arenaElement, projectile.attackElement, null, { isBasic: false }) : null);
            if (hostileAilment) applyStatus(player, hostileAilment);
            if (projectile.knockback) { const v = Math.hypot(projectile.vx, projectile.vy) || 1; launch(player, projectile.vx / v, projectile.vy / v, DATA_ARENA_ENERGY.launch.WAVE); }
            if (projectile.kind !== "WAVE") { projectile.dead = true; terrainEffect(projectile); }
          } else if (player.invulnerable > 0 && projectile.kind !== "WAVE") projectile.dead = true;
          break;
        }
        if (hasMate && mate.state !== "DOWNED" && mate.state !== "RIDDEN" && distance(projectile.x, projectile.y, mate.x, mate.y) <= projectile.radius + mate.radius) {
          hurtMate(projectile.damage, projectile.kind, projectile.x, projectile.y);
          projectile.dead = true;
          break;
        }
      }
    }
    if (state.projectiles.some((p) => p.dead)) state.projectiles = state.projectiles.filter((p) => !p.dead);
  }

  // ------------------------------------------------------------------ enemies
  const hash = new Map();
  function hashKey(x, y) { return (Math.floor(x / 96) & 0xffff) | (Math.floor(y / 96) << 16); }

  function spawnEnemy(kind, x, y) {
    const def = DATA_ARENA_ENEMIES[kind];
    const enemy = { id: nextId++, kind, x, y, vx: 0, vy: 0, kbx: 0, kby: 0, hp: def.hp, maxHp: def.hp, radius: def.radius,
      contactCooldown: 0, shotTimer: def.shot ? def.shot.interval * (0.5 + random() * 0.5) : 0, windup: 0, aimX: 0, aimY: 0,
      hitFlash: 0, dead: false, facing: 1, spawnFx: 0.4 };
    state.enemies.push(enemy);
    emit({ type: "ENEMY_SPAWN", kind, x, y });
    return enemy;
  }

  function updateEnemies() {
    walkerField.update(player.x, player.y, DT, 0.4);
    fireproofField.update(player.x, player.y, DT, 0.4);
    hash.clear();
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const key = hashKey(enemy.x, enemy.y);
      let bucket = hash.get(key);
      if (!bucket) hash.set(key, bucket = []);
      bucket.push(enemy);
    }
    const targetBody = player.state === "RIDING" || player.state === "MOUNTING" ? mate : player;
    const playerTargetable = player.state !== "DOWNED" && player.state !== "DEFEATED" && player.state !== "FALLING";
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const def = DATA_ARENA_ENEMIES[enemy.kind];
      enemy.hitFlash = Math.max(0, enemy.hitFlash - DT);
      enemy.spawnFx = Math.max(0, enemy.spawnFx - DT);
      enemy.contactCooldown = Math.max(0, enemy.contactCooldown - DT);
      tickStatus(enemy);
      if (enemy.dead) continue;
      const tx = targetBody.x, ty = targetBody.y;
      const d = distance(enemy.x, enemy.y, tx, ty) || 1;
      let ax = 0, ay = 0;
      const field = def.fireImmune ? fireproofField : walkerField;
      const holdRange = def.shot ? def.shot.range * 0.55 : 0;
      if (d > holdRange) {
        const sight = d < cell * 2 && grid.raycast(enemy.x, enemy.y, (tx - enemy.x) / d, (ty - enemy.y) / d, d) >= d - 1;
        const dir = sight ? { x: (tx - enemy.x) / d, y: (ty - enemy.y) / d } : field.direction(enemy.x, enemy.y);
        if (dir) { ax = dir.x; ay = dir.y; }
      }
      // Separation from neighbours.
      const hx = Math.floor(enemy.x / 96), hy = Math.floor(enemy.y / 96);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const bucket = hash.get(((hx + ox) & 0xffff) | ((hy + oy) << 16));
        if (!bucket) continue;
        for (const other of bucket) {
          if (other === enemy) continue;
          const sx = enemy.x - other.x, sy = enemy.y - other.y, sd = Math.hypot(sx, sy), min = enemy.radius + other.radius;
          if (sd > 0 && sd < min) { ax += sx / sd * (min - sd) / min * 1.4; ay += sy / sd * (min - sd) / min * 1.4; }
        }
      }
      const length = Math.hypot(ax, ay);
      if (length > 1) { ax /= length; ay /= length; }
      const k = Math.min(1, DT * 6);
      const slow = (enemy.windup > 0 ? 0.25 : 1) * moveScale(enemy);
      enemy.vx += (ax * def.speed * slow - enemy.vx) * k; enemy.vy += (ay * def.speed * slow - enemy.vy) * k;
      moveBody(enemy, (enemy.vx + enemy.kbx) * DT, (enemy.vy + enemy.kby) * DT, "walker");
      enemy.kbx *= 1 - Math.min(1, DT * 6); enemy.kby *= 1 - Math.min(1, DT * 6);
      if (Math.abs(enemy.vx) > 5) enemy.facing = enemy.vx > 0 ? 1 : -1;
      // Melted ice under a walker: it drowns.
      if (grid.surfaceAt(enemy.x, enemy.y) === "WATER") { killEnemy(enemy, "DROWN"); continue; }
      if (!def.fireImmune && grid.burningAt(enemy.x, enemy.y)) {
        damageEnemy(enemy, DATA_ARENA_GRID_RULES.fireDps * DT, "FIRE");
        if (enemy.dead) continue;
      }
      // Contact damage.
      if (enemy.contactCooldown <= 0 && playerTargetable && hitsPlayerBody(enemy.x, enemy.y, enemy.radius)) {
        if (player.dashGrace > 0 && player.state === "DASH") perfectDodge(enemy.x, enemy.y);
        else if (hurtPlayer(def.contactDamage, enemy.kind, enemy.x, enemy.y)) enemy.contactCooldown = def.contactCooldown;
      } else if (enemy.contactCooldown <= 0 && mate.state === "FOLLOW" && distance(enemy.x, enemy.y, mate.x, mate.y) <= enemy.radius + mate.radius) {
        hurtMate(def.contactDamage, enemy.kind, enemy.x, enemy.y); enemy.contactCooldown = def.contactCooldown;
      }
      // Ranged attack with a locked, telegraphed aim line.
      if (def.shot && playerTargetable) {
        if (enemy.windup > 0) {
          enemy.windup -= DT;
          if (enemy.windup <= 0) {
            const kind = enemy.kind === "sentinel" ? "SHARD" : "EMBER";
            spawnProjectile({ kind, owner: "enemy", x: enemy.x + enemy.aimX * (enemy.radius + 6), y: enemy.y + enemy.aimY * (enemy.radius + 6),
              vx: enemy.aimX * def.shot.speed, vy: enemy.aimY * def.shot.speed, radius: def.shot.radius, damage: def.shot.damage,
              hp: def.shot.shardHp ?? 0 });
            removeTelegraph(enemy.id);
            emit({ type: "ENEMY_SHOT", kind, x: enemy.x, y: enemy.y });
          }
        } else {
          enemy.shotTimer -= DT;
          if (enemy.shotTimer <= 0 && d <= def.shot.range && grid.raycast(enemy.x, enemy.y, (tx - enemy.x) / d, (ty - enemy.y) / d, d) >= d - 1) {
            enemy.shotTimer = def.shot.interval;
            enemy.windup = def.shot.windup;
            enemy.aimX = (tx - enemy.x) / d; enemy.aimY = (ty - enemy.y) / d;
            addTelegraph({ owner: enemy.id, kind: "LINE", x: enemy.x, y: enemy.y, angle: Math.atan2(enemy.aimY, enemy.aimX),
              length: Math.min(def.shot.range, d + 120), width: def.shot.radius * 2, duration: def.shot.windup, follow: enemy.id });
          }
        }
      }
    }
    if (state.enemies.some((enemy) => enemy.dead)) {
      for (const enemy of state.enemies) if (enemy.dead) removeTelegraph(enemy.id);
      state.enemies = state.enemies.filter((enemy) => !enemy.dead);
    }
  }

  function addTelegraph(spec) {
    const telegraph = { id: nextId++, t: 0, ...spec };
    state.telegraphs.push(telegraph);
    return telegraph;
  }
  function removeTelegraph(owner) {
    if (state.telegraphs.some((t) => t.owner === owner)) state.telegraphs = state.telegraphs.filter((t) => t.owner !== owner);
  }
  function updateTelegraphs() {
    for (const telegraph of state.telegraphs) {
      telegraph.t += DT;
      if (telegraph.follow) {
        const owner = state.enemies.find((enemy) => enemy.id === telegraph.follow);
        if (owner) { telegraph.x = owner.x; telegraph.y = owner.y; }
      }
    }
    if (state.telegraphs.some((t) => t.t > t.duration + 0.05 && !t.persistent)) {
      state.telegraphs = state.telegraphs.filter((t) => t.persistent || t.t <= t.duration + 0.05);
    }
  }

  // ------------------------------------------------------------------ spawning
  function pickWeighted(mix) {
    const entries = Object.entries(mix);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = random() * total;
    for (const [kind, weight] of entries) { roll -= weight; if (roll <= 0) return kind; }
    return entries[entries.length - 1][0];
  }

  function updateSpawner() {
    const rule = DATA_ARENA_SPAWN.phases[state.phaseId];
    if (!rule) return;
    state.spawnTimer -= DT;
    if (state.spawnTimer > 0) return;
    state.spawnTimer = rule.interval;
    const alive = state.enemies.length;
    if (alive >= maxAlive) return;
    const southOpen = state.beacons.some((b) => b.active && !b.captured);
    const gates = map.gates.map(at)
      .filter((g) => distance(g.x, g.y, player.x, player.y) >= DATA_ARENA_SPAWN.minDistance)
      .filter((g) => southOpen || g.y < 28 * cell || player.y > 28 * cell)
      .sort((a, b) => distance(a.x, a.y, player.x, player.y) - distance(b.x, b.y, player.x, player.y))
      .slice(0, 4);
    if (!gates.length) return;
    const gate = gates[Math.floor(random() * gates.length)];
    const group = Math.min(rule.group + (state.time > 120 ? 1 : 0), maxAlive - alive);
    for (let i = 0; i < group; i++) {
      const kind = pickWeighted(rule.mix);
      const x = gate.x + (random() - 0.5) * 60, y = gate.y + (random() - 0.5) * 60;
      if (!blocked(x, y, DATA_ARENA_ENEMIES[kind].radius * 0.8, "walker")) spawnEnemy(kind, x, y);
    }
  }

  // ------------------------------------------------------------------ phases
  function enterPhase(index) {
    const phase = DATA_ARENA_TIMELINE.phases[index];
    state.phaseIndex = index; state.phaseId = phase.id;
    emit({ type: "PHASE", id: phase.id });
    if (phase.id === "EMBERS") {
      state.cores = map.fireCores.map((pos) => ({ id: nextId++, ...at(pos), out: false, timer: 1.6, armed: false }));
      for (const core of state.cores) addTelegraph({ owner: core.id, kind: "CIRCLE", x: core.x, y: core.y, radius: DATA_ARENA_GRID_RULES.coreIgniteRadius * cell, duration: 1.6 });
    } else if (phase.id === "TIDE") {
      const before = events.length;
      grid.openTide(events);
      for (let k = before; k < events.length; k++) events[k].t = state.time;
      for (const beacon of state.beacons) beacon.active = true;
      // Nothing may be left standing on the lifted bridge.
      if ((player.state === "NORMAL" || player.state === "DASH") && grid.surfaceAt(player.x, player.y) === "WATER") startFall();
      if (mate.state !== "RIDDEN") mate.swimming = grid.surfaceAt(mate.x, mate.y) === "WATER";
    } else if (phase.id === "SCAN") {
      const base = random() * TAU, spin = random() < 0.5 ? 1 : -1;
      const center = at([map.stage.col, map.stage.row]);
      state.scans = [0, Math.PI].map((offset) => ({ id: nextId++, x: center.x, y: center.y, angle: base + offset, spin,
        telegraph: DATA_ARENA_SCAN.telegraph, cooldown: 0 }));
      state.scanRingTimer = 2.5;
    } else if (phase.id === "GUARDIAN") {
      state.scans = [];
      const spawn = at(map.bossSpawn);
      state.boss = { id: nextId++, x: spawn.x, y: spawn.y, vx: 0, vy: 0, hp: DATA_ARENA_BOSS.hp, maxHp: DATA_ARENA_BOSS.hp,
        radius: DATA_ARENA_BOSS.radius, state: "ENTRANCE", stateTime: 0, pattern: null, patternTime: 0, gap: 1.5,
        lastPattern: null, cycle: 0, enraged: false, hitFlash: 0, facing: -1, contactCooldown: 0, shots: 0, aim: 0, slam: null };
      addTelegraph({ owner: state.boss.id, kind: "CIRCLE", x: spawn.x, y: spawn.y, radius: 170, duration: DATA_ARENA_BOSS.entrance });
      emit({ type: "BOSS_SPAWN", x: spawn.x, y: spawn.y, shielded: state.beacons.some((b) => !b.captured) });
    }
  }

  function updatePhases() {
    const phases = DATA_ARENA_TIMELINE.phases;
    const next = phases[state.phaseIndex + 1];
    if (next) {
      if (state.warnedPhase <= state.phaseIndex && state.time >= next.at - DATA_ARENA_TIMELINE.warn) {
        state.warnedPhase = state.phaseIndex + 1;
        emit({ type: "PHASE_WARNING", id: next.id, inSeconds: next.at - state.time });
      }
      if (state.time >= next.at) enterPhase(state.phaseIndex + 1);
    }
    if (!state.warmupDone && state.kills >= DATA_ARENA_SPAWN.warmupKills) {
      state.warmupDone = true; state.score += 300;
      emit({ type: "OBJECTIVE_DONE", id: "WARMUP" });
    }
  }

  function updateCores() {
    for (const core of state.cores) {
      if (core.out) continue;
      core.timer -= DT;
      if (core.timer > 0) continue;
      core.timer = DATA_ARENA_GRID_RULES.coreIgniteInterval;
      const before = events.length;
      const span = DATA_ARENA_GRID_RULES.coreIgniteRadius;
      const c0 = grid.cellOf(core.x), r0 = grid.cellOf(core.y);
      for (let r = Math.floor(r0 - span); r <= Math.ceil(r0 + span); r++) for (let c = Math.floor(c0 - span); c <= Math.ceil(c0 + span); c++) {
        if (grid.inBounds(c, r) && Math.hypot(c - c0, r - r0) <= span) grid.ignite(grid.index(c, r), events, "CORE");
      }
      for (let k = before; k < events.length; k++) events[k].t = state.time;
      if (!core.armed) { core.armed = true; emit({ type: "CORE_IGNITE", x: core.x, y: core.y }); }
    }
  }

  function updateBeacons() {
    for (const beacon of state.beacons) {
      if (!beacon.active || beacon.captured) continue;
      const inside = player.state !== "DOWNED" && player.state !== "FALLING"
        && distance(player.x, player.y, beacon.x, beacon.y) <= DATA_ARENA_BEACON.radius;
      const before = beacon.progress;
      if (inside) beacon.progress += DT / DATA_ARENA_BEACON.seconds;
      else beacon.progress = Math.max(0, beacon.progress - DT * DATA_ARENA_BEACON.decayPerSecond / DATA_ARENA_BEACON.seconds);
      if (inside && Math.floor(before * 4) !== Math.floor(beacon.progress * 4)) emit({ type: "BEACON_PROGRESS", id: beacon.id, progress: beacon.progress });
      if (beacon.progress >= 1) {
        beacon.progress = 1; beacon.captured = true;
        state.stats.beaconsCaptured++;
        state.score += DATA_ARENA_BEACON.score;
        healPlayer(DATA_ARENA_BEACON.heal);
        const remaining = state.beacons.filter((b) => !b.captured).length;
        emit({ type: "BEACON_CAPTURED", id: beacon.id, x: beacon.x, y: beacon.y, remaining });
        addHype("BEACON", beacon.x, beacon.y);
        if (remaining === 0 && state.boss?.state === "FIGHT") emit({ type: "BOSS_SHIELD_DOWN", x: state.boss.x, y: state.boss.y });
      }
    }
  }

  function updateScans() {
    if (!state.scans.length) return;
    const body = player.state === "RIDING" ? mate : player;
    for (const scan of state.scans) {
      scan.cooldown = Math.max(0, scan.cooldown - DT);
      if (scan.telegraph > 0) { scan.telegraph -= DT; continue; }
      scan.angle = wrapAngle(scan.angle + scan.spin * DATA_ARENA_SCAN.turnRate * DT);
      const ex = scan.x + Math.cos(scan.angle) * DATA_ARENA_SCAN.length, ey = scan.y + Math.sin(scan.angle) * DATA_ARENA_SCAN.length;
      const reach = grid.raycast(scan.x + Math.cos(scan.angle) * 40, scan.y + Math.sin(scan.angle) * 40, Math.cos(scan.angle), Math.sin(scan.angle), DATA_ARENA_SCAN.length);
      scan.reach = reach + 40;
      const bx = scan.x + Math.cos(scan.angle) * scan.reach, by = scan.y + Math.sin(scan.angle) * scan.reach;
      void ex; void ey;
      const d = pointSegmentDistance(body.x, body.y, scan.x, scan.y, bx, by);
      if (d <= DATA_ARENA_SCAN.width / 2 + body.radius + stat.nearMiss && player.dashGrace > 0) perfectDodge(bx, by);
      if (scan.cooldown <= 0 && d <= DATA_ARENA_SCAN.width / 2 + body.radius && !(player.dashGrace > 0 && player.state !== "RIDING")) {
        if (hurtPlayer(DATA_ARENA_SCAN.damage, "SCAN", body.x, body.y)) scan.cooldown = DATA_ARENA_SCAN.hitCooldown;
      }
    }
    state.scanRingTimer -= DT;
    if (state.scanRingTimer <= 0) {
      state.scanRingTimer = DATA_ARENA_SCAN.ringInterval;
      const center = state.scans[0];
      queueRing(center.x, center.y, DATA_ARENA_SCAN.ringCount, DATA_ARENA_SCAN.ringGaps, DATA_ARENA_SCAN.ringSpeed, DATA_ARENA_PROJECTILES.orb.damage, 0.8, "scan-ring");
    }
  }

  // A ring telegraphs first, then releases with deliberate walk-through gaps.
  const pendingRings = [];
  function queueRing(x, y, count, gaps, speed, damage, telegraph, owner) {
    const gapAt = new Set();
    for (let g = 0; g < gaps; g++) {
      const start = Math.floor(random() * count);
      gapAt.add(start); gapAt.add((start + 1) % count);
    }
    const ring = { x, y, count, gapAt, speed, damage, timer: telegraph, owner: `${owner}:${nextId++}` };
    pendingRings.push(ring);
    addTelegraph({ owner: ring.owner, kind: "RING", x, y, radius: 110, duration: telegraph,
      gaps: [...gapAt].map((i) => (i / count) * TAU), count });
  }
  function updateRings() {
    for (let i = pendingRings.length - 1; i >= 0; i--) {
      const ring = pendingRings[i];
      ring.timer -= DT;
      if (ring.timer > 0) continue;
      pendingRings.splice(i, 1);
      removeTelegraph(ring.owner);
      for (let k = 0; k < ring.count; k++) {
        if (ring.gapAt.has(k)) continue;
        const angle = (k / ring.count) * TAU;
        spawnProjectile({ kind: "ORB", owner: "boss", x: ring.x + Math.cos(angle) * 50, y: ring.y + Math.sin(angle) * 50,
          vx: Math.cos(angle) * ring.speed, vy: Math.sin(angle) * ring.speed, radius: DATA_ARENA_PROJECTILES.orb.radius, damage: ring.damage });
      }
      emit({ type: "RING_RELEASE", x: ring.x, y: ring.y });
    }
  }

  // ------------------------------------------------------------------ guardian
  const PATTERNS = ["fan", "ring", "volley", "slam", "summon"];
  function updateBoss() {
    const boss = state.boss;
    if (!boss || boss.state === "DOWN") return;
    boss.stateTime += DT;
    boss.hitFlash = Math.max(0, boss.hitFlash - DT);
    boss.contactCooldown = Math.max(0, boss.contactCooldown - DT);
    if (boss.state === "ENTRANCE") {
      if (boss.stateTime >= DATA_ARENA_BOSS.entrance) {
        boss.state = "FIGHT"; boss.stateTime = 0;
        emit({ type: "BOSS_READY", x: boss.x, y: boss.y });
      }
      return;
    }
    const speedScale = boss.enraged ? DATA_ARENA_BOSS.enrageSpeed : 1;
    const body = player.state === "RIDING" ? mate : player;
    const d = distance(boss.x, boss.y, body.x, body.y) || 1;
    // Keep a fighting distance, stay near the stage.
    const center = at(map.bossSpawn);
    let ax = 0, ay = 0;
    if (!boss.pattern || boss.pattern === "summon") {
      if (d > 300) { ax = (body.x - boss.x) / d; ay = (body.y - boss.y) / d; }
      else if (d < 180) { ax = -(body.x - boss.x) / d; ay = -(body.y - boss.y) / d; }
    }
    const fromCenter = distance(boss.x, boss.y, center.x, center.y);
    if (fromCenter > 760) { ax += (center.x - boss.x) / fromCenter; ay += (center.y - boss.y) / fromCenter; }
    const k = Math.min(1, DT * 3);
    boss.vx += (ax * DATA_ARENA_BOSS.speed * speedScale - boss.vx) * k; boss.vy += (ay * DATA_ARENA_BOSS.speed * speedScale - boss.vy) * k;
    moveBody(boss, boss.vx * DT, boss.vy * DT, "walker");
    if (Math.abs(body.x - boss.x) > 10) boss.facing = body.x > boss.x ? 1 : -1;
    if (boss.contactCooldown <= 0 && hitsPlayerBody(boss.x, boss.y, boss.radius * 0.8)) {
      if (player.dashGrace > 0 && player.state === "DASH") perfectDodge(boss.x, boss.y);
      else if (hurtPlayer(DATA_ARENA_BOSS.contactDamage, "BOSS", boss.x, boss.y)) boss.contactCooldown = 1;
    }
    if (!boss.pattern) {
      boss.gap -= DT * speedScale;
      if (boss.gap > 0) return;
      let pick;
      do { pick = PATTERNS[Math.floor(random() * PATTERNS.length)]; } while (pick === boss.lastPattern || (pick === "summon" && state.enemies.length > maxAlive - 6));
      startPattern(boss, pick, body);
      return;
    }
    boss.patternTime += DT * speedScale;
    runPattern(boss, body);
  }

  function startPattern(boss, pattern, body) {
    boss.pattern = pattern; boss.patternTime = 0; boss.lastPattern = pattern; boss.shots = 0; boss.cycle++;
    boss.aim = Math.atan2(body.y - boss.y, body.x - boss.x);
    const cfg = DATA_ARENA_BOSS[pattern];
    emit({ type: "BOSS_PATTERN", pattern, x: boss.x, y: boss.y });
    if (pattern === "fan") addTelegraph({ owner: boss.id, kind: "CONE", x: boss.x, y: boss.y, angle: boss.aim, spread: cfg.spread, length: 620, duration: cfg.telegraph, count: cfg.count });
    else if (pattern === "ring") queueRing(boss.x, boss.y, cfg.count, cfg.gaps, cfg.speed, cfg.damage, cfg.telegraph, "boss-ring");
    else if (pattern === "volley") addTelegraph({ owner: boss.id, kind: "LINE", x: boss.x, y: boss.y, angle: boss.aim, length: 640, width: cfg.radius * 2, duration: cfg.telegraph });
    else if (pattern === "slam") {
      boss.slam = { x: body.x, y: body.y };
      addTelegraph({ owner: boss.id, kind: "CIRCLE", x: body.x, y: body.y, radius: cfg.radius, duration: cfg.telegraph, danger: true });
    }
  }

  function runPattern(boss, body) {
    const cfg = DATA_ARENA_BOSS[boss.pattern];
    const finish = () => { boss.pattern = null; boss.gap = DATA_ARENA_BOSS.patternGap; removeTelegraph(boss.id); };
    switch (boss.pattern) {
      case "fan":
        if (boss.patternTime >= cfg.telegraph) {
          for (let i = 0; i < cfg.count; i++) {
            const angle = boss.aim - cfg.spread / 2 + (cfg.spread * i) / (cfg.count - 1);
            spawnProjectile({ kind: "EMBER", owner: "boss", x: boss.x + Math.cos(angle) * 60, y: boss.y + Math.sin(angle) * 60,
              vx: Math.cos(angle) * cfg.speed, vy: Math.sin(angle) * cfg.speed, radius: cfg.radius, damage: cfg.damage });
          }
          emit({ type: "BOSS_FIRE", pattern: "fan", x: boss.x, y: boss.y });
          finish();
        }
        break;
      case "ring":
        if (boss.patternTime >= cfg.telegraph + 0.1) finish();
        break;
      case "volley":
        if (boss.patternTime >= cfg.telegraph + boss.shots * cfg.interval && boss.shots < cfg.count) {
          const aim = boss.shots === 0 ? boss.aim : Math.atan2(body.y - boss.y, body.x - boss.x);
          spawnProjectile({ kind: "SHARD", owner: "boss", x: boss.x + Math.cos(aim) * 64, y: boss.y + Math.sin(aim) * 64,
            vx: Math.cos(aim) * cfg.speed, vy: Math.sin(aim) * cfg.speed, radius: cfg.radius, damage: cfg.damage, hp: cfg.shardHp });
          boss.shots++;
          emit({ type: "BOSS_FIRE", pattern: "volley", x: boss.x, y: boss.y });
          if (boss.shots === 1) removeTelegraph(boss.id);
        }
        if (boss.shots >= cfg.count) finish();
        break;
      case "slam":
        if (boss.patternTime >= cfg.telegraph) {
          const { x, y } = boss.slam;
          const inside = distance(body.x, body.y, x, y) <= cfg.radius + body.radius * 0.5;
          if (inside) {
            if (player.dashGrace > 0 && player.state !== "RIDING") perfectDodge(x, y);
            else hurtPlayer(cfg.damage, "SLAM", x, y);
          } else if (distance(body.x, body.y, x, y) <= cfg.radius + body.radius + stat.nearMiss && player.dashGrace > 0) perfectDodge(x, y);
          if (mate.state === "FOLLOW" && distance(mate.x, mate.y, x, y) <= cfg.radius) hurtMate(cfg.damage, "SLAM", x, y);
          const before = events.length;
          const span = cfg.radius / cell;
          for (let r = grid.cellOf(y - cfg.radius); r <= grid.cellOf(y + cfg.radius); r++) for (let c = grid.cellOf(x - cfg.radius); c <= grid.cellOf(x + cfg.radius); c++) {
            if (grid.inBounds(c, r) && Math.hypot(c + 0.5 - x / cell, r + 0.5 - y / cell) <= span) grid.ignite(grid.index(c, r), events, "SLAM");
          }
          for (let k = before; k < events.length; k++) events[k].t = state.time;
          emit({ type: "SLAM", x, y, radius: cfg.radius });
          finish();
        }
        break;
      case "summon":
        if (boss.patternTime >= 0.6) {
          for (let i = 0; i < cfg.count; i++) {
            const angle = (i / cfg.count) * TAU + random();
            const x = boss.x + Math.cos(angle) * 120, y = boss.y + Math.sin(angle) * 120;
            if (!blocked(x, y, 15, "walker")) spawnEnemy("noise", x, y);
          }
          finish();
        }
        break;
      default: finish();
    }
  }

  // ------------------------------------------------------------------ rivals (tournament AI)
  function createRival(definition, tier) {
    const spawn = at(map.rivalSpawn ?? map.bossSpawn);
    const tierRule = DATA_ARENA_TOURNAMENT.tiers[tier] ?? DATA_ARENA_TOURNAMENT.tiers[0];
    // Wave 8.1: In RELAY mode, rivals ALSO fight exclusively with PB-324 10-element kits (zero legacy vortex/inferno/shardStorm!).
    const rivalSpeciesIdx = Number(String(definition.speciesId ?? "").split("-").at(-1)) || (tier + 1);
    const rivalEl10 = definition.kit === "tide" ? "WATER" : definition.kit === "flame" ? "FIRE" : definition.kit === "storm" ? "THUNDER" : (rosterElement.get(definition.speciesId) ?? "FIRE");
    // ORIGINAL_MOVES_ARENA_20261126: a rival fights with its own original moves first, as the player's partners do.
    const rivalPbKit = relayMode ? relaySpeciesKit(rivalSpeciesIdx, rivalEl10) : null;
    // The harbour tide rival keeps its fixed pool kit, ultimate included.
    const rivalKitObj = relayMode && definition.kit === "tide"
      ? { moves: ["pb-311", "pb-285", "pb-316"], ultimate: pb324PartnerKit(rivalSpeciesIdx, rivalEl10).ultimate }
      : rivalPbKit ? { moves: rivalPbKit.moves.slice(0, 3), ultimate: rivalPbKit.ultimate } : DATA_ARENA_KITS[definition.kit];
    return { id: nextId++, rival: true, canSwim:definition.canSwim===true, definitionId: definition.id, speciesId: definition.speciesId, team: "rival", kit: rivalKitObj,
      x: spawn.x, y: spawn.y, vx: 0, vy: 0, kbx: 0, kby: 0, radius: definition.radius, hp: Math.round(definition.hp * rivalBoost), maxHp: Math.round(definition.hp * rivalBoost),
      speed: definition.speed, preferredRange: definition.preferredRange, tier: tierRule, damageScale: tierRule.damage * rivalBoost * (relayMode ? 0.62 : 1),
      energy: DATA_ARENA_ENERGY.max, energySpentAt: -Infinity, cooldowns: Object.create(null), ult: 0, cast: null, lunge: null,
      barrier: 0, guardTimer: 0, guardCooldown: 0, guardBlocked: false, barrierStreak: 0,
      atkStage: 0, defStage: 0, spdStage: 0, buffsUsed: 0, healsUsed: 0, decoy: null, decoyUsed: false,
      tacticalArt: defaultTacticalArtForElement(rosterElement.get(definition.speciesId) ?? "fire"),
      tacticalCooldown: 2.5, counterTimer: 0, flurry: null, backstab: null, approach: null,
      slow: 0, slowTimer: 0, root: 0, burn: 0, paralyze: 0, paralyzeTick: 0, poison: 0, poisonStacks: 0, sleep: 0, wet: 0, ccImmune: 0, hitFlash: 0, facing: -1, active: false, invulnerable: 0,
      goal: null, goalTimer: 0, strafe: 1, strafeTimer: 1.2, dodge: null, dashTimer: 0, dashCooldown: 0, dashX: 0, dashY: 0,
      threatSeen: new Set(), wantsCover: false, field: createFlowField(grid, "walker"), attackDelay: 0.8 };
  }

  function damageRival(rival, amount, cause, { guardBreak = false } = {}) {
    if (rival.hp <= 0 || !rival.active) return false;
    if (rival.invulnerable > 0 && cause !== "BURN") return false;
    if (relayMode && rival.decoy && rival.decoy.hp > 0 && cause !== "BURN" && cause !== "WATER" && cause !== "WEATHER") {
      rival.decoy.hp -= amount;
      emit({ type: "DECOY_HIT", side: "rival", amount: Math.round(amount), remaining: Math.max(0, Math.round(rival.decoy.hp)), x: rival.x, y: rival.y });
      if (rival.decoy.hp <= 0) {
        rival.decoy = null;
        emit({ type: "DECOY_BREAK", side: "rival", x: rival.x, y: rival.y });
      }
      return false;
    }
    if (relayMode && rival.barrier > 0 && cause !== "BURN" && cause !== "WATER") {
      if (guardBreak) {
        rival.barrier = 0;
        emit({ type: "GUARD_BROKEN", side: "rival", x: rival.x, y: rival.y });
      } else {
        emit({ type: "GUARD_BLOCK", side: "rival", amount: 0, dome: true, x: rival.x, y: rival.y });
        return false;
      }
    }
    if (relayMode) {
      amount *= statStageMultiplier(player.atkStage ?? 0) / statStageMultiplier(rival.defStage ?? 0);
      if (state.suddenDeath.multiplier > 1) amount *= state.suddenDeath.multiplier;
    }
    if (relayMode && rival.counterTimer > 0 && cause !== "BURN" && cause !== "WATER" && cause !== "COUNTER") {
      rival.counterTimer = 0;
      const reflected = Math.max(16, Math.round(amount * TACTICAL_CAPS.counterReflectMultiplier));
      amount *= TACTICAL_CAPS.counterDamageScale;
      emit({ type: "COUNTER_RIPOSTE", side: "rival", reflected, x: rival.x, y: rival.y });
      if (player.hp > 0 && distance(rival.x, rival.y, player.x, player.y) < 380) {
        hurtPlayer(reflected, "COUNTER", rival.x, rival.y);
        const d = distance(player.x, player.y, rival.x, rival.y) || 1;
        launch(player, (player.x - rival.x) / d, (player.y - rival.y) / d, 280);
      }
    }
    let guarded = (rival.guardTimer ?? 0) > 0 && cause !== "BURN" && cause !== "WATER";
    if (guarded && guardBreak) {
      guarded = false;
      rival.guardTimer = 0;
      rival.guardCooldown = GUARD_RULES.missCooldown;
      emit({ type: "GUARD_BROKEN", side: "rival", x: rival.x, y: rival.y });
    } else if (guarded) {
      amount *= GUARD_RULES.damageScale;
      rival.guardBlocked = true;
      emit({ type: "GUARD_BLOCK", side: "rival", amount: Math.round(amount), x: rival.x, y: rival.y });
    }
    if (relayMode) { amount = scaleArenaBurst(rival, amount); chargeArenaBurst(rival, amount); }
    const rivalAb = relayMode ? partnerAbilityFor(rival) : null;
    if (relayMode && rivalAb?.id === "STURDY" && !rival.sturdyUsed && rival.hp > rival.maxHp * 0.5 && rival.hp - amount <= 0) {
      rival.sturdyUsed = true;
      amount = Math.max(0, rival.hp - 1);
      rival.invulnerable = Math.max(rival.invulnerable ?? 0, 0.5);
      emit({ type: "ABILITY_PROC", side: "rival", abilityId: "STURDY", x: rival.x, y: rival.y });
    }
    rival.hp = Math.max(0, rival.hp - amount);
    rival.hitFlash = 0.12;
    rival.hurtTimer = guarded ? 0.1 : 0.23;
    const rdx = rival.x - player.x, rdy = rival.y - player.y, rd = Math.hypot(rdx, rdy) || 1;
    rival.hitDirX = rdx / rd;
    rival.hitDirY = rdy / rd;
    if (relayMode && !guarded && cause !== "BURN" && cause !== "WATER") {
      rival.hitstun = Math.max(rival.hitstun ?? 0, clamp(0.12 + amount / 1500, 0.12, 0.2));
    }
    if (cause !== "BURN") {
      state.lastHit = { target: "rival", amount: Math.round(amount), source: cause, guarded, hitstun: !guarded && relayMode, at: state.time };
      emit({ type: "RIVAL_HIT", amount, cause, guarded, x: rival.x, y: rival.y });
    }
    if (rival.hp <= 0 && !rival.koCounted) {
      rival.koCounted = true;
      state.kills++;
      if (relayMode && state.relay) state.relay.defeatedCount = (state.relay.defeatedCount ?? 0) + 1;
      emit({ type: "RIVAL_KO", rivalId: rival.definitionId, speciesId: rival.speciesId, kills: state.kills, x: rival.x, y: rival.y });
    }
    return true;
  }

  /** Closest approach of a moving shot to a body within `horizon` seconds. */
  function threatOf(shot, body, horizon) {
    return threatOfShot(shot, body, horizon);
  }

  function nearestEnergyOrb(body, maxDist = 360) {
    if (!relayMode || !state.energyOrbs.length) return null;
    if (body.energy > DATA_ARENA_RELAY.tpMax * 0.55) return null;
    let best = null, bestD = maxDist;
    for (const orb of state.energyOrbs) {
      const od = distance(body.x, body.y, orb.x, orb.y);
      if (od < bestD && hasSight(body.x, body.y, orb.x, orb.y)) { best = orb; bestD = od; }
    }
    return best;
  }

  function chooseRivalGoal(rival) {
    const orbGoal = nearestEnergyOrb(rival);
    const plan = chooseUnifiedGoal({
      body: rival,
      foe: player,
      arenaGoal: orbGoal ?? relayArena?.rivalTarget(rival) ?? null,
      kitReady: kitMoveIds(rival).some((id) => canCast(rival, id)),
      ultReady: rival.ult >= DATA_ARENA_ENERGY.ultMax,
      ultMove: DATA_ARENA_MOVES[rival.kit.ultimate],
      foeUltThreat: player.ult >= DATA_ARENA_ENERGY.ultMax,
      preferredRange: rival.preferredRange,
      worldWidth,
      worldHeight,
      zones: state.zones,
      hostileTeam: "player",
      blocked: (x, y) => blocked(x, y, rival.radius * 0.8, movementKind(rival)),
      burningAt: (x, y) => grid.burningAt(x, y),
      hasSight,
      random
    });
    rival.wantsCover = plan.wantsCover;
    rival.goal = plan.goal;
  }

  function rivalPickMove(rival, d, incomingThreat = false) {
    const diff = AI_DIFFICULTIES[state.aiDifficulty] ?? AI_DIFFICULTIES.normal;
    const ultimateReady = relayMode
      ? rival.energy >= DATA_ARENA_RELAY.ultimateTp && !(rival.cooldowns[rival.kit.ultimate] > 0)
      : rival.ult >= DATA_ARENA_ENERGY.ultMax;
    const rivalTaxEl = relayMode ? speciesTaxonomyForId(rival.speciesId)?.element ?? null : null;
    return pickUnifiedMove({
      body: rival,
      foe: player,
      dist: d,
      relayMode,
      canCast,
      moveFor,
      kitMoveIds: kitMoveIds(rival),
      basicId: rival.basic ?? null,
      ultimateId: rival.kit.ultimate,
      ultimateReady,
      taxonomyMult: relayMode ? (id) => taxonomyMultiplier(attackElementOf(rival, id), player) : null,
      isStab: relayMode && rivalTaxEl ? (id) => attackElementOf(rival, id) === rivalTaxEl : null,
      moveArchetype: relayMode && v2Mode ? (id, m) => resolveMoveSpecV2(id, m).v2Archetype : null,
      incomingThreat,
      choiceNoise: relayMode ? diff.choiceNoise : 0.35,
      random
    });
  }

  function updateRival(rival) {
    rival.hitFlash = Math.max(0, rival.hitFlash - DT);
    rival.invulnerable = Math.max(0, rival.invulnerable - DT);
    rival.dashCooldown = Math.max(0, rival.dashCooldown - DT);
    if (!rival.active || rival.hp <= 0) return;
    // Review stage (loopback move filming only): a held rival is a training dummy that
    // stands still and still takes knockback. Never set in play.
    if (state.reviewHoldRivals === true) { rival.vx = rival.vy = 0; stepKnock(rival); return; }
    const diff = AI_DIFFICULTIES[state.aiDifficulty] ?? AI_DIFFICULTIES.normal;
    tickKit(rival, rival.tier.energyRegen);
    rival.ult = Math.min(DATA_ARENA_ENERGY.ultMax, rival.ult + DT * 3.2);
    const d = distance(rival.x, rival.y, player.x, player.y) || 1;
    if (Math.abs(player.x - rival.x) > 6 && !rival.cast) rival.facing = player.x > rival.x ? 1 : -1;
    // Dodge: react to a shot or zone heading our way using PbRank projectile-intercept math.
    if (rival.dashTimer > 0) {
      rival.dashTimer -= DT;
      const step = (relayMode ? 690 : 980) * DT;
      if (!blocked(rival.x + rival.dashX * step, rival.y + rival.dashY * step, rival.radius * 0.8, movementKind(rival))) { rival.x += rival.dashX * step; rival.y += rival.dashY * step; }
      return;
    }
    let activeThreat = false;
    if (rival.dodge) {
      rival.dodge.wait -= DT;
      if (rival.dodge.wait <= 0) {
        const { dirX, dirY } = rival.dodge;
        const length = Math.hypot(dirX, dirY) || 1;
        let px = -dirY / length, py = dirX / length;
        if (blocked(rival.x + px * 120, rival.y + py * 120, rival.radius, movementKind(rival))) { px = -px; py = -py; }
        rival.dashX = px; rival.dashY = py;
        rival.dashTimer = relayMode ? 0.26 : 0.18;
        rival.invulnerable = relayMode ? 0.26 : 0.22;
        rival.dashCooldown = relayMode ? 2.8 : 2.2;
        rival.cast = null; removeTelegraph(`cast:${rival.id}`);
        rival.dodge = null;
        state.stats.rivalDodges++;
        emit({ type: "RIVAL_DODGE", x: rival.x, y: rival.y });
        return;
      }
    } else if (!rival.lunge) {
      const threat = (pbRankAi
        ? pbRankInterceptDodge({ body: rival, hostileOwner: "player", projectiles: state.projectiles, dangerRadius: diff.dangerRadius, threatSeen: rival.threatSeen })
        : null) ?? detectIncomingThreat({
        body: rival,
        hostileOwner: "player",
        hostileTeam: "player",
        projectiles: state.projectiles,
        zones: state.zones,
        telegraphs: state.telegraphs,
        threatSeen: rival.threatSeen,
        horizon: 0.45
      });
      if (threat) {
        activeThreat = true;
        const dodgeProb = pbRankAi ? diff.dodgeChance : rival.tier.dodge;
        if (rival.dashCooldown <= 0 && random() < dodgeProb) {
          rival.dodge = { wait: pbRankAi ? Math.min(0.08, rival.tier.reaction) : rival.tier.reaction, dirX: threat.dirX, dirY: threat.dirY };
        } else if (relayMode && rival.guardCooldown <= 0 && rival.guardTimer <= 0 && (rival.hitstun ?? 0) <= 0 && threat.t < 0.28 && random() < (pbRankAi ? Math.max(0.25, diff.dodgeChance) : 0.45)) {
          tryStartGuard(rival);
        }
      }
    }
    if (rival.lunge || rival.flurry || rival.backstab || rival.approach) return;
    // Position: PbRank decision cadence + objective/orb priority + corner-waypoint obstacle pathing + spacing/strafing!
    rival.goalTimer -= DT;
    if (rival.goalTimer <= 0 || !rival.goal) {
      chooseRivalGoal(rival);
      rival.goalTimer = pbRankAi ? (diff.decision + random() * diff.decisionJitter) : (0.5 + random() * 0.3);
    }
    rival.strafeTimer -= DT;
    if (rival.strafeTimer <= 0 || (pbRankAi && random() < 0.015)) { rival.strafe = -rival.strafe; rival.strafeTimer = 1.1 + random() * 1.1; }
    let ax = 0, ay = 0;
    const objectiveGoal = pbRankAi ? (nearestEnergyOrb(rival) ?? relayArena?.rivalTarget(rival) ?? null) : null;
    if (pbRankAi && !rival.wantsCover) {
      const targetPt = objectiveGoal ?? player;
      const corner = pbRankCornerWaypoint({
        body: rival, target: targetPt, props: grid.props, cell, pad: 45,
        blocked: (x, y) => blocked(x, y, rival.radius * 0.85, movementKind(rival)),
        hasSight
      });
      if (corner) {
        const cd = distance(rival.x, rival.y, corner.x, corner.y) || 1;
        ax = (corner.x - rival.x) / cd; ay = (corner.y - rival.y) / cd;
      } else {
        const kitMoves = kitMoveIds(rival).map((id) => moveFor(id)).filter(Boolean);
        const meleeCount = kitMoves.filter((m) => m.type === "LUNGE").length;
        const novaCount = kitMoves.filter((m) => m.type === "NOVA").length;
        const idealDist = meleeCount >= 2 ? 115 : novaCount >= 2 ? 170 : 245;
        const sp = pbRankSpacingVector({
          body: rival, target: targetPt, idealDist,
          strafeDir: rival.strafe, strafeWeight: diff.strafe, hasObjective: Boolean(objectiveGoal)
        });
        ax = sp.x; ay = sp.y;
      }
    } else {
      const gap = distance(rival.goal.x, rival.goal.y, rival.x, rival.y);
      if (gap > 40) {
        rival.field.update(rival.goal.x, rival.goal.y, DT, 0.5);
        const direct = gap < cell * 2 && hasSight(rival.x, rival.y, rival.goal.x, rival.goal.y);
        const dir = direct ? { x: (rival.goal.x - rival.x) / gap, y: (rival.goal.y - rival.y) / gap } : rival.field.direction(rival.x, rival.y);
        if (dir) { ax = dir.x; ay = dir.y; }
      } else if (!rival.wantsCover) {
        ax = (-(player.y - rival.y) / d) * rival.strafe; ay = ((player.x - rival.x) / d) * rival.strafe;
      }
    }
    for (const zone of state.zones) {
      if (zone.team !== "player") continue;
      const zd = distance(zone.x, zone.y, rival.x, rival.y);
      if (zd < zone.radius + rival.radius + 20) { ax += (rival.x - zone.x) / (zd || 1) * 2; ay += (rival.y - zone.y) / (zd || 1) * 2; }
    }
    if (grid.burningAt(rival.x, rival.y)) { ax += (rival.x - player.x) / d; ay += (rival.y - player.y) / d; }
    const length = Math.hypot(ax, ay);
    if (length > 1) { ax /= length; ay /= length; }
    const speed = rival.speed * moveScale(rival) * (pbRankAi ? diff.movement : 1);
    const k = Math.min(1, DT * 7);
    rival.vx += (ax * speed - rival.vx) * k; rival.vy += (ay * speed - rival.vy) * k;
    if (rival.hitstun > 0) rival.vx = rival.vy = 0; // staggered: no walking drift; knockback is separate
    moveBody(rival, rival.vx * DT, rival.vy * DT, movementKind(rival));
    stepKnock(rival);
    if (!rival.canSwim && grid.surfaceAt(rival.x, rival.y) === "WATER") {
      const bank = grid.nearestSafeCell(rival.x, rival.y);
      if (bank) { rival.x = bank.x; rival.y = bank.y; damageRival(rival, 12, "WATER"); emit({ type: "RIVAL_SPLASH", x: rival.x, y: rival.y }); chain("DROWN", rival.x, rival.y); }
    }
    if (grid.burningAt(rival.x, rival.y)) damageRival(rival, DATA_ARENA_GRID_RULES.fireDps * DT, "BURN");
    // Attack: PbRank telegraphed casts with velocity-lead aim + difficulty aimError, only with a clear line.
    rival.attackDelay -= DT;
    if (rival.cast || rival.attackDelay > 0 || (pbRankAi && (rival.hitstun ?? 0) > 0)) return; // rooted rivals still fight; they just cannot move
    const playerTargetable = player.state !== "DOWNED" && player.state !== "DEFEATED" && player.state !== "FALLING";
    if (!playerTargetable || !hasSight(rival.x, rival.y, player.x, player.y)) return;
    const pick = rivalPickMove(rival, d, activeThreat);
    if (!pick) return;
    const move = moveFor(pick.id, Boolean(pick.ultimate)) ?? DATA_ARENA_MOVES[pick.id];
    const travel = move.type === "ZONE" ? move.delay : move.speed ? d / move.speed + (move.windup ?? 0) : move.windup ?? 0;
    const lead = pbRankAi ? diff.lead : rival.tier.lead;
    const err = pbRankAi ? diff.aimError : 0;
    const aimX = player.x + player.vx * travel * lead + (random() - 0.5) * err;
    const aimY = player.y + player.vy * travel * lead + (random() - 0.5) * err;
    if (beginCast(rival, pick.id, aimX, aimY, { ultimate: Boolean(pick.ultimate) })) {
      rival.attackDelay = pbRankAi ? (diff.attackDelay + random() * diff.attackJitter) : (0.2 + random() * 0.35);
    }
  }

  // ------------------------------------------------------------------ survival (P4 prototype)
  const survivalOthersLeft = () => state.survival.tamers.filter((tamer) => tamer.state !== "OUT").length;
  function knockOutTamer(tamer, by) {
    if (!tamer || tamer.state === "OUT") return;
    tamer.state = "OUT"; tamer.by = by; tamer.fellAt = state.time;
    if (by === "PLAYER") state.survival.knockouts++;
    emit({ type: "SURVIVAL_OUT", tamer: tamer.index, definitionId: tamer.definitionId, by, left: survivalOthersLeft() });
  }
  /** A spot within the encounter range of the player, inside the safe circle and on open ground, or null. */
  function encounterSpot(circle) {
    const [near, far] = DATA_ARENA_SURVIVAL.encounterRange;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = random() * TAU, reach = near + random() * (far - near);
      const x = player.x + Math.cos(angle) * reach, y = player.y + Math.sin(angle) * reach;
      if (x < 60 || y < 60 || x > worldWidth - 60 || y > worldHeight - 60) continue;
      if (outsideCircle(circle, x, y) || blocked(x, y, 30, "walker")) continue;
      return { x, y };
    }
    return null;
  }
  function startEncounter(tamer, circle) {
    const spot = encounterSpot(circle) ?? { x: circle.cx, y: circle.cy };
    const definition = DATA_ARENA_RIVALS.find((r) => r.id === tamer.definitionId) ?? DATA_ARENA_RIVALS[0];
    const rival = createRival(definition, 0);
    rival.hp = rival.maxHp = Math.max(1, Math.round(rival.maxHp * DATA_ARENA_SURVIVAL.rivalHpScale));
    rival.damageScale *= DATA_ARENA_SURVIVAL.rivalDamageScale;
    rival.x = spot.x; rival.y = spot.y; rival.active = true; rival.invulnerable = 0.8; rival.attackDelay = 1.2;
    rival.tamerIndex = tamer.index;
    tamer.state = "FIGHTING";
    state.rivals.push(rival);
    emit({ type: "SURVIVAL_ENCOUNTER", tamer: tamer.index, definitionId: tamer.definitionId, speciesId: rival.speciesId, x: rival.x, y: rival.y });
  }
  function updateSurvival() {
    const s = state.survival;
    const circle = s.circle = survivalCircleAt(s.storm, state.time);
    if (circle.stage !== s.stage) { s.stage = circle.stage; emit({ type: "STORM_CLOSE", stage: circle.stage, radius: circle.radius }); }
    // The storm drains whoever stands outside, through dodges and shields alike.
    const playerIn = !["DOWNED", "DEFEATED", "FALLING"].includes(player.state);
    if (playerIn && state.mode === "PLAY" && outsideCircle(circle, player.x, player.y)) {
      const amount = circle.drain * player.maxHp * DT;
      player.hp -= amount; state.stats.damageTaken += amount;
      s.stormTick += DT;
      if (s.stormTick >= 1) { s.stormTick = 0; emit({ type: "STORM_HIT", x: player.x, y: player.y }); }
      if (player.hp <= 0) { player.hp = 0.5; player.invulnerable = 0; hurtPlayer(1, "STORM", player.x, player.y); }
    } else s.stormTick = 0;
    for (const rival of state.rivals) {
      if (rival.tamerIndex == null || rival.hp <= 0 || !outsideCircle(circle, rival.x, rival.y)) continue;
      rival.hp -= circle.drain * rival.maxHp * DT;
      if (rival.hp <= 0) { rival.hp = 0.5; rival.invulnerable = 0; rival.stormKo = true; damageRival(rival, 1, "STORM"); }
    }
    // A knocked-out tamer leaves XP crystals and goes after a beat.
    for (const rival of state.rivals) {
      if (rival.tamerIndex == null || rival.hp > 0 || rival.survivalCounted) continue;
      rival.survivalCounted = true; rival.removeAt = state.time + 1.5;
      knockOutTamer(s.tamers.find((t) => t.index === rival.tamerIndex), rival.stormKo ? "STORM" : "PLAYER");
      for (let i = 0; i < 3; i++) state.pickups.push({ id: nextId++, x: rival.x + (i - 1) * 22, y: rival.y + (i % 2) * 18, value: DATA_ARENA_SURVIVAL.rivalXp / 3, age: 0 });
    }
    state.rivals = state.rivals.filter((rival) => !(rival.removeAt != null && state.time >= rival.removeAt));
    const fighting = state.rivals.some((rival) => rival.tamerIndex != null && rival.hp > 0);
    for (const tamer of s.tamers) {
      if (tamer.state === "WAITING" && tamer.fate === "OFFSCREEN" && state.time >= tamer.at) knockOutTamer(tamer, random() < 0.45 ? "STORM" : "TAMER");
    }
    // One tamer at a time comes for the player; once the storm is nearly shut, the rest come in turn.
    const due = s.tamers.filter((t) => t.state === "WAITING" && t.fate === "ENCOUNTER" && (state.time >= t.at || circle.stage >= 5))
      .sort((a, b) => a.at - b.at)[0];
    if (due && !fighting && playerIn && state.mode === "PLAY") startEncounter(due, circle);
    if (!s.won && state.mode === "PLAY" && survivalOthersLeft() === 0 && playerIn) {
      s.won = true; state.mode = "VICTORY_POSE"; state.endTimer = 2.2; laser.firing = false;
      emit({ type: "SURVIVAL_WIN", knockouts: s.knockouts });
    }
  }

  /**
   * Unified Fighter AI for the player's active partner in AUTO / COMMANDER modes.
   * Uses the exact same goal planner, threat detector, cover-seeking, Guard brace,
   * and move selector as rival fighters.
   *  - AUTO: AI moves, dodges, guards, and attacks; any player skill press becomes
   *    a priority Trainer Callout (`CALLED_MOVE`) that fires as soon as the fighter is free.
   *  - COMMANDER: AI handles movement, dodging, and guarding; only the player casts moves.
   */
  function computePlayerAutoInput(rawInput) {
    const rival = state.rivals[0];
    if (!relayMode || state.controlMode === "MANUAL" || state.tournament?.status !== "FIGHT") return rawInput;
    if (!rival || !rival.active || rival.hp <= 0 || player.state !== "NORMAL" || player.hp <= 0) return rawInput;
    const ai = player.ai;
    const out = { ...rawInput };
    // Trainer priority callout: in AUTO mode, pressing a move/ult queues it ahead of AI picks.
    if (state.controlMode === "AUTO") {
      if (rawInput.ult) {
        ai.calledMove = { kind: "ULT", moveId: player.kit.ultimate, left: 1.6 };
        emit({ type: "TRAINER_CALLOUT", moveId: player.kit.ultimate, ultimate: true, x: player.x, y: player.y });
      } else if (Number.isInteger(rawInput.cast) && rawInput.cast >= 0 && rawInput.cast < kitMoveIds(player).length) {
        const mid = kitMoveIds(player)[rawInput.cast];
        ai.calledMove = { kind: "SLOT", slot: rawInput.cast, moveId: mid, left: 1.6 };
        emit({ type: "TRAINER_CALLOUT", moveId: mid, ultimate: false, x: player.x, y: player.y });
      } else if (rawInput.fire) {
        const basicId = RELAY_ACTION_PROFILES[partner.id]?.basic ?? null;
        if (basicId) {
          ai.calledMove = { kind: "BASIC", moveId: basicId, left: 1.0 };
          emit({ type: "TRAINER_CALLOUT", moveId: basicId, ultimate: false, x: player.x, y: player.y });
        }
      }
      if (ai.calledMove) {
        ai.calledMove.left -= DT;
        if (ai.calledMove.left <= 0) ai.calledMove = null;
      }
    }
    const d = distance(player.x, player.y, rival.x, rival.y) || 1;
    // Threat reaction: PbRank projectile-intercept dodge or precision Guard (respecting aiSettings.autoGuard).
    let playerThreat = false;
    if (!player.lunge && !player.flurry && !player.backstab && !out.dash && !out.guard) {
      const threat = pbRankInterceptDodge({
        body: player,
        hostileOwner: "rival",
        projectiles: state.projectiles,
        dangerRadius: 165,
        threatSeen: ai.threatSeen
      }) ?? detectIncomingThreat({
        body: player,
        hostileOwner: "rival",
        hostileTeam: "rival",
        projectiles: state.projectiles,
        zones: state.zones,
        telegraphs: state.telegraphs,
        threatSeen: ai.threatSeen,
        horizon: 0.45
      });
      if (threat) {
        playerThreat = true;
        const dodgeProb = speedScaledDodgeChance(stat.speed);
        if (player.dashCharges > 0 && player.root <= 0 && player.guardTimer <= 0 && random() < dodgeProb) {
          const len = Math.hypot(threat.dirX, threat.dirY) || 1;
          let px = -threat.dirY / len, py = threat.dirX / len;
          if (blocked(player.x + px * 110, player.y + py * 110, player.radius, movementKind(player))) { px = -px; py = -py; }
          out.moveX = px; out.moveY = py; out.dash = true;
        } else if (state.aiSettings.autoGuard !== false && player.guardCooldown <= 0 && player.guardTimer <= 0 && (player.hitstun ?? 0) <= 0 && threat.t < 0.32) {
          out.guard = true;
        }
      }
    }
    // Movement: PbRank corner-waypoint obstacle pathing + ideal spacing & lateral strafe + Energy Orb / Arena objective priority!
    const manualSteer = Math.hypot(rawInput.moveX, rawInput.moveY) > 0.08;
    if (!manualSteer && !out.dash && !player.lunge) {
      ai.goalTimer -= DT;
      const basicDef = moveFor(RELAY_ACTION_PROFILES[partner.id]?.basic);
      const prefRange = basicDef?.type === "LUNGE" ? 95 : basicDef?.type === "NOVA" ? 160 : 320;
      const objectiveGoal = nearestEnergyOrb(player) ?? relayArena?.zoneTargetFor?.(player, 0) ?? relayArena?.rivalTarget(player) ?? null;
      if (ai.goalTimer <= 0 || !ai.goal) {
        const plan = chooseUnifiedGoal({
          body: player,
          foe: rival,
          arenaGoal: objectiveGoal,
          kitReady: kitMoveIds(player).some((id) => canCast(player, id)),
          ultReady: player.energy >= DATA_ARENA_RELAY.ultimateTp && !(player.cooldowns[player.kit.ultimate] > 0),
          ultMove: moveFor(player.kit.ultimate, true),
          foeUltThreat: rival.energy >= DATA_ARENA_RELAY.ultimateTp,
          preferredRange: prefRange,
          worldWidth,
          worldHeight,
          zones: state.zones,
          hostileTeam: "rival",
          blocked: (x, y) => blocked(x, y, player.radius * 0.8, movementKind(player)),
          burningAt: (x, y) => grid.burningAt(x, y),
          hasSight,
          random
        });
        ai.wantsCover = plan.wantsCover;
        ai.goal = plan.goal;
        ai.goalTimer = 0.28 + random() * 0.14;
      }
      ai.strafeTimer -= DT;
      if (ai.strafeTimer <= 0 || random() < 0.015) { ai.strafe = -ai.strafe; ai.strafeTimer = 1.0 + random() * 1.0; }
      let ax = 0, ay = 0;
      if (!ai.wantsCover) {
        const targetPt = objectiveGoal ?? rival;
        const corner = pbRankCornerWaypoint({
          body: player, target: targetPt, props: grid.props, cell, pad: 45,
          blocked: (x, y) => blocked(x, y, player.radius * 0.85, movementKind(player)),
          hasSight
        });
        if (corner) {
          const cd = distance(player.x, player.y, corner.x, corner.y) || 1;
          ax = (corner.x - player.x) / cd; ay = (corner.y - player.y) / cd;
        } else {
          const sp = pbRankSpacingVector({
            body: player, target: targetPt, idealDist: prefRange,
            strafeDir: ai.strafe, strafeWeight: 0.36, hasObjective: Boolean(objectiveGoal)
          });
          ax = sp.x; ay = sp.y;
        }
      } else {
        const gap = distance(ai.goal.x, ai.goal.y, player.x, player.y);
        if (gap > 38) {
          ai.field.update(ai.goal.x, ai.goal.y, DT, 0.5);
          const direct = gap < cell * 2 && hasSight(player.x, player.y, ai.goal.x, ai.goal.y);
          const dir = direct ? { x: (ai.goal.x - player.x) / gap, y: (ai.goal.y - player.y) / gap } : ai.field.direction(player.x, player.y);
          if (dir) { ax = dir.x; ay = dir.y; }
        }
      }
      for (const zone of state.zones) {
        if (zone.team !== "rival") continue;
        const zd = distance(zone.x, zone.y, player.x, player.y);
        if (zd < zone.radius + player.radius + 20) {
          ax += (player.x - zone.x) / (zd || 1) * 2;
          ay += (player.y - zone.y) / (zd || 1) * 2;
        }
      }
      if (grid.burningAt(player.x, player.y)) { ax += (player.x - rival.x) / d; ay += (player.y - rival.y) / d; }
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      out.moveX = ax; out.moveY = ay;
    }
    // Aim towards active rival with lead prediction when auto-aiming.
    out.aimX = rival.x + rival.vx * 0.16;
    out.aimY = rival.y + rival.vy * 0.16;
    out.autoAim = true;
    // Casting: in AUTO mode, execute priority Trainer Callout first, else pick unified move using PbRank contextual scoring.
    if (state.controlMode === "AUTO") {
      const free = !player.cast && !player.lunge && player.recovery <= 0 && player.guardTimer <= 0 && (player.hitstun ?? 0) <= 0;
      if (free && ai.calledMove) {
        const req = ai.calledMove;
        if (req.kind === "ULT" && canCast(player, player.kit.ultimate) && player.energy >= DATA_ARENA_RELAY.ultimateTp) {
          out.ult = true; ai.calledMove = null; return out;
        }
        if (req.kind === "SLOT" && canCast(player, req.moveId)) {
          out.cast = req.slot; ai.calledMove = null; return out;
        }
        if (req.kind === "BASIC" && canCast(player, req.moveId)) {
          out.fire = true; ai.calledMove = null; return out;
        }
      }
      ai.attackDelay -= DT;
      if (free && state.aiSettings.autoAttack !== false && ai.attackDelay <= 0 && hasSight(player.x, player.y, rival.x, rival.y)) {
        const basicId = RELAY_ACTION_PROFILES[partner.id]?.basic ?? null;
        const ultimateReady = player.energy >= DATA_ARENA_RELAY.ultimateTp && !(player.cooldowns[player.kit.ultimate] > 0);
        const playerTaxEl = speciesTaxonomyForId(player.speciesId)?.element ?? null;
        const pick = pickUnifiedMove({
          body: player,
          foe: rival,
          dist: d,
          relayMode,
          canCast,
          moveFor,
          kitMoveIds: kitMoveIds(player),
          basicId,
          ultimateId: player.kit.ultimate,
          ultimateReady,
          taxonomyMult: (id) => taxonomyMultiplier(attackElementOf(player, id), rival),
          isStab: playerTaxEl ? (id) => attackElementOf(player, id) === playerTaxEl : null,
          moveArchetype: v2Mode ? (id, m) => resolveMoveSpecV2(id, m).v2Archetype : null,
          incomingThreat: playerThreat,
          choiceNoise: 0.25,
          random
        });
        if (pick) {
          const move = moveFor(pick.id, Boolean(pick.ultimate));
          const travel = move?.type === "ZONE" ? move.delay : move?.speed ? d / move.speed + (move.windup ?? 0) : move?.windup ?? 0;
          out.aimX = rival.x + rival.vx * travel * 0.65;
          out.aimY = rival.y + rival.vy * travel * 0.65;
          out.autoAim = false;
          if (pick.ultimate) out.ult = true;
          else if (pick.id === basicId) out.fire = true;
          else {
            const slotIdx = kitMoveIds(player).indexOf(pick.id);
            if (slotIdx >= 0) out.cast = slotIdx;
          }
          ai.attackDelay = 0.24 + random() * 0.28;
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ tournament flow
  function resetArenaForRound() {
    grid.resetDynamic();
    state.projectiles.length = 0; state.zones.length = 0; state.telegraphs.length = 0; state.surges.length = 0;
    for (const pod of state.pods) { pod.hp = DATA_ARENA_GRID_RULES.podHp; pod.respawn = 0; }
    const spawn = at(map.playerSpawn);
    Object.assign(player, { x: spawn.x, y: spawn.y, vx: 0, vy: 0, hp: player.maxHp, state: "NORMAL", stateTime: 0, invulnerable: 0, dashGrace: 0,
      energy: DATA_ARENA_ENERGY.max, cast: null, lunge: null, barrier: 0, slow: 0, slowTimer: 0, root: 0, burn: 0, facing: 1 });
    player.cooldowns = Object.create(null);
    player.dashCharges = stat.dashCharges; player.dashRecharge = 0; player.kbx = player.kby = 0;
    kitBuffer = null;
    laser.heat = 0; laser.overheated = false; laser.firing = false; laser.angle = -Math.PI / 2;
  }

  function startRound(index) {
    const t = state.tournament;
    t.round = index; t.status = "INTRO"; t.timer = DATA_ARENA_TOURNAMENT.introSeconds; t.roundTime = 0; t.winner = null;
    resetArenaForRound();
    const definition = DATA_ARENA_RIVALS.find((rival) => rival.id === t.order[index]);
    state.rivals = [createRival(definition, index)];
    emit({ type: "ROUND_INTRO", round: index, rounds: DATA_ARENA_TOURNAMENT.rounds, rivalId: definition.id, speciesId: definition.speciesId });
  }

  function endRound(winner, reason) {
    const t = state.tournament;
    if (t.status !== "FIGHT") return;
    t.status = "KO"; t.timer = DATA_ARENA_TOURNAMENT.koSeconds; t.winner = winner;
    const rival = state.rivals[0];
    for (const shot of state.projectiles) shot.dead = true;
    state.zones.length = 0; state.telegraphs.length = 0;
    if (rival) { rival.cast = null; rival.lunge = null; }
    player.cast = null; player.lunge = null; laser.firing = false;
    if (winner === "player") {
      state.stats.roundsWon++;
      const left = Math.max(0, DATA_ARENA_TOURNAMENT.roundSeconds - t.roundTime);
      const gained = DATA_ARENA_TOURNAMENT.roundWinScore + Math.round(player.hp * DATA_ARENA_TOURNAMENT.perHpLeft) + Math.round(left * DATA_ARENA_TOURNAMENT.perSecondLeft);
      state.score += gained;
      t.results.push({ round: t.round, rivalId: rival?.definitionId, won: true, reason, seconds: Math.round(t.roundTime * 10) / 10, score: gained });
      addHype("ROUND_WIN", rival?.x ?? player.x, rival?.y ?? player.y);
    } else t.results.push({ round: t.round, rivalId: rival?.definitionId, won: false, reason, seconds: Math.round(t.roundTime * 10) / 10, score: 0 });
    emit({ type: winner === "player" ? "ROUND_WON" : "ROUND_LOST", round: t.round, reason, x: rival?.x, y: rival?.y });
  }

  function updateTournament() {
    if (relayMode) { updateRelay(); return; }
    const t = state.tournament;
    if (!t) return;
    const rival = state.rivals[0];
    if (t.status === "INTRO") {
      t.timer -= DT;
      if (t.timer <= 0) { t.status = "FIGHT"; if (rival) rival.active = true; emit({ type: "ROUND_START", round: t.round }); }
      return;
    }
    if (t.status === "FIGHT") {
      t.roundTime += DT;
      if (rival && rival.hp <= 0) endRound("player", "KO");
      else if (player.hp <= 0 || player.state === "DEFEATED") endRound("rival", "KO");
      else if (t.roundTime >= DATA_ARENA_TOURNAMENT.roundSeconds) {
        const mine = player.hp / player.maxHp, theirs = rival ? rival.hp / rival.maxHp : 0;
        endRound(mine >= theirs ? "player" : "rival", "TIME");
      }
      return;
    }
    if (t.status === "KO") {
      t.timer -= DT;
      if (t.timer > 0) return;
      if (t.winner !== "player") { finish("DEFEAT"); return; }
      if (t.round >= DATA_ARENA_TOURNAMENT.rounds - 1) { finish("VICTORY"); return; }
      t.status = "BETWEEN";
      state.pendingLevels = 1;
      openOffer();
    }
  }

  // Relay team orchestration. Benched members preserve HP, TP and cooldowns;
  // no restoration on switching, and no progression writes.
  const relayFields = ['hp', 'maxHp', 'energy', 'energySpentAt', 'cooldowns', 'ult', 'burn', 'slow', 'slowTimer', 'root', 'dashCharges', 'dashRecharge', 'healsUsed', 'decoyUsed'];
  function saveRelayPlayer() {
    const entry = state.relay.team[state.relay.active];
    for (const key of relayFields) entry[key] = player[key];
  }
  function isPerfectSwitchWindow() {
    const windowSec = DATA_ARENA_RELAY.perfectSwitchWindow ?? 0.45;
    const rival = state.rivals[0];
    if (rival && rival.active && rival.hp > 0 && rival.cast && (rival.cast.windup - rival.cast.t) <= windowSec) return true;
    for (const t of state.telegraphs) {
      if ((t.team && t.team !== 'player') || t.danger || (t.owner && t.owner !== `cast:${player.id}`)) {
        if ((t.duration ?? 0) - (t.t ?? 0) <= windowSec || (t.t ?? 0) >= (t.duration ?? 0) * 0.2) return true;
      }
    }
    for (const p of state.projectiles) {
      if (!p.dead && p.owner !== 'player' && p.owner !== 'mate' && distance(p.x, p.y, player.x, player.y) <= (p.radius ?? 10) + player.radius + 95) return true;
    }
    return false;
  }
  function switchRelayPlayer(forced = false, targetSlot = null) {
    const relay = state.relay;
    if (!relay || (!forced && (relay.switchCooldown > 0 || player.state !== 'NORMAL' || player.cast || player.lunge || player.recovery > 0))) return false;
    let index = -1;
    if (Number.isInteger(targetSlot) && targetSlot >= 0 && targetSlot < relay.team.length && targetSlot !== relay.active && relay.team[targetSlot].hp > 0) {
      index = targetSlot;
    } else {
      index = relay.team.findIndex((entry, i) => i !== relay.active && entry.hp > 0);
    }
    if (index < 0) return false;
    const perfectSwitch = !forced && isPerfectSwitchWindow();
    const leaving = relay.team[relay.active]?.burst;
    if (leaving && (leaving.phase === 'BURST' || leaving.phase === 'WEAK')) { leaving.phase = 'SPENT'; revertArenaForm(player, leaving); emit({ type: 'BURST_END', side: 'player', form: leaving.form, x: player.x, y: player.y }); }
    player.burstPartnerId = null;
    // Combat Wave 5: Outgoing passive abilities on switch-out (REGENERATOR +18% HP / NATURAL_CURE instant cleanse)
    const outgoingAb = partnerAbilityFor(partner);
    if (!forced && player.hp > 0 && outgoingAb?.id === "REGENERATOR") {
      const regenAmt = Math.max(1, Math.round(player.maxHp * 0.18));
      player.hp = Math.min(player.maxHp, player.hp + regenAmt);
      emit({ type: "ABILITY_PROC", side: "player", abilityId: "REGENERATOR", amount: regenAmt, x: player.x, y: player.y });
    } else if (!forced && player.hp > 0 && outgoingAb?.id === "NATURAL_CURE" && ((player.burn ?? 0) > 0 || (player.poison ?? 0) > 0 || (player.paralyze ?? 0) > 0 || (player.slow ?? 0) > 0)) {
      player.burn = 0; player.poison = 0; player.poisonStacks = 0; player.paralyze = 0; player.slow = 0; player.slowTimer = 0;
      emit({ type: "ABILITY_PROC", side: "player", abilityId: "NATURAL_CURE", x: player.x, y: player.y });
    }
    saveRelayPlayer(); relay.active = index;
    const entry = relay.team[index];
    partner = relayPartner(entry.partnerId);
    for(const key of Object.keys(upgrades))delete upgrades[key];Object.assign(upgrades,partner.startingUpgrades);
    for (const key of relayFields) player[key] = entry[key];
    Object.assign(player, { partnerId: partner.id, speciesId: partner.speciesId, canSwim: partner.canSwim === true, kit: relayKit(partner.id, relayLoadouts[partner.id]),
      state: 'NORMAL', stateTime: 0, cast: null, lunge: null, action: null, recovery: 0, barrier: 0, hitFlash: 0,
      guardTimer: 0, guardCooldown: 0, guardBlocked: false, barrierStreak: 0,
      atkStage: 0, defStage: 0, spdStage: 0, buffsUsed: 0, healsUsed: entry.healsUsed ?? 0,
      abilityCooldown: 0, flashFireBoosted: false, intimidateTimer: 0, speedBoostTimer: 0,
      decoy: null, decoyUsed: Boolean(entry.decoyUsed),
      counterTimer: 0, flurry: null, backstab: null, approach: null,
      slow: 0, slowTimer: 0, root: 0, burn: 0, paralyze: 0, paralyzeTick: 0, poison: 0, poisonStacks: 0, sleep: 0, wet: 0, ccImmune: 0,
      vx: 0, vy: 0, kbx: 0, kby: 0, dashTimer: 0, dashGrace: 0,
      invulnerable: forced ? 0.8 : (perfectSwitch ? 0.55 : 0.35),
      tagShield: forced ? 0 : (DATA_ARENA_RELAY.tagShieldSeconds ?? 1.2) });
    // Incoming passive ability: INTIMIDATE lowers rival's outgoing damage by 15% for 6s!
    const incomingAb = partnerAbilityFor(partner);
    const foeOnEntry = state.rivals[0];
    if (incomingAb?.id === "INTIMIDATE" && foeOnEntry && foeOnEntry.active && foeOnEntry.hp > 0) {
      foeOnEntry.intimidateTimer = Math.max(foeOnEntry.intimidateTimer ?? 0, 6.0);
      emit({ type: "ABILITY_PROC", side: "player", abilityId: "INTIMIDATE", x: player.x, y: player.y });
    }
    if (player.ai) { player.ai.calledMove = null; player.ai.goal = null; player.ai.threatSeen.clear(); }
    triggerSwitchHazard(player, 'player');
    // Switching never moves a land creature into an impassable cell.
    if (blocked(player.x, player.y, player.radius, movementKind(player))) {
      const bank = grid.nearestSafeCell(player.x, player.y); if (bank) { player.x = bank.x; player.y = bank.y; }
    }
    relay.switchCooldown = DATA_ARENA_RELAY.switchCooldown; relay.playerDownAt = null;
    kitBuffer = null; removeTelegraph(`cast:${player.id}`); laser.firing = false;
    emit({ type: 'RELAY_SWITCH', partnerId: partner.id, speciesId: partner.speciesId, slot: index, forced, perfect: perfectSwitch, x: player.x, y: player.y });
    emit({ type: 'DEPLOY_SHIELD', casterId: player.id, team: 'player', x: player.x, y: player.y, duration: player.invulnerable });
    if (!forced) {
      if (perfectSwitch) {
        player.energy = Math.min(DATA_ARENA_RELAY.tpMax, player.energy + (DATA_ARENA_RELAY.perfectSwitchTp ?? 25));
        addHype('PERFECT_DODGE', player.x, player.y);
        emit({ type: 'RELAY_PERFECT_SWITCH', partnerId: partner.id, speciesId: partner.speciesId, tpGain: DATA_ARENA_RELAY.perfectSwitchTp ?? 25, x: player.x, y: player.y });
      }
      const rival = state.rivals[0];
      const shockRadius = (DATA_ARENA_RELAY.tagShockwaveRadius ?? 135) + (perfectSwitch ? 35 : 0);
      const shockDamage = (DATA_ARENA_RELAY.tagShockwaveDamage ?? 28) * (perfectSwitch ? 2 : 1) * (1 + upgradeValue(upgrades, "tagShock"));
      if (rival && rival.active && rival.hp > 0) {
        const d0 = distance(rival.x, rival.y, player.x, player.y) || 1;
        if (d0 > 58) moveBody(player, ((rival.x - player.x) / d0) * 26, ((rival.y - player.y) / d0) * 26, movementKind(player));
        const d = distance(rival.x, rival.y, player.x, player.y) || 1;
        if ((d <= shockRadius + rival.radius || (perfectSwitch && d <= 280)) && hasSight(player.x, player.y, rival.x, rival.y)) {
          const basicId = RELAY_ACTION_PROFILES[partner.id]?.basic ?? 'relaySlash';
          strike(rival, shockDamage * stat.skillDamage, 'TAG_BURST', { slow: 0.35, slowSeconds: 0.9 }, rival.x, rival.y, coverElement(player, basicId), attackElementOf(player, basicId), false);
          launch(rival, (rival.x - player.x) / d, (rival.y - player.y) / d, perfectSwitch ? 380 : 300);
        }
      }
      emit({ type: 'RELAY_TAG_BURST', partnerId: partner.id, speciesId: partner.speciesId, element: casterElement(player), x: player.x, y: player.y, radius: shockRadius, perfect: perfectSwitch, damage: Math.round(shockDamage) });
    }
    return true;
  }
  function triggerTriLinkRush(originX, originY) {
    const relay = state.relay;
    if (!relay) return;
    player.energy = Math.min(DATA_ARENA_RELAY.tpMax, player.energy + (DATA_ARENA_RELAY.triLinkTpGain ?? 30));
    const rival = state.rivals[0];
    const dmg = (DATA_ARENA_RELAY.triLinkDamage ?? 92) * stat.skillDamage;
    if (rival && rival.active && rival.hp > 0) {
      const basicId = RELAY_ACTION_PROFILES[partner.id]?.basic ?? 'relaySlash';
      strike(rival, dmg, 'TRI_LINK', { slow: 0.45, slowSeconds: 1.2 }, rival.x, rival.y, coverElement(player, basicId), attackElementOf(player, basicId), false);
      const d = distance(rival.x, rival.y, player.x, player.y) || 1;
      launch(rival, (rival.x - player.x) / d, (rival.y - player.y) / d, 360);
    }
    state.score += 600;
    emit({
      type: 'TRI_LINK_RUSH',
      x: rival?.x ?? originX, y: rival?.y ?? originY,
      originX, originY,
      damage: Math.round(dmg),
      members: relay.team.map((e, idx) => ({ slot: idx, partnerId: e.partnerId, speciesId: e.speciesId, element: rosterElement.get(e.speciesId) ?? 'fire' }))
    });
  }
  function relayRival(index) {
    // Journey zones (2026-11-10) bring their own three rivals; otherwise the arena's.
    const definition = relayRivals?.[index] ?? DATA_ARENA_RIVALS[index % DATA_ARENA_RIVALS.length];
    const rival = createRival({ ...definition, hp: Math.round(definition.hp * DATA_ARENA_RELAY.rivalHpScale) }, Math.min(index, 1));
    rival.basic = RELAY_ACTION_PROFILES[RELAY_ROSTER.find(p => p.speciesId === definition.speciesId)?.id]?.basic ?? 'relaySlash';
    rival.active = true; rival.burst = arenaBurstPlan(definition.speciesId); rival.burstSpeciesId = null; rival.koCounted = false; return rival;
  }
  function updateRelay() {
    const relay = state.relay, t = state.tournament;
    if (t.status === 'INTRO') { t.timer -= DT; if (t.timer <= 0) { t.status = 'FIGHT'; state.rivals[0].active = true; emit({ type: 'ROUND_START', round: 0 }); } return; }
    if (t.status === 'KO') { t.timer -= DT; if (t.timer <= 0) finish(t.winner === 'player' ? 'VICTORY' : t.winner === 'draw' ? 'DRAW' : 'DEFEAT'); return; }
    t.roundTime += DT;
    const sdMult = suddenDeathMultiplier(t.roundTime, DATA_ARENA_RELAY.seconds);
    if (sdMult > 1 && !state.suddenDeath.active) {
      state.suddenDeath.active = true;
      emit({ type: 'SUDDEN_DEATH', multiplier: sdMult });
    }
    state.suddenDeath.multiplier = sdMult;
    if (state.weather.kind) {
      state.weather.remaining = Math.max(0, state.weather.remaining - DT);
      if (state.weather.kind === "SAND" || state.weather.kind === "HAIL") {
        state.weather.tickTimer -= DT;
        if (state.weather.tickTimer <= 0) {
          state.weather.tickTimer = WEATHER_RULES.chipInterval;
          for (const body of [player, state.rivals[0]]) {
            if (!body || body.hp <= 1 || (body !== player && !body.active)) continue;
            if (weatherImmune(state.weather.kind, casterElement(body))) continue;
            const chip = Math.max(1, Math.round(body.maxHp * WEATHER_RULES.chipShare));
            body.hp = Math.max(1, body.hp - chip);
            emit({ type: "WEATHER_CHIP", side: body === player ? "player" : "rival", kind: state.weather.kind, amount: chip, x: body.x, y: body.y });
          }
        }
      }
      if (state.weather.remaining <= 0) {
        const ended = state.weather.kind;
        state.weather.kind = null;
        emit({ type: "WEATHER_END", kind: ended });
      }
    }
    if (player.tagShield > 0) player.tagShield = Math.max(0, player.tagShield - DT);
    if (relay.rivalSwitchCooldown > 0) relay.rivalSwitchCooldown = Math.max(0, relay.rivalSwitchCooldown - DT);
    relayArena?.step(DT, t.roundTime);
    if (resonant('LUMEN') && player.hp > 0 && t.roundTime - relay.regenAt >= TAXONOMY_RESONANCE.LUMEN.regenSeconds) {
      relay.regenAt = t.roundTime;
      if (player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * TAXONOMY_RESONANCE.LUMEN.regenPercent / 100); emit({ type: 'RESONANCE_REGEN', x: player.x, y: player.y }); }
    }
    // Cooldowns tick on the bench; PbRank 6s Bench Cleanse purifies lingering ailments off-field!
    relay.team.forEach((entry, i) => {
      if (i !== relay.active) {
        for (const id in entry.cooldowns) entry.cooldowns[id] = Math.max(0, entry.cooldowns[id] - DT);
        entry.benchTime = (entry.benchTime ?? 0) + DT;
        if (entry.benchTime >= 6.0) {
          entry.burn = 0; entry.slow = 0; entry.slowTimer = 0; entry.root = 0;
          entry.paralyze = 0; entry.poison = 0; entry.poisonStacks = 0; entry.sleep = 0; entry.wet = 0;
        }
      } else {
        entry.benchTime = 0;
      }
    });
    relay.rivals.forEach((benchRival, i) => {
      if (i !== relay.enemyIndex && benchRival.hp > 0) {
        for (const id in benchRival.cooldowns) benchRival.cooldowns[id] = Math.max(0, benchRival.cooldowns[id] - DT);
        benchRival.benchTime = (benchRival.benchTime ?? 0) + DT;
        if (benchRival.benchTime >= 6.0) {
          benchRival.burn = 0; benchRival.slow = 0; benchRival.slowTimer = 0; benchRival.root = 0;
          benchRival.paralyze = 0; benchRival.poison = 0; benchRival.poisonStacks = 0; benchRival.sleep = 0; benchRival.wet = 0;
        }
      } else {
        benchRival.benchTime = 0;
      }
    });
    // PbRank periodic Arena Energy/PP Orbs (spawns every 10-14s, max 2): restores +28 TP & trims -1.5s cooldowns!
    state.energyOrbTimer -= DT;
    if (state.energyOrbTimer <= 0) {
      state.energyOrbTimer = 10 + random() * 4;
      if (state.energyOrbs.length < 2) {
        for (let tries = 0; tries < 14; tries++) {
          const ox = 120 + random() * Math.max(120, worldWidth - 240);
          const oy = 110 + random() * Math.max(110, worldHeight - 220);
          if (blocked(ox, oy, 26, "walker")) continue;
          if (state.energyOrbs.some((o) => distance(o.x, o.y, ox, oy) < 150)) continue;
          const orb = { id: nextId++, x: ox, y: oy, bornAt: state.time };
          state.energyOrbs.push(orb);
          emit({ type: "ENERGY_ORB_SPAWN", id: orb.id, x: ox, y: oy });
          break;
        }
      }
    }
    if (state.energyOrbs.length) {
      const collectors = [player, state.rivals[0]].filter((b) => b && b.hp > 0 && (b === player ? player.state === "NORMAL" : b.active));
      for (let i = state.energyOrbs.length - 1; i >= 0; i--) {
        const orb = state.energyOrbs[i];
        const taker = collectors.find((b) => distance(b.x, b.y, orb.x, orb.y) <= (b.radius ?? 20) + 22);
        if (!taker) continue;
        taker.energy = Math.min(DATA_ARENA_RELAY.tpMax, taker.energy + 28);
        for (const cid in taker.cooldowns) taker.cooldowns[cid] = Math.max(0, taker.cooldowns[cid] - 1.5);
        state.energyOrbs.splice(i, 1);
        emit({ type: "ENERGY_ORB_PICKUP", id: orb.id, side: taker === player ? "player" : "rival", x: orb.x, y: orb.y, tpGain: 28 });
      }
    }
    const rival = state.rivals[0];
    stepArenaBurst(player, burstOfBody(player), 'player'); stepArenaBurst(rival, rival.burst, 'rival');
    if (player.hp <= 0) {
      if (relay.playerDownAt === null) relay.fainted = (relay.fainted ?? 0) + 1;
      relay.playerDownAt ??= state.time;
      player.cast = player.lunge = player.action = null; removeTelegraph(`cast:${player.id}`);
      if (state.time - relay.playerDownAt >= DATA_ARENA_RELAY.knockoutSeconds) switchRelayPlayer(true);
    }
    if (rival.hp <= 0) {
      relay.enemyDownAt ??= state.time;
      rival.cast = rival.lunge = rival.action = null; removeTelegraph(`cast:${rival.id}`);
      const nextRivalIdx = relay.rivals.findIndex((r, idx) => idx !== relay.enemyIndex && r.hp > 0);
      if (nextRivalIdx >= 0 && state.time - relay.enemyDownAt >= DATA_ARENA_RELAY.knockoutSeconds) {
        relay.enemyIndex = nextRivalIdx; relay.enemyDownAt = null;
        const nextRival = relay.rivals[nextRivalIdx];
        nextRival.active = true; nextRival.invulnerable = 0.5;
        nextRival.atkStage = 0; nextRival.defStage = 0; nextRival.spdStage = 0; nextRival.buffsUsed = 0;
        nextRival.counterTimer = 0; nextRival.flurry = null; nextRival.backstab = null; nextRival.approach = null;
        triggerSwitchHazard(nextRival, 'rival');
        state.rivals = [nextRival];
        state.score += 1000; emit({ type: 'RELAY_RIVAL', rivalId: nextRival.definitionId, speciesId: nextRival.speciesId, enemyIndex: nextRivalIdx, x: nextRival.x, y: nextRival.y });
        emit({ type: 'DEPLOY_SHIELD', casterId: nextRival.id, team: 'rival', x: nextRival.x, y: nextRival.y, duration: nextRival.invulnerable });
        // A Journey zone stage offers a three-choice buff between waves; the relay pauses on it.
        if (relayBuffPicks) { state.pendingLevels++; openOffer(); }
      }
    } else if (relay.rivalSwitchCooldown <= 0 && !rival.cast && !rival.lunge) {
      // Wave 2 Smart 3v3 AI Switch: evaluates low HP, elemental counter-matchups & ailment bench-cleanse!
      const playerBasicId = RELAY_ACTION_PROFILES[partner.id]?.basic ?? 'relaySlash';
      const playerAtkEl = attackElementOf(player, playerBasicId);
      const benchIdx = evaluateSmartSwitch({
        active: rival,
        bench: relay.rivals,
        activeIdx: relay.enemyIndex,
        incomingMultOf: (cand) => taxonomyMultiplier(playerAtkEl, cand),
        outgoingMultOf: (cand) => taxonomyMultiplier(attackElementOf(cand, cand.basic ?? 'relaySlash'), player),
        difficulty: state.aiDifficulty,
        switchCooldown: relay.rivalSwitchCooldown,
        roundTime: t.roundTime
      });
      if (benchIdx >= 0) {
        rival.active = false; rival.cast = rival.lunge = rival.action = null; removeTelegraph(`cast:${rival.id}`);
        const incoming = relay.rivals[benchIdx];
        incoming.x = rival.x; incoming.y = rival.y; incoming.active = true; incoming.invulnerable = 0.45; incoming.barrierStreak = 0;
        incoming.atkStage = 0; incoming.defStage = 0; incoming.spdStage = 0; incoming.buffsUsed = 0;
        incoming.counterTimer = 0; incoming.flurry = null; incoming.backstab = null; incoming.approach = null;
        triggerSwitchHazard(incoming, 'rival');
        relay.enemyIndex = benchIdx; relay.rivalSwitchCooldown = state.aiDifficulty === "hard" ? 16 : 22;
        state.rivals = [incoming];
        emit({ type: 'RELAY_RIVAL_SWITCH', rivalId: incoming.definitionId, speciesId: incoming.speciesId, enemyIndex: benchIdx, x: incoming.x, y: incoming.y });
        emit({ type: 'DEPLOY_SHIELD', casterId: incoming.id, team: 'rival', x: incoming.x, y: incoming.y, duration: incoming.invulnerable });
      }
    }
    // Wave 2: Player AUTO mode smart 3v3 tag-out when endangered / countered & reserve is healthy
    if (state.controlMode === "AUTO" && player.hp > 0 && rival && rival.active && rival.hp > 0 && relay.switchCooldown <= 0) {
      const rivalAtkEl = attackElementOf(rival, rival.basic ?? 'relaySlash');
      const autoSlot = evaluateSmartSwitch({
        active: player,
        bench: relay.team,
        activeIdx: relay.active,
        incomingMultOf: (cand) => taxonomyMultiplier(rivalAtkEl, cand),
        outgoingMultOf: (cand) => {
          const bId = RELAY_ACTION_PROFILES[cand.partnerId]?.basic ?? 'relaySlash';
          return taxonomyMultiplier(attackElementOf(cand, bId), rival);
        },
        difficulty: "normal",
        switchCooldown: relay.switchCooldown,
        roundTime: t.roundTime
      });
      if (autoSlot >= 0) switchRelayPlayer(false, autoSlot);
    }
    const mineDead = player.hp <= 0 && relay.team.every((entry, i) => i === relay.active || entry.hp <= 0);
    const theirsDead = relay.rivals.every(r => r.hp <= 0);
    const timedOut = t.roundTime >= DATA_ARENA_RELAY.seconds;
    if (!mineDead && !theirsDead && !timedOut) return;
    saveRelayPlayer();
    const teamCount = relay.team.length || 3;
    const rivalCount = relay.rivals.length || 3;
    const mine = relay.team.reduce((sum, entry) => sum + Math.max(0, entry.hp) / entry.maxHp, 0) / teamCount;
    const enemy = relay.rivals.reduce((sum, r) => sum + Math.max(0, r.hp) / r.maxHp, 0) / rivalCount;
    t.winner = mineDead && theirsDead ? 'draw' : theirsDead ? 'player' : mineDead ? 'rival' : Math.abs(mine - enemy) < 1e-6 ? 'draw' : mine > enemy ? 'player' : 'rival';
    t.status = 'KO'; t.timer = 1.3;
    player.cast = player.lunge = player.action = null; state.rivals[0].active = false;
    state.projectiles.length = state.zones.length = state.telegraphs.length = 0;
    if (t.winner === 'player') state.score += 1500;
    emit({ type: 'RELAY_END', winner: t.winner, reason: timedOut ? 'TIME' : 'KO' });
  }

  // ------------------------------------------------------------------ pickups / levels
  function xpToNext(level) { return DATA_ARENA_LEVELS.base + DATA_ARENA_LEVELS.step * (level - 1); }

  function updatePickups() {
    const body = player.state === "RIDING" ? mate : player;
    const canCollect = player.state !== "DOWNED" && player.state !== "DEFEATED" && player.state !== "FALLING";
    for (const pickup of state.pickups) {
      pickup.age += DT;
      if (!canCollect) continue;
      const d = distance(pickup.x, pickup.y, body.x, body.y);
      if (d <= DATA_ARENA_PLAYER.pickupRadius) {
        pickup.taken = true;
        state.xp += pickup.value;
        emit({ type: "PICKUP", x: pickup.x, y: pickup.y, value: pickup.value });
      } else if (d <= DATA_ARENA_PLAYER.pickupMagnet && pickup.age > 0.25) {
        const pull = Math.min(d, 640 * DT);
        pickup.x += (body.x - pickup.x) / d * pull; pickup.y += (body.y - pickup.y) / d * pull;
      }
    }
    if (state.pickups.some((p) => p.taken)) state.pickups = state.pickups.filter((p) => !p.taken);
    while (state.level < DATA_ARENA_LEVELS.max && state.xp >= xpToNext(state.level)) {
      state.xp -= xpToNext(state.level);
      state.level++;
      state.pendingLevels++;
      emit({ type: "LEVEL_UP", level: state.level });
    }
    if (state.level >= DATA_ARENA_LEVELS.max) state.xp = Math.min(state.xp, xpToNext(state.level));
  }

  function openOffer() {
    state.offer = drawUpgradeOffer(upgrades, random, 3, mode);
    state.mode = "LEVEL_UP";
    emit({ type: "OFFER", options: [...state.offer] });
  }

  // ------------------------------------------------------------------ result
  function finish(outcome) {
    const timeLeft = relayMode
      ? Math.max(0, DATA_ARENA_RELAY.seconds - (state.tournament?.roundTime ?? state.time))
      : tournamentMode
        ? Math.max(0, DATA_ARENA_TOURNAMENT.roundSeconds - (state.tournament?.roundTime ?? state.time))
        : Math.max(0, DATA_ARENA_TIMELINE.limit - state.time);
    const breakdown = { combat: state.score, victory: 0, time: 0, hp: 0 };
    if (outcome === "VICTORY" && relayMode) {
      breakdown.victory = DATA_ARENA_TOURNAMENT.championScore;
      breakdown.time = Math.round(timeLeft * DATA_ARENA_SCORE.perSecondLeft);
      breakdown.hp = Math.round(player.hp * DATA_ARENA_SCORE.perHp);
    } else if (outcome === "VICTORY" && tournamentMode) {
      breakdown.victory = DATA_ARENA_TOURNAMENT.championScore;
    } else if (outcome === "VICTORY") {
      breakdown.victory = DATA_ARENA_SCORE.victory;
      breakdown.time = Math.round(timeLeft * DATA_ARENA_SCORE.perSecondLeft);
      breakdown.hp = Math.round(player.hp * DATA_ARENA_SCORE.perHp);
    }
    const total = breakdown.combat + breakdown.victory + breakdown.time + breakdown.hp;
    state.result = Object.freeze({ outcome, timeSeconds: Math.round(state.time * 100) / 100, score: total, breakdown: Object.freeze(breakdown),
      kills: state.kills, level: state.level, upgrades: Object.freeze({ ...upgrades }), cheers: state.cheers,
      stats: Object.freeze({ ...state.stats }), partnerId, seed, mode,
      relayFainted: relayMode ? state.relay?.fainted ?? 0 : 0,
      // SURVIVAL: the place the player finished in, of all twelve, and its own knockouts.
      survival: survivalMode ? Object.freeze({ rank: survivalRank({ won: outcome === "VICTORY", othersLeft: survivalOthersLeft() }),
        of: DATA_ARENA_SURVIVAL.tamers + 1, knockouts: state.survival.knockouts, stage: state.survival.stage }) : null,
      tournament: state.tournament && !relayMode ? Object.freeze({ roundsWon: state.stats.roundsWon, rounds: DATA_ARENA_TOURNAMENT.rounds,
        reachedRound: state.tournament.round + 1, results: state.tournament.results.map((r) => ({ ...r })) }) : null });
    state.mode = "ENDED";
    laser.firing = false;
    emit({ type: "RESULT", outcome, score: total });
  }

  // ------------------------------------------------------------------ public
  function step(rawInput = NEUTRAL_INPUT) {
    if (state.mode === "ENDED" || state.mode === "LEVEL_UP") return false;
    let input = normalizeInput(rawInput);
    if (input.controlMode) state.controlMode = input.controlMode;
    if (relayMode && state.tournament.status === 'FIGHT' && input.switchPartner) {
      const targetSlot = Number.isInteger(input.switchPartner) ? input.switchPartner - 1 : null;
      switchRelayPlayer(false, targetSlot);
    }
    // The player's call for a READY burst.
    if (relayMode && (input.burst || input.overLimit)) { const ready = burstOfBody(player); if (ready?.phase === 'READY') { ready.requested = true; ready.overLimit = input.overLimit; } }
    // An exhausted core cannot move or cast (over-limit burst, AWAKENING_OVERDRIVE_20261109).
    if (relayMode && burstOfBody(player)?.phase === 'EXHAUSTED') input = { ...normalizeInput(NEUTRAL_INPUT), aimX: input.aimX, aimY: input.aimY };
    if (tournamentMode && state.tournament?.status !== "FIGHT") input = { ...normalizeInput(NEUTRAL_INPUT), aimX: input.aimX, aimY: input.aimY };
    if (relayMode && state.controlMode !== "MANUAL") input = computePlayerAutoInput(input);
    state.time += DT;
    if (state.combo.timer > 0) {
      state.combo.timer = Math.max(0, state.combo.timer - DT);
      if (state.combo.timer <= 0) state.combo.count = 0;
    }
    if (relayMode) {
      state.relay.switchCooldown = Math.max(0, state.relay.switchCooldown - DT);
      if (!player.cast && !player.lunge && player.recovery <= 0 && (input.moveX || input.moveY)) player.facing8 = relayFacing8(Math.atan2(input.moveY, input.moveX));
    }
    if (state.mode === "VICTORY_POSE") {
      updateProjectiles();
      state.endTimer -= DT;
      if (state.endTimer <= 0) finish("VICTORY");
      return true;
    }
    state.cheerTimer = Math.max(0, state.cheerTimer - DT);
    if (state.cheerTimer <= 0 && state.cheerCooldown <= 0 && state.cheers > 0 && state.crowd.cheerEnded !== state.cheers) {
      state.crowd.cheerEnded = state.cheers; state.cheerCooldown = DATA_ARENA_CROWD.cheerCooldown;
      emit({ type: "CHEER_END" });
    } else state.cheerCooldown = Math.max(0, state.cheerCooldown - DT);
    if (!tournamentMode && !survivalMode) updatePhases();
    updatePlayer(input);
    if (player.state === "NORMAL") stepKnock(player); else player.kbx = player.kby = 0;
    playerKitInput(input);
    tickKit(player);
    updateLaser(input);
    updateMate(input);
    updateSurges();
    updateEnemies();
    for (const rival of state.rivals) updateRival(rival);
    if (survivalMode) updateSurvival();
    if(relayMode)for(const rival of state.rivals)if(rival.active&&rival.hp>0&&player.hp>0){
      const minSep=Math.max(38,(rival.radius+player.radius)*.85);
      const dx=rival.x-player.x,dy=rival.y-player.y,d=Math.hypot(dx,dy),overlap=minSep-d;
      if(overlap>0){const nx=d>0?dx/d:1,ny=d>0?dy/d:0;moveBody(player,-nx*overlap*.5,-ny*overlap*.5,movementKind(player));moveBody(rival,nx*overlap*.5,ny*overlap*.5,movementKind(rival));}
    }
    updateBoss();
    updateScans();
    updateRings();
    updateZones();
    updateShockwaves();
    updateGroundSpikes();
    updateSurfacePatches();
    updateProjectiles();
    if (relayMode) relayClash();
    updateTelegraphs();
    const gridEvents = [];
    grid.step(DT, gridEvents);
    for (const event of gridEvents) { event.t = state.time; events.push(event); }
    // A body standing on melted ice drops into the water.
    if (!["RIDING","MOUNTING","DOWNED","DEFEATED","FALLING"].includes(player.state)
      && !player.canSwim && grid.surfaceAt(player.x, player.y) === "WATER") startFall();
    for(const rival of state.rivals)if(rival.active&&rival.hp>0&&!rival.canSwim&&grid.surfaceAt(rival.x,rival.y)==="WATER") {
      const bank=grid.nearestSafeCell(rival.x,rival.y);
      if(bank){rival.x=bank.x;rival.y=bank.y;rival.kbx=rival.kby=0;rival.lunge=null;damageRival(rival,12,"WATER");emit({type:"RIVAL_SPLASH",x:rival.x,y:rival.y});}
    }
    if ((player.state === "NORMAL" || player.state === "DASH") && grid.burningAt(player.x, player.y)) {
      // Fire is a damage-over-time zone, never an instant kill.
      if (player.invulnerable <= 0) {
        player.hp -= DATA_ARENA_GRID_RULES.fireDps * DT;
        state.stats.damageTaken += DATA_ARENA_GRID_RULES.fireDps * DT;
        if (player.hp <= 0) hurtPlayer(1, "FIRE", player.x, player.y);
      }
    }
    for (const pod of state.pods) if (pod.respawn > 0) { pod.respawn -= DT; if (pod.respawn <= 0) { pod.hp = DATA_ARENA_GRID_RULES.podHp; emit({ type: "POD_READY", x: pod.x, y: pod.y }); } }
    if (tournamentMode) { updateTournament(); return true; }
    updateCores();
    updateBeacons();
    updatePickups();
    updateSpawner();
    if (state.mode === "PLAY" && state.pendingLevels > 0 && player.state !== "DOWNED" && player.state !== "DEFEATED") openOffer();
    if (state.mode === "PLAY" && state.time >= DATA_ARENA_TIMELINE.limit && !state.result) finish("TIMEOUT");
    return true;
  }

  function normalizeInput(input) {
    let moveX = Number(input.moveX) || 0, moveY = Number(input.moveY) || 0;
    const length = Math.hypot(moveX, moveY);
    if (length > 1) { moveX /= length; moveY /= length; }
    const aim = Number.isFinite(input.aimX) && Number.isFinite(input.aimY);
    const sp = input.switchPartner;
    const switchPartner = Number.isInteger(sp) && sp >= 1 && sp <= 3 ? sp : Boolean(sp);
    return { moveX, moveY, aimX: aim ? input.aimX : null, aimY: aim ? input.aimY : null,
      fire: Boolean(input.fire), dash: Boolean(input.dash), guard: Boolean(input.guard), tactical: Boolean(input.tactical), surge: Boolean(input.surge), ride: Boolean(input.ride),
      cast: Number.isInteger(input.cast) ? input.cast : null, ult: Boolean(input.ult), autoAim: Boolean(input.autoAim), switchPartner,
      burst: Boolean(input.burst), overLimit: Boolean(input.overLimit),
      controlMode: input.controlMode ? normalizeControlMode(input.controlMode) : null };
  }

  function choose(id) {
    if (state.mode !== "LEVEL_UP" || !state.offer?.includes(id)) return false;
    const upgrade = dataArenaUpgrade(id);
    if (!upgrade) return false;
    if (id === "patch") player.hp = Math.min(player.maxHp, player.hp + player.maxHp * upgrade.effect.heal);
    else {
      upgrades[id] = Math.min(upgrade.max, (upgrades[id] ?? 0) + 1);
      if (upgrade.effect.mateHp) { const before = mate.maxHp; mate.maxHp = stat.mateHp; if (mate.state !== "DOWNED") mate.hp += mate.maxHp - before; }
      if (upgrade.effect.dashCharges) player.dashCharges = Math.min(stat.dashCharges, player.dashCharges + upgrade.effect.dashCharges);
    }
    emit({ type: "UPGRADE_CHOSEN", id, level: upgrades[id] ?? 0 });
    state.pendingLevels--;
    state.offer = null;
    state.mode = "PLAY";
    if (state.pendingLevels > 0) openOffer();
    else if (tournamentMode && state.tournament?.status === "BETWEEN") startRound(state.tournament.round + 1);
    return true;
  }

  function objective() {
    if (relayMode) return { id: 'RELAY', timeLeft: Math.max(0, DATA_ARENA_RELAY.seconds - state.tournament.roundTime),
      status: state.tournament.status, progress: state.relay.rivals ? state.relay.rivals.filter(r => r.hp <= 0).length : state.relay.enemyIndex, goal: DATA_ARENA_RELAY.teamSize ?? 3, done: state.result?.outcome === 'VICTORY' };
    const id = state.phaseId;
    if (survivalMode) {
      const s = state.survival, circle = s.circle;
      return { id: "SURVIVAL", left: survivalOthersLeft(), total: DATA_ARENA_SURVIVAL.tamers, stage: circle.stage, closing: circle.closing,
        stormIn: circle.nextAt === null ? null : Math.max(0, circle.nextAt - state.time), outside: outsideCircle(circle, player.x, player.y),
        knockouts: s.knockouts, progress: DATA_ARENA_SURVIVAL.tamers - survivalOthersLeft(), goal: DATA_ARENA_SURVIVAL.tamers, done: s.won };
    }
    if (tournamentMode) {
      const t = state.tournament, rival = state.rivals[0];
      return { id: "DUEL", round: t.round + 1, rounds: DATA_ARENA_TOURNAMENT.rounds, status: t.status, timeLeft: Math.max(0, DATA_ARENA_TOURNAMENT.roundSeconds - t.roundTime),
        rivalId: rival?.definitionId ?? null, progress: t.round, goal: DATA_ARENA_TOURNAMENT.rounds, done: false };
    }
    if (id === "WARMUP") return { id, progress: Math.min(state.kills, DATA_ARENA_SPAWN.warmupKills), goal: DATA_ARENA_SPAWN.warmupKills, done: state.warmupDone };
    if (id === "EMBERS") return { id, progress: state.cores.filter((c) => c.out).length, goal: state.cores.length || 3, done: state.cores.length > 0 && state.cores.every((c) => c.out) };
    if (id === "TIDE" || id === "SCAN") return { id, progress: state.beacons.filter((b) => b.captured).length, goal: state.beacons.length, done: state.beacons.every((b) => b.captured) };
    const boss = state.boss;
    return { id, progress: boss ? Math.round((1 - boss.hp / boss.maxHp) * 100) : 0, goal: 100, done: boss?.state === "DOWN",
      shielded: state.beacons.some((b) => !b.captured) };
  }

  if (tournamentMode && !relayMode) {
    const firstTwo = ["tide", "flame"];
    if (random() < 0.5) firstTwo.reverse();
    state.tournament = { round: 0, order: [...firstTwo, "storm"], status: "INTRO", timer: 0, roundTime: 0, winner: null, results: [] };
    startRound(0);
  }

  if (relayMode) {
    const allRivals = [relayRival(0), relayRival(1), relayRival(2)];
    allRivals.forEach((r, idx) => { r.active = idx === 0 ? false : false; });
    state.relay = { active: 0, switchCooldown: 0, enemyIndex: 0, defeatedCount: 0, rivalSwitchCooldown: 0, playerDownAt: null, enemyDownAt: null,
      rivals: allRivals,
      team: relayTeamIds(partnerId, relayReserveId, relayThirdId).map(id => {
        const p = relayPartner(id), hp = Math.round(p.hp * DATA_ARENA_RELAY.playerHpScale * powerOf(id));
        return { partnerId: id, speciesId: p.speciesId, hp, maxHp: hp, energy: DATA_ARENA_RELAY.tpMax, energySpentAt: -Infinity,
          cooldowns: Object.create(null), ult: 0, burn: 0, slow: 0, slowTimer: 0, root: 0, dashCharges: 1, dashRecharge: 0, healsUsed: 0, decoyUsed: false,
          burst: arenaBurstPlan(p.speciesId, relayBurstPlans[id] ?? null, relayManualBurst) };
      }) };
    // Faction resonance (Owner 2026-10-29) from the 3-partner relay squad plus any companions the caller names.
    const resonanceTeam = relayThirdId ? state.relay.team : state.relay.team.slice(0, 2);
    state.relay.resonance = factionResonance([...resonanceTeam.map(e => e.speciesId), ...relayCompanionSpecies].map(id => speciesTaxonomyForId(id)?.faction));
    state.relay.regenAt = 0;
    state.tournament = { round: 0, status: 'INTRO', timer: 2, roundTime: 0, results: [], order: ['tide', 'flame', 'storm'] };
    state.rivals = [allRivals[0]];
    relayArena = createRelayArenaEvents({ map, grid, emit, now: () => state.time, bodies: () => [player, state.rivals[0]],
      effects: { tpMax: DATA_ARENA_RELAY.tpMax,
        heal: (body, team, amount) => { if (team === 0) healPlayer(amount); else body.hp = Math.min(body.maxHp, body.hp + amount); },
        dashMissing: (body, team) => team === 0 && player.dashCharges < stat.dashCharges,
        refillDash: (body, team) => { if (team === 0) { player.dashCharges = stat.dashCharges; player.dashRecharge = 0; } },
        triLinkRush: (_body, _team, superCore) => triggerTriLinkRush(superCore.x, superCore.y) } });
    state.relay.arena = relayArena.state;
    state.phaseId = 'RELAY';
    emit({ type: 'RELAY_INTRO' });
  }

  return Object.freeze({
    grid,
    map,
    mode,
    step,
    /** Rule hooks for deterministic unit tests; the screen never calls these. */
    internals: Object.freeze({ spawnEnemy, spawnProjectile, addHype, burstPod, launchSurge, hurtPlayer, hurtMate, enterPhase, beginCast, autoAim,
      damageRival, chooseRivalGoal, endRound, triggerTriLinkRush, tryStartGuard, tryRaiseTempPillar, tryStartTacticalArt, triggerSwitchHazard,
      spawnSurfacePatch, triggerSurfaceReactionAt, tryTransformVortexAt, reactAndShatterWall }),
    choose,
    setControlMode(nextMode) {
      state.controlMode = normalizeControlMode(nextMode);
      emit({ type: "CONTROL_MODE", controlMode: state.controlMode });
      return state.controlMode;
    },
    getControlMode: () => state.controlMode,
    setAiDifficulty(level) {
      state.aiDifficulty = normalizeAiDifficulty(level);
      emit({ type: "AI_DIFFICULTY", aiDifficulty: state.aiDifficulty });
      return state.aiDifficulty;
    },
    getAiDifficulty: () => state.aiDifficulty,
    /** Review stage only (loopback move filming): hold every rival still as a training dummy. */
    reviewHoldRivals(on) { state.reviewHoldRivals = Boolean(on); return state.reviewHoldRivals; },
    setAiSettings(partial) {
      state.aiSettings = normalizeAiSettings({ ...state.aiSettings, ...(partial ?? {}) });
      emit({ type: "AI_SETTINGS", aiSettings: { ...state.aiSettings } });
      return { ...state.aiSettings };
    },
    getAiSettings: () => ({ ...state.aiSettings }),
    setTacticalArt(artId) {
      player.tacticalArt = tacticalArtById(artId).id;
      emit({ type: "TACTICAL_ART_SET", artId: player.tacticalArt });
      return player.tacticalArt;
    },
    drainEvents() { return events.splice(0, events.length); },
    /** A move's rules as this mode plays them (range, type, radius), for the touch aim guide. Read-only. */
    moveInfo(id, ultimate = false) { return moveFor(id, ultimate) ?? null; },
    /** Where auto-aim points now (nearest hostile in range with a clear path). Read-only. */
    autoAimPoint(range = DATA_ARENA_PLAYER.laser.range) { const aim = autoAim(player, range); return { x: aim.x, y: aim.y, locked: Boolean(aim.target) }; },
    getState: () => state,
    objective,
    stats: stat,
    /** A plain, JSON-safe summary for HUD and QA observation. */
    getSnapshot() {
      const boss = state.boss;
      return {
        mode: state.mode, time: Math.round(state.time * 1000) / 1000, phase: state.phaseId, level: state.level, xp: state.xp,
        xpToNext: xpToNext(state.level), score: state.score, kills: state.kills, hype: Math.round(state.hype), cheer: state.cheerTimer > 0,
        combo: { count: state.combo.count, max: state.combo.max, active: state.combo.timer > 0 && state.combo.count >= 2 },
        player: { partnerId: player.partnerId, formPartnerId: player.formPartnerId ?? null, speciesId: player.speciesId, facing8: player.facing8, action: player.action ? { ...player.action } : null, x: Math.round(player.x), y: Math.round(player.y), hp: Math.round(player.hp), maxHp: player.maxHp, state: player.state,
          dashCharges: player.dashCharges, dashMax: stat.dashCharges, dashRecharge: player.dashRecharge, revives: player.revives,
           surface: grid.surfaceAt(player.x, player.y), canSwim:player.canSwim, invulnerable: player.invulnerable > 0, tagShield: player.tagShield > 0,
           guard: { active: player.guardTimer > 0, remaining: Math.round(player.guardTimer * 100) / 100, cooldown: Math.round(player.guardCooldown * 100) / 100, hitstun: Math.round((player.hitstun ?? 0) * 100) / 100 },
           statStages: { atk: player.atkStage ?? 0, def: player.defStage ?? 0, spd: player.spdStage ?? 0 },
           decoy: player.decoy ? { hp: Math.round(player.decoy.hp), maxHp: player.decoy.maxHp } : null,
           tactical: {
             artId: player.tacticalArt,
             ready: canUseTacticalArt(player),
             spent: tacticalRefusalReason(player) === "SPENT",
             cooldown: Math.round((player.tacticalCooldown ?? 0) * 10) / 10,
             cooldownMax: tacticalArtById(player.tacticalArt).cooldown,
             energy: tacticalArtById(player.tacticalArt).energy,
             buffsUsed: player.buffsUsed ?? 0,
             healsUsed: player.healsUsed ?? 0,
             decoyUsed: Boolean(player.decoyUsed),
             counterActive: (player.counterTimer ?? 0) > 0,
             flurryActive: Boolean(player.flurry),
             approaching: Boolean(player.approach)
           },
           ailments: {
             sleep: Math.round((player.sleep ?? 0) * 10) / 10,
             freeze: Math.round((player.root ?? 0) * 10) / 10,
             paralyze: Math.round((player.paralyze ?? 0) * 10) / 10,
             poison: Math.round((player.poison ?? 0) * 10) / 10,
             poisonStacks: player.poisonStacks ?? 0,
             burn: Math.round((player.burn ?? 0) * 10) / 10,
             slow: Math.round((player.slowTimer ?? 0) * 10) / 10,
             wet: Math.round((player.wet ?? 0) * 10) / 10
           } },
        controlMode: state.controlMode,
        aiDifficulty: state.aiDifficulty,
        moveSystem: state.moveSystem,
        energyOrbs: state.energyOrbs.map((o) => ({ id: o.id, x: Math.round(o.x), y: Math.round(o.y) })),
        aiSettings: { ...state.aiSettings },
        hazards: { ...state.hazards },
        weather: { kind: state.weather.kind, remaining: Math.round(state.weather.remaining * 10) / 10 },
        suddenDeath: { active: state.suddenDeath.active, multiplier: state.suddenDeath.multiplier },
        lastHit: state.lastHit ? { ...state.lastHit } : null,
        laser: { firing: laser.firing, heat: laser.heat, heatCapacity: stat.heatCapacity, overheated: laser.overheated, endKind: laser.endKind,
          angle: laser.angle, length: Math.round(Math.hypot(laser.x1 - laser.x0, laser.y1 - laser.y0)) },
        mate: { x: Math.round(mate.x), y: Math.round(mate.y), hp: Math.round(mate.hp), maxHp: Math.round(mate.maxHp), state: mate.state,
          surgeCooldown: mate.surgeCooldown, surgeMax: stat.surgeCooldown, reviveProgress: mate.reviveProgress, swimming: mate.swimming },
        boss: boss ? { hp: Math.round(boss.hp), maxHp: boss.maxHp, state: boss.state, enraged: boss.enraged, x: Math.round(boss.x), y: Math.round(boss.y),
          shielded: state.beacons.some((b) => !b.captured) } : null,
        enemies: state.enemies.length, projectiles: state.projectiles.length, burning: grid.burningCount, ice: grid.iceCount,
        terrainRevision:grid.navRevision,scorchedCells:grid.scorch.reduce((n,v)=>n+(v>0),0),
        props:grid.props.map(p=>({id:p.id,material:p.material,hp:Math.round(p.hp),maxHp:p.maxHp,state:grid.propVisualState(p),destroyed:p.destroyed,rect:[p.col,p.row,p.width,p.height]})),
        objective: objective(), offer: state.offer ? [...state.offer] : null, upgrades: { ...upgrades },
        beacons: state.beacons.map((b) => ({ x: b.x, y: b.y, active: b.active, captured: b.captured, progress: b.progress })),
        cores: state.cores.map((c) => ({ x: c.x, y: c.y, out: c.out })),
        pods: state.pods.map((p) => ({ x: p.x, y: p.y, ready: p.respawn <= 0 })),
        gameMode: mode,
        survival: survivalMode ? { stage: state.survival.circle.stage, closing: state.survival.circle.closing, left: survivalOthersLeft(),
          knockouts: state.survival.knockouts, won: state.survival.won,
          circle: { cx: Math.round(state.survival.circle.cx), cy: Math.round(state.survival.circle.cy), radius: Math.round(state.survival.circle.radius) },
          tamers: state.survival.tamers.map((t) => ({ index: t.index, fate: t.fate, state: t.state, by: t.by })) } : null,
        relay: relayMode ? { active: state.relay.active, switchCooldown: state.relay.switchCooldown, enemyIndex: state.relay.enemyIndex,
          controlMode: state.controlMode,
          suddenDeath: { active: state.suddenDeath.active, multiplier: state.suddenDeath.multiplier },
          matchups: evaluateMoveMatchups({
            body: player,
            foe: state.rivals[0] ?? null,
            relayMode: true,
            moveIds: player.kit.moves,
            basicId: RELAY_ACTION_PROFILES[partner.id]?.basic ?? null,
            ultimateId: player.kit.ultimate,
            moveFor,
            canCast,
            attackElementOf,
            taxonomyMultiplier,
            hasSight
          }),
          rivalsAlive: state.relay.rivals.filter(r => r.hp > 0).length,
          rivalTeam: state.relay.rivals.map((r, index) => ({ id: r.definitionId, speciesId: r.speciesId, hp: Math.round(r.hp), maxHp: r.maxHp, tp: Math.round(r.energy), active: index === state.relay.enemyIndex && r.hp > 0, defeated: r.hp <= 0 })),
          superCore: state.relay.arena?.superCore ? { phase: state.relay.arena.superCore.phase, remaining: Math.round(state.relay.arena.superCore.remaining * 10) / 10, x: Math.round(state.relay.arena.superCore.x), y: Math.round(state.relay.arena.superCore.y), radius: state.relay.arena.superCore.radius } : null,
          resonance: [...state.relay.resonance],
          burst: burstSnapshot(burstOfBody(player)), rivalBurst: burstSnapshot(state.rivals[0]?.burst ?? null),
          team: state.relay.team.map((entry, index) => ({ partnerId: entry.partnerId, speciesId: entry.speciesId, burst: burstSnapshot(entry.burst),
            hp: Math.round(index === state.relay.active ? player.hp : entry.hp), maxHp: entry.maxHp,
            tp: Math.round(index === state.relay.active ? player.energy : entry.energy) })) } : null,
        kit: { moves: player.kit.moves.map((id) => ({ id, cooldown: player.cooldowns[id] ?? 0, cooldownMax: (moveFor(id).cooldown ?? 0) * stat.cooldownScale,
          energy: moveFor(id).energy ?? 0, type: moveFor(id).type, ready: canCast(player, id) })),
          ultimateCooldown: player.cooldowns[player.kit.ultimate] ?? 0, ultimate: player.kit.ultimate, ult: Math.round(player.ult), ultMax: DATA_ARENA_ENERGY.ultMax, energy: Math.round(player.energy), energyMax: DATA_ARENA_ENERGY.max,
          currency: relayMode ? "TP" : "ENERGY", recovery: player.recovery ?? 0, basic: relayMode ? RELAY_ACTION_PROFILES[partner.id].basic : null,
          casting: player.cast ? player.cast.moveId : null, barrier: player.barrier > 0, slowed: player.slow > 0, rooted: player.root > 0 },
        rivals: state.rivals.map((r) => ({ id: r.definitionId, speciesId: r.speciesId, x: Math.round(r.x), y: Math.round(r.y), hp: Math.round(r.hp), maxHp: r.maxHp,
          energy: Math.round(r.energy), casting: r.cast ? r.cast.moveId : null, wantsCover: r.wantsCover, active: r.active, rooted: r.root > 0, slowed: r.slow > 0,
          guard: { active: (r.guardTimer ?? 0) > 0, remaining: Math.round((r.guardTimer ?? 0) * 100) / 100, cooldown: Math.round((r.guardCooldown ?? 0) * 100) / 100 },
          sight: hasSight(r.x, r.y, player.x, player.y) })),
        tournament: state.tournament ? { round: state.tournament.round, status: state.tournament.status, timer: state.tournament.timer,
          roundTime: state.tournament.roundTime, order: [...state.tournament.order], results: state.tournament.results.map((r) => ({ ...r })) } : null,
        zones: state.zones.map((z) => ({ team: z.team, x: z.x, y: z.y, radius: z.radius, left: Math.max(0, z.delay - z.t), evolvedKind: z.evolvedKind ?? null })),
        puddles: state.puddles.map((p) => ({ id: p.id, kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), radius: Math.round(p.radius), ttl: Math.round(p.ttl * 10) / 10 })),
        scans: state.scans.map((scan) => ({ x: scan.x, y: scan.y, angle: scan.angle, spin: scan.spin, active: scan.telegraph <= 0, reach: scan.reach ?? 0 })),
        stats: { ...state.stats }, result: state.result
      };
    }
  });
}
