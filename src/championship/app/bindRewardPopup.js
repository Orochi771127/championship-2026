// 🎁 First-bind gift popup (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// Shown once the gift is settled: after the save was paid (cloud), or as a
// labelled preview in the local simulation, where nothing is paid. It only
// displays the amount the caller hands it and asks the arcade bus for the
// matching cue: the coin burst for a real credit, sparkles for a preview.

import { onlineText, ONLINE_PROVIDER_NAMES } from "../text/onlineText.js";

export function buildBindRewardContent({ doc = globalThis.document, bits = 0, provider = null, simulated = false } = {}) {
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const root = el("div", "cm-bind-reward"); root.dataset.simulated = String(Boolean(simulated)); root.dataset.provider = provider ?? "";
  const rays = el("span", "cm-bind-reward__rays"); rays.setAttribute("aria-hidden", "true");
  const gift = el("span", "cm-bind-reward__gift", "🎁"); gift.setAttribute("aria-hidden", "true");
  const amount = el("strong", "cm-bind-reward__amount", onlineText("rewardAmount", { bits: Number.isSafeInteger(bits) ? bits.toLocaleString() : onlineText("unknown") }));
  root.append(rays, gift, amount);
  if (provider) root.append(el("p", "cm-bind-reward__via", onlineText("rewardVia", { provider: ONLINE_PROVIDER_NAMES[provider] ?? provider })));
  if (simulated) root.append(el("p", "cm-bind-reward__note", onlineText("rewardSimNote")));
  return root;
}

/** Opens the popup through the shared dialog; resolves when the player collects it. */
export async function showBindRewardPopup({ showChoiceDialog, doc = globalThis.document, bits, provider, simulated = false, fx = null } = {}) {
  if (typeof showChoiceDialog !== "function") return null;
  const content = buildBindRewardContent({ doc, bits, provider, simulated });
  const shown = showChoiceDialog({ title: onlineText("rewardTitle"), message: onlineText("rewardBody"), content, variant: "reward",
    actions: [{ id: "claim", label: onlineText("rewardClaim"), tone: "primary" }], cancelId: "claim", focusId: "claim", doc });
  // The dialog is in the document now, so the cue's event reaches the arcade bus.
  fx?.(content, simulated ? "sparkle" : "purchase", simulated ? null : onlineText("rewardAmount", { bits: Number.isSafeInteger(bits) ? bits.toLocaleString() : "" }));
  return shown;
}
