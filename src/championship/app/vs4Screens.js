import { speciesName, shopItemDescription as shopDescriptionText, shopItemName } from "../text/zhHant.js";
// VS4 -- Shop presentation.
//
// Consumes only the injected Gate/Hunt presentation source. The Shop runtime
// owns Bits, visibility and quantities; this view lists what is already
// visible and sends buy/leave through intents.

import { PRODUCT_GIVEN_NAME_MAX_LENGTH } from "./championshipRaisingProduction.js";
import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from "./vs2Screens.js";
import { cageUiImage, shopCageUiImage, cageEditorArtCells, cageUiName, shopCageUiName, cageUiSummary } from '../presentation/cageUiArt.js';
import { setLabel, uiText } from '../text/uiText.js';
import { shopGoodsPresentation } from '../presentation/shopGoodsUiArt.js';
import { getHuntCatalogItem } from '../hunt/loadout/huntEquipmentCatalog.js';
import { showChoiceDialog } from './uiDialog.js';
import { prefersReducedMotion } from '../presentation/presentationPreferences.js';

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
  }

  paint(frame);

  return Object.freeze({
    render: paint,
    dispose() {
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

export function createDatabaseView({ root, source }) {
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
    element("p", "cm-vs2-subtitle", "數碼獸圖鑑")
  );
  const census = element("div", "cm-vs2-shop__wallet");
  census.setAttribute("aria-live", "polite");
  header.append(copy, census);

  const body = element("div", "cm-vs2-body cm-vs2-shop__body");
  const list = element("div", "cm-vs2-shop__list");
  list.setAttribute("role", "list");
  const detail = element("div", "cm-vs2-database__detail");
  detail.hidden = true;
  body.append(list, detail);

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
  back.addEventListener("click", () => {
    const current = source.getFrame().database;
    if (current?.selected) source.intents.selectDatabaseSpecies(null);
    else source.intents.leaveScreen();
  });

  function paint(nextFrame) {
    const book = nextFrame?.database;
    if (!book) return;
    census.textContent = uiText("已登錄 {count} / {total}", { count: book.registeredCount, total: book.slotCount });
    body.dataset.mode = book.selected ? "detail" : "list";

    if (book.selected) {
      list.hidden = true;
      detail.hidden = false;
      back.textContent = uiText("Return to database list");
      back.setAttribute("aria-label", uiText("Return to database list"));
      paintDetail(book.selected, book);
      return;
    }

    list.hidden = false;
    detail.hidden = true;
    detail.replaceChildren();
    // Every neighbouring screen names where its exit goes ("返回牧場"); this one
    // said only "返回", which reads as "go back one step" next to the detail
    // view's own back control.
    back.textContent = uiText("RETURN TO RANCH");
    back.setAttribute("aria-label", uiText("Return to Raising Home"));
    const rows = book.entries;
    list.replaceChildren();
    let reopened = null;
    for (const row of rows) {
      const item = element("button", "cm-vs2-shop__row cm-vs2-database__row");
      item.dataset.speciesIndex = String(row.speciesIndex);
      if (row.speciesIndex === lastOpened) reopened = item;
      item.type = "button";
      item.dataset.state = row.state;
      item.setAttribute("aria-label", row.state === "REGISTERED" ? uiText(speciesName(row.speciesIndex, row.displayName)) : uiText("未登錄 {n}", { n: row.bookOrdinal + 1 }));
      const name = element("div", "cm-vs2-shop__name");
      name.append(element("strong", "", row.state === "REGISTERED" ? speciesName(row.speciesIndex, row.displayName) : "-----"));
      // The number stays; "registered / not" is carried by the tile itself
      // and by its accessible name.
      name.append(element("span", "cm-vs2-shop__meta", String(row.bookOrdinal + 1).padStart(3, "0")));
      item.append(name);
      item.addEventListener("click", () => {
        // Coming back from an entry lands where the player left the book,
        // not at number 001 again.
        listScroll = list.scrollTop ?? 0;
        lastOpened = row.speciesIndex;
        source.intents.selectDatabaseSpecies(row.speciesIndex);
      });
      list.append(item);
    }
    if (listScroll !== null) {
      list.scrollTop = listScroll;
      reopened?.focus?.({ preventScroll: true });
      listScroll = null;
    }
  }

  function paintDetail(selected, book) {
    detail.replaceChildren();
    const title = element("h2", "cm-vs2-database__detail-title", selected.state === "REGISTERED" ? speciesName(selected.speciesIndex, selected.displayName) : "Undiscovered");
    const meta = element(
      "p",
      "cm-vs2-shop__meta",
      selected.state === "REGISTERED"
        ? "已登錄"
        : "尚未登錄這隻數碼獸。"
    );
    detail.append(title, meta);
    if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
      detail.append(element("p", "cm-vs2-evidence", `${selected.speciesId} · ${book.unlockEvidence}`));
    }
    if (selected.state !== "REGISTERED") return;
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

  paint(frame);

  return Object.freeze({
    render: paint,
    dispose() {
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

export function createCageEditView({ root, source, askToLeave = showChoiceDialog }) {
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
      : "One cage per hex. Rank opens 14–20. Overfill is allowed; extra Digimon stress more easily.")
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
  boardScroll.append(board, annexLabel, annexBoard);
  const expansionControls = element('div', 'cm-cage-expansion');
  const facilities = element('div', 'cm-cage-facilities');
  facilities.setAttribute('aria-label', uiText('已放置設施'));
  const boardHint = element('p', 'cm-cage-board-hint', '牧場平面配置 · 左右滑動查看所有格位');
  body.append(boardHint, boardScroll, expansionControls, facilities, tray, status);

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
    const annex = Boolean(cage.expansion);
    annexLabel.hidden = !annex; annexBoard.hidden = !annex;
    boardScroll.dataset.annex = annex ? 'true' : 'false';
    boardHint.textContent = uiText(annex ? '牧場平面配置 · 左右滑動查看格位，往下是擴充區' : '牧場平面配置 · 左右滑動查看所有格位');
    expansionControls.replaceChildren();
    if (ranchExpansionPrototypeVisible(mode) && cage.layoutVersion) {
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
    const cellArt = new Map(cageEditorArtCells(cage.slots).map((cell) => [cell.slotIndex, cell]));
    for (const slot of cage.slots) {
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
      cell.textContent = uiText(slot.moduleId ? '' : slot.unlocked ? '+' : '×');
      cell.addEventListener("click", () => {
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
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
    }
  });
}
