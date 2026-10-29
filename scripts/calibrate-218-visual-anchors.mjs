// Offline visual-anchor calibration for every Dex partner (Owner 2026-10-29).
//
// Writes src/championship/data/monsterVisualAnchors218.js so the Dex motion
// viewer, the special preview, the evolution runner and the battle cut-in never
// scan pixels at runtime. For each of the 218 Dex species:
//
//  * motion -- the four showcase actions (idle, walk, attack, cheer) read through
//    the runtime's own loader (spriteMotionPlayer.js loadShowcaseMotion): each
//    action's cell count, the largest packed cell, and the atlas page it sits
//    on. Cells are TRIMMED rectangles on a shared page, so a page or a
//    source-sized window holds several bodies; only the packed cell may show.
//  * footAnchor -- the geometry's own foot origin (the ground the ranch and the
//    battles stand on), checked against the idle cells' lowest opaque pixel row
//    (alpha > 25): "grounded" when they meet, "tail-below" when a tail or a hem
//    hangs under the feet, "hovering" for a partner that floats over its shadow.
//  * muzzleSocket -- on the attack's release cell (its forward-most cell, the
//    open mouth or the swing), the forward-most opaque pixel in the upper body
//    band (50-90 % of the drawn height above the feet): where a breath, beam or
//    bubble leaves. Characters are authored facing left; x is from the foot
//    origin, negative ahead.
//  * cutinHeadFrame -- the Dex illustration's head square (headFocusX/Y as
//    fractions of the image, headSafeScale as a fraction of its longer side),
//    from database-hero-faces.v1.json (scripts/measure-dex-hero-faces.py:
//    catchlight eyes, the upper body, reviewed corrections), checked here
//    against the illustration's own alpha: the focus must sit on drawn pixels.
//
// Pixels are decoded by headless Chromium (the Playwright devDependency); no
// image library is added. Usage: node scripts/calibrate-218-visual-anchors.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { listDatabaseSlots } from "../src/championship/database/databaseCatalog.js";
import { publicCharacterConfig } from "../src/championship/presentation/publicCharacterCatalog.js";
import { databaseHeroFace, databaseHeroPortrait } from "../src/championship/presentation/databaseHeroPortraits.js";
import { SHOWCASE_ACTIONS, SHOWCASE_ATTACK_SEQUENCE, loadShowcaseMotion } from "../src/championship/presentation/juicy/spriteMotionPlayer.js";

const OUT = "src/championship/data/monsterVisualAnchors218.js";
const ALPHA = 25;
const MUZZLE_BAND = [0.5, 0.92];
// How far behind the forward-most point (a share of the cell width) still counts as the front.
const MUZZLE_TOLERANCE = 0.12;
// Within this many packed pixels (two native pixels at density 4) the drawn feet meet the origin.
const GROUNDED = 8;
const BASE = "http://127.0.0.1/championship.html";
const check = process.argv.includes("--check");

const localFetch = async url => {
  const file = decodeURIComponent(new URL(url).pathname.slice(1));
  const bytes = fs.readFileSync(file);
  return { ok: true, status: 200, text: async () => bytes.toString("utf8"), json: async () => JSON.parse(bytes.toString("utf8")) };
};
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const fileOf = url => decodeURIComponent(new URL(url).pathname.slice(1));

// ------------------------------------------------------------ pixel access
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent("<!doctype html><title>calibrate</title>");
/** Per-row opaque runs of rectangles on one image: [{ rows: [[minX, maxX] | null, ...] }]. */
async function scanRects(file, rects) {
  const bytes = fs.readFileSync(file).toString("base64");
  const mime = file.endsWith(".png") ? "image/png" : "image/webp";
  return page.evaluate(async ({ bytes, mime, rects, alpha, key }) => {
    globalThis.__images ??= new Map();
    let bitmap = globalThis.__images.get(key);
    if (!bitmap) {
      const blob = await (await fetch(`data:${mime};base64,${bytes}`)).blob();
      bitmap = await createImageBitmap(blob);
      if (globalThis.__images.size > 6) globalThis.__images.clear();
      globalThis.__images.set(key, bitmap);
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    return rects.map(({ x, y, w, h }) => {
      const data = context.getImageData(x, y, w, h).data;
      const rows = [];
      let opaque = 0;
      for (let row = 0; row < h; row++) {
        let min = -1, max = -1;
        for (let col = 0; col < w; col++) if (data[(row * w + col) * 4 + 3] > alpha) { if (min < 0) min = col; max = col; opaque++; }
        rows.push(min < 0 ? null : [min, max]);
      }
      return { width: bitmap.width, height: bitmap.height, rows, opaque };
    });
  }, { bytes, mime, rects, alpha: ALPHA, key: file });
}

// ---------------------------------------------------------------- per species
async function motionAnchors(speciesId) {
  const config = publicCharacterConfig(speciesId);
  if (!config) return null;
  const motion = await loadShowcaseMotion(speciesId, { baseUrl: BASE, fetchImpl: localFetch });
  const actions = {};
  for (const action of SHOWCASE_ACTIONS) {
    const frames = motion.sequences.get(action.sequence) ?? [];
    if (!frames.length) { actions[action.id] = null; continue; }
    const cellW = Math.max(...frames.map(f => f.w)), cellH = Math.max(...frames.map(f => f.h));
    // Reviewed pages do not state their size; the decoded image does.
    let pageWidth = frames[0].pageWidth, pageHeight = frames[0].pageHeight;
    if (!pageWidth || !pageHeight) ({ width: pageWidth, height: pageHeight } = (await scanRects(fileOf(frames[0].url), [{ x: 0, y: 0, w: 1, h: 1 }]))[0]);
    actions[action.id] = { sequence: action.sequence, frameCount: frames.length, frameWidth: cellW, frameHeight: cellH,
      cellAspect: round(cellW / cellH), pageWidth, pageHeight,
      cellsPerPage: round((pageWidth * pageHeight) / (cellW * cellH), 1),
      durationMs: Math.round(frames.reduce((sum, f) => sum + f.ticks, 0) * 1000 / 60) };
  }
  // Feet: the lowest opaque row of the idle cells, and the opaque centre on it.
  const idle = motion.sequences.get(0) ?? motion.sequences.values().next().value;
  let footY = -Infinity, footXs = [];
  for (const frame of idle) {
    const [scan] = await scanRects(fileOf(frame.url), [{ x: frame.x, y: frame.y, w: frame.w, h: frame.h }]);
    for (let row = scan.rows.length - 1; row >= 0; row--) {
      if (!scan.rows[row]) continue;
      const y = frame.oy + row + 1;
      if (y > footY) { footY = y; footXs = []; }
      if (y === footY) footXs.push(frame.ox + (scan.rows[row][0] + scan.rows[row][1] + 1) / 2);
      break;
    }
  }
  const visualHeight = Math.max(1, -Math.min(...idle.map(f => f.oy)));
  const stance = Math.abs(footY) <= GROUNDED ? "grounded" : footY > 0 ? "tail-below" : "hovering";
  // Muzzle: the forward-most opaque pixel in the release cell's upper-body band.
  // A partner without an attack sequence aims from its idle stance.
  const attack = motion.sequences.get(SHOWCASE_ATTACK_SEQUENCE) ?? idle;
  const release = motion.release.get(SHOWCASE_ATTACK_SEQUENCE) ?? { index: 0, atMs: 0 };
  let muzzle = null;
  if (attack?.length) {
    const frame = attack[release.index] ?? attack[0];
    const [scan] = await scanRects(fileOf(frame.url), [{ x: frame.x, y: frame.y, w: frame.w, h: frame.h }]);
    const top = frame.oy + scan.rows.findIndex(Boolean);
    const height = Math.max(1, -top);
    // The front edge of the upper body, row by row. A lunge puts the claws or
    // the chest furthest ahead, so the head is the HIGHEST stretch of that
    // front within a small tolerance of the forward-most point; the mouth sits
    // a little under its top.
    // Native art faces left (its front is the left edge); a reviewed set drawn
    // facing right has its front on the right edge. `behind` is small ahead.
    const facesRight = motion.facesRight === true;
    const behind = x => (facesRight ? -x : x);
    const front = [];
    scan.rows.forEach((run, row) => {
      if (!run) return;
      const y = frame.oy + row, up = -y / height;
      if (up >= MUZZLE_BAND[0] && up <= MUZZLE_BAND[1]) front.push({ x: frame.ox + (facesRight ? run[1] : run[0]), y });
    });
    if (front.length) {
      const ahead = Math.min(...front.map(point => behind(point.x)));
      const near = front.filter(point => behind(point.x) <= ahead + frame.w * MUZZLE_TOLERANCE);
      const top = near.reduce((best, point) => (point.y < best.y ? point : best));
      const y = Math.min(Math.round(top.y + height * 0.04), Math.round(-height * MUZZLE_BAND[0]));
      const row = front.filter(point => Math.abs(point.y - y) <= 2).map(point => point.x).concat(top.x);
      const x = facesRight ? Math.max(...row) - 1 : Math.min(...row) + 1;
      muzzle = { x, y, heightRatio: round(-y / height), releaseIndex: release.index, releaseMs: release.atMs };
    }
  }
  return { entityId: config.entityId, art: motion.reviewed ? (motion.facesRight ? "reviewed-right" : "reviewed") : "atlas",
    density: motion.density, bounds: { ...motion.bounds }, actions,
    footAnchor: { x: 0, y: 0, stance, lowestPixel: footY, lowestPixelX: round(footXs.reduce((a, b) => a + b, 0) / Math.max(1, footXs.length), 1), visualHeight },
    muzzleSocket: muzzle };
}

async function headAnchors(speciesIndex) {
  const hero = databaseHeroPortrait(speciesIndex);
  const face = databaseHeroFace(hero);
  if (!hero || !face) return null;
  const [cx, cy, size] = face;
  const half = Math.round(size / 2);
  const x = Math.max(0, cx - half), y = Math.max(0, cy - half);
  const w = Math.min(hero.width - x, size), h = Math.min(hero.height - y, size);
  const [scan, centre] = await scanRects(hero.src, [{ x, y, w, h }, { x: Math.max(0, cx - 4), y: Math.max(0, cy - 4), w: 9, h: 9 }]);
  return { src: hero.src, sha256: hero.sha256, width: hero.width, height: hero.height,
    headFocusX: round(cx / hero.width, 4), headFocusY: round(cy / hero.height, 4), headSafeScale: round(size / Math.max(hero.width, hero.height), 4),
    face: [cx, cy, size], opaqueInHead: round(scan.opaque / (w * h), 3), focusOnBody: centre.opaque > 0 };
}

// ------------------------------------------------------------------ the run
const rows = [];
const started = Date.now();
for (const slot of listDatabaseSlots()) {
  const entry = { speciesIndex: slot.speciesIndex, speciesId: slot.speciesId, motion: null, cutinHeadFrame: null };
  try { entry.motion = await motionAnchors(slot.speciesId); } catch (error) { entry.motionError = String(error?.message ?? error); }
  entry.cutinHeadFrame = await headAnchors(slot.speciesIndex);
  rows.push(entry);
}
await browser.close();

const withMotion = rows.filter(row => row.motion);
const summary = {
  species: rows.length,
  withMotion: withMotion.length,
  withHead: rows.filter(row => row.cutinHeadFrame).length,
  motionErrors: rows.filter(row => row.motionError).map(row => `${row.speciesId}: ${row.motionError}`),
  art: rows.filter(row => row.motion).reduce((counts, row) => ({ ...counts, [row.motion.art]: (counts[row.motion.art] ?? 0) + 1 }), {}),
  maxCellAspect: Math.max(...withMotion.flatMap(row => Object.values(row.motion.actions).filter(Boolean).map(a => a.cellAspect))),
  multiCellPages: withMotion.filter(row => Object.values(row.motion.actions).some(a => a && a.cellsPerPage > 1.4)).length,
  muzzleInUpperBody: withMotion.filter(row => row.motion.muzzleSocket && row.motion.muzzleSocket.heightRatio >= 0.5).length,
  stances: withMotion.reduce((counts, row) => ({ ...counts, [row.motion.footAnchor.stance]: (counts[row.motion.footAnchor.stance] ?? 0) + 1 }), {}),
  headsOnBody: rows.filter(row => row.cutinHeadFrame?.focusOnBody).length,
  headsMostlyDrawn: rows.filter(row => row.cutinHeadFrame?.opaqueInHead >= 0.25).length,
  elapsedMs: Date.now() - started
};

// The runtime table is compact (arrays in a fixed order, expanded by the
// accessor); the verbose per-species report goes beside the batch report.
const ACTION_IDS = SHOWCASE_ACTIONS.map(action => action.id);
const compactRow = row => {
  const m = row.motion, h = row.cutinHeadFrame;
  return [
    m ? [m.entityId, m.density, [m.bounds.left, m.bounds.top, m.bounds.right, m.bounds.bottom],
      ACTION_IDS.map(id => m.actions[id] ? [m.actions[id].frameCount, m.actions[id].frameWidth, m.actions[id].frameHeight, m.actions[id].cellsPerPage] : null),
      [m.footAnchor.stance, m.footAnchor.lowestPixel, m.footAnchor.visualHeight],
      m.muzzleSocket ? [m.muzzleSocket.x, m.muzzleSocket.y, m.muzzleSocket.heightRatio, m.muzzleSocket.releaseIndex, m.muzzleSocket.releaseMs] : null, m.art] : null,
    h ? [h.headFocusX, h.headFocusY, h.headSafeScale, h.opaqueInHead] : null
  ];
};
const { elapsedMs, ...stable } = summary;
const ACCESSOR = fs.readFileSync(new URL("./lib/monster-visual-anchors-accessor.js.txt", import.meta.url), "utf8");
const source = [
  "// GENERATED by scripts/calibrate-218-visual-anchors.mjs -- do not edit by hand.",
  "// Offline visual anchors for every Dex partner (Owner 2026-10-29): single-cell",
  "// motion specs, the feet, the muzzle on the attack's release cell, and the",
  "// cut-in head square. Motion values are packed atlas pixels from the geometry's",
  "// foot origin in the art's own direction (native art faces left: x < 0 is ahead); head values are fractions of the Dex",
  "// illustration. Rerun the script whenever character art or a Dex illustration",
  "// changes; the runtime never scans pixels.",
  "//",
  "// Row: [motion, head]",
  "//   motion  [entityId, density, [left, top, right, bottom], actions, foot, muzzle, art]",
  '//   art     "atlas" (native cells) | "reviewed" | "reviewed-right" (reviewed art drawn facing right; x > 0 is ahead)',
  `//   actions per ${ACTION_IDS.join(" / ")}: [frameCount, frameWidth, frameHeight, cellsPerPage]`,
  '//   foot    [stance ("grounded" | "tail-below" | "hovering"), lowestPixel, visualHeight]',
  "//   muzzle  [x, y, heightRatio, releaseIndex, releaseMs]",
  "//   head    [headFocusX, headFocusY, headSafeScale, opaqueInHead]",
  "export const MONSTER_VISUAL_ANCHORS_SCHEMA = 1;",
  `export const MONSTER_VISUAL_ANCHORS_SUMMARY = Object.freeze(${JSON.stringify(stable)});`,
  `const ACTION_IDS = Object.freeze(${JSON.stringify(ACTION_IDS)});`,
  "const ROWS = {",
  rows.map(row => `  ${JSON.stringify(row.speciesId)}: ${JSON.stringify(compactRow(row))}`).join(",\n"),
  "};",
  ACCESSOR
].join("\n");
const REPORT = "docs/reports/evo-cutin-dex-motion-2026-10-29/visual-anchors-218.report.json";
const digest = crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== source) { console.error(`${OUT} is stale; rerun the calibrator`); process.exitCode = 1; }
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, source);
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({ generatedBy: "scripts/calibrate-218-visual-anchors.mjs", summary: stable, rows }, null, 1) + "\n");
}
console.log(JSON.stringify({ out: OUT, bytes: Buffer.byteLength(source), digest, ...summary }, null, 2));
