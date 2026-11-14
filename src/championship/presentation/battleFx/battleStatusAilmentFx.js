// Status-ailment dressing for the battle (STATUS_AILMENT_VFX_20261110).
//
// Owner 2026-11-10: 「交給你去處理幫我補完，然後或者是轉成我們適用的」 -- the battle
// keeps one negative-status slot per fighter (battle/battleStatus.js, runtime
// codes 1..14, VERIFIED_BINARY) but drew nothing for it. This layer shows it:
//   - a looping pixel overlay round the fighter (statusAilmentSprites.js, the
//     pixelfx loops converted to the game's outlined pixel finish), and
//   - a body treatment the scene applies to the fighter's own frame: a
//     multiply tint and, for hot or charged looks, a pulsing additive copy.
//
// Presentation only (OWNER_APPROVED_ADAPTATION): it reads the published
// `status.code` of each combatant and changes no timing, RNG, damage, duration
// or AI. Which look a runtime code wears is a display choice: the ROM evidence
// proves each code's mechanics (forced state, clear-then-normal, damage over
// time) but not a name, so every row below records the mechanic it rests on.
// No ticker of its own: the scene calls update() with its own frame delta.
import {STATUS_AILMENT_KEYS, STATUS_AILMENT_SPRITES, STATUS_AILMENT_STAND_IN} from '../vfx/statusAilmentSprites.js';

/**
 * Runtime status code -> look. `basis` is the evidence the choice rests on:
 * the mechanic in battleStatus.js and, where a move applies the code, what
 * the approved names of those moves describe (battle-moves.r1.json +0x5C
 * through ACTION_STATUS_TO_RUNTIME). Codes no move applies keep a look so a
 * future item or support source never shows nothing.
 */
export const STATUS_AILMENT_BY_RUNTIME_CODE = Object.freeze({
  1: Object.freeze({look: 'stunned', basis: 'SPECIAL_BRANCH next state 8 with forced movement; no move applies it'}),
  2: Object.freeze({look: 'charmed', basis: 'NORMAL gate; applied by charm, lure and lullaby moves (field_5C 10)'}),
  3: Object.freeze({look: 'frozen', basis: 'FORCE_STATE 9: the fighter is held; no move applies it'}),
  4: Object.freeze({look: 'rage', basis: 'FORCE_STATE 12; no move applies it'}),
  5: Object.freeze({look: 'confused', basis: 'SPECIAL_BRANCH next state 10 with forced movement; applied by dazzling spin moves (field_5C 1)'}),
  6: Object.freeze({look: 'slowed', basis: 'NORMAL gate; applied by one sticky bubble move (field_5C 7)'}),
  7: Object.freeze({look: 'poisoned', basis: '3% max HP every 180 ticks; applied by spore and miasma moves (field_5C 2)'}),
  8: Object.freeze({look: 'bleeding', basis: 'CLEAR_THEN_NORMAL, hit reaction 6; no move applies it'}),
  9: Object.freeze({look: 'sleep', basis: 'CLEAR_THEN_NORMAL, hit reaction 6; applied by chime and lullaby bubble moves (field_5C 4)'}),
  10: Object.freeze({look: 'electrified', basis: 'CLEAR_THEN_NORMAL, hit reaction 6; applied by thunder and binding moves (field_5C 3)'}),
  11: Object.freeze({look: 'slowed', basis: 'NORMAL gate; no move applies it'}),
  12: Object.freeze({look: 'petrified', basis: 'CLEAR_THEN_NORMAL, hit reaction 36; applied by petrifying gaze moves (field_5C 8)'}),
  13: Object.freeze({look: 'cursed', basis: '3% max HP every 180 ticks; applied by an eclipse orb (field_5C 9)'}),
  14: Object.freeze({look: 'burning', basis: '5% max HP every 10 ticks, 900 ticks; applied by searing ray and soul-pierce moves (field_5C 13)'})
});

/**
 * Per look: where the overlay sits on the fighter's box (`head`: the stand-in's
 * top on the body's top; `feet`: on the ground; `body`: centred), and what the
 * fighter's own frame wears -- `tint` multiplies it, `glow` is an additive copy
 * (alpha `glowAlpha`) that pulses every `pulseMs` (or flickers when `flicker`).
 * `behind` draws the loop behind its fighter: flames and smoke rise round the
 * silhouette instead of covering it.
 * `petrified` has no overlay: stone is the body itself.
 */
export const STATUS_AILMENT_LOOKS = Object.freeze({
  stunned: Object.freeze({align: 'head', tint: null, glow: null}),
  charmed: Object.freeze({align: 'head', tint: 0xffe0f2, glow: 0xff5fbf, glowAlpha: 0.22, pulseMs: 1200}),
  confused: Object.freeze({align: 'head', tint: null, glow: null}),
  sleep: Object.freeze({align: 'head', tint: 0xc8ccff, glow: null}),
  frozen: Object.freeze({align: 'feet', tint: 0xa8dcff, glow: 0x7fd8ff, glowAlpha: 0.3, pulseMs: 2000}),
  poisoned: Object.freeze({align: 'feet', tint: 0xb4f09a, glow: 0x7cff4a, glowAlpha: 0.26, pulseMs: 1600}),
  burning: Object.freeze({align: 'feet', tint: 0xffc8a0, glow: 0xff6a1a, glowAlpha: 0.34, pulseMs: 260, flicker: true}),
  bleeding: Object.freeze({align: 'feet', tint: 0xffb4b4, glow: 0xff2a2a, glowAlpha: 0.2, pulseMs: 900}),
  cursed: Object.freeze({align: 'feet', behind: true, tint: 0xd2b4f4, glow: 0x9b52d6, glowAlpha: 0.28, pulseMs: 1800}),
  rage: Object.freeze({align: 'feet', tint: 0xffb0a0, glow: 0xff3a2a, glowAlpha: 0.3, pulseMs: 500}),
  slowed: Object.freeze({align: 'feet', behind: true, tint: 0xc4eeee, glow: null}),
  electrified: Object.freeze({align: 'body', tint: 0xe4f4ff, glow: 0xbfe8ff, glowAlpha: 0.42, pulseMs: 120, flicker: true}),
  petrified: Object.freeze({align: null, tint: 0x8e8a86, glow: null})
});

/**
 * The look a runtime code wears, or null for 0 / an unknown code. A look name
 * (Data Arena conditions name theirs directly) passes through.
 */
export function statusAilmentLook(code) {
  if (typeof code === 'string') return STATUS_AILMENT_LOOKS[code] ? code : null;
  const row = STATUS_AILMENT_BY_RUNTIME_CODE[code | 0];
  return row ? row.look : null;
}

const KEY_INDEX = new Map([...STATUS_AILMENT_KEYS].map((key, i) => [key, i]));

/** One frame of a look as RGBA texels (w x h), decoded from its run-length rows. */
export function decodeStatusAilmentFrame(look, index) {
  const sprite = typeof look === 'string' ? STATUS_AILMENT_SPRITES[look] : look;
  if (!sprite) return null;
  const {w, h, palette} = sprite, data = new Uint8ClampedArray(w * h * 4);
  const rows = sprite.frames[((index % sprite.frames.length) + sprite.frames.length) % sprite.frames.length].split('/');
  for (let y = 0; y < h; y++) {
    let x = 0;
    for (const [, key, count] of (rows[y] ?? '').matchAll(/([^0-9])(\d*)/g)) {
      const n = count ? Number(count) : 1;
      if (key !== '.') {
        const [r, g, b, a] = palette[KEY_INDEX.get(key)];
        for (let k = 0; k < n; k++) data.set([r, g, b, Math.round(a * 255)], ((y * w) + x + k) * 4);
      }
      x += n;
    }
  }
  return data;
}

/**
 * Scale2x (EPX): doubles a frame the pixel-art way -- a texel copies a
 * neighbour only along a clean diagonal -- so a loop fitted to a big body keeps
 * a fine grain and smooth stair-steps instead of 2x2 blocks. `data` is RGBA.
 */
export function scale2xRgba(data, w, h) {
  const src = new Uint32Array(data.buffer, data.byteOffset, w * h), out = new Uint32Array(w * h * 4), W = w * 2;
  const at = (x, y) => src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = src[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    const o = y * 2 * W + x * 2;
    out[o] = C === A && C !== D && A !== B ? A : P;
    out[o + 1] = A === B && A !== C && B !== D ? B : P;
    out[o + W] = D === C && D !== B && C !== A ? C : P;
    out[o + W + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return new Uint8ClampedArray(out.buffer);
}

/**
 * Data Arena (relay) conditions -> looks, strongest first: a root holds the
 * fighter in ice (fire melts it, dataArenaSimulation.js), burn is damage over
 * time, slow is the movement scale.
 */
export function dataArenaStatusLook(body) {
  if (!body) return null;
  if (body.root > 0) return 'frozen';
  if (body.burn > 0) return 'burning';
  if (body.slow > 0) return 'slowed';
  return null;
}

/** Multiply two 0xRRGGBB colours (a tint on a tint). */
export function multiplyTint(a, b) {
  return ((((a >> 16) & 255) * ((b >> 16) & 255) / 255) << 16) | ((((a >> 8) & 255) * ((b >> 8) & 255) / 255) << 8) | ((a & 255) * (b & 255) / 255);
}

/** One texel of a loop, in native (original-screen) pixels: the 292 cells' grain. */
export const STATUS_AILMENT_TEXEL_NATIVE = 0.35;

/**
 * Where a look's overlay goes on a fighter's box {x, y (feet incl. lift),
 * top, width, height, unit (world px per native pixel)}: the anchor point and
 * the uniform texel scale. The grain follows the arena (`unit`); the box only
 * nudges it, within 0.8x..1.25x -- or, Scale2x'd, up to 2.5x at the same
 * grain -- so a big body gets a wider ring without the icons turning into
 * blocks. `scale` is world px per drawn texel, `detail` the frames to use.
 */
export function statusAilmentPlacement(look, box) {
  const {w: SW, h: SH} = STATUS_AILMENT_STAND_IN;
  const fit = Math.sqrt(Math.max(1, box.width) / SW * Math.max(1, box.height) / SH);
  const base = (box.unit > 0 ? box.unit : 1) * STATUS_AILMENT_TEXEL_NATIVE;
  // A body 1.6x the stand-in's grain or more wears the Scale2x frames (`detail` 2).
  const detail = fit >= base * 1.6 ? 2 : 1;
  const size = Math.min(base * 1.25 * detail, Math.max(base * 0.8, fit)); // world px per stand-in texel
  const scale = size / detail;
  const align = STATUS_AILMENT_LOOKS[look]?.align ?? 'feet';
  const feetY = align === 'head' ? box.top + SH * size
    : align === 'body' ? (box.top + box.y) / 2 + SH * size / 2
    : box.y;
  return {x: box.x, y: feetY, scale, detail};
}

/**
 * The layer. `layer` is the fighters' own sortable container, so an overlay
 * sorts just in front of its fighter. `doc` supplies canvases (tests pass a stub).
 */
export function createBattleStatusAilmentFx({PIXI, layer, reducedMotion = false, quality = 'balanced', doc = globalThis.document}) {
  if (!PIXI || !layer || !doc) return null;
  const sheets = new Map(); // look -> {source, textures}
  const slots = new Map(); // slot -> {look, ms, sprite}
  let elapsed = 0;

  function sheet(look, detail = 1) {
    const id = `${look}@${detail}`;
    if (sheets.has(id)) return sheets.get(id);
    const sprite = STATUS_AILMENT_SPRITES[look];
    if (!sprite) { sheets.set(id, null); return null; }
    const n = sprite.frames.length, fw = sprite.w * detail, fh = sprite.h * detail, canvas = doc.createElement('canvas');
    canvas.width = fw * n; canvas.height = fh;
    const context = canvas.getContext?.('2d');
    if (typeof context?.createImageData !== 'function' || typeof context.putImageData !== 'function') { sheets.set(id, null); return null; }
    for (let i = 0; i < n; i++) {
      const image = context.createImageData(fw, fh), texels = decodeStatusAilmentFrame(sprite, i);
      image.data.set(detail === 2 ? scale2xRgba(texels, sprite.w, sprite.h) : texels);
      context.putImageData(image, i * fw, 0);
    }
    const base = PIXI.Texture.from(canvas);
    base.source.scaleMode = 'nearest';
    const textures = Array.from({length: n}, (_, i) => new PIXI.Texture({source: base.source,
      frame: new PIXI.Rectangle(i * fw, 0, fw, fh)}));
    const value = {base, textures, sprite, detail};
    sheets.set(id, value);
    return value;
  }

  function retire(slot) {
    const entry = slots.get(slot);
    if (!entry) return;
    entry.sprite?.parent?.removeChild(entry.sprite);
    entry.sprite?.destroy();
    slots.delete(slot);
  }

  return Object.freeze({
    /** Advance the loops by the scene's own frame delta. */
    update(dtMs) { elapsed += Math.max(0, dtMs || 0); for (const entry of slots.values()) entry.ms += Math.max(0, dtMs || 0); },
    /**
     * Show (or clear) a fighter's status. `box` = {x, y, top, width, height,
     * zIndex}; `visible` false hides the overlay (down, blank frame) without
     * forgetting its loop.
     */
    place(slot, code, box, {visible = true, alpha = 1} = {}) {
      const look = statusAilmentLook(code);
      let entry = slots.get(slot);
      if (entry && entry.look !== look) { retire(slot); entry = null; }
      if (!look) return null;
      if (!entry) { entry = {look, ms: 0, sprite: null}; slots.set(slot, entry); }
      const at = statusAilmentPlacement(look, box);
      const art = STATUS_AILMENT_LOOKS[look]?.align ? sheet(look, at.detail) : null;
      if (art && entry.sprite && entry.detail !== at.detail) entry.sprite.texture = art.textures[0];
      entry.detail = at.detail;
      if (art && !entry.sprite) {
        entry.sprite = new PIXI.Sprite(art.textures[0]);
        entry.sprite.label = `battle status ${look}`;
        entry.sprite.eventMode = 'none';
        entry.sprite.anchor.set(art.sprite.ox / art.sprite.w, art.sprite.oy / art.sprite.h);
        layer.addChild(entry.sprite);
      }
      if (entry.sprite) {
        const n = art.textures.length;
        // Reduced motion keeps the state readable and drops the travel: one held frame.
        const index = reducedMotion ? Math.floor(n / 3) : Math.floor(entry.ms / 1000 * art.sprite.fps) % n;
        entry.sprite.texture = art.textures[index];
        entry.sprite.position.set(Math.round(at.x), Math.round(at.y));
        entry.sprite.scale.set(at.scale);
        entry.sprite.zIndex = (box.zIndex ?? box.y) + (STATUS_AILMENT_LOOKS[look].behind ? -0.02 : 0.02);
        entry.sprite.visible = Boolean(visible);
        entry.sprite.alpha = alpha;
        entry.scale = at.scale; entry.unit = box.unit ?? null;
      }
      return look;
    },
    /**
     * What the fighter's own frame wears this frame: {tint, glow, glowAlpha}
     * or null. Saver quality keeps the tint and drops the additive copy.
     */
    body(slot) {
      const entry = slots.get(slot);
      const style = entry ? STATUS_AILMENT_LOOKS[entry.look] : null;
      if (!style || (!style.tint && !style.glow)) return null;
      let glowAlpha = 0;
      if (style.glow && quality !== 'saver') {
        const phase = reducedMotion ? 0.5 : style.flicker
          ? (Math.floor(entry.ms / style.pulseMs) * 2654435761 >>> 0) % 1000 / 1000
          : 0.5 - 0.5 * Math.cos(entry.ms / style.pulseMs * Math.PI * 2);
        glowAlpha = style.glowAlpha * (0.45 + 0.55 * phase);
      }
      return {look: entry.look, tint: style.tint ?? 0xffffff, glow: glowAlpha > 0 ? style.glow : null, glowAlpha};
    },
    /** Hide a slot's loop for this frame (a blank animation cell) without forgetting it. */
    hide(slot) { const entry = slots.get(slot); if (entry?.sprite) entry.sprite.visible = false; },
    /** Forget every slot not in `keep` (a Set of slots drawn this frame). */
    retireExcept(keep) { for (const slot of [...slots.keys()]) if (!keep.has(slot)) retire(slot); },
    retire,
    getDiagnostics: () => Object.freeze({elapsed: Math.round(elapsed), sheets: [...sheets.keys()],
      slots: [...slots].map(([slot, e]) => Object.freeze({slot, look: e.look, overlay: Boolean(e.sprite?.visible), scale: e.scale ?? null, unit: e.unit ?? null, detail: e.detail ?? null,
        frame: e.sprite ? e.sprite.texture.frame.x / Math.max(1, e.sprite.texture.frame.width) : null}))}),
    dispose() {
      for (const slot of [...slots.keys()]) retire(slot);
      for (const art of sheets.values()) if (art) { for (const t of art.textures) t.destroy(false); art.base.destroy(true); }
      sheets.clear();
    }
  });
}
