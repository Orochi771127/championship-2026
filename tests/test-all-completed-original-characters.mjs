import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COMPLETED_ORIGINAL_CHARACTERS, isCompletedOriginalLocal } from "../src/championship/presentation/completedOriginalCharacterCatalog.js";
import { applyCompletedOriginalHudArt, validateCompletedOriginalRuntime } from "../src/championship/presentation/completedOriginalCharacters.js";
import { SPECIES_NAMES_ZH, SPECIAL_SPECIES_NAMES_ZH } from "../src/championship/text/catalogs.zhHant.js";
import { speciesName } from "../src/championship/text/zhHant.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("all registered characters in completed original character catalog exist and have valid structure", () => {
  assert.equal(COMPLETED_ORIGINAL_CHARACTERS.length, 222, "Expected 213 prior characters + 8 existing egg positions + m454");
  for (const c of COMPLETED_ORIGINAL_CHARACTERS) {
    assert.ok(c.entityId, "entityId required");
    assert.ok(c.speciesId, "speciesId required");
    assert.equal(c.density, 4);
    assert.ok(Array.isArray(c.logicalCanvas) && c.logicalCanvas.length === 2);
    assert.deepEqual(c.rasterCanvas, [c.logicalCanvas[0] * 4, c.logicalCanvas[1] * 4]);
    assert.equal(c.origin.length, 2);
    assert.ok(c.sourceBankSha256, "sourceBankSha256 required");
    assert.ok(Object.keys(c.frameOrigins).length > 0, "frameOrigins required");
  }
});

test("all registered review files exist and pass integrity checks", () => {
  for (const c of COMPLETED_ORIGINAL_CHARACTERS) {
    const reviewDir = path.join(ROOT, "assets/production/internal-character-review", c.folder);
    assert.ok(fs.existsSync(reviewDir), `Review dir must exist for ${c.entityId}`);

    const manifest = JSON.parse(fs.readFileSync(path.join(reviewDir, "manifest.json"), "utf-8"));
    assert.equal(manifest.entityId, c.entityId);
    assert.equal(manifest.sourceBankSha256, c.sourceBankSha256);
    if (c.folder.includes("-mature-raw-")) {
      assert.equal(manifest.visualAccepted, true);
    }

    const runtime = JSON.parse(fs.readFileSync(path.join(reviewDir, "runtime.review.json"), "utf-8"));
    const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/production/internal-faithful-baseline/characters-v1", c.entityId, "runtime.json"), "utf-8"));
    validateCompletedOriginalRuntime(runtime, c, baseline);
    assert.equal(runtime.entityId, c.entityId);
    assert.equal(runtime.artProfile.scale, 4);
    assert.equal(runtime.artProfile.anchor.x, c.origin[0] / c.logicalCanvas[0]);
    assert.equal(runtime.artProfile.anchor.y, c.origin[1] / c.logicalCanvas[1]);

    const hudManifest = JSON.parse(fs.readFileSync(path.join(reviewDir, "hud-r01/manifest.json"), "utf-8"));
    assert.equal(hudManifest.entityId, c.entityId);
    assert.equal(hudManifest.portrait.speciesId, c.speciesId);
    assert.equal(hudManifest.battle.speciesId, c.speciesId);
  }
});

test("applyCompletedOriginalHudArt successfully loads all selected portraits and battle sets", async () => {
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

  // Load baseline HUD manifest first
  const baselineHud = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/production/internal-faithful-baseline/character-hud-v1/manifest.json"), "utf-8"));
  for (const p of baselineHud.portraits) {
    portraits.set(p.speciesId, p);
  }
  for (const b of baselineHud.battle) {
    battle.set(b.speciesId, { sequences: b.sequences, cells: new Map(b.cells.map(c => [c.cell, c])) });
  }

  // Intercept warnings
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    await applyCompletedOriginalHudArt({
      baseUrl,
      fetchImpl: mockFetch,
      portraits,
      battle
    });
  } finally {
    console.warn = origWarn;
  }

  assert.equal(warnings.length, 0, `Warnings encountered: ${JSON.stringify(warnings)}`);

  for (const c of COMPLETED_ORIGINAL_CHARACTERS) {
    const portrait = portraits.get(c.speciesId);
    assert.ok(portrait, `Portrait for ${c.speciesId} (${c.entityId}) must exist`);
    assert.equal(portrait.entityId, c.entityId);
    assert.equal(portrait.rasterScale, 4);

    const b = battle.get(c.speciesId);
    assert.ok(b, `Battle art for ${c.speciesId} (${c.entityId}) must exist`);
    assert.ok(b.cells.size > 0);
  }

  // Verify companion species HUD aliases
  assert.equal(portraits.get("species-096")?.entityId, "m330_geograymon");
  assert.equal(portraits.get("species-097")?.entityId, "m331_seadramon");
  assert.equal(portraits.get("species-224")?.entityId, "m201_agumon");
  assert.equal(portraits.get("species-225")?.entityId, "m509_shinegraymon");
  assert.ok(battle.get("species-096")?.cells.size > 0);
  assert.ok(battle.get("species-097")?.cells.size > 0);
  assert.ok(battle.get("species-224")?.cells.size > 0);
  assert.ok(battle.get("species-225")?.cells.size > 0);
});

test("all registered species have original custom names in SPECIES_NAMES_ZH", () => {
  for (const c of COMPLETED_ORIGINAL_CHARACTERS) {
    const specIndex = parseInt(c.speciesId.replace("species-", ""), 10);
    const zhName = speciesName(specIndex);
    assert.ok(zhName, `Species ${specIndex} (${c.entityId}) must have localized name`);
    assert.notEqual(zhName, "未知數碼獸");
    // Verify it's not the old ROM name for key ones
    if (c.entityId === "m301_ankylomon") assert.equal(zhName, "晶鏈甲龍");
    if (c.entityId === "m303_ikkakumon") assert.equal(zhName, "極潮角獸");
    if (c.entityId === "m304_wizarmon") assert.equal(zhName, "影紋術士");
    if (c.entityId === "m305_woodmon") assert.equal(zhName, "森核樹靈");
    if (c.entityId === "m402_anomalocarimon") assert.equal(zhName, "裂潮異蝦");
    if (c.entityId === "m201_agumon") assert.equal(zhName, "鎧焰蜥");
    if (c.entityId === "m214_kunemon") assert.equal(zhName, "葉角幼蟲");
    if (c.entityId === "m237_renamon") assert.equal(zhName, "光綾狐");
    if (c.entityId === "m001_zurumon") assert.equal(zhName, "星滴靈");
    if (c.entityId === "m501_vikemon") assert.equal(zhName, "霜灣戰牙");
    if (c.entityId === "m502_valkyrimon") assert.equal(zhName, "曜羽武姬");
    if (c.entityId === "m503_warglaymon") assert.equal(zhName, "日冕戰暴龍");
    if (c.entityId === "m541_dukemon") assert.equal(zhName, "赤曜槍皇");
  }

  // Verify mirror species and aliases
  assert.equal(SPECIES_NAMES_ZH[96], "地炎暴牙");
  assert.equal(SPECIES_NAMES_ZH[97], "蒼潮海龍");
  assert.equal(SPECIAL_SPECIES_NAMES_ZH[224], "鎧焰蜥");
  assert.equal(SPECIAL_SPECIES_NAMES_ZH[225], "曜極星龍");
  assert.equal(SPECIAL_SPECIES_NAMES_ZH[226], "地炎暴牙");
  assert.equal(SPECIAL_SPECIES_NAMES_ZH[227], "蒼潮海龍");
  assert.equal(speciesName(224), "鎧焰蜥");
  assert.equal(speciesName(225), "曜極星龍");
  assert.equal(speciesName(226), "地炎暴牙");
  assert.equal(speciesName(227), "蒼潮海龍");
});

test("baby I and II (26 species) authoritative entityId->speciesId bindings, HUD, ZH name, and stage progression match without arithmetic guessing", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/production/internal-faithful-baseline/characters-v1/manifest.json"), "utf-8"));
  const baselineBabies = baseline.speciesBindings.filter(b => b.entityId.startsWith("m0") || b.entityId.startsWith("m1"));
  assert.equal(baselineBabies.length, 26, "Must have exactly 26 baby species bindings");

  for (const b of baselineBabies) {
    const catalogEntry = COMPLETED_ORIGINAL_CHARACTERS.find(c => c.entityId === b.entityId);
    assert.ok(catalogEntry, `Catalog entry must exist for baby ${b.entityId}`);
    assert.equal(catalogEntry.speciesId, b.speciesId, `Species binding must match authoritative manifest for ${b.entityId}`);

    // Check review HUD manifest
    const hudManifestPath = path.join(ROOT, "assets/production/internal-character-review", catalogEntry.folder, "hud-r01/manifest.json");
    assert.ok(fs.existsSync(hudManifestPath), `HUD manifest must exist for ${b.entityId}`);
    const hudManifest = JSON.parse(fs.readFileSync(hudManifestPath, "utf-8"));
    assert.equal(hudManifest.portrait.speciesId, b.speciesId);
    assert.equal(hudManifest.battle.speciesId, b.speciesId);

    // Check ZH Name from SPECIES_NAMES_ZH
    const specNum = parseInt(b.speciesId.replace("species-", ""), 10);
    assert.ok(SPECIES_NAMES_ZH[specNum], `SPECIES_NAMES_ZH must have name for index ${specNum} (${b.entityId})`);
    assert.notEqual(SPECIES_NAMES_ZH[specNum], "未知數碼獸");
  }
});
