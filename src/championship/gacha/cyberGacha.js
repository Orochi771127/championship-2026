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
  AUTOMATION_ITEMS, AUTOMATION_RULES, AUTOMATION_STACK_CAP, getAutomationItem, getAutomationRecipe, coreForModule, coreModules,
  normalizeAutomationStacks, normalizeAutomationMounts, normalizeAutomationRuns, normalizeRoyalEditions, normalizeBondCarry
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
  // GACHA_FULL_EFFECTS_20261109 (Owner 2026-11-09): the growth numbers, the race/faction points (raceExp /
  // factionExp go to the partner's own evolution counters), fatigue, growth age and care mistakes follow the
  // Owner's sheet. The capacity chip keeps raising +0x10: that word is a tournament entry minimum, so more is better.
  { id: "chip:hp", shopRecordIndex: 56, kind: "GROWTH", rarity: "R", name: "生命超頻晶片", origin: "生命值分析器", effect: { hp: 120, fatigue: true } },
  { id: "chip:attack", shopRecordIndex: 55, kind: "GROWTH", rarity: "R", name: "攻擊超頻晶片", origin: "屬性分析器", effect: { attack: 18, raceExp: 15 } },
  { id: "chip:defense", shopRecordIndex: 54, kind: "GROWTH", rarity: "R", name: "防禦超頻晶片", origin: "種族分析器", effect: { defense: 18, factionExp: 15 } },
  { id: "chip:speed", shopRecordIndex: 53, kind: "GROWTH", rarity: "R", name: "速度超頻晶片", origin: "世代分析器", effect: { speed: 18, wisdom: 12, age: 0.15 } },
  { id: "chip:personality", shopRecordIndex: 57, kind: "GROWTH", rarity: "SR", name: "性格重塑晶片", origin: "性格分析器", effect: { personality: 1 }, locked: true },
  { id: "chip:memory", shopRecordIndex: 58, kind: "GROWTH", rarity: "SR", name: "記憶體擴充晶片", origin: "容量分析器", effect: { capacity: 2 } },
  { id: "chip:core-alpha", shopRecordIndex: 59, kind: "GROWTH", rarity: "SR", name: "全能超頻核心 α", origin: "綜合分析器 α", effect: { all: 12, hp: 80, bond: 10 } },
  { id: "chip:core-beta", shopRecordIndex: 60, kind: "GROWTH", rarity: "SSR", name: "全能超頻核心 β", origin: "綜合分析器 β", effect: { all: 25, hp: 180, bond: 25, careMistakes: -1 } },
  { id: "chip:core-omega", shopRecordIndex: 61, kind: "GROWTH", rarity: "UR", name: "全能超頻核心 Ω", origin: "綜合分析器 Ω", effect: { all: 50, hp: 350, bond: 100, careMistakes: "CLEAR", everyExp: 20 }, locked: true, omega: true },
  // The sure wire downs the first partner it ropes this hunt, and that partner keeps +15% on its four stats.
  { id: "chip:stun-mag", shopRecordIndex: 62, kind: "HUNT", rarity: "R", name: "高壓麻痺彈匣", origin: "射擊檢查器", effect: { stunRate: 2 } },
  { id: "chip:sure-wire", shopRecordIndex: 63, kind: "HUNT", rarity: "SR", name: "量子必中鋼索晶片", origin: "鋼索檢查器", effect: { sureCapture: true, captureStatPercent: 15 } },
  { id: "chip:rare-bait", shopRecordIndex: 64, kind: "HUNT", rarity: "R", name: "高純度異色誘餌", origin: "誘引道具檢查器", effect: { rareLure: true } },
  { id: "chip:gravity", shopRecordIndex: 65, kind: "HUNT", rarity: "R", name: "重力緩速力場匣", origin: "傷害陷阱檢查器", effect: { slow: 0.5 } },
  // `extraSeconds` is hunt-clock minutes (the field keeps its name): 288 minutes are 120 real seconds of the
  // 200-second real-time hunt (16 clock units a frame, 400 a minute).
  { id: "chip:chrono", shopRecordIndex: 66, kind: "HUNT", rarity: "SSR", name: "次元時鐘擴充匣", origin: "全道具檢查器", effect: { extraSeconds: 288 } },
  // battles: extra won battles on every partner who fought; exp: race and faction points on each of them.
  { id: "chip:bounty-alpha", shopRecordIndex: 67, kind: "BOUNTY", rarity: "R", name: "強敵賞金信標 α", origin: "世代雷達 α", effect: { bitsRate: 1.5, extraTickets: 1, exp: 8 } },
  { id: "chip:bounty-beta", shopRecordIndex: 68, kind: "BOUNTY", rarity: "SR", name: "強敵賞金信標 β", origin: "世代雷達 β", effect: { bitsRate: 2, extraTickets: 2, battles: 2 } },
  { id: "chip:bounty-gamma", shopRecordIndex: 69, kind: "BOUNTY", rarity: "SSR", name: "強敵賞金信標 γ", origin: "世代雷達 γ", effect: { bitsRate: 3, extraTickets: 3, battles: 3 } },
  { id: "chip:bounty-omega", shopRecordIndex: 70, kind: "BOUNTY", rarity: "UR", name: "強敵賞金信標 Ω", origin: "世代雷達 Ω", effect: { bitsRate: 5, extraTickets: 5, battles: 5, shards: 1 }, locked: true, omega: true }
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
  // GACHA_FULL_EFFECTS_20261109: the two basic shards add 25 points to the counter the partner's next
  // evolution lacks most (gapExp) on top of every stat +10.
  { id: "metal:emma-shard", family: "emma", rarity: "R", name: "艾瑪金屬碎片", art: `${METAL_ART}emma_shard_160.webp`, boost: 10, gapExp: 25 },
  { id: "metal:beta-shard", family: "beta", rarity: "R", name: "貝塔礦石碎片", art: `${METAL_ART}beta_shard_160.webp`, boost: 10, gapExp: 25 },
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
// GACHA_FULL_EFFECTS_20261109: rarities follow the Owner's sheet, and the vault also brings protein x5.
export const GACHA_BITS_BAGS = deepFreeze([
  { id: "bits:pouch", rarity: "R", name: "位元幣小錢袋", bits: 30_000 },
  { id: "bits:purse", rarity: "R", name: "位元幣回本金袋", bits: 60_000 },
  { id: "bits:chest", rarity: "SR", name: "位元幣暴富金箱", bits: 150_000 },
  { id: "bits:vault", rarity: "SSR", name: "皇家位元幣金庫", bits: 500_000, bonus: ["goods:protein", 5] }
]);
export const GACHA_TICKET_PRIZE = deepFreeze({ id: "ticket:gacha", rarity: "SSR", name: "數碼轉蛋券" });
// The premium machine's ticket jackpot: 2-3 tickets at SSR, 4-5 at UR.
export const GACHA_TICKET_PACK = deepFreeze({ id: "ticket:pack", rarity: "SSR", name: "幸運轉蛋券禮包", quantity: { SSR: [2, 3], UR: [4, 5] },
  art: "assets/production/items/gacha-prizes-r1/ticket_pack_160.webp" });

// GACHA_FULL_EFFECTS_20261109: the two prize icons Codex drew for this batch (provenance in the folder's manifest).
const PRIZE_ART = "assets/production/items/gacha-prizes-r1/";

// The Bits machine's supply boxes: fixed amounts of one shop row, straight into the shop stacks the ranch
// toolbar and the hunt loadout read. The hunt box picks one of its rows (bomb, meat bait, mine) at random.
export const GACHA_SUPPLY_PACKS = deepFreeze([
  { id: "pack:feed", name: "特選飼料補給箱", shopRecordIndex: 0, quantity: 10, art: `${GOODS_ART}training_meat_160.webp` },
  { id: "pack:protein", name: "高濃縮蛋白質禮盒", shopRecordIndex: 1, quantity: 3, art: `${GOODS_ART}protein_booster_160.webp` },
  { id: "pack:wound", name: "急救傷藥組", shopRecordIndex: 2, quantity: 5, art: `${GOODS_ART}wound_medicine_160.webp` },
  { id: "pack:medicine", name: "特效醫療藥品組", shopRecordIndex: 3, quantity: 3, art: `${GOODS_ART}medicine_capsule_160.webp` },
  { id: "pack:hunt", name: "狩獵戰備補給箱", shopRecordIndices: [42, 34, 46], quantity: 3, art: `${PRIZE_ART}hunt_supply_crate_160.webp` }
]);

const CHIP_BY_ID = new Map(GACHA_CHIPS.map((chip) => [chip.id, chip]));
const METAL_BY_ID = new Map(GACHA_METALS.map((metal) => [metal.id, metal]));
const GOODS_BY_ID = new Map(GACHA_GOODS.map((goods) => [goods.id, goods]));
const BITS_BAG_BY_ID = new Map(GACHA_BITS_BAGS.map((bag) => [bag.id, bag]));
const PACK_BY_ID = new Map(GACHA_SUPPLY_PACKS.map((pack) => [pack.id, pack]));
const RANK = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });

export const getGachaChip = (id) => CHIP_BY_ID.get(id) ?? null;
export const getGachaMetal = (id) => METAL_BY_ID.get(id) ?? null;
export const getGachaGoods = (id) => GOODS_BY_ID.get(id) ?? null;
export const getGachaBitsBag = (id) => BITS_BAG_BY_ID.get(id) ?? null;
export const getGachaSupplyPack = (id) => PACK_BY_ID.get(id) ?? null;
export const getGachaTicketPrize = (id) => (id === GACHA_TICKET_PACK.id ? GACHA_TICKET_PACK : id === GACHA_TICKET_PRIZE.id ? GACHA_TICKET_PRIZE : null);
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
    if (e.wisdom) line("智力 +{n}", { n: e.wisdom });
    if (e.hp) line("最大 HP +{n}", { n: e.hp });
    if (e.all) line("最大 TP +{n}", { n: Math.round(e.all * 2) });
    if (e.bond >= 100) line("親密度全滿");
    else if (e.bond) line("親密度 +{n}", { n: e.bond });
    if (e.raceExp) line("所屬種族的進化經驗 +{n}", { n: e.raceExp });
    if (e.factionExp) line("所屬陣營的進化經驗 +{n}", { n: e.factionExp });
    if (e.everyExp) line("八種族與三陣營的進化經驗各 +{n}", { n: e.everyExp });
    if (e.age) line("目前階段的成長年齡推進 {n}%", { n: Math.round(e.age * 100) });
    if (e.careMistakes === "CLEAR") line("照顧失誤歸零");
    else if (e.careMistakes) line("照顧失誤 -{n}", { n: -e.careMistakes });
    if (e.capacity) line("大賽報名容量 +{n} G（部分大賽的報名條件，不改變重量）", { n: e.capacity });
    if (e.personality) line("自己選拍檔的新性格");
    if (e.fatigue) line("訓練疲勞歸零");
    line("HP／TP 回滿");
    line("跨過進化門檻時，當場開始進化");
  } else if (chip?.kind === "HUNT") {
    if (e.stunRate) line("射擊造成的暈眩時間 ×{n}", { n: e.stunRate });
    if (e.sureCapture) line("本場第一隻被鋼索套住的拍檔立即倒地，必定捕獲");
    if (e.captureStatPercent) line("這隻拍檔的攻擊・防禦・智力・速度 +{n}%", { n: e.captureStatPercent });
    if (e.rareLure) line("引來 1 隻本區最稀有的拍檔，出現率也不再因捕獲次數下降");
    if (e.slow) line("野生拍檔移動速度 -{n}%", { n: Math.round(e.slow * 100) });
    // Despite its name the field is hunt-clock minutes; the line shows the real seconds they last.
    if (e.extraSeconds) line("狩獵限時 +{n} 秒", { n: huntMinutesToSeconds(e.extraSeconds) });
  } else if (chip?.kind === "BOUNTY") {
    line("位元幣獎金 ×{n}", { n: e.bitsRate });
    line("轉蛋券 +{n}", { n: e.extraTickets });
    if (e.battles) line("參戰拍檔的戰鬥與勝場各 +{n} 場", { n: e.battles });
    if (e.exp) line("參戰拍檔的種族與陣營進化經驗 +{n}", { n: e.exp });
    if (e.shards) line("隨機金屬碎片 ×{n}", { n: e.shards });
  }
  return Object.freeze(lines);
}

/** Real seconds of hunt-clock minutes in the real-time hunt: 400 clock units a minute, 16 a frame at 60 fps. */
export const huntMinutesToSeconds = (minutes) => Math.round((minutes * 400) / 16 / 60);

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
    "automation", "mounts", "runs", "editions", "bondCarry"]);
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
  // AUTO_CARE_3D_20261103: cores are consumables now. A core still mounted from an older
  // save goes back into the bag once, so the player deploys it for its hour.
  for (const modules of Object.values(normalizeAutomationMounts(value.mounts))) for (const module of modules) {
    const core = coreForModule(module);
    automation[core.id] = Math.min(AUTOMATION_STACK_CAP, (automation[core.id] ?? 0) + 1);
  }
  const runs = normalizeAutomationRuns(value.runs);
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
    ...(Object.keys(runs).length ? { runs } : {}),
    ...(Object.keys(editions).length ? { editions } : {}),
    ...(Object.keys(bondCarry).length ? { bondCarry } : {})
  });
}

function plain(state) {
  return {
    ...state, chips: { ...state.chips }, metals: { ...state.metals }, bloodlines: { ...state.bloodlines }, claimed: [...state.claimed],
    armed: { ...(state.armed.hunt ? { hunt: [...state.armed.hunt] } : {}), ...(state.armed.bounty ? { bounty: state.armed.bounty } : {}) },
    automation: { ...state.automation }, editions: { ...state.editions }, bondCarry: { ...state.bondCarry },
    runs: Object.fromEntries(Object.entries(state.runs ?? {}).map(([id, run]) => [id, { ...run }]))
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

// GACHA_FULL_EFFECTS_20261109: below automation, this share of the SR/SSR/UR tiers is the jackpot slot:
// the coin chest (SR), the coin vault (SSR, half) or the ticket pack (SSR half, UR). Supplies never enter
// the premium main slot.
export const GACHA_PREMIUM_JACKPOT_SHARE = 0.1;

function premiumJackpot(rarity, random) {
  if (rarity === "SR" || (rarity === "SSR" && random() < 0.5)) return bitsBagPrize(getGachaBitsBag(rarity === "SR" ? "bits:chest" : "bits:vault"));
  return { kind: "TICKETS", id: GACHA_TICKET_PACK.id, rarity, quantity: between(GACHA_TICKET_PACK.quantity[rarity], random) };
}

function bitsBagPrize(bag) {
  const prize = { kind: "BITS", id: bag.id, rarity: bag.rarity, quantity: 1, bits: bag.bits };
  if (bag.bonus) prize.bonus = goodsPrize(bag.bonus[0], bag.bonus[1]);
  return prize;
}

function goodsPrize(id, quantity) {
  return { kind: "GOODS", id, rarity: "R", quantity, shopRecordIndex: getGachaGoods(id).shopRecordIndex };
}

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
  if (rarity !== "R" && roll >= 1 - GACHA_PREMIUM_JACKPOT_SHARE) return premiumJackpot(rarity, random);
  if (rarity !== "R") roll /= 1 - GACHA_PREMIUM_JACKPOT_SHARE;
  // Metals are the point of the premium machine: they take half of every tier.
  const metal = metals.length && (!chips.length || roll < 0.5);
  const entry = metal ? pick(metals, random) : pick(chips, random);
  return { kind: metal ? "METAL" : "CHIP", id: entry.id, rarity, quantity: 1 };
}

// Bits machine (Owner 2026-11-09, GACHA_FULL_EFFECTS_20261109): supplies 45%; coin pouch, coin purse, basic
// chip, hunt cartridge and the α beacon 35%; coin chest, reshape chip, capacity chip and the two basic shards
// 16%; one ticket, a 時之礦石 shard and the β core 4%. Each tier splits evenly between its slots.
export const GACHA_BITS_MACHINE_TIERS = deepFreeze([
  [0.45, ["pack:feed", "pack:protein", "pack:wound", "pack:medicine", "pack:hunt"]],
  [0.35, ["bits:pouch", "bits:purse", "CHIP_BASIC", "CHIP_HUNT", "chip:bounty-alpha"]],
  [0.16, ["bits:chest", "chip:personality", "chip:memory", "metal:beta-shard", "metal:emma-shard"]],
  [0.04, ["TICKETS", "metal:chrono-ore-shard", "chip:core-beta"]]
]);
export const GACHA_BITS_MACHINE_RATES = Object.freeze(GACHA_BITS_MACHINE_TIERS.flatMap(([weight, slots]) => slots.map((slot) => Object.freeze([slot, weight / slots.length]))));

function bitsPrize(random) {
  const slot = rollRarity(GACHA_BITS_MACHINE_RATES, random);
  const pack = getGachaSupplyPack(slot);
  if (pack) {
    const shopRecordIndex = pack.shopRecordIndices ? pick(pack.shopRecordIndices, random) : pack.shopRecordIndex;
    return { kind: "GOODS", id: pack.id, rarity: "R", quantity: pack.quantity, shopRecordIndex };
  }
  if (slot === "CHIP_BASIC" || slot === "CHIP_HUNT") {
    const kind = slot === "CHIP_BASIC" ? "GROWTH" : "HUNT";
    return { kind: "CHIP", id: pick(GACHA_CHIPS.filter((c) => c.rarity === "R" && c.kind === kind), random).id, rarity: "R", quantity: 1 };
  }
  if (slot === "TICKETS") return { kind: "TICKETS", id: GACHA_TICKET_PRIZE.id, rarity: GACHA_TICKET_PRIZE.rarity, quantity: 1 };
  const chip = getGachaChip(slot), metal = getGachaMetal(slot);
  if (chip || metal) return { kind: chip ? "CHIP" : "METAL", id: slot, rarity: (chip ?? metal).rarity, quantity: 1 };
  return bitsBagPrize(getGachaBitsBag(slot));
}

// An R chip from the premium machine never comes alone: feed x5 or protein x1
// rides with it, alternating by pull position (no extra random draw).
const PREMIUM_R_BONUS = Object.freeze([["goods:feed", 5], ["goods:protein", 1]]);
function premiumBonus(index) {
  const [id, quantity] = PREMIUM_R_BONUS[index % PREMIUM_R_BONUS.length];
  return goodsPrize(id, quantity);
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

// GACHA_FULL_EFFECTS_20261109: tier smelting. Any three shards of one rarity rise one step: three R shards
// (艾瑪/貝塔) become a 時之合金碎片, three SR shards (時之) the whole 時之合金. Spare copies go first, then the
// largest stacks; the 星核 family stays out, like the forge.
export const GACHA_TIER_SMELT = deepFreeze({ R: "metal:chrono-alloy-shard", SR: "metal:chrono-alloy" });
export const GACHA_TIER_SMELT_COST = 3;
export function shardTierSmeltPlan(state, rarity) {
  const current = normalizeCyberGacha(state);
  const target = getGachaMetal(GACHA_TIER_SMELT[rarity]);
  if (!target) return deepFreeze({ ok: false, reason: "UNKNOWN_TIER" });
  const shards = forgeUnits(forgeShardPool().filter((metal) => metal.rarity === rarity)
    .map((metal) => ({ id: metal.id, owned: current.metals[metal.id] ?? 0, rank: RANK[metal.rarity] })), GACHA_TIER_SMELT_COST);
  if (!shards) return deepFreeze({ ok: false, reason: "NOT_ENOUGH_SHARDS", target: target.id });
  return deepFreeze({ ok: true, rarity, target: target.id, shards });
}
export function smeltGachaShardTier(state, rarity) {
  const plan = shardTierSmeltPlan(state, rarity);
  if (!plan.ok) return plan;
  const next = plain(normalizeCyberGacha(state));
  for (const id of plan.shards) next.metals[id] -= 1;
  const target = getGachaMetal(plan.target);
  addPrize(next, { kind: "METAL", id: target.id, quantity: 1 });
  return deepFreeze({ ok: true, consumed: plan.shards, prize: { kind: "METAL", id: target.id, rarity: target.rarity, quantity: 1 }, state: normalizeCyberGacha(next) });
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
// The eleven native evolution counters (OVL18 02112734): factions vaccine/data/virus, then the eight races.
export const GACHA_COUNTER_FIELDS = Object.freeze(["104", "108", "100", "10c", "110", "114", "118", "124", "120", "128", "11c"]);
export const GACHA_COUNTER_CAP = 9999;
export const GACHA_BATTLE_CAP = 9999;

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
  // Percent growth of the four stats (the sure wire's catch).
  if (effect.statPercent) for (const field of Object.values(STAT_FIELDS)) add(field, Math.round(((f[field] | 0) * effect.statPercent) / 100), 999);
  // Evolution counters resolved by the caller ({field: points}), training fatigue, growth age, care mistakes.
  for (const [field, points] of Object.entries(effect.counters ?? {})) if (GACHA_COUNTER_FIELDS.includes(field)) add(field, points, GACHA_COUNTER_CAP);
  if (effect.fatigue) f["040"] = 0;
  if (Number.isSafeInteger(effect.ageMinutes) && effect.ageMinutes > 0) add("18c", effect.ageMinutes, 0xffffffff);
  if (effect.careMistakes && p.narrowFields) {
    const n = p.narrowFields;
    n["03d"] = effect.careMistakes === "CLEAR" ? 0 : Math.max(0, Math.min(255, (n["03d"] | 0) + effect.careMistakes));
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

/** What a metal does when used as an enhancement, one line each (the basic shards also name their gap points). */
export function gachaMetalEffectLines(metal) {
  const e = metalBoostEffect(metal), lines = [];
  const line = (text, params) => lines.push(Object.freeze(params ? { text, params: Object.freeze(params) } : { text }));
  line("攻擊・防禦・智力・速度 +{n}", { n: e.all });
  line("最大 HP +{n}", { n: e.hp });
  if (metal.gapExp) line("下一次進化最缺的種族或陣營經驗 +{n}", { n: metal.gapExp });
  if (inscribesBloodline(metal)) line("銘刻{title}血統", { title: GACHA_BLOODLINES[metal.family]?.title ?? "" });
  return Object.freeze(lines);
}
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

export const GACHA_WIN_TICKET_CHANCE = 0.6;

/**
 * Win settlement: one ticket 60% of the time; an armed beacon multiplies the purse, adds
 * tickets (the Ω beacon also a random metal shard) and is used up.
 */
export function settleGachaBattleWin(state, { bits = 0, tournamentChampion = false, random }) {
  const current = normalizeCyberGacha(state);
  if (typeof random !== "function") throw gachaError("RANDOM_REQUIRED");
  const beacon = current.armed.bounty ? getGachaChip(current.armed.bounty) : null;
  const bonusBits = beacon && Number.isSafeInteger(bits) && bits > 0 ? Math.round(bits * (beacon.effect.bitsRate - 1)) : 0;
  // GACHA_FULL_EFFECTS_20261109 (Owner 2026-11-09 balance): a win drops one ticket 60% of the time (was 1-3),
  // a tournament title 2-4 more (was 3-10); a beacon's tickets come on top.
  let tickets = (random() < GACHA_WIN_TICKET_CHANCE ? 1 : 0) + (beacon?.effect.extraTickets ?? 0);
  if (tournamentChampion) tickets += 2 + Math.floor(random() * 3);
  const shardPool = GACHA_METALS.filter((metal) => metal.id.endsWith("-shard"));
  const metals = Array.from({ length: beacon?.effect.shards ?? 0 }, () => pick(shardPool, random).id);
  const next = plain(current);
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + tickets);
  for (const id of metals) addPrize(next, { kind: "METAL", id, quantity: 1 });
  delete next.armed.bounty;
  // The caller writes these onto every partner who fought: extra battles and wins, race and faction points.
  return deepFreeze({ state: normalizeCyberGacha(next), tickets, bonusBits, beacon: beacon?.id ?? null, metals,
    battles: beacon?.effect.battles ?? 0, exp: beacon?.effect.exp ?? 0 });
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

/**
 * Deploy one core from the bag on a placed cage instance (AUTO_CARE_3D_20261103): the
 * core is used up and each machine it runs gets one more hour (a fresh deploy or a
 * battery on a running one), at most 24 hours. A royal edition already carries both.
 */
export function deployAutomationCore(state, coreId, instanceId) {
  const current = normalizeCyberGacha(state);
  const core = getAutomationItem(coreId);
  if (core?.kind !== "CORE") return deepFreeze({ ok: false, reason: "NOT_A_CORE" });
  if (typeof instanceId !== "string" || !/^[a-z0-9:_-]{3,96}$/i.test(instanceId)) return deepFreeze({ ok: false, reason: "UNKNOWN_CAGE" });
  if ((current.automation?.[coreId] ?? 0) < 1) return deepFreeze({ ok: false, reason: "NOT_OWNED" });
  if (current.editions?.[instanceId]) return deepFreeze({ ok: false, reason: "ROYAL_ALREADY_AUTOMATED" });
  const run = current.runs?.[instanceId] ?? {}, { runSeconds, runCapSeconds } = AUTOMATION_RULES;
  if (coreModules(core).some((module) => (run[module] ?? 0) + runSeconds > runCapSeconds)) return deepFreeze({ ok: false, reason: "RUN_FULL" });
  const next = plain(current);
  next.automation[coreId] -= 1;
  next.runs[instanceId] = { ...run };
  for (const module of coreModules(core)) next.runs[instanceId][module] = (run[module] ?? 0) + runSeconds;
  const extended = coreModules(core).some((module) => (run[module] ?? 0) > 0);
  return deepFreeze({ ok: true, extended, state: normalizeCyberGacha(next) });
}

/**
 * Run the deployed machines down by `seconds` of real time. `paused` names machines that
 * wait (a feeding tower with no meat to throw): {instanceId: ["AUTO_FEED"]}. Returns the
 * state and the machines whose hour ran out ({instanceId, module}).
 */
export function tickAutomationRuns(state, seconds, { paused = {} } = {}) {
  const current = normalizeCyberGacha(state);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || !current.runs) return deepFreeze({ state: current, expired: [] });
  const next = plain(current), expired = [];
  for (const [instanceId, run] of Object.entries(next.runs)) {
    for (const module of Object.keys(run)) {
      if (paused[instanceId]?.includes(module)) continue;
      run[module] = Math.max(0, run[module] - seconds);
      if (!run[module]) { delete run[module]; expired.push({ instanceId, module }); }
    }
    if (!Object.keys(run).length) delete next.runs[instanceId];
  }
  return deepFreeze({ state: normalizeCyberGacha(next), expired });
}

/**
 * A confirmed facility layout. `editions` names every placed royal cage (null keeps
 * the current ones); royal cages leaving the layout go back to the bag and new ones
 * come out of it. A machine running on a cage that left, or on a royal cage (which
 * carries both already), gives back one core per whole hour it had left.
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
  for (const [id, run] of Object.entries(next.runs)) {
    if (live.has(id) && !wanted[id]) continue;
    for (const [module, seconds] of Object.entries(run)) {
      const core = coreForModule(module), hours = Math.floor(seconds / AUTOMATION_RULES.runSeconds);
      if (hours) next.automation[core.id] = Math.min(AUTOMATION_STACK_CAP, (next.automation[core.id] ?? 0) + hours);
    }
    delete next.runs[id];
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
