import assert from "node:assert/strict";
import test from "node:test";

import helpCatalog from "../src/data/championship/catalogs/help-text.r1.json" with { type: "json" };

// Spelled by code point so an invisible control character cannot be stripped out
// of this file and quietly turn the escape checks into `includes("")`.
const ESCAPE = String.fromCharCode(27);
const LITERAL_LINE_BREAK = String.fromCharCode(92) + "n";
const NEWLINE = String.fromCharCode(10);

test("the bank splits into two equal blocks of 84", () => {
  assert.equal(helpCatalog.source.entryCount, 168);
  assert.equal(helpCatalog.recordCount, 84);
  assert.equal(helpCatalog.split.titles.count, 84);
  assert.equal(helpCatalog.split.bodies.count, 84);
  assert.equal(helpCatalog.split.bodies.start, 84);
  for (const record of helpCatalog.records) {
    assert.equal(record.bodyStringIndex - record.titleStringIndex, 84);
    assert.equal(record.titleStringIndex, record.entryIndex);
  }
});

test("entry 96 is the day-length text, which is what fixes the offset", () => {
  // This project already cited help entry 96 for the clock cascade. Under the
  // 84-offset split it must land on the TIME title. If it stops doing so, the
  // split has moved and every index in this catalog is wrong.
  const time = helpCatalog.records.find((record) => record.bodyStringIndex === 96);
  assert.ok(time, "no record carries body string 96");
  assert.equal(time.entryIndex, 12);
  assert.equal(time.title, "じかん");
  assert.equal(time.kind, "topic");
  // The cascade the status bar and the schedule both run on.
  assert.match(time.body, /8/);
  assert.match(time.body, /4/);
  assert.match(time.body, /10/);
});

test("headings are the entries whose body is n/a, and they carry no body", () => {
  const headings = helpCatalog.records.filter((record) => record.kind === "heading");
  const topics = helpCatalog.records.filter((record) => record.kind === "topic");
  assert.equal(headings.length, 16);
  assert.equal(topics.length, 68);
  assert.equal(headings.length + topics.length, 84);
  assert.equal(helpCatalog.headingCount, 16);
  assert.equal(helpCatalog.topicCount, 68);
  for (const heading of headings) {
    assert.equal(heading.body, null, `heading ${heading.entryIndex} must carry no body`);
    assert.equal(heading.bodyRaw, null);
  }
  for (const topic of topics) {
    assert.ok(topic.body && topic.body.length > 0, `topic ${topic.entryIndex} has an empty body`);
  }
});

test("no title or body carries unconverted markup", () => {
  for (const record of helpCatalog.records) {
    assert.ok(record.title.length > 0, `entry ${record.entryIndex} has an empty title`);
    assert.ok(!record.title.includes(ESCAPE), `title ${record.entryIndex} carries a style escape`);
    assert.ok(!record.title.includes(LITERAL_LINE_BREAK), `title ${record.entryIndex} carries a raw break`);
    if (record.kind !== "topic") continue;
    assert.ok(
      !record.body.includes(LITERAL_LINE_BREAK),
      `body ${record.entryIndex} still carries the two-character line break`
    );
    assert.ok(!record.body.includes(ESCAPE), `body ${record.entryIndex} still carries a style escape`);
  }
});

test("multi-line bodies survive as real line breaks", () => {
  const multiline = helpCatalog.records.filter(
    (record) => record.kind === "topic" && record.body.includes(NEWLINE)
  );
  // Most help topics are several sentences; a catalog where none broke would mean
  // the conversion silently dropped them.
  assert.ok(multiline.length > 50, `only ${multiline.length} topics carry a line break`);
});

test("the untraced grouping is declared, not guessed", () => {
  assert.equal(helpCatalog.groupingEvidence, "UNKNOWN_REQUIRES_TRACE");
  // No record may claim a parent while the grouping is untraced.
  for (const record of helpCatalog.records) {
    assert.ok(!("parentIndex" in record), `entry ${record.entryIndex} asserts a parent`);
    assert.ok(!("sectionIndex" in record), `entry ${record.entryIndex} asserts a section`);
  }
});

test("the catalog declares its cartridge source and language", () => {
  assert.equal(helpCatalog.sourceEvidence, "ROM_VERIFIED");
  assert.equal(helpCatalog.language, "ja");
  assert.equal(helpCatalog.source.file, "nitrofs/ui/txt/help_text_txt.dat");
  assert.match(helpCatalog.source.sha256, /^[0-9a-f]{64}$/);
});

test("the ROM's own entry order is preserved", () => {
  helpCatalog.records.forEach((record, index) => {
    assert.equal(record.entryIndex, index, "records must stay in cartridge order");
  });
  // The first entry is the top-level HUNT heading, which is where the bank starts.
  assert.equal(helpCatalog.records[0].title, "ハント");
  assert.equal(helpCatalog.records[0].kind, "heading");
});
