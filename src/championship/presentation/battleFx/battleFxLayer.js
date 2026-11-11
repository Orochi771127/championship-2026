// Dynamic battle presentation -- skill and field interaction on Pixi.
//
// OWNER_APPROVED_ADAPTATION 2026-10-12 (docs/coordination/OWNER_DIRECTION.md):
// 「技能特效和場地的互動，例如落地揚塵、命中衝擊波、爆炸碎屑、短暫焦痕。這些要對準
// 真正的出招位置、命中點與地面，不能只是浮在角色身上的光效。」
//
// So every mark here is anchored to something the battle itself placed:
//   launch point  the first position of the move's live effect actor;
//   contact point the native impact spark, else the projectile's last position;
//   ground        the native ground y under that point (height removed), or a
//                 fighter's stand point.
// Dust, shock rings, debris (which falls and bounces on that ground) and short
// scorch marks live on the arena; nothing glows on a body except the brief hit
// flash. The existing effect art keeps drawing the moves themselves.
//
// The layer reads the published battle view and the tracker's events only. It
// owns no clock (the scene hands it the one Pixi ticker's elapsed time) and
// writes nothing the simulation reads. Textures are generated at mount.
import {battleOpeningText} from '../../text/battleOpeningText.js';
import {BATTLE_FX_PALETTES, battleFxFamilyForm, battleFxFamilyPalette} from './battleFxRecipes.js';
import {createElementVfxLayer} from '../vfx/elementVfxLayer.js';
import {pixelateCanvas} from '../vfx/pixelateCanvas.js';
import {CRITICAL_VFX_SYSTEM, supportVfxSystem} from '../vfx/unifiedMoveVfxResolver.js';
import {createMoveVfxKit, moveVfxArchetypeIsMelee, moveVfxArchetypeIsPlanted} from '../vfx/moveVfxKit.js';
import {moveVfxSignature} from '../vfx/moveVfxSignatures.js';
import {battleEffectCellIsOriginal} from '../battleEffectSprites.js';
import {createPixelHitBursts} from '../vfx/pixelHitBursts.js';
import {createPixelMotes} from '../vfx/pixelMotes.js';
import {moveVfxChoreography, moveVfxSupportChoreography} from '../vfx/moveVfxChoreography.js';
import {createMoveVfxSetPieces} from '../vfx/moveVfxSetPieces.js';
/** Palette key -> the element its motes wear (as unifiedMoveVfxResolver reads a bank's family colour). */
const PALETTE_ELEMENT = Object.freeze({fire: 'FIRE', water: 'WATER', ice: 'ICE', thunder: 'THUNDER', metal: 'METAL', nature: 'WOOD',
  earth: 'EARTH', wind: 'WIND', light: 'SUN', dark: 'MOON'});

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t);

/** Linear mix of two 0xRRGGBB colours. */
export function mixColor(a, b, t) {
  const channel = shift => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Seeded PRNG so a battle's dressing is repeatable in a recording. */
export function battleFxRandom(seed = 0x2f6e2b1) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Particle budget per quality tier. */
export const BATTLE_FX_PARTICLE_CAP = Object.freeze({saver: 90, balanced: 240, high: 380});

/** Hit strength from the damage share of the target's maximum HP. */
export function battleFxHitTier({ratio = 0, ultimate = false, critical = false} = {}) {
  if (ultimate || critical || ratio >= 0.15) return 'heavy';
  if (ratio >= 0.06) return 'medium';
  return 'light';
}

/** Project a native Q12 point [x, y, z] to the scene's local space. */
export function battleFxProject(point, artRect, nativeScale) {
  const x = artRect.x + point[0] / 4096 * nativeScale;
  return {x, y: artRect.y + (point[1] - point[2]) / 4096 * nativeScale, groundY: artRect.y + point[1] / 4096 * nativeScale,
    heightNative: point[2] / 4096};
}

/**
 * Where a hit lands: the freshest native impact near the target, else a
 * projectile that ended this frame near it, else the target's body on the
 * attacker's side. The ground is always the target's own stand line.
 */
export function battleFxHitPoint({target, impacts = [], endings = [], attacker = null}) {
  const near = (p, limit) => Math.abs(p.x - target.x) <= limit;
  const impact = impacts.filter(p => near(p, target.width)).sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x))[0];
  if (impact) return {x: impact.x, y: impact.y, groundY: target.groundY, source: 'NATIVE_IMPACT'};
  const ending = endings.filter(p => near(p, target.width * 1.2)).sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x))[0];
  if (ending) return {x: ending.x, y: ending.y, groundY: target.groundY, source: 'PROJECTILE_END'};
  const side = attacker ? Math.sign(attacker.x - target.x) || target.facing : target.facing;
  return {x: target.x + side * target.width * 0.28, y: target.top + target.height * 0.45, groundY: target.groundY, source: 'BODY_SIDE'};
}

function makeCanvas(width, height) {
  const doc = globalThis.document;
  if (typeof doc?.createElement !== 'function') return null;
  const canvas = doc.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas.getContext?.('2d') ? canvas : null;
}

/** Generated textures; null when no 2D canvas exists (Node tests). */
function createTextures(PIXI) {
  if (!makeCanvas(1, 1)) return null;
  // Pixel look (MOVE_VFX_KIT_20261105): the AI battle draws sequence cells, so its
  // generated glows, dust and marks are pixelated to match instead of smooth gradients.
  const linear = (w, h, draw) => {
    const canvas = makeCanvas(w, h), ctx = canvas.getContext('2d');
    draw(ctx);
    pixelateCanvas(canvas, {block: 1, levels: 4});
    const texture = PIXI.Texture.from(canvas);
    texture.source.scaleMode = 'nearest';
    return texture;
  };
  const pixel = (w, h, draw) => {
    const texture = linear(w, h, draw);
    texture.source.scaleMode = 'nearest';
    return texture;
  };
  const radial = stops => linear(64, 64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  return {
    // A contact flash: hot core, short falloff.
    flash: radial([[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,0.8)'], [0.55, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]),
    // Dust: soft round puff for take-off, landing, runs and impacts.
    dust: radial([[0, 'rgba(255,255,255,0.75)'], [0.6, 'rgba(255,255,255,0.32)'], [1, 'rgba(255,255,255,0)']]),
    spark: pixel(6, 2, ctx => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 6, 2); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(4, 0, 2, 2); }),
    dot: pixel(2, 2, ctx => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 2, 2); }),
    // Debris: three small irregular chunks, lit from above.
    debris: [[0, 0, 3, 3], [0, 1, 4, 2], [1, 0, 2, 3]].map(([x, y, w, h]) => pixel(4, 3, ctx => {
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y + h - 1, w, 1);
    })),
    // Scorch: a dark oval with a faint warm rim, stepped like the rest.
    scorch: linear(96, 40, ctx => {
      ctx.translate(48, 20); ctx.scale(1, 0.4);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
      g.addColorStop(0, 'rgba(14,9,7,0.78)'); g.addColorStop(0.5, 'rgba(26,16,12,0.5)');
      g.addColorStop(0.82, 'rgba(140,80,40,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill();
    })
  };
}

// Warm grey-brown: reads on dark floors as dust and on pale sand as kicked-up dirt.
const DUST = 0xa89580;
const DEBRIS = [0x8f8070, 0x6f6152, 0xb0a08c];
const MOVING_FORMS = new Set(['projectile', 'stream', 'beam', 'area']);
const FOLLOW_FORMS = new Set(['projectile', 'stream', 'beam']);

/**
 * The arcade impact quartet (Owner direction 2026-10-28), layered on the
 * dynamic presentation when `juicy` is on: a 120 ms wind-up squash and glint,
 * an additive white-core / element-halo contact flash, a 65 ms presentation
 * hit-stop on solid hits (the battle keeps stepping; only drawing holds), an
 * element-tinted hit flash with a 14-30 px knockback slide and dust (Owner
 * 2026-11-03 four-beat feel: wind-up, lunge, hit-stop, knockback), and pooled arcing damage
 * numbers (critical: 1.4x with an amber star). Specials hand their title to
 * the DOM cut-in strip, dim the field 35 % for about half a second and close
 * a charge ring on the caster; ordinary skills get a slanted name capsule.
 */
export const BATTLE_FX_JUICY = Object.freeze({windupMs: 120, hitStopMs: 65,
  // MOVE_VFX_QUALITY_20261110: the hold scales with the blow -- a heavy hit keeps 65 ms, a medium one a lighter 45 ms,
  // a critical or a signature hit 95 ms; a light hit never holds. Drawing only: the battle keeps stepping.
  hitStopByTier: Object.freeze({light: 0, medium: 45, heavy: 65, ultimate: 95}), capsuleMs: 550, dimStrength: 0.35, dimMs: 520,
  knockPx: Object.freeze({light: 14, medium: 22, heavy: 30}), knockMs: 200, slowMoMs: 180, numberMs: 820, criticalScale: 1.4, numberPool: 6});

/**
 * The hyper ring wrapped round its caster (Owner 2026-11-03): a ground circle
 * and a crown of light streaks on an ellipse at the caster's feet. Streaks and
 * arcs on the far half (sin < 0) draw behind the body, the near half in front,
 * so the ring encloses the fighter instead of lying over it.
 */
export function battleHyperWrapStreaks({count = 18, phase = 0} = {}) {
  const streaks = [];
  for (let i = 0; i < count; i++) {
    const angle = phase + i * TAU / count;
    streaks.push({angle, back: Math.sin(angle) < 0, lift: 0.55 + 0.45 * Math.abs(Math.sin(i * 2.399 + phase * 3))});
  }
  return streaks;
}

export function createBattleFxLayer({PIXI, worldBack, worldFront, screen, quality = 'balanced', reducedMotion = false, responsiveLayout = false,
  flashScale = 1, describeMove = () => null, nameOfSlot = () => '', moveNameOf = () => '', text = value => value, seed = 0x51ed, juicy = false,
  resolveMove = () => null, effectArt = null, hitFeel = null}) {
  const textures = createTextures(PIXI);
  if (!textures) return null;
  const random = battleFxRandom(seed);
  const cap = BATTLE_FX_PARTICLE_CAP[quality] ?? BATTLE_FX_PARTICLE_CAP.balanced;
  const rich = quality !== 'saver';

  const scorchLayer = new PIXI.Container({label: 'battle fx scorch'});
  const groundGfx = new PIXI.Graphics(); groundGfx.label = 'battle fx ground shock rings';
  const ghostLayer = new PIXI.Container({label: 'battle fx dash afterimages'});
  const hyperBack = new PIXI.Graphics(); hyperBack.label = 'battle fx hyper ring (behind)'; hyperBack.blendMode = 'add';
  worldBack.addChild(scorchLayer, groundGfx, hyperBack, ghostLayer);
  const trailGfx = new PIXI.Graphics(); trailGfx.blendMode = 'add'; trailGfx.label = 'battle fx motion streaks';
  const particleLayer = new PIXI.Container({label: 'battle fx particles'});
  const flashLayer = new PIXI.Container({label: 'battle fx contact flashes'});
  const hyperFront = new PIXI.Graphics(); hyperFront.label = 'battle fx hyper ring (in front)'; hyperFront.blendMode = 'add';
  worldFront.addChild(hyperFront, trailGfx, particleLayer, flashLayer);
  const speedGfx = new PIXI.Graphics(); speedGfx.label = 'battle fx speed lines';
  const barGfx = new PIXI.Graphics(); barGfx.label = 'battle fx overhead bars';
  const wordLayer = new PIXI.Container({label: 'battle fx words'});
  const calloutLayer = new PIXI.Container({label: 'battle fx callout'});
  const numberLayer = new PIXI.Container({label: 'battle fx damage numbers'});
  const flashGfx = new PIXI.Graphics(); flashGfx.label = 'battle fx screen flash';
  screen.addChild(speedGfx, barGfx, wordLayer, numberLayer, calloutLayer, flashGfx);
  // Five-layer element dressing (VFX_FIVE_LAYER_20261101): charge orbs, muzzle
  // rings, signature storms, four-second ground marks, struck-body overlays and
  // the fallback cells of records that name no effect bank. resolveMove(slot,
  // moveId) is presentation/vfx/unifiedMoveVfxResolver.js through the app.
  const element = createElementVfxLayer({PIXI, ground: worldBack, front: worldFront, art: effectArt, quality, reducedMotion, seed: seed ^ 0x77, pixel: true});
  // Every move its own effect (UNIQUE_PIXEL_MOVE_VFX_20261108). The kit draws,
  // in the one pixel style: a skill's sigil on the ground while it gathers, the
  // trail along a shot drawn in original cells, the move's closing burst on a
  // hit, and -- where a live effect actor shows a cell only the reference atlas
  // has (battleEffectSprites retires those) -- the move's whole kit effect on
  // that actor, so its native timing and path stay.
  const kit = createMoveVfxKit({PIXI, front: worldFront, ground: worldBack, quality: rich ? 'balanced' : 'saver', reducedMotion, seed: seed ^ 0x5163});
  // Pixel hit bursts (STATUS_AILMENT_VFX_20261110): the element's pixel burst at every landed move, over the move's own cells.
  const pixelHits = typeof createPixelHitBursts === 'function' ? createPixelHitBursts({PIXI, layer: worldFront, quality: rich ? 'balanced' : 'saver', reducedMotion}) : null;
  // Pixel motes (MOVE_VFX_QUALITY_20261110): element particles trailing every live move effect and scattering from every hit.
  const burstAt = new Map(); // slot -> elapsed ms of its last pixel hit burst
  // Each move's own moment (BESPOKE_MOVE_VFX_PROGRAM_20261111): bespoke pixel set pieces from its choreography.
  const setPieces = typeof createMoveVfxSetPieces === 'function' ? createMoveVfxSetPieces({PIXI, layer: worldFront, reducedMotion}) : null;
  const motes = typeof createPixelMotes === 'function' ? createPixelMotes({PIXI, layer: worldFront, quality: rich ? 'balanced' : 'saver', reducedMotion, seed: seed ^ 0x6d07}) : null;
  const standIns = new Map(); // live effect actor id -> {at, alive, standIn, trail, ...}
  const kitStats = {standIns: 0, trails: 0, sigils: 0, bursts: 0, size: 0};
  const signatureOf = moveId => Number.isSafeInteger(moveId) ? moveVfxSignature(moveId) : null;
  const romCell = actor => { const cell = effectArt?.getCell?.(actor.bankId, actor.cell); return Boolean(cell) && !battleEffectCellIsOriginal(cell); };
  const cues = []; // bounded 3D cues for the Three overlay: buffs, criticals, signature weather
  const cue = value => { cues.push(Object.freeze(value)); if (cues.length > 24) cues.shift(); }; // unread cues never pile up
  const vfxOf = (slot, moveId) => Number.isSafeInteger(moveId) ? resolveMove(slot, moveId) ?? null : null;
  const muzzleOf = info => ({x: info.x + Math.sign(info.facing || 1) * info.width * 0.3, y: info.top + info.height * 0.38});

  const particles = [], particlePool = [];
  const flashes = [], flashPool = [];
  const ghosts = [], ghostPool = [];
  const scorches = [];
  const rings = [];
  const words = [];
  const tracked = new Map(); // live effect actor id -> its look and recent path
  const actorFx = new Map(); // slot -> {flash, squash, knock, knockDir}
  const bars = new Map();
  const landedAt = new Map();
  const seenImpacts = new Set();
  let freshImpacts = [], endings = [];
  let callout = null, dim = null, speed = 0, screenFlash = 0, banner = null;
  let elapsed = 0, created = 0, peak = 0, eventsHandled = 0;
  // Arcade quartet state (juicy only).
  const numbers = [], numberPool = [];
  const capsules = [];
  let hitStop = null;
  let hyper = null; // {slot, age} while the special prelude shows its ring
  const quartet = {windups: 0, hitStops: 0, numbers: 0, criticals: 0, capsules: 0, implodes: 0, pillars: 0};
  const anchors = {NATIVE_IMPACT: 0, PROJECTILE_END: 0, BODY_SIDE: 0};
  let lastCtx = null;

  // ---------------------------------------------------------------- primitives
  function spawnParticle({x, y, vx = 0, vy = 0, life = 500, texture = textures.dot, tint = 0xffffff, scale = 1, scaleTo = null,
    gravity = 0, drag = 0, add = true, alpha = 1, rotation = 0, spin = 0, align = false, groundY = null, bounce = 0.35}) {
    if (particles.length >= cap) return null;
    const sprite = particlePool.pop() ?? new PIXI.Sprite(texture);
    sprite.texture = texture; sprite.anchor.set(0.5); sprite.tint = tint; sprite.alpha = alpha;
    sprite.blendMode = add ? 'add' : 'normal'; sprite.visible = true; sprite.rotation = rotation;
    sprite.scale.set(scale); sprite.position.set(x, y);
    if (!sprite.parent) particleLayer.addChild(sprite);
    const p = {sprite, x, y, vx, vy, life, age: 0, scale, scaleTo: scaleTo ?? scale, gravity, drag, alpha, spin, align, groundY, bounce, rested: false};
    particles.push(p); created++; peak = Math.max(peak, particles.length);
    return p;
  }
  /** A brief additive flash at a contact or launch point (not on a body). */
  function spawnFlash({x, y, tint, size, life = 140}) {
    const sprite = flashPool.pop() ?? new PIXI.Sprite(textures.flash);
    sprite.anchor.set(0.5); sprite.blendMode = 'add'; sprite.tint = tint; sprite.visible = true; sprite.position.set(x, y);
    if (!sprite.parent) flashLayer.addChild(sprite);
    flashes.push({sprite, size, life, age: 0});
  }
  /** A ground shock ring: an ellipse on the arena's floor plane. */
  function spawnRing({x, groundY, radius, tint, life = 340, width = 2.5, alpha = 0.95, delay = 0, implode = false}) {
    rings.push({x, y: groundY, radius, tint, life, age: -delay, width, alpha, implode});
  }
  /** A short-lived scorch on the ground. */
  function spawnScorch({x, groundY, size, life = 2600}) {
    if (scorches.length >= 12) { const old = scorches.shift(); old.sprite.destroy(); }
    const sprite = new PIXI.Sprite(textures.scorch);
    sprite.anchor.set(0.5); sprite.position.set(x, groundY); sprite.scale.set(clamp(size, 18, 64) / 96);
    sprite.rotation = (random() - 0.5) * 0.15;
    scorchLayer.addChild(sprite);
    scorches.push({sprite, age: 0, life});
  }
  /** Dust on the ground: puffs that spread low and rise a little. */
  function dust({x, groundY, count, spread = 10, tint = DUST, life = 650, scale = 1, push = 0}) {
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1, angle = random() * Math.PI;
      spawnParticle({x: x + side * random() * spread, y: groundY - random() * 2, texture: textures.dust,
        vx: side * (16 + random() * 26) + push * 30, vy: -6 - random() * 10 * Math.sin(angle), life: life * (0.7 + random() * 0.6),
        tint, scale: 0.32 * scale * (0.7 + random() * 0.6), scaleTo: 0.8 * scale, add: false, alpha: 0.58, drag: 2.2});
    }
  }
  /** Debris thrown from a ground point; it falls back to that ground and bounces. */
  function debris({x, y, groundY, count, palette, power = 1}) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (random() - 0.5) * 2.2, v = (90 + random() * 120) * power;
      const tint = i % 4 === 3 ? mixColor(DEBRIS[i % 3], palette.edge, 0.4) : DEBRIS[i % 3];
      spawnParticle({x: x + (random() - 0.5) * 6, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 900 + random() * 500,
        texture: textures.debris[i % 3], tint, scale: 1.5 + random() * 1.1, gravity: 520, drag: 0.4, add: false,
        rotation: random() * TAU, spin: (random() - 0.5) * 14, groundY: groundY + random() * 3});
    }
  }
  /** Sparks from a contact point. */
  function sparks({x, y, count, palette, speed = 150, life = 380, scale = 1, groundY = null}) {
    const colors = [palette.core, palette.main, palette.main, palette.edge];
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU, v = speed * (0.35 + random() * 0.85);
      const texture = i % 2 ? textures.spark : textures.dot;
      spawnParticle({x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v * 0.8 - speed * 0.2, life: life * (0.6 + random() * 0.7),
        texture, tint: colors[i % colors.length], scale: scale * (0.8 + random() * 0.8), scaleTo: scale * 0.2, gravity: 260, drag: 1.8,
        rotation: angle, align: texture === textures.spark, groundY, bounce: 0.2});
    }
  }
  function fxFor(slot) {
    let fx = actorFx.get(slot);
    if (!fx) { fx = {flash: 0, squash: 0, knock: 0, knockDir: 0, knockPx: 3, charge: 0, flashTint: 0xffffff, dashTint: null, dashMs: 0}; actorFx.set(slot, fx); }
    return fx;
  }
  /** A pooled damage number that arcs away from the hit (juicy). */
  function spawnNumber({x, y, value, critical = false, dir = 1, tint = 0xffffff}) {
    if (!Number.isFinite(value) || value <= 0) return;
    if (numbers.length >= BATTLE_FX_JUICY.numberPool) { const old = numbers.shift(); old.node.visible = false; numberPool.push(old.node); }
    let node = numberPool.pop();
    if (!node) {
      node = new PIXI.Container({label: 'battle fx damage number'});
      const star = new PIXI.Graphics();
      const points = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = -Math.PI / 2 + i * Math.PI / 5; points.push(Math.cos(a) * r, Math.sin(a) * r); }
      star.poly(points).fill({color: 0xffb83d}).stroke({width: 2, color: 0x2a1600});
      const label = makeText('0', {size: 22, fill: 0xffffff, stroke: 0x05060d, letterSpacing: 0});
      label.style.stroke = {color: 0x05060d, width: 6, join: 'round'};
      label.anchor.set(0.5);
      node.addChild(star, label);
      node.star = star; node.label = label;
      numberLayer.addChild(node);
    }
    node.visible = true;
    node.label.text = String(Math.round(value));
    node.label.style.fill = critical ? 0xffd23f : tint;
    node.star.visible = critical;
    node.position.set(x, y);
    numbers.push({node, x, y, vx: dir * (34 + random() * 22), vy: -230 - random() * 40, age: 0, life: BATTLE_FX_JUICY.numberMs,
      base: critical ? BATTLE_FX_JUICY.criticalScale : 1});
    quartet.numbers++;
    if (critical) quartet.criticals++;
  }
  /** The 550 ms slanted move-name capsule over an ordinary skill's caster. */
  function spawnCapsule({slot, content, palette}) {
    if (!content) return;
    if (capsules.length >= 3) { const old = capsules.shift(); old.node.destroy({children: true}); }
    const node = new PIXI.Container({label: 'battle fx skill capsule'});
    const bg = new PIXI.Graphics();
    const label = makeText(content, {size: 13, fill: 0x05060d, stroke: palette.core, letterSpacing: 0});
    label.style.stroke = {color: 0xffffff, width: 2, join: 'round'};
    label.anchor.set(0.5);
    const w = label.width + 22, h = label.height + 6, skew = 6;
    bg.poly([-w / 2 + skew, -h / 2, w / 2 + skew, -h / 2, w / 2 - skew, h / 2, -w / 2 - skew, h / 2]).fill({color: palette.main}).stroke({width: 2, color: 0x05060d});
    node.addChild(bg, label);
    calloutLayer.addChild(node);
    capsules.push({node, slot, age: 0, life: BATTLE_FX_JUICY.capsuleMs});
    quartet.capsules++;
  }
  /** Support/heal: a vertical light pillar and rising geometric motes (juicy). */
  function pillar({x, groundY, height, palette}) {
    const sprite = flashPool.pop() ?? new PIXI.Sprite(textures.flash);
    sprite.texture = textures.flash; sprite.anchor.set(0.5, 1); sprite.blendMode = 'add'; sprite.tint = palette.main; sprite.visible = true;
    sprite.position.set(x, groundY);
    if (!sprite.parent) flashLayer.addChild(sprite);
    flashes.push({sprite, size: 1, life: 520, age: 0, pillar: {w: 26 / 64, h: height / 64}});
    for (let i = 0; i < (rich ? 10 : 5); i++) {
      spawnParticle({x: x + (random() - 0.5) * 22, y: groundY - random() * 8, vx: (random() - 0.5) * 10, vy: -60 - random() * 70, life: 700 + random() * 300,
        texture: i % 2 ? textures.spark : textures.dot, tint: i % 3 ? palette.main : palette.core, scale: 1.4, scaleTo: 0.4, gravity: -40, drag: 0.6, rotation: Math.PI / 2});
    }
    quartet.pillars++;
  }

  function makeText(content, {size, fill = 0xffffff, stroke = 0x101418, weight = '900', letterSpacing = 1}) {
    return new PIXI.Text({text: content, style: {fontFamily: '"Noto Sans TC","Arial Black",system-ui,sans-serif', fontSize: size,
      fontWeight: weight, fill, letterSpacing, stroke: {color: stroke, width: Math.max(3, size * 0.16), join: 'round'},
      dropShadow: {color: 0x000000, alpha: 0.45, distance: Math.max(1, size * 0.06), blur: 0, angle: Math.PI / 2}}});
  }
  function word({screenX, screenY, content, size = 18, fill = 0xffffff, life = 850, rise = 22}) {
    if (words.length >= 5) { const old = words.shift(); old.node.destroy(); }
    const node = makeText(content, {size, fill});
    node.anchor.set(0.5);
    const view = lastCtx?.viewport;
    screenY = Math.max(size + rise, screenY);
    if (view) screenX = clamp(screenX, node.width / 2 + 4, view.width - node.width / 2 - 4);
    node.position.set(screenX, screenY);
    wordLayer.addChild(node);
    words.push({node, x: screenX, y: screenY, age: 0, life, rise});
  }
  function showBanner(content, {size = 34, fill = 0xffe36a, life = 1100} = {}) {
    banner?.node.destroy();
    const node = makeText(content, {size, fill, letterSpacing: 2});
    node.anchor.set(0.5);
    wordLayer.addChild(node);
    banner = {node, age: 0, life};
  }
  function showCallout({team, name, move, tier, palette}) {
    // Let a signature move remain readable; ordinary skills cannot erase it.
    if (callout && callout.age < 650 && (callout.tier === 'ultimate' || tier !== 'ultimate')) return;
    callout?.node.destroy({children: true});
    const node = new PIXI.Container({label: 'battle fx move callout'});
    const bg = new PIXI.Graphics();
    // Only an approved move name is shown; without one the title is the tier.
    const named = Boolean(move);
    const title = makeText(named ? move : text(tier === 'ultimate' ? '絕招！' : '技能'),
      {size: tier === 'ultimate' ? 18 : 15, fill: named ? palette.core : tier === 'ultimate' ? 0xffe36a : 0xffffff});
    const owner = makeText(name, {size: 11, fill: 0xe8eef5, weight: '700', letterSpacing: 0});
    const tag = named && tier === 'ultimate' ? makeText(text('絕招！'), {size: 12, fill: 0xffe36a}) : null;
    node.addChild(bg, owner, title); if (tag) node.addChild(tag);
    callout = {node, bg, title, owner, tag, team, palette, age: 0, life: tier === 'ultimate' ? 1700 : 1250, tier};
    calloutLayer.addChild(node);
  }
  function toScreen(ctx, x, y) {
    const cam = ctx.camera;
    return cam ? {x: cam.zoom * x + cam.x, y: cam.zoom * y + cam.y} : {x, y};
  }

  // --------------------------------------------------- live effect actors (moves)
  function observe(view, ctx, dtMs) {
    const live = new Set();
    const launches = (view.nativeLifecycle?.active ?? []).filter(l => Number.isInteger(l.ownerSlot));
    for (const actor of view.nativeLifecycle?.effectActors ?? []) {
      const family = String(actor.name ?? '').replace(/^e003_/, '');
      const form = battleFxFamilyForm(family);
      if (!form || form === 'common' || form === 'support' || form === 'character' || form === 'smoke') continue;
      live.add(actor.id);
      const at = battleFxProject(actor.point, ctx.artRect, ctx.nativeScale);
      let entry = tracked.get(actor.id);
      if (!entry) {
        const owner = launches.find(l => describeMove(l.ownerSlot, l.moveId)?.bankIds.includes(actor.bankId));
        const look = owner ? describeMove(owner.ownerSlot, owner.moveId) : null;
        const vfx = owner ? vfxOf(owner.ownerSlot, owner.moveId) : null;
        const palette = vfx?.palette ?? BATTLE_FX_PALETTES[look?.palette ?? battleFxFamilyPalette(family) ?? 'neutral'] ?? BATTLE_FX_PALETTES.neutral;
        entry = {form, palette, owner: owner?.ownerSlot ?? null, tier: look?.tier ?? 'skill', points: [], ageMs: 0, origin: {x: at.x, y: at.y},
          element: vfx?.element ?? PALETTE_ELEMENT[look?.palette ?? battleFxFamilyPalette(family)] ?? 'NEUTRAL'};
        tracked.set(actor.id, entry);
        // The real launch point: where the move's own effect first appears.
        if (MOVING_FORMS.has(form)) {
          const ownerInfo = owner ? ctx.slotInfo?.(owner.ownerSlot) : null;
          element?.muzzle({x: at.x, y: at.y, angle: ownerInfo && ownerInfo.facing < 0 ? Math.PI : 0, palette, size: form === 'area' ? 34 : 22});
          spawnFlash({x: at.x, y: at.y, tint: palette.core, size: 26, life: 120});
          // The launch throws the move's own motes (or, without them, the old generic sparks).
          if (motes) motes.burst({element: entry.element, x: at.x, y: at.y, groundY: at.groundY, unit: ctx.nativeScale, weight: 'light'});
          else sparks({x: at.x, y: at.y, count: rich ? 5 : 3, palette, speed: 90, life: 260, scale: 0.8});
          if (at.heightNative < 10) dust({x: at.x, groundY: at.groundY, count: rich ? 3 : 2, spread: 6, life: 520, scale: 0.8});
        }
      }
      entry.ageMs += dtMs;
      // Only what flies trails motes: projectiles and streams. A beam or an area is already a full shape.
      if (FOLLOW_FORMS.has(form) && form !== 'beam') motes?.trail(actor.id, {element: entry.element, x: at.x, y: at.y, groundY: at.groundY, unit: ctx.nativeScale});
      entry.points.push({x: at.x, y: at.y});
      if (entry.points.length > 6) entry.points.shift();
      entry.last = at;
    }
    endings = [];
    for (const [id, entry] of tracked) {
      if (live.has(id)) continue;
      if (entry.last && MOVING_FORMS.has(entry.form)) endings.push({...entry.last, palette: entry.palette, element: entry.element, form: entry.form, tier: entry.tier, used: false});
      tracked.delete(id);
    }
    // Native impact sparks that appeared since the last view: real contact points.
    freshImpacts = [];
    const nowImpacts = new Set();
    for (const impact of view.impactEffects ?? []) {
      nowImpacts.add(impact.id);
      if (seenImpacts.has(impact.id) || !impact.point) continue;
      const p = battleFxProject([impact.point.x, impact.point.y, impact.point.z ?? 0], ctx.artRect, ctx.nativeScale);
      freshImpacts.push(p);
    }
    seenImpacts.clear();
    for (const id of nowImpacts) seenImpacts.add(id);
    if (kit) drawStandIns(view, ctx, launches);
  }

  /** The kit over live effect actors: a whole stand-in for a retired cell, a trail along an original shot. */
  function drawStandIns(view, ctx, launches) {
    // About a quarter of a fighter: a stand-in replaces one 16-32 px cell, and the camera pushes in on specials.
    const live = new Set(), size = ctx.nativeScale * 4.5;
    kitStats.size = Math.round(size);
    for (const actor of view.nativeLifecycle?.effectActors ?? []) {
      live.add(actor.id);
      const at = battleFxProject(actor.point, ctx.artRect, ctx.nativeScale);
      let entry = standIns.get(actor.id);
      if (!entry) {
        const family = String(actor.name ?? '').replace(/^e003_/, '');
        const owner = launches.find(l => describeMove(l.ownerSlot, l.moveId)?.bankIds.includes(actor.bankId));
        const vfx = owner ? vfxOf(owner.ownerSlot, owner.moveId) : null;
        const signature = owner ? signatureOf(owner.moveId) : null;
        entry = {form: battleFxFamilyForm(family), signature, alive: true, standIn: false, trail: false, cells: vfx?.cells ?? [], stages: new Set(),
          paletteKey: signature?.paletteKey ?? vfx?.paletteKey ?? battleFxFamilyPalette(family) ?? 'neutral'};
        standIns.set(actor.id, entry);
      }
      entry.at = at;
      const {form, signature, paletteKey} = entry;
      if (!form) continue;
      const follow = () => entry.alive ? entry.at : null;
      const archetype = signature?.archetype ?? 'strike';
      const shot = moveVfxArchetypeIsMelee(archetype) ? 'orb' : archetype;
      // The stage the actor plays, from the owning move's own banks: launch, body (in flight or standing) or hit.
      // One actor can step through several; each stage gets the move's own look once.
      entry.stage = entry.cells.find(c => c.bankId === actor.bankId && c.sequence === actor.sequenceId)?.role ?? null;
      const stage = entry.stage;
      if (stage && signature && romCell(actor)) {
        if (entry.stages.has(stage)) continue;
        entry.stages.add(stage); entry.standIn = true; kitStats.standIns++;
        const during = () => entry.alive && entry.stage === stage ? entry.at : null;
        if (stage === 'hit' || stage === 'extra') {
          const heavy = form === 'area' || form === 'character' || signature.tier === 'ultimate';
          // the HIT plays this move's own contact piece; the stand-in keeps only its flare and motif (pass 6)
          kit.impact({x: at.x, y: at.y, groundY: at.groundY, paletteKey, archetype, heavy, size: heavy ? size * 1.1 : size, planted: moveVfxArchetypeIsPlanted(archetype),
            piece: Boolean(owner && moveVfxChoreography(owner.moveId)?.contact)});
        } else if (stage === 'body' || form === 'projectile' || form === 'stream' || form === 'beam') {
          // A body that lands and stands (a mushroom, a bomb) is drawn planted where the battle put it.
          kit.projectile({follow: during, paletteKey, archetype: shot, size, signature, planted: stage === 'body' && moveVfxArchetypeIsPlanted(archetype)});
        } else kit.launch({x: at.x, y: at.y, paletteKey, archetype, size, signature});
        continue;
      }
      if (!entry.standIn && romCell(actor)) {
        entry.standIn = true; kitStats.standIns++;
        if (form === 'projectile' || form === 'stream' || form === 'beam') {
          kit.projectile({follow, paletteKey, archetype: shot, size, signature});
        } else if (form === 'smoke') {
          kit.puff({x: at.x, y: at.y, paletteKey: entry.signature ? paletteKey : 'dark', size});
        } else if (form === 'support') {
          kit.glint({x: at.x, y: at.y, paletteKey, size: size * 0.8});
        } else {
          // A hit mark, an area or a summoned figure: the move's own impact where the cell stood.
          const heavy = form === 'area' || form === 'character';
          kit.impact({x: at.x, y: at.y, groundY: at.groundY, paletteKey, archetype, heavy, size: heavy ? size * 1.1 : size});
        }
      } else if (!entry.trail && !entry.standIn && signature && signature.trail !== 'none' && (form === 'projectile' || form === 'stream' || form === 'beam')) {
        entry.trail = true; kitStats.trails++;
        kit.projectile({follow, paletteKey, archetype, size, signature, headless: true});
      }
    }
    for (const [id, entry] of standIns) if (!live.has(id)) { entry.alive = false; standIns.delete(id); }
  }

  /** A projectile that ended without a hit near it: it bursts where it stopped. */
  function settleEndings() {
    for (const end of endings) {
      if (end.used) continue;
      const near = end.heightNative < 18;
      spawnFlash({x: end.x, y: end.y, tint: end.palette.core, size: 30, life: 140});
      // A shot that ends without a hit throws a few of its element's motes (SPECIAL_HEX_DECLUTTER_20261111): a volley
      // of five used to throw forty generic sparks at once, the cyan cluster over every special.
      if (motes) motes.burst({element: end.element ?? 'NEUTRAL', x: end.x, y: end.y, groundY: end.groundY, unit: lastCtx?.nativeScale ?? 1, weight: 'light'});
      else sparks({x: end.x, y: end.y, count: rich ? 8 : 4, palette: end.palette, speed: 120, life: 300, groundY: end.groundY});
      if (near) {
        spawnRing({x: end.x, groundY: end.groundY, radius: 16, tint: end.palette.main, life: 300});
        dust({x: end.x, groundY: end.groundY, count: rich ? 4 : 2, spread: 8});
        if (end.form === 'area' || end.tier === 'ultimate') {
          debris({x: end.x, y: end.groundY, groundY: end.groundY, count: rich ? 8 : 4, palette: end.palette, power: 0.8});
          spawnScorch({x: end.x, groundY: end.groundY, size: 34});
        }
      }
    }
    endings = [];
  }

  // ------------------------------------------------------------------- events
  function handle(events, ctx) {
    const slot = s => ctx.slotInfo?.(s) ?? null;
    for (const event of events) {
      eventsHandled++;
      if (event.type === 'START') { if(!ctx.opening?.armed)showBanner(text('對戰開始！'), {size: 34, fill: 0xffffff, life: 1000}); continue; }
      if (event.type === 'LAUNCH') {
        const info = slot(event.slot), look = describeMove(event.slot, event.moveId);
        const vfx = vfxOf(event.slot, event.moveId);
        // A record that names no bank still leaves the hand on an original cell.
        if (info && vfx?.fallback && !vfx.melee) {
          const launchCell = vfx.cells.find(c => c.role === 'launch' || c.role === 'prepare');
          if (launchCell) element?.cell({...launchCell, ...muzzleOf(info), scale: ctx.nativeScale, flip: info.facing < 0, hue: vfx.cellHue});
        }
        const choreo = moveVfxChoreography(event.moveId);
        if (info && choreo?.release && setPieces) {
          const releasePalette = vfx?.palette ?? BATTLE_FX_PALETTES[look?.palette] ?? BATTLE_FX_PALETTES.neutral;
          setPieces.play(choreo.release.piece, {...muzzleOf(info), angle: info.facing < 0 ? Math.PI : 0, palette: releasePalette,
            size: info.width, unit: ctx.nativeScale, groundY: info.groundY, scale: choreo.release.scale ?? 1, sprite: choreo.release.sprite});
        }
        if (!info || !look || look.tier === 'basic' || look.tier === 'support') continue;
        const palette = vfx?.palette ?? BATTLE_FX_PALETTES[look.palette] ?? BATTLE_FX_PALETTES.neutral;
        // Charge at the release point: an element orb with four glints spiralling in.
        if (!reducedMotion) element?.charge({...muzzleOf(info), palette, ms: juicy ? BATTLE_FX_JUICY.windupMs + 60 : 200,
          size: info.width * (look.tier === 'ultimate' ? 0.55 : 0.4), follow: () => { const now = slot(event.slot); return now ? muzzleOf(now) : null; }});
        // The move's own sigil opens on the ground under the caster.
        const signature = signatureOf(event.moveId);
        if (kit && signature) {
          // Sized to the fighter: the battle camera pushes in close, so a sigil wider than a body fills the screen.
          kit.sigil({x: info.x, y: info.groundY, paletteKey: signature.paletteKey, signature, size: info.width * 0.28, ms: look.tier === 'ultimate' ? 700 : 420,
            follow: () => { const now = slot(event.slot); return now ? {x: now.x, y: now.groundY} : null; }});
          kitStats.sigils++;
        }
        // Power gathered at the attacker's feet: a ground ring and kicked-up dust.
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.75, tint: palette.main, life: 420});
        dust({x: info.x, groundY: info.groundY, count: rich ? 5 : 3, spread: info.width * 0.4});
        if (juicy) {
          // Wind-up: squash and a glint on the caster; melee dashes leave
          // afterimages in the move's colour. Specials hand their title to the
          // DOM cut-in strip; ordinary skills get the capsule over the head.
          const caster = fxFor(event.slot);
          caster.charge = 1;
          caster.flash = Math.max(caster.flash, 0.35); caster.flashTint = palette.core;
          if (look.form === 'melee') { caster.dashTint = palette.main; caster.dashMs = 700; }
          spawnFlash({x: info.x, y: info.top + info.height * 0.4, tint: palette.core, size: info.width * 0.9, life: 160});
          quartet.windups++;
          if (look.tier === 'ultimate') {
            spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 1.2, tint: palette.core, life: 420, width: 3.5, implode: true});
            quartet.implodes++;
          } else spawnCapsule({slot: event.slot, content: moveNameOf(event.moveId, look) || text('技能'), palette});
        } else showCallout({team: info.team, name: nameOfSlot(event.slot), move: moveNameOf(event.moveId, look), tier: look.tier, palette});
        const director = ctx.camera?.director;
        if (look.tier === 'ultimate') {
          // The signature backdrop: a ~0.53 s element storm behind the fighters.
          const foe = ctx.opponentsOf(event.slot).map(s => slot(s)).find(Boolean);
          element?.storm({kind: vfx?.storm ?? 'burst', palette, paletteKey: vfx?.paletteKey ?? look.palette, rect: ctx.artRect,
            center: foe ? {x: (info.x + foe.x) / 2, y: (info.groundY + foe.groundY) / 2 - info.height * 0.4} : {x: info.x, y: info.groundY}});
          if (vfx?.weather) cue({type: 'WEATHER', system: vfx.weather, slot: event.slot, x: info.x, y: info.groundY, element: vfx.element});
          spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 1.3, tint: palette.core, life: 560, delay: 140});
          spawnScorch({x: info.x, groundY: info.groundY, size: info.width * 0.9, life: 2200});
          debris({x: info.x, y: info.groundY, groundY: info.groundY, count: rich ? 6 : 3, palette, power: 0.6});
          dim = juicy ? {focus: new Set([event.slot]), age: 0, life: BATTLE_FX_JUICY.dimMs, strength: BATTLE_FX_JUICY.dimStrength}
            : {focus: new Set([event.slot]), age: 0, life: 1150, strength: 0.45};
          speed = reducedMotion ? 0 : 1;
          // Push in on the attacker, then pull out to show the whole path.
          director?.sequence([{slots: [event.slot], durationMs: 650, boost: 0.38}, {slots: [event.slot, ...ctx.opponentsOf(event.slot)], durationMs: 1100, boost: -0.05}]);
          { const s = toScreen(ctx, info.x, info.top + info.height * 0.5); hitFeel?.rush(s.x, s.y); }
          director?.shake(0.18);
        } else {
          director?.sequence([{slots: [event.slot, ...ctx.opponentsOf(event.slot)], durationMs: 900, boost: 0.14}]);
        }
        continue;
      }
      if (event.type === 'HIT') {
        const target = slot(event.slot);
        if (!target) continue;
        const attacker = event.attackerSlot !== null ? slot(event.attackerSlot) : null;
        const look = event.moveId !== null ? describeMove(event.attackerSlot, event.moveId) : null;
        const vfx = event.moveId !== null ? vfxOf(event.attackerSlot, event.moveId) : null;
        const palette = vfx?.palette ?? BATTLE_FX_PALETTES[look?.palette] ?? BATTLE_FX_PALETTES.neutral;
        // A native screen flash has no target/critical attribution. Only an
        // explicitly attributed HIT may label itself critical.
        const choreo = moveVfxChoreography(event.moveId);
        const critical = event.critical === true;
        const tier = battleFxHitTier({ratio: event.ratio, ultimate: look?.tier === 'ultimate', critical});
        const hit = battleFxHitPoint({target, impacts: freshImpacts, endings: endings.filter(e => !e.used), attacker});
        anchors[hit.source]++;
        for (const end of endings) if (Math.abs(end.x - hit.x) < 1 && Math.abs(end.y - hit.y) < 1) end.used = true;
        const fx = fxFor(event.slot);
        fx.flash = 1; fx.squash = tier === 'heavy' ? 1 : tier === 'medium' ? 0.7 : 0.4;
        fx.knock = tier === 'heavy' ? 1 : 0.6; fx.knockDir = attacker ? Math.sign(target.x - attacker.x) || -target.facing : -target.facing;
        if (juicy) {
          // White first, then the move's element on the rim; the knock follows the hit.
          fx.flashTint = palette.main; fx.knock = 1; fx.knockPx = choreo?.knockPx ?? BATTLE_FX_JUICY.knockPx[tier];
          // Contact: a saturated halo under a white-hot core (additive), readable on dark and pale floors.
          spawnFlash({x: hit.x, y: hit.y, tint: palette.main, size: (tier === 'heavy' ? 46 : 30) * 1.9, life: tier === 'heavy' ? 210 : 150});
          const holdMs = choreo?.hitStopMs ?? BATTLE_FX_JUICY.hitStopByTier[critical || look?.tier === 'ultimate' ? (tier === 'light' ? 'medium' : 'ultimate') : tier] ?? 0;
          if (holdMs > 0 && !reducedMotion) {
            hitStop = {ms: holdMs, slots: new Set([event.slot, event.attackerSlot].filter(s => s !== null && s !== undefined))};
            element?.hold(holdMs);
            quartet.hitStops++;
          }
          const p = toScreen(ctx, hit.x, target.top);
          spawnNumber({x: p.x, y: p.y, value: event.damage, critical, dir: fx.knockDir || 1,
            tint: target.team === ctx.localTeam ? 0xffd0c8 : 0xffffff});
          // Knockback slide: dust kicks up behind the struck feet along the blow.
          dust({x: target.x, groundY: target.groundY, count: rich ? 4 : 2, spread: target.width * 0.3, push: fx.knockDir, life: 520, scale: 0.9});
        }
        // Original cells drawn by this layer: a fallback record's own hit set, the
        // element accent on a bank-less melee hit, and the struck body's overlay.
        if (vfx) {
          const cellAt = {x: hit.x, y: hit.y, scale: ctx.nativeScale, flip: (fx.knockDir || 1) < 0, hue: vfx.cellHue};
          if (vfx.fallback) { const hitCell = vfx.cells.find(c => c.role === 'hit'); if (hitCell) element?.cell({...hitCell, ...cellAt}); }
          if (vfx.accent) element?.cell({...vfx.accent, ...cellAt, hue: 0});
          if (vfx.overlay && tier !== 'light') element?.cell({...vfx.overlay, scale: ctx.nativeScale * 0.85, repeatMs: tier === 'heavy' ? 1000 : 640, overlay: true,
            follow: () => { const now = slot(event.slot); return now && !now.down ? {x: now.x, y: now.top + now.height * 0.45} : null; }});
          if (tier !== 'light' || look?.tier === 'ultimate') element?.decal({x: hit.x, y: hit.groundY, kind: vfx.decal, palette, paletteKey: vfx.paletteKey,
            size: target.width * (tier === 'heavy' ? 1.3 : 0.9), scale: ctx.nativeScale});
        }
        // The move's own closing burst (and a signature move's ground sigil) at the contact.
        const signature = signatureOf(event.moveId);
        if (kit && signature) {
          kit.burst({x: hit.x, y: hit.y, groundY: hit.groundY, angle: attacker ? Math.atan2(target.groundY - attacker.groundY, target.x - attacker.x) : 0,
            paletteKey: signature.paletteKey, signature, size: target.width * (tier === 'light' ? 0.18 : 0.24), heavy: tier === 'heavy'});
          kitStats.bursts++;
        }
        // One kind of particle at the contact (MOVE_VFX_QUALITY_20261110, Owner: 「很雜亂」): the element's motes,
        // sized by the blow, replace the old generic sparks; a run of light hits on one target shows its burst once.
        const weight = critical || look?.tier === 'ultimate' ? (tier === 'light' ? 'medium' : 'ultimate') : tier;
        motes?.burst({element: vfx?.element ?? 'NEUTRAL', x: hit.x, y: hit.y, groundY: hit.groundY, unit: ctx.nativeScale, weight, dir: fx.knockDir || 0});
        // An ultimate opens its contact with an impact frame: the blow's star in white, held by the hit-stop.
        if ((choreo?.impactFrame || critical) && setPieces) setPieces.play('impact-frame', {x: hit.x, y: hit.y,
          angle: attacker ? Math.atan2(target.groundY - attacker.groundY, target.x - attacker.x) : 0,
          palette: {core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true}, size: target.width, unit: ctx.nativeScale, groundY: hit.groundY, scale: choreo?.contact?.scale ?? 1});
        if (choreo?.contact && setPieces) setPieces.play(choreo.contact.piece, {x: hit.x, y: hit.y,
          angle: attacker ? Math.atan2(target.groundY - attacker.groundY, target.x - attacker.x) : 0, palette, size: target.width,
          unit: ctx.nativeScale, groundY: hit.groundY, scale: choreo.contact.scale ?? 1, fast: choreo.contact.fast, sprite: choreo.contact.sprite, at: 'contact'});
        const lastBurst = burstAt.get(event.slot) ?? -Infinity;
        if (tier !== 'light' || elapsed - lastBurst > 220) {
          pixelHits?.spawn({element: vfx?.element ?? 'NEUTRAL', x: hit.x, y: hit.y, groundY: hit.groundY, size: target.width * (tier === 'light' ? 0.8 : 1),
            unit: ctx.nativeScale, heavy: tier === 'heavy', flip: (fx.knockDir || 1) < 0});
          burstAt.set(event.slot, elapsed);
        }
        if (critical) cue({type: 'CRIT', system: CRITICAL_VFX_SYSTEM, slot: event.slot, x: target.x, y: target.groundY});
        if (critical) hitFeel?.split();
        // At the contact point: a flash and sparks that fall to the target's ground.
        spawnFlash({x: hit.x, y: hit.y, tint: palette.core, size: tier === 'heavy' ? 46 : 30, life: tier === 'heavy' ? 170 : 120});
        if (!motes) sparks({x: hit.x, y: hit.y, count: tier === 'heavy' ? (rich ? 22 : 10) : tier === 'medium' ? (rich ? 12 : 6) : 6, palette,
          speed: tier === 'heavy' ? 210 : 150, groundY: hit.groundY, scale: tier === 'heavy' ? 1.2 : 1});
        // On the ground beneath it: the shock ring, dust and, for heavy hits, debris and scorch.
        if (tier !== 'light') {
          spawnRing({x: hit.x, groundY: hit.groundY, radius: target.width * (tier === 'heavy' ? 1.4 : 0.9), tint: palette.main, life: 360});
          dust({x: hit.x, groundY: hit.groundY, count: tier === 'heavy' ? (rich ? 7 : 4) : (rich ? 3 : 2), spread: target.width * 0.5, push: fx.knockDir});
        }
        const director = ctx.camera?.director;
        if (tier === 'heavy') {
          spawnRing({x: hit.x, groundY: hit.groundY, radius: target.width * 0.8, tint: palette.core, life: 280, delay: 60});
          debris({x: hit.x, y: hit.groundY, groundY: hit.groundY, count: rich ? 10 : 5, palette});
          if (!vfx) spawnScorch({x: hit.x, groundY: hit.groundY, size: target.width * 1.1});
          director?.impact(choreo?.shake ?? 'heavy', fx.knockDir);
          { const s = toScreen(ctx, hit.x, hit.y); hitFeel?.shock(s.x, s.y, {reach: target.width * (ctx.camera?.zoom ?? 1) * 1.8}); }
          // A signature hit pushes the lens toward the contact (1.22x, 260 ms).
          if (look?.tier === 'ultimate') { director?.lens?.({x: hit.x, y: hit.y, amount: 0.22, ms: 260}); director?.slowMo?.(BATTLE_FX_JUICY.slowMoMs); }
          screenFlash = Math.max(screenFlash, 0.18);
        } else if (tier === 'medium') { director?.impact(choreo?.shake ?? 'medium', fx.knockDir); }
        else if (choreo?.shake && choreo.shake !== 'light') director?.impact(choreo.shake, fx.knockDir);
        // Light hits keep local sparks/squash, leaving the camera readable.
        const p = toScreen(ctx, hit.x, hit.y);
        if (critical) word({screenX: p.x, screenY: p.y - 14, content: text('會心一擊！'), size: 20, fill: 0xffe36a});
        else if (tier === 'heavy') word({screenX: p.x, screenY: p.y - 14, content: text('重擊！'), size: 20, fill: palette.core});
        else if (tier === 'medium') word({screenX: p.x, screenY: p.y - 10, content: text('命中！'), size: 14, fill: 0xffffff, life: 600, rise: 16});
        continue;
      }
      if (event.type === 'LANDED') { land(event.slot, ctx, 1); continue; }
      if (event.type === 'STEP') { footstep(event.slot, ctx, event.direction ?? 0); continue; }
      if (event.type === 'HEAL' || event.type === 'SUPPORT') {
        const info = slot(event.slot);
        if (!info) continue;
        if (event.type === 'SUPPORT') cue({type: 'BUFF', system: supportVfxSystem(event.statusCode), slot: event.slot, x: info.x, y: info.groundY});
        // Batch 7: the support move's own cast on the body that receives it.
        const support = event.type === 'SUPPORT' && typeof moveVfxSupportChoreography === 'function' ? moveVfxSupportChoreography(event.statusCode) : null;
        if (support && setPieces) setPieces.play(support.piece, {x: info.x, y: info.top + info.height * 0.5, angle: info.facing < 0 ? Math.PI : 0,
          palette: BATTLE_FX_PALETTES[support.palette] ?? BATTLE_FX_PALETTES.light, size: info.width, unit: ctx.nativeScale, groundY: info.groundY, scale: support.scale});
        const palette = event.type === 'HEAL' ? BATTLE_FX_PALETTES.nature : BATTLE_FX_PALETTES.light;
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.9, tint: palette.main, life: 560});
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.6, tint: palette.core, life: 480, delay: 120});
        if (juicy) pillar({x: info.x, groundY: info.groundY, height: info.height * 1.6 + 24, palette});
        if (event.type === 'HEAL') {
          const p = toScreen(ctx, info.x, info.top);
          word({screenX: p.x, screenY: p.y - 6, content: juicy ? `▲ ${text('回復')}` : text('回復'), size: 15, fill: 0x9cff7a, life: 800});
        } else if (juicy) {
          const p = toScreen(ctx, info.x, info.top);
          word({screenX: p.x, screenY: p.y - 6, content: '▲', size: 18, fill: palette.main, life: 700});
        }
        continue;
      }
      if (event.type === 'STATUS') {
        const info = slot(event.slot);
        if (info) spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.7, tint: BATTLE_FX_PALETTES.dark.main, life: 420});
        continue;
      }
      if (event.type === 'KO') {
        const info = slot(event.slot);
        if (!info) continue;
        // The fall: a dust burst, two rings, debris and scorch where it lands.
        dust({x: info.x, groundY: info.groundY, count: rich ? 10 : 5, spread: info.width * 0.7, scale: 1.3, life: 900});
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 1.8, tint: 0xffffff, life: 520});
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 1.1, tint: BATTLE_FX_PALETTES.light.edge, life: 420, delay: 90});
        debris({x: info.x, y: info.groundY, groundY: info.groundY, count: rich ? 12 : 6, palette: BATTLE_FX_PALETTES.earth, power: 1.1});
        spawnScorch({x: info.x, groundY: info.groundY, size: info.width * 1.4, life: 3200});
        // Hold on the knockout, then pull back out to the remaining fighters.
        ctx.camera?.director?.sequence([{slots: [event.slot], durationMs: 1200, boost: 0.3, includeDown: true}, {slots: null, durationMs: 900, boost: -0.08}]);
        ctx.camera?.director?.shake(0.6);
        screenFlash = Math.max(screenFlash, 0.45);
        if (event.teamDown) { showBanner('K.O.!', {size: 44, fill: 0xffe36a, life: 1500}); ctx.camera?.director?.slowMo?.(BATTLE_FX_JUICY.slowMoMs); }
        else { const p = toScreen(ctx, info.x, info.top); word({screenX: p.x, screenY: p.y - 8, content: text('倒下！'), size: 20, fill: 0xffb4a0}); }
      }
    }
  }

  /** Landing on the arena: a dust ring at the feet. */
  function land(slot, ctx, strength = 1) {
    const info = ctx.slotInfo?.(slot);
    // The native landing record and the scene's own height check can both
    // report one landing; one dust ring per fighter per quarter second.
    if (!info || elapsed - (landedAt.get(slot) ?? -1e9) < 250) return;
    landedAt.set(slot, elapsed);
    // Dust only: a grey stroked ring read as a flat disc on pale sand (Owner 2026-11-03).
    dust({x: info.x, groundY: info.groundY, count: Math.round((rich ? 7 : 3) * strength), spread: info.width * 0.6, scale: 1.15});
  }
  /** Running or being driven across the ground: a puff behind the feet. */
  function footstep(slot, ctx, direction = 0) {
    const info = ctx.slotInfo?.(slot);
    if (!info) return;
    dust({x: info.x - direction * info.width * 0.3, groundY: info.groundY, count: rich ? 2 : 1, spread: 4, life: 480, scale: 0.8, push: -direction * 0.4});
  }

  function drawStreaks() {
    trailGfx.clear();
    for (const entry of tracked.values()) {
      // The beam itself is the record's own cells; no drawn line joins it to the caster (Owner 2026-11-05).
      if (entry.form !== 'projectile' && entry.form !== 'stream') continue;
      // A pixel trail: stepped squares on the native pixel grid, shrinking and fading behind the shot.
      const pts = entry.points, unit = Math.max(2, Math.round(lastCtx?.nativeScale ?? 2));
      for (let i = 1; i < pts.length; i++) {
        const t = i / (pts.length - 1), size = unit * Math.max(1, Math.round((juicy ? 3 : 2) * t));
        const x = Math.round(pts[i].x / unit) * unit - size / 2, y = Math.round(pts[i].y / unit) * unit - size / 2;
        trailGfx.rect(x, y, size, size).fill({color: entry.palette.main, alpha: (juicy ? 0.55 : 0.4) * t});
        if (juicy && t > 0.5) trailGfx.rect(x + size / 4, y + size / 4, size / 2, size / 2).fill({color: 0xffffff, alpha: 0.7 * t});
      }
    }
  }

  /** The special prelude's ring, split in depth round the caster. */
  function drawHyperWrap(view, ctx, dtMs) {
    hyperBack.clear(); hyperFront.clear();
    const focus = view.specialPrelude;
    if (!focus?.hyperVisible) { hyper = null; return; }
    const info = ctx.slotInfo?.(focus.slot);
    if (!info) return;
    if (!hyper || hyper.slot !== focus.slot) hyper = {slot: focus.slot, age: 0};
    hyper.age += dtMs;
    const grow = reducedMotion ? 1 : easeOut(clamp(hyper.age / 220, 0, 1));
    const rx = Math.max(20, info.width * 0.68) * (0.6 + 0.4 * grow), ry = rx * 0.34;
    const height = (info.height * 0.9 + 12) * grow, x = info.x, y = info.groundY;
    const spin = reducedMotion ? 0 : hyper.age / 520;
    const gold = 0xffd23f, cyan = 0x7ff6ff, white = 0xffffff;
    // The ground circle: the far arc behind, the near arc in front.
    hyperBack.ellipse(x, y, rx * 1.12, ry * 1.12).fill({color: gold, alpha: 0.12});
    for (const [g, from, to] of [[hyperBack, Math.PI, TAU], [hyperFront, 0, Math.PI]]) {
      for (const [k, width, color, alpha] of [[1, 4, gold, 0.85], [0.78, 1.5, white, 0.7]]) {
        g.moveTo(x + Math.cos(from) * rx * k, y + Math.sin(from) * ry * k);
        for (let i = 1; i <= 24; i++) { const a = from + (to - from) * i / 24; g.lineTo(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k); }
        g.stroke({width, color, alpha});
      }
    }
    // The crown: rising light streaks on the rim, far ones behind the body.
    for (const streak of battleHyperWrapStreaks({phase: spin})) {
      const g = streak.back ? hyperBack : hyperFront;
      const sx = x + Math.cos(streak.angle) * rx, sy = y + Math.sin(streak.angle) * ry;
      const top = sy - height * streak.lift * (0.8 + 0.2 * Math.sin(hyper.age / 90 + streak.angle * 3));
      const alpha = streak.back ? 0.75 : 0.45;
      g.moveTo(sx, sy).lineTo(sx, top).stroke({width: 5, color: cyan, alpha: alpha * 0.45, cap: 'round'});
      g.moveTo(sx, sy).lineTo(sx, top).stroke({width: 1.6, color: white, alpha, cap: 'round'});
    }
  }

  // -------------------------------------------------------------------- update
  /** Observe the view, handle its events, settle unmatched endings, simulate. */
  function update(view, ctx, dtMs, events = []) {
    lastCtx = ctx;
    elapsed += dtMs;
    observe(view, ctx, dtMs);
    handle(events, ctx);
    settleEndings();
    drawStreaks();
    // Hit-stop (juicy): the dressing holds for 60 ms; the battle keeps stepping
    // underneath and the scene holds the two fighters' drawn frames.
    const realMs = dtMs;
    element?.update(dtMs);
    kit?.update(hitStop ? 0 : dtMs);
    pixelHits?.update(hitStop ? 0 : dtMs);
    motes?.update(hitStop ? 0 : dtMs);
    setPieces?.update(hitStop ? 0 : dtMs);
    if (hitStop) dtMs = 0;
    const dt = dtMs / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dtMs;
      if (p.age >= p.life) { p.sprite.visible = false; particlePool.push(p.sprite); particles.splice(i, 1); continue; }
      const k = p.age / p.life, damp = Math.max(0, 1 - p.drag * dt);
      if (!p.rested) {
        p.vx *= damp; p.vy = p.vy * damp + p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.groundY !== null && p.y >= p.groundY && p.vy > 0) {
          p.y = p.groundY; p.vy = -p.vy * p.bounce; p.vx *= 0.55; p.spin *= 0.5;
          if (Math.abs(p.vy) < 24) { p.vy = 0; p.rested = true; }
        }
      }
      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set(lerp(p.scale, p.scaleTo, k));
      p.sprite.alpha = p.alpha * (p.rested ? 1 - k * k : 1 - k * k * k);
      if (p.align) p.sprite.rotation = Math.atan2(p.vy, p.vx); else if (!p.rested) p.sprite.rotation += p.spin * dt;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.age += dtMs;
      if (f.age >= f.life) { f.sprite.visible = false; flashPool.push(f.sprite); flashes.splice(i, 1); continue; }
      const k = f.age / f.life;
      if (f.pillar) {
        f.sprite.scale.set(f.pillar.w * (1 - 0.5 * k), f.pillar.h * easeOut(Math.min(1, k * 2.5)));
        f.sprite.alpha = 0.85 * (1 - k * k);
        continue;
      }
      f.sprite.scale.set(f.size * (0.7 + 0.5 * easeOut(k)) / 64);
      f.sprite.alpha = 1 - k;
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i];
      g.age += dtMs;
      if (g.age >= g.life) { g.sprite.visible = false; ghostPool.push(g.sprite); ghosts.splice(i, 1); continue; }
      g.sprite.alpha = g.alpha * (1 - g.age / g.life);
    }
    groundGfx.clear();
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.age += dtMs;
      if (r.age >= r.life) { rings.splice(i, 1); continue; }
      if (r.age < 0) continue;
      const k = easeOut(r.age / r.life), radius = r.implode ? r.radius * (1.7 - 1.45 * k) : r.radius * (0.2 + k);
      const fade = r.alpha * (r.implode ? 0.4 + 0.6 * (1 - k) : 1 - k);
      // Owner 2026-11-03: a lit shock wave on the floor -- a soft pool, a wide
      // coloured band and a white-hot rim -- never a lone grey stroke.
      groundGfx.ellipse(r.x, r.y, radius, radius * 0.34).fill({color: r.tint, alpha: 0.16 * fade});
      groundGfx.ellipse(r.x, r.y, radius, radius * 0.34).stroke({width: r.width * 3 * (1 - k * 0.5), color: r.tint, alpha: 0.35 * fade});
      groundGfx.ellipse(r.x, r.y, radius, radius * 0.34).stroke({width: Math.max(1, r.width * 0.8 * (1 - k * 0.6)), color: mixColor(r.tint, 0xffffff, 0.65), alpha: fade});
    }
    // Team rings at each fighter's feet were removed (Owner 2026-11-09: 「就不能給他們個影子就好了嗎？」): each fighter
    // stands on its own ground shadow only (battleGroundShadows), and the cards above and below say which side it is.
    drawHyperWrap(view, ctx, realMs);
    for (let i = scorches.length - 1; i >= 0; i--) {
      const s = scorches[i];
      s.age += dtMs;
      if (s.age >= s.life) { s.sprite.destroy(); scorches.splice(i, 1); continue; }
      s.sprite.alpha = s.age > s.life - 1200 ? (s.life - s.age) / 1200 : Math.min(1, s.age / 60);
    }
    for (const fx of actorFx.values()) {
      fx.flash = Math.max(0, fx.flash - dtMs / 120);
      fx.squash = Math.max(0, fx.squash - dtMs / 180);
      fx.knock = Math.max(0, fx.knock - dtMs / BATTLE_FX_JUICY.knockMs);
      fx.charge = Math.max(0, fx.charge - dtMs / BATTLE_FX_JUICY.windupMs);
      fx.dashMs = Math.max(0, fx.dashMs - dtMs);
      if (fx.flash === 0) fx.flashTint = 0xffffff;
    }
    if (dim) { dim.age += dtMs; if (dim.age >= dim.life) dim = null; }
    speed = Math.max(0, speed - dtMs / 700);
    screenFlash = Math.max(0, screenFlash - dtMs / 160);
    if (hitStop) { hitStop.ms -= realMs; if (hitStop.ms <= 0) hitStop = null; }
  }

  /** Screen-space dressing after the camera is known. */
  function updateScreen({viewport, view, ctx, dtMs}) {
    lastCtx = ctx;
    if (juicy) {
      const stepMs = hitStop ? 0 : dtMs, dt = stepMs / 1000;
      for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.age += stepMs;
        if (n.age >= n.life) { n.node.visible = false; numberPool.push(n.node); numbers.splice(i, 1); continue; }
        n.vy += 640 * dt; n.x += n.vx * dt; n.y += n.vy * dt;
        const k = n.age / n.life, pop = reducedMotion ? 1 : n.age < 110 ? lerp(1.7, 1, n.age / 110) : 1;
        n.node.position.set(clamp(n.x, 18, viewport.width - 18), clamp(reducedMotion ? n.y - n.age * 0.03 : n.y, 18, viewport.height - 12));
        n.node.scale.set(n.base * pop);
        n.node.alpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        if (n.node.star.visible) n.node.star.rotation += dt * 2.4;
      }
      for (let i = capsules.length - 1; i >= 0; i--) {
        const c = capsules[i];
        c.age += stepMs;
        const info = ctx.slotInfo?.(c.slot);
        if (c.age >= c.life || !info) { c.node.destroy({children: true}); capsules.splice(i, 1); continue; }
        const p = toScreen(ctx, info.x, info.top), k = c.age / c.life;
        const halfW = c.node.width / 2 + 4;
        c.node.position.set(clamp(p.x, halfW, Math.max(halfW, viewport.width - halfW)), Math.max(16, p.y - 16 - (reducedMotion ? 0 : 10 * easeOut(k))));
        c.node.scale.set(reducedMotion ? 1 : c.age < 90 ? lerp(0.6, 1.08, c.age / 90) : c.age < 140 ? lerp(1.08, 1, (c.age - 90) / 50) : 1);
        c.node.alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      }
    }
    barGfx.clear();
    for (const combatant of view.combatants) {
      if (!combatant.present) continue;
      const info = ctx.slotInfo?.(combatant.slot);
      let bar = bars.get(combatant.slot);
      const ratio = clamp(combatant.hp?.ratio ?? 0, 0, 1);
      if (!bar) { bar = {ghost: ratio, holdMs: 0, last: ratio}; bars.set(combatant.slot, bar); }
      if (ratio < bar.last) bar.holdMs = 420;
      bar.last = ratio;
      bar.holdMs = Math.max(0, bar.holdMs - dtMs);
      if (bar.holdMs === 0) bar.ghost = Math.max(ratio, bar.ghost - dtMs / 900);
      if (bar.ghost < ratio) bar.ghost = ratio;
      if (!info || combatant.down) continue;
      const p = toScreen(ctx, info.x, info.top);
      const width = clamp(info.width * (ctx.camera?.zoom ?? 1) * 0.8, 28, 54), height = 4;
      const x = clamp(p.x - width / 2, 4, viewport.width - width - 4), y = responsiveLayout ? clamp(p.y - 10, 4, Math.max(4, viewport.height - height - 4)) : Math.max(4, p.y - 10);
      const color = combatant.team === ctx.localTeam ? 0x45e0a8 : 0xff8a5c;
      barGfx.rect(x - 1, y - 1, width + 2, height + 2).fill({color: 0x0a0e12, alpha: 0.75});
      barGfx.rect(x, y, width * bar.ghost, height).fill({color: 0xfff4d6, alpha: 0.9});
      barGfx.rect(x, y, width * ratio, height).fill({color, alpha: 1});
    }
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      w.age += dtMs;
      if (w.age >= w.life) { w.node.destroy(); words.splice(i, 1); continue; }
      const k = w.age / w.life, pop = w.age < 110 ? lerp(1.6, 1, w.age / 110) : 1;
      w.node.scale.set(reducedMotion ? 1 : pop);
      if (responsiveLayout) {
        w.node.style.wordWrap = true;
        w.node.style.breakWords = true;
        w.node.style.wordWrapWidth = Math.max(24, (viewport.width - 16) / pop);
      }
      const halfW = w.node.width / 2 + 4, halfH = w.node.height / 2 + 4;
      w.node.position.set(responsiveLayout ? clamp(w.x, halfW, Math.max(halfW, viewport.width - halfW)) : w.x,
        responsiveLayout ? clamp(w.y - (reducedMotion ? 0 : w.rise * easeOut(k)), halfH, Math.max(halfH, viewport.height - halfH))
          : w.y - (reducedMotion ? 0 : w.rise * easeOut(k)));
      w.node.alpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
    const cue=view.opening?.cue;
    if(cue){
      const copy=battleOpeningText(cue);
      if(!banner?.opening || banner.node.text!==copy){
        // FIGHT slams in bigger and gold, with one burst of radial speed lines.
        const fight=cue==='FIGHT';
        showBanner(copy,{size:fight?46:34,fill:fight?0xffe36a:0xffffff,life:Infinity});banner.opening=true;banner.slam=fight;
        if(fight&&!reducedMotion)speed=1;
      }
    }else if(banner?.opening){banner.node.destroy();banner=null;}
    if (banner) {
      banner.age += dtMs;
      if (banner.age >= banner.life) { banner.node.destroy(); banner = null; }
      else {
        // The slam overshoots: 2.2 -> 0.9 -> 1 (a heavy metal hit); other banners pop 2.1 -> 1.
        const k = banner.age / banner.life, pop = banner.slam
          ? (banner.age < 150 ? lerp(2.2, 0.9, easeOut(banner.age / 150)) : banner.age < 330 ? lerp(0.9, 1, easeOut((banner.age - 150) / 180)) : 1)
          : banner.age < 140 ? lerp(2.1, 1, easeOut(banner.age / 140)) : 1;
        if (responsiveLayout) {
          banner.node.style.wordWrap = true; banner.node.style.breakWords = true;
          banner.node.style.wordWrapWidth = Math.max(24, (viewport.width - 16) / (reducedMotion ? 1 : pop));
        }
        banner.node.position.set(viewport.width / 2, viewport.height * 0.42);
        banner.node.scale.set(reducedMotion ? 1 : pop);
        banner.node.alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      }
    }
    if (callout) {
      callout.age += dtMs;
      if (callout.age >= callout.life) { callout.node.destroy({children: true}); callout = null; }
      else {
        const {node, bg, title, owner, tag, palette} = callout;
        if (responsiveLayout) {
          for (const label of [title, owner, tag].filter(Boolean)) {
            label.style.wordWrap = true; label.style.breakWords = true;
            label.style.wordWrapWidth = Math.max(24, viewport.width - 40);
          }
        }
        const pad = 8, width = (responsiveLayout ? Math.max(title.width, owner.width, tag?.width ?? 0)
          : Math.max(title.width, owner.width + (tag?.width ?? 0) + 8)) + pad * 2 + 6,
          height = title.height + owner.height + pad + (responsiveLayout && tag ? tag.height + 2 : 0);
        bg.clear();
        bg.roundRect(0, 0, width, height, 6).fill({color: 0x0b1118, alpha: 0.82});
        bg.rect(0, 0, 4, height).fill({color: palette.main, alpha: 1});
        bg.roundRect(0, 0, width, height, 6).stroke({width: 1, color: palette.edge, alpha: 0.9});
        owner.position.set(pad + 4, pad * 0.5); title.position.set(pad + 4, pad * 0.5 + owner.height - 2);
        tag?.position.set(responsiveLayout ? pad + 4 : pad + 8 + owner.width, responsiveLayout ? pad * 0.5 + owner.height + title.height : pad * 0.5 - 1);
        const fromLeft = callout.team === ctx.localTeam;
        const slide = reducedMotion ? 1 : easeOut(clamp(callout.age / 160, 0, 1));
        const out = callout.age > callout.life - 200 ? (callout.age - (callout.life - 200)) / 200 : 0;
        const baseX = fromLeft ? 8 : viewport.width - width - 8;
        node.position.set(baseX + (fromLeft ? -1 : 1) * (1 - slide) * (width + 12), 8);
        node.alpha = 1 - out;
      }
    }
    speedGfx.clear();
    if (speed > 0 && !reducedMotion) {
      const cx = viewport.width / 2, cy = viewport.height / 2, r0 = Math.min(cx, cy) * 0.75, r1 = Math.hypot(cx, cy);
      for (let i = 0; i < 26; i++) {
        const a = random() * TAU, inner = r0 + random() * r0 * 0.35;
        speedGfx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner).lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      speedGfx.stroke({width: 1.5, color: 0xffffff, alpha: 0.26 * speed});
    }
    flashGfx.clear();
    if (screenFlash > 0 && !reducedMotion) flashGfx.rect(0, 0, viewport.width, viewport.height).fill({color: 0xffffff, alpha: screenFlash * flashScale});
  }

  /** A fading copy of a fast-moving body: the dash afterimage. */
  function ghost({texture, anchorX, anchorY, scaleX, scaleY, x, y, rotation = 0, tint = 0x7cc8ff}) {
    if (!texture || reducedMotion || ghosts.length >= (rich ? 14 : 6)) return;
    const sprite = ghostPool.pop() ?? new PIXI.Sprite(texture);
    sprite.texture = texture; sprite.anchor.set(anchorX, anchorY); sprite.scale.set(scaleX, scaleY);
    sprite.position.set(x, y); sprite.rotation = rotation; sprite.tint = tint; sprite.blendMode = 'add'; sprite.visible = true;
    if (!sprite.parent) ghostLayer.addChild(sprite);
    ghosts.push({sprite, age: 0, life: 220, alpha: 0.3});
  }

  return Object.freeze({
    update,
    updateScreen,
    ghost,
    land,
    footstep,
    /**
     * Live shots the camera may follow: projectiles, streams and beams whose
     * owning launch is known, standing inside the arena. Area and screen-wide
     * effects never pull the shot.
     */
    projectilePoints: () => {
      const art = lastCtx?.artRect;
      return [...tracked.values()].filter(e => e.last && e.owner !== null && FOLLOW_FORMS.has(e.form)
        && (!art || (e.last.x >= art.x && e.last.x <= art.x + art.width && e.last.groundY >= art.y && e.last.groundY <= art.y + art.height)))
        .map(e => ({x: e.last.x, y: e.last.y}));
    },
    /** Per-slot character dressing the scene applies to its own sprite. */
    actorFx(slot) {
      const fx = actorFx.get(slot);
      if (!fx) return null;
      const wave = Math.sin(elapsed / 28);
      if (juicy) {
        // Wind-up squash (1.12 x 0.88 at its peak) eases out over 140 ms; the
        // knock is an eased 8-12 px push along the hit with a small shiver.
        const windup = reducedMotion ? 0 : Math.sin(Math.min(1, 1 - fx.charge) * Math.PI) * (fx.charge > 0 ? 1 : 0);
        const push = easeOut(fx.knock);
        return {flash: fx.flash, flashTint: fx.flashTint,
          squashX: 1 + fx.squash * 0.1 + windup * 0.12, squashY: 1 - fx.squash * 0.08 - windup * 0.12,
          offsetX: reducedMotion ? 0 : push * fx.knockDir * fx.knockPx + fx.knock * wave * 1.2};
      }
      return {flash: fx.flash, squashX: 1 + fx.squash * 0.1, squashY: 1 - fx.squash * 0.08,
        offsetX: reducedMotion ? 0 : fx.knock * fx.knockDir * 3 + fx.knock * wave * 1.2};
    },
    /** Juicy hit-stop: whether this slot's drawn frame should hold this frame. */
    holdFor(slot) { return Boolean(hitStop?.slots.has(slot)); },
    /** True while this layer draws the hyper ring round its caster. */
    hyperWrapActive: () => Boolean(hyper),
    hitStopActive: () => Boolean(hitStop),
    /** True when a pixel hit burst marks every contact, so the 3D overlay leaves its hit sparks out (SPECIAL_HEX_DECLUTTER_20261111). */
    ownsHitSparks: () => Boolean(pixelHits),
    /** Afterimage colour while a melee move's dash is live (juicy), else null. */
    ghostTint(slot) { const fx = actorFx.get(slot); return juicy && fx?.dashMs > 0 ? fx.dashTint : null; },
    /** Brightness 0..1 the scene multiplies into a slot (null: background). */
    brightnessFor(slot) {
      if (!dim) return 1;
      const k = dim.age / dim.life, envelope = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      return slot !== null && dim.focus.has(slot) ? 1 : 1 - dim.strength * envelope;
    },
    getDiagnostics: () => Object.freeze({particles: particles.length, peakParticles: peak, created, cap, flashes: flashes.length,
      rings: rings.length, scorches: scorches.length, words: words.length, ghosts: ghosts.length, tracked: tracked.size, eventsHandled,
      hitAnchors: {...anchors}, callout: callout ? {tier: callout.tier, age: callout.age} : null, banner: banner ? banner.node.text : null, dim: Boolean(dim),
      dimStrength: dim?.strength ?? null, juicy, hyperWrap: hyper ? {slot: hyper.slot, age: Math.round(hyper.age)} : null, quartet: {...quartet, numbersLive: numbers.length, capsulesLive: capsules.length, hitStop: Boolean(hitStop)},
      element: element?.getDiagnostics() ?? null, cuesPending: cues.length,
      moveVfx: kit ? {...kitStats, kit: kit.getDiagnostics()} : null, pixelHits: pixelHits?.getDiagnostics() ?? null, motes: motes?.getDiagnostics() ?? null, setPieces: setPieces?.getDiagnostics() ?? null, hitFeel: hitFeel?.getDiagnostics() ?? null}),
    /** Bounded 3D cues since the last call (buff, critical, signature weather), oldest first. */
    consumeCues: () => cues.splice(0),
    dispose() {
      for (const node of [scorchLayer, groundGfx, hyperBack, ghostLayer, hyperFront, trailGfx, particleLayer, flashLayer, speedGfx, barGfx, wordLayer, numberLayer, calloutLayer, flashGfx]) {
        node.parent?.removeChild(node);
        node.destroy({children: true});
      }
      numbers.length = capsules.length = numberPool.length = 0;
      hitStop = null;
      element?.dispose();
      kit?.dispose(); standIns.clear();
      pixelHits?.dispose(); motes?.dispose(); burstAt.clear(); setPieces?.dispose();
      cues.length = 0;
      for (const sprite of [...particlePool, ...flashPool, ...ghostPool]) if (!sprite.destroyed) sprite.destroy();
      for (const texture of [textures.flash, textures.dust, textures.spark, textures.dot, textures.scorch, ...textures.debris]) texture.destroy(true);
      particles.length = flashes.length = ghosts.length = scorches.length = rings.length = words.length = 0;
      tracked.clear(); actorFx.clear(); bars.clear(); seenImpacts.clear();
    }
  });
}
