import { deepFreeze, isPlainRecord } from "./championshipContracts.js";

// ---------------------------------------------------------------------------
// M1 — additive only.
//
// This module introduces the orthogonal evidence taxonomy. It does NOT replace
// evidencePolicy.js: the legacy `evidenceStatus` string remains the canonical
// source of truth during M1, and every existing throw guard stays untouched.
//
// The single legacy enum conflated five independent dimensions. The clearest
// proof is a real research row that needs two different answers at once:
//
//   field_5C 5 -> runtime status 11   : VERIFIED / BINARY      (executable)
//   runtime status 11 -> "BLIND"      : HIGH_CONFIDENCE / ENUM_ALIGNMENT
//
// A record-level descriptor cannot express that, so evidence is attached to
// individual claims (see createEvidenceClaim / createClaimSet).
// ---------------------------------------------------------------------------

export const SOURCE_AUTHORITY = deepFreeze({
  ORIGINAL_CHAMPIONSHIP: "ORIGINAL_CHAMPIONSHIP",
  CHAMPIONSHIP_ADAPTATION: "CHAMPIONSHIP_ADAPTATION",
  CHAMPIONSHIP_RESEARCH: "CHAMPIONSHIP_RESEARCH",
  CHAMPIONSHIP_ART_PROPOSAL: "CHAMPIONSHIP_ART_PROPOSAL"
});

export const EVIDENCE_LEVEL = deepFreeze({
  VERIFIED: "VERIFIED",
  HIGH_CONFIDENCE: "HIGH_CONFIDENCE",
  // M7-0 (Owner s5). Stage 4's STATUS_ID_SEMANTIC_CANDIDATES.csv grades three
  // of its rows MEDIUM_CONFIDENCE in its own `status` column. That is a real
  // confidence grade sitting between HIGH_CONFIDENCE and UNKNOWN, not noise and
  // not a weaker spelling of HIGH_CONFIDENCE. It can never be EXECUTABLE.
  MEDIUM_CONFIDENCE: "MEDIUM_CONFIDENCE",
  UNKNOWN: "UNKNOWN",
  // NOT_APPLICABLE is required for Championship-authored authorities: a product decision
  // makes no claim about the original at all, so neither VERIFIED nor UNKNOWN
  // is truthful. Flagged for Owner review in the M1 report.
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export const EVIDENCE_BASIS = deepFreeze({
  BINARY: "BINARY",
  CROSSCHECK: "CROSSCHECK",
  RUNTIME_TRACE: "RUNTIME_TRACE",
  STRUCTURE: "STRUCTURE",
  // A mathematical result derived from binary reads, not itself read directly.
  // Kept distinct from BINARY so a derivation can never be mistaken for a
  // direct observation (Owner decision A3).
  DERIVATION: "DERIVATION",
  STATISTICAL: "STATISTICAL",
  TEXT_ALIGNMENT: "TEXT_ALIGNMENT",
  ENUM_ALIGNMENT: "ENUM_ALIGNMENT",
  NONE: "NONE"
});

export const TRACE_STATE = deepFreeze({
  VERIFIED: "VERIFIED",
  PENDING_REPRODUCTION: "PENDING_REPRODUCTION",
  REQUIRES_TRACE: "REQUIRES_TRACE",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export const EXECUTION_SCOPE = deepFreeze({
  EXECUTABLE: "EXECUTABLE",
  RESEARCH_ONLY: "RESEARCH_ONLY",
  NAMING_ONLY: "NAMING_ONLY",
  PRESENTATION_ONLY: "PRESENTATION_ONLY",
  BLOCKED: "BLOCKED"
});

// Basis strength ordering, strongest first. Used by guards, not by consumers.
export const EVIDENCE_BASIS_STRENGTH = deepFreeze([
  EVIDENCE_BASIS.BINARY,
  EVIDENCE_BASIS.CROSSCHECK,
  EVIDENCE_BASIS.RUNTIME_TRACE,
  EVIDENCE_BASIS.STRUCTURE,
  EVIDENCE_BASIS.STATISTICAL,
  EVIDENCE_BASIS.TEXT_ALIGNMENT,
  EVIDENCE_BASIS.ENUM_ALIGNMENT,
  EVIDENCE_BASIS.NONE
]);

const CHAMPIONSHIP_AUTHORITIES = new Set([
  SOURCE_AUTHORITY.CHAMPIONSHIP_ADAPTATION,
  SOURCE_AUTHORITY.CHAMPIONSHIP_RESEARCH,
  SOURCE_AUTHORITY.CHAMPIONSHIP_ART_PROPOSAL
]);

// Bases that may back an EXECUTABLE original-parity claim.
//
// STRUCTURE and DERIVATION are deliberately absent: proving a shape exists, or
// deriving a result from binary reads, says nothing about runtime behaviour.
// Such a claim must be paired with a separate RUNTIME_MEANING claim carrying
// RUNTIME_TRACE evidence (Owner general principle: VERIFIED != EXECUTABLE).
const EXECUTABLE_BASES = new Set([
  EVIDENCE_BASIS.BINARY,
  EVIDENCE_BASIS.CROSSCHECK,
  EVIDENCE_BASIS.RUNTIME_TRACE
]);

// Research bookkeeping that composite legacy tokens used to smuggle inside the
// status string. Neither of these is evidence strength (Owner decision 3).
export const CLAIM_TOPIC = deepFreeze({
  SPECIES_GROUPING: "SPECIES_GROUPING",
  RAW_VALUE: "RAW_VALUE",
  STRUCTURE_SHAPE: "STRUCTURE_SHAPE",
  DERIVED_RESULT: "DERIVED_RESULT",
  RUNTIME_MEANING: "RUNTIME_MEANING",
  // M7 (Owner s2): which defender field the damage resolver reads for a given
  // action element selector. A statement about runtime behaviour, so it carries
  // the same evidence requirement as RUNTIME_MEANING -- a table that merely
  // lines up cannot establish it.
  ELEMENT_DEFENSE_SOURCE_ROUTING: "ELEMENT_DEFENSE_SOURCE_ROUTING",
  SEMANTIC_NAME: "SEMANTIC_NAME",
  DISPLAY_NAME: "DISPLAY_NAME",
  ENUM_NAME: "ENUM_NAME",
  DISTRIBUTION: "DISTRIBUTION",
  NEGATIVE_FINDING: "NEGATIVE_FINDING",
  UNSPECIFIED: "UNSPECIFIED"
});

// Naming claims label something for humans. They may never drive behaviour,
// whatever their evidence basis. The basis still records how strong the naming
// inference was — the difference lives in evidenceBasis, not executionScope
// (Owner decision A4).
const NAMING_TOPICS = new Set([
  CLAIM_TOPIC.SEMANTIC_NAME,
  CLAIM_TOPIC.DISPLAY_NAME,
  CLAIM_TOPIC.ENUM_NAME
]);

export function isNamingTopic(topic) {
  return NAMING_TOPICS.has(topic);
}

export const REQUIRED_TRACE = deepFreeze({
  DIRECT_READER_TRACE: "DIRECT_READER_TRACE",
  CALLER_TRACE: "CALLER_TRACE",
  REPRODUCTION: "REPRODUCTION",
  NONE: "NONE"
});

const DESCRIPTOR_KEYS = Object.freeze([
  "claimTopic",
  "evidenceBasis",
  "evidenceLevel",
  "evidenceRefs",
  "executionScope",
  "legacyToken",
  "originalParityClaim",
  "requiredTrace",
  "sourceAuthority",
  "traceState"
]);

const SAFE_FINDING_ID = /^[a-z0-9][a-z0-9:_-]{2,95}$/i;

function assertMember(value, table, fieldName) {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(table, value)) {
    throw new TypeError(`EvidenceDescriptor.${fieldName} is invalid: ${String(value)}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Legacy mapping. Every token observed across Stage 1-5, the 3D packs, the UI /
// Map packs, AGENTS.md and the R2 source tree. Permanent per Owner decision 9:
// research packs are never required to be regenerated.
// ---------------------------------------------------------------------------

// Row order: [sourceAuthority, evidenceLevel, evidenceBasis, traceState,
//             executionScope, originalParityClaim, claimTopic, requiredTrace]
//
// M1.1: any token whose migration confidence is not HIGH defaults to
// RESEARCH_ONLY. Uncertainty must never buy a looser scope (Owner decision 6).
const LEGACY_MAP = deepFreeze({
  // --- verified, executable --------------------------------------------------
  VERIFIED_BINARY: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "BINARY", "VERIFIED", "EXECUTABLE", true, "UNSPECIFIED", "NONE"],
  VERIFIED_CROSSCHECK: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "CROSSCHECK", "VERIFIED", "EXECUTABLE", true, "UNSPECIFIED", "NONE"],
  VERIFIED_BINARY_BEHAVIOR: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "RUNTIME_TRACE", "VERIFIED", "EXECUTABLE", true, "RUNTIME_MEANING", "NONE"],
  VERIFIED_RUNTIME_LOAD_PATH: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "RUNTIME_TRACE", "VERIFIED", "EXECUTABLE", true, "RUNTIME_MEANING", "NONE"],

  // --- verified value, unproven gameplay semantic (Owner decision 1) ---------
  // "RAW" proves the bytes/table exist in the binary. It proves nothing about
  // the runtime consumer. Promoting it to EXECUTABLE is forbidden; a separate
  // RUNTIME_MEANING claim must carry that, without overwriting the raw claim.
  VERIFIED_BINARY_RAW: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "BINARY", "VERIFIED", "RESEARCH_ONLY", false, "RAW_VALUE", "NONE"],
  VERIFIED_BINARY_DISTRIBUTION: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "STATISTICAL", "VERIFIED", "RESEARCH_ONLY", false, "DISTRIBUTION", "NONE"],
  VERIFIED_BINARY_NEGATIVE_FINDING: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "BINARY", "VERIFIED", "RESEARCH_ONLY", false, "NEGATIVE_FINDING", "NONE"],
  // A2 / A3 (Owner-adjudicated, M2): structure existence and binary-derived
  // arithmetic are both VERIFIED but neither is runtime behaviour. Pair with a
  // separate RUNTIME_MEANING claim to execute; never promote these in place.
  VERIFIED_BINARY_STRUCTURE: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "STRUCTURE", "VERIFIED", "RESEARCH_ONLY", false, "STRUCTURE_SHAPE", "NONE"],
  // NOTE: VERIFIED_STRUCTURE_ONLY is deliberately absent here. It belongs to
  // the `evidenceGrade` dialect, not to `evidenceStatus`; see
  // legacyDialectRegistry.js. Identical strings in different source fields are
  // different facts (Owner M6 s8).
  VERIFIED_DERIVED_FROM_BINARY: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "DERIVATION", "VERIFIED", "RESEARCH_ONLY", false, "DERIVED_RESULT", "NONE"],
  // Bare VERIFIED and the bare authority marker state no basis at all.
  VERIFIED: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "NONE", "VERIFIED", "RESEARCH_ONLY", false, "UNSPECIFIED", "NONE"],
  ORIGINAL_CHAMPIONSHIP: ["ORIGINAL_CHAMPIONSHIP", "VERIFIED", "NONE", "VERIFIED", "RESEARCH_ONLY", false, "UNSPECIFIED", "NONE"],

  // --- high confidence -------------------------------------------------------
  HIGH_CONFIDENCE: ["ORIGINAL_CHAMPIONSHIP", "HIGH_CONFIDENCE", "NONE", "REQUIRES_TRACE", "RESEARCH_ONLY", false, "UNSPECIFIED", "NONE"],
  HIGH_CONFIDENCE_STRUCTURE: ["ORIGINAL_CHAMPIONSHIP", "HIGH_CONFIDENCE", "STRUCTURE", "REQUIRES_TRACE", "RESEARCH_ONLY", false, "UNSPECIFIED", "NONE"],
  // A4 (Owner-adjudicated, M2): scope depends on claimTopic, not on the token.
  // With a naming topic supplied these become NAMING_ONLY; with no topic the
  // conservative RESEARCH_ONLY default applies. See TOPIC_SCOPE_RULES.
  HIGH_CONFIDENCE_CROSSCHECK: ["ORIGINAL_CHAMPIONSHIP", "HIGH_CONFIDENCE", "CROSSCHECK", "REQUIRES_TRACE", "RESEARCH_ONLY", false, "UNSPECIFIED", "NONE"],
  HIGH_CONFIDENCE_ENUM_ALIGNMENT: ["ORIGINAL_CHAMPIONSHIP", "HIGH_CONFIDENCE", "ENUM_ALIGNMENT", "REQUIRES_TRACE", "NAMING_ONLY", false, "SEMANTIC_NAME", "NONE"],
  // Composite token decomposed: topic and required trace were smuggled inside
  // the status string and are now first-class metadata (Owner decision 3).
  HIGH_CONFIDENCE_SPECIES_GROUPING_PENDING_DIRECT_READER_TRACE: ["ORIGINAL_CHAMPIONSHIP", "HIGH_CONFIDENCE", "STATISTICAL", "REQUIRES_TRACE", "RESEARCH_ONLY", false, "SPECIES_GROUPING", "DIRECT_READER_TRACE"],
  RECENT_TRACE_PENDING_REPRODUCTION: ["ORIGINAL_CHAMPIONSHIP", "HIGH_CONFIDENCE", "RUNTIME_TRACE", "PENDING_REPRODUCTION", "RESEARCH_ONLY", false, "UNSPECIFIED", "REPRODUCTION"],

  // --- unknown ---------------------------------------------------------------
  UNKNOWN_REQUIRES_TRACE: ["ORIGINAL_CHAMPIONSHIP", "UNKNOWN", "NONE", "REQUIRES_TRACE", "BLOCKED", false, "UNSPECIFIED", "NONE"],
  UNKNOWN_REQUIRES_CALLER_TRACE: ["ORIGINAL_CHAMPIONSHIP", "UNKNOWN", "STRUCTURE", "REQUIRES_TRACE", "BLOCKED", false, "UNSPECIFIED", "CALLER_TRACE"],
  UNKNOWN: ["ORIGINAL_CHAMPIONSHIP", "UNKNOWN", "NONE", "REQUIRES_TRACE", "BLOCKED", false, "UNSPECIFIED", "NONE"],
  UNKNOWN_SEMANTIC: ["ORIGINAL_CHAMPIONSHIP", "UNKNOWN", "STRUCTURE", "REQUIRES_TRACE", "RESEARCH_ONLY", false, "SEMANTIC_NAME", "NONE"],

  // --- Championship-authored --------------------------------------------------------
  // M2.1 (Owner): a research rule is a working model, not an adopted product
  // rule. Migration must never promote it to EXECUTABLE. Adoption is an
  // explicit Owner act that creates a new production claim.
  CHAMPIONSHIP_RESEARCH_RULE: ["CHAMPIONSHIP_RESEARCH", "NOT_APPLICABLE", "NONE", "NOT_APPLICABLE", "RESEARCH_ONLY", false, "UNSPECIFIED", "NONE"],
  CHAMPIONSHIP_ADAPTATION: ["CHAMPIONSHIP_ADAPTATION", "NOT_APPLICABLE", "NONE", "NOT_APPLICABLE", "EXECUTABLE", false, "UNSPECIFIED", "NONE"],
  CHAMPIONSHIP_ADAPTATION: ["CHAMPIONSHIP_ADAPTATION", "NOT_APPLICABLE", "NONE", "NOT_APPLICABLE", "EXECUTABLE", false, "UNSPECIFIED", "NONE"],
  ART_PROPOSAL: ["CHAMPIONSHIP_ART_PROPOSAL", "NOT_APPLICABLE", "NONE", "NOT_APPLICABLE", "PRESENTATION_ONLY", false, "UNSPECIFIED", "NONE"]
});

// Topics that describe a value's existence or derivation, never its runtime
// behaviour. Execution requires a separate RUNTIME_MEANING claim.
// Topics that assert something about what the game actually does at runtime.
// Bases that can only come from looking at the running game or its code.
const RUNTIME_CAPABLE_BASES = new Set([
  EVIDENCE_BASIS.BINARY,
  EVIDENCE_BASIS.RUNTIME_TRACE
]);

const RUNTIME_TOPICS = new Set([
  CLAIM_TOPIC.RUNTIME_MEANING,
  CLAIM_TOPIC.ELEMENT_DEFENSE_SOURCE_ROUTING
]);

const NON_EXECUTABLE_TOPICS = new Set([
  CLAIM_TOPIC.RAW_VALUE,
  CLAIM_TOPIC.DISTRIBUTION,
  CLAIM_TOPIC.NEGATIVE_FINDING,
  CLAIM_TOPIC.STRUCTURE_SHAPE,
  CLAIM_TOPIC.DERIVED_RESULT,
  CLAIM_TOPIC.SPECIES_GROUPING
]);

// Context-aware scope resolution (Owner decision A4). A legacy token alone is
// not enough to decide executionScope; what the claim is *about* decides it.
//
//   HIGH_CONFIDENCE + CROSSCHECK      about a name  -> NAMING_ONLY
//   HIGH_CONFIDENCE + ENUM_ALIGNMENT  about a name  -> NAMING_ONLY
//   either, topic unknown                            -> RESEARCH_ONLY
//
// The strength difference survives in evidenceBasis, not in executionScope.
const TOPIC_SCOPE_RULES = deepFreeze({
  HIGH_CONFIDENCE_CROSSCHECK: true,
  HIGH_CONFIDENCE_ENUM_ALIGNMENT: true
});

function resolveScopeForTopic(token, rowScope, topic) {
  // A naming topic caps scope at NAMING_ONLY for every token, including
  // Championship-authored ones. Naming never executes.
  if (NAMING_TOPICS.has(topic)) {
    return rowScope === EXECUTION_SCOPE.PRESENTATION_ONLY ? rowScope : EXECUTION_SCOPE.NAMING_ONLY;
  }
  // M7-0 (Owner s5): MEDIUM_CONFIDENCE caps at NAMING_ONLY for a naming topic
  // (handled above) and at RESEARCH_ONLY otherwise. Applied in
  // resolveScopeForTopic's caller, which knows the level; see capForLevel.

  // M6 (Owner decision 6): a topic that can never execute caps the scope the
  // same way a naming topic does, instead of only tripping the guard later.
  // Without this, a row that grades itself VERIFIED_BINARY could not carry a
  // structural claim at all -- the token says EXECUTABLE, the topic forbids it,
  // and expansion would throw. Capping is strictly conservative: it only ever
  // narrows, never promotes, and constructing EXECUTABLE + a non-executable
  // topic directly still throws in assertEvidenceDescriptorConsistency.
  if (NON_EXECUTABLE_TOPICS.has(topic) && rowScope === EXECUTION_SCOPE.EXECUTABLE) {
    return EXECUTION_SCOPE.RESEARCH_ONLY;
  }
  if (!TOPIC_SCOPE_RULES[token]) return rowScope;
  if (topic === undefined || topic === CLAIM_TOPIC.UNSPECIFIED) return EXECUTION_SCOPE.RESEARCH_ONLY;
  return EXECUTION_SCOPE.RESEARCH_ONLY;
}

// ---------------------------------------------------------------------------
// ruleAuthority <-> sourceAuthority (M2: sourceAuthority is canonical,
// ruleAuthority is a compatibility alias and is NOT removed).
// ---------------------------------------------------------------------------

const RULE_AUTHORITY_TO_SOURCE = deepFreeze({
  VERIFIED_YDIJ_RULE: SOURCE_AUTHORITY.ORIGINAL_CHAMPIONSHIP,
  CHAMPIONSHIP_ADAPTATION: SOURCE_AUTHORITY.CHAMPIONSHIP_ADAPTATION
});

const SOURCE_TO_RULE_AUTHORITY = deepFreeze({
  ORIGINAL_CHAMPIONSHIP: "VERIFIED_YDIJ_RULE",
  CHAMPIONSHIP_ADAPTATION: "CHAMPIONSHIP_ADAPTATION",
  CHAMPIONSHIP_RESEARCH: "CHAMPIONSHIP_ADAPTATION",
  CHAMPIONSHIP_ART_PROPOSAL: "CHAMPIONSHIP_ADAPTATION"
});

export const AMBIGUOUS_LEGACY_AUTHORITY = "AMBIGUOUS_LEGACY_AUTHORITY";

// M4 (Owner decision 1): the reverse alias is lossy. CHAMPIONSHIP_ADAPTATION is the
// legacy spelling of three different canonical authorities, so resolving it
// without context would be a guess. Guessing is forbidden; an unresolvable
// record must produce an explicit migration diagnostic instead.
//
// Only evidenceStatus actually discriminates. claimTopic, aggregateParity and
// originalParityClaim can corroborate a Championship reading but none of them
// separates CHAMPIONSHIP_RESEARCH from CHAMPIONSHIP_ADAPTATION, so they are accepted as
// context but never treated as sufficient on their own.
export function sourceAuthorityFromRuleAuthority(ruleAuthority, context = {}) {
  if (ruleAuthority === "VERIFIED_YDIJ_RULE") return SOURCE_AUTHORITY.ORIGINAL_CHAMPIONSHIP;
  if (ruleAuthority !== "CHAMPIONSHIP_ADAPTATION") {
    throw new Error(`Unknown ruleAuthority: ${String(ruleAuthority)}`);
  }

  const { evidenceStatus } = context;
  if (evidenceStatus === undefined) {
    throw new Error(
      `${AMBIGUOUS_LEGACY_AUTHORITY}: ruleAuthority=CHAMPIONSHIP_ADAPTATION aliases CHAMPIONSHIP_ADAPTATION, `
      + "CHAMPIONSHIP_RESEARCH and CHAMPIONSHIP_ART_PROPOSAL. Supply evidenceStatus to disambiguate."
    );
  }
  const row = LEGACY_MAP[evidenceStatus];
  if (!row) throw new Error(`Unknown legacy evidence token: ${String(evidenceStatus)}`);
  const tokenAuthority = row[0];
  if (!CHAMPIONSHIP_AUTHORITIES.has(tokenAuthority)) {
    throw new Error(`ruleAuthority CHAMPIONSHIP_ADAPTATION contradicts evidenceStatus ${evidenceStatus}`);
  }
  // An art proposal is self-identifying. Otherwise M2.1 stands: ruleAuthority
  // is the authoring field, and CHAMPIONSHIP_RESEARCH_RULE describes the evidence
  // rather than re-authoring the rule.
  return tokenAuthority === SOURCE_AUTHORITY.CHAMPIONSHIP_ART_PROPOSAL
    ? SOURCE_AUTHORITY.CHAMPIONSHIP_ART_PROPOSAL
    : SOURCE_AUTHORITY.CHAMPIONSHIP_ADAPTATION;
}

// Lossy in one direction: CHAMPIONSHIP_RESEARCH and CHAMPIONSHIP_ART_PROPOSAL both collapse
// onto the single legacy CHAMPIONSHIP_ADAPTATION value. Reported as a known lossy
// round-trip rather than hidden.
export function ruleAuthorityFromSourceAuthority(sourceAuthority) {
  const mapped = SOURCE_TO_RULE_AUTHORITY[sourceAuthority];
  if (!mapped) throw new Error(`Unknown sourceAuthority: ${String(sourceAuthority)}`);
  return mapped;
}

export const LOSSY_SOURCE_AUTHORITIES = deepFreeze([
  SOURCE_AUTHORITY.CHAMPIONSHIP_RESEARCH,
  SOURCE_AUTHORITY.CHAMPIONSHIP_ART_PROPOSAL
]);

// M3 (Owner decision 2): a transitional record may carry both fields. When it
// does they must agree, and ruleAuthority's priority applies ONLY to resolving
// a record that has no canonical field. Priority must never be used to paper
// over a genuine conflict.
//
// The check is "does sourceAuthority canonicalize back to this ruleAuthority",
// not string equality — ruleAuthority is lossy, so CHAMPIONSHIP_RESEARCH and
// CHAMPIONSHIP_ADAPTATION both legitimately alias to CHAMPIONSHIP_ADAPTATION.
export function assertAuthoritiesConsistent({ ruleAuthority, sourceAuthority }) {
  if (ruleAuthority === undefined || sourceAuthority === undefined) return true;
  if (!Object.prototype.hasOwnProperty.call(SOURCE_AUTHORITY, sourceAuthority)) {
    throw new TypeError(`Unknown sourceAuthority: ${String(sourceAuthority)}`);
  }
  const alias = ruleAuthorityFromSourceAuthority(sourceAuthority);
  if (alias !== ruleAuthority) {
    throw new Error(
      `authority conflict: ruleAuthority=${ruleAuthority} but sourceAuthority=${sourceAuthority} aliases to ${alias}`
    );
  }
  return true;
}

export function resolveSourceAuthority({ ruleAuthority, sourceAuthority, ...context }) {
  assertAuthoritiesConsistent({ ruleAuthority, sourceAuthority });
  if (sourceAuthority !== undefined) return sourceAuthority;
  if (ruleAuthority !== undefined) return sourceAuthorityFromRuleAuthority(ruleAuthority, context);
  return undefined;
}

export const LEGACY_EVIDENCE_TOKENS = deepFreeze(Object.keys(LEGACY_MAP).sort());

// Tokens that belong to other, already-orthogonal fields. Listed so callers get
// a useful error instead of a silent miss.
const OUT_OF_SCOPE_TOKENS = deepFreeze({
  VERIFIED_YDIJ_RULE: "ruleAuthority",
  CHAMPIONSHIP_2026_PRODUCT: "catalog.authority",
  PROJECT_NATIVE_SHELL: "modeRegistry.authority",
  VERIFIED_FAMILY_PRESENCE_ONLY: "modeRegistry.parityScope",
  RESEARCH_NON_PARITY: "aggregateParity.status",
  VERIFIED_BEHAVIOR: "aggregateParity.status",
  BLOCKED_UNKNOWN: "aggregateParity.status",
  SOURCE_REFERENCE_COORDINATES: "coordinate grading (AGENTS.md 4)"
});

// M7-0 (Owner s1): the registry of descriptors this module actually built and
// validated. A WeakSet keyed on object identity cannot be forged, enumerated or
// serialized: a descriptor that has been through JSON round-tripping is a new
// object and is correctly re-validated. This is deliberately not a boolean
// brand on the object, which any caller could copy.
const VALIDATED_DESCRIPTORS = new WeakSet();

export function createEvidenceDescriptor(input) {
  if (!isPlainRecord(input)) throw new TypeError("EvidenceDescriptor input must be a plain object");

  const unexpected = Object.keys(input).filter((key) => !DESCRIPTOR_KEYS.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`EvidenceDescriptor has unsupported fields: ${unexpected.sort().join(", ")}`);
  }

  const sourceAuthority = assertMember(input.sourceAuthority, SOURCE_AUTHORITY, "sourceAuthority");
  const evidenceLevel = assertMember(input.evidenceLevel, EVIDENCE_LEVEL, "evidenceLevel");
  const evidenceBasis = assertMember(input.evidenceBasis, EVIDENCE_BASIS, "evidenceBasis");
  const traceState = assertMember(input.traceState, TRACE_STATE, "traceState");
  const executionScope = assertMember(input.executionScope, EXECUTION_SCOPE, "executionScope");

  if (typeof input.originalParityClaim !== "boolean") {
    throw new TypeError("EvidenceDescriptor.originalParityClaim must be a boolean");
  }
  const evidenceRefs = input.evidenceRefs === undefined ? [] : input.evidenceRefs;
  if (!Array.isArray(evidenceRefs)) throw new TypeError("EvidenceDescriptor.evidenceRefs must be an array");
  for (const ref of evidenceRefs) {
    if (typeof ref !== "string" || !SAFE_FINDING_ID.test(ref) || ref.includes("/") || ref.includes("\\") || ref.includes("..")) {
      throw new TypeError("EvidenceDescriptor.evidenceRefs entries must be sanitized finding IDs");
    }
  }
  if (input.legacyToken !== undefined && !Object.prototype.hasOwnProperty.call(LEGACY_MAP, input.legacyToken)) {
    throw new TypeError(`EvidenceDescriptor.legacyToken is not a known legacy token: ${String(input.legacyToken)}`);
  }

  const claimTopic = input.claimTopic === undefined
    ? CLAIM_TOPIC.UNSPECIFIED
    : assertMember(input.claimTopic, CLAIM_TOPIC, "claimTopic");
  const requiredTrace = input.requiredTrace === undefined
    ? REQUIRED_TRACE.NONE
    : assertMember(input.requiredTrace, REQUIRED_TRACE, "requiredTrace");

  const descriptor = {
    sourceAuthority,
    evidenceLevel,
    evidenceBasis,
    traceState,
    executionScope,
    originalParityClaim: input.originalParityClaim,
    claimTopic,
    requiredTrace,
    evidenceRefs: Object.freeze([...evidenceRefs])
  };
  if (input.legacyToken !== undefined) descriptor.legacyToken = input.legacyToken;

  assertEvidenceDescriptorConsistency(descriptor);
  const frozen = deepFreeze(descriptor);
  VALIDATED_DESCRIPTORS.add(frozen);
  return frozen;
}

// ---------------------------------------------------------------------------
// Machine guards (Owner decision 8).
// ---------------------------------------------------------------------------

export function assertEvidenceDescriptorConsistency(d) {
  const championshipAuthored = CHAMPIONSHIP_AUTHORITIES.has(d.sourceAuthority);

  // G4: a Championship-authored rule must never claim original parity.
  if (championshipAuthored && d.originalParityClaim === true) {
    throw new Error(`${d.sourceAuthority} must not claim original parity`);
  }
  // Evidence about the original is meaningless for Championship-authored rules.
  if (championshipAuthored && d.evidenceLevel !== EVIDENCE_LEVEL.NOT_APPLICABLE) {
    throw new Error(`${d.sourceAuthority} must use evidenceLevel NOT_APPLICABLE`);
  }
  if (championshipAuthored && d.traceState !== TRACE_STATE.NOT_APPLICABLE) {
    throw new Error(`${d.sourceAuthority} must use traceState NOT_APPLICABLE`);
  }
  // Owner decision 2: an ORIGINAL_CHAMPIONSHIP claim must carry real evidence.
  if (!championshipAuthored && d.evidenceLevel === EVIDENCE_LEVEL.NOT_APPLICABLE) {
    throw new Error("ORIGINAL_CHAMPIONSHIP claims require a concrete evidenceLevel, not NOT_APPLICABLE");
  }
  if (!championshipAuthored && d.traceState === TRACE_STATE.NOT_APPLICABLE) {
    throw new Error("ORIGINAL_CHAMPIONSHIP claims require a concrete traceState, not NOT_APPLICABLE");
  }

  // Owner decision 1: existence of raw bytes/tables/statistics is not runtime
  // behaviour. These topics can never be executed, whatever their evidence.
  if (NON_EXECUTABLE_TOPICS.has(d.claimTopic) && d.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    throw new Error(`claimTopic ${d.claimTopic} can never be EXECUTABLE; raise a separate RUNTIME_MEANING claim instead`);
  }

  // Owner decision A4: a naming claim labels something for humans. It never
  // drives behaviour, and this holds for Championship-authored names too.
  if (NAMING_TOPICS.has(d.claimTopic) && d.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    throw new Error(`naming claim (${d.claimTopic}) can never be EXECUTABLE`);
  }

  // M8 (Owner s1): a semantic name may not borrow a sibling's binary evidence.
  // Enforced here rather than at claim-set level so every construction path is
  // covered, including hand-built descriptors and the promotion pipeline.
  if (d.claimTopic === CLAIM_TOPIC.SEMANTIC_NAME && RUNTIME_CAPABLE_BASES.has(d.evidenceBasis)) {
    throw new Error(
      `a SEMANTIC_NAME cannot rest on ${d.evidenceBasis}; the original's identifiers are stripped, `
      + "so a name carrying binary evidence has taken it from a sibling claim"
    );
  }
  // A runtime trace proves behaviour, not that a raw byte or a shape is what it is.
  if ((d.claimTopic === CLAIM_TOPIC.RAW_VALUE || d.claimTopic === CLAIM_TOPIC.STRUCTURE_SHAPE)
    && d.evidenceBasis === EVIDENCE_BASIS.RUNTIME_TRACE) {
    throw new Error(`a ${d.claimTopic} cannot rest on RUNTIME_TRACE; that is a sibling's behaviour evidence`);
  }

  // M7: a SEMANTIC_NAME is a reconstruction. The original's identifiers are
  // stripped, so there is nothing for a reconstructed name to be at parity
  // *with*. A DISPLAY_NAME or ENUM_NAME read verbatim out of the ROM still can
  // be, which is why this is narrow rather than covering all naming topics.
  if (d.claimTopic === CLAIM_TOPIC.SEMANTIC_NAME && d.originalParityClaim === true) {
    throw new Error("a reconstructed SEMANTIC_NAME cannot claim parity with the original");
  }

  // Claiming to know the runtime meaning requires evidence about the runtime.
  // A derivation or a shape does not qualify, however VERIFIED it is.
  if (RUNTIME_TOPICS.has(d.claimTopic) && !EXECUTABLE_BASES.has(d.evidenceBasis)) {
    throw new Error(`${d.claimTopic} requires runtime-capable evidence, not ${d.evidenceBasis}`);
  }

  // M7-0 (Owner s5): a medium-confidence finding may never drive behaviour.
  if (d.evidenceLevel === EVIDENCE_LEVEL.MEDIUM_CONFIDENCE && d.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    throw new Error("MEDIUM_CONFIDENCE evidence cannot be EXECUTABLE");
  }

  // G2: UNKNOWN may never be executable.
  if (d.evidenceLevel === EVIDENCE_LEVEL.UNKNOWN && d.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    throw new Error("UNKNOWN evidence cannot be EXECUTABLE");
  }
  // G1: a name inferred from enum ordering may never drive behavior.
  if (d.evidenceBasis === EVIDENCE_BASIS.ENUM_ALIGNMENT && d.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    throw new Error("ENUM_ALIGNMENT evidence cannot be EXECUTABLE");
  }
  // Art proposals never reach gameplay.
  if (d.sourceAuthority === SOURCE_AUTHORITY.CHAMPIONSHIP_ART_PROPOSAL
    && d.executionScope !== EXECUTION_SCOPE.PRESENTATION_ONLY) {
    throw new Error("CHAMPIONSHIP_ART_PROPOSAL must be PRESENTATION_ONLY");
  }

  // An executable original-parity claim needs real, referenced evidence.
  if (!championshipAuthored && d.executionScope === EXECUTION_SCOPE.EXECUTABLE) {
    if (d.evidenceLevel !== EVIDENCE_LEVEL.VERIFIED) {
      throw new Error("EXECUTABLE original claims require evidenceLevel VERIFIED");
    }
    if (d.traceState !== TRACE_STATE.VERIFIED) {
      throw new Error("EXECUTABLE original claims require traceState VERIFIED");
    }
    if (!EXECUTABLE_BASES.has(d.evidenceBasis)) {
      throw new Error(`EXECUTABLE original claims cannot rest on basis ${d.evidenceBasis}`);
    }
    if (d.originalParityClaim !== true) {
      throw new Error("EXECUTABLE original claims must declare originalParityClaim");
    }
  }
  if (!championshipAuthored && d.originalParityClaim === true && d.evidenceLevel !== EVIDENCE_LEVEL.VERIFIED) {
    throw new Error("originalParityClaim requires VERIFIED evidence");
  }
  return true;
}

export function isExecutable(descriptor) {
  return descriptor.executionScope === EXECUTION_SCOPE.EXECUTABLE;
}

export function isGameplayConsumable(descriptor) {
  return descriptor.executionScope === EXECUTION_SCOPE.EXECUTABLE;
}

// G3 support: naming-only claims must never be branched on.
export function assertNotBranchedOn(claim, siteLabel) {
  if (claim?.evidence?.executionScope === EXECUTION_SCOPE.NAMING_ONLY) {
    throw new Error(`NAMING_ONLY claim consumed by gameplay branch at ${String(siteLabel)}`);
  }
  if (claim?.evidence?.executionScope === EXECUTION_SCOPE.BLOCKED) {
    throw new Error(`BLOCKED claim consumed at ${String(siteLabel)}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Legacy bridge (permanent, Owner decision 9).
// ---------------------------------------------------------------------------

export function expandLegacyEvidenceStatus(legacyStatus, options = {}) {
  if (typeof legacyStatus !== "string") throw new TypeError("legacyStatus must be a string");
  if (Object.prototype.hasOwnProperty.call(OUT_OF_SCOPE_TOKENS, legacyStatus)) {
    throw new Error(`${legacyStatus} belongs to ${OUT_OF_SCOPE_TOKENS[legacyStatus]}, not evidenceStatus`);
  }
  const row = LEGACY_MAP[legacyStatus];
  if (!row) throw new Error(`Unknown legacy evidence token: ${legacyStatus}`);
  const [sourceAuthority, evidenceLevel, evidenceBasis, traceState, rowScope, originalParityClaim, rowTopic, requiredTrace] = row;

  // Context-aware: an explicit claimTopic may refine executionScope. It can
  // never widen it to EXECUTABLE — only NAMING_ONLY or RESEARCH_ONLY.
  const claimTopic = options.claimTopic === undefined ? rowTopic : options.claimTopic;
  // With no explicit topic the token's own row is already self-consistent, so
  // it is used as-is. Capping only applies when the caller states what the
  // claim is about -- otherwise UNKNOWN_SEMANTIC would drift from the
  // conservative RESEARCH_ONLY down to NAMING_ONLY.
  const executionScope = options.claimTopic === undefined && !TOPIC_SCOPE_RULES[legacyStatus]
    ? rowScope
    : resolveScopeForTopic(legacyStatus, rowScope, claimTopic);

  // M2.1 (Owner decision 1): sourceAuthority must faithfully reflect the legacy
  // ruleAuthority when one is supplied. evidenceStatus describes the strength
  // and kind of evidence; it must not silently re-author the rule. So
  // ruleAuthority=CHAMPIONSHIP_ADAPTATION + evidenceStatus=CHAMPIONSHIP_RESEARCH_RULE yields
  // sourceAuthority=CHAMPIONSHIP_ADAPTATION with executionScope=RESEARCH_ONLY.
  // M3: a record may supply ruleAuthority, sourceAuthority, both, or neither.
  // Both present must agree (assertAuthoritiesConsistent); ruleAuthority's
  // priority applies only when the canonical field is absent.
  let resolvedAuthority = sourceAuthority;
  const declared = resolveSourceAuthority({
    ruleAuthority: options.ruleAuthority,
    sourceAuthority: options.sourceAuthority,
    evidenceStatus: legacyStatus,
    claimTopic: options.claimTopic,
    aggregateParity: options.aggregateParity,
    originalParityClaim: options.originalParityClaim
  });
  if (declared !== undefined) {
    // Whatever the record declares, it may never cross the original/Championship
    // divide implied by the evidenceStatus itself.
    if (CHAMPIONSHIP_AUTHORITIES.has(sourceAuthority) !== CHAMPIONSHIP_AUTHORITIES.has(declared)) {
      const named = options.sourceAuthority ?? options.ruleAuthority;
      throw new Error(`authority ${named} contradicts evidenceStatus ${legacyStatus}`);
    }
    resolvedAuthority = declared;
  }

  // A naming topic caps scope (above) and, for a reconstruction, also drops the
  // parity assertion: the token's parity flag describes the underlying finding,
  // not the human label placed on it.
  const parity = claimTopic === CLAIM_TOPIC.SEMANTIC_NAME ? false : originalParityClaim;

  return createEvidenceDescriptor({
    sourceAuthority: resolvedAuthority,
    evidenceLevel,
    evidenceBasis,
    traceState,
    executionScope,
    originalParityClaim: parity,
    claimTopic,
    requiredTrace,
    evidenceRefs: options.evidenceRefs ?? [],
    legacyToken: legacyStatus
  });
}

// Exact inverse. Several legacy tokens collapse onto the same six-field tuple
// (VERIFIED_BINARY_RAW and VERIFIED_BINARY_NEGATIVE_FINDING, for example), so
// the originating token is carried as provenance rather than re-derived.
export function deriveLegacyEvidenceStatus(descriptor) {
  if (!isPlainRecord(descriptor)) throw new TypeError("descriptor must be a plain object");
  if (typeof descriptor.legacyToken === "string") return descriptor.legacyToken;

  const topic = descriptor.claimTopic ?? CLAIM_TOPIC.UNSPECIFIED;
  const requiredTrace = descriptor.requiredTrace ?? REQUIRED_TRACE.NONE;

  for (const [token, row] of Object.entries(LEGACY_MAP)) {
    const invariantMatch = row[0] === descriptor.sourceAuthority
      && row[1] === descriptor.evidenceLevel
      && row[2] === descriptor.evidenceBasis
      && row[3] === descriptor.traceState
      && row[5] === descriptor.originalParityClaim
      && row[7] === requiredTrace;
    if (!invariantMatch) continue;

    // Tokens whose scope/topic are context-derived match on the invariant
    // fields only; the rest must match exactly.
    if (TOPIC_SCOPE_RULES[token]) return token;
    if (row[4] === descriptor.executionScope && row[6] === topic) return token;
  }
  throw new Error("Descriptor has no legacy representation; keep it on the canonical fields");
}

// ---------------------------------------------------------------------------
// Claim-level granularity (Owner decision 2).
//
// One record may assert several independent facts, each with its own evidence.
// ---------------------------------------------------------------------------

export function createEvidenceClaim({ value, evidence }) {
  if (evidence === undefined) throw new TypeError("Evidence claim requires an evidence descriptor");
  // M7-0 (Owner s1). The previous fast path trusted any frozen object carrying a
  // `sourceAuthority` field, so a hand-built literal with all the right keys
  // skipped every guard. Shape is not provenance. Only a descriptor this module
  // actually produced is trusted, and that fact is held in a module-private
  // WeakSet no caller can reach or forge. Anything else is re-validated, which
  // costs nothing when it is already legal.
  const descriptor = VALIDATED_DESCRIPTORS.has(evidence)
    ? evidence
    : createEvidenceDescriptor(evidence);
  return deepFreeze({ value, evidence: descriptor });
}

export function createClaimSet(claims) {
  if (!isPlainRecord(claims)) throw new TypeError("Claim set must be a plain object");
  const out = {};
  for (const [name, claim] of Object.entries(claims)) {
    if (!isPlainRecord(claim) || !("value" in claim) || !("evidence" in claim)) {
      throw new TypeError(`Claim "${name}" must be { value, evidence }`);
    }
    out[name] = createEvidenceClaim(claim);
  }
  return deepFreeze(out);
}

// M8 (Owner s1): "data proven != semantic name proven" is still enforced, but
// not by a set-level pass that nothing can reach. Once M7-0 closed the
// descriptor trust boundary, every claim entering a set was already validated
// individually, so the old assertNoCrossClaimPromotion could not fire -- dead
// security code. Owner does not accept that.
//
// The enforcement moved to where a promotion can actually be written: the
// evidence descriptor itself. Every boundary that can create one -- the mapping
// registry, generator claim construction, cross-pack merge, the promotion
// pipeline -- goes through createEvidenceDescriptor, so all of them are covered
// by these two rules, which live in assertEvidenceDescriptorConsistency:
//
//   a SEMANTIC_NAME may not rest on BINARY or RUNTIME_TRACE
//     The original's identifiers are stripped. A name cannot be read out of the
//     binary, so a name carrying a binary basis has borrowed it from a sibling.
//
//   a RAW_VALUE or STRUCTURE_SHAPE may not rest on RUNTIME_TRACE
//     A runtime trace proves what the code does, not that a byte is a byte.
//
// Verified against every claim generated so far: naming claims use CROSSCHECK,
// ENUM_ALIGNMENT or TEXT_ALIGNMENT and never a runtime-capable basis.

export const EVIDENCE_TAXONOMY_VERSION = "m1";
