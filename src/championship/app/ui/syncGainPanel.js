// Post-battle Sync EXP panel (OWNER_APPROVED_ADAPTATION 2026-11-09).
//
// One row per partner that fought: its EXP bar fills, wraps at each level and
// stops on the settled value; a level-up shows LEVEL UP with the real HP/TP
// percentage and every breakthrough crossed. Everything shown comes from the
// app's settled gain record -- nothing here computes or grants EXP.
//
// DOM and Web Animations only: no canvas, no frame loop. Reduced motion lands
// on the final state at once; skip() does the same mid-way.

import { syncText } from "../../text/syncLevelText.js";

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const levelLabel = (level, next) => (next > 0 ? syncText("level", { level }) : syncText("level.max"));
const fraction = (exp, next) => (next > 0 ? Math.max(0, Math.min(1, exp / next)) : 1);

/**
 * @param {object} options
 * @param {object[]} options.gains   settled gain records (productSyncLevel grantSyncExp().gain)
 * @param {(id: string) => string} [options.nameOf]
 * @param {(id: string) => string|null} [options.portraitOf] image URL
 * @param {number|null} [options.cap] the level cap the match fought under
 * @param {boolean} [options.reducedMotion]
 */
export function buildSyncGainPanel({ gains = [], nameOf = (id) => id, portraitOf = () => null, cap = null, reducedMotion = false } = {}) {
  const node = element("section", "cm-sync-panel");
  node.setAttribute("aria-label", syncText("panel.title"));
  const rows = gains.map((gain) => {
    const row = element("div", "cm-sync-row");
    row.dataset.instanceId = gain.instanceId;
    row.dataset.leveled = String(gain.after.level > gain.before.level);
    const portrait = portraitOf(gain.instanceId);
    if (portrait) {
      const face = element("img", "cm-sync-row__face");
      Object.assign(face, { src: portrait, alt: "", decoding: "async" });
      face.addEventListener("error", () => face.remove(), { once: true });
      row.append(face);
    }
    const main = element("div", "cm-sync-row__main");
    const head = element("div", "cm-sync-row__head");
    const name = element("strong", "cm-sync-row__name", nameOf(gain.instanceId));
    const lv = element("span", "cm-sync-lv", levelLabel(gain.before.level, gain.before.next));
    const amount = element("span", "cm-sync-gain", syncText("exp.gain", { exp: gain.amount.toLocaleString() }));
    head.append(name, lv, amount);
    const bar = element("div", "cm-sync-bar");
    const fill = element("i", "cm-sync-bar__fill");
    fill.style.transform = `scaleX(${fraction(gain.before.exp, gain.before.next)})`;
    bar.append(fill);
    const numbers = element("span", "cm-sync-row__numbers", gain.before.next > 0
      ? syncText("exp.next", { exp: gain.before.exp.toLocaleString(), next: gain.before.next.toLocaleString() }) : "");
    const up = element("div", "cm-sync-levelup");
    up.hidden = true;
    up.append(element("b", "cm-sync-levelup__badge", syncText("levelUp")),
      element("span", "cm-sync-levelup__range", syncText("levelUp.range", { before: gain.before.level, after: gain.after.level })),
      element("span", "cm-sync-levelup__stat", syncText("stat.vital", { value: gain.vitalPercent.after })));
    const cards = element("div", "cm-sync-breakthroughs");
    for (const id of gain.breakthroughs) {
      const card = element("div", "cm-sync-breakthrough");
      card.dataset.breakthrough = id;
      card.hidden = true;
      card.append(element("span", "cm-sync-breakthrough__kicker", syncText("breakthrough")),
        element("strong", "cm-sync-breakthrough__title", syncText(`${id}.title`)),
        element("span", "cm-sync-breakthrough__effect", syncText(id)));
      cards.append(card);
    }
    main.append(head, bar, numbers, up, cards);
    if (gain.overflow > 0) main.append(element("p", "cm-sync-row__overflow", syncText("overflow", { value: gain.overflow.toLocaleString() })));
    row.append(main);
    node.append(row);
    return { gain, row, lv, fill, numbers, up, cards };
  });
  if (Number.isSafeInteger(cap)) node.append(element("p", "cm-sync-panel__cap", syncText("cap", { level: cap })));

  let running = null, disposed = false;
  const animations = new Set();
  const animate = (target, frames, options) => {
    if (typeof target.animate !== "function") return null;
    const animation = target.animate(frames, options);
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  };

  function settle(entry) {
    const { gain } = entry;
    entry.fill.style.transform = `scaleX(${fraction(gain.after.exp, gain.after.next)})`;
    entry.lv.textContent = levelLabel(gain.after.level, gain.after.next);
    entry.numbers.textContent = gain.after.next > 0
      ? syncText("exp.next", { exp: gain.after.exp.toLocaleString(), next: gain.after.next.toLocaleString() }) : "";
    if (gain.after.level > gain.before.level) {
      entry.up.hidden = false;
      for (const card of entry.cards.children) card.hidden = false;
    }
    entry.row.dataset.settled = "true";
  }

  async function playRow(entry, token) {
    const { gain } = entry;
    const levels = gain.after.level - gain.before.level;
    const step = levels > 4 ? 160 : 420;
    let from = fraction(gain.before.exp, gain.before.next);
    for (let level = gain.before.level; level <= gain.after.level; level++) {
      const last = level === gain.after.level;
      const to = last ? fraction(gain.after.exp, gain.after.next) : 1;
      const run = animate(entry.fill, [{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }],
        { duration: Math.max(120, step * (to - from) + 80), easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" });
      await run?.finished.catch(() => {});
      if (token.cancelled) return;
      entry.fill.style.transform = `scaleX(${to})`;
      if (!last) {
        entry.lv.textContent = levelLabel(level + 1, level + 1 >= 50 ? 0 : 1);
        animate(entry.lv, [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
        from = 0;
      }
    }
    settle(entry);
    if (levels > 0) {
      entry.row.dispatchEvent(new CustomEvent("cm-fx", { bubbles: true, detail: { kind: "levelup" } }));
      animate(entry.up, [{ opacity: 0, transform: "translateY(6px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,1.4,.4,1)" });
      [...entry.cards.children].forEach((card, index) => animate(card,
        [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 120 + index * 120, easing: "ease-out", fill: "backwards" }));
    }
  }

  return Object.freeze({
    node,
    /** Fill the bars row by row; resolves when every row has landed. */
    play() {
      if (running) return running;
      const token = { cancelled: false };
      running = (async () => {
        if (reducedMotion) { rows.forEach(settle); return; }
        for (const entry of rows) {
          if (token.cancelled || disposed) return;
          await playRow(entry, token);
        }
      })();
      running.token = token;
      return running;
    },
    /** Land every row on its settled value now. */
    skip() {
      if (running?.token) running.token.cancelled = true;
      for (const animation of animations) animation.cancel();
      animations.clear();
      rows.forEach(settle);
    },
    dispose() {
      disposed = true;
      if (running?.token) running.token.cancelled = true;
      for (const animation of animations) animation.cancel();
      animations.clear();
      node.remove();
    }
  });
}
