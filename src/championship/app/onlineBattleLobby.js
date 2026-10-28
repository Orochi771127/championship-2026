// Online lobbies on the Battle menu (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
//   密碼對戰 → mountRoomLobby:  a 4-digit room carries the existing link-battle
//               invite/reply codes (pvpRoomSession) and hands both sides the
//               prepared link battle the menu already starts with 'LINK_BATTLE'.
//   通訊對戰 → mountQuickMatchLobby: quick match / ladder mirror draws another
//               player's defense team (their password-battle code) and starts
//               the existing PASSWORD_BATTLE with the player's own team code.
//
// Both are DOM sections prepended to the mode panel; the manual code exchange
// below them is unchanged. No battle logic lives here.
//
// 2026-10-29: both lobbies show the same passport identity (one account for
// binding, friends and rooms); the room lobby shows the opponent's Presence,
// copies the room code (which the brag card prints while the room is open)
// and lists friends whose AI defense team can be challenged right here.

import { onlineText, onlineReasonText } from "../text/onlineText.js";
import { createPvpRoomSession } from "../online/pvpRoomSession.js";

function helpers(doc) {
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const button = (key, extra = "", text = onlineText(key)) => { const b = el("button", `cm-online__button ${extra}`.trim(), text); b.type = "button"; b.dataset.onlineAction = key; return b; };
  return { el, button };
}

/** One account across binding, friends and rooms: the passport line both lobbies open with. */
function identityStrip(doc, service, modeTag) {
  const { el } = helpers(doc);
  const line = el("p", "cm-online__identity"); line.dataset.passport = "guest";
  void service.getIdentitySummary().then(id => {
    const guest = id.isAnonymous !== false;
    line.dataset.passport = guest ? "guest" : "linked"; line.dataset.tamerCode = id.tamerCode ?? "";
    line.textContent = onlineText("lobbyIdentity", { pass: onlineText(guest ? "guestPass" : "linkedAccount"), code: id.tamerCode ?? onlineText("unknown") });
    modeTag.textContent = id.simulated ? onlineText("modeLocal") : id.online ? onlineText("modeCloud") : onlineText("modeOffline"); modeTag.dataset.mode = id.mode;
  }).catch(() => {});
  return line;
}

/** A compact 1–3 partner picker over the battle candidates the app supplies. */
function teamPicker(doc, candidates, onChange) {
  const { el } = helpers(doc);
  const wrap = el("div", "cm-online__team"); const selected = [];
  wrap.append(el("p", "cm-online__label", onlineText("pickTeam")));
  const buttons = candidates.map(entry => {
    const b = el("button", "cm-online__member", entry.displayName ?? entry.name ?? entry.instanceId); b.type = "button"; b.dataset.instanceId = entry.instanceId; b.setAttribute("aria-pressed", "false");
    b.disabled = entry.admission && !entry.admission.ok;
    b.addEventListener("click", () => { const at = selected.indexOf(entry.instanceId); if (at < 0) { if (selected.length >= 3) return; selected.push(entry.instanceId); } else selected.splice(at, 1); paint(); onChange?.([...selected]); });
    wrap.append(b); return b;
  });
  function paint() { for (const b of buttons) { const picked = selected.includes(b.dataset.instanceId); b.setAttribute("aria-pressed", String(picked)); if (!picked && selected.length >= 3) b.disabled = true; else if (!b.dataset.locked) b.disabled = candidates.find(c => c.instanceId === b.dataset.instanceId)?.admission?.ok === false; } }
  // Preselect the first admissible partners so one tap can start.
  for (const entry of candidates) { if (selected.length >= 3) break; if (!entry.admission || entry.admission.ok) selected.push(entry.instanceId); }
  paint();
  return { element: wrap, get selected() { return [...selected]; }, lock(value) { for (const b of buttons) { b.dataset.locked = value ? "1" : ""; b.disabled = value || b.disabled; } if (!value) paint(); } };
}

export function mountRoomLobby(panel, { service, game, codeLength = 4, start, onFriendSpar = null, brag = null, doc = globalThis.document, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout,
  clipboard = globalThis.navigator?.clipboard ?? null } = {}) {
  const { el, button } = helpers(doc);
  const root = el("section", "cm-online cm-online--lobby"); root.dataset.onlinePanel = "room";
  const modeTag = el("p", "cm-online__mode");
  root.append(el("h3", "cm-online__title", onlineText("roomTitle")), identityStrip(doc, service, modeTag), el("p", "cm-online__hint", onlineText("roomHint")), modeTag);
  const status = el("p", "cm-online__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  const codeBox = el("p", "cm-online__roomcode"); codeBox.hidden = true;
  const copyRoom = button("copyRoom", "cm-online__button--ghost"); copyRoom.hidden = true;
  const codeRow = el("div", "cm-online__coderow"); codeRow.append(codeBox, copyRoom);
  const presence = el("p", "cm-online__presence"); presence.hidden = true;
  const onCard = el("p", "cm-online__oncard", onlineText("roomOnCard")); onCard.hidden = true;
  const row = el("div", "cm-online__row");
  const create = button("createRoom", "cm-online__button--primary"), join = button("joinRoom");
  const input = el("input", "cm-online__input cm-online__input--code"); input.inputMode = "numeric"; input.placeholder = onlineText("roomPlaceholder"); input.maxLength = 6; input.setAttribute("aria-label", onlineText("roomPlaceholder"));
  const cancel = button("leaveRoom", "cm-online__button--ghost"); cancel.hidden = true;
  row.append(create, input, join, cancel);
  let picker = null, session = null, countdownTimer = null, reported = false;
  const say = (text, tone = "info") => { status.hidden = !text; status.textContent = text ?? ""; status.dataset.tone = tone; };
  // While the host waits, the brag card carries the room code to the friend who will type it in.
  const bragKey = typeof brag?.onOpen === "function" ? el("button", "cm-brag-cta cm-arcade-key", brag.label ?? "") : null;
  if (bragKey) { bragKey.type = "button"; bragKey.dataset.onlineAction = "brag-card"; bragKey.hidden = true; bragKey.addEventListener("click", () => { brag.onOpen(bragKey); }); }
  root.append(row, codeRow, presence, onCard, ...(bragKey ? [bragKey] : []), status);
  // A friend's saved defense team, played by the AI against the player's own team code.
  if (typeof onFriendSpar === "function") {
    const friendsBox = el("section", "cm-online__friendspar");
    const list = el("ul", "cm-online__list"); list.dataset.list = "friend-defense";
    friendsBox.append(el("h4", "cm-online__section", onlineText("friendDefenseTitle")), el("p", "cm-online__hint", onlineText("friendDefenseHint")), list);
    root.append(friendsBox);
    void service.listFriends().then(friends => {
      const ready = friends.filter(friend => friend.status === "accepted" && (friend.hasDefenseTeam || friend.simulated));
      if (!ready.length) { list.replaceChildren(el("li", "cm-online__empty", onlineText("friendDefenseEmpty"))); return; }
      list.replaceChildren(...ready.map(friend => {
        const item = el("li", "cm-online__friend"); item.dataset.userId = friend.userId ?? "";
        const main = el("div", "cm-online__friend-main");
        const name = el("p", "cm-online__friend-name", friend.tamerName || friend.tamerCode); if (friend.simulated) name.append(" ", el("span", "cm-online__tag", onlineText("simulatedTag")));
        main.append(name, el("p", "cm-online__friend-meta", `${friend.tamerCode} · ${onlineText("rank")} ${friend.rankTitle || onlineText("unknown")}`));
        const challenge = button("spar", "cm-online__button--spar");
        challenge.addEventListener("click", async () => {
          challenge.disabled = true; say(onlineText("sparStart", { name: friend.tamerName || friend.tamerCode }));
          try {
            const team = await service.getFriendDefenseTeam(friend.userId);
            if (!team?.defenseTeam?.passwordCode) { say(onlineText("sparFailed", { reason: onlineText("noDefense") }), "error"); return; }
            const started = await onFriendSpar({ friend, defense: team.defenseTeam });
            if (started?.ok === false) say(onlineText("sparFailed", { reason: onlineReasonText(started.reason) }), "error");
          } finally { challenge.disabled = false; }
        });
        item.append(main, challenge); return item;
      }));
    }).catch(() => { list.replaceChildren(el("li", "cm-online__empty", onlineText("friendDefenseEmpty"))); });
  }
  panel.prepend(root);
  void Promise.resolve(game.candidates?.()).then(list => { if (Array.isArray(list) && list.length) { picker = teamPicker(doc, list); root.insertBefore(picker.element, row); } });
  copyRoom.addEventListener("click", async () => { try { await clipboard?.writeText?.(codeBox.dataset.roomCode ?? ""); say(onlineText("roomCopied"), "ok"); } catch { say(onlineText("roomCode", { code: codeBox.dataset.roomCode ?? "" })); } });

  function paint(state) {
    root.dataset.phase = state.phase;
    create.hidden = join.hidden = input.hidden = !["idle", "failed", "cancelled"].includes(state.phase);
    cancel.hidden = ["idle", "failed", "cancelled", "playing"].includes(state.phase);
    codeBox.hidden = !state.roomCode; if (state.roomCode) codeBox.textContent = onlineText("roomCode", { code: state.roomCode }); codeBox.dataset.roomCode = state.roomCode ?? "";
    const open = ["waiting", "joined", "ready", "countdown"].includes(state.phase);
    copyRoom.hidden = !(open && state.roomCode); onCard.hidden = !(open && state.roomCode && state.role === "host");
    if (bragKey) bragKey.hidden = onCard.hidden;
    presence.hidden = !open || state.peerOnline === null; presence.textContent = onlineText(state.peerOnline ? "presenceOnline" : "presenceWaiting"); presence.dataset.online = String(Boolean(state.peerOnline));
    // While a room is open the brag card can print its code for the friend to type in.
    service.setActiveRoom?.(open && state.role === "host" ? { roomCode: state.roomCode, matchId: state.matchId } : null);
    picker?.lock(!["idle", "failed", "cancelled"].includes(state.phase));
    clearTimer(countdownTimer);
    switch (state.phase) {
      case "creating": say(onlineText("exchanging")); break;
      case "waiting": say(onlineText("waitingGuest")); break;
      case "joined": say(onlineText("guestJoined")); break;
      case "ready": say(onlineText("exchanging")); break;
      case "countdown": {
        const tick = () => { const left = Math.max(0, Math.ceil((state.countdownEndsAt - Date.now()) / 1000)); say(left ? onlineText("countdown", { n: left }) : onlineText("starting"), "ok"); if (left) countdownTimer = setTimer(tick, 250); };
        tick(); break;
      }
      case "playing":
        say(onlineText("starting"), "ok");
        // The battle result is not tracked yet: settle the room as started-but-unreported so a finished match never keeps its slot
        // (both sides report the same empty winner, which the server records as finished). Dropping the lobby afterwards is then safe.
        if (!reported) { reported = true; void session?.report({ winnerId: null, outcome: "UNREPORTED" }); }
        void start(state.prepared); break;
      case "failed": say(onlineText("roomFailed", { reason: onlineReasonText(state.reason) }), "error"); break;
      case "cancelled": say(onlineText("roomCancelled")); break;
      default: say("");
    }
  }
  async function begin(role) {
    const ids = picker?.selected ?? [];
    if (!ids.length) { say(onlineText("ownTeamNeeded"), "error"); return; }
    const adapter = await service.roomAdapter();
    session?.dispose(); reported = false;
    session = createPvpRoomSession({ adapter, game, codeLength, setTimer, clearTimer });
    session.subscribe(paint);
    if (role === "host") await session.host({ instanceIds: ids });
    else await session.join({ roomCode: input.value.trim(), instanceIds: ids });
  }
  create.addEventListener("click", () => { void begin("host"); });
  join.addEventListener("click", () => { if (!/^[0-9]{4,6}$/.test(input.value.trim())) { say(onlineReasonText("INVALID"), "error"); return; } void begin("guest"); });
  cancel.addEventListener("click", () => { void session?.cancel(); });
  return Object.freeze({ element: root, get session() { return session; }, dispose() { clearTimer(countdownTimer); session?.dispose(); service.setActiveRoom?.(null); root.remove(); } });
}

export function mountQuickMatchLobby(panel, { service, game, start, doc = globalThis.document } = {}) {
  const { el, button } = helpers(doc);
  const root = el("section", "cm-online cm-online--lobby"); root.dataset.onlinePanel = "quick";
  const modeTag = el("p", "cm-online__mode");
  root.append(el("h3", "cm-online__title", onlineText("quickTitle")), identityStrip(doc, service, modeTag), el("p", "cm-online__hint", onlineText("quickHint")), modeTag);
  const status = el("p", "cm-online__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  const row = el("div", "cm-online__row"); const quick = button("quickMatch", "cm-online__button--primary"), ladder = button("ladder"); row.append(quick, ladder);
  const list = el("ul", "cm-online__list"); list.dataset.list = "opponents";
  let picker = null, busy = false;
  const say = (text, tone = "info") => { status.hidden = !text; status.textContent = text ?? ""; status.dataset.tone = tone; };
  root.append(row, status, list);
  panel.prepend(root);
  void Promise.resolve(game.candidates?.()).then(entries => { if (Array.isArray(entries) && entries.length) { picker = teamPicker(doc, entries); root.insertBefore(picker.element, row); } });

  async function search(limit) {
    if (busy) return; busy = true; quick.disabled = ladder.disabled = true; say(onlineText("searching")); list.replaceChildren();
    try {
      const ids = picker?.selected ?? [];
      if (!ids.length) { say(onlineText("ownTeamNeeded"), "error"); return; }
      // The service needs our own team to mirror when it simulates; the real cloud ignores it.
      const own = await game.createPassword(ids);
      if (!own?.ok) { say(onlineText("matchFailed", { reason: onlineReasonText(own?.reason) }), "error"); return; }
      const opponents = await service.ladderOpponents(limit);
      if (!opponents.length) { say(onlineText("noOpponents"), "error"); return; }
      if (limit === 1) { say(onlineText("opponentFound", { name: opponents[0].tamerName || opponents[0].tamerCode }), "ok"); await start([own.password, opponents[0].defenseTeam.passwordCode], opponents[0]); return; }
      say("");
      for (const opponent of opponents) {
        const item = el("li", "cm-online__friend"); item.dataset.userId = opponent.userId ?? "";
        const main = el("div", "cm-online__friend-main");
        const name = el("p", "cm-online__friend-name", opponent.tamerName || opponent.tamerCode); if (opponent.simulated) name.append(" ", el("span", "cm-online__tag", onlineText("simulatedTag")));
        main.append(name, el("p", "cm-online__friend-meta", `${opponent.tamerCode} · ${onlineText("rank")} ${opponent.rankTitle || onlineText("unknown")}`));
        const challenge = button("challenge", "cm-online__button--spar"); challenge.addEventListener("click", () => { void start([own.password, opponent.defenseTeam.passwordCode], opponent); });
        item.append(main, challenge); list.append(item);
      }
    } catch (error) { say(onlineText("matchFailed", { reason: onlineReasonText(error?.reason ?? error?.message) }), "error"); }
    finally { busy = false; quick.disabled = ladder.disabled = false; }
  }
  quick.addEventListener("click", () => { void search(1); });
  ladder.addEventListener("click", () => { void search(3); });
  return Object.freeze({ element: root, dispose() { root.remove(); } });
}
