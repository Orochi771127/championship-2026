// Same-theme cage pairs (local review 2026-10-19): CM02 running track + CM30
// basketball court. Full rims by default; a rim-free patch only on an edge a
// paired cage really shares; separated or unpaired neighbours keep their rims.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchSharedEdges } from "../src/championship/presentation/cageSharedEdges.js";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const index = read("assets/production/cage/shared-edges-polish-20261019/index.json");
const polish = read("assets/production/cage/polish-review-20261019/manifest.json");
const field = id => index.fields.find(f => f.fieldId === id);
const place = (id, key, dx, dy, s = 1) => ({ key, fieldId: id,
  edges: field(id).edges.map(e => ({ id: e.id, a: [dx + e.a[0] * s, dy + e.a[1] * s], b: [dx + e.b[0] * s, dy + e.b[1] * s] })) });
const edge = (id, name) => field(id).edges.find(e => e.id === name);

test("the patches belong to the exact polish frames and stay inside each raster", () => {
  assert.deepEqual(index.pairs[0], ["field_cm02_01", "field_cm30_01"]);
  for (const f of index.fields) {
    const frame = polish.fields.find(x => x.fieldId === f.fieldId).frames[0];
    assert.equal(f.sourceHash, frame.sha256);
    assert.ok(fs.existsSync(f.atlas.src));
    for (const e of f.edges) {
      assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.width <= f.raster[0] && e.y + e.height <= f.raster[1], `${f.fieldId} ${e.id}`);
      assert.ok(e.atlasX + e.width <= f.atlas.width && e.atlasY + e.height <= f.atlas.height);
    }
  }
  assert.equal(field("field_cm30_01").edges.length, 6);
});

test("an edge shared with the paired cage is patched on both sides, nothing else is", () => {
  // Put CM30 so its west edge lies on CM02's east edge (the upper-right lobe).
  const w = edge("field_cm30_01", "flush-porcelain-joint.005"), e = edge("field_cm02_01", "flush-porcelain-joint.004");
  const dx = (e.a[0] + e.b[0] - w.a[0] - w.b[0]) / 2, dy = (e.a[1] + e.b[1] - w.a[1] - w.b[1]) / 2;
  const shown = matchSharedEdges([place("field_cm02_01", 0, 0, 0), place("field_cm30_01", 1, dx, dy)], index.pairs, 8);
  assert.deepEqual([...shown].sort(), ["0|flush-porcelain-joint.004", "1|flush-porcelain-joint.005"]);
  // separated by one hex: full rims
  assert.equal(matchSharedEdges([place("field_cm02_01", 0, 0, 0), place("field_cm30_01", 1, dx + 384, dy)], index.pairs, 8).size, 0);
  // same position but not a pair (a cage of another theme with the CM30 outline): full rims
  const other = { ...place("field_cm30_01", 1, dx, dy), fieldId: "field_cm16_01" };
  assert.equal(matchSharedEdges([place("field_cm02_01", 0, 0, 0), other], index.pairs, 8).size, 0);
});
