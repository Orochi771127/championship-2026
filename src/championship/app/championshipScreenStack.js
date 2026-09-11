// VS2 -- the Championship screen stack.
//
// WHY A STACK AND NOT A ROUTER
// ----------------------------
// The Owner renderer policy forbids a second global router. This is not one: it
// has no URL, no history integration, no route table, no lazy module loading and
// no navigation side effects. It is a bounded stack of screen ids with an
// explicit legal-transition table, owned by the standalone application, which the
// presentation layer READS and never drives.
//
// Every transition is declared. An undeclared transition is refused rather than
// silently allowed, so a new screen cannot quietly reach an old one.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const CHAMPIONSHIP_SCREENS = deepFreeze({
  RAISING_HOME: "RAISING_HOME",
  SHOP: "SHOP",
  DATABASE: "DATABASE",
  CAGE_EDIT: "CAGE_EDIT",
  // The original's Digimon roster, reached from the toolbar's management
  // submenu. Its shape comes from ui/digimon_list_main.nxr (list chrome, a
  // current/limit counter, name-edit / delete / entry buttons) and
  // ui/digimon_list_sub.nxr (the per-creature detail block).
  DIGIMON_LIST: "DIGIMON_LIST",
  // The title-match fixture board, reached from the toolbar's management
  // submenu. Its content is the 62-record table at ARM9 0x020CD004, read
  // through the same season/day columns the game's own scan at 0x02089230
  // matches on.
  SCHEDULE: "SCHEDULE",
  // The in-game help, reached from the toolbar's system submenu. Its text is the
  // cartridge's own bank at nitrofs/ui/txt/help_text_txt.dat, drawn by the
  // original's help_main_scene.
  HELP: "HELP",
  // The tamer profile, reached from the toolbar's management submenu. Its eight
  // fields and their digit widths come from tamer_info_main_scene.nxr and
  // tamer_info_sub_scene.nxr, both owned by OVL4.
  TAMER_INFO: "TAMER_INFO",
  GATE_SELECT: "GATE_SELECT",
  HUNT_LOADOUT: "HUNT_LOADOUT",
  HUNT_FIELD: "HUNT_FIELD",
  HUNT_RESULT: "HUNT_RESULT",
  // VS5 Auto Battle. The three ids mirror the original's own screen names: the
  // ROM's background witnesses are battle_menu, then the match, then
  // battle_result, each with its _main / _sub pair.
  BATTLE_SELECT: "BATTLE_SELECT",
  // The multi-round tournaments, reached from the battle menu as the original
  // reaches them: ui/conference_list_item.nxr is a row in that menu, a cup and
  // a name on a plate, and the entry it opens is priced the way
  // battle_menu/titlematch_top_sub_scene.nxr prices one -- the fee against what
  // the player holds, marked when it cannot be paid.
  CHAMPIONSHIP: "CHAMPIONSHIP",
  BATTLE_FIELD: "BATTLE_FIELD",
  BATTLE_RESULT: "BATTLE_RESULT"
});

export const CHAMPIONSHIP_SCREEN_STACK_MAX_DEPTH = 5;

// Forward transitions only. Going back is popping, and is legal wherever the
// stack has something to pop to.
const FORWARD_TRANSITIONS = deepFreeze({
  RAISING_HOME: ["GATE_SELECT", "SHOP", "DATABASE", "CAGE_EDIT", "BATTLE_SELECT", "DIGIMON_LIST", "SCHEDULE", "HELP", "TAMER_INFO"],
  SHOP: [],
  DATABASE: [],
  CAGE_EDIT: [],
  DIGIMON_LIST: [],
  SCHEDULE: [],
  HELP: [],
  TAMER_INFO: [],
  GATE_SELECT: ["HUNT_LOADOUT"],
  HUNT_LOADOUT: ["HUNT_FIELD"],
  HUNT_FIELD: ["HUNT_RESULT"],
  HUNT_RESULT: [],
  // A match is entered from the menu and leaves on its own verdict: the battle
  // stops itself on a wipe or on the clock passing 7200, so nothing forward of
  // BATTLE_FIELD is reachable by choice.
  BATTLE_SELECT: ["BATTLE_FIELD", "CHAMPIONSHIP"],
  // A round is fought from the board, and leaving the judged round unwinds the
  // way every other match does; the application walks back to the board while a
  // run is still owed a round, which is not re-entering the round.
  CHAMPIONSHIP: ["BATTLE_FIELD"],
  BATTLE_FIELD: ["BATTLE_RESULT"],
  BATTLE_RESULT: []
});

// Screens that unwind the whole stack rather than popping one level. Leaving the
// Hunt field or Hunt Result returns to Raising Home directly: the loadout and
// gate screens are not somewhere the player should land on the way out. A match
// unwinds the same way, because a tournament round that has been judged must not
// be re-entered by popping back to it.
const RESET_TARGETS = deepFreeze({
  HUNT_FIELD: "RAISING_HOME",
  HUNT_RESULT: "RAISING_HOME",
  BATTLE_FIELD: "RAISING_HOME",
  BATTLE_RESULT: "RAISING_HOME"
});

function screenStackError(message) {
  const error = new Error(message);
  error.name = "ChampionshipScreenStackError";
  return error;
}

export function isChampionshipScreen(id) {
  return typeof id === "string" && Object.hasOwn(CHAMPIONSHIP_SCREENS, id);
}

export function createChampionshipScreenStack({ initial = CHAMPIONSHIP_SCREENS.RAISING_HOME } = {}) {
  if (!isChampionshipScreen(initial)) throw screenStackError(`UNKNOWN_SCREEN: ${initial}`);

  let stack = [initial];
  const listeners = new Set();

  function publish() {
    const snapshot = current();
    for (const listener of [...listeners]) {
      try { listener(snapshot); } catch { /* a failing observer must not break navigation */ }
    }
    return snapshot;
  }

  function current() {
    return stack[stack.length - 1];
  }

  return Object.freeze({
    current,

    depth() {
      return stack.length;
    },

    trail() {
      return Object.freeze([...stack]);
    },

    canEnter(id) {
      return isChampionshipScreen(id) && FORWARD_TRANSITIONS[current()].includes(id);
    },

    /** Push a screen. Refuses any transition not on the declared table. */
    enter(id) {
      if (!isChampionshipScreen(id)) throw screenStackError(`UNKNOWN_SCREEN: ${id}`);
      if (!FORWARD_TRANSITIONS[current()].includes(id)) {
        throw screenStackError(`ILLEGAL_SCREEN_TRANSITION: ${current()} -> ${id}`);
      }
      if (stack.length >= CHAMPIONSHIP_SCREEN_STACK_MAX_DEPTH) {
        throw screenStackError("SCREEN_STACK_DEPTH_EXCEEDED");
      }
      stack.push(id);
      return publish();
    },

    canGoBack() {
      return stack.length > 1;
    },

    /** Pop one level. A no-op at the root, so a stray back cannot empty the stack. */
    back() {
      if (stack.length <= 1) return current();
      stack.pop();
      return publish();
    },

    /**
     * Leave a screen that unwinds the stack rather than popping it.
     *
     * Only declared in RESET_TARGETS, so this cannot become a general "jump
     * anywhere" escape hatch.
     */
    canExit() {
      return Object.hasOwn(RESET_TARGETS, current());
    },

    exit() {
      const target = RESET_TARGETS[current()];
      if (!target) throw screenStackError(`SCREEN_HAS_NO_EXIT: ${current()}`);
      stack = [target];
      return publish();
    },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A screen stack observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
