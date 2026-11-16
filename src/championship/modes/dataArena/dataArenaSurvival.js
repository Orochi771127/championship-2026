// Data Arena SURVIVAL rules (P4 prototype, Owner 2026-11-16: 大逃殺 × 倖存者 with our partners).
//
// OWNER_APPROVED_ADAPTATION (delegated, 「自己分批製作我都不介入」). Pure: numbers in, frozen data out;
// the simulation (dataArenaSimulation.js) owns bodies, damage and events and asks these rules
// what the circle and the field look like at a given time.
//
// One match: the player and 11 rival tamers on the harbor map. A data storm closes from the edge in
// six steps; outside the safe circle a fighter loses a share of its HP every second. Rival tamers
// near the player fight it with the arena's own rival AI (ENCOUNTER); the rest are knocked out
// beyond the player's sight on a fixed, seeded schedule (OFFSCREEN), so the count falls as the storm
// closes. The last one standing wins; anyone else places by how many were still in when they fell.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const DATA_ARENA_SURVIVAL = deepFreeze({
  tamers: 11,
  encounters: 6,
  // Storm steps: when the circle starts closing (s), how long it takes (s), the target radius as a
  // share of the opening radius, and the HP share per second it drains outside.
  storm: [
    { at: 40, over: 18, share: 0.62, drain: 0.04 },
    { at: 100, over: 16, share: 0.42, drain: 0.05 },
    { at: 160, over: 14, share: 0.26, drain: 0.07 },
    { at: 215, over: 12, share: 0.13, drain: 0.1 },
    { at: 265, over: 12, share: 0.05, drain: 0.14 },
    { at: 300, over: 20, share: 0, drain: 0.2 }
  ],
  // When an encounter tamer is due (s), if no other rival is still fighting.
  encounterAt: [60, 105, 150, 195, 240, 280],
  // Off-screen knockouts spread across this window (s), weighted to the front: the early scramble
  // thins the field fastest, so the count moves from the first minute on.
  offscreenFrom: 20,
  offscreenTo: 280,
  // An encounter starts this far from the player (px), inside the safe circle.
  encounterRange: [520, 720],
  // Arena rivals are built for one-on-one duels; a survival tamer is lighter.
  rivalHpScale: 0.25,
  rivalDamageScale: 0.4,
  // XP crystals a knocked-out tamer leaves behind.
  rivalXp: 6
});

/** The storm's opening circle: a seeded centre in the middle half, wide enough to cover the whole map. */
export function createSurvivalStorm({ random, worldWidth, worldHeight }) {
  const cx = worldWidth * (0.3 + random() * 0.4), cy = worldHeight * (0.3 + random() * 0.4);
  const radius0 = Math.max(...[[0, 0], [worldWidth, 0], [0, worldHeight], [worldWidth, worldHeight]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return deepFreeze({ cx, cy, radius0 });
}

const smooth = (t) => t * t * (3 - 2 * t);

/** The safe circle at time `t`: radius, step index (0 before the first close), whether it is closing, drain and next close. */
export function survivalCircleAt(storm, t) {
  const steps = DATA_ARENA_SURVIVAL.storm;
  let radius = storm.radius0, stage = 0, closing = false, from = storm.radius0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], target = storm.radius0 * step.share;
    if (t < step.at) break;
    stage = i + 1;
    if (t < step.at + step.over) { closing = true; radius = from + (target - from) * smooth((t - step.at) / step.over); break; }
    radius = from = target;
  }
  const next = steps.find((step) => step.at > t) ?? null;
  return deepFreeze({ cx: storm.cx, cy: storm.cy, radius: Math.max(0, radius), stage, closing,
    drain: stage > 0 ? steps[stage - 1].drain : steps[0].drain * 0.5, nextAt: next?.at ?? null });
}

export const outsideCircle = (circle, x, y) => Math.hypot(x - circle.cx, y - circle.cy) > circle.radius;

/**
 * The seeded field: which tamers come to the player and which fall beyond its sight, and when.
 * `names` index the arena's rival definitions round-robin.
 */
export function createSurvivalField({ random, definitions }) {
  const rules = DATA_ARENA_SURVIVAL;
  const tamers = Array.from({ length: rules.tamers }, (_, index) => ({ index, definitionId: definitions[index % definitions.length], fate: "OFFSCREEN", at: 0 }));
  // Deterministic shuffle, then the first `encounters` meet the player in order.
  for (let i = tamers.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [tamers[i], tamers[j]] = [tamers[j], tamers[i]]; }
  tamers.forEach((tamer, order) => {
    if (order < rules.encounters) { tamer.fate = "ENCOUNTER"; tamer.at = rules.encounterAt[order]; }
    else tamer.at = rules.offscreenFrom + random() ** 1.6 * (rules.offscreenTo - rules.offscreenFrom);
  });
  return tamers.map((tamer) => ({ ...tamer, state: "WAITING", by: null, fellAt: null }));
}

/** Rank when the player falls (1 + those still in) or wins (1). */
export const survivalRank = ({ won, othersLeft }) => (won ? 1 : 1 + Math.max(0, othersLeft));
