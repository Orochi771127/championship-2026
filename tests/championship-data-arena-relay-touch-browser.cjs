// Real multi-touch controls and viewport geometry, through the normal menu.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.CHAMPIONSHIP_QA_ORIGIN||'http://127.0.0.1:8786';
const output=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT||'.tmp/relay-touch-browser');
fs.mkdirSync(output,{recursive:true});
const report={origin,checks:[],errors:[],layouts:[],physicalDeviceAccepted:false};
const check=(name,value)=>{report.checks.push({name,pass:!!value});assert.ok(value,name);};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const save=fs.readFileSync(path.join(__dirname,'../qa/championship-full-qa-save.json'),'utf8');
 await context.addInitScript(({origin,save})=>{if(location.origin===origin&&!localStorage.getItem('relayQaSeeded')){localStorage.setItem('championshipModernSave:v1',save);localStorage.setItem('relayQaSeeded','1');}},{origin,save});
 try {
  await page.goto(origin+'/championship.html?arenaQa=1&arenaSeed=19');
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false,null,{timeout:60000});
  await page.locator('#cm-opening-film video').evaluateAll(vs=>vs.forEach(v=>v.playbackRate=8));
  await page.click('#cm-login');await page.click('#cm-continue');
  await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]');
  await page.click('button[data-menu-id="SYSTEM"]');await page.click('[data-entry-id="battle"]');
  const before=await page.evaluate(()=>localStorage.getItem('championshipModernSave:v1'));
  await page.click('#cm-data-arena');await page.click('.da-mode[data-mode="RELAY"]');
  await page.click('.da-panel--select .da-btn--primary');await page.click('.da-panel--brief .da-btn--primary');
  await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY',null,{timeout:60000});
  await page.waitForFunction(()=>__dataArenaQA.snapshot().time>2.1);
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
   await page.setViewportSize(viewport);
   await page.waitForFunction(w=>document.querySelector('.da-root').clientWidth===w,viewport.width);
   const layout=await page.evaluate(()=>{
    const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    return {width:innerWidth,height:innerHeight,scroll:document.querySelector('.da-root').scrollWidth,
      overflow:[...document.querySelectorAll('.da-root *')].filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>({tag:n.tagName,id:n.id,classes:n.className,style:n.getAttribute('style'),...rect(n)})),
      controls:[...document.querySelectorAll('.da-tbtn,.da-hud__pause')].filter(n=>n.getBoundingClientRect().width>0).map(n=>({id:n.className,...rect(n)})),
      hp:rect(document.querySelector('.da-bar--hp')),tp:rect(document.querySelector('.da-bar--energy')),
      hpText:document.querySelector('.da-bar--hp .da-bar__value').textContent,tpText:document.querySelector('.da-bar--energy .da-bar__value').textContent};
   });
   report.layouts.push(layout);const label=`${viewport.width}x${viewport.height}`;
   check(label+' no overflow',layout.scroll===viewport.width);
   check(label+' eight visible controls',layout.controls.length===8);
   check(label+' targets at least 48 except pause 44',layout.controls.every(c=>c.w>=(c.id.includes('pause')?44:48)&&c.h>=(c.id.includes('pause')?44:48)));
   check(label+' targets inside safe viewport',layout.controls.every(c=>c.x>=8&&c.y>=8&&c.right<=layout.width-8&&c.bottom<=layout.height-8));
   check(label+' no overlapping hit rectangles',layout.controls.every((a,i)=>layout.controls.slice(i+1).every(b=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y)));
   check(label+' TP below HP with visible numbers',layout.tp.y>=layout.hp.bottom&&/\d+\/\d+/.test(layout.hpText)&&/\d+\/\d+/.test(layout.tpText));
   await page.screenshot({path:path.join(output,label+'.png')});
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.da-root').clientWidth===390);
  const cdp=await context.newCDPSession(page);
  const basic=await page.locator('.da-tbtn--basic').boundingBox();
  const attack={x:basic.x+basic.width/2,y:basic.y+basic.height/2,id:2};
  const playerBefore=await page.evaluate(()=>__dataArenaQA.snapshot().player);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:70,y:740,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:710,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:710,id:1},attack]});
  await page.waitForTimeout(1400);
  const during=await page.evaluate(()=>({player:__dataArenaQA.snapshot().player,events:__dataArenaQA.events()}));
  check('left move and right held attack operate together',Math.hypot(during.player.x-playerBefore.x,during.player.y-playerBefore.y)>15&&during.events.some(e=>e.type==='CAST_RELEASE'&&e.team==='player'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(800);
  const settled=await page.evaluate(()=>__dataArenaQA.events().filter(e=>e.type==='CAST_RELEASE'&&e.team==='player').length);
  await page.waitForTimeout(900);
  check('release stops repeat attack',settled===await page.evaluate(()=>__dataArenaQA.events().filter(e=>e.type==='CAST_RELEASE'&&e.team==='player').length));
  await page.locator('.da-tbtn--s1').tap();await page.waitForTimeout(400);
  check('skill tap shows numeric cooldown',/s$/.test(await page.locator('.da-tbtn--s1 .da-tbtn__meta').textContent()));
  await page.waitForTimeout(900);
  await page.locator('.da-tbtn--switch').tap();await page.waitForTimeout(350);
  check('separate switch button changes member',await page.evaluate(()=>__dataArenaQA.snapshot().relay.active===1));
  await page.locator('.da-tbtn--dash').tap();await page.waitForTimeout(80);
  check('dash button consumes a charge',await page.evaluate(()=>__dataArenaQA.snapshot().player.dashCharges<__dataArenaQA.snapshot().player.dashMax));
  // A cancelled held contact must not stick. Pause also clears every input.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[attack]});
  await page.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  check('cancel releases button feedback',!await page.locator('.da-tbtn--basic').evaluate(n=>n.classList.contains('is-pressed')));
  await page.locator('.da-hud__pause').tap();await page.locator('.da-panel--pause .da-btn--quiet').tap();
  await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]');
  check('exit disposes and preserves raising save',await page.evaluate(before=>!window.__dataArenaQA&&!document.querySelector('.da-root')&&localStorage.getItem('championshipModernSave:v1')===before,before));
  check('no runtime errors',report.errors.length===0);report.completed=true;
 } catch(error){report.failure=error.stack;report.diagnostics=await page.evaluate(()=>window.__dataArenaQA?.diagnostics());await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
 finally {fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
})();
