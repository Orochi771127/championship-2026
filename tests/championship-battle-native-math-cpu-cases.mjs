import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { battleVectorQ12, battleAngleQ12, battleAngleIndex } from '../src/championship/battle/battleNativeMath.js';
const cpu = JSON.parse(fs.readFileSync('docs/research/BATTLE_NATIVE_MATH_CPU_2026-09-07.json', 'utf8'));

test('integer trigonometry agrees with ARM9 for every angle in attack and reverse directions', () => {
  cpu.unitVectors.forEach((expected, i) => assert.deepEqual(battleVectorQ12(cpu.firstAngle + i, 4096), expected, `angle ${cpu.firstAngle + i}`));
  for (const [angle, length, expected] of cpu.scaledVectors) assert.deepEqual(battleVectorQ12(angle, length), expected, `${angle} / ${length}`);
});

test('Q12 and turn-index direction helpers preserve CPU quadrants and lookup transitions', () => {
  for (const [y, x, q12, index] of cpu.angles) {
    assert.equal(battleAngleQ12(y, x), q12, `Q12 ${y},${x}`);
    assert.equal(battleAngleIndex(y, x), index, `index ${y},${x}`);
  }
});
