// Data Arena -- a partner's own original moves drawn with their own effect cells
// (ORIGINAL_MOVES_ARENA_20261126, Owner 2026-11-26: 「原作對應每一隻的招式加回去」,
// a lion-head fist, missiles, a mushroom, bombs).
//
// Every own move record names its effect banks: what leaves the hand (launch),
// what flies (body) and what lands (hit). The AI battle plays those cells through
// the native effect pool; this layer plays the same cells in the arena:
//   * the body sequence flies on the move's real projectile, turned along its path
//     (a lion head, a missile, a thrown spear), with a short afterimage trail;
//   * a lobbed move (a bomb, a mushroom) arcs from the caster onto its zone and
//     sits there until the zone goes off;
//   * the launch sequence plays at the release point, the hit sequence where it lands.
//
// Art: the approved original web atlas (292 remade cells) when it has every frame
// of a sequence; otherwise the cell is painted by the remade-cell kit from its
// written brief, exactly as the AI battle remakes it. No reference pixel is read:
// only the pool's numeric frame boxes, ticks and loop flags.
//
// Presentation only: no rule, timing, damage or collision reads anything here.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};
import moves from '../../../data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import {battleFxFamilyForm, battleFxMoveBanks} from '../battleFx/battleFxRecipes.js';
import {paintRemadedCell} from '../vfx/remadeEffectCells.js';
import {relayOwnMove, relayOwnMoveInfo} from '../../modes/dataArena/dataArenaRelayKits.js';

// Hit-only families shared by every melee move: they mark the contact, they do not fly.
const GENERIC_FAMILIES = new Set(['battle', 'etc_hiteffect', 'H_claw', 'H_Slashtop', 'H_Knuckle', 'H_piercing']);
const byRecord = new Map(moves.records.map(move => [move.recordIndex, move]));
const TICK = 1 / 60;
// World px per native effect px, then fitted so the longest side of the cell lands in
// [min, max] world px: a relay body is ~78 world px tall, and a 16 px missile must read
// at phone size as well as a 40 px lion head does (PA2D draws shots well above their hitbox).
const SIZE = Object.freeze({shot: 2.6, launch: 2.4, hit: 2.8, lob: 3, ultimate: 1.25});
const FIT = Object.freeze({shot: [70, 112], launch: [40, 92], hit: [72, 150], lob: [56, 96]});
// A few drawn bodies take their element's warmth (the flame fist reads as fire, not steel).
const FAMILY_TINT = Object.freeze({flamefist00: 0xffa060});
const familyOf = bankId => String(profiles.banks[(bankId | 0) - 1]?.name ?? '').replace(/^e003_/, '');

/**
 * The original cells of one own move: {record, body, launch, hit, lob, ultimate},
 * each cell {bankId, sequence, family} or null; null when `moveId` is not an own move.
 */
const lookCache = new Map();
export function dataArenaOriginalMoveLook(moveId) {
  if (!lookCache.has(moveId)) lookCache.set(moveId, resolveLook(moveId));
  return lookCache.get(moveId);
}
function resolveLook(moveId) {
  const own = relayOwnMoveInfo(moveId);
  const move = own ? byRecord.get(own.record) : null;
  if (!move) return null;
  const banks = battleFxMoveBanks(move);
  const role = name => banks.find(bank => bank.role === name) ?? null;
  const body = role('body'), launch = role('launch'), hit = role('hit');
  const flying = body && !GENERIC_FAMILIES.has(body.family) ? body : null;
  return Object.freeze({
    record: own.record, style: own.style, ultimate: own.ultimate,
    body: flying, launch,
    // A melee move's body is its contact flash: it plays where the blow lands.
    hit: hit ?? (body && !flying ? body : null),
    // A thrown thing on a delayed zone (a bomb, a mushroom) is lobbed onto it.
    lob: Boolean(flying) && relayOwnMove(moveId)?.type === 'ZONE' && !['beam', 'stream', 'area'].includes(battleFxFamilyForm(flying.family))
  });
}

/** Frames of a native sequence: [{cell, seconds}], loop flag. */
function sequenceOf(bankId, sequence) {
  const s = profiles.banks[(bankId | 0) - 1]?.sequences?.[sequence];
  if (!s?.frames?.length) return null;
  return {frames: s.frames.map(f => ({cell: f.cell, seconds: Math.max(1, f.ticks | 0) * TICK})), loop: s.playbackMode === 2};
}

/** A geometry-only reference for the remade painter: the pool's frame box around the origin. */
export function originalCellBoxReference(bankId, cell) {
  const box = profiles.banks[(bankId | 0) - 1]?.boxes?.[cell];
  if (!Array.isArray(box) || box.length < 4) return null;
  const [maxX, maxY, minX, minY] = box, width = maxX - minX, height = maxY - minY;
  if (!(width > 0 && height > 0)) return null;
  return {frame: [0, 0, width, height], origin: [-minX, -minY], blank: false};
}

export function createDataArenaOriginalMoveFx({PIXI, layer, art = null, quality = 'high', reducedMotion = false, doc = globalThis.document} = {}) {
  if (!PIXI?.Sprite || !layer) return null;
  const MAX_ACTORS = quality === 'low' ? 28 : 56;
  const textures = new Map(); // `${bank}:${cell}` -> {texture, anchorX, anchorY, unit} | null
  const sequences = new Map(); // `${bank}:${seq}` -> {frames:[{tex, seconds}], loop} | null
  const actors = [];
  const pool = [];
  const stats = {shots: 0, lobs: 0, launches: 0, hits: 0, atlasCells: 0, remadeCells: 0, missingCells: 0};
  let elapsed = 0;

  function cellTexture(bankId, cell, fromAtlas) {
    const key = `${bankId}:${cell}`;
    if (textures.has(key)) return textures.get(key);
    let entry = null;
    const atlasCell = fromAtlas ? art?.getCell?.(bankId, cell) : null;
    if (atlasCell?.texture && !atlasCell.blank) {
      const [, , w, h] = atlasCell.frame, [ox, oy] = atlasCell.origin;
      entry = {texture: atlasCell.texture, anchorX: ox / w, anchorY: oy / h, unit: 1 / (atlasCell.pixelsPerNativePixel || 4), owned: false};
      stats.atlasCells++;
    } else {
      const reference = originalCellBoxReference(bankId, cell);
      const painted = reference && doc ? paintRemadedCell(bankId, cell, reference, {doc}) : null;
      if (painted?.canvas) {
        const texture = PIXI.Texture.from(painted.canvas);
        if (texture.source) texture.source.scaleMode = 'nearest';
        const [, , w, h] = painted.frame, [ox, oy] = painted.origin;
        entry = {texture, anchorX: ox / w, anchorY: oy / h, unit: 1 / (painted.pixelsPerNativePixel || 2), owned: true};
        stats.remadeCells++;
      } else stats.missingCells++;
    }
    textures.set(key, entry);
    return entry;
  }

  function sequenceFrames(cellRef) {
    if (!cellRef) return null;
    const key = `${cellRef.bankId}:${cellRef.sequence}`;
    if (sequences.has(key)) return sequences.get(key);
    const s = sequenceOf(cellRef.bankId, cellRef.sequence);
    const fromAtlas = Boolean(s && art?.has?.(cellRef.bankId, cellRef.sequence));
    const frames = s ? s.frames.map(f => ({tex: cellTexture(cellRef.bankId, f.cell, fromAtlas), seconds: f.seconds})).filter(f => f.tex) : [];
    // Longest side of the sequence in native px (texels x texel size).
    const nativeMax = Math.max(1, ...frames.map(f => Math.max(f.tex.texture.width ?? 0, f.tex.texture.height ?? 0) * f.tex.unit));
    const entry = frames.length ? {frames, loop: s.loop, family: cellRef.family, nativeMax} : null;
    sequences.set(key, entry);
    return entry;
  }

  function acquire() {
    if (actors.length >= MAX_ACTORS) release(actors[0]);
    const sprite = pool.pop() ?? new PIXI.Sprite();
    sprite.visible = true; sprite.alpha = 1; sprite.tint = 0xffffff; sprite.blendMode = 'normal'; sprite.rotation = 0;
    layer.addChild(sprite);
    return sprite;
  }
  function release(actor) {
    const at = actors.indexOf(actor);
    if (at >= 0) actors.splice(at, 1);
    for (const sprite of [actor.sprite, actor.shadow].filter(Boolean)) {
      sprite.visible = false; sprite.parent?.removeChild?.(sprite); pool.push(sprite);
    }
  }

  /** Point a left-facing native cell along `angle`, upright on both sides. */
  function orient(sprite, angle, scale, turn) {
    const right = Math.cos(angle) >= 0;
    sprite.scale.set(right ? -scale : scale, scale);
    sprite.rotation = turn ? (right ? angle : angle - Math.PI) : 0;
  }

  function show(actor) {
    const frame = actor.seq.frames[actor.frame];
    const sprite = actor.sprite;
    if (actor.tint && !actor.lob) sprite.tint = actor.tint;
    sprite.texture = frame.tex.texture;
    sprite.anchor.set(frame.tex.anchorX, frame.tex.anchorY);
    orient(sprite, actor.angle, actor.size * frame.tex.unit, actor.turn);
  }

  function spawn({seq, x, y, angle = 0, size, turn = false, follow = null, lob = null, life = Infinity, add = false}) {
    if (!seq) return null;
    const actor = {seq, sprite: acquire(), frame: 0, clock: 0, x, y, angle, size, turn, follow, lob, life, age: 0, ghostClock: 0, done: false};
    if (add) actor.sprite.blendMode = 'add';
    if (lob) {
      const shadow = acquire();
      shadow.texture = PIXI.Texture.WHITE; shadow.tint = 0x000000; shadow.alpha = 0.28; shadow.anchor.set(0.5);
      shadow.width = 30; shadow.height = 10;
      actor.shadow = shadow;
      layer.addChildAt?.(shadow, 0);
    }
    actors.push(actor);
    place(actor);
    show(actor);
    return actor;
  }

  function place(actor) {
    actor.sprite.position.set(actor.x, actor.y);
    if (actor.shadow) actor.shadow.position.set(actor.groundX ?? actor.x, actor.groundY ?? actor.y);
  }

  // A short trail of fading copies behind a flying cell reads as speed (the auto battle's afterimage).
  function ghost(actor) {
    if (reducedMotion || quality === 'low' || actors.length >= MAX_ACTORS - 4) return;
    const frame = actor.seq.frames[actor.frame];
    const sprite = acquire();
    sprite.texture = frame.tex.texture; sprite.anchor.set(frame.tex.anchorX, frame.tex.anchorY);
    orient(sprite, actor.angle, actor.size * frame.tex.unit, actor.turn);
    sprite.position.set(actor.x, actor.y); sprite.alpha = 0.42; sprite.blendMode = 'add';
    layer.addChildAt?.(sprite, Math.max(0, layer.children.indexOf(actor.sprite)));
    actors.push({sprite, seq: null, ghost: true, age: 0, life: 0.14, x: actor.x, y: actor.y});
  }

  function scaleFor(moveId, kind, seq) {
    const look = dataArenaOriginalMoveLook(moveId);
    const [min, max] = FIT[kind], native = seq?.nativeMax ?? 16;
    const fitted = Math.min(max / native, Math.max(min / native, SIZE[kind]));
    return fitted * (look?.ultimate ? SIZE.ultimate : 1);
  }

  return Object.freeze({
    look: dataArenaOriginalMoveLook,
    /** True when this move's own body cells fly on its shot. */
    // Beams, streams and storms keep the PixelFX conduit; a cell flies only when it is a thing.
    hasShot: moveId => { const look = dataArenaOriginalMoveLook(moveId); return Boolean(look?.body) && !look.lob && !['beam', 'stream', 'area'].includes(battleFxFamilyForm(look.body.family)); },
    hasLob: moveId => Boolean(dataArenaOriginalMoveLook(moveId)?.lob),
    /** An area move lands on its own burst (ZONE / NOVA), not on each struck body. */
    isArea: moveId => ['ZONE', 'NOVA'].includes(relayOwnMove(moveId)?.type),
    /** Paint the cells of these moves now (between matches), not on their first cast. */
    prewarm(moveIds = []) {
      for (const id of moveIds) {
        const look = dataArenaOriginalMoveLook(id);
        if (!look) continue;
        for (const cell of [look.body, look.launch, look.hit]) sequenceFrames(cell);
      }
    },
    /** The body flies on a live projectile; `follow()` returns {x, y, angle} or null when it ends. */
    projectile({follow, moveId, angle = 0}) {
      const look = dataArenaOriginalMoveLook(moveId);
      const seq = look?.body && !look.lob ? sequenceFrames(look.body) : null;
      const at = follow?.();
      if (!seq || !at) return false;
      stats.shots++;
      const actor = spawn({seq, x: at.x, y: at.y, angle: at.angle ?? angle, size: scaleFor(moveId, 'shot', seq), turn: true, follow});
      if (actor && FAMILY_TINT[look.body.family]) { actor.tint = FAMILY_TINT[look.body.family]; actor.sprite.tint = actor.tint; }
      return Boolean(actor);
    },
    /** A lobbed body arcs from the caster onto its zone and waits there for the burst. */
    lob({from, to, moveId, seconds = 0.6}) {
      const look = dataArenaOriginalMoveLook(moveId);
      const seq = look?.lob ? sequenceFrames(look.body) : null;
      if (!seq || !from || !to) return false;
      stats.lobs++;
      const flight = Math.max(0.28, Math.min(0.9, seconds * 0.8));
      const height = 70 + Math.hypot(to.x - from.x, to.y - from.y) * 0.32;
      const actor = spawn({seq, x: from.x, y: from.y, angle: Math.atan2(to.y - from.y, to.x - from.x), size: scaleFor(moveId, 'lob', seq),
        lob: {from, to, flight, height, hold: Math.max(0.2, seconds - flight + 0.35)}, life: Infinity});
      if (actor) { actor.moveId = moveId; actor.groundX = from.x; actor.groundY = from.y; }
      return Boolean(actor);
    },
    /** The launch cells at the release point. */
    release({x, y, angle = 0, moveId}) {
      const look = dataArenaOriginalMoveLook(moveId);
      const seq = sequenceFrames(look?.launch);
      if (!seq) return false;
      stats.launches++;
      return Boolean(spawn({seq: {...seq, loop: false}, x, y, angle, size: scaleFor(moveId, 'launch', seq), turn: false}));
    },
    /** The hit cells where the move lands; a lobbed body still waiting there goes off with it. */
    hit({x, y, angle = 0, moveId}) {
      const look = dataArenaOriginalMoveLook(moveId);
      for (const actor of [...actors]) if (actor.lob && actor.moveId === moveId && Math.hypot(actor.lob.to.x - x, actor.lob.to.y - y) < 90) release(actor);
      const seq = sequenceFrames(look?.hit);
      if (!seq) return false;
      stats.hits++;
      return Boolean(spawn({seq: {...seq, loop: false}, x, y, angle, size: scaleFor(moveId, 'hit', seq), turn: false}));
    },
    update(dtMs) {
      const dt = Math.max(0, Math.min(100, dtMs)) / 1000;
      elapsed += dt;
      for (const actor of [...actors]) {
        actor.age += dt;
        if (actor.ghost) {
          actor.sprite.alpha = 0.42 * Math.max(0, 1 - actor.age / actor.life);
          if (actor.age >= actor.life) release(actor);
          continue;
        }
        if (actor.follow) {
          const at = actor.follow();
          if (!at) { release(actor); continue; }
          actor.x = at.x; actor.y = at.y; if (Number.isFinite(at.angle)) actor.angle = at.angle;
          actor.ghostClock += dt;
          if (actor.ghostClock >= 0.045) { actor.ghostClock = 0; ghost(actor); }
        } else if (actor.lob) {
          const {from, to, flight, height, hold} = actor.lob;
          const k = Math.min(1, actor.age / flight);
          actor.groundX = from.x + (to.x - from.x) * k; actor.groundY = from.y + (to.y - from.y) * k;
          actor.x = actor.groundX; actor.y = actor.groundY - 26 - height * 4 * k * (1 - k);
          if (actor.shadow) { const s = 0.6 + 0.4 * k; actor.shadow.width = 34 * s; actor.shadow.height = 11 * s; }
          // Landed: it sits and blinks until the zone goes off (or a stray one times out).
          if (k >= 1) actor.sprite.tint = Math.floor(elapsed * 14) % 2 ? 0xffffff : 0xffb0a0;
          if (actor.age >= flight + hold) { release(actor); continue; }
        }
        // Advance the native sequence; a one-shot sequence ends on its last frame.
        actor.clock += dt;
        let frame = actor.seq.frames[actor.frame];
        while (actor.clock >= frame.seconds) {
          actor.clock -= frame.seconds;
          if (actor.frame + 1 < actor.seq.frames.length) actor.frame++;
          else if (actor.seq.loop || actor.follow || actor.lob) actor.frame = 0;
          else { actor.done = true; break; }
          frame = actor.seq.frames[actor.frame];
        }
        if (actor.done) { release(actor); continue; }
        place(actor);
        show(actor);
      }
    },
    getDiagnostics: () => Object.freeze({...stats, active: actors.length, textures: textures.size}),
    dispose() {
      for (const actor of [...actors]) release(actor);
      for (const sprite of pool) sprite.destroy?.();
      pool.length = 0;
      for (const entry of textures.values()) if (entry?.owned) entry.texture.destroy(true);
      textures.clear(); sequences.clear();
    }
  });
}
