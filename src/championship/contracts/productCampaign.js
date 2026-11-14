// Journey zones (六大戰區) -- OWNER_APPROVED_ADAPTATION 2026-11-10 (BATTLE_MODE_PRISM_AND_JOURNEY_20261109).
//
// NOT original behaviour. Six zones of six stages, each fought as a Data Arena
// RELAY match on one of the existing relay fields: two guards, then the
// stage's lead (a mid boss on stage 3, the zone boss on stage 6), with a
// three-choice buff between waves. Stars: clear / clear within 90 s / no
// partner knocked out. A zone's 18 stars open its chest; three-star stages
// can be swept for crystal points, ten sweeps a local day.
//
// Pure: data and rules only. Progress is saved in progression.journey.campaign
// (productJourney.normalizeJourney keeps the shape).

import roster from "../../data/championship/data-arena-relay-roster.v1.json" with { type: "json" };
import { deepFreeze } from "./championshipContracts.js";

export const CAMPAIGN_STAGES = 6;
export const CAMPAIGN_STAR_SECONDS = 90;
export const CAMPAIGN_DAILY_SWEEPS = 10;

/** Zone order, field and bosses (the brief's names; species indices). */
export const CAMPAIGN_ZONES = deepFreeze([
  { zone: 1, field: "field_bm02_01", map: 2, elements: ["nature"], midBoss: 106, boss: 145 },
  { zone: 2, field: "field_bm04_01", map: 4, elements: ["water"], midBoss: 47, boss: 166 },
  { zone: 3, field: "field_bm03_01", map: 3, elements: ["fire"], midBoss: 113, boss: 96 },
  { zone: 4, field: "field_bm05_01", map: 5, elements: ["frost", "shadow"], midBoss: 73, boss: 183 },
  { zone: 5, field: "field_bm06_01", map: 6, elements: ["earth", "storm"], midBoss: 181, boss: 180 },
  { zone: 6, field: "field_bm01_01", map: 1, elements: ["light", "physical"], midBoss: 173, boss: 222 }
]);

const species = (index) => `species-${String(index).padStart(3, "0")}`;
const elementOf = new Map(roster.entries.map((row) => [row.speciesIndex, row.element]));
const generationOf = new Map(roster.entries.map((row) => [row.speciesIndex, row.generationIndex]));
// The three rival kits the relay AI drives, by element family.
const kitFor = (index) => ["water", "frost"].includes(elementOf.get(index)) ? "tide" : elementOf.get(index) === "fire" ? "flame" : "storm";

/** Each zone's guard pool: 成長期 / 成熟期 roster species of its elements, roster order. */
const GUARD_POOLS = deepFreeze(CAMPAIGN_ZONES.map((zone) => {
  const pool = roster.entries.filter((row) => zone.elements.includes(row.element) && row.generationIndex <= 4
    && row.speciesIndex !== zone.midBoss && row.speciesIndex !== zone.boss).map((row) => row.speciesIndex);
  return pool.length >= 2 ? pool : roster.entries.filter((row) => row.generationIndex <= 4).map((row) => row.speciesIndex);
}));

export const stageKey = (zone, stage) => `${zone}-${stage}`;
const clampZone = (zone) => Math.max(1, Math.min(CAMPAIGN_ZONES.length, zone | 0));
const clampStage = (stage) => Math.max(1, Math.min(CAMPAIGN_STAGES, stage | 0));
export const stageDepth = (zone, stage) => (clampZone(zone) - 1) * CAMPAIGN_STAGES + clampStage(stage);

/** The stage's three rivals in fighting order: two guards, then its lead. */
export function campaignRivals(zone, stage) {
  const z = clampZone(zone), s = clampStage(stage), info = CAMPAIGN_ZONES[z - 1], pool = GUARD_POOLS[z - 1];
  const depth = stageDepth(z, s), scale = 0.75 + 0.06 * depth;
  const lead = s === 6 ? info.boss : s === 3 ? info.midBoss : pool[(s * 5 + 3) % pool.length];
  const guards = [pool[(s * 3) % pool.length], pool[(s * 3 + 1) % pool.length]];
  return deepFreeze([...guards, lead].map((index, order) => {
    const boss = order === 2 && (s === 3 || s === 6);
    const kit = kitFor(index);
    // One HP base for every kit, so a stage further in is never easier because of its element.
    const base = 820;
    return {
      id: `${kit}:${z}-${s}-${order}`, speciesId: species(index), kit,
      hp: Math.round(base * scale * (boss ? 1.35 : order === 2 ? 1.12 : 1)),
      speed: kit === "storm" ? 195 : kit === "flame" ? 205 : 225, radius: (generationOf.get(index) ?? 4) >= 5 ? 30 : 26,
      preferredRange: kit === "storm" ? 330 : kit === "flame" ? 420 : 380, canSwim: elementOf.get(index) === "water", champion: boss
    };
  }));
}

/** Stars a finished stage earns. */
export function campaignStars({ outcome, timeSeconds, fainted }) {
  if (outcome !== "VICTORY") return 0;
  return 1 + (Number.isFinite(timeSeconds) && timeSeconds <= CAMPAIGN_STAR_SECONDS ? 1 : 0) + (fainted === 0 ? 1 : 0);
}

/** A stage's first-clear prize and its sweep prize. */
export function campaignRewards(zone, stage) {
  const depth = stageDepth(zone, stage), boss = clampStage(stage) === 3 || clampStage(stage) === 6;
  return deepFreeze({ crystals: 200 + 60 * depth + (boss ? 300 : 0), tickets: boss ? 1 : 0, sweepCrystals: Math.round((200 + 60 * depth) * 0.6) });
}

export const CAMPAIGN_ZONE_CHEST = deepFreeze({ stars: 18, diamonds: 150, tickets: 2 });

/** Stars held for one stage (0..3) in a normalized campaign record. */
export const starsOf = (campaign, zone, stage) => campaign?.stars?.[stageKey(zone, stage)] ?? 0;
export const zoneStars = (campaign, zone) => Array.from({ length: CAMPAIGN_STAGES }, (_, i) => starsOf(campaign, zone, i + 1)).reduce((a, b) => a + b, 0);
export const totalStars = (campaign) => CAMPAIGN_ZONES.reduce((sum, z) => sum + zoneStars(campaign, z.zone), 0);

/** A stage is open once the one before it is cleared; a zone once the previous zone's boss is. */
export function stageOpen(campaign, zone, stage) {
  const z = clampZone(zone), s = clampStage(stage);
  if (s > 1) return starsOf(campaign, z, s - 1) > 0;
  return z === 1 || starsOf(campaign, z - 1, CAMPAIGN_STAGES) > 0;
}

export function normalizeCampaign(value) {
  const stars = {};
  for (const zone of CAMPAIGN_ZONES) for (let s = 1; s <= CAMPAIGN_STAGES; s++) {
    const n = value?.stars?.[stageKey(zone.zone, s)];
    if (Number.isInteger(n) && n > 0) stars[stageKey(zone.zone, s)] = Math.min(3, n);
  }
  const sweepDay = typeof value?.sweepDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.sweepDay) ? value.sweepDay : null;
  const sweeps = sweepDay && Number.isInteger(value?.sweeps) ? Math.max(0, Math.min(CAMPAIGN_DAILY_SWEEPS, value.sweeps)) : 0;
  const chests = Array.isArray(value?.chests) ? [...new Set(value.chests.filter((z) => Number.isInteger(z) && z >= 1 && z <= CAMPAIGN_ZONES.length))].sort() : [];
  return { stars, sweepDay, sweeps, chests };
}

/**
 * Record a finished stage. Stars only ever go up; the first clear pays the
 * stage prize; reaching 18 stars in a zone opens its chest once.
 */
export function recordCampaignStage(campaign, zone, stage, stars) {
  const current = normalizeCampaign(campaign), z = clampZone(zone), s = clampStage(stage), key = stageKey(z, s);
  if (!stageOpen(current, z, s) || !(stars > 0)) return { campaign: current, firstClear: null, chest: null };
  const before = current.stars[key] ?? 0;
  const next = normalizeCampaign({ ...current, stars: { ...current.stars, [key]: Math.max(before, stars) } });
  const firstClear = before === 0 ? campaignRewards(z, s) : null;
  const chest = zoneStars(next, z) >= CAMPAIGN_ZONE_CHEST.stars && !next.chests.includes(z) ? CAMPAIGN_ZONE_CHEST : null;
  if (chest) next.chests = [...next.chests, z].sort();
  return { campaign: next, firstClear, chest };
}

/** Sweep a three-star stage: its sweep crystals, within today's ten. */
export function sweepCampaignStage(campaign, zone, stage, localDay) {
  const current = normalizeCampaign(campaign);
  if (starsOf(current, zone, stage) < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(localDay ?? "")) return null;
  const used = current.sweepDay === localDay ? current.sweeps : 0;
  if (used >= CAMPAIGN_DAILY_SWEEPS) return null;
  return { campaign: { ...current, sweepDay: localDay, sweeps: used + 1 }, crystals: campaignRewards(zone, stage).sweepCrystals };
}

export const sweepsLeft = (campaign, localDay) => {
  const current = normalizeCampaign(campaign);
  return CAMPAIGN_DAILY_SWEEPS - (current.sweepDay === localDay ? current.sweeps : 0);
};
