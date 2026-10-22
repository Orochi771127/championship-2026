const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {resolveAsset,MIME}=require('./alternate-form-browser-support.cjs');
const {run,sha,NAME}=require('../scripts/alternate-form-qa-build.cjs');
// A validated dual artifact, never a source-checkout fallback. Only exact listed bytes.
function pairedResolver(publicRoot,qaRoot,publicRows,qaRows){
 const pub=new Map(publicRows.map(x=>[x.path,x])),qa=new Map(qaRows.map(x=>[x.path,x]));
 assert.equal(pub.size,publicRows.length);assert.equal(qa.size,qaRows.length);
 for(const f of qa.keys())assert.ok(!pub.has(f),'QA_PUBLIC_COLLISION');
 const snapshot=url=>{let rel;try{rel=decodeURIComponent(url);}catch{return null;}rel=rel.replace(/^\//,'');const row=qa.get(rel)||pub.get(rel);if(!row)return null;const root=qa.has(rel)?qaRoot:publicRoot;const file=resolveAsset(root,url);if(!file)return null;const b=fs.readFileSync(file);assert.equal(b.length,row.bytes,'QA_SERVED_SIZE');assert.equal(sha(b),row.sha256,'QA_SERVED_HASH');return {file,bytes:b};};const resolve=url=>snapshot(url)?.file??null;resolve.snapshot=snapshot;return resolve;
}
async function validatedPair({sourceRoot=process.cwd(),publicRoot,qaRoot}){
 const result=await run({root:sourceRoot,publicRoot,output:qaRoot,validate:true});
 const {decodeBuildManifest}=await import(require('node:url').pathToFileURL(path.join(sourceRoot,'scripts/lib/build-manifest-codec.mjs')));
 const pm=decodeBuildManifest(JSON.parse(fs.readFileSync(path.join(publicRoot,'pages-build.json'))));
 const resolve=pairedResolver(publicRoot,qaRoot,pm.files,result.manifest.files);
 return {manifest:result.manifest,resolve,read:url=>resolve.snapshot(url)?.bytes??null,async serve(){const server=http.createServer((req,res)=>{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}let snapshot;try{snapshot=resolve.snapshot(new URL(req.url,'http://localhost').pathname);}catch(error){res.writeHead(500);res.end('Artifact integrity failure');return;}if(!snapshot){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(snapshot.file)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':snapshot.bytes.length});if(req.method==='HEAD')res.end();else res.end(snapshot.bytes);});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};}};
}
function assertCurrentPublicBattleLoaders(assert,reports,beforeCount){
 assert.ok(Array.isArray(reports)&&reports.length>beforeCount,'New actual public loader report required');
 const entities=['m528_metaletemon','m540_imperialdramon_fm','oc_crownbrass_mandrill','oc_celestyrant_battle_r10'].sort();
 for(const report of reports){assert.equal(report.qaObservedLoader,'CURRENT_PUBLIC_CHARACTER_ROSTER');assert.ok(!report.error);assert.deepEqual(report.failures,[]);assert.deepEqual(report.replacementFailures,[]);assert.equal(report.assetId,'art:public:characters:v1');assert.equal(report.runtimeEligible,true);assert.equal(report.publicCharacters?.privateIndexRequested,false);assert.deepEqual([...report.publicCharacters.loaded].sort(),[...report.loadedEntityIds].sort());}
 const report=reports.slice(beforeCount).find(r=>JSON.stringify(r.loadedSides)==='["main"]'&&JSON.stringify([...r.loadedEntityIds].sort())===JSON.stringify(entities));
 assert.ok(report,'New battle-specific actual public main roster must contain exactly all four entities');assert.equal(report.publicCharacters.loaded.length,entities.length);return report;
}
module.exports={pairedResolver,validatedPair,assertCurrentPublicBattleLoaders};
