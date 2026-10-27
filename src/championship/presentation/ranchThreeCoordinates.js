// One invertible ground-plane mapping. Only translation/rigid orientation is
// applied to authored models; no hex deformation is part of this renderer.
export const RANCH_ELEVATION = 52 * Math.PI / 180;
export const RANCH_PIXELS_PER_UNIT = 16;
// Owner 2026-10-27 diorama look: the camera may look down at another pitch.
// The world (native lattice -> world, walk surfaces, collision) stays on the
// 52-degree layout above; only the view changes. On screen that is a vertical
// ground scale (sin pitch / sin 52) plus a different height lift (cos pitch).
// Native-equivalent picking divides the screen by that ground scale, so its
// height lift becomes 16 cos(pitch) / groundScaleY. At 52 both are unchanged.
export const RANCH_VIEW_PITCHES = Object.freeze([35, 40, 45, 52]);
// Owner 2026-10-27: 40 degrees is the ranch's camera; ?ranchPitch= still compares.
export const RANCH_DEFAULT_VIEW_PITCH = 40;
export function ranchViewProjection(pitchDeg = RANCH_DEFAULT_VIEW_PITCH) {
  const pitch = RANCH_VIEW_PITCHES.includes(Number(pitchDeg)) ? Number(pitchDeg) : RANCH_DEFAULT_VIEW_PITCH;
  const elevation = pitch === 52 ? RANCH_ELEVATION : pitch * Math.PI / 180;
  const groundScaleY = Math.sin(elevation) / Math.sin(RANCH_ELEVATION);
  const s = Math.sin(elevation), c = Math.cos(elevation);
  return Object.freeze({ pitch, elevation, groundScaleY,
    screenLift: 16 * c, lift: 16 * c / groundScaleY, cos: c, sin: s,
    up: Object.freeze([-s * Math.SQRT1_2, c, -s * Math.SQRT1_2]),
    direction: Object.freeze([c * Math.SQRT1_2, s, c * Math.SQRT1_2]) });
}
// The layout's own view (52 degrees): the identity for helpers given no view.
export const RANCH_LAYOUT_VIEW = ranchViewProjection(52);
export function ranchSpriteScreenQuad(sprite) {
  const local=sprite.visualBounds;
  const a=sprite.toGlobal({x:local.minX,y:local.minY}),b=sprite.toGlobal({x:local.maxX,y:local.maxY});
  return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)};
}
export function ranchSpriteUvs(u,flip) {
  return flip?[u.x1,u.y1,u.x0,u.y0,u.x2,u.y2,u.x3,u.y3]:[u.x0,u.y0,u.x1,u.y1,u.x3,u.y3,u.x2,u.y2];
}
export function ranchNativeToWorld(x, y, height = 0) {
  const k = 16 * Math.SQRT2, s = Math.sin(RANCH_ELEVATION);
  return { x: (x + y / s) / k, y: height, z: (-x + y / s) / k };
}
export function ranchWorldToNative({ x, y, z }) {
  return { x: (x - z) * 16 / Math.SQRT2,
    y: (x + z) * Math.sin(RANCH_ELEVATION) * 16 / Math.SQRT2 - y * Math.cos(RANCH_ELEVATION) * 16 };
}
export function ranchThreeField(manifest,plan,{pitch=RANCH_DEFAULT_VIEW_PITCH}={}) {
  if(!plan.productGrid||plan.fold)throw Error('RANCH_3D_PRODUCT_GRID_REQUIRED');
  const selected=plan.placements.map(p=>manifest.fields.find(f=>f.fieldId===p.fieldId));
  const unit=selected[0]?.nativePixelWorldScale;
  if(!(unit>0)||selected.some(f=>f?.nativePixelWorldScale!==unit))throw Error('RANCH_3D_NATIVE_UNITS_MISMATCH');
  return Object.freeze({fieldId:'art:cage:three-20261021:composite',worldWidthPx:plan.productGrid.worldWidthNative*unit,
    worldHeightPx:plan.productGrid.worldHeightNative*unit,wrapWidthPx:plan.wrapWidthPx,
    nativePixelWorldScale:unit,productGrid:plan.productGrid,placements:plan.placements,
    residentViewport:plan.residentViewport,placementEvidence:plan.placementEvidence,presentationMode:plan.mode,
    composite:true,tileFieldIds:plan.placements.map(p=>p.fieldId),view:ranchViewProjection(pitch)});
}
export function ranchSurfaceHeight(x,y,triangles) {
  let height=0;
  for(const [a,b,c] of triangles??[]){
    const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(d)<1e-9)continue;
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d;
    const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,w=1-u-v;
    if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5)height=Math.max(height,u*a[2]+v*b[2]+w*c[2]);
  }
  return height;
}
export function ranchPickWalkSurface(x,screenY,triangles,lift=RANCH_LAYOUT_VIEW.lift) {
  let height=0;
  for(const triangle of triangles??[]){
    const [a,b,c]=triangle.map(p=>[p[0],p[1]-p[2]*lift,p[2]]);
    const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(d)<1e-9)continue;
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(screenY-c[1]))/d;
    const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(screenY-c[1]))/d,w=1-u-v;
    if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5)height=Math.max(height,u*a[2]+v*b[2]+w*c[2]);
  }
  return {x,y:screenY+height*lift,height};
}
