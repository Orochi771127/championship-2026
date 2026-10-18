import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {getActiveGameTitle,getTitleEyebrow} from '../src/championship/text/brandTerms.js';
import {selectTitleAsset} from '../src/championship/presentation/titleAssetVariant.js';
import {loadStylesheet} from '../src/championship/app/loadStylesheet.js';
import {isInstalledWebApp, mountWebAppInstall} from '../src/championship/app/webAppInstall.js';
import {titleViewportMetrics,readTitleViewportDiagnostics} from '../src/championship/app/portraitFrame.js';
import {DATA_ARENA_UPGRADES, previewDataArenaUpgrade, upgradeValue} from '../src/championship/modes/dataArena/dataArenaUpgrades.js';
import {createBattleFxCamera} from '../src/championship/presentation/battleFx/battleFxCamera.js';
import {DATA_ARENA_TEXT} from '../src/championship/text/dataArenaText.js';
import {assertPublicBytes} from '../scripts/lib/public-runtime-boundary.mjs';

test('title fills standalone viewport, follows browser chrome/keyboard, and respects zoom', () => {
  const win={innerHeight:852,navigator:{standalone:true},visualViewport:{height:818,scale:1,offsetTop:0}};
  const doc={documentElement:{clientHeight:818}};
  assert.deepEqual(titleViewportMetrics(win,doc),{height:852,top:0});
  win.navigator.standalone=false;
  assert.equal(titleViewportMetrics(win,doc).height,818);
  win.navigator.standalone=true;win.visualViewport.height=420;win.visualViewport.offsetTop=20;
  assert.deepEqual(titleViewportMetrics(win,doc,true),{height:420,top:20});
  win.visualViewport.scale=2;
  assert.deepEqual(titleViewportMetrics(win,doc),{height:852,top:0});
  delete win.visualViewport;
  assert.equal(titleViewportMetrics(win,doc).height,852);
});
test('on-demand viewport evidence records geometry and revision without reading storage',()=>{
 const view={innerWidth:393,innerHeight:798,navigator:{standalone:true},screen:{width:393,height:852},devicePixelRatio:3,
   visualViewport:{width:393,height:798,offsetTop:0,scale:1},getComputedStyle:()=>({backgroundColor:'rgb(218, 238, 230)',getPropertyValue:()=> '34px'})};
 Object.defineProperty(view,'localStorage',{get(){throw Error('MUST_NOT_READ_SAVE');}});
 const doc={documentElement:{clientWidth:393,clientHeight:798},body:{},querySelector:()=>null};
 const evidence=readTitleViewportDiagnostics(view,doc);
 assert.equal(evidence.revision,'PWA-20261018C');assert.equal(evidence.installed,true);
 assert.deepEqual(evidence.inner,[393,798]);assert.deepEqual(evidence.screen,[393,852]);assert.equal(evidence.safeBottom,'34px');
 assert.equal(evidence.build,'source');assert.equal(evidence.title,null);
});

function installFixture(ios=false) {
  const elements=[];
  function element(){const e=Object.assign(new EventTarget(),{hidden:false,open:false,setAttribute(){},append(){},remove(){this.removed=true;},focus(){},showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent(new Event('close'));}});elements.push(e);return e;}
  const view=Object.assign(new EventTarget(),{navigator:{userAgent:ios?'iPhone':'desktop'},matchMedia:()=>({matches:false,addEventListener(){}})});
  const title=element();title.ownerDocument={createElement:element};title.querySelector=()=>({append(){}});
  const dispose=mountWebAppInstall(title,view);
  return {view,trigger:elements[1],dialog:elements[2],dispose,elements};
}
test('install needs a real prompt event and click; dismissal is consumed, installed event hides it', async()=>{
  const f=installFixture();assert.equal(f.trigger.hidden,true);
  let calls=0,resolve;const choice=new Promise(r=>resolve=r);
  const event=new Event('beforeinstallprompt',{cancelable:true});
  event.prompt=()=>{calls++;return Promise.resolve();};event.userChoice=choice;
  f.view.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(calls,0);assert.equal(f.trigger.hidden,false);
  f.trigger.dispatchEvent(new Event('click'));f.trigger.dispatchEvent(new Event('click'));assert.equal(calls,1);
  resolve({outcome:'dismissed'});await new Promise(r=>setImmediate(r));assert.equal(f.trigger.hidden,true);
  f.view.dispatchEvent(new Event('appinstalled'));assert.equal(f.trigger.hidden,true);
  f.dispose();assert.ok(f.trigger.removed&&f.dialog.removed);
});
test('iPhone opens instructions, fake install events are ignored and installed iPhone adds no UI',()=>{
  const f=installFixture(true);assert.equal(f.trigger.hidden,false);
  const fake=new Event('beforeinstallprompt',{cancelable:true});f.view.dispatchEvent(fake);assert.equal(fake.defaultPrevented,false);
  f.trigger.dispatchEvent(new Event('click'));assert.equal(f.dialog.open,true);
  f.view.dispatchEvent(new Event('appinstalled'));assert.equal(f.dialog.open,false);assert.equal(f.trigger.hidden,true);f.dispose();
  assert.doesNotThrow(()=>mountWebAppInstall({}, {navigator:{standalone:true}})());
});

test('delivery choice covers portrait, DPR, landscape, saver and old markup', () => {
  const el = {dataset:{titleCompactSrc:'small', titleOptimizedSrc:'large'}};
  assert.equal(selectTitleAsset(el,'master',{innerWidth:390,innerHeight:844,devicePixelRatio:3}), 'small');
  assert.equal(selectTitleAsset(el,'master',{innerWidth:844,innerHeight:390,devicePixelRatio:2}), 'large');
  assert.equal(selectTitleAsset(el,'master',{innerWidth:1200,innerHeight:900,navigator:{connection:{saveData:true}}}), 'small');
  assert.equal(selectTitleAsset({dataset:{}},'master'), 'master');
});

function styleDocument() {
  const links = [];
  return {links, baseURI:'https://example.test/game/', head:{appendChild:link=>links.push(link)},
    createElement:() => Object.assign(new EventTarget(),{remove(){this.removed=true;}})};
}
test('concurrent stylesheet users wait together; failed load can actually retry', async () => {
  const document = styleDocument();
  const first = loadStylesheet('./arena.css',{document}), second = loadStylesheet('./arena.css',{document});
  assert.equal(first,second); assert.equal(document.links.length,1);
  const rejected = assert.rejects(first,/STYLESHEET_LOAD_FAILED/);
  document.links[0].dispatchEvent(new Event('error')); await rejected;
  assert.equal(document.links[0].removed,true);
  const retry = loadStylesheet('./arena.css',{document});
  assert.notEqual(retry,first); assert.equal(document.links.length,2);
  document.links[1].dispatchEvent(new Event('load')); await retry;
  assert.equal(loadStylesheet('./arena.css',{document}),retry);
});
test('stylesheet body timeout removes the failed link and late load cannot revive it', async () => {
  const document = styleDocument();
  await assert.rejects(loadStylesheet('./slow.css',{document,timeoutMs:5}),/TIMEOUT/);
  assert.equal(document.links[0].removed,true);
  const next = loadStylesheet('./slow.css',{document});
  document.links[0].dispatchEvent(new Event('load'));
  document.links[1].dispatchEvent(new Event('load')); await next;
});
test('upgrade preview reads the rules, keeps bonuses distinct, never mutates levels', () => {
  for (const upgrade of DATA_ARENA_UPGRADES) {
    const levels = Object.freeze({[upgrade.id]:Math.max(0,upgrade.max-1)});
    const snapshot=JSON.stringify(levels), preview=previewDataArenaUpgrade(levels,upgrade.id);
    assert.equal(preview.after,upgrade.max);
    for(const effect of preview.effects) {
      assert.equal(effect.before,upgradeValue(levels,effect.key));
      assert.equal(effect.after,upgradeValue({...levels,[upgrade.id]:upgrade.max},effect.key));
      for (const table of Object.values(DATA_ARENA_TEXT)) assert.ok(table[`effect.${effect.key}`]);
    }
    assert.equal(JSON.stringify(levels),snapshot);
    assert.equal(previewDataArenaUpgrade({[upgrade.id]:upgrade.max},upgrade.id).after,upgrade.max);
  }
  assert.deepEqual(previewDataArenaUpgrade({},'patch').effects,[{key:'heal',kind:'percent',before:0,after:.3}]);
  assert.equal(previewDataArenaUpgrade({},'unknown'),null);
});
test('dense hits cannot stack camera shake, heavy hit overrides medium, calm mode stays calm', () => {
  const camera=createBattleFxCamera();
  assert.equal(camera.impact('light'),false);
  assert.equal(camera.impact('medium'),true);
  for(let i=0;i<12;i++)assert.equal(camera.impact('medium'),false);
  assert.equal(camera.impact('heavy'),true); assert.equal(camera.impact('heavy'),false);
  camera.update({dtMs:200,viewport:{width:390,height:400},art:{x:0,y:0,width:390,height:400},subjects:[]});
  assert.equal(camera.impact('medium'),true);
  const calm=createBattleFxCamera({reducedMotion:true});
  assert.equal(calm.impact('heavy'),false); assert.equal(calm.getState().trauma,0);
});
test('manifest stays under its deployed subpath and installed contexts suppress the guide', () => {
  const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
  for(const base of ['https://example.test/','https://orochi771127.github.io/championship-2026/']) {
    for(const path of [manifest.start_url,manifest.scope,manifest.id,...manifest.icons.map(x=>x.src)]) {
      assert.ok(new URL(path,base).href.startsWith(base));
    }
  }
  assert.equal(isInstalledWebApp({navigator:{standalone:true}}),true);
  assert.equal(isInstalledWebApp({matchMedia:()=>({matches:true})}),true);
  assert.equal(isInstalledWebApp({navigator:{},matchMedia:()=>({matches:false})}),false);
});

test('web manifests receive the same schema and private-content checks as public JSON', () => {
  const bytes=fs.readFileSync('manifest.webmanifest');
  const jsonFields=['id','name','short_name','start_url','scope','display','background_color','theme_color','icons','src','sizes','type','purpose'];
  assert.doesNotThrow(()=>assertPublicBytes('manifest.webmanifest',bytes,{jsonFields}));
  assert.throws(()=>assertPublicBytes('manifest.webmanifest',bytes),/SCHEMA_REQUIRED/);
  assert.throws(()=>assertPublicBytes('manifest.webmanifest',Buffer.from('{"privateVaultReference":"hidden"}'),{jsonFields}),/PRIVATE_KEY/);
});

test('approved opaque icons and installation links agree without changing app identity',()=>{
  const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
  const html=fs.readFileSync('championship.html','utf8');
  const evidence=JSON.parse(fs.readFileSync('docs/reports/app-icon-2026-10-18/ICON_BYTES.json','utf8'));
  assert.equal(evidence.sourceSha256,'33f557a1549bbd82f97ff873f0be4b8370a16aa45138b0d55cc88602e34841c6');
  assert.equal(manifest.name,getActiveGameTitle('zh-Hant'));
  assert.equal(manifest.short_name,getTitleEyebrow('zh-Hant'));
  assert.ok(html.includes(`name="apple-mobile-web-app-title" content="${manifest.short_name}"`));
  assert.deepEqual([manifest.id,manifest.scope,manifest.start_url],['./','./','./championship.html']);
  const version='?v=icon-'+evidence.sourceSha256.slice(0,12);
  assert.ok(html.includes(`href="./manifest.webmanifest${version}"`));
  assert.ok(html.includes(`href="./assets/production/web-app/icon-180.png${version}"`));
  assert.deepEqual(manifest.icons.map(x=>x.src),[192,512].map(n=>`assets/production/web-app/icon-${n}.png${version}`));
  for(const row of evidence.files){
    const bytes=fs.readFileSync(row.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
    assert.equal(bytes.length,row.bytes);
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),row.width);assert.equal(bytes.readUInt32BE(20),row.height);
    assert.equal(bytes[24],8);assert.equal(bytes[25],2,'PNG must be opaque RGB');
  }
});
test('delivery assets fit the budget, retain masters, and enter the build allowlist', () => {
  const variants=JSON.parse(fs.readFileSync('assets/production/title-morning-r1/delivery/manifest.json'));
  const inputs=JSON.parse(fs.readFileSync('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'));
  for(const variant of ['compact','large']) {
    const rows=variants.files.filter(x=>x.path.endsWith(`-${variant}.webp`));
    assert.equal(rows.length,4); assert.ok(rows.reduce((sum,x)=>sum+x.bytes,0)<1000000);
  }
  for(const row of variants.files) {assert.ok(inputs.files.includes(row.path));assert.equal(fs.statSync(row.path).size,row.bytes);}
  assert.ok(inputs.files.includes('manifest.webmanifest'));
});
