// HUNT_SPAWN_SPREAD_20261110 (Owner): loose same-species groups and a third of a screen between groups --
// positions only, after the native entry and without its RNG. Finding them is still the player's job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listChampionshipGates } from '../src/championship/gate/gateCatalog.js';
import { prepareNativeHuntEntry } from '../src/championship/hunt/capture/nativeHuntEntryTransaction.js';
import { createNativeHuntPersistentState } from '../src/championship/hunt/capture/nativeHuntPersistentState.js';
import { resolveProductHuntPoolSources } from '../src/championship/hunt/capture/nativeHuntSources.js';
import { createChannelRng } from '../src/championship/battle/battleRngChannel.js';
import { spreadHuntActors, HUNT_SPAWN_SPREAD } from '../src/championship/hunt/capture/productHuntSpawnSpread.js';

const px = actor => [actor.positionQ12[0] / 4096, actor.positionQ12[1] / 4096];

test('every gate: nobody stacked, groups a third of a screen apart, no blocked or dock spawns', () => {
  for (const gate of listChampionshipGates()) for (let k = 0; k < 12; k++) {
    const rng = createChannelRng(0x77 + k * 104729);
    const entry = prepareNativeHuntEntry({ biomeId: gate.biomeId, clock: { clockMinutes: (k % 2 ? 13 : 22) * 60, season: k % 4 },
      rngSnapshot: { version: 1, ...rng.snapshot() }, persistentState: createNativeHuntPersistentState(), resolvePool: resolveProductHuntPoolSources });
    const env = entry.scene.environment, before = entry.encounter.actors, rngBefore = entry.rng.snapshot();
    const after = spreadHuntActors(before, env);
    assert.deepEqual(entry.rng.snapshot(), rngBefore, 'the native RNG is never read');
    assert.deepEqual(spreadHuntActors(before, env), after, 'the same entry always spreads the same');
    assert.equal(after.length, before.length);
    after.forEach((actor, i) => {
      const { positionQ12, ...rest } = actor, { positionQ12: _, ...native } = before[i];
      assert.deepEqual(rest, native, 'only positions change');
      const [x, y] = px(actor);
      assert.equal(env.isBlocked(Math.floor(x / 8), Math.floor(y / 8)), false, `${gate.biomeId} open ground`);
      assert.ok(y < (env.height - HUNT_SPAWN_SPREAD.bottomMarginTiles) * 8, `${gate.biomeId} above the dock band`);
    });
    const points = after.map(px);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
      const sameSpecies = after[i].speciesIndex === after[j].speciesIndex;
      assert.ok(d >= (sameSpecies ? HUNT_SPAWN_SPREAD.memberGap - 1 : 32), `${gate.biomeId} #${k}: ${i}/${j} ${d.toFixed(0)} px apart`);
    }
    // Groups: the nearest partner of another species is at least three quarters of the gap away.
    for (let i = 0; i < points.length; i++) {
      const other = points.filter((_, j) => j !== i && after[j].speciesIndex !== after[i].speciesIndex)
        .reduce((d, q) => Math.min(d, Math.hypot(points[i][0] - q[0], points[i][1] - q[1])), Infinity);
      assert.ok(other >= HUNT_SPAWN_SPREAD.minGap * 0.75 - 1, `${gate.biomeId} #${k}: ${other.toFixed(0)} px to another species`);
    }
  }
});

test('a field with no standing room keeps the native positions', () => {
  const actors = [{ speciesIndex: 1, positionQ12: [4096, 4096, 0], individual: { fields: {} } }];
  assert.equal(spreadHuntActors(actors, { width: 128, height: 128, isBlocked: () => true }), actors);
});

test('the app spreads normal entries only, after the instincts and without the native RNG', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync('src/championship/app/championshipStandaloneApp.js', 'utf8');
  assert.match(app, /const entry = rolled && huntCaptureReplay === null && huntSpawnSpread \? \{ \.\.\.rolled, encounter: \{ \.\.\.rolled\.encounter,\s+actors: spreadHuntActors\(rolled\.encounter\.actors, rolled\.scene\.environment\) \} \} : rolled;/);
});
