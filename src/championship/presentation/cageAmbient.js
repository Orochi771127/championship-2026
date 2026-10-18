// Cage ambient layers — presentation only (local review 2026-10-19).
//
// Wraps a loaded ranch tile set (after withCageForeground) with per-cage
// environmental motion generated from each reviewed master:
//   wind   foliage, curtains and paper sway: a mesh redraws the exact base
//          frame displaced by amp * height^1.5 * weight, so tops move, rooted
//          bases stay put and edges blend into the unmoved frame
//   glow   lamps, screens, orbs and crystals pulse additively
//   water  liquids and pools shimmer with a masked flowing caustic tile
//   particles  per-theme embers, steam, petals, leaves, snow, motes, fog,
//          sand, gas and the power plant's arcs
// Elements inside a prop sort at that prop's ground depth with residents;
// rooted ground foliage draws under every resident. Nothing here changes
// walkability, residents or simulation; it reads no game state.

import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';

const INDEX = 'assets/production/cage/ambient-review-20261019/index.json';
const PREFIX = 'assets/production/cage/ambient-review-20261019/';
const WATER_TILE = 'assets/production/battle/bm04-island-polish-r2/caustic-tile.webp';
const MAX_PADDING_WORLD_PX = 32;
const BASE_LAYER_Z = -1e6, TOP_Z = 1e7, TAU = Math.PI * 2;

const VERTEX = `in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;
// uBase*: element pixel -> base texture uv; uAtlas*: element pixel -> atlas uv.
const WIND_FRAGMENT = `in vec2 vUV;
uniform sampler2D uBase;
uniform sampler2D uAtlas;
uniform vec2 uSize;
uniform vec4 uBaseMap;
uniform vec4 uAtlasMap;
uniform vec4 uWind;
uniform float uTime;
uniform vec4 uColor;
out vec4 finalColor;
vec4 atlasAt(vec2 p) { p = clamp(p, vec2(0.5), uSize - 0.5); return texture(uAtlas, uAtlasMap.xy + p * uAtlasMap.zw); }
void main() {
  vec2 p = vUV * uSize;
  vec4 w = atlasAt(p);
  float h = pow(w.r, 1.5);
  float t = uTime;
  float sway = sin(t * uWind.z + uWind.w + p.x * 0.03) + 0.35 * sin(t * uWind.z * 2.3 + uWind.w * 1.7 + p.y * 0.05);
  vec2 d = vec2(uWind.y * h * sway, uWind.y * 0.22 * h * sin(t * uWind.z * 1.7 + uWind.w)) * w.a;
  vec2 src = p - d;
  float a = max(w.a, atlasAt(src).a);
  finalColor = texture(uBase, uBaseMap.xy + src * uBaseMap.zw) * a * uColor.a;
}`;
const WATER_FRAGMENT = `in vec2 vUV;
uniform sampler2D uTile;
uniform sampler2D uAtlas;
uniform vec2 uSize;
uniform vec4 uAtlasMap;
uniform vec4 uFlow;
uniform float uTime;
uniform vec4 uColor;
out vec4 finalColor;
void main() {
  vec2 p = vUV * uSize;
  float m = texture(uAtlas, uAtlasMap.xy + p * uAtlasMap.zw).a;
  vec2 q = p / uFlow.w;
  float c = texture(uTile, q + vec2(uTime * 0.020, uTime * 0.012)).r * 0.6
          + texture(uTile, q * 1.37 - vec2(uTime * 0.014, uTime * 0.019)).r * 0.4;
  float glint = smoothstep(0.55, 0.95, c);
  finalColor = vec4(vec3(0.85, 0.97, 1.0) * glint, glint) * m * uFlow.y * uColor.a;
}`;

function mapRect(texture, x, y) {
  const s = texture.source, f = texture.frame;
  return [(f.x + x) / s.width, (f.y + y) / s.height, 1 / s.width, 1 / s.height];
}

function shaderMesh(PIXI, {w, h, fragment, resources, label}) {
  const geometry = new PIXI.Geometry({
    attributes: {aPosition: [0, 0, w, 0, w, h, 0, h], aUV: [0, 0, 1, 0, 1, 1, 0, 1]},
    indexBuffer: [0, 1, 2, 0, 2, 3]
  });
  const shader = new PIXI.Shader({glProgram: new PIXI.GlProgram({vertex: VERTEX, fragment, name: label}), resources});
  const mesh = new PIXI.Mesh({geometry, shader, label});
  return {mesh, destroy() { geometry.destroy(); shader.destroy(); }};
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PARTICLES = Object.freeze({
  embers: {count: 22, color: [0xff9a3c, 0xffd36b], size: [1.4, 2.6], vx: [-6, 6], vy: [-34, -18], life: [1400, 2600], add: true, z: 'top'},
  steam: {count: 18, color: [0xf4fbff], size: [5, 10], vx: [-4, 4], vy: [-14, -8], life: [2200, 3400], alpha: 0.22, grow: true, z: 'top'},
  bubbles: {count: 14, color: [0xd8fff6], size: [1.2, 2.4], vx: [-1, 1], vy: [-16, -8], life: [1200, 2200], alpha: 0.7, ring: true, z: 'top'},
  petals: {count: 14, color: [0xffffff, 0xffd6e4, 0xfff3b0], size: [1.6, 2.6], vx: [10, 22], vy: [4, 12], life: [2600, 4200], flutter: true, z: 'top'},
  leaves: {count: 12, color: [0x7fb24a, 0xb7c94a, 0x5f8f3a], size: [2, 3.2], vx: [6, 16], vy: [10, 18], life: [3000, 4600], flutter: true, z: 'top'},
  snow: {count: 26, color: [0xffffff], size: [1.2, 2.4], vx: [6, 14], vy: [10, 18], life: [3000, 5000], z: 'top'},
  motes: {count: 16, color: [0xfff7e0], size: [0.9, 1.8], vx: [-3, 3], vy: [-5, 2], life: [2600, 4600], alpha: 0.4, z: 'top'},
  spirit: {count: 14, color: [0x9fd8ff, 0xc9b3ff], size: [1.4, 2.6], vx: [-3, 3], vy: [-16, -8], life: [1800, 3000], add: true, z: 'top'},
  fog: {count: 8, color: [0xdfe6ee], size: [14, 26], vx: [3, 7], vy: [-1, 1], life: [5000, 8000], alpha: 0.10, grow: true, z: 'top'},
  sand: {count: 24, color: [0xf6deb0, 0xe9c48e], size: [0.8, 1.6], vx: [50, 90], vy: [-3, 3], life: [900, 1600], alpha: 0.5, streak: true, z: 'top'},
  incense: {count: 8, color: [0xe8e4dc, 0xd8d2c8], size: [1.4, 2.8], vx: [-2, 2], vy: [-11, -6], life: [2600, 3800], alpha: 0.26, grow: true, flutter: true, z: 'top'},
  gas: {count: 10, color: [0xa6e36a, 0xc8f08a], size: [6, 12], vx: [-3, 3], vy: [-8, -4], life: [2600, 4200], alpha: 0.12, grow: true, z: 'top'}
});

export async function withCageAmbient({PIXI, art, manifest, placements, renderer = null, quality = 'high', reducedMotion = false,
  location = globalThis.location, fetchImpl = globalThis.fetch, baseHref = globalThis.location?.href}) {
  if (!art || !isOriginalRuntimeLocation(location) || art.field?.fold || renderer?.type !== PIXI.RendererType?.WEBGL) return art;
  let index;
  try {
    const response = await fetchImpl(new URL(INDEX, baseHref));
    if (!response.ok) return art;
    index = await response.json();
  } catch { return art; }
  if (index?.assetId !== 'art:cage:ambient-review:20261019' || !Array.isArray(index.fields)) return art;
  const low = quality === 'low';
  const wanted = index.fields.filter(f => placements.some(p => p.fieldId === f.fieldId)
    && typeof f.manifest === 'string' && f.manifest.startsWith(PREFIX) && !f.manifest.includes('..')
    && manifest?.fields?.find(m => m.fieldId === f.fieldId)?.frames?.[0]?.sha256 === f.sourceHash);
  if (!wanted.length) return art;

  const loads = [], cages = new Map();
  let waterTile = null;
  try {
    for (const f of wanted) {
      const response = await fetchImpl(new URL(f.manifest, baseHref));
      if (!response.ok) continue;
      const data = await response.json();
      if (data.fieldId !== f.fieldId || data.sourceComposite?.sha256 !== f.sourceHash || !data.atlas?.src?.startsWith(PREFIX)) continue;
      loads.push(data.atlas.src);
      const atlas = await PIXI.Assets.load(data.atlas.src);
      if (atlas.width !== data.atlas.width || atlas.height !== data.atlas.height) throw Error('CAGE_AMBIENT_ATLAS_SIZE');
      cages.set(f.fieldId, {data, atlas});
      if (!waterTile && data.elements.some(e => e.kind === 'water')) {
        loads.push(WATER_TILE); waterTile = await PIXI.Assets.load(WATER_TILE); waterTile.source.addressMode = 'repeat';
      }
    }
  } catch (error) {
    await Promise.allSettled(loads.map(src => PIXI.Assets.unload(src)));
    console.warn('CHAMPIONSHIP_CAGE_AMBIENT_FALLBACK', error?.message);
    return art;
  }
  if (!cages.size) return art;

  const bases = [];
  const collect = object => {
    if (object.texture && object.label?.startsWith('runtime map art ')) bases.push({fieldId: object.label.slice('runtime map art '.length), object});
    for (const child of object.children ?? []) collect(child);
  };
  collect(art.displayObject);
  const baseFor = (fieldId, x, y) => {
    let best = null, bestD = Infinity;
    for (const b of bases) {
      const dx = x - b.object.x, dy = y - b.object.y;
      if (b.fieldId !== fieldId || dx < 0 || dy < 0 || dx > MAX_PADDING_WORLD_PX || dy > MAX_PADDING_WORLD_PX) continue;
      if (dx + dy < bestD) { best = b.object; bestD = dx + dy; }
    }
    return best;
  };

  const roots = [], glows = [], systems = [], disposers = [];
  let winds = 0, waters = 0;
  // One time uniform shared by every wind and water mesh: a single update per frame.
  const clock = new PIXI.UniformGroup({uTime: {value: 0, type: 'f32'}});
  const wrap = art.field?.wrapWidthPx ?? null;
  for (const p of placements) {
    const cage = cages.get(p.fieldId);
    if (!cage || p.sourceRect || p.foldCap) continue;  // fragments and fold caps keep the static frame
    const base = baseFor(p.fieldId, p.x, p.y);
    if (!base?.texture) continue;
    const {data, atlas} = cage;
    const offX = base.x - p.x, offY = base.y - p.y;
    const scaleX = base.texture.frame.width / base.width, scaleY = base.texture.frame.height / base.height;
    for (const repeat of wrap ? [-wrap, 0, wrap] : [0]) {
      const tileX = p.x + repeat, tileY = p.y;
      const place = (display, e, z) => {
        const root = new PIXI.Container({label: `cage ambient ${p.fieldId} ${e.kind}`});
        root.eventMode = 'none'; root.zIndex = z; root.addChild(display);
        display.x = e.x; display.y = e.y;
        roots.push({root, tileX, tileY}); return root;
      };
      const swaying = new Set(data.elements.filter(e => e.kind === 'wind').sort((a, b) => b.pixels - a.pixels)
        .slice(0, low ? 20 : Infinity));
      for (const e of data.elements) {
        const depth = e.depthNative === null ? null : p.y / 4 + e.depthNative;
        if (e.kind === 'wind') {
          if (reducedMotion || !swaying.has(e)) continue;
          const uniforms = new PIXI.UniformGroup({
            uSize: {value: new Float32Array([e.width, e.height]), type: 'vec2<f32>'},
            uBaseMap: {value: new Float32Array([
              (base.texture.frame.x + (e.x - offX) * scaleX) / base.texture.source.width,
              (base.texture.frame.y + (e.y - offY) * scaleY) / base.texture.source.height,
              scaleX / base.texture.source.width, scaleY / base.texture.source.height]), type: 'vec4<f32>'},
            uAtlasMap: {value: new Float32Array(mapRect(atlas, e.atlasX, e.atlasY)), type: 'vec4<f32>'},
            uWind: {value: new Float32Array([0, e.amp, e.speed, e.phase]), type: 'vec4<f32>'}
          });
          const m = shaderMesh(PIXI, {w: e.width, h: e.height, fragment: WIND_FRAGMENT, label: 'cage-wind',
            resources: {uBase: base.texture.source, uAtlas: atlas.source, cageWind: uniforms, cageClock: clock}});
          place(m.mesh, e, depth ?? BASE_LAYER_Z);
          winds += 1; disposers.push(m.destroy);
        } else if (e.kind === 'glow') {
          const s = new PIXI.Sprite(new PIXI.Texture({source: atlas.source, frame: new PIXI.Rectangle(e.atlasX, e.atlasY, e.width, e.height)}));
          s.blendMode = 'add'; s.alpha = reducedMotion ? 0.25 : 0;
          place(s, e, (depth ?? BASE_LAYER_Z) + 0.001);
          glows.push({s, mode: e.mode, phase: e.phase, seed: e.x * 13 + e.y});
        } else if (e.kind === 'water' && waterTile) {
          const uniforms = new PIXI.UniformGroup({
            uSize: {value: new Float32Array([e.width, e.height]), type: 'vec2<f32>'},
            uAtlasMap: {value: new Float32Array(mapRect(atlas, e.atlasX, e.atlasY)), type: 'vec4<f32>'},
            uFlow: {value: new Float32Array([0, reducedMotion ? 0.25 : 0.42, 0, 96]), type: 'vec4<f32>'}
          });
          const m = shaderMesh(PIXI, {w: e.width, h: e.height, fragment: WATER_FRAGMENT, label: 'cage-water',
            resources: {uTile: waterTile.source, uAtlas: atlas.source, cageWater: uniforms, cageClock: clock}});
          place(m.mesh, e, (depth ?? BASE_LAYER_Z) + 0.002);
          waters += 1; disposers.push(m.destroy);
        }
      }
      if (reducedMotion) continue;
      for (const spec of data.particles ?? []) {
        if (spec.kind === 'arcs') {
          const g = new PIXI.Graphics({label: 'cage arcs'}); g.blendMode = 'add';
          const pts = data.elements.filter(e => e.kind === 'glow').map(e => [e.x + e.width / 2, e.y + e.height / 2]);
          const pairs = [];
          pts.forEach((a, i) => { let best = null, bd = Infinity;
            pts.forEach((b, j) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (j !== i && d > 24 && d < 220 && d < bd) { bd = d; best = b; } });
            if (best) pairs.push([a, best]); });
          const root = new PIXI.Container({label: 'cage ambient arcs'}); root.eventMode = 'none'; root.zIndex = TOP_Z; root.addChild(g);
          roots.push({root, tileX, tileY});
          systems.push({kind: 'arcs', g, pairs: pairs.slice(0, low ? 3 : 6), t: 0, next: 400, rand: mulberry32(tileX ^ 0xa5c)});
          continue;
        }
        const preset = PARTICLES[spec.kind];
        if (!preset) continue;
        const rand = mulberry32((tileX * 31 + spec.kind.length * 977) >>> 0);
        const count = Math.max(2, Math.round(preset.count * (low ? 0.4 : 1)));
        const g = new PIXI.Graphics({label: `cage particles ${spec.kind}`});
        if (preset.add) g.blendMode = 'add';
        const root = new PIXI.Container({label: `cage ambient ${spec.kind}`}); root.eventMode = 'none'; root.zIndex = TOP_Z; root.addChild(g);
        roots.push({root, tileX, tileY});
        const spawn = q => { const b = spec.boxes[Math.floor(rand() * spec.boxes.length)];
          q.x = b[0] + rand() * (b[2] - b[0]); q.y = b[1] + rand() * (b[3] - b[1]);
          q.vx = preset.vx[0] + rand() * (preset.vx[1] - preset.vx[0]); q.vy = preset.vy[0] + rand() * (preset.vy[1] - preset.vy[0]);
          q.r = preset.size[0] + rand() * (preset.size[1] - preset.size[0]); q.c = preset.color[Math.floor(rand() * preset.color.length)];
          q.life = preset.life[0] + rand() * (preset.life[1] - preset.life[0]); q.age = 0; q.ph = rand() * TAU; return q; };
        const items = Array.from({length: count}, () => { const q = spawn({}); q.age = rand() * q.life; return q; });
        systems.push({kind: spec.kind, g, preset, items, spawn});
      }
    }
  }

  let elapsed = 0, parent = null, disposed = false;
  const update = dt => {
    elapsed += dt;
    const s = elapsed / 1000;
    clock.uniforms.uTime = s; clock.update();
    if (!reducedMotion) for (const gl of glows) {
      const k = gl.mode === 'flicker' ? 0.55 + 0.25 * Math.sin(s * 9 + gl.phase) * Math.sin(s * 3.7 + gl.seed)
        : gl.mode === 'screen' ? 0.32 + 0.12 * Math.sin(s * 6 + gl.phase) + (Math.sin(s * 23 + gl.seed) > 0.96 ? 0.25 : 0)
        : gl.mode === 'shimmer' ? 0.2 + 0.25 * Math.max(0, Math.sin(s * 1.3 + gl.phase))
        : 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(s * 2.1 + gl.phase));
      gl.s.alpha = Math.max(0, Math.min(0.8, k));
    }
    for (const sys of systems) {
      sys.g.clear();
      if (sys.kind === 'arcs') {
        sys.t += dt;
        if (sys.t > sys.next) { sys.t = 0; sys.next = 260 + sys.rand() * 900; sys.live = sys.pairs.filter(() => sys.rand() < 0.5); sys.flash = 120; }
        if ((sys.flash ?? 0) > 0) {
          sys.flash -= dt;
          for (const [a, b] of sys.live ?? []) {
            const steps = 6; let x = a[0], y = a[1];
            sys.g.moveTo(x, y);
            for (let i = 1; i <= steps; i++) {
              const t = i / steps; x = a[0] + (b[0] - a[0]) * t + (i < steps ? (sys.rand() - 0.5) * 10 : 0);
              y = a[1] + (b[1] - a[1]) * t + (i < steps ? (sys.rand() - 0.5) * 10 : 0); sys.g.lineTo(x, y);
            }
          }
          sys.g.stroke({color: 0xbfe8ff, width: 1.6, alpha: 0.9});
        }
        continue;
      }
      const {preset} = sys;
      for (const q of sys.items) {
        q.age += dt;
        if (q.age >= q.life) sys.spawn(q);
        const k = q.age / q.life, fade = Math.min(1, k * 5) * Math.min(1, (1 - k) * 4);
        const x = q.x + q.vx * q.age / 1000 + (preset.flutter ? Math.sin(q.age / 300 + q.ph) * 3 : 0);
        const y = q.y + q.vy * q.age / 1000;
        const r = preset.grow ? q.r * (0.6 + k) : q.r;
        const alpha = (preset.alpha ?? 0.85) * fade;
        if (preset.streak) sys.g.rect(x, y, r * 4, r * 0.6).fill({color: q.c, alpha});
        else if (preset.ring) sys.g.circle(x, y, r).stroke({color: q.c, width: 0.8, alpha});
        else sys.g.circle(x, y, r).fill({color: q.c, alpha});
      }
    }
  };

  const ambient = {
    attach(layer) { parent = layer; for (const {root} of roots) layer.addChild(root); },
    syncViewport(fit) {
      if (disposed) return;
      for (const r of roots) { r.root.position.set(fit.x + r.tileX * fit.scale, fit.y + r.tileY * fit.scale); r.root.scale.set(fit.scale); }
    },
    getDiagnostics() {
      return {fields: [...cages.keys()], winds, glows: glows.length, waters,
        particleSystems: systems.length, roots: roots.length, reducedMotion, quality,
        decodedBytes: [...cages.values()].reduce((n, c) => n + c.data.atlas.decodedBytes, 0) + (waterTile ? waterTile.width * waterTile.height * 4 : 0)};
    }
  };
  const inner = art.foreground ?? null;
  const foreground = {
    attach(layer) { inner?.attach(layer); ambient.attach(layer); },
    syncViewport(fit) { inner?.syncViewport(fit); ambient.syncViewport(fit); },
    getDiagnostics() { return {...(inner?.getDiagnostics?.() ?? {}), ambient: ambient.getDiagnostics()}; }
  };
  return Object.freeze({...art, foreground,
    update(deltaMs) { art.update(deltaMs); if (!disposed && Number.isFinite(deltaMs) && deltaMs > 0) update(Math.min(deltaMs, 100)); },
    getDiagnostics() { return {...art.getDiagnostics(), ambient: ambient.getDiagnostics()}; },
    async dispose() {
      if (disposed) return; disposed = true;
      for (const {root} of roots) if (!root.destroyed) { root.parent?.removeChild(root); root.destroy({children: true}); }
      for (const d of disposers) d();
      parent = null;
      await Promise.allSettled(loads.map(src => PIXI.Assets.unload(src)));
      await art.dispose();
    }});
}
