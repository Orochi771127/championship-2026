// Journey (征途) -- OWNER_APPROVED_ADAPTATION 2026-11-09 (BATTLE_MODE_PRISM_AND_JOURNEY_20261109).
//
// NOT original behaviour. One prism face holds the product's progression
// content instead of new menu modes. This module is its pure rules:
//
//   Tower   100 floors fought in the auto battle against the ROM free-battle
//           presets. Floor bands follow the original's ten preset tiers
//           (幼年期 -> 究極體), so a floor's opponents are original presets,
//           picked from the floor number alone (no RNG is spent). The first
//           clear of a floor pays crystal points; every 5th floor adds a chest
//           (crystals + a gacha ticket), every 10th a guardian prize (diamonds
//           + tickets). The tower never pays Bits, which stay the title
//           matches' (integration report C7).
//   Patrol  the 深網巡航 pod makes crystal points per hour from Journey
//           progress F = best floor + half the zone stars (120 + 38 x F). Up to 12 hours collect while away, as the real-time
//           ranch counts growth; a clock set backwards restarts the count.
//           One free two-hour quick patrol per local day.
//
// Pure: numbers in, numbers out. The saved record lives at progression.journey.

import catalog from "../../data/championship/catalogs/free-battle.r1.json" with { type: "json" };
import { deepFreeze } from "./championshipContracts.js";
import { normalizeCampaign, totalStars } from "./productCampaign.js";

export const TOWER_FLOORS = 100;
export const PATROL_CAP_HOURS = 12;
export const PATROL_QUICK_HOURS = 2;
const HOUR = 3600000;
const COUNT_MAX = 1e9;

/** Floor bands onto the original's ten free-battle preset tiers. */
export const TOWER_BANDS = deepFreeze([
  { from: 1, to: 5, tier: 0, stage: "BABY" },
  { from: 6, to: 10, tier: 1, stage: "BABY" },
  { from: 11, to: 18, tier: 2, stage: "ROOKIE" },
  { from: 19, to: 25, tier: 3, stage: "ROOKIE" },
  { from: 26, to: 42, tier: 4, stage: "CHAMPION" },
  { from: 43, to: 60, tier: 5, stage: "CHAMPION" },
  { from: 61, to: 72, tier: 6, stage: "AWAKENED" },
  { from: 73, to: 85, tier: 7, stage: "AWAKENED" },
  { from: 86, to: 93, tier: 8, stage: "ULTIMATE" },
  { from: 94, to: 100, tier: 9, stage: "ULTIMATE" }
]);

const presetOf = (index) => catalog.presets[index - catalog.presetStart];
// Each tier's presets in every season, once, in the catalog's own order.
const TIER_POOLS = deepFreeze(catalog.pools.map((seasons) => [...new Set(seasons.flat())].filter((index) => presetOf(index))));

const floorOf = (value) => (Number.isSafeInteger(value) ? Math.max(1, Math.min(TOWER_FLOORS, value)) : 1);

export function towerBand(floor) {
  const value = floorOf(floor);
  return TOWER_BANDS.find((band) => value >= band.from && value <= band.to);
}

export const isTowerGuardianFloor = (floor) => floorOf(floor) % 10 === 0;
export const isTowerChestFloor = (floor) => floorOf(floor) % 5 === 0;

/**
 * The floor's opponents as free-battle preset indices. Floors 1-10 are one on
 * one; from 11 a team of three. A guardian floor leads with its tier's richest
 * preset (the original's own payout ranks them).
 */
export function towerOpponents(floor) {
  const value = floorOf(floor), pool = TIER_POOLS[towerBand(value).tier];
  const size = value <= 10 ? 1 : 3;
  const picked = [];
  if (isTowerGuardianFloor(value)) picked.push([...pool].sort((a, b) => presetOf(b).field0C - presetOf(a).field0C)[0]);
  for (let step = 0; picked.length < size && step < pool.length * 2; step++) {
    const index = pool[(value * 7 + step * 13) % pool.length];
    if (!picked.includes(index)) picked.push(index);
  }
  return Object.freeze(picked);
}

export const towerOpponentSpecies = (floor) => Object.freeze(towerOpponents(floor).map((index) => presetOf(index).field00));

/** What the first clear of a floor pays. */
export function towerRewards(floor) {
  const value = floorOf(floor);
  const chest = isTowerChestFloor(value), guardian = isTowerGuardianFloor(value);
  return deepFreeze({
    floor: value,
    crystals: 40 * value + (chest ? 500 + 60 * value : 0),
    tickets: (chest ? 1 : 0) + (guardian ? 2 : 0),
    diamonds: guardian ? 100 : 0,
    chest, guardian
  });
}

export function createJourneyState() {
  return { version: 1, tower: { best: 0, team: [] }, patrol: { since: null, quickDay: null }, campaign: normalizeCampaign(null) };
}

export function normalizeJourney(value) {
  const base = createJourneyState();
  if (!value || typeof value !== "object" || value.version !== 1) return base;
  const best = Number.isSafeInteger(value.tower?.best) ? Math.max(0, Math.min(TOWER_FLOORS, value.tower.best)) : 0;
  const team = Array.isArray(value.tower?.team)
    ? [...new Set(value.tower.team.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120))].slice(0, 3) : [];
  const since = Number.isSafeInteger(value.patrol?.since) && value.patrol.since > 0 ? value.patrol.since : null;
  const quickDay = typeof value.patrol?.quickDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.patrol.quickDay) ? value.patrol.quickDay : null;
  return { version: 1, tower: { best, team }, patrol: { since, quickDay }, campaign: normalizeCampaign(value.campaign) };
}

/** Journey progress for the patrol pod: the best floor plus half the zone stars. */
export function journeyProgress(state) {
  const journey = normalizeJourney(state);
  return journey.tower.best + Math.floor(totalStars(journey.campaign) / 2);
}

/** Patrol output per hour from Journey progress. */
export function patrolRate(state) {
  return 120 + 38 * journeyProgress(state);
}

/** What the pod holds now: points, hours counted, and whether it is full. */
export function patrolStatus(state, now) {
  const journey = normalizeJourney(state), rate = patrolRate(journey);
  const since = journey.patrol.since;
  const hours = since === null || !(now >= since) ? 0 : Math.min(PATROL_CAP_HOURS, (now - since) / HOUR);
  return deepFreeze({ rate, hours, crystals: Math.floor(rate * hours), full: hours >= PATROL_CAP_HOURS, started: since !== null });
}

/**
 * Collect the pod. The first call only starts the count. A clock that went
 * backwards restarts it without paying.
 */
export function claimPatrol(state, now) {
  const journey = normalizeJourney(state);
  const status = patrolStatus(journey, now);
  const restart = journey.patrol.since !== null && now < journey.patrol.since;
  return {
    state: { ...journey, patrol: { ...journey.patrol, since: now } },
    crystals: restart ? 0 : status.crystals
  };
}

/** The once-a-day two-hour quick patrol, by the device's local date. */
export function quickPatrol(state, localDay) {
  const journey = normalizeJourney(state);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDay ?? "") || journey.patrol.quickDay === localDay) return null;
  return {
    state: { ...journey, patrol: { ...journey.patrol, quickDay: localDay } },
    crystals: Math.min(COUNT_MAX, patrolRate(journey) * PATROL_QUICK_HOURS)
  };
}

/** A won floor: the next best floor and, on a first clear, its rewards. */
export function clearTowerFloor(state, floor, team = []) {
  const journey = normalizeJourney(state), value = floorOf(floor);
  if (value > journey.tower.best + 1) return { state: journey, rewards: null };
  const first = value > journey.tower.best;
  const next = normalizeJourney({ ...journey, tower: { best: Math.max(journey.tower.best, value), team } });
  return { state: next, rewards: first ? towerRewards(value) : null };
}

/** The floor a player may fight next (the next unbeaten one, or the top). */
export const towerNextFloor = (state) => Math.min(TOWER_FLOORS, normalizeJourney(state).tower.best + 1);
