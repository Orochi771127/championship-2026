import {withSharedUnpackState} from './sharedGLState.mjs';
export function abortable(promise,signal,disposeLate=()=>{}) {
  if(signal?.aborted){Promise.resolve(promise).then(disposeLate,()=>{});return Promise.reject(signal.reason??new DOMException('Aborted','AbortError'));}
  return new Promise((resolve,reject)=>{
    let settled=false;
    const abort=()=>{if(settled)return;settled=true;reject(signal.reason??new DOMException('Aborted','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(value=>{
      signal?.removeEventListener('abort',abort);
      if(settled){disposeLate(value);return;}settled=true;resolve(value);
    },error=>{signal?.removeEventListener('abort',abort);if(!settled){settled=true;reject(error);}});
  });
}
export function createResourceDisposer(){
  const disposed=new WeakSet(),errors=[];
  const attempt=callback=>{try{callback();}catch(error){errors.push(String(error?.message??error));}};
  const once=value=>{if(!value||disposed.has(value))return;disposed.add(value);attempt(()=>value.dispose?.());};
  function texture(t){
    once(t);const image=t?.source?.data??t?.image;
    if(image&&typeof image.close==='function'&&!disposed.has(image)){disposed.add(image);attempt(()=>image.close());}
  }
  function gltf(value){
    const textures=new Set();
    value?.scene?.traverse(o=>{if(o.isInstancedMesh)once(o);once(o.geometry);for(const m of [].concat(o.material??[])){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);once(m);}});
    for(const t of textures)texture(t);
  }
  return {once,gltf,texture,getErrors:()=>errors.slice()};
}
export function shaderFailureGuard(renderer){
  let failure=null;
  renderer.debug.checkShaderErrors=true;
  renderer.debug.onShaderError=()=>{failure=new Error('HM02_SHADER_COMPILE_OR_LINK_FAILED');};
  return {draw(callback){callback();if(failure)throw failure;}};
}

// One renderer generation per owning Pixi Application/context, not per field.
// No unknown GL resources are deleted and the Pixi context is never lost here.
const appRenderers=new WeakMap();
export function leaseHuntRenderer({THREE,app,onInvalidate}){
  let entry=appRenderers.get(app);
  if(entry&&entry.gl!==app.renderer.gl){entry.retire(new Error('HM02_CONTEXT_GENERATION_CHANGED'));entry=null;}
  if(entry?.leased)throw new Error('HM02_RENDERER_ALREADY_LEASED');
  if(!entry){
    if(typeof app.destroy!=='function'||typeof app.canvas.addEventListener!=='function')throw new Error('HM02_APP_LIFETIME_UNAVAILABLE');
    let renderer;
    try {renderer=withSharedUnpackState(app.renderer.gl,()=>new THREE.WebGLRenderer({canvas:app.canvas,context:app.renderer.gl}));}
    finally {app.renderer.resetState();}
    entry={renderer,gl:app.renderer.gl,leased:false,retired:false,onInvalidate:null};
    const originalDestroy=app.destroy;
    const lost=()=>entry.retire(new Error('HM02_CONTEXT_LOST_USE_2D'));
    const destroy=function(...args){let result;try{entry.retire(new Error('HM02_APP_DESTROYED'));}finally{result=originalDestroy.apply(this,args);}return result;};
    entry.retire=error=>{
      if(entry.retired)return;entry.retired=true;appRenderers.delete(app);
      app.canvas.removeEventListener('webglcontextlost',lost);if(app.destroy===destroy)app.destroy=originalDestroy;
      const callback=entry.onInvalidate;entry.onInvalidate=null;
      try{callback?.(error);}finally{try{renderer.dispose();}finally{app.renderer.resetState();}}
    };
    app.destroy=destroy;app.canvas.addEventListener('webglcontextlost',lost);appRenderers.set(app,entry);
  }
  entry.leased=true;entry.onInvalidate=onInvalidate;let released=false;
  return {renderer:entry.renderer,release(){
    if(released)return;released=true;entry.leased=false;entry.onInvalidate=null;
    // Drop field/scene render lists; retain only app-lifetime renderer internals.
    try{entry.renderer.renderLists?.dispose();}
    finally{if(!entry.retired){try{entry.renderer.resetState();}finally{app.renderer.resetState();}}}
  }};
}

// Compatibility name points to the SAME app-lifetime registry, never a second owner.
export const leaseHM02Renderer = leaseHuntRenderer;
