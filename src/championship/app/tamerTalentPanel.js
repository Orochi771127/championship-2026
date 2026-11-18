// The tamer talent tree (OWNER_APPROVED_ADAPTATION 2026-11-17, TAMER_TALENTS_20261117), drawn as a tree
// (TALENT_TREE_20261118, Owner 2026-11-18: 「樹狀圖…有圖片人家點一下會發亮這樣，然後按著才會顯示那個天賦的功能作用」
// and 「太多字了太複雜了…直覺的系統」).
//
// Three layers, nothing more on the first than a player can read at a glance:
//   glance   the tamer's level badge and gauge, point orbs, four line emblems, and the line's tree of icons with
//            rank pips. No sentence and no number but the level, the points and the gate counts.
//   tap      a node that can be learned lights up (one rank). A node that cannot shakes its head with the denied
//            cue and says why in the reading bar.
//   hold     press and hold (or hover, or keyboard focus) shows the node's name and what it does in the reading bar.
//
// DOM only; it reads one frame from the application and sends two intents (learn, respec). A node whose effect is
// not wired yet is drawn hatched and never takes a point.

import { talentText, talentEffectText, talentKeystoneText } from "../text/tamerTalentText.js";
import { tamerRankName } from "../text/zhHant.js";
import { tamerEmblem, tamerLevelBadge } from "../presentation/tamerEmblemArt.js";
import { talentIcon } from "../presentation/talentIconArt.js";
import { requestArcadeFx } from "./ui/arcadeFx.js";

/** How long a press must last before it reads instead of learns. */
export const TALENT_HOLD_MS = 320;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const number = (value) => Number(value).toLocaleString("en-US");

/** What a node is, at a glance: `soon` not wired, `max`, `lit` learned, `ready` learnable, `locked` otherwise. */
export function talentNodeState(node) {
  if (!node.open) return "soon";
  if (node.rank >= node.max) return "max";
  if (!node.refusal) return node.rank > 0 ? "lit-ready" : "ready";
  return node.rank > 0 ? "lit" : "locked";
}

/**
 * @param {object} options
 * @param {() => object|null} options.frame  app.getTamerTalentFrame
 * @param {(id: string) => {ok: boolean, reason?: string}} options.learn
 * @param {() => {ok: boolean, reason?: string, cost?: number}} options.respec
 * @param {Document} [options.doc]
 */
export function createTamerTalentPanel({ frame, learn, respec, doc = globalThis.document } = {}) {
  const root = el(doc, "section", "cm-talents");
  root.dataset.layout = "tree";
  root.setAttribute("aria-label", talentText("title"));
  let message = "", confirming = false, selectedLine = null, justLit = null, reading = null, holdTimer = null, held = false;
  const setTimer = (run, ms) => globalThis.setTimeout?.(run, ms) ?? null;
  const clearTimer = (id) => { if (id !== null) globalThis.clearTimeout?.(id); };

  /** The one line of words a node gets, and only when asked: its name, what it does now and at the next rank. */
  function describe(node) {
    const name = talentText(node.id);
    if (!node.open) return { name, effect: talentText("TALENT_NOT_OPEN"), note: "" };
    const note = node.refusal && node.refusal !== "TALENT_MAX" ? talentText(node.refusal) : "";
    if (node.keystone) return { name, effect: talentKeystoneText(node.id), note };
    // What it gives at the rank it has (one rank's worth before it is learned); the pips say how far it can go.
    return { name, effect: talentEffectText(node, Math.max(1, node.rank)), note };
  }

  function render() {
    const view = frame?.();
    clearTimer(holdTimer); holdTimer = null; held = false;
    root.replaceChildren();
    if (!view) { root.hidden = true; return; }
    root.hidden = false;
    if (!view.lines.some((line) => line.line === selectedLine)) selectedLine = view.lines[0]?.line ?? null;

    // ---- glance: who the tamer is and what there is to spend ----
    const head = el(doc, "header", "cm-talents__head");
    const badge = tamerLevelBadge({ level: view.level, size: 48, doc });
    badge.setAttribute("aria-label", talentText("level", { level: view.level }));
    const gauge = el(doc, "span", "cm-talents__bar");
    gauge.style.setProperty("--fill", String(view.next > 0 ? Math.max(0, Math.min(1, view.exp / view.next)) : 1));
    gauge.setAttribute("aria-label", view.next > 0 ? talentText("exp", { exp: number(view.exp), next: number(view.next) }) : talentText("exp.max"));
    const points = el(doc, "span", "cm-talents__points");
    points.dataset.free = String(view.free);
    points.setAttribute("aria-label", talentText("points", { free: view.free, points: view.points }));
    points.append(el(doc, "i", "cm-talents__orb"), el(doc, "b", "", String(view.free)));
    head.append(badge, gauge, points);
    // R1b: the next tamer level that opens a shop and gate rank.
    if (view.unlock?.nextLevel) {
      const unlock = el(doc, "span", "cm-talents__unlock");
      unlock.dataset.nextLevel = String(view.unlock.nextLevel);
      unlock.setAttribute("aria-label", talentText("unlock", { level: view.unlock.nextLevel, rank: tamerRankName(view.unlock.nextRank) }));
      const lockArt = tamerEmblem("lock-level", { size: 16, doc });
      if (lockArt) unlock.prepend(lockArt);
      unlock.append(el(doc, "b", "", `Lv.${view.unlock.nextLevel}`));
      head.append(unlock);
    }
    root.append(head);

    // ---- four lines, one shown at a time ----
    const tabs = el(doc, "nav", "cm-talents__tabs");
    for (const line of view.lines) {
      const tab = el(doc, "button", "cm-talents__tab");
      tab.type = "button";
      tab.dataset.line = line.line;
      tab.setAttribute("aria-pressed", String(line.line === selectedLine));
      tab.setAttribute("aria-label", `${talentText(`line.${line.line}`)} ${talentText("line.spent", { spent: line.spent })}`);
      tab.append(talentIcon(`line-${line.line}`, { size: 36, doc }), el(doc, "span", "cm-talents__tab-name", talentText(`line.${line.line}`)));
      if (line.spent > 0) tab.append(el(doc, "b", "cm-talents__tab-spent", String(line.spent)));
      tab.addEventListener("click", () => { if (selectedLine === line.line) return; selectedLine = line.line; reading = null; requestArcadeFx(tab, "toggle"); render(); });
      tabs.append(tab);
    }
    root.append(tabs);

    // ---- the reading bar: empty until a node is held ----
    const bar = el(doc, "p", "cm-talents__reading");
    bar.setAttribute("role", "status");
    root.append(bar);
    const read = (node) => {
      reading = node?.id ?? null;
      bar.replaceChildren();
      bar.dataset.empty = String(!node);
      if (!node) { bar.append(el(doc, "span", "cm-talents__hint", talentText("hint"))); return; }
      const text = describe(node);
      bar.append(el(doc, "strong", "cm-talents__name", text.name), el(doc, "span", "cm-talents__effect", text.effect));
      if (text.note) bar.append(el(doc, "span", "cm-talents__note", text.note));
    };

    // ---- the tree of the chosen line: keystones on top, the first tier at the root ----
    const line = view.lines.find((entry) => entry.line === selectedLine);
    if (line) {
      const tree = el(doc, "div", "cm-talents__tree");
      tree.dataset.line = line.line;
      const nodeKey = (node) => {
        const state = talentNodeState(node);
        const key = el(doc, "button", "cm-talents__node");
        key.type = "button";
        key.dataset.talent = node.id;
        key.dataset.learn = node.id;
        key.dataset.state = state;
        if (node.keystone) key.dataset.keystone = "true";
        if (justLit === node.id) key.dataset.lit = "now";
        key.setAttribute("aria-disabled", String(state !== "ready" && state !== "lit-ready"));
        const text = describe(node);
        key.setAttribute("aria-label", [text.name, text.effect, text.note, talentText("rank", { rank: node.rank, max: node.max })].filter(Boolean).join("，"));
        key.append(talentIcon(node.id, { size: node.keystone ? 52 : 44, doc }));
        const pips = el(doc, "span", "cm-talents__pips");
        for (let index = 0; index < node.max; index += 1) { const pip = el(doc, "i"); pip.dataset.on = String(index < node.rank); pips.append(pip); }
        key.append(pips);
        // tap learns; a press held past TALENT_HOLD_MS reads instead, and its release does not learn
        const release = () => { clearTimer(holdTimer); holdTimer = null; if (held && reading === node.id) read(null); };
        key.addEventListener("pointerdown", () => { held = false; clearTimer(holdTimer); holdTimer = setTimer(() => { held = true; read(node); requestArcadeFx(key, "open"); }, TALENT_HOLD_MS); });
        for (const type of ["pointerup", "pointerleave", "pointercancel"]) key.addEventListener(type, release);
        key.addEventListener("pointerenter", (event) => { if (event?.pointerType === "mouse") read(node); });
        key.addEventListener("focus", () => read(node));
        key.addEventListener("blur", () => { if (reading === node.id) read(null); });
        key.addEventListener("contextmenu", (event) => event?.preventDefault?.());
        key.addEventListener("click", () => {
          if (held) { held = false; return; }
          confirming = false;
          if (state !== "ready" && state !== "lit-ready") { requestArcadeFx(key, "denied"); key.dataset.shake = "true"; read(node); return; }
          const result = learn?.(node.id);
          message = result?.ok ? "" : talentText(result?.reason ?? "SAVE_FAILED");
          if (result?.ok) justLit = node.id;
          render();
          justLit = null;
          // the sparks fly from the node that was lit (the tree was redrawn, so from its new key)
          if (result?.ok) requestArcadeFx(Array.from(root.querySelectorAll("button")).find((fresh) => fresh.dataset?.learn === node.id) ?? root, node.rank + 1 >= node.max ? "levelup" : "sparkle");
        });
        return key;
      };
      const gate = (need) => {
        const open = line.spent >= need, strip = el(doc, "div", "cm-talents__gate");
        strip.dataset.open = String(open);
        strip.style.setProperty("--fill", String(Math.max(0, Math.min(1, line.spent / Math.max(1, need)))));
        strip.setAttribute("aria-label", talentText("tier.gate", { spent: Math.min(line.spent, need), gate: need }));
        if (!open) { const lock = tamerEmblem("lock-rank", { size: 16, doc }); if (lock) strip.append(lock); }
        strip.append(el(doc, "i", "cm-talents__gate-fill"), el(doc, "b", "", `${Math.min(line.spent, need)}/${need}`));
        return strip;
      };
      const row = (nodes, kind) => { const band = el(doc, "div", "cm-talents__row"); band.dataset.row = kind; for (const node of nodes) band.append(nodeKey(node)); return band; };
      const keystones = line.keystones.map((key) => ({ ...key, rank: key.taken ? 1 : 0, max: 1, keystone: true }));
      if (keystones.length) {
        const top = row(keystones, "keystone");
        if (keystones.length > 1) top.append(el(doc, "span", "cm-talents__either", talentText("either")));
        tree.append(top, gate(line.keystoneGate));
      }
      for (const tier of [3, 2, 1]) {
        const nodes = line.nodes.filter((node) => node.tier === tier);
        if (!nodes.length) continue;
        tree.append(row(nodes, `tier-${tier}`));
        if (tier > 1) tree.append(gate(nodes[0].gate ?? 0));
      }
      root.append(tree);
      const again = reading ? [...line.nodes, ...keystones].find((node) => node.id === reading) : null;
      read(again ?? null);
    } else read(null);

    // ---- reset: one key, its price as a crystal and a number ----
    const foot = el(doc, "footer", "cm-talents__foot");
    const reset = el(doc, "button", "cm-talents__respec", talentText(confirming ? "respec.confirm" : "respec"));
    reset.type = "button";
    reset.disabled = view.spent === 0;
    reset.addEventListener("click", () => {
      if (!confirming) { confirming = true; message = ""; render(); return; }
      confirming = false;
      const result = respec?.();
      message = result?.ok ? "" : talentText(result?.reason ?? "SAVE_FAILED");
      requestArcadeFx(reset, result?.ok ? "unsnap" : "denied");
      render();
    });
    const cost = el(doc, "span", "cm-talents__respec-cost");
    cost.setAttribute("aria-label", view.respecCost > 0 ? talentText("respec.cost", { cost: number(view.respecCost), have: number(view.crystals) }) : talentText("respec.free"));
    if (view.respecCost > 0) {
      const crystal = tamerEmblem("exp-crystal", { size: 16, doc });
      if (crystal) cost.append(crystal);
      cost.append(el(doc, "b", "", number(view.respecCost)));
      cost.dataset.short = String(view.crystals < view.respecCost);
    } else cost.append(el(doc, "b", "", talentText("respec.free")));
    foot.append(reset, cost);
    const status = el(doc, "p", "cm-talents__message", message);
    status.setAttribute("role", "status");
    foot.append(status);
    root.append(foot);
  }

  render();
  return Object.freeze({ element: root, render,
    /** Show a line's tree (tests and deep links). */
    selectLine(line) { selectedLine = line; render(); },
    dispose() { clearTimer(holdTimer); root.remove(); } });
}
