// Isolated, bounded browser harness. Route original local bytes; start no server.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT??'.'),out=process.env.CHAMPIONSHIP_QA_OUTPUT;
if(!out)throw Error('CHAMPIONSHIP_QA_OUTPUT_REQUIRED');fs.mkdirSync(out,{recursive:true});
const base='https://championship-title-background.test/',arena='assets/production/title-morning-r1/arena.webp';
const original=fs.readFileSync(path.join(root,arena)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const entry=fs.readFileSync(path.join(root,'championship.html'),'utf8');
const title=entry.slice(entry.indexOf('<div id="cm-title"'),entry.indexOf('<div id="cm-root"'));
const html=`<!doctype html><html lang="zh-Hant" data-motion="reduced"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="src/championship/app/styles.css"><link rel="stylesheet" href="src/championship/app/opening.css"><style>*,*::before,*::after{animation:none!important;transition:none!important}</style>${title}<script type="module">
import {createTitleImageLifecycle} from './src/championship/presentation/titleImageLifecycle.js';
window.events=[];const title=document.querySelector('#cm-title'),panel=title.querySelector('.cm-title__panel');
const urls={createObjectURL(blob){const url=URL.createObjectURL(blob);events.push({type:'create',url,size:blob.size});return url;},revokeObjectURL(url){events.push({type:'revoke',url});URL.revokeObjectURL(url);}};
window.mount=()=>{window.sync=createTitleImageLifecycle(title,{urls});title.hidden=false;sync(false);};
window.enter=()=>{title.hidden=false;sync(false);};window.leave=()=>{title.hidden=true;sync(true);};
window.state=()=>({...sync.inspect(),background:getComputedStyle(panel).backgroundImage,size:getComputedStyle(panel).backgroundSize,position:getComputedStyle(panel).backgroundPosition,repeat:getComputedStyle(panel).backgroundRepeat,color:getComputedStyle(panel).backgroundColor});mount();
</script>`;
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),requests=[],gates=new Map(),errors=[];let p,arenaCalls=0;const deadline=setTimeout(()=>b.close().catch(()=>{}),60000);try{
const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),page=await c.newPage();p=page;p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');
cdp.on('Network.requestWillBeSent',e=>{if(e.request.url===base+arena)requests.push({id:e.requestId,at:e.timestamp,data:[]});});
cdp.on('Network.dataReceived',e=>{const r=requests.find(x=>x.id===e.requestId);if(r)r.data.push({at:e.timestamp,bytes:e.dataLength,encodedBytes:e.encodedDataLength});});
cdp.on('Network.loadingFailed',e=>{const r=requests.find(x=>x.id===e.requestId);if(r)Object.assign(r,{failedAt:e.timestamp,canceled:e.canceled,error:e.errorText});});
cdp.on('Network.loadingFinished',e=>{const r=requests.find(x=>x.id===e.requestId);if(r)Object.assign(r,{finished:e.timestamp,encodedBytes:e.encodedDataLength});});
await c.route(base+'**',async route=>{const rel=new URL(route.request().url()).pathname.slice(1);if(rel==='harness.html')return route.fulfill({contentType:'text/html',body:html});
if(rel===arena){const n=++arenaCalls;if(n===1||n===3)await new Promise(resolve=>gates.set(n,resolve));}
const f=path.resolve(root,rel);if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:rel});await route.fulfill({path:f}).catch(e=>{if(!/closed|handled/i.test(e.message))throw e;});});
await p.goto(base+'harness.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.state?.().state==='loading');for(let i=0;i<1500&&arenaCalls!==1;i++)await new Promise(r=>setTimeout(r,10));assert.equal(arenaCalls,1);
const initial=await p.evaluate(()=>state());assert.equal(initial.background,'none');assert.equal(initial.color,'rgb(218, 238, 230)');assert.equal(initial.size,'cover');assert.equal(initial.position,'50% 50%');assert.equal(initial.repeat,'no-repeat');
await p.evaluate(()=>leave());await p.waitForTimeout(80);assert.equal(requests[0].canceled,true);assert.equal(requests[0].finished,undefined);
await p.evaluate(()=>{enter();sync(false);sync(false);});await p.waitForFunction(()=>state().state==='ready');assert.equal(arenaCalls,2);
gates.get(1)();await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>state().state),'ready');assert.equal(arenaCalls,2);
const restored=await p.evaluate(async()=>{const css=state(),url=css.background.slice(5,-2),bytes=await fetch(url).then(r=>r.arrayBuffer());const image=new Image();image.src=url;await image.decode();return {...css,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''),bytes:bytes.byteLength,width:image.naturalWidth,height:image.naturalHeight};});
assert.equal(restored.sha256,sha(original));assert.equal(restored.bytes,original.length);
await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#cm-title img')].map(i=>i.decode()));});
const candidate=await p.locator('.cm-title__panel').screenshot({path:path.join(out,'restored-title.png')});
await p.evaluate(()=>{leave();enter();sync(false);});await p.waitForFunction(()=>state().state==='ready');assert.equal(arenaCalls,2,'decoded cache return does not request HTTP again');
await p.evaluate(()=>sync.dispose());assert.equal(await p.evaluate(()=>state().hasCachedBlob),false);const events=await p.evaluate(()=>events);assert.equal(events.filter(e=>e.type==='create').length,2);assert.equal(events.filter(e=>e.type==='revoke').length,2);
await p.evaluate(()=>mount());await p.waitForFunction(()=>state().state==='loading');for(let i=0;i<1500&&arenaCalls!==3;i++)await new Promise(r=>setTimeout(r,10));assert.equal(arenaCalls,3);await p.evaluate(()=>sync.dispose());await p.waitForTimeout(80);assert.equal(requests[2].canceled,true);gates.get(3)();await p.waitForTimeout(80);await p.evaluate(()=>sync(false));assert.equal(await p.evaluate(()=>state().state),'disposed');assert.equal(arenaCalls,3);
// Compare the original direct URL rendering only after owner request counts close.
await p.evaluate(url=>{document.querySelector('#cm-title').hidden=false;document.querySelector('.cm-title__panel').style.backgroundImage='url("'+url+'")';},base+arena);
await p.evaluate(async url=>{const i=new Image();i.src=url;await i.decode();},base+arena);const baseline=await p.locator('.cm-title__panel').screenshot({path:path.join(out,'original-url-title.png')});assert.equal(sha(candidate),sha(baseline),'same original bytes and cover position render identical pixels');
assert.deepEqual(errors,[]);const result={status:'PASS',scope:'Local original bytes routed in an isolated browser; delayed native fetch response canceled before headers. Unit tests cover delayed body/decode ignoring abort. This is not a CDN throughput sample.',initial,restored,requests,events,pixelComparison:{candidate:sha(candidate),baseline:sha(baseline),equal:true},checks:{abortNativeRequest:true,staleCompletionIgnored:true,returnOneRequest:true,cachedReturnNoRequest:true,disposeCancels:true,noCssDuplicate:true},pageErrors:errors};fs.writeFileSync(path.join(out,'CONTROLLED_BROWSER.json'),JSON.stringify(result,null,2));console.log('TITLE_BACKGROUND_BROWSER_PASS',restored.width,restored.height,restored.bytes);
}catch(e){fs.writeFileSync(path.join(out,'CONTROLLED_FAILURE.json'),JSON.stringify({message:e.message,requests,arenaCalls,state:await p?.evaluate(()=>window.state?.()).catch(()=>null),errors},null,2));throw e;}finally{clearTimeout(deadline);for(const resolve of gates.values())resolve();await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
