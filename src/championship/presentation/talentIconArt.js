// Talent tree icons (TALENT_TREE_20261118, Owner 2026-11-18: 「樹狀圖…有圖片人家點一下會發亮，按著才會顯示那個天賦
// 的功能作用」). Codex's sticker art, assets/production/ui/talent-icons-r1 (ORIGINAL_GENERATED, manifest there):
// one icon per node and keystone, named by the talent's id, and one emblem per line (`line-hunter` ...).
// An icon that cannot load is replaced by a plain drawn gem in the line's colour, so a node is never empty.

export const TALENT_ICON_BASE = 'assets/production/ui/talent-icons-r1/';
const ICON_ID = /^(?:[a-z]+\.[A-Za-z]+|line-[a-z]+)$/;
export const talentIconSrc = (id) => (typeof id === 'string' && ICON_ID.test(id) ? `${TALENT_ICON_BASE}${id}_96.webp` : null);

/** The drawn stand-in: a gem whose colour comes from the node's line (styles.css, --talent-line). */
export function talentIconFallback({doc = globalThis.document} = {}) {
  const gem = doc.createElement('span');
  gem.className = 'cm-talent-icon cm-talent-icon--drawn';
  gem.setAttribute('aria-hidden', 'true');
  return gem;
}

/** The icon of one talent (or of a line): a decorative image that falls back to the drawn gem. */
export function talentIcon(id, {size = 44, doc = globalThis.document} = {}) {
  const src = talentIconSrc(id);
  if (!src || !doc?.createElement) return doc?.createElement ? talentIconFallback({doc}) : null;
  const image = doc.createElement('img');
  image.className = 'cm-talent-icon';
  image.dataset.icon = id;
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;
  image.width = size;
  image.height = size;
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener?.('error', () => { try { image.replaceWith(talentIconFallback({doc})); } catch { /* detached */ } }, {once: true});
  image.src = src;
  return image;
}
