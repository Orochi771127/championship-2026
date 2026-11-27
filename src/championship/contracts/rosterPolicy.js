// Non-destructive commercial roster mode policy & read-only IP hygiene audit.
//
// Default mode is `'all_205'` so ongoing 205-character Chibi animation work is
// never blocked or hidden. When ready for a lightweight Web Demo or curated
// Steam launch build, switch the mode flag or pass custom display codes here
// without deleting any underlying art or data files.

import databaseDisplay from '../../data/championship/database-display.r1.json' with { type: 'json' };
import databaseIllustrations from '../../data/championship/database-illustrations.r1.json' with { type: 'json' };
import { SPECIES_NAMES_ZH } from '../text/catalogs.zhHant.js';
import { PRODUCT_RAISING_LIFECYCLE_RULES } from './productSpeciesData.js';
import { burstBasesFor, burstFormsFor } from './productBurstEvolution.js';

export const ROSTER_POLICY_MODES = Object.freeze({
  ALL_205: 'all_205',
  COMMERCIAL_CURATED: 'commercial_curated',
  WEB_DEMO: 'web_demo'
});

export const DEFAULT_ROSTER_POLICY_MODE = ROSTER_POLICY_MODES.ALL_205;

/** Curated green-light starter list (~50 original/low-risk codes) for future feature-flagged builds. */
export const COMMERCIAL_CURATED_CODES = Object.freeze([
  // GR (11)
  'GR03', 'GR05', 'GR16', 'GR19', 'GR23', 'GR33', 'GR34', 'GR36', 'GR39', 'GR40', 'GR41',
  // MA (15)
  'MA12', 'MA16', 'MA17', 'MA25', 'MA27', 'MA29', 'MA34', 'MA42', 'MA51', 'MA60', 'MA65', 'MA66', 'MA67', 'MA68', 'MA69',
  // AW (12)
  'AW01', 'AW02', 'AW10', 'AW17', 'AW18', 'AW19', 'AW24', 'AW31', 'AW32', 'AW50', 'AW52', 'AW53',
  // UL (12)
  'UL07', 'UL08', 'UL10', 'UL13', 'UL15', 'UL19', 'UL22', 'UL25', 'UL28', 'UL34', 'UL37', 'UL40'
]);

/** Compact 12-species showcase subset (3 curated four-tier lines) for itch.io / Steam Next Fest Web Demo. */
export const WEB_DEMO_CURATED_CODES = Object.freeze([
  'GR39', 'MA65', 'AW52', 'UL37',
  'GR40', 'MA66', 'AW53', 'UL40',
  'GR41', 'MA67', 'AW50', 'UL34'
]);

export const DEFAULT_IP_HYGIENE_PATTERNS = Object.freeze([
  /獸$/,
  /暴龍/,
  /戰鬥型態/,
  /天女/,
  /天馬/
]);

const CODE_TO_ENTRY = new Map();
const INDEX_TO_ENTRY = new Map();
for (const entry of databaseDisplay.entries ?? []) {
  if (entry.contentStatus !== 'PUBLISHED') continue;
  CODE_TO_ENTRY.set(entry.displayCode, entry);
  INDEX_TO_ENTRY.set(entry.speciesIndex, entry);
}
// Merge product-original species (B215, GR39..GR41, MA65..MA69, AW52..AW53, UL40..UL42).
for (const entry of databaseIllustrations.entries ?? []) {
  if (!entry?.displayCode || !Number.isInteger(entry.speciesIndex)) continue;
  if (!CODE_TO_ENTRY.has(entry.displayCode)) CODE_TO_ENTRY.set(entry.displayCode, entry);
  if (!INDEX_TO_ENTRY.has(entry.speciesIndex)) INDEX_TO_ENTRY.set(entry.speciesIndex, entry);
}

const ILLUSTRATION_NAME_BY_INDEX = new Map(
  (databaseIllustrations.entries ?? []).map((e) => [e.speciesIndex, e.displayName])
);

/** Resolve the live zh-Hant display name for a speciesIndex from product tables. */
export function resolveSpeciesDisplayNameZh(speciesIndex) {
  return ILLUSTRATION_NAME_BY_INDEX.get(speciesIndex)
    ?? SPECIES_NAMES_ZH[String(speciesIndex)]
    ?? null;
}

/** Collect all parent speciesIndices that can evolve into `targetIndex` (normal + burst). */
function collectEvolutionParents(targetIndex) {
  const parents = new Set();
  const rules = PRODUCT_RAISING_LIFECYCLE_RULES.rules ?? [];
  for (let i = 0; i < rules.length; i++) {
    const list = rules[i];
    if (Array.isArray(list) && list.some((r) => r.target === targetIndex)) {
      parents.add(i + 8);
    }
  }
  for (const base of burstBasesFor(targetIndex) ?? []) {
    parents.add(base);
  }
  return parents;
}

/**
 * Inspect evolution links within an allowed Set<number>:
 * - `danglingTargets`: normal/burst evolution edges from an allowed species that point outside the set.
 * - `orphanStages`: GR/MA/AW/UL species in the set that have no in-set ancestor (useful when checking demo trees).
 */
export function inspectRosterEvolutionIntegrity(allowedIndices) {
  const danglingTargets = [];
  const orphanStages = [];
  const rules = PRODUCT_RAISING_LIFECYCLE_RULES.rules ?? [];

  for (const sp of allowedIndices) {
    const entry = INDEX_TO_ENTRY.get(sp);
    if (!entry) continue;

    // Outgoing normal evolution rules (indices offset by +8).
    const outNormal = sp >= 8 ? (rules[sp - 8] ?? []) : [];
    for (const edge of outNormal) {
      if (!allowedIndices.has(edge.target)) {
        danglingTargets.push(Object.freeze({
          from: sp,
          fromCode: entry.displayCode,
          to: edge.target,
          toCode: INDEX_TO_ENTRY.get(edge.target)?.displayCode ?? `species-${edge.target}`,
          kind: 'normal'
        }));
      }
    }

    // Outgoing burst forms.
    for (const edge of burstFormsFor(sp) ?? []) {
      const formTargets = [edge.form, ...(edge.alternates ?? [])].filter(Number.isInteger);
      for (const to of formTargets) {
        if (!allowedIndices.has(to)) {
          danglingTargets.push(Object.freeze({
            from: sp,
            fromCode: entry.displayCode,
            to,
            toCode: INDEX_TO_ENTRY.get(to)?.displayCode ?? `species-${to}`,
            kind: 'burst'
          }));
        }
      }
    }

    // Check whether MA/AW/UL entries have at least one in-set parent.
    if (entry.numberingStageIndex >= 4) {
      const parents = collectEvolutionParents(sp);
      let hasAllowedParent = false;
      for (const p of parents) {
        if (allowedIndices.has(p)) { hasAllowedParent = true; break; }
      }
      if (!hasAllowedParent) {
        orphanStages.push(Object.freeze({
          speciesIndex: sp,
          displayCode: entry.displayCode,
          displayName: resolveSpeciesDisplayNameZh(sp)
        }));
      }
    }
  }

  return Object.freeze({
    danglingTargets: Object.freeze(danglingTargets),
    orphanStages: Object.freeze(orphanStages)
  });
}

/**
 * Resolve a non-destructive roster policy.
 * - `'all_205'` (default) returns `speciesIndices: null` (unrestricted).
 * - `'commercial_curated'` / `'web_demo'` returns a `Set<number>` ready to plug into
 *   `validateAsyncPvpSnapshot(snapshot, { allowedSpecies: policy.speciesIndices })` or
 *   future build/UI filters.
 */
export function resolveRosterPolicy(mode = DEFAULT_ROSTER_POLICY_MODE, {
  customCodes = null,
  includeEvolutionAncestors = false
} = {}) {
  const normalizedMode = Object.values(ROSTER_POLICY_MODES).includes(mode) ? mode : DEFAULT_ROSTER_POLICY_MODE;

  if (normalizedMode === ROSTER_POLICY_MODES.ALL_205 && !Array.isArray(customCodes)) {
    const allCodes = Array.from(CODE_TO_ENTRY.keys());
    return Object.freeze({
      mode: normalizedMode,
      unrestricted: true,
      speciesIndices: null,
      displayCodes: Object.freeze(allCodes),
      unknownCodes: Object.freeze([]),
      evolutionIntegrity: Object.freeze({ danglingTargets: Object.freeze([]), orphanStages: Object.freeze([]) })
    });
  }

  const requestedCodes = Array.isArray(customCodes)
    ? customCodes
    : normalizedMode === ROSTER_POLICY_MODES.WEB_DEMO
      ? WEB_DEMO_CURATED_CODES
      : COMMERCIAL_CURATED_CODES;

  const indices = new Set();
  const resolvedCodes = [];
  const unknownCodes = [];

  for (const raw of requestedCodes) {
    const code = String(raw).trim().toUpperCase();
    const entry = CODE_TO_ENTRY.get(code);
    if (!entry) {
      unknownCodes.push(code);
      continue;
    }
    if (!indices.has(entry.speciesIndex)) {
      indices.add(entry.speciesIndex);
      resolvedCodes.push(entry.displayCode);
    }
  }

  if (includeEvolutionAncestors) {
    const queue = Array.from(indices);
    while (queue.length > 0) {
      const current = queue.pop();
      for (const parent of collectEvolutionParents(current)) {
        if (!indices.has(parent) && INDEX_TO_ENTRY.has(parent)) {
          indices.add(parent);
          resolvedCodes.push(INDEX_TO_ENTRY.get(parent).displayCode);
          queue.push(parent);
        }
      }
    }
  }

  return Object.freeze({
    mode: normalizedMode,
    unrestricted: false,
    speciesIndices: indices,
    displayCodes: Object.freeze(resolvedCodes),
    unknownCodes: Object.freeze(unknownCodes),
    evolutionIntegrity: inspectRosterEvolutionIntegrity(indices)
  });
}

/**
 * Read-only IP / terminology hygiene scanner.
 * Run before Steam store submission (after 205-character animations finish) to get
 * an exact checklist of any remaining display names that still match flagged terms.
 */
export function auditRosterIpHygiene({
  codes = null,
  patterns = DEFAULT_IP_HYGIENE_PATTERNS
} = {}) {
  const entries = Array.isArray(codes)
    ? codes.map((c) => CODE_TO_ENTRY.get(String(c).trim().toUpperCase())).filter(Boolean)
    : Array.from(INDEX_TO_ENTRY.values()).filter((e) => e.numberingStageIndex >= 1);

  const flaggedNames = [];
  for (const entry of entries) {
    const name = resolveSpeciesDisplayNameZh(entry.speciesIndex);
    if (!name) continue;
    const matched = patterns.filter((re) => re.test(name)).map((re) => re.source);
    if (matched.length > 0) {
      flaggedNames.push(Object.freeze({
        speciesIndex: entry.speciesIndex,
        displayCode: entry.displayCode,
        displayName: name,
        matchedPatterns: Object.freeze(matched)
      }));
    }
  }

  return Object.freeze({
    scannedCount: entries.length,
    flaggedCount: flaggedNames.length,
    flaggedNames: Object.freeze(flaggedNames)
  });
}
