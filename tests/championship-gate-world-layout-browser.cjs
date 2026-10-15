const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const BASE = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:18743';
const OUTPUT = path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT || 'output/playwright', 'gate-world');
fs.mkdirSync(OUTPUT,{recursive:true});
const world = '.cm-vs2-gate3d__canvas', toggle = '.cm-vs2-gate3d__toggle';
async function inspect(page) {
  return page.evaluate(()=>{
    const rect = s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    const hint=document.querySelector('.cm-vs2-gate3d__hint');
    const body=document.querySelector('.cm-vs2-body');
    return {host:rect('.cm-vs2-gate3d__host'),bar:rect('.cm-vs2-gate3d__bar'),hint:rect('.cm-vs2-gate3d__hint'),footer:rect('.cm-vs2-footer'),
      hintInCopy:hint.parentElement.classList.contains('cm-vs2-gate3d__bar-copy'),hintPosition:getComputedStyle(hint).position,
      bodyScrollable:body.scrollHeight>body.clientHeight,bodyOverflow:getComputedStyle(body).overflowY,
      overflowX:document.documentElement.scrollWidth>innerWidth+1,
      rendererCount:document.querySelectorAll('.cm-vs2-gate3d__canvas').length,
      landscape:document.body.hasAttribute('data-landscape-menu'),
      canvasWidth:document.querySelector('.cm-vs2-gate3d__canvas')?.width,
      nodes:[...document.querySelectorAll('.cm-vs2-gate3d__node-hit')].map(n=>({biome:n.dataset.biomeId,hidden:n.hidden,selected:n.dataset.selected}))};
  });
}
async function blankCanvasPoint(page) {
  const box=await page.locator(world).boundingBox();
  return page.evaluate(box=>{
    for(const y of [0.5,0.25,0.75])for(const x of [0.5,0.25,0.75]){
      const point={x:box.x+box.width*x,y:box.y+box.height*y};
      if(document.elementFromPoint(point.x,point.y)?.matches('.cm-vs2-gate3d__canvas'))return point;
    }
    throw Error('no empty canvas for drag');
  },box);
}
async function drag(page, dx, dy=0) {
  const start=await blankCanvasPoint(page);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  if(Math.abs(dx)+Math.abs(dy)<8)await page.mouse.move(start.x+8,start.y);
  await page.mouse.move(start.x+dx,start.y+dy,{steps:8});await page.mouse.up();
}
async function face(page, region, rotation) {
  const targetY=-region.longitude*Math.PI/180;
  let deltaY=(targetY-rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;
  while(Math.abs(deltaY)>0.001){const part=Math.max(-0.80,Math.min(0.80,deltaY));await drag(page,part/0.008);rotation.y+=part;deltaY-=part;}
  const targetX=Math.max(-0.72,Math.min(0.72,region.latitude*Math.PI/180));
  await drag(page,0,(targetX-rotation.x)/0.006);rotation.x=targetX;
}
async function open(browser, viewport, query='') {
  const context=await browser.newContext({viewport,deviceScaleFactor:2});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/tests/fixtures/championship-gate-world-review.html${query}`);
  await page.waitForFunction(()=>Boolean(window.gateReview));
  return {context,page,errors};
}
(async()=>{
  const {GATE_WORLD_REGIONS}=await import('../src/championship/presentation/vs2/gateWorldLayout.js');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHAMPIONSHIP_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const report={regions:[],viewports:[],fallbacks:[],lifecycle:null};
  try{
    const {page,context,errors}=await open(browser,{width:390,height:844});
    const rotation={x:-0.16,y:0.42};
    for(const region of GATE_WORLD_REGIONS){
      await page.locator(toggle).click();
      const id=`championship:2026:gate:${region.biomeId.toLowerCase()}`;
      await page.locator(`.cm-vs2-gate[data-gate-id='${id}']`).click();
      await page.locator(toggle).click();
      await page.locator(world).scrollIntoViewIfNeeded();
      const before=await page.evaluate(()=>window.gateReview.selectionEvents);
      await face(page,region,rotation);
      assert.equal(await page.evaluate(()=>window.gateReview.selectionEvents),before,'drag selected a destination');
      const node=page.locator(`.cm-vs2-gate3d__node-hit[data-biome-id='${region.biomeId}']`);
      assert.equal(await node.isVisible(),true,`${region.biomeId} front marker missing`);
      assert.equal(await node.getAttribute('data-selected'),'true');
      await node.click();
      const bounds=await page.evaluate(biome=>{
        const node=document.querySelector(`[data-biome-id='${biome}']`),label=node.querySelector('.cm-vs2-gate3d__node-name');
        const h=node.parentElement.getBoundingClientRect(),l=label.getBoundingClientRect();
        return {inside:l.left>=h.left-1&&l.right<=h.right+1&&l.top>=h.top-1&&l.bottom<=h.bottom+1,
          labelAbove:node.dataset.labelAbove,hitWidth:node.getBoundingClientRect().width,hitHeight:node.getBoundingClientRect().height,
          preview:document.querySelector('.cm-vs2-preview__image').getAttribute('src'),
          disabled:document.querySelector('.cm-vs2-action--primary').disabled};
      },region.biomeId);
      assert.equal(bounds.inside,true,`${region.biomeId} selected label clipped`);
      assert.equal(bounds.hitWidth,44);assert.equal(bounds.hitHeight,44);
      if(['Damp','Mine'].includes(region.biomeId))assert.equal(bounds.labelAbove,'true',`${region.biomeId} defining landmark covered below marker`);
      assert.ok(bounds.preview);
      await page.locator('.cm-vs2-gate3d__host').screenshot({path:path.join(OUTPUT,`${region.biomeId}.png`)});
      report.regions.push({biomeId:region.biomeId,...bounds});
    }
    const prior=await page.evaluate(()=>window.gateReview.selectionEvents);
    await drag(page,Math.PI/0.008);
    assert.equal(await page.locator('[data-biome-id="Volcano"]').isVisible(),false,'backface marker remains interactive');
    assert.equal(await page.evaluate(()=>window.gateReview.selectionEvents),prior);
    const blank=await blankCanvasPoint(page);
    await page.mouse.move(blank.x,blank.y);await page.mouse.down();
    await page.locator(world).dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.gateReview.selectionEvents),prior,'cancel selected a destination');
    for(let i=0;i<5;i++)await page.evaluate(()=>window.gateReview.remount());
    assert.equal(await page.locator(world).count(),1);
    const diagnostics=await page.evaluate(()=>window.gateReview.diagnostics());
    assert.equal(diagnostics.renderLoop,'NONE_EVENT_DRIVEN');
    await page.evaluate(()=>window.gateReview.dispose());assert.equal(await page.locator(world).count(),0);
    assert.deepEqual(errors,[]);report.lifecycle={mounts:6,renderersAfterDispose:0,diagnostics};await context.close();

    for(const viewport of [{width:390,height:844},{width:320,height:568},{width:1280,height:720},{width:1024,height:600},{width:844,height:390},{width:720,height:320}]){
      for(const lang of ['zh-Hant','en','ja','th','vi']){
        const query=`?lang=${lang}&responsive=1&quality=saver&motion=reduced`;
        const {page,context,errors}=await open(browser,viewport,query);
        const id=await page.locator('.cm-vs2-gate3d__node-hit:not([hidden])[data-availability="LOCKED"]').first().getAttribute('data-gate-id');
        await page.locator(`.cm-vs2-gate3d__node-hit[data-gate-id='${id}']`).click();
        const state=await inspect(page);
        assert.equal(state.hintInCopy,true);assert.equal(state.hintPosition,'static');
        assert.ok(state.hint.bottom<=state.bar.bottom+1);assert.ok(state.host.height>=(viewport.width<374?250:280));
        assert.ok(state.footer.bottom<=viewport.height+1);assert.equal(state.overflowX,false);
        assert.ok(Math.abs(state.canvasWidth-state.host.width)<=1,'saver tier exceeded its pixel ratio cap');
        assert.equal(await page.locator('.cm-vs2-action--primary').isDisabled(),true);
        assert.equal(await page.locator('.cm-vs2-preview__image').isVisible(),true);
        await page.screenshot({path:path.join(OUTPUT,`${viewport.width}x${viewport.height}-${lang}.png`)});
        if(viewport.height<=568&&viewport.width<viewport.height){
          await page.locator(world).scrollIntoViewIfNeeded();
          const visibility=await page.evaluate(()=>{
            const host=document.querySelector('.cm-vs2-gate3d__host').getBoundingClientRect(),body=document.querySelector('.cm-vs2-body').getBoundingClientRect();
            return host.top>=body.top-1&&host.bottom<=body.bottom+1;
          });
          assert.equal(visibility,true,'short screen cannot scroll the full globe above the footer');
          await page.screenshot({path:path.join(OUTPUT,`${viewport.width}x${viewport.height}-${lang}-scrolled.png`)});
        }
        const landmarkLabels=[];const rotation={x:-0.16,y:0.42};
        for(const biomeId of ['Damp','Mine']){
          await page.locator(toggle).click();
          await page.locator(`.cm-vs2-gate[data-gate-id='championship:2026:gate:${biomeId.toLowerCase()}']`).click();
          await page.locator(toggle).click();await page.locator(world).scrollIntoViewIfNeeded();
          await face(page,GATE_WORLD_REGIONS.find(region=>region.biomeId===biomeId),rotation);
          const label=await page.locator(`.cm-vs2-gate3d__node-hit[data-biome-id='${biomeId}']`).evaluate(node=>{
            const h=node.parentElement.getBoundingClientRect(),l=node.querySelector('.cm-vs2-gate3d__node-name').getBoundingClientRect();
            return {biomeId:node.dataset.biomeId,labelAbove:node.dataset.labelAbove,
              inside:l.left>=h.left-1&&l.right<=h.right+1&&l.top>=h.top-1&&l.bottom<=h.bottom+1};
          });
          assert.equal(label.labelAbove,'true');assert.equal(label.inside,true);
          await page.screenshot({path:path.join(OUTPUT,`${viewport.width}x${viewport.height}-${lang}-${biomeId}.png`)});
          landmarkLabels.push(label);
        }
        report.viewports.push({viewport,lang,...state,landmarkLabels});assert.deepEqual(errors,[]);await context.close();
      }
    }
    const highContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'reduce'});
    const high=await highContext.newPage();await high.goto(`${BASE}/tests/fixtures/championship-gate-world-review.html?quality=high&motion=reduced`);
    await high.waitForFunction(()=>Boolean(window.gateReview));const highState=await inspect(high);
    assert.ok(Math.abs(highState.canvasWidth-highState.host.width*3)<=1);
    await highContext.close();
    for(const variant of ['?gateMode=fallback','?webglFail=1','?tutorial=1']){
      const {page,context,errors}=await open(browser,{width:390,height:844},variant);
      assert.equal(await page.locator(world).count(),0);assert.equal(await page.locator('.cm-vs2-gate').count(),16);
      assert.equal(await page.locator('.cm-vs2-gate3d__hint').isVisible(),false);
      report.fallbacks.push({variant,cards:16,renderers:0});assert.deepEqual(errors,[]);await context.close();
    }
    report.verdict='PASS';fs.writeFileSync(path.join(OUTPUT,'validation.json'),JSON.stringify(report,null,2));
    console.log('GATE_WORLD_BROWSER_PASS regions=16 language/viewport=30 fallback=3 lifecycle=6');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
