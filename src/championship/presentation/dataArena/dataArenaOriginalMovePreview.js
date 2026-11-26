// Lobby move preview with a partner's own original effect cells (ORIGINAL_MOVES_ARENA_20261126):
// the 2D preview canvas draws the same cells the arena flies -- a lion head, a missile,
// a lobbed bomb or mushroom -- so the lobby and the match look alike. No Pixi: the
// approved web atlas is one <img>, a remade cell is the remade-cell kit's own canvas.
//
// Presentation only, read-only; destinations follow the atlas's own approval
// (originalVfxCellArtAllowed): elsewhere every cell is the remade drawing.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};
import {paintRemadedCell} from '../vfx/remadeEffectCells.js';
import {originalVfxCellArtAllowed} from '../vfx/originalVfxCellArt.js';
import {loadOriginalSharedVfxDescriptor, sharedVfxAtlasSources} from '../originalSharedVfxReview.js';
import {battleFxFamilyForm} from '../battleFx/battleFxRecipes.js';
import {dataArenaOriginalMoveLook, originalCellBoxReference} from './dataArenaOriginalMoveFx.js';

const TICK = 1 / 60;
let atlasLoad = null;

function loadImage(doc, src) {
  return new Promise(resolve => {
    const img = doc.createElement('img');
    img.onload = () => resolve(img); img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The approved web atlas as {img, cells}, once per page; null where it is not approved. */
function loadAtlas({doc, href, fetchImpl}) {
  if (!doc || !originalVfxCellArtAllowed(href)) return Promise.resolve(null);
  atlasLoad ??= (async () => {
    const baseUrl = doc.baseURI ?? href;
    const {descriptor} = await loadOriginalSharedVfxDescriptor({href, baseUrl, fetchImpl});
    for (const src of sharedVfxAtlasSources(new URL(descriptor.image.src, baseUrl).href)) {
      const img = await loadImage(doc, src);
      if (img) return {img, cells: new Map(descriptor.cells.map(cell => [`${cell.bankId}:${cell.cell}`, cell]))};
    }
    return null;
  })().catch(() => null);
  return atlasLoad;
}

function sequenceFrames(cellRef, atlas, doc) {
  const sequence = cellRef ? profiles.banks[(cellRef.bankId | 0) - 1]?.sequences?.[cellRef.sequence] : null;
  if (!sequence?.frames?.length) return null;
  const key = cell => `${cellRef.bankId}:${cell}`;
  const inAtlas = Boolean(atlas) && sequence.frames.every(f => atlas.cells.get(key(f.cell)) && !atlas.cells.get(key(f.cell)).blank);
  const frames = sequence.frames.map(f => {
    const seconds = Math.max(1, f.ticks | 0) * TICK;
    if (inAtlas) {
      const cell = atlas.cells.get(key(f.cell)), [sx, sy, sw, sh] = cell.frame;
      return {image: atlas.img, sx, sy, sw, sh, ox: cell.origin[0], oy: cell.origin[1], unit: 1 / (cell.pixelsPerNativePixel || 4), seconds};
    }
    const reference = originalCellBoxReference(cellRef.bankId, f.cell);
    const painted = reference ? paintRemadedCell(cellRef.bankId, f.cell, reference, {doc}) : null;
    if (!painted?.canvas) return null;
    const [, , sw, sh] = painted.frame;
    return {image: painted.canvas, sx: 0, sy: 0, sw, sh, ox: painted.origin[0], oy: painted.origin[1], unit: 1 / (painted.pixelsPerNativePixel || 2), seconds};
  }).filter(Boolean);
  if (!frames.length) return null;
  const nativeMax = Math.max(1, ...frames.map(f => Math.max(f.sw, f.sh) * f.unit));
  return {frames, loop: sequence.playbackMode === 2, total: frames.reduce((sum, f) => sum + f.seconds, 0), nativeMax};
}

/** {body, launch, hit, lob, shot} cell runs of one own move, or null when it has none. */
export async function loadOriginalMovePreview(moveId, {doc = globalThis.document, href = globalThis.location?.href, fetchImpl = globalThis.fetch} = {}) {
  const look = dataArenaOriginalMoveLook(moveId);
  if (!look || !doc) return null;
  const atlas = await loadAtlas({doc, href, fetchImpl});
  const flies = Boolean(look.body) && !['beam', 'stream', 'area'].includes(battleFxFamilyForm(look.body.family));
  const preview = {body: flies ? sequenceFrames(look.body, atlas, doc) : null, launch: sequenceFrames(look.launch, atlas, doc),
    hit: sequenceFrames(look.hit, atlas, doc), lob: Boolean(look.lob), ultimate: look.ultimate};
  return preview.body || preview.hit ? preview : null;
}

function frameAt(run, seconds) {
  let t = run.loop ? seconds % run.total : Math.min(seconds, run.total - 1e-6);
  for (const frame of run.frames) { if (t < frame.seconds) return frame; t -= frame.seconds; }
  return run.frames.at(-1);
}

// Preview px per native px, fitted like the arena: [min, max] px for the longest side.
const FIT = Object.freeze({body: [30, 66], launch: [22, 48], hit: [40, 84]});
function drawRun(ctx, run, kind, seconds, x, y, angle, turn) {
  const frame = frameAt(run, seconds);
  const [min, max] = FIT[kind];
  const k = Math.min(max / run.nativeMax, Math.max(min / run.nativeMax, 1.7)) * frame.unit;
  const right = Math.cos(angle) >= 0;
  ctx.save();
  ctx.translate(x, y);
  if (turn) ctx.rotate(right ? angle : angle - Math.PI);
  if (right) ctx.scale(-1, 1); // native cells face left
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame.image, frame.sx, frame.sy, frame.sw, frame.sh, -frame.ox * k, -frame.oy * k, frame.sw * k, frame.sh * k);
  ctx.restore();
}

/**
 * Draw one preview instant (`phase` 0..1 of the loop) from the caster at `from` to the
 * target at `to`; true when the original cells drew the move. Shots fly 0.1-0.5, a lob
 * arcs 0.1-0.5 and waits, the hit plays from 0.5; a melee hit lands at 0.4.
 */
export function drawOriginalMovePreview(ctx, preview, {phase, from, to, loopSeconds = 2, melee = false}) {
  if (!ctx || !preview) return false;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const at = phase * loopSeconds;
  if (preview.launch && phase < 0.22) drawRun(ctx, preview.launch, 'launch', at - 0.02, from.x, from.y, angle, false);
  const hitAt = preview.body && !melee ? 0.5 : 0.4;
  if (preview.body && !melee && phase >= 0.1 && phase < hitAt) {
    const k = (phase - 0.1) / (hitAt - 0.1), x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k - (preview.lob ? 46 * 4 * k * (1 - k) : 0);
    // A short trail of fading copies behind a straight shot.
    if (!preview.lob) for (let i = 2; i >= 1; i--) {
      ctx.globalAlpha = 0.22 * (3 - i);
      drawRun(ctx, preview.body, 'body', at, x - (to.x - from.x) * 0.06 * i, y - (to.y - from.y) * 0.06 * i, angle, true);
    }
    ctx.globalAlpha = 1;
    drawRun(ctx, preview.body, 'body', at, x, y, angle, !preview.lob);
  }
  if (preview.hit && phase >= hitAt && phase < hitAt + 0.38) drawRun(ctx, preview.hit, 'hit', (phase - hitAt) * loopSeconds, to.x, to.y, angle, false);
  return true;
}
