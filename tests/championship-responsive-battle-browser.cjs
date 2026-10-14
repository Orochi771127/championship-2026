const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function battle(page,{enabled,theme,report,out,size,step,readyHome,matrix,afterMount}){
 await size(page,844,390);await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();
 await page.locator('.cm-vs5-cube__face[data-face-id="PRACTICE_BATTLE"]').click();
 const rows=page.locator('.cm-vs5-party [class*="party-row"]');
 const a=page.locator('.cm-vs5-practice-member button:nth-of-type(1)'),b=page.locator('.cm-vs5-practice-member button:nth-of-type(2)');
 const availableA=a.and(page.locator('button:enabled')),availableB=b.and(page.locator('button:enabled'));
 await availableA.first().waitFor({state:'visible'});assert.ok(await availableA.count()>=2);await availableA.first().click();await availableB.first().click();await page.locator('.cm-vs5-footer .cm-vs5-action--primary').click();
 // Let only the existing asynchronous art mount settle while native time stays controlled.
 for(let i=0;i<600;i++){if(await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').count())break;await step(page,17);}
 assert.equal(await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').count(),1);
 await page.evaluate(()=>globalThis.__qaMatchIdentity=globalThis.__qaBattleRuntime());
 await page.evaluate(()=>globalThis.__qaTickerIdentity=globalThis.__qaRaising.stage.app.ticker);
 await page.evaluate(()=>{globalThis.__qaObservedBattle={frames:0,special:0,actions:0,peakEvents:0,reducedCameraViolations:0};globalThis.__qaBattleUnsubscribe=__qaBattleRuntime().observe(v=>{const r=__qaObservedBattle;r.frames++;if(v.specialPrelude)r.special++;if(v.combatants?.some(c=>c.action))r.actions++;const d=__qaBattleScene?.getDiagnostics()?.dynamicFx;r.peakEvents=Math.max(r.peakEvents,d?.eventsHandled??0);if(localStorage.getItem('championshipModernSave:preferences:v1')?.includes('"reducedMotion":"on"')&&(d?.camera?.punch||d?.camera?.trauma||d?.director?.stages?.length))r.reducedCameraViolations++;});});
 if(afterMount)await afterMount();
 const clockStart=await page.locator('.cm-vs5-clock').textContent();
 for(const [width,height] of matrix??[[720,320],[844,390],[932,430],[1366,480],[1366,768],[320,568],[390,844],[568,320],[844,390]]){
  await size(page,width,height);const s=await page.evaluate(()=>{const shell=document.querySelector('.cm-vs5-shell'),c=document.querySelector('.cm-field-canvas'),r=c.getBoundingClientRect();return {screen:document.querySelector('#cm-root').dataset.activeScreen,viewport:[innerWidth,innerHeight],portrait:document.body.hasAttribute('data-portrait-frame'),raising:document.body.hasAttribute('data-responsive-raising'),hunt:document.body.hasAttribute('data-hunt-wide'),gate:shell.dataset.responsiveBattle,fx:shell.dataset.fx,canvas:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:document.documentElement.scrollWidth>innerWidth,sameMatch:globalThis.__qaBattleRuntime()===globalThis.__qaMatchIdentity,diag:globalThis.__qaBattleScene?.getDiagnostics()};});
  assert.equal(s.screen,'BATTLE_FIELD');assert.equal(s.sameMatch,true);assert.equal(s.overflow,false);assert.equal(s.raising,false);assert.equal(s.hunt,false);assert.ok(s.canvas.width>0&&s.canvas.height>0);assert.equal(await page.evaluate(()=>__qaRaising.stage.app.ticker===__qaTickerIdentity),true);
  if(enabled&&s.diag.dynamicFx){const {camera,bodies}=s.diag.dynamicFx;for(const b of bodies){const left=camera.x+(b.x-b.width/2)*camera.zoom,right=camera.x+(b.x+b.width/2)*camera.zoom,top=camera.y+b.top*camera.zoom,bottom=camera.y+b.groundY*camera.zoom;assert.ok(left>=-2&&right<=s.diag.viewport.width+2&&top>=-2&&bottom<=s.diag.viewport.height+2,JSON.stringify({b,left,right,top,bottom,viewport:s.diag.viewport}));}}
  report.cases.push({enabled,theme,...s});
  if(enabled)await page.screenshot({path:path.join(out,`${theme}-battle-${width}x${height}.png`)});
 }
 let ms=0;while(await page.locator('#cm-root').getAttribute('data-active-screen')!=='BATTLE_RESULT'&&ms<600000){await page.clock.runFor(1000);ms+=1000;if(ms%10000===0)console.log('Battle progress',enabled,theme,ms,await page.locator('#cm-root').getAttribute('data-active-screen'));}
 assert.equal(await page.locator('#cm-root').getAttribute('data-active-screen'),'BATTLE_RESULT');await size(page,844,390);await page.screenshot({path:path.join(out,`${theme}-battle-result.png`)});
 for(let i=0;i<8;i++){const next=page.locator('.cm-vs5-shell > .cm-vs5-action:visible:not(.cm-vs5-exit)');if(!(await next.count()))break;await next.click();}
 await page.locator('.cm-vs5-exit:visible').click();await readyHome(page);await step(page);
 const observed=await page.evaluate(()=>{__qaBattleUnsubscribe?.();return __qaObservedBattle;});assert.ok(observed.frames>1);assert.equal(observed.reducedCameraViolations,0);
 report.operations.push({enabled,theme,normalPracticeBattle:true,sameMatchAcrossResize:true,sameTickerAcrossResize:true,clockStart,simulatedMilliseconds:ms,naturalResult:true,returnHome:true,observed});
};
