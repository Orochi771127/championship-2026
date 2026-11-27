// Ranch HD-2D cast silhouette shadows (inspired by Hunt's actorShadows.mjs).
//
// Projects each visible partner's live animation frame onto the 3D floor along
// the ranch sun direction, matching the 3D cages and 3D cleaning robots so that
// 2D partners cast moving directional shadows when walking, jumping or emoting.
// Uses the partner's own packed atlas texture clamped to its frame UV bounds so
// adjacent cells never bleed, and stays strictly depth-tested against 3D props.

import * as THREE from '../../../node_modules/three/build/three.module.js';
import { ranchFrameUvBounds } from './ranchActorLight.js';

export const RANCH_CAST_SHADOW = Object.freeze({
  color: 0x101424,
  opacity: 0.28,
  maxReach: 0.95,
  floorOffsetY: 0.008
});

/** Ground offset (ox, oz) per unit of height along the directional sun ray. */
export function ranchCastShadowReach(sun) {
  const from = sun?.position, to = sun?.target?.position ?? { x: 0, y: 0, z: 0 };
  const lx = (from?.x ?? 0) - to.x;
  const ly = (from?.y ?? 0) - to.y;
  const lz = (from?.z ?? 0) - to.z;
  if (![lx, ly, lz].every(Number.isFinite) || ly <= 1e-6) return [0, 0];
  let ox = -lx / ly, oz = -lz / ly;
  const len = Math.hypot(ox, oz);
  if (len > RANCH_CAST_SHADOW.maxReach) {
    ox *= RANCH_CAST_SHADOW.maxReach / len;
    oz *= RANCH_CAST_SHADOW.maxReach / len;
  }
  return [ox, oz];
}

/**
 * Lay a vertical billboard quad onto the horizontal floor along `reach`,
 * matching PlaneGeometry(1, 1) vertex order: TL, TR, BL, BR.
 */
export function ranchCastShadowVertices({
  centerX, centerY, centerZ,
  width, height,
  rightX, rightZ,
  baseX, baseZ,
  floorY,
  reach
}) {
  const halfW = width * 0.5, halfH = height * 0.5;
  const corners = [
    [centerX - rightX * halfW, centerY + halfH, centerZ - rightZ * halfW], // TL
    [centerX + rightX * halfW, centerY + halfH, centerZ + rightZ * halfW], // TR
    [centerX - rightX * halfW, centerY - halfH, centerZ - rightZ * halfW], // BL
    [centerX + rightX * halfW, centerY - halfH, centerZ + rightZ * halfW]  // BR
  ];
  const rLen = Math.hypot(rightX, rightZ) || 1;
  const rx = rightX / rLen, rz = rightZ / rLen;
  const reachLen = Math.hypot(reach[0], reach[1]);
  let px = rx, pz = rz;
  if (reachLen > 1e-6) {
    px = -reach[1] / reachLen;
    pz = reach[0] / reachLen;
    if (px * rx + pz * rz < 0) { px = -px; pz = -pz; }
  }
  const out = new Float32Array(12);
  const yPlane = floorY + RANCH_CAST_SHADOW.floorOffsetY;
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = corners[i];
    const above = Math.max(0, y - floorY);
    const across = (x - baseX) * rx + (z - baseZ) * rz;
    out[i * 3] = baseX + px * across + above * reach[0];
    out[i * 3 + 1] = yPlane;
    out[i * 3 + 2] = baseZ + pz * across + above * reach[1];
  }
  return out;
}

function createRanchCastShadowMaterial(map, boundsUniform) {
  const material = new THREE.MeshBasicMaterial({
    map,
    color: RANCH_CAST_SHADOW.color,
    transparent: true,
    opacity: RANCH_CAST_SHADOW.opacity,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    toneMapped: false
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRanchShadowBounds = boundsUniform;
    shader.vertexShader = 'attribute float aShadowHeight;\nvarying float vShadowHeight;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vShadowHeight = aShadowHeight;'
    );
    shader.fragmentShader = 'varying float vShadowHeight;\nuniform vec4 uRanchShadowBounds;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
      {
        vec2 shTexel = 1.4 / vec2(textureSize(map, 0));
        vec2 bMin = uRanchShadowBounds.xy, bMax = uRanchShadowBounds.zw;
        vec2 uv0 = clamp(vMapUv, bMin, bMax);
        float a0 = texture2D(map, uv0).a;
        float a1 = texture2D(map, clamp(vMapUv + vec2(shTexel.x, 0.0), bMin, bMax)).a;
        float a2 = texture2D(map, clamp(vMapUv - vec2(shTexel.x, 0.0), bMin, bMax)).a;
        float a3 = texture2D(map, clamp(vMapUv + vec2(0.0, shTexel.y), bMin, bMax)).a;
        float a4 = texture2D(map, clamp(vMapUv - vec2(0.0, shTexel.y), bMin, bMax)).a;
        float softAlpha = a0 * 0.40 + (a1 + a2 + a3 + a4) * 0.15;
        diffuseColor.a *= softAlpha * (1.0 - 0.52 * clamp(vShadowHeight, 0.0, 1.0));
        if (diffuseColor.a < 0.01) discard;
      }
      #endif`
    );
  };
  material.customProgramCacheKey = () => 'ranch-cast-shadow-v1';
  return material;
}

export function createRanchCastShadows(scene) {
  const items = new Map();

  function release(item) {
    scene.remove(item.mesh);
    item.mesh.geometry.dispose();
    item.mesh.material.dispose();
  }

  function reset() {
    for (const item of items.values()) {
      item.seen = false;
      item.mesh.visible = false;
    }
  }

  function sync(key, {
    enabled = true,
    spriteItem,
    entry,
    map,
    uvArray,
    rawUvs,
    rightVec,
    sun
  }) {
    if (!enabled || !spriteItem?.seen || !map || !uvArray || !entry?.root?.visible) return;
    let item = items.get(key);
    if (!item) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      // PlaneGeometry vertex order: TL(1), TR(1), BL(0), BR(0).
      geometry.setAttribute('aShadowHeight', new THREE.BufferAttribute(new Float32Array([1, 1, 0, 0]), 1));
      const boundsUniform = { value: new THREE.Vector4(0, 0, 1, 1) };
      const material = createRanchCastShadowMaterial(map, boundsUniform);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      scene.add(mesh);
      item = { mesh, boundsUniform, map, seen: false };
      items.set(key, item);
    }

    if (item.map !== map) {
      item.mesh.material.map = map;
      item.mesh.material.needsUpdate = true;
      item.map = map;
    }

    const reach = ranchCastShadowReach(sun);
    const mesh = spriteItem.mesh;
    const floorY = entry.root.threeDecalHeight ?? entry.root.threeGroundHeight ?? 0;
    const verts = ranchCastShadowVertices({
      centerX: mesh.position.x,
      centerY: mesh.position.y,
      centerZ: mesh.position.z,
      width: mesh.scale.x,
      height: mesh.scale.y,
      rightX: rightVec.x,
      rightZ: rightVec.z,
      baseX: mesh.position.x,
      baseZ: mesh.position.z,
      floorY,
      reach
    });

    const posAttr = item.mesh.geometry.attributes.position;
    posAttr.array.set(verts);
    posAttr.needsUpdate = true;

    const uvAttr = item.mesh.geometry.attributes.uv;
    uvAttr.array.set(uvArray);
    uvAttr.needsUpdate = true;

    if (rawUvs) {
      const [uMin, vMin, uMax, vMax] = ranchFrameUvBounds(rawUvs);
      item.boundsUniform.value.set(uMin, vMin, uMax, vMax);
    }

    const lift = Math.max(0, (mesh.position.y - mesh.scale.y * 0.5) - floorY);
    const liftFade = Math.max(0.25, 1 - lift * 0.35);
    const alphaScale = (entry.shadow?.worldAlpha ?? 1) * (entry.groundShadowEllipses?.[0]?.alpha ?? 1);
    item.mesh.material.opacity = RANCH_CAST_SHADOW.opacity * liftFade * alphaScale;
    item.mesh.visible = item.mesh.material.opacity > 0.01;
    item.seen = true;
  }

  function prune() {
    for (const [key, item] of items) {
      if (!item.seen) {
        release(item);
        items.delete(key);
      }
    }
  }

  function dispose() {
    for (const item of items.values()) release(item);
    items.clear();
  }

  return { reset, sync, prune, dispose };
}
