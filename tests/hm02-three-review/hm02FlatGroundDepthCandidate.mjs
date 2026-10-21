// ALTERNATIVE isolated harness candidate. NOT wired into the live adapter.
// No species/per-frame anatomical annotations; root/native origin unchanged.
// Only valid over a VERIFIED flat support region. Roads/caves need exact region
// height and transition QA; never treat collision terrain as mesh support height.
export function cameraFacingVertex(map,{worldX,worldY,worldZ=0,groundHeight},dx,dy){
  const root=map.ground(worldX,worldY,groundHeight),up=(-dy+worldZ)/map.k;
  return [root[0]+dx/map.k,root[1]+map.c*up,root[2]-map.s*up];
}
export function flatGroundRayPoint(map,point,height){
  const t=(height-point[1])/map.s;
  return [point[0],height,point[2]+map.c*t];
}
export function installFlatGroundDepthCandidate(material,{THREE,groundHeight,elevationDegrees=55,depthBias=1e-6}){
  if(!Number.isFinite(groundHeight)||elevationDegrees!==55)throw new Error('EXACT_FLAT_SUPPORT_REQUIRED');
  const angle=elevationDegrees*Math.PI/180;
  material.onBeforeCompile=shader=>{
    shader.uniforms.hmGroundHeight={value:groundHeight};
    shader.uniforms.hmEyeDirection={value:new THREE.Vector3(0,Math.sin(angle),Math.cos(angle))};
    shader.uniforms.hmDepthBias={value:depthBias};
    shader.vertexShader='uniform float hmGroundHeight;\nuniform vec3 hmEyeDirection;\nvarying float hmGroundDepth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 hmWorld = modelMatrix * vec4(transformed, 1.0);
      vec3 hmGround = hmWorld.xyz + hmEyeDirection * ((hmGroundHeight-hmWorld.y)/hmEyeDirection.y);
      vec4 hmGroundClip = projectionMatrix * viewMatrix * vec4(hmGround,1.0);
      hmGroundDepth = (hmGroundClip.z/hmGroundClip.w)*0.5+0.5;
    `);
    shader.fragmentShader='uniform float hmDepthBias;\nvarying float hmGroundDepth;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
      // Preserve upper native depth; only rescue fragments behind support.
      // Scenery closer than this depth continues to occlude in the same buffer.
      gl_FragDepth = min(gl_FragCoord.z, hmGroundDepth-hmDepthBias);
    `);
  };
  material.customProgramCacheKey=()=>`hm02-flat-ground-depth-v1-${groundHeight}`;
  material.needsUpdate=true;
}
