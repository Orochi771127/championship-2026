import { deepFreeze, isPlainRecord } from "./championshipContracts.js";
import { validateEvidenceBoundExecutableRule } from "./evidencePolicy.js";
import {
  CLAIM_TOPIC,
  EXECUTION_SCOPE,
  assertAuthoritiesConsistent,
  createEvidenceClaim,
  deriveLegacyEvidenceStatus,
  expandLegacyEvidenceStatus,
  ruleAuthorityFromSourceAuthority,
  sourceAuthorityFromRuleAuthority
} from "./evidenceTaxonomy.js";

// ---------------------------------------------------------------------------
// M2 bridge.
//
// evidencePolicy.js is deliberately NOT modified. Every legacy rule still goes
// through the original guard unchanged; this adapter runs the canonical
// taxonomy alongside it and refuses to disagree with it. That makes "the guards
// were not weakened" a machine-checkable property rather than a claim.
// ---------------------------------------------------------------------------

const LEGACY_RULE_KEYS = Object.freeze([
  "evidenceRefs",
  "evidenceStatus",
  "executable",
  "originalParityClaim",
  "ruleAuthority",
  "value"
]);

// M3 (Owner decision 3): the legacy `executable` flag records value presence,
// not permission to run in production. evidencePolicy.js lines 49-54:
//
//   executable === true  =>  value must be non-null
//   executable !== true  =>  value must be null
//
// Named explicitly so no future reader mistakes it for executionScope. The
// reverse promotion (legacy executable=true -> canonical EXECUTABLE) is
// forbidden and is covered by a regression test.
export function legacyValueExecutable(value) {
  return value !== null && value !== undefined;
}

export function legacyRuleToClaim(rule, { claimTopic } = {}) {
  if (!isPlainRecord(rule)) throw new TypeError("Legacy rule must be a plain object");

  // A transitional record may additionally carry the canonical sourceAuthority.
  // Everything else must match the legacy shape exactly.
  const { sourceAuthority, ...legacyPart } = rule;
  const keys = Object.keys(legacyPart).sort();
  if (keys.length !== LEGACY_RULE_KEYS.length || keys.some((key, index) => key !== LEGACY_RULE_KEYS[index])) {
    throw new Error("Legacy rule shape is not exact");
  }

  // M3: when both authority fields are present they must agree. ruleAuthority's
  // priority resolves records that lack the canonical field; it never silences
  // a conflict.
  assertAuthoritiesConsistent({ ruleAuthority: rule.ruleAuthority, sourceAuthority });

  // The original guard remains the gate for legacy input.
  validateEvidenceBoundExecutableRule(legacyPart);

  const evidence = expandLegacyEvidenceStatus(rule.evidenceStatus, {
    evidenceRefs: rule.evidenceRefs,
    ruleAuthority: rule.ruleAuthority,
    sourceAuthority,
    claimTopic
  });

  // M2.1 / M4: sourceAuthority is taken from ruleAuthority, disambiguated with
  // the record's own evidenceStatus. Never resolved without that context.
  const expectedAuthority = sourceAuthorityFromRuleAuthority(rule.ruleAuthority, {
    evidenceStatus: rule.evidenceStatus
  });
  if (evidence.sourceAuthority !== expectedAuthority) {
    throw new Error(`ruleAuthority ${rule.ruleAuthority} disagrees with derived ${evidence.sourceAuthority}`);
  }
  if (evidence.originalParityClaim !== rule.originalParityClaim) {
    throw new Error("originalParityClaim disagrees between legacy rule and canonical descriptor");
  }

  // The legacy `executable` flag means "this rule carries a non-null value and
  // is evaluable" (evidencePolicy.js lines 49-54). It is NOT the canonical
  // executionScope, which says how far the claim may be used. Conflating the
  // two is what promoted every research rule to production in M2; M2.1 keeps
  // the implication one-directional only.
  if (evidence.executionScope === EXECUTION_SCOPE.EXECUTABLE && rule.executable !== true) {
    throw new Error("canonical scope is EXECUTABLE but the legacy rule carries no value");
  }

  return createEvidenceClaim({ value: rule.value, evidence });
}

export function claimToLegacyRule(claim) {
  if (!isPlainRecord(claim) || !isPlainRecord(claim.evidence)) {
    throw new TypeError("Claim must be { value, evidence }");
  }
  const { evidence } = claim;
  const legacy = {
    value: claim.value,
    ruleAuthority: ruleAuthorityFromSourceAuthority(evidence.sourceAuthority),
    evidenceStatus: deriveLegacyEvidenceStatus(evidence),
    executable: legacyValueExecutable(claim.value),
    originalParityClaim: evidence.originalParityClaim,
    evidenceRefs: [...evidence.evidenceRefs]
  };
  // A canonical descriptor that cannot survive the original guard is a bug in
  // the migration, not a reason to relax the guard.
  validateEvidenceBoundExecutableRule(legacy);
  return deepFreeze(legacy);
}

// A raw / structure / derived research claim paired with the runtime claim that
// is allowed to execute. The research claim is never rewritten.
export function pairResearchWithRuntime({ researchValue, researchStatus, researchTopic, runtimeValue, runtimeStatus, runtimeRefs = [] }) {
  const research = createEvidenceClaim({
    value: researchValue,
    evidence: expandLegacyEvidenceStatus(researchStatus, { claimTopic: researchTopic })
  });
  const runtime = createEvidenceClaim({
    value: runtimeValue,
    evidence: expandLegacyEvidenceStatus(runtimeStatus, {
      claimTopic: CLAIM_TOPIC.RUNTIME_MEANING,
      evidenceRefs: runtimeRefs
    })
  });
  if (research.evidence.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    throw new Error("Research claim must not be executable");
  }
  return deepFreeze({ research, runtime });
}

export const EVIDENCE_ADAPTER_VERSION = "m2";
