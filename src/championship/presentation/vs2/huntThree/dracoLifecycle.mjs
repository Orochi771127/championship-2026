// Bounded adapter for the pinned Three r185 DRACOLoader private lifecycle.
// Its stock dispose() does not cancel pending library initialization/tasks, so a
// late _getWorker can otherwise allocate a worker/blob URL after field teardown.
export function ownDracoLifecycle(loader,revision){
  if(revision!=='185'||typeof loader._initDecoder!=='function'||typeof loader._getWorker!=='function'
    ||!Array.isArray(loader.workerPool)||typeof loader.workerSourceURL!=='string')
    throw new Error('HUNT_THREE_DRACO_LIFECYCLE_VERSION_MISMATCH');
  const initialize=loader._initDecoder.bind(loader),getWorker=loader._getWorker.bind(loader);
  const guarded=new WeakSet(),terminated=new WeakSet(),revoked=new Set(),errors=[];
  let closed=false,pendingWorkers=0;
  const abort=()=>new DOMException('Hunt Draco owner disposed','AbortError');
  const attempt=callback=>{try{callback();}catch(error){errors.push(String(error?.message??error));}};
  function cleanup(){
    for(const worker of loader.workerPool){
      // Reject in-flight decoder tasks, rather than leave GLTF parsing pending.
      for(const callback of Object.values(worker._callbacks??{}))attempt(()=>callback.reject(abort()));
      if(!terminated.has(worker)){terminated.add(worker);attempt(()=>worker.terminate());}
    }
    loader.workerPool.length=0;
    // A queued stock _getWorker continuation may still read this URL. Retain
    // it until that continuation settles, then terminate/revoke its late result.
    if(pendingWorkers===0){
      const url=loader.workerSourceURL;loader.workerSourceURL='';
      if(url&&!revoked.has(url)){revoked.add(url);attempt(()=>URL.revokeObjectURL(url));}
    }
  }
  loader._initDecoder=function(){
    if(closed)return Promise.reject(abort());
    return Promise.resolve(initialize()).then(value=>{
      if(closed){cleanup();throw abort();}return value;
    });
  };
  loader._getWorker=function(...args){
    if(closed)return Promise.reject(abort());
    pendingWorkers++;
    let pending;try{pending=getWorker(...args);}catch(error){pendingWorkers--;if(closed)cleanup();throw error;}
    return Promise.resolve(pending).then(worker=>{
      pendingWorkers--;
      // Also covers disposal in the microtask after init but before allocation.
      if(closed){cleanup();throw abort();}
      if(!guarded.has(worker)){
        guarded.add(worker);const post=worker.postMessage.bind(worker);
        worker.postMessage=function(...messages){
          // Covers disposal after this promise resolves but before decodeGeometry
          // registers/posts its task. Throw rejects that task's Promise executor.
          if(closed)throw abort();return post(...messages);
        };
      }
      return worker;
    },error=>{pendingWorkers--;if(closed){cleanup();throw abort();}throw error;});
  };
  // GLTFLoader calls preload() without awaiting it. Consume its rejection;
  // actual decode requests still reject through their own guarded init promise.
  loader.preload=function(){
    this._initDecoder().catch(error=>{if(error?.name!=='AbortError')errors.push(`decoder preload: ${error?.message??error}`);});
    return this;
  };
  loader.dispose=function(){closed=true;cleanup();return loader;};
  return {loader,getDiagnostics:()=>({closed,cleanupErrors:errors.slice()})};
}
