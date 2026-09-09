import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { loadLicensedCharacterRoster, LICENSED_CHARACTER_MANIFEST } from "../src/championship/presentation/licensedCharacterRoster.js";
const manifest = JSON.parse(fs.readFileSync(LICENSED_CHARACTER_MANIFEST, "utf8"));
const index = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
const manifestUrl = pathToFileURL(path.resolve(LICENSED_CHARACTER_MANIFEST)).href;
const hash = "a".repeat(64);

function fixture(entityId = "e000_digitama") {
  const record = manifest.records.find((item) => item.entityId === entityId);
  const runtimeFile = path.join(path.dirname(LICENSED_CHARACTER_MANIFEST), record.runtime);
  const baseline = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
  const runtime = structuredClone(baseline);
  const pack = { entityId, assetId: `art:characters:appearance:${entityId}:v1`, designVersion: "v1",
    motionContractSha256: hash, runtimeEligible: true, publicReleasePermitted: false, shippingReady: false,
    humanApproved: true, qa: { design: "APPROVED", motion: "PASS", technical: "PASS", normalPath: "PASS" },
    runtime: "runtime.json", sides: structuredClone(record.sides) };
  const manifestPath = `assets/production/characters/appearance-refresh-v1/${entityId}/v1/manifest.json`;
  const descriptor = { entityId, assetId: pack.assetId, manifestPath, manifest: pack };
  const productionIndex = structuredClone(index);
  productionIndex.entries.push({ ...structuredClone(pack), manifestPath });
  const loaded = [], unloaded = [], sheets = [];
  const data = Object.fromEntries(["main", "sub"].flatMap((side) => baseline.sides[side].atlases.map((atlas) => [atlas.data,
    JSON.parse(fs.readFileSync(path.join(path.dirname(runtimeFile), atlas.data), "utf8"))])));
  class Sprite { constructor({ texture }) { this.texture = texture; this.anchor = { set() {} }; } }
  class Spritesheet {
    constructor({ data, cachePrefix }) { sheets.push(cachePrefix); this.textures = Object.fromEntries(Object.keys(data.frames).map((key) => [key, { key, source: {} }])); }
    async parse() {} destroy() {}
  }
  const PIXI = { Sprite, Spritesheet, Assets: {
    async load(request) {
      const url = typeof request === "string" ? request : request.src;
      loaded.push({ url, parser: request.parser });
      if (url.endsWith("runtime.json")) return url.includes("appearance-refresh") ? runtime : baseline;
      if (url.endsWith(".json")) return data[new URL(url).pathname.split("/").pop()];
      return { source: {} };
    },
    async unload(url) { unloaded.push(url); }
  } };
  const speciesId = manifest.speciesBindings.find((binding) => binding.entityId === entityId).speciesId;
  const args = { PIXI, speciesIds: [speciesId, `championship:creature:${speciesId}`], manifest, productionIndex,
    manifestUrl, appearanceReplacements: [descriptor], baselineMotionContracts: { [entityId]: hash } };
  return { args, descriptor, pack, productionIndex, runtime, record, baseline, data, loaded, unloaded, sheets, speciesId };
}

test("approved complete replacement keeps identity, Main pixels only, all-side metadata, namespace and disposal", async () => {
  const f = fixture();
  const roster = await loadLicensedCharacterRoster(f.args);
  assert.equal(roster.createActor({ speciesId: f.speciesId }).entityId, f.record.entityId);
  assert.equal(roster.getDiagnostics().appearances[0].designVersion, "v1");
  assert.equal(roster.getDiagnostics().loadedEntityIds.length, 1);
  assert.equal(roster.getDiagnostics().replacementFailures.length, 0);
  assert.ok(f.loaded.some((item) => item.url.endsWith("sub-atlas-00.json") && item.parser === "json"));
  assert.ok(!f.loaded.some((item) => item.url.endsWith("sub-atlas-00.png")));
  assert.ok(f.sheets.every((prefix) => prefix.includes(`${f.pack.assetId}:v1:${hash}`)));
  await roster.dispose(); const count = f.unloaded.length; await roster.dispose();
  assert.equal(f.unloaded.length, count);
  assert.ok(f.unloaded.some((url) => url.includes("appearance-refresh") && url.endsWith("runtime.json")));
  assert.throws(() => roster.createActor(), /DISPOSED/);
});

test("manifest-supplied descriptors work without any new scene options", async () => {
  const f = fixture(); const args = { ...f.args, manifest: { ...manifest,
    appearanceReplacements: f.args.appearanceReplacements, motionContractHashes: f.args.baselineMotionContracts } };
  delete args.appearanceReplacements; delete args.baselineMotionContracts;
  const roster = await loadLicensedCharacterRoster(args);
  assert.equal(roster.getDiagnostics().appearances.length, 1); await roster.dispose();
});

for (const [name, change] of [
  ["missing index registration", (f) => f.productionIndex.entries.pop()],
  ["entity mismatch", (f) => { f.pack.entityId = "m201_agumon"; }],
  ["missing baseline hash", (f) => { f.args.baselineMotionContracts = {}; }],
  ["different motion hash", (f) => { f.pack.motionContractSha256 = "b".repeat(64); }],
  ["unapproved design", (f) => { f.pack.qa.design = "PENDING"; }],
  ["unapproved motion", (f) => { f.pack.qa.motion = "PENDING"; }],
  ["unapproved technical", (f) => { f.pack.qa.technical = "PENDING"; }],
  ["unapproved normal path", (f) => { f.pack.qa.normalPath = "PENDING"; }],
  ["missing Sub", (f) => { delete f.pack.sides.sub; }],
  ["partial cell metadata", (f) => { f.pack.sides.main.cells--; }],
  ["duplicate entity", (f) => f.args.appearanceReplacements.push(f.descriptor)],
  ["external manifest", (f) => { f.descriptor.manifestPath = "https://bad.example/manifest.json"; }],
  ["path traversal", (f) => { f.descriptor.manifestPath = "assets/production/characters/appearance-refresh-v1/../bad/v1/manifest.json"; }],
  ["encoded traversal", (f) => { f.descriptor.manifestPath = "assets/production/characters/appearance-refresh-v1/%2e%2e/bad/v1/manifest.json"; }]
]) test(`${name} falls back to the entire baseline entity without fetching a candidate`, async () => {
  const f = fixture(); change(f);
  const roster = await loadLicensedCharacterRoster(f.args);
  assert.equal(roster.getDiagnostics().appearances.length, 0);
  assert.equal(roster.getDiagnostics().replacementFailures.length, 1);
  assert.equal(roster.createActor({ speciesId: f.speciesId }).entityId, f.record.entityId);
  assert.ok(f.loaded.every((item) => !item.url.includes("appearance-refresh")));
  await roster.dispose();
});

for (const [name, change] of [
  ["runtime identity", (f) => { f.runtime.entityId = "m201_agumon"; }],
  ["tick drift", (f) => { f.runtime.sides.main.animations[0].frames[0].ticks++; }],
  ["Sub mode drift", (f) => { f.runtime.sides.sub.animations[0].playbackMode = 1; }],
  ["loop-start drift", (f) => { f.runtime.sides.main.animations[0].loopStartFrame = 1; }],
  ["cell drift", (f) => { f.runtime.sides.main.animations[0].frames[0].cell++; }],
  ["anchor drift", (f) => { f.runtime.artProfile.anchor.y = 1; }],
  ["atlas external path", (f) => { f.runtime.sides.main.atlases[0].data = "https://bad.example/data.json"; }],
  ["atlas metadata traversal", (f) => { f.data["main-atlas-00.json"].meta.image = "../bad.png"; }],
  ["atlas frame outside page", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].frame.x = 2048; }],
  ["atlas negative frame", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].frame.x = -1; }],
  ["atlas fractional frame", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].frame.w = 168.5; }],
  ["atlas zero frame", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].frame.h = 0; }],
  ["trim outside canvas", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].spriteSourceSize.x = 384; }],
  ["trim negative position", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].spriteSourceSize.y = -1; }],
  ["trim dimension mismatch", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].spriteSourceSize.w++; }],
  ["trim fractional position", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].spriteSourceSize.x = 0.5; }],
  ["rotated cell", (f) => { Object.values(f.data["main-atlas-00.json"].frames)[0].rotated = true; }],
  ["atlas multipack", (f) => { f.data["main-atlas-00.json"].meta.related_multi_packs = ["outside.json"]; }],
  ["Sub missing key", (f) => { delete f.data["sub-atlas-00.json"].frames[`${f.record.entityId}/sub/cell_000`]; }],
  ["Sub missing atlas", (f) => { f.runtime.sides.sub.atlases = []; }]
]) test(`${name} rejects actual content before replacement pixels load and recovers baseline`, async () => {
  const f = fixture(); change(f);
  const roster = await loadLicensedCharacterRoster(f.args);
  assert.equal(roster.getDiagnostics().appearances.length, 0);
  assert.equal(roster.getDiagnostics().replacementFailures.length, 1);
  assert.ok(!f.loaded.some((item) => item.url.includes("bad.example")));
  assert.ok(!f.loaded.some((item) => item.url.includes("appearance-refresh") && item.url.endsWith(".png")));
  assert.ok(f.unloaded.some((url) => url.includes("appearance-refresh") && url.endsWith("runtime.json")));
  await roster.dispose();
});

test("replacement runtime forces raw JSON and cannot trigger automatic meta.image dependency loading", async () => {
  const f = fixture();
  f.runtime.frames = {};
  f.runtime.meta = { image: "https://bad.example/unvalidated.png" };
  const load = f.args.PIXI.Assets.load;
  const automaticDependencies = [];
  f.args.PIXI.Assets.load = async (request) => {
    const url = typeof request === "string" ? request : request.src;
    if (url.includes("appearance-refresh") && url.endsWith("runtime.json") && request.parser !== "json") {
      automaticDependencies.push(f.runtime.meta.image);
    }
    return load(request);
  };
  const roster = await loadLicensedCharacterRoster(f.args);
  assert.deepEqual(automaticDependencies, []);
  assert.equal(f.loaded.find((item) => item.url.includes("appearance-refresh") && item.url.endsWith("runtime.json")).parser, "json");
  assert.match(roster.getDiagnostics().replacementFailures[0].reason, /INVALID_RUNTIME_DOCUMENT/);
  assert.equal(roster.createActor({ speciesId: f.speciesId }).entityId, f.record.entityId);
  await roster.dispose();
});

test("image failure falls back once for the entire entity; baseline failure stays isolated", async () => {
  const f = fixture(); const load = f.args.PIXI.Assets.load;
  f.args.PIXI.Assets.load = async (request) => {
    const url = typeof request === "string" ? request : request.src;
    if (url.includes("appearance-refresh") && url.endsWith(".png")) throw new Error("IMAGE_MISSING");
    return load(request);
  };
  const roster = await loadLicensedCharacterRoster(f.args);
  assert.match(roster.getDiagnostics().replacementFailures[0].reason, /IMAGE_MISSING/);
  assert.equal(roster.getDiagnostics().loadedEntityIds.length, 1);
  await roster.dispose();
  const missing = await loadLicensedCharacterRoster({ ...f.args, loadBundle: async () => { throw new Error("ALL_IMAGES_MISSING"); } });
  assert.equal(missing.createActor({ speciesId: f.speciesId }), null);
  assert.equal(missing.getDiagnostics().failures.length, 1); await missing.dispose();
});

test("no-option baseline and original baseline guard are retained", async () => {
  const f = fixture(); const args = { ...f.args }; delete args.appearanceReplacements; delete args.baselineMotionContracts;
  const roster = await loadLicensedCharacterRoster(args);
  assert.equal(roster.getDiagnostics().appearances.length, 0);
  assert.ok(f.loaded.every((item) => !item.url.includes("sub-atlas") && !item.url.includes("appearance-refresh")));
  await roster.dispose();
  await assert.rejects(loadLicensedCharacterRoster({ ...f.args, productionIndex: { entries: [f.productionIndex.entries.at(-1)] } }), /NOT_REGISTERED_FOR_INTERNAL_RUNTIME/);
});

test("M003 native frame projection remains the same capability", async () => {
  const f = fixture("m003_nyokimon"); const calls = [];
  const roster = await loadLicensedCharacterRoster({ ...f.args, loadBundle: async (options) => ({
    createActor(args) { calls.push(args); return { sprite: {}, nativeFramePresenter: {} }; }, async dispose() {} }) });
  roster.createActor({ speciesId: f.speciesId });
  assert.equal(calls[0].nativeFramePresentation, true); assert.equal(calls[0].reducedMotion, false);
  await roster.dispose();
});
