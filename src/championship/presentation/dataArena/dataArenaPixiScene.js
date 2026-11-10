// Data Arena -- the PixiJS scene on the one Championship stage.
//
// Layer contract (docs/reports/data-arena-2026-10-15):
//  * DOM owns the HUD, menus, touch controls and text; this scene owns only the
//    playable 2D field. No Three.js, no second Application, no ticker: the
//    screen calls render(dtMs) from its single callback on the shared
//    Application ticker, and dispose() removes every container, pooled sprite,
//    generated texture and character bundle this scene created.
//  * The scene reads the simulation's state and events; it writes nothing the
//    rules read. Coordinates: one world unit = one CSS px at zoom 1; the world
//    container carries the camera transform; the screen layer is unscaled.
//  * Budgets: particles 380 high / 120 low, shots capped by the rules (320),
//    per-cell fire/ice sprites pooled, everything outside the view culled.

import { DATA_ARENA_TERRAIN, DATA_ARENA_SCAN, DATA_ARENA_BEACON, DATA_ARENA_GRID_RULES } from "../../modes/dataArena/dataArenaConfig.js";
import { mixColor } from "../battleFx/battleFxLayer.js";
import { createDataArenaCamera } from "./dataArenaCamera.js";
import { createDataArenaTextures } from "./dataArenaTextures.js";
import { DATA_ARENA_SEQUENCES } from "./dataArenaRoster.js";
import { createDataArenaCharacterAction, sampleDataArenaRelayAction, dataArenaRelaySlotPlacement } from './dataArenaCharacterAction.js';
import { mountDataArenaEnvironment, dataArenaEnvironmentFloorOffset } from "./dataArenaEnvironment.js";
import { mountDataArenaInteractionView } from "./dataArenaInteractionView.js";

import { createDataArenaRelayEffects } from './dataArenaRelayEffects.js';
import { createDataArenaElementFx } from './dataArenaElementFx.js';
import { reviewedReleasePoint, releaseOffset, reviewedIdleBreath, reviewedWinHop, reviewedMoveRate } from './dataArenaReviewedMotion.js';
import { RELAY_ACTION_PROFILES, relaySequence, relayEffectStyle } from '../../modes/dataArena/dataArenaRelay.js';
import { RELAY_ROSTER, relayPartner } from '../../modes/dataArena/dataArenaRelayRoster.js';
import { createBattleBurstShell } from '../vs5/battleBurstShell.js';
import { GACHA_BLOODLINES } from '../../gacha/cyberGacha.js';
import { arenaText as t } from '../../text/dataArenaText.js';
// Burst evolution (OWNER_APPROVED_ADAPTATION 2026-11-02): the hex shell closes over the 成熟期 for this long before
// its form stands in; then the plates scatter. The match itself never pauses.
const ARENA_BURST_REVEAL_SECONDS = 0.6, ARENA_BURST_SCATTER_SECONDS = 0.5, ARENA_BURST_SHATTER_SECONDS = 0.4;
// A tier-2 burst shows its tier-1 form for this long before the second flash (awakening raising, 2026-11-02).
const ARENA_BURST_CHAIN_SECONDS = 0.3;
const arenaReveal = burst => ARENA_BURST_REVEAL_SECONDS + (burst?.via != null ? ARENA_BURST_CHAIN_SECONDS : 0);

const T = DATA_ARENA_TERRAIN;
const TAU = Math.PI * 2;


const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const PARTICLE_CAP = Object.freeze({ high: 380, low: 120 });
const ROLE_HEIGHT = Object.freeze({ PLAYER: 78, MATE: 112, BOSS: 196, RIVAL: 96, CHAMPION: 132 });
const BEAM_ELEVATION = 22;

const PARTNER_BEAM = Object.freeze({ "ember-lizard": 0x6ff7ff, "corona-cub": 0xffe066, "frost-drake": 0xa8f0ff });
const CROWD_TINT = Object.freeze({ PERFECT_DODGE: 0x7fe9ff, ELEMENT_CHAIN: 0xff9a3c, RESCUE: 0x8dffb0, BEACON: 0xffe066,
  CORE_OUT: 0x7fd0ff, MULTI_KILL: 0xff6ad5, BOSS_DOWN: 0xffffff, CHEER: 0xffd34d, VICTORY: 0xfff2a8, DEFEAT: 0x4a5a80 });

// One scale per body keeps authored canvas/pivot intact across poses and KO; the
// loader's per-role reference height (its down-facing walk) maps the body to roleHeight.
export function reviewedArenaGeometryScale(geometry,roleHeight,{partial=false,nativeScale=1}={}){
  return partial?nativeScale*4/(geometry?.scale??4):roleHeight/(geometry?.referenceHeight??64)/(geometry?.scale??4);
}
export function applyReviewedArenaPoseScale(sprite,sample,roleHeight,sink=0){
  const scale=reviewedArenaGeometryScale(sample?.geometry,roleHeight);
 sprite.scale.set(scale*(sample?.mirrorX?-1:1),scale*(1-sink*.5));
 return scale;
}

export function mountDataArenaScene({ stage, sim, cast, bundles = new Map(), quality = "high", reducedMotion = false, shake = true, partnerId, environment = null, interactionArt = null, effectArt = null }) {
  // Construction is transactional: even a renderer failure before a scene is
  // returned must release this scene's resources, not the shared Application.
  const rollback = [];
  try {
  const PIXI = stage.PIXI;
  const generatedTextures = createDataArenaTextures(PIXI);
  if (!generatedTextures) throw new Error("DATA_ARENA_CANVAS_UNAVAILABLE");
  const relayTextures = sim.getState?.()?.gameMode === 'RELAY' ? createDataArenaRelayEffects(PIXI) : null;
  if(relayTextures)rollback.push(()=>relayTextures.destroy());
  const textures = {...generatedTextures, ...relayTextures, destroy:()=>{generatedTextures.destroy();relayTextures?.destroy();}};
  if(interactionArt)for(const[key,id]of[["ice","ICE"],["iceCracked","ICE_CRACKED"],["iceMelt","ICE_MELT"]])textures[key]=interactionArt.textures.get(interactionArt.manifest.ice[id][interactionArt.tier].src);
  rollback.push(() => textures.destroy());
  const grid = sim.grid;
  const MAP = grid.map;
  const cell = grid.cell, worldWidth = grid.cols * cell, worldHeight = grid.rows * cell;
  const rectsOf = (kind) => MAP.rects.filter((rect) => rect[4] === kind);
  const standRows = Math.max(0, ...rectsOf(T.STANDS).map(([, r0, , h]) => r0 + h));
  const harborLayout = Boolean(MAP.stage);
  const rich = quality !== "low";
  const root = stage.createSceneRoot("data arena");
  rollback.push(() => { root.parent?.removeChild(root); root.destroy({ children: true, texture: false, textureSource: false }); });
  const unmark = stage.markScene("cm-data-arena-canvas");
  rollback.push(unmark);
  const world = new PIXI.Container({ label: "arena world" });
  const screen = new PIXI.Container({ label: "arena screen overlay" });
  root.addChild(world, screen);
  // The harbor is authored as vector Graphics, then baked once into culled
  // render-texture chunks: drawing thousands of static primitives every frame
  // cost about 70% of a software-rendered frame. Low quality bakes at half
  // resolution. Chunks are re-baked after a WebGL context restore.
  const ground = new PIXI.Graphics(); ground.label = "arena ground source";
  rollback.push(() => ground.destroy());
  const groundChunks = new PIXI.Container({ label: "arena ground" });
  const water = new PIXI.Container({ label: "arena water" });
  const waterStrips = rectsOf(T.WATER).map(([c0, r0, w, h]) => {
    const strip = new PIXI.TilingSprite({ texture: textures.water, width: w * cell, height: h * cell });
    strip.position.set(c0 * cell, r0 * cell);
    water.addChild(strip);
    return strip;
  });
  const cellFx = new PIXI.Container({ label: "arena cell fx" });
  const bridge = new PIXI.Graphics(); bridge.label = "arena bridge";
  const marks = new PIXI.Graphics(); marks.label = "arena telegraphs";
  const objects = new PIXI.Container({ label: "arena objects", sortableChildren: true });
  const shotGlow = new PIXI.Container({ label: "arena shot glow" });
  const shots = new PIXI.Container({ label: "arena shots" });
  const beams = new PIXI.Container({ label: "arena beams" });
  const particles = new PIXI.Container({ label: "arena particles" });
  const lights = new PIXI.Container({ label: "arena stand lights" });
  // A faint tactical grid over the floor art (drawn once, after the bake).
  const tactical = new PIXI.Graphics(); tactical.label = "arena tactical grid";
  // Arcade damage numbers (2026-10-28): pooled, arcing, thick outline; drawn
  // in the world so they ride the camera. Since 2026-11-01 heavy hits hold the
  // drawn fighters 55 ms (drawing only; the simulation and input keep running).
  const numberLayer = new PIXI.Container({ label: "arena damage numbers" });
  world.addChild(groundChunks, tactical, water, cellFx, bridge, marks, objects, shotGlow, shots, beams, particles, lights, numberLayer);
  const burstShell = createBattleBurstShell({ PIXI, layer: objects, reducedMotion });
  rollback.push(() => burstShell.dispose());
  /** The shell for one fighter from its burst record (relay): wrap, then scatter; a short shatter when it ends. */
  function drawArenaBurstShell(key, body, burst, role) {
    const height = ROLE_HEIGHT[role] ?? 80, centerY = body.y - floorOffset(body.x, body.y) - height * 0.5;
    const shape = { x: body.x, y: centerY, width: height * 0.8, height, zIndex: body.y + 0.5, color: GACHA_BLOODLINES[burst?.bloodline]?.color ?? null };
    const since = burst && burst.startedAt !== null ? state.time - burst.startedAt : Infinity, reveal = arenaReveal(burst);
    if (burst?.phase === 'BURST' && since < reveal) {
      // The wrap runs 0.6 s; a tier-2 chain adds its tier-1 form's 0.3 s (frames 72..89 of the shell).
      const frames = burst.via != null ? 90 : 72, wrapFrame = since < ARENA_BURST_REVEAL_SECONDS ? since / ARENA_BURST_REVEAL_SECONDS * 72
        : 72 + (since - ARENA_BURST_REVEAL_SECONDS) / ARENA_BURST_CHAIN_SECONDS * 18;
      burstShell.update(key, { ...shape, burst: { phase: 'WRAP', tier: burst.tier, wrapFrame, wrapFrames: frames } });
    } else if (burst?.phase === 'BURST' && since < reveal + ARENA_BURST_SCATTER_SECONDS) {
      burstShell.update(key, { ...shape, burst: { phase: 'BURST', tier: burst.tier, phaseFrame: (since - reveal) * 60 } });
    } else if (burst?.phase === 'WEAK' && state.time - (burst.until - 5) < ARENA_BURST_SHATTER_SECONDS) {
      burstShell.update(key, { ...shape, burst: { phase: 'WEAK', tier: burst.tier, phaseFrame: (state.time - (burst.until - 5)) * 60 } });
    } else burstShell.retire(key);
  }
  // Five-layer element dressing and original effect cells (VFX_FIVE_LAYER_20261101).
  const elementFx = typeof createDataArenaElementFx === 'function' ? createDataArenaElementFx({ PIXI, ground: cellFx, front: particles, art: effectArt, quality, reducedMotion,
    // One-style move effects (MOVE_VFX_KIT_20261105); ?moveVfx=classic keeps the cells over vector heads.
    kit: new URLSearchParams(globalThis.location?.search ?? '').get('moveVfx') !== 'classic' }) : null;
  const kitShots = Boolean(elementFx?.drawsShots?.());
  if (elementFx) rollback.push(() => elementFx.dispose());

  const camera = createDataArenaCamera({ worldWidth, worldHeight, reducedMotion, shake, cover: Boolean(grid.map.battleFieldId), artBounds: environment?.manifest?.cameraArtBounds });
  let elapsed = 0;
  let ambientElapsed = 0;
  let view = null;
  const state = sim.getState();
  const floorOffset=(x,y)=>(environment?dataArenaEnvironmentFloorOffset(grid,x,y,environment.manifest):0)
    +(interactionArt&&grid.surfaceAt(x,y).startsWith("ICE")?(interactionArt.manifest.ice.floorOffsetPx??2.94):0);

  // ------------------------------------------------------------------ static harbor
  const legacyGround=!environment||environment.manifest.scope==='REPRESENTATIVE_NORTH_AND_WATER';
  if (legacyGround) { drawGround(); drawBridge(); }
  const CHUNK = 1024, bakeScale = rich ? 1 : 0.5;
  const chunks = [];
  for (let cy = 0; legacyGround && cy < worldHeight; cy += CHUNK) for (let cx = 0; cx < worldWidth; cx += CHUNK) {
    const width = Math.min(CHUNK, worldWidth - cx), height = Math.min(CHUNK, worldHeight - cy);
    const texture = PIXI.RenderTexture.create({ width, height, resolution: bakeScale });
    rollback.push(() => texture.destroy(true));
    const sprite = new PIXI.Sprite(texture);
    sprite.position.set(cx, cy);
    groundChunks.addChild(sprite);
    chunks.push({ sprite, texture, x: cx, y: cy, width, height });
  }
  function bakeGround() {
    for (const chunk of chunks) {
      stage.app.renderer.render({ container: ground, target: chunk.texture, clear: true,
        transform: new PIXI.Matrix().translate(-chunk.x, -chunk.y) });
    }
  }
  bakeGround();
  const unsubscribeRestore = stage.onContextRestored?.(() => bakeGround()) ?? (() => {});
  rollback.push(unsubscribeRestore);
  const environmentView = environment ? mountDataArenaEnvironment({ PIXI, environment, ground: groundChunks, objects, water, bridge, suppressedPropIds:new Set(grid.props.map(p=>p.id)) }) : null;
  const interactionView=mountDataArenaInteractionView({PIXI,grid,art:interactionArt,objects,ground:groundChunks,useHarborPatches:Boolean(environment&&MAP.stage&&!environment.manifest.cleanGround),floorOffset,propArt:environment?.propArt});
  // Speed reference for footwork and dashes: a line every four cells and edge
  // ticks every cell. The legacy harbor ground already bakes its own grid.
  if (!legacyGround) {
    const step = cell * 4;
    for (let x = step; x < worldWidth; x += step) tactical.moveTo(x, 0).lineTo(x, worldHeight);
    for (let y = step; y < worldHeight; y += step) tactical.moveTo(0, y).lineTo(worldWidth, y);
    tactical.stroke({ width: 2, color: 0x9ff6ff, alpha: 0.07 });
    for (let x = 0; x <= worldWidth; x += cell) {
      const tick = Math.round(x / cell) % 4 === 0 ? 18 : 8;
      tactical.moveTo(x, 0).lineTo(x, tick).moveTo(x, worldHeight).lineTo(x, worldHeight - tick);
    }
    for (let y = 0; y <= worldHeight; y += cell) {
      const tick = Math.round(y / cell) % 4 === 0 ? 18 : 8;
      tactical.moveTo(0, y).lineTo(tick, y).moveTo(worldWidth, y).lineTo(worldWidth - tick, y);
    }
    tactical.stroke({ width: 2, color: 0x9ff6ff, alpha: 0.3 });
  }
  function drawGround() {
    const g = ground;
    g.rect(0, 0, worldWidth, worldHeight).fill({ color: 0x141c2b });
    // North yard and south pier plating, with panel seams.
    g.rect(0, standRows * cell, worldWidth, worldHeight - standRows * cell).fill({ color: 0x1a2436 });
    if (harborLayout) g.rect(0, 32 * cell, worldWidth, 8 * cell).fill({ color: 0x1b2a33 });
    else g.rect(0, 11 * cell, worldWidth, worldHeight - 11 * cell).fill({ color: 0x1b2638 });
    for (let c = 0; c <= grid.cols; c++) g.moveTo(c * cell, standRows * cell).lineTo(c * cell, worldHeight).stroke({ width: c % 4 === 0 ? 2 : 1, color: 0x26334a, alpha: c % 4 === 0 ? 0.9 : 0.45 });
    for (let r = standRows; r <= grid.rows; r++) g.moveTo(0, r * cell).lineTo(worldWidth, r * cell).stroke({ width: r % 4 === 0 ? 2 : 1, color: 0x26334a, alpha: r % 4 === 0 ? 0.9 : 0.45 });
    // Neon guide lanes: stage to the docks and to each beacon.
    const lane = (x0, y0, x1, y1) => g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 6, color: 0x2ad8ff, alpha: 0.16 });
    if (harborLayout) {
      lane(30.5 * cell, 21 * cell, 30.5 * cell, 27.6 * cell);
      lane(4 * cell, 12 * cell, 56 * cell, 12 * cell);
      for (const [c, r] of MAP.beacons) lane((c + 0.5) * cell, 32.4 * cell, (c + 0.5) * cell, (r + 0.5) * cell);
    } else {
      // Duel arena: a centre ring and the two start marks.
      g.circle(worldWidth / 2, worldHeight / 2, 5 * cell).stroke({ width: 4, color: 0x63e3ff, alpha: 0.18 });
      for (const [c, r] of [MAP.playerSpawn, MAP.rivalSpawn]) g.circle((c + 0.5) * cell, (r + 0.5) * cell, 46).stroke({ width: 4, color: 0xffd34d, alpha: 0.35 });
    }
    // Flammable yards: oil-slick data spills with hazard edging.
    for (const [c0, r0, w, h] of MAP.flammable) {
      g.rect(c0 * cell, r0 * cell, w * cell, h * cell).fill({ color: 0x2a1d22, alpha: 0.9 });
      for (let i = 0; i < w * h; i += 3) {
        const c = c0 + (i % w), r = r0 + Math.floor(i / w);
        if (!grid.flammable[grid.index(c, r)]) continue;
        g.ellipse((c + 0.5) * cell + ((i * 13) % 17) - 8, (r + 0.5) * cell, 24, 12).fill({ color: 0x3b1f3a, alpha: 0.75 });
      }
      for (let x = c0 * cell; x < (c0 + w) * cell; x += 32) {
        g.rect(x, r0 * cell - 6, 16, 6).fill({ color: 0xffa62b, alpha: 0.7 });
        g.rect(x, (r0 + h) * cell, 16, 6).fill({ color: 0xffa62b, alpha: 0.7 });
      }
    }
    // Banks along the tide channel.
    for (const [c0, r0, w, h] of [...rectsOf(T.WATER), ...rectsOf(T.BRIDGE)]) {
      const x0 = c0 * cell, width = w * cell;
      g.rect(x0, r0 * cell - 10, width, 10).fill({ color: 0x8aa3b8 });
      g.rect(x0, (r0 + h) * cell, width, 10).fill({ color: 0x6f8799 });
      for (let x = x0; x < x0 + width; x += 48) g.rect(x, r0 * cell - 10, 24, 4).fill({ color: 0xffd23f, alpha: 0.85 });
    }
    if (harborLayout) drawStage(g);
    // Containers and pylons: solid cells drawn with a lit top and a dark front.
    const palette = [0x2f8f9d, 0xd2673a, 0x5b6b86, 0x8e5bd6];
    let k = 0;
    for (const [c0, r0, w, h, kind] of MAP.rects) {
      if (kind !== T.SOLID) continue;
      const color = palette[k++ % palette.length];
      if(grid.propAtCell(grid.index(c0,r0)))continue;
      const x = c0 * cell, y = r0 * cell, width = w * cell, height = h * cell;
      g.rect(x + 6, y + height, width - 6, 14).fill({ color: 0x000000, alpha: 0.35 });
      g.rect(x, y, width, height).fill({ color: mixColor(color, 0x000000, 0.45) });
      g.rect(x + 3, y + 3, width - 6, height - 22).fill({ color });
      for (let sxp = x + 10; sxp < x + width - 6; sxp += 14) g.rect(sxp, y + 6, 4, height - 30).fill({ color: mixColor(color, 0xffffff, 0.25), alpha: 0.6 });
      g.rect(x, y, width, height).stroke({ width: 2, color: 0x0a0f18, alpha: 0.9 });
    }
    for (const [c, r] of MAP.pylons) {
      const x = c * cell, y = r * cell;
      g.rect(x + 8, y + 8, cell - 16, cell - 8).fill({ color: 0x2b3550 }).stroke({ width: 2, color: 0x0a0f18 });
      g.circle(x + cell / 2, y + 16, 10).fill({ color: 0xff3f6c, alpha: 0.9 });
    }
    // Stands: three tiers along the north edge, VIP boxes every 12 cells.
    for (let tier = 0; tier < standRows; tier++) {
      g.rect(0, tier * cell, worldWidth, cell).fill({ color: mixColor(0x1d2236, 0x3a4466, tier / standRows) });
      g.rect(0, tier * cell + cell - 6, worldWidth, 6).fill({ color: 0x0c1020 });
    }
    for (let c = 6; c < grid.cols; c += 12) g.rect(c * cell, cell * 0.2, 3 * cell, cell * (standRows - 1.4)).fill({ color: 0x2b1f44 }).stroke({ width: 3, color: 0xffd34d, alpha: 0.6 });
    g.rect(0, standRows * cell - 8, worldWidth, 8).fill({ color: 0x63e3ff, alpha: 0.55 });
    // Entry gates: arches at the yard edges.
    for (const [c, r] of MAP.gates) {
      g.circle((c + 0.5) * cell, (r + 0.5) * cell, 34).stroke({ width: 5, color: 0xff4fb1, alpha: 0.35 });
    }
    // Beacon pads.
    for (const [c, r] of MAP.beacons) {
      g.circle((c + 0.5) * cell, (r + 0.5) * cell, DATA_ARENA_BEACON.radius).fill({ color: 0x223a3a }).stroke({ width: 3, color: 0x5affc8, alpha: 0.4 });
    }
  }
  function drawStage(g) {
    // Central stage: raised disc with an original concentric data emblem.
    const s = MAP.stage, sx = (s.col + 0.5) * cell, sy = (s.row + 0.5) * cell, sr = s.radius * cell;
    g.ellipse(sx, sy + 18, sr + 6, sr + 2).fill({ color: 0x0b111c });
    g.circle(sx, sy, sr).fill({ color: 0x24324d });
    g.circle(sx, sy, sr).stroke({ width: 6, color: 0x63e3ff, alpha: 0.75 });
    g.circle(sx, sy, sr * 0.72).stroke({ width: 3, color: 0x63e3ff, alpha: 0.35 });
    g.circle(sx, sy, sr * 0.38).fill({ color: 0x1b2740 }).stroke({ width: 4, color: 0xff7ad9, alpha: 0.55 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.moveTo(sx + Math.cos(a) * sr * 0.42, sy + Math.sin(a) * sr * 0.42).lineTo(sx + Math.cos(a) * sr * 0.7, sy + Math.sin(a) * sr * 0.7)
        .stroke({ width: 2, color: 0x63e3ff, alpha: 0.4 });
    }
  }
  function drawBridge() {
    for (const [c0, r0, w, h] of rectsOf(T.BRIDGE)) {
      const x = c0 * cell, y = r0 * cell - 6, width = w * cell, height = h * cell + 12;
      bridge.rect(x - 6, y, width + 12, height).fill({ color: 0x3a4a60 });
      for (let i = 0; i * 30 < height; i++) bridge.rect(x - 6, y + i * 30, width + 12, 4).fill({ color: 0x5c7290 });
      bridge.rect(x - 8, y, 6, height).fill({ color: 0xffd23f });
      bridge.rect(x + width + 2, y, 6, height).fill({ color: 0xffd23f });
    }
  }
  let bridgeLift = -1;

  // ------------------------------------------------------------------ crowd
  const fans = [];
  const hasModeledCrowd=environment?.manifest.kind==='RELAY_BATTLE'||environment?.manifest.kind==='TOURNAMENT_STONE'||Boolean(environment?.manifest.crowdFrames);
  const fanCount = Math.round((rich ? 260 : 120) * Math.min(1, worldWidth / 3840 + 0.25) * (standRows / 3));
  for (let i = 0; !hasModeledCrowd&&i < fanCount; i++) {
    const tier = i % Math.max(1, standRows), x = ((i * 7919) % 1000) / 1000 * (worldWidth - 40) + 20;
    const sprite = new PIXI.Sprite(textures.fans[i % 4]);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(1.6 + tier * 0.15);
    const baseY = tier * cell + cell - 8;
    sprite.position.set(x, baseY);
    sprite.tint = 0xffffff;
    objects.addChild(sprite);
    sprite.zIndex = baseY - 400;
    fans.push({ sprite, x, baseY, phase: (i * 2.399) % TAU });
  }
  const standLights = [];
  for (let i = 0; !hasModeledCrowd&&i < 10; i++) {
    const cone = new PIXI.Sprite(textures.lightCone);
    cone.anchor.set(0.5, 0);
    cone.blendMode = "add";
    cone.alpha = 0.12;
    cone.position.set((i + 0.5) * worldWidth / 10, Math.max(1, standRows - 1) * cell);
    cone.scale.set(2.4, 2.2);
    cone.rotation = (i % 2 ? 1 : -1) * 0.12;
    lights.addChild(cone);
    standLights.push(cone);
  }
  const crowd = { kind: null, t: 0, originX: worldWidth / 2, tint: 0xffffff, strength: 0, mood: 0 };
  function crowdReact(kind, originX = worldWidth / 2, strength = 1) {
    crowd.kind = kind; crowd.t = 0; crowd.originX = originX; crowd.tint = CROWD_TINT[kind] ?? 0xffffff; crowd.strength = strength;
  }
  function updateCrowd(dt) {
    crowd.t += dt;
    const active = crowd.kind && crowd.t < (crowd.kind === "VICTORY" ? 9 : 2.4);
    const envelope = active ? Math.max(0, 1 - crowd.t / (crowd.kind === "VICTORY" ? 9 : 2.4)) : 0;
    const visibleTop = view ? view.centerY - view.halfH - 40 : 0;
    const standsVisible = visibleTop < standRows * cell;
    for (const fan of fans) {
      const sprite = fan.sprite;
      if (!standsVisible) { sprite.visible = false; continue; }
      sprite.visible = !view || (fan.x > view.centerX - view.halfW - 30 && fan.x < view.centerX + view.halfW + 30);
      if (!sprite.visible) continue;
      let y = fan.baseY + Math.sin(elapsed * 2.1 + fan.phase) * (reducedMotion ? 0 : 1.2);
      if (active && !reducedMotion) {
        const delay = Math.abs(fan.x - crowd.originX) / 1600;
        const local = crowd.t - delay;
        if (local > 0) {
          const jump = crowd.kind === "DEFEAT" ? -4 : Math.abs(Math.sin(local * (crowd.kind === "PERFECT_DODGE" ? 12 : 8) + fan.phase)) * 9 * crowd.strength;
          y -= jump * envelope;
        }
      }
      sprite.y = y;
      sprite.tint = active && crowd.t - Math.abs(fan.x - crowd.originX) / 1600 > 0 ? mixColor(0xffffff, crowd.tint, 0.55 * envelope) : (crowd.kind === "DEFEAT" ? 0x8090a8 : 0xffffff);
    }
    for (let i = 0; i < standLights.length; i++) {
      const cone = standLights[i];
      const pulse = active ? 0.18 + 0.32 * envelope * (0.6 + 0.4 * Math.sin(elapsed * 9 + i)) : 0.1 + 0.04 * Math.sin(elapsed * 0.8 + i);
      cone.alpha = rich ? pulse : pulse * 0.6;
      cone.tint = active ? crowd.tint : 0xbfe6ff;
      if (!reducedMotion) cone.rotation = (i % 2 ? 1 : -1) * (0.12 + (active ? 0.18 * Math.sin(elapsed * 3 + i) * envelope : 0.04 * Math.sin(elapsed * 0.5 + i)));
    }
  }

  // ------------------------------------------------------------------ actors
  const actionEvents = new Map();
  function createActorView(role, member, body) {
    const container = new PIXI.Container({ label: `arena ${role}` });
    const shadow = new PIXI.Sprite(textures.shadow);
    shadow.anchor.set(0.5); shadow.alpha = 0.8;
    const bundle = member?.art ? bundles.get(member.speciesId) : null;
    let sprite, controller = null, scale = 1, sequence = null, reviewedArena=null, nativeScale = 1, partial = false, onReviewed = false, reviewedSample = null;
    if (bundle) {
      const actor = bundle.createActor({ side: "main", animation: DATA_ARENA_SEQUENCES.STAND, reducedMotion: false });
      sprite = actor.sprite; controller = actor.controller;
      reviewedArena=actor.reviewedArena??null;
      // A partial reviewed Arena set (QA handoff of a few accepted directions) keeps the native
      // body for everything it does not cover, and draws its own frames at the native world size.
      partial = reviewedArena?.partial === true;
      const height = sprite.texture.frame?.height || sprite.texture.height || 64;
      nativeScale = ROLE_HEIGHT[role] / height;
      scale = reviewedArena && !partial ? ROLE_HEIGHT[role]/64/4 : nativeScale;
      sequence = DATA_ARENA_SEQUENCES.STAND;
    } else {
      sprite = new PIXI.Sprite(textures.fallback[role]);
      sprite.anchor.set(0.5, 0.9);
      scale = ROLE_HEIGHT[role] / 96;
    }
    sprite.scale.set(scale);
    const actorPartnerId = member?.partnerId ?? RELAY_ROSTER.find(p => p.speciesId === member?.speciesId)?.id;
    const relayProfile = RELAY_ACTION_PROFILES[actorPartnerId];
    let attackAnimation = bundle?.runtime.sides.main.animations.find(a => a.id === DATA_ARENA_SEQUENCES.ATTACK);
    let currentPlacement = null;
    const action = createDataArenaCharacterAction({
      animation: bundle?.runtime.sides.main.animations.find(a => a.id === DATA_ARENA_SEQUENCES.ATTACK),
      tickRateHz: bundle?.runtime.timing?.tickRateHz ?? 60, reducedMotion
    });
    let actionRequest = null, actionElapsed = 0, motion = null;
    shadow.scale.set((ROLE_HEIGHT[role] / 64) * 0.9, (ROLE_HEIGHT[role] / 64) * 0.75);
    container.addChild(shadow, sprite);
    // A slim follow bar under a rival's feet; its named bar lives in the HUD strip (Owner 2026-11-02).
    const healthGfx = role === "PLAYER" || role === "MATE" ? null : new PIXI.Graphics();
    if (healthGfx) container.addChild(healthGfx);
    let healthShown = -1;
    objects.addChild(container);
    const ringGfx = role === "PLAYER" ? new PIXI.Graphics() : null;
    if (ringGfx) container.addChildAt(ringGfx, 1);
    return {
      role, container, sprite, shadow, ringGfx, scale, controller, hasArt: Boolean(bundle),
      resetAction(){action.clear();reviewedArena?.reset();actionRequest=null;},
      setHealth(share) {
        if (!healthGfx) return;
        const shown = Math.round(Math.max(0, Math.min(1, share)) * 40) / 40;
        if (shown === healthShown) return;
        healthShown = shown;
        healthGfx.clear();
        if (shown > 0) healthGfx.rect(-25, 10, 50, 7).fill({ color: 0x05060d, alpha: 0.78 }).rect(-24, 11, 48 * shown, 5).fill(0xff4a6a);
      },
      // Where this body's move is drawn leaving it; null keeps the default hand offset.
      releasePoint(angle,event=null){
        if(!reviewedArena)return null;
        const source=reviewedArena.castAttachment?.(event);
        if(source?.geometry){
          const g=source.geometry,scale=reviewedArenaGeometryScale(g,ROLE_HEIGHT[role],{partial,nativeScale});
          return reviewedReleasePoint({x:container.position.x,y:container.position.y,angle,roleHeight:ROLE_HEIGHT[role],
            release:source.release,scaleX:scale*(source.mirrorX?-1:1),scaleY:scale,groundShift:g.groundShift??0,density:g.scale});
        }
        if(partial&&!onReviewed)return null;
        const g=motion?.geometry;
        return reviewedReleasePoint({x:container.position.x+sprite.x,y:container.position.y+sprite.y,angle,roleHeight:ROLE_HEIGHT[role],
          release:motion?.release,scaleX:sprite.scale.x,scaleY:sprite.scale.y,groundShift:g?.groundShift??0,density:g?.scale??1});
      },
      setSequence(id, request = null) {
        if (!controller || (sequence === id && actionRequest === request)) return;
        try { controller.setAnimation(id); sequence = id; actionRequest = request; actionElapsed = 0; } catch { /* a missing raw sequence keeps the current pose */ }
      },
      update(dtMs, { x, y, facing, flash = 0, alpha = 1, lift = 0, seq = DATA_ARENA_SEQUENCES.STAND, sink = 0 }) {
        container.position.set(x, y - floorOffset(x,y));
        container.zIndex = y;
        // Relay hit-stop: hold the drawn frame and pose; the simulation keeps stepping.
        if (hitStop > 0) { sprite.tint = flash > 0.14 ? 0xffffff : flash > 0 ? 0xff7a7a : 0xffffff; return; }
        const event = actionEvents.get(body.id);
        if (body.hp <= 0) { action.clear(); actionEvents.delete(body.id); }
        else if (event && (event.type === 'CAST_RELEASE' || body.cast?.actionId === event.actionId)) action.observe(event);
        else if (event) { action.clear(); actionEvents.delete(body.id); }
        else action.clear();
        if(state.gameMode === 'RELAY')attackAnimation=bundle?.runtime.sides.main.animations.find(a=>a.id===relaySequence(actorPartnerId,body.action?.moveId));
        motion = [DATA_ARENA_SEQUENCES.HIT, DATA_ARENA_SEQUENCES.DOWN, DATA_ARENA_SEQUENCES.WIN].includes(seq) ? null
          : state.gameMode === 'RELAY' ? sampleDataArenaRelayAction({ animation: attackAnimation, action: body.action, time: state.time,
              tickRateHz: bundle?.runtime.timing?.tickRateHz ?? 60, releaseSlot: relayProfile?.releaseSlot ?? 1, reducedMotion }) : action.sample(state.time);
        this.setSequence(motion?.sequenceId ?? seq, motion?.id ?? null);
        let nativeDraw = !reviewedArena;
        if(reviewedArena){
          if(event)reviewedArena.observe(event);
          const vx=body.vx??0,vy=body.vy??0;
          const sample=reviewedArena.sample({time:state.time,hp:seq===DATA_ARENA_SEQUENCES.DOWN?0:body.hp,
            vx,vy,facing,hit:seq===DATA_ARENA_SEQUENCES.HIT,
              attack:seq===DATA_ARENA_SEQUENCES.ATTACK,castId:body.cast?.actionId??null,sourceCastId:body.action?.id??null,angle:body.cast?.angle??null,
            moveRate:reviewedMoveRate(vx,vy),victory:seq===DATA_ARENA_SEQUENCES.WIN});
          reviewedSample=sample;
          if(partial&&!sample?.geometry){
            // Not covered by the partial set (missing clip or a native fallback): the native sequence, restarted cleanly.
            nativeDraw=true; scale=nativeScale;
            if(onReviewed){onReviewed=false;controller.resumeNative?.();sequence=null;this.setSequence(motion?.sequenceId ?? seq, motion?.id ?? null);}
          } else if(partial){
            // Covered: the reviewed frame at the native world size (native cells are density 4).
            onReviewed=true; motion=sample;
            scale=reviewedArenaGeometryScale(sample.geometry,ROLE_HEIGHT[role],{partial,nativeScale});
            sprite.scale.set(scale*(sample.mirrorX?-1:1),scale*(1-sink*.5));
          } else {
          motion=sample;
            scale=applyReviewedArenaPoseScale(sprite,sample,ROLE_HEIGHT[role],sink);
          // A standing body breathes on its held first walk frame (phase spread per body).
          if(!reducedMotion&&sample?.action==='move'&&Math.hypot(vx,vy)<2)sprite.scale.y*=reviewedIdleBreath(elapsed,(body.id??0)*0.37);
          }
        }
        if (nativeDraw && controller && motion) {
          const deltaMS = Math.max(0, motion.elapsedMs - actionElapsed);
          if (deltaMS > 0) controller.update({ deltaMS });
          actionElapsed = motion.elapsedMs;
        } else if (nativeDraw && controller && dtMs > 0) controller.update({ deltaMS: dtMs });
        // Art faces left; mirror for rightward facing.
        const snapshot=controller?.getSnapshot();
        const frame=bundle?.runtime.sides.main.animations.find(a=>a.id===sequence)?.frames[snapshot?.sourceFrameIndex ?? 0];
        // Reviewed artwork keeps its own canvas and pivot; relay slot packing applies to native cells only.
        currentPlacement=nativeDraw&&state.gameMode==='RELAY'&&bundle ? dataArenaRelaySlotPlacement(frame,bundle.runtime.geometry,bundle.runtime.artProfile) : null;
        if(currentPlacement)sprite.anchor.set(currentPlacement.anchor.x,currentPlacement.anchor.y);
        const cellScale=currentPlacement ? scale*(bundle.runtime.artProfile?.scale??1)/currentPlacement.packingScale : scale;
        if(nativeDraw)sprite.scale.set(cellScale * (facing > 0 ? -1 : 1), cellScale * (1 - sink * 0.5));
        sprite.y = -lift + sink * 30;
        sprite.x = 0;
        if(!nativeDraw&&seq===DATA_ARENA_SEQUENCES.WIN&&!reducedMotion)sprite.y-=reviewedWinHop(elapsed);
        if(currentPlacement){sprite.x+=(facing>0?-1:1)*currentPlacement.offset[0]*cellScale;sprite.y+=currentPlacement.offset[1]*cellScale;}
        // Stage four: a staggered fighter shudders for its hitstun.
        if (body.hitstun > 0 && !reducedMotion) sprite.x += Math.sin(elapsed * 90) * 2.5;
        if (Math.hypot(body.kbx ?? 0, body.kby ?? 0) > 80 && !reducedMotion && frameCount % 2 === 0) puff(x, y, 0xc8b89a, 1, 0.7);
        if (motion && relayProfile && !reducedMotion && !motion.preserveAuthoredPose) {
          const a = body.action;
          // No action in progress means no lunge; a null action used to throw here and stop the HUD.
          const pulse = !a ? 0 : a.releasedAt === null ? Math.min(1, (state.time - a.startedAt) / a.windup) : Math.max(0, 1 - (state.time - a.releasedAt) / a.recovery);
          sprite.x += (facing > 0 ? 1 : -1) * relayProfile.thrust * pulse;
          sprite.y -= relayProfile.lift * pulse;
          if (a && a.releasedAt === null) { sprite.scale.x *= 1 - 0.07 * pulse; sprite.scale.y *= 1 + 0.08 * pulse; }
          else if (a && state.time - a.releasedAt < 0.12) { sprite.scale.x *= 1.12; sprite.scale.y *= 0.89; }
        }
        if (flash > 0.1 && !reducedMotion && !motion?.preserveAuthoredPose) { sprite.scale.x *= 1.1; sprite.scale.y *= 0.9; }
        sprite.alpha = alpha;
        sprite.tint = flash > 0.14 ? 0xffffff : flash > 0 ? 0xff7a7a : 0xffffff;
        shadow.alpha = (0.75 - sink * 0.6) * (lift > 0 ? 0.6 : 1);
      },
      diagnostics: () => ({ sequenceId: sequence, frameIndex: controller?.getSnapshot().sourceFrameIndex ?? null,
        speciesId: member?.speciesId, facing8: body.facing8 ?? null, slotPreserved: Boolean(currentPlacement), anchor: currentPlacement?.anchor ?? null, actionId: motion?.actionId??motion?.id ?? null, phase: motion?.phase ?? null, moveId: motion?.moveId ?? null,
        reviewed:reviewedArena?{clipId:reviewedSample?.clipId??motion?.clipId,direction:reviewedSample?.direction??motion?.direction,assetId:reviewedSample?.assetId??motion?.assetId,terminal:(reviewedSample??motion)?.terminal??false,missing:reviewedSample?.missing??null,partial,native:partial&&!onReviewed}:null })
    };
  }
  const playerMember = cast.partners.find((member) => member.partnerId === partnerId) ?? cast.partners[0];
  let playerView = createActorView("PLAYER", playerMember, state.player);
  function casterView(id) {
    if (id === state.player.id) return playerView;
    if (id === state.mate?.id) return mateView;
    if (bossView && id === state.boss?.id) return bossView;
    return rivalViews.get(id) ?? null;
  }
  // Release point of a cast: a reviewed body's mouth or hand, else the default hand offset.
  const releaseOrigins = new Map();
  function releaseAt(event) {
    const point = casterView(event.casterId)?.releasePoint(event.angle,event);
    return point ? { ...point, reviewed: true }
      : { x: event.x + Math.cos(event.angle) * 26, y: event.y - BEAM_ELEVATION + Math.sin(event.angle) * 26, reviewed: false };
  }
  const playerViews = new Map([[playerMember.partnerId, playerView]]);
  const mateView = createActorView("MATE", cast.mate, state.mate);
  let bossView = null;
  const rivalViews = new Map();
  function statusTint(body, base) {
    if (body.root > 0) return 0xc8f4ff;
    if (body.slow > 0) return mixColor(base, 0x7fc8ff, 0.45);
    if (body.burn > 0 && Math.floor(elapsed * 12) % 2 === 0) return mixColor(base, 0xff8a3c, 0.5);
    return base;
  }

  // Enemy and object pools.
  const enemyViews = new Map(), enemyPool = [];
  function enemyView(enemy) {
    let entry = enemyViews.get(enemy.id);
    if (entry) return entry;
    const pooled = enemyPool.pop();
    if (pooled) { entry = pooled; entry.sprite.texture = textures[enemy.kind]; }
    else {
      const container = new PIXI.Container();
      const shadow = new PIXI.Sprite(textures.shadow); shadow.anchor.set(0.5); shadow.scale.set(0.8, 0.6);
      const sprite = new PIXI.Sprite(textures[enemy.kind]); sprite.anchor.set(0.5, 0.92);
      container.addChild(shadow, sprite);
      entry = { container, sprite, shadow };
    }
    entry.kind = enemy.kind;
    entry.seed = (enemy.id * 0.618) % 1;
    entry.container.visible = true;
    objects.addChild(entry.container);
    enemyViews.set(enemy.id, entry);
    return entry;
  }

  const podViews = state.pods.map((pod) => {
    const g = new PIXI.Graphics();
    g.ellipse(0, 0, 22, 10).fill({ color: 0x000000, alpha: 0.35 });
    g.roundRect(-16, -44, 32, 44, 10).fill({ color: 0x9fe8ff }).stroke({ width: 3, color: 0x1b5f80 });
    g.rect(-12, -36, 24, 8).fill({ color: 0xffffff, alpha: 0.75 });
    g.circle(0, -18, 6).fill({ color: 0x2ad8ff });
    g.position.set(pod.x, pod.y);
    objects.addChild(g);
    return g;
  });
  const coreViews = new Map();
  const beaconLights = state.beacons.map((beacon) => {
    const pillar = new PIXI.Sprite(textures.lightCone);
    pillar.anchor.set(0.5, 1); pillar.blendMode = "add"; pillar.alpha = 0; pillar.scale.set(1.6, -1.6);
    pillar.position.set(beacon.x, beacon.y - 300);
    pillar.tint = 0x5affc8;
    lights.addChild(pillar);
    return pillar;
  });

  // Shots.
  const shotViews = new Map(), shotPool = [];
  const SHOT_TEXTURE = { EMBER: "emberShot", ORB: "orb", SHARD: "shardShot", TIDE: "tide", RBOLT: "tide", WAVE: "wave", PBOLT: "bolt" };
  const SHOT_TINT = { EMBER: 0xff8a2a, ORB: 0xff5cd6, SHARD: 0x9a6bff, TIDE: 0x6fe8ff, RBOLT: 0x4fb8ff, WAVE: 0x7fe9ff, PBOLT: 0xffffff };
  const MOVE_TINT = { emberBolt: 0xff9a3c, sunSpear: 0xffe066, scatterLight: 0xfff0a0, iceShard: 0xbff0ff, dawnLance: 0xfff6c8 };
  function shotView(projectile) {
    let entry = shotViews.get(projectile.id);
    if (entry) return entry;
    entry = shotPool.pop();
    if (!entry) {
      const sprite = new PIXI.Sprite(textures.emberShot); sprite.anchor.set(0.5);
      const glow = new PIXI.Sprite(textures.glow); glow.anchor.set(0.5); glow.blendMode = "add";
      const shadow = new PIXI.Sprite(textures.shadow); shadow.anchor.set(0.5); shadow.scale.set(0.35, 0.3);
      entry = { sprite, glow, shadow };
    }
    const relayStyle = state.gameMode === 'RELAY' && projectile.moveId ? relayLook(projectile.moveId, projectile.owner) : null;
    // A broad water move keeps the harbour wave; a water shot is a droplet.
    const relayTexture = relayStyle?.style === 'water' && projectile.radius >= 28 ? 'wave' : relayStyle?.texture;
    entry.sprite.texture = textures[relayTexture ?? SHOT_TEXTURE[projectile.kind] ?? "tide"] ?? textures.relayCrystal;
    // The texture's core is drawn at the collision radius (wave: its half height).
    const coreRadius = relayStyle ? 18 : projectile.kind === "SHARD" ? 13 : projectile.kind === "ORB" ? 10 : projectile.kind === "WAVE" ? 22 : 9;
    entry.sprite.scale.set(projectile.radius / coreRadius);
    entry.sprite.blendMode = relayStyle || projectile.kind === "PBOLT" || projectile.kind === "EMBER" || projectile.kind === "TIDE" ? "add" : "normal";
    entry.sprite.anchor.set(!relayStyle && projectile.kind === "PBOLT" ? 32 / 48 : 0.5, 0.5);
    entry.sprite.tint = relayStyle?.tint ?? (projectile.kind === "PBOLT" ? MOVE_TINT[projectile.moveId] ?? 0xffffff : 0xffffff);
    entry.glow.tint = relayStyle?.tint ?? (projectile.kind === "PBOLT" ? MOVE_TINT[projectile.moveId] ?? 0xffffff : SHOT_TINT[projectile.kind] ?? 0xffffff);
    entry.glow.scale.set((projectile.radius * 4.2) / 64);
    entry.glow.visible = rich;
    entry.sprite.visible = entry.glow.visible = true;
    entry.glow.visible = rich;
    shots.addChild(entry.sprite); shotGlow.addChild(entry.glow); shotGlow.addChildAt(entry.shadow, 0);
    entry.origin = releaseOrigins.get(projectile.actionId) ?? null; entry.from = null;
    if (state.gameMode === 'RELAY' && projectile.moveId && elementFx?.projectile) {
      const ownerSpecies = projectile.owner === 'player' ? state.player.speciesId
        : (state.rivals.find(r => r.active && r.hp > 0) ?? state.rivals[0])?.speciesId ?? null;
      entry.kitDrawn = elementFx.projectile({
        follow: () => (!projectile.dead && state.projectiles.includes(projectile) ? { x: projectile.x, y: projectile.y - 12, angle: Math.atan2(projectile.vy, projectile.vx) } : null),
        moveId: projectile.moveId,
        speciesId: ownerSpecies,
        angle: Math.atan2(projectile.vy, projectile.vx),
        size: Math.max(20, projectile.radius * 2.2),
      }) === true;
      // The kit draws this shot's head and trail; the vector head and its glow stand down.
      if (entry.kitDrawn) entry.sprite.visible = entry.glow.visible = false;
    }
    shotViews.set(projectile.id, entry);
    return entry;
  }

  // Laser and scan beams.
  const beam = { glow: new PIXI.Sprite(textures.beamGlow), core: new PIXI.Sprite(textures.beamCore),
    muzzle: new PIXI.Sprite(textures.glow), impact: new PIXI.Sprite(textures.glow) };
  for (const part of Object.values(beam)) { part.blendMode = "add"; part.visible = false; beams.addChild(part); }
  beam.glow.anchor.set(0, 0.5); beam.core.anchor.set(0, 0.5); beam.muzzle.anchor.set(0.5); beam.impact.anchor.set(0.5);
  const scanBeams = [0, 1].map(() => {
    const glow = new PIXI.Sprite(textures.beamGlow), core = new PIXI.Sprite(textures.beamCore);
    for (const part of [glow, core]) { part.anchor.set(0, 0.5); part.blendMode = "add"; part.visible = false; beams.addChild(part); }
    glow.tint = 0xff2f5a; core.tint = 0xffd0da;
    return { glow, core };
  });
  const waves = [];

  // Cell effects keyed by grid cell.
  const fireSprites = new Map(), iceSprites = new Map(), decalSprites = new Map();
  const smokeAt=new Float32Array(grid.count);
  const cellPool = [];
  function acquireCellSprite(texture, blend = "normal") {
    const sprite = cellPool.pop() ?? new PIXI.Sprite(texture);
    sprite.texture = texture; sprite.blendMode = blend; sprite.visible = true; sprite.alpha = 1; sprite.tint = 0xffffff;
    sprite.anchor.set(0.5); sprite.rotation = 0; sprite.scale.set(1);
    cellFx.addChild(sprite);
    return sprite;
  }
  function releaseCellSprite(sprite) { sprite.visible = false; sprite.parent?.removeChild(sprite); cellPool.push(sprite); }
  function syncCells() {
    for (let i = 0; i < grid.count; i++) {
      const burning = grid.fire[i] > 0;
      let flame = fireSprites.get(i);
      if (burning && !flame) {
        flame = acquireCellSprite(textures.flame[i % 2], "add");
        flame.anchor.set(0.5, 0.95);
        flame.position.set((i % grid.cols + 0.5) * cell, (Math.floor(i / grid.cols) + 0.85) * cell);
        fireSprites.set(i, flame);
      } else if (!burning && flame) { releaseCellSprite(flame); fireSprites.delete(i); }
      const frozen = grid.ice[i] > 0;
      let ice = iceSprites.get(i);
      if (frozen && !ice) {
        ice = acquireCellSprite(textures.ice);
        if(interactionArt){ice.anchor.set(...interactionArt.manifest.ice.anchor);ice.width=interactionArt.manifest.ice.worldSize[0];ice.height=interactionArt.manifest.ice.worldSize[1];}
        ice.position.set((i % grid.cols + 0.5) * cell, (Math.floor(i / grid.cols) + 0.5) * cell);
        if(environment?.manifest.projection?.waterSurfaceOffset)ice.y-=environment.manifest.projection.waterSurfaceOffset;
        iceSprites.set(i, ice);
      } else if (!frozen && ice) { releaseCellSprite(ice); iceSprites.delete(i); }
      if (ice) {
        const cracking = grid.ice[i] <= DATA_ARENA_GRID_RULES.iceWarnSeconds;
        ice.texture = cracking ? textures.iceCracked : textures.ice;
        ice.tint = cracking ? 0xbfe8ff : 0xffffff;
        ice.alpha = 1;
      }
      const decal = grid.scorch[i]>0 ? (grid.wet[i]>0?"scorchWet":"ash") : grid.wet[i] > 0 ? "wet" : null;
      const existing = decalSprites.get(i);
      if (decal && (!existing || existing.kind !== decal)) {
        if (existing) releaseCellSprite(existing.sprite);
        const sprite = acquireCellSprite(textures[decal]);
        sprite.position.set((i % grid.cols + 0.5) * cell, (Math.floor(i / grid.cols) + 0.5) * cell);
        cellFx.setChildIndex(sprite, 0);
        decalSprites.set(i, { kind: decal, sprite });
      } else if (!decal && existing) { releaseCellSprite(existing.sprite); decalSprites.delete(i); }
      const active=decalSprites.get(i);if(active)active.sprite.alpha=grid.scorch[i]>0 ? .35+grid.scorch[i]/255*.5 : .8;
    }
  }

  // ------------------------------------------------------------------ particles
  const cap = PARTICLE_CAP[quality] ?? PARTICLE_CAP.high;
  const live = [], pool = [];
  let particlePeak = 0;
  function spawn({ x, y, vx = 0, vy = 0, life = 0.5, texture = textures.dot, tint = 0xffffff, scale = 1, scaleTo = null, gravity = 0,
    drag = 0, alpha = 1, add = true, rotation = 0, spin = 0, align = false }) {
    if (live.length >= cap) return null;
    if (reducedMotion) {vx=vy=gravity=spin=0;scale=scaleTo??scale;scaleTo=scale;life=Math.min(life,.35);}
    const sprite = pool.pop() ?? new PIXI.Sprite(texture);
    sprite.texture = texture; sprite.anchor.set(0.5); sprite.tint = tint; sprite.alpha = alpha; sprite.blendMode = add ? "add" : "normal";
    sprite.visible = true; sprite.rotation = rotation; sprite.scale.set(scale); sprite.position.set(x, y);
    particles.addChild(sprite);
    live.push({ sprite, x, y, vx, vy, life, age: 0, scale, scaleTo: scaleTo ?? scale, gravity, drag, alpha, spin, align });
    particlePeak = Math.max(particlePeak, live.length);
    return live[live.length - 1];
  }
  function burst(x, y, { count = 8, speed = 220, tint = 0xffffff, life = 0.45, texture = textures.spark, scale = 1.4, gravity = 0, spread = TAU, angle = 0, spin = 0 } = {}) {
    const n = rich ? count : Math.ceil(count / 2);
    for (let i = 0; i < n; i++) {
      const a = angle - spread / 2 + spread * ((i + 0.5) / n) + Math.sin(i * 12.9898 + elapsed) * 0.25;
      const v = speed * (0.55 + 0.45 * Math.abs(Math.sin(i * 78.233 + elapsed * 3)));
      spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.7 + 0.3 * ((i * 0.37) % 1)), texture, tint, scale, scaleTo: scale * 0.2,
        gravity, drag: 2.2, align: texture === textures.spark, spin: spin * (i % 2 ? 1 : -1) });
    }
  }
  function ring(x, y, radius, tint, life = 0.4, alpha = 0.9) {
    spawn({ x, y, texture: textures.ring, tint, scale: 0.1, scaleTo: radius / 58, life, alpha, add: true });
  }
  // Track one of the combat telemetry (Owner 2026-11-02): numbers and short
  // words ride beside the body that earned them, frameless with a hard dark
  // outline. Spawns at one spot within 200 ms step (±14, -18) so none overlap.
  const numbers = [], numberPool = [], wordPool = [];
  const recentSpawns = [];
  const WORD_TONES = Object.freeze({ dodge: 0x9fe8ff, good: 0x8dffb0, warn: 0xffd6a0, chain: 0xffcf8a, crit: 0xffd34d, info: 0xeaf6ff });
  function stackOffset(x, y) {
    while (recentSpawns.length && elapsed - recentSpawns[0].at > 0.2) recentSpawns.shift();
    const near = recentSpawns.filter((spawn) => Math.hypot(spawn.x - x, spawn.y - y) < 56).length;
    recentSpawns.push({ x, y, at: elapsed });
    return near ? { x: (near % 2 ? 14 : -14) * Math.ceil(near / 2), y: -18 * near } : { x: 0, y: 0 };
  }
  function recycle(entry) {
    entry.text.visible = false; (entry.word ? wordPool : numberPool).push(entry.text);
    if (entry.ghost) { entry.ghost.visible = false; wordPool.push(entry.ghost); }
  }
  function makeText(word) {
    const text = new PIXI.Text({ text: "", style: { fontFamily: '"Noto Sans TC","Arial Black",system-ui,sans-serif', fontSize: word ? 22 : 26, fontWeight: "900",
      fontStyle: word ? "italic" : "normal", fill: 0xffffff, stroke: { color: 0x05060d, width: 5, join: "round" },
      dropShadow: { color: 0x000000, alpha: 0.45, blur: 0, distance: 2, angle: Math.PI / 2 } } });
    text.anchor.set(0.5);
    numberLayer.addChild(text);
    return text;
  }
  function damageNumber(x, y, amount, tint) {
    if (!(amount >= 1)) return;
    if (numbers.length >= 10) recycle(numbers.shift());
    const text = numberPool.pop() ?? makeText(false);
    text.text = String(Math.round(amount)); text.style.fill = tint; text.visible = true; text.alpha = 1;
    const offset = stackOffset(x, y), side = offset.x > 0 ? 1 : offset.x < 0 ? -1 : (numbers.length % 2 ? 1 : -1);
    numbers.push({ text, x: x + offset.x, y: y + offset.y, vx: reducedMotion ? 0 : side * 46, vy: reducedMotion ? -30 : -270, age: 0, life: 0.8, gravity: 720 });
  }
  /** A short word beside a body: a dodge is an icy italic with one trailing afterimage, gone in 450 ms. */
  function floatText(x, y, message, tone = "info") {
    if (!message) return;
    if (numbers.length >= 10) recycle(numbers.shift());
    const dodge = tone === "dodge";
    const text = wordPool.pop() ?? makeText(true);
    text.text = message; text.style.fill = WORD_TONES[tone] ?? WORD_TONES.info; text.visible = true; text.alpha = 1;
    let ghost = null;
    if (dodge && !reducedMotion) { ghost = wordPool.pop() ?? makeText(true); ghost.text = message; ghost.style.fill = WORD_TONES.dodge; ghost.visible = true; ghost.alpha = 0.35; }
    const offset = stackOffset(x, y);
    // Rises 24 px (dodge) or 30 px on a shallow arc, then fades.
    const life = dodge ? 0.45 : 0.75, rise = dodge ? 24 : 30;
    numbers.push({ text, ghost, word: true, x: x + offset.x + (dodge ? 18 : 0), y: y + offset.y, vx: reducedMotion ? 0 : (dodge ? 30 : 0),
      vy: reducedMotion ? -rise / life : -2 * rise / life, gravity: reducedMotion ? 0 : 2 * rise / (life * life), age: 0, life });
  }
  function updateNumbers(dt) {
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.age += dt;
      if (n.age >= n.life) { recycle(n); numbers.splice(i, 1); continue; }
      if (!reducedMotion) n.vy += n.gravity * dt;
      n.x += n.vx * dt; n.y += n.vy * dt;
      const t = n.age / n.life;
      n.text.position.set(n.x, n.y);
      n.text.scale.set(reducedMotion ? 1 : n.age < 0.1 ? (n.word ? 1.3 - 3 * n.age : 1.7 - 7 * n.age) : 1);
      n.text.alpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      if (n.ghost) { n.ghost.position.set(n.x - n.vx * 0.06, n.y - n.vy * 0.06); n.ghost.scale.copyFrom(n.text.scale); n.ghost.alpha = n.text.alpha * 0.35; }
    }
  }
  /** A contact: a saturated halo under a white-hot core (additive). */
  function contact(x, y, tint) {
    spawn({ x, y, texture: textures.glow, tint, scale: 0.9, scaleTo: 0.25, life: 0.16, alpha: 0.8 });
    spawn({ x, y, texture: textures.glow, tint: 0xffffff, scale: 0.4, scaleTo: 0.1, life: 0.12 });
  }
  function puff(x, y, tint, count = 4, size = 1.2) {
    for (let i = 0; i < (rich ? count : 2); i++) {
      spawn({ x: x + (i - count / 2) * 6, y, vx: (i - count / 2) * 18, vy: -50 - i * 10, texture: textures.soft, tint, scale: size * 0.5, scaleTo: size,
        life: 0.7, alpha: 0.55, add: false, drag: 1.5 });
    }
  }
  function updateParticles(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false; particles.removeChild(p.sprite); pool.push(p.sprite);
        live[i] = live[live.length - 1]; live.pop();
        continue;
      }
      const t = p.age / p.life;
      p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set(p.scale + (p.scaleTo - p.scale) * t);
      p.sprite.alpha = p.alpha * (1 - t * t);
      if (p.align) p.sprite.rotation = Math.atan2(p.vy, p.vx);
      else if (p.spin) p.sprite.rotation += p.spin * dt;
    }
  }
  const ghosts = [];
  function afterimage(x, y, facing) {
    if(reducedMotion)return;
    if (!rich || ghosts.length > 8) return;
    const sprite = new PIXI.Sprite(playerView.sprite.texture);
    sprite.anchor.copyFrom(playerView.sprite.anchor);
      sprite.scale.copyFrom(playerView.sprite.scale);
    sprite.position.set(x, y); sprite.tint = 0x6ff7ff; sprite.alpha = 0.5; sprite.blendMode = "add";
    particles.addChild(sprite);
    ghosts.push({ sprite, life: 0.28, age: 0 });
  }

  // ------------------------------------------------------------------ relay looks (stage two, 2026-10-28)
  // Drawing only: hit-stop holds the fighters' drawn frames while the
  // simulation keeps stepping; charge orbs and impact bursts read events.
  const relayMode = state.gameMode === 'RELAY';
  const relayElementOf = (team) => team === 'player' ? relayPartner(state.player.formPartnerId ?? state.player.partnerId)?.element ?? null
    : RELAY_ROSTER.find(p => p.speciesId === (state.rivals.find(r => r.active && r.hp > 0) ?? state.rivals[0])?.speciesId)?.element ?? null;
  const relayLook = (moveId, team) => relayEffectStyle(moveId, relayElementOf(team === 'player' ? 'player' : 'rival'));
  const IMPACTS = {
    star: { count: 7, speed: 240, texture: 'spark' }, leaf: { count: 6, speed: 200, texture: 'relayLeaf', scale: 0.32, spin: 6 },
    puff: { count: 6, speed: 120, texture: 'glow', scale: 0.4 }, blast: { count: 12, speed: 320, texture: 'spark', ring: 54 },
    spark: { count: 8, speed: 300, texture: 'spark' }, ember: { count: 8, speed: 200, texture: 'spark', gravity: -160 },
    drop: { count: 8, speed: 220, texture: 'dot', gravity: 520 }, shard: { count: 7, speed: 260, texture: 'shard', gravity: 380 },
    rock: { count: 7, speed: 230, texture: 'relayRock', scale: 0.22, gravity: 560, spin: 5 }, ring: { count: 0, ring: 44 }
  };
  function relayImpact(x, y, fx) {
    const recipe = IMPACTS[fx.impact] ?? IMPACTS.star;
    if (recipe.count) burst(x, y, { count: recipe.count, speed: recipe.speed, tint: fx.tint, spin: recipe.spin ?? 0,
      texture: textures[recipe.texture] ?? textures.spark, scale: recipe.scale ?? 1.4, gravity: recipe.gravity ?? 0, life: 0.4 });
    if (recipe.ring) ring(x, y, recipe.ring, fx.tint, 0.3);
  }
  // Stage three: cover debris in the block's material and the timed arena zones.
  const COVER_CHIP = { STONE: 0xb7bec2, WOOD: 0xb07b48, BASALT: 0x5a4a4f, CORAL: 0xf2c7b8, ICE: 0xd6f3fb, SANDSTONE: 0xe0c08a, CRYSTAL: 0x8ff3ff, METAL: 0x9aa8b6 };
  const ZONE_TINT = { ECHO: 0xc79bff, BLOOM: 0x8be37a, VENT: 0xff8a3c, TIDE: 0x6fd8ff, UPDRAFT: 0xd8f0ff, RECHARGE: 0xffe066 };
  function relayCoverHit(event, broken) {
    const tint = COVER_CHIP[event.material] ?? 0xffffff;
    burst(event.x, event.y - 22, { count: broken ? 16 : event.weak ? 8 : 4, speed: broken ? 240 : 140, tint, texture: textures.relayRock ?? textures.shard,
      scale: broken ? 0.3 : 0.2, gravity: 520, life: broken ? 0.8 : 0.45, spin: 6 });
    if (event.weak) ring(event.x, event.y - 20, 40, 0xffe066, 0.25);
    if (broken) { puff(event.x, event.y - 10, tint, 4, 1.4); camera.addTrauma(0.32); }
    else camera.addTrauma(event.weak ? 0.12 : 0.05);
  }
  // An arc that starts its own path: Graphics.arc() alone joins its first point to the
  // previous one (or the world origin), which drew long lines across the field (Owner 2026-11-05).
  const arcPath = (gfx, x, y, r, a0, a1) => gfx.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r).arc(x, y, r, a0, a1);
  const zoneGfx = new PIXI.Graphics(); zoneGfx.label = "arena relay zones"; zoneGfx.blendMode = "add";
  cellFx.addChild(zoneGfx);
  function drawArenaZones() {
    const arena = state.relay?.arena;
    zoneGfx.clear();
    if (!arena) return;
    if (arena.kind && arena.phase !== 'DORMANT') {
      const tint = ZONE_TINT[arena.kind] ?? 0xffffff, active = arena.phase === 'ACTIVE';
      const pulse = reducedMotion ? 0.7 : 0.55 + 0.35 * Math.sin(elapsed * (active ? 5 : 9));
      for (const zone of arena.zones) {
        if (active) {
          zoneGfx.circle(zone.x, zone.y, zone.radius).fill({ color: tint, alpha: 0.14 + 0.08 * pulse });
          zoneGfx.circle(zone.x, zone.y, zone.radius * 0.72).stroke({ color: 0xffffff, width: 1.8, alpha: 0.45 * pulse });
        }
        zoneGfx.circle(zone.x, zone.y, zone.radius).stroke({ color: tint, width: active ? 3.5 : 2, alpha: active ? 0.88 : pulse });
        for (let i = 0; i < 6; i++) {
          const a0 = elapsed * (active ? 1.4 : 0.7) + (i * TAU) / 6;
          arcPath(zoneGfx, zone.x, zone.y, zone.radius - 6, a0, a0 + 0.28).stroke({ color: 0xffffff, width: 2.5, alpha: active ? 0.75 : 0.4 });
        }
        if (!active) zoneGfx.circle(zone.x, zone.y, zone.radius * (1 - (arena.remaining % 1))).stroke({ color: tint, width: 1.5, alpha: 0.5 });
      }
      const channel = arena.channel?.[0] ?? 0;
      if (active && channel > 0) {
        const zone = arena.zones.find(z => Math.hypot(state.player.x - z.x, state.player.y - z.y) <= z.radius);
        if (zone) arcPath(zoneGfx, zone.x, zone.y, zone.radius + 8, -Math.PI / 2, -Math.PI / 2 + TAU * channel / 0.7).stroke({ color: 0xffffff, width: 4, alpha: 0.9 });
      }
      if (active && !reducedMotion && rich && Math.floor(elapsed * 8) !== Math.floor((elapsed - 1 / 60) * 8))
        for (const zone of arena.zones) spawn({ x: zone.x + (Math.random() - 0.5) * zone.radius, y: zone.y + (Math.random() - 0.3) * zone.radius * 0.6, vy: -50, texture: textures.glow, tint, scale: 0.18, scaleTo: 0.05, life: 0.6, alpha: 0.7 });
    }
    const sc = arena.superCore;
    if (sc && sc.phase !== 'DORMANT') {
      const active = sc.phase === 'ACTIVE';
      const pulse = reducedMotion ? 0.8 : 0.6 + 0.35 * Math.sin(elapsed * 7);
      zoneGfx.circle(sc.x, sc.y, sc.radius).fill({ color: 0xffe066, alpha: active ? 0.18 + 0.08 * pulse : 0.08 });
      zoneGfx.circle(sc.x, sc.y, sc.radius).stroke({ color: 0xffe066, width: active ? 4 : 2.5, alpha: active ? 0.95 : 0.65 });
      zoneGfx.circle(sc.x, sc.y, sc.radius * 0.66).stroke({ color: 0x6ff7ff, width: 2.5, alpha: 0.8 * pulse });
      for (let i = 0; i < 8; i++) {
        const a0 = -elapsed * 1.8 + (i * TAU) / 8;
        arcPath(zoneGfx, sc.x, sc.y, sc.radius - 7, a0, a0 + 0.25).stroke({ color: 0xffffff, width: 3, alpha: 0.85 });
      }
      if ((sc.channel?.[0] ?? 0) > 0) {
        arcPath(zoneGfx, sc.x, sc.y, sc.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (sc.channel[0] / 0.65)).stroke({ color: 0xffffff, width: 5, alpha: 0.95 });
      }
    }
  }
  let hitStop = 0, statusTick = 0;
  // Heavy hits hold the drawn fighters 55 ms in every mode (Owner 2026-11-01); the simulation keeps stepping.
  const heavyHit = (amount) => { if (!reducedMotion && amount >= 22) hitStop = Math.max(hitStop, relayMode && amount >= 40 ? 0.08 : 0.055); };
  const casterSpecies = (event) => event.team === 'player' || event.casterId === state.player.id ? state.player.speciesId
    : (state.rivals ?? []).find(r => r.id === event.casterId)?.speciesId ?? null;
  const lastRelease = { player: null, rival: null };
  const bodyCenter = (target) => () => target && target.hp > 0 ? { x: target.x, y: target.y - 30 } : null;

  // ------------------------------------------------------------------ events -> presentation
  const elementTint = { BURN: 0xff7a2a, DROWN: 0x4fc3ff, STEAM: 0xeef7ff, FROST: 0xb8f0ff, CRYO_BRIDGE: 0xb8f0ff };
  function handleEvents(events) {
    for (const event of events) {
        if (event.type === 'ROUND_INTRO') {actionEvents.clear();playerView.resetAction();mateView.resetAction();bossView?.resetAction();for(const view of rivalViews.values())view.resetAction();}
      else if (['PLAYER_DOWN', 'PLAYER_RESPAWN'].includes(event.type)) actionEvents.delete(state.player.id);
      else if (['CAST', 'ULT_CAST', 'CAST_RELEASE'].includes(event.type)) actionEvents.set(event.casterId, event);
    }
    for (const event of events) {
      if (elementFx) {
        if (event.type === 'CAST' && event.moveType !== 'LUNGE') { const at = releaseAt(event); elementFx.cast({ x: at.x, y: at.y, moveId: event.moveId, speciesId: casterSpecies(event), windup: event.windup }); }
        else if (event.type === 'ULT_CAST') {
          const rect = view ? { x: view.centerX - view.halfW, y: view.centerY - view.halfH, width: view.halfW * 2, height: view.halfH * 2 } : { x: 0, y: 0, width: worldWidth, height: worldHeight };
          elementFx.ult({ moveId: event.moveId, speciesId: casterSpecies(event), rect, center: { x: event.x, y: event.y - 30 } });
          hitStop = Math.max(hitStop, reducedMotion ? 0 : 0.055);
        } else if (event.type === 'CAST_RELEASE') {
          const at = releaseAt(event);
          elementFx.release({ x: at.x, y: at.y, angle: event.angle ?? 0, moveId: event.moveId, speciesId: casterSpecies(event), melee: event.moveType === 'LUNGE' });
          lastRelease[event.team === 'player' ? 'player' : 'rival'] = { moveId: event.moveId, speciesId: casterSpecies(event), angle: event.angle ?? 0 };
        } else if (event.type === 'SKILL_HIT') {
          elementFx.hit({ x: event.x, y: event.y - 14, groundY: event.y, moveId: event.moveId, speciesId: state.player.speciesId });
        } else if (event.type === 'RIVAL_HIT' && event.cause !== 'LASER' && lastRelease.player) {
          const rival = (state.rivals ?? []).find(r => Math.hypot(r.x - event.x, r.y - event.y) < 2);
          elementFx.hit({ x: event.x, y: event.y - 30, groundY: event.y, ...lastRelease.player, heavy: event.amount >= 22, follow: bodyCenter(rival) });
        } else if (event.type === 'PLAYER_HIT' && lastRelease.rival) {
          elementFx.hit({ x: event.x, y: event.y - 30, groundY: event.y, ...lastRelease.rival, heavy: event.amount >= 22, follow: bodyCenter(state.player) });
        }
      }
      switch (event.type) {
        case "LASER_HIT": spawn({ x: event.x, y: event.y - BEAM_ELEVATION, texture: textures.glow, tint: 0xffffff, scale: 0.5, scaleTo: 0.2, life: 0.1 }); burst(event.x, event.y - BEAM_ELEVATION, { count: 3, speed: 260, tint: PARTNER_BEAM[partnerId] ?? 0x6ff7ff, life: 0.22 }); break;
        case "ENEMY_KILLED": {
          const tint = event.kind === "ember" ? 0xff8a2a : event.kind === "sentinel" ? 0xb18cff : 0xff5cd6;
          burst(event.x, event.y - 18, { count: 12, speed: 280, tint, texture: textures.shard, scale: 1.6, gravity: 380, life: 0.6 });
          ring(event.x, event.y, 46, tint, 0.3);
          break;
        }
        case "PLAYER_HIT": camera.addTrauma(0.38); burst(event.x, event.y - 30, { count: 8, speed: 200, tint: 0xff4a4a }); damageNumber(event.x, event.y - 56, event.amount, 0xffb0a8); heavyHit(event.amount); break;
        case "MATE_HIT": burst(event.x, event.y - 40, { count: 4, speed: 160, tint: 0x9fe8ff }); break;
        case "PERFECT_DODGE": ring(event.x, event.y - 20, 70, 0x7fe9ff, 0.35); burst(event.x, event.y - 20, { count: 10, speed: 320, tint: 0x7fe9ff }); break;
        case "DASH": afterimage(event.x, event.y, event.dirX); puff(event.x, event.y, 0xa89580, 3, 0.9); break;
        case "FIRE_IGNITE": if (event.source !== "SPREAD") burst(event.x, event.y, { count: 6, speed: 160, tint: 0xff9a3c, gravity: -120 }); break;
        case "FIRE_OUT": puff(event.x, event.y, 0xe8f4ff, 3, 1.4); break;
        case "ICE_FORM": burst(event.x, event.y, { count: 3, speed: 70, tint: 0xd8f6ff, texture: textures.shard, life:.3 }); break;
        case "ICE_CRACK_WARN": burst(event.x, event.y, { count: 2, speed: 80, tint: 0xffffff, texture: textures.shard, life: 0.3 }); break;
        case "ICE_MELT": ring(event.x, event.y, 30, 0x7fd8ff, 0.4, 0.6);spawn({x:event.x,y:event.y,texture:textures.iceMelt,scale:1,scaleTo:.8,life:.35,alpha:.7,add:false});break;
        case "ICE_MELT_HIT": puff(event.x,event.y,0xc6edf5,2,.6);break;
        case "PROP_HIT": if (relayMode && event.material !== 'TIMBER') { relayCoverHit(event, false); break; }
          burst(event.x,event.y-22,{count:3,speed:100,tint:event.cause==="FIRE"?0x8b6948:0xffffff,texture:textures.timberChip,life:.35,gravity:180});break;
        case "PROP_DESTROYED": if (relayMode && event.material !== 'TIMBER') { relayCoverHit(event, true); break; }
          burst(event.x,event.y-20,{count:rich?14:7,speed:180,tint:event.charred?0x504033:0xffffff,texture:textures.timberChip,life:.7,gravity:220});puff(event.x,event.y-15,event.charred?0x6a645d:0xa88c64,3,.9);break;
        case "FELL_IN_WATER": ring(event.x, event.y, 60, 0x9fe8ff, 0.5); burst(event.x, event.y, { count: 12, speed: 220, tint: 0xbff4ff, gravity: 500, life: 0.55 }); camera.addTrauma(0.2); break;
        case "RECOVERED": ring(event.x, event.y, 50, 0x7fffd4, 0.4); burst(event.x, event.y - 30, { count: 10, speed: 160, tint: 0x7fffd4, gravity: -100 }); break;
        case "SURGE": waves.push({ age: 0 }); break;
        case "SURGE_SPLASH": ring(event.x, event.y, event.radius, 0x7fe9ff, 0.5); burst(event.x, event.y, { count: 14, speed: 260, tint: 0xbff4ff, gravity: 420, life: 0.6 }); break;
        case "POD_BURST": ring(event.x, event.y, 120, 0xd8f6ff, 0.45); burst(event.x, event.y - 20, { count: 16, speed: 300, tint: 0xd8f6ff, texture: textures.shard, scale: 1.8 }); camera.addTrauma(0.15); break;
        case "CANCEL": {
          // Stage four clashes: steam where water or frost meets fire, sparks where shots meet.
          if (event.rule === 'STEAM_CLASH') { puff(event.x, event.y - 12, 0xeef7ff, 5, 1.4); ring(event.x, event.y - 12, 34, 0xeef7ff, 0.3); break; }
          if (['WAVE_SWALLOWS_SHOT', 'HEAVY_SHOT_WINS', 'SHOTS_TRADE'].includes(event.rule)) {
            burst(event.x, event.y - 12, { count: event.rule === 'SHOTS_TRADE' ? 10 : 6, speed: 260, tint: 0xffffff, life: 0.3 });
            ring(event.x, event.y - 12, 26, 0xffffff, 0.2); camera.addTrauma(0.08); break;
          }
          const tint = event.rule === "WATER_QUENCHES_EMBER" ? 0xeef7ff : event.rule === "LASER_BREAKS_SHARD" ? 0xc9a8ff : 0xff9be8;
          if (event.rule === "WATER_QUENCHES_EMBER") puff(event.x, event.y - 12, tint, 3, 0.9);
          else burst(event.x, event.y - 12, { count: event.rule === "LASER_BREAKS_SHARD" ? 10 : 5, speed: 200, tint, texture: textures.shard });
          break;
        }
        case "SHARD_BLOCK": burst(event.x, event.y - 12, { count: 3, speed: 240, tint: 0xd9c4ff, life: 0.18 }); break;
        case "SHOT_BLOCKED": burst(event.x, event.y, { count: 3, speed: 120, tint: 0xffe2b0, life: 0.2 }); break;
        case "WALL_SLAM":
          ring(event.x, event.y, 70, event.target === "player" ? 0xff4a4a : 0xffd34d, 0.4);
          burst(event.x, event.y - 20, { count: 14, speed: 300, tint: 0xd8d0c0, texture: textures.shard, scale: 1.4, gravity: 420, life: 0.5 });
          camera.addTrauma(event.target === "player" ? 0.5 : 0.35);
          if (event.target === "rival") crowdReact("CHEER", event.x, 1);
          break;
        case "SLAM": ring(event.x, event.y, event.radius, 0xff5a3c, 0.45); puff(event.x, event.y, 0xa89580, 6, 2); camera.addTrauma(0.55); break;
        case "BOSS_SPAWN": ring(event.x, event.y, 220, 0xa58bff, 0.9); camera.addTrauma(0.3); break;
        case "BOSS_READY": ring(event.x, event.y, 260, 0xff5c8a, 0.6); camera.addTrauma(0.45); break;
        case "BOSS_ENRAGE": ring(event.x, event.y, 200, 0xff3b3b, 0.5); break;
        case "BOSS_DOWN":
          for (let i = 0; i < 4; i++) ring(event.x, event.y - 60, 120 + i * 80, i % 2 ? 0xffffff : 0xa58bff, 0.5 + i * 0.15);
          burst(event.x, event.y - 60, { count: 40, speed: 420, tint: 0xd8c8ff, texture: textures.shard, scale: 2.2, gravity: 300, life: 1.1 });
          camera.addTrauma(0.8); crowdReact("BOSS_DOWN", event.x, 1.5); break;
        case "BEACON_CAPTURED": ring(event.x, event.y, 140, 0x5affc8, 0.6); burst(event.x, event.y - 40, { count: 16, speed: 240, tint: 0x5affc8, gravity: -160 }); break;
        case "CORE_OUT": ring(event.x, event.y, 120, 0x9fe8ff, 0.6); puff(event.x, event.y, 0xffffff, 6, 2.2); break;
        case "ELEMENT_CHAIN": burst(event.x, event.y - 20, { count: 6, speed: 180, tint: elementTint[event.kind] ?? 0xffffff, gravity: -80 }); break;
        case "CROWD": crowdReact(event.source, event.x, event.source === "BOSS_DOWN" ? 1.5 : 1); break;
        case "CHEER": crowdReact("CHEER", state.player.x, 1.4); confetti(); break;
        case "PICKUP": spawn({ x: event.x, y: event.y - 10, texture: textures.glow, tint: 0x5ff3ff, scale: 0.35, scaleTo: 0.05, life: 0.2 }); break;
        case "PLAYER_DOWN": camera.addTrauma(0.6); burst(event.x, event.y - 30, { count: 16, speed: 240, tint: 0xff6a6a, texture: textures.shard }); break;
        case "PLAYER_RESPAWN": ring(event.x, event.y, 80, 0x7fffd4, 0.6); break;
        case "MATE_DOWN": ring(event.x, event.y, 70, 0xff6a6a, 0.5); break;
        case "MATE_REVIVED": ring(event.x, event.y, 90, 0x8dffb0, 0.6); burst(event.x, event.y - 40, { count: 12, speed: 200, tint: 0x8dffb0, gravity: -120 }); break;
        case "MOUNTED": ring(event.x, event.y, 70, 0x7fe9ff, 0.35); break;
        case "OVERHEAT": puff(state.player.x, state.player.y - 40, 0xdddddd, 6, 1.2); break;
        case "BRIDGE_LIFTED": bridgeLift = 0; camera.addTrauma(0.25); break;
        case "CAST": if(state.gameMode==='RELAY'&&!kitShots){const fx=relayLook(event.moveId,event.team);spawn({x:event.x,y:event.y-BEAM_ELEVATION,texture:textures.ring,tint:fx.tint,scale:.7,scaleTo:.12,life:event.windup,alpha:.65});
            // Charge orb at the hand: grows through the windup, so the release reads before it lands.
            if(event.moveType!=='LUNGE'&&!elementFx){const at=releaseAt(event);spawn({x:at.x,y:at.y,texture:textures.glow,tint:fx.tint,scale:.12,scaleTo:.5,life:Math.max(.12,event.windup),alpha:.9});}}break;
        case "CAST_RELEASE": {
          if(state.gameMode==='RELAY') {
            const fx=relayLook(event.moveId,event.team),{x,y,reviewed}=releaseAt(event);
            // Shots of a reviewed body are drawn leaving its mouth or hand, then settle on their path.
            if(reviewed)releaseOrigins.set(event.actionId,{x,y,born:elapsed});
            if(kitShots)break;
            spawn({x,y,texture:event.moveType==='LUNGE'?textures.relaySlash:textures.glow,tint:fx.tint,scale:event.moveType==='LUNGE'?.7:.6,scaleTo:.15,life:.19,rotation:event.angle});
            burst(x,y,{count:5,speed:150,angle:event.angle,spread:1.2,tint:fx.tint,texture:fx.texture==='relayCrystal'?textures.shard:textures.spark,life:.22});
          } else if(event.team==='player')spawn({x:event.x+Math.cos(event.angle)*26,y:event.y-BEAM_ELEVATION+Math.sin(event.angle)*26,texture:textures.glow,tint:0x6ff7ff,scale:.45,scaleTo:.1,life:.14});break;
        }
        case "ULT_CAST": ring(event.x, event.y, 160, event.team === "player" ? 0xffe066 : 0xff3b5c, 0.5); camera.addTrauma(0.25); camera.focusBoost?.(1.22, 0.5); crowdReact("CHEER", event.x, 1.2);
          // The caster's charge ring closes in on its feet as the cut-in plays (2026-10-28).
          spawn({ x: event.x, y: event.y, texture: textures.ring, tint: event.team === "player" ? 0x5ff3ff : 0xb18cff, scale: 1.6, scaleTo: 0.15, life: 0.42, alpha: 0.9 });
          break;
        case "RELAY_TAG_BURST": {
          const fx = relayLook(state.player.kit?.moves?.[0] ?? 'waterShot', 'player');
          const tint = event.perfect ? 0xffe066 : fx.tint;
          afterimage(event.x - (state.player.facing || 1) * 44, event.y, state.player.facing);
          afterimage(event.x - (state.player.facing || 1) * 22, event.y, state.player.facing);
          for (let i = 0; i < 3; i++) ring(event.x, event.y - 12, (event.radius ?? 135) * (0.55 + i * 0.22), tint, 0.36 + i * 0.08);
          burst(event.x, event.y - 16, { count: event.perfect ? 22 : 14, speed: event.perfect ? 340 : 250, tint, life: 0.48 });
          elementFx?.hit({ x: event.x, y: event.y - 20, groundY: event.y, moveId: state.player.kit?.moves?.[0] ?? 'waterShot', speciesId: state.player.speciesId, heavy: true });
          camera.focusBoost?.(event.perfect ? 1.22 : 1.14, 0.38);
          camera.addTrauma(event.perfect ? 0.42 : 0.25);
          hitStop = Math.max(hitStop, reducedMotion ? 0 : event.perfect ? 0.075 : 0.045);
          floatText(event.x, event.y - 64, event.perfect ? t("relay.perfectSwitchShort") : t("relay.tagShockwave"), "crit");
          break;
        }
        case "RELAY_PERFECT_SWITCH":
          ring(event.x, event.y - 24, 96, 0xffe066, 0.4);
          floatText(event.x, event.y - 84, "+25 TP", "dodge");
          break;
        case "TRI_LINK_RUSH":
          camera.focusBoost?.(1.25, 0.55);
          camera.addTrauma(0.55);
          hitStop = Math.max(hitStop, reducedMotion ? 0 : 0.085);
          for (let i = 0; i < 4; i++) ring(event.x, event.y - 20, 110 + i * 55, [0xffe066, 0x6ff7ff, 0xff6ad5, 0x8dffb0][i % 4], 0.45 + i * 0.1);
          burst(event.x, event.y - 24, { count: 32, speed: 380, tint: 0xffe066, texture: textures.shard, scale: 1.8, life: 0.7 });
          if (elementFx) {
            const rect = view ? { x: view.centerX - view.halfW, y: view.centerY - view.halfH, width: view.halfW * 2, height: view.halfH * 2 } : { x: 0, y: 0, width: worldWidth, height: worldHeight };
            elementFx.ult({ moveId: state.player.kit?.ultimate ?? 'coreNova', speciesId: state.player.speciesId, rect, center: { x: event.x, y: event.y - 24 } });
          }
          floatText(event.x, event.y - 72, t("relay.triLinkShort"), "crit");
          break;
        case "SUPER_CORE_WARNING":
        case "SUPER_CORE_ACTIVE":
          ring(event.x, event.y, (event.radius ?? 68) * 1.35, 0xffe066, 0.5);
          if (event.type === "SUPER_CORE_ACTIVE") floatText(event.x, event.y - 54, t("arena.SUPER_CORE.short"), "crit");
          break;
        case "RIVAL_KO":
          camera.focusBoost?.(1.22, 0.48);
          camera.addTrauma(0.5);
          hitStop = Math.max(hitStop, reducedMotion ? 0 : 0.08);
          for (let i = 0; i < 3; i++) ring(event.x, event.y - 20, 75 + i * 40, i % 2 ? 0xffffff : 0xffd34d, 0.42 + i * 0.1);
          burst(event.x, event.y - 24, { count: 24, speed: 340, tint: 0xffd34d, texture: textures.shard, scale: 1.7, gravity: 280, life: 0.75 });
          floatText(event.x, event.y - 66, t("relay.ko"), "crit");
          break;
        case "BURST":
          camera.focusBoost?.(1.22, 0.48);
          hitStop = Math.max(hitStop, reducedMotion ? 0 : 0.065);
          ring(event.x, event.y - 24, 130, 0xffe066, 0.48);
          burst(event.x, event.y - 24, { count: 22, speed: 320, tint: 0xffe066, life: 0.55 });
          break;
        case "NOVA": if (kitShots && state.gameMode === 'RELAY' && elementFx.area({ x: event.x, y: event.y - 20, radius: event.radius, moveId: event.moveId, speciesId: casterSpecies(event) })) { camera.addTrauma(0.5); break; }
          for (let i = 0; i < 3; i++) ring(event.x, event.y, event.radius * (0.6 + i * 0.25), state.gameMode==='RELAY'?relayLook(event.moveId,event.team).tint:event.effect === "ROOT" ? 0xc8f4ff : event.effect === "SLOW" ? 0x5fd8c8 : 0xff8a3c, 0.4 + i * 0.12);
          burst(event.x, event.y - 20, { count: 24, speed: 380, tint: state.gameMode==='RELAY'?relayLook(event.moveId,event.team).tint:event.effect === "ROOT" ? 0xd8f6ff : 0xffb070, texture: textures.shard, scale: 1.8, gravity: 200, life: 0.7 }); camera.addTrauma(0.5);
          if (state.gameMode === 'RELAY') relayImpact(event.x, event.y - 20, relayLook(event.moveId, event.team)); break;
        case "ZONE_BURST": if (kitShots && state.gameMode === 'RELAY' && elementFx.area({ x: event.x, y: event.y, radius: event.radius, moveId: event.moveId, speciesId: casterSpecies(event) })) { camera.addTrauma(0.18); break; }
          ring(event.x, event.y, event.radius, event.team === "player" ? 0x6ff7ff : 0xff5a3c, 0.35);
          burst(event.x, event.y, { count: 12, speed: 260, tint: state.gameMode==='RELAY'?relayLook(event.moveId,event.team).tint:event.effect === "ROOT" ? 0xd8f6ff : event.effect === "IGNITE" ? 0xff9a3c : 0xbff4ff, gravity: 260, life: 0.5 }); camera.addTrauma(0.18);
          if (state.gameMode === 'RELAY') relayImpact(event.x, event.y, relayLook(event.moveId, event.team)); break;
        case "BARRIER_UP": ring(event.x, event.y - 16, 70, 0xffe066, 0.3); break;
        case "ARENA_WARNING": for (const zone of event.zones) ring(zone.x, zone.y, zone.radius, ZONE_TINT[event.kind] ?? 0xffffff, 0.5); break;
        case "ARENA_ACTIVE": for (const zone of state.relay?.arena?.zones ?? []) { ring(zone.x, zone.y, zone.radius * 1.3, ZONE_TINT[event.kind] ?? 0xffffff, 0.45); burst(zone.x, zone.y, { count: 10, speed: 160, tint: ZONE_TINT[event.kind] ?? 0xffffff, life: 0.5 }); } break;
        case "ARENA_CLAIM": ring(event.x, event.y, 80, ZONE_TINT[event.kind] ?? 0xffffff, 0.4); burst(event.x, event.y - 20, { count: 14, speed: 240, tint: ZONE_TINT[event.kind] ?? 0xffffff, life: 0.55 });
          if (event.team === 0) crowdReact("CHEER", event.x, 0.8); break;
        case "ARENA_PRESSURE": camera.addTrauma(0.3); break;
        case "EFFECTIVE": ring(event.x, event.y - 30, event.mult > 1 ? 52 : 40, event.mult > 1 ? 0xffd34d : 0x9aa4b0, 0.32);
          if (event.mult > 1) burst(event.x, event.y - 34, { count: 6, speed: 200, tint: 0xffd34d, life: 0.35 }); break;
        case "STATUS_CLEARED": burst(event.x, event.y - 24, { count: 8, speed: 180, tint: 0xd8f6ff, texture: textures.shard, gravity: 300, life: 0.45 }); puff(event.x, event.y - 10, 0xeef7ff, 3, 1); break;
        case "BLINK": afterimage(event.fromX, event.fromY, event.x - event.fromX); burst(event.x, event.y - 20, { count: 10, speed: 200, tint: 0xd8f6ff, texture: textures.shard }); break;
        case "RIVAL_HIT": if (event.cause !== "LASER" && !(kitShots && relayMode)) { burst(event.x, event.y - 30, { count: 5, speed: 220, tint: 0xffd0d0 }); contact(event.x, event.y - 30, 0xffb070); }
          damageNumber(event.x, event.y - 56, event.amount, 0xffffff); heavyHit(event.amount); break;
        case "RIVAL_DODGE": puff(event.x, event.y, 0xa89580, 3, 0.9); break;
        case "RIVAL_SPLASH": ring(event.x, event.y, 50, 0x9fe8ff, 0.4); break;
        case "SKILL_HIT": if (kitShots && state.gameMode === 'RELAY') break;
          spawn({ x: event.x, y: event.y - 14, texture: textures.glow, tint: state.gameMode==='RELAY'?relayLook(event.moveId,'player').tint:MOVE_TINT[event.moveId] ?? 0xffffff, scale: 0.6, scaleTo: 0.15, life: 0.14 });
          if (state.gameMode === 'RELAY') { relayImpact(event.x, event.y - 14, relayLook(event.moveId, 'player')); } break;
        case "STATUS": burst(event.x, event.y - 30, { count: 4, speed: 120, tint: event.status === "ROOT" ? 0xd8f6ff : event.status === "SLOW" ? 0x7fc8ff : 0xff9a3c, life: 0.35 }); break;
        case "ROUND_WON": crowdReact("VICTORY", event.x ?? worldWidth / 2, 1.4); confetti(); camera.addTrauma(0.3); break;
        case "ROUND_LOST": crowdReact("DEFEAT", worldWidth / 2, 1); break;
        case "RESULT": crowdReact(event.outcome === "VICTORY" ? "VICTORY" : "DEFEAT", worldWidth / 2, 1.6); if (event.outcome === "VICTORY") confetti(); break;
        default: break;
      }
    }
  }
  function confetti() {
    if (!view) return;
    const colors = [0xffd34d, 0x7fe9ff, 0xff7ad9, 0x8dffb0];
    for (let i = 0; i < (rich ? 60 : 20); i++) {
      const x = view.centerX - view.halfW + ((i * 97) % 100) / 100 * view.halfW * 2;
      spawn({ x, y: view.centerY - view.halfH - 10, vx: Math.sin(i) * 60, vy: 120 + (i % 7) * 30, texture: textures.dot, tint: colors[i % 4],
        scale: 2.5, life: 2.4, gravity: 40, add: false, spin: 6 });
    }
  }

  // ------------------------------------------------------------------ indicators (screen space)
  const arrows = [];
  function arrowAt(i) {
    let sprite = arrows[i];
    if (!sprite) { sprite = new PIXI.Sprite(textures.arrow); sprite.anchor.set(0.5); screen.addChild(sprite); arrows[i] = sprite; }
    sprite.visible = true;
    return sprite;
  }

  // ------------------------------------------------------------------ per frame
  let fpsWindow = [], frameCount = 0;
  function render(dtMs, ambientPaused = false) {
    // One paused clock for particles, ice/fire, bridge lift, actors and scenery.
    // The authoritative simulation is paused by the screen as before.
    const observedFrameMs=dtMs;
    if(ambientPaused)dtMs=0;
    const dt = Math.min(0.1, dtMs / 1000);
    elapsed += dt; frameCount++;
    if (!ambientPaused) ambientElapsed += dt;
    if(!ambientPaused)fpsWindow.push(observedFrameMs); if (fpsWindow.length > 120) fpsWindow.shift();
    if (hitStop > 0) hitStop = Math.max(0, hitStop - Math.min(0.1, observedFrameMs / 1000));
    elementFx?.update(dt * 1000);
    if (relayMode && dt > 0 && (statusTick += dt) >= 0.14) {
      statusTick = 0;
      // Status reads on the body: burn embers rise, a root rings the feet, slow trails mist.
      for (const body of [state.player, ...state.rivals.filter(r => r.active && r.hp > 0)]) {
        if (body.burn > 0) spawn({ x: body.x + (Math.random() - 0.5) * 22, y: body.y - 24, vy: -70, texture: textures.spark, tint: 0xff8a3c, scale: 1.2, scaleTo: 0.4, life: 0.4 });
        if (body.root > 0) ring(body.x, body.y, 28, 0xc8f4ff, 0.22, 0.6);
        else if (body.slow > 0) spawn({ x: body.x + (Math.random() - 0.5) * 26, y: body.y - 8, texture: textures.glow, tint: 0x7fc8ff, scale: 0.22, scaleTo: 0.08, life: 0.35, alpha: 0.6 });
      }
    }
    const viewport = { width: stage.screen.width, height: stage.screen.height };
    const player = state.player, mate = state.mate, boss = state.boss;
    const riding = player.state === "RIDING" || player.state === "MOUNTING";
    const focus = riding ? mate : player;
    const threat = Math.min(1, state.enemies.filter((enemy) => Math.hypot(enemy.x - focus.x, enemy.y - focus.y) < 520).length / 14)
      + (boss && boss.state !== "DOWN" ? 0.5 : 0);
    view = camera.update({ dtMs: Math.min(100, dtMs), viewport, target: focus, velocity: { x: focus.vx, y: focus.vy },
      aim: state.laser.firing ? { x: state.laser.x1, y: state.laser.y1 } : null, threat,
      opponent: state.rivals.find((rival) => rival.hp > 0) ?? null });
    world.scale.set(view.zoom); world.position.set(view.x, view.y);
    const left = view.centerX - view.halfW - 80, right = view.centerX + view.halfW + 80;
    const top = view.centerY - view.halfH - 120, bottom = view.centerY + view.halfH + 80;
    const inView = (x, y) => x > left && x < right && y > top && y < bottom;

    for (const chunk of chunks) chunk.sprite.visible = chunk.x < right && chunk.x + chunk.width > left && chunk.y < bottom && chunk.y + chunk.height > top;
    for (const strip of waterStrips) {
      if (environment) break;
      strip.tilePosition.x = reducedMotion ? 0 : elapsed * 28;
      strip.tilePosition.y = reducedMotion ? 0 : Math.sin(elapsed * 0.8) * 6;
    }
    environmentView?.update({ elapsed: ambientElapsed, reducedMotion, left, right, top, bottom, low: !rich, focus,reaction:crowd });
    interactionView.update({left,right,top,bottom,elapsed});
    if (relayMode) drawArenaZones();
    if (bridgeLift >= 0) {
      bridgeLift += dt;
      bridge.alpha = Math.max(0, 1 - bridgeLift / 1.2);
      bridge.y = -bridgeLift * 40;
      if (bridge.alpha <= 0) bridge.visible = false;
    }

    // Cells: fire flicker and ice states.
    // Keep cell visual-state synchronization bounded in both quality modes.
    // Low quality must not double the full-grid scan rate.
    if (frameCount % 2 === 0) syncCells();
    for (const [i, flame] of fireSprites) {
      const prop=grid.propAtCell(i),floorY=(Math.floor(i/grid.cols)+.5)*cell;
      // Sort burning timber with its actual cover. A floor-only layer hides
      // every flame behind the crate; foreground actors still draw above it.
      const raised=prop&&!prop.destroyed;
      const flameLayer=raised?objects:cellFx;
      if(flame.parent!==flameLayer)flameLayer.addChild(flame);
      if(raised)flame.zIndex=(prop.row+prop.height)*cell+.02;
      flame.y=(Math.floor(i/grid.cols)+.85)*cell-floorOffset(flame.x,floorY)-(prop&&!prop.destroyed?42:0);
      const x = flame.x, y = flame.y;
      flame.visible = inView(x, y);
      if (!flame.visible) continue;
      const left = grid.fire[i];
      const fade = Math.min(1, left / 3);
      flame.texture=textures.flame[reducedMotion?0:Math.floor(elapsed*(rich?8:4)+i)%textures.flame.length];
      flame.scale.set(reducedMotion?1:0.95 + 0.08 * Math.sin(elapsed * 11 + i), (reducedMotion?0.95:0.85 + 0.2 * Math.sin(elapsed * 13 + i * 1.7)) * (0.5 + 0.5 * fade));
      flame.alpha = 0.6 + 0.4 * fade;
      if(dt>0&&!reducedMotion&&elapsed>=smokeAt[i]&&live.length<cap*.7){
        smokeAt[i]=elapsed+(rich?1.9:3.8)+(i%5)*.12;
        spawn({x,y:y-26,vx:4,vy:-13,texture:textures.soft,tint:0x77716a,scale:.35,scaleTo:.8,life:1.3,alpha:.18,add:false});
      }
    }

    // Actors. Keep a view per selected team member; shared texture ownership stays
    // with the bundle scope and all views are destroyed with this scene.
    // Burst evolution: once the shell has closed, the form's view stands in for the bursting 成熟期.
    const playerBurst = state.gameMode === 'RELAY' ? state.relay?.team?.[state.relay.active]?.burst ?? null : null;
    // A tier-2 chain shows its tier-1 form between the two flashes.
    const burstSince = playerBurst?.phase === 'BURST' && state.player.burstPartnerId ? state.time - playerBurst.startedAt : -1;
    const wantedPartnerId = burstSince >= arenaReveal(playerBurst) ? state.player.burstPartnerId
      : burstSince >= ARENA_BURST_REVEAL_SECONDS && playerBurst?.via != null ? `relay-species-${String(playerBurst.via).padStart(3, '0')}` : null;
    const shownPartnerId = wantedPartnerId && cast.partners.some(m => m.partnerId === wantedPartnerId) ? wantedPartnerId : state.player.partnerId;
    if (state.gameMode === 'RELAY' && shownPartnerId !== partnerId) {
      playerView.container.visible = false;
      partnerId = shownPartnerId;
      if (!playerViews.has(partnerId)) playerViews.set(partnerId, createActorView('PLAYER', cast.partners.find(m => m.partnerId === partnerId), state.player));
      playerView = playerViews.get(partnerId); playerView.container.visible = true;
      actionEvents.delete(state.player.id);
    }
    // Actors. A relay ends on a short KO pause, not the victory pose: the side
    // still standing celebrates through it.
    const relayWinner = state.gameMode === 'RELAY' && state.tournament?.status === 'KO' ? state.tournament.winner : null;
    const playerSeq = player.state === "DOWNED" || player.state === "DEFEATED" ? DATA_ARENA_SEQUENCES.DOWN
      : player.hitFlash > 0 ? DATA_ARENA_SEQUENCES.HIT
      : state.mode === "VICTORY_POSE" || state.result?.outcome === "VICTORY" || relayWinner === 'player' ? DATA_ARENA_SEQUENCES.WIN
      : state.laser.firing || player.cast || player.lunge || player.recovery > 0 ? DATA_ARENA_SEQUENCES.ATTACK
      : Math.hypot(player.vx, player.vy) > 30 ? DATA_ARENA_SEQUENCES.WALK : DATA_ARENA_SEQUENCES.STAND;
    const blink = !reducedMotion && player.invulnerable > 0 && player.state !== "DASH" && Math.floor(elapsed * 14) % 2 === 0;
    const sink = player.state === "FALLING" ? clamp(player.stateTime / 0.7, 0, 1) : 0;
    playerView.update(dtMs, { x: player.x, y: riding ? mate.y - 2 : player.y, facing: player.facing, flash: player.hitFlash,
      alpha: blink ? 0.35 : 1, lift: riding ? 44 : 0, seq: playerSeq, sink });
    if (state.gameMode === 'RELAY') drawArenaBurstShell('player', player, playerBurst, 'PLAYER');
    if (riding) playerView.container.zIndex = mate.y + 1;
    if (playerView.ringGfx) {
      const g = playerView.ringGfx;
      g.clear();
      if (state.gameMode === 'RELAY') {
        const angle = Math.PI / 2 - (player.facing8 ?? 2) * Math.PI / 4;
        const ax = Math.cos(angle) * 42, ay = Math.sin(angle) * 23;
        g.moveTo(ax, ay).lineTo(ax - Math.cos(angle - .6) * 12, ay - Math.sin(angle - .6) * 12)
          .moveTo(ax, ay).lineTo(ax - Math.cos(angle + .6) * 12, ay - Math.sin(angle + .6) * 12).stroke({width: 3, color: 0xa5edff});
      }
      g.ellipse(0, 0, 28, 12).stroke({ width: 2, color: PARTNER_BEAM[partnerId] ?? 0x6ff7ff, alpha: 0.75 });
      // Dash pips under the player.
      const max = sim.stats.dashCharges;
      for (let i = 0; i < max; i++) g.circle((i - (max - 1) / 2) * 12, 18, 4).fill({ color: i < player.dashCharges ? 0x7fe9ff : 0x334455 });
      g.visible = !riding && player.state !== "FALLING";
    }
    const mateSeq = mate.state === "DOWNED" ? DATA_ARENA_SEQUENCES.DOWN : mate.hitFlash > 0 ? DATA_ARENA_SEQUENCES.HIT
      : mate.surgeAim ? DATA_ARENA_SEQUENCES.ATTACK : Math.hypot(mate.vx, mate.vy) > 30 ? DATA_ARENA_SEQUENCES.WALK : DATA_ARENA_SEQUENCES.STAND;
    mateView.update(dtMs, { x: mate.x, y: mate.y, facing: mate.facing, flash: mate.hitFlash, alpha: mate.state === "DOWNED" ? 0.7 : 1,
      seq: mateSeq, sink: mate.swimming ? 0.35 : 0 });
    if (boss && !bossView) bossView = createActorView("BOSS", cast.boss, boss);
    if (bossView) {
      const entering = boss.state === "ENTRANCE";
      const seq = boss.state === "DOWN" ? DATA_ARENA_SEQUENCES.DOWN : boss.hitFlash > 0 ? DATA_ARENA_SEQUENCES.HIT
        : boss.pattern && boss.pattern !== "summon" ? DATA_ARENA_SEQUENCES.ATTACK : Math.hypot(boss.vx, boss.vy) > 20 ? DATA_ARENA_SEQUENCES.WALK : DATA_ARENA_SEQUENCES.STAND;
      bossView.update(dtMs, { x: boss.x, y: boss.y, facing: boss.facing, flash: boss.hitFlash,
        alpha: entering ? clamp(boss.stateTime / 2.6, 0, 1) : boss.state === "DOWN" ? 0.85 : 1,
        lift: entering ? (1 - clamp(boss.stateTime / 2.6, 0, 1)) * 260 : 0, seq });
      bossView.setHealth(boss.state === "DOWN" || entering ? 0 : boss.hp / boss.maxHp);
      bossView.sprite.tint = boss.hitFlash > 0 ? 0xffb0b0 : boss.enraged ? mixColor(0xffffff, 0xff6060, 0.35 + 0.15 * Math.sin(elapsed * 8)) : 0xffffff;
    }

    // Rivals (tournament).
    for (const rival of state.rivals) {
      // Burst evolution: a bursting rival is drawn as its form once the shell has closed.
      const rb = state.gameMode === 'RELAY' ? rival.burst ?? null : null;
      const formMember = rb?.phase === 'BURST' && rival.burstSpeciesId && state.time - rb.startedAt >= arenaReveal(rb)
        ? cast.partners.find((entry) => entry.speciesId === rival.burstSpeciesId) : null;
      const viewKey = formMember ? `${rival.id}:${rival.burstSpeciesId}` : rival.id;
      let actorView = rivalViews.get(viewKey);
      if (!actorView) {
        const member = formMember ? { ...formMember, role: 'RIVAL' } : cast.rivals?.find((entry) => entry.rivalId === rival.definitionId);
        actorView = createActorView(member?.role ?? "RIVAL", member, rival);
        rivalViews.set(viewKey, actorView);
      }
      for (const [key, view] of rivalViews) if (String(key).split(':')[0] === String(rival.id)) view.container.visible = key === viewKey;
      if (rb) drawArenaBurstShell(`rival:${rival.id}`, rival, rb, 'RIVAL');
      const seq = rival.hp <= 0 ? DATA_ARENA_SEQUENCES.DOWN : rival.hitFlash > 0 ? DATA_ARENA_SEQUENCES.HIT
        : relayWinner === 'rival' ? DATA_ARENA_SEQUENCES.WIN
        : rival.cast || rival.lunge || rival.recovery > 0 ? DATA_ARENA_SEQUENCES.ATTACK : Math.hypot(rival.vx, rival.vy) > 30 || rival.dashTimer > 0 ? DATA_ARENA_SEQUENCES.WALK : DATA_ARENA_SEQUENCES.STAND;
      actorView.update(dtMs, { x: rival.x, y: rival.y, facing: rival.facing, flash: rival.hitFlash, alpha: rival.invulnerable > 0 ? 0.55 : 1, seq });
      actorView.sprite.tint = statusTint(rival, rival.hitFlash > 0 ? 0xff9a9a : 0xffffff);
      actorView.setHealth(rival.active === false ? 0 : rival.hp / rival.maxHp);
    }
    for (const [id, view] of rivalViews) if (!state.rivals.some((rival) => String(rival.id) === String(id).split(':')[0])) { view.container.destroy({ children: true }); rivalViews.delete(id); burstShell.retire(`rival:${String(id).split(':')[0]}`); }
    if (!(state.mate.state === "ABSENT")) mateView.container.visible = true; else mateView.container.visible = false;
    playerView.sprite.tint = statusTint(state.player, playerView.sprite.tint);

    // Enemies.
    const seen = new Set();
    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const entry = enemyView(enemy);
      const visible = inView(enemy.x, enemy.y);
      entry.container.visible = visible;
      if (!visible) continue;
      const bob = reducedMotion ? 0 : Math.sin(elapsed * 6 + entry.seed * TAU) * 3;
      entry.container.position.set(enemy.x, enemy.y - floorOffset(enemy.x,enemy.y));
      entry.container.zIndex = enemy.y;
      const appear = 1 - enemy.spawnFx / 0.4;
      const windup = enemy.windup > 0 ? 1 + 0.15 * Math.sin(elapsed * 30) : 1;
      entry.sprite.scale.set((enemy.facing > 0 ? 1 : -1) * appear * windup, appear * windup);
      entry.sprite.y = bob - (enemy.kind === "ember" ? 6 : 0);
      entry.sprite.tint = enemy.hitFlash > 0 ? 0xffffff : 0xffffff;
      entry.sprite.alpha = enemy.hitFlash > 0 ? 0.6 : 1;
      if (enemy.kind === "noise" && rich && !reducedMotion) entry.sprite.x = Math.sin(elapsed * 31 + entry.seed * 40) > 0.92 ? 3 : 0;
    }
    for (const [id, entry] of enemyViews) {
      if (seen.has(id)) continue;
      entry.container.visible = false; objects.removeChild(entry.container); enemyPool.push(entry); enemyViews.delete(id);
    }

    // Pods, cores, beacons.
    state.pods.forEach((pod, i) => {
      const g = podViews[i];
      g.visible = inView(pod.x, pod.y);
      g.zIndex = pod.y;
      g.alpha = pod.respawn > 0 ? 0.18 : 1;
      g.scale.set(pod.respawn > 0 ? 0.8 : 1 + 0.03 * Math.sin(elapsed * 4 + i));
    });
    for (const core of state.cores) {
      let entry = coreViews.get(core.id);
      if (!entry) {
        const glow = new PIXI.Sprite(textures.glow); glow.anchor.set(0.5); glow.blendMode = "add"; glow.tint = 0xff6a1a;
        const flame = new PIXI.Sprite(textures.flame[0]); flame.anchor.set(0.5, 0.95); flame.blendMode = "add"; flame.scale.set(1.6);
        const container = new PIXI.Container(); container.addChild(glow, flame); container.position.set(core.x, core.y); objects.addChild(container);
        entry = { container, glow, flame }; coreViews.set(core.id, entry);
      }
      entry.container.zIndex = core.y;
      entry.container.alpha = core.out ? Math.max(0, entry.container.alpha - dt) : 1;
      entry.glow.scale.set(3 + Math.sin(elapsed * 5) * 0.4);
      entry.flame.scale.y = reducedMotion?1.6:1.6 + Math.sin(elapsed * 9) * 0.25;
    }
    state.beacons.forEach((beacon, i) => {
      beaconLights[i].alpha = beacon.captured ? 0.35 + 0.1 * Math.sin(elapsed * 3 + i) : beacon.active ? 0.08 + 0.06 * Math.sin(elapsed * 5) : 0;
    });

    // Pickups as pooled particles-like sprites (cheap, short-lived).
    drawPickups();

    // Shots.
    const liveShots = new Set();
    for (const projectile of state.projectiles) {
      liveShots.add(projectile.id);
      const entry = shotView(projectile);
      const visible = inView(projectile.x, projectile.y);
      entry.sprite.visible = visible && !entry.kitDrawn; entry.glow.visible = visible && rich && !entry.kitDrawn; entry.shadow.visible = visible;
      if (!visible) continue;
      const lift = projectile.kind === "TIDE" ? 18 : 12;
      if (entry.origin) { entry.from = [entry.origin.x - projectile.x, entry.origin.y - (projectile.y - lift)]; entry.fromBorn = entry.origin.born; entry.origin = null; }
      const [ox, oy] = releaseOffset(entry.from, elapsed - entry.fromBorn);
      entry.sprite.position.set(projectile.x + ox, projectile.y - lift + oy);
      entry.glow.position.set(projectile.x + ox, projectile.y - lift + oy);
      entry.shadow.position.set(projectile.x + ox, projectile.y);
      if (projectile.kind === "SHARD") entry.sprite.alpha = 0.55 + 0.45 * clamp(projectile.hp / 26, 0, 1);
      else entry.sprite.alpha = 1;
      if (projectile.kind !== "ORB") entry.sprite.rotation = Math.atan2(projectile.vy, projectile.vx);
      else entry.sprite.rotation = elapsed * 4;
    }
    for (const [id, origin] of releaseOrigins) if (elapsed - origin.born >= 0.5) releaseOrigins.delete(id);
    for (const [id, entry] of shotViews) {
      if (liveShots.has(id)) continue;
      entry.sprite.visible = entry.glow.visible = entry.shadow.visible = false;
      shots.removeChild(entry.sprite); shotGlow.removeChild(entry.glow); shotGlow.removeChild(entry.shadow);
      shotPool.push(entry); shotViews.delete(id);
    }

    drawBeams();
    drawMarks();
    updateParticles(dt);
    updateNumbers(dt);
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const ghost = ghosts[i];
      ghost.age += dt; ghost.sprite.alpha = 0.5 * (1 - ghost.age / ghost.life);
      if (ghost.age >= ghost.life) { ghost.sprite.destroy(); ghosts.splice(i, 1); }
    }
    updateCrowd(dt);
    updateIndicators(viewport);
  }

  const pickupSprites = [];
  function drawPickups() {
    let i = 0;
    for (const pickup of state.pickups) {
      let sprite = pickupSprites[i];
      if (!sprite) { sprite = new PIXI.Sprite(textures.pickup); sprite.anchor.set(0.5); objects.addChild(sprite); pickupSprites[i] = sprite; }
      sprite.visible = true;
      sprite.position.set(pickup.x, pickup.y - 10 - (reducedMotion ? 0 : Math.abs(Math.sin(elapsed * 5 + pickup.id)) * 5));
      sprite.zIndex = pickup.y;
      i++;
    }
    for (; i < pickupSprites.length; i++) pickupSprites[i].visible = false;
  }

  function placeBeam(glow, core, x0, y0, x1, y1, width, tint, coreTint = 0xffffff) {
    const length = Math.hypot(x1 - x0, y1 - y0), angle = Math.atan2(y1 - y0, x1 - x0);
    for (const part of [glow, core]) { part.visible = length > 1; part.position.set(x0, y0); part.rotation = angle; }
    glow.scale.set(length / 4, (width * 3.4) / 64); glow.tint = tint; glow.alpha = rich ? 0.85 : 0.6;
    core.scale.set(length / 4, (width * 1.3) / 32); core.tint = coreTint;
  }

  function drawBeams() {
    const laser = state.laser;
    if (laser.firing) {
      const heat = clamp(laser.heat / sim.stats.heatCapacity, 0, 1);
      const base = PARTNER_BEAM[partnerId] ?? 0x6ff7ff;
      const tint = heat < 0.6 ? base : mixColor(base, 0xff5a2a, (heat - 0.6) / 0.4);
      const width = sim.stats.laserWidth * (1 + (reducedMotion ? 0 : 0.12 * Math.sin(elapsed * 40)));
      placeBeam(beam.glow, beam.core, laser.x0, laser.y0 - BEAM_ELEVATION, laser.x1, laser.y1 - BEAM_ELEVATION, width, tint);
      beam.muzzle.visible = true; beam.muzzle.position.set(laser.x0, laser.y0 - BEAM_ELEVATION); beam.muzzle.tint = tint; beam.muzzle.scale.set(0.7);
      beam.impact.visible = true; beam.impact.position.set(laser.x1, laser.y1 - BEAM_ELEVATION);
      beam.impact.tint = laser.endKind === "SHARD" ? 0xd9c4ff : laser.endKind === "TARGET" ? 0xffffff : tint;
      beam.impact.scale.set(laser.endKind === "RANGE" ? 0.3 : 0.75 + 0.15 * Math.sin(elapsed * 50));
    } else for (const part of Object.values(beam)) part.visible = false;
    state.scans.forEach((scan, i) => {
      const parts = scanBeams[i];
      if (!parts) return;
      if (scan.telegraph > 0) { parts.glow.visible = parts.core.visible = false; return; }
      const reach = scan.reach ?? DATA_ARENA_SCAN.length;
      placeBeam(parts.glow, parts.core, scan.x, scan.y - 10, scan.x + Math.cos(scan.angle) * reach, scan.y - 10 + Math.sin(scan.angle) * reach,
        DATA_ARENA_SCAN.width, 0xff2f5a, 0xffd0da);
    });
    for (let i = state.scans.length; i < scanBeams.length; i++) scanBeams[i].glow.visible = scanBeams[i].core.visible = false;
    // Surge waves follow the simulation's live wave fronts.
    let w = 0;
    for (const wave of state.surges) {
      let sprite = waves[w]?.sprite;
      if (!sprite) { sprite = new PIXI.Sprite(textures.wave); sprite.anchor.set(0.7, 0.5); sprite.blendMode = rich ? "add" : "normal"; beams.addChild(sprite); waves[w] = { sprite, age: 0 }; }
      sprite.visible = true;
      sprite.position.set(wave.x, wave.y - 10);
      sprite.rotation = Math.atan2(wave.dy, wave.dx);
      sprite.scale.set(1.3, wave.width / 48);
      if (rich && frameCount % 3 === 0) spawn({ x: wave.x, y: wave.y, vx: -wave.dx * 60, vy: -40, texture: textures.soft, tint: 0xd8f6ff, scale: 0.4, scaleTo: 0.9, life: 0.5, alpha: 0.5, add: false });
      w++;
    }
    for (; w < waves.length; w++) if (waves[w]?.sprite) waves[w].sprite.visible = false;
  }

  // Owner 2026-11-04: the player's own relay moves draw no range circles or arrays (the game judges the hit), only the
  // short direction chevrons; while a thumb points a move, one guide shows its direction and where it lands. Rival
  // warnings stay.
  let aimGuide = null;
  function drawAimGuide(g) {
    const body = state.player.state === "RIDING" && state.mate ? state.mate : state.player;
    if (!aimGuide || !body) return;
    if (aimGuide.angle === null) { g.circle(body.x, body.y, aimGuide.radius).stroke({ width: 3, color: 0x6ff7ff, alpha: 0.8 }); return; }
    const c = Math.cos(aimGuide.angle), s = Math.sin(aimGuide.angle), ex = body.x + c * aimGuide.length, ey = body.y + s * aimGuide.length;
    g.moveTo(body.x + c * 26, body.y + s * 26).lineTo(ex, ey).stroke({ width: 8, color: 0x6ff7ff, alpha: 0.28 });
    g.moveTo(body.x + c * 26, body.y + s * 26).lineTo(ex, ey).stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });
    if (aimGuide.radius > 0) g.circle(ex, ey, aimGuide.radius).fill({ color: 0x6ff7ff, alpha: 0.12 }).stroke({ width: 2.5, color: 0x6ff7ff, alpha: 0.85 });
    else g.poly([ex + c * 16, ey + s * 16, ex - s * 10, ey + c * 10, ex + s * 10, ey - c * 10]).fill({ color: 0xffffff, alpha: 0.9 });
  }
  function drawMarks() {
    const g = marks;
    g.blendMode = "add";
    g.clear();
    drawAimGuide(g);
    // Telegraphs: dual-layer additive energy arrays with rotating rune ticks.
    for (const t of state.telegraphs) {
      const p = clamp(t.t / t.duration, 0, 1);
      const mine = t.team === "player";
      if (mine && relayMode && t.kind !== "LINE" && t.kind !== "CONE") continue; // relay: own direction chevrons only, no circles
      if ((t.kind === "LINE" || t.kind === "CONE") && mine) {
        // Own aim: short chevrons near the feet instead of a line across the field (Owner 2026-11-05).
        const rays = t.kind === "CONE" ? Array.from({ length: t.count }, (_, i) => t.angle - t.spread / 2 + (t.spread * i) / Math.max(1, t.count - 1)) : [t.angle];
        const reach = Math.min(t.length, 96);
        for (const a of rays) {
          const ca = Math.cos(a), sa = Math.sin(a);
          for (let k = 0; k < 3; k++) {
            const d = 30 + reach * (k + 1) / 3 - 18, w = 9 - k, alpha = (0.75 - k * 0.2) * (0.5 + 0.5 * p);
            const cx = t.x + ca * d, cy = t.y + sa * d;
            g.moveTo(cx - ca * w - sa * w, cy - sa * w + ca * w).lineTo(cx, cy).lineTo(cx - ca * w + sa * w, cy - sa * w - ca * w)
              .stroke({ width: 3, color: 0x6ff7ff, alpha, cap: 'round', join: 'round' });
          }
        }
      } else if (t.kind === "CIRCLE" && mine) {
        const fxColor = t.moveId ? relayLook(t.moveId, 'player').tint : 0x6ff7ff;
        g.circle(t.x, t.y, t.radius).stroke({ width: 3, color: fxColor, alpha: 0.85 });
        g.circle(t.x, t.y, t.radius * Math.max(0.18, p)).fill({ color: fxColor, alpha: 0.16 }).stroke({ width: 1.8, color: 0xffffff, alpha: 0.55 });
        for (let i = 0; i < 6; i++) {
          const a0 = elapsed * 2.2 + (i * TAU) / 6;
          arcPath(g, t.x, t.y, t.radius - 5, a0, a0 + 0.3).stroke({ width: 2.2, color: 0xffffff, alpha: 0.65 });
        }
      } else if (t.kind === "LINE") {
        const ex = t.x + Math.cos(t.angle) * t.length, ey = t.y + Math.sin(t.angle) * t.length;
        // A danger band that fills from the attacker as the strike nears, not a bare line across the field (Owner 2026-11-05).
        const nx = -Math.sin(t.angle) * (t.width / 2 + 4), ny = Math.cos(t.angle) * (t.width / 2 + 4);
        g.poly([t.x + nx, t.y + ny, ex + nx, ey + ny, ex - nx, ey - ny, t.x - nx, t.y - ny]).fill({ color: 0xff3b5c, alpha: 0.1 + 0.1 * p });
        const fx = t.x + Math.cos(t.angle) * t.length * p, fy = t.y + Math.sin(t.angle) * t.length * p;
        g.poly([t.x + nx, t.y + ny, fx + nx, fy + ny, fx - nx, fy - ny, t.x - nx, t.y - ny]).fill({ color: 0xff2f4a, alpha: 0.2 });
      } else if (t.kind === "CONE") {
        // A filled warning fan that grows toward its reach.
        const reach = t.length * (0.4 + 0.6 * p), a0 = t.angle - t.spread / 2 - 0.08, a1 = t.angle + t.spread / 2 + 0.08;
        g.moveTo(t.x, t.y).arc(t.x, t.y, reach, a0, a1).lineTo(t.x, t.y).fill({ color: 0xff7a2a, alpha: 0.18 + 0.2 * p });
      } else if (t.kind === "RING") {
        for (let i = 0; i < t.count; i++) {
          const a = (i / t.count) * TAU;
          const gap = t.gaps.some((ga) => Math.abs(((a - ga + Math.PI) % TAU + TAU) % TAU - Math.PI) < 1e-6);
          g.circle(t.x + Math.cos(a) * (t.radius * (0.6 + 0.4 * p)), t.y + Math.sin(a) * (t.radius * (0.6 + 0.4 * p)), gap ? 5 : 7)
            .fill({ color: gap ? 0x6dffb3 : 0xff5cd6, alpha: gap ? 0.9 : 0.4 + 0.5 * p });
        }
      } else if (t.kind === "CIRCLE") {
        const color = t.danger ? 0xff3b5c : 0xffa13b;
        g.circle(t.x, t.y, t.radius).fill({ color, alpha: 0.12 }).stroke({ width: 3, color, alpha: 0.88 });
        g.circle(t.x, t.y, t.radius * Math.max(0.18, p)).fill({ color, alpha: t.danger ? 0.24 : 0.15 }).stroke({ width: 1.8, color: 0xffd0d8, alpha: 0.6 });
        for (let i = 0; i < 6; i++) {
          const a0 = -elapsed * 2.2 + (i * TAU) / 6;
          arcPath(g, t.x, t.y, t.radius - 5, a0, a0 + 0.28).stroke({ width: 2.2, color: 0xffd0d8, alpha: 0.65 });
        }
      }
    }
    // Delayed zones: additive glowing magic arrays with rotating rune borders instead of flat grey concentric rings.
    const ZONE_COLOR = { IGNITE: 0xff5a1f, ROOT: 0x22e568, SLOW: 0x1ca3ff, NONE: 0xff3b5c };
    for (const zone of state.zones) {
      const p = clamp(zone.t / zone.delay, 0, 1);
      const zMoveId = zone.moveId ?? zone.move?.id;
      const moveTint = zMoveId ? relayLook(zMoveId, zone.team).tint : null;
      const color = ZONE_COLOR[zone.move?.effect] ?? moveTint ?? (zone.team === "player" ? 0x1ca3ff : 0xff3b5c);
      g.circle(zone.x, zone.y, zone.radius).fill({ color, alpha: 0.22 }).stroke({ width: zone.team === "player" ? 4 : 4.5, color, alpha: 0.95 });
      g.circle(zone.x, zone.y, zone.radius * Math.max(0.22, p)).fill({ color, alpha: 0.28 }).stroke({ width: 2.2, color: 0xffffff, alpha: 0.78 });
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a0 = elapsed * (zone.team === "player" ? 2.4 : -2.4) + (i * TAU) / 6;
        arcPath(g, zone.x, zone.y, zone.radius - 6, a0, a0 + 0.32).stroke({ width: 3, color, alpha: 0.9 });
        pts.push(zone.x + Math.cos(a0) * (zone.radius * 0.72), zone.y + Math.sin(a0) * (zone.radius * 0.72));
      }
      if (pts.length === 12) {
        g.poly([pts[0], pts[1], pts[4], pts[5], pts[8], pts[9]]).stroke({ width: 1.8, color, alpha: 0.75 });
        g.poly([pts[2], pts[3], pts[6], pts[7], pts[10], pts[11]]).stroke({ width: 1.8, color: 0xffffff, alpha: 0.55 });
      }
      if (!reducedMotion && rich && frameCount % 5 === 0) {
        const a = Math.random() * TAU, r = Math.random() * zone.radius * 0.85;
        spawn({ x: zone.x + Math.cos(a) * r, y: zone.y + Math.sin(a) * r, vy: -48, texture: textures.spark, tint: color, scale: 0.7, scaleTo: 0.15, life: 0.45, alpha: 0.85 });
      }
    }
    const self = state.player;
    if (self.barrier > 0) {
      const half = (self.barrierArc ?? 2) / 2;
      arcPath(g, self.x, self.y - 16, self.barrierRadius ?? 64, self.barrierAngle - half, self.barrierAngle + half).stroke({ width: 7, color: 0xffe066, alpha: 0.85 });
    }
    for (const body of [self, ...state.rivals]) if (body.root > 0) g.ellipse(body.x, body.y, 30, 12).stroke({ width: 4, color: 0xc8f4ff, alpha: 0.9 });
    for (const scan of state.scans) {
      if (scan.telegraph <= 0) continue;
      const p = 1 - scan.telegraph / DATA_ARENA_SCAN.telegraph;
      const ex = scan.x + Math.cos(scan.angle) * DATA_ARENA_SCAN.length, ey = scan.y + Math.sin(scan.angle) * DATA_ARENA_SCAN.length;
      g.moveTo(scan.x, scan.y).lineTo(ex, ey).stroke({ width: 2 + p * 6, color: 0xff2f5a, alpha: 0.35 + 0.4 * p });
      const arc = scan.angle + scan.spin * 0.45;
      arcPath(g, scan.x, scan.y, 220, Math.min(scan.angle, arc), Math.max(scan.angle, arc)).stroke({ width: 4, color: 0xffd0da, alpha: 0.7 });
    }
    // Beacons: capture progress ring.
    for (const beacon of state.beacons) {
      if (!beacon.active) continue;
      if (beacon.captured) { g.circle(beacon.x, beacon.y, DATA_ARENA_BEACON.radius).stroke({ width: 6, color: 0x5affc8, alpha: 0.9 }); continue; }
      g.circle(beacon.x, beacon.y, DATA_ARENA_BEACON.radius).stroke({ width: 4, color: 0x5affc8, alpha: 0.35 + 0.25 * Math.sin(elapsed * 4) });
      if (beacon.progress > 0) arcPath(g, beacon.x, beacon.y, DATA_ARENA_BEACON.radius - 8, -Math.PI / 2, -Math.PI / 2 + beacon.progress * TAU).stroke({ width: 10, color: 0x5affc8, alpha: 0.95 });
      g.circle(beacon.x, beacon.y, 18).fill({ color: 0x5affc8, alpha: 0.6 + 0.3 * Math.sin(elapsed * 6) });
    }
    // Mate revive ring and ride reach hint.
    const mate = state.mate, player = state.player;
    if (mate.state === "DOWNED") {
      g.circle(mate.x, mate.y, 86).stroke({ width: 3, color: 0x8dffb0, alpha: 0.6 });
      if (mate.reviveProgress > 0) arcPath(g, mate.x, mate.y, 78, -Math.PI / 2, -Math.PI / 2 + mate.reviveProgress * TAU).stroke({ width: 8, color: 0x8dffb0 });
    } else if (player.state === "NORMAL" && mate.state === "FOLLOW" && Math.hypot(player.x - mate.x, player.y - mate.y) < 120) {
      g.ellipse(mate.x, mate.y, 44, 18).stroke({ width: 3, color: 0x7fe9ff, alpha: 0.4 + 0.3 * Math.sin(elapsed * 6) });
    }
    if (mate.surgeAim) {
      g.moveTo(mate.x, mate.y).lineTo(mate.surgeAim.x, mate.surgeAim.y).stroke({ width: 4, color: 0x7fe9ff, alpha: 0.6 });
      g.circle(mate.surgeAim.x, mate.surgeAim.y, 40).stroke({ width: 3, color: 0x7fe9ff, alpha: 0.8 });
    }
  }

  function updateIndicators(viewport) {
    let n = 0;
    const margin = 34;
    const pointTo = (x, y, tint, size = 1) => {
      const sx = view.x + x * view.zoom, sy = view.y + y * view.zoom;
      if (sx > margin && sx < viewport.width - margin && sy > margin + 40 && sy < viewport.height - margin) return;
      const cx = viewport.width / 2, cy = viewport.height / 2, angle = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(sx, margin, viewport.width - margin), ey = clamp(sy, margin + 46, viewport.height - margin - 90);
      const arrow = arrowAt(n++);
      arrow.position.set(ex, ey); arrow.rotation = angle; arrow.tint = tint; arrow.scale.set(size * (0.9 + 0.1 * Math.sin(elapsed * 6)));
    };
    for (const beacon of state.beacons) if (beacon.active && !beacon.captured) pointTo(beacon.x, beacon.y, 0x5affc8);
    for (const core of state.cores) if (!core.out) pointTo(core.x, core.y, 0xff8a2a);
    if (state.boss && state.boss.state !== "DOWN") pointTo(state.boss.x, state.boss.y, 0xff4a6a, 1.3);
    for (const rival of state.rivals) if (rival.hp > 0) pointTo(rival.x, rival.y, 0xff6a8a, 1.2);
    if (state.mate.state === "DOWNED") pointTo(state.mate.x, state.mate.y, 0x8dffb0);
    for (; n < arrows.length; n++) arrows[n].visible = false;
  }

  function worldToScreen(x, y) {
    if (!view) return { x: 0, y: 0 };
    return { x: view.x + x * view.zoom, y: view.y + y * view.zoom };
  }
  function screenToWorld(x, y) {
    if (!view) return { x, y };
    return { x: (x - view.x) / view.zoom, y: (y - view.y) / view.zoom };
  }

  let disposed = false;
  return Object.freeze({
    render,
    handleEvents,
    worldToScreen,
    screenToWorld,
    floatText,
    damageNumber,
    setShake(enabled) { camera.setShake(enabled); },
    setAimGuide(guide) { aimGuide = guide; },
    getDiagnostics() {
      const sorted = [...fpsWindow].sort((a, b) => a - b);
      return {
        renderer: "CHAMPIONSHIP_SINGLE_PIXI_STAGE", scene: "DATA_ARENA", quality, reducedMotion, hasCreatureArt: playerView.hasArt,
        environment: environmentView?.diagnostics() ?? null,
        interactions:interactionView.diagnostics(),elementFx:elementFx?.getDiagnostics() ?? null,hitStop,effectsElapsed:elapsed, playerAnimation: playerView.diagnostics(),
        rivalAnimations: [...rivalViews.values()].map(view => view.diagnostics()),
        particleAgeTotal:live.reduce((n,p)=>n+p.age,0),scorchSprites:[...decalSprites.values()].filter(d=>d.kind!=="wet").length,
        fireMotion:[...fireSprites].slice(0,8).map(([cell,s])=>({cell,x:s.scale.x,y:s.scale.y,frame:textures.flame.indexOf(s.texture)})),
        playerDrawIndex: objects.children.indexOf(playerView.container),
        particles: live.length, particlePeak, particleCap: cap, fireSprites: fireSprites.size, iceSprites: iceSprites.size,
        groundChunks: chunks.length, groundBakeScale: bakeScale, enemyViews: enemyViews.size, shotViews: shotViews.size, pooledShots: shotPool.length, fans: fans.length,
        frameMsMedian: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
        frameMsP95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null,
        zoom: view?.zoom ?? null, camera: view ? { x: view.centerX, y: view.centerY } : null
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unmark();
      unsubscribeRestore();
      root.parent?.removeChild(root);
      // Character sprites come from their bundles; destroy display objects only,
      // the bundles' textures are released by their owner (the screen).
      environment?.detach?.();
      root.destroy({ children: true, texture: false, textureSource: false });
      for (const sprite of [...pool, ...cellPool]) if (!sprite.destroyed) sprite.destroy();
      for (const entry of [...shotPool, ...enemyPool]) for (const part of Object.values(entry)) if (part?.destroy && !part.destroyed) part.destroy();
      for (const chunk of chunks) chunk.texture.destroy(true);
      ground.destroy();
      textures.destroy();
      live.length = 0; pool.length = 0; cellPool.length = 0; fans.length = 0;
    }
  });
  } catch (error) {
    for (const release of rollback.reverse()) {
      try { release(); } catch (cleanupError) { console.error("DATA_ARENA_SCENE_CLEANUP_FAILED", cleanupError); }
    }
    throw error;
  }
}
