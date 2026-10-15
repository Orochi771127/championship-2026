const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
function resolveAsset(root,urlPath){
 let relative;try{relative=decodeURIComponent(urlPath);}catch{return null;}
 if(relative.includes('\0')||relative.includes('\\')||relative.split('/').includes('..'))return null;
 const base=fs.realpathSync(root),file=path.resolve(base,'.'+(relative.startsWith('/')?relative:'/'+relative));
 if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
 const real=fs.realpathSync(file);return real.startsWith(base+path.sep)?real:null;
}
async function serveBuild(root){
 const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const file=resolveAsset(root,new URL(req.url,'http://localhost').pathname);
  if(!file){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
function assertEvolved(assert,report){
 assert.equal(report.qaOnly,true);assert.equal(report.namespace,'championshipAlternateFormsQA:r1:');assert.equal(report.saveSchema,6);
 assert.match(report.storage,/sessionStorage/);assert.deepEqual(report.errors,[]);
 const identity={211:['m528_metaletemon','m528_metaletemon'],222:['m540_imperialdramon_fm','m506_griffomon'],229:['oc_crownbrass_mandrill','m528_metaletemon'],230:['oc_celestyrant_battle_r10','m540_imperialdramon_fm']};
 for(const [suffix,id]of [['0001',211],['0002',222],['0005',229],['0006',230]]){
  const instance=report.instances.find(i=>i.instanceId===`championship:2026:instance:${suffix}`);
  assert.ok(instance,`Missing actual instance ${suffix}`);assert.equal(instance.speciesIndex,id);assert.equal(instance.actorSpeciesIndex,id);assert.equal(instance.configuredEntity,identity[id][0]);assert.equal(instance.configuredMotionDonor,identity[id][1]);
 }
}
function assertBattleLoaders(assert,reports,beforeCount,{exactCount=false}={}){
 assert.ok(reports.length>beforeCount);
 for(const report of reports){assert.ok(!report.error);assert.deepEqual(report.failures||[],[]);assert.deepEqual(report.replacementFailures||[],[]);assert.deepEqual(report.completedOriginalArt?.failures||[],[]);}
 const entities=['m528_metaletemon','m540_imperialdramon_fm','oc_crownbrass_mandrill','oc_celestyrant_battle_r10'];
 const battleReport=reports.slice(beforeCount).find(r=>JSON.stringify(r.loadedSides)==='["main"]'&&(!exactCount||(r.loadedEntityIds?.length===entities.length&&r.completedOriginalArt?.loaded.length===entities.length))&&entities.every(id=>r.loadedEntityIds?.includes(id)&&r.completedOriginalArt?.loaded.includes(id)));
 assert.ok(battleReport,'New battle-specific main-side loader report must prove all four actual entities');
 assert.equal(battleReport.completedOriginalArt.scope,'OWNER_HASH_SELECTED_PLAYTEST');assert.equal(battleReport.completedOriginalArt.publicReleasePermitted,true);return battleReport;
}
module.exports={MIME,resolveAsset,serveBuild,assertEvolved,assertBattleLoaders};
