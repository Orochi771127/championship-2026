// VS3 -- original Hunt capture geometry, translated into a web/mobile simulator.
//
// These numbers: ignore jitter under 5px, interpolate gaps over 20px, keep at
// most 20 points, require 6+ points and a 25px span (VERIFIED_BINARY). The
// 15px first-to-last gap is a prior-spec stand-in; original AABB uses 15px
// as a shape test, not closure-to-start.
//
// This file tests the recognizer itself. Wiring it onto the Hunt field is a
// later step; VS2 still ships no capture surface.

import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPTURE_CLOSURE_EVIDENCE,
  CAPTURE_CLOSURE_TOLERANCE_PX,
  CAPTURE_GEOMETRY_EVIDENCE,
  CAPTURE_IGNORE_SEGMENT_BELOW_PX,
  CAPTURE_INTERPOLATE_OVER_PX,
  CAPTURE_MAX_POINTS,
  CAPTURE_MINIMUM_CLOSE_POINTS,
  CAPTURE_MINIMUM_EXTENT_PX,
  createCaptureStrokeRecognizer
} from "../src/championship/hunt/capture/captureStrokeRecognizer.js";
import {
  TETHER_BANDS,
  TETHER_DISTANCE_EVIDENCE,
  classifyTetherDistance
} from "../src/championship/hunt/capture/tetherSystem.js";

test("the translated capture constants match the original grammar", () => {
  assert.equal(CAPTURE_IGNORE_SEGMENT_BELOW_PX, 5);
  assert.equal(CAPTURE_INTERPOLATE_OVER_PX, 20);
  assert.equal(CAPTURE_MAX_POINTS, 20);
  assert.equal(CAPTURE_MINIMUM_CLOSE_POINTS, 6);
  assert.equal(CAPTURE_MINIMUM_EXTENT_PX, 25);
  assert.equal(CAPTURE_GEOMETRY_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(CAPTURE_CLOSURE_TOLERANCE_PX, 15);
  assert.equal(CAPTURE_CLOSURE_EVIDENCE, "PRIOR_SPEC_NOT_AABB");
});

test("a jitter shorter than 5px is ignored", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(3, 0);
  assert.deepEqual(stroke.getPoints(), [{ x: 0, y: 0 }]);
});

test("a 5px step is kept", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(5, 0);
  assert.deepEqual(stroke.getPoints(), [
    { x: 0, y: 0 },
    { x: 5, y: 0 }
  ]);
});

test("a gap longer than 20px is interpolated", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(50, 0);
  const points = stroke.getPoints();
  assert.equal(points[0].x, 0);
  assert.equal(points[points.length - 1].x, 50);
  for (let index = 1; index < points.length; index += 1) {
    const gap = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    assert.ok(gap <= CAPTURE_INTERPOLATE_OVER_PX + 1e-9, `gap ${gap} exceeded interpolation`);
  }
  assert.ok(points.length >= 3);
});

test("the stroke stores at most 20 points", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  for (let step = 1; step <= 40; step += 1) {
    stroke.move(step * 20, 0);
  }
  assert.equal(stroke.getPoints().length, CAPTURE_MAX_POINTS);
});

test("a short scribble does not close", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(10, 0);
  stroke.move(10, 10);
  stroke.move(0, 10);
  stroke.move(0, 1);
  const verdict = stroke.end();
  assert.equal(verdict.closed, false);
  assert.equal(verdict.reason, "TOO_FEW_POINTS");
});

test("an open line with enough points still does not close", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(0, 20);
  stroke.move(0, 40);
  stroke.move(0, 60);
  stroke.move(0, 80);
  stroke.move(0, 100);
  const verdict = stroke.end();
  assert.equal(verdict.closed, false);
  assert.equal(verdict.reason, "NOT_CLOSED");
});

test("a tiny loop fails the minimum extent", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(10, 0);
  stroke.move(10, 10);
  stroke.move(0, 10);
  stroke.move(-10, 10);
  stroke.move(-10, 0);
  stroke.move(0, 0);
  const verdict = stroke.end();
  assert.equal(verdict.closed, false);
  assert.equal(verdict.reason, "TOO_SMALL");
});

test("a closed loop that spans 25px and returns within 15px captures", () => {
  const stroke = createCaptureStrokeRecognizer();
  stroke.begin(0, 0);
  stroke.move(30, 0);
  stroke.move(30, 30);
  stroke.move(0, 30);
  stroke.move(-10, 20);
  stroke.move(2, 2);
  const verdict = stroke.end();
  assert.equal(verdict.closed, true);
  assert.equal(verdict.reason, "CLOSED");
  assert.ok(stroke.getPoints().length >= CAPTURE_MINIMUM_CLOSE_POINTS);
});

test("tether distance uses the product four bands (not ROM-verified)", () => {
  assert.equal(TETHER_DISTANCE_EVIDENCE, "PRODUCT_AUTHORED");
  assert.deepEqual(TETHER_BANDS, Object.freeze([40, 80, 160]));
  assert.equal(classifyTetherDistance(0), "UNDER_40");
  assert.equal(classifyTetherDistance(39.9), "UNDER_40");
  assert.equal(classifyTetherDistance(40), "FROM_40_TO_80");
  assert.equal(classifyTetherDistance(80), "FROM_80_TO_160");
  assert.equal(classifyTetherDistance(160), "OVER_160");
  assert.equal(classifyTetherDistance(400), "OVER_160");
});
