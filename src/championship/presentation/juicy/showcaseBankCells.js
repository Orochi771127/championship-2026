// The battle's own effect cells in the Dex preview (Owner 2026-10-28: 「找一下，
// 原本我們做好的Vfx招式」). A move record names its effect banks; the battle
// draws their native sequences from the public battle-effects atlas, with the
// Owner's remade shared VFX (210 cells; the 292-cell web atlas on loopback
// review) over the sequences it covers. This
// plays those same cells as CSS sprites, so the preview shows the real missile,
// rose vine or thunderball instead of a generic shape. DOM + Web Animations
// only: no canvas, no renderer, no clock of its own.
//
// Loaded where the battle may load them (loopback and the approved playtest
// destination); elsewhere `ready` resolves false and the preview keeps its
// drawn effects alone.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};
import {loadPublicRenderDescriptor} from '../publicRenderDescriptors.js';
import {isLocalBattleEffectPreview} from '../battleEffectArt.js';
import {isApprovedOriginalPublicLocation} from '../originalRuntimeLocation.js';
import {loadOriginalSharedVfxDescriptor, sharedVfxAtlasSources} from '../originalSharedVfxReview.js';

const TICK_MS = 1000 / 60;
const loopback = href => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(href).hostname); } catch { return false; } };

function loadImage(doc, src) {
  const image = doc.createElement('img');
  image.decoding = 'async';
  image.src = src;
  return typeof image.decode === 'function' ? image.decode().then(() => image) : Promise.resolve(image);
}

/** The first of an atlas's files that decodes (the web atlas offers webp before png): its URL. */
async function loadFirstImage(doc, sources) {
  let failure = null;
  for (const src of sources) {
    try { await loadImage(doc, src); return src; } catch (error) { failure = error; }
  }
  throw failure ?? new Error('SHOWCASE_ATLAS_UNAVAILABLE');
}

/**
 * Cells for the Dex preview. `nativeScale` is CSS px per native battle pixel.
 * `play(bankId, sequenceId, host, options)` appends one sprite to `host`,
 * anchored at the host's (0, 0) like the battle anchors its sprite.
 */
export function createShowcaseBankCells({doc = globalThis.document, href = globalThis.location?.href, fetchImpl = globalThis.fetch} = {}) {
  let disposed = false, base = null, shared = null;
  const baseUrl = doc?.baseURI ?? href;
  const allowed = Boolean(doc && href && typeof fetchImpl === 'function' && isLocalBattleEffectPreview(href));
  const sharedAllowed = allowed && new URL(href).searchParams.get('vfxOriginal') !== 'off' && (loopback(href) || isApprovedOriginalPublicLocation(href));
  const atlas = async (descriptor, revision = null) => {
    const url = await loadFirstImage(doc, sharedVfxAtlasSources(new URL(descriptor.image.src, baseUrl).href));
    const cells = new Map(descriptor.cells.map(cell => [`${cell.bankId}:${cell.cell}`, cell]));
    return {image: descriptor.image, url, cells, revision};
  };
  // Both atlases load side by side as soon as the Dex asks (non-blocking; the
  // preview starts at once when they are already in).
  const ready = !allowed ? Promise.resolve(false) : (async () => {
    try {
      const [own, remade] = await Promise.all([
        loadPublicRenderDescriptor('battle-effects', {baseUrl, fetchImpl}).then(d => atlas(d)),
        sharedAllowed ? loadOriginalSharedVfxDescriptor({href, baseUrl, fetchImpl}).then(r => atlas(r.descriptor, r.revision)).catch(() => null) : null
      ]);
      base = own; shared = remade;
      return !disposed;
    } catch { base = null; return false; }
  })();

  /** The frames of one native sequence with the atlas each cell comes from. */
  function frames(bankId, sequenceId) {
    const sequence = profiles.banks[(bankId | 0) - 1]?.sequences?.[sequenceId];
    if (!sequence || !base) return null;
    // The remakes replace whole sequences, so one sequence reads one atlas.
    const covers = sheet => sheet && sequence.frames.every(f => sheet.cells.has(`${bankId}:${f.cell}`));
    const source = covers(shared) ? shared : base;
    const list = sequence.frames.map(f => ({cell: source.cells.get(`${bankId}:${f.cell}`), ticks: Math.max(1, f.ticks)}));
    return list.every(f => f.cell) ? {source, list, loop: sequence.playbackMode === 2} : null;
  }

  function play(bankId, sequenceId, host, {nativeScale = 3, duration = null, flip = false, hue = 0, tint = 0xffffff} = {}) {
    if (disposed || !host) return null;
    const run = frames(bankId, sequenceId);
    if (!run) return null;
    const {source, list, loop} = run;
    const holder = doc.createElement('i');
    holder.className = 'cm-showcase__cell';
    holder.dataset.bank = String(bankId);
    holder.dataset.art = source !== shared ? 'battle-effects' : shared.revision === 'WEB_ATLAS_292' ? 'original-shared-292' : 'original-shared';
    if (flip) holder.style.transform = 'scaleX(-1)';
    // A name that contradicts the bank's colour turns its cells (unifiedMoveVfxResolver cellHue).
    if (hue) holder.style.filter = `hue-rotate(${Math.round(hue)}deg) saturate(1.15)`;
    // A bright bank on a moon move is pulled to violet (the battle multiplies its tint).
    else if (tint !== 0xffffff) holder.style.filter = 'sepia(1) saturate(2.2) hue-rotate(225deg) brightness(0.85)';
    const sprite = doc.createElement('i');
    holder.append(sprite);
    const total = list.reduce((sum, f) => sum + f.ticks, 0);
    const look = ({cell}) => {
      const k = nativeScale / cell.pixelsPerNativePixel;
      const [x, y, w, h] = cell.frame;
      return {left: `${-cell.origin[0] * k}px`, top: `${-cell.origin[1] * k}px`, width: `${w * k}px`, height: `${h * k}px`,
        backgroundPosition: `${-x * k}px ${-y * k}px`, backgroundSize: `${source.image.width * k}px ${source.image.height * k}px`,
        opacity: cell.blank ? 0 : 1};
    };
    sprite.style.backgroundImage = `url("${source.url}")`;
    Object.assign(sprite.style, look(list[0]));
    host.append(holder);
    if (typeof sprite.animate === 'function' && list.length > 1) {
      let at = 0;
      const keyframes = list.map(frame => { const offset = at / total; at += frame.ticks; return {...look(frame), offset, easing: 'step-end'}; });
      keyframes.push({...look(list.at(-1)), offset: 1});
      sprite.animate(keyframes, {duration: total * TICK_MS, iterations: loop ? Infinity : 1, fill: 'forwards'});
    }
    const lifetime = duration ?? (loop ? 600 : total * TICK_MS);
    holder.dataset.lifetime = String(Math.round(lifetime));
    return holder;
  }

  return Object.freeze({
    ready,
    play,
    /** True once the atlases are in and the sequence resolves to cells. */
    has: (bankId, sequenceId) => Boolean(frames(bankId, sequenceId)),
    getDiagnostics: () => Object.freeze({allowed, base: Boolean(base), shared: Boolean(shared), revision: shared?.revision ?? null, sharedUrl: shared?.url ?? null}),
    dispose() { disposed = true; base = null; shared = null; }
  });
}
