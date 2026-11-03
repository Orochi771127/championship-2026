// OWNER_APPROVED_ADAPTATION 2026-11-03: the gachapon royal cages became their own maps.
// Saves from 2026-11-02 placed a royal cage as its base cage (牧場 / 動物園 module) with
// its edition recorded by instance id. This moves each such placement onto its own module,
// keeping the instance id (so its edition, residents, food and droppings stay with it), on
// the free four-hex footprint nearest the old one: the most old cells reused first, then
// the shortest move. Pure; the caller re-homes positions inside the moved cages.
import { getCageDefinitionByModuleId, getGachaCageDefinitionByEdition } from './productCageCatalog.js';
import { PRODUCT_RANCH_COLUMNS, PRODUCT_RANCH_ROWS, productGridCell, productGridSlot, productPlacementCells } from './productRanchGrid.js';

export function migrateRoyalCagePlacements(placements, editions) {
  const list = (placements ?? []).map((p) => ({ ...p }));
  const moved = [];
  const owner = new Map();
  for (const p of list) for (const slot of productPlacementCells(p) ?? []) owner.set(slot, p.instanceId);
  for (const p of list) {
    const target = getGachaCageDefinitionByEdition(editions?.[p.instanceId]);
    const base = getCageDefinitionByModuleId(p.moduleId);
    if (!target || !base || base.cageDefinitionIndex !== target.ruleDefinitionIndex) continue;
    const old = new Set(productPlacementCells(p) ?? []);
    const at = productGridCell(p.slotIndex);
    let best = null;
    for (let row = 0; row < PRODUCT_RANCH_ROWS; row++) for (let column = 0; column < PRODUCT_RANCH_COLUMNS; column++) {
      const slotIndex = productGridSlot(row, column);
      const cells = productPlacementCells({ moduleId: target.moduleId, slotIndex });
      if (!cells || cells.some((slot) => owner.has(slot) && owner.get(slot) !== p.instanceId)) continue;
      const reused = cells.filter((slot) => old.has(slot)).length;
      const cell = productGridCell(slotIndex), distance = (cell.x - at.x) ** 2 + (cell.y - at.y) ** 2;
      if (!best || reused > best.reused || (reused === best.reused && distance < best.distance)) best = { slotIndex, cells, reused, distance };
    }
    if (!best) continue;
    for (const slot of old) owner.delete(slot);
    for (const slot of best.cells) owner.set(slot, p.instanceId);
    moved.push(Object.freeze({ instanceId: p.instanceId, from: p.moduleId, to: target.moduleId, fromSlot: p.slotIndex, toSlot: best.slotIndex }));
    p.moduleId = target.moduleId;
    p.slotIndex = best.slotIndex;
  }
  return Object.freeze({ placements: list, moved: Object.freeze(moved) });
}
