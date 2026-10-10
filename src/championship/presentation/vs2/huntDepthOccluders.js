/**
 * 2.5D Hunt occlusion for fields rendered from 3D scenes.
 *
 * A field may carry `depthOccluders`: pieces of its own picture that stand in front of a
 * ground row (tree crowns, cave roofs, archways). Each piece is a sprite in the actor layer
 * whose zIndex is the world y of that row, so it sorts with the actors exactly like they
 * sort with each other: a Digimon behind a tree or inside a cave is covered, one in front
 * is not. Foliage in front of a Digimon fades (revealActors) so the hunt target stays
 * visible; solid pieces (caves) never fade, so a Digimon that runs into a cave is hidden.
 * Presentation only; collision, encounters and escapes stay in the Hunt runtime.
 */
import { createHuntFoliageDither, isHuntFoliageDitherRequested } from "./huntFoliageDither.js";

const PIECE_FIELDS = 9;   // [worldX, worldY, w, h, atlasX, atlasY, zIndex, page, solid]
const FADE_ALPHA = 0.42;
const CELL = 128;

function fail(code) {
  const error = new Error(`CHAMPIONSHIP_HUNT_DEPTH_OCCLUDERS: ${code}`);
  error.name = "ChampionshipHuntDepthOccluderError";
  throw error;
}

function productionSrc(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  const src = value.replaceAll("\\", "/");
  if (!src.startsWith("assets/production/")) fail(`${code}_OUTSIDE_PRODUCTION_ASSETS`);
  return src;
}

export function validateHuntDepthPieces(data, worldWidthPx, worldHeightPx, pageCount = 1) {
  if (!data || !Array.isArray(data.pieces)) fail("PIECES_REQUIRED");
  for (const piece of data.pieces) {
    if (!Array.isArray(piece) || piece.length !== PIECE_FIELDS || !piece.every(Number.isInteger)) fail("PIECE_SHAPE");
    const [x, y, w, h, ax, ay, , page, solid] = piece;
    if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > worldWidthPx || y + h > worldHeightPx || ax < 0 || ay < 0
      || page < 0 || page >= pageCount || (solid !== 0 && solid !== 1)) {
      fail("PIECE_BOUNDS");
    }
  }
  return data.pieces;
}

/** Existing wall texels in a bounded portal backcap stay opaque; other pieces are exact. */
export function solidHuntDepthRegions(pieces, regions = []) {
  let result = pieces;
  for (const c of regions) {
    if (![c.x, c.y, c.width, c.height, c.depth].every(Number.isInteger) || c.width <= 0 || c.height <= 0) fail('SOLID_REGION_BOUNDS');
    result = result.flatMap(piece => {
      const [x, y, w, h, ax, ay, z, page] = piece;
      const l = Math.max(x, c.x), t = Math.max(y, c.y), r = Math.min(x + w, c.x + c.width), b = Math.min(y + h, c.y + c.height);
      if (l >= r || t >= b) return [piece];
      return [...cutHuntDepthPieces([piece], [c]), [l, t, r - l, b - t, ax + l - x, ay + t - y, Math.max(z, c.depth), page, 1]];
    });
  }
  return result;
}

/** Subtract only explicit local presentation apertures; atlas coordinates stay exact. */
export function cutHuntDepthPieces(pieces, cutouts = []) {
  let result = pieces;
  for (const c of cutouts) {
    if (![c.x, c.y, c.width, c.height].every(Number.isInteger) || c.width <= 0 || c.height <= 0) fail('CUTOUT_BOUNDS');
    result = result.flatMap(piece => {
      const [x, y, w, h, ax, ay, z, page, solid] = piece;
      const l = Math.max(x, c.x), t = Math.max(y, c.y), r = Math.min(x + w, c.x + c.width), b = Math.min(y + h, c.y + c.height);
      if (l >= r || t >= b) return [piece];
      return [[x, y, w, t - y], [x, b, w, y + h - b], [x, t, l - x, b - t], [r, t, x + w - r, b - t]]
        .filter(([, , cw, ch]) => cw > 0 && ch > 0)
        .map(([cx, cy, cw, ch]) => [cx, cy, cw, ch, ax + cx - x, ay + cy - y, z, page, solid]);
    });
  }
  return result;
}

/**
 * Load the occluder atlas and pieces declared by a Hunt field. Returns null when the
 * field has none, so licensed flat fields keep their exact current behaviour.
 */
export async function loadHuntDepthOccluders({ PIXI, field, baseHref = globalThis.location?.href, fetchImpl = globalThis.fetch, cutouts = [], solidRegions = [] }) {
  const spec = field?.depthOccluders;
  if (!spec) return null;
  if (!Array.isArray(spec.atlases) || spec.atlases.length === 0) fail("ATLASES_REQUIRED");
  const groups = spec.animationFrames ?? [{ atlases: spec.atlases }];
  if (!Array.isArray(groups) || groups.length === 0
    || (spec.animationFrames && groups.length !== field.frames?.length)
    || groups.some(group => !Array.isArray(group?.atlases) || group.atlases.length !== spec.atlases.length)) fail("ATLAS_ANIMATION_SHAPE");
  const frameSrcs = groups.map(group => group.atlases.map(atlas => productionSrc(atlas?.src, "ATLAS_SRC")));
  const primarySrcs = spec.atlases.map(atlas => productionSrc(atlas?.src, "ATLAS_SRC"));
  if (primarySrcs.some((src, page) => src !== frameSrcs[0][page])) fail("ATLAS_FIRST_FRAME_MISMATCH");
  const atlasSrcs = [...new Set(frameSrcs.flat())];
  const piecesSrc = productionSrc(spec.pieces?.src, "PIECES_SRC");
  const response = await fetchImpl(new URL(piecesSrc, baseHref));
  if (!response.ok) fail(`PIECES_HTTP_${response.status}`);
  const pieces = cutHuntDepthPieces(solidHuntDepthRegions(validateHuntDepthPieces(await response.json(), field.worldWidthPx, field.worldHeightPx, spec.atlases.length), solidRegions), cutouts);
  const loaded = await Promise.all(atlasSrcs.map((src) => PIXI.Assets.load(src)));
  const bySrc = new Map(atlasSrcs.map((src, index) => [src, loaded[index]]));
  const atlases = frameSrcs.map(sources => sources.map(src => bySrc.get(src)));
  // Each phase uses the same piece layout with matching field colors and alpha.
  for (const atlas of loaded) if (atlas?.source) atlas.source.scaleMode = "nearest";
  const frameTextures = groups.map(() => []);
  let textures = frameTextures[0], frameIndex = 0;
  const sprites = [];
  try {
    for (const [x, y, w, h, ax, ay, z, page] of pieces) {
      for (let index = 0; index < atlases.length; index += 1) {
        const source = atlases[index][page].source;
        if ((Number.isFinite(source.width) && ax + w > source.width)
          || (Number.isFinite(source.height) && ay + h > source.height)) fail("ATLAS_RECT_BOUNDS");
        frameTextures[index].push(new PIXI.Texture({ source, frame: new PIXI.Rectangle(ax, ay, w, h) }));
      }
      const sprite = new PIXI.Sprite(textures.at(-1));
      sprite.label = "hunt depth occluder";
      sprite.position.set(x, y);
      sprite.zIndex = z;
      sprite.eventMode = "none";
      sprite.cullable = true;
      sprites.push(sprite);
    }
  } catch (error) {
    sprites.forEach((sprite) => sprite.destroy());
    frameTextures.flat().forEach((texture) => texture.destroy(false));
    await Promise.allSettled(atlasSrcs.map((src) => PIXI.Assets.unload(src)));
    throw error;
  }
  // Pieces bucketed by 128 px cells: fadeable ones for the per-frame reveal, all of them for the view window.
  const buckets = new Map();
  const allBuckets = new Map();
  const add = (map, key, index) => { if (!map.has(key)) map.set(key, []); map.get(key).push(index); };
  pieces.forEach(([x, y, w, h, , , , , solid], index) => {
    for (let cx = Math.floor(x / CELL); cx <= Math.floor((x + w - 1) / CELL); cx++) {
      for (let cy = Math.floor(y / CELL); cy <= Math.floor((y + h - 1) / CELL); cy++) {
        add(allBuckets, cx * 4096 + cy, index);
        if (!solid) add(buckets, cx * 4096 + cy, index);
      }
    }
  });
  let faded = new Set();
  let dither = null;
  let parent = null;
  let disposed = false;
  let attached = new Set();
  let windowKey = null;
  const detach = () => {
    dither?.dispose();
    if (!parent) return;
    for (const sprite of sprites) if (sprite.parent === parent) parent.removeChild(sprite);
    parent = null;
    attached = new Set();
    windowKey = null;
  };
  return Object.freeze({
    pieceCount: sprites.length,
    // Sample the existing map animation clock; this owns no timer or ticker.
    syncFrame(index) {
      if (disposed) return;
      if (!Number.isInteger(index) || index < 0 || (frameTextures.length > 1 && index >= frameTextures.length)) fail("ATLAS_FRAME_INDEX");
      const next = frameTextures.length === 1 ? 0 : index;
      if (next === frameIndex) return;
      dither?.dispose();
      frameIndex = next; textures = frameTextures[next];
      sprites.forEach((sprite, i) => { sprite.texture = textures[i]; sprite.alpha = 1; });
      faded = new Set();
    },
    getAnimationDiagnostics: () => ({ frameIndex, frameCount: frameTextures.length, disposed }),
    configureFoliageDither(renderer) {
      dither?.dispose();
      dither = createHuntFoliageDither({ PIXI, renderer });
    },
    get usesActorAlpha() { return !!dither; },
    getRevealDiagnostics: () => dither?.getDiagnostics() ?? {
      mode: 'fade-0.42', requestedDitherUnavailable: isHuntFoliageDitherRequested()
    },
    attach(layer) {
      if (disposed) return;
      detach();
      parent = layer;
      for (const sprite of sprites) layer.addChild(sprite);
      attached = new Set(sprites.keys());
    },
    /**
     * Keep only the pieces near the camera in the actor layer, so its per-frame depth sort stays
     * small on phones. ``rect`` is the visible world rectangle; one cell of margin on each side.
     */
    syncView(rect) {
      if (disposed || !parent) return attached.size;
      const c0 = Math.floor(rect.left / CELL) - 1, c1 = Math.floor(rect.right / CELL) + 1;
      const r0 = Math.floor(rect.top / CELL) - 1, r1 = Math.floor(rect.bottom / CELL) + 1;
      const key = `${c0},${c1},${r0},${r1}`;
      if (key === windowKey) return attached.size;
      windowKey = key;
      const want = new Set();
      for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) {
        for (const index of allBuckets.get(cx * 4096 + cy) ?? []) want.add(index);
      }
      for (const index of attached) if (!want.has(index)) {
        dither?.forget(index);
        parent.removeChild(sprites[index]);
      }
      for (const index of want) if (!attached.has(index)) parent.addChild(sprites[index]);
      attached = want;
      return attached.size;
    },
    detach,
    /**
     * Fade the foliage pieces standing in front of each actor's sprite box.
     * @param {{x:number,y:number,halfWidth:number,height:number}[]} actors world px; y is the feet
     */
    revealActors(actors) {
      if (disposed) return 0;
      const next = new Set();
      if (dither) {
        dither.begin();
        const intersections = new Map();
        for (const { silhouette: actor } of actors) {
          if (!actor) continue;
          const seen = new Set();
          for (let cx = Math.floor(actor.left / CELL); cx <= Math.floor(actor.right / CELL); cx++) {
            for (let cy = Math.floor(actor.top / CELL); cy <= Math.floor(actor.bottom / CELL); cy++) {
              for (const index of buckets.get(cx * 4096 + cy) ?? []) {
                if (seen.has(index) || !attached.has(index)) continue;
                seen.add(index);
                const [x, y, w, h, , , z] = pieces[index];
                if (z <= actor.depth || x >= actor.right || x + w <= actor.left || y >= actor.bottom || y + h <= actor.top) continue;
                if (!intersections.has(index)) intersections.set(index, []);
                intersections.get(index).push(actor);
              }
            }
          }
        }
        for (const index of faded) sprites[index].alpha = 1;
        faded = new Set();
        for (const [index, overlapping] of intersections) {
          if (dither.update(index, pieces[index], textures[index], overlapping, parent, sprites[index])) next.add(index);
          else { sprites[index].alpha = FADE_ALPHA; faded.add(index); }
        }
        dither.finish(next);
        return next.size;
      }
      for (const actor of actors) {
        const x0 = actor.x - actor.halfWidth, x1 = actor.x + actor.halfWidth, y0 = actor.y - actor.height, y1 = actor.y;
        for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
          for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
            for (const index of buckets.get(cx * 4096 + cy) ?? []) {
              if (next.has(index)) continue;
              const [x, y, w, h, , , z] = pieces[index];
              if (z <= actor.y || x > x1 || x + w < x0 || y > y1 || y + h < y0) continue;
              next.add(index);
            }
          }
        }
      }
      for (const index of faded) if (!next.has(index)) sprites[index].alpha = 1;
      for (const index of next) sprites[index].alpha = FADE_ALPHA;
      faded = next;
      return next.size;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      detach();
      sprites.forEach((sprite) => sprite.destroy());
      frameTextures.flat().forEach((texture) => texture.destroy(false));
      await Promise.allSettled(atlasSrcs.map((src) => PIXI.Assets.unload(src)));
    }
  });
}

/** Field art plus its occluders, disposed together. */
export function withHuntDepthOccluders(art, occluders) {
  if (!occluders) return art;
  return Object.freeze({
    ...art,
    occluders,
    update(deltaMs) {
      art.update(deltaMs);
      occluders.syncFrame?.(art.getDiagnostics()?.frameIndex ?? 0);
    },
    getDiagnostics() {
      return Object.freeze({ ...art.getDiagnostics(), occluderAnimation: occluders.getAnimationDiagnostics?.() ?? null });
    },
    async dispose() {
      await occluders.dispose();
      await art.dispose();
    }
  });
}
