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

/** Body cues per move id (the scene reads these; all optional). */
export const PB_MOVE_BODY = Object.freeze({
  // Flame Charge: the whole body turns fire-red and shivers through the charge, then stays lit on the dash.
  'pb-098': Object.freeze({ key: 'flameCharge', windupTint: 0xff5a2a, windupShake: 1.6, dashTint: 0xff7a3a, impactFrame: true }),
  // Flame Wheel: drops low, becomes the fireball (its sprite is hidden on the roll), bounces up off the target.
  'pb-099': Object.freeze({ key: 'flameWheel', windupCrouch: 0.26, dashHide: true, afterHop: 42 }),
  // Fire Fang: rears back with fire in the mouth, lunges low, recoils a step.
  'pb-094': Object.freeze({ key: 'fireFang', windupLean: 0.3, dashLow: 0.16 })
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

  return Object.freeze({
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
