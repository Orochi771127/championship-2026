// The tamer talent tree (OWNER_APPROVED_ADAPTATION 2026-11-17, TAMER_TALENTS_20261117): the tamer's level and EXP,
// the points worked out from level, title rank and Dex, and four lines of nodes. DOM only; it reads one frame from
// the application and sends two intents (learn, respec). A node whose effect is not wired yet is shown greyed as
// "not open" and has no key to press, so a point is never spent on something that does nothing.

import { talentText, talentEffectText, talentKeystoneText } from "../text/tamerTalentText.js";

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const number = (value) => Number(value).toLocaleString("en-US");

/**
 * @param {object} options
 * @param {() => object|null} options.frame  app.getTamerTalentFrame
 * @param {(id: string) => {ok: boolean, reason?: string}} options.learn
 * @param {() => {ok: boolean, reason?: string, cost?: number}} options.respec
 * @param {Document} [options.doc]
 */
export function createTamerTalentPanel({ frame, learn, respec, doc = globalThis.document } = {}) {
  const root = el(doc, "section", "cm-talents");
  root.setAttribute("aria-label", talentText("title"));
  let message = "", confirming = false;

  function render() {
    const view = frame?.();
    root.replaceChildren();
    if (!view) { root.hidden = true; return; }
    root.hidden = false;
    const head = el(doc, "header", "cm-talents__head");
    head.append(el(doc, "h3", "cm-talents__title", talentText("title")),
      el(doc, "p", "cm-talents__level", talentText("level", { level: view.level })),
      el(doc, "p", "cm-talents__exp", view.next > 0 ? talentText("exp", { exp: number(view.exp), next: number(view.next) }) : talentText("exp.max")));
    const bar = el(doc, "span", "cm-talents__bar");
    bar.style.setProperty("--fill", String(view.next > 0 ? Math.max(0, Math.min(1, view.exp / view.next)) : 1));
    const points = el(doc, "p", "cm-talents__points", talentText("points", { free: view.free, points: view.points }));
    points.dataset.free = String(view.free);
    head.append(bar, points);
    root.append(head);

    for (const line of view.lines) {
      const block = el(doc, "div", "cm-talents__line");
      block.dataset.line = line.line;
      const title = el(doc, "h4", "cm-talents__line-title", talentText(`line.${line.line}`));
      title.append(el(doc, "span", "cm-talents__line-spent", talentText("line.spent", { spent: line.spent })));
      block.append(title);
      for (const tier of [1, 2, 3]) {
        const nodes = line.nodes.filter((node) => node.tier === tier);
        if (tier > 1) block.append(el(doc, "p", "cm-talents__tier", talentText("tier", { tier, gate: nodes[0]?.gate ?? 0 })));
        for (const node of nodes) block.append(row(node, node.open ? talentEffectText(node) : talentText("TALENT_NOT_OPEN")));
      }
      block.append(el(doc, "p", "cm-talents__tier", talentText("keystone", { gate: line.keystoneGate })));
      for (const key of line.keystones) block.append(row({ ...key, rank: key.taken ? 1 : 0, max: 1 }, key.open ? talentKeystoneText(key.id) : talentText("TALENT_NOT_OPEN")));
      root.append(block);
    }

    const foot = el(doc, "footer", "cm-talents__foot");
    const reset = el(doc, "button", "cm-talents__respec", talentText(confirming ? "respec.confirm" : "respec"));
    reset.type = "button";
    reset.disabled = view.spent === 0;
    reset.addEventListener("click", () => {
      if (!confirming) { confirming = true; message = ""; render(); return; }
      confirming = false;
      const result = respec?.();
      message = result?.ok ? "" : talentText(result?.reason ?? "SAVE_FAILED");
      render();
    });
    foot.append(reset, el(doc, "span", "cm-talents__respec-cost",
      view.respecCost > 0 ? talentText("respec.cost", { cost: number(view.respecCost), have: number(view.crystals) }) : talentText("respec.free")));
    const status = el(doc, "p", "cm-talents__message", message);
    status.setAttribute("role", "status");
    foot.append(status);
    root.append(foot);
  }

  function row(node, effect) {
    const line = el(doc, "div", "cm-talents__node");
    line.dataset.talent = node.id;
    line.dataset.open = String(node.open);
    line.dataset.learned = String(node.rank > 0);
    line.append(el(doc, "span", "cm-talents__name", talentText(node.id)),
      el(doc, "span", "cm-talents__effect", effect),
      el(doc, "span", "cm-talents__rank", talentText("rank", { rank: node.rank, max: node.max })));
    const key = el(doc, "button", "cm-talents__learn", talentText("learn"));
    key.type = "button";
    key.dataset.learn = node.id;
    key.disabled = Boolean(node.refusal);
    key.hidden = !node.open;
    if (node.refusal && node.open) key.title = talentText(node.refusal);
    key.setAttribute("aria-label", `${talentText(node.id)} ${talentText("learn")}`);
    key.addEventListener("click", () => {
      confirming = false;
      const result = learn?.(node.id);
      message = result?.ok ? "" : talentText(result?.reason ?? "SAVE_FAILED");
      render();
    });
    line.append(key);
    return line;
  }

  render();
  return Object.freeze({ element: root, render, dispose() { root.remove(); } });
}
