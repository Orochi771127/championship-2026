// OWNER_APPROVED_ADAPTATION 2026-10-19: repeated copies in the public playtest.
// Keep the original hash-locked catalog and native ownership reader unchanged.
import {getCageDefinitionByModuleId,ownedModuleIds as originalOwnedModuleIds} from './cageCatalog.js';

export function ownedModuleIds(stock = []) {
  return originalOwnedModuleIds(Array.isArray(stock) ? stock : stock?.cageOwned ?? []);
}

export function ownedModuleCount(moduleId, stock = []) {
  const definition = getCageDefinitionByModuleId(moduleId);
  if (!definition) return 0;
  if (definition.alwaysOwned) return 1;
  if (!Array.isArray(stock) && stock?.cageQuantities) {
    return stock.cageQuantities[definition.shopRecordIndex] ?? 0;
  }
  const legacy = Array.isArray(stock) ? stock : stock?.cageOwned ?? [];
  return legacy.includes(definition.shopRecordIndex) ? 1 : 0;
}
