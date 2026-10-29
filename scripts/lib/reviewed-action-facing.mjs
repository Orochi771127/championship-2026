// Facing check of the reviewed character action art (Owner 2026-10-29: every action the game draws
// must be checkable). A frame that faces against the rest of its own clip makes the partner turn
// around for a frame; its silhouette, mirrored about the pivot, then overlaps its clip neighbours
// clearly better than as drawn. Masks come from scripts/build-reviewed-action-masks.py.
//
// Drawn orientation, as the game applies it:
//   general (Main/Sub) - selection generalMirror XOR generalMirrorFrames (reviewedCharacterLoader);
//   arena (L R UL UR DL DR) - the manifest frame's mirrorX (reviewedArena placement).
import { gunzipSync } from 'node:zlib';

export const FACING_RATIO = 1.4;
export const FACING_MARGIN = 0.12;

export function decodeFacingMasks(document) {
  return JSON.parse(gunzipSync(Buffer.from(document.payload, 'base64')).toString('utf8'));
}

function unpack(base64, grid) {
  const bytes = Buffer.from(base64, 'base64'), cells = new Uint8Array(grid * grid);
  for (let i = 0; i < cells.length; i++) cells[i] = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
  return cells;
}

function mirror(cells, grid) {
  const out = new Uint8Array(cells.length);
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) out[y * grid + x] = cells[y * grid + grid - 1 - x];
  return out;
}

function iou(a, b) {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) { both += a[i] & b[i]; either += a[i] | b[i]; }
  return either ? both / either : 0;
}

export function clipUsage(clip, headings) {
  if (clip.mode === 'main' || clip.mode === 'sub') return 'general';
  if (clip.mode === 'arena' && headings.includes(clip.direction)) return 'arena';
  return null;
}

export function drawnMirrored(usage, entry, frame, assetId) {
  if (usage === 'arena') return frame?.mirrorX === true;
  return (entry.generalMirror === true) !== (entry.generalMirrorFrames ?? []).includes(assetId);
}

/**
 * Frames that face against their own clip. Each step is compared with the nearest earlier and later
 * step showing a different drawing (wrapping for a loop); a frame is reported when its mirror image
 * overlaps those neighbours by FACING_RATIO times and FACING_MARGIN more than the drawing itself.
 */
export function facingOutliers({ entry, manifest, roleMasks, grid, headings }) {
  const frames = Array.isArray(manifest.frames) ? Object.fromEntries(manifest.frames.map(({ id, ...f }) => [id, f])) : manifest.frames;
  const found = [];
  for (const clip of manifest.clips) {
    const usage = clipUsage(clip, headings), steps = clip.frames.map((s) => s.assetId);
    if (!usage || new Set(steps).size < 2) continue;
    const masks = roleMasks[usage]?.frames ?? {}, drawn = new Map(), flipped = new Map();
    for (const id of new Set(steps)) {
      if (!masks[id]) throw Error(`FACING_MASK_MISSING ${entry.displayCode} ${usage} ${id}`);
      const cells = unpack(masks[id], grid), m = drawnMirrored(usage, entry, frames[id], id);
      drawn.set(id, m ? mirror(cells, grid) : cells); flipped.set(id, m ? cells : mirror(cells, grid));
    }
    const pairs = new Map();
    steps.forEach((id, i) => {
      for (const dir of [-1, 1]) {
        for (let k = 1; k < steps.length; k++) {
          const j = i + dir * k;
          if (!clip.loop && (j < 0 || j >= steps.length)) break;
          const other = steps[(j + steps.length) % steps.length];
          if (other !== id) { (pairs.get(id) ?? pairs.set(id, []).get(id)).push(other); break; }
        }
      }
    });
    for (const [id, others] of pairs) {
      const same = others.reduce((n, o) => n + iou(drawn.get(id), drawn.get(o)), 0) / others.length;
      const turned = others.reduce((n, o) => n + iou(flipped.get(id), drawn.get(o)), 0) / others.length;
      if (turned > same * FACING_RATIO && turned - same > FACING_MARGIN) {
        found.push({ displayCode: entry.displayCode, usage, clip: clip.id, action: clip.action ?? null, direction: clip.direction ?? null,
          frame: id, distinct: new Set(steps).size, drawn: +same.toFixed(3), mirrored: +turned.toFixed(3) });
      }
    }
  }
  return found;
}
