// Bounded contact profiles for reviewed original deliveries only.
// New 2026-10-15 profiles require the validated delivery folder/source bank
// as well as native packing geometry. Atlas hashes and measured bands are in the
// character-contact-2026-10-15 receipt. No whole-species flight trait is inferred.
// These are presentation measurements, not collision or selection bounds.
// No footprint is inferred from a species number, sprite canvas, wings or tail.
const profiles = {
  'species-023': {
    entityId: 'm104_tunomon',
    folder: 'm104_tunomon-early64-raw-v2-r01',
    sourceBankSha256: '665c888f35c0520c976180087991c5713e46b4f7eef4a231992bd86a395557c2',
    sourceSize: [256, 256], origin: [88, 136], scale: 4,
    groundBottom: [136, 136, 135], padding: [2, 1],
    soles: {
      0: [[71,132,82,136], [82,132,98,136], [98,132,113,135]],
      1: [[69,132,80,136], [79,132,94,137], [95,132,111,136]],
      4: [[75,133,91,136], [103,131,115,134]]
      // cell 5 has all feet above the rest plane; retain the landing footprint.
    }
  },
  'species-013': {
    entityId: 'm006_punimon',
    folder: 'm006_punimon-early64-raw-v2-r01',
    sourceBankSha256: 'b4a30d79d84bb3b1a9a3d7a0cfd1cb7ea23227722d32c56bbf93b873a7983787',
    sourceSize: [256, 256], origin: [96, 152], scale: 4,
    groundBottom: [152], padding: [2, 1],
    soles: {
      0: [[85,148,106,152]], 1: [[83,148,108,152]],
      4: [[85,148,106,152]], 5: [[81,148,95,152]]
    },
    // A reviewed flattened body-support band, not a sleep/down/flight alias.
    poseContacts: { '13:23': { soles: [[75,150,109,153]], groundBottom: [153] } }
  },
  'species-036': {
    entityId: 'm203_elecmon',
    folder: 'm203_elecmon-final-growth38-20261007',
    sourceBankSha256: 'ea39060f0570245b72161ec7a5d4ec3745043125cdbb5f2262f02908910f1b8c',
    sourceSize: [256, 256], origin: [108, 152], scale: 4,
    groundBottom: [151, 152, 149, 151], padding: [2, 1],
    soles: {
      0: [[68,147,80,151], [92,149,108,153], [112,145,125,149], [141,147,154,151]],
      1: [[67,147,82,151], [94,149,110,152], [116,145,129,149], [141,147,155,151]],
      4: [[59,151,68,156], [94,151,105,155], [103,148,121,155], [139,150,148,155]],
      5: [[77,150,92,153], [102,152,118,155], [124,148,137,152], [153,146,166,151]]
    }
  },
  'species-218': {
    sourceSize: [768, 768], origin: [384, 512], scale: 4,
    groundBottom: [518, 523],
    soles: {
      0: [[266, 510, 325, 518], [429, 515, 491, 523]],
      1: [[274, 510, 334, 518], [436, 515, 500, 523]],
      4: [[266, 510, 325, 518], [429, 515, 491, 523]],
      5: [[261, 503, 300, 511], [451, 515, 532, 523]]
    }
  },
  'species-034': {
    sourceSize: [256, 256], origin: [112, 164], scale: 4,
    groundBottom: [166, 168],
    soles: {
      0: [[89, 162, 107, 166], [117, 164, 133, 168]],
      1: [[88, 162, 107, 166], [116, 164, 133, 168]],
      4: [[89, 162, 107, 166], [117, 164, 133, 168]],
      5: [[86, 162, 104, 166], [116, 165, 132, 169]]
    }
  }
};

// Derived once: same measured r04 soles in density8 raster coordinates.
const m201Density8Base = profiles['species-034'];
const doubledFrozen = values => Object.freeze(values.map(n => n * 2));
const m201Density8Profile = Object.freeze({
  ...m201Density8Base, scale: 8,
  sourceSize: doubledFrozen(m201Density8Base.sourceSize),
  origin: doubledFrozen(m201Density8Base.origin),
  groundBottom: doubledFrozen(m201Density8Base.groundBottom),
  groundInset: (m201Density8Base.groundInset ?? 1) * 2,
  padding: doubledFrozen(m201Density8Base.padding ?? [4, 4]),
  soles: Object.freeze(Object.fromEntries(Object.entries(m201Density8Base.soles)
    .map(([cell, soles]) => [cell, Object.freeze(soles.map(doubledFrozen))])))
});

/** Cancel only the actor container's lift and vertical mirror. Keep authored
 * body origins/pose displacement intact, including naturally airborne poses.
 * The fallback footprint needs the same ground plane as measured footprints.
 */
export function huntShadowGroundTransform(frame, worldZ = 0) {
  const height = Number.isFinite(worldZ) ? worldZ : 0;
  const sign = frame?.flipY ? -1 : 1;
  return { localY: height * sign, scaleY: sign };
}

export function huntContactShadow(speciesId, frame, worldZ = 0, art = null) {
  const geometry = frame?.geometry;
  // Old density4 stays unchanged; exact delivery identity gates this one variant.
  const same034Density8 = speciesId === 'species-034' && geometry?.scale === 8
    && art?.side === 'main' && art.entityId === 'm201_agumon'
    && art.folder === 'm201_agumon-r04-density8-07a10bca9765903c'
    && art.sourceBankSha256 === '700ad661bad1b125ae4ee1ffcb4ccf3dd745546aa26bf1ce5168cf475c355e74';
  const profile = same034Density8 ? m201Density8Profile : profiles[speciesId];
  if (!profile || !geometry || geometry.blank || geometry.scale !== profile.scale
    || !profile.sourceSize.every((value, i) => geometry.sourceSize?.[i] === value)
    || !profile.origin.every((value, i) => geometry.origin?.[i] === value)) return null;
  if (profile.sourceBankSha256 && (art?.side !== 'main' || art.entityId !== profile.entityId || art.folder !== profile.folder
    || art.sourceBankSha256 !== profile.sourceBankSha256)) return null;
  const factor = 2 / geometry.scale; // existing Hunt world units per packed pixel
  const height = Number.isFinite(worldZ) ? worldZ : 0;
  // A lifted pose keeps the landing stance on the ground. Its alpha trim is
  // not a new foot origin; measured walking soles only adjust the X footprint.
  const soles = height === 0 && [0, 2].includes(frame.sequenceId)
    ? profile.soles[frame.cell] ?? profile.soles[0] : profile.soles[0];
  const pose = height === 0 ? profile.poseContacts?.[`${frame.sequenceId}:${frame.cell}`] : null;
  const groundBottom = pose?.groundBottom ?? profile.groundBottom;
  const [paddingX, paddingY] = profile.padding ?? [4, 4];
  return {
    ...huntShadowGroundTransform(frame, height),
    ellipses: (pose?.soles ?? soles).map(([left, top, right, bottom], i) => ({
      x: ((left + right) / 2 - geometry.origin[0]) * factor,
      y: (groundBottom[i] - (profile.groundInset ?? 1) - geometry.origin[1]) * factor,
      radiusX: ((right - left) / 2 + paddingX) * factor,
      radiusY: ((bottom - top) / 2 + paddingY) * factor
    }))
  };
}
