import {projection as hm02Projection, viewportClip} from './hm02Projection.mjs';
export {viewportClip};

// This is deliberately NOT an arbitrary-azimuth camera schema. Exported UVs
// require this exact 52/45-degree basis; reject unsupported calibration.
export function createMapProjection(spec) {
  const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-5;
  const el=52*Math.PI/180,s=Math.sin(el),c=Math.cos(el),q=Math.SQRT1_2;
  const forward=[-c*q,-s,-c*q],up=[-s*q,c,-s*q],right=[q,0,-q];
  const vector=(a,b)=>Array.isArray(a)&&a.length===3&&a.every((v,i)=>near(v,b[i]));
  if(spec?.kind!=='BLENDER_LOCKED_ORTHOGRAPHIC'||!near(spec.elevationDegrees,52)
    ||spec.azimuthDegrees!==45||spec.nativePxPerUnit!==16||spec.worldPxPerNativePx!==2
    ||!vector(spec.cameraForwardGltf,forward)||!vector(spec.cameraUpGltf,up)
    ||!Array.isArray(spec.worldSize)||spec.worldSize.length!==2
    ||!Array.isArray(spec.nativeSize)||spec.nativeSize.length!==2
    ||!spec.worldSize.every((v,i)=>[2048,2880].includes(v)&&v===spec.nativeSize[i]*2)
    ||spec.worldSize[0]!==spec.worldSize[1]||spec.orthoScaleUnits!==spec.worldSize[1]/32)
    throw new Error('HUNT_THREE_UNVERIFIED_PROJECTION');
  const k=32;
  return Object.freeze({s,c,k,forward,right,up,eye:forward.map(v=>-v),unitsPerWorldPx:1/k,
    ground(x,y,height=0){return [(x+y/s)/(k*Math.SQRT2),height,(-x+y/s)/(k*Math.SQRT2)];},
    screen(point){return [k*point.reduce((a,v,i)=>a+v*right[i],0),-k*point.reduce((a,v,i)=>a+v*up[i],0)];},
    actorVertex({worldX,worldY,worldZ=0,groundHeight},dx,dy){
      if(![worldX,worldY,worldZ,groundHeight,dx,dy].every(Number.isFinite))throw new Error('HUNT_THREE_ACTOR_SUPPORT_REQUIRED');
      const base=this.ground(worldX,worldY,groundHeight);
      return [base[0]+right[0]*dx/k,base[1]+(worldZ-dy)/(k*c),base[2]+right[2]*dx/k];
    },
    viewport(view,width,height){
      const scale=view.transform.scale,rect=view.viewRect??view.camera,o=view.viewportOffset??{x:0,y:0};
      if(!(scale>0)||!Number.isFinite(scale))throw new Error('HUNT_THREE_INVALID_SCALE');
      return {center:this.ground(rect.left+(width/2-o.x)/scale,rect.top+(height/2-o.y)/scale),halfWidth:width/(2*scale*k),halfHeight:height/(2*scale*k)};
    }
  });
}
export function projectionForManifest(manifest){
  return manifest.schema==='HM02_THREE_PILOT.v1'?hm02Projection(manifest.projection):createMapProjection(manifest.projection);
}
