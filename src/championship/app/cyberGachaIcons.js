// Cyber Gachapon icons (Owner 2026-10-29, second pass): no system emoji anywhere
// in the gacha. Currencies use the game's own HUD art (the status bar's gold Bits
// coin and blue diamond), every ticket is the one gacha ticket WebP, and the
// remaining glyphs are small two-tone inline SVGs with the arcade ink outline.

// The SVG namespace, read from the document's own parser (no URL literal in runtime code).
let svgNs = null;
function svgNamespace(doc) {
  if (svgNs === null) {
    const probe = doc.createElement("div");
    probe.innerHTML = "<svg></svg>";
    svgNs = probe.firstChild?.namespaceURI ?? false;
  }
  return svgNs || null;
}
const INK = "#14141f";
const UI_ART = "assets/production/ui/cyber-gacha-r1/";
const HUD_ART = "assets/production/public-media-clean-20261017/currency-hud-r1/";

/** The ticket is one picture everywhere: wallet, prices, tab and dock badges, drops. */
export const GACHA_TICKET_ART = `${UI_ART}gacha_ticket.webp`;
/** The status bar's official currency art (24 px with a 48 px 2x source). */
export const GACHA_CURRENCY_ART = Object.freeze({
  bits: Object.freeze({ src: `${HUD_ART}bits-24.png`, srcset: `${HUD_ART}bits-48.png 2x` }),
  diamond: Object.freeze({ src: `${HUD_ART}diamond-24.png`, srcset: `${HUD_ART}diamond-48.png 2x` })
});

// [tag, attributes] lists on a 24 x 24 grid; every shape gets the ink outline
// unless it says otherwise.
const ICONS = Object.freeze({
  machine: [
    ["circle", { cx: 12, cy: 10.6, r: 5.8, fill: "#d9f6ff" }],
    ["circle", { cx: 10, cy: 12.4, r: 1.7, fill: "#ff6fb5", "stroke-width": 1.2 }],
    ["circle", { cx: 13.9, cy: 12.6, r: 1.7, fill: "#ffd23f", "stroke-width": 1.2 }],
    ["circle", { cx: 12, cy: 9, r: 1.7, fill: "#4d7cff", "stroke-width": 1.2 }],
    ["path", { d: "M7.2 3.6h9.6l1.2 2.4H6z", fill: "#2ec4f1" }],
    ["path", { d: "M7.4 15.8h9.2l1.8 5.6H5.6z", fill: "#2ec4f1" }],
    ["circle", { cx: 12, cy: 18.5, r: 1.4, fill: "#ffd23f", "stroke-width": 1.2 }]
  ],
  furnace: [
    ["path", { d: "M12 2.6c1.9 2.2 3.5 3.7 3.5 6.1a3.5 3.5 0 0 1-7 0c0-1.5.8-2.5 1.7-3.4.2 1.2.8 2 1.6 2.2-.3-1.8-.2-3.3.2-4.9z", fill: "#ff9f1c" }],
    ["path", { d: "M4.6 11.2h14.8l-1.5 8a2.1 2.1 0 0 1-2.1 1.7H8.2a2.1 2.1 0 0 1-2.1-1.7z", fill: "#59647d" }],
    ["path", { d: "M3.4 11.2h17.2", fill: "none" }],
    ["path", { d: "M9 15.6h6", fill: "none", stroke: "#ffd23f", "stroke-width": 2.2 }]
  ],
  bag: [
    ["path", { d: "M9 6.4V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.4", fill: "none" }],
    ["rect", { x: 4.8, y: 6.4, width: 14.4, height: 14.8, rx: 4, fill: "#ff4d5e" }],
    ["rect", { x: 8, y: 13, width: 8, height: 5.6, rx: 1.6, fill: "#ffd23f" }],
    ["path", { d: "M8.2 10.2h7.6", fill: "none" }]
  ],
  flame: [
    ["path", { d: "M12 2.4c2.7 3 5.6 5.6 5.6 9.7a5.6 5.6 0 0 1-11.2 0c0-2.3 1.1-4 2.6-5.4.2 1.8 1 3 2.3 3.4-.5-2.7-.3-5.1.7-7.7z", fill: "#ff7a1a" }],
    ["path", { d: "M12 12.6c1.2 1.3 2.2 2.3 2.2 3.8a2.2 2.2 0 0 1-4.4 0c0-1.3.9-2.4 2.2-3.8z", fill: "#ffd23f", "stroke-width": 1.2 }]
  ],
  bolt: [
    ["path", { d: "M13.6 2.4 5 13.6h6.1l-1.6 8 8.6-11.2h-6.2z", fill: "#ffd23f" }]
  ],
  spark: [
    ["path", { d: "M11 3c.9 4.9 3.1 7.1 8 8-4.9.9-7.1 3.1-8 8-.9-4.9-3.1-7.1-8-8 4.9-.9 7.1-3.1 8-8z", fill: "#ffd23f" }],
    ["path", { d: "M19 2.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z", fill: "#fff", "stroke-width": 1.1 }]
  ],
  evolve: [
    ["path", { d: "M12 2.5l8.2 4.7v9.6L12 21.5l-8.2-4.7V7.2z", fill: "#3ddc84" }],
    ["path", { d: "M12 16.6V8.4M8.7 11.6 12 8.3l3.3 3.3", fill: "none", "stroke-width": 2.2 }]
  ],
  lock: [
    ["path", { d: "M8 10.6V8a4 4 0 0 1 8 0v2.6", fill: "none", "stroke-width": 2 }],
    ["rect", { x: 5, y: 10.6, width: 14, height: 10.2, rx: 2.6, fill: "#ffd23f" }],
    ["path", { d: "M12 14.4v2.8", fill: "none", "stroke-width": 2 }]
  ],
  galaxy: [
    ["circle", { cx: 12, cy: 12, r: 9.2, fill: "#5b2aa8" }],
    ["path", { d: "M12 6.6l1.5 3.4 3.7.3-2.8 2.4.9 3.6L12 14.4l-3.3 1.9.9-3.6-2.8-2.4 3.7-.3z", fill: "#ffd23f", "stroke-width": 1.2 }],
    ["circle", { cx: 6.8, cy: 16.8, r: 0.9, fill: "#fff", stroke: "none" }],
    ["circle", { cx: 17.6, cy: 7, r: 0.8, fill: "#fff", stroke: "none" }]
  ],
  // Chip families: A-class growth chips, B-class hunt cartridges, C-class bounty beacons.
  growth: [
    ["path", { d: "M9 3.4v2.6M12 3.4v2.6M15 3.4v2.6M9 18v2.6M12 18v2.6M15 18v2.6M3.4 9H6M3.4 12H6M3.4 15H6M18 9h2.6M18 12h2.6M18 15h2.6", fill: "none", "stroke-width": 1.5 }],
    ["rect", { x: 6, y: 6, width: 12, height: 12, rx: 2.2, fill: "#3ddc84" }],
    ["rect", { x: 9.4, y: 9.4, width: 5.2, height: 5.2, rx: 1, fill: "#d9ffe9", "stroke-width": 1.3 }]
  ],
  hunt: [
    ["circle", { cx: 12, cy: 12, r: 7.4, fill: "#ffe0e3" }],
    ["circle", { cx: 12, cy: 12, r: 3, fill: "#ff4d5e" }],
    ["path", { d: "M12 2.4v4.2M12 17.4v4.2M2.4 12h4.2M17.4 12h4.2", fill: "none", "stroke-width": 1.8 }]
  ],
  bounty: [
    ["path", { d: "M5 7.2a11.2 11.2 0 0 1 11.8 11.8", fill: "none", "stroke-width": 2 }],
    ["path", { d: "M5 11.4a7 7 0 0 1 7.6 7.6", fill: "none", stroke: "#2ec4f1", "stroke-width": 2.6 }],
    ["circle", { cx: 6.6, cy: 17.4, r: 2.6, fill: "#2ec4f1" }]
  ]
});

/** One inline SVG icon (decorative: aria-hidden). Unknown names give an empty icon. */
export function gachaIcon(name, className = "cm-gacha-svg", doc = globalThis.document) {
  const ns = svgNamespace(doc);
  const svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.dataset.icon = name;
  for (const [tag, attributes] of ICONS[name] ?? []) {
    const shape = doc.createElementNS(ns, tag);
    const style = { stroke: INK, "stroke-width": 1.6, "stroke-linejoin": "round", "stroke-linecap": "round", ...attributes };
    for (const [key, value] of Object.entries(style)) shape.setAttribute(key, String(value));
    svg.append(shape);
  }
  return svg;
}
export const GACHA_ICON_NAMES = Object.freeze(Object.keys(ICONS));

/** The chip family glyph for a gacha item kind (GROWTH / HUNT / BOUNTY). */
export function gachaKindIconName(kind) {
  return kind === "HUNT" ? "hunt" : kind === "BOUNTY" ? "bounty" : "growth";
}

function picture(doc, src, className, srcset) {
  const node = doc.createElement("img");
  node.className = className;
  node.src = src;
  if (srcset) node.srcset = srcset;
  node.alt = "";
  node.decoding = "async";
  node.draggable = false;
  node.setAttribute("aria-hidden", "true");
  return node;
}
/** The gacha ticket picture. */
export function gachaTicketImage(className = "cm-gacha-ticket", doc = globalThis.document) {
  return picture(doc, GACHA_TICKET_ART, className);
}
/** The official Bits coin or diamond picture from the status bar. */
export function gachaCurrencyImage(kind, className = "cm-gacha-currency", doc = globalThis.document) {
  const art = GACHA_CURRENCY_ART[kind] ?? GACHA_CURRENCY_ART.bits;
  return picture(doc, art.src, className, art.srcset);
}

/** Fill a ticket badge (shop tab, toolbar dock): the ticket picture and the count. */
export function paintGachaTicketBadge(badge, tickets, doc = globalThis.document) {
  const count = Math.max(0, Number(tickets) || 0);
  badge.replaceChildren(gachaTicketImage("cm-gacha-dock-badge__icon", doc), doc.createTextNode(String(count)));
  badge.hidden = count === 0;
  return badge;
}
