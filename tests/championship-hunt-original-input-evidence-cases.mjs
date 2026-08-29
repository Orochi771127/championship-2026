import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const trace = fs.readFileSync("docs/research/HUNT_FIELD_INPUT_ROM_TRACE_2026-08-29.md", "utf8");
const catalog = fs.readFileSync("docs/research/ORIGINAL_GAMEPLAY_MODE_CATALOG_2026-08-29.md", "utf8");
const gap = fs.readFileSync("docs/research/CHAMPIONSHIP_2026_FEATURE_GAP_MATRIX_2026-08-29.csv", "utf8");
const currentField = fs.readFileSync("src/championship/presentation/vs2/createHuntFieldPixiPresentation.js", "utf8");

test("Hunt ROM trace records inverse-delta panning and the original 256x192 camera clamp", () => {
  for (const address of ["0x0211CA38", "0x0211CA54", "0x0211D9F0", "0x0211DA54"]) {
    assert.match(trace, new RegExp(address));
  }
  assert.match(trace, /field width minus `0x100` \(256 pixels\)/);
  assert.match(trace, /field height minus `0xC0` \(192 pixels\)/);
  assert.match(trace, /previousX-currentX/);
  assert.match(trace, /previousY-currentY/);
});

test("research truth says portrait is a viewport and panning is not avatar locomotion", () => {
  assert.match(catalog, /9:16 presentation must preserve free, clamped two-axis field browsing/);
  assert.match(catalog, /not a command to move a player\s+avatar/);
  assert.match(gap, /HUNT-003,Hunt,128x128 field exploration with inverse-delta camera panning/);
  assert.match(gap, /PROTOTYPE_WRONG_AVATAR_MOVE/);
});

test("the known VS2 mismatch stays explicit until its dedicated runtime batch", () => {
  assert.match(currentField, /source\.intents\.moveTo\(point\.x, point\.y\)/);
  assert.match(trace, /current VS2 prototype does not have parity here/);
  assert.match(trace, /must be replaced by a persistent, clamped camera-pan intent/);
});
