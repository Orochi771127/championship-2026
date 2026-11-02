// Encyclopedia view of burst evolution (OWNER_APPROVED_ADAPTATION 2026-11-02, STAGE_REDESIGN_BURST_20261102).
// A 成熟期 page lists the forms it bursts into in battle, with their unlock conditions; a 覺醒體 page lists the
// 成熟期 that burst into it. Pure: no individual, save, RNG or resolver. A form's name stays hidden until it is
// registered (its first burst) unless the full view is on.
import {deepFreeze} from '../contracts/championshipContracts.js';
import {BURST_CONDITION_IDS,burstBasesFor,burstFormTier,burstFormsFor} from '../contracts/productBurstEvolution.js';

const UNITS = {BATTLE_COUNT: 'BATTLES', EVOLUTION_WIN_PERCENT: 'PERCENT', REBIRTH_COUNT: 'TIMES', CARE_MISTAKE_VALUE: 'VALUE'};
function conditionRows(thresholds) {
  const rows = [];
  thresholds.slice(0, 11).forEach((value, i) => { if (value) rows.push({id: BURST_CONDITION_IDS[i], operator: 'GTE', value, unit: 'VALUE'}); });
  if (thresholds[22]) rows.push({id: 'BATTLE_COUNT', operator: 'GTE', value: thresholds[22], unit: UNITS.BATTLE_COUNT});
  if (thresholds[23]) rows.push({id: 'EVOLUTION_WIN_PERCENT', operator: 'GTE', value: thresholds[23], unit: UNITS.EVOLUTION_WIN_PERCENT});
  if (thresholds[24]) rows.push({id: 'REBIRTH_COUNT', operator: 'GTE', value: thresholds[24], unit: UNITS.REBIRTH_COUNT});
  if (thresholds[25]) rows.push({id: 'CARE_MISTAKE_VALUE', operator: 'LTE', value: thresholds[25], unit: UNITS.CARE_MISTAKE_VALUE});
  return rows;
}

export function projectDatabaseBurst(speciesIndex, {fullView = false, registeredSpecies = []} = {}) {
  const registered = new Set(Array.isArray(registeredSpecies) ? registeredSpecies : []);
  const seen = index => fullView || registered.has(index);
  const forms = burstFormsFor(speciesIndex);
  if (forms.length) {
    return deepFreeze({kind: 'BASE', forms: forms.map(form => ({tier: form.tier, formSpeciesIndex: form.form, viaSpeciesIndex: form.via,
      alternates: [...(form.alternates ?? [])], alternatesRevealed: (form.alternates ?? []).map(seen),
      revealed: seen(form.form), conditions: conditionRows(form.thresholds)}))});
  }
  const bases = burstBasesFor(speciesIndex);
  if (bases.length) {
    return deepFreeze({kind: 'FORM', tier: burstFormTier(speciesIndex), bases: bases.map(base => ({baseSpeciesIndex: base, revealed: seen(base)}))});
  }
  return null;
}
