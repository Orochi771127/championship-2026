// Build-time exclusion shared by the Pages builder and its validation.
// It is not a game asset loader or an additional rights authority.
export function isPrivateRepositoryPath(file) {
  return /^(?:assets\/production\/(?:internal-character-review|internal-faithful-baseline|hunt\/hm234-day-review-20261007|hunt\/industrial-review-r1|hunt\/cave-clearance-(?:review-r1|natural-r7|natural-r8|natural-r10|natural-r11)|battle\/(?:bm07-quiet-review-r1|bm03-volcano-review-r2|stage-review-20261007)|vfx\/(?:original-battle-2d-v1|original-rom-conversion-v1|original-shared-review-v1|original-shared-beam-seamfix-r1|original-shared-review-157-seamfix-r1|original-shared-review-210-seamfix-r1))\/|src\/championship\/battle\/battleCatalogs\.js$|src\/data\/championship\/catalogs\/battle-[^/]+\.json$)/i.test(file.replaceAll('\\', '/'));
}

// The production index remains the sole asset authority. An omitted approval
// is not permission; a local/reference flag independently vetoes publication.
export function isShippingArtEntry(entry) {
  return Boolean(entry && typeof entry.manifestPath === 'string'
    && entry.manifestPath.startsWith('assets/production/')
    && !entry.manifestPath.split('/').includes('..')
    && !isPrivateRepositoryPath(entry.manifestPath)
    && entry.localOnly !== true && entry.publicReleasePermitted === true
    && entry.runtimeEligible === true && entry.humanApproved === true
    && entry.runtimeQaPassed === true && entry.shippingReady === true
    && ['OWNER_OWNED','ORIGINAL_CREATED','ORIGINAL_CREATED_AI_ASSISTED','LICENSED'].includes(entry.rightsStatus));
}

export function publicArtIndex(source) {
  const index = structuredClone(source);
  index.entries = index.entries.filter(isShippingArtEntry);
  index.summary.registeredRuntimeBundles = index.entries.length;
  index.summary.shippingReadyBundles = index.entries.filter(entry => entry.shippingReady === true).length;
  return index;
}
