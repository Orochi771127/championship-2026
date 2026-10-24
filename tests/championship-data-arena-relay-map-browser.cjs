// Normal Battle entry, real controls and read-only diagnostics; no phase skips.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { decide } = require('./championship-data-arena-qa-bot.cjs');
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8786';
const output = path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT || '.tmp/relay-map-browser');
fs.mkdirSync(output,{recursive:true});
const report = {origin,checks:[],errors:[],events:[],physicalDeviceAccepted:false};
const check = (name,value) => { report.checks.push({name,pass:!!value}); assert.ok(value,name); };
const save = fs.readFileSync(path.join(__dirname,'../qa/championship-full-qa-save.json'),'utf8');
const write = () => fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await context.addInitScript(({origin,save})=>{if(location.origin===origin&&!localStorage.getItem('relayQaSeeded')){localStorage.setItem('championshipModernSave:v1',save);localStorage.setItem('relayQaSeeded','1');}},{origin,save});
 try {
  await page.goto(origin+'/championship.html?arenaQa=1&arenaSeed=19');
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false,null,{timeout:60000});
  await page.locator('#cm-opening-film video').evaluateAll(vs=>vs.forEach(v=>v.playbackRate=8));
  await page.click('#cm-login');await page.click('#cm-continue');
  await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]');
  await page.click('button[data-menu-id="SYSTEM"]');await page.click('[data-entry-id="battle"]');
  const before=await page.evaluate(()=>localStorage.getItem('championshipModernSave:v1'));
  await page.click('#cm-data-arena');
  await page.waitForSelector('.da-panel--select');
  check('original entries preserved',await page.locator('.da-mode').count()===3);
  report.maps=[];const cdp=await context.newCDPSession(page);
  const first=Number(process.env.RELAY_MAP_FIRST||1),last=Number(process.env.RELAY_MAP_LAST||11);
  for(let i=first;i<=last;i++){
    if(i>first){await page.click('#cm-data-arena');await page.waitForSelector('.da-panel--select');}
    await page.click('.da-mode[data-mode="RELAY"]');
    const options=page.locator('.da-relay-options select');
    check(`roster ${i} includes 196`,await options.nth(0).locator('option').count()===196);
    if(i===11){await options.nth(0).selectOption('relay-species-230');await options.nth(1).selectOption('relay-species-229');}
    const id=`field_bm${String(i).padStart(2,'0')}_01`;await options.nth(2).selectOption(id);
    await page.click('.da-panel--select .da-btn--primary');await page.click('.da-panel--brief .da-btn--primary');
    await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY',null,{timeout:60000});
    await page.waitForFunction(()=>__dataArenaQA.snapshot().time>2.1);
    const wantedQuality=process.env.RELAY_MAP_QUALITY||'low';
    if(await page.evaluate(()=>__dataArenaQA.diagnostics().scene.quality)!==wantedQuality){
      await page.locator('.da-hud__pause').tap();await page.locator('.da-panel--pause .da-toggle').nth(1).tap();
      await page.waitForFunction(q=>__dataArenaQA.diagnostics().scene?.quality===q,wantedQuality);
      await page.locator('.da-panel--pause .da-btn--primary').tap();
    }
    const diag=await page.evaluate(()=>__dataArenaQA.diagnostics());report.maps.push({id,scene:diag.scene.environment,bundles:diag.bundles,quality:diag.scene.quality});
    check(`map ${id} mounted portrait`,diag.scene.environment?.id===id&&diag.scene.environment.portrait===true);
    check(`map ${id} loads only selected cast`,diag.bundles.length===4);
    check(`map ${id} ${wantedQuality} tier`,diag.scene.quality===wantedQuality);check(`map ${id} no frame fault`,!diag.frameFault);
    await page.waitForFunction(()=>document.querySelector('.da-root').scrollWidth===innerWidth,null,{timeout:3000});
    if([1,5,11].includes(i)){
      const beforeMove=await page.evaluate(()=>__dataArenaQA.snapshot().player);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:500,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:500,id:1}]});await page.waitForTimeout(450);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      const afterMove=await page.evaluate(()=>__dataArenaQA.snapshot().player);
      check(`map ${id} touch joystick moves`,Math.hypot(afterMove.x-beforeMove.x,afterMove.y-beforeMove.y)>15);
      await page.locator('.da-tbtn--skill').first().tap();await page.waitForTimeout(700);
      check(`map ${id} touch skill releases`,await page.evaluate(()=>__dataArenaQA.events().some(e=>e.type==='CAST_RELEASE'&&e.team==='player')));
      await page.screenshot({path:path.join(output,`${id}-portrait.png`)});
    }
    await page.locator('.da-hud__pause').tap();await page.locator('.da-panel--pause .da-btn--quiet').tap();await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]');
    check(`map ${id} exit disposes`,await page.evaluate(()=>!window.__dataArenaQA&&!document.querySelector('.da-root')));
  }
  check('raising save unchanged through visited maps',before===await page.evaluate(()=>localStorage.getItem('championshipModernSave:v1')));
  check('no runtime errors',report.errors.length===0);report.completed=true;
 } catch(error){report.diagnostics=await page.evaluate(()=>window.__dataArenaQA?.diagnostics());report.failure=error.stack;await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
 finally{write();await browser.close();console.log(JSON.stringify({completed:report.completed,maps:report.maps?.length,checks:report.checks,errors:report.errors,failure:report.failure}));}
})();
