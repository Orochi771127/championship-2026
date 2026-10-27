// OWNER_APPROVED_ADAPTATION 2026-10-27: the rope's circle is read as a lasso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLassoTracker, lassoContains, LASSO_RULES } from '../src/championship/hunt/capture/ropeLassoGesture.js';

function draw(points) {
  const tracker = createLassoTracker();
  for (const [x, y] of points) { const loop = tracker.add(x, y); if (loop) return loop; }
  return null;
}
const arc = (cx, cy, rx, ry, from, to, steps = 48) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + (to - from) * (i / steps);
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

test('a hand-drawn circle closes as soon as the head comes back round', () => {
  const loop = draw(arc(100, 100, 30, 30, 0, Math.PI * 2.05));
  assert.ok(loop, 'a full circle is a lasso');
  assert.ok(Math.abs(loop.centroid.x - 100) < 4 && Math.abs(loop.centroid.y - 100) < 4);
  assert.ok(lassoContains(loop.polygon, 100, 100));
});

test('an oval counts, a crossing stroke counts, an open arc does not', () => {
  assert.ok(draw(arc(80, 80, 40, 14, 0, Math.PI * 2.05)), 'flat ovals are fine');
  // A figure that overshoots and crosses its own start.
  assert.ok(draw([[60, 60], ...arc(90, 60, 30, 22, Math.PI, Math.PI * 3.2)]), 'a stroke crossing itself closes');
  assert.equal(draw(arc(100, 100, 30, 30, 0, Math.PI * 1.3)), null, 'a three-quarter arc stays open');
});

test('a quarter arc or an out-and-back stroke near the start does not close', () => {
  assert.equal(draw(arc(100, 100, 40, 40, 0, Math.PI / 2)), null);
  const out = Array.from({ length: 20 }, (_, i) => [100 + i * 3, 100]);
  assert.equal(draw([...out, ...out.slice().reverse().map(([x, y]) => [x, y + 6])]), null, 'there and back is not a loop');
});

test('tiny scribbles are not lassos', () => {
  assert.equal(draw(arc(50, 50, 4, 4, 0, Math.PI * 2.2, 24)), null);
  assert.ok(LASSO_RULES.minLoopSpan > 8);
});

test('a body inside the loop or within its margin is caught; one far outside is not', () => {
  const loop = draw(arc(100, 100, 30, 24, 0, Math.PI * 2.05));
  assert.ok(lassoContains(loop.polygon, 112, 95));
  assert.ok(lassoContains(loop.polygon, 100 + 30 + LASSO_RULES.catchMargin - 2, 100), 'the rope margin');
  assert.equal(lassoContains(loop.polygon, 200, 100), false);
});
