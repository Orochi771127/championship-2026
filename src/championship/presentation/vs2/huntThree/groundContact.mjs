// Hunt partners touch the ground they stand on (Owner 2026-11-25: 「角色…像是生活在地圖裡…
// 而不是一個貼紙浮在地圖上面的感覺」). Batch B after the map light (actorLight.mjs).
//
// The native field already says what each tile is (terrain 0 open, 2 shallow water,
// 3 ice). Every effect below follows that tile and the map's own biome; nothing here
// moves a partner, changes a frame or touches the native simulation.
//   water  -- the lower body sinks behind a waterline (tinted, see-through) with a
//             thin foam edge, and two ripple rings spread from the feet;
//   ice    -- a faint mirrored copy of the current drawing lies on the ice;
//   grass  -- a few pixel blades stand in front of the feet;
//   sand / snow -- footprints are left behind and fade.
// Each layer is drawn in the map's light (shared actor-light uniforms) where it has
// colour of its own, so night and lava maps stay coherent.

import { huntGrassTile } from './grassTiles.mjs';

export const HUNT_GROUND_TERRAIN = Object.freeze({ OPEN: 0, WATER: 2, ICE: 3 });

// Biome of the open ground per map (by manifest key).
const OPEN_GROUND = Object.freeze({
  hm01: 'grass', hm02: 'grass', hm03: 'grass', hm04: 'grass',
  hm13: 'snow', hm16: 'sand', hm17: 'sand'
});
// Water colour per map where the water is not plain blue.
const WATER_TINT = Object.freeze({
  hm05: 0x4f6a3e, hm11: 0x5d6b2c, hm13: 0x6fb2d4, hm06: 0x3d8fb8
});
const GRASS = Object.freeze({
  hm01: [0x5aa83c, 0x3f8a2e], hm02: [0xb4a04a, 0x8c7a34], hm03: [0x3f8a3a, 0x2c6a2c], hm04: [0x3a8a46, 0x2a6a34]
});
const PRINT = Object.freeze({ sand: { color: 0x6b4a2a, opacity: 0.32 }, snow: { color: 0x7d96b8, opacity: 0.38 } });

export const HUNT_GROUND_CONTACT = Object.freeze({
  waterDepthPx: 7, waterDepthShare: 0.28,
  rippleRadiusPx: 9, ripplePeriodMs: 1400, rippleOpacity: 0.55,
  reflectionOpacity: 0.26, reflectionSquash: 0.55,
  tuftHeightPx: 7, tuftWidthShare: 1.3,
  printStepPx: 9, printLifeMs: 4200, printMax: 18, printSizePx: 3
});

/**
 * What the ground under a partner is, from the native tile and the map's biome.
 * Grass also needs the tile to be grass in the map art (grassTiles.mjs), so dirt
 * paths and plazas stay bare; tile = world px / 16.
 */
export function huntGroundKind(terrain, mapKey, worldX = null, worldY = null) {
  if (terrain === HUNT_GROUND_TERRAIN.WATER) return 'water';
  if (terrain === HUNT_GROUND_TERRAIN.ICE) return 'ice';
  if (terrain !== HUNT_GROUND_TERRAIN.OPEN) return null;
  const open = OPEN_GROUND[mapKey] ?? null;
  if (open !== 'grass') return open;
  return Number.isFinite(worldX) && Number.isFinite(worldY) && huntGrassTile(mapKey, Math.floor(worldX / 16), Math.floor(worldY / 16)) ? 'grass' : null;
}

/** Waterline height (screen px above the feet) for a drawing of this height. */
export function huntWaterlinePx(spriteHeightPx) {
  const h = Number.isFinite(spriteHeightPx) && spriteHeightPx > 0 ? spriteHeightPx : 24;
  return Math.max(3, Math.min(HUNT_GROUND_CONTACT.waterDepthPx, h * HUNT_GROUND_CONTACT.waterDepthShare));
}

export function huntWaterTint(mapKey) { return WATER_TINT[mapKey] ?? 0x4a90b8; }

function canvasTexture(THREE, width, height, draw) {
  const canvas = globalThis.document?.createElement?.('canvas');
  if (!canvas) return null;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
const hex = n => `#${n.toString(16).padStart(6, '0')}`;

/**
 * One per map. `update` is called per visible partner per sync; `hide` when it goes
 * offscreen; `remove` when it leaves; `dispose` with the map.
 */
export function createHuntGroundContact({ THREE, scene, map, mapKey }) {
  const kc = map.k * map.c;
  const layers = new Map();
  const owned = new Set();
  const tint = huntWaterTint(mapKey);
  const ringTexture = canvasTexture(THREE, 32, 32, ctx => {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.stroke();
  });
  const grass = GRASS[mapKey];
  const tuftTexture = grass ? canvasTexture(THREE, 24, 8, ctx => {
    // Hand-placed pixel blades: two greens, uneven heights, gaps so the feet still read.
    const blades = [[1, 5, 0], [3, 7, 1], [5, 4, 0], [8, 6, 1], [10, 3, 0], [13, 7, 0], [15, 5, 1], [18, 6, 0], [20, 4, 1], [22, 6, 0]];
    for (const [x, h, shade] of blades) {
      ctx.fillStyle = hex(grass[shade]);
      ctx.fillRect(x, 8 - h, 1, h);
      ctx.fillRect(x + (shade ? -1 : 1), 8 - Math.ceil(h / 2), 1, Math.ceil(h / 2));
    }
  }) : null;
  const printTexture = canvasTexture(THREE, 8, 8, ctx => {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, 4, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  });
  for (const t of [ringTexture, tuftTexture, printTexture]) if (t) owned.add(t);

  const quadGeometry = () => {
    const g = new THREE.BufferGeometry();
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
    return g;
  };
  const setQuad = (mesh, corners) => {
    const p = mesh.geometry.attributes.position;
    corners.forEach((v, i) => p.setXYZ(i, v[0], v[1], v[2]));
    p.needsUpdate = true; mesh.geometry.computeBoundingSphere();
  };
  const flat = (wx, wy, rx, ry, h) => [map.ground(wx - rx, wy - ry, h), map.ground(wx - rx, wy + ry, h), map.ground(wx + rx, wy + ry, h), map.ground(wx + rx, wy - ry, h)];
  const add = (mesh, order) => { mesh.renderOrder = order; scene.add(mesh); owned.add(mesh.geometry); owned.add(mesh.material); return mesh; };

  function entry(id) {
    let e = layers.get(id);
    if (!e) { e = { ripples: [], prints: [], last: null, phase: (hashId(id) % 1000) / 1000 }; layers.set(id, e); }
    return e;
  }
  function ripples(e) {
    if (e.ripples.length || !ringTexture) return e.ripples;
    for (let i = 0; i < 2; i++) e.ripples.push(add(new THREE.Mesh(quadGeometry(), new THREE.MeshBasicMaterial({
      map: ringTexture, color: 0xe8f6ff, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -5 })), -0.8));
    return e.ripples;
  }
  function reflection(e) {
    if (!e.reflection) e.reflection = add(new THREE.Mesh(quadGeometry(), new THREE.MeshBasicMaterial({
      color: 0xcfeaff, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })), -1.5);
    return e.reflection;
  }
  function tuft(e) {
    if (!e.tuft && tuftTexture) e.tuft = add(new THREE.Mesh(quadGeometry(), new THREE.MeshBasicMaterial({
      map: tuftTexture, transparent: true, alphaTest: 0.5, depthWrite: true, depthTest: true, side: THREE.DoubleSide })), 1);
    return e.tuft;
  }
  function print(kind) {
    const style = PRINT[kind];
    return add(new THREE.Mesh(quadGeometry(), new THREE.MeshBasicMaterial({
      map: printTexture, color: style.color, transparent: true, opacity: style.opacity, depthWrite: false, depthTest: true,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })), -1.2);
  }
  const free = mesh => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); owned.delete(mesh.geometry); owned.delete(mesh.material); };

  return Object.freeze({
    tint,
    /**
     * @param id partner id
     * @param a {wild, kind, actor (the partner mesh), quad ([dx,dy] corners), groundHeight, visible, fade, now}
     */
    update(id, { wild, kind, actor, quad, groundHeight, visible, fade = 1, now = 0, footprint = null }) {
      const e = entry(id);
      const ys = quad.map(q => q[1]), xs = quad.map(q => q[0]);
      const spriteHeight = Math.max(0, -Math.min(...ys));
      const width = Math.max(4, Math.max(...xs) - Math.min(...xs));
      const airborne = (wild.worldZ ?? 0) > 1;
      // Water: the waterline lives in the partner's own shader (actorLight.mjs).
      const water = actor.material.userData.hmWater;
      if (water) water.value = kind === 'water' && !airborne ? huntWaterlinePx(spriteHeight) : 0;
      const rs = kind === 'water' ? ripples(e) : e.ripples;
      rs.forEach((ring, i) => {
        const on = visible && kind === 'water' && !airborne;
        ring.visible = on;
        if (!on) return;
        const t = ((now / HUNT_GROUND_CONTACT.ripplePeriodMs) + e.phase + i / rs.length) % 1;
        const r = HUNT_GROUND_CONTACT.rippleRadiusPx * (0.55 + 1.1 * t) * Math.max(0.8, width / 24);
        setQuad(ring, flat(wild.worldX, wild.worldY, r, r * map.s, groundHeight + 0.004));
        ring.material.opacity = HUNT_GROUND_CONTACT.rippleOpacity * (1 - t) * fade;
      });
      // Ice: the current drawing mirrored onto the ice below the feet.
      if (kind === 'ice' || e.reflection) {
        const m = reflection(e);
        m.visible = visible && kind === 'ice' && !!actor.material.map;
        if (m.visible) {
          const sq = HUNT_GROUND_CONTACT.reflectionSquash, z = wild.worldZ ?? 0;
          // Corners in the partner's order; a drawing point dy above the feet lands dy*sq below them.
          setQuad(m, quad.map(([dx, dy]) => map.ground(wild.worldX + dx, wild.worldY + (-dy + z) * sq, groundHeight + 0.003)));
          const uv = m.geometry.attributes.uv; uv.setXY(0, 0, 0); uv.setXY(1, 0, 1); uv.setXY(2, 1, 1); uv.setXY(3, 1, 0); uv.needsUpdate = true;
          if (m.material.map !== actor.material.map) { m.material.map = actor.material.map; m.material.needsUpdate = true; }
          m.material.opacity = HUNT_GROUND_CONTACT.reflectionOpacity * fade;
        }
      }
      // Grass: blades in front of the feet, a hair nearer the camera than the partner.
      if (kind === 'grass' || e.tuft) {
        const m = tuft(e);
        if (m) {
          m.visible = visible && kind === 'grass' && !airborne;
          if (m.visible) {
            // Centred on the measured lower body (actorFootprint.mjs) when there is one.
            const cx = Number.isFinite(footprint?.x) ? footprint.x : 0;
            const half = Number.isFinite(footprint?.radiusX) ? footprint.radiusX : width / 2;
            const w = half * HUNT_GROUND_CONTACT.tuftWidthShare, h = HUNT_GROUND_CONTACT.tuftHeightPx, sway = Math.sin(now / 700 + e.phase * 6.28) * 0.6;
            const at = (dx, dy) => map.actorVertex({ worldX: wild.worldX + cx, worldY: wild.worldY + 1.5, worldZ: 0, supportOffsetY: 0, groundHeight }, dx, dy);
            setQuad(m, [at(-w + sway, -h), at(-w, 0), at(w, 0), at(w + sway, -h)]);
            m.material.opacity = fade;
          }
        }
      }
      // Sand / snow: a print every few px of travel, fading out.
      if ((kind === 'sand' || kind === 'snow') && visible && !airborne) {
        const last = e.last;
        if (!last || Math.hypot(wild.worldX - last.x, wild.worldY - last.y) >= HUNT_GROUND_CONTACT.printStepPx) {
          if (last) {
            const m = print(kind), side = e.prints.length % 2 ? 1 : -1, ang = Math.atan2(wild.worldY - last.y, wild.worldX - last.x);
            const ox = -Math.sin(ang) * 2 * side, oy = Math.cos(ang) * 2 * side * map.s, sz = HUNT_GROUND_CONTACT.printSizePx;
            setQuad(m, flat(wild.worldX + ox, wild.worldY + oy, sz, sz * map.s, groundHeight + 0.0035));
            m.userData.born = now; m.userData.opacity = m.material.opacity;
            e.prints.push(m);
            while (e.prints.length > HUNT_GROUND_CONTACT.printMax) free(e.prints.shift());
          }
          e.last = { x: wild.worldX, y: wild.worldY };
        }
      }
      for (const m of [...e.prints]) {
        const age = now - (m.userData.born ?? now), life = HUNT_GROUND_CONTACT.printLifeMs;
        if (age >= life) { free(m); e.prints.splice(e.prints.indexOf(m), 1); continue; }
        m.material.opacity = m.userData.opacity * (1 - age / life);
      }
    },
    hide(id) {
      const e = layers.get(id); if (!e) return;
      for (const m of [...e.ripples, e.reflection, e.tuft].filter(Boolean)) m.visible = false;
    },
    remove(id) {
      const e = layers.get(id); if (!e) return;
      for (const m of [...e.ripples, e.reflection, e.tuft, ...e.prints].filter(Boolean)) free(m);
      layers.delete(id);
    },
    dispose() {
      for (const id of [...layers.keys()]) this.remove(id);
      for (const o of owned) {
        // Leaving the hunt: free the small source canvases at once (iOS keeps a canvas's
        // backing store until GC, and counts it against the page's canvas memory).
        const canvas = o.isTexture ? o.image : null;
        o.dispose?.();
        if (canvas && typeof canvas.getContext === 'function') { canvas.width = 0; canvas.height = 0; }
      }
      owned.clear();
    },
    diagnostics() {
      let ripplesOn = 0, reflections = 0, tufts = 0, prints = 0;
      for (const e of layers.values()) { ripplesOn += e.ripples.filter(r => r.visible).length; reflections += e.reflection?.visible ? 1 : 0; tufts += e.tuft?.visible ? 1 : 0; prints += e.prints.length; }
      return { partners: layers.size, ripples: ripplesOn, reflections, tufts, prints };
    }
  });
}

function hashId(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
