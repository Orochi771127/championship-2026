import { validateCharacterOriginGeometry } from "./characterOriginGeometry.js";

const SIDES = ["main", "sub"];
const HASH = /^[a-f0-9]{64}$/i;
const TOKEN = /^[a-z0-9][a-z0-9_-]*$/i;
const GATES = { design: "APPROVED", motion: "PASS", technical: "PASS", normalPath: "PASS" };

function requireMatch(condition, reason) {
  if (!condition) throw new Error(`CHARACTER_REPLACEMENT_${reason}`);
}

export function safeCharacterAssetUrl(relative, documentUrl) {
  requireMatch(typeof relative === "string" && /^[a-zA-Z0-9_./-]+$/.test(relative)
    && !relative.startsWith("/") && relative.split("/").every((part) => part && part !== "." && part !== ".."), "INVALID_ASSET_PATH");
  const base = new URL(".", documentUrl);
  const result = new URL(relative, base);
  requireMatch(result.href.startsWith(base.href), "INVALID_ASSET_PATH");
  return result.href;
}

/** Production index is the only registration authority. This does not grant approval. */
export function selectCharacterAppearance({ entityId, descriptors, record, productionIndex, baselineMotionContracts, baselineOriginGeometryContracts = {}, manifestUrl, baselineManifestPath }) {
  const matches = descriptors.filter((item) => item?.entityId === entityId);
  if (!matches.length) return null;
  requireMatch(matches.length === 1, "DUPLICATE_ENTITY");
  const descriptor = matches[0];
  const manifest = descriptor.manifest;
  const entries = productionIndex.entries.filter((item) => item.assetId === descriptor.assetId);
  requireMatch(entries.length === 1, "NOT_REGISTERED");
  const entry = entries[0];
  const hash = baselineMotionContracts[entityId];
  requireMatch(HASH.test(hash ?? ""), "BASELINE_MOTION_HASH_REQUIRED");
  requireMatch(manifest && entry.entityId === entityId && manifest.entityId === entityId
    && manifest.assetId === descriptor.assetId && entry.manifestPath === descriptor.manifestPath, "IDENTITY_MISMATCH");
  requireMatch(TOKEN.test(manifest.designVersion ?? "") && manifest.designVersion === entry.designVersion, "VERSION_MISMATCH");
  for (const value of [entry, manifest]) {
    requireMatch(value.runtimeEligible === true && value.publicReleasePermitted === false
      && value.shippingReady === false && value.humanApproved === true, "NOT_APPROVED_FOR_INTERNAL_RUNTIME");
    requireMatch(Object.entries(GATES).every(([key, expected]) => value.qa?.[key] === expected), "QA_REQUIRED");
    requireMatch(value.motionContractSha256?.toLowerCase() === hash.toLowerCase(), "MOTION_HASH_MISMATCH");
  }
  requireMatch(/^assets\/production\/characters\/appearance-refresh-v1\/[a-z0-9_-]+\/[a-z0-9_-]+\/manifest\.json$/i.test(descriptor.manifestPath), "INVALID_MANIFEST_PATH");
  requireMatch(manifest.runtime === "runtime.json", "INVALID_RUNTIME_PATH");
  for (const side of SIDES) {
    requireMatch(manifest.sides?.[side]?.cells === record.sides[side].cells
      && manifest.sides[side].sequences === record.sides[side].sequences
      && Number.isSafeInteger(manifest.sides[side].rgbaBytes) && manifest.sides[side].rgbaBytes > 0, "INCOMPLETE_SIDES");
  }
  let originGeometry = null;
  if (manifest.originGeometry || manifest.geometryContractSha256) {
    requireMatch(manifest.originGeometry && HASH.test(manifest.geometryContractSha256 ?? "")
      && baselineOriginGeometryContracts[entityId]?.toLowerCase() === manifest.geometryContractSha256.toLowerCase(), "GEOMETRY_NOT_REGISTERED");
    requireMatch(entry.geometryContractSha256?.toLowerCase() === manifest.geometryContractSha256.toLowerCase()
      && entry.qa?.geometry === "PASS" && manifest.qa?.geometry === "PASS", "GEOMETRY_QA_REQUIRED");
    originGeometry = manifest.originGeometry;
  }
  const baselineUrl = new URL(manifestUrl);
  requireMatch(baselineUrl.pathname.endsWith(`/${baselineManifestPath}`)
    && !baselineUrl.search && !baselineUrl.hash && ["http:", "https:", "file:"].includes(baselineUrl.protocol), "INVALID_BASE_URL");
  const root = new URL(baselineUrl.href.slice(0, -baselineManifestPath.length));
  const replacementManifestUrl = safeCharacterAssetUrl(descriptor.manifestPath, root);
  return Object.freeze({ manifest, originGeometry, geometryContractSha256: manifest.geometryContractSha256,
    expectedGeometryContractSha256: baselineOriginGeometryContracts[entityId], runtimeUrl: safeCharacterAssetUrl(manifest.runtime, replacementManifestUrl),
    cachePrefix: `appearance:${descriptor.assetId}:${manifest.designVersion}:${hash}:${originGeometry ? `origin:${manifest.geometryContractSha256}:` : ""}${entityId}:` });
}

function motion(runtime) {
  return SIDES.map((side) => ({ side, animations: runtime.sides[side].animations.map((animation) => ({
    id: animation.id, name: animation.name, semanticAlias: animation.semanticAlias,
    playbackMode: animation.playbackMode, loopStartFrame: animation.loopStartFrame ?? 0,
    frames: animation.frames.map((frame) => ({ cell: frame.cell, ticks: frame.ticks, texture: frame.texture }))
  })) }));
}

/** Compare actual loaded content, not just manifests asserting the same hash. */
export async function createCharacterAppearanceGuard({ entityId, record, baselineRuntime, originGeometry = null,
  geometryContractSha256, expectedGeometryContractSha256, motionContractSha256 }) {
  const geometry = originGeometry ? await validateCharacterOriginGeometry({ geometry: originGeometry,
    geometryContractSha256, expectedGeometryContractSha256, entityId, baselineRuntime, record, motionContractSha256 }) : null;
  const logicalCanvas = geometry?.logicalCanvas ?? baselineRuntime.artProfile.logicalCanvas;
  const anchor = geometry?.anchor ?? baselineRuntime.artProfile.anchor;
  const keys = Object.fromEntries(SIDES.map((side) => [side, new Set()]));
  return Object.freeze({
    safeUrl: safeCharacterAssetUrl,
    validateRuntime(runtime) {
      requireMatch(!runtime.frames && !runtime.meta?.image, "INVALID_RUNTIME_DOCUMENT");
      requireMatch(baselineRuntime.entityId === entityId && runtime.entityId === entityId, "RUNTIME_IDENTITY_MISMATCH");
      requireMatch(runtime.artProfile?.runtimeEligible === true && runtime.artProfile?.publicReleasePermitted === false, "RUNTIME_NOT_ELIGIBLE");
      requireMatch(JSON.stringify(runtime.artProfile.logicalCanvas) === JSON.stringify(logicalCanvas)
        && JSON.stringify(runtime.artProfile.anchor) === JSON.stringify(anchor), "PLACEMENT_DRIFT");
      requireMatch(JSON.stringify(motion(runtime)) === JSON.stringify(motion(baselineRuntime)), "MOTION_CONTENT_DRIFT");
      for (const side of SIDES) {
        requireMatch(runtime.sides[side].atlases.length > 0, "INCOMPLETE_SIDES");
      }
    },
    validateAtlas(side, data, atlas, runtimeUrl) {
      requireMatch(data && typeof data.frames === "object" && !Array.isArray(data.frames), "INVALID_ATLAS");
      const dataUrl = safeCharacterAssetUrl(atlas.data, runtimeUrl);
      requireMatch(safeCharacterAssetUrl(data.meta?.image, dataUrl) === safeCharacterAssetUrl(atlas.image, runtimeUrl)
        && !data.meta?.related_multi_packs?.length, "INVALID_ATLAS_DEPENDENCY");
      requireMatch(Number.isInteger(data.meta?.size?.w) && data.meta.size.w > 0 && data.meta.size.w <= 2048
        && Number.isInteger(data.meta?.size?.h) && data.meta.size.h > 0 && data.meta.size.h <= 2048, "ATLAS_PAGE_LIMIT");
      const atlasResolution = data.meta.scale;
      requireMatch(((typeof atlasResolution === "number" && Number.isFinite(atlasResolution))
        || (typeof atlasResolution === "string" && /^[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i.test(atlasResolution)))
        && Number(atlasResolution) > 0 && Number(atlasResolution) === (geometry?.resolution ?? 1), "ATLAS_RESOLUTION_DRIFT");
      for (const [key, frame] of Object.entries(data.frames)) {
        requireMatch(!keys[side].has(key), "DUPLICATE_CELL");
        keys[side].add(key);
        requireMatch(frame.sourceSize?.w === logicalCanvas[0]
          && frame.sourceSize?.h === logicalCanvas[1], "CELL_CANVAS_DRIFT");
        const rect = frame.frame;
        const trim = frame.spriteSourceSize;
        requireMatch(frame.rotated === false, "ROTATED_CELL_UNSUPPORTED");
        requireMatch(rect && [rect.x, rect.y, rect.w, rect.h].every(Number.isInteger)
          && rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0
          && rect.x + rect.w <= data.meta.size.w && rect.y + rect.h <= data.meta.size.h, "INVALID_FRAME_RECT");
        requireMatch(trim && [trim.x, trim.y, trim.w, trim.h].every(Number.isInteger)
          && trim.x >= 0 && trim.y >= 0 && trim.w === rect.w && trim.h === rect.h
          && trim.x + trim.w <= frame.sourceSize.w && trim.y + trim.h <= frame.sourceSize.h, "INVALID_TRIM_RECT");
        if (frame.anchor) requireMatch(frame.anchor.x === anchor.x
          && frame.anchor.y === anchor.y, "CELL_ANCHOR_DRIFT");
      }
    },
    validateComplete() {
      for (const side of SIDES) {
        const count = record.sides[side].cells;
        requireMatch(keys[side].size === count && Array.from({ length: count }, (_, cell) => (
          keys[side].has(`${entityId}/${side}/cell_${String(cell).padStart(3, "0")}`)
        )).every(Boolean), "INCOMPLETE_CELL_KEYS");
      }
    }
  });
}
