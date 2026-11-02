// Cyber Gachapon -- OWNER_APPROVED_ADAPTATION 2026-10-29.
//
// The Shop's third tab stops selling the 30 one-per-save plugins and becomes a
// capsule machine. Eighteen of those plugins come back as stackable chips (their
// shop rows and art stay, so plugin-era saves and hunt fitting keep working);
// the Antigravity "digital metals" are the evolution metals; shop goods are the
// Bits machine's everyday prizes. This module is pure: state in, state out, and
// every random draw goes through the injected `random()` in [0, 1).
//
// Owner 2026-11-02: every chip's effect is spelled out from its own numbers,
// loaded cartridges and beacons can be taken back out, the machines also pay
// coin bags and tickets, and an R chip from the premium machine brings a supply.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  AUTOMATION_ITEMS, AUTOMATION_STACK_CAP, getAutomationItem, getAutomationRecipe, coreForModule, normalizeAutomationStacks,
  normalizeAutomationMounts, normalizeRoyalEditions, normalizeBondCarry
} from "./ranchAutomation.js";

export const CYBER_GACHA_VERSION = 1;
export const GACHA_RARITIES = Object.freeze(["R", "SR", "SSR", "UR"]);
export const GACHA_TICKET_CAP = 9999;
export const GACHA_STACK_CAP = 999;
export const GACHA_PITY_MAX = 50;
export const GACHA_WELCOME_TICKETS = 10;
export const GACHA_BLOODLINE_LIMIT = 200;

export const GACHA_MACHINES = deepFreeze({
  PREMIUM: { id: "PREMIUM", single: { tickets: 1, diamonds: 300 }, ten: { tickets: 10, diamonds: 2700 } },
  BITS: { id: "BITS", single: { bits: 50_000 }, ten: { bits: 450_000 } }
});

// kind GROWTH is used on a partner, HUNT arms the next hunt, BOUNTY arms the next win.
// `locked` chips are never offered to the synthesizer's one-tap fill.
export const GACHA_CHIPS = deepFreeze([
  { id: "chip:hp", shopRecordIndex: 56, kind: "GROWTH", rarity: "R", name: "生命超頻晶片", origin: "生命值分析器", effect: { hp: 120 } },
  { id: "chip:attack", shopRecordIndex: 55, kind: "GROWTH", rarity: "R", name: "攻擊超頻晶片", origin: "屬性分析器", effect: { attack: 8 } },
  { id: "chip:defense", shopRecordIndex: 54, kind: "GROWTH", rarity: "R", name: "防禦超頻晶片", origin: "種族分析器", effect: { defense: 8 } },
  { id: "chip:speed", shopRecordIndex: 53, kind: "GROWTH", rarity: "R", name: "速度超頻晶片", origin: "世代分析器", effect: { speed: 8 } },
  { id: "chip:personality", shopRecordIndex: 57, kind: "GROWTH", rarity: "SR", name: "性格重塑晶片", origin: "性格分析器", effect: { personality: 1 }, locked: true },
  { id: "chip:memory", shopRecordIndex: 58, kind: "GROWTH", rarity: "SR", name: "記憶體擴充晶片", origin: "容量分析器", effect: { capacity: 2 } },
  { id: "chip:core-alpha", shopRecordIndex: 59, kind: "GROWTH", rarity: "SR", name: "全能超頻核心 α", origin: "綜合分析器 α", effect: { all: 6, hp: 60, bond: 10 } },
  { id: "chip:core-beta", shopRecordIndex: 60, kind: "GROWTH", rarity: "SSR", name: "全能超頻核心 β", origin: "綜合分析器 β", effect: { all: 12, hp: 120, bond: 20 } },
  { id: "chip:core-omega", shopRecordIndex: 61, kind: "GROWTH", rarity: "UR", name: "全能超頻核心 Ω", origin: "綜合分析器 Ω", effect: { all: 25, hp: 250, bond: 40 }, locked: true, omega: true },
  { id: "chip:stun-mag", shopRecordIndex: 62, kind: "HUNT", rarity: "R", name: "高壓麻痺彈匣", origin: "射擊檢查器", effect: { stunRate: 2 } },
  { id: "chip:sure-wire", shopRecordIndex: 63, kind: "HUNT", rarity: "SR", name: "量子必中鋼索晶片", origin: "鋼索檢查器", effect: { sureCapture: true } },
  { id: "chip:rare-bait", shopRecordIndex: 64, kind: "HUNT", rarity: "R", name: "高純度異色誘餌", origin: "誘引道具檢查器", effect: { rareLure: true } },
  { id: "chip:gravity", shopRecordIndex: 65, kind: "HUNT", rarity: "R", name: "重力緩速力場匣", origin: "傷害陷阱檢查器", effect: { slow: 0.5 } },
  { id: "chip:chrono", shopRecordIndex: 66, kind: "HUNT", rarity: "SSR", name: "次元時鐘擴充匣", origin: "全道具檢查器", effect: { extraSeconds: 120 } },
  { id: "chip:bounty-alpha", shopRecordIndex: 67, kind: "BOUNTY", rarity: "R", name: "強敵賞金信標 α", origin: "世代雷達 α", effect: { bitsRate: 1.5, extraTickets: 1 } },
  { id: "chip:bounty-beta", shopRecordIndex: 68, kind: "BOUNTY", rarity: "SR", name: "強敵賞金信標 β", origin: "世代雷達 β", effect: { bitsRate: 2, extraTickets: 2 } },
  { id: "chip:bounty-gamma", shopRecordIndex: 69, kind: "BOUNTY", rarity: "SSR", name: "強敵賞金信標 γ", origin: "世代雷達 γ", effect: { bitsRate: 3, extraTickets: 3 } },
  { id: "chip:bounty-omega", shopRecordIndex: 70, kind: "BOUNTY", rarity: "UR", name: "強敵賞金信標 Ω", origin: "世代雷達 Ω", effect: { bitsRate: 5, extraTickets: 5, shards: 1 }, locked: true, omega: true }
]);
export const GACHA_PERSONALITY_COUNT = 9;
// The reshape chip offers the eight traced personalities; 8 (？？？) has no battle table.
export const GACHA_PERSONALITY_CHOICES = 8;

// Bloodline families: the badge, its ring colour and the cards' accent.
export const GACHA_BLOODLINES = deepFreeze({
  emma: { title: "艾瑪", color: "#b9a6ff", ring: 0xb9a6ff },
  beta: { title: "貝塔", color: "#37e39b", ring: 0x37e39b },
  chronoOre: { title: "時晶", color: "#53c6ff", ring: 0x53c6ff },
  chronoMetal: { title: "時鋼", color: "#9ff0ff", ring: 0x9ff0ff },
  chronoAlloy: { title: "時輪", color: "#ff5f9e", ring: 0xff5f9e },
  supernova: { title: "星核", color: "#ffb52e", ring: 0xffb52e }
});

// Names and rarities follow the Antigravity item specification that shipped
// with the art (艾瑪/貝塔/時之 families); supernova is the Codex-made completion.
const METAL_ART = "assets/production/items/digital-metals-r1/";
export const GACHA_METALS = deepFreeze([
  { id: "metal:emma-shard", family: "emma", rarity: "R", name: "艾瑪金屬碎片", art: `${METAL_ART}emma_shard_160.webp`, boost: 5 },
  { id: "metal:beta-shard", family: "beta", rarity: "R", name: "貝塔礦石碎片", art: `${METAL_ART}beta_shard_160.webp`, boost: 5 },
  { id: "metal:chrono-ore-shard", family: "chronoOre", rarity: "SR", name: "時之礦石碎片", art: `${METAL_ART}chrono_ore_shard_160.webp`, boost: 10 },
  { id: "metal:chrono-metal-shard", family: "chronoMetal", rarity: "SR", name: "時之金屬碎片", art: `${METAL_ART}chrono_metal_shard_160.webp`, boost: 10 },
  { id: "metal:chrono-alloy-shard", family: "chronoAlloy", rarity: "SR", name: "時之合金碎片", art: `${METAL_ART}chrono_alloy_shard_160.webp`, boost: 10 },
  { id: "metal:supernova-shard", family: "supernova", rarity: "SSR", name: "超新星金屬碎片", art: `${METAL_ART}supernova_shard_160.webp`, boost: 18 },
  { id: "metal:emma", family: "emma", rarity: "SSR", name: "艾瑪金屬", art: `${METAL_ART}emma_metal_160.webp`, boost: 18 },
  { id: "metal:beta", family: "beta", rarity: "SSR", name: "貝塔礦石", art: `${METAL_ART}beta_ore_160.webp`, boost: 18 },
  { id: "metal:chrono-ore", family: "chronoOre", rarity: "UR", name: "時之礦石", art: `${METAL_ART}chrono_ore_160.webp`, boost: 30 },
  { id: "metal:chrono-metal", family: "chronoMetal", rarity: "UR", name: "時之金屬", art: `${METAL_ART}chrono_metal_160.webp`, boost: 30 },
  { id: "metal:chrono-alloy", family: "chronoAlloy", rarity: "UR", name: "時之合金", art: `${METAL_ART}chrono_alloy_160.webp`, boost: 30 },
  { id: "metal:supernova", family: "supernova", rarity: "UR", name: "超新星金屬", art: `${METAL_ART}supernova_metal_160.webp`, boost: 40 }
]);

// Everyday prizes: existing stackable shop rows, delivered into the Shop's own
// quantities. Art is the Antigravity item set; maxOwned-1 rows (rope, card) stay out.
const GOODS_ART = METAL_ART;
export const GACHA_GOODS = deepFreeze([
  { id: "goods:feed", shopRecordIndex: 0, name: "飼料鮮肉", art: `${GOODS_ART}training_meat_160.webp`, quantity: [5, 12] },
  { id: "goods:protein", shopRecordIndex: 1, name: "高能蛋白質", art: `${GOODS_ART}protein_booster_160.webp`, quantity: [2, 5] },
  { id: "goods:wound", shopRecordIndex: 2, name: "外傷急救噴霧", art: `${GOODS_ART}wound_medicine_160.webp`, quantity: [3, 6] },
  { id: "goods:medicine", shopRecordIndex: 3, name: "綜合治療膠囊", art: `${GOODS_ART}medicine_capsule_160.webp`, quantity: [2, 5] },
  { id: "goods:shot", shopRecordIndex: 16, name: "手槍能量彈匣", art: `${GOODS_ART}hunt_ammo_160.webp`, quantity: [5, 12] },
  { id: "goods:paralysis", shopRecordIndex: 22, name: "麻痺特殊彈藥", art: `${GOODS_ART}paralysis_dart_160.webp`, quantity: [2, 5] },
  { id: "goods:wire", shopRecordIndex: 28, name: "磁力鋼索捲盤", art: `${GOODS_ART}magnetic_wire_160.webp`, quantity: [5, 10] },
  { id: "goods:bait", shopRecordIndex: 34, name: "大型狩獵肉餌", art: `${GOODS_ART}hunt_meat_bait_160.webp`, quantity: [3, 8] },
  { id: "goods:decoy", shopRecordIndex: 38, name: "怪獸誘餌玩偶", art: `${GOODS_ART}decoy_doll_160.webp`, quantity: [1, 3] },
  { id: "goods:light", shopRecordIndex: 40, name: "信號誘引燈筒", art: `${GOODS_ART}attract_light_160.webp`, quantity: [1, 3] },
  { id: "goods:bomb", shopRecordIndex: 42, name: "戰術爆破炸彈", art: `${GOODS_ART}tactical_bomb_160.webp`, quantity: [2, 5] },
  { id: "goods:mine", shopRecordIndex: 46, name: "十字感應地雷", art: `${GOODS_ART}proximity_mine_160.webp`, quantity: [1, 3] }
]);

// Coin prizes go straight into the shop wallet; the ticket prize into this state.
export const GACHA_BITS_BAGS = deepFreeze([
  { id: "bits:pouch", rarity: "R", name: "位元幣小錢袋", bits: 30_000 },
  { id: "bits:purse", rarity: "SR", name: "位元幣回本金袋", bits: 60_000 },
  { id: "bits:chest", rarity: "SSR", name: "位元幣暴富金箱", bits: 150_000 },
  { id: "bits:vault", rarity: "UR", name: "皇家位元幣金庫", bits: 500_000 }
]);
export const GACHA_TICKET_PRIZE = deepFreeze({ id: "ticket:gacha", rarity: "SSR", name: "數碼轉蛋券" });

const CHIP_BY_ID = new Map(GACHA_CHIPS.map((chip) => [chip.id, chip]));
const METAL_BY_ID = new Map(GACHA_METALS.map((metal) => [metal.id, metal]));
const GOODS_BY_ID = new Map(GACHA_GOODS.map((goods) => [goods.id, goods]));
const BITS_BAG_BY_ID = new Map(GACHA_BITS_BAGS.map((bag) => [bag.id, bag]));
const RANK = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });

export const getGachaChip = (id) => CHIP_BY_ID.get(id) ?? null;
export const getGachaMetal = (id) => METAL_BY_ID.get(id) ?? null;
export const getGachaGoods = (id) => GOODS_BY_ID.get(id) ?? null;
export const getGachaBitsBag = (id) => BITS_BAG_BY_ID.get(id) ?? null;
export const gachaRarityRank = (rarity) => RANK[rarity] ?? -1;

/**
 * What a chip does, one line each, in the order the bag lists them. The text
 * is a uiText template and the numbers come from the chip's own effect, so a
 * description can never drift from the rule.
 */
export function gachaChipEffectLines(chip) {
  const e = chip?.effect ?? {};
  const lines = [];
  const line = (text, params) => lines.push(Object.freeze(params ? { text, params: Object.freeze(params) } : { text }));
  if (chip?.kind === "GROWTH") {
    if (e.all) line("攻擊・防禦・智力・速度 +{n}", { n: e.all });
    if (e.attack) line("攻擊 +{n}", { n: e.attack });
    if (e.defense) line("防禦 +{n}", { n: e.defense });
    if (e.speed) line("速度 +{n}", { n: e.speed });
    if (e.hp) line("最大 HP +{n}", { n: e.hp });
    if (e.all) line("最大 TP +{n}", { n: Math.round(e.all * 2) });
    if (e.bond) line("親密度 +{n}", { n: e.bond });
    if (e.capacity) line("容量 +{n} G（部分大賽的報名條件）", { n: e.capacity });
    if (e.personality) line("自己選拍檔的新性格");
    line("HP／TP 回滿");
  } else if (chip?.kind === "HUNT") {
    if (e.stunRate) line("射擊造成的暈眩時間 ×{n}", { n: e.stunRate });
    if (e.sureCapture) line("鋼索不會磨損，拉扯傷害 ×2");
    if (e.rareLure) line("引來 1 隻本區最稀有的拍檔，出現率也不再因捕獲次數下降");
    if (e.slow) line("野生拍檔移動速度 -{n}%", { n: Math.round(e.slow * 100) });
    // Despite its name the field is hunt-clock minutes: 120 is two of the eight hours.
    if (e.extraSeconds) line("狩獵限時 +{n} 小時", { n: e.extraSeconds / 60 });
  } else if (chip?.kind === "BOUNTY") {
    line("位元幣獎金 ×{n}", { n: e.bitsRate });
    line("轉蛋券 +{n}", { n: e.extraTickets });
    if (e.shards) line("隨機金屬碎片 ×{n}", { n: e.shards });
  }
  return Object.freeze(lines);
}

/** When a chip acts: on a partner now, on the next hunt, or on the next won AI match. */
export const gachaChipTiming = (chip) => (chip?.kind === "HUNT" ? "裝填後，下一次狩獵生效"
  : chip?.kind === "BOUNTY" ? "裝填後，下一場 AI 對戰獲勝時生效" : "對牧場裡的一隻拍檔使用，立即生效");

function gachaError(message) {
  const error = new Error(message);
  error.name = "ChampionshipGachaError";
  return error;
}

const count = (value, cap) => (Number.isSafeInteger(value) && value > 0 ? Math.min(cap, value) : 0);

function normalizeStacks(value, known) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [id, n] of Object.entries(value)) {
    if (!known.has(id)) throw gachaError(`UNKNOWN_GACHA_ITEM: ${id}`);
    const stack = count(n, GACHA_STACK_CAP);
    if (stack > 0) out[id] = stack;
  }
  return out;
}

export function createCyberGachaState() {
  return normalizeCyberGacha({ version: CYBER_GACHA_VERSION });
}

/** Deny-by-default normalizer for the save's `progression.cyberGacha`. */
export function normalizeCyberGacha(value) {
  if (value == null) return createCyberGachaState();
  if (typeof value !== "object" || Array.isArray(value) || value.version !== CYBER_GACHA_VERSION) {
    throw gachaError("INVALID_CYBER_GACHA_STATE");
  }
  const allowed = new Set(["version", "tickets", "pity", "pulls", "welcome", "chips", "metals", "bloodlines", "armed", "claimed",
    "automation", "mounts", "editions", "bondCarry"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw gachaError(`UNKNOWN_CYBER_GACHA_KEY: ${key}`);
  const bloodlines = {};
  const entries = Object.entries(value.bloodlines ?? {});
  if (entries.length > GACHA_BLOODLINE_LIMIT) throw gachaError("TOO_MANY_BLOODLINES");
  for (const [instanceId, family] of entries) {
    if (!/^[\w:.-]{1,80}$/.test(instanceId) || !Object.hasOwn(GACHA_BLOODLINES, family)) throw gachaError("INVALID_BLOODLINE");
    bloodlines[instanceId] = family;
  }
  const armed = {};
  const hunt = value.armed?.hunt ?? [];
  if (!Array.isArray(hunt) || hunt.some((id) => getGachaChip(id)?.kind !== "HUNT")) throw gachaError("INVALID_ARMED_HUNT");
  if (hunt.length) armed.hunt = [...new Set(hunt)].sort();
  const bounty = value.armed?.bounty ?? null;
  if (bounty !== null && getGachaChip(bounty)?.kind !== "BOUNTY") throw gachaError("INVALID_ARMED_BOUNTY");
  if (bounty) armed.bounty = bounty;
  const claimed = value.claimed ?? [];
  if (!Array.isArray(claimed) || claimed.length > GACHA_BLOODLINE_LIMIT
    || claimed.some((key) => typeof key !== "string" || !/^[\w:.-]{1,60}$/.test(key))) throw gachaError("INVALID_CLAIMED_REWARDS");
  // Ranch automation (DIAMOND_ECONOMY_20261102): bag stacks, mounted cores, royal
  // editions and affection carry. Written only once used, so older saves keep their shape.
  const automation = normalizeAutomationStacks(value.automation);
  const mounts = normalizeAutomationMounts(value.mounts);
  const editions = normalizeRoyalEditions(value.editions);
  const bondCarry = normalizeBondCarry(value.bondCarry);
  return deepFreeze({
    version: CYBER_GACHA_VERSION,
    tickets: count(value.tickets, GACHA_TICKET_CAP),
    pity: Math.min(GACHA_PITY_MAX, count(value.pity, GACHA_PITY_MAX)),
    pulls: count(value.pulls, 1_000_000),
    welcome: value.welcome === true,
    chips: normalizeStacks(value.chips, CHIP_BY_ID),
    metals: normalizeStacks(value.metals, METAL_BY_ID),
    bloodlines,
    armed,
    claimed: [...new Set(claimed)].sort(),
    ...(Object.keys(automation).length ? { automation } : {}),
    ...(Object.keys(mounts).length ? { mounts } : {}),
    ...(Object.keys(editions).length ? { editions } : {}),
    ...(Object.keys(bondCarry).length ? { bondCarry } : {})
  });
}

function plain(state) {
  return {
    ...state, chips: { ...state.chips }, metals: { ...state.metals }, bloodlines: { ...state.bloodlines }, claimed: [...state.claimed],
    armed: { ...(state.armed.hunt ? { hunt: [...state.armed.hunt] } : {}), ...(state.armed.bounty ? { bounty: state.armed.bounty } : {}) },
    automation: { ...state.automation }, editions: { ...state.editions }, bondCarry: { ...state.bondCarry },
    mounts: Object.fromEntries(Object.entries(state.mounts ?? {}).map(([id, modules]) => [id, [...modules]]))
  };
}

/** One-time welcome: ten tickets for a new game or the first load of this build. */
export function grantGachaWelcome(state) {
  const current = normalizeCyberGacha(state);
  if (current.welcome) return { state: current, granted: 0 };
  const next = plain(current);
  next.welcome = true;
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + GACHA_WELCOME_TICKETS);
  return { state: normalizeCyberGacha(next), granted: next.tickets - current.tickets };
}

export function grantGachaTickets(state, amount) {
  const current = normalizeCyberGacha(state);
  if (!Number.isSafeInteger(amount) || amount < 0) throw gachaError("INVALID_TICKET_GRANT");
  const next = plain(current);
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + amount);
  return { state: normalizeCyberGacha(next), granted: next.tickets - current.tickets };
}

/** A once-only reward (a story chapter, a journal milestone): tickets the first time `key` is claimed. */
export function claimGachaReward(state, key, amount) {
  const current = normalizeCyberGacha(state);
  if (typeof key !== "string" || !/^[\w:.-]{1,60}$/.test(key)) throw gachaError("INVALID_REWARD_KEY");
  if (current.claimed.includes(key)) return { state: current, granted: 0 };
  const next = plain(current);
  next.claimed.push(key);
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + Math.max(0, amount | 0));
  return { state: normalizeCyberGacha(next), granted: next.tickets - current.tickets };
}

const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
const between = ([low, high], random) => low + Math.min(high - low, Math.floor(random() * (high - low + 1)));

function rollRarity(table, random) {
  let roll = random();
  for (const [rarity, weight] of table) { if (roll < weight) return rarity; roll -= weight; }
  return table[table.length - 1][0];
}

const PREMIUM_RATES = Object.freeze([["R", 0.6], ["SR", 0.28], ["SSR", 0.1], ["UR", 0.02]]);

// DIAMOND_ECONOMY_20261102: ranch automation takes this share of the SR, SSR and
// UR tiers (cores 4.2%, royal ranch 1.5%, stellar zoo 0.3% of all pulls); chips and
// metals split the rest as before. The same two draws decide every prize.
export const GACHA_AUTOMATION_SHARE = 0.15;

function premiumPrize(rarity, random) {
  const chips = GACHA_CHIPS.filter((chip) => chip.rarity === rarity);
  const metals = GACHA_METALS.filter((metal) => metal.rarity === rarity);
  const automation = AUTOMATION_ITEMS.filter((item) => item.rarity === rarity);
  // Automation sits at the top of the roll, so the metal half keeps its low rolls.
  let roll = random();
  if (automation.length && roll >= 1 - GACHA_AUTOMATION_SHARE) {
    return { kind: "AUTOMATION", id: pick(automation, random).id, rarity, quantity: 1 };
  }
  if (automation.length) roll /= 1 - GACHA_AUTOMATION_SHARE;
  // Metals are the point of the premium machine: they take half of every tier.
  const metal = metals.length && (!chips.length || roll < 0.5);
  const entry = metal ? pick(metals, random) : pick(chips, random);
  return { kind: metal ? "METAL" : "CHIP", id: entry.id, rarity, quantity: 1 };
}

// Bits machine slots (Owner 2026-11-02): supplies 45%, R chips 27%, coin bags
// 20%, one ticket 1%. The metal share is unchanged at R 6% and SR 1%.
export const GACHA_BITS_MACHINE_RATES = Object.freeze([
  ["GOODS", 0.45], ["CHIP", 0.27], ["bits:pouch", 0.12], ["bits:purse", 0.06], ["METAL_R", 0.06],
  ["bits:chest", 0.018], ["METAL_SR", 0.01], ["TICKETS", 0.01], ["bits:vault", 0.002]
]);

function bitsPrize(random) {
  const slot = rollRarity(GACHA_BITS_MACHINE_RATES, random);
  if (slot === "GOODS") {
    const goods = pick(GACHA_GOODS, random);
    return { kind: "GOODS", id: goods.id, rarity: "R", quantity: between(goods.quantity, random), shopRecordIndex: goods.shopRecordIndex };
  }
  if (slot === "CHIP") return { kind: "CHIP", id: pick(GACHA_CHIPS.filter((c) => c.rarity === "R"), random).id, rarity: "R", quantity: 1 };
  if (slot === "METAL_R") return { kind: "METAL", id: pick(GACHA_METALS.filter((m) => m.rarity === "R"), random).id, rarity: "R", quantity: 1 };
  if (slot === "METAL_SR") return { kind: "METAL", id: pick(GACHA_METALS.filter((m) => m.rarity === "SR"), random).id, rarity: "SR", quantity: 1 };
  if (slot === "TICKETS") return { kind: "TICKETS", id: GACHA_TICKET_PRIZE.id, rarity: GACHA_TICKET_PRIZE.rarity, quantity: 1 };
  const bag = getGachaBitsBag(slot);
  return { kind: "BITS", id: bag.id, rarity: bag.rarity, quantity: 1, bits: bag.bits };
}

// An R chip from the premium machine never comes alone: feed x5 or protein x1
// rides with it, alternating by pull position (no extra random draw).
const PREMIUM_R_BONUS = Object.freeze([["goods:feed", 5], ["goods:protein", 1]]);
function premiumBonus(index) {
  const [id, quantity] = PREMIUM_R_BONUS[index % PREMIUM_R_BONUS.length];
  return { kind: "GOODS", id, rarity: "R", quantity, shopRecordIndex: getGachaGoods(id).shopRecordIndex };
}

/** Ten-pull guarantee: an SR-or-better metal or an Ω chip. */
const isHighlight = (prize) => (prize.kind === "METAL" && RANK[prize.rarity] >= RANK.SR)
  || (prize.kind === "CHIP" && getGachaChip(prize.id)?.omega === true);

function guaranteedPrize(random) {
  const rarity = rollRarity([["SR", 0.62], ["SSR", 0.3], ["UR", 0.08]], random);
  const omega = rarity === "UR" && random() < 0.35;
  if (omega) return { kind: "CHIP", id: pick(GACHA_CHIPS.filter((c) => c.omega), random).id, rarity, quantity: 1 };
  return { kind: "METAL", id: pick(GACHA_METALS.filter((m) => m.rarity === rarity), random).id, rarity, quantity: 1 };
}

function addPrize(next, prize) {
  if (prize.kind === "CHIP") next.chips[prize.id] = Math.min(GACHA_STACK_CAP, (next.chips[prize.id] ?? 0) + prize.quantity);
  else if (prize.kind === "METAL") next.metals[prize.id] = Math.min(GACHA_STACK_CAP, (next.metals[prize.id] ?? 0) + prize.quantity);
  else if (prize.kind === "TICKETS") next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + prize.quantity);
  else if (prize.kind === "AUTOMATION") next.automation[prize.id] = Math.min(AUTOMATION_STACK_CAP, (next.automation[prize.id] ?? 0) + prize.quantity);
}

/**
 * One pull of `count` (1 or 10) on a machine. Tickets are spent before
 * diamonds. Returns the next state, the charge and the prizes; goods prizes
 * (and a prize's `bonus` goods) name shop rows the caller delivers into the
 * Shop's own quantities, and BITS prizes carry the coins the caller credits.
 */
export function pullCyberGacha(state, { machine, count: pulls, diamonds = null, bits = 0, random }) {
  const current = normalizeCyberGacha(state);
  const spec = GACHA_MACHINES[machine];
  if (!spec) return deepFreeze({ ok: false, reason: "UNKNOWN_MACHINE" });
  if (pulls !== 1 && pulls !== 10) return deepFreeze({ ok: false, reason: "INVALID_COUNT" });
  if (typeof random !== "function") throw gachaError("RANDOM_REQUIRED");
  const price = pulls === 1 ? spec.single : spec.ten;
  const charge = { tickets: 0, diamonds: 0, bits: 0 };
  if (machine === "PREMIUM") {
    if (current.tickets >= price.tickets) charge.tickets = price.tickets;
    else if (Number.isSafeInteger(diamonds) && diamonds >= price.diamonds) charge.diamonds = price.diamonds;
    else return deepFreeze({ ok: false, reason: diamonds === null ? "NO_TICKETS" : "INSUFFICIENT_FUNDS" });
  } else {
    if (!Number.isSafeInteger(bits) || bits < price.bits) return deepFreeze({ ok: false, reason: "INSUFFICIENT_FUNDS" });
    charge.bits = price.bits;
  }
  const prizes = [];
  for (let i = 0; i < pulls; i += 1) {
    const prize = machine === "PREMIUM" ? premiumPrize(rollRarity(PREMIUM_RATES, random), random) : bitsPrize(random);
    if (machine === "PREMIUM" && prize.kind === "CHIP" && prize.rarity === "R") prize.bonus = premiumBonus(i);
    prizes.push(prize);
  }
  if (machine === "PREMIUM" && pulls === 10 && !prizes.some(isHighlight)) prizes[9] = { ...guaranteedPrize(random), guaranteed: true };
  const next = plain(current);
  next.tickets -= charge.tickets;
  next.pulls += pulls;
  next.pity = Math.min(GACHA_PITY_MAX, next.pity + pulls);
  for (const prize of prizes) addPrize(next, prize);
  return deepFreeze({ ok: true, machine, count: pulls, charge, prizes, state: normalizeCyberGacha(next) });
}

/** At 50 core heat, one SSR/UR metal of the player's choice. */
export function claimGachaPity(state, metalId) {
  const current = normalizeCyberGacha(state);
  const metal = getGachaMetal(metalId);
  if (current.pity < GACHA_PITY_MAX) return deepFreeze({ ok: false, reason: "PITY_NOT_READY" });
  if (!metal || RANK[metal.rarity] < RANK.SSR) return deepFreeze({ ok: false, reason: "NOT_SELECTABLE" });
  const next = plain(current);
  next.pity = 0;
  addPrize(next, { kind: "METAL", id: metal.id, quantity: 1 });
  return deepFreeze({ ok: true, prize: { kind: "METAL", id: metal.id, rarity: metal.rarity, quantity: 1 }, state: normalizeCyberGacha(next) });
}

/** The synthesizer's one-tap fill: spare R chips only, never the last copy, never locked chips. */
export function autoFillSynthesizer(state) {
  const current = normalizeCyberGacha(state);
  const spare = GACHA_CHIPS.filter((chip) => chip.rarity === "R" && !chip.locked)
    .map((chip) => ({ id: chip.id, spare: (current.chips[chip.id] ?? 0) - 1 }))
    .filter((row) => row.spare > 0);
  const picked = [];
  while (picked.length < 5) {
    spare.sort((a, b) => b.spare - a.spare || a.id.localeCompare(b.id));
    if (!spare.length || spare[0].spare <= 0) break;
    picked.push(spare[0].id);
    spare[0].spare -= 1;
  }
  return picked.length === 5 ? Object.freeze(picked) : Object.freeze([]);
}

// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): three shards of one family fuse into
// that family's metal, so shards keep a way up now that SSR/UR metals unlock burst forms.
export const GACHA_SHARD_FUSION_COST = 3;
export function shardFusionTarget(shardId) {
  const shard = getGachaMetal(shardId);
  if (!shard || !shard.id.endsWith("-shard")) return null;
  return GACHA_METALS.find((metal) => metal.family === shard.family && !metal.id.endsWith("-shard")) ?? null;
}
export function fuseGachaShards(state, shardId) {
  const current = normalizeCyberGacha(state), target = shardFusionTarget(shardId);
  if (!target) return deepFreeze({ ok: false, reason: "NOT_A_SHARD" });
  if ((current.metals[shardId] ?? 0) < GACHA_SHARD_FUSION_COST) return deepFreeze({ ok: false, reason: "NOT_ENOUGH_SHARDS" });
  const next = plain(current);
  next.metals[shardId] -= GACHA_SHARD_FUSION_COST;
  addPrize(next, { kind: "METAL", id: target.id, quantity: 1 });
  return deepFreeze({ ok: true, consumed: { id: shardId, quantity: GACHA_SHARD_FUSION_COST },
    prize: { kind: "METAL", id: target.id, rarity: target.rarity, quantity: 1 }, state: normalizeCyberGacha(next) });
}

/** Five chips in, one metal out; better chips raise the odds of an SSR/UR critical. */
export function synthesizeGachaMetal(state, chipIds, { random }) {
  const current = normalizeCyberGacha(state);
  if (!Array.isArray(chipIds) || chipIds.length !== 5) return deepFreeze({ ok: false, reason: "NEEDS_FIVE_CHIPS" });
  if (typeof random !== "function") throw gachaError("RANDOM_REQUIRED");
  const need = {};
  for (const id of chipIds) {
    if (!getGachaChip(id)) return deepFreeze({ ok: false, reason: "UNKNOWN_CHIP" });
    need[id] = (need[id] ?? 0) + 1;
  }
  for (const [id, n] of Object.entries(need)) if ((current.chips[id] ?? 0) < n) return deepFreeze({ ok: false, reason: "NOT_ENOUGH_CHIPS" });
  const bonus = chipIds.reduce((sum, id) => sum + RANK[getGachaChip(id).rarity], 0) * 0.02;
  const rarity = rollRarity([["UR", 0.03 + bonus / 2], ["SSR", 0.12 + bonus], ["SR", 0.35], ["R", 1]], random);
  const metal = pick(GACHA_METALS.filter((m) => m.rarity === rarity), random);
  const next = plain(current);
  for (const [id, n] of Object.entries(need)) next.chips[id] -= n;
  addPrize(next, { kind: "METAL", id: metal.id, quantity: 1 });
  return deepFreeze({
    ok: true, consumed: [...chipIds], critical: RANK[metal.rarity] >= RANK.SSR,
    prize: { kind: "METAL", id: metal.id, rarity: metal.rarity, quantity: 1 }, state: normalizeCyberGacha(next)
  });
}

const STAT_FIELDS = Object.freeze({ attack: "060", defense: "064", wisdom: "068", speed: "06c" });

/**
 * A growth chip or a metal's enhancement on one individual's persistent words.
 * HP/TP are refilled (the chip's "fatigue clear"). Returns a plain profile copy.
 */
export function applyGachaBoost(profile, effect) {
  const p = structuredClone(profile);
  const f = p.fields;
  const add = (field, amount, cap) => { f[field] = Math.max(0, Math.min(cap, (f[field] | 0) + amount)) >>> 0; };
  if (effect.hp) { add("058", effect.hp, 9999); }
  for (const [key, field] of Object.entries(STAT_FIELDS)) {
    const amount = (effect[key] ?? 0) + (effect.all ?? 0);
    if (amount) add(field, amount, 999);
  }
  if (effect.all) add("05c", Math.round(effect.all * 2), 9999);
  if (effect.bond) add("020", effect.bond, 100);
  if (effect.capacity) add("010", effect.capacity, 99);
  // The reshape chip writes the personality the player picked; without a pick it steps to the next one.
  if (Number.isInteger(effect.personalityIndex)) f["018"] = Math.max(0, Math.min(GACHA_PERSONALITY_CHOICES - 1, effect.personalityIndex));
  else if (effect.personality) f["018"] = ((f["018"] | 0) + effect.personality) % GACHA_PERSONALITY_COUNT;
  f["050"] = f["058"];
  f["054"] = f["05c"];
  return p;
}

/** Metal used as an enhancement: every stat by its boost; SSR+ also inscribes the bloodline. */
export const metalBoostEffect = (metal) => ({ all: metal.boost, hp: metal.boost * 10, bond: Math.round(metal.boost / 2) });
export const inscribesBloodline = (metal) => RANK[metal.rarity] >= RANK.SSR;

/** Minimum metal rarity that may force an evolution out of a given generation. */
export function catalystRarityForGeneration(generation) {
  if (generation <= 2) return "R";
  if (generation === 3) return "SR";
  if (generation === 4) return "SSR";
  return "UR";
}

/** Spend one item; arms hunt/bounty chips. Profile effects are applied by the caller. */
export function spendGachaItem(state, itemId, { instanceId = null, bloodline = null } = {}) {
  const current = normalizeCyberGacha(state);
  const chip = getGachaChip(itemId), metal = getGachaMetal(itemId);
  if (!chip && !metal) return deepFreeze({ ok: false, reason: "UNKNOWN_ITEM" });
  const stacks = chip ? current.chips : current.metals;
  if ((stacks[itemId] ?? 0) < 1) return deepFreeze({ ok: false, reason: "NOT_OWNED" });
  const next = plain(current);
  (chip ? next.chips : next.metals)[itemId] -= 1;
  if (chip?.kind === "HUNT") {
    if (next.armed.hunt?.includes(itemId)) return deepFreeze({ ok: false, reason: "ALREADY_ARMED" });
    next.armed.hunt = [...(next.armed.hunt ?? []), itemId];
  }
  if (chip?.kind === "BOUNTY") {
    if (next.armed.bounty) return deepFreeze({ ok: false, reason: "ALREADY_ARMED" });
    next.armed.bounty = itemId;
  }
  if (bloodline) {
    if (!instanceId || !Object.hasOwn(GACHA_BLOODLINES, bloodline)) throw gachaError("INVALID_BLOODLINE");
    next.bloodlines[instanceId] = bloodline;
  }
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}

/** Take a loaded hunt cartridge or beacon back out before it is used; it returns to the bag. */
export function disarmGachaItem(state, itemId) {
  const current = normalizeCyberGacha(state);
  const chip = getGachaChip(itemId);
  const hunt = chip?.kind === "HUNT" && current.armed.hunt?.includes(itemId) === true;
  if (!hunt && !(chip?.kind === "BOUNTY" && current.armed.bounty === itemId)) return deepFreeze({ ok: false, reason: "NOT_ARMED" });
  const next = plain(current);
  if (hunt) {
    next.armed.hunt = next.armed.hunt.filter((id) => id !== itemId);
    if (!next.armed.hunt.length) delete next.armed.hunt;
  } else delete next.armed.bounty;
  next.chips[itemId] = Math.min(GACHA_STACK_CAP, (next.chips[itemId] ?? 0) + 1);
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}

/**
 * Win settlement: tickets drop 1-3; an armed beacon multiplies the purse, adds
 * tickets (the Ω beacon also a random metal shard) and is used up.
 */
export function settleGachaBattleWin(state, { bits = 0, tournamentChampion = false, random }) {
  const current = normalizeCyberGacha(state);
  if (typeof random !== "function") throw gachaError("RANDOM_REQUIRED");
  const beacon = current.armed.bounty ? getGachaChip(current.armed.bounty) : null;
  const bonusBits = beacon && Number.isSafeInteger(bits) && bits > 0 ? Math.round(bits * (beacon.effect.bitsRate - 1)) : 0;
  let tickets = 1 + Math.floor(random() * 3) + (beacon?.effect.extraTickets ?? 0);
  if (tournamentChampion) tickets += 3 + Math.floor(random() * 8);
  const shardPool = GACHA_METALS.filter((metal) => metal.id.endsWith("-shard"));
  const metals = Array.from({ length: beacon?.effect.shards ?? 0 }, () => pick(shardPool, random).id);
  const next = plain(current);
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + tickets);
  for (const id of metals) addPrize(next, { kind: "METAL", id, quantity: 1 });
  delete next.armed.bounty;
  return deepFreeze({ state: normalizeCyberGacha(next), tickets, bonusBits, beacon: beacon?.id ?? null, metals });
}

/** The next hunt takes every armed cartridge at once. */
export function takeArmedHuntChips(state) {
  const current = normalizeCyberGacha(state);
  const chips = current.armed.hunt ?? [];
  if (!chips.length) return { state: current, chips: [] };
  const next = plain(current);
  delete next.armed.hunt;
  return { state: normalizeCyberGacha(next), chips: [...chips] };
}

export function gachaBloodlineOf(state, instanceId) {
  const family = state?.bloodlines?.[instanceId];
  return family && GACHA_BLOODLINES[family] ? Object.freeze({ family, ...GACHA_BLOODLINES[family] }) : null;
}

// ---- Ranch automation (OWNER_APPROVED_ADAPTATION 2026-11-02, DIAMOND_ECONOMY_20261102) ----

/** Once-only keys recorded together (diamond rewards keep their ledger here); no tickets. */
export function recordGachaClaims(state, keys) {
  const current = normalizeCyberGacha(state);
  const fresh = [...new Set(keys)].filter((key) => !current.claimed.includes(key));
  if (!fresh.length) return { state: current, recorded: [] };
  for (const key of fresh) if (typeof key !== "string" || !/^[\w:.-]{1,60}$/.test(key)) throw gachaError("INVALID_REWARD_KEY");
  const next = plain(current);
  next.claimed.push(...fresh);
  return { state: normalizeCyberGacha(next), recorded: fresh };
}

// The furnace's directed recipes take one unit at a time: spare copies before the
// last copy of a kind, lower rarities first, then the largest stacks. Locked chips
// never go in, and neither does the 星核 (supernova) family, which another batch owns.
function forgeUnits(rows, need) {
  const units = rows.flatMap((row) => Array.from({ length: row.owned }, (_, copy) => ({ ...row, last: copy === 0 })));
  units.sort((a, b) => Number(a.last) - Number(b.last) || a.rank - b.rank || b.owned - a.owned || a.id.localeCompare(b.id));
  return units.length >= need ? units.slice(0, need).map((unit) => unit.id) : null;
}
export const forgeShardPool = () => GACHA_METALS.filter((metal) => metal.id.endsWith("-shard") && metal.family !== "supernova");

/** Which chips and shards a directed recipe would take, or why it cannot run yet. */
export function automationForgePlan(state, itemId) {
  const current = normalizeCyberGacha(state);
  const recipe = getAutomationRecipe(itemId);
  if (!recipe) return deepFreeze({ ok: false, reason: "UNKNOWN_RECIPE" });
  if ((current.automation?.[itemId] ?? 0) >= AUTOMATION_STACK_CAP) return deepFreeze({ ok: false, reason: "STACK_FULL" });
  // Only R and SR chips go in: an SSR/UR chip is never melted down for automation.
  const chips = forgeUnits(GACHA_CHIPS.filter((chip) => !chip.locked && RANK[chip.rarity] <= RANK.SR)
    .map((chip) => ({ id: chip.id, owned: current.chips[chip.id] ?? 0, rank: RANK[chip.rarity] })), recipe.chips);
  const shards = forgeUnits(forgeShardPool()
    .map((metal) => ({ id: metal.id, owned: current.metals[metal.id] ?? 0, rank: RANK[metal.rarity] })), recipe.shards);
  if (!chips) return deepFreeze({ ok: false, reason: "NOT_ENOUGH_CHIPS", recipe });
  if (!shards) return deepFreeze({ ok: false, reason: "NOT_ENOUGH_SHARDS", recipe });
  return deepFreeze({ ok: true, id: itemId, recipe, chips, shards });
}

/** Directed forging (the pity path): the recipe's chips and shards in, that exact item out. */
export function forgeAutomationItem(state, itemId) {
  const plan = automationForgePlan(state, itemId);
  if (!plan.ok) return plan;
  const next = plain(normalizeCyberGacha(state));
  for (const id of plan.chips) next.chips[id] -= 1;
  for (const id of plan.shards) next.metals[id] -= 1;
  addPrize(next, { kind: "AUTOMATION", id: itemId, quantity: 1 });
  return deepFreeze({ ok: true, consumed: { chips: plan.chips, shards: plan.shards },
    prize: { kind: "AUTOMATION", id: itemId, rarity: getAutomationItem(itemId).rarity, quantity: 1 }, state: normalizeCyberGacha(next) });
}

/** Mount one core from the bag on a placed cage instance. A royal edition already carries both. */
export function mountAutomationCore(state, coreId, instanceId) {
  const current = normalizeCyberGacha(state);
  const core = getAutomationItem(coreId);
  if (core?.kind !== "CORE") return deepFreeze({ ok: false, reason: "NOT_A_CORE" });
  if (typeof instanceId !== "string" || !/^[a-z0-9:_-]{3,96}$/i.test(instanceId)) return deepFreeze({ ok: false, reason: "UNKNOWN_CAGE" });
  if ((current.automation?.[coreId] ?? 0) < 1) return deepFreeze({ ok: false, reason: "NOT_OWNED" });
  if (current.editions?.[instanceId]) return deepFreeze({ ok: false, reason: "ROYAL_ALREADY_AUTOMATED" });
  const mounted = current.mounts?.[instanceId] ?? [];
  if (mounted.includes(core.module)) return deepFreeze({ ok: false, reason: "ALREADY_MOUNTED" });
  const next = plain(current);
  next.automation[coreId] -= 1;
  next.mounts[instanceId] = [...mounted, core.module];
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}

/** Take a mounted core back into the bag. */
export function unmountAutomationCore(state, module, instanceId) {
  const current = normalizeCyberGacha(state);
  const core = coreForModule(module), mounted = current.mounts?.[instanceId] ?? [];
  if (!core || !mounted.includes(module)) return deepFreeze({ ok: false, reason: "NOT_MOUNTED" });
  if ((current.automation?.[core.id] ?? 0) >= AUTOMATION_STACK_CAP) return deepFreeze({ ok: false, reason: "STACK_FULL" });
  const next = plain(current);
  next.mounts[instanceId] = mounted.filter((m) => m !== module);
  if (!next.mounts[instanceId].length) delete next.mounts[instanceId];
  next.automation[core.id] = (next.automation[core.id] ?? 0) + 1;
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}

/**
 * A confirmed facility layout. `editions` names every placed royal cage (null keeps
 * the current ones); royal cages leaving the layout go back to the bag and new ones
 * come out of it. Cores on a cage that left, or on a royal cage (which carries both
 * already), come back to the bag too.
 */
export function settleRanchAutomation(state, { editions = null, liveInstanceIds = [] } = {}) {
  const current = normalizeCyberGacha(state);
  const live = new Set(liveInstanceIds);
  const wanted = Object.fromEntries(Object.entries(editions ?? current.editions ?? {}).filter(([id]) => live.has(id)));
  const next = plain(current);
  for (const item of AUTOMATION_ITEMS.filter((entry) => entry.edition)) {
    const total = (current.automation?.[item.id] ?? 0) + Object.values(current.editions ?? {}).filter((e) => e === item.edition).length;
    const placed = Object.values(wanted).filter((e) => e === item.edition).length;
    if (placed > total) return deepFreeze({ ok: false, reason: "ROYAL_CAGE_NOT_OWNED" });
    next.automation[item.id] = Math.min(AUTOMATION_STACK_CAP, total - placed);
  }
  next.editions = wanted;
  for (const [id, modules] of Object.entries(next.mounts)) {
    if (live.has(id) && !wanted[id]) continue;
    for (const module of modules) {
      const core = coreForModule(module);
      next.automation[core.id] = Math.min(AUTOMATION_STACK_CAP, (next.automation[core.id] ?? 0) + 1);
    }
    delete next.mounts[id];
  }
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}

/**
 * One partner's affection carry after an auto-feed (tenths, 0 clears it). With `liveIds`, carries of
 * partners no longer held are dropped, so the record never outgrows the ranch.
 */
export function setGachaBondCarry(state, instanceId, tenths, liveIds = null) {
  const current = normalizeCyberGacha(state);
  const live = liveIds ? new Set(liveIds) : null;
  const stale = live ? Object.keys(current.bondCarry ?? {}).filter((id) => !live.has(id)) : [];
  if ((current.bondCarry?.[instanceId] ?? 0) === tenths && !stale.length) return current;
  const next = plain(current);
  for (const id of stale) delete next.bondCarry[id];
  if (tenths) next.bondCarry[instanceId] = tenths; else delete next.bondCarry[instanceId];
  return normalizeCyberGacha(next);
}

/** Automation items straight into the bag (a grant, not a pull). */
export function grantGachaAutomation(state, itemId, quantity = 1) {
  const current = normalizeCyberGacha(state);
  if (!getAutomationItem(itemId) || !Number.isSafeInteger(quantity) || quantity < 1) return deepFreeze({ ok: false, reason: "UNKNOWN_ITEM" });
  const next = plain(current);
  addPrize(next, { kind: "AUTOMATION", id: itemId, quantity });
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}

/** A fixed bundle paid once under `key`: automation items and tickets (the caller credits diamonds). */
export function claimGachaBundle(state, { key, items = [], tickets = 0 }) {
  const current = normalizeCyberGacha(state);
  if (typeof key !== "string" || !/^[\w:.-]{1,60}$/.test(key)) throw gachaError("INVALID_REWARD_KEY");
  if (current.claimed.includes(key)) return deepFreeze({ ok: false, reason: "ALREADY_CLAIMED" });
  const next = plain(current);
  next.claimed.push(key);
  for (const [id, quantity] of items) {
    if (!getAutomationItem(id) || !Number.isSafeInteger(quantity) || quantity < 1) throw gachaError(`UNKNOWN_GACHA_ITEM: ${id}`);
    addPrize(next, { kind: "AUTOMATION", id, quantity });
  }
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + Math.max(0, tickets | 0));
  return deepFreeze({ ok: true, state: normalizeCyberGacha(next) });
}
