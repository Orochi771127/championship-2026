import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../node_modules/three/build/three.module.js";
import {
  createFaithfulVfxRuntime,
  INTERNAL_FAITHFUL_VFX_ASSET_ID,
  validateFaithfulVfxRuntimeManifest
} from "../src/championship/presentation/vfx/faithfulVfxRuntimeBundle.js";

function system(systemId, sidecars = []) {
  return {
    systemId,
    model: `assets/production/internal-faithful-baseline/v1/vfx/${systemId}/${systemId}.glb`,
    sidecars,
    triggerBinding: "EXTERNAL_PRESENTATION_EVENT_REQUIRED",
    playback: "CALLER_CONTROLLED_NO_PRIVATE_TICKER"
  };
}

function manifest() {
  return {
    schemaVersion: 1,
    assetId: INTERNAL_FAITHFUL_VFX_ASSET_ID,
    internalRuntimeEligible: true,
    publicReleasePermitted: false,
    shippingReady: false,
    sourcePayloadIncluded: false,
    tickerPolicy: "CALLER_OWNED_UPDATE_DELTA_MS",
    gateEarthMounted: false,
    systems: [
      system("hitspark_big"),
      system("hypereffect", ["assets/production/internal-faithful-baseline/v1/vfx/hypereffect/hypereffect.visibility.json"]),
      system("spark"),
      system("rain")
    ]
  };
}

test("faithful VFX manifest is internal-only and excludes Gate Earth", () => {
  const checked = validateFaithfulVfxRuntimeManifest(manifest());
  assert.equal(checked.internalRuntimeEligible, true);
  assert.equal(checked.publicReleasePermitted, false);
  assert.equal(checked.gateEarthMounted, false);
  assert.deepEqual(checked.systems.map((entry) => entry.systemId), ["hitspark_big", "hypereffect", "spark", "rain"]);
  assert.throws(() => validateFaithfulVfxRuntimeManifest({ ...manifest(), gateEarthMounted: true }), /GATE_EARTH/);
});

test("runtime loads one effect, advances only from caller delta and disposes it", async () => {
  const loader = {
    async loadAsync() {
      const scene = new THREE.Group();
      scene.name = "effect_root";
      const node = new THREE.Group();
      node.name = "visible_node";
      scene.add(node);
      return {
        scene,
        animations: [],
        parser: { json: { animations: [] }, associations: new Map() }
      };
    }
  };
  const sidecar = {
    schemaVersion: 1,
    kind: "nitro-visibility-animation",
    frameCount: 2,
    nodeCount: 1,
    nodeNames: ["visible_node"],
    frames: ["1", "0"]
  };
  const runtime = createFaithfulVfxRuntime({ manifest: manifest(), loader, loadJson: async () => sidecar });
  assert.deepEqual(runtime.listSystems(), ["hitspark_big", "hypereffect", "spark", "rain"]);
  const instance = await runtime.load("hypereffect");
  assert.equal(instance.object3d.getObjectByName("visible_node").visible, true);
  assert.equal(instance.getDiagnostics().ticker, "CALLER_OWNED");
  instance.update(20);
  assert.equal(instance.object3d.getObjectByName("visible_node").visible, false);
  assert.equal(instance.getDiagnostics().finished, false);
  instance.update(20);
  assert.equal(instance.getDiagnostics().finished, true);
  await runtime.unload();
  assert.equal(runtime.getActive(), null);
  assert.equal(instance.getDiagnostics().disposed, true);
});

test("runtime refuses unknown effects instead of guessing a trigger", async () => {
  const runtime = createFaithfulVfxRuntime({ manifest: manifest(), loader: { loadAsync: async () => null } });
  await assert.rejects(runtime.load("gate-earth"), /UNKNOWN_SYSTEM/);
});
