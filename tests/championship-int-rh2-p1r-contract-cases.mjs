import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  TOOLBAR_MENUS,
  TOOLBAR_SLOT_COUNT,
  TOOLBAR_TOOLS
} from "../src/championship/app/championshipToolbar.js";

const view = fs.readFileSync("src/championship/app/raisingHomeP1RView.js", "utf8");
const toolbar = fs.readFileSync("src/championship/app/championshipToolbar.js", "utf8");
const css = fs.readFileSync("src/championship/app/intRh2Styles.css", "utf8");
const appCss = fs.readFileSync("src/championship/app/styles.css", "utf8");
const contract = JSON.parse(fs.readFileSync("docs/contracts/championship/INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json", "utf8"));

test("P1R consumes only the published presentation seam", () => {
  // The view reads the frame through `presentation`, which IS the validated
  // `source` (const presentation = assertPresentationSource(source)). The old
  // literal `source.getFrame()` only ever appeared inside the CARE click
  // handler that was removed on 2026-09-03; the seam guarantee is unchanged.
  assert.match(view, /typeof source\.getFrame !== "function"/, "the seam is validated");
  assert.match(view, /presentation\.getFrame\(\)/, "and the view reads only through it");
  assert.match(view, /presentation\.subscribe\(render\)/);
  // The generic CARE button was removed on 2026-09-03 at the Owner's direction:
  // the original has no such control, and its care is "pick one of six tools,
  // touch the target" with effects that are UNKNOWN_REQUIRES_TRACE in OVL18.
  // The seam still exists and the source still declares it; nothing in the view
  // calls it until the traced tool behaviour is built.
  assert.match(view, /careForCreature/, "the care intent stays on the seam");
  assert.doesNotMatch(view, /int-rh2-care-button/, "no generic CARE control");
  assert.match(view, /presentation\.intents\.requestSave/);
  assert.match(view, /mountField\(\{ host: fieldHost, source: presentation,onTrainingFrame:renderTrainingLabels \}\)/);
  assert.doesNotMatch(view, /championshipStandaloneApp|championshipRaisingProduction|savePort|createChampionshipR2Session/);
  assert.doesNotMatch(view, /new Application|requestAnimationFrame|new Ticker|THREE/);
});

test("toolbar preserves the eight-slot evidence boundary", () => {
  // Moved on 2026-09-03 by the Claude lane. The disabled RAW 00..07 shell used to
  // live in the P1R view; the real toolbar now mounts at body level, because
  // ui/toolbar.nxr is a Shared scene attached by the ARM9 main binary rather than
  // by OVL18. This test's guarantee is unchanged and is now checked where the
  // toolbar actually is: eight slots, and no invented command semantics.
  assert.equal(toolbar.match(/TOOLBAR_SLOT_COUNT = 8/g)?.length, 1);
  assert.match(toolbar, /TOOLBAR_SLOT_COUNT_EVIDENCE = "ROM_VERIFIED"/);
  assert.match(toolbar, /TOOLBAR_SLOT_MAPPING_EVIDENCE = "ROM_VERIFIED"/);
  assert.match(toolbar, /slotMapping = TOOLBAR_SLOT_MAPPING_EVIDENCE/);
  // Six ROM-recovered tool identities, and no seventh invented one.
  assert.equal(TOOLBAR_TOOLS.length, 6);
  assert.deepEqual(
    TOOLBAR_TOOLS.map((tool) => tool.id),
    ["hand", "feed", "protein", "clean", "woundMedicine", "medicine"]
  );
  // Six tools plus two submenus is exactly the traced slot count.
  assert.equal(TOOLBAR_TOOLS.length + TOOLBAR_MENUS.length, TOOLBAR_SLOT_COUNT);
  // Neither the toolbar nor the view may name a stat the toolbar does not drive.
  assert.doesNotMatch(toolbar, /SATIETY|ENERGY|EASE|READINESS|ATTACK|DEFENSE|INTELLIGENCE|SPEED/);
  assert.doesNotMatch(view, /SATIETY|ENERGY|EASE|READINESS|ATTACK|DEFENSE|INTELLIGENCE|SPEED/);
});

test("the two submenus carry exactly the observed entries", () => {
  assert.deepEqual(TOOLBAR_MENUS.map((menu) => menu.id), ["MANAGEMENT", "SYSTEM"]);
  assert.deepEqual(
    TOOLBAR_MENUS[0].entries.map((entry) => entry.label),
    ["Tamer", "Schedule", "Cage Edit", "Digimon", "End Day"]
  );
  assert.deepEqual(
    TOOLBAR_MENUS[1].entries.map((entry) => entry.label),
    ["Help", "Save & Quit", "Database", "Hunt", "Battle", "Shop"]
  );
  // Destinations the original has but this build has not made stay in the menu
  // with no screen and no action, so they render disabled instead of vanishing.
  const unbuilt = TOOLBAR_MENUS.flatMap((menu) => menu.entries)
    .filter((entry) => !entry.screen && !entry.action)
    .map((entry) => entry.label);
  // Digimon left this list on 2026-09-03 when the roster screen was built.
  // Schedule left it on 2026-09-04 when the fixture board was built.
  //   [Claude lane edit to a Codex-owned test: the toolbar entry now carries a
  //    screen, so the assertion had to move with it.]
  // The list shrinking is the point: it is the running count of destinations the
  // original has that this build still does not.
  // Help left it on 2026-09-04 when the cartridge help bank was connected.
  // Tamer left it on 2026-09-04 with the tamer_info screens, emptying the list:
  // every destination the two submenus name now resolves to a screen or an action.
  //   [Claude lane edits to a Codex-owned test, same reason as the Schedule line.]
  // The list reaching zero does NOT mean the screens are complete -- Tamer Info in
  // particular draws six of its eight fields as unsourced. It means no menu entry
  // is a dead end any more, which is what this assertion has always tracked.
  assert.deepEqual(unbuilt, []);
  // Stated in the other direction too, so deleting an entry cannot silently
  // satisfy this test.
  assert.equal(TOOLBAR_MENUS.flatMap((menu) => menu.entries).length, 11);
});

test("P1R layout carries mobile safe-area and touch constraints", () => {
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  // The eight-column rail is the shared toolbar's, so it is checked in the
  // stylesheet that actually draws it. Until 2026-09-09 this matched the P1R
  // stylesheet's copy of the rule -- left behind, along with its markup, when
  // the toolbar moved to body level on 2026-09-03 -- so the assertion was
  // guarding a rule no screen used. That dead pair is gone.
  assert.match(appCss, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /int-rh2-toolbar|int-rh2-raw-slot/,
    "the retired P1R toolbar shell must not come back as unused CSS");
  assert.match(css, /width: min\(100%, 430px\)/);
  assert.match(css, /height: 100%/, "the shell fits the root after shared chrome is reserved");
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
