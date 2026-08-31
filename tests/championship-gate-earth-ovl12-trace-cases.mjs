import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/art/production/vfx/GATE_EARTH_OVL12_TRACE_V1.json"), "utf8"));

test("Gate Earth trace preserves the verified OVL12 world-map loader chain", () => {
  assert.equal(report.rom.gameCode, "YDIJ");
  assert.equal(report.overlay.id, 12);
  assert.equal(report.overlay.size, 39200);
  assert.equal(report.worldMapLoaderChain.wrapperCall, "0x0210F108");
  assert.equal(report.worldMapLoaderChain.modelLoadCall, "0x0210C6FC");
  assert.deepEqual(report.worldMapLoaderChain.arguments, { folder: "gate_select", model: "3D_worldMap_model" });
});

test("Gate Earth remains reference-only because OVL12 has no name or file-ID consumer", () => {
  assert.equal(report.assets.earth.fileId, 5398);
  assert.equal(report.earthConsumerSearch.ovl12AsciiEarthHits, 0);
  assert.equal(report.earthConsumerSearch.ovl12EarthFileIdU16Hits, 0);
  assert.equal(report.earthConsumerSearch.ovl12EarthFileIdU32Hits, 0);
  assert.equal(report.runtimeDecision.gateEarth, "REFERENCE_ONLY_DO_NOT_MOUNT");
  assert.deepEqual(report.earthConsumerSearch.romCodeAsciiEarthHits, [
    { binary: "OVL19", address: "0x021319B4", text: "earth_hit" }
  ]);
});

test("source-free trace does not leak the ROM path or payload", () => {
  const serialized = JSON.stringify(report);
  assert.equal(report.rom.payloadIncluded, false);
  assert.equal(report.overlay.payloadIncluded, false);
  assert.doesNotMatch(serialized, /[A-Z]:\\|\.nds\b/i);
});
