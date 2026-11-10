// Hunt spawn spread -- OWNER_APPROVED_ADAPTATION 2026-11-10 (HUNT_SPAWN_SPREAD_20261110).
//
// NOT original behaviour. The native entry (nativeHuntSpawn.js, groupNativeHuntActors) places every wild
// partner at an independent random point, pushes a blocked point to the first open tile scanning right
// first, then moves a same-species partner within 31 px of another 30 % of the time per pair. Measured on
// 戴納草原, 37.5 % of partners entered within 32 native px of another (an even spread gives 5-7 %). The
// Owner chose: keep same-species partners as loose small groups and keep about a third of a screen between
// groups. Where they stand is still random -- finding them by dragging the field is the hunt
// (「本來就是讓玩家去找怪」), so nothing is placed in the opening view on purpose.
//
// This runs AFTER the native generation and changes positions only. It never reads or advances the native
// RNG, so the native entry, its RNG channels and every native actor field stay exactly as generated. Its
// own stream is seeded from the partners' native individual values, so a retried entry spreads the same.

export const HUNT_SPAWN_SPREAD = Object.freeze({
  minGap: 96,            // native px between groups, about a third of the 256 px wide view
  groupNear: 48, groupFar: 80, memberGap: 36,  // a loose group: members this far from its leader / each other
  maxGroup: 3,
  bottomMarginTiles: 10, // the band the dock covers (HUNT_FIELD_WATCHDOG.bottomRoamMarginTiles)
  edgeTiles: 2, candidates: 48
});
const TILE = 8, Q12 = 4096;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(actors) {
  let h = 0x811c9dc5;
  const mix = (n) => { h = Math.imul(h ^ ((Number.isFinite(n) ? n : 0) >>> 0), 0x01000193); h ^= h >>> 13; };
  actors.forEach((actor, i) => {
    mix(i); mix(actor.speciesIndex);
    const f = actor.individual?.fields ?? {};
    for (const key of ['058', '060', '064', '068', '06c', '018']) mix(f[key]);
  });
  return h >>> 0;
}

/**
 * `actors`: the native encounter actors ({speciesIndex, positionQ12, ...}); `env`: the native terrain
 * ({width, height, isBlocked(tileX, tileY)}). Returns the actors with new positionQ12 only, or the actors
 * unchanged when the field has no room.
 */
export function spreadHuntActors(actors, env) {
  if (!Array.isArray(actors) || !actors.length || typeof env?.isBlocked !== 'function'
    || !Number.isInteger(env.width) || !Number.isInteger(env.height)) return actors;
  const S = HUNT_SPAWN_SPREAD, random = mulberry32(seedOf(actors));
  const open = (tx, ty) => tx >= S.edgeTiles && ty >= S.edgeTiles && tx < env.width - S.edgeTiles
    && ty < env.height - Math.max(S.edgeTiles, S.bottomMarginTiles) && env.isBlocked(tx, ty) === false;
  // A standing tile has open ground on all four sides, so nobody starts pressed against a cliff or tree.
  const standable = (tx, ty) => open(tx, ty) && open(tx + 1, ty) && open(tx - 1, ty) && open(tx, ty + 1) && open(tx, ty - 1);
  const atPixel = (x, y) => standable(Math.floor(x / TILE), Math.floor(y / TILE));
  const cells = [];
  for (let ty = 0; ty < env.height; ty++) for (let tx = 0; tx < env.width; tx++) if (standable(tx, ty)) cells.push([tx, ty]);
  if (!cells.length) return actors;
  const pointIn = ([tx, ty]) => [tx * TILE + 2 + random() * (TILE - 4), ty * TILE + 2 + random() * (TILE - 4)];

  // Loose groups by species, in order of first appearance: 1, 2 or 3 partners each.
  const bySpecies = new Map();
  actors.forEach((actor, i) => { if (!bySpecies.has(actor.speciesIndex)) bySpecies.set(actor.speciesIndex, []); bySpecies.get(actor.speciesIndex).push(i); });
  const groups = [];
  for (const members of bySpecies.values()) {
    for (let k = 0; k < members.length;) {
      const roll = random(), size = Math.min(members.length - k, roll < 0.35 ? 1 : roll < 0.75 ? 2 : S.maxGroup);
      groups.push(members.slice(k, k + size)); k += size;
    }
  }
  groups.sort((a, b) => a[0] - b[0]);

  const placed = [], position = new Array(actors.length);
  const nearest = (p, skip = -1) => placed.reduce((d, q) => q.group === skip ? d : Math.min(d, Math.hypot(p[0] - q.p[0], p[1] - q.p[1])), Infinity);
  function placeLeader(pool) {
    let best = null, bestGap = -1;
    for (let c = 0; c < S.candidates && pool.length; c++) {
      const p = pointIn(pool[Math.floor(random() * pool.length)]), gap = nearest(p);
      if (gap >= S.minGap) return p;
      if (gap > bestGap) { best = p; bestGap = gap; }
    }
    return best;
  }
  groups.forEach((group, g) => {
    const leader = placeLeader(cells);
    if (!leader) return;
    position[group[0]] = leader; placed.push({ p: leader, group: g });
    for (const member of group.slice(1)) {
      let spot = null;
      const turn = random() * Math.PI * 2;
      for (let a = 0; a < 16 && !spot; a++) {
        const angle = turn + a * Math.PI * 2 / 16, r = S.groupNear + random() * (S.groupFar - S.groupNear);
        const p = [leader[0] + Math.cos(angle) * r, leader[1] + Math.sin(angle) * r];
        const own = placed.filter((q) => q.group === g).every((q) => Math.hypot(p[0] - q.p[0], p[1] - q.p[1]) >= S.memberGap);
        if (atPixel(...p) && own && nearest(p, g) >= S.minGap * 0.75) spot = p;
      }
      spot ??= placeLeader(cells);
      if (spot) { position[member] = spot; placed.push({ p: spot, group: g }); }
    }
  });
  return actors.map((actor, i) => position[i]
    ? { ...actor, positionQ12: [Math.round(position[i][0] * Q12), Math.round(position[i][1] * Q12), 0] } : actor);
}
