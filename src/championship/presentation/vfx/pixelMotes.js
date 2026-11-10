// Pixel motes: the secondary particles of a move (MOVE_VFX_QUALITY_20261110).
//
// Owner 2026-11-10 (「想做」, after choosing the plan 「骨架照原作，品質手法學
// pixelfx」): every move keeps its original structure -- the native pool's
// cells, count, place and timing -- and gains the small things that sell it:
// embers that rise off fire, drops that fall off water, shards, sparks,
// leaves, pebbles, streaks, motes, wisps. They trail every live move effect
// while it flies or spreads, and scatter from every landed hit.
//
// The particle shapes are drawn here as tiny outlined pixel sprites in the
// element's own palette (no image file, no reference pixel), at the grain of
// the remade cells. Motion is a seeded simulation stepped by the owner's
// frame delta: no ticker of its own, no Math.random, so a replay looks the
// same. Presentation only.

/** Element -> its motes: shapes (rows: o outline, e edge, m main, c core), cadence and motion. */
export const PIXEL_MOTE_RECIPES = Object.freeze({
  FIRE: Object.freeze({shapes: [['oco', 'cmc', 'omo'], ['cm', 'me']], palette: [0xfff3c0, 0xff8a1c, 0xc02a0a], every: 55, life: [420, 700],
    vx: [-45, 45], vy: [-60, -20], gravity: -20, drag: 1.8, burst: 9}),
  WATER: Object.freeze({shapes: [['.c.', 'cmc', 'mem', '.e.'], ['c', 'm']], palette: [0xeafaff, 0x4ab0ff, 0x1a5ab0], every: 70, life: [380, 620],
    vx: [-40, 40], vy: [-70, -20], gravity: 420, drag: 0.4, burst: 10, bounce: true}),
  ICE: Object.freeze({shapes: [['.c.', 'cmc', '.e.'], ['c.c', '.m.', 'c.c']], palette: [0xffffff, 0xa8e4ff, 0x3a7ab8], every: 65, life: [420, 700],
    vx: [-35, 35], vy: [-40, 10], gravity: 80, drag: 1.6, burst: 9}),
  THUNDER: Object.freeze({shapes: [['c..', '.m.', '..c'], ['.c', 'c.', '.c']], palette: [0xffffff, 0xfff27a, 0x6a6aff], every: 45, life: [160, 300],
    vx: [-120, 120], vy: [-120, 120], gravity: 0, drag: 4, burst: 12, flicker: true}),
  WOOD: Object.freeze({shapes: [['.mc', 'mm.', 'e..'], ['cm', 'me']], palette: [0xd8f8a0, 0x58b03c, 0x2a6a2a], every: 80, life: [560, 900],
    vx: [-30, 30], vy: [-50, -10], gravity: 60, drag: 1.4, burst: 8, sway: true}),
  EARTH: Object.freeze({shapes: [['om', 'me'], ['omo', 'mem']], palette: [0xe8c890, 0x9a6a38, 0x4a2e14], every: 75, life: [420, 700],
    vx: [-60, 60], vy: [-150, -60], gravity: 520, drag: 0.3, burst: 11, bounce: true}),
  WIND: Object.freeze({shapes: [['cmme'], ['cme']], palette: [0xeafff4, 0x6fd9a0, 0x2a7a5a], every: 60, life: [240, 420],
    vx: [-140, 140], vy: [-20, 20], gravity: 0, drag: 2.2, burst: 9, align: true}),
  SUN: Object.freeze({shapes: [['.c.', 'cmc', '.c.'], ['c']], palette: [0xffffff, 0xffe066, 0xc08a10], every: 60, life: [360, 620],
    vx: [-30, 30], vy: [-60, -20], gravity: -10, drag: 1.4, burst: 10, flicker: true}),
  MOON: Object.freeze({shapes: [['.m.', 'mcm', 'em.'], ['mc', 'e.']], palette: [0xf0d8ff, 0x9b52d6, 0x3c1660], every: 70, life: [480, 820],
    vx: [-25, 25], vy: [-45, -15], gravity: -20, drag: 1.0, burst: 9, sway: true}),
  METAL: Object.freeze({shapes: [['cme'], ['c', 'm']], palette: [0xffffff, 0xd0dae8, 0x5a6478], every: 55, life: [200, 360],
    vx: [-150, 150], vy: [-160, -40], gravity: 600, drag: 0.6, burst: 12, align: true, bounce: true}),
  NEUTRAL: Object.freeze({shapes: [['cm', 'me'], ['c']], palette: [0xffffff, 0xe8e0d0, 0x8a8070], every: 70, life: [300, 520],
    vx: [-60, 60], vy: [-110, -40], gravity: 380, drag: 0.6, burst: 8})
});

/** Motes alive at once per quality tier; the oldest gives way. */
export const PIXEL_MOTE_CAP = Object.freeze({saver: 30, balanced: 80, high: 110});

/**
 * Motes a hit throws by its weight (Owner 2026-11-10: the first cut looked 「很雜亂」).
 * A light hit throws a few, a medium one a handful, a heavy one the recipe's
 * burst, a signature 1.3x. They replace the battle's old generic sparks.
 */
export const PIXEL_MOTE_WEIGHT = Object.freeze({light: 3, medium: 6});

/** How many of `count` a crowded field still takes: all below half the cap, none at the cap. */
export function pixelMoteCrowding(count, live, cap) {
  const half = cap / 2;
  return live <= half ? count : Math.max(0, Math.round(count * (1 - (live - half) / half)));
}

/** The element a mote recipe exists for (unknown -> NEUTRAL). */
export function pixelMoteElement(element) {
  return PIXEL_MOTE_RECIPES[element] ? element : 'NEUTRAL';
}

/** Small seeded generator (mulberry32). */
export function pixelMoteRandom(seed = 0x6d07e5) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const rgba = (c, a = 255) => [(c >> 16) & 255, (c >> 8) & 255, c & 255, a];

/** A shape's RGBA texels: c core, m main, e edge, o a dark outline of the edge colour. */
export function paintPixelMote(rows, [core, main, edge]) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), data = new Uint8ClampedArray(w * h * 4);
  const dark = ((((edge >> 16) & 255) * 0.35) << 16) | ((((edge >> 8) & 255) * 0.35) << 8) | ((edge & 255) * 0.4);
  const tone = {c: rgba(core), m: rgba(main), e: rgba(edge), o: rgba(dark)};
  rows.forEach((row, y) => [...row].forEach((k, x) => { if (tone[k]) data.set(tone[k], (y * w + x) * 4); }));
  return {w, h, data};
}

export function createPixelMotes({PIXI, layer, quality = 'balanced', reducedMotion = false, doc = globalThis.document, seed = 0x6d07e5}) {
  if (!PIXI || !layer || !doc) return null;
  const cap = PIXEL_MOTE_CAP[quality] ?? PIXEL_MOTE_CAP.balanced;
  const random = pixelMoteRandom(seed), between = ([a, b]) => a + (b - a) * random();
  const textures = new Map(), live = [], pool = [], trails = new Map();
  const stats = {emitted: 0, dropped: 0, peak: 0};
  let elapsed = 0;

  function texturesOf(element) {
    if (textures.has(element)) return textures.get(element);
    const recipe = PIXEL_MOTE_RECIPES[element], list = [];
    for (const rows of recipe.shapes) {
      const {w, h, data} = paintPixelMote(rows, recipe.palette), canvas = doc.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const context = canvas.getContext?.('2d');
      if (typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') { textures.set(element, null); return null; }
      const image = context.createImageData(w, h); image.data.set(data); context.putImageData(image, 0, 0);
      const texture = PIXI.Texture.from(canvas); texture.source.scaleMode = 'nearest';
      list.push(texture);
    }
    textures.set(element, list);
    return list;
  }

  function spawn(element, x, y, groundY, unit, {dir = 0, speed = 1, lifeScale = 1} = {}) {
    const key = pixelMoteElement(element), recipe = PIXEL_MOTE_RECIPES[key], list = texturesOf(key);
    if (!list) return;
    if (live.length >= cap) { const old = live.shift(); old.sprite.visible = false; pool.push(old.sprite); stats.dropped++; }
    const sprite = pool.pop() ?? new PIXI.Sprite(list[0]);
    if (!sprite.parent) layer.addChild(sprite);
    sprite.texture = list[Math.floor(random() * list.length)];
    sprite.anchor.set(0.5); sprite.eventMode = 'none'; sprite.visible = true; sprite.alpha = 1; sprite.rotation = 0;
    // One texel is about half a native pixel: coarse enough to read as a spark, still finer than a fighter's outline.
    const texel = Math.max(0.75, (unit > 0 ? unit : 1) * 0.55);
    sprite.scale.set(texel);
    const vx = between(recipe.vx) * speed * texel + dir * 60 * texel, vy = between(recipe.vy) * speed * texel;
    live.push({sprite, recipe, x, y, groundY: groundY ?? null, vx, vy, age: 0, life: between(recipe.life) * lifeScale, texel, phase: random() * 6.28});
    sprite.position.set(Math.round(x), Math.round(y));
    stats.emitted++; stats.peak = Math.max(stats.peak, live.length);
  }

  return Object.freeze({
    /**
     * A live move effect `id` of `element` at (x, y): one mote per the
     * recipe's cadence while it lives. Reduced motion: none.
     */
    trail(id, {element, x, y, groundY = null, unit = 1}) {
      if (reducedMotion) return;
      const key = pixelMoteElement(element), recipe = PIXEL_MOTE_RECIPES[key];
      const entry = trails.get(id) ?? {next: elapsed};
      // A trail is sparse (1.6x the recipe's cadence) and yields entirely once the field is half full.
      if (elapsed >= entry.next) {
        if (live.length <= cap / 2) spawn(key, x + (random() - 0.5) * 6 * unit, y + (random() - 0.5) * 6 * unit, groundY, unit, {speed: 0.7});
        entry.next = elapsed + recipe.every * 1.6 * (quality === 'saver' ? 2 : 1);
      }
      entry.seen = elapsed;
      trails.set(id, entry);
    },
    /**
     * A landed hit of `weight` (light, medium, heavy, ultimate; `heavy: true`
     * reads as heavy), thrown along `dir` (-1, 0, 1). A crowded field takes
     * fewer. Reduced motion: a third, no throw.
     */
    burst({element, x, y, groundY = null, unit = 1, heavy = false, weight = heavy ? 'heavy' : 'medium', dir = 0}) {
      const recipe = PIXEL_MOTE_RECIPES[pixelMoteElement(element)];
      let count = PIXEL_MOTE_WEIGHT[weight] ?? Math.round(recipe.burst * (weight === 'ultimate' ? 1.3 : 1));
      if (quality === 'saver') count = Math.ceil(count / 2);
      if (reducedMotion) count = Math.max(1, Math.round(count / 3));
      count = pixelMoteCrowding(count, live.length, cap);
      // Scattered a few texels round the contact, so a burst never starts as one clump.
      const r = (unit > 0 ? unit : 1) * 1.6;
      const strong = weight === 'heavy' || weight === 'ultimate';
      for (let i = 0; i < count; i++) spawn(element, x + (random() - 0.5) * 2 * r, y + (random() - 0.5) * 2 * r, groundY, unit, {dir: reducedMotion ? 0 : dir, speed: strong ? 1.6 : 1.1});
      return count;
    },
    /** Step every mote by the owner's frame delta (0 holds them). */
    update(dtMs) {
      const step = Math.max(0, dtMs || 0), dt = step / 1000;
      elapsed += step;
      for (const [id, entry] of trails) if (elapsed - entry.seen > 400) trails.delete(id);
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i], r = m.recipe;
        m.age += step;
        if (m.age >= m.life) { m.sprite.visible = false; pool.push(m.sprite); live.splice(i, 1); continue; }
        const damp = Math.max(0, 1 - r.drag * dt);
        m.vx *= damp; m.vy = m.vy * damp + r.gravity * m.texel * dt;
        m.x += m.vx * dt + (r.sway ? Math.sin(m.age / 140 + m.phase) * 8 * m.texel * dt : 0); m.y += m.vy * dt;
        if (r.bounce && m.groundY !== null && m.y > m.groundY && m.vy > 0) { m.y = m.groundY; m.vy *= -0.35; m.vx *= 0.6; }
        const k = m.age / m.life;
        // Pixel finish: whole-texel positions, stepped fade, no soft alpha ramp.
        m.sprite.position.set(Math.round(m.x), Math.round(m.y));
        m.sprite.alpha = r.flicker ? (Math.floor(m.age / 50) % 3 === 2 ? 0.35 : 1) : k < 0.7 ? 1 : k < 0.88 ? 0.6 : 0.3;
        m.sprite.rotation = r.align ? Math.round(Math.atan2(m.vy, m.vx) / (Math.PI / 4)) * (Math.PI / 4) : 0;
      }
    },
    getDiagnostics: () => Object.freeze({...stats, live: live.length, cap, trails: trails.size, elements: [...textures.keys()]}),
    dispose() {
      for (const m of live.splice(0)) pool.push(m.sprite);
      for (const sprite of pool.splice(0)) { sprite.parent?.removeChild(sprite); sprite.destroy(); }
      for (const list of textures.values()) if (list) for (const t of list) t.destroy(true);
      textures.clear(); trails.clear();
    }
  });
}
