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
import {bakeMoveVfxIntensity, createNoiseField, paintMoveVfxSheet, paintMoveVfxSigil} from './moveVfxKitTextures.js';

const TAU = Math.PI * 2;
const STYLE_ARCHETYPE = Object.freeze({
  fireball: 'fire', flame: 'fire', missile: 'missile', gatling: 'bullet', shell: 'bullet',
  water: 'water', ice: 'shard', thorn: 'shard', holy: 'lance', beam: 'lance', thunder: 'thunder',
  dark: 'orb', sound: 'orb', spore: 'orb', seed: 'leaf', leaf: 'leaf', vine: 'leaf',
  quake: 'quake', wind: 'wind', strike: 'strike', claw: 'claw', slash: 'slash', pierce: 'pierce'
});
// Archetypes a recipe picks by name or effect family (moveVfxRecipes.js); no style maps to them by default.
const NAMED_ARCHETYPES = Object.freeze(['vine', 'roots', 'tree', 'gatling', 'cannon', 'meteor', 'pillar', 'spikes', 'tornado', 'arrows', 'blackhole', 'bite',
  // UNIQUE_PIXEL_MOVE_VFX_20261108
  'shuriken', 'crescent', 'star', 'bubble', 'note', 'feather', 'petal', 'snowflake', 'drill']);
export const MOVE_VFX_ARCHETYPES = Object.freeze([...new Set([...Object.values(STYLE_ARCHETYPE), ...NAMED_ARCHETYPES])]);
const MELEE = new Set(['strike', 'claw', 'slash', 'pierce', 'bite']);
// Material colours that do not follow the move's element: bark, roots, foliage, steel, rock.
const MATERIAL = Object.freeze({
  bark: Object.freeze({core: 0xd8b07a, main: 0x8a5a30, edge: 0x3e2614, smoke: 0x6a5238}),
  root: Object.freeze({core: 0xd8e2a0, main: 0x7a6436, edge: 0x34260f, smoke: 0x5c4a30}),
  foliage: Object.freeze({core: 0xd8ff9a, main: 0x58c23a, edge: 0x1d6428, smoke: 0x40602c}),
  steel: Object.freeze({core: 0xffffff, main: 0xc6cfdb, edge: 0x48505e, smoke: 0x8c8c8c}),
  iron: Object.freeze({core: 0x9aa4b4, main: 0x4a5160, edge: 0x1c2028, smoke: 0x6a6a6a}),
  rock: Object.freeze({core: 0xe8d6b0, main: 0x9a7a54, edge: 0x4a3a28, smoke: 0x8a7458})
});

/** The archetype a VFX style plays as; unknown styles strike. */
export function moveVfxArchetype(style) { return STYLE_ARCHETYPE[style] ?? 'strike'; }
export function moveVfxArchetypeIsMelee(archetype) { return MELEE.has(archetype); }

const easeOut = t => 1 - (1 - t) ** 3;
// Light adds; bodies (fire, water, rock, leaves, slashes) cover. An additive
// body washes out on a bright field and a dark one vanishes, so only light
// sheets add, and nothing adds on the dark palette.
const LIGHT_SHEETS = new Set(['glow', 'flare', 'ring', 'streak', 'beam']);

// Pixel finish (UNIQUE_PIXEL_MOVE_VFX_20261108): bodies bake at half their
// sheet size so a texel reads as a pixel of the remade cells; light sheets keep
// full size with stepped bands, so a field-wide wash never turns into a mosaic.
const PIXEL_BODY_SCALE = 0.5;

/**
 * `signature` (moveVfxSignatures.js), accepted by charge, launch, projectile,
 * impact, melee and signature, is what makes a move its own: its size, the
 * volley of heads and the path they weave, the trail they leave, the burst the
 * hit closes on, the melee combo and swing, and its sigil. Without one a phase
 * plays the archetype's plain look.
 */
export function createMoveVfxKit({PIXI, front, ground = front, quality = 'balanced', reducedMotion = false, seed = 0x51a5,
  doc = globalThis.document, resolution = 1.5, pixel = true} = {}) {
  if (!PIXI || !front || !doc) return null;
  // No kit where a canvas cannot be painted pixel by pixel (Node scene tests, stripped canvases).
  const probe = doc.createElement?.('canvas')?.getContext?.('2d');
  if (typeof probe?.createImageData !== 'function' || typeof probe.putImageData !== 'function') return null;
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
    if (name.startsWith('sigil:')) {
      const canvas = paintMoveVfxSigil(Number(name.slice(6)), palettes(paletteKey), {doc});
      entry = {textures: [texture(canvas)], loop: false, width: canvas.width, height: canvas.height, smoke: false};
      sheets.set(id, entry);
      return entry;
    }
    let intensity = intensities.get(name);
    const light = LIGHT_SHEETS.has(name);
    if (!intensity) {
      intensity = bakeMoveVfxIntensity(name, noise, {scale: pixel ? (light ? 1 : PIXEL_BODY_SCALE) : rich ? resolution : 1});
      intensities.set(name, intensity);
    }
    const painted = paintMoveVfxSheet(intensity, palettes(paletteKey), {doc, pixel, light});
    entry = {textures: painted.frames.map(texture), loop: painted.loop, width: painted.width, height: painted.height, smoke: painted.smoke};
    sheets.set(id, entry);
    return entry;
  }
  function texture(canvas) {
    const t = PIXI.Texture.from(canvas);
    if (pixel && t.source) t.source.scaleMode = 'nearest';
    return t;
  }

  const parts = [];
  const projectiles = [];
  // Delayed calls run on the kit's clock (the callers' one ticker), never a browser timer.
  const pending = [];
  const later = (fn, ms) => pending.push({fn, at: ms});
  const created = {parts: 0, projectiles: 0, impacts: 0, beams: 0, bolts: 0, charges: 0, launches: 0, melees: 0, signatures: 0, sigils: 0, escorts: 0};

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

  /**
   * A skill or signature move opens its own sigil flat on the ground at (x, y)
   * while it gathers -- under the fighters, so it never hides a body. Flat
   * sigils never spin: a squashed sprite that turns tumbles instead.
   */
  function sigil({x, y, paletteKey, signature, size = 30, ms = 320, follow = null}) {
    if (!signature) return;
    part({name: `sigil:${signature.sigil}`, paletteKey, x, y, px: size * (signature.tier === 'ultimate' ? 3.6 : 2.6), life: ms + 160,
      stretch: [1, 0.5], grow: [0.3, 1], fadeIn: 40, fadeOut: 0.3, alpha: 0.95, follow, layer: decalLayer});
    created.sigils++;
  }

  /** A signature's own closing burst at a hit drawn by someone else (the AI battle's cells). */
  function burst({x, y, groundY = y, angle = 0, paletteKey, signature, size = 30, heavy = false}) {
    if (!signature) return;
    const R = size * (heavy ? 1.4 : 1) * signature.scale;
    burstMotif(signature.burst, x, y, groundY, paletteKey, R, angle);
    if (signature.tier === 'ultimate') groundSigil(x, groundY, paletteKey, signature, size, 3.4, 0.75);
  }
  function groundSigil(x, groundY, paletteKey, own, size, k = 6, alpha = 0.9) {
    part({name: `sigil:${own.sigil}`, paletteKey, x, y: groundY, px: size * k, life: 900, stretch: [1, 0.45], grow: [0.4, 1.05], fadeIn: 60, fadeOut: 0.45, alpha, layer: decalLayer});
    created.sigils++;
  }

  /** Windup at the release point: the orb grows, sparks are drawn in, a ring closes. */
  function charge({x, y, paletteKey, size = 36, ms = 320, follow = null, signature = null}) {
    created.charges++;
    size *= signature?.scale ?? 1;
    if (signature && signature.tier !== 'basic') sigil({x, y: y + size * 0.9, paletteKey, signature, size, ms,
      follow: follow ? () => { const at = follow(); return at ? {x: at.x, y: at.y + size * 0.9} : null; } : null});
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
  function launch({x, y, angle = 0, paletteKey, archetype = 'fire', size = 30, signature = null}) {
    created.launches++;
    size *= signature?.scale ?? 1;
    flare(x, y, paletteKey, size * 2.6, 150, angle);
    // A volley flashes once per head, fanned across the shot.
    for (let i = 1; i < (signature?.volley ?? 1); i++) flare(x, y, paletteKey, size * 1.6, 130, angle + (i % 2 ? 1 : -1) * 0.5 * Math.ceil(i / 2), 0.8);
    ring(x, y, paletteKey, size * 2.2, 220, 0.38, angle + Math.PI / 2, 0.85);
    sparks({x, y, paletteKey, count: 7, angle, cone: 0.9, speed: [220, 520], life: 240, size: size * 0.9, gravity: 120});
    if (archetype === 'fire' || archetype === 'missile') smoke(x, y, paletteKey, size * 1.3, 2, 30);
  }

  // How each archetype's shot looks in flight: the head, and what it leaves behind.
  // A part that rides a projectile `back` sizes behind its head, turned with it.
  const rider = (p, spec) => part({...spec, life: 1e9, follow: () => p.alive ? {x: p.x - Math.cos(p.angle) * p.size * spec.back, y: p.y - Math.sin(p.angle) * p.size * spec.back} : null,
    onUpdate: q => { q.rotation = p.angle; q.flipY = Math.cos(p.angle) < 0; }});
  const HEADS = Object.freeze({
    vine: {head: 'spike', len: 0.9, turn: Math.PI / 2, glow: 1.2, every: 18, trail(p, at, size) {
      // The vine grows behind the thorn: stem sections laid along the path, leaves now and then.
      part({name: 'stem', paletteKey: MATERIAL.foliage, x: at.x, y: at.y, px: size * 1.3, life: 520, rotation: at.angle, fadeIn: 20, fadeOut: 0.4, flipY: random() < 0.5});
      if (random() < 0.3) part({name: 'leaf', paletteKey: MATERIAL.foliage, x: at.x + spread(size * 0.5), y: at.y + spread(size * 0.5), px: size * 0.7, life: 700, rotation: random() * TAU, spin: spread(6), vy: 20, fadeOut: 0.4});
    }},
    roots: {head: 'leaf', len: 1.2, spin: 10, glow: 1.4, every: 40, trail(p, at, size) { smoke(at.x, at.y + size * 0.5, MATERIAL.root, size * 0.7, 1, 6); }},
    tree: {head: 'leaf', len: 1.3, spin: 8, glow: 2.0, every: 34, trail(p, at, size) {
      part({name: 'leaf', paletteKey: MATERIAL.foliage, x: at.x, y: at.y, px: size * 0.6, life: 600, rotation: random() * TAU, spin: spread(10), vx: spread(40), vy: 25, fadeOut: 0.5});
    }},
    missile: {head: 'missile', material: 'steel', len: 3.2, anchor: [0.55, 0.5], glow: 0, every: 22,
      riders: [{name: 'comet', paletteKey: 'fire', px: 2.2, back: 1.25, anchor: [0.78, 0.5], fps: 26}], trail(p, at, size) {
      smoke(at.x - Math.cos(at.angle) * size * 1.6, at.y - Math.sin(at.angle) * size * 1.6, 'neutral', size * 0.95, 1, 12);
    }},
    gatling: {head: 'streak', len: 2.4, anchor: [0.85, 0.5], glow: 1.2, every: 16, trail(p, at, size) {
      part({name: 'streak', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 2.6, life: 110, rotation: at.angle, anchor: [0.9, 0.5], alpha: 0.5, fadeOut: 1});
    }},
    cannon: {head: 'ball', material: 'iron', len: 1.2, glow: 1.6, every: 18,
      riders: [{name: 'comet', paletteKey: 'fire', px: 1.7, back: 0.45, anchor: [0.8, 0.5], fps: 24}], trail(p, at, size) {
      smoke(at.x, at.y, 'neutral', size * 0.8, 1, 10);
    }},
    meteor: {head: 'rock', material: 'rock', len: 1.4, spin: 4, glow: 2.2, every: 16,
      riders: [{name: 'comet', paletteKey: 'fire', px: 3.0, back: 0.1, anchor: [0.8, 0.5], fps: 24}], trail(p, at, size) {
      part({name: 'burst', paletteKey: 'fire', x: at.x, y: at.y, px: size * 1.5, life: 380, rotation: random() * TAU, grow: [0.7, 1.2], fadeOut: 0.6, alpha: 0.8});
    }},
    pillar: {head: 'orb', len: 1.5, fps: 18, glow: 2.4, every: 30, trail(p, at, size) {
      part({name: 'glow', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 1.4, life: 300, grow: [1, 0.3], alpha: 0.6});
    }},
    spikes: {head: 'spike', len: 1.1, turn: Math.PI / 2, glow: 1.4, every: 26, trail(p, at, size) {
      part({name: 'spike', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 0.5, life: 180, rotation: at.angle + Math.PI / 2, alpha: 0.45, fadeOut: 1});
    }},
    tornado: {head: 'funnel', len: 1.4, anchor: [0.5, 0.85], fps: 20, upright: true, glow: 1.2, every: 30, trail(p, at, size) {
      smoke(at.x, at.y + size * 0.3, p.paletteKey, size * 0.8, 1, 20);
    }},
    arrows: {head: 'streak', len: 4.2, anchor: [0.85, 0.5], glow: 2.0, every: 14, trail(p, at, size) {
      part({name: 'streak', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 3.8, life: 130, rotation: at.angle, anchor: [0.85, 0.5], alpha: 0.5, fadeOut: 1});
    }},
    blackhole: {head: 'orb', len: 1.9, fps: 16, spin: -4, glow: 2.6, every: 34, trail(p, at, size) {
      part({name: 'ring', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 2.2, life: 300, grow: [1, 0.2], alpha: 0.6});
    }},
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
    }},
    // UNIQUE_PIXEL_MOVE_VFX_20261108: thrown things a move names.
    shuriken: {head: 'shuriken', len: 1.3, spin: 22, glow: 1.2, every: 24, trail(p, at, size) {
      part({name: 'shuriken', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 1.2, life: 140, rotation: random() * TAU, alpha: 0.4, fadeOut: 1});
    }},
    crescent: {head: 'crescent', len: 1.9, glow: 1.6, every: 22, trail(p, at, size) {
      part({name: 'crescent', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 1.7, life: 150, rotation: at.angle, flipY: Math.cos(at.angle) < 0, alpha: 0.35, fadeOut: 1});
    }},
    star: {head: 'star', len: 1.4, spin: 6, glow: 2.2, every: 30, trail(p, at, size) {
      part({name: 'star', paletteKey: p.paletteKey, x: at.x + spread(size * 0.6), y: at.y + spread(size * 0.6), px: size * 0.45, life: 520, spin: spread(8), vy: 60, fadeOut: 0.6});
    }},
    bubble: {head: 'bubble', len: 1.4, glow: 1.0, every: 40, trail(p, at, size) {
      part({name: 'bubble', paletteKey: p.paletteKey, x: at.x + spread(size * 0.8), y: at.y + spread(size * 0.6), px: size * (0.3 + random() * 0.35), life: 620, vy: -50, vx: spread(30), grow: [1, 1.3], fadeOut: 0.4});
    }},
    note: {head: 'note', len: 1.3, upright: true, glow: 1.4, every: 44, trail(p, at, size) {
      part({name: 'note', paletteKey: p.paletteKey, x: at.x + spread(size * 0.6), y: at.y, px: size * 0.6, life: 700, vy: -70, vx: spread(40), fadeOut: 0.5,
        onUpdate: q => { q.rotation = Math.sin(q.age / 90) * 0.35; }});
    }},
    feather: {head: 'feather', len: 2.0, glow: 1.2, every: 32, trail(p, at, size) {
      part({name: 'feather', paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 0.9, life: 760, rotation: random() * TAU, vx: spread(50), vy: 40, drag: 2,
        fadeOut: 0.5, onUpdate: q => { q.rotation += Math.sin(q.age / 120) * 0.04; }});
    }},
    petal: {head: 'petal', len: 1.1, spin: 9, glow: 1.4, every: 24, trail(p, at, size) {
      part({name: 'petal', paletteKey: p.paletteKey, x: at.x + spread(size * 0.5), y: at.y + spread(size * 0.5), px: size * 0.6, life: 640, rotation: random() * TAU, spin: spread(10), vy: 30, drag: 1.5, fadeOut: 0.5});
    }},
    snowflake: {head: 'snowflake', len: 1.4, spin: 3, glow: 2.0, every: 30, trail(p, at, size) {
      part({name: 'snowflake', paletteKey: p.paletteKey, x: at.x + spread(size * 0.6), y: at.y + spread(size * 0.6), px: size * 0.4, life: 600, spin: spread(4), vy: 45, fadeOut: 0.5});
    }},
    drill: {head: 'drill', len: 2.2, anchor: [0.62, 0.5], fps: 20, glow: 1.0, every: 26, trail(p, at, size) {
      sparks({x: at.x, y: at.y, paletteKey: p.paletteKey, count: 1, angle: at.angle + Math.PI, cone: 1.2, speed: [80, 180], life: 260, size: size * 0.45, gravity: 300});
    }}
  });

  /** Things flung out from a point: a ring of `count` parts of one sheet. */
  function scatter(name, x, y, paletteKey, count, R, {speed = [140, 320], life = 620, spin = 10, gravity = 120, drag = 1.8, px = 0.6, align = false} = {}) {
    for (let i = 0; i < (rich ? count : Math.ceil(count / 2)); i++) {
      const a = (i / count) * TAU + spread(0.5), v = speed[0] + random() * (speed[1] - speed[0]);
      part({name, paletteKey, x, y, px: R * px * (0.8 + random() * 0.4), life: life * (0.8 + random() * 0.4), rotation: a, spin: align ? 0 : spread(spin),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, drag, fadeOut: 0.45, onUpdate: align ? alignToVelocity : null});
    }
  }

  // A signature's trail motif, laid every `TRAIL_EVERY` ms of flight on top of the archetype's own trail.
  const TRAIL_EVERY = 46;
  function trailMotif(motif, p, at, size) {
    if (motif === 'sparkle') flare(at.x + spread(size * 0.7), at.y + spread(size * 0.7), p.paletteKey, size * 0.7, 220, random(), 0.85);
    else if (motif === 'ring') ring(at.x, at.y, p.paletteKey, size * 1.6, 260, 1, 0, 0.6).grow = [1, 0.3];
    else if (motif === 'afterimage') part({name: p.look.head, paletteKey: p.look.material ? MATERIAL[p.look.material] : p.paletteKey, x: at.x, y: at.y,
      px: size * p.look.len, life: 160, anchor: p.look.anchor ?? [0.5, 0.5], rotation: p.look.upright ? 0 : at.angle, flipY: Math.cos(at.angle) < 0, alpha: 0.4, fadeOut: 1});
    else if (motif === 'ember') sparks({x: at.x, y: at.y, paletteKey: p.paletteKey, count: 1, angle: Math.PI / 2, cone: 1.4, speed: [40, 120], life: 420, size: size * 0.4, gravity: 420});
    else if (motif === 'rune' && p.signature) part({name: `sigil:${p.signature.sigil}`, paletteKey: p.paletteKey, x: at.x, y: at.y, px: size * 0.9, life: 340, spin: 3, grow: [1, 0.4], alpha: 0.75, fadeOut: 0.6});
  }

  /** A signature's closing burst on top of the archetype's impact. */
  function burstMotif(motif, x, y, groundY, paletteKey, R, angle) {
    if (motif === 'ring') for (let i = 0; i < 2; i++) ring(x, y, paletteKey, R * (3 + i * 1.4), 380 + i * 80, 1, 0, 0.75).delay = i * 90;
    else if (motif === 'cross') for (const turn of [Math.PI / 4, -Math.PI / 4]) part({name: 'streak', paletteKey, x, y, px: R * 4.4, life: 240, rotation: angle + turn, stretch: [1, 1.4], grow: [0.4, 1.1], fadeOut: 0.6});
    // The rays carry the star; its flare stays a small core so a close camera never fills the screen with it.
    else if (motif === 'star') { for (let i = 0; i < 6; i++) part({name: 'streak', paletteKey, x, y, px: R * 2.8, life: 260, rotation: i * TAU / 6 + angle, anchor: [0, 0.5], grow: [0.3, 1.1], fadeOut: 0.6}); flare(x, y, paletteKey, R * 1.8, 200); }
    else if (motif === 'pillar') {
      const col = part({name: 'beam', paletteKey, x, y: groundY, px: R * 4.5, life: 420, fps: 30, anchor: [0, 0.5], rotation: -Math.PI / 2, fadeIn: 20, fadeOut: 0.4});
      col.stretch = [1, R * 1.1 / (col.book.height * R * 4.5 / col.book.width)];
    }
    else if (motif === 'shatter') scatter('shard', x, y, paletteKey, 7, R, {gravity: 700, px: 0.55});
    else if (motif === 'bloom') for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      part({name: 'glow', paletteKey, x, y, px: R * 1.3, life: 460, vx: Math.cos(a) * R * 4, vy: Math.sin(a) * R * 4, drag: 4, grow: [0.4, 1], fadeOut: 0.6, alpha: 0.85});
    }
  }

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
  /**
   * `headless` draws only the signature's trail motif along the shot: the AI
   * battle keeps drawing an original cell as the head and adds the move's own trail.
   */
  function projectile({follow, paletteKey, archetype = 'fire', size = 26, signature = null, headless = false}) {
    const look = HEADS[archetype] ?? HEADS.lance;
    const first = follow?.();
    if (!first) return null;
    created.projectiles++;
    size *= signature?.scale ?? 1;
    // x, y is where the shot is drawn; tx, ty where the game has it. A signature's path weaves the drawing round the true line.
    const p = {follow, paletteKey, look, size, signature, headless, x: first.x, y: first.y, tx: first.x, ty: first.y, angle: first.angle ?? 0, acc: 0, motifAcc: 0, age: 0, alive: true, spin: 0};
    const at = () => p.alive ? p : null;
    p.riders = headless ? [] : (look.riders ?? []).map(spec => rider(p, {...spec, px: size * spec.px}));
    p.glow = look.glow && !headless ? part({name: 'glow', paletteKey, px: size * look.glow, life: 1e9, follow: at, alpha: 0.85}) : null;
    p.head = headless ? null : head(p, at, 1);
    // A volley: escort heads beside the first, fanned out at release and closing on the line as they fly.
    p.escorts = headless ? [] : Array.from({length: Math.max(0, (signature?.volley ?? 1) - 1)}, (_, i) => {
      const side = (i % 2 ? -1 : 1) * Math.ceil((i + 1) / 2);
      created.escorts++;
      const escort = {side, x: p.x, y: p.y};
      escort.part = head(p, () => p.alive ? escort : null, 0.7);
      return escort;
    });
    projectiles.push(p);
    return Object.freeze({stop() { p.alive = false; }});
  }
  function head(p, follow, k) {
    const look = p.look;
    return part({name: look.head, paletteKey: look.material ? MATERIAL[look.material] : p.paletteKey, px: p.size * look.len * k, life: 1e9, fps: look.fps ?? 0, frame: look.frame ?? null,
      anchor: look.anchor ?? [0.5, 0.5], follow, fadeIn: 30});
  }
  /** The drawn offset of a path from the true line, across it (+ is to the left of the heading). */
  function pathOffset(path, age, size) {
    if (reducedMotion) return [0, 0];
    if (path === 'wave') return [0, Math.sin(age / 55) * size * 0.55];
    if (path === 'spiral') return [Math.cos(age / 40) * size * 0.45, Math.sin(age / 40) * size * 0.45];
    if (path === 'arc') return [0, -Math.sin(Math.PI * Math.min(1, age / 520)) * size * 1.3];
    return [0, 0];
  }
  function stepProjectile(p, dt) {
    const at = p.alive ? p.follow() : null;
    if (!at) { p.alive = false; return false; }
    const dx = at.x - p.tx, dy = at.y - p.ty;
    if (Number.isFinite(at.angle)) p.angle = at.angle; else if (dx * dx + dy * dy > 0.25) p.angle = Math.atan2(dy, dx);
    p.tx = at.x; p.ty = at.y; p.age += dt;
    const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    const [along, across] = p.headless ? [0, 0] : pathOffset(p.signature?.path, p.age, p.size);
    p.x = p.tx + cos * along + sin * across; p.y = p.ty + sin * along - cos * across;
    const close = Math.exp(-p.age / 520);
    for (const e of p.escorts) {
      const off = e.side * p.size * 1.1 * (0.25 + 0.75 * close);
      e.x = p.x + sin * off - cos * Math.abs(e.side) * p.size * 0.5; e.y = p.y - cos * off - sin * Math.abs(e.side) * p.size * 0.5;
    }
    p.spin += (p.look.spin ?? 0) * dt / 1000;
    // Shapes face right; a leftward heading mirrors top to bottom so nothing flies upside down.
    for (const q of [p.head, ...p.escorts.map(e => e.part)]) {
      if (!q) continue;
      q.rotation = p.look.upright ? 0 : p.look.spin ? p.spin : p.angle + (p.look.turn ?? 0);
      q.flipY = !p.look.spin && !p.look.turn && !p.look.upright && Math.cos(p.angle) < 0;
    }
    p.acc += dt;
    const every = p.look.every * (rich ? 1 : 2);
    while (!p.headless && p.acc >= every) { p.acc -= every; p.look.trail(p, {x: p.x, y: p.y, angle: p.angle}, p.size); }
    const motif = p.signature?.trail;
    if (motif && motif !== 'none') {
      p.motifAcc += dt;
      while (p.motifAcc >= TRAIL_EVERY * (rich ? 1 : 2)) { p.motifAcc -= TRAIL_EVERY * (rich ? 1 : 2); trailMotif(motif, p, {x: p.x, y: p.y, angle: p.angle}, p.size); }
    }
    return true;
  }

  const leafBurst = (x, y, R, count) => {
    for (let i = 0; i < (rich ? count : Math.ceil(count / 2)); i++) {
      const a = random() * TAU, v = 120 + random() * 220;
      part({name: 'leaf', paletteKey: MATERIAL.foliage, x, y, px: R * 0.75, life: 760, rotation: a, spin: spread(16), vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 160, drag: 2, fadeOut: 0.4});
    }
  };
  /** A part anchored at its base that rises out of the ground, holds, then sinks. */
  const rising = (spec, rise = 0.22, sink = 0.25) => {
    const p = part({anchor: [0.5, 0.95], ...spec});
    const full = p.stretch[1];
    p.onUpdate = q => { const k = q.age / q.life; q.stretch[1] = full * (k < rise ? easeOut(k / rise) : k > 1 - sink ? Math.max(0.05, (1 - k) / sink) : 1); };
    return p;
  };
  function rootsAt(x, y, R) {
    for (let i = 0; i < (rich ? 7 : 4); i++) {
      const a = random() * TAU, r = R * (0.2 + random() * 0.9);
      rising({name: 'spike', paletteKey: MATERIAL.root, x: x + Math.cos(a) * r * 1.3, y: y + Math.sin(a) * r * 0.5, px: R * (0.7 + random() * 0.4), life: 820, delay: i * 40, rotation: spread(0.7)});
    }
    smoke(x, y, MATERIAL.root, R * 1.6, 4, 30);
    decal({x, y, paletteKey: MATERIAL.root, px: R * 3.2});
  }
  function treeAt(x, y, R) {
    rising({name: 'trunk', paletteKey: MATERIAL.bark, x, y, px: R * 2, life: 1300, fadeOut: 0.25}, 0.18, 0.2);
    part({name: 'canopy', paletteKey: MATERIAL.foliage, x, y: y - R * 3.6, px: R * 6, life: 1100, delay: 180, fadeIn: 60, fadeOut: 0.25});
    later(() => leafBurst(x, y - R * 3.6, R * 1.4, 14), 420);
    ring(x, y, MATERIAL.foliage, R * 4, 420, 0.4);
    smoke(x, y, MATERIAL.root, R * 1.4, 3, 30);
  }
  function explosion(x, y, groundY, R) {
    flare(x, y, 'fire', R * 3.4, 180, random());
    part({name: 'burst', paletteKey: 'fire', x, y, px: R * 4.4, life: 600, rotation: random() * TAU, grow: [0.8, 1.3], fadeOut: 0.3});
    part({name: 'burst', paletteKey: 'fire', x: x + spread(R), y: y - R * 0.4, px: R * 2.6, life: 520, delay: 80, rotation: random() * TAU, grow: [0.7, 1.2], fadeOut: 0.3});
    ring(x, groundY, 'fire', R * 5, 420, 0.45);
    smoke(x, y - R * 0.3, 'neutral', R * 2.2, 5, 60);
    sparks({x, y, paletteKey: 'fire', count: 12, speed: [240, 560], life: 460, size: R * 0.9});
    for (let i = 0; i < (rich ? 5 : 2); i++) part({name: 'rock', paletteKey: MATERIAL.iron, x, y, px: R * 0.3, life: 620, spin: spread(14), vx: spread(360), vy: -160 - random() * 200, gravity: 900, fadeOut: 0.4});
    decal({x, y: groundY, paletteKey: 'fire', px: R * 3.6});
  }
  function meteorAt(x, y, groundY, R) {
    const fall = Math.PI / 2 - 0.45, dist = R * 9, ms = 260, vx = Math.cos(fall) * dist / (ms / 1000), vy = Math.sin(fall) * dist / (ms / 1000);
    const from = {x: x - Math.cos(fall) * dist, y: groundY - Math.sin(fall) * dist};
    part({name: 'comet', paletteKey: 'fire', ...from, px: R * 5, life: ms, fps: 24, anchor: [0.78, 0.5], rotation: fall, vx, vy, fadeIn: 20, fadeOut: 0.05});
    part({name: 'rock', paletteKey: MATERIAL.rock, ...from, px: R * 1.4, life: ms, spin: 6, vx, vy, fadeIn: 20, fadeOut: 0.05});
    later(() => explosion(x, groundY - R * 0.3, groundY, R * 1.3), ms);
  }
  function pillarAt(x, y, paletteKey, R) {
    const height = R * 6.5;
    const col = part({name: 'beam', paletteKey, x, y, px: height, life: 620, fps: 30, anchor: [0, 0.5], rotation: -Math.PI / 2, fadeIn: 20, fadeOut: 0.35});
    const full = R * 1.6 / (col.book.height * height / col.book.width);
    col.onUpdate = q => { const k = q.age / q.life; q.stretch[1] = full * (k < 0.15 ? easeOut(k / 0.15) : 1 + 0.1 * Math.sin(q.age / 30)); };
    ring(x, y, paletteKey, R * 3.6, 520, 0.42);
    part({name: 'glow', paletteKey, x, y: y - height * 0.4, px: R * 5, life: 520, fadeOut: 0.5, alpha: 0.6});
    for (let i = 0; i < (rich ? 10 : 4); i++) part({name: 'streak', paletteKey, x: x + spread(R * 1.2), y: y - random() * height * 0.5, px: R * 0.9, life: 420, delay: random() * 200, rotation: -Math.PI / 2, vy: -300 - random() * 200, fadeOut: 0.5});
    decal({x, y, paletteKey, px: R * 3});
  }
  function spikesAt(x, y, paletteKey, R) {
    const material = paletteId(paletteKey) === 'earth' ? MATERIAL.rock : paletteKey;
    for (let i = 0; i < (rich ? 8 : 4); i++) {
      const a = (i / 8) * TAU + spread(0.4), r = R * (0.5 + random() * 0.7);
      rising({name: 'spike', paletteKey: material, x: x + Math.cos(a) * r * 1.2, y: y + Math.sin(a) * r * 0.45, px: R * (0.5 + random() * 0.35), life: 700, delay: i * 25, rotation: Math.cos(a) * 0.35});
    }
    rising({name: 'spike', paletteKey: material, x, y, px: R * 0.9, life: 760});
    smoke(x, y, 'neutral', R * 1.4, 3, 30);
    ring(x, y, paletteKey, R * 3.4, 380, 0.42);
  }

  /** A landed hit: the archetype's burst, a shock ring, sparks and a ground mark. */
  function impact({x, y, groundY = y, angle = 0, paletteKey, archetype = 'strike', heavy = false, size = 30, signature = null}) {
    created.impacts++;
    const k = heavy ? 1.4 : 1, R = size * k * (signature?.scale ?? 1);
    if (signature) burstMotif(signature.burst, x, y, groundY, paletteKey, R, angle);
    flare(x, y, paletteKey, R * 3, heavy ? 200 : 150, random());
    switch (archetype) {
      case 'fire':
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
      case 'vine':
        // Lashes of vine whip out of the hit and leaves scatter.
        for (let i = 0; i < 5; i++) {
          const a = angle + Math.PI + spread(2.4);
          for (let k = 0; k < 4; k++) part({name: 'stem', paletteKey: MATERIAL.foliage, x: x + Math.cos(a) * R * 0.45 * k, y: y + Math.sin(a) * R * 0.45 * k, px: R * 0.9, life: 420, delay: k * 30, rotation: a, fadeOut: 0.5});
        }
        leafBurst(x, y, R, 8);
        break;
      case 'roots': rootsAt(x, groundY, R); break;
      case 'tree': treeAt(x, groundY, R); break;
      case 'missile': case 'cannon': explosion(x, y, groundY, R * (archetype === 'cannon' ? 1.35 : 1)); break;
      case 'meteor': meteorAt(x, y, groundY, R); break;
      case 'pillar': pillarAt(x, groundY, paletteKey, R); break;
      case 'spikes': spikesAt(x, groundY, paletteKey, R); break;
      case 'tornado':
        part({name: 'funnel', paletteKey, x, y: groundY, px: R * 2.6, life: 760, fps: 20, anchor: [0.5, 0.9], vx: Math.cos(angle) * 40, grow: [0.6, 1.1], fadeIn: 60, fadeOut: 0.35});
        smoke(x, groundY, paletteKey, R * 1.4, 4, 50);
        for (let i = 0; i < (rich ? 6 : 3); i++) part({name: 'rock', paletteKey: MATERIAL.rock, x: x + spread(R), y: groundY - random() * R * 2, px: R * 0.35, life: 600, spin: spread(12), vx: spread(160), vy: -120 - random() * 120, gravity: 300, fadeOut: 0.4});
        break;
      case 'arrows':
        for (let i = 0; i < (rich ? 7 : 4); i++) {
          const tx = x + spread(R * 2.4), ty = groundY + spread(R * 0.8), fall = Math.PI / 2 + 0.25;
          part({name: 'streak', paletteKey, x: tx - Math.cos(fall) * R * 6, y: ty - Math.sin(fall) * R * 6, px: R * 3, life: 160, delay: i * 45, rotation: fall, anchor: [0.9, 0.5],
            vx: Math.cos(fall) * R * 6 / 0.16, vy: Math.sin(fall) * R * 6 / 0.16, fadeIn: 10, fadeOut: 0.2});
          part({name: 'flare', paletteKey, x: tx, y: ty, px: R * 1.6, life: 160, delay: i * 45 + 150, grow: [0.5, 1.1], fadeOut: 0.7});
        }
        break;
      case 'blackhole':
        part({name: 'orb', paletteKey, x, y, px: R * 2.6, life: 620, fps: 18, spin: -6, grow: [1.2, 0.3], fadeOut: 0.3});
        for (let i = 0; i < 3; i++) part({name: 'ring', paletteKey, x, y, px: R * 4.4, life: 420, delay: i * 90, grow: [1, 0.1], fadeOut: 0.3, alpha: 0.7});
        for (let i = 0; i < (rich ? 10 : 4); i++) {
          const a = random() * TAU, r = R * (1.8 + random());
          part({name: 'streak', paletteKey, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, px: R * 0.8, life: 360, rotation: a + Math.PI, vx: -Math.cos(a) * r / 0.36, vy: -Math.sin(a) * r / 0.36, fadeOut: 0.3});
        }
        part({name: 'burst', paletteKey, x, y, px: R * 2.6, life: 320, delay: 520, grow: [0.5, 1.3], fadeOut: 0.5});
        break;
      case 'bite':
        for (const side of [-1, 1]) part({name: 'slash', paletteKey, x, y: y + side * R * 0.9, px: R * 3.4, life: 320, rotation: side < 0 ? Math.PI / 2 : -Math.PI / 2,
          vy: -side * R * 0.9 / 0.12, drag: 9, fadeOut: 0.4});
        sparks({x, y, paletteKey, count: 6, speed: [180, 360], life: 240, size: R * 0.7});
        break;
      case 'shuriken':
        scatter('shuriken', x, y, paletteKey, 4, R, {speed: [260, 420], life: 420, spin: 30, gravity: 0, px: 0.9});
        sparks({x, y, paletteKey, count: 6, speed: [200, 420], life: 260, size: R * 0.7});
        break;
      case 'crescent':
        part({name: 'crescent', paletteKey, x, y, px: R * 3.4, life: 360, rotation: angle, flipY: Math.cos(angle) < 0, grow: [0.6, 1.3], fadeOut: 0.5});
        part({name: 'slash', paletteKey, x, y, px: R * 4, life: 300, rotation: angle - 0.5, fadeOut: 0.35});
        ring(x, y, paletteKey, R * 3, 340, 0.6, angle);
        break;
      case 'star':
        flare(x, y, paletteKey, R * 3.6, 220, random());
        scatter('star', x, y, paletteKey, 7, R, {speed: [180, 380], gravity: 240, px: 0.7});
        break;
      case 'bubble':
        ring(x, y, paletteKey, R * 2.6, 300);
        scatter('bubble', x, y, paletteKey, 9, R, {speed: [90, 220], life: 700, spin: 0, gravity: -80, drag: 2.4, px: 0.6});
        break;
      case 'note':
        for (let i = 0; i < 3; i++) ring(x, y, paletteKey, R * (2.4 + i * 1.2), 360, 1, 0, 0.7).delay = i * 110;
        scatter('note', x, y, paletteKey, 6, R, {speed: [120, 240], life: 760, spin: 2, gravity: -60, drag: 2, px: 0.75});
        break;
      case 'feather':
        scatter('feather', x, y, paletteKey, 8, R, {speed: [160, 320], life: 900, spin: 3, gravity: 90, drag: 3, px: 1});
        ring(x, y, paletteKey, R * 2.6, 300, 0.7);
        break;
      case 'petal':
        for (let i = 0; i < (rich ? 12 : 6); i++) {
          const a0 = random() * TAU, r0 = R * (0.4 + random() * 0.6), w = (random() < 0.5 ? -1 : 1) * (5 + random() * 3);
          const q = part({name: 'petal', paletteKey, x, y, px: R * 0.65, life: 820, rotation: a0, fadeOut: 0.45});
          q.onUpdate = p => { const a = a0 + w * p.age / 1000, r = r0 + R * 1.8 * p.age / p.life; p.x = x + Math.cos(a) * r; p.y = y + Math.sin(a) * r * 0.6; p.rotation = a + Math.PI / 2; };
        }
        break;
      case 'snowflake':
        ring(x, y, paletteKey, R * 3, 380, 0.8);
        scatter('snowflake', x, y, paletteKey, 6, R, {speed: [120, 260], life: 760, spin: 3, gravity: 60, drag: 2.2, px: 0.7});
        scatter('shard', x, y, paletteKey, 5, R, {gravity: 600, px: 0.45, align: true});
        break;
      case 'drill':
        part({name: 'drill', paletteKey, x, y, px: R * 2.6, life: 380, fps: 26, rotation: angle, anchor: [0.62, 0.5], flipY: Math.cos(angle) < 0, fadeOut: 0.3});
        scatter('rock', x, y, MATERIAL.rock, 6, R, {gravity: 900, px: 0.4, speed: [200, 380]});
        sparks({x, y, paletteKey, count: 10, angle: angle + Math.PI, cone: 2, speed: [220, 460], life: 300, size: R * 0.7});
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
  // A signature's swing: which way each blow of a combo turns.
  const SWINGS = Object.freeze({down: [-0.4, 0.3, -0.7], up: [0.4, -0.3, 0.7], cross: [-0.6, 0.6, 0]});
  function melee({x, y, angle = 0, paletteKey, archetype = 'strike', size = 30, signature = null}) {
    created.melees++;
    size *= signature?.scale ?? 1;
    const reach = size * 0.9, cx = x + Math.cos(angle) * reach, cy = y + Math.sin(angle) * reach;
    const combo = signature?.combo ?? 1, turns = SWINGS[signature?.swing] ?? SWINGS.down;
    for (let i = 0; i < combo; i++) {
      const delay = i * 85, turn = turns[i % turns.length], alpha = i ? 0.85 : 1;
      if (archetype === 'pierce') part({name: 'streak', paletteKey, x: cx, y: cy, px: size * 4, life: 180, delay, rotation: angle + turn * 0.3, anchor: [0.4, 0.5], stretch: [1, 1.4], fadeOut: 0.6, alpha});
      else if (archetype === 'strike') ring(cx, cy, paletteKey, size * (1.8 + i * 0.4), 200, 0.4, angle + Math.PI / 2 + turn * 0.4, alpha).delay = delay;
      else part({name: 'slash', paletteKey, x: cx, y: cy, px: size * 3, life: 240, delay, rotation: angle + turn, fadeOut: 0.4, flipY: (Math.cos(angle) < 0) !== (turn > 0), alpha});
      // A trail motif on a blow: the swing leaves its sparkle, ring, embers or sigil at the reach.
      if (signature?.trail && signature.trail !== 'none' && signature.trail !== 'afterimage') later(() => trailMotif(signature.trail, {paletteKey, signature, look: HEADS.lance}, {x: cx, y: cy, angle}, size), delay);
    }
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
  function signature({x, y, groundY = y, angle = 0, paletteKey, archetype = 'fire', size = 40, signature: own = null}) {
    created.signatures++;
    impact({x, y, groundY, angle, paletteKey, archetype, heavy: true, size: size * 1.3, signature: own});
    // The move's own sigil opens under the blow and fades out.
    if (own) groundSigil(x, groundY, paletteKey, own, size);
    for (let i = 0; i < 3; i++) ring(x, y, paletteKey, size * (5 + i * 1.6), 520 + i * 90, 1, 0, 0.7 - i * 0.18).delay = i * 70;
    // In pixel finish a field-sized glow reads as a white disc over the move's own shapes, so it stays faint.
    part({name: 'glow', paletteKey, x, y, px: size * (pixel ? 7 : 9), life: 420, fadeIn: 10, fadeOut: 0.8, alpha: pixel ? 0.35 : 0.7});
    sparks({x, y, paletteKey, count: 16, speed: [300, 700], life: 520, size: size * 1.1, gravity: 260});
  }

  function update(dtMs) {
    const dt = Math.max(0, Math.min(100, dtMs));
    for (let i = pending.length - 1; i >= 0; i--) if ((pending[i].at -= dt) <= 0) pending.splice(i, 1)[0].fn();
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (stepProjectile(p, dt)) continue;
      for (const q of [p.head, p.glow, ...p.riders, ...p.escorts.map(e => e.part)]) if (q) q.age = q.life;
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
    charge, launch, projectile, impact, beam, bolt, melee, signature, wash, decal, sigil, burst, update,
    /** Bake a palette's sheets ahead of a fight so the first shot does not wait. */
    warm(paletteKeys, names = ['comet', 'burst', 'flare', 'ring', 'streak', 'glow', 'smoke', 'decal']) {
      for (const key of paletteKeys) for (const name of names) sheet(name, key);
    },
    getDiagnostics: () => Object.freeze({...created, live: parts.length, flying: projectiles.length, sheets: sheets.size}),
    dispose() {
      for (const p of parts) p.sprite.destroy();
      parts.length = 0; projectiles.length = 0; pending.length = 0;
      for (const entry of sheets.values()) for (const texture of entry.textures) texture.destroy(true);
      sheets.clear(); intensities.clear();
      for (const layer of [decalLayer, smokeLayer, lightLayer]) layer.destroy({children: true});
    }
  });
}
