// Cyber Gachapon -- OWNER_APPROVED_ADAPTATION 2026-10-29.
//
// The Shop's third tab stops selling the 30 one-per-save plugins and becomes a
// capsule machine. Eighteen of those plugins come back as stackable chips (their
// shop rows and art stay, so plugin-era saves and hunt fitting keep working);
// the Antigravity "digital metals" are the evolution metals; shop goods are the
// Bits machine's everyday prizes. This module is pure: state in, state out, and
// every random draw goes through the injected `random()` in [0, 1).

import { deepFreeze } from "../contracts/championshipContracts.js";

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
  { id: "chip:personality", shopRecordIndex: 57, kind: "GROWTH", rarity: "SR", name: "🧠 性格重塑晶片", origin: "性格分析器", effect: { personality: 1 }, locked: true },
  { id: "chip:memory", shopRecordIndex: 58, kind: "GROWTH", rarity: "SR", name: "💾 記憶體擴充晶片", origin: "容量分析器", effect: { capacity: 2 } },
  { id: "chip:core-alpha", shopRecordIndex: 59, kind: "GROWTH", rarity: "SR", name: "⚡ 全能超頻核心 α", origin: "綜合分析器 α", effect: { all: 6, hp: 60, bond: 10 } },
  { id: "chip:core-beta", shopRecordIndex: 60, kind: "GROWTH", rarity: "SSR", name: "⚡ 全能超頻核心 β", origin: "綜合分析器 β", effect: { all: 12, hp: 120, bond: 20 } },
  { id: "chip:core-omega", shopRecordIndex: 61, kind: "GROWTH", rarity: "UR", name: "⚡ 全能超頻核心 Ω", origin: "綜合分析器 Ω", effect: { all: 25, hp: 250, bond: 40 }, locked: true, omega: true },
  { id: "chip:stun-mag", shopRecordIndex: 62, kind: "HUNT", rarity: "R", name: "🎯 高壓麻痺彈匣", origin: "射擊檢查器", effect: { stunRate: 2 } },
  { id: "chip:sure-wire", shopRecordIndex: 63, kind: "HUNT", rarity: "SR", name: "🪢 量子必中鋼索晶片", origin: "鋼索檢查器", effect: { sureCapture: true } },
  { id: "chip:rare-bait", shopRecordIndex: 64, kind: "HUNT", rarity: "R", name: "🍖 高純度異色誘餌", origin: "誘引道具檢查器", effect: { rareLure: true } },
  { id: "chip:gravity", shopRecordIndex: 65, kind: "HUNT", rarity: "R", name: "🕸️ 重力緩速力場匣", origin: "傷害陷阱檢查器", effect: { slow: 0.5 } },
  { id: "chip:chrono", shopRecordIndex: 66, kind: "HUNT", rarity: "SSR", name: "⏱️ 次元時鐘擴充匣", origin: "全道具檢查器", effect: { extraSeconds: 120 } },
  { id: "chip:bounty-alpha", shopRecordIndex: 67, kind: "BOUNTY", rarity: "R", name: "📡 強敵賞金信標 α", origin: "世代雷達 α", effect: { bitsRate: 1.5, extraTickets: 1 } },
  { id: "chip:bounty-beta", shopRecordIndex: 68, kind: "BOUNTY", rarity: "SR", name: "📡 強敵賞金信標 β", origin: "世代雷達 β", effect: { bitsRate: 2, extraTickets: 2 } },
  { id: "chip:bounty-gamma", shopRecordIndex: 69, kind: "BOUNTY", rarity: "SSR", name: "📡 強敵賞金信標 γ", origin: "世代雷達 γ", effect: { bitsRate: 3, extraTickets: 3 } },
  { id: "chip:bounty-omega", shopRecordIndex: 70, kind: "BOUNTY", rarity: "UR", name: "📡 強敵賞金信標 Ω", origin: "世代雷達 Ω", effect: { bitsRate: 5, extraTickets: 5 }, locked: true, omega: true }
]);

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

const CHIP_BY_ID = new Map(GACHA_CHIPS.map((chip) => [chip.id, chip]));
const METAL_BY_ID = new Map(GACHA_METALS.map((metal) => [metal.id, metal]));
const GOODS_BY_ID = new Map(GACHA_GOODS.map((goods) => [goods.id, goods]));
const RANK = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });

export const getGachaChip = (id) => CHIP_BY_ID.get(id) ?? null;
export const getGachaMetal = (id) => METAL_BY_ID.get(id) ?? null;
export const getGachaGoods = (id) => GOODS_BY_ID.get(id) ?? null;
export const gachaRarityRank = (rarity) => RANK[rarity] ?? -1;

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
  const allowed = new Set(["version", "tickets", "pity", "pulls", "welcome", "chips", "metals", "bloodlines", "armed", "claimed"]);
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
    claimed: [...new Set(claimed)].sort()
  });
}

function plain(state) {
  return {
    ...state, chips: { ...state.chips }, metals: { ...state.metals }, bloodlines: { ...state.bloodlines }, claimed: [...state.claimed],
    armed: { ...(state.armed.hunt ? { hunt: [...state.armed.hunt] } : {}), ...(state.armed.bounty ? { bounty: state.armed.bounty } : {}) }
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

function premiumPrize(rarity, random) {
  const chips = GACHA_CHIPS.filter((chip) => chip.rarity === rarity);
  const metals = GACHA_METALS.filter((metal) => metal.rarity === rarity);
  // Metals are the point of the premium machine: they take half of every tier.
  const metal = metals.length && (!chips.length || random() < 0.5);
  const entry = metal ? pick(metals, random) : pick(chips, random);
  return { kind: metal ? "METAL" : "CHIP", id: entry.id, rarity, quantity: 1 };
}

function bitsPrize(random) {
  const roll = random();
  if (roll < 0.66) {
    const goods = pick(GACHA_GOODS, random);
    return { kind: "GOODS", id: goods.id, rarity: "R", quantity: between(goods.quantity, random), shopRecordIndex: goods.shopRecordIndex };
  }
  if (roll < 0.93) return { kind: "CHIP", id: pick(GACHA_CHIPS.filter((c) => c.rarity === "R"), random).id, rarity: "R", quantity: 1 };
  if (roll < 0.99) return { kind: "METAL", id: pick(GACHA_METALS.filter((m) => m.rarity === "R"), random).id, rarity: "R", quantity: 1 };
  return { kind: "METAL", id: pick(GACHA_METALS.filter((m) => m.rarity === "SR"), random).id, rarity: "SR", quantity: 1 };
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
}

/**
 * One pull of `count` (1 or 10) on a machine. Tickets are spent before
 * diamonds. Returns the next state, the charge and the prizes; goods prizes
 * name shop rows the caller delivers into the Shop's own quantities.
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
    prizes.push(machine === "PREMIUM" ? premiumPrize(rollRarity(PREMIUM_RATES, random), random) : bitsPrize(random));
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
  if (effect.personality) f["018"] = ((f["018"] | 0) + effect.personality) % 9;
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

/** Win settlement: tickets drop 1-3; an armed beacon multiplies the purse, adds tickets and is used up. */
export function settleGachaBattleWin(state, { bits = 0, tournamentChampion = false, random }) {
  const current = normalizeCyberGacha(state);
  if (typeof random !== "function") throw gachaError("RANDOM_REQUIRED");
  const beacon = current.armed.bounty ? getGachaChip(current.armed.bounty) : null;
  const bonusBits = beacon && Number.isSafeInteger(bits) && bits > 0 ? Math.round(bits * (beacon.effect.bitsRate - 1)) : 0;
  let tickets = 1 + Math.floor(random() * 3) + (beacon?.effect.extraTickets ?? 0);
  if (tournamentChampion) tickets += 3 + Math.floor(random() * 8);
  const next = plain(current);
  next.tickets = Math.min(GACHA_TICKET_CAP, next.tickets + tickets);
  delete next.armed.bounty;
  return deepFreeze({ state: normalizeCyberGacha(next), tickets, bonusBits, beacon: beacon?.id ?? null });
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
