// HD-2D actor shadows (Owner 2026-11-03): two layers under every Hunt partner.
// 1. A soft contact shadow: one feathered ellipse, darkest under the feet.
// 2. A cast silhouette: the partner's own current frame laid on the ground
//    along the map's sun, so it moves with every drawing the partner shows.
// Presentation only. The native footprint ellipses and frame stay the inputs.

// Wild instinct glow (Owner 2026-11-10: 「這樣就很好……不要太花俏」): a special partner's contact shadow is
// drawn in its tier's colour instead of black, the same feathered footprint, nothing else.
export const HUNT_INSTINCT_GLOW = Object.freeze({
  ELITE: Object.freeze({color: 0xff2a10, opacity: 0.9}),
  ANCESTOR: Object.freeze({color: 0x9a5cff, opacity: 0.9})
});

export const HUNT_ACTOR_SHADOW = Object.freeze({
  contactOpacity: 0.45, contactFeather: 1.3, segments: 24, midRing: 0.55, midAlpha: 0.75,
  // A small dark core hugging the feet (HUNT_GROUNDING_20261110): the soft ellipse stays light, this
  // is where paw meets floor. Fraction of the footprint, and its own opacity on top of the ellipse.
  coreOpacity: 0.32, coreScaleX: 0.7, coreScaleY: 0.42,
  castColor: 0x120e1a, castOpacity: 0.30, castNightOpacity: 0.16, castMaxReach: 1.1
});

/** One ellipse around every measured sole, widened so its edge can fade out. */
export function huntContactEnvelope(ellipses, scale = 1) {
  if (!Array.isArray(ellipses) || !ellipses.length) return null;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const e of ellipses) {
    if (![e?.x, e?.y, e?.radiusX, e?.radiusY].every(Number.isFinite)) return null;
    left = Math.min(left, e.x - e.radiusX); right = Math.max(right, e.x + e.radiusX);
    top = Math.min(top, e.y - e.radiusY); bottom = Math.max(bottom, e.y + e.radiusY);
  }
  const s = (Number.isFinite(scale) && scale > 0 ? scale : 1) * HUNT_ACTOR_SHADOW.contactFeather;
  return { x: (left + right) / 2, y: (top + bottom) / 2, radiusX: (right - left) / 2 * s, radiusY: (bottom - top) / 2 * s };
}

/** Triangles of the feathered ellipse: centre alpha 1, a mid ring, a clear rim.
 * `toGround(x, y)` maps a shadow-local point to a 3D ground point. */
export function huntSoftContactVertices(envelope, toGround) {
  const { segments, midRing, midAlpha } = HUNT_ACTOR_SHADOW;
  const positions = [], colors = [];
  const at = (k, i) => {
    const t = i * Math.PI * 2 / segments;
    return toGround(envelope.x + Math.cos(t) * envelope.radiusX * k, envelope.y + Math.sin(t) * envelope.radiusY * k);
  };
  const push = (point, alpha) => { positions.push(...point); colors.push(1, 1, 1, alpha); };
  const centre = toGround(envelope.x, envelope.y);
  for (let i = 0; i < segments; i++) {
    const m0 = at(midRing, i), m1 = at(midRing, i + 1), r0 = at(1, i), r1 = at(1, i + 1);
    push(centre, 1); push(m0, midAlpha); push(m1, midAlpha);
    push(m0, midAlpha); push(r0, 0); push(r1, 0);
    push(m0, midAlpha); push(r1, 0); push(m1, midAlpha);
  }
  return { positions, colors };
}

/** Ground offset per unit of height for light travelling from `sun` to its
 * target. Clamped so a low sun cannot stretch a partner across the map. */
export function huntCastShadowReach(sun) {
  const from = sun?.position, to = sun?.target?.position ?? { x: 0, y: 0, z: 0 };
  const lx = (from?.x ?? 0) - to.x, ly = (from?.y ?? 0) - to.y, lz = (from?.z ?? 0) - to.z;
  if (![lx, ly, lz].every(Number.isFinite) || ly <= 1e-6) return [0, 0];
  let ox = -lx / ly, oz = -lz / ly;
  const length = Math.hypot(ox, oz), max = HUNT_ACTOR_SHADOW.castMaxReach;
  if (length > max) { ox *= max / length; oz *= max / length; }
  return [ox, oz];
}

/** Lay billboard vertices on the ground. A partner is a flat card facing the
 * camera, so its true shadow is a sliver whenever the sun shines along the
 * card. Like HD-2D casters, the card turns to face the light for its shadow:
 * its width runs across the light and each point slides along the light by
 * its own height above the support plane. `base` is the foot on the ground. */
export function huntCastShadowVertices(points, base, groundHeight, reach) {
  let rx = points[2][0] - points[1][0], rz = points[2][2] - points[1][2];
  const width = Math.hypot(rx, rz);
  if (width > 1e-9) { rx /= width; rz /= width; } else { rx = 1; rz = 0; }
  const length = Math.hypot(reach[0], reach[1]);
  let px = rx, pz = rz;
  if (length > 1e-6) {
    px = -reach[1] / length; pz = reach[0] / length;
    if (px * rx + pz * rz < 0) { px = -px; pz = -pz; }
  }
  return points.flatMap(([x, y, z]) => {
    const height = Math.max(0, y - groundHeight);
    const across = (x - base[0]) * rx + (z - base[2]) * rz;
    return [base[0] + px * across + height * reach[0], groundHeight + 0.0002, base[2] + pz * across + height * reach[1]];
  });
}

/** The cast silhouette: one flat colour, the frame's own alpha softened with a
 * small blur and fading toward the head end. */
export function createHuntCastShadowMaterial(THREE) {
  const material = new THREE.MeshBasicMaterial({ color: HUNT_ACTOR_SHADOW.castColor, transparent: true,
    opacity: HUNT_ACTOR_SHADOW.castOpacity, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec2 huntTexel = 1.5 / vec2(textureSize(map, 0));
  float huntAlpha = texture2D(map, vMapUv).a * 0.4
    + texture2D(map, vMapUv + vec2(huntTexel.x, 0.0)).a * 0.15
    + texture2D(map, vMapUv - vec2(huntTexel.x, 0.0)).a * 0.15
    + texture2D(map, vMapUv + vec2(0.0, huntTexel.y)).a * 0.15
    + texture2D(map, vMapUv - vec2(0.0, huntTexel.y)).a * 0.15;
  diffuseColor.a *= huntAlpha * (1.0 - 0.55 * clamp(vMapUv.y, 0.0, 1.0));
#endif`);
  };
  material.customProgramCacheKey = () => 'hunt-cast-shadow-v1';
  return material;
}
