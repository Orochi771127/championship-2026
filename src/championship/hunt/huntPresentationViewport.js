// Presentation-only projection; enabled only by a complete injected layout contract.
// The supplied canonical camera remains the runtime/native authority.
// Layout owns referenceWidth (the unrotated portrait field width in CSS px).
// Never derive it from the shorter *field* dimension after HUD reflow.
import { huntViewportTransform, huntViewportToWorld, huntWorldToViewport } from './huntFieldCoordinates.js';

const positive = value => Number.isFinite(value) && value > 0;

// Centre of a view `span` wide inside a map `limit` wide: the view edge stops
// at the map edge; a view wider than the map stays centred on it.
export function huntClampViewCenter(center, span, limit) {
  if (span >= limit) return limit / 2;
  return Math.min(limit - span / 2, Math.max(span / 2, center));
}

export function huntPresentationViewport({
  viewportWidth, viewportHeight, canonicalCamera,
  worldWidthPx, worldHeightPx, referenceWidth = null
}) {
  const legacy = huntViewportTransform(viewportWidth, viewportHeight);
  if (![worldWidthPx, worldHeightPx].every(positive)
      || ![canonicalCamera?.left, canonicalCamera?.top,
        canonicalCamera?.right, canonicalCamera?.bottom].every(Number.isFinite)
      || canonicalCamera.right <= canonicalCamera.left
      || canonicalCamera.bottom <= canonicalCamera.top) {
    throw new RangeError('Hunt presentation requires finite canonical bounds');
  }
  if (referenceWidth !== null && (!positive(referenceWidth) || referenceWidth > viewportWidth)) {
    throw new RangeError('Hunt reference width must be positive and no wider than the viewport');
  }

  // No reference supplied: original portrait transform and camera, exactly.
  // Wide callers explicitly supply the same portrait reference before/after rotation.
  // Owner 2026-11-25 (desktop hunt): dragging to a map edge must never show
  // blank page beside the map. A wide view keeps the portrait reference scale
  // unless the window is wider/taller than the whole map at that scale; then it
  // zooms just enough that the map fills the window (2048 maps on 1920 wide).
  const scale = referenceWidth === null ? legacy.scale : Math.max(
    huntViewportTransform(referenceWidth, viewportHeight).scale,
    viewportWidth / worldWidthPx, viewportHeight / worldHeightPx);
  const transform = referenceWidth === null ? legacy : Object.freeze({
    viewportWidth, viewportHeight, scale,
    worldWidth: viewportWidth / scale, worldHeight: viewportHeight / scale
  });
  // The wide window is clamped to the map here; panHuntPresentationCamera pans
  // from this same clamped centre, so there is no drag dead-zone at an edge.
  const width = transform.worldWidth, height = transform.worldHeight;
  const rawCenterX = (canonicalCamera.left + canonicalCamera.right) / 2;
  const rawCenterY = (canonicalCamera.top + canonicalCamera.bottom) / 2;
  const centerX = referenceWidth === null ? rawCenterX : huntClampViewCenter(rawCenterX, width, worldWidthPx);
  const centerY = referenceWidth === null ? rawCenterY : huntClampViewCenter(rawCenterY, height, worldHeightPx);
  const viewRect = referenceWidth === null ? canonicalCamera : Object.freeze({
    left: centerX - width / 2, top: centerY - height / 2,
    right: centerX + width / 2, bottom: centerY + height / 2,
    centerX, centerY, width, height
  });
  const intersection = {
    left: Math.max(0, viewRect.left), top: Math.max(0, viewRect.top),
    right: Math.min(worldWidthPx, viewRect.right), bottom: Math.min(worldHeightPx, viewRect.bottom)
  };
  const visibleMapRect = intersection.right > intersection.left && intersection.bottom > intersection.top
    ? Object.freeze(intersection) : null;
  const offset = Object.freeze({ x: 0, y: 0 });
  const toWorldPoint = point => {
    const worldPoint = huntViewportToWorld(
      { x: point.x - offset.x, y: point.y - offset.y }, viewRect, transform);
    if (referenceWidth !== null) {
      // Cancel floating-point error at actual map edges before native floor().
      // This does not quantize ordinary world points or alter the legacy path.
      for (const [axis, limit] of [['x', worldWidthPx], ['y', worldHeightPx]]) {
        if (Math.abs(worldPoint[axis]) < 1e-9) worldPoint[axis] = 0;
        else if (Math.abs(worldPoint[axis] - limit) < 1e-9) worldPoint[axis] = limit;
      }
    }
    return worldPoint;
  };
  const toViewportPoint = point => {
    const projected = huntWorldToViewport(point, viewRect, transform);
    return { x: projected.x + offset.x, y: projected.y + offset.y };
  };
  const containsViewportPoint = point => {
    if (!visibleMapRect || ![point?.x, point?.y].every(Number.isFinite)
        || point.x < 0 || point.y < 0 || point.x >= viewportWidth || point.y >= viewportHeight) return false;
    const worldPoint = toWorldPoint(point);
    return worldPoint.x >= visibleMapRect.left && worldPoint.x < visibleMapRect.right
      && worldPoint.y >= visibleMapRect.top && worldPoint.y < visibleMapRect.bottom;
  };
  return Object.freeze({ transform, viewRect, visibleMapRect, offset, toWorldPoint, toViewportPoint, containsViewportPoint });
}
