import { uiText } from "../text/uiText.js";
// The contextual toolbar -- the original's ui/toolbar.nxr.
//
// WHAT IS ROM_VERIFIED HERE
// -------------------------
//   * Eight slots. ARM9 teardown loop at 0x020607D0 walks 8 entries of stride
//     0x1C0 from +0x64.
//   * The scene is Shared, attached by the ARM9 main binary rather than by any
//     mode overlay -- which is why this mounts at body level beside the status
//     bar instead of inside a screen.
//   * Two modes: 1 = TRAINING_RAISING (OVL18 0x0211CF08 MOV R1,#1) and
//     2 = HUNT (OVL0 0x0211A138 MOV R1,#2).
//   * Six care tools exist, recovered from the game's own tutorial text:
//     hand, feed, clean, medicine, wound medicine, protein.
//   * A submenu opens from the bar (submenu_origin at 167,162).
//
// WHAT IS LIVE_FOOTAGE_OBSERVATION
// --------------------------------
// There are TWO submenus, and their entries are legible:
//   MANAGEMENT: Tamer, Schedule, Cage Edit, Digimon, End Day
//   SYSTEM:     Help, Save & Quit, Database, Hunt, Battle, Shop
//
// Raising slot identity is now corroborated by the original tutorial's
// toolbar-selection waits: hand 0, food 1, clean 3, wound 4, medicine 5;
// OVL18's remaining food branch and training_set bind protein 2. The two
// submenu slots are also visible in the original footage (V13/V15).
//
// Feed/protein placement, food cleaning and their native individual writers
// now bind through RAISING_NATIVE_FEEDING.v1. Treatment and other lifecycle
// callers remain separate. This toolbar only projects the existing inventory;
// it owns none of the gameplay arithmetic.
//
// See docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json.

export const TOOLBAR_SLOT_COUNT = 8;
export const TOOLBAR_SLOT_COUNT_EVIDENCE = "ROM_VERIFIED";
export const TOOLBAR_SLOT_MAPPING_EVIDENCE = "ROM_VERIFIED";

export const TOOLBAR_MODES = Object.freeze({ TRAINING: 1, HUNT: 2 });

/** Raising order; Hunt has its own mode-specific command binding. */
export const TOOLBAR_TOOLS = Object.freeze([
  { id: "hand", label: "HAND", hint: "Move a resident, or stroke it" },
  { id: "feed", label: "FEED", hint: "Place food beside a resident" },
  { id: "protein", label: "PROTEIN", hint: "Raise attack for a time" },
  { id: "clean", label: "CLEAN", hint: "Clear droppings and leftovers" },
  { id: "woundMedicine", label: "WOUND", hint: "Heal injury" },
  { id: "medicine", label: "MED", hint: "Cure sickness" }
]);

/**
 * The two submenus, exactly as observed.
 *
 * `screen` names a Championship screen the entry opens. `action` names a runtime
 * intent. An entry with neither is a destination the original has and this build
 * has not made yet -- it stays visible and disabled rather than being deleted,
 * because deleting it would misrepresent the original's menu.
 */
export const TOOLBAR_MENUS = Object.freeze([
  Object.freeze({
    id: "MANAGEMENT",
    label: "MANAGE",
    entries: Object.freeze([
      { id: "tamer", label: "Tamer", screen: "TAMER_INFO", hint: "階級、戰績與收納容量" },
      { id: "schedule", label: "Schedule", screen: "SCHEDULE", hint: "全年頭銜賽與登錄" },
      { id: "cageEdit", label: "Cage Edit", screen: "CAGE_EDIT", hint: "調整牧場設施位置" },
      { id: "digimon", label: "Digimon", screen: "DIGIMON_LIST", hint: "夥伴名單與能力值" },
      { id: "endDay", label: "End Day", action: "END_DAY", hint: "結束今天，進入隔天" }
    ])
  }),
  Object.freeze({
    id: "SYSTEM",
    label: "SYSTEM",
    entries: Object.freeze([
      { id: "help", label: "Help", screen: "HELP", hint: "操作與規則說明" },
      { id: "saveQuit", label: "Save & Quit", action: "SAVE_AND_QUIT", hint: "儲存進度並回到標題" },
      { id: "database", label: "Database", screen: "DATABASE", hint: "已登錄的數碼獸" },
      { id: "hunt", label: "Hunt", screen: "GATE_SELECT", hint: "前往傳送門捕捉數碼獸" },
      { id: "battle", label: "Battle", screen: "BATTLE_SELECT", hint: "參加比賽贏得獎金" },
      { id: "shop", label: "Shop", screen: "SHOP", hint: "購買食物、道具與設施" }
    ])
  })
]);

/**
 * Entries this product adds to a submenu (PRODUCT_AUTHORED, settings round
 * 2026-09-29). They are kept apart from TOOLBAR_MENUS, which stays exactly the
 * observed original menus; the menu panel shows both, grouped below.
 */
export const TOOLBAR_PRODUCT_ENTRIES = Object.freeze({
  SYSTEM: Object.freeze([
    Object.freeze({ id: "settings", label: "Settings", action: "OPEN_SETTINGS", hint: "主題、畫質、聲音與語言", evidence: "PRODUCT_AUTHORED" })
  ])
});

/**
 * How the two submenus are laid out (2026-09-29, OWNER_APPROVED_ADAPTATION of
 * presentation). The entries, their labels and destinations are the observed
 * ones above; they are shown in groups so the three destinations of the loop
 * are not filed among system chores, and the two entries that end something
 * (the day, the session) sit apart. An entry no group names still appears.
 */
export const TOOLBAR_MENU_GROUPS = Object.freeze({
  MANAGEMENT: Object.freeze([
    Object.freeze({ id: "residents", title: "夥伴與牧場", entries: Object.freeze(["digimon", "cageEdit"]) }),
    Object.freeze({ id: "records", title: "紀錄", entries: Object.freeze(["tamer", "schedule"]) }),
    Object.freeze({ id: "day", title: null, entries: Object.freeze(["endDay"]), separate: true })
  ]),
  SYSTEM: Object.freeze([
    Object.freeze({ id: "go", title: "出發", entries: Object.freeze(["hunt", "battle", "shop"]), prominent: true }),
    Object.freeze({ id: "reference", title: "資料", entries: Object.freeze(["database", "help"]) }),
    Object.freeze({ id: "session", title: null, entries: Object.freeze(["settings", "saveQuit"]), separate: true })
  ])
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

/**
 * Mount the toolbar.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {(entry: object) => void} options.onMenuEntry
 * @param {(toolId: string|null) => void} [options.onToolChange]
 */
export function createChampionshipToolbar({ root, onMenuEntry, onToolChange, getFoodStock=()=>null, subscribeInventory=null } = {}) {
  if (!root) throw new TypeError("The toolbar requires a root element");
  if (typeof onMenuEntry !== "function") throw new TypeError("The toolbar requires an onMenuEntry handler");

  const bar = element("div", "cm-toolbar");
  bar.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  bar.dataset.originalScene = "ui/toolbar.nxr";
  bar.dataset.slotCount = String(TOOLBAR_SLOT_COUNT);
  bar.dataset.slotMapping = TOOLBAR_SLOT_MAPPING_EVIDENCE;
  bar.hidden = true;

  const menuPanel = element("div", "cm-toolbar__menu");
  menuPanel.hidden = true;
  menuPanel.setAttribute("role", "menu");

  // While a care tool is chosen, say what it does and how to put it down.
  // It sits above the rail and never changes the rail's measured height.
  const toolHint = element("div", "cm-toolbar__tool-hint");
  toolHint.hidden = true;
  toolHint.setAttribute("role", "status");
  const toolName = element("span", "cm-toolbar__tool-name");
  const toolText = element("span", "cm-toolbar__tool-text");
  const toolDone = element("button", "cm-toolbar__tool-done", "完成");
  toolDone.type = "button";
  toolHint.append(toolName, toolText, toolDone);

  const rail = element("div", "cm-toolbar__rail");
  rail.setAttribute("role", "toolbar");
  rail.setAttribute("aria-label", uiText("Contextual toolbar"));

  let currentMode = null;
  let selectedTool = null;
  let openMenuId = null;

  function closeMenu() {
    openMenuId = null;
    menuPanel.hidden = true;
    menuPanel.replaceChildren();
    for (const cell of rail.querySelectorAll("[data-menu-id]")) cell.setAttribute("aria-expanded", "false");
  }

  function entryButton(entry) {
    // Two lines: the original entry name, then what it is for, so Hunt,
    // Battle and Shop can be found without knowing the menus by heart.
    const button = element("button", "cm-toolbar__entry");
    button.append(element("span", "cm-toolbar__entry-label", entry.label));
    if (entry.hint) button.append(element("span", "cm-toolbar__entry-hint", entry.hint));
    button.setAttribute("aria-label", uiText(entry.label));
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.dataset.entryId = entry.id;
    const reachable = Boolean(entry.screen || entry.action);
    button.disabled = !reachable;
    if (!reachable) {
      // The original has this destination; this build has not made it yet.
      button.dataset.state = "NOT_IMPLEMENTED";
      button.title = uiText("In the original, not yet in this build");
    }
    button.addEventListener("click", () => {
      closeMenu();
      onMenuEntry(entry);
    });
    return button;
  }

  function openMenu(menu) {
    if (openMenuId === menu.id) { closeMenu(); return; }
    openMenuId = menu.id;
    menuPanel.replaceChildren();
    menuPanel.dataset.menuId = menu.id;
    const byId = new Map([...menu.entries, ...(TOOLBAR_PRODUCT_ENTRIES[menu.id] ?? [])].map((entry) => [entry.id, entry]));
    const placed = new Set();
    for (const group of TOOLBAR_MENU_GROUPS[menu.id] ?? []) {
      const entries = group.entries.map((id) => byId.get(id)).filter(Boolean);
      if (!entries.length) continue;
      const block = element("div", "cm-toolbar__group");
      block.setAttribute("role", "group");
      block.dataset.group = group.id;
      if (group.prominent) block.dataset.prominent = "true";
      if (group.separate) block.dataset.separate = "true";
      if (group.title) {
        // "menu" context: 「資料」 here is the reference shelf, not the Data attribute.
        const title = element("p", "cm-toolbar__group-title");
        title.textContent = uiText(group.title, { context: "menu" });
        title.setAttribute("aria-hidden", "true");
        block.setAttribute("aria-label", uiText(group.title, { context: "menu" }));
        block.append(title);
      }
      const list = element("div", "cm-toolbar__group-entries");
      for (const entry of entries) { list.append(entryButton(entry)); placed.add(entry.id); }
      block.append(list);
      menuPanel.append(block);
    }
    for (const entry of byId.values()) if (!placed.has(entry.id)) menuPanel.append(entryButton(entry));
    menuPanel.hidden = false;
    for (const cell of rail.querySelectorAll("[data-menu-id]")) {
      cell.setAttribute("aria-expanded", String(cell.dataset.menuId === menu.id));
    }
  }

  function selectTool(toolId) {
    selectedTool = selectedTool === toolId ? null : toolId;
    for (const cell of rail.querySelectorAll("[data-tool-id]")) {
      cell.setAttribute("aria-pressed", String(cell.dataset.toolId === selectedTool));
    }
    bar.dataset.selectedTool = selectedTool ?? "";
    paintToolHint();
    onToolChange?.(selectedTool);
  }

  // Six care tools then the management and system menus.
  const cells = [
    ...TOOLBAR_TOOLS.map((tool) => ({ kind: "tool", tool })),
    ...TOOLBAR_MENUS.map((menu) => ({ kind: "menu", menu }))
  ];
  cells.forEach((cell, index) => {
    const button = element("button", "cm-toolbar__cell");
    button.type = "button";
    button.dataset.cellIndex = String(index);
    button.dataset.slotMapping = TOOLBAR_SLOT_MAPPING_EVIDENCE;
    // The original's rail is eight icon discs, not eight words. The art is the
    // approved toolbar cell set; `data-icon` names which one, and the skin
    // paints it. The label stays in the DOM for assistive technology.
    button.dataset.icon = cell.kind === "tool"
      ? cell.tool.id
      : (cell.menu.id === "MANAGEMENT" ? "manage" : "system");
    if (cell.kind === "tool") {
      button.dataset.toolId = cell.tool.id;
      button.setAttribute("aria-pressed", "false");
      button.title = uiText(cell.tool.hint);
      button.append(element("span", "cm-toolbar__cell-label", cell.tool.label));
      button.addEventListener("click", () => { closeMenu(); selectTool(cell.tool.id); });
    } else {
      button.dataset.menuId = cell.menu.id;
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      button.append(element("span", "cm-toolbar__cell-label", cell.menu.label));
      button.addEventListener("click", () => openMenu(cell.menu));
    }
    rail.append(button);
  });

  bar.append(menuPanel, rail, toolHint);
  root.append(bar);
  function paintToolHint() {
    const tool = TOOLBAR_TOOLS.find((entry) => entry.id === selectedTool) ?? null;
    toolHint.hidden = !tool;
    toolName.textContent = uiText(tool?.label ?? "");
    toolText.textContent = uiText(tool?.hint ?? "");
    const body = root.ownerDocument?.body ?? null;
    if (body?.dataset) {
      if (tool) body.dataset.tool = tool.id; else delete body.dataset.tool;
    }
  }
  toolDone.addEventListener("click", () => { if (selectedTool) selectTool(selectedTool); });
  // An open menu closes on Escape (focus returns to its button) or on a press
  // anywhere outside the toolbar; the press itself still reaches its target.
  const ownerDocument = root.ownerDocument ?? globalThis.document;
  function onMenuKey(event) {
    if (event.key !== "Escape" || openMenuId === null) return;
    const opener = rail.querySelector?.(`[data-menu-id="${openMenuId}"]`);
    closeMenu();
    opener?.focus?.();
  }
  function onOutsidePress(event) {
    if (openMenuId === null || bar.contains?.(event.target)) return;
    closeMenu();
  }
  ownerDocument?.addEventListener?.("keydown", onMenuKey);
  ownerDocument?.addEventListener?.("pointerdown", onOutsidePress, true);
  function refreshFoodStock() {
    const stock=getFoodStock();
    for(const id of ['feed','protein','medicine','woundMedicine']) {
      const button=rail.querySelector(`[data-tool-id="${id}"]`);if(!button)continue;
      let amount=button.querySelector('.cm-toolbar__stock');
      if(!amount){amount=element('span','cm-toolbar__stock');button.append(amount);}
      amount.hidden=currentMode!==TOOLBAR_MODES.TRAINING||!Number.isInteger(stock?.[id]);
      amount.textContent=uiText(Number.isInteger(stock?.[id])?String(stock[id]):'');
      button.dataset.owned=amount.textContent;
    }
  }
  const unsubscribeInventory=subscribeInventory?.(refreshFoodStock);

  const host = root.ownerDocument?.body ?? document.body;
  let disposed = false;
  let measuredHeight = null;
  function syncHeight() {
    if (disposed) return;
    // Only the rail occupies layout space. The submenu overlays the field.
    // The border box includes the rail's safe-area padding exactly once.
    // Reserve layout pixels; the portrait frame scales the whole UI afterwards.
    const height = bar.hidden ? 0 : Math.ceil(rail.offsetHeight ?? rail.getBoundingClientRect().height);
    if (height === measuredHeight) return;
    measuredHeight = height;
    host.style.setProperty("--cm-toolbar-height", `${height}px`);
  }
  syncHeight();
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(syncHeight) : null;
  resizeObserver?.observe(rail, { box: "border-box" });
  const windowHost = root.ownerDocument?.defaultView;
  if (!resizeObserver) windowHost?.addEventListener("resize", syncHeight);

  return Object.freeze({
    element: bar,

    /** Mode 1 for Training, mode 2 for Hunt, null to hide the bar entirely. */
    setMode(mode) {
      if (disposed) return;
      const visible = mode === TOOLBAR_MODES.TRAINING || mode === TOOLBAR_MODES.HUNT;
      if (!visible || currentMode !== mode) closeMenu();
      if (currentMode !== mode) {
        selectedTool = null;
        bar.dataset.selectedTool = "";
        paintToolHint();
        onToolChange?.(null);
      }
      currentMode = mode;
      // Hunt command-to-slot dispatch is untraced. Do not carry Raising care
      // tools or its menus into this context. Preserve the eight neutral slots.
      for (const button of rail.querySelectorAll("[data-cell-index]")) {
        const cell = cells[Number(button.dataset.cellIndex)];
        const hunt = mode === TOOLBAR_MODES.HUNT;
        button.disabled = hunt;
        button.querySelector(".cm-toolbar__cell-label").textContent = uiText(hunt ? "—" : (cell.tool?.label ?? cell.menu.label));
        button.title = uiText(hunt ? "In the original, not yet in this build" : (cell.tool?.hint ?? ""));
        if (cell.tool) button.setAttribute("aria-pressed", String(cell.tool.id === selectedTool));
      }
      bar.hidden = !visible;
      bar.dataset.mode = visible ? String(mode) : "";
      host.dataset.toolbar = visible ? "on" : "";
      refreshFoodStock();
      syncHeight();
    },

    getSelectedTool() {
      return selectedTool;
    },

    /** Re-apply every label in the current language (after a language switch). */
    relabel() {
      if (disposed) return;
      rail.setAttribute("aria-label", uiText("Contextual toolbar"));
      toolDone.textContent = uiText("完成");
      const hunt = currentMode === TOOLBAR_MODES.HUNT;
      for (const button of rail.querySelectorAll("[data-cell-index]")) {
        const cell = cells[Number(button.dataset.cellIndex)];
        button.querySelector(".cm-toolbar__cell-label").textContent = uiText(hunt ? "—" : (cell.tool?.label ?? cell.menu.label));
        button.title = uiText(hunt ? "In the original, not yet in this build" : (cell.tool?.hint ?? ""));
      }
      paintToolHint();
      const open = TOOLBAR_MENUS.find((menu) => menu.id === openMenuId);
      if (open) { openMenuId = null; openMenu(open); }
      syncHeight();
    },

    getOpenMenuId() { return openMenuId; },

    closeMenu,

    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeInventory?.();
      resizeObserver?.disconnect();
      if (!resizeObserver) windowHost?.removeEventListener("resize", syncHeight);
      closeMenu();
      ownerDocument?.removeEventListener?.("keydown", onMenuKey);
      ownerDocument?.removeEventListener?.("pointerdown", onOutsidePress, true);
      delete host.dataset.toolbar;
      host.style.removeProperty("--cm-toolbar-height");
      bar.remove();
    }
  });
}
