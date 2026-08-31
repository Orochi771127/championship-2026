import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repo = process.cwd();
const registryPath = path.join(repo, "docs/art/ART_ASSET_REGISTRY.json");
const outputRoot = path.join(repo, "docs/art/production/vfx/faithful-reference-26");

function requiredEnvironmentPath(variable) {
  const value = process.env[variable];
  if (!value) throw new Error(`Set ${variable} to the required decoded research input`);
  return path.resolve(value);
}

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [keys[index], value])));
}

function readGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) throw new Error(`Invalid GLB: ${file}`);
  let offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "JSON") {
      return JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString("utf8").replace(/\0+|\s+$/g, ""));
    }
    offset += 8 + length;
  }
  throw new Error(`Missing GLB JSON: ${file}`);
}

function collectFiles(root) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...collectFiles(absolute));
    else found.push(absolute);
  }
  return found;
}

const sourceRoot = requiredEnvironmentPath("CHAMPIONSHIP_NITRO_SOURCE_ROOT");
const inventoryPath = requiredEnvironmentPath("CHAMPIONSHIP_3D_INVENTORY");
const apicula = requiredEnvironmentPath("CHAMPIONSHIP_APICULA");
for (const required of [registryPath, sourceRoot, inventoryPath, apicula]) {
  if (!fs.existsSync(required)) throw new Error(`Required input missing: ${required}`);
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const groups = registry.assets
  .filter((asset) => asset.domain === "VFX" && asset.originalRenderer === "NITRO_3D_VFX")
  .map((asset) => asset.logicalGroup)
  .sort();
if (groups.length !== 26 || new Set(groups).size !== 26) throw new Error(`Expected 26 unique VFX systems, found ${groups.length}`);

const inventory = parseCsv(fs.readFileSync(inventoryPath, "utf8"));
const supported = new Set([".nsbmd", ".nsbca", ".nsbta", ".nsbtp"]);
const systems = [];

for (const group of groups) {
  const sources = inventory.filter((row) => row.path.startsWith(`${group}.`));
  const model = sources.find((row) => row.ext === ".nsbmd");
  if (!model) throw new Error(`Missing NSBMD for ${group}`);
  for (const source of sources) {
    const sourcePath = path.join(sourceRoot, ...source.path.split("/"));
    if (!fs.existsSync(sourcePath) || fs.statSync(sourcePath).size !== Number(source.bytes) || hash(sourcePath) !== source.sha256) {
      throw new Error(`Source evidence mismatch: ${source.path}`);
    }
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `championship-vfx-${group.replaceAll("/", "-")}-`));
  const inputs = sources.filter((row) => supported.has(row.ext)).map((row) => path.join(sourceRoot, ...row.path.split("/")));
  execFileSync(apicula, ["convert", "-f=glb", ...inputs, "-o", temp, "--overwrite", "--more-textures"], { stdio: "pipe" });

  const destination = path.join(outputRoot, ...group.split("/"));
  fs.mkdirSync(destination, { recursive: true });
  const outputs = [];
  for (const generated of collectFiles(temp).sort()) {
    const output = path.join(destination, path.basename(generated));
    fs.copyFileSync(generated, output);
    const relative = path.relative(repo, output).split(path.sep).join("/");
    const record = { path: relative, bytes: fs.statSync(output).size, sha256: hash(output) };
    if (path.extname(output).toLowerCase() === ".glb") {
      const glb = readGlb(output);
      record.glb = {
        meshes: glb.meshes?.length ?? 0,
        nodes: glb.nodes?.length ?? 0,
        materials: glb.materials?.length ?? 0,
        animations: glb.animations?.length ?? 0,
        extensionsUsed: glb.extensionsUsed ?? [],
      };
      if (record.glb.meshes < 1) throw new Error(`Converted GLB has no mesh: ${relative}`);
    }
    outputs.push(record);
  }

  systems.push({
    systemId: group.replaceAll("/", "-"),
    logicalGroup: group,
    sources: sources.map((row) => ({ path: row.path, bytes: Number(row.bytes), sha256: row.sha256, converterInput: supported.has(row.ext) })),
    outputs,
    unsupportedSourceFormats: sources.filter((row) => !supported.has(row.ext)).map((row) => row.ext),
    evidenceStatus: "VERIFIED_BINARY_REFERENCE",
    rightsStatus: "ROM_COPYRIGHTED_REFERENCE_RESEARCH_ONLY",
    runtimeEligible: false,
    shippingReady: false,
  });
}

const manifest = {
  schemaVersion: 1,
  bundleId: "championship-vfx-faithful-reference-26",
  generatedBy: "scripts/build-vfx-faithful-reference-26.mjs",
  converter: execFileSync(apicula, ["-V"], { encoding: "utf8" }).trim().split(/\r?\n/),
  sourcePayloadIncluded: false,
  systemCount: systems.length,
  rightsStatus: "ROM_COPYRIGHTED_REFERENCE_RESEARCH_ONLY",
  runtimeEligible: false,
  shippingReady: false,
  limitation: "Converted motion is authoritative only where apicula decoded it; NSBMA/NSBVA and caller timing remain UNKNOWN_REQUIRES_TRACE.",
  systems,
};
fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${systems.length} research-gated VFX systems with ${systems.flatMap((system) => system.outputs).length} outputs.`);
