// The settings screen. PRODUCT_AUTHORED (2026-09-29).
//
// One modal <dialog> over whatever is showing, so nothing behind it can be
// tapped by accident and the page, its selection and its scroll are exactly
// as they were when it closes. Opening it does not pause anything: like the
// existing System menu and confirmation dialogs, it leaves raising time alone.
//
// Phones get a list of categories and one category per page (with a way
// back); wider screens get the list as a sidebar beside the page. Every choice
// is a native radio, checkbox or range input inside a fieldset, so keyboard,
// focus order and screen readers work without custom widgets. Escape (and the
// browser or Android back button) steps back from a category page, then
// closes.
//
// Nothing here writes storage or touches the game session: choices go to the
// preference store; save and account facts are read from the save port.

import { uiText, retranslate, setText, setLabel } from "../../text/uiText.js";
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_DEFINITIONS,
  preferenceIdsIn
} from "./preferenceSchema.js";
import { QUALITY_TIERS } from "../../presentation/presentationPreferences.js";

const CATEGORY_TITLES = Object.freeze({
  appearance: "外觀與顯示", quality: "畫面品質", sound: "聲音",
  language: "語言", access: "操作與輔助", data: "資料與帳號"
});

const THEME_CHOICES = Object.freeze([
  { value: "night", name: "深色夜景", desc: "深色背景，適合夜間與長時間遊玩。" },
  { value: "clear", name: "藍白清爽", desc: "明亮的藍白配色，適合白天與戶外。" },
  { value: "warm", name: "經典暖黃", desc: "米黃紙色與琥珀色，柔和的暖色調。" },
  { value: "classic", name: "復古藍金", desc: "深藍底、金色緞帶與框線，搭配六角網格的復古風格。" },
  { value: "system", name: "跟隨系統", desc: "系統深色時用深色夜景，淺色時用藍白清爽。" }
]);
const TEXT_SCALE_CHOICES = Object.freeze([
  { value: 100, name: "標準", desc: "100%" },
  { value: 115, name: "較大", desc: "115%" },
  { value: 130, name: "大", desc: "130%" }
]);
const HUD_CHOICES = Object.freeze([
  { value: "standard", name: "標準", desc: "顯示全部說明與提示。" },
  { value: "compact", name: "精簡", desc: "隱藏操作提示與次要說明，數值與按鈕不變。" }
]);
const QUALITY_CHOICES = Object.freeze([
  { value: "auto", name: "自動", desc: "依裝置條件選擇；持續卡頓時只會往下調一次，不會來回切換。" },
  { value: "saver", name: "省電", desc: "降低解析度與特效，保留所有必要回饋。" },
  { value: "balanced", name: "平衡", desc: "目前的標準畫質。" },
  { value: "high", name: "高品質", desc: "較高解析度與較多高光碎片，耗電較多。" }
]);
const LOCALE_CHOICES = Object.freeze([
  { value: "zh-Hant", name: "繁體中文", desc: "", lang: "zh-Hant" },
  { value: "en", name: "English", desc: "", lang: "en" }
]);
const MOTION_CHOICES = Object.freeze([
  { value: "system", name: "跟隨系統", desc: "依裝置的「減少動態效果」設定。" },
  { value: "on", name: "開啟", context: "state", desc: "減少移動、縮放與閃光，只保留短暫淡入淡出。" },
  { value: "off", name: "關閉", context: "state", desc: "播放完整動畫。" }
]);
const FLASH_CHOICES = Object.freeze([
  { value: "standard", name: "標準", desc: "" },
  { value: "soft", name: "柔和", desc: "閃光亮度降到約三分之一。" }
]);
const HIGHLIGHT_CHOICES = Object.freeze([
  { value: "full", name: "完整", desc: "約 3.7 秒的完整演出。" },
  { value: "compact", name: "精簡", desc: "約 2.4 秒；結果與獎勵完全相同。" }
]);

const SCOPE_LABEL = Object.freeze({ device: "此裝置", account: "帳號偏好" });

const TIER_NAMES = Object.freeze({ saver: "省電", balanced: "平衡", high: "高品質" });

function choiceName(choices, value) {
  return choices.find((choice) => choice.value === value)?.name ?? String(value);
}

/**
 * @param {object} options
 * @param {Document} [options.doc]
 * @param {ReturnType<import('./preferenceStore.js').createPreferenceStore>} options.store
 * @param {{ resolved: () => object, subscribe: Function }} options.environment
 * @param {{ preview: () => boolean, state: () => string } | null} [options.audio]
 * @param {{ describe: () => object, subscribe?: Function } | null} [options.quality]
 * @param {() => object|null} [options.getSaveStatus]
 * @param {(options: object) => Promise<string|null>} options.confirm
 */
export function createSettingsPanel({
  doc = globalThis.document,
  store,
  environment,
  audio = null,
  quality = null,
  getSaveStatus = () => null,
  confirm,
  history = globalThis.history,
  win = globalThis.window
} = {}) {
  if (!store) throw new TypeError("The settings panel needs a preference store");
  let dialog = null;
  let category = "appearance";
  let view = "list";
  let opener = null;
  let historyEntry = false;
  let ignoreNextPop = false;
  let closing = false;
  const cleanups = [];
  const node = (tag, className, key, params) => {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (key !== undefined && key !== null) setText(element, key, params);
    return element;
  };
  const narrow = () => (win?.matchMedia?.("(max-width: 767px)")?.matches ?? true);

  // ---- Summaries shown under each category name -----------------------------
  function summary(id) {
    const values = store.get();
    const resolved = environment?.resolved?.() ?? {};
    if (id === "appearance") return `${uiText(choiceName(THEME_CHOICES, values.theme))} · ${uiText(choiceName(TEXT_SCALE_CHOICES, values.textScale))}`;
    if (id === "quality") {
      const tier = quality?.describe?.().tier ?? "balanced";
      return values.quality === "auto"
        ? uiText("自動（目前：{tier}）", { tier: uiText(TIER_NAMES[tier]) })
        : uiText(choiceName(QUALITY_CHOICES, values.quality));
    }
    if (id === "sound") return values.muted ? uiText("靜音") : uiText("總音量 {volume}%", { volume: values.masterVolume });
    if (id === "language") return choiceName(LOCALE_CHOICES, values.locale);
    if (id === "access") return uiText("減少動態：{state}", { state: uiText(resolved.reducedMotion ? "開啟" : "關閉", { context: "state" }) });
    if (id === "data") return uiText("存檔只在本機");
    return "";
  }

  // ---- Building blocks -------------------------------------------------------
  function scopeTag(id) {
    const scope = PREFERENCE_DEFINITIONS[id]?.scope;
    const tag = node("span", "cm-setting__scope", SCOPE_LABEL[scope]);
    tag.dataset.scope = scope;
    return tag;
  }

  function fieldset(id, labelKey, hintKey) {
    const set = node("fieldset", "cm-setting");
    set.dataset.setting = id;
    const legend = node("legend", "cm-setting__label");
    legend.append(node("span", "cm-setting__name", labelKey), scopeTag(id));
    set.append(legend);
    if (hintKey) set.append(node("p", "cm-setting__hint", hintKey));
    return set;
  }

  function radioGroup(id, labelKey, choices, { hint = null, render = null } = {}) {
    const set = fieldset(id, labelKey, hint);
    const options = node("div", "cm-setting__options");
    options.dataset.count = String(choices.length);
    const current = store.get()[id];
    for (const choice of choices) {
      const label = node("label", "cm-choice");
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = `cm-setting-${id}`;
      input.value = String(choice.value);
      input.checked = choice.value === current;
      input.className = "cm-choice__input";
      input.addEventListener("change", () => {
        if (!input.checked) return;
        store.set(id, choice.value);
      });
      const body = node("span", "cm-choice__body");
      if (render) body.append(render(choice));
      const name = node("span", "cm-choice__name", choice.name, choice.context ? { context: choice.context } : undefined);
      if (choice.lang) name.lang = choice.lang;
      body.append(name);
      if (choice.desc) body.append(node("span", "cm-choice__desc", choice.desc));
      label.append(input, body);
      options.append(label);
    }
    set.append(options);
    return set;
  }

  function themePreview(choice) {
    const swatch = node("span", "cm-theme-preview");
    swatch.setAttribute("aria-hidden", "true");
    if (choice.value === "system") {
      swatch.dataset.split = "true";
      const left = node("span", "cm-theme-preview__half");
      left.dataset.palette = "night";
      const right = node("span", "cm-theme-preview__half");
      right.dataset.palette = "clear";
      for (const half of [left, right]) half.append(node("span", "cm-theme-preview__bar"), node("span", "cm-theme-preview__card"), node("span", "cm-theme-preview__button"));
      swatch.append(left, right);
      return swatch;
    }
    swatch.dataset.palette = choice.value;
    const bar = node("span", "cm-theme-preview__bar");
    bar.append(node("span", "cm-theme-preview__bits"));
    const card = node("span", "cm-theme-preview__card");
    card.append(node("span", "cm-theme-preview__line"), node("span", "cm-theme-preview__line cm-theme-preview__line--short"),
      node("span", "cm-theme-preview__meter"));
    swatch.append(bar, card, node("span", "cm-theme-preview__button"));
    return swatch;
  }

  function slider(id, labelKey, hintKey) {
    const set = fieldset(id, labelKey, hintKey);
    const row = node("div", "cm-setting__range");
    const input = doc.createElement("input");
    input.type = "range";
    const definition = PREFERENCE_DEFINITIONS[id];
    input.min = String(definition.min);
    input.max = String(definition.max);
    input.step = String(definition.step);
    input.value = String(store.get()[id]);
    input.className = "cm-setting__slider";
    input.id = `cm-setting-${id}`;
    setLabel(input, "aria-label", labelKey);
    const output = node("output", "cm-setting__value");
    output.htmlFor = input.id;
    const paint = (value) => {
      output.textContent = `${value}%`;
      input.setAttribute("aria-valuetext", `${value}%`);
      input.style.setProperty("--fill", `${value}%`);
    };
    paint(input.value);
    input.addEventListener("input", () => { paint(input.value); store.set(id, Number(input.value)); });
    // Follows a change made elsewhere (another tab) without replacing this element.
    sliderPainters.set(id, (value) => { if (input.value !== String(value)) { input.value = String(value); paint(input.value); } });
    row.append(input, output);
    set.append(row);
    return set;
  }

  function toggle(id, labelKey, hintKey) {
    const set = fieldset(id, labelKey, hintKey);
    const label = node("label", "cm-switch");
    const input = doc.createElement("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.className = "cm-switch__input";
    input.checked = store.get()[id] === true;
    input.addEventListener("change", () => store.set(id, input.checked));
    const track = node("span", "cm-switch__track");
    track.setAttribute("aria-hidden", "true");
    label.append(input, track, node("span", "cm-switch__text", labelKey));
    set.append(label);
    return set;
  }

  function note(key, params, tone = "info") {
    const paragraph = node("p", "cm-settings__note", key, params);
    paragraph.dataset.tone = tone;
    return paragraph;
  }

  // The one line on the Sound page that follows the sliders. It is updated in
  // place while a slider moves (see refresh): rebuilding the page would
  // replace the slider under the player's finger and end the drag.
  const VOLUME_NOTE = "實際音量 = 總音量 × 遊戲音效（目前 {level}%）；靜音時為 0。";
  const SELF_PAINTING = new Set(["masterVolume", "sfxVolume"]);
  const sliderPainters = new Map();
  let volumeNote = null;
  function volumeLevel() {
    const values = store.get();
    return { level: values.muted ? 0 : Math.round(values.masterVolume * values.sfxVolume / 100) };
  }

  function resetCategoryButton(id) {
    if (!preferenceIdsIn(id).length) return null;
    const button = node("button", "cm-settings__reset", "恢復本分類預設");
    button.type = "button";
    button.addEventListener("click", () => {
      store.resetCategory(id);
      announce(uiText("已恢復「{name}」的預設值。遊戲進度不受影響。", { name: uiText(CATEGORY_TITLES[id]) }));
      renderContent();
      // The page was rebuilt under the keyboard: keep focus on the same button.
      content.querySelector(".cm-settings__reset")?.focus({ preventScroll: true });
    });
    return button;
  }

  // ---- Category pages ------------------------------------------------------
  const pages = {
    appearance(section) {
      section.append(radioGroup("theme", "主題", THEME_CHOICES, {
        hint: "只改變介面顏色，不會改變角色與場景的原圖。", render: themePreview
      }));
      const resolved = environment?.resolved?.() ?? {};
      if (store.get().theme === "system") {
        section.append(note("目前系統為{mode}，使用「{theme}」。", {
          mode: uiText(resolved.prefersDark ? "深色" : "淺色"), theme: uiText(choiceName(THEME_CHOICES, resolved.theme))
        }));
      }
      const text = radioGroup("textScale", "文字大小", TEXT_SCALE_CHOICES);
      text.append(note("這是文字大小的預覽：生命值 128／技力 64。"));
      section.append(text);
      section.append(radioGroup("hudDensity", "資訊密度", HUD_CHOICES));
    },
    quality(section) {
      const described = quality?.describe?.() ?? { tier: "balanced", reason: null };
      section.append(radioGroup("quality", "畫質", QUALITY_CHOICES.map((choice) => choice.value === "auto"
        ? { ...choice, name: uiText("自動（目前：{tier}）", { tier: uiText(TIER_NAMES[described.tier]) }) }
        : choice)));
      if (store.get().quality === "auto" && described.reason) section.append(note(described.reason));
      const tier = QUALITY_TIERS[described.tier];
      const table = node("dl", "cm-settings__params");
      const row = (labelKey, value, whenKey) => {
        const term = node("dt", "", labelKey);
        const detail = node("dd");
        detail.append(node("span", "cm-settings__param-value", value), node("span", "cm-settings__param-when", whenKey));
        table.append(term, detail);
      };
      row("畫面解析度上限", `${tier.pixiResolutionCap}×`, "立即生效");
      row("立體場景解析度上限", `${tier.threePixelRatioCap}×`, "下次進入該畫面時生效");
      row("抗鋸齒", uiText(tier.pixiAntialias ? "開啟" : "關閉", { context: "state" }), "下次開啟遊戲時生效");
      row("高光碎片數", String(tier.highlightParticles), "下一次演出生效");
      row("模糊與光暈", uiText(tier.backdropBlur ? "開啟" : "關閉", { context: "state" }), "立即生效");
      const caption = node("p", "cm-settings__caption", "目前實際使用的參數（{tier}）：", { tier: uiText(TIER_NAMES[described.tier]) });
      section.append(caption, table);
      section.append(note("像素美術在任何畫質下都以最近點取樣放大，不會變糊。"));
      section.append(note("不提供 30／60 FPS 選項：對戰與育成時間跟著畫面更新前進，限制幀率會改變遊戲速度。"));
    },
    sound(section) {
      section.append(toggle("muted", "全部靜音"));
      section.append(slider("masterVolume", "總音量"));
      section.append(slider("sfxVolume", "遊戲音效", "對戰音效與高光演出音效。"));
      volumeNote = note(VOLUME_NOTE, volumeLevel());
      section.append(volumeNote);
      const test = node("button", "cm-settings__action", "試聽");
      test.type = "button";
      test.addEventListener("click", () => {
        const played = audio?.preview?.() ?? false;
        announce(uiText(played ? "正在播放試聽音效。" : store.get().muted ? "目前為靜音。" : "瀏覽器尚未允許播放聲音，請再點一次。"));
      });
      section.append(test);
      section.append(note("本版本沒有背景音樂、介面音效與角色語音，所以不提供這些音量。"));
    },
    language(section) {
      section.append(radioGroup("locale", "顯示語言", LOCALE_CHOICES, { hint: "切換後立即生效，不會重新開始或改變目前進度。" }));
      section.append(note("英文翻譯尚未經母語編輯審校。"));
      section.append(note("數碼獸物種名稱與初始夥伴的自動名稱在英文正式名稱核定前，沿用已核定的繁體中文名稱；你取的名字不會被翻譯。"));
    },
    access(section) {
      const resolved = environment?.resolved?.() ?? {};
      section.append(radioGroup("reducedMotion", "減少動態", MOTION_CHOICES));
      section.append(note("目前：{state}", { state: uiText(resolved.reducedMotion ? "減少動態" : "完整動態") }));
      section.append(radioGroup("flashIntensity", "閃光強度", FLASH_CHOICES));
      section.append(radioGroup("highlightMode", "高光演出", HIGHLIGHT_CHOICES, { hint: "重要勝利的演出長度。" }));
      section.append(note("鍵盤：Tab 移動、方向鍵切換選項、Esc 返回或關閉。"));
    },
    data(section) {
      const save = getSaveStatus?.() ?? null;
      const block = (titleKey) => {
        const group = node("section", "cm-settings__block");
        group.append(node("h4", "cm-settings__block-title", titleKey));
        section.append(group);
        return group;
      };
      const saveBlock = block("存檔");
      saveBlock.append(node("p", "cm-settings__text", "存檔保存在這台裝置的這個瀏覽器（本機）。重要操作後會自動保存；清除網站資料後無法取回。"));
      if (save) saveBlock.append(node("p", "cm-settings__text", save.key, save.params));
      const account = block("帳號");
      account.append(node("p", "cm-settings__text", "尚未提供帳號登入與雲端同步，這台裝置的資料不會上傳。"));
      account.append(node("p", "cm-settings__text", "標示為「帳號偏好」的設定將來可隨帳號同步；目前與「此裝置」設定一樣只保存在本機。"));
      const prefs = block("偏好設定");
      const status = store.status();
      const statusLine = node("p", "cm-settings__text", preferenceStatusKey(status), { time: status.savedAt ? formatTime(status.savedAt) : "" });
      statusLine.dataset.phase = status.phase;
      prefs.append(statusLine);
      if (status.phase === "SAVE_FAILED") {
        const retry = node("button", "cm-settings__action", "再試一次");
        retry.type = "button";
        retry.addEventListener("click", () => { store.retry(); renderContent(); });
        prefs.append(retry);
      }
      const resetAll = node("button", "cm-settings__action cm-settings__action--danger", "恢復全部設定");
      resetAll.type = "button";
      resetAll.addEventListener("click", async () => {
        const choice = await confirm?.({
          title: uiText("要恢復全部設定嗎？"),
          message: uiText("主題、畫質、聲音、語言與輔助設定會回到預設值。只會重設設定，不會影響遊戲進度與存檔。"),
          actions: [{ id: "cancel", label: uiText("取消"), tone: "secondary" }, { id: "reset", label: uiText("恢復預設"), tone: "primary" }],
          cancelId: "cancel"
        });
        if (choice !== "reset") return;
        store.resetAll();
        announce(uiText("全部設定已恢復預設。遊戲進度不受影響。"));
        renderAll();
        content.querySelector(".cm-settings__action--danger")?.focus({ preventScroll: true });
      });
      prefs.append(resetAll);
    }
  };

  function preferenceStatusKey(status) {
    if (status.phase === "SAVE_FAILED") return "設定未能保存到本機（本次遊玩仍然有效）。";
    if (status.phase === "READ_ONLY") return "設定由較新的版本建立；這個版本不會覆寫它，變更只在本次遊玩有效。";
    if (status.phase === "UNAVAILABLE") return "瀏覽器不允許保存網站資料，設定只在本次遊玩有效。";
    if (status.phase === "PENDING") return "正在保存設定…";
    if (status.phase === "SAVED") return "設定已保存到本機（{time}）。";
    return status.source === "ABSENT" ? "目前使用預設設定。" : "設定已從本機讀取。";
  }

  function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  // ---- Frame -----------------------------------------------------------------
  let titleNode, backButton, nav, content, live;

  function announce(message) {
    if (!live) return;
    live.textContent = "";
    // A fresh text node is what makes a polite live region speak again.
    globalThis.setTimeout?.(() => { if (live) live.textContent = message; }, 20);
  }

  function renderNav() {
    nav.replaceChildren();
    for (const id of PREFERENCE_CATEGORIES) {
      const button = node("button", "cm-settings__category");
      button.type = "button";
      button.dataset.category = id;
      if (id === category) button.setAttribute("aria-current", "true");
      button.append(node("span", "cm-settings__category-name", CATEGORY_TITLES[id]), node("span", "cm-settings__category-summary"));
      button.lastChild.textContent = summary(id);
      button.addEventListener("click", () => showCategory(id, { focus: true }));
      nav.append(button);
    }
  }

  function renderContent() {
    const focusedSetting = doc.activeElement?.closest?.("[data-setting]")?.dataset.setting ?? null;
    const focusedValue = doc.activeElement?.value ?? null;
    const scroll = content.scrollTop;
    content.replaceChildren();
    sliderPainters.clear();
    volumeNote = null;
    const heading = node("h3", "cm-settings__section-title", CATEGORY_TITLES[category]);
    heading.id = "cm-settings-section-title";
    heading.tabIndex = -1;
    content.append(heading);
    pages[category](content);
    const reset = resetCategoryButton(category);
    if (reset) {
      const footer = node("div", "cm-settings__section-footer");
      footer.append(reset);
      content.append(footer);
    }
    content.scrollTop = scroll;
    if (focusedSetting) {
      const target = content.querySelector(`[data-setting="${focusedSetting}"] input[value="${CSS.escape(String(focusedValue))}"]`)
        ?? content.querySelector(`[data-setting="${focusedSetting}"] input`);
      target?.focus({ preventScroll: true });
    }
  }

  function renderAll() {
    if (!dialog) return;
    setText(titleNode, view === "detail" && narrow() ? CATEGORY_TITLES[category] : "設定");
    renderNav();
    renderContent();
    retranslate(dialog);
  }

  function showCategory(id, { focus = false } = {}) {
    category = id;
    view = "detail";
    dialog.dataset.view = view;
    renderAll();
    if (focus) content.querySelector("#cm-settings-section-title")?.focus({ preventScroll: false });
  }

  function showList() {
    view = "list";
    dialog.dataset.view = view;
    renderAll();
    nav.querySelector(`[data-category="${category}"]`)?.focus({ preventScroll: true });
  }

  /** Escape and the back button: a category page goes back first on phones. */
  function stepBack() {
    if (view === "detail" && narrow()) { showList(); return true; }
    close();
    return true;
  }

  function onPopState() {
    if (!dialog) return;
    if (ignoreNextPop) { ignoreNextPop = false; return; }
    historyEntry = false;
    if (view === "detail" && narrow()) {
      showList();
      // Stay open: put back the entry the back button consumed.
      try { history?.pushState?.({ cmSettings: true }, ""); historyEntry = true; } catch { /* no history */ }
      return;
    }
    close({ fromHistory: true });
  }

  function build() {
    dialog = doc.createElement("dialog");
    dialog.className = "cm-settings";
    dialog.dataset.view = view;
    dialog.setAttribute("aria-labelledby", "cm-settings-title");
    const panel = node("div", "cm-settings__panel");
    const header = node("header", "cm-settings__header");
    backButton = node("button", "cm-settings__back", "設定");
    backButton.type = "button";
    setLabel(backButton, "aria-label", "返回設定分類");
    backButton.addEventListener("click", showList);
    titleNode = node("h2", "cm-settings__title", "設定");
    titleNode.id = "cm-settings-title";
    const closeButton = node("button", "cm-settings__close");
    closeButton.type = "button";
    setLabel(closeButton, "aria-label", "關閉設定");
    closeButton.addEventListener("click", () => close());
    header.append(backButton, titleNode, closeButton);
    const body = node("div", "cm-settings__body");
    nav = node("nav", "cm-settings__nav");
    setLabel(nav, "aria-label", "設定分類");
    content = node("section", "cm-settings__content");
    content.setAttribute("aria-labelledby", "cm-settings-section-title");
    body.append(nav, content);
    live = node("p", "cm-settings__live");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    panel.append(header, body, live);
    dialog.append(panel);
    // Escape is taken on keydown, so it always steps back one level: a
    // browser may refuse to let a page cancel a second close request in a row
    // (Chrome's close-watcher rule), which would close the whole panel.
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      stepBack();
    });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); stepBack(); });
    // Closed by the browser itself (a close request it would not let the page
    // cancel): tidy up exactly as if the panel had closed itself.
    dialog.addEventListener("close", () => { if (dialog && !closing) close({ native: true }); });
    // A press on the backdrop (outside the panel) closes, like the dialogs.
    dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
    // Arrow keys move between categories in the list.
    nav.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = [...nav.querySelectorAll(".cm-settings__category")];
      const index = buttons.indexOf(doc.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    });
    doc.body.append(dialog);
  }

  function refresh(changed = []) {
    if (!dialog) return;
    // A volume slider paints its own value. Keep that element (and the drag
    // it owns): only the list summary and the volume line follow.
    if (changed.length && changed.every((id) => SELF_PAINTING.has(id))) {
      renderNav();
      const values = store.get();
      for (const id of changed) sliderPainters.get(id)?.(values[id]);
      if (volumeNote?.isConnected) setText(volumeNote, VOLUME_NOTE, volumeLevel());
      return;
    }
    // Radios already show the new value; the summaries, notes and anything
    // derived (resolved theme, effective tier, the volume product, and the
    // language itself, which the environment has already switched) follow.
    renderAll();
  }

  return Object.freeze({
    isOpen: () => Boolean(dialog),
    open({ from = null, category: start = null } = {}) {
      if (dialog) return;
      opener = from ?? doc.activeElement ?? null;
      if (start && PREFERENCE_CATEGORIES.includes(start)) category = start;
      view = narrow() && !start ? "list" : "detail";
      build();
      cleanups.push(store.subscribe((values, changed) => refresh(changed)));
      cleanups.push(store.subscribeStatus(() => { if (category === "data") renderContent(); }));
      // The environment re-applies after every preference change; the store
      // observer above already handles those. Re-render here only when what
      // the environment resolved actually changed (the OS theme or motion).
      let seen = JSON.stringify(environment?.resolved?.() ?? null);
      if (environment?.subscribe) cleanups.push(environment.subscribe((resolved) => {
        const next = JSON.stringify(resolved ?? null);
        if (next === seen) return;
        seen = next;
        renderAll();
      }));
      if (quality?.subscribe) cleanups.push(quality.subscribe(() => renderAll()));
      renderAll();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      try { history?.pushState?.({ cmSettings: true }, ""); historyEntry = true; } catch { historyEntry = false; }
      win?.addEventListener?.("popstate", onPopState);
      const first = view === "list" ? nav.querySelector("[aria-current='true']") ?? nav.querySelector("button")
        : content.querySelector("#cm-settings-section-title");
      first?.focus({ preventScroll: true });
    },
    close,
    /** The current category and view, for QA and tests. */
    inspect: () => Object.freeze({ open: Boolean(dialog), category, view }),
    dispose() { close(); }
  });

  function close({ fromHistory = false } = {}) {
    if (!dialog || closing) return;
    closing = true;
    for (const cleanup of cleanups.splice(0)) { try { cleanup(); } catch { /* already gone */ } }
    win?.removeEventListener?.("popstate", onPopState);
    store.flush?.();
    try { if (dialog.open) dialog.close(); } catch { /* already closed */ }
    dialog.remove();
    dialog = null;
    closing = false;
    if (historyEntry && !fromHistory) {
      historyEntry = false;
      // Remove the entry this panel added, without treating it as a back press.
      ignoreNextPop = false;
      try { history?.back?.(); } catch { /* no history */ }
    }
    historyEntry = false;
    const target = opener;
    opener = null;
    if (target?.isConnected) target.focus?.({ preventScroll: true });
  }
}
