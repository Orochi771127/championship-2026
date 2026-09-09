// Original CageDefinition -> visual field binding.
//
// VERIFIED_BINARY from the contiguous 37-entry, 0x28-byte ARM9 visual table.
// Entries 0..34 are the 35 shop CageDefinitions, entry 35 is Waiting Room,
// and entry 36 is the structural Lid. CM33/36/38 exist in the ROM filesystem
// but are not referenced by this runtime table and are therefore not guessed
// into one of the 36 definitions.
// Reverified 2026-09-05: pointer-column base 0x020C8CC0; matching name and
// description columns 0x020C8CDC/0x020C8CE0, all at index*40. OVL15's reader
// and every shop itemIndex agree. Definition 0 IS the vacant lot (cm01);
// definition 1 is the track (cm02). Do not shift art to match the superseded
// +0x28/+0x2C text-builder bug. See CAGE_IDENTITY_BINDING_ROM_TRACE_2026-09-05.md.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const ORIGINAL_CAGE_VISUAL_BINDING_EVIDENCE = "VERIFIED_BINARY";
export const ORIGINAL_CAGE_VISUAL_BINDING_ROM_SHA256 =
  "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1";
export const ORIGINAL_CAGE_DEFINITION_VISUAL_COUNT = 36;

const SHOP_FIELD_IDS = Object.freeze([
  ...Array.from({ length: 27 }, (_, index) => `field_cm${String(index + 1).padStart(2, "0")}_01`),
  "field_cm30_01",
  "field_cm31_01",
  "field_cm32_01",
  "field_cm34_01",
  "field_cm35_01",
  "field_cm37_01",
  "field_cm39_01",
  "field_cm40_01"
]);

export const ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS = deepFreeze([
  ...SHOP_FIELD_IDS.map((fieldId, cageDefinitionIndex) => ({
    cageDefinitionIndex,
    fieldId,
    role: "SHOP_CAGE",
    evidence: ORIGINAL_CAGE_VISUAL_BINDING_EVIDENCE
  })),
  {
    cageDefinitionIndex: 35,
    fieldId: "field_cm28_01",
    role: "WAITING_ROOM",
    evidence: ORIGINAL_CAGE_VISUAL_BINDING_EVIDENCE
  }
]);

export const ORIGINAL_CAGE_STRUCTURAL_VISUALS = deepFreeze([
  { fieldId: "field_cm29_01", role: "LID", evidence: ORIGINAL_CAGE_VISUAL_BINDING_EVIDENCE }
]);

export const ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS = deepFreeze([
  "field_cm33_01",
  "field_cm36_01",
  "field_cm38_01"
]);

export function getOriginalCageVisualBinding(cageDefinitionIndex) {
  return ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS[cageDefinitionIndex] ?? null;
}
