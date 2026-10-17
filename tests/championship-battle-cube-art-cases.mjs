import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import test from "node:test";
import { BATTLE_CUBE_ART_MANIFEST as pack, resolveBattleCubeArt } from "../src/championship/presentation/vs5/battleCubeArt.js";
import { BATTLE_FACE_LABELS } from "../src/championship/text/zhHant.js";

const index = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
const sourceReceipt = JSON.parse(fs.readFileSync('assets/production/battle/menu-cube-v1/manifest.json','utf8'));

test("four registered battle panels resolve to their own Chinese labels and valid PNGs", () => {
  const entries = resolveBattleCubeArt();
  assert.equal(entries.length, 4);
  let bytes = 0;
  for (const row of entries) {
    assert.equal(row.label, BATTLE_FACE_LABELS[row.id]);
    const png = fs.readFileSync(row.texture);
    assert.equal(png.subarray(1,4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
    assert.equal(crypto.createHash("sha256").update(png).digest("hex"), row.sha256);
    assert.equal(png.length, row.bytes);
    bytes += png.length;
    assert.equal(row.sourceLayers,undefined,'Authoring-layer metadata is not runtime payload');
  }
  assert.ok(bytes <= sourceReceipt.budget.maxTotalPngBytes);
});

test("unregistered or disabled cube packs cannot supply runtime textures", () => {
  assert.deepEqual(resolveBattleCubeArt(pack, { entries: [] }), []);
  assert.deepEqual(resolveBattleCubeArt(pack, { assets: [] }), []);
  assert.deepEqual(resolveBattleCubeArt(pack, {assets:[{id:pack.assetId,src:'assets/production/battle/menu-cube-v1/public-manifest.json',sha256:'0'.repeat(64)}]}),[]);
  assert.deepEqual(resolveBattleCubeArt({ ...pack, runtimeEligible: false }, index), []);
  const denied = structuredClone(index);
  denied.entries.find(row => row.assetId === pack.assetId).runtimeEligible = false;
  assert.deepEqual(resolveBattleCubeArt(pack, denied), []);
});

test("foreign paths and duplicate face identities are refused", () => {
  for (const texture of ["research/panel.png", "assets/production/battle/menu-cube-v1/../../foreign.png", "https://example.com/panel.png"]) {
    const changed = structuredClone(pack);
    changed.faces[0].texture = texture;
    assert.deepEqual(resolveBattleCubeArt(changed, index), []);
  }
  const duplicate = structuredClone(pack);
  duplicate.faces[1].id = duplicate.faces[0].id;
  assert.deepEqual(resolveBattleCubeArt(duplicate, index), []);
});

test("four-panel production does not claim complete original menu or gameplay parity", () => {
  assert.equal(sourceReceipt.humanApproved, false);
  assert.equal(sourceReceipt.shippingReady, false);
  assert.equal(sourceReceipt.rightsStatus, "ORIGINAL_CREATED");
  assert.equal(sourceReceipt.textEvidence, "PRODUCT_AUTHORED");
  assert.equal(sourceReceipt.evidenceBoundary.originalPixelReuse, false);
  assert.equal(sourceReceipt.evidenceBoundary.onlyFourOriginalFacesClaimed, false);
  assert.deepEqual(sourceReceipt.evidenceBoundary.additionalReferencePrefixes, ["_06_password", "_07_rensyu"]);
  assert.equal(sourceReceipt.authorityBoundary.newGameModes, false);
  assert.equal(sourceReceipt.authorityBoundary.newTicker, false);
  assert.deepEqual(Object.keys(pack),['schemaVersion','assetId','faces']);
});
