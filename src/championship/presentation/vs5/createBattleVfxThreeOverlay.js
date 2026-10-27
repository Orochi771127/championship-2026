// Existing bounded Three.js overlay for licensed battle VFX on the VS5 field.
//
// The battle field stays Pixi. This canvas sits on top, takes no pointer
// events, and advances only from the Championship Pixi ticker. Framing is a
// product-authored preview: the original camera is untraced.

import * as THREE from "../../../../node_modules/three/build/three.module.js";
import { GLTFLoader } from "../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import {
  createLicensedVfxRuntime,
  loadLicensedVfxRuntimeManifest
} from "../vfx/licensedVfxRuntimeBundle.js";
import { BATTLE_IMPACT_FAMILIES } from '../../battle/battleImpactEffects.js';
import { cappedPixelRatio, currentQuality, flashScale } from '../presentationPreferences.js';
import { prepareBattleVfxGpu } from './prepareBattleVfxGpu.js';

const CAMERA_POLICY = "PRODUCT_AUTHORED_PREVIEW_FRAMING";

function fail(reason) {
  throw new TypeError(`CHAMPIONSHIP_BATTLE_VFX_OVERLAY_${reason}`);
}

function frameObject(object) {
  // Fit the converted model into a small preview volume. This is not a claim
  // about the original DS camera or world scale.
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  object.scale.setScalar(1.8 / maxDim);
  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

export async function mountBattleVfxThreeOverlay({
  host,
  stage,
  systemId,
  source = null,
  getFocusPlacement = () => null,
  getFieldPlacement = () => null,
  fetchImpl = globalThis.fetch,
  recordDiagnostic = () => {},
  isActive = () => true
}) {
  if (!host || typeof host.appendChild !== "function") fail("HOST_REQUIRED");
  if (!stage?.app?.ticker || typeof stage.onResize !== "function") fail("PIXI_STAGE_TICKER_REQUIRED");
  const live = source !== null;
  if (!live && (typeof systemId !== "string" || systemId.trim() === "")) fail("SYSTEM_ID_REQUIRED");

  const manifest = await loadLicensedVfxRuntimeManifest({ fetchImpl });
  const runtime = createLicensedVfxRuntime({
    manifest,
    loader: new GLTFLoader()
  });
  const resolvedId = runtime.resolveSystemId(live ? 'hypereffect' : systemId);
  if (!resolvedId) fail(`UNKNOWN_SYSTEM:${systemId}`);

  // Antialiasing follows the quality tier when the overlay mounts (next battle).
  const renderer = new THREE.WebGLRenderer({ antialias: currentQuality().threeAntialias, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(cappedPixelRatio(currentQuality().threePixelRatioCap));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "cm-vs5-vfx-overlay";
  renderer.domElement.dataset.renderer = "THREE_BOUNDED_VFX_OVERLAY";
  renderer.domElement.dataset.camera = live ? 'MOBILE_FOCUS_PLACEMENT_ORIGINAL_ZOOM' : CAMERA_POLICY;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  function destroyRenderer() {
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
  }

  const scene = new THREE.Scene();
  const camera = live ? new THREE.OrthographicCamera(-1,1,1,-1,.1,2000) : new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, live ? 0 : 1.1, live ? 1000 : 4.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x1a2430, 1.15));

  let instance;
  try {
    instance = await runtime.load(resolvedId, { loop: true, channel: live ? 'hyper-core' : "preview" });
  } catch (error) {
    await runtime.unloadAll();destroyRenderer();throw error;
  }
  if (!instance) {
    destroyRenderer();
    fail("LOAD_CANCELLED");
  }
  const group = new THREE.Group();
  group.add(instance.object3d);
  let ring = null;
  try {
    if (live) {
      // OVL19 0211B03C + 0211B0E8 load this pair; 0211B54C gates both from
      // the same prelude zoom. Neither is guessed from damage/critical flags.
      ring = await runtime.load('battle-hypereffect_ring',{loop:true,channel:'hyper-ring'});
      if (!ring) fail('RING_LOAD_CANCELLED');
      group.add(ring.object3d);
    }
  } catch (error) {
    await runtime.unloadAll();destroyRenderer();throw error;
  }
  const model = new THREE.Group();model.add(group);
  if (!live) frameObject(group);
  scene.add(model);

  // All five native families have 16 independent slots; warm them before play.
  const impacts=[];
  try {
    if(live){const loaded=await Promise.allSettled(BATTLE_IMPACT_FAMILIES.flatMap((family,type)=>
      Array.from({length:16},async(_,slot)=>{
        const fx=await runtime.load(family.systemId,{loop:false,channel:`impact-${type}-${slot}`});
        if(!fx)fail('IMPACT_LOAD_CANCELLED');
        const container=new THREE.Group();container.add(fx.object3d);container.visible=false;scene.add(container);
        impacts.push({type,slot,fx,container});
      })));
      const failure=loaded.find(result=>result.status==='rejected');if(failure)throw failure.reason;
    }
  }catch(error){await runtime.unloadAll();destroyRenderer();throw error;}

  let disposed = false;
  // Nothing visible and already cleared: skip the Three render (it would walk
  // every pooled impact group and clear the canvas again each frame).
  let cleared = false;
  let firstVisibleRender=false;
  const recordFirstRender=(phase,error)=>{try{recordDiagnostic('LOAD',{area:'battle',stage:'first-vfx-render',phase,...(error?{error}:{})});}catch{}};
  const lastData = { focus: null, impacts: null };
  const setData = (key, value) => { if (lastData[key] !== value) { lastData[key] = value; renderer.domElement.dataset[key] = value; } };

  function resize() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setPixelRatio(cappedPixelRatio(currentQuality().threePixelRatioCap));
    renderer.setSize(width, height, false);
    if (live) {camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;}
    else camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  let wasHidden = false;
  function advance(ticker) {
    if (disposed) return;
    if (globalThis.document?.hidden) {
      wasHidden = true;
      return;
    }
    const effectiveDeltaMS = wasHidden ? 0 : Math.min(50, Math.max(0, ticker?.deltaMS ?? 0));
    wasHidden = false;
    const view = live ? source.getView() : null;
    let visibleImpacts = 0;
    if (live) {
      const focus = view.specialPrelude;
      const placement = getFocusPlacement();
      model.visible = Boolean(focus?.hyperVisible && placement);
      if (model.visible) {
        const frame = placement.reducedMotion ? 0 : Math.max(0,focus.frame-1);
        instance.sampleNativeFrame(frame);ring.sampleNativeFrame(frame);
        // Preserve converted model units: the core spans ~468 units while the
        // ring spans ~29. Normalizing the pair to a preview box shrinks the ring
        // to a dot. Both use the arena's native pixel scale and the same zoom.
        const scale=placement.nativeScale*placement.zoom;
        model.scale.setScalar(scale);
        ring.object3d.position.y=12; // 0211B850/854: ring centred 12 source units up
        model.position.set(placement.anchorX-placement.width/2,
          placement.height/2-placement.anchorY,0);
      }
      setData('focus', JSON.stringify(focus ? {slot:focus.slot,frame:focus.frame,
        phase:focus.phase,zoomQ12:focus.zoomQ12,visible:model.visible} : null));
      const field=getFieldPlacement(),active=view.impactEffects??[];
      for(const item of impacts){
        const effect=active.find(e=>e.type===item.type&&e.slot===item.slot);
        item.container.visible=Boolean(effect&&field);
        if(!item.container.visible)continue;
        visibleImpacts++;
        item.fx.sampleNativeFrame(field.reducedMotion?0:effect.frame);
        // Native copied-sprite projection and offsets, using the same phone
        // viewport transform as Pixi. Depth is retained across all five pools.
        const x=field.artRect.x+effect.point.x/4096/416*field.artRect.width;
        const y=field.artRect.y+(effect.point.y-effect.point.z)/4096/272*field.artRect.height;
        item.container.position.set(x*field.zoom+field.x-field.width/2,
          field.height/2-(y*field.zoom+field.y),effect.nativeCopy?effect.depthQ12/4096:1);
        item.container.scale.setScalar(field.nativeScale*field.zoom);
      }
      setData('impacts', JSON.stringify({active:active.length,
        visible:visibleImpacts,
        instances:active.map(e=>({id:e.id,type:e.type,slot:e.slot,frame:e.frame,systemId:e.systemId}))}));
    } else instance.update(effectiveDeltaMS);
    // Original one-frame hit flash, adapted to the unified phone battlefield.
    // Reduced motion suppresses presentation flashing without changing hits.
    // The flash-intensity preference makes it a translucent white instead.
    if(live&&view.nativeLifecycle?.flash?.active&&!getFieldPlacement()?.reducedMotion){
      renderer.setClearColor(0xffffff,flashScale());renderer.clear();cleared=false;
    }else if(live&&!model.visible&&visibleImpacts===0){
      if(!cleared){renderer.setClearColor(0x000000,0);renderer.clear();cleared=true;}
    }else{
      renderer.setClearColor(0x000000,0);
      const observe=live&&!firstVisibleRender;
      if(observe){firstVisibleRender=true;recordFirstRender('start');}
      try{renderer.render(scene, camera);if(observe)recordFirstRender('done');}
      catch(error){if(observe)recordFirstRender('error',error);throw error;}
      cleared=false;
    }
  }

  resize();
  if(live){
    try{await prepareBattleVfxGpu({renderer,scene,camera,groups:[model,...impacts.map(item=>item.container)],record:recordDiagnostic,isActive});}
    catch(error){await runtime.unloadAll();destroyRenderer();throw error;}
  } else {
    try { renderer.compile?.(scene, camera); } catch {}
  }
  // A phone can rotate during yielded preparation; refresh before exposure.
  resize();
  const unobserveResize = stage.onResize(resize);
  // Field simulation/layout (default 0) precedes this overlay on the SAME tick.
  stage.app.ticker.add(advance, undefined, -10);
  advance({deltaMS:0});

  return Object.freeze({
    redraw:()=>advance({deltaMS:0}),
    getDiagnostics() {
      return Object.freeze({
        renderer: "THREE_BOUNDED_VFX_OVERLAY",
        camera: live ? 'MOBILE_FOCUS_PLACEMENT_ORIGINAL_ZOOM' : CAMERA_POLICY,
        ticker: "APPLICATION_OWNED",
        threeUsed: true,
        systemId: resolvedId,
        requestedSystemId: systemId,
        impacts:{capacity:impacts.length,visible:impacts.filter(e=>e.container.visible).length},
        vfx: instance.getDiagnostics()
      });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      unobserveResize();
      stage.app.ticker.remove(advance);
      scene.remove(model);
      await instance.dispose();
      await runtime.unloadAll();
      destroyRenderer();
    }
  });
}
