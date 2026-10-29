// OWNER_APPROVED_ADAPTATION, 2026-10-26: the hex cage world.
// Cages keep their original multi-cell shape masks and are placed freely on an
// open honeycomb lattice; the world has no wrap and holds at most 100 cells in
// total. Empty positions are not ground. Each placement keeps its own stable
// instance id, anchor slot and type, so editing, counting and saving stay per
// cage while navigation and presentation follow connected regions
// (ranchConnections.js).
//
// History: PRODUCT_GRID50_V1 (2026-10-15) → PRODUCT_GRID100_INSTANCES_V1
// (2026-10-19, a wrapping 10×10 board) → PRODUCT_HEX_WORLD_V1 (this file).
// Older layouts migrate forward; the 10×10 geometry below is kept only for that.
import { getCageDefinitionByModuleId } from './cageCatalog.js';
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from './ranchSlotGeometry.js';
import { NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, validateNativeRanch } from './nativeRanchLayout.js';

export const LEGACY_PRODUCT_RANCH_GRID = 'PRODUCT_GRID50_V1';
export const LEGACY_PRODUCT_RANCH_GRID100 = 'PRODUCT_GRID100_INSTANCES_V1';
export const PRODUCT_RANCH_GRID = 'PRODUCT_HEX_WORLD_V1';
export const PRODUCT_RANCH_LAYOUTS = Object.freeze([PRODUCT_RANCH_GRID, LEGACY_PRODUCT_RANCH_GRID100, LEGACY_PRODUCT_RANCH_GRID]);

// Lattice of possible positions. Only placed cells count toward the cap.
export const PRODUCT_RANCH_COLUMNS = 24;
export const PRODUCT_RANCH_ROWS = 24;
export const PRODUCT_RANCH_SLOT_COUNT = PRODUCT_RANCH_COLUMNS * PRODUCT_RANCH_ROWS;
export const PRODUCT_RANCH_CELL_CAP = 100;
export const PUBLIC_TEST_RANCH_ACCESS = 'PUBLIC_TEST_DIAMOND_ROW_PURCHASE';
export const PRODUCT_RANCH_WORLD_WIDTH = PRODUCT_RANCH_COLUMNS * 96 + 48;
export const PRODUCT_RANCH_WORLD_HEIGHT = PRODUCT_RANCH_ROWS * 88 + 24;

// Where the 10×10 board lands in the world. An even row shift keeps every
// row's honeycomb parity, so multi-cell footprints keep their exact shape.
export const LEGACY_GRID100_ROW_OFFSET = 8;
export const LEGACY_GRID100_COLUMN_OFFSET = 7;
export const PRODUCT_WAITING_ROOM_SLOT = LEGACY_GRID100_ROW_OFFSET * PRODUCT_RANCH_COLUMNS + LEGACY_GRID100_COLUMN_OFFSET;

const slotInRange = (slot) => Number.isSafeInteger(slot) && slot >= 0 && slot < PRODUCT_RANCH_SLOT_COUNT;

export function productGridCell(slotIndex) {
  if (!slotInRange(slotIndex)) throw new RangeError('PRODUCT_RANCH_SLOT_OUT_OF_RANGE');
  const row = Math.floor(slotIndex / PRODUCT_RANCH_COLUMNS), column = slotIndex % PRODUCT_RANCH_COLUMNS;
  return { slotIndex, row, column, x: column * 96 + (row % 2) * 48, y: row * 88 };
}
export function productGridSlot(row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= PRODUCT_RANCH_ROWS || column < 0 || column >= PRODUCT_RANCH_COLUMNS) return null;
  return row * PRODUCT_RANCH_COLUMNS + column;
}
export function productFieldTileOrigin(slotIndex, shapeIndex) {
  const cell = productGridCell(slotIndex), shape = ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex];
  if (shape === undefined) throw new RangeError('PRODUCT_RANCH_SHAPE_OUT_OF_RANGE');
  const tileY = (cell.y - 24) / 8;
  return { tileX:(cell.x + ((shape & 1) ? 0 : 48)) / 8, tileY, cropTopTiles:Math.max(0,-tileY) };
}
function footprint(entry, cellOf, slotOf, inRange) {
  const definition = getCageDefinitionByModuleId(entry?.moduleId);
  if (!definition || !inRange(entry.slotIndex)) return null;
  const anchor = cellOf(entry.slotIndex);
  if (entry.rotation !== undefined && entry.rotation !== 0) return null;
  const shape = ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]];
  const cells = [];
  for (let bit = 0; bit < 8; bit++) if (shape & (1 << bit)) {
    const dr = bit % 2;
    const row = anchor.row + dr;
    const column = anchor.column + Math.floor(bit / 2) + (anchor.row % 2 && dr ? 1 : 0);
    const slot = slotOf(row, column);
    if (slot === null) return null;
    cells.push(slot);
  }
  return cells;
}
/** Every lattice slot a placement covers (its original shape mask), or null. */
export function productPlacementCells(entry) {
  return footprint(entry, productGridCell, productGridSlot, slotInRange);
}

const neighbourSlots = (slot) => {
  const { row, column } = productGridCell(slot), odd = row % 2;
  return [[row, column - 1], [row, column + 1], [row - 1, column - 1 + odd], [row - 1, column + odd], [row + 1, column - 1 + odd], [row + 1, column + odd]]
    .map(([r, c]) => productGridSlot(r, c)).filter((s) => s !== null);
};

/**
 * Where a cage lands when the player taps one hex (Owner 2026-10-29). Eight
 * original shapes (健身房, 研究所, 森林, 醫院, 花園, 冰原, 牧場, 擂台) leave their
 * anchor hex empty, so using the tapped hex as the anchor put the cage one hex
 * right of the tap. Every footprint cell is tried on the tapped hex instead,
 * computed on the lattice itself so odd and even rows keep the same shape. The
 * top-left cell wins when it fits; otherwise the free fit that touches the most
 * neighbouring cage edges. Adjacency is never refused. `ignoreInstanceId` is
 * the cage being moved (its own cells count as free).
 * Returns { ok, slotIndex (the anchor), cells, conflicts, contact } or, when no
 * cell of the shape can sit on the tapped hex inside the world, null.
 */
export function productFitPlacement(placements, moduleId, targetSlot, { ignoreInstanceId = null } = {}) {
  if (!slotInRange(targetSlot) || !getCageDefinitionByModuleId(moduleId)) return null;
  const owner = new Map();
  for (const p of placements ?? []) {
    if (ignoreInstanceId !== null && p.instanceId === ignoreInstanceId) continue;
    for (const slot of productPlacementCells(p) ?? []) owner.set(slot, p.instanceId ?? p.moduleId);
  }
  const target = productGridCell(targetSlot), fits = [];
  // A shape spans two rows and at most four columns, so its anchor is near.
  for (let row = target.row - 1; row <= target.row; row++) for (let column = target.column - 4; column <= target.column; column++) {
    const anchor = productGridSlot(row, column);
    const cells = anchor === null ? null : productPlacementCells({ moduleId, slotIndex: anchor });
    if (!cells?.includes(targetSlot)) continue;
    const order = cells.map(productGridCell).sort((a, b) => a.y - b.y || a.x - b.x).findIndex((c) => c.slotIndex === targetSlot);
    const conflicts = cells.filter((slot) => owner.has(slot));
    let contact = 0;
    for (const slot of cells) for (const n of neighbourSlots(slot)) if (owner.has(n) && !cells.includes(n)) contact++;
    fits.push({ ok: conflicts.length === 0, slotIndex: anchor, cells, conflicts, contact, order });
  }
  if (!fits.length) return null;
  fits.sort((a, b) => a.order - b.order);
  const free = fits.filter((f) => f.ok);
  const best = free[0]?.order === 0 ? free[0]
    : free.length ? free.reduce((a, b) => (b.contact > a.contact ? b : a))
      : fits.reduce((a, b) => (b.conflicts.length < a.conflicts.length ? b : a));
  const { order, ...fit } = best;
  return fit;
}

/**
 * Why a layout is invalid, or null. `capacity` is the player's land (cells);
 * the world never holds more than PRODUCT_RANCH_CELL_CAP cells.
 */
export function productRanchProblem(placements, capacity = PRODUCT_RANCH_CELL_CAP) {
  if (!Array.isArray(placements)) return 'INVALID';
  const limit = Math.min(PRODUCT_RANCH_CELL_CAP, Number.isFinite(capacity) ? capacity : PRODUCT_RANCH_CELL_CAP);
  const occupied = new Set(), modules = new Set();
  let waitingCount = 0;
  for (const entry of placements) {
    const cells = productPlacementCells(entry);
    const identity = entry?.instanceId ?? entry?.moduleId;
    if (!cells) return 'OUT_OF_BOUNDS';
    if (modules.has(identity) || (entry.instanceId !== undefined && !/^[a-z0-9:_-]{3,96}$/i.test(entry.instanceId))) return 'DUPLICATE_INSTANCE';
    if (entry.moduleId === WAITING_ROOM_MODULE && ++waitingCount > 1) return 'DUPLICATE_WAITING_ROOM';
    if (cells.some(cell => occupied.has(cell))) return 'OCCUPIED';
    for (const cell of cells) occupied.add(cell);
    modules.add(identity);
  }
  if (occupied.size > limit) return limit < PRODUCT_RANCH_CELL_CAP ? 'LAND_CAPACITY' : 'CELL_CAP';
  return waitingCount === 1 ? null : 'WAITING_ROOM_REQUIRED';
}
/** Valid hex world. A legacy positional unlock list only counts as land capacity. */
export function validateProductRanch(placements, capacity = PRODUCT_RANCH_CELL_CAP) {
  return productRanchProblem(placements, Array.isArray(capacity) ? capacity.length : capacity ?? PRODUCT_RANCH_CELL_CAP) === null;
}
export function productOccupiedCellCount(placements) {
  return placements.reduce((sum, p) => sum + (productPlacementCells(p)?.length ?? 0), 0);
}

// ---------------------------------------------------------------- land access
// Land is bought or granted as rows of the old 10×10 board. In the hex world
// those rows are a capacity: every opened position is one placeable cell.

// Persist historical access separately from the temporary public-test override.
export function normalizeProductRanchAccess(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
      Object.keys(raw).some(key => !['version', 'legacyUnlockedSlots', 'purchasedRows', 'testUnlockedRows', 'legacyGrants'].includes(key)) ||
      !Array.isArray(raw.legacyUnlockedSlots) || !Array.isArray(raw.purchasedRows) || !Array.isArray(raw.testUnlockedRows)) throw new Error('INVALID_PRODUCT_RANCH_ACCESS');
  const legacyGrants = raw.legacyGrants ?? [];
  if (!Array.isArray(legacyGrants) || legacyGrants.some(grant=>!['NATIVE_RANK_CELLS_TEST_OPEN_V1','ANNEX10_GEOMETRY_GRANDFATHER_V1'].includes(grant)) || new Set(legacyGrants).size!==legacyGrants.length) throw new Error('INVALID_PRODUCT_RANCH_LEGACY_GRANTS');
  const legacyUnlockedSlots = [...raw.legacyUnlockedSlots], purchasedRows = [...raw.purchasedRows], testUnlockedRows = [...raw.testUnlockedRows];
  if (legacyUnlockedSlots.some(slot => !Number.isSafeInteger(slot) || slot < 0 || slot >= 40) ||
      new Set(legacyUnlockedSlots).size !== legacyUnlockedSlots.length ||
      purchasedRows.some(row => !Number.isInteger(row) || row < 2 || row >= LEGACY_GRID100_ROWS) ||
      new Set(purchasedRows).size !== purchasedRows.length || testUnlockedRows.some(row=>!Number.isInteger(row)||row<0||row>=LEGACY_GRID100_ROWS) || new Set(testUnlockedRows).size !== testUnlockedRows.length) throw new Error('INVALID_PRODUCT_RANCH_ACCESS');
  return { version: 1, legacyUnlockedSlots: legacyUnlockedSlots.sort((a,b)=>a-b), purchasedRows: purchasedRows.sort((a,b)=>a-b), testUnlockedRows:testUnlockedRows.sort((a,b)=>a-b), legacyGrants:[...legacyGrants] };
}
/** Opened land positions on the old 10×10 board (legacy indices; counted, not placed on). */
export function productUnlockedSlots(access, mainUnlocked, testAccessOverride = null) {
  const normalized = normalizeProductRanchAccess(access);
  const slots = new Set(normalized.legacyUnlockedSlots);
  for (let slot = 0; slot < Math.min(20, Math.max(0, mainUnlocked)); slot++) slots.add(slot);
  for (const row of [...normalized.purchasedRows, ...normalized.testUnlockedRows]) for (let col = 0; col < 10; col++) slots.add(legacyGrid100Slot(row, col));
  return [...slots].sort((a,b)=>a-b);
}
/** Placeable cells for this player: opened land, never above the world cap. */
export function productLandCapacity(access, mainUnlocked, testAccessOverride = null) {
  return Math.min(PRODUCT_RANCH_CELL_CAP, productUnlockedSlots(access, mainUnlocked, testAccessOverride).length);
}
/** Land rows that can still be bought (each opens 10 more cells). */
export function productLockedLandRows(access, mainUnlocked) {
  const open = new Set(productUnlockedSlots(access, mainUnlocked));
  const rows = [];
  for (let row = 2; row < LEGACY_GRID100_ROWS; row++) {
    const locked = Array.from({length:10},(_,col)=>legacyGrid100Slot(row,col)).filter(slot=>!open.has(slot)).length;
    if (locked) rows.push({ row, cells: locked });
  }
  return rows;
}

// ---------------------------------------------------------------- migration

export function migrateProductRanch(snapshot, mainUnlocked = 20) {
  if (snapshot?.layoutVersion === PRODUCT_RANCH_GRID) {
    const gridAccess = normalizeProductRanchAccess(snapshot.gridAccess);
    if (snapshot.placements.some(p => p.rotation)) throw new Error('INVALID_PRODUCT_RANCH');
    return { layoutVersion: PRODUCT_RANCH_GRID, gridAccess, nextInstanceSequence: snapshot.nextInstanceSequence ?? 1,
      placements: snapshot.placements.map(p => ({ moduleId:p.moduleId, slotIndex:p.slotIndex,
        instanceId:p.instanceId ?? `cage:legacy:${getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex}` })) };
  }
  return grid100ToHexWorld(migrateToLegacyGrid100(snapshot, mainUnlocked));
}

/** Lay a 10×10 snapshot into the world at a fixed offset; footprints keep their shape. */
export function grid100ToHexWorld(snapshot) {
  const placements = snapshot.placements.map(p => {
    const cell = legacyGrid100Cell(p.slotIndex);
    return { ...p, slotIndex: productGridSlot(cell.row + LEGACY_GRID100_ROW_OFFSET, cell.column + LEGACY_GRID100_COLUMN_OFFSET) };
  });
  return { layoutVersion: PRODUCT_RANCH_GRID, gridAccess: snapshot.gridAccess,
    nextInstanceSequence: snapshot.nextInstanceSequence ?? 1, placements };
}

/** Map one legacy 10×10 slot to its world slot (used by saved per-cage records). */
export function legacyGrid100SlotToWorld(slotIndex) {
  const cell = legacyGrid100Cell(slotIndex);
  return productGridSlot(cell.row + LEGACY_GRID100_ROW_OFFSET, cell.column + LEGACY_GRID100_COLUMN_OFFSET);
}

// ---------------------------------------------------------------- legacy 10×10 board (migration only)

export const LEGACY_GRID100_COLUMNS = 10;
export const LEGACY_GRID100_ROWS = 10;
export const LEGACY_GRID100_SLOT_COUNT = 100;

export function legacyGrid100Cell(slotIndex) {
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= LEGACY_GRID100_SLOT_COUNT) throw new RangeError('PRODUCT_RANCH_SLOT_OUT_OF_RANGE');
  const row = slotIndex < 40 ? Math.floor(slotIndex / 20) * 2 + slotIndex % 2 : 4 + Math.floor((slotIndex - 40) / 10);
  const column = slotIndex < 40 ? Math.floor((slotIndex % 20) / 2) : (slotIndex - 40) % 10;
  return { slotIndex, row, column, x: column * 96 + (row % 2) * 48, y: row * 88 };
}
export function legacyGrid100Slot(row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= LEGACY_GRID100_ROWS || column < 0 || column >= LEGACY_GRID100_COLUMNS) return null;
  return row >= 4 ? 40 + (row - 4) * 10 + column : Math.floor(row / 2) * 20 + column * 2 + row % 2;
}
export function legacyGrid100PlacementCells(entry) {
  return footprint(entry, legacyGrid100Cell, legacyGrid100Slot, slot => Number.isSafeInteger(slot) && slot >= 0 && slot < LEGACY_GRID100_SLOT_COUNT);
}
function validateLegacyCells(placements, unlockedSlots, readCells) {
  if (!Array.isArray(placements)) return false;
  const available = unlockedSlots == null ? null : new Set(unlockedSlots);
  const occupied = new Set(), modules = new Set();
  let waitingCount=0;
  for (const entry of placements) {
    const cells = readCells(entry);
    const identity=entry.instanceId ?? entry.moduleId;
    if (!cells || modules.has(identity) || (entry.instanceId !== undefined && !/^[a-z0-9:_-]{3,96}$/i.test(entry.instanceId))) return false;
    if(entry.moduleId===WAITING_ROOM_MODULE && ++waitingCount>1)return false;
    if (entry.moduleId === WAITING_ROOM_MODULE && entry.slotIndex !== 0) return false;
    if (cells.some(cell => occupied.has(cell) || (available && !available.has(cell)))) return false;
    for (const cell of cells) occupied.add(cell);
    modules.add(identity);
  }
  return waitingCount===1;
}
export function validateLegacyGrid100(placements, unlockedSlots = null) {
  return validateLegacyCells(placements, unlockedSlots, legacyGrid100PlacementCells);
}

// Read-only compatibility for the cancelled local rotation prototype.
function legacyRotationCells(entry) {
  const rotation = entry?.rotation ?? 0;
  if (!Number.isInteger(rotation) || rotation < 0 || rotation > 5) return null;
  if (!rotation) return legacyGrid100PlacementCells(entry);
  const definition = getCageDefinitionByModuleId(entry?.moduleId);
  if (!definition || entry.moduleId === WAITING_ROOM_MODULE ||
      !Number.isSafeInteger(entry.slotIndex) || entry.slotIndex < 0 || entry.slotIndex >= 100) return null;
  const mask = ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]];
  const source = [];
  for (let bit = 0; bit < 8; bit++) if (mask & (1 << bit)) source.push([Math.floor(bit / 2), bit % 2]);
  const [pq, pr] = source[0], anchor = legacyGrid100Cell(entry.slotIndex);
  const cells = source.map(([q, r]) => {
    q -= pq; r -= pr;
    for (let step = 0; step < rotation; step++) [q, r] = [-r, q + r];
    const row = anchor.row + r + pr;
    return legacyGrid100Slot(row, anchor.column - Math.floor(anchor.row / 2) + q + pq + Math.floor(row / 2));
  });
  return cells.includes(null) ? null : cells;
}

/** Legacy 10×10 placements with any prototype rotation resolved onto fixed shapes. */
export function restoreFixedRanchPlacements(placements, unlockedSlots) {
  const hasRotation = Array.isArray(placements) && placements.some(p => p.rotation);
  if (!validateLegacyCells(placements, hasRotation ? unlockedSlots : null, legacyRotationCells)) {
    throw new Error('INVALID_PRODUCT_RANCH');
  }
  const fixed = p => ({moduleId:p.moduleId, slotIndex:p.slotIndex, ...(p.instanceId ? {instanceId:p.instanceId} : {})});
  if (!hasRotation) return placements.map(fixed);
  const result = placements.filter(p => !p.rotation).map(fixed);
  const occupied = new Set(result.flatMap(legacyGrid100PlacementCells));
  const available = new Set(unlockedSlots);
  for (const entry of placements.filter(p => p.rotation)) {
    const start = legacyGrid100Cell(entry.slotIndex);
    const candidates = [...available].sort((a,b) => {
      const distance = slot => {const p=legacyGrid100Cell(slot); return (p.x-start.x)**2+(p.y-start.y)**2;};
      return distance(a)-distance(b) || a-b;
    });
    for (const slotIndex of candidates) {
      const candidate = {...fixed(entry), slotIndex}, cells = legacyGrid100PlacementCells(candidate);
      if (!cells || cells.some(slot => !available.has(slot) || occupied.has(slot))) continue;
      result.push(candidate); cells.forEach(slot => occupied.add(slot)); break;
    }
  }
  const byIdentity = new Map(result.map(p => [p.instanceId ?? p.moduleId, p]));
  return placements.flatMap(p => byIdentity.has(p.instanceId ?? p.moduleId) ? [byIdentity.get(p.instanceId ?? p.moduleId)] : []);
}

/** Any pre-hex-world snapshot → a validated 10×10 GRID100 snapshot. */
export function migrateToLegacyGrid100(snapshot, mainUnlocked = 20) {
  if ([LEGACY_PRODUCT_RANCH_GRID100,LEGACY_PRODUCT_RANCH_GRID].includes(snapshot?.layoutVersion)) {
    if(snapshot.layoutVersion===LEGACY_PRODUCT_RANCH_GRID && snapshot.placements.some(p=>p.slotIndex>=50))throw new Error('INVALID_LEGACY_PRODUCT_RANCH');
    const gridAccess = normalizeProductRanchAccess(snapshot.gridAccess);
    const placements = restoreFixedRanchPlacements(snapshot.placements, productUnlockedSlots(gridAccess, mainUnlocked));
    return { layoutVersion: LEGACY_PRODUCT_RANCH_GRID100, gridAccess,
      nextInstanceSequence:snapshot.nextInstanceSequence ?? 1,
      placements: placements.map(p=>({ moduleId:p.moduleId, slotIndex:p.slotIndex, instanceId:p.instanceId ?? `cage:legacy:${getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex}` })) };
  }
  const native = snapshot?.layoutVersion === NATIVE_RANCH_LAYOUT;
  const expanded = snapshot?.layoutVersion === 'NATIVE_DECKS_V1';
  if (!native && !expanded) throw new Error('LEGACY_SINGLE_CELL_RANCH_MIGRATION_REQUIRED');
  if (!validateLegacyGrid100(snapshot.placements) || (native && !validateNativeRanch(snapshot.placements, mainUnlocked))) throw new Error('INVALID_PRODUCT_RANCH_MIGRATION');
  const annexCount = expanded ? snapshot.expansion?.decks * 10 : 0;
  if (expanded && (![10,20].includes(annexCount) || snapshot.expansion?.version !== 1 || snapshot.expansion?.grant !== 'PROTOTYPE_NON_PAID')) throw new Error('INVALID_PRODUCT_RANCH_LEGACY_GRANT');
  if (!Number.isInteger(mainUnlocked) || ![14,16,18,20].includes(mainUnlocked)) throw new Error('INVALID_PRODUCT_RANCH_LEGACY_RANK');
  if (!validateNativeRanch(snapshot.placements.filter(p=>p.slotIndex < 20), mainUnlocked)) throw new Error('INVALID_PRODUCT_RANCH_MIGRATION');
  for (const p of snapshot.placements.filter(p=>p.slotIndex >= 20)) {
    const definition = getCageDefinitionByModuleId(p.moduleId);
    const shape = ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]];
    if (!expanded || p.slotIndex >= 20 + annexCount || ((shape & 0xaa) && (p.slotIndex & 1)) ||
      legacyGrid100PlacementCells(p).some(slot=>slot < 20 || slot >= 20 + annexCount)) throw new Error('INVALID_PRODUCT_RANCH_MIGRATION');
  }
  const legacyUnlockedSlots = [...Array.from({length:20},(_,i)=>i), ...Array.from({length:expanded ? 20 : 0},(_,i)=>20+i)];
  return { layoutVersion:LEGACY_PRODUCT_RANCH_GRID100, gridAccess:{version:1,legacyUnlockedSlots,purchasedRows:[],testUnlockedRows:[],legacyGrants:['NATIVE_RANK_CELLS_TEST_OPEN_V1',...(annexCount===10?['ANNEX10_GEOMETRY_GRANDFATHER_V1']:[])]},
    nextInstanceSequence:1,
    placements:snapshot.placements.map(p=>({moduleId:p.moduleId,slotIndex:p.slotIndex,instanceId:`cage:legacy:${getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex}`})) };
}
