// The Dex "Preview special" plays a move's own baked piece (BESPOKE_MOVE_VFX_PROGRAM_20261111,
// refinement pass 5): the same pixelfx frames as the AI battle and the Data Arena, in the
// move's palette, on the theater's DOM stage -- one canvas for the colour (crisp pixels)
// and one for its light (blended as light). Frames step on the page's animation clock;
// both canvases leave when the piece ends. Presentation only.
import {bakedPieceLook, paintBakedPieceFrames, loadMoveVfxPieceSprites, loadMoveVfx3dPieces} from '../vfx/moveVfxSetPieces.js';
import {MOVE_VFX_3D_FALLBACK} from '../vfx/moveVfxPieceSprites3dIndex.js';

/** Load the baked pieces ahead of the first preview. */
export const preloadShowcaseBakedPieces = () => (typeof loadMoveVfxPieceSprites === 'function' ? loadMoveVfxPieceSprites() : Promise.resolve(null));

/**
 * Play the baked look `name` with its anchor at (x, y) -- or its feet on `groundY` for a
 * ground look -- spanning `width` stage px. Returns false when it is not loaded yet.
 */
export function playShowcaseBakedPiece({doc = globalThis.document, layer, name, palette, x, y, groundY = null, width = 120, facing = 1, flipY = false, scale = 1}) {
  // a three.js piece (UNIFIED_MOVES_20261118) loads its group on first use; the shared piece it replaces plays meanwhile
  if (typeof bakedPieceLook === 'function' && !bakedPieceLook(name) && MOVE_VFX_3D_FALLBACK?.[name] !== undefined) {
    if (typeof loadMoveVfx3dPieces === 'function') loadMoveVfx3dPieces([name]);
    const base = MOVE_VFX_3D_FALLBACK[name];
    return base ? playShowcaseBakedPiece({doc, layer, name: base, palette, x, y, groundY, width, facing, flipY, scale}) : false;
  }
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

/** A Dex preview owns exactly one selected Auto atlas, including its outstanding requests. */
export function createShowcaseMoveAtlas({doc, key, fetchImpl = globalThis.fetch}) {
  const controller = new AbortController();
  let bitmap = null, phases = [];
  const canvases = new Set();
  async function load() {
    const base = new URL('assets/production/vfx/auto-moves/' + key, doc.baseURI);
    const read = async (ext, mime) => {
      const res = await fetchImpl(base.href + ext, {signal: controller.signal});
      if (!res.ok || res.headers.get('content-type')?.split(';')[0] !== mime) throw Error('SHOWCASE_ATLAS_RESPONSE');
      return res;
    };
    const data = await (await read('.json', 'application/json')).json();
    if (data.mode !== 'auto' || data.key !== key || data.battleRecord !== key) return;
    const image = await createImageBitmap(await (await read('.png', 'image/png')).blob());
    if (controller.signal.aborted) { image.close(); return; }
    bitmap = image;
    phases = data.phases;
  }
  if (doc?.baseURI && typeof fetchImpl === 'function') load().catch(() => {});
  function play(keys, {layer, from, to = from, width, duration, reduced}) {
    const phase = phases.find(p => keys.includes(p.key));
    if (!bitmap || !phase) return false;
    const canvas = doc.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const frames = phase.frames, clip = frames.reduce((ms,f) => ms + f.durationMs, 0);
    const span = duration ?? clip, view = doc.defaultView, start = view.performance.now();
    canvas.style.position = 'absolute'; canvas.style.pointerEvents = 'none'; canvas.style.imageRendering = 'pixelated';
    canvas.dataset.movePhase = phase.key;
    layer.append(canvas); canvases.add(canvas);
    function draw(now) {
      const elapsed = now - start;
      if (!bitmap || !canvas.isConnected || elapsed >= span) { canvas.remove(); canvases.delete(canvas); return; }
      let t = reduced ? clip / 2 : elapsed * clip / span;
      const f = frames.find(f => (t -= f.durationMs) < 0) ?? frames.at(-1);
      canvas.width = f.w; canvas.height = f.h; ctx.drawImage(bitmap, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const scale = width / f.w, dx = to.x-from.x, dy = to.y-from.y, progress = elapsed/span;
      const beam = phase.key === 'beam', travel = phase.key === 'travel';
      canvas.style.width = width + 'px'; canvas.style.height = f.h*scale + 'px';
      canvas.style.left = (from.x + (travel ? dx*progress : 0) - f.pivot.x*scale) + 'px';
      canvas.style.top = (from.y + (travel ? dy*progress : 0) - f.pivot.y*scale) + 'px';
      if (beam && phase.span) {
        const length = Math.hypot(dx,dy);
        const offset = (phase.span.left - f.pivot.x)*scale;
        canvas.style.transformOrigin = (f.pivot.x*scale)+'px '+(f.pivot.y*scale)+'px';
        const stretch = length/(phase.span.width*scale);
        canvas.style.transform = 'rotate('+Math.atan2(dy,dx)+'rad) scaleX('+stretch+') translateX('+(-offset)+'px)';
      } else if (travel) {
        canvas.style.transformOrigin = (f.pivot.x*scale)+'px '+(f.pivot.y*scale)+'px';
        canvas.style.transform = 'rotate('+Math.atan2(dy,dx)+'rad)';
      }
      view.requestAnimationFrame(draw);
    }
    draw(start); return true;
  }
  return {play, dispose() {
    controller.abort(); bitmap?.close(); bitmap = null; phases = [];
    for (const canvas of canvases) canvas.remove();
    canvases.clear();
  }};
}
