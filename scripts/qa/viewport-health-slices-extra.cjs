// Slice 6 of the full-game viewport health check (2026-11-11 three-layout audit).
//
// Title menu, partner list, schedule, help, badges, settings, backpack, journal, Journey,
// championship and the end-of-day ceremony: every page the first five slices do not open.
'use strict';
const { ranchSpec, rosterSpec, qaSave, markExit, home, reveal, systemEntry, STATUS, SAVE_KEY } = require('./viewport-health-slices.cjs');

const PAGE_BASE = ['#cm-root', '.cm-status-bar', '.cm-toolbar'];
const shown = (locator, timeout = 6000) => locator.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);

async function managementEntry(run, entry, state, what) {
  await home(run);
  await run.tap('button.cm-toolbar__cell[data-menu-id="MANAGEMENT"]', { state, what: '管理' });
  const target = `.cm-toolbar__menu[data-menu-id="MANAGEMENT"] [data-entry-id="${entry}"]`;
  await reveal(run, target);
  await run.tap(target, { state, what });
}

/** A full page with a footer exit: measured whole. */
async function pageCheck(run, state, extra = {}) {
  await markExit(run, extra.exitScope ?? '#cm-root');
  await run.check(state, {
    groups: { status: STATUS, footer: '.cm-screen-footer, .cm-vs2-footer, .cm-vs5-footer', ...(extra.groups ?? {}) },
    primary: ['[data-vh-exit]', ...(extra.primary ?? [])],
    mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }, ...(extra.mustSee ?? [])],
    lists: extra.lists ?? [], exclude: extra.exclude ?? [], allowOverlap: extra.allowOverlap ?? []
  });
}

/** A top-layer dialog or sheet: measured in its own scope. */
async function sheetCheck(run, state, scope, extra = {}) {
  await run.page.locator(scope).first().waitFor({ state: 'visible', timeout: 10000 });
  await run.settle(700);
  if (!extra.closer) await markExit(run, scope);
  await run.check(state, {
    scope: [scope], primary: [`${scope} button`],
    mustSee: [{ selector: extra.closer ?? '[data-vh-exit]', role: 'exit' }, ...(extra.mustSee ?? [])],
    lists: extra.lists ?? [], centered: extra.centered ?? [], exclude: extra.exclude ?? []
  });
}

async function leaveByExit(run, state, what) {
  await markExit(run, '#cm-root');
  await run.tap('[data-vh-exit]', { state, what });
  await run.waitHome(30000);
}

/** Back to the ranch through whatever exit the current page shows (a step may have stopped half-way). */
async function forceHome(run) {
  const exits = ['dialog[open] .cm-dialog__action[data-action="close"]', '.cm-settings__close', '.cm-sheet__close', '.cm-journey__back', '.cm-championship-root .cm-screen-back',
    '.cm-screen-footer .cm-screen-back', '.cm-vs5-exit:not([hidden])', '.cm-vs2-footer .cm-vs2-action:not(.cm-vs2-action--primary)'];
  for (let i = 0; i < 8; i += 1) {
    if (await run.screen() === 'RAISING_HOME' && !(await run.page.locator('dialog[open]').count())) return;
    for (const selector of exits) {
      const key = run.page.locator(selector).first();
      if (await key.isVisible().catch(() => false)) { await key.click({ timeout: 3000 }).catch(() => {}); break; }
    }
    await run.settle(900);
  }
}

const noDialog = page => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 }).catch(() => {});

async function slice6(run, { repo }) {
  const { page } = run;
  // A. Title: LOGIN, then the menu with a stored save (measured, never changed).
  const entered = await run.step('title', async () => {
    await page.goto(`${run.origin}/qa/championship-full-qa-save.json`);
    await page.evaluate(([key, text]) => { localStorage.clear(); localStorage.setItem(key, text); }, [SAVE_KEY, JSON.stringify(qaSave(repo))]);
    await page.goto(`${run.origin}/championship.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false);
    await page.locator('#cm-opening-film video').evaluateAll(videos => { for (const video of videos) video.playbackRate = 8; });
    await page.waitForFunction(() => { const film = document.querySelector('#cm-opening-film'); return !film || film.hidden; }, null, { timeout: 55000 });
    await run.check('title-login', { scope: ['#cm-title'], mustSee: [{ selector: '#cm-login' }], primary: ['#cm-login'] });
    await page.click('#cm-login');
    await page.waitForLoadState('networkidle');
    await run.settle(900);
    await run.check('title-menu', { scope: ['#cm-title'], mustSee: [{ selector: '#cm-continue' }, { selector: '#cm-new-game' }], primary: ['#cm-continue', '#cm-new-game'] });
    await run.tap('#cm-continue', { state: 'title-menu', what: '繼續遊戲' });
    await run.waitHome();
    await run.settle(900);
  });
  if (!entered) return;
  run.intervalBaseline = await run.intervals();

  // B. Partner list: first partner, another partner, the rename editor.
  await run.step('roster', async () => {
    await managementEntry(run, 'digimon', 'roster', '夥伴名單');
    await run.waitScreen('DIGIMON_LIST');
    await page.locator('.cm-digimon-detail').waitFor({ state: 'visible', timeout: 8000 });
    await run.check('roster', rosterSpec());
    const items = page.locator('.cm-digimon-item__button');
    if (await items.count() > 2) { await items.nth(2).click(); await run.check('roster-other', rosterSpec()); }
    const rename = page.locator('.cm-digimon-control:not([disabled])').first();
    if (await rename.isVisible().catch(() => false)) {
      await rename.click();
      await run.settle(500);
      if (await page.locator('.cm-digimon-rename:not([hidden])').first().isVisible().catch(() => false)) {
        await run.check('roster-rename', {
          groups: { status: STATUS, editor: '.cm-digimon-rename:not([hidden])', footer: '.cm-screen-footer' },
          primary: ['.cm-digimon-rename__actions button'],
          mustSee: [{ selector: '.cm-digimon-rename:not([hidden]) .cm-screen-back', role: 'exit' }, { selector: '.cm-digimon-rename:not([hidden]) .cm-screen-primary' }]
        });
        await page.locator('.cm-digimon-rename:not([hidden]) .cm-screen-back').first().click().catch(() => {});
      }
    }
    await run.tap('.cm-digimon-back', { state: 'roster', what: '返回牧場' });
    await run.waitHome(30000);
  });

  // C. Schedule and one fixture's sheet.
  await run.step('schedule', async () => {
    await managementEntry(run, 'schedule', 'schedule', '賽程');
    await run.waitScreen('SCHEDULE');
    await run.settle(900);
    await pageCheck(run, 'schedule', { primary: ['.cm-schedule-fixture'], lists: [{ container: '.cm-schedule-shell', item: '.cm-schedule-fixture, .cm-schedule-day', covers: ['.cm-screen-footer'] }] });
    const fixture = page.locator('.cm-schedule-fixture').first();
    if (await fixture.isVisible().catch(() => false)) {
      await fixture.click();
      if (await shown(page.locator('.cm-sheet'), 5000)) {
        await sheetCheck(run, 'schedule-detail', '.cm-sheet');
        await run.tap('[data-vh-exit]', { state: 'schedule-detail', what: '關閉賽事說明' });
        await run.settle(500);
      }
    }
    await leaveByExit(run, 'schedule', '返回牧場');
  });

  // D. Help and one topic.
  await run.step('help', async () => {
    await systemEntry(run, 'help', 'help', '說明');
    await run.waitScreen('HELP');
    await run.settle(900);
    await pageCheck(run, 'help', { primary: ['.cm-help-topic'], lists: [{ container: '.cm-help-shell', item: '.cm-help-topic', covers: ['.cm-screen-footer'] }] });
    const topic = page.locator('.cm-help-topic').first();
    if (await topic.isVisible().catch(() => false)) {
      await topic.click();
      if (await shown(page.locator('.cm-sheet'), 5000)) {
        await sheetCheck(run, 'help-topic', '.cm-sheet');
        await run.tap('[data-vh-exit]', { state: 'help-topic', what: '關閉說明' });
        await run.settle(500);
      }
    }
    await leaveByExit(run, 'help', '返回牧場');
  });

  // E. Badge collection and one badge.
  await run.step('medals', async () => {
    await systemEntry(run, 'medals', 'medals', '徽章收藏');
    await run.waitScreen('MEDALS');
    await run.settle(1500);
    await pageCheck(run, 'medals', { primary: ['.cm-medals__tile'], lists: [{ container: '.cm-vs2-root, .cm-vs2-shell', item: '.cm-medals__tile', covers: ['.cm-vs2-footer'] }] });
    const tile = page.locator('.cm-medals__tile').first();
    if (await tile.isVisible().catch(() => false)) {
      await tile.click();
      if (await shown(page.locator('dialog[open]'))) {
        await sheetCheck(run, 'medal-detail', 'dialog[open]');
        await run.tap('[data-vh-exit]', { state: 'medal-detail', what: '關閉徽章' });
        await noDialog(page);
      }
    }
    await leaveByExit(run, 'medals', '返回牧場');
  });

  // F. Settings: every category.
  await run.step('settings', async () => {
    await systemEntry(run, 'settings', 'settings', '設定');
    await page.locator('dialog.cm-settings[open]').waitFor({ state: 'visible', timeout: 10000 });
    await run.settle(700);
    const spec = () => ({
      scope: ['dialog.cm-settings[open]'], primary: ['.cm-settings__close', '.cm-settings__nav button', '.cm-settings__action'],
      mustSee: [{ selector: '.cm-settings__close', role: 'exit' }],
      lists: [{ container: 'dialog.cm-settings[open]', item: '.cm-settings__content > *, .cm-settings__content button, .cm-settings__content label', covers: [] }]
    });
    await run.check('settings', spec());
    const count = await page.locator('.cm-settings__nav button').count();
    for (let i = 0; i < count; i += 1) {
      const key = page.locator('.cm-settings__nav button').nth(i);
      // On a phone the categories are a list; a category opens its own page with a back key.
      if (!(await key.isVisible().catch(() => false))) await page.locator('.cm-settings__back').first().click().catch(() => {});
      await run.settle(250);
      if (!(await key.isVisible().catch(() => false))) continue;
      await key.click();
      await run.settle(450);
      await run.check(`settings-${i + 1}`, spec());
    }
    await page.locator('.cm-settings__close').first().click();
    await noDialog(page);
    await run.check('settings-closed', { residue: { baseLayers: PAGE_BASE }, expectScreen: 'RAISING_HOME' });
  });

  // G. Backpack: every tab.
  await run.step('backpack', async () => {
    await systemEntry(run, 'backpack', 'backpack', '背包');
    await page.locator('dialog[open] .cm-backpack').waitFor({ state: 'visible', timeout: 10000 });
    // The dialog's own 關閉 key (the tab keys' class name also reads as "back").
    const closer = 'dialog[open] .cm-dialog__action[data-action="close"]';
    const lists = [{ container: 'dialog[open]', item: '.cm-backpack__item', covers: [] }];
    await sheetCheck(run, 'backpack', 'dialog[open]', { lists, closer });
    const tabs = await page.locator('.cm-backpack__tab').count();
    for (let i = 1; i < tabs; i += 1) {
      await page.locator('.cm-backpack__tab').nth(i).click();
      await run.settle(350);
      await sheetCheck(run, `backpack-tab-${i + 1}`, 'dialog[open]', { lists, closer });
    }
    await run.tap(closer, { state: 'backpack', what: '關閉背包' });
    await noDialog(page);
    await run.check('backpack-closed', { residue: { baseLayers: PAGE_BASE }, expectScreen: 'RAISING_HOME' });
  });

  // H. Exploration journal from the menu.
  await run.step('journal', async () => {
    await systemEntry(run, 'journal', 'journal', '探索手帳');
    await sheetCheck(run, 'journal', 'dialog[open]');
    await run.tap('[data-vh-exit]', { state: 'journal', what: '關閉手帳' });
    await noDialog(page);
  });

  // I. Battle modes the fourth slice does not enter.
  const battleMenu = async () => {
    if (await run.screen() !== 'BATTLE_SELECT') {
      await home(run);
      await run.tap('.cm-toolbar__quick-entry[data-quick-id="battle"]', { state: 'battle-menu', what: '對戰' });
      await run.waitScreen('BATTLE_SELECT');
    }
    await page.locator('.cm-vs5-cube__canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  };
  const turnTo = async (face, state) => {
    for (let turn = 0; turn < 10; turn += 1) {
      if (await page.locator('.cm-vs5-prism__caption').getAttribute('data-face-id') === face) return true;
      await run.tap('.cm-vs5-prism__turn--next', { state, what: '下一個模式' });
      await run.settle(450);
    }
    return false;
  };
  for (const [face, state] of [['TITLE_MATCH', 'battle-title-match'], ['PRACTICE_BATTLE', 'battle-practice']]) {
    await run.step(state, async () => {
      await battleMenu();
      if (!(await turnTo(face, state))) return;
      await run.settle(600);
      await run.check(state, {
        groups: { status: STATUS, title: '.cm-vs5-header, .cm-vs2-header', footer: '.cm-vs5-footer, .cm-screen-footer' },
        primary: ['.cm-vs5-prism__turn', '.cm-vs5-exit', '.cm-vs5-match__enter'],
        mustSee: [{ selector: '.cm-vs5-exit', role: 'exit' }, { selector: '.cm-vs5-prism__turn--next' }]
      });
    });
  }
  await run.step('journey', async () => {
    await battleMenu();
    if (!(await turnTo('JOURNEY', 'journey'))) { run.fail('journey', 4, 'UNREACHABLE', '稜鏡上找不到「征途」'); return; }
    await run.tap('.cm-vs5-cube__canvas', { state: 'journey', what: '征途' });
    await page.locator('.cm-journey').first().waitFor({ state: 'visible', timeout: 15000 });
    await run.settle(900);
    const spec = () => ({
      scope: ['.cm-journey'], primary: ['.cm-journey__tab', '.cm-journey button'],
      mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }, { selector: '.cm-journey__tab' }],
      // The journey is a full-screen layer over the battle menu; the status pills lie under it.
      groups: { head: '.cm-journey__head', tabs: '.cm-journey__tabs' },
      lists: [{ container: '.cm-journey', item: '.cm-journey__floor, .cm-journey__stage, .cm-journey__pod, .cm-journey__reward', covers: ['.cm-screen-footer', '.cm-vs5-footer'] }]
    });
    await markExit(run, '.cm-journey');
    await run.check('journey', spec());
    const tabs = await page.locator('.cm-journey__tab').count();
    for (let i = 1; i < tabs; i += 1) {
      await page.locator('.cm-journey__tab').nth(i).click();
      await run.settle(500);
      await markExit(run, '.cm-journey');
      await run.check(`journey-tab-${i + 1}`, spec());
    }
    await markExit(run, '.cm-journey');
    await run.tap('[data-vh-exit]', { state: 'journey', what: '離開征途' });
    await run.settle(900);
  });
  await run.step('championship', async () => {
    await forceHome(run);
    await battleMenu();
    if (!(await turnTo('CHAMPIONSHIP', 'championship'))) return;
    await run.tap('.cm-vs5-cube__canvas', { state: 'championship', what: '錦標賽' });
    if (!(await shown(page.locator('.cm-championship-root'), 10000))) return;
    await run.settle(900);
    await pageCheck(run, 'championship', {
      exitScope: '.cm-championship-root', primary: ['.cm-championship-action'],
      lists: [{ container: '.cm-championship-shell', item: '.cm-championship-entry, .cm-championship-action', covers: ['.cm-screen-footer'] }]
    });
    await markExit(run, '.cm-championship-root');
    await run.tap('[data-vh-exit]', { state: 'championship', what: '離開錦標賽' });
    await run.settle(900);
  });

  // J. End of day. With the real-time clock (the product's clock) the partners simply rest:
  // no ceremony opens, so the ranch itself is measured after the key.
  await run.step('end-day', async () => {
    await forceHome(run);
    await managementEntry(run, 'endDay', 'end-day', '結束今天');
    await run.settle(1500);
    if (await shown(page.locator('dialog[open]'), 1500)) {
      await run.check('end-day-confirm', { scope: ['dialog[open]'], primary: ['dialog[open] button'], mustSee: [{ selector: 'dialog[open] button' }], centered: ['dialog[open]'] });
      await page.locator('dialog[open] button').last().click().catch(() => {});
      await run.settle(1500);
    }
    await forceHome(run);
    await run.check('end-day-home', ranchSpec());
  });
}

const EXTRA_SLICES = Object.freeze({
  6: { title: '標題選單、夥伴名單、賽程、說明、徽章、設定、背包、征途、錦標賽與結束今天', run: slice6, evidence: ['roster', 'schedule', 'help', 'medals', 'settings', 'backpack', 'journey', 'championship'] }
});

module.exports = { EXTRA_SLICES };
