import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the entry owner's actual binding code without booting its DOM and
// renderer. The browser test covers its production call sites and real match.
const main = readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const binding = main.slice(main.indexOf('let battleRuntime = null;'), main.indexOf('/**\n * A tournament round'));
const runtime = () => ({ disposed: false, dispose() { this.disposed = true; } });
function fixture() {
  const previous = runtime();
  const context = vm.createContext({ previous, app: {
    getTamerRank: () => 9, getBattleBadges: () => [0, 7],
    getShopFrame: () => ({ listings: [{ shopRecordIndex: 1 }] })
  } });
  vm.runInContext(binding + '\nbattleRuntime=previous; battleAttemptId="old";\n'
    + 'this.enter=enterPreparedBattle; this.inspect=()=>({runtime:battleRuntime,id:battleAttemptId,progress:battleProgressBefore});', context);
  return { previous, context };
}

test('screen publication sees the chosen runtime before async entry resolves', async () => {
  const { previous, context } = fixture(), prepared = runtime();
  const result = await context.enter(prepared, 'battle:1', async () => {
    const visible = context.inspect();
    assert.equal(visible.runtime, prepared);
    assert.equal(visible.id, 'battle:1');
    assert.equal(visible.progress.rank, 9);
    assert.equal(previous.disposed, false);
    await Promise.resolve();
    return { ok: true };
  });
  assert.equal(result.ok, true);
  assert.equal(previous.disposed, true);
  assert.equal(prepared.disposed, false);
  assert.equal(context.inspect().runtime, prepared);
});

test('refused, duplicate and thrown entries retain the prior runtime and discard preparation', async () => {
  for (const outcome of [{ ok: false }, { ok: true, duplicate: true }, new Error('ENTRY_FAILED')]) {
    const { previous, context } = fixture(), prepared = runtime();
    const enter = () => context.enter(prepared, 'battle:1', async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    });
    if (outcome instanceof Error) await assert.rejects(enter, /ENTRY_FAILED/);
    else assert.equal(await enter(), outcome);
    assert.equal(context.inspect().runtime, previous);
    assert.equal(context.inspect().id, 'old');
    assert.equal(previous.disposed, false);
    assert.equal(prepared.disposed, true);
  }
});
