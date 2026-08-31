import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const defaultOut = path.join(repoRoot, "assets/production/vfx/original-rom-conversion-v1");
const defaultReceipt = path.join(repoRoot, "docs/art/production/vfx/ORIGINAL_ROM_CONVERSION_V1_RECEIPT.json");
const rightsEvidenceId = "LIC-CHAMPIONSHIP-2026-001";

const systems = [
  {
    id: "gate_select",
    title: "Gate Select world map and separately evidenced Earth model",
    sources: [
      source("gate_select/3D_worldMap_model.nsbmd", 164912, "4852ce8731b9b221864d219870bcf7f5f0332645d429893c107b4478e8fef539", true),
      source("gate_select/earth.nsbmd", 81620, "fc811f61f6093a3e35588267fa5dc3e0815a60772adde9bda43b797c27c2878b", true)
    ],
    outputs: {
      "3D_worldMap_mode.glb": "gate-world-map.glb",
      "earth.glb": "gate-earth.glb",
      "Map_fix_day.png": "Map_fix_day.png",
      "Map_fix_night.png": "Map_fix_night.png",
      "map.png": "map.png"
    },
    expectedGlb: {
      "gate-world-map.glb": { minimumMeshes: 1, minimumAnimations: 0 },
      "gate-earth.glb": { minimumMeshes: 1, minimumAnimations: 0 }
    },
    provenance: "OVL12 directly loads the verified Gate Select world-map model.",
    knownGaps: [
      "A verified full-ROM static trace found no Gate Select consumer for the separate Earth model; keep it reference-only and do not mount it at runtime.",
      "Camera, hit testing, day/night switching, and any code-driven motion remain unresolved."
    ]
  },
  {
    id: "hitspark_big",
    title: "Battle large hit spark",
    sources: [
      source("battle/hitspark_big.nsbmd", 8004, "37afdfaf92cc2d39fd13494a333c88de22f3314d18b8c586bf498b8d2f977d80", true),
      source("battle/hitspark_big.nsbca", 5544, "1d0dbb5b1caf0e146e0174caa017aa637fe17fc302be843dd16a85c4589158bf", true)
    ],
    outputs: {
      "hitspark_big.glb": "hitspark_big.glb",
      "hit_spark.png": "hit_spark.png",
      "ip_circle.png": "ip_circle.png"
    },
    expectedGlb: { "hitspark_big.glb": { minimumMeshes: 1, minimumAnimations: 1 } },
    provenance: "OVL19 uses hitspark_big through the verified five-entry battle effect table.",
    knownGaps: ["Exact trigger parameters, camera, and billboarding remain unresolved."]
  },
  {
    id: "hypereffect",
    title: "Battle hyper effect",
    sources: [
      source("battle/hypereffect.nsbmd", 6040, "8a0a651834ec0355871ba02d50687101c99d3954e6a355c2768631259ad407a3", true),
      source("battle/hypereffect.nsbca", 7012, "77a67b252958d036384250de85f0a4a62acfb5315e5f2d31d77b2482ff48fc03", true),
      source("battle/hypereffect.nsbva", 144, "b39d90d658d8884acbb7da20da4b847ffc4c75f25427c09baf90aa58ed510853", false)
    ],
    outputs: {
      "hypereffect.glb": "hypereffect.glb",
      "hitmark.png": "hitmark.png",
      "new1.png": "new1.png"
    },
    expectedGlb: { "hypereffect.glb": { minimumMeshes: 1, minimumAnimations: 1 } },
    provenance: "OVL19 directly loads the verified battle hyper-effect model.",
    knownGaps: [
      "The source NSBVA visibility timeline is preserved by hash but unsupported by this converter.",
      "Exact trigger parameters and final camera remain unresolved."
    ]
  },
  {
    id: "spark",
    title: "Common spark effect",
    sources: [
      source("common/spark.nsbmd", 5484, "daa29e97794556ce9a82eb8238f8394329e13aea80dcddd83a143804ab9288e3", true),
      source("common/spark.nsbta", 4236, "bbc0902a7933a6dbf7477c656fe17567e41e0e96bb87bf6f97a1d16393b732b0", true),
      source("common/spark.nsbma", 2172, "d3e2f348488a7b59536846400f86e049eec19ab63f0a8ce97630dfadf5f55bce", false)
    ],
    outputs: {
      "spark.glb": "spark.glb",
      "m_spark_eff.png": "m_spark_eff.png"
    },
    expectedGlb: { "spark.glb": { minimumMeshes: 1, minimumAnimations: 1 } },
    provenance: "Verified common effect asset; the exact original caller remains unresolved.",
    knownGaps: [
      "NSBTA conversion is experimental and uses glTF property-animation extensions.",
      "The source NSBMA values are preserved by hash but unsupported by this converter."
    ]
  },
  {
    id: "rain",
    title: "Common rain effect",
    sources: [
      source("common/rain.nsbmd", 4744, "a76fa17cab0218cc3807a9eab3fb9f7bd01e7e89494e55cad05e87d9cfb29a9c", true),
      source("common/rain.nsbta", 644, "0bfa8df446d56cd4ac4a0cebdea37563324946eee411fdb288c123e20f92e248", true)
    ],
    outputs: {
      "rain.glb": "rain.glb",
      "rain_eff.png": "rain_eff.png"
    },
    expectedGlb: { "rain.glb": { minimumMeshes: 1, minimumAnimations: 1 } },
    provenance: "Verified common weather asset; the exact original caller remains unresolved.",
    knownGaps: [
      "NSBTA conversion is experimental and uses glTF property-animation extensions.",
      "Weather activation, projection, and camera remain unresolved."
    ]
  }
];

function source(relativePath, size, sha256, converterInput) {
  return { relativePath, size, sha256, converterInput };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split("=", 2);
    values[key] = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
  }
  return values;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function readGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`Invalid GLB 2.0 output: ${filePath}`);
  }
  if (bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`GLB length mismatch: ${filePath}`);
  }
  let offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "JSON") {
      const json = bytes.subarray(offset + 8, offset + 8 + length).toString("utf8").replace(/\0+|\s+$/g, "");
      return JSON.parse(json);
    }
    offset += 8 + length;
  }
  throw new Error(`GLB JSON chunk missing: ${filePath}`);
}

const args = parseArgs(process.argv.slice(2));
const sourceRootValue = args["source-root"] ?? process.env.CHAMPIONSHIP_NITRO_SOURCE_ROOT;
const apiculaValue = args.apicula ?? process.env.CHAMPIONSHIP_APICULA;
const sourceRoot = sourceRootValue ? path.resolve(sourceRootValue) : null;
const apiculaPath = apiculaValue ? path.resolve(apiculaValue) : null;
const outRoot = path.resolve(args.out ?? defaultOut);
const receiptPath = path.resolve(args.receipt ?? defaultReceipt);

if (!sourceRoot || !fs.statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error("Provide --source-root <raw_3d_assets> or CHAMPIONSHIP_NITRO_SOURCE_ROOT.");
}
if (!apiculaPath || !fs.statSync(apiculaPath, { throwIfNoEntry: false })?.isFile()) {
  throw new Error("Provide --apicula <apicula.exe> or CHAMPIONSHIP_APICULA.");
}

const toolVersion = execFileSync(apiculaPath, ["-V"], { encoding: "utf8" }).trim();
if (!toolVersion.includes("apicula 0.1.1-dev") || !toolVersion.includes("3d4e91e")) {
  throw new Error(`Unexpected apicula build:\n${toolVersion}`);
}

for (const system of systems) {
  for (const item of system.sources) {
    const sourcePath = path.join(sourceRoot, ...item.relativePath.split("/"));
    const stat = fs.statSync(sourcePath, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size !== item.size || sha256(sourcePath) !== item.sha256) {
      throw new Error(`Source verification failed: ${item.relativePath}`);
    }
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "championship-vfx-v1-"));
const manifestSystems = [];

for (const system of systems) {
  const conversionOut = path.join(tempRoot, system.id);
  const inputPaths = system.sources
    .filter((item) => item.converterInput)
    .map((item) => path.join(sourceRoot, ...item.relativePath.split("/")));

  execFileSync(apiculaPath, [
    "convert",
    "-f=glb",
    ...inputPaths,
    "-o",
    conversionOut,
    "--overwrite",
    "--more-textures"
  ], { stdio: "inherit" });

  const destinationDir = path.join(outRoot, system.id);
  fs.mkdirSync(destinationDir, { recursive: true });
  const convertedOutputs = [];

  for (const [generatedName, destinationName] of Object.entries(system.outputs)) {
    const generatedPath = path.join(conversionOut, generatedName);
    if (!fs.statSync(generatedPath, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Expected converter output missing: ${system.id}/${generatedName}`);
    }
    const destinationPath = path.join(destinationDir, destinationName);
    fs.copyFileSync(generatedPath, destinationPath);

    const glbExpectation = system.expectedGlb[destinationName];
    let glb = null;
    if (glbExpectation) {
      const model = readGlb(destinationPath);
      const meshCount = model.meshes?.length ?? 0;
      const animationCount = model.animations?.length ?? 0;
      if (meshCount < glbExpectation.minimumMeshes || animationCount < glbExpectation.minimumAnimations) {
        throw new Error(`GLB content verification failed: ${system.id}/${destinationName}`);
      }
      glb = {
        meshes: meshCount,
        nodes: model.nodes?.length ?? 0,
        materials: model.materials?.length ?? 0,
        animations: animationCount,
        extensionsUsed: model.extensionsUsed ?? []
      };
    }

    convertedOutputs.push({
      path: toPosix(path.relative(repoRoot, destinationPath)),
      size: fs.statSync(destinationPath).size,
      sha256: sha256(destinationPath),
      ...(glb ? { glb } : {})
    });
  }

  manifestSystems.push({
    systemId: system.id,
    title: system.title,
    runtimeCandidate: true,
    runtimeRegistryEnabled: false,
    shippingReady: false,
    provenance: system.provenance,
    outputs: convertedOutputs,
    knownGaps: system.knownGaps
  });
}

const manifest = {
  schemaVersion: 1,
  bundleId: "championship-vfx-original-rom-conversion-v1",
  format: "GLB_2_0_AND_PNG",
  conversionStatus: "COMPLETE_WITH_KNOWN_FORMAT_GAPS",
  rightsEvidenceId,
  rightsStatus: "OWNER_AUTHORIZATION_RECORDED_DOCUMENT_LINK_PENDING",
  runtimeCandidate: true,
  runtimeRegistryEnabled: false,
  shippingReady: false,
  sourcePayloadIncluded: false,
  converter: "apicula 0.1.1-dev / 3d4e91e",
  systems: manifestSystems
};

fs.mkdirSync(outRoot, { recursive: true });
fs.writeFileSync(path.join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const receipt = {
  schemaVersion: 1,
  receiptId: "championship-vfx-original-rom-conversion-v1-receipt",
  bundleId: manifest.bundleId,
  rightsEvidenceId,
  sourcePayloadIncluded: false,
  sourceLocationIncluded: false,
  tool: {
    version: toolVersion.split(/\r?\n/),
    executableSha256: sha256(apiculaPath),
    upstreamLicense: "0BSD",
    upstream: "https://github.com/scurest/apicula"
  },
  systems: manifestSystems.map((builtSystem) => {
    const system = systems.find((candidate) => candidate.id === builtSystem.systemId);
    return {
      systemId: system.id,
      sources: system.sources,
      outputs: builtSystem.outputs.map(({ path: outputPath, size, sha256: outputSha256 }) => ({
        path: outputPath,
        size,
        sha256: outputSha256
      }))
    };
  })
};
fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Built ${manifestSystems.length} converted VFX systems at ${outRoot}`);
console.log(`Wrote conversion receipt at ${receiptPath}`);
