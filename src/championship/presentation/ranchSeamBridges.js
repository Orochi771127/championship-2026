// Seam bridges (Owner 2026-10-27): where two cages of one series open a
// passage, the shared edge is paved with that series' own ground, so a small
// and a large cage read as one place: a red-clay track with white lanes for
// the sports cages, a glowing lava vein for the volcanoes, sand and shallows
// for the beaches, a moss path, flagstones, gravel, snow, or an indoor
// corridor mat with a lit guide line. A bridge is a flat, feathered strip just
// above the walk plane: it changes no walk surface, support or picking, and it
// stops short of the corner tips like the passage itself.
import * as THREE from '../../../node_modules/three/build/three.module.js';
import { ranchNativeToWorld } from './ranchThreeCoordinates.js';

export const RANCH_SEAM_BRIDGE = Object.freeze({ width: 2.2, guard: .14, lift: .03 });

// base, accent, glow (null = none), pattern
const THEMES = Object.freeze({
  sports: { base: '#b9573a', accent: '#fff6ea', glow: null, pattern: 'lanes' },
  volcano: { base: '#2c2626', accent: '#ff7a2a', glow: '#ff6a1a', pattern: 'vein' },
  beach: { base: '#e6d2a0', accent: '#7fd8e0', glow: null, pattern: 'shallows' },
  forest: { base: '#4f7a34', accent: '#2f5121', glow: null, pattern: 'speckle' },
  grassland: { base: '#6caa45', accent: '#9ed36a', glow: null, pattern: 'speckle' },
  garden: { base: '#d9cfb6', accent: '#e86a8a', glow: null, pattern: 'flagstone' },
  mountain: { base: '#8f8b82', accent: '#6d6a63', glow: null, pattern: 'gravel' },
  desert: { base: '#d9b37a', accent: '#c29a5f', glow: null, pattern: 'speckle' },
  snowfield: { base: '#eaf4ff', accent: '#b8d4f0', glow: null, pattern: 'gravel' },
  gym: { base: '#d7dce4', accent: '#4deed6', glow: '#4deed6', pattern: 'corridor' },
  infirmary: { base: '#e3ecef', accent: '#3ddc84', glow: '#3ddc84', pattern: 'corridor' },
  stone: { base: '#b7b1a3', accent: '#8f897c', glow: null, pattern: 'flagstone' }
});
export function ranchSeamTheme(ecology) {
  return THEMES[ecology] ? ecology : 'stone';
}

function seeded(n) { let x = n >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** u runs along the edge (x), v across it (y); lanes and veins cross from cage to cage. */
function paint(doc, theme, glowOnly = false) {
  const canvas = doc.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const g = canvas.getContext('2d');
  const t = THEMES[theme], rnd = seeded(theme.length * 977);
  g.fillStyle = glowOnly ? '#000' : t.base; g.fillRect(0, 0, 128, 64);
  const line = (x, w, color) => { g.fillStyle = color; g.fillRect(x - w / 2, 0, w, 64); };
  if (t.pattern === 'lanes' && !glowOnly) { line(40, 3, t.accent); line(88, 3, t.accent); line(64, 1.5, 'rgba(255,246,234,0.55)'); }
  if (t.pattern === 'vein') {
    g.strokeStyle = glowOnly ? '#fff' : t.accent; g.lineWidth = glowOnly ? 9 : 7; g.beginPath();
    for (let y = 0; y <= 64; y += 8) g.lineTo(64 + Math.sin(y * 0.35) * 8, y);
    g.stroke();
    if (!glowOnly) { g.strokeStyle = '#ffd38a'; g.lineWidth = 2; g.stroke(); }
  }
  if (t.pattern === 'shallows' && !glowOnly) { g.fillStyle = t.accent; g.globalAlpha = 0.6; g.fillRect(52, 0, 24, 64); g.globalAlpha = 1; }
  if (['speckle', 'gravel'].includes(t.pattern) && !glowOnly) {
    for (let i = 0; i < 90; i++) { g.fillStyle = t.accent; g.globalAlpha = 0.35 + rnd() * 0.4; const r = t.pattern === 'gravel' ? 1.5 + rnd() * 2.5 : 1 + rnd() * 1.6; g.beginPath(); g.arc(rnd() * 128, rnd() * 64, r, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  if (t.pattern === 'flagstone' && !glowOnly) {
    g.strokeStyle = 'rgba(60,52,40,0.35)'; g.lineWidth = 1.5;
    for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < 128; x += 32) g.strokeRect(x + 1, y + 1, 30, 14);
    if (theme === 'garden') for (let i = 0; i < 18; i++) { g.fillStyle = ['#e86a8a', '#ffd23f', '#ffffff'][i % 3]; g.beginPath(); g.arc(rnd() * 128, rnd() < 0.5 ? 6 : 58, 2, 0, Math.PI * 2); g.fill(); }
  }
  if (t.pattern === 'corridor') {
    if (!glowOnly) { g.fillStyle = 'rgba(20,20,31,0.08)'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 1, 64); }
    line(64, glowOnly ? 6 : 4, glowOnly ? '#fff' : t.accent);
  }
  // Feather: soft across both banks and at both ends, so the strip melts into each cage.
  const fade = g.createLinearGradient(0, 0, 0, 64);
  fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.24, 'rgba(0,0,0,0)'); fade.addColorStop(0.76, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, 128, 64);
  const ends = g.createLinearGradient(0, 0, 128, 0);
  ends.addColorStop(0, 'rgba(0,0,0,1)'); ends.addColorStop(0.1, 'rgba(0,0,0,0)'); ends.addColorStop(0.9, 'rgba(0,0,0,0)'); ends.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = ends; g.fillRect(0, 0, 128, 64);
  g.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = glowOnly ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  return texture;
}

/**
 * open: [{a:[x,y], b:[x,y], ecology}] native px. Returns { meshes, count, animate(t), dispose() }.
 */
export function createRanchSeamBridges(open = [], { doc = globalThis.document } = {}) {
  const { width, guard, lift } = RANCH_SEAM_BRIDGE;
  const byTheme = new Map();
  for (const edge of open) {
    const theme = ranchSeamTheme(edge.ecology);
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme).push(edge);
  }
  const meshes = [], disposables = [], glows = [];
  for (const [theme, edges] of byTheme) {
    const positions = [], uvs = [], indices = [];
    for (const e of edges) {
      const wa = ranchNativeToWorld(e.a[0], e.a[1]), wb = ranchNativeToWorld(e.b[0], e.b[1]);
      const a = new THREE.Vector3(wa.x, lift, wa.z), b = new THREE.Vector3(wb.x, lift, wb.z);
      const along = b.clone().sub(a), length = along.length(); along.normalize();
      const across = new THREE.Vector3(along.z, 0, -along.x), g = Math.min(guard * length, length / 3);
      const p0 = a.clone().addScaledVector(along, g), p1 = a.clone().addScaledVector(along, length - g);
      const base = positions.length / 3;
      for (const [p, s, u] of [[p0, -1, 0], [p1, -1, 1], [p1, 1, 1], [p0, 1, 0]]) {
        const v = p.clone().addScaledVector(across, s * width / 2);
        positions.push(v.x, v.y, v.z); uvs.push(u, s < 0 ? 0 : 1);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const t = THEMES[theme], canPaint = Boolean(doc?.createElement);
    const map = canPaint ? paint(doc, theme) : null, glowMap = canPaint && t.glow ? paint(doc, theme, true) : null;
    const material = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : t.base, map, transparent: true, depthWrite: false, roughness: 0.92, metalness: 0,
      emissive: t.glow ?? 0x000000, emissiveMap: glowMap, emissiveIntensity: t.glow ? 1.4 : 0,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `ranch-seam-bridge-${theme}`;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    meshes.push(mesh); disposables.push(geometry, material, map, glowMap);
    if (t.glow) glows.push(material);
  }
  return {
    meshes,
    count: open.length,
    themes: [...byTheme.keys()],
    animate(seconds) { for (const m of glows) m.emissiveIntensity = 1.1 + 0.45 * Math.sin(seconds * 2.2); },
    dispose() { for (const d of disposables) d?.dispose?.(); }
  };
}
