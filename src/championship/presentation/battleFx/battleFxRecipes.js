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
import {BATTLE_FX_PALETTES, BATTLE_FX_ELEMENT_PALETTE, battleFxMoveTier} from './battleFxPalettes.js';

// Palettes and the move tier live in battleFxPalettes.js (no catalog import),
// so light presentation pieces can use them without the bank profiles.
export {BATTLE_FX_PALETTES, BATTLE_FX_ELEMENT_PALETTE, battleFxMoveTier};

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

// Move names are display text owned by the text layer
// (src/championship/text/battleMoveNames.js); recipes only describe the look.
