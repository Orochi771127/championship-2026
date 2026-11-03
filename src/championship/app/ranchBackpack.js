// Owner 2026-10-27: the bag, from the shop runtime's own frame: supplies the shop
// sells and the partners' walks bring back (the discovery journal credits the
// same records). No second inventory, no counts of its own.
//
// Owner 2026-11-03: the bag is also where gachapon prizes are used. Four tabs --
// daily supplies, overclock chips, evolution metals and ranch automation -- read
// the app's gacha frame, and every row has one 「立即使用 / 掛載」 key (drawn icons, no emoji) that opens
// its picker inline (a partner, a cage or a personality). Every use goes through
// the same app intents as the gachapon centre, which save before they answer.
import { showChoiceDialog } from './uiDialog.js';
import { uiText } from '../text/uiText.js';
import { formatNumber } from '../text/locale.js';
import { shopItemName, cageName, personalityName } from '../text/zhHant.js';
import { shopGoodsPresentation } from '../presentation/shopGoodsUiArt.js';
import { GACHA_PERSONALITY_CHOICES, gachaChipEffectLines } from '../gacha/cyberGacha.js';
import { automationEffectLines, coreRunSeconds, formatRunClock } from '../gacha/ranchAutomation.js';
import { gachaIcon } from './cyberGachaIcons.js';
import { awakeningEnergySummary, enhanceSummary, gachaItemArt, gachaMetalNote, gachaRefusalText, partnerNameplate } from './cyberGachaView.js';

export const BACKPACK_SECTIONS = Object.freeze([
  Object.freeze({ category: 'TRAINING_GOODS', title: '養成用品' }),
  Object.freeze({ category: 'HUNT_ITEMS', title: '狩獵工具' }),
  Object.freeze({ category: 'PLUGINS', title: '外掛' })
]);

export const BACKPACK_TABS = Object.freeze([
  Object.freeze({ id: 'supplies', title: '日常用品' }),
  Object.freeze({ id: 'chips', title: '超頻晶片' }),
  Object.freeze({ id: 'metals', title: '進化金屬' }),
  Object.freeze({ id: 'automation', title: '自動模組' })
]);

// Shop records behind the four Training tools (main.js getFoodStock): using one picks the tool.
export const BACKPACK_SUPPLY_TOOLS = Object.freeze({ 0: 'feed', 1: 'protein', 2: 'medicine', 3: 'woundMedicine' });

/** Owned, non-cage items grouped as the shop groups them. */
export function backpackSections(shopFrame) {
  const listings = shopFrame?.listings ?? [];
  return BACKPACK_SECTIONS.map(({ category, title }) => ({
    category, title,
    items: listings.filter((row) => row.category === category && row.owned > 0)
      .map((row) => ({ shopRecordIndex: row.shopRecordIndex, name: shopItemName(row.shopRecordIndex) ?? row.displayName,
        owned: row.owned, maxOwned: row.maxOwned }))
  })).filter((section) => section.items.length);
}

/**
 * Every bag row per tab: supplies from the shop frame, chips / metals / automation from the
 * gacha frame. A mounted core or a placed royal cage stays listed so it can be managed.
 */
export function backpackTabs(shopFrame, gachaFrame) {
  const supplies = backpackSections(shopFrame).flatMap((section) => section.items.map((item) => ({
    kind: 'SUPPLY', id: `shop:${item.shopRecordIndex}`, name: item.name, owned: item.owned, shopRecordIndex: item.shopRecordIndex,
    category: section.category, tool: BACKPACK_SUPPLY_TOOLS[item.shopRecordIndex] ?? null
  })));
  const chips = (gachaFrame?.chips ?? []).filter((chip) => chip.owned > 0 || chip.armed).map((chip) => ({ ...chip, chipKind: chip.kind, kind: 'CHIP' }));
  const metals = (gachaFrame?.metals ?? []).filter((metal) => metal.owned > 0).map((metal) => ({ ...metal, kind: 'METAL' }));
  const automation = (gachaFrame?.automation ?? []).filter((item) => item.owned > 0 || item.placed > 0)
    .map((item) => ({ ...item, automationKind: item.kind, kind: 'AUTOMATION' }));
  return Object.freeze({ supplies, chips, metals, automation });
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function key(doc, className, label, { primary = false, icon = null } = {}) {
  const node = el(doc, 'button', `cm-backpack__key${primary ? ' cm-backpack__key--primary' : ''}${className ? ` ${className}` : ''}`);
  node.type = 'button';
  // Drawn icons, never system emoji (the gachapon's 2026-10-29 rule).
  if (icon) node.append(gachaIcon(icon, 'cm-backpack__key-icon', doc));
  node.append(el(doc, 'span', 'cm-backpack__key-label', label));
  return node;
}

function itemArt(doc, item) {
  let src = null;
  try {
    src = item.kind === 'SUPPLY' ? shopGoodsPresentation(item.shopRecordIndex)?.src ?? null : gachaItemArt(item)?.src ?? null;
  } catch { src = null; }
  const frame = el(doc, 'span', 'cm-backpack__art');
  if (item.rarity) frame.dataset.rarity = item.rarity;
  if (src) {
    const img = doc.createElement('img');
    img.src = src; img.alt = ''; img.decoding = 'async';
    frame.append(img);
  } else frame.dataset.placeholder = 'true';
  return frame;
}

/** Where a core's machines run now, with the time left (a royal cage's built-in pair is not a deployment). */
function mountedAt(item, gacha) {
  return (gacha?.cages ?? []).filter((cage) => !cage.royal && coreRunSeconds(cage, item) > 0)
    .map((cage) => `${cageName(cage.definitionIndex, '')} ${formatRunClock(coreRunSeconds(cage, item))}`);
}
/** What one core runs, for the bag row (Owner 2026-11-03: say it lasts one hour). */
function coreDutyLine(item) {
  if (item.id === 'auto:royal-core') return uiText('每次持續 1 小時（掃地機器人＋自動餵食機）');
  return uiText(item.module === 'AUTO_FEED' ? '每次持續 1 小時（自動丟肉，扣餵食）' : '每次持續 1 小時（自動巡邏清便）');
}

function effectLine(item) {
  if (item.kind === 'CHIP') { const line = gachaChipEffectLines({ ...item, kind: item.chipKind })[0]; return line ? uiText(line.text, line.params) : ''; }
  if (item.kind === 'METAL') return gachaMetalNote(item);
  if (item.kind === 'AUTOMATION') { const line = automationEffectLines(item)[0]; return line ? uiText(line.text, line.params) : ''; }
  if (item.tool) return uiText('選取育成工具，再點牧場上的拍檔使用。');
  return uiText(item.category === 'HUNT_ITEMS' ? '出發狩獵時在裝備欄使用。' : '出發狩獵或對戰時自動生效。');
}

/** What a finished intent says in the bag's receipt line. */
export function backpackReceiptText(result) {
  if (!result) return '';
  if (!result.ok) return gachaRefusalText(result.reason);
  if (result.kind === 'ARMED') return uiText('已裝填，下次狩獵／勝利時生效。');
  if (result.kind === 'DISARMED') return uiText('已取回');
  if (result.kind === 'DEPLOY') return uiText('已部署：機器運轉 1 小時，到牧場看看它！');
  if (result.kind === 'EXTEND') return uiText('已延長 +1 小時');
  if (result.kind === 'CATALYST') return uiText('催化完成：回到牧場看拍檔進化！');
  return enhanceSummary(result) || awakeningEnergySummary(result) || uiText('已使用');
}

export function renderBackpack(doc, shopFrame) {
  return createBackpackPanel({ doc, getShopFrame: () => shopFrame }).element;
}

/**
 * The live bag panel. `intents` are app calls that return the app's own receipt:
 * useItem(itemId, instanceId, {mode}), reshape(instanceId, personality), deployCore(coreId, cageId),
 * disarm(itemId), selectTool(toolId) and openFacilities().
 */
export function createBackpackPanel({ doc = globalThis.document, getShopFrame, getGachaFrame = () => null, intents = {},
  tab = 'supplies', partnerId = null, onLeave = () => {} } = {}) {
  const body = el(doc, 'div', 'cm-backpack');
  body.dataset.tab = tab;
  const state = { tab, open: null, partner: partnerId, personality: null, receipt: null };

  function paint() {
    const shopFrame = getShopFrame?.() ?? null, gacha = getGachaFrame?.() ?? null;
    const tabs = backpackTabs(shopFrame, gacha);
    body.replaceChildren();
    body.dataset.tab = state.tab;
    const wallet = el(doc, 'p', 'cm-backpack__wallet', `${uiText('金幣')} ${formatNumber(shopFrame?.bits ?? 0)}`);
    if (Number.isSafeInteger(gacha?.tickets)) wallet.append(el(doc, 'span', 'cm-backpack__tickets', ` · ${uiText('轉蛋券')} ${formatNumber(gacha.tickets)}`));
    const bar = el(doc, 'div', 'cm-backpack__tabs');
    bar.setAttribute('role', 'tablist');
    for (const entry of BACKPACK_TABS) {
      const button = el(doc, 'button', 'cm-backpack__tab');
      button.type = 'button';
      button.dataset.tab = entry.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(state.tab === entry.id));
      button.append(el(doc, 'span', 'cm-backpack__tab-label', uiText(entry.title)), el(doc, 'span', 'cm-backpack__tab-count', formatNumber(tabs[entry.id].length)));
      button.addEventListener('click', () => { state.tab = entry.id; state.open = null; state.receipt = null; paint(); });
      bar.append(button);
    }
    body.append(wallet, bar);
    if (state.receipt) {
      const receipt = el(doc, 'p', 'cm-backpack__receipt', state.receipt.text);
      receipt.dataset.ok = String(state.receipt.ok);
      receipt.setAttribute('role', 'status');
      body.append(receipt);
    }
    const items = tabs[state.tab];
    const list = el(doc, 'ul', 'cm-backpack__list');
    list.setAttribute('role', 'tabpanel');
    if (!items.length) {
      body.append(el(doc, 'p', 'cm-backpack__empty', uiText(state.tab === 'supplies' ? '背包是空的。'
        : state.tab === 'automation' ? '還沒有自動化模組。到商店的轉蛋機轉轉看！' : '還沒有這類道具。到商店的轉蛋機轉轉看！')));
      return;
    }
    for (const item of items) list.append(row(item, gacha));
    body.append(list);
  }

  function row(item, gacha) {
    const node = el(doc, 'li', 'cm-backpack__item');
    node.dataset.itemId = item.id;
    node.dataset.kind = item.kind;
    if (item.shopRecordIndex !== undefined) node.dataset.shopRecord = String(item.shopRecordIndex);
    const copy = el(doc, 'span', 'cm-backpack__copy');
    const title = el(doc, 'span', 'cm-backpack__name', uiText(item.name));
    if (item.rarity) title.prepend(el(doc, 'span', 'cm-backpack__rarity', item.rarity));
    copy.append(title, el(doc, 'span', 'cm-backpack__effect', effectLine(item)));
    const count = el(doc, 'span', 'cm-backpack__count', `×${formatNumber(item.owned)}`);
    const flags = [];
    if (item.armed) flags.push(uiText('已裝填'));
    if (item.kind === 'AUTOMATION' && item.placed > 0 && item.edition) flags.push(uiText('已放置 {n}', { n: item.placed }));
    if (flags.length) copy.append(el(doc, 'span', 'cm-backpack__flag', flags.join('・')));
    if (item.kind === 'AUTOMATION' && item.automationKind === 'CORE') copy.append(el(doc, 'span', 'cm-backpack__duty', coreDutyLine(item)));
    // Owner 2026-11-03: a core says where its machine runs now, by cage name, with the time left.
    const at = item.kind === 'AUTOMATION' && !item.edition ? mountedAt(item, gacha) : [];
    if (at.length) {
      const where = el(doc, 'span', 'cm-backpack__mounted', uiText('運轉中：{cages}', { cages: at.join('、') }));
      where.dataset.count = String(at.length);
      copy.append(where);
    }
    const action = actionKey(item);
    node.append(itemArt(doc, item), copy, count);
    if (action) node.append(action);
    if (state.open === item.id) node.append(picker(item, gacha));
    return node;
  }

  function actionKey(item) {
    // A care supply picks its tool; hunt tools and plug-ins are used out on a hunt, so their key sets out.
    const usable = item.kind === 'SUPPLY' ? Boolean(item.tool ? intents.selectTool : intents.openHunt) : true;
    if (!usable) return null;
    const mount = item.kind === 'AUTOMATION', core = mount && item.automationKind === 'CORE';
    const huntUse = item.kind === 'SUPPLY' && !item.tool;
    const button = key(doc, 'cm-backpack__use', uiText(core ? '部署 1 小時 / 延長 +1 小時' : mount ? '前往放置' : huntUse ? '出發狩獵使用' : '立即使用'),
      { primary: true, icon: mount ? 'robot' : huntUse ? 'hunt' : 'bolt' });
    button.dataset.use = item.id;
    button.setAttribute('aria-expanded', String(state.open === item.id));
    button.disabled = item.owned < 1 && !(mount && !core && item.placed > 0) && !item.armed;
    button.addEventListener('click', () => {
      if (item.kind === 'SUPPLY') { if (item.tool) intents.selectTool?.(item.tool); else intents.openHunt?.(); onLeave(); return; }
      state.open = state.open === item.id ? null : item.id;
      state.receipt = null;
      paint();
    });
    return button;
  }

  function finish(result) {
    state.receipt = { ok: Boolean(result?.ok), text: backpackReceiptText(result) };
    if (result?.ok) { state.open = null; state.personality = null; }
    paint();
    body.querySelector('.cm-backpack__receipt')?.dispatchEvent(new CustomEvent('cm-fx', { bubbles: true, detail: { kind: result?.ok ? 'purchase' : 'denied' } }));
  }

  function partnerPicker(gacha, item) {
    const grid = el(doc, 'div', 'cm-backpack__choices');
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', uiText('選擇拍檔'));
    for (const partner of gacha?.partners ?? []) {
      const pick = el(doc, 'button', 'cm-backpack__choice');
      pick.type = 'button';
      pick.dataset.instanceId = partner.instanceId;
      pick.setAttribute('role', 'radio');
      pick.setAttribute('aria-checked', String(state.partner === partner.instanceId));
      pick.append(partnerNameplate(partner));
      if (item.kind === 'METAL' && !partner.inRanch) pick.dataset.away = 'true';
      pick.addEventListener('click', () => { state.partner = partner.instanceId; state.personality = null; paint(); });
      grid.append(pick);
    }
    if (!grid.childElementCount) grid.append(el(doc, 'p', 'cm-backpack__empty', uiText('還沒有可以使用的拍檔。')));
    return grid;
  }

  function picker(item, gacha) {
    const panel = el(doc, 'div', 'cm-backpack__picker');
    if (item.kind === 'AUTOMATION') {
      if (item.automationKind !== 'CORE') {
        panel.append(el(doc, 'p', 'cm-backpack__note', uiText('皇家籠舍要擺到牧場上：在「設施配置」的 4~5格 卡匣中直接擺放。')));
        const go = key(doc, '', uiText('前往設施配置'), { primary: true });
        go.addEventListener('click', () => { onLeave(); intents.openFacilities?.(); });
        if (intents.openFacilities) panel.append(go);
        return panel;
      }
      panel.append(el(doc, 'p', 'cm-backpack__note', uiText('選一座籠舍：每次用掉 1 個、運轉 1 小時；運轉中的再投入一個就延長 +1 小時（最多 24 小時）。不相連的籠舍可以各放一台。')));
      const cages = el(doc, 'div', 'cm-backpack__choices');
      for (const cage of gacha?.cages ?? []) {
        const left = coreRunSeconds(cage, item), full = left + (item.runSeconds ?? 3600) > (item.runCapSeconds ?? 86400);
        const pick = el(doc, 'button', 'cm-backpack__choice cm-backpack__cage');
        pick.type = 'button';
        pick.dataset.instanceId = cage.instanceId;
        pick.dataset.mounted = String(left > 0);
        const label = cage.royal ? uiText(cage.edition === 'STELLAR_ZOO' ? '全自動星際動物園' : '全自動皇家牧場') : cageName(cage.definitionIndex, '');
        pick.append(el(doc, 'span', 'cm-backpack__cage-name', label),
          el(doc, 'span', 'cm-backpack__cage-state', cage.royal ? uiText('已內建') : left > 0
            ? uiText('剩 {time} · 延長 +1 小時', { time: formatRunClock(left) }) : uiText('部署 1 小時')));
        pick.disabled = cage.royal || item.owned < 1 || full;
        pick.addEventListener('click', () => finish(intents.deployCore?.(item.id, cage.instanceId)));
        cages.append(pick);
      }
      if (!cages.childElementCount) cages.append(el(doc, 'p', 'cm-backpack__empty', uiText('先到「設施配置」放置並確認籠舍。')));
      panel.append(cages);
      return panel;
    }
    if (item.kind === 'CHIP' && item.chipKind !== 'GROWTH') {
      panel.append(el(doc, 'p', 'cm-backpack__note', uiText(item.chipKind === 'HUNT' ? '裝填後，下一次狩獵自動生效。' : '裝填後，下一場勝利自動生效。')));
      const actions = el(doc, 'div', 'cm-backpack__actions');
      const arm = key(doc, '', uiText('裝填'), { primary: true });
      arm.disabled = item.owned < 1;
      arm.addEventListener('click', () => finish(intents.useItem?.(item.id, null, { mode: 'USE' })));
      actions.append(arm);
      if (item.armed && intents.disarm) {
        const back = key(doc, '', uiText('取回'));
        back.addEventListener('click', () => finish(intents.disarm(item.id)));
        actions.append(back);
      }
      panel.append(actions);
      return panel;
    }
    panel.append(el(doc, 'p', 'cm-backpack__note', uiText('選擇要使用的拍檔：')), partnerPicker(gacha, item));
    const reshape = item.id === 'chip:personality';
    if (reshape) {
      const current = gacha?.partners?.find((p) => p.instanceId === state.partner)?.stats?.personalityIndex ?? null;
      const grid = el(doc, 'div', 'cm-backpack__choices cm-backpack__choices--personality');
      grid.setAttribute('role', 'radiogroup');
      grid.setAttribute('aria-label', uiText('選擇新的性格'));
      for (let index = 0; index < GACHA_PERSONALITY_CHOICES; index += 1) {
        const pick = el(doc, 'button', 'cm-backpack__choice', personalityName(index) ?? String(index));
        pick.type = 'button';
        pick.setAttribute('role', 'radio');
        pick.setAttribute('aria-checked', String(state.personality === index));
        pick.disabled = !state.partner || index === current;
        pick.addEventListener('click', () => { state.personality = index; paint(); });
        grid.append(pick);
      }
      panel.append(grid);
    }
    const actions = el(doc, 'div', 'cm-backpack__actions');
    const go = (mode, label, primary, icon) => {
      const button = key(doc, '', uiText(label), { primary, icon });
      button.dataset.useMode = mode;
      button.disabled = !state.partner || item.owned < 1 || (reshape && state.personality === null);
      button.addEventListener('click', () => finish(reshape ? intents.reshape?.(state.partner, state.personality)
        : intents.useItem?.(item.id, state.partner, { mode })));
      actions.append(button);
    };
    if (item.kind === 'METAL') { go('ENHANCE', '強化銘刻', true, 'spark'); go('CATALYST', '催化進化', false, 'evolve'); }
    else go('USE', '使用晶片', true, 'spark');
    panel.append(actions);
    return panel;
  }

  paint();
  return Object.freeze({ element: body, refresh: paint });
}

/**
 * Open the bag. With only `getShopFrame` it is the read-out of supplies; with the gacha frame and
 * intents it also uses chips and metals and mounts cores. `tab` / `partnerId` preselect, e.g. a
 * partner card's 「使用晶片」 opens the chips with that partner chosen.
 */
export function openRanchBackpack({ getShopFrame, getGachaFrame, intents, tab = 'supplies', partnerId = null, doc = globalThis.document, signal = null }) {
  const leave = new AbortController();
  if (signal) signal.addEventListener('abort', () => leave.abort(), { once: true });
  const panel = createBackpackPanel({ doc, getShopFrame, getGachaFrame, intents, tab, partnerId, onLeave: () => leave.abort() });
  return showChoiceDialog({
    title: uiText('背包'),
    message: uiText('養成用品、轉蛋晶片、進化金屬與自動化模組。探索手帳收下的發現也會放進這裡。'),
    content: panel.element,
    variant: 'backpack', signal: leave.signal, doc,
    actions: [{ id: 'close', label: uiText('關閉'), tone: 'primary' }], cancelId: 'close'
  });
}
