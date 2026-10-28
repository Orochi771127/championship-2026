const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCE_CASES=Object.freeze(['source-adjacent-desktop','source-adjacent-mobile','source-wrap-desktop','source-wrap-mobile']);
const GROUPS=Object.freeze(['fresh-economy','legacy-persistence',...SOURCE_CASES]);
function sourceCase(id){if(!SOURCE_CASES.includes(id))return null;const [,scenario,device]=id.split('-');return {scenario,viewport:device==='desktop'?{width:1280,height:800}:{width:390,height:844}};}
function verifySource(r){
 const s=sourceCase(r.partition.requested);assert.ok(s);const c=r.sourceCoverage;assert.equal(c.caseId,r.partition.requested);assert.equal(c.scenario,s.scenario);assert.deepEqual(c.viewport,s.viewport);assert.equal(c.topGestures,4);assert.equal(c.framingGestures,s.viewport.width===1280?1:0);const pans=s.viewport.width===1280?6:9;assert.equal(c.panGestures,pans);assert.deepEqual(c.phaseCaptures,Array.from({length:pans},(_,pan)=>[0,1,2].map(phase=>({pan,phase}))).flat());
 for(const key of ['persistence','three','readbacks'])assert.equal(c[key],true);assert.equal(c.continuity,'INDEPENDENT_VIEWPORT_NOT_CROSS_VIEWPORT_CLOCK_OR_CAMERA');
 assert.match(c.baseline.fixtureSeedSha256,/^[0-9a-f]{64}$/);assert.ok(Number.isInteger(c.baseline.schemaVersion));assert.equal(typeof c.baseline.layoutVersion,'string');assert.ok(c.baseline.layoutVersion.length>0);assert.ok(c.baseline.shop&&Array.isArray(c.baseline.placements));
 const names=s.scenario==='adjacent'?['adjacent']:['adjacent','wrap'];assert.deepEqual(c.setup.map(x=>x.scenario),names);
 for(const x of c.setup){assert.equal(x.reloaded,true);assert.equal(x.schemaVersion,7);assert.equal(x.layoutVersion,'PRODUCT_HEX_WORLD_V1');const slots=x.scenario==='adjacent'?[201,203,226]:[201,203,232];assert.deepEqual(x.slots,slots);assert.deepEqual(x.placements,[{moduleId:'championship:2026:cage:waiting-room',slotIndex:199},...[1,17,33].map((id,i)=>({moduleId:'championship:2026:cage:'+id,slotIndex:slots[i]}))].sort((a,b)=>a.moduleId.localeCompare(b.moduleId)));assert.deepEqual(x.shop,{...c.baseline.shop,cageQuantities:c.baseline.shop.cageQuantities??Object.fromEntries(c.baseline.shop.cageOwned.map(id=>[id,1]))});}
 assert.ok(r.sourceThreeReadbacksComplete?.responses>=4);assert.equal(r.sourceThreeReadbacksComplete.reads,r.sourceThreeReadbacksComplete.responses);return c;
}
function selectedGroups(value){
 if(value===undefined||value==='all')return [...GROUPS];
 assert.ok(GROUPS.includes(value),'Unknown Friends scenario group');return [value];
}
function verifyComplete(rows,{commit,runnerSha256}){
 assert.match(commit,/^[0-9a-f]{40}$/);assert.match(runnerSha256,/^[0-9a-f]{64}$/);
 assert.equal(rows.length,GROUPS.length,'Exactly six scenario receipts required');
 const seen=new Set();let buildId,sourceBaseline;
 for(const r of rows){
  assert.equal(r.status,'PASS');assert.equal(r.commit,commit);
  assert.equal(r.partition?.schema,1);assert.equal(r.partition.runnerSha256,runnerSha256);
  const group=r.partition.requested;assert.ok(GROUPS.includes(group));assert.ok(!seen.has(group),'Duplicate scenario receipt');seen.add(group);
  assert.deepEqual(r.partition.expected,[group]);assert.deepEqual(r.partition.completed,[group]);
  assert.equal(typeof r.buildId,'string');assert.ok(r.buildId.length>0);if(buildId===undefined)buildId=r.buildId;assert.equal(r.buildId,buildId,'Same exact public build required');
  assert.deepEqual(r.pageErrors,[]);assert.deepEqual(r.networkErrors,[]);assert.deepEqual(r.routeErrors,[]);
  if(sourceCase(group)){const c=verifySource(r);if(sourceBaseline===undefined)sourceBaseline=c.baseline;assert.deepEqual(c.baseline,sourceBaseline,'Same installed source fixture and economy baseline');}
  assert.ok(Array.isArray(r.console));assert.deepEqual(r.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_RANCH_3D_FALLBACK|CHAMPIONSHIP_PIXI_FALLBACK|CHAMPIONSHIP_HUNT_(ART|DEPTH)_FALLBACK|Hunt feedback art unavailable/.test(m.text)),[]);
 }
 assert.deepEqual([...seen].sort(),[...GROUPS].sort());return {status:'PASS',commit,runnerSha256,buildId,groups:[...GROUPS]};
}
module.exports={GROUPS,SOURCE_CASES,sourceCase,verifySource,selectedGroups,verifyComplete};
if(require.main===module){
 const dir=path.resolve(process.argv[2]||'');assert.ok(process.argv[2],'Receipt directory required');
 const files=[];function visit(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())visit(f);else if(e.name==='result.json')files.push(f);}}visit(dir);
 const runnerSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'championship-friends-playtest-browser.cjs'))).digest('hex');
 const receipt=verifyComplete(files.map(f=>JSON.parse(fs.readFileSync(f,'utf8'))),{commit:process.env.GITHUB_SHA,runnerSha256});
 fs.writeFileSync(path.join(dir,'completeness.json'),JSON.stringify({...receipt,receipts:files.map(f=>path.relative(dir,f))},null,2)+'\n');console.log('CHAMPIONSHIP_FRIENDS_ALL_GROUPS_PASS');
}
