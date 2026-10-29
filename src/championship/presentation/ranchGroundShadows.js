import * as THREE from '../../../node_modules/three/build/three.module.js';
import {ranchNativeToWorld,RANCH_LAYOUT_VIEW} from './ranchThreeCoordinates.js';

// Owner 2026-10-27 diorama look: contact shadows read stronger (was .26).
// Shadow audit 2026-10-30: the core is darker and the rim fades from SOFT_CORE outwards,
// so the ellipse reads as a soft contact under the body instead of a flat disc.
export const RANCH_CONTACT_SHADOW_OPACITY=.46;
export const RANCH_CONTACT_SHADOW_SOFT_CORE=.55;
// Preserve the existing authored screen ellipse, but put its fragments on the
// contact plane in the SAME depth buffer as the alpha-cutout actors/terrain.
export function ranchShadowWorldPoint(point,bounds,pixelScale,height,view=RANCH_LAYOUT_VIEW){
  return ranchNativeToWorld((point.x-bounds.x)/pixelScale,
    (point.y-bounds.y)/(pixelScale*view.groundScaleY)+height*view.lift,height);
}
export function ranchShadowScreenEllipses(shadow,ellipses){
  return ellipses.map(e=>{
    const c=shadow.toGlobal({x:e.x,y:e.y});
    const x=shadow.toGlobal({x:e.x+e.radiusX,y:e.y});
    const y=shadow.toGlobal({x:e.x,y:e.y+e.radiusY});
    return {x:c.x,y:c.y,rx:Math.abs(x.x-c.x),ry:Math.abs(y.y-c.y)};
  }).filter(e=>e.rx>0&&e.ry>0&&Object.values(e).every(Number.isFinite));
}
export function createRanchGroundShadows(scene){
  const items=new Map();
  function release(item){
    if(!item.shadow.destroyed)item.shadow.renderable=true;
    scene.remove(item.mesh);item.mesh.geometry.dispose();item.mesh.material.dispose();
  }
  function reset(){for(const item of items.values()){item.seen=false;item.mesh.visible=false;if(!item.shadow.destroyed)item.shadow.renderable=true;}}
  function sync(key,entry,bounds,pixelScale,actorTransferred,view=RANCH_LAYOUT_VIEW){
    const shadow=entry.shadow;
    if(!actorTransferred||!shadow?.visible||!entry.root.visible||!entry.groundShadowEllipses?.length)return;
    const ellipses=ranchShadowScreenEllipses(shadow,entry.groundShadowEllipses);
    if(!ellipses.length)return;
    let item=items.get(key);
    if(item&&(item.count!==ellipses.length||item.shadow!==shadow)){release(item);items.delete(key);item=null;}
    if(!item){
      const material=new THREE.ShaderMaterial({
        transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
        uniforms:{ellipses:{value:ellipses.map(()=>new THREE.Vector4())},opacity:{value:RANCH_CONTACT_SHADOW_OPACITY},color:{value:new THREE.Color(0x02070a)}},
        vertexShader:'varying vec2 vShadowUv; void main(){vShadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:`varying vec2 vShadowUv; uniform vec4 ellipses[${ellipses.length}]; uniform float opacity; uniform vec3 color;
          void main(){float coverage=0.0;
            for(int i=0;i<${ellipses.length};i++){vec4 e=ellipses[i];float d=length((vShadowUv-e.xy)/e.zw);float edge=max(fwidth(d),0.00001);coverage=max(coverage,1.0-smoothstep(${RANCH_CONTACT_SHADOW_SOFT_CORE.toFixed(2)},1.0+edge,d));}
            if(coverage<=0.0)discard;gl_FragColor=vec4(color,opacity*coverage);
            #include <colorspace_fragment>
          }`
      });
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.frustumCulled=false;scene.add(mesh);
      item={mesh,shadow,count:ellipses.length};items.set(key,item);
    }
    const left=Math.min(...ellipses.map(e=>e.x-e.rx)),right=Math.max(...ellipses.map(e=>e.x+e.rx));
    const top=Math.min(...ellipses.map(e=>e.y-e.ry)),bottom=Math.max(...ellipses.map(e=>e.y+e.ry));
    // Below the existing actor support depth (.015), above the contact plane.
    // No actor world push, disabled depth test, or environment depth change.
    const height=(entry.root.threeGroundHeight??0)+.006;
    const positions=item.mesh.geometry.attributes.position;
    [{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}].forEach((p,i)=>{
      const w=ranchShadowWorldPoint(p,bounds,pixelScale,height,view);positions.setXYZ(i,w.x,w.y,w.z);
    });positions.needsUpdate=true;
    ellipses.forEach((e,i)=>item.mesh.material.uniforms.ellipses.value[i].set((e.x-left)/(right-left),1-(e.y-top)/(bottom-top),e.rx/(right-left),e.ry/(bottom-top)));
    // A hovering frame's footprint is lighter (raisingFootprintShadow.js alpha).
    item.mesh.material.uniforms.opacity.value=RANCH_CONTACT_SHADOW_OPACITY*(shadow.worldAlpha??1)*(entry.groundShadowEllipses[0].alpha??1);
    item.mesh.visible=true;item.seen=true;shadow.renderable=false;
  }
  function prune(){for(const [key,item] of items)if(!item.seen){release(item);items.delete(key);}}
  function dispose(){for(const item of items.values())release(item);items.clear();}
  return {reset,sync,prune,dispose};
}
