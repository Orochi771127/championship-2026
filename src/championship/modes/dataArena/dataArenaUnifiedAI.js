// Data Arena Unified Fighter AI & Tactical Rules (2026-11-21).
//
// Pure, deterministic decision engine shared by BOTH the player fighter
// (in AUTO / COMMANDER control modes) and rival fighters so every combatant
// in Data Arena moves, dodges, guards, seeks cover, and selects moves under
// the same tactical brain. Zero DOM, zero Pixi, zero wall-clock reads.

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const CONTROL_MODES = Object.freeze(["MANUAL", "COMMANDER", "AUTO"]);

export function normalizeControlMode(mode) {
  return CONTROL_MODES.includes(mode) ? mode : "MANUAL";
}

export const DEFAULT_AI_SETTINGS = Object.freeze({
  autoAttack: true,
  autoGuard: true,
  inputBuffer: true
});

export function normalizeAiSettings(raw = null) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_SETTINGS };
  return {
    autoAttack: raw.autoAttack !== false,
    autoGuard: raw.autoGuard !== false,
    inputBuffer: raw.inputBuffer !== false
  };
}

/**
 * Precision Active Guard rules:
 *  - Active 0.50 s brace window; reduces incoming damage by 65 % (x0.35) and
 *    suppresses knockback while active (holds across multi-hit beams).
 *  - Cannot start while in hitstun.
 *  - Manual Parry Reset: catching a hit in MANUAL mode resets cooldown to 0 s!
 *  - Cooldown is 3.0 s if missed (no hit blocked) or auto-guarded, 1.4 s on AI/Auto block.
 *  - Consecutive BARRIER casts escalate cooldown by +3.0 s per use until partner switch.
 */
export const GUARD_RULES = Object.freeze({
  duration: 0.5,
  damageScale: 0.35,
  missCooldown: 3.0,
  hitCooldown: 1.4,
  manualParryCooldown: 0,
  barrierEscalateStep: 3.0,
  maxBarrierEscalate: 3
});

/**
 * Relay Sudden Death rules:
 *  - Activates in the final quarter (75 %..100 %) of the match timer.
 *  - Progressively scales dealt damage from 1.0x up to 4.0x to prevent stalling.
 */
export const SUDDEN_DEATH_RULES = Object.freeze({
  thresholdShare: 0.75,
  maxMultiplier: 4.0
});

export function suddenDeathMultiplier(roundTime, totalSeconds) {
  if (!(totalSeconds > 0)) return 1;
  const start = totalSeconds * SUDDEN_DEATH_RULES.thresholdShare;
  if (roundTime < start) return 1;
  const span = Math.max(1, totalSeconds - start);
  const ratio = clamp((roundTime - start) / span, 0, 1);
  return Math.round((1 + ratio * (SUDDEN_DEATH_RULES.maxMultiplier - 1)) * 100) / 100;
}

/** Effective engagement reach (in world px) for a Data Arena move. */
export function computeMoveReach(move) {
  if (!move) return 0;
  if (move.type === "LUNGE") return (move.distance ?? 240) + 40;
  if (move.type === "NOVA") return (move.radius ?? 140) + 18;
  if (move.type === "BARRIER") return (move.radius ?? 76) + 220;
  if (move.type === "BLINK") return (move.distance ?? 220) + 160;
  return move.range ?? move.distance ?? 380;
}

/** Closest approach of a moving shot to `body` within `horizon` seconds. */
export function threatOfShot(shot, body, horizon = 0.45) {
  const rx = body.x - shot.x;
  const ry = body.y - shot.y;
  const speed2 = shot.vx * shot.vx + shot.vy * shot.vy;
  if (speed2 < 1) return null;
  const t = clamp((rx * shot.vx + ry * shot.vy) / speed2, 0, horizon);
  if (t <= 0) return null;
  const cx = shot.x + shot.vx * t - body.x;
  const cy = shot.y + shot.vy * t - body.y;
  const miss = Math.hypot(cx, cy);
  return miss <= (shot.radius ?? 12) + (body.radius ?? 20) + 12 ? { t, dirX: shot.vx, dirY: shot.vy, kind: "SHOT" } : null;
}

/** Scan hostile projectiles and soon-detonating zones for an immediate threat. */
export function detectIncomingThreat({ body, hostileOwner, hostileTeam, projectiles, zones, threatSeen, horizon = 0.45 }) {
  for (const shot of projectiles) {
    if (shot.dead || shot.owner !== hostileOwner || threatSeen?.has(shot.id)) continue;
    const hit = threatOfShot(shot, body, horizon);
    if (hit) {
      threatSeen?.add(shot.id);
      return hit;
    }
  }
  for (const zone of zones) {
    if (zone.team !== hostileTeam || threatSeen?.has(zone.id)) continue;
    if (distance(zone.x, zone.y, body.x, body.y) < zone.radius + (body.radius ?? 20) && zone.delay - zone.t < 0.6) {
      threatSeen?.add(zone.id);
      const dx = body.x - zone.x + 0.01;
      const dy = body.y - zone.y;
      return { t: Math.max(0.05, zone.delay - zone.t), dirX: -dy, dirY: dx, kind: "ZONE" };
    }
  }
  return null;
}

/**
 * Shared tactical goal planner used by BOTH rivals and AI-assisted player fighters.
 * Chooses between arena objective zones, cover-seeking when low on energy/cooldowns,
 * and optimal combat spacing with clear line-of-sight.
 */
export function chooseUnifiedGoal({
  body,
  foe,
  arenaGoal = null,
  kitReady = true,
  ultReady = false,
  ultMove = null,
  foeUltThreat = false,
  preferredRange = 280,
  worldWidth,
  worldHeight,
  zones = [],
  hostileTeam = "player",
  blocked,
  burningAt,
  hasSight,
  random
}) {
  if (arenaGoal) return { goal: arenaGoal, wantsCover: false };
  const wantsCover = !ultReady && ((body.energy ?? 100) < 28 || !kitReady || (foeUltThreat && body.hp < body.maxHp * 0.5));
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * TAU + random() * 0.2;
    const range = ultReady && ultMove?.type === "NOVA" ? ultMove.radius * 0.6 : preferredRange;
    const radius = wantsCover ? range * (0.9 + random() * 0.5) : range * (0.8 + random() * 0.4);
    const x = foe.x + Math.cos(angle) * radius;
    const y = foe.y + Math.sin(angle) * radius;
    if (x < 40 || y < 40 || x > worldWidth - 40 || y > worldHeight - 40) continue;
    if (blocked(x, y) || burningAt(x, y)) continue;
    const sight = hasSight(x, y, foe.x, foe.y);
    let score = -distance(x, y, body.x, body.y) / 260;
    score += wantsCover ? (sight ? -3 : 3) : (sight ? 2.5 : -2);
    for (const zone of zones) {
      if (zone.team === hostileTeam && distance(x, y, zone.x, zone.y) < zone.radius + 40) score -= 4;
    }
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return { goal: best ?? { x: body.x, y: body.y }, wantsCover };
}

/**
 * Shared move picker used by BOTH rivals and AUTO-mode player fighters.
 * Factors in range, elemental matchup multiplier, target motion, and basic attack fallback.
 */
export function pickUnifiedMove({
  body,
  foe,
  dist,
  relayMode = false,
  canCast,
  moveFor,
  kitMoveIds,
  basicId = null,
  ultimateId = null,
  ultimateReady = false,
  taxonomyMult = null,
  random
}) {
  if (ultimateReady && ultimateId) {
    const ult = moveFor(ultimateId, true);
    if (ult) {
      const ok = (ult.type === "NOVA" && dist < ult.radius * 0.85)
        || (ult.type === "LANCE" && dist < ult.range * 0.8)
        || ((ult.type === "BOLT" || ult.type === "WAVE" || ult.type === "SPREAD" || ult.type === "ZONE") && dist < (ult.range ?? 460) * 0.85);
      if (ok) return { id: ultimateId, ultimate: true };
    }
  }
  const options = [];
  for (const id of kitMoveIds) {
    if (!canCast(body, id)) continue;
    const move = moveFor(id);
    if (!move || move.type === "BARRIER" || move.type === "BLINK") continue;
    const range = computeMoveReach(move);
    if (dist > range) continue;
    let weight = move.type === "ZONE"
      ? (Math.hypot(foe.vx ?? 0, foe.vy ?? 0) < 120 ? 3 : 1.2)
      : move.type === "LUNGE"
        ? (dist < (move.distance ?? 240) ? 1.5 : 0)
        : 2;
    if (weight > 0 && typeof taxonomyMult === "function") {
      const m = taxonomyMult(id);
      if (m > 1.05) weight *= 1.65;
      else if (m < 0.95) weight *= 0.65;
    }
    if (weight > 0) options.push({ id, weight, ultimate: false });
  }
  if (relayMode && basicId && canCast(body, basicId)) {
    const basic = moveFor(basicId);
    const reach = computeMoveReach(basic);
    if (dist <= reach) {
      let w = options.length ? 2.4 : 1.2;
      if (typeof taxonomyMult === "function") {
        const m = taxonomyMult(basicId);
        if (m > 1.05) w *= 1.3;
      }
      options.push({ id: basicId, weight: w, ultimate: false });
    }
  }
  if (!options.length) return null;
  let roll = random() * options.reduce((sum, o) => sum + o.weight, 0);
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option;
  }
  return options[options.length - 1];
}

/**
 * Evaluate live elemental matchup & range status for each move slot against the active foe.
 * Drives the tactical HUD badges (`效果絕佳`, `效果不好`, `超出射程`, Ready+In-Range glow).
 */
export function evaluateMoveMatchups({
  body,
  foe,
  relayMode = false,
  moveIds = [],
  basicId = null,
  ultimateId = null,
  moveFor,
  canCast,
  attackElementOf,
  taxonomyMultiplier,
  hasSight
}) {
  const foeAlive = Boolean(foe && foe.active && foe.hp > 0);
  const dist = foeAlive ? distance(body.x, body.y, foe.x, foe.y) : Infinity;
  const sight = foeAlive ? hasSight(body.x, body.y, foe.x, foe.y) : false;
  const describe = (id, ultimate = false) => {
    const move = moveFor(id, ultimate);
    if (!move) return null;
    const reach = computeMoveReach(move);
    const selfCast = move.type === "BARRIER" || move.type === "BLINK";
    const inRange = selfCast ? true : (foeAlive && dist <= reach);
    const atkEl = relayMode && foeAlive ? attackElementOf(body, id) : null;
    const mult = !selfCast && atkEl && foeAlive ? taxonomyMultiplier(atkEl, foe) : 1;
    const effectiveness = mult > 1.05 ? "SUPER" : mult < 0.95 ? "RESIST" : "NEUTRAL";
    const ready = ultimate
      ? Boolean(canCast(body, id) && (!relayMode || body.energy >= (move.energy ?? 0)))
      : Boolean(canCast(body, id));
    return { id, mult, effectiveness, inRange, ready, sight: selfCast || sight, reach: Math.round(reach) };
  };
  return {
    dist: Number.isFinite(dist) ? Math.round(dist) : null,
    sight,
    basic: basicId ? describe(basicId, false) : null,
    moves: moveIds.map((id) => describe(id, false)),
    ultimate: ultimateId ? describe(ultimateId, true) : null
  };
}

/**
 * Shared AI tactical art decision: used identically by AUTO player and rival fighters.
 */
export function shouldUseTacticalArt({
  body,
  foe,
  dist,
  art,
  ready = false,
  buffsUsed = 0,
  healsUsed = 0,
  decoyUsed = false,
  hasDecoy = false,
  weatherKind = null,
  desiredWeather = null,
  enemyHazards = 0,
  incomingThreat = false,
  foeCasting = false
}) {
  if (!art || !ready || !body || !foe || foe.hp <= 0) return false;
  switch (art.kind) {
    case "BUFF":
      return buffsUsed < 2 && dist > 160 && !incomingThreat && body.hp > body.maxHp * 0.35;
    case "HEAL":
      return healsUsed < 2 && body.hp < body.maxHp * 0.56;
    case "COUNTER":
      return incomingThreat || (foeCasting && dist < 340);
    case "FLURRY":
      return dist <= 260;
    case "BACKSTAB":
      return dist >= 110 && dist <= (art.reach ?? 340);
    case "HAZARD":
      return enemyHazards < 2 && dist > 170 && !incomingThreat;
    case "DECOY":
      return !decoyUsed && !hasDecoy && body.hp > body.maxHp * 0.42 && dist > 140;
    case "WEATHER":
      return Boolean(desiredWeather && weatherKind !== desiredWeather && dist > 150 && !incomingThreat);
    default:
      return false;
  }
}

