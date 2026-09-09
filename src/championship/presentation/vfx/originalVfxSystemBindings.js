// Original Nitro 3D VFX family -> licensed runtime binding.
//
// These 26 systems are the registry NITRO_3D_EFFECT_FAMILY set, matching
// docs/art/production/vfx/faithful-reference-26. This file does not invent
// battle hit, Hyper, Spark, or rain callers. Preview aliases exist only so the
// four already-traced presentation events can name the same systems.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const ORIGINAL_NITRO_VFX_BINDING_EVIDENCE = "VERIFIED_BINARY";
export const ORIGINAL_NITRO_VFX_BINDING_ROM_SHA256 =
  "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1";
export const ORIGINAL_NITRO_VFX_SYSTEM_COUNT = 26;

const SYSTEMS = [
  "battle/atkup",
  "battle/circle",
  "battle/circle_my",
  "battle/critup",
  "battle/defup",
  "battle/earth_hit",
  "battle/hitspark_big",
  "battle/hitspark_small",
  "battle/hitup",
  "battle/hypereffect",
  "battle/hypereffect_ring",
  "battle/s_impact_b",
  "battle/s_impact_s",
  "battle/speedup",
  "battle/test_buff",
  "battle/test_eff",
  "battle/toleup",
  "common/lightup",
  "common/mist",
  "common/rain",
  "common/sandstome",
  "common/snow",
  "common/snowstome",
  "common/spark",
  "common/time_pl",
  "common/wind"
];

export const ORIGINAL_NITRO_VFX_SYSTEMS = deepFreeze(
  SYSTEMS.map((logicalGroup) => ({
    logicalGroup,
    systemId: logicalGroup.replaceAll("/", "-"),
    evidence: ORIGINAL_NITRO_VFX_BINDING_EVIDENCE
  }))
);

/** Short names used by the existing presentation-event contract. */
export const ORIGINAL_NITRO_VFX_EVENT_ALIASES = deepFreeze({
  hitspark_big: "battle-hitspark_big",
  hypereffect: "battle-hypereffect",
  spark: "common-spark",
  rain: "common-rain"
});

export function getOriginalNitroVfxSystem(systemId) {
  return ORIGINAL_NITRO_VFX_SYSTEMS.find((entry) => entry.systemId === systemId) ?? null;
}

export function resolveOriginalNitroVfxSystemId(systemId) {
  return ORIGINAL_NITRO_VFX_EVENT_ALIASES[systemId] ?? systemId;
}
