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
  GATE_SELECT: "GATE_SELECT",
  HUNT_LOADOUT: "HUNT_LOADOUT",
  HUNT_FIELD: "HUNT_FIELD"
});

export const CHAMPIONSHIP_SCREEN_STACK_MAX_DEPTH = 4;

// Forward transitions only. Going back is popping, and is legal wherever the
// stack has something to pop to.
const FORWARD_TRANSITIONS = deepFreeze({
  RAISING_HOME: ["GATE_SELECT"],
  GATE_SELECT: ["HUNT_LOADOUT"],
  HUNT_LOADOUT: ["HUNT_FIELD"],
  HUNT_FIELD: []
});

// Screens that unwind the whole stack rather than popping one level. Leaving the
// Hunt field returns to Raising Home directly: the loadout and gate screens are
// not somewhere the player should land on the way out.
const RESET_TARGETS = deepFreeze({ HUNT_FIELD: "RAISING_HOME" });

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
