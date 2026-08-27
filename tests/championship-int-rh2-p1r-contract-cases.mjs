import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const view = fs.readFileSync("src/championship/app/raisingHomeP1RView.js", "utf8");
const css = fs.readFileSync("src/championship/app/intRh2Styles.css", "utf8");
const contract = JSON.parse(fs.readFileSync("docs/contracts/championship/INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json", "utf8"));

test("P1R consumes only the published presentation seam", () => {
  assert.match(view, /source\.getFrame\(\)/);
  assert.match(view, /presentation\.subscribe\(render\)/);
  assert.match(view, /presentation\.intents\.careForCreature/);
  assert.match(view, /presentation\.intents\.requestSave/);
  assert.match(view, /mountField\(\{ host: fieldHost, source: presentation \}\)/);
  assert.doesNotMatch(view, /championshipStandaloneApp|championshipRaisingProduction|savePort|createChampionshipR2Session/);
  assert.doesNotMatch(view, /new Application|requestAnimationFrame|new Ticker|THREE/);
});

test("toolbar preserves the eight-slot evidence boundary", () => {
  assert.equal((view.match(/for \(let slot = 0; slot < 8;/g) ?? []).length, 1);
  assert.match(view, /UNBOUND_PLACEHOLDER/);
  assert.match(view, /UNKNOWN_REQUIRES_TRACE/);
  assert.doesNotMatch(view, /SATIETY|ENERGY|EASE|READINESS|ATTACK|DEFENSE|INTELLIGENCE|SPEED/);
});

test("P1R layout carries mobile safe-area and touch constraints", () => {
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(css, /width: min\(100%, 430px\)/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /min-height: 44px/);
});

test("contract pins renderer ownership and unknown toolbar semantics", () => {
  assert.equal(contract.rendererSplit.dom.includes("Codex"), true);
  assert.equal(contract.rendererSplit.pixi.includes("Claude"), true);
  assert.equal(contract.rendererSplit.three, "NOT USED IN INT-RH2");
  assert.equal(contract.frame.toolbar.slotCount.value, 8);
  assert.equal(contract.frame.toolbar.slots.length, 1, "contract describes the repeated slot schema once");
  assert.equal(contract.frame.toolbar.slots[0].state, "UNBOUND_PLACEHOLDER");
});
