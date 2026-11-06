// Build-time transport only. Source/dev imports have no external delivery;
// the explicit external-character build injects its verified immutable release.
// Character IDs, logical paths, manifests and animation bytes stay unchanged.
const compiledDelivery = typeof __CM_CHARACTER_DELIVERY__ === 'undefined' ? null : __CM_CHARACTER_DELIVERY__;
export const CHARACTER_ASSET_PREFIX = 'assets/production/characters/';
const GAME_ORIGIN = 'https://orochi771127.github.io';
const GAME_BASE_PATH = '/championship-2026/';
const safePath = value => typeof value === 'string' && /^[A-Za-z0-9_.\/-]+$/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..');

export function validateCharacterAssetDelivery(value) {
  if (value === null) return null;
  if (!value || value.schemaVersion !== 1 || value.assetPrefix !== CHARACTER_ASSET_PREFIX
    || Object.keys(value).some(key => !['schemaVersion', 'assetPrefix', 'assetBaseUrl'].includes(key)))
    throw Error('CHARACTER_ASSET_DELIVERY_SCHEMA');
  let base;
  try { base = new URL(value.assetBaseUrl); } catch { throw Error('CHARACTER_ASSET_DELIVERY_URL'); }
  if (base.origin !== GAME_ORIGIN || base.username || base.password || base.search || base.hash
    || !/^\/cyber-partner-runtime-assets\/v\/[a-f0-9]{40}\/$/.test(base.pathname)
    || base.href !== value.assetBaseUrl) throw Error('CHARACTER_ASSET_DELIVERY_URL');
  return Object.freeze({...value});
}

/** Maps only character paths on the approved game page; local/QA paths stay local. */
export function createCharacterAssetResolver(value) {
  const delivery = validateCharacterAssetDelivery(value);
  return function resolveCharacterAssetSrc(src, pageUrl = globalThis.location?.href) {
    if (!delivery || !pageUrl) return src;
    let page;
    try { page = new URL(pageUrl?.href ?? pageUrl); } catch { return src; }
    if (page.origin !== GAME_ORIGIN || !page.pathname.startsWith(GAME_BASE_PATH)
      || page.username || page.password) return src;
    const raw = src instanceof URL ? src.href : src;
    if (typeof raw !== 'string') throw Error('CHARACTER_ASSET_SOURCE_URL');
    // Reject normalization tricks before URL parsing hides dot segments.
    if (raw.includes(CHARACTER_ASSET_PREFIX)
      && (/[\\\0]/.test(raw) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw) || /%/i.test(raw)))
      throw Error('CHARACTER_ASSET_SOURCE_PATH');
    const url = new URL(raw, page);
    const logicalPrefix = GAME_BASE_PATH + CHARACTER_ASSET_PREFIX;
    if (url.origin !== GAME_ORIGIN || !url.pathname.startsWith(logicalPrefix)) return src;
    const relative = url.pathname.slice(GAME_BASE_PATH.length);
    if (!safePath(relative) || url.search || url.hash || url.username || url.password)
      throw Error('CHARACTER_ASSET_SOURCE_PATH');
    return new URL(relative, delivery.assetBaseUrl).href;
  };
}

export const characterAssetSrc = createCharacterAssetResolver(compiledDelivery);
export const characterAssetUrl = (src, pageUrl = globalThis.location?.href) =>
  new URL(characterAssetSrc(src, pageUrl), pageUrl).href;
