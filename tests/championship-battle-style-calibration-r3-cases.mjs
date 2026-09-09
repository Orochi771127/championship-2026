import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const workspace = path.join(root, "docs/art/production/battle/style-calibration-r3");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const manifest = readJson("docs/art/production/battle/style-calibration-r3/manifest.json");
const receipt = readJson("docs/art/production/battle/style-calibration-r3/receipt.json");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("human-paint calibration is a three-candidate review packet", () => {
  assert.equal(manifest.purpose, "STYLE_CALIBRATION_BEFORE_RETROFIT");
  assert.equal(manifest.candidateCount, 3);
  assert.equal(manifest.recommendedCandidate, "candidates/bm06-human-paint-c-recommended.png");
  assert.equal(manifest.ownerStyleApproval.state, "APPROVED_FOR_BOUNDED_MIGRATION");
  assert.equal(receipt.ownerStyleApproval.state, "APPROVED_FOR_BOUNDED_MIGRATION");
  assert.equal(manifest.runtimeMutation, false);
  assert.equal(manifest.replacementPerformed, false);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
  assert.equal(receipt.inputs.length, 4);
  assert.deepEqual(receipt.comparisonLayout, ["TOP_LEFT_CURRENT", "TOP_RIGHT_A", "BOTTOM_LEFT_B", "BOTTOM_RIGHT_C_RECOMMENDED"]);
});

test("all candidates are exact 1536x1024 RGB files with pinned hashes", () => {
  for (const item of receipt.inputs.slice(1)) {
    const file = path.join(root, item.file);
    assert.deepEqual(pngHeader(file), { width: 1536, height: 1024, colorType: 2 });
    assert.equal(sha256(file), item.sha256);
    assert.equal(item.role, "ORIGINAL_CREATED_STYLE_CANDIDATE");
  }
});

test("comparison and portrait checks are deterministic", () => {
  const comparison = path.join(root, receipt.comparison.file);
  assert.deepEqual(pngHeader(comparison), { width: 1536, height: 1024, colorType: 2 });
  assert.equal(sha256(comparison), receipt.comparison.sha256);
  for (const item of receipt.viewportChecks) {
    const file = path.join(root, item.file);
    assert.deepEqual([pngHeader(file).width, pngHeader(file).height], item.viewport);
    assert.equal(sha256(file), item.sha256);
  }
});

test("style pilot is absent from runtime registration and production assets", () => {
  const index = fs.readFileSync(path.join(root, "assets/production/ART_PRODUCTION_INDEX.json"), "utf8");
  const reviewPage = fs.readFileSync(path.join(root, "battle-art-review.html"), "utf8");
  assert.doesNotMatch(index, /style-calibration-r3|human-paint/i);
  assert.doesNotMatch(reviewPage, /style-calibration-r3|human-paint/i);
  assert.equal(fs.existsSync(path.join(root, "assets/production/internal-battle-review/style-calibration-r3")), false);
  assert.equal(receipt.runtimeMutation, false);
  assert.equal(receipt.replacementPerformed, false);
});

test("brief records the human-authored correction without artist imitation", () => {
  const critique = fs.readFileSync(path.join(workspace, "STYLE_CRITIQUE.md"), "utf8");
  const bible = fs.readFileSync(path.join(workspace, "STYLE_BIBLE_DELTA.md"), "utf8");
  const prompts = fs.readFileSync(path.join(workspace, "PROMPTS.md"), "utf8");
  assert.match(critique, /uniformly polished/i);
  assert.match(bible, /broken and lost edges/i);
  assert.match(prompts, /forty percent/i);
  assert.doesNotMatch(`${critique}\n${bible}\n${prompts}`, /in the style of/i);
});
