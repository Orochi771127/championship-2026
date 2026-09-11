// Copy a faithful original sprite family into a production runtime bundle.
//
// Source is an already-built faithful-hd4x baseline in this repo. The runtime
// reads only the PNG copies written here; the research pack stays out.
//
// Owner directive 2026-09-02 (docs/coordination/OWNER_DIRECTION.md) makes
// decoded original pixels game materials, not only layout contracts.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1";

const FAMILIES = {
  care: {
    source: "docs/art/production/care/faithful-hd4x",
    dest: "assets/production/raising-care/licensed-runtime-v1",
    assetId: "art:raising-care:licensed-runtime:v1",
    family: "RAISING_CARE",
    maturity: "LICENSED_PIXEL_FAITHFUL_NEAREST_HD_CARE_ITEMS",
    counts: { meat: 4, protein: 4, "meat-rot": 2, "protein-rot": 2, waste: 2, broom: 2 },
    notes: [
      "Spoiled food is its own identity per kind, not a variant per remaining amount.",
      "Spoiled food, waste and the sweep each play two poses of 18 raw ticks.",
      "Celebration platter and cake have no original identity and stay authored vectors.",
      "nativeAnchorX/Y is the sprite origin inside the image, in native pixels."
    ]
  },
  toolbar: {
    source: "docs/art/production/toolbar/faithful-hd4x",
    dest: "assets/production/toolbar/licensed-runtime-v1",
    assetId: "art:toolbar:licensed-runtime:v1",
    family: "TOOLBAR",
    maturity: "LICENSED_PIXEL_FAITHFUL_NEAREST_HD_TOOLBAR_ICONS",
    counts: Object.fromEntries(["hand", "feed", "protein", "clean", "woundMedicine",
      "medicine", "manage", "system"]
      .flatMap((name) => [[`${name}-rest`, 1], [`${name}-selected`, 1]])),
    notes: [
      "The original plays these grey and lights only the selected slot gold.",
      "Slot mapping is UNKNOWN_REQUIRES_TRACE in the toolbar contract. Six drawings",
      "name their own tool; the open book and the door are the seventh and eighth",
      "icons in the original's own toolbar (video BV13u411B7BK t030). Observation."
    ]
  }
};

function fail(message) {
  throw new Error(`CHAMPIONSHIP_LICENSED_ORIGINAL_RUNTIME: ${message}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

for (const key of (process.argv.slice(2).filter((a) => !a.startsWith("--")).length
  ? process.argv.slice(2).filter((a) => !a.startsWith("--"))
  : Object.keys(FAMILIES))) {
  const spec = FAMILIES[key];
  if (!spec) fail(`UNKNOWN_FAMILY:${key}`);
  const sourceManifestPath = path.join(root, spec.source, "manifest.json");
  if (!fs.existsSync(sourceManifestPath)) fail(`MISSING_SOURCE_MANIFEST:${spec.source}`);
  const source = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
  if (source.sourceRomSha256 !== SOURCE_ROM_SHA256) fail(`UNEXPECTED_SOURCE_ROM:${source.sourceRomSha256}`);
  if (!Array.isArray(source.cells)) fail(`MISSING_SOURCE_CELLS:${key}`);

  const counts = {};
  for (const cell of source.cells) counts[cell.role] = (counts[cell.role] ?? 0) + 1;
  for (const [role, want] of Object.entries(spec.counts)) {
    if (counts[role] !== want) fail(`ROLE_COUNT:${key}:${role}:${counts[role] ?? 0}!=${want}`);
  }
  if (Object.keys(counts).length !== Object.keys(spec.counts).length) fail(`UNEXPECTED_ROLES:${key}:${Object.keys(counts)}`);

  const dest = path.join(root, spec.dest);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const cells = source.cells.map((cell) => {
    const from = path.join(root, spec.source, cell.file);
    if (sha256File(from) !== cell.sha256) fail(`SOURCE_DRIFT:${key}:${cell.file}`);
    fs.copyFileSync(from, path.join(dest, cell.file));
    return {
      file: cell.file, src: `${spec.dest}/${cell.file}`,
      role: cell.role, pose: cell.pose, sequenceId: cell.sequenceId,
      rawDurationTicks: cell.rawDurationTicks,
      nativeWidth: cell.nativeWidth, nativeHeight: cell.nativeHeight,
      nativeAnchorX: cell.nativeAnchorX, nativeAnchorY: cell.nativeAnchorY,
      sha256: sha256File(path.join(dest, cell.file))
    };
  });
  cells.sort((left, right) => left.file.localeCompare(right.file));

  const manifest = {
    schemaVersion: 1, assetId: spec.assetId, family: spec.family,
    product: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
    artifactMaturity: spec.maturity,
    productionStatus: "OWNER_APPROVED_LICENSED_PIXEL_RUNTIME",
    shippingStatus: "NOT_SHIPPING_READY",
    humanApproved: true, runtimeEligible: true, shippingReady: false,
    rightsStatus: "LICENSED",
    rights: {
      status: "LICENSED", authority: "assets/production/ART_PRODUCTION_INDEX.json",
      ownerDirective: "docs/coordination/OWNER_DIRECTION.md#2026-09-02",
      sourceRomSha256: SOURCE_ROM_SHA256, researchPack: "NOT_RUNTIME_READABLE",
      sourceBaseline: spec.source
    },
    scale: source.scale, filter: "nearest",
    timingSemantics: source.timingSemantics,
    roleEvidence: source.roleEvidence, poseEvidence: source.poseEvidence,
    cellCount: cells.length, cells, notes: spec.notes
  };
  fs.writeFileSync(path.join(dest, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote licensed ${key} runtime: ${cells.length} cells across ${Object.keys(counts).length} roles.`);
}
