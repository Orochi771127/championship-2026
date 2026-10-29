// 🌐 Community link dock (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// Four raised arcade keys (Discord, Facebook, X / Threads, Bahamut) built from
// config/socialLinksConfig.js. A configured key is a real <a> that opens in a
// new tab with rel="noopener noreferrer", so a Home Screen web app keeps the
// game running behind it; a key without a link says "coming soon" and uses
// aria-disabled, which the arcade sound bus answers with its denied cue. The
// dock reads nothing from the save and writes nothing anywhere.

import { resolveSocialLinks } from "../config/socialLinksConfig.js";
import { socialText } from "../text/socialText.js";

export function createSocialLinkDock({ doc = globalThis.document, links = resolveSocialLinks(), variant = "full", role = null } = {}) {
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const root = el("nav", "cm-social-dock"); root.dataset.variant = variant; root.dataset.socialDock = "true";
  root.setAttribute("aria-label", socialText("dockTitle"));
  if (variant !== "menu") root.append(el("p", "cm-social-dock__title", socialText("dockTitle")), el("p", "cm-social-dock__hint", socialText("dockHint")));
  const grid = el("div", "cm-social-dock__grid");
  const status = el("p", "cm-social-dock__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  const keys = links.map((link, index) => {
    const key = el(link.href ? "a" : "button", "cm-social-key cm-arcade-key");
    key.dataset.socialId = link.id; key.dataset.state = link.href ? "open" : "soon";
    key.style.setProperty("--social-color", link.color); key.style.setProperty("--social-ink", link.ink ?? "#ffffff"); key.style.setProperty("--social-index", String(index));
    if (role) key.setAttribute("role", role);
    const name = socialText(link.id);
    const glyph = el("span", "cm-social-key__glyph", link.glyph); glyph.setAttribute("aria-hidden", "true");
    const text = el("span", "cm-social-key__text");
    text.append(el("strong", "cm-social-key__name", name), el("small", "cm-social-key__sub", link.href ? socialText(`${link.id}Sub`) : socialText("soon")));
    const go = el("span", "cm-social-key__go", link.href ? "↗" : "⏳"); go.setAttribute("aria-hidden", "true");
    key.append(glyph, text, go);
    if (link.href) {
      key.href = link.href; key.target = "_blank"; key.rel = "noopener noreferrer";
      key.setAttribute("aria-label", `${name} — ${socialText("newTab")}`);
    } else {
      key.type = "button"; key.setAttribute("aria-disabled", "true");
      key.addEventListener("click", () => { status.hidden = false; status.textContent = socialText("soonNotice", { name }); });
    }
    grid.append(key);
    return key;
  });
  root.append(grid, status);
  return Object.freeze({ element: root, keys, dispose() { root.remove(); } });
}
