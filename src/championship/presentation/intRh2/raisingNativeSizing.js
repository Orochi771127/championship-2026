import { raisingFieldViewport } from "./raisingFieldViewport.js";

// Owner 2026-10-10: fixed Raising presentation normalization for these three
// delivered original bodies. Every pose shares the same factor; native world
// coordinates, gameplay extents, Hunt and Battle presentation are unchanged.
export const RAISING_ORIGINAL_BODY_SCALE=Object.freeze({
  m518_blackwargreymon:0.6444,
  m529_metalgarurumon_va:0.3648,
  m541_dukemon:0.5948
});
export function raisingOriginalBodyScale(entityId,sizing){
  return sizing?.evidence==='COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'?(RAISING_ORIGINAL_BODY_SCALE[entityId]??1):1;
}

/** Screen pixels per native pixel, shared by cage art and residents. */
export function getRaisingNativePixelScale(field, viewport, padding = 12) {
  const unit = field?.nativePixelWorldScale;
  if (!(Number.isFinite(unit) && unit > 0 && field.worldWidthPx > 0 && field.worldHeightPx > 0)) return null;
  return unit * raisingFieldViewport(field, viewport, padding).scale;
}

/** Verified per-cell alpha bounds take precedence over an untrimmed atlas
 * canvas. Jump height is deliberately absent: decoration stays on the floor. */
export function getRaisingNativeActorGeometry(sprite, sizing, screenPixelsPerNativePixel, {frameGeometry=null,displayScale=1,flipX=false}={}) {
  const packedScale = sizing?.packedPixelsPerNativePixel;
  const texture = sprite?.texture;
  const resolution = texture?.source?.resolution;
  if (!(packedScale > 0 && resolution > 0 && screenPixelsPerNativePixel > 0 && texture.orig)) return null;
  const spriteScale = resolution / packedScale;
  const trim = texture.trim ?? { x: 0, y: 0, width: texture.orig.width, height: texture.orig.height };
  let visible = {
    x: (trim.x - texture.orig.width * sprite.anchor.x) * spriteScale,
    y: (trim.y - texture.orig.height * sprite.anchor.y) * spriteScale,
    width: trim.width * spriteScale,
    height: trim.height * spriteScale
  };
  const bounds=frameGeometry?.nativeBounds;
  if(Array.isArray(bounds)&&bounds.length===4&&bounds.every(Number.isFinite)&&bounds[2]>bounds[0]&&bounds[3]>bounds[1]){
    visible={x:bounds[0],y:bounds[1],width:bounds[2]-bounds[0],height:bounds[3]-bounds[1]};
  }
  const center=visible.x+visible.width/2,bottom=visible.y+visible.height;
  const offset={x:center*(1-displayScale),y:bottom*(1-displayScale)};
  visible={x:visible.x*displayScale+offset.x,y:visible.y*displayScale+offset.y,width:visible.width*displayScale,height:visible.height*displayScale};
  if(flipX){visible.x=-visible.x-visible.width;offset.x=-offset.x;}
  const width = Math.max(visible.width + 4, 44 / screenPixelsPerNativePixel);
  const height = Math.max(visible.height + 4, 44 / screenPixelsPerNativePixel);
  return { spriteScale:spriteScale*displayScale, offset, visible, hitArea: {
    x: visible.x + (visible.width - width) / 2,
    y: visible.y + (visible.height - height) / 2, width, height
  } };
}
