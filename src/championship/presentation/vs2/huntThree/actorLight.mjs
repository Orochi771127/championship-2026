// Hunt partners take the map's light (Owner 2026-11-25: 「角色…像是生活在地圖裡…而不是一個貼紙浮在地圖上面」).
//
// The partner quad used an unlit MeshBasicMaterial: at night or in a dark sewer the
// map dimmed and turned blue while every partner stayed at full daylight, so it read
// as a sticker on the map. This adds three things in the partner's own shader, all
// derived from the map's existing HD-2D look (hd2dLook.mjs), so no new art:
//   1. light: brightness and colour from the look's key, fill and sky light, measured
//      against the default day look (a day map stays at about 1.0);
//   2. ground bounce: the lowest part of the drawing takes a little of the ground
//      colour (lava maps glow from below), the top stays clean;
//   3. rim: the texel just inside the outline, on the side facing the sun, takes the
//      key light colour, pixel-crisp like the drawing itself.
// Presentation only: native position, frame, opacity and tint are unchanged.

const REF = Object.freeze({ key: 1.9, hemi: 0.8, fill: 0.45 });
const W = Object.freeze({ key: 0.4, hemi: 0.6, fill: 0.2 });

// Per-map ground glow under partners where the ground itself emits light.
export const HUNT_ACTOR_BOUNCE = Object.freeze({
  hm15: Object.freeze({ color: 0xff7a3a, day: 0.3, night: 0.42 })
});

export const HUNT_ACTOR_LIGHT = Object.freeze({
  minBrightness: 0.5, maxBrightness: 1.06,
  keyTint: 0.3, skyTint: 0.12,
  bounceStrength: 0.2, bounceHeight: 0.34,
  rimDay: 0.32, rimNight: 0.5
});

const rgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const normalize = c => { const m = Math.max(...c, 1e-6); return c.map(v => v / m); };

/** Light values for one map/field from its HD-2D look. */
export function huntActorLight(look, { mapKey = null, night = false } = {}) {
  if (!look?.key) return null;
  const [keyHex, keyI] = look.key, [fillHex, fillI] = look.fill ?? [0xffffff, 0];
  const energy = (look.hemi * W.hemi + keyI * W.key + fillI * W.fill) / (REF.hemi * W.hemi + REF.key * W.key + REF.fill * W.fill);
  const brightness = clamp(energy, HUNT_ACTOR_LIGHT.minBrightness, HUNT_ACTOR_LIGHT.maxBrightness);
  const hue = normalize(mix(mix([1, 1, 1], rgb(keyHex), HUNT_ACTOR_LIGHT.keyTint), rgb(look.sky ?? 0xffffff), HUNT_ACTOR_LIGHT.skyTint));
  const bounce = HUNT_ACTOR_BOUNCE[mapKey];
  const groundColor = bounce ? normalize(rgb(bounce.color)) : normalize(mix([1, 1, 1], rgb(look.ground ?? 0x808080), 0.6));
  return Object.freeze({
    color: hue.map(v => v * brightness),
    ground: groundColor,
    groundStrength: bounce ? bounce[night ? 'night' : 'day'] : HUNT_ACTOR_LIGHT.bounceStrength,
    bounceHeight: HUNT_ACTOR_LIGHT.bounceHeight,
    rim: normalize(mix(rgb(keyHex), rgb(fillHex), 0.15)),
    rimStrength: night ? HUNT_ACTOR_LIGHT.rimNight : HUNT_ACTOR_LIGHT.rimDay,
    brightness
  });
}

/** Screen direction (u right, v up) of the light, from the camera's own axes. */
export function huntRimDirection(camera, sunPosition, target = [0, 0, 0]) {
  const e = camera.matrixWorld.elements;
  const right = [e[0], e[1], e[2]], up = [e[4], e[5], e[6]];
  const d = [sunPosition[0] - target[0], sunPosition[1] - target[1], sunPosition[2] - target[2]];
  const x = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
  const y = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
  const len = Math.hypot(x, y);
  return len > 1e-6 ? [x / len, y / len] : [-0.7071, 0.7071];
}

/** Shared uniforms for every partner on one map; update rimDir in place. */
export function createHuntActorLightUniforms(THREE, light) {
  return {
    hmActorLight: { value: new THREE.Vector3(...light.color) },
    hmActorGround: { value: new THREE.Vector3(...light.ground) },
    hmActorGroundStrength: { value: light.groundStrength },
    hmActorBounceHeight: { value: light.bounceHeight },
    hmActorRim: { value: new THREE.Vector3(...light.rim) },
    hmActorRimStrength: { value: light.rimStrength },
    hmActorRimDir: { value: new THREE.Vector2(-0.7071, 0.7071) }
  };
}

/**
 * Chain the light onto a partner material after any other onBeforeCompile
 * (installFlatGroundDepthCandidate replaces it; call this after every install).
 */
export function installHuntActorLight(material, uniforms) {
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const hook = '#include <map_fragment>';
    if (!shader.fragmentShader.includes(hook)) throw new Error('HUNT_ACTOR_LIGHT_SHADER_HOOK_MISSING');
    shader.fragmentShader = `uniform vec3 hmActorLight;\nuniform vec3 hmActorGround;\nuniform float hmActorGroundStrength;\nuniform float hmActorBounceHeight;\nuniform vec3 hmActorRim;\nuniform float hmActorRimStrength;\nuniform vec2 hmActorRimDir;\n`
      + shader.fragmentShader.replace(hook, `${hook}
      #ifdef USE_MAP
      {
        // Light the drawing like the map around it (actorLight.mjs).
        float hmH = clamp(vMapUv.y, 0.0, 1.0);
        float hmBounce = hmActorGroundStrength * (1.0 - smoothstep(0.0, hmActorBounceHeight, hmH));
        vec3 hmLit = hmActorLight * mix(vec3(1.0), hmActorGround, hmBounce);
        vec2 hmTexel = 1.0 / vec2(textureSize(map, 0));
        // The drawings carry a dark outline; light the texel just inside it.
        float hmOut1 = texture2D(map, vMapUv + hmActorRimDir * hmTexel).a;
        float hmOut2 = texture2D(map, vMapUv + hmActorRimDir * hmTexel * 2.0).a;
        float hmEdge = step(0.5, diffuseColor.a) * step(0.5, hmOut1) * (1.0 - step(0.5, hmOut2));
        diffuseColor.rgb = diffuseColor.rgb * hmLit + hmActorRim * (hmActorRimStrength * hmEdge) * diffuseColor.rgb;
      }
      #endif`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey.call(material) : ''}|hunt-actor-light-v1`;
  material.needsUpdate = true;
  return material;
}
