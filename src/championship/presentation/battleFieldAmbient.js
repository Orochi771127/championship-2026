// Battle field ambient layers — presentation only (Owner map polish 2026-10-18).
//
// Wraps an already-loaded runtime map field (runtimeMapArtBundle) with the
// separately rendered Blender layers its manifest lists under `ambient`. The
// set is declared per map; this module draws whatever is present:
//
//   waterMask + caustics  (BM04)  caustics, glints and ripples in the lagoon
//   sea + waves           (BM05)  wave glints on the polar sea
//   foam                  (both)  looping shore/lead foam, occasional swell
//   boundaryGlow          (both)  shimmer on the shared edge-post light rails
//   canopies              (BM04)  swaying palm canopies drawn over fighters
//   iceStates             (BM05)  worn / cracking / opened ice per grid cell
//   kind BM05_POLAR_R2            light drifting snow
//   lava + flow           (BM03)  flowing glow on molten lava, rising embers
//   lavaStates            (BM03)  water-crusted / reheating rock per grid cell
//   kind R1_POLISH_R2     (BM01/02/06-11) canopies under fighters, emissive
//                         pulse/flicker/screen, cloud shadows, floor-masked
//                         gusts, spinning rotors, pit smoke, lamp halos, a
//                         floor scan sweep and a per-map particle preset
//
// plus the electrified-water overlay, fall splashes and recovery puffs.
//
// It owns no clock: the battle scene calls update(deltaMs) from the shared
// ticker and observe(view) with the published battle view. Terrain state is
// read from view.arenaHazards (the simulation's state); nothing here decides
// gameplay. Decorative randomness uses its own seeded stream.

const TAU = Math.PI * 2;
const RASTER_PER_NATIVE = 4;
const KINDS = new Set(["BM04_LAGOON_R2", "BM05_POLAR_R2", "BM03_VOLCANO_R3", "R1_POLISH_R2"]);
const PARTICLES = Object.freeze({
  dust: { count: 26, color: [0xf3dcb0, 0xe8c99a], size: [1.2, 2.6], vx: [6, 16], vy: [-4, 4], alpha: 0.45 },
  petals: { count: 22, color: [0xffffff, 0xffd6e4, 0xfff3b0], size: [2, 3.2], vx: [12, 26], vy: [6, 14], alpha: 0.85, flutter: true },
  sand: { count: 40, color: [0xf6deb0, 0xe9c48e], size: [0.9, 1.8], vx: [70, 120], vy: [-6, 6], alpha: 0.5, streak: true },
  data: { count: 30, color: [0x7ff3ff, 0xc89bff], size: [1.4, 2.4], vx: [-3, 3], vy: [-22, -10], alpha: 0.7, square: true },
  spirit: { count: 30, color: [0x8fd7ff, 0xb9a3ff], size: [1.4, 2.8], vx: [-6, 6], vy: [-20, -8], alpha: 0.7, flicker: true },
  motes: { count: 18, color: [0xfff7e0], size: [1, 2], vx: [-4, 4], vy: [-6, 2], alpha: 0.35 }
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function linear(texture) {
  if (texture?.source) texture.source.scaleMode = "linear";
  return texture;
}

const MASKED_TILING_VERTEX = `in vec2 aPosition;
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
// Same coverage as Pixi's red-channel sprite mask on a premultiplied white
// mask (alpha x red), in one pass with no offscreen render target.
const MASKED_TILING_FRAGMENT = `in vec2 vUV;
uniform sampler2D uTile;
uniform sampler2D uMask;
uniform vec2 uRepeat;
uniform vec2 uOffset;
uniform vec3 uTint;
uniform vec4 uColor;
out vec4 finalColor;
void main() {
  vec4 m = texture(uMask, vUV);
  vec4 t = texture(uTile, vUV * uRepeat + uOffset);
  finalColor = vec4(t.rgb * uTint, t.a) * (m.a * m.r) * uColor;
}`;

/**
 * A tiling layer shown only inside a mask texture covering the same rectangle.
 * On WebGL this is one mesh with a two-texture shader; otherwise (or if the
 * shader cannot be built) the original Container + sprite mask + TilingSprite.
 * Returns {displayObject, tilePosition.set(x, y), alpha} like a TilingSprite.
 */
export function maskedTiling(PIXI, renderer, { tile, mask, rect, tileScale, tint = 0xffffff, alpha = 1, blendMode = "add", label }) {
  const [sx, sy] = Array.isArray(tileScale) ? tileScale : [tileScale, tileScale];
  if (renderer?.type === PIXI.RendererType?.WEBGL && PIXI.Mesh && PIXI.GlProgram && PIXI.Geometry && PIXI.UniformGroup) {
    try {
      tile.source.addressMode = "repeat";
      const tw = tile.width * sx, th = tile.height * sy;
      const uniforms = new PIXI.UniformGroup({
        uRepeat: { value: new Float32Array([rect.width / tw, rect.height / th]), type: "vec2<f32>" },
        uOffset: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        uTint: { value: new Float32Array([(tint >> 16 & 255) / 255, (tint >> 8 & 255) / 255, (tint & 255) / 255]), type: "vec3<f32>" }
      });
      const geometry = new PIXI.Geometry({
        attributes: { aPosition: [0, 0, rect.width, 0, rect.width, rect.height, 0, rect.height], aUV: [0, 0, 1, 0, 1, 1, 0, 1] },
        indexBuffer: [0, 1, 2, 0, 2, 3]
      });
      const shader = new PIXI.Shader({
        glProgram: new PIXI.GlProgram({ vertex: MASKED_TILING_VERTEX, fragment: MASKED_TILING_FRAGMENT, name: "ambient-masked-tiling" }),
        resources: { uTile: tile.source, uMask: mask.source, ambientTiling: uniforms }
      });
      const mesh = new PIXI.Mesh({ geometry, shader, label });
      mesh.position.set(rect.x, rect.y);
      // The sprite-mask path renders its children into a filter texture and
      // composites that normally, so its "add" never reached the scene; the
      // shader composites normally too, to keep the approved look.
      mesh.blendMode = "normal"; mesh.alpha = alpha;
      const offset = uniforms.uniforms.uOffset;
      return {
        displayObject: mesh, technique: "MESH_SHADER",
        destroy() { geometry.destroy(); shader.destroy(); },
        tilePosition: { set(x, y) { offset[0] = -x / tw; offset[1] = -y / th; uniforms.update(); } },
        get alpha() { return mesh.alpha; }, set alpha(v) { mesh.alpha = v; }
      };
    } catch (error) {
      console.warn(`CHAMPIONSHIP_AMBIENT_MASKED_TILING_FALLBACK: ${error.message}`);
    }
  }
  const fx = new PIXI.Container({ label });
  const maskSprite = new PIXI.Sprite(mask);
  maskSprite.position.set(rect.x, rect.y);
  maskSprite.width = rect.width; maskSprite.height = rect.height;
  fx.addChild(maskSprite); fx.mask = maskSprite;
  const t = new PIXI.TilingSprite({ texture: tile, width: rect.width, height: rect.height });
  t.position.set(rect.x, rect.y);
  t.tileScale.set(sx, sy); t.tint = tint; t.alpha = alpha; t.blendMode = blendMode;
  fx.addChild(t);
  return { displayObject: fx, technique: "SPRITE_MASK", tilePosition: t.tilePosition, destroy() {},
    get alpha() { return t.alpha; }, set alpha(v) { t.alpha = v; } };
}

/**
 * @param {object} options
 * @param {object} options.PIXI
 * @param {object} options.art   a loaded runtime map field
 * @param {"high"|"low"} [options.quality]
 * @param {boolean} [options.reducedMotion]
 * @param {object} [options.renderer]  the stage renderer; WebGL enables single-pass masked layers
 */
export async function withBattleFieldAmbient({ PIXI, art, quality = "high", reducedMotion = false, renderer = null }) {
  const ambient = art?.field?.ambient;
  if (!ambient || !KINDS.has(ambient.kind)) return art;
  const low = quality === "low";
  const polar = ambient.kind === "BM05_POLAR_R2";
  // Saver tier: every other foam frame at twice the frame time (half the
  // decoded foam memory, same loop length).
  const foamRegions = (ambient.foam?.regions ?? []).map(r => low ? { ...r, frames: r.frames.filter((_, i) => i % 2 === 0) } : r);
  const foamFrameMs = (ambient.foam?.frameMs ?? 260) * (low ? 2 : 1);
  const sources = [ambient.waterMask?.src, ambient.caustics?.src, ambient.sea?.src, ambient.waves?.src, ambient.boundaryGlow?.src,
    ambient.iceStates?.openWater?.src, ambient.iceStates?.cracked?.src,
    ambient.lava?.src, ambient.flow?.src, ambient.lavaStates?.cooled?.src, ambient.lavaStates?.reheat?.src,
    ambient.foliageStatic?.src, ambient.emissive?.src, ambient.floorMask?.src, ambient.cloudTile?.src, ambient.gustTile?.src,
    ...(ambient.rotors ?? []).map(r => r.src),
    ...(ambient.canopies ?? []).map(c => c.src), ...foamRegions.flatMap(r => r.frames.map(f => f.src))].filter(Boolean);
  let textures;
  try {
    textures = new Map(await Promise.all(sources.map(async src => [src, linear(await PIXI.Assets.load(src))])));
  } catch (error) {
    await Promise.allSettled(sources.map(src => PIXI.Assets.unload(src)));
    throw error;
  }
  const tex = src => textures.get(src);
  linear(art.displayObject.texture);
  const { worldWidthPx: W, worldHeightPx: H } = art.field;
  const rand = mulberry32(polar ? 0xb05 : ambient.lava ? 0xb03 : 0xb04);

  const root = new PIXI.Container({ label: "battle field with ambient layers" });
  root.addChild(art.displayObject);

  // --- BM04 lagoon: caustics, glints, ripples share the water mask.
  let waterFx = null, glints = null, ripples = null, causticLayers = [];
  if (ambient.waterMask) {
    waterFx = new PIXI.Container({ label: "lagoon water fx" });
    const mask = new PIXI.Sprite(tex(ambient.waterMask.src));
    mask.scale.set(ambient.waterMask.scale ?? 1);
    waterFx.addChild(mask);
    waterFx.mask = mask;
    causticLayers = (low ? [[1.7, 0.22, 9, 4]] : [[1.6, 0.17, 11, 5], [2.4, 0.11, -7, 9]]).map(([scale, alpha, vx, vy]) => {
      const t = new PIXI.TilingSprite({ texture: tex(ambient.caustics.src), width: W, height: H });
      t.tileScale.set(scale); t.alpha = alpha; t.tint = 0xe9fff8; t.blendMode = "add"; t.label = "caustics";
      waterFx.addChild(t);
      return { t, vx, vy, base: alpha };
    });
    glints = new PIXI.Graphics({ label: "sun glints" });
    glints.blendMode = "add";
    waterFx.addChild(glints);
    root.addChild(waterFx);
  }

  // --- BM05 polar sea: drifting wave glints inside the sea mask.
  let seaFx = null, waveLayer = null;
  if (ambient.sea) {
    waveLayer = maskedTiling(PIXI, renderer, { tile: tex(ambient.waves.src), mask: tex(ambient.sea.src), rect: ambient.sea,
      tileScale: 1.3, alpha: 0.45, label: "polar sea fx" });
    seaFx = waveLayer.displayObject;
    root.addChild(seaFx);
  }

  // --- BM03 lava: a slow flowing glow inside the lava mask.
  let lavaFx = null, flowLayer = null;
  if (ambient.lava) {
    flowLayer = maskedTiling(PIXI, renderer, { tile: tex(ambient.flow.src), mask: tex(ambient.lava.src), rect: ambient.lava,
      tileScale: 1.6, tint: 0xffb347, alpha: 0.5, label: "molten lava fx" });
    lavaFx = flowLayer.displayObject;
    root.addChild(lavaFx);
  }
  // --- BM03 lava states: crust and reheating crust revealed per cell.
  let crust = null;
  if (ambient.lavaStates) {
    const make = (state, label) => {
      const sp = new PIXI.Sprite(tex(state.src));
      sp.position.set(state.x, state.y);
      const m = new PIXI.Graphics({ label: `${label} mask` });
      sp.mask = m;
      root.addChild(sp, m);
      return { s: sp, m };
    };
    crust = { cooled: make(ambient.lavaStates.cooled, "cooled crust"), reheat: make(ambient.lavaStates.reheat, "reheating crust"),
      rim: new PIXI.Graphics({ label: "reheat warning" }), key: "" };
    for (const state of [crust.cooled, crust.reheat]) state.s.visible = state.m.visible = false;
    root.addChild(crust.rim);
  }

  // --- BM05 ice states: layer sprites revealed per cell by the simulation state.
  let ice = null;
  if (ambient.iceStates) {
    const make = (state, label) => {
      const s = new PIXI.Sprite(tex(state.src));
      s.position.set(state.x, state.y);
      const m = new PIXI.Graphics({ label: `${label} mask` });
      s.mask = m;
      root.addChild(s, m);
      return { s, m };
    };
    ice = {
      worn: make(ambient.iceStates.cracked, "worn ice"),
      cracking: make(ambient.iceStates.cracked, "cracking ice"),
      open: make(ambient.iceStates.openWater, "opened water"),
      rim: new PIXI.Graphics({ label: "ice warnings" }),
      key: ""
    };
    ice.worn.s.alpha = 0.55;
    for (const layer of [ice.worn, ice.cracking, ice.open]) layer.s.visible = layer.m.visible = false;
    root.addChild(ice.rim);
  }

  // --- R1 polish: ground layers under the fighters.
  const generic = ambient.kind === "R1_POLISH_R2";
  if (ambient.foliageStatic) {
    const sp = new PIXI.Sprite(tex(ambient.foliageStatic.src));
    sp.position.set(ambient.foliageStatic.x, ambient.foliageStatic.y);
    root.addChild(sp);
  }
  let gust = null;
  if (ambient.gustTile && ambient.floorMask && !low) {
    gust = maskedTiling(PIXI, renderer, { tile: tex(ambient.gustTile.src), mask: tex(ambient.floorMask.src), rect: ambient.floorMask,
      tileScale: ambient.gust === "sand" ? [2.2, 0.9] : [1.6, 1.2], tint: ambient.gust === "sand" ? 0xfff0d2 : 0xf2ffd8,
      alpha: ambient.gust === "sand" ? 0.16 : 0.12, label: "floor gusts" });
    root.addChild(gust.displayObject);
  }
  let scan = null;
  if (ambient.scan && ambient.floorMask) {
    const fx = new PIXI.Container({ label: "floor scan sweep" });
    const mask = new PIXI.Sprite(tex(ambient.floorMask.src));
    mask.position.set(ambient.floorMask.x, ambient.floorMask.y);
    mask.width = ambient.floorMask.width; mask.height = ambient.floorMask.height;
    fx.addChild(mask); fx.mask = mask;
    scan = { g: new PIXI.Graphics({ label: "scan band" }), box: ambient.floorMask };
    scan.g.blendMode = "add";
    fx.addChild(scan.g);
    root.addChild(fx);
  }
  const rotors = (ambient.rotors ?? []).map(r => {
    const sp = new PIXI.Sprite(tex(r.src));
    sp.anchor.set((r.pivot[0] - r.x) / sp.texture.width, (r.pivot[1] - r.y) / sp.texture.height);
    sp.position.set(r.pivot[0], r.pivot[1]);
    root.addChild(sp);
    return { sp, speed: r.speed ?? 2 };
  });
  const groundCanopies = generic ? new PIXI.Container({ label: "foliage (ground)" }) : null;
  if (groundCanopies) root.addChild(groundCanopies);

  ripples = new PIXI.Graphics({ label: "fighter ripples" });
  (waterFx ?? root).addChild(ripples);
  const charge = new PIXI.Graphics({ label: "charged water" });
  charge.blendMode = "add";
  (waterFx ?? root).addChild(charge);

  // --- Foam: two sprites per region crossfade through the authored loop.
  const foamRoot = new PIXI.Container({ label: "shore foam" });
  const foam = foamRegions.map(region => {
    const make = () => {
      const s = new PIXI.Sprite(tex(region.frames[0].src));
      s.position.set(region.x, region.y); s.scale.set(region.scale);
      foamRoot.addChild(s);
      return s;
    };
    return { region, a: make(), b: make() };
  });
  const swell = new PIXI.Container({ label: "occasional swell" });
  for (const { region } of foam) {
    const s = new PIXI.Sprite(tex(region.frames[0].src));
    s.position.set(region.x, region.y); s.scale.set(region.scale);
    swell.addChild(s);
  }
  swell.alpha = 0; swell.blendMode = "add";
  foamRoot.addChild(swell);
  root.addChild(foamRoot);

  let emissive = null;
  if (ambient.emissive) {
    emissive = new PIXI.Sprite(tex(ambient.emissive.src));
    emissive.position.set(ambient.emissive.x, ambient.emissive.y);
    emissive.blendMode = "add"; emissive.alpha = 0.35;
    root.addChild(emissive);
  }
  const halos = new PIXI.Graphics({ label: "lamp halos" });
  halos.blendMode = "add";
  root.addChild(halos);
  let clouds = null;
  if (ambient.cloudTile) {
    clouds = new PIXI.TilingSprite({ texture: tex(ambient.cloudTile.src), width: W, height: H });
    clouds.tileScale.set(3.2); clouds.tint = 0x0a0d18; clouds.alpha = ambient.clouds ?? 0.15;
    root.addChild(clouds);
  }
  let boundary = null;
  if (ambient.boundaryGlow) {
    boundary = new PIXI.Sprite(tex(ambient.boundaryGlow.src));
    boundary.position.set(ambient.boundaryGlow.x, ambient.boundaryGlow.y);
    boundary.blendMode = "add"; boundary.alpha = 0.3;
    root.addChild(boundary);
  }

  // --- Foreground: palm canopies (BM04) and drifting snow (BM05) over fighters.
  const foreground = new PIXI.Container({ label: "field foreground" });
  const canopies = (ambient.canopies ?? []).map((c, i) => {
    const s = new PIXI.Sprite(tex(c.src));
    s.anchor.set((c.pivot[0] - c.x) / s.texture.width, (c.pivot[1] - c.y) / s.texture.height);
    s.position.set(c.pivot[0], c.pivot[1]);
    (groundCanopies ?? foreground).addChild(s);
    return { s, phase: i * 1.7, speed: 0.75 + i * 0.09 };
  });
  const snow = polar && !reducedMotion ? Array.from({ length: low ? 24 : 60 }, () => ({
    x: rand() * W, y: rand() * H, r: 1.2 + rand() * 2.2, vx: 14 + rand() * 22, vy: 8 + rand() * 12, phase: rand() * TAU })) : [];
  const snowLayer = new PIXI.Graphics({ label: "drifting snow" });
  foreground.addChild(snowLayer);
  const emberSources = ambient.embers ?? [];
  const embers = emberSources.length && !reducedMotion ? Array.from({ length: low ? 14 : 36 }, () => ({ age: rand() * 2400, life: 1600 + rand() * 1400, src: null, x: 0, y: 0, vx: 0 })) : [];
  const emberLayer = new PIXI.Graphics({ label: "rising embers" });
  emberLayer.blendMode = "add";
  foreground.addChild(emberLayer);
  const preset = PARTICLES[ambient.particles] ?? null;
  const motes = preset && !reducedMotion ? Array.from({ length: Math.round(preset.count * (low ? 0.4 : 1)) }, () => ({
    x: rand() * W, y: rand() * H, r: preset.size[0] + rand() * (preset.size[1] - preset.size[0]),
    vx: preset.vx[0] + rand() * (preset.vx[1] - preset.vx[0]), vy: preset.vy[0] + rand() * (preset.vy[1] - preset.vy[0]),
    color: preset.color[Math.floor(rand() * preset.color.length)], phase: rand() * TAU })) : [];
  const moteLayer = new PIXI.Graphics({ label: "ambient particles" });
  if (preset && (ambient.particles === "data" || ambient.particles === "spirit")) moteLayer.blendMode = "add";
  foreground.addChild(moteLayer);
  const smoke = ambient.smoke && !reducedMotion ? (ambient.emitters?.pits ?? []).flatMap(([px, py]) =>
    Array.from({ length: low ? 3 : 6 }, (_, k) => ({ px, py, age: k * 500 + rand() * 400, life: 2600 + rand() * 900 }))) : [];
  const smokeLayer = new PIXI.Graphics({ label: "pit smoke" });
  root.addChild(smokeLayer);
  const puffs = new PIXI.Graphics({ label: "splash and puff" });
  foreground.addChild(puffs);

  const glintSpots = glints ? Array.from({ length: low ? 14 : 34 }, () => ({
    x: rand() * W, y: H * 0.12 + rand() * H * 0.82, phase: rand() * TAU, speed: 0.6 + rand() * 1.4, size: 2 + rand() * 3 })) : [];
  const rippleRings = [];
  const fighters = new Map();
  const bursts = [];
  let lastSeq = 0;
  let hazards = null;
  let openCells = new Set();
  let arcs = [];
  let arcTimer = 0;
  let elapsed = 0;
  let nextSwell = 9000 + rand() * 8000;
  let swellT = -1;
  let disposed = false;

  function ring(x, y, max, life, width, color, alpha) {
    if (rippleRings.length > (low ? 16 : 40)) rippleRings.shift();
    rippleRings.push({ x, y, max, life, age: 0, width, color, alpha });
  }

  function cellOf(x, y) {
    const cell = (hazards?.cellNativePx ?? 8) * RASTER_PER_NATIVE, cols = hazards?.cols ?? 52;
    return Math.floor(y / cell) * cols + Math.floor(x / cell);
  }

  function observe(view) {
    if (disposed || !view) return;
    hazards = view.arenaHazards ?? null;
    openCells = new Set((hazards?.ice ?? []).filter(([, state]) => state === 3).map(([i]) => i));
    (view.combatants ?? []).forEach((c, key) => {
      if (!c?.present || !c.stand || c.down) { fighters.delete(key); return; }
      const x = c.stand.x * W, y = c.stand.y * H, z = c.nativeMotion?.heightNativePx ?? 0;
      const f = fighters.get(key) ?? { x, y, z, since: 0 };
      const wet = waterFx ? true : openCells.has(cellOf(x, y));
      if (wet && z <= 2 && f.z > 6) ring(x, y, 46, 900, 3, 0xffffff, 0.75);
      else if (wet && z <= 2 && Math.hypot(x - f.x, y - f.y) > 7 && f.since > 200) { ring(x, y, 26, 700, 2, 0xe8fffb, 0.5); f.since = 0; }
      f.x = x; f.y = y; f.z = z;
      fighters.set(key, f);
    });
    for (const e of hazards?.recent ?? []) {
      if (e.seq <= lastSeq) continue;
      lastSeq = e.seq;
      const x = e.x * RASTER_PER_NATIVE, y = e.y * RASTER_PER_NATIVE;
      if (e.type === "SHOCK_CHARGE") { bursts.push({ x, y, age: 0, life: 600, kind: "charge" }); ring(x, y, 90, 650, 4, 0xfff6a8, 0.9); }
      else if (e.type === "SHOCKED") bursts.push({ x, y, age: 0, life: 380, kind: "spark" });
      else if (e.type === "SHOCK_RESISTED") bursts.push({ x, y, age: 0, life: 380, kind: "resist" });
      else if (e.type === "FELL_IN_WATER") { ring(x, y, 70, 900, 4, 0xffffff, 0.95); ring(x, y, 40, 650, 3, 0xbfeaff, 0.8); bursts.push({ x, y, age: 0, life: 700, kind: "splash" }); }
      else if (e.type === "RECOVERED") bursts.push({ x, y, age: 0, life: 600, kind: "puff" });
      else if (e.type === "ICE_HEATED" || e.type === "LAVA_COOLED") bursts.push({ x, y, age: 0, life: 1400, kind: "steam" });
      else if (e.type === "LAVA_BURN") bursts.push({ x, y, age: 0, life: 500, kind: "burn" });
      else if (e.type === "LAVA_RESISTED") bursts.push({ x, y, age: 0, life: 500, kind: "heatproof" });
    }
  }

  function drawIce() {
    if (!ice) return;
    const states = hazards?.ice ?? [];
    const cell = (hazards?.cellNativePx ?? 8) * RASTER_PER_NATIVE, cols = hazards?.cols ?? 52;
    const pulse = reducedMotion ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(elapsed / 110));
    // Mask geometry only changes when the cell states change; rims pulse every frame.
    const key = states.map(([i, s]) => `${i}:${s}`).join(",");
    if (key !== ice.key) {
      ice.key = key;
      for (const layer of [ice.worn, ice.cracking, ice.open]) { layer.m.clear(); layer.used = 0; }
      for (const [i, state] of states) {
        const x = (i % cols + 0.5) * cell, y = (Math.floor(i / cols) + 0.5) * cell;
        const target = state === 1 ? ice.worn : state === 2 ? ice.cracking : state === 3 ? ice.open : null;
        if (target) { target.m.circle(x, y, cell * 0.72).fill(0xffffff); target.used++; }
      }
      // Full-field state sprites are skipped (with their stencil) while empty.
      for (const layer of [ice.worn, ice.cracking, ice.open]) layer.s.visible = layer.m.visible = layer.used > 0;
    }
    ice.rim.clear();
    for (const [i, state, value] of states) {
      const x = (i % cols + 0.5) * cell, y = (Math.floor(i / cols) + 0.5) * cell;
      if (state === 2) ice.rim.circle(x, y, cell * 0.62).stroke({ color: 0xffffff, alpha: 0.75 * pulse, width: 2 });
      else if (state === 3 && value < 2) ice.rim.circle(x, y, cell * 0.6).fill({ color: 0xe6f6ff, alpha: 0.5 * (1 - value / 2) });
      else if (state === 4) ice.rim.circle(x, y, cell * 0.7).fill({ color: 0xeaf7ff, alpha: 0.45 });
    }
  }

  function drawCrust() {
    if (!crust) return;
    const cells = hazards?.lava ?? [];
    const cell = (hazards?.cellNativePx ?? 8) * RASTER_PER_NATIVE, cols = hazards?.cols ?? 52;
    const warn = hazards?.lavaWarnSeconds ?? 2;
    const key = cells.map(([i, sec]) => `${i}:${sec <= warn ? 1 : 0}`).join(",");
    if (key !== crust.key) {
      crust.key = key;
      crust.cooled.m.clear(); crust.reheat.m.clear();
      let cooled = 0, reheating = 0;
      for (const [i, sec] of cells) {
        const x = (i % cols + 0.5) * cell, y = (Math.floor(i / cols) + 0.5) * cell;
        (sec <= warn ? crust.reheat : crust.cooled).m.circle(x, y, cell * 0.74).fill(0xffffff);
        if (sec <= warn) reheating++; else cooled++;
      }
      // Full-field crust sprites are skipped (with their stencil) while empty.
      crust.cooled.s.visible = crust.cooled.m.visible = cooled > 0;
      crust.reheat.s.visible = crust.reheat.m.visible = reheating > 0;
    }
    // The reheat warning pulses (steady when motion is reduced) before lava returns.
    crust.reheat.s.alpha = reducedMotion ? 1 : 0.65 + 0.35 * Math.abs(Math.sin(elapsed / 120));
    crust.rim.clear();
    for (const [i, sec] of cells) {
      if (sec > warn) continue;
      const x = (i % cols + 0.5) * cell, y = (Math.floor(i / cols) + 0.5) * cell;
      crust.rim.circle(x, y, cell * 0.66).stroke({ color: 0xff5a1a, alpha: crust.reheat.s.alpha * 0.8, width: 2 });
    }
  }

  function drawCharge(dt) {
    charge.clear();
    const charged = hazards?.charged ?? [];
    if (!charged.length) { arcs = []; return; }
    const cell = (hazards?.cellNativePx ?? 8) * RASTER_PER_NATIVE, cols = hazards?.cols ?? 52;
    const warn = hazards?.warnSeconds ?? 0.8;
    const set = new Set(charged.map(([i]) => i));
    const centres = charged.map(([i, seconds]) => ({ i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, seconds }));
    // Range: a lit patch plus a bright rim where charge meets uncharged water
    // or dry ground. Fading charge flickers (steady half strength if motion is
    // reduced) so the end is readable without relying on animation.
    const pulse = 0.85 + 0.15 * Math.sin(elapsed / 120);
    for (const p of centres) {
      const fade = p.seconds <= warn ? (reducedMotion ? 0.5 : 0.3 + 0.4 * Math.abs(Math.sin(elapsed / 70))) : pulse;
      charge.rect(p.x - cell / 2, p.y - cell / 2, cell, cell).fill({ color: 0x6fe3ff, alpha: 0.2 * fade });
    }
    for (const p of centres) {
      const fade = p.seconds <= warn ? (reducedMotion ? 0.5 : 0.3 + 0.7 * Math.abs(Math.sin(elapsed / 70))) : 1;
      const x0 = p.x - cell / 2, y0 = p.y - cell / 2, c = p.i % cols;
      if (c === 0 || !set.has(p.i - 1)) charge.moveTo(x0, y0).lineTo(x0, y0 + cell);
      if (c === cols - 1 || !set.has(p.i + 1)) charge.moveTo(x0 + cell, y0).lineTo(x0 + cell, y0 + cell);
      if (!set.has(p.i - cols)) charge.moveTo(x0, y0).lineTo(x0 + cell, y0);
      if (!set.has(p.i + cols)) charge.moveTo(x0, y0 + cell).lineTo(x0 + cell, y0 + cell);
      charge.stroke({ color: 0xfff2a0, alpha: 0.85 * fade, width: 3 });
    }
    arcTimer -= dt;
    if (arcTimer <= 0 && centres.length > 1) {
      arcTimer = reducedMotion ? 400 : 70;
      arcs = [];
      const count = Math.min(Math.ceil(centres.length / 6), low ? 6 : 16);
      for (let k = 0; k < count; k++) {
        const a = centres[Math.floor(rand() * centres.length)];
        const b = centres[Math.floor(rand() * centres.length)];
        if (Math.hypot(a.x - b.x, a.y - b.y) > cell * 5) continue;
        const pts = [[a.x, a.y]];
        for (let s = 1; s < 5; s++) {
          const t = s / 5;
          pts.push([a.x + (b.x - a.x) * t + (rand() - 0.5) * 18, a.y + (b.y - a.y) * t + (rand() - 0.5) * 18]);
        }
        pts.push([b.x, b.y]);
        arcs.push(pts);
      }
    }
    for (const pts of arcs) {
      charge.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) charge.lineTo(x, y);
      charge.stroke({ color: 0x8fe9ff, alpha: 0.35, width: 6 });
      charge.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) charge.lineTo(x, y);
      charge.stroke({ color: 0xfffbe0, alpha: 0.95, width: 2 });
    }
  }

  function drawBursts(dt) {
    puffs.clear();
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += dt;
      if (b.age >= b.life) { bursts.splice(i, 1); continue; }
      const k = b.age / b.life, alpha = 1 - k;
      if (b.kind === "charge") puffs.circle(b.x, b.y, 18 + 60 * k).fill({ color: 0xfff6c0, alpha: 0.35 * alpha });
      else if (b.kind === "splash") {
        for (let r = 0; r < 10; r++) {
          const ang = r / 10 * TAU, d = 10 + 34 * k;
          puffs.circle(b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d * 0.6 - 30 * Math.sin(k * Math.PI), 3.5 * alpha + 1)
            .fill({ color: 0xffffff, alpha: 0.9 * alpha });
        }
      } else if (b.kind === "puff") {
        for (let r = 0; r < 7; r++) {
          const ang = r / 7 * TAU, d = 8 + 26 * k;
          puffs.circle(b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d * 0.6, 7 * (1 - k * 0.5)).fill({ color: 0xf4fbff, alpha: 0.6 * alpha });
        }
      } else if (b.kind === "burn") {
        for (let r = 0; r < 5; r++) {
          const ox = (r - 2) * 7, rise = 36 * k + r * 3;
          puffs.circle(b.x + ox, b.y - 10 - rise, 5 * (1 - k) + 1).fill({ color: r % 2 ? 0xffb347 : 0xff5a1a, alpha: 0.9 * alpha });
        }
      } else if (b.kind === "heatproof") {
        puffs.ellipse(b.x, b.y, 26 + 10 * k, 14 + 5 * k).stroke({ color: 0xffd27a, alpha: 0.8 * alpha, width: 2 });
      } else if (b.kind === "steam") {
        for (let r = 0; r < 5; r++) {
          const ox = (r - 2) * 9, rise = 50 * k + r * 4;
          puffs.circle(b.x + ox + Math.sin(k * 6 + r) * 4, b.y - rise, 6 + 10 * k).fill({ color: 0xffffff, alpha: 0.35 * alpha });
        }
      } else {
        const color = b.kind === "resist" ? 0x9fd8ff : 0xffffff;
        for (let r = 0; r < 6; r++) {
          const ang = r / 6 * TAU + k;
          puffs.moveTo(b.x, b.y - 30).lineTo(b.x + Math.cos(ang) * (16 + 22 * k), b.y - 30 + Math.sin(ang) * (16 + 22 * k));
        }
        puffs.stroke({ color, alpha, width: 2 });
      }
    }
  }

  function update(deltaMs) {
    art.update(deltaMs);
    if (disposed || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    const dt = Math.min(100, deltaMs);
    elapsed += dt;
    const s = elapsed / 1000;
    if (!reducedMotion) for (const c of causticLayers) {
      c.t.tilePosition.set(c.vx * s, c.vy * s);
      c.t.alpha = c.base * (0.85 + 0.15 * Math.sin(s * 0.7 + c.vx));
    }
    if (!reducedMotion) {
      for (const r of rotors) r.sp.rotation += r.speed * dt / 1000;
      if (clouds) clouds.tilePosition.set(-9 * s, -4 * s);
      if (gust) { gust.tilePosition.set(-(ambient.gust === "sand" ? 90 : 40) * s, 6 * Math.sin(s * 0.5)); gust.alpha = (ambient.gust === "sand" ? 0.16 : 0.12) * (0.6 + 0.4 * Math.max(0, Math.sin(s * 0.35))); }
    }
    if (emissive) {
      const mode = ambient.emissiveMode ?? "pulse";
      emissive.alpha = reducedMotion ? 0.35
        : mode === "flicker" ? 0.32 + 0.12 * Math.sin(s * 9.1) * Math.sin(s * 3.7 + 1) + 0.06 * Math.sin(s * 23)
        : mode === "screen" ? 0.3 + 0.1 * (Math.floor(s * 2) % 3 === 0 ? 1 : 0) + 0.05 * Math.sin(s * 1.6)
        : 0.3 + 0.12 * Math.sin(s * 1.4);
    }
    halos.clear();
    for (const [lx, ly] of ambient.emitters?.lamps ?? []) {
      const f = reducedMotion ? 0.6 : 0.5 + 0.25 * Math.sin(s * 8.3 + lx) * Math.sin(s * 3.1 + ly) + 0.1 * Math.sin(s * 19 + lx);
      halos.circle(lx, ly, 26).fill({ color: 0x9fd8ff, alpha: 0.12 * f });
      halos.circle(lx, ly, 12).fill({ color: 0xe8f6ff, alpha: 0.18 * f });
    }
    if (scan) {
      scan.g.clear();
      if (!reducedMotion) {
        const period = 6.5, k = (s % period) / period;
        if (k < 0.5) {
          const x = scan.box.x + (k / 0.5) * (scan.box.width + 160) - 80;
          scan.g.rect(x - 40, scan.box.y, 80, scan.box.height).fill({ color: 0x7ff3ff, alpha: 0.06 });
          scan.g.rect(x - 4, scan.box.y, 8, scan.box.height).fill({ color: 0xc8fbff, alpha: 0.18 });
        }
      }
    }
    moteLayer.clear();
    for (const m of motes) {
      m.x = (m.x + m.vx * dt / 1000 + W) % W;
      m.y = (m.y + m.vy * dt / 1000 + H) % H;
      const fl = preset.flicker ? 0.5 + 0.5 * Math.sin(s * 5 + m.phase) : 1;
      const dx = preset.flutter ? Math.sin(s * 2.3 + m.phase) * 5 : 0;
      if (preset.streak) moteLayer.rect(m.x, m.y, m.r * 7, m.r * 0.7).fill({ color: m.color, alpha: preset.alpha });
      else if (preset.square) moteLayer.rect(m.x, m.y, m.r * 1.6, m.r * 1.6).fill({ color: m.color, alpha: preset.alpha * fl });
      else if (preset.flutter) moteLayer.ellipse(m.x + dx, m.y, m.r * 1.3, m.r * 0.7).fill({ color: m.color, alpha: preset.alpha });
      else moteLayer.circle(m.x, m.y, m.r).fill({ color: m.color, alpha: preset.alpha * fl });
    }
    smokeLayer.clear();
    for (const p of smoke) {
      p.age += dt;
      if (p.age >= p.life) { p.age = 0; p.life = 2600 + rand() * 900; }
      const k = p.age / p.life;
      smokeLayer.circle(p.px + Math.sin(k * 5 + p.life) * 10, p.py - 70 * k, 8 + 22 * k).fill({ color: 0x3a3550, alpha: 0.28 * Math.sin(k * Math.PI) });
    }
    if (flowLayer && !reducedMotion) { flowLayer.tilePosition.set(-6 * s, 4 * s); flowLayer.alpha = 0.42 + 0.14 * Math.sin(s * 1.1); }
    emberLayer.clear();
    for (const e of embers) {
      e.age += dt;
      if (!e.src || e.age >= e.life) {
        const [sx, sy] = emberSources[Math.floor(rand() * emberSources.length)];
        Object.assign(e, { src: true, age: 0, life: 1600 + rand() * 1400, x: sx + (rand() - 0.5) * 24, y: sy + (rand() - 0.5) * 24, vx: (rand() - 0.5) * 18 });
      }
      const k = e.age / e.life;
      emberLayer.circle(e.x + e.vx * k + Math.sin(k * 8 + e.life) * 4, e.y - 70 * k, 2.2 * (1 - k) + 0.6)
        .fill({ color: k < 0.4 ? 0xffd27a : 0xff6a1a, alpha: 0.9 * (1 - k) });
    }
    if (waveLayer && !reducedMotion) { waveLayer.tilePosition.set(10 * s, 3 * Math.sin(s * 0.4) * 6); waveLayer.alpha = 0.38 + 0.1 * Math.sin(s * 0.9); }
    if (glints) {
      glints.clear();
      if (!reducedMotion) for (const g of glintSpots) {
        const v = Math.max(0, Math.sin(s * g.speed + g.phase)) ** 6;
        if (v < 0.05) continue;
        const r = g.size * (0.6 + v);
        glints.moveTo(g.x - r * 2, g.y).lineTo(g.x + r * 2, g.y).moveTo(g.x, g.y - r).lineTo(g.x, g.y + r)
          .stroke({ color: 0xffffff, alpha: 0.85 * v, width: 1.5 });
      }
    }
    // Foam loop with crossfade; reduced motion holds a single readable frame.
    if (foam.length) {
      const pos = reducedMotion ? 0 : elapsed / foamFrameMs;
      for (const f of foam) {
        const n = f.region.frames.length, i = Math.floor(pos) % n, j = (i + 1) % n, k = pos - Math.floor(pos);
        f.a.texture = tex(f.region.frames[i].src); f.b.texture = tex(f.region.frames[j].src);
        f.a.alpha = 0.92 * (1 - k); f.b.alpha = 0.92 * k;
      }
      if (!reducedMotion) {
        if (swellT < 0 && elapsed >= nextSwell) { swellT = 0; nextSwell = elapsed + 11000 + rand() * 9000; }
        if (swellT >= 0) {
          swellT += dt;
          const k = swellT / 1800;
          swell.alpha = k < 0.3 ? k / 0.3 * 0.55 : Math.max(0, 0.55 * (1 - (k - 0.3) / 0.7));
          if (k >= 1) { swellT = -1; swell.alpha = 0; }
        }
      }
    }
    if (boundary) boundary.alpha = reducedMotion ? 0.3 : 0.24 + 0.12 * Math.sin(s * 2.1) + 0.05 * Math.sin(s * 13.7);
    if (!reducedMotion) for (const c of canopies) {
      const gust = 0.5 + 0.5 * Math.sin(s * 0.23 + c.phase);
      c.s.rotation = (0.008 + 0.01 * gust) * Math.sin(s * c.speed + c.phase);
      c.s.skew.x = 0.006 * Math.sin(s * c.speed * 1.3 + c.phase);
    }
    snowLayer.clear();
    for (const f of snow) {
      f.x = (f.x + f.vx * dt / 1000 + W) % W;
      f.y = (f.y + f.vy * dt / 1000 + H) % H;
      snowLayer.circle(f.x + Math.sin(s * 1.3 + f.phase) * 6, f.y, f.r).fill({ color: 0xffffff, alpha: 0.7 });
    }
    for (const f of fighters.values()) f.since += dt;
    ripples.clear();
    for (let i = rippleRings.length - 1; i >= 0; i--) {
      const r = rippleRings[i];
      r.age += dt;
      if (r.age >= r.life) { rippleRings.splice(i, 1); continue; }
      const k = r.age / r.life, rx = 6 + r.max * k;
      ripples.ellipse(r.x, r.y, rx, rx * 0.62).stroke({ color: r.color, alpha: r.alpha * (1 - k), width: r.width });
    }
    drawIce();
    drawCrust();
    drawCharge(dt);
    drawBursts(dt);
  }

  return Object.freeze({
    assetId: art.assetId,
    field: art.field,
    displayObject: root,
    foregroundObject: foreground,
    update,
    observe,
    getDiagnostics() {
      return Object.freeze({ ...art.getDiagnostics(), ambient: ambient.kind, quality, reducedMotion,
        layers: { caustics: causticLayers.length, sea: Boolean(seaFx), foamRegions: foam.length, canopies: canopies.length,
          boundary: Boolean(boundary), iceStates: Boolean(ice), snow: snow.length, lava: Boolean(lavaFx), crust: Boolean(crust), embers: embers.length,
          emissive: Boolean(emissive), clouds: Boolean(clouds), gust: Boolean(gust), scan: Boolean(scan), rotors: rotors.length,
          particles: motes.length, smoke: smoke.length },
        maskedTechnique: [flowLayer, waveLayer, gust].filter(Boolean).map(l => l.technique),
        live: { ripples: rippleRings.length, charged: hazards?.charged?.length ?? 0, arcs: arcs.length, swell: swellT >= 0,
          iceCells: hazards?.ice?.length ?? 0, openCells: openCells.size, cooledCells: hazards?.lava?.length ?? 0,
          burning: hazards?.burningSlots?.length ?? 0, bursts: bursts.length,
          stateLayersVisible: { crust: crust ? [crust.cooled.s.visible, crust.reheat.s.visible] : null,
            ice: ice ? [ice.worn.s.visible, ice.cracking.s.visible, ice.open.s.visible] : null } } });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      root.removeChild(art.displayObject);
      foreground.destroy({ children: true });
      root.destroy({ children: true });
      for (const layer of [flowLayer, waveLayer, gust]) layer?.destroy();
      await art.dispose();
      for (const t of textures.values()) t?.source?.removeAllListeners?.("change");
      await Promise.allSettled(sources.map(src => PIXI.Assets.unload(src)));
    }
  });
}
