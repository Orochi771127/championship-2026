/** Local Hunt presentation candidate. Original piece depth and native actor geometry remain authoritative. */
export function isHuntFoliageDitherRequested(location = globalThis.location) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location?.hostname)
    && new URLSearchParams(location?.search ?? '').get('huntFoliage') === 'dither-r1';
}

/** The actual trimmed cell, in actor-layer coordinates; signs preserve both native flips. */
export function describeHuntActorSilhouette(sprite, node) {
  const texture = sprite?.texture, orig = texture?.orig, trim = texture?.trim ?? orig, uv = texture?.uvs;
  if (!texture?.source || !orig || !trim || !uv || !node
    || sprite.visible === false || sprite.renderable === false || sprite.alpha === 0
    || node.visible === false || node.renderable === false || node.alpha === 0 || node.rotation || sprite.rotation
    || node.skew?.x || node.skew?.y || sprite.skew?.x || sprite.skew?.y) return null;
  const sx = node.scale.x * sprite.scale.x, sy = node.scale.y * sprite.scale.y;
  const rect = [
    node.x + node.scale.x * (sprite.x + (trim.x - sprite.anchor.x * orig.width) * sprite.scale.x),
    node.y + node.scale.y * (sprite.y + (trim.y - sprite.anchor.y * orig.height) * sprite.scale.y),
    trim.width * sx, trim.height * sy
  ];
  if (!rect.every(Number.isFinite) || !rect[2] || !rect[3] || !Number.isFinite(node.zIndex)) return null;
  return {
    textureSource: texture.source, rect, depth: node.zIndex,
    uvOriginX: [uv.x0, uv.y0, uv.x1 - uv.x0, uv.y1 - uv.y0],
    uvY: [uv.x3 - uv.x0, uv.y3 - uv.y0],
    left: Math.min(rect[0], rect[0] + rect[2]), right: Math.max(rect[0], rect[0] + rect[2]),
    top: Math.min(rect[1], rect[1] + rect[3]), bottom: Math.max(rect[1], rect[1] + rect[3])
  };
}

const vertex = `
attribute vec2 aPosition;
attribute vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform vec4 uColor;
varying vec2 vUV;
varying vec2 vWorld;
varying vec4 vColor;
void main() {
  vUV = aUV;
  vWorld = aPosition;
  vColor = uColor * uWorldColorAlpha;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;

function fragment(count) {
  const declarations = [], samples = [];
  for (let i = 0; i < count; i++) {
    declarations.push(`uniform sampler2D uActor${i};\nuniform vec4 uRect${i};\nuniform vec4 uUvOriginX${i};\nuniform vec2 uUvY${i};`);
    samples.push(`vec2 p${i} = (vWorld - uRect${i}.xy) / uRect${i}.zw;
      if (p${i}.x >= 0.0 && p${i}.y >= 0.0 && p${i}.x < 1.0 && p${i}.y < 1.0) {
        covered = max(covered, texture2D(uActor${i}, uUvOriginX${i}.xy + p${i}.x * uUvOriginX${i}.zw + p${i}.y * uUvY${i}).a);
      }`);
  }
  return `
uniform sampler2D uTexture;
varying vec2 vUV;
varying vec2 vWorld;
varying vec4 vColor;
${declarations.join('\n')}
float bayer2(vec2 p) { return 2.0 * p.x + 3.0 * p.y - 4.0 * p.x * p.y; }
void main() {
  vec4 color = texture2D(uTexture, vUV) * vColor;
  float covered = 0.0;
  ${samples.join('\n')}
  // World anchored 2px cells (one native pixel), 9/16 openings; no screen-space shimmer.
  vec2 p = mod(floor(vWorld / 2.0), 4.0);
  float order = 4.0 * bayer2(mod(p, 2.0)) + bayer2(floor(p / 2.0));
  if (covered > 0.0 && order < 9.0) color = vec4(0.0);
  gl_FragColor = color;
}`;
}

/** Only affected existing foreground pieces become meshes. No actor copy or offscreen render pass. */
export function createHuntFoliageDither({ PIXI, renderer, location = globalThis.location }) {
  if (!isHuntFoliageDitherRequested(location)) return null;
  const gl = renderer?.gl;
  if (!gl || !PIXI.Mesh || !PIXI.MeshGeometry || !PIXI.Shader || !PIXI.GlProgram) return null;
  const maxActors = Math.min(14, gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) - 1,
    Math.floor((gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) - 6) / 3));
  if (!(maxActors > 0)) return null;
  const entries = new Map();
  let active = new Set(), overflowCount = 0, created = 0, released = 0;
  const release = (index) => {
    const entry = entries.get(index);
    if (!entry) return;
    entry.sprite.visible = true;
    entry.mesh.removeFromParent();
    entry.mesh.destroy();
    entry.shader.destroy();
    entry.geometry.destroy(true);
    entries.delete(index);
    active.delete(index);
    released++;
  };
  function make(index, piece, texture, actors, parent, sprite) {
    const [x, y, w, h, ax, ay, z] = piece;
    const tw = texture.source.width, th = texture.source.height;
    const geometry = new PIXI.MeshGeometry({
      positions: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
      uvs: new Float32Array([ax / tw, ay / th, (ax + w) / tw, ay / th, (ax + w) / tw, (ay + h) / th, ax / tw, (ay + h) / th])
    });
    const resources = { uTexture: texture.source }, uniforms = {};
    actors.forEach((actor, i) => {
      resources[`uActor${i}`] = actor.textureSource;
      uniforms[`uRect${i}`] = { type: 'vec4<f32>', value: new Float32Array(actor.rect) };
      uniforms[`uUvOriginX${i}`] = { type: 'vec4<f32>', value: new Float32Array(actor.uvOriginX) };
      uniforms[`uUvY${i}`] = { type: 'vec2<f32>', value: new Float32Array(actor.uvY) };
    });
    resources.actorUniforms = uniforms;
    const shader = new PIXI.Shader({
      glProgram: PIXI.GlProgram.from({ name: `hunt-foliage-dither-${actors.length}`, vertex, fragment: fragment(actors.length), preferredFragmentPrecision: 'highp' }),
      resources
    });
    const mesh = new PIXI.Mesh({ geometry, shader, texture });
    mesh.label = 'hunt foliage local dither';
    mesh.eventMode = 'none';
    mesh.zIndex = z;
    // Preserve equal-depth ordering against solid pieces and other foliage.
    // The hidden original sprite remains the stable insertion reference.
    parent.addChildAt(mesh, parent.getChildIndex(sprite));
    const entry = { mesh, shader, geometry, count: actors.length, sprite };
    entries.set(index, entry);
    created++;
    return entry;
  }
  return {
    begin() { overflowCount = 0; },
    update(index, piece, texture, actors, parent, sprite) {
      if (piece[8] || !parent || !actors.length || actors.length > maxActors) {
        overflowCount++;
        return false;
      }
      let entry = entries.get(index);
      if (entry && entry.count !== actors.length) { release(index); entry = null; }
      entry ??= make(index, piece, texture, actors, parent, sprite);
      const uniforms = entry.shader.resources.actorUniforms;
      actors.forEach((actor, i) => {
        entry.shader.resources[`uActor${i}`] = actor.textureSource;
        uniforms.uniforms[`uRect${i}`].set(actor.rect);
        uniforms.uniforms[`uUvOriginX${i}`].set(actor.uvOriginX);
        uniforms.uniforms[`uUvY${i}`].set(actor.uvY);
      });
      uniforms.update();
      entry.mesh.visible = true;
      sprite.visible = false;
      return true;
    },
    finish(next) {
      for (const index of active) if (!next.has(index)) {
        const entry = entries.get(index);
        if (entry) { entry.mesh.visible = false; entry.sprite.visible = true; }
      }
      active = next;
    },
    forget: release,
    getDiagnostics: () => ({ mode: 'dither-r1', activePieces: active.size, cachedPieces: entries.size, maxActorsPerPiece: maxActors, overflowPieces: overflowCount, created, released }),
    dispose() { for (const index of [...entries.keys()]) release(index); }
  };
}
