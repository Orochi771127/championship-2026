import { titleEventText } from "../text/zhHant.js";
import { uiText } from "../text/uiText.js";
// VS5-P — Championship Modern presentation for the Battle menu, the match and
// the result.
//
// This module consumes only injected data and callbacks. It owns no screen
// lifecycle, gameplay state, battle logic, save data, Pixi bootstrap or ticker,
// and imports only display copy. Runtime values arrive from the caller; this
// view never reaches into simulation behind its back.
//
// THE BATTLE IS AUTOMATIC
// -----------------------
// This milestone is VS5 Auto Battle, and the trace agrees: the AI selection
// module chooses for all six slots and no traced site reads player input between
// the start of a match and its verdict. So the match screen has exactly one
// control, which leaves, and there is no command menu anywhere in this file.
//
// EVIDENCE IS SHOWN, NOT HIDDEN
// -----------------------------
// A roster mixes the product's own three creatures with three the cartridge
// supplies. The match screen carries that distinction in a data attribute so a
// reader can always tell which numbers are traced, rather than the screen
// quietly presenting both as if they were the same kind of thing.

export const VS5_UI_AUTHORITY = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";

export const VS5_EVIDENCE_LABELS = Object.freeze({
  VERIFIED_BINARY: "ROM VERIFIED",
  PRODUCT_AUTHORED: "PRODUCT AUTHORED"
});

export const VS5_END_REASON_LABELS = Object.freeze({
  RUNNING: "進行中",
  TIME_UP: "時間到",
  TEAM_DOWN: "一方全員倒下"
});

export const VS5_VERDICT_LABELS = Object.freeze({
  RUNNING: "尚未分出勝負",
  TEAM_ZERO_AHEAD: "我方獲勝",
  TEAM_ONE_AHEAD: "對手獲勝",
  LEVEL: "雙方平手"
});

function element(tag, className, text, localize = true) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = localize ? uiText(text) : text;
  return node;
}

function actionButton(label, { primary = false } = {}) {
  const button = element("button", `cm-vs5-action${primary ? " cm-vs5-action--primary" : ""}`, label);
  button.type = "button";
  return button;
}

function shell(root, screen, label) {
  root.replaceChildren();
  root.className = "cm-vs5-root";
  root.dataset.uiAuthority = VS5_UI_AUTHORITY;
  root.dataset.screen = screen;
  const section = element("section", "cm-vs5-shell");
  section.setAttribute("aria-label", uiText(label));
  root.append(section);
  return section;
}

/**
 * The battle menu. `matches` is what battleMatchSelection resolved: at most five
 * entries, each with a record index, a title, an entry fee and a reward.
 */
/**
 * The Battle menu.
 *
 * The original presents this as a rotating box whose faces are the battle KINDS
 * -- championship, title match, free battle, link battle -- proved by the node
 * table of battle_menu/launcher13.nsbmd. So the screen has two layers: pick a
 * kind on the box, then a match within it.
 *
 * `mountCube` injects that box. WHICH matches belong to which kind is NOT traced,
 * so the box does not filter the list: it is drawn because the original has it,
 * and the missing link is stated on screen rather than faked.
 */
export function createBattleSelectView({ root, matches, onEnter, onExit, mountCube, menuCopy }) {
  if (!Array.isArray(matches)) throw new TypeError("The Battle menu requires a resolved match list");
  if (typeof onEnter !== "function") throw new TypeError("The Battle menu requires an onEnter intent");

  if (!menuCopy) throw new TypeError("The Battle menu requires display copy");
  const section = shell(root, "BATTLE_SELECT", menuCopy.menu);
  const header = element("header", "cm-vs5-header");
  header.append(element("span", "cm-vs5-kicker", menuCopy.kicker));
  header.append(element("h1", "cm-vs5-title", menuCopy.chooseMatch));
  section.append(header);

  let cube = null;
  if (typeof mountCube === "function") {
    const stage = element("div", "cm-vs5-cube");
    section.append(stage);
    cube = mountCube({
      host: stage,
      // Nothing is marked reachable: the kind-to-match mapping is untraced, so
      // no face may claim to lead somewhere.
      available: new Set(),
      onSelect() {}
    });
    const note = element("p", "cm-vs5-cube__note",
      menuCopy.faceNotice);
    section.append(note);
  }

  const list = element("ul", "cm-vs5-matches");
  list.setAttribute("aria-label", uiText(menuCopy.availableMatches));
  const entryNotice = element("p", "cm-vs5-entry-notice");
  entryNotice.setAttribute("role", "status");
  entryNotice.setAttribute("aria-live", "polite");
  entryNotice.hidden = true;
  function renderMatches(nextMatches) {
    if (!Array.isArray(nextMatches)) return;
    matches = nextMatches;
    list.replaceChildren();
    entryNotice.hidden = true;
    if (matches.length === 0) {
      list.append(element("li", "cm-vs5-matches__empty", menuCopy.noMatch));
    }
    for (const match of matches) {
      const item = element("li", "cm-vs5-match");
      item.dataset.recordIndex = String(match.recordIndex);
      const button = actionButton(titleEventText(match.recordIndex, "name", match.title ?? `${menuCopy.match} ${match.recordIndex}`), { primary: true });
      button.classList.add("cm-vs5-match__enter");
      button.append(element("span", "cm-vs5-match__fee",
        `${menuCopy.entryFee ?? "報名費"} ${match.entryFee ?? "—"} 位元幣`));
      button.append(element("span", "cm-vs5-match__payout",
        `${menuCopy.prize ?? "獎金"} ${match.payout > 0 ? `${match.payout} 位元幣` : menuCopy.noPayout}`));
      button.addEventListener("click", () => {
        const result = onEnter(match.recordIndex);
        if (result?.ok !== false) return;
        entryNotice.hidden = false;
        entryNotice.dataset.reason = result.reason ?? "ENTRY_REFUSED";
        const fee = result.entryFee ?? match.entryFee;
        const wallet = result.walletBits ?? result.wallet ?? result.bits;
        entryNotice.textContent = uiText(["INSUFFICIENT_FUNDS", "INSUFFICIENT_BITS"].includes(result.reason)
          ? `${menuCopy.insufficientFunds ?? "持有金額不足。"} ${menuCopy.entryFee ?? "報名費"} ${fee} 位元幣；${menuCopy.wallet ?? "持有"} ${wallet ?? "—"} 位元幣。`
          : (result.message ?? menuCopy.entryRefused ?? "目前無法參加這場對戰。"));
      });
      item.append(button);
      list.append(item);
    }
  }
  renderMatches(matches);
  section.append(list, entryNotice);

  if (typeof onExit === "function") {
    const exit = actionButton(menuCopy.returnHome);
    exit.classList.add("cm-vs5-exit");
    exit.addEventListener("click", () => onExit());
    section.append(exit);
  }

  return Object.freeze({
    render(reading = {}) { renderMatches(reading.matches); },
    inspect() {
      return Object.freeze({
        screen: "BATTLE_SELECT",
        count: matches.length,
        cube: cube ? cube.getDiagnostics() : null
      });
    },
    dispose() {
      cube?.dispose();
      root.replaceChildren();
    }
  });
}

/**
 * The clock band. One bar for the 7200 frames and one pip per 900-frame tier,
 * which is what the traced counter at +0x5E98 and its tier at +0x5E9C are.
 */
function clockBand(tierMax) {
  const band = element("div", "cm-vs5-clock");
  band.setAttribute("aria-label", uiText("Match clock"));
  const track = element("div", "cm-vs5-clock__track");
  const fill = element("span", "cm-vs5-clock__fill");
  track.append(fill);
  const pips = element("div", "cm-vs5-clock__pips");
  const marks = [];
  for (let index = 0; index <= tierMax; index += 1) {
    const pip = element("span", "cm-vs5-clock__pip");
    pip.dataset.tier = String(index);
    marks.push(pip);
    pips.append(pip);
  }
  band.append(track, pips);
  return {
    band,
    update(clock) {
      fill.style.width = `${Math.round(clock.ratio * 100)}%`;
      band.dataset.tier = String(clock.tier);
      marks.forEach((pip, index) => { pip.dataset.spent = String(index < clock.tier); });
    }
  };
}

/**
 * The event log band. VS5 is Auto Battle, so this is a record of what happened
 * and never a command menu -- see the contract's notShown.commandMenu.
 */
function eventLogBand(labels) {
  const band = element("section", "cm-vs5-log");
  band.setAttribute("aria-label", uiText("Match record"));
  const line = element("p", "cm-vs5-log__line", "");
  const detail = element("p", "cm-vs5-log__detail", "");
  band.append(line, detail);
  return {
    band,
    update(outcome) {
      band.dataset.ended = String(outcome.ended);
      if (!outcome.ended) {
        line.textContent = uiText(labels.running);
        detail.textContent = uiText("");
        return;
      }
      band.dataset.verdict = outcome.verdict;
      line.textContent = uiText(VS5_VERDICT_LABELS[outcome.verdict] ?? outcome.verdict);
      detail.textContent = uiText(VS5_END_REASON_LABELS[outcome.reason] ?? outcome.reason);
    }
  };
}

function meter(className, label) {
  const wrap = element("div", `cm-vs5-meter ${className}`);
  wrap.setAttribute("aria-label", uiText(label));
  const fill = element("span", "cm-vs5-meter__fill");
  wrap.append(fill);
  return { wrap, fill };
}

function combatantCard(combatant, compact) {
  const card = element("li", `cm-vs5-fighter${compact ? " cm-vs5-fighter--compact" : ""}`);
  card.dataset.slot = String(combatant.slot);
  card.dataset.team = String(combatant.team);
  if (!combatant.present) {
    card.dataset.present = "false";
    card.append(element("span", "cm-vs5-fighter__empty", "—"));
    return { card, update() {} };
  }
  card.dataset.present = "true";
  const name = element("span", "cm-vs5-fighter__name", combatant.displayName ?? uiText(`SLOT ${combatant.slot + 1}`), false);
  const hp = meter("cm-vs5-meter--hp", "Health");
  const hpValue = element('span', 'cm-vs5-fighter__hp');
  card.append(name, hp.wrap, hpValue);
  let resource = null;
  if (!compact) {
    resource = meter("cm-vs5-meter--resource", "Action resource");
    card.append(resource.wrap);
  }
  return {
    card,
    update(next) {
      hp.fill.style.width = `${Math.round(next.hp.ratio * 100)}%`;
      hpValue.textContent = uiText(`生命值 ${next.hp.current} / ${next.hp.maximum}`);
      hp.wrap.setAttribute('aria-label', uiText(hpValue.textContent));
      card.dataset.down = String(next.down);
      card.dataset.engaged = String(next.engaged);
      if (resource) resource.fill.style.width = `${Math.round(next.resource.ratio * 100)}%`;
    }
  };
}

/**
 * The match. `mountField` attaches the Pixi scene to the host this creates; the
 * DOM carries the words the scene cannot draw and nothing else.
 */
export function createBattleFieldView({ root, frame, mountField, onExit }) {
  if (!frame || !Array.isArray(frame.combatants)) throw new TypeError("The Battle field view requires a battle frame");
  if (typeof mountField !== "function") throw new TypeError("The Battle field view requires the published field mounter");

  const section = shell(root, "BATTLE_FIELD", "Battle");
  section.dataset.arena = frame.arena.identifier;
  section.dataset.rosterEvidence = frame.rosterEvidence ?? "PRODUCT_AUTHORED";

  const opponents = element("ul", "cm-vs5-roster cm-vs5-roster--opponent");
  const players = element("ul", "cm-vs5-roster cm-vs5-roster--player");
  const cards = new Map();
  for (const combatant of frame.combatants) {
    const compact = combatant.team === 1;
    const built = combatantCard(combatant, compact);
    cards.set(combatant.slot, built);
    (compact ? opponents : players).append(built.card);
  }

  const host = element("div", "cm-vs5-field");
  host.setAttribute("aria-label", uiText("Battle field. The match runs on its own."));

  // The arena name and the evidence label live INSIDE the clock band: the shell
  // holds the contract's five bands and nothing else, so a sixth child cannot
  // quietly shrink all five out of proportion.
  const clock = clockBand(frame.clockTierMax ?? 7);
  const caption = element("div", "cm-vs5-clock__caption");
  caption.append(element("span", "cm-vs5-kicker", frame.arena.identifier.replace("BATTLE_", "")));
  caption.append(element("span", "cm-vs5-evidence",
    VS5_EVIDENCE_LABELS[frame.rosterEvidence] ?? VS5_EVIDENCE_LABELS.PRODUCT_AUTHORED));
  clock.band.prepend(caption);
  const log = eventLogBand({ running: "對戰進行中" });

  const exit = actionButton("離開對戰");
  exit.classList.add("cm-vs5-exit");
  if (typeof onExit === "function") exit.addEventListener("click", () => onExit());
  log.band.append(exit);

  // The five bands the contract declares, in its order: clock, the opponent's
  // three, the field, the player's three, the record.
  section.append(clock.band, opponents, host, players, log.band);

  const field = mountField({ host });

  return Object.freeze({
    /** Called with each view the presentation source publishes. */
    render(view) {
      for (const combatant of view.combatants) {
        if (!combatant.present) continue;
        cards.get(combatant.slot)?.update(combatant);
      }
      clock.update(view.clock);
      log.update(view.outcome);
      section.dataset.ended = String(view.outcome.ended);
      if (view.outcome.ended) {
        section.dataset.verdict = view.outcome.verdict;
        section.dataset.endReason = view.outcome.reason;
      }
    },
    inspect() {
      return Object.freeze({
        screen: "BATTLE_FIELD",
        arena: frame.arena.identifier,
        cards: cards.size,
        bands: [...section.children].map((child) => child.className.split(" ")[0])
      });
    },
    dispose() {
      field?.dispose?.();
      root.replaceChildren();
    }
  });
}

/** The result. One verdict, one reason, one way out. */
/**
 * The battle result -- the original's eight-scene sequence, not one page.
 *
 * The ROM carries eight scenes under battle_result, and their node tables say
 * what each one is for:
 *
 *   result_sub_scene        digimon1..3 + text   the verdict over the three slots
 *   result_sub_prize_scene  get1..6, have1..6    what was won against what is held
 *   result_sub_rankup_scene tamer_rank + text    the rank award
 *   result_sub_titleget     medal1..7, title_name, title_medal_get
 *   result_sub_status_scene battle0..3, win...   per-creature battle and win tallies
 *   battle_result_log_scene log_space
 *   result_sub_base                              the shared frame
 *   result_sub_net_scene                         the network variant
 *
 * A panel is only shown when this build has a traced source for it. The status
 * panel is NOT shown: per-creature battle counts and win rates have no traced
 * read site, and filling battle0..3 with zeroes would read as a real tally. The
 * net panel is out of scope for a single-player product.
 *
 * Panels advance one at a time, which is how the original presents them; the
 * last one returns home.
 */
export function createBattleResultView({ root, outcome, receipt = null, matchTitle = null, onExit }) {
  if (!outcome || typeof outcome !== "object") throw new TypeError("The Battle result requires an outcome");

  const section = shell(root, "BATTLE_RESULT", "Battle result");
  section.dataset.verdict = outcome.verdict;
  section.dataset.endReason = outcome.reason;

  const panels = [];

  // result_sub_scene -- the verdict.
  panels.push({
    id: "RESULT",
    scene: "result_sub_scene",
    build() {
      const frag = document.createDocumentFragment();
      const header = element("header", "cm-vs5-header");
      header.append(element("span", "cm-vs5-kicker", VS5_END_REASON_LABELS[outcome.reason] ?? outcome.reason));
      header.append(element("h1", "cm-vs5-title", VS5_VERDICT_LABELS[outcome.verdict] ?? outcome.verdict));
      frag.append(header);
      // A level verdict is shown as a loss because OVL19 0x02110B5C demotes it
      // before anything reads it. The reason stays visible so running out of
      // time is still distinguishable from being knocked down.
      if (outcome.winningTeam === null) {
        frag.append(element("p", "cm-vs5-result__detail", "雙方都未取得領先。"));
      }
      return frag;
    }
  });

  // result_sub_prize_scene has "get" and "have" values. Both come from the
  // app's wallet receipt, never from the advertised catalog payout. A missing
  // receipt must not read as either a successful credit or a zero-valued prize.
  const credited = receipt?.status === "SETTLED"
    && Number.isSafeInteger(receipt.credited) && receipt.credited >= 0
    && Number.isSafeInteger(receipt.walletAfter) && receipt.walletAfter >= 0;
  section.dataset.settlement = credited ? "SETTLED" : "NOT_CREDITED";
  panels.push({
    id: "PRIZE",
    scene: "result_sub_prize_scene",
    build() {
      const frag = document.createDocumentFragment();
      frag.append(element("span", "cm-vs5-kicker", "獎金"));
      frag.append(element("h1", "cm-vs5-title", credited ? String(receipt.credited) : "—"));
      if (!credited) {
        frag.append(element("p", "cm-vs5-result__detail", "獎金尚未入帳。"));
        return frag;
      }
      frag.append(element("p", "cm-vs5-result__detail", `持有 ${receipt.walletAfter} 位元幣`));
      if (receipt.clamped) {
        frag.append(element("p", "cm-vs5-result__detail",
          `獎金 ${receipt.rewardBits} 位元幣；持有金額已達上限。`));
      } else if (receipt.credited === 0) {
        frag.append(element("p", "cm-vs5-result__detail", "本場沒有獲得獎金。"));
      }
      if (matchTitle) frag.append(element("p", "cm-vs5-result__detail", matchTitle));
      return frag;
    }
  });

  const advance = actionButton("下一頁", { primary: true });
  const exit = actionButton("返回牧場", { primary: true });
  exit.classList.add("cm-vs5-exit");
  if (typeof onExit === "function") exit.addEventListener("click", () => onExit());

  const body = element("div", "cm-vs5-result__body");
  let index = 0;

  function paint() {
    body.replaceChildren(panels[index].build());
    section.dataset.panel = panels[index].id;
    section.dataset.originalScene = panels[index].scene;
    const last = index === panels.length - 1;
    advance.hidden = last;
    exit.hidden = !last;
  }

  advance.addEventListener("click", () => {
    if (index < panels.length - 1) { index += 1; paint(); }
  });

  section.append(body, advance, exit);
  paint();

  return Object.freeze({
    render() {},
    inspect() {
      return Object.freeze({
        settlement: credited ? "SETTLED" : "NOT_CREDITED",
        credited: credited ? receipt.credited : null,
        panels: panels.map((panel) => panel.id),
        shownScenes: panels.map((panel) => panel.scene),
        // Named so the gap is visible rather than silently absent.
        notBuilt: Object.freeze(["result_sub_status_scene", "result_sub_rankup_scene",
          "result_sub_titleget", "battle_result_log_scene"]),
        outOfScope: Object.freeze(["result_sub_net_scene"])
      });
    },
    dispose() {}
  });
}
