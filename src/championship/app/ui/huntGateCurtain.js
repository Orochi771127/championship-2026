// Hunt end gate (Owner 2026-11-17): leaving the hunting ground always closes
// the gate first, whether the time ran out or the player left, and always
// ends on a result. With a catch the gate opens onto the existing Hunt Result
// screen; with none, the closed gate itself carries the result ("caught 0")
// and opens onto the ranch once the player taps it.
//
// Presentation only. The application has already left the field when this
// runs; the gate covers the screen swap, never decides it, and never touches
// simulation, input authority, the save or the Pixi ticker. A gate that cannot
// animate (reduced motion, no DOM) simply shows and clears its plate.

const CLOSE_MS = 460, HOLD_MS = 360, OPEN_MS = 420, REDUCED_MS = 120;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const wait = (view, ms) => new Promise(resolve => view.setTimeout(resolve, ms));

/**
 * @param {object} options
 * @param {Document} [options.doc]
 * @param {(value:string, params?:object)=>string} options.text  the UI copy lookup
 * @param {boolean} [options.reducedMotion]
 * @param {(target:Element, kind:string)=>void} [options.fx]  arcade cue request
 */
export function createHuntGateCurtain({ doc = globalThis.document, text = value => value, reducedMotion = false, fx = null } = {}) {
  const view = doc?.defaultView ?? globalThis;
  let node = null, disposed = false;
  const closeMs = reducedMotion ? REDUCED_MS : CLOSE_MS, openMs = reducedMotion ? REDUCED_MS : OPEN_MS;

  function build(label) {
    const root = el(doc, 'div', 'cm-hunt-gate');
    root.dataset.phase = 'closing';
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    const left = el(doc, 'div', 'cm-hunt-gate__leaf cm-hunt-gate__leaf--left');
    const right = el(doc, 'div', 'cm-hunt-gate__leaf cm-hunt-gate__leaf--right');
    left.setAttribute('aria-hidden', 'true'); right.setAttribute('aria-hidden', 'true');
    const plate = el(doc, 'div', 'cm-hunt-gate__plate');
    plate.append(el(doc, 'p', 'cm-hunt-gate__label', label));
    root.append(left, right, plate);
    root.style.setProperty('--gate-close-ms', `${closeMs}ms`);
    root.style.setProperty('--gate-open-ms', `${openMs}ms`);
    return root;
  }

  return Object.freeze({
    /** Slide the two leaves shut over whatever is on screen. Resolves once shut. */
    async close({ label = text('狩獵結束') } = {}) {
      if (disposed || !doc?.body) return false;
      node?.remove();
      node = build(label);
      doc.body.append(node);
      // One frame at the open pose, so the slide has somewhere to come from.
      await new Promise(resolve => (view.requestAnimationFrame ?? (cb => view.setTimeout(cb, 16)))(() => resolve()));
      if (disposed || !node) return false;
      node.dataset.phase = 'shut';
      try { fx?.(node, 'close'); } catch { /* sound is optional */ }
      await wait(view, closeMs + (reducedMotion ? 0 : HOLD_MS));
      return !disposed;
    },
    /**
     * The closed gate becomes the result of a hunt with no catch. Resolves when
     * the player taps continue (or after `autoMs`, when given).
     */
    showEmptyResult({ autoMs = 0 } = {}) {
      if (disposed || !node) return Promise.resolve(false);
      const plate = node.querySelector('.cm-hunt-gate__plate');
      const card = el(doc, 'div', 'cm-hunt-gate__result');
      card.append(
        el(doc, 'p', 'cm-hunt-gate__kicker', text('狩獵結算')),
        el(doc, 'p', 'cm-hunt-gate__count', '0'),
        el(doc, 'p', 'cm-hunt-gate__count-label', text('捕獲 {count} 隻', { count: 0 })),
        el(doc, 'p', 'cm-hunt-gate__note', text('這次沒有夥伴')));
      const button = el(doc, 'button', 'cm-hunt-gate__continue cm-screen-primary', text('返回牧場'));
      button.type = 'button';
      card.append(button);
      plate.replaceChildren(card);
      node.dataset.phase = 'result';
      node.setAttribute('role', 'dialog');
      node.setAttribute('aria-modal', 'true');
      node.setAttribute('aria-label', text('狩獵結算'));
      return new Promise(resolve => {
        let timer = null;
        const done = () => { view.clearTimeout(timer); button.removeEventListener('click', done); resolve(true); };
        button.addEventListener('click', done);
        if (autoMs > 0) timer = view.setTimeout(done, autoMs);
        button.focus?.({ preventScroll: true });
      });
    },
    /** Slide the leaves apart onto the next screen and remove the gate. */
    async open() {
      if (!node) return;
      const current = node;
      current.dataset.phase = 'opening';
      await wait(view, openMs);
      current.remove();
      if (node === current) node = null;
    },
    get active() { return Boolean(node); },
    dispose() { disposed = true; node?.remove(); node = null; }
  });
}
