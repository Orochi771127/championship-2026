// Deterministic, zero-RNG obstacle steering for Hunt wild actors.
//
// Native Hunt AI picks straight-line destinations (food, decoy, or patrol offsets).
// When an obstacle (rock, pond, cliff, fence: terrain === 1) lies on that straight
// line, the native stepper hits the wall and cancels the goal. This module runs a
// fast bounded 8-way BFS (no corner cutting) + line-of-sight string-pulling to guide
// the actor cleanly around obstacles without consuming any gameplay RNG or altering
// ROM-verified movement physics.

const Q12 = 4096;
const DIRS8 = Object.freeze([
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
]);
const DEFAULT_MAX_RADIUS_TILES = 22;
const WAYPOINT_ARRIVE_PX = 4;

function isStandable(env, tx, ty) {
  if (!env || tx < 0 || ty < 0 || tx >= env.width || ty >= env.height) return false;
  const terrain = env.readTerrain(tx, ty);
  return Number.isInteger(terrain) && terrain >= 0 && terrain <= 4 && terrain !== 1;
}

/** True when every 2px sample (with a 2px corner buffer) along a->b sits on standable terrain. */
export function huntLineOfSightClear(aPx, bPx, env) {
  const dx = bPx[0] - aPx[0], dy = bPx[1] - aPx[1];
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 2));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const x = aPx[0] + dx * t, y = aPx[1] + dy * t;
    if (!isStandable(env, Math.floor(x / 8), Math.floor(y / 8))) return false;
    // Small corner buffer prevents 1px Q12 rounding from grazing a blocked corner tile.
    if (s < steps) {
      if (!isStandable(env, Math.floor((x - 2) / 8), Math.floor(y / 8))
        || !isStandable(env, Math.floor((x + 2) / 8), Math.floor(y / 8))
        || !isStandable(env, Math.floor(x / 8), Math.floor((y - 2) / 8))
        || !isStandable(env, Math.floor(x / 8), Math.floor((y + 2) / 8))) return false;
    }
  }
  return true;
}

function nearestStandableTile(env, tx, ty, maxRadius = 4) {
  if (isStandable(env, tx, ty)) return [tx, ty];
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isStandable(env, tx + dx, ty + dy)) return [tx + dx, ty + dy];
      }
    }
  }
  return null;
}

/**
 * Compute a smooth line-of-sight pulled obstacle-avoidance route in native pixels,
 * or null if straight line is already clear or no local detour exists.
 */
export function planHuntSteerRoute(fromPx, toPx, env, { maxRadiusTiles = DEFAULT_MAX_RADIUS_TILES } = {}) {
  if (!env || typeof env.readTerrain !== 'function' || !(env.width > 0) || !(env.height > 0)) return null;
  if (huntLineOfSightClear(fromPx, toPx, env)) return null;

  const sx = Math.floor(fromPx[0] / 8), sy = Math.floor(fromPx[1] / 8);
  const startTile = nearestStandableTile(env, sx, sy, 2);
  if (!startTile) return null;
  const gxRaw = Math.floor(toPx[0] / 8), gyRaw = Math.floor(toPx[1] / 8);
  const goalTile = nearestStandableTile(env, gxRaw, gyRaw, 4);
  if (!goalTile) return null;
  const [stx, sty] = startTile, [gtx, gty] = goalTile;
  if (stx === gtx && sty === gty) return [[gtx * 8 + 4, gty * 8 + 4]];

  // Bound local search box tightly around start & goal for O(1) frame budget.
  const minX = Math.max(0, Math.min(stx, gtx) - maxRadiusTiles);
  const maxX = Math.min(env.width - 1, Math.max(stx, gtx) + maxRadiusTiles);
  const minY = Math.max(0, Math.min(sty, gty) - maxRadiusTiles);
  const maxY = Math.min(env.height - 1, Math.max(sty, gty) + maxRadiusTiles);
  const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
  if (boxW * boxH > 4096) return null;

  const toIdx = (x, y) => (y - minY) * boxW + (x - minX);
  const startIdx = toIdx(stx, sty), goalIdx = toIdx(gtx, gty);
  const prev = new Int32Array(boxW * boxH).fill(-1);
  const queue = new Int32Array(boxW * boxH);
  let head = 0, tail = 1;
  queue[0] = startIdx;
  prev[startIdx] = startIdx;

  let found = false;
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goalIdx) { found = true; break; }
    const cx = (cur % boxW) + minX;
    const cy = Math.floor(cur / boxW) + minY;
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const nIdx = toIdx(nx, ny);
      if (prev[nIdx] !== -1 || !isStandable(env, nx, ny)) continue;
      // Never clip diagonally past a blocked corner.
      if (dx && dy && (!isStandable(env, cx + dx, cy) || !isStandable(env, cx, cy + dy))) continue;
      prev[nIdx] = cur;
      queue[tail++] = nIdx;
    }
  }
  if (!found) return null;

  const rawPoints = [];
  for (let cur = goalIdx; cur !== startIdx; cur = prev[cur]) {
    const x = (cur % boxW) + minX;
    const y = Math.floor(cur / boxW) + minY;
    rawPoints.push([x * 8 + 4, y * 8 + 4]);
  }
  rawPoints.reverse();
  if (!rawPoints.length) return null;

  // String-pull with line-of-sight so wild actors walk in smooth straight legs.
  const route = [];
  let anchor = fromPx;
  for (let k = 0; k < rawPoints.length; k++) {
    let far = k;
    while (far + 1 < rawPoints.length && huntLineOfSightClear(anchor, rawPoints[far + 1], env)) far++;
    route.push(rawPoints[far]);
    anchor = rawPoints[far];
    k = far;
  }
  return route;
}

export function clearHuntPathSteering(actor) {
  if (actor?.huntSteer) delete actor.huntSteer;
}

const sameQ12 = (a, b) => Boolean(a && b && a[0] === b[0] && a[1] === b[1]);

/**
 * Call once per tick before `stepNativeWildActor` for active wild walkers.
 * Transparently guides actors around obstacles when their straight path is blocked;
 * leaves unobstructed native walking 100% untouched.
 */
export function prepareHuntPathSteering(actor, env, { onlyWhenBlocked = false } = {}) {
  if (!actor || !env || typeof env.readTerrain !== 'function') return false;
  const eligible = actor.actorActive && actor.wildActive && !actor.hidden && !actor.passage
    && !actor.cardState && !actor.tutorialScripted && !actor.bound && !actor.followTarget
    && (actor.aiState === 2 || actor.aiState === 3) && actor.positionQ12 && actor.destinationQ12;
  if (!eligible) {
    clearHuntPathSteering(actor);
    return false;
  }

  const posPx = [actor.positionQ12[0] / Q12, actor.positionQ12[1] / Q12];
  const destPx = [actor.destinationQ12[0] / Q12, actor.destinationQ12[1] / Q12];

  // Continue an existing detour if the AI has not reassigned a new destination.
  const steer = actor.huntSteer;
  if (steer) {
    const activeWp = steer.waypoints[steer.index];
    if (!activeWp || !sameQ12(actor.destinationQ12, activeWp)) {
      // External AI or food/decoy logic picked a fresh destination; replan below.
      clearHuntPathSteering(actor);
    } else {
      const wpPx = [activeWp[0] / Q12, activeWp[1] / Q12];
      const nextWp = steer.waypoints[steer.index + 1];
      const nextClear = nextWp && huntLineOfSightClear(posPx, [nextWp[0] / Q12, nextWp[1] / Q12], env);
      if (Math.hypot(posPx[0] - wpPx[0], posPx[1] - wpPx[1]) <= WAYPOINT_ARRIVE_PX || nextClear) {
        steer.index++;
        if (steer.index >= steer.waypoints.length) {
          clearHuntPathSteering(actor);
          return false;
        }
        actor.destinationQ12 = [...steer.waypoints[steer.index]];
      }
      return true;
    }
  }

  // In live Hunt controls, wait until the actor actually encounters an obstacle (food
  // pursuit or brief contact stall) so unobstructed opening trajectories stay identical.
  if (onlyWhenBlocked && !actor.foodTarget && !actor.seekingFood && (actor.stuckTicks ?? 0) < 4) {
    return false;
  }

  // Only plan a detour if the straight path is actually blocked.
  if (Math.hypot(destPx[0] - posPx[0], destPx[1] - posPx[1]) < WAYPOINT_ARRIVE_PX) return false;
  if (huntLineOfSightClear(posPx, destPx, env)) return false;

  const route = planHuntSteerRoute(posPx, destPx, env);
  if (!route || !route.length) return false;

  const waypoints = route.map(([x, y]) => [Math.round(x * Q12), Math.round(y * Q12), 0]);
  actor.huntSteer = {
    finalQ12: [...actor.destinationQ12],
    waypoints,
    index: 0
  };
  actor.destinationQ12 = [...waypoints[0]];
  return true;
}
