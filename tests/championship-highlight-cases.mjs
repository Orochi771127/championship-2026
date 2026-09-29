import assert from "node:assert/strict";
import test from "node:test";
import {
  HIGHLIGHT_CHARGE_RANGE_MS, HIGHLIGHT_DEFAULTS, HIGHLIGHT_PHASES,
  classifyBattleResultFeedback, countUpValue, phaseAt, phaseStartMs, resolveHighlightTiming
} from "../src/championship/presentation/highlight/highlightTimeline.js";
import { createHighlightSequence } from "../src/championship/presentation/highlight/createHighlightSequence.js";
import { createBattleResultView } from "../src/championship/app/vs5Screens.js";

// ---- A small DOM boundary. Layout, paint and audio are verified in the browser.
class FakeNode {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName; this.ownerDocument = ownerDocument; this.children = []; this.parent = null;
    this.dataset = {}; this.attributes = {}; this.listeners = {}; this.textContent = ""; this.className = "";
    this.styleValues = {}; this.style = { setProperty: (name, value) => { this.styleValues[name] = value; } };
    this.classList = { add: (name) => { this.className += ` ${name}`; } };
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  removeEventListener(name, listener) { if (this.listeners[name] === listener) delete this.listeners[name]; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 700 }; }
  click() { if (!this.disabled) this.listeners.click?.(); }
}
function fakeDocument() {
  const doc = { createElement: (tag) => new FakeNode(tag, doc), createDocumentFragment: () => new FakeNode("fragment", doc) };
  return doc;
}
const all = (node) => [node, ...node.children.flatMap(all)];
const byClass = (root, name) => all(root).find((node) => node.className.split(" ").includes(name));
const textOf = (root) => all(root).map((node) => node.textContent).filter(Boolean).join(" ");

function fakeTicker() {
  return {
    callbacks: new Set(), deltaMS: 16.667,
    add(fn) { this.callbacks.add(fn); }, remove(fn) { this.callbacks.delete(fn); },
    run(ms, step = 16.667) { for (let spent = 0; spent < ms; spent += step) { this.deltaMS = step; for (const fn of [...this.callbacks]) fn(this); } }
  };
}
function fakeAudio() {
  const cues = [];
  return { cues, cue(name, argument) { cues.push(argument === undefined ? name : `${name}:${argument}`); return true; }, stats: () => ({ played: cues.length }), dispose() { this.disposed = true; } };
}

// ---- Timeline -------------------------------------------------------------
test("the five phases run in order and the charge stays inside 0.6 - 1.0 s", () => {
  assert.deepEqual(HIGHLIGHT_PHASES, ["PREPARE", "BUILD", "CHARGE", "BURST", "REVEAL"]);
  const timing = resolveHighlightTiming();
  assert.equal(timing.chargeMs, HIGHLIGHT_DEFAULTS.chargeMs);
  assert.ok(timing.chargeMs >= 600 && timing.chargeMs <= 1000);
  assert.equal(resolveHighlightTiming({ chargeMs: 200 }).chargeMs, HIGHLIGHT_CHARGE_RANGE_MS[0]);
  assert.equal(resolveHighlightTiming({ chargeMs: 5000 }).chargeMs, HIGHLIGHT_CHARGE_RANGE_MS[1]);
  assert.equal(timing.totalMs, timing.prepareMs + timing.buildMs + timing.chargeMs + timing.burstMs + timing.revealMs);
  assert.throws(() => resolveHighlightTiming({ burstMs: Number.NaN }), /HIGHLIGHT_BURST_NOT_A_NUMBER/);
  assert.equal(resolveHighlightTiming({ particleCount: 9999 }).particleCount, 160, "the shard count has a hard cap");

  const seen = [];
  for (let at = 0; at <= timing.totalMs; at += 10) {
    const { phase } = phaseAt(at, timing);
    if (seen.at(-1) !== phase) seen.push(phase);
  }
  assert.deepEqual(seen, [...HIGHLIGHT_PHASES, "DONE"]);
  for (const phase of HIGHLIGHT_PHASES) assert.equal(phaseAt(phaseStartMs(phase, timing), timing).phase, phase, `${phase} starts on its boundary`);
  assert.equal(phaseAt(timing.totalMs, timing).done, true);
});

test("reduced motion keeps only a short reveal: nothing travels, flashes or bursts", () => {
  const timing = resolveHighlightTiming({}, { reducedMotion: true });
  assert.deepEqual([timing.prepareMs, timing.buildMs, timing.chargeMs, timing.burstMs, timing.particleCount, timing.countUpMs], [0, 0, 0, 0, 0, 0]);
  assert.equal(timing.revealMs, HIGHLIGHT_DEFAULTS.reducedRevealMs);
  assert.equal(phaseAt(0, timing).phase, "REVEAL");
  assert.equal(phaseAt(timing.revealMs, timing).phase, "DONE");
});

test("the count only rises, never passes the settled figure and ends exactly on it", () => {
  for (const target of [0, 1, 7, 50, 5100, 200000, 9999999]) {
    let previous = 0;
    for (let step = 0; step <= 100; step += 1) {
      const value = countUpValue(target, step / 100);
      assert.ok(Number.isSafeInteger(value) && value >= previous && value <= target, `${target} at ${step}%`);
      previous = value;
    }
    assert.equal(countUpValue(target, 1), target);
    assert.equal(countUpValue(target, 0), 0);
  }
  assert.throws(() => countUpValue(-1, 0.5), /HIGHLIGHT_COUNT_TARGET/);
  assert.throws(() => countUpValue(1.5, 0.5), /HIGHLIGHT_COUNT_TARGET/);
});

// ---- Which events earn it ---------------------------------------------------
test("only this attempt's own won, settled and paying receipt earns the highlight", () => {
  const receipt = { attemptId: "battle:7", status: "SETTLED", won: true, rewardBits: 200, credited: 200, walletAfter: 1200, clamped: false };
  const progression = { rankBefore: 3, rankAfter: 3, earnedTitles: [] };
  assert.equal(classifyBattleResultFeedback({ receipt, attemptId: "battle:7", progression }), "highlight");
  assert.equal(classifyBattleResultFeedback({ receipt, attemptId: "battle:8", progression }), "result", "a stale receipt from the last match");
  assert.equal(classifyBattleResultFeedback({ receipt, attemptId: null, progression }), "result", "practice has no attempt");
  assert.equal(classifyBattleResultFeedback({ receipt: { ...receipt, won: false, rewardBits: 0, credited: 0 }, attemptId: "battle:7", progression }), "result");
  assert.equal(classifyBattleResultFeedback({ receipt: { ...receipt, status: "ABANDONED" }, attemptId: "battle:7", progression }), "result");
  assert.equal(classifyBattleResultFeedback({ receipt: null, attemptId: "battle:7", progression }), "result");
  // A win that paid nothing still counts when it raised the rank or a title.
  const unpaid = { ...receipt, rewardBits: 0, credited: 0 };
  assert.equal(classifyBattleResultFeedback({ receipt: unpaid, attemptId: "battle:7", progression }), "result");
  assert.equal(classifyBattleResultFeedback({ receipt: unpaid, attemptId: "battle:7", progression: { ...progression, rankAfter: 4 } }), "highlight");
  assert.equal(classifyBattleResultFeedback({ receipt: unpaid, attemptId: "battle:7", progression: { ...progression, earnedTitles: [{ id: 4 }] } }), "highlight");
  // A wallet at its cap still settled a real win: the clamp is shown, not hidden.
  assert.equal(classifyBattleResultFeedback({ receipt: { ...receipt, credited: 0, walletAfter: 9999999, clamped: true }, attemptId: "battle:7", progression }), "highlight");
  // A malformed receipt never earns a presentation.
  assert.equal(classifyBattleResultFeedback({ receipt: { ...receipt, credited: 500, walletAfter: 100 }, attemptId: "battle:7", progression }), "result");
});

// ---- The sequence -------------------------------------------------------------
test("a run moves through every phase with its cues and lands on the exact figure", () => {
  const doc = fakeDocument(), host = doc.createElement("div"), ticker = fakeTicker(), audio = fakeAudio();
  const phases = [], values = [];
  const run = createHighlightSequence({ host, ticker, target: 5100, audio, onPhase: (phase) => phases.push(phase), onValue: (value) => values.push(value) });
  const layer = byClass(host, "cm-highlight");
  assert.ok(layer, "the layer is mounted in the host");
  assert.equal(layer.attributes["aria-hidden"], "true", "decorative: the verdict text lives on the plate");
  assert.equal(layer.styleValues["--hl-charge"], `${run.timing.chargeMs}ms`);
  run.start();
  assert.equal(ticker.callbacks.size, 1, "one callback on the one ticker");
  ticker.run(run.timing.totalMs + 200);
  assert.deepEqual(phases, [...HIGHLIGHT_PHASES, "DONE"]);
  assert.equal(values.at(-1), 5100);
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]), "the count only rises");
  assert.equal(audio.cues[0], `prepare:${run.timing.prepareMs}`);
  assert.deepEqual(audio.cues.filter((cue) => cue.startsWith("step")), ["step:0", "step:1", "step:2"]);
  assert.ok(audio.cues.indexOf(`charge:${run.timing.chargeMs}`) < audio.cues.indexOf("burst"));
  assert.equal(audio.cues.at(-1), "settle");
  assert.ok(audio.cues.filter((cue) => cue === "tick").length <= HIGHLIGHT_DEFAULTS.tickLimit, "ticks are capped");
  assert.equal(layer.dataset.lit, "3");
  assert.equal(ticker.callbacks.size, 0, "the ticker is released once the run is over");
  const summary = run.inspect();
  assert.equal(summary.phase, "DONE");
  assert.equal(summary.shownValue, 5100);
  assert.ok(summary.frames.count > 100 && summary.frames.p95 > 0);
  run.dispose();
  assert.equal(byClass(host, "cm-highlight"), undefined, "dispose removes the layer");
  assert.equal(audio.disposed, true);
});

test("a skip lands the plate at once with the real figure and no burst cue", async () => {
  const doc = fakeDocument(), host = doc.createElement("div"), ticker = fakeTicker(), audio = fakeAudio();
  const phases = [], values = [];
  const run = createHighlightSequence({ host, ticker, target: 200, audio, onPhase: (phase) => phases.push(phase), onValue: (value) => values.push(value) });
  run.start();
  ticker.run(300);
  assert.equal(run.isRunning(), true);
  assert.equal(run.skip(), true);
  assert.deepEqual(phases, ["PREPARE", "DONE"]);
  assert.deepEqual(values, [200]);
  assert.equal(audio.cues.includes("burst"), false);
  assert.equal(run.skip(), false, "a second skip does nothing");
  const summary = await run.done;
  assert.equal(summary.skipped, true);
  ticker.run(50);
  assert.equal(ticker.callbacks.size, 0);
  run.dispose();
});

test("reduced motion goes straight to a short reveal with no shards", () => {
  const doc = fakeDocument(), host = doc.createElement("div"), ticker = fakeTicker(), phases = [];
  let mounted = 0;
  const run = createHighlightSequence({ host, ticker, target: 50, reducedMotion: true, onPhase: (phase) => phases.push(phase), mountBurst: () => { mounted += 1; return null; } });
  assert.equal(byClass(host, "cm-highlight").dataset.motion, "reduced");
  run.start();
  ticker.run(run.timing.totalMs + 50);
  assert.deepEqual(phases, ["REVEAL", "DONE"]);
  assert.equal(mounted, 0, "the Three.js prop is not even mounted");
  run.dispose();
});

// ---- The battle result view -------------------------------------------------
function useDocument(t) {
  const original = globalThis.document;
  const doc = fakeDocument();
  globalThis.document = doc;
  t.after(() => { if (original === undefined) delete globalThis.document; else globalThis.document = original; });
  return doc.createElement("main");
}
const outcome = { ended: true, verdict: "TEAM_ZERO_AHEAD", reason: "TEAM_DOWN", winningTeam: 0 };
const receipt = { status: "SETTLED", won: true, rewardBits: 5100, credited: 5100, walletAfter: 9100 };

test("the result view hands the plate to the template and shows the settled figure", (t) => {
  const root = useDocument(t);
  let request = null, skips = 0, disposed = 0;
  const view = createBattleResultView({ root, outcome, receipt, feedback: { tier: "highlight", settlement: { credited: 5100, rewardBits: 5100, clamped: false } },
    highlight(given) { request = given; return { skip() { skips += 1; given.onPhase("DONE"); return true; }, dispose() { disposed += 1; } }; } });
  const section = root.children[0];
  assert.equal(section.dataset.feedback, "highlight");
  assert.equal(section.dataset.entrance, "PREPARE", "the plate waits for the reveal");
  assert.equal(request.target, 5100, "the figure is the receipt's credited amount");
  assert.equal(request.focus, byClass(root, "cm-vs5-result__body"));
  assert.match(textOf(root), /獎金 \+ 5,100 位元幣/);
  request.onValue(1234);
  assert.equal(byClass(root, "cm-vs5-result__amount").textContent, "1,234");
  request.onPhase("REVEAL");
  const next = () => all(root).find((node) => node.textContent === "下一頁").click();
  next();
  assert.equal(skips, 1, "the first press lands the highlight");
  assert.equal(section.dataset.panel, "RESULT", "and does not skip the verdict");
  next();
  assert.equal(section.dataset.panel, "PRIZE");
  assert.equal(view.inspect().feedback, "highlight");
  view.dispose();
  assert.equal(disposed, 1);
});

test("an ordinary result never calls the template or shows a settlement line", (t) => {
  const root = useDocument(t);
  let called = false;
  const view = createBattleResultView({ root, outcome: { ...outcome, verdict: "TEAM_ONE_AHEAD", winningTeam: 1 }, receipt: { ...receipt, won: false, rewardBits: 0, credited: 0 },
    feedback: { tier: "result" }, highlight() { called = true; return null; } });
  assert.equal(called, false);
  assert.equal(root.children[0].dataset.feedback, "result");
  assert.equal(root.children[0].dataset.entrance, undefined);
  assert.equal(byClass(root, "cm-vs5-result__settlement"), undefined);
  assert.equal(view.inspect().feedback, "result");
});

test("a clamped win says so, and a template that fails to start lands the plate", (t) => {
  const root = useDocument(t);
  createBattleResultView({ root, outcome, receipt: { ...receipt, credited: 0, walletAfter: 9999999, clamped: true },
    feedback: { tier: "highlight", settlement: { credited: 0, rewardBits: 50, clamped: true } }, highlight() { throw new Error("no stage"); } });
  assert.equal(root.children[0].dataset.entrance, "DONE");
  assert.match(textOf(root), /獎金 \+ 0 位元幣 持有金額已達上限/);
});
