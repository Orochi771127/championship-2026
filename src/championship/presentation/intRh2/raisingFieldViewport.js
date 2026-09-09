/** Presentation transform only. Legacy habitat regions retain their identity
 * and normalized geometry; this does not assign residents to native modules.
 * Art, actor positions and drop targets share this fitted rectangle.
 */
export function raisingFieldViewport(field, viewport, padding = 12, cameraX = 0) {
  if (!(field?.worldWidthPx > 0 && field?.worldHeightPx > 0)) {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 };
  }
  // Portrait camera adaptation: a 256-native-pixel-wide window over the ranch,
  // instead of shrinking every facility and resident into a thumbnail overview.
  const nativeWindow = field.presentationMode === 'NATIVE_RANCH' && field.nativePixelWorldScale > 0;
  const fitWidth = nativeWindow ? Math.min(field.worldWidthPx,256*field.nativePixelWorldScale) : field.worldWidthPx;
  const scale = Math.min(Math.max(1, viewport.width - padding * 2) / fitWidth,
    Math.max(1, viewport.height - padding * 2) / field.worldHeightPx);
  const width = field.worldWidthPx * scale;
  const height = field.worldHeightPx * scale;
  const maxCameraX = Math.max(0,field.worldWidthPx - (viewport.width-padding*2)/scale);
  const x = nativeWindow ? padding - Math.min(maxCameraX,Math.max(0,cameraX))*scale : (viewport.width-width)/2;
  return { x, y: (viewport.height - height) / 2, width, height, scale };
}

export function raisingRegionBounds(region, viewport) {
  return { x: viewport.x + region.x * viewport.width, y: viewport.y + region.y * viewport.height,
    width: region.w * viewport.width, height: region.h * viewport.height };
}

export function raisingNativeToScreen(positionQ12,field,viewport,cameraX=0) {
  const fit=raisingFieldViewport(field,viewport,12,cameraX),unit=field?.nativePixelWorldScale;
  if(!(unit>0)||!positionQ12)return null;
  return {x:fit.x+positionQ12[0]/4096*unit*fit.scale,y:fit.y+positionQ12[1]/4096*unit*fit.scale};
}
export function raisingScreenToNative(point,field,viewport,cameraX=0) {
  const fit=raisingFieldViewport(field,viewport,12,cameraX),unit=field?.nativePixelWorldScale;
  if(!(unit>0))return null;
  return {x:(point.x-fit.x)/(unit*fit.scale),y:(point.y-fit.y)/(unit*fit.scale)};
}
