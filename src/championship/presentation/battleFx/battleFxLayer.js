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
  const linear = (w, h, draw) => {
    const canvas = makeCanvas(w, h), ctx = canvas.getContext('2d');
    draw(ctx);
    return PIXI.Texture.from(canvas);
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
    // Scorch: a soft dark oval with a faint warm rim, linear so it stays smooth.
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

export function createBattleFxLayer({PIXI, worldBack, worldFront, screen, quality = 'balanced', reducedMotion = false, responsiveLayout = false,
  flashScale = 1, describeMove = () => null, nameOfSlot = () => '', moveNameOf = () => '', text = value => value, seed = 0x51ed}) {
  const textures = createTextures(PIXI);
  if (!textures) return null;
  const random = battleFxRandom(seed);
  const cap = BATTLE_FX_PARTICLE_CAP[quality] ?? BATTLE_FX_PARTICLE_CAP.balanced;
  const rich = quality !== 'saver';

  const scorchLayer = new PIXI.Container({label: 'battle fx scorch'});
  const groundGfx = new PIXI.Graphics(); groundGfx.label = 'battle fx ground shock rings';
  const ghostLayer = new PIXI.Container({label: 'battle fx dash afterimages'});
  worldBack.addChild(scorchLayer, groundGfx, ghostLayer);
  const trailGfx = new PIXI.Graphics(); trailGfx.blendMode = 'add'; trailGfx.label = 'battle fx motion streaks';
  const particleLayer = new PIXI.Container({label: 'battle fx particles'});
  const flashLayer = new PIXI.Container({label: 'battle fx contact flashes'});
  worldFront.addChild(trailGfx, particleLayer, flashLayer);
  const speedGfx = new PIXI.Graphics(); speedGfx.label = 'battle fx speed lines';
  const barGfx = new PIXI.Graphics(); barGfx.label = 'battle fx overhead bars';
  const wordLayer = new PIXI.Container({label: 'battle fx words'});
  const calloutLayer = new PIXI.Container({label: 'battle fx callout'});
  const flashGfx = new PIXI.Graphics(); flashGfx.label = 'battle fx screen flash';
  screen.addChild(speedGfx, barGfx, wordLayer, calloutLayer, flashGfx);

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
  function spawnRing({x, groundY, radius, tint, life = 340, width = 2.5, alpha = 0.95, delay = 0}) {
    rings.push({x, y: groundY, radius, tint, life, age: -delay, width, alpha});
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
    if (!fx) { fx = {flash: 0, squash: 0, knock: 0, knockDir: 0}; actorFx.set(slot, fx); }
    return fx;
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
        const palette = BATTLE_FX_PALETTES[look?.palette ?? battleFxFamilyPalette(family) ?? 'neutral'] ?? BATTLE_FX_PALETTES.neutral;
        entry = {form, palette, owner: owner?.ownerSlot ?? null, tier: look?.tier ?? 'skill', points: [], ageMs: 0};
        tracked.set(actor.id, entry);
        // The real launch point: where the move's own effect first appears.
        if (MOVING_FORMS.has(form)) {
          spawnFlash({x: at.x, y: at.y, tint: palette.core, size: 26, life: 120});
          sparks({x: at.x, y: at.y, count: rich ? 5 : 3, palette, speed: 90, life: 260, scale: 0.8});
          if (at.heightNative < 10) dust({x: at.x, groundY: at.groundY, count: rich ? 3 : 2, spread: 6, life: 520, scale: 0.8});
        }
      }
      entry.ageMs += dtMs;
      entry.points.push({x: at.x, y: at.y});
      if (entry.points.length > 6) entry.points.shift();
      entry.last = at;
    }
    endings = [];
    for (const [id, entry] of tracked) {
      if (live.has(id)) continue;
      if (entry.last && MOVING_FORMS.has(entry.form)) endings.push({...entry.last, palette: entry.palette, form: entry.form, tier: entry.tier, used: false});
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
  }

  /** A projectile that ended without a hit near it: it bursts where it stopped. */
  function settleEndings() {
    for (const end of endings) {
      if (end.used) continue;
      const near = end.heightNative < 18;
      spawnFlash({x: end.x, y: end.y, tint: end.palette.core, size: 30, life: 140});
      sparks({x: end.x, y: end.y, count: rich ? 8 : 4, palette: end.palette, speed: 120, life: 300, groundY: end.groundY});
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
        if (!info || !look || look.tier === 'basic' || look.tier === 'support') continue;
        const palette = BATTLE_FX_PALETTES[look.palette] ?? BATTLE_FX_PALETTES.neutral;
        // Power gathered at the attacker's feet: a ground ring and kicked-up dust.
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.75, tint: palette.main, life: 420});
        dust({x: info.x, groundY: info.groundY, count: rich ? 5 : 3, spread: info.width * 0.4});
        showCallout({team: info.team, name: nameOfSlot(event.slot), move: moveNameOf(event.moveId, look), tier: look.tier, palette});
        const director = ctx.camera?.director;
        if (look.tier === 'ultimate') {
          spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 1.3, tint: palette.core, life: 560, delay: 140});
          spawnScorch({x: info.x, groundY: info.groundY, size: info.width * 0.9, life: 2200});
          debris({x: info.x, y: info.groundY, groundY: info.groundY, count: rich ? 6 : 3, palette, power: 0.6});
          dim = {focus: new Set([event.slot]), age: 0, life: 1150, strength: 0.45};
          speed = reducedMotion ? 0 : 1;
          // Push in on the attacker, then pull out to show the whole path.
          director?.sequence([{slots: [event.slot], durationMs: 650, boost: 0.38}, {slots: [event.slot, ...ctx.opponentsOf(event.slot)], durationMs: 1100, boost: -0.05}]);
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
        const palette = BATTLE_FX_PALETTES[look?.palette] ?? BATTLE_FX_PALETTES.neutral;
        // A native screen flash has no target/critical attribution. Only an
        // explicitly attributed HIT may label itself critical.
        const critical = event.critical === true;
        const tier = battleFxHitTier({ratio: event.ratio, ultimate: look?.tier === 'ultimate', critical});
        const hit = battleFxHitPoint({target, impacts: freshImpacts, endings: endings.filter(e => !e.used), attacker});
        anchors[hit.source]++;
        for (const end of endings) if (Math.abs(end.x - hit.x) < 1 && Math.abs(end.y - hit.y) < 1) end.used = true;
        const fx = fxFor(event.slot);
        fx.flash = 1; fx.squash = tier === 'heavy' ? 1 : tier === 'medium' ? 0.7 : 0.4;
        fx.knock = tier === 'heavy' ? 1 : 0.6; fx.knockDir = attacker ? Math.sign(target.x - attacker.x) || -target.facing : -target.facing;
        // At the contact point: a flash and sparks that fall to the target's ground.
        spawnFlash({x: hit.x, y: hit.y, tint: palette.core, size: tier === 'heavy' ? 46 : 30, life: tier === 'heavy' ? 170 : 120});
        sparks({x: hit.x, y: hit.y, count: tier === 'heavy' ? (rich ? 22 : 10) : tier === 'medium' ? (rich ? 12 : 6) : 6, palette,
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
          spawnScorch({x: hit.x, groundY: hit.groundY, size: target.width * 1.1});
          director?.impact('heavy');
          screenFlash = Math.max(screenFlash, 0.18);
        } else if (tier === 'medium') { director?.impact('medium'); }
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
        const palette = event.type === 'HEAL' ? BATTLE_FX_PALETTES.nature : BATTLE_FX_PALETTES.light;
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.9, tint: palette.main, life: 560});
        spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.6, tint: palette.core, life: 480, delay: 120});
        if (event.type === 'HEAL') {
          const p = toScreen(ctx, info.x, info.top);
          word({screenX: p.x, screenY: p.y - 6, content: text('回復'), size: 15, fill: 0x9cff7a, life: 800});
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
        if (event.teamDown) showBanner('K.O.!', {size: 44, fill: 0xffe36a, life: 1500});
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
    dust({x: info.x, groundY: info.groundY, count: Math.round((rich ? 6 : 3) * strength), spread: info.width * 0.55, scale: 1.1});
    spawnRing({x: info.x, groundY: info.groundY, radius: info.width * 0.7 * strength, tint: DUST, life: 300, alpha: 0.6, width: 2});
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
      if (entry.form !== 'projectile' && entry.form !== 'stream') continue;
      const pts = entry.points;
      for (let i = 1; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        trailGfx.moveTo(pts[i - 1].x, pts[i - 1].y).lineTo(pts[i].x, pts[i].y);
        trailGfx.stroke({width: Math.max(0.6, 3 * t), color: entry.palette.main, alpha: 0.35 * t, cap: 'round'});
      }
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
      const k = easeOut(r.age / r.life), radius = r.radius * (0.2 + k);
      groundGfx.ellipse(r.x, r.y, radius, radius * 0.34).stroke({width: r.width * (1 - k * 0.6), color: r.tint, alpha: r.alpha * (1 - k)});
    }
    for (let i = scorches.length - 1; i >= 0; i--) {
      const s = scorches[i];
      s.age += dtMs;
      if (s.age >= s.life) { s.sprite.destroy(); scorches.splice(i, 1); continue; }
      s.sprite.alpha = s.age > s.life - 1200 ? (s.life - s.age) / 1200 : Math.min(1, s.age / 60);
    }
    for (const fx of actorFx.values()) {
      fx.flash = Math.max(0, fx.flash - dtMs / 120);
      fx.squash = Math.max(0, fx.squash - dtMs / 180);
      fx.knock = Math.max(0, fx.knock - dtMs / 220);
    }
    if (dim) { dim.age += dtMs; if (dim.age >= dim.life) dim = null; }
    speed = Math.max(0, speed - dtMs / 700);
    screenFlash = Math.max(0, screenFlash - dtMs / 160);
  }

  /** Screen-space dressing after the camera is known. */
  function updateScreen({viewport, view, ctx, dtMs}) {
    lastCtx = ctx;
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
        showBanner(copy,{size:34,fill:0xffffff,life:Infinity});banner.opening=true;
      }
    }else if(banner?.opening){banner.node.destroy();banner=null;}
    if (banner) {
      banner.age += dtMs;
      if (banner.age >= banner.life) { banner.node.destroy(); banner = null; }
      else {
        const k = banner.age / banner.life, pop = banner.age < 140 ? lerp(2.1, 1, easeOut(banner.age / 140)) : 1;
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
      return {flash: fx.flash, squashX: 1 + fx.squash * 0.1, squashY: 1 - fx.squash * 0.08,
        offsetX: reducedMotion ? 0 : fx.knock * fx.knockDir * 3 + fx.knock * wave * 1.2};
    },
    /** Brightness 0..1 the scene multiplies into a slot (null: background). */
    brightnessFor(slot) {
      if (!dim) return 1;
      const k = dim.age / dim.life, envelope = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      return slot !== null && dim.focus.has(slot) ? 1 : 1 - dim.strength * envelope;
    },
    getDiagnostics: () => Object.freeze({particles: particles.length, peakParticles: peak, created, cap, flashes: flashes.length,
      rings: rings.length, scorches: scorches.length, words: words.length, ghosts: ghosts.length, tracked: tracked.size, eventsHandled,
      hitAnchors: {...anchors}, callout: callout ? {tier: callout.tier, age: callout.age} : null, banner: banner ? banner.node.text : null, dim: Boolean(dim)}),
    dispose() {
      for (const node of [scorchLayer, groundGfx, ghostLayer, trailGfx, particleLayer, flashLayer, speedGfx, barGfx, wordLayer, calloutLayer, flashGfx]) {
        node.parent?.removeChild(node);
        node.destroy({children: true});
      }
      for (const sprite of [...particlePool, ...flashPool, ...ghostPool]) if (!sprite.destroyed) sprite.destroy();
      for (const texture of [textures.flash, textures.dust, textures.spark, textures.dot, textures.scorch, ...textures.debris]) texture.destroy(true);
      particles.length = flashes.length = ghosts.length = scorches.length = rings.length = words.length = 0;
      tracked.clear(); actorFx.clear(); bars.clear(); seenImpacts.clear();
    }
  });
}
