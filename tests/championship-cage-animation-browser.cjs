// Isolated QA save, normal menus/placement/pan, then real rendered lava pixels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const { startGame } = require('./championship-browser-opening.cjs');
const output = require('./browser-qa-output.cjs')('cage-animation');
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8741';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [], missing = [], frameRequests = new Set();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => {
    if (response.status() >= 400) missing.push(response.url());
    if (/field_cm07_01\/frame-0[01]\.png$/.test(response.url())) frameRequests.add(response.url());
  });
  try {
    await page.goto(`${origin}/full-qa-save.html`, { waitUntil: 'networkidle' });
    await page.getByText('QA 存檔已驗證，可以安裝。', { exact: true }).waitFor();
    await page.locator('#install').click();
    await startGame(page, { continueGame: true });
    await page.locator('.cm-raising-pixi-canvas').waitFor();
    await page.locator('button[data-menu-id="SYSTEM"]').click();
    await page.locator('[data-entry-id="shop"]').click();
    await page.locator('.cm-vs2-shop__tab').filter({ hasText: '籠子設施' }).click();
    await page.locator('.cm-vs2-shop__row').filter({ has: page.locator('strong').filter({ hasText: /^火山$/ }) }).click();
    assert.equal(await page.locator('.cm-vs2-shop__detail-name').innerText(), '火山');
    await page.getByRole('button', { name: '返回牧場', exact: true }).click();
    await page.locator('button[data-menu-id="MANAGEMENT"]').click();
    await page.locator('[data-entry-id="cageEdit"]').click();
    await page.locator('.cm-cage-facility').first().waitFor();
    while (await page.locator('.cm-cage-facility:not(:disabled)').count()) {
      const count = await page.locator('.cm-cage-facility:not(:disabled)').count();
      await page.locator('.cm-cage-facility:not(:disabled)').first().click();
      await page.waitForFunction(c => document.querySelectorAll('.cm-cage-facility:not(:disabled)').length < c, count);
    }
    await page.locator('.cm-vs2-cage-tray__item').filter({ has: page.locator('.cm-vs2-cage-tray__name').filter({ hasText: /^火山$/ }) }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.cm-vs2-cage-tray__item[data-selected="true"]')].some(n => n.querySelector('.cm-vs2-cage-tray__name').textContent === '火山'));
    await page.locator('.cm-vs2-cage-slot[data-slot-index="4"]').click();
    await page.waitForFunction(() => document.querySelector('.cm-vs2-cage-slot[data-slot-index="4"]')?.title === '火山');
    await page.locator('.cm-vs2-action--primary').click();
    await page.getByRole('button', { name: '返回育成基地', exact: true }).click();
    await page.locator('.cm-raising-pixi-canvas').waitFor();
    await page.waitForTimeout(600);
    const host = page.locator('.int-rh2-field-host');
    const box = await host.boundingBox();
    // Normal drag puts the newly placed upper-row volcano in view.
    for (let i = 0; i < 2; i++) {
      await page.mouse.move(box.x + box.width - 25, box.y + 65);
      await page.mouse.down();
      await page.mouse.move(box.x + 40, box.y + 65, { steps: 24 });
      await page.mouse.up();
    }
    await page.waitForTimeout(150);
    for (let i = 0; i < 8; i++) {
      await host.screenshot({ path: path.join(output, `lava-${i}.png`) });
      await page.waitForTimeout(250);
    }
    const analysis = spawnSync('python', ['-c', `
import json,sys
from pathlib import Path
from PIL import Image
p=Path(sys.argv[1]); frames=[Image.open(p/f'lava-{i}.png').convert('RGB') for i in range(8)]
w,h=frames[0].size
moving=0; lava=0
for y in range(int(h*.55),int(h*.94)):
 for x in range(int(w*.08),int(w*.85)):
  colors=[im.getpixel((x,y)) for im in frames]
  if all(r>170 and b<90 and r>g for r,g,b in colors):
   lava+=1
   if len(set(colors))>1: moving+=1
assert lava>100, f'LAVA_NOT_VISIBLE:{lava}'
assert moving>20, f'LAVA_NOT_ANIMATING:{moving}'
print(json.dumps({'visibleLavaPixels':lava,'changingLavaPixels':moving,'samples':8}))
`, output], { encoding: 'utf8' });
    assert.equal(analysis.status, 0, analysis.stderr);
    assert.equal(frameRequests.size, 2, 'normal ranch loader fetches both volcano frames');
    assert.equal(await page.locator('canvas').count(), 1);
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    await page.screenshot({ path: path.join(output, 'normal-ranch-volcano.png') });
    const report = { status: 'PASS', method: 'ISOLATED_QA_SAVE_NORMAL_SHOP_CAGE_PLACEMENT_PAN_AND_SCREENSHOT_PIXELS',
      viewport: { width: 1024, height: 1366 }, frames: [...frameRequests], pixelCheck: JSON.parse(analysis.stdout),
      oneCanvas: true, errors, missing, physicalDeviceAccepted: false, originalCpuCompositionAccepted: false };
    fs.writeFileSync(path.join(output, 'browser-qa.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('CAGE_ANIMATION_BROWSER_PASS', analysis.stdout.trim());
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
