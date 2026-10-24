// CPU only. Existing installer bundles in memory; no server/browser/file writes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createInstallerTransport,validateInstallerInputs,installerContract} from './installer-transport.mjs';import {expectedPhaseIndices} from './browser.mjs';import {here} from './preflight.mjs';
const root=path.resolve(process.argv[2]??process.cwd()),artifact=process.argv[3]?path.resolve(process.argv[3]):null,origin='http://127.0.0.1:8765',contract=installerContract(),hash=b=>createHash('sha256').update(b).digest('hex'),checks=[];
const check=(name,fn)=>{fn();checks.push(name);};const before=contract.inputs.map(r=>hash(fs.readFileSync(path.join(root,r.path))));
for(const variant of ['day','night']){
 const t=await createInstallerTransport({root,origin,variant});check(variant+'-exact-three-routes',()=>assert.equal(t.urls.length,3));
 for(const row of t.identities)check(variant+'-bound-bytes-'+row.urlPath,()=>{const route=t.lookup(origin+row.urlPath);assert(route);assert.equal(route.body.length,row.bytes);assert.equal(hash(route.body),row.sha256);});
 for(const name of ['/championship.html','/pages-build.json','/src/championship/app/championshipStandaloneSave.js','/qa/other.json','/full-qa-save.html/extra','/../full-qa-save.html','/%66ull-qa-save.html','/full-qa-save.html?x=1','/__friends-fixtures/installer.js?x=1','/qa/championship-full-qa-save.json?variant=other','/constructor','/__proto__'])check(variant+'-reject-'+name,()=>assert.equal(t.lookup(origin+name),undefined));
 check(variant+'-reject-other-origin',()=>assert.equal(t.lookup('http://127.0.0.1:8766/full-qa-save.html'),undefined));check(variant+'-reject-nonGET',()=>assert.equal(t.lookup(origin+'/full-qa-save.html','POST'),undefined));
 check(variant+'-seed-is-canonical-writer-fixture',()=>assert.equal(hash(t.lookup(origin+'/qa/championship-full-qa-save.json').body),contract.seed.variants[variant].sha256));
 if(artifact)check(variant+'-all-test-URLs-absent-from-exact-artifact',()=>{for(const row of t.identities)assert(!fs.existsSync(path.join(artifact,row.urlPath.slice(1))));});
}
check('source-input-drift-rejected',()=>{const bad=structuredClone(contract);bad.inputs[0].sha256='0'.repeat(64);assert.throws(()=>validateInstallerInputs(root,bad),/HASH_MISMATCH/);});
for(const [map,expected]of [['hm01',[0,1]],['hm08',[0]]]){const d=JSON.parse(fs.readFileSync(path.join(here,`overlay/assets/production/hunt/${map}-three-r1-20261022/manifest.json`)));for(const field of Object.keys(d.fields))check(field+'-phases-from-pinned-descriptor',()=>assert.deepEqual(expectedPhaseIndices(d,field),expected));}
check('missing-field-fails-closed',()=>assert.throws(()=>expectedPhaseIndices({fields:{}},'missing'),/PINNED_FIELD_FRAMES_REQUIRED/));
check('original-helper-and-installer-inputs-unchanged',()=>assert.deepEqual(contract.inputs.map(r=>hash(fs.readFileSync(path.join(root,r.path)))),before));
console.log(JSON.stringify({status:'PASS_CPU_ONLY_NO_BROWSER_OR_SERVER',checks:checks.length,names:checks,installerInputs:contract.inputs.length,testURLs:3,exactArtifactAbsenceChecked:Boolean(artifact),sourceUnchanged:true,gameArtifactWrites:false},null,2));
