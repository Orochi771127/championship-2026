const ENTITY = "m201_agumon";
const SIDES = ["main", "sub"];
const SHA256 = /^[0-9a-f]{64}$/i;

function requireGeometry(condition, reason) {
  if (!condition) throw new Error(`CHARACTER_ORIGIN_GEOMETRY_${reason}`);
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function vector(value, positive = false) {
  return Array.isArray(value) && value.length === 2 && value.every((n) => Number.isSafeInteger(n) && (positive ? n > 0 : true));
}

/** Stable UTF-8 JSON, sorted keys, two spaces and final LF; this is the hashed payload. */
export function serializeCharacterOriginGeometry(value) {
  function ordered(item) {
    if (Array.isArray(item)) return item.map(ordered);
    if (item && typeof item === "object") return Object.fromEntries(Object.keys(item).sort().map((key) => [key, ordered(item[key])]));
    return item;
  }
  return `${JSON.stringify(ordered(value), null, 2)}\n`;
}

export async function characterOriginGeometrySha256(value) {
  const bytes = new TextEncoder().encode(serializeCharacterOriginGeometry(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Pure coordinate conversion; no frame selection, ground inference or actor movement. */
export function deriveCharacterOriginTransform({ canvas, origin, sourceScale, baselineScale, baselineOrigin, baselineCanvas, baselineAnchor }) {
  requireGeometry(vector(canvas, true) && canvas.every((n) => n <= 2048) && vector(origin)
    && origin.every((n, axis) => n >= 0 && n <= canvas[axis]), "INVALID_CANVAS_OR_ORIGIN");
  requireGeometry(Number.isSafeInteger(sourceScale) && sourceScale > 0 && sourceScale <= 64
    && Number.isSafeInteger(baselineScale) && baselineScale > 0 && baselineScale <= 64, "INVALID_SCALE");
  requireGeometry(vector(baselineCanvas, true) && vector(baselineOrigin)
    && baselineAnchor && [baselineAnchor.x, baselineAnchor.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1), "INVALID_BASELINE");
  const resolution = sourceScale / baselineScale;
  const baselineAnchorPixels = [baselineCanvas[0] * baselineAnchor.x, baselineCanvas[1] * baselineAnchor.y];
  const delta = baselineOrigin.map((n, axis) => n - baselineAnchorPixels[axis]);
  const anchorPixels = origin.map((n, axis) => n - delta[axis] * resolution);
  requireGeometry(anchorPixels.every((n, axis) => n >= 0 && n <= canvas[axis]), "ANCHOR_OUTSIDE_CANVAS");
  return Object.freeze({ resolution, anchor: Object.freeze({ x: anchorPixels[0] / canvas[0], y: anchorPixels[1] / canvas[1] }),
    anchorPixels: Object.freeze(anchorPixels), baselineOriginOffset: Object.freeze(delta),
    sourceToBaselineScale: baselineScale });
}

/** Only a separately registered, content-hashed M201 geometry payload can relax baseline canvas equality. */
export async function validateCharacterOriginGeometry({ geometry, geometryContractSha256, expectedGeometryContractSha256,
  entityId, baselineRuntime, record, motionContractSha256 }) {
  requireGeometry(entityId === ENTITY && geometry?.entityId === entityId
    && geometry.schemaVersion === 1 && geometry.kind === "COMMON_NATIVE_ORIGIN_BASELINE_REFERENCE_V1", "UNSUPPORTED_CONTRACT");
  requireGeometry(SHA256.test(geometryContractSha256 ?? "") && SHA256.test(expectedGeometryContractSha256 ?? "")
    && geometryContractSha256.toLowerCase() === expectedGeometryContractSha256.toLowerCase(), "UNREGISTERED_HASH");
  const snapshot = structuredClone(geometry);
  requireGeometry(await characterOriginGeometrySha256(snapshot) === geometryContractSha256.toLowerCase(), "CONTENT_HASH_MISMATCH");
  requireGeometry(SHA256.test(snapshot.sourceOriginAuditSha256 ?? "") && SHA256.test(snapshot.baselineRuntimeSha256 ?? "")
    && SHA256.test(snapshot.motionContractSha256 ?? "")
    && snapshot.motionContractSha256.toLowerCase() === motionContractSha256?.toLowerCase(), "PROVENANCE_MISMATCH");
  const baselineHash = record.files?.find((file) => file.path === record.runtime)?.sha256;
  requireGeometry(baselineHash?.toLowerCase() === snapshot.baselineRuntimeSha256.toLowerCase()
    && baselineRuntime.entityId === entityId
    && same(snapshot.baselineCanvas, baselineRuntime.artProfile.logicalCanvas)
    && same(snapshot.baselineAnchor, baselineRuntime.artProfile.anchor), "BASELINE_MISMATCH");
  const transforms = {};
  for (const side of SIDES) {
    const reference = snapshot.referenceBySide?.[side];
    requireGeometry(reference?.texture === `${entityId}/${side}/cell_000`
      && baselineRuntime.sides[side].animations.find((animation) => animation.id === 0)?.frames[0]?.texture === reference.texture,
    "REFERENCE_FRAME_MISMATCH");
    const bounds = reference.signedSourceAlphaBounds;
    const placement = reference.baselineSpriteSourceSize;
    const scale = reference.effectiveSourcePixelScale;
    requireGeometry(Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isSafeInteger)
      && bounds[2] > bounds[0] && bounds[3] > bounds[1] && vector(reference.currentSourceOrigin)
      && placement && [placement.x, placement.y, placement.w, placement.h].every(Number.isSafeInteger)
      && placement.x >= 0 && placement.y >= 0 && placement.w > 0 && placement.h > 0
      && placement.x + placement.w <= snapshot.baselineCanvas[0] && placement.y + placement.h <= snapshot.baselineCanvas[1]
      && placement.x === reference.currentSourceOrigin[0] + bounds[0] * scale
      && placement.y === reference.currentSourceOrigin[1] + bounds[1] * scale
      && placement.w === (bounds[2] - bounds[0]) * scale && placement.h === (bounds[3] - bounds[1]) * scale,
    "REFERENCE_GEOMETRY_MISMATCH");
    transforms[side] = deriveCharacterOriginTransform({ canvas: snapshot.logicalCanvas, origin: snapshot.commonSourceOrigin,
      sourceScale: snapshot.sourcePixelScaleBySide?.[side], baselineScale: scale, baselineOrigin: reference.currentSourceOrigin,
      baselineCanvas: snapshot.baselineCanvas, baselineAnchor: snapshot.baselineAnchor });
  }
  // The existing runtime declares one artProfile anchor. Different side anchors need separate evidence and an API change.
  requireGeometry(same(transforms.main, transforms.sub), "INCONSISTENT_SIDE_TRANSFORMS");
  return Object.freeze({ logicalCanvas: Object.freeze(snapshot.logicalCanvas), ...transforms.main,
    geometryContractSha256: geometryContractSha256.toLowerCase() });
}
