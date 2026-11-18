// Tamer roadmap emblems (MECHANICS_AS_GAME_NOT_TEXT_20261118: a mechanic is shown as art and motion, never as
// a sentence). Codex's sticker art, assets/production/ui/tamer-emblems-r1 (ORIGINAL_GENERATED, manifest there):
// the EXP crystal, the tamer level badge, the rank and level padlocks and the evolve-ready emblem. An emblem is
// decoration beside a number or a name that still reads on its own, so one that fails to load removes itself.
import {prefersReducedMotion} from './presentationPreferences.js';

export const TAMER_EMBLEM_BASE = 'assets/production/ui/tamer-emblems-r1/';
export const TAMER_EMBLEMS = Object.freeze(['exp-crystal', 'tamer-level-badge', 'lock-rank', 'lock-level', 'evolve-ready']);
export const tamerEmblemSrc = (kind) => (TAMER_EMBLEMS.includes(kind) ? `${TAMER_EMBLEM_BASE}${kind}_96.webp` : null);

/** One emblem as a decorative image, or null for an unknown kind or a document without elements. */
export function tamerEmblem(kind, {size = 20, doc = globalThis.document} = {}) {
  const src = tamerEmblemSrc(kind), image = src ? doc?.createElement?.('img') : null;
  if (!image) return null;
  image.className = 'cm-emblem';
  image.dataset.emblem = kind;
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;
  image.width = size;
  image.height = size;
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener?.('error', () => image.remove(), {once: true});
  image.src = src;
  return image;
}

/** The tamer's level badge: the whistle disc with the level number in its lower half. */
export function tamerLevelBadge({level = 1, size = 52, doc = globalThis.document} = {}) {
  const badge = doc.createElement('span');
  badge.className = 'cm-tamer-badge';
  badge.dataset.level = String(level);
  badge.style.setProperty('--badge-size', `${size}px`);
  const art = tamerEmblem('tamer-level-badge', {size, doc});
  if (art) badge.append(art);
  const number = doc.createElement('b');
  number.className = 'cm-tamer-badge__level';
  number.textContent = String(level);
  badge.append(number);
  return badge;
}

/**
 * A few emblems fly from one element to another (crystals poured into a gauge). Decoration only: it reads
 * nothing and changes nothing, runs on Web Animations, and does nothing under reduced motion or without
 * layout. Returns the number of emblems launched.
 */
export function flyEmblems({from, to, kind = 'exp-crystal', count = 8, size = 18, doc = globalThis.document} = {}) {
  if (!from?.getBoundingClientRect || !to?.getBoundingClientRect || !doc?.body || prefersReducedMotion(doc)) return 0;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (!(a.width > 0) || !(b.width > 0)) return 0;
  const startX = a.left + a.width / 2, startY = a.top + a.height / 2;
  let launched = 0;
  for (let index = 0; index < count; index += 1) {
    const piece = tamerEmblem(kind, {size, doc});
    if (!piece?.animate) break;
    piece.classList.add('cm-emblem--flying');
    piece.style.left = `${startX - size / 2}px`;
    piece.style.top = `${startY - size / 2}px`;
    doc.body.append(piece);
    // Each piece lands on its own spot along the target and arcs a little differently (index-driven, no RNG).
    const endX = b.left + b.width * ((index + 0.5) / count), endY = b.top + b.height / 2;
    const dx = endX - startX, dy = endY - startY, lift = -28 - (index % 3) * 14;
    const run = piece.animate([
      {transform: 'translate(0, 0) scale(0.6)', opacity: 0},
      {transform: `translate(${dx * 0.45}px, ${dy * 0.45 + lift}px) scale(1.15)`, opacity: 1, offset: 0.45},
      {transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.2}
    ], {duration: 520 + index * 40, delay: index * 45, easing: 'cubic-bezier(0.3, 0.1, 0.3, 1)', fill: 'backwards'});
    const done = () => piece.remove();
    run.addEventListener?.('finish', done); run.addEventListener?.('cancel', done);
    launched += 1;
  }
  return launched;
}
