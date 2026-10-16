// Offline Blender art on the existing Pixi stage. One active environment owns
// its own asset scope. No model weights, custom nodes or extra ticker at runtime.
import { createPixiAssetScope } from "../pixiCharacterRuntimeBundle.js";
import {loadTournamentStoneArt,mountTournamentStoneArt}from './dataArenaTournamentArt.js';

// Owner-authorized test release. Visual checkpoint, not final art acceptance.
export const HARBOR_ART_URL = "assets/production/data-arena/harbor-blender-r6/manifest.json";

export function dataArenaEnvironmentFloorOffset(grid, x, y, manifest) {
  const col = grid.cellOf(x), row = grid.cellOf(y);
  if (!grid.inBounds(col, row)) return 0;
  const terrain = grid.terrain[grid.index(col, row)];
  if(manifest?.kind==='TOURNAMENT_STONE')return terrain===2?manifest.projection.waterSurfaceOffset:0;
  const floor = manifest?.actorFloorOffsets;
  if (!floor) return terrain === 4 ? 7.3 : terrain === 5 ? 5.9 : 0;
  if (terrain === 4) return floor.stage;
  if (terrain === 5) return floor.bridge;
  if (terrain === 2) return floor.water??floor.ground;
  if (terrain !== 2 && ((row >= 26 && row < 28) || row >= 32)) return floor.deck;
  return floor.ground;
}

export async function loadDataArenaEnvironment({ PIXI, map, quality = "high", href, signal }) {
  if(!map.stage&&map.cols===24&&map.rows===16)return loadTournamentStoneArt({PIXI,map,quality,href,signal});
  if (!map.stage || map.cols !== 60 || map.rows !== 40 || map.cell !== 64) return null;
  const scope = createPixiAssetScope(PIXI, href, { signal });
  const held = new Set();
  const load = async (src) => { held.add(src); return scope.Assets.load(src); };
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    await Promise.allSettled([...held].map((src) => scope.Assets.unload(src)));
    held.clear();
  };
  try {
    const version = 'r6';
    const manifest = await load(HARBOR_ART_URL);
    if (manifest.id !== `data-arena:harbor:blender:${version}` || manifest.world.width !== map.cols * map.cell
      || manifest.world.height !== map.rows * map.cell || manifest.layoutSignature !== JSON.stringify(map)) {
      throw new Error("DATA_ARENA_ENVIRONMENT_GEOMETRY_MISMATCH");
    }
    const tier = quality === "low" ? "low" : "high";
    const version2 = manifest.schemaVersion === 2;
    const dynamicIds = new Set((manifest.dynamicProps??[]).map(p=>p.id));
    const records = version2 ? [...manifest.ground[tier],
      ...manifest.props.filter(p=>!dynamicIds.has(p.id)).map((r) => r.textures[tier]),
      ...(manifest.shoreDecor??[]).map(r=>r.textures[tier]),
      ...(manifest.dynamicProps??[]).flatMap(p=>Object.values(p.states).map(r=>r.textures[tier])), manifest.bridge.textures[tier], manifest.waves[tier], manifest.caustics[tier],
      ...manifest.mechanisms.flatMap((r) => r.frames.map((f) => f[tier])),...(manifest.crowdFrames??[]).map(r=>r.textures[tier]),...(manifest.foregroundBanks??[]).map(r=>r.textures[tier])]
      : [...manifest.ground[tier], ...manifest.props, ...manifest.mechanisms, manifest.bridge, manifest.waves[tier]];
    const uniqueRecords = [...new Map(records.map((r) => [r.src, r])).values()];
    const textures = new Map();
    // Keep decoder concurrency bounded on phones.
    for (let start = 0; start < uniqueRecords.length; start += 4) {
      const batch = await Promise.allSettled(uniqueRecords.slice(start, start + 4).map(async (record) => {
        if (!textures.has(record.src)) textures.set(record.src, await load(record.src));
      }));
      const failure = batch.find((r) => r.status === "rejected");
      if (failure) throw failure.reason;
      if (signal?.aborted) throw signal.reason ?? new Error("DATA_ARENA_ENVIRONMENT_ABORTED");
    }
    return { manifest, textures, tier, dispose, propArt:new Map((manifest.dynamicProps??[]).map(p=>[p.id,{...p,textures,tier}])), get disposed() { return disposed; } };
  } catch (error) {
    await dispose();
    throw error;
  }
}

/** Called by the product's one scene/ticker. Owns display objects only. */
export function mountDataArenaEnvironment({ PIXI, environment, ground, objects, water, bridge, suppressedPropIds = new Set() }) {
  if(environment.manifest.kind==='TOURNAMENT_STONE')return mountTournamentStoneArt({PIXI,environment,ground,objects,water,bridge});
  const { manifest, textures, tier } = environment;
  const version2 = manifest.schemaVersion === 2;
  const groundSprites = manifest.ground[tier].map((record) => {
    const sprite = new PIXI.Sprite(textures.get(record.src));
    sprite.position.set(record.x, record.y);
    sprite.width = record.width; sprite.height = record.height;
    ground.addChild(sprite);
    return { sprite, ...record };
  });
  const propSprites = [...manifest.props.filter(r=>!suppressedPropIds.has(r.id)),...(manifest.shoreDecor??[])].map((record) => {
    const sprite = new PIXI.Sprite(textures.get(version2 ? record.textures[tier].src : record.src));
    sprite.label = record.id;
    sprite.position.set(record.x, record.y);
    sprite.width = record.width; sprite.height = record.height;
    sprite.zIndex = record.sortY;
    objects.addChild(sprite);
    return { sprite, ...record };
  });
  const foregroundSprites=(manifest.foregroundBanks??[]).map(record=>{
    const sprite=new PIXI.Sprite(textures.get(record.textures[tier].src));sprite.position.set(record.x,record.y);sprite.width=record.width;sprite.height=record.height;sprite.zIndex=record.sortY;objects.addChild(sprite);return{...record,sprite};
  });
  const crowdRecord=manifest.crowdFrames?.[0];let crowdFrame=0;
  const modeledCrowd=crowdRecord?new PIXI.Sprite(textures.get(crowdRecord.textures[tier].src)):null;
  if(modeledCrowd){modeledCrowd.position.set(crowdRecord.x,crowdRecord.y);modeledCrowd.width=crowdRecord.width;modeledCrowd.height=crowdRecord.height;modeledCrowd.zIndex=191;objects.addChild(modeledCrowd);}
  bridge.clear();
  const deck = new PIXI.Sprite(textures.get(version2 ? manifest.bridge.textures[tier].src : manifest.bridge.src));
  deck.position.set(manifest.bridge.x, manifest.bridge.y);
  deck.width = manifest.bridge.width; deck.height = manifest.bridge.height;
  bridge.addChild(deck);
  // The seabed and refraction are in the foundation. Only quiet specular
  // wavelets scroll here, constrained to the simulation's water rectangle.
  for (const child of water.removeChildren()) child.destroy();
  const waveRecord = manifest.waves[tier];
  const wave = new PIXI.TilingSprite({ texture: textures.get(waveRecord.src), width: 3840, height: 256 });
  wave.position.set(0, 1792);
  wave.tileScale.set(3840 / wave.texture.width, 256 / wave.texture.height);
  wave.alpha = manifest.waterWaveAlpha ?? (version2 ? .20 : .26);
  if(manifest.waterFxRect){const[x,y,w,h]=manifest.waterFxRect;wave.position.set(x,y);wave.width=w;wave.height=h;}
  water.addChild(wave);
  const caustic = version2 ? new PIXI.TilingSprite({ texture: textures.get(manifest.caustics[tier].src), width: 3840, height: 256 }) : null;
  if (caustic) {
    caustic.position.set(0, 1792); caustic.tileScale.set(3840 / caustic.texture.width, 256 / caustic.texture.height);
    caustic.alpha = manifest.causticsAlpha ?? .38; water.addChildAt(caustic, 0);
    if(manifest.waterFxRect){const[x,y,w,h]=manifest.waterFxRect;caustic.position.set(x,y);caustic.width=w;caustic.height=h;}
  }
  const pulses = [];
  const mechanisms = manifest.mechanisms.map((record) => {
    const sprite = new PIXI.Sprite(textures.get(version2 ? record.frames[0][tier].src : record.src));
    if (version2) sprite.position.set(record.x, record.y);
    else {
      sprite.anchor.set((record.pivot[0] - record.x) / record.width, (record.pivot[1] - record.y) / record.height);
      sprite.position.set(...record.pivot);
    }
    sprite.width = record.width; sprite.height = record.height;
    sprite.zIndex = record.sortY; objects.addChild(sprite);
    return { sprite, ...record, frame: 0 };
  });
  for (const [c, r] of manifest.layout.pylons) {
    const lamp = new PIXI.Graphics().circle(0, 0, 6).fill({ color: 0x8bdac9, alpha: .55 });
    lamp.position.set((c + .5) * 64, (r + .5) * 64 - (manifest.pylonLampHeightPx ?? 29));
    lamp.zIndex = (r + 1) * 64 + .1;
    objects.addChild(lamp); pulses.push(lamp);
  }
  return {
    update({ elapsed, reducedMotion, left, right, top, bottom, low, focus,reaction }) {
      for (const record of [...groundSprites, ...propSprites,...foregroundSprites]) record.sprite.visible =
        record.x < right && record.x + record.width > left && record.y < bottom && record.y + record.height > top;
      if(modeledCrowd){crowdFrame=reducedMotion?0:Math.floor(elapsed*(reaction?.t>0?6:4)/(low?2:1))%manifest.crowdFrames.length;modeledCrowd.texture=textures.get(manifest.crowdFrames[crowdFrame].textures[tier].src);modeledCrowd.visible=top<crowdRecord.y+crowdRecord.height&&bottom>crowdRecord.y;}
      wave.tilePosition.x = reducedMotion ? 0 : elapsed * (low ? 5 : 8);
      wave.tilePosition.y = reducedMotion ? 0 : Math.sin(elapsed * .55) * 1.5;
      wave.visible = bottom > 1792 && top < 2048;
      if (caustic) {
        caustic.visible = wave.visible;
        caustic.tilePosition.x = reducedMotion ? 0 : Math.sin(elapsed * .35) * 2;
        caustic.tilePosition.y = reducedMotion ? 0 : Math.cos(elapsed * .28) * 1.2;
      }
      for (let i = 0; i < pulses.length; i++) pulses[i].alpha = reducedMotion ? .65 : .6 + Math.sin(elapsed * 1.7 + i * .7) * .15;
      for (let i = 0; i < mechanisms.length; i++) {
        const record = mechanisms[i];
        if (version2) {
          const step = low ? 2 : 1;
          record.frame = reducedMotion ? 0 : (Math.floor(elapsed * 1000 / (record.frameDurationMs * step)) * step + i * 4) % record.frameCount;
          record.sprite.texture = textures.get(record.frames[record.frame][tier].src);
          record.sprite.visible = record.x < right && record.x + record.width > left && record.y < bottom && record.y + record.height > top;
        } else record.sprite.rotation = reducedMotion ? 0 : Math.sin(elapsed * .65 + i * 1.6) * .15;
      }
      // Keep tall geometry while exposing an actor immediately behind its base.
      for (const record of [...propSprites, ...mechanisms]) {
        const behind = version2 && focus && focus.y < record.sortY && focus.y > record.y
          && focus.x > record.x && focus.x < record.x + record.width;
        record.sprite.alpha = behind ? .48 : 1;
      }
    },
    diagnostics() { return { id: manifest.id, tier, groundChunks: groundSprites.length,
      visibleGroundChunks: groundSprites.filter((r) => r.sprite.visible).length,
      props: propSprites.length, ambientObjects: 1 + Boolean(caustic) + pulses.length + mechanisms.length, decodedBytes: manifest.decodedBytes[tier],crowdFrame,crowdCount:manifest.crowdCount??null,
      waterOffsetX: wave.tilePosition.x, armAngles: mechanisms.map((r) => r.sprite.rotation), armFrames: mechanisms.map((r) => r.frame),
      visibleMechanisms: mechanisms.filter((r) => r.sprite.visible).map((r) => r.id),
      occluders: [...propSprites, ...mechanisms].map((r) => ({ id: r.colliderId ?? r.id, sortY: r.sortY, alpha: r.sprite.alpha, drawIndex: objects.children.indexOf(r.sprite) })) }; }
  };
}
