import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const screens = fs.readFileSync("src/championship/app/vs2Screens.js", "utf8");
const styles = fs.readFileSync("src/championship/app/vs2Styles.css", "utf8");
const field = fs.readFileSync("src/championship/presentation/vs2/createHuntFieldPixiPresentation.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("assets/production/temporary/vs2-hunt/manifest.json", "utf8"));

test("VS2-P screens consume only the injected presentation source", () => {
  const imports = [...screens.matchAll(/^import .* from "([^"]+)";/gm)].map(match => match[1]);
  assert.deepEqual(imports, ["../text/uiText.js"], "only display copy may be imported");
  assert.doesNotMatch(screens, /import\s*\(/);
  assert.match(screens, /CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R/);
  assert.match(screens, /PLAYER_MODE/);
  assert.match(screens, /DEVELOPER_EVIDENCE_MODE/);
  assert.doesNotMatch(screens, /createHuntStore|createSave|new\s+Application|PIXI\.Application/);
  assert.doesNotMatch(screens, /screens\.(enter|exit)|recordCapturedCardCreature|applyBitsTransaction/);
});

test("unknown Hunt toolbar semantics stay neutral and developer-gated", () => {
  assert.match(screens, /button\.disabled = true/);
  assert.match(screens, /mode === VS2_PRESENTATION_MODES\.DEVELOPER/);
  assert.match(screens, /RAW_SLOT_/);
  assert.match(screens, /UNKNOWN_REQUIRES_TRACE/);
  // The old shell remains neutral. The separately traced native tools now
  // include CAPTURE_TRAP; banning its name across the whole file hides scope.
  const shell = screens.slice(screens.indexOf("function toolbarShell("), screens.indexOf("export async function createGateSelectView"));
  assert.doesNotMatch(shell, /ATTACK|CAPTURE|ITEM|SCAN|FLEE/);
});

test("the Hunt Loadout screen is built on the recovered original structure", () => {
  // VS2-R2 replaced the companion picker. The Owner directive of 2026-08-28
  // ruled that companion selection must not stand in for the Original Hunt
  // Loadout, so this case inverts: the screen now declares recovered structure,
  // and the prototype marker must be gone from the Player Mode path.
  assert.match(screens, /ORIGINAL_STRUCTURE_ROM_VERIFIED/);
  assert.doesNotMatch(screens, /PRODUCT_AUTHORED_PROTOTYPE_DEVELOPER_ONLY/);

  // Five recovered classes and four plugin positions drive the screen.
  assert.match(screens, /availableEquipment/);
  assert.match(screens, /selectedPlugins/);
  assert.doesNotMatch(screens, /selectCompanion/);
});

test("VS2-P CSS carries the P1R mobile contract", () => {
  assert.match(styles, /env\(safe-area-inset-top/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(4/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /--vs2-gold/);
  assert.match(styles, /--vs2-cyan/);
});

test("temporary Hunt renderer preserves the shared Pixi/runtime authority boundary", () => {
  assert.doesNotMatch(field, /new\s+PIXI\.Application|new\s+Application/);
  assert.deepEqual([...field.matchAll(/^import .* from "(.*?)";/gm)].map((match) => match[1]), ["./huntFieldPointer.js"]);
  assert.match(field, /stage\.createSceneRoot/);
  assert.match(field, /app\.ticker\.add\(advance\)/);
  assert.match(field, /app\.ticker\.remove\(advance\)/);
  assert.match(field, /temporary-signal-grove-kit/);
  assert.doesNotMatch(field, /research\/original-evidence|O3-C|ROM_COPYRIGHTED_REFERENCE/);
});

test("temporary Hunt art manifest is explicit and non-promoted", () => {
  assert.equal(manifest.assetId, "art:hunt_field:vs2:temporary-signal-grove-kit");
  assert.equal(manifest.rightsStatus, "ORIGINAL_CREATED");
  assert.equal(manifest.productionStatus, "TEMPORARY_PRESENTATION");
  assert.equal(manifest.shippingStatus, "NOT_SHIPPING_READY");
  assert.equal(manifest.humanApproved, false);
  assert.equal(manifest.evidenceBoundary.romPixelReuse, false);
  assert.equal(manifest.evidenceBoundary.o3cRuntimeUse, false);
  assert.equal(manifest.promotionGate, "OWNER_VISUAL_REVIEW_REQUIRED");
});
