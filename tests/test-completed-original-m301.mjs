import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { COMPLETED_ORIGINAL_CHARACTERS, isCompletedOriginalLocal } from "../src/championship/presentation/completedOriginalCharacterCatalog.js";
import { applyCompletedOriginalHudArt } from "../src/championship/presentation/completedOriginalCharacters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("m301_ankylomon is registered in completed original character catalog", () => {
  const m301 = COMPLETED_ORIGINAL_CHARACTERS.find(c => c.entityId === "m301_ankylomon");
  assert.ok(m301, "m301 must be in catalog");
  assert.equal(m301.speciesId, "species-072");
  assert.equal(m301.density, 4);
  assert.deepEqual(m301.logicalCanvas, [64, 64]);
  assert.deepEqual(m301.rasterCanvas, [256, 256]);
  assert.deepEqual(m301.origin, [36, 40]);
  assert.equal(m301.sourceBankSha256, "003521fe5b8ac61861fa5b3400fead29b156db58aa159c1a9e963d9b3fcbc6ec");
  assert.equal(Object.keys(m301.frameOrigins).length, 76, "All 76 frames must have origins");
});

test("isCompletedOriginalLocal detects loopback hostnames", () => {
  assert.equal(isCompletedOriginalLocal("http://localhost:8080/"), true);
  assert.equal(isCompletedOriginalLocal("http://127.0.0.1:8080/"), true);
  assert.equal(isCompletedOriginalLocal("http://[::1]:8080/"), true);
  assert.equal(isCompletedOriginalLocal("https://championship.internal/"), false);
});

test("m301 review files exist and pass integrity checks", () => {
  const m301 = COMPLETED_ORIGINAL_CHARACTERS.find(c => c.entityId === "m301_ankylomon");
  const reviewDir = path.join(ROOT, "assets/production/internal-character-review", m301.folder);
  assert.ok(fs.existsSync(reviewDir), "Review dir must exist");

  const manifest = JSON.parse(fs.readFileSync(path.join(reviewDir, "manifest.json"), "utf-8"));
  assert.equal(manifest.entityId, "m301_ankylomon");
  assert.equal(manifest.sourceBankSha256, m301.sourceBankSha256);
  assert.equal(manifest.packedPixelsPerNativePixel, 4);
  assert.equal(manifest.visualAccepted, true);

  const runtime = JSON.parse(fs.readFileSync(path.join(reviewDir, "runtime.review.json"), "utf-8"));
  assert.equal(runtime.entityId, "m301_ankylomon");
  assert.equal(runtime.artProfile.scale, 4);
  assert.equal(runtime.artProfile.anchor.x, 36 / 64);
  assert.equal(runtime.artProfile.anchor.y, 40 / 64);

  const hudManifest = JSON.parse(fs.readFileSync(path.join(reviewDir, "hud-r01/manifest.json"), "utf-8"));
  assert.equal(hudManifest.entityId, "m301_ankylomon");
  assert.equal(hudManifest.portrait.speciesId, "species-072");
  assert.equal(hudManifest.battle.speciesId, "species-072");
});

test("applyCompletedOriginalHudArt loads m301 portrait and battle cells", async () => {
  const baseUrl = "http://localhost:8080/";
  const mockFetch = async (url) => {
    const urlStr = url.toString();
    const relPath = urlStr.replace(baseUrl, "");
    const filePath = path.join(ROOT, relPath);
    if (!fs.existsSync(filePath)) {
      return { ok: false, status: 404 };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(content)
    };
  };

  const portraits = new Map();
  const battle = new Map();

  // Load baseline HUD manifest first so battle.get('species-072') exists
  const baselineHud = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/production/internal-faithful-baseline/character-hud-v1/manifest.json"), "utf-8"));
  for (const p of baselineHud.portraits) {
    portraits.set(p.speciesId, p);
  }
  for (const b of baselineHud.battle) {
    battle.set(b.speciesId, { sequences: b.sequences, cells: new Map(b.cells.map(c => [c.cell, c])) });
  }

  // Apply completed original HUD art
  await applyCompletedOriginalHudArt({
    baseUrl,
    fetchImpl: mockFetch,
    portraits,
    battle
  });

  const m301Portrait = portraits.get("species-072");
  assert.ok(m301Portrait, "m301 portrait should be loaded");
  assert.equal(m301Portrait.entityId, "m301_ankylomon");
  assert.equal(m301Portrait.rasterScale, 4);
  assert.equal(m301Portrait.derivation, "ORIGINAL_CANDIDATE_MAIN_CELL_000_VISIBLE_RGBA");

  const m301Battle = battle.get("species-072");
  assert.ok(m301Battle, "m301 battle art should be loaded");
  assert.equal(m301Battle.sequences.length, 3);
  assert.ok(m301Battle.cells.has(0));
});

test("m301 runtime motions and origins strictly match baseline and catalog", () => {
  const m301 = COMPLETED_ORIGINAL_CHARACTERS.find(c => c.entityId === "m301_ankylomon");
  const reviewDir = path.join(ROOT, "assets/production/internal-character-review", m301.folder);
  const runtime = JSON.parse(fs.readFileSync(path.join(reviewDir, "runtime.review.json"), "utf-8"));
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/production/internal-faithful-baseline/characters-v1/m301_ankylomon/runtime.json"), "utf-8"));

  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

  for (const side of ['main', 'sub']) {
    assert.deepEqual(canonical(runtime.sides[side].animations), canonical(baseline.sides[side].animations));
    for (const animation of runtime.sides[side].animations) {
      for (const frame of animation.frames) {
        const geometry = runtime.reviewGeometry?.frames[frame.texture];
        assert.ok(geometry, `Geometry must exist for ${frame.texture}`);
        assert.equal(geometry.scale, m301.density);
        assert.deepEqual(geometry.origin, m301.frameOrigins[frame.texture]);
        assert.deepEqual(geometry.sourceSize, m301.rasterCanvas);
      }
    }
  }
});
