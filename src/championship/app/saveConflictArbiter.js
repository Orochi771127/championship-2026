// 📱 This device vs. ☁️ cloud: the side-by-side save chooser (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// Shown whenever two copies of the player's progress disagree: a backup that
// met a newer cloud revision, a restore, a sign-in to an account that already
// has a cloud save, or a transfer code. Nothing is overwritten until the player
// presses a side; "decide later" leaves both copies exactly as they are. The
// cards read only the display summary (cloudSaveEnvelope.summarizeSaveText) and
// an optional "download a local backup first" button runs the injected hook.

import { onlineText } from "../text/onlineText.js";
import { formatDateTime } from "../text/locale.js";
import { tamerRankName } from "../text/zhHant.js";

const number = value => (Number.isSafeInteger(value) ? value.toLocaleString() : onlineText("unknown"));
const lead = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && a !== b ? (a > b ? "local" : "remote") : null);

/**
 * The rows both cards show, as display strings, with the side that leads on
 * each comparable row ('local' | 'remote' | null). Pure: no DOM, no clock.
 */
export function describeSaveSides({ local = null, remote = null, remoteMeta = {} } = {}) {
  const time = value => { const at = Date.parse(value ?? ""); return Number.isNaN(at) ? null : at; };
  const localAt = time(local?.updatedAt), remoteAt = time(remoteMeta.updatedAt ?? remote?.updatedAt);
  const rank = value => (Number.isInteger(value) ? tamerRankName(value) ?? String(value) : onlineText("unknown"));
  const rows = [
    { id: "name", label: "arbiterName", local: local?.trainerName || onlineText("unknown"), remote: remote?.trainerName || onlineText("unknown"), lead: null, tag: null },
    { id: "rank", label: "arbiterRank", local: rank(local?.rank), remote: rank(remote?.rank), lead: lead(local?.rank, remote?.rank), tag: "arbiterMore" },
    { id: "days", label: "arbiterDays", local: Number.isSafeInteger(local?.days) ? onlineText("arbiterDaysValue", { n: local.days }) : onlineText("unknown"),
      remote: Number.isSafeInteger(remote?.days) ? onlineText("arbiterDaysValue", { n: remote.days }) : onlineText("unknown"), lead: lead(local?.days, remote?.days), tag: "arbiterMore" },
    { id: "bits", label: "arbiterBits", local: number(local?.bits), remote: number(remote?.bits), lead: lead(local?.bits, remote?.bits), tag: "arbiterMore" },
    { id: "roster", label: "arbiterRoster", local: Number.isSafeInteger(local?.roster) ? onlineText("arbiterRosterValue", { n: local.roster }) : onlineText("unknown"),
      remote: Number.isSafeInteger(remote?.roster) ? onlineText("arbiterRosterValue", { n: remote.roster }) : onlineText("unknown"), lead: lead(local?.roster, remote?.roster), tag: "arbiterMore" },
    { id: "updated", label: "arbiterUpdated", local: localAt === null ? onlineText("unknown") : formatDateTime(new Date(localAt).toISOString()),
      remote: remoteAt === null ? onlineText("unknown") : formatDateTime(new Date(remoteAt).toISOString()), lead: lead(localAt, remoteAt), tag: "arbiterNewer" }
  ];
  if (remoteMeta.deviceLabel) rows.push({ id: "device", label: "arbiterDevice", local: onlineText("unknown"), remote: String(remoteMeta.deviceLabel), lead: null, tag: null });
  return Object.freeze(rows.map(row => Object.freeze(row)));
}

/** The two cards as one DOM block (the dialog's rich content). */
export function buildSaveConflictCards({ doc = globalThis.document, local = null, remote = null, remoteMeta = {}, remoteKind = "cloud", onBackup = null } = {}) {
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const root = el("div", "cm-arbiter"); root.dataset.remoteKind = remoteKind;
  const grid = el("div", "cm-arbiter__grid"); grid.setAttribute("role", "table");
  const head = el("div", "cm-arbiter__row cm-arbiter__row--head"); head.setAttribute("role", "row");
  const corner = el("span", "cm-arbiter__label"); corner.setAttribute("role", "columnheader");
  const localHead = el("strong", "cm-arbiter__side cm-arbiter__side--local", local ? onlineText("arbiterLocal") : onlineText("arbiterNoLocal")); localHead.setAttribute("role", "columnheader");
  const remoteHead = el("strong", "cm-arbiter__side cm-arbiter__side--remote", onlineText(remoteKind === "incoming" ? "arbiterIncoming" : "arbiterCloud")); remoteHead.setAttribute("role", "columnheader");
  head.append(corner, localHead, remoteHead); grid.append(head);
  for (const row of describeSaveSides({ local, remote, remoteMeta })) {
    const line = el("div", "cm-arbiter__row"); line.setAttribute("role", "row"); line.dataset.row = row.id;
    const label = el("span", "cm-arbiter__label", onlineText(row.label)); label.setAttribute("role", "rowheader");
    const cell = side => {
      const node = el("span", `cm-arbiter__value cm-arbiter__value--${side}`, row[side]); node.setAttribute("role", "cell");
      if (row.lead === side && row.tag) { node.dataset.lead = "true"; node.append(el("em", "cm-arbiter__tag", onlineText(row.tag))); }
      return node;
    };
    line.append(label, cell("local"), cell("remote")); grid.append(line);
  }
  root.append(grid);
  if (typeof onBackup === "function" && local) {
    const status = el("p", "cm-arbiter__status"); status.setAttribute("role", "status"); status.hidden = true;
    const backup = el("button", "cm-arbiter__backup cm-arcade-key", onlineText("arbiterBackup")); backup.type = "button"; backup.dataset.action = "download-local-backup";
    backup.addEventListener("click", async () => { try { await onBackup(); status.hidden = false; status.textContent = onlineText("arbiterBackupDone"); } catch { status.hidden = false; status.textContent = onlineText("unknown"); } });
    root.append(backup, status);
  }
  return root;
}

/**
 * Ask which copy to keep. Resolves 'local', 'remote' or 'later' (Escape, a
 * backdrop tap, or another dialog already open all count as 'later').
 * For a transfer code there is nothing to upload, so keeping this device is
 * the same as deciding later and only two choices are offered.
 */
export async function chooseSaveSide({ showChoiceDialog, doc = globalThis.document, local = null, remote = null, remoteMeta = {}, remoteKind = "cloud", onBackup = null } = {}) {
  if (typeof showChoiceDialog !== "function") return "later";
  const content = buildSaveConflictCards({ doc, local, remote, remoteMeta, remoteKind, onBackup });
  const actions = [{ id: "later", label: onlineText("arbiterLater"), tone: "secondary" },
    { id: "remote", label: onlineText(remoteKind === "incoming" ? "arbiterUseIncoming" : "arbiterUseCloud"), tone: "danger" }];
  if (remoteKind !== "incoming" && local) actions.push({ id: "local", label: onlineText("arbiterKeepLocal"), tone: "primary" });
  const choice = await showChoiceDialog({ title: onlineText("arbiterTitle"), message: onlineText("arbiterBody"), content, variant: "arbiter", actions, cancelId: "later", focusId: "later", doc });
  return choice === "local" || choice === "remote" ? choice : "later";
}
