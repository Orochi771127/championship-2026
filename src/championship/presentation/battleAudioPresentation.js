import {isLocalBattleEffectPreview} from './battleEffectArt.js';

export const BATTLE_AUDIO_ID='art:audio:battle:local-reference:v1';
export const BATTLE_AUDIO_MANIFEST='assets/production/internal-faithful-baseline/battle-audio-v1/manifest.json';

export function validateBattleAudio(manifest,index) {
  const entry=index?.entries?.find(e=>e.assetId===BATTLE_AUDIO_ID);
  if(manifest?.assetId!==BATTLE_AUDIO_ID || entry?.manifestPath!==BATTLE_AUDIO_MANIFEST
    || [entry,manifest].some(e=>!e?.runtimeEligible || !e.localOnly || e.publicReleasePermitted!==false
      || e.shippingReady!==false || e.runtimeScope!=='LOOPBACK_RESEARCH_ONLY')) throw Error('BATTLE_AUDIO_NOT_REGISTERED');
  const ids=new Set();
  for(const sound of manifest.sounds??[]) {
    if(ids.has(sound.soundId) || sound.src!==BATTLE_AUDIO_MANIFEST.replace('manifest.json',`${sound.soundId.toString(16).padStart(4,'0')}.wav`)
      || !/^[a-f0-9]{64}$/.test(sound.sha256) || sound.channels!==1 || !Number.isInteger(sound.sampleRate)
      || sound.sampleRate<8000 || sound.sampleRate>48000 || !Number.isInteger(sound.sampleFrames) || sound.sampleFrames<1
      || sound.loop!==false) throw Error('BATTLE_AUDIO_SAMPLE_INVALID');
    ids.add(sound.soundId);
  }
  if(ids.size!==54)throw Error('BATTLE_AUDIO_SAMPLE_SET');
  return manifest;
}

// A single, scene-owned Web Audio graph. Original sample IDs and frame events
// supply every sound; this adapter has no RNG, synthesis or gameplay authority.
export async function mountBattleAudioPresentation({source,baseUrl=globalThis.location?.href,
  fetchImpl=globalThis.fetch,AudioContextClass=globalThis.AudioContext,eventTarget=globalThis.document}={}) {
  if(!isLocalBattleEffectPreview(baseUrl) || !AudioContextClass)return null;
  baseUrl=new URL('/',baseUrl).href;
  const loadJson=async path=>{const r=await fetchImpl(new URL(path,baseUrl));if(!r.ok)throw Error(`BATTLE_AUDIO_HTTP_${r.status}`);return r.json();};
  const index=await loadJson('assets/production/ART_PRODUCTION_INDEX.json');
  const manifest=validateBattleAudio(await loadJson(BATTLE_AUDIO_MANIFEST),index);
  const context=new AudioContextClass(),master=context.createGain();master.connect(context.destination);
  // Leave headroom for the source's two sequence voices plus one stream.
  master.gain.value=.5;
  const buffers=new Map(),voices=new Set(),missing=new Set();let disposed=false,lastEvent=0,played=0,released=0,stream=null,sequence=null;
  const release=voice=>{if(!voices.delete(voice))return;voice.node.disconnect();voice.gain.disconnect();released++;if(stream===voice)stream=null;if(sequence===voice)sequence=null;};
  const stop=voice=>{voice.node.stop();release(voice);};
  const resume=()=>{if(context.state==='suspended')void context.resume().catch(()=>{});};
  eventTarget?.addEventListener('pointerdown',resume,{passive:true});eventTarget?.addEventListener('keydown',resume);
  try {
    const results=await Promise.allSettled(manifest.sounds.map(async sound=>{
      const response=await fetchImpl(new URL(sound.src,baseUrl));if(!response.ok)throw Error(`BATTLE_AUDIO_SAMPLE_HTTP_${response.status}`);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      if(buffer.numberOfChannels!==sound.channels || Math.abs(buffer.duration-sound.sampleFrames/sound.sampleRate)>.001)throw Error('BATTLE_AUDIO_DECODE_SIZE');
      buffers.set(sound.soundId,buffer);
    }));
    const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  } catch(error) {
    eventTarget?.removeEventListener('pointerdown',resume);eventTarget?.removeEventListener('keydown',resume);
    master.disconnect();await context.close();throw error;
  }
  resume();
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
  const unsubscribe=source.subscribe(update);
  return {
    update,
    getDiagnostics:()=>({assetId:BATTLE_AUDIO_ID,loaded:buffers.size,played,released,active:voices.size,missing:[...missing],contextState:context.state}),
    async dispose(){if(disposed)return;disposed=true;unsubscribe();for(const v of [...voices])stop(v);buffers.clear();
      eventTarget?.removeEventListener('pointerdown',resume);eventTarget?.removeEventListener('keydown',resume);master.disconnect();await context.close();}
  };
}
