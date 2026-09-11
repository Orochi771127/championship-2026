import assert from "node:assert/strict";
import test from "node:test";
import { createChampionshipView, CHAMPIONSHIP_SCREEN_SOURCE_SCENES } from "../src/championship/app/championshipScreen.js";

// The same small DOM boundary the other view suites use. Real layout and
// accessibility geometry are verified in the browser, not here.
class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.classList = { add: (name) => { this.className += ` ${name}`; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  click() { if (!this.disabled) this.listeners.click?.(); }
}

const descendants = (node) => [node, ...node.children.flatMap(descendants)];
const byClass = (root, name) => descendants(root).filter((n) => n.className.split(" ").includes(name));
const textOf = (root, name) => byClass(root, name).map((n) => n.textContent);

function useDocument(t) {
  const original = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new Node(tag),
    createDocumentFragment: () => new Node("fragment")
  };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  return new Node("main");
}

const CATEGORIES = [
  { category: 0, id: "CHAMPIONSHIP", rounds: 3, prize: 50000, poolSizes: [6, 6, 4], unlocked: true, registered: true, active: false },
  { category: 1, id: "WORLD", rounds: 5, prize: 300000, poolSizes: [4, 3, 2, 2, 1], unlocked: false, registered: false, active: false }
];

function harness(t, { categories = CATEGORIES, run = null } = {}) {
  const root = useDocument(t);
  const calls = [];
  const view = createChampionshipView({
    root,
    source: {
      getCategories: () => categories,
      getRun: () => run,
      intents: {
        open(category) { calls.push(["open", category]); return { ok: true }; },
        draw() { calls.push(["draw"]); return { ok: true, opponent: { index: 2, poolSize: 6 } }; },
        record(won) { calls.push(["record", won]); return { ok: true }; },
        settle() { calls.push(["settle"]); return { ok: true, payable: true, prize: 50000 }; },
        leave() { calls.push(["leave"]); }
      }
    }
  });
  return { root, view, calls };
}

test("the board names the original scenes it follows", (t) => {
  const { root } = harness(t);
  assert.deepEqual([...CHAMPIONSHIP_SCREEN_SOURCE_SCENES], [
    "ui/conference_list_item.nxr",
    "battle_menu/titlematch_top_sub_scene.nxr",
    "training/schedule_item.nxr"
  ]);
  assert.equal(root.dataset.sourceScenes, CHAMPIONSHIP_SCREEN_SOURCE_SCENES.join(" "));
});

test("each tournament is a cup, a name and its prize, and a shut one says why", (t) => {
  const { root, calls } = harness(t);
  const rows = byClass(root, "cm-championship-entry");
  assert.equal(rows.length, 2);
  assert.deepEqual(textOf(root, "cm-championship-cup"), ["🏆", "🏆"]);
  assert.deepEqual(textOf(root, "cm-championship-entry__name"), ["冠軍大會", "世界大會"]);
  assert.deepEqual(textOf(root, "cm-championship-prize__digits"), ["50,000", "300,000"]);
  assert.equal(rows[0].disabled, false);
  assert.equal(rows[1].disabled, true);
  assert.match(textOf(root, "cm-championship-entry__reason")[0], /冠軍大會/);

  rows[0].click();
  assert.deepEqual(calls[0], ["open", 0]);
  // A shut row sends nothing.
  rows[1].click();
  assert.equal(calls.filter((call) => call[0] === "open").length, 1);
});

test("a running tournament shows one mark per round and draws that round's opponent", (t) => {
  const run = { category: 0, id: "CHAMPIONSHIP", totalRounds: 3, prize: 50000, cursor: 1, flags: [1],
    round: 1, finalRound: false, continues: true, payable: false };
  const { root, calls } = harness(t, { run });
  assert.equal(byClass(root, "cm-championship-entry").length, 0);
  assert.deepEqual(byClass(root, "cm-championship-round").map((n) => n.dataset.state),
    ["WON", "NOW", "PENDING"]);
  assert.match(byClass(root, "cm-championship-run__title")[0].textContent, /第 2 輪 \/ 共 3 輪/);
  assert.deepEqual(calls[0], ["draw"]);
  assert.match(byClass(root, "cm-championship-opponent")[0].textContent, /第 3 隊 \/ 共 6 隊/);

  // Recording redraws, which draws the next round's opponent, so the record is
  // asserted by what was sent rather than by what was sent last.
  const [win, lose] = byClass(root, "cm-championship-action");
  win.click();
  assert.deepEqual(calls.filter((call) => call[0] === "record"), [["record", true]]);
  lose.click();
  assert.deepEqual(calls.filter((call) => call[0] === "record"), [["record", true], ["record", false]]);
});

test("a finished run offers the prize it is owed, and a lost one offers only an exit", (t) => {
  const swept = { category: 0, id: "CHAMPIONSHIP", totalRounds: 3, prize: 50000, cursor: 3, flags: [1, 1, 1],
    round: 3, finalRound: true, continues: false, payable: true };
  const { root, calls } = harness(t, { run: swept });
  const [settle] = byClass(root, "cm-championship-action--primary");
  assert.match(settle.textContent, /領取 50,000/);
  settle.click();
  assert.deepEqual(calls.at(-1), ["settle"]);
  assert.match(byClass(root, "cm-championship-notice")[0].textContent, /獲得 50,000/);
});

test("a run that ended early shows the loss and offers no prize", (t) => {
  const lost = { category: 0, id: "CHAMPIONSHIP", totalRounds: 3, prize: 50000, cursor: 2, flags: [1, 0],
    round: 2, finalRound: false, continues: false, payable: false };
  const { root } = harness(t, { run: lost });
  assert.match(byClass(root, "cm-championship-action--primary")[0].textContent, /結束賽事/);
  assert.deepEqual(byClass(root, "cm-championship-round").map((n) => n.dataset.state),
    ["WON", "LOST", "PENDING"]);
});

test("the board leaves on its own back control", (t) => {
  const { root, calls } = harness(t);
  byClass(root, "cm-championship-back")[0].click();
  assert.deepEqual(calls.at(-1), ["leave"]);
});
