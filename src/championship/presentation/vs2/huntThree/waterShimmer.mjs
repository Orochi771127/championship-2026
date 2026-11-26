// Water that moves (2026-11-26, hunt refinement batch 3).
//
// The lake, sea, swamp, sewer and ice-water surfaces of the hunt maps were still pictures. Each
// keeps its own material and colours; this adds short light dashes that slide along the screen's
// horizontal and twinkle, the usual drawn-water glint. They are computed in the material's own
// fragment shader from the world position: no new assets, no extra draw call, no texture. Saver
// quality and reduced motion keep the delivered still look.
//
// Only named water materials of the GLB maps are touched. The lava of hm15 already swaps phase
// pictures, and the two pre-baked maps (hm01, hm08) carry their water in the baked frames.
import { huntAmbientAllowed } from './ambientLife.mjs';

/**
 * tint: glint colour (sRGB hex); row: height of a row of dashes and len: length of a dash cell,
 * both in world px; speed: cells per second; density: share of cells that carry a dash; amount.
 */
export const WATER_STYLE = Object.freeze({
  clear: Object.freeze({ tint: 0xcdf1ff, row: 13, len: 44, speed: 0.30, density: 0.36, amount: 0.30 }),
  sea: Object.freeze({ tint: 0xeaf9ff, row: 16, len: 64, speed: 0.38, density: 0.46, amount: 0.32 }),
  murk: Object.freeze({ tint: 0xc8dca6, row: 15, len: 52, speed: 0.14, density: 0.28, amount: 0.30 }),
  sewer: Object.freeze({ tint: 0xc3cd98, row: 14, len: 48, speed: 0.18, density: 0.28, amount: 0.24 }),
  cold: Object.freeze({ tint: 0xeefaff, row: 13, len: 40, speed: 0.20, density: 0.30, amount: 0.18 })
});

export const WATER_SURFACES = Object.freeze({
  hm05: Object.freeze({ material: 'Swamp water patch surface', style: 'murk' }),
  hm06: Object.freeze({ material: 'Static water patches', style: 'sea' }),
  hm11: Object.freeze({ material: 'HM11 olive wet surface', style: 'sewer' }),
  hm13: Object.freeze({ material: 'HM13 blue open water', style: 'cold' }),
  hm17: Object.freeze({ material: 'HM17 oasis water static source-phase appearance', style: 'clear' })
});

/** Night fields keep a fainter glint. */
export const WATER_NIGHT_AMOUNT = 0.6;

/** Ground point (x, z) -> world px on screen, as a 2 x 2 matrix [xx, xz, yx, yz], from the map's own projection. */
export function waterScreenBasis(map) {
  const o = map.screen([0, 0, 0]), x = map.screen([1, 0, 0]), z = map.screen([0, 0, 1]);
  return [x[0] - o[0], z[0] - o[0], x[1] - o[1], z[1] - o[1]];
}

const VERTEX_ANCHOR = '#include <begin_vertex>';
const FRAGMENT_ANCHOR = '#include <opaque_fragment>';
const DECLARE = 'varying vec3 vHuntWaterPos;\n';
const UNIFORMS = `uniform float uHuntWaterTime;
uniform vec4 uHuntWaterTint;
uniform vec4 uHuntWaterShape;
uniform vec4 uHuntWaterBasis;
float huntWaterHash( float n ) { return fract( sin( n ) * 43758.5453 ); }
// One layer of dashes: rows of cells along the screen's horizontal; some cells carry a short dash.
float huntWaterDashes( vec2 p, float t, float rowHeight, float cellLength, float density ) {
	float row = floor( p.y / rowHeight );
	float rowSeed = huntWaterHash( row * 12.9898 + 3.1 );
	float drift = ( 0.6 + 0.8 * huntWaterHash( row * 78.233 + 1.7 ) ) * ( rowSeed > 0.5 ? 1.0 : -1.0 );
	float x = p.x / cellLength + rowSeed * 17.0 + t * drift;
	float cell = floor( x ), along = fract( x );
	float seed = huntWaterHash( cell * 39.3468 + row * 11.135 );
	float carries = step( 1.0 - density, seed );
	float span = 0.22 + 0.5 * huntWaterHash( seed * 91.7 );
	float body = smoothstep( 0.0, 0.1, along ) * smoothstep( span, span - 0.1, along );
	float across = fract( p.y / rowHeight );
	float line = smoothstep( 0.34, 0.46, across ) * smoothstep( 0.68, 0.56, across );
	float twinkle = 0.5 + 0.5 * sin( uHuntWaterTime * 1.6 + seed * 6.2832 );
	return carries * body * line * twinkle;
}
`;
const VERTEX_BODY = `${VERTEX_ANCHOR}
	vHuntWaterPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`;
const FRAGMENT_BODY = `${FRAGMENT_ANCHOR}
	{
		vec2 huntWaterP = vec2( dot( uHuntWaterBasis.xy, vHuntWaterPos.xz ), dot( uHuntWaterBasis.zw, vHuntWaterPos.xz ) );
		float huntWaterT = uHuntWaterTime * uHuntWaterShape.z;
		float huntWaterGlint = huntWaterDashes( huntWaterP, huntWaterT, uHuntWaterShape.x, uHuntWaterShape.y, uHuntWaterTint.w )
			+ 0.55 * huntWaterDashes( huntWaterP + vec2( 31.0, 7.0 ), huntWaterT * 0.7, uHuntWaterShape.x * 1.7, uHuntWaterShape.y * 1.6, uHuntWaterTint.w * 0.8 );
		gl_FragColor.rgb += uHuntWaterTint.rgb * min( huntWaterGlint, 1.0 ) * uHuntWaterShape.w;
	}`;

/** Adds the shimmer to a compiled-shader record; returns false (and changes nothing) when Three's text is not the expected one. */
export function patchWaterShader(shader, uniforms) {
  if (!shader?.vertexShader?.includes(VERTEX_ANCHOR) || !shader.fragmentShader?.includes(FRAGMENT_ANCHOR)) return false;
  shader.vertexShader = DECLARE + shader.vertexShader.replace(VERTEX_ANCHOR, VERTEX_BODY);
  shader.fragmentShader = DECLARE + UNIFORMS + shader.fragmentShader.replace(FRAGMENT_ANCHOR, FRAGMENT_BODY);
  Object.assign(shader.uniforms, uniforms);
  return true;
}

const NONE = Object.freeze({ count: 0, update() {}, dispose() {}, diagnostics: () => ({ materials: 0, patched: 0, skipped: 0, moving: false }) });

export function createHuntWaterShimmer({ THREE, root, map, mapKey, fieldId = '', doc = globalThis.document }) {
  const surface = WATER_SURFACES[mapKey], style = surface && WATER_STYLE[surface.style];
  if (!style || !root || !map) return NONE;
  const materials = new Set();
  root.traverse((mesh) => { for (const m of [].concat(mesh.material ?? [])) if (m?.name === surface.material) materials.add(m); });
  if (!materials.size) return NONE;
  const tint = new THREE.Color(style.tint);
  const amount = style.amount * (fieldId.endsWith('_02') ? WATER_NIGHT_AMOUNT : 1);
  const uniforms = {
    uHuntWaterTime: { value: 0 },
    uHuntWaterTint: { value: new THREE.Vector4(tint.r, tint.g, tint.b, style.density) },
    uHuntWaterShape: { value: new THREE.Vector4(style.row, style.len, style.speed, 0) },
    uHuntWaterBasis: { value: new THREE.Vector4(...waterScreenBasis(map)) }
  };
  let patched = 0, skipped = 0, moving = false;
  const restore = [];
  for (const material of materials) {
    const before = { onBeforeCompile: material.onBeforeCompile, customProgramCacheKey: material.customProgramCacheKey };
    restore.push(() => { material.onBeforeCompile = before.onBeforeCompile; material.customProgramCacheKey = before.customProgramCacheKey; material.needsUpdate = true; });
    material.onBeforeCompile = (shader, renderer) => {
      before.onBeforeCompile?.call(material, shader, renderer);
      if (patchWaterShader(shader, uniforms)) patched++; else skipped++;
    };
    material.customProgramCacheKey = () => `hunt-water-shimmer:${before.customProgramCacheKey?.call(material) ?? ''}`;
    material.needsUpdate = true;
  }
  return Object.freeze({
    count: materials.size,
    update({ now }) {
      moving = huntAmbientAllowed(doc);
      uniforms.uHuntWaterShape.value.w = moving ? amount : 0;
      if (moving) uniforms.uHuntWaterTime.value = (now % 3_600_000) / 1000;
    },
    dispose() { for (const undo of restore.splice(0)) undo(); },
    diagnostics: () => ({ materials: materials.size, patched, skipped, moving, style: surface.style })
  });
}
