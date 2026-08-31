// VS4 -- Shop presentation.
//
// Consumes only the injected Gate/Hunt presentation source. The Shop runtime
// owns Bits, visibility and quantities; this view lists what is already
// visible and sends buy/leave through intents.

import { PRODUCT_GIVEN_NAME_MAX_LENGTH } from "./championshipRaisingProduction.js";
import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from "./vs2Screens.js";

const CATEGORY_LABELS = Object.freeze({
  TRAINING_GOODS: "GOODS",
  HUNT_ITEMS: "HUNT",
  PLUGINS: "PLUGINS",
  CAGES: "CAGES"
});

const RECEIPT_COPY = Object.freeze({
  PURCHASED: "Purchased.",
  INSUFFICIENT_FUNDS: "Not enough Bits.",
  MAX_OWNED: "You already hold the maximum.",
  UNAVAILABLE: "That item is not for sale.",
  INVALID_QUANTITY: "That quantity cannot be bought."
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
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
  shell.setAttribute("aria-label", "Shop");
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "HOME"),
    element("h1", "cm-vs2-title", "SHOP"),
    element("p", "cm-vs2-subtitle", "Buy goods, hunt gear, plugins and cages.")
  );
  const wallet = element("div", "cm-vs2-shop__wallet");
  wallet.setAttribute("aria-live", "polite");
  header.append(copy, wallet);

  const body = element("div", "cm-vs2-body cm-vs2-shop__body");
  const tabs = element("div", "cm-vs2-shop__tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Shop categories");
  const list = element("div", "cm-vs2-shop__list");
  list.setAttribute("role", "list");
  const status = element("p", "cm-vs2-shop__status");
  status.setAttribute("aria-live", "polite");
  body.append(tabs, list, status);

  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action cm-vs2-action--primary", "BACK");
  back.type = "button";
  back.setAttribute("aria-label", "Return to Raising Home");
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
    wallet.textContent = `${shop.bits} / ${shop.bitsCap} BITS`;
    const receipt = shop.lastReceipt;
    status.textContent = receipt ? (RECEIPT_COPY[receipt.reason] ?? "") : "";

    for (const [category, tab] of tabButtons) {
      tab.dataset.active = category === activeCategory ? "true" : "false";
      tab.setAttribute("aria-selected", category === activeCategory ? "true" : "false");
    }

    const rows = shop.listings.filter((row) => row.category === activeCategory);
    list.replaceChildren();
    if (rows.length === 0) {
      list.append(element("p", "cm-vs2-shop__empty", "Nothing listed in this category yet."));
      return;
    }
    for (const row of rows) {
      const item = element("div", "cm-vs2-shop__row");
      item.setAttribute("role", "listitem");
      const name = element("div", "cm-vs2-shop__name");
      name.append(element("strong", "", row.displayName));
      if (row.visibility === "NEW") name.append(element("span", "cm-vs2-shop__new", "NEW"));
      const meta = element(
        "span",
        "cm-vs2-shop__meta",
        `${row.unitPriceBits} Bits · ${row.owned}/${row.maxOwned}`
      );
      name.append(meta);
      const buy = element("button", "cm-vs2-shop__buy", row.owned >= row.maxOwned ? "HELD" : "BUY");
      buy.type = "button";
      buy.disabled = row.owned >= row.maxOwned || shop.bits < row.unitPriceBits;
      buy.setAttribute("aria-label", `Buy ${row.displayName}`);
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
  shell.setAttribute("aria-label", "Database");
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "HOME"),
    element("h1", "cm-vs2-title", "DATABASE"),
    element("p", "cm-vs2-subtitle", "224 encyclopedia slots. Unlock filters remain untraced.")
  );
  const census = element("div", "cm-vs2-shop__wallet");
  census.setAttribute("aria-live", "polite");
  header.append(copy, census);

  const body = element("div", "cm-vs2-body cm-vs2-shop__body");
  const tabs = element("div", "cm-vs2-shop__tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Database families");
  const list = element("div", "cm-vs2-shop__list");
  list.setAttribute("role", "list");
  const detail = element("div", "cm-vs2-database__detail");
  detail.hidden = true;
  body.append(tabs, list, detail);

  const footer = element("footer", "cm-vs2-footer");
  const back = element("button", "cm-vs2-action cm-vs2-action--primary", "BACK");
  back.type = "button";
  back.setAttribute("aria-label", "Return to Raising Home");
  footer.append(back);
  shell.append(header, body, footer);
  root.append(shell);

  let family = "REGULAR";
  const families = [
    { id: "REGULAR", label: "SPECIES" },
    { id: "EGG", label: "EGGS" }
  ];
  const tabButtons = new Map();
  for (const entry of families) {
    const tab = element("button", "cm-vs2-shop__tab", entry.label);
    tab.type = "button";
    tab.dataset.family = entry.id;
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => {
      family = entry.id;
      source.intents.selectDatabaseSpecies(null);
    });
    tabs.append(tab);
    tabButtons.set(entry.id, tab);
  }

  back.addEventListener("click", () => {
    const current = source.getFrame().database;
    if (current?.selected) source.intents.selectDatabaseSpecies(null);
    else source.intents.leaveScreen();
  });

  function paint(nextFrame) {
    const book = nextFrame?.database;
    if (!book) return;
    census.textContent = `${book.registeredCount} / ${book.slotCount}`;
    body.dataset.mode = book.selected ? "detail" : "list";
    for (const [id, tab] of tabButtons) {
      tab.dataset.active = id === family ? "true" : "false";
      tab.setAttribute("aria-selected", id === family ? "true" : "false");
    }

    if (book.selected) {
      list.hidden = true;
      tabs.hidden = true;
      detail.hidden = false;
      back.textContent = "LIST";
      back.setAttribute("aria-label", "Return to database list");
      paintDetail(book.selected, book);
      return;
    }

    list.hidden = false;
    tabs.hidden = false;
    detail.hidden = true;
    detail.replaceChildren();
    back.textContent = "BACK";
    back.setAttribute("aria-label", "Return to Raising Home");
    const rows = book.entries.filter((row) => row.kind === family);
    list.replaceChildren();
    for (const row of rows) {
      const item = element("button", "cm-vs2-shop__row cm-vs2-database__row");
      item.type = "button";
      item.dataset.state = row.state;
      item.setAttribute("aria-label", row.state === "REGISTERED" ? row.displayName : `Undiscovered slot ${String(row.speciesIndex).padStart(3, "0")}`);
      const name = element("div", "cm-vs2-shop__name");
      name.append(element("strong", "", row.state === "REGISTERED" ? row.displayName : "-----"));
      name.append(element(
        "span",
        "cm-vs2-shop__meta",
        `${String(row.speciesIndex).padStart(3, "0")} · ${row.state === "REGISTERED" ? `${row.instanceCount} held` : "undiscovered"}`
      ));
      item.append(name);
      item.addEventListener("click", () => source.intents.selectDatabaseSpecies(row.speciesIndex));
      list.append(item);
    }
  }

  function paintDetail(selected, book) {
    detail.replaceChildren();
    const title = element("h2", "cm-vs2-database__detail-title", selected.state === "REGISTERED" ? selected.displayName : "Undiscovered");
    const meta = element(
      "p",
      "cm-vs2-shop__meta",
      selected.state === "REGISTERED"
        ? `${selected.kind} · ${selected.source ?? "REGISTERED"}`
        : "This slot is in the 224-entry book. Unlock/filter logic is untraced."
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
      nameInput.setAttribute("aria-label", "Given name");
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
  shell.setAttribute("aria-label", "Cage editor");
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "HOME"),
    element("h1", "cm-vs2-title", "CAGE"),
    element("p", "cm-vs2-subtitle", "One cage per hex. Rank opens 14–20. Overfill is allowed; extra Digimon stress more easily.")
  );
  const census = element("div", "cm-vs2-cage-rank");
  census.setAttribute("aria-live", "polite");
  header.append(copy, census);

  const body = element("div", "cm-vs2-body cm-vs2-cage-edit__body");
  const board = element("div", "cm-vs2-cage-board");
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", "Ranch hex slots");
  const tray = element("div", "cm-vs2-cage-tray");
  tray.setAttribute("role", "list");
  tray.setAttribute("aria-label", "Owned cages");
  const status = element("p", "cm-vs2-shop__status");
  status.setAttribute("aria-live", "polite");
  body.append(board, tray, status);

  const footer = element("footer", "cm-vs2-footer");
  const confirm = element("button", "cm-vs2-action cm-vs2-action--primary", "CONFIRM");
  confirm.type = "button";
  confirm.setAttribute("aria-label", "Keep this ranch layout");
  const back = element("button", "cm-vs2-action", "BACK");
  back.type = "button";
  back.setAttribute("aria-label", "Return to Raising Home");
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
    down.setAttribute("aria-label", "Lower stand-in rank until title matches write it");
    down.disabled = cage.tamerRank <= 0;
    down.addEventListener("click", () => source.intents.setTamerRank(cage.tamerRank - 1));
    const rankLabel = element(
      "span",
      "cm-vs2-cage-rank__label",
      `RANK ${cage.tamerRank} · ${cage.placements.length} / ${cage.unlockedCount} HEX`
    );
    const up = element("button", "cm-vs2-cage-rank__step", "+");
    up.type = "button";
    up.setAttribute("aria-label", "Raise stand-in rank until title matches write it");
    up.disabled = cage.tamerRank >= cage.tamerRankTableLastIndex;
    up.addEventListener("click", () => source.intents.setTamerRank(cage.tamerRank + 1));
    census.append(down, rankLabel, up);
    const reason = cage.lastVerdict?.reason;
    status.textContent = reason ? (CAGE_VERDICT_COPY[reason] ?? "") : "";
    confirm.disabled = !cage.dirty;

    board.replaceChildren();
    for (const slot of cage.slots) {
      const cell = element("button", "cm-vs2-cage-slot");
      cell.type = "button";
      cell.dataset.slotIndex = String(slot.slotIndex);
      cell.dataset.row = String(slot.row);
      cell.dataset.unlocked = slot.unlocked ? "true" : "false";
      cell.dataset.filled = slot.moduleId ? "true" : "false";
      cell.disabled = !slot.unlocked;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute(
        "aria-label",
        slot.unlocked
          ? (slot.displayName
            ? `${slot.displayName} on hex ${slot.slotIndex + 1}. ${slot.trainingSummary ?? ""}`
            : `Empty hex ${slot.slotIndex + 1}`)
          : `Locked hex ${slot.slotIndex + 1}`
      );
      cell.textContent = slot.unlocked ? (slot.displayName ?? "") : "";
      cell.addEventListener("click", () => {
        if (slot.moduleId) source.intents.removeCagePlacement(slot.moduleId);
        else source.intents.placeCageAt(slot.slotIndex);
      });
      board.append(cell);
    }

    tray.replaceChildren();
    if (cage.tray.length === 0) {
      tray.append(element("p", "cm-vs2-shop__empty", "Every owned cage is on the ranch."));
      return;
    }
    for (const item of cage.tray) {
      const row = element("button", "cm-vs2-cage-tray__item");
      row.type = "button";
      row.dataset.selected = item.selected ? "true" : "false";
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-pressed", item.selected ? "true" : "false");
      row.setAttribute("aria-label", `Select ${item.displayName}. ${item.trainingSummary}`);
      row.append(
        element("span", "cm-vs2-cage-tray__name", item.displayName),
        element("span", "cm-vs2-cage-tray__effect", item.trainingSummary)
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
