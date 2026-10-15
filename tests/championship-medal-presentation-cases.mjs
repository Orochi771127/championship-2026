import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import {createMedalFrameRuntime,MEDAL_HOME_POSE} from '../src/championship/presentation/medals/medalFrameRuntime.js';
import {createMedalGeometry,createMedalStudioTexture} from '../src/championship/presentation/medals/medalGeometry.js';
import {traceMedalSilhouette} from '../src/championship/presentation/medals/medalSilhouette.js';
import {createMedalFaceTexture} from '../src/championship/presentation/medals/medalFaceTexture.js';
import {mountSelectedMedalPresentation} from '../src/championship/presentation/medals/selectedMedalPresentation.js';
import {mountMedalThreePresentation} from '../src/championship/presentation/medals/medalThreePresentation.js';
import {medalPresentationText,MEDAL_PRESENTATION_COPY_KEYS,MEDAL_PRESENTATION_COPY} from '../src/championship/presentation/medals/medalPresentationText.js';
import {LOCALES} from '../src/championship/text/locale.js';
import {inspectScopedLocaleCopy,buildLocaleCoverage} from '../scripts/check-locale-coverage.mjs';
import {ControlledEvent,createControlledDocument} from './helpers/controlled-database-dom.mjs';

// Controlled scheduling and renderer doubles only: not browser pixels or GPU,
// touch hardware, accessibility, physical-device or normal-flow acceptance.
function frames(){let id=0;const pending=new Map();return {pending,requestFrame:fn=>{pending.set(++id,fn);return id;},cancelFrame:id=>pending.delete(id),flush(){const batch=[...pending.values()];pending.clear();for(const fn of batch)fn();}};}
function events(target={}){const listeners=new Map();Object.assign(target,{listeners,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatchEvent(event){for(const fn of [...(listeners.get(event.type)??[])])fn(event);}});return target;}
function fixture({quality='balanced',motion='full',constructorFails=false,textureFailsSync=false,presentationProfile={shape:'free',material:'gold'},silhouetteResult}={}){
  const scheduler=frames(),doc=events(createControlledDocument()),observers=[];
  doc.documentElement.dataset.quality=quality;doc.documentElement.dataset.motion=motion;doc.hidden=false;
  class Observer {constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const win=events({devicePixelRatio:3,requestAnimationFrame:scheduler.requestFrame,cancelAnimationFrame:scheduler.cancelFrame,ResizeObserver:Observer,MutationObserver:Observer});doc.defaultView=win;
  const host=doc.createElement('div');host.clientWidth=320;host.clientHeight=224;doc.body.append(host);
  const captures=new Set();host.setPointerCapture=id=>captures.add(id);host.hasPointerCapture=id=>captures.has(id);host.releasePointerCapture=id=>captures.delete(id);
  const states=[],textures=[],renders=[];let renderer,options,ready,error,renderFails=false,disposedResources=0;
  const controller=mountMedalThreePresentation({host,src:'assets/production/example.png',presentationProfile,readSilhouette:()=>silhouetteResult??traceMedalSilhouette({width:8,height:8,data:new Uint8Array(8*8*4).fill(255)}),onState:state=>states.push(state),
    createRenderer(input){options=input;if(constructorFails)throw Error('no WebGL');let pixelRatio=1;
      renderer={domElement:doc.createElement('canvas'),capabilities:{getMaxAnisotropy:()=>8},disposeCount:0,loseCount:0,
        setClearColor(){},setPixelRatio(value){pixelRatio=value;},getPixelRatio:()=>pixelRatio,setSize(w,h){this.size=[w,h];},
        render(scene,camera){if(renderFails)throw Error('draw failed');renders.push({scene,camera});},dispose(){this.disposeCount++;},forceContextLoss(){this.loseCount++;}};return renderer;},
    createTextureLoader(){return {load(src,onReady,_progress,onError){const texture=new THREE.Texture();textures.push(texture);texture.addEventListener('dispose',()=>disposedResources++);ready=(image={})=>{texture.image=image;onReady(texture);};error=onError;if(textureFailsSync)onError();return texture;}};}
  });
  return {doc,win,host,controller,states,textures,renders,observers,renderer,options,scheduler,captures,ready:image=>ready(image),error:()=>error(),setRenderFails:()=>{renderFails=true;},disposedTextures:()=>disposedResources,
    emit:(type,init={})=>host.dispatchEvent(new ControlledEvent(type,{bubbles:false,...init}))};
}
function assertReleased(f){assert.equal(f.host.querySelectorAll('canvas').length,0);assert.equal(f.scheduler.pending.size,0);for(const target of [f.host,f.doc,f.win])assert.ok([...target.listeners.values()].every(set=>set.size===0));assert.ok(f.observers.every(o=>o.disconnected));if(f.renderer){assert.equal(f.renderer.disposeCount,1);assert.equal(f.renderer.loseCount,1);}}
const flushMicrotasks=()=>new Promise(resolve=>setImmediate(resolve));

test('frame queue coalesces interaction, draws once, and never schedules idle work',()=>{
  const f=frames(),draws=[],r=createMedalFrameRuntime({...f,draw:pose=>draws.push(pose)});
  assert.equal(f.pending.size,0);for(let i=0;i<100;i++)r.invalidate();assert.equal(f.pending.size,1);
  f.flush();assert.equal(draws.length,1);assert.equal(f.pending.size,0);assert.deepEqual(draws[0],MEDAL_HOME_POSE);
  r.rotate(.2,.1);r.rotate(.2,.1);assert.equal(f.pending.size,1);f.flush();assert.equal(draws.length,2);assert.equal(f.pending.size,0);
});
test('background, disable and dispose cancel pending frames without reviving work',()=>{
  const f=frames(),r=createMedalFrameRuntime({...f,draw:()=>{}});
  r.invalidate();r.setVisible(false);assert.equal(f.pending.size,0);r.rotate(.5,.5);assert.deepEqual(r.snapshot().pose,MEDAL_HOME_POSE);
  r.setVisible(true);assert.equal(f.pending.size,1);r.setEnabled(false);assert.equal(f.pending.size,0);r.setEnabled(true);r.dispose();r.dispose();r.invalidate();r.reset();r.rotate(1,1);
  assert.equal(f.pending.size,0);assert.equal(r.snapshot().disposed,true);
});
test('manual rotation is clamped, wraps, rejects invalid inputs, and resets on demand',()=>{
  const f=frames(),r=createMedalFrameRuntime({...f,draw:()=>{}});
  r.rotate(100,100);assert.equal(r.snapshot().pose.x,.75);assert.ok(Math.abs(r.snapshot().pose.y)<=Math.PI);
  const before=r.snapshot().pose;r.rotate(NaN,1);assert.deepEqual(r.snapshot().pose,before);r.reset();assert.deepEqual(r.snapshot().pose,MEDAL_HOME_POSE);f.flush();assert.equal(f.pending.size,0);
});
test('base is real extruded geometry, frame/back have depth and face remains a flat image plane',()=>{
  const m=createMedalGeometry({silhouette:traceMedalSilhouette({width:8,height:8,data:new Uint8Array(256).fill(255)}),presentationProfile:{shape:'free',material:'gold'}}),base=m.group.getObjectByName('metal_base'),face=m.group.getObjectByName('flat_badge_face');
  assert.equal(base.geometry.type,'ExtrudeGeometry');base.geometry.computeBoundingBox();assert.ok(base.geometry.boundingBox.max.z-base.geometry.boundingBox.min.z>=.13);
  assert.equal(face.geometry.type,'PlaneGeometry');assert.equal(face.material,m.faceMaterial);assert.ok(face.position.z>base.position.z);
  const geometries=new Set(),materials=new Set();m.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])if(material)materials.add(material);});
  let disposed=0;for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>disposed++);m.dispose();m.dispose();assert.equal(disposed,geometries.size+materials.size);
  const env=createMedalStudioTexture();assert.equal(env.image.width,64);assert.equal(env.image.height,32);env.dispose();
});
test('face texture owns one resource and rejects late ready/error callbacks after disposal',()=>{
  let ready,error,count=0,updates=0;const texture={image:null,dispose(){count++;}};
  const owner=createMedalFaceTexture({load(r,e){ready=r;error=e;return texture;},onReady(){updates++;},onError(){updates++;}});
  owner.dispose();owner.dispose();texture.image={late:true};ready(texture);error();assert.equal(updates,0);assert.equal(count,1);assert.equal(texture.image,null);
});
test('lazy loader canceled before start imports nothing',async()=>{
  let loads=0,mounts=0;const states=[];const p=mountSelectedMedalPresentation({onState:s=>states.push(s),load:()=>{loads++;return {mountMedalThreePresentation(){mounts++;}};}});p.dispose();await flushMicrotasks();assert.equal(loads,0);assert.equal(mounts,0);assert.deepEqual(states,['loading']);
});
test('late module load cannot mount or overwrite replacement state after disposal',async()=>{
  let resolve,mounts=0;const states=[];const p=mountSelectedMedalPresentation({onState:s=>states.push(s),load:()=>new Promise(r=>{resolve=r;})});await flushMicrotasks();p.dispose();resolve({mountMedalThreePresentation(){mounts++;}});await flushMicrotasks();assert.equal(mounts,0);assert.deepEqual(states,['loading']);
});
test('module errors fall back once and lazy controller forwards reset/disposal',async()=>{
  const states=[];mountSelectedMedalPresentation({onState:s=>states.push(s),load:()=>Promise.reject(Error('load failed'))});await flushMicrotasks();assert.deepEqual(states,['loading','fallback']);
  let resets=0,disposes=0;const p=mountSelectedMedalPresentation({load:()=>({mountMedalThreePresentation(){return {reset(){resets++;},dispose(){disposes++;},getDiagnostics(){return {rendererCount:1};}};}})});await flushMicrotasks();p.reset();assert.equal(p.getDiagnostics().rendererCount,1);p.dispose();p.dispose();assert.equal(resets,1);assert.equal(disposes,1);
});
test('selected detail draws only after one image loads and stays completely idle afterward',()=>{
  const f=fixture();f.scheduler.flush();assert.equal(f.renders.length,0);assert.deepEqual(f.states,[]);assert.equal(f.textures.length,1);
  f.ready();assert.equal(f.scheduler.pending.size,1);f.scheduler.flush();assert.deepEqual(f.states,['ready']);assert.equal(f.renders.length,1);assert.equal(f.scheduler.pending.size,0);
  assert.equal(f.controller.getDiagnostics().rendererCount,1);assert.equal(f.controller.getDiagnostics().textureCount,1);assert.equal(f.controller.getDiagnostics().automaticMotion,false);
  f.controller.dispose();assertReleased(f);assert.equal(f.disposedTextures(),1);
});
test('saver, balanced and high use bounded quality, with no automatic motion even in reduced mode',()=>{
  for(const [quality,ratio,antialias] of [['saver',1,false],['balanced',2,true],['high',2,true]])for(const motion of ['full','reduced']){
    const f=fixture({quality,motion});assert.equal(f.options.antialias,antialias);assert.equal(f.options.powerPreference,'low-power');assert.equal(f.controller.getDiagnostics().pixelRatio,ratio);
    f.ready();f.scheduler.flush();assert.equal(f.controller.getDiagnostics().reducedMotion,motion==='reduced');assert.equal(f.scheduler.pending.size,0);
    f.controller.dispose();assertReleased(f);
  }
});
test('pointer and keyboard input repaint only once and cancellation releases capture',()=>{
  const f=fixture();f.ready();f.scheduler.flush();f.emit('pointerdown',{button:0,pointerId:7,clientX:20,clientY:20});assert.ok(f.captures.has(7));
  f.emit('pointermove',{pointerId:8,clientX:50,clientY:40});assert.equal(f.scheduler.pending.size,0);
  for(let i=0;i<20;i++)f.emit('pointermove',{pointerId:7,clientX:30+i,clientY:25+i});assert.equal(f.scheduler.pending.size,1);f.scheduler.flush();assert.equal(f.renders.length,2);
  f.emit('pointercancel',{pointerId:7});assert.equal(f.captures.size,0);
  f.emit('keydown',{key:'ArrowLeft'});f.emit('keydown',{key:'ArrowDown'});assert.equal(f.scheduler.pending.size,1);f.scheduler.flush();f.emit('keydown',{key:'Home'});assert.deepEqual(f.controller.getDiagnostics().pose,MEDAL_HOME_POSE);
  f.controller.dispose();assertReleased(f);
});
test('visibility cancels work, reappearance repaints once and live quality changes remain bounded',()=>{
  const f=fixture();f.ready();f.doc.hidden=true;f.doc.dispatchEvent(new ControlledEvent('visibilitychange'));assert.equal(f.scheduler.pending.size,0);
  f.doc.hidden=false;f.doc.dispatchEvent(new ControlledEvent('visibilitychange'));f.scheduler.flush();assert.equal(f.renders.length,1);assert.equal(f.scheduler.pending.size,0);
  f.doc.documentElement.dataset.quality='saver';f.observers.at(-1).fn();assert.equal(f.controller.getDiagnostics().pixelRatio,1);f.scheduler.flush();assert.equal(f.renders.length,2);assert.equal(f.scheduler.pending.size,0);f.controller.dispose();assertReleased(f);
});
test('context loss releases renderer/textures/listeners and does not retry behind static fallback',()=>{
  const f=fixture();f.ready();f.scheduler.flush();const event=new ControlledEvent('webglcontextlost',{bubbles:false});f.renderer.domElement.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.deepEqual(f.states,['ready','fallback']);assertReleased(f);assert.equal(f.controller.getDiagnostics().rendererCount,0);
  f.ready();f.error();assert.deepEqual(f.states,['ready','fallback']);assert.equal(f.disposedTextures(),1);f.controller.dispose();assertReleased(f);
});
test('constructor, texture and draw failures preserve static fallback and clean partial ownership',()=>{
  const unavailable=fixture({constructorFails:true});assert.deepEqual(unavailable.states,['fallback']);assertReleased(unavailable);
  const missing=fixture();missing.error();assert.deepEqual(missing.states,['fallback']);assertReleased(missing);missing.ready();assert.equal(missing.disposedTextures(),1);
  const sync=fixture({textureFailsSync:true});assert.deepEqual(sync.states,['fallback']);assertReleased(sync);assert.equal(sync.disposedTextures(),1);
  const broken=fixture();broken.setRenderFails();broken.ready();broken.scheduler.flush();assert.deepEqual(broken.states,['fallback']);assertReleased(broken);
});
test('close before image decode and persisted page lifecycle cannot revive disposed views',()=>{
  const f=fixture();f.controller.dispose();f.ready();assert.deepEqual(f.states,[]);assertReleased(f);assert.equal(f.disposedTextures(),1);
  const b=fixture();b.ready();b.win.dispatchEvent(new ControlledEvent('pagehide',{persisted:true}));assert.equal(b.scheduler.pending.size,0);assert.equal(b.renderer.disposeCount,0);b.win.dispatchEvent(new ControlledEvent('pageshow',{persisted:true}));b.scheduler.flush();assert.deepEqual(b.states,['ready']);b.win.dispatchEvent(new ControlledEvent('pagehide',{persisted:false}));assertReleased(b);
});
test('new display guidance exists independently in all five locales without raw untranslated keys',()=>{
  for(const locale of LOCALES)for(const key of MEDAL_PRESENTATION_COPY_KEYS){const copy=medalPresentationText(key,locale);assert.ok(copy.length>0);assert.notEqual(copy,key);if(locale!=='zh-Hant')assert.notEqual(copy,medalPresentationText(key,'zh-Hant'));}
});
test('static cards have visible lock/check distinction; the detail has no automatic animation or save hooks',()=>{
  const css=readFileSync(new URL('../src/championship/app/medalCollection.css',import.meta.url),'utf8');assert.match(css,/data-acquired="false"[^}]*filter:grayscale\(1\)/);assert.match(css,/state-icon--locked::before/);assert.match(css,/state-icon--earned/);assert.match(css,/\[hidden\] \{ display:none!important/);
  const adapter=readFileSync(new URL('../src/championship/presentation/medals/medalThreePresentation.js',import.meta.url),'utf8');assert.doesNotMatch(adapter,/setInterval|setTimeout|setAnimationLoop|localStorage|saveGame|battleBadges\s*=/);
});

test('canonical locale scanner validates every scoped dictionary key and does not ignore stray literals',async()=>{
  const file='src/championship/presentation/medals/medalPresentationText.js';
  const checked=inspectScopedLocaleCopy(file,MEDAL_PRESENTATION_COPY);
  assert.equal(checked.keys.length,5);assert.deepEqual(checked.gaps,[]);
  for(const locale of LOCALES)for(const key of MEDAL_PRESENTATION_COPY_KEYS)assert.equal(checked.covers({file,text:MEDAL_PRESENTATION_COPY[locale][key]}),true);
  assert.equal(checked.covers({file,text:'未翻譯的新文字'}),false);
  assert.equal(checked.covers({file:'src/championship/app/not-a-dictionary.js',text:MEDAL_PRESENTATION_COPY['zh-Hant'].controls}),false);
  const missing=JSON.parse(JSON.stringify(MEDAL_PRESENTATION_COPY));delete missing.vi.reset;
  assert.deepEqual(inspectScopedLocaleCopy(file,missing).gaps,[`vi:SCOPED_COPY[${file}:reset]`]);
  delete missing.th;assert.equal(inspectScopedLocaleCopy(file,missing).gaps.filter(gap=>gap.startsWith('th:')).length,5);
  const report=await buildLocaleCoverage();assert.equal(report.counts.missing,0);assert.equal(report.counts.catalogGaps,0);
  assert.deepEqual(report.scopedCopy.find(row=>row.file===file),{file,keyCount:5,gaps:[]});
});

test('face aspect fits landscape,portrait,square and invalid sizes without replacing geometry',()=>{
  const m=createMedalGeometry({silhouette:traceMedalSilhouette({width:8,height:8,data:new Uint8Array(256).fill(255)}),presentationProfile:{shape:'free',material:'gold'}}),face=m.group.getObjectByName('flat_badge_face'),geometry=face.geometry;
  for(const [width,height,x,y] of [[512,473,1,473/512],[473,512,473/512,1],[128,128,1,1],[512,256,1,.5],[256,512,.5,1],[0,512,1,1],[512,0,1,1],[-1,512,1,1],[Infinity,512,1,1],[512,NaN,1,1],[undefined,512,1,1],['512',473,1,1]]){
    m.fitFaceAspect(width,height);assert.deepEqual(face.scale.toArray(),[x,y,1]);assert.equal(face.geometry,geometry);
    assert.equal(Math.max(geometry.parameters.width*face.scale.x,geometry.parameters.height*face.scale.y),2.28);
  }
  let releases=0;geometry.addEventListener('dispose',()=>releases++);m.fitFaceAspect(512,473);const last=face.scale.toArray();m.dispose();m.fitFaceAspect(473,512);m.dispose();assert.deepEqual(face.scale.toArray(),last);assert.equal(releases,1);
});
test('texture completion uses natural image aspect, retains width,height fallback and remains on demand',()=>{
  for(const [image,expected] of [
    [{naturalWidth:512,naturalHeight:473,width:128,height:128},[1,473/512,1]],
    [{naturalWidth:473,naturalHeight:512},[473/512,1,1]],
    [{naturalWidth:128,naturalHeight:128},[1,1,1]],
    [{width:64,height:128},[.5,1,1]],
    [{naturalWidth:0,naturalHeight:0,width:512,height:473},[1,1,1]],
    [{},[1,1,1]]
  ]){
    const f=fixture();f.ready(image);f.scheduler.flush();assert.deepEqual(f.renders[0].scene.getObjectByName('flat_badge_face').scale.toArray(),expected);assert.equal(f.renders.length,1);assert.equal(f.scheduler.pending.size,0);f.controller.dispose();assertReleased(f);
  }
});
test('late texture completion cannot resize a disposed face or resume rendering',()=>{
  const f=fixture();f.ready({naturalWidth:512,naturalHeight:473});f.scheduler.flush();const face=f.renders[0].scene.getObjectByName('flat_badge_face'),scale=face.scale.toArray();let releases=0;face.geometry.addEventListener('dispose',()=>releases++);
  f.controller.dispose();f.ready({naturalWidth:473,naturalHeight:512});f.scheduler.flush();assert.deepEqual(face.scale.toArray(),scale);assert.equal(releases,1);assert.equal(f.renders.length,1);assert.equal(f.textures[0].image,null);assert.equal(f.disposedTextures(),1);assertReleased(f);
});


test('source-alpha profiles and distinct finishes reach real geometry without altering face',()=>{
 const colors=new Set();for(const material of ['copper','silver','gold','paleBlueSilver','crystal']){
  const m=createMedalGeometry({silhouette:traceMedalSilhouette({width:8,height:8,data:new Uint8Array(256).fill(255)}),presentationProfile:{shape:'free',material}}),base=m.group.getObjectByName('metal_base');colors.add(base.material[1].color.getHex());assert.equal(base.geometry.parameters.shapes[0].getPoints().length,4);assert.equal(m.getDiagnostics().baseShape,'SOURCE_ALPHA_SILHOUETTE');m.dispose();
 }assert.equal(colors.size,5);assert.throws(()=>createMedalGeometry());assert.throws(()=>createMedalGeometry({presentationProfile:{shape:'free',material:'gold'}}));
 const f=fixture({presentationProfile:{shape:'free',material:'gold'}});f.ready({width:8,height:8});f.scheduler.flush();assert.equal(f.controller.getDiagnostics().silhouetteReads,1);assert.equal(f.controller.getDiagnostics().shape.baseShape,'SOURCE_ALPHA_SILHOUETTE');
 f.ready({width:8,height:8});f.emit('keydown',{key:'ArrowLeft'});f.scheduler.flush();assert.equal(f.controller.getDiagnostics().silhouetteReads,1);f.controller.dispose();assertReleased(f);
});
test('unreadable or overcomplex free contours and unknown profiles fail closed with complete resource cleanup',()=>{
 for(const reason of ['alpha_read_failed','component_limit','vertex_limit']){const f=fixture({presentationProfile:{shape:'free',material:'gold'},silhouetteResult:{ok:false,reason}});f.ready();assert.deepEqual(f.states,['fallback']);assert.equal(f.controller.getDiagnostics().fallbackReason,reason);assert.equal(f.controller.getDiagnostics().ready,false);assertReleased(f);assert.equal(f.disposedTextures(),1);f.controller.dispose();assertReleased(f);}
 const f=fixture({presentationProfile:{shape:'unknown',material:'gold'}});assert.deepEqual(f.states,['fallback']);assert.equal(f.controller.getDiagnostics().fallbackReason,'unknown_presentation_profile');assert.equal(f.textures.length,0);assertReleased(f);
});
test('all profiles read source alpha once and lazy mount forwards immutable presentation descriptor',async()=>{
 const f=fixture();f.ready();f.scheduler.flush();assert.equal(f.controller.getDiagnostics().silhouetteReads,1);f.controller.dispose();
 const profile=Object.freeze({shape:'free',material:'paleBlueSilver'});let actual;const p=mountSelectedMedalPresentation({presentationProfile:profile,load:()=>({mountMedalThreePresentation(options){actual=options.presentationProfile;return {dispose(){}};}})});await flushMicrotasks();assert.equal(actual,profile);p.dispose();
});


test('free mesh geometry and materials release exactly once on context loss and cannot restart work',()=>{
 const f=fixture({presentationProfile:{shape:'free',material:'gold'}});f.ready({width:8,height:8});f.scheduler.flush();
 const resources=new Set();f.renders[0].scene.getObjectByName('PROFILED_MEDAL_WITH_2D_FACE').traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)resources.add(m);});
 assert.equal(resources.size,5);let releases=0;for(const resource of resources)resource.addEventListener('dispose',()=>releases++);
 f.emit('keydown',{key:'ArrowLeft'});assert.equal(f.scheduler.pending.size,1);f.renderer.domElement.dispatchEvent(new ControlledEvent('webglcontextlost',{bubbles:false}));assert.equal(releases,5);assertReleased(f);
 f.ready();f.controller.reset();f.controller.dispose();f.scheduler.flush();assert.equal(releases,5);assert.equal(f.renders.length,1);assert.equal(f.disposedTextures(),1);assert.equal(f.controller.getDiagnostics().silhouetteReads,1);
});


test('crystal thickness is dielectric and faceted without costly transmission passes',()=>{
 const m=createMedalGeometry({silhouette:traceMedalSilhouette({width:8,height:8,data:new Uint8Array(256).fill(255)}),presentationProfile:{shape:'free',material:'crystal'}});
 for(const material of m.group.getObjectByName('metal_base').material){assert.equal(material.transmission,0);assert.equal(material.flatShading,true);assert.ok(material.metalness<.1);assert.equal(material.ior,2.4);assert.equal(material.clearcoat,1);}
 assert.equal(m.group.children.length,2);m.dispose();
});

test('legacy round and hex descriptors cannot invent backing geometry',()=>{
 for(const shape of ['round','hex'])assert.throws(()=>createMedalGeometry({silhouette:traceMedalSilhouette({width:8,height:8,data:new Uint8Array(256).fill(255)}),presentationProfile:{shape,material:'gold'}}));
 for(const locale of LOCALES){assert.equal(Object.hasOwn(MEDAL_PRESENTATION_COPY[locale],'technique'),false);assert.equal(medalPresentationText('technique',locale),'');}
});
