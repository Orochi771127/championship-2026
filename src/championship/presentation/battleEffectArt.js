// Owner-supplied original cells for loopback research comparison. Numeric
// animation/collision remain in the existing pool. No generated-art fallback.
export const BATTLE_EFFECT_ART_MANIFEST = 'assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json';
export const BATTLE_EFFECT_ART_ID = 'art:vfx:battle-effects:local-reference:v1';

export function isLocalBattleEffectPreview(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

function requireProductionPath(value) {
  if (typeof value !== 'string' || !/^assets\/production\/[A-Za-z0-9_./-]+$/.test(value)
    || value.split('/').some(part => part === '..' || part === '.')) throw new Error('BATTLE_EFFECT_ART_PATH_INVALID');
}

export function validateBattleEffectArt(manifest, productionIndex) {
  const entry = productionIndex?.entries?.find(item => item.assetId === manifest?.assetId);
  if (manifest?.schemaVersion !== 1 || manifest.assetId !== BATTLE_EFFECT_ART_ID
    || !entry?.runtimeEligible || entry.manifestPath !== BATTLE_EFFECT_ART_MANIFEST
    || manifest.runtimeEligible !== true || manifest.rightsStatus !== 'ROM_COPYRIGHTED_REFERENCE'
    || entry.rightsStatus !== manifest.rightsStatus || manifest.gameplayBinding !== 'EXTERNAL_EXISTING_RUNTIME'
    || [manifest, entry].some(item => item.localOnly !== true || item.publicReleasePermitted !== false
      || item.shippingReady !== false || item.runtimeScope !== 'LOOPBACK_RESEARCH_ONLY')) {
    throw new Error('BATTLE_EFFECT_ART_NOT_REGISTERED');
  }
  requireProductionPath(manifest.image?.src);
  if (manifest.image.src !== BATTLE_EFFECT_ART_MANIFEST.replace('manifest.json', 'effects.png')
    || manifest.image.scaleMode !== 'nearest'
    || !/^[a-f0-9]{64}$/.test(manifest.image.sha256) || !Number.isInteger(manifest.image.width)
    || !Number.isInteger(manifest.image.height) || manifest.image.width < 1 || manifest.image.height < 1
    || !Array.isArray(manifest.cells) || !manifest.cells.length) throw new Error('BATTLE_EFFECT_ART_IMAGE_INVALID');
  const keys = new Set();
  for (const cell of manifest.cells) {
    const key = `${cell.bankId}:${cell.cell}`;
    const [x, y, width, height] = cell.frame ?? [];
    if (!Number.isInteger(cell.bankId) || cell.bankId < 1 || cell.bankId > 151
      || !Number.isInteger(cell.cell) || cell.cell < 0 || keys.has(key)
      || ![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1
      || x + width > manifest.image.width || y + height > manifest.image.height
      || !Array.isArray(cell.origin) || cell.origin.length !== 2 || !cell.origin.every(Number.isFinite)
      || !cell.origin.every(Number.isInteger) || cell.pixelsPerNativePixel !== 1
      || typeof cell.blank !== 'boolean' || !/^[a-f0-9]{64}$/.test(cell.sourceRgbaSha256)) {
      throw new Error(`BATTLE_EFFECT_ART_CELL_INVALID:${key}`);
    }
    keys.add(key);
  }
  return structuredClone(manifest);
}

export async function loadBattleEffectArt({PIXI, manifest, productionIndex, baseUrl = globalThis.location?.href}) {
  if (!isLocalBattleEffectPreview(baseUrl)) throw new Error('BATTLE_EFFECT_ART_LOCAL_PREVIEW_ONLY');
  const checked = validateBattleEffectArt(manifest, productionIndex);
  const texture = await PIXI.Assets.load(checked.image.src);
  const cells = new Map();
  let disposal;
  try {
    if (texture.width !== checked.image.width || texture.height !== checked.image.height) {
      throw new Error('BATTLE_EFFECT_ART_IMAGE_DIMENSIONS');
    }
    texture.source.scaleMode = 'nearest';
    for (const cell of checked.cells) {
      const frame = new PIXI.Texture({source:texture.source, frame:new PIXI.Rectangle(...cell.frame)});
      cells.set(`${cell.bankId}:${cell.cell}`, {...cell, texture:frame});
    }
  } catch (error) {
    for (const cell of cells.values()) cell.texture.destroy(false);
    await PIXI.Assets.unload(checked.image.src);
    throw error;
  }
  return {
    assetId:checked.assetId,
    getCell:(bankId, cell) => cells.get(`${bankId}:${cell}`) ?? null,
    dispose() {
      if (disposal) return disposal;
      for (const cell of cells.values()) cell.texture.destroy(false);
      cells.clear();
      disposal = Promise.resolve(PIXI.Assets.unload(checked.image.src));
      return disposal;
    }
  };
}

export async function loadRegisteredBattleEffectArt({PIXI, baseUrl, fetchImpl = globalThis.fetch}) {
  if (!isLocalBattleEffectPreview(baseUrl)) return null;
  const indexResponse = await fetchImpl(new URL('assets/production/ART_PRODUCTION_INDEX.json', baseUrl));
  if (!indexResponse.ok) throw new Error(`BATTLE_EFFECT_INDEX_HTTP_${indexResponse.status}`);
  const productionIndex = await indexResponse.json();
  if (!productionIndex.entries?.some(entry => entry.assetId === BATTLE_EFFECT_ART_ID && entry.runtimeEligible)) return null;
  const response = await fetchImpl(new URL(BATTLE_EFFECT_ART_MANIFEST, baseUrl));
  if (!response.ok) throw new Error(`BATTLE_EFFECT_MANIFEST_HTTP_${response.status}`);
  return loadBattleEffectArt({PIXI, manifest:await response.json(), productionIndex, baseUrl});
}
