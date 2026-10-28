import { createTransientHint, TOOL_HINT_MS } from './transientHint.js';
import {isOriginalUiIntakeLocal,originalToolbarArt,originalDatabaseIcon} from "../presentation/completedOriginalUi20261007.js";
import {isOriginalRuntimeLocation} from "../presentation/originalRuntimeLocation.js";
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
      { id: "database", label: "Database", screen: "DATABASE", hint: "已登錄的夥伴" },
      { id: "hunt", label: "Hunt", screen: "GATE_SELECT", hint: "前往傳送門捕捉夥伴" },
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
    // Owner 2026-10-27: the bag shows what the shop and the partners' walks put in it.
    Object.freeze({ id: "backpack", label: "背包", action: "OPEN_BACKPACK", hint: "道具、用品與探索發現", evidence: "OWNER_APPROVED_ADAPTATION_20261027" }),
    Object.freeze({ id: "journal", label: "探索手帳", action: "OPEN_RANCH_JOURNAL", hint: "夥伴散步找到的東西", evidence: "OWNER_APPROVED_ADAPTATION_20261027" }),
    // Owner 2026-10-28: the story theater's rift chapters, from the System menu as well as the ranch badge.
    Object.freeze({ id: "story", label: "STORY_MENU", action: "OPEN_STORY", hint: "STORY_MENU_HINT", evidence: "OWNER_APPROVED_ADAPTATION_20261028" }),
    // Owner 2026-10-28: friends & tamer card, and account & cloud sync (championshipCloudService; local simulation until a cloud is configured).
    Object.freeze({ id: "friends", label: "FRIENDS_MENU", action: "OPEN_FRIENDS", hint: "FRIENDS_MENU_HINT", evidence: "OWNER_APPROVED_ADAPTATION_20261028" }),
    Object.freeze({ id: "account", label: "ACCOUNT_MENU", action: "OPEN_ACCOUNT", hint: "ACCOUNT_MENU_HINT", evidence: "OWNER_APPROVED_ADAPTATION_20261028" }),
    Object.freeze({ id:"medals", label:"徽章收藏", screen:"MEDALS", hint:"61 場頭銜賽的勝利紀錄", originalRuntimeOnly:true, evidence:"OWNER_APPROVED_ADAPTATION_20261007" }),
    Object.freeze({ id: "settings", label: "Settings", action: "OPEN_SETTINGS", hint: "主題、畫質、聲音與語言", evidence: "PRODUCT_AUTHORED" })
  ])
});

// This gate admits only explicitly marked approved-runtime entries. Other
// local-only experiments retain the original loopback restriction.
export function toolbarProductEntryAvailable(entry,baseUrl=globalThis.location?.href){
  if(entry.originalRuntimeOnly)return isOriginalRuntimeLocation(baseUrl);
  return !entry.localOnly||isOriginalUiIntakeLocal(baseUrl);
}

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
  // Owner 2026-10-27: while the dock shows Hunt, Battle, Shop and Database the
  // menu does not repeat them (see TOOLBAR_QUICK_ENTRIES); a tutorial, which
  // hides the dock, still finds them here.
  SYSTEM: Object.freeze([
    Object.freeze({ id: "go", title: "出發", entries: Object.freeze(["hunt", "battle", "shop"]), prominent: true }),
    Object.freeze({ id: "items", title: "背包與收藏", entries: Object.freeze(["backpack", "journal", "story", "medals", "database"]) }),
    Object.freeze({ id: "session", title: "系統", entries: Object.freeze(["friends", "account", "help", "settings", "saveQuit"]), separate: true })
  ])
});

/**
 * The arcade dock's one-tap destinations (OWNER_APPROVED_ADAPTATION of presentation,
 * 2026-10-26: the arcade rebuild's layout on this game). They are the observed System
 * entries themselves, built by the same entry button, so reachability, tutorial
 * gating and dispatch are the menu's own. The eight-slot rail is unchanged.
 */
export const TOOLBAR_QUICK_ENTRIES = Object.freeze(["hunt", "battle", "shop", "database"]);

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
export function createChampionshipToolbar({ responsiveLayout = false, root, onMenuEntry, onToolChange, getFoodStock=()=>null, subscribeInventory=null, getTutorialCheckpoint=()=>null, menuExtras = null } = {}) {
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

  // Briefly explain a newly selected care tool. The selected rail button is
  // always a toggle/exit, including after this visual instruction fades.
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

  let disposed = false;
  let currentMode = null;
  let selectedTool = null;
  let tutorialTool = null;
  let tutorialAutoSelect=true,tutorialKey=null,tutorialMenuEntry="hunt";
  let toolBeforeTutorial = null;
  let openMenuId = null;
  // Owner 2026-10-29: product extras at the foot of a submenu ({ element, dispose }), e.g. the
  // System menu's passport strip and community dock. Never during a tutorial.
  let menuExtrasHandle = null;

  function closeMenu() {
    openMenuId = null;
    menuExtrasHandle?.dispose?.(); menuExtrasHandle = null;
    menuPanel.hidden = true;
    menuPanel.replaceChildren();
    for (const cell of rail.querySelectorAll("[data-menu-id]")) cell.setAttribute("aria-expanded", "false");
  }

  function entryButton(entry, className = "cm-toolbar__entry") {
    // Two lines: the original entry name, then what it is for, so Hunt,
    // Battle and Shop can be found without knowing the menus by heart.
    const button = element("button", className);
    const art=originalDatabaseIcon(entry.screen);
    if(art){const icon=element("img","cm-toolbar__entry-icon");icon.src=art.src;icon.alt="";button.append(icon);}
    button.append(element("span", "cm-toolbar__entry-label", entry.label));
    if (entry.hint) button.append(element("span", "cm-toolbar__entry-hint", entry.hint));
    button.setAttribute("aria-label", uiText(entry.label));
    button.type = "button";
    if (className === "cm-toolbar__entry") button.setAttribute("role", "menuitem");
    // Dock keys carry their own id, so a query for a menu entry finds only the menu's.
    if (className === "cm-toolbar__entry") button.dataset.entryId = entry.id;
    else button.dataset.quickId = entry.id;
    const reachable = Boolean(entry.screen || entry.action);
    button.disabled = !reachable || (tutorialTool!==null&&!(tutorialTool==="SYSTEM"&&entry.id===tutorialMenuEntry));
    const tutorialCheckpoint=getTutorialCheckpoint();
    if (!reachable) {
      // The original has this destination; this build has not made it yet.
      button.dataset.state = "NOT_IMPLEMENTED";
      button.title = uiText("In the original, not yet in this build");
    }
    button.addEventListener("click", () => {
      closeMenu();
      if(button.disabled)return;
      onMenuEntry(entry,{checkpoint:tutorialCheckpoint});
    });
    return button;
  }

  function openMenu(menu) {
    if(tutorialTool!==null&&!(tutorialTool==="SYSTEM"&&menu.id==="SYSTEM"))return;
    if (openMenuId === menu.id) { closeMenu(); return; }
    openMenuId = menu.id;
    menuPanel.replaceChildren();
    menuPanel.dataset.menuId = menu.id;
    // One button per destination: what the shown dock offers is not repeated.
    const docked = new Set(syncDock() ? TOOLBAR_QUICK_ENTRIES : []);
    const byId = new Map([...menu.entries, ...(TOOLBAR_PRODUCT_ENTRIES[menu.id] ?? []).filter(entry=>toolbarProductEntryAvailable(entry))]
      .filter((entry) => !docked.has(entry.id)).map((entry) => [entry.id, entry]));
    const head = element("div", "cm-toolbar__menu-head");
    head.append(element("p", "cm-toolbar__menu-title", menu.label));
    menuPanel.append(head);
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
    menuExtrasHandle?.dispose?.(); menuExtrasHandle = null;
    if (typeof menuExtras === "function" && tutorialTool === null) {
      try { menuExtrasHandle = menuExtras(menu.id, { close: closeMenu }) ?? null; } catch (error) { console.warn(`TOOLBAR_MENU_EXTRAS: ${error.message}`); menuExtrasHandle = null; }
      if (menuExtrasHandle?.element) menuPanel.append(menuExtrasHandle.element);
    }
    menuPanel.hidden = false;
    for (const cell of rail.querySelectorAll("[data-menu-id]")) {
      cell.setAttribute("aria-expanded", String(cell.dataset.menuId === menu.id));
    }
  }

  function selectTool(toolId,context={}) {
    if(disposed||tutorialTool==="SYSTEM")return;
    selectedTool = tutorialTool ?? (selectedTool === toolId ? null : toolId);
    for (const cell of rail.querySelectorAll("[data-tool-id]")) {
      cell.setAttribute("aria-pressed", String(cell.dataset.toolId === selectedTool));
    }
    bar.dataset.selectedTool = selectedTool ?? "";
    paintToolHint({ restart: true });
    onToolChange?.(selectedTool,context);
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
    // `data-icon` names the slot. Local candidate art uses the same binding
    // for tools and menus; the label stays in the DOM for assistive technology.
    button.dataset.icon = cell.kind === "tool"
      ? cell.tool.id
      : (cell.menu.id === "MANAGEMENT" ? "manage" : "system");
    const art=originalToolbarArt(button.dataset.icon);
    if(art){button.dataset.originalIntake="true";button.style.setProperty("--original-intake-icon",`url("${new URL(art.src,document.baseURI).href}")`);}
    if (cell.kind === "tool") {
      button.dataset.toolId = cell.tool.id;
      button.setAttribute("aria-pressed", "false");
      button.title = uiText(cell.tool.hint);
      button.append(element("span", "cm-toolbar__cell-label", cell.tool.label));
      let gestureCheckpoint=null;
      button.addEventListener("pointerdown",()=>{gestureCheckpoint=getTutorialCheckpoint();});
      button.addEventListener("click", () => {
        const checkpoint=gestureCheckpoint??getTutorialCheckpoint();gestureCheckpoint=null;
        if(button.disabled)return;closeMenu();selectTool(cell.tool.id,{userInitiated:true,checkpoint});
      });
    } else {
      button.dataset.menuId = cell.menu.id;
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      button.append(element("span", "cm-toolbar__cell-label", cell.menu.label));
      button.addEventListener("click", () => openMenu(cell.menu));
    }
    rail.append(button);
  });

  // Quick dock: shown with the Training rail only, and never during a tutorial
  // step, which keeps guiding the player through the System menu itself.
  const quick = element("div", "cm-toolbar__quick");
  quick.setAttribute("role", "group");
  quick.hidden = true;
  function paintQuick() {
    if (disposed) return;
    const system = TOOLBAR_MENUS.find((menu) => menu.id === "SYSTEM");
    quick.setAttribute("aria-label", uiText("出發"));
    quick.replaceChildren(...TOOLBAR_QUICK_ENTRIES
      .map((id) => system.entries.find((entry) => entry.id === id))
      .filter(Boolean)
      .map((entry) => entryButton(entry, "cm-toolbar__quick-entry")));
    quick.hidden = currentMode !== TOOLBAR_MODES.TRAINING || tutorialTool !== null;
    syncDock();
  }
  // A shown dock key is that entry's only button (the menu omits it), so it
  // carries the entry id the menu's button would; a dock that is hidden, or
  // not drawn by the theme (only the arcade sheet shows it), gives it back.
  function syncDock() {
    const rects = typeof quick.getClientRects === "function" ? quick.getClientRects() : null;
    const shown = !quick.hidden && (rects === null || rects.length > 0);
    for (const button of quick.children) {
      if (shown) button.dataset.entryId = button.dataset.quickId;
      else delete button.dataset.entryId;
    }
    return shown;
  }

  // Appended last: the menu, rail and hint keep their order; the arcade sheet draws the dock above the rail.
  bar.append(menuPanel, rail, toolHint, quick);
  root.append(bar);
  let hintedTool = null;
  function syncToolHintClearance() {
    if (disposed) return;
    const body = root.ownerDocument?.body;
    const height = bar.hidden || toolHint.hidden ? 0 : Math.ceil(toolHint.offsetHeight ?? 0);
    body?.style.setProperty('--cm-tool-hint-clearance', `${height > 0 ? height + 8 : 0}px`);
  }
  const toolHintTimer = createTransientHint(toolHint, { onPhaseChange: syncToolHintClearance, beforeHide() {
    // Never leave keyboard focus inside an inert/hidden Done button.
    if (toolHint.contains?.(root.ownerDocument?.activeElement)) {
      rail.querySelector(`[data-tool-id="${selectedTool ?? hintedTool}"]`)?.focus?.();
    }
  } });
  function paintToolHint({ restart = false } = {}) {
    const tool = TOOLBAR_TOOLS.find((entry) => entry.id === selectedTool) ?? null;
    if (!tool) { toolHintTimer.hide(); hintedTool = null; }
    else if (restart) { hintedTool = tool.id; toolHintTimer.show(TOOL_HINT_MS); }
    for (const cell of rail.querySelectorAll("[data-tool-id]")) {
      const entry = TOOLBAR_TOOLS.find(item => item.id === cell.dataset.toolId);
      const canPutDown = entry?.id === selectedTool && tutorialTool === null;
      cell.setAttribute('aria-label', `${uiText(entry.label)}${canPutDown ? ` · ${uiText('完成')}` : ''}`);
    }
    toolName.textContent = uiText(tool?.label ?? "");
    toolText.textContent = uiText(tool?.hint ?? "");
    syncToolHintClearance();
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
  // A stroll find flies to its tool (Owner 2026-10-28): the badge keeps the old
  // number until the item lands, then counts up with a +1. The inventory itself
  // was already saved; only the display waits.
  const stockFlights=new Map();
  function refreshFoodStock() {
    const stock=getFoodStock();
    for(const id of ['feed','protein','medicine','woundMedicine']) {
      const button=rail.querySelector(`[data-tool-id="${id}"]`);if(!button)continue;
      let amount=button.querySelector('.cm-toolbar__stock');
      if(!amount){amount=element('span','cm-toolbar__stock');button.append(amount);}
      if(stockFlights.has(id))continue;
      amount.hidden=currentMode!==TOOLBAR_MODES.TRAINING||!Number.isInteger(stock?.[id]);
      amount.textContent=uiText(Number.isInteger(stock?.[id])?String(stock[id]):'');
      button.dataset.owned=amount.textContent;
    }
  }
  const unsubscribeInventory=subscribeInventory?.(refreshFoodStock);

  const host = root.ownerDocument?.body ?? document.body;
  const measureTarget = responsiveLayout ? bar : rail;
  let measuredHeight = null;
  function syncHeight() {
    if (disposed) return;
    syncToolHintClearance();
    // Hint and menus are absolute overlays. Measure only the dock budget
    // in both orientations; fading never resizes the playable field.
    // The border box includes the rail's safe-area padding exactly once.
    // Reserve layout pixels; the portrait frame scales the whole UI afterwards.
    const height = bar.hidden ? 0 : Math.ceil(measureTarget.offsetHeight ?? measureTarget.getBoundingClientRect().height);
    if (height === measuredHeight) return;
    measuredHeight = height;
    host.style.setProperty("--cm-toolbar-height", `${height}px`);
  }
  syncHeight();
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(syncHeight) : null;
  resizeObserver?.observe(measureTarget, { box: "border-box" });
  // Hint text may wrap after a language, viewport or text-scale change. Its
  // own box reserves a separate lane, never inflating the dock/field budget.
  const hintResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(syncToolHintClearance) : null;
  hintResizeObserver?.observe(toolHint, { box: 'border-box' });
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
        selectedTool = mode===TOOLBAR_MODES.TRAINING&&tutorialAutoSelect&&tutorialTool!=="SYSTEM"?tutorialTool:null;
        bar.dataset.selectedTool = selectedTool??"";
        paintToolHint({ restart: true });
        onToolChange?.(selectedTool);
      }
      currentMode = mode;
      // Hunt command-to-slot dispatch is untraced. Do not carry Raising care
      // tools or its menus into this context. Preserve the eight neutral slots.
      for (const button of rail.querySelectorAll("[data-cell-index]")) {
        const cell = cells[Number(button.dataset.cellIndex)];
        const hunt = mode === TOOLBAR_MODES.HUNT;
        button.disabled = hunt || (tutorialTool!==null && (tutorialTool==="SYSTEM"?cell.menu?.id!=="SYSTEM":cell.tool?.id!==tutorialTool));
        button.querySelector(".cm-toolbar__cell-label").textContent = uiText(hunt ? "—" : (cell.tool?.label ?? cell.menu.label));
        button.title = uiText(hunt ? "In the original, not yet in this build" : (cell.tool?.hint ?? ""));
        if (cell.tool) button.setAttribute("aria-pressed", String(cell.tool.id === selectedTool));
      }
      bar.hidden = !visible;
      bar.dataset.mode = visible ? String(mode) : "";
      host.dataset.toolbar = visible ? "on" : "";
      refreshFoodStock();
      paintQuick();
      syncHeight();
    },

    getSelectedTool() {
      return selectedTool;
    },

    /** The tool button a stroll find flies to, or null when it is not shown. */
    getToolButton(toolId) {
      const button=rail.querySelector(`[data-tool-id="${toolId}"]`);
      return button&&!bar.hidden?button:null;
    },
    holdToolStock(toolId) {
      stockFlights.set(toolId,(stockFlights.get(toolId)??0)+1);
    },
    /** Release the held badge: count up, bounce the key and float the gain. */
    landToolStock(toolId,{gained=1}={}) {
      const left=(stockFlights.get(toolId)??1)-1;
      if(left>0)stockFlights.set(toolId,left);else stockFlights.delete(toolId);
      refreshFoodStock();
      const button=rail.querySelector(`[data-tool-id="${toolId}"]`);if(!button||disposed)return;
      button.classList.remove('is-stock-landed');void button.offsetWidth;button.classList.add('is-stock-landed');
      const plus=element('span','cm-toolbar__stock-gain',`+${gained}`);plus.setAttribute('aria-hidden','true');button.append(plus);
      plus.addEventListener('animationend',()=>plus.remove(),{once:true});setTimeout(()=>plus.remove(),1600);
      button.addEventListener('animationend',event=>{if(event.target===button)button.classList.remove('is-stock-landed');},{once:true});
    },

    // Display/input constraint for an app-owned tutorial step; no gameplay
    // predicate or progression lives here. Restore the prior tool on exit.
    setTutorialTool(toolId,{select=true,key=null,menuEntry="hunt"}={}) {
      if(disposed||toolId===tutorialTool&&select===tutorialAutoSelect&&key===tutorialKey)return;
      if(toolId!==null&&toolId!=="SYSTEM"&&!TOOLBAR_TOOLS.some(tool=>tool.id===toolId))
        throw new TypeError("UNKNOWN_TUTORIAL_TOOL");
      if(tutorialTool===null)toolBeforeTutorial=selectedTool;
      tutorialTool=toolId;tutorialAutoSelect=select;tutorialKey=key;tutorialMenuEntry=menuEntry;toolDone.hidden=tutorialTool!==null;
      if(toolId!==null){closeMenu();if(select&&toolId!=="SYSTEM")selectTool(toolId);else{selectedTool=null;bar.dataset.selectedTool="";paintToolHint();onToolChange?.(null);}}
      else {
        const restored=toolBeforeTutorial;toolBeforeTutorial=null;
        selectedTool=null;
        if(restored!==null)selectTool(restored);
        else {bar.dataset.selectedTool="";paintToolHint();onToolChange?.(null);}
      }
      for(const button of rail.querySelectorAll("[data-cell-index]")){
        button.disabled=currentMode===TOOLBAR_MODES.HUNT || (tutorialTool!==null&&(tutorialTool==="SYSTEM"?button.dataset.menuId!=="SYSTEM":button.dataset.toolId!==tutorialTool));
        if(button.dataset.toolId)button.setAttribute("aria-pressed",String(button.dataset.toolId===selectedTool));
      }
      paintQuick();
      syncHeight();
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
      paintQuick();
      syncHeight();
    },

    getOpenMenuId() { return openMenuId; },

    closeMenu,

    dispose() {
      if (disposed) return;
      disposed = true;
      toolHintTimer.dispose();
      delete host.dataset.tool;
      unsubscribeInventory?.();
      resizeObserver?.disconnect();
      hintResizeObserver?.disconnect();
      if (!resizeObserver) windowHost?.removeEventListener("resize", syncHeight);
      closeMenu();
      ownerDocument?.removeEventListener?.("keydown", onMenuKey);
      ownerDocument?.removeEventListener?.("pointerdown", onOutsidePress, true);
      delete host.dataset.toolbar;
      host.style.removeProperty("--cm-toolbar-height");
      host.style.removeProperty("--cm-tool-hint-clearance");
      bar.remove();
    }
  });
}
