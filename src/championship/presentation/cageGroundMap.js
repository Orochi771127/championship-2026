// Cage ground map (Owner 2026-10-28 ground standard). A cage GLB may carry one
// top-down colour map of its walkable ground, so the ground is no longer limited
// to the few texels it gets in the shared 1024 atlas (~9 px per world unit) and
// no ground sheet has to be stacked on the plate to change colour.
//
// Contract, per material (glTF material extras, read by GLTFLoader into userData):
//   cageGroundMap: { version: 1, texture: <glTF texture index>, bounds: [x0, z0, x1, z1] }
// The map covers the model-space XZ rectangle `bounds`, row 0 at z0 (glTF images are
// not flipped). The red channel of the material's metallic-roughness texture (glTF
// "occlusion", unused by this material) marks ground texels: 1 takes the map, 0 keeps
// the atlas. Props, markings and swatch faces stay on the atlas.
// The model must place its ground meshes with identity node transforms (checked by
// the export pipeline): the lookup uses the raw position attribute.

export const CAGE_GROUND_MAP_VERSION = 1;
const CACHE_KEY = 'cage-ground-map-v1';

/** The validated ground-map spec of a material, or null. */
export function cageGroundMapSpec(material) {
  const spec = material?.userData?.cageGroundMap;
  if (!spec || spec.version !== CAGE_GROUND_MAP_VERSION || !Number.isInteger(spec.texture) || spec.texture < 0) return null;
  const b = spec.bounds;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite) || !(b[2] > b[0]) || !(b[3] > b[1])) return null;
  return { texture: spec.texture, bounds: b.slice() };
}

/**
 * Load the ground maps a parsed GLB declares. Returns Map(materialName -> { texture, bounds }).
 * `three` is the THREE namespace; the textures are sRGB, clamped and mipmapped.
 */
export async function loadCageGroundMaps(gltf, three) {
  const maps = new Map();
  const materials = new Set();
  gltf.scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) if (m) materials.add(m); });
  for (const material of materials) {
    const spec = cageGroundMapSpec(material);
    if (!spec || maps.has(material.name)) continue;
    const texture = await gltf.parser.getDependency('texture', spec.texture);
    texture.colorSpace = three.SRGBColorSpace;
    texture.wrapS = texture.wrapT = three.ClampToEdgeWrapping;
    texture.flipY = false;
    texture.needsUpdate = true;
    maps.set(material.name, { texture, bounds: spec.bounds });
  }
  return maps;
}

const VERTEX_HEAD = 'varying vec2 vCageGroundXZ;\n';
const FRAGMENT_HEAD = 'uniform sampler2D uCageGroundMap;\nuniform vec4 uCageGroundBounds;\nvarying vec2 vCageGroundXZ;\n';
export const CAGE_GROUND_VERTEX = '#include <begin_vertex>\n\tvCageGroundXZ = position.xz;';
// Sampled unconditionally: no texture fetch inside divergent control flow.
export const CAGE_GROUND_FRAGMENT = `#include <map_fragment>
#ifdef USE_METALNESSMAP
	float cageGroundCover = texture2D( metalnessMap, vMetalnessMapUv ).r;
	vec3 cageGroundColor = texture2D( uCageGroundMap, ( vCageGroundXZ - uCageGroundBounds.xy ) * uCageGroundBounds.zw ).rgb;
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * cageGroundColor, cageGroundCover );
#endif`;

/**
 * Hook every material under `root` that has a loaded ground map (`maps` from
 * loadCageGroundMaps, keyed by material name, so per-placement material clones
 * are covered too). Chains any hook already installed (authored water, lava,
 * wind) and keeps its cache key. Returns the number of materials hooked.
 */
export function installCageGroundMap(root, maps) {
  if (!root || !maps?.size) return 0;
  let hooked = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const material of [].concat(mesh.material ?? [])) {
      const entry = material && maps.get(material.name);
      if (!entry || !cageGroundMapSpec(material) || material.userData.cageGroundHooked || !material.metalnessMap) continue;
      material.userData.cageGroundHooked = CACHE_KEY;
      const [x0, z0, x1, z1] = entry.bounds;
      const uniforms = { uCageGroundMap: { value: entry.texture }, uCageGroundBounds: { value: { x: x0, y: z0, z: 1 / (x1 - x0), w: 1 / (z1 - z0) } } };
      const previousHook = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey;
      material.onBeforeCompile = function cageGroundHook(shader, renderer) {
        if (typeof previousHook === 'function') previousHook.call(this, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', CAGE_GROUND_VERTEX);
        shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader.replace('#include <map_fragment>', CAGE_GROUND_FRAGMENT);
      };
      material.customProgramCacheKey = function cageGroundKey() {
        const base = typeof previousKey === 'function' ? previousKey.call(this) : '';
        return `${base}|${CACHE_KEY}`;
      };
      material.needsUpdate = true;
      hooked += 1;
    }
  });
  return hooked;
}
