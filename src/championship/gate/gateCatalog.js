// VS2 -- Gate Select catalog.
//
// EVIDENCE POSITION
// -----------------
// The 16 destinations and their identities are recovered, not authored. The
// `gate_select/3D_worldMap_model.nsbmd` MDL0 name table carries 16
// `<Name>parent` -> `<Name>` node pairs at a uniform 16-byte stride, and three
// independent counts of 16 agree: model node pairs, `obj_world_GateIcon` cells,
// and `field_image_icon` cells. See
// docs/contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json.
//
// IDENTITY VERSUS DISPLAY
// -----------------------
// `biomeId` is the ROM_VERIFIED node identity and is the canonical key: stable,
// internal, and safe to align to the original. `displayName` is NOT recovered -
// no original player-facing string for these destinations has been read - so it
// is a presentation default that a localization layer is expected to replace.
// Recovering a node name is not the same as recovering the label the player saw,
// and this file keeps the two apart on purpose.
//
// Ordering is the model's name-table order, which is alphabetical. Original
// display or selection order is UNKNOWN_REQUIRES_TRACE.
//
// The original ARM9 Hunt table now supplies the day/night HM field pair for all
// 16 identities. Unlock rules and the exact day/night selection call remain
// untraced, so every gate stays available and no time selector is invented.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { getOriginalHuntFieldBinding } from "./originalHuntFieldBindings.js";

export const GATE_COUNT = 16;
export const GATE_COUNT_EVIDENCE = "ROM_VERIFIED";
export const GATE_IDENTITY_EVIDENCE = "ROM_VERIFIED";
export const GATE_DISPLAY_NAME_EVIDENCE = "PRESENTATION_DEFAULT_NOT_RECOVERED";
export const GATE_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

/**
 * The 16 recovered biome node identities, in model name-table order.
 *
 * `displayName` is a presentation default derived from the node identity, not a
 * recovered original string.
 */
const BIOME_IDENTITIES = Object.freeze([
  "Canyon", "Crag", "Damp", "Desert", "Factory", "Forest", "Grass", "Ice",
  "Jungle", "Mine", "Oasis", "Ruins", "Savanna", "Seaside", "Sewer", "Volcano"
]);

function gateId(biomeId) {
  return `championship:2026:gate:${biomeId.toLowerCase()}`;
}

/**
 * The product gate list.
 *
 * `worldSeed` drives deterministic terrain generation. It is derived from the
 * ordinal rather than randomised so that the same gate is the same field on
 * every device and in every test run.
 */
export const CHAMPIONSHIP_GATES = deepFreeze(
  BIOME_IDENTITIES.map((biomeId, index) => {
    const ordinal = index + 1;
    const originalFields = getOriginalHuntFieldBinding(biomeId);
    if (!originalFields) throw new Error(`MISSING_ORIGINAL_HUNT_FIELD_BINDING: ${biomeId}`);
    return {
      gateId: gateId(biomeId),
      ordinal,
      // ROM_VERIFIED: the MDL0 node name. This is the canonical identity.
      biomeId,
      biomeNodeName: biomeId,
      biomeParentNodeName: `${biomeId}parent`,
      identityEvidence: GATE_IDENTITY_EVIDENCE,
      // NOT recovered. A localization layer may replace this freely.
      displayName: biomeId,
      displayNameEvidence: GATE_DISPLAY_NAME_EVIDENCE,
      // Codex binds art by ordinal; the O3-C representative catalog is
      // Codex-owned and lives outside this repository.
      biomeOrdinal: ordinal,
      state: "AVAILABLE",
      stateEvidence: "UNKNOWN_REQUIRES_TRACE",
      originalFieldMapping: "ROM_VERIFIED",
      originalFields,
      worldSeed: 0x9e37 + (ordinal * 0x4f1b)
    };
  })
);

const GATES_BY_ID = new Map(CHAMPIONSHIP_GATES.map((gate) => [gate.gateId, gate]));
const GATES_BY_BIOME = new Map(CHAMPIONSHIP_GATES.map((gate) => [gate.biomeId, gate]));

export function listChampionshipGates() {
  return CHAMPIONSHIP_GATES;
}

export function getChampionshipGate(id) {
  return GATES_BY_ID.get(id) ?? null;
}

/** Resolve by recovered biome identity, the canonical key. */
export function getChampionshipGateByBiome(biomeId) {
  return GATES_BY_BIOME.get(biomeId) ?? null;
}

export function isChampionshipGateId(id) {
  return GATES_BY_ID.has(id);
}

export function listChampionshipBiomeIdentities() {
  return BIOME_IDENTITIES;
}
