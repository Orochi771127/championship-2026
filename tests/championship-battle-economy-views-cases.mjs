import assert from "node:assert/strict";
import test from "node:test";
import { createBattleResultView, createBattleSelectView } from "../src/championship/app/vs5Screens.js";

// A small DOM boundary for financial display/intent tests. Real layout,
// accessibility geometry and canvas ownership are verified in the browser.
class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.className = "";
    this.classList = { add: (name) => { this.className += ` ${name}`; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  click() { this.listeners.click?.(); }
}

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

function findByClass(root, name) {
  return descendants(root).find((node) => node.className.split(" ").includes(name));
}

function textOf(root) {
  return descendants(root).map((node) => node.textContent).filter(Boolean).join(" ");
}

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

const outcome = { ended: true, verdict: "TEAM_ZERO_AHEAD", reason: "TEAM_DOWN", winningTeam: 0 };

function showPrize(root, receipt) {
  const view = createBattleResultView({ root, outcome, receipt, matchTitle: "MATCH 00" });
  descendants(root).find((node) => node.textContent === "下一頁").click();
  return view;
}

test("a missing receipt cannot display the advertised reward as money received", (t) => {
  const root = useDocument(t);
  const view = showPrize(root, null);
  assert.equal(findByClass(root, "cm-vs5-title").textContent, "—");
  assert.match(textOf(root), /獎金尚未入帳/);
  assert.equal(view.inspect().settlement, "NOT_CREDITED");
  assert.equal(view.inspect().credited, null);
});

test("the prize page displays the actual credit and resulting wallet when capped", (t) => {
  const root = useDocument(t);
  const view = showPrize(root, {
    status: "SETTLED", rewardBits: 7000, credited: 1, walletAfter: 9999999, clamped: true
  });
  assert.equal(findByClass(root, "cm-vs5-title").textContent, "1");
  assert.match(textOf(root), /持有 9999999 位元幣/);
  assert.match(textOf(root), /獎金 7000 位元幣；持有金額已達上限/);
  assert.equal(view.inspect().credited, 1);
});

test("a settled loss displays zero received, distinct from an unsettled reward", (t) => {
  const root = useDocument(t);
  showPrize(root, { status: "SETTLED", rewardBits: 0, credited: 0, walletAfter: 850, clamped: false });
  assert.equal(findByClass(root, "cm-vs5-title").textContent, "0");
  assert.match(textOf(root), /持有 850 位元幣/);
  assert.match(textOf(root), /本場沒有獲得獎金/);
  assert.doesNotMatch(textOf(root), /獎金尚未入帳/);
});

test("the menu distinguishes fee and prize, and explains insufficient funds", (t) => {
  const root = useDocument(t);
  const entries = [];
  let cubeAvailable = null;
  createBattleSelectView({
    root,
    matches: [{ recordIndex: 0, title: "MATCH 00", entryFee: 150, payout: 7000 }],
    onEnter(recordIndex) {
      entries.push(recordIndex);
      return { ok: false, reason: "INSUFFICIENT_BITS", entryFee: 150, wallet: 149 };
    },
    mountCube({ available }) {
      cubeAvailable = [...available];
      return {};
    },
    menuCopy: {
      menu: "Battle", kicker: "Battle", chooseMatch: "Choose", availableMatches: "Matches",
      faceNotice: "Modes pending", noPayout: "No prize"
    }
  });
  assert.equal(findByClass(root, "cm-vs5-match__fee").textContent, "報名費 150 位元幣");
  assert.equal(findByClass(root, "cm-vs5-match__payout").textContent, "獎金 7000 位元幣");
  findByClass(root, "cm-vs5-match__enter").click();
  assert.deepEqual(entries, [0]);
  const notice = findByClass(root, "cm-vs5-entry-notice");
  assert.equal(notice.hidden, false);
  assert.equal(notice.attributes.role, "status");
  assert.match(notice.textContent, /150 位元幣.*149 位元幣/);
  assert.deepEqual(cubeAvailable, [], "fixing entry economics does not enable untraced modes");
});
