// HD-2D finish for the 3D hunt maps (Owner 2026-10-27): the "Octopath" diorama
// look. A warm key light with a cool fill, glowing lava, and one post pass with
// a tilt-shift focus band, soft bloom, a far haze, gentle saturation and a
// vignette. It draws through the existing shared renderer: no context, canvas,
// loop or extra Pixi state. The projection stays the locked 52/45 degrees.
// Every hunt map has a look; pre-baked maps (hm01, hm08) take the post pass
// only. Saver quality keeps the lighting but skips post.

const NIGHT = (fieldId) => String(fieldId).endsWith('_02');

// Colours are sRGB hex; intensities are Three units.
const DAY = Object.freeze({ key: [0xffdcb0, 1.9], fill: [0x86a2ff, 0.45], sky: 0xc4d8ff, ground: 0x5d5a44, hemi: 0.8,
  emissive: 1.2, haze: 0xfff0d8, hazeAmount: 0.06, bloom: 0.3, threshold: 1, saturation: 1.1, vignette: 0.28, exposure: 1.05 });
const NIGHT_BASE = Object.freeze({ key: [0xa8c0ff, 0.8], fill: [0xffb070, 0.3], sky: 0x5a6fb0, ground: 0x2c2a3a, hemi: 0.55,
  emissive: 1.6, haze: 0x34437e, hazeAmount: 0.08, bloom: 0.5, threshold: 0.85, saturation: 1.06, vignette: 0.38, exposure: 1.1 });
const look = (day = {}, night = {}) => Object.freeze({
  day: Object.freeze({ ...DAY, ...day }), night: Object.freeze({ ...NIGHT_BASE, ...night })
});

/** Per-map mood, day and night (fields ending _02 are night). */
export const HD2D_LOOKS = Object.freeze({
  // Lime and yellow-green grounds read better calmer than the default boost.
  hm01: look({ haze: 0xe8f6d0, saturation: 0.96 }),
  hm02: look({ ground: 0x6a5a34, haze: 0xffe2a8, saturation: 0.88 }),
  hm03: look({ ground: 0x3d5a2c, haze: 0xd8f0c8 }),
  hm04: look({ ground: 0x2f4a24, fill: [0x70c0a0, 0.45], haze: 0xc8f0d0, hazeAmount: 0.09 }),
  hm05: look({ ground: 0x3a4a30, haze: 0xc0d8c8, hazeAmount: 0.1, saturation: 0.9 }, { haze: 0x2c4a50 }),
  hm06: look({ sky: 0xc0e4ff, ground: 0x6a6a50, haze: 0xe0f4ff }),
  hm08: look({ haze: 0xffc890 }),
  hm09: look({ key: [0xffe8c8, 1.8], ground: 0x3a3430, haze: 0xc0a888 }),
  hm10: look({ ground: 0x4a4a48, haze: 0xd8e0e8 }),
  hm11: look({ ground: 0x3a4030, haze: 0x9fb8a0, hazeAmount: 0.08, clearColor: 0x16211b }, { clearColor: 0x101814 }),
  hm13: look({ key: [0xfff0e0, 1.7], fill: [0x8fb8ff, 0.6], sky: 0xd8ecff, ground: 0x8090a8, haze: 0xe8f4ff, hazeAmount: 0.08, saturation: 1.04 },
    { sky: 0x6a80c0, ground: 0x404a68 }),
  hm14: look({ ground: 0x6a5038, haze: 0xffd8a8 }),
  hm15: Object.freeze({
    day: Object.freeze({ key: [0xffd6a6, 1.95], fill: [0x7f9cff, 0.5], sky: 0xbcd0ff, ground: 0x5b3a28, hemi: 0.75,
      emissive: 1.25, haze: 0xffb27a, hazeAmount: 0.07, bloom: 0.4, threshold: 0.95, saturation: 1.12, vignette: 0.3, exposure: 1.06 }),
    night: Object.freeze({ key: [0xa8c0ff, 0.85], fill: [0xff8a4a, 0.4], sky: 0x5a6fb0, ground: 0x40281c, hemi: 0.5,
      emissive: 1.45, haze: 0x3a4a8a, hazeAmount: 0.08, bloom: 0.55, threshold: 0.85, saturation: 1.1, vignette: 0.38, exposure: 1.08 })
  }),
  hm16: look({ key: [0xffd8a0, 2], ground: 0x7a5a38, haze: 0xffd8a0 }),
  hm17: look({ ground: 0x7a6a40, haze: 0xfff0c8 }),
  hm18: look({ ground: 0x6a5840, haze: 0xf0dcb8 })
});

// Material fixes by name, applied with the look. HM13's open water carries dark
// tile blocks in its (Draco) vertex colours; one smooth deep-ice tint replaces them.
const MATERIAL_TUNING = Object.freeze({
  hm13: Object.freeze({ 'HM13 blue open water': Object.freeze({ vertexColors: false, color: 0x6fb2d4 }) })
});

export function hd2dLook(mapKey, fieldId) {
  const entry = HD2D_LOOKS[mapKey];
  if (!entry) return null;
  return Object.freeze({ ...(NIGHT(fieldId) ? entry.night : entry.day), materials: MATERIAL_TUNING[mapKey] ?? null });
}

/** Retune the authored lights and lift emissive materials (lava) above white for bloom. */
export function applyHd2dLighting({ THREE, scene, root, ambient, sun, look }) {
  ambient.color.set(look.sky); ambient.groundColor.set(look.ground); ambient.intensity = look.hemi;
  sun.color.set(look.key[0]); sun.intensity = look.key[1];
  // The fill comes from the opposite side, low and unshadowed.
  const fill = new THREE.DirectionalLight(look.fill[0], look.fill[1]);
  const centre = sun.target.position;
  fill.position.set(centre.x + 30, 38, centre.z - 40);
  fill.target = sun.target;
  scene.add(fill);
  root?.traverse((mesh) => {
    for (const material of [].concat(mesh.material ?? [])) {
      if (material?.emissiveMap || (material?.emissive && material.emissive.getHex() !== 0)) material.emissiveIntensity = look.emissive;
      const tune = look.materials?.[material?.name];
      if (tune) { material.vertexColors = tune.vertexColors ?? material.vertexColors; material.color?.set(tune.color ?? 0xffffff); material.needsUpdate = true; }
    }
  });
  return fill;
}

const VERTEX = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const DOWNSAMPLE = `uniform sampler2D tInput;uniform vec2 texel;varying vec2 vUv;
void main(){vec2 o=texel*.5;gl_FragColor=.25*(texture2D(tInput,vUv+vec2(-o.x,-o.y))+texture2D(tInput,vUv+vec2(o.x,-o.y))
+texture2D(tInput,vUv+vec2(-o.x,o.y))+texture2D(tInput,vUv+vec2(o.x,o.y)));}`;
// Nine-tap Gaussian through five linear fetches.
const BLUR = `uniform sampler2D tInput;uniform vec2 step;varying vec2 vUv;
void main(){vec4 c=texture2D(tInput,vUv)*.2270270270;
c+=(texture2D(tInput,vUv+step*1.3846153846)+texture2D(tInput,vUv-step*1.3846153846))*.3162162162;
c+=(texture2D(tInput,vUv+step*3.2307692308)+texture2D(tInput,vUv-step*3.2307692308))*.0702702703;gl_FragColor=c;}`;
const COMPOSITE = `uniform sampler2D tScene;uniform sampler2D tBlur;uniform vec2 focus;uniform float bloom;uniform float threshold;
uniform vec3 hazeColor;uniform float haze;uniform float saturation;uniform float vignette;uniform float exposure;varying vec2 vUv;
// Per-channel shoulder: colours below .8 pass untouched (sprites keep their
// pixels), highlights roll off without washing lava out to white.
vec3 shoulder(vec3 c){vec3 k=vec3(.8);return mix(c,k+.2*(1.-exp(-(c-k)/.2)),step(k,c));}
void main(){vec3 sharp=texture2D(tScene,vUv).rgb;vec3 soft=texture2D(tBlur,vUv).rgb;
float edge=max(1.-smoothstep(focus.x-.2,focus.x,vUv.y),smoothstep(focus.y,focus.y+.2,vUv.y));
vec3 c=mix(sharp,soft,edge*.8);
c+=max(soft-vec3(threshold),vec3(0.))*bloom;
c=mix(c,hazeColor,haze*smoothstep(.62,1.,vUv.y));
float l=dot(c,vec3(.2126,.7152,.0722));c=max(vec3(0.),mix(vec3(l),c,saturation));
vec2 d=vUv-.5;c*=1.-vignette*dot(d,d)*1.8;
gl_FragColor=vec4(shoulder(c*exposure),1.);
#include <colorspace_fragment>
}`;

/**
 * The post pass. render() replaces the plain draw: the scene goes into an HDR
 * target (clipped like the plain draw), a quarter-size blur feeds the focus band
 * and bloom, and the composite lands on the shared canvas.
 */
export function createHd2dPost({ THREE, renderer, look, doc = globalThis.document }) {
  const half = renderer.extensions?.has?.('EXT_color_buffer_float') || renderer.extensions?.has?.('EXT_color_buffer_half_float');
  const type = half ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: true, samples: 0 });
  const blurA = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
  const blurB = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
  for (const target of [sceneTarget, blurA, blurB]) { target.texture.minFilter = THREE.LinearFilter; target.texture.magFilter = THREE.LinearFilter; target.texture.generateMipmaps = false; }
  const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const downsample = material(DOWNSAMPLE, { tInput: { value: null }, texel: { value: new THREE.Vector2() } });
  const blur = material(BLUR, { tInput: { value: null }, step: { value: new THREE.Vector2() } });
  const composite = material(COMPOSITE, {
    tScene: { value: sceneTarget.texture }, tBlur: { value: blurA.texture }, focus: { value: new THREE.Vector2(0.2, 0.74) },
    bloom: { value: look.bloom }, threshold: { value: half ? look.threshold : Math.min(0.9, look.threshold + 0.12) },
    hazeColor: { value: new THREE.Color(look.haze) }, haze: { value: look.hazeAmount },
    saturation: { value: look.saturation }, vignette: { value: look.vignette }, exposure: { value: look.exposure }
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite);
  quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad);
  const postCamera = new THREE.Camera();
  const size = new THREE.Vector2();
  let width = 0, height = 0, samples = -1, frames = 0;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(post, postCamera); };
  // The renderer outlives the field; leave it drawing to the canvas.
  const release = () => renderer.setRenderTarget(null);

  function resize() {
    renderer.getDrawingBufferSize(size);
    const ratio = renderer.getPixelRatio();
    // MSAA where the pixels are large; dense phone screens alias less.
    const wanted = ratio >= 2 ? 0 : Math.min(4, renderer.capabilities?.maxSamples ?? 0);
    if (size.x === width && size.y === height && wanted === samples) return;
    width = size.x; height = size.y;
    if (wanted !== samples) { samples = wanted; sceneTarget.samples = wanted; sceneTarget.dispose(); }
    sceneTarget.setSize(width, height);
    const qw = Math.max(1, Math.round(width / 4)), qh = Math.max(1, Math.round(height / 4));
    blurA.setSize(qw, qh); blurB.setSize(qw, qh);
  }

  return Object.freeze({
    enabled() { return doc?.documentElement?.dataset.quality !== 'saver'; },
    render(scene, camera, clip) {
      resize();
      const ratio = renderer.getPixelRatio();
      // Clear the whole target, then draw clipped exactly like the plain path.
      sceneTarget.scissorTest = false;
      renderer.setRenderTarget(sceneTarget); renderer.clear();
      sceneTarget.scissor.set(Math.floor(clip.x * ratio), Math.floor(clip.y * ratio), Math.ceil(clip.width * ratio), Math.ceil(clip.height * ratio));
      sceneTarget.scissorTest = true;
      renderer.setRenderTarget(sceneTarget);
      renderer.autoClear = false;
      try { renderer.render(scene, camera); } finally { renderer.autoClear = true; sceneTarget.scissorTest = false; }
      downsample.uniforms.tInput.value = sceneTarget.texture; downsample.uniforms.texel.value.set(1 / width, 1 / height);
      pass(downsample, blurA);
      blur.uniforms.tInput.value = blurA.texture; blur.uniforms.step.value.set(1 / blurA.width, 0); pass(blur, blurB);
      blur.uniforms.tInput.value = blurB.texture; blur.uniforms.step.value.set(0, 1 / blurA.height); pass(blur, blurA);
      renderer.setScissorTest(false);
      pass(composite, null);
      frames += 1;
    },
    release,
    getDiagnostics() { return { hdr: Boolean(half), samples, width, height, frames }; },
    dispose() {
      release();
      for (const owned of [sceneTarget, blurA, blurB, downsample, blur, composite, quad.geometry]) owned.dispose();
    }
  });
}
