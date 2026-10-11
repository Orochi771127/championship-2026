// Locked expansion bays under a ranch that has no expansion (2026-10-12).
//
// A ranch without the expansion used to end at its second row, and on a phone
// the rest of the frame was empty screen. The bays here are the expansion's
// own rows 3-4 (ranchExpansionPreviewPlan), each under the original blue Lid,
// with a few padlocks: the honeycomb continues, visibly locked, and the
// screen's spare height shows what the expansion would open.
//
// They load through the same tile-set loader as the ranch, so there is no
// second loader or texture owner. Presentation only: the player's ring, walk
// grid, placements and input are untouched, and nothing here is walkable.

import { createRuntimeMapArtTileSetLoader } from './runtimeMapArtBundle.js';
import { prefersReducedMotion } from './presentationPreferences.js';

// A 13 x 13 native-pixel padlock: o outline, s shackle, b body, h lit edge,
// k keyhole. Drawn one native pixel per cell so it stays as crisp as the art.
const PADLOCK = Object.freeze([
  '....ooooo....',
  '...ossssso...',
  '..oso...oso..',
  '..oso...oso..',
  '..oso...oso..',
  '.ooooooooooo.',
  '.obbbbbbbbbo.',
  '.obbbbkbbbbo.',
  '.obbbkkkbbbo.',
  '.obbbbkbbbbo.',
  '.obbbbkbbbbo.',
  '.ohhhhhhhhho.',
  '.ooooooooooo.'
]);
const PADLOCK_COLOURS = Object.freeze({ o: 0x0b2134, s: 0xb9d6ea, b: 0xeaf7ff, h: 0x86e6ff, k: 0x0b2134 });
// Locked bays read darker than the board's own empty bays (the same Lid, open
// to build on); the padlocks above them stay at full brightness.
const LOCKED_TINT = 0xa9bccd;

/** Where a bay's hex centre sits in the band (native px, band-local, caps above 0). */
export function expansionBayCentre(slot) {
  const column = Math.floor(slot / 2), row = slot % 2;
  // Single-cell origins: x = column*96 + row*48; the back row's field top is
  // 24 px above the band (its cap), the front row's 64 px below it. A hex
  // centre is 48 px across and 56 px down its 96 x 112 field.
  return { x: column * 96 + row * 48 + 48, y: row === 0 ? 56 - 24 : 64 + 56 };
}

function drawPadlock(PIXI, unit) {
  const lock = new PIXI.Container({ label: 'expansion bay padlock' });
  const glow = new PIXI.Graphics().circle(0, 0, 11 * unit).fill({ color: 0x041420, alpha: 0.55 })
    .circle(0, 0, 11 * unit).stroke({ color: 0x7fd8ff, alpha: 0.55, width: unit });
  const icon = new PIXI.Graphics();
  PADLOCK.forEach((row, y) => [...row].forEach((cell, x) => {
    const colour = PADLOCK_COLOURS[cell];
    if (colour !== undefined) icon.rect((x - 6.5) * unit, (y - 6.5) * unit, unit, unit).fill(colour);
  }));
  lock.addChild(glow, icon);
  lock.eventMode = 'none';
  return { lock, glow };
}

/**
 * Wrap a loaded ranch art binding with the locked expansion bays.
 *
 * @returns the same binding shape, with `field.expansionPreview` describing
 *   the band for the viewport (its height) and the scene (its call to action).
 */
export async function withRanchExpansionPreview({ PIXI, art, manifest, preview, reducedMotion = prefersReducedMotion() }) {
  if (!preview || !art?.field || art.field.fold || art.field.presentationMode !== 'NATIVE_RANCH') return art;
  const unit = preview.nativePixelWorldScale;
  if (!(unit > 0) || unit !== art.field.nativePixelWorldScale) return art;
  // The tile set accepts no tile above its own top edge, so the band's frame
  // starts at the caps: everything moves down by capPx and the band moves up.
  const tiles = await createRuntimeMapArtTileSetLoader({ PIXI }).load({ manifest,
    placements: preview.placements.map((placement) => ({ ...placement, y: placement.y + preview.capPx })),
    placementEvidence: 'NATIVE_ORIGINS_AND_CROP_WITH_FLATTENED_ART', presentationMode: 'NATIVE_RANCH' });
  if (!tiles) return art;
  try { return compose(); } catch (error) { await tiles.dispose(); throw error; }
  function compose() {
    const container = new PIXI.Container({ label: 'ranch with expansion preview' });
    const band = new PIXI.Container({ label: 'ranch expansion preview' });
    band.eventMode = 'none';
    band.position.set(0, preview.bandOffsetPx - preview.capPx);
    const bays = new PIXI.Container({ label: 'locked bays' });
    bays.tint = LOCKED_TINT;
    bays.addChild(tiles.displayObject);
    band.addChild(bays);
    const glows = [];
    for (const slot of preview.lockedBays) {
      const centre = expansionBayCentre(slot);
      const { lock, glow } = drawPadlock(PIXI, unit);
      lock.position.set(centre.x * unit, (centre.y * unit) + preview.capPx);
      band.addChild(lock);
      glows.push(glow);
    }
    // The ranch ring wraps sideways; the band repeats with it so it stays under
    // the same columns wherever the camera crosses the seam.
    const repeats = [];
    const wrap = art.field.wrapWidthPx;
    if (wrap > 0) for (const offset of [-wrap, wrap]) {
      const copy = new PIXI.Container({ label: 'ranch expansion preview repeat' });
      copy.eventMode = 'none';
      copy.position.set(offset, band.y);
      for (const child of band.children) {
        if (child === bays) {
          const layer = new PIXI.Container();
          layer.tint = LOCKED_TINT;
          for (const tile of tiles.displayObject.children) {
            if (!tile.texture) continue;
            const sprite = new PIXI.Sprite(tile.texture);
            sprite.position.set(tile.x, tile.y); sprite.width = tile.width; sprite.height = tile.height; sprite.eventMode = 'none';
            layer.addChild(sprite);
          }
          copy.addChild(layer);
        } else {
          const { lock, glow } = drawPadlock(PIXI, unit);
          lock.position.copyFrom(child.position);
          copy.addChild(lock); glows.push(glow);
        }
      }
      repeats.push(copy);
    }
    container.addChild(art.displayObject, band, ...repeats);
    const contentHeightPx = preview.placements.reduce((bottom, placement) =>
      Math.max(bottom, placement.y + (placement.sourceRect?.height ?? 0)), 0);
    const field = Object.freeze({ ...art.field, expansionPreview: Object.freeze({
      bandOffsetPx: preview.bandOffsetPx, capPx: preview.capPx, widthPx: preview.widthPx, contentHeightPx }) });
    let elapsed = 0, disposed = false;
    return Object.freeze({ ...art, displayObject: container, field,
      update(deltaMs) {
        art.update(deltaMs);
        // A slow breath on the lock discs; none when motion is reduced.
        if (reducedMotion || disposed) return;
        elapsed = (elapsed + (Number(deltaMs) || 0)) % 2800;
        const alpha = 0.6 + 0.4 * Math.sin(elapsed / 2800 * Math.PI * 2);
        for (const glow of glows) glow.alpha = alpha;
      },
      getDiagnostics() {
        return { ...art.getDiagnostics(), expansionPreview: { bays: preview.placements.filter((p) => p.slotIndex !== undefined).length,
          locks: preview.lockedBays.length, repeats: repeats.length, walkable: false } };
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        for (const copy of repeats) { copy.parent?.removeChild(copy); copy.destroy({ children: true }); }
        bays.removeChild(tiles.displayObject);
        band.parent?.removeChild(band);
        band.destroy({ children: true });
        container.removeChild(art.displayObject);
        container.destroy({ children: false });
        await Promise.allSettled([tiles.dispose(), art.dispose()]);
      } });
  }
}
