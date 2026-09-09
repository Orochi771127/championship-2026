import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const scene = fs.readFileSync("src/championship/presentation/vs2/createGateSelectThreePresentation.js", "utf8");
const screens = fs.readFileSync("src/championship/app/vs2Screens.js", "utf8");
const main = fs.readFileSync("src/championship/app/main.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("assets/production/gate/vs2-r1/manifest.json", "utf8"));

test("VS2-R1 is one bounded Three presentation over the existing source and intent", () => {
  assert.equal((scene.match(/new THREE\.WebGLRenderer/g) ?? []).length, 1);
  assert.match(scene, /PUBLISHED_SOURCE_FRAME_AND_SELECT_GATE_INTENT/);
  assert.match(screens, /source\.intents\.selectGate\(gateId\)/);
  assert.match(main, /mountGateSelectThreePresentation/);
  assert.doesNotMatch(scene, /createStore|localStorage|sessionStorage|createSave|new PIXI\.Application/);
  assert.doesNotMatch(scene, /requestAnimationFrame|setAnimationLoop|\.ticker/);
});

test("the authored scene preserves only the verified Gate structure", () => {
  for (const name of ["world_root", "world", "world_day", "world_night"]) assert.match(scene, new RegExp(`"${name}"`));
  assert.match(scene, /gates\.length !== 16/);
  assert.match(scene, /PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER/);
  assert.match(scene, /originalRotationParityClaimed: false/);
  assert.match(scene, /earthUsed: false/);
  assert.doesNotMatch(scene, /earth\.nsbmd|3D_worldMap_model\.nsbmd|TextureLoader|GLTFLoader|research\/original-evidence/i);
});

test("the 2D Gate grid survives as a reachable fallback", () => {
  assert.match(screens, /ACCESSIBILITY_FALLBACK/);
  assert.match(screens, /LOW_CAPABILITY_FALLBACK/);
  assert.match(screens, /VS2_PRESENTATION_MODES\.DEVELOPER/);
  assert.match(screens, /cm-vs2-gates/);
  assert.match(screens, /返回地球/);
  assert.match(screens, /場地列表/);
});

test("the original-created production manifest refuses promotion and ROM payload", () => {
  assert.equal(manifest.rightsStatus, "ORIGINAL_CREATED");
  assert.equal(manifest.productionStatus, "OWNER_APPROVED_STRUCTURAL_BASELINE");
  assert.equal(manifest.artifactMaturity, "STRUCTURAL_PRESENTATION");
  assert.equal(manifest.shippingStatus, "NOT_SHIPPING_READY");
  assert.equal(manifest.humanApproved, true);
  assert.equal(manifest.ownerApproval.finalArt, false);
  assert.equal(manifest.ownerApproval.exactOriginalBehaviorParity, false);
  assert.equal(manifest.evidenceBoundary.romModelReuse, false);
  assert.equal(manifest.evidenceBoundary.nsbmdConversion, false);
  assert.equal(manifest.evidenceBoundary.decodedTextureReuse, false);
  assert.equal(manifest.evidenceBoundary.earthModelUsed, false);
  assert.equal(manifest.promotionGate, "FUTURE_PRODUCTION_PASS_AND_OWNER_GO_REQUIRED");
});
