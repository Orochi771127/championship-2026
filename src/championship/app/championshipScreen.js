// The tournaments board.
//
// The original reaches these the same way: ui/conference_list_item.nxr is a row
// in the battle menu -- a cup, a name and a plate -- and the entry it opens is
// priced the way battle_menu/titlematch_top_sub_scene.nxr prices one, the fee
// laid against what the player holds and marked when it cannot be paid. The
// round board follows training/schedule_item.nxr, which spends its row on a
// number, a name, the prize digits with the bit mark, and the check that says a
// round is already settled.
//
// Rules and numbers come from the run module; this screen only shows them and
// sends the player's intents back.
import { uiText } from "../text/uiText.js";

export const CHAMPIONSHIP_SCREEN_SOURCE_SCENES = Object.freeze([
  "ui/conference_list_item.nxr",
  "battle_menu/titlematch_top_sub_scene.nxr",
  "training/schedule_item.nxr",
  "ui/battle_title_champion_main.nxr"
]);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** schedule_item spends money_01..money_06 and a bit mark on a prize. */
function prizeRow(prize) {
  const row = element("p", "cm-championship-prize");
  row.append(element("span", "cm-championship-prize__digits", prize.toLocaleString("en-US")));
  row.append(element("span", "cm-championship-prize__bit", uiText("位元幣")));
  return row;
}

/**
 * ui/battle_title_champion_main.nxr banners a round as
 * "チャンピオンシップ予選第3戦" -- the tournament, then the qualifying round
 * number. The wording here is that, not a round counter of our own.
 */
function roundName(run) {
  return uiText(`${categoryName(run.id)} 預賽第 ${run.round + 1} 戰 / 共 ${run.totalRounds} 戰`);
}

function categoryName(id) {
  return id === "WORLD" ? uiText("世界大會") : uiText("冠軍大會");
}

function lockReason(category) {
  if (!category.unlocked) {
    return category.id === "WORLD"
      ? uiText("贏得冠軍大會後開放。")
      : uiText("馴獸師階級到達後開放。");
  }
  if (!category.registered) return uiText("尚未報名。請在賽程登記後再來。");
  return null;
}

export function createChampionshipView({ root, source }) {
  if (!root) throw new TypeError("The tournament board requires a root");
  if (!source || typeof source.getCategories !== "function" || typeof source.getRun !== "function") {
    throw new TypeError("The tournament board requires a categories and run source");
  }
  const intents = source.intents ?? {};
  root.replaceChildren();
  root.className = "cm-championship-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.sourceScenes = CHAMPIONSHIP_SCREEN_SOURCE_SCENES.join(" ");

  const shell = element("section", "cm-championship-shell");
  shell.append(element("p", "cm-championship-kicker", uiText("大會")),
    element("h1", "cm-championship-title", uiText("多輪賽事")));
  const board = element("div", "cm-championship-board");
  const notice = element("p", "cm-championship-notice");
  notice.hidden = true;
  const footer = element("footer", "cm-championship-footer");
  const back = element("button", "cm-championship-back", uiText("返回"));
  back.type = "button";
  back.addEventListener("click", () => intents.leave?.());
  footer.append(back);
  shell.append(board, notice, footer);
  root.append(shell);

  function say(message) {
    notice.textContent = message ?? "";
    notice.hidden = !message;
  }

  function renderCategories() {
    for (const category of source.getCategories()) {
      const row = element("button", "cm-championship-entry");
      row.type = "button";
      row.dataset.category = String(category.category);
      row.dataset.unlocked = String(category.unlocked);
      // conference_list_item is a cup, a name and a plate; nothing else.
      row.append(element("span", "cm-championship-cup", "🏆"));
      const copy = element("span", "cm-championship-entry__copy");
      copy.append(element("span", "cm-championship-entry__name", categoryName(category.id)));
      copy.append(element("span", "cm-championship-entry__rounds",
        uiText(`${category.rounds} 輪`)));
      copy.append(prizeRow(category.prize));
      row.append(copy);
      const reason = lockReason(category);
      if (reason) {
        row.disabled = true;
        copy.append(element("span", "cm-championship-entry__reason", reason));
      }
      row.addEventListener("click", () => {
        const opened = intents.open?.(category.category);
        say(opened?.ok ? null : uiText("無法開始這場賽事。"));
        render();
      });
      board.append(row);
    }
  }

  function renderRun(run) {
    const panel = element("div", "cm-championship-run");
    panel.dataset.category = String(run.category);
    panel.append(element("span", "cm-championship-kicker", categoryName(run.id)));
    panel.append(element("h2", "cm-championship-run__title",
      run.continues ? roundName(run) : uiText("賽事結束")));

    // One mark per round, as schedule_item spends one check per fixture.
    const marks = element("ol", "cm-championship-rounds");
    for (let index = 0; index < run.totalRounds; index += 1) {
      const flag = run.flags[index];
      const mark = element("li", "cm-championship-round",
        flag === 1 ? uiText("勝") : flag === 0 ? uiText("敗") : uiText("—"));
      // Only a run still owed a round has one waiting; an ended run has none.
      const waiting = run.continues && index === run.round;
      mark.dataset.state = flag === 1 ? "WON" : flag === 0 ? "LOST" : waiting ? "NOW" : "PENDING";
      marks.append(mark);
    }
    panel.append(marks);

    if (run.continues) {
      const opponent = element("p", "cm-championship-opponent");
      const drawn = intents.draw?.();
      opponent.textContent = drawn?.ok
        ? uiText(`本輪對手：第 ${drawn.opponent.index + 1} 隊 / 共 ${drawn.opponent.poolSize} 隊`)
        : uiText("本輪對手尚未抽出。");
      panel.append(opponent);
      // The round is fought as an ordinary battle; the verdict it settles on is
      // what writes the flag, so this board never judges a round itself.
      const actions = element("div", "cm-championship-actions");
      const fight = element("button", "cm-championship-action cm-championship-action--primary",
        uiText(`開始第 ${run.round + 1} 戰`));
      fight.type = "button";
      fight.dataset.round = String(run.round);
      fight.addEventListener("click", () => {
        const entered = intents.enterRound?.();
        if (!entered?.ok) { say(uiText("目前無法開始這一輪。")); render(); }
      });
      actions.append(fight);
      panel.append(actions);
    } else {
      const settle = element("button", "cm-championship-action cm-championship-action--primary",
        run.payable ? uiText(`領取 ${run.prize.toLocaleString("en-US")} 位元幣`) : uiText("結束賽事"));
      settle.type = "button";
      settle.addEventListener("click", () => {
        const settled = intents.settle?.();
        say(settled?.ok
          ? settled.payable ? uiText(`獲得 ${settled.prize.toLocaleString("en-US")} 位元幣。`) : uiText("本次沒有獎金。")
          : uiText("無法結算這場賽事。"));
        render();
      });
      panel.append(settle);
    }
    board.append(panel);
  }

  function render() {
    board.replaceChildren();
    const run = source.getRun();
    if (run) renderRun(run); else renderCategories();
  }

  render();
  return Object.freeze({
    render,
    getDiagnostics: () => Object.freeze({
      screen: "CHAMPIONSHIP",
      sourceScenes: CHAMPIONSHIP_SCREEN_SOURCE_SCENES,
      running: source.getRun() !== null
    }),
    dispose() { root.replaceChildren(); }
  });
}
