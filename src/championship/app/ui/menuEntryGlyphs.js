// Menu entry glyphs (Owner 2026-10-28): one drawn icon per System menu card so
// the bag, the journal and the story chapters carry a picture like the medal
// board does, and the session keys get a small leading mark. Original vector
// drawings, authored here; nothing is loaded and nothing reads game state.
//
// The markup is parsed as HTML so no namespace URL literal is needed (the
// runtime firewall forbids remote-looking URLs in src/).

const INK = 'stroke="#14141f" stroke-linejoin="round" stroke-linecap="round"';

// Cards: full-colour 32 px pictures in the same corner as the medal board.
const BADGES = Object.freeze({
  // A tactical explorer pack: flap, buckle, front pocket and side straps.
  backpack: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M11.2 9V7.4a4.8 4.8 0 0 1 9.6 0V9h-2.5V7.5a2.3 2.3 0 0 0-4.6 0V9z" fill="#8a4b1f" ${INK} stroke-width="1.5"/>
    <rect x="5.5" y="8.6" width="21" height="19.6" rx="5.2" fill="#e88a3a" ${INK} stroke-width="2"/>
    <path d="M7.4 21.6v4.2M24.6 21.6v4.2" stroke="#9c5420" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M6.4 13.6c3.6 2.6 15.6 2.6 19.2 0v-1.4a3.4 3.4 0 0 0-3.4-3.4H9.8a3.4 3.4 0 0 0-3.4 3.4z" fill="#b65e24" ${INK} stroke-width="1.5"/>
    <rect x="9.8" y="17.6" width="12.4" height="8" rx="2.4" fill="#f6b860" ${INK} stroke-width="1.5"/>
    <path d="M12.4 20.6h7.2" stroke="#9c5420" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="14" y="13.6" width="4" height="5" rx="1.1" fill="#ffd23f" ${INK} stroke-width="1.3"/>
    <path d="M9 10.6c.6-.6 1.4-.9 2.2-.9" stroke="#fff3d6" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
  </svg>`,
  // A leather field notebook with a compass on the cover and a ribbon bookmark.
  journal: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="8.2" y="5.6" width="18.6" height="22.6" rx="2.6" fill="#fff3d6" ${INK} stroke-width="1.8"/>
    <path d="M26.8 9.4H28M26.8 13.4H28M26.8 17.4H28M26.8 21.4H28" stroke="#c9b48a" stroke-width="1.2"/>
    <rect x="5" y="4.4" width="19.2" height="23" rx="2.6" fill="#9a5b2c" ${INK} stroke-width="2"/>
    <path d="M8.4 4.8v22.2" stroke="#6b3a17" stroke-width="1.6"/>
    <circle cx="16.4" cy="15.6" r="5.4" fill="#ffd23f" ${INK} stroke-width="1.5"/>
    <circle cx="16.4" cy="15.6" r="3.8" fill="#2a8fd8" stroke="#14141f" stroke-width=".9"/>
    <path d="M16.4 11.9l1.3 3.7-1.3 3.7-1.3-3.7z" fill="#ff4d5e" stroke="#14141f" stroke-width=".7" stroke-linejoin="round"/>
    <path d="M16.4 15.6l1.3 3.7-1.3-.4" fill="#fff8e7"/>
    <path d="M20 4.4v8.8l1.9-1.7 1.9 1.7V4.4" fill="#ff4d5e" ${INK} stroke-width="1.3"/>
  </svg>`,
  // A dimension-rift crystal glowing violet and cyan over an observation scroll.
  story: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="10.4" r="9.4" fill="#56e3c2" opacity=".2"/>
    <circle cx="16" cy="10.4" r="6.4" fill="#a259ff" opacity=".22"/>
    <path d="M4.6 23.2a2.6 2.6 0 0 1 2.6-2.6h16.4v6.6H7.2a2.6 2.6 0 0 1-2.6-2.6z" fill="#fff3d6" ${INK} stroke-width="1.7"/>
    <circle cx="24.2" cy="23.9" r="3.3" fill="#e6cf9e" ${INK} stroke-width="1.7"/>
    <circle cx="24.2" cy="23.9" r="1.1" fill="#b8955a"/>
    <path d="M8.4 23.9h11.2" stroke="#7b4dff" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2.2 1.6"/>
    <path d="M16 2.2l6.2 7.6L16 19.6 9.8 9.8z" fill="#7b4dff" ${INK} stroke-width="1.7"/>
    <path d="M16 2.2l6.2 7.6L16 19.6z" fill="#39cfe0"/>
    <path d="M9.8 9.8h12.4L16 2.2z" fill="#c9b8ff"/>
    <path d="M16 2.2l6.2 7.6L16 19.6 9.8 9.8z" fill="none" ${INK} stroke-width="1.7"/>
    <path d="M13.4 7.2l1.4-2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M26.6 4.6v2.4M25.4 5.8h2.4M5.4 12.2v1.8M4.5 13.1h1.8" stroke="#ff6fa6" stroke-width="1.1" stroke-linecap="round"/>
  </svg>`
});

// Session keys: one-colour 24 px line marks drawn in the key's text colour.
const LINE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const PREFIXES = Object.freeze({
  friends: `<svg viewBox="0 0 24 24" aria-hidden="true" ${LINE}><circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0"/><circle cx="16.6" cy="9.4" r="2.6"/><path d="M15.4 14.4a4.8 4.8 0 0 1 5.6 4.6"/></svg>`,
  account: `<svg viewBox="0 0 24 24" aria-hidden="true" ${LINE}><path d="M7 18.5h10.2a4 4 0 0 0 .5-8 5.6 5.6 0 0 0-10.8 1.4A3.4 3.4 0 0 0 7 18.5z"/><path d="M12 16v-5.2M9.8 13l2.2-2.2 2.2 2.2"/></svg>`,
  help: `<svg viewBox="0 0 24 24" aria-hidden="true" ${LINE}><circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.4"/><path d="M12 17.2v.1"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="butt"><circle cx="12" cy="12" r="7.4" stroke-width="3" stroke-dasharray="2.6 3.2"/><circle cx="12" cy="12" r="5.4" stroke-width="2"/><circle cx="12" cy="12" r="1.8" stroke-width="2"/></svg>`,
  saveQuit: `<svg viewBox="0 0 24 24" aria-hidden="true" ${LINE}><path d="M4.5 5.6a1.1 1.1 0 0 1 1.1-1.1h9.6l3.3 3.3v4.4"/><path d="M4.5 5.6v12.8a1.1 1.1 0 0 0 1.1 1.1h6.6"/><path d="M8 4.5v4.2h6V4.5"/><path d="M15.6 17h5.4M18.8 14.6l2.4 2.4-2.4 2.4"/></svg>`
});

export const MENU_BADGE_GLYPH_IDS = Object.freeze(Object.keys(BADGES));
export const MENU_PREFIX_GLYPH_IDS = Object.freeze(Object.keys(PREFIXES));

/** Where an entry's glyph sits: "badge" (card corner), "prefix" (before the label) or null. */
export function menuEntryGlyphPlacement(entryId) {
  return Object.hasOwn(BADGES, entryId) ? "badge" : Object.hasOwn(PREFIXES, entryId) ? "prefix" : null;
}

/** The drawn icon for a menu entry, or null. */
export function menuEntryGlyph(doc, entryId) {
  const markup = BADGES[entryId] ?? PREFIXES[entryId];
  if (!markup || !doc?.createElement) return null;
  const holder = doc.createElement("span");
  holder.className = "cm-toolbar__entry-glyph";
  holder.setAttribute("data-placement", menuEntryGlyphPlacement(entryId));
  holder.setAttribute("data-glyph", entryId);
  holder.setAttribute("aria-hidden", "true");
  holder.innerHTML = markup;
  return holder;
}
