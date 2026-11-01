// Original-only effect cells for views outside the AI battle (Data Arena)
// (OWNER_APPROVED_ADAPTATION 2026-11-01, VFX_FIVE_LAYER_20261101).
//
// The AI battle wraps the ROM reference atlas with the remade cells. This
// loader takes the remade cells ONLY: the public 210-cell selection
// (shared-vfx render descriptor) or, on loopback review, the 292-cell web
// atlas (one texture, webp first). No ROM
// pixel is loaded, so a sequence plays here only when every cell of it is
// original. Destinations follow the 210-cell selection's own approval:
// loopback and the approved public playtest URL.
import {isApprovedOriginalPublicLocation} from '../originalRuntimeLocation.js';
import {loadOriginalSharedVfxDescriptor, loadSharedVfxAtlasTexture} from '../originalSharedVfxReview.js';
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};

const loopback = href => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(href).hostname); } catch { return false; } };

export function originalVfxCellArtAllowed(href = globalThis.location?.href) {
  try {
    return new URL(href).searchParams.get('vfxOriginal') !== 'off' && (loopback(href) || isApprovedOriginalPublicLocation(href));
  } catch { return false; }
}

/** {getCell, has(bankId, sequenceId), dispose, getDiagnostics} or null when not allowed or unavailable. */
export async function loadOriginalVfxCellArt({PIXI, href = globalThis.location?.href, baseUrl = globalThis.document?.baseURI ?? href,
  fetchImpl = globalThis.fetch} = {}) {
  if (!PIXI || !originalVfxCellArtAllowed(href)) return null;
  const {descriptor, revision} = await loadOriginalSharedVfxDescriptor({href, baseUrl, fetchImpl});
  const source = revision === 'WEB_ATLAS_292' ? 'ORIGINAL_SHARED_292' : 'ORIGINAL_SHARED_210';
  const {texture, src} = await loadSharedVfxAtlasTexture(PIXI, new URL(descriptor.image.src, baseUrl).href);
  const cells = new Map();
  try {
    if (texture.width !== descriptor.image.width || texture.height !== descriptor.image.height) throw new Error('ORIGINAL_VFX_CELL_ART_DIMENSIONS');
    texture.source.scaleMode = 'nearest';
    for (const cell of descriptor.cells) cells.set(`${cell.bankId}:${cell.cell}`, {...cell, artSource: source,
      texture: new PIXI.Texture({source: texture.source, frame: new PIXI.Rectangle(...cell.frame)})});
  } catch (error) {
    for (const cell of cells.values()) cell.texture.destroy(false);
    await PIXI.Assets.unload(src);
    throw error;
  }
  let disposal = null;
  return Object.freeze({
    getCell: (bankId, cell) => cells.get(`${bankId}:${cell}`) ?? null,
    /** True when every frame of the native sequence has an original cell. */
    has(bankId, sequenceId) {
      const sequence = profiles.banks[(bankId | 0) - 1]?.sequences?.[sequenceId];
      return Boolean(sequence?.frames.every(f => cells.has(`${bankId}:${f.cell}`)));
    },
    getDiagnostics: () => Object.freeze({cells: cells.size, sheets: [source], src}),
    dispose() {
      if (disposal) return disposal;
      for (const cell of cells.values()) cell.texture.destroy(false);
      cells.clear();
      disposal = Promise.allSettled([PIXI.Assets.unload(src)]).then(() => undefined);
      return disposal;
    }
  });
}
