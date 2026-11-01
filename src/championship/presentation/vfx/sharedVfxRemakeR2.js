// Remake r2 of the shared battle effects (OWNER_APPROVED_ADAPTATION 2026-11-01,
// VFX_FIVE_LAYER_20261101): original cells for eleven more banks, drawn by
// scripts/build-shared-vfx-remake-r2.py with no image input. Like the 210-cell
// pack it replaces WHOLE native sequences; the native effect VM still owns
// every tick, position, scale, fade and collision.
//
// Review scope: LOOPBACK only (ART_PRODUCTION_INDEX: art:vfx:original-shared:
// remake-r2:v1, humanApproved false). The approved public playtest keeps the
// 210-cell selection until the Owner approves this revision for publication.
// ?vfxRemake=off keeps the loaded art.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type: 'json'};

export const SHARED_VFX_REMAKE_R2_ID = 'art:vfx:original-shared:remake-r2:v1';
export const SHARED_VFX_REMAKE_R2_MANIFEST = 'assets/production/vfx/original-shared-remake-r2-20261101/manifest.json';
const DENSITY = 4;
const loopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

/** Loopback review only, and not when ?vfxRemake=off. */
export function sharedVfxRemakeAllowed(href = globalThis.location?.href) {
  try {
    const url = new URL(href);
    return ['http:', 'https:'].includes(url.protocol) && loopback(url.hostname) && url.searchParams.get('vfxRemake') !== 'off';
  } catch { return false; }
}

/** Whole-sequence coverage, frame bounds and density; returns a clone. */
export function validateSharedVfxRemake(manifest) {
  const fail = reason => { throw new Error(`SHARED_VFX_REMAKE_${reason}`); };
  if (manifest?.schemaVersion !== 1 || manifest.assetId !== SHARED_VFX_REMAKE_R2_ID || manifest.rightsStatus !== 'ORIGINAL_CREATED'
    || manifest.timing !== 'NATIVE_SEQUENCES_UNCHANGED' || manifest.pixelsPerNativePixel !== DENSITY) fail('CONTRACT');
  const image = manifest.image;
  if (image?.src !== SHARED_VFX_REMAKE_R2_MANIFEST.replace('manifest.json', 'effects.png') || image.scaleMode !== 'nearest'
    || !/^[a-f0-9]{64}$/.test(image.sha256 ?? '') || ![image.width, image.height].every(v => Number.isInteger(v) && v > 0)) fail('IMAGE');
  const cells = new Map();
  for (const cell of manifest.cells ?? []) {
    const key = `${cell.bankId}:${cell.cell}`, [x, y, w, h] = cell.frame ?? [];
    if (cells.has(key) || ![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1
      || x + w > image.width || y + h > image.height || cell.pixelsPerNativePixel !== DENSITY || typeof cell.blank !== 'boolean'
      || !Array.isArray(cell.origin) || !cell.origin.every(Number.isInteger)) fail(`CELL:${key}`);
    cells.set(key, cell);
  }
  const covered = new Set();
  for (const bank of manifest.banks ?? []) {
    const profile = profiles.banks[bank.bankId - 1];
    if (!profile || profile.id !== bank.bankId || profile.name !== bank.family) fail(`BANK:${bank.bankId}`);
    const played = new Set(), kept = new Set();
    for (const sequence of profile.sequences) for (const frame of sequence.frames) (bank.sequences.includes(sequence.id) ? played : kept).add(frame.cell);
    if ([...played].some(cell => kept.has(cell)) || [...played].some(cell => !cells.has(`${bank.bankId}:${cell}`))) fail(`COVERAGE:${bank.bankId}`);
    for (const cell of played) covered.add(`${bank.bankId}:${cell}`);
  }
  if (covered.size !== cells.size) fail('UNBOUND_CELLS');
  return structuredClone(manifest);
}

async function fetchManifest(baseUrl, fetchImpl) {
  const response = await fetchImpl(new URL(SHARED_VFX_REMAKE_R2_MANIFEST, baseUrl).href);
  if (!response.ok) throw new Error(`SHARED_VFX_REMAKE_MANIFEST_HTTP_${response.status}`);
  return validateSharedVfxRemake(await response.json());
}

/** Wraps a loaded battle effect art (same getCell/dispose contract); returns baseArt when not allowed. */
export async function loadSharedVfxRemakeR2({PIXI, baseArt, href = globalThis.location?.href,
  baseUrl = globalThis.document?.baseURI ?? href, fetchImpl = globalThis.fetch}) {
  if (!baseArt || !sharedVfxRemakeAllowed(href) || typeof fetchImpl !== 'function') return baseArt;
  const checked = await fetchManifest(baseUrl, fetchImpl);
  for (const cell of checked.cells) {
    // A remake never fills or empties a native cell.
    const reference = baseArt.getCell(cell.bankId, cell.cell);
    if (!reference || reference.blank !== cell.blank) throw new Error(`SHARED_VFX_REMAKE_BLANK_DRIFT:${cell.bankId}:${cell.cell}`);
  }
  const src = new URL(checked.image.src, baseUrl).href;
  const texture = await PIXI.Assets.load(src);
  if (texture.width !== checked.image.width || texture.height !== checked.image.height) {
    await PIXI.Assets.unload(src);
    throw new Error('SHARED_VFX_REMAKE_IMAGE_DIMENSIONS');
  }
  texture.source.scaleMode = 'nearest';
  const cells = new Map(checked.cells.map(cell => [`${cell.bankId}:${cell.cell}`, {...cell, artSource: 'ORIGINAL_SHARED_REMAKE_R2',
    texture: new PIXI.Texture({source: texture.source, frame: new PIXI.Rectangle(...cell.frame)})}]));
  const seen = new Set();
  let disposal = null;
  return {
    ...baseArt,
    assetId: baseArt.assetId,
    remakeAssetId: SHARED_VFX_REMAKE_R2_ID,
    getCell(bankId, cell) {
      const key = `${bankId}:${cell}`, own = cells.get(key);
      if (!own) return baseArt.getCell(bankId, cell);
      seen.add(key);
      return own;
    },
    getRemakeDiagnostics: () => ({assetId: SHARED_VFX_REMAKE_R2_ID, banks: checked.banks.map(bank => bank.bankId), cells: cells.size, seenCells: [...seen]}),
    dispose() {
      if (disposal) return disposal;
      for (const cell of cells.values()) cell.texture.destroy(false);
      cells.clear();
      disposal = Promise.allSettled([PIXI.Assets.unload(src), baseArt.dispose()]).then(() => undefined);
      return disposal;
    }
  };
}

/** The remake atlas for DOM sprites (Dex preview): {url, image, cells}; null when not allowed. */
export async function loadSharedVfxRemakeAtlas({href = globalThis.location?.href, baseUrl = href, fetchImpl = globalThis.fetch} = {}) {
  if (!sharedVfxRemakeAllowed(href) || typeof fetchImpl !== 'function') return null;
  const checked = await fetchManifest(baseUrl, fetchImpl);
  return {url: new URL(checked.image.src, baseUrl).href, image: checked.image,
    cells: new Map(checked.cells.map(cell => [`${cell.bankId}:${cell.cell}`, cell]))};
}
