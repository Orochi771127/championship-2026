// Facing gate for the reviewed character action art (Owner 2026-10-29: every action the game draws
// must be checkable). Every General (Main/Sub) clip and every Data Arena clip heading L R UL UR DL DR,
// drawn with the game's own mirror policy, must keep each frame facing with its clip neighbours, except
// outliers reviewed by eye in REVIEWED_ACTION_FACING_EXCEPTIONS. No image is decoded here: the
// pivot-aligned masks come from scripts/build-reviewed-action-masks.py and are pinned to each public
// manifest's sha256. Visual review: node scripts/review-reviewed-actions.mjs (contact sheets).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decodeFacingMasks, facingOutliers } from '../scripts/lib/reviewed-action-facing.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
// Every selected set, playable or illustration-only (GR39-41, MA65-69 reviewed 2026-10-29).
const selection = read('src/data/championship/reviewed-animation-selection.v1.json').characters;
const maskDoc = read('docs/contracts/championship/REVIEWED_ACTION_FACING_MASKS.v1.json');
const exceptions = read('docs/contracts/championship/REVIEWED_ACTION_FACING_EXCEPTIONS.v1.json').entries;
const masks = decodeFacingMasks(maskDoc);
const key = (f) => `${f.displayCode}|${f.usage}|${f.clip}|${f.frame}`;
const outliers = (entry) => facingOutliers({ entry, manifest: read(entry.path), roleMasks: masks[entry.displayCode], grid: maskDoc.grid, headings: maskDoc.arenaHeadings });

test('facing masks cover every playable role and are pinned to its current public manifest', () => {
  assert.deepEqual(maskDoc.roles, selection.map((e) => e.displayCode).sort(), 'Rerun scripts/build-reviewed-action-masks.py');
  for (const entry of selection) {
    const role = masks[entry.displayCode];
    assert.equal(role.manifest, entry.path, entry.displayCode);
    assert.equal(role.manifestSha256, entry.sha256, `${entry.displayCode}: art changed, rerun scripts/build-reviewed-action-masks.py`);
  }
});

test('every reviewed General and Arena clip keeps its frames facing together, apart from reviewed exceptions', () => {
  const found = selection.flatMap(outliers), accepted = new Set(exceptions.map(key));
  const unexpected = found.filter((f) => !accepted.has(key(f)));
  assert.deepEqual(unexpected, [], 'A frame faces against its clip: fix generalMirror / generalMirrorFrames, or review it with scripts/review-reviewed-actions.mjs and record it as an exception');
  const stale = exceptions.filter((x) => !found.some((f) => key(f) === key(x)));
  assert.deepEqual(stale, [], 'Exceptions that no longer occur must be removed');
  for (const x of exceptions) {
    assert.ok(['NOT_A_FACING_ERROR', 'ART_ISSUE_REPORTED'].includes(x.verdict), key(x));
    assert.ok(x.note?.length > 20, `${key(x)} needs a reason`);
  }
});

test('the gate catches a single General frame left facing the wrong way (the GR38 blink of #123)', () => {
  // GR38 is drawn in the chibi-pixel set since 2026-11-26 (its #123 blink frames live in the kept detail set).
  // One walk frame flipped by a stray generalMirrorFrames entry must turn against its clip.
  const gr38 = selection.find((e) => e.displayCode === 'GR38');
  assert.deepEqual(outliers(gr38), []);
  const broken = { ...gr38, generalMirrorFrames: ['gr38-cp-main_2-m00'] };
  const walk = outliers(broken).filter((f) => f.clip === 'main:2').map((f) => f.frame);
  assert.ok(walk.includes('gr38-cp-main_2-m00'), JSON.stringify(walk));
});

test('the gate reads Arena frames with their delivered mirrorX', () => {
  // GR18's chibi-pixel DR/R/UR clips are the renderer flip of DL/L/UL (mirrorX, 2026-11-26). Its DR idle read with
  // that flip is clean; one frame read without its delivered mirrorX turns against its clip.
  const gr18 = selection.find((e) => e.displayCode === 'GR18');
  const manifest = read(gr18.path);
  const dl = manifest.clips.find((c) => c.mode === 'arena' && c.action === 'idle' && c.direction === 'DR');
  const id = dl.frames[0].assetId;
  assert.equal(manifest.frames.find((f) => f.id === id).mirrorX, true);
  const clean = facingOutliers({ entry: gr18, manifest, roleMasks: masks.GR18, grid: maskDoc.grid, headings: maskDoc.arenaHeadings });
  assert.deepEqual(clean.filter((f) => f.usage === 'arena' && f.clip === dl.id), []);
  delete manifest.frames.find((f) => f.id === id).mirrorX;
  const broken = facingOutliers({ entry: gr18, manifest, roleMasks: masks.GR18, grid: maskDoc.grid, headings: maskDoc.arenaHeadings });
  assert.deepEqual(broken.filter((f) => f.usage === 'arena' && f.clip === dl.id).map((f) => f.frame), [id]);
});
