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
//
// Water (Owner 2026-11-02, beaches back to their 10/06 showcase look): a map whose
// spec adds `water: { h0, edges }` keeps its coast field in the alpha channel.
// A = 1 is dry land (every other map is opaque, so nothing else changes); lower A is
// water, h = h0 + (1 - A) * (1 - h0) with 0.5 the shoreline. The shader paints the
// showcase sea from it: shallow-to-deep colour, white wave bands, foam on the shore
// and around reef rocks, and small sparkles, all from the one texture fetch. Bands
// fade out as they approach pixel size so they never shimmer; that size comes from
// the fixed orthographic camera (a uniform), not from derivatives, which jump at the
// millimetre steps where two beaches meet and drew a dotted line there. `edges` are
// the model-space spans of the cage's outer edge that its water reaches (waterfalls).

export const CAGE_GROUND_MAP_VERSION = 1;
const CACHE_KEY = 'cage-ground-map-v1';
const WATER_KEY = 'cage-ground-water-v1';

/** The validated water part of a ground-map spec, or null. */
function cageGroundWaterSpec(water) {
  if (!water || typeof water !== 'object') return null;
  const { h0 } = water;
  if (!Number.isFinite(h0) || h0 <= 0 || h0 >= 0.4) return null;
  const edges = (Array.isArray(water.edges) ? water.edges : [])
    .filter((e) => Array.isArray(e) && e.length === 4 && e.every(Number.isFinite)).map((e) => e.slice());
  return { h0, edges };
}

/** The validated ground-map spec of a material, or null. */
export function cageGroundMapSpec(material) {
  const spec = material?.userData?.cageGroundMap;
  if (!spec || spec.version !== CAGE_GROUND_MAP_VERSION || !Number.isInteger(spec.texture) || spec.texture < 0) return null;
  const b = spec.bounds;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite) || !(b[2] > b[0]) || !(b[3] > b[1])) return null;
  const water = cageGroundWaterSpec(spec.water);
  return water ? { texture: spec.texture, bounds: b.slice(), water } : { texture: spec.texture, bounds: b.slice() };
}

/**
 * Load the ground maps a parsed GLB declares. Returns Map(materialName -> { texture, bounds, water }).
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
    maps.set(material.name, { texture, bounds: spec.bounds, water: spec.water ?? null });
  }
  return maps;
}

/** Model-space water spans of a parsed GLB's ground maps: [[x0, z0, x1, z1], ...]. */
export function cageGroundWaterEdges(maps) {
  const edges = [];
  for (const entry of maps?.values?.() ?? []) for (const e of entry.water?.edges ?? []) edges.push(e);
  return edges;
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

// The 10/06 showcase sea (cs-sea material): colour ramp 0.08,0.5,0.6 -> 0.015,0.14,0.42
// over h 0.5..0.95; wave bands along the master's X at 44 rad per unit, distorted by
// 9 x fractal noise at 2.2 per unit; foam where h + wave wobble falls in 0.46..0.62;
// sparkles from cells at 6.5 per unit. Waves use world x, -z, so they run on unbroken
// across two beaches that share an edge; the coast comes from each cage's own map.
const WATER_VERTEX_HEAD = 'varying vec2 vCageGroundXZ;\nvarying vec2 vCageWaterXZ;\nvarying float vCageGroundY;\n';
const WATER_VERTEX = `${CAGE_GROUND_VERTEX}\n\tvCageWaterXZ = ( modelMatrix * vec4( position, 1.0 ) ).xz;\n\tvCageGroundY = position.y;`;
const WATER_HEAD = `varying vec2 vCageWaterXZ;
varying float vCageGroundY;
uniform float uCageGroundH0;
uniform float uCageGroundTime;
uniform float uCageGroundPixel;
vec2 cageWaterHash( vec2 p ) {
	p = vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) );
	return fract( sin( p ) * 43758.5453 );
}
float cageWaterNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f );
	float a = dot( cageWaterHash( i ) * 2.0 - 1.0, f );
	float b = dot( cageWaterHash( i + vec2( 1.0, 0.0 ) ) * 2.0 - 1.0, f - vec2( 1.0, 0.0 ) );
	float c = dot( cageWaterHash( i + vec2( 0.0, 1.0 ) ) * 2.0 - 1.0, f - vec2( 0.0, 1.0 ) );
	float d = dot( cageWaterHash( i + vec2( 1.0, 1.0 ) ) * 2.0 - 1.0, f - vec2( 1.0, 1.0 ) );
	return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float cageWaterFbm( vec2 p ) {
	float sum = 0.0, amp = 1.0, norm = 0.0;
	for ( int i = 0; i < 3; i ++ ) { sum += amp * cageWaterNoise( p ); norm += amp; amp *= 0.5; p *= 2.0; }
	return clamp( 0.5 + 0.75 * sum / norm, 0.0, 1.0 );
}
vec3 cageGroundWater( vec3 land, float coast, vec2 xz, vec2 pixel ) {   // xz: world
	float h = uCageGroundH0 + ( 1.0 - coast ) * ( 1.0 - uCageGroundH0 );
	float sea = clamp( ( h - 0.4 ) * 10.0, 0.0, 1.0 );
	if ( sea <= 0.0 ) return land;
	vec2 p = vec2( xz.x, - xz.y );
	float t = uCageGroundTime;
	float n = p.x * 44.0 + 9.0 * ( cageWaterFbm( p * 2.2 ) * 2.0 - 1.0 ) - t * 1.2;
	float band = 1.0 - smoothstep( 1.0, 2.6, 74.0 * max( pixel.x, pixel.y ) );
	float w = 0.5 + 0.5 * sin( n - 1.5708 );
	float stripes = clamp( ( w - 0.78 ) / 0.2, 0.0, 1.0 ) * 0.32 * band;
	float wave = mix( 0.5, w, band );
	float depth = clamp( ( h - 0.5 ) / 0.45, 0.0, 1.0 );
	// The showcase sea also glowed (emission 0.3 of its colour); lift it the same way.
	vec3 base = mix( vec3( 0.08, 0.5, 0.6 ), vec3( 0.015, 0.14, 0.42 ), depth ) * 1.3;
	float foam = 1.0 - clamp( ( h + ( wave - 0.5 ) * 0.1 + 0.01 * sin( t * 0.9 ) - 0.46 ) / 0.16, 0.0, 1.0 );
	float spark = 0.0;
#ifdef CAGE_GROUND_SPARKLE
	vec2 s = p * 6.5, cell = floor( s ), f = fract( s );
	float dmin = 8.0;
	for ( int y = - 1; y <= 1; y ++ ) for ( int x = - 1; x <= 1; x ++ ) {
		vec2 g = vec2( float( x ), float( y ) );
		vec2 r = cageWaterHash( cell + g );
		vec2 o = 0.5 + 0.5 * sin( t * 0.8 + 6.2831 * r );
		// Only about one cell in twenty glints at a time, like the showcase's few sparkles.
		float lit = step( 0.95, fract( r.x * 7.13 + floor( t * 0.35 + r.y ) * 0.37 ) );
		dmin = min( dmin, mix( 8.0, length( g + o - f ), lit ) );
	}
	float aa = 6.5 * ( pixel.x + pixel.y );
	spark = ( 1.0 - smoothstep( 0.07, 0.07 + aa, dmin ) ) * ( 1.0 - smoothstep( 0.12, 0.3, aa ) ) * ( 1.0 - foam );
#endif
	float white = max( stripes, max( spark, foam ) );
	return mix( land, mix( base, vec3( 0.92, 0.97, 1.0 ), white ), sea );
}
`;
export const CAGE_GROUND_WATER_FRAGMENT = `#include <map_fragment>
#ifdef USE_METALNESSMAP
	// Every ground layer (model height up to 2 cm: floor, sea sheets, their thin side faces
	// and the joint) takes the map whatever its atlas texel, so no edge texel draws a line.
	float cageGroundCover = max( texture2D( metalnessMap, vMetalnessMapUv ).r, step( vCageGroundY, 0.02 ) );
	vec4 cageGroundTexel = texture2D( uCageGroundMap, ( vCageGroundXZ - uCageGroundBounds.xy ) * uCageGroundBounds.zw );
	vec2 cageGroundPixel = vec2( uCageGroundPixel );
	vec3 cageGroundColor = cageGroundWater( cageGroundTexel.rgb, cageGroundTexel.a, vCageWaterXZ, cageGroundPixel );
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * cageGroundColor, cageGroundCover );
#endif`;

// Water and wet sand are flat: every texel the map covers is lit as if it faced up,
// so the millimetre steps where two beaches' floors and sea sheets meet shade like
// the water around them instead of drawing a line.
export const CAGE_GROUND_WATER_NORMAL = `#include <normal_fragment_maps>
#ifdef USE_METALNESSMAP
	if ( cageGroundCover > 0.5 ) normal = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
#endif`;

/**
 * Hook every material under `root` that has a loaded ground map (`maps` from
 * loadCageGroundMaps, keyed by material name, so per-placement material clones
 * are covered too). Chains any hook already installed (authored water, lava,
 * wind) and keeps its cache key. Water maps share `time` (a { value } uniform;
 * the caller holds it at 0 for reduced motion) and `pixel` (a { value } uniform:
 * the ground size of one screen pixel), and drop the sparkles when `sparkle` is
 * false. Returns the number of materials hooked.
 */
export function installCageGroundMap(root, maps, { time = null, pixel = null, sparkle = true } = {}) {
  if (!root || !maps?.size) return 0;
  let hooked = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const material of [].concat(mesh.material ?? [])) {
      const entry = material && maps.get(material.name);
      if (!entry || !cageGroundMapSpec(material) || material.userData.cageGroundHooked || !material.metalnessMap) continue;
      const water = entry.water ?? null;
      const waterKey = water ? `|${WATER_KEY}${sparkle ? '+sparkle' : ''}` : '';
      material.userData.cageGroundHooked = CACHE_KEY + waterKey;
      const [x0, z0, x1, z1] = entry.bounds;
      const uniforms = { uCageGroundMap: { value: entry.texture }, uCageGroundBounds: { value: { x: x0, y: z0, z: 1 / (x1 - x0), w: 1 / (z1 - z0) } } };
      if (water) Object.assign(uniforms, { uCageGroundH0: { value: water.h0 }, uCageGroundTime: time ?? { value: 0 }, uCageGroundPixel: pixel ?? { value: .004 } });
      const previousHook = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey;
      material.onBeforeCompile = function cageGroundHook(shader, renderer) {
        if (typeof previousHook === 'function') previousHook.call(this, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = water
          ? WATER_VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', WATER_VERTEX)
          : VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', CAGE_GROUND_VERTEX);
        const head = water ? `${sparkle ? '#define CAGE_GROUND_SPARKLE\n' : ''}${FRAGMENT_HEAD}${WATER_HEAD}` : FRAGMENT_HEAD;
        shader.fragmentShader = head + shader.fragmentShader.replace('#include <map_fragment>', water ? CAGE_GROUND_WATER_FRAGMENT : CAGE_GROUND_FRAGMENT);
        if (water) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', CAGE_GROUND_WATER_NORMAL);
      };
      material.customProgramCacheKey = function cageGroundKey() {
        const base = typeof previousKey === 'function' ? previousKey.call(this) : '';
        return `${base}|${CACHE_KEY}${waterKey}`;
      };
      material.needsUpdate = true;
      hooked += 1;
    }
  });
  return hooked;
}
