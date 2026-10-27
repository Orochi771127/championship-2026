import * as THREE from '../../../../node_modules/three/build/three.module.js';
import {currentQuality,currentQualityTier,cappedPixelRatio,prefersReducedMotion} from '../presentationPreferences.js';
import {createMedalGeometry,createMedalStudioTexture,isMedalPresentationProfile} from './medalGeometry.js';
import {createMedalFrameRuntime} from './medalFrameRuntime.js';
import {createMedalFaceTexture} from './medalFaceTexture.js';
import {readMedalSilhouette} from './medalSilhouette.js';

// One bounded detail scene; no game state, save, award, global animation loop,
// image remapping, or original-ROM presentation claim lives in this adapter.
export function mountMedalThreePresentation({host,src,presentationProfile,onState=()=>{},readSilhouette=readMedalSilhouette,createRenderer=options=>new THREE.WebGLRenderer(options),createTextureLoader=()=>new THREE.TextureLoader()}) {
  const doc=host.ownerDocument,win=doc.defaultView;
  let disposed=false,failed=false,ready=false,renderer=null,scene=null,camera=null,medal=null,environment=null,face=null;
  let resizeObserver=null,preferenceObserver=null,pointer=null,renderCount=0,silhouetteReads=0,shapeDiagnostics=null,fallbackReason=null;
  const removers=[];
  const runtime=createMedalFrameRuntime({
    requestFrame:fn=>win.requestAnimationFrame(fn),cancelFrame:id=>win.cancelAnimationFrame(id),
    draw(pose){
      if(disposed||failed||!ready||!renderer||!host.isConnected||doc.hidden)return;
      try {
        medal.group.rotation.set(pose.x,pose.y,0);renderer.render(scene,camera);renderCount++;
        if(renderer.domElement.hidden){renderer.domElement.hidden=false;onState('ready');}
      }catch{fallback();}
    }
  });
  function listen(target,type,listener,options){target.addEventListener(type,listener,options);removers.push(()=>target.removeEventListener(type,listener,options));}
  function releasePointer(){
    if(pointer&&host.hasPointerCapture?.(pointer.id)){try{host.releasePointerCapture(pointer.id);}catch{ /* capture may have ended with the dialog */ }}
    pointer=null;
  }
  function releaseResources(){
    runtime.dispose();releasePointer();resizeObserver?.disconnect();preferenceObserver?.disconnect();
    for(const remove of removers.splice(0))remove();
    face?.dispose();face=null;medal?.dispose();medal=null;environment?.dispose();environment=null;
    if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderer=null;}
    scene=null;camera=null;
  }
  function fallback(reason='renderer_or_texture_failure'){if(disposed||failed)return;fallbackReason=typeof reason==='string'?reason:'renderer_or_texture_failure';failed=true;ready=false;releaseResources();onState('fallback');}
  function resize(){
    if(disposed||failed||!renderer)return;
    const width=host.clientWidth,height=host.clientHeight;if(width<1||height<1)return;
    try{
      const quality=currentQuality(doc);
      renderer.setPixelRatio(cappedPixelRatio(Math.min(2,quality.threePixelRatioCap),win.devicePixelRatio));
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();runtime.invalidate();
    }catch{fallback();}
  }
  function visibility(){releasePointer();runtime.setVisible(!doc.hidden&&host.isConnected);}
  function pointerDown(event){
    if(!ready||failed||disposed||event.button!==0||pointer)return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
    try{host.setPointerCapture?.(event.pointerId);}catch{pointer=null;}
  }
  function pointerMove(event){
    if(!pointer||pointer.id!==event.pointerId)return;
    runtime.rotate((event.clientX-pointer.x)*.012,(event.clientY-pointer.y)*.007);
    pointer.x=event.clientX;pointer.y=event.clientY;
  }
  function pointerEnd(event){if(pointer?.id===event.pointerId)releasePointer();}
  function keydown(event){
    if(!ready||failed||disposed||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='Home')runtime.reset();
    else runtime.rotate(event.key==='ArrowLeft'?-.18:event.key==='ArrowRight'?.18:0,event.key==='ArrowUp'?-.08:event.key==='ArrowDown'?.08:0);
  }
  try {
    if(!isMedalPresentationProfile(presentationProfile)){fallback('unknown_presentation_profile');return Object.freeze({reset(){},dispose,getDiagnostics(){return {renderer:'STATIC_FALLBACK',rendererCount:0,textureCount:0,failed,disposed,ready,fallbackReason};}});}
    const quality=currentQuality(doc);
    renderer=createRenderer({alpha:true,antialias:quality.threeAntialias,powerPreference:'low-power'});
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
    renderer.domElement.className='cm-medal-display__canvas';renderer.domElement.hidden=true;
    renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.dataset.renderer='THREE_BOUNDED_MEDAL_DETAIL';
    host.append(renderer.domElement);
    listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();fallback();});
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,30);camera.position.set(0,.04,4.95);
    environment=createMedalStudioTexture();scene.environment=environment;scene.environmentIntensity=1.3;
    scene.add(new THREE.HemisphereLight(0xffefc9,0x37323b,1.3));
    const key=new THREE.DirectionalLight(0xffefcd,3.8);key.position.set(-3,4,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc3d7ff,2.2);fill.position.set(4,.2,2);scene.add(fill);
    const rim=new THREE.DirectionalLight(0xffffff,4.5);rim.position.set(1,2,-2);scene.add(rim);
    listen(host,'pointerdown',pointerDown);listen(host,'pointermove',pointerMove);
    for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(host,event,pointerEnd);
    listen(host,'keydown',keydown);listen(win,'resize',resize);listen(doc,'visibilitychange',visibility);
    listen(win,'pagehide',event=>{runtime.setVisible(false);if(!event.persisted)dispose();});
    listen(win,'pageshow',()=>{visibility();resize();});
    if(win.ResizeObserver){resizeObserver=new win.ResizeObserver(resize);resizeObserver.observe(host);}
    // No automatic motion in ANY tier, including reduced motion. Quality cap
    // changes repaint once; MSAA follows the shared next-mount policy.
    if(win.MutationObserver){preferenceObserver=new win.MutationObserver(resize);preferenceObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-quality','data-motion']});}
    visibility();resize();
    if(!failed){
      const loader=createTextureLoader();
      face=createMedalFaceTexture({
        load(onReady,onError){return loader.load(src,onReady,undefined,onError);},
        onReady(texture){
          if(disposed||failed||ready)return;
          try{
            let silhouette;
            silhouetteReads++;silhouette=readSilhouette(texture.image,doc);if(!silhouette.ok){fallback(silhouette.reason);return;}
            medal=createMedalGeometry({silhouette,presentationProfile});shapeDiagnostics=medal.getDiagnostics();scene.add(medal.group);
            texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(currentQualityTier(doc)==='saver'?1:4,renderer.capabilities.getMaxAnisotropy());
            medal.fitFaceAspect(texture.image?.naturalWidth??texture.image?.width,texture.image?.naturalHeight??texture.image?.height);
            medal.faceMaterial.map=texture;medal.faceMaterial.needsUpdate=true;ready=true;runtime.invalidate();
          }catch{fallback('silhouette_geometry_failure');}
        },
        onError:fallback
      });
      if(failed||disposed){face.dispose();face=null;}
    }
  }catch{fallback();}
  function dispose(){if(disposed)return;disposed=true;releaseResources();}
  return Object.freeze({
    reset(){releasePointer();runtime.reset();},dispose,
    getDiagnostics(){return {renderer:renderer?'THREE_BOUNDED_MEDAL_DETAIL':'STATIC_FALLBACK',rendererCount:renderer?1:0,textureCount:face?1:0,renderCount,failed,disposed,ready,
      quality:currentQualityTier(doc),reducedMotion:prefersReducedMotion(doc),pixelRatio:renderer?.getPixelRatio()??null,silhouetteReads,fallbackReason,shape:shapeDiagnostics,base:'SOURCE_ALPHA_EXTRUSION',face:'EXISTING_2D_BADGE',originalLayoutClaimed:false,...runtime.snapshot()};}
  });
}
