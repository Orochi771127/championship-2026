// Preserve the original PlaneGeometry diagonal and its affine UV interpolation.
// The ceiling partitions shader responsibility; it never supplies floor authority.
export function partitionSpriteQuad(uvs,cut) {
  if(uvs.length!==8||!Number.isFinite(cut)||![...uvs].every(Number.isFinite))throw Error('INVALID_SPRITE_PARTITION');
  const points=[[-.5,.5,uvs[0],uvs[1]],[.5,.5,uvs[2],uvs[3]],[-.5,-.5,uvs[4],uvs[5]],[.5,-.5,uvs[6],uvs[7]]];
  // Round each shared intersection once, then reuse exact coordinates on both sides.
  const intersections=new Map();
  function cross(a,b){
    const key=[a,b].map(v=>v.join(',')).sort().join('|');
    if(!intersections.has(key)){
      const t=(cut-a[1])/(b[1]-a[1]);
      intersections.set(key,[a[0]+t*(b[0]-a[0]),cut,a[2]+t*(b[2]-a[2]),a[3]+t*(b[3]-a[3])]);
    }
    return intersections.get(key);
  }
  function clip(poly,upper){
    const inside=v=>upper?v[1]>=cut:v[1]<=cut,out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ai=inside(a),bi=inside(b);
      if(ai)out.push(a);if(ai!==bi)out.push(cross(a,b));
    }
    return out;
  }
  function emit(polys){
    const position=[],uv=[];
    for(const p of polys)for(let i=1;i+1<p.length;i++){
      const a=p[0],b=p[i],c=p[i+1];
      if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])===0)continue;
      for(const v of [a,b,c]){position.push(v[0],v[1],0);uv.push(v[2],v[3]);}
    }
    return {position:new Float32Array(position),uv:new Float32Array(uv)};
  }
  const triangles=[[points[0],points[2],points[1]],[points[2],points[3],points[1]]];
  return {upper:emit(triangles.map(t=>clip(t,true))),lower:emit(triangles.map(t=>clip(t,false)))};
}
