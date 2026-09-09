// Original-created vector UI masters, baked to four portable sRGB PNG textures.
// No ROM pixels, geometry or font files are embedded. Run from the repo root.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { BATTLE_FACE_LABELS } from "../src/championship/text/zhHant.js";

const output = "assets/production/battle/menu-cube-v1";
const masters = "docs/art/production/battle/menu-cube-v1";
const faces = [
  { id: "CHAMPIONSHIP", stem: "championship", node: "_02_champ", light: "#f3d990", mid: "#bd8c2f", dark: "#785b22", symbol: '<path d="M174 194l-18-67 57 37 43-65 43 65 57-37-18 67z"/><path d="M182 210h148v20H182z"/><path d="M153 221l-21-17-10-37m39 71-30-7-25-27m229 17 21-17 10-37m-39 71 30-7 25-27" fill="none" stroke-width="9"/>' },
  { id: "TITLE_MATCH", stem: "title-match", node: "_03_title", light: "#f2bca2", mid: "#bd6545", dark: "#85432d", symbol: '<path d="M256 96l82 29v68c0 38-40 66-82 85-42-19-82-47-82-85v-68z" fill="none" stroke-width="10"/><path d="M256 128l16 33 36 5-26 26 6 36-32-17-32 17 6-36-26-26 36-5z"/>' },
  { id: "FREE_BATTLE", stem: "free-battle", node: "_04_free", light: "#a9dfe7", mid: "#3d91aa", dark: "#245b70", symbol: '<path d="M150 123h42l65 65-32 33-75-74zm212 0h-42l-65 65 32 33 75-74zM166 249l47-47 23 23-47 47zm180 0-47-47-23 23 47 47z"/><path d="M246 109h20v32h-20zm0 142h20v32h-20z"/>' },
  { id: "LINK_BATTLE", stem: "link-battle", node: "_05_tushin", light: "#b9ddc9", mid: "#588f76", dark: "#355e4d", symbol: '<g fill="none" stroke-width="15"><rect x="143" y="138" width="140" height="82" rx="40" transform="rotate(-35 213 179)"/><rect x="229" y="164" width="140" height="82" rx="40" transform="rotate(-35 299 205)"/></g><path d="M160 108v-24m-20 37h-24m236 141v24m20-37h24" fill="none" stroke-width="7"/>' }
];
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(masters, { recursive: true });
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${body}</svg>`;
const sha = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
const records = [];
try {
  for (const face of faces) {
    const background = `<defs><linearGradient id="base" x2=".7" y2="1"><stop stop-color="#fff6db"/><stop offset=".5" stop-color="${face.light}"/><stop offset="1" stop-color="${face.mid}"/></linearGradient><pattern id="lines" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="${face.dark}" stroke-opacity=".045"/></pattern></defs><path fill="#142c39" d="M0 0h512v512H0z"/><path fill="url(#base)" d="M28 18h456l10 10v456l-10 10H28l-10-10V28z"/><path fill="url(#lines)" d="M28 28h456v456H28z"/><path fill="#fffbe9" opacity=".4" d="M36 36h440v170L36 386z"/><path fill="${face.dark}" opacity=".12" d="M36 401l440-163v238H36z"/><path d="M64 308h384" stroke="${face.dark}" stroke-opacity=".24" stroke-width="2"/>`;
    const emblem = `<g fill="${face.dark}" stroke="${face.dark}" stroke-linejoin="round" stroke-linecap="round">${face.symbol}</g><g fill="none" stroke="${face.dark}" opacity=".25"><circle cx="256" cy="186" r="123"/><circle cx="256" cy="186" r="132" stroke-dasharray="2 12"/></g>`;
    const label = `<g fill="#142c39" text-anchor="middle" font-family="Microsoft JhengHei, Noto Sans TC, sans-serif" font-weight="700"><text x="256" y="389" font-size="65" letter-spacing="3">${BATTLE_FACE_LABELS[face.id]}</text></g><g fill="${face.dark}" opacity=".72"><path d="M169 424h174v3H169zM227 444h58v4h-58z"/></g><g fill="none" stroke="#142c39" stroke-width="3"><path d="M39 88V39h49m336 0h49v49M39 424v49h49m336 0h49v-49"/></g><g fill="#fff9e3"><circle cx="38" cy="38" r="3"/><circle cx="474" cy="38" r="3"/><circle cx="38" cy="474" r="3"/><circle cx="474" cy="474" r="3"/></g>`;
    const layers = { background, emblem, label };
    const sourceLayers = {};
    for (const [name, body] of Object.entries(layers)) {
      const file = `${masters}/${face.stem}-${name}.svg`;
      fs.writeFileSync(file, svg(body) + "\n");
      sourceLayers[name] = file;
    }
    const composite = svg(background + emblem + label);
    fs.writeFileSync(`${masters}/${face.stem}-composite.svg`, composite + "\n");
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${composite}`);
    await page.evaluate(() => document.fonts.ready);
    const file = `${output}/${face.stem}.png`;
    const bytes = await page.screenshot({ path: file, omitBackground: true });
    records.push({ id: face.id, label: BATTLE_FACE_LABELS[face.id], referenceNodePrefix: face.node, texture: file, width: 512, height: 512, colorSpace: "srgb", sha256: sha(bytes), bytes: bytes.length, sourceLayers });
  }
  const manifest = {
    schemaVersion: 1, assetId: "art:battle-select:menu-cube:v1", title: "Battle menu four-face panel pack",
    rightsStatus: "ORIGINAL_CREATED", productionStatus: "IMPLEMENTED_OWNER_VISUAL_REVIEW_PENDING",
    runtimeEligible: true, humanApproved: false, shippingReady: false, shippingStatus: "NOT_SHIPPING_READY",
    artifactMaturity: "FOUR_LAYERED_VECTOR_PANELS_BAKED_TO_SRGB_TEXTURES",
    renderer: "THREE_BOUNDED_BATTLE_SELECT", implementation: "src/championship/presentation/vs5/createBattleSelectThreePresentation.js",
    language: "zh-Hant", textEvidence: "PRODUCT_AUTHORED", artEvidence: "PRODUCT_AUTHORED",
    authoring: { method: "REPO_NATIVE_VECTOR_UI_RASTERIZED_WITH_CHROMIUM", builder: "scripts/build-battle-cube-art.mjs", font: "Microsoft JhengHei rendered to PNG; no font binary redistributed" },
    evidenceBoundary: {
      sourceModel: "battle_menu/launcher13.nsbmd", sourceModelSha256: "ea0cb0f6da5998d94b5ef870899ff149777de1bbad487dcd5975f7a5ac6e7157",
      requestedFourIdentitiesPresent: true, onlyFourOriginalFacesClaimed: false,
      additionalReferencePrefixes: ["_06_password", "_07_rensyu"],
      layerMeaning: "BACKGROUND_EMBLEM_LABEL_IS_PRODUCT_AUTHORED; _l/_u semantic meanings remain UNKNOWN_REQUIRES_TRACE",
      romModelReuse: false, decodedTextureReuse: false, originalPixelReuse: false, runtimeResearchPathDependency: false,
      orientationEvidence: "PRODUCT_AUTHORED", exactOriginalVisualParity: false
    },
    authorityBoundary: { selection: "EXISTING_INJECTED_ON_SELECT", matchFiltering: "UNCHANGED_UNKNOWN_REQUIRES_TRACE", newGameModes: false, newTicker: false },
    budget: { textureCount: 4, maxDimension: 512, rgbaBytesIncludingMipmapsCeiling: 5592408, maxTotalPngBytes: 768000, loadPolicy: "BATTLE_SELECT_ENTRY_DISPOSE_ON_EXIT" },
    faces: records
  };
  fs.writeFileSync(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
  await page.setViewportSize({ width: 1104, height: 1170 });
  await page.setContent(`<style>body{margin:0;padding:28px;background:#112731;color:#e7eedf;font:20px 'Microsoft JhengHei',sans-serif}h1{font-size:28px;margin:0 0 20px}main{display:grid;grid-template-columns:512px 512px;gap:24px}img{display:block;width:512px}</style><h1>戰鬥選單 · 四面貼圖</h1><main>${records.map(r=>`<img src="data:image/png;base64,${fs.readFileSync(r.texture).toString('base64')}">`).join('')}</main>`);
  await page.screenshot({ path: `${masters}/contact-sheet.png`, fullPage: true });
  console.log(`BATTLE_CUBE_ART_BUILD_PASS faces=${records.length} bytes=${records.reduce((n,r)=>n+r.bytes,0)}`);
} finally { await browser.close(); }
