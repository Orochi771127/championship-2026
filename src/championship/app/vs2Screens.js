import { uiText } from "../text/uiText.js";
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
    ? `馴獸師階級達到 ${admission.unlockParameter} 後開放。`
    : "取得對應比賽勝利後開放。";
  if (admission?.reason === "INSUFFICIENT_FUNDS") {
    return `持有金額不足，入場需要 ${admission.chargeBits.toLocaleString("en-US")} 位元幣。`;
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
    subtitle: "轉動地球，選擇要前往的場地。",
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
  const viewToggle = actionButton("場地列表");
  viewToggle.classList.add("cm-vs2-gate3d__toggle");
  viewToggle.setAttribute("aria-pressed", "false");
  worldBar.append(worldCopy, viewToggle);
  const worldHost = element("div", "cm-vs2-gate3d__host");
  worldHost.dataset.cameraAuthority = "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER";
  const dragHint = element("p", "cm-vs2-gate3d__hint", "拖曳轉動 · 輕觸地點選擇");
  worldPanel.append(worldBar, worldHost, dragHint);

  const preview = element("section", "cm-vs2-preview");
  preview.setAttribute("aria-label", uiText("狩獵場資訊"));
  const previewImage = element("img", "cm-vs2-preview__image");
  previewImage.alt = "";
  previewImage.hidden = true;
  const previewCopy = element("div", "cm-vs2-preview__copy");
  const previewName = element("strong", "cm-vs2-preview__name", "請選擇目的地");
  const previewId = element("span", "cm-vs2-preview__id", "");
  previewCopy.append(previewName, previewId);
  const costs = element("dl", "cm-vs2-preview__costs");
  const fee = element("dd", "", "—");
  const wallet = element("dd", "", "—");
  costs.append(element("dt", "", "入場費"), fee, element("dt", "", "持有金額"), wallet);
  preview.append(previewImage, previewCopy, costs);
  const admissionStatus = element("p", "cm-vs2-status");
  admissionStatus.setAttribute("role", "status");

  const fallbackPanel = element("section", "cm-vs2-gate-fallback");
  const fallbackHeading = element("div", "cm-vs2-gate-fallback__heading");
  fallbackHeading.append(
    element("span", "cm-vs2-kicker", "選擇目的地")
  );
  const list = element("div", "cm-vs2-gates");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", uiText("Biome destinations"));
  fallbackPanel.append(fallbackHeading, list);
  body.append(preview, admissionStatus, worldPanel, fallbackPanel);
  const evidence = developerOnly(mode, "16 biome identities and paired world_day/world_night structure are ROM_VERIFIED. Camera, rotation, input, hit-test, node placement and active preview state are PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER. Exact original display copy/order remain unclaimed.");
  if (evidence) body.append(evidence);

  const back = actionButton("返回牧場");
  const confirm = actionButton("狩獵設定", { primary: true });
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
    viewToggle.textContent = uiText(fallbackVisible ? "返回地球" : "場地列表");
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
      button.dataset.availability = gate.state;
      if (gate.selected) {
        previewName.textContent = uiText(gate.displayName);
        previewId.textContent = uiText(gate.codeString ?? "");
        fee.textContent = uiText(Number.isSafeInteger(gate.entranceFeeBits) ? `${gate.entranceFeeBits.toLocaleString('en-US')} 位元幣` : "—");
        const thumbnail = gate.art?.thumbnail;
        previewImage.hidden = !thumbnail;
        if (thumbnail) {
          if (previewImage.getAttribute('src') !== thumbnail.src) previewImage.src = thumbnail.src;
          previewImage.alt = `${gate.displayName}・日間場地預覽`;
        } else previewImage.removeAttribute('src');
      }
    }
    if (!block.selection.gateId) {
      previewName.textContent = uiText("請選擇目的地");
      previewId.textContent = uiText("");
      previewImage.hidden = true;
      previewImage.removeAttribute('src');
      fee.textContent = uiText("—");
    }
    wallet.textContent = uiText(Number.isSafeInteger(block.walletBits) ? `${block.walletBits.toLocaleString('en-US')} 位元幣` : "—");
    confirm.disabled = !block.canConfirm;
    admissionStatus.textContent = uiText(gateAdmissionMessage(block.admission));
    admissionStatus.hidden = !admissionStatus.textContent;
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
  const evidence = developerOnly(mode, "Five equipment classes and four plugin positions are ROM_VERIFIED. Item identities, stat values and the empty-loadout rule are PRODUCT_AUTHORED. No item effect is applied.");
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
        const label = element("span", "cm-vs2-loadout__label", `外掛 ${position.position + 1}`);
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
    gateFee.textContent = uiText(block.admission
      ? `入場費 ${block.admission.chargeBits.toLocaleString("en-US")} 位元幣 · 持有 ${block.admission.walletBits.toLocaleString("en-US")} 位元幣` : "");
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
  fieldHost.setAttribute("aria-label", uiText("Exploration field. Drag empty ground to look around. Touch a creature to select it."));
  viewport.append(fieldHost);
  const target = element("section", "cm-vs2-target");
  target.setAttribute('aria-label', uiText('狩獵目標資訊'));
  const targetName = element('strong', 'cm-vs2-target__name', '輕觸數碼獸查看');
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
    button.disabled = !tool.enabled;
    button.setAttribute("aria-pressed",String(block.toolState.activeTool===tool.id));
    button.addEventListener("click",()=>source.intents.selectHuntTool(tool.id));
    toolButtons.set(tool.id,button);tools.append(button);
  }
  const movementHint = element("p", "cm-vs2-field__hint", "拖曳地面移動視野 · 輕觸數碼獸選取");
  shell.append(viewport, hud, target,pluginHud);
  if (mode === VS2_PRESENTATION_MODES.DEVELOPER) shell.append(toolbar);
  shell.append(movementHint);
  if(block.toolState) shell.append(tools);
  root.append(shell);

  exit.addEventListener("click", () => source.intents.exitHunt());
  const field = await mountField({ host: fieldHost, source,
    onActorFrame:mode===VS2_PRESENTATION_MODES.DEVELOPER
      ? (positions,toolState)=>{fieldHost.dataset.wildScreenPositions=JSON.stringify(positions);
        fieldHost.dataset.huntToolState=JSON.stringify(toolState);} : null });
  if (!field || typeof field.render !== "function" || typeof field.dispose !== "function") {
    throw new TypeError("Published field presenter must expose render(frame) and dispose()");
  }

  function render(nextFrame) {
    const next = nextFrame?.huntField;
    if (!next) return;
    gateName.textContent = uiText(next.hud.gateName ?? "");
    const remaining=next.hud.time?.remainingMinutes;
    companion.textContent = uiText(remaining == null ? next.hud.companionName ?? "" :
      `剩餘 ${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`);
    const selected = next.hud.target;
    targetName.textContent = uiText(selected ? selected.name??'野生數碼獸' : '輕觸數碼獸查看');
    target.dataset.selected = String(Boolean(selected));
    for (const [key, value] of targetValues) value.textContent = uiText(selected?.[key] ?? '—');
    const plugins=next.hud.plugins;
    memory.hidden=!plugins?.memory;memory.textContent=uiText(plugins?.memory?`${plugins.memory.usedG} / ${plugins.memory.maxG} G`:'');
    radar.hidden=!plugins?.radar;radar.replaceChildren();
    for(const marker of plugins?.radar??[]){const dot=element('i');dot.style.left=`${marker.x*100}%`;dot.style.top=`${marker.y*100}%`;radar.append(dot);}
    if(next.toolState){
      for(const tool of next.toolState.tools){const button=toolButtons.get(tool.id);if(button){button.disabled=!tool.enabled;button.setAttribute("aria-pressed",String(next.toolState.activeTool===tool.id));
        const counter=plugins?.counters.find(c=>c.id===tool.id);button.textContent=uiText(tool.label+(counter?` ×${counter.quantity}`:''));}}
      const selectedTool=next.toolState.tools.find(t=>t.id===next.toolState.activeTool);
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
    // Mode writes nothing, so no player build carries this readout.
    if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
      fieldHost.dataset.huntToolState = JSON.stringify(next.toolState);
    }
  }

  render(frame);
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
