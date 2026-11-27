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
  // Aura Sphere: stands in place charging a blue orb, recoils on fire, black-bg impact frame on hit.
  'pb-013': { key: 'auraSphere', windup: { lean: -0.14 }, strike: { lean: -0.22, hold: 0.26 }, impactFrame: true, impactStyle: 'black', hideShotShadow: true },
  // Focus Blast: stands in place gathering an orange spiked sphere, recoils on launch, topples target on blast.
  'pb-107': { key: 'focusBlast', windup: { lean: -0.18, shake: 1.2 }, strike: { lean: -0.22, hold: 0.28 }, target: { topple: 0.45 }, impactFrame: true, impactStyle: 'black', hideShotShadow: true },
  // Bulk Up: stands in place, swells twice with foot dust and body sparks, then twin roaring orange pillars erupt.
  'pb-031': { key: 'bulkUp', windup: { pump: { count: 2, amount: 0.34 } }, strike: { tint: 0xffc88a, hold: 0.58 } },
  // Body Press: flattens wide before leaping in a high belly-flop arc and squashing onto the target.
  'pb-023': { key: 'bodyPress', windup: { squash: 0.46 }, dash: { arc: 148, bellyFlop: true, lean: 1.35 }, strike: { squash: 0.46, lean: 0.28, hold: 0.36 }, impactFrame: true, impactStyle: 'black' },
  // Rock Smash: stands in place, rears up with glowing fist, slams a big boulder whose chunks soar high to the target.
  'pb-233': { key: 'rockSmash', windup: { lean: -0.35, hop: 16 }, strike: { lean: 0.55, squash: 0.34, hold: 0.4 }, hideShotShadow: true },
  // Sacred Sword: stands back, dims scene and lifts camera for the colossal golden sword, then cleaves down.
  'pb-239': { key: 'sacredSword', windup: { camLift: 130 }, strike: { lean: 0.22, hold: 0.44 }, dim: 0.45, impactFrame: true, impactStyle: 'white', hideShotShadow: true },
  // Flying Press: hops onto ring ropes, springs into a front-flip arc, dives vertically and squashes onto target.
  'pb-106': { key: 'flyingPress', windup: { hop: 54, crouch: 0.2, camLift: 60 }, dash: { arc: 185, flip: 1 }, strike: { squash: 0.36, lean: 0.3, hold: 0.32 }, impactFrame: true, impactStyle: ['white', 'black'] },
  // Seismic Toss: short grab dash, carries target straight up spinning 2 turns, plunges straight down into rubble.
  'pb-243': { key: 'seismicToss', dash: { low: 0.2 }, combo: { lift: { height: 205, up: 0.34, hang: 0.66, down: 0.15, turns: 2, spinDelay: 0.16 } }, strike: { hold: 0.12 }, after: { hop: 112, time: 0.55 }, target: { lift: { height: 192, up: 0.34, hang: 0.66, down: 0.15, orbit: { radius: 28, turns: 2, delay: 0.16 } } }, impactFrame: 'final', impactStyle: ['white', 'black'] },
  // Superpower: dimmed crouch with battle aura, flame-jet high leap slam into blue-purple crystal pillars.
  'pb-283': { key: 'superpower', windup: { crouch: 0.34, shake: 1.6 }, dash: { arc: 155, lean: 0.45 }, strike: { low: 0.25, hold: 0.45 }, dim: 0.9, impactFrame: true, impactStyle: 'white' },
  // Counter: dimmed crimson silhouette stance, then white-bg impact frame + crimson starburst + 3 red slash marks.
  'pb-040': { key: 'counter', windup: { tint: 0xd82038, crouch: 0.18, shake: 1.4 }, dash: { tint: 0xd82038, lean: 0.32 }, strike: { lean: 0.35, hold: 0.28 }, dim: 0.72, impactFrame: true, impactStyle: 'white' },
  // Revenge: quick backward-and-up recoil hop coil, snappy diagonal dive-punch, extended forward punch hold.
  'pb-230': { key: 'revenge', windup: { hop: 66, back: 48, lean: -0.35, camLift: 55 }, dash: { lean: 0.95 }, strike: { lean: 0.52, hold: 0.28 } },
  // ---- flying
  // Aerial Ace: a dark-blue silhouette that cuts straight through the target and lands flat on its far side.
  'pb-003': { key: 'aerialAce', windup: { crouch: 0.2, tint: 0x2a3a8c }, dash: { tint: 0x2a3a8c, lean: 0.4 }, strike: { lean: 1.15, low: 0.2, hold: 0.28 }, after: { hop: 22, time: 0.16 }, impactFrame: true, impactStyle: 'black' },
  // Air Cutter: stationary swirl windup, flings a spinning purple-white shuriken blade, dual W/B impact frame.
  'pb-006': { key: 'airCutter', windup: { hop: 16 }, strike: { lean: 0.22, hold: 0.16 }, impactFrame: true, impactStyle: ['white', 'black'], hideShotShadow: true },
  // Air Slash: stationary rhythmic wing-sweeps launching 3 sequential cyan-white crescent wind blades.
  'pb-007': { key: 'airSlash', windup: { lean: -0.18, hop: 12 }, strike: { lean: 0.3, hold: 0.16 }, hideShotShadow: true },
  // Drill Peck: elevated hop & diagonal dive, spiral cone drill jabs 5 times rapidly, hops straight back on explosive finale.
  'pb-072': { key: 'drillPeck', windup: { hop: 54, lean: -0.28 }, dash: { lean: 0.65 }, combo: { jab: 10, lean: 0.5 }, strike: { lean: 0.3, hold: 0 }, after: { hop: 58, time: 0.28 } },
  // Dual Wingbeat: hover rise, low horizontal dash, two curved wing slashes with white-bg impact frame on 2nd hit.
  'pb-075': { key: 'dualWingbeat', windup: { hop: 34, lean: -0.2 }, dash: { lean: 0.35 }, combo: { jab: 18, lean: 0.32 }, strike: { hold: 0.2 }, after: { hop: 42, time: 0.26 }, impactFrame: 'final', impactStyle: 'white' },
  // Wing Attack: hovering double wing-flap, sweeping dive, two wing slashes with circular 2nd hit + black-bg impact.
  'pb-319': { key: 'wingAttack', windup: { hop: 44, pump: { count: 2, amount: 0.18 } }, dash: { lean: 0.5 }, combo: { jab: 16, lean: 0.35 }, strike: { hold: 0.24 }, impactFrame: 'final', impactStyle: 'black' },
  // Defog: stationary rhythmic flapping emitting a wide spiky white wind ring and field-wide wind streaks.
  'pb-052': { key: 'defog', windup: { hop: 14 }, strike: { hold: 0.85 } },
  // Roost: stationary crouch-sit on glowing white disc, brief white flash, rising golden-tan feathers.
  'pb-237': { key: 'roost', windup: { crouch: 0.26 }, strike: { low: 0.28, hold: 0.72 } }
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

    // ------------------------------------------------------------------ Aura Sphere
    auraSphere: {
      cast({ follow, angle = 0, windup = 0.6 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        live(Math.max(0.2, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const ox = at.x + c * 22, oy = at.y - 10 + s * 10;
          const r = 9 + 10 * t;
          g.top.circle(ox, oy, r + 2).fill({ color: 0x1b4ec4, alpha: 0.85 });
          g.top.circle(ox, oy, r).fill({ color: 0x4ca2ff, alpha: 0.95 });
          g.add.circle(ox - 2, oy - 2, r * 0.55).fill({ color: 0xdcf4ff, alpha: 0.95 });
          g.add.circle(ox - 3, oy - 3, r * 0.28).fill({ color: 0xffffff, alpha: 1 });
          const pulse = (h.age % 0.2) / 0.2;
          if (pulse < 0.72) {
            const pr = r + 3 + 16 * (pulse / 0.72);
            g.top.circle(ox, oy, pr).stroke({ color: 0x5c7ea8, width: 2.5, alpha: 0.8 * (1 - pulse / 0.72) });
          }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const at0 = follow?.();
        if (!at0) return;
        const ox = at0.x + c * 22, oy = at0.y - 10 + s * 10;
        // Muzzle blue spiky burst + expanding grey-blue ring + lingering white steam puff.
        live(0.46, (h, t, dt, g) => {
          if (h.age < 0.16) {
            const k = 1 - h.age / 0.16;
            spiky(g.top, ox, oy, 32 * (0.7 + 0.4 * (1 - k)), 9, 0x3b86ff, 0.92 * k, h.seed);
            spiky(g.add, ox, oy, 18 * k, 9, 0xe4f6ff, 0.95 * k, h.seed);
          }
          if (h.age < 0.28) {
            const rk = h.age / 0.28;
            g.top.circle(ox, oy, 20 + 64 * rk).stroke({ color: 0x6280a0, width: 3.5 - 2 * rk, alpha: 0.85 * (1 - rk) });
          }
          const pk = 1 - t;
          g.top.circle(ox - c * 4, oy - 2, 13 + 5 * t).fill({ color: 0xffffff, alpha: 0.65 * pk });
          g.top.circle(ox + c * 4, oy - 6, 9 + 4 * t).fill({ color: 0xdcf0ff, alpha: 0.5 * pk });
        });
      },
      projectile({ follow, angle = 0, life = 1.4 }) {
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const a = at.angle ?? angle, c = Math.cos(a), s = Math.sin(a);
          // Tapered 5-segment conical blue tail behind the flying sphere.
          for (let i = 5; i >= 1; i--) {
            const f = i / 5;
            const tx = at.x - c * (14 * i), ty = at.y - s * (14 * i);
            const rr = 15 * (1 - f * 0.62);
            g.top.circle(tx, ty, rr).fill({ color: i > 3 ? 0x2256b8 : 0x3f88f0, alpha: 0.78 * (1 - f * 0.55) });
          }
          g.top.circle(at.x, at.y, 18).fill({ color: 0x1d52c8, alpha: 0.95 });
          g.top.circle(at.x, at.y, 15).fill({ color: 0x4ca6ff, alpha: 0.98 });
          g.add.circle(at.x - 2, at.y - 2, 9).fill({ color: 0xd6f2ff, alpha: 0.95 });
          g.add.circle(at.x - 3, at.y - 3, 4.5).fill({ color: 0xffffff, alpha: 1 });
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        const cx = x - c * 10;
        // Post-HS blue gear-sun disc expanding into a 12-point radiant starburst inside double rings + wide blue ground ellipse.
        live(0.56, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          const k = Math.min(1, post / 0.46);
          const fade = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
          const rDisc = 24 + 34 * Math.min(1, k * 1.45);
          // Expanding flat blue ground shockwave ellipse.
          groundRing(g.top, cx, groundY + 4, 28 + 90 * k, 0x3e78cc, 0.88 * fade, 5 - 2 * k);
          groundRing(g.top, cx, groundY + 4, 18 + 62 * k, 0x9ecaff, 0.55 * fade, 2.5);
          // Blue disc with white rim and 12-pointed radiant starburst inside.
          g.top.circle(cx, y, rDisc + 3).stroke({ color: 0x2b5088, width: 3, alpha: 0.85 * fade });
          g.top.circle(cx, y, rDisc).fill({ color: 0x3574e0, alpha: 0.72 * fade }).stroke({ color: 0xffffff, width: 3.5, alpha: 0.9 * fade });
          spiky(g.add, cx, y, rDisc * (0.58 + 0.38 * Math.min(1, k * 1.6)), 12, 0xbce6ff, 0.9 * fade, 0.15);
          g.add.circle(cx, y, rDisc * (0.42 - 0.18 * k)).fill({ color: 0xffffff, alpha: 0.95 * fade });
          // Outer short gear ticks in early phase.
          if (k < 0.55) {
            const gk = 1 - k / 0.55;
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * TAU;
              g.top.poly([
                cx + Math.cos(a - 0.07) * rDisc, y + Math.sin(a - 0.07) * rDisc,
                cx + Math.cos(a) * (rDisc + 8), y + Math.sin(a) * (rDisc + 8),
                cx + Math.cos(a + 0.07) * rDisc, y + Math.sin(a + 0.07) * rDisc
              ]).fill({ color: 0xffffff, alpha: 0.9 * gk });
            }
          }
        });
        // Brief ground scuff mark that fades in 0.45 s.
        live(0.45, (h, t, dt, g) => {
          g.top.ellipse(x, groundY + 6, 18, 7).fill({ color: 0x7c6650, alpha: 0.38 * (1 - t) });
        });
        dizzy(x + c * 18, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Focus Blast
    focusBlast: {
      cast({ follow, angle = 0, windup = 0.36 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        live(Math.max(0.18, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const ox = at.x + c * 24, oy = at.y - 4 + s * 10;
          const r = 10 + 14 * t;
          spiky(g.top, ox, oy, r * 1.35, 11, 0xd84610, 0.9, h.age * 12);
          g.top.circle(ox, oy, r).fill({ color: 0xff821c, alpha: 0.95 });
          g.add.circle(ox, oy, r * 0.56).fill({ color: 0xfff0b0, alpha: 0.98 });
          // Energy flaring backward from caster.
          if (Math.floor(h.age * 30) % 2 === 0) {
            spiky(g.add, at.x - c * 14, at.y - 8, 16 * (0.6 + 0.4 * t), 7, 0xff9a28, 0.72, h.age * 16);
          }
        });
      },
      release({ follow, angle = 0 }) {
        const at0 = follow?.(); if (!at0) return;
        const c = Math.cos(angle), s = Math.sin(angle), nx = -s, ny = c;
        const ox = at0.x + c * 22, oy = at0.y - 4 + s * 10;
        // Perpendicular sonic-boom launch rings.
        live(0.32, (h, t, dt, g) => {
          const fade = 1 - t;
          for (let rIdx = 0; rIdx < 2; rIdx++) {
            const dist = 8 + rIdx * 18 + t * 14;
            const rx = ox + c * dist, ry = oy + s * dist;
            const ryLen = (24 + rIdx * 10) * (0.7 + 0.65 * t), rxLen = ryLen * 0.34;
            const pts = [];
            for (let i = 0; i <= 16; i++) {
              const a = (i / 16) * TAU;
              pts.push(rx + c * Math.cos(a) * rxLen + nx * Math.sin(a) * ryLen, ry + s * Math.cos(a) * rxLen + ny * Math.sin(a) * ryLen);
            }
            g.top.poly(pts).stroke({ color: rIdx === 0 ? 0xffb454 : 0xffe0a4, width: 3 - rIdx, alpha: 0.82 * fade });
          }
        });
      },
      projectile({ follow, angle = 0, life = 1.4 }) {
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const a = at.angle ?? angle, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
          // Fiery tapered orange tail + trailing sonic ring perpendicular to flight.
          const tailLen = 58 + 8 * Math.sin(h.age * 45);
          g.top.poly([
            at.x + nx * 16, at.y + ny * 16,
            at.x + c * 14, at.y + s * 14,
            at.x - nx * 16, at.y - ny * 16,
            at.x - c * tailLen, at.y - s * tailLen
          ]).fill({ color: 0xe64810, alpha: 0.85 });
          g.add.poly([
            at.x + nx * 9, at.y + ny * 9,
            at.x - nx * 9, at.y - ny * 9,
            at.x - c * (tailLen * 0.72), at.y - s * (tailLen * 0.72)
          ]).fill({ color: 0xffb838, alpha: 0.88 });
          // Sonic ring trailing behind sphere.
          const rx = at.x - c * 18, ry = at.y - s * 18;
          const pts = [];
          for (let i = 0; i <= 14; i++) {
            const p = (i / 14) * TAU;
            pts.push(rx + c * Math.cos(p) * 10 + nx * Math.sin(p) * 32, ry + s * Math.cos(p) * 10 + ny * Math.sin(p) * 32);
          }
          g.top.poly(pts).stroke({ color: 0xffd288, width: 2.5, alpha: 0.72 });
          // Spiky fiery core sphere.
          spiky(g.top, at.x, at.y, 26, 12, 0xd93c0a, 0.95, h.age * 18);
          g.top.circle(at.x, at.y, 19).fill({ color: 0xff7a18, alpha: 0.98 });
          g.add.circle(at.x, at.y, 11).fill({ color: 0xfff4c2, alpha: 0.98 });
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Post-HS: orange sphere engulfs target -> giant 11-point spiky orange starburst -> warm smoke & scattered pebbles.
        live(0.62, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          if (post < 0.18) {
            const ek = post / 0.18;
            spiky(g.top, x, y, 36 + 18 * ek, 12, 0xe84810, 0.94, h.seed);
            g.top.circle(x, y, 28 + 10 * ek).fill({ color: 0xff841c, alpha: 0.92 });
            g.add.circle(x, y, 16 + 8 * ek).fill({ color: 0xffffff, alpha: 0.96 });
            g.top.ellipse(x - c * 22, y, 11, 34 + 10 * ek).stroke({ color: 0xffc878, width: 3, alpha: 0.85 });
          } else {
            const bk = Math.min(1, (post - 0.18) / 0.38);
            const fade = bk < 0.55 ? 1 : 1 - (bk - 0.55) / 0.45;
            const rBurst = 56 + 44 * Math.min(1, bk * 1.4);
            spiky(g.top, x, y, rBurst + 5, 11, 0x6a1a08, 0.92 * fade, h.seed);
            spiky(g.top, x, y, rBurst, 11, bk < 0.6 ? 0xff6e18 : 0xb8764c, 0.94 * fade, h.seed);
            spiky(g.add, x, y, rBurst * 0.62, 11, 0xffe49c, 0.9 * fade, h.seed);
            g.add.circle(x, y, 20 * (1 - bk * 0.7)).fill({ color: 0xffffff, alpha: 0.9 * fade });
          }
        });
        dust(x, groundY + 2, 8, [138, 124, 112], 125);
        pebbles(x, groundY + 6, 16, 130, [96, 88, 82], 4.5, 6);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 42, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.55);
      }
    },

    // ------------------------------------------------------------------ Bulk Up
    bulkUp: {
      // Organic roaring flame arm-pillar rising from (bx, by) on side `side` (-1 left, +1 right), flexing then shooting up & tapering off.
      flexArm(g, bx, by, side, flex, liftOff, scale, alpha, age) {
        if (!g || alpha <= 0.02 || scale <= 0.05) return;
        const flick = Math.sin(age * 42 + side * 2) * 3;
        const baseY = by - liftOff * 28;
        const h = (56 + 68 * (1 - flex)) * scale * (1 - liftOff * 0.25);
        const w = (15 - liftOff * 5) * scale;
        const bend = side * (16 * flex) * scale;
        const pts = [
          bx - w * 1.15, baseY,
          bx - w * 0.72 + bend * 0.4 + flick * 0.4, baseY - h * 0.42,
          bx - w * 0.95 + bend - flick * 0.5, baseY - h * 0.76,
          bx - w * 0.55 + bend, baseY - h * 0.96,
          bx + bend * 0.9 + flick * 0.3, baseY - h * 1.06,
          bx + w * 0.55 + bend, baseY - h * 0.94,
          bx + w * 0.92 + bend * 0.5 + flick * 0.5, baseY - h * 0.72,
          bx + w * 0.72 + bend * 0.2 - flick * 0.4, baseY - h * 0.42,
          bx + w * 1.15, baseY
        ];
        g.top.poly(pts).fill({ color: 0x9c2808, alpha });
        const inner = [
          bx - w * 0.78, baseY - 2,
          bx - w * 0.45 + bend * 0.4, baseY - h * 0.42,
          bx - w * 0.58 + bend, baseY - h * 0.78,
          bx + bend * 0.9, baseY - h * 0.98,
          bx + w * 0.55 + bend * 0.6, baseY - h * 0.74,
          bx + w * 0.45 + bend * 0.2, baseY - h * 0.42,
          bx + w * 0.78, baseY - 2
        ];
        g.top.poly(inner).fill({ color: 0xff7a18, alpha });
        g.add.poly([bx - w * 0.26 + bend * 0.4, baseY - h * 0.14, bx + bend * 0.9, baseY - h * 0.92, bx + w * 0.26 + bend * 0.4, baseY - h * 0.14]).fill({ color: 0xfff0a0, alpha: alpha * 0.9 });
        // Wide flared fiery base crown at the foot of the pillar (dissolves cleanly as pillar lifts off).
        if (liftOff < 0.7) {
          const bf = (1 - liftOff / 0.7) * alpha;
          flameSpike(g.top, bx, by + 3, 30 * scale, 22 * scale, 0xd83c08, bf * 0.95, side * 5 + flick * 0.5);
          flameSpike(g.top, bx - side * 8, by + 4, 22 * scale, 14 * scale, 0xff7a18, bf * 0.9, -side * 3);
          flameSpike(g.add, bx, by + 3, 18 * scale, 11 * scale, 0xffe478, bf * 0.88, side * 2);
        }
      },
      cast({ follow, windup = 0.42 }) {
        const dustStops = [[0, [218, 210, 198], 0.85], [0.6, [170, 162, 152], 0.55], [1, [140, 134, 126], 0]];
        live(Math.max(0.25, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          // Two rhythmic pumps: billowing grey-white dust-puff rings around feet + warm orange foot glow + pre-release shockwave.
          const pulse = (t * 2) % 1;
          const isSecond = t >= 0.5;
          const ringR = 24 + 44 * pulse;
          g.top.ellipse(at.x, at.footY + 3, 24, 10).fill({ color: 0xff8a24, alpha: 0.32 + 0.25 * t });
          groundRing(g.top, at.x, at.footY + 3, ringR, isSecond ? 0xff9a38 : 0xe4dcd0, 0.92 * (1 - pulse * 0.55), 5.5 - 2 * pulse);
          groundRing(g.top, at.x, at.footY + 3, 14 + 34 * pulse, 0xb8aea2, 0.72 * (1 - pulse * 0.6), 3.5);
          // Billowing grey dust puffs emitted along the expanding foot ring on each pump.
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.045) {
            h.acc -= 0.045;
            for (let k = 0; k < 3; k++) {
              const a = rand() * TAU;
              spawnP({ shape: 'pxpuff', x: at.x + Math.cos(a) * (18 + 18 * pulse), y: at.footY + 2 + Math.sin(a) * 8,
                vx: Math.cos(a) * 55, vy: Math.sin(a) * 20 - 12, size: 9 + rand() * 5, size1: 15 + rand() * 5,
                stops: dustStops, add: false, drag: 0.88, life: 0.26 });
            }
          }
          // Prominent repeated bright orange starburst sparkles popping across the flexing body.
          const beat = Math.floor(h.age / 0.09);
          const frac = (h.age % 0.09) / 0.09;
          for (let i = 0; i < 3; i++) {
            const a = beat * 2.1 + i * 2.1;
            const sx = at.x + Math.cos(a) * 18, sy = at.y - 6 + Math.sin(a) * 16;
            const sr = (18 + 6 * t) * (1 - frac * 0.55);
            spiky(g.top, sx, sy, sr + 2, 8, 0xb83808, 0.88, a);
            spiky(g.add, sx, sy, sr, 8, 0xff9828, 0.96, a);
            g.add.circle(sx, sy, sr * 0.34).fill({ color: 0xffffff, alpha: 0.95 });
          }
        });
      },
      release({ follow }) {
        live(0.72, (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const grow = Math.min(1, t / 0.14);
          const liftOff = t < 0.72 ? 0 : (t - 0.72) / 0.28;
          const fade = t < 0.78 ? 1 : 1 - (t - 0.78) / 0.22;
          const flex = t < 0.2 ? 1 - t / 0.2 : 0;
          // Wide outer pale shockwave ring + jagged fiery orange ground crown under the caster.
          if (t < 0.55) {
            const sk = t / 0.55;
            groundRing(g.top, at.x, at.footY + 4, 48 + 56 * sk, 0xe8dfd0, 0.82 * (1 - sk), 4.5 - 2 * sk);
          }
          groundRing(g.top, at.x, at.footY + 3, 44 + 14 * Math.min(1, t * 2), 0xff7a18, 0.88 * fade, 4);
          // Jagged fiery crown teeth ring at ground level during eruption.
          if (t < 0.65) {
            const cf = 1 - t / 0.65;
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU + 0.2;
              flameSpike(g.top, at.x + Math.cos(a) * 34, at.footY + 4 + Math.sin(a) * 14, 16 * cf, 7, 0xff6e14, 0.85 * cf, Math.cos(a) * 4);
            }
          }
          // Twin roaring orange flame arm-pillars flanking left and right, tapering upward on exit.
          this.flexArm(g, at.x - 36, at.footY + 2, -1, flex, liftOff, grow, 0.96 * fade, h.age);
          this.flexArm(g, at.x + 36, at.footY + 2, 1, flex, liftOff, grow, 0.96 * fade, h.age);
          // Multiple large starburst flashes across the body during early eruption.
          if (t < 0.5) {
            const sk = 1 - t / 0.5;
            const pulse = 0.75 + 0.25 * Math.sin(h.age * 48);
            spiky(g.add, at.x, at.y - 4, 28 * sk * pulse, 9, 0xff8a1c, 0.92 * sk, h.age * 14);
            spiky(g.add, at.x + 12, at.y - 16, 18 * sk * pulse, 8, 0xffb840, 0.88 * sk, h.age * 19 + 1);
            spiky(g.add, at.x - 10, at.y + 4, 16 * sk * pulse, 8, 0xff9828, 0.85 * sk, h.age * 17 + 2);
            star4(g.add, at.x, at.y - 4, 17 * sk, 0xffffff, 0.96 * sk);
          }
          // Brief pair of small dark dust flecks left at the two pillar bases as the flames vanish.
          if (t > 0.75) {
            const df = (1 - t) / 0.25;
            g.top.ellipse(at.x - 36, at.footY + 3, 7, 3.5).fill({ color: 0x5c544a, alpha: 0.65 * df });
            g.top.ellipse(at.x + 36, at.footY + 3, 7, 3.5).fill({ color: 0x5c544a, alpha: 0.65 * df });
          }
        });
      },
      hit() {}
    },

    // ------------------------------------------------------------------ Body Press
    bodyPress: {
      cast({ follow, windup = 0.22 }) {
        live(Math.max(0.12, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          groundRing(g.top, at.x, at.footY + 3, 24 + 10 * t, 0xb8a894, 0.65 * (1 - t * 0.4), 3);
        });
      },
      release({ follow, angle = 0 }) {
        const at0 = follow?.();
        if (at0) {
          dust(at0.x, at0.footY + 2, 8, [148, 126, 102], 105);
          pebbles(at0.x, at0.footY + 6, 8, 56, [104, 92, 80], 4.5, 5);
          addDecal({ x: at0.x, y: at0.footY + 6, kind: 'crack', radius: 26, pal: 'earth', life: 4.5 });
        }
        const c = Math.cos(angle), s = Math.sin(angle);
        // Dark-grey elliptical shadow grows ahead on the ground underneath the diving body.
        live(0.65, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const k = Math.min(1, h.age / 0.42);
          const sx = at.x + c * 22 * (1 - k * 0.5), sy = at.footY + 4;
          g.top.ellipse(sx, sy, 22 + 24 * k, (22 + 24 * k) * 0.42).fill({ color: 0x262830, alpha: 0.48 * k });
        });
      },
      hit({ x, y, groundY }) {
        // Post-HS: white squash flash + 3 concentric white/beige expanding flat ground rings + beige dust cloud + flying pebbles.
        live(0.56, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          const k = Math.min(1, post / 0.48);
          const fade = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
          if (post < 0.14) {
            const fk = 1 - post / 0.14;
            g.add.ellipse(x, groundY, 44 + 20 * (1 - fk), 20 + 8 * (1 - fk)).fill({ color: 0xffffff, alpha: 0.92 * fk });
          }
          // Cream-beige central dust cloud + 3 concentric shockwave rings.
          g.top.ellipse(x, groundY + 2, 26 + 38 * k, (26 + 38 * k) * 0.44).fill({ color: 0xf4ead8, alpha: 0.52 * fade });
          groundRing(g.top, x, groundY + 4, 24 + 84 * k, 0xffffff, 0.92 * fade, 4.5 - 2 * k);
          groundRing(g.top, x, groundY + 4, 16 + 64 * k, 0xd8cab8, 0.85 * fade, 3.5 - 1.5 * k);
          groundRing(g.top, x, groundY + 4, 10 + 44 * k, 0x9c8e7e, 0.7 * fade, 2.5);
        });
        dust(x, groundY + 2, 10, [224, 212, 192], 125);
        for (let i = 0; i < 10; i++) {
          const a = rand() * TAU;
          spawnP({ shape: 'shard', x: x + Math.cos(a) * 14, y: groundY, vx: Math.cos(a) * (60 + rand() * 90), vy: Math.sin(a) * 35 - 40,
            vz: 120 + rand() * 110, gravity: 460, size: 5 + rand() * 4, size1: 3, rot: a, vrot: (rand() - 0.5) * 10,
            stops: [[0, [118, 96, 74], 0.95], [1, [92, 76, 58], 0]], add: false, life: 0.52 + rand() * 0.16 });
        }
        pebbles(x, groundY + 8, 14, 110, [110, 92, 74], 4.5, 6);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 48, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Rock Smash
    rockSmash: {
      rockPoly(g, x, y, r, alpha = 1) {
        if (!g || alpha <= 0.02) return;
        const pts = [x - r, y + r * 0.35, x - r * 0.84, y - r * 0.58, x - r * 0.14, y - r * 0.96, x + r * 0.72, y - r * 0.64, x + r, y + r * 0.26, x + r * 0.54, y + r * 0.72, x - r * 0.5, y + r * 0.72];
        g.poly(pts).fill({ color: 0x352e26, alpha });
        const inner = [x - r * 0.84, y + r * 0.26, x - r * 0.7, y - r * 0.46, x - r * 0.12, y - r * 0.8, x + r * 0.6, y - r * 0.52, x + r * 0.84, y + r * 0.2, x + r * 0.44, y + r * 0.56, x - r * 0.42, y + r * 0.56];
        g.poly(inner).fill({ color: 0x8d7e6a, alpha });
        g.poly([x - r * 0.64, y - r * 0.42, x - r * 0.1, y - r * 0.74, x + r * 0.5, y - r * 0.46, x, y - r * 0.1]).fill({ color: 0xc2b39c, alpha });
        g.poly([x - r * 0.4, y + r * 0.15, x + r * 0.38, y + r * 0.15, x + r * 0.42, y + r * 0.52, x - r * 0.38, y + r * 0.52]).fill({ color: 0x5c5042, alpha });
      },
      cast({ follow, angle = 0, windup = 0.3 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Growing spiky orange starburst held high above the raised fist.
        live(Math.max(0.18, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const sx = at.x + c * 6, sy = at.y - 46;
          const r = 12 + 20 * t;
          spiky(g.top, sx, sy, r + 4, 8, 0x7a2206, 0.94, h.seed);
          spiky(g.top, sx, sy, r, 8, 0xff841c, 0.96, h.seed);
          g.add.circle(sx, sy, r * 0.44).fill({ color: 0xfff4c0, alpha: 0.96 });
        });
      },
      release({ follow, angle = 0 }) {
        const at0 = follow?.(); if (!at0) return;
        const c = Math.cos(angle), s = Math.sin(angle);
        const bx = at0.x + c * 40, by = at0.footY - 4 + s * 16;
        // Large faceted boulder erupts in front of caster, takes a fiery orange slam flash beneath it, and shatters.
        live(0.38, (h, t, dt, g) => {
          const shrink = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
          this.rockPoly(g.top, bx, by - 16, 35 * shrink, 0.98 * Math.min(1, shrink * 1.45));
          if (t < 0.65) {
            const fk = 1 - t / 0.65;
            spiky(g.top, bx, by + 3, 38 * fk, 9, 0xd84610, 0.92 * fk, h.seed);
            spiky(g.add, bx, by + 3, 26 * fk, 9, 0xffb838, 0.95 * fk, h.seed);
            groundRing(g.top, bx, by + 5, 22 + 34 * (1 - fk), 0xff8c24, 0.78 * fk, 3.5);
          }
        });
        dust(bx, by + 4, 11, [164, 146, 124], 115);
        pebbles(bx, by + 6, 16, 108, [96, 84, 70], 4.5, 7);
        addDecal({ x: bx, y: by + 6, kind: 'crack', radius: 54, pal: 'earth', life: 4.5 });
      },
      projectile({ follow, angle = 0, life = 1.2 }) {
        const chunks = [
          { dx: 4, dy: -4, peak: 98, r: 17 },
          { dx: -24, dy: -10, peak: 76, r: 14.5 },
          { dx: 20, dy: 8, peak: 62, r: 13 },
          { dx: -12, dy: 12, peak: 46, r: 11.5 }
        ];
        const trailStops = [[0, [176, 162, 142], 0.65], [1, [150, 138, 122], 0]];
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const a = at.angle ?? angle, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
          const arcPhase = Math.sin(Math.min(1, h.age / 0.48) * Math.PI);
          for (const ch of chunks) {
            const gx = at.x + c * ch.dx + nx * ch.dy;
            const gy = (at.footY ?? (at.y + 12)) + s * ch.dx + ny * ch.dy;
            const lift = Math.max(6, ch.peak * arcPhase);
            // Crisp ground shadow directly under each high-arcing angular boulder.
            g.top.ellipse(gx, gy + 4, ch.r * 1.05, ch.r * 0.42).fill({ color: 0x1e1a16, alpha: 0.45 });
            this.rockPoly(g.top, gx, gy - lift, ch.r, 0.98);
          }
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.04) {
            h.acc -= 0.04;
            spawnP({ shape: 'pxpuff', x: at.x - c * 12, y: (at.footY ?? at.y) - 68 * arcPhase, vx: -c * 30, vy: 12,
              size: 8, size1: 14, stops: trailStops, add: false, drag: 0.9, life: 0.22 });
          }
        });
      },
      hit({ x, y, groundY }) {
        // Bright warm yellow-orange impact starburst + bouncing rock chunks + persistent rubble piles & wide fissure.
        live(0.36, (h, t, dt, g) => {
          const fade = 1 - t;
          const r = 34 + 26 * Math.min(1, t * 2.2);
          spiky(g.top, x, y - 4, r + 4, 10, 0xc84e10, 0.9 * fade, h.seed);
          spiky(g.add, x, y - 4, r, 10, 0xffd24a, 0.95 * fade, h.seed);
          g.add.circle(x, y - 4, 16 * fade).fill({ color: 0xffffff, alpha: 0.96 * fade });
          groundRing(g.top, x, groundY + 4, 24 + 44 * t, 0xd8a868, 0.8 * fade, 3.5);
        });
        dust(x, groundY + 2, 11, [168, 150, 128], 130);
        for (let i = 0; i < 12; i++) {
          const a = rand() * TAU;
          spawnP({ shape: 'shard', x, y, vx: Math.cos(a) * (100 + rand() * 140), vy: Math.sin(a) * 65 - 55,
            vz: 140 + rand() * 120, gravity: 460, size: 8 + rand() * 6, size1: 4, rot: a, vrot: (rand() - 0.5) * 14,
            stops: [[0, [142, 128, 110], 0.98], [0.7, [104, 92, 76], 0.92], [1, [80, 70, 58], 0]], add: false, life: 0.55 + rand() * 0.18 });
        }
        // Persistent dark rubble piles around the target lasting 4.5 s.
        live(4.5, (h, t, dt, g) => {
          const fade = t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18;
          this.rockPoly(g.top, x - 34, groundY + 4, 11, 0.88 * fade);
          this.rockPoly(g.top, x + 36, groundY + 6, 10, 0.88 * fade);
          this.rockPoly(g.top, x - 18, groundY + 13, 8.5, 0.85 * fade);
          this.rockPoly(g.top, x + 22, groundY - 4, 8, 0.82 * fade);
        });
        pebbles(x, groundY + 6, 18, 130, [96, 84, 70], 4.5, 7);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 52, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.55);
      }
    },

    // ------------------------------------------------------------------ Sacred Sword
    sacredSword: {
      // Giant golden-cream broadsword pivoted at hilt (px, py), angle `tilt` (0 = straight up, +PI/2 = lying right).
      drawBlade(g, px, py, tilt, scale, alpha = 1) {
        if (!g || alpha <= 0.02 || scale <= 0.05) return;
        const ux = Math.sin(tilt), uy = -Math.cos(tilt), vx = Math.cos(tilt), vy = Math.sin(tilt);
        const len = 242 * scale, hw = 13.5 * scale;
        const pt = (along, side) => [px + ux * along + vx * side, py + uy * along + vy * side];
        const poly = (list, color, a = alpha) => {
          const flat = [];
          for (const [al, si] of list) { const p = pt(al, si); flat.push(p[0], p[1]); }
          g.top.poly(flat).fill({ color, alpha: a });
        };
        // Pommel and crossguard.
        poly([[-14 * scale, -5 * scale], [2, -5 * scale], [2, 5 * scale], [-14 * scale, 5 * scale]], 0x6a4208);
        poly([[-4 * scale, -26 * scale], [7 * scale, -26 * scale], [7 * scale, 26 * scale], [-4 * scale, 26 * scale]], 0x6a4208);
        poly([[-1 * scale, -23 * scale], [5 * scale, -23 * scale], [5 * scale, 23 * scale], [-1 * scale, 23 * scale]], 0xf4bc2a);
        // Outer dark gold-brown outline -> golden trim -> luminous cream blade.
        poly([[5 * scale, -hw - 3], [len * 0.86, -hw * 0.72 - 3], [len + 5, 0], [len * 0.86, hw * 0.72 + 3], [5 * scale, hw + 3]], 0x6a4208);
        poly([[6 * scale, -hw], [len * 0.86, -hw * 0.72], [len, 0], [len * 0.86, hw * 0.72], [6 * scale, hw]], 0xf5be32);
        poly([[10 * scale, -hw * 0.56], [len * 0.84, -hw * 0.42], [len * 0.94, 0], [len * 0.84, hw * 0.42], [10 * scale, hw * 0.56]], 0xfff8dc);
        // Row of glowing white-gold gems down the centerline.
        for (let i = 1; i <= 7; i++) {
          const p = pt(len * (i / 8.4), 0);
          g.add.circle(p[0], p[1], 3.8 * scale).fill({ color: 0xffffff, alpha: 0.95 * alpha });
        }
      },
      cast({ follow, angle = 0, windup = 0.64 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(Math.max(0.25, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const grow = Math.min(1, t / 0.18);
          const back = t < 0.76 ? 0 : -c * 0.42 * ((t - 0.76) / 0.24);
          this.drawBlade(g, at.x, at.y - 26, back, grow, 0.98);
          // Golden radial lines at caster's feet while holding the sword aloft.
          groundRing(g.add, at.x, at.footY + 3, 24 + 14 * Math.sin(t * Math.PI), 0xffd858, 0.65, 2.5);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + h.age * 2.5;
            const r0 = 16, r1 = 28 + 6 * Math.sin(h.age * 16 + i);
            g.add.moveTo(at.x + Math.cos(a) * r0, at.footY + 2 + Math.sin(a) * r0 * 0.42)
              .lineTo(at.x + Math.cos(a) * r1, at.footY + 2 + Math.sin(a) * r1 * 0.42)
              .stroke({ color: 0xffe484, width: 2, alpha: 0.72 });
          }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        live(0.68, (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const px = at.x, py = at.y - 18;
          const startTilt = -c * 0.42, endTilt = c * 1.48;
          const swingT = Math.min(1, h.age / 0.12);
          const tilt = startTilt + (endTilt - startTilt) * (swingT * swingT);
          // Giant translucent cream-gold quarter-circle sweep fan trailing the cleave.
          if (h.age < 0.44) {
            const fanFade = h.age < 0.14 ? 0.72 : 0.72 * (1 - (h.age - 0.14) / 0.3);
            const pts = [px, py];
            const steps = 12;
            for (let i = 0; i <= steps; i++) {
              const a = startTilt + (tilt - startTilt) * (i / steps);
              pts.push(px + Math.sin(a) * 242, py - Math.cos(a) * 242);
            }
            g.top.poly(pts).fill({ color: 0xfef4cc, alpha: fanFade * 0.62 });
            g.top.poly(pts.slice(2)).stroke({ color: 0xe6b228, width: 3, alpha: fanFade * 0.85 });
          }
          // Hold the fallen sword flat onto the target, then shatter into gold sparkles.
          if (h.age < 0.52) {
            this.drawBlade(g, px, py, tilt, 1, 0.98);
          } else if (!h.shattered) {
            h.shattered = true;
            const ux = Math.sin(endTilt), uy = -Math.cos(endTilt);
            for (let i = 1; i <= 16; i++) {
              const sx = px + ux * (i * 15), sy = py + uy * (i * 15);
              spawnP({ shape: 'shard', x: sx, y: sy, vx: (rand() - 0.5) * 90, vy: -30 - rand() * 70,
                vz: 40 + rand() * 50, gravity: 240, size: 6 + rand() * 4, size1: 1.5, rot: rand() * TAU, vrot: (rand() - 0.5) * 10,
                stops: [[0, [255, 248, 200], 1], [0.5, [245, 190, 50], 0.9], [1, [200, 130, 20], 0]], add: true, life: 0.34 + rand() * 0.14 });
            }
          }
        });
      },
      projectile() {},
      hit({ x, y, groundY, angle = 0, caster = null }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        const from = caster?.() ?? { x: x - c * 220, y };
        // Post-HS gold-white star blooming into a fine 14-needle golden starburst.
        live(0.46, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          const k = Math.min(1, post / 0.38);
          const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
          const r = 34 + 58 * Math.min(1, k * 1.5);
          spiky(g.top, x, y, r * 0.65, 10, 0xf2b422, 0.85 * fade, h.seed);
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU + 0.12;
            const rr = r * (i % 2 ? 0.72 : 1.0);
            g.add.poly([
              x + Math.cos(a - 0.04) * 8, y + Math.sin(a - 0.04) * 8,
              x + Math.cos(a) * rr, y + Math.sin(a) * rr,
              x + Math.cos(a + 0.04) * 8, y + Math.sin(a + 0.04) * 8
            ]).fill({ color: 0xfff0a4, alpha: 0.95 * fade });
          }
          g.add.circle(x, y, 16 * (1 - k * 0.5)).fill({ color: 0xffffff, alpha: 0.96 * fade });
        });
        // Long straight dark ground slash scar from caster feet to target lasting 4.5 s.
        live(4.5, (h, t, dt, g) => {
          const fade = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
          const sx = from.x + c * 16, ex = x + c * 14, sy = groundY + 6;
          g.top.poly([sx, sy - 2, ex, sy - 1, ex, sy + 2.5, sx, sy + 2]).fill({ color: 0x262018, alpha: 0.75 * fade });
          if (h.age < 0.5) {
            g.add.poly([sx, sy - 1, ex, sy - 0.5, ex, sy + 1.5, sx, sy + 1]).fill({ color: 0xffd858, alpha: 0.72 * (1 - h.age / 0.5) });
          }
        });
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 22, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.45);
      }
    },

    // ------------------------------------------------------------------ Flying Press
    flyingPress: {
      // Wrestling ring corner turnbuckles + 3 horizontal ropes (red top, white middle, green bottom), sagging when pressed.
      drawRopes(g, x, footY, sag, alpha) {
        if (!g || alpha <= 0.02) return;
        const lx = x - 34, rx = x + 34, botY = footY + 4, h = 54;
        // Ground shadow under the ring posts.
        g.top.ellipse(x, botY + 2, 40, 10).fill({ color: 0x1a1816, alpha: 0.3 * alpha });
        // Twin dark turnbuckle posts with metallic caps.
        for (const px of [lx, rx]) {
          g.top.rect(px - 5, botY - h - 4, 10, h + 4).fill({ color: 0x262832, alpha });
          g.top.rect(px - 3, botY - h - 2, 6, h).fill({ color: 0x586074, alpha });
          g.top.rect(px - 6, botY - h - 6, 12, 6).fill({ color: 0xd83232, alpha });
        }
        // Three horizontal ropes (red / white / green) with parabolic sag at center.
        const ropes = [
          { y: botY - h + 4, col: 0xe63636, bend: sag },
          { y: botY - h * 0.62, col: 0xf4f4f8, bend: sag * 0.55 },
          { y: botY - h * 0.28, col: 0x36b85a, bend: sag * 0.25 }
        ];
        for (const rp of ropes) {
          const pts = [];
          for (let i = 0; i <= 8; i++) {
            const f = i / 8;
            const px = lx + (rx - lx) * f;
            const py = rp.y + Math.sin(f * Math.PI) * rp.bend;
            pts.push(px, py);
          }
          g.top.poly(pts).stroke({ color: 0x1a1820, width: 6, alpha });
          g.top.poly(pts).stroke({ color: rp.col, width: 3.5, alpha });
        }
      },
      cast({ follow, windup = 0.45 }) {
        const at0 = follow?.();
        if (!at0) return;
        const rx = at0.x, rFoot = at0.footY;
        // Brief white entry flash, then the ring corner ropes stand at takeoff through the leap (~1.05 s) and vanish.
        live(1.05, (h, t, dt, g) => {
          if (h.age < 0.12) {
            const fk = 1 - h.age / 0.12;
            g.add.circle(rx, rFoot - 28, 18 + 14 * (1 - fk)).fill({ color: 0xffffff, alpha: 0.85 * fk });
          }
          if (h.age >= 0.08) {
            const sag = h.age < windup ? Math.max(0, (h.age - windup * 0.45) / (windup * 0.55)) * 16 : Math.max(0, 16 * (1 - (h.age - windup) / 0.16));
            const fade = h.age < 0.92 ? 1 : 1 - (h.age - 0.92) / 0.13;
            this.drawRopes(g, rx, rFoot, sag, 0.96 * fade);
          }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Front-flip beige crescent arc in mid-flight, then 4 crisp white vertical dive speed lines on descent.
        live(0.68, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          if (h.age > 0.12 && h.age < 0.36) {
            const fk = Math.sin(((h.age - 0.12) / 0.24) * Math.PI);
            crescent(g.top, at.x + c * 6, at.y, 68, c, 0xf2dec0, 0.88 * fk, 11);
            crescent(g.add, at.x + c * 4, at.y, 56, c, 0xffffff, 0.72 * fk, 5);
          }
          if (h.age >= 0.32) {
            for (let i = 0; i < 4; i++) {
              const ox = (i - 1.5) * 14, len = 46 + (i % 2) * 20;
              g.add.rect(at.x + ox - 1.5, at.y - 16 - len, 3, len).fill({ color: 0xffffff, alpha: 0.84 });
            }
          }
        });
      },
      hit({ x, y, groundY }) {
        // Post-HS: white squash flash + orange spiky starburst + white->orange expanding ground ring + white dust + crack.
        live(0.48, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.12);
          const k = Math.min(1, post / 0.34);
          const fade = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
          if (post < 0.14) {
            const fk = 1 - post / 0.14;
            g.add.ellipse(x, groundY, 46, 20).fill({ color: 0xffffff, alpha: 0.94 * fk });
          }
          spiky(g.top, x, y - 2, 48 * (0.7 + 0.3 * (1 - k)), 10, 0xff7818, 0.92 * fade, h.seed);
          spiky(g.add, x, y - 2, 26 * (1 - k * 0.4), 10, 0xfff4c8, 0.95 * fade, h.seed);
          groundRing(g.top, x, groundY + 4, 24 + 62 * k, k < 0.4 ? 0xffffff : 0xff8a24, 0.9 * fade, 4.5 - 2 * k);
          groundRing(g.top, x, groundY + 4, 14 + 44 * k, 0xffd288, 0.65 * fade, 2.5);
        });
        dust(x, groundY + 2, 7, [232, 228, 220], 95);
        pebbles(x, groundY + 8, 12, 95, [96, 92, 88], 4.5, 6);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 46, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Seismic Toss
    seismicToss: {
      release({ follow }) {
        // Dust puffs behind the short grab dash.
        live(0.28, (h, t, dt) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.05) { h.acc -= 0.05; dust(at.x, at.footY + 2, 2, [178, 154, 126], 60); }
        });
      },
      hit({ x, y, groundY, hitIndex = null, final = null }) {
        // Hit 0 = Grab: curved orange & white spin arcs follow the 2-turn ascent, then a tall vertical orange plunge pillar!
        if (hitIndex === 0 && final === false) {
          whiteBloom(x, y - 6, 16, 36, 0.1);
          live(1.38, (h, t, dt, g) => {
            const age = h.age;
            if (age < 1.0) {
              // Climbing + spinning 2 turns: height mirrors target lift (up 0.34s, hang 0.66s).
              const lift = age < 0.34 ? 195 * (1 - Math.pow(1 - age / 0.34, 2)) : 195;
              const cy = y - lift;
              for (let i = 0; i < 3; i++) {
                const a0 = age * 14 + i * 2.1;
                const pts = [];
                for (let k = 0; k <= 8; k++) {
                  const a = a0 + k * 0.24;
                  pts.push(x + Math.cos(a) * (40 + i * 8), cy + Math.sin(a) * (16 + i * 4));
                }
                g.top.poly(pts).stroke({ color: i % 2 === 0 ? 0xff9a38 : 0xffffff, width: 4 - i * 0.6, alpha: 0.78 });
              }
            } else {
              // Vertical plunge (1.00s -> 1.15s) + lingering vertical orange light pillar (~0.3s after slam).
              const pk = Math.min(1, (age - 1.0) / 0.15);
              const fade = age < 1.16 ? 0.85 : Math.max(0, 0.85 * (1 - (age - 1.16) / 0.24));
              const topY = groundY - 210 * (1 - Math.max(0, (age - 1.16) / 0.24) * 0.3);
              const botY = groundY - 210 * (1 - pk);
              g.top.rect(x - 22, topY, 44, Math.max(12, botY - topY)).fill({ color: 0xff8c28, alpha: fade * 0.65 });
              g.add.rect(x - 10, topY, 20, Math.max(12, botY - topY)).fill({ color: 0xffe49c, alpha: fade * 0.72 });
            }
          });
          return;
        }
        // Final Hit = Slam: ring of 9 grey boulder chunks + brown dust cloud + persistent black radial crack & rock ring.
        const rocks = Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * TAU + 0.18;
          return { a, dist: 38 + (i % 3) * 14, r: 9 + (i % 3) * 3 };
        });
        live(4.5, (h, t, dt, g) => {
          const fade = t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18;
          const spread = Math.min(1, h.age / 0.18);
          if (h.age < 0.45) {
            const rf = 1 - h.age / 0.45;
            groundRing(g.top, x, groundY + 4, 28 + 74 * (h.age / 0.45), 0xd8a868, 0.85 * rf, 4);
          }
          for (const rk of rocks) {
            const rx = x + Math.cos(rk.a) * rk.dist * spread;
            const ry = groundY + 4 + Math.sin(rk.a) * rk.dist * 0.46 * spread;
            const r = rk.r;
            g.top.poly([rx - r, ry + r * 0.3, rx - r * 0.7, ry - r * 0.7, rx + r * 0.2, ry - r * 0.85, rx + r, ry + r * 0.1, rx + r * 0.4, ry + r * 0.6, rx - r * 0.5, ry + r * 0.6])
              .fill({ color: 0x423e3a, alpha: 0.95 * fade });
            g.top.poly([rx - r * 0.75, ry + r * 0.2, rx - r * 0.5, ry - r * 0.52, rx + r * 0.15, ry - r * 0.65, rx + r * 0.75, ry, rx + r * 0.3, ry + r * 0.42, rx - r * 0.4, ry + r * 0.42])
              .fill({ color: 0x98948e, alpha: 0.95 * fade });
          }
        });
        dust(x, groundY + 2, 12, [166, 144, 118], 130);
        pebbles(x, groundY + 6, 16, 120, [110, 102, 94], 4.5, 6);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 58, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.6);
      }
    },

    // ------------------------------------------------------------------ Superpower
    superpower: {
      // Faceted blue-purple crystal/rock pillar tilted at angle `tilt` from base (bx, by).
      crystalPillar(g, bx, by, tilt, len, hw, alpha) {
        if (!g || alpha <= 0.02 || len < 6) return;
        const ux = Math.sin(tilt), uy = -Math.cos(tilt), vx = Math.cos(tilt), vy = Math.sin(tilt);
        const pt = (al, si) => [bx + ux * al + vx * si, by + uy * al + vy * si];
        const poly = (list, col, a = alpha) => {
          const flat = [];
          for (const [al, si] of list) { const p = pt(al, si); flat.push(p[0], p[1]); }
          g.top.poly(flat).fill({ color: col, alpha: a });
        };
        poly([[0, -hw - 2.5], [len * 0.84, -hw * 0.88 - 2.5], [len + 4, 0], [len * 0.84, hw * 0.88 + 2.5], [0, hw + 2.5]], 0x222a5a);
        poly([[0, -hw], [len * 0.84, -hw * 0.86], [len, 0], [len * 0.84, hw * 0.86], [0, hw]], 0x627ae0);
        poly([[2, -hw * 0.9], [len * 0.82, -hw * 0.78], [len * 0.95, 0], [len * 0.8, -hw * 0.06], [2, -hw * 0.08]], 0xaec2ff);
        poly([[2, hw * 0.15], [len * 0.82, hw * 0.12], [len * 0.82, hw * 0.78], [2, hw * 0.86]], 0x4256b0);
      },
      cast({ follow, windup = 0.6 }) {
        const at0 = follow?.();
        if (!at0) return;
        const sx = at0.x, sFoot = at0.footY;
        // Orange spiky battle aura behind crouching caster during 0.6 s charge.
        live(Math.max(0.25, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const flick = Math.sin(h.age * 46) * 4;
          for (let i = -2; i <= 2; i++) {
            flameSpike(g.top, at.x + i * 12, at.footY + 2, (36 + 24 * t - Math.abs(i) * 7) + flick * (i % 2 ? 1 : -1), 10, 0xe85a14, 0.9, i * 4);
            flameSpike(g.add, at.x + i * 10, at.footY + 2, (22 + 16 * t - Math.abs(i) * 4), 5, 0xffd868, 0.85, i * 2);
          }
          groundRing(g.top, at.x, at.footY + 3, 28 + 24 * t, 0xff8c28, 0.75 * (1 - t * 0.3), 3.5);
        });
        // 7 blue-purple rock chunks erupting around the takeoff feet and staying on ground for 4.5 s (greying later).
        const chips = Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * TAU + 0.3;
          return { x: sx + Math.cos(a) * (32 + (i % 2) * 14), y: sFoot + 4 + Math.sin(a) * 16, r: 7 + (i % 3) * 2.5, delay: i * 0.065 };
        });
        live(4.5, (h, t, dt, g) => {
          const fade = t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18;
          const grey = h.age > 2.0;
          for (const ch of chips) {
            if (h.age < ch.delay) continue;
            const pop = Math.min(1, (h.age - ch.delay) / 0.1);
            const r = ch.r * pop;
            g.top.poly([ch.x - r, ch.y + r * 0.3, ch.x - r * 0.6, ch.y - r * 0.8, ch.x + r * 0.4, ch.y - r * 0.7, ch.x + r, ch.y + r * 0.2, ch.x, ch.y + r * 0.6])
              .fill({ color: grey ? 0x4c4a48 : 0x2a3264, alpha: 0.92 * fade });
            g.top.poly([ch.x - r * 0.7, ch.y + r * 0.2, ch.x - r * 0.4, ch.y - r * 0.6, ch.x + r * 0.3, ch.y - r * 0.5, ch.x + r * 0.7, ryFix(ch.y, r)])
              .fill({ color: grey ? 0x8e8c88 : 0x7a92f0, alpha: 0.94 * fade });
          }
        });
        function ryFix(cy, r) { return cy + r * 0.15; }
      },
      release({ follow }) {
        const smokeStops = [[0, [242, 186, 172], 0.72], [1, [200, 152, 144], 0]];
        // Fiery orange rocket-jet flame under feet throughout the high parabolic leap + pale pink-orange smoke puffs.
        live(0.55, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const flick = Math.sin(h.age * 55) * 4;
          flameSpike(g.top, at.x, at.y + 44, -42 - flick, 18, 0xe84c10, 0.94, flick);
          flameSpike(g.add, at.x, at.y + 38, -28 - flick * 0.5, 10, 0xffe068, 0.92, -flick * 0.5);
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.08) {
            h.acc -= 0.08;
            spawnP({ shape: 'pxpuff', x: at.x, y: at.y + 24, vx: (rand() - 0.5) * 30, vy: 16, size: 12, size1: 22, stops: smokeStops, add: false, drag: 0.9, life: 0.34 });
          }
        });
      },
      hit({ x, y, groundY }) {
        // Thick orange-brown shockwave ring + fan of 6 tall blue-purple crystal pillars standing ~2.2 s + smoke & blue shards.
        const pillars = [
          { ox: -54, oy: 4, tilt: -0.62, len: 86, hw: 13 },
          { ox: -34, oy: -4, tilt: -0.32, len: 108, hw: 14.5 },
          { ox: -12, oy: -6, tilt: -0.08, len: 96, hw: 13.5 },
          { ox: 14, oy: -6, tilt: 0.12, len: 102, hw: 14 },
          { ox: 36, oy: -2, tilt: 0.34, len: 112, hw: 14.5 },
          { ox: 56, oy: 4, tilt: 0.6, len: 84, hw: 13 }
        ];
        live(2.35, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          const grow = Math.min(1, post / 0.16);
          const fade = h.age < 2.0 ? 1 : 1 - (h.age - 2.0) / 0.35;
          if (post < 0.48) {
            const rk = post / 0.48;
            groundRing(g.top, x, groundY + 6, 36 + 104 * rk, 0xd86e22, 0.92 * (1 - rk), 8 - 4 * rk);
            groundRing(g.top, x, groundY + 6, 22 + 78 * rk, 0xffbe68, 0.72 * (1 - rk), 4 - 2 * rk);
          }
          for (const p of pillars) {
            this.crystalPillar(g, x + p.ox, groundY + 8 + p.oy, p.tilt, p.len * grow, p.hw, 0.96 * fade);
          }
          // Billowing grey-white smoke at center of crystal fan during first 1.0 s.
          if (post < 1.05) {
            const sf = 1 - post / 1.05;
            g.top.ellipse(x, groundY - 12, 34 + 14 * (1 - sf), 24).fill({ color: 0xe6e8ee, alpha: 0.46 * sf });
          }
        });
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + (rand() - 0.5) * 1.9;
          const spd = 120 + rand() * 180;
          spawnP({ shape: 'shard', x: x + (rand() - 0.5) * 44, y: groundY - 8, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.7,
            vz: 160 + rand() * 140, gravity: 440, size: 5 + rand() * 4, size1: 3, rot: a, vrot: (rand() - 0.5) * 12,
            stops: [[0, [140, 168, 255], 0.95], [1, [76, 98, 210], 0]], add: false, life: 0.65 + rand() * 0.25 });
        }
        dust(x, groundY + 2, 10, [216, 218, 224], 115);
        pebbles(x, groundY + 8, 14, 120, [104, 102, 100], 4.5, 6);
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 56, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.6);
      }
    },

    // ------------------------------------------------------------------ Counter
    counter: {
      cast({ follow, windup = 0.44 }) {
        // Spiky crimson crystal-cluster aura wrapping the caster + 2 concentric red ground rings during counter brace.
        live(Math.max(0.2, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const pulse = 0.85 + 0.15 * Math.sin(h.age * 38);
          groundRing(g.top, at.x, at.footY + 3, 28 + 22 * t, 0xd81c3a, 0.9, 3.5);
          groundRing(g.top, at.x, at.footY + 3, 18 + 14 * t, 0xff5a7a, 0.78, 2.5);
          for (let i = -2; i <= 2; i++) {
            const ox = i * 11;
            const len = (36 + 18 * t - Math.abs(i) * 6) * pulse;
            flameSpike(g.top, at.x + ox, at.footY + 2, len, 9, 0x9c0e24, 0.92, i * 5);
            flameSpike(g.add, at.x + ox, at.footY + 2, len * 0.68, 4.5, 0xff3864, 0.85, i * 3);
          }
        });
      },
      release({ follow }) {
        // Crimson aura lingers briefly into the riposte strike.
        live(0.24, (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          const fade = 1 - t;
          groundRing(g.top, at.x, at.footY + 3, 38 + 16 * t, 0xd81c3a, 0.85 * fade, 3.5);
          spiky(g.top, at.x, at.y, 32 * fade, 9, 0xc81434, 0.72 * fade, h.seed);
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Post-HS: magenta-red spiky starburst with bright white core (0.26s) -> 3 parallel diagonal crimson slash gashes (0.34s).
        live(0.62, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          if (post < 0.28) {
            const bk = post / 0.28;
            const bf = bk < 0.6 ? 1 : 1 - (bk - 0.6) / 0.4;
            const r = 46 + 22 * Math.min(1, bk * 1.6);
            spiky(g.top, x - c * 8, y - 4, r + 4, 11, 0x6a0a1c, 0.94 * bf, h.seed);
            spiky(g.top, x - c * 8, y - 4, r, 11, 0xd81842, 0.95 * bf, h.seed);
            spiky(g.add, x - c * 8, y - 4, r * 0.56, 11, 0xff82a4, 0.92 * bf, h.seed);
            g.add.circle(x - c * 8, y - 4, 15 * bf).fill({ color: 0xffffff, alpha: 0.98 * bf });
            groundRing(g.top, x, groundY + 4, 34 + 38 * bk, 0xd81c3a, 0.85 * bf, 3.5);
          }
          if (post >= 0.16) {
            const sk = Math.min(1, (post - 0.16) / 0.38);
            const sf = sk < 0.65 ? 1 : 1 - (sk - 0.65) / 0.35;
            const draw = Math.min(1, sk / 0.22);
            // 3 parallel diagonal crimson claw gashes sweeping top-right to bottom-left across target.
            for (let i = -1; i <= 1; i++) {
              const ox = i * 16, oy = i * 8;
              const x0 = x + 36 + ox, y0 = y - 48 + oy;
              const x1 = x0 - 76 * draw, y1 = y0 + 96 * draw;
              g.top.poly([x0 - 4, y0 - 3, x0 + 5, y0 + 3, x1 + 4, y1 + 2, x1 - 4, y1 - 2]).fill({ color: 0x5c0818, alpha: 0.94 * sf });
              g.top.poly([x0 - 2, y0 - 1.5, x0 + 3, y0 + 1.5, x1 + 2, y1 + 1, x1 - 2, y1 - 1]).fill({ color: 0xe6223c, alpha: 0.96 * sf });
              g.add.poly([x0, y0, x0 + 1.5, y0 + 1, x1 + 1, y1 + 0.5, x1 - 0.5, y1 - 0.5]).fill({ color: 0xffa6bc, alpha: 0.78 * sf });
            }
          }
        });
        pebbles(x - c * 16, groundY + 8, 12, 95, [96, 86, 82], 4.5, 6);
        addDecal({ x: x - c * 16, y: groundY + 8, kind: 'crack', radius: 44, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.55);
      }
    },

    // ------------------------------------------------------------------ Revenge
    revenge: {
      cast({ follow, angle = 0, windup = 0.3 }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Brief glint at the apex of the backward recoil hop right before snapping into the dive-punch.
        live(Math.max(0.16, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          if (t > 0.65) {
            const gk = Math.sin(((t - 0.65) / 0.35) * Math.PI);
            star4(g.add, at.x - c * 42, at.y - 60, 14 * gk, 0xfff4d0, 0.92 * gk);
          }
        });
      },
      hit({ x, y, groundY }) {
        // Tight warm orange-red spiky starburst right at fist contact + beige dust puff rising at target's feet.
        live(0.26, (h, t, dt, g) => {
          const fade = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
          const r = 24 + 14 * Math.min(1, t * 2.2);
          spiky(g.top, x, y - 6, r + 3, 9, 0xa8240c, 0.92 * fade, h.seed);
          spiky(g.top, x, y - 6, r, 9, 0xff521c, 0.96 * fade, h.seed);
          spiky(g.add, x, y - 6, r * 0.54, 9, 0xfff8e2, 0.98 * fade, h.seed);
        });
        dust(x, groundY + 2, 7, [196, 176, 146], 90);
        dizzy(x, y, 0.45);
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

    // ------------------------------------------------------------------ Air Cutter
    airCutter: {
      // Spinning 5-blade purple-white wind shuriken centered at (x, y).
      shuriken(g, x, y, r, rot, alpha = 1) {
        if (!g || alpha <= 0.02) return;
        for (let i = 0; i < 5; i++) {
          const a = rot + (i / 5) * TAU;
          const b1 = a + 0.35, b2 = a + 0.92;
          g.top.poly([
            x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25,
            x + Math.cos(b1) * r * 0.72, y + Math.sin(b1) * r * 0.72,
            x + Math.cos(b2) * r, y + Math.sin(b2) * r,
            x + Math.cos(b1 + 0.22) * r * 0.44, y + Math.sin(b1 + 0.22) * r * 0.44
          ]).fill({ color: 0x7c4ad8, alpha: 0.92 * alpha });
          g.add.poly([
            x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22,
            x + Math.cos(b1) * r * 0.62, y + Math.sin(b1) * r * 0.62,
            x + Math.cos(b2 - 0.08) * r * 0.82, y + Math.sin(b2 - 0.08) * r * 0.82
          ]).fill({ color: 0xeee4ff, alpha: 0.92 * alpha });
        }
        g.add.circle(x, y, r * 0.28).fill({ color: 0xffffff, alpha: 0.96 * alpha });
      },
      cast({ follow, windup = 0.2 }) {
        // 4 purple-white swirling wind lines wrapping the stationary caster.
        live(Math.max(0.14, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          for (let i = 0; i < 4; i++) {
            const a0 = h.age * 18 + i * 1.57;
            const pts = [];
            for (let k = 0; k <= 7; k++) {
              const a = a0 + k * 0.28;
              pts.push(at.x + Math.cos(a) * (24 + (i % 2) * 8), at.y + Math.sin(a) * 20 - (i - 1.5) * 6);
            }
            g.top.poly(pts).stroke({ color: i % 2 ? 0x9b68f0 : 0xf0e8ff, width: 3, alpha: 0.85 });
          }
        });
      },
      projectile({ follow, life = 1.2 }) {
        const dashStops = [[0, [130, 126, 138], 0.5], [1, [130, 126, 138], 0]];
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const fy = at.footY ?? (at.y + 18);
          // Pale purple ground shadow directly beneath the spinning blade + dashed grey ground line behind it.
          g.top.ellipse(at.x, fy + 4, 24, 9).fill({ color: 0x5c3c88, alpha: 0.34 });
          this.shuriken(g, at.x, at.y - 4, 30, h.age * 20, 0.96);
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.035) {
            h.acc -= 0.035;
            spawnP({ shape: 'px', x: at.x, y: fy + 4, size: 5, size1: 5, stops: dashStops, add: false, life: 1.5, drag: 1 });
          }
        });
      },
      hit({ x, y }) {
        // Post-dual-HS: the spinning purple-white wind shuriken stays grinding on the target ~0.4 s then scatters shards.
        live(0.46, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.12);
          const fade = post < 0.24 ? 1 : Math.max(0, 1 - (post - 0.24) / 0.14);
          this.shuriken(g, x, y - 4, 32 * (0.95 + 0.15 * Math.sin(h.age * 40)), h.age * 24, fade);
          if (post > 0.26 && !h.burst) {
            h.burst = true;
            for (let i = 0; i < 10; i++) {
              const a = rand() * TAU;
              spawnP({ shape: 'shard', x, y, vx: Math.cos(a) * (120 + rand() * 110), vy: Math.sin(a) * 90 - 20,
                size: 6 + rand() * 3, size1: 1.5, rot: a, vrot: (rand() - 0.5) * 14,
                stops: [[0, [240, 232, 255], 1], [0.5, [150, 96, 235], 0.9], [1, [110, 60, 195], 0]], add: true, life: 0.26 });
            }
          }
        });
        dizzy(x, y, 0.45);
      }
    },

    // ------------------------------------------------------------------ Air Slash
    airSlash: {
      // Wide, sweeping hollow C-shaped crescent arc bulging toward `dir`, tapering to razor points.
      wideCrescent(g, cx, cy, rx, ry, thick, dir, color, alpha) {
        if (!g || alpha <= 0.02) return;
        const pts = [], inner = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const a = (u - 0.5) * 2.55;
          const ox = cx + dir * (Math.cos(a) * rx - rx * 0.32);
          const oy = cy + Math.sin(a) * ry;
          pts.push(ox, oy);
          const taper = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 0.85);
          inner.unshift(ox - dir * thick * taper, oy);
        }
        g.poly([...pts, ...inner]).fill({ color, alpha });
      },
      release({ follow, angle = 0 }) {
        // Crisp expanding white ground ring + brief forming crescent flash on every one of the 3 wing-sweeps.
        const at = follow?.();
        if (!at) return;
        const rx = at.x, ry = at.footY + 3, dir = Math.cos(angle) >= 0 ? 1 : -1;
        live(0.28, (h, t, dt, g) => {
          const fade = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
          groundRing(g.top, rx, ry, 20 + 36 * t, 0x70d8ff, 0.72 * fade, 4.5 - 2 * t);
          groundRing(g.add, rx, ry, 18 + 34 * t, 0xffffff, 0.94 * fade, 3.5 - 1.5 * t);
          if (h.age < 0.12) {
            const fk = 1 - h.age / 0.12;
            this.wideCrescent(g.add, rx + dir * 14, at.y - 6, 36, 44, 14, dir, 0xffffff, 0.85 * fk);
          }
        });
      },
      projectile({ follow, angle = 0, life = 1.0 }) {
        const dotStops = [[0, [164, 144, 120], 0.65], [1, [164, 144, 120], 0]];
        live(life, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const a = at.angle ?? angle, dir = Math.cos(a) >= 0 ? 1 : -1;
          const fy = at.footY ?? (at.y + 18);
          // Large (~1.2x body height) sweeping hollow C-crescent wave with feathered cyan bloom + razor white core.
          this.wideCrescent(g.top, at.x - dir * 4, at.y - 6, 48, 54, 24, dir, 0x2cb6f8, 0.76);
          this.wideCrescent(g.top, at.x, at.y - 6, 44, 50, 17, dir, 0x86e6ff, 0.94);
          this.wideCrescent(g.add, at.x + dir * 2, at.y - 6, 41, 46, 11, dir, 0xffffff, 0.98);
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.03) {
            h.acc -= 0.03;
            spawnP({ shape: 'pxpuff', x: at.x - dir * 6, y: fy + 4, vx: -dir * 35, vy: -8, size: 6, size1: 10, stops: dotStops, add: false, life: 0.42, drag: 0.9 });
          }
        });
      },
      hit({ x, y, groundY, angle = 0 }) {
        const dir = Math.cos(angle) >= 0 ? 1 : -1;
        // Bold engulfing white-cyan starburst flash + scuff dust on every crescent hit.
        live(0.32, (h, t, dt, g) => {
          const fade = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
          const grow = Math.min(1, t / 0.16);
          spiky(g.top, x, y - 6, 62 * (0.72 + 0.38 * grow), 10, 0x2cb8ff, 0.92 * fade, h.seed);
          spiky(g.top, x, y - 6, 48 * (0.78 + 0.28 * grow), 10, 0xbef2ff, 0.96 * fade, h.seed + 0.3);
          spiky(g.add, x, y - 6, 36 * fade, 8, 0xffffff, 0.98 * fade, h.seed + 0.6);
          star4(g.add, x, y - 6, 42 * fade, 0xffffff, 0.98 * fade);
          this.wideCrescent(g.add, x + dir * 4, y - 6, 38, 44, 12, dir, 0xffffff, 0.85 * fade);
          groundRing(g.top, x, groundY + 4, 24 + 34 * t, 0x7ae2ff, 0.75 * fade, 3);
        });
        dust(x, groundY + 2, 5, [178, 156, 128], 85);
      }
    },

    // ------------------------------------------------------------------ Drill Peck
    drillPeck: {
      // Spiral tan-gold cone drill projecting forward from (bx, by) along `angle`.
      drawDrill(g, bx, by, angle, len, baseHalf, age, alpha = 1) {
        if (!g || alpha <= 0.02) return;
        const c = Math.cos(angle), s = Math.sin(angle), nx = -s, ny = c;
        const tipX = bx + c * len, tipY = by + s * len;
        g.top.poly([bx + nx * (baseHalf + 2.5), by + ny * (baseHalf + 2.5), tipX + c * 4, tipY + s * 4, bx - nx * (baseHalf + 2.5), by - ny * (baseHalf + 2.5)])
          .fill({ color: 0x46341a, alpha });
        g.top.poly([bx + nx * baseHalf, by + ny * baseHalf, tipX, tipY, bx - nx * baseHalf, by - ny * baseHalf])
          .fill({ color: 0xdcb46c, alpha });
        g.add.poly([bx + nx * baseHalf * 0.45, by + ny * baseHalf * 0.45, tipX, tipY, bx, by])
          .fill({ color: 0xfff0c4, alpha: alpha * 0.72 });
        // Animated spiral grooves racing along the cone.
        const phase = (age * 16) % 1;
        for (let i = 0; i < 4; i++) {
          const f = (i + phase) / 4;
          const r = baseHalf * (1 - f);
          const mx = bx + c * (len * f), my = by + s * (len * f);
          g.top.moveTo(mx + nx * r, my + ny * r).lineTo(mx - nx * r + c * 7, my - ny * r + s * 7)
            .stroke({ color: 0x6a4e26, width: 2.5, alpha: 0.9 * alpha });
        }
      },
      cast({ follow, windup = 0.22 }) {
        const at0 = follow?.();
        if (at0) dust(at0.x, at0.footY + 2, 6, [176, 152, 122], 78);
        // Brief airborne spin-tuck wind swirl as the caster rises before diving diagonally.
        live(Math.max(0.14, windup), (h, t, dt, g) => {
          const at = follow?.(); if (!at) return;
          if (t > 0.35) {
            const k = Math.sin(((t - 0.35) / 0.65) * Math.PI);
            g.add.ellipse(at.x, at.y - 16, 26, 12).stroke({ color: 0xfff2d2, width: 2.5, alpha: 0.85 * k });
          }
        });
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle), dir = c >= 0 ? 1 : -1;
        // Giant spiral cone drill tilts diagonally downward during the elevated dive, then grinds flat through all 5 rapid hits.
        live(0.76, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const air = Math.max(0, (at.footY - 30) - at.y);
          const tiltAng = angle + dir * Math.min(0.32, air * 0.006);
          const vib = Math.sin(h.age * 95) * 3;
          this.drawDrill(g, at.x + Math.cos(tiltAng) * 8, at.y - 2 + vib, tiltAng, 82, 18, h.age, 0.98);
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.028) {
            h.acc -= 0.028;
            spawnP({ shape: 'streak', x: at.x - c * 18, y: at.y + (rand() - 0.5) * 26, vx: -c * 145, vy: -s * 145,
              size: 6, size1: 1, stretch: 2.5, rot: tiltAng + Math.PI, stops: [[0, [255, 255, 255], 0.88], [1, [230, 224, 196], 0]], add: true, life: 0.13 });
          }
        });
      },
      hit({ x, y, groundY, angle = 0, final = null }) {
        const dir = Math.cos(angle) >= 0 ? 1 : -1;
        if (final === false) {
          // Rapid bright white-gold drill sparks on each of the 5 rapid jabs.
          live(0.12, (h, t, dt, g) => {
            const k = 1 - t;
            const ox = (rand() - 0.5) * 18, oy = (rand() - 0.5) * 14;
            spiky(g.top, x + ox, y - 4 + oy, 22 * k, 6, 0xffd862, 0.88 * k, h.seed);
            star4(g.add, x + ox, y - 4 + oy, 18 * k, 0xffffff, 0.98 * k);
          });
          return;
        }
        // Final pop-off burst: huge golden-white spiky starburst explosion + trailing brown skid dust cloud along knockback!
        live(0.42, (h, t, dt, g) => {
          const fade = t < 0.58 ? 1 : 1 - (t - 0.58) / 0.42;
          const grow = Math.min(1, t / 0.16);
          spiky(g.top, x, y - 4, 74 * (0.72 + 0.34 * grow), 12, 0xb86a14, 0.92 * fade, h.seed);
          spiky(g.top, x, y - 4, 64 * (0.76 + 0.3 * grow), 12, 0xffc838, 0.96 * fade, h.seed + 0.25);
          spiky(g.add, x, y - 4, 42 * fade, 10, 0xffffff, 0.98 * fade, h.seed + 0.5);
          star4(g.add, x, y - 4, 52 * fade, 0xffffff, 0.98 * fade);
          groundRing(g.top, x, groundY + 4, 28 + 64 * t, 0xffd268, 0.88 * fade, 4);
        });
        // Trailing brown skid dust cloud following the knocked-back target.
        for (let i = 0; i < 4; i++) {
          dust(x + dir * (14 + i * 24), groundY + 3, 4, [166, 138, 104], 92);
        }
        pebbles(x + dir * 32, groundY + 6, 10, 90, [132, 106, 78], 2.2, 5);
        dizzy(x + dir * 48, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Dual Wingbeat
    dualWingbeat: {
      release({ follow, angle = 0 }) {
        // 5-6 cyan-white horizontal streak trails behind the low aerial rush.
        trail(follow, angle, [196, 232, 255], { life: 0.35, every: 0.014, spread: 34, size: 8 });
      },
      hit({ x, y, groundY, angle = 0, final = null }) {
        const c = Math.cos(angle) >= 0 ? 1 : -1;
        // Curved cyan-white wing-blade arc on each of the 2 hits.
        live(0.26, (h, t, dt, g) => {
          const fade = 1 - t;
          const dir = final ? -c : c;
          crescent(g.top, x - dir * 8, y - 10, final ? 96 : 74, dir, 0x8ad8ff, 0.9 * fade, final ? 16 : 12);
          crescent(g.add, x - dir * 6, y - 10, final ? 80 : 60, dir, 0xffffff, 0.95 * fade, final ? 8 : 6);
          if (!final) g.add.circle(x, y - 6, 18 * fade).fill({ color: 0xffffff, alpha: 0.9 * fade });
        });
        if (!final) return;
        // Second hit: shattered red-brown ground crater + slow-drifting grey pebbles lasting 4.5 s.
        dust(x, groundY + 2, 8, [164, 128, 108], 105);
        for (let i = 0; i < 8; i++) {
          spawnP({ shape: 'shard', x: x + (rand() - 0.5) * 44, y: groundY + 2, vx: (rand() - 0.5) * 35, vy: -35 - rand() * 45,
            size: 5 + rand() * 3, size1: 3, rot: rand() * TAU, vrot: (rand() - 0.5) * 6,
            stops: [[0, [142, 136, 132], 0.9], [1, [120, 114, 110], 0]], add: false, life: 0.75 + rand() * 0.35 });
        }
        addDecal({ x, y: groundY + 8, kind: 'scorch', radius: 42, pal: 'earth', life: 4.5 });
        addDecal({ x, y: groundY + 8, kind: 'crack', radius: 46, pal: 'earth', life: 4.5 });
        dizzy(x, y, 0.5);
      }
    },

    // ------------------------------------------------------------------ Wing Attack
    wingAttack: {
      cast({ follow }) {
        const at = follow?.();
        if (at) dust(at.x, at.footY + 2, 4, [176, 152, 122], 65);
      },
      release({ follow, angle = 0 }) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const dotStops = [[0, [156, 132, 106], 0.65], [1, [156, 132, 106], 0]];
        // Cyan-white leading wing blade + orange/blue dual streak trail + ground dust dots along dive.
        live(0.42, (h, t, dt, g) => {
          const at = follow?.(); if (!at) { h.age = h.life; return; }
          const dir = c >= 0 ? 1 : -1;
          crescent(g.top, at.x + dir * 18, at.y - 4, 68, dir, 0x8ee2ff, 0.88, 12);
          crescent(g.add, at.x + dir * 20, at.y - 4, 58, dir, 0xffffff, 0.94, 6);
          h.acc = (h.acc ?? 0) + dt;
          while (h.acc >= 0.022) {
            h.acc -= 0.022;
            spawnP({ shape: 'streak', x: at.x - c * 14, y: at.y + (rand() - 0.5) * 18, vx: -c * 110, vy: -s * 110,
              size: 7, size1: 1.5, stretch: 2.8, rot: angle + Math.PI, stops: [[0, [255, 162, 68], 0.85], [1, [156, 224, 255], 0]], add: true, life: 0.22 });
            spawnP({ shape: 'px', x: at.x, y: at.footY + 4, size: 5, size1: 3, stops: dotStops, add: false, life: 0.8, drag: 1 });
          }
        });
      },
      hit({ x, y, groundY, final = null }) {
        if (final === false) {
          whiteBloom(x, y - 4, 18, 42, 0.14);
          return;
        }
        // Hit 2: full circular cyan-white spinning wing-slash ring sweeping around target + brown scuff mark.
        live(0.32, (h, t, dt, g) => {
          const post = Math.max(0, h.age - 0.06);
          const fade = Math.max(0, 1 - post / 0.24);
          const rot = h.age * 16;
          for (let i = 0; i < 2; i++) {
            const a0 = rot + i * Math.PI;
            const pts = [];
            for (let k = 0; k <= 10; k++) {
              const a = a0 + k * 0.22;
              pts.push(x + Math.cos(a) * 48, y - 4 + Math.sin(a) * 26);
            }
            g.top.poly(pts).stroke({ color: 0x7ad8ff, width: 10, alpha: 0.88 * fade });
            g.add.poly(pts).stroke({ color: 0xffffff, width: 4.5, alpha: 0.96 * fade });
          }
        });
        pebbles(x, groundY + 6, 8, 65, [132, 108, 86], 1.8, 5);
        addDecal({ x, y: groundY + 6, kind: 'scorch', radius: 24, pal: 'earth', life: 1.8 });
        dizzy(x, y, 0.45);
      }
    },

    // ------------------------------------------------------------------ Defog
    defog: {
      release({ follow }) {
        const at0 = follow?.();
        if (!at0) return;
        const cx = at0.x, fy = at0.footY + 3;
        const wisps = Array.from({ length: 28 }, (_, i) => ({
          a: (i / 28) * TAU + (i % 3) * 0.08,
          r0: 36 + (i % 4) * 14,
          spd: 220 + (i % 5) * 48,
          len: 18 + (i % 3) * 10
        }));
        // Expanding white ground wind ring -> spiky glass-shard wind ring -> dozens of horizontal wind wisps sweeping the arena!
        live(0.95, (h, t, dt, g) => {
          if (h.age < 0.52) {
            const rk = h.age / 0.52;
            const r = 24 + 240 * rk;
            const fade = rk < 0.65 ? 0.92 : 0.92 * (1 - (rk - 0.65) / 0.35);
            groundRing(g.add, cx, fy, r, 0xffffff, fade, 4 - 2 * rk);
            groundRing(g.top, cx, fy, r * 0.72, 0xdcf4ff, fade * 0.65, 2);
            // Spiky white radial wind teeth protruding outward around the expanding ring.
            for (let i = 0; i < 18; i++) {
              const a = (i / 18) * TAU + h.age * 1.4;
              const rx0 = cx + Math.cos(a) * r, ry0 = fy + Math.sin(a) * r * 0.42;
              const len = 14 + 14 * (1 - rk);
              g.add.moveTo(rx0, ry0).lineTo(rx0 + Math.cos(a) * len, ry0 + Math.sin(a) * len * 0.42)
                .stroke({ color: 0xffffff, width: 2.5, alpha: fade * 0.9 });
            }
          }
          // Field-wide drifting horizontal white wind wisps.
          if (h.age > 0.22) {
            const wk = (h.age - 0.22) / 0.73;
            const wf = wk < 0.6 ? 0.82 : 0.82 * (1 - (wk - 0.6) / 0.4);
            for (const w of wisps) {
              const dist = w.r0 + w.spd * (h.age - 0.22);
              const wx = cx + Math.cos(w.a) * dist;
              const wy = fy + Math.sin(w.a) * dist * 0.42;
              g.add.moveTo(wx - w.len * 0.5, wy).lineTo(wx + w.len * 0.5, wy)
                .stroke({ color: 0xffffff, width: 2.2, alpha: wf });
            }
          }
        });
      },
      hit() {}
    },

    // ------------------------------------------------------------------ Roost
    roost: {
      release({ follow }) {
        const at0 = follow?.();
        if (!at0) return;
        const cx = at0.x, fy = at0.footY + 2;
        const feathers = Array.from({ length: 8 }, (_, i) => ({
          ox: (i - 3.5) * 14,
          oy: -10 - (i % 3) * 10,
          vx: (i - 3.5) * 12,
          vy: -42 - (i % 3) * 14,
          phase: i * 1.1
        }));
        // Soft glowing white elliptical disc under crouching body + mid-rest white flash + 8 floating golden-tan feathers.
        live(0.92, (h, t, dt, g) => {
          const at = follow?.() ?? { x: cx, y: fy - 24, footY: fy };
          if (h.age < 0.55) {
            const df = h.age < 0.35 ? 0.85 : 0.85 * (1 - (h.age - 0.35) / 0.2);
            g.top.ellipse(at.x, at.footY + 3, 44, 18).fill({ color: 0xffffff, alpha: df * 0.75 });
            g.add.ellipse(at.x, at.footY + 3, 30, 12).fill({ color: 0xffffff, alpha: df * 0.92 });
          }
          if (h.age >= 0.24 && h.age < 0.36) {
            const fk = Math.sin(((h.age - 0.24) / 0.12) * Math.PI);
            g.add.circle(at.x, at.y, 28).fill({ color: 0xffffff, alpha: 0.85 * fk });
          }
          if (h.age >= 0.26) {
            const ft = (h.age - 0.26) / 0.66;
            const ff = ft < 0.65 ? 1 : 1 - (ft - 0.65) / 0.35;
            for (const f of feathers) {
              const fx = at.x + f.ox + f.vx * ft + Math.sin(h.age * 10 + f.phase) * 7;
              const fyPos = at.y + f.oy + f.vy * ft;
              const tilt = Math.sin(h.age * 7 + f.phase) * 0.6;
              const ca = Math.cos(tilt), sa = Math.sin(tilt);
              g.top.poly([fx - ca * 7, fyPos - sa * 7, fx - sa * 3, fyPos + ca * 3, fx + ca * 7, fyPos + sa * 7, fx + sa * 3, fyPos - ca * 3])
                .fill({ color: 0x5c4628, alpha: 0.9 * ff });
              g.top.poly([fx - ca * 5.5, fyPos - sa * 5.5, fx - sa * 2, fyPos + ca * 2, fx + ca * 5.5, fyPos + sa * 5.5, fx + sa * 2, fyPos - ca * 2])
                .fill({ color: 0xe6c87c, alpha: 0.96 * ff });
            }
          }
        });
      },
      hit() {}
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
