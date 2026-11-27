// Ranch HD-2D actor lighting (inspired by Hunt's actorLight.mjs).
//
// Ranch cages and 3D auto-care robots are lit by the scene's warm sun + cool
// sky hemisphere light and themed HD-2D ground shaders, whereas 2D partner quads
// previously drew raw unlit sRGB pixels (`MeshBasicMaterial`, `toneMapped: false`)
// which made them read like flat stickers pasted onto the 3D floor.
//
// This module chains a lightweight shader hook onto each partner sprite material:
//   1. Scene light harmony: gently blends the ranch's warm sun + cool fill so
//      sprites sit inside the same lighting range as the 3D floor and cleaner bots.
//   2. Per-cage biome ground bounce: reflects subtle floor colour onto the lower
//      third of the sprite (molten orange on volcano, icy blue on snow, aqua on
//      beach/hot-spring, soft grass green on meadows, clinical cyan in labs/clinics),
//      smoothly interpolated as a partner crosses passages between cages.
//   3. Pixel-crisp sun rim light: illuminates the texel just inside the sun-facing
//      outline using the sprite's own packed-atlas UV bounds (zero atlas bleed).
//
// Presentation only: native position, frame, depth envelope and save state are untouched.

import { cageHd2dThemes } from './cageHd2dEnhancer.js';

export const RANCH_ACTOR_LIGHT_DEFAULTS = Object.freeze({
  light: Object.freeze([0.97, 0.95, 0.92]),
  ground: Object.freeze([0.78, 0.80, 0.76]),
  groundStrength: 0.16,
  bounceHeight: 0.34,
  rim: Object.freeze([1.0, 0.91, 0.74]),
  rimStrength: 0.24
});

export const RANCH_BIOME_LIGHT_PRESETS = Object.freeze({
  lava: Object.freeze({
    light: Object.freeze([1.01, 0.93, 0.85]),
    ground: Object.freeze([1.0, 0.52, 0.24]),
    groundStrength: 0.28,
    bounceHeight: 0.38,
    rim: Object.freeze([1.0, 0.84, 0.56]),
    rimStrength: 0.28
  }),
  snow: Object.freeze({
    light: Object.freeze([0.94, 0.97, 1.02]),
    ground: Object.freeze([0.72, 0.88, 1.0]),
    groundStrength: 0.22,
    bounceHeight: 0.34,
    rim: Object.freeze([0.92, 0.96, 1.0]),
    rimStrength: 0.26
  }),
  water: Object.freeze({
    light: Object.freeze([0.96, 0.97, 0.96]),
    ground: Object.freeze([0.48, 0.82, 0.96]),
    groundStrength: 0.22,
    bounceHeight: 0.35,
    rim: Object.freeze([1.0, 0.94, 0.80]),
    rimStrength: 0.26
  }),
  neon: Object.freeze({
    light: Object.freeze([0.94, 0.96, 0.99]),
    ground: Object.freeze([0.62, 0.90, 0.96]),
    groundStrength: 0.20,
    bounceHeight: 0.34,
    rim: Object.freeze([0.88, 0.96, 1.0]),
    rimStrength: 0.24
  }),
  crystal: Object.freeze({
    light: Object.freeze([0.93, 0.94, 1.0]),
    ground: Object.freeze([0.62, 0.74, 1.0]),
    groundStrength: 0.24,
    bounceHeight: 0.36,
    rim: Object.freeze([0.88, 0.92, 1.0]),
    rimStrength: 0.26
  }),
  fog: Object.freeze({
    light: Object.freeze([0.88, 0.87, 0.94]),
    ground: Object.freeze([0.52, 0.44, 0.72]),
    groundStrength: 0.24,
    bounceHeight: 0.38,
    rim: Object.freeze([0.86, 0.84, 0.98]),
    rimStrength: 0.22
  }),
  foliage: Object.freeze({
    light: Object.freeze([0.98, 0.96, 0.91]),
    ground: Object.freeze([0.66, 0.86, 0.56]),
    groundStrength: 0.19,
    bounceHeight: 0.34,
    rim: Object.freeze([1.0, 0.92, 0.74]),
    rimStrength: 0.24
  }),
  sports: Object.freeze({
    light: Object.freeze([0.99, 0.97, 0.93]),
    ground: Object.freeze([0.86, 0.82, 0.72]),
    groundStrength: 0.16,
    bounceHeight: 0.32,
    rim: Object.freeze([1.0, 0.93, 0.78]),
    rimStrength: 0.25
  }),
  spotlight: Object.freeze({
    light: Object.freeze([1.02, 0.98, 0.92]),
    ground: Object.freeze([0.94, 0.86, 0.68]),
    groundStrength: 0.20,
    bounceHeight: 0.34,
    rim: Object.freeze([1.0, 0.95, 0.80]),
    rimStrength: 0.30
  })
});

const THEME_PRIORITY = Object.freeze(['lava', 'snow', 'water', 'fog', 'crystal', 'neon', 'spotlight', 'foliage', 'sports']);

/** Resolve the HD-2D biome lighting preset for a cage definition index. */
export function ranchActorLightPreset(definitionIndex) {
  const themes = Number.isInteger(definitionIndex) ? cageHd2dThemes(definitionIndex) : [];
  for (const key of THEME_PRIORITY) {
    if (themes.includes(key)) return RANCH_BIOME_LIGHT_PRESETS[key];
  }
  return RANCH_ACTOR_LIGHT_DEFAULTS;
}

/** Compute packed-atlas UV bounds `[uMin, vMin, uMax, vMax]` from a Pixi UV quad. */
export function ranchFrameUvBounds(u) {
  if (!u) return [0, 0, 1, 1];
  const uMin = Math.min(u.x0, u.x1, u.x2, u.x3);
  const uMax = Math.max(u.x0, u.x1, u.x2, u.x3);
  const vMin = Math.min(u.y0, u.y1, u.y2, u.y3);
  const vMax = Math.max(u.y0, u.y1, u.y2, u.y3);
  return [uMin, vMin, uMax, vMax];
}

/** Screen-space (u right, v up) direction toward the ranch directional sun. */
export function ranchRimDirection(camera, sunPosition, target = { x: 0, y: 0, z: 0 }) {
  const e = camera?.matrixWorld?.elements;
  if (!e) return [-0.7071, 0.7071];
  const right = [e[0], e[1], e[2]];
  const up = [e[4], e[5], e[6]];
  const dx = (sunPosition?.x ?? 0) - (target?.x ?? 0);
  const dy = (sunPosition?.y ?? 1) - (target?.y ?? 0);
  const dz = (sunPosition?.z ?? 0) - (target?.z ?? 0);
  const x = dx * right[0] + dy * right[1] + dz * right[2];
  const y = dx * up[0] + dy * up[1] + dz * up[2];
  const len = Math.hypot(x, y);
  return len > 1e-6 ? [x / len, y / len] : [-0.7071, 0.7071];
}

/** Allocate per-actor uniform state shared by both lower and upper sprite halves. */
export function createRanchActorLightState(THREE) {
  const d = RANCH_ACTOR_LIGHT_DEFAULTS;
  return {
    initialized: false,
    uRanchActorLight: { value: new THREE.Vector3(...d.light) },
    uRanchActorGround: { value: new THREE.Vector3(...d.ground) },
    uRanchActorGroundStrength: { value: d.groundStrength },
    uRanchActorBounceHeight: { value: d.bounceHeight },
    uRanchActorRim: { value: new THREE.Vector3(...d.rim) },
    uRanchActorRimStrength: { value: d.rimStrength },
    uRanchFrameUvBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRanchFlipSign: { value: 1 }
  };
}

/** Smoothly advance a partner's light uniforms toward the cage biome beneath its feet. */
export function updateRanchActorLightState(state, { definitionIndex = null, uvs = null, flip = false, blend = 1 } = {}) {
  if (!state) return;
  const preset = ranchActorLightPreset(definitionIndex);
  const alpha = !state.initialized || !(blend > 0 && blend < 1) ? 1 : blend;
  state.initialized = true;

  const lerp3 = (vec, target) => {
    vec.x += (target[0] - vec.x) * alpha;
    vec.y += (target[1] - vec.y) * alpha;
    vec.z += (target[2] - vec.z) * alpha;
  };
  lerp3(state.uRanchActorLight.value, preset.light);
  lerp3(state.uRanchActorGround.value, preset.ground);
  lerp3(state.uRanchActorRim.value, preset.rim);
  state.uRanchActorGroundStrength.value += (preset.groundStrength - state.uRanchActorGroundStrength.value) * alpha;
  state.uRanchActorBounceHeight.value += (preset.bounceHeight - state.uRanchActorBounceHeight.value) * alpha;
  state.uRanchActorRimStrength.value += (preset.rimStrength - state.uRanchActorRimStrength.value) * alpha;
  state.uRanchFlipSign.value = flip ? -1 : 1;
  if (uvs) {
    const [uMin, vMin, uMax, vMax] = ranchFrameUvBounds(uvs);
    state.uRanchFrameUvBounds.value.set(uMin, vMin, uMax, vMax);
  }
}

/**
 * Chain HD-2D ranch lighting onto an already constructed partner material
 * (preserving any existing `depthEnvelopeMaterial` / `partitionMaterial` hooks).
 */
export function attachRanchActorLight(material, state, sharedRimDirUniform) {
  if (!material || !state || material.userData?.ranchActorLightHooked) return material;
  const previousHook = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.userData.ranchActorLightHooked = true;

  material.onBeforeCompile = function ranchActorLightHook(shader, webglRenderer) {
    if (typeof previousHook === 'function') previousHook.call(this, shader, webglRenderer);
    Object.assign(shader.uniforms, {
      uRanchActorLight: state.uRanchActorLight,
      uRanchActorGround: state.uRanchActorGround,
      uRanchActorGroundStrength: state.uRanchActorGroundStrength,
      uRanchActorBounceHeight: state.uRanchActorBounceHeight,
      uRanchActorRim: state.uRanchActorRim,
      uRanchActorRimStrength: state.uRanchActorRimStrength,
      uRanchFrameUvBounds: state.uRanchFrameUvBounds,
      uRanchFlipSign: state.uRanchFlipSign,
      uRanchRimDir: sharedRimDirUniform
    });

    shader.vertexShader = 'varying float vRanchSpriteHeight;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vRanchSpriteHeight = clamp(position.y + 0.5, 0.0, 1.0);'
    );

    const hook = '#include <map_fragment>';
    if (shader.fragmentShader.includes(hook)) {
      shader.fragmentShader = `varying float vRanchSpriteHeight;
uniform vec3 uRanchActorLight;
uniform vec3 uRanchActorGround;
uniform float uRanchActorGroundStrength;
uniform float uRanchActorBounceHeight;
uniform vec3 uRanchActorRim;
uniform float uRanchActorRimStrength;
uniform vec4 uRanchFrameUvBounds;
uniform float uRanchFlipSign;
uniform vec2 uRanchRimDir;
` + shader.fragmentShader.replace(hook, `${hook}
#ifdef USE_MAP
{
  // Ground bounce on lower body + scene light harmony (ranchActorLight.js).
  float ranchBounce = uRanchActorGroundStrength * (1.0 - smoothstep(0.0, max(0.05, uRanchActorBounceHeight), vRanchSpriteHeight));
  vec3 ranchLit = uRanchActorLight * mix(vec3(1.0), uRanchActorGround, ranchBounce);
  // Pixel-crisp sun-facing rim inside frame UV bounds (zero atlas bleed).
  vec2 ranchTexel = 1.0 / vec2(textureSize(map, 0));
  vec2 ranchStep = vec2(uRanchRimDir.x * uRanchFlipSign, -uRanchRimDir.y) * ranchTexel;
  vec2 uv1 = vMapUv + ranchStep;
  vec2 uv2 = vMapUv + ranchStep * 2.0;
  float in1 = step(uRanchFrameUvBounds.x, uv1.x) * step(uv1.x, uRanchFrameUvBounds.z)
            * step(uRanchFrameUvBounds.y, uv1.y) * step(uv1.y, uRanchFrameUvBounds.w);
  float in2 = step(uRanchFrameUvBounds.x, uv2.x) * step(uv2.x, uRanchFrameUvBounds.z)
            * step(uRanchFrameUvBounds.y, uv2.y) * step(uv2.y, uRanchFrameUvBounds.w);
  float a1 = in1 * texture2D(map, clamp(uv1, uRanchFrameUvBounds.xy, uRanchFrameUvBounds.zw)).a;
  float a2 = in2 * texture2D(map, clamp(uv2, uRanchFrameUvBounds.xy, uRanchFrameUvBounds.zw)).a;
  float ranchEdge = step(0.5, diffuseColor.a) * step(0.5, a1) * (1.0 - step(0.5, a2));
  diffuseColor.rgb = diffuseColor.rgb * ranchLit + uRanchActorRim * (uRanchActorRimStrength * ranchEdge) * diffuseColor.rgb;
}
#endif`);
    }
  };

  material.customProgramCacheKey = function ranchActorLightKey() {
    const base = typeof previousKey === 'function' ? previousKey.call(this) : '';
    return `${base}|ranch-actor-light-v1`;
  };
  material.needsUpdate = true;
  return material;
}
