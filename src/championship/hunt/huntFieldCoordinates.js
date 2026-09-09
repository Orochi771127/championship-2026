// Coordinate adapter only. The existing 2048 world represents 1024 native px.
// This scale is a presentation binding, not evidence for terrain or encounters.
export const HUNT_WORLD_UNITS_PER_NATIVE_PIXEL = 2;
export const HUNT_NATIVE_VIEWPORT_WIDTH = 256;

export function huntViewportTransform(width, height) {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Hunt viewport dimensions must be positive and finite");
  }
  const scale = width / (HUNT_NATIVE_VIEWPORT_WIDTH * HUNT_WORLD_UNITS_PER_NATIVE_PIXEL);
  return Object.freeze({ viewportWidth: width, viewportHeight: height, scale, worldWidth: width / scale, worldHeight: height / scale });
}

export function huntViewportToWorld(point, camera, transform) {
  return { x: camera.left + point.x / transform.scale, y: camera.top + point.y / transform.scale };
}

export function huntWorldToViewport(point, camera, transform) {
  return { x: (point.x - camera.left) * transform.scale, y: (point.y - camera.top) * transform.scale };
}

export function huntWorldToNative(point) {
  return { x: point.x / HUNT_WORLD_UNITS_PER_NATIVE_PIXEL, y: point.y / HUNT_WORLD_UNITS_PER_NATIVE_PIXEL };
}
