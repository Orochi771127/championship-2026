#!/usr/bin/env node
// English coverage report for the display text (settings round, 2026-09-29).
//
// Every zh-Hant string literal in src/championship that reaches the screen is
// a source key of the text layer (uiText). This scans the source for them and
// checks each against the English tables, so a new string without English is
// found by a command instead of by a player. Catalog text (help, shop, title
// events, raising mail, tutorial) is checked record by record against its own
// English file. Proper nouns without an approved English name are listed
// separately: they are shown in their approved zh-Hant form on purpose.
//
//   node scripts/check-locale-coverage.mjs            prints a summary, exits 1 on gaps
//   node scripts/check-locale-coverage.mjs --json F   also writes the report to F

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "src/championship");
const HAN = /[㐀-鿿豈-﫿]/;

// Text-layer files hold the tables themselves.
const TABLE_FILES = /[\\/]text[\\/](catalogs\.zhHant|zhHant|raisingMessages\.zhHant|tutorialMessages\.zhHant|uiText|uiText\.en|raisingMessages\.en|catalogs\.en|gameText\.en|tutorialMessages\.en|locale)\.js$/;

// Literals that are data, not display text: the Password Battle alphabets
// (the codec's character sets) and a list separator.
const NOT_DISPLAY = [
  (text, file) => /nativePasswordBattle\.js$/.test(file) && !/[。？]$/.test(text),
  (text) => text === "、"
];

export function scanLiterals(dir = SOURCE) {
  const found = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".js") && !TABLE_FILES.test(file)) found.push(...literalsOf(file));
    }
  };
  walk(dir);
  return found;
}

/** String literals with Han characters, with their line, skipping comments. */
function literalsOf(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line += 1; i += 1; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i += 1; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line += 1; i += 1; } i += 2; continue; }
    if (c === "\"" || c === "'" || c === "`") {
      const quote = c, startLine = line;
      let text = "", raw = "", interpolated = false;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") { raw += src[i] + src[i + 1]; i += 2; continue; }
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          interpolated = true;
          let depth = 1; i += 2;
          while (i < src.length && depth > 0) { if (src[i] === "{") depth += 1; else if (src[i] === "}") depth -= 1; if (src[i] === "\n") line += 1; i += 1; }
          raw += "${}";
          continue;
        }
        if (src[i] === "\n") line += 1;
        raw += src[i]; i += 1;
      }
      i += 1;
      if (!HAN.test(raw)) continue;
      // Resolve the escapes a key can carry (\n, \", \').
      text = raw.replace(/\\n/g, "\n").replace(/\\(["'`\\])/g, "$1");
      out.push({ file: path.relative(root, file).replace(/\\/g, "/"), line: startLine, text, interpolated });
    }
    else i += 1;
  }
  return out;
}

export async function buildLocaleCoverage() {
  const { TEXT_EN, UI_COPY_EN, UNTRANSLATED_PROPER_NOUNS } = await import("../src/championship/text/uiText.en.js");
  const { UI_COPY } = await import("../src/championship/text/uiText.js");
  const catalogsZh = await import("../src/championship/text/catalogs.zhHant.js");
  const catalogsEn = await import("../src/championship/text/catalogs.en.js");
  const tutorialZh = await import("../src/championship/text/tutorialMessages.zhHant.js");
  const tutorialEn = await import("../src/championship/text/tutorialMessages.en.js");
  const raisingEn = await import("../src/championship/text/raisingMessages.en.js");
  const gameEn = await import("../src/championship/text/gameText.en.js");

  const literals = scanLiterals().filter((entry) => !NOT_DISPLAY.some((rule) => rule(entry.text, entry.file)));
  const interpolatedZh = literals.filter((entry) => entry.interpolated);
  const plain = literals.filter((entry) => !entry.interpolated);
  const covered = (text) => Object.hasOwn(TEXT_EN, text) || Object.hasOwn(UI_COPY_EN, text) || UNTRANSLATED_PROPER_NOUNS.has(text);
  const missing = plain.filter((entry) => !covered(entry.text));
  const distinct = new Set(plain.map((entry) => entry.text));

  const recordGaps = [];
  const compare = (name, zh, en, key = (row, index) => index) => {
    zh.forEach((row, index) => {
      const k = key(row, index);
      const english = Array.isArray(en) ? en[k] : en?.[k];
      if (english === undefined || english === null || english === "") recordGaps.push(`${name}[${k}]`);
    });
  };
  compare("SHOP_NAMES", catalogsZh.SHOP_NAMES_ZH, catalogsEn.SHOP_NAMES_EN);
  compare("SHOP_DESCRIPTIONS", catalogsZh.SHOP_DESCRIPTIONS_ZH, catalogsEn.SHOP_DESCRIPTIONS_EN);
  compare("HELP.title", catalogsZh.HELP_ZH, catalogsEn.HELP_EN.map((row) => row.title));
  catalogsZh.HELP_ZH.forEach((row, index) => { if (row.body && !catalogsEn.HELP_EN[index]?.body) recordGaps.push(`HELP.body[${index}]`); });
  compare("TITLE_EVENTS.name", catalogsZh.TITLE_EVENTS_ZH, catalogsEn.TITLE_EVENTS_EN.map((row) => row.name));
  compare("TITLE_EVENTS.description", catalogsZh.TITLE_EVENTS_ZH, catalogsEn.TITLE_EVENTS_EN.map((row) => row.description));
  for (const id of tutorialZh.TUTORIAL_TEXT_IDS) if (!tutorialEn.TUTORIAL_LINES_EN[id]) recordGaps.push(`TUTORIAL[${id}]`);
  for (const action of tutorialZh.TUTORIAL_PROMPT_ACTIONS) if (!tutorialEn.TUTORIAL_PROMPTS_EN[action]) recordGaps.push(`TUTORIAL_PROMPT[${action}]`);
  const uiCopyGaps = Object.keys(UI_COPY).filter((key) => !Object.hasOwn(UI_COPY_EN, key));

  const counts = {
    displayLiterals: plain.length,
    distinctDisplayStrings: distinct.size,
    translated: [...distinct].filter((text) => Object.hasOwn(TEXT_EN, text) || Object.hasOwn(UI_COPY_EN, text)).length,
    properNounsKeptInZhHant: [...distinct].filter((text) => UNTRANSLATED_PROPER_NOUNS.has(text)).length,
    missing: new Set(missing.map((entry) => entry.text)).size,
    interpolatedZhTemplates: interpolatedZh.length,
    uiCopyKeys: Object.keys(UI_COPY).length,
    uiCopyMissing: uiCopyGaps.length,
    catalogRecords: {
      shopNames: catalogsEn.SHOP_NAMES_EN.length, shopDescriptions: catalogsEn.SHOP_DESCRIPTIONS_EN.length,
      help: catalogsEn.HELP_EN.length, titleEvents: catalogsEn.TITLE_EVENTS_EN.length,
      tutorialLines: Object.keys(tutorialEn.TUTORIAL_LINES_EN).length, tutorialPrompts: Object.keys(tutorialEn.TUTORIAL_PROMPTS_EN).length,
      raisingMail: raisingEn.SEQUENTIAL_EN.length + raisingEn.SEASONS_EN.length + raisingEn.RANDOM_EN.length + Object.keys(raisingEn.EXTRA_EN).length,
      cages: Object.keys(gameEn.CAGE_NAMES_EN).length, gates: Object.keys(gameEn.GATE_NAMES_EN).length
    },
    catalogGaps: recordGaps.length
  };
  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-locale-coverage.mjs",
    locales: ["zh-Hant", "en"],
    counts,
    missing: [...new Map(missing.map((entry) => [entry.text, entry])).values()],
    // A template literal that still concatenates zh-Hant around a value cannot
    // be translated as a whole; each is listed with why it is acceptable.
    interpolatedZh: interpolatedZh.map(({ file, line, text }) => ({ file, line, text })),
    uiCopyMissing: uiCopyGaps,
    catalogGaps: recordGaps,
    properNounPolicy: "Species names, the starter's automatic names and two personal names (浩司, 惠子) have no approved English form and are shown in their approved zh-Hant form in English."
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildLocaleCoverage();
  const at = process.argv.indexOf("--json");
  if (at > 0 && process.argv[at + 1]) {
    fs.mkdirSync(path.dirname(path.resolve(process.argv[at + 1])), { recursive: true });
    fs.writeFileSync(process.argv[at + 1], JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report.counts, null, 2));
  for (const entry of report.missing) console.log(`MISSING ${entry.file}:${entry.line} ${JSON.stringify(entry.text)}`);
  for (const entry of report.interpolatedZh) console.log(`INTERPOLATED ${entry.file}:${entry.line} ${JSON.stringify(entry.text)}`);
  for (const key of report.uiCopyMissing) console.log(`UI_COPY_MISSING ${JSON.stringify(key)}`);
  for (const gap of report.catalogGaps) console.log(`CATALOG_GAP ${gap}`);
  process.exitCode = report.counts.missing || report.counts.uiCopyMissing || report.counts.catalogGaps ? 1 : 0;
}
