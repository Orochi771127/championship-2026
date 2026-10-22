// Review-only actor depth adapter; not activated in production.
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
export function installFlatGroundDepthCandidate(material,{THREE,groundHeight,elevationDegrees=55,eyeDirection=null,depthBias=1e-6}){
  if(!Number.isFinite(groundHeight)||(!eyeDirection&&elevationDegrees!==55))throw new Error('EXACT_FLAT_SUPPORT_REQUIRED');
  const angle=elevationDegrees*Math.PI/180;
  const eye=eyeDirection??[0,Math.sin(angle),Math.cos(angle)];
  if(eye.length!==3||!eye.every(Number.isFinite)||!(eye[1]>0))throw new Error('EXACT_CAMERA_EYE_REQUIRED');
  material.onBeforeCompile=shader=>{
    shader.uniforms.hmGroundHeight={value:groundHeight};
    shader.uniforms.hmEyeDirection={value:new THREE.Vector3(...eye)};
    shader.uniforms.hmDepthBias={value:depthBias};
    shader.vertexShader='uniform float hmGroundHeight;\nuniform vec3 hmEyeDirection;\nvarying float hmGroundDepth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 hmWorld = modelMatrix * vec4(transformed, 1.0);
      vec3 hmGround = hmWorld.xyz + hmEyeDirection * ((hmGroundHeight-hmWorld.y)/hmEyeDirection.y);
      vec4 hmGroundClip = projectionMatrix * viewMatrix * vec4(hmGround,1.0);
      hmGroundDepth = (hmGroundClip.z/hmGroundClip.w)*0.5+0.5;
    `);
    shader.fragmentShader='uniform float hmDepthBias;\nvarying float hmGroundDepth;\n'+shader.fragmentShader;
    // Native Pixi cave opacity and source-edge alpha must remain continuous.
    // Three alphaTest multiplies the texture alpha by material.opacity; .1
    // would erase the whole creature at passageAlpha .05. Discard ONLY exact
    // zero after map/alpha processing, so transparent holes do not write depth.
    const alphaHook='#include <alphatest_fragment>';
    if(!shader.fragmentShader.includes(alphaHook))throw new Error('HM02_NATIVE_ALPHA_SHADER_HOOK_MISSING');
    shader.fragmentShader=shader.fragmentShader.replace(alphaHook,'if ( diffuseColor.a <= 0.0 ) discard;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
      // Preserve upper native depth; only rescue fragments behind support.
      // Scenery closer than this depth continues to occlude in the same buffer.
      gl_FragDepth = min(gl_FragCoord.z, hmGroundDepth-hmDepthBias);
    `);
  };
  material.customProgramCacheKey=()=>`hunt-flat-ground-depth-v2-native-alpha-zero-${groundHeight}-${eye.join(',')}`;
  material.needsUpdate=true;
}
