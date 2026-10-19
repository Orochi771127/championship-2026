// Shared cave passages — OWNER_APPROVED_ADAPTATION (Owner 2026-10-19), used only
// when a hunt environment carries `caveGroups` (the rebuilt review maps).
//
// The native escape (AI8 -> escapeBoundary -> escapeAnchor) already moves the
// same individual from one cave end to another. Here that move becomes a
// passage: the creature walks into the dark corridor and fades, stays hidden
// (untargetable, rope released), then walks out of another valid cave of the
// same group with its identity, HP and every native field unchanged. One cave
// mouth lets one creature out at a time, so no creature shows at two mouths and
// two never emerge into each other. RNG draws are exactly the native ones.
import { nativeHuntEscapePosition } from "./nativeWildSpatial.js";

const Q12 = 4096;
export const CAVE_PASSAGE_ADAPTATION = "OWNER_APPROVED_HUNT_CAVE_PASSAGE_20261019";
export const CAVE_PASSAGE_TICKS = Object.freeze({ enter: 16, hidden: 90, exit: 36 });
const occupancy = new WeakMap();   // environment -> Map(caveId -> wildId) for cave mouths in use

const tileOf = positionQ12 => positionQ12.slice(0, 2).map(n => Math.trunc((n >> 12) / 8));
function caveAt(environment, tx, ty) {
  for (const group of environment.caveGroups) for (const cave of group.caves)
    if (cave.anchorTiles.some(([x, y]) => x === tx && y === ty)) return { group, cave };
  return null;
}
function exitClear(environment, cave) {
  const [ax, ay] = cave.anchorTiles[0], [, my] = cave.mouthTile;
  for (let y = ay; y <= my; y++) for (const [x] of cave.anchorTiles) if (environment.isBlocked(x, y)) return false;
  return true;
}
const points = cave => {
  const cx = (cave.anchorTiles[0][0] + cave.anchorTiles[1][0] + 1) * 4;
  return { inside: [cx, cave.anchorTiles[0][1] * 8 + 4], mouth: [cx, cave.mouthTile[1] * 8 + 5] };
};
const mouths = environment => { if (!occupancy.has(environment)) occupancy.set(environment, new Map()); return occupancy.get(environment); };

/** AI8 step: null when not on an escape cell; otherwise a native relocation or a started passage. */
export function beginNativeHuntEscape(actor, environment, nextChannel) {
  const draws = [];
  const native = nativeHuntEscapePosition(actor.positionQ12, environment, n => { const v = nextChannel(n); draws.push(v); return v; });
  if (!native) return null;
  const [px, py] = tileOf(actor.positionQ12);
  const from = caveAt(environment, px, py);
  const [tx, ty] = tileOf(native);
  const nativeTarget = caveAt(environment, tx, ty);
  const group = from?.group ?? nativeTarget?.group;
  if (!group) return { kind: "NATIVE", positionQ12: native };
  const free = cave => exitClear(environment, cave) && !mouths(environment).has(cave.id);
  let candidates = group.caves.filter(c => c !== from?.cave && free(c));
  if (!from && nativeTarget && free(nativeTarget.cave)) candidates = [nativeTarget.cave];
  const pick = (draws[0] ?? 0) + (draws[1] ?? 0);
  const to = candidates.length ? candidates[pick % candidates.length] : (from && exitClear(environment, from.cave) ? from.cave : null);
  if (!to) return { kind: "NATIVE", positionQ12: native };
  actor.passage = { adaptation: CAVE_PASSAGE_ADAPTATION, phase: "ENTER", tick: 0, groupId: group.id,
    from: from?.cave.id ?? null, to: to.id, start: [...actor.positionQ12] };
  actor.passageAlpha = 1;
  return { kind: "PASSAGE", to: to.id };
}

/** One tick of an active passage. Returns true when it ends (the caller returns the actor to AI1). */
export function stepNativeHuntPassage(actor, environment) {
  const p = actor.passage;
  if (!p) return false;
  const cave = environment.caveGroups.flatMap(g => g.caves).find(c => c.id === p.to);
  const T = CAVE_PASSAGE_TICKS;
  p.tick++;
  if (p.phase === "ENTER") {
    // walk a few pixels deeper into the corridor (or off the edge) while fading out
    const f = Math.min(1, p.tick / T.enter);
    actor.positionQ12 = [p.start[0], p.start[1] - Math.round(6 * f) * Q12, p.start[2] ?? 0];
    actor.passageAlpha = 1 - f;
    if (p.tick >= T.enter) { p.phase = "HIDDEN"; p.tick = 0; actor.hidden = true; actor.passageAlpha = 0;
      const { inside } = points(cave); actor.positionQ12 = [inside[0] * Q12, inside[1] * Q12, 0]; }
    return false;
  }
  if (p.phase === "HIDDEN") {
    if (p.tick < T.hidden) return false;
    const taken = mouths(environment);
    if (taken.has(cave.id) && taken.get(cave.id) !== actor.wildId) return false;   // another creature is coming out: wait
    taken.set(cave.id, actor.wildId);
    p.phase = "EXIT"; p.tick = 0; actor.hidden = false; actor.passageAlpha = 0;
    return false;
  }
  // EXIT: out of the dark corridor to just past the mouth while fading in
  const { inside, mouth } = points(cave), f = Math.min(1, p.tick / T.exit);
  actor.positionQ12 = [Math.round(inside[0] + (mouth[0] - inside[0]) * f) * Q12, Math.round(inside[1] + (mouth[1] - inside[1]) * f) * Q12, 0];
  actor.passageAlpha = Math.min(1, f * 1.6);
  if (p.tick < T.exit) return false;
  endNativeHuntPassage(actor, environment);
  return true;
}

/** Release a passage early (captured, removed, field reset) without leaving a mouth reserved. */
export function endNativeHuntPassage(actor, environment) {
  const p = actor.passage;
  if (!p) return;
  const taken = environment && occupancy.get(environment);
  if (taken?.get(p.to) === actor.wildId) taken.delete(p.to);
  actor.passage = null; actor.passageAlpha = 1;
  if (p.phase !== "EXIT") actor.hidden = false;
}

export function validateCaveGroups(groups, width, height) {
  if (groups == null) return null;
  if (!Array.isArray(groups) || !groups.length) throw Error("HUNT_CAVE_GROUPS_INVALID");
  const ids = new Set();
  return Object.freeze(groups.map(group => {
    if (typeof group?.id !== "string" || !Array.isArray(group.caves) || group.caves.length < 1) throw Error("HUNT_CAVE_GROUPS_INVALID");
    return Object.freeze({ id: group.id, caves: Object.freeze(group.caves.map(cave => {
      const ok = typeof cave?.id === "string" && !ids.has(cave.id) && Array.isArray(cave.anchorTiles) && cave.anchorTiles.length === 2
        && cave.anchorTiles.every(t => Number.isInteger(t?.[0]) && Number.isInteger(t?.[1]) && t[0] > 0 && t[1] >= 0 && t[0] < width - 1 && t[1] < height)
        && cave.anchorTiles[1][0] === cave.anchorTiles[0][0] + 1 && cave.anchorTiles[1][1] === cave.anchorTiles[0][1]
        && Number.isInteger(cave.mouthTile?.[1]) && cave.mouthTile[1] > cave.anchorTiles[0][1] && cave.mouthTile[1] < height;
      if (!ok) throw Error("HUNT_CAVE_GROUPS_INVALID");
      ids.add(cave.id);
      return Object.freeze({ id: cave.id, anchorTiles: Object.freeze(cave.anchorTiles.map(t => Object.freeze([...t]))),
        mouthTile: Object.freeze([cave.anchorTiles[0][0], cave.mouthTile[1]]) });
    })) });
  }));
}
