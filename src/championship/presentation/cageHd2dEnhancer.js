// Cage HD-2D enhancer (Owner 2026-10-27): the 36 cage GLBs gain life at load
// time without touching the files. A shader hook reads each texel's own colour
// and, by cage theme, makes lava glow and breathe, water glint, screens and
// culture tanks pulse, the power plant flicker, crystals twinkle, snow sparkle,
// foliage sway a little, sports grounds pop and the ring catch a spotlight.
//
// It adds no texture and no geometry: one shared time uniform, one program
// variant per theme. Hooks that the scene already installed (authored water,
// instrument masks) run first and keep their cache keys. Saver quality and
// reduced motion get the static parts only (colour, glow level), not motion.

// Catalog definition index → themes.
const THEMES_BY_DEFINITION = Object.freeze({
  6: ['lava'], 31: ['lava'], 23: ['lava', 'foliage'],                    // 火山 · 小火山 · 寺廟 (torches)
  8: ['water'], 33: ['water'], 18: ['water'], 24: ['water', 'foliage'],  // 海灘 · 小海灘 · 溫泉 · 動物園
  5: ['neon'], 16: ['neon'], 15: ['neon'], 28: ['neon'], 14: ['neon'], 22: ['neon'], // 研究所 · 醫院 · 保健室 · 工廠 · 毒氣室
  21: ['neon', 'flicker'],                                               // 發電廠
  34: ['crystal'], 12: ['crystal'],                                      // 洞窟 · 神殿
  20: ['snow'],                                                          // 冰原
  13: ['fog'],                                                           // 墓地
  10: ['foliage'], 11: ['foliage'], 17: ['foliage'], 29: ['foliage'], 7: ['foliage'], 25: ['foliage'], 0: ['foliage'],
  1: ['sports'], 27: ['sports'], 2: ['sports'], 4: ['sports'], 30: ['sports'], 3: ['sports'],
  26: ['sports', 'spotlight']                                            // 擂台
});

export function cageHd2dThemes(definitionIndex) {
  return THEMES_BY_DEFINITION[definitionIndex] ?? [];
}

const VERTEX_HEAD = 'uniform float uHd2dTime;\nvarying vec3 vHd2dWorld;\nvarying vec3 vHd2dLocal;\n';
const FRAGMENT_HEAD = 'uniform float uHd2dTime;\nvarying vec3 vHd2dWorld;\nvarying vec3 vHd2dLocal;\n';

function vertexBody(themes) {
  // Foliage: canopies (green texels well above the ground) lean in a soft breeze.
  const sway = themes.includes('foliage') ? `
  #ifdef USE_MAP
    vec3 hd2dLeaf = texture2D(map, uv).rgb;
    float hd2dGreen = smoothstep(0.04, 0.16, hd2dLeaf.g - max(hd2dLeaf.r, hd2dLeaf.b));
    float hd2dHigh = smoothstep(0.6, 2.2, position.y);
    transformed.xz += vec2(sin(uHd2dTime * 1.3 + position.x * 0.9), cos(uHd2dTime * 1.1 + position.z * 0.8)) * 0.035 * hd2dGreen * hd2dHigh;
  #endif` : '';
  return `#include <begin_vertex>${sway}
  vHd2dLocal = transformed;`;
}

function fragmentBody(themes) {
  const parts = [`
  vec3 hd2dP = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.4545));
  float hd2dLuma = dot(hd2dP, vec3(0.299, 0.587, 0.114));`];
  if (themes.includes('lava')) parts.push(`
  float hd2dLava = smoothstep(0.55, 0.78, hd2dP.r) * smoothstep(0.28, 0.5, hd2dP.r - hd2dP.b) * (1.0 - smoothstep(0.8, 0.95, hd2dP.g));
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.6, 0.85, 0.35) * hd2dLava * (1.15 + 0.55 * sin(uHd2dTime * 2.1 + vHd2dWorld.x * 1.7 + vHd2dWorld.z * 1.3));`);
  if (themes.includes('water')) parts.push(`
  float hd2dWater = smoothstep(0.1, 0.28, hd2dP.b - hd2dP.r) * smoothstep(0.3, 0.5, hd2dP.b);
  float hd2dGlint = pow(max(0.0, sin(vHd2dWorld.x * 4.6 + uHd2dTime * 1.3) * sin(vHd2dWorld.z * 3.9 - uHd2dTime * 1.05)), 6.0);
  totalEmissiveRadiance += vec3(0.55, 0.85, 1.0) * hd2dWater * (0.05 + 0.4 * hd2dGlint);`);
  if (themes.includes('neon')) parts.push(`
  float hd2dNeon = smoothstep(0.55, 0.82, max(hd2dP.g, hd2dP.b)) * smoothstep(0.22, 0.42, max(hd2dP.g, hd2dP.b) - hd2dP.r);
  float hd2dPulse = 0.55 + 0.45 * sin(uHd2dTime * 2.6 + vHd2dWorld.y * 3.0 + vHd2dWorld.x);
  ${themes.includes('flicker') ? 'hd2dPulse *= 0.55 + 0.9 * step(0.42, fract(sin(floor(uHd2dTime * 14.0) * 12.9898) * 43758.5453));' : ''}
  totalEmissiveRadiance += diffuseColor.rgb * hd2dNeon * hd2dPulse * 1.25;`);
  if (themes.includes('crystal')) parts.push(`
  float hd2dCrystal = smoothstep(0.62, 0.86, hd2dP.b) * smoothstep(0.12, 0.3, hd2dP.b - hd2dP.g);
  float hd2dTwinkle = pow(0.5 + 0.5 * sin(vHd2dWorld.x * 9.0 + vHd2dWorld.z * 7.0 + uHd2dTime * 3.0), 8.0);
  totalEmissiveRadiance += diffuseColor.rgb * hd2dCrystal * (0.35 + 1.2 * hd2dTwinkle);`);
  if (themes.includes('snow')) parts.push(`
  float hd2dSnow = smoothstep(0.82, 0.95, hd2dLuma);
  float hd2dSparkle = pow(0.5 + 0.5 * sin(vHd2dWorld.x * 23.0 + vHd2dWorld.z * 19.0 + uHd2dTime * 2.2), 24.0);
  totalEmissiveRadiance += vec3(0.75, 0.88, 1.0) * hd2dSnow * hd2dSparkle * 0.9;`);
  if (themes.includes('fog')) parts.push(`
  float hd2dFog = (1.0 - smoothstep(0.0, 0.9, vHd2dLocal.y)) * (0.6 + 0.4 * sin(uHd2dTime * 0.5 + vHd2dWorld.x * 0.7));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.12, 0.26), 0.2 * hd2dFog);`);
  if (themes.includes('sports')) parts.push(`
  diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 1.16), vec3(0.0));`);
  if (themes.includes('spotlight')) parts.push(`
  totalEmissiveRadiance += diffuseColor.rgb * 0.28 * (1.0 - smoothstep(1.2, 3.6, length(vHd2dLocal.xz)));`);
  return `#include <emissivemap_fragment>${parts.join('')}`;
}

/**
 * Enhance every material of one placed cage object. `time` is the shared
 * { value } uniform the scene advances; `animate` false holds it still.
 * Returns the number of materials hooked (each material once, across clones).
 */
const STATIC_THEMES = new Set(['sports', 'spotlight', 'fog']);

export function enhanceCageObject(object, { definitionIndex, time, authored = () => false }) {
  const allThemes = cageHd2dThemes(definitionIndex);
  if (!allThemes.length || !object) return 0;
  let hooked = 0;
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const material of [].concat(mesh.material ?? [])) {
      if (!material || material.userData?.hd2dHooked || !('emissive' in material)) continue;
      // A material the scene already animates (authored lava, water, wind) keeps
      // its own motion; it only takes the static parts here.
      const themes = authored(material) ? allThemes.filter((theme) => STATIC_THEMES.has(theme)) : allThemes;
      if (!themes.length) continue;
      const key = `hd2d-${themes.join('+')}`;
      material.userData.hd2dHooked = key;
      const previousHook = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey;
      material.onBeforeCompile = function hd2dHook(shader, renderer) {
        if (typeof previousHook === 'function') previousHook.call(this, shader, renderer);
        shader.uniforms.uHd2dTime = time;
        // The colour map is declared for the fragment stage only; foliage sway reads it in the vertex stage too.
        const head = VERTEX_HEAD + (themes.includes('foliage') ? '#ifdef USE_MAP\nuniform sampler2D map;\n#endif\n' : '');
        shader.vertexShader = head + shader.vertexShader
          .replace('#include <begin_vertex>', vertexBody(themes))
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vHd2dWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader.replace('#include <emissivemap_fragment>', fragmentBody(themes));
      };
      material.customProgramCacheKey = function hd2dKey() {
        const base = typeof previousKey === 'function' ? previousKey.call(this) : '';
        return `${base}|${key}`;
      };
      material.needsUpdate = true;
      hooked += 1;
    }
  });
  return hooked;
}
