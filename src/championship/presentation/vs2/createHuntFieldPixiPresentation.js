// VS2 -- Hunt field scene on the single Championship Pixi stage.
//
// The world is 2048x2048 px and the viewport is roughly 390x780. This module
// renders a CAMERA WINDOW over that world: a world container translated by the
// camera origin, with modular terrain chunks built once and reused as they enter
// and leave view. The coordinate adapter preserves 256 native horizontal pixels
// while portrait height changes the camera window; it never fits the whole map.
//
// The logical grid stays hidden. Blocked tiles are drawn edge to edge so they
// merge into masses; open tiles are drawn not at all. There are no tile lines, no
// coordinate readout and no grid overlay.
//
// Every visual here is product-authored neutral technical art. No ROM pixel is
// loaded, and none of it is a claim about original terrain, props or creatures.

import { createHuntFieldPointer } from "./huntFieldPointer.js";
import { applyNativeCharacterCellGeometry } from '../nativeHuntCharacterAction.js';
import {huntTrapLayers} from '../huntFeedbackArt.js';
const ACTOR_BODY_RADIUS = 8;
const TEMPORARY_ART_ID = "art:hunt_field:vs2:temporary-signal-grove-kit";

const TERRAIN = Object.freeze({
  ground: 0x0b2930,
  groundLow: 0x0a222a,
  groundSignal: 0x2f6870,
  blocked: 0x17252a,
  blockedLift: 0x294048,
  blockedEdge: 0x3b6065,
  cyan: 0x65b8c3,
  gold: 0xd2ad5d
});

function hash01(x, y, salt = 0) {
  let value = Math.imul(x + 0x9e3779b9, 0x85ebca6b)
    ^ Math.imul(y + 0xc2b2ae35, 0x27d4eb2f)
    ^ Math.imul(salt + 17, 0x165667b1);
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d);
  value ^= value >>> 12;
  return (value >>> 0) / 0xffffffff;
}

function assertDependencies(stage, source) {
  if (!stage || !stage.PIXI || !stage.app || typeof stage.createSceneRoot !== "function"
    || typeof stage.onResize !== "function") {
    throw new TypeError("The Hunt field requires the Championship Pixi stage");
  }
  if (!source || typeof source.field?.getView !== "function" || typeof source.field?.tick !== "function"
    || typeof source.intents?.panCamera !== "function"
    || typeof source.intents?.selectWildAt !== "function"
    || typeof source.intents?.abortEnclosureStroke !== "function") {
    throw new TypeError("The Hunt field requires the VS2 presentation source");
  }
}

/**
 * Mount the Hunt field scene.
 *
 * The caller owns DOM screen UI and has already attached the stage to a field
 * host. This module owns its own scene, its own pointer handlers and its own
 * ticker callback, and removes all three on dispose.
 */
export async function mountHuntFieldPixiPresentation({
  stage,
  source,
  fieldArt = null,
  feedbackArt = null,
  characterBundle = null,
  onActorFrame = null,
  onFallback = () => {}
}) {
  assertDependencies(stage, source);
  const { PIXI, app } = stage;

  if (fieldArt !== null && (!fieldArt.displayObject || typeof fieldArt.update !== "function"
    || typeof fieldArt.dispose !== "function" || typeof fieldArt.getDiagnostics !== "function")) {
    throw new TypeError("The Hunt field art binding must be a loaded runtime map-art field");
  }

  const scene = stage.createSceneRoot("VS2 Hunt field");
  const unmarkScene = stage.markScene("cm-hunt-pixi-canvas");
  const backdrop = new PIXI.Graphics();
  const world = new PIXI.Container({ label: "hunt world" });
  const productionArtLayer = new PIXI.Container({ label: "bounded production map art" });
  const terrainLayer = new PIXI.Container({ label: "modular terrain" });
  const objectLayer = new PIXI.Container({ label: "field objects", sortableChildren: true });
  const actorLayer = new PIXI.Container({ label: "actors" });
  const strokeLayer = new PIXI.Container({ label: "enclosure stroke" });
  actorLayer.sortableChildren = true;
  const strokeGraphic = new PIXI.Graphics();
  const toolGraphic = new PIXI.Graphics();
  const nativeTools = new PIXI.Container({label:'native tool feedback'});
  const toolSprites=[];
  const flashGraphic = new PIXI.Graphics();
  // Technical tool feedback; native rules and geometry never read these glyphs.
  strokeLayer.addChild(toolGraphic);
  strokeLayer.addChild(nativeTools);
  strokeLayer.addChild(strokeGraphic);
  if (fieldArt) productionArtLayer.addChild(fieldArt.displayObject);
  world.addChild(productionArtLayer, terrainLayer, objectLayer, actorLayer, strokeLayer);
  scene.addChild(backdrop, world, flashGraphic);

  const chunkCache = new Map();
  const liveChunks = new Set();
  const objectNodes = new Map();
  const wildNodes = new Map();
  let playerNode = null;
  let disposed = false;
  let lastGateId = null;
  let backdropWidth = 0;
  let backdropHeight = 0;
  let characterAssetFailures = 0;
  if (characterBundle !== null && (typeof characterBundle.createActor !== "function"
    || typeof characterBundle.dispose !== "function" || typeof characterBundle.getDiagnostics !== "function")) {
    characterAssetFailures += 1;
    throw new TypeError("Hunt character art must be an injected runtime bundle");
  }

  function chunkKey(chunkX, chunkY) {
    return `${chunkX},${chunkY}`;
  }

  /**
   * Build one terrain chunk once and keep it.
   *
   * A chunk is 16x16 tiles. Re-drawing visible terrain every frame would be the
   * expensive way to render a field that does not change.
   */
  function buildChunk(view, bounds) {
    const graphic = new PIXI.Graphics();
    graphic.label = `chunk ${bounds.chunkX},${bounds.chunkY}`;
    const tile = view.tileSizePx;
    // One ground material across every chunk. Decorative marks are keyed from
    // global tile coordinates rather than chunk identity, so streaming never
    // exposes a 16x16 seam or logical grid.
    graphic
      .rect(bounds.leftPx, bounds.topPx, bounds.rightPx - bounds.leftPx, bounds.bottomPx - bounds.topPx)
      .fill(TERRAIN.ground);

    for (let tileY = bounds.startTileY; tileY < bounds.endTileYExclusive; tileY += 1) {
      for (let tileX = bounds.startTileX; tileX < bounds.endTileXExclusive; tileX += 1) {
        const blocked = view.isBlockedTile(tileX, tileY);
        const left = tileX * tile;
        const top = tileY * tile;
        if (!blocked) {
          const grain = hash01(tileX, tileY, 3);
          if (grain > 0.91) {
            const offsetX = 3 + hash01(tileX, tileY, 5) * (tile - 6);
            const offsetY = 3 + hash01(tileX, tileY, 7) * (tile - 6);
            graphic
              .ellipse(left + offsetX, top + offsetY, 2.6, 1.1)
              .fill({ color: TERRAIN.groundSignal, alpha: 0.34 });
          } else if (grain < 0.035) {
            const startX = left + 3 + hash01(tileX, tileY, 11) * 5;
            const startY = top + 5 + hash01(tileX, tileY, 13) * 6;
            graphic
              .moveTo(startX, startY)
              .lineTo(startX + 5, startY - 2)
              .stroke({ color: TERRAIN.groundSignal, alpha: 0.24, width: 1, cap: "round" });
          }
          continue;
        }
        // Edge to edge, no stroke: adjacent blocked tiles merge into one mass
        // instead of reading as a grid of cells.
        graphic.rect(left, top, tile, tile).fill(TERRAIN.blocked);
        if (hash01(tileX, tileY, 19) > 0.62) {
          graphic
            .circle(left + tile * 0.5, top + tile * 0.5, tile * 0.58)
            .fill({ color: TERRAIN.blockedLift, alpha: 0.42 });
        }

        // Only the OUTER silhouette is accented. Internal tile edges are never
        // stroked, so the collision grid remains hidden.
        if (!view.isBlockedTile(tileX, tileY - 1)) {
          graphic.moveTo(left, top).lineTo(left + tile, top).stroke({ color: TERRAIN.blockedEdge, alpha: 0.7, width: 1.5 });
        }
        if (!view.isBlockedTile(tileX + 1, tileY)) {
          graphic.moveTo(left + tile, top).lineTo(left + tile, top + tile).stroke({ color: TERRAIN.blockedEdge, alpha: 0.46, width: 1 });
        }
        if (!view.isBlockedTile(tileX, tileY + 1)) {
          graphic.moveTo(left, top + tile).lineTo(left + tile, top + tile).stroke({ color: 0x07161d, alpha: 0.72, width: 2 });
        }
      }
    }
    return graphic;
  }

  function syncTerrain(view) {
    const wanted = new Set();
    for (const bounds of view.visibleChunks) {
      const key = chunkKey(bounds.chunkX, bounds.chunkY);
      wanted.add(key);
      if (liveChunks.has(key)) continue;
      let graphic = chunkCache.get(key);
      if (!graphic) {
        graphic = buildChunk(view, bounds);
        chunkCache.set(key, graphic);
      }
      terrainLayer.addChild(graphic);
      liveChunks.add(key);
    }
    for (const key of [...liveChunks]) {
      if (wanted.has(key)) continue;
      const graphic = chunkCache.get(key);
      if (graphic?.parent) graphic.parent.removeChild(graphic);
      liveChunks.delete(key);
    }
  }

  /** Original-created temporary scenery. It owns no collision meaning. */
  function createObjectNode(entry) {
    const node = new PIXI.Container({ label: "original-created temporary field scenery" });
    const shadow = new PIXI.Graphics().ellipse(0, 3, 12, 4).fill({ color: 0x02070a, alpha: 0.42 });
    const base = new PIXI.Graphics()
      .ellipse(-3, -2, 8, 5).fill(TERRAIN.blockedLift)
      .ellipse(5, -1, 7, 4).fill(0x20373d)
      .ellipse(0, -6, 6, 8).fill(0x315158).stroke({ color: 0x172d34, width: 1 });
    const growth = new PIXI.Graphics()
      .moveTo(-5, -7).quadraticCurveTo(-10, -15, -4, -21).stroke({ color: TERRAIN.cyan, alpha: 0.72, width: 1.4, cap: "round" })
      .moveTo(1, -10).quadraticCurveTo(7, -18, 5, -25).stroke({ color: 0x4f8f91, alpha: 0.66, width: 1.2, cap: "round" })
      .circle(-4, -21, 2).fill({ color: TERRAIN.gold, alpha: 0.82 })
      .circle(5, -25, 1.8).fill({ color: TERRAIN.cyan, alpha: 0.72 });
    node.addChild(shadow, base, growth);
    node.position.set(entry.worldX, entry.worldY);
    node.zIndex = Math.round(entry.worldY);
    return node;
  }

  /** Original-created temporary creature marker. Not final creature art. */
  function createActorNode(tint, label, { player = false, speciesId = null } = {}) {
    const node = new PIXI.Container({ label });
    const shadow = new PIXI.Graphics().ellipse(0, 4, 11, 4).fill({ color: 0x02070a, alpha: 0.48 });
    const ring = new PIXI.Graphics()
      .ellipse(0, 3, 13, 6)
      .stroke({ color: player ? TERRAIN.gold : TERRAIN.cyan, alpha: player ? 0.72 : 0.16, width: 1.2 });
    const body = new PIXI.Graphics()
      .poly([-6, -13, -3, -21, 1, -14]).fill(tint).stroke({ color: 0x101820, width: 1 })
      .poly([2, -14, 6, -21, 8, -12]).fill(tint).stroke({ color: 0x101820, width: 1 })
      .ellipse(-1, -7, ACTOR_BODY_RADIUS, ACTOR_BODY_RADIUS - 1).fill(tint).stroke({ color: 0x101820, width: 1.4 })
      .circle(3, -14, 5).fill(tint).stroke({ color: 0x101820, width: 1.4 })
      .moveTo(-7, -7).quadraticCurveTo(-14, -11, -12, -2).stroke({ color: tint, width: 3, cap: "round" })
      .circle(5, -15, 1).fill(0x071016)
      .poly([-3, -9, 0, -12, 3, -9, 0, -6]).fill(player ? TERRAIN.gold : TERRAIN.cyan);
    node.addChild(shadow, ring, body);
    if (characterBundle) {
      const actor = characterBundle.createActor({ speciesId, side: "main", presentation: "hunt" });
      if (actor) {
        actor.sprite.scale.set(0.18);
        body.visible = false;
        node.addChild(actor.sprite);
        node.characterController = actor.controller;
        node.nativeFramePresenter = actor.nativeFramePresenter ?? null;
        node.characterSprite = actor.sprite;
        node.lastCharacterX = null;
        node.lastCharacterY = null;
      }
    }
    node.body = body;
    node.ring = ring;
    return node;
  }

  function syncObjects(view) {
    if (lastGateId !== view.gateId) {
      // A different gate is a different world: drop every cached world node.
      for (const graphic of chunkCache.values()) graphic.destroy();
      chunkCache.clear();
      liveChunks.clear();
      terrainLayer.removeChildren();
      for (const node of objectNodes.values()) node.destroy();
      objectNodes.clear();
      objectLayer.removeChildren();
      lastGateId = view.gateId;
    }
    for (const entry of view.objects) {
      if (objectNodes.has(entry.objectId)) continue;
      const node = createObjectNode(entry);
      objectNodes.set(entry.objectId, node);
      objectLayer.addChild(node);
    }
  }

  function syncActors(view) {
    if (!playerNode) {
      playerNode = createActorNode(0xe7c36f, "companion", { player: true });
      actorLayer.addChild(playerNode);
      playerNode.visible = false; // The original field pan has no walking avatar.
    }
    const playerMoved = playerNode.lastCharacterX !== null
      && (playerNode.lastCharacterX !== view.player.worldX || playerNode.lastCharacterY !== view.player.worldY);
    playerNode.characterController?.setAnimation(playerMoved ? "walk" : "idle", { restart: false });
    playerNode.position.set(view.player.worldX, view.player.worldY);
    playerNode.lastCharacterX = view.player.worldX;
    playerNode.lastCharacterY = view.player.worldY;
    playerNode.zIndex = Math.round(view.player.worldY);
    playerNode.scale.x = view.player.facing === "left" ? -1 : 1;

    const live = new Set(view.wildCreatures.map((wild) => wild.wildId));
    for (const [wildId, node] of wildNodes) {
      if (live.has(wildId)) continue;
      actorLayer.removeChild(node);
      node.destroy({ children: true });
      wildNodes.delete(wildId);
    }
    for (const wild of view.wildCreatures) {
      let node = wildNodes.get(wild.wildId);
      if (!node) {
        node = createActorNode(0x71879b, "wild creature", { speciesId: wild.speciesId });
        wildNodes.set(wild.wildId, node);
        actorLayer.addChild(node);
      }
      node.position.set(wild.worldX, wild.worldY - (wild.worldZ ?? 0));
      node.zIndex = Math.round(wild.worldY);
      const nativeFrame = node.nativeFramePresenter?.apply(wild.nativeAnimation ?? null);
      if (node.characterSprite) applyNativeCharacterCellGeometry(node.characterSprite,nativeFrame,2);
      node.scale.x = nativeFrame ? (nativeFrame.flipX ? -1 : 1) : (wild.facing === "left" ? -1 : 1);
      node.scale.y = nativeFrame?.flipY ? -1 : 1;
      const tethered = view.selectedWildId === wild.wildId;
      node.ring.clear()
        .ellipse(0, 3, 13, 6)
        .stroke({ color: tethered ? TERRAIN.gold : TERRAIN.cyan, alpha: tethered ? 0.9 : 0.16, width: tethered ? 2 : 1.2 });
    }
  }

  function syncEnclosure(view) {
    let nativeCount=0;
    for(const sprite of toolSprites)sprite.visible=false;
    strokeGraphic.clear();
    toolGraphic.clear();flashGraphic.clear();
    if(view.tools){
      for(const o of (view.tools.objects??[]).flatMap(huntTrapLayers)){
        if(o.visible===false)continue;
        const frame=feedbackArt?.getFrame(o);
        if(frame){
          const sprite=toolSprites[nativeCount]??new PIXI.Sprite(frame.texture);
          if(!toolSprites[nativeCount]){toolSprites.push(sprite);nativeTools.addChild(sprite);}
          nativeCount++;sprite.texture=frame.texture;sprite.anchor.set(frame.origin[0]/frame.width,frame.origin[1]/frame.height);
          sprite.scale.set(2);sprite.position.set(o.x,o.y);sprite.visible=true;continue;
        }
        const g=toolGraphic,x=o.x,y=o.y;
        if(o.kind==='WIRE'){
          const color=o.state===5?([0x53ced6,0x53ced6,0xaf85ee,0xaf85ee,0xffe36c,0xffe36c][o.itemIndex]):o.valid?0x6cd9ba:0xf08a74;
          g.moveTo(...o.from).lineTo(...o.to).stroke({color,width:3});
          for(const p of [o.from,o.to])g.circle(...p,4).fill(0xfff4d2).stroke({color,width:2});
        }else if(o.kind==='MEAT'){
          g.ellipse(x,y+2,12,4).fill({color:0x153b3d,alpha:.2});
          g.moveTo(x-9,y+4).lineTo(x+9,y-4).stroke({color:0xfff4d5,width:5});
          g.ellipse(x,y-2,7+o.tier,6+o.tier).fill([0xdc9162,0xdc9162,0xa684c5,0x7daecc][o.itemIndex]).stroke({color:0x6b4944,width:1});
        }else if(o.kind==='DECOY'){
          g.circle(x,y,10).fill({color:0xf3bb62,alpha:o.state===1?.5:1}).stroke({color:0x855b32,width:2});
          g.circle(x-4,y-2,2).circle(x+4,y-2,2).fill(0x40555e);
          g.moveTo(x-5,y+6).lineTo(x+5,y+6).stroke({color:0x40555e,width:2});
        }else if(o.kind==='LIGHT'){
          g.circle(x,y-9,18).fill({color:0xffec86,alpha:.18});
          g.roundRect(x-7,y-20,14,18,4).fill(0xfff29b).stroke({color:0x5294a8,width:2});
          g.moveTo(x,y-1).lineTo(x,y+9).stroke({color:0x528294,width:4});
        }else if(o.kind==='CAPTURE_TRAP'){
          g.ellipse(x,y,20,11).fill({color:0x79dcdb,alpha:.2}).stroke({color:0x6fc5d9,width:3});
          if(o.triggered)g.roundRect(x-18,y-27,36,34,6).stroke({color:0xffe58e,width:3});
        }else if(o.kind==='BOMB'||o.kind==='MINE'){
          g.ellipse(x,y,12,7).fill(o.kind==='MINE'?0x789aa3:0x708298).stroke({color:0xe9ddb0,width:2});
          g.circle(x,y-5,3).fill(o.state===4?0xff8568:0xfadd71);
        }else if(o.kind==='SHOT_IMPACT'||o.kind==='TOOL_BURST'){
          const r=o.kind==='SHOT_IMPACT'?12:o.sequence===3?24:10;
          g.star(x,y,6,r,r*.4).fill({color:0xffdd80,alpha:Math.min(1,o.remaining/8)});
          g.star(x,y,6,r*.55,r*.2).fill({color:0xfff8d3,alpha:Math.min(1,o.remaining/8)});
        }else if(o.kind==='FLASH')flashGraphic.rect(0,0,app.screen.width,app.screen.height).fill({color:0xffffe6,alpha:o.alpha});
      }
      for(const p of view.tools.points)strokeGraphic.star(p.x,p.y,4,4,1.5).fill(0xf8db69);
      const closure=view.tools.closure;
      if(closure)strokeGraphic.ellipse(closure.x,closure.y,48,32).stroke({color:0xffe884,width:4,alpha:Math.max(.2,closure.ticks/18)});
      const rope=view.tools.rope;
      if(rope){
        const color=rope.band==="STRONG"?0xf2ab45:0xffed96;
        strokeGraphic.moveTo(...rope.from).lineTo(...rope.to).stroke({color,width:3,cap:"round"});
      }
      return;
    }
    const points = view.enclosure?.points;
    if (!Array.isArray(points) || points.length === 0) return;
    strokeGraphic.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      strokeGraphic.lineTo(points[index].x, points[index].y);
    }
    strokeGraphic.stroke({ color: TERRAIN.cyan, width: 3, cap: "round", join: "round", alpha: 0.92 });
  }

  function render() {
    if (disposed) return;
    const view = source.field.getView({
      viewportWidth: app.screen.width,
      viewportHeight: app.screen.height
    });
    if (!view) return;

    if (fieldArt) {
      const art = fieldArt.getDiagnostics();
      if (art.worldWidthPx !== view.worldWidthPx || art.worldHeightPx !== view.worldHeightPx) {
        throw new RangeError(`Hunt field art/world mismatch: ${art.fieldId}`);
      }
    }

    if (backdropWidth !== app.screen.width || backdropHeight !== app.screen.height) {
      backdropWidth = app.screen.width;
      backdropHeight = app.screen.height;
      backdrop
        .clear()
        .rect(0, 0, backdropWidth, backdropHeight).fill(TERRAIN.groundLow)
        .ellipse(backdropWidth * 0.2, backdropHeight * 0.12, backdropWidth * 0.7, backdropHeight * 0.38)
        .fill({ color: TERRAIN.cyan, alpha: 0.035 });
    }
    // A complete production composite already contains original terrain and
    // static object art. The procedural layers remain the honest fallback only;
    // drawing both would duplicate props and expose mismatched silhouettes.
    if (fieldArt) {
      terrainLayer.visible = false;
      objectLayer.visible = false;
    } else {
      terrainLayer.visible = true;
      objectLayer.visible = true;
      syncObjects(view);
      syncTerrain(view);
    }
    syncActors(view);
    syncEnclosure(view);
    // The camera window is the only thing that moves the world.
    world.scale.set(view.transform.scale);
    world.position.set(-view.camera.left * view.transform.scale, -view.camera.top * view.transform.scale);
    if(onActorFrame)onActorFrame(view.wildCreatures.map(wild=>({wildId:wild.wildId,
      x:(wild.worldX-view.camera.left)*view.transform.scale,y:(wild.worldY-view.camera.top)*view.transform.scale,
      state:wild.state??null,moving:wild.moving===true,currentHp:wild.currentHp??null,maxHp:wild.maxHp??null})),view.tools);
  }

  const pointer = createHuntFieldPointer({
    getView: () => source.field.getView({ viewportWidth: app.screen.width, viewportHeight: app.screen.height }),
    intents: source.intents
  });
  const onPointerDown = (event) => pointer.down(event);
  const onPointerMove = (event) => pointer.move(event);
  const onPointerUp = (event) => pointer.up(event);
  const onPointerCancel = (event) => pointer.cancel(event);
  const cancelPointer = () => pointer.cancel();
  const cancelHiddenPointer = () => { if (globalThis.document?.hidden) cancelPointer(); };
  globalThis.addEventListener?.("blur", cancelPointer);
  globalThis.document?.addEventListener("visibilitychange", cancelHiddenPointer);

  function advance(ticker) {
    if (disposed) return;
    source.field.tick(ticker.deltaMS);
    if (disposed) return;
    fieldArt?.update(ticker.deltaMS);
    render();
    playerNode?.characterController?.update(ticker);
    for (const node of wildNodes.values()) node.characterController?.update(ticker);
  }

  app.stage.on("pointerdown", onPointerDown);
  app.stage.on("globalpointermove", onPointerMove);
  app.stage.on("pointerup", onPointerUp);
  app.stage.on("pointerupoutside", onPointerUp);
  app.stage.on("pointercancel", onPointerCancel);
  app.ticker.add(advance);

  const unobserveResize = stage.onResize(() => { cancelPointer(); render(); });
  const unobserveContextLost = stage.onContextLost(() => {
    cancelPointer();
    onFallback("The 2D field context was lost. Screen controls remain available; reload to restore the field.");
  });
  render();

  return Object.freeze({
    render() {
      // The DOM shell may ask for a repaint after its own update. The ticker is
      // authoritative; this is an idempotent sync.
      render();
    },

    getDiagnostics() {
      const view = source.field.getView({ viewportWidth: app.screen.width, viewportHeight: app.screen.height });
      return Object.freeze({
        renderer: "PIXI_SCENE_ON_SHARED_STAGE",
        applicationCount: 1,
        ticker: "APPLICATION_OWNED",
        threeUsed: false,
        gateId: view?.gateId ?? null,
        worldWidthPx: view?.worldWidthPx ?? null,
        worldHeightPx: view?.worldHeightPx ?? null,
        cachedChunks: chunkCache.size,
        visibleChunks: liveChunks.size,
        wildCount: wildNodes.size,
        camera: view?.camera ?? null,
        transform: view?.transform ?? null,
        // Where the live actors are on this canvas, in its own pixels. The
        // native controller owns their positions and moves them every frame, so
        // they cannot be recomputed from the gate's spawn table by anything
        // outside the running field -- which is what left the VS3 capture gate
        // unable to point at a creature at all.
        // Same camera-and-scale placement the world container is given below,
        // written out rather than imported: this renderer consumes the published
        // view and its one pointer adapter, never the Hunt domain.
        wildScreenPositions: Object.freeze((view?.wildCreatures ?? []).map((wild) => Object.freeze({
          wildId: wild.wildId,
          x: (wild.worldX - view.camera.left) * view.transform.scale,
          y: (wild.worldY - view.camera.top) * view.transform.scale,
          state: wild.state ?? null, moving: wild.moving === true,
          currentHp: wild.currentHp ?? null, maxHp: wild.maxHp ?? null
        }))),
        selectedWildId: view?.selectedWildId ?? null,
        captureAvailability: view?.captureAvailability ?? null,
        activePointerId: pointer.getOwner(),
        objectCount: objectNodes.size,
        characterAssetFailures,
        characterArt: characterBundle?.getDiagnostics() ?? null,
        nativeCharacterFrames: [...wildNodes.entries()].flatMap(([wildId, node]) => {
          const frame = node.nativeFramePresenter?.getSnapshot();
          return frame ? [{ wildId, ...frame }] : [];
        }),
        viewport: Object.freeze({ width: app.screen.width, height: app.screen.height }),
        art: fieldArt?.getDiagnostics() ?? Object.freeze({
          assetId: TEMPORARY_ART_ID,
          role: "PROCEDURAL_FALLBACK"
        })
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelPointer();
      globalThis.removeEventListener?.("blur", cancelPointer);
      globalThis.document?.removeEventListener("visibilitychange", cancelHiddenPointer);
      unmarkScene();
      unobserveResize();
      unobserveContextLost();
      app.ticker.remove(advance);
      app.stage.off("pointerdown", onPointerDown);
      app.stage.off("globalpointermove", onPointerMove);
      app.stage.off("pointerup", onPointerUp);
      app.stage.off("pointerupoutside", onPointerUp);
      app.stage.off("pointercancel", onPointerCancel);
      for (const graphic of chunkCache.values()) graphic.destroy();
      chunkCache.clear();
      liveChunks.clear();
      objectNodes.clear();
      wildNodes.clear();
      playerNode = null;
      if (fieldArt?.displayObject.parent === productionArtLayer) {
        productionArtLayer.removeChild(fieldArt.displayObject);
      }
      if (scene.parent) scene.parent.removeChild(scene);
      scene.destroy({ children: true });
      void fieldArt?.dispose();
      void feedbackArt?.dispose();
      void characterBundle?.dispose();
      characterBundle = null;
      // The Application belongs to the stage and outlives this scene.
    }
  });
}
