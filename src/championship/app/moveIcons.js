// Move icons (UNIFIED_MOVES_20261118, U2). Owner 2026-11-18: 「跟 Codex CLI 讓 Codex 生成這些
//招式的小圖示」. Art: assets/production/ui/move-icons-r1 (ORIGINAL_GENERATED, manifest there):
// one 64 px WebP per move — a species or original move by its record index, a Data Arena
// move by its id. The same icon serves the auto battle, the Data Arena and the Dex; an icon
// that fails to load removes itself so the move's name beside it still reads on its own.

export const MOVE_ICON_BASE = 'assets/production/ui/move-icons-r1/';

/** The icon key of a move id: a record index, an `own-<record>` arena id, or an arena move id. */
export function moveIconKey(id) {
  if (typeof id === 'string' && id.startsWith('own-')) return Number(id.slice(4));
  if (Number.isSafeInteger(id) || (typeof id === 'string' && /^[a-zA-Z]+$/.test(id))) return id;
  return null;
}

export const moveIconSrc = (id) => {
  const key = moveIconKey(id);
  return key === null ? null : `${MOVE_ICON_BASE}move_${key}_64.webp`;
};

/** A decorative <img> for one move (the caller shows its name), or null for an unknown id. */
export function moveIcon(id, className = 'cm-move-icon', doc = globalThis.document) {
  const src = moveIconSrc(id);
  if (!src || !doc?.createElement) return null;
  const image = doc.createElement('img');
  image.className = className;
  image.dataset.moveIcon = String(moveIconKey(id));
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'lazy';
  image.width = 64;
  image.height = 64;
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener?.('error', () => image.remove(), { once: true });
  image.src = src;
  return image;
}
