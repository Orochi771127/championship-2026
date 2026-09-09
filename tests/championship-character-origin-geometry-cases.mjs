import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Texture, TextureSource, Sprite, Container, Spritesheet } from "pixi.js";
import { deriveCharacterOriginTransform, validateCharacterOriginGeometry, characterOriginGeometrySha256,
  serializeCharacterOriginGeometry } from "../src/championship/presentation/characterOriginGeometry.js";
import { loadLicensedCharacterRoster, LICENSED_CHARACTER_MANIFEST } from "../src/championship/presentation/licensedCharacterRoster.js";
const geometry = JSON.parse(fs.readFileSync(new URL("fixtures/championship-m201-origin-geometry.v1.json", import.meta.url)));
const audit = JSON.parse(fs.readFileSync("docs/art/production/characters/appearance-refresh-v1/generated/entities/m201_agumon/origin-audit.json"));
const manifest = JSON.parse(fs.readFileSync(LICENSED_CHARACTER_MANIFEST));
const baselineRuntime = JSON.parse(fs.readFileSync(path.join(path.dirname(LICENSED_CHARACTER_MANIFEST), "m201_agumon/runtime.json")));
const productionIndex = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json"));
const record = manifest.records.find((item) => item.entityId === geometry.entityId);
const geometryHash = await characterOriginGeometrySha256(geometry);
const validation = { geometry, geometryContractSha256: geometryHash, expectedGeometryContractSha256: geometryHash,
  entityId: geometry.entityId, baselineRuntime, record, motionContractSha256: geometry.motionContractSha256 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("M201 native-origin anchor preserves original first pose without altering scene scales", async () => {
  const transform = await validateCharacterOriginGeometry(validation);
  assert.deepEqual(transform.logicalCanvas, [464, 368]);
  assert.equal(transform.resolution, 1);
  assert.deepEqual(transform.anchorPixels, [184, 292]);
  assert.deepEqual(transform.baselineOriginOffset, [0, -24]);
  close(transform.anchor.x, 184 / 464); close(transform.anchor.y, 292 / 368);
});

test("hash serialization is key-order-independent but content-bound and has a final LF", async () => {
  assert.equal(await characterOriginGeometrySha256(Object.fromEntries(Object.entries(geometry).reverse())), geometryHash);
  assert.ok(serializeCharacterOriginGeometry(geometry).endsWith("\n"));
  const changed = structuredClone(geometry); changed.commonSourceOrigin[0]++;
  await assert.rejects(validateCharacterOriginGeometry({ ...validation, geometry: changed }), /CONTENT_HASH_MISMATCH/);
});

for (const [name, change, error] of [
  ["zero scale", (g) => { g.sourcePixelScaleBySide.main = 0; }, /INVALID_SCALE/],
  ["fractional origin", (g) => { g.commonSourceOrigin[0] = 184.5; }, /INVALID_CANVAS_OR_ORIGIN/],
  ["oversized canvas", (g) => { g.logicalCanvas[0] = 2049; }, /INVALID_CANVAS_OR_ORIGIN/],
  ["out of canvas origin", (g) => { g.commonSourceOrigin[0] = 999; }, /INVALID_CANVAS_OR_ORIGIN/],
  ["reference geometry drift", (g) => { g.referenceBySide.main.currentSourceOrigin[0]++; }, /REFERENCE_GEOMETRY_MISMATCH/],
  ["side transform disagreement", (g) => { g.sourcePixelScaleBySide.sub = 24; }, /INCONSISTENT_SIDE_TRANSFORMS|ANCHOR_OUTSIDE_CANVAS/],
  ["baseline bytes drift", (g) => { g.baselineRuntimeSha256 = "0".repeat(64); }, /BASELINE_MISMATCH/],
  ["motion provenance drift", (g) => { g.motionContractSha256 = "0".repeat(64); }, /PROVENANCE_MISMATCH/],
  ["different reference cell", (g) => { g.referenceBySide.main.texture = "m201_agumon/main/cell_001"; }, /REFERENCE_FRAME_MISMATCH/]
]) test(`even rehashed geometry refuses ${name}`, async () => {
  const changed = structuredClone(geometry); change(changed); const hash = await characterOriginGeometrySha256(changed);
  await assert.rejects(validateCharacterOriginGeometry({ ...validation, geometry: changed, geometryContractSha256: hash, expectedGeometryContractSha256: hash }), error);
});

test("unregistered hash and unsupported species refuse geometry adaptation", async () => {
  await assert.rejects(validateCharacterOriginGeometry({ ...validation, expectedGeometryContractSha256: "0".repeat(64) }), /UNREGISTERED_HASH/);
  await assert.rejects(validateCharacterOriginGeometry({ ...validation, entityId: "m003_nyokimon" }), /UNSUPPORTED_CONTRACT/);
});

async function fixture() {
  const transform = await validateCharacterOriginGeometry(validation);
  const runtime = structuredClone(baselineRuntime);
  runtime.artProfile.logicalCanvas = [...transform.logicalCanvas];
  runtime.artProfile.anchor = { ...transform.anchor };
  const atlasData = {};
  for (const side of ["main", "sub"]) {
    const rows = audit.cells.filter((row) => row.side === side);
    const pages = []; let data, x, y, shelfHeight;
    const newPage = () => {
      const image = `${side}-origin-${pages.length}.png`;
      data = { frames: {}, meta: { image, scale: "1", size: { w: 2048, h: 2048 } } };
      pages.push(data); x = 2; y = 2; shelfHeight = 0;
    };
    newPage();
    for (const row of rows) {
      const trim = row.proposedSpriteSourceSize;
      if (x + trim.w + 2 > 2048) { x = 2; y += shelfHeight + 2; shelfHeight = 0; }
      if (y + trim.h + 2 > 2048) newPage();
      data.frames[row.texture] = { frame: { x, y, w: trim.w, h: trim.h }, rotated: false, trimmed: true,
        spriteSourceSize: { ...trim }, sourceSize: { w: transform.logicalCanvas[0], h: transform.logicalCanvas[1] }, anchor: { ...transform.anchor } };
      x += trim.w + 2; shelfHeight = Math.max(shelfHeight, trim.h);
    }
    runtime.sides[side].atlases = pages.map((page, index) => {
      const data = `${side}-origin-${index}.json`; atlasData[data] = page; return { data, image: page.meta.image };
    });
  }
  const descriptor = { entityId: geometry.entityId, assetId: "art:characters:appearance:m201:origin-v1",
    manifestPath: "assets/production/characters/appearance-refresh-v1/m201_agumon/origin-v1/manifest.json",
    manifest: { entityId: geometry.entityId, assetId: "art:characters:appearance:m201:origin-v1", designVersion: "origin-v1",
      runtime: "runtime.json", runtimeEligible: true, shippingReady: false, publicReleasePermitted: false, humanApproved: true,
      qa: { design: "APPROVED", motion: "PASS", technical: "PASS", normalPath: "PASS", geometry: "PASS" },
      motionContractSha256: geometry.motionContractSha256, geometryContractSha256: geometryHash, originGeometry: structuredClone(geometry),
      sides: structuredClone(record.sides) } };
  const index = structuredClone(productionIndex);
  index.entries.push({ ...structuredClone(descriptor.manifest), manifestPath: descriptor.manifestPath });
  const loaded = [], unloaded = [], sheets = [];
  class RecordedSpritesheet extends Spritesheet { constructor(options) { super(options); sheets.push(this); } }
  const PIXI = { Texture, TextureSource, Sprite, Container, Spritesheet: RecordedSpritesheet, Assets: {
    async load(request) {
      const url = typeof request === "string" ? request : request.src; loaded.push(url);
      if (url.endsWith("runtime.json")) return url.includes("appearance-refresh") ? runtime : baselineRuntime;
      if (url.endsWith(".json")) return url.includes("appearance-refresh") ? atlasData[new URL(url).pathname.split("/").pop()]
        : JSON.parse(fs.readFileSync(new URL(url)));
      return new Texture({ source: new TextureSource({ width: 2048, height: 2048 }) });
    }, async unload(url) { unloaded.push(url); }
  } };
  const args = { manifest, productionIndex: index, speciesIds: ["species-034"], PIXI,
    manifestUrl: pathToFileURL(path.resolve(LICENSED_CHARACTER_MANIFEST)).href, appearanceReplacements: [descriptor],
    baselineMotionContracts: { [geometry.entityId]: geometry.motionContractSha256 }, baselineOriginGeometryContracts: { [geometry.entityId]: geometryHash } };
  args.speciesIds = [manifest.speciesBindings.find((binding) => binding.entityId === geometry.entityId).speciesId];
  return { args, runtime, transform, descriptor, loaded, unloaded, sheets, atlasData };
}

test("real Pixi trim/anchor/world transforms preserve all M201 native displacements across both scene scales and parent flips", async () => {
  const f = await fixture(); const loaded = await loadLicensedCharacterRoster(f.args);
  assert.equal(loaded.getDiagnostics().appearances.length, 1);
  assert.deepEqual(loaded.getDiagnostics().replacementFailures, []);
  const actor = loaded.createActor({ speciesId: f.args.speciesIds[0] });
  assert.ok(actor.sprite instanceof Sprite); assert.equal(actor.controller, null); assert.equal(actor.nativeFramePresenter, null);
  assert.ok(f.sheets.every((sheet) => sheet.cachePrefix.includes(`origin:${geometryHash}:`)));
  const node = new Container(); node.position.set(311, 237); node.addChild(actor.sprite);
  const mainTextures = Object.assign({}, ...f.sheets.map((sheet) => sheet.textures));
  for (const sceneScale of [120 / 352, 0.18]) for (const flipX of [1, -1]) for (const flipY of [1, -1]) {
    actor.sprite.scale.set(sceneScale); node.scale.set(flipX, flipY);
    for (const row of audit.cells.filter((cell) => cell.side === "main")) {
      actor.sprite.texture = mainTextures[row.texture];
      const local = actor.sprite.visualBounds;
      const topLeft = actor.sprite.toGlobal({ x: local.minX, y: local.minY });
      close(topLeft.x, 311 + flipX * sceneScale * (row.signedSourceAlphaBounds[0] * 12));
      close(topLeft.y, 237 + flipY * sceneScale * (row.signedSourceAlphaBounds[1] * 12 - 24));
      close(local.maxX - local.minX, (row.signedSourceAlphaBounds[2] - row.signedSourceAlphaBounds[0]) * 12);
      close(local.maxY - local.minY, (row.signedSourceAlphaBounds[3] - row.signedSourceAlphaBounds[1]) * 12);
    }
  }
  assert.ok(!f.loaded.some((url) => /sub-origin-\d+\.png$/.test(url)));
  node.destroy({ children: true }); await loaded.dispose();
});

test("the first actual baseline pose and adapted first pose have identical Pixi visual bounds", async () => {
  const f = await fixture();
  const adapted = await loadLicensedCharacterRoster(f.args);
  const baseline = await loadLicensedCharacterRoster({ ...f.args, appearanceReplacements: [] });
  const a = adapted.createActor({ speciesId: f.args.speciesIds[0] }).sprite;
  const b = baseline.createActor({ speciesId: f.args.speciesIds[0] }).sprite;
  for (const key of ["minX", "minY", "maxX", "maxY"]) close(a.visualBounds[key], b.visualBounds[key]);
  a.destroy(); b.destroy(); await adapted.dispose(); await baseline.dispose();
});

test("all 83 Main/Sub actual Pixi frame bounds retain signed NCER offsets at one uniform source scale", async () => {
  const f = await fixture(); const textures = {}; const sheets = [];
  for (const data of Object.values(f.atlasData)) {
    const sheet = new Spritesheet({ texture: new Texture({ source: new TextureSource({ width: 2048, height: 2048 }) }), data });
    await sheet.parse(); Object.assign(textures, sheet.textures); sheets.push(sheet);
  }
  assert.equal(Object.keys(textures).length, 83);
  for (const row of audit.cells) {
    const sprite = new Sprite({ texture: textures[row.texture] });
    sprite.anchor.set(f.transform.anchor.x, f.transform.anchor.y);
    const bounds = sprite.visualBounds;
    close(bounds.minX, row.signedSourceAlphaBounds[0] * 12);
    close(bounds.minY, row.signedSourceAlphaBounds[1] * 12 - 24);
    close(bounds.maxX, row.signedSourceAlphaBounds[2] * 12);
    close(bounds.maxY, row.signedSourceAlphaBounds[3] * 12 - 24);
    sprite.destroy();
  }
  // Explicitly preserve the lifted and right-shifted source poses; never fit them to the first pose's feet.
  const lift = audit.cells.find((row) => row.texture === "m201_agumon/main/cell_054");
  const right = audit.cells.find((row) => row.texture === "m201_agumon/main/cell_009");
  assert.equal(lift.proposedSpriteSourceSize.y + lift.proposedSpriteSourceSize.h, 244);
  assert.equal(right.proposedSpriteSourceSize.x, 196);
  for (const sheet of sheets) sheet.destroy(true);
});

test("common-origin export with twice the pixels normalizes through real Pixi resolution, not scene scale", async () => {
  const transform = deriveCharacterOriginTransform({ canvas: [928, 736], origin: [368, 536], sourceScale: 24,
    baselineScale: 12, baselineOrigin: [192, 296], baselineCanvas: [384, 352], baselineAnchor: geometry.baselineAnchor });
  assert.equal(transform.resolution, 2);
  const source = new TextureSource({ width: 1024, height: 1024 });
  const sheet = new Spritesheet({ texture: new Texture({ source }), data: { frames: { reference: {
    frame: { x: 0, y: 0, w: 384, h: 432 }, rotated: false, trimmed: true,
    spriteSourceSize: { x: 176, y: 152, w: 384, h: 432 }, sourceSize: { w: 928, h: 736 }, anchor: transform.anchor
  } }, meta: { scale: "2", image: "test.png", size: { w: 1024, h: 1024 } } } });
  await sheet.parse(); const sprite = new Sprite({ texture: sheet.textures.reference }); sprite.anchor.set(transform.anchor.x, transform.anchor.y);
  close(sprite.visualBounds.minX, -96); close(sprite.visualBounds.minY, -216);
  close(sprite.visualBounds.maxX, 96); close(sprite.visualBounds.maxY, 0);
  sprite.destroy(); sheet.destroy(true);
});

for (const [name, change] of [
  ["geometry QA missing", (f) => { delete f.descriptor.manifest.qa.geometry; }],
  ["geometry hash map missing", (f) => { f.args.baselineOriginGeometryContracts = {}; }],
  ["tampered geometry payload", (f) => { f.descriptor.manifest.originGeometry.commonSourceOrigin[0]++; }],
  ["runtime anchor uses raw proposal", (f) => { f.runtime.artProfile.anchor = audit.exportProposal.anchor; }],
  ["runtime resolution drift", (f) => { Object.values(f.atlasData)[0].meta.scale = "2"; }],
  ["boolean resolution", (f) => { Object.values(f.atlasData)[0].meta.scale = true; }],
  ["null resolution", (f) => { Object.values(f.atlasData)[0].meta.scale = null; }],
  ["missing resolution", (f) => { delete Object.values(f.atlasData)[0].meta.scale; }],
  ["non-finite resolution", (f) => { Object.values(f.atlasData)[0].meta.scale = Infinity; }],
  ["ambiguous resolution prefix", (f) => { Object.values(f.atlasData)[0].meta.scale = "1units"; }],
  ["blank resolution", (f) => { Object.values(f.atlasData)[0].meta.scale = " "; }],
  ["new canvas without adapter", (f) => { delete f.descriptor.manifest.originGeometry; delete f.descriptor.manifest.geometryContractSha256; }]
]) test(`${name} falls back to complete baseline without altered scene API`, async () => {
  const f = await fixture(); change(f); const loaded = await loadLicensedCharacterRoster(f.args);
  assert.equal(loaded.getDiagnostics().appearances.length, 0); assert.equal(loaded.getDiagnostics().replacementFailures.length, 1);
  assert.equal(loaded.createActor({ speciesId: f.args.speciesIds[0] }).entityId, geometry.entityId);
  assert.ok(!f.loaded.some((url) => url.includes("appearance-refresh") && url.endsWith(".png")));
  await loaded.dispose();
});
