// Ranch expansion prototype (2026-10-05): one annex deck of ten slots, non-paid.
//
// OWNER_APPROVAL_PENDING_ADAPTATION. The original ranch is ROM_VERIFIED: a
// two-row board of 14/16/18/20 slots by tamer rank (cageCatalog.js), sixteen
// shape masks with the upper-row rule for two-row shapes, and one wrap-around
// field ring. The annex keeps every one of those rules inside itself -- five
// columns by two rows, the same masks, the same row rule, its own occupancy
// word -- and it does not depend on rank.
//
// Saved slots 20..29 are annex-local 0..9. On the field the annex columns follow
// the main board's unlocked columns in the same ring, so walking, carrying,
// spawning and feeding run the original code over a longer ring; the
// presentation folds that ring at the seam and shows the annex as a second band.
//
// Nothing here prices, sells or unlocks the annex for real. The prototype grant
// is its only writer, and revoking an empty annex restores the original layout
// version, so a save that never took the grant never changes shape.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { MAX_SLOT_COUNT, getCageDefinitionByModuleId } from "./cageCatalog.js";
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from "./ranchSlotGeometry.js";
import { NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, validateNativeRanch } from "./nativeRanchLayout.js";

export const RANCH_DECKS_LAYOUT = "NATIVE_DECKS_V1";
export const RANCH_EXPANSION_VERSION = 1;
export const RANCH_EXPANSION_DECK_SLOTS = 10;
export const RANCH_EXPANSION_MAX_DECKS = 1;
export const RANCH_EXPANSION_FIRST_SLOT = MAX_SLOT_COUNT;
export const RANCH_EXPANSION_GRANT_PROTOTYPE = "PROTOTYPE_NON_PAID";
export const RANCH_EXPANSION_EVIDENCE = "OWNER_APPROVAL_PENDING_ADAPTATION";
const EXPANSION_KEYS = Object.freeze(["version", "decks", "grant"]);

function expansionError(message) {
  const error = new Error(message);
  error.name = "ChampionshipRanchExpansionError";
  return error;
}

/** The saved entitlement record, or null when the ranch has no annex. */
export function normalizeRanchExpansion(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw expansionError("INVALID_RANCH_EXPANSION");
  if (Object.keys(raw).some((key) => !EXPANSION_KEYS.includes(key))) throw expansionError("INVALID_RANCH_EXPANSION_KEY");
  if (raw.version !== RANCH_EXPANSION_VERSION) throw expansionError("UNKNOWN_RANCH_EXPANSION_VERSION");
  if (!Number.isInteger(raw.decks) || raw.decks < 1 || raw.decks > RANCH_EXPANSION_MAX_DECKS) {
    throw expansionError("INVALID_RANCH_EXPANSION_DECKS");
  }
  if (raw.grant !== RANCH_EXPANSION_GRANT_PROTOTYPE) throw expansionError("INVALID_RANCH_EXPANSION_GRANT");
  return { version: raw.version, decks: raw.decks, grant: raw.grant };
}

/**
 * ARM9 0x020827B0..0x020827F4's tile origin, over a ring longer than the
 * original board. ranchSlotGeometry.js (hash-locked by the cage authoring
 * contract) range-checks the board slot; an annex slot is column
 * floor(slot/2), row slot%2 by the same arithmetic.
 */
export function ringFieldTileOrigin(ringSlot, shapeIndex) {
  if (!Number.isSafeInteger(ringSlot) || ringSlot < 0) throw new RangeError(`RANCH_RING_SLOT_OUT_OF_RANGE: ${ringSlot}`);
  const mask = ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex];
  if (mask === undefined) throw new RangeError(`RANCH_SHAPE_OUT_OF_RANGE: ${shapeIndex}`);
  const column = Math.floor(ringSlot / 2), row = ringSlot % 2;
  return deepFreeze({ tileX: column * 12 + row * 6 + ((mask & 1) ? 0 : 6), tileY: row * 8,
    coordinateSpace: "ORIGINAL_FIELD_DESTINATION_TILES", evidence: "VERIFIED_BINARY_NATIVE_REPLAY" });
}

/** Both native layout versions run the native ranch; only DECKS has an annex. */
export function isNativeRanchLayout(layoutVersion) {
  return layoutVersion === NATIVE_RANCH_LAYOUT || layoutVersion === RANCH_DECKS_LAYOUT;
}

export function prototypeRanchExpansion() {
  return { version: RANCH_EXPANSION_VERSION, decks: 1, grant: RANCH_EXPANSION_GRANT_PROTOTYPE };
}

export function annexSlotCount(expansion) {
  return (expansion?.decks ?? 0) * RANCH_EXPANSION_DECK_SLOTS;
}

export function isAnnexSlot(slotIndex) {
  return Number.isSafeInteger(slotIndex) && slotIndex >= RANCH_EXPANSION_FIRST_SLOT
    && slotIndex < RANCH_EXPANSION_FIRST_SLOT + RANCH_EXPANSION_MAX_DECKS * RANCH_EXPANSION_DECK_SLOTS;
}

export function annexLocalSlot(slotIndex) {
  return slotIndex - RANCH_EXPANSION_FIRST_SLOT;
}

function shapeMaskOf(moduleId) {
  const definition = getCageDefinitionByModuleId(moduleId);
  return definition ? ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[definition.cageDefinitionIndex]] : null;
}

/** Annex-local footprint: the original masks and upper-row rule inside ten bits. */
export function annexPlacementMask(entry, expansion) {
  const slots = annexSlotCount(expansion);
  if (!isAnnexSlot(entry?.slotIndex) || annexLocalSlot(entry.slotIndex) >= slots) return null;
  const shape = shapeMaskOf(entry.moduleId);
  if (shape === null) return null;
  const local = annexLocalSlot(entry.slotIndex);
  if ((shape & 0xaa) && (local & 1)) return null;
  const mask = shape << local;
  if (mask & ~((1 << slots) - 1)) return null;
  return mask;
}

/** The main board under its original rules, plus the annex in its own word. */
export function validateExpandedRanch(placements, mainUnlocked, expansion) {
  if (!Array.isArray(placements)) return false;
  const main = placements.filter((entry) => !isAnnexSlot(entry?.slotIndex));
  if (!validateNativeRanch(main, mainUnlocked)) return false;
  const modules = new Set(main.map((entry) => entry.moduleId));
  let occupied = 0;
  for (const entry of placements.filter((item) => isAnnexSlot(item?.slotIndex))) {
    // The Waiting Room is the main board's fixed slot 0, never an annex cage.
    if (entry.moduleId === WAITING_ROOM_MODULE) return false;
    const mask = annexPlacementMask(entry, expansion);
    if (mask === null || (occupied & mask) || modules.has(entry.moduleId)) return false;
    occupied |= mask;
    modules.add(entry.moduleId);
  }
  return true;
}

/** Validate under whichever layout version the ranch carries. */
export function validateRanchLayout(placements, { layoutVersion, mainUnlocked, expansion = null }) {
  if (layoutVersion === RANCH_DECKS_LAYOUT) return validateExpandedRanch(placements, mainUnlocked, expansion);
  return validateNativeRanch(placements, mainUnlocked);
}

/** Annex board cells a placement covers, as saved slot indices 20..29. */
export function annexPlacementCells(entry, expansion) {
  const mask = annexPlacementMask(entry, expansion);
  if (mask === null) return [];
  const cells = [];
  for (let bit = 0; bit < RANCH_EXPANSION_DECK_SLOTS; bit += 1) if (mask & (1 << bit)) cells.push(RANCH_EXPANSION_FIRST_SLOT + bit);
  return cells;
}

/**
 * The field ring a ranch lays out: its slot count, where the annex starts,
 * every placement at its ring slot, and every ring slot no footprint covers
 * (each gets the original empty-bay treatment). Masks are applied per deck, so
 * nothing is ever shifted past bit 31.
 */
export function ranchRing({ layoutVersion, placements, unlockedCount, expansion = null }) {
  const decks = layoutVersion === RANCH_DECKS_LAYOUT ? (expansion?.decks ?? 0) : 0;
  const ringCount = unlockedCount + decks * RANCH_EXPANSION_DECK_SLOTS;
  const covered = new Set();
  const ringPlacements = (placements ?? []).map((entry) => {
    const annex = decks > 0 && isAnnexSlot(entry.slotIndex);
    const local = annex ? annexLocalSlot(entry.slotIndex) : entry.slotIndex;
    const base = annex ? unlockedCount : 0;
    const shape = shapeMaskOf(entry.moduleId) ?? 0;
    for (let bit = 0; bit < 8; bit += 1) if (shape & (1 << bit)) covered.add(base + local + bit);
    // A ranch without an annex keeps its placement records exactly as saved.
    return decks > 0 ? { ...entry, slotIndex: base + local, savedSlotIndex: entry.slotIndex, deck: annex ? 1 : 0 } : { ...entry };
  });
  return deepFreeze({
    layoutVersion, ringCount, mainCount: unlockedCount, annexStart: decks > 0 ? unlockedCount : null, decks,
    placements: ringPlacements,
    uncovered: Array.from({ length: ringCount }, (_, slot) => slot).filter((slot) => !covered.has(slot))
  });
}

export { NATIVE_RANCH_LAYOUT };
