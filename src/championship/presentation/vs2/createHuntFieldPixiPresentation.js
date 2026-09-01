// VS2 -- Hunt field scene on the single Championship Pixi stage.
//
// The world is 2048x2048 px and the viewport is roughly 390x780. This module
// renders a CAMERA WINDOW over that world: a world container translated by the
// camera origin, with modular terrain chunks built once and reused as they enter
// and leave view. It never scales the world down to fit a screen, because the
// large modular field is the preserved structure.
//
// The logical grid stays hidden. Blocked tiles are drawn edge to edge so they
// merge into masses; open tiles are drawn not at all. There are no tile lines, no
// coordinate readout and no grid overlay.
//
// Every visual here is product-authored neutral technical art. No ROM pixel is
// loaded, and none of it is a claim about original terrain, props or creatures.

const DRAG_THRESHOLD_PX = 5;
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
    || typeof source.intents?.moveTo !== "function") {
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
  characterBundle = null,
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
  strokeLayer.addChild(strokeGraphic);
  if (fieldArt) productionArtLayer.addChild(fieldArt.displayObject);
  world.addChild(productionArtLayer, terrainLayer, objectLayer, actorLayer, strokeLayer);
  scene.addChild(backdrop, world);

  const chunkCache = new Map();
  const liveChunks = new Set();
  const objectNodes = new Map();
  const wildNodes = new Map();
  let playerNode = null;
  let disposed = false;
  let drag = null;
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
  function createActorNode(tint, label, { player = false } = {}) {
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
      const actor = characterBundle.createActor({ side: "main", animation: "idle" });
      actor.sprite.scale.set(0.18);
      body.visible = false;
      node.addChild(actor.sprite);
      node.characterController = actor.controller;
      node.lastCharacterX = null;
      node.lastCharacterY = null;
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
        node = createActorNode(0x71879b, "wild creature");
        wildNodes.set(wild.wildId, node);
        actorLayer.addChild(node);
      }
      node.position.set(wild.worldX, wild.worldY);
      node.zIndex = Math.round(wild.worldY);
      node.scale.x = wild.facing === "left" ? -1 : 1;
      const tethered = view.enclosure?.targetWildId === wild.wildId;
      node.ring.clear()
        .ellipse(0, 3, 13, 6)
        .stroke({ color: tethered ? TERRAIN.gold : TERRAIN.cyan, alpha: tethered ? 0.9 : 0.16, width: tethered ? 2 : 1.2 });
    }
  }

  function syncEnclosure(view) {
    strokeGraphic.clear();
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
    world.position.set(-view.camera.left, -view.camera.top);
  }

  function toWorldPoint(global) {
    const view = source.field.getView({
      viewportWidth: app.screen.width,
      viewportHeight: app.screen.height
    });
    if (!view) return null;
    return { x: global.x + view.camera.left, y: global.y + view.camera.top };
  }

  function canEnclose() {
    return typeof source.intents.beginEnclosureStroke === "function"
      && typeof source.intents.extendEnclosureStroke === "function"
      && typeof source.intents.endEnclosureStroke === "function";
  }

  function onPointerDown(event) {
    if (disposed) return;
    const point = toWorldPoint(event.global);
    const enclosing = Boolean(point && canEnclose() && source.intents.beginEnclosureStroke(point.x, point.y));
    drag = {
      pointerId: event.pointerId,
      startX: event.global.x,
      startY: event.global.y,
      moved: false,
      enclosing
    };
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      drag.moved = Math.hypot(event.global.x - drag.startX, event.global.y - drag.startY) >= DRAG_THRESHOLD_PX;
    }
    const point = toWorldPoint(event.global);
    if (drag.enclosing) {
      if (point) source.intents.extendEnclosureStroke(point.x, point.y);
      return;
    }
    if (drag.moved && point) source.intents.moveTo(point.x, point.y);
  }

  function onPointerUp(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const completed = drag;
    drag = null;
    if (completed.enclosing) {
      source.intents.endEnclosureStroke();
      return;
    }
    if (completed.moved) return;
    const point = toWorldPoint(event.global ?? { x: completed.startX, y: completed.startY });
    if (point) source.intents.moveTo(point.x, point.y);
  }

  function advance(ticker) {
    if (disposed) return;
    source.field.tick(ticker.deltaMS);
    fieldArt?.update(ticker.deltaMS);
    render();
    playerNode?.characterController?.update(ticker);
    for (const node of wildNodes.values()) node.characterController?.update(ticker);
  }

  app.stage.on("pointerdown", onPointerDown);
  app.stage.on("globalpointermove", onPointerMove);
  app.stage.on("pointerup", onPointerUp);
  app.stage.on("pointerupoutside", onPointerUp);
  app.stage.on("pointercancel", onPointerUp);
  app.ticker.add(advance);

  const unobserveResize = stage.onResize(render);
  const unobserveContextLost = stage.onContextLost(() => {
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
        objectCount: objectNodes.size,
        characterAssetFailures,
        characterArt: characterBundle?.getDiagnostics() ?? null,
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
      drag = null;
      unmarkScene();
      unobserveResize();
      unobserveContextLost();
      app.ticker.remove(advance);
      app.stage.off("pointerdown", onPointerDown);
      app.stage.off("globalpointermove", onPointerMove);
      app.stage.off("pointerup", onPointerUp);
      app.stage.off("pointerupoutside", onPointerUp);
      app.stage.off("pointercancel", onPointerUp);
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
      void characterBundle?.dispose();
      characterBundle = null;
      // The Application belongs to the stage and outlives this scene.
    }
  });
}
