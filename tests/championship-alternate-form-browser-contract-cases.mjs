import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolveAsset,serveBuild,assertEvolved,assertBattleLoaders}=require('./alternate-form-browser-support.cjs');
test('public QA server serves exact bytes and rejects traversal and symlink escapes',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'form-browser-'));const root=path.join(temp,'build');fs.mkdirSync(root);
 fs.writeFileSync(path.join(root,'test.js'),'export const reviewed = true;');fs.writeFileSync(path.join(temp,'outside'),'private');
 // Windows needs a directory junction without symlink privilege. Keep the
 // same outside-root file escape assertion; do not weaken the server check.
 const escapePath=process.platform==='win32'?'/link/private':'/link';
 if(process.platform==='win32'){const outside=path.join(temp,'outside-directory');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'private'),'private');fs.symlinkSync(outside,path.join(root,'link'),'junction');}
 else fs.symlinkSync(path.join(temp,'outside'),path.join(root,'link'));
 let server;try{
  assert.equal(resolveAsset(root,'/%2e%2e/outside'),null);assert.equal(resolveAsset(root,escapePath),null);assert.equal(resolveAsset(root,'/%00'),null);assert.equal(resolveAsset(root,'/..\\outside'),null);
  server=await serveBuild(root);const response=await fetch(server.origin+'/test.js');assert.equal(response.status,200);assert.equal(await response.text(),'export const reviewed = true;');assert.match(response.headers.get('content-type'),/javascript/);
  assert.equal((await fetch(server.origin+'/test.js',{method:'POST'})).status,405);assert.equal((await fetch(server.origin+'/missing')).status,404);
 }finally{await server?.close();fs.rmSync(temp,{recursive:true,force:true});}
});
test('save acceptance checks evolved instances 0005 and 0006, not only seeded new forms',()=>{
 const identity={211:['m528_metaletemon','m528_metaletemon'],222:['m540_imperialdramon_fm','m506_griffomon'],229:['oc_crownbrass_mandrill','m528_metaletemon'],230:['oc_celestyrant_battle_r10','m540_imperialdramon_fm']};
 const report={qaOnly:true,namespace:'championshipAlternateFormsQA:r1:',saveSchema:7,storage:'sessionStorage only',errors:[],instances:[['0001',211],['0002',222],['0005',229],['0006',230]].map(([suffix,id])=>({instanceId:'championship:2026:instance:'+suffix,speciesIndex:id,actorSpeciesIndex:id,configuredEntity:identity[id][0],configuredMotionDonor:identity[id][1]}))};
 const saved={schemaVersion:7,cageEdit:{layoutVersion:'PRODUCT_GRID100_INSTANCES_V1'}};
 assert.doesNotThrow(()=>assertEvolved(assert,report,saved));const bad=structuredClone(report);bad.instances[2].speciesIndex=139;assert.throws(()=>assertEvolved(assert,bad,saved));
 const wrongDonor=structuredClone(report);wrongDonor.instances[1].configuredMotionDonor='m540_imperialdramon_fm';assert.throws(()=>assertEvolved(assert,wrongDonor,saved));
 const substituted=structuredClone(report);substituted.instances[2].instanceId='championship:2026:instance:0003';assert.throws(()=>assertEvolved(assert,substituted,saved));
});
test('browser harness has no private setters, accelerated clock, synthetic battle result or security flags',()=>{
 const source=fs.readFileSync(new URL('./championship-alternate-form-browser.cjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/addInitScript|storage\.setItem|localStorage\.setItem|sessionStorage\.setItem|__alternateFormQaApp|advanceFrames|page\.clock|--no-sandbox|--disable-web-security|--enable-unsafe|--use-gl|--use-angle/);
 assert.match(source,/chromiumSandbox:true/);assert.match(source,/timeout:600000/);assert.match(source,/BLOCKED_GPU/);assert.match(source,/#cm-root\[data-active-screen="BATTLE_RESULT"\]/);assert.doesNotMatch(source,/locator\('[^']*\[data-screen="BATTLE_RESULT"\]/);assert.match(source,/#cm-root\.int-rh2-root\[data-active-screen="RAISING_HOME"\]/);assert.match(source,/int-rh2-field-host\[data-load-state="ready"\]\[aria-busy="false"\]/);assert.match(source,/await raisingReady\('battle-return'\)/);
 assert.match(source,/captureFourFormDatabase/);assert.match(source,/FOUR_FORM_DEX_HERO_SOURCE_AND_CHOICE_PREVIEW_CAPTURE_PASS/);assert.match(source,/dexVisualReview='PENDING_ROOT_SCREENSHOT_REVIEW'/);assert.match(source,/data-entry-id="database"/);assert.match(source,/evolution-choice-preview/);assert.match(source,/dexIdentityAfter,evidence.dexIdentityBefore/);
 const workflow=fs.readFileSync(new URL('../.github/workflows/alternate-form-browser.yml',import.meta.url),'utf8');assert.match(workflow,/contents: read/);assert.match(workflow,/npm run build:playtest && npm run validate:playtest/);assert.doesNotMatch(workflow,/continue-on-error|secrets\.|pages: write|pull_request_target/);
});

test('battle proof cannot reuse raising reports or accept replacements',()=>{
 const ids=['m528_metaletemon','m540_imperialdramon_fm','oc_crownbrass_mandrill','oc_celestyrant_battle_r10'];
 const report={loadedSides:['main'],loadedEntityIds:ids,failures:[],replacementFailures:[],completedOriginalArt:{loaded:ids,failures:[],scope:'OWNER_HASH_SELECTED_PLAYTEST',publicReleasePermitted:true}};
 assert.doesNotThrow(()=>assertBattleLoaders(assert,[report],0,{exactCount:true}));
 assert.throws(()=>assertBattleLoaders(assert,[report],1,{exactCount:true}));
 const raising=structuredClone(report);raising.loadedSides=['main','sub'];assert.throws(()=>assertBattleLoaders(assert,[raising],0,{exactCount:true}));
 const lateRaising=structuredClone(report);lateRaising.loadedEntityIds.push('e000_digitama');lateRaising.completedOriginalArt.loaded.push('e000_digitama');assert.throws(()=>assertBattleLoaders(assert,[lateRaising],0,{exactCount:true}));
 assert.doesNotThrow(()=>assertBattleLoaders(assert,[lateRaising],0),'shared helper default retains main superset behavior');
 const missing=structuredClone(report);missing.loadedEntityIds.pop();assert.throws(()=>assertBattleLoaders(assert,[missing],0,{exactCount:true}));
 const replaced=structuredClone(report);replaced.replacementFailures.push({reason:'failed art'});assert.throws(()=>assertBattleLoaders(assert,[replaced],0,{exactCount:true}));
});

// A hidden menu container persists after returning from battle. Its data-menu-id
// matches the toolbar button, so bare attribute selectors are ambiguous.
test('system-menu navigation targets buttons, never the retained hidden menu container',()=>{
 const source=fs.readFileSync(new URL('./championship-alternate-form-browser.cjs',import.meta.url),'utf8');
 assert.equal(source.split("locator('button[data-menu-id=\"SYSTEM\"]')").length-1,3);
 assert.equal(source.includes("locator('[data-menu-id=\"SYSTEM\"]')"),false);
});

test('promotion browser evidence covers real production catalogs and an untouched normal-entry save',()=>{
 const qa=fs.readFileSync(new URL('./championship-alternate-form-browser.cjs',import.meta.url),'utf8');
 assert.match(qa,/assert\.equal\(entry\[gate\],true/);
 assert.match(qa,/Observed QA gameplay must use the same product identities and readiness/);
 assert.match(qa,/QA and production must use the same four action\/geometry\/own-art configurations/);
 const normal=fs.readFileSync(new URL('./championship-dex-portrait-browser.cjs',import.meta.url),'utf8');
 assert.match(normal,/NORMAL_ENTRY_MUST_NOT_LOAD_ALTERNATE_QA/);
 assert.match(normal,/HERO_SOURCE_TARGET_4_FORMS_2_VIEWPORTS/);
 assert.match(normal,/productionCatalogs/);assert.match(normal,/Normal new game must not manufacture any registration/);
 assert.match(normal,/registrationAfter, evidence\.registrationBefore/);
 assert.doesNotMatch(normal,/addInitScript|localStorage\.setItem|sessionStorage\.setItem|registerHooks|__alternateFormQaApp|page\.clock/);
 const production=fs.readFileSync(new URL('./product-form-production-source-cases.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(production,/registerHooks|alternateFormQaApp/);assert.match(production,/createChampionshipStandaloneApp/);
});


test('canonical post-reload contract rejects stale/unknown schemas, mismatched report and missing/wrong grid',()=>{
 const identity={211:['m528_metaletemon','m528_metaletemon'],222:['m540_imperialdramon_fm','m506_griffomon'],229:['oc_crownbrass_mandrill','m528_metaletemon'],230:['oc_celestyrant_battle_r10','m540_imperialdramon_fm']};
 const report={qaOnly:true,namespace:'championshipAlternateFormsQA:r1:',saveSchema:7,storage:'sessionStorage only',errors:[],instances:[['0001',211],['0002',222],['0005',229],['0006',230]].map(([suffix,id])=>({instanceId:'championship:2026:instance:'+suffix,speciesIndex:id,actorSpeciesIndex:id,configuredEntity:identity[id][0],configuredMotionDonor:identity[id][1]}))};
 const saved={schemaVersion:7,cageEdit:{layoutVersion:'PRODUCT_GRID100_INSTANCES_V1'}};
 assert.doesNotThrow(()=>assertEvolved(assert,report,saved));
 for(const version of [5,6,8,undefined]){assert.throws(()=>assertEvolved(assert,{...report,saveSchema:version},saved));assert.throws(()=>assertEvolved(assert,report,{...saved,schemaVersion:version}));}
 for(const layout of [undefined,'NATIVE_DECKS_V1','PRODUCT_GRID50_V1'])assert.throws(()=>assertEvolved(assert,report,{...saved,cageEdit:{layoutVersion:layout}}));
 assert.throws(()=>assertEvolved(assert,report));assert.throws(()=>assertEvolved(assert,report,{schemaVersion:7}));
});

test('whole reachable acceptance flow uses canonical saved and reloaded contracts before unchanged battle proof',()=>{
 const source=fs.readFileSync(new URL('./championship-alternate-form-browser.cjs',import.meta.url),'utf8');
 const helper=fs.readFileSync(new URL('./alternate-form-browser-support.cjs',import.meta.url),'utf8');
 const compiled=fs.readFileSync(new URL('./alternate-form-compiled-support.cjs',import.meta.url),'utf8');
 assert.match(source,/assert\.equal\(saved\.schemaVersion,7\)/);assert.match(source,/assert\.equal\(saved\.cageEdit\?\.layoutVersion,'PRODUCT_GRID100_INSTANCES_V1'\)/);
 const reload=source.indexOf("await page.reload({waitUntil:'domcontentloaded'});await boot();"),read=source.indexOf('const reloadedSaved=await page.evaluate',reload),check=source.indexOf('assertEvolved(assert,reloaded,reloadedSaved)',read),battle=source.indexOf("[data-entry-id=\"battle\"]",check);
 assert.ok(reload>=0&&read>reload&&check>read&&battle>check);assert.equal(source.split('assertEvolved(assert,').length-1,1);
 assert.match(source,/assert\.deepEqual\(reloadedSaved\.shop\?\.cageQuantities,saved\.shop\.cageQuantities/);
 assert.match(source,/assertCurrentPublicBattleLoaders\(assert,last.actualLoaderReports,beforeBattleReportCount\)/);
 for(const text of [source,helper,compiled])assert.doesNotMatch(text,/assert\.equal\([^;\n]*(?:saveSchema|schemaVersion)[^;\n]*,\s*6\s*\)/);
 for(const text of ["JSON.stringify(r.loadedSides)==='[\"main\"]'",'beforeCount','replacementFailures','privateIndexRequested,false'])assert.ok(compiled.includes(text),text);
 assert.match(source,/NATURAL_FOUR_ACTOR_BATTLE_RESULT_PASS/);assert.match(source,/await raisingReady\('battle-return'\)/);
});
