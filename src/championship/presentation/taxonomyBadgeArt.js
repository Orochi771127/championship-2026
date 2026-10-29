// Geometric SVG emblems for the three-axis taxonomy: 10 elements, 3 factions, 8 races.
// Drawn paths only (no font glyphs or emoji), so every platform shows the same mark.
import {taxonomyText} from '../text/taxonomyText.js';

// The SVG namespace comes from the parser, so this module carries no URL literal.
let svgNamespace;
export function svgElement(tag) {
  if (svgNamespace === undefined) { const probe = document.createElement('div'); probe.innerHTML = '<svg></svg>'; svgNamespace = probe.firstChild?.namespaceURI ?? null; }
  return svgNamespace ? document.createElementNS(svgNamespace, tag) : document.createElement(tag);
}
// viewBox 0 0 24 24; [fill paths, stroke paths].
const GLYPHS = Object.freeze({
  'element.METAL': [['M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z'], ['M8 16l8-8', 'M12 2.5v4M12 17.5v4']],
  'element.WOOD': [['M12 13C12 8 9 4.5 4 4.5 4 9.5 7 13 12 13z', 'M12 15c0-4.5 3.2-7.5 8-7.5 0 4.5-3.2 7.5-8 7.5z'], ['M12 21.5V11']],
  'element.EARTH': [['M2.5 20l6.2-10.5 4 5.2 3-4.2L21.5 20z'], ['M8.7 9.5l1.6 2.6M15.7 10.5l1.2 1.8']],
  'element.WATER': [['M12 2.5C8 7.5 6 10.6 6 14a6 6 0 0012 0c0-3.4-2-6.5-6-11.5z'], ['M9.2 14.6a3 3 0 004.8 1.9']],
  'element.FIRE': [['M12 2c1 4.2 6 6.4 6 12.2a6 6 0 01-12 0c0-3.2 1.8-5.3 3.2-7.2.1 2 1 3.2 2.2 3.4.2-3.4-.2-5.6.6-8.4z'], ['M12 20.5a2.6 2.6 0 01-2.6-2.6c0-1.7 1.4-2.6 2.6-4.3 1.2 1.7 2.6 2.6 2.6 4.3a2.6 2.6 0 01-2.6 2.6z']],
  'element.SUN': [['M12 7.2a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6z'], ['M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1']],
  'element.ICE': [[], ['M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7', 'M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2M3.6 10.2l2.9-.6-.8-2.9M20.4 13.8l-2.9.6.8 2.9M3.6 13.8l2.9.6-.8 2.9M20.4 10.2l-2.9-.6.8-2.9']],
  'element.WIND': [[], ['M3 8.5h11a3 3 0 10-3-3', 'M3 12.5h15.5a3 3 0 11-3 3', 'M3 16.5h7']],
  'element.THUNDER': [['M13.5 1.8L4.5 13.8h6.8l-1.3 8.4 9.5-12.6h-7z'], []],
  'element.MOON': [['M12 2.5a7 7 0 008.8 9.6A9.5 9.5 0 1112 2.5z'], ['M18.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z']],
  'faction.LUMEN': [['M12 20.5S3.5 15.4 3.5 9.4A4.4 4.4 0 0112 7.3a4.4 4.4 0 018.5 2.1c0 6-8.5 11.1-8.5 11.1z'], ['M12 1.5v2.6M5 3.6l1.3 2M19 3.6l-1.3 2']],
  'faction.IRON': [['M10.4 2h3.2l.5 2.6 2 .9 2.2-1.5 2.3 2.3-1.5 2.2.9 2 2.6.5v3.2l-2.6.5-.9 2 1.5 2.2-2.3 2.3-2.2-1.5-2 .9-.5 2.6h-3.2l-.5-2.6-2-.9-2.2 1.5-2.3-2.3 1.5-2.2-.9-2L2 13.6v-3.2l2.6-.5.9-2L4 5.7 6.3 3.4l2.2 1.5 2-.9z'], ['M12 8.6a3.4 3.4 0 110 6.8 3.4 3.4 0 010-6.8z']],
  'faction.RIFT': [[], ['M12 12.2a1.6 1.6 0 112.3-1.4 3.6 3.6 0 01-4.4 4.4 5.6 5.6 0 01-3.8-7 7.6 7.6 0 019.6-4.6 9.6 9.6 0 015.4 11.8']],
  'race.DRAGON': [['M3 19l3.5-9 3 3.2L12 4l2.5 9.2 3-3.2L21 19z'], ['M9.5 16.5h5']],
  'race.BEAST': [['M12 12.5c3 0 5.5 2.6 5.5 5 0 2-1.8 3-3 3-1 0-1.6-.6-2.5-.6s-1.5.6-2.5.6c-1.2 0-3-1-3-3 0-2.4 2.5-5 5.5-5z', 'M6.2 7.3a2 2.4 0 110 4.8 2 2.4 0 010-4.8z', 'M17.8 7.3a2 2.4 0 110 4.8 2 2.4 0 010-4.8z', 'M9.8 3.2a2 2.4 0 110 4.8 2 2.4 0 010-4.8z', 'M14.2 3.2a2 2.4 0 110 4.8 2 2.4 0 010-4.8z'], []],
  'race.AVIAN': [['M2.5 13.5C7 6 13 4 21.5 4.5c-2 2.4-4.4 3.6-7 4 2 .4 3.6 1.4 4.6 3-2.4.8-5 .8-7.6 0 1 1.8 1.2 3.6.6 5.6-3.5-.8-6.6-2.4-9.6-3.6z'], []],
  'race.SYLVAN': [['M4 20C4 10 10 4 20.5 3.5 20 14 14 20 4 20z'], ['M4.5 19.5L15 9', 'M9 15l-.5-3.5M12 12l3.2.2']],
  'race.AQUATIC': [['M3 14c2.6-5.2 7.2-8 13-8l5 3-3.6 2 3.6 2-5 3c-5.8 0-10.4-.8-13-2z'], ['M14.5 9.6v.1']],
  'race.MECHANOID': [['M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z'], ['M12 8.2a3.8 3.8 0 110 7.6 3.8 3.8 0 010-7.6zM12 2.5v5.7M12 15.8v5.7']],
  'race.ASTRAL': [['M12 1.8l2.6 7.6 7.6 2.6-7.6 2.6L12 22.2l-2.6-7.6L1.8 12l7.6-2.6z'], []],
  'race.NETHER': [['M2 12c3-5 6.4-7.4 10-7.4S19 7 22 12c-3 5-6.4 7.4-10 7.4S5 17 2 12z'], ['M12 7.6c1 1.4 1.4 2.8 1.4 4.4s-.4 3-1.4 4.4c-1-1.4-1.4-2.8-1.4-4.4s.4-3 1.4-4.4z']],
  'mark.CHART': [['M12 2a10 10 0 110 20 10 10 0 010-20z'], ['M9.2 9.2a2.9 2.9 0 115.4 1.4c-.8 1-2.6 1.6-2.6 3.3', 'M12 17.2v.3']]
});
// Owner palette (2026-10-29) for elements; faction and race tones keep the same weight.
export const TAXONOMY_COLORS = Object.freeze({
  'element.METAL': '#e2e8f0', 'element.WOOD': '#22c55e', 'element.EARTH': '#d97706', 'element.WATER': '#0ea5e9', 'element.FIRE': '#ef4444',
  'element.SUN': '#f59e0b', 'element.ICE': '#38bdf8', 'element.WIND': '#2dd4bf', 'element.THUNDER': '#eab308', 'element.MOON': '#a855f7',
  'faction.LUMEN': '#34d399', 'faction.IRON': '#94a3b8', 'faction.RIFT': '#a78bfa', 'faction.NONE': '#cbd5e1',
  'race.DRAGON': '#f97316', 'race.BEAST': '#ca8a04', 'race.AVIAN': '#7dd3fc', 'race.SYLVAN': '#84cc16', 'race.AQUATIC': '#0284c7',
  'race.MECHANOID': '#94a3b8', 'race.ASTRAL': '#fde047', 'race.NETHER': '#8b5cf6', 'race.NONE': '#cbd5e1', 'mark.CHART': '#fbbf24'
});

/** An inline SVG emblem for `axis.KEY` (e.g. 'element.FIRE'); unknown keys draw nothing. */
export function taxonomyGlyph(id, size = 18) {
  const svg = svgElement('svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('cm-tax-glyph');
  const [fills, strokes] = GLYPHS[id] ?? [[], []];
  for (const d of fills) { const p = svgElement('path'); p.setAttribute('d', d); p.setAttribute('class', 'cm-tax-glyph__fill'); svg.append(p); }
  for (const d of strokes) { const p = svgElement('path'); p.setAttribute('d', d); p.setAttribute('class', 'cm-tax-glyph__line'); svg.append(p); }
  return svg;
}

/** Left-emblem, right-label capsule for one taxonomy value. */
export function taxonomyBadge(axis, key, {locale} = {}) {
  const id = `${axis}.${key ?? 'NONE'}`;
  const badge = document.createElement('span');
  badge.className = 'cm-tax-badge';
  badge.dataset.axis = axis;
  badge.dataset.key = key ?? 'NONE';
  badge.style.setProperty('--tax-color', TAXONOMY_COLORS[id] ?? '#cbd5e1');
  const label = document.createElement('span');
  label.className = 'cm-tax-badge__label';
  label.textContent = taxonomyText(id, {}, locale);
  badge.append(taxonomyGlyph(id), label);
  return badge;
}

/** Faction · race · element badges for a taxonomy entry, in that order. */
export function taxonomyBadgeRow(taxonomy, options = {}) {
  const row = document.createElement('span');
  row.className = 'cm-tax-row';
  if (!taxonomy) return row;
  row.append(taxonomyBadge('faction', taxonomy.faction, options), taxonomyBadge('race', taxonomy.race, options), taxonomyBadge('element', taxonomy.element, options));
  return row;
}

/** Lit faction resonances as chips (LUMEN / IRON / RIFT / TRI); empty keys draw the hint line. */
export function resonanceStrip(keys, {locale, hint = true} = {}) {
  const strip = document.createElement('div');
  strip.className = 'cm-resonance-strip';
  strip.dataset.resonance = keys.join(' ');
  const title = document.createElement('span');
  title.className = 'cm-resonance-strip__title';
  title.textContent = taxonomyText('resonance.title', {}, locale);
  strip.append(title);
  for (const key of keys) {
    const chip = document.createElement('span');
    chip.className = 'cm-resonance-chip';
    chip.dataset.resonance = key;
    chip.title = taxonomyText(`resonance.${key}.desc`, {}, locale);
    for (const faction of key === 'TRI' ? ['LUMEN', 'IRON', 'RIFT'] : [key]) {
      const glyph = taxonomyGlyph(`faction.${faction}`, 16);
      glyph.style.setProperty('--tax-color', TAXONOMY_COLORS[`faction.${faction}`]);
      chip.append(glyph);
    }
    const label = document.createElement('span');
    label.textContent = taxonomyText(`resonance.${key}`, {}, locale);
    chip.append(label);
    strip.append(chip);
  }
  if (!keys.length && hint) {
    const none = document.createElement('span');
    none.className = 'cm-resonance-strip__hint';
    none.textContent = taxonomyText('resonance.none', {}, locale);
    strip.append(none);
  }
  return strip;
}
