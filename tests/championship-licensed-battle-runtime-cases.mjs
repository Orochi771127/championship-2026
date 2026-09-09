import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ORIGINAL_BATTLE_FIELD_BINDINGS,
  ORIGINAL_BATTLE_FIELD_COUNT,
  ORIGINAL_BATTLE_SHARED_LAYER_ASSET,
  ORIGINAL_BATTLE_SHARED_LAYER_ID,
  getOriginalBattleFieldBinding,
  getOriginalBattleFieldBindingByFieldId
} from "../src/championship/presentation/originalBattleFieldBindings.js";
import { validateRuntimeMapArtBundle } from "../src/championship/presentation/runtimeMapArtBundle.js";

const MANIFEST_PATH = "assets/production/battle/licensed-runtime-v1/manifest.json";
const ANIMATED_UNKNOWN_FIELD_IDS = ["field_bm03_01", "field_bm04_01"];

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function walkFiles(relativeDir) {
  const start = path.resolve(relativeDir);
  const output = [];
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const item = path.join(start, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(item));
    else output.push(path.relative(".", item).replaceAll("\\", "/"));
  }
  return output;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const checked = validateRuntimeMapArtBundle(manifest);
const fieldIds = checked.fields.map((field) => field.fieldId);

test("licensed Battle runtime stores all 11 catalog arenas as static fields", () => {
  assert.equal(checked.family, "BATTLE");
  assert.equal(checked.runtimeEligible, true);
  assert.equal(checked.shippingReady, false);
  assert.equal(checked.memoryPolicy, "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT");
  assert.equal(checked.fields.length, ORIGINAL_BATTLE_FIELD_COUNT);
  assert.equal(new Set(fieldIds).size, ORIGINAL_BATTLE_FIELD_COUNT);
  assert.equal(manifest.defaultPreviewFieldId, "field_bm01_01");
  assert.equal(ORIGINAL_BATTLE_SHARED_LAYER_ID, "field_bm00_00");
  assert.equal(ORIGINAL_BATTLE_SHARED_LAYER_ASSET, "field_bm00_00_common");
  assert.equal(fieldIds.includes(ORIGINAL_BATTLE_SHARED_LAYER_ID), false, "shared layer is not a 12th drawable field");
  for (let index = 1; index <= 11; index += 1) {
    assert.ok(fieldIds.includes(`field_bm${String(index).padStart(2, "0")}_01`));
  }
});

test("licensed Battle bindings stay 1:1 with the ARM9 arena table", () => {
  assert.equal(ORIGINAL_BATTLE_FIELD_BINDINGS.length, ORIGINAL_BATTLE_FIELD_COUNT);
  assert.equal(getOriginalBattleFieldBinding(0).identifier, "BATTLE_NORMAL");
  assert.equal(getOriginalBattleFieldBinding(0).fieldId, "field_bm01_01");
  assert.equal(getOriginalBattleFieldBindingByFieldId("field_bm07_01").identifier, "BATTLE_CYBERSPACE");
  assert.equal(getOriginalBattleFieldBindingByFieldId("field_bm07_01").hasCommonLayer, false);
  assert.equal(
    ORIGINAL_BATTLE_FIELD_BINDINGS.filter((binding) => binding.hasCommonLayer).length,
    10
  );
  for (const binding of ORIGINAL_BATTLE_FIELD_BINDINGS) {
    const field = checked.fields.find((entry) => entry.fieldId === binding.fieldId);
    assert.ok(field, binding.fieldId);
    assert.equal(field.identifier, binding.identifier);
    assert.equal(field.arenaIndex, binding.arenaIndex);
    assert.equal(field.hasCommonLayer, binding.hasCommonLayer);
    assert.equal(field.animationStatus, binding.animationStatus);
    assert.equal(field.objectLayerId, binding.objectLayerId);
    assert.equal(field.visualRole, "BATTLE_ARENA");
  }
});

test("BM03 and BM04 stay one static frame while animation remains untraced", () => {
  for (const fieldId of ANIMATED_UNKNOWN_FIELD_IDS) {
    const field = checked.fields.find((entry) => entry.fieldId === fieldId);
    assert.equal(field.animationStatus, "ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE");
    assert.equal(field.frames.length, 1);
    assert.equal(field.frames[0].durationMs, null);
  }
});

test("licensed Battle frames live under production, hash-match, and keep native 26:17", () => {
  for (const field of checked.fields) {
    assert.equal(field.worldWidthPx, 1664);
    assert.equal(field.worldHeightPx, 1088);
    assert.equal(field.nativeWidthPx, 416);
    assert.equal(field.nativeHeightPx, 272);
    assert.equal(field.gameplayBinding, "EXTERNAL_EXISTING_RUNTIME");
    assert.equal(field.gateMapping, "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED");
    assert.equal(field.collisionBinding, "EXTERNAL_NOT_IN_ART_BUNDLE");
    assert.equal(field.frames.length, 1);
    assert.match(field.frames[0].src, /^assets\/production\/battle\/licensed-runtime-v1\/fields\//);
    assert.equal(fs.existsSync(field.frames[0].src), true, field.frames[0].src);
    assert.equal(sha256File(field.frames[0].src), field.frames[0].sha256, field.frames[0].src);
    assert.equal(field.frames[0].durationMs, null);
  }
  assert.equal(
    checked.fields.find((field) => field.fieldId === "field_bm01_01").frames[0].sha256,
    "5CBDE044F22E406CEB856D70E91DE12DA4E5F80EEA151BF21E8D1B86A2D728A5"
  );
});

test("licensed Battle runtime does not carry RAW collision or Nitro payloads", () => {
  const files = walkFiles("assets/production/battle/licensed-runtime-v1");
  assert.ok(files.every((file) => file.endsWith(".png") || file.endsWith("manifest.json")));
  const text = fs.readFileSync(MANIFEST_PATH, "utf8");
  assert.doesNotMatch(text, /\.atr|\.col|\.nbs|\.opm|\.ncgr|\.nsbmd|attribute-raw-classes|collision-raw-classes/i);
});
