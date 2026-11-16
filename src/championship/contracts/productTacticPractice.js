// Journey practice series (陪練三連戰) -- TACTIC_PRACTICE_LOOP_20261116.
//
// NOT original behaviour; a bounded playtest prototype of one loop: the same
// partner fights three different rivals in a row, the player may change its
// battle plan (作戰方針, the ROM's own policy 0/1/2) between bouts or keep it,
// and each result says what the partner actually did. To keep the comparison
// clean the series pays a FIXED crystal amount per bout -- the same for a win,
// a loss and every plan -- and none of the battle's own Bits, Sync EXP or
// gacha drops.
//
// Pure: preset indices and numbers in, frozen data out. The series lives in
// application memory for the session only; nothing here touches the save.

import catalog from "../../data/championship/catalogs/free-battle.r1.json" with { type: "json" };
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };
import { deepFreeze } from "./championshipContracts.js";
import { towerBand } from "./productJourney.js";
import { listMoveRecordsForSpecies } from "../battle/battleCatalogs.js";

export const TACTIC_PRACTICE_BOUTS = 3;
export const TACTIC_PRACTICE_CRYSTALS = 150;
export const TACTIC_PRACTICE_PLANS = deepFreeze([0, 1, 2]);

const presetOf = (index) => catalog.presets[index - catalog.presetStart];
const TIER_POOLS = deepFreeze(catalog.pools.map((seasons) => [...new Set(seasons.flat())].filter((index) => presetOf(index))));

/** How many SP moves a preset's species carries (0..3): the rival's kit, from the move catalog. */
export function presetSkillCount(index) {
  const species = presetOf(index)?.field00;
  if (!Number.isInteger(species)) return 0;
  try { return listMoveRecordsForSpecies(species).filter((m) => m.kind === 1 && (m.actionCost ?? 0) > 0).length; }
  catch { return 0; }
}

/**
 * The preset tier that matches a partner: the original's ten tiers pair up by
 * species generation (2 -> tiers 0-1, 3 -> 2-3, 4 -> 4-5, 5 -> 6-7, 6 -> 8-9,
 * read from the presets' own species). Unknown partners fall back to the
 * player's next tower floor band.
 */
export function tacticPracticeTier({ partnerSpecies = null, towerNext = 1, upper = false } = {}) {
  const generation = Number.isInteger(partnerSpecies) ? speciesCatalog.records[partnerSpecies]?.generationIndex : null;
  if (!Number.isInteger(generation)) return towerBand(towerNext).tier;
  const base = Math.max(0, Math.min(8, (Math.max(2, generation) - 2) * 2));
  return base + (upper ? 1 : 0);
}

/**
 * The three bouts for a series: bout 1 a single rival with the fewest SP moves
 * in the tier (a normal-attack rival), bout 2 a single rival with the most (a
 * skill rival), bout 3 a team of three. The tier matches the partner's own
 * generation (tacticPracticeTier): the singles alternate the band's lower and
 * upper tier by round, the trio stays on the lower one. `round` also rotates
 * the picks so a new series meets new rivals. No RNG is spent.
 */
export function tacticPracticeBouts({ partnerSpecies = null, towerNext = 1, round = 0 } = {}) {
  const r0 = Math.max(0, round | 0);
  const singleTier = tacticPracticeTier({ partnerSpecies, towerNext, upper: r0 % 2 === 1 });
  const teamTier = tacticPracticeTier({ partnerSpecies, towerNext });
  const poolOf = (tier) => (TIER_POOLS[tier]?.length ? TIER_POOLS[tier] : TIER_POOLS[0]);
  const pool = poolOf(singleTier), teamPool = poolOf(teamTier);
  const ranked = [...pool].sort((a, b) => presetSkillCount(a) - presetSkillCount(b) || a - b);
  const r = Math.max(0, round | 0);
  const fewest = ranked.filter((i) => presetSkillCount(i) === presetSkillCount(ranked[0]));
  const most = ranked.filter((i) => presetSkillCount(i) === presetSkillCount(ranked.at(-1)));
  const normalRival = fewest[r % fewest.length];
  // The skill rival must carry more SP moves than the normal one; the next tier up is searched when this
  // tier has none, and a tier with no such preset at all names bout 2 only as a second rival.
  const floor = presetSkillCount(normalRival);
  const richer = [pool, poolOf(Math.min(9, singleTier + 1))].map((p) => p.filter((i) => presetSkillCount(i) > floor)).find((p) => p.length) ?? [];
  const richest = richer.length ? Math.max(...richer.map(presetSkillCount)) : null;
  const skillPicks = richest === null ? most.filter((i) => i !== normalRival) : richer.filter((i) => presetSkillCount(i) === richest);
  const skillRival = skillPicks.length ? skillPicks[r % skillPicks.length] : ranked.find((i) => i !== normalRival) ?? normalRival;
  const skillKind = presetSkillCount(skillRival) > floor ? "SKILL_RIVAL" : "SECOND_RIVAL";
  const team = [];
  for (let step = 0; team.length < 3 && step < teamPool.length * 2; step++) {
    const index = teamPool[(r * 5 + step * 7 + 3) % teamPool.length];
    if (!team.includes(index)) team.push(index);
  }
  while (team.length < 3) team.push(teamPool[team.length % teamPool.length]);
  return deepFreeze([
    { bout: 1, kind: "NORMAL_RIVAL", presetIndices: [normalRival], species: [presetOf(normalRival).field00], skills: presetSkillCount(normalRival) },
    { bout: 2, kind: skillKind, presetIndices: [skillRival], species: [presetOf(skillRival).field00], skills: presetSkillCount(skillRival) },
    { bout: 3, kind: "TEAM", presetIndices: team, species: team.map((i) => presetOf(i).field00), skills: Math.max(...team.map(presetSkillCount)) }
  ]);
}

/** A fresh series for one partner. */
export function createTacticPracticeSeries({ instanceId, partnerSpecies = null, towerNext = 1, round = 0 }) {
  if (typeof instanceId !== "string" || !instanceId) throw new TypeError("TACTIC_PRACTICE_PARTNER_REQUIRED");
  return deepFreeze({ instanceId, partnerSpecies, round: Math.max(0, round | 0), towerNext,
    bouts: tacticPracticeBouts({ partnerSpecies, towerNext, round }), results: [] });
}

export const tacticPracticeNextBout = (series) => (series && series.results.length < TACTIC_PRACTICE_BOUTS ? series.results.length + 1 : null);

/**
 * One finished bout. `record` is that match's battle-plan record entry for the
 * partner (battleTacticRecord). The memory line is chosen from what happened --
 * never from the plan alone -- and only on a win.
 */
export function recordTacticPracticeBout(series, { bout, tactic, won, seconds, entry = null }) {
  if (!series || bout !== tacticPracticeNextBout(series)) return { series, result: null };
  const usedBefore = series.results.some((r) => r.tactic === tactic);
  let memory = null;
  if (won && entry) {
    if (!usedBefore && entry.counts?.skill >= 2) memory = { kind: "skillWin", skill: entry.counts.skill };
    else if (seconds <= 20) memory = { kind: "fastWin", seconds: Math.round(seconds) };
    else if (entry.hpLeftRatio > 0 && entry.hpLeftRatio <= 0.25) memory = { kind: "comeback", pct: Math.round(entry.hpLeftRatio * 100) };
  }
  const result = {
    bout, kind: series.bouts[bout - 1].kind, tactic, won: won === true, seconds,
    counts: entry ? { ...entry.counts } : null, total: entry?.total ?? null, crystals: TACTIC_PRACTICE_CRYSTALS, memory
  };
  return { series: deepFreeze({ ...series, results: [...series.results, result] }), result: deepFreeze(result) };
}
