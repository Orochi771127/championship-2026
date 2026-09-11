// Copy the faithful care cells into one production runtime bundle.
//
// Source is the already-built faithful-hd4x baseline in this repo. The runtime
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
const SOURCE_REL = "docs/art/production/care/faithful-hd4x";
const DEST_REL = "assets/production/raising-care/licensed-runtime-v1";
const SOURCE = path.join(root, SOURCE_REL);
const DEST = path.join(root, DEST_REL);
// One identity per spoiled food, two poses each, and the same for waste and the
// sweep. Ordinary food keeps its four remaining amounts.
const EXPECTED = Object.freeze({
  meat: 4, protein: 4, "meat-rot": 2, "protein-rot": 2, waste: 2, broom: 2
});

function fail(message) {
  throw new Error(`CHAMPIONSHIP_LICENSED_CARE_RUNTIME: ${message}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const sourceManifestPath = path.join(SOURCE, "manifest.json");
if (!fs.existsSync(sourceManifestPath)) fail(`MISSING_SOURCE_MANIFEST:${SOURCE_REL}`);
const source = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
if (source.sourceRomSha256 !== SOURCE_ROM_SHA256) fail(`UNEXPECTED_SOURCE_ROM:${source.sourceRomSha256}`);
if (!Array.isArray(source.cells)) fail("MISSING_SOURCE_CELLS");

const counts = {};
for (const cell of source.cells) counts[cell.role] = (counts[cell.role] ?? 0) + 1;
for (const [role, want] of Object.entries(EXPECTED)) {
  if (counts[role] !== want) fail(`ROLE_COUNT:${role}:${counts[role] ?? 0}!=${want}`);
}
if (Object.keys(counts).length !== Object.keys(EXPECTED).length) fail(`UNEXPECTED_ROLES:${Object.keys(counts)}`);

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

const cells = source.cells.map((cell) => {
  const from = path.join(SOURCE, cell.file);
  if (sha256File(from) !== cell.sha256) fail(`SOURCE_DRIFT:${cell.file}`);
  fs.copyFileSync(from, path.join(DEST, cell.file));
  return {
    file: cell.file,
    src: `${DEST_REL}/${cell.file}`,
    role: cell.role,
    pose: cell.pose,
    sequenceId: cell.sequenceId,
    rawDurationTicks: cell.rawDurationTicks,
    nativeWidth: cell.nativeWidth,
    nativeHeight: cell.nativeHeight,
    nativeAnchorX: cell.nativeAnchorX,
    nativeAnchorY: cell.nativeAnchorY,
    sha256: sha256File(path.join(DEST, cell.file))
  };
});
cells.sort((left, right) => left.file.localeCompare(right.file));

const manifest = {
  schemaVersion: 1,
  assetId: "art:raising-care:licensed-runtime:v1",
  family: "RAISING_CARE",
  product: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  artifactMaturity: "LICENSED_PIXEL_FAITHFUL_NEAREST_HD_CARE_ITEMS",
  productionStatus: "OWNER_APPROVED_LICENSED_PIXEL_RUNTIME",
  shippingStatus: "NOT_SHIPPING_READY",
  humanApproved: true,
  runtimeEligible: true,
  shippingReady: false,
  rightsStatus: "LICENSED",
  rights: {
    status: "LICENSED",
    authority: "assets/production/ART_PRODUCTION_INDEX.json",
    ownerDirective: "docs/coordination/OWNER_DIRECTION.md#2026-09-02",
    sourceRomSha256: SOURCE_ROM_SHA256,
    researchPack: "NOT_RUNTIME_READABLE",
    sourceBaseline: SOURCE_REL
  },
  scale: source.scale,
  filter: "nearest",
  timingSemantics: source.timingSemantics,
  roleEvidence: source.roleEvidence,
  poseEvidence: source.poseEvidence,
  cellCount: cells.length,
  cells,
  notes: [
    "Spoiled food is its own identity per kind, not a variant per remaining amount.",
    "Spoiled food, waste and the sweep each play two poses of 18 raw ticks.",
    "Celebration platter and cake have no original identity and stay authored vectors.",
    "nativeAnchorX/Y is the sprite origin inside the image, in native pixels."
  ]
};

fs.writeFileSync(path.join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote licensed care runtime: ${cells.length} cells across ${Object.keys(counts).length} roles.`);
