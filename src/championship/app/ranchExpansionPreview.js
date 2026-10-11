// What the ranch expansion is, for a player who does not have it (2026-10-12).
//
// One sheet, opened from the locked bays under the ranch and from Cage Edit:
// what the expansion adds, where it goes, the rules it keeps, the resident
// limit, and that it cannot be obtained yet. It is the existing confirmation
// dialog (native modal: background inert, Escape and the backdrop close it,
// focus starts on Close and returns to the opener), with richer content.
// Nothing here grants, prices, sells or changes the save.

import { showChoiceDialog } from './uiDialog.js';
import { setText, uiText } from '../text/uiText.js';

// Pointy-top hexes as the ranch draws them: five columns, the second and
// fourth rows shifted right by half a column, rows 21 apart for 28-tall hexes.
const HEX = Object.freeze({ width: 24, height: 28, step: 21, columns: 5 });

function hexPoints(x, y) {
  const w = HEX.width, h = HEX.height;
  return [[x + w / 2, y], [x + w, y + h / 4], [x + w, y + h * 3 / 4], [x + w / 2, y + h], [x, y + h * 3 / 4], [x, y + h / 4]]
    .map(([px, py]) => `${px},${py}`).join(' ');
}

/**
 * The ranch's two rows and the expansion's two rows as one small honeycomb,
 * as SVG markup. Built from numbers only (no input reaches it); the HTML
 * parser places it in the SVG namespace, so the theme's CSS colours it.
 */
export function ranchExpansionMapMarkup() {
  const width = HEX.columns * HEX.width + HEX.width / 2 + 2, height = HEX.step * 3 + HEX.height + 2;
  const hexes = [];
  for (let row = 0; row < 4; row += 1) for (let column = 0; column < HEX.columns; column += 1) {
    const kind = row < 2 ? 'cm-expansion-sheet__hex' : 'cm-expansion-sheet__hex cm-expansion-sheet__hex--locked';
    hexes.push(`<polygon class="${kind}" points="${hexPoints(column * HEX.width + (row % 2) * HEX.width / 2, row * HEX.step)}"/>`);
  }
  // Two padlocks on the locked rows, the same few the ranch shows.
  const locks = [[1, 2], [3, 3]].map(([column, row]) => {
    const cx = column * HEX.width + (row % 2) * HEX.width / 2 + HEX.width / 2, cy = row * HEX.step + HEX.height / 2;
    return `<g class="cm-expansion-sheet__lock"><path class="cm-expansion-sheet__lock-shackle" d="M${cx - 3} ${cy - 1}v-2.5a3 3 0 0 1 6 0v2.5"/>`
      + `<rect class="cm-expansion-sheet__lock-body" x="${cx - 4.5}" y="${cy - 1}" width="9" height="7" rx="1.2"/></g>`;
  });
  return `<svg class="cm-expansion-sheet__svg" viewBox="-1 -1 ${width} ${height}" aria-hidden="true" focusable="false">${hexes.join('')}${locks.join('')}</svg>`;
}

export function ranchExpansionMap(doc = globalThis.document) {
  const template = doc.createElement('template');
  template.innerHTML = ranchExpansionMapMarkup();
  return template.content.firstElementChild;
}

/** The sheet's body: the map with its key, three points, and the status. */
export function ranchExpansionPreviewContent(doc = globalThis.document) {
  const body = doc.createElement('div');
  body.className = 'cm-expansion-sheet';
  const figure = doc.createElement('figure');
  figure.className = 'cm-expansion-sheet__map';
  const key = doc.createElement('figcaption');
  key.className = 'cm-expansion-sheet__key';
  for (const [modifier, label] of [['current', 'EXPANSION_MAP_CURRENT'], ['locked', 'EXPANSION_MAP_ANNEX']]) {
    const entry = doc.createElement('span');
    entry.className = `cm-expansion-sheet__key-item cm-expansion-sheet__key-item--${modifier}`;
    setText(entry, label);
    key.append(entry);
  }
  figure.append(ranchExpansionMap(doc), key);
  const points = doc.createElement('ul');
  points.className = 'cm-expansion-sheet__points';
  for (const label of ['EXPANSION_POINT_RULES', 'EXPANSION_POINT_TRAINING', 'EXPANSION_POINT_CAPACITY']) {
    const item = doc.createElement('li');
    setText(item, label);
    points.append(item);
  }
  const status = doc.createElement('div');
  status.className = 'cm-expansion-sheet__status';
  status.setAttribute('role', 'note');
  const statusTitle = doc.createElement('strong');
  setText(statusTitle, 'EXPANSION_STATUS_TITLE');
  const statusNote = doc.createElement('p');
  setText(statusNote, 'EXPANSION_STATUS_NOTE');
  status.append(statusTitle, statusNote);
  body.append(figure, points, status);
  return body;
}

/**
 * Open the sheet. Resolves when it closes ('close' or null); the disabled
 * "not available yet" action can never be chosen.
 */
export function openRanchExpansionPreview({ ask = showChoiceDialog, doc = globalThis.document } = {}) {
  return ask({
    title: uiText('EXPANSION_TITLE'),
    message: uiText('EXPANSION_LEAD'),
    content: ranchExpansionPreviewContent(doc),
    variant: 'expansion',
    actions: [
      { id: 'close', label: uiText('EXPANSION_CLOSE'), tone: 'secondary' },
      { id: 'unavailable', label: uiText('EXPANSION_UNAVAILABLE'), tone: 'primary', disabled: true }
    ],
    cancelId: 'close',
    focusId: 'close',
    doc
  });
}
