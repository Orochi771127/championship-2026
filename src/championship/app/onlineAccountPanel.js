// 🪪 數碼通行證: account & cloud sync (OWNER_APPROVED_ADAPTATION 2026-10-28,
// passport and provider binding 2026-10-29).
//
// A DOM block mounted in the settings "資料與帳號" page and on Tamer Info, plus
// a compact strip for the ranch System menu. It only talks to
// championshipCloudService and to injected callbacks: getSaveText() (the
// serialized local save), restoreSave(payload) (validated and written through
// the save port by the app), onProviderBound(provider, result) (the first-bind
// gift), chooseSaveSide(...) (the side-by-side chooser) and downloadBackup().
// The sync pill follows the service state and never claims "已同步" on its own;
// no copy is ever overwritten without the player picking a side.

import { onlineText, onlineReasonText, ONLINE_PROVIDER_NAMES } from "../text/onlineText.js";
import { formatDateTime } from "../text/locale.js";
import { summarizeSaveText, sha256Hex } from "../online/cloudSaveEnvelope.js";
import { chooseSaveSide as chooseSaveSideDialog } from "./saveConflictArbiter.js";

const SYNC_KEY = Object.freeze({ LOCAL_ONLY: "syncLocalOnly", SYNCING: "syncSyncing", SYNCED: "syncSynced", OFFLINE: "syncOffline", FAILED: "syncFailed", CHOICE: "syncChoice" });
// The three provider keys. Glyphs are plain text, not brand artwork.
export const PASSPORT_PROVIDERS = Object.freeze([
  Object.freeze({ id: "google", glyph: "G" }),
  Object.freeze({ id: "facebook", glyph: "f" }),
  Object.freeze({ id: "discord", glyph: "🎮" })
]);
const providerName = provider => ONLINE_PROVIDER_NAMES[provider] ?? provider;

/**
 * Link the guest pass to a provider. In the cloud the page leaves for the
 * provider and returns (main.js finishes the gift); in the local simulation the
 * player confirms a clearly labelled rehearsal and the gift preview follows.
 */
export async function bindProviderFlow({ service, provider, confirm = null, oauthProviders = [], say = () => {}, onProviderBound = null }) {
  const identity = await service.getIdentitySummary();
  const name = providerName(provider);
  if (identity.providers?.includes(provider)) { say(onlineText("providerLinkedKey", { provider: name }), "ok"); return Object.freeze({ ok: true, already: true }); }
  if (!identity.simulated) {
    if (!oauthProviders.includes(provider)) { say(onlineText("providerNotEnabled", { provider: name }), "error"); return Object.freeze({ ok: false, reason: "PROVIDER_NOT_ENABLED" }); }
    say(onlineText("providerRedirect", { provider: name }));
    const out = await service.bindProvider(provider);
    if (!out?.ok) say(onlineText("providerFailed", { reason: onlineReasonText(out?.reason ?? out?.message) }), "error");
    return out;
  }
  if (confirm) {
    const choice = await confirm({ title: onlineText("providerSimTitle", { provider: name }), message: onlineText("providerSimBody", { provider: name }),
      actions: [{ id: "cancel", label: onlineText("cancel"), tone: "secondary" }, { id: "allow", label: onlineText("providerSimAllow"), tone: "primary" }], cancelId: "cancel", variant: "provider-sim" });
    if (choice !== "allow") return Object.freeze({ ok: false, reason: "CANCELLED" });
  }
  const out = await service.bindProvider(provider);
  if (!out?.ok) { say(onlineText("providerFailed", { reason: onlineReasonText(out?.reason) }), "error"); return out; }
  say(onlineText("providerSimBound", { provider: name }), "ok");
  await onProviderBound?.(provider, out);
  return out;
}

function makeHelpers(doc) {
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const button = (key, extra = "", text = onlineText(key)) => { const b = el("button", `cm-online__button ${extra}`.trim(), text); b.type = "button"; b.dataset.onlineAction = key; return b; };
  const providerKey = (provider, extra = "") => {
    const key = el("button", `cm-passport__provider cm-arcade-key ${extra}`.trim()); key.type = "button"; key.dataset.provider = provider.id; key.dataset.onlineAction = `bind-${provider.id}`;
    const glyph = el("span", "cm-passport__provider-glyph", provider.glyph); glyph.setAttribute("aria-hidden", "true");
    key.append(glyph, el("span", "cm-passport__provider-label"));
    return key;
  };
  return { el, button, providerKey };
}

function paintProviderKeys(keys, identity, { simulated, oauthProviders, compact = false }) {
  for (const key of keys) {
    const provider = key.dataset.provider, linked = Boolean(identity?.providers?.includes(provider));
    const full = onlineText(linked ? "providerLinkedKey" : "bindProviderKey", { provider: providerName(provider) });
    key.dataset.linked = String(linked); key.setAttribute("aria-pressed", String(linked));
    key.dataset.state = linked ? "linked" : simulated || oauthProviders.includes(provider) ? "ready" : "off";
    // The menu strip is narrow: the provider's name on the key, the full sentence for assistive tech.
    key.querySelector(".cm-passport__provider-label").textContent = compact ? `${linked ? "✓ " : ""}${providerName(provider)}` : full;
    key.setAttribute("aria-label", full);
  }
}

export function createOnlineAccountPanel({ service, doc = globalThis.document, getSaveText = () => null, restoreSave = async () => ({ ok: false, reason: "RESTORE_UNAVAILABLE" }),
  confirm = null, googleSignIn = false, oauthProviders = [], standalone = false, onProviderBound = null, chooseSaveSide = null, downloadBackup = null,
  fallbackCode = null, clipboard = globalThis.navigator?.clipboard ?? null } = {}) {
  if (!service) throw new TypeError("ONLINE_SERVICE_REQUIRED");
  const providersOn = [...new Set([...(googleSignIn ? ["google"] : []), ...oauthProviders])];
  const { el, button, providerKey } = makeHelpers(doc);
  const root = el("section", "cm-online cm-online--account cm-passport"); root.dataset.onlinePanel = "account"; root.dataset.standalone = String(Boolean(standalone));
  // The licence card: pass kind, linked providers, tamer code, mode and sync.
  const head = el("header", "cm-online__head cm-passport__card");
  const title = el("p", "cm-passport__title", onlineText("passportTitle"));
  const badge = el("p", "cm-online__badge"); const linkedLine = el("p", "cm-passport__linked"); linkedLine.hidden = true;
  const idLine = el("p", "cm-online__id");
  const idValue = el("strong", "cm-online__code"); const copy = button("copy", "cm-online__button--ghost");
  idLine.append(el("span", "", onlineText("tamerId") + " "), idValue, copy);
  const mode = el("p", "cm-online__mode"); const sync = el("p", "cm-online__sync");
  head.append(title, badge, linkedLine, idLine, mode, sync);
  const localNote = el("p", "cm-online__note", onlineText("localNote")); localNote.hidden = true;
  // Google / Facebook / Discord.
  const providerRow = el("div", "cm-passport__providers");
  const providerKeys = PASSPORT_PROVIDERS.map(provider => { const key = providerKey(provider); providerRow.append(key); return key; });
  // iPhone Home Screen app: OAuth leaves for Safari, so the in-app routes come first.
  const standaloneNote = el("section", "cm-passport__standalone"); standaloneNote.hidden = !standalone;
  standaloneNote.append(el("strong", "cm-passport__standalone-title", onlineText("standaloneTitle")), el("p", "cm-online__hint", onlineText("standaloneBody")));
  const transferBox = el("section", "cm-passport__transfer");
  const transfer = button("transferCode", "cm-online__button--primary"), redeem = button("redeemCode"), signIn = button("signInEmail"), bindEmail = button("bindEmail", "cm-online__button--ghost");
  const codeBox = el("p", "cm-passport__codebox"); codeBox.hidden = true;
  const transferActions = el("div", "cm-online__actions"); transferActions.append(transfer, redeem, signIn, bindEmail);
  transferBox.append(el("h3", "cm-online__title", onlineText("transferTitle")), el("p", "cm-online__hint", onlineText("transferHint")), transferActions, codeBox);
  const cloudBox = el("section", "cm-passport__cloud");
  const backup = button("backupNow", "cm-online__button--primary"), restore = button("restoreCloud"), signOut = button("signOut", "cm-online__button--ghost");
  const cloudActions = el("div", "cm-online__actions"); cloudActions.append(backup, restore, signOut);
  cloudBox.append(el("h3", "cm-online__title", onlineText("cloudTitle")), el("p", "cm-online__hint", onlineText("accountHint")), cloudActions);
  const form = el("form", "cm-online__form"); form.hidden = true;
  const status = el("p", "cm-online__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  root.append(head, localNote, ...(standalone ? [standaloneNote, transferBox, providerRow] : [providerRow, standaloneNote, transferBox]), cloudBox, form, status);

  let unsubscribe = null, busy = false, lastState = null;
  const say = (text, tone = "info") => { status.hidden = !text; status.textContent = text ?? ""; status.dataset.tone = tone; };
  const localSummary = () => { const s = summarizeSaveText(getSaveText() ?? ""); return s.valid ? s : null; };
  const choose = args => (chooseSaveSide ?? (options => chooseSaveSideDialog({ showChoiceDialog: confirm, doc, onBackup: downloadBackup, ...options })))(args);

  function paint(state) {
    lastState = state;
    const identity = state.identity, guest = identity?.isAnonymous !== false, simulated = state.mode !== "SUPABASE";
    badge.textContent = guest ? onlineText("guestPass") : onlineText("linkedAccount"); badge.dataset.kind = guest ? "guest" : "linked";
    root.dataset.passport = guest ? "guest" : "linked";
    const providers = (identity?.providers ?? []).map(providerName);
    linkedLine.hidden = providers.length === 0; linkedLine.textContent = providers.length ? onlineText("providersLinked", { list: providers.join(" · ") }) : "";
    // Before any online action the card shows the device's own tamer code (futureSystemsPort), the code a cloud profile adopts.
    const code = identity?.tamerCode ?? fallbackCode?.() ?? null;
    idValue.textContent = code ?? onlineText("unknown"); root.dataset.tamerCode = code ?? "";
    mode.textContent = !state.configured ? onlineText("modeLocal") : !state.online ? onlineText("modeOffline") : state.mode === "SUPABASE" ? onlineText("modeCloud") : onlineText("modeLoading");
    mode.dataset.mode = state.mode; root.dataset.mode = state.mode; root.dataset.configured = String(state.configured);
    localNote.hidden = state.configured;
    sync.textContent = onlineText(SYNC_KEY[state.syncState] ?? "syncLocalOnly"); sync.dataset.state = state.syncState;
    sync.title = state.lastSync ? onlineText("lastBackup", { at: formatDateTime(state.lastSync.at), rev: state.lastSync.serverRevision }) : onlineText("neverBackedUp");
    paintProviderKeys(providerKeys, identity, { simulated, oauthProviders: providersOn });
    bindEmail.hidden = !guest; signOut.hidden = guest || state.mode !== "SUPABASE";
    for (const b of root.querySelectorAll("button")) if (b !== copy) b.disabled = busy;
  }
  async function run(label, task) {
    if (busy) return;
    busy = true; paint(lastState ?? service.state); say(label ?? "", "info");
    try { await task(); } catch (error) { say(onlineReasonText(error?.reason ?? error?.message ?? error), "error"); }
    finally { busy = false; paint(service.state); }
  }
  function askForm({ fields, submitKey, onSubmit }) {
    form.replaceChildren(); form.hidden = false;
    const inputs = fields.map(field => { const input = el("input", "cm-online__input"); input.type = field.type ?? "text"; input.placeholder = onlineText(field.placeholder); input.autocomplete = field.autocomplete ?? "off"; input.required = true; input.setAttribute("aria-label", onlineText(field.placeholder)); if (field.inputMode) input.inputMode = field.inputMode; if (field.maxLength) input.maxLength = field.maxLength; if (field.autocapitalize) input.autocapitalize = field.autocapitalize; form.append(input); return input; });
    const submit = el("button", "cm-online__button cm-online__button--primary", onlineText(submitKey)); submit.type = "submit";
    const cancel = el("button", "cm-online__button cm-online__button--ghost", onlineText("cancel")); cancel.type = "button"; cancel.addEventListener("click", () => { form.hidden = true; form.replaceChildren(); });
    form.append(submit, cancel);
    form.onsubmit = event => { event.preventDefault(); const values = inputs.map(i => i.value.trim()); form.hidden = true; form.replaceChildren(); void onSubmit(...values); };
    inputs[0]?.focus?.({ preventScroll: true });
  }
  /** Put the cloud copy on this device (the app reloads after a good write). */
  async function useRemote(payload, cloudResult = null) {
    const written = await restoreSave(payload);
    if (written?.ok && cloudResult) service.adoptCloudBaseline(cloudResult);
    say(written?.ok ? onlineText("restoreDone") : onlineText("restoreFailed", { reason: onlineReasonText(written?.reason) }), written?.ok ? "ok" : "error");
  }
  async function keepLocal() {
    const text = getSaveText();
    if (!text) { say(onlineReasonText("NO_LOCAL_SAVE"), "error"); return; }
    const forced = await service.backupNow(text, { force: true });
    say(forced?.ok ? onlineText("arbiterKeptLocal", { rev: forced.serverRevision }) : onlineText("backupFailed", { reason: onlineReasonText(forced?.reason) }), forced?.ok ? "ok" : "error");
  }
  /**
   * The cloud copy against this device: identical copies just become the sync
   * baseline; different ones go to the side-by-side chooser.
   */
  async function reconcileWithCloud({ allowEmpty = true } = {}) {
    const cloud = await service.peekCloudSave();
    if (!cloud?.ok) { if (!allowEmpty) say(onlineText("noCloudSave"), "error"); return; }
    const text = getSaveText();
    if (text && cloud.contentSha256 === await sha256Hex(text)) { service.adoptCloudBaseline(cloud); say(onlineText("arbiterSame"), "ok"); return; }
    const choice = await choose({ local: localSummary(), remote: summarizeSaveText(cloud.payload ?? "").valid ? summarizeSaveText(cloud.payload) : cloud.summary ?? null,
      remoteMeta: { updatedAt: cloud.updatedAt, deviceLabel: cloud.deviceLabel }, remoteKind: "cloud" });
    if (choice === "remote") await useRemote(cloud.payload, cloud);
    else if (choice === "local") await keepLocal();
    else say(onlineText("arbiterKeptLater"));
  }

  copy.addEventListener("click", async () => { try { await clipboard?.writeText?.(idValue.textContent); say(onlineText("copied")); } catch { say(onlineText("unknown")); } });
  for (const key of providerKeys) key.addEventListener("click", () => run(null, () => bindProviderFlow({ service, provider: key.dataset.provider, confirm, oauthProviders: providersOn, say, onProviderBound })));
  bindEmail.addEventListener("click", () => askForm({ fields: [{ placeholder: "emailPlaceholder", type: "email", autocomplete: "email" }], submitKey: "sendCode", onSubmit: email => run(null, async () => {
    const sent = await service.bindEmail(email);
    if (!sent?.ok) { say(onlineReasonText(sent?.reason), "error"); return; }
    say(onlineText("otpSent", { email }));
    askForm({ fields: [{ placeholder: "codePlaceholder", inputMode: "numeric", autocomplete: "one-time-code", maxLength: 10 }], submitKey: "verifyCode", onSubmit: token => run(null, async () => {
      const done = await service.verifyEmailOtp(email, token);
      say(done?.ok ? onlineText("bound", { email }) : onlineReasonText(done?.reason), done?.ok ? "ok" : "error");
      if (done?.ok) await onProviderBound?.("email", done);
    }) });
  }) }));
  signIn.addEventListener("click", () => askForm({ fields: [{ placeholder: "emailPlaceholder", type: "email", autocomplete: "email" }], submitKey: "sendCode", onSubmit: email => run(null, async () => {
    const sent = await service.signInWithEmailOtp(email);
    if (!sent?.ok) { say(onlineReasonText(sent?.reason), "error"); return; }
    say(onlineText("otpSent", { email }));
    askForm({ fields: [{ placeholder: "codePlaceholder", inputMode: "numeric", autocomplete: "one-time-code", maxLength: 10 }], submitKey: "verifyCode", onSubmit: token => run(null, async () => {
      const done = await service.verifyLoginOtp(email, token);
      if (!done?.ok) { say(onlineReasonText(done?.reason), "error"); return; }
      say(onlineText("bound", { email }), "ok");
      // A sign-in on this device: compare this device with the account's cloud copy before anything moves.
      await reconcileWithCloud({ allowEmpty: true });
    }) });
  }) }));
  async function backupNow() {
    const text = getSaveText();
    if (!text) { say(onlineReasonText("NO_LOCAL_SAVE"), "error"); return; }
    const result = await service.backupNow(text);
    if (result?.ok) { say(onlineText("backupDone", { rev: result.serverRevision }), "ok"); return; }
    if (result?.reason === "CONFLICT") { await reconcileWithCloud({ allowEmpty: false }); return; }
    say(onlineText("backupFailed", { reason: onlineReasonText(result?.reason) }), "error");
  }
  backup.addEventListener("click", () => run(onlineText("syncSyncing"), backupNow));
  restore.addEventListener("click", () => run(null, () => reconcileWithCloud({ allowEmpty: false })));
  transfer.addEventListener("click", () => run(null, async () => {
    let out = await service.createTransferCode();
    // A first transfer needs a cloud copy to point at: make it, then ask again.
    if (out?.reason === "BACKUP_REQUIRED" && getSaveText()) { const made = await service.backupNow(getSaveText()); if (made?.ok) out = await service.createTransferCode(); }
    if (!out?.ok) { say(onlineReasonText(out?.reason), "error"); return; }
    codeBox.hidden = false; codeBox.replaceChildren(el("span", "cm-passport__codebox-label", onlineText("transferYourCode")), el("strong", "cm-passport__codebox-value", out.transferCode));
    codeBox.dataset.transferCode = out.transferCode;
    say(onlineText("transferMade", { code: out.transferCode }), "ok");
  }));
  redeem.addEventListener("click", () => askForm({ fields: [{ placeholder: "transferPlaceholder", autocomplete: "off", maxLength: 9, autocapitalize: "characters" }], submitKey: "redeemCode", onSubmit: code => run(null, async () => {
    const out = await service.redeemTransferCode(code);
    if (!out?.ok) { say(onlineText("restoreFailed", { reason: onlineReasonText(out?.reason) }), "error"); return; }
    const remote = summarizeSaveText(out.payload ?? "");
    const choice = await choose({ local: localSummary(), remote: remote.valid ? remote : out.summary ?? null, remoteMeta: { updatedAt: out.updatedAt }, remoteKind: "incoming" });
    if (choice === "remote") await useRemote(out.payload, out); else say(onlineText("arbiterKeptLater"));
  }) }));
  signOut.addEventListener("click", () => run(null, async () => { await service.signOut(); }));

  return Object.freeze({
    element: root,
    /**
     * `eager: false` paints from what the service already knows, so merely
     * showing the panel (Tamer Info) never signs in to a configured cloud; any
     * button the player presses does.
     */
    mount(container, { eager = true } = {}) {
      container.append(root);
      unsubscribe?.(); unsubscribe = service.subscribe(paint);
      if (eager) void service.getIdentitySummary().then(() => paint(service.state));
      return root;
    },
    refresh() { paint(service.state); },
    /** After a sign-in elsewhere (an OAuth return): compare this device with the account's cloud copy. */
    reconcile: () => run(null, () => reconcileWithCloud({ allowEmpty: true })),
    say,
    dispose() { unsubscribe?.(); unsubscribe = null; root.remove(); }
  });
}

/**
 * The ranch System menu's compact passport: pass kind, code and the three
 * provider keys; "more" opens the full panel.
 */
export function createPassportStrip({ service, doc = globalThis.document, onProvider = null, onMore = null, oauthProviders = [], role = null, fallbackCode = null } = {}) {
  const { el, providerKey } = makeHelpers(doc);
  const root = el("section", "cm-passport-strip"); root.dataset.passportStrip = "true";
  const top = el("div", "cm-passport-strip__top");
  const badge = el("span", "cm-online__badge"); const code = el("strong", "cm-online__code");
  const more = el("button", "cm-passport-strip__more cm-arcade-key", "🪪 ▸"); more.type = "button"; more.dataset.onlineAction = "open-passport"; more.setAttribute("aria-label", onlineText("passportTitle"));
  if (role) more.setAttribute("role", role);
  const id = el("div", "cm-passport-strip__id"); id.append(badge, code);
  top.append(id, more);
  const row = el("div", "cm-passport__providers cm-passport__providers--compact");
  const keys = PASSPORT_PROVIDERS.map(provider => { const key = providerKey(provider, "cm-passport__provider--compact"); if (role) key.setAttribute("role", role); row.append(key); return key; });
  root.append(top, row);
  const paint = state => {
    const identity = state.identity, guest = identity?.isAnonymous !== false;
    badge.textContent = guest ? onlineText("guestPass") : onlineText("linkedAccount"); badge.dataset.kind = guest ? "guest" : "linked";
    code.textContent = identity?.tamerCode ?? fallbackCode?.() ?? onlineText("unknown"); root.dataset.passport = guest ? "guest" : "linked";
    paintProviderKeys(keys, identity, { simulated: state.mode !== "SUPABASE", oauthProviders, compact: true });
  };
  for (const key of keys) key.addEventListener("click", () => { onProvider?.(key.dataset.provider, key); });
  more.addEventListener("click", () => { onMore?.(more); });
  // Painted from what the service already knows: opening the menu never signs in to a configured cloud.
  const unsubscribe = service.subscribe(paint);
  return Object.freeze({ element: root, dispose() { unsubscribe?.(); root.remove(); } });
}
