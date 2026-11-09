// The five vertical slices of the full-game viewport health check.
//
// Each slice reaches its screens through the game's own buttons (gate 4) and
// hands each screen to `run.check(state, spec)`. Specs name what this screen
// must never let collide (groups), what must stay tappable (mustSee), which
// lists must clear their footer (lists) and what is the stage (stage).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const opening = require('../../tests/championship-browser-opening.cjs');

class Unreachable extends Error {}

const SAVE_KEY = 'championshipModernSave:v1';

// ---- Shared HUD vocabulary -------------------------------------------------------------
const STATUS = '.cm-status-bar__season, .cm-status-bar__day, .cm-status-bar__time, .cm-status-bar__currencies, .cm-status-bar__matches:not([hidden]), .cm-status-bar__save:not([hidden])';
const RANCH_GROUPS = Object.freeze({
  status: STATUS,
  notice: '.int-rh2-resident-assets:not([hidden])',
  journal: '.int-rh2-discoveries:not([hidden])',
  hint: '.int-rh2-hint',
  card: '.int-rh2-companion[data-open="true"]',
  quick: '.cm-toolbar__quick:not([hidden]) .cm-toolbar__quick-entry',
  rail: '.cm-toolbar__rail'
});
const QUICK = ['hunt', 'battle', 'shop', 'database'].map(id => ({ selector: `.cm-toolbar__quick-entry[data-quick-id="${id}"]` }));
const MENUS = ['MANAGEMENT', 'SYSTEM'].map(id => ({ selector: `button.cm-toolbar__cell[data-menu-id="${id}"]` }));
const EXIT_TEXT = /^(?:[<‹←＜]\s*)?(?:返回|關閉|離開|完成|確定|好|取消|×|✕|✖|╳|X)/;

function ranchSpec(extra = {}) {
  return {
    groups: { ...RANCH_GROUPS, ...(extra.groups ?? {}) },
    // The resident-art notice is a transient load message, not standing HUD: it is checked for
    // collisions (groups) but not counted against the stage share.
    stage: { hud: Object.entries({ ...RANCH_GROUPS, ...(extra.groups ?? {}) }).filter(([name]) => name !== 'notice').map(([, selector]) => selector) },
    primary: ['.cm-toolbar__quick-entry', '.cm-toolbar__cell', ...(extra.primary ?? [])],
    mustSee: [...QUICK, ...MENUS, ...(extra.mustSee ?? [])],
    exclude: ['.cm-ranch-three-canvas', '.cm-title__walker'],
    ...extra.more
  };
}

// ---- Fixtures --------------------------------------------------------------------------
/** The repository's full QA save, optionally with three pending ranch discoveries. */
function qaSave(repo, { discoveries = false } = {}) {
  const save = JSON.parse(fs.readFileSync(path.join(repo, 'qa', 'championship-full-qa-save.json'), 'utf8'));
  if (discoveries) {
    const assignments = Object.entries(save.raising?.assignments ?? {}).filter(([id]) => id.includes(':instance:'));
    const participants = assignments.slice(0, 3).map(([id, cageId]) => ({ id, cageId }));
    const kinds = ['food', 'bits', 'herb'];
    save.raising.nativeHome = {
      ...save.raising.nativeHome,
      discoveries: { version: 1, lastAt: Date.now(), carryMs: 0, sequence: 3, collected: 0, participants,
        pending: kinds.map((kind, index) => ({ id: index + 1, kind, partnerId: participants[index % participants.length].id, cageId: participants[index % participants.length].cageId })) }
    };
  }
  return save;
}

/** Write a save into the isolated origin, then enter through LOGIN → Continue. */
async function continueWith(run, save, { query = '' } = {}) {
  const { page } = run;
  await page.goto(`${run.origin}/qa/championship-full-qa-save.json`);
  // `null` installs the origin's own fixture: another branch may carry another save schema.
  await page.evaluate(async ([key, text]) => {
    const value = text ?? (await (await fetch('/qa/championship-full-qa-save.json', { cache: 'no-store' })).text()).trim();
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, save === null ? null : JSON.stringify(save)]);
  await page.goto(`${run.origin}/championship.html${query}`, { waitUntil: 'networkidle' });
  await opening.login(page);
  await run.tap('#cm-continue', { state: 'title-continue', what: '繼續遊戲' });
  await run.waitHome();
  await run.settle(900);
}

async function home(run) {
  if (await run.screen() === 'RAISING_HOME' && !(await run.page.locator('dialog[open]').count())) return;
  await run.page.keyboard.press('Escape').catch(() => {});
  await run.waitHome(30000);
}

/**
 * Mark the visible exit control inside `scope` so the probe can verify it. Views that
 * re-render every frame replace the marked node, so the run re-marks it right before
 * each probe or tap that names [data-vh-exit].
 */
async function markExit(run, scope) {
  run.remark = () => tagExit(run.page, scope);
  return run.remark();
}
function tagExit(page, scope) {
  return page.evaluate(([scopeSelector, pattern]) => {
    document.querySelectorAll('[data-vh-exit]').forEach(n => n.removeAttribute('data-vh-exit'));
    const re = new RegExp(pattern);
    const roots = [...document.querySelectorAll(scopeSelector)];
    const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility === 'visible' && cs.display !== 'none'; };
    for (const root of roots) {
      const candidates = [...root.querySelectorAll('button, [role="button"], a[href]')].filter(visible);
      const hit = candidates.find(b => re.test((b.innerText || '').trim()) || re.test(b.getAttribute('aria-label') || '') || /close|back|exit/i.test(`${b.className} ${b.dataset.action ?? ''}`));
      if (hit) { hit.setAttribute('data-vh-exit', ''); return (hit.innerText || hit.getAttribute('aria-label') || '').trim().slice(0, 20); }
    }
    return null;
  }, [scope, EXIT_TEXT.source]);
}

/**
 * Touch the ranch where a player would look for a partner. Resident positions
 * are only published in the developer presentation, which also changes other
 * screens, so the probe taps a grid of open ground instead, centre first.
 */
async function selectResident(run, skip = 0) {
  const { page } = run;
  const points = await page.evaluate(() => {
    const out = [];
    // Partners stand on the ranch, which is smaller than a desktop window: a denser grid there.
    const cols = innerWidth > 1200 ? 13 : 8, rows = innerWidth > 1200 ? 9 : 7;
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const x = innerWidth * (0.12 + 0.76 * c / (cols - 1)), y = innerHeight * (0.18 + 0.56 * r / (rows - 1));
      if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') out.push({ x, y, d: Math.hypot(x - innerWidth / 2, y - innerHeight * 0.45) });
    }
    return out.sort((a, b) => a.d - b.d);
  });
  for (const point of points) {
    // Re-check right before the tap: a card or notice that appeared meanwhile is not the field.
    if (!(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS', point))) continue;
    if (run.viewport.kind === 'desktop') await page.mouse.click(point.x, point.y);
    else await page.touchscreen.tap(point.x, point.y);
    const opened = await page.locator('.int-rh2-companion[data-open="true"]').waitFor({ state: 'visible', timeout: 700 }).then(() => true, () => false);
    if (opened) {
      // Another partner: step with the card's own next key rather than tapping the field again.
      for (let i = 0; i < skip; i += 1) await page.locator('.int-rh2-companion__actions .int-rh2-companion__nav').last().click().catch(() => {});
      return;
    }
  }
  run.fail('ranch-card', 4, 'UNREACHABLE', '畫面上找不到可點選的夥伴（夥伴資訊卡打不開）');
  throw new Unreachable('resident');
}

// ---- Slice 1: ranch hub, partner card, journal, facility editor -------------------------
const CAGE_GROUPS = Object.freeze({
  status: STATUS,
  title: '.cm-vs2-title, .cm-vs2-header',
  counter: '.cm-hexworld__counter',
  keys: '.cm-hexworld__keys',
  help: '.cm-cage-help',
  buyLand: '.cm-hexworld__buy-land',
  selection: '.cm-hexworld__selection:not(:empty)',
  filters: '.cm-cage-filters',
  tray: '.cm-vs2-cage-tray',
  footer: '.cm-vs2-footer'
});
function cageSpec(extra = {}) {
  return {
    groups: CAGE_GROUPS,
    allowOverlap: [['keys', 'counter']],
    exclude: ['.cm-hexworld__cell', '.cm-hexworld__ghost'],
    primary: ['.cm-hexworld__zoom', '.cm-hexworld__revert', '.cm-cage-filter', '.cm-vs2-footer .cm-vs2-action', '.cm-hexworld__actions .cm-vs2-action'],
    mustSee: [{ selector: '.cm-vs2-footer .cm-vs2-action', role: 'exit' }, { selector: '.cm-hexworld__zoom' }, { selector: '.cm-cage-filter' }],
    // At native zoom a hex row is 56px: the board shows at least three and a half rows (200px)
    // and a quarter of the screen; zoom and 全覽 do the rest.
    areas: [{ selector: '.cm-hexworld__viewport', minRatio: 0.25, minHeightPx: 200 }],
    ...extra
  };
}

async function slice1(run, { repo }) {
  const { page } = run;
  // A. The New Game opening: tamer name, gift letters, egg choice, egg name.
  await run.step('opening', async () => {
    await page.goto(`${run.origin}/championship.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await opening.login(page);
    await run.tap('#cm-new-game', { state: 'title-new-game', what: '新遊戲' });
    const replace = page.locator('dialog.cm-dialog [data-action="new"]');
    if (await replace.isVisible().catch(() => false)) await replace.click();
    await page.locator('.cm-opening-story').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await run.check('opening-story', { primary: [] });
    for (let i = 0; i < 40 && !(await page.locator('.cm-opening__envelope').count()); i += 1) {
      await page.locator('.cm-opening-story').click({ force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
    await run.check('opening-envelope', { mustSee: [{ selector: '.cm-opening__envelope' }] });
    await run.tap('.cm-opening__envelope', { state: 'opening-envelope', what: '信封' });
    await page.locator('.cm-opening__letter button').waitFor();
    await run.check('opening-letter', { mustSee: [{ selector: '.cm-opening__letter button' }], primary: ['.cm-opening__letter button'] });
    await run.tap('.cm-opening__letter button', { state: 'opening-letter', what: '信件按鈕' });
    await page.locator('#cm-opening-name').waitFor();
    await run.check('opening-tamer-name', { mustSee: [{ selector: '#cm-opening-name' }, { selector: '.cm-opening__name button[type=submit]' }], primary: ['.cm-opening__name button[type=submit]'] });
    await page.fill('#cm-opening-name', '健檢');
    await run.tap('.cm-opening__name button[type=submit]', { state: 'opening-tamer-name', what: '確認名字' });
    await page.locator('.cm-opening__choices button').first().waitFor();
    await run.check('opening-tamer-confirm', { mustSee: [{ selector: '.cm-opening__choices button' }], primary: ['.cm-opening__choices button'] });
    await run.tap('.cm-opening__choices button', { state: 'opening-tamer-confirm', what: '是' });
    await run.tap('.cm-opening__envelope', { state: 'opening-gift', what: '禮物信封' });
    await page.locator('.cm-opening__letter button').waitFor();
    await run.check('opening-gift-letter', { mustSee: [{ selector: '.cm-opening__letter button' }], primary: ['.cm-opening__letter button'] });
    await run.tap('.cm-opening__letter button', { state: 'opening-gift-letter', what: '下一封' });
    await page.waitForTimeout(300);
    await run.tap('.cm-opening__letter button', { state: 'opening-gift-letter-2', what: '收下禮物' });
    if (await page.locator('.cm-opening__egg-choice').waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
      await run.check('opening-egg-choice', { mustSee: [{ selector: '[data-egg-confirm]' }], primary: ['[data-egg-confirm]'] });
      await page.locator('input[name="starterEgg"][value="0"]').check();
      await run.tap('[data-egg-confirm]', { state: 'opening-egg-choice', what: '確認蛋' });
    }
    await page.locator('#cm-opening-name').waitFor();
    await run.check('opening-egg-name', { mustSee: [{ selector: '#cm-opening-name' }, { selector: '.cm-opening__name button[type=submit]' }], primary: ['.cm-opening__name button[type=submit]'] });
    await page.fill('#cm-opening-name', '小蛋');
    await run.tap('.cm-opening__name button[type=submit]', { state: 'opening-egg-name', what: '確認蛋的名字' });
    await run.waitHome();
    const decline = page.locator('dialog.cm-dialog [data-action="decline"]');
    if (await decline.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
      await run.check('tutorial-invite', { scope: ['dialog[open]'], mustSee: [{ selector: 'dialog.cm-dialog [data-action="decline"]' }], primary: ['dialog[open] .cm-dialog__action'] });
      await decline.click();
      await page.locator('.cm-tutorial-guidance').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    }
    await run.check('ranch-fresh', ranchSpec());
  });

  // B. The ranch with the full QA save and three pending discoveries.
  if (!(await run.step('qa-save', () => continueWith(run, qaSave(repo, { discoveries: true }))))) return;
  run.intervalBaseline = await run.intervals();
  await run.step('ranch-home', () => run.check('ranch-home', ranchSpec({ mustSee: [{ selector: '.int-rh2-discoveries' }] })));
  await run.step('ranch-card', async () => {
    await selectResident(run, 0);
    const spec = ranchSpec({ primary: ['.int-rh2-companion__nav', '.int-rh2-companion__close'],
      mustSee: [{ selector: '.int-rh2-companion__close', role: 'exit' }, { selector: '.int-rh2-companion__nav' }] });
    await run.check('ranch-card', spec);
    // The disclosure toggle shares the nav class: take the › key itself.
    const next = page.locator('.int-rh2-companion__actions .int-rh2-companion__nav[data-direction="next"]');
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await run.check('ranch-card-next', spec);
    }
    const toggle = page.locator('.int-rh2-companion__toggle');
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await run.check('ranch-card-expanded', spec);
      await toggle.click().catch(() => {});
    }
  });
  await run.step('ranch-detail', async () => {
    if (!(await page.locator('.int-rh2-companion[data-open="true"]').isVisible().catch(() => false))) await selectResident(run, 1);
    await run.tap('.int-rh2-companion__copy', { state: 'ranch-detail', what: '夥伴詳細' });
    await page.locator('.int-rh2-detail[open]').waitFor({ state: 'visible', timeout: 8000 });
    await markExit(run, '.int-rh2-detail[open]');
    await run.check('ranch-detail', { scope: ['.int-rh2-detail[open]'], mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }], primary: ['[data-vh-exit]'] });
    await run.tap('[data-vh-exit]', { state: 'ranch-detail', what: '關閉夥伴詳細' });
    await page.locator('.int-rh2-detail[open]').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.int-rh2-companion__close').click().catch(() => {});
    await run.check('ranch-detail-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME', intervalBaseline: run.intervalBaseline });
  });
  await run.step('ranch-journal', async () => {
    await run.tap('.int-rh2-discoveries', { state: 'ranch-journal', what: '逛街手札信封' });
    await page.locator('dialog[open]').waitFor({ state: 'visible', timeout: 8000 });
    await markExit(run, 'dialog[open]');
    await run.check('ranch-journal', { scope: ['dialog[open]'], mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }], primary: ['dialog[open] .cm-dialog__action'] });
    await run.tap('[data-vh-exit]', { state: 'ranch-journal', what: '關閉手札' });
    await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
    await run.check('ranch-journal-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME', intervalBaseline: run.intervalBaseline });
  });
  for (const menu of ['SYSTEM', 'MANAGEMENT']) {
    await run.step(`menu-${menu.toLowerCase()}`, async () => {
      await home(run);
      await run.tap(`button.cm-toolbar__cell[data-menu-id="${menu}"]`, { state: `menu-${menu.toLowerCase()}`, what: menu === 'SYSTEM' ? '選單' : '管理' });
      const panel = `.cm-toolbar__menu[data-menu-id="${menu}"]:not([hidden])`;
      await page.locator(panel).waitFor({ state: 'visible', timeout: 5000 });
      await run.check(`menu-${menu.toLowerCase()}`, {
        scope: [panel, '.cm-toolbar__rail', '.cm-toolbar__quick'],
        groups: { menu: panel, quick: RANCH_GROUPS.quick, rail: RANCH_GROUPS.rail, status: STATUS },
        primary: [`${panel} .cm-toolbar__entry`],
        mustSee: [{ selector: `${panel} .cm-toolbar__entry` }, { selector: `button.cm-toolbar__cell[data-menu-id="${menu}"]`, role: 'exit' }],
        lists: [{ container: panel, item: '.cm-toolbar__entry, .cm-passport__provider, .cm-social-key, .cm-passport-strip__more', covers: ['.cm-toolbar__rail', '.cm-toolbar__quick:not([hidden])'] }]
      });
      await run.tap(`button.cm-toolbar__cell[data-menu-id="${menu}"]`, { state: `menu-${menu.toLowerCase()}`, what: '收起選單', force: true }).catch(() => {});
      await page.locator(panel).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await run.check(`menu-${menu.toLowerCase()}-closed`, { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
    });
  }
  await run.step('cage-edit', async () => {
    await home(run);
    await run.tap('button.cm-toolbar__cell[data-menu-id="MANAGEMENT"]', { state: 'cage-edit', what: '管理' });
    await run.tap('[data-entry-id="cageEdit"]', { state: 'cage-edit', what: '設施配置' });
    await run.waitScreen('CAGE_EDIT');
    await page.locator('.cm-hexworld__viewport').waitFor({ state: 'visible', timeout: 15000 });
    await run.check('cage-edit', cageSpec());
    const placed = page.locator('.cm-hexworld__cell[data-filled="true"][data-fixed="false"][data-instance-id]');
    if (await placed.count()) {
      await placed.first().click({ force: true });
      await page.locator('.cm-hexworld__actions').waitFor({ state: 'visible', timeout: 5000 });
      await run.check('cage-select', cageSpec({ mustSee: [{ selector: '.cm-hexworld__actions .cm-vs2-action' }, { selector: '.cm-vs2-footer .cm-vs2-action', role: 'exit' }] }));
      await page.locator('.cm-hexworld__actions .cm-vs2-action').last().click();
    }
    for (const filter of ['2-3', '4-5', 'placed', '1']) {
      const chip = `.cm-cage-filter[data-filter="${filter}"]`;
      if (!(await page.locator(chip).count())) continue;
      await run.tap(chip, { state: `cage-filter-${filter}`, what: `篩選 ${filter}` });
      await run.check(`cage-filter-${filter}`, cageSpec({ lists: [] }));
    }
    await run.tap('.cm-vs2-footer .cm-vs2-action:not(.cm-vs2-action--primary)', { state: 'cage-exit', what: '返回牧場' });
    const leave = page.locator('dialog.cm-dialog [data-action="discard"], dialog.cm-dialog [data-action="leave"]');
    if (await leave.isVisible().catch(() => false)) await leave.click();
    await run.waitHome(30000);
    await run.check('cage-exit', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
  });
}

// ---- Slice 2: shop, Cyber Gachapon, 5-in-1 furnace, chip bag ----------------------------
const SHOP_GROUPS = Object.freeze({
  status: STATUS,
  title: '.cm-vs2-header',
  tabs: '.cm-vs2-shop__tabs',
  footer: '.cm-vs2-footer'
});
function shopSpec(extra = {}) {
  return {
    groups: { ...SHOP_GROUPS, ...(extra.groups ?? {}) },
    allowOverlap: extra.allowOverlap ?? [],
    primary: ['.cm-vs2-shop__tab', '.cm-vs2-footer .cm-vs2-action', ...(extra.primary ?? [])],
    mustSee: [{ selector: '.cm-vs2-footer .cm-vs2-action', role: 'exit' }, { selector: '.cm-vs2-shop__tab' }, ...(extra.mustSee ?? [])],
    lists: extra.lists ?? [],
    stage: extra.stage,
    exclude: extra.exclude ?? []
  };
}
const GACHA_CONFIRM = '.cm-gacha__reveal-actions .cm-gacha__action--primary';

async function waitReveal(run, count) {
  const { page } = run;
  await page.locator('.cm-gacha__reveal:not([hidden])').first().waitFor({ state: 'visible', timeout: 20000 });
  // The stage deals one card per prize; let the deal finish, then wait for the confirm key.
  await page.waitForFunction(n => document.querySelectorAll('.cm-gacha__reveal:not([hidden]) .cm-gacha__cards > *').length >= n, count, { timeout: 30000 });
  await page.locator(GACHA_CONFIRM).first().waitFor({ state: 'visible', timeout: 30000 });
  await run.settle(1200);
}

async function slice2(run, { repo }) {
  const { page } = run;
  if (!(await run.step('qa-save', () => continueWith(run, qaSave(repo))))) return;
  run.intervalBaseline = await run.intervals();
  await run.step('shop', async () => {
    await run.tap('.cm-toolbar__quick-entry[data-quick-id="shop"]', { state: 'shop', what: '商店' });
    await run.waitScreen('SHOP');
    await page.locator('.cm-vs2-shop__tab').first().waitFor({ state: 'visible' });
    for (const category of ['TRAINING_GOODS', 'HUNT_ITEMS', 'CAGES']) {
      await run.tap(`.cm-vs2-shop__tab[data-category="${category}"]`, { state: `shop-${category.toLowerCase()}`, what: `商店頁籤 ${category}` });
      await page.locator('.cm-vs2-shop__list .cm-vs2-shop__row').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
      await run.check(`shop-${category.toLowerCase()}`, shopSpec({
        groups: { shelf: '.cm-vs2-shop__shelf' },
        primary: ['.cm-vs2-shop__arrow'],
        lists: [{ container: '.cm-vs2-shop__list', item: '.cm-vs2-shop__row', covers: ['.cm-vs2-footer'] }]
      }));
    }
    // One product's detail sheet, then close it.
    const card = page.locator('.cm-vs2-shop__list .cm-vs2-shop__row').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      if (await page.locator('.cm-vs2-shop__sheet:not([hidden])').isVisible().catch(() => false)) {
        await run.check('shop-detail', { scope: ['.cm-vs2-shop__sheet'], groups: { sheet: '.cm-vs2-shop__detail', footer: '.cm-vs2-footer', status: STATUS },
          allowOverlap: [['sheet', 'footer']], primary: ['.cm-vs2-shop__close', '.cm-vs2-shop__buy'],
          mustSee: [{ selector: '.cm-vs2-shop__close', role: 'exit' }, { selector: '.cm-vs2-shop__buy' }] });
        await run.tap('.cm-vs2-shop__close', { state: 'shop-detail', what: '關閉商品詳情' });
      }
    }
  });
  await run.step('gacha-machine', async () => {
    await run.tap('.cm-vs2-shop__tab[data-category="PLUGINS"]', { state: 'gacha-machine', what: '轉蛋頁籤' });
    await page.locator('.cm-gacha__pane--machine').waitFor({ state: 'visible', timeout: 10000 });
    await run.check('gacha-machine', shopSpec({
      groups: { modes: '.cm-gacha__modes', wallet: '.cm-gacha__wallet', pulls: '.cm-gacha__pulls', machines: '.cm-gacha__machines', pity: '.cm-gacha__pity' },
      primary: ['.cm-gacha__mode', '.cm-gacha__pull', '.cm-gacha__machine-tab'],
      mustSee: [{ selector: '.cm-gacha__pull--one' }, { selector: '.cm-gacha__pull--ten' }, { selector: '.cm-gacha__mode[data-mode="SYNTH"]' }, { selector: '.cm-gacha__mode[data-mode="BAG"]' }],
      exclude: ['.cm-gacha__crank']
    }));
  });
  await run.step('gacha-pulls', async () => {
    // Bits supply machine: the QA wallet pays for both pulls without spending the ticket stock.
    await run.tap('.cm-gacha__machine-tab[data-machine="BITS"]', { state: 'gacha-pull-one', what: '位元幣補給機' });
    await run.tap('.cm-gacha__pull--one', { state: 'gacha-pull-one', what: '單抽' });
    await waitReveal(run, 1);
    await run.check('gacha-reveal-one', { scope: ['.cm-gacha__reveal:not([hidden])'], groups: { cards: '.cm-gacha__reveal:not([hidden]) .cm-gacha__cards > *', actions: '.cm-gacha__reveal:not([hidden]) .cm-gacha__reveal-actions', title: '.cm-gacha__reveal:not([hidden]) .cm-gacha__reveal-title' },
      primary: [GACHA_CONFIRM], mustSee: [{ selector: GACHA_CONFIRM, role: 'exit' }] });
    await run.tap(GACHA_CONFIRM, { state: 'gacha-reveal-one', what: '確定收下' });
    await page.locator('.cm-gacha__reveal:not([hidden])').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await run.tap('.cm-gacha__pull--ten', { state: 'gacha-pull-ten', what: '十連' });
    await waitReveal(run, 10);
    await run.check('gacha-reveal-ten', { scope: ['.cm-gacha__reveal:not([hidden])'], groups: { cards: '.cm-gacha__reveal:not([hidden]) .cm-gacha__cards > *', actions: '.cm-gacha__reveal:not([hidden]) .cm-gacha__reveal-actions', title: '.cm-gacha__reveal:not([hidden]) .cm-gacha__reveal-title' },
      primary: [GACHA_CONFIRM], mustSee: [{ selector: GACHA_CONFIRM, role: 'exit' }, ...Array.from({ length: 10 }, (_, i) => ({ selector: `.cm-gacha__reveal:not([hidden]) .cm-gacha__cards > :nth-child(${i + 1})` }))] });
    await run.tap(GACHA_CONFIRM, { state: 'gacha-reveal-ten', what: '確定收下' });
    await page.locator('.cm-gacha__reveal:not([hidden])').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await run.check('gacha-reveal-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'SHOP' });
  });
  await run.step('gacha-synth', async () => {
    await run.tap('.cm-gacha__mode[data-mode="SYNTH"]', { state: 'gacha-synth', what: '合成爐' });
    await page.locator('.cm-gacha__pane--synth').waitFor({ state: 'visible', timeout: 8000 });
    const synthSpec = () => shopSpec({ groups: { modes: '.cm-gacha__modes', wallet: '.cm-gacha__wallet' },
      primary: ['.cm-gacha__mode', '.cm-gacha__pane--synth .cm-gacha__action'],
      mustSee: [{ selector: '.cm-gacha__pane--synth .cm-gacha__action--primary' }],
      lists: [{ container: '.cm-vs2-shop__body', item: '.cm-gacha__chip-grid > *', covers: ['.cm-vs2-footer'] }] });
    await run.check('gacha-synth', synthSpec());
    const fill = page.locator('.cm-gacha__pane--synth .cm-gacha__action').first();
    if (await fill.isEnabled().catch(() => false)) { await fill.click(); await run.check('gacha-synth-filled', synthSpec()); }
  });
  await run.step('gacha-bag', async () => {
    await run.tap('.cm-gacha__mode[data-mode="BAG"]', { state: 'gacha-bag', what: '晶片背包' });
    await page.locator('.cm-gacha__pane--bag').waitFor({ state: 'visible', timeout: 8000 });
    const bagSpec = () => shopSpec({ groups: { modes: '.cm-gacha__modes', wallet: '.cm-gacha__wallet' },
      primary: ['.cm-gacha__mode'],
      lists: [{ container: '.cm-vs2-shop__body', item: '.cm-gacha__chip-grid--bag > *', covers: ['.cm-vs2-footer'] }] });
    await run.check('gacha-bag', bagSpec());
    const chip = page.locator('.cm-gacha__chip-grid--bag > button').first();
    if (await chip.isVisible().catch(() => false)) { await chip.click(); await run.check('gacha-bag-selected', bagSpec()); }
  });
  await run.step('shop-exit', async () => {
    await run.tap('.cm-vs2-footer .cm-vs2-action', { state: 'shop-exit', what: '返回牧場' });
    await run.waitHome(30000);
    await run.check('shop-exit', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME', intervalBaseline: run.intervalBaseline });
  });
}

// The special's 650 ms cut-in strip is held at its resting frame (300 ms: slid in, not yet
// leaving) the moment it appears, so its angle and the caster's face framing can be
// measured and photographed. Only the strip's own animations are paused, then resumed.
async function holdCutIn(page) {
  await page.evaluate(() => {
    window.__vhCutin = null;
    window.__vhCutinObserver?.disconnect();
    const watch = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof Element) || !node.matches('.cm-cutin')) continue;
        for (const animation of node.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 300; }
        window.__vhCutin = { held: true };
        watch.disconnect();
      }
    });
    watch.observe(document.body, { childList: true, subtree: true });
    window.__vhCutinObserver = watch;
  });
}
async function measureCutIn(run, state) {
  const { page } = run;
  const held = await page.waitForFunction(() => window.__vhCutin?.held, null, { timeout: 10000 }).then(() => true, () => false);
  if (!held) {
    await page.evaluate(() => window.__vhCutinObserver?.disconnect()).catch(() => {});
    run.fail(state, 3, 'CUTIN_MISSING', '必殺切入條沒有出現');
    return;
  }
  const info = await page.evaluate(() => {
    const strip = document.querySelector('.cm-cutin'), band = strip.querySelector('.cm-cutin__band'), face = strip.querySelector('.cm-cutin__face');
    const art = face?.querySelector('.cm-cutin__face-art, .cm-cutin__face-sil');
    const box = n => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); };
    const t = getComputedStyle(band).transform, m = new DOMMatrixReadOnly(t === 'none' ? undefined : t);
    const angle = Math.round(Math.atan2(m.b, m.a) * 1800 / Math.PI) / 10;
    const share = (sq, r) => (Math.max(0, Math.min(sq.right, r.right) - Math.max(sq.left, r.left)) * Math.max(0, Math.min(sq.bottom, r.bottom) - Math.max(sq.top, r.top))) / ((sq.right - sq.left) * (sq.bottom - sq.top) || 1);
    const round = n => Math.round(n * 100) / 100;
    const out = { strip: box(strip), band: box(band), face: face ? box(face) : null, angle, framing: face?.dataset.framing ?? null, headInFace: null, headInClear: null, faceOnScreen: null };
    if (face) {
      const fr = face.getBoundingClientRect();
      out.faceOnScreen = round(share({ left: fr.left, top: fr.top, right: fr.right, bottom: fr.bottom }, { left: 0, top: 0, right: innerWidth, bottom: innerHeight }));
    }
    const cs = face ? getComputedStyle(face) : null, v = k => Number(cs?.getPropertyValue(k));
    const [iw, cx, cy, head] = ['--cutin-iw', '--cutin-cx', '--cutin-cy', '--cutin-head'].map(v);
    if (art && [iw, cx, cy, head].every(Number.isFinite) && iw > 0 && head > 0) {
      // Untransformed layout inside the face box (the strip's rotation moves both together).
      const k = art.offsetWidth / iw, w = face.clientWidth, h = face.clientHeight;
      const hx = art.offsetLeft + cx * k, hy = art.offsetTop + cy * k, half = head * k / 2;
      const sq = { left: hx - half, right: hx + half, top: hy - half, bottom: hy + half };
      out.headInFace = round(share(sq, { left: 0, top: 0, right: w, bottom: h }));
      out.headInClear = round(share(sq, { left: w * 0.22, top: 0, right: w * 0.78, bottom: h }));
    }
    return out;
  });
  await run.check(state, { scope: ['.cm-cutin-layer'], settleMs: 0, primary: [], groups: { cutin: '.cm-cutin__band', status: STATUS }, allowOverlap: [['cutin', 'status']] });
  run.results.push({ viewport: run.viewport.id, slice: run.slice, state: `${state}-geometry`, screen: await run.screen(), findings: [], info, screenshot: null, dialogs: [] });
  if (info.headInFace !== null && info.headInFace < 0.95) run.fail(state, 2, 'FACE_CROP', `切入條頭部只有 ${Math.round(info.headInFace * 100)}% 在臉框內`);
  if (info.faceOnScreen !== null && info.faceOnScreen < 0.9) run.fail(state, 2, 'FACE_OFFSCREEN', `切入條臉框只有 ${Math.round(info.faceOnScreen * 100)}% 在畫面內`);
  await page.evaluate(() => { document.querySelector('.cm-cutin')?.getAnimations({ subtree: true }).forEach(a => a.play()); window.__vhCutin = null; });
}

// ---- Slice 3: Dex list, detail, motion viewer, showcase sandboxes, element chart --------
const DEX_DETAIL = '.cm-vs2-database__sheet-panel, .cm-vs2-database__sheet';
function dexListSpec(extra = {}) {
  return {
    groups: { status: STATUS, title: '.cm-vs2-header', chips: '.cm-vs2-database__chips, .cm-vs2-database__filters', footer: '.cm-vs2-footer', ...(extra.groups ?? {}) },
    primary: ['.cm-vs2-database__chip', '.cm-vs2-footer .cm-vs2-action'],
    mustSee: [{ selector: '.cm-vs2-footer .cm-vs2-action', role: 'exit' }, { selector: '.cm-vs2-database__chip' }, { selector: '.cm-vs2-database__row' }],
    lists: [{ container: '.cm-vs2-shop__list', item: '.cm-vs2-database__row', covers: ['.cm-vs2-footer'] }],
    exclude: ['select.cm-vs2-database__stage'],
    ...extra.more
  };
}
function dexDetailSpec(extra = {}) {
  return {
    groups: { status: STATUS, footer: '.cm-vs2-footer', ...(extra.groups ?? {}) },
    allowOverlap: [['footer', 'status']],
    primary: ['.cm-vs2-database__close', '.cm-showcase-toggle__option', '.cm-showcase-motion__turn', '.cm-showcase-motion__action',
      '.cm-showcase-cta', '.cm-element-chart-button', '.cm-dex-conditions__toggle'],
    mustSee: [{ selector: '.cm-vs2-database__close', role: 'exit' }, ...(extra.mustSee ?? [])],
    lists: [{ container: '.cm-vs2-database__sheet', item: '.cm-dex-routes__target, .cm-showcase-cta, .cm-dex-conditions__toggle', covers: ['.cm-vs2-footer'] }],
    exclude: ['select.cm-vs2-database__stage', '.cm-vs2-database__row', '.cm-vs2-database__chip'],
    ...extra.more
  };
}
/** Scroll a control into view the way a reader of the detail sheet would. */
// Scroll a target to the middle of its scrolling sheet, the way a player brings it into
// view. (Playwright's scrollIntoViewIfNeeded leaves a key that is only a few pixels cut.)
async function reveal(run, selector) {
  const target = run.page.locator(selector).first();
  if (!(await target.count())) return false;
  await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
  await run.settle(250);
  return true;
}
async function overlayClosed(run, selector) {
  await run.page.waitForFunction(s => ![...document.querySelectorAll(s)].some(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden'), selector, { timeout: 8000 });
}

async function slice3(run, { repo }) {
  const { page } = run;
  if (!(await run.step('qa-save', () => continueWith(run, qaSave(repo))))) return;
  run.intervalBaseline = await run.intervals();
  await run.step('dex-list', async () => {
    await run.tap('.cm-toolbar__quick-entry[data-quick-id="database"]', { state: 'dex-list', what: '圖鑑' });
    await run.waitScreen('DATABASE');
    await page.locator('.cm-vs2-database__row').first().waitFor({ state: 'visible', timeout: 15000 });
    await run.check('dex-list', dexListSpec());
    for (const stage of ['3', '6']) {
      await run.tap(`.cm-vs2-database__chip[data-stage="${stage}"]`, { state: `dex-stage-${stage}`, what: `階段篩選 ${stage}` });
      await run.check(`dex-stage-${stage}`, dexListSpec());
    }
    await run.tap('.cm-vs2-database__chip[data-stage="3"]', { state: 'dex-detail', what: '成長期' });
  });
  await run.step('dex-detail', async () => {
    await run.tap('.cm-vs2-database__row[data-state="REGISTERED"]', { state: 'dex-detail', what: '已登錄夥伴' });
    await page.locator('.cm-vs2-database__close').waitFor({ state: 'visible', timeout: 10000 });
    await run.check('dex-detail', dexDetailSpec({ mustSee: [{ selector: '.cm-showcase-toggle__option' }] }));
    await run.tap('.cm-showcase-toggle__option[data-view="motion"]', { state: 'dex-motion', what: '實機動作' });
    await page.locator('.cm-showcase-motion__action').first().waitFor({ state: 'visible', timeout: 10000 });
    await run.check('dex-motion', dexDetailSpec({ mustSee: ['stand', 'walk', 'attack', 'cheer'].map(a => ({ selector: `.cm-showcase-motion__action[data-action="${a}"]` })).concat({ selector: '.cm-showcase-motion__turn' }) }));
    await run.tap('.cm-showcase-motion__action[data-action="attack"]', { state: 'dex-motion', what: '攻擊動作' });
  });
  // Each overlay opened from the detail must layer above it and close back onto it.
  // A top-layer dialog (the element chart) covers the status pills on purpose; the showcase
  // is an ordinary layer under them, so there the pills must not touch its frame.
  const fromDetail = async (state, opener, overlay, closer, what, { cutIn = null, coversStatus = false } = {}) => {
    await run.step(state, async () => {
      if (!(await reveal(run, opener))) { run.fail(state, 4, 'UNREACHABLE', `${what}：圖鑑詳情裡找不到入口（${opener}）`); return; }
      const before = await page.evaluate(() => document.querySelector('.cm-vs2-database__sheet')?.scrollTop ?? 0);
      if (cutIn) await holdCutIn(page);
      await run.tap(opener, { state, what });
      await page.locator(overlay).first().waitFor({ state: 'visible', timeout: 12000 });
      if (cutIn) await measureCutIn(run, cutIn);
      await run.settle(1200);
      await markExit(run, overlay);
      const top = await page.evaluate(s => { const o = document.querySelector(s); const r = o?.getBoundingClientRect(); const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 60)) : null; return Boolean(hit && o.contains(hit)); }, overlay);
      if (!top) run.fail(state, 4, 'LAYERING', `${what}：彈出層沒有蓋在圖鑑詳情上（z-index）`);
      await run.check(state, { scope: [overlay], mustSee: [{ selector: closer ?? '[data-vh-exit]', role: 'exit' }], primary: [closer ?? '[data-vh-exit]'],
        groups: { overlay, status: STATUS }, allowOverlap: coversStatus ? [['overlay', 'status']] : [],
        // The brief: centred and wholly on screen; a showcase also keeps at least 45% of the height.
        centered: [overlay], areas: [{ selector: overlay, minHeightRatio: 0.45 }] });
      await run.tap(closer ?? '[data-vh-exit]', { state, what: `關閉${what}` });
      await overlayClosed(run, overlay);
      const after = await page.evaluate(() => ({ open: Boolean(document.querySelector('.cm-vs2-database__close')?.getClientRects().length), top: document.querySelector('.cm-vs2-database__sheet')?.scrollTop ?? 0 }));
      if (!after.open) run.fail(`${state}-closed`, 4, 'WRONG_RETURN', `${what} 關閉後沒有回到圖鑑詳情`);
      else if (Math.abs(after.top - before) > 48) run.fail(`${state}-closed`, 4, 'WRONG_RETURN', `${what} 關閉後圖鑑詳情捲動位置跑掉（${Math.round(before)} → ${Math.round(after.top)}）`);
      await run.check(`${state}-closed`, { scope: ['.cm-vs2-database__sheet'], exclude: ['.cm-vs2-database__row'], residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar', '.cm-vs2-database__sheet'] }, expectScreen: 'DATABASE', allowDialogs: 0 });
    });
  };
  await fromDetail('dex-element-chart', '.cm-element-chart-button', 'dialog.cm-element-chart[open]', '.cm-element-chart__close', '屬性相剋表', { coversStatus: true });
  await fromDetail('dex-special', '.cm-showcase-cta--special', '.cm-showcase:not([hidden]) .cm-showcase__frame', '.cm-showcase:not([hidden]) .cm-showcase__close', '必殺技模擬展演', { cutIn: 'dex-cutin' });
  await fromDetail('dex-evolution', '.cm-showcase-cta--evolution', '.cm-showcase:not([hidden]) .cm-showcase__frame', '.cm-showcase:not([hidden]) .cm-showcase__close', '進化模擬展演');
  await run.step('dex-conditions', async () => {
    if (!(await reveal(run, '.cm-dex-conditions__toggle'))) return;
    await run.tap('.cm-dex-conditions__toggle', { state: 'dex-conditions', what: '進化條件' });
    await run.check('dex-conditions', dexDetailSpec());
  });
  await run.step('dex-exit', async () => {
    await run.tap('.cm-vs2-database__close', { state: 'dex-exit', what: '關閉圖鑑詳情' });
    await page.locator('.cm-vs2-database__close').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    await run.tap('.cm-vs2-footer .cm-vs2-action', { state: 'dex-exit', what: '返回牧場' });
    await run.waitHome(30000);
    await run.check('dex-exit', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME', intervalBaseline: run.intervalBaseline });
  });
}

// ---- Slice 4: 3D hunt, auto battle, Data Arena ------------------------------------------
const VS2_SCREEN = { status: STATUS, title: '.cm-vs2-header', footer: '.cm-vs2-footer' };

// Loopback keeps the hunt map review switches; the approved public URL always loads the
// rebuilt maps. This switch reproduces the public map selection on the QA origin (art only).
const PUBLIC_HUNT_MAPS = '?huntReview=hm01x2-20261019';

async function slice4(run, { repo }) {
  const { page } = run;
  if (!(await run.step('qa-save', () => continueWith(run, qaSave(repo), { query: PUBLIC_HUNT_MAPS })))) return;
  run.intervalBaseline = await run.intervals();
  // A. Hunt: globe → loadout → field → back to the ranch.
  await run.step('hunt-gates', async () => {
    await run.tap('.cm-toolbar__quick-entry[data-quick-id="hunt"]', { state: 'hunt-gates', what: '狩獵' });
    await run.waitScreen('GATE_SELECT');
    await page.waitForSelector('.cm-vs2-shell', { timeout: 20000 });
    await page.waitForFunction(() => Boolean(document.getElementById('cm-root')?.dataset.gatePresentation), null, { timeout: 30000 });
    await run.settle(1500);
    await run.check('hunt-gates', { groups: { ...VS2_SCREEN }, primary: ['.cm-vs2-footer .cm-vs2-action'],
      mustSee: [{ selector: '.cm-vs2-footer .cm-vs2-action:not(.cm-vs2-action--primary)', role: 'exit' }, { selector: '.cm-vs2-gate3d__node-hit:not([hidden]), .cm-vs2-gate' }],
      exclude: ['.cm-vs2-gate3d__node-hit'] });
    await opening.selectEnterableGate(page).catch(() => opening.selectEnterableGate(page, { selector: '.cm-vs2-gate' }));
    await run.check('hunt-gate-selected', { groups: { ...VS2_SCREEN }, primary: ['.cm-vs2-footer .cm-vs2-action'],
      mustSee: [{ selector: opening.GATE_CONFIRM }], exclude: ['.cm-vs2-gate3d__node-hit'] });
    await run.tap(opening.GATE_CONFIRM, { state: 'hunt-loadout', what: '前往整備' });
    await run.waitScreen('HUNT_LOADOUT', 20000);
    await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
    await run.check('hunt-loadout', { groups: { ...VS2_SCREEN }, primary: ['.cm-vs2-footer .cm-vs2-action', '.cm-vs2-loadout__option'],
      mustSee: [{ selector: '.cm-vs2-footer .cm-vs2-action--primary' }, { selector: '.cm-vs2-footer .cm-vs2-action:not(.cm-vs2-action--primary)', role: 'exit' }],
      lists: [{ container: '.cm-vs2-shell, .cm-vs2-body', item: '[data-equipment-class], [data-plugin-position]', covers: ['.cm-vs2-footer'] }] });
    await run.tap('.cm-vs2-footer .cm-vs2-action--primary', { state: 'hunt-field', what: '開始狩獵' });
    await run.waitScreen('HUNT_FIELD', 30000);
    await page.locator('.cm-hunt-tools .cm-vs2-action').first().waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('.cm-vs2-loading:not([hidden]), [data-hunt-loading="true"]'), null, { timeout: 120000 }).catch(() => {});
    await run.settle(2500);
    // The spare-rope switch is a corner badge on the rope key by design; its invisible ::before
    // widens the hit area by 10px / 8px a side. Measure that hit area instead of its badge box.
    const swap = await page.evaluate(() => {
      const el = document.querySelector('.cm-hunt-rope-swap:not([hidden])');
      if (!el || !el.getClientRects().length) return null;
      const r = el.getBoundingClientRect();
      const hits = (x, y) => { const t = document.elementFromPoint(x, y); return t === el || el.contains(t); };
      let top = r.top, bottom = r.bottom, left = r.left, right = r.right;
      while (top > r.top - 16 && hits((r.left + r.right) / 2, top - 1)) top -= 1;
      while (bottom < r.bottom + 16 && hits((r.left + r.right) / 2, bottom + 1)) bottom += 1;
      while (left > r.left - 16 && hits(left - 1, (r.top + r.bottom) / 2)) left -= 1;
      while (right < r.right + 16 && hits(right + 1, (r.top + r.bottom) / 2)) right += 1;
      return { width: right - left, height: bottom - top };
    });
    if (swap && (swap.width < 40 || swap.height < 40)) run.fail('hunt-field', 5, 'TARGET_SMALL', `繩索切換「⇄」實際觸控熱區 ${Math.round(swap.width)}×${Math.round(swap.height)}px < 40px`);
    await run.check('hunt-field', {
      ignore: ['.cm-hunt-rope-swap'], exclude: ['.cm-vs2-field__canvas', '.cm-hunt-rope-swap'],
      groups: { status: STATUS, hud: '.cm-vs2-hud__top, .cm-vs2-hud__bar, .cm-vs2-hud', tools: '.cm-hunt-tools', dock: '.cm-hunt-dock, .cm-hunt-tactical-dock' },
      allowOverlap: [['hud', 'tools'], ['hud', 'dock'], ['tools', 'dock']],
      primary: ['.cm-hunt-tools .cm-vs2-action:not(.cm-hunt-rope-swap)', '.cm-vs2-hud__exit'],
      mustSee: [{ selector: '.cm-vs2-hud__exit', role: 'exit' }, { selector: '.cm-hunt-tools .cm-vs2-action' }],
      stage: { hud: [STATUS, '.cm-vs2-hud__top', '.cm-hunt-tools', '.cm-hunt-dock', '.cm-hunt-tactical-dock', '.cm-vs2-hud__exit'] } });
    await opening.leaveHuntField(page);
    await run.waitHome(60000);
    await run.check('hunt-exit', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
  });
  // B. Auto battle: menu, lobbies, team, match, podium.
  const battleMenu = async () => {
    if (await run.screen() !== 'BATTLE_SELECT') {
      await home(run);
      await run.tap('.cm-toolbar__quick-entry[data-quick-id="battle"]', { state: 'battle-menu', what: '對戰' });
      await run.waitScreen('BATTLE_SELECT');
    }
    await page.locator('.cm-vs5-cube__canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  };
  // The mode prism (2026-11-09) has no key row: turn it with its arrow keys until the
  // mode faces the player, then tap the prism, as a player does.
  const battleFace = async (face, state, what) => {
    for (let turn = 0; turn < 8; turn++) {
      if (await page.locator('.cm-vs5-prism__caption').getAttribute('data-face-id') === face) break;
      await run.tap('.cm-vs5-prism__turn--next', { state, what: '下一個模式' });
      await run.settle(450);
    }
    await run.tap('.cm-vs5-cube__canvas', { state, what });
  };
  const battleSpec = (extra = {}) => ({
    groups: { status: STATUS, title: '.cm-vs5-header, .cm-vs2-header', footer: '.cm-vs5-footer, .cm-screen-footer', ...(extra.groups ?? {}) },
    primary: ['.cm-vs5-prism__turn', '.cm-vs5-exit', '.cm-vs5-action--primary', ...(extra.primary ?? [])],
    mustSee: extra.mustSee ?? [{ selector: '.cm-vs5-exit', role: 'exit' }],
    lists: extra.lists ?? [], exclude: extra.exclude ?? [] });
  await run.step('battle-menu', async () => {
    await battleMenu();
    await run.check('battle-menu', battleSpec({ mustSee: [{ selector: '.cm-vs5-exit', role: 'exit' }, { selector: '#cm-data-arena' }, { selector: '.cm-vs5-match__enter' }] }));
    await battleFace('FREE_BATTLE', 'battle-free', '自由對戰');
    await run.check('battle-free', battleSpec({ lists: [{ container: '.cm-vs5-root, .cm-vs5-shell', item: '.cm-vs5-match__enter', covers: ['.cm-vs5-footer', '.cm-screen-footer'] }] }));
  });
  for (const face of ['LINK_BATTLE', 'PASSWORD_BATTLE']) {
    const state = face === 'LINK_BATTLE' ? 'battle-link-lobby' : 'battle-password-lobby';
    await run.step(state, async () => {
      await battleMenu();
      await battleFace(face, state, face === 'LINK_BATTLE' ? '通訊對戰' : '密碼對戰');
      await run.settle(800);
      const enter = page.locator('.cm-vs5-match__enter').first();
      if (await enter.isVisible().catch(() => false)) { await enter.click(); await run.settle(1200); }
      await markExit(run, 'dialog[open], .cm-vs5-root, .cm-online-lobby');
      await run.check(state, battleSpec({ mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }], lists: [] }));
      await run.tap('[data-vh-exit]', { state, what: '離開大廳' });
      await run.settle(800);
    });
  }
  await run.step('battle-team', async () => {
    await battleMenu();
    await battleFace('FREE_BATTLE', 'battle-team', '自由對戰');
    await run.tap('.cm-vs5-match__enter', { state: 'battle-team', what: '第一場賽事' });
    await page.locator('.cm-vs5-action--primary').first().waitFor({ state: 'visible', timeout: 10000 });
    const member = page.locator('.cm-vs5-action:not(.cm-vs5-action--primary)').filter({ hasText: 'HP' }).first();
    await member.click();
    await markExit(run, '#cm-root');
    await run.check('battle-team', battleSpec({ mustSee: [{ selector: '.cm-vs5-action--primary' }, { selector: '[data-vh-exit]', role: 'exit' }],
      primary: ['.cm-vs5-action'], lists: [{ container: '.cm-vs5-root, .cm-vs5-shell', item: '.cm-vs5-action:not(.cm-vs5-action--primary):not(.cm-vs5-footer *, .cm-screen-footer *)', covers: ['.cm-vs5-footer', '.cm-screen-footer'] }] }));
    await run.tap('.cm-vs5-action--primary', { state: 'battle-field', what: '決定出戰' });
    await run.waitScreen('BATTLE_FIELD', 30000);
    await run.settle(4000);
    await run.check('battle-field', { groups: { status: STATUS, top: '.cm-vs5-hud, .cm-vs5-fighters, .cm-vs5-scoreboard', bottom: '.cm-vs5-caption, .cm-vs5-info' },
      allowOverlap: [['top', 'bottom']], stage: { hud: [STATUS, '.cm-vs5-hud', '.cm-vs5-fighters', '.cm-vs5-scoreboard', '.cm-vs5-caption', '.cm-vs5-info'] },
      exclude: ['canvas'], primary: [] });
    // A special's cut-in strip lasts 650 ms: catch one if the match plays one.
    const cutIn = await page.locator('.cm-cutin').first().waitFor({ state: 'visible', timeout: 60000 }).then(() => true, () => false);
    if (cutIn) {
      const geometry = await page.evaluate(() => {
        const strip = document.querySelector('.cm-cutin'), band = document.querySelector('.cm-cutin__band'), face = document.querySelector('.cm-cutin__face img, .cm-cutin__face');
        const r = n => { if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        const fit = face && face.tagName === 'IMG' ? { natural: face.naturalWidth / Math.max(1, face.naturalHeight), objectFit: getComputedStyle(face).objectFit } : null;
        return { strip: r(strip), band: r(band), face: r(face), bandTransform: band ? getComputedStyle(band).transform : null, fit };
      });
      run.results.push({ viewport: run.viewport.id, slice: run.slice, state: 'battle-cutin-geometry', screen: 'BATTLE_FIELD', findings: [], info: geometry, screenshot: null, dialogs: [] });
      await run.check('battle-cutin', { scope: ['.cm-cutin-layer'], settleMs: 0, primary: [], groups: { cutin: '.cm-cutin', status: STATUS }, allowOverlap: [['cutin', 'status']] });
    }
    await run.waitScreen('BATTLE_RESULT', 240000);
    await run.settle(3500);
    await run.check('battle-result', { groups: { status: STATUS, brag: '.cm-brag-cta', next: '.cm-vs5-action--primary' }, mustSee: [{ selector: '.cm-vs5-action--primary', role: 'exit' }, { selector: '.cm-brag-cta' }],
      primary: ['.cm-vs5-action', '.cm-brag-cta'] });
    const brag = page.locator('.cm-brag-cta').first();
    if (await brag.isVisible().catch(() => false)) {
      await brag.click();
      await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 10000 });
      await markExit(run, 'dialog[open]');
      await run.check('battle-brag-card', { scope: ['dialog[open]'], mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }], primary: ['dialog[open] button'] });
      await run.tap('[data-vh-exit]', { state: 'battle-brag-card', what: '關閉名片' });
    }
    // The result pages step with 下一頁 until the last one returns to the ranch.
    let lastChecked = false;
    for (let i = 0; i < 12 && await run.screen() !== 'RAISING_HOME'; i += 1) {
      if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape').catch(() => {});
      if (i === 1) await run.check('battle-result-page', { groups: { status: STATUS, next: '.cm-vs5-action--primary:not([hidden])' }, mustSee: [{ selector: '.cm-vs5-action--primary:not([hidden])', role: 'exit' }], primary: ['.cm-vs5-action'] });
      const shown = page.locator('.cm-vs5-action--primary:not([hidden])').first();
      if (!lastChecked && i > 0 && await page.locator('.cm-vs5-exit:not([hidden])').count() && (lastChecked = true)) await run.check('battle-result-last', { groups: { status: STATUS, next: '.cm-vs5-exit' }, mustSee: [{ selector: '.cm-vs5-exit:not([hidden])', role: 'exit' }], primary: ['.cm-vs5-action'] });
      await shown.click({ timeout: 8000 }).catch(() => {});
      await run.settle(1800);
    }
    await run.waitHome(60000);
    await run.check('battle-exit', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
  });
  // C. Data Arena: lobby, a live relay match on touch, the pause sheet.
  await run.step('arena-lobby', async () => {
    await battleMenu();
    await run.tap('#cm-data-arena', { state: 'arena-lobby', what: '數據競技場' });
    await page.locator('.da-mode').first().waitFor({ state: 'visible', timeout: 20000 });
    const lobby = () => ({ scope: ['.da-root'], groups: { panel: '.da-panel', status: STATUS }, allowOverlap: [['panel', 'status']],
      primary: ['.da-btn', '.da-mode', '.da-partner'], mustSee: [{ selector: '.da-btn--primary' }, { selector: '.da-btn:not(.da-btn--primary)', role: 'exit' }],
      lists: [{ container: '.da-panel__body, .da-panel', item: '.da-partner, .da-mode', covers: ['.da-actions'] }] });
    await run.check('arena-lobby', lobby());
    await run.tap('.da-mode[data-mode="RELAY"]', { state: 'arena-relay', what: '接力對戰' });
    await run.check('arena-relay', lobby());
    await run.tap('.da-btn--primary', { state: 'arena-briefing', what: '出戰' });
    await page.locator('.da-overlay .da-btn--primary').first().waitFor({ state: 'visible', timeout: 20000 });
    await run.check('arena-briefing', { scope: ['.da-overlay'], primary: ['.da-overlay .da-btn'], mustSee: [{ selector: '.da-overlay .da-btn--primary' }] });
    await page.locator('.da-overlay .da-btn--primary').first().click();
    await page.waitForFunction(() => document.querySelector('.da-root')?.dataset.state === 'PLAY', null, { timeout: 30000 });
    await run.settle(1200);
    if (run.viewport.kind !== 'desktop') {
      // The touch layer appears on the first touch of the arena, the way a phone player starts.
      const spot = await page.evaluate(() => ({ x: innerWidth * 0.3, y: innerHeight * 0.45 }));
      await page.touchscreen.tap(spot.x, spot.y);
      await run.settle(700);
    }
    await run.check('arena-match', {
      // 「開打！」 and the phase banners show for about a second over the clock, like a toast.
      scope: ['.da-root'], ignore: ['.da-banner'],
      // The touch layer is a full-screen pointer-events:none sheet; its keys are the wheel.
      groups: { top: '.da-hud__top', resonance: '.da-hud__resonance', move: '.da-stick--move:not([hidden])', aim: '.da-stick--aim:not([hidden])', wheel: '.da-touch__buttons .da-tbtn', pause: '.da-hud__pause', status: STATUS },
      allowOverlap: [['top', 'pause'], ['top', 'resonance'], ['top', 'status']],
      primary: ['.da-tbtn', '.da-hud__pause'],
      mustSee: [{ selector: '.da-hud__pause', role: 'exit' }, ...(run.viewport.kind !== 'desktop' ? [{ selector: '.da-tbtn--basic' }, { selector: '.da-tbtn--switch' }] : [])],
      stage: { hud: ['.da-hud__top', '.da-touch__buttons .da-tbtn', '.da-hud__bottom', STATUS] } });
    await run.tap('.da-hud__pause', { state: 'arena-pause', what: '暫停' });
    await page.locator('.da-overlay').first().waitFor({ state: 'visible', timeout: 8000 });
    await run.check('arena-pause', { scope: ['.da-overlay'], primary: ['.da-overlay .da-btn'], mustSee: [{ selector: '.da-overlay .da-btn--quiet', role: 'exit' }] });
    await run.tap('.da-overlay .da-btn--quiet', { state: 'arena-pause', what: '離開競技場' });
    await page.waitForFunction(() => !document.querySelector('.da-root') || document.querySelector('.da-root').dataset.state !== 'PLAY', null, { timeout: 15000 });
    await run.settle(1500);
    const back = page.locator('.da-btn:not(.da-btn--primary)').last();
    if (await back.isVisible().catch(() => false)) await back.click();
    await run.settle(1500);
    await run.check('arena-exit', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'BATTLE_SELECT', intervalBaseline: null });
  });
}

// ---- Slice 5: story, tamer licence, friends and brag card, passport, community dock ------
// A dialogue box over the stage may take at most this share of a short landscape screen.
const DIALOGUE_MAX = { landscape: 0.45, portrait: 0.4, desktop: 0.35 };

async function systemEntry(run, entry, state, what) {
  await home(run);
  await run.tap('button.cm-toolbar__cell[data-menu-id="SYSTEM"]', { state, what: '選單' });
  const target = `.cm-toolbar__menu[data-menu-id="SYSTEM"] [data-entry-id="${entry}"]`;
  await reveal(run, target);
  await run.tap(target, { state, what });
}

async function storyDialogue(run, { stateBase, box, controls, skip, logButton, logPanel, stage, root }) {
  const { page } = run;
  await page.locator(box).first().waitFor({ state: 'visible', timeout: 30000 });
  await run.settle(1500);
  const maxShare = DIALOGUE_MAX[run.viewport.kind] ?? 0.4;
  await run.check(`${stateBase}-dialogue`, { scope: [root], groups: { box, controls, status: STATUS }, allowOverlap: [['box', 'controls'], ['controls', 'status']],
    primary: [`${controls} button`], mustSee: [{ selector: skip, role: 'exit' }, ...(logButton ? [{ selector: logButton }] : [])],
    areas: [{ selector: box, maxHeightRatio: maxShare }, ...(stage ? [{ selector: stage, minHeightRatio: 0.3 }] : [])] });
  if (logButton && await page.locator(logButton).first().isVisible().catch(() => false)) {
    await run.tap(logButton, { state: `${stateBase}-log`, what: '對話紀錄' });
    await page.locator(logPanel).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await run.check(`${stateBase}-log`, { scope: [root], primary: [`${controls} button`], lists: [{ container: logPanel, item: '*', covers: [] }] });
    await page.locator(logButton).first().click().catch(() => {});
  }
}

async function slice5(run, { repo }) {
  const { page } = run;
  if (!(await run.step('qa-save', () => continueWith(run, qaSave(repo))))) return;
  run.intervalBaseline = await run.intervals();
  // A. The story chapter map and its dialogue theater (main's 故事章節).
  await run.step('story-map', async () => {
    // A refused entry must say so: the first tap either opens the map or shows a visible notice.
    const feedback = '.cm-story-map, .cm-arcade-toast, .cm-fx-toast, [data-fx-toast]';
    let opened = false;
    for (let attempt = 0; attempt < 4 && !opened; attempt += 1) {
      await systemEntry(run, 'story', 'story-map', '故事章節');
      opened = await page.locator('.cm-story-map').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
      if (!opened && attempt === 0) {
        const told = await page.locator(feedback).first().isVisible().catch(() => false);
        run.fail('story-map', 4, told ? 'REFUSED' : 'SILENT_REFUSAL', told ? '故事章節暫時無法開啟（有提示）' : '選單「故事章節」點了沒有任何畫面或提示（入口被靜默拒絕）');
        await run.page.screenshot({ path: path.join(run.out, run.viewport.id, 's5-story-map-refused.jpg'), type: 'jpeg', quality: 72 }).catch(() => {});
      }
      if (!opened) await run.settle(2500);
    }
    if (!opened) { run.fail('story-map', 4, 'UNREACHABLE', '故事章節重試 4 次仍打不開'); return; }
    await run.settle(1200);
    await run.check('story-map', { scope: ['.cm-story-map'], primary: ['.cm-story-map__play', '.cm-story-map__close', '.cm-story-map__node'],
      mustSee: [{ selector: '.cm-story-map__close', role: 'exit' }, { selector: '.cm-story-map__play' }], lists: [{ container: '.cm-story-map', item: '.cm-story-map__node, .cm-story-map__play', covers: [] }] });
    await run.tap('.cm-story-map__play', { state: 'story-play', what: '開始章節' });
    // The play key goes through the same stage check: a refusal must start the chapter later or say why.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const started = await page.locator('.cm-story-vn:not([hidden])').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
      if (started) break;
      if (attempt === 0) {
        const notice = await page.locator('.cm-story-map__notice:not([hidden])').first().isVisible().catch(() => false);
        run.fail('story-play', 4, notice ? 'REFUSED' : 'SILENT_REFUSAL', notice ? '「開始觀測」被拒絕（星圖顯示提示）' : '「開始觀測」按下後章節沒有開始，也沒有提示');
      }
      await page.locator('.cm-story-map__play').first().click({ timeout: 5000 }).catch(() => {});
    }
    if (!(await page.locator('.cm-story-vn:not([hidden])').first().isVisible().catch(() => false))) {
      // Leave the map closed so the next steps start from the ranch.
      run.fail('story-play', 4, 'UNREACHABLE', '章節重試 4 次仍未開始');
      await page.locator('.cm-story-map__close').first().click({ timeout: 5000 }).catch(() => {});
      return;
    }
    await storyDialogue(run, { stateBase: 'story', root: '.cm-story-vn', box: '.cm-story-vn__box', controls: '.cm-story-vn__controls',
      skip: '.cm-story-vn__control--skip', logButton: '.cm-story-vn__control--log', logPanel: '.cm-story-vn__log', stage: '.cm-story-vn__stage' });
    await run.tap('.cm-story-vn__control--skip', { state: 'story-skip', what: '略過' });
    for (let i = 0; i < 6 && await page.locator('.cm-story-vn:not([hidden])').count(); i += 1) {
      await page.locator('.cm-story-vn__control--skip, .cm-story-vn__choice').first().click({ timeout: 4000 }).catch(() => {});
      await run.settle(1200);
    }
    const map = page.locator('.cm-story-map__close');
    if (await map.isVisible().catch(() => false)) await map.click();
    await run.settle(1200);
    await run.check('story-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
  });
  // B. The tamer licence (management menu).
  await run.step('tamer', async () => {
    await home(run);
    await run.tap('button.cm-toolbar__cell[data-menu-id="MANAGEMENT"]', { state: 'tamer', what: '管理' });
    await run.tap('[data-entry-id="tamer"]', { state: 'tamer', what: '馴獸師' });
    await run.waitScreen('TAMER_INFO');
    await run.settle(1200);
    await markExit(run, '#cm-root');
    await run.check('tamer', { groups: { status: STATUS, footer: '.cm-screen-footer' }, primary: ['.cm-screen-footer button', '.cm-tamer-root button'],
      mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }], lists: [{ container: '.cm-tamer-root', item: 'button:not(.cm-screen-footer *), .cm-social-key, dd', covers: ['.cm-screen-footer'] }] });
    const brag = page.locator('#cm-root [data-online-action="brag-card"], #cm-root .cm-brag-cta').first();
    if (await brag.isVisible().catch(() => false)) {
      await brag.click();
      await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 10000 });
      await markExit(run, 'dialog[open]');
      await run.check('tamer-brag-card', { scope: ['dialog[open]'], primary: ['dialog[open] button'], mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }],
        areas: [{ selector: 'dialog[open]', minHeightRatio: 0.2 }] });
      await run.tap('[data-vh-exit]', { state: 'tamer-brag-card', what: '關閉名片' });
      await markExit(run, '#cm-root');
    }
    await run.tap('[data-vh-exit]', { state: 'tamer', what: '返回牧場' });
    await run.waitHome(30000);
  });
  // C. Friends drawer and the brag card it shares.
  await run.step('friends', async () => {
    await systemEntry(run, 'friends', 'friends', '好友與名片');
    await page.locator('dialog.cm-online-drawer[open]').waitFor({ state: 'visible', timeout: 10000 });
    await run.settle(800);
    await markExit(run, 'dialog.cm-online-drawer[open]');
    await run.check('friends', { scope: ['dialog.cm-online-drawer[open]'], primary: ['dialog.cm-online-drawer[open] button'],
      mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }], lists: [{ container: 'dialog.cm-online-drawer[open]', item: 'button, li', covers: [] }] });
    const brag = page.locator('dialog.cm-online-drawer[open] [data-online-action="brag-card"]').first();
    if (await brag.isVisible().catch(() => false)) {
      await brag.click();
      await run.settle(1500);
      await markExit(run, 'dialog[open]');
      await run.check('friends-brag-card', { scope: ['dialog[open]'], primary: ['dialog[open] button'], mustSee: [{ selector: '[data-vh-exit]', role: 'exit' }] });
      await run.tap('[data-vh-exit]', { state: 'friends-brag-card', what: '關閉名片' });
      await markExit(run, 'dialog.cm-online-drawer[open]');
    }
    await run.tap('[data-vh-exit]', { state: 'friends', what: '關閉好友' });
    await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
    await run.check('friends-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
  });
  // D. Account, cloud backup and the three passport bindings.
  await run.step('passport', async () => {
    await systemEntry(run, 'account', 'passport', '帳號與雲端');
    await page.locator('dialog.cm-settings[open]').waitFor({ state: 'visible', timeout: 10000 });
    await run.settle(800);
    await run.check('passport', { scope: ['dialog.cm-settings[open]'], primary: ['.cm-passport__provider', '.cm-online__button', '.cm-settings__close'],
      mustSee: [{ selector: '.cm-settings__close', role: 'exit' }],
      lists: [{ container: 'dialog.cm-settings[open]', item: '.cm-passport__provider, .cm-online__button, .cm-settings__action', covers: [] }] });
    // The three sign-in keys are one choice: centre the middle one so the group is seen together.
    await reveal(run, 'dialog.cm-settings[open] .cm-passport__provider[data-provider="facebook"]');
    await run.check('passport-bind', { scope: ['dialog.cm-settings[open]'], primary: ['.cm-passport__provider'], mustSee: ['google', 'facebook', 'discord'].map(p => ({ selector: `dialog.cm-settings[open] .cm-passport__provider[data-provider="${p}"]` })) });
    await run.tap('.cm-settings__close', { state: 'passport', what: '關閉設定' });
    await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
    await run.check('passport-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
  });
  // E. The community link dock and passport strip at the foot of the system menu.
  await run.step('social-dock', async () => {
    await home(run);
    await run.tap('button.cm-toolbar__cell[data-menu-id="SYSTEM"]', { state: 'social-dock', what: '選單' });
    // On a short screen the sheet scrolls: the passport keys and the community keys are each
    // brought into view the way a player scrolls to them, then measured.
    const dockSpec = need => ({ scope: ['.cm-toolbar__menu[data-menu-id="SYSTEM"]'], primary: ['.cm-social-key', '.cm-passport__provider', '.cm-passport-strip__more'],
      groups: { menu: '.cm-toolbar__menu[data-menu-id="SYSTEM"]:not([hidden])', quick: RANCH_GROUPS.quick, rail: RANCH_GROUPS.rail },
      mustSee: [{ selector: need }] });
    await reveal(run, '.cm-passport__provider');
    await run.check('social-passport-keys', dockSpec('.cm-passport__provider'));
    await reveal(run, '.cm-social-key');
    await run.check('social-dock', dockSpec('.cm-social-key'));
    await run.tap('button.cm-toolbar__cell[data-menu-id="SYSTEM"]', { state: 'social-dock', what: '收起選單', force: true }).catch(() => {});
  });
  // F. The paper-doll tamer outfit editor named in the brief has no implementation on any branch.
  run.results.push({ viewport: run.viewport.id, slice: run.slice, state: 'paper-doll', screen: null, findings: [], info: 'NOT_IMPLEMENTED：紙娃娃造型（髮型／臉型／眼睛／服裝）在 main 與所有分支都沒有程式碼，無畫面可檢查。', screenshot: null, dialogs: [] });
  // G. 《未被聽見的回聲》 lives on feat/story-unheard-echoes-20261029; scan it read-only when its server is given.
  if (run.storyOrigin) await dataAreaStory(run, { repo });
}

async function dataAreaStory(run, { repo }) {
  const { page } = run;
  const local = { ...run, origin: run.storyOrigin };
  Object.setPrototypeOf(local, Object.getPrototypeOf(run));
  if (!(await run.step('echoes-save', () => continueWith(local, null)))) return;
  await run.step('echoes-hub', async () => {
    await systemEntry(run, 'data-area-story', 'echoes-hub', '《未被聽見的回聲》');
    await page.locator('.cm-da-hub').first().waitFor({ state: 'visible', timeout: 20000 });
    await run.settle(1500);
    await run.check('echoes-hub', { scope: ['.cm-da-hub'], primary: ['.cm-da-hub__close', '.cm-da-chapters__item', '.cm-da-play'],
      mustSee: [{ selector: '.cm-da-hub__close', role: 'exit' }, { selector: '.cm-da-chapters__item' }],
      lists: [{ container: '.cm-da-hub__panel, .cm-da-hub', item: '.cm-da-chapters__item, .cm-da-play, .cm-da-link', covers: [] }] });
    const chapter = page.locator('.cm-da-chapters__item').first();
    await chapter.click();
    await run.settle(800);
    await run.check('echoes-chapter', { scope: ['.cm-da-hub'], primary: ['.cm-da-play', '.cm-da-hub__close'], mustSee: [{ selector: '.cm-da-play' }, { selector: '.cm-da-hub__close', role: 'exit' }] });
    await run.tap('.cm-da-play', { state: 'echoes-play', what: '開始章節' });
    await storyDialogue(run, { stateBase: 'echoes', root: 'body', box: '.cm-da-dialog:not([hidden])', controls: '.cm-da-chip', skip: '[data-da-action="skip"]', stage: null });
    for (let i = 0; i < 12 && !(await page.locator('.cm-da-hub__close').isVisible().catch(() => false)); i += 1) {
      await page.locator('[data-da-action="skip"], [data-da-action="back"], .cm-da-choice').first().click({ timeout: 4000 }).catch(() => {});
      await run.settle(1500);
    }
    if (await page.locator('.cm-da-hub__close').isVisible().catch(() => false)) {
      await run.tap('.cm-da-hub__close', { state: 'echoes-exit', what: '關閉故事大廳' });
      await run.settle(1200);
      await run.check('echoes-closed', { residue: { baseLayers: ['#cm-root', '.cm-status-bar', '.cm-toolbar'] }, expectScreen: 'RAISING_HOME' });
    }
  });
}

const SLICES = Object.freeze({
  1: { title: '主牧場中樞、夥伴資訊卡、逛街手札與設施配置', run: slice1, evidence: ['opening-tamer-name', 'opening-egg-choice', 'ranch-card', 'menu-system', 'cage-edit', 'cage-select'] },
  2: { title: '商店、數碼轉蛋機、5 合 1 合成爐與晶片背包', run: slice2, evidence: ['gacha-machine', 'gacha-reveal-ten', 'gacha-synth', 'gacha-bag'] },
  3: { title: '圖鑑、實機動作、必殺／進化展演與雙五角環相剋表', run: slice3, evidence: ['dex-detail', 'dex-motion', 'dex-element-chart', 'dex-special', 'dex-cutin', 'dex-evolution'] },
  4: { title: '3D 狩獵場、AI 自動對戰與 Data Arena 即時對戰', run: slice4, evidence: ['hunt-field', 'battle-menu', 'battle-team', 'battle-field', 'battle-result', 'arena-match', 'arena-pause'] },
  5: { title: '故事模式、馴獸師執照、炫耀名片、雲端通行證與社群連結塢', run: slice5, evidence: ['story-map', 'story-dialogue', 'story-log', 'echoes-dialogue', 'tamer', 'friends', 'passport-bind', 'social-dock'] }
});

module.exports = { SLICES, Unreachable, ranchSpec, cageSpec, qaSave, continueWith, selectResident, markExit, home, STATUS, RANCH_GROUPS };
