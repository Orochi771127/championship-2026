// Battle glyphs (BATTLE_STYLE_V1, 2026-11-16): the small icons for battle styles, move classes,
// special skills and statuses. Art: assets/production/ui/battle-glyphs-r1 (ORIGINAL_GENERATED,
// manifest there). One 64 px WebP per key, drawn at 16-28 CSS px. A glyph that fails to load
// removes itself so the label beside it still reads on its own.

export const BATTLE_GLYPH_BASE = 'assets/production/ui/battle-glyphs-r1/';

export const battleGlyphSrc = (key) => `${BATTLE_GLYPH_BASE}${key}_64.webp`;

/** Battle style (productBattleStyle.js) -> glyph key; the same three serve the move classes. */
export const STYLE_GLYPHS = Object.freeze({ ATTACK: 'style_attack', SKILL: 'style_skill', SUPPORT: 'style_support' });

/**
 * Negative status runtime code (the battle's one negative-status slot) -> glyph key. The looks follow
 * the status-ailment body effects (presentation/battleFx) so the icon matches the body effect.
 */
export const STATUS_GLYPHS = Object.freeze({
  1: 'status_stunned', 2: 'status_charmed', 3: 'status_frozen', 4: 'status_rage', 5: 'status_confused',
  6: 'status_slowed', 7: 'status_poisoned', 8: 'status_bleeding', 9: 'status_sleep', 10: 'status_electrified',
  11: 'status_slowed', 12: 'status_petrified', 13: 'status_cursed', 14: 'status_burning'
});

/** An <img> for one glyph key, decorative (the caller supplies the visible or aria label). */
export function battleGlyph(key, className = 'cm-glyph') {
  const image = document.createElement('img');
  image.className = className;
  image.dataset.glyph = key;
  image.alt = '';
  image.decoding = 'async';
  image.width = 64;
  image.height = 64;
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener('error', () => image.remove(), { once: true });
  image.src = battleGlyphSrc(key);
  return image;
}

/** A compact chip: glyph + short text (styles, statuses, special skills). */
export function battleGlyphChip(key, text, className = 'cm-glyph-chip') {
  const chip = document.createElement('span');
  chip.className = className;
  chip.dataset.glyph = key;
  chip.append(battleGlyph(key), document.createTextNode(text));
  return chip;
}
