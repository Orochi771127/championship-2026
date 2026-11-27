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
 *   ready  {lean, low, hop, tint}  -- standing at the target while the blow winds up (strikeDelay)
 *   combo  {jab (px forward on each strike), lean, low}  -- while a multi-hit blow keeps striking
 *   strike {lean, low, tint, lift (held in the air on the target), hold (seconds held at the contact point)}
 *   after  {hop (height), time, spin (turns)}  -- lets go of the contact point and hops back to where the rules put it
 *   target {topple (seconds tripped on its side)} or {lift: {height, up, hang, down}} (carried up and dropped)
 *   dim: seconds the scene stays dimmed after the windup;
 *   impactFrame: the ink impact frame on its hit (true, or 'first' / 'final' strike of a multi-hit blow);
 *   impactStyle: 'white' (white field, black lines; default), 'black', or two in a row ['white', 'black'];
 *   fireballHop: the fireball keeps the body through its rebound.
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
  'pb-042': { key: 'crossChop', windup: { crouch: 0.12 }, dash: { arc: 74 }, strike: { lean: 0.3, low: 0.08, hold: 0.35 } },
  // Brick Break: hops with a glowing hand raised, brings the chop down from that height, stays pressed.
  'pb-029': { key: 'brickBreak', windup: { hop: 38 }, strike: { lean: 0.34, low: 0.12, hold: 0.4 }, impactFrame: true },
  // Low Kick: drops almost flat, slides in along the ground, sweeps and rises slowly.
  'pb-167': { key: 'lowKick', windup: { crouch: 0.38, lean: -0.5 }, dash: { low: 0.45, lean: 0.5 }, strike: { low: 0.36, lean: 0.3, hold: 0.2 }, target: { topple: 0.5 } },
  // Close Combat: one big step in, feet planted, arms jab in turn seven times, then one heavy blow.
  'pb-037': { key: 'closeCombat', windup: { crouch: 0.06 }, combo: { jab: 13, lean: 0.16 }, strike: { lean: -0.12, hold: 0.16 }, impactFrame: 'final' },
  // Double Kick: springs straight up, dives foot first onto the target, crouches and kicks again from the ground.
  'pb-057': { key: 'doubleKick', windup: { crouch: 0.1, hop: 110 }, dash: { lean: 0.5 }, combo: { jab: 16, low: 0.2 }, strike: { low: 0.22, hold: 0.2 }, impactFrame: 'first' },
  // High Jump Kick: crouch, straight up three bodies, dives knee first, stays pressed in the air, bounces back.
  'pb-135': { key: 'highJumpKick', windup: { crouch: 0.15, hop: 210, tint: 0xffb050 }, dash: { lean: 0.6, tint: 0xffa040 }, strike: { lift: 34, lean: 0.5, tint: 0xffa040, hold: 0.35 }, after: { hop: 40, time: 0.25 } },
  // Sky Uppercut: low run, crouch, then spins straight up three bodies with the target carried on the fist.
  'pb-257': { key: 'skyUppercut', windup: { crouch: 0.3 }, dash: { low: 0.3 }, after: { hop: 200, time: 0.75, spin: 2 }, target: { lift: { height: 160, up: 0.4, hang: 0.1, down: 0.25 } }, impactFrame: true, impactStyle: 'black' },
  // Thunderous Kick: runs in, hops with the leg drawn back, stomps and pins, then shoves with the same leg.
  'pb-301': { key: 'thunderousKick', ready: { lean: 0.25, hop: 26 }, combo: { jab: 22, lean: 0.3 }, strike: { hold: 0.12 }, impactFrame: 'first' },
  // Dynamic Punch: walks in with the fist burning, one punch, stands in the blast.
  'pb-076': { key: 'dynamicPunch', strike: { lean: 0.3, hold: 0.5 }, impactFrame: true, dim: 0.9 },
  // Focus Punch: bent low and still for 0.7 s, then a flat-out lunge with the body level.
  'pb-109': { key: 'focusPunch', windup: { crouch: 0.25, lean: -0.3, shake: 1 }, dash: { lean: 0.9, low: 0.2 }, strike: { lean: 0.9, low: 0.2, hold: 0.3 }, impactFrame: true, impactStyle: ['white', 'black'] },
  // Drain Punch: straight dash and a pressed punch, then stands and takes the energy back.
  'pb-069': { key: 'drainPunch', dash: { lean: 0.4 }, strike: { lean: 0.35, low: 0.1, hold: 0.3 }, impactFrame: true, impactStyle: 'black' },
  // Force Palm: slides in along the ground with pale-blue mist and holds the flat palm on the target.
  'pb-111': { key: 'forcePalm', windup: { crouch: 0.12 }, dash: { low: 0.15, afterimage: 0x7cb8ff }, strike: { lean: 0.32, low: 0.08, hold: 0.3 }, impactFrame: true, impactStyle: 'black' },
  // Hammer Arm: the body only walks in and crouches; the giant arm does the hitting.
  'pb-126': { key: 'hammerArm', ready: { low: 0.12 }, strike: { low: 0.25, hold: 0.35 }, impactFrame: true, impactStyle: 'black' },
  // ---- flying
  // Aerial Ace: a dark-blue silhouette that cuts straight through the target and lands flat on its far side.
  'pb-003': { key: 'aerialAce', windup: { crouch: 0.2, tint: 0x2a3a8c }, dash: { tint: 0x2a3a8c, lean: 0.4 }, strike: { lean: 1.15, low: 0.2, hold: 0.28 }, after: { hop: 22, time: 0.16 }, impactFrame: true, impactStyle: 'black' }
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
  const pebbles = (x, y, count, spread, rgb = [112, 90, 70], life = 3.2, big = 5) => {
    const stops = [[0, rgb, 0.95], [0.8, rgb, 0.85], [1, rgb, 0]];
    for (let i = 0; i < count; i++) { const sz = 3 + rand() * big; spawnP({ shape: 'px', x: x + (rand() - 0.5) * spread, y: y + (rand() - 0.5) * spread * 0.4, size: sz, size1: sz, stops, add: false, life: life * (0.7 + rand() * 0.5), drag: 1 }); }
  };
  const whiteBloom = (x, y, from, to, life = 0.18) => spawnP({ shape: 'glow', x, y, size: from * 0.8, size1: to * 0.8, stops: [[0, [255, 255, 255], 0.95], [0.6, [255, 255, 255], 0.7], [1, [255, 255, 255], 0]], add: false, life });
  const sparks = (x, y, angle, count, pal, speed = 260, spread = 2.2) => {
    for (let i = 0; i < count; i++) { const a = angle + (rand() - 0.5) * spread; spawnP({ shape: 'streak', x, y, vx: Math.cos(a) * (speed * (0.6 + rand() * 0.7)), vy: Math.sin(a) * speed * 0.6 - 30, size: 5, size1: 1, rot: a, pal, add: true, life: 0.2 + rand() * 0.1 }); }
  };

  // A streak trail in one flat colour behind a moving body (the reference blurs a dash in the move's own colour).
  const trail = (follow, angle, rgb, { life = 0.6, every = 0.014, spread = 30, size = 9 } = {}) => {
    const c = Math.cos(angle), s = Math.sin(angle), stops = [[0, rgb, 0.95], [1, rgb, 0]];
    live(life, (h, t, dt) => {
      const at = follow?.(); if (!at) { h.age = h.life; return; }
      h.acc = (h.acc ?? 0) + dt;
      while (h.acc >= every) { h.acc -= every; const off = (rand() - 0.5) * spread; spawnP({ shape: 'streak', x: at.x - s * off - c * 8, y: at.y + c * off * 0.6 + (rand() - 0.5) * 12, vx: -c * 110, vy: -s * 110, size, size1: 1, stretch: 2.8, rot: angle + Math.PI, stops, add: true, life: 0.14 + rand() * 0.08 }); }
    });
  };
  // A comet tail: a tapering wedge of flame drawn behind a body along the way it is really moving.
  const comet = (follow, outer, inner, { life = 0.6, long = 150, wide = 26 } = {}) => live(life, (h, t, dt, g) => {
    const at = follow?.(); if (!at) { h.age = h.life; return; }
    if (h.px !== undefined) { const dx = at.x - h.px, dy = at.y - h.py, d = Math.hypot(dx, dy); if (d > 0.5) { h.ux = dx / d; h.uy = dy / d; } }
    h.px = at.x; h.py = at.y;
    if (h.ux === undefined) return;
    const nx = -h.uy, ny = h.ux, flick = 0.9 + 0.1 * Math.sin(h.age * 50), tx = at.x - h.ux * long * flick, ty = at.y - h.uy * long * flick;
    g.top.poly([at.x + nx * wide, at.y + ny * wide, at.x + h.ux * wide * 0.8, at.y + h.uy * wide * 0.8, at.x - nx * wide, at.y - ny * wide, tx, ty]).fill({ color: outer, alpha: 0.88 });
    g.add.poly([at.x + nx * wide * 0.5, at.y + ny * wide * 0.5, at.x - nx * wide * 0.5, at.y - ny * wide * 0.5, at.x - h.ux * long * 0.6, at.y - h.uy * long * 0.6]).fill({ color: inner, alpha: 0.85 });
  });
  // Puffs of dust or dirt kicked off the ground.
  const dust = (x, y, count, rgb = [176, 150, 118], speed = 70) => {
    const stops = [[0, rgb, 0.85], [0.6, rgb, 0.6], [1, rgb, 0]];
    for (let i = 0; i < count; i++) { const a = rand() * TAU; spawnP({ shape: 'pxpuff', x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 4, vx: Math.cos(a) * speed * (0.5 + rand()), vy: Math.sin(a) * speed * 0.4 - 22, size: 6 + rand() * 4, size1: 11 + rand() * 5, stops, add: false, drag: 0.9, life: 0.32 + rand() * 0.2 }); }
  };
  // A crescent slash: a curved blade of one colour, `tall` px high, bulging toward +dir.
  const crescent = (g, x, y, tall, dir, color, alpha, thick = 15) => {
    if (!g || alpha <= 0.02) return;
    const pts = [], inner = [];
    for (let i = 0; i <= 9; i++) { const a = (i / 9 - 0.5) * 2.4, r = tall * 0.5; pts.push(x + dir * Math.cos(a) * r * 0.78, y + Math.sin(a) * r); inner.unshift(x + dir * (Math.cos(a) * r * 0.78 - thick * Math.cos(a * 1.3)), y + Math.sin(a) * r); }
    g.poly([...pts, ...inner]).fill({ color, alpha });
  };
  // A jagged many-pointed burst.
  const spiky = (g, x, y, r, points, color, alpha, seed = 0) => {
    if (!g || alpha <= 0.02) return;
    const pts = [];
    for (let i = 0; i < points * 2; i++) { const a = (i / (points * 2)) * TAU + seed, rr = i % 2 ? r * (0.42 + 0.12 * Math.sin(seed * 3 + i)) : r * (0.85 + 0.2 * Math.sin(seed * 5 + i * 1.7)); pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92); }
    g.poly(pts).fill({ color, alpha });
  };

  return Object.freeze({
    // ------------------------------------------------------------------ Mach Punch
    machPunch: {
      cast({ follow }) { const at = follow?.(); if (at) dust(at.x, at.footY, 3, [190, 176, 150], 50); },
      release({ follow, angle = 0 }) {
        const s = Math.sin(angle), c = Math.cos(angle), nx = -s, ny = c;
        // The body is a line of light from where it stood to where it is; it is gone 0.1 s after it arrives.
        live(0.6, (h, t, dt, g) => {
          const at = follow?.();
          if (at) { h.last = at; h.start ??= at; } else if (h.endedAt === undefined) h.endedAt = h.age;
          if (!h.start || !h.last) return;
          const fade = h.endedAt === undefined ? 1 : 1 - (h.age - h.endedAt) / 0.12;
          if (fade <= 0) { h.age = h.life; return; }
          const band = (g2, half, color, alpha) => g2.poly([h.start.x + nx * half, h.start.y + ny * half, h.last.x + nx * half, h.last.y + ny * half,
            h.last.x - nx * half, h.last.y - ny * half, h.start.x - nx * half, h.start.y - ny * half]).fill({ color, alpha });
          band(g.top, 10, 0x9ee8a0, 0.8 * fade); band(g.add, 4.5, 0xffffff, 0.95 * fade);
          g.top.circle(h.start.x, h.start.y, 18 * fade).fill({ color: 0x9ee8a0, alpha: 0.5 * fade });
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        whiteBloom(x, y, 34, 72, 0.16);
        // Three quick jets of orange sparks out of the target's back, a pale glow on the ground under it.
        live(0.24, (h, t, dt, g) => {
          g.add.ellipse(x, groundY + 4, 40, 13).fill({ color: 0xffffff, alpha: 0.5 * (1 - t) });
          star4(g.add, x, y, 30 * (1 - t * 0.5), 0xffb040, 1 - t);
          const pulse = Math.min(2, Math.floor(h.age / 0.07));
          if (pulse !== h.pulse) {
            h.pulse = pulse; const bx = x + Math.cos(angle) * 22, by = y + Math.sin(angle) * 14;
            for (let i = 0; i < 8; i++) { const a = angle + (rand() - 0.5) * 0.5; spawnP({ shape: 'streak', x: bx, y: by, vx: Math.cos(a) * (340 + rand() * 300), vy: Math.sin(a) * (340 + rand() * 300), size: 7, size1: 1, stretch: 2.6, rot: a, pal: 'fire', add: true, life: 0.2 + rand() * 0.08 }); }
          }
        });
        dizzy(x, y, 0.4);
      }
    },

    // ------------------------------------------------------------------ Close Combat
    closeCombat: {
      release({ follow, angle = 0 }) { trail(follow, angle, [255, 150, 200], { life: 0.3, spread: 26 }); },
      hit({ x, y, groundY, angle = 0, hitIndex = 0, final = false }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        if (!final) {
          const yy = y + ((hitIndex ?? 0) % 2 ? -12 : 10);
          // Each jab: a pink lance thrust from the striker into the body, a green cut flickers on the target.
          live(0.11, (h, t, dt, g) => {
            const k = 1 - t;
            g.top.poly([x - c * 82, yy - 5, x + c * 6, yy - 2, x + c * 14, yy, x + c * 6, yy + 2, x - c * 82, yy + 5]).fill({ color: 0xff8ac0, alpha: 0.9 * k });
            g.add.poly([x - c * 70, yy - 2, x + c * 10, yy, x - c * 70, yy + 2]).fill({ color: 0xffffff, alpha: 0.9 * k });
            crescent(g.add, x + c * 6, yy, 40, c, 0x8affc8, 0.85 * k, 8);
          });
          whiteBloom(x, yy, 10, 28, 0.09);
          // The last jab before the heavy blow: a pale teal glow gathers at the striker's feet.
          if (hitIndex === 6) live(0.45, (h, t, dt, g) => { g.add.ellipse(x - c * 84, groundY + 2, 34 + 10 * t, 13).fill({ color: 0xb8fff0, alpha: 0.6 * Math.min(1, t * 3) }); });
          return;
        }
        // The heavy blow: a tall cyan-green crescent through the target, a band of force behind it, a ring on the ground.
        live(0.3, (h, t, dt, g) => {
          const fade = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
          g.add.poly([x - c * 120, y - 9, x + c * 10, y - 15, x + c * 10, y + 15, x - c * 120, y + 9]).fill({ color: 0xc8fff2, alpha: 0.7 * (1 - t) });
          crescent(g.top, x + c * 4, y - 4, 112, c, 0x58e8b8, 0.95 * fade, 20);
          crescent(g.add, x + c * 2, y - 4, 92, c, 0xeafff6, 0.9 * fade, 9);
          groundRing(g.top, x, groundY + 4, 26 + 60 * t, 0x58e8b8, 0.85 * (1 - t), 3);
        });
        spawnP({ shape: 'glow', x, y, size: 40, size1: 150, stops: [[0, [255, 255, 255], 1], [0.4, [190, 255, 240], 0.85], [1, [150, 240, 225], 0]], add: true, life: 0.3 });
        sparks(x, y, angle, 10, 'wind', 320, 1.6);
      }
    },

    // ------------------------------------------------------------------ Double Kick
    doubleKick: {
      cast({ follow, windup = 0.35 }) {
        // A small blue whirl at the feet, then a blue crescent streak where it left the ground.
        live(Math.max(0.2, windup) + 0.1, (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          if (t < 0.4) groundRing(g.top, at.x, at.footY + 2, 12 + 10 * (t / 0.4), 0x8ab8ff, 0.8, 2);
          else { const k = (t - 0.4) / 0.6; crescent(g.top, at.x, at.footY - 34, 70, -1, 0x8ab8ff, 0.7 * (1 - k), 10); }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        trail(follow, angle, [150, 190, 255], { life: 0.5, spread: 24 });
        // Orange fire on the leading foot all the way down, with a short flame tail.
        live(0.6, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const fx = at.x + c * 20, fy = at.y + 22;
          g.top.poly([fx + c * 12, fy + 6, fx - c * 4, fy - 12, fx - c * 30, fy - 22, fx - c * 10, fy + 4]).fill({ color: 0xff8a1c, alpha: 0.9 });
          g.add.circle(fx + c * 3, fy, 7).fill({ color: 0xffe9a0, alpha: 0.95 });
        });
      },
      hit({ x, y, groundY, angle = 0, hitIndex = 0 }) {
        const second = hitIndex === 1, c = Math.cos(angle) >= 0 ? 1 : -1;
        whiteBloom(x, y, second ? 16 : 26, second ? 44 : 60, 0.12);
        if (second) { live(0.2, (h, t, dt, g) => { star4(g.add, x, y, 34 * (1 - t * 0.4), 0xff9a2c, 1 - t); }); sparks(x, y, angle, 9, 'fire', 300, 1.4); dust(x, groundY + 2, 4); return; }
        // The stomp: four quick orange starbursts on the body, cracks and pebbles where it landed.
        live(0.36, (h, t, dt, g) => {
          const n = Math.min(3, Math.floor(h.age / 0.085)), k = (h.age % 0.085) / 0.085;
          const ox = [0, 12, -8, 6][n] * c, oy = [0, -12, 8, -4][n];
          star4(g.add, x + ox, y + oy, 36 * (1 - k * 0.5), n % 2 ? 0xff9a2c : 0xfff0d0, 1 - k * 0.7); star4(g.add, x + ox, y + oy, 15, 0xffffff, 1 - k);
        });
        addDecal({ x: x - c * 34, y: groundY + 8, kind: 'crack', radius: 26, pal: 'earth', life: 3 }); pebbles(x - c * 34, groundY + 8, 6, 50, [112, 90, 70], 2.4); dust(x - c * 30, groundY + 2, 4); dizzy(x, y, 0.6);
      }
    },

    // ------------------------------------------------------------------ High Jump Kick
    highJumpKick: {
      cast({ follow, windup = 0.5 }) {
        // An orange rim on the crouched body; a burst of grey-brown dust where it leaves the ground.
        live(Math.max(0.2, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          if (t < 0.4) g.add.ellipse(at.x, at.y + 4, 26, 34).stroke({ color: 0xff9a2c, width: 3, alpha: 0.7 * (t / 0.4) });
          else if (!h.dusted) { h.dusted = true; dust(at.x, at.footY, 9, [150, 132, 110], 120); addDecal({ x: at.x, y: at.footY + 6, kind: 'crack', radius: 16, pal: 'earth', life: 6 }); }
        });
      },
      release({ follow }) { comet(follow, 0xff8a1c, 0xffe9a0, { life: 0.6, long: 150, wide: 24 }); },
      hit({ x, y, groundY }) {
        // The screen round the target blows out white and holds; an orange starburst on the knee; dust on the target.
        live(0.3, (h, t, dt, g) => { const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; g.add.circle(x, y, 82).fill({ color: 0xffffff, alpha: 0.28 * fade }); g.add.circle(x, y, 48).fill({ color: 0xffffff, alpha: 0.34 * fade }); });
        live(0.5, (h, t, dt, g) => { const beat = 0.75 + 0.25 * Math.abs(Math.sin(h.age * 26)); spiky(g.top, x, y, 58 * beat, 9, 0xff8a1c, 1 - t * 0.6, h.seed + Math.floor(h.age / 0.1)); spiky(g.add, x, y, 30 * beat, 9, 0xffe9a0, 1 - t, h.seed + 0.5); });
        dust(x, groundY, 7, [150, 124, 100], 90);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 54, pal: 'earth', life: 6 });
        pebbles(x, groundY + 8, 8, 90, [120, 104, 88], 4);
        dizzy(x, y, 0.6);
      }
    },

    // ------------------------------------------------------------------ Sky Uppercut
    skyUppercut: {
      cast({ follow }) { live(0.12, (h, t, dt, g) => { const at = follow?.(); if (at) { g.add.circle(at.x + 10, at.y + 14, 9).fill({ color: 0xff9a2c, alpha: 0.8 }); g.add.circle(at.x + 10, at.y + 14, 4.5).fill({ color: 0xffffff, alpha: 0.95 }); } }); },
      release({ follow, angle = 0 }) {
        live(0.5, (h, t, dt) => { const at = follow?.(); if (!at) { h.age = h.life; return; } h.acc = (h.acc ?? 0) + dt; while (h.acc >= 0.05) { h.acc -= 0.05; dust(at.x - Math.cos(angle) * 14, at.footY, 1, [226, 150, 90], 40); } });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1, px0 = x - c * 44;
        whiteBloom(x, y, 24, 54, 0.12);
        // A coiling pillar of orange flame climbs under the rising body, then lets go from the bottom up.
        live(0.75, (h, t, dt, g) => {
          const top = 216 * Math.min(1, t / 0.55), base = t > 0.6 ? 216 * (t - 0.6) / 0.4 : 0, fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          for (let yy = base; yy < top; yy += 9) {
            const wob = Math.sin(yy * 0.085 + h.age * 22) * 24;
            g.top.poly([px0 + wob - 24, groundY - yy, px0 + wob + 24, groundY - yy - 5, px0 - wob * 0.4 + 20, groundY - yy - 15, px0 - wob * 0.4 - 20, groundY - yy - 10]).fill({ color: (yy / 9) % 2 ? 0xff8a1c : 0xffc44a, alpha: 0.92 * fade });
          }
          if (t > 0.72 && !h.smoke) { h.smoke = true; dust(px0, groundY - 216, 4, [176, 150, 130], 30); }
        });
        // Where the target comes back down: a pale purple ring for a moment.
        live(1.05, (h, t, dt, g) => { if (t > 0.72) { const k = (t - 0.72) / 0.28; groundRing(g.top, x, groundY + 4, 26 + 18 * k, 0xc8b4f0, 0.8 * (1 - k), 3); } });
        dizzy(x, y - 80, 0.7);
      }
    },

    // ------------------------------------------------------------------ Thunderous Kick
    thunderousKick: {
      release({ follow }) { comet(follow, 0xff8a1c, 0xffe9a0, { life: 0.6, long: 140, wide: 22 }); },
      // A swept ring of orange flame turns round a point: three arcs chasing each other.
      sweep(g, x, y, r, spin, alpha) {
        for (let i = 0; i < 3; i++) {
          const a0 = spin + i * 2.094, pts = [];
          for (let j = 0; j <= 7; j++) { const a = a0 + j * 0.2; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5); }
          for (let j = 7; j >= 0; j--) { const a = a0 + j * 0.2; pts.push(x + Math.cos(a) * (r - 12 - j), y + Math.sin(a) * (r - 12 - j) * 0.5); }
          g.top.poly(pts).fill({ color: 0xff8a1c, alpha });
        }
      },
      hit({ x, y, groundY, angle = 0, hitIndex = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        if (hitIndex === 1) {
          // The shove: the leg is one long bar of orange light and the ring sweeps wide.
          live(0.22, (h, t, dt, g) => {
            const fade = 1 - t;
            g.top.poly([x - c * 100, y + 4, x + c * 44, y - 6, x + c * 52, y + 6, x + c * 44, y + 18, x - c * 100, y + 16]).fill({ color: 0xff9a2c, alpha: 0.9 * fade });
            g.add.poly([x - c * 90, y + 8, x + c * 44, y + 6, x - c * 90, y + 12]).fill({ color: 0xfff0d0, alpha: 0.9 * fade });
            this.sweep(g, x - c * 20, groundY - 6, 80 + 30 * t, h.age * 22, 0.9 * fade);
            groundRing(g.top, x, groundY + 4, 60 + 50 * t, 0xf2e8d0, 0.85 * fade, 4);
          });
          dust(x, groundY + 2, 4);
          return;
        }
        whiteBloom(x, y, 22, 52, 0.12);
        // The stomp: an orange burst, a pale ring under the target, then a ring of flame turning round both bodies.
        live(0.34, (h, t, dt, g) => {
          spiky(g.add, x, y, 40 * (1 - t * 0.4), 8, 0xffc060, 1 - t, h.seed); star4(g.add, x, y, 16, 0xffffff, 1 - t);
          groundRing(g.top, x, groundY + 4, 26 + 30 * t, 0xf2e8d0, 0.9 * (1 - t * 0.5), 4);
          if (t > 0.25) this.sweep(g, x - c * 24, groundY - 8, 86, h.age * 22, 0.9 * Math.min(1, (t - 0.25) / 0.2));
        });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Dynamic Punch
    dynamicPunch: {
      cast({ follow, angle = 0 }) { this.aura(follow, angle, 0.2); },
      release({ follow, angle = 0 }) { this.aura(follow, angle, 1.2, true); },
      // A spiky blaze of orange spirit shakes on the raised fist all the way in.
      aura(follow, angle, life, untilEnd = false) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { if (untilEnd) h.age = h.life; return; }
          const fx = at.x + c * 18 + Math.sin(h.age * 70) * 2, fy = at.y - 6 + Math.cos(h.age * 62) * 2;
          spiky(g.top, fx, fy, 26, 7, 0xff8a1c, 0.92, h.age * 9); spiky(g.add, fx, fy, 15, 7, 0xffe9a0, 0.9, h.age * 11 + 1);
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1, bx = x - c * 20;
        // A round fireball stands on the punch for most of half a second, a ring runs out, smoke caps it.
        live(0.62, (h, t, dt, g) => {
          const grow = Math.min(1, t / 0.12), fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3, r = 62 * grow * (1 + 0.04 * Math.sin(h.age * 40));
          g.top.circle(bx, y, r).fill({ color: 0xa82410, alpha: 0.92 * fade });
          g.top.circle(bx, y, r * 0.78).fill({ color: 0xff7a1c, alpha: 0.95 * fade });
          g.add.circle(bx, y, r * 0.45).fill({ color: 0xffd070, alpha: 0.9 * fade });
          groundRing(g.top, bx, groundY + 4, 30 + 80 * Math.min(1, t / 0.6), 0xff8a1c, 0.85 * (1 - Math.min(1, t / 0.6)), 4);
          if (t > 0.74 && !h.smoke) { h.smoke = true; dust(bx, y - 50, 6, [70, 66, 66], 40); for (let i = 0; i < 6; i++) { const a = rand() * TAU; spawnP({ shape: 'px', x: bx, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 160 - 60, vz: 80, gravity: 380, size: 5, size1: 4, stops: [[0, [130, 124, 118], 1], [1, [130, 124, 118], 0]], add: false, life: 0.5 }); } }
        });
        // Confusion: yellow and purple marks circle the struck head.
        live(0.9, (h, t, dt, g) => { for (let i = 0; i < 4; i++) { const a = h.age * 7 + i * 1.571; star4(g.top, x + Math.cos(a) * 18, y - 52 + Math.sin(a) * 6, 5, i % 2 ? 0xffe14a : 0xb478ff, 0.95 * (1 - t * 0.3)); } });
        addDecal({ x: bx, y: groundY + 8, kind: 'scorch', radius: 46, pal: 'fire', life: 6 });
        addDecal({ x: bx, y: groundY + 8, kind: 'crack', radius: 54, pal: 'earth', life: 6 });
        pebbles(bx, groundY + 8, 8, 80, [112, 96, 84], 4);
      }
    },

    // ------------------------------------------------------------------ Focus Punch
    focusPunch: {
      cast({ follow, windup = 0.7 }) {
        // Short orange sparks crowd round the still body, more of them as it focuses; the ground lights white at the end.
        live(Math.max(0.2, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          h.acc = (h.acc ?? 0) + dt; const every = 0.09 - 0.07 * t;
          while (h.acc >= every) { h.acc -= every; const a = rand() * TAU; spawnP({ shape: 'streak', x: at.x + Math.cos(a) * 34, y: at.y + Math.sin(a) * 30, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60 - 20, size: 6, size1: 1, rot: a, pal: 'fire', add: true, life: 0.2 }); }
          if (t > 0.8) g.add.ellipse(at.x, at.footY + 2, 30, 11).fill({ color: 0xffffff, alpha: 0.7 * (t - 0.8) / 0.2 });
          if (!h.mark) { h.mark = true; h.sx = at.x; h.sy = at.footY; }
          if (t > 0.9 && !h.cracked) { h.cracked = true; addDecal({ x: h.sx, y: h.sy + 6, kind: 'crack', radius: 16, pal: 'earth', life: 3.2 }); }
        });
      },
      release({ follow, angle = 0 }) {
        const at = follow?.(); if (at) live(0.2, (h, t, dt, g) => g.top.ellipse(at.x, at.y, 22, 30).fill({ color: 0xfff0a0, alpha: 0.5 * (1 - t) }));
        trail(follow, angle, [255, 236, 150], { life: 0.4, every: 0.01, spread: 30, size: 11 });
      },
      hit({ x, y, groundY, angle = 0 }) {
        live(0.22, (h, t, dt, g) => { g.add.circle(x, y, 74).fill({ color: 0xffffff, alpha: 0.4 * (1 - t) }); g.add.circle(x, y, 44).fill({ color: 0xffffff, alpha: 0.5 * (1 - t) }); });
        live(0.45, (h, t, dt, g) => {
          spiky(g.top, x, y, 66 * (0.6 + 0.4 * Math.min(1, t / 0.2)), 10, 0xff8a1c, 1 - t * 0.7, h.seed); spiky(g.add, x, y, 36, 10, 0xffe9a0, 1 - t, h.seed + 0.5);
          groundRing(g.top, x, groundY + 4, 40 + 76 * t, 0xc8a878, 0.95 * (1 - t), 6);
          groundRing(g.top, x, groundY + 4, 24 + 60 * t, 0xe8d4a8, 0.7 * (1 - t), 3);
          const pulse = Math.min(2, Math.floor(h.age / 0.07));
          if (pulse !== h.pulse) { h.pulse = pulse; const bx = x + Math.cos(angle) * 22, by = y + Math.sin(angle) * 14; for (let i = 0; i < 9; i++) { const a = angle + (rand() - 0.5) * 0.45; spawnP({ shape: 'streak', x: bx, y: by, vx: Math.cos(a) * (460 + rand() * 360), vy: Math.sin(a) * (460 + rand() * 360), size: 8, size1: 1, stretch: 2.8, rot: a, pal: 'fire', add: true, life: 0.22 + rand() * 0.08 }); } }
        });
        pebbles(x, groundY + 8, 5, 60, [120, 110, 100], 1.2);
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Drain Punch
    drainPunch: {
      cast({ follow, angle = 0 }) { this.orb(follow, angle, 0.14); },
      release({ follow, angle = 0 }) { this.orb(follow, angle, 0.6, true); comet(follow, 0x38c85a, 0xc8ffd0, { life: 0.4, long: 120, wide: 14 }); },
      orb(follow, angle, life, untilEnd = false) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(life, (h, t, dt, g) => { const at = follow?.(); if (!at) { if (untilEnd) h.age = h.life; return; } g.top.circle(at.x + c * 20, at.y, 12).fill({ color: 0x4cd86a, alpha: 0.9 }); g.add.circle(at.x + c * 20, at.y, 6).fill({ color: 0xe8ffe8, alpha: 0.95 }); });
      },
      hit({ x, y, groundY, caster = null }) {
        // A green spiky burst, then a ring of thin green needles; a pale ring on the ground.
        live(0.36, (h, t, dt, g) => {
          spiky(g.top, x, y, 52 * (0.7 + 0.3 * Math.min(1, t / 0.2)), 10, 0x38c85a, 0.95 * (1 - t * 0.5), h.seed); spiky(g.top, x, y, 28, 10, 0xc8ffd0, 0.95 * (1 - t), h.seed + 0.5);
          if (t > 0.6) { const k = (t - 0.6) / 0.4; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + h.seed; g.top.poly([x + Math.cos(a) * 34, y + Math.sin(a) * 30, x + Math.cos(a + 0.035) * 108, y + Math.sin(a + 0.035) * 94, x + Math.cos(a - 0.035) * 108, y + Math.sin(a - 0.035) * 94]).fill({ color: 0x4cd86a, alpha: 0.9 * (1 - k) }); } }
          groundRing(g.top, x, groundY + 4, 30 + 60 * t, 0xd8c8a8, 0.85 * (1 - t), 3);
        });
        dust(x, groundY + 2, 3, [150, 120, 90]);
        // Thick green tendrils run from the target into the striker for half a second; then green rings spiral up it.
        live(1.5, (h, t, dt, g) => {
          const to = caster?.(); if (!to) return;
          if (t > 0.25 && t < 0.62) {
            const k = (t - 0.25) / 0.37;
            for (let j = 0; j < 3; j++) {
              const pts = [], back = [], off = (j - 1) * 12;
              for (let i = 0; i <= 8; i++) { const f = i / 8, px0 = x + (to.x - x) * f, py0 = y + off * (1 - f) + (to.y - y) * f + Math.sin(f * 6 + h.age * 16 + j * 2) * 7; pts.push(px0, py0 - 4); back.unshift(px0, py0 + 4); }
              g.top.poly([...pts, ...back]).fill({ color: j === 1 ? 0x8af0a0 : 0x38c85a, alpha: 0.9 * Math.sin(Math.PI * k) });
            }
          }
          if (t > 0.66) { const k = (t - 0.66) / 0.34; for (let i = 0; i < 3; i++) { const yy = to.y + 34 - 70 * Math.min(1, k * 1.5) - i * 14; groundRing(g.top, to.x, yy, 26, i % 2 ? 0xc8ffd0 : 0x38c85a, 0.95 * (1 - k), 4); } g.add.ellipse(to.x, to.y, 24, 34).fill({ color: 0xc8ffd0, alpha: 0.5 * (1 - k) }); }
        });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Force Palm
    forcePalm: {
      cast({ follow, angle = 0, windup = 0.15 }) { this.orb(follow, angle, Math.max(0.14, windup)); },
      release({ follow, angle = 0 }) {
        this.orb(follow, angle, 0.45, true);
        const c = Math.cos(angle), s = Math.sin(angle);
        const mistStops = [[0, [156, 206, 255], 0.52], [0.55, [120, 178, 255], 0.36], [1, [120, 178, 255], 0]];
        const streakStops = [[0, [215, 236, 255], 0.72], [1, [110, 174, 255], 0]];
        // Soft wispy pale-blue mist behind the gliding body; fades quickly once contact lands.
        live(0.5, (h, t, dt) => {
          const at = follow?.();
          if (!at) { h.age = h.life; return; }
          if (h.px !== undefined && Math.hypot(at.x - h.px, at.y - h.py) < 1) return;
          h.px = at.x; h.py = at.y;
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.012) {
            h.acc -= 0.012;
            const spread = (rand() - 0.5) * 26;
            spawnP({ shape: 'pxpuff', x: at.x - c * (10 + rand() * 18), y: at.y + spread * 0.65, vx: -c * (35 + rand() * 55), vy: (rand() - 0.5) * 18 - 6,
              size: 10 + rand() * 5, size1: 18 + rand() * 6, stops: mistStops, add: false, drag: 0.9, life: 0.16 + rand() * 0.08 });
            spawnP({ shape: 'streak', x: at.x - c * 14, y: at.y + spread, vx: -c * 110, vy: -s * 110,
              size: 6, size1: 1.5, stretch: 2.4, rot: angle + Math.PI, stops: streakStops, add: true, life: 0.12 + rand() * 0.05 });
          }
        });
      },
      orb(follow, angle, life, untilEnd = false) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(life, (h, t, dt, g) => {
          const at = follow?.();
          if (!at) { if (untilEnd) h.age = h.life; return; }
          const r = 8 + 3 * Math.min(1, t * 1.5);
          g.top.circle(at.x + c * 22, at.y - 2, r).fill({ color: 0x5ca8ff, alpha: 0.68 });
          g.add.circle(at.x + c * 22, at.y - 2, r * 0.52).fill({ color: 0xffffff, alpha: 0.92 });
        });
      },
      hit({ x, y, groundY, angle = 0, follow = null }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Post-impact white-blue flash, compact palm glow, and expanding pale-blue ground ripple + wash.
        live(0.42, (h, t, dt, g) => {
          const at = follow?.() ?? { x, y };
          const post = Math.max(0, h.age - 0.06);
          // Bright white-blue flash right after the ink impact frame clears.
          if (post < 0.14) {
            const fk = 1 - post / 0.14;
            g.add.circle(x - c * 4, y - 2, 22 + 26 * (1 - fk)).fill({ color: 0xd8ecff, alpha: 0.72 * fk });
            g.add.circle(x - c * 4, y - 2, 14 + 14 * (1 - fk)).fill({ color: 0xffffff, alpha: 0.92 * fk });
          }
          // Compact blue palm light held briefly on the contact side.
          if (post < 0.24) {
            const pk = 1 - post / 0.24;
            g.top.circle(x - c * 14, y - 2, 13 + 3 * pk).fill({ color: 0x5ea6ff, alpha: 0.78 * pk });
            g.add.circle(x - c * 14, y - 2, 7 + 2 * pk).fill({ color: 0xffffff, alpha: 0.92 * pk });
          }
          // Expanding organic pale-blue ground shockwave ripple + soft translucent energy wash over target.
          const rk = Math.min(1, post / 0.34);
          const fade = rk < 0.65 ? 1 : 1 - (rk - 0.65) / 0.35;
          const rx = at.x + c * 4;
          const rOut = 22 + 56 * rk;
          g.top.ellipse(rx, groundY + 4, rOut, rOut * 0.42).fill({ color: 0x7cb8ff, alpha: 0.16 * fade });
          groundRing(g.top, rx, groundY + 4, rOut, 0x5ca8ff, 0.85 * fade, 4.5 - 2 * rk);
          groundRing(g.top, rx, groundY + 4, 14 + 42 * rk, 0xc4e2ff, 0.65 * fade, 2.5);
          if (rk < 0.75) {
            const wk = 1 - rk / 0.75;
            g.add.ellipse(at.x, at.y - 2, 26 + 10 * rk, 28 + 8 * rk).fill({ color: 0x8ec4ff, alpha: 0.34 * wk });
          }
        });
        // Short horizontal pushback skid streak on the ground that fades cleanly.
        live(0.95, (h, t, dt, g) => {
          const fade = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
          const sx = x - c * 14, ex = x + c * 34;
          g.top.poly([sx, groundY + 5, ex, groundY + 6, ex, groundY + 10, sx, groundY + 9]).fill({ color: 0x5c4632, alpha: 0.42 * fade });
          g.top.poly([sx + c * 6, groundY + 7, ex - c * 4, groundY + 7, ex - c * 4, groundY + 9, sx + c * 6, groundY + 9]).fill({ color: 0x2c2016, alpha: 0.38 * fade });
        });
        // Paralysis: the struck body flickers yellow-white as it slides off, with jagged bolts tracking its real position.
        const bolt = [-13, -3, -2, -7, -1, -2, 13, -6, 3, 4, 1, -1, -9, 6];
        live(0.88, (h, t, dt, g) => {
          const at = follow?.() ?? { x: x + c * 36, y };
          const fade = 1 - t * 0.35;
          if (Math.floor(h.age / 0.065) % 2 === 0) g.top.ellipse(at.x, at.y, 24, 28).fill({ color: 0xfff2a0, alpha: 0.42 * fade });
          for (let i = 0; i < 3; i++) {
            const a = h.seed + i * 2.1 + Math.floor(h.age / 0.09) * 1.7;
            const bx = at.x + Math.cos(a) * 22, by = at.y + Math.sin(a) * 22;
            const ca = Math.cos(a * 3), sa = Math.sin(a * 3), pts = [];
            for (let j = 0; j < bolt.length; j += 2) pts.push(bx + bolt[j] * ca - bolt[j + 1] * sa, by + bolt[j] * sa + bolt[j + 1] * ca);
            g.top.poly(pts).fill({ color: 0xffd81e, alpha: fade });
          }
        });
        dust(x + c * 16, groundY + 2, 4, [176, 150, 118], 75);
        dizzy(x + c * 28, y, 0.55);
      }
    },

    // ------------------------------------------------------------------ Hammer Arm
    hammerArm: {
      // The giant fist and forearm, drawn from its elbow at `tilt` (0 = upright): a narrow forearm with a
      // yellow cuff under a wide fist with four knuckles and a thumb.
      arm(g, ex, ey, tilt, scale, alpha = 1) {
        if (!g || alpha <= 0.02 || scale <= 0.05) return;
        const ux = Math.sin(tilt), uy = -Math.cos(tilt), vx = Math.cos(tilt), vy = Math.sin(tilt), w = 26 * scale, len = 130 * scale;
        const quad = (a0, a1, h0, h1, color) => g.poly([ex + ux * a0 + vx * h0, ey + uy * a0 + vy * h0, ex + ux * a1 + vx * h0, ey + uy * a1 + vy * h0, ex + ux * a1 + vx * h1, ey + uy * a1 + vy * h1, ex + ux * a0 + vx * h1, ey + uy * a0 + vy * h1]).fill({ color, alpha });
        quad(-3, len * 0.6, -w * 0.62 - 3, w * 0.62 + 3, 0x4a1410);                 // forearm outline
        quad(len * 0.52, len + 4, -w * 1.2 - 3, w * 1.2 + 3, 0x4a1410);             // fist outline
        quad(0, len * 0.56, -w * 0.62, w * 0.62, 0xd83c18);                         // forearm
        quad(0, len * 0.56, -w * 0.62, -w * 0.2, 0xf06a34);                         // forearm light
        quad(len * 0.4, len * 0.52, -w * 0.78, w * 0.78, 0xffd24a);                 // cuff
        quad(len * 0.55, len * 0.92, -w * 1.2, w * 1.2, 0xf05a26);                  // fist
        quad(len * 0.6, len * 0.88, -w * 1.1, -w * 0.5, 0xffa066);                  // fist light
        for (let i = 0; i < 4; i++) quad(len * 0.9, len, -w * 1.2 + i * w * 0.6 + 1.5, -w * 1.2 + (i + 1) * w * 0.6 - 1.5, 0xf05a26); // knuckles
        quad(len * 0.58, len * 0.76, w * 0.7, w * 1.5, 0xd83c18);                   // thumb
      },
      shadow(g, x, y, wide = 34) { g.top.ellipse(x, y, wide, wide * 0.32).fill({ color: 0x1a1210, alpha: 0.34 }); },
      cast({ follow, windup = 0.3 }) {
        // A red line shoots up from the raised hand, then the arm grows out of it.
        live(Math.max(0.2, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          this.shadow(g, at.x, at.footY + 4, 20 + 14 * t);
          if (t < 0.3) g.top.rect(at.x - 1.5, at.y - 50 - 140 * (t / 0.3), 3, 140 * (t / 0.3)).fill({ color: 0xe0461c, alpha: 0.9 });
          else this.arm(g.top, at.x, at.y - 44, 0, (t - 0.3) / 0.7);
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Carried upright on the walk in; once it stands at the target it leans back, then swings down in an arc.
        live(2, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          if (h.lx !== undefined && Math.abs(at.x - h.lx) + Math.abs(at.y - h.ly) < 0.4) h.still = (h.still ?? 0) + dt; else if (h.arrived === undefined) h.still = 0;
          h.lx = at.x; h.ly = at.y;
          if (h.arrived === undefined && (h.still ?? 0) > 0.04) h.arrived = h.age;
          const since = h.arrived === undefined ? -1 : h.age - h.arrived;
          const tilt = since < 0 ? 0 : since < 0.28 ? -c * 0.8 * (since / 0.28) : c * (-0.8 + 2.3 * Math.min(1, Math.pow((since - 0.28) / 0.3, 2)));
          this.shadow(g, at.x + Math.sin(tilt) * 70, at.footY + 4, 36);
          this.arm(g.top, at.x, at.y - 44, tilt, 1);
          if (since > 0.28) for (let i = 0; i < 7; i++) { const a = c * (-0.8 + 2.3 * Math.min(1, Math.pow((since - 0.28) / 0.3, 2)) * (i / 6)); g.add.circle(at.x + Math.sin(a) * 136, at.y - 44 - Math.cos(a) * 136, 4).fill({ color: 0xff9a2c, alpha: 0.85 }); }
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1, ex = x - c * 100, ey = groundY - 20;
        whiteBloom(x, y, 26, 60, 0.12);
        // The arm lies flat on the target for a third of a second; an orange ring and dust under it.
        live(0.42, (h, t, dt, g) => {
          const fade = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
          this.shadow(g, x - c * 30, groundY + 6, 60);
          this.arm(g.top, ex, ey, c * Math.PI / 2, 1, fade);
          spiky(g.add, x, y, 40 * (1 - t), 8, 0xff9a2c, Math.max(0, 1 - t * 2.5), h.seed);
          groundRing(g.top, x, groundY + 4, 30 + 46 * Math.min(1, t / 0.6), 0xff8a1c, 0.9 * (1 - Math.min(1, t / 0.6)), 4);
        });
        dust(x, groundY, 9, [150, 150, 150], 110);
        sparks(x, groundY - 10, -Math.PI / 2, 12, 'fire', 300, 2.4);
        pebbles(x, groundY + 8, 14, 130, [120, 104, 88], 5, 6);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 62, pal: 'earth', life: 6 });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Karate Chop
    karateChop: {
      cast({ follow, angle = 0, windup = 0.12 }) { this.blade(follow, angle, Math.max(0.12, windup)); const at = follow?.(); if (at) dust(at.x, at.footY, 3); },
      release({ follow, angle = 0 }) { this.blade(follow, angle, 0.5, true); },
      // A thick wedge of orange energy stands off the leading arm, point down, with a ring at the feet.
      blade(follow, angle, life, untilEnd = false) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { if (untilEnd) h.age = h.life; return; }
          const bx = at.x + c * 20, top = at.y - 40;
          g.top.poly([bx - 9, top, bx + 10, top + 6, bx + 4, top + 76]).fill({ color: 0xff8a1c, alpha: 0.94 });
          g.add.poly([bx - 3, top + 6, bx + 6, top + 9, bx + 3, top + 56]).fill({ color: 0xffe9b0, alpha: 0.9 });
          groundRing(g.top, at.x, at.footY + 2, 22, 0xff8a1c, 0.6, 2);
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        whiteBloom(x, y, 22, 50, 0.12);
        sparks(x, y - 8, -Math.PI / 2, 12, 'fire', 280, 2.8);
        // A wide blade of flame stands through the struck point with a hot burst at its base, gone in a third of a second.
        live(0.36, (h, t, dt, g) => {
          const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4, height = 150 * Math.min(1, t / 0.12 + 0.45), flick = 1 + 0.18 * Math.sin(h.age * 50);
          g.top.poly([x - 13 * flick, groundY, x - 8, groundY - height * 0.8, x, groundY - height, x + 8, groundY - height * 0.8, x + 13 * flick, groundY]).fill({ color: 0xff8a1c, alpha: 0.9 * fade });
          g.add.poly([x - 5, groundY, x, groundY - height * 0.92, x + 5, groundY]).fill({ color: 0xfff2c8, alpha: 0.95 * fade });
          spiky(g.add, x, groundY - 8, 34 * (1 - t * 0.4), 8, 0xff9a2c, 0.9 * fade, h.seed);
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.04) { h.acc -= 0.04; const a = h.age * 16 + rand(); spawnP({ shape: 'pxpuff', x: x + Math.cos(a) * 26, y: groundY - 10 + Math.sin(a) * 9, vx: -Math.sin(a) * 80, vy: Math.cos(a) * 28 - 30, size: 8, size1: 13, stops: [[0, [150, 112, 78], 0.85], [1, [150, 112, 78], 0]], add: false, life: 0.3 }); }
        });
        // An orange ring turns brown as it spreads wide under the target; rocks stay on the ground.
        live(0.55, (h, t, dt, g) => {
          if (t < 0.25) return; const k = (t - 0.25) / 0.75;
          groundRing(g.top, x, groundY + 4, 30 + 52 * k, k < 0.4 ? 0xff8a1c : 0x9a6a3c, 0.95 * (1 - k * 0.8), 5);
          groundRing(g.top, x, groundY + 4, 18 + 40 * k, 0xc89058, 0.6 * (1 - k), 3);
        });
        pebbles(x - Math.cos(angle) * 10, groundY + 6, 24, 150, [112, 90, 70], 2.8, 7);
        addDecal({ x: x - Math.cos(angle) * 20, y: groundY + 8, kind: 'crack', radius: 20, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Cross Chop
    crossChop: {
      cast({ follow, windup = 0.16 }) {
        // The chest flashes white as the arms cross.
        live(Math.max(0.12, windup), (h, t, dt, g) => { const at = follow?.(); if (at) g.add.circle(at.x, at.y - 4, 8 + 10 * t).fill({ color: 0xffffff, alpha: 0.9 * (1 - t * 0.5) }); });
      },
      release({ follow, angle = 0 }) {
        // Pink dust where it took off; a faint pink blur follows the leap.
        const at = follow?.(); if (at) dust(at.x, at.footY, 5, [236, 170, 190], 60);
        trail(follow, angle, [255, 150, 190], { life: 0.5, every: 0.03, spread: 20, size: 7 });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1, seed = rand() * 6;
        live(0.5, (h, t, dt, g) => {
          // A dark red crescent comes down in front of the target as the body lands...
          if (t < 0.4) { const k = t < 0.2 ? 1 : 1 - (t - 0.2) / 0.2; crescent(g.top, x - c * 22, y - 6, 124, c, 0x7a0e1a, 0.97 * k, 24); crescent(g.top, x - c * 24, y - 6, 100, c, 0xc81e2e, 0.9 * k, 9); }
          // ...then a red jagged splash sits on the body and flickers.
          const flick = 0.7 + 0.3 * Math.sin(h.age * 64), fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3, grow = Math.min(1, t / 0.16);
          spiky(g.top, x, y, 62 * grow, 11, 0x7a0e1a, 0.96 * fade, seed);
          spiky(g.top, x, y, 40 * grow, 11, 0xc81e2e, 0.92 * fade * flick, seed + 0.4);
        });
        pebbles(x - c * 26, groundY + 6, 7, 50, [120, 118, 116], 1.8);
        addDecal({ x: x - c * 26, y: groundY + 8, kind: 'crack', radius: 12, pal: 'earth', life: 1.8 });
        dizzy(x, y, 0.4);
      }
    },

    // ------------------------------------------------------------------ Brick Break
    brickBreak: {
      cast({ follow, windup = 0.25 }) {
        // An orange-white light sits in the raised fist as the body rises; a ring under the feet.
        live(Math.max(0.12, windup) + 0.12, (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const yy = at.y - 44 - 38 * Math.min(1, t * 1.4);
          g.add.circle(at.x + 8, yy, 12).fill({ color: 0xff8a1c, alpha: 0.8 }); g.add.circle(at.x + 8, yy, 6).fill({ color: 0xffffff, alpha: 0.95 });
          groundRing(g.top, at.x, at.footY + 2, 20 + 6 * t, 0xff8a1c, 0.6, 2);
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        whiteBloom(x, y, 26, 56, 0.12);
        const seed = rand() * 10, c = Math.cos(angle) >= 0 ? 1 : -1;
        // A wide white web of cracks holds on the target, a ring spreads on the ground, then it all bursts into shards.
        live(0.36, (h, t, dt, g) => {
          const grow = Math.min(1, t / 0.16);
          for (let i = 0; i < 11; i++) {
            const a = (i / 11) * TAU + Math.sin(seed + i * 2.3) * 0.2, r = (92 + 22 * Math.sin(seed * 2 + i)) * grow;
            const mx = x + Math.cos(a + 0.1) * r * 0.55, my = y + Math.sin(a + 0.1) * r * 0.5;
            g.top.poly([x, y, mx - 2, my - 2, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, mx + 2, my + 2]).fill({ color: 0xffffff, alpha: 0.96 });
          }
          for (const rr of [30, 58, 84]) { const pts = []; for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU + Math.sin(seed + i * 2.3) * 0.2; pts.push(x + Math.cos(a) * rr * grow, y + Math.sin(a) * rr * 0.9 * grow); } g.top.poly(pts).stroke({ color: 0xffffff, width: 2, alpha: 0.9 }); }
          groundRing(g.top, x, groundY + 4, 30 + 80 * t, 0xffb060, 0.8 * (1 - t), 3);
          if (t > 0.84 && !h.burst) {
            h.burst = true;
            for (let i = 0; i < 24; i++) { const a = rand() * TAU, spd = 520 + rand() * 420; spawnP({ shape: 'shard', x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 16, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.8, vz: 60 + rand() * 80, gravity: 300, drag: 0.93, size: 10 + rand() * 6, size1: 3, rot: a, vrot: (rand() - 0.5) * 12, stops: [[0, [255, 255, 255], 1], [0.5, [206, 228, 255], 0.9], [1, [176, 206, 255], 0]], add: false, life: 0.42 + rand() * 0.14 }); }
            dust(x, groundY, 6, [170, 140, 110], 90);
          }
        });
        // A brown crater, black cracks and pebbles stay between the two bodies.
        addDecal({ x: x - c * 24, y: groundY + 8, kind: 'scorch', radius: 40, pal: 'earth', life: 6 });
        addDecal({ x: x - c * 30, y: groundY + 8, kind: 'crack', radius: 54, pal: 'earth', life: 6 });
        pebbles(x - c * 30, groundY + 8, 12, 80, [104, 78, 56], 5.5);
      }
    },

    // ------------------------------------------------------------------ Low Kick
    lowKick: {
      release({ follow, angle = 0 }) { trail(follow, angle, [190, 150, 255], { life: 0.3, every: 0.02, spread: 14, size: 7 }); },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        whiteBloom(x - c * 10, groundY - 8, 14, 34, 0.12);
        dust(x, groundY + 2, 3);
        // A pale purple sweep mark lies low between the two bodies, open side up.
        live(0.24, (h, t, dt, g) => {
          const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4, pts = [], inner = [];
          for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); pts.push(x - c * 28 + Math.cos(a) * 62, groundY + 2 + Math.sin(a) * 18); inner.unshift(x - c * 28 + Math.cos(a) * 62, groundY + 2 + Math.sin(a) * 7); }
          g.top.poly([...pts, ...inner]).fill({ color: 0xc8a8ff, alpha: 0.92 * fade });
        });
        dizzy(x, y, 0.55);
      }
    },

    // ------------------------------------------------------------------ Aerial Ace
    aerialAce: {
      cast({ follow, windup = 0.12 }) {
        // White lines whip round the curled body before it goes.
        live(Math.max(0.12, windup), (h, t, dt) => {
          const at = follow?.(); if (!at) return;
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.03) { h.acc -= 0.03; const a = rand() * TAU; spawnP({ shape: 'streak', x: at.x + Math.cos(a) * 26, y: at.y + Math.sin(a) * 20, vx: -Math.sin(a) * 180, vy: Math.cos(a) * 140, size: 8, size1: 1, stretch: 2.6, rot: a + Math.PI / 2, stops: [[0, [255, 255, 255], 1], [1, [210, 226, 255], 0]], add: true, life: 0.1 }); }
        });
      },
      release({ follow, angle = 0 }) { trail(follow, angle, [226, 238, 255], { life: 0.6, every: 0.012, spread: 50, size: 10 }); },
      hit({ x, y, groundY }) {
        whiteBloom(x, y, 26, 58, 0.14);
        // One thin white cut slants through the target while the body lies across it.
        live(0.3, (h, t, dt, g) => {
          const fade = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5, k = Math.min(1, t / 0.15);
          g.add.poly([x - 34, groundY + 10, x - 30, groundY + 14, x - 30 + 66 * k, groundY + 14 - 112 * k, x - 34 + 66 * k, groundY + 10 - 112 * k]).fill({ color: 0xffffff, alpha: 0.96 * fade });
        });
        sparks(x, y, 0, 6, 'wind', 200, 6.2);
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
