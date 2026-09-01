import * as THREE from "../../../../node_modules/three/build/three.module.js";
import { GLTFLoader } from "../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { applyNitroMaterialAnimation, applyNitroVisibility } from "./nitroVfxAnimationSidecar.js";

export const INTERNAL_FAITHFUL_VFX_ASSET_ID = "art:vfx:faithful-original:internal-v1";
export const INTERNAL_FAITHFUL_VFX_MANIFEST_URL = "assets/production/internal-faithful-baseline/v1/vfx-runtime-manifest.json";

const ALLOWED_SYSTEMS = new Set(["hitspark_big", "hypereffect", "spark", "rain"]);

function fail(reason) {
  const error = new Error(`CHAMPIONSHIP_FAITHFUL_VFX_INVALID: ${reason}`);
  error.name = "ChampionshipFaithfulVfxError";
  throw error;
}

function freeze(value) {
  if (Array.isArray(value)) value.forEach(freeze);
  else if (value && typeof value === "object") Object.values(value).forEach(freeze);
  return value && typeof value === "object" ? Object.freeze(value) : value;
}

export function validateFaithfulVfxRuntimeManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("MANIFEST_REQUIRED");
  if (manifest.schemaVersion !== 1 || manifest.assetId !== INTERNAL_FAITHFUL_VFX_ASSET_ID) fail("MANIFEST_IDENTITY");
  if (manifest.internalRuntimeEligible !== true || manifest.publicReleasePermitted !== false || manifest.shippingReady !== false) fail("INTERNAL_ONLY_RIGHTS_BOUNDARY");
  if (manifest.sourcePayloadIncluded !== false || manifest.tickerPolicy !== "CALLER_OWNED_UPDATE_DELTA_MS") fail("SOURCE_OR_TICKER_POLICY");
  if (manifest.gateEarthMounted !== false) fail("GATE_EARTH_MUST_REMAIN_UNMOUNTED");
  if (!Array.isArray(manifest.systems) || manifest.systems.length !== ALLOWED_SYSTEMS.size) fail("SYSTEM_SET");
  const ids = new Set();
  for (const system of manifest.systems) {
    if (!ALLOWED_SYSTEMS.has(system.systemId) || ids.has(system.systemId)) fail(`SYSTEM_ID:${system.systemId}`);
    ids.add(system.systemId);
    if (typeof system.model !== "string" || !system.model.startsWith("assets/production/internal-faithful-baseline/") || !system.model.endsWith(".glb")) fail(`MODEL_PATH:${system.systemId}`);
    if (!Array.isArray(system.sidecars) || system.sidecars.some((path) => !path.startsWith("assets/production/internal-faithful-baseline/") || !path.endsWith(".json"))) fail(`SIDECAR_PATH:${system.systemId}`);
    if (system.triggerBinding !== "EXTERNAL_PRESENTATION_EVENT_REQUIRED" || system.playback !== "CALLER_CONTROLLED_NO_PRIVATE_TICKER") fail(`CALLER_AUTHORITY:${system.systemId}`);
  }
  return freeze(structuredClone(manifest));
}

function animationPeriodSeconds(gltf) {
  const json = gltf.parser?.json;
  let period = 0;
  for (const animation of json?.animations ?? []) {
    for (const sampler of animation.samplers ?? []) {
      const accessor = json.accessors?.[sampler.input];
      const count = accessor?.count ?? 0;
      const maximum = accessor?.max?.[0] ?? 0;
      if (count > 1 && maximum > 0) period = Math.max(period, maximum + (maximum / (count - 1)));
    }
  }
  return period;
}

async function createPropertyAnimators(gltf) {
  const parser = gltf.parser;
  const json = parser?.json;
  if (!parser || !json) return [];
  const materialsByIndex = new Map();
  for (const [object, association] of parser.associations ?? []) {
    if (Number.isInteger(association?.materials)) materialsByIndex.set(association.materials, object);
  }
  const animators = [];
  for (const animation of json.animations ?? []) {
    for (const channel of animation.extensions?.EXT_property_animation?.channels ?? []) {
      const match = /^\/materials\/(\d+)\/pbrMetallicRoughness\/baseColorTexture\/extensions\/KHR_texture_transform\/offset$/.exec(channel.target);
      if (!match) fail(`UNSUPPORTED_PROPERTY_ANIMATION_TARGET:${channel.target}`);
      const sampler = animation.samplers[channel.sampler];
      const [times, values] = await Promise.all([
        parser.getDependency("accessor", sampler.input),
        parser.getDependency("accessor", sampler.output)
      ]);
      const material = materialsByIndex.get(Number(match[1]));
      if (!material?.map?.offset || times.itemSize !== 1 || values.itemSize !== 2 || times.count !== values.count) fail(`PROPERTY_ANIMATION_BINDING:${channel.target}`);
      animators.push({ material, times: times.array, values: values.array });
    }
  }
  return animators;
}

function samplePropertyAnimator(animator, elapsedSeconds) {
  const { times, values, material } = animator;
  let right = 1;
  while (right < times.length && times[right] <= elapsedSeconds) right += 1;
  if (right >= times.length) right = times.length - 1;
  const left = Math.max(0, right - 1);
  const span = times[right] - times[left];
  const amount = span > 0 ? Math.max(0, Math.min(1, (elapsedSeconds - times[left]) / span)) : 0;
  const x = values[left * 2] + ((values[right * 2] - values[left * 2]) * amount);
  const y = values[(left * 2) + 1] + ((values[(right * 2) + 1] - values[(left * 2) + 1]) * amount);
  material.map.offset.set(x, y);
  material.map.updateMatrix?.();
}

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose?.();
  for (const material of materials) material.dispose?.();
  for (const texture of textures) texture.dispose?.();
}

export async function loadFaithfulVfxRuntimeManifest({ url = INTERNAL_FAITHFUL_VFX_MANIFEST_URL, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") fail("FETCH_REQUIRED");
  const response = await fetchImpl(url);
  if (!response.ok) fail(`MANIFEST_FETCH:${response.status}`);
  return validateFaithfulVfxRuntimeManifest(await response.json());
}

export function createFaithfulVfxRuntime({ manifest, loader = new GLTFLoader(), loadJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) fail(`SIDECAR_FETCH:${response.status}`);
  return response.json();
} }) {
  const checked = validateFaithfulVfxRuntimeManifest(manifest);
  const activeByChannel = new Map();
  const generationByChannel = new Map();

  function checkedChannel(channel) {
    if (typeof channel !== "string" || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(channel)) {
      fail(`CHANNEL:${channel}`);
    }
    return channel;
  }

  async function load(systemId, { loop = false, channel = "transient" } = {}) {
    const runtimeChannel = checkedChannel(channel);
    const record = checked.systems.find((system) => system.systemId === systemId);
    if (!record) fail(`UNKNOWN_SYSTEM:${systemId}`);
    const requestGeneration = (generationByChannel.get(runtimeChannel) ?? 0) + 1;
    generationByChannel.set(runtimeChannel, requestGeneration);
    const [gltf, ...sidecars] = await Promise.all([loader.loadAsync(record.model), ...record.sidecars.map(loadJson)]);
    const propertyAnimators = await createPropertyAnimators(gltf);
    if (requestGeneration !== generationByChannel.get(runtimeChannel)) {
      disposeObject(gltf.scene);
      return null;
    }
    await activeByChannel.get(runtimeChannel)?.dispose();
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = gltf.animations.filter((clip) => clip.tracks.length > 0).map((clip) => mixer.clipAction(clip).play());
    const periodSeconds = animationPeriodSeconds(gltf) || Math.max(...sidecars.map((sidecar) => sidecar.frameCount / 60), 1 / 60);
    let elapsedSeconds = 0;
    let finished = false;
    let disposed = false;

    function applyAt(seconds) {
      mixer.setTime(Math.min(seconds, Math.max(0, ...gltf.animations.map((clip) => clip.duration))));
      for (const animator of propertyAnimators) samplePropertyAnimator(animator, seconds);
      for (const sidecar of sidecars) {
        const sourceFrame = Math.min(sidecar.frameCount - 1, Math.floor((seconds / periodSeconds) * sidecar.frameCount));
        if (sidecar.kind === "nitro-visibility-animation") applyNitroVisibility(gltf.scene, sidecar, sourceFrame);
        else if (sidecar.kind === "nitro-material-color-animation") applyNitroMaterialAnimation(gltf.scene, sidecar, sourceFrame);
        else fail(`UNKNOWN_SIDECAR:${sidecar.kind}`);
      }
    }
    applyAt(0);
    const instance = Object.freeze({
      systemId,
      channel: runtimeChannel,
      object3d: gltf.scene,
      update(deltaMs) {
        if (disposed || finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
        elapsedSeconds += deltaMs / 1000;
        if (loop) elapsedSeconds %= periodSeconds;
        else if (elapsedSeconds >= periodSeconds) {
          elapsedSeconds = periodSeconds;
          finished = true;
        }
        applyAt(Math.min(elapsedSeconds, periodSeconds - Number.EPSILON));
      },
      reset() {
        if (disposed) return;
        elapsedSeconds = 0;
        finished = false;
        applyAt(0);
      },
      getDiagnostics() {
        return freeze({
          assetId: checked.assetId,
          systemId,
          channel: runtimeChannel,
          elapsedSeconds,
          periodSeconds,
          loop,
          finished,
          disposed,
          standardAnimationCount: actions.length,
          propertyAnimationChannels: propertyAnimators.length,
          sidecarCount: sidecars.length,
          ticker: "CALLER_OWNED"
        });
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        mixer.stopAllAction();
        mixer.uncacheRoot(gltf.scene);
        disposeObject(gltf.scene);
        if (activeByChannel.get(runtimeChannel) === instance) activeByChannel.delete(runtimeChannel);
      }
    });
    activeByChannel.set(runtimeChannel, instance);
    return instance;
  }

  return Object.freeze({
    assetId: checked.assetId,
    listSystems: () => freeze(checked.systems.map((system) => system.systemId)),
    load,
    getActive(channel = "transient") {
      return activeByChannel.get(checkedChannel(channel)) ?? null;
    },
    listActive() {
      return freeze([...activeByChannel.entries()].map(([channel, instance]) => ({
        channel,
        systemId: instance.systemId
      })));
    },
    async unload(channel = "transient") {
      const runtimeChannel = checkedChannel(channel);
      generationByChannel.set(runtimeChannel, (generationByChannel.get(runtimeChannel) ?? 0) + 1);
      await activeByChannel.get(runtimeChannel)?.dispose();
      activeByChannel.delete(runtimeChannel);
    },
    async unloadAll() {
      for (const channel of generationByChannel.keys()) {
        generationByChannel.set(channel, (generationByChannel.get(channel) ?? 0) + 1);
      }
      await Promise.all([...activeByChannel.values()].map((instance) => instance.dispose()));
      activeByChannel.clear();
    }
  });
}
