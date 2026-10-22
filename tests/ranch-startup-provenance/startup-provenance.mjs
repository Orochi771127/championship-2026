import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const TITLE_SHA256='184fddbba7f3bf17d58f614dc737b514d2ff345ee03af987911257fb01ccc399';
export function instrumentTitle(bytes){assert.equal(createHash('sha256').update(bytes).digest('hex'),TITLE_SHA256);const s=bytes.toString(),needle='      const timer=setTimeout(()=>controller.abort(),45000),signal=controller.signal;';assert.equal(s.split(needle).length,2);return s.replace(needle,needle+`\n      globalThis.__startupProvenance.markSignal(signal,'SPECULATIVE_TITLE_PRELOAD',{stack:new Error().stack});`);}
export function installStartupProvenance(){
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('LOOPBACK_DIAGNOSTIC_ONLY');
 const rows=[],signals=new WeakMap(),media=new WeakMap();let serial=0,phase='initial',overflow=false;
 const push=(type,data={})=>{const row={type,time:performance.now(),phase,...data};if(rows.length<2000)rows.push(row);else overflow=true;return row;};
 const signalInfo=s=>{if(!s)return null;let r=signals.get(s);if(!r){r={id:++serial,owner:'UNATTRIBUTED'};signals.set(s,r);s.addEventListener('abort',()=>push('signal-abort',{...r,reason:String(s.reason),stack:new Error().stack}),{once:true});}return r;};
 globalThis.__startupProvenance={setPhase:p=>{phase=p;push('phase');},markSignal:(s,owner,detail)=>{const r=signalInfo(s);r.owner=owner;push('signal-owner',{...r,...detail});},recordDemand:(value,s)=>push('foreground-scoped-asset-demand',{value:typeof value==='string'?value:value?.src,signal:signalInfo(s),stack:new Error().stack}),snapshot:()=>JSON.parse(JSON.stringify({rows,overflow,scope:'OBSERVATION_ONLY_NO_ERROR_CLASSIFICATION'}))};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=function(input,init){const signal=init?.signal??(input instanceof Request?input.signal:null),info=signalInfo(signal),id=++serial,url=typeof input==='string'?input:input?.url??String(input);push('fetch-start',{id,url,signal:info?{...info}:null,aborted:signal?.aborted??false,stack:new Error().stack});let promise;try{promise=Reflect.apply(originalFetch,this,arguments);}catch(e){push('fetch-sync-error',{id,error:String(e)});throw e;}// No then/catch observer: preserve original rejection handledness. Network outcomes remain in Playwright's raw request ledger.
return promise;};
 const observe=el=>{if(media.has(el))return media.get(el);const id=++serial;media.set(el,id);for(const type of ['loadstart','loadedmetadata','loadeddata','canplay','playing','abort','emptied','stalled','error'])el.addEventListener(type,()=>push('media-'+type,{id,src:el.src,currentSrc:el.currentSrc,readyState:el.readyState,networkState:el.networkState,paused:el.paused,error:el.error?{code:el.error.code,message:el.error.message}:null}));return id;};
 for(const method of ['load','play']){const original=HTMLMediaElement.prototype[method];HTMLMediaElement.prototype[method]=function(){const id=observe(this);push('media-'+method+'-call',{id,src:this.src,currentSrc:this.currentSrc,stack:new Error().stack});return Reflect.apply(original,this,arguments);};}
}
