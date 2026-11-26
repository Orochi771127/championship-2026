// 2026-11-26 hunt refinement batch 3: the lake, sea, swamp, sewer and ice-water surfaces move.
// Short light dashes slide along the screen horizontal and twinkle, added in each water
// material's own shader: no new assets, no extra draw call. Saver quality and reduced motion
// keep the delivered still look.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import { MAPS } from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { projectionForManifest } from '../src/championship/presentation/vs2/huntThree/projection.mjs';
import { WATER_SURFACES, WATER_STYLE, WATER_NIGHT_AMOUNT, waterScreenBasis, patchWaterShader, createHuntWaterShimmer } from '../src/championship/presentation/vs2/huntThree/waterShimmer.mjs';

const glbJson = (file) => { const b = fs.readFileSync(file); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const manifestOf = (key) => JSON.parse(fs.readFileSync(MAPS[key].directory + MAPS[key].manifest.file, 'utf8'));
const projection = (key) => projectionForManifest(manifestOf(key));
const doc = (dataset = {}, reduce = false) => ({ documentElement: { dataset }, defaultView: { matchMedia: () => ({ matches: reduce }) } });
const scene = (name) => {
  const root = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ name }), land = new THREE.MeshStandardMaterial({ name: 'land' });
  root.add(new THREE.Mesh(new THREE.PlaneGeometry(), water), new THREE.Mesh(new THREE.PlaneGeometry(), water), new THREE.Mesh(new THREE.PlaneGeometry(), land));
  return { root, water, land };
};
const compiled = (lib = 'standard') => ({ vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader, uniforms: {} });
const shimmerFor = (key, fieldId, root, d = doc()) => createHuntWaterShimmer({ THREE, root, map: projection(key), mapKey: key, fieldId, doc: d });

test('five maps have moving water, each naming a material that its GLB really has', () => {
  assert.deepEqual(Object.keys(WATER_SURFACES).sort(), ['hm05', 'hm06', 'hm11', 'hm13', 'hm17']);
  for (const [key, surface] of Object.entries(WATER_SURFACES)) {
    assert.ok(WATER_STYLE[surface.style], key);
    const names = glbJson(MAPS[key].directory + manifestOf(key).glb.file).materials.map(m => m.name);
    assert.equal(names.filter(n => n === surface.material).length, 1, `${key} has exactly one "${surface.material}"`);
  }
  for (const style of Object.values(WATER_STYLE)) {
    assert.ok(style.amount > 0 && style.amount <= 0.35, 'a glint, never a repaint');
    assert.ok(style.density > 0.1 && style.density < 0.5, 'most of the water stays clear');
    assert.ok(style.speed > 0 && style.speed <= 0.5 && style.row >= 10 && style.row <= 20 && style.len > style.row * 2, 'short dashes, slow drift');
  }
});

test('the shimmer is written into the lit and unlit Three shaders at the same two anchors', () => {
  for (const lib of ['standard', 'lambert', 'basic', 'phong', 'toon']) {
    const shader = compiled(lib), uniforms = { uHuntWaterTime: { value: 0 } };
    assert.equal(patchWaterShader(shader, uniforms), true, lib);
    assert.ok(shader.vertexShader.startsWith('varying vec3 vHuntWaterPos;\n'), lib);
    assert.ok(shader.vertexShader.includes('#include <begin_vertex>\n\tvHuntWaterPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;'), lib);
    assert.ok(shader.fragmentShader.startsWith('varying vec3 vHuntWaterPos;\nuniform float uHuntWaterTime;\nuniform vec4 uHuntWaterTint;\nuniform vec4 uHuntWaterShape;\nuniform vec4 uHuntWaterBasis;\n'), lib);
    assert.ok(shader.fragmentShader.includes('#include <opaque_fragment>\n\t{\n\t\tvec2 huntWaterP = vec2( dot( uHuntWaterBasis.xy, vHuntWaterPos.xz ), dot( uHuntWaterBasis.zw, vHuntWaterPos.xz ) );'), lib);
    assert.ok(shader.fragmentShader.includes('gl_FragColor.rgb += uHuntWaterTint.rgb * min( huntWaterGlint, 1.0 ) * uHuntWaterShape.w;'), 'light is only ever added');
    assert.equal(shader.fragmentShader.split('#include <opaque_fragment>').length, 2, 'the stock include stays, once');
    assert.equal(shader.uniforms.uHuntWaterTime, uniforms.uHuntWaterTime, 'shares the live uniform objects');
    // The light is added after lighting and before tone mapping and the colour-space conversion.
    assert.ok(shader.fragmentShader.indexOf('float huntWaterGlint') < shader.fragmentShader.indexOf('#include <tonemapping_fragment>'), lib);
  }
  // Unknown shader text: nothing is changed.
  const odd = { vertexShader: 'void main(){}', fragmentShader: 'void main(){}', uniforms: {} };
  assert.equal(patchWaterShader(odd, { a: 1 }), false);
  assert.deepEqual(odd, { vertexShader: 'void main(){}', fragmentShader: 'void main(){}', uniforms: {} });
});

test('the dashes run along the screen horizontal of each map: the basis is the map projection itself', () => {
  for (const key of Object.keys(WATER_SURFACES)) {
    const map = projection(key), [xx, xz, yx, yz] = waterScreenBasis(map);
    const [ox, oy] = map.screen([0, 0, 0]);
    for (const [x, z] of [[3, -2], [-7.5, 11], [40, 40]]) {
      const [sx, sy] = map.screen([x, 0, z]);
      assert.ok(Math.abs(xx * x + xz * z - (sx - ox)) < 1e-6 && Math.abs(yx * x + yz * z - (sy - oy)) < 1e-6, key);
    }
    // One world px to the right on screen is one unit along the row, and stays on the row.
    const [gx, , gz] = map.ground(1, 0), [hx, , hz] = map.ground(0, 0);
    assert.ok(Math.abs(xx * (gx - hx) + xz * (gz - hz) - 1) < 1e-6, `${key} one px right`);
    assert.ok(Math.abs(yx * (gx - hx) + yz * (gz - hz)) < 1e-6, `${key} stays on the row`);
  }
});

test('only the named water material is touched, and its earlier compile hook still runs', () => {
  const { root, water, land } = scene(WATER_SURFACES.hm17.material);
  const landHook = land.onBeforeCompile;
  let earlier = 0; water.onBeforeCompile = () => { earlier++; };
  const version = water.version;
  const shimmer = shimmerFor('hm17', 'field_hm17_01', root);
  assert.equal(shimmer.count, 1, 'two meshes share one water material');
  assert.equal(land.onBeforeCompile, landHook);
  assert.ok(water.version > version, 'the material recompiles');
  assert.ok(water.customProgramCacheKey().startsWith('hunt-water-shimmer:'));
  const shader = compiled();
  water.onBeforeCompile(shader, null);
  assert.equal(earlier, 1);
  assert.deepEqual(shimmer.diagnostics(), { materials: 1, patched: 1, skipped: 0, moving: false, style: 'clear' });
  assert.deepEqual(shader.uniforms.uHuntWaterShape.value.toArray().slice(0, 3), [WATER_STYLE.clear.row, WATER_STYLE.clear.len, WATER_STYLE.clear.speed]);
  assert.equal(shader.uniforms.uHuntWaterTint.value.w, WATER_STYLE.clear.density);
  assert.deepEqual(shader.uniforms.uHuntWaterBasis.value.toArray(), waterScreenBasis(projection('hm17')));

  // Running: time advances, the amount is the style's.
  shimmer.update({ now: 12_500 });
  assert.equal(shader.uniforms.uHuntWaterTime.value, 12.5);
  assert.equal(shader.uniforms.uHuntWaterShape.value.w, WATER_STYLE.clear.amount);
  assert.equal(shimmer.diagnostics().moving, true);
  // The time wraps hourly so the float stays precise.
  shimmer.update({ now: 3_600_000 + 2_000 });
  assert.equal(shader.uniforms.uHuntWaterTime.value, 2);

  shimmer.dispose();
  water.onBeforeCompile(compiled(), null);
  assert.equal(earlier, 2, 'the earlier hook is back');
  assert.equal(shimmer.diagnostics().patched, 1, 'and the shimmer no longer patches');
});

test('saver quality and reduced motion keep the still water; night glints are fainter', () => {
  for (const off of [doc({ quality: 'saver' }), doc({ motion: 'reduced' }), doc({}, true)]) {
    const { root, water } = scene(WATER_SURFACES.hm06.material);
    const shimmer = shimmerFor('hm06', 'field_hm06_01', root, off);
    const shader = compiled(); water.onBeforeCompile(shader, null);
    shimmer.update({ now: 5_000 });
    assert.equal(shader.uniforms.uHuntWaterShape.value.w, 0, 'amount 0 = the delivered picture');
    assert.equal(shader.uniforms.uHuntWaterTime.value, 0, 'and the clock does not run');
    assert.equal(shimmer.diagnostics().moving, false);
  }
  const { root, water } = scene(WATER_SURFACES.hm13.material);
  const night = shimmerFor('hm13', 'field_hm13_02', root);
  const shader = compiled(); water.onBeforeCompile(shader, null);
  night.update({ now: 1_000 });
  assert.ok(Math.abs(shader.uniforms.uHuntWaterShape.value.w - WATER_STYLE.cold.amount * WATER_NIGHT_AMOUNT) < 1e-9);
});

test('maps without a named water surface, or a scene without that material, get nothing', () => {
  for (const key of ['hm01', 'hm08', 'hm15', 'hm02']) {
    const { root, water } = scene('whatever');
    const hook = water.onBeforeCompile;
    const none = createHuntWaterShimmer({ THREE, root, map: projection('hm17'), mapKey: key, fieldId: `field_${key}_01`, doc: doc() });
    assert.equal(none.count, 0); none.update({ now: 1 }); none.dispose();
    assert.equal(water.onBeforeCompile, hook);
    assert.deepEqual(none.diagnostics(), { materials: 0, patched: 0, skipped: 0, moving: false });
  }
  const { root } = scene('not the oasis water');
  assert.equal(shimmerFor('hm17', 'field_hm17_01', root).count, 0);
});

test('the map creates the shimmer on its loaded scene, updates it each frame and undoes it on exit', () => {
  const map = fs.readFileSync('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs', 'utf8');
  assert.equal(map.split('waterShimmer=createHuntWaterShimmer({THREE,root:gltf.scene,map,').length, 3, 'authored and hm02-hm06 paths');
  assert.ok(map.includes('drainFlow.update({now});waterShimmer?.update({now});'));
  assert.ok(map.includes("cleanup('water shimmer',()=>waterShimmer?.dispose());"));
  assert.ok(map.includes('water:waterShimmer?.diagnostics()??null,'));
});
