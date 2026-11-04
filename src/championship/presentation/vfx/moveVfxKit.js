// Move VFX kit -- one look for every move (OWNER_APPROVED_ADAPTATION 2026-11-05,
// MOVE_VFX_KIT_20261105).
//
// The Owner asked for commercial-grade move effects in one style: the enlarged
// 16 px cells, the vector heads and the long drawn lines read as three games
// at once, and a fireball fired up-left stayed horizontal. This kit draws
// every phase of a move from the same baked flipbooks (moveVfxKitTextures.js):
// smooth, additive, coloured through the move's own palette, and always turned
// to its heading.
//
//   charge      orb gathering at the hand, sparks drawn in, ring closing
//   launch      muzzle flare, shock ellipse across the shot, recoil sparks
//   projectile  an archetype head that follows the shot, with its own trail
//   impact      an archetype burst, shock ring, sparks and a ground mark
//   beam        a flowing beam body from caster to target
//   bolt        a lightning strike from above
//   melee       a swing at the caster
//   signature   the larger impact a signature move ends on
//
// A move picks an archetype from its approved VFX style (moveVfxArchetype):
// the 23 styles share 15 archetypes. Presentation only: the kit owns no clock
// (callers pass the one Pixi ticker's delta), reads no simulation state and
// writes nothing back. Textures are baked on first use and destroyed on
// dispose().
import {BATTLE_FX_PALETTES} from '../battleFx/battleFxPalettes.js';
import {bakeMoveVfxIntensity, createNoiseField, paintMoveVfxSheet} from './moveVfxKitTextures.js';

const TAU = Math.PI * 2;
const STYLE_ARCHETYPE = Object.freeze({
  fireball: 'fire', flame: 'fire', missile: 'missile', gatling: 'bullet', shell: 'bullet',
  water: 'water', ice: 'shard', thorn: 'shard', holy: 'lance', beam: 'lance', thunder: 'thunder',
  dark: 'orb', sound: 'orb', spore: 'orb', seed: 'leaf', leaf: 'leaf', vine: 'leaf',
  quake: 'quake', wind: 'wind', strike: 'strike', claw: 'claw', slash: 'slash', pierce: 'pierce'
});
export const MOVE_VFX_ARCHETYPES = Object.freeze([...new Set(Object.values(STYLE_ARCHETYPE))]);
const MELEE = new Set(['strike', 'claw', 'slash', 'pierce']);

/** The archetype a VFX style plays as; unknown styles strike. */
export function moveVfxArchetype(style) { return STYLE_ARCHETYPE[style] ?? 'strike'; }
export function moveVfxArchetypeIsMelee(archetype) { return MELEE.has(archetype); }

const easeOut = t => 1 - (1 - t) ** 3;
// Light adds; bodies (fire, water, rock, leaves, slashes) cover. An additive
// body washes out on a bright field and a dark one vanishes, so only light
// sheets add, and nothing adds on the dark palette.
const LIGHT_SHEETS = new Set(['glow', 'flare', 'ring', 'streak', 'beam']);

export function createMoveVfxKit({PIXI, front, ground = front, quality = 'balanced', reducedMotion = false, seed = 0x51a5,
  doc = globalThis.document, resolution = 1.5} = {}) {
  if (!PIXI || !front || !doc) return null;
  const rich = quality !== 'saver';
  const budget = rich ? 260 : 110;
  let s = seed >>> 0;
  const random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const spread = (a) => (random() - 0.5) * a;

  // Layers: ground marks under the fighters; smoke (normal blend) and light (additive) over them.
  const decalLayer = new PIXI.Container(); decalLayer.label = 'move-vfx-decals';
  const smokeLayer = new PIXI.Container(); smokeLayer.label = 'move-vfx-smoke';
  const lightLayer = new PIXI.Container(); lightLayer.label = 'move-vfx-light';
  ground.addChild(decalLayer); front.addChild(smokeLayer); front.addChild(lightLayer);

  const noise = createNoiseField(128, seed);
  const intensities = new Map(), sheets = new Map();
  const palettes = key => typeof key === 'object' && key ? key : BATTLE_FX_PALETTES[key] ?? BATTLE_FX_PALETTES.neutral;
  const paletteId = key => typeof key === 'object' && key ? `${key.core}-${key.main}-${key.edge}` : String(key ?? 'neutral');
  function sheet(name, paletteKey) {
    const id = `${name}:${paletteId(paletteKey)}`;
    let entry = sheets.get(id);
    if (entry) return entry;
    let intensity = intensities.get(name);
    if (!intensity) { intensity = bakeMoveVfxIntensity(name, noise, {scale: rich ? resolution : 1}); intensities.set(name, intensity); }
    const painted = paintMoveVfxSheet(intensity, palettes(paletteKey), {doc});
    entry = {textures: painted.frames.map(canvas => PIXI.Texture.from(canvas)), loop: painted.loop, width: painted.width, height: painted.height, smoke: painted.smoke};
    sheets.set(id, entry);
    return entry;
  }

  const parts = [];
  const projectiles = [];
  const created = {parts: 0, projectiles: 0, impacts: 0, beams: 0, bolts: 0, charges: 0, launches: 0, melees: 0, signatures: 0};

  /**
   * One sprite on a flipbook. `px` is its width in world px; `fps` loops a
   * looping sheet, otherwise the sheet plays once over `life`. Motion is
   * plain ballistic (velocity, gravity, drag) unless `follow` places it.
   */
  function part({name, paletteKey, x = 0, y = 0, px = 40, life = 400, delay = 0, fps = 0, frame = null, anchor = [0.5, 0.5],
    rotation = 0, spin = 0, vx = 0, vy = 0, gravity = 0, drag = 0, grow = [1, 1], stretch = [1, 1], alpha = 1, fadeIn = 40, fadeOut = 0.5,
    follow = null, layer = null, flipY = false, onUpdate = null}) {
    if (reducedMotion && (vx || vy || spin)) { vx *= 0.3; vy *= 0.3; spin = 0; }
    while (parts.length >= budget) { const old = parts.shift(); old.sprite.destroy(); }
    const book = sheet(name, paletteKey);
    const sprite = new PIXI.Sprite(book.textures[frame ?? 0]);
    sprite.anchor.set(anchor[0], anchor[1]);
    sprite.blendMode = !book.smoke && LIGHT_SHEETS.has(name) && paletteId(paletteKey) !== 'dark' ? 'add' : 'normal';
    sprite.visible = false;
    (layer ?? (book.smoke ? (name === 'decal' ? decalLayer : smokeLayer) : lightLayer)).addChild(sprite);
    const p = {sprite, book, x, y, px, life, delay, fps, frame, rotation, spin, vx, vy, gravity, drag, grow, stretch, alpha, fadeIn, fadeOut,
      follow, flipY, onUpdate, age: 0};
    parts.push(p);
    created.parts++;
    return p;
  }
  function placePart(p) {
    const k = Math.min(1, p.age / p.life), book = p.book, n = book.textures.length;
    const index = p.frame ?? (book.loop || p.fps ? Math.floor(p.age * (p.fps || 20) / 1000) % n : Math.min(n - 1, Math.floor(k * n)));
    p.sprite.texture = book.textures[index];
    const at = p.follow ? p.follow() : p;
    if (!at) { p.age = p.life; return; }
    const scale = p.px / book.width * (p.grow[0] + (p.grow[1] - p.grow[0]) * easeOut(k));
    p.sprite.scale.set(scale * p.stretch[0], scale * p.stretch[1] * (p.flipY ? -1 : 1));
    p.sprite.position.set(at.x, at.y);
    p.sprite.rotation = p.rotation;
    const fadeStart = 1 - p.fadeOut;
    const a = Math.min(1, p.age / Math.max(1, p.fadeIn)) * (k > fadeStart ? 1 - (k - fadeStart) / Math.max(0.001, p.fadeOut) : 1);
    p.sprite.alpha = Math.max(0, a) * p.alpha;
    p.sprite.visible = true;
  }

  const sparks = ({x, y, paletteKey, count, angle = 0, cone = TAU, speed = [180, 420], life = 320, size = 26, gravity = 380}) => {
    for (let i = 0; i < (rich ? count : Math.ceil(count / 2)); i++) {
      const a = angle + spread(cone), v = speed[0] + random() * (speed[1] - speed[0]);
      part({name: 'streak', paletteKey, x, y, px: size * (0.6 + random() * 0.8), life: life * (0.7 + random() * 0.6), rotation: a,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, drag: 2.2, stretch: [1.4, 0.8], fadeOut: 0.6, onUpdate: alignToVelocity});
    }
  };
  function alignToVelocity(p) { if (p.vx || p.vy) p.rotation = Math.atan2(p.vy, p.vx); }
  const flare = (x, y, paletteKey, px, life = 160, rotation = 0, alpha = 1) =>
    part({name: 'flare', paletteKey, x, y, px, life, rotation, grow: [0.55, 1.15], fadeIn: 10, fadeOut: 0.7, alpha});
  const ring = (x, y, paletteKey, px, life = 320, squash = 1, rotation = 0, alpha = 0.9) =>
    part({name: 'ring', paletteKey, x, y, px, life, rotation, grow: [0.25, 1], stretch: [1, squash], fadeIn: 10, fadeOut: 0.75, alpha});
  const smoke = (x, y, paletteKey, px, count = 3, rise = 40) => {
    for (let i = 0; i < (rich ? count : 1); i++) part({name: 'smoke', paletteKey, x: x + spread(px * 0.6), y: y + spread(px * 0.3), px: px * (0.7 + random() * 0.6),
      life: 700 + random() * 400, delay: i * 50, vx: spread(40), vy: -rise * (0.6 + random() * 0.8), drag: 1.2, grow: [0.6, 1.5], fadeIn: 80, fadeOut: 0.6, alpha: 0.85});
  };

  /** A ground mark that lasts about four seconds. */
  function decal({x, y, paletteKey, px = 90}) {
    part({name: 'decal', paletteKey, x, y, px, life: 4000, stretch: [1, 0.42], rotation: spread(0.4), fadeIn: 60, fadeOut: 0.3, alpha: 0.55});
  }

  /** Windup at the release point: the orb grows, sparks are drawn in, a ring closes. */
  function charge({x, y, paletteKey, size = 36, ms = 320, follow = null}) {
    created.charges++;
    part({name: 'glow', paletteKey, x, y, px: size * 2.4, life: ms + 90, grow: [0.2, 1], fadeIn: 30, fadeOut: 0.25, follow});
    part({name: 'orb', paletteKey, x, y, px: size * 1.1, life: ms + 90, fps: 18, grow: [0.25, 0.9], spin: 4, fadeOut: 0.25, follow});
    ring(x, y, paletteKey, size * 3.2, ms, 1, 0, 0.55).grow = [1, 0.15];
    if (reducedMotion) return;
    for (let i = 0; i < (rich ? 7 : 3); i++) {
      const a = random() * TAU, r = size * (1.4 + random() * 0.8), life = ms * (0.55 + random() * 0.35);
      part({name: 'streak', paletteKey, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, px: size * 0.9, life, delay: random() * ms * 0.3,
        rotation: a + Math.PI, vx: -Math.cos(a) * r / (life / 1000), vy: -Math.sin(a) * r / (life / 1000), fadeIn: 30, fadeOut: 0.3});
    }
  }

  /** Release: a flare at the muzzle, a shock ellipse across the shot and recoil sparks. */
  function launch({x, y, angle = 0, paletteKey, archetype = 'fire', size = 30}) {
    created.launches++;
    flare(x, y, paletteKey, size * 2.6, 150, angle);
    ring(x, y, paletteKey, size * 2.2, 220, 0.38, angle + Math.PI / 2, 0.85);
    sparks({x, y, paletteKey, count: 7, angle, cone: 0.9, speed: [220, 520], life: 240, size: size * 0.9, gravity: 120});
    if (archetype === 'fire' || archetype === 'missile') smoke(x, y, paletteKey, size * 1.3, 2, 30);
  }

  // How each archetype's shot looks in flight: the head, and what it leaves behind.
  const HEADS = Object.freeze({
    fire: {head: 'comet', len: 3.4, anchor: [0.78, 0.5], fps: 22, glow: 2.6, every: 14, trail(p, at, size) {
      part({name: 'burst', paletteKey: p.paletteKey, x: at.x + spread(size * 0.3), y: at.y + spread(size * 0.3), px: size * 1.7, life: 420,
        vx: -Math.cos(at.angle) * 50, vy: -Math.sin(at.angle) * 50 - 20, rotation: random() * TAU, grow: [0.7, 1.25], fadeOut: 0.6, alpha: 0.85});
      if (random() < 0.35) sparks({x: at.x, y: at.y, paletteKey: p.paletteKey, count: 1, angle: at.angle + Math.PI, cone: 1.6, speed: [60, 160], life: 360, size: size * 0.45, gravity: 260});
    }},
    missile: {head: 'comet', len: 2.6, anchor: [0.78, 0.5], fps: 26, glow: 1.8, every: 26, trail(p, at, size) {
      smoke(at.x - Math.cos(at.angle) * size * 0.5, at.y - Math.sin(at.angle) * size * 0.5, p.paletteKey, size * 0.9, 1, 14);
    }},
    bullet: {head: 'streak', len: 2.2, anchor: [0.8, 0.5], glow: 1.4, every: 18, trail(p, at, size) {
      part({name: 'streak', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 2, life: 120, rotation: at.angle, anchor: [0.9, 0.5], alpha: 0.5, fadeOut: 1});
    }},
    water: {head: 'drop', len: 1.9, anchor: [0.62, 0.5], glow: 2.2, every: 34, trail(p, at, size) {
      part({name: 'drop', paletteKey: p.paletteKey, x: at.x + spread(size * 0.4), y: at.y + spread(size * 0.4), px: size * (0.35 + random() * 0.3), life: 420,
        rotation: at.angle + Math.PI + spread(1), vx: -Math.cos(at.angle) * 60 + spread(60), vy: -Math.sin(at.angle) * 60 + spread(40), gravity: 420, onUpdate: alignToVelocity, fadeOut: 0.5});
      if (random() < 0.5) part({name: 'glow', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 0.9, life: 300, grow: [1, 0.4], alpha: 0.6});
    }},
    shard: {head: 'shard', len: 2.2, anchor: [0.55, 0.5], glow: 2.0, every: 30, trail(p, at, size) {
      part({name: 'shard', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 2.1, life: 160, rotation: at.angle, alpha: 0.45, fadeOut: 1});
      if (random() < 0.4) flare(at.x + spread(size), at.y + spread(size), p.paletteKey, size * 0.9, 260, random(), 0.8);
    }},
    orb: {head: 'orb', len: 1.9, fps: 16, spin: 3, glow: 2.8, every: 30, trail(p, at, size) {
      part({name: 'glow', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 1.8, life: 340, grow: [1, 0.35], alpha: 0.65});
      if (random() < 0.4) part({name: 'orb', paletteKey: p.paletteKey, x: at.x + spread(size * 0.6), y: at.y + spread(size * 0.6), px: size * 0.6, life: 360, fps: 16, grow: [1, 0.2], vy: -40});
    }},
    lance: {head: 'streak', len: 4.6, anchor: [0.85, 0.5], glow: 2.4, every: 14, trail(p, at, size) {
      part({name: 'streak', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 4.2, life: 140, rotation: at.angle, anchor: [0.85, 0.5], stretch: [1, 1.3], alpha: 0.55, fadeOut: 1});
    }},
    thunder: {head: 'orb', len: 1.7, fps: 30, glow: 3.0, every: 70, trail(p, at, size) {
      arc(at.x, at.y, p.paletteKey, size * 1.5);
      sparks({x: at.x, y: at.y, paletteKey: p.paletteKey, count: 2, speed: [80, 200], life: 200, size: size * 0.5, gravity: 0});
    }},
    leaf: {head: 'leaf', len: 1.6, spin: 12, glow: 1.8, every: 40, trail(p, at, size) {
      const a = random() * TAU;
      part({name: 'leaf', paletteKey: p.paletteKey, x: at.x + Math.cos(a) * size * 0.6, y: at.y + Math.sin(a) * size * 0.6, px: size * 0.8, life: 600,
        rotation: a, spin: spread(14), vx: -Math.cos(at.angle) * 40 + spread(50), vy: 30 + spread(30), drag: 1.5, fadeOut: 0.5});
    }},
    wind: {head: 'slash', frame: 4, len: 2.2, spin: -18, glow: 1.4, every: 20, trail(p, at, size) {
      const side = spread(size * 1.2), n = at.angle + Math.PI / 2;
      part({name: 'streak', paletteKey: p.paletteKey, x: at.x + Math.cos(n) * side, y: at.y + Math.sin(n) * side, px: size * 2.4, life: 180, rotation: at.angle, alpha: 0.45, fadeOut: 1});
    }},
    quake: {head: 'shard', len: 1.6, spin: 8, glow: 1.0, every: 36, trail(p, at, size) {
      smoke(at.x, at.y + size * 0.4, p.paletteKey, size * 0.8, 1, 10);
    }}
  });

  /** A small lightning arc around a point (thunder shots). */
  function arc(x, y, paletteKey, radius) {
    const a0 = random() * TAU, steps = 4;
    let px0 = x + Math.cos(a0) * radius * 0.3, py0 = y + Math.sin(a0) * radius * 0.3;
    for (let i = 1; i <= steps; i++) {
      const a = a0 + i * 0.5, r = radius * (0.3 + 0.7 * i / steps);
      const px1 = x + Math.cos(a) * r + spread(radius * 0.3), py1 = y + Math.sin(a) * r + spread(radius * 0.3);
      segment(px0, py0, px1, py1, paletteKey, radius * 0.18, 110);
      px0 = px1; py0 = py1;
    }
  }
  /** One glowing segment between two points, drawn with the beam section. */
  function segment(x0, y0, x1, y1, paletteKey, width, life, delay = 0) {
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    const p = part({name: 'beam', paletteKey, x: x0, y: y0, px: length, life, delay, fps: 30, anchor: [0, 0.5], rotation: Math.atan2(y1 - y0, x1 - x0), fadeIn: 5, fadeOut: 0.6});
    p.stretch = [1, width / (p.book.height * length / p.book.width)];
    return p;
  }

  /**
   * A shot in flight. `follow()` returns {x, y, angle?} while the shot lives
   * and null once it is gone; without an angle the heading comes from motion.
   */
  function projectile({follow, paletteKey, archetype = 'fire', size = 26}) {
    const look = HEADS[archetype] ?? HEADS.lance;
    const first = follow?.();
    if (!first) return null;
    created.projectiles++;
    const p = {follow, paletteKey, look, size, x: first.x, y: first.y, angle: first.angle ?? 0, acc: 0, alive: true, spin: 0};
    p.glow = part({name: 'glow', paletteKey, px: size * look.glow, life: 1e9, follow: () => p.alive ? p : null, alpha: 0.85});
    p.head = part({name: look.head, paletteKey, px: size * look.len, life: 1e9, fps: look.fps ?? 0, frame: look.frame ?? null,
      anchor: look.anchor ?? [0.5, 0.5], follow: () => p.alive ? p : null, fadeIn: 30});
    projectiles.push(p);
    return Object.freeze({stop() { p.alive = false; }});
  }
  function stepProjectile(p, dt) {
    const at = p.alive ? p.follow() : null;
    if (!at) { p.alive = false; return false; }
    const dx = at.x - p.x, dy = at.y - p.y;
    if (Number.isFinite(at.angle)) p.angle = at.angle; else if (dx * dx + dy * dy > 0.25) p.angle = Math.atan2(dy, dx);
    p.x = at.x; p.y = at.y;
    p.spin += (p.look.spin ?? 0) * dt / 1000;
    // Shapes face right; a leftward heading mirrors top to bottom so nothing flies upside down.
    p.head.rotation = p.look.spin ? p.spin : p.angle;
    p.head.flipY = !p.look.spin && Math.cos(p.angle) < 0;
    p.acc += dt;
    const every = p.look.every * (rich ? 1 : 2);
    while (p.acc >= every) { p.acc -= every; p.look.trail(p, {x: p.x, y: p.y, angle: p.angle}, p.size); }
    return true;
  }

  /** A landed hit: the archetype's burst, a shock ring, sparks and a ground mark. */
  function impact({x, y, groundY = y, angle = 0, paletteKey, archetype = 'strike', heavy = false, size = 30}) {
    created.impacts++;
    const k = heavy ? 1.4 : 1, R = size * k;
    flare(x, y, paletteKey, R * 3, heavy ? 200 : 150, random());
    switch (archetype) {
      case 'fire': case 'missile':
        part({name: 'burst', paletteKey, x, y, px: R * 4, life: 560, rotation: random() * TAU, grow: [0.8, 1.25], fadeOut: 0.3});
        part({name: 'burst', paletteKey, x: x + spread(R), y: y - R * 0.3, px: R * 2.2, life: 480, delay: 70, rotation: random() * TAU, grow: [0.7, 1.2], fadeOut: 0.3});
        smoke(x, y - R * 0.2, paletteKey, R * 1.8, 3, 50);
        sparks({x, y, paletteKey, count: 10, speed: [200, 480], life: 420, size: R * 0.8});
        break;
      case 'water':
        ring(x, groundY, paletteKey, R * 3.4, 420, 0.42);
        // The crest stays upright and rolls the way the shot travelled.
        part({name: 'crest', paletteKey, x, y: y - R * 0.4, px: R * 3.2, life: 520, stretch: [Math.cos(angle) < 0 ? -1 : 1, 1], grow: [0.9, 1.15], fadeOut: 0.4});
        for (let i = 0; i < (rich ? 12 : 5); i++) {
          const a = -Math.PI / 2 + spread(2.2), v = 180 + random() * 260;
          part({name: 'drop', paletteKey, x, y, px: R * (0.35 + random() * 0.35), life: 520, rotation: a, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 900, onUpdate: alignToVelocity, fadeOut: 0.4});
        }
        break;
      case 'shard': case 'quake':
        ring(x, archetype === 'quake' ? groundY : y, paletteKey, R * 3.4, 380, archetype === 'quake' ? 0.4 : 1);
        for (let i = 0; i < (rich ? 9 : 4); i++) {
          const a = archetype === 'quake' ? -Math.PI / 2 + spread(2.4) : random() * TAU, v = 160 + random() * 300;
          part({name: 'shard', paletteKey, x, y, px: R * (0.5 + random() * 0.6), life: 560, rotation: a, spin: spread(18), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            gravity: archetype === 'quake' ? 1000 : 300, fadeOut: 0.4});
        }
        if (archetype === 'quake') smoke(x, groundY, paletteKey, R * 1.8, 4, 30);
        break;
      case 'orb':
        part({name: 'orb', paletteKey, x, y, px: R * 1.6, life: 420, fps: 20, grow: [0.8, 2.2], fadeOut: 0.6});
        ring(x, y, paletteKey, R * 3.6, 420);
        sparks({x, y, paletteKey, count: 8, speed: [120, 320], life: 380, size: R * 0.7, gravity: 0});
        break;
      case 'thunder':
        bolt({x, y, paletteKey, height: R * 7});
        break;
      case 'leaf':
        ring(x, y, paletteKey, R * 2.8, 340);
        for (let i = 0; i < (rich ? 10 : 4); i++) {
          const a = random() * TAU, v = 120 + random() * 220;
          part({name: 'leaf', paletteKey, x, y, px: R * 0.8, life: 780, rotation: a, spin: spread(16), vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 160, drag: 2, fadeOut: 0.4});
        }
        break;
      case 'wind':
        for (const turn of [0.6, -0.9]) part({name: 'slash', paletteKey, x, y, px: R * 3, life: 300, rotation: angle + turn, fadeOut: 0.3});
        ring(x, y, paletteKey, R * 3, 360, 0.5, angle);
        break;
      case 'claw':
        for (let i = -1; i <= 1; i++) {
          const n = angle + Math.PI / 2;
          part({name: 'slash', paletteKey, x: x + Math.cos(n) * i * R * 0.45, y: y + Math.sin(n) * i * R * 0.45, px: R * 3.4, life: 300, delay: (i + 1) * 35, rotation: angle - 0.35, fadeOut: 0.35});
        }
        sparks({x, y, paletteKey, count: 6, angle, cone: 1.4, speed: [200, 420], life: 260, size: R * 0.7});
        break;
      case 'slash':
        part({name: 'slash', paletteKey, x, y, px: R * 4.6, life: 320, rotation: angle - 0.5, fadeOut: 0.35});
        part({name: 'slash', paletteKey, x, y, px: R * 3.8, life: 280, delay: 40, rotation: angle - 0.5, alpha: 0.6, fadeOut: 0.35});
        sparks({x, y, paletteKey, count: 7, angle: angle + Math.PI / 2, cone: 0.8, speed: [200, 460], life: 280, size: R * 0.8});
        break;
      case 'pierce':
        part({name: 'streak', paletteKey, x, y, px: R * 5, life: 200, rotation: angle, anchor: [0.75, 0.5], stretch: [1, 1.6], grow: [0.5, 1.1], fadeOut: 0.5});
        ring(x, y, paletteKey, R * 2.2, 260, 0.4, angle + Math.PI / 2);
        sparks({x, y, paletteKey, count: 6, angle, cone: 0.7, speed: [260, 520], life: 260, size: R * 0.8});
        break;
      case 'lance':
        part({name: 'streak', paletteKey, x, y, px: R * 4, life: 220, rotation: angle, anchor: [0.6, 0.5], stretch: [1, 1.8], fadeOut: 0.5});
        ring(x, y, paletteKey, R * 3, 340);
        sparks({x, y, paletteKey, count: 8, angle, cone: 1.6, speed: [220, 480], life: 320, size: R * 0.8, gravity: 120});
        break;
      case 'bullet':
        sparks({x, y, paletteKey, count: 4, angle: angle + Math.PI, cone: 1.8, speed: [160, 320], life: 200, size: R * 0.6});
        break;
      default: // strike
        part({name: 'burst', paletteKey, x, y, px: R * 1.8, life: 260, rotation: random() * TAU, grow: [0.6, 1.1], fadeOut: 0.5});
        ring(x, y, paletteKey, R * 2.8, 280);
        sparks({x, y, paletteKey, count: 8, speed: [220, 480], life: 260, size: R * 0.8, gravity: 200});
    }
    if (heavy) ring(x, y, paletteKey, R * 4.6, 460, 1, 0, 0.55);
    decal({x, y: groundY, paletteKey, px: R * (heavy ? 3.4 : 2.4)});
  }

  /** A flowing beam from (x0, y0) to (x1, y1), opening and closing over `ms`. */
  function beam({x0, y0, x1, y1, paletteKey, ms = 420, width = 26}) {
    created.beams++;
    const body = segment(x0, y0, x1, y1, paletteKey, width, ms);
    const full = body.stretch[1];
    body.fadeOut = 0.25;
    body.onUpdate = p => { const k = p.age / p.life; p.stretch[1] = full * (k < 0.15 ? easeOut(k / 0.15) : k > 0.75 ? 1 - (k - 0.75) / 0.25 * 0.7 : 1 + 0.08 * Math.sin(p.age / 25)); };
    part({name: 'glow', paletteKey, x: x0, y: y0, px: width * 3, life: ms, fadeOut: 0.3});
    part({name: 'glow', paletteKey, x: x1, y: y1, px: width * 3.6, life: ms, fadeOut: 0.3});
    flare(x1, y1, paletteKey, width * 4, ms * 0.6);
    sparks({x: x1, y: y1, paletteKey, count: 8, angle: Math.atan2(y0 - y1, x0 - x1), cone: 2.4, speed: [160, 380], life: 300, size: width * 0.9});
  }

  /** A lightning strike from above onto (x, y). */
  function bolt({x, y, paletteKey, height = 220}) {
    created.bolts++;
    let px0 = x + spread(height * 0.3), py0 = y - height;
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, px1 = i === steps ? x : x + (px0 - x) * 0.4 + spread(height * 0.22) * (1 - t), py1 = y - height * (1 - t);
      segment(px0, py0, px1, py1, paletteKey, height * 0.09, 200);
      segment(px0, py0, px1, py1, paletteKey, height * 0.035, 200);
      if (random() < 0.35 && i < steps) {
        const a = Math.atan2(py1 - py0, px1 - px0) + spread(1.6);
        segment(px1, py1, px1 + Math.cos(a) * height * 0.18, py1 + Math.sin(a) * height * 0.18, paletteKey, height * 0.03, 150);
      }
      px0 = px1; py0 = py1;
    }
    part({name: 'glow', paletteKey, x, y, px: height * 0.55, life: 220, fadeIn: 5, fadeOut: 0.8, alpha: 0.7});
    ring(x, y, paletteKey, height * 0.7, 300, 0.45);
    sparks({x, y, paletteKey, count: 9, speed: [200, 460], life: 320, size: height * 0.12, gravity: 300});
  }

  /** A swing at the caster: the archetype's slash on the facing side. */
  function melee({x, y, angle = 0, paletteKey, archetype = 'strike', size = 30}) {
    created.melees++;
    const reach = size * 0.9, cx = x + Math.cos(angle) * reach, cy = y + Math.sin(angle) * reach;
    if (archetype === 'pierce') { part({name: 'streak', paletteKey, x: cx, y: cy, px: size * 4, life: 180, rotation: angle, anchor: [0.4, 0.5], stretch: [1, 1.4], fadeOut: 0.6}); return; }
    if (archetype === 'strike') { ring(cx, cy, paletteKey, size * 1.8, 200, 0.4, angle + Math.PI / 2); return; }
    part({name: 'slash', paletteKey, x: cx, y: cy, px: size * 3, life: 240, rotation: angle - 0.4, fadeOut: 0.4, flipY: Math.cos(angle) < 0});
  }

  /**
   * A signature move's backdrop: a soft wash of its colour over the visible
   * field (`rect`), brightest around `center`. Replaces line-art storms, whose
   * strokes became long lines across the screen once scaled to the field.
   */
  function wash({rect, center = null, paletteKey, ms = 560}) {
    if (!rect) return;
    const cx = center?.x ?? rect.x + rect.width / 2, cy = center?.y ?? rect.y + rect.height / 2;
    const cover = Math.hypot(rect.width, rect.height);
    part({name: 'glow', paletteKey, x: cx, y: cy, px: cover * 1.3, life: ms, grow: [0.7, 1.05], fadeIn: 90, fadeOut: 0.55, alpha: 0.42});
    part({name: 'glow', paletteKey, x: cx, y: cy, px: cover * 0.45, life: ms * 0.8, grow: [0.4, 1.2], fadeIn: 40, fadeOut: 0.6, alpha: 0.5});
  }

  /** The larger close of a signature move. */
  function signature({x, y, groundY = y, angle = 0, paletteKey, archetype = 'fire', size = 40}) {
    created.signatures++;
    impact({x, y, groundY, angle, paletteKey, archetype, heavy: true, size: size * 1.3});
    for (let i = 0; i < 3; i++) ring(x, y, paletteKey, size * (5 + i * 1.6), 520 + i * 90, 1, 0, 0.7 - i * 0.18).delay = i * 70;
    part({name: 'glow', paletteKey, x, y, px: size * 9, life: 420, fadeIn: 10, fadeOut: 0.8, alpha: 0.7});
    sparks({x, y, paletteKey, count: 16, speed: [300, 700], life: 520, size: size * 1.1, gravity: 260});
  }

  function update(dtMs) {
    const dt = Math.max(0, Math.min(100, dtMs));
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (stepProjectile(p, dt)) continue;
      p.head.age = p.head.life; p.glow.age = p.glow.life;
      projectiles.splice(i, 1);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.delay > 0) { p.delay -= dt; p.sprite.visible = false; continue; }
      p.age += dt;
      if (p.age >= p.life) { p.sprite.destroy(); parts.splice(i, 1); continue; }
      const sec = dt / 1000;
      if (p.drag) { const d = Math.exp(-p.drag * sec); p.vx *= d; p.vy *= d; }
      p.vy += p.gravity * sec;
      p.x += p.vx * sec; p.y += p.vy * sec;
      if (p.spin) p.rotation += p.spin * sec;
      p.onUpdate?.(p);
      placePart(p);
    }
  }

  return Object.freeze({
    charge, launch, projectile, impact, beam, bolt, melee, signature, wash, decal, update,
    /** Bake a palette's sheets ahead of a fight so the first shot does not wait. */
    warm(paletteKeys, names = ['comet', 'burst', 'flare', 'ring', 'streak', 'glow', 'smoke', 'decal']) {
      for (const key of paletteKeys) for (const name of names) sheet(name, key);
    },
    getDiagnostics: () => Object.freeze({...created, live: parts.length, flying: projectiles.length, sheets: sheets.size}),
    dispose() {
      for (const p of parts) p.sprite.destroy();
      parts.length = 0; projectiles.length = 0;
      for (const entry of sheets.values()) for (const texture of entry.textures) texture.destroy(true);
      sheets.clear(); intensities.clear();
      for (const layer of [decalLayer, smokeLayer, lightLayer]) layer.destroy({children: true});
    }
  });
}
