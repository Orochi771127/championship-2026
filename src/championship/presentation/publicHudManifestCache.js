// Page-lifetime descriptor cache. Identity includes the reader, URL and the
// selected content hash. It stores no textures, player state or persistent data.
const readers=new WeakMap();
export function readPublicHudManifest(url,expectedSha256,fetchImpl=globalThis.fetch){
 if(!/^[a-f0-9]{64}$/.test(expectedSha256))throw Error('PUBLIC_HUD_SELECTED_HASH');
 let cache=readers.get(fetchImpl);if(!cache){cache=new Map();readers.set(fetchImpl,cache);}
 const key=String(url)+'|'+expectedSha256;
 if(!cache.has(key)){
  const pending=Promise.resolve().then(()=>fetchImpl(url)).then(async response=>{
   if(!response.ok)throw Error('PUBLIC_HUD_HTTP_'+response.status);
   const text=await response.text(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
   const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   if(actual!==expectedSha256)throw Error('PUBLIC_HUD_HASH');
   return JSON.parse(text);
  }).catch(error=>{if(cache.get(key)===pending)cache.delete(key);throw error;});
  cache.set(key,pending);
 }
 return cache.get(key);
}
