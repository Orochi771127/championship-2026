import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MAP_ART_MEMORY_POLICIES,
  loadRuntimeMapArtTileSet,
  validateRuntimeMapArtBundle
} from "../src/championship/presentation/runtimeMapArtBundle.js";
import { layoutRanchTiles } from "../src/championship/cage/ranchSlotGeometry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cageManifest = JSON.parse(
  fs.readFileSync(path.join(root, "assets/production/cage/licensed-runtime-v1/manifest.json"), "utf8")
);
const huntManifest = JSON.parse(
  fs.readFileSync(path.join(root, "assets/production/hunt/licensed-runtime-v1/manifest.json"), "utf8")
);

/** Minimal PIXI surface: enough for the loader, nothing more. */
function stubPixi() {
  const loaded = [];
  const unloaded = [];
  const destroyed = [];
  const node = (label) => ({
    label,
    parent: null,
    position: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
    width: 0,
    height: 0,
    children: [],
    addChild(child) { child.parent = this; this.children.push(child); },
    removeChild(child) { child.parent = null; this.children = this.children.filter((c) => c !== child); },
    destroy() { destroyed.push(this.label); }
  });
  return {
    loaded,
    unloaded,
    destroyed,
    PIXI: {
      Assets: {
        async load(src) { loaded.push(src); return { source: { scaleMode: "linear" } }; },
        async unload(src) { unloaded.push(src); }
      },
      Sprite: function Sprite() { return node("sprite"); },
      AnimatedSprite: function AnimatedSprite() {
        return Object.assign(node("animated"), { gotoAndStop() {} });
      },
      Container: function Container() { return node("container"); }
    }
  };
}

test("the shipped cage bundle declares the tiled policy and Hunt still does not", () => {
  assert.equal(cageManifest.memoryPolicy, MAP_ART_MEMORY_POLICIES.N_ACTIVE_TILES);
  assert.equal(huntManifest.memoryPolicy, MAP_ART_MEMORY_POLICIES.ONE_ACTIVE);
});

test("a tile set refuses a one-active bundle, so Hunt maps cannot be composited", async () => {
  const { PIXI } = stubPixi();
  await assert.rejects(
    () => loadRuntimeMapArtTileSet({
      PIXI,
      manifest: huntManifest,
      placements: [{ fieldId: huntManifest.fields[0].fieldId, x: 0, y: 0 }]
    }),
    /TILE_SET_REQUIRES_N_ACTIVE_TILES_POLICY/
  );
});

test("several real cages composite into one container at their laid-out positions", async () => {
  const checked = validateRuntimeMapArtBundle(cageManifest);
  const chosen = ["field_cm01_01", "field_cm09_01", "field_cm20_01"].map((fieldId, index) => {
    const field = checked.fields.find((entry) => entry.fieldId === fieldId);
    assert.ok(field, fieldId);
    return { slotIndex: index, fieldId, worldWidthPx: field.worldWidthPx, worldHeightPx: field.worldHeightPx };
  });
  const layout = layoutRanchTiles(chosen);

  const { PIXI, loaded } = stubPixi();
  const set = await loadRuntimeMapArtTileSet({ PIXI, manifest: checked, placements: layout.tiles });

  assert.equal(set.tileCount, 3);
  assert.equal(set.displayObject.children.length, 3, "all three are in one container");

  // Four of the forty cages are two-frame animations, and field_cm09_01 is one
  // of them -- so tiles and texture loads are NOT one to one. A composited ranch
  // has to carry animated cages alongside static ones.
  const expectedFrames = chosen.reduce(
    (total, tile) => total + checked.fields.find((field) => field.fieldId === tile.fieldId).frames.length, 0
  );
  assert.equal(expectedFrames, 4, "one of the three chosen cages is animated");
  assert.equal(loaded.length, expectedFrames);

  // Every tile sits exactly where the layout put it, on integer coordinates.
  set.displayObject.children.forEach((child, index) => {
    assert.equal(child.position.x, layout.tiles[index].x);
    assert.equal(child.position.y, layout.tiles[index].y);
    assert.ok(Number.isInteger(child.position.x) && Number.isInteger(child.position.y));
  });

  // The composite reports its own bounds, so the presenter can fit-scale it the
  // same way it fit-scales a single field.
  assert.equal(set.field.composite, true);
  assert.equal(set.field.nativePixelWorldScale, 4);
  assert.equal(set.field.worldWidthPx, layout.widthPx);
  assert.equal(set.field.worldHeightPx, layout.heightPx);
  assert.deepEqual([...set.field.tileFieldIds], chosen.map((tile) => tile.fieldId));

  await set.dispose();
});

test("cage native dimensions must be positive and isotropic; mixed tile units fail before loading", async () => {
  for (const field of validateRuntimeMapArtBundle(cageManifest).fields) assert.equal(field.nativePixelWorldScale,4);
  const missing=structuredClone(cageManifest); delete missing.fields[0].nativeWidthPx;
  assert.throws(()=>validateRuntimeMapArtBundle(missing),/NATIVE_WIDTH_REQUIRED/);
  const distorted=structuredClone(cageManifest); distorted.fields[0].nativeHeightPx+=1;
  assert.throws(()=>validateRuntimeMapArtBundle(distorted),/ANISOTROPIC_NATIVE_PIXEL_SCALE/);
  const mixed=structuredClone(cageManifest); mixed.fields[1].nativeWidthPx/=2; mixed.fields[1].nativeHeightPx/=2;
  const {PIXI,loaded}=stubPixi();
  await assert.rejects(()=>loadRuntimeMapArtTileSet({PIXI,manifest:mixed,
    placements:mixed.fields.slice(0,2).map(field=>({fieldId:field.fieldId,x:0,y:0}))}),/TILE_SET_MIXED_NATIVE_PIXEL_SCALE/);
  assert.equal(loaded.length,0);
});

test("disposing a tile set releases every frame it loaded", async () => {
  const checked = validateRuntimeMapArtBundle(cageManifest);
  const placements = layoutRanchTiles(
    ["field_cm01_01", "field_cm02_01"].map((fieldId, index) => {
      const field = checked.fields.find((entry) => entry.fieldId === fieldId);
      return { slotIndex: index, fieldId, worldWidthPx: field.worldWidthPx, worldHeightPx: field.worldHeightPx };
    })
  ).tiles;

  const { PIXI, loaded, unloaded } = stubPixi();
  const set = await loadRuntimeMapArtTileSet({ PIXI, manifest: checked, placements });
  await set.dispose();

  assert.equal(unloaded.length, loaded.length, "every loaded frame is unloaded");
  assert.deepEqual([...unloaded].sort(), [...loaded].sort());
  assert.equal(set.displayObject.children.length, 0);
  assert.equal(set.getDiagnostics().disposed, true);
  await set.dispose(); // idempotent
});

test("an empty placement list is refused rather than producing an empty ranch", async () => {
  const { PIXI } = stubPixi();
  await assert.rejects(
    () => loadRuntimeMapArtTileSet({ PIXI, manifest: cageManifest, placements: [] }),
    /TILE_SET_PLACEMENTS_REQUIRED/
  );
});

test("the measured tile facts the composition contract quotes still hold", () => {
  const checked = validateRuntimeMapArtBundle(cageManifest);
  assert.equal(checked.fields.length, 40);
  const footprints = new Set(checked.fields.map((field) => `${field.nativeWidthPx}x${field.nativeHeightPx}`));
  assert.equal(footprints.size, 9, "nine distinct native footprints");
  for (const field of checked.fields) {
    assert.equal(field.worldWidthPx, field.nativeWidthPx * 4, `${field.fieldId} scale`);
    assert.equal(field.worldHeightPx, field.nativeHeightPx * 4, `${field.fieldId} scale`);
    assert.equal(field.nativeWidthPx % 48, 0, `${field.fieldId} width is on the 48px module`);
    assert.ok([112, 200].includes(field.nativeHeightPx), `${field.fieldId} height class`);
  }
});

test("invalid positions and duplicate slot assignments refuse before texture allocation", async () => {
  for (const position of [{x:NaN,y:0},{x:0,y:Infinity},{x:-1,y:0},{x:.2,y:0}]) {
    const {PIXI,loaded}=stubPixi();
    await assert.rejects(()=>loadRuntimeMapArtTileSet({PIXI,manifest:cageManifest,
      placements:[{fieldId:"field_cm01_01",...position}]}),/INTEGER_POSITION_REQUIRED/);
    assert.equal(loaded.length,0);
  }
  const {PIXI,loaded}=stubPixi();
  await assert.rejects(()=>loadRuntimeMapArtTileSet({PIXI,manifest:cageManifest,
    placements:[0,1].map(index=>({fieldId:"field_cm01_01",x:index*384,y:0,slotIndex:0}))}),/DUPLICATE_SLOT/);
  assert.equal(loaded.length,0);
});

test("mutation during async decode cannot change tile identity, positions or diagnostics", async () => {
  const {PIXI}=stubPixi();
  const load=PIXI.Assets.load;
  let release;
  const gate=new Promise(resolve=>release=resolve);
  PIXI.Assets.load=async(src)=>{await gate;return load(src);};
  const placements=[{fieldId:"field_cm01_01",x:0,y:0,slotIndex:2,moduleId:"module-a",cageDefinitionIndex:0}];
  const pending=loadRuntimeMapArtTileSet({PIXI,manifest:cageManifest,placements,
    placementEvidence:"PRODUCT_AUTHORED",presentationMode:"PLAYER_PLACEMENTS"});
  placements[0].x=900;placements[0].fieldId="missing";placements.push({});
  release();const result=await pending;
  assert.equal(result.tileCount,1);
  assert.equal(result.field.worldWidthPx,384);
  assert.equal(result.displayObject.children[0].position.x,0);
  assert.equal(result.getDiagnostics().placements[0].moduleId,"module-a");
  assert.equal(result.getDiagnostics().placements[0].slotIndex,2);
  assert.equal(result.getDiagnostics().placementEvidence,"PRODUCT_AUTHORED");
  assert.ok(Object.isFrozen(result.getDiagnostics().placements[0]));
  await result.dispose();
});

test("a composite shares repeated frame URLs and releases them once after both sprites are disposed", async () => {
  const {PIXI,loaded,unloaded}=stubPixi();
  const result=await loadRuntimeMapArtTileSet({PIXI,manifest:cageManifest,
    placements:[0,1].map(index=>({fieldId:"field_cm01_01",x:index*384,y:0,slotIndex:index}))});
  assert.equal(result.tileCount,2);
  assert.notEqual(result.displayObject.children[0],result.displayObject.children[1]);
  assert.equal(loaded.length,1);
  await result.dispose();await result.dispose();
  assert.equal(unloaded.length,1);
});

test("a later texture failure releases the entire partially prepared composite", async () => {
  const {PIXI,loaded,unloaded,destroyed}=stubPixi();
  const originalLoad=PIXI.Assets.load;
  PIXI.Assets.load=async(src)=>{const texture=await originalLoad(src);if(src.includes("field_cm02_01"))throw new Error("decode failed");return texture;};
  await assert.rejects(()=>loadRuntimeMapArtTileSet({PIXI,manifest:cageManifest,
    placements:["field_cm01_01","field_cm02_01"].map((fieldId,index)=>({fieldId,x:index*384,y:0}))}),/decode failed/);
  assert.deepEqual([...unloaded].sort(),[...loaded].sort());
  assert.equal(destroyed.length,2,"prepared sprite and containing scene are released");
});
