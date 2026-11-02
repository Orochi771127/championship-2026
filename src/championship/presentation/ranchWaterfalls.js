// Edge falls (Owner 2026-11-02, "floating islands over a data sea"). The ranch
// floats in the cyber sky; the sea below is the background. Where a cage's own
// water, lava or sand reaches a free outer edge of the land, it pours over the
// plinth rim, down the cliff, and breaks into data pixels before it reaches the
// bottom: beach water, the volcanoes' lava, the snowfield's icy water, and a few
// thin trickles of desert sand. Presentation only: below the walk plane, no picking.
//
// One merged mesh and one shader for every fall on the ranch; no texture.
// Reduced motion holds the time at 0 (the falls stay visible, still).
import * as THREE from '../../../node_modules/three/build/three.module.js';

export const RANCH_WATERFALL = Object.freeze({ fall: 1.6, lip: .03, inset: .05, minLength: .35, tolerance: .22 });
export const RANCH_FALL_KINDS = Object.freeze({ water: 0, lava: 1, icewater: 2, sand: 3 });

// Where the lava, icy water and sand of cages without a water ground map reach
// their outer edges, in each GLB's model space (x, z). Measured on the published
// GLB by sampling its base colour 15 cm inside every outer edge (cage_falls.py,
// archived with the beach coast scripts); valid only for that exact GLB, so a
// changed model pours nothing until it is measured again.
export const RANCH_CAGE_FALLS = Object.freeze({
  field_cm07_01: Object.freeze({ sha256: 'f8a4b2162f755031102afeed2b07631cd89379fa4e4796fb6dbd247e5be75cf5', kind: 'lava', edges: Object.freeze([
    [5.234, -2.817, 5.589, -2.897], [16.235, 3.507, 15.459, 6.974], [15.459, 6.974, 11.992, 7.749], [11.992, 7.749, 10.055, 5.812],
    [18.54, -2.673, 19.195, -2.018], [19.309, -1.904, 20.477, -.736], [20.477, -.736, 19.702, 2.731], [19.702, 2.731, 16.235, 3.507]]) }),
  field_cm35_01: Object.freeze({ sha256: '7cd17f6d747ec04ca1e10493e83054e5057e81a5b1bbd879763c138c7a01919e', kind: 'lava', edges: Object.freeze([
    [2.476, -2.201, 5.116, -2.791], [6.272, -2.213, 7.155, -1.33], [7.383, -1.102, 7.953, -.532], [8.295, -.19, 9.178, .693],
    [9.178, .693, 8.711, 2.781], [8.597, 3.293, 8.403, 4.16], [8.403, 4.16, 5.369, 4.838], [4.935, 4.935, 4.309, 4.309],
    [3.91, 3.91, 3.027, 3.027], [2.884, 2.884, 1.859, 1.859]]) }),
  field_cm21_01: Object.freeze({ sha256: 'c79442b292edd0905d9fb11ea7a4c5bce2ba880e752f27f020c4ad95a1be07f4', kind: 'icewater', edges: Object.freeze([
    [14.113, 5.628, 13.338, 9.095], [13.338, 9.095, 9.871, 9.871], [9.871, 9.871, 8.532, 8.532],
    [17.017, .047, 18.356, 1.385], [18.356, 1.385, 17.581, 4.853], [17.581, 4.853, 14.113, 5.628]]) }),
  field_cm20_01: Object.freeze({ sha256: '42075662dc2fd0e14d9d8c0e66715f7b398c22c4d89c0dc39928f9861039af11', kind: 'sand', edges: Object.freeze([
    [1.346, 1.346, 2.121, -2.121], [2.121, -2.121, 5.589, -2.897], [9.178, .693, 8.403, 4.16], [8.403, 4.16, 4.935, 4.935],
    [4.935, 4.935, 1.346, 1.346], [5.589, -2.897, 6.364, -6.364], [6.364, -6.364, 9.831, -7.139], [9.831, -7.139, 10.8, -6.171],
    [11.056, -5.914, 13.421, -3.55], [12.645, -.083, 9.178, .693], [13.421, -3.55, 16.888, -4.325], [16.888, -4.325, 20.477, -.736],
    [20.477, -.736, 19.702, 2.731], [19.702, 2.731, 16.235, 3.507], [16.235, 3.507, 12.645, -.083]]) })
});

/** Measured falls of a cage model: [{kind, edge: [x0, z0, x1, z1]}], or none for another GLB. */
export function ranchCageFalls(fieldId, sha256) {
  const entry = RANCH_CAGE_FALLS[fieldId];
  if (!entry || entry.sha256 !== sha256) return [];
  return entry.edges.map((edge) => ({ kind: entry.kind, edge }));
}

/**
 * Parts of the land's free outer edges that a cage's water, lava or sand reaches.
 * `outerEdges`: [{a, b, out, depth}] world vectors (y ignored); `water`: [{a, b, kind}]
 * world (kind defaults to water). A segment counts where it runs along an outer edge
 * within `tolerance`; segments of one kind merge. `facing` (world, toward the fixed
 * camera) drops edges that face away: their falls can never be seen, only their
 * lips would peek over the far rim.
 */
export function ranchWaterfallSpans(outerEdges, water, { tolerance = RANCH_WATERFALL.tolerance, minLength = RANCH_WATERFALL.minLength, facing = null } = {}) {
  const spans = [];
  const fl = facing ? Math.hypot(facing.x, facing.z) : 0;
  for (const edge of outerEdges) {
    if (fl > 0 && (edge.out.x * facing.x + edge.out.z * facing.z) / fl < -.25) continue;
    const ax = edge.a.x, az = edge.a.z, dx = edge.b.x - ax, dz = edge.b.z - az;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const ux = dx / length, uz = dz / length;
    const along = (p) => (p.x - ax) * ux + (p.z - az) * uz;
    const across = (p) => Math.abs((p.x - ax) * -uz + (p.z - az) * ux);
    const parts = new Map();
    for (const w of water) {
      const wx = w.b.x - w.a.x, wz = w.b.z - w.a.z, wl = Math.hypot(wx, wz);
      if (wl < 1e-6 || Math.abs((wx * ux + wz * uz) / wl) < .98) continue;      // not parallel
      if (across(w.a) > tolerance || across(w.b) > tolerance) continue;        // not on this edge
      const t0 = Math.max(0, Math.min(along(w.a), along(w.b))), t1 = Math.min(length, Math.max(along(w.a), along(w.b)));
      const kind = w.kind ?? 'water';
      if (t1 - t0 > 1e-3) parts.set(kind, [...(parts.get(kind) ?? []), [t0, t1]]);
    }
    for (const [kind, list] of parts) {
      list.sort((p, q) => p[0] - q[0]);
      const merged = [];
      for (const p of list) {
        const last = merged[merged.length - 1];
        if (last && p[0] <= last[1] + .08) last[1] = Math.max(last[1], p[1]);
        else merged.push(p.slice());
      }
      for (const [t0, t1] of merged) {
        if (t1 - t0 < minLength) continue;
        spans.push({
          a: new THREE.Vector3(ax + ux * t0, 0, az + uz * t0),
          b: new THREE.Vector3(ax + ux * t1, 0, az + uz * t1),
          out: edge.out.clone(), depth: edge.depth, kind
        });
      }
    }
  }
  return spans;
}

const VERTEX = `
attribute vec4 fall;     // x: metres along the edge, y: 0 at the lip -> 1 at the end of the fall,
varying vec4 vFall;      // z: 0 at a free end of the span -> 1 inside, w: kind
void main() {
  vFall = fall;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// One program for every kind; the kind is constant along a span, so the
// palette mixes below are coherent and cost a few ALU ops.
const FRAGMENT = `
uniform float uTime;
uniform float uCliff;    // fraction of the profile where the cliff ends and free fall starts
varying vec4 vFall;
float wfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float y = vFall.y, x = vFall.x, t = uTime, kind = vFall.w;
  float lava = step(0.5, kind) * step(kind, 1.5);
  float ice = step(1.5, kind) * step(kind, 2.5);
  float sand = step(2.5, kind);
  // Lava is slow and thick; sand runs fast.
  float speed = mix(1.0, 0.35, lava) * mix(1.0, 1.6, sand);
  // Streaks: columns of varying speed scroll down the profile.
  float column = floor(x * 9.0);
  float streak = fract(y * 3.0 - t * speed * (0.55 + 0.45 * wfHash(vec2(column, 3.1))) + wfHash(vec2(column, 7.7)));
  float lines = smoothstep(0.55, 0.95, streak) * (0.5 + 0.5 * wfHash(vec2(column, 1.3)));
  // Linear colours (the output is converted to sRGB): each kind matches its own ground.
  vec3 top = vec3(0.08, 0.5, 0.6), low = vec3(0.04, 0.3, 0.55), crest = vec3(0.92, 0.97, 1.0), pixel = vec3(0.45, 0.95, 1.0);
  top = mix(top, vec3(1.0, 0.16, 0.014), lava); low = mix(low, vec3(0.5, 0.022, 0.003), lava);
  crest = mix(crest, vec3(1.0, 0.58, 0.1), lava); pixel = mix(pixel, vec3(1.0, 0.26, 0.02), lava);
  top = mix(top, vec3(0.28, 0.62, 0.85), ice); low = mix(low, vec3(0.1, 0.38, 0.7), ice); pixel = mix(pixel, vec3(0.8, 0.97, 1.0), ice);
  top = mix(top, vec3(0.78, 0.52, 0.2), sand); low = mix(low, vec3(0.6, 0.38, 0.14), sand);
  crest = mix(crest, vec3(0.95, 0.75, 0.4), sand); pixel = mix(pixel, vec3(0.95, 0.7, 0.3), sand);
  vec3 colour = mix(mix(top, low, smoothstep(0.0, uCliff, y)), crest, max(lines * mix(0.55, 0.4, lava), smoothstep(0.06, 0.0, y)));
  float alpha = mix(0.92, 0.97, lava) * vFall.z;
  // Sand never pours as a sheet: a few thin streams, one in about two 1.4 m cells,
  // that widen a little and break into grains as they fall.
  float cell = floor(x / 1.4);
  float centre = (cell + 0.2 + 0.6 * wfHash(vec2(cell, 9.1))) * 1.4 + 0.02 * sin(y * 9.0 + t * 1.3 + cell);
  float width = 0.045 + 0.025 * wfHash(vec2(cell, 2.7)) + 0.05 * y;
  float stream = step(0.5, wfHash(vec2(cell, 5.3))) * (1.0 - smoothstep(width * 0.5, width, abs(x - centre)));
  float grain = step(0.45, wfHash(floor(vec2(x * 70.0, y * 110.0 - t * 5.0))));
  alpha *= mix(1.0, stream * mix(1.0, grain, smoothstep(0.1, 0.5, y)), sand);
  // Below the cliff the fall breaks into data pixels that thin out and glow.
  float free = smoothstep(uCliff - 0.04, 1.0, y);
  vec2 bit = floor(vec2(x * 14.0, y * 26.0 - t * 2.2 * speed));
  float keep = step(free * 1.15, wfHash(bit));
  float glow = free * (0.6 + 0.4 * sin(t * 3.0 + wfHash(bit) * 6.2831));
  colour = mix(colour, pixel, glow * 0.6);
  alpha *= mix(1.0, keep, smoothstep(uCliff, uCliff + 0.1, y)) * (1.0 - smoothstep(0.82, 1.0, y));
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(colour, alpha);
  #include <colorspace_fragment>
}`;

/**
 * Fall mesh for `spans` (ranchWaterfallSpans). Each span pours over the plinth's
 * rim chamfer (`bevel`), down the cliff face and then falls free by
 * RANCH_WATERFALL.fall.
 */
export function createRanchWaterfalls(spans, { bevel }) {
  if (!spans.length) return null;
  const { fall, lip, inset } = RANCH_WATERFALL;
  const positions = [], falls = [], index = [];
  let cliffShare = .5;
  // Where two falls of one kind meet at an outer corner they run on past it and
  // overlap, so the corner is closed; only a free end fades out.
  const joined = (p, self) => spans.some((o) => o !== self && o.kind === self.kind && (o.a.distanceTo(p) < .05 || o.b.distanceTo(p) < .05));
  const reach = bevel + .16;
  for (const span of spans) {
    const depth = span.depth;
    const kind = RANCH_FALL_KINDS[span.kind] ?? RANCH_FALL_KINDS.water;
    const dir = span.b.clone().sub(span.a).normalize();
    const joinA = joined(span.a, span), joinB = joined(span.b, span);
    const a = joinA ? span.a.clone().addScaledVector(dir, -reach) : span.a;
    const b = joinB ? span.b.clone().addScaledVector(dir, reach) : span.b;
    const length = a.distanceTo(b);
    // Column stops: the run-on past a corner gets its own column so only the cliff runs on.
    const from = joinA ? reach / length : 0, to = joinB ? 1 - reach / length : 1;
    const inner = Math.max(2, Math.ceil((to - from) * length / .5));
    const stops = [...(joinA ? [0] : []), ...Array.from({ length: inner + 1 }, (_, i) => from + (to - from) * i / inner), ...(joinB ? [1] : [])];
    // Profile: lip on the land edge -> over the chamfer -> down the cliff -> free fall.
    const profile = [
      { out: -inset, y: lip },
      { out: bevel + .02, y: -bevel },
      { out: bevel + .05, y: -depth },
      { out: bevel + .16, y: -depth - fall }
    ];
    const run = [0];
    for (let i = 1; i < profile.length; i++) run.push(run[i - 1] + Math.hypot(profile[i].out - profile[i - 1].out, profile[i].y - profile[i - 1].y));
    const total = run[run.length - 1];
    cliffShare = run[2] / total;
    // Each span starts its pattern somewhere of its own, so sand streams and streak
    // columns never repeat from one edge to the next.
    const offset = ((span.a.x * 12.9898 + span.a.z * 78.233) % 97 + 97) % 97;
    const base = positions.length / 3;
    for (const s of stops) {
      const p = a.clone().lerp(b, s);
      const end = Math.min(1, (joinA ? 1 : s * length / .25), (joinB ? 1 : (1 - s) * length / .25));
      const runOn = s < from - 1e-6 || s > to + 1e-6;
      for (let r = 0; r < profile.length; r++) {
        const k = runOn && r === 0 ? 1 : r;   // no lip on the run-on: it would show past the corner
        const q = p.clone().addScaledVector(span.out, profile[k].out).setY(profile[k].y);
        positions.push(q.x, q.y, q.z);
        falls.push(offset + s * length, run[k] / total, end, kind);
      }
    }
    const rows = profile.length, columns = stops.length - 1;
    for (let c = 0; c < columns; c++) for (let r = 0; r < rows - 1; r++) {
      const i = base + c * rows + r, j = i + rows;
      index.push(i, j, i + 1, i + 1, j, j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('fall', new THREE.Float32BufferAttribute(falls, 4));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCliff: { value: cliffShare } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ranch-waterfalls';
  mesh.renderOrder = 2;
  mesh.raycast = () => {};
  return {
    mesh, spans: spans.length,
    animate(seconds) { material.uniforms.uTime.value = seconds; },
    dispose() { geometry.dispose(); material.dispose(); }
  };
}

// Two beaches on one open edge: each floor stops a few centimetres short of the hex
// edge, and between the two floors lie the lower, glossier joint tiles. From the
// fixed camera that gap reads as a faint band whose waves jump. Each beach covers
// its own side of the edge with a strip at floor height in its own material: its
// ground map and world-space waves draw exactly the water (or sand) around it.
const wetUv = new WeakMap();
function wetTexel(geometry) {
  if (wetUv.has(geometry)) return wetUv.get(geometry);
  const wet = geometry.getAttribute('_coast_water'), uv = geometry.getAttribute('uv');
  let found = null;
  if (wet && uv) {
    const index = geometry.index, count = index ? index.count : uv.count;
    for (let i = 0; i + 2 < count && !found; i += 3) {
      const t = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      if (t.every((v) => wet.getX(v) >= .5)) found = [0, 1].map((c) => t.reduce((s, v) => s + (c ? uv.getY(v) : uv.getX(v)), 0) / 3);
    }
  }
  wetUv.set(geometry, found);
  return found;
}

/**
 * Seam strips on one cage's side of its joined edges, merged into one mesh (one
 * draw call per beach). `seams`: [{edge: {a, b}, inside: {x, z}}] in `object`'s
 * local space, `inside` being a point in the cage's own cell on that edge.
 * Returns a mesh to add beside the cage at its position, or null.
 */
export function createRanchWaterSeam(object, seams, { width = .1, overlap = .02, y = .004 } = {}) {
  let host = null;
  object.traverse((o) => { if (!host && o.isMesh && o.geometry?.getAttribute('_coast_water')) host = o; });
  const texel = host && wetTexel(host.geometry);
  if (!texel) return null;
  const positions = [], index = [];
  for (const { edge, inside } of seams) {
    const dx = edge.b.x - edge.a.x, dz = edge.b.z - edge.a.z, length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    let nx = -dz / length, nz = dx / length;
    if ((inside.x - edge.a.x) * nx + (inside.z - edge.a.z) * nz < 0) { nx = -nx; nz = -nz; }
    // Reaches 2 cm past the edge: the two cages' strips overlap, so no hairline shows between them.
    const base = positions.length / 3;
    for (const [x, z] of [[edge.a.x - nx * overlap, edge.a.z - nz * overlap], [edge.b.x - nx * overlap, edge.b.z - nz * overlap],
      [edge.b.x + nx * width, edge.b.z + nz * width], [edge.a.x + nx * width, edge.a.z + nz * width]]) positions.push(x, y, z);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
  }
  if (!positions.length) return null;
  const count = positions.length / 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [0, 1, 0]).flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => texel).flat(), 2));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, host.material);
  mesh.name = 'ranch-water-seam';
  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.raycast = () => {};
  return mesh;
}
