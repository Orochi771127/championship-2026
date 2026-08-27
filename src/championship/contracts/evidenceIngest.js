import { deepFreeze, isPlainRecord } from "./championshipContracts.js";
import { legacyRuleToClaim } from "./evidenceAdapter.js";
import {
  CLAIM_TOPIC,
  createEvidenceClaim,
  createEvidenceDescriptor,
  expandLegacyEvidenceStatus
} from "./evidenceTaxonomy.js";

// ---------------------------------------------------------------------------
// M4 (Owner decision 2): the single canonicalization boundary.
//
//   raw input -> format detection -> minimal structural check
//             -> canonicalization -> canonical semantic validation
//             -> canonical domain object -> consumers
//
// Domain consumers call ingest* once at their edge and then read only canonical
// fields. No consumer may import the legacy mapper directly; the architectural
// guard enforces that.
// ---------------------------------------------------------------------------

export const INPUT_FORMAT = deepFreeze({
  CANONICAL: "CANONICAL",
  LEGACY_RULE: "LEGACY_RULE",
  LEGACY_STATUS: "LEGACY_STATUS"
});

/** Detect which generation a piece of evidence input belongs to. */
export function detectEvidenceFormat(input) {
  if (typeof input === "string") return INPUT_FORMAT.LEGACY_STATUS;
  if (!isPlainRecord(input)) throw new TypeError("Evidence input must be a string or plain object");
  if (isPlainRecord(input.evidence) || typeof input.sourceAuthority === "string") return INPUT_FORMAT.CANONICAL;
  if (typeof input.evidenceStatus === "string") return INPUT_FORMAT.LEGACY_RULE;
  throw new Error("Unrecognised evidence input shape");
}

/**
 * Canonicalize any supported evidence input into a frozen EvidenceDescriptor.
 * This is the only place in the domain that is allowed to look at legacy shapes.
 */
export function ingestEvidence(input, { claimTopic, evidenceRefs, ruleAuthority, sourceAuthority } = {}) {
  const format = detectEvidenceFormat(input);

  if (format === INPUT_FORMAT.LEGACY_STATUS) {
    return expandLegacyEvidenceStatus(input, { claimTopic, evidenceRefs, ruleAuthority, sourceAuthority });
  }
  if (format === INPUT_FORMAT.LEGACY_RULE) {
    return legacyRuleToClaim(input, { claimTopic }).evidence;
  }
  if (isPlainRecord(input.evidence)) return input.evidence;
  return createEvidenceDescriptor(input);
}

/** Canonicalize a { value, evidence } pair or a legacy rule into a claim. */
export function ingestClaim(input, options = {}) {
  const format = detectEvidenceFormat(input);
  if (format === INPUT_FORMAT.LEGACY_RULE) return legacyRuleToClaim(input, options);
  if (format === INPUT_FORMAT.CANONICAL && isPlainRecord(input.evidence)) {
    return createEvidenceClaim({ value: input.value, evidence: input.evidence });
  }
  throw new Error("ingestClaim requires a legacy rule or a { value, evidence } pair");
}

/**
 * Ingest a contract-style record that carries a bare `evidenceStatus` string
 * alongside its payload — the shape used by the R2 field contracts.
 * Returns the payload plus a canonical `evidence` descriptor.
 */
export function ingestContract(contract, { claimTopic = CLAIM_TOPIC.UNSPECIFIED, evidenceRefs = [] } = {}) {
  if (!isPlainRecord(contract)) throw new TypeError("Contract must be a plain object");
  if (typeof contract.evidenceStatus !== "string") {
    throw new TypeError("Contract must declare a legacy evidenceStatus to be ingested");
  }
  const { evidenceStatus, ...payload } = contract;
  const evidence = expandLegacyEvidenceStatus(evidenceStatus, { claimTopic, evidenceRefs });
  return deepFreeze({ ...payload, evidence });
}

/** Ingest many contracts keyed by name, e.g. a field inventory. */
export function ingestContractMap(contracts, options = {}) {
  if (!isPlainRecord(contracts)) throw new TypeError("Contract map must be a plain object");
  const out = {};
  for (const [name, contract] of Object.entries(contracts)) {
    out[name] = ingestContract(contract, options);
  }
  return deepFreeze(out);
}

export const EVIDENCE_INGEST_VERSION = "m4";
