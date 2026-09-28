// One confirmation dialog for every screen.
//
// Owner 2026-09-28 asked for consistent confirmations, and two defects had one
// cause: New Game replaced an existing save and Cage Edit dropped an
// unconfirmed layout, both without asking. Each place that must ask now asks
// through this, so the wording, focus order and dismissal behave the same.
//
// The native <dialog> in modal mode makes everything behind it inert, so a
// second tap cannot reach the button that opened it, and Escape closes it.
// Focus starts on the safest choice, so Enter never confirms a destructive
// action by accident. Only one dialog is open at a time; a request made while
// one is open resolves null rather than stacking.

let openDialog = null;

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {Array<{id:string,label:string,tone?:'primary'|'danger'|'secondary'}>} options.actions
 *   Displayed in order; the primary one should come last.
 * @param {string|null} [options.cancelId] resolved on Escape or a backdrop tap
 * @param {string} [options.focusId] defaults to cancelId, else the first action
 * @returns {Promise<string|null>}
 */
export function showChoiceDialog({ title, message = "", actions, cancelId = null, focusId = null, doc = globalThis.document } = {}) {
  if (!Array.isArray(actions) || actions.length === 0) throw new TypeError("A dialog needs at least one action");
  if (openDialog) return Promise.resolve(null);
  const dialog = doc.createElement("dialog");
  dialog.className = "cm-dialog";
  dialog.setAttribute("aria-labelledby", "cm-dialog-title");
  const panel = doc.createElement("div");
  panel.className = "cm-dialog__panel";
  const heading = doc.createElement("h2");
  heading.className = "cm-dialog__title";
  heading.id = "cm-dialog-title";
  heading.textContent = title;
  panel.append(heading);
  if (message) {
    const body = doc.createElement("p");
    body.className = "cm-dialog__message";
    body.textContent = message;
    dialog.setAttribute("aria-describedby", "cm-dialog-message");
    body.id = "cm-dialog-message";
    panel.append(body);
  }
  const row = doc.createElement("div");
  row.className = "cm-dialog__actions";
  row.dataset.count = String(actions.length);
  const buttons = new Map();
  for (const action of actions) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `cm-dialog__action cm-dialog__action--${action.tone ?? "secondary"}`;
    button.dataset.action = action.id;
    button.textContent = action.label;
    buttons.set(action.id, button);
    row.append(button);
  }
  panel.append(row);
  dialog.append(panel);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (id) => {
      if (settled) return;
      settled = true;
      openDialog = null;
      try { if (dialog.open) dialog.close(); } catch { /* already closed */ }
      dialog.remove();
      resolve(id);
    };
    for (const [id, button] of buttons) button.addEventListener("click", () => finish(id));
    // Escape arrives as `cancel`; keep the dialog in charge of its own result.
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(cancelId); });
    // A tap on the backdrop lands on the dialog element itself, not the panel.
    dialog.addEventListener("click", (event) => { if (event.target === dialog && cancelId !== null) finish(cancelId); });
    openDialog = dialog;
    doc.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const initial = buttons.get(focusId ?? cancelId) ?? buttons.values().next().value;
    initial?.focus({ preventScroll: true });
  });
}

/** Whether a dialog currently owns the screen. */
export function isChoiceDialogOpen() {
  return openDialog !== null;
}
