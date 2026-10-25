// Extension of the existing fresh-profile, normal-entry Dex browser workflow.
// CDP generates trusted touch input in Chromium; this is not physical iPhone QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function verifyDetailSwipe(page, {output, evidence, checkDexRegistration}) {
  const originalViewport = page.viewportSize();
  const report = evidence.detailSwipe = {status:'RUNNING', input:'Chromium CDP Input.dispatchTouchEvent',
    viewport:{width:390,height:844}, physicalDevice:false, operations:[], screenshots:[], events:[]};
  const write = () => fs.writeFileSync(path.join(output,'swipe-result.json'), JSON.stringify(report,null,2)+'\n');
  const detail = page.locator('.cm-vs2-database__detail');
  const rows = page.locator('.cm-vs2-database__row');
  const filter = page.locator('.cm-vs2-database__stage');
  const back = page.locator('.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-footer button');
  const session = await page.context().newCDPSession(page);
  const expected = id => page.waitForFunction(id => Number(document.querySelector('.cm-vs2-database__row[aria-pressed="true"]')?.dataset.speciesIndex) === id,id,{timeout:4000});
  async function returnToList() { if(await detail.isVisible()) {await back.click();await detail.waitFor({state:'hidden'});} }
  async function stage(value) {await returnToList();await filter.selectOption(value);return rows.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.speciesIndex)));}
  async function open(id) {
    await returnToList();const row=page.locator(`.cm-vs2-database__row[data-species-index="${id}"]`);
    await row.scrollIntoViewIfNeeded();await row.click();await expected(id);
  }
  async function point(selector) {
    const target=page.locator(selector);await target.waitFor({state:'visible'});await target.scrollIntoViewIfNeeded();
    const box=await target.boundingBox();assert.ok(box);
    const x=Math.max(35,Math.min(355,box.x+box.width/2));
    const y=Math.max(45,Math.min(790,box.y+box.height/2));
    assert.ok(x>=box.x&&x<box.x+box.width&&y>=box.y&&y<box.y+box.height,'Gesture origin lies inside requested target');
    return {x,y,id:1,radiusX:2,radiusY:2,force:1};
  }
  async function gesture(selector, dx, dy=0, {cancel=false,edge=false,pinch=false}={}) {
    const p=await point(selector);if(edge)p.x=10;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    if(pinch) await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p,{...p,id:2,x:p.x+35}]});
    for(let step=1;step<=10;step++) {
      const q={...p,x:p.x+dx*step/10,y:p.y+dy*step/10};
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pinch?[q,{...q,id:2,x:q.x+35+step*2}]:[q]});
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
    await page.waitForTimeout(80);
  }
  const hero='.cm-dex-hero[data-art="ready"] .cm-dex-hero__image';
  async function shot(name) {const file=`swipe-${name}-390x844.png`;await page.screenshot({path:path.join(output,file)});report.screenshots.push(file);write();}
  try {
    await page.setViewportSize(report.viewport);
    await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    // Observation only. Never invokes app intents, writes saves or dispatches DOM events.
    await page.evaluate(()=>{
      const events=[];const record=event=>events.push({type:event.type,trusted:event.isTrusted,cancelable:event.cancelable,
        prevented:event.defaultPrevented,target:event.target?.className??'',touches:event.touches?.length??null,
        x:event.touches?.[0]?.clientX??null,y:event.touches?.[0]?.clientY??null});
      window.__dexSwipeObservation={events,record};
      for(const type of ['touchstart','touchmove','touchend','touchcancel','pointercancel'])document.addEventListener(type,record);
    });
    const order=await stage('3');assert.ok(order.length>3);
    const anchor=order.indexOf(40);assert.ok(anchor>0&&anchor<order.length-1);
    await open(40);const listScroll=await page.locator('.cm-vs2-shop__list').evaluate(e=>e.scrollTop);
    await shot('before-main-image');
    // Delay the real next portrait response, then navigate back while it is loading.
    // The existing build transport still supplies the unchanged image bytes.
    const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/data/championship/database-hero-portraits.public.v1.json'),'utf8'));
    const nextHero=catalog.entries.find(entry=>entry.speciesIndex===order[anchor+1]);
    assert.ok(nextHero);
    const delayedUrl=new URL(nextHero.src,page.url()).href;
    const imageBytes=fs.readFileSync(path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest',nextHero.src));
    assert.equal(require('node:crypto').createHash('sha256').update(imageBytes).digest('hex'),nextHero.sha256);
    let releaseImage,entered=false,finished,delayError=null;
    const imageGate=new Promise(resolve=>{releaseImage=resolve;});
    const imageFinished=new Promise(resolve=>{finished=resolve;});
    // Own this single response directly: falling back after a cancelled request
    // races the shared context route and can handle the same response twice.
    const delayImage=async route=>{
      entered=true;
      try {await imageGate;await route.fulfill({status:200,contentType:nextHero.src.endsWith('.png')?'image/png':'image/webp',body:imageBytes});}
      catch(error) {
        if(route.request().failure()?.errorText==='net::ERR_ABORTED')report.delayedImageCancelled=true;
        else delayError=error;
      } finally {finished();}
    };
    await page.route(delayedUrl,delayImage);
    try {
      await gesture(hero,-90);await expected(order[anchor+1]);
      assert.ok(entered,'The next real portrait request was delayed');
      assert.equal(await page.locator('.cm-dex-hero').getAttribute('data-art'),'loading');
      await gesture('.cm-dex-hero',90);await expected(40);
    } finally {releaseImage();if(entered)await imageFinished;await page.unroute(delayedUrl,delayImage);}
    if(delayError)throw delayError;
    await page.locator(hero).waitFor({state:'visible'});
    assert.equal(await page.locator('.cm-dex-hero').getAttribute('data-species-id'),'species-040');
    assert.equal(await page.locator(hero).getAttribute('src'),catalog.entries.find(entry=>entry.speciesIndex===40).src);
    report.operations.push({case:'async-portrait-return-keeps-current-identity',delayedSpecies:nextHero.speciesIndex,pass:true});
    await gesture(hero,-90);await expected(order[anchor+1]);await shot('after-next-main-image');
    await gesture(hero,90);await expected(40);
    report.operations.push({case:'main-image-next-previous',order:order.slice(anchor-1,anchor+2),pass:true});write();
    for(let i=0;i<3;i++){await gesture(hero,-90);await expected(order[anchor+1]);await gesture(hero,90);await expected(40);}
    report.operations.push({case:'consecutive-left-right',pairs:3,pass:true});
    // Use the actual scrollable detail; the hero is an ordinary image, not a control.
    await page.locator(hero).scrollIntoViewIfNeeded();
    const beforeScroll=await detail.evaluate(e=>e.scrollTop);
    await gesture(hero,0,-120);await expected(40);
    await page.waitForTimeout(500);
    const afterScroll=await detail.evaluate(e=>e.scrollTop);
    assert.ok(afterScroll>beforeScroll,'Trusted vertical touch must scroll the actual detail');
    await shot('vertical-scroll');
    report.operations.push({case:'vertical-scroll-no-selection',beforeScroll,afterScroll,pass:true});
    await gesture(hero,-80,60);await expected(40);
    await gesture(hero,-90,0,{cancel:true});await expected(40);
    await gesture(hero,-70,0,{pinch:true});await expected(40);
    // Browser handles viewport-edge starts; the app must not move the selection.
    await gesture(hero,80,0,{edge:true});await expected(40);
    report.operations.push({case:'diagonal-cancel-pinch-edge-no-selection',pass:true,systemBack:'physical iOS pending'});
    // Existing Back is outside the swipe surface; dragging it must not select a neighbor.
    await gesture('.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-footer button',-90);
    await expected(40);
    await returnToList();assert.equal(await filter.inputValue(),'3');
    assert.ok(Math.abs(await page.locator('.cm-vs2-shop__list').evaluate(e=>e.scrollTop)-listScroll)<2);
    report.operations.push({case:'filter-and-list-scroll-preserved',listScroll,pass:true});
    await open(order[0]);await gesture(hero,90);await expected(order[0]);
    await open(order.at(-1));await gesture(hero,-90);await expected(order.at(-1));
    report.operations.push({case:'filtered-first-last-stop',first:order[0],last:order.at(-1),pass:true});
    await shot('filtered-last-boundary');
    const stageCounts={};for(const value of ['0','1','2','3','4','5','6','ART'])stageCounts[value]=(await stage(value)).length;
    report.singleRow={stageCounts,status:Object.values(stageCounts).includes(1)?'AVAILABLE':'NOT_REACHABLE_WITH_CURRENT_STAGE_FILTER',
      coverage:'Single-row behavior is separately tested in the controlled-DOM suite; catalog is not altered for browser QA.'};
    await stage('');await checkDexRegistration?.();
    await stage('3');await open(40);await returnToList();await back.click();
    await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();
    await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();
    await page.locator('.cm-toolbar__menu:not([hidden]) button[data-entry-id="database"]').click();
    await page.locator('#cm-root[data-active-screen="DATABASE"]').waitFor();
    await stage('3');await open(40);await gesture(hero,-90);await expected(order[anchor+1]);
    report.operations.push({case:'leave-and-reenter-no-duplicate-listener',pass:true});await shot('reentry-next');
    report.events=await page.evaluate(()=>window.__dexSwipeObservation.events);
    assert.ok(report.events.some(e=>e.type==='touchmove'&&e.trusted));
    assert.ok(report.events.filter(e=>e.type.startsWith('touch')).every(e=>e.trusted));
    report.status='PASS_BROWSER_TOUCH_EMULATION';
  } catch(error) {
    report.status='FAIL';report.failure=error.stack??String(error);
    report.events=await page.evaluate(()=>window.__dexSwipeObservation?.events??[]).catch(()=>[]);
    await shot('failure').catch(()=>{});throw error;
  } finally {
    write();
    await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});
    await session.send('Emulation.setTouchEmulationEnabled',{enabled:false});await session.detach();
    await page.evaluate(()=>{const s=window.__dexSwipeObservation;if(s)for(const type of ['touchstart','touchmove','touchend','touchcancel','pointercancel'])document.removeEventListener(type,s.record);delete window.__dexSwipeObservation;});
    await returnToList();await filter.selectOption('');await page.setViewportSize(originalViewport);
  }
};
