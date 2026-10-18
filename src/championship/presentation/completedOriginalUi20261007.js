import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';
// Owner 2026-10-07 local art intake. Display only; no gameplay or save writers.
import manifest from '../../data/championship/public-ui-selection.v1.json' with {type:'json'};
export function isOriginalUiIntakeLocal(baseUrl = globalThis.location?.href) {
  try { const url = new URL(baseUrl); return ['http:','https:'].includes(url.protocol)
    && ['localhost','127.0.0.1','[::1]'].includes(url.hostname); } catch { return false; }
}
export function originalMedalArt(titleId, baseUrl) {
  if (!isOriginalRuntimeLocation(baseUrl)) return null;
  // Display-only correction: donated motifs have new art at their former IDs.
  // Keep canonical title identity, acquisition and the original delivery intact.
  return manifest.medals.find(m=>m.titleId===titleId) ?? null;
}
export function originalDatabaseIcon(screen, baseUrl) {
  return isOriginalRuntimeLocation(baseUrl) ? manifest.database.find(c=>c.destination===screen) ?? null : null;
}
export function originalShopItemArt(recordIndex, baseUrl) {
  return isOriginalRuntimeLocation(baseUrl) ? manifest.items.find(a=>a.shopRecordIndex===recordIndex) ?? null : null;
}
export function originalCareItemArt(role, pose, baseUrl) {
  return isOriginalRuntimeLocation(baseUrl)
    ? manifest.items.find(a=>a.frame?.role===role && a.frame.pose===pose) ?? null : null;
}
export function originalToolbarArt(toolId, baseUrl) {
  if (!isOriginalRuntimeLocation(baseUrl)) return null;
  return manifest.toolbar.find(a=>a.role===toolId)
    ?? manifest.items.find(a=>a.assetId.endsWith('/'+toolId+'-rest')) ?? null;
}
