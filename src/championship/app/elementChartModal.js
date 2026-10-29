// Element chart: the earthly and celestial rings as two pentagons with clockwise "beats" arrows,
// the resistance-bar legend, and a focus banner for the partner it was opened from.
import {TAXONOMY_RINGS, TAXONOMY_RESISTANCE_AXES, elementMatchup} from '../contracts/speciesTaxonomy.js';
import {taxonomyText} from '../text/taxonomyText.js';
import {taxonomyBadge, taxonomyGlyph, TAXONOMY_COLORS, svgElement} from '../presentation/taxonomyBadgeArt.js';

const svgNode = (tag, attrs = {}) => { const n = svgElement(tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
const RADIUS = 66, NODE = 21, SIZE = 196;

function ringSvg(ring, focus, onPick) {
  const svg = svgNode('svg', {viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'cm-element-chart__ring', role: 'group'});
  svg.setAttribute('aria-label', taxonomyText(`ring.${ring}`));
  const defs = svgNode('defs');
  const marker = svgNode('marker', {id: `cm-chart-arrow-${ring}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'});
  marker.append(svgNode('path', {d: 'M0 0L10 5 0 10z', class: 'cm-element-chart__arrowhead'}));
  defs.append(marker); svg.append(defs);
  const center = SIZE / 2, elements = TAXONOMY_RINGS[ring];
  const point = i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [center + RADIUS * Math.cos(a), center + RADIUS * Math.sin(a)]; };
  const focusMatch = focus ? elementMatchup(focus) : null;
  elements.forEach((from, i) => {
    const to = elements[(i + 1) % 5], [x1, y1] = point(i), [x2, y2] = point((i + 1) % 5);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const arrow = svgNode('line', {x1: x1 + ux * (NODE + 3), y1: y1 + uy * (NODE + 3), x2: x2 - ux * (NODE + 5), y2: y2 - uy * (NODE + 5),
      class: 'cm-element-chart__arrow', 'marker-end': `url(#cm-chart-arrow-${ring})`});
    if (focus === from) arrow.classList.add('is-beats');
    if (focusMatch?.beatenBy === from && to === focus) arrow.classList.add('is-beaten');
    svg.append(arrow);
  });
  elements.forEach((el, i) => {
    const [x, y] = point(i), id = `element.${el}`;
    const node = svgNode('g', {class: 'cm-element-chart__node', tabindex: 0, role: 'button', 'data-element': el, transform: `translate(${x} ${y})`});
    node.setAttribute('aria-label', taxonomyText(id));
    node.style.setProperty('--tax-color', TAXONOMY_COLORS[id]);
    if (el === focus) node.classList.add('is-focus');
    if (focusMatch?.beats === el) node.classList.add('is-beaten-target');
    if (focusMatch?.beatenBy === el) node.classList.add('is-threat');
    node.append(svgNode('circle', {r: NODE, class: 'cm-element-chart__disc'}));
    const glyph = taxonomyGlyph(id, 22); glyph.setAttribute('x', -11); glyph.setAttribute('y', -15);
    node.append(glyph);
    const label = svgNode('text', {y: 15, 'text-anchor': 'middle', class: 'cm-element-chart__label'}); label.textContent = taxonomyText(id);
    node.append(label);
    const pick = () => onPick(el);
    node.addEventListener('click', pick);
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } });
    svg.append(node);
  });
  return svg;
}

/** Open the chart, focused on `focusElement` when given. Returns {dialog, close}. */
export function openElementChart({focusElement = null, root = document.body} = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cm-element-chart';
  dialog.setAttribute('aria-labelledby', 'cm-element-chart-title');
  let focus = focusElement;
  const render = () => {
    dialog.replaceChildren();
    const head = document.createElement('header'); head.className = 'cm-element-chart__head';
    const title = document.createElement('h2'); title.id = 'cm-element-chart-title'; title.textContent = taxonomyText('chart.title');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'cm-element-chart__close'; close.textContent = taxonomyText('chart.close');
    close.addEventListener('click', () => api.close());
    head.append(title, close);
    const banner = document.createElement('p'); banner.className = 'cm-element-chart__banner';
    const m = focus ? elementMatchup(focus) : null;
    banner.textContent = m ? taxonomyText('chart.focus', {element: taxonomyText(`element.${focus}`), beats: taxonomyText(`element.${m.beats}`), beatenBy: taxonomyText(`element.${m.beatenBy}`)}) : taxonomyText('chart.pick');
    banner.dataset.focus = focus ?? '';
    const rings = document.createElement('div'); rings.className = 'cm-element-chart__rings';
    for (const ring of Object.keys(TAXONOMY_RINGS)) {
      const figure = document.createElement('figure'); figure.className = 'cm-element-chart__figure'; figure.dataset.ring = ring;
      const caption = document.createElement('figcaption'); caption.textContent = taxonomyText(`ring.${ring}`);
      figure.append(caption, ringSvg(ring, focus, el => { focus = el; render(); dialog.querySelector(`[data-element="${el}"]`)?.focus(); }));
      rings.append(figure);
    }
    const rules = document.createElement('p'); rules.className = 'cm-element-chart__rules';
    const strong = document.createElement('span'); strong.className = 'cm-element-chart__rule is-beats'; strong.textContent = taxonomyText('chart.effective');
    const weak = document.createElement('span'); weak.className = 'cm-element-chart__rule is-beaten'; weak.textContent = taxonomyText('chart.resisted');
    const physical = document.createElement('span'); physical.className = 'cm-element-chart__rule'; physical.textContent = taxonomyText('chart.physical');
    rules.append(strong, weak, physical);
    const legend = document.createElement('dl'); legend.className = 'cm-element-chart__axes';
    const legendTitle = document.createElement('p'); legendTitle.className = 'cm-element-chart__axes-title'; legendTitle.textContent = taxonomyText('chart.axes');
    for (const [axis, pair] of Object.entries(TAXONOMY_RESISTANCE_AXES)) {
      const row = document.createElement('div'); row.className = 'cm-element-chart__axis'; row.dataset.axis = axis;
      const dt = document.createElement('dt'); dt.textContent = taxonomyText(`axis.${axis}`);
      const dd = document.createElement('dd'); dd.append(...pair.map(el => taxonomyBadge('element', el)));
      row.append(dt, dd); legend.append(row);
    }
    dialog.append(head, banner, rings, rules, legendTitle, legend);
  };
  const api = {dialog, close() { if (dialog.open) dialog.close(); dialog.remove(); }, focus: () => focus};
  dialog.addEventListener('cancel', event => { event.preventDefault(); api.close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) api.close(); });
  render();
  root.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  return api;
}

/** The "element chart" button placed next to an element badge. */
export function elementChartButton(focusElement = null, {root} = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cm-element-chart-button';
  button.dataset.focus = focusElement ?? '';
  const label = document.createElement('span'); label.textContent = taxonomyText('chart.open');
  button.append(taxonomyGlyph('mark.CHART', 16), label);
  button.addEventListener('click', event => { event.stopPropagation(); openElementChart({focusElement, root: root ?? button.ownerDocument.body}); });
  return button;
}
