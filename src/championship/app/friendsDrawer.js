// 【👥 好友與馴獸師名片】 drawer (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
// One native <dialog>: my tamer code with one-tap copy, add a friend by code,
// incoming requests, and friend cards whose raised arcade 【⚔️ 友誼切磋】 button
// loads the friend's defense team (their password-battle code) into an AI
// password battle through the injected onSpar hook. Nothing here touches the
// save or the battle runtime; it only reads cards from championshipCloudService.

import { onlineText, onlineReasonText } from "../text/onlineText.js";
import { formatDateTime } from "../text/locale.js";

export const FRIENDS_DRAWER_OPEN_EVENT = "cm-open-friends-drawer";

export function createFriendsDrawer({ service, doc = globalThis.document, onSpar = null, onSetDefense = null, clipboard = globalThis.navigator?.clipboard ?? null } = {}) {
  if (!service) throw new TypeError("ONLINE_SERVICE_REQUIRED");
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const button = (key, extra = "", text = onlineText(key)) => { const b = el("button", `cm-online__button ${extra}`.trim(), text); b.type = "button"; b.dataset.onlineAction = key; return b; };
  const dialog = el("dialog", "cm-dialog cm-online-drawer"); dialog.dataset.variant = "friends"; dialog.setAttribute("aria-labelledby", "cm-friends-title");
  const panel = el("div", "cm-dialog__panel cm-online-drawer__panel");
  const title = el("h2", "cm-dialog__title", onlineText("friendsTitle")); title.id = "cm-friends-title";
  const card = el("section", "cm-online__card cm-online__card--mine");
  const codeLabel = el("p", "cm-online__label", onlineText("myCode")); const codeValue = el("strong", "cm-online__code", onlineText("unknown"));
  const copy = button("copy", "cm-online__button--ghost"); const modeTag = el("span", "cm-online__tag"); modeTag.hidden = true;
  const codeRow = el("div", "cm-online__row"); codeRow.append(codeValue, copy, modeTag);
  const defense = button("setDefense", "cm-online__button--ghost");
  card.append(codeLabel, codeRow, defense);
  const add = el("form", "cm-online__form cm-online__form--inline");
  const input = el("input", "cm-online__input"); input.placeholder = onlineText("friendCodePlaceholder"); input.autocomplete = "off"; input.autocapitalize = "characters"; input.setAttribute("aria-label", onlineText("friendCodePlaceholder")); input.maxLength = 12;
  const addButton = el("button", "cm-online__button cm-online__button--primary", onlineText("addFriend")); addButton.type = "submit";
  add.append(input, addButton);
  const status = el("p", "cm-online__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  const requestsHead = el("h3", "cm-online__section", onlineText("requests")); const requests = el("ul", "cm-online__list"); requests.dataset.list = "requests";
  const friendsHead = el("h3", "cm-online__section", onlineText("friends")); const friends = el("ul", "cm-online__list"); friends.dataset.list = "friends";
  const foot = el("div", "cm-dialog__actions"); const close = el("button", "cm-dialog__action cm-dialog__action--secondary", onlineText("close")); close.type = "button"; close.dataset.action = "close"; foot.append(close);
  panel.append(title, card, add, status, requestsHead, requests, friendsHead, friends, foot);
  dialog.append(panel);
  doc.body.append(dialog);

  let busy = false, opened = false;
  const say = (text, tone = "info") => { status.hidden = !text; status.textContent = text ?? ""; status.dataset.tone = tone; };
  const setBusy = value => { busy = value; dialog.dataset.busy = String(value); for (const b of panel.querySelectorAll("button")) if (b !== close) b.disabled = value; };

  function friendCard(friend) {
    const item = el("li", "cm-online__friend"); item.dataset.friendshipId = friend.friendshipId ?? ""; item.dataset.userId = friend.userId ?? "";
    const main = el("div", "cm-online__friend-main");
    const name = el("p", "cm-online__friend-name", friend.tamerName || friend.tamerCode); if (friend.simulated) { const tag = el("span", "cm-online__tag", onlineText("simulatedTag")); name.append(" ", tag); }
    const meta = el("p", "cm-online__friend-meta", `${friend.tamerCode} · ${onlineText("rank")} ${friend.rankTitle || onlineText("unknown")}${friend.acePartner?.name ? ` · ${onlineText("ace")} ${friend.acePartner.name}` : ""}`);
    const seen = el("p", "cm-online__friend-seen", friend.lastSeenAt ? onlineText("lastSeen", { at: formatDateTime(friend.lastSeenAt) }) : "");
    main.append(name, meta, seen);
    const side = el("div", "cm-online__friend-side");
    if (friend.status === "pending" && friend.direction === "incoming") {
      const accept = button("accept", "cm-online__button--primary"), decline = button("decline", "cm-online__button--ghost");
      accept.addEventListener("click", () => act(() => service.respondFriendRequest(friend.friendshipId, true)));
      decline.addEventListener("click", () => act(() => service.respondFriendRequest(friend.friendshipId, false)));
      side.append(accept, decline);
    } else if (friend.status === "pending") {
      side.append(el("span", "cm-online__pending", onlineText("pending")));
    } else {
      const spar = button("spar", "cm-online__button--spar"); spar.disabled = !friend.hasDefenseTeam && !friend.simulated; spar.title = spar.disabled ? onlineText("noDefense") : "";
      spar.addEventListener("click", () => act(async () => {
        say(onlineText("sparStart", { name: friend.tamerName || friend.tamerCode }));
        const team = await service.getFriendDefenseTeam(friend.userId);
        if (!team?.defenseTeam?.passwordCode) { say(onlineText("sparFailed", { reason: onlineText("noDefense") }), "error"); return; }
        const started = await onSpar?.({ friend, defense: team.defenseTeam });
        if (started?.ok === false) say(onlineText("sparFailed", { reason: onlineReasonText(started.reason) }), "error"); else closeDrawer();
      }));
      const remove = button("remove", "cm-online__button--ghost"); remove.addEventListener("click", () => act(() => service.removeFriend(friend.friendshipId)));
      side.append(spar, remove);
    }
    item.append(main, side);
    return item;
  }
  async function act(task) { if (busy) return; setBusy(true); try { await task(); await refresh(); } catch (error) { say(onlineReasonText(error?.reason ?? error?.message), "error"); } finally { setBusy(false); } }
  async function refresh() {
    const identity = await service.getIdentitySummary();
    codeValue.textContent = identity.tamerCode ?? onlineText("unknown"); dialog.dataset.tamerCode = identity.tamerCode ?? "";
    modeTag.hidden = !identity.simulated; modeTag.textContent = onlineText("simulatedTag");
    const list = await service.listFriends();
    const pending = list.filter(f => f.status === "pending"), accepted = list.filter(f => f.status === "accepted");
    requests.replaceChildren(...pending.map(friendCard)); requestsHead.hidden = requests.hidden = pending.length === 0;
    friends.replaceChildren(...(accepted.length ? accepted.map(friendCard) : [el("li", "cm-online__empty", onlineText("noFriends"))]));
  }
  add.addEventListener("submit", event => { event.preventDefault(); const code = input.value.trim().toUpperCase(); if (!code) return; act(async () => {
    const out = await service.addFriend(code);
    say(out?.ok ? onlineText("requestSent", { code }) : onlineText("requestFailed", { reason: onlineReasonText(out?.reason) }), out?.ok ? "ok" : "error");
    if (out?.ok) input.value = "";
  }); });
  copy.addEventListener("click", async () => { try { await clipboard?.writeText?.(codeValue.textContent); say(onlineText("copied")); } catch { /* clipboard blocked */ } });
  defense.addEventListener("click", () => act(async () => { const out = await onSetDefense?.(); say(out?.ok ? onlineText("defenseSet") : out?.reason === "TEAM_REQUIRED" ? onlineText("defenseNeedsTeam") : onlineReasonText(out?.reason), out?.ok ? "ok" : "error"); }));
  close.addEventListener("click", () => closeDrawer());
  dialog.addEventListener("cancel", event => { event.preventDefault(); closeDrawer(); });
  dialog.addEventListener("click", event => { if (event.target === dialog) closeDrawer(); });
  // No history entry of its own: the app's session history guard owns back/popstate,
  // and a drawer that popped its own entry would step the screen stack back as well.
  function openDrawer() {
    if (opened) return; opened = true; say("");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    void act(async () => {});
  }
  function closeDrawer() {
    if (!opened) return; opened = false;
    try { if (dialog.open) dialog.close(); } catch { /* closed */ }
  }
  doc.addEventListener(FRIENDS_DRAWER_OPEN_EVENT, openDrawer);

  return Object.freeze({ element: dialog, open: openDrawer, close: closeDrawer, refresh, get isOpen() { return opened; }, dispose() { doc.removeEventListener(FRIENDS_DRAWER_OPEN_EVENT, openDrawer); closeDrawer(); dialog.remove(); } });
}
