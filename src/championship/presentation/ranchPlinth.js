// Owner 2026-10-27 diorama look: the hex land stands on a procedural plinth.
// Authored cage GLBs are never edited. The plinth hangs below the walk plane
// (y <= 0), so it changes no walk surface, collision or picking:
// - rim: a lit chamfer on every outer edge of the land;
// - chassis: a bevelled wall under it, deep for cages, thin for the
//   placeholder (lid) tiles;
// - one soft drop shadow under the land;
// - on shared edges (2026-10-27): a glowing threshold where the walk rule
//   opened a passage, a low rim where it did not (different ecology, height,
//   or no safe exit), so what you see is what partners can cross.
// Edges two cells share are inside the land and get nothing, so same-type
// merged edges stay open and a different-type border keeps the cage's own art.
import * as THREE from '../../../node_modules/three/build/three.module.js';
import { ranchNativeToWorld } from './ranchThreeCoordinates.js';
import { ranchSlotPolygon } from '../cage/ranchConnections.js';
import { productPlacementCells } from '../cage/productRanchGrid.js';

export const RANCH_PLINTH = Object.freeze({
  bevel: .16, depth: .95, lidDepth: .42, thresholdWidth: .62, thresholdGuard: .14, ridgeHeight: .05, ridgeWidth: .09, shadowDrop: .2, shadowBlur: 1.1, shadowOpacity: .5,
  colors: Object.freeze({ rim: 0x6c7bb0, rimDim: 0x46527c, lit: 0x2e3652, base: 0x1c2033, shadow: 0x090b18, threshold: 0x7ff9e0 })
});

const key = (p) => `${p[0]},${p[1]}`;
const isLid = (p) => p.structuralRole === 'LID' || p.fieldId === 'field_cm29_01';

/** The land's cells and its outer edges, in native px. */
export function ranchPlinthOutline(placements) {
  const edges = new Map(), cells = [];
  for (const p of placements) {
    if (p.fragmentOfSlot !== undefined || p.foldCap) continue;
    for (const slot of productPlacementCells(p) ?? []) {
      const polygon = ranchSlotPolygon(slot), lid = isLid(p);
      const centre = [polygon.reduce((s, q) => s + q[0], 0) / 6, polygon.reduce((s, q) => s + q[1], 0) / 6];
      cells.push({ polygon, lid });
      for (let i = 0; i < 6; i++) {
        const a = polygon[i], b = polygon[(i + 1) % 6], k = [key(a), key(b)].sort().join('|');
        const seen = edges.get(k);
        if (seen) seen.count++;
        else edges.set(k, { a, b, centre, lid, count: 1 });
      }
    }
  }
  return { cells, edges: [...edges.values()].filter((e) => e.count === 1) };
}

const world = (p) => { const w = ranchNativeToWorld(p[0], p[1]); return new THREE.Vector3(w.x, 0, w.z); };

/** `towardSun`: world vector from the ground toward the sun. */
export function createRanchPlinth({ placements, towardSun, passages = { open: [], closed: [] } }) {
  const { cells, edges } = ranchPlinthOutline(placements);
  const group = new THREE.Group();
  group.name = 'ranch-plinth';
  if (!edges.length) return { group, edges: 0, cells: 0, thresholds: 0, dispose() {} };
  const { bevel, depth, lidDepth, colors } = RANCH_PLINTH;
  const sun = new THREE.Vector3(...towardSun).normalize(), sunFlat = new THREE.Vector3(sun.x, 0, sun.z).normalize();
  const color = (hex) => new THREE.Color().setHex(hex);
  const rim = color(colors.rim), rimDim = color(colors.rimDim), lit = color(colors.lit), base = color(colors.base);
  const positions = [], vertexColors = [];
  const push = (v, c) => { positions.push(v.x, v.y, v.z); vertexColors.push(c.r, c.g, c.b); };
  const quad = (a, b, c, d, ca, cb, cc, cd) => { push(a, ca); push(b, cb); push(c, cc); push(a, ca); push(c, cc); push(d, cd); };
  const shade = (out) => {
    const light = out ? Math.max(0, out.dot(sunFlat)) : .5;
    return { top: base.clone().lerp(lit, .45 + .55 * light), rim: rimDim.clone().lerp(rim, .35 + .65 * light) };
  };
  const ends = new Map();
  for (const e of edges) {
    const a = world(e.a), b = world(e.b), along = b.clone().sub(a).normalize();
    const out = new THREE.Vector3(along.z, 0, -along.x);
    if (world(e.centre).sub(a.clone().add(b).multiplyScalar(.5)).dot(out) > 0) out.negate();
    e.world = { a, b, out };
    for (const p of [e.a, e.b]) ends.set(key(p), [...(ends.get(key(p)) ?? []), e]);
    const d = e.lid ? lidDepth : depth, tone = shade(out);
    const a1 = a.clone().addScaledVector(out, bevel).setY(-bevel), b1 = b.clone().addScaledVector(out, bevel).setY(-bevel);
    quad(a, b, b1, a1, tone.rim, tone.rim, tone.top, tone.top);
    quad(a1, b1, b1.clone().setY(-d), a1.clone().setY(-d), tone.top, tone.top, base, base);
  }
  // Close the wedge between two outer edges' bevels at each outer vertex.
  for (const [k, list] of ends) {
    if (list.length !== 2) continue;
    const [e, f] = list, v = world(k.split(',').map(Number)), d = e.lid && f.lid ? lidDepth : depth;
    const out = e.world.out.clone().add(f.world.out).normalize(), tone = shade(out);
    const oe = v.clone().addScaledVector(e.world.out, bevel).setY(-bevel), of = v.clone().addScaledVector(f.world.out, bevel).setY(-bevel);
    push(v, tone.rim); push(oe, tone.top); push(of, tone.top);
    quad(oe, of, of.clone().setY(-d), oe.clone().setY(-d), tone.top, tone.top, base, base);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ranch-plinth-chassis';
  group.add(mesh);
  const shadow = createDropShadow(cells, edges, sun);
  if (shadow) group.add(shadow.mesh);
  const seams = createSeams(passages, { rim, lit, base });
  if (seams) group.add(...seams.meshes);
  return {
    group, edges: edges.length, cells: cells.length, thresholds: passages.open.length, rims: passages.closed.length,
    dispose() { geometry.dispose(); material.dispose(); shadow?.dispose(); seams?.dispose(); }
  };
}

function createSeams({ open = [], closed = [] }, { rim, lit, base }) {
  if (!open.length && !closed.length) return null;
  const { thresholdWidth, thresholdGuard, ridgeHeight, ridgeWidth, colors } = RANCH_PLINTH;
  const frame = (e) => {
    const a = world(e.a), b = world(e.b), along = b.clone().sub(a), length = along.length();
    along.normalize();
    return { a, b, along, across: new THREE.Vector3(along.z, 0, -along.x), length };
  };
  const meshes = [], disposables = [];
  if (open.length) {
    // A flat glow across each open edge, kept off the corner tips like the seam itself.
    const positions = [];
    for (const e of open) {
      const { a, along, across, length } = frame(e), guard = Math.min(thresholdGuard * length, length / 3);
      const p0 = a.clone().addScaledVector(along, guard), p1 = a.clone().addScaledVector(along, length - guard);
      const corners = [p0.clone().addScaledVector(across, thresholdWidth / 2), p1.clone().addScaledVector(across, thresholdWidth / 2),
        p1.clone().addScaledVector(across, -thresholdWidth / 2), p0.clone().addScaledVector(across, -thresholdWidth / 2)].map((v) => v.setY(.02));
      for (const i of [0, 1, 2, 0, 2, 3]) positions.push(corners[i].x, corners[i].y, corners[i].z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.MeshBasicMaterial({ color: colors.threshold, transparent: true, opacity: .3, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'ranch-passage-thresholds';
    meshes.push(mesh); disposables.push(geometry, material);
  }
  if (closed.length) {
    // A low ridge along each closed shared edge: lit top, darker sides.
    const positions = [], colorsOut = [];
    const push = (v, c) => { positions.push(v.x, v.y, v.z); colorsOut.push(c.r, c.g, c.b); };
    const quad = (q, c) => { for (const i of [0, 1, 2, 0, 2, 3]) push(q[i], c); };
    for (const e of closed) {
      const { a, b, across } = frame(e), h = ridgeHeight, w = ridgeWidth / 2;
      const a0 = a.clone().addScaledVector(across, w), a1 = a.clone().addScaledVector(across, -w);
      const b0 = b.clone().addScaledVector(across, w), b1 = b.clone().addScaledVector(across, -w);
      const up = (v) => v.clone().setY(h);
      quad([up(a0), up(b0), up(b1), up(a1)], rim);
      quad([a0, b0, up(b0), up(a0)], lit);
      quad([a1, b1, up(b1), up(a1)], base);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsOut, 3));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'ranch-closed-rims';
    meshes.push(mesh); disposables.push(geometry, material);
  }
  return { meshes, dispose() { for (const d of disposables) d.dispose(); } };
}

function createDropShadow(cells, edges, sun) {
  const { depth, shadowDrop, shadowBlur, shadowOpacity, colors } = RANCH_PLINTH;
  const canvas = globalThis.document?.createElement('canvas'), ctx = canvas?.getContext('2d');
  if (!ctx) return null;
  // Light falls along -sun: the land's footprint lands this far across.
  const drop = depth + shadowDrop, shift = new THREE.Vector3(-sun.x, 0, -sun.z).multiplyScalar(drop / Math.max(.2, sun.y));
  const points = edges.flatMap((e) => [e.world.a, e.world.b]), pad = 3 * shadowBlur;
  const minX = Math.min(...points.map((p) => p.x)) + Math.min(0, shift.x) - pad, maxX = Math.max(...points.map((p) => p.x)) + Math.max(0, shift.x) + pad;
  const minZ = Math.min(...points.map((p) => p.z)) + Math.min(0, shift.z) - pad, maxZ = Math.max(...points.map((p) => p.z)) + Math.max(0, shift.z) + pad;
  const size = 1024, sx = size / (maxX - minX), sz = size / (maxZ - minZ);
  canvas.width = canvas.height = size;
  // Draw the footprint off canvas and keep only its blurred canvas shadow:
  // shadowBlur works everywhere a 2D canvas does.
  const blur = Math.round(shadowBlur * Math.min(sx, sz)), away = size * 2;
  ctx.shadowColor = '#fff'; ctx.shadowBlur = blur; ctx.shadowOffsetX = away;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const { polygon } of cells) polygon.forEach((p, i) => {
    const w = world(p).add(shift), x = (w.x - minX) * sx - away, z = (w.z - minZ) * sz;
    if (i) ctx.lineTo(x, z); else ctx.moveTo(x, z);
    if (i === 5) ctx.closePath();
  });
  ctx.fill('nonzero');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  const material = new THREE.MeshBasicMaterial({ color: colors.shadow, alphaMap: texture, transparent: true, opacity: shadowOpacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  // Explicit corners: canvas column/row (u, v) = world (x, z) from the minimum.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([minX, 0, minZ, maxX, 0, minZ, maxX, 0, maxZ, minX, 0, maxZ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ranch-plinth-drop-shadow';
  mesh.position.set(0, -drop, 0);
  mesh.renderOrder = -1;
  return { mesh, dispose() { texture.dispose(); geometry.dispose(); material.dispose(); } };
}
