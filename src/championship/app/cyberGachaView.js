// Cyber Gachapon centre -- the Shop's third tab (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// DOM + Web Animations only: no canvas, no requestAnimationFrame. Reads
// `frame.shop.gacha` (the app's getCyberGachaFrame) and sends pulls, synthesis
// and item use through the Shop source intents; the app saves every result
// before this view shows it.
//
// Owner 2026-10-29, second pass: one tap turns the crank. Sixteen capsules
// tumble in the dome (cyberGachaPhysics.js, played as Web Animations), one
// drops out of the chute, flies to the camera and cracks, and every prize gets
// its own card on a dark stage. No system emoji anywhere: the status bar's
// currency art, the one gacha ticket picture and the inline SVG icons.

import { uiText } from "../text/uiText.js";
import { prefersReducedMotion } from "../presentation/presentationPreferences.js";
import { shopGoodsPresentation } from "../presentation/shopGoodsUiArt.js";
import { GACHA_TICKET_ART, gachaCurrencyImage, gachaIcon, gachaKindIconName, gachaTicketImage } from "./cyberGachaIcons.js";
import { GACHA_CAPSULE_RADIUS, crankTurn, settleCapsules, simulateTumble } from "./cyberGachaPhysics.js";

const UI_ART = "assets/production/ui/cyber-gacha-r1/";
export const CYBER_GACHA_ART = Object.freeze({
  machine: `${UI_ART}machine_body.webp`,
  crank: `${UI_ART}crank_handle.webp`,
  ticket: GACHA_TICKET_ART,
  furnace: `${UI_ART}synth_furnace.webp`,
  capsule: Object.freeze(Object.fromEntries(["R", "SR", "SSR", "UR"].map((rarity) => [rarity, Object.freeze({
    top: `${UI_ART}capsule_${rarity.toLowerCase()}_top.webp`,
    bottom: `${UI_ART}capsule_${rarity.toLowerCase()}_bottom.webp`
  })])))
});
const RARITY_ORDER = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });
// The dome's sixteen capsules: blue R, purple SR, gold SSR and one rainbow UR.
const DOME_CAPSULES = Object.freeze(["R", "SR", "R", "SSR", "R", "SR", "UR", "R", "SR", "R", "SSR", "SR", "R", "SR", "R", "SSR"]);
const CAPSULE_SIZE = GACHA_CAPSULE_RADIUS * 2;
const CHIP_FAMILIES = new Set(["GROWTH", "HUNT", "BOUNTY"]);
const KIND_LABEL = Object.freeze({ GROWTH: "育成超頻晶片", HUNT: "狩獵戰術卡匣", BOUNTY: "深網強敵信標" });
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

// The machine squashes and rattles while the crank turns (origin: its feet).
const MACHINE_RATTLE = [0, 0.07, 0.14, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.72, 0.84, 1].map((offset, index, list) => {
  const swell = index === 0 || index === list.length - 1 ? 0 : Math.sin(Math.PI * offset);
  const squash = (index % 2 ? 1 : -1) * 0.024 * swell;
  return { offset, transform: `translateX(${((index % 3) - 1) * 1.2 * swell}px) scale(${1 + squash}, ${1 - squash})` };
});
// The prize capsule out of the chute: it pops, lands, bounces twice (origin: its bottom).
const CHUTE_DROP = [
  { offset: 0, transform: "translate(-50%, -150%) scale(.6)", opacity: 0 },
  { offset: 0.14, transform: "translate(-50%, -125%) scale(.85)", opacity: 1, easing: "cubic-bezier(.5,0,.9,.5)" },
  { offset: 0.32, transform: "translate(-50%, -100%) scale(1.12, .86)" },
  { offset: 0.48, transform: "translate(-50%, -128%) scale(.96, 1.05)", easing: "cubic-bezier(.5,0,.9,.5)" },
  { offset: 0.62, transform: "translate(-50%, -100%) scale(1.07, .93)" },
  { offset: 0.74, transform: "translate(-50%, -110%) scale(1)", easing: "cubic-bezier(.5,0,.9,.5)" },
  { offset: 0.84, transform: "translate(-50%, -100%) scale(1.03, .97)" },
  { offset: 1, transform: "translate(-50%, -100%) scale(1)" }
];
const CHUTE_LANDINGS = [180, 347, 470];
const SHUDDER = [{ transform: "rotate(0)" }, { transform: "rotate(-10deg) scale(1.03)" }, { transform: "rotate(9deg) scale(1.05)" },
  { transform: "rotate(-6deg) scale(1.04)" }, { transform: "rotate(0) scale(1)" }];
const QUAKE = [{ transform: "none" }, { transform: "translate(-5px, 3px)" }, { transform: "translate(4px, -4px)" },
  { transform: "translate(-3px, -2px)" }, { transform: "translate(2px, 2px)" }, { transform: "none" }];

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
/** An arcade armour key: icon (SVG or picture) and label. */
function key(className, label, icon) {
  const node = button(`cm-gacha-key ${className}`);
  if (icon) node.append(icon);
  if (label !== undefined) node.append(element("span", "cm-gacha-key__label", label));
  return node;
}
function fx(target, kind, text, extra = {}) {
  try { target?.dispatchEvent(new CustomEvent("cm-fx", { bubbles: true, detail: { kind, text, ...extra } })); } catch { /* optional */ }
}
const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");
const bestRarity = (prizes) => prizes.reduce((top, prize) => (RARITY_ORDER[prize.rarity] > RARITY_ORDER[top] ? prize.rarity : top), "R");

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

/**
 * The cards a result deals: one per prize, in pull order. A ten-pull always
 * deals ten cards, even when the same item comes up twice -- the bag stacks
 * them, the stage never does.
 */
export function gachaRevealCards(result) {
  return (result?.prizes ?? []).map((prize, index) => Object.freeze({ ...prize, index }));
}

function itemIcon(item, className = "cm-gacha-icon") {
  const host = element("span", className);
  host.dataset.rarity = item.rarity ?? "R";
  const family = CHIP_FAMILIES.has(item.kind) ? item.kind : item.chipKind;
  const art = gachaItemArt(item);
  if (family) host.dataset.family = family;
  if (art) host.append(image(art.src, "cm-gacha-icon__img"));
  if (family) host.append(gachaIcon(gachaKindIconName(family), art ? "cm-gacha-icon__kind" : "cm-gacha-icon__glyph"));
  return host;
}

function capsuleShell(className, rarity) {
  const node = element("span", className);
  const top = image(CYBER_GACHA_ART.capsule[rarity].top, "cm-gacha__half cm-gacha__half--top");
  const bottom = image(CYBER_GACHA_ART.capsule[rarity].bottom, "cm-gacha__half cm-gacha__half--bottom");
  node.dataset.rarity = rarity;
  node.append(top, bottom);
  return { node, top, bottom };
}
function paintCapsule(shell, rarity) {
  shell.node.dataset.rarity = rarity;
  shell.top.src = CYBER_GACHA_ART.capsule[rarity].top;
  shell.bottom.src = CYBER_GACHA_ART.capsule[rarity].bottom;
}
const capsuleTransform = ({ x, y, a }) =>
  `translate(${(((x - GACHA_CAPSULE_RADIUS) / CAPSULE_SIZE) * 100).toFixed(2)}%, ${(((y - GACHA_CAPSULE_RADIUS) / CAPSULE_SIZE) * 100).toFixed(2)}%) rotate(${a.toFixed(1)}deg)`;

export function createCyberGachaPanel({ host, intents, onRefusal = () => {} }) {
  ensureStylesheet(host.ownerDocument);
  const root = element("section", "cm-gacha");
  root.setAttribute("aria-label", uiText("數碼轉蛋中心"));
  root.dataset.mode = "MACHINE";
  root.dataset.machine = "PREMIUM";

  // ---- Animation bookkeeping: every timed beat is a Web Animation, so a
  // paused page freezes the show and a tap on the stage can skip it.
  const clock = element("span", "cm-gacha__clock");
  clock.setAttribute("aria-hidden", "true");
  const running = new Set();
  let skipping = false;
  function play(node, keyframes, options) {
    if (!node?.animate) return null;
    const animation = node.animate(keyframes, options);
    running.add(animation);
    const forget = () => running.delete(animation);
    animation.finished.then(forget, forget);
    if (skipping) { try { animation.finish(); } catch { /* nothing to finish */ } }
    return animation;
  }
  const settled = (animation) => (animation ? animation.finished.then(() => {}, () => {}) : Promise.resolve());
  const beat = (ms) => settled(play(clock, [{ opacity: 0 }, { opacity: 0 }], { duration: Math.max(0, ms) }));
  function skip() {
    skipping = true;
    for (const animation of [...running]) { try { animation.finish(); } catch { /* cancelled */ } }
  }

  // ---- Currencies stay on top in every mode --------------------------------
  const wallet = element("div", "cm-gacha__wallet");
  const purse = (className, icon, label) => {
    const chip = element("span", `cm-gacha__coin ${className}`);
    chip.setAttribute("title", label);
    chip.append(icon, element("strong"));
    return chip;
  };
  const ticketChip = purse("cm-gacha__coin--ticket", gachaTicketImage("cm-gacha__coin-icon cm-gacha__coin-icon--ticket"), uiText("數碼轉蛋券"));
  const diamondChip = purse("cm-gacha__coin--diamond", gachaCurrencyImage("diamond", "cm-gacha__coin-icon"), uiText("鑽石"));
  const bitsChip = purse("cm-gacha__coin--bits", gachaCurrencyImage("bits", "cm-gacha__coin-icon"), uiText("位元幣"));
  wallet.append(ticketChip, diamondChip, bitsChip);

  const modes = element("div", "cm-gacha__modes");
  modes.setAttribute("role", "tablist");
  const modeButtons = new Map();
  for (const [id, label, icon] of [["MACHINE", "轉蛋機", "machine"], ["SYNTH", "合成爐", "furnace"], ["BAG", "晶片背包", "bag"]]) {
    const tab = key("cm-gacha__mode", uiText(label), gachaIcon(icon, "cm-gacha-key__icon"));
    tab.dataset.mode = id;
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => { root.dataset.mode = id; fx(tab, "toggle"); paint(lastFrame); });
    modes.append(tab);
    modeButtons.set(id, tab);
  }

  // ---- Machine ------------------------------------------------------------
  const machinePane = element("div", "cm-gacha__pane cm-gacha__pane--machine");
  const machineSwitch = element("div", "cm-gacha__machines");
  const premiumTab = key("cm-gacha__machine-tab", uiText("王牌超頻＆進化金屬"), gachaIcon("galaxy", "cm-gacha-key__icon"));
  premiumTab.dataset.machine = "PREMIUM";
  const bitsTab = key("cm-gacha__machine-tab", uiText("位元幣日常補給"), gachaCurrencyImage("bits", "cm-gacha-key__icon"));
  bitsTab.dataset.machine = "BITS";
  for (const tab of [premiumTab, bitsTab]) {
    tab.addEventListener("click", () => { root.dataset.machine = tab.dataset.machine; fx(tab, "toggle"); paint(lastFrame); });
  }
  machineSwitch.append(premiumTab, bitsTab);

  // Layers, back to front: aura, dark dome wall, sixteen capsules, machine art
  // (its dome is clear glass), glass glints, the crank and the chute capsule.
  const stage = element("div", "cm-gacha__stage");
  stage.dataset.state = "idle";
  const machine = element("div", "cm-gacha__machine");
  const aura = element("span", "cm-gacha__aura");
  const domeWall = element("span", "cm-gacha__dome-wall");
  const dome = element("div", "cm-gacha__dome");
  const capsules = DOME_CAPSULES.map((rarity, index) => {
    const ball = element("span", "cm-gacha__ball");
    ball.dataset.rarity = rarity;
    ball.style.width = `${CAPSULE_SIZE * 100}%`;
    const shell = capsuleShell("cm-gacha__ball-shell", rarity).node;
    shell.style.setProperty("--bob-delay", `${(-index * 0.37).toFixed(2)}s`);
    shell.style.setProperty("--bob-time", `${(2.3 + (index % 5) * 0.28).toFixed(2)}s`);
    ball.append(shell);
    dome.append(ball);
    return ball;
  });
  let pile = settleCapsules(capsules.length);
  const placeCapsules = () => capsules.forEach((ball, index) => { ball.style.transform = capsuleTransform(pile[index]); ball.style.opacity = ""; });
  placeCapsules();
  const body = image(CYBER_GACHA_ART.machine, "cm-gacha__body", uiText("賽博轉蛋機"));
  const glass = element("span", "cm-gacha__glass");
  const crank = button("cm-gacha__crank");
  crank.setAttribute("aria-label", uiText("轉動把手單抽"));
  const crankImg = image(CYBER_GACHA_ART.crank, "cm-gacha__crank-img");
  crank.append(crankImg);
  const chute = capsuleShell("cm-gacha__chute", "R");
  chute.node.hidden = true;
  machine.append(aura, domeWall, dome, body, glass, crank, chute.node);
  stage.append(machine);

  // Cabinet side panels: the core-heat gauge on the left, the two machines on the right.
  const pity = element("div", "cm-gacha__pity");
  pity.setAttribute("role", "meter");
  pity.setAttribute("aria-valuemin", "0");
  const pityLabel = element("span", "cm-gacha__pity-value");
  const pityBar = element("span", "cm-gacha__pity-bar");
  const pityFill = element("span", "cm-gacha__pity-fill");
  pityBar.append(pityFill);
  const pityClaim = key("cm-gacha__pity-claim", uiText("領取自選箱"));
  pity.append(gachaIcon("flame", "cm-gacha__pity-icon"), element("span", "cm-gacha__pity-title", uiText("核心熔煉值")), pityBar, pityLabel, pityClaim);
  const deck = element("div", "cm-gacha__deck");

  const pulls = element("div", "cm-gacha__pulls");
  const single = button("cm-gacha-key cm-gacha__pull cm-gacha__pull--one");
  const ten = button("cm-gacha-key cm-gacha__pull cm-gacha__pull--ten");
  pulls.append(single, ten);
  const rates = element("p", "cm-gacha__plate cm-gacha__rates");
  deck.append(pity, stage, machineSwitch);
  machinePane.append(deck, pulls, rates);

  // ---- Synthesizer ----------------------------------------------------------
  const synthPane = element("div", "cm-gacha__pane cm-gacha__pane--synth");
  const furnace = element("div", "cm-gacha__furnace");
  const furnaceImg = image(CYBER_GACHA_ART.furnace, "cm-gacha__furnace-img", uiText("合金合成爐"));
  furnace.append(furnaceImg);
  const slots = element("div", "cm-gacha__slots");
  const synthNote = element("p", "cm-gacha__plate cm-gacha__note", uiText("投入任意 5 個晶片，100% 熔煉出 1 塊進化金屬；高階晶片越多，越容易暴擊出 SSR／UR。"));
  const synthActions = element("div", "cm-gacha__actions");
  const autoFill = key("cm-gacha__action", uiText("自動填入低階晶片"), gachaIcon("bolt", "cm-gacha-key__icon"));
  const smelt = key("cm-gacha__action cm-gacha__action--primary", uiText("開始熔煉合成"), gachaIcon("furnace", "cm-gacha-key__icon"));
  synthActions.append(autoFill, smelt);
  const synthList = element("div", "cm-gacha__chip-grid");
  const synthHead = element("div", "cm-gacha__synth-head");
  synthHead.append(furnace, synthNote);
  synthPane.append(synthHead, slots, synthActions, synthList);
  let synthSlots = [];

  // ---- Bag ----------------------------------------------------------------
  const bagPane = element("div", "cm-gacha__pane cm-gacha__pane--bag");
  const bagGrid = element("div", "cm-gacha__chip-grid cm-gacha__chip-grid--bag");
  const usePanel = element("div", "cm-gacha__use");
  bagPane.append(usePanel, bagGrid);
  let bagSelection = null;
  let partnerSelection = null;

  // ---- Reveal stage: deep space, light rays, the capsule, then the cards -------
  const revealStage = element("div", "cm-gacha__reveal");
  revealStage.hidden = true;
  revealStage.setAttribute("role", "dialog");
  revealStage.setAttribute("aria-modal", "true");
  const rays = element("span", "cm-gacha__rays");
  const motes = element("span", "cm-gacha__motes");
  for (let i = 0; i < 14; i += 1) {
    const mote = element("span");
    mote.style.setProperty("--x", `${(i * 37) % 100}%`);
    mote.style.setProperty("--d", `${(-i * 0.61).toFixed(2)}s`);
    mote.style.setProperty("--t", `${(5 + (i % 4) * 1.3).toFixed(1)}s`);
    motes.append(mote);
  }
  const flash = element("span", "cm-gacha__flash");
  const revealInner = element("div", "cm-gacha__reveal-inner");
  const revealTitle = element("h2", "cm-gacha__reveal-title");
  const revealTitleText = element("span");
  revealTitle.append(gachaIcon("machine", "cm-gacha__reveal-icon"), revealTitleText);
  const cardsGrid = element("div", "cm-gacha__cards");
  const revealActions = element("div", "cm-gacha__actions cm-gacha__reveal-actions");
  const revealConfirm = key("cm-gacha__action cm-gacha__action--primary", uiText("確定收下"));
  const revealAgain = key("cm-gacha__action cm-gacha__action--again", uiText("再轉十次"), gachaIcon("machine", "cm-gacha-key__icon"));
  revealActions.append(revealConfirm, revealAgain);
  revealInner.append(revealTitle, cardsGrid, revealActions);
  const capsuleLayer = element("div", "cm-gacha__capsule-layer");
  const glow = element("span", "cm-gacha__capsule-glow");
  const burst = element("span", "cm-gacha__burst");
  const bigCapsule = capsuleShell("cm-gacha__capsule", "R");
  capsuleLayer.append(glow, burst, bigCapsule.node);
  const sparks = element("div", "cm-gacha__sparks");
  revealStage.append(rays, motes, revealInner, capsuleLayer, flash, sparks);

  const pityPicker = element("div", "cm-gacha__reveal cm-gacha__picker");
  pityPicker.hidden = true;
  pityPicker.setAttribute("role", "dialog");
  pityPicker.setAttribute("aria-modal", "true");
  root.append(wallet, modes, machinePane, synthPane, bagPane, revealStage, pityPicker, clock);
  host.append(root);

  let lastFrame = null;
  let shownSerial = null;
  let busy = false;
  let revealing = false;
  let again = null;
  let returnFocus = null;
  const life = new AbortController();

  // ---- The machine: one tap turns the crank ------------------------------------
  async function turnMachine(best) {
    if (prefersReducedMotion()) return;
    stage.dataset.state = "turning";
    const turn = crankTurn({ degrees: 720, ms: 650 });
    fx(crank, "gacha-crank", undefined, { ticks: turn.ticks });
    const spin = play(crankImg, turn.frames.map((deg) => ({ transform: `rotate(${deg.toFixed(1)}deg)` })), { duration: turn.ms, easing: "linear" });
    play(machine, MACHINE_RATTLE, { duration: turn.ms, easing: "linear" });
    const tumble = simulateTumble(pile);
    const moves = capsules.map((ball, index) => play(ball, tumble.frames.map((frame) => ({
      transform: capsuleTransform(frame[index]), opacity: frame[index].o
    })), { duration: tumble.ms, easing: "linear", fill: "forwards" }));
    fx(dome, "gacha-tumble");
    pile = tumble.final;
    void Promise.all(moves.map(settled)).then(() => { placeCapsules(); for (const move of moves) move?.cancel(); });
    // The sunk capsule comes out of the chute while the pile is still flying.
    await beat(470);
    paintCapsule(chute, best);
    chute.node.hidden = false;
    stage.dataset.state = "dispense";
    const drop = play(chute.node, CHUTE_DROP, { duration: 560, easing: "linear", fill: "forwards" });
    fx(chute.node, "gacha-drop", undefined, { ticks: CHUTE_LANDINGS });
    await settled(spin);
    await settled(drop);
  }

  async function smeltFurnace() {
    if (prefersReducedMotion()) return;
    fx(furnace, "gacha-smelt");
    await settled(play(furnaceImg, [{ transform: "none", filter: "brightness(1)" }, { transform: "scale(1.1, .9)", filter: "brightness(1.6)", offset: 0.35 },
      { transform: "scale(.94, 1.08)", filter: "brightness(1.3)", offset: 0.6 }, { transform: "none", filter: "brightness(1)" }], { duration: 620, easing: "ease-in-out" }));
  }

  function resetReveal() {
    for (const node of [bigCapsule.node, bigCapsule.top, bigCapsule.bottom, glow, burst, flash, revealInner, revealStage]) {
      for (const animation of node.getAnimations?.() ?? []) animation.cancel();
    }
    cardsGrid.replaceChildren();
    sparks.replaceChildren();
  }

  function impact(card, prize) {
    const rank = RARITY_ORDER[prize.rarity] ?? 0;
    fx(card, "gacha-card", undefined, { rarity: prize.rarity });
    if (rank < 2 || prefersReducedMotion()) return;
    play(revealInner, QUAKE, { duration: 220 });
    const box = card.getBoundingClientRect(), frame = sparks.getBoundingClientRect();
    const x = box.left + box.width / 2 - frame.left, y = box.top + box.height / 2 - frame.top;
    for (let i = 0; i < 10; i += 1) {
      const star = element("span", "cm-gacha__star");
      star.dataset.rarity = prize.rarity;
      star.style.left = `${x}px`;
      star.style.top = `${y}px`;
      sparks.append(star);
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4, reach = 44 + Math.random() * 40;
      void settled(play(star, [{ transform: "translate(-50%, -50%) scale(.4) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${(Math.cos(angle) * reach).toFixed(1)}px), calc(-50% + ${(Math.sin(angle) * reach).toFixed(1)}px)) scale(1) rotate(170deg)`, opacity: 0 }],
      { duration: 660, easing: "cubic-bezier(.2,.9,.3,1)" })).then(() => star.remove());
    }
  }

  function revealCard(prize) {
    const card = element("article", "cm-gacha__card");
    card.dataset.rarity = prize.rarity;
    card.dataset.kind = prize.kind;
    const art = element("div", "cm-gacha__card-art");
    art.append(itemIcon(prize, "cm-gacha-icon cm-gacha-icon--card"));
    const info = element("div", "cm-gacha__card-info");
    info.append(element("strong", "cm-gacha__card-name", uiText(prize.name)),
      element("span", "cm-gacha__card-kind", prize.quantity > 1 ? `×${prize.quantity}`
        : prize.kind === "METAL" ? uiText("進化金屬") : prize.kind === "CHIP" ? uiText("晶片") : ""));
    card.append(art, element("span", "cm-gacha__card-rarity", prize.rarity), info);
    if (prize.guaranteed) card.append(element("span", "cm-gacha__card-guarantee", uiText("保底")));
    return card;
  }

  async function reveal(result, { fromChute = false } = {}) {
    const chipKinds = new Map((lastFrame?.chips ?? []).map((chip) => [chip.id, chip.kind]));
    const cards = gachaRevealCards(result).map((prize) => (prize.kind === "CHIP" ? { ...prize, chipKind: chipKinds.get(prize.id) } : prize));
    const best = bestRarity(cards);
    const high = RARITY_ORDER[best] >= 2;
    const reduced = prefersReducedMotion();
    resetReveal();
    skipping = false;
    revealing = true;
    revealStage.dataset.rarity = best;
    revealStage.dataset.phase = "capsule";
    cardsGrid.dataset.count = String(cards.length);
    revealTitleText.textContent = uiText(result.kind === "SYNTH" ? (result.critical ? "熔煉暴擊！" : "熔煉完成")
      : result.kind === "PITY" ? "自選箱開啟" : result.count === 10 ? "十連狂轉結果" : "開獎結果");
    revealStage.setAttribute("aria-label", revealTitleText.textContent);
    revealTitle.firstElementChild.replaceWith(gachaIcon(result.kind === "SYNTH" ? "furnace" : result.kind === "PITY" ? "flame" : "machine", "cm-gacha__reveal-icon"));
    revealActions.hidden = true;
    revealAgain.hidden = !again;
    revealAgain.querySelector(".cm-gacha-key__label").textContent = uiText(again?.count === 10 ? "再轉十次" : "再抽一次");
    paintCapsule(bigCapsule, best);
    bigCapsule.node.dataset.open = "false";
    capsuleLayer.hidden = false;
    revealStage.hidden = false;
    root.dataset.revealing = "true";

    if (!reduced) {
      play(revealStage, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
      let fly;
      if (fromChute && !chute.node.hidden) {
        // The capsule leaves the chute and flies at the camera.
        const from = chute.node.getBoundingClientRect(), to = bigCapsule.node.getBoundingClientRect();
        const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
        fly = play(bigCapsule.node, [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(from.width / Math.max(1, to.width)).toFixed(3)})` },
          { transform: "translate(0, -20px) scale(1.14)", offset: 0.72 }, { transform: "none" }], { duration: 460, easing: "cubic-bezier(.2,.9,.3,1)" });
      } else {
        fly = play(bigCapsule.node, [{ transform: "translateY(-60vh) scale(.6)", opacity: 0 }, { transform: "translateY(0) scale(1.08, .92)", opacity: 1, offset: 0.62 },
          { transform: "translateY(-14px) scale(.98, 1.02)", offset: 0.8 }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(.3,0,.6,1)" });
        fx(bigCapsule.node, "gacha-drop", undefined, { ticks: [350] });
      }
      chute.node.hidden = true;
      stage.dataset.state = "idle";
      await settled(fly);
      // Anticipation: the shell shudders; rare capsules twice, with light building behind.
      fx(bigCapsule.node, "gacha-rattle", undefined, { count: high ? 2 : 1 });
      const shudder = play(bigCapsule.node, SHUDDER, { duration: 380, iterations: high ? 2 : 1, easing: "ease-in-out" });
      if (high) play(glow, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 0.95, transform: "scale(1.2)" }], { duration: 760, easing: "ease-in", fill: "forwards" });
      await settled(shudder);
    }
    chute.node.hidden = true;
    stage.dataset.state = "idle";
    // Crack.
    bigCapsule.node.dataset.open = "true";
    revealStage.dataset.phase = "cards";
    fx(bigCapsule.node, "gacha-crack", undefined, { rarity: best });
    if (!reduced) {
      const fling = { duration: 520, easing: "cubic-bezier(.2,.9,.3,1)", fill: "forwards" };
      play(bigCapsule.top, [{ transform: "none", opacity: 1 }, { transform: "translate(-40%, -160%) rotate(-44deg)", opacity: 0 }], fling);
      play(bigCapsule.bottom, [{ transform: "none", opacity: 1 }, { transform: "translate(36%, 130%) rotate(34deg)", opacity: 0 }], fling);
      play(burst, [{ opacity: 1, transform: "scale(.3) rotate(0deg)" }, { opacity: 0, transform: "scale(2.6) rotate(40deg)" }], { duration: 900, easing: "ease-out" });
      play(glow, [{ opacity: high ? 0.95 : 0.6 }, { opacity: 0 }], { duration: 700, easing: "ease-out", fill: "forwards" });
      play(flash, [{ opacity: 0 }, { opacity: high ? 0.9 : 0.45, offset: 0.15 }, { opacity: 0 }], { duration: high ? 640 : 380, easing: "ease-out" });
      if (high) play(revealInner, QUAKE, { duration: 260 });
      await beat(180);
    }
    // Every prize slams onto the table, 55 ms apart.
    const landings = cards.map((prize, index) => {
      const card = revealCard(prize);
      cardsGrid.append(card);
      if (reduced) return Promise.resolve();
      const delay = 55 * index;
      const slam = play(card, [{ opacity: 0, transform: "translateY(44px) scale(.55) rotate(-5deg)" }, { opacity: 1, transform: "none" }],
        { duration: 420, delay, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" });
      return beat(delay + 230).then(() => { if (revealing && !life.signal.aborted) impact(card, prize); return settled(slam); });
    });
    await Promise.all(landings);
    if (life.signal.aborted) return;
    capsuleLayer.hidden = true;
    revealStage.dataset.phase = "done";
    paintAgain();
    revealActions.hidden = false;
    if (!reduced) play(revealActions, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.9,.3,1)" });
    revealConfirm.focus?.({ preventScroll: true });
  }

  function closeReveal() {
    if (revealStage.hidden) return;
    revealing = false;
    skip();
    revealStage.hidden = true;
    delete revealStage.dataset.phase;
    delete root.dataset.revealing;
    resetReveal();
    returnFocus?.focus?.({ preventScroll: true });
  }
  // A tap on the stage while the show runs skips straight to the cards.
  revealStage.addEventListener("pointerdown", (event) => {
    if (revealing && revealActions.hidden && !event.target.closest?.("button")) skip();
  });
  revealStage.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (revealActions.hidden) skip(); else { fx(revealConfirm, "close"); closeReveal(); }
  });
  revealConfirm.addEventListener("click", () => { fx(revealConfirm, "close"); closeReveal(); });
  revealAgain.addEventListener("click", () => {
    const next = again;
    closeReveal();
    if (next) { root.dataset.machine = next.machine; paint(lastFrame); pull(next.count, next.trigger); }
  });

  const priceOf = (spec, count) => spec[count === 10 ? "ten" : "single"];
  function affordable(frame, machineId, count) {
    const spec = frame?.machines?.[machineId];
    if (!spec) return false;
    const price = spec[count === 10 ? "ten" : "single"];
    return machineId === "PREMIUM" ? frame.tickets >= price.tickets || (frame.diamonds ?? -1) >= price.diamonds : frame.bits >= price.bits;
  }
  function paintAgain() {
    if (!again) return;
    revealAgain.disabled = !affordable(lastFrame, again.machine, again.count);
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    skipping = false;
    root.dataset.busy = "true";
    try {
      const machineId = root.dataset.machine;
      const receipt = action.call();
      const result = receipt?.shop?.gacha?.lastResult ?? null;
      if (result && result.serial !== shownSerial) {
        shownSerial = result.serial;
        if (!result.ok) { fx(root, "denied", uiText(REFUSALS[result.reason] ?? "無法完成。")); onRefusal(result.reason); }
        else if (result.prizes?.length) {
          again = action.pull ? { ...action.pull, machine: machineId } : null;
          returnFocus = action.pull?.trigger ?? null;
          if (action.pull) await turnMachine(bestRarity(result.prizes));
          else if (result.kind === "SYNTH") await smeltFurnace();
          if (!life.signal.aborted) await reveal(result, { fromChute: Boolean(action.pull) });
        } else fx(root, "gacha-use", uiText(result.kind === "ARMED" ? "已裝填" : "已使用"));
      }
      root.dataset.machine = machineId;
    } finally {
      busy = false;
      delete root.dataset.busy;
      paint(lastFrame);
    }
  }

  function pull(count, trigger = count === 10 ? ten : single) {
    return run({ pull: { count, trigger }, call: () => intents.gachaPull(root.dataset.machine, count) });
  }
  single.addEventListener("click", () => pull(1, single));
  crank.addEventListener("click", () => { if (!single.disabled) pull(1, single); else fx(crank, "denied"); });
  ten.addEventListener("click", () => pull(10, ten));
  pityClaim.addEventListener("click", () => openPityPicker());
  autoFill.addEventListener("click", () => {
    synthSlots = [...(lastFrame?.autoFill ?? [])];
    if (!synthSlots.length) fx(autoFill, "denied", uiText("沒有足夠的多餘 R 級晶片（每種保留 1 個）。"));
    else fx(slots, "gacha-slot", undefined, { count: synthSlots.length });
    paint(lastFrame);
  });
  smelt.addEventListener("click", () => run({ call: () => intents.gachaSynthesize([...synthSlots]) }).then(() => { synthSlots = []; paint(lastFrame); }));
  slots.addEventListener("click", (event) => {
    const slot = event.target.closest?.("[data-slot]");
    if (!slot || !synthSlots[Number(slot.dataset.slot)]) return;
    synthSlots.splice(Number(slot.dataset.slot), 1);
    fx(slots, "unsnap");
    paint(lastFrame);
  });

  function openPityPicker() {
    const frame = lastFrame;
    if (!frame || frame.pity < frame.pityMax) return;
    const inner = element("div", "cm-gacha__reveal-inner");
    const title = element("h2", "cm-gacha__reveal-title");
    title.append(gachaIcon("flame", "cm-gacha__reveal-icon"), element("span", "", uiText("高階進化金屬自選箱")));
    const grid = element("div", "cm-gacha__cards cm-gacha__cards--picker");
    for (const metal of frame.metals.filter((m) => RARITY_ORDER[m.rarity] >= 2)) {
      const card = button("cm-gacha__card cm-gacha__card--pick");
      card.dataset.rarity = metal.rarity;
      card.dataset.kind = "METAL";
      const art = element("span", "cm-gacha__card-art");
      art.append(itemIcon(metal, "cm-gacha-icon cm-gacha-icon--card"));
      const info = element("span", "cm-gacha__card-info");
      info.append(element("strong", "cm-gacha__card-name", uiText(metal.name)), element("span", "cm-gacha__card-kind", uiText("進化金屬")));
      card.append(art, element("span", "cm-gacha__card-rarity", metal.rarity), info);
      card.addEventListener("click", () => { pityPicker.hidden = true; returnFocus = pityClaim; again = null; run({ call: () => intents.gachaClaimPity(metal.id) }); });
      grid.append(card);
    }
    const cancel = key("cm-gacha__action", uiText("稍後再選"));
    cancel.addEventListener("click", () => { pityPicker.hidden = true; fx(cancel, "close"); pityClaim.focus?.({ preventScroll: true }); });
    const actions = element("div", "cm-gacha__actions cm-gacha__reveal-actions");
    actions.append(cancel);
    inner.append(title, grid, actions);
    pityPicker.replaceChildren(element("span", "cm-gacha__rays"), inner);
    pityPicker.dataset.rarity = "SSR";
    pityPicker.hidden = false;
    fx(pityPicker, "open");
  }

  function chipTile(item, { count = item.owned, onClick, selected = false, locked = false } = {}) {
    const tile = button("cm-gacha__tile");
    tile.dataset.rarity = item.rarity;
    tile.dataset.itemId = item.id;
    if (selected) tile.dataset.selected = "true";
    if (locked) tile.dataset.locked = "true";
    tile.disabled = count < 1;
    tile.append(element("span", "cm-gacha__tile-rarity", item.rarity), itemIcon(item),
      element("span", "cm-gacha__tile-name", uiText(item.name)),
      element("span", "cm-gacha__tile-count", uiText("持有 {n} 個", { n: count })));
    if (item.armed) tile.append(element("span", "cm-gacha__tile-flag", uiText("已裝填")));
    if (locked) tile.append(gachaIcon("lock", "cm-gacha__tile-lock"));
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
      if (chip) { slot.dataset.rarity = chip.rarity; slot.append(itemIcon(chip)); slot.setAttribute("aria-label", uiText("移出{item}", { item: uiText(chip.name) })); }
      else slot.append(element("span", "cm-gacha__slot-empty", "+"));
      slots.append(slot);
    }
    smelt.disabled = synthSlots.length !== 5;
    synthList.replaceChildren();
    // Chips still in hand first; spent and locked ones wait at the end.
    const left = (chip) => chip.owned - (used[chip.id] ?? 0);
    const ready = (chip) => left(chip) > 0 && chip.locked !== true;
    for (const chip of [...frame.chips.filter(ready), ...frame.chips.filter((chip) => !ready(chip))]) {
      const count = left(chip);
      synthList.append(chipTile(chip, { count, locked: chip.locked === true, onClick: () => {
        if (synthSlots.length >= 5 || count < 1) return;
        synthSlots.push(chip.id);
        fx(slots, "gacha-slot", undefined, { count: 1 });
        paint(lastFrame);
      } }));
    }
  }

  function paintBag(frame) {
    bagGrid.replaceChildren();
    const items = [...frame.metals.map((m) => ({ ...m, kind: "METAL" })), ...frame.chips];
    for (const item of items) {
      if (item.owned < 1 && !item.armed) continue;
      bagGrid.append(chipTile(item, { selected: bagSelection === item.id, onClick: () => { bagSelection = item.id; fx(bagGrid, "toggle"); paint(lastFrame); } }));
    }
    if (!bagGrid.childElementCount) bagGrid.append(element("p", "cm-gacha__plate cm-gacha__note", uiText("背包還是空的。去轉蛋機轉一次吧！")));
    usePanel.replaceChildren();
    const item = items.find((entry) => entry.id === bagSelection && entry.owned > 0);
    if (!item) return;
    usePanel.append(element("strong", "cm-gacha__use-title", uiText(item.name)));
    const metal = item.kind === "METAL";
    const describe = metal
      ? uiText(RARITY_ORDER[item.rarity] >= 2 ? "強化：全能力 +{n}。SSR 以上會為拍檔銘刻「[{title}]」金屬血統與腳底流光。催化：無視不足條件，強制突破進化。"
        : "強化：全能力 +{n}。催化：無視不足條件，強制突破進化。", { n: item.boost, title: frame.bloodlines[item.family]?.title ?? "" })
      : uiText("{kind}・原「{origin}」", { kind: uiText(KIND_LABEL[item.kind] ?? ""), origin: uiText(item.origin) });
    usePanel.append(element("p", "cm-gacha__use-note", describe));
    const needsPartner = metal || item.kind === "GROWTH";
    if (needsPartner) {
      const roster = element("div", "cm-gacha__partners");
      for (const partner of frame.partners) {
        const pick = button("cm-gacha__partner");
        pick.dataset.instanceId = partner.instanceId;
        if (partnerSelection === partner.instanceId) pick.dataset.selected = "true";
        pick.append(partnerNameplate(partner));
        pick.addEventListener("click", () => { partnerSelection = partner.instanceId; fx(pick, "toggle"); paint(lastFrame); });
        roster.append(pick);
      }
      usePanel.append(roster);
    }
    const actions = element("div", "cm-gacha__actions");
    const use = (mode, label, icon) => {
      const action = key(`cm-gacha__action${mode === "ENHANCE" || !metal ? " cm-gacha__action--primary" : ""}`, uiText(label), icon ? gachaIcon(icon, "cm-gacha-key__icon") : undefined);
      action.disabled = needsPartner && !partnerSelection;
      action.dataset.useMode = mode;
      action.addEventListener("click", () => { returnFocus = action; again = null; run({ call: () => intents.gachaUseItem(item.id, needsPartner ? partnerSelection : null, { mode }) }); });
      actions.append(action);
    };
    if (metal) { use("ENHANCE", "強化銘刻", "spark"); use("CATALYST", "催化進化", "evolve"); }
    else use("USE", item.kind === "GROWTH" ? "使用" : "裝填");
    usePanel.append(actions);
  }

  function pricePlate(premium, frame, price, count) {
    const plate = element("span", "cm-gacha__price");
    if (!premium) plate.append(gachaCurrencyImage("bits", "cm-gacha__price-icon"), element("span", "", fmt(price.bits)));
    else if (frame.tickets >= price.tickets) plate.append(gachaTicketImage("cm-gacha__price-icon cm-gacha__price-icon--ticket"), element("span", "", `×${price.tickets}`));
    else plate.append(gachaCurrencyImage("diamond", "cm-gacha__price-icon"), element("span", "", fmt(price.diamonds)));
    plate.dataset.count = String(count);
    return plate;
  }

  function paint(frame) {
    if (!frame) return;
    lastFrame = frame;
    ticketChip.lastElementChild.textContent = fmt(frame.tickets);
    diamondChip.lastElementChild.textContent = frame.diamonds === null ? "—" : fmt(frame.diamonds);
    bitsChip.lastElementChild.textContent = fmt(frame.bits);
    for (const [id, tab] of modeButtons) tab.setAttribute("aria-selected", String(root.dataset.mode === id));
    for (const tab of [premiumTab, bitsTab]) tab.setAttribute("aria-pressed", String(root.dataset.machine === tab.dataset.machine));
    const machineId = root.dataset.machine;
    const premium = machineId === "PREMIUM";
    const spec = frame.machines[machineId];
    single.replaceChildren(element("strong", "cm-gacha__pull-label", uiText("單抽")), pricePlate(premium, frame, priceOf(spec, 1), 1));
    ten.replaceChildren(element("strong", "cm-gacha__pull-label", uiText("十連狂轉")), pricePlate(premium, frame, priceOf(spec, 10), 10));
    single.disabled = !affordable(frame, machineId, 1);
    ten.disabled = !affordable(frame, machineId, 10);
    crank.dataset.ready = String(!single.disabled);
    rates.textContent = uiText(premium
      ? "機率 R 60%・SR 28%・SSR 10%・UR 2%｜十連必出 SR 以上進化金屬或 Ω 晶片"
      : "培育補給與狩獵道具 66%・R 晶片 27%・基礎進化金屬 7%");
    pityLabel.textContent = `${fmt(frame.pity)} / ${fmt(frame.pityMax)}`;
    pity.setAttribute("aria-label", uiText("核心熔煉值：{n} / {max}", { n: frame.pity, max: frame.pityMax }));
    pity.setAttribute("aria-valuemax", String(frame.pityMax));
    pity.setAttribute("aria-valuenow", String(frame.pity));
    pityFill.style.height = `${Math.round(Math.min(1, frame.pity / frame.pityMax) * 100)}%`;
    pity.dataset.ready = String(frame.pity >= frame.pityMax);
    pityClaim.hidden = frame.pity < frame.pityMax;
    synthSlots = synthSlots.filter((id) => (frame.chips.find((c) => c.id === id)?.owned ?? 0) > 0);
    if (root.dataset.mode === "SYNTH") paintSynth(frame);
    if (root.dataset.mode === "BAG") paintBag(frame);
    if (!revealActions.hidden) paintAgain();
  }

  return Object.freeze({
    root,
    update(frame) { paint(frame); },
    dispose() {
      life.abort();
      revealing = false;
      for (const animation of [...running]) animation.cancel();
      root.remove();
    }
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
