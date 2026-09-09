import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as THREE from "../node_modules/three/build/three.module.js";

import {
  ORIGINAL_NITRO_VFX_EVENT_ALIASES,
  ORIGINAL_NITRO_VFX_SYSTEM_COUNT,
  ORIGINAL_NITRO_VFX_SYSTEMS,
  resolveOriginalNitroVfxSystemId
} from "../src/championship/presentation/vfx/originalVfxSystemBindings.js";
import {
  createLicensedVfxRuntime,
  LICENSED_VFX_ASSET_ID,
  validateLicensedVfxRuntimeManifest
} from "../src/championship/presentation/vfx/licensedVfxRuntimeBundle.js";

const MANIFEST_PATH = "assets/production/vfx/licensed-runtime-v1/manifest.json";
const HITSPARK_SHA256 = "56FDB4267A5FA08FE0437DA69E821777496BBFF94F562522E0F2C3493E7513F2";
const NITRO_EXTENSIONS = [".nsbmd", ".nsbca", ".nsbta", ".nsbma", ".nsbva"];

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

const registry = JSON.parse(fs.readFileSync("docs/art/ART_ASSET_REGISTRY.json", "utf8"));
const nitroFamilies = registry.assets.filter((asset) => asset.assetKind === "NITRO_3D_EFFECT_FAMILY");
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const checked = validateLicensedVfxRuntimeManifest(manifest);

test("licensed VFX runtime stores exactly the 26 Nitro 3D families", () => {
  assert.equal(checked.assetId, LICENSED_VFX_ASSET_ID);
  assert.equal(checked.family, "VFX");
  assert.equal(checked.runtimeEligible, true);
  assert.equal(checked.shippingReady, false);
  assert.equal(checked.gateEarthMounted, false);
  assert.equal(checked.defaultPreviewSystemId, null);
  assert.equal(checked.tickerPolicy, "CALLER_OWNED_UPDATE_DELTA_MS");
  assert.equal(checked.systems.length, ORIGINAL_NITRO_VFX_SYSTEM_COUNT);
  assert.equal(nitroFamilies.length, ORIGINAL_NITRO_VFX_SYSTEM_COUNT);
  assert.deepEqual(
    checked.systems.map((system) => system.logicalGroup).sort(),
    nitroFamilies.map((asset) => asset.logicalGroup).sort()
  );
  assert.deepEqual(
    ORIGINAL_NITRO_VFX_SYSTEMS.map((entry) => entry.systemId),
    checked.systems.map((system) => system.systemId)
  );
  assert.ok(checked.systems.some((system) => system.systemId === "battle-test_buff"));
  assert.ok(checked.systems.some((system) => system.systemId === "battle-test_eff"));
  assert.ok(checked.systems.some((system) => system.systemId === "battle-earth_hit"));
});

test("preview aliases map the four traced events onto licensed system ids", () => {
  assert.equal(resolveOriginalNitroVfxSystemId("hitspark_big"), "battle-hitspark_big");
  assert.equal(resolveOriginalNitroVfxSystemId("hypereffect"), "battle-hypereffect");
  assert.equal(resolveOriginalNitroVfxSystemId("spark"), "common-spark");
  assert.equal(resolveOriginalNitroVfxSystemId("rain"), "common-rain");
  assert.deepEqual(checked.previewAliases, ORIGINAL_NITRO_VFX_EVENT_ALIASES);
});

test("licensed VFX models live under production, hash-match, and keep sidecars to hyper and spark", () => {
  for (const system of checked.systems) {
    assert.match(system.model, /^assets\/production\/vfx\/licensed-runtime-v1\//);
    assert.equal(fs.existsSync(system.model), true, system.model);
    assert.equal(sha256File(system.model), system.modelSha256, system.model);
    assert.equal(system.triggerBinding, "EXTERNAL_PRESENTATION_EVENT_REQUIRED");
    assert.equal(system.playback, "CALLER_CONTROLLED_NO_PRIVATE_TICKER");
    for (const texture of system.textures) {
      assert.equal(fs.existsSync(texture.src), true, texture.src);
      assert.equal(sha256File(texture.src), texture.sha256, texture.src);
    }
  }
  const hitspark = checked.systems.find((system) => system.systemId === "battle-hitspark_big");
  const hyper = checked.systems.find((system) => system.systemId === "battle-hypereffect");
  const spark = checked.systems.find((system) => system.systemId === "common-spark");
  assert.equal(hitspark.modelSha256, HITSPARK_SHA256);
  assert.deepEqual(hyper.sidecars, [
    "assets/production/vfx/licensed-runtime-v1/battle/hypereffect/hypereffect.visibility.json"
  ]);
  assert.deepEqual(spark.sidecars, [
    "assets/production/vfx/licensed-runtime-v1/common/spark/spark.material-animation.json"
  ]);
  for (const system of checked.systems) {
    if (system.systemId === "battle-hypereffect" || system.systemId === "common-spark") continue;
    assert.deepEqual(system.sidecars, [], system.systemId);
  }
});

test("licensed VFX runtime does not carry Nitro binaries or Gate Earth", () => {
  const files = walkFiles("assets/production/vfx/licensed-runtime-v1");
  assert.ok(files.every((file) => (
    file.endsWith(".glb") || file.endsWith(".png") || file.endsWith(".json")
  )));
  assert.ok(files.every((file) => NITRO_EXTENSIONS.every((ext) => !file.toLowerCase().endsWith(ext))));
  assert.ok(files.every((file) => !/gate[_-]?earth|gate[_-]?select/i.test(file)));
  assert.equal(checked.gateEarthMounted, false);
  assert.throws(
    () => validateLicensedVfxRuntimeManifest({ ...checked, gateEarthMounted: true }),
    /GATE_EARTH/
  );
});

test("licensed VFX loader resolves aliases, advances from caller delta, and refuses Gate Earth", async () => {
  const loader = {
    async loadAsync() {
      const scene = new THREE.Group();
      scene.name = "effect_root";
      return {
        scene,
        animations: [],
        parser: { json: { animations: [] }, associations: new Map() }
      };
    }
  };
  const runtime = createLicensedVfxRuntime({ manifest: checked, loader });
  assert.equal(runtime.listSystems().length, ORIGINAL_NITRO_VFX_SYSTEM_COUNT);
  assert.equal(runtime.resolveSystemId("hitspark_big"), "battle-hitspark_big");
  const instance = await runtime.load("hitspark_big", { channel: "preview", loop: true });
  assert.equal(instance.systemId, "battle-hitspark_big");
  assert.equal(instance.getDiagnostics().ticker, "CALLER_OWNED");
  instance.update(16);
  assert.equal(instance.getDiagnostics().elapsedSeconds > 0, true);
  instance.sampleNativeFrame(8);
  const sampled=instance.getDiagnostics().elapsedSeconds;
  instance.sampleNativeFrame(8);
  assert.equal(instance.getDiagnostics().elapsedSeconds,sampled,'redraw must not advance animation');
  instance.sampleNativeFrame(0);
  assert.equal(instance.getDiagnostics().elapsedSeconds,0,'next attack restarts the cached resource');
  assert.throws(()=>instance.sampleNativeFrame(-1),/INVALID_NATIVE_FRAME/);
  await assert.rejects(runtime.load("gate-earth"), /UNKNOWN_SYSTEM/);
  await runtime.unloadAll();
  assert.equal(runtime.getActive("preview"), null);
});

test("battle VFX overlay uses the Pixi ticker, authored camera, and no pointer", () => {
  const overlay = fs.readFileSync("src/championship/presentation/vs5/createBattleVfxThreeOverlay.js", "utf8");
  const styles = fs.readFileSync("src/championship/app/vs5Styles.css", "utf8");
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  assert.doesNotMatch(overlay, /requestAnimationFrame|setAnimationLoop/);
  assert.match(overlay, /stage\.app\.ticker\.add/);
  assert.match(overlay, /PRODUCT_AUTHORED_PREVIEW_FRAMING/);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /\.cm-vs5-vfx-overlay/);
  assert.match(main, /vfxArt/);
  assert.doesNotMatch(main, /battleWeatherVfx|publishWeather/);
});
