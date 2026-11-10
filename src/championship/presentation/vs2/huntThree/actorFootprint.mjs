// Where a Hunt partner stands on the 3D ground (Owner 2026-11-10, HUNT_GROUNDING_20261110).
//
// The Owner found partners did not look like they stood on the floor. Measured in the browser, the
// drawn feet already sit on the native foot point (within 1 native px), so the drawing is not lifted.
// What gave the floating look was the ground layers under it: one fixed 11x4 ellipse and every aura
// centred on the foot point. On a tilted ground the lowest drawn pixel is the NEAREST foot, so the body
// stands mostly BEHIND it; a ring or shadow centred on that pixel lies half in front of the partner.
//
// This is the ranch rule (raisingFootprintShadow.js, shadow audit 2026-10-30, 2,898 frames) at the Hunt
// map's own pitch: the species' measured lower-body centre and width per sequence, an ellipse whose
// depth is that of a ground circle seen at this elevation, with only `front` of it ahead of the feet.
// Presentation only: the native position, collision and selection are unchanged.
import {RAISING_FOOTPRINT, raisingFootprintRow} from '../../intRh2/raisingFootprintShadow.js';
import {RANCH_DEFAULT_VIEW_PITCH} from '../../ranchThreeCoordinates.js';

const GROUND_DEPTH = RAISING_FOOTPRINT.ratio / Math.sin(RANCH_DEFAULT_VIEW_PITCH * Math.PI / 180);
// The ranch shows 40 % of the ellipse ahead of the feet. The Hunt camera is farther out and its
// partners are smaller on screen, so 40 % hid nearly all of it under the body; 60 % ahead keeps the
// dark core just behind the feet and a visible shadow round them.
export const HUNT_FOOTPRINT_FRONT = 0.6;
const WORLD_PER_NATIVE = 2;

/**
 * `quad` is the drawn frame in actor-local Hunt world units (ground at y = 0), possibly mirrored
 * (x1 < x0) for a partner facing the other way. `elevationSin` is sin(map elevation).
 * Returns the footprint ellipse in the same local units, or null without a drawing.
 */
export function huntActorFootprint({speciesId, sequenceId, quad, elevationSin, worldZ = 0}) {
  if (!Array.isArray(quad) || quad.length !== 4) return null;
  const xs = quad.map(p => p[0]), ys = quad.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const width = right - left, height = bottom - top;
  if (![width, height, elevationSin].every(Number.isFinite) || width <= 0 || height <= 0 || !(elevationSin > 0)) return null;
  const facing = Math.sign(quad[2][0] - quad[0][0]) || 1;
  const [offset, lower] = raisingFootprintRow(speciesId, sequenceId);
  // A lifted pose (drawn above the ground, or a hop) keeps its shadow on the ground, smaller and lighter.
  const lift = Math.max(0, -bottom) + Math.max(0, Number.isFinite(worldZ) ? worldZ : 0);
  const hover = 1 / (1 + lift / height);
  const radiusX = Math.min(Math.max(lower / 2, 0.25), 0.46) * width * hover;
  const radiusY = Math.max(Math.min(radiusX * elevationSin * GROUND_DEPTH, height * RAISING_FOOTPRINT.depthPerHeight),
    RAISING_FOOTPRINT.minDepth * WORLD_PER_NATIVE);
  return {
    x: (left + right) / 2 + offset * width * facing,
    y: Math.max(bottom, 0) - (1 - HUNT_FOOTPRINT_FRONT) * radiusY,
    radiusX, radiusY, alpha: hover, bodyWidth: width
  };
}
