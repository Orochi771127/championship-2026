// Tamer level and talent tree -- OWNER_APPROVED_ADAPTATION 2026-11-17 (LINE_FUSION_TAMER_TALENTS_DESIGN_20261117,
// docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md sections 3-4).
//
// NOT original behaviour. The original tamer has only the title rank. The product adds a tamer level 1..50 with
// its own EXP, and a tree of four lines (hunter, breeder, commander, trader). Points are WORKED OUT, never stored:
//
//   points = (level - 1) + 2 x title rank + floor(registered species / 25)        (about 76 at the top)
//
// and the save keeps only where they were spent. A whole tree costs 124, so a tamer has to choose.
// Each line has three tiers of three nodes (a rank costs one point; tiers open at 6 and 14 points spent in the
// line) and two keystones of which one may be taken (4 points, at 22 points in the line).
//
// A talent is a MODIFIER read where the game works something out (talentValue). It never writes a native
// individual, a save word or a battle code, and password, link and online battles never read it. A node is only
// offered once its effect is wired (TALENT_WIRED_KEYS): the tree shows the rest as not open yet.
//
// Pure: numbers in, numbers out. The saved record lives at progression.tamerTalents.

import { deepFreeze } from "./championshipContracts.js";

export const TAMER_LEVEL_MAX = 50;
export const TALENT_LINES = Object.freeze(["hunter", "breeder", "commander", "trader"]);
export const TALENT_TIER_GATE = deepFreeze({ 1: 0, 2: 6, 3: 14 });
export const TALENT_KEYSTONE_GATE = 22;
export const TALENT_KEYSTONE_COST = 4;
export const TALENT_RESPEC_CRYSTALS = 500;
export const TALENT_TREE_POINTS = 124;
const COUNT_MAX = 1e9;

/** EXP needed to go from `level` to `level + 1`. */
export function tamerExpRequired(level) {
  return Math.round(40 * Math.pow(Math.max(1, Math.min(TAMER_LEVEL_MAX, level)), 1.3));
}

/** What an action pays in tamer EXP (plan 3.2). A loss pays 40 % of a win. */
export const TAMER_EXP = deepFreeze({
  CAPTURE: 20, FUSION: 8, CARE: 2, CARE_DAILY_CAP: 60, JOURNEY_STAR: 15, TOWER_FIRST_CLEAR: 40, DAILY_FIRST: 100,
  BATTLE: { TITLE: 60, CHAMPIONSHIP: 60, FREE: 30, ARENA: 30, PRACTICE: 5 }, LOSS_SHARE: 0.4,
  GRADE: { S: 1.6, A: 1.25, B: 1, C: 0.8 }
});
export function tamerCaptureExp(grade) { return Math.round(TAMER_EXP.CAPTURE * (TAMER_EXP.GRADE[grade] ?? 1)); }
export function tamerBattleExp(kind, won) {
  const base = TAMER_EXP.BATTLE[kind];
  return base ? Math.max(1, Math.round(base * (won ? 1 : TAMER_EXP.LOSS_SHARE))) : 0;
}

const node = (id, tier, key, per, extra = {}) => ({ id, line: id.split(".")[0], tier, key, per, max: 3, cost: 1, ...extra });
/** The tree. `key` is what talentValue reads; `per` is the value one rank adds. */
export const TALENT_NODES = deepFreeze([
  node("hunter.breath", 1, "huntSeconds", 5),
  node("hunter.ropeCare", 1, "ropeWearPercent", -10),
  node("hunter.memory", 1, "memoryG", 8),
  node("hunter.herdSense", 2, "herdExtra", 1),
  node("hunter.appraise", 2, "gradeHighPercent", 10),
  node("hunter.wildSense", 2, "elitePercent", 30),
  node("hunter.swift", 3, "tamerSpeedPercent", 5),
  node("hunter.steady", 3, "paralysisPercent", 10),
  node("hunter.thrift", 3, "ammoSavePercent", 10),
  node("breeder.care", 1, "growthPercent", 4),
  node("breeder.soothe", 1, "moodDecayPercent", -10),
  node("breeder.nightWatch", 1, "nightDisturbPercent", -15),
  node("breeder.syncFusion", 2, "fusionExpPercent", 10),
  node("breeder.lineAffinity", 2, "fusionLowerLine", 0.1),
  node("breeder.automation", 2, "coreTimePercent", 10),
  node("breeder.strollLuck", 3, "strollExtraPercent", 10),
  node("breeder.herbal", 3, "supplementPercent", 10),
  node("breeder.lasting", 3, "supplementBattles", 1),
  node("commander.syncTraining", 1, "syncExpPercent", 5),
  node("commander.opening", 1, "openingTpPercent", 5),
  node("commander.goodMood", 1, "moodCapPercent", 1),
  node("commander.lumen", 2, "resonanceLumenPercent", 20),
  node("commander.iron", 2, "resonanceIronPercent", 20),
  node("commander.rift", 2, "resonanceRiftPercent", 20),
  node("commander.charge", 3, "openingAwakening", 2),
  node("commander.adversity", 3, "lowHpDefensePercent", 5),
  node("commander.finisher", 3, "ultimatePercent", 3),
  node("trader.haggle", 1, "shopBitsPercent", -3),
  node("trader.bounty", 1, "battleBitsPercent", 5),
  node("trader.crystal", 1, "crystalPercent", 10),
  node("trader.patrol", 2, "patrolPercent", 10),
  node("trader.tower", 2, "towerRewardPercent", 10),
  node("trader.regular", 2, "firstSupplyDiscountPercent", 15),
  node("trader.belt", 3, "supplySlots", 1, { max: 1, cost: 3 }),
  node("trader.scavenge", 3, "scavengePercent", 10),
  node("trader.appraisal", 3, "strollBitsPercent", 10)
]);
/** Two keystones a line; a tamer takes one. */
export const TALENT_KEYSTONES = deepFreeze([
  { id: "hunter.keenEye", line: "hunter" }, { id: "hunter.chainHunt", line: "hunter" },
  { id: "breeder.inherit", line: "breeder" }, { id: "breeder.extract", line: "breeder" },
  { id: "commander.pureFaction", line: "commander" }, { id: "commander.triColor", line: "commander" },
  { id: "trader.bountyHunter", line: "trader" }, { id: "trader.peddler", line: "trader" }
]);
const nodeById = new Map(TALENT_NODES.map((entry) => [entry.id, entry]));
const keystoneById = new Map(TALENT_KEYSTONES.map((entry) => [entry.id, entry]));
export function getTalentNode(id) { return nodeById.get(id) ?? null; }
export function getTalentKeystone(id) { return keystoneById.get(id) ?? null; }

/**
 * Effects the game reads today. A node or keystone outside this set is shown as not open yet and cannot be
 * learned, so a point is never spent on something that does nothing. Each batch that wires a hook adds its key.
 */
export const TALENT_WIRED_KEYS = new Set([
  // T1 (TAMER_TALENTS_20261117): each of these is read where the game works the value out.
  "memoryG", "huntSeconds", "herdExtra", "gradeHighPercent",
  "growthPercent", "nightDisturbPercent", "fusionExpPercent", "fusionLowerLine",
  "syncExpPercent", "crystalPercent",
  // T2 (TAMER_TALENTS_T2_20261118): the core clock, the supplement talents and the trader's battle and journey pay.
  "coreTimePercent", "supplementPercent", "supplementBattles",
  "battleBitsPercent", "patrolPercent", "towerRewardPercent", "firstSupplyDiscountPercent", "supplySlots",
  // T3 (TAMER_TALENTS_T3_20261118): the commander line in the auto battle, and the hunter's elite sense.
  "openingTpPercent", "moodCapPercent", "resonanceLumenPercent", "resonanceIronPercent", "resonanceRiftPercent",
  "lowHpDefensePercent", "ultimatePercent", "elitePercent",
  // T4 (TAMER_TALENTS_T4_20261118): the shop's Bits prices, what a hunt and a stroll bring back.
  "shopBitsPercent", "scavengePercent", "strollBitsPercent", "strollExtraPercent",
  // T5 (TAMER_TALENTS_T5_20261118)
  "moodDecayPercent"
]);
// T5 (TAMER_TALENTS_T5_20261118): the first keystones. A line takes one of its two.
export const TALENT_WIRED_KEYSTONES = new Set(["commander.pureFaction", "commander.triColor", "trader.bountyHunter"]);
/** What the wired keystones are worth, in one place for the rules, the copy and the tests. */
export const KEYSTONE_RULES = deepFreeze({
  pureFactionPercent: 50,             // 純色陣營: three of one faction make that resonance's own bonus half as large again
  triColor: { attackPercent: 114, defensePercent: 114, rewardPercent: 125 }, // 三色指揮: 108 / 108 / 115 become these
  bountyHunterPercent: 50             // 賞金獵人: the bounty beacon's extra Bits half as large again
});
export function talentOpen(id) {
  const entry = nodeById.get(id);
  return entry ? TALENT_WIRED_KEYS.has(entry.key) : TALENT_WIRED_KEYSTONES.has(id);
}

const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? Math.min(value, COUNT_MAX) : 0);
const level = (value) => (Number.isSafeInteger(value) ? Math.max(1, Math.min(TAMER_LEVEL_MAX, value)) : 1);

export function createTamerTalentState() {
  return { version: 1, level: 1, exp: 0, nodes: {}, keystones: {}, respecs: 0 };
}

/** The day's once-only and capped tamer EXP: `day` is the player's local date, YYYY-MM-DD. */
function normalizeDaily(value) {
  if (!value || typeof value !== "object" || typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  return { day: value.day, care: Math.min(TAMER_EXP.CARE_DAILY_CAP, count(value.care)), hunt: value.hunt === true, battle: value.battle === true };
}

/** Accept only the known shape; anything else starts again at Lv.1 with nothing spent. */
export function normalizeTamerTalents(value) {
  const base = createTamerTalentState();
  if (!value || typeof value !== "object" || value.version !== 1) return base;
  const lv = level(value.level);
  const state = { version: 1, level: lv, exp: lv >= TAMER_LEVEL_MAX ? 0 : Math.min(count(value.exp), tamerExpRequired(lv) - 1),
    nodes: {}, keystones: {}, respecs: count(value.respecs) };
  for (const entry of TALENT_NODES) {
    const rank = value.nodes?.[entry.id];
    if (Number.isSafeInteger(rank) && rank > 0) state.nodes[entry.id] = Math.min(entry.max, rank);
  }
  for (const line of TALENT_LINES) {
    const chosen = keystoneById.get(value.keystones?.[line]);
    if (chosen && chosen.line === line) state.keystones[line] = chosen.id;
  }
  const daily = normalizeDaily(value.daily);
  if (daily) state.daily = daily;
  return state;
}

/**
 * Tamer EXP that is counted by the day (plan 3.2): a care action pays 2 up to 60 a day, the day's first hunt
 * and first battle 100 each. Returns the state with the day's record and the EXP to grant (0 when used up).
 */
export function tamerDailyExp(state, day, kind) {
  const current = normalizeTamerTalents(state);
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { state: current, amount: 0 };
  const daily = current.daily?.day === day ? { ...current.daily } : { day, care: 0, hunt: false, battle: false };
  let amount = 0;
  if (kind === "CARE") { amount = Math.max(0, Math.min(TAMER_EXP.CARE, TAMER_EXP.CARE_DAILY_CAP - daily.care)); daily.care += amount; }
  else if (kind === "HUNT" && !daily.hunt) { amount = TAMER_EXP.DAILY_FIRST; daily.hunt = true; }
  else if (kind === "BATTLE" && !daily.battle) { amount = TAMER_EXP.DAILY_FIRST; daily.battle = true; }
  return amount > 0 ? { state: { ...current, daily }, amount } : { state: current, amount: 0 };
}

/** Points a tamer has to spend: worked out from the level, the title rank and the Dex, never stored. */
export function tamerTalentPoints({ level: lv = 1, rank = 0, registered = 0 } = {}) {
  return (level(lv) - 1) + 2 * Math.max(0, Math.min(9, count(rank))) + Math.floor(count(registered) / 25);
}

/** Points spent in one line (keystone included), and in all. */
export function talentSpentInLine(state, line) {
  const current = normalizeTamerTalents(state);
  let spent = current.keystones[line] ? TALENT_KEYSTONE_COST : 0;
  for (const entry of TALENT_NODES) if (entry.line === line) spent += (current.nodes[entry.id] ?? 0) * entry.cost;
  return spent;
}
export function talentSpent(state) { return TALENT_LINES.reduce((sum, line) => sum + talentSpentInLine(state, line), 0); }

/** Points spent in a line's nodes only: what opens its tiers and its keystones. */
function nodePointsInLine(current, line) {
  let spent = 0;
  for (const entry of TALENT_NODES) if (entry.line === line) spent += (current.nodes[entry.id] ?? 0) * entry.cost;
  return spent;
}

/** Why `id` cannot take one more rank with `points` to spend in all; null when it can. */
export function talentRefusal(state, id, points) {
  const current = normalizeTamerTalents(state), entry = nodeById.get(id);
  if (!entry) return "TALENT_UNKNOWN";
  if (!talentOpen(id)) return "TALENT_NOT_OPEN";
  if ((current.nodes[id] ?? 0) >= entry.max) return "TALENT_MAX";
  if (nodePointsInLine(current, entry.line) < TALENT_TIER_GATE[entry.tier]) return "TALENT_TIER_LOCKED";
  if (talentSpent(current) + entry.cost > count(points)) return "TALENT_NO_POINTS";
  return null;
}
/** One more rank of `id`; null when refused. */
export function learnTalent(state, id, points) {
  if (talentRefusal(state, id, points)) return null;
  const current = normalizeTamerTalents(state);
  return { ...current, nodes: { ...current.nodes, [id]: (current.nodes[id] ?? 0) + 1 } };
}

export function keystoneRefusal(state, id, points) {
  const current = normalizeTamerTalents(state), entry = keystoneById.get(id);
  if (!entry) return "TALENT_UNKNOWN";
  if (!talentOpen(id)) return "TALENT_NOT_OPEN";
  if (current.keystones[entry.line]) return current.keystones[entry.line] === id ? "TALENT_MAX" : "TALENT_KEYSTONE_TAKEN";
  if (nodePointsInLine(current, entry.line) < TALENT_KEYSTONE_GATE) return "TALENT_TIER_LOCKED";
  if (talentSpent(current) + TALENT_KEYSTONE_COST > count(points)) return "TALENT_NO_POINTS";
  return null;
}
export function chooseKeystone(state, id, points) {
  if (keystoneRefusal(state, id, points)) return null;
  const current = normalizeTamerTalents(state), entry = keystoneById.get(id);
  return { ...current, keystones: { ...current.keystones, [entry.line]: id } };
}

/** Crystals a respec costs now: the first is free. */
export function talentRespecCost(state) { return normalizeTamerTalents(state).respecs > 0 ? TALENT_RESPEC_CRYSTALS : 0; }
/** Every point back, keystones included. Null when nothing is spent. */
export function respecTalents(state) {
  const current = normalizeTamerTalents(state);
  if (talentSpent(current) === 0) return null;
  return { ...current, nodes: {}, keystones: {}, respecs: current.respecs + 1 };
}

/** Add tamer EXP. Past Lv.50 it is dropped. Returns the new state and what changed. */
export function grantTamerExp(state, amount) {
  const current = normalizeTamerTalents(state);
  let lv = current.level, exp = current.exp, left = count(Math.round(amount));
  const granted = left;
  while (left > 0 && lv < TAMER_LEVEL_MAX) {
    const need = tamerExpRequired(lv) - exp;
    if (left < need) { exp += left; left = 0; break; }
    left -= need; lv += 1; exp = 0;
  }
  if (lv >= TAMER_LEVEL_MAX) exp = 0;
  return { state: { ...current, level: lv, exp },
    gain: deepFreeze({ amount: granted, before: { level: current.level, exp: current.exp }, after: { level: lv, exp,
      next: lv >= TAMER_LEVEL_MAX ? 0 : tamerExpRequired(lv) }, levels: lv - current.level }) };
}

/** The summed value of an effect key over the learned nodes (0 when none). */
export function talentValue(state, key) {
  const current = normalizeTamerTalents(state);
  let total = 0;
  for (const entry of TALENT_NODES) if (entry.key === key) total += (current.nodes[entry.id] ?? 0) * entry.per;
  return Math.round(total * 1000) / 1000;
}
export function hasKeystone(state, id) {
  const entry = keystoneById.get(id);
  return Boolean(entry) && normalizeTamerTalents(state).keystones[entry.line] === id;
}

/**
 * Title matches and championships count only the first `6 + 3 x rank` commander points, in the tree's own order:
 * tier one, two, three, each node rank by rank across the tier, the keystone last (plan 4.3). The other three
 * lines do not act in battle. Returns the state a capped battle reads.
 */
export function commanderCappedTalents(state, rank) {
  const current = normalizeTamerTalents(state);
  let budget = 6 + 3 * Math.max(0, Math.min(9, count(rank)));
  const nodes = {};
  for (const [id, value] of Object.entries(current.nodes)) if (!id.startsWith("commander.")) nodes[id] = value;
  for (const tier of [1, 2, 3]) {
    const tierNodes = TALENT_NODES.filter((entry) => entry.line === "commander" && entry.tier === tier);
    for (let rankIndex = 1; rankIndex <= 3; rankIndex++) for (const entry of tierNodes) {
      if ((current.nodes[entry.id] ?? 0) < rankIndex) continue;
      if (budget < entry.cost) { budget = 0; continue; }
      budget -= entry.cost; nodes[entry.id] = rankIndex;
    }
  }
  const keystones = { ...current.keystones };
  if (keystones.commander && budget < TALENT_KEYSTONE_COST) delete keystones.commander;
  return { ...current, nodes, keystones };
}
