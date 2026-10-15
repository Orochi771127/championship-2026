// Data Arena: Tidal Data Harbor Challenge -- tuning data.
//
// OWNER_APPROVED_ADAPTATION 2026-10-15 (docs/coordination/OWNER_DIRECTION.md).
// An original real-time 1vE mode. Nothing here is ROM evidence, and nothing
// here is read by Championship Raising, Hunt, Battle, Shop or the save. Every
// gameplay number of the mode lives in this file so balance changes are data
// edits, and the simulation stays a pure function of (seed, config, inputs).

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const DATA_ARENA_VERSION = "dataArena.v1";

// Fixed simulation step. The presentation interpolates; the rules never read
// frame time, so a 30 Hz phone and a 144 Hz desktop play the same match.
export const DATA_ARENA_STEP_SECONDS = 1 / 60;
export const DATA_ARENA_MAX_STEPS_PER_FRAME = 8;

export const DATA_ARENA_TERRAIN = deepFreeze({
  GROUND: 0, // dock plating
  SOLID: 1, // containers and pylons: block movement, laser and shots
  WATER: 2, // the tide channel: walkers sink, swimmers pass, cryo freezes
  STANDS: 3, // the crowd stands along the north edge (solid)
  STAGE: 4, // the raised central stage (walkable)
  BRIDGE: 5 // the retractable data bridge; becomes WATER when the tide opens
});

const T = DATA_ARENA_TERRAIN;

/**
 * The harbor is authored as rectangles on a 64 px grid, 60 x 40 cells
 * (3840 x 2560 world px). A 1280 x 720 desktop view covers 20 x 11 cells at
 * zoom 1, so the field spans about three views wide and three-plus deep.
 */
export const DATA_ARENA_MAP = deepFreeze({
  cell: 64,
  cols: 60,
  rows: 40,
  // [col, row, width, height, terrain]; later rectangles overwrite earlier.
  rects: [
    [0, 0, 60, 3, T.STANDS],
    // Stand gaps are VIP boxes: still solid, drawn differently.
    [0, 28, 60, 4, T.WATER],
    [28, 28, 4, 4, T.BRIDGE],
    // North yard cover (shipping containers).
    [7, 7, 3, 2, T.SOLID], [14, 11, 1, 3, T.SOLID], [5, 15, 2, 2, T.SOLID],
    [19, 20, 3, 1, T.SOLID], [11, 24, 2, 1, T.SOLID], [23, 8, 2, 2, T.SOLID],
    [43, 7, 3, 2, T.SOLID], [47, 11, 1, 3, T.SOLID], [53, 15, 2, 2, T.SOLID],
    [38, 20, 3, 1, T.SOLID], [47, 24, 2, 1, T.SOLID], [35, 8, 2, 2, T.SOLID],
    // South pier cover.
    [19, 34, 2, 2, T.SOLID], [39, 34, 2, 2, T.SOLID], [6, 37, 2, 1, T.SOLID], [52, 37, 2, 1, T.SOLID]
  ],
  // The central stage: a disc of STAGE cells with four solid scan pylons.
  stage: { col: 30, row: 15, radius: 5.2 },
  pylons: [[25, 10], [35, 10], [25, 20], [35, 20]],
  // Flammable cargo yards (oil-slick data spills).
  flammable: [[3, 18, 15, 9], [42, 18, 15, 9], [24, 23, 12, 4]],
  // Cryo pods sit on the banks; bursting one freezes a column across the tide.
  pods: [[9, 27], [21, 27], [38, 27], [50, 27], [15, 32], [45, 32]],
  beacons: [[10, 35], [30, 36], [50, 35]],
  fireCores: [[9, 22], [50, 22], [30, 25]],
  playerSpawn: [30, 23],
  mateSpawn: [32, 24],
  bossSpawn: [30, 15],
  // Enemy entry gates: north yard edges and the south pier.
  gates: [[1, 6], [1, 14], [1, 22], [58, 6], [58, 14], [58, 22], [12, 4], [48, 4], [2, 34], [57, 34], [30, 38]]
});

export const DATA_ARENA_TIMELINE = deepFreeze({
  // Seconds. Each phase is announced `warn` seconds early with a banner.
  warn: 3,
  phases: [
    { id: "WARMUP", at: 0 },
    { id: "EMBERS", at: 45 },
    { id: "TIDE", at: 90 },
    { id: "SCAN", at: 150 },
    { id: "GUARDIAN", at: 195 }
  ],
  // The match ends as a time-out loss after this, whatever the guardian has left.
  limit: 330
});

export const DATA_ARENA_PLAYER = deepFreeze({
  radius: 20,
  dash: { duration: 0.16, speed: 1250, invulnerable: 0.24, cooldown: 1.0, charges: 1, nearMiss: 24 },
  laser: { range: 660, width: 10, turnRate: 10, overheatLock: 1.5, igniteSeconds: 0.45 },
  fall: { sink: 0.7, damage: 8, invulnerable: 1.2 },
  hitInvulnerable: 0.55,
  respawn: { delay: 2.4, hpShare: 0.75, invulnerable: 2.0 },
  revives: 1,
  pickupMagnet: 130,
  pickupRadius: 34
});

// Three selectable partners. Stats are arena-only and never touch the save.
export const DATA_ARENA_PARTNERS = deepFreeze([
  { id: "ember-lizard", speciesId: "species-034", hp: 130, speed: 250, laserDps: 44, heatPerSecond: 34, coolPerSecond: 46,
    heatCapacity: 100, laserWidth: 10, perk: "BALANCED", startingUpgrades: {} },
  { id: "corona-cub", speciesId: "species-064", hp: 112, speed: 236, laserDps: 56, heatPerSecond: 38, coolPerSecond: 44,
    heatCapacity: 100, laserWidth: 14, perk: "WIDE_BEAM", startingUpgrades: {} },
  { id: "frost-drake", speciesId: "species-061", hp: 120, speed: 262, laserDps: 42, heatPerSecond: 32, coolPerSecond: 48,
    heatCapacity: 100, laserWidth: 10, perk: "FROST_BREATH", startingUpgrades: { frostLens: 1 } }
]);

export const DATA_ARENA_MATE = deepFreeze({
  speciesId: "species-073",
  hp: 170,
  radius: 30,
  speedLand: 215,
  speedWater: 265,
  rideSpeedLand: 245,
  rideSpeedWater: 290,
  followDistance: 118,
  jet: { interval: 1.1, range: 320, damage: 12, speed: 520, radius: 9 },
  surge: { cooldown: 10, windup: 0.28, speed: 760, range: 540, width: 70, damage: 22, knockback: 280,
    extinguishRadius: 2.6, pathRadius: 1.1, coreRadius: 130 },
  ride: { reach: 120, mount: 0.32, hopReach: 170, damageShare: 0.5 },
  revive: { radius: 86, seconds: 1.8, autoSeconds: 15, hpShare: 0.5 }
});

export const DATA_ARENA_GRID_RULES = deepFreeze({
  fireBurnSeconds: 22,
  fireTick: 0.6,
  fireSpreadHeat: 0.36, // heat added per burning neighbour per tick; 1 ignites
  fireDps: 14, // to walkers standing in a burning cell
  wetSeconds: 14,
  ashSeconds: 30,
  podIceSeconds: 12,
  lensIceSeconds: 5,
  iceWarnSeconds: 2.6,
  podRespawn: 18,
  podHp: 18,
  emberIceMelt: 3,
  coreIgniteInterval: 2.6,
  coreIgniteRadius: 2.2
});

export const DATA_ARENA_ENEMIES = deepFreeze({
  noise: { hp: 30, speed: 122, radius: 18, contactDamage: 7, contactCooldown: 0.8, xp: 1, score: 10 },
  ember: { hp: 42, speed: 96, radius: 19, contactDamage: 6, contactCooldown: 0.8, xp: 2, score: 20,
    fireImmune: true, shot: { interval: 2.5, windup: 0.5, speed: 300, radius: 9, damage: 9, range: 560 } },
  sentinel: { hp: 95, speed: 62, radius: 24, contactDamage: 10, contactCooldown: 1, xp: 4, score: 45,
    shot: { interval: 3.4, windup: 0.7, speed: 230, radius: 13, damage: 14, range: 620, shardHp: 26 } }
});

export const DATA_ARENA_PROJECTILES = deepFreeze({
  // EMBER: fire. Cancelled by water (tide bolt, surge). Melts ice it lands on.
  // ORB: static data. The laser erases it on contact; it never blocks the beam.
  // SHARD: null data. Blocks the beam, which grinds its HP down until it breaks.
  // TIDE: the mate's water bolt. Cancels embers, damages enemies.
  cap: 320,
  orb: { radius: 10, damage: 9 },
  maxLifetime: 6
});

export const DATA_ARENA_BOSS = deepFreeze({
  speciesId: "species-146",
  hp: 1400,
  radius: 58,
  speed: 72,
  entrance: 3.2,
  shieldReduction: 0.6, // while any beacon remains uncaptured
  contactDamage: 18,
  patternGap: 1.25,
  enrageShare: 0.5,
  enrageSpeed: 1.3,
  fan: { telegraph: 0.75, count: 7, spread: 1.05, speed: 310, radius: 10, damage: 11 },
  ring: { telegraph: 0.85, count: 22, gaps: 3, speed: 160, damage: 9 },
  volley: { telegraph: 0.55, count: 3, interval: 0.32, speed: 260, radius: 14, damage: 15, shardHp: 30 },
  slam: { telegraph: 1.05, radius: 150, damage: 24 },
  summon: { count: 4 },
  xp: 0,
  score: 3000
});

export const DATA_ARENA_SCAN = deepFreeze({
  // Phase SCAN: two opposite scanner beams sweep from the stage.
  telegraph: 1.6, length: 1000, width: 22, turnRate: 0.62, damage: 16, hitCooldown: 0.7,
  ringInterval: 5.5, ringCount: 18, ringGaps: 3, ringSpeed: 150
});

export const DATA_ARENA_BEACON = deepFreeze({ radius: 96, seconds: 3, decayPerSecond: 0.35, score: 400 });

export const DATA_ARENA_SPAWN = deepFreeze({
  maxAlive: { high: 38, low: 30 },
  minDistance: 620,
  // Per phase: [interval seconds, group size, composition weights {noise, ember, sentinel}]
  phases: {
    WARMUP: { interval: 2.4, group: 2, mix: { noise: 1 } },
    EMBERS: { interval: 2.8, group: 2, mix: { noise: 0.65, ember: 0.35 } },
    TIDE: { interval: 3.0, group: 2, mix: { noise: 0.6, ember: 0.4 } },
    SCAN: { interval: 3.2, group: 2, mix: { noise: 0.55, ember: 0.25, sentinel: 0.2 } },
    GUARDIAN: { interval: 6.5, group: 2, mix: { noise: 0.8, sentinel: 0.2 } }
  },
  // Kill target for the WARMUP objective.
  warmupKills: 15
});

export const DATA_ARENA_LEVELS = deepFreeze({
  // XP needed to go from level n to n+1 (n starts at 1).
  base: 6, step: 4, max: 12
});

export const DATA_ARENA_CROWD = deepFreeze({
  // Hype is a bounded meter; each source has its own cooldown and the meter
  // ignores input during the post-cheer cooldown, so it cannot be farmed.
  gains: { PERFECT_DODGE: 12, ELEMENT_CHAIN: 10, RESCUE: 16, BEACON: 8, CORE_OUT: 10, MULTI_KILL: 6, BOSS_DOWN: 30 },
  sourceCooldown: 1.2,
  windowSeconds: 10,
  windowCap: 40,
  cheerSeconds: 8,
  cheerCooldown: 15,
  cheerLaserDps: 1.25,
  cheerCooling: 1.4,
  cheerScore: 500,
  cheerScoreCap: 3
});

export const DATA_ARENA_SCORE = deepFreeze({
  victory: 3000,
  perSecondLeft: 8,
  perHp: 6,
  coreOut: 300
});
