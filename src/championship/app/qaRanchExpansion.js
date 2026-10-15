// Explicit QA tooling only. Never imported by the normal game entrypoint.
import { deserializeChampionshipModernSave,
  serializeChampionshipModernSave } from './championshipStandaloneSave.js';
import { slotCountForTamerRank } from '../cage/cageCatalog.js';
import { NATIVE_RANCH_LAYOUT, RANCH_DECKS_LAYOUT, prototypeRanchExpansion,
  validateRanchLayout } from '../cage/ranchExpansion.js';

/** Preserve every existing save field except the two annex entitlement fields. */
export function createQaRanchExpansionText(previous) {
  deserializeChampionshipModernSave(previous);
  const save = JSON.parse(previous);
  const cage = save.cageEdit;
  if (![NATIVE_RANCH_LAYOUT, RANCH_DECKS_LAYOUT].includes(cage?.layoutVersion)) {
    throw Error('QA_RANCH_NATIVE_LAYOUT_REQUIRED');
  }
  const mainUnlocked = slotCountForTamerRank(save.progression.tamerRank);
  if (!validateRanchLayout(cage.placements, { ...cage, mainUnlocked })) {
    throw Error('QA_RANCH_CURRENT_LAYOUT_INVALID');
  }
  if (cage.layoutVersion === RANCH_DECKS_LAYOUT) return previous;
  save.cageEdit = { ...cage, layoutVersion: RANCH_DECKS_LAYOUT, expansion: prototypeRanchExpansion() };
  if (!validateRanchLayout(save.cageEdit.placements, { ...save.cageEdit, mainUnlocked })) {
    throw Error('QA_RANCH_EXPANDED_LAYOUT_INVALID');
  }
  return serializeChampionshipModernSave(save);
}

