// Each scene owns its decoded images. Starting a new cast can retry a failed request.
export function createMoveAtlas({ PIXI, ground, front, reducedMotion, records, mode, assetRoot, labelPrefix, groundRadii, maxSheets = Infinity }) {
  const sheets = new Map(), pending = new Map(), actors = new Map();
  const abort = new AbortController();
  let disposed = false, frame = 0;
  function request(key) {
    if (!records.has(key) || disposed || sheets.has(key) || pending.has(key)) return;
    const base = new URL(assetRoot + key, document.baseURI).href;
    async function fetchAsset(ext, mime) {
      const res = await fetch(base + ext, { signal: abort.signal });
      if (!res.ok || res.headers.get('content-type')?.split(';')[0] !== mime) throw Error('MOVE_ATLAS_RESPONSE');
      return res;
    }
    async function load() {
      const data = await (await fetchAsset('.json', 'application/json')).json();
      if (data.key !== key || data.mode !== mode || data.battleRecord !== records.get(key)) throw Error('MOVE_ATLAS_ID');
      const blob = await (await fetchAsset('.png', 'image/png')).blob();
      const bitmap = await createImageBitmap(blob);
      if (disposed) { bitmap.close(); return; }
      const source = new PIXI.ImageSource({ resource: bitmap, scaleMode: 'nearest' });
      const textures = [], clips = new Map();
      try {
        for (const phase of data.phases) {
          let duration = 0;
          const frames = phase.frames.map(f => {
            const texture = new PIXI.Texture({ source, frame: new PIXI.Rectangle(f.x, f.y, f.w, f.h) });
            textures.push(texture);
            duration += f.durationMs;
            return { texture, ax: f.pivot.x / f.w, ay: f.pivot.y / f.h, end: duration };
          });
          clips.set(phase.key, { frames, duration });
        }
        sheets.set(key, { bitmap, source, textures, clips, used: frame });
      } catch (error) {
        for (const texture of textures) texture.destroy(false);
        source.destroy(); bitmap.close(); throw error;
      }
    }
    pending.set(key, load().catch(() => {}).finally(() => pending.delete(key)));
  }
  function paint(actor, age) {
    const { clip, sprite } = actor;
    const ms = reducedMotion ? clip.duration * 0.5 : Math.min(clip.duration - 0.01, Math.max(0, age));
    const f = clip.frames.find(f => ms < f.end);
    sprite.texture = f.texture;
    sprite.anchor.set(f.ax, f.ay);
  }
  function place(id, key, phase, x, y, angle, scale, age, onGround, transient = false, stretchX = 1) {
    const sheet = sheets.get(key);
    const clip = sheet?.clips.get(phase);
    if (!clip) return false;
    sheet.used = frame;
    let actor = actors.get(id);
    if (!actor) {
      const sprite = new PIXI.Sprite(clip.frames[0].texture);
      sprite.label = labelPrefix + '/' + key + '/' + phase;
      (onGround ? ground : front).addChild(sprite);
      actor = { sprite, clip, key, age: 0, transient };
      actors.set(id, actor);
    }
    actor.frame = frame;
    actor.sprite.position.set(x, y);
    actor.sprite.rotation = angle;
    const unit = onGround ? scale / groundRadii.get(key + '/' + phase) : scale;
    actor.sprite.scale.set(unit * stretchX, unit);
    // Warning progress follows the live countdown; travelling art loops on its own instance clock.
    const ms = phase === 'warning' ? age * clip.duration : (phase === 'travel' || phase === 'active') ? age % clip.duration : age;
    paint(actor, ms);
    return true;
  }
  function release(sheet) {
    for (const texture of sheet.textures) texture.destroy(false);
    sheet.source.destroy();
    sheet.bitmap.close();
  }
  function trim() {
    if (sheets.size <= maxSheets) return;
    const active = new Set([...actors.values()].map(actor => actor.key));
    const idle = [...sheets].filter(([key, sheet]) => !active.has(key) && frame - sheet.used > 60)
      .sort((a, b) => a[1].used - b[1].used);
    for (const [key, sheet] of idle) {
      if (sheets.size <= maxSheets) break;
      sheets.delete(key);
      release(sheet);
    }
  }
  function clear() {
    for (const a of actors.values()) a.sprite.destroy();
    actors.clear();
  }
  return {
    request,
    supports: key => records.has(key),
    ready: (key, phase) => sheets.get(key)?.clips.has(phase) ?? false,
    duration: (key, phase) => sheets.get(key)?.clips.get(phase)?.duration ?? 0,
    beginFrame() { frame++; },
    place,
    endFrame(deltaMs) {
      for (const [id, a] of actors) {
        if (a.transient) {
          a.age += deltaMs;
          if (a.age < a.clip.duration) { paint(a, a.age); continue; }
        } else if (a.frame === frame) continue;
        a.sprite.destroy(); actors.delete(id);
      }
      trim();
    },
    clear,
    diagnostics: () => ({ sheets: [...sheets.keys()], pending: pending.size,
      actors: [...actors.values()].map(a => ({ label: a.sprite.label, x: a.sprite.x, y: a.sprite.y })) }),
    dispose() {
      disposed = true; abort.abort(); clear();
      for (const sheet of sheets.values()) release(sheet);
      sheets.clear();
    }
  };
}
