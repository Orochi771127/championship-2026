// Hunt partner motion layer (Owner 2026-11-03). Presentation only: it reads the
// published actor (position, AI state, bound, stun) and the texture the native
// or reviewed animation chose, and never feeds anything back to the hunt.
//
// - A partner that moves while its drawing stays the same (a one-frame clip or a
//   pose the native clip holds) hops with squash and stretch instead of sliding.
// - A bound partner struggles: a fast side-to-side shake under the rope.
// - A running partner leans into the run and kicks up dust.
// - Shadows shrink and fade while a hop is in the air.

export const HUNT_ACTOR_MOTION = Object.freeze({
  movingSpeed: 6,          // world px per second
  staticAfterMs: 380,      // no new drawing for this long while moving: hop
  hopHz: 2.6, runHopHz: 3.6, hopHeight: 4, runHopHeight: 5,
  squash: 0.08, stretch: 0.05,
  struggleHz: 11, struggleShift: 1.6,
  lean: 0.12, leanFollow: 10, // per second
  dustEveryMs: 110, dustLifeMs: 340
});

const RUNNING_AI = new Set([3, 7, 8]);

export function createHuntActorMotion() {
  return { x: null, y: null, speed: 0, vx: 0, textureKey: null, changedAt: 0, phase: 0, lean: 0, dustAt: 0 };
}

/** One render frame. `now` and `dt` are milliseconds. */
export function stepHuntActorMotion(state, { now, dt, worldX, worldY, textureKey, aiState = null, bound = false,
  stunned = false, handReady = false, reducedMotion = false }) {
  const M = HUNT_ACTOR_MOTION;
  const seconds = Math.max(0, Math.min(0.1, (Number.isFinite(dt) ? dt : 0) / 1000));
  if (state.x !== null && seconds > 0 && Number.isFinite(worldX) && Number.isFinite(worldY)) {
    const dx = worldX - state.x, dy = worldY - state.y, speed = Math.hypot(dx, dy) / seconds;
    // A little smoothing: the native clock moves in whole ticks, not every frame.
    state.speed += (speed - state.speed) * Math.min(1, seconds * 12);
    state.vx += (dx / seconds - state.vx) * Math.min(1, seconds * 12);
  }
  if (Number.isFinite(worldX) && Number.isFinite(worldY)) { state.x = worldX; state.y = worldY; }
  if (textureKey !== state.textureKey) { state.textureKey = textureKey; state.changedAt = now; }
  const moving = state.speed > M.movingSpeed;
  const running = moving && RUNNING_AI.has(aiState);
  const still = now - state.changedAt > M.staticAfterMs;
  const out = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, lean: 0, shadowScale: 1, shadowAlpha: 1,
    // A downed or stunned partner shows stars even while the loop is still on it.
    hop: false, struggle: false, dust: false, mood: stunned || handReady ? 'stunned' : bound ? 'struggle' : null, running };
  if (reducedMotion) { state.lean = 0; return out; }
  if (moving && still && !stunned && !handReady) {
    state.phase += seconds * Math.PI * 2 * (running ? M.runHopHz : M.hopHz);
    const air = Math.abs(Math.sin(state.phase));
    out.hop = true;
    out.offsetY = -air * (running ? M.runHopHeight : M.hopHeight);
    out.scaleY = 1 - M.squash * (1 - air) ** 3 + M.stretch * air;
    out.scaleX = 1 / Math.sqrt(out.scaleY);
    out.shadowScale = 1 - 0.25 * air;
    out.shadowAlpha = 1 - 0.35 * air;
  } else state.phase = 0;
  if (out.mood === 'struggle') {
    out.struggle = true;
    out.offsetX = Math.sin(now / 1000 * Math.PI * 2 * M.struggleHz) * M.struggleShift;
  }
  const leanTarget = running ? Math.sign(state.vx) * M.lean : 0;
  state.lean += (leanTarget - state.lean) * Math.min(1, seconds * M.leanFollow);
  out.lean = Math.abs(state.lean) < 1e-4 ? 0 : state.lean;
  if (running && now - state.dustAt >= M.dustEveryMs) { state.dustAt = now; out.dust = true; }
  return out;
}

/** Dust puffs: plain records the renderer draws and ages. */
export function stepHuntDust(puffs, dt) {
  const life = HUNT_ACTOR_MOTION.dustLifeMs;
  for (let i = puffs.length - 1; i >= 0; i--) {
    const puff = puffs[i];
    puff.age += dt;
    puff.x += puff.vx * dt / 1000;
    puff.y -= 6 * dt / 1000;
    if (puff.age >= life) puffs.splice(i, 1);
  }
  return puffs;
}
