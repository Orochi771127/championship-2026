// Hunt tool family cards in the Shop (Owner 2026-11-03, HUNT_TOOL_TIERS_20261103).
//
// One card per tool instead of one per tier: the card wears the tier reached
// (α / β / γ, or the memory card's size), what is held, and its two actions
// -- raise the tier in place, or buy more of the tier held. The detail sheet
// repeats them with a +1 and the full tier ladder. Every action goes through
// the presentation source's intents; nothing here owns stock or money.

import { uiText } from "../text/uiText.js";
import { shopItemName } from "../text/zhHant.js";
import { getHuntCatalogItem } from "../hunt/loadout/huntEquipmentCatalog.js";

export const HUNT_TOOL_TIER_LABELS = Object.freeze(["α", "β", "γ"]);
const FAMILY_REFILL_STEP = 10;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const num = value => Number(value).toLocaleString("en-US");

/**
 * The shop's listings for one category as cards: a family shows once, on the
 * row of its current tier; every other row stays a card of its own.
 */
export function huntFamilyEntries(rows, families = []) {
  const byId = new Map(families.map(family => [family.familyId, family]));
  const entries = [], seen = new Set();
  for (const row of rows) {
    const family = row.familyId ? byId.get(row.familyId) : null;
    if (!family) { entries.push({ key: `row:${row.shopRecordIndex}`, row, family: null }); continue; }
    if (seen.has(family.familyId)) continue;
    seen.add(family.familyId);
    entries.push({ key: `family:${family.familyId}`, row: rows.find(r => r.shopRecordIndex === family.shopRecordIndex) ?? row, family });
  }
  return entries;
}

/** What the card is called now: its tool and the tier it reached. */
export function huntFamilyName(family) {
  if (family.kind === "MEMORY") return uiText("心核記憶卡 {g} G", { g: family.capacityG || 32 });
  // The current tier's own shop name: 捕捉繩 γ, 手槍 β; meat and traps carry theirs (普通肉餌 -> 大型肉餌).
  return shopItemName(family.shopRecordIndex) ?? "";
}

/** The short tier badge for the card's corner. */
export function huntFamilyBadge(family) {
  if (family.kind === "MEMORY") return family.tier < 0 ? "—" : `Lv.${family.tier + 1}`;
  return family.tier < 0 ? uiText("未持有") : HUNT_TOOL_TIER_LABELS[family.tier];
}

/** A rope's durability as the field counts it (the ROM byte x 60). */
function ropeDurability(family) {
  const byte = getHuntCatalogItem(family.productItemId)?.statValue;
  return Number.isFinite(byte) ? byte * 60 : null;
}

/** The status line under the name. */
export function huntFamilyMeta(family) {
  if (family.kind === "MEMORY") return family.tier < 0 ? uiText("尚未持有") : uiText("容量 {g} G · 最高 256 G", { g: family.capacityG });
  const held = uiText("持有 {owned}/{max}", { owned: family.owned, max: family.maxOwned });
  if (family.kind !== "ROPE") return held;
  const durability = ropeDurability(family);
  return durability === null ? held : `${held} · ${uiText("耐磨 {n}", { n: num(durability) })}`;
}

/** The sheet's description: the memory card names the size it has now; the rest keep their shop text. */
export function huntFamilyDescription(family, fallback) {
  if (family.kind === "MEMORY" && family.tier >= 0) return uiText("狩獵時最多可收納 {g} G 的夥伴。牧場土地每擴充一階，再多 8 G。", { g: family.capacityG });
  if (family.kind === "ROPE") return `${fallback} ${uiText("每根繩索都會磨損，拉斷時用掉 1 根並自動換上新繩。")}`;
  return fallback;
}

/** What the upgrade key says and whether it can be pressed. */
function upgradeKey(family, bits) {
  const next = family.next;
  if (!next) return { label: family.kind === "MEMORY" ? uiText("已達最大 256 G") : uiText("已達最高 {tier} 階", { tier: HUNT_TOOL_TIER_LABELS[family.tier] ?? "" }), disabled: true, max: true };
  const to = family.kind === "MEMORY" ? `${next.capacityG} G` : HUNT_TOOL_TIER_LABELS[next.tier];
  if (!next.unlocked) return { label: uiText("{to} 尚未開放", { to }), disabled: true, locked: true };
  const verb = family.kind === "ROPE" && family.tier < 0 ? uiText("購買 {to}", { to }) : uiText("升級 {to}", { to });
  return { label: `${verb} · ${num(next.bits)}`, disabled: next.bits > bits, short: next.bits > bits };
}

/** How many a refill key buys: ten, or what still fits under the cap. */
function refillCount(family, step) {
  return Math.max(0, Math.min(step, family.maxOwned - family.owned));
}

function refillKey(family, bits, step) {
  if (family.kind === "MEMORY") return null;
  if (family.kind === "ROPE" && family.tier < 0) return null;
  const count = refillCount(family, step);
  if (count === 0) return { label: uiText("已滿 99"), disabled: true, count: 0 };
  const cost = family.refillBits * count;
  return { label: `＋${count} · ${num(cost)}`, disabled: cost > bits, count, cost };
}

function key(doc, className, { label, disabled }, onPress) {
  const button = el(doc, "button", `cm-arcade-key ${className}`);
  button.type = "button";
  button.textContent = label;
  button.disabled = Boolean(disabled);
  button.addEventListener("click", event => { event.stopPropagation(); if (!button.disabled) onPress(); });
  return button;
}

/**
 * The family's action keys. `compact` is the card (upgrade + ten); the
 * sheet adds a single refill. The memory card's last four sizes add a
 * test-diamond key when the wallet has diamonds at all.
 */
export function huntFamilyActions(doc, family, { bits = 0, diamonds = null, intents, compact = false }) {
  const row = el(doc, "div", compact ? "cm-shop-family__actions" : "cm-shop-family__actions cm-shop-family__actions--sheet");
  const up = upgradeKey(family, bits);
  const upKey = key(doc, "cm-shop-family__upgrade", up, () => intents.upgradeHuntTool(family.familyId, "BITS"));
  upKey.dataset.state = up.max ? "max" : up.locked ? "locked" : up.short ? "short" : "ready";
  row.append(upKey);
  const next = family.next;
  if (family.kind === "MEMORY" && next?.unlocked && Number.isSafeInteger(next.diamonds) && diamonds !== null) {
    const dia = key(doc, "cm-shop-family__diamonds",
      { label: uiText("{n} 測試鑽", { n: num(next.diamonds) }), disabled: diamonds < next.diamonds },
      () => intents.upgradeHuntTool(family.familyId, "DIAMONDS"));
    dia.setAttribute("aria-label", uiText("用 {n} 測試鑽升級至 {g} G（測試鑽，沒有真實付款）", { n: num(next.diamonds), g: next.capacityG }));
    row.append(dia);
  }
  for (const step of compact ? [FAMILY_REFILL_STEP] : [1, FAMILY_REFILL_STEP]) {
    const refill = refillKey(family, bits, step);
    if (!refill || (step === 1 && refill.count === 0)) continue;
    const button = key(doc, "cm-shop-family__refill", refill, () => intents.refillHuntTool(family.familyId, refill.count));
    button.setAttribute("aria-label", uiText("補充 {n} 個 · {bits} 位元幣", { n: refill.count, bits: num(refill.cost ?? 0) }));
    row.append(button);
  }
  return row;
}

/** The tier ladder in the sheet: α β γ, or the seven card sizes, the reached ones lit. */
export function huntFamilyLadder(doc, family) {
  const ladder = el(doc, "ol", "cm-shop-family__ladder");
  ladder.setAttribute("aria-label", uiText("升級階段"));
  const steps = family.kind === "MEMORY" ? [32, 64, 96, 128, 160, 200, 256].map(g => `${g}G`) : HUNT_TOOL_TIER_LABELS.slice(0, family.tierCount);
  steps.forEach((label, index) => {
    const step = el(doc, "li", "cm-shop-family__step", label);
    step.dataset.reached = String(index <= family.tier);
    if (index === family.tier) step.setAttribute("aria-current", "step");
    ladder.append(step);
  });
  return ladder;
}

/** What one card-level action leaves in the toast. */
export function huntFamilyReceiptText(receipt, families = []) {
  const family = families.find(f => f.familyId === receipt?.familyId);
  if (!receipt?.ok || !family) return null;
  const name = huntFamilyName(family);
  if (receipt.reason === "UPGRADED") {
    if (family.kind === "MEMORY") return uiText("記憶卡升級至 {g} G。", { g: family.capacityG });
    if (family.kind === "ROPE") return uiText("「{item}」升級完成，送 10 根新繩，持有 {owned}/99。", { item: name, owned: family.owned });
    return uiText("「{item}」升級完成，舊彈藥全數升階，持有 {owned}/99。", { item: name, owned: family.owned });
  }
  return uiText("已補充「{item}」，持有 {owned}/99。", { item: name, owned: family.owned });
}
