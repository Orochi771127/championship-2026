// Improved battle AI, version 1 -- OWNER_APPROVED_ADAPTATION 2026-10-13.
//
// This is NOT original behaviour. The original approach states 4/5 (OVL19
// 021161F0 / 02116314, CPU-verified) only start a walk when the target is at
// least 48 px away, and only launch when it is under 32 px and not vertical.
// A combatant that stands still (notification 1, or the held pose after an
// attack or support, 8..12) inside that band neither walks nor attacks. Its
// cooldown then re-runs the ladder, which usually picks state 4 again. Two
// fighters can hold that stand-off for seconds, most visibly against an arena
// wall. See docs/reports/battle-corner-stall-2026-10-13.
//
// What this layer may do, and nothing more:
//   - read only what both sides can see: its own world point, state,
//     notification and animation, and its target's world point;
//   - issue the original walk notification (7) toward the point the original
//     handler already aims at, so the original handler still decides the
//     launch, its range and its vertical rule;
//   - when that aim point lies outside the arena bounds (the target is on a
//     wall), aim at the same offset on the target's other side;
//   - act only after the original rule has left it idle for a while, at most
//     a few times per decision, and never during hit, down or recovery
//     notifications, an unfinished attack pose, or a negative status.
// It draws no random number, reads no future RNG and no opponent decision,
// changes no stat, timer, cooldown, resource, damage or victory rule, and
// keeps the existing clock. Both teams use it alike.

export const BATTLE_AI_ADAPTATION_V1 = 'IMPROVED_V1';
export const BATTLE_AI_ORIGINAL = 'ORIGINAL';
export const BATTLE_AI_POLICIES = Object.freeze([BATTLE_AI_ORIGINAL, BATTLE_AI_ADAPTATION_V1]);

/** Battle frames the original rule may leave a combatant idle before it walks. */
export const BATTLE_AI_IDLE_FRAMES = 20;
/** Walk kicks per decision; after that the original rule is left alone. */
export const BATTLE_AI_KICKS_PER_DECISION = 3;
/** Walk notification and the codes the original holds a standing pose with. */
const WALK = 7;
const MOVING = new Set([2, 3, 7]);
const STANDING = new Set([1, 8, 9, 10, 11, 12]);
/** World bounds the original clamps x to (02112C20 tail): 32..384 px. */
const X_MIN = 32 * 4096, X_MAX = 384 * 4096, OFFSET = 65536, MARGIN = 4 * 4096;

const vertical = a => (a > 0x2000 && a < 0x6000) || (a > 0xa000 && a < 0xe000);

/** The point the original approach aims at, and the reachable one we use. */
export function battleAiApproachAim(point, targetPoint, angle) {
  const right = angle < 0x4000 || angle >= 0xc000;
  const original = targetPoint[0] + (right ? -OFFSET : OFFSET);
  const mirrored = targetPoint[0] + (right ? OFFSET : -OFFSET);
  const reachable = x => x >= X_MIN + MARGIN && x <= X_MAX - MARGIN;
  return {x: reachable(original) || !reachable(mirrored) ? original : mirrored, y: targetPoint[1], mirrored: !reachable(original) && reachable(mirrored)};
}

/**
 * Called once per battle frame for a combatant in state 4 or 5, after the
 * original handler. Returns what it did, for the history.
 */
export function stepBattleAiApproach(c, h, memo) {
  // The handler runs on its entry frame with counter 0: a new decision.
  if (c.stateCounter === 0) { memo.idleSince = null; memo.kicks = 0; }
  if (![4, 5].includes(c.state) || !h.target) { memo.idleSince = null; return null; }
  const notification = c.field17C;
  // Hit, knock-back, down and recovery notifications, a negative status, an
  // attack pose still playing, or no walk speed: the original owns the frame.
  const legal = STANDING.has(notification) && !c.statusCode && h.walkSpeed() > 0
    && (notification === 1 || h.finished());
  if (MOVING.has(notification) || !legal) {
    memo.idleSince = null;
    // While walking, keep the aim reachable when the target is on a wall.
    if (MOVING.has(notification) && h.distance < 48 * 4096) {
      const aim = battleAiApproachAim(h.point, h.targetPoint, h.angle);
      if (aim.mirrored) { c.field44 = h.angleTo(aim.x, aim.y); return 'AIM_MIRRORED'; }
    }
    return null;
  }
  memo.idleSince ??= h.frame;
  if (h.frame - memo.idleSince < BATTLE_AI_IDLE_FRAMES || memo.kicks >= BATTLE_AI_KICKS_PER_DECISION) return null;
  // Inside the original's dead band only: farther than 48 px it walks by itself,
  // and under 32 px off the vertical it launches by itself.
  const deadBand = h.distance < 48 * 4096 && (h.distance >= 32 * 4096 || vertical(h.angle));
  if (!deadBand) return null;
  const aim = battleAiApproachAim(h.point, h.targetPoint, h.angle);
  c.field44 = h.angleTo(aim.x, aim.y);
  h.notify(WALK);
  memo.idleSince = null; memo.kicks += 1;
  return aim.mirrored ? 'WALK_MIRRORED' : 'WALK';
}

// OWNER_APPROVED_ADAPTATION 2026-10-22: menus' improved AI may use its first
// skill after five ACTIVE combat seconds, rather than waiting for reserve
// tiers (900 ticks each). The owning session clock excludes READY/FIGHT,
// asset waits, hitstop and exclusive presentations. 300 ticks is the first
// tick at/after five seconds at the established 33513982/560190 Hz cadence.
export const BATTLE_AI_OPENING_SKILL_TICKS = Math.ceil(5 * 33513982 / 560190);

/** Called only at the existing legal decision gate, never from a new timer. */
export function chooseBattleAiOpeningSkill({policy, clock, launched, combatant, buckets, rng}) {
  if (policy !== BATTLE_AI_ADAPTATION_V1 || launched || clock < BATTLE_AI_OPENING_SKILL_TICKS
    || combatant.statusCode || combatant.pendingField24 > 0 || combatant.currentHp <= 0) return null;
  // A willingness-to-spend adaptation, NOT extra energy. Native initialization
  // still rechecks and charges the exact cost and owns target/range/locks/hits.
  const choices = [5, 6].flatMap(state => (buckets[state] ?? [])
    .filter(action => action.costField48 <= combatant.metricLimit)
    .map(action => ({state, action})));
  if (!choices.length) return null;
  const roll = rng.next(216);
  const {state, action} = choices[roll % choices.length];
  return {decision:'ACTION', state, action, roll, reserve:combatant.metricLimit,
    evidence:'OWNER_APPROVED_OPENING_SKILL_2026_10_22'};
}
