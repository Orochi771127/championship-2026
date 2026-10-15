// Data Arena -- in-match upgrade table and the three-choice draw.
//
// Data, not code paths: each upgrade lists its track, level cap and the
// per-level effect the simulation reads through `upgradeValue`. The draw is
// seeded, never repeats an option inside one offer and never offers a maxed
// upgrade. When every upgrade is maxed the repeatable PATCH heal fills in.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const DATA_ARENA_TRACKS = deepFreeze(["LASER", "SKILL", "DASH", "TIDE"]);

export const DATA_ARENA_UPGRADES = deepFreeze([
  // Laser track
  { id: "focusLens", track: "LASER", max: 3, effect: { laserDps: 0.2 } },
  { id: "heatSink", track: "LASER", max: 2, effect: { heatCapacity: 0.3, cooling: 0.25 } },
  { id: "refractor", track: "LASER", max: 2, effect: { pierce: 1 } },
  { id: "frostLens", track: "LASER", max: 1, effect: { frostLens: 1 } },
  // Dash track
  { id: "phaseDash", track: "DASH", max: 1, effect: { dashCharges: 1 } },
  { id: "afterimage", track: "DASH", max: 2, effect: { dashDamage: 26 } },
  { id: "perfectTiming", track: "DASH", max: 1, effect: { perfectRefund: 1, nearMiss: 12 } },
  { id: "swiftStep", track: "DASH", max: 2, effect: { speed: 0.1 } },
  // Teammate / environment track
  // Skill track (four-move kits)
  { id: "energyLoop", track: "SKILL", max: 2, effect: { energyRegen: 0.25 } },
  { id: "coolingChip", track: "SKILL", max: 2, effect: { cooldown: -0.12 } },
  { id: "skillAmp", track: "SKILL", max: 2, effect: { skillDamage: 0.2 } },
  { id: "ultCore", track: "SKILL", max: 1, effect: { ultGain: 0.35 } },
  // Teammate / environment track (the mate exists only in the harbor challenge)
  { id: "surgePlus", track: "TIDE", max: 2, effect: { surgeRadius: 0.3, surgeCooldown: -0.15 }, modes: ["HARBOR"] },
  { id: "cryoStability", track: "TIDE", max: 2, effect: { iceDuration: 0.5 } },
  { id: "guardianFin", track: "TIDE", max: 2, effect: { mateHp: 0.4, reviveSpeed: 0.35 }, modes: ["HARBOR"] },
  { id: "showmanship", track: "TIDE", max: 1, effect: { hypeGain: 0.25 } }
]);

export const DATA_ARENA_PATCH = deepFreeze({ id: "patch", track: "NONE", max: Infinity, effect: { heal: 0.3 } });

const byId = new Map(DATA_ARENA_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

export function dataArenaUpgrade(id) {
  return id === DATA_ARENA_PATCH.id ? DATA_ARENA_PATCH : byId.get(id) ?? null;
}

/** Sum of one effect key over the owned levels. */
export function upgradeValue(levels, key) {
  let total = 0;
  for (const upgrade of DATA_ARENA_UPGRADES) {
    const level = levels[upgrade.id] ?? 0;
    if (level > 0 && upgrade.effect[key] !== undefined) total += upgrade.effect[key] * Math.min(level, upgrade.max);
  }
  return total;
}

/**
 * Three distinct options from the non-maxed upgrades, preferring one per track
 * when possible so each offer presents different builds. `random` is the
 * simulation's seeded stream.
 */
export function drawUpgradeOffer(levels, random, size = 3, mode = "HARBOR") {
  const available = DATA_ARENA_UPGRADES.filter((upgrade) => (levels[upgrade.id] ?? 0) < upgrade.max && (!upgrade.modes || upgrade.modes.includes(mode)));
  const offer = [];
  const tracks = [...DATA_ARENA_TRACKS];
  // Shuffle track order so the first slot is not always LASER.
  for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
  for (const track of tracks) {
    if (offer.length >= size) break;
    const pool = available.filter((upgrade) => upgrade.track === track && !offer.includes(upgrade.id));
    if (pool.length) offer.push(pool[Math.floor(random() * pool.length)].id);
  }
  while (offer.length < size) {
    const pool = available.filter((upgrade) => !offer.includes(upgrade.id));
    if (!pool.length) break;
    offer.push(pool[Math.floor(random() * pool.length)].id);
  }
  if (offer.length < size) offer.push(DATA_ARENA_PATCH.id);
  return Object.freeze(offer);
}

/** Seeded PRNG (mulberry32). The arena owns its stream; no Math.random in rules. */
export function createArenaRandom(seed = 0x5eed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.getState = () => state;
  return next;
}
