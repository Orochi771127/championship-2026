// Data Area story hall (OWNER_APPROVED_ADAPTATION 2026-10-29): the full-screen
// entry of the "Unheard Echoes" story mode. The grid theater fills the screen
// with the player's partner idling on the floating platform (and a line from
// its day while you were away); a bottom sheet holds the chapter navigation,
// the three faction files and the investigation notes. A chapter plays on the
// same stage; its first clear claims tickets and an evolution metal through
// the Cyber Gachapon once-only ledger, which is also where progress is read.
//
// It reads progress through `getClaimed` and writes only through `claimReward`
// (the app). DOM owns this UI; the stage is DOM + Canvas 2D (no WebGL).

import {
  DATA_AREA_CHAPTER_IDS, DATA_AREA_FACTIONS, dataAreaChapter, dataAreaChapterPlayable, dataAreaChapterStates, dataAreaEchoLog, dataAreaRewardKey
} from "../data/dataAreaStoryCampaign.js";
import { dataAreaMetalKey, dataAreaText } from "../text/dataAreaStoryText.js";
import { createDataAreaCyberStage, crestMarkup } from "../presentation/story/DataAreaCyberStage.js";
import { createDataAreaStoryOverlay } from "../presentation/story/dataAreaStoryOverlay.js";
import { createDataAreaStoryDirector } from "../presentation/story/dataAreaStoryDirector.js";
import { createStoryField3D } from "../presentation/story/storyField3D.js";
import { playCyberMorphEvolution } from "../presentation/juicy/cyberMorphEvolutionRunner.js";
import { juicyPortrait } from "../presentation/juicy/juicyArt.js";
import { GACHA_METALS } from "../gacha/cyberGacha.js";
import { gachaTicketImage } from "./cyberGachaIcons.js";
import { speciesName } from "../text/zhHant.js";

export const DATA_AREA_HUB_SCENE = Object.freeze([
  { id: "warp", kind: "warp", at: [0.12, -0.55] }, { id: "term", kind: "terminal", at: [0.66, -0.22] },
  { id: "f1", kind: "flower", at: [-0.66, 0.42] }, { id: "f2", kind: "flower", at: [-0.5, 0.62] }, { id: "lamp", kind: "lotus-lamp", at: [-0.66, -0.38] }
]);

const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const LENS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M14.5 14.5 20 20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
export const DATA_AREA_GLOBE_ICON = GLOBE;

const el = (doc, tag, className, text = null) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
};

/** The partner's offline moment shown on the stage: one of four, the same all day. */
export function dataAreaDailyKey(date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return `DAILY_${(((day % 4) + 4) % 4) + 1}`;
}

export function createDataAreaStoryScreen({
  doc = globalThis.document, host = doc.body, locale = "zh-Hant", reducedMotion = false, quality = "balanced",
  partner = { name: "", species: null, awakeSpecies: null }, tamer = "",
  getClaimed = () => [], claimReward = () => null, onLink = () => {}, onClose = () => {},
  evolve = null, now = () => new Date(), ticker = null, fieldBase = "assets/production/story/fields-v1/", onFieldActive = () => {},
  runBattle = null
} = {}) {
  const t = (key, params = {}) => dataAreaText(key, locale, { tamer, partner: partner.name, ...params }) ?? key;
  const root = el(doc, "section", "cm-da-hub");
  root.hidden = true; root.dataset.storyMode = "data-area"; root.dataset.mode = "hub";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "cm-da-hub-title");
  if (reducedMotion) root.dataset.motion = "reduced";
  const stageHost = el(doc, "div", "cm-da-hub__stage");
  stageHost.setAttribute("aria-label", t("STAGE_LABEL"));

  const head = el(doc, "header", "cm-da-hub__head");
  const kicker = el(doc, "p", "cm-da-hub__kicker"); kicker.innerHTML = GLOBE; kicker.append(el(doc, "span", "", t("HUB_KICKER")));
  const title = el(doc, "h2", "cm-da-hub__title"); title.id = "cm-da-hub-title";
  title.append(el(doc, "span", "cm-da-hub__part", t("HUB_PART")), el(doc, "span", "cm-da-hub__name", t("HUB_TITLE")));
  const progress = el(doc, "p", "cm-da-hub__progress");
  const close = el(doc, "button", "cm-da-hub__close", t("HUB_CLOSE")); close.type = "button"; close.dataset.daAction = "close"; close.dataset.sfx = "back";
  const headCopy = el(doc, "div", "cm-da-hub__head-copy"); headCopy.append(kicker, title, progress);
  head.append(headCopy, close);

  const daily = el(doc, "aside", "cm-da-daily");
  daily.append(el(doc, "span", "cm-da-daily__label", t("DAILY_LABEL")), el(doc, "p", "cm-da-daily__line", t(dataAreaDailyKey(now()))));

  const sheet = el(doc, "section", "cm-da-hub__sheet");
  const tabs = el(doc, "div", "cm-da-tabs"); tabs.setAttribute("role", "tablist");
  const tabIds = ["chapters", "factions", "log"];
  const tabButtons = tabIds.map(id => {
    const button = el(doc, "button", "cm-da-tab"); button.type = "button"; button.dataset.daTab = id; button.setAttribute("role", "tab");
    if (id === "log") button.innerHTML = LENS;
    button.append(el(doc, "span", "", t(id === "chapters" ? "TAB_CHAPTERS" : id === "factions" ? "TAB_FACTIONS" : "TAB_LOG")));
    return button;
  });
  tabs.append(...tabButtons);
  const panel = el(doc, "div", "cm-da-hub__panel"); panel.setAttribute("role", "tabpanel");
  sheet.append(tabs, panel);
  // Moonlight-style locations: a 3-D field (Blender GLB) replaces the grid theater while it plays.
  const fieldHost = el(doc, "div", "cm-da-hub__field"); fieldHost.hidden = true;
  root.append(stageHost, fieldHost, head, daily, sheet);
  host.append(root);

  let stage = null, overlay = null, director = null, tab = "chapters", selected = null, busy = false, disposed = false, previousFocus = null, field = null;
  /** The director's stage switch: "field" mounts a location, "grid" returns to the theater. */
  async function switchStage(kind, location) {
    if (kind === "field") {
      const pixiTicker = typeof ticker === "function" ? ticker() : ticker;
      if (!pixiTicker || !location) return null;
      try {
        field?.dispose(); fieldHost.hidden = false; root.dataset.stage = "field";
        field = await createStoryField3D({ host: fieldHost, doc, fieldUrl: `${fieldBase}${location}/`, ticker: pixiTicker, reducedMotion, quality });
        onFieldActive(true);
        return field;
      } catch (error) {
        console.warn(`DATA_AREA_FIELD: ${error?.message ?? error}`);
        field?.dispose(); field = null; fieldHost.hidden = true; delete root.dataset.stage; onFieldActive(false);
        return null;
      }
    }
    field?.dispose(); field = null; fieldHost.hidden = true; delete root.dataset.stage; onFieldActive(false);
    return stage;
  }
  const life = new AbortController();

  function claimed() { try { return getClaimed() ?? []; } catch { return []; } }

  async function buildHub() {
    if (!stage) return;
    await stage.setScene("hub", DATA_AREA_HUB_SCENE, { instant: true });
    if (Number.isInteger(partner.species)) {
      await stage.enter("partner", { species: partner.species, at: [-0.2, 0.2], face: "right", tag: null });
      if (!reducedMotion) stage.bubble("partner", "note");
    }
  }

  function metalChip(metalId, count) {
    const metal = GACHA_METALS.find(entry => entry.id === metalId);
    const chip = el(doc, "span", "cm-da-reward__chip");
    chip.dataset.rarity = metal?.rarity ?? "R";
    if (metal?.art) { const img = doc.createElement("img"); img.src = metal.art; img.alt = ""; img.decoding = "async"; img.className = "cm-da-reward__metal"; chip.append(img); }
    chip.append(el(doc, "span", "", `${t(dataAreaMetalKey(metalId))} ×${count}`));
    return chip;
  }
  function rewardRow(chapter, isClaimed) {
    const row = el(doc, "div", "cm-da-reward");
    row.dataset.claimed = String(isClaimed);
    row.append(el(doc, "span", "cm-da-reward__label", isClaimed ? `${t("REWARD_LABEL")} · ${t("REWARD_CLAIMED")}` : t("REWARD_LABEL")));
    const tickets = el(doc, "span", "cm-da-reward__chip cm-da-reward__chip--ticket");
    tickets.append(gachaTicketImage("cm-da-reward__ticket", doc), el(doc, "span", "", t("REWARD_TICKETS", { n: chapter.reward.tickets })));
    row.append(tickets, ...Object.entries(chapter.reward.metals ?? {}).map(([id, count]) => metalChip(id, count)));
    return row;
  }

  function renderChapters() {
    const keys = claimed(), states = dataAreaChapterStates(keys);
    selected ??= states.current;
    const list = el(doc, "ol", "cm-da-chapters");
    for (const entry of states.chapters) {
      const chapter = dataAreaChapter(entry.id);
      const item = el(doc, "li", "cm-da-chapters__item");
      const button = el(doc, "button", "cm-da-chapter"); button.type = "button";
      button.dataset.chapterId = entry.id; button.dataset.state = entry.state; button.setAttribute("aria-pressed", String(entry.id === selected));
      if (entry.id === states.current && entry.state === "open") button.dataset.current = "true";
      button.append(el(doc, "span", "cm-da-chapter__num", String(chapter.number).padStart(2, "0")),
        el(doc, "span", "cm-da-chapter__title", t(chapter.titleKey)),
        el(doc, "span", "cm-da-chapter__state", t(entry.state === "cleared" ? "STATE_CLEARED" : entry.state === "open" ? "STATE_OPEN" : "STATE_LOCKED")));
      button.addEventListener("click", () => { selected = entry.id; render(); }, { signal: life.signal });
      item.append(button); list.append(item);
    }
    const chapter = dataAreaChapter(selected), state = states.chapters.find(entry => entry.id === selected)?.state ?? "locked";
    const detail = el(doc, "article", "cm-da-detail");
    detail.dataset.state = state;
    const crests = el(doc, "span", "cm-da-detail__crests");
    crests.innerHTML = chapter.factions.map(id => `<span class="cm-da-badge" data-faction="${id}">${crestMarkup(DATA_AREA_FACTIONS[id].crest)}</span>`).join("");
    detail.append(el(doc, "p", "cm-da-detail__num", t("CH_NUM", { n: chapter.number })), crests, el(doc, "h3", "cm-da-detail__title", t(chapter.titleKey)),
      el(doc, "p", "cm-da-detail__summary", state === "locked" ? t("LOCKED_HINT") : t(chapter.summaryKey)), rewardRow(chapter, keys.includes(dataAreaRewardKey(selected))));
    const actions = el(doc, "div", "cm-da-detail__actions");
    const play = el(doc, "button", "cm-da-play", t(state === "cleared" ? "REPLAY" : "PLAY")); play.type = "button"; play.dataset.daAction = "play";
    play.disabled = state === "locked";
    play.addEventListener("click", () => { if (!play.disabled) void playChapter(selected); }, { signal: life.signal });
    actions.append(play);
    if (state !== "locked" && chapter.link) {
      const link = el(doc, "button", "cm-da-link", t(`LINK_${chapter.link}`)); link.type = "button"; link.dataset.daAction = "link"; link.dataset.link = chapter.link;
      link.addEventListener("click", () => { finishHub(); onLink(chapter.link); }, { signal: life.signal });
      actions.append(link);
    }
    detail.append(actions);
    return [list, detail];
  }
  function renderFactions() {
    const wrap = el(doc, "div", "cm-da-factions");
    wrap.append(el(doc, "p", "cm-da-hint", t("FACTION_HINT")));
    for (const [id, faction] of Object.entries(DATA_AREA_FACTIONS)) {
      const card = el(doc, "article", "cm-da-faction"); card.dataset.faction = id;
      const badge = el(doc, "span", "cm-da-badge cm-da-badge--large"); badge.dataset.faction = id; badge.innerHTML = crestMarkup(faction.crest);
      const body = el(doc, "div", "cm-da-faction__body");
      body.append(el(doc, "h3", "cm-da-faction__name", t(faction.nameKey)));
      const stance = el(doc, "p", "cm-da-faction__line"); stance.append(el(doc, "b", "", t("FACTION_STANCE_LABEL")), doc.createTextNode(t(faction.stanceKey)));
      const blind = el(doc, "p", "cm-da-faction__line cm-da-faction__line--blind"); blind.append(el(doc, "b", "", t("FACTION_BLIND_LABEL")), doc.createTextNode(t(faction.blindKey)));
      body.append(stance, blind);
      card.append(badge, body); wrap.append(card);
    }
    return [wrap];
  }
  function renderLog() {
    const keys = claimed();
    const wrap = el(doc, "div", "cm-da-log");
    wrap.append(el(doc, "p", "cm-da-hint", t("LOG_HINT")));
    for (const entry of dataAreaEchoLog(keys)) {
      const card = el(doc, "article", "cm-da-log__entry"); card.dataset.unlocked = String(entry.unlocked); card.dataset.icon = entry.icon;
      card.append(el(doc, "h3", "cm-da-log__q", t(entry.titleKey)), el(doc, "p", "cm-da-log__a", entry.unlocked ? t(entry.bodyKey) : t("LOG_LOCKED")));
      wrap.append(card);
    }
    const echoes = el(doc, "ol", "cm-da-log__echoes");
    for (const id of DATA_AREA_CHAPTER_IDS) {
      if (!keys.includes(dataAreaRewardKey(id))) continue;
      const chapter = dataAreaChapter(id);
      echoes.append(el(doc, "li", "", `${t("CH_NUM", { n: chapter.number })} · ${t(chapter.echoKey)}`));
    }
    if (echoes.childElementCount) wrap.append(echoes);
    return [wrap];
  }
  function render() {
    if (disposed) return;
    const states = dataAreaChapterStates(claimed());
    progress.textContent = t("PROGRESS", { done: states.cleared, total: states.total });
    for (const button of tabButtons) button.setAttribute("aria-selected", String(button.dataset.daTab === tab));
    panel.dataset.tab = tab;
    panel.replaceChildren(...(tab === "chapters" ? renderChapters() : tab === "factions" ? renderFactions() : renderLog()));
  }
  for (const button of tabButtons) button.addEventListener("click", () => { tab = button.dataset.daTab; render(); }, { signal: life.signal });
  close.addEventListener("click", () => finishHub(), { signal: life.signal });
  doc.addEventListener("keydown", event => { if (event.key === "Escape" && !root.hidden && root.dataset.mode === "hub") { event.preventDefault(); finishHub(); } }, { signal: life.signal });

  function defaultEvolve({ fromSpecies, toSpecies, fromName, signal }) {
    return new Promise(resolve => {
      let run = null;
      try {
        run = playCyberMorphEvolution({ host: doc.body ?? host, doc, mode: "preview", fullscreen: true, onDone: resolve,
          from: { name: fromName || speciesName(fromSpecies), portrait: juicyPortrait(fromSpecies), speciesIndex: fromSpecies },
          to: { name: speciesName(toSpecies), stageLabel: "", portrait: juicyPortrait(toSpecies), speciesIndex: toSpecies } });
      } catch { resolve(); return; }
      run.element.dataset.storyAwaken = "true";
      signal?.addEventListener?.("abort", () => { run.dispose(); resolve(); }, { once: true });
    });
  }

  function showClearCard(chapter, grant) {
    const card = el(doc, "section", "cm-da-clear");
    card.append(el(doc, "p", "cm-da-clear__kicker", t("CHAPTER_CLEAR")), el(doc, "h3", "cm-da-clear__title", t(chapter.titleKey)),
      el(doc, "p", "cm-da-clear__echo", t(chapter.echoKey)));
    if (grant?.granted || Object.keys(grant?.metals ?? {}).length) {
      const row = el(doc, "div", "cm-da-reward cm-da-reward--clear");
      const tickets = el(doc, "span", "cm-da-reward__chip cm-da-reward__chip--ticket");
      tickets.append(gachaTicketImage("cm-da-reward__ticket", doc), el(doc, "span", "", t("REWARD_TOAST", { n: grant.granted ?? 0 })));
      row.append(tickets, ...Object.entries(grant.metals ?? {}).map(([id, count]) => metalChip(id, count)));
      card.append(row);
    }
    const back = el(doc, "button", "cm-da-play", t("BACK_TO_HUB")); back.type = "button"; back.dataset.daAction = "back";
    card.append(back);
    root.append(card);
    try { doc.dispatchEvent(new CustomEvent("cm-fx", { detail: { kind: "levelup" } })); } catch { /* decoration */ }
    return new Promise(resolve => {
      const done = () => { card.remove(); resolve(); };
      back.addEventListener("click", done, { once: true });
      back.focus?.({ preventScroll: true });
    });
  }

  /** Play one chapter on the stage; returns the director result (plus the reward grant). */
  async function playChapter(chapterId, { autoPlay = false, from = null, holdClearCard = false } = {}) {
    if (busy || disposed) return Object.freeze({ outcome: "refused", reason: "BUSY", chapterId });
    const keys = claimed();
    if (!dataAreaChapterPlayable(chapterId, keys)) return Object.freeze({ outcome: "refused", reason: "LOCKED", chapterId });
    if (!Number.isInteger(partner.species)) return Object.freeze({ outcome: "refused", reason: "NO_PARTNER", chapterId });
    busy = true; root.dataset.mode = "playing"; root.dataset.chapterId = chapterId;
    const rewardKey = dataAreaRewardKey(chapterId), firstClear = !keys.includes(rewardKey);
    try {
      const battle = typeof runBattle === "function" ? async request => {
        // The story steps aside while the game's own battle screens run, then comes back as it was.
        root.hidden = true; onFieldActive(false);
        try { return await runBattle(request); }
        finally { if (!disposed) { root.hidden = false; if (field) onFieldActive(true); } }
      } : null;
      const result = await director.play(chapterId, { tamer, partner: partner.name, partnerSpecies: partner.species, partnerAwakeSpecies: partner.awakeSpecies ?? partner.species,
        autoPlay, from, canSkip: !firstClear, battle });
      let grant = null;
      if (result.outcome === "completed" && firstClear) {
        const chapter = dataAreaChapter(chapterId);
        try { grant = claimReward(rewardKey, chapter.reward.tickets, chapter.reward.metals) ?? null; } catch { grant = null; }
      }
      if (result.outcome === "completed" && !disposed) {
        const card = showClearCard(dataAreaChapter(chapterId), grant);
        if (!holdClearCard) await card;
      }
      return Object.freeze({ ...result, grant });
    } finally {
      busy = false;
      if (!disposed) {
        delete root.dataset.chapterId;
        if (!holdClearCard) { root.dataset.mode = "hub"; await buildHub(); selected = null; render(); }
      }
    }
  }

  function finishHub() {
    if (root.hidden || busy) return;
    root.hidden = true;
    director?.dispose(); director = null;
    field?.dispose(); field = null; onFieldActive(false);
    overlay?.dispose(); overlay = null;
    stage?.dispose(); stage = null;
    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* the opener is gone */ }
    onClose();
  }

  return Object.freeze({
    element: root,
    get isOpen() { return !root.hidden; },
    get isBusy() { return busy; },
    /** The mounted 3-D field, if any (loopback QA reads anchor positions from it). */
    get field() { return field; },
    async open({ chapterId = null, tab: firstTab = "chapters" } = {}) {
      if (disposed) return false;
      if (!root.hidden) { if (chapterId) { selected = chapterId; render(); } return true; }
      previousFocus = doc.activeElement;
      root.hidden = false; root.dataset.mode = "hub";
      tab = firstTab; selected = chapterId && DATA_AREA_CHAPTER_IDS.includes(chapterId) ? chapterId : null;
      stage = createDataAreaCyberStage({ host: stageHost, doc, reducedMotion, quality });
      overlay = createDataAreaStoryOverlay({ host: root, doc, reducedMotion, text: key => t(key) });
      director = createDataAreaStoryDirector({ stage, overlay, locale, reducedMotion, doc, evolve: evolve ?? defaultEvolve, switchStage });
      render();
      close.focus?.({ preventScroll: true });
      await buildHub();
      return true;
    },
    play: playChapter,
    /** End a running chapter (it resolves as skipped; nothing is claimed). */
    stop() { director?.skip(); },
    selectTab(next) { if (tabIds.includes(next)) { tab = next; render(); } },
    refresh: render,
    close: finishHub,
    state: () => Object.freeze({ open: !root.hidden, mode: root.dataset.mode, tab, selected, busy, progress: dataAreaChapterStates(claimed()) }),
    dispose() {
      if (disposed) return; disposed = true;
      life.abort();
      director?.dispose(); field?.dispose(); overlay?.dispose(); stage?.dispose();
      root.remove();
    }
  });
}
