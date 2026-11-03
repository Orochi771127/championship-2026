// TEST ONLY: exact reviewed Friends runner, bounded first adjacent desktop gesture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const BASE='baec5bf6a60751db718d8d02f2957858e75fcd20dde9f1067b317cdf32bfd3ad';
// AW23/species196 web-atlas repack on the Ai-chan story build; the same cage/Three resources below remain pinned.
const BUILD='6d42613e8c6d12c99eeb89b182ae6495da5c6a10a3abcb2b8806d063ac410db9';
const RESOURCES=Object.freeze([{"path":"assets/production/cage/three-20261021/manifest.json","bytes":8530,"sha256":"8d3aa3efd3f9dbef4dcf4785ee493f7d8867ab860c10e3e3790348c95c6525a7"},{"fieldId":"field_cm02_01","path":"assets/production/cage/three-20261021/field_cm02_01.glb","bytes":900856,"sha256":"80efcd18ff4d9e2ee94fa64843b7e14ba5abd2705e64339be531762356684307"},{"fieldId":"field_cm18_01","path":"assets/production/cage/three-20261021/field_cm18_01.glb","bytes":1853276,"sha256":"6657497289f9f10ac376f5d31d2ff50b0cb1629da65f64c49bade3788cbc6e41"},{"fieldId":"field_cm39_01","path":"assets/production/cage/three-20261021/field_cm39_01.glb","bytes":281140,"sha256":"075d4d932b1fd5b7f5c6e4467fe636a3e4905eb08d715b717892a2003718b6f2"}]);
function verifyThreeResponses(row){
 assert.equal(row.sourceThreeReadbacksComplete?.responses,row.sourceThreeResponses?.length,'All owned response reads completed');
 assert.equal(row.sourceThreeReadbacksComplete?.reads,row.sourceThreeResponses?.length);
 assert.ok(Array.isArray(row.sourceThreeResponses)&&row.sourceThreeResponses.length>=RESOURCES.length);
 for(const expected of RESOURCES){
  const actual=row.sourceThreeResponses.filter(r=>r.path===expected.path);assert.ok(actual.length,'Actual response required: '+expected.path);
  for(const r of actual){assert.equal(r.url,'https://orochi771127.github.io/championship-2026/'+expected.path);assert.equal(r.status,200);assert.equal(r.bytes,expected.bytes);assert.equal(r.sha256,expected.sha256);assert.equal(r.error,undefined);}
 }
 assert.ok(row.sourceThreeResponses.every(r=>RESOURCES.some(e=>e.path===r.path)),'No invented resource authority');
}
function transform(source,mode){
 assert.ok(['on','off'].includes(mode));assert.equal(crypto.createHash('sha256').update(source).digest('hex'),BASE,'Exact frozen normal runner required');
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'Unique diagnostic seam '+a.slice(0,60));source=source.replace(a,b);};
 replace("const groups=selectedGroups(process.env.CHAMPIONSHIP_FRIENDS_GROUP);","const groups=selectedGroups('source-adjacent-desktop');");
 // Never emit a normal partition receipt or normal PASS for this truncated diagnostic.
 source=source.replaceAll('evidence.partition','evidence.diagnosticSelection');
 replace("const digits=s=>",`evidence.filmstrip={schema:1,mode:${JSON.stringify(mode)},order:${mode==='on'?1:2},scope:'FIRST_ADJACENT_DESKTOP_GESTURE_ONLY',baselineRunnerSha256:'${BASE}',diagnosticRunnerSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'friends-filmstrip-diagnostic.cjs'))).digest('hex'),warmup:'No explicit warmup loop; normal setup/readiness/existing800ms wait plus identical response hashing and PNG/GL observations add elapsed time; bounded resident readiness polling before snapshots; fresh contexts; fixed OFF second may benefit from OS cache',metrics:{},clock:'UNMODIFIED',gestureSteps:20};\nconst digits=s=>`);
 replace("assert.equal(build.target,'GITHUB_PAGES_OWNER_PLAYTEST');",`assert.equal(build.buildId,'${BUILD}','Same frozen compiled public build');assert.equal(build.target,'GITHUB_PAGES_OWNER_PLAYTEST');`);
 replace('await context.tracing.start({screenshots:true,snapshots:true,sources:true});',`await context.tracing.start({screenshots:${mode==='on'},snapshots:true,sources:true});`);
 replace("async function legacyTopContour(label,viewports=[{width:1280,height:800},{width:390,height:844}]){\n  const before=await boundary('saved:read-only',()=>saved());",`async function legacyTopContour(label,viewports=[{width:1280,height:800},{width:390,height:844}]){
  const before=await boundary('saved:read-only',()=>saved());
  const observe=async()=>{const started=performance.now();const handle=await page.waitForFunction(${readResidentObservation.toString()},null,{timeout:30000});try{return await handle.jsonValue();}finally{await handle.dispose();(evidence.filmstrip.readinessWaitsMs??=[]).push(performance.now()-started);write();}};
  const measured=async(name,action)=>{const t=performance.now();try{return await action();}finally{evidence.filmstrip.metrics[name]=performance.now()-t;write();}};
  const captureField=async(label,metric)=>{
   const ready=s=>{assert.equal(s.overlay?.kind,'canvas');return friendsThreeSnapshotReady(s.three);};
   const poll=new Function('selector','const s=('+friendsMakeFieldObservation().toString()+')(selector);return s.overlay?.kind==="canvas"&&('+friendsThreeSnapshotReady.toString()+')(s.three)?s:false;');
   return require('./friends-filmstrip-diagnostic.cjs').captureReady({
    now:()=>performance.now(),ready,
    poll:async timeout=>{const h=await page.waitForFunction(poll,ranchCanvasSelector,{timeout});try{return await h.jsonValue();}finally{await h.dispose();}},
    observe:()=>page.evaluate(friendsMakeFieldObservation(),ranchCanvasSelector),
    shot:attempt=>measured(metric,()=>shot(label+'-attempt-'+attempt)),
    record:row=>{(evidence.filmstrip.captureAttempts??=[]).push({label,...row});write();},
    retain:attempt=>fs.copyFileSync(path.join(output,label+'-attempt-'+attempt+'.png'),path.join(output,label+'.png'))
   });
  };`);
 replace('for(let gesture=0;gesture<4;gesture++){',`await clearCalendar(null,{fieldReady:true});
   evidence.filmstrip.before=await observe();write();
   (evidence.filmstrip.fieldCaptures??={}).before=await captureField('filmstrip-before','beforePngMs');write();
   friendsFieldCaptureReady(evidence.filmstrip.fieldCaptures.before.before);friendsFieldCaptureReady(evidence.filmstrip.fieldCaptures.before.after);
   for(let gesture=0;gesture<1;gesture++){`);
 replace("await boundary('mouse.move',()=>page.mouse.move(box.x+start.x,box.y+Math.min(box.height-120,start.y+420),{steps:20}));await boundary('mouse.up',()=>page.mouse.up());await boundary('wait:250',()=>page.waitForTimeout(250));",`evidence.filmstrip.gesture={box,start,end:{x:box.x+start.x,y:box.y+Math.min(box.height-120,start.y+420)},steps:20};write();
    await measured('move20Ms',()=>page.mouse.move(box.x+start.x,box.y+Math.min(box.height-120,start.y+420),{steps:20}));
    await measured('mouseUpMs',()=>page.mouse.up());await measured('existing250msWaitElapsed',()=>page.waitForTimeout(250));`);
 replace("evidence.assertions.push({topContour:label,viewport,ordinaryCameraSwipes:4,legacyTelemetry:'NOT_ENABLED',visualReviewRequired:true});write();await boundary('clearCalendar',()=>clearCalendar(null,{fieldReady:Boolean(evidence.sourceCoverage)}));await (evidence.sourceCoverage?sourceShot(label+'-top-contour-'+viewport.width):shot(label+'-top-contour-'+viewport.width));",`assert.deepEqual(viewport,{width:1280,height:800});
   await clearCalendar(null,{fieldReady:true});evidence.filmstrip.after=await observe();write();
   (evidence.filmstrip.fieldCaptures??={}).after=await captureField('filmstrip-after','afterPngMs');write();
   friendsFieldCaptureReady(evidence.filmstrip.fieldCaptures.after.before);friendsFieldCaptureReady(evidence.filmstrip.fieldCaptures.after.after);
   const after=await saved();assert.deepEqual(after.cageEdit.placements,before.cageEdit.placements);assert.deepEqual(after.shop,before.shop,'Swipes cannot spend food or change inventory');
   evidence.filmstrip.savedInvariant={before:{shop:before.shop,placements:before.cageEdit.placements},after:{shop:after.shop,placements:after.cageEdit.placements}};
   evidence.filmstrip.completedGestures=1;write();return;`);
 replace("await legacyTopContour('08-source-'+scenario.name,[selected.viewport]);coverage.topGestures=4;write();",`assert.equal(scenario.name,'adjacent');
   evidence.filmstrip.resourceAuthority='THREE_PUBLIC_MANIFEST_GLB_RESPONSES_V1';
   evidence.filmstrip.resources=resourceIdentity;write();
   await legacyTopContour('08-source-'+scenario.name);
   const diagnosticThreeAfter=await readThree();
   evidence.filmstrip.threeProgress={before:threeBefore,after:diagnosticThreeAfter};write();
   friendsThreeProgress(threeBefore,diagnosticThreeAfter);
   await friendsDrainReadbacks(threeResponseReads);page.off('response',onThreeResponse);
   friendsThreeIdentity(threeResponses);evidence.sourceThreeReadbacksComplete={responses:threeResponses.length,reads:threeResponseReads.length};write();return;`);
 replace("evidence.status='PASS';write();console.log('CHAMPIONSHIP_FRIENDS_PLAYTEST_BROWSER_PASS');","evidence.status='DIAGNOSTIC_CAPTURED';write();console.log('FRIENDS_FILMSTRIP_DIAGNOSTIC_CAPTURED');");
 return source;
}
const identity=state=>state.assets.map(a=>({creatureId:a.creatureId,speciesId:a.speciesId,entityId:a.entityId})).sort((a,b)=>a.creatureId.localeCompare(b.creatureId));
function pairedLifecycle(on,off){
 // Compare equivalent time boundaries, not an egg before its hatch to its own
 // later form. Both independent contexts must show the same transition.
 assert.deepEqual(identity(off.before),identity(on.before),'Same starting residents');
 assert.deepEqual(identity(off.after),identity(on.after),'Same ending residents');
 const before=identity(on.before),after=identity(on.after);
 assert.deepEqual(after.map(a=>a.creatureId),before.map(a=>a.creatureId),'No actor added/removed');
 const changes=before.flatMap((a,i)=>JSON.stringify(a)===JSON.stringify(after[i])?[]:[{before:a,after:after[i]}]);
 if(changes.length){
  const seedBytes=fs.readFileSync(path.join(__dirname,'../qa/championship-full-qa-save.json'));
  assert.equal(crypto.createHash('sha256').update(seedBytes).digest('hex'),'04303429e62c1394dbd696ae67423f957512ed0987384cd962e89176bf6663b4','Exact immutable hatch fixture');
  const seed=JSON.parse(seedBytes);assert.equal(seed.creature.nativeProfile.fields['000'],0);assert.equal(seed.creature.nativeProfile.fields['140'],14);
  assert.deepEqual(changes,[{before:{creatureId:seed.creature.creatureId,speciesId:'championship:creature:species-000',entityId:'e000_digitama'},after:{creatureId:seed.creature.creatureId,speciesId:'championship:creature:species-014',entityId:'m007_botamon'}}],'Only the same fixture-defined natural hatch in both contexts');
 }
 return changes;
}
function join(rows){
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.filmstrip?.mode).sort(),['off','on']);
 const on=rows.find(r=>r.filmstrip.mode==='on'),off=rows.find(r=>r.filmstrip.mode==='off');
 for(const [i,r] of [on,off].entries()){
  assert.equal(r.status,'DIAGNOSTIC_CAPTURED');assert.equal(r.partition,undefined);assert.equal(r.buildId,BUILD);assert.equal(r.commit,on.commit);assert.match(r.commit,/^[a-f0-9]{40}$/);
  const f=r.filmstrip;assert.equal(f.schema,1);assert.equal(f.scope,'FIRST_ADJACENT_DESKTOP_GESTURE_ONLY');assert.equal(f.order,i+1);assert.equal(f.completedGestures,1);assert.equal(f.gestureSteps,20);assert.equal(f.gesture.steps,20);assert.equal(f.baselineRunnerSha256,BASE);assert.equal(f.diagnosticRunnerSha256,crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'));assert.equal(r.browserVersion,on.browserVersion);
  assert.deepEqual(f.before.viewport,{width:1280,height:800,dpr:1});assert.deepEqual(f.after.viewport,f.before.viewport);assert.deepEqual(f.after.renderer,f.before.renderer);assert.deepEqual(f.before.renderer,on.filmstrip.before.renderer);assert.ok(Number.isSafeInteger(f.before.threeFrames)&&Number.isSafeInteger(f.after.threeFrames)&&f.before.threeFrames>0&&f.after.threeFrames>f.before.threeFrames,'Actual Three frames advance across the gesture');
  for(const state of [f.before,f.after]){assert.ok(state.assets.length>0);assert.ok(state.assets.every(a=>a.state==='ready'&&!a.error));}
  assert.equal(f.resourceAuthority,'THREE_PUBLIC_MANIFEST_GLB_RESPONSES_V1');assert.deepEqual(f.resources,RESOURCES);verifyThreeResponses(r);
  assert.deepEqual(f.savedInvariant.before,f.savedInvariant.after);assert.equal(f.before.loadState,'ready');assert.equal(f.after.loadState,'ready');assert.equal(f.before.ariaBusy,'false');assert.equal(f.after.ariaBusy,'false');
  for(const k of ['beforePngMs','move20Ms','mouseUpMs','existing250msWaitElapsed','afterPngMs'])assert.ok(Number.isFinite(f.metrics[k])&&f.metrics[k]>=0,k);
  assert.ok(f.metrics.move20Ms>0,'Positive measured gesture duration required');assert.deepEqual(r.pageErrors,[]);assert.deepEqual(r.networkErrors,[]);assert.deepEqual(r.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_RANCH_3D_FALLBACK|CHAMPIONSHIP_PIXI_FALLBACK|CHAMPIONSHIP_HUNT_(ART|DEPTH)_FALLBACK|Hunt feedback art unavailable/.test(m.text)),[]);
 }
 assert.deepEqual(on.filmstrip.savedInvariant.before.placements,off.filmstrip.savedInvariant.before.placements);assert.deepEqual(on.filmstrip.gesture,off.filmstrip.gesture,'Exact actual CSS gesture must match');
 const lifecycleChanges=pairedLifecycle(on.filmstrip,off.filmstrip);
 return {status:'PAIRED_DIAGNOSTIC_ONLY',commit:on.commit,buildId:BUILD,order:['on','off'],lifecycleChanges,performanceComparable:lifecycleChanges.length===0,move20Ms:{on:on.filmstrip.metrics.move20Ms,off:off.filmstrip.metrics.move20Ms},ratioOffToOn:off.filmstrip.metrics.move20Ms/on.filmstrip.metrics.move20Ms,limitations:['One fixed-order pair, not general causal proof','Independent fresh contexts, natural clock and actors are not same-frame paired','A recorded natural hatch makes the timing ratio unsuitable for performance conclusions','OFF second may benefit from OS caches','Does not complete source-corners or waive canceled Friends gates']};
}
// Read readiness and the rich receipt in one browser turn. No later RPC may
// replace this snapshot after a resident begins another asynchronous load.
function readResidentObservation(){
 const h=document.querySelector('.int-rh2-field-host');if(!h)return false;
 const assets=JSON.parse(h.dataset.residentAssets||'[]');
 if(h.dataset.loadState==='error'||assets.some(a=>a.error||a.state==='error'))throw Error('Resident resource failure');
 if(h.dataset.loadState!=='ready'||h.getAttribute('aria-busy')!=='false'||!assets.length||!assets.every(a=>a.state==='ready'))return false;
 const canvases=document.querySelectorAll('.cm-ranch-three-canvas');
 if(canvases.length!==1||!(Number(canvases[0].dataset.frames)>0))throw Error('One actually rendered Three canvas required');
 const c=canvases[0],gl=c.getContext('webgl2');if(!gl)throw Error('Actual Three WebGL2 context required');
 const ext=gl.getExtension('WEBGL_debug_renderer_info');
 const renderer={className:c.className,width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
 return {renderer,threeFrames:Number(c.dataset.frames),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},rect:{x:h.getBoundingClientRect().x,y:h.getBoundingClientRect().y,width:h.clientWidth,height:h.clientHeight},loadState:h.dataset.loadState,ariaBusy:h.getAttribute('aria-busy'),assets,positions:JSON.parse(h.dataset.residentScreenPositions||'[]')};
}
async function captureReady(api){
 const deadline=api.now()+30000;
 for(let attempt=0;attempt<3;attempt++){
  const remaining=deadline-api.now();assert.ok(remaining>0,'Field capture readiness budget exhausted');
  const before=await api.poll(remaining);assert.equal(api.ready(before),true,'Atomic pre-capture snapshot ready');
  await api.shot(attempt);const after=await api.observe();
  const row={attempt,before,after,rawPngRetained:true};api.record(row);
  // Fatal renderer/resource errors throw here. Only transient not-ready state
  // can retry, with each original PNG and observation retained independently.
  if(api.ready(after)){await api.retain(attempt);return row;}
 }
 throw Error('Field capture stayed transient across three retained attempts');
}
module.exports={BASE,BUILD,RESOURCES,transform,join,captureReady,readResidentObservation};
function retainedTraceName(row){
 const name=row.finalTrace?.file;
 assert.ok(typeof name==='string'&&/^[a-zA-Z0-9_-]+-trace\.zip$/.test(name)&&path.basename(name)===name,'Safe finalTrace basename required');
 assert.ok(Number.isSafeInteger(row.finalTrace.bytes)&&row.finalTrace.bytes>0,'Positive finalTrace bytes required');
 return name;
}
if(require.main===module){
 if(process.argv[2]==='join'){
  assert.equal(process.argv.length,6);const rows=process.argv.slice(3,5).map(p=>JSON.parse(fs.readFileSync(p)));const receipt=join(rows);assert.equal(receipt.commit,process.env.GITHUB_SHA,'Current run commit required');
  receipt.retainedArtifacts=process.argv.slice(3,5).map((resultFile,i)=>({mode:rows[i].filmstrip.mode,files:['filmstrip-before.png','filmstrip-after.png',retainedTraceName(rows[i])].map(name=>{const file=path.join(path.dirname(resultFile),name),stat=fs.statSync(file);assert.ok(stat.isFile()&&stat.size>0,'Required explicit PNG/action trace retained: '+name);const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(0,name.endsWith('.png')?8:4).toString('hex'),name.endsWith('.png')?'89504e470d0a1a0a':'504b0304','Expected PNG or traceZIP signature');if(name.endsWith('.zip'))assert.equal(stat.size,rows[i].finalTrace.bytes,'Trace bytes match capture receipt');return {name,bytes:stat.size,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};})}));
  fs.writeFileSync(process.argv[5],JSON.stringify(receipt,null,2)+'\n');
 }else{
  const mode=process.argv[2];const filename=path.join(__dirname,'championship-friends-playtest-browser.cjs');const source=transform(fs.readFileSync(filename,'utf8'),mode);
  const Module=require('node:module'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);
 }
}
