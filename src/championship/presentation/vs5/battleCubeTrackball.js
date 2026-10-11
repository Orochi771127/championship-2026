// Bounded, on-demand cube input. No ticker, inertia, snap, or gameplay authority.
import { Quaternion, Vector3 } from "../../../../node_modules/three/build/three.module.js";

const TAP_SLOP = 7; // CSS pixels of total travel, including the final pointerup.
const KEY_STEP = Math.PI / 12;

// Sphere near the center, hyperbolic sheet outside: continuous at the seam and
// defined even when pointer capture takes the pointer outside the canvas.
export function projectBattleTrackball(clientX, clientY, rect) {
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const x = (clientX - rect.left - rect.width / 2) / radius;
  const y = (rect.top + rect.height / 2 - clientY) / radius;
  const distanceSquared = x * x + y * y;
  const z = distanceSquared <= 0.5 ? Math.sqrt(1 - distanceSquared) : 0.5 / Math.sqrt(distanceSquared);
  return new Vector3(x, y, z).normalize();
}

export function rotateBattleTrackball(orientation, from, to, cameraOrientation) {
  const delta = new Quaternion().setFromUnitVectors(from, to);
  // Screen-space rotation must be conjugated into the tilted camera's world.
  delta.premultiply(cameraOrientation).multiply(cameraOrientation.clone().invert());
  orientation.premultiply(delta).normalize();
  return orientation;
}

export function bindBattleCubeTrackball({ canvas, orientation, cameraOrientation, onChange, onTap }) {
  let active = null;
  let disposed = false;
  const view = canvas.ownerDocument?.defaultView;
  const listeners = [];
  const listen = (target, type, handler) => {
    if (!target) return;
    target.addEventListener(type, handler);
    listeners.push([target, type, handler]);
  };
  const release = () => {
    const pointer = active;
    active = null; // lostpointercapture may fire synchronously during release.
    if (!pointer) return;
    try { canvas.releasePointerCapture?.(pointer.id); } catch { /* already lost */ }
  };
  const advance = (event) => {
    if (!active || event.pointerId !== active.id) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.travel += Math.hypot(dx, dy);
    active.x = event.clientX;
    active.y = event.clientY;
    const point = projectBattleTrackball(event.clientX, event.clientY, active.rect);
    if (dx || dy) {
      rotateBattleTrackball(orientation, active.point, point, cameraOrientation);
      active.point = point;
      onChange();
    }
  };
  listen(canvas, "pointerdown", event => {
    if (disposed || active || event.isPrimary === false || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0,
      rect, point: projectBattleTrackball(event.clientX, event.clientY, rect) };
    try { canvas.setPointerCapture?.(event.pointerId); } catch { release(); return; }
    canvas.focus?.({ preventScroll: true });
    event.preventDefault();
  });
  listen(canvas, "pointermove", event => {
    if (!active || event.pointerId !== active.id) return;
    // Recover if a mouse button was released outside a window/capture failed.
    if (event.pointerType === "mouse" && event.buttons === 0) { release(); return; }
    advance(event);
    event.preventDefault();
  });
  listen(canvas, "pointerup", event => {
    if (!active || event.pointerId !== active.id) return;
    advance(event);
    const tap = active.travel < TAP_SLOP;
    release();
    event.preventDefault();
    if (tap && !disposed) onTap(event);
  });
  const cancel = event => {
    if (event.pointerId !== undefined && active?.id !== event.pointerId) return;
    release();
  };
  listen(canvas, "pointercancel", cancel);
  listen(canvas, "lostpointercapture", cancel);
  listen(canvas, "touchcancel", cancel);
  listen(view, "blur", cancel);
  // Selection happens only on an un-cancelled tap, never on compatibility clicks
  // generated after a drag. Sibling HTML mode buttons retain native clicks.
  listen(canvas, "click", event => { event.preventDefault(); event.stopPropagation(); });
  listen(canvas, "keydown", event => {
    if (active || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const axis = new Vector3(direction[1], direction[0], 0).applyQuaternion(cameraOrientation);
    orientation.premultiply(new Quaternion().setFromAxisAngle(axis, KEY_STEP)).normalize();
    onChange();
  });
  return Object.freeze({
    isDragging: () => active !== null,
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      for (const [target, type, handler] of listeners) target.removeEventListener(type, handler);
    }
  });
}
