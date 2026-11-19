// The tamer's skill-card hand in an auto battle (ROADMAP_R4_20261118). Owner 2026-11-18: 「做成一個技能卡片三張手牌在手
// 中的樣子，然後玩家可以把它往上提以後丟出去的樣子」.
//
// Three cards fanned at the bottom of the field, half in the hand. A card that cannot be played yet is dim with a ring
// that fills until it can. Drag a card up and let go above the line to throw it; a tap lifts it (its name and one line
// show above it) and a second tap throws it. A thrown card flies up and bursts with a cue; a refused one shakes.
// DOM and Web Animations only: no canvas, no frame callback. It reads the runtime's snapshot and sends one intent.
import {skillCardText} from '../text/skillCardText.js';
import {SKILL_CARD_FPS, SKILL_CARD_STEP_FRAMES} from '../contracts/productTamerSkillCards.js';
import {prefersReducedMotion} from '../presentation/presentationPreferences.js';
import {requestArcadeFx} from './ui/arcadeFx.js';

export const SKILL_CARD_ART_BASE = 'assets/production/ui/skill-cards-r1/';
/** How far up (px) a card must be dragged to be thrown. */
export const SKILL_CARD_THROW_PX = 56;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {object} options
 * @param {HTMLElement} options.host          the battle screen (the hand is removed with it)
 * @param {() => object|null} options.snapshot  runtime.getSkillCards
 * @param {(id: string) => {ok: boolean, reason?: string}} options.play  runtime.requestSkillCard
 * @param {(listener: () => void) => () => void} [options.subscribe]  battle frame updates
 */
export function mountBattleSkillHand({host, snapshot, play, subscribe = null, onPlayed = null, doc = globalThis.document} = {}) {
  const first = snapshot?.();
  if (!host || !first?.on || !first.cards.length) return null;
  const root = el(doc, 'div', 'cm-skill-hand');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', skillCardText('hand'));
  const toast = el(doc, 'p', 'cm-skill-hand__toast');
  toast.setAttribute('role', 'status');
  root.append(toast);
  const keys = new Map();
  let lifted = null, lastKey = '', toastTimer = null, disposed = false;
  const reduced = () => prefersReducedMotion(doc);

  function say(text) {
    toast.textContent = text; toast.dataset.shown = String(Boolean(text));
    if (toastTimer) globalThis.clearTimeout?.(toastTimer);
    toastTimer = text ? globalThis.setTimeout?.(() => { toast.dataset.shown = 'false'; }, 1200) ?? null : null;
  }

  function face(card) {
    const art = el(doc, 'span', 'cm-skill-card__art');
    const image = doc.createElement('img');
    image.alt = ''; image.decoding = 'async'; image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    image.addEventListener?.('error', () => { image.remove(); art.dataset.drawn = 'true'; }, {once: true});
    image.src = `${SKILL_CARD_ART_BASE}${card.id}_128.webp`;
    art.append(image);
    return art;
  }

  function throwCard(key, card) {
    const result = play?.(card.id) ?? {ok: false, reason: 'NO_HAND'};
    if (!result.ok) {
      requestArcadeFx(key, 'denied');
      key.dataset.shake = 'true';
      globalThis.setTimeout?.(() => { delete key.dataset.shake; }, 340);
      say(skillCardText(result.reason ?? 'NOT_READY'));
      return false;
    }
    lifted = null;
    key.dataset.state = 'THROWN';
    // gone after the flight even when the animation never reports its end (a hidden tab, a frozen clock)
    globalThis.setTimeout?.(() => { key.remove(); keys.delete(card.id); }, 760);
    requestArcadeFx(key, 'levelup');
    const cardName = skillCardText(`${card.id}.name`);
    const cardEffect = skillCardText(`${card.id}.effect`);
    say(`${cardName}！`);
    try { onPlayed?.(card, { name: cardName, effect: cardEffect }); } catch { /* feedback listener */ }
    if (!reduced() && key.animate) {
      const run = key.animate([{transform: getComputedStyleTransform(key), opacity: 1},
        {transform: 'translateY(-46vh) rotate(-8deg) scale(1.35)', opacity: 1, offset: 0.7},
        {transform: 'translateY(-52vh) rotate(-10deg) scale(1.7)', opacity: 0}], {duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards'});
      const burst = el(doc, 'i', 'cm-skill-hand__burst');
      root.append(burst);
      burst.animate?.([{transform: 'scale(0.3)', opacity: 0.95}, {transform: 'scale(2.4)', opacity: 0}], {duration: 520, delay: 300, easing: 'ease-out', fill: 'both'})
        ?.addEventListener?.('finish', () => burst.remove());
      run.addEventListener?.('finish', () => render(true));
    } else render(true);
    return true;
  }
  const getComputedStyleTransform = node => (doc.defaultView?.getComputedStyle?.(node)?.transform && doc.defaultView.getComputedStyle(node).transform !== 'none'
    ? doc.defaultView.getComputedStyle(node).transform : 'translateY(0)');

  function bind(key, card) {
    let startY = null, dy = 0, moved = false;
    key.addEventListener('pointerdown', event => {
      startY = event.clientY; dy = 0; moved = false;
      try { key.setPointerCapture?.(event.pointerId); } catch { /* not capturable */ }
    });
    key.addEventListener('pointermove', event => {
      if (startY === null) return;
      dy = Math.min(0, event.clientY - startY);
      if (dy < -8) moved = true;
      if (moved) { key.dataset.dragging = 'true'; key.style.setProperty('--drag', `${dy}px`); key.dataset.armed = String(dy <= -SKILL_CARD_THROW_PX); }
    });
    const end = () => {
      const wasMoved = moved, far = dy <= -SKILL_CARD_THROW_PX;
      startY = null; moved = false; dy = 0;
      delete key.dataset.dragging; delete key.dataset.armed; key.style.removeProperty('--drag');
      if (wasMoved) { key.dataset.dragged = 'true'; if (far) throwCard(key, card); }
    };
    key.addEventListener('pointerup', end);
    key.addEventListener('pointercancel', () => { startY = null; moved = false; dy = 0; delete key.dataset.dragging; delete key.dataset.armed; key.style.removeProperty('--drag'); });
    key.addEventListener('contextmenu', event => event?.preventDefault?.());
    key.addEventListener('click', () => {
      if (key.dataset.dragged) { delete key.dataset.dragged; return; }
      if (key.dataset.state === 'THROWN') return;
      // a card still counting down says so instead of lifting
      if (key.dataset.state !== 'READY') { throwCard(key, card); return; }
      if (lifted === card.id) { throwCard(key, card); return; }
      lifted = card.id; requestArcadeFx(key, 'open'); render(true);
    });
  }

  function render(force = false) {
    if (disposed) return;
    const view = snapshot?.();
    if (!view?.on) { root.hidden = true; return; }
    root.hidden = false;
    const waitSeconds = view.nextFrame === null ? 0 : Math.max(0, Math.ceil((view.nextFrame - view.frame) / SKILL_CARD_FPS));
    const key = `${view.cards.map(card => card.state).join(',')}|${waitSeconds}|${lifted}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const live = view.cards.filter(card => card.state !== 'PLAYED');
    if (lifted && !live.some(card => card.id === lifted && card.state === 'READY')) lifted = null;
    const fan = live.length;
    for (const [id, node] of keys) if (!live.some(card => card.id === id) && node.dataset.state !== 'THROWN') { node.remove(); keys.delete(id); }
    for (const [id, node] of keys) if (node.dataset.state === 'THROWN' && !node.getAnimations?.().length) { node.remove(); keys.delete(id); }
    live.forEach((card, index) => {
      let node = keys.get(card.id);
      if (!node) {
        node = el(doc, 'button', 'cm-skill-card');
        node.type = 'button';
        node.dataset.card = card.id;
        node.dataset.line = card.line;
        node.append(face(card), el(doc, 'span', 'cm-skill-card__ring'), el(doc, 'b', 'cm-skill-card__wait'),
          el(doc, 'span', 'cm-skill-card__name', skillCardText(`${card.id}.name`)), el(doc, 'span', 'cm-skill-card__effect', skillCardText(`${card.id}.effect`)));
        bind(node, card);
        keys.set(card.id, node);
        root.append(node);
      }
      node.dataset.state = card.state;
      node.dataset.lifted = String(lifted === card.id);
      node.style.setProperty('--fan', String(fan > 1 ? (index - (fan - 1) / 2) : 0));
      node.querySelector?.('.cm-skill-card__wait') && (node.querySelector('.cm-skill-card__wait').textContent = card.state === 'WAIT' && waitSeconds ? skillCardText('wait', {seconds: waitSeconds}) : '');
      node.style.setProperty('--wait', String(card.state === 'WAIT' && view.nextFrame ? Math.max(0, Math.min(1, 1 - (view.nextFrame - view.frame) / SKILL_CARD_STEP_FRAMES)) : 1));
      node.setAttribute('aria-label', `${skillCardText(`${card.id}.name`)}，${skillCardText(`${card.id}.effect`)}${card.state === 'WAIT' && waitSeconds ? `，${skillCardText('wait', {seconds: waitSeconds})}` : ''}`);
      node.setAttribute('aria-disabled', String(card.state !== 'READY'));
    });
  }

  host.append(root);
  render(true);
  const stop = typeof subscribe === 'function' ? subscribe(() => render()) : null;
  const tick = stop ? null : globalThis.setInterval?.(() => render(), 250);
  return Object.freeze({element: root, render,
    dispose() { if (disposed) return; disposed = true; stop?.(); if (tick) globalThis.clearInterval?.(tick); if (toastTimer) globalThis.clearTimeout?.(toastTimer); root.remove(); }});
}
