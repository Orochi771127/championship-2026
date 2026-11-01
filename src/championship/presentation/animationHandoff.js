// QA switch for owner-accepted animation handoff scopes (Owner 2026-11-01). The art is
// still arriving in batches, so each accepted role/action/direction is integrated as an
// alternative manifest beside the current reviewed one, listed in a loopback-only QA
// registry that is not a build input and never ships. Off by default: only a loopback
// page opened with ?animHandoff=1 loads it; nothing is stored, so dropping the parameter
// rolls back. Public hosts always load the current selection.
import {isOriginalLoopbackLocation} from './originalRuntimeLocation.js';

export const ANIMATION_HANDOFF_REGISTRY = 'src/data/championship/animation-handoff.qa-20261101.json';
export function animationHandoffEnabled(href = globalThis.location?.href) {
  if (!href || !isOriginalLoopbackLocation(href)) return false;
  try { return new URL(href).searchParams.get('animHandoff') === '1'; } catch { return false; }
}
let registry = null;
function loadRegistry(href, fetchImpl) {
  registry ??= (async () => {
    const response = await fetchImpl(new URL(ANIMATION_HANDOFF_REGISTRY, href).href);
    if (!response.ok) return [];
    const doc = await response.json();
    return doc?.kind === 'ANIMATION_HANDOFF_QA_REGISTRY' && Array.isArray(doc.entries) ? doc.entries : [];
  })().catch(() => []);
  return registry;
}
// The manifest a reviewed entry loads here: its handoff alternative when the switch is on
// and the alternative was built on this exact current manifest; otherwise the current one.
export async function reviewedDocumentRef(entry, href = globalThis.location?.href, fetchImpl = (...a) => globalThis.fetch(...a)) {
  const current = {path: entry?.path, sha256: entry?.sha256, handoff: false};
  if (!entry || !animationHandoffEnabled(href)) return current;
  const alt = (await loadRegistry(href, fetchImpl)).find(e => e.speciesId === entry.speciesId && e.basePath === entry.path && e.baseSha256 === entry.sha256);
  return alt?.path && alt?.sha256 ? {path: alt.path, sha256: alt.sha256, handoff: true, scopes: alt.scopes ?? []} : current;
}
export function resetAnimationHandoffRegistry() { registry = null; }
