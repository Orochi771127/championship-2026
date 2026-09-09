// Legacy diagnostic grammar. NOT original capture parity and not player input.
// Direct ROM checks contradict its frozen buffer, short-step handling,
// interpolation and endpoint gap. The native animation-driven sample lifetime
// and spatial query are also unresolved. Kept only to inspect historical traces;
// huntRuntime cannot remove targets or commit ownership from this result.
// See docs/research/HUNT_ROUND3_TRACE_2026-09-05.md.

import { deepFreeze } from "../../contracts/championshipContracts.js";

export const CAPTURE_IGNORE_SEGMENT_BELOW_PX = 5;
export const CAPTURE_INTERPOLATE_OVER_PX = 20;
export const CAPTURE_MAX_POINTS = 20;
export const CAPTURE_MINIMUM_CLOSE_POINTS = 6;
export const CAPTURE_MINIMUM_EXTENT_PX = 25;
export const CAPTURE_CLOSURE_TOLERANCE_PX = 15;
export const CAPTURE_GEOMETRY_EVIDENCE = "LEGACY_PROTOTYPE_NOT_ORIGINAL";
export const CAPTURE_CLOSURE_EVIDENCE = "PRIOR_SPEC_NOT_AABB";

function captureError(message) {
  const error = new Error(message);
  error.name = "ChampionshipCaptureStrokeError";
  return error;
}

function requireFinitePoint(x, y, label) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw captureError(`${label} requires finite coordinates`);
  }
}

function evaluateClose(points) {
  if (points.length < CAPTURE_MINIMUM_CLOSE_POINTS) {
    return { closed: false, reason: "TOO_FEW_POINTS" };
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(last.x - first.x, last.y - first.y) > CAPTURE_CLOSURE_TOLERANCE_PX) {
    return { closed: false, reason: "NOT_CLOSED" };
  }
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  if (Math.max(maxX - minX, maxY - minY) < CAPTURE_MINIMUM_EXTENT_PX) {
    return { closed: false, reason: "TOO_SMALL" };
  }
  return { closed: true, reason: "CLOSED" };
}

export function createCaptureStrokeRecognizer() {
  let points = [];
  let active = false;
  let finished = false;

  function accept(x, y) {
    if (points.length >= CAPTURE_MAX_POINTS) return;
    points.push({ x, y });
  }

  function addToward(x, y) {
    if (points.length >= CAPTURE_MAX_POINTS) return;
    const last = points[points.length - 1];
    const dx = x - last.x;
    const dy = y - last.y;
    const distance = Math.hypot(dx, dy);
    if (distance < CAPTURE_IGNORE_SEGMENT_BELOW_PX) return;
    if (distance <= CAPTURE_INTERPOLATE_OVER_PX) {
      accept(x, y);
      return;
    }

    const unitX = dx / distance;
    const unitY = dy / distance;
    let remaining = distance;
    let cursorX = last.x;
    let cursorY = last.y;
    while (remaining > CAPTURE_INTERPOLATE_OVER_PX && points.length < CAPTURE_MAX_POINTS) {
      cursorX += unitX * CAPTURE_INTERPOLATE_OVER_PX;
      cursorY += unitY * CAPTURE_INTERPOLATE_OVER_PX;
      accept(cursorX, cursorY);
      remaining -= CAPTURE_INTERPOLATE_OVER_PX;
    }
    if (remaining >= CAPTURE_IGNORE_SEGMENT_BELOW_PX && points.length < CAPTURE_MAX_POINTS) {
      accept(x, y);
    }
  }

  return Object.freeze({
    begin(x, y) {
      requireFinitePoint(x, y, "Capture begin");
      points = [];
      active = true;
      finished = false;
      accept(x, y);
    },

    move(x, y) {
      requireFinitePoint(x, y, "Capture move");
      if (!active || finished) return;
      addToward(x, y);
    },

    end() {
      finished = true;
      active = false;
      return deepFreeze(evaluateClose(points));
    },

    getPoints() {
      return deepFreeze(points.map((point) => ({ x: point.x, y: point.y })));
    }
  });
}
