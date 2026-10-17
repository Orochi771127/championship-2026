import selection from '../../data/championship/ranch-streaming-selection.r1.json' with {type:'json'};

// Download only. Pixi decoding, GPU ownership and the native clock remain with
// the foreground scene. Completed blobs are handed to its existing loader.
export function createRanchTitlePreloader({baseUrl,characters=selection.characters,
  createPrefetcher,fetchImpl=(...args)=>globalThis.fetch(...args),onProgress=()=>{},maxResidents=6,maxImageBytes=12*1024*1024}={}){
  // The entry already owns this factory. Inject it so the lazy plan does not
  // extract another shared chunk into the title's critical module graph.
  const downloads=createPrefetcher({fetchImpl:(url,options)=>fetchImpl(url,{...options,priority:'low'})});
  let attempt=null,retained=[];
  const report=()=>{if(attempt&&!attempt.controller.signal.aborted)onProgress({...downloads.progress(attempt.urls),residents:attempt.residents,phase:attempt.phase});};
  downloads.subscribe(report);
  function stop(){attempt?.controller.abort();}
  return Object.freeze({
    stop,
    blobOf:url=>downloads.blobOf(url),
    async start(save){
      stop();downloads.forget(retained);retained=[];
      const controller=new AbortController(),owner={controller,urls:[],residents:0,phase:'planning'};attempt=owner;
      const timer=setTimeout(()=>controller.abort(),45000),signal=controller.signal;
      try{
        const assigned=new Set(Object.keys(save?.raising?.assignments??{}));
        const residents=[save?.creature,...(save?.raising?.collection??[])].filter(c=>c&&assigned.has(c.creatureId??c.instanceId));
        const species=[...new Set(residents.map(c=>c.speciesId?.match(/species-\d{3}$/)?.[0]).filter(Boolean))].slice(0,maxResidents);
        const selected=species.map(id=>characters.find(c=>c.speciesId===id)).filter(Boolean);owner.residents=selected.length;report();
        const groups=[];
        for(const c of selected){
          signal.throwIfAborted();const url=new URL(c.runtimePath,baseUrl).href;
          const response=await fetchImpl(url,{signal,priority:'low'});if(!response.ok)continue;
          const text=await response.text(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
          if(hash!==c.runtimeSha256)continue;
          const runtime=JSON.parse(text),pages=runtime.streaming?.pages;
          if(!pages||runtime.streaming.sourceRuntimeSha256!==c.sourceRuntimeSha256)continue;
          signal.throwIfAborted();
          const idle=runtime.sides.main.animations.find(a=>a.id===0);
          const first=[...new Set((idle?.frames??[]).map(f=>runtime.streaming.texturePages[f.texture]))];
          const next=pages.findIndex((p,i)=>!first.includes(i));
          groups.push({url,pages,first,next});
        }
        // Every current resident gets its idle before any speculative next page.
        let planned=0;const urls=[];
        for(const phase of ['first','next'])for(const g of groups)for(const i of phase==='first'?g.first:(g.next<0?[]:[g.next])){
          const page=g.pages[i];if(!page||!/^main-[a-f0-9]{16}\.webp$/.test(page.image)||!Number.isSafeInteger(page.bytes)||page.bytes<0)continue;
          const url=new URL(page.image,g.url).href;if(urls.includes(url)||planned+page.bytes>maxImageBytes)continue;
          planned+=page.bytes;urls.push(url);
        }
        signal.throwIfAborted();owner.urls=urls;retained=urls;owner.phase='downloading';report();
        for(const url of urls){signal.throwIfAborted();await downloads.fetchAll([url],{signal});}
        owner.phase='complete';report();
      }catch(error){if(!signal.aborted){owner.phase='partial';report();}}
      finally{clearTimeout(timer);}
    }
  });
}
