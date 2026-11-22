// Reversible per-individual ranch battle tendency (P1, 2026-11-21).
//
// Maps ranch drill / cage ecology shaping directly onto the existing verified ROM
// battle policies (0 = 必殺優先 / early skills, 1 = 普通攻擊 / conserve TP) without
// creating a second AI, hidden stat buff, free TP, or modified cooldowns.
//
// Explicit precedence (never silently overwritten):
//   1. Match-level manual tactic override (explicit choice in Battle Select / Sparring)
//   2. Individual's ranch training tendency (ENDURANCE -> 1, SKILL -> 0)
//   3. Legacy saved battleTactics[instanceId]
//   4. Default tactic (1 = 普通攻擊)

import { deepFreeze } from './championshipContracts.js';
export { PARTNER_TENDENCY_COPY, partnerTendencyText } from '../text/partnerTendencyText.js';

export const PARTNER_TENDENCY_KINDS = Object.freeze(['ENDURANCE', 'SKILL']);
export const PARTNER_TENDENCY_SOURCES = Object.freeze(['RANCH_DRILL', 'CAGE_ECO']);

export const PARTNER_TENDENCY_SPECS = deepFreeze({
  ENDURANCE: { id: 'ENDURANCE', tactic: 1 },
  SKILL: { id: 'SKILL', tactic: 0 }
});

const CAGE_ECOLOGY_TENDENCY = Object.freeze({
  sports: 'SKILL',
  gym: 'SKILL',
  volcano: 'SKILL',
  garden: 'ENDURANCE',
  forest: 'ENDURANCE',
  grassland: 'ENDURANCE',
  infirmary: 'ENDURANCE'
});

/** Map a ranch cage ecology type (ranchEcologyType) to a natural battle tendency, or null. */
export function tendencyForCageEcology(ecologyType) {
  return typeof ecologyType === 'string' && Object.hasOwn(CAGE_ECOLOGY_TENDENCY, ecologyType)
    ? CAGE_ECOLOGY_TENDENCY[ecologyType]
    : null;
}

/** Convert a normalized tendency entry (or kind string) into its ROM battle tactic (0/1), or null. */
export function tendencyToTactic(entry) {
  const kind = typeof entry === 'string' ? entry : entry?.kind;
  return kind && Object.hasOwn(PARTNER_TENDENCY_SPECS, kind) ? PARTNER_TENDENCY_SPECS[kind].tactic : null;
}

/**
 * Explicit tactic precedence for one individual:
 * match manual choice > ranch training tendency > legacy battleTactics > default (1).
 */
export function resolveEffectiveBattleTactic({
  manualTactic = null,
  trainingTendency = null,
  legacyTactic = null,
  defaultTactic = 1
} = {}) {
  if (manualTactic === 0 || manualTactic === 1 || manualTactic === 2) return manualTactic;
  const fromTendency = tendencyToTactic(trainingTendency);
  if (fromTendency !== null) return fromTendency;
  if (legacyTactic === 0 || legacyTactic === 1 || legacyTactic === 2) return legacyTactic;
  return defaultTactic;
}

/**
 * Normalize persisted `progression.trainingTendencies` (keyed by persistent `instanceId`).
 * Old saves without this field normalize safely to `{}`.
 */
export function normalizePartnerTendencies(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, raw] of Object.entries(value)) {
    if (!/^[\w:.-]{1,80}$/.test(id) || !raw || typeof raw !== 'object') continue;
    const kind = raw.kind;
    if (!PARTNER_TENDENCY_KINDS.includes(kind)) continue;
    const source = PARTNER_TENDENCY_SOURCES.includes(raw.source) ? raw.source : 'RANCH_DRILL';
    const cageEcology = typeof raw.cageEcology === 'string' && /^[a-z0-9-]{1,32}$/.test(raw.cageEcology)
      ? raw.cageEcology : null;
    out[id] = Object.freeze(cageEcology ? { kind, source, cageEcology } : { kind, source });
  }
  return out;
}
