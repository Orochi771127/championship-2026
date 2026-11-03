// Ranch auto-care machines -- OWNER_APPROVED_ADAPTATION 2026-11-03 (AUTO_CARE_3D_20261103).
//
// A deployed cleaner is a small robot that strolls the walkable ground of its cage's
// connected cluster (every cage its floor reaches through open passages), locks on to
// a dropping, drives to it and sweeps it up. A deployed feeder is a tower at the
// cage's lower-left corner that turns to a partner showing the hungry bubble, lobs one
// piece of meat at it and lets the caller feed that partner when it lands.
//
// Pure presentation-free simulation in native pixels (Q12 is px * 4096). Machines keep
// their own seeded random stream, so they never draw from the gameplay RNG and the
// original raising sequences stay byte-identical. The caller owns the save (runs in
// cyberGacha), the waste list, the partners and the meat inventory.

// One ranch world unit (ranchThreeCoordinates: 16 * sqrt(2) native px).
export const AUTO_CARE_WORLD_UNIT = 16 * Math.SQRT2;
export const AUTO_CARE_RULES = Object.freeze({
  strollSpeed: 0.8 * AUTO_CARE_WORLD_UNIT,   // px/s
  seekSpeed: 2.0 * AUTO_CARE_WORLD_UNIT,     // px/s
  sweepSeconds: 0.4,
  lockAlertSeconds: 0.8,
  strollReach: 168,                          // px: how far one stroll leg may go
  strollPauseSeconds: [0.6, 2.2],
  arriveRadius: 5,
  aimSeconds: 0.2,
  throwSeconds: 0.55,
  feedCooldownSeconds: 0.6,
  curiosityRadius: 40,                       // px from the robot's centre
  curiosityCooldownSeconds: 24,
  rideChance: 0.18,                          // per curious meeting of a small partner
  rideSeconds: 3,
  rideLift: 11,                              // px a rider sits above the ground (the robot's lid)
  retireSeconds: 1.4                         // the power-down fold before a robot leaves
});

const TURN_RATE = Object.freeze({ STROLL: 4.2, SEEK: 9 });

/** mulberry32: a machine's own stream (never the gameplay RNG). */
export function machineRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function machineSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---- walkable grid (8 px cells of the raising ground) ----
const cellOf = (ground, x, y) => {
  const cx = Math.floor(x / 8), cy = Math.floor(y / 8);
  return cx >= 0 && cy >= 0 && cx < ground.width && cy < ground.height ? cy * ground.width + cx : -1;
};
const centreOf = (ground, i) => [(i % ground.width) * 8 + 4, Math.floor(i / ground.width) * 8 + 4];
const walkable = (ground, i) => i >= 0 && ground.readTerrain(i % ground.width, Math.floor(i / ground.width)) !== 1;

/** The walkable component (connected cluster) under a point, or -1. */
export function machineComponent(ground, x, y) {
  const i = cellOf(ground, x, y);
  if (i < 0 || !walkable(ground, i)) return -1;
  const component = ground.navigation?.component;
  return component ? component[i] : 0;
}
function sameComponent(ground, i, component) {
  if (!walkable(ground, i)) return false;
  const table = ground.navigation?.component;
  return table ? table[i] === component : true;
}

/** Straight segment stays on the cluster's floor (sampled every 3 px). */
function clearLine(ground, component, a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (!sameComponent(ground, cellOf(ground, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), component)) return false;
  }
  return true;
}

/**
 * Breadth-first route over the cluster's cells (8-way, no corner cutting), then pulled
 * tight with line-of-sight so the robot drives in smooth straight legs.
 */
export function planMachineRoute(ground, from, to, component) {
  const start = cellOf(ground, from[0], from[1]), goal = cellOf(ground, to[0], to[1]);
  if (start < 0 || goal < 0 || !sameComponent(ground, goal, component)) return null;
  if (start === goal) return [[to[0], to[1]]];
  const w = ground.width, previous = new Int32Array(w * ground.height).fill(-2);
  previous[start] = -1;
  const queue = [start];
  let found = false;
  for (let n = 0; n < queue.length && !found; n++) {
    const i = queue[n], x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= ground.height) continue;
      const j = ny * w + nx;
      if (previous[j] !== -2 || !sameComponent(ground, j, component)) continue;
      if (dx && dy && (!sameComponent(ground, y * w + nx, component) || !sameComponent(ground, ny * w + x, component))) continue;
      previous[j] = i;
      if (j === goal) { found = true; break; }
      queue.push(j);
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = goal; i !== -1; i = previous[i]) cells.push(i);
  cells.reverse();
  const points = [...cells.slice(1, -1).map((i) => centreOf(ground, i)), [to[0], to[1]]];
  const route = [];
  let anchor = [from[0], from[1]];
  for (let k = 0; k < points.length; k++) {
    // Keep the farthest point still in plain sight of the anchor.
    let far = k;
    while (far + 1 < points.length && clearLine(ground, component, anchor, points[far + 1])) far++;
    route.push(points[far]);
    anchor = points[far];
    k = far;
  }
  return route;
}

/** The cluster's open cells (clearance > 1, else any walkable), listed once per robot. */
function clusterCells(ground, bot) {
  if (bot.cells) return bot.cells;
  const open = [], any = [];
  for (let i = 0; i < ground.width * ground.height; i++) {
    if (!sameComponent(ground, i, bot.component)) continue;
    any.push(i);
    if ((ground.readClearance?.(i % ground.width, Math.floor(i / ground.width)) ?? 2) > 1) open.push(i);
  }
  bot.cells = open.length ? open : any;
  return bot.cells;
}

/** A random open point of the cluster within reach (a farther one when nothing near is open). */
function strollPoint(ground, bot, random) {
  const cells = clusterCells(ground, bot), reach = AUTO_CARE_RULES.strollReach;
  if (!cells.length) return null;
  const near = cells.filter((i) => {
    const [x, y] = centreOf(ground, i), d = Math.hypot(x - bot.x, y - bot.y);
    return d >= 16 && d <= reach;
  });
  const pool = near.length ? near : cells;
  return centreOf(ground, pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]);
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Where the robot parks to sweep a dropping: on it, or -- when it lies on a rock, a bush or a
 * border cell -- the nearest floor cell of the cluster within 64 px (its suction reaches that far).
 * Null when out of reach.
 */
function sweepSpot(ground, component, x, y) {
  if (sameComponent(ground, cellOf(ground, x, y), component)) return [x, y];
  let best = null;
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    const i = cellOf(ground, x + dx * 8, y + dy * 8);
    if (!sameComponent(ground, i, component)) continue;
    const [cx, cy] = centreOf(ground, i), d = Math.hypot(cx - x, cy - y);
    if (d <= 64 && (!best || d < best.d)) best = { d, at: [cx, cy] };
  }
  return best?.at ?? null;
}

/** A cleaning robot standing at `home` (native px). */
export function createCleanerBot({ id, instanceId, home, ground }) {
  return {
    id, instanceId, kind: "CLEANER",
    x: home[0], y: home[1], heading: -Math.PI / 4,
    component: machineComponent(ground, home[0], home[1]),
    mode: "STROLL", route: [], target: null, pause: 0.4, sweep: 0, alert: 0, brush: 0, speed: 0,
    rider: null, random: machineRandom(machineSeed(id)), met: new Map(), clock: 0
  };
}

function driveAlong(bot, dt, speed, turnRate) {
  let budget = speed * dt;
  while (bot.route.length && budget > 0) {
    const [tx, ty] = bot.route[0], dx = tx - bot.x, dy = ty - bot.y, distance = Math.hypot(dx, dy);
    if (distance < 0.01) { bot.route.shift(); continue; }
    // The nose turns first: a sharp corner slows the robot, it never slides sideways.
    const want = Math.atan2(dy, dx), turn = wrapAngle(want - bot.heading), maxTurn = turnRate * dt;
    bot.heading = wrapAngle(bot.heading + Math.max(-maxTurn, Math.min(maxTurn, turn)));
    const facing = Math.max(0.15, Math.cos(wrapAngle(want - bot.heading)));
    const step = Math.min(distance, budget * facing);
    bot.x += dx / distance * step; bot.y += dy / distance * step;
    budget -= budget * facing >= distance ? distance / facing : budget;
    bot.speed = speed * facing;
    if (Math.hypot(tx - bot.x, ty - bot.y) <= 0.5) bot.route.shift();
    if (facing < 1) break;
  }
}

/**
 * One step of a cleaner. `waste` lists droppings on the ground ({key, x, y} in px);
 * `claimed` is the set of droppings another robot already went for. Returns events:
 * LOCK (a dropping was spotted), SWEPT (this robot finished sweeping `key`).
 */
export function stepCleanerBot(bot, dt, { ground, waste = [], claimed = new Set() }) {
  const events = [];
  bot.clock += dt;
  bot.alert = Math.max(0, bot.alert - dt);
  bot.brush += dt * (bot.mode === "SWEEP" ? 30 : bot.mode === "SEEK" ? 16 : 9);
  bot.speed = 0;
  if (bot.component < 0) return events;
  if (bot.mode === "SWEEP") {
    bot.sweep += dt;
    bot.heading = wrapAngle(bot.heading + dt * 14);
    if (bot.sweep >= AUTO_CARE_RULES.sweepSeconds) {
      events.push({ kind: "SWEPT", key: bot.target.key, x: bot.target.x, y: bot.target.y });
      bot.mode = "STROLL"; bot.target = null; bot.route = []; bot.sweep = 0;
      bot.pause = AUTO_CARE_RULES.strollPauseSeconds[0];
    }
    return events;
  }
  const live = waste.filter((w) => !claimed.has(w.key)).map((w) => ({ ...w, spot: sweepSpot(ground, bot.component, w.x, w.y) })).filter((w) => w.spot);
  if (bot.mode === "SEEK" && !waste.some((w) => w.key === bot.target?.key)) {
    bot.mode = "STROLL"; bot.target = null; bot.route = [];
  }
  if (bot.mode !== "SEEK" && live.length && !bot.rider) {
    const nearest = live.reduce((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) <= Math.hypot(b.x - bot.x, b.y - bot.y) ? a : b);
    const route = planMachineRoute(ground, [bot.x, bot.y], nearest.spot, bot.component);
    if (route) {
      bot.mode = "SEEK"; bot.target = { key: nearest.key, x: nearest.x, y: nearest.y, spot: nearest.spot }; bot.route = route;
      bot.alert = AUTO_CARE_RULES.lockAlertSeconds; bot.pause = 0;
      events.push({ kind: "LOCK", key: nearest.key, x: nearest.x, y: nearest.y });
    }
  }
  if (bot.mode === "SEEK") {
    claimed.add(bot.target.key);
    driveAlong(bot, dt, AUTO_CARE_RULES.seekSpeed, TURN_RATE.SEEK);
    if (!bot.route.length || Math.hypot(bot.target.spot[0] - bot.x, bot.target.spot[1] - bot.y) <= AUTO_CARE_RULES.arriveRadius) {
      bot.mode = "SWEEP"; bot.sweep = 0; bot.route = [];
    }
    return events;
  }
  // Stroll: wait a moment, pick a new open point of the cluster, drive there.
  if (!bot.route.length) {
    bot.pause -= dt;
    if (bot.pause > 0) return events;
    const point = strollPoint(ground, bot, bot.random);
    const route = point ? planMachineRoute(ground, [bot.x, bot.y], point, bot.component) : null;
    const [lo, hi] = AUTO_CARE_RULES.strollPauseSeconds;
    bot.pause = lo + (hi - lo) * bot.random();
    if (route) bot.route = route;
    return events;
  }
  driveAlong(bot, dt, AUTO_CARE_RULES.strollSpeed, TURN_RATE.STROLL);
  return events;
}

/**
 * Curious partners (Owner 2026-11-03 easter egg): a young partner (in-training or
 * rookie) the robot passes looks at it (CURIOUS); now and then a baby hops on its lid
 * for a three-second ride (RIDE). `partners` are {id, x, y, generation, busy}.
 */
export function cleanerCuriosity(bot, partners) {
  const events = [], rules = AUTO_CARE_RULES;
  if (bot.mode === "SWEEP" || bot.component < 0) return events;
  for (const p of partners) {
    if (p.busy || !(p.generation >= 1 && p.generation <= 2)) continue;
    if (Math.hypot(p.x - bot.x, p.y - bot.y) > rules.curiosityRadius) continue;
    const last = bot.met.get(p.id);
    if (last !== undefined && bot.clock - last < rules.curiosityCooldownSeconds) continue;
    bot.met.set(p.id, bot.clock);
    const ride = !bot.rider && bot.mode === "STROLL" && p.generation === 1 && bot.random() < rules.rideChance;
    if (ride) {
      bot.rider = { id: p.id, left: rules.rideSeconds };
      events.push({ kind: "RIDE", partnerId: p.id });
    } else events.push({ kind: "CURIOUS", partnerId: p.id });
  }
  return events;
}

/** Count a rider down; returns the partner id when it hops off. */
export function stepCleanerRider(bot, dt) {
  if (!bot.rider) return null;
  bot.rider.left -= dt;
  if (bot.rider.left > 0) return null;
  const id = bot.rider.id;
  bot.rider = null;
  return id;
}

/** A feeding tower standing at `home` (native px), serving its cluster. */
export function createFeederTower({ id, instanceId, home, ground }) {
  return {
    id, instanceId, kind: "FEEDER", x: home[0], y: home[1], yaw: -Math.PI / 4,
    component: machineComponent(ground, home[0], home[1]),
    phase: "IDLE", t: 0, targetId: null, from: null, to: null, noMeat: false
  };
}

/**
 * One step of a feeder. `hungry` lists partners showing the hungry bubble in reach
 * ({id, x, y}); `meat` is the player's meat count; `claimed` holds partners another
 * tower is already feeding. Events: AIM, THROW, LAND (feed `targetId` now and take one
 * meat), CANCEL. Without meat it waits with `noMeat` set (the caller pauses its timer).
 */
export function stepFeederTower(tower, dt, { ground, hungry = [], meat = 0, claimed = new Set() }) {
  const events = [], rules = AUTO_CARE_RULES;
  tower.t += dt;
  const inReach = hungry.filter((p) => !claimed.has(p.id) && (tower.component < 0 || sameComponent(ground, cellOf(ground, p.x, p.y), tower.component)));
  if (tower.phase === "IDLE") {
    tower.noMeat = inReach.length > 0 && meat <= 0;
    if (!inReach.length || meat <= 0) return events;
    const target = inReach.reduce((a, b) => Math.hypot(a.x - tower.x, a.y - tower.y) <= Math.hypot(b.x - tower.x, b.y - tower.y) ? a : b);
    tower.phase = "AIM"; tower.t = 0; tower.targetId = target.id;
    tower.to = [target.x, target.y];
    events.push({ kind: "AIM", targetId: target.id });
  }
  if (tower.targetId) claimed.add(tower.targetId);
  const target = hungry.find((p) => p.id === tower.targetId) ?? null;
  if (tower.phase === "AIM") {
    if (!target) { tower.phase = "IDLE"; tower.targetId = null; events.push({ kind: "CANCEL" }); return events; }
    tower.to = [target.x, target.y];
    const want = Math.atan2(target.y - tower.y, target.x - tower.x);
    // Eases onto the partner across the aim (ease-out: most of the turn comes first).
    tower.yaw = wrapAngle(tower.yaw + wrapAngle(want - tower.yaw) * Math.min(1, dt * 16));
    if (tower.t >= rules.aimSeconds) {
      if (meat <= 0) { tower.phase = "IDLE"; tower.noMeat = true; tower.targetId = null; return events; }
      tower.yaw = want;
      // The meat lands just in front of the partner (towards the tower).
      const d = Math.max(1, Math.hypot(target.x - tower.x, target.y - tower.y));
      tower.from = [tower.x, tower.y];
      tower.to = [target.x - (target.x - tower.x) / d * 7, target.y - (target.y - tower.y) / d * 7];
      tower.phase = "THROW"; tower.t = 0;
      events.push({ kind: "THROW", targetId: tower.targetId, from: tower.from, to: tower.to });
    }
    return events;
  }
  if (tower.phase === "THROW") {
    if (tower.t >= rules.throwSeconds) {
      events.push({ kind: "LAND", targetId: tower.targetId, x: tower.to[0], y: tower.to[1] });
      tower.phase = "COOLDOWN"; tower.t = 0;
    }
    return events;
  }
  if (tower.phase === "COOLDOWN" && tower.t >= rules.feedCooldownSeconds) {
    tower.phase = "IDLE"; tower.t = 0; tower.targetId = null; tower.from = tower.to = null;
  }
  return events;
}

/** Where a thrown piece of meat is, 0..1 along its lob: native px plus height (px). */
export function meatArc(from, to, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const apex = 26 + distance * 0.35;
  return { x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, z: 34 * (1 - t) + 4 * apex * t * (1 - t), spin: t * Math.PI * 3 };
}

/**
 * The lower-left corner of a cage where its machines stand out of the way: the
 * walkable cell of that cage nearest to its bottom-left hex's lower-left point.
 * `cells` are the cage's hex cells ({x, y} native px of each hex's box).
 */
export function machineHome(ground, ownerIndex, cells, { along = 0 } = {}) {
  if (!cells?.length) return null;
  const bottom = Math.max(...cells.map((c) => c.y));
  const corner = cells.filter((c) => c.y === bottom).reduce((a, c) => (c.x < a.x ? c : a));
  const want = [corner.x + 20 + along, corner.y + 76 - along * 0.35];
  // Model obstacles can wall off a small border pocket: machines stand only on the cage's main floor
  // (the walkable component holding most of its cells), so they can always reach the rest of it.
  const table = ground.navigation?.component, counts = new Map();
  if (table) for (let i = 0; i < table.length; i++) {
    if (table[i] < 0) continue;
    const x = (i % ground.width) * 8 + 4, y = Math.floor(i / ground.width) * 8 + 4;
    if (ground.cageAt(x, y)?.ownerIndex === ownerIndex) counts.set(table[i], (counts.get(table[i]) ?? 0) + 1);
  }
  const main = counts.size ? [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0] : null;
  let best = null;
  for (let ty = Math.max(0, Math.floor((corner.y - 16) / 8)); ty < Math.min(ground.height, Math.ceil((corner.y + 120) / 8)); ty++) {
    for (let tx = Math.max(0, Math.floor((corner.x - 16) / 8)); tx < Math.min(ground.width, Math.ceil((corner.x + 120) / 8)); tx++) {
      if (ground.readTerrain(tx, ty) === 1 || ground.cageAt(tx * 8 + 4, ty * 8 + 4)?.ownerIndex !== ownerIndex) continue;
      if (main !== null && table[ty * ground.width + tx] !== main) continue;
      const clear = (ground.readClearance?.(tx, ty) ?? 2) > 1;
      const d = Math.hypot(tx * 8 + 4 - want[0], ty * 8 + 4 - want[1]) + (clear ? 0 : 24);
      if (!best || d < best.d) best = { d, x: tx * 8 + 4, y: ty * 8 + 4 };
    }
  }
  return best ? [best.x, best.y] : null;
}
