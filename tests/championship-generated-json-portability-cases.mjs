import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const generatedJsonBuilders = [
  "scripts/build-cage-faithful-hd40.py",
  "scripts/build-hunt-faithful-hd30.py",
  "scripts/build-cage-hd-remaster.py",
  "scripts/build-hunt-hd-remaster.py",
];

test("hash-locked JSON builders force Git-canonical LF on every platform", () => {
  const attributes = fs.readFileSync(".gitattributes", "utf8");
  assert.match(attributes, /^\*\.json text eol=lf$/m);

  for (const builder of generatedJsonBuilders) {
    const source = fs.readFileSync(builder, "utf8");
    assert.match(
      source,
      /encoding="utf-8",\s*newline="\\n",/,
      `${builder} must prevent Windows newline translation before hashing generated JSON`,
    );
  }
});
