import assert from "node:assert/strict";
import test from "node:test";

import titleEvents from "../src/data/championship/catalogs/battle-title-events.r1.json" with { type: "json" };
import titleStrings from "../src/data/championship/catalogs/battle-title-event-strings.r1.json" with { type: "json" };
import {
  TITLE_EVENT_SCAN_LIMIT,
  TITLE_EVENT_UNLOCK_COUNTER_EVIDENCE,
  TITLE_EVENT_UNSCANNED_INDEX,
  tamerRankRequiredFor,
  scanTitleEventsForToday,
  titleEventAt,
  titleEventCalendar,
  titleEventYearGrid
} from "../src/championship/battle/titleEventSchedule.js";

// Spelled by code point so an invisible control character cannot be stripped out
// of this file and quietly turn the escape checks into `includes("")`.
const ESCAPE = String.fromCharCode(27);

test("the scan bound is the ROM's 0x3D, so record 61 is outside it", () => {
  assert.equal(TITLE_EVENT_SCAN_LIMIT, 0x3d);
  assert.equal(TITLE_EVENT_UNSCANNED_INDEX, 61);
  assert.equal(titleEvents.records.length, 62);
  // The excluded record is the tutorial match, which is why it is not a fixture.
  assert.equal(titleStrings.records[61].name, "チュートリアルマッチ");
  assert.equal(titleEventAt(61).scannedByGame, false);
  assert.equal(titleEventAt(60).scannedByGame, true);
});

test("the string blocks are the two columns the table points at", () => {
  assert.equal(titleStrings.records.length, 62);
  for (const record of titleEvents.records) {
    const strings = titleStrings.records[record.recordIndex];
    assert.equal(record.field00, strings.nameStringIndex);
    assert.equal(record.field04, strings.descriptionStringIndex);
    assert.equal(record.field04 - record.field00, 62);
  }
});

test("every name is real text, with no markup and no blanks", () => {
  for (const record of titleStrings.records) {
    assert.ok(record.name.length > 0, `record ${record.recordIndex} has an empty name`);
    assert.ok(!record.name.includes(ESCAPE), `record ${record.recordIndex} name carries an escape`);
    assert.ok(!record.name.includes("\\n"), `record ${record.recordIndex} name carries a line break`);
  }
});

test("descriptions carry real line breaks, not the bank's two-character escape", () => {
  // The bank writes a break as backslash-n. If the builder stops converting it,
  // the board renders the escape as visible text -- which it did once.
  const literalBreak = String.fromCharCode(92) + "n";
  const newline = String.fromCharCode(10);
  let withBreaks = 0;
  for (const record of titleStrings.records) {
    assert.ok(
      !record.description.includes(literalBreak),
      `record ${record.recordIndex} still carries an unconverted line break`
    );
    assert.ok(!record.description.includes(ESCAPE), `record ${record.recordIndex} still carries a style escape`);
    if (record.description.includes(newline)) withBreaks += 1;
    // The raw form is kept alongside, so the conversion stays checkable.
    assert.ok(record.descriptionRaw.length > 0);
  }
  assert.equal(withBreaks, 62, "every blurb in this table is multi-line");
});

test("the year grid places all 61 scanned records exactly once", () => {
  const grid = titleEventYearGrid();
  const seen = new Set();
  let total = 0;
  for (const season of grid) {
    for (const day of season) {
      for (const event of day) {
        assert.ok(!seen.has(event.recordIndex), `record ${event.recordIndex} appears twice`);
        seen.add(event.recordIndex);
        total += 1;
      }
    }
  }
  assert.equal(total, TITLE_EVENT_SCAN_LIMIT);
  assert.equal(seen.size, TITLE_EVENT_SCAN_LIMIT);
  assert.ok(!seen.has(61), "the unscanned record must not appear on the calendar");
});

test("the calendar matches on the two traced date columns and nothing else", () => {
  for (let season = 0; season < 4; season += 1) {
    for (let day = 0; day < 8; day += 1) {
      const expected = titleEvents.records
        .filter((record) => record.recordIndex < TITLE_EVENT_SCAN_LIMIT)
        .filter((record) => record.field14 === season && record.field18 === day)
        .map((record) => record.recordIndex);
      assert.deepEqual([...titleEventCalendar(season, day)], expected);
    }
  }
});

test("the unlock gate is field10 against HALF the counter", () => {
  // Find a day carrying a record with a non-zero threshold.
  const gated = titleEvents.records.find(
    (record) => record.recordIndex < TITLE_EVENT_SCAN_LIMIT && record.field10 > 0
  );
  const query = { season: gated.field14, dayOfSeason: gated.field18, capacity: 16 };

  // counter >> 1 must reach field10, so counter = 2 * field10 is the first pass.
  const justShort = scanTitleEventsForToday({ ...query, unlockCounter: gated.field10 * 2 - 1 });
  const justEnough = scanTitleEventsForToday({ ...query, unlockCounter: gated.field10 * 2 });
  assert.ok(!justShort.indices.includes(gated.recordIndex));
  assert.ok(justEnough.indices.includes(gated.recordIndex));
});

test("a full output stops asking, and the count is the number written", () => {
  // Season 2 day 1 carries four fixtures, the busiest day in the table.
  const open = { season: 2, dayOfSeason: 1, unlockCounter: 999 };
  const all = scanTitleEventsForToday({ ...open, capacity: 16 });
  assert.equal(all.indices.length, 4);
  assert.equal(all.count, 4);

  const capped = scanTitleEventsForToday({ ...open, capacity: 2 });
  assert.equal(capped.indices.length, 2, "only capacity many are stored");
  // BHS at 0x02089268 branches past the match test, so once full the routine
  // never evaluates the predicate again. It therefore CANNOT know that four
  // records would have matched -- r0 is r3, the number written, and nothing else.
  assert.equal(capped.count, 2, "the ROM returns what it wrote, not what it skipped");
  assert.equal(capped.count, capped.indices.length);
  // The stored ones are the FIRST two by record index, not the last.
  assert.deepEqual([...capped.indices], [...all.indices].slice(0, 2));

  // No field may reappear claiming a total the routine never computes.
  assert.ok(!("matched" in capped), "a match total is not something the ROM has");
  assert.ok(!("truncated" in capped), "truncation is not something the ROM reports");
});

test("a zero counter still admits every ungated fixture", () => {
  const grid = titleEventYearGrid();
  for (let season = 0; season < 4; season += 1) {
    for (let day = 0; day < 8; day += 1) {
      const ungated = grid[season][day].filter((event) => event.unlockThreshold === 0);
      const scan = scanTitleEventsForToday({
        season, dayOfSeason: day, unlockCounter: 0, capacity: 16
      });
      assert.deepEqual([...scan.indices], ungated.map((event) => event.recordIndex));
    }
  }
});

test("the gate counter is the tamer rank, and the tier arithmetic fits exactly", () => {
  // The rank table at ARM9 0x020E1E18 holds exactly ten ranks, so rank >> 1 spans
  // 0..4 -- which is exactly the set field10 takes. That fit is why this is named
  // rather than left unknown. OVL8 0210E46C now has a CPU-verified writer.
  assert.equal(TITLE_EVENT_UNLOCK_COUNTER_EVIDENCE, "ROM_VERIFIED");
  const tiers = new Set([0,1,2,3,4,5,6,7,8,9].map((rank) => rank >>> 1));
  const thresholds = new Set(titleEvents.records.map((record) => record.field10));
  assert.deepEqual([...thresholds].sort(), [...tiers].sort());
  assert.equal(tamerRankRequiredFor(3), 6);
  assert.equal(tamerRankRequiredFor(0), 0);
});

test("bad queries are refused rather than coerced", () => {
  const good = { season: 0, dayOfSeason: 0, unlockCounter: 0, capacity: 4 };
  assert.throws(() => scanTitleEventsForToday({ ...good, season: 1.5 }), /season/);
  assert.throws(() => scanTitleEventsForToday({ ...good, dayOfSeason: null }), /dayOfSeason/);
  assert.throws(() => scanTitleEventsForToday({ ...good, unlockCounter: -1 }), /unlockCounter/);
  assert.throws(() => scanTitleEventsForToday({ ...good, capacity: -1 }), /capacity/);
});

test("an out-of-range record index returns null instead of throwing", () => {
  assert.equal(titleEventAt(999), null);
  assert.equal(titleEventAt(-1), null);
});
