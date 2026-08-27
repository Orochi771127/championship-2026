// INT-RH2 — Codex-owned P1R DOM presentation.
//
// This module consumes only the published Raising presentation seam. It never
// imports the standalone app, Raising domain, save port, forensic catalogs, or
// Pixi bootstrap. The field presenter is injected by the Claude-owned runtime
// integration and remains the sole Pixi authority.

const SAVE_COPY = Object.freeze({
  DIRTY: "Changes are waiting to be saved.",
  CLEAN: "Raising Home is up to date.",
  SAVED: "Raising Home saved.",
  RESTORED: "Raising Home restored from save.",
  RECOVERED: "The last safe Raising Home state was recovered.",
  SAVE_FAILED: "Save did not complete. You can try again."
});

function node(tag, className = "", text = undefined) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function assertPresentationSource(source) {
  if (!source || typeof source.getFrame !== "function" || typeof source.subscribe !== "function") {
    throw new TypeError("INT-RH2 requires a getFrame/subscribe presentation source");
  }
  const intents = source.intents;
  for (const name of ["selectCreature", "relocateCreature", "careForCreature", "requestSave"]) {
    if (typeof intents?.[name] !== "function") {
      throw new TypeError(`INT-RH2 presentation source is missing intent: ${name}`);
    }
  }
  return source;
}

function selectedResident(frame) {
  const id = frame?.selection?.creatureId ?? null;
  return frame?.residents?.find((resident) => resident.creatureId === id) ?? null;
}

function cageName(frame, cageId) {
  return frame?.cages?.find((cage) => cage.cageId === cageId)?.name ?? "Raising Home";
}

function rawSlotLabel(slot) {
  return `RAW_SLOT_${String(slot).padStart(2, "0")}`;
}

function createToolbar() {
  const toolbar = node("section", "int-rh2-toolbar");
  toolbar.setAttribute("aria-label", "Original toolbar structure, commands unverified");

  const heading = node("div", "int-rh2-toolbar__heading");
  heading.append(
    node("span", "int-rh2-kicker", "TRAINING TOOLBAR · MODE 1"),
    node("span", "int-rh2-toolbar__evidence", "8-SLOT SHELL · ROM VERIFIED")
  );

  const rail = node("div", "int-rh2-toolbar__rail");
  const buttons = [];
  for (let slot = 0; slot < 8; slot += 1) {
    const button = node("button", "int-rh2-raw-slot");
    button.type = "button";
    button.disabled = true;
    button.dataset.slot = String(slot);
    button.dataset.state = "UNBOUND_PLACEHOLDER";
    button.setAttribute("aria-label", `${rawSlotLabel(slot)}, unbound placeholder`);
    button.append(
      node("span", "int-rh2-raw-slot__cell", String(slot + 1)),
      node("span", "int-rh2-raw-slot__id", `RAW ${String(slot).padStart(2, "0")}`)
    );
    rail.append(button);
    buttons.push(button);
  }

  const boundary = node(
    "p",
    "int-rh2-toolbar__boundary",
    "Commands, icons, submenu membership, enable mask and slot 7 identity remain unverified."
  );
  toolbar.append(heading, rail, boundary);
  return { toolbar, buttons };
}

/**
 * Mount the P1R screen UI around the one Claude-owned Pixi field presenter.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {object} options.source getFrame/subscribe/intents seam
 * @param {(args: {host: HTMLElement, source: object}) => object|Promise<object>} options.mountField
 */
export async function createRaisingHomeP1RView({ root, source, mountField } = {}) {
  if (!root) throw new TypeError("INT-RH2 P1R view requires a root element");
  const presentation = assertPresentationSource(source);
  if (typeof mountField !== "function") {
    throw new TypeError("INT-RH2 P1R view requires the Claude-owned field mount function");
  }

  root.replaceChildren();
  root.className = "int-rh2-root";
  root.dataset.uiAuthority = "P1R_DOM";

  const shell = node("main", "int-rh2-shell");
  shell.dataset.rendererSplit = "DOM_UI_PIXI_FIELD";

  const header = node("header", "int-rh2-header");
  const identity = node("div", "int-rh2-header__identity");
  identity.append(
    node("p", "int-rh2-kicker", "DIGIMON CHAMPIONSHIP · 2026"),
    node("h1", "int-rh2-title", "RAISING HOME")
  );
  const clock = node("time", "int-rh2-clock", "--:--");
  clock.setAttribute("aria-label", "Raising Home time");
  const save = node("button", "int-rh2-system-button", "SAVE");
  save.type = "button";
  save.addEventListener("click", () => { void presentation.intents.requestSave(); });
  header.append(identity, clock, save);

  const fieldFrame = node("section", "int-rh2-field-frame");
  fieldFrame.setAttribute("aria-label", "Playable Raising field");
  const fieldLabel = node("div", "int-rh2-field-frame__label");
  fieldLabel.append(node("span", "int-rh2-kicker", "LIVE HABITAT"), node("span", "int-rh2-field-state", "FIELD ONLINE"));
  const fieldHost = node("div", "int-rh2-field-host");
  fieldHost.dataset.rendererAuthority = "PIXI_SINGLE_FIELD";
  fieldFrame.append(fieldLabel, fieldHost);

  const companion = node("section", "int-rh2-companion");
  companion.setAttribute("aria-live", "polite");
  const companionCopy = node("div", "int-rh2-companion__copy");
  const companionName = node("h2", "int-rh2-companion__name", "SELECT A RESIDENT");
  const companionLocation = node("p", "int-rh2-companion__location", "Touch a resident in the habitat.");
  companionCopy.append(node("p", "int-rh2-kicker", "COMPANION LINK"), companionName, companionLocation);
  const care = node("button", "int-rh2-care-button", "CARE");
  care.type = "button";
  care.disabled = true;
  care.addEventListener("click", () => {
    const id = source.getFrame()?.selection?.creatureId ?? null;
    if (id) void presentation.intents.careForCreature(id);
  });
  companion.append(companionCopy, care);

  const { toolbar, buttons: toolbarButtons } = createToolbar();
  const status = node("p", "int-rh2-status", "Raising Home is ready.");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  shell.append(header, fieldFrame, companion, toolbar, status);
  root.append(shell);

  const field = await mountField({ host: fieldHost, source: presentation });
  if (!field || typeof field.render !== "function" || typeof field.dispose !== "function") {
    throw new TypeError("Claude-owned field presenter must expose render(frame) and dispose()");
  }

  let lastRevision = -1;
  function render(frame) {
    if (!frame || frame.revision === lastRevision) return;
    lastRevision = frame.revision;

    clock.textContent = frame.clock?.display ?? "--:--";
    const resident = selectedResident(frame);
    companionName.textContent = resident?.displayName?.toUpperCase() ?? "SELECT A RESIDENT";
    companionLocation.textContent = resident
      ? `Living in ${cageName(frame, resident.cageId)}`
      : "Touch a resident in the habitat.";
    care.disabled = !resident;
    care.setAttribute("aria-label", resident ? `Care for ${resident.displayName}` : "Care, select a resident first");

    const phase = frame.save?.phase ?? "CLEAN";
    status.textContent = SAVE_COPY[phase] ?? "Raising Home status updated.";
    save.dataset.phase = phase;
    save.classList.toggle("is-dirty", phase === "DIRTY" || phase === "SAVE_FAILED");

    const slots = frame.toolbar?.slots ?? [];
    toolbarButtons.forEach((button, index) => {
      const slot = slots[index];
      button.dataset.evidence = slot?.commandId?.evidence ?? "UNKNOWN_REQUIRES_TRACE";
      button.dataset.state = slot?.state ?? "UNBOUND_PLACEHOLDER";
      button.disabled = true;
    });
    field.render(frame);
  }

  const unsubscribe = presentation.subscribe(render);
  render(presentation.getFrame());

  return Object.freeze({
    render,
    inspect() {
      return Object.freeze({
        uiAuthority: "P1R_DOM",
        fieldAuthority: "PIXI_SINGLE_FIELD",
        toolbarSlots: toolbarButtons.length,
        activeInteractiveActions: ["SELECT", "RELOCATE", "CARE", "SAVE"],
        guessedToolbarSemantics: 0,
        sourceRevision: lastRevision
      });
    },
    dispose() {
      unsubscribe?.();
      field.dispose();
      root.replaceChildren();
      root.className = "";
    }
  });
}
