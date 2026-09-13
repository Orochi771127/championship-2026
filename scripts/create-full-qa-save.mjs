import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY, deserializeChampionshipModernSave }
  from "../src/championship/app/championshipStandaloneSave.js";
import { BITS_WALLET_CAP, SHOP_RECORD_COUNT } from "../src/championship/shop/shopCatalog.js";
import { FULL_QA_ULTIMATES, createFullQaSaveText } from "./lib/championshipFullQaSave.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "qa/championship-full-qa-save.json");
const check = process.argv.includes("--check");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key)
};
const catalog = readJson("src/data/championship/catalogs/creature-species.r1.json");
const cages = readJson("docs/contracts/championship/raising-home-presentation.v1.json").cages;
const app = createChampionshipStandaloneApp({
  storage,
  locks: null,
  catalog,
  cages,
  rngClock: () => ({ hour: 12, minute: 34, second: 56 }),
  now: () => "2026-09-13T00:00:00.000Z"
});

try {
  await app.newGame();
  const status = app.save();
  if (status.phase !== "SAVED") throw new Error(`FULL_QA_BASE_SAVE_FAILED: ${status.error ?? status.phase}`);
  const base = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const text = createFullQaSaveText(base, { cageIds: cages.map((entry) => entry.cageId) });
  const save = deserializeChampionshipModernSave(text);
  const rendered = `${text}\n`;

  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== rendered) {
      throw new Error("FULL_QA_SAVE_STALE: run npm run qa:full-save:build");
    }
  } else {
    fs.writeFileSync(output, rendered, "utf8");
  }

  console.log(JSON.stringify({
    mode: check ? "check" : "build",
    output: path.relative(root, output).replaceAll("\\", "/"),
    bytes: Buffer.byteLength(text),
    bits: save.shop.bits,
    shopListings: SHOP_RECORD_COUNT,
    registeredSpecies: save.progression.registeredSpecies.length,
    ultimateResidents: FULL_QA_ULTIMATES.map((entry) => ({
      speciesIndex: entry.speciesIndex,
      displayName: entry.displayName
    }))
  }));
} finally {
  await app.dispose();
}
