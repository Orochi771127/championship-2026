import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function walk(relative) {
  const start = path.join(root, relative);
  if (!fs.existsSync(start)) return [];
  const output = [];
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const item = path.join(start, entry.name);
    if (entry.isDirectory()) output.push(...walk(path.relative(root, item)));
    else output.push(item);
  }
  return output;
}

function codeFiles(relative) {
  return walk(relative).filter((file) => /\.(?:js|mjs|cjs|json|html|css)$/.test(file));
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function sourceText() {
  return codeFiles("src").map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
}

test("runtime has no external repository, Nexus namespace, CDN, or research import", () => {
  const offenders = [];
  for (const { file, text } of [...sourceText(), { file: path.join(root, "championship.html"), text: fs.readFileSync("championship.html", "utf8") }]) {
    if (/R:[\\/]|NexusLink|NEXUS_|nexus:|https?:\/\/|(?:from|import\s*\()[^\n]*research[\\/]/i.test(text)) offenders.push(relative(file));
  }
  assert.deepEqual(offenders, []);
});
test("only the bounded VS1 source family is present", () => {
  const forbidden = ["arena", "battle", "capture", "encounter", "gate", "heartlake", "hunt", "shop"];
  const present = forbidden.filter((name) => fs.existsSync(path.join(root, "src/championship", name)));
  assert.deepEqual(present, []);
});

test("all runtime asset declarations resolve below assets/production", () => {
  const contract = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
  const paths = [
    contract.habitat.image,
    contract.habitat.source,
    ...Object.values(contract.idle.species).map((entry) => entry.sheet),
    ...Object.values(contract.reaction.species).map((entry) => entry.sheet),
    ...Object.values(contract.portrait.species)
  ];
  assert.equal(paths.length, 11);
  for (const asset of paths) {
    assert.match(asset, /^assets\/production\//);
    assert.equal(fs.existsSync(path.join(root, asset)), true, asset);
  }
  const outside = walk("assets").filter((file) => !relative(file).startsWith("assets/production/"));
  assert.deepEqual(outside, []);
});

test("product trees contain no ROM, Nitro, decoded, or forensic payload", () => {
  const forbidden = /\.(?:nds|srl|nxr|ncer|ncgr|nclr|nanr|nscr|nbs|nbsr|atr|datr|col|esc|opm|opmd|nsbmd|nsbtx|nsbca|bsar)$/i;
  const payloads = [...walk("src"), ...walk("assets")].filter((file) => forbidden.test(file)).map(relative);
  assert.deepEqual(payloads, []);
  assert.deepEqual(walk("research/original-evidence").map(relative), ["research/original-evidence/README.md"]);
});

test("one save key, one persistent writer, one Pixi bootstrap and no second ticker", () => {
  const sources = sourceText();
  const saveKeyDeclarations = sources.filter(({ text }) => /championshipModernSave:v1/.test(text)).map(({ file }) => relative(file));
  assert.deepEqual(saveKeyDeclarations, ["src/championship/app/championshipStandaloneSave.js"]);
  const writers = sources.filter(({ text }) => /\.setItem\s*\(/.test(text)).map(({ file }) => relative(file));
  assert.deepEqual(writers, ["src/championship/app/ChampionshipPersistentSavePort.js"]);
  const pixiBootstraps = sources.reduce((count, { text }) => count + (text.match(/new\s+PIXI\.Application\s*\(/g) ?? []).length, 0);
  assert.equal(pixiBootstraps, 1);
  const tickers = sources.filter(({ text }) => /new\s+PIXI\.Ticker|Ticker\.shared|requestAnimationFrame\s*\(/.test(text)).map(({ file }) => relative(file));
  assert.deepEqual(tickers, []);
});

test("coordination paths are repository-relative and manifests expose all required categories", () => {
  const coordination = codeFiles("docs/coordination");
  const absolute = coordination.filter((file) => /[A-Za-z]:[\\/]/.test(fs.readFileSync(file, "utf8"))).map(relative);
  assert.deepEqual(absolute, []);
  const claude = JSON.parse(fs.readFileSync("docs/coordination/CLAUDE_CHAMPIONSHIP_MIGRATION_MANIFEST.json", "utf8"));
  const codex = JSON.parse(fs.readFileSync("docs/coordination/CODEX_CHAMPIONSHIP_MIGRATION_MANIFEST.json", "utf8"));
  for (const key of ["RUNTIME_PRODUCT", "DOMAIN", "SAVE", "PRESENTATION_CONTRACT", "PIXIJ_RUNTIME", "TEST", "REVERSE_REFERENCE_ONLY", "DO_NOT_MIGRATE"]) assert.ok(key in claude, key);
  for (const key of ["PRODUCTION_UI", "TEMPORARY_PRESENTATION", "REFERENCE_ART", "RESEARCH_GALLERY", "PRODUCTION_ASSET", "QA", "DO_NOT_MIGRATE"]) assert.ok(key in codex, key);
});
