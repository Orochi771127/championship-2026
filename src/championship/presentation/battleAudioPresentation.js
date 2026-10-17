import {loadPublicRenderDescriptor,validatePublicRenderDescriptor} from './publicRenderDescriptors.js';
import {isLocalBattleEffectPreview} from './battleEffectArt.js';

export const BATTLE_AUDIO_ID='art:audio:battle:local-reference:v1';
export const BATTLE_AUDIO_MANIFEST='assets/production/internal-faithful-baseline/battle-audio-v1/manifest.json';
export const BATTLE_AUDIO_LOAD_CONCURRENCY=4;

// Abort releases the scene even if a fetch/decoder cannot itself be cancelled.
// Both outcomes of the original operation remain observed after abandonment.
function waitForAudio(operation,signal) {
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(operation).then(value=>{
      signal.removeEventListener('abort',abort);
      if(signal.aborted)reject(signal.reason);else resolve(value);
    },error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}

export function validateBattleAudio(manifest){return validatePublicRenderDescriptor(manifest,'battle-audio');}

// A single, scene-owned Web Audio graph. Original sample IDs and frame events
// supply every sound; this adapter has no RNG, synthesis or gameplay authority.
// `output` (2026-09-29): the product audio bus's sfx input and its shared
// context. The master volume, the sfx volume and mute are applied there, after
// this graph's own headroom gain; without it the adapter keeps its own context.
export async function mountBattleAudioPresentation({source,baseUrl=globalThis.location?.href,
  fetchImpl=globalThis.fetch,AudioContextClass=globalThis.AudioContext,eventTarget=globalThis.document,output=null,signal=null}={}) {
  if(!isLocalBattleEffectPreview(baseUrl) || (!output?.context && !AudioContextClass))return null;
  signal?.throwIfAborted();
  const controller=new AbortController(),loadSignal=controller.signal;
  const wait=operation=>waitForAudio(operation,loadSignal);
  // Keep the application directory, including the approved Pages subpath.
  baseUrl=new URL('./',baseUrl).href;
  const loadJson=async path=>{const r=await wait(fetchImpl(new URL(path,baseUrl),{signal:loadSignal}));if(!r.ok)throw Error(`BATTLE_AUDIO_HTTP_${r.status}`);return wait(r.json());};
  const ownsContext=!output?.context;
  let context=null,master=null,unsubscribe=null,disposal=null;
  const buffers=new Map(),voices=new Set(),missing=new Set();let disposed=false,lastEvent=0,played=0,released=0,stream=null,sequence=null;
  const release=voice=>{if(!voices.delete(voice))return;voice.node.disconnect();voice.gain.disconnect();released++;if(stream===voice)stream=null;if(sequence===voice)sequence=null;};
  const stop=voice=>{voice.node.stop();release(voice);};
  const resume=()=>{if(!disposed&&context?.state==='suspended')void context.resume().catch(()=>{});};
  function dispose(){
    if(disposed)return disposal;
    disposed=true;
    controller.abort();signal?.removeEventListener('abort',abort);
    unsubscribe?.();for(const voice of [...voices])stop(voice);buffers.clear();
    eventTarget?.removeEventListener('pointerdown',resume);eventTarget?.removeEventListener('keydown',resume);
    master?.disconnect();
    // A shared context belongs to the bus; only the scene's gain is released.
    disposal=Promise.resolve().then(()=>ownsContext?context?.close():undefined);
    return disposal;
  }
  const abort=()=>{void dispose().catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try {
    const manifest=validateBattleAudio(await wait(loadPublicRenderDescriptor('battle-audio',{baseUrl,fetchImpl,signal:loadSignal})));
    loadSignal.throwIfAborted();
    context=ownsContext?new AudioContextClass():output.context;master=context.createGain();
    master.connect(ownsContext?context.destination:output.destination);
    // Leave headroom for the source's two sequence voices plus one stream.
    master.gain.value=.5;
    let next=0;
    await Promise.all(Array.from({length:BATTLE_AUDIO_LOAD_CONCURRENCY},async()=>{
      while(next<manifest.sounds.length){
        loadSignal.throwIfAborted();const sound=manifest.sounds[next++];
        const response=await wait(fetchImpl(new URL(sound.src,baseUrl),{signal:loadSignal}));
        if(!response.ok)throw Error(`BATTLE_AUDIO_SAMPLE_HTTP_${response.status}`);
        const bytes=await wait(response.arrayBuffer());loadSignal.throwIfAborted();
        const buffer=await wait(context.decodeAudioData(bytes));
        loadSignal.throwIfAborted();
        if(buffer.numberOfChannels!==sound.channels || Math.abs(buffer.duration-sound.sampleFrames/sound.sampleRate)>.001)throw Error('BATTLE_AUDIO_DECODE_SIZE');
        buffers.set(sound.soundId,buffer);
      }
    }));
    loadSignal.throwIfAborted();
    // Late audio joins the current publication; never replay loading-time hits.
    lastEvent=Math.max(0,...(source.getView().nativeLifecycle?.sound?.events??[]).map(event=>event.id));
    eventTarget?.addEventListener('pointerdown',resume,{passive:true});eventTarget?.addEventListener('keydown',resume);
    unsubscribe=source.subscribe(update);
    resume();
  } catch(error) {
    await dispose();throw error;
  }
  function update() {
    if(disposed)return;
    const view=source.getView();
    if(view.outcome?.ended){for(const v of [...voices])stop(v);return;}
    for(const e of view.nativeLifecycle?.sound?.events??[]) {
      if(e.id<=lastEvent)continue;lastEvent=e.id;
      if(e.kind==='STOP_SEQUENCE'){
        // EAE8 stops the current battle handle, not every active player voice.
        if(sequence){const voice=sequence,until=context.currentTime+Math.max(0,e.fadeFrames)/59.8260982881;
          voice.gain.gain.setValueAtTime(voice.gain.gain.value,context.currentTime);
          voice.gain.gain.linearRampToValueAtTime(0,until);voice.node.stop(until);sequence=null;}
        continue;
      }
      const buffer=buffers.get(e.soundId);if(!buffer){missing.add(e.soundId);continue;}
      if(e.kind==='STREAM' && stream){if(stream.soundId===e.soundId)continue;stop(stream);}
      // Original sequence player1 allows two simultaneous sequences, with equal
      // priority in this bank. The oldest equal-priority voice yields its slot.
      const sequences=[...voices].filter(v=>v.kind==='SEQUENCE');
      if(e.kind==='SEQUENCE' && sequences.length>=2)stop(sequences[0]);
      const node=context.createBufferSource(),gain=context.createGain();node.buffer=buffer;gain.gain.value=Math.max(0,Math.min(127,e.volume))/127;
      node.connect(gain);gain.connect(master);
      const voice={node,gain,kind:e.kind,soundId:e.soundId};voices.add(voice);if(e.kind==='STREAM')stream=voice;else sequence=voice;
      node.onended=()=>release(voice);node.start();played++;
    }
  }
  return {
    update,
    getDiagnostics:()=>({assetId:BATTLE_AUDIO_ID,loaded:buffers.size,played,released,active:voices.size,missing:[...missing],contextState:context.state}),
    dispose
  };
}
