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
 fs.writeFileSync(path.join(root,'test.js'),'export const reviewed = true;');fs.writeFileSync(path.join(temp,'outside'),'private');fs.symlinkSync(path.join(temp,'outside'),path.join(root,'link'));
 let server;try{
  assert.equal(resolveAsset(root,'/%2e%2e/outside'),null);assert.equal(resolveAsset(root,'/link'),null);assert.equal(resolveAsset(root,'/%00'),null);assert.equal(resolveAsset(root,'/..\\outside'),null);
  server=await serveBuild(root);const response=await fetch(server.origin+'/test.js');assert.equal(response.status,200);assert.equal(await response.text(),'export const reviewed = true;');assert.match(response.headers.get('content-type'),/javascript/);
  assert.equal((await fetch(server.origin+'/test.js',{method:'POST'})).status,405);assert.equal((await fetch(server.origin+'/missing')).status,404);
 }finally{await server?.close();fs.rmSync(temp,{recursive:true,force:true});}
});
test('save acceptance checks evolved instances 0005 and 0006, not only seeded new forms',()=>{
 const identity={211:['m528_metaletemon','m528_metaletemon'],222:['m540_imperialdramon_fm','m506_griffomon'],229:['oc_crownbrass_mandrill','m528_metaletemon'],230:['oc_celestyrant_battle_r10','m540_imperialdramon_fm']};
 const report={qaOnly:true,namespace:'championshipAlternateFormsQA:r1:',saveSchema:6,storage:'sessionStorage only',errors:[],instances:[['0001',211],['0002',222],['0005',229],['0006',230]].map(([suffix,id])=>({instanceId:'championship:2026:instance:'+suffix,speciesIndex:id,actorSpeciesIndex:id,configuredEntity:identity[id][0],configuredMotionDonor:identity[id][1]}))};
 assert.doesNotThrow(()=>assertEvolved(assert,report));const bad=structuredClone(report);bad.instances[2].speciesIndex=139;assert.throws(()=>assertEvolved(assert,bad));
 const wrongDonor=structuredClone(report);wrongDonor.instances[1].configuredMotionDonor='m540_imperialdramon_fm';assert.throws(()=>assertEvolved(assert,wrongDonor));
 const substituted=structuredClone(report);substituted.instances[2].instanceId='championship:2026:instance:0003';assert.throws(()=>assertEvolved(assert,substituted));
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
