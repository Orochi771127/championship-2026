// Cage walkability for redesigned review cages — OWNER_APPROVED_ADAPTATION
// (Owner 2026-10-19: every map's walkable range must match its art). Only the
// loopback cage review applies it (main.js); otherwise every cage keeps the
// original raising-ground fields. Same cell format and clearance rule.
export const RAISING_GROUND_REVIEW_ADAPTATION = "OWNER_APPROVED_CAGE_WALKABILITY_REVIEW_20261019";
let review = null;

export function parseRaisingGroundField(field) {
  const cells = field.runs.flatMap(([count, ...v]) => Array.from({ length: count }, () => v));
  const clearance = field.clearanceRuns.flatMap(([count, v]) => Array(count).fill(v));
  if (cells.length !== field.width * field.height || clearance.length !== cells.length) throw new Error("INVALID_RAISING_GROUND_SOURCE");
  return { ...field, cells, clearance };
}

export function applyRaisingGroundReview(doc) {
  if (doc?.adaptation !== RAISING_GROUND_REVIEW_ADAPTATION || !Array.isArray(doc.fields)) throw Error("RAISING_GROUND_REVIEW_INVALID");
  review = new Map(doc.fields.map(f => [f.definitionIndex, parseRaisingGroundField(f)]));
}
export function clearRaisingGroundReview() { review = null; }
export function reviewGroundField(definitionIndex) { return review?.get(definitionIndex) ?? null; }
