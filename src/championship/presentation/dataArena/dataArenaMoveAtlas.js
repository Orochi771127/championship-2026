const records = new Map([
  ['arcBolt', 623], ['arcFan', 624], ['arcField', 625],
  ['arcStorm', 626], ['boltDash', 628], ['brutalCharge', 629],
  ['clawSweep', 631], ['coreNova', 632], ['dawnLance', 633],
  ['emberBolt', 635], ['fangRush', 636], ['flameRing', 637],
  ['foamZone', 638], ['frostFan', 639], ['grovePulse', 642],
  ['haloPulse', 643], ['iceCage', 644], ['iceShard', 645],
  ['impactNova', 646], ['impactShot', 647], ['leafFan', 649],
  ['nightPulse', 650], ['quakeSlam', 651], ['radiantDash', 652],
  ['scatterLight', 654], ['seedBolt', 655], ['shadeBolt', 656],
  ['shadeField', 657], ['shardStorm', 659], ['shardVolley', 660],
  ['sunSpear', 663], ['surfRush', 664], ['thornRush', 665],
  ['tideBolt', 666], ['tideWave', 668], ['vineSnare', 669],
  ['vortex', 670], ['whiteout', 671]
]);
// Painted extents in source pixels, measured separately for each clip from its pivot.
const groundRadii = new Map([
  ['arcField/warning', 26], ['arcField/burst', 26],
  ['flameRing/warning', 29], ['flameRing/burst', 29],
  ['foamZone/warning', 29], ['foamZone/burst', 30],
  ['iceCage/warning', 26], ['iceCage/burst', 28],
  ['quakeSlam/warning', 26], ['quakeSlam/burst', 27],
  ['shadeField/warning', 29], ['shadeField/burst', 30],
  ['vineSnare/warning', 30], ['vineSnare/burst', 27],
  ['clawSweep/burst', 28], ['coreNova/burst', 26],
  ['grovePulse/burst', 28], ['haloPulse/burst', 27],
  ['impactNova/burst', 28], ['nightPulse/burst', 27],
  ['vortex/burst', 35], ['whiteout/burst', 34]
]);
const assetRoot = 'assets/production/vfx/arena-moves/';

// Each scene owns its decoded images. Starting a new cast can retry a failed request.
export function createArenaMoveAtlas({ PIXI, ground, front, reducedMotion }) {
  const sheets = new Map(), pending = new Map(), actors = new Map();
  const abort = new AbortController();
  let disposed = false, frame = 0;
  function request(key) {
    if (!records.has(key) || disposed || sheets.has(key) || pending.has(key)) return;
    const base = new URL(assetRoot + key, document.baseURI).href;
    async function fetchAsset(ext, mime) {
      const res = await fetch(base + ext, { signal: abort.signal });
      if (!res.ok || res.headers.get('content-type')?.split(';')[0] !== mime) throw Error('ARENA_ATLAS_RESPONSE');
      return res;
    }
    async function load() {
      const data = await (await fetchAsset('.json', 'application/json')).json();
      if (data.key !== key || data.mode !== 'arena' || data.battleRecord !== records.get(key)) throw Error('ARENA_ATLAS_ID');
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
        sheets.set(key, { bitmap, source, textures, clips });
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
  function place(id, key, phase, x, y, angle, scale, age, onGround, transient = false) {
    const clip = sheets.get(key)?.clips.get(phase);
    if (!clip) return false;
    let actor = actors.get(id);
    if (!actor) {
      const sprite = new PIXI.Sprite(clip.frames[0].texture);
      sprite.label = 'arena-move/' + key + '/' + phase;
      (onGround ? ground : front).addChild(sprite);
      actor = { sprite, clip, age: 0, transient };
      actors.set(id, actor);
    }
    actor.frame = frame;
    actor.sprite.position.set(x, y);
    actor.sprite.rotation = angle;
    actor.sprite.scale.set(onGround ? scale / groundRadii.get(key + '/' + phase) : scale);
    // Warning progress follows the live countdown; travelling art loops on its own instance clock.
    const ms = phase === 'warning' ? age * clip.duration : phase === 'travel' ? age % clip.duration : age;
    paint(actor, ms);
    return true;
  }
  function clear() {
    for (const a of actors.values()) a.sprite.destroy();
    actors.clear();
  }
  return {
    request,
    supports: key => records.has(key),
    ready: (key, phase) => sheets.get(key)?.clips.has(phase) ?? false,
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
    },
    clear,
    diagnostics: () => ({ sheets: [...sheets.keys()], pending: pending.size,
      actors: [...actors.values()].map(a => ({ label: a.sprite.label, x: a.sprite.x, y: a.sprite.y })) }),
    dispose() {
      disposed = true; abort.abort(); clear();
      for (const s of sheets.values()) {
        for (const t of s.textures) t.destroy(false);
        s.source.destroy(); s.bitmap.close();
      }
      sheets.clear();
    }
  };
}
