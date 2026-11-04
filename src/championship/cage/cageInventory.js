// OWNER_APPROVED_ADAPTATION 2026-10-19: repeated copies in the public playtest.
// Keep the original hash-locked catalog and native ownership reader unchanged.
import { ownedModuleIds as originalOwnedModuleIds } from './cageCatalog.js';
import { getCageDefinitionByModuleId } from './productCageCatalog.js';

// Owner 2026-11-03: the gachapon royal cages are their own modules; a stock object may
// carry their counts as gachaCages {moduleId: copies} (bag + placed, from the gachapon).
export function ownedModuleIds(stock = []) {
  const owned = originalOwnedModuleIds(Array.isArray(stock) ? stock : stock?.cageOwned ?? []);
  if (!Array.isArray(stock)) for (const [moduleId, count] of Object.entries(stock?.gachaCages ?? {})) if (count > 0) owned.add(moduleId);
  return owned;
}

export function ownedModuleCount(moduleId, stock = []) {
  const definition = getCageDefinitionByModuleId(moduleId);
  if (!definition) return 0;
  if (definition.alwaysOwned) return 1;
  if (definition.gachaEdition) return Array.isArray(stock) ? 0 : Math.max(0, stock?.gachaCages?.[moduleId] ?? 0);
  if (!Array.isArray(stock) && stock?.cageQuantities) {
    return stock.cageQuantities[definition.shopRecordIndex] ?? 0;
  }
  const legacy = Array.isArray(stock) ? stock : stock?.cageOwned ?? [];
  return legacy.includes(definition.shopRecordIndex) ? 1 : 0;
}
