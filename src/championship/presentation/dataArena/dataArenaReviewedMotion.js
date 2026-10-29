// Presentation-only motion for reviewed (8-direction) fighters in the arena
// (Owner 2026-10-29: correct release points and Pokémon Arena 2D-like flow).
// The simulation keeps its own projectile origin and timing; these helpers only
// decide where a move is drawn leaving the body and how an idle or winning body
// keeps moving between authored frames.
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Partners walk at 236–262 px/s; the authored walk cycle was timed for that pace.
export const REVIEWED_WALK_REFERENCE = 250;

// World point a move leaves from. Authored metadata wins: `release.point` is in
// source pixels from the authored pivot, drawn before mirrorX, so the sprite's
// own scale (and its mirror sign) carries it into the world. A grounded role's
// pivot was moved down by groundShift native px (× density in source px).
// Without metadata the shot leaves at chest height, reaching forward along the
// aim; the vertical reach is foreshortened like the arena floor.
export function reviewedReleasePoint({ x, y, angle, roleHeight, release = null, scaleX = 1, scaleY = 1, groundShift = 0, density = 1 }) {
  if (Array.isArray(release?.point)) return { x: x + release.point[0] * scaleX, y: y + (release.point[1] - groundShift * density) * scaleY };
  const reach = roleHeight * 0.38;
  return { x: x + Math.cos(angle) * reach, y: y - roleHeight * 0.55 + Math.sin(angle) * reach * 0.6 };
}

// A shot is drawn from the release point and settles onto its simulated path.
export function releaseOffset(from, age, duration = 0.12) {
  if (!from) return [0, 0];
  const k = clamp(1 - age / duration, 0, 1), eased = k * k * k;
  return [from[0] * eased, from[1] * eased];
}

// A standing body breathes instead of freezing on its first walk frame.
export function reviewedIdleBreath(time, phase = 0) {
  return 1 + 0.015 * Math.sin((time + phase) * TAU / 1.6);
}

// Small repeated hops for the victory pose; |sin| lands with a bounce.
export function reviewedWinHop(time) {
  return Math.abs(Math.sin(time * Math.PI / 0.55)) * 9;
}

// Walk cadence follows ground speed so feet do not skate.
export function reviewedMoveRate(vx, vy, reference = REVIEWED_WALK_REFERENCE) {
  return clamp(Math.hypot(vx, vy) / reference, 0.6, 1.6);
}
