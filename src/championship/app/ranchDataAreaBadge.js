import { setText, setLabel } from '../text/uiText.js';
import { DATA_AREA_GLOBE_ICON } from './dataAreaStoryScreen.js';
// Data Area story entry on the ranch (OWNER_APPROVED_ADAPTATION 2026-10-29):
// the globe badge under the rift-watch badge, with the chapter progress. The
// System menu and the battle menu fire the same event. Presentation only: it
// reads the frame to hide itself during the tutorial and asks the app to open
// the story hall.
export const DATA_AREA_STORY_OPEN_EVENT = 'cm-open-data-area-story';

export function mountRanchDataAreaBadge(root, { progress = () => null } = {}) {
  const doc = root.ownerDocument, button = doc.createElement('button'), life = new AbortController();
  button.className = 'int-rh2-data-area'; button.type = 'button'; button.hidden = true; button.dataset.action = 'ranch-data-area';
  button.innerHTML = DATA_AREA_GLOBE_ICON;
  const label = doc.createElement('span'), count = doc.createElement('span');
  count.className = 'int-rh2-data-area__progress';
  setText(label, 'DATA_AREA_BADGE'); setLabel(button, 'aria-label', 'DATA_AREA_BADGE_LABEL');
  button.append(label, count);
  root.append(button);
  const rectOf = selector => { const node = root.querySelector?.(selector); return node && !node.hidden && node.getClientRects?.().length ? node.getBoundingClientRect() : null; };
  function place() {
    // Below the rift-watch badge (itself below the journal) when they show.
    const story = rectOf('.int-rh2-story'), journal = rectOf('.int-rh2-discoveries');
    const offset = (journal ? journal.height + 8 : 0) + (story ? story.height + 8 : 0);
    button.style.setProperty('--cm-data-area-offset', `${Math.round(offset)}px`);
  }
  function update(frame) {
    button.hidden = !!frame?.tutorial && !frame.tutorial.finished;
    let value = null;
    try { value = progress(); } catch { value = null; }
    count.hidden = !value;
    if (value) { count.textContent = `${value.cleared}/${value.total}`; button.dataset.new = String(value.cleared < value.total && value.current !== null); }
    place();
  }
  doc.defaultView?.addEventListener?.('resize', place, { signal: life.signal });
  button.addEventListener('click', () => doc.dispatchEvent(new CustomEvent(DATA_AREA_STORY_OPEN_EVENT, { detail: { source: 'badge' } })), { signal: life.signal });
  return Object.freeze({ element: button, update, place, dispose() { life.abort(); button.remove(); } });
}
