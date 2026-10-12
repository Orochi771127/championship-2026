// Dynamic battle presentation -- what a move LOOKS like.
//
// OWNER_APPROVED_ADAPTATION 2026-10-12 (docs/coordination/OWNER_DIRECTION.md):
// the Owner asked for battles that read like a modern arena game using the
// project's own characters, moves and effects. Everything here is a
// presentation look-up. The simulation never reads it: no rule, timing, RNG
// draw, collision or damage changes when a recipe or palette changes.
//
// INPUTS ARE EXISTING DATA ONLY
// -----------------------------
// A move record already names its effect banks (high byte of +0x24/+0x30/
// +0x36/+0x38/+0x44, as battleEffectBankDemand reads them) and carries an
// element selector (+0x58). The bank family names come from
// battleEffectProfiles.json. The element meaning used for colour is an
// INFERENCE from which families each selector uses (fireball/magma for 1,
// tsunami/water/ice for 2, holy/heaven/light for 3, dark/smoke for 4,
// thunder for 5); it is a colour choice, not a claim about the original's
// element rules, which stay untraced.
import profiles from '../../../data/championship/battleEffectProfiles.json' with {type:'json'};

/** Colours per palette: core (hot centre), main, edge (outer glow), smoke. */
export const BATTLE_FX_PALETTES = Object.freeze({
  neutral: Object.freeze({core:0xffffff, main:0xbfe8ff, edge:0x5aa0e0, smoke:0x8a96a6}),
  fire:    Object.freeze({core:0xfff4c2, main:0xff8a1c, edge:0xd8360f, smoke:0x4a3128}),
  water:   Object.freeze({core:0xe8fbff, main:0x3fb8ff, edge:0x1f5fd6, smoke:0xbfe3f0}),
  ice:     Object.freeze({core:0xffffff, main:0x9eeaff, edge:0x4fa8e0, smoke:0xd8f4ff}),
  light:   Object.freeze({core:0xffffff, main:0xffe9a0, edge:0xf2b53a, smoke:0xfff2d0}),
  dark:    Object.freeze({core:0xf0d8ff, main:0x9a4dff, edge:0x3c1470, smoke:0x241830}),
  thunder: Object.freeze({core:0xffffe8, main:0xffe23a, edge:0xf09a12, smoke:0x5a5030}),
  nature:  Object.freeze({core:0xf0ffd0, main:0x7ee04a, edge:0x2f8f3a, smoke:0x506a34}),
  metal:   Object.freeze({core:0xffffff, main:0xd6dde6, edge:0xff9a3c, smoke:0x5c5f66}),
  earth:   Object.freeze({core:0xfff0d0, main:0xd8a560, edge:0x7a5230, smoke:0x8a6a48}),
  toxic:   Object.freeze({core:0xf4ffd0, main:0xa8d63a, edge:0x6a3a8a, smoke:0x4a4a2a}),
  psychic: Object.freeze({core:0xffe8ff, main:0xff7ad8, edge:0xa83cc8, smoke:0x5a2a5a}),
  wind:    Object.freeze({core:0xffffff, main:0xc8f5e8, edge:0x5fc8a8, smoke:0xe0f5ee})
});

/** Element selector -> palette, inferred from family use (see file note). */
export const BATTLE_FX_ELEMENT_PALETTE = Object.freeze(['neutral', 'fire', 'water', 'light', 'dark', 'thunder']);

// Family-name refinements. Order matters: the first match wins.
const FAMILY_PALETTE_RULES = Object.freeze([
  ['ice', /ice|snow|koori|yuki|frost/],
  ['thunder', /thunder|raiun|myorunirusanda|hammerspark|colorfulspark/],
  ['fire', /fire|flame|magma|foxfire|kyubimon|koenryu|sun00|explo|leomonhed|toyfire|cherrybomb/],
  ['water', /water|bubble|tsunami|walaser|fish|sumiburesu|casuburesu/],
  ['nature', /seed|rose|kinoko|banana/],
  ['toxic', /unchi|dirtysaucer/],
  ['dark', /dark|death|black|bakemon|curse|genocide|purple|abduction|hartbreak/],
  ['psychic', /hart|catseye|onpu|mind_eff|crashsymphony|smiley/],
  ['light', /holy|heaven|star|moon|crescent|lightball|apollomon|dianamon|infiniti|lekismon/],
  ['metal', /missile|kikanzyu|rocketpunch|cogwheel|syuriken|trident|spear|sword|tyusyaki|destroyer|pointer|bitbomb|clockmon|oukuwamon|brakedramon/],
  ['earth', /rock|bone|groundzero|jiware|tuno|toge|haguro/],
  ['wind', /tatumaki|airneedle|jetarrow|kumo/]
]);

/**
 * Visual form of a family. Drives the dynamic layer's recipe: how a live
 * effect actor is dressed (trail, beam, aura) and how the hit lands.
 */
const FAMILY_FORM_RULES = Object.freeze([
  ['melee', /^H_|etc_hiteffect/],
  ['character', /^(oukuwamon|crescemon|brakedramon|kiwimonsmall00)$/],
  ['beam', /beam|walaser|fraucanon|gigaburasuta|soloblue/],
  ['stream', /koenryu|firehurricane|tatumaki|snowstorm|darknesswave|sumiburesu|casuburesu|fireball_w/],
  ['area', /tsunami|raiun|kumo|yukigumo|groundzero|heavensgate|heaven00|genocide|gigadestroyer|risingdestroyer|myorunirusanda|thunderjavelin|crashsymphony|abduction|jiware|sun00|moon00|starlight|clockmonclock|bakemoncurse|explo|hammerspark|haguro|infinitiarrow|colorfulspark|dark01|hartbreak|specialtime/],
  ['support', /mind_eff|suport_eff|battle_popup/],
  ['smoke', /blacksmoke/],
  ['common', /^battle$/],
  ['projectile', /./]
]);

export const BATTLE_FX_FORMS = Object.freeze(['melee', 'character', 'beam', 'stream', 'area', 'support', 'smoke', 'common', 'projectile']);

/** Bank id -> family name without the e003_ prefix, or null. */
export function battleFxFamilyName(bankId) {
  const bank = profiles.banks[(bankId | 0) - 1];
  return bank ? bank.name.replace(/^e003_/, '') : null;
}

export function battleFxFamilyForm(family) {
  if (typeof family !== 'string' || !family) return null;
  return FAMILY_FORM_RULES.find(([, rule]) => rule.test(family))[0];
}

export function battleFxFamilyPalette(family) {
  if (typeof family !== 'string' || !family) return null;
  return FAMILY_PALETTE_RULES.find(([, rule]) => rule.test(family))?.[0] ?? null;
}

const FX_FIELDS = Object.freeze([['field24', 'prepare'], ['field30', 'launch'], ['field36', 'body'], ['field38', 'hit'], ['field44', 'extra']]);

/** The effect banks a move record names, in field order. */
export function battleFxMoveBanks(move) {
  const banks = [];
  for (const [field, role] of FX_FIELDS) {
    const value = move?.[field] ?? 0;
    const bankId = (value >>> 8) & 255, sequence = (value & 255) - 1;
    if (!bankId || sequence < 0) continue;
    banks.push(Object.freeze({role, bankId, sequence, family: battleFxFamilyName(bankId)}));
  }
  return Object.freeze(banks);
}

/**
 * Tier: 'basic' for the free kind-0 attack, 'support' for the contact-walk
 * kinds 2/3, 'skill' for kind 1, and 'ultimate' for the strongest kind-1 move
 * of its species (highest power, then highest cost, then lowest record), so
 * every fighter has exactly one signature move. `speciesMoves` is that
 * species' own move list; without it a kind-1 move is a plain skill.
 */
export function battleFxMoveTier(move, speciesMoves = null) {
  if (!move) return 'basic';
  if (move.kind === 0) return 'basic';
  if (move.kind !== 1) return 'support';
  if (!Array.isArray(speciesMoves)) return 'skill';
  const signature = speciesMoves.filter(m => m?.kind === 1 && m.recordIndex > 30)
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || (b.actionCost ?? 0) - (a.actionCost ?? 0) || a.recordIndex - b.recordIndex)[0];
  return signature?.recordIndex === move.recordIndex ? 'ultimate' : 'skill';
}

/**
 * The full look of one move: tier, form (from its body/launch bank), palette
 * (family refinement first, then the inferred element colour) and its banks.
 */
export function describeBattleFxMove(move, speciesMoves = null) {
  if (!move) return null;
  const banks = battleFxMoveBanks(move);
  const body = banks.find(b => b.role === 'body') ?? banks.find(b => b.role === 'launch') ?? banks.find(b => b.role === 'hit') ?? banks[0] ?? null;
  const form = body ? battleFxFamilyForm(body.family) : (move.kind === 0 ? 'melee' : move.kind === 1 ? 'projectile' : 'support');
  const familyPalette = banks.map(b => battleFxFamilyPalette(b.family)).find(Boolean) ?? null;
  const elementPalette = BATTLE_FX_ELEMENT_PALETTE[move.elementSelect] ?? 'neutral';
  const palette = elementPalette !== 'neutral' && familyPalette !== 'ice' ? elementPalette : (familyPalette ?? elementPalette);
  return Object.freeze({
    moveId: move.recordIndex,
    tier: battleFxMoveTier(move, speciesMoves),
    form: form === 'common' ? (move.kind === 0 ? 'melee' : 'projectile') : form,
    palette,
    power: move.power ?? 0,
    multiTarget: move.targetMode === 2,
    bankIds: Object.freeze([...new Set(banks.map(b => b.bankId))])
  });
}

// Approved species-move names (stable record index -> zh-Hant source text,
// translated through uiText). Owner 2026-10-12: only approved names are shown;
// candidates stay in docs/reports/battle-move-names-2026-10-12/ until approved.
// The 30 learnable special skills keep their existing approved names (zhHant.js).
export const BATTLE_FX_MOVE_NAMES = Object.freeze({});
