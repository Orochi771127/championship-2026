import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
import {auditWebBuild,auditReleaseRights,sha256,BUILD_INPUT_PATH,ART_INDEX_PATH,RIGHTS_PATH} from '../scripts/lib/web-build-plan.mjs';
import {buildWebArtifact,validateWebArtifact,INTERNAL_TARGET,PUBLIC_TARGET} from '../scripts/lib/web-build-artifact.mjs';
import {isShippingArtEntry,publicArtIndex} from '../scripts/lib/public-art-boundary.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture(t){
  const base=path.join(repo,'.tmp');fs.mkdirSync(base,{recursive:true});
  const root=fs.mkdtempSync(path.join(base,'web-build-test-'));
  t.after(()=>{
    const rel=path.relative(fs.realpathSync(base),fs.realpathSync(root));
    assert.ok(rel.startsWith('web-build-test-')&&!rel.includes(path.sep));
    fs.rmSync(root,{recursive:true});
  });
  const write=(f,v)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),typeof v==='string'?v:JSON.stringify(v)+'\n');};
  const asset='assets/production/test/manifest.json';write(asset,{fixture:true});
  const art={assetId:'TEST_ONLY',manifestPath:asset,rightsStatus:'OWNER_OWNED',runtimeEligible:true,humanApproved:true,
    runtimeQaPassed:true,shippingReady:true,publicReleasePermitted:true,rightsEvidenceIds:['TEST_ONLY'],
    releaseFiles:[{path:asset,sha256:sha256(fs.readFileSync(path.join(root,asset)))}]};
  const evidence={evidenceId:'TEST_ONLY',authorizationRecordedOn:'2026-01-01',expiresOn:'2099-01-01',
    scope:{platforms:['WEB'],territories:['TW']},document:{status:'VERIFIED',sha256:'a'.repeat(64),privateVaultReference:'fixture-only',verifiedBy:'test',verifiedOn:'2026-01-02'},decisions:{shippingPermitted:true}};
  write(ART_INDEX_PATH,{entries:[art],summary:{registeredRuntimeBundles:1,shippingReadyBundles:1}});
  write(RIGHTS_PATH,{entries:[evidence]});write('championship.html','<script type="module" src="./src/championship/app/main.js"></script>');
  write('src/championship/app/main.js','export const game=1;');
  const input={schemaVersion:1,moduleEntries:['src/championship/app/main.js'],importMap:{},
    release:{evidenceIds:['TEST_ONLY'],platform:'WEB',territories:['TW']},files:['championship.html','src/championship/app/main.js',asset,ART_INDEX_PATH]};
  write(BUILD_INPUT_PATH,input);
  return {root,write,asset,art,evidence,input};
}

test('unverified rights allow a closed internal build and refuse public output before replacing anything',t=>{
  const f=fixture(t);f.evidence.document.status='PENDING_PRIVATE_DOCUMENT_LINK';f.write(RIGHTS_PATH,{entries:[f.evidence]});
  f.write('src/championship/app/main.js','import "../battle/battleCatalogs.js";');
  f.write('src/championship/battle/battleCatalogs.js','export const data=1;');
  f.input.files.push('src/championship/battle/battleCatalogs.js');f.write(BUILD_INPUT_PATH,f.input);
  const a=auditWebBuild(f.root);assert.equal(a.technical.ok,true);assert.equal(a.release.ok,false);
  const output=path.join(f.root,'dist/internal');buildWebArtifact({root:f.root,output,target:INTERNAL_TARGET});
  const m=validateWebArtifact({root:f.root,output,target:INTERNAL_TARGET});assert.equal(m.publicReleasePermitted,false);
  const publicOutput=path.join(f.root,'dist/public');f.write('dist/public/keep.txt','preserve');
  assert.throws(()=>buildWebArtifact({root:f.root,output:publicOutput,target:PUBLIC_TARGET}),/PUBLIC_RELEASE_NOT_APPROVED/);
  assert.equal(fs.readFileSync(path.join(publicOutput,'keep.txt'),'utf8'),'preserve');
});

test('public candidate validates actual file bytes and rejects added or stale assets',t=>{
  const f=fixture(t),output=path.join(f.root,'dist/public');
  buildWebArtifact({root:f.root,output,target:PUBLIC_TARGET});
  assert.equal(validateWebArtifact({root:f.root,output,target:PUBLIC_TARGET}).release.approved,true);
  fs.writeFileSync(path.join(output,'extra.png'),'extra');
  assert.throws(()=>validateWebArtifact({root:f.root,output,target:PUBLIC_TARGET}),/BUILD_FILE_LIST_MISMATCH/);
  fs.unlinkSync(path.join(output,'extra.png'));
  fs.appendFileSync(path.join(output,f.asset),' ');
  assert.throws(()=>validateWebArtifact({root:f.root,output,target:PUBLIC_TARGET}),/BUILD_HASH_MISMATCH/);
  f.write(f.asset,{changed:true});
  assert.ok(auditWebBuild(f.root).release.issues.some(r=>r.kind==='ASSET_APPROVAL_HASH_MISMATCH'));
});

test('missing imports, source payloads and private legal documents cannot enter build inputs',t=>{
  const f=fixture(t);f.write('src/championship/app/main.js','import "./missing.js";');
  assert.equal(auditWebBuild(f.root).technical.ok,false);
  for(const file of ['assets/production/source.nds','docs/legal/private/contract.json','../escape.json']){
    f.write(BUILD_INPUT_PATH,{...f.input,files:[...f.input.files,file]});
    assert.throws(()=>auditWebBuild(f.root),/INVALID_WEB_BUILD_INPUTS/);
  }
});

test('shipping requires every approval and matching release scope; deferred metadata never grants permission',t=>{
  const f=fixture(t),args={registry:{entries:[f.evidence]},evidenceIds:['TEST_ONLY'],platform:'WEB',territories:['TW'],asOf:'2026-09-09'};
  assert.deepEqual(auditReleaseRights(args),[]);
  for(const patch of [{platform:'IOS'},{territories:['US']},{evidenceIds:[]},{asOf:'2026-02-30'},{asOf:'2100-01-01'}])assert.ok(auditReleaseRights({...args,...patch}).length);
  for(const key of ['runtimeEligible','humanApproved','runtimeQaPassed','shippingReady','publicReleasePermitted'])assert.equal(isShippingArtEntry({...f.art,[key]:false}),false);
  assert.equal(isShippingArtEntry({...f.art,localOnly:true}),false);
  assert.equal(publicArtIndex({entries:[{...f.art,shippingReady:false}],summary:{}}).entries.length,0);
  f.write(ART_INDEX_PATH,{entries:[{...f.art,shippingReady:false}],summary:{}});
  assert.ok(auditWebBuild(f.root).release.issues.some(r=>r.kind==='ASSET_FILE_NOT_APPROVED'));
});

test('the internal server serves only its snapshot on loopback with the current SVG MIME',async t=>{
  const f=fixture(t);f.write('assets/production/test/icon.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');
  f.input.files.push('assets/production/test/icon.svg');f.write(BUILD_INPUT_PATH,f.input);
  const output=path.join(f.root,'dist/internal');const {manifest}=buildWebArtifact({root:f.root,output,target:INTERNAL_TARGET});
  const server=spawn(process.execPath,['scripts/serve.mjs','--root',output],{cwd:repo,windowsHide:true,env:{...process.env,CHAMPIONSHIP_HOST:'127.0.0.1',CHAMPIONSHIP_PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  const url=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('SERVER_START_TIMEOUT')),10000);
    server.once('error',e=>{clearTimeout(timer);reject(e);});
    server.once('exit',code=>{clearTimeout(timer);reject(Error('SERVER_EXIT_'+code));});
    server.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
  });
  const svg=await fetch(url+'/assets/production/test/icon.svg');assert.equal(svg.status,200);assert.equal(svg.headers.get('content-type'),'image/svg+xml');
  assert.equal(svg.headers.get('x-championship-build'),manifest.buildId);
  const foreignStatus=await new Promise((resolve,reject)=>{
    http.get(url+'/championship.html',{headers:{Host:'unapproved.example'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    }).on('error',reject);
  });
  assert.equal(foreignStatus,403);
  assert.equal((await fetch(url+'/docs/legal/RIGHTS_EVIDENCE_REGISTRY.json')).status,404);
  server.kill();await once(server,'exit');
});
