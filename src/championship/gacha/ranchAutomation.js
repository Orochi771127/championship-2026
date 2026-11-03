// Ranch automation -- OWNER_APPROVED_ADAPTATION 2026-11-02 (DIAMOND_ECONOMY_20261102).
//
// The Bits shop's zoo (24) and ranch (25) no longer feed and clean by
// themselves: that convenience now comes from the gachapon. Two SR attachments
// (Owner 2026-11-03: the auto-feeder and the auto-cleaner) mount on any placed
// cage instance of all 37 kinds and come off again at no cost; two gacha-only royal cages are editions of the
// zoo and the ranch that keep the base cage's footprint, ground, walk map and
// art, and carry both cores built in, 30% faster sleep and +3 beast points per
// training. The five-in-one furnace also forges every item from chips and
// shards, so automation never depends on luck alone.
//
// Pure: state in, state out. The cage instances themselves stay in cageEdit;
// this module only records which instance carries what.
import { deepFreeze } from "../contracts/championshipContracts.js";

const ART = "assets/production/items/ranch-automation-r1/";
export const FOUNDER_PACK_ART = `${ART}founder_pack_160.webp`;

export const AUTOMATION_MODULES = Object.freeze({ CLEAN: "AUTO_CLEAN", FEED: "AUTO_FEED" });
export const ROYAL_EDITIONS = Object.freeze({ RANCH: "ROYAL_RANCH", ZOO: "STELLAR_ZOO" });

export const AUTOMATION_ITEMS = deepFreeze([
  { id: "auto:clean-core", kind: "CORE", rarity: "SR", name: "奈米自動清掃機", module: "AUTO_CLEAN", art: `${ART}auto_clean_core_160.webp` },
  { id: "auto:feed-core", kind: "CORE", rarity: "SR", name: "智慧自動給食機", module: "AUTO_FEED", art: `${ART}auto_feed_core_160.webp` },
  { id: "auto:royal-ranch", kind: "ROYAL_CAGE", rarity: "SSR", name: "全自動皇家牧場", edition: "ROYAL_RANCH", baseDefinition: 25, art: `${ART}royal_ranch_160.webp` },
  { id: "auto:stellar-zoo", kind: "ROYAL_CAGE", rarity: "UR", name: "全自動星際動物園", edition: "STELLAR_ZOO", baseDefinition: 24, art: `${ART}stellar_zoo_160.webp` }
]);

export const AUTOMATION_RULES = deepFreeze({
  cleanBits: 50,            // every waste an automated cage clears pays this many bits
  feedBondTenths: 24,       // eating to full is +2 affection; +20% makes an auto-feed +2.4, carried in tenths
  hungrySatiety: 2,         // the native hungry flag (nativeRaisingGrowth: satiety <= 2)
  royalSleepPercent: 130,   // sleep recovers 30% faster in a royal cage
  royalTrainingPoints: 3,   // extra beast-family points per training in a royal cage
  trainingKind: 4           // native training kind 4 = 獸 (beast) family counter
});

// Directed forging (pity): fixed inputs, fixed output. Shards exclude the 星核
// (supernova) family, which another batch owns. About ten premium pulls buy a core.
export const AUTOMATION_RECIPES = deepFreeze([
  { id: "auto:clean-core", chips: 5, shards: 2 },
  { id: "auto:feed-core", chips: 5, shards: 2 },
  { id: "auto:royal-ranch", chips: 5, shards: 6 },
  { id: "auto:stellar-zoo", chips: 5, shards: 10 }
]);

export const AUTOMATION_STACK_CAP = 99;
export const AUTOMATION_INSTANCE_LIMIT = 120;
const INSTANCE_ID = /^[a-z0-9:_-]{3,96}$/i;

const ITEM_BY_ID = new Map(AUTOMATION_ITEMS.map((item) => [item.id, item]));
const ITEM_BY_EDITION = new Map(AUTOMATION_ITEMS.filter((item) => item.edition).map((item) => [item.edition, item]));
const RECIPE_BY_ID = new Map(AUTOMATION_RECIPES.map((recipe) => [recipe.id, recipe]));
const MODULE_ORDER = Object.freeze([AUTOMATION_MODULES.CLEAN, AUTOMATION_MODULES.FEED]);

export const getAutomationItem = (id) => ITEM_BY_ID.get(id) ?? null;
export const automationItemForEdition = (edition) => ITEM_BY_EDITION.get(edition) ?? null;
export const getAutomationRecipe = (id) => RECIPE_BY_ID.get(id) ?? null;
export const coreForModule = (module) => AUTOMATION_ITEMS.find((item) => item.module === module) ?? null;

function automationError(message) {
  const error = new Error(message);
  error.name = "ChampionshipRanchAutomationError";
  return error;
}

/** Bag stacks of unmounted cores and unplaced royal cages. */
export function normalizeAutomationStacks(value) {
  const out = {};
  if (value == null) return out;
  if (typeof value !== "object" || Array.isArray(value)) throw automationError("INVALID_AUTOMATION_STACKS");
  for (const [id, n] of Object.entries(value)) {
    if (!ITEM_BY_ID.has(id)) throw automationError(`UNKNOWN_AUTOMATION_ITEM: ${id}`);
    if (Number.isSafeInteger(n) && n > 0) out[id] = Math.min(AUTOMATION_STACK_CAP, n);
  }
  return out;
}

/** Cores mounted on cage instances: {instanceId: ["AUTO_CLEAN", "AUTO_FEED"]}. */
export function normalizeAutomationMounts(value) {
  const out = {};
  if (value == null) return out;
  if (typeof value !== "object" || Array.isArray(value)) throw automationError("INVALID_AUTOMATION_MOUNTS");
  const entries = Object.entries(value);
  if (entries.length > AUTOMATION_INSTANCE_LIMIT) throw automationError("TOO_MANY_AUTOMATION_MOUNTS");
  for (const [instanceId, modules] of entries) {
    if (!INSTANCE_ID.test(instanceId) || !Array.isArray(modules) || modules.some((m) => !MODULE_ORDER.includes(m))
      || new Set(modules).size !== modules.length) throw automationError("INVALID_AUTOMATION_MOUNT");
    if (modules.length) out[instanceId] = MODULE_ORDER.filter((m) => modules.includes(m));
  }
  return out;
}

/** Royal editions of placed cage instances: {instanceId: "ROYAL_RANCH" | "STELLAR_ZOO"}. */
export function normalizeRoyalEditions(value) {
  const out = {};
  if (value == null) return out;
  if (typeof value !== "object" || Array.isArray(value)) throw automationError("INVALID_ROYAL_EDITIONS");
  const entries = Object.entries(value);
  if (entries.length > AUTOMATION_INSTANCE_LIMIT) throw automationError("TOO_MANY_ROYAL_EDITIONS");
  for (const [instanceId, edition] of entries) {
    if (!INSTANCE_ID.test(instanceId) || !ITEM_BY_EDITION.has(edition)) throw automationError("INVALID_ROYAL_EDITION");
    out[instanceId] = edition;
  }
  return out;
}

/** Affection carried below one point per partner, in tenths (0-9). */
export function normalizeBondCarry(value) {
  const out = {};
  if (value == null) return out;
  if (typeof value !== "object" || Array.isArray(value)) throw automationError("INVALID_BOND_CARRY");
  const entries = Object.entries(value);
  if (entries.length > AUTOMATION_INSTANCE_LIMIT) throw automationError("TOO_MANY_BOND_CARRIES");
  for (const [instanceId, tenths] of entries) {
    if (!/^[\w:.-]{1,80}$/.test(instanceId) || !Number.isInteger(tenths) || tenths < 0 || tenths > 9) throw automationError("INVALID_BOND_CARRY");
    if (tenths) out[instanceId] = tenths;
  }
  return out;
}

/**
 * What one cage instance does by itself. A royal edition carries both cores
 * plus its own bonuses; a plain cage only what is mounted on it.
 */
export function cageAutomation(state, instanceId) {
  const edition = instanceId ? state?.editions?.[instanceId] ?? null : null;
  const mounted = instanceId ? state?.mounts?.[instanceId] ?? [] : [];
  const royal = edition !== null;
  return Object.freeze({
    instanceId: instanceId ?? null,
    edition,
    royal,
    clean: royal || mounted.includes(AUTOMATION_MODULES.CLEAN),
    feed: royal || mounted.includes(AUTOMATION_MODULES.FEED),
    mounted: Object.freeze([...mounted]),
    sleepPercent: royal ? AUTOMATION_RULES.royalSleepPercent : 100,
    trainingPoints: royal ? AUTOMATION_RULES.royalTrainingPoints : 0
  });
}

/** Every cage instance that runs something by itself, for the ranch badges and the editor. */
export function automatedCages(state, instanceIds) {
  return Object.freeze(instanceIds.map((id) => cageAutomation(state, id)).filter((entry) => entry.clean || entry.feed));
}

/** Count of royal cages of one edition, in the bag and placed. */
export function royalTotal(state, edition) {
  const item = automationItemForEdition(edition);
  if (!item) return 0;
  return (state?.automation?.[item.id] ?? 0) + Object.values(state?.editions ?? {}).filter((e) => e === edition).length;
}

/**
 * Affection from one auto-feed: whole points now, tenths carried for the next
 * one (2.4 = +2, +2, +3, +2, +3 …).
 */
export function autoFeedAffection(carryTenths = 0) {
  const total = (Number.isInteger(carryTenths) && carryTenths > 0 ? carryTenths : 0) + AUTOMATION_RULES.feedBondTenths;
  return Object.freeze({ points: Math.floor(total / 10), carry: total % 10 });
}

/** Extra sleep recovery for one step in a royal cage, carried in hundredths. */
export function royalSleepBonus(units, carryHundredths = 0, percent = AUTOMATION_RULES.royalSleepPercent) {
  const total = (carryHundredths | 0) + Math.max(0, units | 0) * Math.max(0, percent - 100);
  return Object.freeze({ units: Math.floor(total / 100), carry: total % 100 });
}

/**
 * What an automation item does, one line each, from its own numbers (the bag,
 * the prize pool preview and the furnace read these; uiText templates).
 */
export function automationEffectLines(item) {
  const lines = [];
  const line = (text, params) => lines.push(Object.freeze(params ? { text, params: Object.freeze(params) } : { text }));
  if (item?.module === AUTOMATION_MODULES.CLEAN) {
    line("掛載到任一籠舍：大便一出現就自動清掉（0 照顧失誤）");
    line("每次自動清掃 +{n} 位元幣", { n: AUTOMATION_RULES.cleanBits });
  } else if (item?.module === AUTOMATION_MODULES.FEED) {
    line("掛載到任一籠舍：拍檔肚子餓時自動投餵到飽");
    line("每次自動投餵，親密度 +{n}（比餵飽多 20%）", { n: AUTOMATION_RULES.feedBondTenths / 10 });
  } else if (item?.edition) {
    line(item.baseDefinition === 25 ? "轉蛋限定奇觀籠舍：牧場的皇家版本" : "轉蛋限定奇觀籠舍：動物園的星際版本");
    line("內建全自動給食＋全自動清掃");
    line("籠內拍檔睡眠（疲勞）恢復加快 {n}%", { n: AUTOMATION_RULES.royalSleepPercent - 100 });
    line("每次訓練，獸系覺醒點數額外 +{n}", { n: AUTOMATION_RULES.royalTrainingPoints });
  }
  return Object.freeze(lines);
}

/** Where an automation item is used. */
export const automationTiming = (item) => (item?.kind === "CORE"
  ? "在背包選一座已放置的籠舍掛載，可隨時卸下"
  : "到「設施配置」的托盤放上地圖，以金框標示");

/** Royal cages held (bag + placed) by base cage definition: each is one more copy of that cage. */
export function royalCopiesByDefinition(state) {
  const copies = new Map();
  for (const item of AUTOMATION_ITEMS) {
    if (!item.edition) continue;
    const n = royalTotal(state, item.edition);
    if (n > 0) copies.set(item.baseDefinition, (copies.get(item.baseDefinition) ?? 0) + n);
  }
  return copies;
}
