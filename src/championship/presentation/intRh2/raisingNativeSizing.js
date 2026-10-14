import { raisingFieldViewport } from "./raisingFieldViewport.js";

// Owner 2026-10-10: fixed Raising presentation normalization for these three
// delivered original bodies. Every pose shares the same factor; native world
// coordinates, gameplay extents, Hunt and Battle presentation are unchanged.
export const RAISING_ORIGINAL_BODY_SCALE=Object.freeze({
  m518_blackwargreymon:0.6444,
  m529_metalgarurumon_va:0.3648,
  m541_dukemon:0.5948
});
// Owner 2026-10-12: fit each original egg into the verified native idle
// footprint (14 x 18). These are cell_000 alpha bounds in native units,
// not raster canvas dimensions. One affine transform is shared by all poses.
// See docs/reports/egg-native-sizing-2026-10-12/REPORT_ZH_TW.md.
const ORIGINAL_EGG_IDLE_BOUNDS=Object.freeze({
  e000_digitama:[-24.5,-45,24.5,.75],
  e001_digitama:[-27,-62.75,26.5,2.75],
  e002_digitama:[-23.75,-46.5,24.5,1],
  e003_digitama:[-20.75,-52.25,22.5,.5],
  e004_digitama:[-26.25,-55.25,32,.25],
  e005_digitama:[-28.5,-54,33,1],
  e006_digitama:[-22.75,-56.75,30.25,2.5],
  e007_digitama:[-26.75,-64.75,33.5,3.5]
});
export function raisingOriginalBodyScale(entityId,sizing){
  if(sizing?.evidence!=='COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY')return 1;
  const bounds=ORIGINAL_EGG_IDLE_BOUNDS[entityId];
  return bounds?Math.min(14/(bounds[2]-bounds[0]),18/(bounds[3]-bounds[1])):(RAISING_ORIGINAL_BODY_SCALE[entityId]??1);
}
export function raisingOriginalBodyOffset(entityId,sizing){
  if(sizing?.evidence!=='COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY')return null;
  const bounds=ORIGINAL_EGG_IDLE_BOUNDS[entityId];
  if(!bounds)return null;
  const scale=raisingOriginalBodyScale(entityId,sizing);
  // Native idle center=0, opaque bottom=1. Keep this offset through hatching;
  // per-frame recentering would erase the authored relative motion.
  return {x:-(bounds[0]+bounds[2])/2*scale,y:1-bounds[3]*scale};
}

// Accepted original egg idle contact bounds, measured from cell_000 pixels
// with alpha >= 128 (half opacity), in native units. Near-transparent glow is
// still drawn, but must not push the floor shadow away from the solid shell.
// This fixed rest footprint deliberately does not chase animated alpha bounds:
// hatch poses and native Z lift move the body, not its point on the ground.
const ORIGINAL_EGG_CONTACT_BOUNDS=Object.freeze({
  e000_digitama:[-23,-44.5,23.25,0],
  e001_digitama:[-22.75,-46,22.5,1],
  e002_digitama:[-22.75,-46,22.25,0],
  e003_digitama:[-19.75,-51.75,20,.25],
  e004_digitama:[-23.5,-53.5,23.25,-.5],
  e005_digitama:[-27,-53.75,30.25,0],
  e006_digitama:[-18.75,-54.75,27,.5],
  e007_digitama:[-23.75,-62.5,30.75,.75]
});
export function getRaisingEggContactShadow(entityId,sizing,flipX=false){
  const offset=raisingOriginalBodyOffset(entityId,sizing);
  const bounds=ORIGINAL_EGG_CONTACT_BOUNDS[entityId];
  if(!offset||!bounds)return null;
  const scale=raisingOriginalBodyScale(entityId,sizing);
  const width=(bounds[2]-bounds[0])*scale;
  return {x:((bounds[0]+bounds[2])/2*scale+offset.x)*(flipX?-1:1),
    y:bounds[3]*scale+offset.y,radiusX:width*.42,radiusY:Math.max(1,width*.13)};
}

/** Screen pixels per native pixel, shared by cage art and residents. */
export function getRaisingNativePixelScale(field, viewport, padding = 12) {
  const unit = field?.nativePixelWorldScale;
  if (!(Number.isFinite(unit) && unit > 0 && field.worldWidthPx > 0 && field.worldHeightPx > 0)) return null;
  return unit * raisingFieldViewport(field, viewport, padding).scale;
}

/** Verified per-cell alpha bounds take precedence over an untrimmed atlas
 * canvas. Jump height is deliberately absent: decoration stays on the floor. */
export function getRaisingNativeActorGeometry(sprite, sizing, screenPixelsPerNativePixel, {frameGeometry=null,displayScale=1,displayOffset=null,flipX=false,hitAreaCssScale=null}={}) {
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
  const offset=displayOffset?{...displayOffset}:{x:center*(1-displayScale),y:bottom*(1-displayScale)};
  visible={x:visible.x*displayScale+offset.x,y:visible.y*displayScale+offset.y,width:visible.width*displayScale,height:visible.height*displayScale};
  if(flipX){visible.x=-visible.x-visible.width;offset.x=-offset.x;}
  // Optional egg-only canvas-to-DOM conversion. Visual/native geometry above
  // is independent of the portrait frame's outer CSS transform and DPR.
  const cssX=Number.isFinite(hitAreaCssScale?.x)&&hitAreaCssScale.x>0?hitAreaCssScale.x:1;
  const cssY=Number.isFinite(hitAreaCssScale?.y)&&hitAreaCssScale.y>0?hitAreaCssScale.y:1;
  const width = Math.max(visible.width + 4, 44 / (screenPixelsPerNativePixel*cssX));
  const height = Math.max(visible.height + 4, 44 / (screenPixelsPerNativePixel*cssY));
  return { spriteScale:spriteScale*displayScale, offset, visible, hitArea: {
    x: visible.x + (visible.width - width) / 2,
    y: visible.y + (visible.height - height) / 2, width, height
  } };
}
