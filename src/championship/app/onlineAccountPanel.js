// 【☁️ 帳號與雲端同步】 (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
// A DOM block mounted inside the settings "資料與帳號" page and as its own
// dialog from the System menu. It only talks to championshipCloudService and
// to two injected callbacks: getSaveText() (the serialized local save) and
// restoreSave(payload) (validated and written through the save port by the
// app). The sync pill follows the service state and never claims "已同步"
// on its own.

import { onlineText, onlineReasonText } from "../text/onlineText.js";
import { formatDateTime } from "../text/locale.js";
import { summarizeSaveText } from "../online/cloudSaveEnvelope.js";

const SYNC_KEY = Object.freeze({ LOCAL_ONLY: "syncLocalOnly", SYNCING: "syncSyncing", SYNCED: "syncSynced", OFFLINE: "syncOffline", FAILED: "syncFailed", CHOICE: "syncChoice" });

export function createOnlineAccountPanel({ service, doc = globalThis.document, getSaveText = () => null, restoreSave = async () => ({ ok: false, reason: "RESTORE_UNAVAILABLE" }), confirm = null, googleSignIn = false, clipboard = globalThis.navigator?.clipboard ?? null } = {}) {
  if (!service) throw new TypeError("ONLINE_SERVICE_REQUIRED");
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const button = (key, extra = "") => { const b = el("button", `cm-online__button ${extra}`.trim(), onlineText(key)); b.type = "button"; b.dataset.onlineAction = key; return b; };
  const root = el("section", "cm-online cm-online--account"); root.dataset.onlinePanel = "account";
  const head = el("header", "cm-online__head");
  const badge = el("p", "cm-online__badge"); const idLine = el("p", "cm-online__id");
  const idValue = el("strong", "cm-online__code"); const copy = button("copy", "cm-online__button--ghost");
  idLine.append(el("span", "", onlineText("tamerId") + " "), idValue, copy);
  const mode = el("p", "cm-online__mode"); const sync = el("p", "cm-online__sync");
  head.append(badge, idLine, mode, sync);
  const hint = el("p", "cm-online__hint", onlineText("accountHint"));
  const localNote = el("p", "cm-online__note", onlineText("localNote")); localNote.hidden = true;
  const status = el("p", "cm-online__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  const actions = el("div", "cm-online__actions");
  const bindEmail = button("bindEmail", "cm-online__button--primary"), bindGoogle = button("bindGoogle"), signIn = button("signInEmail", "cm-online__button--ghost");
  const backup = button("backupNow", "cm-online__button--primary"), restore = button("restoreCloud"), transfer = button("transferCode"), redeem = button("redeemCode", "cm-online__button--ghost"), signOut = button("signOut", "cm-online__button--ghost");
  bindGoogle.hidden = !googleSignIn;
  actions.append(bindEmail, bindGoogle, signIn, backup, restore, transfer, redeem, signOut);
  const form = el("form", "cm-online__form"); form.hidden = true;
  root.append(head, hint, localNote, actions, form, status);

  let unsubscribe = null, busy = false, lastState = null;
  const say = (text, tone = "info") => { status.hidden = !text; status.textContent = text ?? ""; status.dataset.tone = tone; };
  const summary = text => { const s = summarizeSaveText(text ?? ""); return s.valid ? onlineText("summaryLine", { name: s.trainerName ?? onlineText("unknown"), bits: s.bits ?? onlineText("unknown"), roster: s.roster ?? onlineText("unknown"), at: s.updatedAt ? formatDateTime(s.updatedAt) : onlineText("unknown") }) : onlineText("unknown"); };
  const cloudSummary = c => c?.summary ? onlineText("summaryLine", { name: c.summary.trainerName ?? onlineText("unknown"), bits: c.summary.bits ?? onlineText("unknown"), roster: c.summary.roster ?? onlineText("unknown"), at: c.updatedAt ? formatDateTime(c.updatedAt) : onlineText("unknown") }) : onlineText("unknown");

  function paint(state) {
    lastState = state;
    const identity = state.identity;
    const guest = identity?.isAnonymous !== false;
    badge.textContent = guest ? onlineText("guestPass") : onlineText("linkedAccount"); badge.dataset.kind = guest ? "guest" : "linked";
    idValue.textContent = identity?.tamerCode ?? onlineText("unknown"); root.dataset.tamerCode = identity?.tamerCode ?? "";
    mode.textContent = !state.configured ? onlineText("modeLocal") : !state.online ? onlineText("modeOffline") : state.mode === "SUPABASE" ? onlineText("modeCloud") : onlineText("modeLoading");
    mode.dataset.mode = state.mode; root.dataset.mode = state.mode; root.dataset.configured = String(state.configured);
    localNote.hidden = state.configured;
    sync.textContent = onlineText(SYNC_KEY[state.syncState] ?? "syncLocalOnly"); sync.dataset.state = state.syncState;
    const last = state.lastSync ? onlineText("lastBackup", { at: formatDateTime(state.lastSync.at), rev: state.lastSync.serverRevision }) : onlineText("neverBackedUp");
    sync.title = last;
    bindEmail.hidden = !guest; bindGoogle.hidden = !guest || !googleSignIn || state.mode !== "SUPABASE"; signIn.hidden = !guest || state.mode !== "SUPABASE";
    signOut.hidden = guest || state.mode !== "SUPABASE";
    for (const b of actions.querySelectorAll("button")) b.disabled = busy;
  }
  async function run(label, task) {
    if (busy) return;
    busy = true; paint(lastState ?? service.state); say(label ?? "", "info");
    try { await task(); } catch (error) { say(onlineReasonText(error?.reason ?? error?.message ?? error), "error"); }
    finally { busy = false; paint(service.state); }
  }
  function askForm({ fields, submitKey, onSubmit }) {
    form.replaceChildren(); form.hidden = false;
    const inputs = fields.map(field => { const input = el("input", "cm-online__input"); input.type = field.type ?? "text"; input.placeholder = onlineText(field.placeholder); input.autocomplete = field.autocomplete ?? "off"; input.required = true; input.setAttribute("aria-label", onlineText(field.placeholder)); if (field.inputMode) input.inputMode = field.inputMode; form.append(input); return input; });
    const submit = el("button", "cm-online__button cm-online__button--primary", onlineText(submitKey)); submit.type = "submit";
    const cancel = el("button", "cm-online__button cm-online__button--ghost", onlineText("cancel")); cancel.type = "button"; cancel.addEventListener("click", () => { form.hidden = true; form.replaceChildren(); });
    form.append(submit, cancel);
    form.onsubmit = event => { event.preventDefault(); const values = inputs.map(i => i.value.trim()); form.hidden = true; form.replaceChildren(); void onSubmit(...values); };
    inputs[0]?.focus({ preventScroll: true });
  }

  copy.addEventListener("click", async () => { try { await clipboard?.writeText?.(idValue.textContent); say(onlineText("copied")); } catch { say(onlineText("unknown")); } });
  bindEmail.addEventListener("click", () => askForm({ fields: [{ placeholder: "emailPlaceholder", type: "email", autocomplete: "email" }], submitKey: "sendCode", onSubmit: email => run(null, async () => {
    const sent = await service.bindEmail(email);
    if (!sent?.ok) { say(onlineReasonText(sent?.reason), "error"); return; }
    say(onlineText("otpSent", { email }));
    askForm({ fields: [{ placeholder: "codePlaceholder", inputMode: "numeric", autocomplete: "one-time-code" }], submitKey: "verifyCode", onSubmit: token => run(null, async () => {
      const done = await service.verifyEmailOtp(email, token);
      say(done?.ok ? onlineText("bound", { email }) : onlineReasonText(done?.reason), done?.ok ? "ok" : "error");
    }) });
  }) }));
  signIn.addEventListener("click", () => askForm({ fields: [{ placeholder: "emailPlaceholder", type: "email", autocomplete: "email" }], submitKey: "sendCode", onSubmit: email => run(null, async () => {
    const sent = await service.signInWithEmailOtp(email);
    if (!sent?.ok) { say(onlineReasonText(sent?.reason), "error"); return; }
    say(onlineText("otpSent", { email }));
    askForm({ fields: [{ placeholder: "codePlaceholder", inputMode: "numeric", autocomplete: "one-time-code" }], submitKey: "verifyCode", onSubmit: token => run(null, async () => {
      const done = await service.verifyLoginOtp(email, token);
      say(done?.ok ? onlineText("bound", { email }) : onlineReasonText(done?.reason), done?.ok ? "ok" : "error");
    }) });
  }) }));
  bindGoogle.addEventListener("click", () => run(null, async () => { const out = await service.bindGoogle(); if (!out?.ok) say(onlineReasonText(out?.reason), "error"); }));
  async function backupNow(force = false) {
    const text = getSaveText();
    if (!text) { say(onlineReasonText("NO_LOCAL_SAVE"), "error"); return; }
    const result = await service.backupNow(text, { force });
    if (result?.ok) { say(onlineText("backupDone", { rev: result.serverRevision }), "ok"); return; }
    if (result?.reason === "CONFLICT") {
      const choice = confirm ? await confirm({ title: onlineText("conflictTitle"), message: onlineText("conflictBody", { cloud: cloudSummary(result), local: summary(text) }),
        actions: [{ id: "cancel", label: onlineText("cancel"), tone: "secondary" }, { id: "cloud", label: onlineText("keepCloud"), tone: "secondary" }, { id: "local", label: onlineText("keepLocal"), tone: "primary" }], cancelId: "cancel" }) : "cancel";
      if (choice === "local") return backupNow(true);
      if (choice === "cloud") return restoreNow(true);
      return;
    }
    say(onlineText("backupFailed", { reason: onlineReasonText(result?.reason) }), "error");
  }
  async function restoreNow(skipConfirm = false) {
    const cloud = await service.restoreFromCloud();
    if (!cloud?.ok) { say(cloud?.reason === "NO_CLOUD_SAVE" ? onlineText("noCloudSave") : onlineText("restoreFailed", { reason: onlineReasonText(cloud?.reason) }), "error"); return; }
    if (!skipConfirm && confirm) {
      const choice = await confirm({ title: onlineText("restoreConfirmTitle"), message: onlineText("restoreConfirm", { summary: cloudSummary(cloud) }),
        actions: [{ id: "cancel", label: onlineText("cancel"), tone: "secondary" }, { id: "restore", label: onlineText("restoreCloud"), tone: "danger" }], cancelId: "cancel" });
      if (choice !== "restore") return;
    }
    const written = await restoreSave(cloud.payload);
    say(written?.ok ? onlineText("restoreDone") : onlineText("restoreFailed", { reason: onlineReasonText(written?.reason) }), written?.ok ? "ok" : "error");
  }
  backup.addEventListener("click", () => run(onlineText("syncSyncing"), () => backupNow(false)));
  restore.addEventListener("click", () => run(null, () => restoreNow(false)));
  transfer.addEventListener("click", () => run(null, async () => {
    const out = await service.createTransferCode();
    say(out?.ok ? onlineText("transferMade", { code: out.transferCode }) : onlineReasonText(out?.reason), out?.ok ? "ok" : "error");
  }));
  redeem.addEventListener("click", () => askForm({ fields: [{ placeholder: "transferPlaceholder", autocomplete: "off" }], submitKey: "redeemCode", onSubmit: code => run(null, async () => {
    const out = await service.redeemTransferCode(code);
    if (!out?.ok) { say(onlineText("restoreFailed", { reason: onlineReasonText(out?.reason) }), "error"); return; }
    const written = await restoreSave(out.payload);
    say(written?.ok ? onlineText("restoreDone") : onlineText("restoreFailed", { reason: onlineReasonText(written?.reason) }), written?.ok ? "ok" : "error");
  }) }));
  signOut.addEventListener("click", () => run(null, async () => { await service.signOut(); }));

  return Object.freeze({
    element: root,
    mount(container) {
      container.append(root);
      unsubscribe?.(); unsubscribe = service.subscribe(paint);
      void service.getIdentitySummary().then(() => paint(service.state));
      return root;
    },
    refresh() { paint(service.state); },
    dispose() { unsubscribe?.(); unsubscribe = null; root.remove(); }
  });
}
