// VS2 -- neutral DOM screens for Gate Select, Hunt Loadout and the Hunt HUD.
//
// AUTHORITY NOTE
// --------------
// DOM screen UI is Codex Art's lane, and the P1R system is the approved
// production standard. Codex has not yet packaged a Gate/Hunt family, so these
// screens are a NEUTRAL RUNTIME SHELL: correct structure, correct semantics,
// correct responsive behaviour, deliberately plain presentation. They exist so
// the VS2 flow is playable and testable now, and they consume only the published
// VS2 seam - exactly what Codex will bind to when the P1R family lands.
//
// They are not a visual production decision and must not be treated as one.

import { CHAMPIONSHIP_SCREENS } from "./championshipScreenStack.js";

export const VS2_UI_AUTHORITY = "CLAUDE_NEUTRAL_RUNTIME_SHELL_AWAITING_P1R";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function screenShell(root, { screen, title, subtitle }) {
  root.replaceChildren();
  root.className = "cm-vs2-root";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.screen = screen;

  const shell = element("section", "cm-vs2-shell");
  shell.setAttribute("aria-label", title);
  const header = element("header", "cm-vs2-header");
  header.append(element("h1", "cm-vs2-title", title));
  if (subtitle) header.append(element("p", "cm-vs2-subtitle", subtitle));
  shell.append(header);
  root.append(shell);
  return shell;
}

/** The eight ROM-verified slots, every one neutral, disabled and unlabelled. */
function toolbarShell(toolbar) {
  const bar = element("div", "cm-vs2-toolbar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Contextual toolbar, not yet bound");
  bar.dataset.toolbarMode = String(toolbar.mode.value);
  bar.dataset.assetFamily = toolbar.assetFamily.value;
  for (const slot of toolbar.slots) {
    const button = element("button", "cm-vs2-slot");
    button.type = "button";
    button.disabled = true;
    button.dataset.slot = String(slot.slot);
    button.dataset.state = slot.state;
    button.setAttribute("aria-label", `RAW_SLOT_${slot.slot}`);
    button.append(element("span", "cm-vs2-slot__raw", String(slot.slot)));
    bar.append(button);
  }
  return bar;
}

export function createGateSelectView({ root, source }) {
  const shell = screenShell(root, {
    screen: CHAMPIONSHIP_SCREENS.GATE_SELECT,
    title: "Choose a gate",
    subtitle: "Product-authored gates. No gate is locked, because no unlock rule is known."
  });

  const list = element("div", "cm-vs2-gates");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Gates");
  shell.append(list);

  const actions = element("div", "cm-vs2-actions");
  const back = element("button", "cm-button", "Back");
  back.type = "button";
  const confirm = element("button", "cm-button cm-button--primary", "Continue");
  confirm.type = "button";
  actions.append(back, confirm);
  shell.append(actions);

  back.addEventListener("click", () => source.intents.leaveScreen());
  confirm.addEventListener("click", () => source.intents.confirmGate());

  const buttons = new Map();

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
        button.append(element("span", "cm-vs2-gate__ordinal", String(gate.ordinal).padStart(2, "0")));
        button.append(element("span", "cm-vs2-gate__name", gate.displayName));
        button.addEventListener("click", () => source.intents.selectGate(gate.gateId));
        buttons.set(gate.gateId, button);
        list.append(button);
      }
      button.setAttribute("aria-selected", String(gate.selected));
      button.dataset.selected = String(gate.selected);
    }
    confirm.disabled = !block.canConfirm;
  }

  render(source.getFrame());
  return Object.freeze({
    render,
    dispose() {
      buttons.clear();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.screen;
    }
  });
}

export function createHuntLoadoutView({ root, source }) {
  const shell = screenShell(root, {
    screen: CHAMPIONSHIP_SCREENS.HUNT_LOADOUT,
    title: "Choose a companion",
    subtitle: "One companion. No original party or item model is known, so none is shown."
  });

  const gateLine = element("p", "cm-vs2-gateline");
  shell.append(gateLine);

  const list = element("div", "cm-vs2-party");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Companions");
  shell.append(list);

  const actions = element("div", "cm-vs2-actions");
  const back = element("button", "cm-button", "Back");
  back.type = "button";
  const begin = element("button", "cm-button cm-button--primary", "Enter the gate");
  begin.type = "button";
  actions.append(back, begin);
  shell.append(actions);

  back.addEventListener("click", () => source.intents.leaveScreen());
  begin.addEventListener("click", () => source.intents.beginHunt());

  const buttons = new Map();

  function render(frame) {
    const block = frame.huntLoadout;
    if (!block) return;
    gateLine.textContent = block.gate ? `Gate: ${block.gate.displayName}` : "";
    for (const member of block.party) {
      let button = buttons.get(member.creatureId);
      if (!button) {
        button = element("button", "cm-vs2-member");
        button.type = "button";
        button.setAttribute("role", "option");
        button.dataset.creatureId = member.creatureId;
        const portrait = document.createElement("img");
        portrait.className = "cm-vs2-member__portrait";
        // Contract asset paths are document-relative, the same resolution Pixi
        // uses. Art is Codex-owned and may not exist yet, so a missing portrait
        // hides itself instead of leaving a broken image in the shell.
        portrait.src = member.sprite.portrait;
        portrait.alt = "";
        portrait.decoding = "async";
        portrait.addEventListener("error", () => { portrait.hidden = true; });
        button.append(portrait, element("span", "cm-vs2-member__name", member.displayName));
        button.addEventListener("click", () => source.intents.selectCompanion(member.creatureId));
        buttons.set(member.creatureId, button);
        list.append(button);
      }
      button.setAttribute("aria-selected", String(member.selected));
      button.dataset.selected = String(member.selected);
    }
    begin.disabled = !block.canBegin;
  }

  render(source.getFrame());
  return Object.freeze({
    render,
    dispose() {
      buttons.clear();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.screen;
    }
  });
}

export async function createHuntFieldView({ root, source, mountField }) {
  if (typeof mountField !== "function") {
    throw new TypeError("The Hunt field view requires a Claude-owned field mounter");
  }
  const frame = source.getFrame();
  const block = frame.huntField;
  if (!block) throw new Error("CHAMPIONSHIP_HUNT_FIELD_NOT_ACTIVE");

  root.replaceChildren();
  root.className = "cm-vs2-root cm-vs2-root--field";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.screen = CHAMPIONSHIP_SCREENS.HUNT_FIELD;

  const shell = element("section", "cm-vs2-field");
  shell.setAttribute("aria-label", "Hunt field");

  const hud = element("header", "cm-vs2-hud");
  const gateName = element("span", "cm-vs2-hud__gate", block.hud.gateName ?? "");
  const companion = element("span", "cm-vs2-hud__companion", block.hud.companionName ?? "");
  const exit = element("button", "cm-button cm-vs2-hud__exit", "Leave");
  exit.type = "button";
  hud.append(gateName, companion, exit);

  const fieldHost = element("div", "cm-vs2-field__canvas");
  const toolbar = toolbarShell(block.toolbar);

  shell.append(hud, fieldHost, toolbar);
  root.append(shell);

  exit.addEventListener("click", () => source.intents.exitHunt());

  const field = await mountField({ host: fieldHost, source });
  if (!field || typeof field.render !== "function" || typeof field.dispose !== "function") {
    throw new TypeError("Claude-owned field presenter must expose render(frame) and dispose()");
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
    getDiagnostics() {
      return field.getDiagnostics?.() ?? null;
    },
    dispose() {
      field.dispose();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.screen;
    }
  });
}
