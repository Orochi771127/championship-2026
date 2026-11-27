import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  RANCH_ACTOR_LIGHT_DEFAULTS,
  RANCH_BIOME_LIGHT_PRESETS,
  attachRanchActorLight,
  createRanchActorLightState,
  ranchActorLightPreset,
  ranchFrameUvBounds,
  ranchRimDirection,
  updateRanchActorLightState
} from '../src/championship/presentation/ranchActorLight.js';
import {
  RANCH_CAST_SHADOW,
  createRanchCastShadows,
  ranchCastShadowReach,
  ranchCastShadowVertices
} from '../src/championship/presentation/ranchCastShadows.js';

test('ranchActorLight resolves biome-specific bounce & key harmony and interpolates smoothly across cages', () => {
  assert.equal(ranchActorLightPreset(6), RANCH_BIOME_LIGHT_PRESETS.lava);    // 火山
  assert.equal(ranchActorLightPreset(20), RANCH_BIOME_LIGHT_PRESETS.snow);   // 冰原
  assert.equal(ranchActorLightPreset(8), RANCH_BIOME_LIGHT_PRESETS.water);   // 海灘
  assert.equal(ranchActorLightPreset(15), RANCH_BIOME_LIGHT_PRESETS.neon);   // 小保健室
  assert.equal(ranchActorLightPreset(0), RANCH_BIOME_LIGHT_PRESETS.foliage); // 草原
  assert.equal(ranchActorLightPreset(null), RANCH_ACTOR_LIGHT_DEFAULTS);

  const state = createRanchActorLightState(THREE);
  // First update snaps immediately to volcano lava glow
  updateRanchActorLightState(state, {
    definitionIndex: 6,
    uvs: { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.2, x2: 0.3, y2: 0.6, x3: 0.1, y3: 0.6 },
    flip: true,
    blend: 0.2
  });
  assert.equal(state.uRanchFlipSign.value, -1);
  assert.deepEqual(state.uRanchFrameUvBounds.value.toArray().map((n) => Number(n.toFixed(2))), [0.1, 0.2, 0.3, 0.6]);
  assert.ok(state.uRanchActorGround.value.x > state.uRanchActorGround.value.z, 'volcano bounce is warm orange-red');

  // Walking into snow blends smoothly rather than popping in 1 frame
  const redBefore = state.uRanchActorGround.value.x;
  updateRanchActorLightState(state, { definitionIndex: 20, flip: false, blend: 0.2 });
  assert.ok(state.uRanchActorGround.value.x < redBefore && state.uRanchActorGround.value.x > RANCH_BIOME_LIGHT_PRESETS.snow.ground[0]);
  assert.equal(state.uRanchFlipSign.value, 1);

  assert.deepEqual(ranchFrameUvBounds({ x0: 0.5, y0: 0.1, x1: 0.2, y1: 0.1, x2: 0.2, y2: 0.9, x3: 0.5, y3: 0.9 }), [0.2, 0.1, 0.5, 0.9]);
});

test('attachRanchActorLight chains onBeforeCompile cleanly while preserving prior depth/partition shader hooks', () => {
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.Texture(), alphaTest: 0.15 });
  let priorRan = false;
  mat.onBeforeCompile = (shader) => {
    priorRan = true;
    shader.uniforms.uPrior = { value: 1 };
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '/* prior */\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'prior-depth-hook';

  const state = createRanchActorLightState(THREE);
  const rimDir = { value: new THREE.Vector2(...ranchRimDirection(new THREE.OrthographicCamera(), { x: -15, y: 35, z: 8 })) };
  attachRanchActorLight(mat, state, rimDir);

  const fakeShader = {
    uniforms: {},
    vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <map_fragment>\n#include <opaque_fragment>'
  };
  mat.onBeforeCompile(fakeShader, null);
  assert.equal(priorRan, true, 'existing depth/partition hook still executes');
  assert.equal(fakeShader.uniforms.uPrior.value, 1);
  assert.ok(fakeShader.uniforms.uRanchActorLight === state.uRanchActorLight);
  assert.ok(fakeShader.vertexShader.includes('vRanchSpriteHeight'));
  assert.ok(fakeShader.fragmentShader.includes('uRanchFrameUvBounds'));
  assert.ok(fakeShader.fragmentShader.includes('/* prior */'));
  assert.equal(mat.customProgramCacheKey(), 'prior-depth-hook|ranch-actor-light-v1');
  mat.map.dispose();
  mat.dispose();
});

test('ranchCastShadows projects live sprite silhouette onto floor along sun ray and cleans up properly', () => {
  const sun = { position: { x: -15, y: 35, z: 8 }, target: { position: { x: 0, y: 0, z: 0 } } };
  const reach = ranchCastShadowReach(sun);
  assert.ok(reach[0] > 0 && reach[1] < 0, 'shadow falls opposite the sun vector');
  assert.ok(Math.hypot(reach[0], reach[1]) <= RANCH_CAST_SHADOW.maxReach + 1e-6);

  const verts = ranchCastShadowVertices({
    centerX: 2, centerY: 1, centerZ: 3,
    width: 1.2, height: 1.6,
    rightX: Math.SQRT1_2, rightZ: -Math.SQRT1_2,
    baseX: 2, baseZ: 3,
    floorY: 0.2,
    reach
  });
  assert.equal(verts.length, 12);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(verts[i * 3 + 1] - (0.2 + RANCH_CAST_SHADOW.floorOffsetY)) < 1e-5, 'all shadow vertices lie flat on floor plane');
  }
  // Top vertices (0, 1) project further along reach than bottom vertices (2, 3)
  assert.ok(verts[0] > verts[6], 'top of sprite projects along +X sun shadow reach');

  const scene = new THREE.Scene();
  const cast = createRanchCastShadows(scene);
  const tex = new THREE.Texture();
  const spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex }));
  spriteMesh.position.set(2, 1, 3);
  spriteMesh.scale.set(1.2, 1.6, 1);

  cast.sync('p1', {
    enabled: true,
    spriteItem: { seen: true, mesh: spriteMesh },
    entry: { root: { visible: true, threeGroundHeight: 0.2 }, shadow: { worldAlpha: 1 }, groundShadowEllipses: [{ alpha: 1 }] },
    map: tex,
    uvArray: [0, 0, 1, 0, 0, 1, 1, 1],
    rawUvs: { x0: 0, y0: 0, x1: 1, y1: 0, x2: 1, y2: 1, x3: 0, y3: 1 },
    rightVec: { x: Math.SQRT1_2, z: -Math.SQRT1_2 },
    sun
  });
  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0].visible, true);

  cast.reset();
  cast.prune();
  assert.equal(scene.children.length, 0, 'unseen cast shadows are released from scene');
  cast.dispose();
  tex.dispose();
  spriteMesh.geometry.dispose();
  spriteMesh.material.dispose();
});
