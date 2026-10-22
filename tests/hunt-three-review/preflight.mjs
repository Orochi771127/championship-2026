// Portable, read-only admission preflight. No network, browser, git or mutation.
import fs from 'node:fs';
import {validateInstallerInputs} from './installer-transport.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const read=filename=>fs.readFileSync(filename);
export const json=filename=>JSON.parse(read(filename));
export const here=path.dirname(fileURLToPath(import.meta.url));
const packetRoot=path.resolve(here,'../..');
const privateText=/(?:\b[A-Za-z]:[\\/]+(?:Users|Projects|Workspace|Private|Temp)|\/(?:workspace|home)\/|file:\/\/|libfile_[a-z0-9]+|Sentinel_[a-z0-9]+)/i;
export function safeRelative(value){
 assert(typeof value==='string'&&value.length&&!/[\\:\0?#%]/.test(value)&&!value.startsWith('/')&&value.split('/').every(x=>x&&x!=='.'&&x!=='..'),'UNSAFE_RELATIVE_PATH');return value;
}
export function regularFile(base,relative){
 safeRelative(relative);const absolute=path.resolve(base,relative);assert(absolute.startsWith(path.resolve(base)+path.sep),'PATH_ESCAPE');
 let current=path.resolve(base);for(const part of relative.split('/')){current=path.join(current,part);assert(!fs.lstatSync(current).isSymbolicLink(),'SYMLINK_FORBIDDEN: '+relative);}
 assert(fs.statSync(absolute).isFile(),'REGULAR_FILE_REQUIRED: '+relative);return absolute;
}
export function walkFiles(base){
 const files=[];const visit=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){assert(!ent.isSymbolicLink(),'SYMLINK_FORBIDDEN');const p=path.join(dir,ent.name);if(ent.isDirectory())visit(p);else{assert(ent.isFile(),'REGULAR_FILE_REQUIRED');files.push(path.relative(base,p).replaceAll('\\','/'));}}};visit(base);return files.sort();
}
export function verifyRow(base,row){
 assert(row&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&/^[a-f0-9]{64}$/.test(row.sha256),'IDENTITY_REQUIRED');
 const bytes=read(regularFile(base,row.path));assert.equal(bytes.length,row.bytes,'BYTE_MISMATCH: '+row.path);assert.equal(sha(bytes),row.sha256,'HASH_MISMATCH: '+row.path);return bytes;
}
export function assertPacketPrivacy(name,bytes){
 safeRelative(name);assert(!/(?:^|\/)(?:audit|private|source-masters?|\.git|\.codex|research)(?:\/|$)/i.test(name),'PRIVATE_PACKET_PATH');
 assert(!/\.(?:blend|zip|7z|psd|kra|nds|ram|log)$/i.test(name),'PRIVATE_PACKET_EXTENSION');
 if(/\.(?:m?js|cjs|json|ya?ml|html|md|txt)$/i.test(name))assert(!privateText.test(bytes.toString('utf8')),'PRIVATE_PACKET_TEXT: '+name);
 if(name.endsWith('.glb')){assert.equal(bytes.readUInt32LE(0),0x46546c67);const n=bytes.readUInt32LE(12);assert(n>0&&20+n<=bytes.length);const text=bytes.toString('utf8',20,20+n);assert(!privateText.test(text),'PRIVATE_GLB_METADATA');assert(!/"uri"\s*:/.test(text),'EXTERNAL_GLB_URI');}
}
export function verifyPacketSeal({provisionalSeal=null}={}){
 const sealBytes=read(provisionalSeal??path.join(here,'PACKET.json')); assertPacketPrivacy('tests/hunt-three-review/PACKET.json',sealBytes);const seal=JSON.parse(sealBytes);assert.equal(seal.schema,'HUNT_ACTIONS_PACKET.v1');assert(Array.isArray(seal.files));
 const paths=seal.files.map(r=>safeRelative(r.path));assert.equal(new Set(paths).size,paths.length,'DUPLICATE_PACKET_PATH');
 for(const name of paths)assert(name.startsWith('tests/hunt-three-review/')||name==='.github/workflows/hunt-hm01-hm08-admission.yml','PACKET_PATH_OUTSIDE_SCOPE');
 if(!provisionalSeal)assert(paths.includes('.github/workflows/hunt-hm01-hm08-admission.yml'),'ADMISSION_WORKFLOW_REQUIRED');
 const prefix='tests/hunt-three-review/',localExpected=paths.filter(p=>p.startsWith(prefix)).map(p=>p.slice(prefix.length));
 assert(!localExpected.includes('PACKET.json'),'PACKET_SELF_HASH_CYCLE');assert.deepEqual(walkFiles(here),[...localExpected,...(provisionalSeal?[]:['PACKET.json'])].sort(),'UNDECLARED_PACKET_FILE');
 for(const row of seal.files){const bytes=verifyRow(packetRoot,row);assertPacketPrivacy(row.path,bytes);}
 return {files:seal.files.length+(provisionalSeal?0:1),bytes:seal.files.reduce((n,r)=>n+r.bytes,0)+(provisionalSeal?0:sealBytes.length),sealSHA256:sha(sealBytes),provisional:Boolean(provisionalSeal)};
}
export function readContracts(){
 const contracts={baseline:json(path.join(here,'contracts/baseline.json')),overlay:json(path.join(here,'contracts/overlay.json')),resources:json(path.join(here,'contracts/resources.json')),expected:json(path.join(here,'contracts/expected-exact.json')),repairs:json(path.join(here,'contracts/repair-bases.json')),testInputs:json(path.join(here,'contracts/test-inputs.json'))};
 assert.equal(contracts.repairs.schema,'HUNT_ACTIONS_REPAIR_BASES.v1');assert.equal(contracts.testInputs.schema,'HUNT_ACTIONS_TEST_INPUTS.v1');assert.equal(contracts.baseline.schema,'HUNT_ACTIONS_BASELINE.v1');assert.equal(contracts.overlay.schema,'HUNT_ACTIONS_OVERLAY.v1');assert.equal(contracts.resources.schema,'HUNT_ACTIONS_RESOURCES.v1');assert.equal(contracts.expected.schema,'HUNT_ACTIONS_EXPECTED_EXACT.v1');
 assert.equal(contracts.overlay.candidateSHA256,'cf14c7ab2fa256ad5ce275347056af4c138321f71b0d7d554d7277db2de52409');assert.equal(contracts.overlay.fileCount,32);assert.equal(contracts.overlay.bytes,14912536);assert.equal(contracts.resources.fileCount,15);assert.equal(contracts.resources.bytes,14739579);
 return contracts;
}
export function canonicalCoreReceipt(bytes,baseline){
 const receipt=JSON.parse(bytes);assert.equal(baseline.coreReceiptCommitRule.mode,'CANONICALIZE_EXISTING_40_HEX_COMMIT_ONLY');assert(/^[a-f0-9]{40}$/.test(receipt.commit),'CORE_COMMIT_FORMAT');assert.equal(baseline.coreReceiptCommitRule.canonicalCommit,baseline.coreCommit);
 receipt.commit=baseline.coreCommit;const canonical=Buffer.from(JSON.stringify(receipt)+'\n');assert.equal(canonical.length,baseline.coreManifest.bytes,'CORE_RECEIPT_BYTES');assert.equal(sha(canonical),baseline.coreManifest.sha256,'CORE_RECEIPT_PAYLOAD_DRIFT');return {observedCommit:JSON.parse(bytes).commit,observedReceiptSHA256:sha(bytes),canonicalReceiptSHA256:sha(canonical)};
}
export function verifyRepairBase(root,contracts,variant='current-reviewed-test-repairs'){
 const {repairs,baseline,testInputs}=contracts;assert(['current-reviewed-test-repairs','frozen-local-reference'].includes(variant),'UNKNOWN_REPAIR_BASE');assert.equal(repairs.defaultVariant,'current-reviewed-test-repairs');assert.equal(repairs.finiteTestToolPathCount,19);assert.equal(repairs.productionPinExceptions,0);
 const rows=repairs.variants[variant].files;assert.equal(rows.length,19);assert.equal(new Set(rows.map(r=>r.path)).size,19);assert.deepEqual(rows.map(r=>r.path).sort(),repairs.variants['current-reviewed-test-repairs'].files.map(r=>r.path).sort());
 assert(rows.every(r=>!baseline.repositoryFiles.some(p=>p.path===r.path)),'REPAIR_BASE_CANNOT_OVERRIDE_PRODUCTION_OR_FROZEN_PINS');
 for(const row of rows){safeRelative(row.path);if(row.absent===true){try{fs.lstatSync(path.join(root,row.path));assert.fail('EXPECTED_ABSENT_REPAIR_FILE: '+row.path);}catch(error){assert.equal(error.code,'ENOENT','REPAIR_FILE_MUST_BE_ABSENT');}}else{const bytes=verifyRow(root,row);if(row.gitBlob)assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),row.gitBlob,'AUTHENTICATED_GIT_BLOB_DRIFT');}}
 assert.equal(testInputs.fixtureGenerator.files.length,270);assert.equal(testInputs.browserHelpers.length,1);
 for(const row of [...testInputs.fixtureGenerator.files,...testInputs.browserHelpers])verifyRow(root,row);
 assert.deepEqual(testInputs.browserHelpers[0].allowedExports,['startGame','openHunt','liveWilds']);assert.equal(testInputs.browserHelpers[0].virtualTimeCapturePermitted,false);
 return {variant,currentRepairSourceValidated:variant==='current-reviewed-test-repairs',requiredCurrentHead:repairs.currentHead,testToolFiles:19,fixtureGeneratorInputs:270,browserHelperInputs:1,mergeAuthority:false};
}
export async function verifyBaseline(root,contracts=readContracts(),{baselineVariant='current-reviewed-test-repairs'}={}){
 root=fs.realpathSync(root);const {baseline}=contracts,repairBase=verifyRepairBase(root,contracts,baselineVariant);
 for(const row of baseline.repositoryFiles)verifyRow(root,row);
 const core=path.join(root,safeRelative(baseline.coreDirectory)),coreBytes=read(regularFile(core,'pages-build.json'));assert.equal(coreBytes.length,baseline.coreManifest.bytes);const receiptIdentity=canonicalCoreReceipt(coreBytes,baseline);
 const {decodeBuildManifest}=await import(path.join(root,'scripts/lib/build-manifest-codec.mjs'));const base=decodeBuildManifest(json(path.join(core,'pages-build.json')));
 assert.equal(base.buildId,baseline.coreBuildId);assert.equal(base.inputSha256,baseline.coreInputSHA256);
 assert.equal(base.fileCount,baseline.coreFileCount);assert.equal(base.fileCount,base.files.length+1);
 assert.equal(base.files.reduce((n,r)=>n+r.bytes,0)+baseline.coreManifest.bytes,baseline.coreCompleteBytes);
 assert.deepEqual(walkFiles(core),[...base.files.map(r=>r.path),'pages-build.json'].sort(),'CORE_FILE_SET_DRIFT');
 for(const row of base.files)verifyRow(core,row);
 assert.equal(baseline.frozenRanchPaths.length,41);assert.equal(new Set(baseline.frozenRanchPaths).size,41);
 assert(baseline.frozenRanchPaths.every(p=>baseline.repositoryFiles.some(r=>r.path===p)));
 return {root,core,base,summary:{coreFiles:base.fileCount,coreBytes:baseline.coreCompleteBytes,pinnedRepositoryFiles:baseline.repositoryFiles.length,ranchFiles:41,repairBase,...receiptIdentity}};
}
export async function preflight({root=process.cwd(),provisionalSeal=null,baselineVariant='current-reviewed-test-repairs'}={}){
 const packet=verifyPacketSeal({provisionalSeal}),contracts=readContracts(),candidate=path.join(here,'overlay');
 assert.deepEqual(walkFiles(candidate),contracts.overlay.files.map(r=>r.path).sort(),'OVERLAY_FILE_SET');
 for(const row of contracts.overlay.files){const bytes=verifyRow(candidate,row);assertPacketPrivacy(row.path,bytes);}
 assert.equal(contracts.overlay.files.reduce((n,r)=>n+r.bytes,0),contracts.overlay.bytes);
 validateInstallerInputs(root);
 const checked=await verifyBaseline(root,contracts,{baselineVariant});
 for(const row of contracts.resources.files)verifyRow(row.owner==='overlay'?candidate:checked.root,row);
 assert.equal(contracts.resources.files.reduce((n,r)=>n+r.bytes,0),contracts.resources.bytes);
 return {...checked,contracts,candidate,packet};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),options={root:process.cwd()};for(let i=0;i<args.length;i+=2){assert(['--root','--baseline-variant'].includes(args[i])&&args[i+1],'USAGE: preflight.mjs [--root checkout] [--baseline-variant frozen-local-reference]');options[args[i]==='--root'?'root':'baselineVariant']=args[i+1];}
 const result=await preflight(options);console.log(JSON.stringify({status:'PASS_EXACT_PORTABLE_PREFLIGHT_NOT_PUBLIC_AUTHORITY',packet:result.packet,baseline:result.summary,overlayFiles:32,overlayBytes:14912536,browserGPU:false}));
}
