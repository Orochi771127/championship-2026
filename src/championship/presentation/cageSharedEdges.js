// Shared edges of same-theme cage pairs — presentation only (local review 2026-10-19).
//
// Every cage frame keeps its complete rim, outer wall and thickness. When a
// paired large/small cage (CM02 running track + CM30 basketball, ...) really
// shares an edge with its partner -- both hex edges lie on the same world
// segment -- a small patch of rim-free pixels covers that edge on both sides,
// so the pair reads as one ground. Separated, moved or reloaded cages are
// re-evaluated from their placements and show the full rim again. Patches sit
// right after their own base tile, so later tiles still draw over them. No
// walkability, resident, placement or rotation rule changes here.

import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';

const REVIEWS = Object.freeze({'art:cage:polish-review:20261019': 'polish-20261019'});
const BASE_LABEL = 'runtime map art ';

export function matchSharedEdges(tiles, pairs, tolerance) {
  // tiles: [{key, fieldId, edges:[{id, a:[x,y], b:[x,y]}]}] in world px.
  const partner = new Map();
  for (const [p, q] of pairs) { partner.set(p, (partner.get(p) ?? new Set()).add(q)); partner.set(q, (partner.get(q) ?? new Set()).add(p)); }
  // Rim joints are thin strips: their projected end points can sit a few pixels
  // apart on the two sides, so compare midpoints, lengths and directions.
  const mid = e => [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
  const len = e => Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
  const same = (e, f) => {
    const m = mid(e), n = mid(f), le = len(e), lf = len(f);
    if (Math.hypot(m[0] - n[0], m[1] - n[1]) > tolerance || Math.abs(le - lf) > Math.max(tolerance, .1 * le)) return false;
    const cross = ((e.b[0] - e.a[0]) * (f.b[1] - f.a[1]) - (e.b[1] - e.a[1]) * (f.b[0] - f.a[0])) / (le * lf || 1);
    return Math.abs(cross) < .08;
  };
  const shown = new Set();
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
    const A = tiles[i], B = tiles[j];
    // Same authored field is the conservative same-type fallback. Paired
    // fields remain explicit; height is physical metadata, never inferred
    // from screen Y (the two native hex rows have different screen Y).
    if (A.fieldId !== B.fieldId && !partner.get(A.fieldId)?.has(B.fieldId)) continue;
    const ah = A.height ?? 0, bh = B.height ?? 0;
    if (!Number.isFinite(ah) || !Number.isFinite(bh) || ah !== bh) continue;
    for (const e of A.edges) for (const f of B.edges) {
      if (same(e, f)) {
        shown.add(`${A.key}|${e.id}`); shown.add(`${B.key}|${f.id}`);
      }
    }
  }
  return shown;
}

export async function withCageSharedEdges({PIXI, art, manifest, location = globalThis.location, fetchImpl = globalThis.fetch,
  baseHref = globalThis.location?.href, connections = null}) {
  const tag = REVIEWS[manifest?.assetId];
  if (!tag || !isOriginalRuntimeLocation(location)) return art;
  const dir = `assets/production/cage/shared-edges-${tag}/`;
  const response = await fetchImpl(new URL(dir + 'index.json', baseHref));
  if (!response.ok) return art;
  const index = await response.json();
  if (index.assetId !== `art:cage:shared-edges:${tag}` || !Array.isArray(index.fields) || !Array.isArray(index.pairs)) return art;
  const frameHash = new Map(manifest.fields.map(f => [f.fieldId, f.frames?.[0]?.sha256]));
  const records = new Map(index.fields.filter(f => f.sourceHash === frameHash.get(f.fieldId)
    && typeof f.atlas?.src === 'string' && f.atlas.src.startsWith(dir) && !f.atlas.src.includes('..')).map(f => [f.fieldId, f]));
  const bases = [];
  const collect = object => {
    if (object.visible!==false && object.texture && object.label?.startsWith(BASE_LABEL)) {
      const fieldId = object.label.slice(BASE_LABEL.length);
      if (records.has(fieldId)) bases.push({fieldId, object});
    }
    for (const child of object.children ?? []) collect(child);
  };
  collect(art.displayObject);
  const tiles = bases.map(({fieldId, object}, k) => {
    const r = records.get(fieldId), sx = object.width / r.raster[0], sy = object.height / r.raster[1];
    return {key: k, fieldId, object, record: r, sx, sy, height: r.groundHeight ?? 0,
      edges: r.edges.map(e => ({...e, a: [object.x + e.a[0] * sx, object.y + e.a[1] * sy], b: [object.x + e.b[0] * sx, object.y + e.b[1] * sy]}))};
  });
  const tolerance = (index.toleranceWorldPx ?? 8) * Math.max(1, ...tiles.map(t => t.sx));
  const shown = matchSharedEdges(tiles, index.pairs, tolerance);
  const unit=art.field?.nativePixelWorldScale??4;
  // A rim patch must never advertise an obstructed joint as an open crossing.
  const isOpen=e=>connections===null||connections.some(c=>{
    const ax=(c.a[0]+c.b[0])*unit/2,ay=(c.a[1]+c.b[1])*unit/2;
    return Math.hypot((e.a[0]+e.b[0])/2-ax,(e.a[1]+e.b[1])/2-ay)<=tolerance;
  });
  const loads = [], sprites = [];
  try {
    const textures = new Map();
    for (const t of tiles) {
      const wanted = t.edges.filter(e => shown.has(`${t.key}|${e.id}`)&&isOpen(e));
      if (!wanted.length) continue;
      if (!textures.has(t.fieldId)) {
        loads.push(t.record.atlas.src);
        const texture = await PIXI.Assets.load(t.record.atlas.src);
        if (texture.width !== t.record.atlas.width || texture.height !== t.record.atlas.height) throw Error('CAGE_SHARED_EDGE_ATLAS_SIZE');
        textures.set(t.fieldId, texture);
      }
      const atlas = textures.get(t.fieldId), parent = t.object.parent;
      let at = parent.getChildIndex(t.object) + 1;
      for (const e of wanted) {
        const sprite = new PIXI.Sprite(new PIXI.Texture({source: atlas.source, frame: new PIXI.Rectangle(e.atlasX, e.atlasY, e.width, e.height)}));
        sprite.label = `cage shared edge ${t.fieldId} ${e.id}`;
        sprite.eventMode = 'none';
        sprite.position.set(t.object.x + e.x * t.sx, t.object.y + e.y * t.sy);
        sprite.scale.set(t.sx, t.sy);
        parent.addChildAt(sprite, at++);
        sprites.push(sprite);
      }
    }
  } catch (error) {
    for (const s of sprites) { s.parent?.removeChild(s); s.destroy(); }
    await Promise.allSettled(loads.map(src => PIXI.Assets.unload(src)));
    throw error;
  }
  if (!sprites.length && !loads.length) return art;
  let disposed = false;
  const diagnostics = () => ({tag, pairedEdges: sprites.map(s => s.label.slice('cage shared edge '.length)), atlasCount: loads.length, disposed});
  return Object.freeze({...art,
    getDiagnostics() { return {...art.getDiagnostics(), sharedEdges: diagnostics()}; },
    async dispose() {
      if (disposed) return; disposed = true;
      for (const s of sprites) { s.parent?.removeChild(s); s.destroy(); }
      await Promise.allSettled(loads.map(src => PIXI.Assets.unload(src)));
      await art.dispose();
    }});
}
