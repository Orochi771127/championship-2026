// Partner star emblems (ROADMAP_R3_20261118, Owner 2026-11-18: mechanics are shown as game art and motion,
// never as a sentence). The emblem is Codex's sticker art (assets/production/ui/tamer-emblems-r1,
// ORIGINAL_GENERATED, manifest there): a lit star, an empty socket and a burst for the star-up moment.
// An image that fails to load is replaced by the same star drawn as paths -- no font glyph and no emoji --
// so the count never disappears. Colours and motion live in app/styles.css.
import {svgElement} from './taxonomyBadgeArt.js';

export const STAR_EMBLEM_MAX = 5;
export const STAR_EMBLEM_BASE = 'assets/production/ui/tamer-emblems-r1/';
export const starEmblemSrc = (kind) => `${STAR_EMBLEM_BASE}star-${kind}_96.webp`;
// viewBox 0 0 24 24. One five-point star with rounded joins, its upper facet and a glint.
const STAR_BODY = 'M12 2.1l2.95 6.2 6.75.85-4.95 4.7 1.28 6.75L12 17.3l-6.03 3.3 1.28-6.75-4.95-4.7 6.75-.85z';
const STAR_FACET = 'M12 2.1l2.95 6.2 6.75.85-4.95 4.7L12 12.1 7.25 13.85 2.3 9.15l6.75-.85z';
const STAR_GLINT = 'M8.1 8.6l1.5-3.1';

function path(d, className) {
  const node = svgElement('path');
  node.setAttribute('d', d);
  node.setAttribute('class', className);
  return node;
}

/** One star emblem: the sticker art, or the drawn star when the image cannot load. `on` false is the empty socket. */
export function starEmblem({on = true, size = 20, doc = globalThis.document} = {}) {
  const image = doc?.createElement?.('img');
  if (!image) return drawnStarEmblem({on, size});
  image.className = 'cm-star cm-star--art';
  image.dataset.on = String(Boolean(on));
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;
  image.width = size;
  image.height = size;
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener?.('error', () => { try { image.replaceWith(drawnStarEmblem({on, size})); } catch { /* detached */ } }, {once: true});
  image.src = starEmblemSrc(on ? 'on' : 'off');
  return image;
}

/** The same star as paths (the fallback, and what a document without images gets). */
export function drawnStarEmblem({on = true, size = 20} = {}) {
  const svg = svgElement('svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'cm-star');
  svg.dataset.on = String(Boolean(on));
  svg.append(path(STAR_BODY, 'cm-star__body'));
  if (on) svg.append(path(STAR_FACET, 'cm-star__facet'), path(STAR_GLINT, 'cm-star__glint'));
  return svg;
}

/**
 * A row of five emblems. `star` are lit; the last `gained` of them are marked new (they stamp in);
 * `ghost` more after them blink as a preview of what a fusion would give.
 * The row carries data-star so a screen reader label or a test can read the count without the art.
 */
export function starPips({star = 1, gained = 0, ghost = 0, size = 20, burst = false, doc = globalThis.document} = {}) {
  const lit = Math.max(1, Math.min(STAR_EMBLEM_MAX, Math.floor(star) || 1));
  const row = doc.createElement('span');
  row.className = 'cm-stars';
  row.dataset.star = String(lit);
  for (let index = 1; index <= STAR_EMBLEM_MAX; index += 1) {
    const cell = doc.createElement('span');
    cell.className = 'cm-stars__cell';
    cell.style.setProperty('--i', String(index - 1));
    const on = index <= lit, preview = !on && index <= lit + ghost;
    if (on && index > lit - gained) cell.dataset.new = 'true';
    if (preview) cell.dataset.ghost = 'true';
    // The star-up moment: rays and sparks flash behind each star as it is stamped in.
    if (burst && cell.dataset.new === 'true') {
      const flash = doc.createElement('img');
      flash.className = 'cm-stars__burst';
      flash.alt = ''; flash.decoding = 'async'; flash.draggable = false;
      flash.setAttribute('aria-hidden', 'true');
      flash.addEventListener?.('error', () => flash.remove(), {once: true});
      flash.src = starEmblemSrc('burst');
      cell.append(flash);
    }
    cell.append(starEmblem({on: on || preview, size, doc}));
    row.append(cell);
  }
  return row;
}

/**
 * The star meter: `need` notches, `points` of them filled, the next `preview` striped as what a fusion
 * would add. At five stars (`need` 0) the meter is one full gold bar.
 */
export function starMeter({points = 0, need = 0, preview = 0, doc = globalThis.document} = {}) {
  const meter = doc.createElement('span');
  meter.className = 'cm-star-meter';
  const full = !(need > 0), filled = full ? 1 : Math.max(0, Math.min(need, points)), ahead = full ? 0 : Math.max(0, Math.min(need - filled, preview));
  meter.dataset.full = String(full);
  meter.style.setProperty('--notches', String(full ? 1 : need));
  meter.style.setProperty('--fill', String(full ? 1 : filled / need));
  meter.style.setProperty('--ahead', String(full ? 0 : ahead / need));
  meter.dataset.points = String(full ? 0 : filled);
  meter.dataset.need = String(full ? 0 : need);
  const fill = doc.createElement('i'); fill.className = 'cm-star-meter__fill';
  const next = doc.createElement('i'); next.className = 'cm-star-meter__ahead';
  const ticks = doc.createElement('i'); ticks.className = 'cm-star-meter__ticks';
  meter.append(fill, next, ticks);
  return meter;
}

/** The level against the cap its stars give: a gauge that reads full, and glows, at the cap. */
export function starLevelGauge({level = 1, cap = 10, capped = false, doc = globalThis.document} = {}) {
  const gauge = doc.createElement('span');
  gauge.className = 'cm-star-gauge';
  gauge.dataset.capped = String(Boolean(capped));
  gauge.style.setProperty('--fill', String(Math.max(0, Math.min(1, level / Math.max(1, cap)))));
  const bar = doc.createElement('i'); bar.className = 'cm-star-gauge__fill';
  const label = doc.createElement('b'); label.className = 'cm-star-gauge__label'; label.textContent = `Lv.${level}`;
  const top = doc.createElement('small'); top.className = 'cm-star-gauge__cap'; top.textContent = `/${cap}`;
  gauge.append(bar, label, top);
  return gauge;
}
