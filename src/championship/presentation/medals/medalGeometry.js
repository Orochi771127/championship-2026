import * as THREE from '../../../../node_modules/three/build/three.module.js';

// OWNER_APPROVED_ADAPTATION: authored backing, NOT a sculpted badge or original
// ROM model. Per-ID observed presentation profiles never change award rules.
export const MEDAL_METAL_STYLES=Object.freeze({
  copper:Object.freeze({color:0xb87542,metalness:.88,roughness:.3}),
  silver:Object.freeze({color:0xd1dbe7,metalness:.93,roughness:.23}),
  gold:Object.freeze({color:0xe6bc58,metalness:.9,roughness:.24}),
  paleBlueSilver:Object.freeze({color:0xc1e2f6,metalness:.82,roughness:.19,clearcoat:.6})
});
export function isMedalPresentationProfile(profile){return !!profile&&Object.hasOwn(MEDAL_METAL_STYLES,profile.material)&&['round','hex','free'].includes(profile.shape);}
function regularShape(sides,radius){const shape=new THREE.Shape();for(let i=0;i<sides;i++){const angle=Math.PI/2+i*Math.PI*2/sides,x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();return shape;}
export function createMedalGeometry({silhouette,presentationProfile}={}) {
  if(!isMedalPresentationProfile(presentationProfile))throw Error('An explicit medal presentation profile is required');
  const {shape:mode,material}=presentationProfile;
  if(mode==='free'&&(!silhouette?.ok||!silhouette.shapes?.length))throw Error('A readable bounded medal silhouette is required');
  const shapes=mode==='free'?silhouette.shapes.map(({outer,holes})=>{
    const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(...p)));
    for(const hole of holes)shape.holes.push(new THREE.Path(hole.map(p=>new THREE.Vector2(...p))));return shape;
  }):[regularShape(mode==='round'?64:6,1.035)];
  // A subpixel bevel follows free outlines AND cutouts. Never use a convex hull
  // or generic circle for the eleven observed free-outline medals.
  const geometry=new THREE.ExtrudeGeometry(shapes,{depth:.12,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:mode==='free'?.0015:.012,bevelThickness:.008,curveSegments:1});
  const vertices=geometry.getAttribute('position');
  // Extrusion cannot exceed the contour budget, even if upstream data changes.
  if(vertices.count>100000||!vertices.array.every(Number.isFinite)){geometry.dispose();throw Error('Medal mesh budget exceeded');}
  const edgeMaterial=new THREE.MeshPhysicalMaterial(MEDAL_METAL_STYLES[material]);
  const backMaterial=new THREE.MeshPhysicalMaterial({...MEDAL_METAL_STYLES[material],roughness:.38});
  const faceMaterial=new THREE.MeshBasicMaterial({transparent:true,side:THREE.FrontSide,depthWrite:false,toneMapped:false});
  const group=new THREE.Group();group.name='PROFILED_MEDAL_WITH_2D_FACE';
  const base=new THREE.Mesh(geometry,[backMaterial,edgeMaterial]);base.name='metal_base';base.position.z=-.06;group.add(base);
  const emblem=new THREE.Mesh(new THREE.PlaneGeometry(2.28,2.28),faceMaterial);emblem.name='flat_badge_face';emblem.position.z=.071;group.add(emblem);
  let disposed=false;
  const result={group,faceMaterial,
    fitFaceAspect(width,height){
      if(disposed)return;const valid=Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0,longest=valid?Math.max(width,height):1;
      emblem.scale.set(valid?width/longest:1,valid?height/longest:1,1);
    },
    getDiagnostics(){return {baseShape:mode==='free'?'SOURCE_ALPHA_SILHOUETTE':mode==='round'?'OBSERVED_ROUND_BACKING':'OBSERVED_HEX_BACKING',materialFinish:material,...(mode==='free'?silhouette.stats:{}),geometryVertices:geometry.getAttribute('position').count};},
    dispose(){if(disposed)return;disposed=true;geometry.dispose();emblem.geometry.dispose();backMaterial.dispose();edgeMaterial.dispose();faceMaterial.dispose();}
  };
  if(silhouette)result.fitFaceAspect(silhouette.width,silhouette.height);return Object.freeze(result);
}

/** Small authored studio light map, no network/env-model dependency. */
export function createMedalStudioTexture() {
  const width=64,height=32,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const top=1-y/(height-1),key=Math.exp(-((x-12)**2/22+(y-9)**2/35)),rim=Math.exp(-((x-49)**2/10+(y-13)**2/60));
    const light=Math.min(255,18+48*top+187*key+130*rim),i=(y*width+x)*4;
    data[i]=light;data[i+1]=light*.97;data[i+2]=light*.91;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}
