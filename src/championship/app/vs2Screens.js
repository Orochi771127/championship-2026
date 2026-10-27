import { uiText } from "../text/uiText.js";
import { shopGoodsPresentation, huntToolIconPresentation } from '../presentation/shopGoodsUiArt.js';
import { getHuntCatalogItem } from '../hunt/loadout/huntEquipmentCatalog.js';
import { playCeremony, ceremonyEnvironment, CEREMONY_TIMING } from '../presentation/ceremony/ceremonyRunner.js';
import { mountLoadingWalker } from './ui/loadingWalker.js';
import { mountAmbience, ambienceTheme } from './ui/ambienceLayer.js';
import { buildGateEntry, buildCapture } from '../presentation/ceremony/ceremonyScenes.js';
import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from './vs2PresentationAuthority.js';
export { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from './vs2PresentationAuthority.js';
// VS2-P -- Championship Modern P1R presentation for Gate Select, Hunt Loadout
// and the Hunt HUD.
//
// This module consumes only the injected VS2 presentation source. It owns no
// screen lifecycle, gameplay state, field logic, save data, Pixi bootstrap or
// ticker. Every action below is one of the intents published by
// VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

function appendEquipmentIcon(button, itemId) {
  const art = shopGoodsPresentation(getHuntCatalogItem(itemId)?.shopRecordIndex);
  if (!art?.src) return;
  const image = element('img', 'cm-vs2-loadout__icon');
  image.src = art.src; image.alt = ''; image.loading = 'lazy';
  button.append(image);
  button.dataset.hasArt = 'true';
}

function renderHuntTool(button, tool, label = uiText(tool.label)) {
  let copy = button.querySelector('.cm-hunt-tools__label');
  if (!copy) {
    copy = element('span', 'cm-hunt-tools__label');
    button.replaceChildren(copy);
  }
  copy.textContent = label;
  const art = huntToolIconPresentation(tool);
  let image = button.querySelector('.cm-hunt-tools__icon');
  if (!art?.src) {
    image?.remove();
    button.dataset.hasToolArt = 'false';
    return;
  }
  if (!image) {
    image = element('img', 'cm-hunt-tools__icon');
    image.alt = ''; image.draggable = false;
    image.addEventListener('error', () => { image.hidden = true; button.dataset.hasToolArt = 'false'; });
    button.prepend(image);
  }
  if (image.getAttribute('src') !== art.src) {
    image.hidden = false;
    button.dataset.hasToolArt = 'true';
    image.src = art.src;
  }
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

function developerOnly(mode, text) {
  if (mode !== VS2_PRESENTATION_MODES.DEVELOPER) return null;
  return element("p", "cm-vs2-evidence", text);
}

function screenShell(root, { frame, kicker, title, subtitle, signal }) {
  const mode = presentationMode();
  root.replaceChildren();
  root.className = "cm-vs2-root";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.presentationMode = mode;
  root.dataset.screen = frame.screen;

  const shell = element("section", "cm-vs2-shell");
  shell.setAttribute("aria-label", uiText(title));
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", kicker),
    element("h1", "cm-vs2-title", title),
    element("p", "cm-vs2-subtitle", subtitle)
  );
  const status = element("div", "cm-vs2-signal", signal);
  status.setAttribute("aria-hidden", "true");
  header.append(copy, status);

  const body = element("div", "cm-vs2-body");
  const footer = element("footer", "cm-vs2-footer");
  shell.append(header, body, footer);
  root.append(shell);
  return { body, footer, mode };
}

function actionButton(label, { primary = false } = {}) {
  const button = element("button", `cm-vs2-action${primary ? " cm-vs2-action--primary" : ""}`, label);
  button.type = "button";
  return button;
}

function gateAdmissionMessage(admission) {
  if (admission?.reason === "GATE_LOCKED") return admission.unlockKind === 1
    ? uiText("馴獸師階級達到 {rank} 後開放。", { rank: admission.unlockParameter })
    : "取得對應比賽勝利後開放。";
  if (admission?.reason === "INSUFFICIENT_FUNDS") {
    return uiText("持有金額不足，入場需要 {bits} 位元幣。", { bits: admission.chargeBits });
  }
  return "";
}

/** Eight verified shell positions with zero invented meaning. */
function toolbarShell(toolbar, mode) {
  const section = element("section", "cm-vs2-toolbar");
  section.setAttribute("aria-label", uiText("Unavailable contextual controls"));
  section.dataset.toolbarMode = String(toolbar.mode.value);
  section.dataset.assetFamily = toolbar.assetFamily.value;

  const heading = element("div", "cm-vs2-toolbar__heading");
  heading.append(element("span", "cm-vs2-kicker", "CONTEXT BAR"));
  if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
    heading.append(element("span", "cm-vs2-toolbar__evidence", `MODE ${toolbar.mode.value} · ROM VERIFIED`));
  }

  const rail = element("div", "cm-vs2-toolbar__rail");
  for (const slot of toolbar.slots) {
    const button = element("button", "cm-vs2-slot");
    button.type = "button";
    button.disabled = true;
    button.dataset.slot = String(slot.slot);
    button.dataset.state = slot.state;
    button.setAttribute("aria-label", uiText(`Unavailable field control ${slot.slot + 1}`));
    button.append(element("span", "cm-vs2-slot__cell"));
    if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
      button.append(element("span", "cm-vs2-slot__raw", `RAW_SLOT_${String(slot.slot).padStart(2, "0")}`));
    }
    rail.append(button);
  }

  section.append(heading, rail);
  const evidence = developerOnly(mode, "Commands, icons, submenu population, enable mask and slot 7 identity remain UNKNOWN_REQUIRES_TRACE.");
  if (evidence) section.append(evidence);
  return section;
}

export async function createGateSelectView({ root, source, mountWorld }) {
  const initial = source.getFrame();
  if (!initial?.gateSelect) throw new Error("CHAMPIONSHIP_GATE_SELECT_NOT_ACTIVE");
  const { body, footer, mode } = screenShell(root, {
    frame: initial,
    kicker: "HUNT",
    title: "選擇狩獵場",
    subtitle: initial.gateSelect.tutorial ? "選擇目的地" : "轉動地球，選擇要前往的場地。",
    signal: String(initial.gateSelect.gates.length)
  });
  body.classList.add("cm-vs2-body--gate");
  // Owner 2026-10-27 holo navigator: one screen, the globe on top with the chosen
  // destination's visor on its lower edge, a sideways cartridge carousel below.
  // Globe and carousel follow each other; the toggle shows every card at once.
  const GATE_LAYOUT = "HOLO_NAV_R1";
  root.dataset.gateLayout = GATE_LAYOUT;

  const worldPanel = element("section", "cm-vs2-gate3d");
  worldPanel.dataset.sceneAuthority = "ORIGINAL_CREATED_2026_GATE_WORLD";
  const worldBar = element("div", "cm-vs2-gate3d__bar");
  const worldCopy = element("div", "cm-vs2-gate3d__bar-copy");
  worldCopy.append(
    element("span", "cm-vs2-kicker", "WORLD MODE"),
    element("strong", "cm-vs2-gate3d__bar-title", "16 BIOME LINKS")
  );
  const dragHint = element("p", "cm-vs2-gate3d__hint", "拖曳轉動 · 輕觸地點選擇");

  const viewToggle = actionButton("場地列表");
  viewToggle.classList.add("cm-vs2-gate3d__toggle");
  viewToggle.setAttribute("aria-pressed", "false");
  worldBar.append(worldCopy, viewToggle);
  const worldHost = element("div", "cm-vs2-gate3d__host");
  worldHost.append(dragHint);
  worldHost.dataset.cameraAuthority = "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER";
  worldPanel.append(worldBar, worldHost);

  const preview = element("section", "cm-vs2-preview");
  preview.setAttribute("aria-label", uiText("狩獵場資訊"));
  const previewImage = element("img", "cm-vs2-preview__image");
  previewImage.alt = "";
  previewImage.hidden = true;
  const previewCopy = element("div", "cm-vs2-preview__copy");
  const previewName = element("strong", "cm-vs2-preview__name", "請選擇目的地");
  const previewId = element("span", "cm-vs2-preview__id", "");
  const previewHeading = element("div", "cm-vs2-preview__heading");
  previewHeading.append(previewName);
  previewCopy.append(previewHeading, previewId);
  const costs = element("dl", "cm-vs2-preview__costs");
  const fee = element("dd", "", "—");
  const wallet = element("dd", "", "—");
  costs.append(element("dt", "", "入場費"), fee, element("dt", "", "持有金額"), wallet);
  preview.append(previewImage, previewCopy, costs);
  const admissionStatus = element("span", "cm-vs2-status cm-vs2-gate-admission");
  admissionStatus.setAttribute("role", "status");

  const fallbackPanel = element("section", "cm-vs2-gate-fallback");
  const fallbackHeading = element("div", "cm-vs2-gate-fallback__heading");
  fallbackHeading.append(
    element("span", "cm-vs2-kicker", "選擇目的地")
  );
  const list = element("div", "cm-vs2-gates");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", uiText("Biome destinations"));
  // The carousel scrolls sideways: a wheel turns it, a mouse can drag it.
  list.addEventListener?.("wheel", (event) => {
    if (root.dataset.gatePresentation !== "THREE_BOUNDED_WORLD_MODE" || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    list.scrollLeft += event.deltaY;
  }, { passive: false });
  let carouselDrag = null;
  list.addEventListener?.("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    carouselDrag = { x: event.clientX, left: list.scrollLeft, moved: false };
  });
  list.addEventListener?.("pointermove", (event) => {
    if (!carouselDrag) return;
    const dx = event.clientX - carouselDrag.x;
    if (!carouselDrag.moved && Math.abs(dx) < 6) return;
    carouselDrag.moved = true;
    list.dataset.dragging = "true";
    list.scrollLeft = carouselDrag.left - dx;
  });
  const endCarouselDrag = () => { setTimeout(() => { delete list.dataset.dragging; }, 0); carouselDrag = null; };
  list.addEventListener?.("pointerup", endCarouselDrag);
  list.addEventListener?.("pointerleave", endCarouselDrag);
  list.addEventListener?.("click", (event) => { if (list.dataset.dragging === "true") { event.stopPropagation(); event.preventDefault(); } }, true);
  fallbackPanel.append(fallbackHeading, list);
  previewHeading.append(admissionStatus);
  body.append(preview, worldPanel, fallbackPanel);
  const evidence = developerOnly(mode, "16 biome identities and paired world_day/world_night structure are ROM_VERIFIED. Camera, rotation, input, hit-test, node placement and active preview state are PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER. Exact original display copy/order remain unclaimed.");
  if (evidence) body.append(evidence);

  const back = actionButton("返回牧場");
  // The button names where it goes next, not just the next screen's title.
  const confirm = actionButton("前往狩獵設定", { primary: true });
  footer.append(back, confirm);
  back.addEventListener("click", () => source.intents.leaveScreen());
  confirm.addEventListener("click", () => source.intents.confirmGate());
  const buttons = new Map();
  let worldPresentation = null;
  let worldFailure = null;
  let disposed = false;
  let fallbackVisible = initial.gateSelect.tutorial || mode === VS2_PRESENTATION_MODES.DEVELOPER;
  if(initial.gateSelect.tutorial){worldPanel.hidden=true;back.hidden=true;confirm.textContent=uiText("開始狩獵");}
  try {
    fallbackVisible ||= new URLSearchParams(globalThis.location?.search ?? "").get("gateMode") === "fallback";
  } catch { /* a URL parser failure must not block the default 3D attempt */ }

  function applyViewMode() {
    worldPanel.dataset.view = fallbackVisible ? "fallback" : "world";
    worldHost.hidden = fallbackVisible;
    dragHint.hidden = fallbackVisible;
    fallbackPanel.hidden = !fallbackVisible && root.dataset.gateLayout !== GATE_LAYOUT;
    viewToggle.textContent = uiText(fallbackVisible ? "返回地球" : "場地列表");
    viewToggle.setAttribute("aria-pressed", String(fallbackVisible));
    root.dataset.gatePresentation = fallbackVisible
      ? (worldFailure ? "LOW_CAPABILITY_FALLBACK" : "ACCESSIBILITY_FALLBACK")
      : "THREE_BOUNDED_WORLD_MODE";
  }

  async function ensureWorld() {
    if (disposed) return false;
    if (worldPresentation) return true;
    if (typeof mountWorld !== "function") {
      worldFailure = new Error("CHAMPIONSHIP_GATE_3D_MOUNTER_UNAVAILABLE");
      return false;
    }
    try {
      const mounted = await mountWorld({
        host: worldHost,
        gates: source.getFrame().gateSelect.gates,
        onSelect: (gateId) => source.intents.selectGate(gateId)
      });
      if (disposed) {
        mounted?.dispose?.();
        return false;
      }
      worldPresentation = mounted;
      worldFailure = null;
      worldPresentation.render(source.getFrame());
      return true;
    } catch (error) {
      worldFailure = error;
      console.warn(`CHAMPIONSHIP_GATE_3D_FALLBACK: ${error.message}`);
      return false;
    }
  }

  viewToggle.addEventListener("click", () => {
    void (async () => {
      if (!fallbackVisible) {
        fallbackVisible = true;
      } else {
        fallbackVisible = !(await ensureWorld());
      }
      applyViewMode();
    })();
  });

  let shownGateId = null;
  const reducedMotion = () => globalThis.document?.documentElement?.dataset.motion === "reduced"
    || Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  // Bring a card to the middle of the carousel (or, where the cards stack, of the
  // panel that scrolls them) without scrolling the page.
  function centreCard(button) {
    if (!button?.getBoundingClientRect || typeof list.scrollTo !== "function") return;
    const behavior = reducedMotion() ? "auto" : "smooth", card = button.getBoundingClientRect();
    if (list.scrollWidth > list.clientWidth + 1) {
      const box = list.getBoundingClientRect();
      list.scrollTo({ left: list.scrollLeft + card.left + card.width / 2 - (box.left + box.width / 2), behavior });
    } else if (fallbackPanel.scrollHeight > fallbackPanel.clientHeight + 1) {
      const box = fallbackPanel.getBoundingClientRect();
      fallbackPanel.scrollTo({ top: fallbackPanel.scrollTop + card.top + card.height / 2 - (box.top + box.height / 2), behavior });
    }
  }
  function render(frame) {
    const block = frame.gateSelect;
    if (!block) return;
    for (const gate of block.gates) {
      let button = buttons.get(gate.gateId);
      if (!button) {
        button = element("button", "cm-vs2-gate");
        button.type = "button";
        button.setAttribute("role", "option");
        button.dataset.gateId = gate.gateId;
        button.style.setProperty("--gate-phase", String((gate.ordinal - 1) % 8));
        const aperture = element("span", "cm-vs2-gate__aperture");
        aperture.setAttribute("aria-hidden", "true");
        // The card shows the destination's own map, like the rebuild's art cards.
        const thumbnail = gate.art?.thumbnail;
        if (thumbnail?.src) {
          const art = element("img", "cm-vs2-gate__art");
          art.alt = "";
          art.loading = "lazy";
          art.decoding = "async";
          art.src = thumbnail.src;
          aperture.append(art);
          button.dataset.hasArt = "true";
        }
        button.append(
          aperture,
          element("span", "cm-vs2-gate__ordinal", String(gate.ordinal).padStart(2, "0")),
          element("span", "cm-vs2-gate__name", gate.displayName),
          element("span", "cm-vs2-gate__fee")
        );
        button.addEventListener("click", () => source.intents.selectGate(gate.gateId));
        buttons.set(gate.gateId, button);
        list.append(button);
      }
      button.setAttribute("aria-selected", String(gate.selected));
      button.dataset.selected = String(gate.selected);
      const feeLabel = button.querySelector?.(".cm-vs2-gate__fee");
      if (feeLabel) feeLabel.textContent = Number.isSafeInteger(gate.entranceFeeBits) ? uiText("{bits} 位元幣", { bits: gate.entranceFeeBits }) : "";
      button.dataset.availability = gate.state;
      if (gate.selected) {
        previewName.textContent = uiText(gate.displayName);
        previewId.textContent = uiText(gate.codeString ?? "");
        fee.textContent = Number.isSafeInteger(gate.entranceFeeBits) ? uiText("{bits} 位元幣", { bits: gate.entranceFeeBits }) : "—";
        fee.dataset.free = String(gate.entranceFeeBits === 0);
        preview.dataset.ordinal = String(gate.ordinal).padStart(2, "0");
        preview.style.setProperty("--gate-phase", String((gate.ordinal - 1) % 8));
        const thumbnail = gate.art?.thumbnail;
        previewImage.hidden = !thumbnail;
        if (thumbnail) {
          if (previewImage.getAttribute('src') !== thumbnail.src) previewImage.src = thumbnail.src;
          previewImage.alt = uiText("{gate}・日間場地預覽", { gate: gate.displayName });
        } else previewImage.removeAttribute('src');
      }
    }
    // Globe and carousel follow each other: a new choice centres its card with a
    // jelly pop, turns the globe to it, and springs the visor in.
    const chosen = block.selection.gateId ?? null;
    if (chosen !== shownGateId) {
      const previous = shownGateId;
      shownGateId = chosen;
      preview.dataset.selected = String(Boolean(chosen));
      if (chosen) {
        const button = buttons.get(chosen);
        centreCard(button);
        if (button && previous !== null) { button.dataset.pop = "false"; void button.offsetWidth; button.dataset.pop = "true"; }
        if (previous !== null) { preview.dataset.pop = "false"; void preview.offsetWidth; preview.dataset.pop = "true"; }
        worldPresentation?.focus?.(chosen, { animate: previous !== null && !reducedMotion() });
      }
    }
    if (!block.selection.gateId) {
      previewName.textContent = uiText("請選擇目的地");
      previewId.textContent = uiText("");
      previewImage.hidden = true;
      previewImage.removeAttribute('src');
      fee.textContent = uiText("—");
      delete fee.dataset.free;
    }
    wallet.textContent = Number.isSafeInteger(block.walletBits) ? uiText("{bits} 位元幣", { bits: block.walletBits }) : "—";
    confirm.disabled = !block.canConfirm;
    admissionStatus.textContent = uiText(gateAdmissionMessage(block.admission));
    admissionStatus.hidden = !admissionStatus.textContent;
    admissionStatus.title = admissionStatus.textContent;
    admissionStatus.setAttribute("aria-label", admissionStatus.textContent);
    previewName.title = previewName.textContent;
    previewName.setAttribute("aria-label", previewName.textContent);
    worldPresentation?.render?.(frame);
  }

  if (!fallbackVisible && !(await ensureWorld())) fallbackVisible = true;
  applyViewMode();
  render(initial);
  return Object.freeze({
    render,
    inspect() {
      return Object.freeze({
        presentation: root.dataset.gatePresentation,
        fallbackReason: worldFailure?.message ?? null,
        world: worldPresentation?.getDiagnostics?.() ?? null
      });
    },
    dispose() {
      disposed = true;
      worldPresentation?.dispose?.();
      worldPresentation = null;
      buttons.clear();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
      delete root.dataset.gatePresentation;
      delete root.dataset.gateLayout;
    }
  });
}

/**
 * Hunt Loadout.
 *
 * Rebuilt for VS2-R2 onto the recovered original structure: five equipment
 * classes and four plugin positions over a Shop-owned inventory. The companion
 * picker this replaces was a prototype and is no longer on the Player Mode path.
 *
 * This is a NEUTRAL RUNTIME SHELL using the existing screen chrome. DOM screen UI
 * is Codex's lane; a P1R loadout family replaces this without a runtime change,
 * because it consumes only the published seam.
 */
export function createHuntLoadoutView({ root, source }) {
  const initial = source.getFrame();
  if (!initial?.huntLoadout) throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
  const { body, footer, mode } = screenShell(root, {
    frame: initial,
    kicker: "HUNT",
    title: "狩獵設定",
    subtitle: "選擇攜帶的工具與外掛。",
    signal: "01"
  });
  root.dataset.loadoutAuthority = "ORIGINAL_STRUCTURE_ROM_VERIFIED";

  const gatePlate = element("section", "cm-vs2-destination");
  gatePlate.append(element("span", "cm-vs2-kicker", "目的地"));
  const gateName = element("strong", "cm-vs2-destination__name");
  const gateFee = element("span", "cm-vs2-destination__fee");
  gatePlate.append(gateName, gateFee);

  const equipmentList = element("div", "cm-vs2-loadout");
  equipmentList.setAttribute("role", "group");
  equipmentList.setAttribute("aria-label", uiText("Equipment classes"));
  const pluginList = element("div", "cm-vs2-loadout");
  pluginList.setAttribute("role", "group");
  pluginList.setAttribute("aria-label", uiText("Plugin positions"));

  const entryStatus = element("p", "cm-vs2-status");
  entryStatus.setAttribute("role", "status");
  entryStatus.hidden = true;
  body.append(gatePlate, equipmentList, pluginList, entryStatus);
  const evidence = developerOnly(mode, "Five equipment classes and four plugin positions are ROM_VERIFIED. Native item and plugin effects use the existing Hunt runtime. The empty-loadout confirmation rule remains PRODUCT_AUTHORED; individual icon parity is incomplete.");
  if (evidence) body.append(evidence);

  const back = actionButton("返回選場");
  const begin = actionButton("開始狩獵", { primary: true });
  footer.append(back, begin);
  back.addEventListener("click", () => source.intents.leaveScreen());
  begin.addEventListener("click", () => { void source.intents.beginHunt(); });

  const classRows = new Map();
  const pluginRows = new Map();

  /** One row per recovered equipment class. Empty is empty, never disabled. */
  function renderClass(entry, selected) {
    let row = classRows.get(entry.equipmentClass);
    if (!row) {
      row = element("div", "cm-vs2-loadout__row");
      row.dataset.equipmentClass = entry.equipmentClass;
      const classNames = { ROPE: '繩索', SHOT: '射擊', WIRE: '鋼索', ENTRAP: '誘引道具', DAMAGE_TRAP: '傷害陷阱' };
      const label = element("span", "cm-vs2-loadout__label", classNames[entry.equipmentClass] ?? entry.equipmentClass.replace(/_/g, " "));
      const options = element("div", "cm-vs2-loadout__options");
      row.append(label, options);
      classRows.set(entry.equipmentClass, { row, options, buttons: new Map() });
      equipmentList.append(row);
      row = classRows.get(entry.equipmentClass);
    }
    if (entry.items.length === 0) {
      row.options.replaceChildren(element("span", "cm-vs2-loadout__empty", "尚未持有"));
      return;
    }
    for (const item of entry.items) {
      let button = row.buttons.get(item.itemId);
      if (!button) {
        button = element("button", "cm-vs2-loadout__option");
        button.type = "button";
        button.dataset.itemId = item.itemId;
        appendEquipmentIcon(button, item.itemId);
        button.append(element("span", "cm-vs2-loadout__name", item.displayName));
        // Quantity for the countable classes; durability for the rope.
        const detail = entry.countable
          ? `x${item.quantity}`
          : (item.durability === null ? "" : `${entry.statLabel} ${item.durability}`);
        if (detail) button.append(element("span", "cm-vs2-loadout__detail", detail));
        button.addEventListener("click", () => {
          const current = source.getFrame().huntLoadout.selectedEquipment
            .find((slot) => slot.equipmentClass === entry.equipmentClass);
          // Tapping the equipped item clears the class. Nothing must be equipped.
          source.intents.selectEquipment(entry.equipmentClass, current?.itemId === item.itemId ? null : item.itemId);
        });
        row.buttons.set(item.itemId, button);
        row.options.append(button);
      }
      const isSelected = selected?.itemId === item.itemId;
      button.dataset.selected = String(isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    }
  }

  function renderPlugins(block) {
    for (const position of block.selectedPlugins) {
      let row = pluginRows.get(position.position);
      if (!row) {
        row = element("div", "cm-vs2-loadout__row");
        row.dataset.pluginPosition = String(position.position);
        const label = element("span", "cm-vs2-loadout__label", uiText("外掛 {n}", { n: position.position + 1 }));
        const options = element("div", "cm-vs2-loadout__options");
        row.append(label, options);
        pluginRows.set(position.position, { row, options, buttons: new Map() });
        pluginList.append(row);
        row = pluginRows.get(position.position);
      }
      if (block.availablePlugins.length === 0) {
        row.options.replaceChildren(element("span", "cm-vs2-loadout__empty", "尚未持有"));
        continue;
      }
      for (const plugin of block.availablePlugins) {
        let button = row.buttons.get(plugin.itemId);
        if (!button) {
          button = element("button", "cm-vs2-loadout__option");
          button.type = "button";
          button.dataset.itemId = plugin.itemId;
          appendEquipmentIcon(button, plugin.itemId);
          button.append(element("span", "cm-vs2-loadout__name", plugin.displayName));
          button.addEventListener("click", () => {
            const current = source.getFrame().huntLoadout.selectedPlugins[position.position];
            source.intents.fitPlugin(position.position, current?.itemId === plugin.itemId ? null : plugin.itemId);
          });
          row.buttons.set(plugin.itemId, button);
          row.options.append(button);
        }
        const isFitted = position.itemId === plugin.itemId;
        button.dataset.selected = String(isFitted);
        button.setAttribute("aria-pressed", String(isFitted));
      }
    }
  }

  function render(frame) {
    const block = frame.huntLoadout;
    if (!block) return;
    gateName.textContent = uiText(block.gate?.displayName ?? "");
    gateFee.textContent = block.admission
      ? uiText("入場費 {fee} 位元幣 · 持有 {wallet} 位元幣", { fee: block.admission.chargeBits, wallet: block.admission.walletBits }) : "";
    for (const entry of block.availableEquipment) {
      const selected = block.selectedEquipment.find((slot) => slot.equipmentClass === entry.equipmentClass);
      renderClass(entry, selected);
    }
    renderPlugins(block);
    begin.disabled = !block.canBegin;
    const admissionMessage = gateAdmissionMessage(block.admission);
    const entryError = block.entryError === "INSUFFICIENT_FUNDS" && block.admission?.canEnter ? null : block.entryError;
    entryStatus.textContent = uiText(admissionMessage || (!entryError ? "" : entryError === "HUNT_ENTRY_LEGACY_HISTORY_UNKNOWN"
      ? "此存檔缺少狩獵歷史，暫時無法進入狩獵。"
      : "狩獵進場未完成，遊戲狀態已保留。請重試。"));
    entryStatus.hidden = !entryStatus.textContent;
  }

  render(initial);
  return Object.freeze({
    render,
    dispose() {
      classRows.clear();
      pluginRows.clear();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
      delete root.dataset.loadoutAuthority;
    }
  });
}

// Without an injected watchdog the view keeps a plain deadline, which is what
// every Hunt load had before slow links were told apart from stalled ones.
function fixedDeadlineWatchdog({ onExpire, maxMs }) {
  let state = 'WAITING';
  const timer = setTimeout(() => { if (state === 'WAITING') { state = 'TOO_LONG'; onExpire(state); } }, maxMs);
  return { activity() {}, stop() { if (state === 'WAITING') state = 'STOPPED'; clearTimeout(timer); }, state: () => state };
}

export async function createHuntFieldView({ root, source, mountField, watchLoad = null,
  stallTimeoutMs = 30000, maxLoadMs = 240000, slowNoticeMs = 8000 }) {
  if (typeof mountField !== "function") throw new TypeError("The Hunt field view requires the published field mounter");
  const frame = source.getFrame();
  const block = frame.huntField;
  if (!block) throw new Error("CHAMPIONSHIP_HUNT_FIELD_NOT_ACTIVE");
  const mode = presentationMode();

  root.replaceChildren();
  root.className = "cm-vs2-root cm-vs2-root--field";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.presentationMode = mode;
  root.dataset.screen = frame.screen;

  const shell = element("section", "cm-vs2-field");
  shell.setAttribute("aria-label", uiText("Hunt field"));
  const hud = element("header", "cm-vs2-hud");
  const hudSignal = element("span", "cm-vs2-hud__signal");
  hudSignal.setAttribute("aria-hidden", "true");
  const hudCopy = element("div", "cm-vs2-hud__copy");
  const gateName = element("strong", "cm-vs2-hud__gate", block.hud.gateName ?? "");
  const companion = element("span", "cm-vs2-hud__companion", block.hud.companionName ?? "");
  hudCopy.append(gateName, companion);
  const exit = actionButton("返回牧場");
  exit.classList.add("cm-vs2-hud__exit");
  hud.append(hudSignal, hudCopy, exit);

  const viewport = element("div", "cm-vs2-field__viewport");
  viewport.append(element("span", "cm-vs2-field__corner cm-vs2-field__corner--a"), element("span", "cm-vs2-field__corner cm-vs2-field__corner--b"));
  const fieldHost = element("div", "cm-vs2-field__canvas");
  fieldHost.setAttribute("aria-busy", "true");
  fieldHost.setAttribute("aria-label", uiText("Exploration field. Drag empty ground to look around. Touch a creature to select it."));
  viewport.append(fieldHost);
  // HD-2D ambience over the field (Owner 2026-10-27): a diorama vignette in the
  // biome's light and a few drifting particles; it never takes input.
  const ambience = mountAmbience(viewport, { theme: ambienceTheme(block.hud.biomeId) });
  viewport.dataset.biome = block.hud.biomeId ?? '';
  // Loading reads as a sentence, a bar once the download size is known, and a
  // note if it is slow. The status role only speaks at whole tens of percent.
  const loading = element('div', 'cm-vs2-field__loading');
  loading.setAttribute('role', 'status');
  const loadingText = element('p', 'cm-vs2-field__loading-text', '正在準備狩獵場…');
  const loadingBar = element('span', 'cm-vs2-field__progress');
  loadingBar.setAttribute('role', 'progressbar');
  loadingBar.setAttribute('aria-label', uiText('狩獵場下載進度'));
  loadingBar.setAttribute('aria-valuemin', '0');
  loadingBar.setAttribute('aria-valuemax', '100');
  loadingBar.hidden = true;
  const loadingFill = element('span', 'cm-vs2-field__progress-fill');
  loadingBar.append(loadingFill);
  const loadingBytes = element('p', 'cm-vs2-field__loading-bytes');
  loadingBytes.setAttribute('aria-hidden', 'true');
  loadingBytes.hidden = true;
  const loadingNote = element('p', 'cm-vs2-field__loading-note');
  loadingNote.hidden = true;
  // Owner 2026-10-27: the loading screen is a compact dashboard -- where, how
  // long, a partner walking the bar -- not a stack of panels.
  const loadingTitle = element('p', 'cm-vs2-field__loading-title');
  const loadingGate = element('strong', 'cm-vs2-field__loading-gate', block.hud.gateName ?? '');
  const loadingLimit = element('span', 'cm-vs2-field__loading-limit');
  loadingTitle.append(loadingGate, loadingLimit);
  const walkLane = element('span', 'cm-vs2-field__walk-lane');
  walkLane.setAttribute('aria-hidden', 'true');
  loading.append(loadingTitle, walkLane, loadingText, loadingBar, loadingBytes, loadingNote);
  viewport.append(loading);
  const walker = frame.tutorial ? null : mountLoadingWalker(walkLane);
  // Ceremony (2026-10-15): 傳送門連線 covers the download and opens onto the
  // live field. It decorates the entry the app has already made; the field
  // runs underneath from its first frame, and a tap settles it.
  const entryEnv = ceremonyEnvironment();
  const entryStarted = performance.now();
  let entryTimer = null;
  const remainingText = (minutes) => minutes == null ? '' : uiText('限時 {time}', {
    time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` });
  const entryGate = uiText(block.hud.gateName ?? '');
  loadingGate.textContent = entryGate;
  loadingLimit.textContent = remainingText(block.hud.time?.remainingMinutes);
  let entry = frame.tutorial ? null : playCeremony({ host: viewport, kind: 'gate-entry', cue: 'gate', autoDismiss: false,
    label: uiText('傳送門連線：{gate}', { gate: entryGate }),
    build: (stage, env) => buildGateEntry(stage, env, { kicker: uiText('傳送門連線'), gateName: entryGate,
      meta: remainingText(block.hud.time?.remainingMinutes), hint: uiText('輕觸略過') }) });
  const closeEntry = () => { clearTimeout(entryTimer); entryTimer = null; entry?.dispose(); entry = null; walker?.dispose(); };
  const replay = (node, key) => { node.dataset[key] = 'false'; void node.offsetWidth; node.dataset[key] = 'true'; };
  // The orb is the portal: the download charges it (its rings speed up and draw
  // in), and when the field is ready it splits open onto the live field.
  const portalCharge = (value) => viewport.style.setProperty('--portal-progress', String(Math.max(0, Math.min(1, value))));
  portalCharge(0);
  function breachEntry() {
    const node = entry?.element;
    if (!node || entryEnv.reduced) { entry?.dismiss(); walker?.dispose(); return; }
    portalCharge(1);
    node.dataset.breach = 'true';
    viewport.dataset.entering = 'true';
    const Event = viewport.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    try { viewport.dispatchEvent(new Event('cm-fx', { bubbles: true, detail: { kind: 'open' } })); } catch { /* optional */ }
    entryTimer = setTimeout(() => {
      entryTimer = null;
      closeEntry();
      setTimeout(() => { delete viewport.dataset.entering; }, 160);
    }, 900); // the breach in screenLayout.css runs 900 ms (Owner 2026-10-27: make it unmistakable)
  }
  // 捕獲成功: a toast over the live field when a catch lands on the card.
  const seenCaptures = new Set((block.hud.onCard ?? []).map((entry) => entry.wildId));
  let captureToast = null;
  function announceCapture(caught, total) {
    captureToast?.dispose();
    replay(viewport, 'shake');
    captureToast = playCeremony({ host: viewport, kind: 'capture', cue: 'capture',
      build: (stage, env) => buildCapture(stage, env, { kicker: uiText('捕獲成功'), name: caught.name ?? '',
        chip: uiText('已收入記憶卡 · {count}', { count: total }) }),
      onDone: () => { captureToast = null; } });
  }
  const target = element("section", "cm-vs2-target");
  target.setAttribute('aria-label', uiText('狩獵目標資訊'));
  const targetName = element('strong', 'cm-vs2-target__name', '輕觸夥伴查看');
  const targetStats = element('dl', 'cm-vs2-target__stats');
  const targetValues = new Map();
  for (const [key, label] of [['generation', '世代'], ['family', '種族'], ['hp', 'HP'], ['alignment', '屬性'], ['personality', '性格'], ['capacity', '容量']]) {
    const value = element('dd', '', '—');
    targetValues.set(key, value);
    targetStats.append(element('dt', '', label), value);
  }
  target.append(targetName, targetStats);
  const pluginHud=element('aside','cm-hunt-plugin-hud');
  const memory=element('span','cm-hunt-memory');memory.hidden=true;memory.setAttribute('aria-label',uiText('記憶卡容量'));
  const radar=element('div','cm-hunt-radar');radar.hidden=true;radar.setAttribute('role','img');radar.setAttribute('aria-label',uiText('狩獵雷達'));
  pluginHud.append(memory,radar);
  const toolbar = toolbarShell(block.toolbar, mode);
  const tools = element("nav","cm-hunt-tools");
  tools.setAttribute("aria-label",uiText("狩獵工具"));
  const toolButtons = new Map();
  for (const tool of block.toolState?.tools ?? []) {
    const button = actionButton(tool.label);
    button.disabled = true;
    // The original shows these as icons on the same hexagon plate the care rail
    // uses, not as words. `data-tool` names which glyph; the skin paints it and
    // the label stays in the DOM for assistive technology.
    button.dataset.tool = tool.id;
    renderHuntTool(button, tool);
    button.setAttribute("aria-pressed",String(block.toolState.activeTool===tool.id));
    let checkpoint=null;
    button.addEventListener("pointerdown",()=>{checkpoint=source.getFrame().tutorial?.checkpoint??null;});
    button.addEventListener("keydown",()=>{checkpoint=source.getFrame().tutorial?.checkpoint??null;});
    button.addEventListener("click",()=>{replay(button,"pop");source.intents.selectHuntTool(tool.id,checkpoint);});
    toolButtons.set(tool.id,button);tools.append(button);
  }
  const movementHint = element("p", "cm-vs2-field__hint", "拖曳地面移動視野 · 輕觸夥伴選取");
  const info = element('div', 'cm-hunt-info');
  info.append(target, pluginHud);
  // display:contents in legacy; one scrollable controls column when wide.
  const controlsPanel = element('aside', 'cm-hunt-controls-panel');
  controlsPanel.append(info, movementHint);
  if(block.toolState) controlsPanel.append(tools);
  shell.append(viewport, hud, controlsPanel);
  if (mode === VS2_PRESENTATION_MODES.DEVELOPER) shell.append(toolbar);
  root.append(shell);

  const load = new AbortController();
  let expired = null;
  exit.addEventListener("click", () => {
    // The native controller can refuse return while card insertion is active.
    // Keep the live scene's textures until the router actually accepts exit.
    source.intents.exitHunt();
    if (source.getFrame().screen === 'HUNT_FIELD') return;
    if (fieldHost.getAttribute('aria-busy') === 'true') {
      loadingText.textContent = uiText('正在返回牧場…');
      loadingBar.hidden = true;
      loadingBytes.hidden = true;
      loadingNote.hidden = true;
      exit.disabled = true;
    }
    load.abort();
  });
  // Network time belongs to this view, not to the native Hunt timer. Releasing
  // the mount queue on cancellation also lets Home open if a request hangs.
  // A slow link keeps loading as long as bytes keep arriving; only a load that
  // has stopped moving (or run past the outer limit) is given up.
  const cancelled = new Promise(resolve => load.signal.addEventListener('abort', () => resolve(null), { once: true }));
  const onExpire = (reason) => { expired = reason; load.abort(); };
  const watchdog = watchLoad?.({ onExpire, stallMs: stallTimeoutMs, maxMs: maxLoadMs })
    ?? fixedDeadlineWatchdog({ onExpire, maxMs: maxLoadMs });
  // A server that sends the file size gets a percentage. One that streams
  // without it (the local development server) gets the bytes received so far
  // and a bar that only says "moving"; neither invents a number.
  let spokenStep = null;
  const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
  function showProgress(progress) {
    watchdog.activity();
    if (!(progress?.loaded > 0) || load.signal.aborted) return;
    loadingBar.hidden = false;
    loadingBar.dataset.loadedBytes = String(progress.loaded);
    // The byte count is for the eyes only; the status line speaks in steps.
    loadingBytes.hidden = false;
    let step, text;
    if (progress.total > 0) {
      const percent = Math.max(0, Math.min(99, Math.floor(progress.loaded / progress.total * 100)));
      loadingBar.removeAttribute('data-indeterminate');
      loadingFill.style.width = `${percent}%`;
      loadingBar.setAttribute('aria-valuenow', String(percent));
      loadingBytes.textContent = `${sizeText(progress.loaded)} / ${sizeText(progress.total)}`;
      walker?.setProgress(percent / 100);
      portalCharge(percent / 100);
      step = `p${Math.floor(percent / 10)}`;
      text = uiText('正在下載狩獵場 {percent}%', { percent: Math.floor(percent / 10) * 10 });
    } else {
      loadingBar.dataset.indeterminate = 'true';
      loadingFill.style.removeProperty('width');
      loadingBar.removeAttribute('aria-valuenow');
      loadingBytes.textContent = uiText('已下載 {size}', { size: sizeText(progress.loaded) });
      walker?.setProgress(null);
      step = 'bytes';
      text = uiText('正在下載狩獵場…');
    }
    if (step !== spokenStep) { spokenStep = step; loadingText.textContent = text; }
  }
  // Any finished download also counts as the load being alive.
  let resources = null;
  try {
    resources = new PerformanceObserver(() => watchdog.activity());
    resources.observe({ type: 'resource' });
  } catch { resources = null; }
  const slowNotice = setTimeout(() => {
    if (fieldHost.getAttribute('aria-busy') !== 'true' || load.signal.aborted) return;
    loadingNote.textContent = uiText('網路較慢，仍在下載中；也可以先返回牧場。');
    loadingNote.hidden = false;
  }, slowNoticeMs);
  let field;
  try {
    const pending = Promise.resolve().then(() => mountField({ host: fieldHost, source, signal: load.signal,
    onProgress: showProgress,
    // Tutorial positions are a read-only render projection, never a progression input.
    onActorFrame:mode===VS2_PRESENTATION_MODES.DEVELOPER||frame.tutorial
      ? (positions,toolState)=>{fieldHost.dataset.wildScreenPositions=JSON.stringify(positions);
        fieldHost.dataset.huntToolState=JSON.stringify(toolState);} : null }));
    // A late result belongs to the abandoned view even if another Hunt is open.
    field = await Promise.race([pending.then(result => {
      if (load.signal.aborted) { result?.dispose?.(); return null; }
      return result;
    }), cancelled]);
  } catch (error) {
    closeEntry();
    ambience.dispose();
    throw error;
  } finally {
    watchdog.stop();
    resources?.disconnect();
    clearTimeout(slowNotice);
  }
  if (!field && load.signal.aborted) {
    closeEntry();
    fieldHost.setAttribute('aria-busy', 'false');
    if (expired) {
      loadingText.textContent = uiText(expired === 'STALLED'
        ? '狩獵場下載沒有回應，請返回牧場後再試一次。'
        : '狩獵場載入時間過長，請返回牧場後再試一次。');
      loadingBar.hidden = true;
      loadingBytes.hidden = true;
      loadingNote.hidden = true;
    }
    return Object.freeze({ isPlayable: false, render() {}, dispose() { closeEntry(); ambience.dispose(); load.abort(); shell.remove(); } });
  }
  if (!field || typeof field.render !== "function" || typeof field.dispose !== "function") {
    throw new TypeError("Published field presenter must expose render(frame) and dispose()");
  }
  fieldHost.setAttribute('aria-busy', 'false');
  loading.remove();
  if (!entry) walker?.dispose();
  if (entry) {
    const hold = entryEnv.reduced ? 0 : Math.max(0, CEREMONY_TIMING['gate-entry'].minHold - (performance.now() - entryStarted));
    walker?.setProgress(1);
    entryTimer = setTimeout(() => { entryTimer = null; breachEntry(); }, hold);
  }

  function render(nextFrame) {
    const next = nextFrame?.huntField;
    if (!next) return;
    exit.disabled = !next.hud.exitAvailable;
    gateName.textContent = uiText(next.hud.gateName ?? "");
    const remaining=next.hud.time?.remainingMinutes;
    companion.textContent = uiText(remaining == null ? next.hud.companionName ?? "" :
      uiText('剩餘 {time}', { time: `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}` }));
    // The last hour of the field's clock beats amber, then red.
    hud.dataset.urgent = remaining == null ? 'false' : remaining <= 15 ? 'critical' : remaining < 60 ? 'warning' : 'false';
    const onCard = next.hud.onCard ?? [];
    for (const caught of onCard) {
      if (seenCaptures.has(caught.wildId)) continue;
      seenCaptures.add(caught.wildId);
      // The scripted tutorial speaks for itself at this moment.
      if (!nextFrame.tutorial) announceCapture(caught, onCard.length);
    }
    const selected = next.hud.target;
    targetName.textContent = uiText(selected ? selected.name??'野生夥伴' : '輕觸夥伴查看');
    target.dataset.selected = String(Boolean(selected));
    for (const [key, value] of targetValues) value.textContent = uiText(selected?.[key] ?? '—');
    const plugins=next.hud.plugins;
    memory.hidden=!plugins?.memory;memory.textContent=uiText(plugins?.memory?`${plugins.memory.usedG} / ${plugins.memory.maxG} G`:'');
    radar.hidden=!plugins?.radar;radar.replaceChildren();
    for(const marker of plugins?.radar??[]){const dot=element('i');dot.style.left=`${marker.x*100}%`;dot.style.top=`${marker.y*100}%`;radar.append(dot);}
    if(next.toolState){
      for(const tool of next.toolState.tools){const button=toolButtons.get(tool.id);if(button){button.disabled=field.isPlayable===false||!tool.enabled;button.setAttribute("aria-pressed",String(next.toolState.activeTool===tool.id));
        const counter=plugins?.counters.find(c=>c.id===tool.id);renderHuntTool(button,tool,uiText(tool.label)+(counter?` ×${counter.quantity}`:''));}}
      const selectedTool=next.toolState.tools.find(t=>t.id===next.toolState.activeTool);
      // Rope primed: the field's corners frame a scope. A target that can be
      // collected makes the hand key pulse (the hand is what collects).
      viewport.dataset.tool=selectedTool?.id??'';
      const hand=toolButtons.get('HAND');if(hand)hand.dataset.ready=String(Boolean(nextFrame.huntField?.affordances?.canCollect));
      // A notice (the rope broke, the card is full) is feedback and always
      // shows; an instruction is a hint the compact HUD may leave out.
      const noticeKnown=Boolean(next.toolState.notice&&["OVER_CAPACITY","ROPE_BROKEN","ON_CARD","EMPTY","BLOCKED_TERRAIN","FOOD_POOL_FULL","TOOL_POOL_FULL"].includes(next.toolState.notice));
      movementHint.dataset.kind=noticeKnown?"notice":"instruction";
      movementHint.textContent=uiText(({OVER_CAPACITY:"記憶卡容量不足",ROPE_BROKEN:"繩索斷了",ON_CARD:"已收入記憶卡",EMPTY:"道具已用完",
        BLOCKED_TERRAIN:"無法放在這個位置",FOOD_POOL_FULL:"場上的肉餌已滿",TOOL_POOL_FULL:"場上的道具已滿"})[next.toolState.notice]
        ?? ({ROPE:"快速畫圈綑綁 · 按住目標拉動繩索 · 放鬆可恢復耐久",SHOT:"按住目標射擊",WIRE:"拖曳拉出鋼索 · 放手完成",
          MEAT:"輕觸地面放置肉餌",DECOY:"輕觸放置玩具 · 再輕觸指定移動方向",LIGHT:"輕觸放置誘引燈 · 夜間吸引目標",
          CAPTURE_TRAP:"輕觸放置陷阱 · 困住目標後切換手掌收取",BOMB:"輕觸放置炸彈",MINE:"輕觸放置地雷 · 目標經過時引爆"})[selectedTool?.subtype??selectedTool?.id]
        ?? "拖曳地面移動視野 · 目標倒地後輕觸抓取");
    }
    field.render(nextFrame);
    // Developer Mode already exists to publish field evidence the player never
    // sees (the RAW_SLOT rail, the gate evidence lines). Live actor positions
    // join it, because the native controller moves the wilds every frame and
    // nothing outside the running field can work out where they are -- which is
    // what stopped the VS3 capture gate from being able to aim at one. Player
    // Mode writes no general diagnostics; active tutorials expose only the render projection above.
    if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
      fieldHost.dataset.huntToolState = JSON.stringify(next.toolState);
    }
  }

  render(frame);
  return Object.freeze({
    isPlayable: field.isPlayable !== false,
    render,
    getDiagnostics() { return field.getDiagnostics?.() ?? null; },
    dispose() {
      closeEntry();
      captureToast?.dispose();
      ambience.dispose();
      load.abort();
      field.dispose();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
    }
  });
}

