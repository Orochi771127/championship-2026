import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectTitleAsset} from '../src/championship/presentation/titleAssetVariant.js';
import {loadStylesheet} from '../src/championship/app/loadStylesheet.js';
import {isInstalledWebApp} from '../src/championship/app/webAppInstall.js';
import {DATA_ARENA_UPGRADES, previewDataArenaUpgrade, upgradeValue} from '../src/championship/modes/dataArena/dataArenaUpgrades.js';
import {createBattleFxCamera} from '../src/championship/presentation/battleFx/battleFxCamera.js';
import {DATA_ARENA_TEXT} from '../src/championship/text/dataArenaText.js';
import {assertPublicBytes} from '../scripts/lib/public-runtime-boundary.mjs';

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
