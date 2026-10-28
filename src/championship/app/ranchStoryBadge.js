import { setText, setLabel } from '../text/uiText.js';
// Story theater entry on the ranch (OWNER_APPROVED_ADAPTATION 2026-10-28):
// the 📖 rift-watch badge under the discovery journal, and the System menu
// entry that fires the same event. Presentation only: it reads the frame to
// hide itself during the tutorial, and asks the app to play a chapter.
export const STORY_CHAPTER_OPEN_EVENT = 'cm-open-story-chapter';
export const STORY_FIRST_CHAPTER_ID = 'chapter1-first-rift';

export function mountRanchStoryBadge(root, { isSeen = () => false, chapterId = STORY_FIRST_CHAPTER_ID } = {}) {
  const doc = root.ownerDocument, button = doc.createElement('button'), life = new AbortController();
  button.className = 'int-rh2-story'; button.type = 'button'; button.hidden = true; button.dataset.action = 'ranch-story';
  button.dataset.chapterId = chapterId;
  setText(button, 'STORY_BADGE'); setLabel(button, 'aria-label', 'STORY_BADGE_LABEL');
  root.append(button);
  const rectOf = selector => { const node = root.querySelector?.(selector); return node && !node.hidden && node.getClientRects?.().length ? node.getBoundingClientRect() : null; };
  function place() {
    // Below the journal badge when it shows, else in its slot.
    const journal = rectOf('.int-rh2-discoveries');
    button.style.setProperty('--cm-story-offset', journal ? `${Math.round(journal.height + 8)}px` : '0px');
  }
  function update(frame) {
    button.hidden = !!frame?.tutorial && !frame.tutorial.finished;
    button.dataset.new = String(!isSeen());
    place();
  }
  const view = doc.defaultView;
  view?.addEventListener?.('resize', place, { signal: life.signal });
  button.addEventListener('click', () => doc.dispatchEvent(new CustomEvent(STORY_CHAPTER_OPEN_EVENT, { detail: { chapterId, source: 'badge' } })), { signal: life.signal });
  return Object.freeze({ element: button, update, place, dispose() { life.abort(); button.remove(); } });
}
