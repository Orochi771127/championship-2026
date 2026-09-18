/** Screen pixels kept clear along the top of the frame for the floating
 * readout. A fixed band, not a share of the leftover: the readout does not
 * grow with the ranch. */
export const RAISING_READOUT_BAND_PX = 96;

/** The chunkiest one native pixel is allowed to get on screen. The art is
 * already 4x, so this is twice its own resolution; past that a desktop frame
 * would show less than a cage. */
export const RAISING_MAX_NATIVE_SCREEN_PIXELS = 8;

/** Presentation transform only. Legacy habitat regions retain their identity
 * and normalized geometry; this does not assign residents to native modules.
 * Art, actor positions and drop targets share this fitted rectangle.
 */
export function raisingFieldViewport(field, viewport, padding = 12, cameraX = 0) {
  if (!(field?.worldWidthPx > 0 && field?.worldHeightPx > 0)) {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 };
  }
  // Portrait camera adaptation: a window over the ranch, rather than shrinking
  // every facility and resident into a thumbnail overview. Owner 2026-09-16:
  // the window fills the frame's height and the player swipes sideways, so the
  // habitat no longer leaves empty bands above and below itself. The ranch is
  // always wider than the frame, so filling the height leaves no gap at all.
  //
  // Owner 2026-09-18 chose that literally, over keeping the old width-derived
  // zoom: the ranch is enlarged until it reaches the readout band, and it is
  // laid on the floor of the frame so the one strip that is left is the sky
  // above it. The previous rule reserved a headroom that grew with the art and
  // then split the slack top and bottom, which left the ranch hovering in the
  // middle of a mostly empty frame. Seeing fewer cages at once is the trade;
  // the board wraps, so sideways is always available.
  const nativeWindow = field.presentationMode === 'NATIVE_RANCH' && field.nativePixelWorldScale > 0;
  const headroom = nativeWindow && field.wrapWidthPx ? RAISING_READOUT_BAND_PX : 0;
  const heightScale = Math.max(1, viewport.height - padding * 2 - headroom) / field.worldHeightPx;
  const scale = nativeWindow
    ? Math.min(heightScale, RAISING_MAX_NATIVE_SCREEN_PIXELS / field.nativePixelWorldScale)
    : Math.min(Math.max(1, viewport.width - padding * 2) / field.worldWidthPx, heightScale);
  const width = field.worldWidthPx * scale;
  const height = field.worldHeightPx * scale;
  const maxCameraX = Math.max(0,field.worldWidthPx - (viewport.width-padding*2)/scale);
  const scroll=field.wrapWidthPx ? wrapRaisingCamera(cameraX,field.wrapWidthPx) : Math.min(maxCameraX,Math.max(0,cameraX));
  const x = nativeWindow ? padding - scroll*scale : (viewport.width-width)/2;
  const y = nativeWindow ? viewport.height - padding - height : (viewport.height - height) / 2;
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
