// TEST ONLY: exact reviewed Friends runner, bounded first adjacent desktop gesture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const BASE='5ceb957c26ec11f662ca2d659944195a5d3a47cbeff12f0fa394beb8f8f405c3';
const BUILD='bab8a0633fbf9379065853985f3a26ea4131122317635569db268003f33b7a95';
function transform(source,mode){
 assert.ok(['on','off'].includes(mode));assert.equal(crypto.createHash('sha256').update(source).digest('hex'),BASE,'Exact frozen normal runner required');
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'Unique diagnostic seam '+a.slice(0,60));source=source.replace(a,b);};
 replace("const groups=selectedGroups(process.env.CHAMPIONSHIP_FRIENDS_GROUP);","const groups=selectedGroups('source-corners');");
 // Never emit a normal partition receipt or normal PASS for this truncated diagnostic.
 source=source.replaceAll('evidence.partition','evidence.diagnosticSelection');
 replace("const digits=s=>",`evidence.filmstrip={schema:1,mode:${JSON.stringify(mode)},order:${mode==='on'?1:2},scope:'FIRST_ADJACENT_DESKTOP_GESTURE_ONLY',baselineRunnerSha256:'${BASE}',diagnosticRunnerSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'friends-filmstrip-diagnostic.cjs'))).digest('hex'),warmup:'No extra warmup; normal setup, asset readiness and existing800ms wait; fresh browser/context per mode; OFF runs second on same CI machine, OS caches may be warm',metrics:{},clock:'UNMODIFIED',gestureSteps:20};\nconst digits=s=>`);
 replace("assert.equal(build.target,'GITHUB_PAGES_OWNER_PLAYTEST');",`assert.equal(build.buildId,'${BUILD}','Same frozen compiled public build');assert.equal(build.target,'GITHUB_PAGES_OWNER_PLAYTEST');`);
 replace('await context.tracing.start({screenshots:true,snapshots:true,sources:true});',`await context.tracing.start({screenshots:${mode==='on'},snapshots:true,sources:true});`);
 replace("async function legacyTopContour(label){\n  const before=await saved();",`async function legacyTopContour(label){
  const before=await saved();
  const observe=()=>page.locator('.int-rh2-field-host').evaluate(h=>{const canvases=document.querySelectorAll('.cm-ranch-three-canvas');if(canvases.length!==1||!(Number(canvases[0].dataset.frames)>0))throw Error('One actually rendered Three canvas required');const c=canvases[0],gl=c.getContext('webgl2');if(!gl)throw Error('Actual Three WebGL2 context required');const ext=gl.getExtension('WEBGL_debug_renderer_info');const renderer={className:c.className,width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};return {renderer,threeFrames:Number(c.dataset.frames),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},rect:{x:h.getBoundingClientRect().x,y:h.getBoundingClientRect().y,width:h.clientWidth,height:h.clientHeight},loadState:h.dataset.loadState,ariaBusy:h.getAttribute('aria-busy'),assets:JSON.parse(h.dataset.residentAssets||'[]'),positions:JSON.parse(h.dataset.residentScreenPositions||'[]')};});
  const measured=async(name,action)=>{const t=performance.now();try{return await action();}finally{evidence.filmstrip.metrics[name]=performance.now()-t;write();}};`);
 replace('for(let gesture=0;gesture<4;gesture++){',`await clearCalendar();
   evidence.filmstrip.before=await observe();write();
   await measured('beforePngMs',()=>shot('filmstrip-before'));
   for(let gesture=0;gesture<1;gesture++){`);
 replace("await page.mouse.move(box.x+start.x,box.y+Math.min(box.height-120,start.y+420),{steps:20});await page.mouse.up();await page.waitForTimeout(250);",`evidence.filmstrip.gesture={box,start,end:{x:box.x+start.x,y:box.y+Math.min(box.height-120,start.y+420)},steps:20};write();
    await measured('move20Ms',()=>page.mouse.move(box.x+start.x,box.y+Math.min(box.height-120,start.y+420),{steps:20}));
    await measured('mouseUpMs',()=>page.mouse.up());await measured('existing250msWaitElapsed',()=>page.waitForTimeout(250));`);
 replace("evidence.assertions.push({topContour:label,viewport,ordinaryCameraSwipes:4,legacyTelemetry:'NOT_ENABLED',visualReviewRequired:true});write();await clearCalendar();await shot(label+'-top-contour-'+viewport.width);",`assert.deepEqual(viewport,{width:1280,height:800});
   await clearCalendar();evidence.filmstrip.after=await observe();write();
   await measured('afterPngMs',()=>shot('filmstrip-after'));
   const after=await saved();assert.deepEqual(after.cageEdit.placements,before.cageEdit.placements);assert.deepEqual(after.shop,before.shop,'Swipes cannot spend food or change inventory');
   evidence.filmstrip.savedInvariant={before:{shop:before.shop,placements:before.cageEdit.placements},after:{shop:after.shop,placements:after.cageEdit.placements}};
   evidence.filmstrip.completedGestures=1;write();return;`);
 replace("await legacyTopContour('08-source-'+scenario.name);",`assert.equal(scenario.name,'adjacent');
   evidence.filmstrip.resources=[];write();
   for(const asset of ['field_cm02_01/frame-00.webp','field_cm18_01/frame-00.webp','field_cm39_01/frame-00.webp','field_cm39_01/frame-01.webp']){
    const matches=[...loadedPaddedUrls].filter(url=>url.includes('source-bounds-r1-20261015/fields/'+asset));assert.equal(matches.length,1,'Exact successfully loaded padded phase required: '+asset);
    const url=matches[0];assert.ok(url.startsWith(publicBase));const file=resolveAsset(root,'/'+new URL(url).pathname.slice(new URL(publicBase).pathname.length));assert.ok(file,'Exact resource must belong to built artifact');const bytes=fs.readFileSync(file);evidence.filmstrip.resources.push({asset,url,sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});write();
   }
   await legacyTopContour('08-source-'+scenario.name);return;`);
 replace("evidence.status='PASS';write();console.log('CHAMPIONSHIP_FRIENDS_PLAYTEST_BROWSER_PASS');","evidence.status='DIAGNOSTIC_CAPTURED';write();console.log('FRIENDS_FILMSTRIP_DIAGNOSTIC_CAPTURED');");
 return source;
}
function join(rows){
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.filmstrip?.mode).sort(),['off','on']);
 const on=rows.find(r=>r.filmstrip.mode==='on'),off=rows.find(r=>r.filmstrip.mode==='off');
 for(const [i,r] of [on,off].entries()){
  assert.equal(r.status,'DIAGNOSTIC_CAPTURED');assert.equal(r.partition,undefined);assert.equal(r.buildId,BUILD);assert.equal(r.commit,on.commit);assert.match(r.commit,/^[a-f0-9]{40}$/);
  const f=r.filmstrip;assert.equal(f.schema,1);assert.equal(f.scope,'FIRST_ADJACENT_DESKTOP_GESTURE_ONLY');assert.equal(f.order,i+1);assert.equal(f.completedGestures,1);assert.equal(f.gestureSteps,20);assert.equal(f.gesture.steps,20);assert.equal(f.baselineRunnerSha256,BASE);assert.equal(f.diagnosticRunnerSha256,crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'));assert.equal(r.browserVersion,on.browserVersion);
  assert.deepEqual(f.before.viewport,{width:1280,height:800,dpr:1});assert.deepEqual(f.after.viewport,f.before.viewport);assert.deepEqual(f.after.renderer,f.before.renderer);assert.deepEqual(f.before.renderer,on.filmstrip.before.renderer);assert.ok(f.before.threeFrames>0&&f.after.threeFrames>0);
  for(const state of [f.before,f.after]){assert.ok(state.assets.length>0);assert.ok(state.assets.every(a=>a.state==='ready'&&!a.error));const ids=state.assets.map(a=>({creatureId:a.creatureId,speciesId:a.speciesId,entityId:a.entityId})).sort((a,b)=>a.creatureId.localeCompare(b.creatureId));const reference=on.filmstrip.before.assets.map(a=>({creatureId:a.creatureId,speciesId:a.speciesId,entityId:a.entityId})).sort((a,b)=>a.creatureId.localeCompare(b.creatureId));assert.deepEqual(ids,reference);}
  assert.deepEqual(f.resources.map(r=>r.asset),['field_cm02_01/frame-00.webp','field_cm18_01/frame-00.webp','field_cm39_01/frame-00.webp','field_cm39_01/frame-01.webp']);assert.deepEqual(f.resources,on.filmstrip.resources);for(const resource of f.resources){assert.match(resource.sha256,/^[a-f0-9]{64}$/);assert.ok(resource.bytes>0);}
  assert.deepEqual(f.savedInvariant.before,f.savedInvariant.after);assert.equal(f.before.loadState,'ready');assert.equal(f.after.loadState,'ready');
  for(const k of ['beforePngMs','move20Ms','mouseUpMs','existing250msWaitElapsed','afterPngMs'])assert.ok(Number.isFinite(f.metrics[k])&&f.metrics[k]>=0,k);
  assert.ok(f.metrics.move20Ms>0,'Positive measured gesture duration required');assert.deepEqual(r.pageErrors,[]);assert.deepEqual(r.networkErrors,[]);assert.deepEqual(r.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_PIXI_FALLBACK|CHAMPIONSHIP_HUNT_(ART|DEPTH)_FALLBACK|Hunt feedback art unavailable/.test(m.text)),[]);
 }
 assert.deepEqual(on.filmstrip.savedInvariant.before.placements,off.filmstrip.savedInvariant.before.placements);assert.deepEqual(on.filmstrip.gesture,off.filmstrip.gesture,'Exact actual CSS gesture must match');
 return {status:'PAIRED_DIAGNOSTIC_ONLY',commit:on.commit,buildId:BUILD,order:['on','off'],move20Ms:{on:on.filmstrip.metrics.move20Ms,off:off.filmstrip.metrics.move20Ms},ratioOffToOn:off.filmstrip.metrics.move20Ms/on.filmstrip.metrics.move20Ms,limitations:['One fixed-order pair, not general causal proof','Independent fresh contexts, natural clock and actors are not same-frame paired','OFF second may benefit from OS caches','Does not complete source-corners or waive canceled Friends gates']};
}
module.exports={BASE,BUILD,transform,join};
if(require.main===module){
 if(process.argv[2]==='join'){
  assert.equal(process.argv.length,6);const rows=process.argv.slice(3,5).map(p=>JSON.parse(fs.readFileSync(p)));const receipt=join(rows);assert.equal(receipt.commit,process.env.GITHUB_SHA,'Current run commit required');
  receipt.retainedArtifacts=process.argv.slice(3,5).map((resultFile,i)=>({mode:rows[i].filmstrip.mode,files:['filmstrip-before.png','filmstrip-after.png','source-corners-trace.zip'].map(name=>{const file=path.join(path.dirname(resultFile),name),stat=fs.statSync(file);assert.ok(stat.isFile()&&stat.size>0,'Required explicit PNG/action trace retained: '+name);const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(0,name.endsWith('.png')?8:4).toString('hex'),name.endsWith('.png')?'89504e470d0a1a0a':'504b0304','Expected PNG or traceZIP signature');return {name,bytes:stat.size,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};})}));
  fs.writeFileSync(process.argv[5],JSON.stringify(receipt,null,2)+'\n');
 }else{
  const mode=process.argv[2];const filename=path.join(__dirname,'championship-friends-playtest-browser.cjs');const source=transform(fs.readFileSync(filename,'utf8'),mode);
  const Module=require('node:module'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);
 }
}
