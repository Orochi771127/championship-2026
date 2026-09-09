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

const skinVisibilityBindings = new WeakMap();

function hyperSkinBinding(root, sidecar) {
  if (sidecar.animationName!=='hypereffect' || sidecar.nodeCount!==19) return null;
  if (skinVisibilityBindings.has(root)) return skinVisibilityBindings.get(root);
  const bindings=[];
  root.traverse?.(object=>{
    if (!object.isSkinnedMesh) return;
    const bones=object.skeleton.bones;
    // Original MDL0's 19 ordered names match all 19 GLB skin joints. The old
    // sidecar builder dropped world_root and appended the mesh wrapper instead.
    // BATTLE_HYPER_VISIBILITY_BINDING_2026-09-07 records the binary cross-check.
    if (bones.length!==19 || bones[0].name!=='world_root'
        || bones[18].name!=='pasted__pPlane33') throw new Error('Unverified Hyper skin layout');
    const indices=object.geometry.index, joint=object.geometry.getAttribute('skinIndex');
    const weight=object.geometry.getAttribute('skinWeight');
    if (!indices || !joint || !weight) throw new Error('Hyper visibility requires indexed skin weights');
    const used=new Set();
    for(let i=0;i<indices.count;i++){
      const vertex=indices.getX(i);
      for(const axis of ['X','Y','Z','W'])if(weight[`get${axis}`](vertex)>0)used.add(joint[`get${axis}`](vertex));
    }
    // Each audited primitive is rigidly bound to ONE original node. Applying
    // .visible to bones does not hide a skinned primitive in Three.js.
    if (used.size!==1) throw new Error('Hyper visibility has mixed-node geometry');
    bindings.push({object,index:[...used][0],names:bones.map(b=>b.name)});
  });
  const result=bindings.length ? bindings : null;
  skinVisibilityBindings.set(root,result);
  return result;
}

export function applyNitroVisibility(root, sidecar, frame) {
  const binding=hyperSkinBinding(root,sidecar);
  if (binding) {
    const bits=sidecar.frames[sourceFrame(frame,sidecar.frameCount)];
    if (bits?.length!==19) throw new Error('Invalid Hyper visibility frame');
    for(const {object,index} of binding)object.visible=bits[index]==='1';
    return Object.fromEntries(binding[0].names.map((name,index)=>[name,bits[index]==='1']));
  }
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
