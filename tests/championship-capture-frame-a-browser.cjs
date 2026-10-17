const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..'),root=repo,temp=path.join(repo,'.tmp/capture-a-review');
const output=process.env.CHAMPIONSHIP_QA_OUTPUT||path.join(repo,'.tmp/capture-a-browser-results');fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(output,{recursive:true});
const index=JSON.parse(fs.readFileSync(path.join(repo,'assets/production/PUBLIC_RUNTIME_INDEX.json'),'utf8'));
const portraits=[116,73].map(n=>index.assets.find(a=>a.id===`species-${String(n).padStart(3,'0')}:database-hero`));assert.ok(portraits.every(Boolean));
const origin='http://127.0.0.1:8879';
const entry=`import {createHuntResultView} from '../../src/championship/app/vs3Screens.js';
import {setLocale} from '../../src/championship/text/locale.js';
const portraits=${JSON.stringify(portraits)};let view,block,calls=[];
const rows=[{kind:'CARD',id:'wild-1',key:'card:wild-1',speciesId:'species-116',displayName:'雪印零偶',canRelease:true,selected:true},{kind:'CARD',id:'wild-2',key:'card:wild-2',speciesId:'species-073',displayName:'Second Partner',canRelease:true,selected:false},{kind:'HOME',id:'home-1',key:'home:home-1',speciesId:'species-116',displayName:'Existing resident',canRelease:false}];
function render(){view.render({screen:'HUNT_RESULT',huntResult:block});}
function mount(locale='zh-Hant',multiple=false){view?.dispose();setLocale(locale);document.documentElement.lang=locale;calls=[];block={title:'HUNT RESULT',outcomeLabel:'ON MEMORY CARD',speciesId:'species-116',displayName:'雪印零偶',wildId:'wild-1',rows:multiple?structuredClone(rows):[structuredClone(rows[0])],pendingRelease:null,commitError:null};
const source={getFrame:()=>({screen:'HUNT_RESULT',huntResult:block}),intents:{
setHuntResultName(name){calls.push(['name',name]);block.displayName=name;const row=block.rows.find(r=>r.selected);if(row)row.displayName=name;render();},
selectHuntResultEntry(id){calls.push(['select',id]);const row=block.rows.find(r=>r.id===id);block.rows.forEach(r=>r.selected=r.id===id);block.speciesId=row.speciesId;block.wildId=row.id;block.displayName=row.displayName;render();},
requestHuntResultRelease(key){calls.push(['requestRelease',key]);block.pendingRelease=block.rows.find(r=>r.key===key);render();},
cancelHuntResultRelease(){calls.push(['cancelRelease']);block.pendingRelease=null;render();},
confirmHuntResultRelease(){calls.push(['confirmRelease']);block.pendingRelease=null;render();},
confirmHuntResult(){calls.push(['home']);}}};
view=createHuntResultView({root:document.querySelector('#cm-root'),source,hudArt:{getPortrait(id){const p=portraits.find(p=>p.id===id+':database-hero');return p?{src:'/'+p.src,width:148,height:148,nativeScale:1}:null;}}});
}
window.captureAQA={mount,get calls(){return calls;},error(code){block.commitError=code;render();},clearPortrait(){block.speciesId=null;render();},dispose(){view.dispose();},get block(){return block;}};mount();`;
fs.writeFileSync(path.join(temp,'entry.js'),entry);
(async()=>{
 const styles=[...fs.readFileSync(path.join(repo,'championship.html'),'utf8').matchAll(/<link rel="stylesheet" href="([^"?]+)[^"]*"/g)].map(m=>m[1].replace(/^\.\//,''));
 const html=`<!doctype html><html lang="zh-Hant" data-theme="arena"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map(s=>`<link rel="stylesheet" href="/${s}">`).join('')}<body><div id="cm-root"></div><script type="module" src="/.tmp/capture-a-review/entry.js"></script></body></html>`;
 const report={kind:'CONTROLLED_PRODUCTION_VIEW_NOT_FULL_NORMAL_GAME_FLOW',status:'RUNNING',conditions:[],checks:[],errors:[],frameRequests:[],privateRequests:[],newAssetBytes:9184};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browser=browser.version();
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
  let rel=decodeURIComponent(url.pathname).slice(1);
  if(!rel)return route.fulfill({contentType:'text/html',body:html});
  const full=path.resolve(repo,rel);if(!full.startsWith(repo+path.sep))return route.abort();
  if(!fs.existsSync(full))return route.abort();
  return route.fulfill({path:full,contentType:rel.endsWith('.js')?'text/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.css')?'text/css':rel.endsWith('.svg')?'image/svg+xml':rel.endsWith('.webp')?'image/webp':undefined});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/capture-frame-a-v1/'))report.frameRequests.push(r.url());if(/ART_PRODUCTION_INDEX|internal-faithful-baseline/.test(r.url()))report.privateRequests.push(r.url());});
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.captureAQA);
 report.initialFrameAssetRequests=new Set(report.frameRequests).size;assert.equal(report.initialFrameAssetRequests,1);
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
  await page.setViewportSize(viewport);
  await page.evaluate(({width,height})=>{delete document.body.dataset.desktopMenu;delete document.body.dataset.landscapeMenu;if(width>=1024)document.body.dataset.desktopMenu='';else if(width>height)document.body.dataset.landscapeMenu='';},viewport);
  for(const theme of ['arena','night','clear','warm','classic']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;captureAQA.mount();},theme);await page.locator('.cm-vs2-title').click();await page.waitForFunction(()=>[...document.querySelectorAll('.cm-original-capture-frame img')].every(i=>i.complete));
   const layout=await page.evaluate(()=>{const frame=document.querySelector('.cm-original-capture-frame'),portrait=document.querySelector('.cm-vs2-result__portrait'),art=document.querySelector('.cm-original-capture-frame__art'),home=document.querySelector('.cm-vs2-footer button'),f=frame.getBoundingClientRect(),p=portrait.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,frame:[f.width,f.height],portrait:[p.width,p.height],portraitInside:p.left>=f.left+20&&p.right<=f.right-20&&p.top>=f.top+20&&p.bottom<=f.bottom-20,artDecoded:art.complete&&art.naturalWidth===320,homeHeight:home.getBoundingClientRect().height,legacyPieces:document.querySelectorAll('.cm-memory-card-frame__piece').length};});
   report.conditions.push({...viewport,theme,...layout});
   const thumbnailGeometry=await page.locator('.cm-vs2-result__thumbnail img').evaluateAll(images=>images.map(img=>({image:img.getBoundingClientRect().toJSON(),parent:img.parentElement.getBoundingClientRect().toJSON()})));const thumbnailFits=thumbnailGeometry.every(({image:i,parent:p})=>i.left>=p.left-.1&&i.right<=p.right+.1&&i.top>=p.top-.1&&i.bottom<=p.bottom+.1);assert.equal(thumbnailFits,true,JSON.stringify({theme,thumbnailGeometry}));report.conditions[report.conditions.length-1].thumbnailFits=true;
   if(theme==='arena')await page.screenshot({path:path.join(output,`capture-a-${viewport.width}x${viewport.height}.png`),fullPage:true});
   assert.equal(layout.overflow,false,JSON.stringify(layout));assert.ok(layout.frame.every(n=>Math.abs(n-232)<.1),JSON.stringify(layout));assert.equal(layout.portraitInside,true,JSON.stringify(layout));assert.equal(layout.artDecoded,true);assert.equal(layout.legacyPieces,0);assert.ok(layout.homeHeight>=44);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{delete document.body.dataset.desktopMenu;delete document.body.dataset.landscapeMenu;document.documentElement.dataset.theme='arena';});
 for(const lang of ['zh-Hant','en','ja','th','vi']){await page.evaluate(lang=>captureAQA.mount(lang,true),lang);assert.equal(await page.locator('[data-name-key]').count(),2);assert.equal(await page.locator('.cm-original-capture-frame').getAttribute('data-frame-state'),'selected');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.checks.push('two-catch layout '+lang);}
 await page.evaluate(()=>captureAQA.mount('zh-Hant',true));
 await page.locator('.cm-vs2-title').click();await page.waitForTimeout(460);
 const input=page.locator('.cm-vs2-result__name-input');await input.fill('MiXeD 雪');await page.locator('[data-name-key="card:wild-2"]').click();
 assert.equal(await input.inputValue(),'Second Partner');assert.equal(await page.evaluate(()=>captureAQA.calls.some(c=>c[0]==='name'&&c[1]==='MiXeD 雪')),true);assert.match(await page.locator('.cm-vs2-result__portrait').getAttribute('src'),new RegExp(portraits[1].src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 await page.locator('[data-release-key="card:wild-2"]').click();assert.equal(await page.locator('.cm-original-capture-frame').getAttribute('data-frame-state'),'release-confirm');assert.equal(await page.locator('.cm-vs2-footer button').isDisabled(),true);await page.screenshot({path:path.join(output,'capture-a-release-confirm.png'),fullPage:true});
 await page.locator('.cm-original-capture-frame').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'capture-a-release-frame.png'),fullPage:true});
 await page.locator('.cm-vs2-result__release button').first().click();assert.equal(await page.locator('.cm-original-capture-frame').getAttribute('data-frame-state'),'selected');
 await page.locator('[data-release-key="card:wild-2"]').click();await page.locator('.cm-vs2-result__release button').last().click();assert.equal(await page.evaluate(()=>captureAQA.calls.some(c=>c[0]==='confirmRelease')),true);
 assert.equal(await page.locator('[data-release-key="home:home-1"]').isDisabled(),true);
 for(const error of ['SAVE_FAILED','HOME_ROSTER_FULL']){await page.evaluate(e=>captureAQA.error(e),error);assert.equal(await page.locator('.cm-vs2-footer [role=alert]').isVisible(),true);await page.locator('.cm-vs2-footer button').focus();await page.keyboard.press('Enter');}
 assert.equal(await page.evaluate(()=>captureAQA.calls.filter(c=>c[0]==='home').length),2);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>captureAQA.mount());assert.equal(await page.locator('.cm-vs2-shell').getAttribute('data-reveal-motion'),'reduced');assert.equal(await page.locator('.cm-vs2-shell').getAttribute('data-reveal'),'settled');report.checks.push('reduced-motion settled');
 await page.evaluate(()=>captureAQA.clearPortrait());assert.equal(await page.locator('.cm-vs2-result__portrait').isVisible(),false);await page.evaluate(()=>captureAQA.dispose());assert.equal(await page.locator('#cm-root').textContent(),'');
 report.checks.push('name preserved before selecting second catch','portrait follows selected ID','release confirm/cancel preserve intents','pending release disables home','protected home release disabled','SAVE_FAILED and roster-full visible; keyboard home retry','missing portrait hides image','dispose removes view');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.privateRequests,[]);assert.equal(new Set(report.frameRequests).size,3);report.status='PASS';
 }finally{await browser.close();fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({status:report.status,conditions:report.conditions.length,checks:report.checks.length,frameAssetRequests:new Set(report.frameRequests).size,privateRequests:report.privateRequests.length,errors:report.errors}));
})().catch(e=>{console.error(e);process.exitCode=1;});
