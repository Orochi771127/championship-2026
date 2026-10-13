// Controlled Chromium HTTP/cache/network/CPU measurements; no player profile,
// Owner port, ROM, media changes or product-model injection.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib');
const assert=require('node:assert/strict'),{chromium,devices}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const fallback=path.resolve(process.env.ENTRY_QA_FALLBACK||root);
const visibilityMode=process.env.ENTRY_QA_TITLE_VISIBILITY==='1';
const label=process.env.ENTRY_QA_LABEL||'before',out=path.resolve(process.env.ENTRY_QA_OUTPUT||'docs/reports/title-entry-2026-10-13');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'pages-build.json'),'utf8'));
const presenterChunks=manifest.browserBundle.generatedFiles.filter(p=>{
 const code=fs.readFileSync(path.join(root,p),'utf8');
 return /(?:async )?function (?:mountRaisingFieldPixiPresentation|mountHuntFieldPixiPresentation|mountBattleFieldPixiPresentation|createShopView|createBattleFieldView)\(/.test(code);
});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2'};
const textCache=new Map();
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://qa').pathname).replace(/^\/championship-2026\//,'/');
 let file=path.resolve(root,'.'+rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!fs.existsSync(file))file=path.resolve(fallback,'.'+rel);
 if(!file.startsWith(fallback+path.sep)&&!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 const size=fs.statSync(file).size,ext=path.extname(file),headers={'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600','Accept-Ranges':'bytes'};
 if(['.html','.js','.json','.css','.svg'].includes(ext)){
  if(!textCache.has(file))textCache.set(file,zlib.gzipSync(fs.readFileSync(file)));
  const body=textCache.get(file);res.writeHead(200,{...headers,'Content-Encoding':'gzip','Content-Length':body.length});res.end(body);return;
 }
 const range=/^bytes=(\d+)-(\d*)/.exec(req.headers.range||''),start=range?Number(range[1]):0,end=range?Math.min(Number(range[2]||size-1),size-1):size-1;
 res.writeHead(range?206:200,{...headers,'Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 const stream=fs.createReadStream(file,{start,end});stream.pipe(res);res.on('close',()=>stream.destroy());
});
const profiles=[{name:'unthrottled',latency:0,download:-1,upload:-1,cpu:1},{name:'mobile-4g',latency:150,download:4_000_000/8,upload:1_000_000/8,cpu:4}];
const report={schemaVersion:1,generatedAt:new Date().toISOString(),label,artifactMetadataCommit:manifest.commit,buildId:manifest.buildId,presenterChunks,physicalDeviceAccepted:false,compression:'gzip HTTP; synthetic CDP shared throughput and latency',profiles,cases:[]};
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/championship-2026/`;report.origin=base;
 assert.notEqual(server.address().port,8732);
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const profile of profiles.filter(p=>!visibilityMode||p.name==='mobile-4g'))for(const locale of (visibilityMode?['zh-Hant','en']:['zh-Hant']))for(let sample=0;sample<2;sample++){
  const ctx=await browser.newContext({...devices['Pixel 7'],reducedMotion:'no-preference'}),page=await ctx.newPage(),cdp=await ctx.newCDPSession(page);
  page.setDefaultTimeout(60000);
  await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:profile.latency,downloadThroughput:profile.download,uploadThroughput:profile.upload});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
  await page.addInitScript(({locale})=>{
   localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale}));
   const trace=window.__entryTrace={marks:{},titleImages:{},longTasks:[],media:[]},mark=k=>{trace.marks[k]??=performance.now();};
   new PerformanceObserver(list=>trace.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
   document.addEventListener('DOMContentLoaded',()=>mark('domReady'));
   addEventListener('championship:ready',()=>mark('appReady'));
   document.addEventListener('click',e=>{if(e.target.closest?.('#cm-film-skip'))mark('skipClick');},true);
   let watched=null;
   const inspect=()=>{
    const skip=document.getElementById('cm-film-skip'),film=document.getElementById('cm-opening-film'),video=film?.querySelector('video');
    if(skip&&!skip.disabled&&film&&!film.hidden&&skip.getClientRects().length)mark('skipAvailable');
    if(video&&watched!==video){watched=video;video.requestVideoFrameCallback?.(()=>mark('firstFrame'));for(const event of ['loadedmetadata','loadeddata','playing','waiting','error'])video.addEventListener(event,()=>trace.media.push({event,at:performance.now()}));}
    if(trace.marks.skipClick&&!document.querySelector('.cm-title__actions')?.hidden)mark('titleOperable');
    if(document.querySelector('.cm-title__panel')?.dataset.titleBackgroundState==='ready')mark('titleArtReady');
    const title=document.querySelector('#cm-title'),panel=title?.querySelector('.cm-title__panel'),heading=title?.querySelector('h1'),logo=title?.querySelector('.cm-title__logo-art');
    const images=[...title?.querySelectorAll(':scope > .cm-title__panel img')||[]];
    for(const img of images)if(img.complete&&img.naturalWidth>0)trace.titleImages[img.dataset.titleSrc]??=performance.now();
    const show=title&&!title.hidden&&film?.hidden;
    const headingVisible=heading&&getComputedStyle(heading).clipPath==='none'&&heading.getBoundingClientRect().width>1;
    const logoVisible=logo&&getComputedStyle(logo).display!=='none'&&logo.complete&&logo.naturalWidth>0;
    if(show&&(headingVisible||logoVisible))mark('brandVisible');
    const backgroundReady=panel&&getComputedStyle(panel).backgroundImage!=='none';
    if(backgroundReady)mark('arenaDecoded');
    if(show&&backgroundReady&&(headingVisible||logoVisible))mark('primaryComposition');
    if(show&&backgroundReady&&images.filter(img=>!img.classList.contains('cm-title__logo-art')||document.documentElement.lang==='zh-Hant').every(img=>img.complete&&img.naturalWidth>0))mark('visibleComposition');
   };
   document.addEventListener('load',inspect,true);
   new MutationObserver(inspect).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','inert','data-title-background-state','data-title-image-state','src','style']});
  },{locale});
  for(const cache of (visibilityMode?['cold']:['cold','warm'])){
   const errors=[],requests=[];const onError=e=>errors.push(e.message),onResponse=r=>requests.push({url:r.url(),status:r.status()});page.on('pageerror',onError);page.on('response',onResponse);
   await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__entryTrace?.marks.skipAvailable);
   await page.waitForFunction(()=>window.__entryTrace.marks.firstFrame||document.getElementById('cm-opening-film').hidden,null,{timeout:20000});
   const film=await page.locator('#cm-opening-film').evaluate(e=>({hidden:e.hidden,result:e.dataset.result,state:e.dataset.state}));
   if(!film.hidden){await page.locator('#cm-film-skip').click();
    for(let attempt=0;attempt<20&&await page.locator('.cm-title__actions').isHidden();attempt++){await page.locator('#cm-login').click();await page.waitForTimeout(60);}
   }else{await page.locator('#cm-login').click();}
   await page.waitForFunction(()=>!document.querySelector('.cm-title__actions').hidden);
   // Prime the same browser's TITLE resources before the warm-cache reload.
   await page.waitForFunction(()=>document.querySelector('.cm-title__panel')?.dataset.titleBackgroundState==='ready',null,{timeout:60000});
   const result=await page.evaluate(()=>({trace:window.__entryTrace,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,end:e.responseEnd,duration:e.duration,encoded:e.encodedBodySize,decoded:e.decodedBodySize,transfer:e.transferSize,kind:e.initiatorType})),source:document.querySelector('#cm-opening-film video')?.currentSrc,music:document.documentElement.dataset.musicState,save:localStorage.getItem('championshipModernSave:v1')}));
   assert.equal(result.save,null);assert.deepEqual(errors,[]);assert.ok(!requests.some(r=>r.status>=400),JSON.stringify(requests.filter(r=>r.status>=400)));
   const m=result.trace.marks,js=result.resources.filter(r=>r.name.includes('/_bundled/')&&r.name.endsWith('.js'));
   const beforeSkip=new Set(js.filter(r=>r.start<=m.skipAvailable).map(r=>new URL(r.name).pathname.slice('/championship-2026/'.length)));
   const presentersBeforeSkip=presenterChunks.filter(p=>beforeSkip.has(p));
   if(label==='after'){assert.ok(presenterChunks.length>=3,'locate actual field presenter bodies');assert.deepEqual(presentersBeforeSkip,[],'TITLE never fetches deferred field/screen presenters');}
   const art=result.resources.filter(r=>r.name.includes('/title-morning-r1/')&&r.name.endsWith('.webp'));
   if(visibilityMode&&label==='after'&&locale!=='zh-Hant')assert.ok(!art.some(r=>r.name.endsWith('/logo-zh-Hant.webp')));
   const entry={profile:profile.name,locale,sample,cache,presentersBeforeSkip,marks:m,skipToTitleMs:m.titleOperable-m.skipClick,titleImageBytes:art.reduce((s,r)=>s+r.decoded,0),titleImageRequests:art.length,brandFromSkipMs:m.brandVisible-m.skipClick,primaryFromSkipMs:m.primaryComposition-m.skipClick,compositionFromSkipMs:m.visibleComposition-m.skipClick,initialJsRequests:js.filter(r=>r.start<=m.skipAvailable).length,initialJsDecoded:js.filter(r=>r.start<=m.skipAvailable).reduce((s,r)=>s+r.decoded,0),initialJsEncoded:js.filter(r=>r.start<=m.skipAvailable).reduce((s,r)=>s+r.encoded,0),initialJsTransfer:js.filter(r=>r.start<=m.skipAvailable).reduce((s,r)=>s+r.transfer,0),scriptResponseEnd:Math.max(...js.filter(r=>r.start<=m.skipAvailable).map(r=>r.end)),film,result,errors};
   report.cases.push(entry);fs.writeFileSync(path.join(out,`${label}-performance.json`),JSON.stringify(report,null,2)+'\n');
   console.log(JSON.stringify({profile:profile.name,sample,cache,marks:m,skipToTitleMs:entry.skipToTitleMs,jsRequests:entry.initialJsRequests,jsDecoded:entry.initialJsDecoded,jsTransfer:entry.initialJsTransfer,scriptResponseEnd:entry.scriptResponseEnd,longTasks:result.trace.longTasks}));
   page.off('pageerror',onError);page.off('response',onResponse);await page.goto('about:blank');
  }
  await ctx.close();
 }
})().catch(e=>{report.error=String(e);console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,`${label}-performance.json`),JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();server.close();});
