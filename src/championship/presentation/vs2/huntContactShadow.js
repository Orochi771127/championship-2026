// Bounded contact profiles for the two reviewed aaf672cc original deliveries.
// Packed sole bands were inspected in idle cells 0/1 and walk cells 4/5.
// These are presentation measurements, not collision or selection bounds.
// No footprint is inferred from a species number, sprite canvas, wings or tail.
const profiles = {
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

export function huntContactShadow(speciesId, frame, worldZ = 0) {
  const profile = profiles[speciesId], geometry = frame?.geometry;
  if (!profile || !geometry || geometry.blank || geometry.scale !== profile.scale
    || !profile.sourceSize.every((value, i) => geometry.sourceSize?.[i] === value)
    || !profile.origin.every((value, i) => geometry.origin?.[i] === value)) return null;
  const factor = 2 / geometry.scale; // existing Hunt world units per packed pixel
  const height = Number.isFinite(worldZ) ? worldZ : 0;
  // A lifted pose keeps the landing stance on the ground. Its alpha trim is
  // not a new foot origin; measured walking soles only adjust the X footprint.
  const soles = height === 0 && [0, 2].includes(frame.sequenceId)
    ? profile.soles[frame.cell] ?? profile.soles[0] : profile.soles[0];
  return {
    localY: height * (frame.flipY ? -1 : 1),
    scaleY: frame.flipY ? -1 : 1,
    ellipses: soles.map(([left, top, right, bottom], i) => ({
      x: ((left + right) / 2 - geometry.origin[0]) * factor,
      y: (profile.groundBottom[i] - 1 - geometry.origin[1]) * factor,
      radiusX: ((right - left) / 2 + 4) * factor,
      radiusY: ((bottom - top) / 2 + 4) * factor
    }))
  };
}
