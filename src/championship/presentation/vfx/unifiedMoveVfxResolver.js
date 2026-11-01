// One effect-element authority for every view that draws a move
// (OWNER_APPROVED_ADAPTATION 2026-11-01, docs/coordination/OWNER_DIRECTION.md
// VFX_FIVE_LAYER_20261101).
//
// Before this module the AI battle coloured a move from its record's element
// selector, the Dex from the theme table and the Data Arena from its relay
// element, and none of them read the partner's ten-element taxonomy. The
// battle dressing, the Dex sandbox and the Data Arena now all ask here.
//
// Priority for a move's effect element:
//   1. NAME     the approved zh-Hant name states an element outright
//               (text/moveNameElements.js), e.g. 焰角泡泡 -> FIRE;
//   2. MOVE     the record's own element selector (+0x58, 1..5);
//   3. BANK     the colour the record's own effect bank family reads as;
//   4. PARTNER  the caster's taxonomy element (species-taxonomy.v1.json);
//   5. NEUTRAL  nothing above applies.
//
// Presentation only: nothing here changes a move's power, cost, element rule,
// range, timing, RNG draw or the native effect pool. The battle keeps drawing
// the record's own banks through the native effect VM; FALLBACK banks below are
// drawn by the presentation layer only for records that name no effect bank.
import {speciesTaxonomy} from '../../contracts/speciesTaxonomy.js';
import {moveNameElement} from '../../text/moveNameElements.js';
import {BATTLE_FX_PALETTES, battleFxFamilyPalette, battleFxMoveBanks, describeBattleFxMove} from '../battleFx/battleFxRecipes.js';
import {moveVfxTheme} from '../battleFx/moveVfxThemes.js';

export const VFX_ELEMENTS = Object.freeze(['METAL', 'WOOD', 'EARTH', 'WATER', 'FIRE', 'SUN', 'ICE', 'WIND', 'THUNDER', 'MOON']);

/**
 * Per-element look: the three-tier palette (core / main / edge, plus smoke),
 * the ground mark a hit leaves for four seconds, the full-field storm a
 * signature move raises, the brief overlay on the struck body, the accent cell
 * on a fallback melee hit, and the bounded 3D weather system for signatures.
 * Cells are [bankId, sequenceId] of the shared effect atlas.
 */
export const ELEMENT_VFX = Object.freeze({
  FIRE:    Object.freeze({palette: 'fire',    decal: 'scorch',   storm: 'vortex',  overlay: [1, 30], accent: [1, 30], weather: null}),
  WATER:   Object.freeze({palette: 'water',   decal: 'puddle',   storm: 'aurora',  overlay: [6, 2],  accent: [6, 2],  weather: 'common-rain'}),
  ICE:     Object.freeze({palette: 'ice',     decal: 'frost',    storm: 'aurora',  overlay: [1, 31], accent: [26, 2], weather: 'common-snowstome'}),
  THUNDER: Object.freeze({palette: 'thunder', decal: 'static',   storm: 'lattice', overlay: [1, 32], accent: [1, 32], weather: 'common-spark'}),
  METAL:   Object.freeze({palette: 'metal',   decal: 'static',   storm: 'gears',   overlay: null,    accent: [1, 43], weather: 'common-spark'}),
  WOOD:    Object.freeze({palette: 'nature',  decal: 'roots',    storm: 'gale',    overlay: null,    accent: [25, 1], weather: 'common-wind'}),
  EARTH:   Object.freeze({palette: 'earth',   decal: 'crack',    storm: 'quake',   overlay: null,    accent: [24, 2], weather: 'common-sandstome'}),
  WIND:    Object.freeze({palette: 'wind',    decal: 'swirl',    storm: 'gale',    overlay: null,    accent: [33, 2], weather: 'common-wind'}),
  SUN:     Object.freeze({palette: 'light',   decal: 'sunburst', storm: 'eclipse', overlay: null,    accent: [1, 33], weather: 'common-lightup'}),
  MOON:    Object.freeze({palette: 'dark',    decal: 'shade',    storm: 'eclipse', overlay: null,    accent: [121, 2], weather: 'common-mist'}),
  NEUTRAL: Object.freeze({palette: 'neutral', decal: 'crack',    storm: 'burst',   overlay: null,    accent: null,    weather: null})
});

/** Palette key (battleFxPalettes) -> the element it reads as. */
const PALETTE_ELEMENT = Object.freeze({fire: 'FIRE', water: 'WATER', ice: 'ICE', thunder: 'THUNDER', metal: 'METAL', nature: 'WOOD',
  earth: 'EARTH', wind: 'WIND', light: 'SUN', dark: 'MOON'});
/** The record's element selector +0x58 (0 none, 1..5). */
const SELECTOR_ELEMENT = Object.freeze([null, 'FIRE', 'WATER', 'SUN', 'MOON', 'THUNDER']);

/**
 * Fallback cells by theme style for a record that names no effect bank. Every
 * entry is a sequence of the shared atlas that has an original remade cell set
 * (or one of the three banks no record names: seed00 25, snowcrystal00 26,
 * blacksmoke04 121).
 */
export const STYLE_FALLBACK_CELLS = Object.freeze({
  strike: {hit: [81, 0]}, claw: {hit: [79, 0]}, slash: {hit: [80, 0]}, pierce: {hit: [82, 0]},
  fireball: {launch: [7, 0], body: [7, 1], hit: [7, 2]}, flame: {launch: [7, 0], body: [7, 1], hit: [149, 0]},
  water: {launch: [6, 0], body: [6, 1], hit: [6, 2]}, ice: {launch: [26, 0], body: [26, 1], hit: [26, 2]},
  thunder: {launch: [28, 0], body: [28, 1], hit: [28, 2]}, holy: {launch: [9, 0], body: [9, 1], hit: [9, 2]},
  dark: {body: [121, 1], hit: [121, 2]}, sound: {hit: [3, 0]}, beam: {launch: [12, 0], body: [12, 1], hit: [12, 3]},
  vine: {body: [25, 0], hit: [25, 1]}, thorn: {body: [53, 1], hit: [53, 2]}, leaf: {body: [25, 0], hit: [25, 1]},
  seed: {body: [25, 0], hit: [25, 1]}, spore: {body: [8, 0], hit: [8, 1]},
  quake: {launch: [24, 0], body: [24, 1], hit: [24, 2]}, wind: {launch: [33, 0], body: [33, 1], hit: [33, 2]},
  missile: {launch: [39, 0], body: [39, 1], hit: [39, 2]}, gatling: {launch: [19, 0], body: [19, 1], hit: [19, 2]},
  shell: {launch: [134, 0], body: [134, 1], hit: [134, 2]},
  support: {prepare: [4, 0]}
});
const MELEE_STYLES = new Set(['strike', 'claw', 'slash', 'pierce']);
const GENERIC_FAMILIES = new Set(['battle', 'etc_hiteffect', 'H_claw', 'H_Slashtop', 'H_Knuckle', 'H_piercing']);

/**
 * Support moves: the bounded 3D system for a support record's +0x5C code.
 * 14..19 heal, 20 clear, 21..29 positive codes 1..9 (battleSupport.js): code 1
 * raises the attack curve, 2 the default defence index, 3 the move length;
 * 5..9 raise an element resistance. Code 4's stat is UNKNOWN_REQUIRES_TRACE, so
 * its system (hitup) is a presentation choice, as is critup for a critical hit.
 */
export function supportVfxSystem(statusCode) {
  const code = statusCode | 0;
  if (code >= 14 && code <= 19) return 'common-lightup';
  if (code === 20) return 'battle-circle';
  if (code === 21) return 'battle-atkup';
  if (code === 22) return 'battle-defup';
  if (code === 23) return 'battle-speedup';
  if (code === 24) return 'battle-hitup';
  if (code >= 25 && code <= 29) return 'battle-toleup';
  return 'battle-circle_my';
}
export const CRITICAL_VFX_SYSTEM = 'battle-critup';

/** Hue of a 0xRRGGBB colour in degrees. */
export function colorHue(color) {
  const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** The partner's taxonomy element for a species index, or null. */
export function partnerVfxElement(speciesIndex) {
  return Number.isSafeInteger(speciesIndex) ? speciesTaxonomy(speciesIndex)?.element ?? null : null;
}

/**
 * The resolved look of one move record. `speciesIndex` defaults to the
 * record's own owner; `speciesMoves` (that species' records) lets the tier
 * mark its signature move.
 */
export function resolveMoveVfx(move, {speciesIndex = move?.speciesId ?? null, speciesMoves = null} = {}) {
  if (!move) return null;
  const look = describeBattleFxMove(move, speciesMoves);
  const theme = moveVfxTheme(move.recordIndex);
  const banks = battleFxMoveBanks(move);
  const bankPalette = banks.map(b => battleFxFamilyPalette(b.family)).find(Boolean) ?? null;
  const named = moveNameElement(move.recordIndex);
  const selector = SELECTOR_ELEMENT[move.elementSelect] ?? null;
  const partner = partnerVfxElement(speciesIndex);
  let element = 'NEUTRAL', source = 'NONE';
  if (named) { element = named; source = 'NAME'; }
  else if (selector && bankPalette !== 'ice') { element = selector; source = 'MOVE'; }
  else if (PALETTE_ELEMENT[bankPalette]) { element = PALETTE_ELEMENT[bankPalette]; source = 'BANK'; }
  else if (partner) { element = partner; source = 'PARTNER'; }
  const table = ELEMENT_VFX[element];
  // Toxic and psychic bank colours have no element of their own: they keep
  // their colour unless a name or selector says otherwise.
  const paletteKey = source !== 'NAME' && source !== 'MOVE' && (bankPalette === 'toxic' || bankPalette === 'psychic') ? bankPalette : table.palette;
  const palette = BATTLE_FX_PALETTES[paletteKey] ?? BATTLE_FX_PALETTES.neutral;
  const style = theme?.style ?? (look.form === 'melee' ? 'strike' : move.kind >= 2 ? 'support' : 'holy');
  const tier = look.tier;
  // A name that contradicts the bank's own colour turns the bank's cells.
  const cellHue = source === 'NAME' && bankPalette && BATTLE_FX_PALETTES[bankPalette] && PALETTE_ELEMENT[bankPalette] !== element
    ? Math.round(((colorHue(palette.main) - colorHue(BATTLE_FX_PALETTES[bankPalette].main) + 540) % 360) - 180) : 0;
  // A hue turn cannot darken a bright bank into the moon's colour: multiply it instead.
  const cellTint = source === 'NAME' && element === 'MOON' && bankPalette && bankPalette !== 'dark' && bankPalette !== 'toxic' ? 0xb48cff : 0xffffff;
  const specific = banks.filter(b => b.family && !GENERIC_FAMILIES.has(b.family));
  // Cells to draw: the record's own banks, else the style's fallback set.
  const fallbackStyle = move.kind >= 2 ? 'support' : style;
  const fallback = banks.length ? null : STYLE_FALLBACK_CELLS[fallbackStyle] ?? STYLE_FALLBACK_CELLS.strike;
  const cells = banks.length
    ? banks.map(b => Object.freeze({role: b.role, bankId: b.bankId, sequence: b.sequence, source: 'RECORD'}))
    : Object.entries(fallback).map(([role, [bankId, sequence]]) => Object.freeze({role, bankId, sequence, source: 'FALLBACK'}));
  const accent = MELEE_STYLES.has(style) && !specific.length && table.accent ? Object.freeze({bankId: table.accent[0], sequence: table.accent[1]}) : null;
  const overlayCell = paletteKey === 'toxic' ? [1, 34] : table.overlay;
  return Object.freeze({
    moveId: move.recordIndex,
    element, elementSource: source, paletteKey, palette, style, tier, form: look.form,
    melee: MELEE_STYLES.has(style), cellHue: cellTint === 0xffffff ? cellHue : 0, cellTint,
    cells: Object.freeze(cells), fallback: Boolean(fallback), accent,
    decal: table.decal, storm: table.storm,
    overlay: overlayCell ? Object.freeze({bankId: overlayCell[0], sequence: overlayCell[1]}) : null,
    weather: tier === 'ultimate' ? table.weather : null
  });
}

/** Look-up by element alone (Data Arena pool moves, which have no record). */
export function elementVfx(element) {
  const key = VFX_ELEMENTS.includes(element) ? element : 'NEUTRAL';
  const table = ELEMENT_VFX[key];
  return Object.freeze({element: key, ...table, palette: BATTLE_FX_PALETTES[table.palette] ?? BATTLE_FX_PALETTES.neutral, paletteKey: table.palette});
}
