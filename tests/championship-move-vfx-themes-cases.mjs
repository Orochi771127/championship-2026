// Dex move names and per-move preview effects (Owner direction 2026-10-28):
// every partner's moves are named in all five languages, each move has a
// theme derived from its original effect banks / approved name / family, the
// special preview plays that theme instead of one beam, and the encrypted
// preview still names the move.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

import moves from "../src/data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import table from "../src/data/championship/move-vfx-themes.r1.json" with { type: "json" };
import { MOVE_VFX_STYLES, moveVfxTheme } from "../src/championship/presentation/battleFx/moveVfxThemes.js";
import { BATTLE_FX_PALETTES } from "../src/championship/presentation/battleFx/battleFxPalettes.js";
import { SHOWCASE_STYLE_NAMES } from "../src/championship/presentation/juicy/showcaseMoveVfx.js";
import { createCodexShowcase, showcaseMoveLook } from "../src/championship/presentation/juicy/codexShowcaseTheater.js";
import { createShowcaseBankCells } from "../src/championship/presentation/juicy/showcaseBankCells.js";
import { juicySignatureMove } from "../src/championship/presentation/juicy/juicyArt.js";
import { databaseVerifiedData } from "../src/championship/database/databaseStories.js";

const LOCALES = ["zh-Hant", "en", "ja", "th", "vi"];
const partners = () => {
  const list = [];
  for (let index = 0; index < 400; index++) {
    let data = null;
    try { data = databaseVerifiedData(index, "zh-Hant"); } catch { data = null; }
    if (data) list.push(data);
  }
  return list;
};

test("the theme table is the migration script's current output", () => {
  const run = spawnSync(process.execPath, ["scripts/build-move-vfx-themes.mjs", "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test("every species move has a theme the preview can draw", () => {
  const speciesMoves = moves.records.filter(move => move.recordIndex > 30 && [0, 1].includes(move.kind));
  assert.equal(speciesMoves.length, 565);
  for (const move of speciesMoves) {
    const theme = moveVfxTheme(move.recordIndex);
    assert.ok(theme, `move ${move.recordIndex} has a theme`);
    assert.ok(MOVE_VFX_STYLES.includes(theme.style), `${move.recordIndex}: ${theme.style}`);
    assert.ok(SHOWCASE_STYLE_NAMES.includes(theme.style), `${theme.style} has a drawn effect`);
    assert.ok(BATTLE_FX_PALETTES[theme.element], `${move.recordIndex}: palette ${theme.element}`);
    assert.ok([1, 2, 3, 4].includes(theme.tier));
    assert.ok(["BANK", "NAME", "FAMILY"].includes(theme.source));
  }
  assert.deepEqual([...MOVE_VFX_STYLES].sort(), [...SHOWCASE_STYLE_NAMES].sort());
  assert.equal(moveVfxTheme(1), null, "the 30 learnable special skills keep their own presentation");
});

test("all 218 partners name every move in five languages", () => {
  const list = partners();
  assert.equal(list.length, 218);
  for (const locale of LOCALES) {
    for (const { speciesIndex } of list) {
      const data = databaseVerifiedData(speciesIndex, locale);
      for (const move of data.moves) {
        assert.ok(move.name && move.name.trim() && !/[?？]{2,}/.test(move.name), `${locale} species ${speciesIndex} move ${move.recordIndex}`);
        assert.ok(move.kindName && !/[?？]/.test(move.kindName));
      }
    }
  }
});

test("beams stay rare; insect/plant never fire one and machines fire ordnance", () => {
  const signatures = partners().map(data => ({ data, move: juicySignatureMove(data.moves) })).filter(entry => entry.move);
  assert.ok(signatures.length >= 200);
  const styles = signatures.map(({ move }) => moveVfxTheme(move.recordIndex).style);
  const beams = styles.filter(style => style === "beam").length;
  assert.ok(beams / signatures.length < 0.15, `beam share ${beams}/${signatures.length}`);
  assert.ok(new Set(styles).size >= 18, "the specials spread over many looks");
  for (const { data, move } of signatures) {
    const style = moveVfxTheme(move.recordIndex).style;
    if (data.familyName === "昆蟲植物") assert.ok(["vine", "thorn", "leaf", "seed", "spore", "slash"].includes(style), `${data.speciesIndex} ${style}`);
    if (data.familyName === "機械") assert.notEqual(style, "beam", `${data.speciesIndex}`);
  }
  // Original effect banks win: the rose vine, the missile rain, the machine gun.
  assert.equal(moveVfxTheme(565).style, "vine");
  assert.deepEqual(showcaseMoveLook(565).banks.map(bank => bank.family).slice(0, 3), ["rose00", "rose00", "rose00"]);
  const style = species => moveVfxTheme(juicySignatureMove(databaseVerifiedData(species, "zh-Hant").moves).recordIndex).style;
  assert.equal(style(170), "missile");
  assert.equal(style(81), "gatling");
  assert.equal(style(94), "thunder");
  assert.equal(style(54), "vine", "花藤纏縛 named a generic bank; its name and family pick vines");
});

// --------------------------------------------------------------- the sandbox
class FakeNode {
  constructor(tag, doc) {
    Object.assign(this, { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], parentNode: null, dataset: {}, style: { setProperty() {} },
      attributes: new Map(), listeners: new Map(), className: "", textContent: "", hidden: false });
  }
  append(...nodes) { for (const node of nodes) { if (!node) continue; node.remove?.(); node.parentNode = this; this.children.push(node); } }
  remove() { if (!this.parentNode) return; const list = this.parentNode.children; list.splice(list.indexOf(this), 1); this.parentNode = null; }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  get classList() { return { add: name => { this.className = `${this.className} ${name}`.trim(); }, contains: name => this.className.split(/\s+/).includes(name), remove() {} }; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  click() { for (const fn of this.listeners.get("click") ?? []) fn({ preventDefault() {}, stopPropagation() {} }); }
  focus() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; }
  querySelectorAll(selector) {
    const name = selector.replace(/^\./, ""), found = [];
    const walk = node => { for (const child of node.children) { if (child.className.split(/\s+/).includes(name) || child.tagName === selector.toUpperCase()) found.push(child); walk(child); } };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
function fakeDocument() {
  const doc = { documentElement: { dataset: { motion: "reduced", theme: "arcade" } }, createElement: tag => new FakeNode(tag, doc), addEventListener() {}, removeEventListener() {} };
  doc.body = new FakeNode("body", doc);
  return doc;
}

test("an encrypted special names its move; an undiscovered caster stays hidden", () => {
  const doc = fakeDocument();
  const showcase = createCodexShowcase({ doc, overlayHost: doc.body });
  const move = juicySignatureMove(databaseVerifiedData(215, "zh-Hant").moves);
  const button = showcase.specialButton({ speciesIndex: 215, speciesId: "species-215", name: "????", move, encrypted: true });
  button.click();
  const title = doc.body.querySelector(".cm-showcase__title").textContent;
  assert.match(title, new RegExp(move.name), "the encrypted title names the move");
  assert.doesNotMatch(title, /？？？？|\?\?\?\?/);
  assert.equal(doc.body.querySelector(".cm-showcase__arena")?.dataset.style, "vine", "a vine move draws vines, not a beam");
  showcase.dispose();
});

test("bank cells load only where the battle may load them", async () => {
  const off = createShowcaseBankCells({ doc: fakeDocument(), href: "https://example.invalid/championship.html", fetchImpl: () => { throw Error("no fetch"); } });
  assert.equal(await off.ready, false);
  assert.equal(off.getDiagnostics().allowed, false);
  assert.equal(off.play(83, 0, new FakeNode("i", fakeDocument())), null);
});

test("the new preview pieces stay DOM-only and the move name keeps the panel colour", () => {
  for (const file of ["showcaseMoveVfx.js", "showcaseBankCells.js", "codexShowcaseTheater.js"]) {
    const source = fs.readFileSync(`src/championship/presentation/juicy/${file}`, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of [/getContext\(/, /WebGLRenderer/, /new PIXI\./, /requestAnimationFrame/, /Application\(/, /localStorage/, /\.intents\./, /https?:\/\//]) {
      assert.doesNotMatch(source, forbidden, `${file}: ${forbidden}`);
    }
  }
  const css = fs.readFileSync("src/championship/app/vs2Styles.css", "utf8");
  assert.doesNotMatch(css, /\.cm-dex-move-card__name\s*\{[^}]*#fff/i, "a fixed white name vanished on the arcade panel");
  assert.equal(table.authority, "OWNER_APPROVED_ADAPTATION_20261028");
});
