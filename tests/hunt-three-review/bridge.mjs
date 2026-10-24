// REVIEW BUILD ONLY. No raw app/runtime/nodes escape; no new clock/ticker/RAF.
// Calls are synchronous presentation work. Native state equality is mandatory.
const identities=new WeakMap();let nextIdentity=1;
export function actionsIdentity(value){if(!value)return null;if(!identities.has(value))identities.set(value,nextIdentity++);return identities.get(value);}
const HOSTS=['localhost','127.0.0.1','[::1]'];
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=n=>Number.isFinite(n)?n:null;
const registry={version:'HUNT_ACTIONS_OBSERVER.v1',instrumented:true,generation:0,current:null,disposed:[],errors:[]};
const err=e=>String(e?.message??e).slice(0,300);
const recordError=e=>{const message=err(e);if(!registry.errors.includes(message)&&registry.errors.length<8)registry.errors.push(message);};
export function createPassiveTimingLedger(rendererIdentity){
 const rows=[];let total=0,invalid=0;
 return {record(input){total++;const keys=['wallMs','elapsedMS','deltaMS','speed','simulationMs','presentationSyncMs','charactersMs','observerMs','nativeFrame'];
  if(!input||keys.some(k=>!Number.isFinite(input[k])||input[k]<0)){invalid++;return;}
  rows.push(Object.fromEntries(keys.map(k=>[k,input[k]])));if(rows.length>64)rows.shift();
 },snapshot(){return {schema:'HUNT_PASSIVE_TIMING.v1',scope:'EXISTING_TICKER_CPU_DURATIONS_NOT_GPU_COMPLETION',rendererIdentity:{...rendererIdentity},total,invalid,retained:rows.length,rows:rows.map(r=>({...r}))};}};
}
export function readReviewRendererIdentity(renderer){
 const gl=renderer?.gl,out={context:'WEBGL',available:false};if(!gl)return {...out,context:'UNAVAILABLE'};
 try{const clean=v=>typeof v==='string'?v.slice(0,160):null;out.vendor=clean(gl.getParameter(gl.VENDOR));out.renderer=clean(gl.getParameter(gl.RENDERER));out.version=clean(gl.getParameter(gl.VERSION));
 const ext=gl.getExtension?.('WEBGL_debug_renderer_info');out.unmaskedVendor=ext?clean(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)):null;out.unmaskedRenderer=ext?clean(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):null;out.available=Boolean(out.renderer);}
 catch{out.error='RENDERER_IDENTITY_UNAVAILABLE';}return out;
}
function intersection(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;}
export function installHuntActionsProbe({app,fieldArt,threePilot,getView,getNodes,getDrawOrder,renderPresentation,readAuthority}){
 const location=globalThis.location;if(!HOSTS.includes(location?.hostname)||new URL(location.href).searchParams.get('huntActionsReview')!=='1')return null;
 if(typeof readAuthority!=='function')throw Error('HUNT_ACTIONS_AUTHORITY_REQUIRED');
 if(registry.current)throw Error('HUNT_ACTIONS_OVERLAPPING_FIELD_OWNER');
 const generation=++registry.generation;let disposed=false,capturing=false,armed=false,observerFailed=false,lostExtension=null,knownIds=new Set(),queue=[],frames=0,lastPhases=new Map(),transitions=[],captured=new Set(),borrowedDestroyCalls=0;
 const timing=createPassiveTimingLedger(readReviewRendererIdentity(app.renderer));
 const authoritative=()=>JSON.stringify({authority:readAuthority([...knownIds]),view:getView(),phase:fieldArt?.getDiagnostics?.().frameIndex});
 function snapshot(){
  const view=getView(),nodes=getNodes(),actors=[];if(!view)return {generation,inactive:true,frames,errors:clone(registry.errors)};for(const wild of view.wildCreatures??[])knownIds.add(wild.wildId);
  for(const wild of view.wildCreatures??[]){const node=nodes.get(wild.wildId),sprite=node?.characterSprite;let box=sprite?.getBounds?.();if(sprite?.visualBounds&&sprite?.getGlobalTransform){const v=sprite.visualBounds,matrix=sprite.getGlobalTransform(),points=[[v.minX,v.minY],[v.maxX,v.minY],[v.maxX,v.maxY],[v.minX,v.maxY]].map(([x,y])=>matrix.apply({x,y})),xs=points.map(p=>p.x),ys=points.map(p=>p.y);box={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
   actors.push({wildId:wild.wildId,speciesId:wild.speciesId,worldX:finite(wild.worldX),worldY:finite(wild.worldY),worldZ:finite(wild.worldZ??0),passage:wild.passage??null,passageAlpha:finite(wild.passageAlpha??1),currentHp:finite(wild.currentHp),maxHp:finite(wild.maxHp),bound:wild.bound===true,state:wild.state??null,aiState:wild.aiState??null,x:(view.viewportOffset?.x??0)+(wild.worldX-(view.viewRect??view.camera).left)*view.transform.scale,y:(view.viewportOffset?.y??0)+(wild.worldY-(view.viewRect??view.camera).top)*view.transform.scale,
    node:node?{visible:node.visible,alpha:node.alpha,scale:{x:node.scale.x,y:node.scale.y},zIndex:node.zIndex}:null,
    sprite:sprite?{visible:sprite.visible,alpha:sprite.alpha,tint:sprite.tint,x:sprite.x,y:sprite.y,scale:{x:sprite.scale.x,y:sprite.scale.y},anchor:{x:sprite.anchor.x,y:sprite.anchor.y},bounds:box?{x:box.x,y:box.y,width:box.width,height:box.height}:null,frame:clone(sprite.texture.frame),orig:clone(sprite.texture.orig),trim:sprite.texture.trim?clone(sprite.texture.trim):null}:null,
    nativeFrame:node?.nativeFramePresenter?.getSnapshot?.()??null,contactShadow:node?.contactShadow?{x:node.contactShadow.x,y:node.contactShadow.y,alpha:node.contactShadow.alpha,visible:node.contactShadow.visible,scale:{x:node.contactShadow.scale.x,y:node.contactShadow.scale.y},ellipses:clone(node.threeContactEllipses??[])}:null});
  }
  return clone({generation,appIdentity:actionsIdentity(app),frames,renderActors:threePilot?.actionsReviewSnapshot?.()??null,diagnostics:threePilot?.getDiagnostics?.()??null,art:fieldArt?.getDiagnostics?.()??null,view:{worldWidthPx:view.worldWidthPx,worldHeightPx:view.worldHeightPx,viewRect:view.viewRect??view.camera,visibleMapRect:view.visibleMapRect,transform:view.transform,viewportOffset:view.viewportOffset},viewport:{width:app.screen.width,height:app.screen.height,resolution:app.renderer.resolution},authority:readAuthority([...knownIds]),actors,transitions,errors:registry.errors,resources:globalThis.__huntActionsResources?.snapshot?.()??null});
 }
 function compare({targetId=null,stressOpacity=null,omitIds=[],unoccluded=false}={}){
  if(disposed||capturing)throw Error('HUNT_ACTIONS_CAPTURE_STATE');
  const initial=snapshot();if(initial.inactive)throw Error('HUNT_ACTIONS_INACTIVE_VIEW');
  if(!threePilot?.getDiagnostics?.().threeUsed)throw Error('HUNT_ACTIONS_THREE_REQUIRED');
  if(stressOpacity!==null&&![0,.05].includes(stressOpacity))throw Error('HUNT_ACTIONS_STRESS_VALUE');
  if(stressOpacity!==null&&!targetId)throw Error('HUNT_ACTIONS_STRESS_TARGET_REQUIRED');
  const nodes=getNodes();if(targetId&&!nodes.has(targetId))throw Error('HUNT_ACTIONS_TARGET_MISSING');
  if(omitIds.some(id=>!nodes.has(id)))throw Error('HUNT_ACTIONS_OMISSION_MISSING');
  const before=authoritative(),node=targetId?nodes.get(targetId):null,originalAlpha=node?.alpha,suspended=threePilot.getDiagnostics().threeUsed===false;
  const gl=app.renderer.gl,unpack=()=>[gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.UNPACK_ALIGNMENT].map(k=>gl.getParameter(k)),unpackBefore=unpack();
  const savedVis=[],renderPasses=[];let failure=null;capturing=true;
  const picture=()=>{app.renderer.render({container:app.stage});return app.canvas.toDataURL('image/png');};
  const applyStress=()=>{if(stressOpacity!==null)node.alpha=stressOpacity;};
  function draw(kind,{omitted=[],reference=false,noDepth=false}={}){
   threePilot.setReviewSuspended(kind==='two');renderPresentation();
   if(kind==='three'){
    // Override only existing instrumented materials; do not resync/hide backgrounds.
    const stress=stressOpacity===null?null:{id:targetId,opacity:stressOpacity*(node.characterSprite.alpha??1),shadowOpacity:.48*stressOpacity*(node.contactShadow.alpha??1)};
    const png=threePilot.actionsReviewRender({omitIds:omitted,depthReference:reference,drawOrder:getDrawOrder(),stress,unoccludedTarget:noDepth?targetId:null},picture);renderPasses.push({kind,omitted,reference,noDepth,trace:threePilot.actionsReviewSnapshot?.().reviewPass??null});return png;
   }
   applyStress();
   for(const id of omitted){const n=nodes.get(id);for(const value of [n.characterSprite,n.body,n.contactShadow])if(value){savedVis.push([value,value.renderable]);value.renderable=false;}}
   try{return picture();}finally{for(const [value,renderable]of savedVis)value.renderable=renderable;savedVis.length=0;}
  }
  try{
   const sample=snapshot(),images={three:draw('three'),two:draw('two')};
   images.reference=draw('three',{reference:true});
   if(targetId){images.omitted=draw('three',{omitted:[targetId]});images.twoOmitted=draw('two',{omitted:[targetId]});}
   if(unoccluded&&targetId)images.unoccluded=draw('three',{noDepth:true});
   if(omitIds.length>1)images.targetOnly=draw('three',{omitted:omitIds.filter(id=>id!==targetId)});
   if(omitIds.length)images.groupOmitted=draw('three',{omitted:omitIds});
   const result={kind:stressOpacity===null?'NATIVE_SAME_FRAME':'CONTROLLED_PRESENTATION_STRESS_NOT_NATURAL',stressOpacity,targetId,omitIds,renderPasses,nativeBefore:before,sample,images,depthReference:{instrumentedOnly:true,depthWrite:false,nativeDrawOrder:getDrawOrder(),opaqueDepthTestPreserved:true}};
   return result;
  }catch(error){failure=error;throw error;}finally{
   const errors=[],attempt=fn=>{try{fn();}catch(e){errors.push(e);}};
   try{attempt(()=>{if(node)node.alpha=originalAlpha;});attempt(()=>threePilot.setReviewSuspended(suspended));attempt(renderPresentation);attempt(()=>app.renderer.render({container:app.stage}));
    attempt(()=>{if(authoritative()!==before)throw Error('HUNT_ACTIONS_NATIVE_STATE_CHANGED_DURING_CAPTURE');});
    attempt(()=>{if(JSON.stringify(unpack())!==JSON.stringify(unpackBefore))throw Error('HUNT_ACTIONS_UNPACK_CHANGED');});
   }finally{capturing=false;}
   if(errors.length){errors.forEach(recordError);throw new AggregateError([...(failure?[failure]:[]),...errors],'HUNT_ACTIONS_CAPTURE_RESTORE_FAILED');}
  }
 }
 function observe(input=null){
  if(disposed||capturing||observerFailed)return;frames++;const observationStart=performance.now();let nativeFrame=null;
  try{const s=snapshot();nativeFrame=s.authority?.tool?.frame??null;if(s.inactive)return;const observed=[...s.actors,...(s.authority.records??[]).filter(r=>r?.nativePhase?.wildHidden&&['ENTER','HIDDEN'].includes(lastPhases.get(r.wildId))&&!['HAND_ANIMATION','ON_CARD','HOME_COMMITTED','RELEASED'].includes(r.state)&&!s.actors.some(a=>a.wildId===r.wildId)).map(r=>({wildId:r.wildId,passage:'HIDDEN',passageAlpha:0,currentHp:r.currentHp}))];for(const a of observed){const previous=lastPhases.get(a.wildId)??null;if(previous!==a.passage){if(transitions.length>=96)throw Error('HUNT_ACTIONS_TRANSITION_BUDGET');transitions.push({frame:frames,wildId:a.wildId,from:previous,to:a.passage,alpha:a.passageAlpha,hp:a.currentHp});lastPhases.set(a.wildId,a.passage);}}
   if(!armed||queue.length>=2)return;
   for(const a of s.actors){
    if(!a.passage||!a.sprite?.bounds||a.passageAlpha>.07)continue;
    const screen={x:0,y:0,width:s.viewport.width,height:s.viewport.height};if(!intersection(a.sprite.bounds,screen))continue;
    const peers=s.actors.filter(b=>b.wildId!==a.wildId&&b.sprite?.bounds&&intersection(a.sprite.bounds,b.sprite.bounds));
    const label=`${a.passage}:${a.passageAlpha===0?'zero':'near'}:${peers.length?'overlap':'alone'}`;if(captured.has(label))continue;
    captured.add(label);queue.push({label,natural:true,actualAlpha:a.passageAlpha,peers:peers.map(p=>p.wildId),capture:compare({targetId:a.wildId,omitIds:[a.wildId,...peers.map(p=>p.wildId)]})});break;
   }
  }catch(error){recordError(error);armed=false;observerFailed=true;}
  finally{if(input)timing.record({...input,nativeFrame,observerMs:performance.now()-observationStart});}
 }
 const publicAPI=Object.freeze({snapshot,compare,timing:()=>timing.snapshot(),arm(){armed=true;return {generation,armed};},take(){return queue.shift()??null;},loseContext(){const ext=app.renderer.gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('CONTEXT_LOSS_EXTENSION_UNAVAILABLE');lostExtension=ext;ext.loseContext();return true;},restoreContext(){if(!lostExtension)throw Error('NO_TEST_CONTEXT_LOSS');lostExtension.restoreContext();return true;}});
 registry.current={generation,api:publicAPI};
 if(!globalThis.__huntActions)Object.defineProperty(globalThis,'__huntActions',{configurable:false,writable:false,value:Object.freeze({version:registry.version,instrumented:true,timing:()=>registry.current?.api.timing()??{available:false},snapshot:()=>registry.current?.api.snapshot()??{generation:null,disposed:clone(registry.disposed),errors:clone(registry.errors)},compare:o=>{if(!registry.current)throw Error('NO_ACTIVE_HUNT');return registry.current.api.compare(o);},arm:()=>registry.current?.api.arm(),take:()=>registry.current?.api.take()??null,loseContext:()=>registry.current?.api.loseContext(),restoreContext:()=>registry.current?.api.restoreContext()})});
 return {observe,disposePilot(callback){
   const borrowed=new Set([...getNodes().values()].map(n=>n.characterSprite?.texture).filter(Boolean)),prototypes=new Map();
   for(const texture of borrowed){const p=Object.getPrototypeOf(texture);if(prototypes.has(p))continue;const original=p.destroy;prototypes.set(p,original);p.destroy=function(...args){if(borrowed.has(this))borrowedDestroyCalls++;return original.apply(this,args);};}
   try{return callback();}finally{for(const [p,original]of prototypes)p.destroy=original;}
  },dispose(){if(disposed)return;disposed=true;const diagnostics=threePilot?.getDiagnostics?.()??null;registry.disposed.push({generation,diagnostics,borrowedDestroyCalls,frames});if(registry.disposed.length>24)registry.disposed.shift();if(registry.current?.generation===generation)registry.current=null;queue=[];if(borrowedDestroyCalls)recordError('BORROWED_PIXI_TEXTURE_DESTROYED_BY_PILOT');}};
}
