// Drain outlets run (2026-11-26). The factory (hm10) and sewer (hm11) maps draw
// outflow ribbons under their drain pipes that stood still. The delivered "drain
// phase" GLBs are pixels reconstructed from reference art and stay out of the
// product; this is an original, procedural replacement: pixel-stepped streaks run
// down each ribbon, churn at the pipe mouth and foam where the water meets the floor.
//
// One mesh per map, laid a hair above the existing ribbons (measured from the GLB for
// hm10, from the map render for hm11, in world px). Off in saver quality and with
// reduced motion, like ambientLife.mjs. Presentation only.
import { huntAmbientAllowed } from './ambientLife.mjs';

// path: [screenX, screenY, height, widthPx] from the pipe mouth to the floor. map.ground()
// takes screen px (a point at height h is placed so it shows at that screen y).
const ribbon = (x, y, path) => Object.freeze(path.map(([dy, h, w]) => Object.freeze([x, y + dy, h, w])));
// hm10 ribbon vertices (GLB mesh 13): ground y 1110/1132/1162/1188/1215 at h 0.30/0.16/0.04/0.02/0.02.
const HM10 = [[0, 0.3, 14], [25.6, 0.16, 18], [58.7, 0.04, 18], [85.2, 0.02, 18], [112.2, 0.02, 18]];
const HM11 = [[0, 0.01, 18], [91, 0.01, 41]];
export const DRAIN_STREAMS = Object.freeze({
  hm10: Object.freeze([ribbon(769.5, 1102.3, HM10), ribbon(1537.5, 1102.3, HM10), ribbon(16.5, 1662.3, HM10)]),
  hm11: Object.freeze([ribbon(447.5, 96, HM11), ribbon(1471.5, 96, HM11), ribbon(959.5, 912, HM11), ribbon(1408, 1344, HM11)])
});

export const DRAIN_FLOW_STYLE = Object.freeze({
  hm10: Object.freeze({ highlight: 0xe6ec9a, foam: 0xf4f8e0, speed: 46 }),
  hm11: Object.freeze({ highlight: 0xd8e27c, foam: 0xeef4d4, speed: 38 })
});

const LIFT = 0.015;

/** Ribbon geometry arrays (position via the map projection, along/across in px). */
export function drainFlowGeometry(map, streams) {
  const position = [], along = [], across = [], length = [], index = [];
  for (const path of streams) {
    let base = position.length / 3, run = 0;
    const total = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
    path.forEach(([x, y, h, w], i) => {
      if (i) run += Math.hypot(x - path[i - 1][0], y - path[i - 1][1]);
      for (const side of [-0.5, 0.5]) {
        // A point at height h shows k*c*h px higher on screen: keep it over the drawn ribbon.
        position.push(...map.ground(x + side * w, y, h + LIFT));
        along.push(run); across.push(side + 0.5); length.push(total);
      }
      if (i) { const a = base + (i - 1) * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
  }
  return { position, along, across, length, index };
}

const VERTEX = `
attribute float aAlong;
attribute float aAcross;
attribute float aLength;
varying float vAlong;
varying float vAcross;
varying float vLength;
void main() {
  vAlong = aAlong; vAcross = aAcross; vLength = aLength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uHighlight;
uniform vec3 uFoam;
varying float vAlong;
varying float vAcross;
varying float vLength;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // Two-pixel cells, like the map's own pixels.
  float lane = floor(vAcross * 6.0);
  float cell = floor(vAlong / 2.0);
  float jitter = hash(vec2(lane, 3.0));
  float flow = fract((cell * 2.0 - uTime * uSpeed * (0.8 + 0.4 * jitter)) / 22.0 + jitter);
  float streak = step(0.74, flow) * step(0.2, hash(vec2(lane, floor((cell * 2.0 - uTime * uSpeed) / 22.0))));
  float edge = step(0.06, vAcross) * step(vAcross, 0.94);
  float tick = floor(uTime * 9.0);
  float tail = step(vLength - 12.0, vAlong);
  float head = step(vAlong, 6.0);
  float sparkle = step(0.62, hash(vec2(lane * 7.0 + cell, tick)));
  float a = streak * 0.55 * edge + (tail + head) * sparkle * 0.75 * edge;
  if (a < 0.01) discard;
  vec3 colour = mix(uHighlight, uFoam, max(tail, head));
  gl_FragColor = vec4(colour, a);
  #include <colorspace_fragment>
}`;

export function createHuntDrainFlow({ THREE, scene, map, mapKey, doc = globalThis.document }) {
  const streams = DRAIN_STREAMS[mapKey], style = DRAIN_FLOW_STYLE[mapKey];
  if (!streams || !style) return Object.freeze({ count: 0, update() {}, dispose() {}, diagnostics: () => ({ streams: 0, visible: false }) });
  const g = drainFlowGeometry(map, streams);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(g.position, 3));
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(g.along, 1));
  geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(g.across, 1));
  geometry.setAttribute('aLength', new THREE.Float32BufferAttribute(g.length, 1));
  geometry.setIndex(g.index);
  const c = (hex) => { const v = new THREE.Color(hex); return new THREE.Vector3(v.r, v.g, v.b); };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: style.speed }, uHighlight: { value: c(style.highlight) }, uFoam: { value: c(style.foam) } }
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `hunt-drain-flow-${mapKey}`;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return Object.freeze({
    count: streams.length,
    update({ now }) {
      const allowed = huntAmbientAllowed(doc);
      mesh.visible = allowed;
      if (allowed) material.uniforms.uTime.value = (now % 3_600_000) / 1000;
    },
    dispose() { scene.remove(mesh); geometry.dispose(); material.dispose(); },
    diagnostics: () => ({ streams: streams.length, visible: mesh.visible })
  });
}
