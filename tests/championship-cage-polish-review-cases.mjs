// Cage polish review (local, 2026-10-19): re-lit frames of the reviewed
// masters with the final intake's exact alpha, plus occluders and ambient
// rebuilt on them. Selected only by the loopback ?cageReview switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const bytes = p => fs.readFileSync(new URL('../' + p, import.meta.url));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const polish = read('assets/production/cage/polish-review-20261019/manifest.json');
const final = read('assets/production/public-runtime/cage-final.map.v1.json');

test('polish review keeps every field, size and duration; untouched cages keep their exact frames', () => {
  assert.equal(polish.assetId, 'art:cage:polish-review:20261019');
  assert.deepEqual(polish.fields.map(f => f.fieldId), final.fields.map(f => f.fieldId));
  for (const f of polish.fields) {
    const o = final.fields.find(x => x.fieldId === f.fieldId);
    assert.equal(f.worldWidthPx, o.worldWidthPx); assert.equal(f.worldHeightPx, o.worldHeightPx);
    assert.equal(f.frames.length, o.frames.length, f.fieldId);
    f.frames.forEach((fr, i) => {
      assert.equal(fr.durationMs, o.frames[i].durationMs);
      assert.equal(sha(bytes(fr.src)), fr.sha256, fr.src);
      if (['field_cm03_01', 'field_cm24_01', 'field_cm28_01', 'field_cm29_01'].includes(f.fieldId)) assert.deepEqual(fr, o.frames[i]);
      else assert.match(fr.src, /^assets\/production\/cage\/polish-review-20261019\/fields\//);
    });
  }
});

test('polished occluders, ambient and the CM02 goal net bind the polished frames', () => {
  const frameOf = fid => polish.fields.find(f => f.fieldId === fid).frames[0].sha256;
  const fg = read('assets/production/cage/foreground-review-polish-20261019/index.json');
  assert.equal(fg.assetId, 'art:cage:foreground-review:polish-20261019');
  for (const f of fg.fields) {
    assert.equal(f.sourceHash, frameOf(f.fieldId), f.fieldId);
    const data = read(f.manifest);
    assert.equal(sha(bytes(data.atlas.src)), data.atlas.sha256);
  }
  const amb = read('assets/production/cage/ambient-review-polish-20261019/index.json');
  assert.equal(amb.assetId, 'art:cage:ambient-review:polish-20261019');
  for (const f of amb.fields) assert.equal(f.sourceHash, frameOf(f.fieldId), f.fieldId);
  const goal = read('assets/production/cage/cm02-goal-foreground-polish-20261019/manifest.json');
  assert.equal(goal.sourceComposite.sha256, frameOf('field_cm02_01'));
  assert.equal(goal.objects.length, read('assets/production/cage/cm02-goal-foreground-20261019/manifest.json').objects.length);
});

test('the review manifest is reachable only through the loopback cageReview switch', () => {
  const main = fs.readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
  assert.match(main, /LOCAL_MAP_REVIEW\.get\("cageReview"\) === "polish-20261019"/);
  const requests = fs.readFileSync(new URL('../src/championship/presentation/publicMapRequests.js', import.meta.url), 'utf8');
  assert.match(requests, /'cageReview'\]/);
  assert.match(requests, /\['localhost','127\.0\.0\.1','\[::1\]'\]\.includes\(base\.hostname\)/);
});
