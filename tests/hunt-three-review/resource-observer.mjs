// Instrumented test-context observer only. No game clock, loader or app API edits.
// Ownership is exact compressed payload equality from the pinned packaged HM08 GLB,
// plus a worker and blob URL created after its observed native entry request.
export function installResourceObserver(){
 const NativeWorker=globalThis.Worker,workers=new WeakMap(),workerRows=[],urls=new Map(),urlRows=[],bitmaps=new Set(),held=[];
 let sequence=0,decodePosts=0,decodeReplies=0,owner=null,overflow=false;
 const sourceHashes=new Set(),sharedSource={bytes:932,sha256:'9d10b11cf15844e5bb768493df95ad58334901be58d1e5aa62b973a0889b90d7'};
 const creationContext=()=>{const screen=document.getElementById('cm-root')?.dataset.screen;return ['HUNT_FIELD','RAISING_HOME'].includes(screen)?screen:'OTHER';};
 const sourceClass=row=>{const source=urlRows.find(s=>s.id===row.urlId);if(!source||source.sourceHashStatus!=='VERIFIED'||row.unknownProtocolPosts)return 'UNKNOWN';
  if(source.blobBytes===674&&source.sourceSHA256==='fa376b4c9c8b4d4973191c0ebb515f8f6ea8e7d35724a162a818da0902ed7a63'&&row.bitmapPosts===0&&row.initPosts===0&&row.decodePosts===0)return 'PIXI_IMAGE_BITMAP_SUPPORT_CHECK';
  if(source.blobBytes===sharedSource.bytes&&source.sourceSHA256===sharedSource.sha256&&row.bitmapPosts>0&&row.initPosts===0&&row.decodePosts===0)return 'PIXI_SHARED_IMAGE_BITMAP_POOL';
  if(row.initPosts===1&&row.decodePosts>0&&row.bitmapPosts===0)return 'DRACO_PROTOCOL';return 'UNKNOWN';};
 const failures=[];const fault=code=>{if(failures.length<16&&!failures.includes(code))failures.push(code);};
 const workerLimit=256,urlLimit=512,next=()=>++sequence;
 const fieldPending=()=>document.getElementById('cm-root')?.dataset.screen==='HUNT_FIELD'&&['HUNT_LOADOUT','HUNT_FIELD'].includes(document.getElementById('cm-root')?.dataset.activeScreen)&&document.querySelector('.cm-vs2-field__canvas')?.getAttribute('aria-busy')==='true';
 const equal=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
 globalThis.Worker=class extends NativeWorker{
  constructor(...args){super(...args);const source=urls.get(String(args[0])),row={id:workerRows.length+1,createdAt:next(),terminatedAt:null,urlId:source?.id??null,owner:null,decodePosts:0,decodeReplies:0,matchingBufferViews:[],unknownDecodePosts:0,createdContext:creationContext(),bitmapPosts:0,bitmapReplies:0,initPosts:0,unknownProtocolPosts:0};workers.set(this,row);if(workerRows.length<workerLimit)workerRows.push(row);else overflow=true;
   this.addEventListener('message',e=>{if(e.data?.id==='loadImageBitmap'&&Number.isSafeInteger(e.data.uuid))row.bitmapReplies++;if(e.data?.type==='decode'||e.data?.type==='error'){decodeReplies++;row.decodeReplies++;}});
  }
  postMessage(data,...rest){
   const row=workers.get(this);
   if(data?.id==='loadImageBitmap'&&Number.isSafeInteger(data.uuid)&&data.uuid>=0&&Array.isArray(data.data)&&data.data.length===2&&typeof data.data[0]==='string')row.bitmapPosts++;
   else if(data?.type==='init'&&data.decoderConfig&&typeof data.decoderConfig==='object')row.initPosts++;
   else if(!(data?.type==='decode'&&data.buffer instanceof ArrayBuffer))row.unknownProtocolPosts++;
   if(data?.type==='decode'){
    decodePosts++;row.decodePosts++;let match=null;
    if(owner&&!owner.closedAt&&data.buffer instanceof ArrayBuffer){const bytes=new Uint8Array(data.buffer);match=owner.buffers.find(v=>equal(bytes,v.data));}
    if(match){
     const source=urlRows.find(v=>v.id===row.urlId);
     if(!source||row.createdAt<=owner.armedAt||source.createdAt<=owner.armedAt||row.unknownDecodePosts||row.terminatedAt||source.revokedAt){fault('HM08_DECODE_OWNER_NOT_EXCLUSIVE');}
     else{row.owner='hm08';source.owner='hm08';if(!row.matchingBufferViews.includes(match.index))row.matchingBufferViews.push(match.index);
      if(!owner.heldOnce){if(!fieldPending()){fault('HM08_DECODE_NOT_PENDING_NATIVE_ENTRY');}else{owner.heldOnce=true;owner.heldWorkerId=row.id;owner.heldBufferView=match.index;held.push({worker:this,row});return;}}
     }
    }else{row.unknownDecodePosts++;if(row.owner)fault('HM08_WORKER_MIXED_PAYLOAD_OWNER');}
   }
   return super.postMessage(data,...rest);
  }
  terminate(){const row=workers.get(this);if(row&&!row.terminatedAt)row.terminatedAt=next();return super.terminate();}
 };
 const make=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=value=>{const url=make(value),row={id:urlRows.length+1,createdAt:next(),revokedAt:null,owner:null,createdContext:creationContext(),blobBytes:Number.isSafeInteger(value?.size)?value.size:null,sourceSHA256:null,sourceHashStatus:'UNAVAILABLE'};if(urlRows.length<urlLimit){urls.set(url,row);urlRows.push(row);}else overflow=true;
  // Hash bounded script blobs only. Never expose blob text, request URLs or data.
  if(typeof value?.arrayBuffer==='function'&&value.size>0&&value.size<=131072&&['','application/javascript'].includes(value.type)){
   row.sourceHashStatus='PENDING';let work;work=Promise.resolve().then(()=>value.arrayBuffer()).then(bytes=>crypto.subtle.digest('SHA-256',bytes)).then(digest=>{row.sourceSHA256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');row.sourceHashStatus='VERIFIED';}).catch(()=>{row.sourceHashStatus='FAILED';}).finally(()=>sourceHashes.delete(work));sourceHashes.add(work);
  }return url;};
 URL.revokeObjectURL=url=>{const row=urls.get(String(url));if(row&&!row.revokedAt)row.revokedAt=next();return revoke(url);};
 const create=globalThis.createImageBitmap?.bind(globalThis);if(create)globalThis.createImageBitmap=async(...args)=>{const bitmap=await create(...args),close=bitmap.close.bind(bitmap);bitmaps.add(bitmap);bitmap.close=()=>{bitmaps.delete(bitmap);return close();};return bitmap;};
 const snapshot=()=>({liveWorkers:workerRows.filter(r=>!r.terminatedAt).length,createdWorkers:workerRows.length,terminatedWorkers:workerRows.filter(r=>r.terminatedAt).length,decodePosts,decodeReplies,heldDecodes:held.length,liveObjectURLs:urlRows.filter(r=>!r.revokedAt).length,liveImageBitmaps:bitmaps.size,canvasElements:document.querySelectorAll('canvas').length,jsHeapBytes:performance.memory?.usedJSHeapSize??null,jsHeapMeaning:'browser estimate; not GPU residency or physical phone evidence',sharedPool:{source:{...sharedSource},configuredMax:globalThis.navigator?.hardwareConcurrency||4},ownership:{method:'EXACT_PINNED_GLB_DRACO_BUFFER_VIEW_BYTES_AND_POST_ARM_CREATION',sequence,overflow,failures:[...failures],workers:workerRows.map(r=>({...r,sourceClass:sourceClass(r),matchingBufferViews:[...r.matchingBufferViews]})),objectURLs:urlRows.map(r=>({...r})),target:owner?{map:'hm08',urlPath:owner.urlPath,glbSHA256:owner.glbSHA256,glbBytes:owner.glbBytes,armedAt:owner.armedAt,closedAt:owner.closedAt??null,heldOnce:owner.heldOnce,heldWorkerId:owner.heldWorkerId??null,heldBufferView:owner.heldBufferView??null,bufferViews:owner.buffers.map(({data,...v})=>v)}:null}});
 Object.defineProperty(globalThis,'__huntActionsResources',{writable:false,configurable:false,value:Object.freeze({snapshot,async settleSourceIdentities(){await Promise.all([...sourceHashes]);return snapshot();},
  armHM08DecodeHold(proof){
   if(owner||!fieldPending())throw Error('HM08_OWNER_ARM_REQUIRES_SINGLE_PENDING_NATIVE_ENTRY');
   if(proof?.map!=='hm08'||proof.urlPath!=='/assets/production/hunt/hm08-three-r1-20261022/hm08-terrain-ee412126d0e2.glb'||proof.glbSHA256!=='ee412126d0e22f9986b9ac22e19b5bb8b203bc81a63862de9315dfa46440b328'||proof.glbBytes!==425920||!Array.isArray(proof.bufferViews)||proof.bufferViews.length!==3)throw Error('HM08_PINNED_GLB_PROOF_REQUIRED');
   const buffers=proof.bufferViews.map(v=>{if(!Number.isSafeInteger(v.index)||v.index<0||!Number.isSafeInteger(v.bytes)||v.bytes<1||v.bytes>proof.glbBytes||!/^[a-f0-9]{64}$/.test(v.sha256)||typeof v.base64!=='string')throw Error('HM08_BUFFER_VIEW_PROOF_REQUIRED');const data=Uint8Array.from(atob(v.base64),c=>c.charCodeAt(0));if(data.length!==v.bytes)throw Error('HM08_BUFFER_VIEW_SIZE_MISMATCH');return {index:v.index,bytes:v.bytes,sha256:v.sha256,data};});
   if(new Set(buffers.map(v=>v.index)).size!==3)throw Error('HM08_DISTINCT_BUFFER_VIEWS_REQUIRED');owner={urlPath:proof.urlPath,glbSHA256:proof.glbSHA256,glbBytes:proof.glbBytes,buffers,armedAt:next(),heldOnce:false};return snapshot();
  },
  closeHM08Owner(){if(!owner||owner.closedAt||held.length||failures.length||overflow||!owner.heldOnce||workerRows.some(r=>r.owner==='hm08'&&!r.terminatedAt)||urlRows.some(r=>r.owner==='hm08'&&!r.revokedAt))throw Error('HM08_OWNER_CLOSE_REQUIRES_RELEASED_EPOCH');owner.closedAt=next();for(const row of owner.buffers)row.data=null;return snapshot();},
  // Native disposal proof only; never post held work to a live or terminated worker.
  releaseHeld(){if(held.some(item=>!item.row.terminatedAt))throw Error('HELD_WORKER_NOT_NATIVE_TERMINATED');const work=held.splice(0);return {attempted:work.length,forwarded:0,discardedTerminated:work.length,errors:0};},
  discardHeldForContextTeardown(){const work=held.splice(0);return {scope:'TOTAL_CONTEXT_TEARDOWN_NOT_NATIVE_RELEASE',attempted:work.length,discardedWithoutForwarding:work.length,workerIds:work.map(v=>v.row.id),liveHeldWorkerIds:work.filter(v=>!v.row.terminatedAt).map(v=>v.row.id),nativeReleaseProved:false};}
 })});
}
