// OWNER_APPROVED_ADAPTATION, 2026-10-15: one continuous 10×5 ranch.
// Stable IDs preserve every native/annex placement anchor. This is not ROM
// geometry, a 50-bit JS bitmask, a purchase, or an expansion of native tables.
import { getCageDefinitionByModuleId } from './cageCatalog.js';
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from './ranchSlotGeometry.js';
import { NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, validateNativeRanch } from './nativeRanchLayout.js';

export const PRODUCT_RANCH_GRID = 'PRODUCT_GRID50_V1';
export const PRODUCT_RANCH_COLUMNS = 10;
export const PRODUCT_RANCH_ROWS = 5;
export const PRODUCT_RANCH_SLOT_COUNT = 50;
export const PUBLIC_TEST_RANCH_ACCESS = 'PUBLIC_TEST_DIAMOND_ROW_PURCHASE';
export const PRODUCT_RANCH_WORLD_WIDTH = 960;
export const PRODUCT_RANCH_WORLD_HEIGHT = 440;

export function productGridCell(slotIndex) {
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= 50) throw new RangeError('PRODUCT_RANCH_SLOT_OUT_OF_RANGE');
  const row = slotIndex < 40 ? Math.floor(slotIndex / 20) * 2 + slotIndex % 2 : 4;
  const column = slotIndex < 40 ? Math.floor((slotIndex % 20) / 2) : slotIndex - 40;
  return { slotIndex, row, column, x: column * 96 + (row % 2) * 48, y: row * 88 };
}
export function productGridSlot(row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= 5 || column < 0 || column >= 10) return null;
  return row === 4 ? 40 + column : Math.floor(row / 2) * 20 + column * 2 + row % 2;
}
export function productFieldTileOrigin(slotIndex, shapeIndex) {
  const cell = productGridCell(slotIndex), shape = ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex];
  if (shape === undefined) throw new RangeError('PRODUCT_RANCH_SHAPE_OUT_OF_RANGE');
  const tileY = (cell.y - 24) / 8;
  return { tileX:(cell.x + ((shape & 1) ? 0 : 48)) / 8, tileY, cropTopTiles:Math.max(0,-tileY) };
}
export function productPlacementCells(entry) {
  const definition = getCageDefinitionByModuleId(entry?.moduleId);
  if (!definition || !Number.isSafeInteger(entry.slotIndex) || entry.slotIndex < 0 || entry.slotIndex >= 50) return null;
  const anchor = productGridCell(entry.slotIndex);
  const shape = ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]];
  const cells = [];
  for (let bit = 0; bit < 8; bit++) if (shape & (1 << bit)) {
    const dr = bit % 2;
    const row = anchor.row + dr;
    const column = anchor.column + Math.floor(bit / 2) + (anchor.row % 2 && dr ? 1 : 0);
    const slot = productGridSlot(row, column);
    if (slot === null) return null;
    cells.push(slot);
  }
  return cells;
}
export function validateProductRanch(placements, unlockedSlots = null) {
  if (!Array.isArray(placements)) return false;
  const available = unlockedSlots == null ? null : new Set(unlockedSlots);
  const occupied = new Set(), modules = new Set();
  for (const entry of placements) {
    const cells = productPlacementCells(entry);
    if (!cells || modules.has(entry.moduleId)) return false;
    if (entry.moduleId === WAITING_ROOM_MODULE && entry.slotIndex !== 0) return false;
    if (cells.some(cell => occupied.has(cell) || (available && !available.has(cell)))) return false;
    for (const cell of cells) occupied.add(cell);
    modules.add(entry.moduleId);
  }
  return modules.has(WAITING_ROOM_MODULE);
}

// Persist historical access separately from the temporary public-test override.
// Purchased rows stay empty until a future explicitly approved purchase flow.
export function normalizeProductRanchAccess(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
      Object.keys(raw).some(key => !['version', 'legacyUnlockedSlots', 'purchasedRows', 'testUnlockedRows', 'legacyGrants'].includes(key)) ||
      !Array.isArray(raw.legacyUnlockedSlots) || !Array.isArray(raw.purchasedRows) || !Array.isArray(raw.testUnlockedRows)) throw new Error('INVALID_PRODUCT_RANCH_ACCESS');
  const legacyGrants = raw.legacyGrants ?? [];
  if (!Array.isArray(legacyGrants) || legacyGrants.some(grant=>!['NATIVE_RANK_CELLS_TEST_OPEN_V1','ANNEX10_GEOMETRY_GRANDFATHER_V1'].includes(grant)) || new Set(legacyGrants).size!==legacyGrants.length) throw new Error('INVALID_PRODUCT_RANCH_LEGACY_GRANTS');
  const legacyUnlockedSlots = [...raw.legacyUnlockedSlots], purchasedRows = [...raw.purchasedRows], testUnlockedRows = [...raw.testUnlockedRows];
  if (legacyUnlockedSlots.some(slot => !Number.isSafeInteger(slot) || slot < 0 || slot >= 40) ||
      new Set(legacyUnlockedSlots).size !== legacyUnlockedSlots.length ||
      purchasedRows.some(row => !Number.isInteger(row) || row < 2 || row >= 5) ||
      new Set(purchasedRows).size !== purchasedRows.length || testUnlockedRows.some(row=>!Number.isInteger(row)||row<0||row>=5) || new Set(testUnlockedRows).size !== testUnlockedRows.length) throw new Error('INVALID_PRODUCT_RANCH_ACCESS');
  return { version: 1, legacyUnlockedSlots: legacyUnlockedSlots.sort((a,b)=>a-b), purchasedRows: purchasedRows.sort((a,b)=>a-b), testUnlockedRows:testUnlockedRows.sort((a,b)=>a-b), legacyGrants:[...legacyGrants] };
}
export function productUnlockedSlots(access, mainUnlocked, testAccessOverride = null) {
  const normalized = normalizeProductRanchAccess(access);
  const slots = new Set(normalized.legacyUnlockedSlots);
  for (let slot = 0; slot < Math.min(20, Math.max(0, mainUnlocked)); slot++) slots.add(slot);
  // Test grants remain separate, persisted, and never silently revoked by a
  // deployment. Commercial handling needs a later explicit owner policy.
  for (const row of [...normalized.purchasedRows, ...normalized.testUnlockedRows]) for (let col = 0; col < 10; col++) slots.add(productGridSlot(row, col));
  return [...slots].sort((a,b)=>a-b);
}

export function migrateProductRanch(snapshot, mainUnlocked = 20) {
  if (snapshot?.layoutVersion === PRODUCT_RANCH_GRID) {
    if (!validateProductRanch(snapshot.placements)) throw new Error('INVALID_PRODUCT_RANCH');
    return { layoutVersion: PRODUCT_RANCH_GRID, gridAccess: normalizeProductRanchAccess(snapshot.gridAccess),
      placements: snapshot.placements.map(p=>({ moduleId:p.moduleId, slotIndex:p.slotIndex })) };
  }
  const native = snapshot?.layoutVersion === NATIVE_RANCH_LAYOUT;
  const expanded = snapshot?.layoutVersion === 'NATIVE_DECKS_V1';
  if (!native && !expanded) throw new Error('LEGACY_SINGLE_CELL_RANCH_MIGRATION_REQUIRED');
  // The caller validates native/expanded entitlements before conversion. New
  // geometry must ALSO preserve the exact footprint without overlap.
  if (!validateProductRanch(snapshot.placements) || (native && !validateNativeRanch(snapshot.placements, mainUnlocked))) throw new Error('INVALID_PRODUCT_RANCH_MIGRATION');
  const annexCount = expanded ? snapshot.expansion?.decks * 10 : 0;
  if (expanded && (![10,20].includes(annexCount) || snapshot.expansion?.version !== 1 || snapshot.expansion?.grant !== 'PROTOTYPE_NON_PAID')) throw new Error('INVALID_PRODUCT_RANCH_LEGACY_GRANT');
  if (!Number.isInteger(mainUnlocked) || ![14,16,18,20].includes(mainUnlocked)) throw new Error('INVALID_PRODUCT_RANCH_LEGACY_RANK');
  if (!validateNativeRanch(snapshot.placements.filter(p=>p.slotIndex < 20), mainUnlocked)) throw new Error('INVALID_PRODUCT_RANCH_MIGRATION');
  for (const p of snapshot.placements.filter(p=>p.slotIndex >= 20)) {
    const definition = getCageDefinitionByModuleId(p.moduleId);
    const shape = ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]];
    if (!expanded || p.slotIndex >= 20 + annexCount || ((shape & 0xaa) && (p.slotIndex & 1)) ||
      productPlacementCells(p).some(slot=>slot < 20 || slot >= 20 + annexCount)) throw new Error('INVALID_PRODUCT_RANCH_MIGRATION');
  }
  const legacyUnlockedSlots = [...Array.from({length:20},(_,i)=>i), ...Array.from({length:expanded ? 20 : 0},(_,i)=>20+i)];
  return { layoutVersion:PRODUCT_RANCH_GRID, gridAccess:{version:1,legacyUnlockedSlots,purchasedRows:[],testUnlockedRows:[],legacyGrants:['NATIVE_RANK_CELLS_TEST_OPEN_V1',...(annexCount===10?['ANNEX10_GEOMETRY_GRANDFATHER_V1']:[])]},
    placements:snapshot.placements.map(p=>({moduleId:p.moduleId,slotIndex:p.slotIndex})) };
}
