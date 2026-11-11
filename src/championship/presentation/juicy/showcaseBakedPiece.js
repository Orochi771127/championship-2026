// The Dex "Preview special" plays a move's own baked piece (BESPOKE_MOVE_VFX_PROGRAM_20261111,
// refinement pass 5): the same pixelfx frames as the AI battle and the Data Arena, in the
// move's palette, on the theater's DOM stage -- one canvas for the colour (crisp pixels)
// and one for its light (blended as light). Frames step on the page's animation clock;
// both canvases leave when the piece ends. Presentation only.
import {bakedPieceLook, paintBakedPieceFrames, loadMoveVfxPieceSprites} from '../vfx/moveVfxSetPieces.js';

/** Load the baked pieces ahead of the first preview. */
export const preloadShowcaseBakedPieces = () => (typeof loadMoveVfxPieceSprites === 'function' ? loadMoveVfxPieceSprites() : Promise.resolve(null));

/**
 * Play the baked look `name` with its anchor at (x, y) -- or its feet on `groundY` for a
 * ground look -- spanning `width` stage px. Returns false when it is not loaded yet.
 */
export function playShowcaseBakedPiece({doc = globalThis.document, layer, name, palette, x, y, groundY = null, width = 120, facing = 1, flipY = false, scale = 1}) {
  const look = typeof bakedPieceLook === 'function' ? bakedPieceLook(name) : null;
  if (!look || !layer || !doc?.createElement) return false;
  const body = paintBakedPieceFrames(name, palette, {doc});
  if (!body) return false;
  const glow = paintBakedPieceFrames(name, palette, {doc, glow: true});
  const k = width * scale / look.w, ay = look.anchor === 'ground' && groundY !== null ? groundY : y;
  const sheets = [[body, k, false], ...(glow ? [[glow, k * 2, true]] : [])];
  const canvases = sheets.map(([sheet, size, light]) => {
    const canvas = doc.createElement('canvas');
    canvas.width = sheet.w; canvas.height = sheet.h;
    canvas.className = light ? 'cm-showcase__piece cm-showcase__piece--light' : 'cm-showcase__piece';
    const style = canvas.style;
    style.position = 'absolute'; style.pointerEvents = 'none';
    style.width = `${sheet.w * size}px`; style.height = `${sheet.h * size}px`;
    style.left = `${Math.round(x - sheet.ox * size)}px`; style.top = `${Math.round(ay - sheet.oy * size)}px`;
    style.transformOrigin = `${sheet.ox * size}px ${sheet.oy * size}px`;
    style.transform = `scale(${facing < 0 ? -1 : 1}, ${flipY ? -1 : 1})`;
    style.imageRendering = light ? 'auto' : 'pixelated';
    if (light) { style.mixBlendMode = 'screen'; style.opacity = '0.9'; }
    layer.append(canvas);
    return {canvas, sheet, context: canvas.getContext?.('2d')};
  });
  const view = doc.defaultView ?? globalThis, n = body.frames.length, started = view.performance?.now?.() ?? Date.now();
  const tick = () => {
    const index = Math.floor(((view.performance?.now?.() ?? Date.now()) - started) / 1000 * look.fps);
    if (index >= n || !canvases[0].canvas.isConnected) { for (const c of canvases) c.canvas.remove(); return; }
    for (const {sheet, context} of canvases) {
      if (!context) continue;
      context.clearRect(0, 0, sheet.w, sheet.h);
      context.drawImage(sheet.frames[Math.min(index, sheet.frames.length - 1)], 0, 0);
    }
    (view.requestAnimationFrame ?? (fn => view.setTimeout(fn, 16)))(tick);
  };
  tick();
  return true;
}
