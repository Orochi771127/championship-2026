// Controlled browser coverage for UIA-03/04/06, not the full Login/Home/Shop
// route or physical-device acceptance. Real presenters, runtime, CSS and frame
// controller run on a disposable loopback origin; no player save is installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');
const {serveBuild} = require('./alternate-form-browser-support.cjs');

const root = path.resolve(__dirname, '..');
const output = require('./browser-qa-output.cjs')('ui-audit');
const entry = fs.readFileSync(path.join(root, 'championship.html'), 'utf8');
const links = [...entry.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*>/g)].map(match => match[0]);
const styleHrefs = links.map(link => /\bhref="([^"]+)"/.exec(link)[1]);
const importMap = entry.match(/<script\s+type="importmap">[\s\S]*?<\/script>/)?.[0] ?? '';
assert.ok(styleHrefs.length > 0, 'read the actual entry stylesheet order');
const profiles = [
  {viewport:{width:375,height:667},layout:{portraitFrame:false,desktopBrowse:false,landscapeMenu:false}},
  {viewport:{width:844,height:390},layout:{portraitFrame:false,desktopBrowse:true,landscapeMenu:true}},
  {viewport:{width:1363,height:936},layout:{portraitFrame:false,desktopBrowse:true,landscapeMenu:false}}
];

const fixtureModule = `
import {createShopView} from './src/championship/app/vs4Screens.js';
import {createShopRuntime} from './src/championship/shop/shopRuntime.js';
import {mountPortraitFrame} from './src/championship/app/portraitFrame.js';
import {setLocale} from './src/championship/text/locale.js';
const root = document.getElementById('cm-root');
let view, runtime;
const calls = {leave: 0, buy: []};
// The current app enables responsive menus by default. Use its controller,
// rather than adding fixture-only CSS to make a viewport pass.
const frame = mountPortraitFrame({responsiveMenus: true});
window.__uiAudit = {
  calls,
  mount({theme = 'night', scale = 100, locale = 'zh-Hant', category = 'CAGES', bits = 9999999} = {}) {
    view?.dispose();
    setLocale(locale);
    const html = document.documentElement;
    html.lang = locale;
    Object.assign(html.dataset, {theme, textScale: String(scale), motion: 'reduced', quality: 'balanced'});
    root.dataset.activeScreen = 'SHOP';
    runtime = createShopRuntime({bits, allItemsVisible: true});
    const source = {getFrame: () => ({screen: 'SHOP', shop: runtime.getFrame()}), intents: {
      leaveScreen() { calls.leave++; },
      buyShopItem(...args) { calls.buy.push(args); },
      upgradeHuntTool() {}, refillHuntTool() {}
    }};
    view = createShopView({root, source});
    root.querySelector('[data-category="' + category + '"]').click();
    return view.inspect();
  },
  inspect() { return view.inspect(); },
  repaint() { view.render({screen: 'SHOP', shop: runtime.getFrame()}); },
  dispose() { view?.dispose(); frame.dispose(); }
};
window.__uiAudit.mount();
window.__uiAudit.ready = true;
`;
const fixture = `<!doctype html><html lang="zh-Hant" data-theme="night" data-text-scale="100" data-motion="reduced"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Controlled Shop UI audit</title><link rel="icon" href="data:,">
${links.join('\n')}${importMap}</head><body><main id="cm-root" data-active-screen="SHOP"></main>
<script type="module">${fixtureModule}</script></body></html>`;

function checkSyntax() {
  const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], {input: fixtureModule, encoding: 'utf8'});
  assert.equal(checked.status, 0, checked.stderr || 'embedded fixture module syntax');
}
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('#cm-root img')].filter(image => {
      const r = image.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    }).map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

// Runs in Chromium. Contrast uses the final computed paint stack, including
// alpha, gradient stops and decoded background-image pixels. Channel bounds
// deliberately include every gradient/image color, so the reported minimum is
// conservative; it is not an antialiased glyph-pixel contrast measurement.
async function sampleShop() {
  const violations = [], rect = r => ({left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height});
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const painter = canvas.getContext('2d', {willReadFrequently:true});
  const color = css => {
    painter.clearRect(0, 0, 1, 1); painter.fillStyle = css; painter.fillRect(0, 0, 1, 1);
    const value = [...painter.getImageData(0, 0, 1, 1).data]; value[3] /= 255; return value;
  };
  const bounds = colors => ({min:[0,1,2,3].map(i => Math.min(...colors.map(c => c[i]))), max:[0,1,2,3].map(i => Math.max(...colors.map(c => c[i])))});
  const over = (fg, bg) => {
    const candidates = [0,1,2].map(i => {
      const values = [];
      for (const a of [fg.min[3], fg.max[3]]) for (const f of [fg.min[i], fg.max[i]]) for (const b of [bg.min[i], bg.max[i]]) values.push(f * a + b * (1-a));
      return values;
    });
    return {min:candidates.map(v => Math.min(...v)).concat(1), max:candidates.map(v => Math.max(...v)).concat(1)};
  };
  const layers = value => {
    const parts = []; let depth = 0, quote = '', start = 0, escaped = false;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
    }
    parts.push(value.slice(start).trim()); return parts.filter(p => p !== 'none');
  };
  const imageCache = window.__uiAuditImageBounds ??= new Map();
  async function imageBounds(layer) {
    if (layer.includes('gradient(')) {
      if (/\bin\s+(?!srgb\b)[\w-]+/.test(layer)) throw new Error('Unmodelled gradient interpolation: ' + layer);
      const colors = layer.match(/(?:rgba?|color)\([^()]*\)/g)?.map(color) ?? [];
      if (colors.length < 2) throw new Error('Unmodelled computed gradient: ' + layer);
      return bounds(colors);
    }
    const match = /^url\((["']?)(.*?)\1\)$/.exec(layer);
    if (!match) throw new Error('Unmodelled computed background: ' + layer);
    const href = match[2];
    if (!imageCache.has(href)) imageCache.set(href, (async () => {
      const image = new Image(); image.src = href; await image.decode();
      if (image.naturalWidth * image.naturalHeight > 4_000_000) throw new Error('Background too large for bounded color sampling');
      const tile = document.createElement('canvas'); tile.width = image.naturalWidth; tile.height = image.naturalHeight;
      const ctx = tile.getContext('2d', {willReadFrequently:true}); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, tile.width, tile.height).data;
      const result = {min:[255,255,255,1], max:[0,0,0,0]};
      for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 4; c++) {
        const value = c === 3 ? pixels[i+c] / 255 : pixels[i+c];
        result.min[c] = Math.min(result.min[c], value); result.max[c] = Math.max(result.max[c], value);
      }
      return result;
    })());
    return imageCache.get(href);
  }
  async function paintedBackground(node) {
    const ancestry = []; for (let e = node; e; e = e.parentElement) ancestry.unshift(e);
    let painted = bounds([[255,255,255,1]]);
    for (const element of ancestry) {
      const css = getComputedStyle(element);
      if (Number(css.opacity) !== 1 || css.filter !== 'none' || css.mixBlendMode !== 'normal') throw new Error('Unmodelled opacity/filter/blend on ' + element.className);
      painted = over(bounds([color(css.backgroundColor)]), painted);
      for (const layer of layers(css.backgroundImage).reverse()) painted = over(await imageBounds(layer), painted);
    }
    return painted;
  }
  const luminance = rgb => rgb.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4)
    .reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0);
  async function contrastOf(effect) {
    const css = getComputedStyle(effect), bg = await paintedBackground(effect), fg = over(bounds([color(css.color)]), bg);
    const f = [luminance(fg.min),luminance(fg.max)], b = [luminance(bg.min),luminance(bg.max)];
    const minimum = f[0] > b[1] ? (f[0]+.05)/(b[1]+.05) : b[0] > f[1] ? (b[0]+.05)/(f[1]+.05) : 1;
    return {minimum, foreground:css.color, background:css.backgroundColor, backgroundBounds:bg,
      cardBackground:getComputedStyle(effect.closest('.cm-vs2-shop__row')).background,
      text:effect.textContent, fontSize:parseFloat(css.fontSize)};
  }
  const effects = [...document.querySelectorAll('.cm-vs2-shop__effect')];
  let textRectsChecked = 0, wrappedEffects = 0;
  const fonts = new Set();
  for (const effect of effects) {
    const box = effect.getBoundingClientRect(), card = effect.closest('.cm-vs2-shop__row').getBoundingClientRect();
    const css = getComputedStyle(effect); fonts.add(parseFloat(css.fontSize));
    if (effect.scrollWidth > effect.clientWidth + 2 || effect.scrollHeight > effect.clientHeight + 2 || box.left < card.left - 2 || box.right > card.right + 2 || box.bottom > card.bottom + 2) {
      violations.push({kind:'effect-box-overflow',text:effect.textContent,box:rect(box),card:rect(card),scroll:[effect.scrollWidth,effect.scrollHeight],client:[effect.clientWidth,effect.clientHeight]});
    }
    const walker = document.createTreeWalker(effect, NodeFilter.SHOW_TEXT); let text; const tops = new Set();
    while ((text = walker.nextNode())) {
      if (!text.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      for (const r of range.getClientRects()) {
        textRectsChecked++; tops.add(Math.round(r.top));
        if (r.left < box.left - 2 || r.right > box.right + 2 || r.top < box.top - 2 || r.bottom > box.bottom + 2) violations.push({kind:'effect-text-clipped',text:text.textContent,textBox:rect(r),effectBox:rect(box)});
      }
    }
    if (tops.size > 1) wrappedEffects++;
  }
  for (const node of [document.documentElement, document.querySelector('.cm-vs2-shop__shelf'), document.querySelector('.cm-vs2-shop__list')]) {
    if (node.scrollWidth > node.clientWidth + 2) violations.push({kind:'horizontal-overflow',node:node.className || node.tagName,scroll:node.scrollWidth,client:node.clientWidth});
  }
  const contrast = {};
  for (const [state, value] of [['selected','true'],['unselected','false']]) {
    const effect = document.querySelector('.cm-vs2-shop__row[data-selected="'+value+'"] .cm-vs2-shop__effect');
    if (!effect) throw new Error('Missing ' + state + ' effect sample');
    contrast[state] = await contrastOf(effect);
  }
  return {effectCount:effects.length,textRectsChecked,wrappedEffects,fontSizes:[...fonts],contrast,violations,
    layout:{portraitFrame:document.body.hasAttribute('data-portrait-frame'),desktopBrowse:document.body.hasAttribute('data-desktop-browse'),landscapeMenu:document.body.hasAttribute('data-landscape-menu')}};
}

async function reachable(locator, {button = false} = {}) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((node, requireButtonHit) => {
    const r = node.getBoundingClientRect();
    let left = Math.max(0,r.left), right = Math.min(innerWidth,r.right), top = Math.max(0,r.top), bottom = Math.min(innerHeight,r.bottom);
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), p = parent.getBoundingClientRect();
      if (/(hidden|clip|auto|scroll)/.test(css.overflowX)) {left=Math.max(left,p.left);right=Math.min(right,p.right);}
      if (/(hidden|clip|auto|scroll)/.test(css.overflowY)) {top=Math.max(top,p.top);bottom=Math.min(bottom,p.bottom);}
    }
    const hit = right > left && bottom > top ? document.elementFromPoint((left+right)/2,(top+bottom)/2) : null;
    return {text:node.innerText,box:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
      whollyVisible:left<=r.left+2&&right>=r.right-2&&top<=r.top+2&&bottom>=r.bottom-2,
      textFits:node.scrollWidth<=node.clientWidth+2&&node.scrollHeight<=node.clientHeight+2,
      receivesPointer:!!hit&&(node.contains(hit)||(!requireButtonHit&&hit.contains(node))),disabled:node.disabled ?? false};
  }, button);
  assert.ok(result.whollyVisible && result.textFits && result.receivesPointer, JSON.stringify(result));
  if (button && !result.disabled) await locator.click({trial:true});
  return result;
}

async function detailKeyboardChecks(page) {
  await page.evaluate(() => window.__uiAudit.mount({category:'TRAINING_GOODS',theme:'night',scale:130}));
  await settle(page);
  const cards = page.locator('.cm-vs2-shop__list > .cm-vs2-shop__row');
  const buy = page.locator('.cm-vs2-shop__buy'), close = page.locator('.cm-vs2-shop__close'), back = page.locator('.cm-vs2-footer button');
  await cards.first().click();
  const firstName = await page.locator('.cm-vs2-shop__detail-name').innerText();
  assert.equal(await page.getByRole('dialog',{name:firstName,exact:true}).isVisible(),true);
  assert.equal(await page.locator('.cm-vs2-shop__detail').getAttribute('aria-modal'),'false');
  assert.equal(await buy.evaluate(e => document.activeElement === e),true);
  const bought = await page.evaluate(() => window.__uiAudit.calls.buy.length);
  await buy.click();
  assert.equal(await page.evaluate(() => window.__uiAudit.calls.buy.length),bought+1);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await close.evaluate(e => document.activeElement === e),true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await back.evaluate(e => document.activeElement === e),true,'real Tab reaches background navigation');
  assert.equal(await page.locator('.cm-vs2-shop__sheet').isVisible(),true);
  const before = await page.evaluate(() => window.__uiAudit.calls.leave);
  await page.evaluate(() => window.__uiAudit.repaint());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cm-vs2-shop__sheet').isVisible(),false);
  assert.equal(await page.locator('.cm-vs2-shop__row[data-selected="true"]').evaluate(e => document.activeElement === e),true);
  assert.equal(await page.evaluate(() => window.__uiAudit.calls.leave),before);
  await cards.nth(1).click();
  const secondName = await page.locator('.cm-vs2-shop__detail-name').innerText();
  assert.notEqual(secondName,firstName);
  assert.equal(await page.getByRole('dialog',{name:secondName,exact:true}).isVisible(),true);
  await close.click();
  assert.equal(await page.locator('.cm-vs2-shop__row[data-selected="true"]').evaluate(e => document.activeElement === e),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__uiAudit.calls.leave),before+1);
  await page.evaluate(() => window.__uiAudit.mount({category:'HUNT_ITEMS',theme:'night',scale:130}));
  await settle(page); await page.locator('.cm-shop-family').first().click();
  assert.equal(await buy.isVisible(),false);
  assert.equal(await buy.isDisabled(),false,'exercise hidden but enabled Buy');
  assert.equal(await close.evaluate(e => document.activeElement === e),true);
  return {firstName,secondName,namedNonmodal:true,tabToBackground:true,escapeBeforeBack:true,liveOpenerRestored:true,closeClickable:true,buyIntentDelivered:true,hiddenBuyFocusVisible:true};
}

async function run() {
  fs.mkdirSync(output,{recursive:true});
  const report = {schemaVersion:1,status:'RUNNING',generatedAt:new Date().toISOString(),scope:'CONTROLLED_SHOP_COMPONENT_BROWSER',
    normalLoginHomeRoute:false,physicalDeviceAccepted:false,contrastMethod:'Computed paint-stack channel bounds; gradients and decoded background images included; not glyph-pixel sampling',
    sourceHashes:Object.fromEntries(['championship.html','src/championship/app/vs4Screens.js','src/championship/app/ui/screenLayout.css'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),
    styleOrder:styleHrefs,cases:[],locales:[],keyboard:[],screenshots:[],errors:[],missing:[],blockedExternal:[]};
  let server, browser, currentPage;
  try {
    server = await serveBuild(root);
    report.origin = server.origin;
    browser = await chromium.launch({headless:true,...(process.env.CHAMPIONSHIP_CHROME_PATH?{executablePath:process.env.CHAMPIONSHIP_CHROME_PATH}:{})});
    report.browser = browser.version();
    for (const {viewport,layout:expectedLayout} of profiles) {
      const context = await browser.newContext({viewport,hasTouch:viewport.width<1024,deviceScaleFactor:1,reducedMotion:'reduce'});
      const page = currentPage = await context.newPage(); let closing = false;
      page.setDefaultTimeout(15000);
      page.on('pageerror',error=>report.errors.push({viewport,message:error.message,stack:error.stack}));
      page.on('response',response=>{if(response.status()>=400)report.missing.push({url:response.url(),status:response.status()});});
      page.on('requestfailed',request=>{if(!closing)report.errors.push({kind:'requestfailed',url:request.url(),error:request.failure()});});
      await context.route('**/*',route=>{
        const url = new URL(route.request().url());
        if(url.origin!==server.origin){report.blockedExternal.push(url.href);return route.abort();}
        if(url.pathname==='/ui-audit-fixture.html')return route.fulfill({contentType:'text/html',body:fixture});
        return route.continue();
      });
      try {
        await page.goto(server.origin+'/ui-audit-fixture.html',{waitUntil:'load'});
        await page.waitForFunction(()=>window.__uiAudit?.ready);
        const loaded = await page.evaluate(()=>[...document.styleSheets].filter(sheet=>sheet.ownerNode?.tagName==='LINK').map(sheet=>sheet.href));
        assert.deepEqual(loaded,styleHrefs.map(href=>new URL(href,server.origin+'/ui-audit-fixture.html').href));
        for (const theme of ['night','arcade','arena','clear','warm','classic']) for (const scale of [100,115,130]) {
          report.currentCheck = {phase:'palette-size-layout',viewport,theme,scale};
          await page.evaluate(options=>window.__uiAudit.mount(options),{theme,scale});
          await page.mouse.move(0,0); await settle(page);
          const sample = await page.evaluate(sampleShop), item = {viewport,theme,scale,...sample};
          report.cases.push(item);
          assert.deepEqual(sample.layout,expectedLayout,'the viewport must keep its native-size shop layout');
          assert.ok(sample.effectCount>1 && sample.textRectsChecked>0,'real cage effect text rendered');
          assert.deepEqual(sample.violations,[],JSON.stringify(item));
          const expected = (viewport.height<=500 && viewport.width>viewport.height?11:12)*scale/100;
          for(const value of sample.fontSizes)assert.ok(Math.abs(value-expected)<.03,`${theme}/${scale}: ${value}px, expected ${expected}px`);
          for(const [state,value] of Object.entries(sample.contrast))assert.ok(value.minimum>=4.5,`${theme}/${state}: ${value.minimum.toFixed(3)}:1; ${JSON.stringify(value)}`);
          if(theme==='night'&&scale===130&&viewport.width===375){const file='night-shop-375x667-130.png';await page.screenshot({path:path.join(output,file)});report.screenshots.push(file);}
        }
        for(const locale of ['zh-Hant','en','ja','th','vi']) {
          report.currentCheck = {phase:'locale-reachability',viewport,theme:'arcade',scale:130,locale};
          await page.evaluate(options=>window.__uiAudit.mount(options),{theme:'arcade',scale:130,locale});
          await settle(page);
          const sample = await page.evaluate(sampleShop);
          assert.deepEqual(sample.layout,expectedLayout,'translated shop must keep the expected layout');
          assert.deepEqual(sample.violations,[],JSON.stringify({viewport,locale,...sample}));
          const expected = (viewport.height<=500 && viewport.width>viewport.height?11:12)*1.3;
          for(const value of sample.fontSizes)assert.ok(Math.abs(value-expected)<.03,`${locale}: ${value}px, expected ${expected}px`);
          const index = await page.locator('.cm-vs2-shop__row[data-cage-card="true"]').evaluateAll(nodes=>nodes.map((node,index)=>({index,length:node.querySelector('.cm-vs2-shop__effect')?.textContent.length??0})).sort((a,b)=>b.length-a.length)[0].index);
          const card = page.locator('.cm-vs2-shop__row[data-cage-card="true"]').nth(index);
          const effect = await reachable(card.locator('.cm-vs2-shop__effect'));
          const lastEffect = await reachable(page.locator('.cm-vs2-shop__row[data-cage-card="true"]').last().locator('.cm-vs2-shop__effect'));
          const cardName = await card.locator('.cm-vs2-shop__name strong').innerText();
          await card.click(); await settle(page);
          const name = await page.locator('.cm-vs2-shop__detail-name').innerText();
          assert.equal(name,cardName,'full card product name remains available in the detail');
          assert.equal(await page.getByRole('dialog',{name,exact:true}).isVisible(),true);
          const title = await reachable(page.locator('.cm-vs2-shop__detail-name'));
          const close = await reachable(page.locator('.cm-vs2-shop__close'),{button:true});
          const buy = await reachable(page.locator('.cm-vs2-shop__buy'),{button:true});
          const back = await reachable(page.locator('.cm-vs2-footer button'),{button:true});
          report.locales.push({viewport,locale,scale:130,effectCount:sample.effectCount,textRectsChecked:sample.textRectsChecked,wrappedEffects:sample.wrappedEffects,name,title,effect,lastEffect,close,buy,back});
          if(locale==='th'&&viewport.width===844){const file='thai-detail-844x390-130.png';await page.screenshot({path:path.join(output,file)});report.screenshots.push(file);}
          const leaves = await page.evaluate(()=>window.__uiAudit.calls.leave);
          await page.locator('.cm-vs2-footer button').click();
          assert.equal(await page.evaluate(()=>window.__uiAudit.calls.leave),leaves+1,'visible background Back sends the existing intent');
        }
        report.currentCheck = {phase:'native-keyboard',viewport};
        report.keyboard.push({viewport,...await detailKeyboardChecks(page)});
      } catch(error) {
        await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
        throw error;
      } finally { closing = true; await context.close(); currentPage = null; }
    }
    assert.deepEqual(report.errors,[]);
    assert.deepEqual(report.missing,[]);
    assert.deepEqual(report.blockedExternal,[]);
    assert.equal(report.screenshots.length,2);
    delete report.currentCheck;
    report.status='PASS';
  } catch(error) {
    report.status='FAIL'; report.failure={message:error.message,stack:error.stack}; process.exitCode=1;
    if(currentPage)await currentPage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    console.error(error);
  } finally {
    await browser?.close().catch(()=>{});
    await server?.close();
    report.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,cases:report.cases.length,locales:report.locales.length,keyboard:report.keyboard.length,receipt:path.join(output,'result.json')}));
  }
}

if(require.main===module){
  checkSyntax();
  if(process.argv.includes('--check-only'))console.log('UI audit outer/embedded syntax checked; browser not launched.');
  else run().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={fixtureModule,styleHrefs};
