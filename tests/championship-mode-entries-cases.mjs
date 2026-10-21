// Mode entries (2026-10-21): additional modes are entered from data, with
// open / teaser / hidden states that never leave an empty slot.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MODE_ENTRIES, MODE_ENTRY_STATES, modeEntryState, modeMenuEntries, normalizeModeEntries } from "../src/championship/app/modeEntries.js";

test("the shipped record keeps Data Arena open on the Battle menu and invents no mode", () => {
  assert.deepEqual(MODE_ENTRIES.map((entry) => [entry.id, entry.surface, entry.state]), [["dataArena", "BATTLE_SELECT", "OPEN"]]);
  assert.equal(modeEntryState("dataArena"), MODE_ENTRY_STATES.OPEN);
  assert.equal(modeEntryState("unlisted"), MODE_ENTRY_STATES.OPEN, "a mode with no record keeps working");
  assert.deepEqual(modeMenuEntries(), [], "no menu row until a mode is configured");
});

test("open, teaser and hidden states, and invalid records dropped", () => {
  const entries = normalizeModeEntries({ entries: [
    { id: "openMode", surface: "MENU_GO", state: "OPEN", label: "開放", screen: "BATTLE_SELECT" },
    { id: "soonMode", surface: "MENU_GO", state: "PREVIEW", label: "預告", hint: "說明" },
    { id: "hiddenMode", surface: "MENU_GO", state: "HIDDEN", label: "隱藏" },
    { id: "noTarget", surface: "MENU_GO", state: "OPEN", label: "沒有去處" },
    { id: "Bad id", surface: "MENU_GO", state: "OPEN", label: "x", screen: "SHOP" },
    { id: "openMode", surface: "MENU_GO", state: "OPEN", label: "重複", screen: "SHOP" },
    { id: "elsewhere", surface: "NOWHERE", state: "OPEN", label: "x" },
    { id: "unlabelled", surface: "MENU_GO", state: "PREVIEW", label: " " }
  ] });
  assert.deepEqual(entries.map((entry) => entry.id), ["openMode", "soonMode", "hiddenMode", "noTarget"]);
  const menu = modeMenuEntries(entries);
  assert.deepEqual(menu.map((entry) => [entry.id, Boolean(entry.preview), entry.screen ?? null]),
    [["openMode", false, "BATTLE_SELECT"], ["soonMode", true, null], ["noTarget", true, null]], "hidden draws nothing; an open entry without a target is only a preview");
  assert.equal(modeEntryState("hiddenMode", entries), MODE_ENTRY_STATES.HIDDEN);
});

test("the menu and the Battle screen read the record", () => {
  const toolbar = fs.readFileSync("src/championship/app/championshipToolbar.js", "utf8");
  assert.match(toolbar, /group\.id === "go" \? modes\.map/);
  assert.match(toolbar, /button\.dataset\.state = "PREVIEW";/);
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  assert.match(main, /onOpenDataArena: modeEntryState\('dataArena'\) === MODE_ENTRY_STATES\.OPEN \? enterDataArena : undefined/);
  assert.ok(fs.existsSync("docs/contracts/championship/MODE_ENTRY_INTERFACE_2026-10-21.md"));
  assert.doesNotMatch(toolbar, /SATIETY|ENERGY|EASE|READINESS/, "the toolbar keeps its evidence boundary");
});
