// Gacha item executor -- OWNER_APPROVED_ADAPTATION 2026-11-09 (GACHA_FULL_EFFECTS_20261109).
//
// The chip and metal tables in cyberGacha.js name effects by meaning ("this partner's race points"); this
// module turns them into the exact native words of one partner, and reads how far each of the partner's
// evolution routes still is. Pure: profile and rule table in, plain data out.
//
// Counters: the eleven native evolution counters, faction (vaccine/data/virus) then race, in the order the
// thresholds read them (OVL18 02112734). The three-axis taxonomy names a species' faction and race, and those
// renames keep the ROM attribute/family meaning, so the counter a chip feeds is the one evolution checks.

import { speciesTaxonomy } from "../contracts/speciesTaxonomy.js";
import { nativeEvolutionRequirements } from "../raising/nativeRaisingLifecycle.js";
import { GACHA_COUNTER_FIELDS, GACHA_BATTLE_CAP } from "./cyberGacha.js";

export const FACTION_COUNTER = Object.freeze({ LUMEN: "104", IRON: "108", RIFT: "100" });
export const RACE_COUNTER = Object.freeze({
  DRAGON: "10c", BEAST: "110", AQUATIC: "114", AVIAN: "118", SYLVAN: "124", ASTRAL: "120", NETHER: "128", MECHANOID: "11c"
});
// A catalyst made of shards waives at most this many unmet conditions; a whole metal waives any number.
export const SHARD_CATALYST_WAIVER = 2;

const signed = (n) => n | 0;

/** The race and faction counters of a species (null where the taxonomy has none). */
export function speciesCounterFields(speciesIndex) {
  const taxonomy = speciesTaxonomy(speciesIndex);
  return Object.freeze({ race: RACE_COUNTER[taxonomy?.race] ?? null, faction: FACTION_COUNTER[taxonomy?.faction] ?? null });
}

/** Ordinary (non-lifetime) evolution routes out of a species in a growth table. */
export function evolutionRoutes(speciesIndex, table) {
  return (table.rules[speciesIndex - 8] ?? []).map((rule, ruleIndex) => ({ rule, ruleIndex })).filter(({ rule }) => rule.kind !== 1);
}

/**
 * Every unmet condition of one route for this partner: counters and stats (GTE), battle count, win percent and
 * rebirths (GTE), care mistakes (LTE). Rows: {kind, field, need, current}.
 */
export function routeShortfall(profile, rule) {
  const f = profile.fields, n = profile.narrowFields ?? {}, t = rule.thresholds, req = nativeEvolutionRequirements(rule);
  const rows = [];
  for (const { field, minimum } of req.counts) if (minimum !== 0 && minimum > signed(f[field])) rows.push({ kind: "COUNTER", field, need: minimum, current: signed(f[field]) });
  req.stats.forEach(({ field, minimum }, i) => { if (t[11 + i] !== 0 && minimum > signed(f[field])) rows.push({ kind: "STAT", field, need: minimum, current: signed(f[field]) }); });
  if (t[22] !== 0 && t[22] > signed(f["024"])) rows.push({ kind: "BATTLES", field: "024", need: t[22], current: signed(f["024"]) });
  if (t[23] !== 0 && t[23] > winPercent(f)) rows.push({ kind: "WIN_PERCENT", field: "028", need: t[23], current: winPercent(f) });
  if (t[24] !== 0 && t[24] > (n["03c"] | 0)) rows.push({ kind: "REBIRTHS", field: "03c", need: t[24], current: n["03c"] | 0 });
  if (t[25] !== 0 && t[25] < (n["03d"] | 0)) rows.push({ kind: "CARE_MISTAKES", field: "03d", need: t[25], current: n["03d"] | 0 });
  return rows;
}

// Native Q12 division and rounding (nativeRaisingLifecycle.passes).
function winPercent(f) {
  if ((f["024"] << 12) <= 0) return 0;
  const q = Number((BigInt(f["028"] << 12) << 12n) / BigInt(f["024"] << 12));
  return Number((BigInt(q) * 409600n + 2048n) >> 12n) >> 12;
}

/** Each route of the partner with its target and what it still lacks, nearest first. */
export function evolutionRouteGaps(profile, table) {
  const routes = evolutionRoutes(profile.fields["000"], table).map(({ rule, ruleIndex }) => {
    const unmet = routeShortfall(profile, rule);
    return { ruleIndex, target: rule.target, unmet, unmetCount: unmet.length };
  });
  return routes.sort((a, b) => a.unmetCount - b.unmetCount || a.ruleIndex - b.ruleIndex);
}

/**
 * The counter the partner's next evolution lacks most: the largest counter shortfall over its routes, else
 * its race counter, else its faction counter.
 */
export function evolutionGapCounter(profile, table) {
  let best = null;
  for (const route of evolutionRouteGaps(profile, table)) {
    for (const row of route.unmet) if (row.kind === "COUNTER" && (!best || row.need - row.current > best.gap)) best = { field: row.field, gap: row.need - row.current };
  }
  const own = speciesCounterFields(profile.fields["000"]);
  return best?.field ?? own.race ?? own.faction ?? GACHA_COUNTER_FIELDS[0];
}

/**
 * A chip's or metal's effect as the native words of this partner: race/faction/every/gap points become
 * `counters`, growth age becomes `ageMinutes` (never past the life threshold, so a chip never ends a life).
 * Everything else passes through unchanged to applyGachaBoost.
 */
export function resolveGachaEffect(effect, profile, { table, lifeThreshold = null, gapExp = 0 } = {}) {
  const out = { ...effect }, counters = {};
  const add = (field, points) => { if (field && points) counters[field] = (counters[field] ?? 0) + points; };
  const own = speciesCounterFields(profile.fields["000"]);
  const fallback = () => evolutionGapCounter(profile, table);
  if (effect.raceExp) add(own.race ?? fallback(), effect.raceExp);
  if (effect.factionExp) add(own.faction ?? fallback(), effect.factionExp);
  if (effect.everyExp) for (const field of GACHA_COUNTER_FIELDS) add(field, effect.everyExp);
  if (gapExp) add(fallback(), gapExp);
  if (Object.keys(counters).length) out.counters = counters;
  delete out.raceExp; delete out.factionExp; delete out.everyExp; delete out.age;
  if (effect.age && Number.isSafeInteger(lifeThreshold) && lifeThreshold > 0 && lifeThreshold < 0xffffffff) {
    const age = profile.fields["18c"] | 0, room = Math.max(0, lifeThreshold - 1 - age);
    const minutes = Math.min(room, Math.round(lifeThreshold * effect.age));
    if (minutes > 0) out.ageMinutes = minutes;
  }
  return out;
}

/** A won match through an armed beacon: extra battles and wins, and race/faction points, on one fighter. */
export function beaconBattleWords(profile, { battles = 0, exp = 0 } = {}) {
  const p = structuredClone(profile), f = p.fields;
  if (battles > 0) {
    f["024"] = Math.min(GACHA_BATTLE_CAP, (f["024"] | 0) + battles) >>> 0;
    f["028"] = Math.min(f["024"], (f["028"] | 0) + battles) >>> 0;
  }
  if (exp > 0) {
    const own = speciesCounterFields(f["000"]);
    for (const field of new Set([own.race, own.faction].filter(Boolean))) f[field] = Math.min(9999, (f[field] | 0) + exp) >>> 0;
  }
  return p;
}
