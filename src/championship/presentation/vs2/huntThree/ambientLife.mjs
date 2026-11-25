// Hunt maps feel lived in (Owner 2026-11-25: 「角色…像是生活在地圖裡」): a light layer of
// ambient life in the map's own 3D space, so it sits in front of and behind the props
// like everything else: snow on the ice field, fireflies over grass at night, pollen by
// day, embers over lava, drifting dust in the canyon and crags.
//
// One THREE.Points draw per map with at most HUNT_AMBIENT_MAX points. Every position is
// computed on the GPU from a per-point seed and the time, wrapped into a box that
// follows the camera, so nothing is updated per point on the CPU and the count does
// not grow with the map. Pixel-square points, like the drawings. Off in saver quality
// and with reduced motion. Presentation only.

export const HUNT_AMBIENT_MAX = 160;

// Units are glTF units (one tile is 16 world px; a unit is 32 or 45 world px).
const KINDS = Object.freeze({
  snow: Object.freeze({ count: 150, color: 0xf4f8ff, size: 2, round: false, opacity: 0.9, drift: [0.35, -0.12], fall: 0.55, hMin: 0, hMax: 6, sway: 0.25, twinkle: 0, additive: false }),
  fireflies: Object.freeze({ count: 44, color: 0xd6ff74, size: 5, round: true, opacity: 1, drift: [0.04, 0.03], fall: 0, hMin: 0.25, hMax: 1.6, sway: 0.6, twinkle: 1, additive: true }),
  pollen: Object.freeze({ count: 34, color: 0xfff4c8, size: 2, round: false, opacity: 0.55, drift: [0.12, 0.05], fall: 0, hMin: 0.3, hMax: 2.2, sway: 0.35, twinkle: 0.4, additive: false }),
  dust: Object.freeze({ count: 40, color: 0xe8d0a0, size: 2, round: false, opacity: 0.45, drift: [0.55, 0.1], fall: 0, hMin: 0.1, hMax: 1.6, sway: 0.2, twinkle: 0.3, additive: false }),
  embers: Object.freeze({ count: 60, color: 0xff9a40, size: 2, round: false, opacity: 1, drift: [0.06, -0.05], fall: -0.45, hMin: 0, hMax: 4, sway: 0.3, twinkle: 0.8, additive: true }),
  motes: Object.freeze({ count: 28, color: 0xc8d8c0, size: 2, round: false, opacity: 0.35, drift: [0.05, 0.02], fall: 0.04, hMin: 0.2, hMax: 2, sway: 0.15, twinkle: 0.3, additive: false })
});

// [day, night] per map; null = nothing.
const MAP_KINDS = Object.freeze({
  hm01: ['pollen', 'fireflies'], hm02: ['pollen', 'fireflies'], hm03: ['pollen', 'fireflies'],
  hm04: ['pollen', 'fireflies'], hm05: ['pollen', 'fireflies'], hm06: ['pollen', 'fireflies'],
  hm08: ['dust', 'dust'], hm09: ['motes', 'motes'], hm10: ['motes', null], hm11: ['motes', 'motes'],
  hm13: ['snow', 'snow'], hm14: ['dust', 'dust'], hm15: ['embers', 'embers'],
  hm16: ['dust', 'dust'], hm17: ['dust', 'dust'], hm18: ['dust', 'dust']
});

/** The ambient kind for a map and field (fields ending _02 are night), or null. */
export function huntAmbientKind(mapKey, fieldId) {
  const pair = MAP_KINDS[mapKey];
  if (!pair) return null;
  const name = pair[String(fieldId).endsWith('_02') ? 1 : 0];
  return name ? Object.freeze({ name, ...KINDS[name] }) : null;
}

/** False in saver quality or with reduced motion (checked every frame, cheaply). */
export function huntAmbientAllowed(doc = globalThis.document) {
  const root = doc?.documentElement?.dataset;
  if (root?.quality === 'saver' || root?.motion === 'reduced') return false;
  return !doc?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const VERTEX = `
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform float uRadius;
uniform vec2 uDrift;
uniform float uFall;
uniform float uHMin;
uniform float uHMax;
uniform float uSway;
uniform float uSize;
uniform float uTwinkle;
varying float vAlpha;
void main() {
  float t = uTime;
  float phase = aSeed.z * 6.2831853;
  vec2 p = aSeed.xy * 2.0 * uRadius + uDrift * t;
  p += uSway * vec2(sin(t * 0.7 + phase), cos(t * 0.53 + phase * 1.3));
  // Wrap into a box that follows the camera: world-anchored, constant count.
  vec2 lo = uCenter.xz - uRadius;
  p = mod(p - lo, 2.0 * uRadius) + lo;
  float range = max(uHMax - uHMin, 0.001), h;
  if (abs(uFall) > 0.0) h = uHMin + mod(aSeed.w * range - uFall * t, range);
  else h = uHMin + range * (0.5 + 0.5 * sin(t * (0.35 + aSeed.w * 0.5) + phase));
  vec4 world = vec4(p.x, uCenter.y + h, p.y, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  // Fade near the top and bottom of a fall so points never pop.
  float edge = abs(uFall) > 0.0 ? smoothstep(0.0, 0.08, (h - uHMin) / range) * smoothstep(1.0, 0.85, (h - uHMin) / range) : 1.0;
  float blink = mix(1.0, 0.5 + 0.5 * sin(t * (1.7 + aSeed.w * 2.3) + phase * 3.0), uTwinkle);
  vAlpha = edge * clamp(blink, 0.0, 1.0);
  gl_PointSize = uSize * (aSeed.w > 0.8 ? 1.5 : 1.0);
}`;

const FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRound;
varying float vAlpha;
void main() {
  float a = 1.0;
  if (uRound > 0.5) { float d = length(gl_PointCoord - 0.5); a = 1.0 - smoothstep(0.15, 0.5, d); }
  gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  #include <colorspace_fragment>
}`;

function seeds(count, random) {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < out.length; i++) out[i] = random();
  return out;
}

/** A small deterministic random so the layer is the same on every visit. */
export function huntAmbientRandom(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/**
 * Create the ambient layer for one map. update() each frame with the camera
 * centre (ground point) and the view's half size in units.
 */
export function createHuntAmbientLife({ THREE, scene, mapKey, fieldId, groundHeight = 0, doc = globalThis.document }) {
  const kind = huntAmbientKind(mapKey, fieldId);
  if (!kind) return Object.freeze({ kind: null, update() {}, dispose() {}, diagnostics: () => ({ kind: null, visible: false, count: 0 }) });
  const count = Math.min(HUNT_AMBIENT_MAX, kind.count);
  const geometry = new THREE.BufferGeometry();
  // Positions are computed in the shader; the attribute only sizes the draw.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds(count, huntAmbientRandom(mapKey.charCodeAt(2) * 131 + mapKey.charCodeAt(3))), 4));
  const color = new THREE.Color(kind.color);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, depthTest: true,
    blending: kind.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3(0, groundHeight, 0) }, uRadius: { value: 10 },
      uDrift: { value: new THREE.Vector2(...kind.drift) }, uFall: { value: kind.fall }, uHMin: { value: kind.hMin }, uHMax: { value: kind.hMax },
      uSway: { value: kind.sway }, uSize: { value: kind.size }, uTwinkle: { value: kind.twinkle },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) }, uOpacity: { value: kind.opacity }, uRound: { value: kind.round ? 1 : 0 }
    }
  });
  const points = new THREE.Points(geometry, material);
  points.name = `hunt-ambient-${kind.name}`;
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);
  let frames = 0;
  return Object.freeze({
    kind: kind.name,
    update({ now, center, halfWidth, halfHeight, pixelRatio = 1 }) {
      const allowed = huntAmbientAllowed(doc);
      points.visible = allowed;
      if (!allowed) return;
      const u = material.uniforms;
      u.uTime.value = (now % 3_600_000) / 1000;
      u.uCenter.value.set(center[0], groundHeight, center[2]);
      // Cover the view at any azimuth: the larger half size, foreshortening allowed for.
      u.uRadius.value = Math.max(halfWidth, halfHeight * 1.8) * 1.15 + 1;
      u.uSize.value = kind.size * pixelRatio;
      frames++;
    },
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); },
    diagnostics: () => ({ kind: kind.name, visible: points.visible, count, frames })
  });
}
