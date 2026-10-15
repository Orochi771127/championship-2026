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
  DATA_ARENA_SCORE, DATA_ARENA_SPAWN, DATA_ARENA_STEP_SECONDS, DATA_ARENA_TIMELINE
} from "./dataArenaConfig.js";
import { createDataArenaGrid } from "./dataArenaGrid.js";
import { createFlowField } from "./dataArenaNav.js";
import { createArenaRandom, dataArenaUpgrade, drawUpgradeOffer, upgradeValue } from "./dataArenaUpgrades.js";

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

const NEUTRAL_INPUT = Object.freeze({ moveX: 0, moveY: 0, aimX: null, aimY: null, fire: false, dash: false, surge: false, ride: false });

export function createDataArenaSimulation({ seed = 1, partnerId = DATA_ARENA_PARTNERS[0].id, quality = "high" } = {}) {
  const partner = DATA_ARENA_PARTNERS.find((entry) => entry.id === partnerId);
  if (!partner) throw new RangeError(`DATA_ARENA_UNKNOWN_PARTNER:${partnerId}`);
  const random = createArenaRandom(seed);
  const grid = createDataArenaGrid();
  const cell = DATA_ARENA_MAP.cell;
  const worldWidth = grid.cols * cell, worldHeight = grid.rows * cell;
  const at = ([c, r]) => ({ x: (c + 0.5) * cell, y: (r + 0.5) * cell });
  const walkerField = createFlowField(grid, "walker");
  const fireproofField = createFlowField(grid, "fireproof");
  const mateField = createFlowField(grid, "swimmer");
  const events = [];
  const emit = (event) => { event.t = state.time; events.push(event); return event; };
  let nextId = 1;

  const upgrades = { ...partner.startingUpgrades };
  const playerSpawn = at(DATA_ARENA_MAP.playerSpawn), mateSpawn = at(DATA_ARENA_MAP.mateSpawn);

  const player = {
    id: nextId++, x: playerSpawn.x, y: playerSpawn.y, vx: 0, vy: 0, radius: DATA_ARENA_PLAYER.radius,
    hp: partner.hp, maxHp: partner.hp, state: "NORMAL", stateTime: 0, facing: 1,
    invulnerable: 0, dashGrace: 0, dashTimer: 0, dashDirX: 1, dashDirY: 0, dashCharges: 1, dashRecharge: 0,
    perfectThisDash: false, dashHits: new Set(), revives: DATA_ARENA_PLAYER.revives, hitFlash: 0,
    fallFromX: 0, fallFromY: 0
  };
  const laser = {
    angle: 0, firing: false, heat: 0, overheated: false, overheatTimer: 0,
    x0: 0, y0: 0, x1: 0, y1: 0, endKind: "RANGE", igniteCell: -1, igniteAccum: 0, hitTimer: 0
  };
  const mate = {
    id: nextId++, x: mateSpawn.x, y: mateSpawn.y, vx: 0, vy: 0, radius: DATA_ARENA_MATE.radius,
    hp: DATA_ARENA_MATE.hp, maxHp: DATA_ARENA_MATE.hp, state: "FOLLOW", stateTime: 0, facing: -1,
    jetTimer: 0.6, surgeCooldown: 0, surgeAim: null, reviveProgress: 0, downedTime: 0, hitFlash: 0, swimming: false
  };

  const state = {
    seed, partnerId, quality, time: 0, mode: "PLAY", phaseIndex: 0, phaseId: "WARMUP", warnedPhase: 0,
    player, laser, mate, boss: null, enemies: [], projectiles: [], pickups: [], telegraphs: [], scans: [],
    pods: DATA_ARENA_MAP.pods.map(([c, r]) => ({ id: nextId++, ...at([c, r]), hp: DATA_ARENA_GRID_RULES.podHp, respawn: 0, radius: 20 })),
    beacons: DATA_ARENA_MAP.beacons.map(([c, r]) => ({ id: nextId++, ...at([c, r]), active: false, progress: 0, captured: false })),
    cores: [], surges: [],
    xp: 0, level: 1, upgrades, offer: null, pendingLevels: 0,
    score: 0, kills: 0, warmupDone: false,
    hype: 0, cheerTimer: 0, cheerCooldown: 0, cheers: 0,
    stats: { perfectDodges: 0, chains: 0, rescues: 0, falls: 0, coresOut: 0, beaconsCaptured: 0, shardsBroken: 0, orbsErased: 0,
      embersQuenched: 0, bridgesFormed: 0, rides: 0, damageTaken: 0, laserSeconds: 0 },
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
    get hypeGain() { return 1 + upgradeValue(upgrades, "hypeGain"); }
  };
  player.dashCharges = stat.dashCharges;

  // ------------------------------------------------------------------ movement
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
    if (player.dashRecharge <= 0) player.dashRecharge = DATA_ARENA_PLAYER.dash.cooldown;
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
    if (mate.state === "DOWNED" || mate.state === "RIDDEN") return false;
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
    if (surface === "WATER") {
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
    if (!blocked(offX, player.y + 10, player.radius * 0.8, "walker")) player.x = offX;
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
        player.dashRecharge = player.dashCharges < stat.dashCharges ? DATA_ARENA_PLAYER.dash.cooldown : 0;
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
        const speed = stat.speed;
        const tx = input.moveX * speed, ty = input.moveY * speed;
        const k = Math.min(1, DT * 14);
        player.vx += (tx - player.vx) * k; player.vy += (ty - player.vy) * k;
        // Walking stops at the bank; only a dash (or a bridge melting) reaches open water.
        moveBody(player, player.vx * DT, player.vy * DT, "walker");
        if (input.ride) { if (tryMount()) break; }
        if (input.dash && player.dashCharges > 0) { startDash(input); break; }
        if (grid.surfaceAt(player.x, player.y) === "WATER") startFall();
        break;
      }
      case "DASH": {
        const step = DATA_ARENA_PLAYER.dash.speed * DT;
        moveBody(player, player.dashDirX * step, player.dashDirY * step, "player");
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
          const anchor = mate.state !== "DOWNED" ? mate : playerSpawn;
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
        if (player.stateTime >= 1.6 && !state.result) finish("DEFEAT");
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ laser
  function updateLaser(input) {
    laser.hitTimer = Math.max(0, laser.hitTimer - DT);
    const canFire = (player.state === "NORMAL" || player.state === "RIDING") && !laser.overheated;
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
      else damageEnemy(hit.target, damage, "LASER", ox + dx * hit.t, oy + dy * hit.t);
      if (flash) emit({ type: "LASER_HIT", x: ox + dx * hit.t, y: oy + dy * hit.t, target: hit.kind });
      if (pierceLeft <= 0) { end = hit.t; endKind = "TARGET"; break; }
      pierceLeft--;
    }
    if (flash) laser.hitTimer = 0.08;
    laser.x0 = ox; laser.y0 = oy; laser.x1 = ox + dx * end; laser.y1 = oy + dy * end; laser.endKind = endKind;
    // Where the beam strikes the floor (not a body or shard), it heats an oil
    // spill until it catches: aim at the yard on purpose to set it alight.
    const floorHit = endKind === "WALL" || endKind === "RANGE";
    const endCell = !floorHit ? -1 : grid.inBounds(grid.cellOf(laser.x1), grid.cellOf(laser.y1)) ? grid.index(grid.cellOf(laser.x1), grid.cellOf(laser.y1)) : -1;
    if (endCell >= 0 && grid.flammable[endCell] && grid.fire[endCell] <= 0) {
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

  function updateProjectiles() {
    for (const projectile of state.projectiles) {
      if (projectile.dead) continue;
      projectile.life += DT;
      projectile.x += projectile.vx * DT; projectile.y += projectile.vy * DT;
      if (projectile.life > DATA_ARENA_PROJECTILES.maxLifetime || projectile.x < -40 || projectile.y < -40
        || projectile.x > worldWidth + 40 || projectile.y > worldHeight + 40) { projectile.dead = true; continue; }
      const c = grid.cellOf(projectile.x), r = grid.cellOf(projectile.y);
      if (grid.inBounds(c, r) && grid.blocksLaser(grid.index(c, r))) {
        projectile.dead = true;
        emit({ type: "SHOT_BLOCKED", kind: projectile.kind, x: projectile.x, y: projectile.y });
        continue;
      }
      if (projectile.kind === "EMBER" && grid.inBounds(c, r) && grid.ice[grid.index(c, r)] > 0) {
        projectile.dead = true;
        const before = events.length;
        grid.meltAt(projectile.x, projectile.y, DATA_ARENA_GRID_RULES.emberIceMelt, events);
        for (let k = before; k < events.length; k++) events[k].t = state.time;
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
        if (hurtPlayer(projectile.damage, projectile.kind, projectile.x, projectile.y) || player.invulnerable > 0) projectile.dead = true;
        continue;
      }
      if (mate.state !== "DOWNED" && mate.state !== "RIDDEN" && distance(projectile.x, projectile.y, mate.x, mate.y) <= projectile.radius + mate.radius) {
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
      const slow = enemy.windup > 0 ? 0.25 : 1;
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
    const gates = DATA_ARENA_MAP.gates.map(at)
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
      state.cores = DATA_ARENA_MAP.fireCores.map((pos) => ({ id: nextId++, ...at(pos), out: false, timer: 1.6, armed: false }));
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
      const center = at([DATA_ARENA_MAP.stage.col, DATA_ARENA_MAP.stage.row]);
      state.scans = [0, Math.PI].map((offset) => ({ id: nextId++, x: center.x, y: center.y, angle: base + offset, spin,
        telegraph: DATA_ARENA_SCAN.telegraph, cooldown: 0 }));
      state.scanRingTimer = 2.5;
    } else if (phase.id === "GUARDIAN") {
      state.scans = [];
      const spawn = at(DATA_ARENA_MAP.bossSpawn);
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
    const center = at(DATA_ARENA_MAP.bossSpawn);
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
    state.offer = drawUpgradeOffer(upgrades, random);
    state.mode = "LEVEL_UP";
    emit({ type: "OFFER", options: [...state.offer] });
  }

  // ------------------------------------------------------------------ result
  function finish(outcome) {
    const timeLeft = Math.max(0, DATA_ARENA_TIMELINE.limit - state.time);
    const breakdown = { combat: state.score, victory: 0, time: 0, hp: 0 };
    if (outcome === "VICTORY") {
      breakdown.victory = DATA_ARENA_SCORE.victory;
      breakdown.time = Math.round(timeLeft * DATA_ARENA_SCORE.perSecondLeft);
      breakdown.hp = Math.round(player.hp * DATA_ARENA_SCORE.perHp);
    }
    const total = breakdown.combat + breakdown.victory + breakdown.time + breakdown.hp;
    state.result = Object.freeze({ outcome, timeSeconds: Math.round(state.time * 100) / 100, score: total, breakdown: Object.freeze(breakdown),
      kills: state.kills, level: state.level, upgrades: Object.freeze({ ...upgrades }), cheers: state.cheers,
      stats: Object.freeze({ ...state.stats }), partnerId, seed });
    state.mode = "ENDED";
    laser.firing = false;
    emit({ type: "RESULT", outcome, score: total });
  }

  // ------------------------------------------------------------------ public
  function step(rawInput = NEUTRAL_INPUT) {
    if (state.mode === "ENDED" || state.mode === "LEVEL_UP") return false;
    const input = normalizeInput(rawInput);
    state.time += DT;
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
    updatePhases();
    updatePlayer(input);
    updateLaser(input);
    updateMate(input);
    updateSurges();
    updateEnemies();
    updateBoss();
    updateScans();
    updateRings();
    updateProjectiles();
    updateTelegraphs();
    const gridEvents = [];
    grid.step(DT, gridEvents);
    for (const event of gridEvents) { event.t = state.time; events.push(event); }
    // A body standing on melted ice drops into the water.
    if ((player.state === "NORMAL") && grid.surfaceAt(player.x, player.y) === "WATER") startFall();
    if ((player.state === "NORMAL" || player.state === "DASH") && grid.burningAt(player.x, player.y)) {
      // Fire is a damage-over-time zone, never an instant kill.
      if (player.invulnerable <= 0) {
        player.hp -= DATA_ARENA_GRID_RULES.fireDps * DT;
        state.stats.damageTaken += DATA_ARENA_GRID_RULES.fireDps * DT;
        if (player.hp <= 0) hurtPlayer(1, "FIRE", player.x, player.y);
      }
    }
    for (const pod of state.pods) if (pod.respawn > 0) { pod.respawn -= DT; if (pod.respawn <= 0) { pod.hp = DATA_ARENA_GRID_RULES.podHp; emit({ type: "POD_READY", x: pod.x, y: pod.y }); } }
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
      fire: Boolean(input.fire), dash: Boolean(input.dash), surge: Boolean(input.surge), ride: Boolean(input.ride) };
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
    return true;
  }

  function objective() {
    const id = state.phaseId;
    if (id === "WARMUP") return { id, progress: Math.min(state.kills, DATA_ARENA_SPAWN.warmupKills), goal: DATA_ARENA_SPAWN.warmupKills, done: state.warmupDone };
    if (id === "EMBERS") return { id, progress: state.cores.filter((c) => c.out).length, goal: state.cores.length || 3, done: state.cores.length > 0 && state.cores.every((c) => c.out) };
    if (id === "TIDE" || id === "SCAN") return { id, progress: state.beacons.filter((b) => b.captured).length, goal: state.beacons.length, done: state.beacons.every((b) => b.captured) };
    const boss = state.boss;
    return { id, progress: boss ? Math.round((1 - boss.hp / boss.maxHp) * 100) : 0, goal: 100, done: boss?.state === "DOWN",
      shielded: state.beacons.some((b) => !b.captured) };
  }

  return Object.freeze({
    grid,
    step,
    /** Rule hooks for deterministic unit tests; the screen never calls these. */
    internals: Object.freeze({ spawnEnemy, spawnProjectile, addHype, burstPod, launchSurge, hurtPlayer, hurtMate, enterPhase }),
    choose,
    drainEvents() { return events.splice(0, events.length); },
    getState: () => state,
    objective,
    stats: stat,
    /** A plain, JSON-safe summary for HUD and QA observation. */
    getSnapshot() {
      const boss = state.boss;
      return {
        mode: state.mode, time: Math.round(state.time * 1000) / 1000, phase: state.phaseId, level: state.level, xp: state.xp,
        xpToNext: xpToNext(state.level), score: state.score, kills: state.kills, hype: Math.round(state.hype), cheer: state.cheerTimer > 0,
        player: { x: Math.round(player.x), y: Math.round(player.y), hp: Math.round(player.hp), maxHp: player.maxHp, state: player.state,
          dashCharges: player.dashCharges, dashMax: stat.dashCharges, dashRecharge: player.dashRecharge, revives: player.revives,
          surface: grid.surfaceAt(player.x, player.y), invulnerable: player.invulnerable > 0 },
        laser: { firing: laser.firing, heat: laser.heat, heatCapacity: stat.heatCapacity, overheated: laser.overheated, endKind: laser.endKind,
          angle: laser.angle, length: Math.round(Math.hypot(laser.x1 - laser.x0, laser.y1 - laser.y0)) },
        mate: { x: Math.round(mate.x), y: Math.round(mate.y), hp: Math.round(mate.hp), maxHp: Math.round(mate.maxHp), state: mate.state,
          surgeCooldown: mate.surgeCooldown, surgeMax: stat.surgeCooldown, reviveProgress: mate.reviveProgress, swimming: mate.swimming },
        boss: boss ? { hp: Math.round(boss.hp), maxHp: boss.maxHp, state: boss.state, enraged: boss.enraged, x: Math.round(boss.x), y: Math.round(boss.y),
          shielded: state.beacons.some((b) => !b.captured) } : null,
        enemies: state.enemies.length, projectiles: state.projectiles.length, burning: grid.burningCount, ice: grid.iceCount,
        objective: objective(), offer: state.offer ? [...state.offer] : null, upgrades: { ...upgrades },
        beacons: state.beacons.map((b) => ({ x: b.x, y: b.y, active: b.active, captured: b.captured, progress: b.progress })),
        cores: state.cores.map((c) => ({ x: c.x, y: c.y, out: c.out })),
        pods: state.pods.map((p) => ({ x: p.x, y: p.y, ready: p.respawn <= 0 })),
        scans: state.scans.map((scan) => ({ x: scan.x, y: scan.y, angle: scan.angle, spin: scan.spin, active: scan.telegraph <= 0, reach: scan.reach ?? 0 })),
        stats: { ...state.stats }, result: state.result
      };
    }
  });
}
