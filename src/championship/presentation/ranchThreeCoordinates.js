// One invertible ground-plane mapping. Only translation/rigid orientation is
// applied to authored models; no hex deformation is part of this renderer.
export const RANCH_ELEVATION = 52 * Math.PI / 180;
export const RANCH_PIXELS_PER_UNIT = 16;
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
export function ranchThreeField(manifest,plan) {
  if(!plan.productGrid||plan.fold)throw Error('RANCH_3D_PRODUCT_GRID_REQUIRED');
  const selected=plan.placements.map(p=>manifest.fields.find(f=>f.fieldId===p.fieldId));
  const unit=selected[0]?.nativePixelWorldScale;
  if(!(unit>0)||selected.some(f=>f?.nativePixelWorldScale!==unit))throw Error('RANCH_3D_NATIVE_UNITS_MISMATCH');
  return Object.freeze({fieldId:'art:cage:three-20261021:composite',worldWidthPx:plan.productGrid.worldWidthNative*unit,
    worldHeightPx:plan.productGrid.worldHeightNative*unit,wrapWidthPx:plan.wrapWidthPx,
    nativePixelWorldScale:unit,productGrid:plan.productGrid,placements:plan.placements,
    residentViewport:plan.residentViewport,placementEvidence:plan.placementEvidence,presentationMode:plan.mode,
    composite:true,tileFieldIds:plan.placements.map(p=>p.fieldId)});
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
export function ranchPickWalkSurface(x,screenY,triangles) {
  let height=0;const lift=16*Math.cos(RANCH_ELEVATION);
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
