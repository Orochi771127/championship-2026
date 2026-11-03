// Battle polish gate (Owner 2026-11-03), phone portrait 390 x 844, arcade theme.
//
// A normal Free Battle (three a side) from the QA save, run in real time:
//   1. the pre-battle screen has no native <select>; plans and arenas are chips;
//   2. outside the original special prelude, every standing fighter's drawn
//      body stays between the opponent cards and the player cards;
//   3. every special cut-in that is caught on screen carries a loaded portrait
//      whose face box lies below the opponent cards;
//   4. the result title paints with no text stroke and a light fill, and the
//      verdict panel carries the per-side summary.
// It writes screenshots for review; it never writes the Owner's save (it runs
// on its own origin -- CHAMPIONSHIP_QA_URL, default the isolated 8761 port).
//
// usage: node tests/championship-battle-polish-browser.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '..');
const {chromium} = require(repo + '/node_modules/playwright');
const url = new URL(process.env.CHAMPIONSHIP_QA_URL || 'http://127.0.0.1:8761/championship.html');
const out = require('./browser-qa-output.cjs')('battle-polish');
fs.mkdirSync(out, {recursive: true});
const seconds = Number(process.env.BATTLE_POLISH_SECONDS || 150);

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const report = {url: url.href, errors: [], samples: 0, violations: [], cutIns: [], selects: null, result: null};
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true});
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('pageerror', error => report.errors.push(error.message));
    const seed = fs.readFileSync(path.join(repo, 'qa/championship-full-qa-save.json'), 'utf8');
    await page.addInitScript(save => { if (sessionStorage.getItem('battle-polish-seeded')) return; sessionStorage.setItem('battle-polish-seeded', '1');
      localStorage.setItem('championshipModernSave:v1', save);
      localStorage.setItem('championshipModernSave:preferences:v1', JSON.stringify({locale: 'zh-Hant', muted: true, reducedMotion: 'off'})); }, seed);
    url.searchParams.set('battleFxDebug', '1');
    await page.goto(url.href, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false);
    await page.locator('#cm-login').click(); await page.locator('#cm-continue').click();
    await page.waitForFunction(() => document.querySelector('.int-rh2-field-host')?.dataset.loadState === 'ready', null, {timeout: 120000});
    const decline = page.locator('dialog.cm-dialog [data-action="decline"]'); if (await decline.count()) await decline.first().click().catch(() => {});
    await page.locator('button[data-menu-id="SYSTEM"]').click(); await page.locator('[data-entry-id="battle"]').click();
    await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]');
    await page.locator('.cm-vs5-cube__face[data-face-id="FREE_BATTLE"]').click(); await page.waitForTimeout(300);
    const three = page.locator('.cm-vs5-match__enter:not(:disabled)', {hasText: '三隻對戰'});
    assert.ok(await three.count(), 'the QA save offers a three-a-side Free Battle');
    await three.first().click();
    await page.waitForSelector('.cm-vs5-party button[data-instance-id]');
    const party = page.locator('.cm-vs5-party button[data-instance-id]:not(:disabled)');
    for (let i = 0; i < 3; i++) await party.nth(i).click();
    report.selects = await page.locator('.cm-vs5-root select').count();
    assert.equal(report.selects, 0, 'no native <select> on the pre-battle screen');
    assert.equal(await page.locator('.cm-vs5-tactic').count(), 3, 'one plan per chosen partner');
    // Special first for all three, so the match shows a cut-in.
    for (let i = 0; i < 3; i++) {
      const plan = page.locator('.cm-vs5-tactic').nth(i);
      await plan.locator('[data-value="0"]').click();
      assert.equal(await plan.getAttribute('data-value'), '0');
    }
    assert.ok(await page.locator('.cm-vs5-arena-chip').count() >= 2, 'the arena row is chips');
    assert.ok(await page.locator('.cm-vs5-party-row .cm-vs5-member__portrait img').count() >= 3, 'roster rows show portraits');
    await page.evaluate(() => document.querySelector('.cm-vs5-tactics')?.scrollIntoView({block: 'center'}));
    await page.screenshot({path: path.join(out, '1-prebattle.png')});
    await page.locator('.cm-vs5-footer .cm-vs5-action--primary').click();

    // While the arena loads, the HUD rows stay hidden behind the versus board.
    await page.waitForSelector('.cm-vs5-shell[data-screen="BATTLE_FIELD"], #cm-root[data-active-screen="BATTLE_FIELD"]');
    const loadingHud = await page.evaluate(() => {
      const shell = document.querySelector('.cm-vs5-shell');
      return shell?.dataset.loading === 'true' ? getComputedStyle(document.querySelector('.cm-vs5-roster--opponent')).visibility : 'ready';
    });
    assert.ok(['hidden', 'ready'].includes(loadingHud), `opponent cards during loading: ${loadingHud}`);
    await page.waitForSelector('.cm-vs5-field[aria-busy="false"]', {timeout: 180000});
    // The versus toast opens below the opponent cards, clear of the arena badge.
    const versus = await page.evaluate(() => {
      const toast = document.querySelector('.cm-vs5-field > .cm-ceremony[data-kind="versus"] .cm-cer-versus');
      const badge = document.querySelector('.cm-vs5-clock'), cards = document.querySelector('.cm-vs5-roster--opponent');
      return toast ? {top: toast.getBoundingClientRect().top, badge: badge.getBoundingClientRect().bottom, cards: cards.getBoundingClientRect().bottom} : null;
    });
    if (versus) { assert.ok(versus.top >= versus.badge - 1, `versus toast ${versus.top} overlaps the arena badge ${versus.badge}`); await page.screenshot({path: path.join(out, '4-opening.png')}); }

    // The first special's strip, caught once it has slid in (230 ms), with its portrait checked.
    const cutInShot = page.waitForSelector('.cm-cutin__band', {timeout: seconds * 1000}).then(async () => {
      await page.waitForTimeout(230);
      const cut = await page.evaluate(() => {
        const band = document.querySelector('.cm-cutin__band'), art = document.querySelector('.cm-cutin__face-art');
        const cards = document.querySelector('.cm-vs5-roster--opponent');
        return band && cards ? {bandTop: band.getBoundingClientRect().top, cardsBottom: cards.getBoundingClientRect().bottom,
          art: art ? {loaded: art.complete && art.naturalWidth > 0, src: art.getAttribute('src')} : null} : null;
      });
      if (cut) {
        report.cutIns.push(cut);
        // Freeze the strip on its resting frame for the review picture, then let it go on.
        await page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.cm-cutin')) { a.pause(); a.currentTime = 300; } });
        await page.screenshot({path: path.join(out, '3-cutin.png')});
        await page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.cm-cutin')) a.play(); });
      }
    }).catch(() => {});
    const started = Date.now(); let frame = 0, savedBattle = false;
    while (Date.now() - started < seconds * 1000) {
      if (await page.locator('#cm-root').getAttribute('data-active-screen') !== 'BATTLE_FIELD') break;
      const sample = await page.evaluate(() => {
        const d = globalThis.__championshipBattleDiagnostics?.(), fx = d?.dynamicFx;
        if (!document.querySelector('.cm-vs5-field') || !document.querySelector('.cm-vs5-roster--opponent')) return null;
        const field = document.querySelector('.cm-vs5-field').getBoundingClientRect();
        const cards = document.querySelector('.cm-vs5-roster--opponent').getBoundingClientRect();
        const ours = document.querySelector('.cm-vs5-roster--player').getBoundingClientRect();
        const band = document.querySelector('.cm-cutin__band'), art = document.querySelector('.cm-cutin__face-art');
        return {world: fx?.world ?? null, prelude: Boolean(d?.specialPrelude), bodies: fx?.bodies ?? [], fieldTop: field.top,
          cardsBottom: cards.bottom, oursTop: ours.top,
          cut: band ? {bandTop: band.getBoundingClientRect().top, cardsBottom: cards.bottom, art: art ? {loaded: art.complete && art.naturalWidth > 0, src: art.getAttribute('src')} : null} : null};
      });
      if (!sample) break;
      report.samples++;
      if (sample.world && !sample.prelude) for (const body of sample.bodies.filter(b => !b.down)) {
        const top = sample.fieldTop + sample.world.y + body.top * sample.world.zoom, bottom = sample.fieldTop + sample.world.y + body.groundY * sample.world.zoom;
        if (top < sample.cardsBottom - 1 || bottom > sample.oursTop + 1) report.violations.push({slot: body.slot, top: Math.round(top), bottom: Math.round(bottom), cards: Math.round(sample.cardsBottom), ours: Math.round(sample.oursTop)});
      }
      if (sample.cut) report.cutIns.push(sample.cut);
      else if (!savedBattle && sample.bodies.filter(b => !b.down).length >= 5 && frame > 20) { savedBattle = true; await page.screenshot({path: path.join(out, '2-battle.png')}); }
      frame++;
      await page.waitForTimeout(120);
    }
    await page.waitForSelector('#cm-root[data-active-screen="BATTLE_RESULT"]', {timeout: 240000});
    await cutInShot;
    await page.waitForTimeout(2500);
    report.result = await page.evaluate(() => {
      const title = document.querySelector('.cm-vs5-result__body .cm-vs5-title'), style = getComputedStyle(title);
      return {text: title.textContent, stroke: style.webkitTextStrokeWidth, fill: style.webkitTextFillColor, background: style.backgroundImage.slice(0, 40),
        summary: document.querySelectorAll('.cm-vs5-result__summary .cm-vs5-result__row:not(.cm-vs5-result__row--head)').length,
        verdict: document.querySelector('.cm-vs5-shell').dataset.verdict};
    });
    await page.screenshot({path: path.join(out, '5-result.png')});
    assert.equal(report.result.stroke, '0px', 'the result title carries no text stroke');
    assert.match(report.result.background, /gradient/, 'the result title is a light gradient face');
    assert.ok(report.result.summary >= 2, 'the verdict panel lists both sides');
    assert.ok(report.samples > 30, 'the battle was sampled');
    assert.ok(report.cutIns.length > 0, 'a special cut-in was shown and checked');
    assert.deepEqual(report.violations, [], 'a standing fighter went under a HUD row');
    for (const cut of report.cutIns) {
      assert.ok(cut.bandTop >= cut.cardsBottom - 6, `cut-in strip ${cut.bandTop} starts under the opponent cards (${cut.cardsBottom})`);
      if (cut.art) assert.ok(cut.art.loaded || !cut.art.src, `cut-in portrait failed: ${cut.art.src}`);
    }
    assert.deepEqual(report.errors, []);
    console.log(JSON.stringify({ok: true, samples: report.samples, cutIns: report.cutIns.length, result: report.result, out}));
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
