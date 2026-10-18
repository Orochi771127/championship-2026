import { createRanchRowPurchasePrompt } from './ranchRowPurchasePrompt.js';
import { PRODUCT_RANCH_GRID } from '../cage/productRanchGrid.js';
import {databaseHeroPortrait} from '../presentation/databaseHeroPortraits.js';
import {databaseStory, databaseStoryHeading, databaseVerifiedData, databaseVerifiedHeading} from '../database/databaseStories.js';
import {originalDatabaseIcon} from "../presentation/completedOriginalUi20261007.js";
import { speciesName, generationName, shopItemDescription as shopDescriptionText, shopItemName } from "../text/zhHant.js";
import {databaseDisplayRows, getDatabaseDisplayEntry} from '../database/databaseDisplayCatalog.js';
import {openingEggChoices} from './openingEggChoices.js';
import {openingEggText} from '../text/openingEggText.js';
import {loadAcceptedDatabasePortrait} from '../presentation/acceptedDatabasePortraits.js';
// VS4 -- Shop presentation.
//
// Consumes only the injected Gate/Hunt presentation source. The Shop runtime
// owns Bits, visibility and quantities; this view lists what is already
// visible and sends buy/leave through intents.

import { PRODUCT_GIVEN_NAME_MAX_LENGTH } from "./championshipRaisingProduction.js";
import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from "./vs2Screens.js";
import { cageUiImage, cageUiLidImage, shopCageUiImage, cageEditorArtCells, cageUiName, shopCageUiName, cageUiSummary } from '../presentation/cageUiArt.js';
import { setLabel, setText, uiText } from '../text/uiText.js';
import { TAMER_RANK_SLOT_TABLE } from '../cage/cageCatalog.js';
import { ranchBoardCell } from '../cage/ranchSlotGeometry.js';
import { NATIVE_RANCH_LAYOUT, RANCH_EXPANSION_DECK_SLOTS } from '../cage/ranchExpansion.js';
import { openRanchExpansionPreview } from './ranchExpansionPreview.js';
import { shopGoodsPresentation } from '../presentation/shopGoodsUiArt.js';
import { getHuntCatalogItem } from '../hunt/loadout/huntEquipmentCatalog.js';
import { showChoiceDialog } from './uiDialog.js';
import { prefersReducedMotion } from '../presentation/presentationPreferences.js';
import { isDesktopBrowseLayout } from './portraitFrame.js';

const CATEGORY_LABELS = Object.freeze({
  TRAINING_GOODS: "養成用品",
  HUNT_ITEMS: "狩獵工具",
  PLUGINS: "外掛",
  CAGES: "籠子設施"
});

const RECEIPT_COPY = Object.freeze({
  PURCHASED: "購買完成。",
  INSUFFICIENT_FUNDS: "持有金額不足。",
  MAX_OWNED: "已達持有上限。",
  UNAVAILABLE: "此商品目前不販售。",
  INVALID_QUANTITY: "無法購買這個數量。"
});

const SHOP_PLACEHOLDERS = Object.freeze({
  TRAINING_GOODS: "用品",
  HUNT_ITEMS: "工具",
  PLUGINS: "外掛",
  CAGES: "設施"
});

export function shopItemDescription(row) {
  const recordIndex = row?.shopRecordIndex;
  const text = Number.isSafeInteger(recordIndex) ? shopDescriptionText(recordIndex) : null;
  return text ?? uiText("商品說明無法顯示。");
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

function presentationMode() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("presentation") === "developer"
      ? VS2_PRESENTATION_MODES.DEVELOPER
      : VS2_PRESENTATION_MODES.PLAYER;
  } catch {
    return VS2_PRESENTATION_MODES.PLAYER;
  }
}

/** A short confirmation pulse on the element that changed; none under reduced motion. */
function pulse(node) {
  if (prefersReducedMotion()) return;
  node.animate?.([{ transform: "scale(1)", filter: "brightness(1)" },
    { transform: "scale(1.06)", filter: "brightness(1.18)" }, { transform: "scale(1)", filter: "brightness(1)" }],
  { duration: 320, easing: "ease-out" });
}

function bindBrowseBack(root, back) {
  const onKey = event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    back.click();
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

export function createShopView({ root, source }) {
  const frame = source.getFrame();
  const block = frame.shop;
  if (!block) throw new Error("CHAMPIONSHIP_SHOP_NOT_ACTIVE");
  const mode = presentationMode();

  root.replaceChildren();
  root.className = "cm-vs2-root";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.presentationMode = mode;
  root.dataset.screen = frame.screen;
  root.dataset.shopLayout = "ORIGINAL_VIDEO_R1";

  const shell = element("section", "cm-vs2-shell cm-vs2-shop");
  shell.setAttribute("aria-label", uiText("Shop"));
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "HOME"),
    element("h1", "cm-vs2-title", "商店"),
    element("p", "cm-vs2-subtitle", "養成用品・狩獵裝備・牧場設施")
  );
  const wallet = element("div", "cm-vs2-shop__wallet");
  wallet.setAttribute("aria-live", "polite");
  header.append(copy, wallet);

  const body = element("div", "cm-vs2-body cm-vs2-shop__body");
  const detail = element("article", "cm-vs2-shop__detail");
  detail.setAttribute("aria-live", "polite");
  const detailArt = element("div", "cm-vs2-shop__detail-art");
  const detailCopy = element("div", "cm-vs2-shop__detail-copy");
  const detailName = element("h2", "cm-vs2-shop__detail-name");
  const detailDescription = element("p", "cm-vs2-shop__detail-description");
  const detailMeta = element("p", "cm-vs2-shop__detail-meta");
  // Why Buy is unavailable, said beside the price rather than left to a grey
  // button (2026-09-28 QA: 0 Bits greyed Buy with no reason).
  const detailState = element("p", "cm-vs2-shop__detail-state");
  detailState.hidden = true;
  detailCopy.append(detailName, detailDescription, detailMeta, detailState);
  detail.append(detailArt, detailCopy);
  const tabs = element("div", "cm-vs2-shop__tabs");
  tabs.setAttribute("role", "tablist");
  setLabel(tabs, "aria-label", "商品分類");
  const shelf = element("div", "cm-vs2-shop__shelf");
  const previous = element("button", "cm-vs2-shop__arrow cm-vs2-shop__arrow--previous", "‹");
  previous.type = "button";
  setLabel(previous, "aria-label", "上一項商品");
  const list = element("div", "cm-vs2-shop__list");
  list.setAttribute("role", "listbox");
  setLabel(list, "aria-label", "商品選擇");
  const next = element("button", "cm-vs2-shop__arrow cm-vs2-shop__arrow--next", "›");
  next.type = "button";
  setLabel(next, "aria-label", "下一項商品");
  shelf.append(previous, list, next);
  const status = element("p", "cm-vs2-shop__status");
  status.setAttribute("aria-live", "polite");
  body.append(detail, tabs, shelf, status);

  // Footer rule: leave on the left, the one primary action -- Buy -- on the
  // right. Leaving used to wear the gold while Buy looked secondary.
  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action", "返回牧場");
  back.type = "button";
  const buy = element("button", "cm-vs2-action cm-vs2-action--primary cm-vs2-shop__buy", "購買");
  buy.type = "button";
  footer.append(back, buy);
  shell.append(header, body, footer);
  root.append(shell);

  const categories = Object.keys(CATEGORY_LABELS);
  let activeCategory = categories[0];
  let selectedRow = null;
  let revealSelectedCard = true;
  const selectedByCategory = new Map();
  const tabButtons = new Map();

  for (const category of categories) {
    const tab = element("button", "cm-vs2-shop__tab", CATEGORY_LABELS[category]);
    tab.type = "button";
    tab.dataset.category = category;
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => {
      activeCategory = category;
      revealSelectedCard = true;
      paint(source.getFrame());
    });
    tabs.append(tab);
    tabButtons.set(category, tab);
  }

  back.addEventListener("click", () => source.intents.leaveScreen());
  const stopBackKeys = bindBrowseBack(root, back);
  // One tap buys one. Two taps landing within a double-tap window are one
  // intent, so the second is dropped instead of charging twice.
  let lastBuy = { at: -Infinity, record: null };
  buy.addEventListener("click", () => {
    if (!selectedRow) return;
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (lastBuy.record === selectedRow.shopRecordIndex && now - lastBuy.at < 220) return;
    lastBuy = { at: now, record: selectedRow.shopRecordIndex };
    source.intents.buyShopItem(selectedRow.shopRecordIndex, 1);
  });

  function productName(row) {
    return uiText(shopItemName(row.shopRecordIndex)
      ?? shopGoodsPresentation(row.shopRecordIndex)?.name
      ?? getHuntCatalogItem(row.productItemId)?.displayName
      ?? shopCageUiName(row.shopRecordIndex, uiText(row.displayName)));
  }

  function appendProductArt(host, row, { detailView = false } = {}) {
    const goods = shopGoodsPresentation(row.shopRecordIndex);
    const imageSrc = shopCageUiImage(row.shopRecordIndex);
    host.replaceChildren();
    host.dataset.hasArt = String(Boolean(imageSrc || goods?.src));
    if (imageSrc) {
      const image = element("img", detailView ? "cm-facility-thumb cm-vs2-shop__art-large" : "cm-facility-thumb");
      image.src = imageSrc;
      image.alt = productName(row);
      image.loading = "lazy";
      host.append(image);
      return;
    }
    if (goods?.src) {
      const icon = element("span", detailView ? "cm-shop-goods-icon cm-vs2-shop__art-large" : "cm-shop-goods-icon");
      icon.setAttribute("aria-hidden", "true");
      icon.dataset.icon = goods.icon;
      icon.style.backgroundImage = `url("${goods.src}")`;
      icon.style.backgroundPosition = goods.backgroundPosition;
      if (goods.width && goods.height) icon.style.backgroundSize = 'contain';
      host.append(icon);
      return;
    }
    host.append(element("span", "cm-vs2-shop__art-fallback", SHOP_PLACEHOLDERS[row.category] ?? "商品"));
  }

  function moveSelection(offset) {
    const rows = source.getFrame()?.shop?.listings.filter((row) => row.category === activeCategory) ?? [];
    if (!rows.length) return;
    const current = Math.max(0, rows.findIndex((row) => row.shopRecordIndex === selectedRow?.shopRecordIndex));
    const index = Math.max(0, Math.min(rows.length - 1, current + offset));
    selectedByCategory.set(activeCategory, rows[index].shopRecordIndex);
    revealSelectedCard = true;
    paint(source.getFrame());
  }

  previous.addEventListener("click", () => moveSelection(-1));
  next.addEventListener("click", () => moveSelection(1));
  list.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    moveSelection(event.key === "ArrowLeft" ? -1 : 1);
  });

  let paintedBits = null;
  let paintedReceipt = null;
  function paint(nextFrame) {
    const shop = nextFrame?.shop;
    if (!shop) return;
    wallet.textContent = uiText("持有 {bits} 位元幣", { bits: shop.bits });
    // A spend is visible where the money is shown, not only in the numbers.
    if (paintedBits !== null && shop.bits !== paintedBits) {
      wallet.dataset.change = shop.bits < paintedBits ? "spent" : "gained";
      pulse(wallet);
    }
    paintedBits = shop.bits;
    const receipt = shop.lastReceipt;
    // Name the item and its new count, so a second purchase of the same item
    // reads differently from the first instead of repeating the same line.
    const boughtRow = receipt?.ok ? shop.listings.find((row) => row.shopRecordIndex === receipt.shopRecordIndex) : null;
    status.textContent = receipt
      ? (boughtRow ? uiText("已購買「{item}」，持有 {owned}/{max}。", { item: productName(boughtRow), owned: boughtRow.owned, max: boughtRow.maxOwned })
        : uiText(RECEIPT_COPY[receipt.reason] ?? ""))
      : "";
    status.dataset.tone = receipt ? (receipt.ok ? "ok" : "refused") : "";
    if (receipt && receipt !== paintedReceipt) pulse(status);
    paintedReceipt = receipt ?? null;

    for (const [category, tab] of tabButtons) {
      tab.dataset.active = category === activeCategory ? "true" : "false";
      tab.setAttribute("aria-selected", category === activeCategory ? "true" : "false");
    }

    const rows = shop.listings.filter((row) => row.category === activeCategory);
    const restoreCardFocus = list.contains(document.activeElement);
    list.replaceChildren();
    if (rows.length === 0) {
      list.append(element("p", "cm-vs2-shop__empty", "這個分類目前沒有販售商品。"));
      selectedRow = null;
      detailArt.replaceChildren();
      detailName.textContent = "";
      detailDescription.textContent = "";
      detailMeta.textContent = "";
      buy.disabled = true;
      previous.disabled = true;
      next.disabled = true;
      return;
    }
    const requested = selectedByCategory.get(activeCategory);
    selectedRow = rows.find((row) => row.shopRecordIndex === requested) ?? rows[0];
    selectedByCategory.set(activeCategory, selectedRow.shopRecordIndex);
    const selectedIndex = rows.findIndex((row) => row.shopRecordIndex === selectedRow.shopRecordIndex);
    const selectedName = productName(selectedRow);
    appendProductArt(detailArt, selectedRow, { detailView: true });
    detailName.textContent = uiText(selectedName);
    detailDescription.textContent = shopItemDescription(selectedRow);
    detailMeta.textContent = uiText("{bits} 位元幣 · 持有 {owned}/{max}", { bits: selectedRow.unitPriceBits, owned: selectedRow.owned, max: selectedRow.maxOwned });
    const full = selectedRow.owned >= selectedRow.maxOwned;
    const shortBits = full ? 0 : Math.max(0, selectedRow.unitPriceBits - shop.bits);
    buy.textContent = uiText(full ? (selectedRow.maxOwned === 1 ? "已持有" : "已達上限") : "購買");
    buy.disabled = full || shortBits > 0;
    buy.setAttribute("aria-label", full ? uiText("{item}已達持有上限", { item: selectedName }) : uiText("購買{item}", { item: selectedName }));
    detailState.hidden = !buy.disabled;
    detailState.textContent = full
      ? (selectedRow.maxOwned === 1 ? uiText("已經持有，無法再購買。") : uiText("已達持有上限 {max}。", { max: selectedRow.maxOwned }))
      : shortBits > 0 ? uiText("持有金額不足，還差 {bits} 位元幣。", { bits: shortBits }) : "";
    previous.disabled = selectedIndex <= 0;
    next.disabled = selectedIndex >= rows.length - 1;
    let selectedCard = null;
    for (const row of rows) {
      const displayName = productName(row);
      const item = element("button", "cm-vs2-shop__row");
      item.type = "button";
      item.setAttribute("role", "option");
      const selected = row.shopRecordIndex === selectedRow.shopRecordIndex;
      if (selected) selectedCard = item;
      item.dataset.selected = String(selected);
      item.setAttribute("aria-selected", String(selected));
      const art = element("span", "cm-vs2-shop__card-art");
      appendProductArt(art, row);
      const name = element("div", "cm-vs2-shop__name");
      name.append(element("strong", "", displayName));
      if (row.visibility === "NEW") name.append(element("span", "cm-vs2-shop__new", "NEW"));
      const meta = element(
        "span",
        "cm-vs2-shop__meta",
        uiText("{bits} 位元幣 · 持有 {owned}/{max}", { bits: row.unitPriceBits, owned: row.owned, max: row.maxOwned })
      );
      name.append(meta);
      item.addEventListener("click", () => {
        selectedByCategory.set(activeCategory, row.shopRecordIndex);
        paint(source.getFrame());
      });
      item.append(art, name);
      list.append(item);
    }
    if (revealSelectedCard) {
      selectedCard?.scrollIntoView({ block: "nearest", inline: "center" });
      revealSelectedCard = false;
    }
    if (restoreCardFocus) selectedCard?.focus({ preventScroll: true });
  }

  paint(frame);

  return Object.freeze({
    render: paint,
    dispose() {
      stopBackKeys();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
      delete root.dataset.shopLayout;
    },
    inspect() {
      return Object.freeze({
        layout: root.dataset.shopLayout,
        activeCategory,
        selectedShopRecordIndex: selectedRow?.shopRecordIndex ?? null,
        listingCount: source.getFrame()?.shop?.listings.length ?? 0
      });
    }
  });
}

export function createDatabaseView({ root, source, isWideLayout = () => isDesktopBrowseLayout({width:globalThis.innerWidth,height:globalThis.innerHeight,activeScreen:'DATABASE'}) }) {
  const frame = source.getFrame();
  const block = frame.database;
  if (!block) throw new Error("CHAMPIONSHIP_DATABASE_NOT_ACTIVE");
  const mode = presentationMode();

  root.replaceChildren();
  root.className = "cm-vs2-root";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.presentationMode = mode;
  root.dataset.screen = frame.screen;

  const shell = element("section", "cm-vs2-shell cm-vs2-database");
  shell.setAttribute("aria-label", uiText("Database"));
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "HOME"),
    element("h1", "cm-vs2-title", "DATABASE"),
    element("p", "cm-vs2-subtitle", "拍檔圖鑑")
  );
  const census = element("div", "cm-vs2-shop__wallet");
  census.setAttribute("aria-live", "polite");
  const bookArt=originalDatabaseIcon("DATABASE");
  if(bookArt){const icon=element("img","cm-collection-icon");icon.src=bookArt.src;icon.alt="";copy.prepend(icon);}
  header.append(copy, census);

  const body = element("div", "cm-vs2-body cm-vs2-shop__body");
  const catalogPane = element('div', 'cm-vs2-database__catalog');
  const filterLabel = element('label', 'cm-vs2-database__filter');
  filterLabel.append(element('span', '', 'DEX_STAGE'));
  const stageFilter = element('select', 'cm-vs2-database__stage');
  stageFilter.setAttribute('aria-label', uiText('DEX_STAGE'));
  for (const value of ['', '0', '1', '2', '3', '4', '5', '6']) {
    const option = element('option', '', value === '' ? uiText('DEX_ALL') : generationName(Number(value)));
    option.value = value;
    stageFilter.append(option);
  }
  filterLabel.append(stageFilter);
  const list = element("div", "cm-vs2-shop__list");
  list.setAttribute("role", "list");
  const detail = element("div", "cm-vs2-database__detail");
  detail.hidden = true;
  catalogPane.append(filterLabel, list);
  body.append(catalogPane, detail);

  // Leaving is not this screen's primary action, so it does not wear gold.
  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action", "BACK");
  back.type = "button";
  back.setAttribute("aria-label", uiText("Return to Raising Home"));
  footer.append(back);
  shell.append(header, body, footer);
  root.append(shell);

  let listScroll = null;
  let lastOpened = null;
  let paintedRows = null;
  let paintedDetail = null;
  let activeStage = null;
  let selectedEgg = null;
  let alive = true;
  let detailGeneration = 0;
  let portraitAbort = null;
  let portraitImages = [];
  // View-local only: never added to the Database frame or save.
  let conditionSource = null;
  let expandedConditionBranch = null;
  const conditionControls = new Map();
  function clearConditionState() {
    conditionSource = null;
    expandedConditionBranch = null;
    for (const {toggle, panel} of conditionControls.values()) {
      toggle.setAttribute('aria-expanded', 'false'); panel.hidden = true; panel.replaceChildren();
    }
    conditionControls.clear();
  }
  function releasePortraits() {
    detailGeneration++;
    portraitAbort?.abort();
    portraitAbort = null;
    for (const image of portraitImages) {
      image.onload = null; image.onerror = null; image.removeAttribute('src');
    }
    portraitImages = [];
  }
  const eggs = new Map(openingEggChoices().map(egg=>[egg.speciesIndex,egg]));
  back.addEventListener("click", () => {
    const current = source.getFrame().database;
    if (selectedEgg) { selectedEgg = null; paint(source.getFrame()); }
    else if (current?.selected) source.intents.selectDatabaseSpecies(null);
    else source.intents.leaveScreen();
  });
  stageFilter.addEventListener('change', () => {
    activeStage = stageFilter.value === '' ? null : Number(stageFilter.value);
    listScroll = null;
    lastOpened = null;
    list.scrollTop = 0;
    const selected = selectedEgg ?? source.getFrame().database?.selected;
    if (selected && activeStage !== null && getDatabaseDisplayEntry(selected.speciesIndex)?.numberingStageIndex !== activeStage) {
      selectedEgg = null;
      source.intents.selectDatabaseSpecies(null);
    }
    paint(source.getFrame());
  });
  const stopBackKeys = bindBrowseBack(root, back);

  function paint(nextFrame) {
    if (!alive) return;
    const book = nextFrame?.database;
    if (!book) { clearConditionState(); paintedDetail = null; return; }
    const selected = selectedEgg ?? (book.selected ? {...book.selected, ...getDatabaseDisplayEntry(book.selected.speciesIndex)} : null);
    census.textContent = uiText("已登錄 {count} / {total}", { count: book.registeredCount, total: book.slotCount });
    body.dataset.mode = selected ? "detail" : "list";
    const wide = isWideLayout();
    const focusWasInList = list.contains(document.activeElement);
    list.hidden = Boolean(selected) && !wide;
    catalogPane.hidden = list.hidden;
    detail.hidden = !selected;
    if (selected) {
      back.textContent = uiText("Return to database list");
      back.setAttribute("aria-label", uiText("Return to database list"));
      const detailKey = JSON.stringify([document.documentElement.lang, selected]);
      if (detailKey !== paintedDetail) {
        paintDetail(selected, book);
        detail.scrollTop = 0;
        paintedDetail = detailKey;
      }
      if (list.hidden && focusWasInList) detail.querySelector('h2')?.focus({preventScroll:true});
    } else {
      if (paintedDetail !== null) releasePortraits();
      clearConditionState();
      detail.replaceChildren();
      paintedDetail = null;
      back.textContent = uiText("RETURN TO RANCH");
      back.setAttribute("aria-label", uiText("Return to Raising Home"));
    }
    const rows = databaseDisplayRows(book, activeStage);
    // Keep the live list when selecting/resizing. Keyboard focus and each
    // pane's scroll position must survive while the other pane changes.
    const rowsKey = JSON.stringify([document.documentElement.lang, activeStage, rows]);
    if (rowsKey !== paintedRows) {
      list.replaceChildren();
      paintedRows = rowsKey;
      for (const row of rows) {
        const item = element("button", "cm-vs2-shop__row cm-vs2-database__row");
        item.dataset.speciesIndex = String(row.speciesIndex);
        item.type = "button";
        item.dataset.state = row.state;
        item.dataset.displayCode = row.displayCode;
        const visibleName = row.kind === 'EGG' ? eggs.get(row.speciesIndex).formalName : (row.viewable || row.state === 'REGISTERED') ? speciesName(row.speciesIndex, row.displayName) : uiText('Undiscovered');
        item.setAttribute("aria-label", `${row.displayCode} · ${generationName(row.numberingStageIndex)} · ${visibleName}`);
        const name = element("div", "cm-vs2-shop__name");
        name.append(element("strong", "", (!row.viewable && row.state === 'UNDISCOVERED') ? '????' : visibleName));
        name.append(element("span", "cm-vs2-shop__meta", row.displayCode));
        const thumbnail = (row.viewable || row.state === 'REGISTERED') && databaseHeroPortrait(row.speciesIndex)?.thumbnail;
        if(thumbnail){
          const image=element('img','cm-dex-list-thumb');
          image.setAttribute('loading','lazy');image.decoding='async';image.alt='';image.width=32;image.height=32;
          image.src=thumbnail.src;item.classList.add('cm-vs2-database__row--thumb');item.append(image);
        }
        item.append(name);
        item.addEventListener("click", () => {
          listScroll = list.scrollTop ?? 0;
          lastOpened = row.speciesIndex;
          selectedEgg = row.kind === 'EGG' ? row : null;
          source.intents.selectDatabaseSpecies(row.kind === 'EGG' ? null : row.speciesIndex);
        });
        list.append(item);
      }
    }
    for (const item of list.children) {
      const isSelected = Number(item.dataset.speciesIndex) === selected?.speciesIndex;
      item.dataset.selected = String(isSelected);
      item.setAttribute('aria-pressed', String(isSelected));
    }
    if (!selected && listScroll !== null) {
      list.scrollTop = listScroll;
      const reopened = list.querySelector(`[data-species-index="${lastOpened}"]`);
      reopened?.scrollIntoView({block:'nearest',inline:'nearest'});
      reopened?.focus({ preventScroll: true });
      listScroll = null;
    }
  }

  function paintDetail(selected, book) {
    const sameSource = conditionSource === selected.speciesIndex;
    const focusedBranch = sameSource && detail.contains(document.activeElement)
      && document.activeElement?.classList.contains('cm-dex-conditions__toggle')
      ? Number(document.activeElement.dataset.conditionBranch) : null;
    if (!sameSource) expandedConditionBranch = null;
    conditionSource = selected.speciesIndex;
    for (const {toggle, panel} of conditionControls.values()) {
      toggle.setAttribute('aria-expanded', 'false'); panel.hidden = true; panel.replaceChildren();
    }
    conditionControls.clear();
    releasePortraits();
    portraitAbort = new AbortController();
    detail.replaceChildren();
    const egg = selected.kind === 'EGG' ? eggs.get(selected.speciesIndex) : null;
    const title = element("h2", "cm-vs2-database__detail-title", egg ? egg.formalName : (selected.viewable || selected.state === "REGISTERED") ? speciesName(selected.speciesIndex, selected.displayName) : "Undiscovered");
    title.tabIndex = -1;
    const meta = element(
      "p",
      "cm-vs2-shop__meta",
      selected.state === "REGISTERED"
        ? "已登錄"
        : "尚未登錄這隻拍檔。"
    );
    detail.append(title, element('p','cm-vs2-shop__meta', `${selected.displayCode} · ${generationName(selected.numberingStageIndex)}`));
    if (egg) {
      const image = element('img','cm-vs2-database__egg');
      image.src = egg.src;
      image.alt = '';
      detail.append(image, element('p','cm-vs2-shop__status','DEX_EGG_INDEX'));
      if (openingEggText().nameNote) detail.append(element('p','cm-vs2-shop__meta',openingEggText().nameNote));
      return;
    }
    detail.append(meta);
    if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
      detail.append(element("p", "cm-vs2-evidence", `${selected.speciesId} · ${book.unlockEvidence}`));
    }
    if (!selected.viewable && selected.state !== "REGISTERED") return;
    const hero = databaseHeroPortrait(selected.speciesIndex);
    if (hero) {
      const holder = element('div','cm-dex-hero');
      holder.dataset.art = 'loading';
      const placeholder = element('span','cm-dex-hero__placeholder','DEX_IMAGE_MISSING');
      placeholder.hidden = true;
      const image = element('img','cm-dex-hero__image');
      image.hidden = true;
      image.alt = ''; image.decoding = 'async';
      image.width = hero.width; image.height = hero.height;
      const generation = detailGeneration;
      const current = () => alive && generation === detailGeneration;
      image.onload = () => {
        if (!current()) return;
        const ready = image.naturalWidth === hero.width && image.naturalHeight === hero.height;
        holder.dataset.art = ready ? 'ready' : 'missing';
        image.hidden = !ready; placeholder.hidden = ready;
      };
      image.onerror = () => { if (current()) {holder.dataset.art = 'missing'; image.hidden = true; placeholder.hidden = false;} };
      portraitImages.push(image);
      holder.append(image,placeholder); detail.append(holder);
      image.src = hero.src;
    }
    const story = databaseStory(selected.speciesIndex);
    if (story) {
      const profile = element('section','cm-dex-profile');
      const heading = databaseStoryHeading();
      profile.setAttribute('aria-label',heading);
      const title = element('h3','cm-dex-profile__heading');
      title.textContent = heading;
      const prose = element('p','cm-dex-profile__text');
      // Authored locale prose, not a UI translation key or HTML.
      prose.textContent = story;
      profile.append(title,prose);
      detail.append(profile);
    }
    const verifiedData = databaseVerifiedData(selected.speciesIndex);
    if (verifiedData) {
      const dataSection = element('section', 'cm-dex-data');
      const dataHeading = databaseVerifiedHeading();
      dataSection.setAttribute('aria-label', dataHeading);
      const dataTitle = element('h3', 'cm-dex-profile__heading');
      dataTitle.textContent = dataHeading;
      dataSection.append(dataTitle);

      const traitsGrid = element('div', 'cm-dex-traits-grid');
      traitsGrid.append(
        element('span', 'cm-dex-trait-tag', `${verifiedData.labels.attribute}: ${verifiedData.attributeName}`),
        element('span', 'cm-dex-trait-tag', `${verifiedData.labels.family}: ${verifiedData.familyName}`)
      );
      dataSection.append(traitsGrid);

      if (verifiedData.moves && verifiedData.moves.length > 0) {
        const movesList = element('div', 'cm-dex-moves-list');
        for (const m of verifiedData.moves) {
          const moveCard = element('div', 'cm-dex-move-card');
          const header = element('div', 'cm-dex-move-card__header');
          const nameSpan = element('span', 'cm-dex-move-card__name', m.name);
          const typeSpan = element('span', 'cm-dex-move-card__type', m.kindName);
          header.append(nameSpan, typeSpan);
          const metaSpan = element('span', 'cm-dex-move-card__meta', `${verifiedData.labels.power} ${m.power} · ${verifiedData.labels.cost} ${m.actionCost} TP`);
          moveCard.append(header, metaSpan);
          movesList.append(moveCard);
        }
        dataSection.append(movesList);
      }
      detail.append(dataSection);
    }
    paintEvolutionRoutes(selected);
    if (!conditionControls.has(expandedConditionBranch)) expandedConditionBranch = null;
    if (focusedBranch !== null) conditionControls.get(focusedBranch)?.toggle.focus({preventScroll:true});
    if (selected.source === "STARTER" && selected.instances.length === 0) {
      detail.append(element("p", "cm-vs2-shop__status", "Registered by the opening partner. No Hunt instance yet."));
    }
    for (const instance of selected.instances) {
      const card = element("div", "cm-vs2-database__instance");
      const nameField = element("label", "cm-vs2-result__name");
      nameField.append(element("span", "cm-vs2-result__name-label", "GIVEN NAME"));
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "cm-vs2-result__name-input";
      nameInput.maxLength = PRODUCT_GIVEN_NAME_MAX_LENGTH;
      nameInput.value = instance.displayName ?? "";
      nameInput.setAttribute("aria-label", uiText("Given name"));
      nameInput.autocomplete = "off";
      nameInput.spellcheck = false;
      nameInput.addEventListener("change", () => {
        const nextName = nameInput.value.trim();
        if (nextName) source.intents.renameDatabaseInstance(instance.instanceId, nextName);
      });
      nameField.append(nameInput);
      const origin = instance.originGateName || instance.originGateId || "Unknown gate";
      card.append(
        nameField,
        element("p", "cm-vs2-shop__meta", origin)
      );
      detail.append(card);
    }
  }

  function portrait(speciesIndex, revealed) {
    const holder = element('div','cm-dex-portrait');
    holder.dataset.revealed = String(revealed);
    holder.dataset.art = 'loading';
    const placeholder = element('span','cm-dex-portrait__placeholder',revealed ? 'DEX_IMAGE_MISSING' : '????');
    const image = element('img','cm-dex-portrait__image');
    image.alt = ''; image.hidden = true;
    holder.append(placeholder,image);
    if (!revealed) { holder.dataset.art = 'hidden'; return holder; }
    portraitImages.push(image);
    const generation = detailGeneration, signal = portraitAbort.signal;
    const current = () => alive && generation === detailGeneration && !signal.aborted;
    const missing = () => { if (!current()) return; holder.dataset.art = 'missing'; image.hidden = true; placeholder.hidden = false; };
    void loadAcceptedDatabasePortrait(speciesIndex,{signal,revealed}).then(art=>{
      if (!current()) return;
      if (!art) { missing(); return; }
      image.onload = () => { if (!current()) return; holder.dataset.art = 'ready'; image.hidden = false; placeholder.hidden = true; };
      image.onerror = missing;
      image.src = art.src;
    }).catch(missing);
    return holder;
  }

  function paintEvolutionRoutes(selected) {
    const section = element('section','cm-dex-routes');
    section.setAttribute('aria-label',uiText('DEX_EVOLUTION'));
    section.append(element('h3','cm-dex-routes__heading','DEX_EVOLUTION'));
    const graph = element('div','cm-dex-routes__graph');
    const origin = element('div','cm-dex-routes__source');
    origin.append(portrait(selected.speciesIndex,true),element('strong','',selected.displayCode));
    graph.append(origin);
    const routes = selected.evolutionRoutes ?? [];
    if (!routes.length) graph.append(element('p','cm-vs2-shop__meta','DEX_NO_ROUTES'));
    else {
      const targets = element('ul','cm-dex-routes__targets');
      for (const route of routes) {
        const mapping = getDatabaseDisplayEntry(route.targetSpeciesIndex);
        const name = route.revealed ? speciesName(route.targetSpeciesIndex) : '????';
        const status = route.historyState === 'RECORDED' ? 'DEX_ROUTE_RECORDED' : route.historyState === 'UNKNOWN' ? 'DEX_ROUTE_UNKNOWN' : 'DEX_ROUTE_UNRECORDED';
        const row = element('li','cm-dex-routes__branch');
        const button = element('button','cm-dex-routes__target');
        button.type = 'button'; button.disabled = !route.revealed;
        button.dataset.branchOffset = String(route.legacyBranchOffset);
        button.dataset.history = route.historyState;
        button.dataset.revealed = String(route.revealed);
        button.setAttribute('aria-label',`${mapping.displayCode} · ${name} · ${uiText(status)}`);
        const copy = element('span','cm-dex-routes__copy');
        copy.append(element('span','cm-vs2-shop__meta',mapping.displayCode),element('strong','cm-dex-routes__name',name),element('span','cm-dex-routes__status',status));
        button.append(portrait(route.targetSpeciesIndex,route.revealed),copy);
        button.addEventListener('click',()=>{
          listScroll = list.scrollTop;
          lastOpened = route.targetSpeciesIndex;
          if (activeStage !== null && activeStage !== mapping.numberingStageIndex) { activeStage = mapping.numberingStageIndex; stageFilter.value = String(activeStage); }
          source.intents.selectDatabaseSpecies(route.targetSpeciesIndex);
          paint(source.getFrame());
          detail.querySelector('h2')?.focus({preventScroll:true});
        });
        row.append(button);
        appendEvolutionConditions(row, route);
        targets.append(row);
      }
      graph.append(targets);
    }
    section.append(graph); detail.append(section);
  }

  function paintConditionPanel(control, expanded) {
    const {toggle, panel, model} = control;
    toggle.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
    panel.replaceChildren();
    if (!expanded) return;
    panel.append(element('p', 'cm-dex-conditions__notice', 'DEX_CONDITIONS_RULES_ONLY'));
    if (model.lifetimeOnly) panel.append(element('p', 'cm-dex-conditions__notice', 'DEX_CONDITIONS_LIFETIME'));
    if (model.conditions.length) {
      const values = element('dl', 'cm-dex-conditions__list');
      for (const condition of model.conditions) {
        const line = element('div', 'cm-dex-conditions__row');
        const unitKey = {PERCENT:'DEX_CONDITIONS_PERCENT', BATTLES:'DEX_CONDITIONS_BATTLES', TIMES:'DEX_CONDITIONS_TIMES'}[condition.unit];
        const value = unitKey ? uiText(unitKey, {value:condition.value, count:condition.value})
          : uiText('{value}', {value:condition.value});
        line.append(element('dt', '', `DEX_CONDITION_${condition.id}`),
          element('dd', '', uiText(condition.operator === 'LTE' ? 'DEX_CONDITIONS_LTE' : 'DEX_CONDITIONS_GTE', {value})));
        values.append(line);
      }
      panel.append(values);
    } else panel.append(element('p', 'cm-dex-conditions__notice', 'DEX_CONDITIONS_NO_NUMERIC'));
    panel.append(element('p', 'cm-dex-conditions__notice', 'DEX_CONDITIONS_LIMITS'));
  }

  function appendEvolutionConditions(row, route) {
    // Unknown routes have no button, panel, hidden thresholds or ARIA payload.
    if (!route.revealed || (!route.displayPreview && (route.historyState !== 'RECORDED' || !route.targetRegistered)) || !route.conditions) return;
    const toggle = element('button', 'cm-dex-conditions__toggle', 'DEX_CONDITIONS');
    toggle.type = 'button';
    toggle.dataset.conditionBranch = String(route.branchIndex);
    const id = `cm-dex-conditions-${detailGeneration}-${route.branchIndex}`;
    toggle.id = `${id}-toggle`;
    toggle.setAttribute('aria-label', uiText('DEX_CONDITIONS_TOGGLE', {branch:route.branchIndex + 1}));
    toggle.setAttribute('aria-controls', id);
    const panel = element('section', 'cm-dex-conditions__panel');
    panel.id = id;
    panel.setAttribute('aria-labelledby', toggle.id);
    const control = {toggle, panel, model:route.conditions};
    conditionControls.set(route.branchIndex, control);
    paintConditionPanel(control, expandedConditionBranch === route.branchIndex);
    const generation = detailGeneration;
    toggle.addEventListener('click', () => {
      if (!alive || generation !== detailGeneration) return;
      expandedConditionBranch = expandedConditionBranch === route.branchIndex ? null : route.branchIndex;
      for (const [branch, entry] of conditionControls) paintConditionPanel(entry, branch === expandedConditionBranch);
    });
    row.append(toggle, panel);
  }

  paint(frame);
  const resize = () => paint(source.getFrame());
  globalThis.addEventListener?.('resize', resize);

  return Object.freeze({
    render: paint,
    relabel() { paint(source.getFrame()); },
    dispose() {
      alive = false;
      clearConditionState();
      releasePortraits();
      stopBackKeys();
      globalThis.removeEventListener?.('resize', resize);
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
    }
  });
}

const CAGE_VERDICT_COPY = Object.freeze({
  PLACED: "Placed.",
  TEST_ROW_PURCHASED: "CAGE_TEST_ROW_PURCHASED",
  TEST_ROW_PURCHASE_UNAVAILABLE: "CAGE_TEST_ROW_UNAVAILABLE",
  TEST_ROW_ALREADY_OPEN: "CAGE_TEST_ROW_ALREADY_OPEN",
  INSUFFICIENT_TEST_DIAMONDS: "CAGE_TEST_DIAMONDS_INSUFFICIENT",
  TEST_ROW_PURCHASE_SAVE_FAILED: "CAGE_TEST_ROW_SAVE_FAILED",
  SAVE_FAILED: "CAGE_TEST_ROW_SAVE_FAILED",
  ALREADY_OPEN: "CAGE_TEST_ROW_ALREADY_OPEN",
  INVALID_TEST_ROW: "CAGE_TEST_ROW_UNAVAILABLE",
  REMOVED: "Removed from the ranch.",
  // Home has had no SAVE button since 2026-09-16; the layout is written with
  // the rest of the game when the page is left or on Save & Quit.
  CONFIRMED: "配置已套用。",
  SLOT_LOCKED: "That hex is still locked.",
  OCCUPIED: "That hex already has a cage.",
  FOOTPRINT_BLOCKED: "The full cage footprint must fit in free, unlocked cells.",
  FIXED_WAITING_ROOM: "Waiting Room stays at the ranch entrance.",
  ALREADY_PLACED: "That cage is already on the ranch.",
  UNOWNED: "You do not own that cage.",
  NOTHING_SELECTED: "Select a cage first.",
  OUT_OF_BOUNDS: "That hex is outside the ranch.",
  // Ranch expansion prototype (2026-10-05): no price, no purchase.
  EXPANSION_GRANTED: "已加入擴充區（原型，不收費）。",
  EXPANSION_ALREADY_GRANTED: "擴充區已經開放。",
  EXPANSION_REVOKED: "已移除擴充區，牧場回到原本的格數。",
  EXPANSION_NOT_EMPTY: "請先把擴充區的設施取回，再移除擴充區。",
  EXPANSION_REQUIRES_NATIVE_RANCH: "這個存檔的牧場仍是舊版配置，暫時不能加入擴充區。",
  EXPANSION_NOT_GRANTED: "擴充區尚未開放。"
});

// Shown only on the QA/developer presentation or with ?ranchExpansion=prototype.
function ranchExpansionPrototypeVisible(mode) {
  try {
    return mode === VS2_PRESENTATION_MODES.DEVELOPER
      || new URLSearchParams(globalThis.location?.search ?? "").get("ranchExpansion") === "prototype";
  } catch {
    return false;
  }
}

// The expansion's rows as a ranch without it sees them (2026-10-12): bays
// under the original blue Lid, placed exactly where the annex cells would be,
// with the same few padlocks the ranch shows. Not cells: nothing to select.
// Owner 2026-10-12: they run under all ten board columns, as on the ranch; the
// first ten (five columns) are the expansion and carry the padlocks.
const EXPANSION_PREVIEW_LOCKED_BAYS = Object.freeze([2, 6, 5]);
const EXPANSION_PREVIEW_BAYS = RANCH_EXPANSION_DECK_SLOTS * 2;
function expansionPreviewBays(doc = globalThis.document) {
  const lid = cageUiLidImage();
  return Array.from({ length: EXPANSION_PREVIEW_BAYS }, (_, slot) => {
    const cell = ranchBoardCell(slot);
    const bay = doc.createElement('span');
    bay.className = 'cm-cage-annex-bay';
    bay.setAttribute('aria-hidden', 'true');
    bay.dataset.slotIndex = String(slot);
    bay.style.left = `${cell.x * 2}px`; bay.style.top = `${(cell.y - 8) * 2}px`;
    if (lid) bay.style.backgroundImage = `url('${lid}')`;
    if (EXPANSION_PREVIEW_LOCKED_BAYS.includes(slot)) bay.dataset.lock = 'true';
    return bay;
  });
}

export function createCageEditView({ root, source, askToLeave = showChoiceDialog, askToBuy = showChoiceDialog, openExpansionPreview = openRanchExpansionPreview }) {
  const frame = source.getFrame();
  const block = frame.cageEdit;
  if (!block) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
  const mode = presentationMode();

  root.replaceChildren();
  root.className = "cm-vs2-root";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.presentationMode = mode;
  root.dataset.screen = frame.screen;

  const shell = element("section", "cm-vs2-shell cm-vs2-cage-edit");
  shell.setAttribute("aria-label", uiText("Cage editor"));
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "HOME"),
    element("h1", "cm-vs2-title", "設施配置"),
    element("p", "cm-vs2-subtitle", block.layoutVersion
      ? "待機區固定。點選設施取回，再選擇空格放置。"
      : "One cage per hex. Rank opens 14–20. Overfill is allowed; extra partners stress more easily.")
  );
  const census = element("div", "cm-vs2-cage-rank");
  census.setAttribute("aria-live", "polite");
  header.append(copy, census);

  const body = element("div", "cm-vs2-body cm-vs2-cage-edit__body");
  const board = element("div", "cm-vs2-cage-board");
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", uiText("Ranch hex slots"));
  const tray = element("div", "cm-vs2-cage-tray");
  tray.setAttribute("role", "list");
  tray.setAttribute("aria-label", uiText("Owned cages"));
  const status = element("p", "cm-vs2-shop__status");
  status.setAttribute("aria-live", "polite");
  const boardScroll = element('div', 'cm-cage-board-scroll');
  // The expansion prototype's annex: its own five-column board under the main
  // one, with the same cells and rules (ranchExpansion.js).
  const annexLabel = element('p', 'cm-cage-annex-label', '擴充區 · 原型（未定價、不收費）');
  // Its own class: the main board stays the one .cm-vs2-cage-board on screen.
  const annexBoard = element('div', 'cm-cage-annex-board');
  annexBoard.setAttribute('role', 'grid');
  annexBoard.setAttribute('aria-label', uiText('擴充區格位'));
  annexLabel.hidden = true; annexBoard.hidden = true;
  // The annex's two rows continue the main board's honeycomb directly below
  // it; the label sits under them.
  boardScroll.append(board, annexBoard, annexLabel);
  const expansionControls = element('div', 'cm-cage-expansion');
  const facilities = element('div', 'cm-cage-facilities');
  facilities.setAttribute('aria-label', uiText('已放置設施'));
  const boardHint = element('p', 'cm-cage-board-hint', '牧場平面配置 · 左右滑動查看所有格位');
  // These wrappers are display:contents in the existing portrait layout.
  // Landscape gives each group its own scroll area without remounting cells,
  // changing native coordinates, or touching the editor's draft transaction.
  const boardPanel = element('div', 'cm-cage-board-panel');
  const inventoryPanel = element('div', 'cm-cage-inventory-panel');
  boardPanel.append(boardHint, boardScroll, expansionControls);
  inventoryPanel.append(facilities, tray);
  body.append(boardPanel, inventoryPanel, status);

  // Footer rule shared by every screen: leave on the left, the one primary
  // action on the right.
  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action", "返回牧場");
  back.type = "button";
  const confirm = element("button", "cm-vs2-action cm-vs2-action--primary", "確認配置");
  confirm.type = "button";
  confirm.setAttribute("aria-label", uiText("Keep this ranch layout"));
  footer.append(back, confirm);
  shell.append(header, body, footer);
  root.append(shell);

  // Leaving reverts an unconfirmed layout (the runtime's revert). That used to
  // happen without a word; an unconfirmed change now asks first.
  let asking = false;
  back.addEventListener("click", async () => {
    if (asking) return;
    if (!source.getFrame()?.cageEdit?.dirty) { source.intents.leaveScreen(); return; }
    asking = true;
    let choice = null;
    try {
      choice = await askToLeave({
        title: uiText("配置還沒有套用"),
        message: uiText("這次調整的設施位置尚未確認。要套用後返回牧場，還是放棄這些變更？"),
        actions: [
          { id: "stay", label: uiText("繼續編輯"), tone: "secondary" },
          { id: "discard", label: uiText("放棄變更"), tone: "danger" },
          { id: "apply", label: uiText("套用並返回"), tone: "primary" }
        ],
        cancelId: "stay"
      });
    } finally { asking = false; }
    if (source.getFrame()?.screen !== "CAGE_EDIT") return;
    if (choice === "apply") source.intents.confirmCageEdit();
    if (choice === "apply" || choice === "discard") source.intents.leaveScreen();
  });
  confirm.addEventListener("click", () => source.intents.confirmCageEdit());

  const rowPurchase = createRanchRowPurchasePrompt({ source, ask: askToBuy, restoreFocus(row) {
    // A purchase or a frame update can replace the opener while the modal is
    // active. Restore a live target without stealing focus from another control.
    const doc = root.ownerDocument;
    if (!root.isConnected || !doc || (doc.activeElement && doc.activeElement !== doc.body && doc.activeElement.isConnected)) return;
    const target = board.querySelector(`[data-locked-test-row="${row}"]`)
      ?? board.querySelector('button[data-locked-test-row]') ?? back;
    target.focus({ preventScroll: true });
  } });

  function paint(nextFrame) {
    const cage = nextFrame?.cageEdit;
    if (!cage) return;
    census.replaceChildren();
    const down = element("button", "cm-vs2-cage-rank__step", "−");
    down.type = "button";
    down.setAttribute("aria-label", uiText("Lower stand-in rank until title matches write it"));
    down.disabled = cage.tamerRank <= 0;
    down.addEventListener("click", () => source.intents.setTamerRank(cage.tamerRank - 1));
    const rankLabel = element(
      "span",
      "cm-vs2-cage-rank__label",
      uiText("階級 {rank} · {used} / {total} 格", { rank: cage.tamerRank, used: cage.occupiedCount ?? cage.placements.length,
        total: cage.unlockedCount + (cage.expansion?.annexSlotCount ?? 0) })
    );
    const up = element("button", "cm-vs2-cage-rank__step", "+");
    up.type = "button";
    up.setAttribute("aria-label", uiText("Raise stand-in rank until title matches write it"));
    up.disabled = cage.tamerRank >= cage.tamerRankTableLastIndex;
    up.addEventListener("click", () => source.intents.setTamerRank(cage.tamerRank + 1));
    if (mode === VS2_PRESENTATION_MODES.DEVELOPER) census.append(down, rankLabel, up);
    else census.append(rankLabel);
    const reason = cage.lastVerdict?.reason;
    status.textContent = uiText(reason ? CAGE_VERDICT_COPY[reason] ?? "" : "");
    confirm.disabled = !cage.dirty;

    board.replaceChildren();
    annexBoard.replaceChildren();
    const productGrid = cage.layoutVersion === PRODUCT_RANCH_GRID;
    board.dataset.productGrid = productGrid ? 'true' : 'false';
    const annex = Boolean(cage.expansion);
    // A native ranch without the expansion shows its rows locked, with a way
    // to see what the expansion is; a granted one shows the real cells.
    const preview = !annex && cage.layoutVersion === NATIVE_RANCH_LAYOUT;
    annexLabel.hidden = !annex && !preview; annexBoard.hidden = !annex && !preview;
    // The QA grant may expose the full ten-column annex; legacy grants keep five.
    annexBoard.style.width = (preview || (cage.expansion?.annexSlotCount ?? 0) > 10) ? '508px' : '270px';
    annexBoard.dataset.preview = preview ? 'true' : 'false';
    if (preview) {
      annexBoard.setAttribute('role', 'img');
      setLabel(annexBoard, 'aria-label', 'EXPANSION_EDIT_LOCKED_GRID');
      setText(annexLabel, 'EXPANSION_EDIT_LOCKED_LABEL');
      annexBoard.append(...expansionPreviewBays());
    } else {
      annexBoard.setAttribute('role', 'grid');
      setLabel(annexBoard, 'aria-label', '擴充區格位');
      setText(annexLabel, '擴充區 · 原型（未定價、不收費）');
    }
    boardScroll.dataset.annex = annex || preview ? 'true' : 'false';
    boardHint.textContent = uiText(productGrid ? 'CAGE_PUBLIC_TEST_GRID_HINT' : annex ? '牧場平面配置 · 左右滑動查看格位，往下是擴充區' : '牧場平面配置 · 左右滑動查看所有格位');
    const cellArt = new Map(cageEditorArtCells(cage.slots, undefined, { productGrid }).map((cell) => [cell.slotIndex, cell]));
    expansionControls.dataset.productGrid = productGrid ? 'true' : 'false';
    expansionControls.replaceChildren();
    if (productGrid) {
      for (let row = 2; row < 5; row++) {
        const lockedSlots = cage.slots.filter(slot=>slot.row === row && !slot.unlocked);
        const remaining = lockedSlots.length;
        if (!remaining) continue;
        // One row indicator, not ten purchase targets. Use the existing art
        // coordinates so stable slot anchors and partial legacy access stay put.
        const lockedArt = lockedSlots.map(slot=>cellArt.get(slot.slotIndex));
        const left = Math.min(...lockedArt.map(cell=>cell.x));
        const rowLock = element('button', 'cm-cage-row-lock');
        rowLock.type = 'button';
        rowLock.dataset.lockedTestRow = String(row);
        rowLock.setAttribute('aria-haspopup', 'dialog');
        rowLock.setAttribute('aria-label', uiText('CAGE_TEST_BUY_ROW', { row: row + 1, count: remaining, price: 1000 }));
        rowLock.style.left = `${(left + Math.max(...lockedArt.map(cell=>cell.x)) + 48) / 2 - 22}px`;
        rowLock.style.top = `${Math.min(...lockedArt.map(cell=>cell.y)) + 6}px`;
        const icon = element('span', 'cm-cage-row-lock__icon', '🔒');
        icon.setAttribute('aria-hidden', 'true');
        rowLock.append(icon);
        rowLock.addEventListener('click', () => { void rowPurchase.open(row); });
        board.append(rowLock);
      }
    }
    if (preview) {
      const view = element('button', 'cm-vs2-action cm-cage-expansion__view');
      view.type = 'button';
      view.dataset.expansionAction = 'preview';
      setText(view, 'EXPANSION_VIEW');
      view.addEventListener('click', () => { void openExpansionPreview(); });
      expansionControls.append(view);
    }
    if (!productGrid && ranchExpansionPrototypeVisible(mode) && cage.layoutVersion) {
      const annexUsed = cage.slots.some((slot) => slot.deck === 1 && slot.moduleId);
      const toggle = element('button', 'cm-vs2-action', annex ? '移除擴充區（原型）' : '加入擴充區（原型，不收費）');
      toggle.type = 'button';
      toggle.dataset.expansionAction = annex ? 'revoke' : 'grant';
      toggle.disabled = (annex && annexUsed) || (!annex && cage.dirty);
      toggle.title = uiText(annex && annexUsed ? '先取回擴充區的設施' : !annex && cage.dirty ? '先套用或放棄目前的配置' : '');
      toggle.addEventListener('click', () => {
        if (annex) source.intents.revokeRanchExpansion?.();
        else source.intents.grantRanchExpansion?.();
      });
      expansionControls.append(toggle);
    }
    for (const slot of cage.slots) {
      const productGrid = cage.layoutVersion === PRODUCT_RANCH_GRID;
      const cell = element("button", "cm-vs2-cage-slot");
      cell.type = "button";
      cell.dataset.slotIndex = String(slot.slotIndex);
      cell.dataset.row = String(slot.row);
      cell.dataset.unlocked = slot.unlocked ? "true" : "false";
      cell.dataset.filled = slot.moduleId ? "true" : "false";
      cell.disabled = !slot.unlocked || slot.fixed;
      cell.dataset.fixed = slot.fixed ? 'true' : 'false';
      cell.setAttribute("role", "gridcell");
      cell.setAttribute(
        "aria-label",
        slot.unlocked
          ? (slot.displayName
            ? uiText("第 {n} 格：{cage}。{effect}", { n: slot.slotIndex + 1, cage: cageUiName(slot.moduleId, slot.displayName), effect: cageUiSummary(slot.moduleId, slot.trainingSummary) ?? "" })
            : uiText(`Empty hex ${slot.slotIndex + 1}`))
          : uiText(`Locked hex ${slot.slotIndex + 1}`));
      const visual = cellArt.get(slot.slotIndex);
      cell.style.left = `${visual.x}px`; cell.style.top = `${visual.y}px`;
      if (visual.image) {
        cell.style.backgroundImage = `url('${visual.image}')`;
        cell.style.backgroundSize = `${visual.imageWidth}px ${visual.imageHeight}px`;
        cell.style.backgroundPosition = `${visual.imageX}px ${visual.imageY}px`;
      }
      cell.title = uiText(cageUiName(slot.moduleId, slot.displayName) || (slot.unlocked ? '可放置' : '尚未開放'));
      // Derive the first unlocking rank from the authoritative table, never
      // from the QA annex grant or a future paid entitlement.
      const requiredRank = !productGrid && !slot.unlocked && slot.slotIndex < TAMER_RANK_SLOT_TABLE.at(-1)
        ? TAMER_RANK_SLOT_TABLE.findIndex(count => slot.slotIndex < count) : null;
      if (requiredRank !== null) {
        cell.dataset.requiredRank = String(requiredRank);
        const lockedParams = { n: slot.slotIndex + 1, rank: requiredRank };
        setLabel(cell, 'aria-label', 'CAGE_SLOT_RANK_LOCKED', lockedParams);
        setLabel(cell, 'title', 'CAGE_SLOT_RANK_LOCKED', lockedParams);
      }
      cell.textContent = uiText(slot.moduleId ? '' : slot.unlocked ? '+' : productGrid ? '' : '🔒');
      cell.addEventListener("click", () => {
        if (!slot.unlocked || slot.fixed) return;
        if (slot.moduleId) source.intents.removeCagePlacement(slot.moduleId);
        else source.intents.placeCageAt(slot.slotIndex);
      });
      cell.dataset.deck = String(slot.deck ?? 0);
      (slot.deck === 1 ? annexBoard : board).append(cell);
    }

    facilities.replaceChildren();
    for (const placement of cage.placements) {
      const tile = element('button', 'cm-cage-facility');
      tile.type = 'button';
      tile.disabled = cage.slots.some((slot) => slot.moduleId === placement.moduleId && slot.fixed);
      const displayName = cageUiName(placement.moduleId, placement.displayName);
      tile.setAttribute('aria-label', uiText('取回 {cage}', { cage: displayName }));
      const src = cageUiImage(placement.moduleId);
      if (src) { const image = element('img', 'cm-facility-thumb'); image.src = src; image.alt = ''; tile.append(image); }
      tile.append(element('strong', '', displayName), element('span', '', cageUiSummary(placement.moduleId, placement.trainingSummary)));
      tile.addEventListener('click', () => source.intents.removeCagePlacement(placement.moduleId));
      facilities.append(tile);
    }

    tray.replaceChildren();
    if (cage.tray.length === 0) {
      tray.append(element("p", "cm-vs2-shop__empty", "已持有的設施皆已放置。"));
      return;
    }
    for (const item of cage.tray) {
      const row = element("button", "cm-vs2-cage-tray__item");
      row.type = "button";
      row.dataset.selected = item.selected ? "true" : "false";
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-pressed", item.selected ? "true" : "false");
      row.setAttribute("aria-label", uiText("選擇{cage}。{effect}", { cage: cageUiName(item.moduleId, item.displayName), effect: cageUiSummary(item.moduleId, item.trainingSummary) ?? "" }));
      const src = cageUiImage(item.moduleId);
      if (src) { const image = element('img', 'cm-facility-thumb'); image.src = src; image.alt = ''; row.append(image); }
      row.append(
        element("span", "cm-vs2-cage-tray__name", cageUiName(item.moduleId, item.displayName)),
        element("span", "cm-vs2-cage-tray__effect", cageUiSummary(item.moduleId, item.trainingSummary))
      );
      row.addEventListener("click", () => {
        source.intents.selectCageModule(item.selected ? null : item.moduleId);
      });
      tray.append(row);
    }
  }

  paint(frame);

  return Object.freeze({
    render: paint,
    dispose() {
      rowPurchase.dispose();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
    }
  });
}

