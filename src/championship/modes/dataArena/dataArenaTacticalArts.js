// Data Arena Phase 2 Tactical & Martial-Arts Move Archetypes (2026-11-21).
//
// 100 % original 《網線拍檔》 rules & move mechanics inspired by real-time
// competitive arena combat: stat-stage buffs (勉勵/戰吼), multi-hit close-range
// martial-arts flurries, shadow backstabs, guard-breaking heavy strikes,
// counter riposte stances, capped recovery, 360-degree protect domes, and
// switch-in entry hazards. Pure & deterministic: zero DOM, zero Pixi, zero clocks.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const STAT_STAGE_BOUNDS = Object.freeze({ min: -2, max: 4 });

/** Multiplier for a stat stage (-2..+4): +1 = 1.25x, +2 = 1.5x, -1 = 0.8x, -2 = 0.67x. */
export function statStageMultiplier(stage = 0) {
  const s = clamp(Math.round(stage), STAT_STAGE_BOUNDS.min, STAT_STAGE_BOUNDS.max);
  return s >= 0 ? 1 + s * 0.25 : 1 / (1 - s * 0.25);
}

/** Movement/action speed stage multiplier (-2..+4): +1 = 1.15x, +2 = 1.30x, -1 = 0.87x. */
export function speedStageMultiplier(stage = 0) {
  const s = clamp(Math.round(stage), STAT_STAGE_BOUNDS.min, STAT_STAGE_BOUNDS.max);
  return s >= 0 ? 1 + s * 0.15 : 1 / (1 - s * 0.15);
}

export const TACTICAL_CAPS = Object.freeze({
  buffsPerStay: 2,
  healsPerBattle: 2,
  healShare: 0.3,
  decoyHpShare: 0.25,
  maxHazardLayers: 2,
  hazardDamageShares: Object.freeze([0, 0.1, 0.16]),
  counterDuration: 1.3,
  counterDamageScale: 0.3,
  counterReflectMultiplier: 1.6,
  flurryHits: 4,
  flurryInterval: 0.11,
  flurryReach: 92,
  backstabVanishSeconds: 0.24,
  backstabCritMultiplier: 1.35,
  autoApproachMaxSeconds: 1.35
});

export const WEATHER_RULES = Object.freeze({
  duration: 18,
  chipInterval: 3.0,
  chipShare: 1 / 16,
  boostScale: 1.5,
  dampenScale: 0.5
});

export function desiredWeatherForElement(element) {
  switch (element) {
    case "fire": case "light": case "nature": return "SUN";
    case "water": case "storm": return "RAIN";
    case "frost": return "HAIL";
    case "earth": case "shadow": case "physical": return "SAND";
    default: return "SUN";
  }
}

export function weatherDamageMultiplier(weatherKind, arenaElement) {
  if (!weatherKind || !arenaElement) return 1;
  if (weatherKind === "SUN") {
    if (arenaElement === "fire") return WEATHER_RULES.boostScale;
    if (arenaElement === "water") return WEATHER_RULES.dampenScale;
  } else if (weatherKind === "RAIN") {
    if (arenaElement === "water") return WEATHER_RULES.boostScale;
    if (arenaElement === "fire") return WEATHER_RULES.dampenScale;
  }
  return 1;
}

export function weatherImmune(weatherKind, arenaElement) {
  if (weatherKind === "SAND") return arenaElement === "earth" || arenaElement === "physical";
  if (weatherKind === "HAIL") return arenaElement === "frost";
  return true;
}

/**
 * Six universal original Tactical Arts available to every Relay fighter (key F / HUD button).
 * Every fighter (player & rival) executes them through the exact same simulation rules.
 */
export const DATA_ARENA_TACTICAL_ARTS = Object.freeze({
  rallyCry: Object.freeze({
    id: "rallyCry",
    kind: "BUFF",
    energy: 18,
    cooldown: 7.5,
    windup: 0.2,
    recovery: 0.22,
    reach: 0,
    selfOnly: true,
    atkDelta: 1,
    spdDelta: 1,
    palette: "light",
    piece: "roar"
  }),
  rapidFlurry: Object.freeze({
    id: "rapidFlurry",
    kind: "FLURRY",
    energy: 24,
    cooldown: 6.5,
    windup: 0.14,
    recovery: 0.28,
    reach: TACTICAL_CAPS.flurryReach,
    damagePerHit: 14,
    hits: TACTICAL_CAPS.flurryHits,
    interval: TACTICAL_CAPS.flurryInterval,
    selfDefDelta: -1,
    palette: "fire",
    piece: "claws"
  }),
  ironCounter: Object.freeze({
    id: "ironCounter",
    kind: "COUNTER",
    energy: 20,
    cooldown: 8.5,
    windup: 0.08,
    recovery: 0.18,
    reach: 0,
    selfOnly: true,
    duration: TACTICAL_CAPS.counterDuration,
    palette: "metal",
    piece: "cross"
  }),
  vitalPulse: Object.freeze({
    id: "vitalPulse",
    kind: "HEAL",
    energy: 28,
    cooldown: 11.0,
    windup: 0.26,
    recovery: 0.24,
    reach: 0,
    selfOnly: true,
    healShare: TACTICAL_CAPS.healShare,
    palette: "nature",
    piece: "heal"
  }),
  shadowAmbush: Object.freeze({
    id: "shadowAmbush",
    kind: "BACKSTAB",
    energy: 24,
    cooldown: 7.0,
    windup: 0.12,
    recovery: 0.24,
    reach: 340,
    damage: 44,
    vanishSeconds: TACTICAL_CAPS.backstabVanishSeconds,
    palette: "dark",
    piece: "iai"
  }),
  spikeTrap: Object.freeze({
    id: "spikeTrap",
    kind: "HAZARD",
    energy: 20,
    cooldown: 9.5,
    windup: 0.22,
    recovery: 0.22,
    reach: 0,
    selfOnly: true,
    palette: "earth",
    piece: "quake"
  }),
  decoyShell: Object.freeze({
    id: "decoyShell",
    kind: "DECOY",
    energy: 24,
    cooldown: 14.0,
    windup: 0.18,
    recovery: 0.2,
    reach: 0,
    selfOnly: true,
    hpShare: TACTICAL_CAPS.decoyHpShare,
    palette: "water",
    piece: "orb"
  }),
  weatherShift: Object.freeze({
    id: "weatherShift",
    kind: "WEATHER",
    energy: 22,
    cooldown: 14.0,
    windup: 0.24,
    recovery: 0.2,
    reach: 0,
    selfOnly: true,
    duration: WEATHER_RULES.duration,
    palette: "light",
    piece: "rain"
  })
});

export const TACTICAL_ART_IDS = Object.freeze(Object.keys(DATA_ARENA_TACTICAL_ARTS));

export function tacticalArtById(id) {
  return DATA_ARENA_TACTICAL_ARTS[id] ?? DATA_ARENA_TACTICAL_ARTS.rallyCry;
}

/** Pick a fitting default Tactical Art for a fighter element (used for rivals & default player pick). */
export function defaultTacticalArtForElement(element) {
  switch (element) {
    case "fire": case "physical": return "rapidFlurry";
    case "shadow": case "storm": return "shadowAmbush";
    case "earth": case "frost": return "ironCounter";
    case "nature": case "water": return "vitalPulse";
    case "light": return "rallyCry";
    default: return "rallyCry";
  }
}

/**
 * Derive martial-arts & tactical combat traits on existing 666 / Relay moves
 * without altering base move definitions or breaking deterministic baseline tests.
 */
const GUARD_BREAK_IDS = new Set(["brutalCharge", "quakeSlam", "impactNova", "dawnLance", "shardStorm"]);
const BACKSTAB_IDS = new Set(["shadeStep", "frostStep", "radiantDash", "boltDash"]);
const HAZARD_CLEAR_IDS = new Set(["clawSweep", "whiteout", "vortex", "radiantDash", "surfRush"]);
const COUNTER_BARRIER_IDS = new Set(["ironGuard", "rockGuard", "duskGuard"]);

export function moveCombatTraits(moveId, move = null, moveDisplayName = "") {
  const id = String(moveId ?? "");
  const name = String(moveDisplayName ?? "");
  const guardBreak = GUARD_BREAK_IDS.has(id) || /破|碎|貫|斷|重拳|重擊|崩/.test(name);
  const backstab = BACKSTAB_IDS.has(id) || (move?.type === "BLINK") || /影閃|暗影|背|夜刃|瞬/.test(name);
  const clearsHazards = HAZARD_CLEAR_IDS.has(id) || /旋|轉|風暴|吹雪|掃/.test(name);
  const counterBarrier = COUNTER_BARRIER_IDS.has(id);
  const flurryBonus = (move?.type === "LUNGE" && (id === "fangRush" || /連|亂舞|爪|拳|踢/.test(name)));
  return Object.freeze({ guardBreak, backstab, clearsHazards, counterBarrier, flurryBonus });
}

/** Compute Auto-Dodge probability from fighter speed (PB Ranked ~speed / 260, bounded 0.18..0.68). */
export function speedScaledDodgeChance(speed = 260) {
  // Data Arena speeds are ~220..340 world px/s; normalize to classic ~60..145 speed scale.
  const equivSpeed = clamp((speed - 140) * 0.72, 40, 170);
  return clamp(equivSpeed / 260, 0.18, 0.68);
}
