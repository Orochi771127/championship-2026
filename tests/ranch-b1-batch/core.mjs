// TEST ONLY. Adapter must use the actual reviewed Three/Pixi scene, not a substitute.
import {measureResolvedCoverage} from '../ranch-coverage-intensity.mjs';
const requireValue=(ok,message)=>{if(!ok)throw Error(message)};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),v=>v.toString(16).padStart(2,'0')).join('');
export async function runFrameBatch(adapter,frames,{controlCache=new Set(),maxFrames=16}={}){
 requireValue(frames.length>0&&frames.length<=maxFrames,'BOUNDED_BATCH_REQUIRED');
 const ledger=[],start=performance.now();
 for(const frame of frames){
  try{
  const timings={},t0=performance.now();await adapter.applyFrame(frame);timings.loadApplyMs=performance.now()-t0;
  const before=await adapter.settledNormalBytes();
  requireValue(before.three instanceof Uint8Array&&before.pixi instanceof Uint8Array,'BOTH_REAL_CANVAS_LAYERS_REQUIRED');
  requireValue(before.sceneClock===0,'FIXED_CLOCK_REQUIRED');
  const beforeHashes={three:await hash(before.three),pixi:await hash(before.pixi)};
  const pipelines=[];
  try{
   for(const target of ['default','offscreen']){
    const t=performance.now();const pair=await adapter.captureMaskPair(target);
    requireValue(pair.reference.width===pair.actual.width&&pair.reference.height===pair.actual.height,'MASK_DIMENSION_DRIFT');
    const key=await adapter.configurationKey(target,pair);
    requireValue(typeof key==='string'&&/^[a-f0-9]{64}$/.test(key),'EXACT_CONFIG_HASH_REQUIRED');
    if(!controlCache.has(key)){
     const controls=await adapter.knownControls(target);
     requireValue(controls.clearExact&&controls.blockedZero&&controls.referenceNonempty,'KNOWN_CONTROLS_FAILED');
     controlCache.add(key);
    }
    const metrics=measureResolvedCoverage(pair.reference.rgba,pair.actual.rgba,pair.reference.width,pair.reference.height);
    requireValue(metrics.excessIntensity===0,'VISIBLE_EXCEEDS_OWN_REFERENCE');
    pipelines.push({target,configurationKey:key,coverage:metrics,referenceSha256:await hash(pair.reference.rgba),actualSha256:await hash(pair.actual.rgba),elapsedMs:performance.now()-t});
   }
  }finally{await adapter.redrawNormal();}
  const after=await adapter.normalBytes();
  const afterHashes={three:await hash(after.three),pixi:await hash(after.pixi)};
  requireValue(JSON.stringify(beforeHashes)===JSON.stringify(afterHashes),'PER_FRAME_BOTH_LAYER_RESTORATION_FAILED');
  requireValue(before.sceneClock===after.sceneClock,'CLOCK_DRIFT');
  requireValue(before.poseStateHash===after.poseStateHash,'POSE_CAMERA_LAYOUT_STATE_DRIFT');
  timings.totalMs=performance.now()-t0;
  const row={id:frame.id,pipelines,timings,normalLayerHashes:beforeHashes,poseStateHash:before.poseStateHash,scope:'PER_FRAME_REAL_LAYER_BYTES_NOT_BROWSER_COMPOSITE_SCREENSHOT',releaseApproved:false};ledger.push(row);
  }catch(error){await adapter.retainFailure(frame,error,{completedLedger:ledger});throw error;}
 }
 return {ledger,elapsedMs:performance.now()-start,configurationCount:controlCache.size};
}
