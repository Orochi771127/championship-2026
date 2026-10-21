// Bounded candidate: classify a complete authored border strip, never its center.
// Inputs must all be expressed in the UNWRAPPED placement-local XZ frame.
// 0.04 world unit (0.64 native px) accommodates verified CM07 strip half-width
// <=0.0275 and Draco quantization; it is not a proximity-based seam radius.
export const RANCH_BORDER_EXTENT_TOLERANCE = 0.04;
export function ranchBorderWithinSharedSegment(points, edge, epsilon = RANCH_BORDER_EXTENT_TOLERANCE) {
  if (!Array.isArray(points) || points.length < 2 || !edge?.a || !edge?.b) return false;
  const dx=edge.b.x-edge.a.x,dz=edge.b.z-edge.a.z,length=Math.hypot(dx,dz);
  if (!(length>epsilon*2) || !Number.isFinite(length)) return false;
  let lo=Infinity,hi=-Infinity;
  for(const p of points){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return false;
    const x=p.x-edge.a.x,z=p.z-edge.a.z;
    const along=(x*dx+z*dz)/length,across=Math.abs(x*dz-z*dx)/length;
    if(across>epsilon||along < -epsilon||along > length+epsilon)return false;
    lo=Math.min(lo,along);hi=Math.max(hi,along);
  }
  // Actual border must span the segment, not be a tiny decoration near a corner.
  return lo<=epsilon && hi>=length-epsilon;
}
export function ranchBorderWithinSharedSegments(points,edges){
  return edges.some(edge=>ranchBorderWithinSharedSegment(points,edge));
}
