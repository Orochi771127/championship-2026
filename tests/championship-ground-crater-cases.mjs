// Ground craters (Owner 2026-11-10) and the Journey zone rivals' art.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {craterPlan, paintCraterBase, paintCraterEmbers, emberWeight, craterPop, CRATER_KINDS, CRATER_W, CRATER_H, CRATER_CELL}
  from '../src/championship/presentation/vfx/groundCrater.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A 2D context that only records the cells painted (the last style wins per cell). */
function recorder() {
  const cells = new Map();
  let style = null;
  return {
    cells,
    set fillStyle(v) { style = v; }, get fillStyle() { return style; },
    clearRect(x, y) { cells.delete(`${x / CRATER_CELL},${y / CRATER_CELL}`); },
    fillRect(x, y, w, h) {
      assert.equal(w, CRATER_CELL); assert.equal(h, CRATER_CELL);
      assert.equal(x % CRATER_CELL, 0); assert.equal(y % CRATER_CELL, 0);
      cells.set(`${x / CRATER_CELL},${y / CRATER_CELL}`, style);
    }
  };
}
const fire = {main: 0xff7a1c, core: 0xffe27a, edge: 0xd8341a};
const alphaOf = (style) => Number(/,([\d.]+)\)$/.exec(style)?.[1]);

test('a crater is the same for the same seed and differs between variants', () => {
  const a = craterPlan(seeded(978)), b = craterPlan(seeded(978)), c = craterPlan(seeded(1955));
  assert.deepEqual(a.cracks, b.cracks);
  assert.notDeepEqual(a.cracks, c.cracks);
  assert.ok(a.cracks.length >= 6, 'six or more cracks');
  assert.ok(a.chips.length >= 7, 'seven or more rock chips');
});

test('the base paints whole pixel cells inside the 128x64 texture: a dark pit, a lit far wall and cracks beyond the lip', () => {
  const c = recorder();
  const plan = paintCraterBase(c, fire, seeded(978));
  for (const key of c.cells.keys()) {
    const [x, y] = key.split(',').map(Number);
    assert.ok(x >= 0 && y >= 0 && x < CRATER_W && y < CRATER_H, key);
  }
  const centre = c.cells.get('32,15'), farWall = [...plan.cells].filter(([, v]) => v.t < 0.95 && v.t > 0.6 && v.dy < -0.5);
  assert.ok(alphaOf(centre) >= 0.84, 'the pit floor is dark and nearly opaque');
  assert.ok(farWall.some(([key]) => c.cells.get(key) !== centre), 'the far wall is drawn in a lighter tone than the floor');
  const outside = plan.cracks.flat().filter((cell) => (plan.cells.get(`${cell.x},${cell.y}`)?.t ?? 2) > 1.1);
  assert.ok(outside.length >= 10, 'cracks run out past the lip');
});

test('the ember layer glows only in the pit and the inner cracks, never over the lip', () => {
  const c = recorder();
  const plan = paintCraterEmbers(c, fire, seeded(978));
  assert.ok(c.cells.size > 20);
  for (const key of c.cells.keys()) {
    const inPit = (plan.cells.get(key)?.t ?? 2) < 0.8;
    const inCrack = plan.cracks.flat().some((cell) => `${cell.x},${cell.y}` === key || `${cell.x + 1},${cell.y}` === key);
    assert.ok(inPit || inCrack, `ember outside the pit and cracks at ${key}`);
  }
});

test('embers cool before the crater fades; the landing pops from 82 % and settles at full size', () => {
  assert.equal(emberWeight(0), 1);
  assert.equal(emberWeight(260), 1);
  assert.ok(emberWeight(1000) > 0 && emberWeight(1000) < 1);
  assert.equal(emberWeight(1700), 0);
  assert.ok(Math.abs(craterPop(0) - 0.82) < 1e-9);
  assert.ok(Math.max(...Array.from({length: 14}, (_, i) => craterPop(i * 10))) > 1, 'a small overshoot');
  assert.equal(craterPop(140), 1);
  assert.deepEqual([...CRATER_KINDS].sort(), ['crack', 'scorch']);
});

test('the element layer draws scorch and crack marks as craters, with an additive ember for fire', () => {
  const source = fs.readFileSync('src/championship/presentation/vfx/elementVfxLayer.js', 'utf8');
  assert.match(source, /if \(CRATER_KINDS\.has\(kind\)\) return crater\(/);
  assert.match(source, /ember\.blendMode = 'add'/);
  assert.match(source, /\{raw: true\}/, 'crater pixels are not stepped again');
});

test('a Journey zone rival is drawn as the roster partner of its species', () => {
  const scene = fs.readFileSync('src/championship/presentation/dataArena/dataArenaPixiScene.js', 'utf8');
  assert.match(scene, /cast\.rivals\?\.find\(\(entry\) => entry\.rivalId === rival\.definitionId\) \?\? \(rosterMember \? \{ \.\.\.rosterMember, role: 'RIVAL' \} : null\)/);
});
