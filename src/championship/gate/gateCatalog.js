// VS2 -- Gate Select catalog.
//
// EVIDENCE POSITION
// -----------------
// The gate COUNT is reference-backed: O3-C recovered 16/16 biome representatives
// and OVL12 gate_select carries 16 biome nodes. That is a structural fact and is
// preserved.
//
// Everything else about a gate is not traced. There is no recovered gate table,
// no unlock rule, no ordering rule, and nothing connecting a gate to one of the
// 30 HM field records. So the names here are product-authored, every gate is
// available, and each gate carries a product-authored world seed rather than a
// claim about which original field it is.
//
// This mirrors how VS1 already handles the two habitat regions: product-authored
// content inside a preserved structure, labelled as such so it can never be
// mistaken for recovered original data.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const GATE_COUNT = 16;
export const GATE_COUNT_EVIDENCE = "REFERENCE_BASELINE";
export const GATE_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

// Product-authored neutral names. They describe a mood, not a recovered place:
// no original gate name has been recovered, and presenting an invented name as
// original would be exactly the error the evidence policy exists to prevent.
const GATE_NAMES = Object.freeze([
  "Shallow Verge",
  "Quiet Basin",
  "Ashen Steps",
  "Pale Thicket",
  "Sunken Walk",
  "Amber Hollow",
  "Still Lagoon",
  "Rust Plateau",
  "Cold Aqueduct",
  "Drifting Fen",
  "Glass Terrace",
  "Low Cinderfield",
  "Hushed Canopy",
  "Salt Reach",
  "Dim Causeway",
  "Far Meridian"
]);

function gateId(ordinal) {
  return `championship:2026:gate:${String(ordinal).padStart(2, "0")}`;
}

/**
 * The product gate list.
 *
 * `worldSeed` drives deterministic terrain generation. It is derived from the
 * ordinal rather than randomised so that the same gate is the same field on
 * every device and in every test run.
 */
export const CHAMPIONSHIP_GATES = deepFreeze(
  Array.from({ length: GATE_COUNT }, (_, index) => {
    const ordinal = index + 1;
    return {
      gateId: gateId(ordinal),
      ordinal,
      displayName: GATE_NAMES[index],
      nameAuthority: GATE_AUTHORITY,
      // Codex binds art by ordinal. The O3-C representative catalog is Codex-owned
      // and lives outside this repository, so this module does not invent ids for it.
      biomeOrdinal: ordinal,
      state: "AVAILABLE",
      stateEvidence: "UNKNOWN_REQUIRES_TRACE",
      originalFieldMapping: "UNKNOWN_REQUIRES_TRACE",
      worldSeed: 0x9e37 + (ordinal * 0x4f1b)
    };
  })
);

const GATES_BY_ID = new Map(CHAMPIONSHIP_GATES.map((gate) => [gate.gateId, gate]));

export function listChampionshipGates() {
  return CHAMPIONSHIP_GATES;
}

export function getChampionshipGate(id) {
  return GATES_BY_ID.get(id) ?? null;
}

export function isChampionshipGateId(id) {
  return GATES_BY_ID.has(id);
}
