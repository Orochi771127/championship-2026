import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDesktopOfflineLocation,
  isOriginalLoopbackLocation,
  isOriginalRuntimeLocation
} from '../src/championship/presentation/originalRuntimeLocation.js';
import {
  DESKTOP_SAVE_ENVELOPE_SCHEMA,
  createDesktopFileSaveAdapter,
  deserializeDesktopSaveEnvelope,
  detectDesktopSaveBridge,
  serializeDesktopSaveEnvelope
} from '../src/championship/app/desktopFileSaveAdapter.js';
import {
  CHAMPIONSHIP_PREFERENCES_KEY,
  createChampionshipPreferencePort
} from '../src/championship/app/ChampionshipPersistentSavePort.js';
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from '../src/championship/app/championshipStandaloneSave.js';

test('desktop offline runtime protocols (Tauri & Electron) are admitted while untrusted web/file origins stay blocked', () => {
  for (const allowed of [
    'tauri://localhost/championship.html',
    'https://tauri.localhost/championship.html',
    'http://tauri.localhost/championship.html',
    'app://cyber-partner/championship.html',
    'championship://local/championship.html'
  ]) {
    assert.equal(isDesktopOfflineLocation(allowed), true, allowed);
    assert.equal(isOriginalRuntimeLocation(allowed), true, allowed);
    assert.equal(isOriginalLoopbackLocation(allowed), false, `${allowed} does not claim HTTP loopback`);
  }

  for (const blocked of [
    'file:///C:/championship.html',
    'https://evil.example.com/championship.html',
    'tauri://evil.example.com/championship.html',
    'app://user:pass@cyber-partner/championship.html',
    'javascript:alert(1)'
  ]) {
    assert.equal(isDesktopOfflineLocation(blocked), false, blocked);
    assert.equal(isOriginalRuntimeLocation(blocked), false, blocked);
  }
});

test('desktopFileSaveAdapter hydrates, flushes Steam Cloud JSON envelope, and plugs into ChampionshipPreferencePort', async () => {
  let diskFile = null;
  let writeCount = 0;
  const bridge = {
    readText: async () => diskFile,
    writeText: async (_name, text) => { writeCount++; diskFile = text; }
  };

  const adapter1 = createDesktopFileSaveAdapter({ ...bridge, now: () => 1764140000000, appVersion: '1.0.0-steam' });
  const init = await adapter1.hydrate();
  assert.deepEqual(init, { hydrated: true, keyCount: 0 });

  const prefPort = createChampionshipPreferencePort({ storage: adapter1 });
  const prefJson = JSON.stringify({ schemaVersion: 1, account: { locale: 'zh-Hant' }, device: { quality: 'high' } });
  assert.equal(prefPort.write(prefJson).ok, true);
  adapter1.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, '{"demo":1}');
  await adapter1.flush();

  assert.equal(writeCount, 1, 'bursty synchronous writes coalesce into a single atomic disk write');
  assert.ok(typeof diskFile === 'string');
  const parsed = deserializeDesktopSaveEnvelope(diskFile);
  assert.equal(parsed.schema, DESKTOP_SAVE_ENVELOPE_SCHEMA);
  assert.equal(parsed.appVersion, '1.0.0-steam');
  assert.equal(parsed.entries.get(CHAMPIONSHIP_PREFERENCES_KEY), prefJson);
  assert.equal(parsed.entries.get(CHAMPIONSHIP_MODERN_SAVE_KEY), '{"demo":1}');

  // Disallowed arbitrary keys are rejected by the existing storage guard.
  assert.throws(() => adapter1.setItem('unregistered:key', 'x'));
  assert.throws(() => serializeDesktopSaveEnvelope({ 'unregistered:key': 'x' }));

  // Re-hydrating a fresh adapter restores exact state from the disk envelope.
  const adapter2 = createDesktopFileSaveAdapter(bridge);
  const restored = await adapter2.hydrate();
  assert.deepEqual(restored, { hydrated: true, keyCount: 2 });
  assert.equal(adapter2.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), '{"demo":1}');
  assert.equal(createChampionshipPreferencePort({ storage: adapter2 }).read().text, prefJson);
});

test('desktopFileSaveAdapter schedules one trailing flush when a new write arrives mid-flush', async () => {
  const snapshots = [];
  let releaseFirst = null;
  let calls = 0;
  const adapter = createDesktopFileSaveAdapter({
    writeText: async (_name, text) => {
      calls++;
      if (calls === 1) {
        await new Promise((resolve) => { releaseFirst = resolve; });
      }
      snapshots.push(deserializeDesktopSaveEnvelope(text).entries.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    }
  });

  adapter.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, '{"step":1}');
  // Let microtask start the first in-flight disk write.
  await Promise.resolve();
  adapter.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, '{"step":2}');
  adapter.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, '{"step":3}');
  releaseFirst();
  await adapter.flush();

  assert.equal(calls, 2, 'first in-flight write + one coalesced trailing write for steps 2 & 3');
  assert.deepEqual(snapshots, ['{"step":1}', '{"step":3}']);
});

test('detectDesktopSaveBridge recognizes Tauri v2 and Electron preload bridges', async () => {
  assert.equal(detectDesktopSaveBridge({}), null);

  const calls = [];
  const tauriBridge = detectDesktopSaveBridge({
    __TAURI__: { core: { invoke: async (cmd, payload) => { calls.push([cmd, payload]); return 'ok'; } } }
  });
  assert.equal(tauriBridge.runtime, 'tauri');
  assert.equal(await tauriBridge.readText('save.json'), 'ok');
  await tauriBridge.writeText('save.json', '{}');
  assert.deepEqual(calls, [
    ['championship_read_save', { filename: 'save.json' }],
    ['championship_write_save', { filename: 'save.json', content: '{}' }]
  ]);

  const electronBridge = detectDesktopSaveBridge({
    championshipDesktopSave: { readText: async () => 'e-ok', writeText: async () => {} }
  });
  assert.equal(electronBridge.runtime, 'electron');
  assert.equal(await electronBridge.readText('save.json'), 'e-ok');
});
