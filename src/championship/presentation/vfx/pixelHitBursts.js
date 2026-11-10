// Pixel move-hit bursts (STATUS_AILMENT_VFX_20261110, second part).
//
// Owner 2026-11-10: 「幫我把招式的特效也做得漂亮一點，像這次特殊效果的特效，我就
// 覺得很不錯」. One burst per effect element (pixelHitBurstSprites.js, the
// pixelfx hits converted to the game's outlined pixel finish) plays at a
// landed move's contact, on top of what already plays there: the move's own
// native cells, its kit burst and the flash keep their timing and place. A
// quality layer, not a replacement -- the original structure of every move
// stays as it was (UNIQUE_PIXEL_MOVE_VFX_20261108).
//
// Presentation only: no ticker of its own (the owner calls update with its
// frame delta), one canvas per element baked on first use, pooled sprites, a
// cap per quality tier, nearest sampling.
import {PIXEL_HIT_BURST_SPRITES} from './pixelHitBurstSprites.js';
import {decodeStatusAilmentFrame} from '../battleFx/battleStatusAilmentFx.js';

/** Bursts alive at once per quality tier; the oldest gives way. */
export const PIXEL_HIT_BURST_CAP = Object.freeze({saver: 4, balanced: 10, high: 14});
/** A burst's reference width in texels: a body of this many world px wears it at 1.1x its width. */
const REFERENCE_TEXELS = 160;

/** The burst an effect element plays (unknown -> NEUTRAL). */
export function pixelHitBurstFor(element) {
  return PIXEL_HIT_BURST_SPRITES[element] ? element : 'NEUTRAL';
}

/**
 * World px per texel for a burst on a body `size` world px wide, kept within
 * 0.2..0.5 native px per texel (`unit` = world px per native px) so it never
 * turns into blocks nor into dust.
 */
export function pixelHitBurstScale({size = 0, unit = 1, heavy = false} = {}) {
  const want = Math.max(1, size) * (heavy ? 1.4 : 1.1) / REFERENCE_TEXELS;
  const u = unit > 0 ? unit : 1;
  return Math.min(u * 0.5, Math.max(u * 0.2, want));
}

export function createPixelHitBursts({PIXI, layer, quality = 'balanced', reducedMotion = false, doc = globalThis.document}) {
  if (!PIXI || !layer || !doc) return null;
  const cap = PIXEL_HIT_BURST_CAP[quality] ?? PIXEL_HIT_BURST_CAP.balanced;
  const sheets = new Map(), live = [], pool = [];
  const stats = {spawned: 0, dropped: 0, peak: 0};

  function sheet(element) {
    if (sheets.has(element)) return sheets.get(element);
    const look = PIXEL_HIT_BURST_SPRITES[element];
    const n = look.frames.length, canvas = doc.createElement('canvas');
    canvas.width = look.w * n; canvas.height = look.h;
    const context = canvas.getContext?.('2d');
    // A canvas that cannot paint pixels (a headless stub) draws no burst rather than failing the hit.
    if (typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') { sheets.set(element, null); return null; }
    for (let i = 0; i < n; i++) {
      const image = context.createImageData(look.w, look.h);
      image.data.set(decodeStatusAilmentFrame(look, i));
      context.putImageData(image, i * look.w, 0);
    }
    const base = PIXI.Texture.from(canvas);
    base.source.scaleMode = 'nearest';
    const textures = Array.from({length: n}, (_, i) => new PIXI.Texture({source: base.source, frame: new PIXI.Rectangle(i * look.w, 0, look.w, look.h)}));
    const value = {base, textures, look};
    sheets.set(element, value);
    return value;
  }

  function recycle(burst) {
    burst.sprite.visible = false;
    pool.push(burst.sprite);
  }

  return Object.freeze({
    /**
     * A landed move of `element` at contact (x, y) on a body whose feet are at
     * groundY: ground bursts (splash, nova, thorns, dirt) stand on that line.
     * `flip` mirrors it along the blow. Returns the element played.
     */
    spawn({element, x, y, groundY = y, size = 0, unit = 1, heavy = false, flip = false, zIndex = null}) {
      const key = pixelHitBurstFor(element), art = sheet(key);
      if (!art) return null;
      if (live.length >= cap) { recycle(live.shift()); stats.dropped++; }
      const sprite = pool.pop() ?? new PIXI.Sprite(art.textures[0]);
      if (!sprite.parent) layer.addChild(sprite);
      sprite.label = `pixel hit ${key}`; sprite.eventMode = 'none';
      sprite.texture = art.textures[0];
      sprite.anchor.set(art.look.ox / art.look.w, art.look.oy / art.look.h);
      const scale = pixelHitBurstScale({size, unit, heavy});
      sprite.scale.set(scale * (flip ? -1 : 1), scale);
      sprite.position.set(Math.round(x), Math.round(art.look.anchor === 'ground' ? groundY : y));
      if (zIndex !== null) sprite.zIndex = zIndex;
      sprite.visible = true; sprite.alpha = 1;
      live.push({sprite, art, ms: 0});
      stats.spawned++; stats.peak = Math.max(stats.peak, live.length);
      return key;
    },
    /** Step every burst by the owner's frame delta (0 holds them, as a hit-stop does). */
    update(dtMs) {
      const step = Math.max(0, dtMs || 0);
      for (let i = live.length - 1; i >= 0; i--) {
        const burst = live[i];
        burst.ms += step;
        // Reduced motion: the burst's strongest frame, briefly, instead of the whole bloom.
        const n = burst.art.textures.length;
        const index = reducedMotion ? (burst.ms < 160 ? Math.floor(n / 4) : n) : Math.floor(burst.ms / 1000 * burst.art.look.fps);
        if (index >= n) { recycle(burst); live.splice(i, 1); continue; }
        burst.sprite.texture = burst.art.textures[index];
      }
    },
    getDiagnostics: () => Object.freeze({...stats, live: live.length, cap, sheets: [...sheets.keys()]}),
    dispose() {
      for (const burst of live.splice(0)) recycle(burst);
      for (const sprite of pool.splice(0)) { sprite.parent?.removeChild(sprite); sprite.destroy(); }
      for (const art of sheets.values()) if (art) { for (const t of art.textures) t.destroy(false); art.base.destroy(true); }
      sheets.clear();
    }
  });
}
