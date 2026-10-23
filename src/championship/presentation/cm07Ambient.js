// CM07 presentation only. The ranch owns time, visibility and disposal.
export function createCm07Ambient(roots) {
  const materials = new Map(), lava = new Map(), smoke = [];
  let disposed = false;
  const remember = material => {
    if (!materials.has(material)) materials.set(material, {
      transparent: material.transparent, depthWrite: material.depthWrite,
      depthTest: material.depthTest, opacity: material.opacity,
      emissiveIntensity: material.emissiveIntensity,
    });
  };
  for (const root of roots) root.traverse(node => {
    const nodeMaterials = [].concat(node.material ?? []);
    for (const material of nodeMaterials) {
      if (material.name === 'field_cm07_01-terrain-pbr' && material.emissiveMap) {
        remember(material);
        if (!lava.has(material)) lava.set(material, new Set());
        lava.get(material).add(root);
      }
    }
    if (!node.name?.startsWith('volcano-smoke') || !nodeMaterials.some(m => m.name === 'el-smoke')) return;
    smoke.push({node, root, y: node.position.y, rotation: node.rotation.y,
      scale: node.scale.clone(), castShadow: node.castShadow, receiveShadow: node.receiveShadow,
      phase: Number(node.name.match(/(\d+)$/)?.[1] ?? 0) * 1.8});
    // Translucent vapour must not cast the old solid ball shadow over actors.
    node.castShadow = false; node.receiveShadow = false;
    for (const material of nodeMaterials.filter(m => m.name === 'el-smoke')) {
      remember(material);
      material.transparent = true; material.depthWrite = false;
      material.depthTest = true; material.opacity = 0.24; material.needsUpdate = true;
    }
  });
  function update({elapsedSeconds, visible = true, reducedMotion = false}) {
    if (disposed || !visible || !roots.some(root => root.visible)) return;
    if (!Number.isFinite(elapsedSeconds)) throw Error('CM07_FINITE_ABSOLUTE_TIME_REQUIRED');
    const time = Math.max(0, elapsedSeconds), omega = Math.PI / 2;
    for (const [material, owners] of lava) {
      if (![...owners].some(root => root.visible)) continue;
      // Existing emission mask only: no scrolling UVs, new shader or texture.
      material.emissiveIntensity = 1.2 * (reducedMotion ? 1 : 1 + 0.06 * Math.sin(time * omega));
    }
    for (const item of smoke) {
      if (!item.root.visible || !item.node.visible) continue;
      const wave = reducedMotion ? 0 : Math.sin(time * omega + item.phase);
      item.node.position.y = item.y + 0.07 * wave;
      item.node.rotation.y = item.rotation + 0.12 * wave;
      item.node.scale.copy(item.scale).multiplyScalar(1 + 0.045 * wave);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [material, state] of materials) {
      Object.assign(material, state); material.needsUpdate = true;
    }
    for (const item of smoke) {
      item.node.position.y = item.y; item.node.rotation.y = item.rotation;
      item.node.scale.copy(item.scale);
      item.node.castShadow = item.castShadow; item.node.receiveShadow = item.receiveShadow;
    }
    smoke.length = 0; lava.clear(); materials.clear();
  }
  return {update, dispose};
}
