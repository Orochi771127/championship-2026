// Hit feel on the battle camera (OWNER_APPROVED_ADAPTATION 2026-11-08,
// UNIQUE_PIXEL_MOVE_VFX_20261108, the Owner's second step: 「再用 pixi-filters，
// 來加強打擊感」). Three short screen effects in the manner of pixi-filters'
// shockwave, RGB split and zoom blur, written here on Pixi's own Filter so the
// public build gains no package:
//   shock(x, y)   a ring of distortion running out from a heavy hit (~320 ms)
//   split(ms)     a red / blue split on a critical hit (~140 ms)
//   rush(x, y)    a radial blur toward a signature move's caster (~220 ms)
// A filter sits on the camera container only while one runs, and its area is
// the screen, never the map: a filter over the whole map is what once ran the
// iPhone out of GPU memory (2026-11-04). Off on the saver tier and with reduced
// motion. Presentation only; it owns no clock (the scene passes the ticker's dt).

const VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
// Screen pixel of a texture coordinate, and back.
const COMMON = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
vec2 toPixel(vec2 uv) { return uv * uInputSize.xy + uOutputFrame.xy; }
vec2 toUv(vec2 px) { return (px - uOutputFrame.xy) * uInputSize.zw; }`;
const SHOCK = `${COMMON}
uniform vec2 uCenter;
uniform float uRadius;
uniform float uWidth;
uniform float uAmp;
void main(void) {
  vec2 d = toPixel(vTextureCoord) - uCenter;
  float dist = length(d), k = (dist - uRadius) / uWidth;
  vec2 uv = vTextureCoord;
  float band = 0.0;
  if (abs(k) < 1.0 && dist > 0.0) {
    band = 1.0 - abs(k);
    uv -= normalize(d) * sin(k * 3.14159) * band * uAmp * uInputSize.zw;
  }
  vec4 c = texture(uTexture, uv);
  finalColor = vec4(c.rgb + vec3(0.18 * band * band * uAmp / 12.0) * c.a, c.a);
}`;
const SPLIT = `${COMMON}
uniform float uOffset;
void main(void) {
  vec2 o = vec2(uOffset, 0.0) * uInputSize.zw;
  vec4 g = texture(uTexture, vTextureCoord);
  vec4 r = texture(uTexture, vTextureCoord + o), b = texture(uTexture, vTextureCoord - o);
  finalColor = vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}`;
const RUSH = `${COMMON}
uniform vec2 uCenter;
uniform float uStrength;
void main(void) {
  vec2 px = toPixel(vTextureCoord), toward = (uCenter - px) * uStrength;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 6; i++) sum += texture(uTexture, toUv(px + toward * (float(i) / 6.0)));
  finalColor = sum / 6.0;
}`;

const SHOCK_MS = 320, SPLIT_MS = 140, RUSH_MS = 220;

export function createBattleHitFeel({PIXI, target, screen, quality = 'balanced', reducedMotion = false}) {
  if (!PIXI?.Filter?.from || !target || quality === 'saver' || reducedMotion) return null;
  const make = (fragment, uniforms) => {
    try {
      // Both stages read uInputSize, so they must share a precision.
      const filter = PIXI.Filter.from({gl: {vertex: VERTEX, fragment, name: 'battle-hit-feel', preferredFragmentPrecision: 'highp'}, resources: {hitFeel: uniforms}});
      filter.resolution = 1; // a screen-sized pass at device scale 1: small and short-lived
      return filter;
    } catch { return null; }
  };
  const shockU = {uCenter: {value: new Float32Array(2), type: 'vec2<f32>'}, uRadius: {value: 0, type: 'f32'}, uWidth: {value: 18, type: 'f32'}, uAmp: {value: 0, type: 'f32'}};
  const splitU = {uOffset: {value: 0, type: 'f32'}};
  const rushU = {uCenter: {value: new Float32Array(2), type: 'vec2<f32>'}, uStrength: {value: 0, type: 'f32'}};
  const filters = {shock: make(SHOCK, shockU), split: make(SPLIT, splitU), rush: make(RUSH, rushU)};
  const runs = {shock: null, split: null, rush: null};
  const stats = {shocks: 0, splits: 0, rushes: 0, peakActive: 0};
  let attached = false;

  function update(dtMs) {
    const active = [];
    for (const [name, run] of Object.entries(runs)) {
      if (!run || !filters[name]) continue;
      run.age += dtMs;
      const k = run.age / run.life;
      if (k >= 1) { runs[name] = null; continue; }
      const u = filters[name].resources.hitFeel.uniforms;
      if (name === 'shock') { u.uRadius = run.reach * (1 - (1 - k) ** 2); u.uAmp = run.amp * (1 - k); u.uCenter[0] = run.x; u.uCenter[1] = run.y; }
      if (name === 'split') u.uOffset = run.px * (1 - k);
      if (name === 'rush') { u.uStrength = run.strength * Math.sin(Math.PI * k); u.uCenter[0] = run.x; u.uCenter[1] = run.y; }
      active.push(filters[name]);
    }
    stats.peakActive = Math.max(stats.peakActive, active.length);
    if (active.length) {
      const {width, height} = screen();
      target.filterArea = new PIXI.Rectangle(0, 0, Math.max(1, width), Math.max(1, height));
      target.filters = active; attached = true;
    } else if (attached) { target.filters = null; target.filterArea = null; attached = false; }
  }

  return Object.freeze({
    /** A heavy hit at a screen point: the ring runs out to `reach` px. */
    shock(x, y, {reach = 140, amp = 12} = {}) { if (filters.shock) { runs.shock = {x, y, reach, amp, age: 0, life: SHOCK_MS}; stats.shocks++; } },
    /** A critical hit: the colour channels part by `px` and close. */
    split({px = 5} = {}) { if (filters.split) { runs.split = {px, age: 0, life: SPLIT_MS}; stats.splits++; } },
    /** A signature move's release: the scene rushes toward its caster. */
    rush(x, y, {strength = 0.12} = {}) { if (filters.rush) { runs.rush = {x, y, strength, age: 0, life: RUSH_MS}; stats.rushes++; } },
    update,
    active: () => attached,
    getDiagnostics: () => Object.freeze({...stats, active: attached}),
    dispose() {
      if (attached) { target.filters = null; target.filterArea = null; }
      for (const filter of Object.values(filters)) filter?.destroy?.();
    }
  });
}
