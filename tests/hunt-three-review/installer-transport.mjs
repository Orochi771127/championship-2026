// Exactly three in-memory test URLs. Never copy installer/seed/src into dist.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {here,json,sha,verifyRow} from './preflight.mjs';
export const installerContract=()=>json(path.join(here,'contracts/installer-transport.json'));
export function validateInstallerInputs(root,contract=installerContract()){
 assert.equal(contract.schema,'HUNT_ACTIONS_INSTALLER_TRANSPORT.v1');assert.equal(contract.inputs.length,65);assert.equal(contract.method,'GET');assert.equal(contract.queriesPermitted,false);assert.equal(contract.artifactCopiesPermitted,false);assert.equal(contract.rawSourceServingPermitted,false);
 assert.equal(contract.helper.path,'tests/friends-installer-fixture-support.cjs');assert.equal(contract.helper.allowedExport,'createInstallerFixtures');assert.deepEqual(contract.routes.map(r=>r.urlPath),['/full-qa-save.html','/__friends-fixtures/installer.js']);assert.equal(contract.seed.urlPath,'/qa/championship-full-qa-save.json');
 for(const row of contract.inputs)verifyRow(root,row);for(const row of Object.values(contract.seed.variants))verifyRow(here,row);return contract;
}
export async function createInstallerTransport({root=process.cwd(),origin,variant}){
 root=fs.realpathSync(root);assert.equal(root,fs.realpathSync(process.cwd()),'INSTALLER_CANONICAL_REPO_CWD_REQUIRED');assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin),'EXACT_INSTALLER_ORIGIN_REQUIRED');assert(['day','night'].includes(variant),'EXACT_INSTALLER_VARIANT_REQUIRED');
 const contract=validateInstallerInputs(root),require=createRequire(path.join(root,'package.json'));assert.equal(require('esbuild').version,contract.compiler.version);
 const fixtures=await require('./tests/friends-installer-fixture-support.cjs').createInstallerFixtures(root),routes=new Map(),identities=[];
 for(const row of contract.routes){const fixture=fixtures.route(row.urlPath),body=Buffer.from(fixture.body);assert.equal(fixture.contentType,row.contentType);assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256,'PINNED_INSTALLER_BUNDLE_DRIFT');routes.set(origin+row.urlPath,{contentType:row.contentType,body});identities.push({urlPath:row.urlPath,bytes:body.length,sha256:sha(body)});}
 const seed=contract.seed.variants[variant],body=verifyRow(here,seed);routes.set(origin+contract.seed.urlPath,{contentType:contract.seed.contentType,body});identities.push({urlPath:contract.seed.urlPath,bytes:body.length,sha256:sha(body),variant,canonicalSyntheticFixture:true});
 return {identities,urls:[...routes.keys()],lookup:(url,method='GET')=>method==='GET'?routes.get(url):undefined};
}
