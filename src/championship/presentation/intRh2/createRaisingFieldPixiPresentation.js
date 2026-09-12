// INT-RH2 Raising field -- a scene on the single Championship Pixi stage.
//
// VS1 created its own Application here. VS2 needs a second playable field, and
// the product is allowed exactly one Pixi bootstrap, so the Application moved to
// championshipPixiStage.js and this module became a scene on it. The rendered
// result is unchanged; what changed is who owns the canvas.
//
// The scene may hold transient pointer and animation state, but never cage
// assignment, save data, gameplay values, routing, or another runtime store.

import { getRaisingNativePixelScale, getRaisingNativeActorGeometry } from "./raisingNativeSizing.js";
import { applyNativeCharacterCellGeometry } from '../nativeHuntCharacterAction.js';
import { raisingFieldViewport, raisingRegionBounds, raisingNativeToScreen, raisingScreenToNative } from "./raisingFieldViewport.js";

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
  fieldArt = null,
  characterBundle = null,
  feedbackArt = null,
  getSelectedTool = () => null,
  onTrainingFrame = () => {},
  onActorFrame = null,
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
}) {
  assertDependencies(stage, source);
  const { PIXI, app } = stage;
  if (fieldArt !== null && (!fieldArt.displayObject || typeof fieldArt.update !== "function"
    || typeof fieldArt.dispose !== "function" || typeof fieldArt.getDiagnostics !== "function")) {
    throw new TypeError("The Raising field art binding must be a loaded runtime map-art field");
  }

  const scene = stage.createSceneRoot("INT-RH2 Raising field");
  const unmarkScene = stage.markScene("cm-raising-pixi-canvas");
  const backgroundLayer = new PIXI.Container({ label: "background" });
  const productionArtLayer = new PIXI.Container({ label: "bounded production cage art" });
  const terrainLayer = new PIXI.Container({ label: "terrain" });
  const propLayer = new PIXI.Container({ label: "props" });
  const actorLayer = new PIXI.Container({ label: "actors" });
  const foregroundLayer = new PIXI.Container({ label: "foreground occlusion" });
  const fxLayer = new PIXI.Container({ label: "fx and lighting" });
  actorLayer.sortableChildren = true;
  scene.addChild(backgroundLayer, productionArtLayer, terrainLayer, propLayer, actorLayer, foregroundLayer, fxLayer);
  if (fieldArt) productionArtLayer.addChild(fieldArt.displayObject);

  const backdrop = new PIXI.Graphics();
  backgroundLayer.addChild(backdrop);
  const cageGraphics = new Map();
  const actors = new Map();
  const foodGraphics = new Map();
  const wasteGraphics = new Map();
  const evolutionGlow=new PIXI.Graphics();evolutionGlow.eventMode='none';fxLayer.addChild(evolutionGlow);
  const evolutionBackdrop=new PIXI.Graphics();evolutionBackdrop.eventMode='none';scene.addChildAt(evolutionBackdrop,4);
  const evolutionWriting=new PIXI.Container();evolutionWriting.eventMode='none';scene.addChildAt(evolutionWriting,5);
  const evolutionWords=Array.from({length:6},(_,i)=>{const word=new PIXI.Text({text:i%2?'進化!!':'EVOLUTION',style:{fontFamily:'sans-serif',fontSize:16+(i%3)*4,fontWeight:'bold',fill:0x008bff}});evolutionWriting.addChild(word);return word;});
  const silhouette=new PIXI.ColorMatrixFilter();silhouette.matrix=[0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0];
  let evolutionCamera=null;
  // Licensed original cells (common/i000_item) carry their own size and sprite
  // origin, so each one is placed by its own geometry rather than a shared
  // square. The celebration platter and cake have no original counterpart and
  // stay authored vectors on the previous 32px square.
  const FOOD_KINDS=['meat','protein','feast','cake'];
  async function loadCareArt() {
    const art=new Map();
    const licensed=new URL('../../../../assets/production/raising-care/licensed-runtime-v1/',import.meta.url);
    const manifest=await (await fetch(new URL('manifest.json',licensed).href)).json();
    await Promise.all(manifest.cells.map(async cell=>art.set(`${cell.role}-${cell.pose}`,{
      texture:await PIXI.Assets.load(new URL(cell.file,licensed).href),
      width:cell.nativeWidth,height:cell.nativeHeight,
      anchorX:cell.nativeAnchorX/cell.nativeWidth,anchorY:cell.nativeAnchorY/cell.nativeHeight})));
    const authored=new URL('../../../../assets/production/raising-care-r1/',import.meta.url);
    await Promise.all(['feast','cake'].flatMap(kind=>[0,1,2,3].map(async quarter=>art.set(`${kind}-${quarter}`,{
      texture:await PIXI.Assets.load(new URL(`${kind}-${quarter}.svg`,authored).href),
      width:32,height:32,anchorX:0.5,anchorY:0.85}))));
    return art;
  }
  const careArt = fieldArt?.field?.presentationMode==='NATIVE_RANCH' ? await loadCareArt() : new Map();
  const toolPreview = careArt.size?new PIXI.Sprite(careArt.get('broom-0').texture):null;
  if(toolPreview){toolPreview.eventMode='none';toolPreview.visible=false;
    toolPreview.label='Clean broom and dustpan';fxLayer.addChild(toolPreview);}
  // i000_item plays spoiled food, waste and the sweep as two poses of 18
  // native ticks each (sequences 4, 9, 10 and 11), and gives meat and the
  // capsule one spoiled identity apiece rather than one per remaining amount.
  const NATIVE_POSE_MS=18*560190/33513982*1000;
  const placeCare=(sprite,art)=>{sprite.texture=art.texture;sprite.anchor.set(art.anchorX,art.anchorY);};
  let pointerPreview=null,cleanFeedback=null,careElapsed=0;
  const carePose=()=>reducedMotion?0:Math.floor(careElapsed/NATIVE_POSE_MS)%2;
  const sheets = new Set();
  let disposed = false;
  let latestFrame = null;
  let latestRevision = -1;
  let drag = null;
  let cameraX = 0;
  let cameraDrag = null;
  if (fieldArt?.field?.presentationMode === 'NATIVE_RANCH') {
    // Ranch art is layered above the backdrop. Ground input belongs to the
    // scene so a decorative tile cannot swallow a tap or a camera swipe.
    scene.eventMode = 'static';
    backdrop.cursor = 'grab';
    scene.on('pointerdown', event => {
      if(source.getLifecycleFrame?.()?.day||source.getLifecycleFrame?.()?.evolution)return;
      if (drag) return;
      event.stopPropagation();
      cameraDrag = {pointerId:event.pointerId,startX:event.global.x,startY:event.global.y,origin:cameraX,tool:getSelectedTool(),moved:false};
      pointerPreview={x:event.global.x,y:event.global.y,touch:event.pointerType==='touch',held:true};
      backdrop.cursor = 'grabbing';
    });
  }
  let assetFailures = 0;
  if (characterBundle !== null && (typeof characterBundle.createActor !== "function"
    || typeof characterBundle.dispose !== "function" || typeof characterBundle.getDiagnostics !== "function")) {
    throw new TypeError("INT-RH2 character art must be an injected runtime bundle");
  }

  function cageBounds(cage) {
    const fit = raisingFieldViewport(fieldArt?.field, app.screen, 12, cameraX);
    // Native ranch startup keeps the existing resident interaction lanes in
    // Waiting Room. It does not infer training-module membership or collision.
    const room = fieldArt?.field?.residentViewport;
    const bounds = room ? {x:fit.x+room.x*fit.scale, y:fit.y+room.y*fit.scale,
      width:room.width*fit.scale,height:room.height*fit.scale} : fit;
    return raisingRegionBounds(cage.region, bounds);
  }

  // Fit one licensed field into the Pixi host. The two habitat regions stay
  // product-authored drop targets on top; they are not original ranch slots.
  function layoutFieldArt() {
    if (!fieldArt) {
      productionArtLayer.visible = false;
      return;
    }
    const bounds = raisingFieldViewport(fieldArt.field, app.screen, 12, cameraX);
    productionArtLayer.visible = true;
    productionArtLayer.scale.set(bounds.scale);
    productionArtLayer.position.set(bounds.x, bounds.y);
  }

  function drawField(frame) {
    // Owner direction 2026-09-12 returns the interface to the original's
    // language, and the space around the ranch belongs to that language rather
    // than to a pale filler. The stage is transparent (backgroundAlpha 0), so
    // painting nothing here lets the framed hex ground behind the canvas read
    // through, and the ranch reads as a platform in the digital world -- which
    // is what it is -- instead of a plate dropped on a blank sheet.
    // This is presentation paint only; cage geometry and actor transforms stay
    // separate.
    backdrop.clear();
    if (!fieldArt) {
      // Art missing is the one case that still needs its own ground, and it
      // takes the same deep blue rather than a light one.
      backdrop
        .rect(0, 0, app.screen.width, app.screen.height).fill(0x0b3bbe)
        .circle(app.screen.width * 0.22, app.screen.height * 0.12, app.screen.width * 0.46)
        .fill({ color: 0x18d5ff, alpha: 0.18 });
    }
    layoutFieldArt();

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
      // These regions belong to the legacy interaction prototype, not Cage
      // artwork. Keep them out of the loaded ranch's visible presentation.
      graphic.clear();
      graphic.visible = !fieldArt;
      if (fieldArt) return;
      const bounds = cageBounds(cage);
      const radius = Math.min(28, bounds.height * 0.16);
      const color = index % 2 === 0 ? 0x2a7181 : 0x35694f;
      graphic.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, radius)
        .fill({ color, alpha: 0.32 }).stroke({ color: 0x9ad9d2, width: 1.5, alpha: 0.34 });
    });
  }

  function actorPoint(resident) {
    const native=source.getActorFrame?.(resident.creatureId);
    if(native?.positionQ12&&latestFrame?.ranch?.layoutVersion==='NATIVE_ANCHORS_V1') {
      const point=raisingNativeToScreen(native.positionQ12,fieldArt?.field,app.screen,cameraX);if(point)return point;
    }
    const cage = latestFrame?.cages.find((entry) => entry.cageId === resident.cageId);
    if (!cage) return { x: app.screen.width / 2, y: app.screen.height / 2 };
    const bounds = cageBounds(cage);
    return {
      x: bounds.x + bounds.width * resident.lane.x,
      y: bounds.y + bounds.height * resident.lane.y
    };
  }

  function finishDrag(event) {
    if (cameraDrag && (event.pointerId === undefined || cameraDrag.pointerId === event.pointerId)) {
      const completed=cameraDrag;
      cameraDrag = null;
      backdrop.cursor = 'grab';
      if(!completed.moved&&event.type!=="pointercancel"&&event.type!=="pointerupoutside"&&["feed","protein","clean"].includes(completed.tool)) {
        const point=raisingScreenToNative(event.global??{x:completed.startX,y:completed.startY},fieldArt?.field,app.screen,cameraX);
        if(point){if(completed.tool==='clean') {
          source.intents.cleanFood?.(point);
          // Tool feedback is transient presentation; removal stays app-owned.
          cleanFeedback={point,elapsed:0};
        } else source.intents.placeFood?.({...point,protein:completed.tool==='protein'});}
      }
      if(pointerPreview)pointerPreview.held=false;
      if(event.type==='pointercancel'||event.type==='pointerupoutside'){pointerPreview=null;cleanFeedback=null;}
    }
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const completed = drag;
    drag = null;
    completed.entry.root.cursor = "grab";
    if(completed.nativeHand){source.intents.endHand?.(completed.creatureId,{cancelled:event.type==='pointercancel'||event.type==='pointerupoutside'});
      sync(source.getFrame(),{force:true});return;}
    if(completed.carried){source.intents.releaseCarry?.(completed.creatureId);sync(source.getFrame(),{force:true});return;}
    const point = event.global ?? completed.lastPoint;
    const nativeFrame=source.getActorFrame?.(completed.creatureId)?.nativeFrame;
    if(!completed.moved&&event.type!=='pointercancel'&&event.type!=='pointerupoutside'
      &&['medicine','woundMedicine'].includes(completed.tool))source.intents.treatResident?.(completed.creatureId,completed.tool==='woundMedicine'?0:1);
    // OVL18 0210C4FC: release before ten native frames selects request 7E.
    // A cancelled pointer never becomes a tool action.
    if (!completed.moved && event.type !== "pointercancel" && event.type !== "pointerupoutside" && completed.tool === "hand"
        && Number.isInteger(nativeFrame) && nativeFrame-completed.nativeFrame < 10)
      source.intents.touchEgg?.(completed.creatureId);
    if (completed.moved && point && event.type!=="pointercancel" && event.type!=="pointerupoutside") {
      if(latestFrame?.ranch?.layoutVersion==='NATIVE_ANCHORS_V1') {
        const nativePoint=raisingScreenToNative(point,fieldArt?.field,app.screen,cameraX);
        // Native short touches do not teleport a resident. Adult relocation
        // completes through the held/flight owner after the ten-frame gate.
        if(completed.tool==='hand'&&nativePoint&&source.getActorFrame?.(completed.creatureId)?.speciesIndex<8)
          source.intents.relocateToGround?.(completed.creatureId,nativePoint);
        sync(source.getFrame(),{force:true});return;
      }
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
      if (disposed||drag||cameraDrag) return;
      if(source.getLifecycleFrame?.()?.day||source.getLifecycleFrame?.()?.evolution)return;
      event.stopPropagation();
      if(["feed","protein","clean"].includes(getSelectedTool())&&fieldArt?.field?.presentationMode==='NATIVE_RANCH') {
        cameraDrag={pointerId:event.pointerId,startX:event.global.x,startY:event.global.y,origin:cameraX,tool:getSelectedTool(),moved:false};
        pointerPreview={x:event.global.x,y:event.global.y,touch:event.pointerType==='touch',held:true};
        return;
      }
      source.intents.selectCreature(creatureId);
      drag = {
        creatureId,
        entry,
        tool: getSelectedTool(),
        nativeFrame: source.getActorFrame?.(creatureId)?.nativeFrame,
        pointerId: event.pointerId,
        originCageId: source.getFrame().residents.find((resident) => resident.creatureId === creatureId)?.cageId ?? null,
        startPoint: { x: event.global.x, y: event.global.y },
        lastPoint: { x: event.global.x, y: event.global.y },
        moved: false
      };
      if(drag.tool==='hand'&&latestFrame?.ranch?.layoutVersion==='NATIVE_ANCHORS_V1'){
        const point=raisingScreenToNative(event.global,fieldArt?.field,app.screen,cameraX);
        if(point)drag.nativeHand=source.intents.beginHand?.(creatureId,{...point,cameraX:cameraX/fieldArt.field.nativePixelWorldScale})??false;
      }
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
      speciesId: resident.speciesId,
      shadow,
      selection,
      fallback,
      sprite: null,
      characterController: null,
      characterReactionActive: false,
      idleTextures: null,
      reactionTextures: null,
      lastReactionRevision: -1,
      loadToken: 0
    };
    if (characterBundle) {
      const actor = characterBundle.createActor({
        speciesId: resident.speciesId,
        side: "main",
        presentation: "raising",
        reducedMotion: false // Native poses communicate eating, movement and injury.
      });
      if (actor) {
        actor.sprite.scale.set(120 / 352);
        root.removeChild(fallback);
        fallback.destroy();
        entry.fallback = null;
        entry.sprite = actor.sprite;
        entry.nativeSizing = actor.nativeSizing ?? null;
        entry.characterController = actor.controller;
        entry.nativeFramePresenter = actor.nativeFramePresenter;
        root.addChildAt(actor.sprite, 2);
      }
    }
    actors.set(resident.creatureId, entry);
    attachActorInput(entry, resident.creatureId);
    if (!entry.sprite) void loadActorTextures(entry, resident);
    return entry;
  }

  async function loadActorTextures(entry, resident) {
    if (entry.sprite) return;
    const token = ++entry.loadToken;
    try {
      if (characterBundle?.ensureSpecies) {
        const ready = await characterBundle.ensureSpecies(resident.speciesId);
        if (disposed || token !== entry.loadToken) return;
        const actor = ready && characterBundle.createActor({speciesId:resident.speciesId,side:"main",presentation:"raising",reducedMotion:false});
        if (actor) {
          entry.root.removeChild(entry.fallback);entry.fallback.destroy();entry.fallback=null;
          entry.sprite=actor.sprite;entry.nativeSizing=actor.nativeSizing;
          entry.nativeFramePresenter=actor.nativeFramePresenter;entry.characterController=actor.controller;
          entry.root.addChildAt(actor.sprite,2);sync(source.getFrame(),{force:true});return;
        }
      }
      if (!resident.sprite?.idle?.sheet || !resident.sprite?.reaction?.sheet) return;
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
    if (entry.characterController) {
      if (entry.lastReactionRevision === revision) return;
      entry.lastReactionRevision = revision;
      entry.characterReactionActive = true;
      entry.characterController.setAnimation("happy");
      return;
    }
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
      const previous = actors.get(resident.creatureId);
      if (previous && previous.speciesId !== resident.speciesId) {
        previous.loadToken++;
        if (drag?.creatureId === resident.creatureId) drag=null;
        actorLayer.removeChild(previous.root);previous.root.destroy({children:true});
        actors.delete(resident.creatureId);
      }
      const entry = actors.get(resident.creatureId) ?? createActor(resident);
      entry.selection.visible = resident.selected;
      entry.root.zIndex = Math.round(resident.lane.y * 1000);
      if (drag?.creatureId !== resident.creatureId||drag?.carried) {
        const point = actorPoint(resident);
        entry.root.position.set(point.x, point.y);
      }
      const nativeScale = getRaisingNativePixelScale(fieldArt?.field, app.screen);
      const frameGeometry=entry.nativeFramePresenter?.getSnapshot()?.geometry;
      const sizing=frameGeometry?.scale ? {...entry.nativeSizing,packedPixelsPerNativePixel:frameGeometry.scale} : entry.nativeSizing;
      const geometry = getRaisingNativeActorGeometry(entry.sprite, sizing, nativeScale);
      const scale = geometry ? nativeScale : clamp(Math.min(app.screen.width / 390, app.screen.height / 620), 0.78, 1.18);
      const facing = resident.facing === "left" ? -1 : 1;
      if (geometry) {
        entry.sprite.scale.set(geometry.spriteScale);
        const { visible, hitArea } = geometry;
        const center = visible.x + visible.width / 2;
        const bottom = visible.y + visible.height;
        entry.shadow.clear().ellipse(center, bottom + 1, visible.width * 0.42, Math.max(1, visible.width * 0.13))
          .fill({ color: 0x02070a, alpha: 0.26 });
        entry.selection.clear().ellipse(center, bottom + 1, visible.width / 2 + 2, Math.max(2, visible.width * 0.16))
          .stroke({ color: 0xf0d083, width: 1, alpha: 0.9 });
        entry.root.hitArea = new PIXI.Rectangle(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
      }
      entry.nativeScale = geometry ? nativeScale : null;
      entry.root.scale.set(scale * facing, scale);
      entry.restScale=scale;
      if (resident.intent === "care-reaction") playReaction(entry, resident, frame.revision);
    }
  }

  function moveDrag(event) {
    pointerPreview={x:event.global.x,y:event.global.y,touch:event.pointerType==='touch',held:Boolean(cameraDrag||drag)};
    if (cameraDrag?.pointerId === event.pointerId) {
      cameraDrag.moved ||= Math.hypot(event.global.x-cameraDrag.startX,event.global.y-cameraDrag.startY)>=DRAG_THRESHOLD_PX;
      if(!cameraDrag.moved)return;
      const fit = raisingFieldViewport(fieldArt.field, app.screen);
      const maxX = Math.max(0, fieldArt.field.worldWidthPx-(app.screen.width-24)/fit.scale);
      cameraX = clamp(cameraDrag.origin-(event.global.x-cameraDrag.startX)/fit.scale, 0, maxX);
      sync(latestFrame, {force:true});
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.lastPoint = { x: event.global.x, y: event.global.y };
    if(drag.nativeHand){const point=raisingScreenToNative(event.global,fieldArt?.field,app.screen,cameraX);
      const local=drag.entry.root.toLocal(event.global);
      if(point)source.intents.updateHand?.(drag.creatureId,{...point,cameraX:cameraX/fieldArt.field.nativePixelWorldScale,
        inside:drag.entry.root.hitArea?.contains(local.x,local.y)??true});}
    if (!drag.moved) {
      drag.moved = Math.hypot(event.global.x - drag.startPoint.x, event.global.y - drag.startPoint.y) >= DRAG_THRESHOLD_PX;
    }
    if(drag.carried){const point=raisingScreenToNative(event.global,fieldArt?.field,app.screen,cameraX);
      if(point)source.intents.updateCarry?.(drag.creatureId,{...point,cameraX:cameraX/fieldArt.field.nativePixelWorldScale});}
    else if(drag.moved&&latestFrame?.ranch?.layoutVersion!=='NATIVE_ANCHORS_V1')drag.entry.root.position.set(event.global.x,event.global.y);
  }

  // The stage already resized the renderer and refreshed the hit area; the scene
  // only has to relay out against the new screen size.
  function resize() {
    if (disposed) return;
    if(fieldArt?.field?.presentationMode==='NATIVE_RANCH')scene.hitArea=new PIXI.Rectangle(0,0,app.screen.width,app.screen.height);
    sync(source.getFrame(), { force: true });
  }

  function updateAnimations(ticker) {
    if(drag?.nativeHand)drag.carried=source.getActorFrame?.(drag.creatureId)?.state===6;
    fieldArt?.update(ticker.deltaMS);
    careElapsed+=Math.min(100,Math.max(0,ticker.deltaMS));
    drawFood();
    drawWaste();
    drawCareTool(ticker.deltaMS);
    evolutionGlow.clear();
    const lifecycle=source.getLifecycleFrame?.()?.evolution;
    const activeFrame=lifecycle?source.getActorFrame?.(lifecycle.instanceId)?.evolution:null;
    const covered=!!activeFrame&&activeFrame.phase>=1;
    evolutionBackdrop.clear();evolutionWriting.visible=covered&&activeFrame.target>=0&&activeFrame.phase>=2;
    if(covered){
      evolutionBackdrop.rect(0,0,app.screen.width,app.screen.height).fill(evolutionWriting.visible?0x08163f:0x000000);
      if(evolutionWriting.visible){
        for(let i=0;i<5;i++)evolutionBackdrop.rect(0,i*app.screen.height/5,app.screen.width,app.screen.height/15).fill(i%2?0x0c205b:0x102b77);
        evolutionWords.forEach((word,i)=>{word.x=((i*113+activeFrame.totalFrames*(i%2?1:-1))%(app.screen.width+220)+app.screen.width+220)%(app.screen.width+220)-150;word.y=(i+0.5)*app.screen.height/6;});
      }
    }
    for(const g of foodGraphics.values())g.visible=!covered;for(const g of wasteGraphics.values())g.visible=!covered;
    const trainingLabels=[];
    for (const [creatureId, entry] of actors) {
      entry.root.visible=!covered||creatureId===lifecycle?.instanceId;
      const native=source.getActorFrame?.(creatureId);
      drawNativeFeedback(entry,native,covered,'feedback');
      drawNativeFeedback(entry,native,covered,'statusFeedback');
      drawTreatment(entry,native?.treatment,covered);
      if(!covered&&native?.training?.phase===0&&native.positionQ12){
        const point=raisingNativeToScreen(native.positionQ12,fieldArt?.field,app.screen,cameraX),scale=getRaisingNativePixelScale(fieldArt?.field,app.screen);
        if(point)native.training.lanes.forEach((lane,index)=>{if(lane.stage>=2&&lane.command&&lane.command.outcome!=='BLOCKED')
          trainingLabels.push({id:`${creatureId}:${index}`,command:lane.command,x:point.x,y:point.y-(22+lane.rise/4096)*scale,alpha:Math.max(0,lane.alpha/31),scale});});
      }
      if(native?.positionQ12&&fieldArt?.field?.presentationMode==='NATIVE_RANCH'&&(drag?.creatureId!==creatureId||drag?.carried||drag?.nativeHand)) {
        const point=raisingNativeToScreen(native.positionQ12,fieldArt.field,app.screen,cameraX);
        entry.root.position.set(point.x,point.y);entry.root.zIndex=native.state===6?100000:Math.round(native.positionQ12[1]/4096);
        entry.shadow?.scale.set(native.state===6?3277/4096:1);
      }
      if (entry.nativeFramePresenter) {
        const frame=source.getActorFrame?.(creatureId);
        // Profile changes may precede asynchronous texture loading. Never
        // apply one species' frame index to another species' atlas.
        if (frame && `championship:creature:species-${String(frame.speciesIndex).padStart(3,"0")}`===entry.speciesId)
          {const visualFrame=entry.nativeFramePresenter.apply(frame);if(entry.sprite){
            if(entry.nativeScale!==null)applyNativeCharacterCellGeometry(entry.sprite,visualFrame);
            if(entry.nativeScale!==null)entry.root.scale.x=Math.abs(entry.root.scale.x);
            entry.sprite.y=-(frame.positionQ12?.[2]??0)/4096;
            // Main is authored facing left; the original body bit mirrors it.
            entry.sprite.scale.x=Math.abs(entry.sprite.scale.x)*(frame.flipBits&1?-1:1);
          }}
      } else if (entry.characterController) {
        const snapshot = entry.characterController.update(ticker);
        if (entry.characterReactionActive && snapshot.cycle >= 1) {
          entry.characterReactionActive = false;
          entry.characterController.setAnimation("idle");
        }
      } else if (entry.sprite?.playing) {
        entry.sprite.update(ticker);
      }
      drawEvolution(entry,native);
    }
    onTrainingFrame(trainingLabels);
    if(onActorFrame)onActorFrame([...actors].map(([creatureId,entry])=>{
      const area=entry.root.hitArea,point=entry.root.toGlobal(new PIXI.Point(area.x+area.width/2,area.y+area.height/2));
      const native=source.getActorFrame?.(creatureId);
      return {creatureId,x:point.x,y:point.y,state:native?.state,speciesIndex:native?.speciesIndex,nativeFrame:native?.nativeFrame,sequenceId:native?.sequenceId};
    }));
  }

  function drawNativeFeedback(entry,native,covered,kind){
    const feedback=native?.[kind],cell=feedbackArt?.getCell(feedback?.cell),key=kind+'Sprite';
    if(!cell||covered||!native.positionQ12){if(entry[key])entry[key].visible=false;return;}
    if(!entry[key]){entry[key]=new PIXI.Sprite();entry[key].eventMode='none';entry.root.addChild(entry[key]);}
    const sprite=entry[key];
    sprite.visible=true;sprite.texture=cell.texture;
    sprite.anchor.set(cell.origin[0]/cell.width,cell.origin[1]/cell.height);
    const p=raisingNativeToScreen(feedback.positionQ12,fieldArt?.field,app.screen,cameraX);
    const body=raisingNativeToScreen(native.positionQ12,fieldArt?.field,app.screen,cameraX);
    const scale=entry.restScale??1;
    sprite.position.set((p.x-body.x)/scale,(p.y-body.y)/scale-feedback.positionQ12[2]/4096);
  }

  function drawWaste(){
    const waste=source.getWasteFrame?.()??[],live=new Set(waste.map(w=>w.slot));
    for(const [slot,g] of wasteGraphics)if(!live.has(slot)){g.destroy();wasteGraphics.delete(slot);}
    const scale=getRaisingNativePixelScale(fieldArt?.field,app.screen);
    if(!careArt.size||!(scale>0))return;
    const art=careArt.get(`waste-${carePose()}`);
    for(const item of waste){let g=wasteGraphics.get(item.slot);
      if(!g){g=new PIXI.Sprite();g.eventMode='none';g.label='Waste';
        actorLayer.addChild(g);wasteGraphics.set(item.slot,g);}
      placeCare(g,art);g.width=art.width*scale;g.height=art.height*scale;
      const point=raisingNativeToScreen(item.positionQ12,fieldArt?.field,app.screen,cameraX);
      if(point){g.position.set(point.x,point.y);g.zIndex=Math.round(item.positionQ12[1]/4096);}}
  }

  function drawEvolution(entry,native){
    const e=native?.evolution;
    if(!e){if(entry.evolutionSprite){entry.evolutionSprite.destroy();entry.evolutionSprite=null;entry.evolutionPresenter=null;}
      if(entry.evolutionActive){if(entry.sprite){entry.sprite.visible=true;entry.sprite.filters=null;}entry.root.scale.set(entry.restScale??1);entry.evolutionActive=false;entry.evolutionTarget=null;}
      if(!source.getLifecycleFrame?.()?.evolution)evolutionCamera=null;return;}
    entry.evolutionActive=true;
    if(!evolutionCamera||evolutionCamera.id!==source.getLifecycleFrame?.()?.evolution?.instanceId){
      const fit=raisingFieldViewport(fieldArt.field,app.screen);const max=Math.max(0,fieldArt.field.worldWidthPx-(app.screen.width-24)/fit.scale);
      evolutionCamera={id:source.getLifecycleFrame?.()?.evolution?.instanceId,start:cameraX,
        target:clamp(native.positionQ12[0]/4096*fieldArt.field.nativePixelWorldScale-(app.screen.width-24)/fit.scale/2,0,max)};}
    if(e.phase===0){cameraX=evolutionCamera.start+(evolutionCamera.target-evolutionCamera.start)*e.elapsed/15;layoutFieldArt();}
    if(e.target>=0&&entry.evolutionTarget!==e.target){entry.evolutionTarget=e.target;
      void characterBundle?.ensureSpecies?.(`championship:creature:species-${String(e.target).padStart(3,'0')}`).then(ready=>{
        if(!ready||disposed||entry.root.destroyed||!entry.evolutionActive||entry.evolutionTarget!==e.target)return;
        const visual=characterBundle.createActor({speciesId:`championship:creature:species-${String(e.target).padStart(3,'0')}`,side:'main',presentation:'raising',reducedMotion:false});
        if(!visual)return;entry.evolutionSprite=visual.sprite;entry.evolutionPresenter=visual.nativeFramePresenter;
        const geometry=getRaisingNativeActorGeometry(visual.sprite,visual.nativeSizing,getRaisingNativePixelScale(fieldArt?.field,app.screen));
        visual.sprite.scale.set(geometry?.spriteScale??120/352);entry.root.addChildAt(visual.sprite,2);
      });}
    const enlarge=e.phase===0?0:e.phase===1?Math.min(19,e.elapsed)/19:e.phase===7?Math.max(0,1-e.elapsed/30):1;
    const point=raisingNativeToScreen(native.positionQ12,fieldArt.field,app.screen,cameraX);
    entry.root.position.set(point.x,point.y+(app.screen.height/2-point.y)*enlarge);
    entry.root.scale.set((entry.restScale??1)*(1+19*204/4096*enlarge));
    if(entry.sprite){entry.sprite.visible=e.target<0?!e.reveal:!e.reveal||!entry.evolutionSprite;entry.sprite.filters=e.phase>=2&&e.phase<=4?[silhouette]:null;}
    if(entry.evolutionSprite){entry.evolutionSprite.visible=e.reveal;
      entry.evolutionSprite.filters=e.phase<=4?[silhouette]:null;
      if(e.targetFrame){const frame=entry.evolutionPresenter?.apply(e.targetFrame);
        if(entry.nativeScale!==null&&e.reveal)applyNativeCharacterCellGeometry(entry.evolutionSprite,frame);}}
    const center={x:entry.root.x,y:entry.root.y-24*(entry.restScale??1)};
    if(e.phase>0&&e.phase<7){
      const radius=34*(entry.restScale??1);
      if(e.phase>=2&&e.target>=0)evolutionGlow.ellipse(center.x,entry.root.y,radius*1.5,radius/3).stroke({color:0x005ace,width:4,alpha:0.8});
      if(e.phase>=3)for(let i=0;i<28;i++){
        const phase=(i*17+e.elapsed*4)%120,angle=i*2.3999;
        const x=center.x+Math.cos(angle)*radius*(phase/120),y=entry.root.y-phase*(entry.restScale??1);
        evolutionGlow.rect(x,y,2,4).fill({color:e.target<0?0xffffff:e.phase<=4?0x48fa6b:0x00baff,alpha:1-phase/130});
      }
      if(!reducedMotion&&(e.phase===4||e.phase===5))evolutionGlow.rect(0,0,app.screen.width,app.screen.height).fill({color:0xffffff,alpha:e.phase===4?Math.min(1,e.elapsed/4):Math.max(0,1-e.elapsed/8)});
    }
  }

  function drawTreatment(entry,treatment,covered) {
    if(!entry.treatmentGlyph){entry.treatmentGlyph=new PIXI.Graphics();entry.treatmentGlyph.eventMode='none';entry.root.addChild(entry.treatmentGlyph);}
    const g=entry.treatmentGlyph;g.clear();g.visible=Boolean(treatment)&&!covered;
    if(!g.visible)return;
    // Independent vector treatment surface. The application supplies the
    // original success/failure frame and lifetime; this draw consumes no RNG.
    const y=-(entry.nativeSizing?.height??28)-8,phase=treatment.frame;
    if(treatment.success){
      const radius=7+(phase%4)*2;
      g.circle(0,y,radius).stroke({color:0xcffff0,width:1.5,alpha:1-(phase%4)*0.15});
      g.rect(-2,y-7,4,14).fill(0x50d6a5).rect(-7,y-2,14,4).fill(0x50d6a5);
    } else {g.circle(-5+phase,y-2,5).fill({color:0xc4c9d0,alpha:0.8}).circle(3+phase,y+1,6).fill({color:0x7a8596,alpha:0.8});}
  }

  function drawFood() {
    if(!careArt.size)return;
    const foods=source.getFoodFrame?.()??[],live=new Set(foods.map(f=>f.slot));
    for(const [slot,g] of foodGraphics)if(!live.has(slot)){g.destroy({children:true});foodGraphics.delete(slot);}
    const fit=raisingFieldViewport(fieldArt?.field,app.screen,12,cameraX);
    const scale=(fieldArt?.field?.nativePixelWorldScale??1)*fit.scale;
    for(const food of foods) {
      let g=foodGraphics.get(food.slot);
      if(!g){
        g=new PIXI.Container();g.eventMode='none';g.label=['Bone-in meat','Protein capsule','Celebration platter','Birthday cake'][food.kind??(food.protein?1:0)];
        g.addChild(new PIXI.Graphics().ellipse(0,2,10,3).fill({color:0x405039,alpha:0.22}));
        const sprite=new PIXI.Sprite();sprite.anchor.set(0.5,0.85);g.addChild(sprite);
        actorLayer.addChild(g);foodGraphics.set(food.slot,g);
      }
      const kind=food.kind??(food.protein?1:0),spoiled=food.freshness<=0,original=kind<2;
      // Celebration platter and cake have no original spoiled identity, so they
      // keep the existing desaturation rather than borrowing the food's.
      const art=careArt.get(spoiled&&original?`${FOOD_KINDS[kind]}-rot-${carePose()}`:`${FOOD_KINDS[kind]}-${food.quarter}`);
      const sprite=g.children[1];placeCare(sprite,art);
      sprite.width=art.width;sprite.height=art.height;sprite.y=-food.heightQ12/4096;
      sprite.tint=spoiled&&!original?0x8ca273:0xffffff;
      const point=raisingNativeToScreen(food.positionQ12,fieldArt?.field,app.screen,cameraX);
      if(point){g.position.set(point.x,point.y);g.scale.set(scale);g.zIndex=Math.round(food.positionQ12[1]/4096);}
    }
  }

  function drawCareTool(deltaMS) {
    if(!toolPreview)return;
    const tool=getSelectedTool();
    if(tool!=='clean')cleanFeedback=null;
    if(cleanFeedback){cleanFeedback.elapsed+=Math.min(100,Math.max(0,deltaMS));if(cleanFeedback.elapsed>=610)cleanFeedback=null;}
    const point=cleanFeedback?raisingNativeToScreen([cleanFeedback.point.x*4096,cleanFeedback.point.y*4096,0],fieldArt?.field,app.screen,cameraX):pointerPreview;
    const inside=point&&point.x>=0&&point.y>=0&&point.x<=app.screen.width&&point.y<=app.screen.height;
    toolPreview.visible=tool==='clean'&&Boolean(inside&&(cleanFeedback||!pointerPreview?.touch||pointerPreview?.held));
    if(!toolPreview.visible)return;
    const scale=getRaisingNativePixelScale(fieldArt?.field,app.screen);
    const art=careArt.get(`broom-${carePose()}`);placeCare(toolPreview,art);
    toolPreview.width=art.width*scale;toolPreview.height=art.height*scale;
    toolPreview.position.set(point.x,point.y);
  }

  app.stage.on("globalpointermove", moveDrag);
  app.stage.on("pointerup", finishDrag);
  app.stage.on("pointerupoutside", finishDrag);
  app.stage.on("pointercancel", finishDrag);
  app.ticker.add(updateAnimations);

  const unsubscribe = source.subscribe(sync);
  function cancelInput(){
    if(drag?.nativeHand)source.intents.endHand?.(drag.creatureId,{cancelled:true});
    else if(drag?.carried)source.intents.releaseCarry?.(drag.creatureId);
    if(drag)drag.entry.root.cursor='grab';
    drag=null;cameraDrag=null;
  }
  const cancelHiddenInput=()=>{if(globalThis.document?.hidden)cancelInput();};
  globalThis.addEventListener?.('blur',cancelInput);
  globalThis.document?.addEventListener('visibilitychange',cancelHiddenInput);
  const unobserveResize = stage.onResize(()=>{cancelInput();resize();});
  const unobserveContextLost = stage.onContextLost(() => {
    cancelInput();
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
        foodCount:foodGraphics.size,
        wasteCount:wasteGraphics.size,
        careArt:'LICENSED_PIXEL_FAITHFUL_WITH_AUTHORED_CELEBRATION',
        // Spoiled food, waste and the sweep share one clock so a QA run can
        // read the pose instead of comparing pixels. 0 while reduced motion.
        carePose:carePose(),
        careTextureCount:careArt.size,
        cleanToolVisible:toolPreview?.visible??false,
        nativeSizing: [...actors].map(([creatureId, entry]) => ({ creatureId,
          status: entry.nativeScale === null ? "UNVERIFIED_LEGACY_FALLBACK" : "SHARED_NATIVE_PIXEL_SCALE",
          screenPixelsPerNativePixel: entry.nativeScale,
          packedPixelsPerNativePixel: entry.nativeSizing?.packedPixelsPerNativePixel ?? null })),
        assetFailures,
        cameraX,
        characterArt: characterBundle?.getDiagnostics() ?? null,
        art: fieldArt?.getDiagnostics() ?? null,
        viewport: Object.freeze({ width: app.screen.width, height: app.screen.height })
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelInput();
      globalThis.removeEventListener?.('blur',cancelInput);
      globalThis.document?.removeEventListener('visibilitychange',cancelHiddenInput);
      cameraDrag = null;
      unsubscribe();
      unmarkScene();
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
      foodGraphics.clear();
      wasteGraphics.clear();
      silhouette.destroy();
      for (const sheet of sheets) sheet.destroy(false);
      sheets.clear();
      if (fieldArt?.displayObject.parent === productionArtLayer) {
        productionArtLayer.removeChild(fieldArt.displayObject);
      }
      void fieldArt?.dispose();
      fieldArt = null;
      void characterBundle?.dispose();
      void feedbackArt?.dispose();
      characterBundle = null;
      // The Application belongs to the stage and outlives this scene.
      latestFrame = null;
    }
  });
}
