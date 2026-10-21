import * as PIXI from '/assets/production/public-runtime/vendor-pixi.mjs';
import * as THREE from 'three';
import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {createHM02ThreePilot} from '/src/championship/presentation/vs2/createHM02ThreePilot.mjs';
import {loadHM02ThreePilot} from '/src/championship/presentation/vs2/loadHM02ThreePilot.mjs';
import {projection} from '/src/championship/presentation/vs2/hm02Projection.mjs';
const manifest=await (await fetch('/src/championship/presentation/vs2/manifest.candidate.json')).json();
const map=projection(manifest.projection),app=new PIXI.Application();
await app.init({width:390,height:844,resolution:1,autoStart:false,preference:'webgl',backgroundAlpha:0,antialias:false});document.body.append(app.canvas);app.canvas.dataset.hm02GameCanvas='true';
const background=new PIXI.Graphics().rect(0,0,390,844).fill(0xff00ff);app.stage.addChild(background);
const overlay=new PIXI.Graphics().rect(5,5,10,10).fill(0x00ffff);app.stage.addChild(overlay);
const actorCanvas=document.createElement('canvas');actorCanvas.width=32;actorCanvas.height=96;actorCanvas.getContext('2d').fillStyle='#ffff00';actorCanvas.getContext('2d').fillRect(0,0,32,96);actorCanvas.getContext('2d').clearRect(14,50,4,4);
const sprite=new PIXI.Sprite(PIXI.Texture.from(actorCanvas));sprite.anchor.set(.5);const node=new PIXI.Container();node.addChild(sprite);node.characterSprite=sprite;node.body=new PIXI.Graphics();node.contactShadow=new PIXI.Graphics();node.threeContactEllipses=[{x:0,y:4,radiusX:11,radiusY:4}];node.addChild(node.body,node.contactShadow);app.stage.addChild(node);
let view,wild,pilot,renderers=[],fallbacks=[],restoreCount=0,lost=new Set(),controller,mode='normal',fixtures=[],lossExtension=null;
const stage={PIXI,app,onContextLost(fn){lost.add(fn);return()=>lost.delete(fn);}};
app.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();for(const fn of [...lost])fn();});
function setView(x=2500,y=2500,z=0){wild={wildId:'synthetic-native-origin',speciesId:'TEST_ONLY',worldX:x,worldY:y,worldZ:z};view={wildCreatures:[wild],worldWidthPx:2880,worldHeightPx:2880,transform:{scale:1},viewRect:{left:x-195,top:y-422,right:x+195,bottom:y+422},visibleMapRect:{left:x-195,top:y-422,right:x+195,bottom:y+422}};node.position.set(195,422-z);}
setView();
// Warm the original Pixi scene before creating ANY pilot renderer. Capability
// probes are startup resources, not a second scene context; keep them visible
// in diagnostics rather than resetting the lifetime counter.
app.renderer.render({container:app.stage});
const baselineContexts=new Set(window.__hmContexts??[]);
function contextEvidence(){const records=window.__hmContextRecords??[];return {
 baselineCount:baselineContexts.size,totalCount:window.__hmContexts?.size??0,
 addedAfterPixiBaseline:[...(window.__hmContexts??[])].filter(c=>!baselineContexts.has(c)).length,
 sceneContexts:records.filter(r=>r.canvas===app.canvas).length,
 sharedRenderers:renderers.map(r=>({sameCanvas:r.domElement===app.canvas,sameContext:r.getContext()===app.renderer.gl})),
 records:records.map(r=>({kind:r.kind,stack:r.stack,baseline:baselineContexts.has(r.context),scene:r.canvas===app.canvas,connected:r.canvas.isConnected,width:r.canvas.width,height:r.canvas.height,parent:r.canvas.parentElement?.tagName??null,display:r.canvas.isConnected?getComputedStyle(r.canvas).display:null,lost:r.context.isContextLost()})),
 domCanvases:[...document.querySelectorAll('canvas')].map(c=>({scene:c===app.canvas,width:c.width,height:c.height,parent:c.parentElement?.tagName,display:getComputedStyle(c).display}))
};}
let lastRenderTrace=[];
class TrackedRenderer extends THREE.WebGLRenderer{
 constructor(options){super(options);renderers.push(this);const originalRender=this.render;
 this.render=(scene,camera)=>{const originals=[],shadows=new Set();scene.traverse(o=>{if(o.userData.shadow)shadows.add(o.userData.shadow);});lastRenderTrace=[];
  scene.traverse(o=>{if(!o.isMesh)return;const original=o.onBeforeRender;originals.push([o,original]);o.onBeforeRender=function(...args){const m=args[4];lastRenderTrace.push({kind:shadows.has(o)?'contact-shadow':o.userData.shadow?'actor':'scenery',name:o.name,transparent:m.transparent,depthTest:m.depthTest,depthWrite:m.depthWrite,renderOrder:o.renderOrder});return original.apply(this,args);};});
  try{return originalRender.call(this,scene,camera);}finally{for(const [o,fn]of originals)o.onBeforeRender=fn;}
 };}
}
class DiagnosticScene extends THREE.Scene{constructor(){super();if(mode==='pillar'){const m=new THREE.Mesh(new THREE.BoxGeometry(1.1,2,1),new THREE.MeshBasicMaterial({color:0xff0000}));m.position.set(...map.ground(2500,2530,-.005));m.position.y+=1;this.add(m);fixtures.push(m);}}}
class InjectableMaterial extends THREE.MeshBasicMaterial{constructor(options){super(options);if(mode==='badShader'){Object.defineProperty(this,'onBeforeCompile',{configurable:true,set(fn){this._fn=fn;},get(){return shader=>{this._fn?.(shader);shader.fragmentShader+='\nTHIS_IS_AN_INTENTIONAL_SHADER_FAILURE';};}});}}}
function pixels(){const gl=app.renderer.gl,p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);const at=(x,y)=>{x*=app.renderer.resolution;y*=app.renderer.resolution;const n=((gl.drawingBufferHeight-1-Math.round(y))*gl.drawingBufferWidth+Math.round(x))*4;return [...p.slice(n,n+4)];};return {lower:at(app.screen.width/2,app.screen.height/2+28),upper:at(app.screen.width/2,app.screen.height/2-22),opaqueShadowOverlap:at(app.screen.width/2-7,app.screen.height/2+4),transparentHole:at(app.screen.width/2-1,app.screen.height/2+4),ui:at(8,8),fallback:at(50,50)};}
function draw(){pilot?.sync({view,wildNodes:new Map([[wild.wildId,node]]),backgroundNodes:[background]});app.renderer.render({container:app.stage});return {renderTrace:lastRenderTrace,glTextures:window.__hmTextureAudit?.snapshot(app.renderer.gl),pixels:pixels(),active:pilot?.getDiagnostics().active??false,fallbacks:[...fallbacks],restoreCount,contextEvidence:contextEvidence(),contexts:window.__hmContexts?.size??null,canvasCount:document.querySelectorAll('canvas').length,rendererInfo:renderers.at(-1)?.info.render};}
function clearFixtures(){for(const m of fixtures){m.geometry.dispose();m.material.dispose();}fixtures=[];}
async function mount(options={}){pilot?.dispose();controller?.abort();clearFixtures();controller=new AbortController();mode=options.mode??'normal';fallbacks=[];setView(options.x??2500,options.y??2500,options.z??0);background.renderable=true;node.threeContactEllipses=options.shadow===false?[]:[{x:0,y:4,radiusX:11,radiusY:4}];
 if(options.realLoader){pilot=await loadHM02ThreePilot({stage,fieldArt:{getDiagnostics:()=>({fieldId:options.fieldId??'field_hm02_01'})},fieldSource:{field:{getView:()=>view}},signal:controller.signal,onFallback:e=>fallbacks.push(e.message)});}
 else pilot=await createHM02ThreePilot({THREE:{...THREE,WebGLRenderer:TrackedRenderer,Scene:DiagnosticScene,MeshBasicMaterial:InjectableMaterial},GLTFLoader,stage,enabled:true,reviewHarness:true,fieldId:'field_hm02_01',manifest,signal:controller.signal,resolveSupport:()=>({verifiedSourceId:manifest.flatSupport.verifiedSourceId,groundHeight:-.005}),onFallback:e=>fallbacks.push(e.message)});
 pilot?.setFallbackRestore(()=>restoreCount++);return draw();}
window.hm02={mount,draw,contextEvidence,dispose(){pilot?.dispose();controller?.abort();clearFixtures();return draw();},resize(w,h,dpr){app.renderer.resize(w,h,dpr);view.viewRect={left:wild.worldX-w/2,top:wild.worldY-h/2,right:wild.worldX+w/2,bottom:wild.worldY+h/2};view.visibleMapRect={...view.viewRect};node.position.set(w/2,h/2-(wild.worldZ??0));return draw();},get(){return {active:pilot?.getDiagnostics().active??false,fallbacks,restoreCount,listenerCount:lost.size,glTextures:window.__hmTextureAudit?.snapshot(app.renderer.gl),rendererMemory:renderers.map(r=>({...r.info.memory}))};},loseContext(){lossExtension=app.renderer.gl.getExtension('WEBGL_lose_context');if(!lossExtension)throw Error('CONTEXT_LOSS_EXTENSION_UNAVAILABLE');lossExtension.loseContext();},restoreContext(){lossExtension?.restoreContext();},versions:{three:THREE.REVISION,pixi:PIXI.VERSION},ready:true};
