// INT-RH2 Raising field -- a scene on the single Championship Pixi stage.
//
// VS1 created its own Application here. VS2 needs a second playable field, and
// the product is allowed exactly one Pixi bootstrap, so the Application moved to
// championshipPixiStage.js and this module became a scene on it. The rendered
// result is unchanged; what changed is who owns the canvas.
//
// The scene may hold transient pointer and animation state, but never cage
// assignment, save data, gameplay values, routing, or another runtime store.

const DRAG_THRESHOLD_PX = 6;

function assertDependencies(stage, source) {
  if (!stage || !stage.PIXI || !stage.app || typeof stage.createSceneRoot !== "function"
    || typeof stage.onResize !== "function" || typeof stage.attach !== "function") {
    throw new TypeError("INT-RH2 requires the Championship Pixi stage");
  }
  if (!source || typeof source.getFrame !== "function" || typeof source.subscribe !== "function"
    || typeof source.intents?.selectCreature !== "function"
    || typeof source.intents?.relocateCreature !== "function") {
    throw new TypeError("INT-RH2 requires the Raising presentation source");
  }
}

function fallbackCreature(PIXI) {
  const graphic = new PIXI.Graphics()
    .ellipse(0, -10, 34, 26).fill(0x72809c).stroke({ color: 0x252d43, width: 3 })
    .circle(22, -30, 17).fill(0x72809c).stroke({ color: 0x252d43, width: 3 })
    .poly([11, -42, 18, -61, 28, -40]).fill(0xdce4ef).stroke({ color: 0x252d43, width: 2 })
    .circle(27, -32, 3).fill(0x101727);
  graphic.label = "original-created neutral resident fallback";
  return graphic;
}

async function parseGridSheet(PIXI, spec, cachePrefix) {
  const texture = await PIXI.Assets.load(spec.sheet);
  const width = Number(texture.source?.width ?? texture.width);
  const height = Number(texture.source?.height ?? texture.height);
  const frameWidth = width / spec.columns;
  const frameHeight = height / spec.rows;
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) {
    throw new Error(`CHAMPIONSHIP_SPRITESHEET_GRID_INVALID: ${spec.sheet}`);
  }
  const frames = {};
  const animation = [];
  for (let index = 0; index < spec.frames; index += 1) {
    const name = `frame-${String(index).padStart(2, "0")}`;
    frames[name] = {
      frame: {
        x: (index % spec.columns) * frameWidth,
        y: Math.floor(index / spec.columns) * frameHeight,
        w: frameWidth,
        h: frameHeight
      },
      sourceSize: { w: frameWidth, h: frameHeight },
      spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
      anchor: { x: 0.5, y: 1 }
    };
    animation.push(name);
  }
  const sheet = new PIXI.Spritesheet({
    texture,
    data: {
      frames,
      animations: { sequence: animation },
      meta: { image: spec.sheet, size: { w: width, h: height }, scale: "1" }
    },
    cachePrefix
  });
  await sheet.parse();
  return { sheet, textures: sheet.animations.sequence };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Mount the Raising field scene onto the single Championship Pixi stage.
 *
 * The caller owns DOM screen UI and has already attached the stage to a field
 * host inside it. This module owns only its own scene and returns a small
 * presentation port.
 */
export async function mountRaisingFieldPixiPresentation({
  stage,
  source,
  onFallback = () => {},
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
}) {
  assertDependencies(stage, source);
  const { PIXI, app } = stage;

  const scene = stage.createSceneRoot("INT-RH2 Raising field");
  const backgroundLayer = new PIXI.Container({ label: "background" });
  const terrainLayer = new PIXI.Container({ label: "terrain" });
  const propLayer = new PIXI.Container({ label: "props" });
  const actorLayer = new PIXI.Container({ label: "actors" });
  const foregroundLayer = new PIXI.Container({ label: "foreground occlusion" });
  const fxLayer = new PIXI.Container({ label: "fx and lighting" });
  actorLayer.sortableChildren = true;
  scene.addChild(backgroundLayer, terrainLayer, propLayer, actorLayer, foregroundLayer, fxLayer);

  const backdrop = new PIXI.Graphics();
  backgroundLayer.addChild(backdrop);
  const cageGraphics = new Map();
  const actors = new Map();
  const sheets = new Set();
  let disposed = false;
  let latestFrame = null;
  let latestRevision = -1;
  let drag = null;
  let assetFailures = 0;

  function cageBounds(cage) {
    return {
      x: cage.region.x * app.screen.width,
      y: cage.region.y * app.screen.height,
      width: cage.region.w * app.screen.width,
      height: cage.region.h * app.screen.height
    };
  }

  function drawField(frame) {
    backdrop.clear()
      .rect(0, 0, app.screen.width, app.screen.height).fill(0x071722)
      .circle(app.screen.width * 0.22, app.screen.height * 0.12, app.screen.width * 0.46)
      .fill({ color: 0x174b61, alpha: 0.24 });

    const liveCages = new Set(frame.cages.map((cage) => cage.cageId));
    for (const [cageId, graphic] of cageGraphics) {
      if (liveCages.has(cageId)) continue;
      terrainLayer.removeChild(graphic);
      graphic.destroy();
      cageGraphics.delete(cageId);
    }
    frame.cages.forEach((cage, index) => {
      let graphic = cageGraphics.get(cage.cageId);
      if (!graphic) {
        graphic = new PIXI.Graphics();
        graphic.label = cage.name;
        terrainLayer.addChild(graphic);
        cageGraphics.set(cage.cageId, graphic);
      }
      const bounds = cageBounds(cage);
      const color = index % 2 === 0 ? 0x2a7181 : 0x35694f;
      graphic.clear()
        .roundRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.min(28, bounds.height * 0.16))
        .fill({ color, alpha: 0.32 })
        .stroke({ color: 0x9ad9d2, width: 1.5, alpha: 0.34 });
    });
  }

  function actorPoint(resident) {
    const cage = latestFrame?.cages.find((entry) => entry.cageId === resident.cageId);
    if (!cage) return { x: app.screen.width / 2, y: app.screen.height / 2 };
    const bounds = cageBounds(cage);
    return {
      x: bounds.x + bounds.width * resident.lane.x,
      y: bounds.y + bounds.height * resident.lane.y
    };
  }

  function finishDrag(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const completed = drag;
    drag = null;
    completed.entry.root.cursor = "grab";
    const point = event.global ?? completed.lastPoint;
    if (completed.moved && point) {
      const target = latestFrame?.cages.find((cage) => {
        const bounds = cageBounds(cage);
        return point.x >= bounds.x && point.x <= bounds.x + bounds.width
          && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
      });
      if (target && target.cageId !== completed.originCageId) {
        source.intents.relocateCreature(completed.creatureId, target.cageId);
        return;
      }
    }
    sync(source.getFrame(), { force: true });
  }

  function attachActorInput(entry, creatureId) {
    entry.root.eventMode = "static";
    entry.root.cursor = "grab";
    entry.root.hitArea = new PIXI.Rectangle(-62, -124, 124, 132);
    entry.root.on("pointerdown", (event) => {
      if (disposed) return;
      event.stopPropagation();
      source.intents.selectCreature(creatureId);
      drag = {
        creatureId,
        entry,
        pointerId: event.pointerId,
        originCageId: source.getFrame().residents.find((resident) => resident.creatureId === creatureId)?.cageId ?? null,
        startPoint: { x: event.global.x, y: event.global.y },
        lastPoint: { x: event.global.x, y: event.global.y },
        moved: false
      };
      entry.root.cursor = "grabbing";
    });
  }

  function createActor(resident) {
    const root = new PIXI.Container({ label: resident.displayName });
    const shadow = new PIXI.Graphics().ellipse(0, 3, 42, 12).fill({ color: 0x02070a, alpha: 0.38 });
    const selection = new PIXI.Graphics().ellipse(0, 0, 54, 17).stroke({ color: 0xf0d083, width: 3, alpha: 0.82 });
    const fallback = fallbackCreature(PIXI);
    selection.visible = resident.selected;
    root.addChild(shadow, selection, fallback);
    actorLayer.addChild(root);
    const entry = {
      root,
      shadow,
      selection,
      fallback,
      sprite: null,
      idleTextures: null,
      reactionTextures: null,
      lastReactionRevision: -1,
      loadToken: 0
    };
    actors.set(resident.creatureId, entry);
    attachActorInput(entry, resident.creatureId);
    void loadActorTextures(entry, resident);
    return entry;
  }

  async function loadActorTextures(entry, resident) {
    const token = ++entry.loadToken;
    try {
      const key = resident.speciesId.replace(/^championship:creature:/, "");
      const [idle, reaction] = await Promise.all([
        parseGridSheet(PIXI, resident.sprite.idle, `int-rh2:${key}:idle:`),
        parseGridSheet(PIXI, resident.sprite.reaction, `int-rh2:${key}:reaction:`)
      ]);
      if (disposed || token !== entry.loadToken) {
        idle.sheet.destroy(false);
        reaction.sheet.destroy(false);
        return;
      }
      sheets.add(idle.sheet);
      sheets.add(reaction.sheet);
      entry.idleTextures = idle.textures;
      entry.reactionTextures = reaction.textures;
      const sprite = new PIXI.AnimatedSprite({
        textures: idle.textures,
        autoUpdate: false,
        autoPlay: !reducedMotion,
        loop: true,
        anchor: { x: 0.5, y: 1 }
      });
      sprite.animationSpeed = resident.sprite.idle.fps / 60;
      sprite.width = 120;
      sprite.height = 120;
      entry.root.removeChild(entry.fallback);
      entry.fallback.destroy();
      entry.fallback = null;
      entry.root.addChildAt(sprite, 2);
      entry.sprite = sprite;
      if (resident.intent === "care-reaction") playReaction(entry, resident, latestRevision);
    } catch (error) {
      assetFailures += 1;
      onFallback(`A resident texture could not load; the neutral field fallback remains active. ${error.message}`);
    }
  }

  function playReaction(entry, resident, revision) {
    if (!entry.sprite || !entry.reactionTextures || entry.lastReactionRevision === revision) return;
    entry.lastReactionRevision = revision;
    entry.sprite.textures = entry.reactionTextures;
    entry.sprite.loop = false;
    entry.sprite.animationSpeed = resident.sprite.reaction.fps / 60;
    entry.sprite.onComplete = () => {
      if (disposed || !entry.sprite || !entry.idleTextures) return;
      entry.sprite.onComplete = null;
      entry.sprite.textures = entry.idleTextures;
      entry.sprite.loop = true;
      entry.sprite.animationSpeed = resident.sprite.idle.fps / 60;
      if (reducedMotion) entry.sprite.gotoAndStop(0);
      else entry.sprite.gotoAndPlay(0);
    };
    if (reducedMotion) entry.sprite.gotoAndStop(Math.min(1, entry.reactionTextures.length - 1));
    else entry.sprite.gotoAndPlay(0);
  }

  function sync(frame, { force = false } = {}) {
    if (disposed || !frame || (!force && frame.revision === latestRevision)) return;
    latestFrame = frame;
    latestRevision = frame.revision;
    drawField(frame);
    const live = new Set(frame.residents.map((resident) => resident.creatureId));
    for (const [creatureId, entry] of actors) {
      if (live.has(creatureId)) continue;
      entry.loadToken += 1;
      actorLayer.removeChild(entry.root);
      entry.root.destroy({ children: true });
      actors.delete(creatureId);
    }
    for (const resident of frame.residents) {
      const entry = actors.get(resident.creatureId) ?? createActor(resident);
      entry.selection.visible = resident.selected;
      entry.root.zIndex = Math.round(resident.lane.y * 1000);
      if (drag?.creatureId !== resident.creatureId) {
        const point = actorPoint(resident);
        entry.root.position.set(point.x, point.y);
      }
      const scale = clamp(Math.min(app.screen.width / 390, app.screen.height / 620), 0.78, 1.18);
      const facing = resident.facing === "left" ? -1 : 1;
      entry.root.scale.set(scale * facing, scale);
      if (resident.intent === "care-reaction") playReaction(entry, resident, frame.revision);
    }
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.lastPoint = { x: event.global.x, y: event.global.y };
    if (!drag.moved) {
      drag.moved = Math.hypot(event.global.x - drag.startPoint.x, event.global.y - drag.startPoint.y) >= DRAG_THRESHOLD_PX;
    }
    if (drag.moved) drag.entry.root.position.set(event.global.x, event.global.y);
  }

  // The stage already resized the renderer and refreshed the hit area; the scene
  // only has to relay out against the new screen size.
  function resize() {
    if (disposed) return;
    sync(source.getFrame(), { force: true });
  }

  function updateAnimations(ticker) {
    for (const entry of actors.values()) {
      if (entry.sprite?.playing) entry.sprite.update(ticker);
    }
  }

  app.stage.on("globalpointermove", moveDrag);
  app.stage.on("pointerup", finishDrag);
  app.stage.on("pointerupoutside", finishDrag);
  app.stage.on("pointercancel", finishDrag);
  app.ticker.add(updateAnimations);

  const unsubscribe = source.subscribe(sync);
  const unobserveResize = stage.onResize(resize);
  const unobserveContextLost = stage.onContextLost(() => {
    onFallback("The 2D field context was lost. DOM screen controls remain available; reload to restore the field.");
  });
  resize();

  return Object.freeze({
    // The P1R DOM shell calls render(frame) after its own DOM repaint. The
    // source subscription remains authoritative; this method is an idempotent
    // presentation sync only and skips an already-consumed revision.
    render(frame) {
      sync(frame);
    },

    getDiagnostics() {
      return Object.freeze({
        renderer: "PIXI_SCENE_ON_SHARED_STAGE",
        applicationCount: 1,
        ticker: "APPLICATION_OWNED",
        threeUsed: false,
        frameRevision: latestRevision,
        residentCount: actors.size,
        assetFailures,
        viewport: Object.freeze({ width: app.screen.width, height: app.screen.height })
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      drag = null;
      unsubscribe();
      unobserveResize();
      unobserveContextLost();
      app.ticker.remove(updateAnimations);
      app.stage.off("globalpointermove", moveDrag);
      app.stage.off("pointerup", finishDrag);
      app.stage.off("pointerupoutside", finishDrag);
      app.stage.off("pointercancel", finishDrag);
      for (const entry of actors.values()) entry.loadToken += 1;
      if (scene.parent) scene.parent.removeChild(scene);
      scene.destroy({ children: true });
      actors.clear();
      for (const sheet of sheets) sheet.destroy(false);
      sheets.clear();
      // The Application belongs to the stage and outlives this scene.
      latestFrame = null;
    }
  });
}
