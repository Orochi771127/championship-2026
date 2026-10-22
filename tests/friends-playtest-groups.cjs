const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const GROUPS=Object.freeze(['fresh-economy','legacy-persistence','source-corners']);
function selectedGroups(value){
 if(value===undefined||value==='all')return [...GROUPS];
 assert.ok(GROUPS.includes(value),'Unknown Friends scenario group');return [value];
}
function verifyComplete(rows,{commit,runnerSha256}){
 assert.match(commit,/^[0-9a-f]{40}$/);assert.match(runnerSha256,/^[0-9a-f]{64}$/);
 assert.equal(rows.length,GROUPS.length,'Exactly three scenario receipts required');
 const seen=new Set();let buildId;
 for(const r of rows){
  assert.equal(r.status,'PASS');assert.equal(r.commit,commit);
  assert.equal(r.partition?.schema,1);assert.equal(r.partition.runnerSha256,runnerSha256);
  const group=r.partition.requested;assert.ok(GROUPS.includes(group));assert.ok(!seen.has(group),'Duplicate scenario receipt');seen.add(group);
  assert.deepEqual(r.partition.expected,[group]);assert.deepEqual(r.partition.completed,[group]);
  assert.equal(typeof r.buildId,'string');assert.ok(r.buildId.length>0);if(buildId===undefined)buildId=r.buildId;assert.equal(r.buildId,buildId,'Same exact public build required');
  assert.deepEqual(r.pageErrors,[]);assert.deepEqual(r.networkErrors,[]);
  assert.ok(Array.isArray(r.console));assert.deepEqual(r.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_PIXI_FALLBACK|CHAMPIONSHIP_HUNT_(ART|DEPTH)_FALLBACK|Hunt feedback art unavailable/.test(m.text)),[]);
 }
 assert.deepEqual([...seen].sort(),[...GROUPS].sort());return {status:'PASS',commit,runnerSha256,buildId,groups:[...GROUPS]};
}
module.exports={GROUPS,selectedGroups,verifyComplete};
if(require.main===module){
 const dir=path.resolve(process.argv[2]||'');assert.ok(process.argv[2],'Receipt directory required');
 const files=[];function visit(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())visit(f);else if(e.name==='result.json')files.push(f);}}visit(dir);
 const runnerSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'championship-friends-playtest-browser.cjs'))).digest('hex');
 const receipt=verifyComplete(files.map(f=>JSON.parse(fs.readFileSync(f,'utf8'))),{commit:process.env.GITHUB_SHA,runnerSha256});
 fs.writeFileSync(path.join(dir,'completeness.json'),JSON.stringify({...receipt,receipts:files.map(f=>path.relative(dir,f))},null,2)+'\n');console.log('CHAMPIONSHIP_FRIENDS_ALL_GROUPS_PASS');
}
