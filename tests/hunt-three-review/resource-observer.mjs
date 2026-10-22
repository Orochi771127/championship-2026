// Test-context transport/resource observer. Installed ONLY for instrumented jobs.
// Does not replace requestAnimationFrame, native clocks, app APIs or RNG.
export function installResourceObserver({holdFirstDecode=false}={}){
 const NativeWorker=globalThis.Worker,liveWorkers=new Set(),urls=new Set(),bitmaps=new Set(),held=[];
 let createdWorkers=0,terminatedWorkers=0,decodePosts=0,decodeReplies=0,heldOnce=false;
 globalThis.Worker=class extends NativeWorker{
  constructor(...args){super(...args);createdWorkers++;liveWorkers.add(this);this.addEventListener('message',e=>{if(e.data?.type==='decode'||e.data?.type==='error')decodeReplies++;});}
  postMessage(data,...rest){if(data?.type==='decode'){decodePosts++;if(holdFirstDecode&&!heldOnce){heldOnce=true;held.push(()=>super.postMessage(data,...rest));return;}}return super.postMessage(data,...rest);}
  terminate(){if(liveWorkers.delete(this))terminatedWorkers++;return super.terminate();}
 };
 const make=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=value=>{const url=make(value);urls.add(url);return url;};URL.revokeObjectURL=url=>{urls.delete(url);return revoke(url);};
 const create=globalThis.createImageBitmap?.bind(globalThis);if(create)globalThis.createImageBitmap=async(...args)=>{const bitmap=await create(...args),close=bitmap.close.bind(bitmap);bitmaps.add(bitmap);bitmap.close=()=>{bitmaps.delete(bitmap);return close();};return bitmap;};
 Object.defineProperty(globalThis,'__huntActionsResources',{writable:false,configurable:false,value:Object.freeze({
  snapshot:()=>({liveWorkers:liveWorkers.size,createdWorkers,terminatedWorkers,decodePosts,decodeReplies,heldDecodes:held.length,liveObjectURLs:urls.size,liveImageBitmaps:bitmaps.size,canvasElements:document.querySelectorAll('canvas').length,jsHeapBytes:performance.memory?.usedJSHeapSize??null,jsHeapMeaning:'browser estimate; not GPU residency or physical phone evidence'}),
  releaseHeld(){const work=held.splice(0);let released=0;for(const run of work){try{run();released++;}catch{}}return {attempted:work.length,released};}
 })});
}
