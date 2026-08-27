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
const ACTOR_BODY_RADIUS = 7;

const TERRAIN = Object.freeze({
  ground: 0x16362f,
  blocked: 0x0a1a22
});

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
export async function mountHuntFieldPixiPresentation({ stage, source, onFallback = () => {} }) {
  assertDependencies(stage, source);
  const { PIXI, app } = stage;

  const scene = stage.createSceneRoot("VS2 Hunt field");
  const backdrop = new PIXI.Graphics();
  const world = new PIXI.Container({ label: "hunt world" });
  const terrainLayer = new PIXI.Container({ label: "modular terrain" });
  const objectLayer = new PIXI.Container({ label: "field objects" });
  const actorLayer = new PIXI.Container({ label: "actors" });
  actorLayer.sortableChildren = true;
  world.addChild(terrainLayer, objectLayer, actorLayer);
  scene.addChild(backdrop, world);

  const chunkCache = new Map();
  const liveChunks = new Set();
  const objectNodes = new Map();
  const wildNodes = new Map();
  let playerNode = null;
  let disposed = false;
  let drag = null;
  let lastGateId = null;

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
    // One ground colour across every chunk. Tinting alternate chunks made the
    // 16x16 streaming grid visible, which is the logical grid the contract says
    // stays hidden - a coarse grid overlay is still a grid overlay.
    graphic
      .rect(bounds.leftPx, bounds.topPx, bounds.rightPx - bounds.leftPx, bounds.bottomPx - bounds.topPx)
      .fill(TERRAIN.ground);

    for (let tileY = bounds.startTileY; tileY < bounds.endTileYExclusive; tileY += 1) {
      for (let tileX = bounds.startTileX; tileX < bounds.endTileXExclusive; tileX += 1) {
        if (!view.isBlockedTile(tileX, tileY)) continue;
        // Edge to edge, no stroke: adjacent blocked tiles merge into one mass
        // instead of reading as a grid of cells.
        graphic.rect(tileX * tile, tileY * tile, tile, tile).fill(TERRAIN.blocked);
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

  /** A neutral product-authored prop. Codex replaces this with Hunt art. */
  function createObjectNode(entry) {
    const graphic = new PIXI.Graphics()
      .ellipse(0, 2, 7, 3).fill({ color: 0x02070a, alpha: 0.4 })
      .poly([0, -16, 6, 0, -6, 0]).fill(0x2f6b4d).stroke({ color: 0x17402f, width: 1 });
    graphic.label = "original-created neutral field prop";
    graphic.position.set(entry.worldX, entry.worldY);
    return graphic;
  }

  /** A neutral product-authored creature body. Not original creature art. */
  function createActorNode(tint, label) {
    const node = new PIXI.Container({ label });
    const shadow = new PIXI.Graphics().ellipse(0, 3, 9, 4).fill({ color: 0x02070a, alpha: 0.42 });
    const body = new PIXI.Graphics()
      .ellipse(0, -6, ACTOR_BODY_RADIUS, ACTOR_BODY_RADIUS - 1).fill(tint).stroke({ color: 0x101727, width: 1.5 })
      .circle(4, -13, 4).fill(tint).stroke({ color: 0x101727, width: 1.5 })
      .circle(5, -14, 1).fill(0x0b1018);
    node.addChild(shadow, body);
    node.body = body;
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
      playerNode = createActorNode(0xf0d083, "companion");
      actorLayer.addChild(playerNode);
    }
    playerNode.position.set(view.player.worldX, view.player.worldY);
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
        node = createActorNode(0x72809c, "wild creature");
        wildNodes.set(wild.wildId, node);
        actorLayer.addChild(node);
      }
      node.position.set(wild.worldX, wild.worldY);
      node.zIndex = Math.round(wild.worldY);
      node.scale.x = wild.facing === "left" ? -1 : 1;
    }
  }

  function render() {
    if (disposed) return;
    const view = source.field.getView({
      viewportWidth: app.screen.width,
      viewportHeight: app.screen.height
    });
    if (!view) return;

    backdrop.clear().rect(0, 0, app.screen.width, app.screen.height).fill(0x061014);
    syncObjects(view);
    syncTerrain(view);
    syncActors(view);
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

  function onPointerDown(event) {
    if (disposed) return;
    drag = {
      pointerId: event.pointerId,
      startX: event.global.x,
      startY: event.global.y,
      moved: false
    };
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      drag.moved = Math.hypot(event.global.x - drag.startX, event.global.y - drag.startY) >= DRAG_THRESHOLD_PX;
    }
    // Dragging steers continuously; tapping commits once on release.
    if (drag.moved) {
      const point = toWorldPoint(event.global);
      if (point) source.intents.moveTo(point.x, point.y);
    }
  }

  function onPointerUp(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const completed = drag;
    drag = null;
    if (completed.moved) return;
    const point = toWorldPoint(event.global ?? { x: completed.startX, y: completed.startY });
    if (point) source.intents.moveTo(point.x, point.y);
  }

  function advance(ticker) {
    if (disposed) return;
    source.field.tick(ticker.deltaMS);
    render();
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
        viewport: Object.freeze({ width: app.screen.width, height: app.screen.height })
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      drag = null;
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
      if (scene.parent) scene.parent.removeChild(scene);
      scene.destroy({ children: true });
      // The Application belongs to the stage and outlives this scene.
    }
  });
}
