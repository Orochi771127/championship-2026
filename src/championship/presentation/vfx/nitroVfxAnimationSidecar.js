function sourceFrame(frame, frameCount) {
  if (!Number.isFinite(frame) || !Number.isInteger(frameCount) || frameCount < 1) return 0;
  return ((Math.floor(frame) % frameCount) + frameCount) % frameCount;
}

function sampleRun(channel, frame) {
  if (channel.storage === "constant") return channel.value;
  const run = channel.runs.find((candidate) => frame >= candidate.startFrame && frame <= candidate.endFrame);
  if (!run) throw new Error(`No material-animation run covers source frame ${frame}.`);
  return run.value;
}

export function sampleNitroVisibility(sidecar, frame) {
  const normalized = sourceFrame(frame, sidecar.frameCount);
  const bits = sidecar.frames[normalized];
  if (typeof bits !== "string" || bits.length !== sidecar.nodeCount) throw new Error("Invalid visibility sidecar frame.");
  return Object.fromEntries(sidecar.nodeNames.map((name, index) => [name, bits[index] === "1"]));
}

export function applyNitroVisibility(root, sidecar, frame) {
  const visibility = sampleNitroVisibility(sidecar, frame);
  for (const [name, visible] of Object.entries(visibility)) {
    const node = root.getObjectByName?.(name);
    if (!node) throw new Error(`Visibility target is missing from the model: ${name}`);
    node.visible = visible;
  }
  return visibility;
}

export function sampleNitroMaterialAnimation(sidecar, frame) {
  const normalized = sourceFrame(frame, sidecar.frameCount);
  return sidecar.tracks.map((track) => ({
    materialName: track.materialName,
    polygonAlpha: sampleRun(track.channels.polygonAlpha, normalized),
    polygonAlphaDenominator: track.channels.polygonAlpha.denominator,
    diffuseRgb8: track.channels.diffuse.rgb8
  }));
}

export function applyNitroMaterialAnimation(root, sidecar, frame) {
  const samples = sampleNitroMaterialAnimation(sidecar, frame);
  const materials = new Map();
  root.traverse?.((object) => {
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) if (material?.name) materials.set(material.name, material);
  });

  for (const sample of samples) {
    const material = materials.get(sample.materialName);
    if (!material) throw new Error(`Material-animation target is missing from the model: ${sample.materialName}`);
    material.opacity = sample.polygonAlpha / sample.polygonAlphaDenominator;
    material.transparent = sample.polygonAlpha < sample.polygonAlphaDenominator;
    const [red, green, blue] = sample.diffuseRgb8;
    material.color?.setRGB?.(red / 255, green / 255, blue / 255);
    material.needsUpdate = true;
  }
  return samples;
}
