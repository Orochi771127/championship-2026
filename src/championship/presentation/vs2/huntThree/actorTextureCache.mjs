// A bounded, field-owned crop cache. Pixi textures/resources are borrowed and
// NEVER destroyed. Protect the entire current frame before any cache eviction.
export function createActorTextureCache({create,maxEntries=64,maxBytes=16*1024*1024}) {
  if(!Number.isInteger(maxEntries)||maxEntries<1||!Number.isSafeInteger(maxBytes)||maxBytes<4)
    throw new Error('HM02_INVALID_TEXTURE_BUDGET');
  const entries=new Map();let protectedKeys=new Set(),bytes=0,evictions=0,closed=false;
  const size=key=>{
    const r=key?.source?.resolution??1,f=key?.frame;
    const w=Math.round((f?.width??0)*r),h=Math.round((f?.height??0)*r);
    if(!(r>0)||!Number.isFinite(r)||w<1||h<1||!Number.isSafeInteger(w*h*4)||key.rotate)
      throw new Error('HM02_UNSUPPORTED_SPRITE_SOURCE');
    return w*h*4;
  };
  function remove(key){const entry=entries.get(key);entries.delete(key);bytes-=entry.bytes;entry.texture.dispose();}
  return Object.freeze({
    beginFrame(keys){
      if(closed)throw new Error('HM02_TEXTURE_CACHE_DISPOSED');
      protectedKeys=new Set(keys);
      const activeBytes=[...protectedKeys].reduce((n,key)=>n+size(key),0);
      if(protectedKeys.size>maxEntries||activeBytes>maxBytes)throw new Error('HM02_ACTIVE_ACTOR_TEXTURE_BUDGET_EXCEEDED');
    },
    get(key){
      if(closed||!protectedKeys.has(key))throw new Error('HM02_TEXTURE_NOT_IN_CURRENT_FRAME');
      if(entries.has(key)){const hit=entries.get(key);entries.delete(key);entries.set(key,hit);return hit.texture;}
      const needed=size(key);
      while(entries.size>=maxEntries||bytes+needed>maxBytes){
        const victim=[...entries.keys()].find(k=>!protectedKeys.has(k));
        if(!victim)throw new Error('HM02_ACTOR_TEXTURE_BUDGET_EXCEEDED');
        remove(victim);evictions++;
      }
      const texture=create(key);entries.set(key,{texture,bytes:needed});bytes+=needed;return texture;
    },
    getDiagnostics:()=>({entries:entries.size,rgba8Bytes:bytes,maxEntries,maxBytes,evictions}),
    dispose(){if(closed)return;closed=true;let failure;for(const key of [...entries.keys()]){try{remove(key);}catch(error){failure??=error;}}protectedKeys.clear();if(failure)throw failure;}
  });
}
