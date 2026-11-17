// Hunt end gate (Owner 2026-11-17): leaving the hunting ground always closes
// the gate first, whether the time ran out or the player left, and always
// ends on a result. It is the entry portal (傳送門連線) run backwards, in the
// same sky and orb: the sky closes in on the centre, the orb's two halves seal
// over it, and leaving splits the orb and opens the iris again. With a catch
// the gate opens onto the existing Hunt Result screen; with none, the closed
// gate itself carries the result ("caught 0") and opens onto the ranch once
// the player taps it.
//
// Presentation only. The application has already left the field when this
// runs; the gate covers the screen swap, never decides it, and never touches
// simulation, input authority, the save or the Pixi ticker. A gate that cannot
// animate (reduced motion, no DOM) simply shows and clears its plate.

const CLOSE_MS = 560, HOLD_MS = 320, OPEN_MS = 600, REDUCED_MS = 120;

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
    const sky = el(doc, 'div', 'cm-hunt-gate__sky');
    const portal = el(doc, 'div', 'cm-hunt-gate__portal');
    for (const part of ['orbit', 'orbit cm-hunt-gate__orbit--outer', 'half cm-hunt-gate__half--top', 'half cm-hunt-gate__half--bottom', 'seam'])
      portal.append(el(doc, 'span', `cm-hunt-gate__${part}`));
    sky.setAttribute('aria-hidden', 'true'); portal.setAttribute('aria-hidden', 'true');
    const plate = el(doc, 'div', 'cm-hunt-gate__plate');
    plate.append(el(doc, 'p', 'cm-hunt-gate__label', label));
    root.append(sky, portal, plate);
    root.style.setProperty('--gate-close-ms', `${closeMs}ms`);
    root.style.setProperty('--gate-open-ms', `${openMs}ms`);
    return root;
  }

  return Object.freeze({
    /** Close the sky in on the orb over whatever is on screen. Resolves once sealed. */
    async close({ label = text('狩獵結束') } = {}) {
      if (disposed || !doc?.body) return false;
      node?.remove();
      node = build(label);
      doc.body.append(node);
      // One frame at the open pose, so the iris has somewhere to close from.
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
    showEmptyResult({ autoMs = 0, find = null } = {}) {
      if (disposed || !node) return Promise.resolve(false);
      const plate = node.querySelector('.cm-hunt-gate__plate');
      const card = el(doc, 'div', 'cm-hunt-gate__result');
      card.append(
        el(doc, 'p', 'cm-hunt-gate__kicker', text('狩獵結算')),
        el(doc, 'p', 'cm-hunt-gate__count', '0'),
        el(doc, 'p', 'cm-hunt-gate__count-label', text('捕獲 {count} 隻', { count: 0 })),
        el(doc, 'p', 'cm-hunt-gate__note', text('這次沒有夥伴')));
      // 拾荒 (TAMER_TALENTS_T4_20261118): what the hunt turned up all the same.
      if (find?.id) { const line = el(doc, 'p', 'cm-hunt-gate__note cm-hunt-gate__find', text('拾荒：{item} ×1', { item: text(find.id) })); line.dataset.scavenged = find.id; card.append(line); }
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
    /** Split the orb and open the iris onto the next screen, then remove the gate. */
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
