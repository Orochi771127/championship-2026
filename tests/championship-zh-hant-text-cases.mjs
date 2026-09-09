import assert from "node:assert/strict";
import test from "node:test";

import cages from "../src/data/championship/catalogs/cage-definitions.r1.json" with { type: "json" };
import gates from "../src/data/championship/catalogs/gate-table.r1.json" with { type: "json" };
import names from "../src/data/championship/catalogs/species-names.r1.json" with { type: "json" };
import help from "../src/data/championship/catalogs/help-text.r1.json" with { type: "json" };
import events from "../src/data/championship/catalogs/battle-title-event-strings.r1.json" with { type: "json" };
import { HELP_ZH, TITLE_EVENTS_ZH, SPECIES_NAMES_ZH } from "../src/championship/text/catalogs.zhHant.js";
import { uiText } from "../src/championship/text/uiText.js";
import { speciesName, speciesNameForId, helpText, titleEventText, raisingDisplayName, starterName } from "../src/championship/text/zhHant.js";
import { nativeIndividualName } from "../src/championship/hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../src/championship/hunt/capture/nativeHuntSources.js";
import {
  CAGE_NAMES,
  GATE_NAMES,
  STAT_LABELS,
  TEXT_EVIDENCE,
  cageEffectLabel,
  cageName,
  gateName
} from "../src/championship/text/zhHant.js";

test("the translation layer declares itself product-authored", () => {
  // It must never be citable as evidence of what the cartridge says.
  assert.equal(TEXT_EVIDENCE, "PRODUCT_AUTHORED");
});

test("it covers every cage and every gate the ROM catalogs hold", () => {
  for (const record of cages.records) {
    assert.ok(CAGE_NAMES[record.cageIndex], `cage ${record.cageIndex} has no Chinese name`);
  }
  for (const record of gates.records) {
    assert.ok(GATE_NAMES[record.recordIndex], `gate ${record.recordIndex} has no Chinese name`);
  }
  assert.equal(Object.keys(CAGE_NAMES).length, cages.recordCount);
  assert.equal(Object.keys(GATE_NAMES).length, gates.recordCount);
});

test("every cage effect the ROM classifies has a Chinese label", () => {
  for (const record of cages.records) {
    if (record.effect.kind === "NONE") continue;
    const label = cageEffectLabel(record.effect.kind, record.effect.target);
    assert.ok(label, `no label for ${record.effect.kind}:${record.effect.target}`);
  }
});

test("the stat labels follow the game's own stat order", () => {
  // The bank stores HP, TP, attack, defence, wisdom, speed at entries 35..40.
  assert.deepEqual(names.statNames, ["HP", "TP", "こうげき", "ぼうぎょ", "かしこさ", "すばやさ"]);
  assert.deepEqual(
    Object.keys(STAT_LABELS),
    ["HP", "TP", "ATTACK", "DEFENSE", "WISDOM", "SPEED"]
  );
});

test("an unknown key falls back to the cartridge's Japanese, never to a blank", () => {
  assert.equal(cageName(999, "ふた"), "ふた");
  assert.equal(gateName(999, "ダイナそうげん"), "ダイナそうげん");
  assert.equal(cageEffectLabel("MADE_UP", "NOTHING"), null);
});

test("the ROM catalogs keep their Japanese untouched", () => {
  // The translation is a layer, not a replacement. If these ever become Chinese,
  // the transcription has been overwritten and the evidence is gone.
  assert.equal(cages.records[0].name, "あきち");
  assert.equal(cages.records[1].name, "うんどうじょう");
  assert.equal(gates.records[0].displayName, "ダイナそうげん");
  assert.equal(cages.language, "ja");
  assert.equal(gates.language, "ja");
});

test("every regular species and egg has Chinese identity copy at its original index", () => {
  assert.equal(Object.keys(SPECIES_NAMES_ZH).length, names.records.length);
  for (const record of names.records) {
    assert.match(speciesName(record.recordIndex), /\p{Script=Han}/u);
    assert.doesNotMatch(speciesName(record.recordIndex), /[\p{Script=Katakana}\p{Script=Hiragana}]/u);
    assert.equal(speciesNameForId(`championship:creature:species-${record.recordIndex}`), speciesName(record.recordIndex));
  }
  for (let index = 0; index < 8; index++) assert.equal(speciesName(index), "數碼蛋");
  assert.equal(speciesName(999, "future catalog value"), "future catalog value");
});

test("all help entries preserve source order and heading/topic distinction", () => {
  assert.equal(HELP_ZH.length, help.records.length);
  for (const record of help.records) {
    const translated = HELP_ZH[record.entryIndex];
    assert.equal(translated.entryIndex, record.entryIndex);
    assert.match(helpText(record.entryIndex, "title"), /\p{Script=Han}/u);
    assert.equal(translated.body === null, record.kind === "heading");
    if (record.kind === "topic") assert.match(translated.body, /\p{Script=Han}/u);
    assert.doesNotMatch(translated.title + (translated.body ?? ""), /[\p{Script=Katakana}\p{Script=Hiragana}]/u);
  }
});

test("all 62 title-event names and descriptions are Chinese and keep record identity", () => {
  assert.equal(TITLE_EVENTS_ZH.length, events.records.length);
  for (const record of events.records) {
    assert.equal(TITLE_EVENTS_ZH[record.recordIndex].recordIndex, record.recordIndex);
    for (const field of ["name", "description"]) {
      const copy = titleEventText(record.recordIndex, field);
      assert.match(copy, /\p{Script=Han}/u);
      assert.doesNotMatch(copy, /[\p{Script=Katakana}\p{Script=Hiragana}]|\\n/u);
    }
  }
});

test("native starter variants have display aliases while player nicknames remain verbatim", () => {
  const base = nativeHuntSpeciesByIndex(0).baseName;
  for (let variant = 0; variant < 25; variant++) {
    const name = nativeIndividualName(base, variant);
    assert.match(starterName(name), /\p{Script=Han}/u);
    assert.equal(raisingDisplayName({ displayName: name, source: { kind: "COLLECTION" } }), name);
  }
  for (const name of ["HUNT", "Spring", "HP", "小火🔥", "<script>測試</script>", "亞古獸A"]) {
    const input = Object.freeze({ displayName: name, speciesId: "species-028", source: Object.freeze({ kind: "COLLECTION" }) });
    assert.equal(raisingDisplayName(input), name);
    assert.equal(input.displayName, name);
  }
});

test("dynamic copy translates amounts and errors without swallowing names or unknown values", () => {
  assert.equal(uiText("durability 120"), "耐久度 120");
  assert.equal(uiText("1,250 Bits"), "1,250 位元幣");
  assert.equal(uiText("Saved game found: HUNT."), "找到存檔：HUNT。");
  assert.equal(uiText("Release Spring?"), "要放生「Spring」嗎？");
  assert.equal(uiText("Could not start a new game: TECHNICAL_STACK"), "無法開始新遊戲，請重新載入後再試一次。");
  assert.equal(uiText("UNMAPPED_IDENTIFIER"), "UNMAPPED_IDENTIFIER");
  assert.equal(uiText(null), null);
  assert.equal(uiText(120), 120);
});
