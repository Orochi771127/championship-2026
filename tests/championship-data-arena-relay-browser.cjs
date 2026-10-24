// Normal Battle entry, real controls and read-only diagnostics; no phase skips.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { decide } = require('./championship-data-arena-qa-bot.cjs');
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8786';
const output = path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT || '.tmp/relay-browser');
fs.mkdirSync(output,{recursive:true});
const report = {origin,checks:[],errors:[],events:[],physicalDeviceAccepted:false};
const check = (name,value) => { report.checks.push({name,pass:!!value}); assert.ok(value,name); };
const save = fs.readFileSync(path.join(__dirname,'../qa/championship-full-qa-save.json'),'utf8');
const write = () => fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
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
  await page.click('.da-mode[data-mode="RELAY"]');await page.locator('.da-partner').nth(1).click();
  await page.click('.da-panel--select .da-btn--primary');await page.click('.da-panel--brief .da-btn--primary');
  await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY',null,{timeout:60000});
  let held=new Set(),mem={},switched=false,windup=false,recovery=false,enemyCast=false,hits=false,shot=false;
  const start=Date.now();
  for(;;){
   assert.ok(Date.now()-start<230000,'bounded match timeout');
   const o=await page.evaluate(()=>{const q=__dataArenaQA;return {state:q.state(),snap:q.snapshot(),...q.entities(),telegraphs:q.telegraphs(),events:q.events(),diag:q.diagnostics()};});
   if(o.state==='RESULT'){report.result=o.snap.result;break;}
   assert.equal(o.diag.frameFault,null);
   if(o.diag.scene.playerAnimation.phase==='WINDUP')windup=true;
   if(o.diag.scene.playerAnimation.phase==='RECOVERY')recovery=true;
   enemyCast ||= o.diag.scene.rivalAnimations.some(actor=>actor.phase==='WINDUP'||actor.phase==='RECOVERY');
   if(o.events.some(e=>e.type==='RIVAL_HIT'||e.type==='SKILL_HIT'))hits=true;
   for(const e of o.events)if(['CAST_RELEASE','RELAY_SWITCH','PLAYER_HIT','RIVAL_HIT','RESULT'].includes(e.type)&&!report.events.some(x=>JSON.stringify(x)===JSON.stringify(e)))report.events.push(e);
   const d=decide({...o,snap:{...o.snap,gameMode:'TOURNAMENT'}},mem),want=new Set(['j']);
   if(d.moveX>.3)want.add('d');if(d.moveX<-.3)want.add('a');if(d.moveY>.3)want.add('s');if(d.moveY<-.3)want.add('w');
   for(const k of held)if(!want.has(k))await page.keyboard.up(k);
   for(const k of want)if(!held.has(k))await page.keyboard.down(k);held=want;
   if(d.dash)await page.keyboard.press('Space');
   if(d.cast!==null)await page.keyboard.press(['2','3','4'][d.cast]);
   if(o.snap.kit.energy>=80&&o.snap.kit.ultimateCooldown<=0)await page.keyboard.press('r');
   if(!switched&&o.snap.time>12&&!o.snap.player.action){await page.keyboard.up('j');held.delete('j');await page.keyboard.press('x');}
   switched ||= o.snap.relay.active===1;
   if(!shot&&hits&&o.snap.time>15){await page.screenshot({path:path.join(output,'desktop-combat.png')});shot=true;}
   await page.waitForTimeout(100);
  }
  for(const k of held)await page.keyboard.up(k);
  await page.waitForSelector('.da-panel--result');await page.screenshot({path:path.join(output,'result.png')});
  check('windup drives body animation',windup);check('release drives recovery animation',recovery);
  check('rival cast drives its body animation',enemyCast);
  check('actual rival hit',hits);check('switch changes active member',switched);
  check('complete result',!!report.result);
  const listeners=await page.evaluate(()=>__dataArenaQA.diagnostics().tickerListeners);
  await page.click('.da-panel--result .da-btn--primary');
  await page.waitForFunction(()=>__dataArenaQA.state()==='PLAY');
  check('retry resets team',await page.evaluate(()=>__dataArenaQA.snapshot().relay.enemyIndex===0&&__dataArenaQA.snapshot().relay.active===0));
  check('retry preserves one ticker registration',listeners===await page.evaluate(()=>__dataArenaQA.diagnostics().tickerListeners));
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.da-root').scrollWidth===innerWidth,null,{timeout:3000});
  await page.screenshot({path:path.join(output,'phone-layout.png')});
  check('phone viewport has no horizontal overflow',await page.evaluate(()=>document.querySelector('.da-root').scrollWidth===390));
  await page.keyboard.press('p');await page.locator('.da-panel--pause .da-btn--quiet').click();
  await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]');
  check('exit removes arena observer and DOM',await page.evaluate(()=>!window.__dataArenaQA&&!document.querySelector('.da-root')));
  const after=await page.evaluate(()=>localStorage.getItem('championshipModernSave:v1'));
  check('raising save byte unchanged during arena',before===after);
  check('no runtime errors',report.errors.length===0);
  report.completed=true;
 } catch(error){report.failure=error.stack;await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
 finally {write();await browser.close();console.log(JSON.stringify({completed:report.completed,checks:report.checks,result:report.result,failure:report.failure,output}));}
})();
