// The real production presenter, no replicated decorateActor/ground alignment.
// Captures do not by themselves certify waste, authored jumping, or contact feet.
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const [base,out]=process.argv.slice(2);assert.ok(base&&out);await fs.mkdir(out,{recursive:true});
const engine=process.env.BROWSER_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const browser=await ({chromium,webkit}[engine]).launch({headless:true});const results=[];
// All three reviewed contact species and an ordinary default contact go through
// real normal app paths. No numeric assumption about a species' anatomy.
try{for(const species of (process.env.AUDIT_NORMAL_SPECIES?process.env.AUDIT_NORMAL_SPECIES.split(',').map(Number):[13,23,36,73])){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
 page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));
 page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push('console:'+m.type()+':'+m.text());});
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});
 try{
  await page.goto(new URL('tests/fixtures/ranch-normal-audit.html',base).href);await page.waitForFunction(()=>!!globalThis.prepareNormalRanchAudit);
  await page.evaluate(i=>globalThis.prepareNormalRanchAudit([i]),species);
  await page.goto(new URL('championship.html?presentation=developer',base).href);await page.locator('#cm-login').waitFor();
  if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});}
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();
  await page.waitForFunction(i=>{const h=document.querySelector('.int-rh2-field-host');return h?.dataset.loadState==='ready'&&JSON.parse(h?.dataset.residentAssets||'[]').some(a=>a.speciesId.endsWith('species-'+String(i).padStart(3,'0'))&&a.state==='ready')},species,{timeout:180000});
  assert.equal(await page.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0);
  const evidence=await page.locator('.int-rh2-field-host').evaluate(h=>({assets:JSON.parse(h.dataset.residentAssets||'[]'),positions:JSON.parse(h.dataset.residentScreenPositions||'[]'),three:{...document.querySelector('.cm-ranch-three-canvas')?.dataset}}));
  assert.ok(Number(evidence.three.frames)>0,'Actual Three scene rendered');assert.deepEqual(errors,[]);
  const file='normal-contact-'+species+'.png';await page.screenshot({path:out+'/'+file});results.push({species,status:'NORMAL_PRESENTER_CAPTURED_VISUAL_PENDING',screenshot:file,evidence});
 }catch(error){results.push({species,status:'FAIL',error:String(error),errors});await page.screenshot({path:out+'/normal-failure-'+species+'.png'}).catch(()=>{});throw error;}
 finally{await context.close();await fs.writeFile(out+'/normal-results.json',JSON.stringify({results,visualReview:'PENDING',uncovered:['native authored airborne','food/waste interaction','zoom0.7','pan/wrap','all character routes']},null,2));}
}
}finally{await browser.close();}
