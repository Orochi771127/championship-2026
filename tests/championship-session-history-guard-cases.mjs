import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// The session history guard (main.js) keeps one extra history entry under the game so the phone's back
// button steps out of a screen instead of leaving the page. The settings panel owns the top entry while
// it is open ({ cmSettings: true }). A guard pushed over it (changing the language remounts the screen)
// copied that flag and outlived the panel's own back(), so "Scene music actual browser evidence" waited
// forever for the settings entry to go (2026-11-17).

const source = fs.readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
const body = source.match(/function ensureSessionHistoryGuard\(\) \{[\s\S]*?\n\}\n/);
assert.ok(body, 'ensureSessionHistoryGuard is a top-level function of main.js');

function run({ state = null, titleHidden = true, settingsOpen = false } = {}) {
  const pushed = [];
  const history = { state, pushState(next) { pushed.push(next); history.state = next; } };
  const context = vm.createContext({
    titleScreen: { hidden: titleHidden },
    window: { history },
    document: { querySelector: (selector) => (selector === 'dialog.cm-settings[open]' && settingsOpen ? {} : null) }
  });
  vm.runInContext(`${body[0]}\nensureSessionHistoryGuard();`, context);
  // The entries come from the VM's realm; read them back as plain data.
  return JSON.parse(JSON.stringify({ pushed, state: history.state }));
}

test('a game screen with no guard gets exactly one guard entry', () => {
  assert.deepEqual(run().pushed, [{ championshipSessionGuard: true }]);
  assert.deepEqual(run({ state: { championshipSessionGuard: true } }).pushed, [], 'never a second one');
  assert.deepEqual(run({ state: { other: 1 } }).pushed, [{ other: 1, championshipSessionGuard: true }], 'other state is kept');
});

test('nothing is pushed over the settings panel while it is open', () => {
  assert.deepEqual(run({ state: { cmSettings: true }, settingsOpen: true }).pushed, []);
});

test('a settings entry left behind by a reload is not copied into the guard', () => {
  const { pushed, state } = run({ state: { cmSettings: true } });
  assert.deepEqual(pushed, [{ championshipSessionGuard: true }]);
  assert.equal(state.cmSettings, undefined);
});

test('the title screen never takes a guard', () => {
  assert.deepEqual(run({ titleHidden: false }).pushed, []);
});

// Closing the settings panel takes back its own history entry with history.back(). That pop lands on
// the guard entry; only a pop that used the guard up is the player's Back.
const popBody = source.match(/function handleSessionPopState\(\) \{[\s\S]*?\n\}\n/);
assert.ok(popBody, 'handleSessionPopState is a top-level function of main.js');

function pop({ state, screen = 'TAMER_INFO', settingsOpen = false } = {}) {
  const calls = [];
  const context = vm.createContext({
    titleScreen: { hidden: true },
    window: { history: { state } },
    document: { querySelector: (selector) => (selector === 'dialog.cm-settings[open]' && settingsOpen ? {} : null) },
    isChoiceDialogOpen: () => false, dataArenaSession: null, expeditionSource: null,
    CHAMPIONSHIP_SCREENS: new Proxy({}, { get: (_, key) => key }),
    app: { getScreen: () => screen, leaveScreen: () => calls.push('leave') },
    ensureSessionHistoryGuard: () => calls.push('guard')
  });
  vm.runInContext(`${popBody[0]}\nhandleSessionPopState();`, context);
  return calls;
}

test('the settings panel taking back its entry is not a Back press', () => {
  assert.deepEqual(pop({ state: { championshipSessionGuard: true } }), [], 'the tamer profile stays open');
});

test('a pop that used up the guard leaves the screen and restores the guard', () => {
  assert.deepEqual(pop({ state: null }), ['leave', 'guard']);
  assert.deepEqual(pop({ state: null, screen: 'RAISING_HOME' }), ['guard'], 'the ranch only restores it');
  assert.deepEqual(pop({ state: null, settingsOpen: true }), [], 'the open settings panel handles its own Back');
});
