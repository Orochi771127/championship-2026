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

import { relayPartner, RELAY_ROSTER } from './dataArenaRelayRoster.js';
import { relayBattleMap } from './dataArenaRelayMaps.js';
import { DATA_ARENA_RELAY, RELAY_ACTION_PROFILES, relayTeamIds, relayMove, relayFacing8, relayKit, relayMoveElement } from './dataArenaRelay.js';
import { createRelayArenaEvents } from './dataArenaRelayArena.js';
import { relayEffectiveness } from './dataArenaRelayElements.js';

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

const NEUTRAL_INPUT = Object.freeze({ moveX: 0, moveY: 0, aimX: null, aimY: null, fire: false, dash: false, surge: false, ride: false, cast: null, ult: false, autoAim: false });
export const DATA_ARENA_MODES = Object.freeze(["TOURNAMENT", "HARBOR", "RELAY"]);

export function createDataArenaSimulation({ seed = 1, partnerId = DATA_ARENA_PARTNERS[0].id, quality = "high", mode = "HARBOR", relayLoadouts = {}, relayReserveId = null, relayArenaId = null, portrait = false } = {}) {
  if (!DATA_ARENA_MODES.includes(mode)) throw new RangeError(`DATA_ARENA_UNKNOWN_MODE:${mode}`);
  const relayMode = mode === "RELAY";
  const tournamentMode = mode === "TOURNAMENT" || relayMode;
  const moveFor = (id, ultimate = false) => relayMode ? relayMove(id, ultimate) : DATA_ARENA_MOVES[id];
  const dashCooldown = tournamentMode ? DATA_ARENA_TOURNAMENT.dashCooldown : DATA_ARENA_PLAYER.dash.cooldown;
  const hasMate = !tournamentMode;
  const map = relayMode ? relayBattleMap(relayArenaId,portrait) : tournamentMode ? DATA_ARENA_DUEL_MAP : DATA_ARENA_MAP;
  let partner = relayMode ? relayPartner(partnerId) : DATA_ARENA_PARTNERS.find((entry) => entry.id === partnerId);
  if (!partner) throw new RangeError(`DATA_ARENA_UNKNOWN_PARTNER:${partnerId}`);
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
    partnerId, speciesId: partner.speciesId, facing8: 2, recovery: 0, action: null,
    canSwim: partner.canSwim === true,
    id: nextId++, x: playerSpawn.x, y: playerSpawn.y, vx: 0, vy: 0, radius: DATA_ARENA_PLAYER.radius,
    hp: partner.hp, maxHp: partner.hp, state: "NORMAL", stateTime: 0, facing: 1,
    invulnerable: 0, dashGrace: 0, dashTimer: 0, dashDirX: 1, dashDirY: 0, dashCharges: 1, dashRecharge: 0,
    perfectThisDash: false, dashHits: new Set(), revives: tournamentMode ? 0 : DATA_ARENA_PLAYER.revives, hitFlash: 0,
    fallFromX: 0, fallFromY: 0,
    // Kit: slots 2-4 spend energy and have cooldowns; the ultimate charges.
    team: "player", kit: relayMode ? relayKit(partnerId, relayLoadouts[partnerId]) : DATA_ARENA_KITS[partnerId], energy: DATA_ARENA_ENERGY.max, energySpentAt: -Infinity,
    cooldowns: Object.create(null), ult: 0, cast: null, lunge: null, barrier: 0, barrierAngle: 0,
    slow: 0, slowTimer: 0, root: 0, burn: 0, damageScale: 1
  };
  if (tournamentMode) { player.maxHp = Math.round(partner.hp * DATA_ARENA_TOURNAMENT.playerHpScale); player.hp = player.maxHp; }
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
    seed, partnerId, quality, gameMode: mode, time: 0, mode: "PLAY", phaseIndex: 0, phaseId: tournamentMode ? "DUEL" : "WARMUP", warnedPhase: 0,
    rivals: [], zones: [], tournament: null, relay: null,
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
    killWindow: []
  };
  // Lens freeze bookkeeping and laser ignition use the grid; nothing else does.
  const maxAlive = DATA_ARENA_SPAWN.maxAlive[quality] ?? DATA_ARENA_SPAWN.maxAlive.high;

  // ------------------------------------------------------------------ derived stats
  const stat = {
    get speed() { return partner.speed * (1 + upgradeValue(upgrades, "speed")); },
    get laserDps() { return partner.laserDps * (1 + upgradeValue(upgrades, "laserDps")) * (state.cheerTimer > 0 ? DATA_ARENA_CROWD.cheerLaserDps : 1); },
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
    get skillDamage() { return 1 + upgradeValue(upgrades, "skillDamage"); }
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
    body.kbx = (body.kbx ?? 0) + dirX * speed; body.kby = (body.kby ?? 0) + dirY * speed;
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
    const decay = 1 - Math.min(1, DT * 6);
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
  function hurtPlayer(amount, source, x, y) {
    if (state.mode !== "PLAY" && state.mode !== "VICTORY_POSE") return false;
    if (player.state === "DOWNED" || player.state === "DEFEATED" || player.state === "FALLING") return false;
    if (player.state === "RIDING") { hurtMate(amount * DATA_ARENA_MATE.ride.damageShare, source, x, y); return true; }
    if (player.invulnerable > 0) return false;
    player.hp -= amount;
    chargeUlt(amount * DATA_ARENA_ENERGY.ultPerDamageTaken);
    state.stats.damageTaken += amount;
    player.invulnerable = DATA_ARENA_PLAYER.hitInvulnerable;
    player.hitFlash = 0.2;
    emit({ type: "PLAYER_HIT", amount, source, x: player.x, y: player.y, fromX: x, fromY: y });
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
    player.dashTimer = DATA_ARENA_PLAYER.dash.duration;
    player.dashGrace = DATA_ARENA_PLAYER.dash.invulnerable;
    player.invulnerable = Math.max(player.invulnerable, DATA_ARENA_PLAYER.dash.invulnerable);
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
        if (player.lunge) break; // the lunge owns movement until it ends
        const speed = stat.speed * moveScale(player);
        const tx = input.moveX * speed, ty = input.moveY * speed;
        const k = Math.min(1, DT * 14);
        player.vx += (tx - player.vx) * k; player.vy += (ty - player.vy) * k;
        if (player.hitstun > 0) player.vx = player.vy = 0; // staggered: no walking drift; knockback is separate
        moveBody(player, player.vx * DT, player.vy * DT, movementKind(player));
        if (input.ride) { if (tryMount()) break; }
        if (input.dash && player.dashCharges > 0 && player.root <= 0) {
          if (player.cast) { removeTelegraph(`cast:${player.id}`); player.cast = null; } // a dash cancels a windup
          startDash(input); break;
        }
        if (grid.surfaceAt(player.x, player.y) === "WATER") startFall();
        break;
      }
      case "DASH": {
        const step = DATA_ARENA_PLAYER.dash.speed * DT;
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
  function strike(target, amount, cause, onHit, x = target.x, y = target.y, element = null) {
    const mult = relayMode && element ? relayEffectiveness(element, casterElement(target)) : 1;
    amount *= mult;
    if (target === player) {
      const applied=hurtPlayer(amount, cause, x, y);
      if (applied && relayMode) relayAfterHit(player, amount, element, mult, x, y);
      if (applied && onHit) applyStatus(player, onHit);
      return applied;
    }
    if (isRival(target)) { const applied=damageRival(target, amount, cause); if(relayMode&&!applied)return false; if (relayMode) relayAfterHit(target, amount, element, mult, x, y); }
    else if (target === state.boss) damageBoss(amount, cause);
    else damageEnemy(target, amount, cause, x, y);
    if (onHit && !target.dead) applyStatus(target, onHit);
    chargeUlt(amount * DATA_ARENA_ENERGY.ultPerDamageDealt);
    return true;
  }

  // RELAY stage four (2026-10-28): what a landed hit does beyond its damage.
  //  - hitstun 0.10-0.20 s (by damage) pauses the target's windup and walking;
  //  - fire thaws a root, frost puts a burn out (a steam chain);
  //  - an effective or resisted matchup is announced.
  function relayAfterHit(target, amount, element, mult, x, y) {
    if (amount > 0) target.hitstun = Math.max(target.hitstun ?? 0, clamp(0.1 + amount / 400, 0.1, 0.2));
    if (element === 'fire' && target.root > 0) { target.root = 0; emit({ type: 'STATUS_CLEARED', status: 'ROOT', by: 'fire', x: target.x, y: target.y }); }
    if (element === 'frost' && target.burn > 0) { target.burn = 0; chain('STEAM', target.x, target.y); }
    if (mult !== 1) emit({ type: 'EFFECTIVE', mult, element, target: target === player ? 'player' : 'rival', x: target.x, y: target.y });
  }

  function applyStatus(body, effect) {
    if (effect.slow) { body.slow = Math.max(body.slow ?? 0, effect.slow); body.slowTimer = Math.max(body.slowTimer ?? 0, effect.slowSeconds ?? 1.5); }
    if (effect.root) body.root = Math.max(body.root ?? 0, effect.root);
    if (effect.burn) body.burn = Math.max(body.burn ?? 0, effect.burn);
    emit({ type: "STATUS", status: effect.root ? "ROOT" : effect.slow ? "SLOW" : "BURN", x: body.x, y: body.y, target: body === player ? "PLAYER" : "HOSTILE" });
  }

  function tickStatus(body) {
    if (body.hitstun > 0) body.hitstun = Math.max(0, body.hitstun - DT);
    if (body.slowTimer > 0) { body.slowTimer -= DT; if (body.slowTimer <= 0) body.slow = 0; }
    if (body.root > 0) body.root = Math.max(0, body.root - DT);
    if (body.burn > 0) {
      body.burn = Math.max(0, body.burn - DT);
      const dps = 8 * DT;
      if (body === player) { if (player.invulnerable <= 0) { player.hp = Math.max(1, player.hp - dps); state.stats.damageTaken += dps; } }
      else if (isRival(body)) damageRival(body, dps, "BURN");
      else if (body !== state.boss) damageEnemy(body, dps, "FIRE");
    }
  }
  const moveScale = (body) => (body.root > 0 ? 0 : 1 - (body.slow ?? 0)) * (body.cast ? (body === player ? DATA_ARENA_ENERGY.playerCastMove : DATA_ARENA_ENERGY.rivalCastMove) : 1)
    * (relayArena?.speedScale(body) ?? 1) * (body.hitstun > 0 ? 0 : 1);

  function kitMoveIds(caster) { return caster.kit.moves; }

  function canCast(caster, moveId) {
    const move = moveFor(moveId);
    if (!move || caster.cast || caster.lunge || (relayMode && caster.recovery > 0)) return false;
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
      const scale = caster === player ? stat.cooldownScale : 1;
      caster.cooldowns[moveId] = (move.cooldown ?? 0) * scale;
    }
    caster.cast = { actionId: nextActionId++, moveId, move, t: 0, windup: move.windup ?? 0, angle, aimX: targetX, aimY: targetY, ultimate };
    caster.facing = Math.cos(angle) >= 0 ? 1 : -1;
    if (relayMode) {
      caster.facing8 = relayFacing8(angle);
      caster.action = { id: caster.cast.actionId, moveId, startedAt: state.time, releasedAt: null, windup: move.windup, recovery: move.recovery, angle };
    }
    if (caster === player) { state.stats.movesCast++; if (ultimate) state.stats.ultimates++; }
    const telegraph = { owner: `cast:${caster.id}`, team: caster.team, duration: Math.max(0.12, move.windup ?? 0), follow: null };
    if (move.type === "BOLT" || move.type === "WAVE") addTelegraph({ ...telegraph, kind: "LINE", x: caster.x, y: caster.y, angle, length: move.range, width: move.radius * 2 });
    else if (move.type === "SPREAD" || move.type === "LANCE") addTelegraph({ ...telegraph, kind: "CONE", x: caster.x, y: caster.y, angle, spread: move.spread, length: Math.min(move.range, 520), count: move.count });
    else if (move.type === "LUNGE") addTelegraph({ ...telegraph, kind: "LINE", x: caster.x, y: caster.y, angle, length: move.distance, width: move.width });
    else if (move.type === "ZONE") addTelegraph({ ...telegraph, kind: "CIRCLE", x: targetX, y: targetY, radius: move.radius, danger: caster.team !== "player" });
    else if (move.type === "NOVA") addTelegraph({ ...telegraph, kind: "CIRCLE", x: caster.x, y: caster.y, radius: move.radius, danger: caster.team !== "player" });
    emit({ type: ultimate ? "ULT_CAST" : "CAST", actionId: caster.cast.actionId, casterId: caster.id, team: caster.team, moveId, moveType: move.type, windup: move.windup, recovery: move.recovery, x: caster.x, y: caster.y, angle });
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
    return spawnProjectile({ kind: team === "player" ? "PBOLT" : hostileKind, owner: team === "player" ? "player" : "rival", moveId: Object.keys(DATA_ARENA_MOVES).find((key) => DATA_ARENA_MOVES[key] === move),
      x: caster.x + Math.cos(angle) * (caster.radius + 8), y: caster.y + Math.sin(angle) * (caster.radius + 8),
      vx: Math.cos(angle) * move.speed, vy: Math.sin(angle) * move.speed, radius: move.radius, damage: move.damage * damageScale,
      range: move.range, travelled: 0, pierce: move.pierce ?? 0, hits: new Set(), onHit: move.onHit ?? null, onTerrain: move.onTerrain ?? null,
      knockback: move.knockback ?? 0, hp: move.shard ?? 0, element: move.onTerrain ?? null, ...extra });
  }

  function finishCast(caster) {
    const { actionId, moveId, move, angle, aimX, aimY, ultimate } = caster.cast;
    const owner = `cast:${caster.id}`;
    removeTelegraph(owner);
    caster.cast = null;
    if (relayMode) { caster.recovery = move.recovery; if (caster.action) caster.action.releasedAt = state.time; }
    emit({ type: 'CAST_RELEASE' , actionId, casterId: caster.id, team: caster.team, moveId, moveType: move.type,
      x: caster.x, y: caster.y, angle, ultimate, windup: move.windup, recovery: move.recovery });
    const damageScale = caster === player ? stat.skillDamage : caster.damageScale ?? 1;
    const arenaElement = relayMode ? coverElement(caster, moveId) : null;
    switch (move.type) {
      case "BOLT": case "WAVE": shootBolt(caster, move, angle, { actionId, moveId, arenaElement, moveType: move.type }); break;
      case "SPREAD": case "LANCE":
        for (let i = 0; i < move.count; i++) shootBolt(caster, move, angle - move.spread / 2 + (move.spread * i) / (move.count - 1), { actionId, moveId, arenaElement, moveType: move.type });
        break;
      case "LUNGE":
        caster.lunge = { actionId, moveId, arenaElement, dirX: Math.cos(angle), dirY: Math.sin(angle), left: move.distance, speed: move.speed, width: move.width,
          damage: move.damage * damageScale, hits: new Set() };
        if (caster === player && move.invulnerable) { player.invulnerable = Math.max(player.invulnerable, move.distance / move.speed + 0.08); player.dashGrace = player.invulnerable; player.perfectThisDash = false; }
        if (isRival(caster)) caster.invulnerable = Math.max(caster.invulnerable ?? 0, 0.1);
        break;
      case "ZONE":
        state.zones.push({ id: nextId++, moveId, team: caster.team, x: aimX, y: aimY, radius: move.radius, delay: move.delay, t: 0, move, damage: move.damage * damageScale, caster: caster.id, arenaElement });
        emit({ type: "ZONE_PLACED", team: caster.team, x: aimX, y: aimY, radius: move.radius, delay: move.delay });
        break;
      case "BARRIER":
        caster.barrier = move.duration; caster.barrierAngle = angle; caster.barrierArc = move.arc; caster.barrierRadius = move.radius;
        emit({ type: "BARRIER_UP", x: caster.x, y: caster.y, angle });
        break;
      case "BLINK": blink(caster, move, angle); break;
      case "NOVA": nova(caster, move, damageScale, moveId); break;
      default: break;
    }
  }

  function blink(caster, move, angle) {
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
    emit({ type: "BLINK", fromX, fromY, x: caster.x, y: caster.y });
  }

  // RELAY stage three: the element a caster's hit carries against cover.
  const rosterElement = new Map(RELAY_ROSTER.map(p => [p.speciesId, p.element]));
  const casterElement = (caster) => caster === player ? partner.element ?? rosterElement.get(player.speciesId) ?? null : rosterElement.get(caster.speciesId) ?? null;
  const coverElement = (caster, moveId) => relayMoveElement(moveId, casterElement(caster));

  function nova(caster, move, damageScale, moveId) {
    const team = caster.team;
    for (const target of targetsFor(team)) {
      if (distance(target.x, target.y, caster.x, caster.y) > move.radius + (target.radius ?? 20)) continue;
      if (target === player && player.dashGrace > 0) { perfectDodge(caster.x, caster.y); continue; }
      if(relayMode&&!hasSight(caster.x,caster.y,target.x,target.y))continue;
      const hit=strike(target, move.damage * damageScale, move.type, zoneStatus(move), target.x, target.y, relayMode ? coverElement(caster, moveId) : null);
      if(relayMode&&!hit)continue;
      if (move.effect !== "ROOT") {
        const d = distance(target.x, target.y, caster.x, caster.y) || 1;
        launch(target, (target.x - caster.x) / d, (target.y - caster.y) / d, DATA_ARENA_ENERGY.launch.NOVA);
      }
    }
    areaElement(caster.x, caster.y, move.radius, move,move.damage*damageScale,relayMode?coverElement(caster,moveId):null);
    emit({ type: "NOVA", team, moveId, x: caster.x, y: caster.y, radius: move.radius, effect: move.effect });
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

  function updateLunge(caster) {
    const lunge = caster.lunge;
    if (!lunge) return;
    const step = Math.min(lunge.left, lunge.speed * DT);
    const kind = movementKind(caster);
    const nx = caster.x + lunge.dirX * step, ny = caster.y + lunge.dirY * step;
    if (blocked(nx, ny, caster.radius * 0.8, kind)) {
      const before=events.length;
      for(const prop of grid.props) {
        if(prop.destroyed||lunge.hits.has(prop.id))continue;
        const px=clamp(nx,prop.col*cell,(prop.col+prop.width)*cell),py=clamp(ny,prop.row*cell,(prop.row+prop.height)*cell);
        if(distance(nx,ny,px,py)<=caster.radius*.8+2){grid.damageProp(prop,lunge.damage,events,"LUNGE",lunge.arenaElement);lunge.hits.add(prop.id);}
      }
      for(let k=before;k<events.length;k++)events[k].t=state.time;
      lunge.left = 0;
    }
    else { caster.x = nx; caster.y = ny; lunge.left -= step; }
    for (const target of targetsFor(caster.team)) {
      if (lunge.hits.has(target.id)) continue;
      if (distance(target.x, target.y, caster.x, caster.y) <= lunge.width / 2 + (target.radius ?? 20)) {
        lunge.hits.add(target.id);
        if (target === player && player.dashGrace > 0) { perfectDodge(caster.x, caster.y); continue; }
        if(relayMode&&!hasSight(caster.x,caster.y,target.x,target.y))continue;
        const hit=strike(target, lunge.damage, "LUNGE", { slow: 0.3, slowSeconds: 0.6 }, target.x, target.y, lunge.arenaElement);
        if(relayMode&&!hit)continue;
        launch(target, lunge.dirX, lunge.dirY, DATA_ARENA_ENERGY.launch.LUNGE);
      }
    }
    if (lunge.left <= 0) {
      caster.lunge = null;
      if (caster === player && grid.surfaceAt(player.x, player.y) === "WATER") startFall();
    }
  }

  function updateZones() {
    for (const zone of state.zones) {
      zone.t += DT;
      if (zone.t < zone.delay || zone.done) continue;
      zone.done = true;
      for (const target of targetsFor(zone.team)) {
        if (distance(target.x, target.y, zone.x, zone.y) > zone.radius + (target.radius ?? 20) * 0.5) continue;
        if (target === player && player.dashGrace > 0) { perfectDodge(zone.x, zone.y); continue; }
        if(relayMode&&!hasSight(zone.x,zone.y,target.x,target.y))continue;
        strike(target, zone.damage, "ZONE", zoneStatus(zone.move), zone.x, zone.y, zone.arenaElement);
      }
      areaElement(zone.x, zone.y, zone.radius, zone.move,zone.damage,zone.arenaElement);
      emit({ type: "ZONE_BURST", moveId:zone.moveId, team: zone.team, x: zone.x, y: zone.y, radius: zone.radius, effect: zone.move.effect });
    }
    if (state.zones.some((zone) => zone.done)) state.zones = state.zones.filter((zone) => !zone.done);
  }

  function tickKit(caster, regenScale = 1) {
    if (relayMode) {
      caster.recovery = Math.max(0, (caster.recovery ?? 0) - DT);
      if (!caster.cast && !caster.lunge && caster.recovery <= 0) caster.action = null;
      if (caster.hp <= 0) { caster.cast = caster.lunge = caster.action = null; removeTelegraph(`cast:${caster.id}`); return; }
    }
    for (const id in caster.cooldowns) if (caster.cooldowns[id] > 0) caster.cooldowns[id] = Math.max(0, caster.cooldowns[id] - DT);
    if (state.time - caster.energySpentAt >= DATA_ARENA_ENERGY.regenDelay) {
      const regen = caster === player ? stat.energyRegen : DATA_ARENA_ENERGY.regen * regenScale;
      caster.energy = Math.min(DATA_ARENA_ENERGY.max, caster.energy + regen * DT);
    }
    if (caster.barrier > 0) caster.barrier = Math.max(0, caster.barrier - DT);
    tickStatus(caster);
    updateCast(caster);
    updateLunge(caster);
  }

  /** The player's slot 2-4 and ultimate inputs. A press made mid-dash, mid-windup or
   * mid-lunge is buffered briefly and fires on the first usable step, so no tap is lost. */
  let kitBuffer = null;
  function playerKitInput(input) {
    if (input.ult || Number.isInteger(input.cast)) {
      kitBuffer = { ult: input.ult, cast: Number.isInteger(input.cast) ? input.cast : null, autoAim: input.autoAim, left: DATA_ARENA_ENERGY.inputBuffer };
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
    const aimFor = (range) => (request.autoAim || input.autoAim || input.aimX === null ? autoAim(player, range) : { x: input.aimX, y: input.aimY });
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
      else { const aim = aimFor(move.range ?? move.distance ?? 400); beginCast(player, id, aim.x, aim.y); }
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

  /** Where a skillshot lands or breaks: fire lights oil, frost freezes open water. */
  function terrainEffect(projectile, backStep = 0) {
    if (!projectile.onTerrain) return;
    const v = Math.hypot(projectile.vx, projectile.vy) || 1;
    const x = projectile.x + (projectile.vx / v) * backStep * 20, y = projectile.y + (projectile.vy / v) * backStep * 20;
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
      const applied=strike(target, projectile.damage, "SKILL", projectile.onHit, projectile.x, projectile.y, projectile.arenaElement);
      if(relayMode&&!applied)return;
      emit({ type: "SKILL_HIT", actionId: projectile.actionId, x: projectile.x, y: projectile.y, moveId: projectile.moveId });
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
        if (douses(a, b) || douses(b, a)) { a.dead = b.dead = true; chain('STEAM', x, y); emit({ type: 'CANCEL', rule: 'STEAM_CLASH', x, y }); continue; }
        const wave = (p) => p.moveType === 'WAVE';
        if (wave(a) !== wave(b)) { (wave(a) ? b : a).dead = true; emit({ type: 'CANCEL', rule: 'WAVE_SWALLOWS_SHOT', x, y }); continue; }
        const weight = (p) => p.radius * 4 + p.damage;
        if (Math.abs(weight(a) - weight(b)) < 1e-6) { a.dead = b.dead = true; emit({ type: 'CANCEL', rule: 'SHOTS_TRADE', x, y }); continue; }
        const [big, small] = weight(a) > weight(b) ? [a, b] : [b, a];
        small.dead = true;
        if (big.pierce > 0) big.pierce--;
        emit({ type: 'CANCEL', rule: 'HEAVY_SHOT_WINS', x, y });
      }
    }
    if (shots.some((p) => p.dead)) state.projectiles = shots.filter((p) => !p.dead);
  }

  function updateProjectiles() {
    for (const projectile of state.projectiles) {
      if (projectile.dead) continue;
      projectile.life += DT;
      projectile.x += projectile.vx * DT; projectile.y += projectile.vy * DT;
      if (projectile.life > DATA_ARENA_PROJECTILES.maxLifetime || projectile.x < -40 || projectile.y < -40
        || projectile.x > worldWidth + 40 || projectile.y > worldHeight + 40) { projectile.dead = true; continue; }
      const c = grid.cellOf(projectile.x), r = grid.cellOf(projectile.y);
      if (projectile.range) {
        projectile.travelled += Math.hypot(projectile.vx, projectile.vy) * DT;
        if (projectile.travelled >= projectile.range) { projectile.dead = true; terrainEffect(projectile); continue; }
      }
      if (grid.inBounds(c, r) && grid.blocksLaser(grid.index(c, r))) {
        const before=events.length,prop=grid.propAtCell(grid.index(c,r));
        grid.damageProp(prop,projectile.damage,events,projectile.onTerrain==="IGNITE"||projectile.kind==="EMBER"?"FIRE":"PROJECTILE",projectile.arenaElement);
        if(projectile.onTerrain==="IGNITE"||projectile.kind==="EMBER")grid.ignite(grid.index(c,r),events,"PROJECTILE");
        if(projectile.kind==="WAVE"||projectile.kind==="TIDE"||projectile.onTerrain==="FREEZE")grid.applyWater(projectile.x,projectile.y,.8,events);
        for(let k=before;k<events.length;k++)events[k].t=state.time;
        projectile.dead = true;
        terrainEffect(projectile, -1);
        emit({ type: "SHOT_BLOCKED", kind: projectile.kind, x: projectile.x, y: projectile.y });
        continue;
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
        continue;
      }
      if (projectile.owner === "player") { updatePlayerShot(projectile); continue; }
      if (projectile.owner !== "mate" && player.barrier > 0 && barrierBlocks(projectile)) {
        projectile.dead = true;
        state.stats.barrierBlocks++;
        emit({ type: "CANCEL", rule: "BARRIER_BLOCKS_SHOT", x: projectile.x, y: projectile.y });
        continue;
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
        if (projectile.dead) continue;
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
        const mult = relayMode ? relayEffectiveness(projectile.arenaElement, casterElement(player)) : 1;
        if (hurtPlayer(projectile.damage * mult, projectile.kind, projectile.x, projectile.y)) {
          if (relayMode) relayAfterHit(player, projectile.damage * mult, projectile.arenaElement, mult, projectile.x, projectile.y);
          if (projectile.onHit) applyStatus(player, projectile.onHit);
          if (projectile.knockback) { const v = Math.hypot(projectile.vx, projectile.vy) || 1; launch(player, projectile.vx / v, projectile.vy / v, DATA_ARENA_ENERGY.launch.WAVE); }
          if (projectile.kind !== "WAVE") projectile.dead = true;
        } else if (player.invulnerable > 0 && projectile.kind !== "WAVE") projectile.dead = true;
        continue;
      }
      if (hasMate && mate.state !== "DOWNED" && mate.state !== "RIDDEN" && distance(projectile.x, projectile.y, mate.x, mate.y) <= projectile.radius + mate.radius) {
        hurtMate(projectile.damage, projectile.kind, projectile.x, projectile.y);
        projectile.dead = true;
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
    return { id: nextId++, rival: true, canSwim:definition.canSwim===true, definitionId: definition.id, speciesId: definition.speciesId, team: "rival", kit: DATA_ARENA_KITS[definition.kit],
      x: spawn.x, y: spawn.y, vx: 0, vy: 0, kbx: 0, kby: 0, radius: definition.radius, hp: definition.hp, maxHp: definition.hp,
      speed: definition.speed, preferredRange: definition.preferredRange, tier: tierRule, damageScale: tierRule.damage,
      energy: DATA_ARENA_ENERGY.max, energySpentAt: -Infinity, cooldowns: Object.create(null), ult: 0, cast: null, lunge: null,
      barrier: 0, slow: 0, slowTimer: 0, root: 0, burn: 0, hitFlash: 0, facing: -1, active: false, invulnerable: 0,
      goal: null, goalTimer: 0, strafe: 1, strafeTimer: 1.2, dodge: null, dashTimer: 0, dashCooldown: 0, dashX: 0, dashY: 0,
      threatSeen: new Set(), wantsCover: false, field: createFlowField(grid, "walker"), attackDelay: 0.8 };
  }

  function damageRival(rival, amount, cause) {
    if (rival.hp <= 0 || !rival.active) return false;
    if (rival.invulnerable > 0 && cause !== "BURN") return false;
    rival.hp = Math.max(0, rival.hp - amount);
    rival.hitFlash = 0.12;
    if (cause !== "BURN") emit({ type: "RIVAL_HIT", amount, cause, x: rival.x, y: rival.y });
    return true;
  }

  /** Closest approach of a moving shot to a body within `horizon` seconds. */
  function threatOf(shot, body, horizon) {
    const rx = body.x - shot.x, ry = body.y - shot.y;
    const speed2 = shot.vx * shot.vx + shot.vy * shot.vy;
    if (speed2 < 1) return null;
    const t = clamp((rx * shot.vx + ry * shot.vy) / speed2, 0, horizon);
    if (t <= 0) return null;
    const cx = shot.x + shot.vx * t - body.x, cy = shot.y + shot.vy * t - body.y;
    const miss = Math.hypot(cx, cy);
    return miss <= shot.radius + body.radius + 10 ? { t, dirX: shot.vx, dirY: shot.vy } : null;
  }

  function chooseRivalGoal(rival) {
    // A useful arena zone in reach beats the usual spacing (relay stage three).
    const arenaGoal = relayArena?.rivalTarget(rival);
    if (arenaGoal) { rival.wantsCover = false; rival.goal = arenaGoal; return; }
    const kitReady = kitMoveIds(rival).some((id) => canCast(rival, id));
    // Low energy or every move cooling: break line of sight behind a pillar.
    rival.wantsCover = rival.ult < DATA_ARENA_ENERGY.ultMax && (rival.energy < 28 || !kitReady || (player.ult >= DATA_ARENA_ENERGY.ultMax && rival.hp < rival.maxHp * 0.5));
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * TAU + random() * 0.2;
      // A charged burst ultimate makes the rival close in (its long windup is the player's cue to leave).
      const ult = DATA_ARENA_MOVES[rival.kit.ultimate];
      const range = rival.ult >= DATA_ARENA_ENERGY.ultMax && ult.type === "NOVA" ? ult.radius * 0.6 : rival.preferredRange;
      const radius = rival.wantsCover ? range * (0.9 + random() * 0.5) : range * (0.8 + random() * 0.4);
      const x = player.x + Math.cos(angle) * radius, y = player.y + Math.sin(angle) * radius;
      if (x < 40 || y < 40 || x > worldWidth - 40 || y > worldHeight - 40) continue;
      if (blocked(x, y, rival.radius * 0.8, movementKind(rival)) || grid.burningAt(x, y)) continue;
      const sight = hasSight(x, y, player.x, player.y);
      let score = -distance(x, y, rival.x, rival.y) / 260;
      score += rival.wantsCover ? (sight ? -3 : 3) : (sight ? 2.5 : -2);
      for (const zone of state.zones) if (zone.team === "player" && distance(x, y, zone.x, zone.y) < zone.radius + 40) score -= 4;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    rival.goal = best ?? { x: rival.x, y: rival.y };
  }

  function rivalPickMove(rival, d) {
    const options = [];
    if (relayMode ? rival.energy >= DATA_ARENA_RELAY.ultimateTp && !(rival.cooldowns[rival.kit.ultimate] > 0) : rival.ult >= DATA_ARENA_ENERGY.ultMax) {
      const ult = DATA_ARENA_MOVES[rival.kit.ultimate];
      if ((ult.type === "NOVA" && d < ult.radius * 0.85) || (ult.type === "LANCE" && d < ult.range * 0.8)) return { id: rival.kit.ultimate, ultimate: true };
    }
    for (const id of kitMoveIds(rival)) {
      if (!canCast(rival, id)) continue;
      const move = DATA_ARENA_MOVES[id];
      const range = move.type === "LUNGE" ? move.distance + 40 : move.range;
      if (d > range) continue;
      const weight = move.type === "ZONE" ? (Math.hypot(player.vx, player.vy) < 120 ? 3 : 1.2) : move.type === "LUNGE" ? (d < move.distance ? 1.4 : 0) : 2;
      if (weight > 0) options.push({ id, weight });
    }
    if (!options.length) return null;
    let roll = random() * options.reduce((sum, option) => sum + option.weight, 0);
    for (const option of options) { roll -= option.weight; if (roll <= 0) return option; }
    return options[options.length - 1];
  }

  function updateRival(rival) {
    rival.hitFlash = Math.max(0, rival.hitFlash - DT);
    rival.invulnerable = Math.max(0, rival.invulnerable - DT);
    rival.dashCooldown = Math.max(0, rival.dashCooldown - DT);
    if (!rival.active || rival.hp <= 0) return;
    tickKit(rival, rival.tier.energyRegen);
    rival.ult = Math.min(DATA_ARENA_ENERGY.ultMax, rival.ult + DT * 3.2);
    const d = distance(rival.x, rival.y, player.x, player.y) || 1;
    if (Math.abs(player.x - rival.x) > 6 && !rival.cast) rival.facing = player.x > rival.x ? 1 : -1;
    // Dodge: react to a shot or zone heading our way, after the tier's reaction time.
    if (rival.dashTimer > 0) {
      rival.dashTimer -= DT;
      const step = 980 * DT;
      if (!blocked(rival.x + rival.dashX * step, rival.y + rival.dashY * step, rival.radius * 0.8, movementKind(rival))) { rival.x += rival.dashX * step; rival.y += rival.dashY * step; }
      return;
    }
    if (rival.dodge) {
      rival.dodge.wait -= DT;
      if (rival.dodge.wait <= 0) {
        const { dirX, dirY } = rival.dodge;
        const length = Math.hypot(dirX, dirY) || 1;
        let px = -dirY / length, py = dirX / length;
        if (blocked(rival.x + px * 120, rival.y + py * 120, rival.radius, movementKind(rival))) { px = -px; py = -py; }
        rival.dashX = px; rival.dashY = py; rival.dashTimer = 0.18; rival.invulnerable = 0.22; rival.dashCooldown = 2.2;
        rival.cast = null; removeTelegraph(`cast:${rival.id}`);
        rival.dodge = null;
        state.stats.rivalDodges++;
        emit({ type: "RIVAL_DODGE", x: rival.x, y: rival.y });
        return;
      }
    } else if (rival.dashCooldown <= 0 && !rival.lunge) {
      let threat = null;
      for (const shot of state.projectiles) {
        if (shot.dead || shot.owner !== "player" || rival.threatSeen.has(shot.id)) continue;
        const hit = threatOf(shot, rival, 0.45);
        if (hit) { rival.threatSeen.add(shot.id); threat = hit; break; }
      }
      if (!threat) for (const zone of state.zones) {
        if (zone.team !== "player" || rival.threatSeen.has(zone.id)) continue;
        if (distance(zone.x, zone.y, rival.x, rival.y) < zone.radius + rival.radius && zone.delay - zone.t < 0.6) {
          rival.threatSeen.add(zone.id); threat = { dirX: rival.x - zone.x + 0.01, dirY: rival.y - zone.y };
          threat = { dirX: -threat.dirY, dirY: threat.dirX };
        }
      }
      if (threat && random() < rival.tier.dodge) rival.dodge = { wait: rival.tier.reaction, dirX: threat.dirX, dirY: threat.dirY };
    }
    if (rival.lunge) return;
    // Position: re-plan every half second, preferring cover when spent.
    rival.goalTimer -= DT;
    if (rival.goalTimer <= 0 || !rival.goal) { chooseRivalGoal(rival); rival.goalTimer = 0.5 + random() * 0.3; }
    rival.strafeTimer -= DT;
    if (rival.strafeTimer <= 0) { rival.strafe = -rival.strafe; rival.strafeTimer = 1.1 + random() * 1.1; }
    let ax = 0, ay = 0;
    const gap = distance(rival.goal.x, rival.goal.y, rival.x, rival.y);
    if (gap > 40) {
      rival.field.update(rival.goal.x, rival.goal.y, DT, 0.5);
      const direct = gap < cell * 2 && hasSight(rival.x, rival.y, rival.goal.x, rival.goal.y);
      const dir = direct ? { x: (rival.goal.x - rival.x) / gap, y: (rival.goal.y - rival.y) / gap } : rival.field.direction(rival.x, rival.y);
      if (dir) { ax = dir.x; ay = dir.y; }
    } else if (!rival.wantsCover) {
      ax = (-(player.y - rival.y) / d) * rival.strafe; ay = ((player.x - rival.x) / d) * rival.strafe;
    }
    for (const zone of state.zones) {
      if (zone.team !== "player") continue;
      const zd = distance(zone.x, zone.y, rival.x, rival.y);
      if (zd < zone.radius + rival.radius + 20) { ax += (rival.x - zone.x) / (zd || 1) * 2; ay += (rival.y - zone.y) / (zd || 1) * 2; }
    }
    if (grid.burningAt(rival.x, rival.y)) { ax += (rival.x - player.x) / d; ay += (rival.y - player.y) / d; }
    const length = Math.hypot(ax, ay);
    if (length > 1) { ax /= length; ay /= length; }
    const speed = rival.speed * moveScale(rival);
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
    // Attack: telegraphed casts with lead aim, only with a clear line.
    rival.attackDelay -= DT;
    if (rival.cast || rival.attackDelay > 0) return; // rooted rivals still fight; they just cannot move
    const playerTargetable = player.state !== "DOWNED" && player.state !== "DEFEATED" && player.state !== "FALLING";
    if (!playerTargetable || !hasSight(rival.x, rival.y, player.x, player.y)) return;
    const pick = rivalPickMove(rival, d);
    if (!pick) return;
    const move = DATA_ARENA_MOVES[pick.id];
    const travel = move.type === "ZONE" ? move.delay : move.speed ? d / move.speed + (move.windup ?? 0) : move.windup ?? 0;
    const lead = rival.tier.lead;
    const aimX = player.x + player.vx * travel * lead, aimY = player.y + player.vy * travel * lead;
    if (beginCast(rival, pick.id, aimX, aimY, { ultimate: Boolean(pick.ultimate) })) rival.attackDelay = 0.2 + random() * 0.35;
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
  const relayFields = ['hp', 'maxHp', 'energy', 'energySpentAt', 'cooldowns', 'ult', 'burn', 'slow', 'slowTimer', 'root', 'dashCharges', 'dashRecharge'];
  function saveRelayPlayer() {
    const entry = state.relay.team[state.relay.active];
    for (const key of relayFields) entry[key] = player[key];
  }
  function switchRelayPlayer(forced = false) {
    const relay = state.relay;
    if (!relay || (!forced && (relay.switchCooldown > 0 || player.state !== 'NORMAL' || player.cast || player.lunge || player.recovery > 0))) return false;
    const index = relay.team.findIndex((entry, i) => i !== relay.active && entry.hp > 0);
    if (index < 0) return false;
    saveRelayPlayer(); relay.active = index;
    const entry = relay.team[index];
    partner = relayPartner(entry.partnerId);
    for(const key of Object.keys(upgrades))delete upgrades[key];Object.assign(upgrades,partner.startingUpgrades);
    for (const key of relayFields) player[key] = entry[key];
    Object.assign(player, { partnerId: partner.id, speciesId: partner.speciesId, canSwim: partner.canSwim === true, kit: relayKit(partner.id, relayLoadouts[partner.id]),
      state: 'NORMAL', stateTime: 0, cast: null, lunge: null, action: null, recovery: 0, barrier: 0, hitFlash: 0,
      vx: 0, vy: 0, kbx: 0, kby: 0, dashTimer: 0, dashGrace: 0, invulnerable: forced ? 0.8 : 0.25 });
    // Switching never moves a land creature into an impassable cell.
    if (blocked(player.x, player.y, player.radius, movementKind(player))) {
      const bank = grid.nearestSafeCell(player.x, player.y); if (bank) { player.x = bank.x; player.y = bank.y; }
    }
    relay.switchCooldown = DATA_ARENA_RELAY.switchCooldown; relay.playerDownAt = null;
    kitBuffer = null; removeTelegraph(`cast:${player.id}`); laser.firing = false;
    emit({ type: 'RELAY_SWITCH', partnerId: partner.id, forced, x: player.x, y: player.y });
    return true;
  }
  function relayRival(index) {
    const definition = DATA_ARENA_RIVALS[index];
    const rival = createRival({ ...definition, hp: Math.round(definition.hp * DATA_ARENA_RELAY.rivalHpScale) }, 0);
    rival.active = true; return rival;
  }
  function updateRelay() {
    const relay = state.relay, t = state.tournament;
    if (t.status === 'INTRO') { t.timer -= DT; if (t.timer <= 0) { t.status = 'FIGHT'; state.rivals[0].active = true; emit({ type: 'ROUND_START', round: 0 }); } return; }
    if (t.status === 'KO') { t.timer -= DT; if (t.timer <= 0) finish(t.winner === 'player' ? 'VICTORY' : t.winner === 'draw' ? 'DRAW' : 'DEFEAT'); return; }
    t.roundTime += DT;
    relayArena?.step(DT, t.roundTime);
    // Cooldowns tick on the bench; TP regenerates only for the active member.
    relay.team.forEach((entry, i) => { if (i !== relay.active) for (const id in entry.cooldowns) entry.cooldowns[id] = Math.max(0, entry.cooldowns[id] - DT); });
    const rival = state.rivals[0];
    if (player.hp <= 0) {
      relay.playerDownAt ??= state.time;
      player.cast = player.lunge = player.action = null; removeTelegraph(`cast:${player.id}`);
      if (state.time - relay.playerDownAt >= DATA_ARENA_RELAY.knockoutSeconds) switchRelayPlayer(true);
    }
    if (rival.hp <= 0) {
      relay.enemyDownAt ??= state.time;
      rival.cast = rival.lunge = rival.action = null; removeTelegraph(`cast:${rival.id}`);
      if (relay.enemyIndex < 1 && state.time - relay.enemyDownAt >= DATA_ARENA_RELAY.knockoutSeconds) {
        relay.enemyIndex++; relay.enemyDownAt = null; state.rivals = [relayRival(relay.enemyIndex)];
        state.score += 1000; emit({ type: 'RELAY_RIVAL', x: state.rivals[0].x, y: state.rivals[0].y });
      }
    }
    const mineDead = player.hp <= 0 && relay.team.every((entry, i) => i === relay.active || entry.hp <= 0);
    const theirsDead = relay.enemyIndex === 1 && state.rivals[0].hp <= 0;
    const timedOut = t.roundTime >= DATA_ARENA_RELAY.seconds;
    if (!mineDead && !theirsDead && !timedOut) return;
    saveRelayPlayer();
    const mine = relay.team.reduce((sum, entry) => sum + Math.max(0, entry.hp) / entry.maxHp, 0) / 2;
    const enemy = ((1 - relay.enemyIndex) + Math.max(0, state.rivals[0].hp) / state.rivals[0].maxHp) / 2;
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
    const timeLeft = Math.max(0, DATA_ARENA_TIMELINE.limit - state.time);
    const breakdown = { combat: state.score, victory: 0, time: 0, hp: 0 };
    if (outcome === "VICTORY" && tournamentMode) breakdown.victory = DATA_ARENA_TOURNAMENT.championScore;
    else if (outcome === "VICTORY") {
      breakdown.victory = DATA_ARENA_SCORE.victory;
      breakdown.time = Math.round(timeLeft * DATA_ARENA_SCORE.perSecondLeft);
      breakdown.hp = Math.round(player.hp * DATA_ARENA_SCORE.perHp);
    }
    const total = breakdown.combat + breakdown.victory + breakdown.time + breakdown.hp;
    state.result = Object.freeze({ outcome, timeSeconds: Math.round(state.time * 100) / 100, score: total, breakdown: Object.freeze(breakdown),
      kills: state.kills, level: state.level, upgrades: Object.freeze({ ...upgrades }), cheers: state.cheers,
      stats: Object.freeze({ ...state.stats }), partnerId, seed, mode,
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
    if (relayMode && state.tournament.status === 'FIGHT' && input.switchPartner) switchRelayPlayer();
    if (tournamentMode && state.tournament?.status !== "FIGHT") input = { ...normalizeInput(NEUTRAL_INPUT), aimX: input.aimX, aimY: input.aimY };
    state.time += DT;
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
    if (!tournamentMode) updatePhases();
    updatePlayer(input);
    if (player.state === "NORMAL") stepKnock(player); else player.kbx = player.kby = 0;
    playerKitInput(input);
    tickKit(player);
    updateLaser(input);
    updateMate(input);
    updateSurges();
    updateEnemies();
    for (const rival of state.rivals) updateRival(rival);
    if(relayMode)for(const rival of state.rivals)if(rival.active&&rival.hp>0&&player.hp>0){
      const dx=rival.x-player.x,dy=rival.y-player.y,d=Math.hypot(dx,dy),overlap=(rival.radius+player.radius)*.8-d;
      if(overlap>0){const nx=d>0?dx/d:1,ny=d>0?dy/d:0;moveBody(player,-nx*overlap*.5,-ny*overlap*.5,movementKind(player));moveBody(rival,nx*overlap*.5,ny*overlap*.5,movementKind(rival));}
    }
    updateBoss();
    updateScans();
    updateRings();
    updateZones();
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
    return { moveX, moveY, aimX: aim ? input.aimX : null, aimY: aim ? input.aimY : null,
      fire: Boolean(input.fire), dash: Boolean(input.dash), surge: Boolean(input.surge), ride: Boolean(input.ride),
      cast: Number.isInteger(input.cast) ? input.cast : null, ult: Boolean(input.ult), autoAim: Boolean(input.autoAim), switchPartner: Boolean(input.switchPartner) };
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
      status: state.tournament.status, progress: state.relay.enemyIndex, goal: 2, done: state.result?.outcome === 'VICTORY' };
    const id = state.phaseId;
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
    state.relay = { active: 0, switchCooldown: 0, enemyIndex: 0, playerDownAt: null, enemyDownAt: null,
      team: relayTeamIds(partnerId,relayReserveId).map(id => {
        const p = relayPartner(id), hp = Math.round(p.hp * DATA_ARENA_RELAY.playerHpScale);
        return { partnerId: id, speciesId: p.speciesId, hp, maxHp: hp, energy: DATA_ARENA_RELAY.tpMax, energySpentAt: -Infinity,
          cooldowns: Object.create(null), ult: 0, burn: 0, slow: 0, slowTimer: 0, root: 0, dashCharges: 1, dashRecharge: 0 };
      }) };
    state.tournament = { round: 0, status: 'INTRO', timer: 2, roundTime: 0, results: [], order: ['tide', 'flame'] };
    state.rivals = [relayRival(0)]; state.rivals[0].active = false;
    relayArena = createRelayArenaEvents({ map, grid, emit, now: () => state.time, bodies: () => [player, state.rivals[0]],
      effects: { tpMax: DATA_ARENA_RELAY.tpMax,
        heal: (body, team, amount) => { if (team === 0) healPlayer(amount); else body.hp = Math.min(body.maxHp, body.hp + amount); },
        dashMissing: (body, team) => team === 0 && player.dashCharges < stat.dashCharges,
        refillDash: (body, team) => { if (team === 0) { player.dashCharges = stat.dashCharges; player.dashRecharge = 0; } } } });
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
      damageRival, chooseRivalGoal, endRound }),
    choose,
    drainEvents() { return events.splice(0, events.length); },
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
        player: { partnerId: player.partnerId, speciesId: player.speciesId, facing8: player.facing8, action: player.action ? { ...player.action } : null, x: Math.round(player.x), y: Math.round(player.y), hp: Math.round(player.hp), maxHp: player.maxHp, state: player.state,
          dashCharges: player.dashCharges, dashMax: stat.dashCharges, dashRecharge: player.dashRecharge, revives: player.revives,
           surface: grid.surfaceAt(player.x, player.y), canSwim:player.canSwim, invulnerable: player.invulnerable > 0 },
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
        relay: relayMode ? { active: state.relay.active, switchCooldown: state.relay.switchCooldown, enemyIndex: state.relay.enemyIndex,
          team: state.relay.team.map((entry, index) => ({ partnerId: entry.partnerId, speciesId: entry.speciesId,
            hp: Math.round(index === state.relay.active ? player.hp : entry.hp), maxHp: entry.maxHp,
            tp: Math.round(index === state.relay.active ? player.energy : entry.energy) })) } : null,
        kit: { moves: player.kit.moves.map((id) => ({ id, cooldown: player.cooldowns[id] ?? 0, cooldownMax: (moveFor(id).cooldown ?? 0) * stat.cooldownScale,
          energy: moveFor(id).energy ?? 0, type: moveFor(id).type, ready: canCast(player, id) })),
          ultimateCooldown: player.cooldowns[player.kit.ultimate] ?? 0, ultimate: player.kit.ultimate, ult: Math.round(player.ult), ultMax: DATA_ARENA_ENERGY.ultMax, energy: Math.round(player.energy), energyMax: DATA_ARENA_ENERGY.max,
          currency: relayMode ? "TP" : "ENERGY", recovery: player.recovery ?? 0, basic: relayMode ? RELAY_ACTION_PROFILES[partner.id].basic : null,
          casting: player.cast ? player.cast.moveId : null, barrier: player.barrier > 0, slowed: player.slow > 0, rooted: player.root > 0 },
        rivals: state.rivals.map((r) => ({ id: r.definitionId, speciesId: r.speciesId, x: Math.round(r.x), y: Math.round(r.y), hp: Math.round(r.hp), maxHp: r.maxHp,
          energy: Math.round(r.energy), casting: r.cast ? r.cast.moveId : null, wantsCover: r.wantsCover, active: r.active, rooted: r.root > 0, slowed: r.slow > 0,
          sight: hasSight(r.x, r.y, player.x, player.y) })),
        tournament: state.tournament ? { round: state.tournament.round, status: state.tournament.status, timer: state.tournament.timer,
          roundTime: state.tournament.roundTime, order: [...state.tournament.order], results: state.tournament.results.map((r) => ({ ...r })) } : null,
        zones: state.zones.map((z) => ({ team: z.team, x: z.x, y: z.y, radius: z.radius, left: Math.max(0, z.delay - z.t) })),
        scans: state.scans.map((scan) => ({ x: scan.x, y: scan.y, angle: scan.angle, spin: scan.spin, active: scan.telegraph <= 0, reach: scan.reach ?? 0 })),
        stats: { ...state.stats }, result: state.result
      };
    }
  });
}
