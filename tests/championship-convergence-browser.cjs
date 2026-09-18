// Existing app + opening + production loader; no standalone game/renderer.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {startGame}=require('./championship-browser-opening.cjs');
const BASE=process.env.CHAMPIONSHIP_QA_URL||'http://127.0.0.1:8733/championship.html';
const OUTPUT=require('./browser-qa-output.cjs')('convergence');
const VIEWPORTS=[{width:390,height:844},{width:820,height:1180},{width:1024,height:1366}];
const key='championshipModernSave:v1';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

(async()=>{
  fs.mkdirSync(OUTPUT,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHAMPIONSHIP_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const results=[];const errors=[];let generatedRequests=0;
  try{
    const context=await browser.newContext({viewport:VIEWPORTS[0],deviceScaleFactor:1});
    const rebuilt=fs.readFileSync('.tmp/cage-authoring-proof/field_cm01_01/composite-hd4x.png');
    assert.deepEqual(rebuilt,fs.readFileSync('assets/production/cage/licensed-runtime-v1/fields/field_cm01_01/frame-00.png'));
    await context.route('**/assets/production/cage/licensed-runtime-v1/fields/field_cm01_01/frame-00.png',route=>{
      generatedRequests++;return route.fulfill({status:200,contentType:'image/png',body:rebuilt});
    });
    const page=await context.newPage();page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
    for(const [mode,query] of [['standalone','cageArt=field_cm01_01'],['starting-ranch','']]){
      await page.setViewportSize(VIEWPORTS[0]);
      await page.goto(BASE+(query?(BASE.includes('?')?'&':'?')+query:''),{waitUntil:'networkidle'});
      await startGame(page,{continueGame:mode==='starting-ranch'});
      await page.waitForSelector('.cm-raising-pixi-canvas');
      await page.waitForTimeout(600);
      // The existing save seam is page-hidden autosave, not New Game itself.
      await page.evaluate(()=>{
        Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForFunction(key=>localStorage.getItem(key)!==null,key);
      await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
      const canvas=await page.locator('.cm-raising-pixi-canvas').elementHandle();
      const root=await page.locator('#cm-root').elementHandle();
      const before=await page.evaluate(key=>localStorage.getItem(key),key);
      assert.ok(before,'existing page-hidden autosave created the canonical save');
      for(const viewport of [...VIEWPORTS,VIEWPORTS[0]]){
        await page.setViewportSize(viewport);
        await page.waitForTimeout(400);
        assert.equal(await canvas.evaluate(n=>n===document.querySelector('.cm-raising-pixi-canvas')),true,'resize retains canvas');
        assert.equal(await root.evaluate(n=>n===document.querySelector('#cm-root')),true,'resize retains root');
        const measurement=await page.evaluate(()=>{
          const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
          const buttons=[...document.querySelectorAll('#cm-root button:not(:disabled),.cm-toolbar button:not(:disabled)')].filter(b=>b.checkVisibility());
          return {documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,
            root:rect('#cm-root'),host:rect('.int-rh2-field-host'),canvas:rect('.cm-raising-pixi-canvas'),
            canvasCount:document.querySelectorAll('canvas').length,toolbar:document.querySelectorAll('.cm-toolbar__cell').length,
            controls:buttons.map(b=>{const r=b.getBoundingClientRect();return {id:b.id||b.className,x:r.x,y:r.y,width:r.width,height:r.height};}),
            uiAuthority:document.querySelector('#cm-root').dataset.uiAuthority,
            rendererSplit:document.querySelector('.int-rh2-shell').dataset.rendererSplit};
        });
        assert.equal(measurement.documentWidth,viewport.width);assert.ok(measurement.documentHeight<=viewport.height);
        assert.equal(measurement.canvasCount,1);assert.equal(measurement.toolbar,8);
        assert.equal(measurement.uiAuthority,'P1R_DOM');assert.equal(measurement.rendererSplit,'DOM_UI_PIXI_FIELD');
        assert.ok(Math.abs(measurement.host.width-measurement.canvas.width)<=1);
        assert.ok(Math.abs(measurement.host.height-measurement.canvas.height)<=1);
        // Sep17 bounded reflow replaces the old measured 410px wide host.
        // Compact keeps its exact baseline; wider hosts must use the space.
        if(viewport.width===390)assert.equal(measurement.host.width,370);
        else assert.ok(measurement.host.width>=viewport.width-40,'wide Raising host uses available width');
        for(const c of measurement.controls){assert.ok(c.height>=44,c.id);assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=viewport.width+1&&c.y+c.height<=viewport.height+1,c.id);}
        const after=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(after,before,'resize alone preserves saved bytes');
        const profile=viewport.width<600?'COMPACT':viewport.width<840?'MEDIUM':'EXPANDED';
        const screenshot=`${mode}-${viewport.width}x${viewport.height}-${results.length}.png`;
        await page.screenshot({path:path.join(OUTPUT,screenshot),fullPage:true});
        results.push({mode,viewport,profile,measurement,saveHash:hash(after),sameCanvas:true,sameRoot:true,screenshot});
      }
    }
    assert.ok(generatedRequests>=2,'both existing preview and normal ranch consumed generated frame');assert.deepEqual(errors,[]);
    await context.close();
  }finally{await browser.close();}
  const report={status:'PASS',generatedRequests,results,errors,
    limitation:'Browser layout/resize and static Cage reconstruction only; interactions are covered by test:browser:cage-layout. No physical-device, foreground-occlusion or art approval.'};
  fs.writeFileSync(path.join(OUTPUT,'browser-qa.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`CONVERGENCE_BROWSER_PASS checks=${results.length} generatedRequests=${generatedRequests}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
