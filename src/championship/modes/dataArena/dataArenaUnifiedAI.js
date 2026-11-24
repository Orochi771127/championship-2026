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

/**
 * 3-tier competitive real-time arena AI difficulty profiles (PbRank rhythm):
 * controls decision cadence, attack pacing, lead-aim precision, dodge reflex,
 * lateral strafing, and move-selection variance.
 */
export const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    decision: 0.46, decisionJitter: 0.20,
    attackDelay: 2.15, attackJitter: 0.55,
    aimError: 110, lead: 0.12,
    dodgeChance: 0.12, dangerRadius: 110,
    movement: 0.73, strafe: 0.20, choiceNoise: 0.80
  }),
  normal: Object.freeze({
    decision: 0.28, decisionJitter: 0.13,
    attackDelay: 1.50, attackJitter: 0.40,
    aimError: 58, lead: 0.35,
    dodgeChance: 0.32, dangerRadius: 150,
    movement: 0.90, strafe: 0.34, choiceNoise: 0.40
  }),
  hard: Object.freeze({
    decision: 0.16, decisionJitter: 0.08,
    attackDelay: 1.04, attackJitter: 0.25,
    aimError: 22, lead: 0.68,
    dodgeChance: 0.62, dangerRadius: 190,
    movement: 1.00, strafe: 0.46, choiceNoise: 0.22
  })
});

export const AI_DIFFICULTY_IDS = Object.freeze(["easy", "normal", "hard"]);

export function normalizeAiDifficulty(level) {
  return Object.prototype.hasOwnProperty.call(AI_DIFFICULTIES, level) ? level : "normal";
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

/** Scan hostile projectiles, soon-detonating zones, and imminent AoE/beam windup telegraphs for an immediate threat. */
export function detectIncomingThreat({ body, hostileOwner, hostileTeam, projectiles, zones, telegraphs = [], threatSeen, horizon = 0.45 }) {
  for (const shot of projectiles) {
    if (shot.dead || shot.isWallShard || shot.owner !== hostileOwner || threatSeen?.has(shot.id)) continue;
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
  for (const tg of telegraphs) {
    if (!tg || tg.team !== hostileTeam) continue;
    const key = `tg:${tg.owner ?? ""}:${tg.moveId ?? ""}`;
    if (threatSeen?.has(key)) continue;
    const rem = Math.max(0.05, (tg.duration ?? 0.3) - (tg.t ?? 0));
    if (rem > horizon + 0.15) continue;
    if (tg.kind === "CIRCLE" && distance(tg.x, tg.y, body.x, body.y) < (tg.radius ?? 100) + (body.radius ?? 20)) {
      threatSeen?.add(key);
      const dx = body.x - tg.x + 0.01;
      const dy = body.y - tg.y;
      return { t: rem, dirX: -dy, dirY: dx, kind: "TELEGRAPH_CIRCLE" };
    }
    if (tg.kind === "LINE" && (tg.width ?? 24) >= 24) {
      const cosA = Math.cos(tg.angle ?? 0), sinA = Math.sin(tg.angle ?? 0);
      const rx = body.x - tg.x, ry = body.y - tg.y;
      const along = rx * cosA + ry * sinA;
      const perp = Math.abs(-rx * sinA + ry * cosA);
      if (along > -10 && along < (tg.length ?? 400) + 20 && perp < (tg.width ?? 24) * 0.65 + (body.radius ?? 20)) {
        threatSeen?.add(key);
        return { t: rem, dirX: cosA, dirY: sinA, kind: "TELEGRAPH_LINE" };
      }
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
 * PbRank projectile-intercept dodge detector:
 * Computes closest approach time `r = (s · v) / |v|²`. When `0 < r < 0.6s` and
 * predicted miss distance `< body.radius + shot.radius + 18`, flags an immediate
 * perpendicular dodge vector.
 */
export function pbRankInterceptDodge({ body, hostileOwner, projectiles, dangerRadius = 150, threatSeen = null }) {
  for (const shot of projectiles) {
    if (shot.dead || shot.isWallShard || shot.owner !== hostileOwner || threatSeen?.has(shot.id)) continue;
    if (distance(shot.x, shot.y, body.x, body.y) > dangerRadius) continue;
    const sx = body.x - shot.x;
    const sy = body.y - shot.y;
    const v2 = shot.vx * shot.vx + shot.vy * shot.vy;
    if (v2 < 1) continue;
    const r = (sx * shot.vx + sy * shot.vy) / v2;
    if (r > 0 && r < 0.6 && Math.hypot(sx - shot.vx * r, sy - shot.vy * r) < (body.radius ?? 20) + (shot.radius ?? 12) + 18) {
      threatSeen?.add(shot.id);
      return { t: r, dirX: shot.vx, dirY: shot.vy, kind: "SHOT" };
    }
  }
  return null;
}

/**
 * PbRank obstacle corner-waypoint navigator:
 * When line-of-sight to `target` is blocked by cover props, evaluates all four
 * corners padded by `pad` px around intact cover props and picks the reachable
 * waypoint minimizing `dist(body, c) + dist(c, target) + sightPenalty`.
 */
export function pbRankCornerWaypoint({ body, target, props = [], cell = 48, pad = 45, blocked, hasSight }) {
  if (!body || !target || hasSight(body.x, body.y, target.x, target.y)) return null;
  let best = null;
  let bestCost = Infinity;
  for (const prop of props) {
    if (prop.destroyed) continue;
    const x0 = prop.col * cell;
    const y0 = prop.row * cell;
    const x1 = (prop.col + (prop.width ?? 1)) * cell;
    const y1 = (prop.row + (prop.height ?? 1)) * cell;
    const corners = [
      { x: x0 - pad, y: y0 - pad },
      { x: x1 + pad, y: y0 - pad },
      { x: x0 - pad, y: y1 + pad },
      { x: x1 + pad, y: y1 + pad }
    ];
    for (const c of corners) {
      if (blocked(c.x, c.y)) continue;
      if (!hasSight(body.x, body.y, c.x, c.y)) continue;
      const sightPenalty = hasSight(c.x, c.y, target.x, target.y) ? 0 : 250;
      const cost = distance(body.x, body.y, c.x, c.y) + distance(c.x, c.y, target.x, target.y) + sightPenalty;
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    }
  }
  return best;
}

/**
 * PbRank spacing & lateral-strafe movement vector:
 * Keeps melee fighters close (~95 px), pulse fighters mid (~160 px), and ranged
 * fighters at comfortable firing spacing (~320-360 px) with organic lateral strafe.
 */
export function pbRankSpacingVector({ body, target, idealDist = 280, strafeDir = 1, strafeWeight = 0.34, hasObjective = false }) {
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  let mx = hasObjective || dist > idealDist ? ux : dist < 0.65 * idealDist ? -ux : 0;
  let my = hasObjective || dist > idealDist ? uy : dist < 0.65 * idealDist ? -uy : 0;
  if (!hasObjective) {
    mx += -uy * strafeDir * strafeWeight;
    my += ux * strafeDir * strafeWeight;
  }
  const len = Math.hypot(mx, my) || 1;
  return { x: mx / len, y: my / len, dist };
}

/**
 * Shared move picker used by BOTH rivals and AUTO-mode player fighters.
 * Uses PbRank contextual scoring (base power × dual-ring matchup × STAB × range
 * affinity + heal/protect/buff/status triggers + choiceNoise perturbation).
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
  isStab = null,
  moveArchetype = null,
  incomingThreat = false,
  choiceNoise = 0.35,
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
  let best = null;
  const foeHasStatus = Boolean(foe && ((foe.burn ?? 0) > 0 || (foe.poison ?? 0) > 0 || (foe.paralyze ?? 0) > 0 || (foe.root ?? 0) > 0 || (foe.sleep ?? 0) > 0));
  const scoreMove = (id, isBasicSlot = false) => {
    if (!canCast(body, id)) return null;
    const move = moveFor(id);
    if (!move) return null;
    const arch = typeof moveArchetype === "function" ? moveArchetype(id, move) : null;
    const reach = computeMoveReach(move);
    const isSelfMove = move.type === "BARRIER" || arch === "SELF_BUFF" || arch === "RECOVERY_SUPPORT" || arch === "PROTECT_COUNTER";
    if (!isSelfMove && move.type !== "BLINK" && dist > reach + 12) return null;
    let score = Math.max(12, move.damage ?? 22) * (move.count ? Math.min(2.2, 0.55 * move.count) : 1);
    if (typeof taxonomyMult === "function" && !isSelfMove) {
      score *= taxonomyMult(id);
    }
    if (typeof isStab === "function" && !isSelfMove && isStab(id)) {
      score *= 1.35;
    }
    if (move.type === "LUNGE" && dist > 180) score *= 0.55;
    if (move.type === "NOVA" && dist > (move.radius ?? 140) + 20) score *= 0.5;
    if (move.type === "ZONE" && Math.hypot(foe?.vx ?? 0, foe?.vy ?? 0) < 120) score *= 1.3;
    // Wave 2: Punish actively guarding/shielded foes with Guard-Break archetypes!
    if ((foe?.guardTimer > 0 || foe?.barrier > 0) && ["GUARD_BREAK_SLAM", "LEAP_SLAM", "GRAB_SLAM", "TELEKINESIS_SLAM"].includes(arch)) {
      score *= 2.2;
    }
    if (arch === "RECOVERY_SUPPORT") {
      score = (body.hp < body.maxHp * 0.5 && (body.healsUsed ?? 0) < 2) ? 170 : 0;
    } else if (move.type === "BARRIER" || arch === "PROTECT_COUNTER") {
      score = incomingThreat ? 200 : (dist < 260 && foe?.cast ? 95 : 0);
    } else if (arch === "SELF_BUFF") {
      score = ((body.atkStage ?? 0) < 2 && (body.buffsUsed ?? 0) < 2 && !incomingThreat) ? 48 : 0;
    } else if (move.type === "BLINK") {
      score = dist > 130 && dist <= reach + 80 ? 38 : 0;
    } else if (move.onHit && !foeHasStatus) {
      score += 14;
    }
    if (isBasicSlot) score *= 0.72; // Prefer real skills when off cooldown, fall back cleanly to basic
    if (score <= 0) return null;
    score *= 1 - 0.5 * choiceNoise + random() * choiceNoise;
    return { id, score, ultimate: false, move, arch };
  };
  for (const id of kitMoveIds) {
    const cand = scoreMove(id, false);
    if (cand && (!best || cand.score > best.score)) best = cand;
  }
  if (relayMode && basicId) {
    const cand = scoreMove(basicId, true);
    if (cand && (!best || cand.score > best.score)) best = cand;
  }
  return best;
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

/**
 * Wave 2 Smart 3v3 Partner Switch Evaluator (shared by Opponent AI & Player AUTO mode):
 * Evaluates active HP, elemental disadvantage, crippling ailments (for 6s bench cleanse),
 * and ranks healthy reserve partners by counter-element matchup + HP ratio.
 * Returns the best reserve slot index (>= 0) or -1 to stay in.
 */
export function evaluateSmartSwitch({
  active,
  bench = [],
  activeIdx = 0,
  incomingMultOf = () => 1,
  outgoingMultOf = () => 1,
  difficulty = "normal",
  switchCooldown = 0,
  roundTime = 0
} = {}) {
  if (!active || active.hp <= 0 || switchCooldown > 0) return -1;
  if (active.cast || active.lunge || (active.hitstun ?? 0) > 0) return -1;
  const diff = normalizeAiDifficulty(difficulty);
  if (diff === "easy") return -1;
  const minRoundTime = diff === "hard" ? 6 : 10;
  if (roundTime < minRoundTime) return -1;

  const activeHpRatio = active.hp / Math.max(1, active.maxHp ?? 200);
  const activeIncoming = incomingMultOf(active, activeIdx);
  const activeOutgoing = outgoingMultOf(active, activeIdx);
  const severelyAiled = Boolean((active.burn ?? 0) > 1.2 || (active.poison ?? 0) > 1.5 || (active.paralyze ?? 0) > 1.5);

  const lowHpTrigger = activeHpRatio < (diff === "hard" ? 0.38 : 0.34);
  const badMatchupTrigger = activeIncoming > 1.15 && activeHpRatio < (diff === "hard" ? 0.72 : 0.62);
  const cleanseTrigger = diff === "hard" && severelyAiled && activeHpRatio < 0.56;
  if (!lowHpTrigger && !badMatchupTrigger && !cleanseTrigger) return -1;

  const currentScore = activeOutgoing * 1.35 - activeIncoming * 1.25 + activeHpRatio * 1.15 - (severelyAiled ? 0.35 : 0);
  let bestIdx = -1;
  let bestScore = currentScore + (lowHpTrigger ? 0.15 : 0.45);
  const minBenchHp = lowHpTrigger ? 0.50 : 0.58;

  for (let i = 0; i < bench.length; i++) {
    if (i === activeIdx) continue;
    const cand = bench[i];
    if (!cand || cand.hp <= 0) continue;
    const hpRatio = cand.hp / Math.max(1, cand.maxHp ?? 200);
    if (hpRatio < minBenchHp) continue;
    const inc = incomingMultOf(cand, i);
    const out = outgoingMultOf(cand, i);
    const candAiled = Boolean((cand.burn ?? 0) > 0 || (cand.poison ?? 0) > 0 || (cand.paralyze ?? 0) > 0);
    const score = out * 1.35 - inc * 1.25 + hpRatio * 1.15 - (candAiled ? 0.35 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}


