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
  const disposed=new WeakSet();
  const once=value=>{if(!value||disposed.has(value))return;disposed.add(value);value.dispose?.();};
  function gltf(value){
    const textures=new Set();
    value?.scene?.traverse(o=>{once(o.geometry);for(const m of [].concat(o.material??[])){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);once(m);}});
    for(const t of textures){once(t);const image=t.source?.data??t.image;if(image&&typeof image.close==='function'&&!disposed.has(image)){disposed.add(image);image.close();}}
  }
  return {once,gltf};
}
export function shaderFailureGuard(renderer){
  let failure=null;
  renderer.debug.checkShaderErrors=true;
  renderer.debug.onShaderError=()=>{failure=new Error('HM02_SHADER_COMPILE_OR_LINK_FAILED');};
  return {draw(callback){callback();if(failure)throw failure;}};
}
