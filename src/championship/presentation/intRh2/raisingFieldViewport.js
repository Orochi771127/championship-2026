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
 * Room held above the native board for residents' bodies (2026-10-05).
 *
 * Residents are drawn from their feet. The tallest main-side body in the
 * shipped character geometry rises 77 native pixels above its origin
 * (m503 and m518; tests recompute this from the geometry table). Feet may also
 * stand up to 7 native pixels above the board's top edge: the original tests
 * terrain with a signed divide that truncates toward zero (OVL18
 * 0x0211208C..0x021120B4, the same idiom at 0x02111AB4), so -7..-1 reads as
 * row 0. That walk rule is kept; the frame makes room for it instead. Before
 * this, only the centring margin sat above the board and the frame edge cut
 * tall bodies off under the status bar.
 */
export const RAISING_TALLEST_BODY_NATIVE = 77;
export const RAISING_TOP_EDGE_FOOT_OVERHANG_NATIVE = 7;
export const RAISING_TOP_HEADROOM_NATIVE = RAISING_TALLEST_BODY_NATIVE + RAISING_TOP_EDGE_FOOT_OVERHANG_NATIVE;

/**
 * Screen pixels per native pixel for the native ranch window.
 *
 * The board is a wide, short strip (two cage rows) panned sideways. This takes
 * the largest whole scale at which the board and the headroom above it both
 * fit the frame's height, and still leaves enough of the board in view
 * (2026-10-05; until then only the board was fitted, which on a phone left
 * no room for tall bodies). A frame that cannot hold both at two whole pixels
 * keeps the board at two and scrolls vertically over the difference rather
 * than blurring the art with a fractional scale.
 */
export function raisingNativeScreenPixels(field, viewport, padding = 12) {
  const unit = field.nativePixelWorldScale;
  const nativeHeight = field.worldHeightPx / unit;
  const byWidth = Math.floor((viewport.width - padding * 2) / RAISING_MIN_VISIBLE_NATIVE_WIDTH);
  // The headroom stands in for the top padding: bodies rise into it.
  const byHeight = Math.floor((viewport.height - padding) / (nativeHeight + RAISING_TOP_HEADROOM_NATIVE));
  const whole = Math.min(RAISING_MAX_NATIVE_SCREEN_PIXELS, byHeight, byWidth);
  if (whole >= RAISING_MIN_NATIVE_SCREEN_PIXELS) return whole;
  const boardOnly = Math.min(byWidth, Math.floor((viewport.height - padding * 2) / nativeHeight));
  if (boardOnly >= RAISING_MIN_NATIVE_SCREEN_PIXELS) return RAISING_MIN_NATIVE_SCREEN_PIXELS;
  // A frame too short for two whole pixels fits the height instead, as the
  // ranch always did, rather than hiding part of the board.
  return Math.min(RAISING_MIN_NATIVE_SCREEN_PIXELS, Math.max(1e-3, (viewport.height - padding * 2) / nativeHeight));
}

/**
 * Where the native board's top edge sits, and how far the frame may scroll.
 *
 * When the headroom and the board fit, the pair is centred together. When
 * they do not, the whole board is shown resting on the bottom padding and
 * `viewport.scrollY` (screen pixels, clamped to `scrollMaxY`) lowers it to
 * reveal the headroom. Art, residents, shadows and input all read this one
 * placement, so nothing is moved on its own.
 */
function nativeBoardPlacement(field, viewport, padding, scale) {
  // A folded ring (ranch expansion prototype) stacks its second band below the
  // first; the scale stays the first band's, and the frame scrolls over both.
  const height = (field.fold ? field.fold.bandOffsetPx + field.worldHeightPx : field.worldHeightPx) * scale;
  const headroom = RAISING_TOP_HEADROOM_NATIVE * field.nativePixelWorldScale * scale;
  const available = viewport.height - padding;
  if (headroom + height <= available) {
    return { y: Math.round((available - headroom - height) / 2 + headroom), scrollMaxY: 0, scrollY: 0 };
  }
  const scrollMaxY = headroom + height - available;
  const requested = Number(viewport.scrollY);
  const scrollY = Math.min(scrollMaxY, Math.max(0, Number.isFinite(requested) ? requested : 0));
  return { y: Math.round(available - height + scrollY), scrollMaxY, scrollY };
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
  // centred with its headroom in the frame's height. Nothing is reserved for a
  // readout: cards float over the margin and never move the board.
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
  if (!nativeWindow) return { x, y: (viewport.height - height) / 2, width, height, scale };
  // Whole screen pixels for the board's top edge, so rows do not shimmer.
  const { y, scrollMaxY, scrollY } = nativeBoardPlacement(field, viewport, padding, scale);
  return { x, y, width, height, scale, scrollY, scrollMaxY };
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

/**
 * Which band of a folded ring a ring x (world px) shows in, and where.
 * Band 0 is ring [0, splitPx) and band 1 is [splitPx, ringPx), drawn
 * bandOffsetPx lower and shifted left by splitPx. Both share the camera.
 */
export function raisingFoldBand(field,worldX){
  const fold=field?.fold;if(!fold)return {band:0,x:worldX,yOffset:0};
  const x=wrapRaisingCamera(worldX,fold.ringPx);
  return x>=fold.splitPx?{band:1,x:x-fold.splitPx,yOffset:fold.bandOffsetPx}:{band:0,x,yOffset:0};
}

/**
 * Which band a point belongs to where a folded ring's bands meet (native px,
 * band 0's frame). The annex band is drawn as the honeycomb's next two rows,
 * so its first row meets band 0's lower row tooth for tooth; the nearer cell
 * centre decides. Single-cell fields are 112 native px tall and 96 wide; field
 * tops sit 88 apart (band 0's lower row at 64), columns 96 apart, and the lower
 * row is offset by half a column. Columns past the annex have nothing below.
 */
export function raisingFoldPointBand(nx,ny,fold,unit,bandHeightPx){
  const offset=fold.bandOffsetPx/unit,cap=fold.capPx/unit,annexWidth=fold.annexWidthPx/unit;
  if(nx<0||nx>=annexWidth||ny<offset-cap)return 0;
  if(ny>=bandHeightPx/unit)return 1;
  const lower={x:Math.round((nx-96)/96)*96+96,y:64+56};
  const column=Math.min(Math.max(Math.round((nx-48)/96),0),Math.floor(annexWidth/96)-1);
  const annex={x:column*96+48,y:offset-cap+56};
  return (nx-lower.x)**2+(ny-lower.y)**2<=(nx-annex.x)**2+(ny-annex.y)**2?0:1;
}

export function raisingNativeToScreen(positionQ12,field,viewport,cameraX=0) {
  const fit=raisingFieldViewport(field,viewport,12,cameraX),unit=field?.nativePixelWorldScale;
  if(!(unit>0)||!positionQ12)return null;
  if(field.fold){const band=raisingFoldBand(field,positionQ12[0]/4096*unit);
    return {x:fit.x+band.x*fit.scale,y:fit.y+(positionQ12[1]/4096*unit+band.yOffset)*fit.scale,band:band.band};}
  let x=positionQ12[0]/4096*unit;
  if(field.wrapWidthPx){const camera=wrapRaisingCamera(cameraX,field.wrapWidthPx);
    const centre=camera+(viewport.width-24)/(2*fit.scale);
    x+=Math.round((centre-x)/field.wrapWidthPx)*field.wrapWidthPx;}
  return {x:fit.x+x*fit.scale,y:fit.y+positionQ12[1]/4096*unit*fit.scale};
}
export function raisingScreenToNative(point,field,viewport,cameraX=0) {
  const fit=raisingFieldViewport(field,viewport,12,cameraX),unit=field?.nativePixelWorldScale;
  if(!(unit>0))return null;
  if(field.fold){
    const fold=field.fold,nx=(point.x-fit.x)/(unit*fit.scale),ny=(point.y-fit.y)/(unit*fit.scale);
    const second=raisingFoldPointBand(nx,ny,fold,unit,field.worldHeightPx)===1;
    return {x:second?fold.splitPx/unit+nx:nx,y:second?ny-fold.bandOffsetPx/unit:ny,band:second?1:0};
  }
  const x=(point.x-fit.x)/(unit*fit.scale);
  return {x:field.wrapWidthPx?wrapRaisingCamera(x,field.wrapWidthPx/unit):x,y:(point.y-fit.y)/(unit*fit.scale)};
}
