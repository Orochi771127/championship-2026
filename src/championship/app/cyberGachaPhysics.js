// Capsule physics for the gachapon dome (Owner 2026-10-29, second pass).
//
// Presentation only. A small position-based solver is run ahead of time and
// returns frames; the view plays them as Web Animations, so nothing ticks per
// frame (no requestAnimationFrame, no second ticker) and a paused page freezes
// the capsules mid-air. Coordinates are the dome box: 0..1 across, the glass
// circle centred at (0.5, 0.5) with radius 0.5, the cap and the collar floor
// as horizontal limits. Nothing here reads or writes game state.

export const GACHA_DOME = Object.freeze({ cx: 0.5, cy: 0.5, r: 0.5, cap: 0.2, floor: 0.86 });
export const GACHA_CAPSULE_RADIUS = 0.08;
export const GACHA_FPS = 60;

const SUBSTEPS = 4;
const GRAVITY = 14;
const WALL_BOUNCE = 0.5;
const CAPSULE_BOUNCE = 0.35;
const DEG = 180 / Math.PI;

function capsule(x, y, angle = 0) {
  return { x, y, px: x, py: y, a: angle, spin: 0, o: 1, sinking: false, out: false };
}

function keepInDome(ball, radius) {
  const { cx, cy, r, cap, floor } = GACHA_DOME;
  let vx = ball.x - ball.px, vy = ball.y - ball.py;
  if (ball.y > floor - radius) { ball.y = floor - radius; if (vy > 0) vy = -vy * WALL_BOUNCE; vx *= 0.92; }
  if (ball.y < cap + radius) { ball.y = cap + radius; if (vy < 0) vy = -vy * WALL_BOUNCE; }
  const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy), limit = r - radius;
  if (d > limit && d > 1e-9) {
    const nx = dx / d, ny = dy / d, vn = vx * nx + vy * ny;
    ball.x = cx + nx * limit;
    ball.y = cy + ny * limit;
    if (vn > 0) { vx -= (1 + WALL_BOUNCE) * vn * nx; vy -= (1 + WALL_BOUNCE) * vn * ny; }
  }
  ball.px = ball.x - vx;
  ball.py = ball.y - vy;
}

function separate(balls, radius) {
  const min = radius * 2;
  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (a.sinking || a.out) continue;
    for (let j = i + 1; j < balls.length; j += 1) {
      const b = balls[j];
      if (b.sinking || b.out) continue;
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      if (d >= min || d < 1e-9) continue;
      const nx = dx / d, ny = dy / d;
      let avx = a.x - a.px, avy = a.y - a.py, bvx = b.x - b.px, bvy = b.y - b.py;
      const closing = (avx - bvx) * nx + (avy - bvy) * ny;
      if (closing < 0) {
        const impulse = -(1 + CAPSULE_BOUNCE) * closing / 2;
        avx += impulse * nx; avy += impulse * ny; bvx -= impulse * nx; bvy -= impulse * ny;
        // A glancing knock sets both capsules spinning.
        const shear = (avx - bvx) * -ny + (avy - bvy) * nx;
        a.spin += shear * 900; b.spin -= shear * 900;
      }
      const push = (min - d) / 2;
      a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push;
      a.px = a.x - avx; a.py = a.y - avy; b.px = b.x - bvx; b.py = b.y - bvy;
    }
  }
}

/**
 * One substep. `agitate` (0..1) is the crank's air jet: an upward blast from the
 * floor, a clockwise swirl and random knocks, so the pile really flies.
 */
function step(balls, { radius, dt, agitate = 0, damping = 0.999, random }) {
  const { cx, cy } = GACHA_DOME;
  for (const ball of balls) {
    if (ball.out) continue;
    if (ball.sinking) {
      // Straight down through the chute in the collar; no collisions.
      ball.x += (GACHA_DOME.cx - ball.x) * 0.18;
      ball.y += 2.4 * dt;
      if (ball.y > GACHA_DOME.floor + radius * 2.2) { ball.out = true; ball.o = 0; }
      continue;
    }
    let vx = (ball.x - ball.px) * damping, vy = (ball.y - ball.py) * damping;
    let ax = 0, ay = GRAVITY;
    if (agitate > 0) {
      const dx = ball.x - cx, dy = ball.y - cy, d = Math.max(0.05, Math.hypot(dx, dy));
      const low = Math.max(0, (ball.y - 0.42) / 0.44);
      ay -= GRAVITY * agitate * (1.1 + 1.8 * low) * (0.75 + random() * 0.5);
      ax += (-dy / d) * GRAVITY * 1.3 * agitate;
      ay += (dx / d) * GRAVITY * 1.3 * agitate;
      if (random() < 0.035 * agitate) {
        const kick = 0.006 + random() * 0.01, angle = random() * Math.PI * 2;
        vx += Math.cos(angle) * kick;
        vy += Math.sin(angle) * kick - 0.004;
        ball.spin += (random() - 0.5) * 40;
      }
    }
    ball.px = ball.x; ball.py = ball.y;
    ball.x += vx + ax * dt * dt;
    ball.y += vy + ay * dt * dt;
  }
  separate(balls, radius);
  for (const ball of balls) if (!ball.sinking && !ball.out) keepInDome(ball, radius);
  for (const ball of balls) {
    if (ball.sinking || ball.out) continue;
    // Rolling turns the shell; free spin fades.
    ball.a += ((ball.x - ball.px) / radius) * DEG * 0.8 + ball.spin * dt;
    ball.spin *= 0.985;
  }
}

function snapshot(balls) {
  return balls.map((ball) => ({ x: ball.x, y: ball.y, a: ball.a % 360, o: ball.o }));
}

/** A resting pile: capsules dropped into the dome and left to settle. */
export function settleCapsules(count = 16, { random = Math.random, radius = GACHA_CAPSULE_RADIUS, seconds = 3 } = {}) {
  const balls = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / 4), column = i % 4;
    balls.push(capsule(0.27 + column * 0.155 + (random() - 0.5) * 0.04,
      GACHA_DOME.floor - radius - row * radius * 2.1 - random() * 0.02, random() * 360));
  }
  const dt = 1 / (GACHA_FPS * SUBSTEPS);
  for (let i = 0; i < seconds * GACHA_FPS * SUBSTEPS; i += 1) step(balls, { radius, dt, damping: 0.99, random });
  return snapshot(balls).map(({ x, y, a }) => ({ x, y, a }));
}

/**
 * The tumble after a pull: the crank's air jet throws the pile around for
 * `agitateMs`, one capsule sinks through the chute at `sinkMs`, a fresh one
 * drops in from the cap at `refillMs`, and the pile settles until `totalMs`.
 * Returns one frame per 1/60 s (each frame lists every capsule) and the final
 * resting pile for the next pull.
 */
export function simulateTumble(rest, {
  random = Math.random, radius = GACHA_CAPSULE_RADIUS,
  agitateMs = 650, sinkMs = 430, refillMs = 860, totalMs = 1300
} = {}) {
  const balls = rest.map(({ x, y, a }) => capsule(x, y, a));
  const frameCount = Math.round((totalMs / 1000) * GACHA_FPS);
  const dt = 1 / (GACHA_FPS * SUBSTEPS);
  const frames = [snapshot(balls)];
  let sinkIndex = -1;
  for (let frame = 1; frame <= frameCount; frame += 1) {
    const ms = (frame / GACHA_FPS) * 1000;
    if (sinkIndex < 0 && ms >= sinkMs && balls.length) {
      // The capsule nearest the chute in the floor's centre falls through.
      sinkIndex = balls.reduce((best, ball, index) =>
        (Math.hypot(ball.x - GACHA_DOME.cx, GACHA_DOME.floor - ball.y) < Math.hypot(balls[best].x - GACHA_DOME.cx, GACHA_DOME.floor - balls[best].y) ? index : best), 0);
      balls[sinkIndex].sinking = true;
    }
    if (sinkIndex >= 0 && ms >= refillMs && balls[sinkIndex].out) {
      const fresh = balls[sinkIndex];
      Object.assign(fresh, capsule(GACHA_DOME.cx + (random() - 0.5) * 0.16, GACHA_DOME.cap + radius + 0.005, random() * 360));
      fresh.py = fresh.y - 0.004;
      fresh.o = 0;
    }
    // The air jet swells and dies away with the crank (a half sine).
    const agitate = ms < agitateMs ? Math.sin(Math.PI * Math.min(1, ms / agitateMs)) ** 0.6 : 0;
    const damping = ms < agitateMs ? 0.9995 : 0.992;
    for (let sub = 0; sub < SUBSTEPS; sub += 1) step(balls, { radius, dt, agitate, damping, random });
    for (const ball of balls) if (!ball.sinking && !ball.out && ball.o < 1) ball.o = Math.min(1, ball.o + 0.2);
    frames.push(snapshot(balls));
  }
  return {
    frames,
    sinkIndex,
    ms: (frameCount / GACHA_FPS) * 1000,
    final: frames[frames.length - 1].map(({ x, y, a }) => ({ x, y, a }))
  };
}

/**
 * The crank turn: a damped spring from 0 to `degrees` (slight overshoot, then
 * home) sampled every frame, plus the moments it passes each ratchet tooth so
 * the clicks land on the picture.
 */
export function crankTurn({ degrees = 720, ms = 650, tooth = 45 } = {}) {
  const zeta = 0.7, omega = 8.8 * (650 / ms);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const angleAt = (t) => degrees * (1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t)));
  const count = Math.max(2, Math.round((ms / 1000) * GACHA_FPS));
  const frames = [];
  const ticks = [];
  let passed = 0;
  for (let i = 0; i <= count; i += 1) {
    const t = (i / count) * (ms / 1000);
    const angle = i === count ? degrees : angleAt(t);
    frames.push(angle);
    while (angle >= (passed + 1) * tooth && passed < degrees / tooth) { passed += 1; ticks.push(Math.round(t * 1000)); }
  }
  return { frames, ticks, ms };
}
