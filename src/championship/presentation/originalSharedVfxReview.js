// Opt-in loopback review of original-created shared battle VFX. Whole native
// sequences of the existing effect pool are drawn with original cells; the pool,
// sequence ticks, play modes, collision, damage and every other bank stay on the
// loaded art. Cells keep their own size and anchor at 4 raster px per native px.
//
// Battle text popups (bank 1 text sequences) come in localized sets selected by the
// GAME SETTING locale, never the browser language: Chinese -> zh-Hant, Japanese -> ja,
// every other language -> en. Only the active set's atlas is loaded; a settings change
// swaps the set in place and the previous atlas is released after the scene has drawn.
import profiles from '../../data/championship/battleEffectProfiles.json' with {type:'json'};
import {getLocale as settingLocale, onLocaleChange as onSettingLocaleChange} from '../text/locale.js';
export const ORIGINAL_SHARED_VFX_ID = 'art:vfx:original-shared:review:v1';
export const ORIGINAL_SHARED_VFX_MANIFEST = 'assets/production/vfx/original-shared-review-v1/manifest.json';
export const ORIGINAL_SHARED_VFX_QUERY = ['vfxOriginal', 'shared-v1'];
export const ORIGINAL_SHARED_BEAM_MANIFEST = 'assets/production/vfx/original-shared-beam-seamfix-r1/manifest.json';
export const ORIGINAL_SHARED_157_MANIFEST = 'assets/production/vfx/original-shared-review-157-seamfix-r1/manifest.json';
export const ORIGINAL_SHARED_LOCAL_MANIFEST = 'assets/production/vfx/original-shared-review-210-seamfix-r1/manifest.json';
export function originalSharedVfxManifestFor(href) {
  const query = new URL(href).searchParams;
  if (query.get('vfxCandidate') === 'beam-body-seamfix-r1') return ORIGINAL_SHARED_BEAM_MANIFEST;
  if (query.get('vfxRevision') === '157-seamfix') return ORIGINAL_SHARED_157_MANIFEST;
  return query.get('vfxRevision') === '157-baseline' ? ORIGINAL_SHARED_VFX_MANIFEST : ORIGINAL_SHARED_LOCAL_MANIFEST;
}
export const ORIGINAL_SHARED_TEXT_SETS = Object.freeze(['zh-Hant', 'ja', 'en']);
const DENSITY = 4;
const loopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
const sha256 = value => /^[a-f0-9]{64}$/.test(value);

/** Game-setting locale -> text set. */
export function originalTextSetFor(locale) {
  const tag = String(locale ?? '').toLowerCase();
  if (tag === 'zh' || tag.startsWith('zh-')) return 'zh-Hant';
  if (tag === 'ja' || tag.startsWith('ja-')) return 'ja';
  return 'en';
}

// Releases a retired text atlas only after two animation frames: the battle scene
// reassigns every live sprite's texture from getCell() before each render.
function afterTwoFrames(run) {
  let cancelled = false, id = 0;
  const raf = globalThis.requestAnimationFrame;
  if (typeof raf === 'function') {
    id = raf(() => { id = raf(() => { if (!cancelled) run(); }); });
    return () => { cancelled = true; globalThis.cancelAnimationFrame?.(id); };
  }
  const timer = setTimeout(() => { if (!cancelled) run(); }, 50);
  return () => { cancelled = true; clearTimeout(timer); };
}

function validateLocalizedText(text, mainCells) {
  if (text === undefined) return null;
  const dir = ORIGINAL_SHARED_VFX_MANIFEST.replace('manifest.json', '');
  const profile = profiles.banks[(text?.bankId ?? 0) - 1];
  if (text?.schema !== 'LOCALIZED_TEXT_CELLS_V1' || !profile || profile.id !== text.bankId
    || text.selection?.source !== 'GAME_SETTING_LOCALE' || text.timing !== 'NATIVE_SEQUENCES_UNCHANGED'
    || !Array.isArray(text.sequences) || !text.sequences.length || !Array.isArray(text.cells)) {
    throw new Error('ORIGINAL_SHARED_TEXT_INVALID');
  }
  // Whole native sequences, exactly their cells, none shared with another sequence or the main package.
  const played = new Set();
  for (const id of text.sequences) for (const frame of profile.sequences[id]?.frames ?? [null]) {
    if (!frame) throw new Error(`ORIGINAL_SHARED_TEXT_SEQUENCE:${id}`);
    played.add(frame.cell);
  }
  const sorted = list => JSON.stringify([...list].sort((a, b) => a - b));
  if (sorted(played) !== sorted(text.cells) || profile.sequences.some(s => !text.sequences.includes(s.id) && s.frames.some(f => played.has(f.cell)))
    || text.cells.some(cell => mainCells.has(`${text.bankId}:${cell}`))) {
    throw new Error('ORIGINAL_SHARED_TEXT_COVERAGE');
  }
  if (sorted(Object.keys(text.sets ?? {}).map(n => ORIGINAL_SHARED_TEXT_SETS.indexOf(n))) !== sorted([0, 1, 2])) {
    throw new Error('ORIGINAL_SHARED_TEXT_SETS');
  }
  for (const [name, set] of Object.entries(text.sets)) {
    const image = set.image;
    if (image?.src !== `${dir}text-${name}.png` || image.scaleMode !== 'nearest' || !sha256(image.sha256)
      || ![image.width, image.height].every(v => Number.isInteger(v) && v > 0)) throw new Error(`ORIGINAL_SHARED_TEXT_IMAGE:${name}`);
    const seen = new Set();
    for (const cell of set.cells ?? []) {
      const [x, y, width, height] = cell.frame ?? [], [ox, oy] = cell.origin ?? [];
      // The native cell rectangle comes from the runtime profile, not from the manifest.
      const [highX, highY, lowX, lowY] = profile.boxes[cell.cell] ?? [];
      if (cell.bankId !== text.bankId || !played.has(cell.cell) || seen.has(cell.cell) || cell.pixelsPerNativePixel !== DENSITY
        || cell.blank !== false || !sha256(cell.rgbaSha256) || ![x, y, width, height, ox, oy].every(Number.isInteger)
        || x < 0 || y < 0 || width < 1 || height < 1 || x + width > image.width || y + height > image.height
        || ox > -lowX * DENSITY || oy > -lowY * DENSITY || width - ox > highX * DENSITY || height - oy > highY * DENSITY) {
        throw new Error(`ORIGINAL_SHARED_TEXT_CELL_INVALID:${name}:${cell.cell}`);
      }
      seen.add(cell.cell);
    }
    if (seen.size !== played.size) throw new Error(`ORIGINAL_SHARED_TEXT_CELLS_MISSING:${name}`);
  }
  return text;
}

export function originalSharedVfxReviewRequested(href) {
  try {
    const url = new URL(href);
    return ['http:', 'https:'].includes(url.protocol) && loopback(url.hostname)
      && url.searchParams.get(ORIGINAL_SHARED_VFX_QUERY[0]) === ORIGINAL_SHARED_VFX_QUERY[1];
  } catch { return false; }
}

export function validateOriginalSharedVfx(manifest, productionIndex, {manifestPath = ORIGINAL_SHARED_VFX_MANIFEST} = {}) {
  if (![ORIGINAL_SHARED_VFX_MANIFEST, ORIGINAL_SHARED_BEAM_MANIFEST, ORIGINAL_SHARED_157_MANIFEST, ORIGINAL_SHARED_LOCAL_MANIFEST].includes(manifestPath)) throw new Error('ORIGINAL_SHARED_VFX_PATH_INVALID');
  const entry = productionIndex?.entries?.find(item => item.assetId === ORIGINAL_SHARED_VFX_ID);
  if (manifest?.schemaVersion !== 1 || manifest.assetId !== ORIGINAL_SHARED_VFX_ID
    || entry?.manifestPath !== ORIGINAL_SHARED_VFX_MANIFEST || entry.rightsStatus !== 'ORIGINAL_CREATED'
    || manifest.rightsStatus !== 'ORIGINAL_CREATED' || manifest.gameplayBinding !== 'EXTERNAL_EXISTING_RUNTIME'
    || manifest.timing !== 'NATIVE_SEQUENCES_UNCHANGED' || manifest.blend !== 'NORMAL_ALPHA'
    || manifest.pixelsPerNativePixel !== DENSITY
    || [manifest, entry].some(item => item.reviewOnly !== true || item.runtimeEligible !== false
      || item.localOnly !== true || item.runtimeScope !== 'LOOPBACK_REVIEW_ONLY' || item.publicReleasePermitted !== false
      || item.shippingReady !== false || item.humanApproved !== false)) {
    throw new Error('ORIGINAL_SHARED_VFX_NOT_REGISTERED');
  }
  const image = manifest.image;
  if (image?.src !== manifestPath.replace('manifest.json', 'effects.png') || image.scaleMode !== 'nearest'
    || !/^[a-f0-9]{64}$/.test(image.sha256) || ![image.width, image.height].every(v => Number.isInteger(v) && v > 0)) {
    throw new Error('ORIGINAL_SHARED_VFX_IMAGE_INVALID');
  }
  const cells = new Map();
  for (const cell of manifest.cells ?? []) {
    const key = `${cell.bankId}:${cell.cell}`;
    const [x, y, width, height] = cell.frame ?? [];
    if (cells.has(key) || ![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1
      || x + width > image.width || y + height > image.height || cell.pixelsPerNativePixel !== DENSITY
      || !Array.isArray(cell.origin) || cell.origin.length !== 2 || !cell.origin.every(Number.isInteger)
      || typeof cell.blank !== 'boolean' || !/^[a-f0-9]{64}$/.test(cell.rgbaSha256)) {
      throw new Error(`ORIGINAL_SHARED_VFX_CELL_INVALID:${key}`);
    }
    cells.set(key, cell);
  }
  // A bank entry replaces complete native sequences: exactly the cells those
  // sequences play, none shared with a sequence that keeps the loaded art.
  const covered = new Set();
  for (const bank of manifest.banks ?? []) {
    const profile = profiles.banks[bank.bankId - 1];
    if (!profile || profile.id !== bank.bankId || profile.name !== bank.family || !bank.sequences?.length) {
      throw new Error(`ORIGINAL_SHARED_VFX_BANK_INVALID:${bank.bankId}`);
    }
    const played = new Set(), kept = new Set();
    for (const sequence of profile.sequences) {
      for (const frame of sequence.frames) (bank.sequences.includes(sequence.id) ? played : kept).add(frame.cell);
    }
    if (bank.sequences.some(id => !profile.sequences[id]) || [...played].some(cell => kept.has(cell))
      || JSON.stringify([...played].sort((a, b) => a - b)) !== JSON.stringify([...bank.cells].sort((a, b) => a - b))
      || bank.cells.some(cell => !cells.has(`${bank.bankId}:${cell}`))) {
      throw new Error(`ORIGINAL_SHARED_VFX_SEQUENCE_COVERAGE:${bank.bankId}`);
    }
    for (const cell of bank.cells) covered.add(`${bank.bankId}:${cell}`);
  }
  if (covered.size !== cells.size) throw new Error('ORIGINAL_SHARED_VFX_UNBOUND_CELLS');
  validateLocalizedText(manifest.localizedText, cells);
  return structuredClone(manifest);
}

/** Wraps an already loaded battle effect art (same getCell/dispose contract). */
export async function loadOriginalSharedVfxReview({PIXI, baseArt, href = globalThis.location?.href,
  baseUrl = globalThis.document?.baseURI ?? href, fetchImpl = globalThis.fetch, onFirstUse = null,
  getLocale = settingLocale, onLocaleChange = onSettingLocaleChange, deferRelease = afterTwoFrames, onTextSet = null}) {
  if (!baseArt || !originalSharedVfxReviewRequested(href)) return baseArt;
  const indexResponse = await fetchImpl(new URL('assets/production/ART_PRODUCTION_INDEX.json', baseUrl));
  if (!indexResponse.ok) throw new Error(`ORIGINAL_SHARED_VFX_INDEX_HTTP_${indexResponse.status}`);
  // A separate local review choice; the saved 157-cell artwork stays unchanged.
  const candidate = new URL(href).searchParams.get('vfxCandidate') === 'beam-body-seamfix-r1';
  const manifestPath = originalSharedVfxManifestFor(href);
  const response = await fetchImpl(new URL(manifestPath, baseUrl));
  if (!response.ok) throw new Error(`ORIGINAL_SHARED_VFX_MANIFEST_HTTP_${response.status}`);
  const checked = validateOriginalSharedVfx(await response.json(), await indexResponse.json(), {manifestPath});
  const text = checked.localizedText ?? null;
  for (const cell of [...checked.cells, ...(text ? text.cells.map(id => ({bankId:text.bankId, cell:id, blank:false})) : [])]) {
    // The native blank state is the visibility truth; a remake never fills or empties a cell.
    const reference = baseArt.getCell(cell.bankId, cell.cell);
    if (!reference || reference.blank !== cell.blank) throw new Error(`ORIGINAL_SHARED_VFX_BLANK_DRIFT:${cell.bankId}:${cell.cell}`);
  }
  const texture = await PIXI.Assets.load(checked.image.src);
  const cells = new Map(), seen = new Set();
  try {
    if (texture.width !== checked.image.width || texture.height !== checked.image.height) {
      throw new Error('ORIGINAL_SHARED_VFX_IMAGE_DIMENSIONS');
    }
    texture.source.scaleMode = 'nearest';
    for (const cell of checked.cells) {
      cells.set(`${cell.bankId}:${cell.cell}`, {...cell, artSource:'ORIGINAL_SHARED_REVIEW',
        texture:new PIXI.Texture({source:texture.source, frame:new PIXI.Rectangle(...cell.frame)})});
    }
  } catch (error) {
    for (const cell of cells.values()) cell.texture.destroy(false);
    await PIXI.Assets.unload(checked.image.src);
    throw error;
  }
  let disposal;
  // ---- localized text sets: one active atlas, swapped on a settings change
  let textActive = null, textRequested = null, textActivations = 0, unsubscribe = null;
  const textRetiring = new Map(), textPending = new Map();
  async function loadTextSet(name) {
    const set = text.sets[name], atlas = await PIXI.Assets.load(set.image.src);
    if (atlas.width !== set.image.width || atlas.height !== set.image.height) {
      await PIXI.Assets.unload(set.image.src);
      throw new Error(`ORIGINAL_SHARED_TEXT_IMAGE_DIMENSIONS:${name}`);
    }
    atlas.source.scaleMode = 'nearest';
    return {name, src:set.image.src, sha256:set.image.sha256, cells:new Map(set.cells.map(cell => [cell.cell,
      {...cell, artSource:'ORIGINAL_SHARED_TEXT', textSet:name,
        texture:new PIXI.Texture({source:atlas.source, frame:new PIXI.Rectangle(...cell.frame)})}]))};
  }
  function releaseTextSet(entry) {
    for (const cell of entry.cells.values()) cell.texture.destroy(false);
    return PIXI.Assets.unload(entry.src);
  }
  function retire(entry) {
    textRetiring.set(entry.name, {entry, cancel:deferRelease(() => {
      if (textRetiring.get(entry.name)?.entry !== entry) return;
      textRetiring.delete(entry.name); void releaseTextSet(entry);
    })});
  }
  async function useTextSet(name) {
    textRequested = name;
    if (disposal || textActive?.name === name) return;
    if (textPending.has(name)) return textPending.get(name);
    const job = (async () => {
      let next;
      const retiring = textRetiring.get(name);
      if (retiring) { retiring.cancel(); textRetiring.delete(name); next = retiring.entry; }
      else next = await loadTextSet(name);
      if (disposal) { await releaseTextSet(next); return; }
      if (textRequested !== name) { retire(next); return; }   // a later settings change won
      const previous = textActive;
      textActive = next; textActivations++;
      if (previous) retire(previous);
      onTextSet?.(name);
    })().finally(() => textPending.delete(name));
    textPending.set(name, job);
    return job;
  }
  if (text) {
    try {
      await useTextSet(originalTextSetFor(getLocale()));
    } catch (error) {
      for (const cell of cells.values()) cell.texture.destroy(false);
      await PIXI.Assets.unload(checked.image.src);
      throw error;
    }
    unsubscribe = onLocaleChange(locale => {
      useTextSet(originalTextSetFor(locale)).catch(error => console.warn('Original text set unavailable', error));
    });
  }
  return {
    assetId:baseArt.assetId,
    reviewAssetId:ORIGINAL_SHARED_VFX_ID,
    getCell(bankId, cell) {
      if (text && bankId === text.bankId && textActive?.cells.has(cell)) {
        const key = `${bankId}:${cell}@${textActive.name}`;
        if (!seen.has(key)) { seen.add(key); onFirstUse?.(key, [...seen]); }
        return textActive.cells.get(cell);
      }
      const key = `${bankId}:${cell}`, own = cells.get(key);
      if (!own) return baseArt.getCell(bankId, cell);
      if (!seen.has(key)) { seen.add(key); onFirstUse?.(key, [...seen]); }
      return own;
    },
    getReviewDiagnostics:() => ({reviewAssetId:ORIGINAL_SHARED_VFX_ID, banks:checked.banks.map(bank => bank.bankId),
      cells:cells.size, seenCells:[...seen], manifestPath, revision:checked.provenance?.localRevision ?? checked.provenance?.revision, candidate:candidate ? 'beam-body-seamfix-r1' : null,
      text:text ? {source:'GAME_SETTING_LOCALE', set:textActive?.name ?? null, requested:textRequested, src:textActive?.src ?? null,
        sha256:textActive?.sha256 ?? null, activations:textActivations, retiring:[...textRetiring.keys()], cells:text.cells.length} : null}),
    dispose() {
      if (disposal) return disposal;
      unsubscribe?.();
      for (const cell of cells.values()) cell.texture.destroy(false);
      cells.clear();
      const releases = [PIXI.Assets.unload(checked.image.src)];
      for (const {entry, cancel} of textRetiring.values()) { cancel(); releases.push(releaseTextSet(entry)); }
      textRetiring.clear();
      if (textActive) { releases.push(releaseTextSet(textActive)); textActive = null; }
      disposal = Promise.allSettled([...releases, ...textPending.values(), baseArt.dispose()]).then(() => undefined);
      return disposal;
    }
  };
}
