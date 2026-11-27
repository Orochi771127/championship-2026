// Data Arena -- move-by-move presentation scripts (PB_MOVE_BY_MOVE_20261127).
//
// Owner 2026-11-27: every pool move is staged like its reference move, one move at a
// time, instead of sharing one of 19 archetype looks (76 moves were all "multi dash").
// Each script is written from watching the reference preview frame by frame (beat
// sheets are kept outside the repo); no reference code, sprite or pixel is used,
// only what was seen: beats, distances, shapes, colours, durations.
//
// A script has two halves:
//   * `body`  -- how the caster's own drawn sprite acts (read by the scene's motion block);
//   * `fx`    -- handlers the pixel layer runs instead of the archetype's generic effect:
//                cast (through the windup), release (through the dash or flight), hit.
// Handlers draw with hard-edged shapes in the move's own colour steps only.
//
// Presentation only: no rule, timing, damage or collision reads anything here.

const FIRE = Object.freeze({ white: 0xfff6d8, hot: 0xffe05c, main: 0xff8a1c, deep: 0xd8360f, dark: 0x7a2412, ash: 0x4a3a34 });
const SCORCH_STOPS = Object.freeze([[0, [58, 40, 34], 0.78], [0.7, [58, 40, 34], 0.6], [1, [58, 40, 34], 0]]);

/**
 * Body cues per move id (the scene reads these; all optional). Sizes are world px; a body is ~72 px tall.
 *   windup {tint, shake, crouch, lean (+ back / - forward), hop (rises and stays up)}
 *   dash   {tint, hide, low, lean, arc (leap height), dive (start height), afterimage (tint)}
 *   strike {lean, low, tint, hold (seconds held at the contact point)}
 *   after  {hop (height), time}  -- lets go of the contact point and hops back to where the rules put it
 *   impactFrame: the ink impact frame on its hit;  fireballHop: the fireball keeps the body through its rebound.
 */
export const PB_MOVE_BODY = Object.freeze({
  // ---- fire
  'pb-098': { key: 'flameCharge', windup: { tint: 0xff5a2a, shake: 1.6 }, dash: { tint: 0xff7a3a, afterimage: 0xff7a3a }, impactFrame: true },
  'pb-099': { key: 'flameWheel', windup: { crouch: 0.26 }, dash: { hide: true }, fireballHop: 42 },
  'pb-094': { key: 'fireFang', windup: { lean: 0.3 }, dash: { low: 0.16, afterimage: 0xff8a3a } },
  // ---- fighting
  // Mach Punch: barely a windup, crosses the gap as a streak of light, holds the long punch, hops back up and away.
  'pb-170': { key: 'machPunch', windup: { crouch: 0.08 }, dash: { hide: true }, strike: { lean: 0.22, hold: 0.3 }, after: { hop: 62, time: 0.3 } },
  // Karate Chop: bends in with a blade of energy on the arm, chops down and presses, jumps back off.
  'pb-154': { key: 'karateChop', windup: { crouch: 0.14, lean: -0.22 }, strike: { lean: 0.32, low: 0.1, hold: 0.35 }, after: { hop: 66, time: 0.25 } },
  // Cross Chop: arms crossed, leaps in a high arc, lands on the target with both arms and stays.
  'pb-042': { key: 'crossChop', windup: { crouch: 0.12 }, dash: { arc: 104, afterimage: 0xff7ab0 }, strike: { lean: 0.3, low: 0.08, hold: 0.35 } },
  // Brick Break: hops with a glowing hand raised, brings the chop down from that height, stays pressed.
  'pb-029': { key: 'brickBreak', windup: { hop: 38 }, strike: { lean: 0.34, low: 0.12, hold: 0.4 }, impactFrame: true },
  // Low Kick: drops almost flat, slides in along the ground, sweeps and rises slowly.
  'pb-167': { key: 'lowKick', windup: { crouch: 0.38, lean: -0.5 }, dash: { low: 0.45, lean: 0.5, afterimage: 0xb08aff }, strike: { low: 0.36, lean: 0.3, hold: 0.2 } },
  // ---- flying
  // Aerial Ace: a dark-blue silhouette that cuts straight through the target and lands flat on its far side.
  'pb-003': { key: 'aerialAce', windup: { crouch: 0.2, tint: 0x2a3a8c }, dash: { tint: 0x2a3a8c, afterimage: 0x4a5acc }, strike: { low: 0.3, hold: 0.14 }, impactFrame: true }
});

export const pbMoveBody = moveId => PB_MOVE_BODY[moveId] ?? null;

/**
 * Effect handlers per script key. `api` is the pixel layer's own toolbox:
 * {spawnP, addHero, addDecal, rand, puff(g, x, y, r, rgb, alpha)}.
 * A follow function returns {x, y, footY} while its phase lasts and null when it ends.
 */
export function createPbMoveScripts(api) {
  const { spawnP, addHero, addDecal, rand } = api;
  const TAU = Math.PI * 2;
  const live = (life, draw, extra = {}) => addHero({ kind: 'PB_SCRIPT', life, draw, ...extra });
  const scorchDash = (x, y) => spawnP({ shape: 'px', x, y, size: 5, size1: 5, stops: SCORCH_STOPS, add: false, life: 0.9, drag: 1 });
  const ember = (x, y, vx, vy, size = 4, life = 0.32) => spawnP({ shape: 'px', x, y, vx, vy, size, size1: 1.5, pal: 'fire', add: true, life, drag: 0.9 });
  // A drawn ground ring: a flat ellipse outline under a body (the reference draws these as plain ellipses).
  const groundRing = (g, x, y, r, color, alpha, width = 3) => {
    if (!g || alpha <= 0.02 || r < 2) return;
    g.ellipse(x, y, r, r * 0.42).stroke({ color, width, alpha });
  };
  // A jagged flame spike standing on the ground at (x, baseY).
  const flameSpike = (g, x, baseY, height, half, color, alpha, lean = 0) => {
    if (!g || alpha <= 0.02 || height < 3) return;
    g.poly([x - half, baseY, x - half * 0.55 + lean * 0.3, baseY - height * 0.45, x - half * 0.9 + lean * 0.6, baseY - height * 0.62,
      x + lean, baseY - height, x + half * 0.7 + lean * 0.6, baseY - height * 0.58, x + half * 0.4 + lean * 0.3, baseY - height * 0.4, x + half, baseY])
      .fill({ color, alpha });
  };

  // A four-point star, the "dizzy" stars over a struck head, pebbles left on the ground.
  const star4 = (g, x, y, r, color, alpha) => { if (g && alpha > 0.02) g.poly([x, y - r, x + r * 0.28, y - r * 0.28, x + r, y, x + r * 0.28, y + r * 0.28, x, y + r, x - r * 0.28, y + r * 0.28, x - r, y, x - r * 0.28, y - r * 0.28]).fill({ color, alpha }); };
  const dizzy = (x, y, seconds = 0.45) => live(seconds, (h, t, dt, g) => {
    for (let i = 0; i < 3; i++) { const a = h.age * 9 + i * 2.094; star4(g.add, x + Math.cos(a) * 15, y - 48 + Math.sin(a) * 5, 4.5, 0xffffff, 0.95 * (1 - t * 0.4)); }
  });
  const pebbles = (x, y, count, spread, rgb = [112, 90, 70], life = 3.2) => {
    const stops = [[0, rgb, 0.95], [0.8, rgb, 0.85], [1, rgb, 0]];
    for (let i = 0; i < count; i++) spawnP({ shape: 'px', x: x + (rand() - 0.5) * spread, y: y + (rand() - 0.5) * spread * 0.4, size: 3 + rand() * 2, size1: 3, stops, add: false, life: life * (0.7 + rand() * 0.5), drag: 1 });
  };
  const whiteBloom = (x, y, from, to, life = 0.18) => spawnP({ shape: 'glow', x, y, size: from, size1: to, stops: [[0, [255, 255, 255], 1], [1, [255, 250, 235], 0]], add: true, life });
  const sparks = (x, y, angle, count, pal, speed = 260, spread = 2.2) => {
    for (let i = 0; i < count; i++) { const a = angle + (rand() - 0.5) * spread; spawnP({ shape: 'streak', x, y, vx: Math.cos(a) * (speed * (0.6 + rand() * 0.7)), vy: Math.sin(a) * speed * 0.6 - 30, size: 5, size1: 1, rot: a, pal, add: true, life: 0.2 + rand() * 0.1 }); }
  };

  return Object.freeze({
    // ------------------------------------------------------------------ Mach Punch
    machPunch: {
      release({ follow, angle = 0 }) {
        const s = Math.sin(angle), c = Math.cos(angle), nx = -s, ny = c;
        // The body is a line of light from where it stood to where it is; it is gone 0.1 s after it arrives.
        live(0.6, (h, t, dt, g) => {
          const at = follow?.();
          if (at) { h.last = at; h.start ??= at; } else if (h.endedAt === undefined) h.endedAt = h.age;
          if (!h.start || !h.last) return;
          const fade = h.endedAt === undefined ? 1 : 1 - (h.age - h.endedAt) / 0.1;
          if (fade <= 0) { h.age = h.life; return; }
          const band = (g2, half, color, alpha) => g2.poly([h.start.x + nx * half, h.start.y + ny * half, h.last.x + nx * half, h.last.y + ny * half,
            h.last.x - nx * half, h.last.y - ny * half, h.start.x - nx * half, h.start.y - ny * half]).fill({ color, alpha });
          band(g.top, 9, 0xbff5c0, 0.7 * fade); band(g.add, 4.5, 0xffffff, 0.95 * fade);
          g.top.circle(h.start.x, h.start.y, 16 * fade).fill({ color: 0xbff5c0, alpha: 0.45 * fade });
        });
      },
      hit({ x, y, angle = 0 }) {
        whiteBloom(x, y, 34, 72, 0.16);
        live(0.18, (h, t, dt, g) => star4(g.add, x, y, 30 * (1 - t * 0.5), 0xffb040, 1 - t));
        // A jet of orange sparks out of the target's back.
        const bx = x + Math.cos(angle) * 22, by = y + Math.sin(angle) * 14;
        for (let i = 0; i < 12; i++) { const a = angle + (rand() - 0.5) * 0.5; spawnP({ shape: 'streak', x: bx, y: by, vx: Math.cos(a) * (300 + rand() * 260), vy: Math.sin(a) * (300 + rand() * 260), size: 6, size1: 1, stretch: 2.4, rot: a, pal: 'fire', add: true, life: 0.2 + rand() * 0.08 }); }
        dizzy(x, y, 0.35);
      }
    },

    // ------------------------------------------------------------------ Karate Chop
    karateChop: {
      cast({ follow, angle = 0, windup = 0.12 }) { this.blade(follow, angle, Math.max(0.12, windup)); },
      release({ follow, angle = 0 }) { this.blade(follow, angle, 0.5, true); },
      // A thin wedge of orange energy hangs off the leading arm, point down.
      blade(follow, angle, life, untilEnd = false) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { if (untilEnd) h.age = h.life; return; }
          const bx = at.x + c * 18, top = at.y - 30;
          g.top.poly([bx - 6, top, bx + 7, top + 4, bx + 3, top + 62]).fill({ color: 0xff8a1c, alpha: 0.92 });
          g.add.poly([bx - 2, top + 4, bx + 4, top + 6, bx + 2.5, top + 46]).fill({ color: 0xffe9b0, alpha: 0.9 });
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        whiteBloom(x, y, 20, 44, 0.12);
        sparks(x, y - 8, -Math.PI / 2, 9, 'fire', 240, 2.6);
        // A thin pillar of light stands on the struck point; a ring spreads under the feet.
        live(0.34, (h, t, dt, g) => {
          const fade = 1 - t, height = 108 * Math.min(1, t / 0.15 + 0.4);
          g.top.rect(x - 6, groundY - height, 12, height).fill({ color: 0xff9a2c, alpha: 0.85 * fade });
          g.add.rect(x - 2.5, groundY - height, 5, height).fill({ color: 0xffffff, alpha: 0.95 * fade });
          groundRing(g.top, x, groundY + 4, 36 + 54 * t, 0xc87838, 0.85 * fade, 3);
        });
        pebbles(x, groundY + 6, 12, 130);
        addDecal({ x: x - Math.cos(angle) * 20, y: groundY + 8, kind: 'crack', radius: 14, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Cross Chop
    crossChop: {
      cast({ follow, windup = 0.16 }) {
        // The chest flashes white as the arms cross.
        live(Math.max(0.12, windup), (h, t, dt, g) => { const at = follow?.(); if (at) g.add.circle(at.x, at.y - 4, 7 + 9 * t).fill({ color: 0xffffff, alpha: 0.85 * (1 - t * 0.5) }); });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(0.42, (h, t, dt, g) => {
          if (t < 0.3) {
            // A dark red crescent stands in front of the target for the first instant.
            const k = 1 - t / 0.3, cx = x - c * 34, pts = [], inner = [];
            for (let i = 0; i <= 8; i++) { const a = (i / 8 - 0.5) * 2.3; pts.push(cx + c * Math.cos(a) * 54, y + Math.sin(a) * 58); inner.unshift(cx + c * (Math.cos(a) * 54 - 15 * Math.cos(a * 1.36)), y + Math.sin(a) * 58); }
            g.top.poly([...pts, ...inner]).fill({ color: 0x8a1220, alpha: 0.92 * k });
          }
          // Then a jagged red X splits open on the body and flickers.
          const flick = 0.75 + 0.25 * Math.sin(h.age * 60), fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4, grow = Math.min(1, t / 0.2);
          for (const d of [0.78, -0.78]) {
            const ux = Math.cos(d), uy = Math.sin(d), len = 56 * grow, w = 9, pts = [];
            for (let i = 0; i <= 6; i++) { const f = i / 6 * 2 - 1, j = (i % 2 ? 1 : 0.45) * w; pts.push(x + ux * len * f - uy * j, y + uy * len * f + ux * j); }
            for (let i = 6; i >= 0; i--) { const f = i / 6 * 2 - 1, j = (i % 2 ? 0.45 : 1) * w; pts.push(x + ux * len * f + uy * j, y + uy * len * f - ux * j); }
            g.top.poly(pts).fill({ color: 0x8a1220, alpha: 0.95 * fade });
            g.add.poly(pts.map((v, i) => (i % 2 ? y + (v - y) * 0.55 : x + (v - x) * 0.55))).fill({ color: 0xff3040, alpha: 0.9 * fade * flick });
          }
        });
        pebbles(x - c * 26, groundY + 6, 5, 40, [120, 118, 116], 1.6);
        addDecal({ x: x - c * 26, y: groundY + 8, kind: 'crack', radius: 12, pal: 'earth', life: 1.8 });
        dizzy(x, y, 0.4);
      }
    },

    // ------------------------------------------------------------------ Brick Break
    brickBreak: {
      cast({ follow, windup = 0.25 }) {
        // A small orange-white light sits over the raised hand as the body rises.
        live(Math.max(0.12, windup) + 0.12, (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const yy = at.y - 50 - 38 * Math.min(1, t * 1.4);
          g.add.circle(at.x + 6, yy, 11).fill({ color: 0xff9a2c, alpha: 0.75 }); g.add.circle(at.x + 6, yy, 6).fill({ color: 0xffffff, alpha: 0.95 });
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        whiteBloom(x, y, 26, 56, 0.12);
        const seed = rand() * 10, c = Math.cos(angle) >= 0 ? 1 : -1;
        // A white web of cracks holds on the target, a pale ring spreads on the ground, then it all bursts into shards.
        live(0.34, (h, t, dt, g) => {
          const grow = Math.min(1, t / 0.18);
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU + Math.sin(seed + i * 2.3) * 0.22, r = (58 + 16 * Math.sin(seed * 2 + i)) * grow;
            const mx = x + Math.cos(a + 0.12) * r * 0.55, my = y + Math.sin(a + 0.12) * r * 0.5;
            g.top.poly([x, y, mx - 1.5, my - 1.5, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, mx + 1.5, my + 1.5]).fill({ color: 0xffffff, alpha: 0.95 });
          }
          for (const rr of [24, 46]) { const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + Math.sin(seed + i * 2.3) * 0.22; pts.push(x + Math.cos(a) * rr * grow, y + Math.sin(a) * rr * 0.9 * grow); } g.top.poly(pts).stroke({ color: 0xffffff, width: 2, alpha: 0.9 }); }
          groundRing(g.top, x, groundY + 4, 30 + 78 * t, 0xe8f0ff, 0.7 * (1 - t), 2);
          if (t > 0.86 && !h.burst) {
            h.burst = true;
            for (let i = 0; i < 18; i++) { const a = rand() * TAU, spd = 260 + rand() * 300; spawnP({ shape: 'shard', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 12, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.8, vz: 60 + rand() * 80, gravity: 300, drag: 0.93, size: 8 + rand() * 5, size1: 3, rot: a, vrot: (rand() - 0.5) * 12, stops: [[0, [255, 255, 255], 1], [0.5, [206, 228, 255], 0.9], [1, [176, 206, 255], 0]], add: false, life: 0.45 + rand() * 0.15 }); }
          }
        });
        // Black cracks and a patch of earth stay between the two bodies.
        addDecal({ x: x - c * 30, y: groundY + 8, kind: 'crack', radius: 54, pal: 'earth', life: 6 });
        pebbles(x - c * 30, groundY + 8, 10, 70, [104, 78, 56], 5.5);
      }
    },

    // ------------------------------------------------------------------ Low Kick
    lowKick: {
      hit({ x, y, groundY }) {
        whiteBloom(x, groundY - 8, 14, 34, 0.12);
        // A pale purple sweep mark lies under the target's feet, open side up.
        live(0.22, (h, t, dt, g) => {
          const fade = 1 - t, pts = [], inner = [];
          for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); pts.push(x + Math.cos(a) * 54, groundY + 2 + Math.sin(a) * 15); inner.unshift(x + Math.cos(a) * 54, groundY + 2 + Math.sin(a) * 7); }
          g.top.poly([...pts, ...inner]).fill({ color: 0xc8a8ff, alpha: 0.9 * fade });
        });
        dizzy(x, y, 0.55);
      }
    },

    // ------------------------------------------------------------------ Aerial Ace
    aerialAce: {
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        // White wind lines streak past the silhouette.
        live(0.6, (h, t, dt) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.014) { h.acc -= 0.014; const off = (rand() - 0.5) * 50; spawnP({ shape: 'streak', x: at.x - s * off - c * 10, y: at.y + c * off * 0.6, vx: -c * 160, vy: -s * 160, size: 9, size1: 1, stretch: 3, rot: angle + Math.PI, stops: [[0, [255, 255, 255], 1], [1, [200, 220, 255], 0]], add: true, life: 0.12 + rand() * 0.06 }); }
        });
      },
      hit({ x, y, groundY }) {
        whiteBloom(x, y, 40, 86, 0.2);
        // One thin white cut stands through the target, top to bottom.
        live(0.26, (h, t, dt, g) => {
          const fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
          g.add.rect(x - 2, groundY - 104, 4, 124).fill({ color: 0xffffff, alpha: 0.95 * fade });
          g.top.rect(x - 4.5, groundY - 96, 9, 108).fill({ color: 0xd8e6ff, alpha: 0.35 * fade });
        });
        sparks(x, y, 0, 8, 'wind', 220, 6.2);
      }
    },

    // ------------------------------------------------------------------ Flame Charge
    flameCharge: {
      cast({ follow, angle = 0, windup = 0.35 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        live(Math.max(0.12, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          // A ring under the feet for the whole charge.
          groundRing(g.top, at.x, at.footY + 2, 24 + 5 * t, FIRE.main, 0.9);
          groundRing(g.top, at.x, at.footY + 2, 15 + 4 * t, FIRE.hot, 0.6, 2);
          // Flame lines whip backward around the body, more of them as it builds.
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.024) {
            h.acc -= 0.024;
            const off = (rand() - 0.5) * 46;
            spawnP({ shape: 'streak', x: at.x - s * off + c * 10, y: at.y + c * off * 0.6 + (rand() - 0.5) * 30, vx: -c * (240 + rand() * 120), vy: -s * (240 + rand() * 120),
              size: 7 + 4 * t, size1: 1, stretch: 2.6, rot: angle + Math.PI, pal: 'fire', add: true, life: 0.13 + rand() * 0.06 });
          }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        live(0.7, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          // The comet head: a pointed flame wedge ahead of the body, a hot wedge inside it.
          const nx = -s, ny = c;
          const tipX = at.x + c * 40, tipY = at.y + s * 40, backX = at.x - c * 22, backY = at.y - s * 22;
          g.top.poly([tipX, tipY, at.x + nx * 22, at.y + ny * 22, backX + nx * 13, backY + ny * 13, backX - nx * 13, backY - ny * 13, at.x - nx * 22, at.y - ny * 22])
            .fill({ color: FIRE.main, alpha: 0.86 });
          g.add.poly([at.x + c * 30, at.y + s * 30, at.x + nx * 12, at.y + ny * 12, at.x - c * 8, at.y - s * 8, at.x - nx * 12, at.y - ny * 12])
            .fill({ color: FIRE.hot, alpha: 0.75 });
          // Long fire lines behind it and a dashed scorch on the ground under it.
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.016) {
            h.acc -= 0.016;
            const off = (rand() - 0.5) * 34;
            spawnP({ shape: 'streak', x: at.x + nx * off - c * 16, y: at.y + ny * off - s * 16, vx: -c * 90, vy: -s * 90, size: 9, size1: 1, stretch: 3.2, rot: angle + Math.PI,
              pal: 'fire', add: true, life: 0.2 + rand() * 0.1 });
          }
          h.track = (h.track ?? 0) + dt;
          if (h.track >= 0.035) { h.track = 0; if ((h.dash = !h.dash)) scorchDash(at.x - c * 10, at.footY + 3); }
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        spawnP({ shape: 'glow', x, y, size: 20, size1: 46, pal: 'fire', add: true, life: 0.16, alphaMul: 0.95 });
        for (let i = 0; i < 9; i++) ember(x, y, Math.cos(angle + (rand() - 0.5) * 2.4) * (140 + rand() * 160), Math.sin(angle + (rand() - 0.5) * 2.4) * 110 - 60, 4.5, 0.3);
        // Fire stands on the struck body for a moment; two flat rings spread on the ground under it.
        live(0.55, (h, t, dt, g) => {
          const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
          groundRing(g.top, x, groundY + 4, 16 + 44 * t, FIRE.main, 0.85 * (1 - t), 3);
          groundRing(g.top, x, groundY + 4, 8 + 30 * t, FIRE.hot, 0.7 * (1 - t), 2);
          const flick = Math.sin(h.age * 38 + h.seed);
          flameSpike(g.top, x - 9, groundY - 4, (30 + 5 * flick) * fade, 8, FIRE.main, 0.9 * fade, 2 * flick);
          flameSpike(g.top, x + 8, groundY - 2, (24 - 4 * flick) * fade, 7, FIRE.deep, 0.9 * fade, -2 * flick);
          flameSpike(g.add, x - 8, groundY - 4, (17 + 3 * flick) * fade, 4, FIRE.hot, 0.8 * fade, flick);
        });
        addDecal({ x, y: groundY + 6, kind: 'scorch', radius: 26, pal: 'fire' });
      }
    },

    // ------------------------------------------------------------------ Flame Wheel
    flameWheel: {
      cast({ follow, windup = 0.27 }) {
        // The back lights up while it drops low: a few embers rise off it.
        live(Math.max(0.12, windup), (h, t, dt) => {
          const at = follow?.(); if (!at) return;
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.05) { h.acc -= 0.05; ember(at.x + (rand() - 0.5) * 16, at.y - 4, (rand() - 0.5) * 30, -70 - rand() * 50, 4, 0.28); }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        live(0.8, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          // The body is the fireball: a spinning wheel of flame petals round a white-yellow core.
          const spin = h.age * 26 * (c >= 0 ? 1 : -1);
          for (let i = 0; i < 5; i++) {
            const a = spin + (i / 5) * TAU;
            const px0 = at.x + Math.cos(a) * 26, py0 = at.y + Math.sin(a) * 26;
            g.top.poly([at.x + Math.cos(a - 0.5) * 22, at.y + Math.sin(a - 0.5) * 22, px0 + Math.cos(a + 0.9) * 26, py0 + Math.sin(a + 0.9) * 26,
              at.x + Math.cos(a + 0.75) * 22, at.y + Math.sin(a + 0.75) * 22]).fill({ color: i % 2 ? FIRE.deep : FIRE.main, alpha: 0.95 });
          }
          g.top.circle(at.x, at.y, 29).fill({ color: FIRE.main, alpha: 0.98 });
          g.top.circle(at.x, at.y, 21).fill({ color: FIRE.hot, alpha: 0.98 });
          g.add.circle(at.x, at.y, 12).fill({ color: FIRE.white, alpha: 0.95 });
          // Square embers scatter behind it; a dashed scorch runs along the ground.
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.02) {
            h.acc -= 0.02;
            ember(at.x - c * 14 + (rand() - 0.5) * 18, at.y - s * 14 + (rand() - 0.5) * 22, -c * (30 + rand() * 60), -s * 40 - 20 - rand() * 40, 4 + rand() * 2, 0.34);
          }
          h.track = (h.track ?? 0) + dt;
          if (h.track >= 0.03) { h.track = 0; if ((h.dash = !h.dash)) scorchDash(at.x - c * 8, at.footY + 3); }
        });
      },
      hit({ x, y, angle = 0 }) {
        // One large soft white bloom on the struck body, then sparks.
        spawnP({ shape: 'glow', x, y, size: 34, size1: 70, stops: [[0, [255, 255, 255], 1], [1, [255, 244, 210], 0]], add: true, life: 0.2, alphaMul: 1 });
        spawnP({ shape: 'glow', x, y, size: 16, size1: 40, pal: 'fire', add: true, life: 0.26, alphaMul: 0.8 });
        for (let i = 0; i < 10; i++) ember(x, y, Math.cos(angle + (rand() - 0.5) * 3) * (120 + rand() * 170), Math.sin(angle + (rand() - 0.5) * 3) * 120 - 70, 4.5, 0.34);
      }
    },

    // ------------------------------------------------------------------ Fire Fang
    fireFang: {
      cast({ follow, angle = 0, windup = 0.3 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        // Fire gathers at the mouth while it rears back.
        live(Math.max(0.12, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const mx = at.x + c * 16, my = at.y - 6 + s * 10;
          g.add.circle(mx, my, 5 + 7 * t).fill({ color: FIRE.main, alpha: 0.75 });
          g.add.circle(mx, my, 2 + 4 * t).fill({ color: FIRE.white, alpha: 0.9 });
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        // A band of fire is left along the lunge: it stays where the body passed and burns down to dark red.
        live(0.6, (h, t, dt) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.012) {
            h.acc -= 0.012;
            spawnP({ shape: 'streak', x: at.x - c * 8 + (rand() - 0.5) * 6, y: at.y - s * 8 + (rand() - 0.5) * 20, vx: -c * 26, vy: -s * 26 - 8, size: 10, size1: 2, stretch: 2.4,
              rot: angle + Math.PI, pal: 'fire', add: true, life: 0.26 + rand() * 0.1 });
            if (rand() < 0.5) ember(at.x - c * 10, at.y + (rand() - 0.5) * 22, -c * 20, -30 - rand() * 30, 4, 0.36);
          }
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        spawnP({ shape: 'glow', x, y, size: 22, size1: 50, stops: [[0, [255, 255, 255], 1], [0.5, [255, 200, 110], 0.8], [1, [255, 138, 28], 0]], add: true, life: 0.16 });
        for (let i = 0; i < 6; i++) spawnP({ shape: 'px', x: x + (rand() - 0.5) * 30, y: groundY + 2, vx: (rand() - 0.5) * 90, vy: -20 - rand() * 30, vz: 60 + rand() * 60, gravity: 380,
          size: 4, size1: 3, pal: 'fire', add: true, life: 0.5, drag: 0.94 });
        // Jagged pillars of fire stand up on the bitten body and burn for half a second.
        live(0.6, (h, t, dt, g) => {
          const grow = Math.min(1, t / 0.18), fade = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
          const flick = Math.sin(h.age * 34 + h.seed), k = grow * fade;
          flameSpike(g.top, x - 11, groundY - 2, (36 + 5 * flick) * k, 8, FIRE.deep, 0.92 * fade, 3 * flick);
          flameSpike(g.top, x + 2, groundY - 2, (46 - 4 * flick) * k, 9, FIRE.main, 0.94 * fade, -2 * flick);
          flameSpike(g.top, x + 13, groundY - 2, (30 + 4 * flick) * k, 7, FIRE.deep, 0.92 * fade, 2 * flick);
          flameSpike(g.add, x + 2, groundY - 2, (28 - 3 * flick) * k, 5, FIRE.hot, 0.85 * fade, -flick);
          flameSpike(g.add, x - 10, groundY - 2, (20 + 3 * flick) * k, 4, FIRE.hot, 0.8 * fade, flick);
        });
        addDecal({ x, y: groundY + 6, kind: 'scorch', radius: 22, pal: 'fire' });
      }
    }
  });
}
