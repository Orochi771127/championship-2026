import { huntContactShadow } from '../vs2/huntContactShadow.js';

// Reuse only the three delivery-identity-guarded, pixel-reviewed contacts.
// Raising uses one native unit where Hunt uses two. Its root stays on the
// ground and only its body is lifted/mirrored; do not apply Hunt's root offset.
// Unknown bodies and eggs retain their existing presentation, not guessed feet.
const REVIEWED_SPECIES = new Set(['species-023', 'species-013', 'species-036']);
export function getReviewedRaisingContactShadow(speciesId, frame, art, lift = 0, flipX = false) {
  const id = speciesId?.replace(/^championship:creature:/, '');
  if (!REVIEWED_SPECIES.has(id)) return null;
  const contact = huntContactShadow(id, frame, lift, art);
  if (!contact) return null;
  return contact.ellipses.map(({ x, y, radiusX, radiusY }) => ({
    x: x / 2 * (flipX ? -1 : 1), y: y / 2,
    radiusX: radiusX / 2, radiusY: radiusY / 2
  }));
}
