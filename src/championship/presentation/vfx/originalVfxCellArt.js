// Original-only effect cells for views outside the AI battle (Data Arena)
// (OWNER_APPROVED_ADAPTATION 2026-11-01, VFX_FIVE_LAYER_20261101).
//
// The AI battle wraps the ROM reference atlas with the remade cells. This
// loader takes the remade cells ONLY: the public 210-cell selection
// (shared-vfx render descriptor) and, on loopback review, remake r2. No ROM
// pixel is loaded, so a sequence plays here only when every cell of it is
// original. Destinations follow the 210-cell selection's own approval:
// loopback and the approved public playtest URL.
import {loadPublicRenderDescriptor} from '../publicRenderDescriptors.js';
import {isApprovedOriginalPublicLocation} from '../originalRuntimeLocation.js';
import {loadSharedVfxRemakeAtlas} from './sharedVfxRemakeR2.js';
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
  const sheets = [];
  const shared = await loadPublicRenderDescriptor('shared-vfx', {baseUrl, fetchImpl});
  sheets.push({src: new URL(shared.image.src, baseUrl).href, image: shared.image, cells: shared.cells, source: 'ORIGINAL_SHARED_210'});
  const remake = await loadSharedVfxRemakeAtlas({href, baseUrl, fetchImpl}).catch(() => null);
  if (remake) sheets.push({src: remake.url, image: remake.image, cells: [...remake.cells.values()], source: 'ORIGINAL_SHARED_REMAKE_R2'});
  const cells = new Map(), loaded = [];
  try {
    for (const sheet of sheets) {
      const texture = await PIXI.Assets.load(sheet.src);
      loaded.push(sheet.src);
      texture.source.scaleMode = 'nearest';
      // A later sheet (remake r2) overrides an earlier one cell by cell.
      for (const cell of sheet.cells) cells.set(`${cell.bankId}:${cell.cell}`, {...cell, artSource: sheet.source,
        texture: new PIXI.Texture({source: texture.source, frame: new PIXI.Rectangle(...cell.frame)})});
    }
  } catch (error) {
    for (const cell of cells.values()) cell.texture.destroy(false);
    await Promise.allSettled(loaded.map(src => PIXI.Assets.unload(src)));
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
    getDiagnostics: () => Object.freeze({cells: cells.size, sheets: sheets.map(s => s.source)}),
    dispose() {
      if (disposal) return disposal;
      for (const cell of cells.values()) cell.texture.destroy(false);
      cells.clear();
      disposal = Promise.allSettled(loaded.map(src => PIXI.Assets.unload(src))).then(() => undefined);
      return disposal;
    }
  });
}
