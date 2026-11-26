// The CPU copy of the map's vertex data goes once it is on the GPU (2026-11-26, hunt refinement batch 5).
//
// three.js keeps every vertex and index array in JS after uploading it: 13-34 MB per hunt map that
// nothing reads again. The map never re-uploads: a lost context or a retired renderer sends the
// hunt to its 2D fallback (lifecycle.mjs), and nothing here ray-casts or edits the map's geometry.
// So each array is dropped in the attribute's own upload callback, the moment its GL buffer exists.
//
// The bounds three needs for culling are made first, while the positions are still readable
// (GLTFLoader already sets them from the accessor min/max; this covers a geometry that has none).

/**
 * @param roots objects whose mesh geometry is map scenery (the loaded GLB scene, instanced tree batches)
 * @returns diagnostics: how much is hooked, how much has been released so far
 */
export function releaseGeometryCopiesOnUpload(roots) {
  const geometries = new Set(), hooked = new Set();
  let pendingBytes = 0, releasedBytes = 0;
  const hook = (attribute) => {
    if (!attribute?.isBufferAttribute || attribute.isInterleavedBufferAttribute || hooked.has(attribute) || !attribute.array) return;
    hooked.add(attribute);
    pendingBytes += attribute.array.byteLength;
    const earlier = attribute.onUploadCallback;
    attribute.onUpload(function onUploaded() {
      earlier?.call(this);
      if (!this.array) return;
      const bytes = this.array.byteLength;
      pendingBytes -= bytes; releasedBytes += bytes;
      this.array = null;
    });
  };
  for (const root of roots) root?.traverse?.((object) => {
    const geometry = object.isMesh ? object.geometry : null;
    if (!geometry?.isBufferGeometry || geometries.has(geometry)) return;
    geometries.add(geometry);
    if (!geometry.attributes.position?.array) return;       // nothing to read bounds from: leave it alone
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    if (Object.keys(geometry.morphAttributes ?? {}).length) return;   // morph data is read on the CPU
    for (const attribute of Object.values(geometry.attributes)) hook(attribute);
    hook(geometry.index);
  });
  return Object.freeze({
    diagnostics: () => ({ geometries: geometries.size, attributes: hooked.size, pendingBytes, releasedBytes })
  });
}
