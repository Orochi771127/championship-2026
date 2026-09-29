/** The whole number of screen pixels one original native pixel may take on
 * the ranch. Whole numbers keep every native pixel the same size on screen,
 * which is what keeps pixel art crisp while it pans. */
export const RAISING_MIN_NATIVE_SCREEN_PIXELS = 2;
export const RAISING_MAX_NATIVE_SCREEN_PIXELS = 6;

/** How much of the board stays in view at once, in native pixels: two and a
 * third of the 48-pixel board columns, so the cage a resident lives in is
 * still seen beside its neighbours however large the screen makes it. */
export const RAISING_MIN_VISIBLE_NATIVE_WIDTH = 112;

/**
 * Screen pixels per native pixel for the native ranch window (2026-09-29).
 *
 * The board is a wide, short strip (two cage rows) panned sideways. The old
 * rule kept two screen pixels on every screen and laid the strip on the floor
 * under a fixed readout band, so a phone showed half its height as empty
 * ground and a tablet two-thirds. This takes the largest whole scale that
 * fits the frame's height and still leaves enough of the board in view.
 */
export function raisingNativeScreenPixels(field, viewport, padding = 12) {
  const unit = field.nativePixelWorldScale;
  const nativeHeight = field.worldHeightPx / unit;
  const byHeight = Math.floor((viewport.height - padding * 2) / nativeHeight);
  const byWidth = Math.floor((viewport.width - padding * 2) / RAISING_MIN_VISIBLE_NATIVE_WIDTH);
  const whole = Math.min(RAISING_MAX_NATIVE_SCREEN_PIXELS, byHeight, byWidth);
  if (whole >= RAISING_MIN_NATIVE_SCREEN_PIXELS) return whole;
  // A frame too short for two whole pixels fits the height instead, as the
  // ranch always did, rather than hiding part of the board.
  return Math.min(RAISING_MIN_NATIVE_SCREEN_PIXELS, Math.max(1e-3, (viewport.height - padding * 2) / nativeHeight));
}

/** Presentation transform only. Legacy habitat regions retain their identity
 * and normalized geometry; this does not assign residents to native modules.
 * Art, actor positions and drop targets share this fitted rectangle.
 */
export function raisingFieldViewport(field, viewport, padding = 12, cameraX = 0) {
  if (!(field?.worldWidthPx > 0 && field?.worldHeightPx > 0)) {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 };
  }
  // The native ranch remains a sideways window over one continuous board,
  // centred in the frame's height. Nothing is reserved for a readout: cards
  // float over the margin and never move the board.
  const nativeWindow = field.presentationMode === 'NATIVE_RANCH' && field.nativePixelWorldScale > 0;
  const heightScale = Math.max(1, viewport.height - padding * 2) / field.worldHeightPx;
  const scale = nativeWindow
    ? raisingNativeScreenPixels(field, viewport, padding) / field.nativePixelWorldScale
    : Math.min(Math.max(1, viewport.width - padding * 2) / field.worldWidthPx, heightScale);
  const width = field.worldWidthPx * scale;
  const height = field.worldHeightPx * scale;
  const maxCameraX = Math.max(0,field.worldWidthPx - (viewport.width-padding*2)/scale);
  const scroll=field.wrapWidthPx ? wrapRaisingCamera(cameraX,field.wrapWidthPx) : Math.min(maxCameraX,Math.max(0,cameraX));
  const x = nativeWindow ? padding - scroll*scale : (viewport.width-width)/2;
  // Whole screen pixels for the board's top edge, so rows do not shimmer.
  const y = nativeWindow ? Math.round((viewport.height - height) / 2) : (viewport.height - height) / 2;
  return { x, y, width, height, scale };
}

export function wrapRaisingCamera(value,width){return ((value%width)+width)%width;}

// Touch presentation speed, not a change to actor movement or native timing.
export function raisingEdgeScroll(point,viewport,deltaMs){
  if(!point||point.y<0||point.y>viewport.height||point.x<0||point.x>viewport.width)return 0;
  const edge=Math.min(48,viewport.width/6);
  const strength=point.x<edge?-(edge-point.x)/edge:point.x>viewport.width-edge?(point.x-viewport.width+edge)/edge:0;
  return strength*180*Math.min(50,Math.max(0,deltaMs))/1000;
}

export function raisingRegionBounds(region, viewport) {
  return { x: viewport.x + region.x * viewport.width, y: viewport.y + region.y * viewport.height,
    width: region.w * viewport.width, height: region.h * viewport.height };
}

export function raisingNativeToScreen(positionQ12,field,viewport,cameraX=0) {
  const fit=raisingFieldViewport(field,viewport,12,cameraX),unit=field?.nativePixelWorldScale;
  if(!(unit>0)||!positionQ12)return null;
  let x=positionQ12[0]/4096*unit;
  if(field.wrapWidthPx){const camera=wrapRaisingCamera(cameraX,field.wrapWidthPx);
    const centre=camera+(viewport.width-24)/(2*fit.scale);
    x+=Math.round((centre-x)/field.wrapWidthPx)*field.wrapWidthPx;}
  return {x:fit.x+x*fit.scale,y:fit.y+positionQ12[1]/4096*unit*fit.scale};
}
export function raisingScreenToNative(point,field,viewport,cameraX=0) {
  const fit=raisingFieldViewport(field,viewport,12,cameraX),unit=field?.nativePixelWorldScale;
  if(!(unit>0))return null;
  const x=(point.x-fit.x)/(unit*fit.scale);
  return {x:field.wrapWidthPx?wrapRaisingCamera(x,field.wrapWidthPx/unit):x,y:(point.y-fit.y)/(unit*fit.scale)};
}
