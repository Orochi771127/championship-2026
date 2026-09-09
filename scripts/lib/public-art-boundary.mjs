// Build-time exclusion shared by the Pages builder and its validation.
// It is not a game asset loader or an additional rights authority.
export function isPrivateRepositoryPath(file) {
  return /^(?:assets\/production\/(?:internal-character-review|internal-faithful-baseline|vfx\/(?:original-battle-2d-v1|original-rom-conversion-v1))\/|src\/championship\/battle\/battleCatalogs\.js$|src\/data\/championship\/catalogs\/battle-[^/]+\.json$)/i.test(file.replaceAll('\\', '/'));
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
