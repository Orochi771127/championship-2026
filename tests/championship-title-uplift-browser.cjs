// Controlled local HTTP comparison. Desktop Chrome emulation is not an iPhone.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib');
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const routed=process.env.UPLIFT_ROUTED==='1';
const out=path.resolve('docs/reports/presentation-uplift-2026-10-18/evidence');fs.mkdirSync(out,{recursive:true});
const roots={before:path.resolve('dist/title-before'),after:path.resolve('dist/title-after')};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((req,res)=>{
 const parts=new URL(req.url,'http://qa').pathname.split('/').filter(Boolean),label=parts.shift(),root=roots[label];
 if(!root){res.writeHead(404).end();return;}const file=path.resolve(root,parts.join('/')||'index.html');
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 const ext=path.extname(file),body=fs.readFileSync(file),compressed=['.html','.js','.json','.css'].includes(ext),bytes=compressed?zlib.gzipSync(body):body;
 res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':ext==='.html'?'no-cache':'public,max-age=3600',...(compressed?{'Content-Encoding':'gzip'}:{})});res.end(bytes);
});
const report={baseCommit:'700996df05a598b88dce79285615753f3beed9b5',physicalDevice:false,host:'Windows desktop Chrome headless',network:{downloadBitsPerSecond:4e6,uploadBitsPerSecond:1e6,latencyMs:150,cpuSlowdown:4},cache:'fresh isolated context cold; same context reload warm',cases:[]};
if(routed)Object.assign(report,{network:'NO NETWORK: local files fulfilled by Playwright; timings are fixture execution only, not HTTP/network performance',cache:'route fulfillment disables HTTP caching; no cold/warm conclusion',httpBlocked:{action:'Chrome navigation',url:'http://127.0.0.1:50746/before/index.html',reason:'net::ERR_NETWORK_ACCESS_DENIED',outcome:'denied; no permission escalation or retry'}});
async function fixtureRoute(ctx){await ctx.route('**/*',async route=>{
 const url=new URL(route.request().url()),parts=url.pathname.split('/').filter(Boolean),label=parts.shift(),root=roots[label];
 if(!root)return route.abort();const file=path.resolve(root,parts.join('/')||'index.html');
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:url.pathname});
 return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
});}
let browser;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 for(const profile of [{name:'portrait-390x844-dpr3',viewport:{width:390,height:844},deviceScaleFactor:3,caches:['cold','warm']},{name:'desktop-1366x768-dpr1',viewport:{width:1366,height:768},deviceScaleFactor:1,caches:['cold']}])for(const label of ['before','after']){
  const ctx=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor,reducedMotion:'reduce'}),page=await ctx.newPage(),cdp=await ctx.newCDPSession(page);
  if(routed)await fixtureRoute(ctx);
  await cdp.send('Network.enable');if(!routed)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:500000,uploadThroughput:125000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
   localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',muted:true}));
   const t=window.__uplift={lcp:[],marks:{}};
   new PerformanceObserver(list=>t.lcp.push(...list.getEntries().map(e=>({time:e.startTime,size:e.size,tag:e.element?.tagName,url:e.url})))).observe({type:'largest-contentful-paint',buffered:true});
   new MutationObserver(()=>{
    const login=document.querySelector('#cm-login'),panel=document.querySelector('.cm-title__panel');
    if(login&&!login.disabled&&!login.hidden&&login.getClientRects().length)t.marks.operable??=performance.now();
    if(panel&&getComputedStyle(panel).backgroundImage!=='none')t.marks.primary??=performance.now();
    if(panel?.dataset.titleBackgroundState==='ready')t.marks.composition??=performance.now();
   }).observe(document,{subtree:true,childList:true,attributes:true});
  });
  for(const cache of routed?['fixture']:profile.caches){
   const errors=[],failed=[];const onError=e=>errors.push(e.message),onResponse=r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});},onFailed=r=>failed.push({url:r.url(),error:r.failure()?.errorText});
   page.on('pageerror',onError);page.on('response',onResponse);page.on('requestfailed',onFailed);
   await page.goto(`${routed?'http://championship-uplift.test':`http://127.0.0.1:${server.address().port}`}/${label}/index.html`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__uplift?.marks.operable&&window.__uplift?.marks.composition,null,{timeout:60000});await page.waitForTimeout(200);
   const data=await page.evaluate(()=>({...__uplift,resources:performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,end:r.responseEnd,encoded:r.encodedBodySize,transfer:r.transferSize})),images:[...document.querySelectorAll('.cm-title__panel img[data-title-image-visible="true"]')].map(i=>({src:i.dataset.titleSrc,width:i.naturalWidth,box:{width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height}})),save:localStorage.getItem('championshipModernSave:v1'),film:!!document.querySelector('#cm-opening-film:not([hidden])')}));
   const art=data.resources.filter(r=>/title-(?:morning|responsive)-r1\/.*\.webp/.test(r.url));
   const row={label,profile:profile.name,cache,marks:data.marks,lcp:data.lcp.at(-1),titleImageBodyBytes:art.reduce((s,r)=>s+r.encoded,0),totalBodyBytes:data.resources.reduce((s,r)=>s+r.encoded,0),totalTransferBytes:data.resources.reduce((s,r)=>s+r.transfer,0),completedTransferByOperable:data.resources.filter(r=>r.end<=data.marks.operable).reduce((s,r)=>s+r.transfer,0),art,errors,failed,images:data.images};
   assert.equal(data.save,null);assert.equal(data.film,false);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   if(cache!=='warm')await page.screenshot({path:path.join(out,`${label}-${profile.name}.png`)});
   await page.locator('#cm-login').click();await page.locator('#cm-new-game').waitFor({state:'visible'});row.actualMenuOpened=true;
   report.cases.push(row);fs.writeFileSync(path.join(out,'A_METRICS.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({label,profile:profile.name,cache,marks:row.marks,lcp:row.lcp?.time,bytes:row.titleImageBodyBytes,failed:failed.length}));
   page.off('pageerror',onError);page.off('response',onResponse);page.off('requestfailed',onFailed);
  }await ctx.close();
 }
 // Failure is decoration-only: the title menu remains usable.
 const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();
 if(routed)await fixtureRoute(ctx);
 await page.route('**/title-responsive-r1/**',r=>r.abort('failed'));
 await page.goto(`${routed?'http://championship-uplift.test':`http://127.0.0.1:${server.address().port}`}/after/index.html`,{waitUntil:'domcontentloaded'});await page.locator('#cm-login').click();await page.locator('#cm-new-game').waitFor({state:'visible'});
 report.failureFallback={menuOpened:true};await ctx.close();fs.writeFileSync(path.join(out,'A_METRICS.json'),JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
