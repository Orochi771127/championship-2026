// Original Battle arena table -> visual field binding.
//
// VERIFIED_BINARY from ARM9 0x020CC148, 11 records of 0x18. This file only
// restates what battle-arenas.r1.json already dumped. It does not invent a
// match-to-arena mapping, stand positions, or BM03/BM04 animation timing.

import { deepFreeze } from "../contracts/championshipContracts.js";
import arenaDocument from "../../data/championship/catalogs/battle-arenas.r1.json" with { type: "json" };

export const ORIGINAL_BATTLE_FIELD_BINDING_EVIDENCE = "VERIFIED_BINARY";
export const ORIGINAL_BATTLE_FIELD_BINDING_ROM_SHA256 =
  "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1";

/** Catalog-linked shared ring. Not a 12th drawable arena. */
export const ORIGINAL_BATTLE_SHARED_LAYER_ID = "field_bm00_00";
export const ORIGINAL_BATTLE_SHARED_LAYER_ASSET = "field_bm00_00_common";

export const ORIGINAL_BATTLE_FIELD_COUNT = 11;

function animationStatus(record) {
  // The catalog names an anim layer on volcano and island. Placement and
  // timing are untraced, so the runtime bundle keeps one static frame.
  if (!record.string0C) return "NOT_PRESENT";
  return "ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE";
}

export const ORIGINAL_BATTLE_FIELD_BINDINGS = deepFreeze(
  arenaDocument.records.map((record) => ({
    arenaIndex: record.recordIndex,
    identifier: record.identifier,
    fieldId: record.string04,
    commonLayerId: record.string08 || null,
    hasCommonLayer: Boolean(record.string08),
    animatedLayerId: record.string0C || null,
    animationStatus: animationStatus(record),
    objectLayerId: record.string10 || null,
    evidence: ORIGINAL_BATTLE_FIELD_BINDING_EVIDENCE
  }))
);

export function getOriginalBattleFieldBinding(arenaIndex) {
  return ORIGINAL_BATTLE_FIELD_BINDINGS.find((entry) => entry.arenaIndex === arenaIndex) ?? null;
}

export function getOriginalBattleFieldBindingByFieldId(fieldId) {
  return ORIGINAL_BATTLE_FIELD_BINDINGS.find((entry) => entry.fieldId === fieldId) ?? null;
}
