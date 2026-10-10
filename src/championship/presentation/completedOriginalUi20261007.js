import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';
// Owner 2026-10-07 local art intake. Display only; no gameplay or save writers.
import manifest from '../../../assets/production/original-ui-intake-20261007/manifest.json' with {type:'json'};
import toolbarCandidate from '../../../assets/production/original-ui-intake-20261007/toolbar-point64-r1-20261009/manifest.json' with {type:'json'};
export function isOriginalUiIntakeLocal(baseUrl = globalThis.location?.href) {
  try { const url = new URL(baseUrl); return ['http:','https:'].includes(url.protocol)
    && ['localhost','127.0.0.1','[::1]'].includes(url.hostname); } catch { return false; }
}
export function originalMedalArt(titleId, baseUrl) {
  return isOriginalRuntimeLocation(baseUrl) ? manifest.medals.find(m=>m.titleId===titleId) ?? null : null;
}
export function originalDatabaseIcon(screen, baseUrl) {
  return isOriginalRuntimeLocation(baseUrl) ? manifest.database.find(c=>c.destination===screen && c.bindingEvidence!=='UNKNOWN_REQUIRES_TRACE') ?? null : null;
}
export function originalShopItemArt(recordIndex, baseUrl) {
  return isOriginalRuntimeLocation(baseUrl) ? manifest.items.find(a=>a.shopRecordIndex===recordIndex) ?? null : null;
}
export function originalToolbarArt(toolId, baseUrl) {
  if (!isOriginalRuntimeLocation(baseUrl)) return null;
  return toolbarCandidate.assets.find(a=>a.role===toolId)
    ?? manifest.items.find(a=>a.assetId.endsWith('/'+toolId+'-rest')) ?? null;
}
