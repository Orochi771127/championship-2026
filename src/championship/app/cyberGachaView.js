// Cyber Gachapon centre -- the Shop's third tab (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// DOM only. Reads `frame.shop.gacha` (the app's getCyberGachaFrame) and sends
// pulls, synthesis and item use through the Shop source intents; the app saves
// every result before this view shows it. The machine is layered: capsules
// tumble behind a transparent dome, the crank is its own image and turns 360°.

import { uiText } from "../text/uiText.js";
import { prefersReducedMotion } from "../presentation/presentationPreferences.js";
import { shopGoodsPresentation } from "../presentation/shopGoodsUiArt.js";

const UI_ART = "assets/production/ui/cyber-gacha-r1/";
export const CYBER_GACHA_ART = Object.freeze({
  machine: `${UI_ART}machine_body.webp`,
  crank: `${UI_ART}crank_handle.webp`,
  ticket: `${UI_ART}gacha_ticket.webp`,
  furnace: `${UI_ART}synth_furnace.webp`,
  capsule: Object.freeze(Object.fromEntries(["R", "SR", "SSR", "UR"].map((rarity) => [rarity, Object.freeze({
    top: `${UI_ART}capsule_${rarity.toLowerCase()}_top.webp`,
    bottom: `${UI_ART}capsule_${rarity.toLowerCase()}_bottom.webp`
  })])))
});
const RARITY_ORDER = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });
const REFUSALS = Object.freeze({
  NO_TICKETS: "轉蛋券不足，也沒有可用的鑽石。",
  INSUFFICIENT_FUNDS: "持有的票券或貨幣不足。",
  PITY_NOT_READY: "核心熔煉值尚未滿 50。",
  NOT_SELECTABLE: "自選箱只能選擇 SSR 以上的進化金屬。",
  NEEDS_FIVE_CHIPS: "請放入 5 個晶片。",
  NOT_ENOUGH_CHIPS: "晶片數量不足。",
  NOT_OWNED: "沒有持有這個道具。",
  UNKNOWN_INDIVIDUAL: "請先選擇拍檔。",
  PARTNER_NOT_IN_RANCH: "催化進化需要拍檔待在牧場裡。",
  EVOLUTION_RUNNING: "牧場裡正有拍檔在進化，請稍候。",
  NO_EVOLUTION_ROUTE: "這隻拍檔目前沒有可以催化的進化路線。",
  METAL_TOO_WEAK: "這塊金屬的等級不足以催化這個世代的進化。",
  ALREADY_ARMED: "已經裝填同類晶片，請先使用。",
  SAVE_FAILED: "存檔失敗，這次沒有扣除任何東西。",
  WALLET_CHANGED: "錢包已變更，請再試一次。"
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className, text) {
  const node = element("button", className, text);
  node.type = "button";
  return node;
}
function image(src, className, alt = "") {
  const node = element("img", className);
  node.src = src;
  node.alt = alt;
  node.decoding = "async";
  node.draggable = false;
  return node;
}
function fx(target, kind, text) {
  try { target?.dispatchEvent(new CustomEvent("cm-fx", { bubbles: true, detail: { kind, text } })); } catch { /* optional */ }
}
const wait = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});
const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");

let stylesheet = null;
function ensureStylesheet(doc) {
  if (stylesheet?.isConnected || doc.querySelector?.('link[href*="cyberGacha.css"]')) return;
  stylesheet = doc.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("./cyberGacha.css", import.meta.url).href;
  doc.head.append(stylesheet);
}

/** Art of one chip, metal or goods row (chips keep their original plugin shop art). */
export function gachaItemArt(item) {
  if (item?.art) return { src: item.art, contain: true };
  if (Number.isSafeInteger(item?.shopRecordIndex)) {
    const goods = shopGoodsPresentation(item.shopRecordIndex);
    if (goods?.src) return { src: goods.src, contain: true };
  }
  return null;
}

function itemIcon(item, className = "cm-gacha-icon") {
  const host = element("span", className);
  host.dataset.rarity = item.rarity ?? "R";
  const art = gachaItemArt(item);
  if (art) host.append(image(art.src, "cm-gacha-icon__img"));
  else host.append(element("span", "cm-gacha-icon__glyph", item.kind === "BOUNTY" ? "📡" : "💾"));
  return host;
}

export function createCyberGachaPanel({ host, intents, onRefusal = () => {} }) {
  ensureStylesheet(host.ownerDocument);
  const root = element("section", "cm-gacha");
  root.setAttribute("aria-label", uiText("數碼轉蛋中心"));
  root.dataset.mode = "MACHINE";
  root.dataset.machine = "PREMIUM";

  // Currencies stay on top in every mode.
  const wallet = element("div", "cm-gacha__wallet");
  const ticketChip = element("span", "cm-gacha__coin cm-gacha__coin--ticket");
  ticketChip.append(image(CYBER_GACHA_ART.ticket, "cm-gacha__coin-icon"), element("strong"));
  const diamondChip = element("span", "cm-gacha__coin cm-gacha__coin--diamond");
  diamondChip.append(element("span", "cm-gacha__coin-glyph", "💎"), element("strong"));
  const bitsChip = element("span", "cm-gacha__coin cm-gacha__coin--bits");
  bitsChip.append(element("span", "cm-gacha__coin-glyph", "🪙"), element("strong"));
  wallet.append(ticketChip, diamondChip, bitsChip);

  const modes = element("div", "cm-gacha__modes");
  modes.setAttribute("role", "tablist");
  const modeButtons = new Map();
  for (const [id, label] of [["MACHINE", "🎰 轉蛋機"], ["SYNTH", "♻️ 合成爐"], ["BAG", "🎒 晶片背包"]]) {
    const tab = button("cm-gacha__mode", uiText(label));
    tab.dataset.mode = id;
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => { root.dataset.mode = id; fx(tab, "toggle"); paint(lastFrame); });
    modes.append(tab);
    modeButtons.set(id, tab);
  }

  // ---- Machine ------------------------------------------------------------
  const machinePane = element("div", "cm-gacha__pane cm-gacha__pane--machine");
  const machineSwitch = element("div", "cm-gacha__machines");
  const premiumTab = button("cm-gacha__machine-tab", uiText("🌌 王牌超頻＆進化金屬"));
  premiumTab.dataset.machine = "PREMIUM";
  const bitsTab = button("cm-gacha__machine-tab", uiText("🪙 位元幣日常補給"));
  bitsTab.dataset.machine = "BITS";
  for (const tab of [premiumTab, bitsTab]) {
    tab.addEventListener("click", () => { root.dataset.machine = tab.dataset.machine; fx(tab, "toggle"); paint(lastFrame); });
  }
  machineSwitch.append(premiumTab, bitsTab);

  const stage = element("div", "cm-gacha__stage");
  const dome = element("div", "cm-gacha__dome");
  const tumbleBalls = [];
  for (let i = 0; i < 9; i += 1) {
    const rarity = ["R", "SR", "R", "SSR", "R", "SR", "UR", "R", "SR"][i];
    const ball = element("span", "cm-gacha__ball");
    ball.dataset.rarity = rarity;
    ball.style.setProperty("--i", String(i));
    ball.append(image(CYBER_GACHA_ART.capsule[rarity].top, "cm-gacha__ball-top"),
      image(CYBER_GACHA_ART.capsule[rarity].bottom, "cm-gacha__ball-bottom"));
    dome.append(ball);
    tumbleBalls.push(ball);
  }
  const body = image(CYBER_GACHA_ART.machine, "cm-gacha__body", uiText("賽博轉蛋機"));
  const crank = button("cm-gacha__crank");
  crank.setAttribute("aria-label", uiText("轉動把手單抽"));
  crank.append(image(CYBER_GACHA_ART.crank, "cm-gacha__crank-img"));
  stage.append(dome, body, crank);

  const pity = element("div", "cm-gacha__pity");
  const pityLabel = element("span", "cm-gacha__pity-label");
  const pityBar = element("span", "cm-gacha__pity-bar");
  const pityFill = element("span", "cm-gacha__pity-fill");
  pityBar.append(pityFill);
  const pityClaim = button("cm-gacha__pity-claim", uiText("領取自選箱"));
  pity.append(pityLabel, pityBar, pityClaim);

  const pulls = element("div", "cm-gacha__pulls");
  const single = button("cm-gacha__pull");
  const ten = button("cm-gacha__pull cm-gacha__pull--ten");
  pulls.append(single, ten);
  const rates = element("p", "cm-gacha__rates");
  machinePane.append(machineSwitch, stage, pity, pulls, rates);

  // ---- Synthesizer ----------------------------------------------------------
  const synthPane = element("div", "cm-gacha__pane cm-gacha__pane--synth");
  const furnace = element("div", "cm-gacha__furnace");
  furnace.append(image(CYBER_GACHA_ART.furnace, "cm-gacha__furnace-img", uiText("合金合成爐")));
  const slots = element("div", "cm-gacha__slots");
  const synthNote = element("p", "cm-gacha__note", uiText("投入任意 5 個晶片，100% 熔煉出 1 塊進化金屬；高階晶片越多，越容易暴擊出 SSR／UR。"));
  const synthActions = element("div", "cm-gacha__synth-actions");
  const autoFill = button("cm-gacha__action", uiText("⚡ 一鍵填入多餘低階晶片"));
  const smelt = button("cm-gacha__action cm-gacha__action--primary", uiText("♻️ 熔煉合成"));
  synthActions.append(autoFill, smelt);
  const synthList = element("div", "cm-gacha__chip-grid");
  synthPane.append(furnace, slots, synthNote, synthActions, synthList);
  let synthSlots = [];

  // ---- Bag ----------------------------------------------------------------
  const bagPane = element("div", "cm-gacha__pane cm-gacha__pane--bag");
  const bagGrid = element("div", "cm-gacha__chip-grid cm-gacha__chip-grid--bag");
  const usePanel = element("div", "cm-gacha__use");
  bagPane.append(bagGrid, usePanel);
  let bagSelection = null;
  let partnerSelection = null;

  // ---- Result overlay ----------------------------------------------------------
  const overlay = element("div", "cm-gacha__overlay");
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const overlayDrop = element("div", "cm-gacha__drop");
  const overlayCards = element("div", "cm-gacha__cards");
  const overlayTitle = element("h2", "cm-gacha__overlay-title");
  const overlayClose = button("cm-gacha__action cm-gacha__action--primary", uiText("確定"));
  overlay.append(overlayTitle, overlayDrop, overlayCards, overlayClose);
  overlayClose.addEventListener("click", () => { overlay.hidden = true; delete root.dataset.revealing; fx(overlayClose, "close"); });

  const pityPicker = element("div", "cm-gacha__overlay cm-gacha__picker");
  pityPicker.hidden = true;
  root.append(wallet, modes, machinePane, synthPane, bagPane, overlay, pityPicker);
  host.append(root);

  let lastFrame = null;
  let shownSerial = null;
  let busy = false;
  const life = new AbortController();

  // ---- Dedicated crank stage (Owner 2026-10-29: the player turns the handle) ----
  // Nothing is charged until the handle has gone one full turn clockwise;
  // turning back is a ratchet (it never counts down) and Cancel is free.
  const crankStage = element("div", "cm-gacha__overlay cm-gacha__crank-stage");
  crankStage.hidden = true;
  crankStage.setAttribute("role", "dialog");
  crankStage.setAttribute("aria-modal", "true");
  const crankTitle = element("h2", "cm-gacha__overlay-title", uiText("轉動把手！"));
  const crankCost = element("p", "cm-gacha__crank-cost");
  const bigStage = element("div", "cm-gacha__stage cm-gacha__stage--big");
  const bigDome = element("div", "cm-gacha__dome");
  const bigBalls = tumbleBalls.map((ball) => { const copy = ball.cloneNode(true); bigDome.append(copy); return copy; });
  const dial = element("div", "cm-gacha__dial");
  dial.tabIndex = 0;
  dial.setAttribute("role", "slider");
  dial.setAttribute("aria-label", uiText("轉蛋機把手"));
  dial.setAttribute("aria-valuemin", "0");
  dial.setAttribute("aria-valuemax", "360");
  const dialProgress = element("span", "cm-gacha__dial-progress");
  const dialCrank = image(CYBER_GACHA_ART.crank, "cm-gacha__dial-crank");
  const dialArrow = element("span", "cm-gacha__dial-arrow", "↻");
  dial.append(dialProgress, dialCrank, dialArrow);
  bigStage.append(bigDome, image(CYBER_GACHA_ART.machine, "cm-gacha__body"), dial);
  const crankHint = element("p", "cm-gacha__note cm-gacha__crank-hint", uiText("按住把手，順時針轉一整圈"));
  const crankActions = element("div", "cm-gacha__synth-actions");
  const crankAuto = button("cm-gacha__action", uiText("快速轉完"));
  const crankCancel = button("cm-gacha__action", uiText("取消"));
  crankActions.append(crankCancel, crankAuto);
  crankStage.append(crankTitle, crankCost, bigStage, crankHint, crankActions);
  root.append(crankStage);

  let crankJob = null;
  function setCrank(angle) {
    if (!crankJob || crankJob.done) return;
    const before = crankJob.turned;
    crankJob.turned = Math.max(before, Math.min(360, angle));
    const turned = crankJob.turned;
    dialCrank.style.transform = `rotate(${turned}deg)`;
    dial.style.setProperty("--p", String(turned / 360));
    dial.setAttribute("aria-valuenow", String(Math.round(turned)));
    // A gear click every eighth of a turn; the capsules rattle as it turns.
    if (Math.floor(turned / 45) > Math.floor(before / 45)) {
      fx(dial, "toggle");
      if (!prefersReducedMotion()) for (const ball of bigBalls) ball.animate?.([{ transform: "translate(0,0)" },
        { transform: `translate(${(Math.random() - 0.5) * 10}px,${-4 - Math.random() * 8}px) rotate(${(Math.random() - 0.5) * 40}deg)` },
        { transform: "translate(0,0)" }], { duration: 180 });
    }
    if (turned >= 360) void finishCrank(true);
  }
  async function finishCrank(turnedFully) {
    const job = crankJob;
    if (!job || job.done) return;
    job.done = true;
    if (turnedFully) {
      crankStage.dataset.state = "dispense";
      fx(dial, "snap");
      if (!prefersReducedMotion()) {
        for (const ball of bigBalls) {
          const dx = (Math.random() - 0.5) * 70, dy = -20 - Math.random() * 50, r = (Math.random() - 0.5) * 540;
          ball.animate?.([{ transform: "translate(0,0) rotate(0deg)" }, { transform: `translate(${dx}px,${dy}px) rotate(${r / 2}deg)` },
            { transform: `translate(${-dx / 2}px,${dy / 3}px) rotate(${r}deg)` }, { transform: "translate(0,0) rotate(0deg)" }],
          { duration: 550, easing: "ease-in-out" });
        }
        await wait(560, life.signal);
      }
    }
    crankStage.hidden = true;
    delete crankStage.dataset.state;
    crankJob = null;
    job.resolve(turnedFully);
  }
  function openCrank(count, cost) {
    return new Promise((resolve) => {
      crankJob = { count, resolve, turned: 0, last: null, done: false };
      crankTitle.textContent = uiText(count === 10 ? "十連狂轉" : "單抽");
      crankCost.textContent = cost;
      dialCrank.style.transform = "rotate(0deg)";
      dial.style.setProperty("--p", "0");
      dial.setAttribute("aria-valuenow", "0");
      crankStage.hidden = false;
      fx(crankStage, "open");
      dial.focus?.({ preventScroll: true });
    });
  }
  const angleAt = (event) => {
    const box = dial.getBoundingClientRect();
    return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180 / Math.PI;
  };
  dial.addEventListener("pointerdown", (event) => {
    if (!crankJob || crankJob.done) return;
    event.preventDefault();
    try { dial.setPointerCapture?.(event.pointerId); } catch { /* a synthetic pointer has no capture */ }
    crankJob.last = angleAt(event);
    dial.dataset.grabbed = "true";
  });
  dial.addEventListener("pointermove", (event) => {
    if (!crankJob || crankJob.last === null) return;
    const at = angleAt(event);
    let delta = at - crankJob.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    crankJob.last = at;
    // Screen y grows downward, so a clockwise drag is a growing angle.
    if (delta > 0 && delta < 90) setCrank(crankJob.turned + delta);
  });
  const release = () => { if (crankJob) crankJob.last = null; delete dial.dataset.grabbed; };
  dial.addEventListener("pointerup", release);
  dial.addEventListener("pointercancel", release);
  dial.addEventListener("keydown", (event) => {
    if (!crankJob) return;
    if (["ArrowRight", "ArrowDown", " ", "Enter"].includes(event.key)) { event.preventDefault(); setCrank(crankJob.turned + 45); }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); void finishCrank(false); }
  });
  crankCancel.addEventListener("click", () => { fx(crankCancel, "close"); void finishCrank(false); });
  crankAuto.addEventListener("click", async () => {
    // The same turn, played for the player (and the reduced-motion path).
    const job = crankJob;
    if (!job) return;
    if (prefersReducedMotion()) { setCrank(360); return; }
    const from = job.turned, started = performance.now();
    while (crankJob === job && !job.done) {
      const t = Math.min(1, (performance.now() - started) / 700);
      setCrank(from + (360 - from) * (1 - (1 - t) ** 3));
      if (t >= 1) break;
      await wait(16, life.signal);
    }
  });

  async function reveal(result) {
    const prizes = result.prizes ?? [];
    const best = prizes.reduce((top, prize) => (RARITY_ORDER[prize.rarity] > RARITY_ORDER[top] ? prize.rarity : top), "R");
    root.dataset.revealing = "true";
    overlay.dataset.rarity = best;
    overlayTitle.textContent = uiText(result.kind === "SYNTH" ? (result.critical ? "♻️ 熔煉暴擊！" : "♻️ 熔煉完成")
      : result.kind === "PITY" ? "🔥 自選箱開啟" : result.count === 10 ? "🎰 十連狂轉結果" : "🎰 開獎結果");
    overlayCards.replaceChildren();
    overlayDrop.replaceChildren();
    const capsule = element("div", "cm-gacha__capsule");
    capsule.dataset.rarity = best;
    const top = image(CYBER_GACHA_ART.capsule[best].top, "cm-gacha__capsule-top");
    const bottom = image(CYBER_GACHA_ART.capsule[best].bottom, "cm-gacha__capsule-bottom");
    const burst = element("span", "cm-gacha__burst");
    capsule.append(burst, bottom, top);
    overlayDrop.append(capsule);
    overlay.hidden = false;
    overlayClose.disabled = true;
    const reduced = prefersReducedMotion();
    if (!reduced) {
      capsule.animate?.([{ transform: "translateY(-160px) scale(.6)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.55 },
        { transform: "translateY(-14px) scale(1.04)", offset: 0.75 }, { transform: "translateY(0) scale(1)" }], { duration: 520, easing: "cubic-bezier(.3,1.4,.6,1)" });
      fx(capsule, "snap");
      await wait(560, life.signal);
      capsule.animate?.([{ transform: "rotate(0)" }, { transform: "rotate(-9deg)" }, { transform: "rotate(9deg)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(0)" }],
        { duration: 360, iterations: RARITY_ORDER[best] >= 2 ? 2 : 1 });
      await wait(RARITY_ORDER[best] >= 2 ? 720 : 360, life.signal);
    }
    capsule.dataset.open = "true";
    fx(capsule, RARITY_ORDER[best] >= 2 ? "levelup" : "sparkle");
    await wait(reduced ? 0 : 260, life.signal);
    prizes.forEach((prize, index) => {
      const card = element("article", "cm-gacha__card");
      card.dataset.rarity = prize.rarity;
      card.dataset.kind = prize.kind;
      if (prize.guaranteed) card.dataset.guaranteed = "true";
      card.style.setProperty("--n", String(index));
      card.append(element("span", "cm-gacha__card-rarity", prize.rarity), itemIcon(prize, "cm-gacha-icon cm-gacha-icon--card"),
        element("strong", "cm-gacha__card-name", uiText(prize.name)),
        element("span", "cm-gacha__card-qty", prize.quantity > 1 ? `×${prize.quantity}` : prize.kind === "METAL" ? uiText("進化金屬") : prize.kind === "CHIP" ? uiText("晶片") : ""));
      overlayCards.append(card);
      if (!reduced) card.animate?.([{ transform: "scale(.2) translateY(40px)", opacity: 0 }, { transform: "scale(1.18)", opacity: 1, offset: 0.6 },
        { transform: "scale(.94)", offset: 0.8 }, { transform: "scale(1)" }], { duration: 480, delay: 70 * index, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" });
    });
    await wait(reduced ? 0 : 70 * prizes.length + 300, life.signal);
    overlayClose.disabled = false;
    overlayClose.focus?.({ preventScroll: true });
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    try {
      const machine = root.dataset.machine;
      if (action.crank && !(await openCrank(action.crank, action.cost))) return;
      const receipt = action.call();
      const result = receipt?.shop?.gacha?.lastResult ?? null;
      if (result && result.serial !== shownSerial) {
        shownSerial = result.serial;
        if (!result.ok) { fx(root, "denied", uiText(REFUSALS[result.reason] ?? "無法完成。")); onRefusal(result.reason); }
        else if (result.prizes?.length) await reveal(result);
        else fx(root, "levelup", uiText(result.kind === "ARMED" ? "已裝填" : "已使用"));
      }
      root.dataset.machine = machine;
    } finally { busy = false; paint(lastFrame); }
  }

  const pull = (count) => run({ crank: count, cost: (count === 10 ? ten : single).lastElementChild?.textContent ?? "",
    call: () => intents.gachaPull(root.dataset.machine, count) });
  single.addEventListener("click", () => pull(1));
  crank.addEventListener("click", () => { if (!single.disabled) pull(1); });
  ten.addEventListener("click", () => pull(10));
  pityClaim.addEventListener("click", () => openPityPicker());
  autoFill.addEventListener("click", () => {
    synthSlots = [...(lastFrame?.autoFill ?? [])];
    if (!synthSlots.length) fx(autoFill, "denied", uiText("沒有足夠的多餘 R 級晶片（每種保留 1 個）。"));
    else fx(autoFill, "snap");
    paint(lastFrame);
  });
  smelt.addEventListener("click", () => run({ call: () => intents.gachaSynthesize([...synthSlots]) }).then(() => { synthSlots = []; paint(lastFrame); }));
  slots.addEventListener("click", (event) => {
    const slot = event.target.closest?.("[data-slot]");
    if (!slot || !synthSlots[Number(slot.dataset.slot)]) return;
    synthSlots.splice(Number(slot.dataset.slot), 1);
    paint(lastFrame);
  });

  function openPityPicker() {
    const frame = lastFrame;
    if (!frame || frame.pity < frame.pityMax) return;
    pityPicker.replaceChildren(element("h2", "cm-gacha__overlay-title", uiText("🔥 高階進化金屬自選箱")));
    const grid = element("div", "cm-gacha__cards");
    for (const metal of frame.metals.filter((m) => RARITY_ORDER[m.rarity] >= 2)) {
      const card = button("cm-gacha__card");
      card.dataset.rarity = metal.rarity;
      card.append(element("span", "cm-gacha__card-rarity", metal.rarity), itemIcon(metal, "cm-gacha-icon cm-gacha-icon--card"),
        element("strong", "cm-gacha__card-name", uiText(metal.name)));
      card.addEventListener("click", () => { pityPicker.hidden = true; run({ call: () => intents.gachaClaimPity(metal.id) }); });
      grid.append(card);
    }
    const cancel = button("cm-gacha__action", uiText("稍後再選"));
    cancel.addEventListener("click", () => { pityPicker.hidden = true; });
    pityPicker.append(grid, cancel);
    pityPicker.hidden = false;
  }

  function chipTile(item, { count = item.owned, onClick, selected = false, locked = false } = {}) {
    const tile = button("cm-gacha__tile");
    tile.dataset.rarity = item.rarity;
    tile.dataset.itemId = item.id;
    if (selected) tile.dataset.selected = "true";
    if (locked) tile.dataset.locked = "true";
    tile.disabled = count < 1;
    const name = element("span", "cm-gacha__tile-name", uiText(item.name));
    tile.append(itemIcon(item), name, element("span", "cm-gacha__tile-count", uiText("持有 {n} 個", { n: count })));
    if (item.armed) tile.append(element("span", "cm-gacha__tile-flag", uiText("已裝填")));
    if (locked) tile.append(element("span", "cm-gacha__tile-flag", "🔒"));
    tile.addEventListener("click", onClick);
    return tile;
  }

  function paintSynth(frame) {
    slots.replaceChildren();
    const used = {};
    for (const id of synthSlots) used[id] = (used[id] ?? 0) + 1;
    for (let i = 0; i < 5; i += 1) {
      const id = synthSlots[i];
      const slot = button("cm-gacha__slot");
      slot.dataset.slot = String(i);
      const chip = id ? frame.chips.find((c) => c.id === id) : null;
      if (chip) { slot.dataset.rarity = chip.rarity; slot.append(itemIcon(chip)); slot.setAttribute("aria-label", uiText("移出{item}", { item: chip.name })); }
      else slot.append(element("span", "cm-gacha__slot-empty", "+"));
      slots.append(slot);
    }
    smelt.disabled = synthSlots.length !== 5;
    synthList.replaceChildren();
    for (const chip of frame.chips) {
      const left = chip.owned - (used[chip.id] ?? 0);
      synthList.append(chipTile(chip, { count: left, locked: chip.locked === true, onClick: () => {
        if (synthSlots.length >= 5 || left < 1) return;
        synthSlots.push(chip.id);
        fx(slots, "snap");
        paint(lastFrame);
      } }));
    }
  }

  const KIND_LABEL = Object.freeze({ GROWTH: "育成超頻晶片", HUNT: "狩獵戰術卡匣", BOUNTY: "深網強敵信標" });
  function paintBag(frame) {
    bagGrid.replaceChildren();
    const items = [...frame.metals.map((m) => ({ ...m, kind: "METAL" })), ...frame.chips];
    for (const item of items) {
      if (item.owned < 1 && !item.armed) continue;
      bagGrid.append(chipTile(item, { selected: bagSelection === item.id, onClick: () => { bagSelection = item.id; fx(bagGrid, "toggle"); paint(lastFrame); } }));
    }
    if (!bagGrid.childElementCount) bagGrid.append(element("p", "cm-gacha__note", uiText("背包還是空的。去轉蛋機轉一次吧！")));
    usePanel.replaceChildren();
    const item = items.find((entry) => entry.id === bagSelection && entry.owned > 0);
    if (!item) return;
    usePanel.append(element("strong", "cm-gacha__use-title", uiText(item.name)));
    const metal = item.kind === "METAL";
    const describe = metal
      ? uiText(RARITY_ORDER[item.rarity] >= 2 ? "強化：全能力 +{n}。SSR 以上會為拍檔銘刻「[{title}]」金屬血統與腳底流光。催化：無視不足條件，強制突破進化。"
        : "強化：全能力 +{n}。催化：無視不足條件，強制突破進化。", { n: item.boost, title: frame.bloodlines[item.family]?.title ?? "" })
      : uiText("{kind}・原「{origin}」", { kind: KIND_LABEL[item.kind] ?? "", origin: item.origin });
    usePanel.append(element("p", "cm-gacha__note", describe));
    const needsPartner = metal || item.kind === "GROWTH";
    if (needsPartner) {
      const roster = element("div", "cm-gacha__partners");
      for (const partner of frame.partners) {
        const pick = button("cm-gacha__partner");
        pick.dataset.instanceId = partner.instanceId;
        if (partnerSelection === partner.instanceId) pick.dataset.selected = "true";
        pick.append(partnerNameplate(partner));
        pick.addEventListener("click", () => { partnerSelection = partner.instanceId; paint(lastFrame); });
        roster.append(pick);
      }
      usePanel.append(roster);
    }
    const actions = element("div", "cm-gacha__synth-actions");
    const use = (mode, label) => {
      const action = button(`cm-gacha__action${mode === "ENHANCE" || !metal ? " cm-gacha__action--primary" : ""}`, uiText(label));
      action.disabled = needsPartner && !partnerSelection;
      action.dataset.useMode = mode;
      action.addEventListener("click", () => run({ call: () => intents.gachaUseItem(item.id, needsPartner ? partnerSelection : null, { mode }) }));
      actions.append(action);
    };
    if (metal) { use("ENHANCE", "✨ 強化銘刻"); use("CATALYST", "🧬 催化進化"); }
    else use("USE", item.kind === "GROWTH" ? "使用" : "裝填");
    usePanel.append(actions);
  }

  function paint(frame) {
    if (!frame) return;
    lastFrame = frame;
    ticketChip.lastElementChild.textContent = fmt(frame.tickets);
    diamondChip.lastElementChild.textContent = frame.diamonds === null ? "—" : fmt(frame.diamonds);
    bitsChip.lastElementChild.textContent = fmt(frame.bits);
    for (const [id, tab] of modeButtons) tab.setAttribute("aria-selected", String(root.dataset.mode === id));
    for (const tab of [premiumTab, bitsTab]) tab.setAttribute("aria-pressed", String(root.dataset.machine === tab.dataset.machine));
    const premium = root.dataset.machine === "PREMIUM";
    const spec = frame.machines[root.dataset.machine];
    const priceLabel = (price, count) => premium
      ? (frame.tickets >= price.tickets ? uiText("🎫 ×{n}", { n: price.tickets }) : uiText("💎 {n}", { n: fmt(price.diamonds) }))
      : uiText("🪙 {n}", { n: fmt(price.bits) });
    single.replaceChildren(element("strong", "", uiText("單抽")), element("span", "", priceLabel(spec.single, 1)));
    ten.replaceChildren(element("strong", "", uiText("十連狂轉")), element("span", "", priceLabel(spec.ten, 10)));
    const affordable = (price) => premium ? frame.tickets >= price.tickets || (frame.diamonds ?? -1) >= price.diamonds : frame.bits >= price.bits;
    single.disabled = busy || !affordable(spec.single);
    ten.disabled = busy || !affordable(spec.ten);
    crank.disabled = single.disabled;
    rates.textContent = uiText(premium
      ? "機率 R 60%・SR 28%・SSR 10%・UR 2%｜十連必出 SR 以上進化金屬或 Ω 晶片"
      : "培育補給與狩獵道具 66%・R 晶片 27%・基礎進化金屬 7%");
    pityLabel.textContent = uiText("🔥 核心熔煉值：{n} / {max}", { n: frame.pity, max: frame.pityMax });
    pityFill.style.width = `${Math.round((frame.pity / frame.pityMax) * 100)}%`;
    pity.dataset.ready = String(frame.pity >= frame.pityMax);
    pityClaim.hidden = frame.pity < frame.pityMax;
    synthSlots = synthSlots.filter((id) => (frame.chips.find((c) => c.id === id)?.owned ?? 0) > 0);
    if (root.dataset.mode === "SYNTH") paintSynth(frame);
    if (root.dataset.mode === "BAG") paintBag(frame);
  }

  return Object.freeze({
    root,
    update(frame) { paint(frame); },
    dispose() { life.abort(); root.remove(); }
  });
}

/** `[紅蓮] 名字` style plate: the bloodline badge in front of a partner's name. */
export function partnerNameplate(partner) {
  const plate = element("span", "cm-gacha-nameplate");
  if (partner.bloodline) {
    const badge = element("span", "cm-gacha-badge", `[${partner.bloodline.title}]`);
    badge.style.setProperty("--bloodline", partner.bloodline.color);
    plate.dataset.bloodline = partner.bloodline.family;
    plate.append(badge);
  }
  plate.append(element("span", "cm-gacha-nameplate__name", partner.name ?? ""));
  return plate;
}
