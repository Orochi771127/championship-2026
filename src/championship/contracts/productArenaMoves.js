// The Data Arena's own moves as auto-battle move records (UNIFIED_MOVES_20261118 U1-2/U1-3).
//
// Owner 2026-11-18: one move list for both battle modes. Each of the 49 Data Arena moves
// is a move record (ids after the playable originals'): a donor native move's timing and
// effect banks with the move's own kind, power, cost, element and status
// (product-arena-moves.v1.json, scripts/build-product-arena-moves.mjs). A partner may
// learn one of the arena moves its own Data Arena kit carries; the learned move joins its
// moves in local battles. Password, link and online battles rebuild partners from their
// native fields, so a learned arena move never travels there.
import battleMoves from "../../data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import table from "../../data/championship/product-arena-moves.v1.json" with { type: "json" };
import { deepFreeze } from "./championshipContracts.js";

const recordsById = new Map(), recordOfMove = new Map(), moveOfRecord = new Map(), namesById = new Map();
for (const e of table.entries) {
  recordsById.set(e.recordIndex, deepFreeze({ ...battleMoves.records[e.donorMoveRecord], recordIndex: e.recordIndex, speciesId: null,
    kind: 1, field0C: e.field0C, power: e.power, actionCost: e.actionCost, elementSelect: e.elementSelect, statusCode: e.statusCode,
    productDonorRecord: e.donorMoveRecord, productArenaMove: e.id }));
  recordOfMove.set(e.id, e.recordIndex);
  moveOfRecord.set(e.recordIndex, e.id);
  // [zh-Hant, en, ja, th, vi]: the arena names its moves in Chinese and English; the other columns read the English
  namesById.set(e.recordIndex, Object.freeze([e.names[0], e.names[1], e.names[1], e.names[1], e.names[1]]));
}

export const PRODUCT_ARENA_MOVE_FIRST_RECORD = table.firstRecordIndex;
/** An arena move's auto-battle record by record index, or null. */
export function productArenaMoveRecord(recordIndex) { return recordsById.get(recordIndex) ?? null; }
/** Every arena move record, in id order. */
export function listProductArenaMoveRecords() { return [...recordsById.values()]; }
/** The record index of an arena move id ('whiteout'), or null. */
export function arenaMoveRecordIndex(moveId) { return recordOfMove.get(moveId) ?? null; }
/** The arena move id of a record index, or null. */
export function arenaMoveIdOfRecord(recordIndex) { return moveOfRecord.get(recordIndex) ?? null; }
/** [zh-Hant, en, ja, th, vi] names keyed by record index. */
export function productArenaMoveNames() { return Object.fromEntries(namesById); }
