import { speciesName } from "../text/zhHant.js";
// VS4 -- Shop presentation.
//
// Consumes only the injected Gate/Hunt presentation source. The Shop runtime
// owns Bits, visibility and quantities; this view lists what is already
// visible and sends buy/leave through intents.

import { PRODUCT_GIVEN_NAME_MAX_LENGTH } from "./championshipRaisingProduction.js";
import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from "./vs2Screens.js";
import { cageUiImage, shopCageUiImage, cageEditorArtCells, cageUiName, shopCageUiName, cageUiSummary } from '../presentation/cageUiArt.js';
import { uiText } from '../text/uiText.js';
import { shopGoodsPresentation } from '../presentation/shopGoodsUiArt.js';

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
  UNAVAILABLE: "That item is not for sale.",
  INVALID_QUANTITY: "That quantity cannot be bought."
});

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
  const tabs = element("div", "cm-vs2-shop__tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", uiText("Shop categories"));
  const list = element("div", "cm-vs2-shop__list");
  list.setAttribute("role", "list");
  const status = element("p", "cm-vs2-shop__status");
  status.setAttribute("aria-live", "polite");
  body.append(tabs, list, status);

  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action cm-vs2-action--primary", "返回牧場");
  back.type = "button";
  back.setAttribute("aria-label", uiText("Return to Raising Home"));
  footer.append(back);
  shell.append(header, body, footer);
  root.append(shell);

  const categories = Object.keys(CATEGORY_LABELS);
  let activeCategory = categories[0];
  const tabButtons = new Map();

  for (const category of categories) {
    const tab = element("button", "cm-vs2-shop__tab", CATEGORY_LABELS[category]);
    tab.type = "button";
    tab.dataset.category = category;
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => {
      activeCategory = category;
      paint(source.getFrame());
    });
    tabs.append(tab);
    tabButtons.set(category, tab);
  }

  back.addEventListener("click", () => source.intents.leaveScreen());

  function paint(nextFrame) {
    const shop = nextFrame?.shop;
    if (!shop) return;
    wallet.textContent = uiText(`持有 ${shop.bits.toLocaleString('en-US')} 位元幣`);
    const receipt = shop.lastReceipt;
    status.textContent = uiText(receipt ? (RECEIPT_COPY[receipt.reason] ?? "") : "");

    for (const [category, tab] of tabButtons) {
      tab.dataset.active = category === activeCategory ? "true" : "false";
      tab.setAttribute("aria-selected", category === activeCategory ? "true" : "false");
    }

    const rows = shop.listings.filter((row) => row.category === activeCategory);
    list.replaceChildren();
    if (rows.length === 0) {
      list.append(element("p", "cm-vs2-shop__empty", "這個分類目前沒有販售商品。"));
      return;
    }
    for (const row of rows) {
      const goods = shopGoodsPresentation(row.shopRecordIndex);
      const displayName = goods?.name ?? shopCageUiName(row.shopRecordIndex, uiText(row.displayName));
      const item = element("div", "cm-vs2-shop__row");
      item.setAttribute("role", "listitem");
      const imageSrc = shopCageUiImage(row.shopRecordIndex);
      if (imageSrc) {
        const image = element('img', 'cm-facility-thumb');
        image.src = imageSrc; image.alt = displayName; image.loading = 'lazy';
        item.append(image);
      }
      if (goods?.src) {
        const icon = element('span', 'cm-shop-goods-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.dataset.icon = goods.icon;
        icon.style.backgroundImage = `url("${goods.src}")`;
        icon.style.backgroundPosition = goods.backgroundPosition;
        item.append(icon);
      }
      item.dataset.hasArt = String(Boolean(imageSrc || goods?.src));
      const name = element("div", "cm-vs2-shop__name");
      name.append(element("strong", "", displayName));
      if (row.visibility === "NEW") name.append(element("span", "cm-vs2-shop__new", "NEW"));
      const meta = element(
        "span",
        "cm-vs2-shop__meta",
        `${row.unitPriceBits.toLocaleString('en-US')} 位元幣 · 持有 ${row.owned}/${row.maxOwned}`
      );
      name.append(meta);
      const buy = element("button", "cm-vs2-shop__buy", row.owned >= row.maxOwned ? "已持有" : "購買");
      buy.type = "button";
      buy.disabled = row.owned >= row.maxOwned || shop.bits < row.unitPriceBits;
      buy.setAttribute("aria-label", uiText(`購買${displayName}`));
      buy.addEventListener("click", () => source.intents.buyShopItem(row.shopRecordIndex, 1));
      item.append(name, buy);
      list.append(item);
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

  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action cm-vs2-action--primary", "BACK");
  back.type = "button";
  back.setAttribute("aria-label", uiText("Return to Raising Home"));
  footer.append(back);
  shell.append(header, body, footer);
  root.append(shell);

  back.addEventListener("click", () => {
    const current = source.getFrame().database;
    if (current?.selected) source.intents.selectDatabaseSpecies(null);
    else source.intents.leaveScreen();
  });

  function paint(nextFrame) {
    const book = nextFrame?.database;
    if (!book) return;
    census.textContent = uiText(`${book.registeredCount} / ${book.slotCount}`);
    body.dataset.mode = book.selected ? "detail" : "list";

    if (book.selected) {
      list.hidden = true;
      detail.hidden = false;
      back.textContent = uiText("LIST");
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
    for (const row of rows) {
      const item = element("button", "cm-vs2-shop__row cm-vs2-database__row");
      item.type = "button";
      item.dataset.state = row.state;
      item.setAttribute("aria-label", uiText(row.state === "REGISTERED" ? speciesName(row.speciesIndex, row.displayName) : `未登錄 ${row.bookOrdinal + 1}`));
      const name = element("div", "cm-vs2-shop__name");
      name.append(element("strong", "", row.state === "REGISTERED" ? speciesName(row.speciesIndex, row.displayName) : "-----"));
      name.append(element(
        "span",
        "cm-vs2-shop__meta",
        `${String(row.bookOrdinal + 1).padStart(3, "0")} · ${row.state === "REGISTERED" ? "已登錄" : "未登錄"}`
      ));
      item.append(name);
      item.addEventListener("click", () => source.intents.selectDatabaseSpecies(row.speciesIndex));
      list.append(item);
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
  CONFIRMED: "Layout kept. Save on Home to write it to disk.",
  SLOT_LOCKED: "That hex is still locked.",
  OCCUPIED: "That hex already has a cage.",
  FOOTPRINT_BLOCKED: "The full cage footprint must fit in free, unlocked cells.",
  FIXED_WAITING_ROOM: "Waiting Room stays at the ranch entrance.",
  ALREADY_PLACED: "That cage is already on the ranch.",
  UNOWNED: "You do not own that cage.",
  NOTHING_SELECTED: "Select a cage first.",
  OUT_OF_BOUNDS: "That hex is outside the ranch."
});

export function createCageEditView({ root, source }) {
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
    element("h1", "cm-vs2-title", "牧場配置"),
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
  boardScroll.append(board);
  const facilities = element('div', 'cm-cage-facilities');
  facilities.setAttribute('aria-label', uiText('已放置設施'));
  body.append(element('p', 'cm-cage-board-hint', '牧場平面配置 · 左右滑動查看所有格位'), boardScroll, facilities, tray, status);

  const footer = element("footer", "cm-vs2-footer");
  const confirm = element("button", "cm-vs2-action cm-vs2-action--primary", "確認配置");
  confirm.type = "button";
  confirm.setAttribute("aria-label", uiText("Keep this ranch layout"));
  const back = element("button", "cm-vs2-action", "返回牧場");
  back.type = "button";
  back.setAttribute("aria-label", uiText("Return to Raising Home"));
  footer.append(confirm, back);
  shell.append(header, body, footer);
  root.append(shell);

  back.addEventListener("click", () => source.intents.leaveScreen());
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
      `階級 ${cage.tamerRank} · ${cage.occupiedCount ?? cage.placements.length} / ${cage.unlockedCount} 格`
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
        uiText(slot.unlocked
          ? (slot.displayName
            ? `第 ${slot.slotIndex + 1} 格：${cageUiName(slot.moduleId, slot.displayName)}。${cageUiSummary(slot.moduleId, slot.trainingSummary) ?? ""}`
            : `Empty hex ${slot.slotIndex + 1}`)
          : `Locked hex ${slot.slotIndex + 1}`));
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
      board.append(cell);
    }

    facilities.replaceChildren();
    for (const placement of cage.placements) {
      const tile = element('button', 'cm-cage-facility');
      tile.type = 'button';
      tile.disabled = cage.slots.some((slot) => slot.moduleId === placement.moduleId && slot.fixed);
      const displayName = cageUiName(placement.moduleId, placement.displayName);
      tile.setAttribute('aria-label', uiText(`取回 ${displayName}`));
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
      row.setAttribute("aria-label", uiText(`選擇${cageUiName(item.moduleId, item.displayName)}。${cageUiSummary(item.moduleId, item.trainingSummary)}`));
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
