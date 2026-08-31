import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { decodeNsbma, decodeNsbva } from "./lib/nitro-g3d-sidecars.mjs";

const repoRoot = process.cwd();
const bundleRoot = path.join(repoRoot, "assets/production/vfx/original-rom-conversion-v1");
const manifestPath = path.join(bundleRoot, "manifest.json");
const receiptPath = path.join(repoRoot, "docs/art/production/vfx/ORIGINAL_ROM_CONVERSION_V1_RECEIPT.json");
const sources = {
  hypereffect: { path: "battle/hypereffect.nsbva", size: 144, sha256: "b39d90d658d8884acbb7da20da4b847ffc4c75f25427c09baf90aa58ed510853" },
  spark: { path: "common/spark.nsbma", size: 2172, sha256: "d3e2f348488a7b59536846400f86e049eec19ab63f0a8ce97630dfadf5f55bce" }
};

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    const [key, inline] = argv[index].slice(2).split("=", 2);
    values[key] = inline ?? argv[++index];
  }
  return values;
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readVerified(root, source) {
  const filePath = path.join(root, ...source.path.split("/"));
  const bytes = fs.readFileSync(filePath);
  if (bytes.length !== source.size || sha256Bytes(bytes) !== source.sha256) throw new Error(`Source verification failed: ${source.path}`);
  return bytes;
}

function readGlbJson(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) throw new Error(`Invalid GLB: ${filePath}`);
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.toString("ascii", 16, 20) !== "JSON") throw new Error(`GLB JSON chunk missing: ${filePath}`);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+|\s+$/g, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function outputRecord(filePath, extra) {
  const bytes = fs.readFileSync(filePath);
  return { path: filePath.split(path.sep).join("/"), size: bytes.length, sha256: sha256Bytes(bytes), ...extra };
}

function upsertOutput(system, record) {
  system.outputs = system.outputs.filter((item) => item.path !== record.path);
  system.outputs.push(record);
  system.outputs.sort((left, right) => left.path.localeCompare(right.path));
}

const args = parseArgs(process.argv.slice(2));
const sourceRootValue = args["source-root"] ?? process.env.CHAMPIONSHIP_NITRO_SOURCE_ROOT;
if (!sourceRootValue) throw new Error("Provide --source-root <raw_3d_assets> or CHAMPIONSHIP_NITRO_SOURCE_ROOT.");
const sourceRoot = path.resolve(sourceRootValue);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));

const hyperGlb = readGlbJson(path.join(bundleRoot, "hypereffect/hypereffect.glb"));
const hyperNodeNames = hyperGlb.nodes.map((node) => node.name).filter((name) => name !== "world_root");
const visibility = decodeNsbva(readVerified(sourceRoot, sources.hypereffect), hyperNodeNames);
const visibilityPath = path.join(bundleRoot, "hypereffect/hypereffect.visibility.json");
writeJson(visibilityPath, visibility);

const sparkGlb = readGlbJson(path.join(bundleRoot, "spark/spark.glb"));
const materialAnimation = decodeNsbma(readVerified(sourceRoot, sources.spark));
const glbMaterialNames = sparkGlb.materials.map((material) => material.name);
if (JSON.stringify(materialAnimation.tracks.map((track) => track.materialName)) !== JSON.stringify(glbMaterialNames)) {
  throw new Error("NSBMA material names do not match the converted spark GLB.");
}
const materialPath = path.join(bundleRoot, "spark/spark.material-animation.json");
writeJson(materialPath, materialAnimation);

const records = [
  ["hypereffect", outputRecord(path.relative(repoRoot, visibilityPath), { sidecar: { kind: visibility.kind, frameCount: visibility.frameCount, targetCount: visibility.nodeCount } })],
  ["spark", outputRecord(path.relative(repoRoot, materialPath), { sidecar: { kind: materialAnimation.kind, frameCount: materialAnimation.frameCount, targetCount: materialAnimation.tracks.length } })]
];
for (const [systemId, record] of records) {
  const system = manifest.systems.find((item) => item.systemId === systemId);
  const receiptSystem = receipt.systems.find((item) => item.systemId === systemId);
  if (!system || !receiptSystem) throw new Error(`Bundle metadata is missing ${systemId}.`);
  upsertOutput(system, record);
  upsertOutput(receiptSystem, { path: record.path, size: record.size, sha256: record.sha256 });
}
manifest.format = "GLB_2_0_PNG_AND_NITRO_ANIMATION_SIDECARS";
manifest.animationSidecarDecoder = "championship-nitro-g3d-sidecars-v1";
manifest.systems.find((item) => item.systemId === "hypereffect").knownGaps = [
  "The source visibility timeline is decoded exactly; original caller frame cadence and trigger parameters remain unresolved.",
  "Final camera remains unresolved."
];
manifest.systems.find((item) => item.systemId === "spark").knownGaps = [
  "NSBTA conversion is experimental and uses glTF property-animation extensions.",
  "The source material-color timeline is decoded exactly; original caller frame cadence remains unresolved.",
  "The exact original caller remains unresolved."
];
receipt.animationSidecarDecoder = { id: "championship-nitro-g3d-sidecars-v1", sourcePayloadIncluded: false };
writeJson(manifestPath, manifest);
writeJson(receiptPath, receipt);
console.log("Built exact Nitro animation sidecars: hypereffect VIS0 and spark MAT0.");
