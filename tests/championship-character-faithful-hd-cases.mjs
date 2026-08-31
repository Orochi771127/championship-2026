import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const artRoot = path.join(root, "docs/art/production/characters/faithful-hd224");
const master = JSON.parse(fs.readFileSync(path.join(artRoot, "manifest.json"), "utf8"));

test("faithful HD character catalog covers all 224 original entities in seven batches", () => {
  assert.equal(master.entityCount, 224);
  assert.equal(master.batchCount, 7);
  assert.equal(master.batchSize, 32);
  assert.equal(master.fullRosterBuilt, true);
  assert.equal(master.entities.length, 224);
  assert.equal(new Set(master.entities.map((entry) => entry.entityId)).size, 224);
  assert.deepEqual(master.entities.slice(0, 8).map((entry) => entry.kind), Array(8).fill("egg"));
  assert.equal(master.entities.slice(8).every((entry) => entry.kind === "digimon"), true);
  assert.equal(master.entities[0].entityId, "e000_digitama");
  assert.equal(master.entities.at(-1).entityId, "m541_dukemon");
});

test("all faithful HD character runtime contracts and previews exist without machine paths", () => {
  for (const entry of master.entities) {
    assert.equal(fs.existsSync(path.join(artRoot, entry.runtime)), true, entry.runtime);
    assert.equal(fs.existsSync(path.join(artRoot, entry.preview)), true, entry.preview);
  }
  const serialized = JSON.stringify(master);
  assert.doesNotMatch(serialized, /[A-Z]:\\|\.nds\b|nitrofs|research-only/i);
});

test("PixiJS atlas contract preserves Main/Sub timelines and the shared anchor", () => {
  for (const entry of [master.entities[0], master.entities[8], master.entities.at(-1)]) {
    const runtime = JSON.parse(fs.readFileSync(path.join(artRoot, entry.runtime), "utf8"));
    assert.equal(runtime.renderer, "PIXIJS_V8_SPRITESHEET");
    assert.deepEqual(runtime.artProfile.anchor, { x: 0.5, y: 0.9090909090909091 });
    assert.deepEqual(Object.keys(runtime.sides), ["main", "sub"]);
    for (const side of Object.values(runtime.sides)) {
      assert.ok(side.atlases.length >= 1);
      assert.ok(side.animations.length >= 2);
      assert.equal(side.animations.every((animation) => animation.frames.length >= 1), true);
      assert.equal(side.animations.flatMap((animation) => animation.frames).every((frame) => frame.ticks > 0), true);
    }
  }
  const adult = JSON.parse(fs.readFileSync(path.join(artRoot, master.entities[8].runtime), "utf8"));
  assert.equal(adult.sides.main.animations.length, 40);
  assert.equal(adult.sides.sub.animations.length, 13);
});

test("faithful HD output remains approval-gated rather than silently entering runtime", () => {
  assert.equal(master.rightsStatus, "LICENSED");
  assert.equal(master.licenseEvidenceStatus, "OWNER_REPORTED_LINK_PENDING");
  assert.equal(master.humanApproved, false);
  assert.equal(master.runtimeEligible, false);
  assert.equal(master.shippingReady, false);
  assert.equal(master.artifactMaturity, "FUNCTIONAL_PIXEL_FAITHFUL_HD_BASELINE_NOT_SMOOTH_HAND_REDRAW");
});
