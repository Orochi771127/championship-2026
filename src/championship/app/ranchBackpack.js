// Owner 2026-10-27: the bag. A read-only view of what the player owns, from the
// shop runtime's own frame: supplies the shop sells and the partners' walks
// bring back (the discovery journal credits the same records). No second
// inventory, no counts of its own; cages stay in the facility editor.
import { showChoiceDialog } from './uiDialog.js';
import { uiText } from '../text/uiText.js';
import { formatNumber } from '../text/locale.js';
import { shopItemName } from '../text/zhHant.js';
import { shopGoodsPresentation } from '../presentation/shopGoodsUiArt.js';

export const BACKPACK_SECTIONS = Object.freeze([
  Object.freeze({ category: 'TRAINING_GOODS', title: '養成用品' }),
  Object.freeze({ category: 'HUNT_ITEMS', title: '狩獵工具' }),
  Object.freeze({ category: 'PLUGINS', title: '外掛' })
]);

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

function itemArt(doc, shopRecordIndex) {
  let art = null;
  try { art = shopGoodsPresentation(shopRecordIndex); } catch { art = null; }
  const frame = doc.createElement('span');
  frame.className = 'cm-backpack__art';
  if (art?.src) {
    const img = doc.createElement('img');
    img.src = art.src; img.alt = ''; img.decoding = 'async';
    frame.append(img);
  } else frame.dataset.placeholder = 'true';
  return frame;
}

export function renderBackpack(doc, shopFrame) {
  const body = doc.createElement('div');
  body.className = 'cm-backpack';
  const wallet = doc.createElement('p');
  wallet.className = 'cm-backpack__wallet';
  wallet.textContent = `${uiText('金幣')} ${formatNumber(shopFrame?.bits ?? 0)}`;
  body.append(wallet);
  const sections = backpackSections(shopFrame);
  if (!sections.length) {
    const empty = doc.createElement('p');
    empty.className = 'cm-backpack__empty';
    empty.textContent = uiText('背包是空的。');
    body.append(empty);
  }
  for (const section of sections) {
    const block = doc.createElement('section');
    block.className = 'cm-backpack__section';
    block.dataset.category = section.category;
    const title = doc.createElement('h3');
    title.textContent = uiText(section.title);
    const grid = doc.createElement('ul');
    grid.className = 'cm-backpack__grid';
    for (const item of section.items) {
      const cell = doc.createElement('li');
      cell.className = 'cm-backpack__item';
      cell.dataset.shopRecord = String(item.shopRecordIndex);
      const name = doc.createElement('span');
      name.className = 'cm-backpack__name';
      name.textContent = uiText(item.name);
      const count = doc.createElement('span');
      count.className = 'cm-backpack__count';
      count.textContent = `×${formatNumber(item.owned)}`;
      cell.append(itemArt(doc, item.shopRecordIndex), name, count);
      grid.append(cell);
    }
    block.append(title, grid);
    body.append(block);
  }
  return body;
}

export function openRanchBackpack({ getShopFrame, doc = globalThis.document, signal = null }) {
  return showChoiceDialog({
    title: uiText('背包'),
    message: uiText('養成用品、狩獵工具與外掛。探索手帳收下的發現也會放進這裡。'),
    content: renderBackpack(doc, getShopFrame?.()),
    variant: 'backpack', signal, doc,
    actions: [{ id: 'close', label: uiText('關閉'), tone: 'primary' }], cancelId: 'close'
  });
}
