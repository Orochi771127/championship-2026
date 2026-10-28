import * as THREE from '../../../node_modules/three/build/three.module.js';
import {RANCH_LAYOUT_VIEW} from './ranchThreeCoordinates.js';
import {ranchShadowScreenEllipses,ranchShadowWorldPoint} from './ranchGroundShadows.js';

// Owner 2026-10-28: the lock-on ring is a decal on the ground, in the SAME
// depth buffer as the alpha-cutout actor billboards. Actors are opaque and draw
// first, so the ring's far half is hidden behind the body and nothing of it is
// ever drawn over a face. Centre = the contact shadow's centre (the foot), size
// follows the body, and the 40° camera foreshortens the circle by itself.
export const RANCH_SELECTION_RING=Object.freeze({
  // Ring radius as a multiple of the contact shadow's screen half-width.
  radiusScale:1.15,
  // Above the contact shadow (+.006), below the actor support depth (+.015).
  lift:.009,
  // Radians per second for the outer scale ring; the inner ring turns back.
  spin:.55,
  // Height of the back-half glow wall, as a multiple of the radius.
  glowHeight:.42,
  renderOrder:2
});

const RING_VERTEX='varying vec2 vRingUv; void main(){vRingUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
// Soft floor glow, a bevelled scale ring with 24 ticks (every third long) and a
// dashed inner ring that turns the other way. Alpha only, so the colour stays
// the interface mint on any floor.
const RING_FRAGMENT=`varying vec2 vRingUv; uniform float uTime; uniform float uOpacity; uniform vec3 uColor;
  float band(float r,float at,float width){float e=max(fwidth(r),0.0008);return 1.0-smoothstep(width-e,width+e,abs(r-at));}
  void main(){
    vec2 p=(vRingUv-0.5)*2.0;float r=length(p);if(r>1.0)discard;
    float a=atan(p.y,p.x)/6.2831853+0.5;
    float glow=0.20*(1.0-smoothstep(0.0,0.92,r));
    float bevel=band(r,0.84,0.055);float core=band(r,0.84,0.012);
    float isLong=1.0-step(0.5,mod(floor(a*24.0),3.0));
    float tick=step(fract(a*24.0),0.42)*band(r,mix(0.955,0.94,isLong),mix(0.024,0.044,isLong));
    float inner=band(r,0.62,0.016)*step(0.5,fract((a+uTime*0.18)*16.0));
    float alpha=max(max(glow,bevel*0.62),max(tick*0.9,inner*0.7));
    vec3 color=mix(uColor,vec3(1.0),core*0.85+tick*isLong*0.35);
    alpha=max(alpha,core*0.95)*uOpacity;if(alpha<=0.004)discard;
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }`;
// The upward glow is drawn only on the half of the wall away from the camera,
// so it rises behind the partner and is hidden where the body covers it.
const GLOW_VERTEX=`varying float vGlowHeight; varying vec2 vGlowSide;
  void main(){vGlowHeight=uv.y;vGlowSide=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const GLOW_FRAGMENT=`varying float vGlowHeight; varying vec2 vGlowSide; uniform vec2 uTowardCamera; uniform float uOpacity; uniform vec3 uColor;
  void main(){if(dot(vGlowSide,uTowardCamera)>0.0)discard;
    float alpha=0.32*(1.0-vGlowHeight)*(1.0-vGlowHeight)*uOpacity;if(alpha<=0.004)discard;
    gl_FragColor=vec4(uColor,alpha);
    #include <colorspace_fragment>
  }`;

export function ranchSelectionRingPlacement(entry,bounds,pixelScale,view=RANCH_LAYOUT_VIEW){
  const ellipses=entry?.shadow&&entry.groundShadowEllipses?.length?ranchShadowScreenEllipses(entry.shadow,entry.groundShadowEllipses):[];
  if(!ellipses.length||!(pixelScale>0))return null;
  const contact=ellipses[0],height=(entry.root?.threeGroundHeight??0)+RANCH_SELECTION_RING.lift;
  const center=ranchShadowWorldPoint({x:contact.x,y:contact.y},bounds,pixelScale,height,view);
  // A horizontal screen offset is a native offset along the ground's right
  // axis; 16 native pixels make one world unit there.
  const radius=Math.max(.35,contact.rx*RANCH_SELECTION_RING.radiusScale/pixelScale/16);
  return Object.freeze({center:Object.freeze({x:center.x,y:center.y,z:center.z}),radius,screen:Object.freeze({x:contact.x,y:contact.y,rx:contact.rx*RANCH_SELECTION_RING.radiusScale})});
}

export function createRanchSelectionRing(scene,{color=0x2fd6b4,view=RANCH_LAYOUT_VIEW}={}){
  // One geometry and one material per layer for every selected partner.
  const ringGeometry=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
  const glowGeometry=new THREE.CylinderGeometry(1,1,1,40,1,true).translate(0,.5,0);
  const tint=new THREE.Color(color);
  const ringMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{uTime:{value:0},uOpacity:{value:1},uColor:{value:tint}},vertexShader:RING_VERTEX,fragmentShader:RING_FRAGMENT});
  const toward=new THREE.Vector2(view.direction?.[0]??Math.SQRT1_2,view.direction?.[2]??Math.SQRT1_2).normalize();
  const glowMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    blending:THREE.AdditiveBlending,uniforms:{uTowardCamera:{value:toward},uOpacity:{value:1},uColor:{value:tint}},vertexShader:GLOW_VERTEX,fragmentShader:GLOW_FRAGMENT});
  const items=new Map();let time=0;
  function release(item){
    if(!item.selection.destroyed)item.selection.renderable=true;
    scene.remove(item.ring,item.glow);
  }
  function reset(){for(const item of items.values()){item.seen=false;item.ring.visible=false;item.glow.visible=false;if(!item.selection.destroyed)item.selection.renderable=true;}}
  function sync(key,entry,bounds,pixelScale,actorTransferred,syncView=view){
    const selection=entry?.selection;
    if(!actorTransferred||!selection?.visible||!entry.root?.visible)return null;
    const placement=ranchSelectionRingPlacement(entry,bounds,pixelScale,syncView);
    if(!placement)return null;
    let item=items.get(key);
    if(item&&item.selection!==selection){release(item);items.delete(key);item=null;}
    if(!item){
      const ring=new THREE.Mesh(ringGeometry,ringMaterial),glow=new THREE.Mesh(glowGeometry,glowMaterial);
      for(const mesh of [ring,glow]){mesh.frustumCulled=false;mesh.renderOrder=RANCH_SELECTION_RING.renderOrder;mesh.name='ranch-selection-ring';}
      scene.add(ring,glow);item={ring,glow,selection};items.set(key,item);
    }
    const {center,radius}=placement;
    item.ring.position.set(center.x,center.y,center.z);item.ring.scale.set(radius,1,radius);item.ring.rotation.y=time*RANCH_SELECTION_RING.spin;
    item.glow.position.set(center.x,center.y,center.z);item.glow.scale.set(radius*.86,radius*RANCH_SELECTION_RING.glowHeight,radius*.86);
    item.ring.visible=true;item.glow.visible=true;item.seen=true;item.placement=placement;
    // The flat Pixi ring would sit on the canvas above the 3D billboard.
    selection.renderable=false;
    return placement;
  }
  function animate(deltaMS,{still=false}={}){
    if(still)return;
    time+=Math.min(50,Math.max(0,deltaMS))/1000;ringMaterial.uniforms.uTime.value=time;
  }
  function prune(){for(const [key,item] of items)if(!item.seen){release(item);items.delete(key);}}
  function dispose(){for(const item of items.values())release(item);items.clear();ringGeometry.dispose();glowGeometry.dispose();ringMaterial.dispose();glowMaterial.dispose();}
  function diagnostics(){return [...items].filter(([,item])=>item.seen).map(([key,item])=>({key,radius:item.placement.radius,
    center:item.placement.center,screen:item.placement.screen,renderOrder:item.ring.renderOrder,depthTest:ringMaterial.depthTest,depthWrite:ringMaterial.depthWrite}));}
  return {reset,sync,animate,prune,dispose,diagnostics};
}

// Cyber Gachapon metal bloodline (OWNER_APPROVED_ADAPTATION 2026-10-29): a
// partner inscribed with a metal keeps a ground halo in that metal's colour
// whether or not it is selected -- a wider band with a light that flows round it.
const BLOODLINE_FRAGMENT=`varying vec2 vRingUv; uniform float uTime; uniform vec3 uColor;
  float band(float r,float at,float width){float e=max(fwidth(r),0.0008);return 1.0-smoothstep(width-e,width+e,abs(r-at));}
  void main(){
    vec2 p=(vRingUv-0.5)*2.0;float r=length(p);if(r>1.0)discard;
    float a=atan(p.y,p.x)/6.2831853+0.5;
    float sweep=pow(0.5+0.5*cos((a-uTime*0.32)*6.2831853),10.0);
    float outer=band(r,0.88,0.075),core=band(r,0.88,0.018),glow=0.28*(1.0-smoothstep(0.62,1.0,r))*smoothstep(0.45,0.85,r);
    float alpha=max(glow,outer*(0.7+0.3*sweep));alpha=max(alpha,core);if(alpha<=0.004)discard;
    vec3 color=mix(uColor*0.82,mix(uColor,vec3(1.0),0.35),core*0.6+sweep*outer*0.8);
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }`;
export const RANCH_BLOODLINE_RING=Object.freeze({radiusScale:1.32,lift:.008,renderOrder:2});

export function createRanchBloodlineRings(scene,{getBloodline=()=>null,view=RANCH_LAYOUT_VIEW}={}){
  const geometry=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
  const materials=new Map(),items=new Map();let time=0;
  const material=color=>{
    let entry=materials.get(color);
    // Normal blending keeps the metal's colour on a pale floor (additive washed it to white).
    if(!entry){entry=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{uTime:{value:0},uColor:{value:new THREE.Color(color)}},vertexShader:RING_VERTEX,fragmentShader:BLOODLINE_FRAGMENT});
      materials.set(color,entry);}
    return entry;
  };
  function reset(){for(const item of items.values()){item.seen=false;item.mesh.visible=false;}}
  function sync(key,entry,bounds,pixelScale,actorTransferred,syncView=view){
    let bloodline=null;try{bloodline=getBloodline(key);}catch{bloodline=null;}
    if(!bloodline||!Number.isInteger(bloodline.ring)||!actorTransferred||!entry?.root?.visible)return null;
    const placement=ranchSelectionRingPlacement(entry,bounds,pixelScale,syncView);
    if(!placement)return null;
    let item=items.get(key);
    if(item&&item.color!==bloodline.ring){scene.remove(item.mesh);items.delete(key);item=null;}
    if(!item){
      const mesh=new THREE.Mesh(geometry,material(bloodline.ring));
      mesh.frustumCulled=false;mesh.renderOrder=RANCH_BLOODLINE_RING.renderOrder;mesh.name='ranch-bloodline-ring';
      scene.add(mesh);item={mesh,color:bloodline.ring,family:bloodline.family};items.set(key,item);
    }
    const radius=placement.radius*RANCH_BLOODLINE_RING.radiusScale/RANCH_SELECTION_RING.radiusScale;
    item.mesh.position.set(placement.center.x,placement.center.y-RANCH_SELECTION_RING.lift+RANCH_BLOODLINE_RING.lift,placement.center.z);
    item.mesh.scale.set(radius,1,radius);item.mesh.visible=true;item.seen=true;item.placement=placement;
    return placement;
  }
  function animate(deltaMS,{still=false}={}){
    if(still)return;
    time+=Math.min(50,Math.max(0,deltaMS))/1000;for(const m of materials.values())m.uniforms.uTime.value=time;
  }
  function prune(){for(const [key,item] of items)if(!item.seen){scene.remove(item.mesh);items.delete(key);}}
  function dispose(){for(const item of items.values())scene.remove(item.mesh);items.clear();geometry.dispose();for(const m of materials.values())m.dispose();materials.clear();}
  function diagnostics(){return [...items].filter(([,item])=>item.seen).map(([key,item])=>({key,family:item.family,color:item.color,radius:item.mesh.scale.x}));}
  const count=()=>{let n=0;for(const item of items.values())if(item.seen)n++;return n;};
  return {reset,sync,animate,prune,dispose,diagnostics,count};
}
