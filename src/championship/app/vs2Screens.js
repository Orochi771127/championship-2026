// VS2-P -- Championship Modern P1R presentation for Gate Select, Hunt Loadout
// and the Hunt HUD.
//
// This module consumes only the injected VS2 presentation source. It owns no
// screen lifecycle, gameplay state, field logic, save data, Pixi bootstrap or
// ticker. Every action below is one of the intents published by
// VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.

export const VS2_UI_AUTHORITY = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
export const VS2_PRESENTATION_MODES = Object.freeze({
  PLAYER: "PLAYER_MODE",
  DEVELOPER: "DEVELOPER_EVIDENCE_MODE"
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
  shell.setAttribute("aria-label", title);
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

/** Eight verified shell positions with zero invented meaning. */
function toolbarShell(toolbar, mode) {
  const section = element("section", "cm-vs2-toolbar");
  section.setAttribute("aria-label", "Unavailable contextual controls");
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
    button.setAttribute("aria-label", `Unavailable field control ${slot.slot + 1}`);
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
    kicker: "WORLD DESTINATION NETWORK",
    title: "GATE SELECT",
    subtitle: "Rotate the world and focus a biome node.",
    signal: "16"
  });
  body.classList.add("cm-vs2-body--gate");

  const worldPanel = element("section", "cm-vs2-gate3d");
  worldPanel.dataset.sceneAuthority = "ORIGINAL_CREATED_2026_GATE_WORLD";
  const worldBar = element("div", "cm-vs2-gate3d__bar");
  const worldCopy = element("div", "cm-vs2-gate3d__bar-copy");
  worldCopy.append(
    element("span", "cm-vs2-kicker", "WORLD MODE"),
    element("strong", "cm-vs2-gate3d__bar-title", "16 BIOME LINKS")
  );
  const viewToggle = actionButton("LIST VIEW");
  viewToggle.classList.add("cm-vs2-gate3d__toggle");
  viewToggle.setAttribute("aria-pressed", "false");
  worldBar.append(worldCopy, viewToggle);
  const worldHost = element("div", "cm-vs2-gate3d__host");
  worldHost.dataset.cameraAuthority = "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER";
  const dragHint = element("p", "cm-vs2-gate3d__hint", "DRAG TO ROTATE · TAP A NODE TO FOCUS");
  worldPanel.append(worldBar, worldHost, dragHint);

  const preview = element("section", "cm-vs2-preview");
  const previewCopy = element("div", "cm-vs2-preview__copy");
  const previewName = element("strong", "cm-vs2-preview__name", "SELECT A BIOME");
  const previewId = element("span", "cm-vs2-preview__id", "DESTINATION NODE --");
  const previewState = element("span", "cm-vs2-preview__state", "STANDBY");
  previewCopy.append(element("span", "cm-vs2-kicker", "DESTINATION INFORMATION"), previewName, previewId);
  preview.append(previewCopy, previewState);

  const fallbackPanel = element("section", "cm-vs2-gate-fallback");
  const fallbackHeading = element("div", "cm-vs2-gate-fallback__heading");
  fallbackHeading.append(
    element("span", "cm-vs2-kicker", "ACCESSIBLE DESTINATION LIST"),
    element("span", "cm-vs2-gate-fallback__note", "LOW GRAPHICS / DEVELOPER FALLBACK")
  );
  const list = element("div", "cm-vs2-gates");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Biome destinations");
  fallbackPanel.append(fallbackHeading, list);
  body.append(worldPanel, preview, fallbackPanel);
  const evidence = developerOnly(mode, "16 biome identities and paired world_day/world_night structure are ROM_VERIFIED. Camera, rotation, input, hit-test, node placement and active preview state are PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER. Exact original display copy/order remain unclaimed.");
  if (evidence) body.append(evidence);

  const back = actionButton("BACK");
  const confirm = actionButton("CONTINUE", { primary: true });
  footer.append(back, confirm);
  back.addEventListener("click", () => source.intents.leaveScreen());
  confirm.addEventListener("click", () => source.intents.confirmGate());
  const buttons = new Map();
  let worldPresentation = null;
  let worldFailure = null;
  let fallbackVisible = mode === VS2_PRESENTATION_MODES.DEVELOPER;
  try {
    fallbackVisible ||= new URLSearchParams(globalThis.location?.search ?? "").get("gateMode") === "fallback";
  } catch { /* a URL parser failure must not block the default 3D attempt */ }

  function applyViewMode() {
    worldPanel.dataset.view = fallbackVisible ? "fallback" : "world";
    worldHost.hidden = fallbackVisible;
    dragHint.hidden = fallbackVisible;
    fallbackPanel.hidden = !fallbackVisible;
    viewToggle.textContent = fallbackVisible ? "WORLD VIEW" : "LIST VIEW";
    viewToggle.setAttribute("aria-pressed", String(fallbackVisible));
    root.dataset.gatePresentation = fallbackVisible
      ? (worldFailure ? "LOW_CAPABILITY_FALLBACK" : "ACCESSIBILITY_FALLBACK")
      : "THREE_BOUNDED_WORLD_MODE";
  }

  async function ensureWorld() {
    if (worldPresentation) return true;
    if (typeof mountWorld !== "function") {
      worldFailure = new Error("CHAMPIONSHIP_GATE_3D_MOUNTER_UNAVAILABLE");
      return false;
    }
    try {
      worldPresentation = await mountWorld({
        host: worldHost,
        gates: source.getFrame().gateSelect.gates,
        onSelect: (gateId) => source.intents.selectGate(gateId)
      });
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
        button.append(
          aperture,
          element("span", "cm-vs2-gate__ordinal", String(gate.ordinal).padStart(2, "0")),
          element("span", "cm-vs2-gate__name", gate.displayName)
        );
        button.addEventListener("click", () => source.intents.selectGate(gate.gateId));
        buttons.set(gate.gateId, button);
        list.append(button);
      }
      button.setAttribute("aria-selected", String(gate.selected));
      button.dataset.selected = String(gate.selected);
      if (gate.selected) {
        previewName.textContent = gate.displayName;
        previewId.textContent = `DESTINATION NODE ${String(gate.ordinal).padStart(2, "0")}`;
        previewState.textContent = "READY";
      }
    }
    if (!block.selection.gateId) {
      previewName.textContent = "SELECT A BIOME";
      previewId.textContent = "DESTINATION NODE --";
      previewState.textContent = "STANDBY";
    }
    confirm.disabled = !block.canConfirm;
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
      worldPresentation?.dispose?.();
      buttons.clear();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
      delete root.dataset.gatePresentation;
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
    kicker: "EXPEDITION CONFIGURATION",
    title: "HUNT LOADOUT",
    subtitle: "Equip your tools and fit your plugins.",
    signal: "01"
  });
  root.dataset.loadoutAuthority = "ORIGINAL_STRUCTURE_ROM_VERIFIED";

  const gatePlate = element("section", "cm-vs2-destination");
  gatePlate.append(element("span", "cm-vs2-kicker", "DESTINATION"));
  const gateName = element("strong", "cm-vs2-destination__name");
  gatePlate.append(gateName);

  const equipmentList = element("div", "cm-vs2-loadout");
  equipmentList.setAttribute("role", "group");
  equipmentList.setAttribute("aria-label", "Equipment classes");
  const pluginList = element("div", "cm-vs2-loadout");
  pluginList.setAttribute("role", "group");
  pluginList.setAttribute("aria-label", "Plugin positions");

  body.append(gatePlate, equipmentList, pluginList);
  const evidence = developerOnly(mode, "Five equipment classes and four plugin positions are ROM_VERIFIED. Item identities, stat values and the empty-loadout rule are PRODUCT_AUTHORED. No item effect is applied.");
  if (evidence) body.append(evidence);

  const back = actionButton("BACK");
  const begin = actionButton("BEGIN HUNT", { primary: true });
  footer.append(back, begin);
  back.addEventListener("click", () => source.intents.leaveScreen());
  begin.addEventListener("click", () => source.intents.beginHunt());

  const classRows = new Map();
  const pluginRows = new Map();

  /** One row per recovered equipment class. Empty is empty, never disabled. */
  function renderClass(entry, selected) {
    let row = classRows.get(entry.equipmentClass);
    if (!row) {
      row = element("div", "cm-vs2-loadout__row");
      row.dataset.equipmentClass = entry.equipmentClass;
      const label = element("span", "cm-vs2-loadout__label", entry.equipmentClass.replace(/_/g, " "));
      const options = element("div", "cm-vs2-loadout__options");
      row.append(label, options);
      classRows.set(entry.equipmentClass, { row, options, buttons: new Map() });
      equipmentList.append(row);
      row = classRows.get(entry.equipmentClass);
    }
    if (entry.items.length === 0) {
      row.options.replaceChildren(element("span", "cm-vs2-loadout__empty", "None owned"));
      return;
    }
    for (const item of entry.items) {
      let button = row.buttons.get(item.itemId);
      if (!button) {
        button = element("button", "cm-vs2-loadout__option");
        button.type = "button";
        button.dataset.itemId = item.itemId;
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
        const label = element("span", "cm-vs2-loadout__label", `PLUGIN ${position.position + 1}`);
        const options = element("div", "cm-vs2-loadout__options");
        row.append(label, options);
        pluginRows.set(position.position, { row, options, buttons: new Map() });
        pluginList.append(row);
        row = pluginRows.get(position.position);
      }
      if (block.availablePlugins.length === 0) {
        row.options.replaceChildren(element("span", "cm-vs2-loadout__empty", "None owned"));
        continue;
      }
      for (const plugin of block.availablePlugins) {
        let button = row.buttons.get(plugin.itemId);
        if (!button) {
          button = element("button", "cm-vs2-loadout__option");
          button.type = "button";
          button.dataset.itemId = plugin.itemId;
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
    gateName.textContent = block.gate?.displayName ?? "";
    for (const entry of block.availableEquipment) {
      const selected = block.selectedEquipment.find((slot) => slot.equipmentClass === entry.equipmentClass);
      renderClass(entry, selected);
    }
    renderPlugins(block);
    begin.disabled = !block.canBegin;
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

export async function createHuntFieldView({ root, source, mountField }) {
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
  shell.setAttribute("aria-label", "Hunt field");
  const hud = element("header", "cm-vs2-hud");
  const hudSignal = element("span", "cm-vs2-hud__signal");
  hudSignal.setAttribute("aria-hidden", "true");
  const hudCopy = element("div", "cm-vs2-hud__copy");
  const gateName = element("strong", "cm-vs2-hud__gate", block.hud.gateName ?? "");
  const companion = element("span", "cm-vs2-hud__companion", block.hud.companionName ?? "");
  hudCopy.append(gateName, companion);
  const exit = actionButton("RETURN HOME");
  exit.classList.add("cm-vs2-hud__exit");
  hud.append(hudSignal, hudCopy, exit);

  const viewport = element("div", "cm-vs2-field__viewport");
  viewport.append(element("span", "cm-vs2-field__corner cm-vs2-field__corner--a"), element("span", "cm-vs2-field__corner cm-vs2-field__corner--b"));
  const fieldHost = element("div", "cm-vs2-field__canvas");
  fieldHost.setAttribute("aria-label", "Exploration field. Touch a creature to draw a circle. Empty ground moves you.");
  viewport.append(fieldHost);
  const toolbar = toolbarShell(block.toolbar, mode);
  const movementHint = element("p", "cm-vs2-field__hint", "TOUCH A CREATURE AND DRAW A CIRCLE. EMPTY GROUND MOVES YOU.");
  shell.append(hud, viewport, toolbar, movementHint);
  root.append(shell);

  exit.addEventListener("click", () => source.intents.exitHunt());
  const field = await mountField({ host: fieldHost, source });
  if (!field || typeof field.render !== "function" || typeof field.dispose !== "function") {
    throw new TypeError("Published field presenter must expose render(frame) and dispose()");
  }

  function render(nextFrame) {
    const next = nextFrame?.huntField;
    if (!next) return;
    gateName.textContent = next.hud.gateName ?? "";
    companion.textContent = next.hud.companionName ?? "";
    field.render(nextFrame);
  }

  return Object.freeze({
    render,
    getDiagnostics() { return field.getDiagnostics?.() ?? null; },
    dispose() {
      field.dispose();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
    }
  });
}
