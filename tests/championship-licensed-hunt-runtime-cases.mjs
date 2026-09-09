import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ORIGINAL_HUNT_FIELD_BINDINGS,
  ORIGINAL_HUNT_TUTORIAL_BINDING
} from "../src/championship/gate/originalHuntFieldBindings.js";
import { originalMapAnimationTicksToMs } from "../src/championship/presentation/originalMapAnimationTiming.js";
import { validateRuntimeMapArtBundle } from "../src/championship/presentation/runtimeMapArtBundle.js";

const MANIFEST_PATH = "assets/production/hunt/licensed-runtime-v1/manifest.json";
const LEGACY_DIR = "assets/production/hunt/licensed-hm00-tutorial";

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

test("licensed Hunt runtime keeps the tutorial field out of the Gate table", () => {
  assert.equal(ORIGINAL_HUNT_TUTORIAL_BINDING.huntId, "HUNT_TUTORIAL");
  assert.equal(ORIGINAL_HUNT_TUTORIAL_BINDING.fieldId, "field_hm00_01");
  assert.equal(manifest.tutorialFieldId, "field_hm00_01");
  assert.equal(manifest.originalHuntId, "HUNT_TUTORIAL");
  assert.ok(fieldIds.includes("field_hm00_01"));
  assert.ok(Object.values(ORIGINAL_HUNT_FIELD_BINDINGS).every((binding) => binding.dayFieldId !== "field_hm00_01"));
});

test("licensed Hunt runtime contains every ROM-verified Gate day and night field", () => {
  assert.equal(checked.runtimeEligible, true);
  assert.equal(checked.shippingReady, false);
  assert.equal(checked.memoryPolicy, "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT");
  assert.equal(checked.fields.length, 30);
  assert.equal(new Set(fieldIds).size, 30);
  for (const binding of Object.values(ORIGINAL_HUNT_FIELD_BINDINGS)) {
    assert.ok(fieldIds.includes(binding.dayFieldId), binding.dayFieldId);
    assert.ok(fieldIds.includes(binding.nightFieldId), binding.nightFieldId);
  }
});

test("licensed Hunt frames live under production, hash-match, and keep verified tick timing", () => {
  for (const field of checked.fields) {
    assert.equal(field.worldWidthPx, 2048);
    assert.equal(field.gameplayBinding, "EXTERNAL_EXISTING_RUNTIME");
    assert.equal(field.gateMapping, "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED");
    assert.equal(field.collisionBinding, "EXTERNAL_NOT_IN_ART_BUNDLE");
    assert.ok(field.frames.length >= 1);
    for (const frame of field.frames) {
      assert.match(frame.src, /^assets\/production\/hunt\/licensed-runtime-v1\/fields\//);
      assert.equal(fs.existsSync(frame.src), true, frame.src);
      assert.equal(sha256File(frame.src), frame.sha256, frame.src);
      if (field.frames.length === 1) {
        assert.equal(frame.durationMs, null);
      } else {
        assert.equal(frame.durationMs, originalMapAnimationTicksToMs(frame.durationRawTicks));
      }
    }
  }
  assert.equal(
    checked.fields.find((field) => field.fieldId === "field_hm00_01").frames[0].sha256,
    "A5123E4B9ED5FD03E3C0AE3FB82AF27947DC3921AECBC0A2DB2C8A6E5876B2F2"
  );
});

test("licensed Hunt runtime does not carry RAW collision or Nitro payloads", () => {
  assert.equal(fs.existsSync(LEGACY_DIR), false);
  const files = walkFiles("assets/production/hunt/licensed-runtime-v1");
  assert.ok(files.every((file) => file.endsWith(".png") || file.endsWith("manifest.json")));
  const text = fs.readFileSync(MANIFEST_PATH, "utf8");
  assert.doesNotMatch(text, /\.atr|\.ncgr|\.nsbmd|attribute-raw-classes|encounter-raw-classes/i);
});
