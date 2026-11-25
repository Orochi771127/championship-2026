// Owner 2026-11-25: hunt partners must look like they live in the map, not a sticker
// on it. Partners take the map's HD-2D light: day stays near the drawn colours,
// night dims and cools, lava warms from below, and the shader hook chains safely.
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HD2D_LOOKS, hd2dLook } from "../src/championship/presentation/vs2/huntThree/hd2dLook.mjs";
import { huntActorLight, createHuntActorLightUniforms, installHuntActorLight, huntRimDirection } from "../src/championship/presentation/vs2/huntThree/actorLight.mjs";
import { installFlatGroundDepthCandidate } from "../src/championship/presentation/vs2/huntThree/supportDepth.mjs";

const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test("every hunt map has partner light for day and night", () => {
  for (const key of Object.keys(HD2D_LOOKS)) for (const field of [`field_${key}_01`, `field_${key}_02`]) {
    const night = field.endsWith("_02"), light = huntActorLight(hd2dLook(key, field), { mapKey: key, night });
    assert.ok(light, `${field} light`);
    assert.ok(light.color.every(v => v > 0 && v <= 1.06 + 1e-9), `${field} colour in range ${light.color}`);
    if (!night) assert.ok(luma(light.color) > 0.85, `${field} day keeps the drawn colours (${luma(light.color).toFixed(2)})`);
    else assert.ok(luma(light.color) < 0.75, `${field} night dims partners (${luma(light.color).toFixed(2)})`);
  }
});

test("night light is cooler than day; lava glows warm from below", () => {
  const day = huntActorLight(hd2dLook("hm08", "field_hm08_01"), { mapKey: "hm08" });
  const night = huntActorLight(hd2dLook("hm08", "field_hm08_02"), { mapKey: "hm08", night: true });
  assert.ok(night.color[2] / night.color[0] > day.color[2] / day.color[0], "night is bluer");
  const lava = huntActorLight(hd2dLook("hm15", "field_hm15_01"), { mapKey: "hm15" });
  assert.ok(lava.ground[0] > lava.ground[2] * 2 && lava.groundStrength > 0.2, "lava bounce is orange and visible");
});

test("light chains after the ground-depth hook and survives its reinstall", () => {
  const light = huntActorLight(hd2dLook("hm03", "field_hm03_01"), { mapKey: "hm03" });
  const uniforms = createHuntActorLightUniforms(THREE, light);
  const material = new THREE.MeshBasicMaterial({ transparent: true });
  material.map = new THREE.Texture();
  for (let round = 0; round < 2; round++) {
    installFlatGroundDepthCandidate(material, { THREE, groundHeight: round, eyeDirection: [0, 0.8, 0.6] });
    installHuntActorLight(material, uniforms);
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    material.onBeforeCompile(shader);
    assert.ok(shader.uniforms.hmGroundHeight && shader.uniforms.hmActorLight, "both hooks installed");
    assert.equal(shader.uniforms.hmActorRimDir, uniforms.hmActorRimDir, "rim direction is shared, updated in place");
    assert.equal(shader.fragmentShader.split("hmActorLight * mix").length, 2, "light applied once");
    assert.ok(shader.fragmentShader.includes("gl_FragDepth"), "ground depth kept");
    assert.match(material.customProgramCacheKey(), new RegExp(`hunt-flat-ground-depth.*-${round}-.*hunt-actor-light-v1$`));
  }
});

test("rim direction follows the sun in screen space", () => {
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const [x, y] = huntRimDirection(camera, [-30, 65, 40]);
  assert.ok(x < 0 && y > 0, `sun at upper left gives (${x}, ${y})`);
  assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9);
});
