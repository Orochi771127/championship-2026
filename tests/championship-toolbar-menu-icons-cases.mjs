import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import manifest from '../src/data/championship/toolbar-menu-icons.r1.json' with { type: 'json' };
import runtime from '../src/data/championship/toolbar-menu-icons.runtime.r1.json' with { type: 'json' };
import selection from '../src/data/championship/public-ui-selection.v1.json' with { type: 'json' };
import { toolbarMenuEntryIcon } from '../src/championship/presentation/toolbarMenuIcons.js';
import { TOOLBAR_MENUS, TOOLBAR_PRODUCT_ENTRIES } from '../src/championship/app/championshipToolbar.js';

const baseUrl = 'http://127.0.0.1:8746/championship.html';
const entries = [...TOOLBAR_MENUS.flatMap(menu => menu.entries), ...Object.values(TOOLBAR_PRODUCT_ENTRIES).flat()];

test('all thirteen real menu entries resolve, including every action-only entry, without replacing the approved two', () => {
  assert.equal(entries.length, 13);
  assert.equal(manifest.entries.length, 11);
  assert.deepEqual(runtime, { schemaVersion: 1, entries: manifest.entries.map(({ entryId, src }) => ({ entryId, src })) });
  for (const entry of entries) {
    const icon = toolbarMenuEntryIcon(entry, baseUrl);
    assert.ok(icon?.src, entry.id);
    if (['database', 'medals'].includes(entry.id)) {
      assert.deepEqual(icon, selection.database.find(art => art.destination === entry.screen));
      assert.equal(manifest.entries.some(art => art.entryId === entry.id), false);
    } else assert.equal(icon.entryId, entry.id);
  }
  for (const entry of entries.filter(entry => entry.action)) assert.ok(toolbarMenuEntryIcon({ id: entry.id }, baseUrl));
  assert.equal(toolbarMenuEntryIcon({ id: 'unknown' }, baseUrl), null);
});

test('original vector assets are deterministic, hash-bound, self-contained, and below production UI', async () => {
  const unique = new Set();
  for (const icon of manifest.entries) {
    assert.match(icon.src, /^assets\/production\/ui\/menu-entry-original-20261024\/[a-zA-Z]+\.svg$/);
    const bytes = await readFile(new URL(`../${icon.src}`, import.meta.url));
    const svg = bytes.toString('utf8');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), icon.sha256);
    assert.equal(bytes.length, icon.bytes);
    assert.ok(bytes.length < 2000, icon.entryId);
    assert.match(svg, /viewBox="0 0 48 48"/);
    assert.doesNotMatch(svg, /<(?:script|image|text|foreignObject)|(?:href|url)\s*[=(]/i);
    unique.add(icon.sha256);
  }
  assert.equal(unique.size, 11);
  assert.equal(manifest.evidence, 'PRODUCT_AUTHORED');
});
