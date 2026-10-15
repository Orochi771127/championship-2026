// Data Arena QA autopilot: a deterministic decision function over READ-ONLY
// observation (the arena's ?arenaQa=1 snapshot). It returns the controls a
// player would hold this instant; the browser gate turns them into real
// keyboard and mouse events, and the node tuner feeds them to the pure
// simulation. It never writes arena state and never skips a phase.

const CELL = 64;
const WATER_TOP = 28 * CELL, WATER_BOTTOM = 32 * CELL;
const side = (y) => (y < WATER_TOP ? "NORTH" : y >= WATER_BOTTOM ? "SOUTH" : "WATER");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * obs: { snap, enemies, projectiles, telegraphs }
 * mem: caller-owned object for hysteresis between calls.
 */
/** Tournament duel: keep range, strafe, dodge telegraphed shots and zones, use the kit. */
function decideDuel(obs, mem) {
  const { snap, projectiles = [], telegraphs = [] } = obs;
  const p = snap.player, rival = (snap.rivals || [])[0];
  const out = { moveX: 0, moveY: 0, aimX: p.x, aimY: p.y - 200, fire: false, dash: false, surge: false, ride: false, cast: null, ult: false, autoAim: true };
  if (snap.mode !== "PLAY" || !rival || !snap.tournament || snap.tournament.status !== "FIGHT") return out;
  const d = dist(rival, p) || 1;
  const toward = { x: (rival.x - p.x) / d, y: (rival.y - p.y) / d };
  const want = 330;
  let mx = toward.x * (d - want) / 160, my = toward.y * (d - want) / 160;
  mem.strafe = mem.strafe || 1; mem.flip = (mem.flip || 0) - 1;
  if (mem.flip <= 0) { mem.strafe = -mem.strafe; mem.flip = 14 + Math.floor((p.x + p.y) % 9); }
  mx += -toward.y * mem.strafe * 0.8; my += toward.x * mem.strafe * 0.8;
  // Without a line of sight, step around the cover toward the rival.
  if (!rival.sight) { mx += toward.x * 0.8; my += toward.y * 0.8; }
  for (const zone of snap.zones || []) {
    if (zone.team === "player") continue;
    const zd = Math.hypot(zone.x - p.x, zone.y - p.y) || 1;
    if (zd < zone.radius + 40) { mx += (p.x - zone.x) / zd * 3; my += (p.y - zone.y) / zd * 3; if (zone.left < 0.35) out.dash = true; }
  }
  for (const t of telegraphs) if (t.kind === "CIRCLE" && t.radius && Math.hypot(t.x - p.x, t.y - p.y) < t.radius + 30) { mx += (p.x - t.x) / 80; my += (p.y - t.y) / 80; }
  // Human-like dodging: react only to shots still 0.25-0.6 s away, and miss some (skill < 1).
  const skill = mem.skill ?? 0.6;
  mem.seen = mem.seen || {};
  for (const s of projectiles) {
    if (s.owner === "player" || s.owner === "mate") continue;
    const speed = Math.hypot(s.vx, s.vy) || 1;
    const along = ((p.x - s.x) * s.vx + (p.y - s.y) * s.vy) / speed;
    if (along <= 0) continue;
    const miss = Math.abs((p.x - s.x) * s.vy - (p.y - s.y) * s.vx) / speed;
    const eta = along / speed;
    if (miss > 34 || eta < 0.25 || eta > 0.6) continue;
    const key = `${Math.round(s.vx)}:${Math.round(s.vy)}:${Math.round(s.x / 50)}`;
    if (mem.seen[key] === undefined) mem.seen[key] = ((Math.abs(Math.round(s.x * 7 + s.y * 13)) % 100) / 100) < skill;
    if (mem.seen[key]) { out.dash = true; out.moveX = -s.vy / speed; out.moveY = s.vx / speed; }
  }
  if (p.y > 8 * CELL - 30 && p.y < 10 * CELL + 30 && !out.dash) my += p.y < 9 * CELL ? -1 : 1; // keep off the channel edge (rows 8-9)
  out.moveX = mx; out.moveY = my;
  out.aimX = rival.x; out.aimY = rival.y;
  out.fire = rival.sight && !snap.laser.overheated;
  const kit = snap.kit;
  if (kit) {
    if (kit.ult >= kit.ultMax && d < 420 && rival.sight) out.ult = true;
    else {
      const ready = kit.moves.map((m, i) => ({ ...m, i })).filter((m) => m.ready && kit.energy >= m.energy);
      const pick = ready.find((m) => m.type === "ZONE" && (rival.rooted || rival.slowed)) || ready.find((m) => m.type === "BOLT" || m.type === "SPREAD")
        || ready.find((m) => m.type === "ZONE") || ready.find((m) => m.type === "BARRIER" && projectiles.some((s) => s.owner === "rival" && Math.hypot(s.x - p.x, s.y - p.y) < 220));
      if (pick && rival.sight && (mem.castGap = (mem.castGap || 0) - 1) <= 0) { out.cast = pick.i; mem.castGap = 4; }
    }
  }
  return out;
}

function decide(obs, mem = {}) {
  if (obs.snap?.gameMode === "TOURNAMENT") return decideDuel(obs, mem);
  const { snap, enemies = [], projectiles = [], telegraphs = [] } = obs;
  const p = snap.player, m = snap.mate, boss = snap.boss;
  const riding = p.state === "RIDING" || p.state === "MOUNTING";
  const out = { moveX: 0, moveY: 0, aimX: p.x + 200, aimY: p.y, fire: false, dash: false, surge: false, ride: false };
  if (snap.mode !== "PLAY") return out;

  // ---- target
  let target = null, best = Infinity;
  for (const e of enemies) { const d = dist(e, p); if (d < best) { best = d; target = e; } }
  const bossLive = boss && boss.state === "FIGHT";
  if (bossLive) { const d = dist(boss, p); if (!target || d < best + 260) { target = boss; best = d; } }

  // ---- goal
  let goal = null;
  const coresLeft = (snap.cores || []).filter((c) => !c.out);
  const beaconsLeft = (snap.beacons || []).filter((b) => b.active && !b.captured);
  if (m.state === "DOWNED" && dist(m, p) < 700 && !riding) goal = { x: m.x, y: m.y };
  else if (snap.phase === "EMBERS" && coresLeft.length) {
    const core = coresLeft.sort((a, b) => dist(a, p) - dist(b, p))[0];
    goal = { x: core.x, y: core.y - 170 };
    mem.core = core;
  } else if (beaconsLeft.length) {
    goal = beaconsLeft.sort((a, b) => dist(a, p) - dist(b, p))[0];
  } else if (bossLive) {
    // Hold a ring around the guardian, on whichever bank we are.
    const away = dist(boss, p) || 1;
    const want = 330;
    goal = { x: boss.x + ((p.x - boss.x) / away) * want, y: boss.y + ((p.y - boss.y) / away) * want };
    if (side(p.y) === "SOUTH") goal.y = Math.max(goal.y, WATER_BOTTOM + 70);
  } else goal = { x: 30.5 * CELL, y: 22 * CELL };

  // ---- crossing: ride the mate over the channel when the goal is across.
  const needCross = goal && side(goal.y) !== "WATER" && side(p.y) !== side(goal.y) && snap.phase !== "WARMUP" && snap.phase !== "EMBERS";
  if (needCross && !riding) {
    if (m.state === "FOLLOW" && dist(m, p) <= 105 && !(mem.rideLatch > 0)) { out.ride = true; mem.rideLatch = 20; }
    else if (m.state === "FOLLOW") goal = { x: m.x, y: m.y };
    else goal = { x: p.x, y: side(p.y) === "NORTH" ? WATER_TOP - 60 : WATER_BOTTOM + 60 };
  }
  if (riding && p.state === "RIDING" && !needCross && obs.surface !== "WATER" && !(mem.rideLatch > 0)) { out.ride = true; mem.rideLatch = 20; }
  mem.rideLatch = Math.max(0, (mem.rideLatch || 0) - 1);

  // ---- movement: seek goal, repel crowd, flee danger
  let mx = 0, my = 0;
  if (goal) { const d = dist(goal, p); if (d > 26) { mx = (goal.x - p.x) / d; my = (goal.y - p.y) / d; } }
  for (const e of enemies) {
    const d = dist(e, p) || 1;
    if (d < 230) { mx -= ((e.x - p.x) / d) * (230 - d) / 70; my -= ((e.y - p.y) / d) * (230 - d) / 70; }
  }
  if (bossLive) { const d = dist(boss, p) || 1; if (d < 250) { mx -= ((boss.x - p.x) / d) * 2.2; my -= ((boss.y - p.y) / d) * 2.2; } }
  for (const t of telegraphs) {
    if (t.kind === "CIRCLE" && t.radius) { const d = Math.hypot(t.x - p.x, t.y - p.y) || 1; if (d < t.radius + 50) { mx += ((p.x - t.x) / d) * 3; my += ((p.y - t.y) / d) * 3; } }
  }
  // Do not walk off into the channel unless riding.
  if (!riding && side(p.y) === "NORTH" && p.y > WATER_TOP - 40 && my > 0 && !needCross) my = Math.min(my, 0);
  out.moveX = mx; out.moveY = my;

  // ---- dash through or away from danger
  if (!riding) {
    for (const s of projectiles) {
      if (s.owner === "mate") continue;
      const d = dist(s, p);
      const closing = (p.x - s.x) * s.vx + (p.y - s.y) * s.vy > 0;
      if (d < 78 && closing) { out.dash = true; break; }
    }
    for (const e of enemies) if (dist(e, p) < 44) out.dash = true;
    // A scanner beam sweeping toward us: dash through it (a perfect dodge).
    for (const scan of snap.scans || []) {
      if (!scan.active) continue;
      const r = Math.hypot(p.x - scan.x, p.y - scan.y);
      if (r > (scan.reach || 1000) + 20 || r < 30) continue;
      let ahead = Math.atan2(p.y - scan.y, p.x - scan.x) - scan.angle;
      ahead = Math.atan2(Math.sin(ahead), Math.cos(ahead)) * scan.spin;
      if (ahead > 0 && ahead * r < 95) {
        const tx = -Math.sin(scan.angle) * scan.spin, ty = Math.cos(scan.angle) * scan.spin;
        out.moveX = tx; out.moveY = ty; out.dash = true;
      }
    }
  }

  // ---- aim and fire; Tide Surge for cores and ember swarms
  if (target && best < 700) { out.aimX = target.x; out.aimY = target.y; out.fire = !snap.laser.overheated; }
  if (snap.phase === "EMBERS" && mem.core && !mem.core.out && m.state === "FOLLOW" && m.surgeCooldown <= 0 && dist(mem.core, m) < 480) {
    out.surge = true; out.aimX = mem.core.x; out.aimY = mem.core.y; out.fire = false;
  } else if (m.surgeCooldown <= 0 && enemies.filter((e) => dist(e, p) < 260).length >= 5 && target) {
    out.surge = true;
  }
  // ---- kit: bolts and zones at the current target, the ultimate on the guardian or a crowd
  const kit = snap.kit;
  if (kit && target && best < 520 && !riding && !out.surge) {
    const crowd = enemies.filter((e) => dist(e, p) < 240).length;
    if (kit.ult >= kit.ultMax && ((bossLive && dist(boss, p) < 300) || crowd >= 6)) out.ult = true;
    else if ((mem.castGap = (mem.castGap || 0) - 1) <= 0) {
      const ready = kit.moves.map((move, i) => ({ ...move, i })).filter((move) => move.ready && kit.energy >= move.energy);
      const pick = ready.find((move) => move.type === "BOLT" || move.type === "SPREAD") || ready.find((move) => move.type === "ZONE" && (bossLive || crowd >= 3));
      if (pick) { out.cast = pick.i; out.autoAim = true; mem.castGap = 5; }
    }
  }
  return out;
}

module.exports = { decide, decideDuel, side };
