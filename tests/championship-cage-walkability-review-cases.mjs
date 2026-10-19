// Cage walkability review (Owner 2026-10-19): redesigned cages block their new
// props; applied only by the loopback cage review, original data otherwise.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyRaisingGroundReview, clearRaisingGroundReview, reviewGroundField, RAISING_GROUND_REVIEW_ADAPTATION }
  from "../src/championship/raising/raisingGroundReview.js";

const review = JSON.parse(fs.readFileSync("src/data/championship/catalogs/raising-ground.review-20261019.json", "utf8"));
const original = JSON.parse(fs.readFileSync("src/data/championship/catalogs/raising-ground.r1.json", "utf8")).fields[27];
const cellsOf = f => f.runs.flatMap(([n, ...v]) => Array.from({ length: n }, () => v));

test("CM30 review blocks the hoop post, bench and ball cart and keeps the outline", () => {
  assert.equal(review.adaptation, RAISING_GROUND_REVIEW_ADAPTATION);
  const f = review.fields.find(x => x.definitionIndex === 27), a = cellsOf(original), b = cellsOf(f);
  assert.equal(b.length, a.length);
  const at = (c, x, y) => c[y * 12 + x];
  for (const [x, y] of [[1, 5], [5, 4], [6, 4], [7, 5], [6, 9], [7, 10]]) { assert.equal(at(b, x, y)[1], 1, `${x},${y}`); assert.equal(at(a, x, y)[1], 0); }
  for (let i = 0; i < a.length; i++) assert.equal(b[i][0], a[i][0], "owned outline unchanged");
  const clear = f.clearanceRuns.flatMap(([n, v]) => Array(n).fill(v));
  b.forEach((c, i) => assert.equal(clear[i], c[2]));
  assert.ok(b.filter(c => c[0] === 1 && c[1] === 0).length > 50);
});

test("the override exists only while applied", () => {
  assert.equal(reviewGroundField(27), null);
  applyRaisingGroundReview(review);
  assert.equal(reviewGroundField(27).cells[5 * 12 + 1][1], 1);
  assert.equal(reviewGroundField(1), null);
  clearRaisingGroundReview();
  assert.equal(reviewGroundField(27), null);
  assert.throws(() => applyRaisingGroundReview({ ...review, adaptation: "X" }));
});
