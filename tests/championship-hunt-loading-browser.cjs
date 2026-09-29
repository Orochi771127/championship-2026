// Network delay at the ordinary Gate -> Loadout -> Hunt boundary. No app-state
// writes: verify actual visible readiness, suspended time, exit and second entry.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {openFreshGame, openHunt} = require('./championship-browser-opening.cjs');
const output = require('./browser-qa-output.cjs')('hunt-loading');
fs.mkdirSync(output, {recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;
  try {
    await openFreshGame(page,(process.env.CHAMPIONSHIP_QA_URL||'http://127.0.0.1:8732/championship.html')+'?gateMode=fallback');
    const ready=()=>page.locator('.cm-vs2-field__canvas[aria-busy="false"]').waitFor({timeout:90000});
    async function loadout(){
      await openHunt(page);
      await page.locator('.cm-vs2-gates [data-gate-id="championship:2026:gate:grass"]').click();
      await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      await page.locator('[data-equipment-class="ROPE"] [data-item-id]').first().click();
    }
    async function delayedEntry(cancel){
      await loadout();
      let hit,done;const intercepted=new Promise(r=>hit=r), gate=new Promise(r=>release=r),handled=new Promise(r=>done=r);
      const match='**/hunt-feedback-v1/manifest.json';
      let first=true;
      await page.route(match,async route=>{if(!first){await route.continue();return;}first=false;hit();await gate;try{await route.continue();}catch(e){if(!page.isClosed())throw e;}finally{done();}});
      await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      await intercepted;
      assert.equal(await page.getByRole('status').filter({hasText:'正在準備狩獵場'}).isVisible(),true);
      assert.equal(await page.locator('.cm-hunt-tools button:enabled').count(),0);
      const before=await page.locator('.cm-status-bar__time').textContent();
      await page.waitForTimeout(2200);
      assert.equal(await page.locator('.cm-status-bar__time').textContent(),before,'download cannot spend Hunt time');
      await page.screenshot({path:path.join(output,cancel?'exit-loading.png':'loading.png')});
      if(cancel){
        await page.getByRole('button',{name:'返回牧場',exact:true}).click();
        // Keep the original request stalled through Home and a new expedition.
        await page.locator('[data-screen="RAISING_HOME"]').waitFor({timeout:15000});
        await loadout();await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await ready();
      }
      release();await handled;await page.unroute(match);
      {
        await ready();
        await page.waitForTimeout(500);
        assert.equal(await page.locator('.cm-vs2-field__loading').count(),0);
        assert.ok(await page.locator('.cm-hunt-tools button:enabled').count()>0);
        await page.screenshot({path:path.join(output,cancel?'late-download-after-reentry.png':'ready.png')});
        await page.getByRole('button',{name:'返回牧場',exact:true}).click();
        await page.locator('[data-screen="RAISING_HOME"]').waitFor({timeout:90000});
      }
    }
    await delayedEntry(false);
    await delayedEntry(true);
    await loadout();await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await ready();
    await page.screenshot({path:path.join(output,'reentry.png')});
    await page.getByRole('button',{name:'返回牧場',exact:true}).click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor({timeout:90000});
    // An optional feedback download failing must still leave the map, actors,
    // player controls and exit usable. It does not establish VFX parity.
    await loadout();
    const failedManifest='**/hunt-feedback-v1/manifest.json';
    await page.route(failedManifest,route=>route.fulfill({status:503,body:'controlled download failure'}));
    await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await ready();
    assert.ok(await page.locator('.cm-vs2-field__canvas canvas').count()>0);
    assert.ok(await page.locator('.cm-hunt-tools button:enabled').count()>0);
    await page.screenshot({path:path.join(output,'optional-feedback-failure.png')});
    await page.getByRole('button',{name:'返回牧場',exact:true}).click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor({timeout:90000});
    await page.unroute(failedManifest);
    // A slow but working link (2026-09-29): about 48 KB/s, the speed at which
    // the public playtest's Hunt used to give up at a fixed 30 s. The download
    // must keep going, show real progress, and end in a playable field with no
    // failure message.
    await loadout();
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:48*1024,uploadThroughput:48*1024});
    const slowStart=Date.now();
    await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
    await page.locator('.cm-vs2-field__progress:not([hidden])').waitFor({timeout:60000});
    const percents=new Set();
    const seenFailure=()=>page.getByRole('status').filter({hasText:/沒有回應|時間過長/}).count();
    let slowReady=false,noteShot=false;
    while(Date.now()-slowStart<240000){
      if(await page.locator('.cm-vs2-field__canvas[aria-busy="false"]').count()){slowReady=true;break;}
      // Bytes received so far: present whether or not the server sends sizes.
      const now=await page.locator('.cm-vs2-field__progress').getAttribute('data-loaded-bytes').catch(()=>null);
      if(now!==null)percents.add(Number(now));
      assert.equal(await seenFailure(),0,'a download that is still moving must not be given up');
      if(Date.now()-slowStart>12000&&!noteShot){
        assert.equal(await page.locator('.cm-vs2-field__loading-note').isVisible(),true,'a slow load says it is still downloading');
        await page.screenshot({path:path.join(output,'slow-link-progress.png')});noteShot=true;
      }
      await page.waitForTimeout(1000);
    }
    const slowSeconds=Math.round((Date.now()-slowStart)/1000);
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    assert.equal(slowReady,true,'the slow link finishes loading the Hunt');
    assert.ok(slowSeconds>30,`the throttled load outlasted the old 30 s limit (${slowSeconds}s)`);
    const seen=[...percents].sort((a,b)=>a-b);
    assert.ok(seen.length>=3&&seen.at(-1)>seen[0],`bytes kept arriving and were shown while downloading (${seen.join(',')})`);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.cm-vs2-field__loading').count(),0);
    assert.ok(await page.locator('.cm-hunt-tools button:enabled').count()>0);
    await page.screenshot({path:path.join(output,'slow-link-ready.png')});
    await page.getByRole('button',{name:'返回牧場',exact:true}).click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor({timeout:90000});
    await cdp.detach();

    await loadout();
    let timeoutHit;const timeoutIntercepted=new Promise(r=>timeoutHit=r),timeoutGate=new Promise(r=>release=r);
    await page.route(failedManifest,async route=>{timeoutHit();await timeoutGate;await route.abort().catch(()=>{});});
    await page.clock.install();
    await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();await timeoutIntercepted;
    const beforeTimeout=await page.locator('.cm-status-bar__time').textContent();
    // Nothing more arrives: 30 s after the last progress the load is stalled.
    await page.clock.fastForward(31000);
    await page.getByRole('status').filter({hasText:'狩獵場下載沒有回應'}).waitFor();
    assert.equal(await page.locator('.cm-status-bar__time').textContent(),beforeTimeout);
    assert.equal(await page.locator('.cm-hunt-tools button:enabled').count(),0);
    await page.screenshot({path:path.join(output,'timeout.png')});
    await page.getByRole('button',{name:'返回牧場',exact:true}).click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor({timeout:15000});
    release();await page.unroute(failedManifest,{behavior:'wait'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,delayedClock:true,cancelBeforeDownloadFinishes:true,reentryBeforeOldDownloadFinishes:true,
      slowLink:{throughputBytesPerSecond:48*1024,seconds:slowSeconds,progressSeen:seen},stallWithoutClockLoss:true,optionalFeedbackFailure:true,errors},null,2));
    console.log('CHAMPIONSHIP_HUNT_LOADING_BROWSER_PASS');
  } catch(e) {console.error(e);throw e;} finally {release?.();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
