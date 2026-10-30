// Owner 2026-10-30: every Dex partner shows a height in metres and a "weight" as a digital data size.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {databaseBodyStats, formatBodyHeight, formatDataWeight} from '../src/championship/database/databaseBodyStats.js';
import {DATABASE_DISPLAY_CATALOG} from '../src/championship/database/databaseDisplayCatalog.js';
import {databaseVerifiedData} from '../src/championship/database/databaseStories.js';

test('every listed Dex partner has a height and a data-size weight, larger stages larger', () => {
  const rows = DATABASE_DISPLAY_CATALOG.entries.filter(e => e.contentStatus !== 'RETIRED' && /^(EG|B[12]|GR|MA|AW|UL)\d+$/.test(e.displayCode));
  assert.ok(rows.length >= 240);
  const median = prefix => { const v = rows.filter(e => e.displayCode.startsWith(prefix)).map(e => databaseBodyStats(e.speciesIndex).heightCm).sort((a, b) => a - b); return v[v.length >> 1]; };
  for (const e of rows) { const b = databaseBodyStats(e.speciesIndex); assert.ok(b && b.heightCm > 0 && b.weightKb > 0, e.displayCode); }
  assert.ok(median('GR') < median('MA') && median('MA') < median('AW') && median('AW') < median('UL'));
});

test('height reads in metres, weight in KB/MB/GB with three significant digits', () => {
  assert.equal(formatBodyHeight(34), '0.34 m'); assert.equal(formatBodyHeight(230), '2.3 m'); assert.equal(formatBodyHeight(1070), '10.7 m');
  assert.equal(formatDataWeight(315), '315 KB'); assert.equal(formatDataWeight(1024 * 34.1), '34.1 MB');
  assert.equal(formatDataWeight(1024 * 1024 * 2.1), '2.10 GB'); assert.equal(formatDataWeight(1024 * 396), '396 MB');
});

test('labels exist in all five locales and the Dex data block shows both tags', () => {
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    const labels = databaseVerifiedData(105, locale)?.labels; assert.ok(labels?.height && labels?.weight, locale);
  }
  const ui = fs.readFileSync(new URL('../src/championship/app/vs4Screens.js', import.meta.url), 'utf8');
  assert.match(ui, /const body = databaseBodyStats\(selected\.speciesIndex\);/);
  assert.match(ui, /\[\['height', formatBodyHeight\(body\.heightCm\)\], \['weight', formatDataWeight\(body\.weightKb\)\]\]/);
});
