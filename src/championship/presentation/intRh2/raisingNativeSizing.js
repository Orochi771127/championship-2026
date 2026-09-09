import { raisingFieldViewport } from "./raisingFieldViewport.js";

/** Screen pixels per native pixel, shared by cage art and residents. */
export function getRaisingNativePixelScale(field, viewport, padding = 12) {
  const unit = field?.nativePixelWorldScale;
  if (!(Number.isFinite(unit) && unit > 0 && field.worldWidthPx > 0 && field.worldHeightPx > 0)) return null;
  return unit * raisingFieldViewport(field, viewport, padding).scale;
}

/** Use visible trim for decoration/input; retain the asset's existing anchor. */
export function getRaisingNativeActorGeometry(sprite, sizing, screenPixelsPerNativePixel) {
  const packedScale = sizing?.packedPixelsPerNativePixel;
  const texture = sprite?.texture;
  const resolution = texture?.source?.resolution;
  if (!(packedScale > 0 && resolution > 0 && screenPixelsPerNativePixel > 0 && texture.orig)) return null;
  const spriteScale = resolution / packedScale;
  const trim = texture.trim ?? { x: 0, y: 0, width: texture.orig.width, height: texture.orig.height };
  const visible = {
    x: (trim.x - texture.orig.width * sprite.anchor.x) * spriteScale,
    y: (trim.y - texture.orig.height * sprite.anchor.y) * spriteScale,
    width: trim.width * spriteScale,
    height: trim.height * spriteScale
  };
  const width = Math.max(visible.width + 4, 44 / screenPixelsPerNativePixel);
  const height = Math.max(visible.height + 4, 44 / screenPixelsPerNativePixel);
  return { spriteScale, visible, hitArea: {
    x: visible.x + (visible.width - width) / 2,
    y: visible.y + (visible.height - height) / 2, width, height
  } };
}
