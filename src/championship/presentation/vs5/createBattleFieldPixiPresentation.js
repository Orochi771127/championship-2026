// VS5 -- Auto Battle scene on the single Championship Pixi stage.
//
// The screen is a 9:16 portrait frame divided into the five bands
// docs/contracts/championship/battle-field-presentation.v1.json declares. The
// original is a two-screen portrait stack -- every ROM background witness comes
// in a _main / _sub pair -- so a phone held upright is the faithful shape, and
// the bands above and below the field are what the second screen carried.
//
// WHY THE FIELD BAND IS 0.375 TALL
// --------------------------------
// A full-width band 0.375 of a 9:16 frame tall is exactly 3:2. That is the
// host the VS5 contract sizes. Native arena pixels are 52x34 cells / 416x272
// (26:17), so licensed art is contain-fit into this host -- small letterbox,
// nearest, never stretched to 3:2.
//
// THE SCENE DRAWS THE FIELD AND ONLY THE FIELD
// --------------------------------------------
// Its host IS the field band -- the DOM sizes that element at 3:2 from the same
// contract -- so the canvas is filled edge to edge with the arena and nothing
// else. The clock, the two HUD rows and the result belong to the DOM view, which
// owns screen UI here exactly as it does for the Hunt field. An earlier revision
// of this file drew all five bands inside the field band, which put a second
// copy of the HUD inside the arena; battleFrameRect and battleBandRect are still
// exported because the DOM needs the same geometry, but the scene no longer uses
// them to lay itself out.
//
// WHAT THIS DRAWS, AND WHAT IT REFUSES TO
// ---------------------------------------
// Every bar here is a field the battle lane traced to a ROM read site. There is
// no accuracy meter, no floating number over a hit and no command menu: the
// original has none of the three, and VS5 is Auto Battle, so nothing on screen
// may imply the viewer chooses. The one thing drawn that the ROM does not decide
// is WHERE the six stand -- states 4 and 5 carry that geometry and are untraced
// -- so the stand markers come from the presentation source, which labels them
// PRODUCT_AUTHORED.
//
// ART
// ---
// Licensed arena pixels load from assets/production/battle/licensed-runtime-v1
// via main.js. The presentation contract still names no file path. When those
// pixels are present they replace the procedural plate. Eligible character
// identities replace stand markers using native pixel sizing; missing identity
// or sizing retains the marker. Bounded raw character sequences follow existing
// dispatch events; original movement and launch timing remain partial.
// When arena pixels are absent, the scene draws product-authored neutral technical
// art. Ten of the eleven arenas share one common ring and BATTLE_CYBERSPACE has
// none, so the fallback ring is drawn only when the frame says the arena has
// that layer.
//
// Words are not drawn here at all: the stage's declared API is Container and
// Graphics, and every label on this screen belongs to the DOM view. The one
// exception is the dynamic presentation (OWNER_APPROVED_ADAPTATION 2026-10-12,
// presentation/battleFx/): its impact words, move callout and overhead bars
// are part of the played picture, follow the camera, and are localized through
// uiText by the caller.

import contract from "../../../../docs/contracts/championship/battle-field-presentation.v1.json" with { type: "json" };
import { prefersReducedMotion, currentQualityTier, flashScale as currentFlashScale } from '../presentationPreferences.js';
import {battleFocusViewport,drawBattleDigitalCurtain} from '../battleFocusViewport.js';
import {createBattleEffectSprites} from '../battleEffectSprites.js';
import {createBm03GroundShadows} from '../bm03GroundShadows.js';
import {createBattleFxCamera} from '../battleFx/battleFxCamera.js';
import {createBattleFxEventTracker} from '../battleFx/battleFxEvents.js';
import {createBattleFxLayer} from '../battleFx/battleFxLayer.js';

const PALETTE = Object.freeze({
  letterbox: 0x072f5e,
  ground: 0x123039,
  groundLow: 0x0d2530,
  ring: 0xd2ad5d,
  ringInner: 0x6fd0d8,
  engaged: 0xf0e0a8,
  teamZero: 0x6fd0d8,
  teamOne: 0xd88a6f,
  level: 0x8d8f9a
});

const TEMPORARY_ART_ID = "art:battle_field:vs5:procedural-neutral-arena";

function bandById(id) {
  const band = contract.bands.find((entry) => entry.id === id);
  if (!band) throw new TypeError(`The Battle field contract has no ${id} band`);
  return band;
}

/** Kept so a caller can ask what aspect this scene's host must be. */
export const BATTLE_FIELD_BAND = bandById("FIELD");
// Owner 2026-10-10: readability of the accepted original bodies on the full-field phone view.
// This presentation factor does not redefine native pixel density or simulation coordinates.
export const BATTLE_ORIGINAL_CHARACTER_DISPLAY_SCALE = contract.originalCharacterDisplay.scale;

function assertDependencies(stage, source) {
  if (!stage || !stage.PIXI || !stage.app || typeof stage.createSceneRoot !== "function"
    || typeof stage.onResize !== "function") {
    throw new TypeError("The Battle field requires the Championship Pixi stage");
  }
  if (!source || typeof source.getView !== "function" || typeof source.getFrame !== "function"
    || typeof source.tick !== "function") {
    throw new TypeError("The Battle field requires the VS5 battle presentation source");
  }
}

/**
 * The 9:16 frame inside a viewport of any shape.
 *
 * The screen is authored portrait, so a wider viewport gets pillarboxed rather
 * than stretched: the bands keep their proportions and the art keeps its aspect.
 */
export function battleFrameRect(viewportWidth, viewportHeight) {
  const target = contract.frame.referenceWidth / contract.frame.referenceHeight;
  const width = Math.min(viewportWidth, viewportHeight * target);
  const height = width / target;
  return Object.freeze({
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height
  });
}

/** A band's pixel rectangle inside that frame. */
export function battleBandRect(band, frame) {
  return Object.freeze({
    x: frame.x,
    y: frame.y + band.top * frame.height,
    width: frame.width,
    height: band.height * frame.height
  });
}

function drawStandMarkers(graphic, rect, view, renderedSlots = new Set()) {
  for (const combatant of view.combatants) {
    if (!combatant.present || renderedSlots.has(combatant.slot)) continue;
    const x = rect.x + combatant.stand.x * rect.width;
    const y = rect.y + combatant.stand.y * rect.height;
    const size = rect.height * 0.08;
    const colour = combatant.team === 0 ? PALETTE.teamZero : PALETTE.teamOne;
    graphic.ellipse(x, y + size * 0.9, size * 1.1, size * 0.36).fill({ color: 0x000000, alpha: 0.32 });
    graphic.circle(x, y, size).fill({ color: colour, alpha: combatant.down ? 0.25 : 0.95 });
    if (combatant.engaged) {
      graphic.circle(x, y, size * 1.45).stroke({ color: PALETTE.engaged, alpha: 0.8, width: 2 });
    }
  }
}

/**
 * Procedural fallback: a ground plate, the common ring when the arena has one,
 * and a stand marker per combatant.
 */
function drawField(graphic, rect, frame, view, renderedSlots) {
  graphic.rect(rect.x, rect.y, rect.width, rect.height).fill(PALETTE.ground);

  const centreX = rect.x + rect.width / 2;
  const centreY = rect.y + rect.height * 0.56;
  const radiusX = rect.width * 0.44;
  const radiusY = rect.height * 0.34;

  graphic.ellipse(centreX, centreY, radiusX, radiusY).fill({ color: PALETTE.groundLow, alpha: 0.9 });

  // Ten of eleven arenas share field_bm00_00_common. BATTLE_CYBERSPACE does not,
  // and drawing a ring for it would contradict the table.
  if (frame.arena.hasCommonLayer) {
    graphic.ellipse(centreX, centreY, radiusX, radiusY)
      .stroke({ color: PALETTE.ring, alpha: 0.9, width: Math.max(2, rect.height * 0.02) });
    graphic.ellipse(centreX, centreY, radiusX * 0.97, radiusY * 0.95)
      .stroke({ color: PALETTE.ringInner, alpha: 0.45, width: 1 });
  } else {
    // A rectangular frame instead, which is what that arena's art carries.
    graphic
      .rect(centreX - radiusX, centreY - radiusY, radiusX * 2, radiusY * 2)
      .stroke({ color: PALETTE.ringInner, alpha: 0.8, width: Math.max(2, rect.height * 0.018) });
  }

  drawStandMarkers(graphic, rect, view, renderedSlots);
}

/**
 * Mount the Auto Battle scene.
 *
 * The caller owns DOM screen UI and has already attached the stage to a field
 * host. This module owns its own scene and its own ticker callback, and removes
 * both on dispose.
 */
/**
 * `dynamicFx` (OWNER_APPROVED_ADAPTATION 2026-10-12) adds the following camera,
 * skill and field interaction, words, callouts and overhead bars over the same
 * battle at original proportions; false keeps the earlier fixed full-field
 * view (with its 1.5x bodies) exactly. `fx` carries the look-ups the layer
 * needs from outside this scene: describeMove(slot, moveId), nameOfSlot(slot),
 * moveNameOf(moveId, look), text(zhHant), and onEvent(event) for the DOM
 * record band.
 */
export async function mountBattleFieldPixiPresentation({ stage, source, fieldArt = null, characterRoster = null, effectArt = null, autoAdvance = true,
  onView = null, dynamicFx = false, fx = null, localTeam = 0, responsiveLayout = false,
  reducedMotion = prefersReducedMotion() }) {
  assertDependencies(stage, source);
  responsiveLayout = responsiveLayout && dynamicFx;
  if (fieldArt !== null && (!fieldArt.displayObject || typeof fieldArt.update !== "function"
    || typeof fieldArt.dispose !== "function" || typeof fieldArt.getDiagnostics !== "function"
    || !fieldArt.field)) {
    throw new TypeError("The Battle field art binding must be a loaded runtime map-art field");
  }
  const { app } = stage;

  const scene = stage.createSceneRoot("championship-battle-field");
  const productionArtLayer = new stage.PIXI.Container({ label: "bounded production battle art" });
  const letterbox = new stage.PIXI.Graphics();
  const graphic = new stage.PIXI.Graphics();
  const actorLayer = new stage.PIXI.Container({ label: "battle character identities" });
  const world = new stage.PIXI.Container({label:'battle field camera'});
  const curtain = new stage.PIXI.Graphics();
  const clip = new stage.PIXI.Graphics();
  actorLayer.sortableChildren = true;
  const shadowLayer = new stage.PIXI.Container({label:"bounded BM03 ground shadows"});
  // Dynamic presentation layers: ground dressing under the actors, glows and
  // particles over them (both in the camera's world), words and bars on screen.
  const fxBack = new stage.PIXI.Container({label:'battle fx ground'});
  const fxFront = new stage.PIXI.Container({label:'battle fx front'});
  const fxScreen = new stage.PIXI.Container({label:'battle fx screen'});
  world.addChild(productionArtLayer, graphic, fxBack, shadowLayer, actorLayer, fxFront);
  scene.addChild(letterbox,world,fxScreen,curtain,clip);
  world.mask=clip;
  if (fieldArt) productionArtLayer.addChild(fieldArt.displayObject);
  const effectSprites = effectArt ? createBattleEffectSprites({PIXI:stage.PIXI, parent:actorLayer, art:effectArt}) : null;
  const fxLayer = dynamicFx ? createBattleFxLayer({PIXI:stage.PIXI, worldBack:fxBack, worldFront:fxFront, screen:fxScreen,
    quality:currentQualityTier(), reducedMotion, responsiveLayout, flashScale:currentFlashScale(),
    describeMove:fx?.describeMove, nameOfSlot:fx?.nameOfSlot, moveNameOf:fx?.moveNameOf, text:fx?.text}) : null;
  // A failed FX capability probe has no camera: retain contain-fit fallback.
  responsiveLayout = responsiveLayout && Boolean(fxLayer);
  const director = fxLayer ? createBattleFxCamera({reducedMotion, responsiveLayout}) : null;
  const tracker = fxLayer ? createBattleFxEventTracker() : null;
  // The dynamic camera follows fighters wherever the original's movement takes
  // them, sometimes past the arena picture. Continue the floor with eight
  // mirrored, darkened copies of the arena (rendered once, no per-frame cost);
  // a mirror keeps every seam continuous. Presentation only.
  let continuation = null, continuationTexture = null;
  if (fxLayer && fieldArt) {
    try {
      const {worldWidthPx:W, worldHeightPx:H} = fieldArt.field;
      continuationTexture = app.renderer.generateTexture({target:fieldArt.displayObject, frame:new stage.PIXI.Rectangle(0, 0, W, H), resolution:0.5});
      continuation = new stage.PIXI.Container({label:'battle fx arena continuation'});
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        const tile = new stage.PIXI.Sprite(continuationTexture);
        tile.anchor.set(0.5); tile.tint = 0xb8b8b8;
        tile.width = W; tile.height = H;
        tile.scale.set((dx ? -1 : 1) * Math.abs(tile.scale.x), (dy ? -1 : 1) * Math.abs(tile.scale.y));
        tile.position.set(W / 2 + dx * W, H / 2 + dy * H);
        continuation.addChild(tile);
      }
      // A stepped fade outward from every arena edge: no hard seam at the edge,
      // darker the further the floor is from the real arena.
      const fade = new stage.PIXI.Graphics();
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const near = i / steps * 0.6, alpha = 0.05 + 0.055 * i, bandW = W * 0.6 / steps, bandH = H * 0.6 / steps;
        fade.rect(-W * near - bandW, -H, bandW, H * 3).fill({color:0x000000, alpha});
        fade.rect(W + W * near, -H, bandW, H * 3).fill({color:0x000000, alpha});
        fade.rect(0, -H * near - bandH, W, bandH).fill({color:0x000000, alpha});
        fade.rect(0, H + H * near, W, bandH).fill({color:0x000000, alpha});
      }
      fade.rect(-W, -H, W * 0.4, H * 3).fill({color:0x000000, alpha:0.6});
      fade.rect(W + W * 0.6, -H, W * 0.4, H * 3).fill({color:0x000000, alpha:0.6});
      fade.rect(0, -H, W, H * 0.4).fill({color:0x000000, alpha:0.6});
      fade.rect(0, H + H * 0.6, W, H * 0.4).fill({color:0x000000, alpha:0.6});
      continuation.addChild(fade);
      productionArtLayer.addChildAt(continuation, 0);
    } catch (error) {
      console.warn('CHAMPIONSHIP_BATTLE_FX_CONTINUATION_UNAVAILABLE', error?.message);
      continuation?.destroy({children:true}); continuationTexture?.destroy(true); continuation = continuationTexture = null;
    }
  }
  const slotInfos = new Map();
  let pendingDtMs = 0;
  let layoutDtMs = 0;
  const motionEvents = [];
  let lastCamera = null;

  let groundShadows = null;
  try { groundShadows = await createBm03GroundShadows({PIXI:stage.PIXI,parent:shadowLayer,fieldArt}); }
  catch(error) { console.warn("CHAMPIONSHIP_BM03_SHADOW_FALLBACK",error.message); }

  let disposed = false;
  let disposal = null;
  let frames = 0;
  let pendingFrames = 0;
  let resumeWithoutDelta = false;
  let lastTickerOpeningCue = null;
  const visibilityChanged=()=>{pendingFrames=0;resumeWithoutDelta=true;};
  // Nominal NDS VBlank cadence from the existing platform-clock receipt.
  // Consume the owning Pixi ticker; never create another scheduler.
  const nativeFrameMs = 1000 * 560190 / 33513982;
  let lastViewport = { width: 0, height: 0 };
  const actors = new Map();
  let focusPlacement = null;
  let fieldPlacement = null;

  function layoutCharacters(rect, view) {
    const rendered = new Set();
    slotInfos.clear();
    motionEvents.length = 0;
    groundShadows?.begin(rect);
    // Arena source pixels and sprite packed pixels have different enlargements.
    // Never size a creature using its atlas dimensions or a fixed circle radius.
    const nativeWidth = fieldArt?.field.nativeWidthPx;
    const nativeScale = nativeWidth > 0 ? rect.width / nativeWidth : null;
    for (const combatant of view.combatants) {
      let entry = actors.get(combatant.slot);
      if (entry && (!combatant.present || entry.speciesId !== combatant.speciesId)) {
        actorLayer.removeChild(entry.actor.sprite);
        entry.actor.sprite.destroy();
        entry.flashSprite?.destroy();
        actors.delete(combatant.slot);
        entry = null;
      }
      if (!combatant.present || !combatant.speciesId || !nativeScale) continue;
      if (!entry) {
        const actor = characterRoster?.createActor({ speciesId: combatant.speciesId, reducedMotion:false, presentation:'battle' });
        if (!actor) continue;
        entry = { actor, speciesId: combatant.speciesId };
        actors.set(combatant.slot, entry);
        actorLayer.addChild(actor.sprite);
      }
      const {sprite, nativeSizing} = entry.actor;
      const focus=view.specialPrelude?.slot===combatant.slot ? view.specialPrelude : null;
      const motion = entry.actor.battleAnimator?.apply({battleFrame:view.animationFrame ?? view.clock.frames,
        sequenceId:combatant.nativeAnimation?.sequenceId ?? focus?.sequence ?? combatant.animationRequest?.sequenceId,
        nativeSample:combatant.nativeAnimation??null,
        sequenceStartFrame:focus ? focus.startFrame+focus.sequenceStart : combatant.animationRequest?.sequenceStartFrame,
        sequenceInitialFrame:focus ? undefined : combatant.animationRequest?.sequenceInitialFrame,
        sequenceRequestId:focus ? null : combatant.animationRequest?.sequenceRequestId,
        nativeRequest:combatant.animationRequest?.nativeRequest===true,
        specialPrelude:Boolean(focus)});
      if (motion?.geometry.blank) {
        sprite.visible=false;if(entry.flashSprite)entry.flashSprite.visible=false;rendered.add(combatant.slot);continue;
      }
      const texture = sprite.texture;
      const packedScale = motion?.geometry.scale ?? nativeSizing?.packedPixelsPerNativePixel;
      const resolution = texture?.source?.resolution;
      // Owner 2026-10-12: the dynamic presentation keeps the original relative
      // size (no 1.5x); the camera brings fighters closer. Density-4 art keeps
      // its full resolution either way. The 1.5x remains in ?battleFx=classic.
      const displayScale = !fxLayer && nativeSizing?.evidence === "COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY"
        ? BATTLE_ORIGINAL_CHARACTER_DISPLAY_SCALE : 1;
      const scale = nativeScale * resolution / packedScale * displayScale;
      sprite.visible = Boolean(scale > 0 && Number.isFinite(scale) && texture?.orig);
      if (!sprite.visible) continue;
      const trim = texture.trim ?? {x:0,y:0,width:texture.orig.width,height:texture.orig.height};
      // stand.facing is the ported native state: +1 faces right (0x6dc is 1
      // when the facing angle is within 90 degrees of +X). Main is authored
      // facing left, so a right-facing actor is drawn mirrored, as the Raising
      // field does with the original body flip bit. Drawing +1 unmirrored had
      // every battler facing away from its opponent (Owner report 2026-10-05).
      const mirror = -combatant.stand.facing;
      let center = trim.x + trim.width / 2 - texture.orig.width * sprite.anchor.x;
      let bottom = trim.y + trim.height - texture.orig.height * sprite.anchor.y;
      if (motion) {
        const geometry=motion.geometry;
        sprite.anchor.x=geometry.origin[0]/geometry.sourceSize[0];
        sprite.anchor.y=geometry.origin[1]/geometry.sourceSize[1];
        // Retain one source origin across poses. Re-grounding each trimmed frame
        // would erase jumps and turn packing differences into visible jitter.
        center=(motion.baseBounds[0]+motion.baseBounds[2])/2*packedScale/resolution;
        bottom=motion.baseBounds[3]*packedScale/resolution;
      }
      const x = rect.x + combatant.stand.x * rect.width;
      const y = rect.y + combatant.stand.y * rect.height;
      // Dynamic presentation only: a hit squash and knock about the ground
      // anchor. The stand position the simulation owns is unchanged.
      const dress = fxLayer?.actorFx(combatant.slot) ?? null;
      sprite.scale.set(scale * mirror * (dress?.squashX ?? 1), scale * (dress?.squashY ?? 1));
      // Numeric rotation is written by the original reaction handler. This
      // projection changes no timing or physics and resets after its exit.
      sprite.rotation=Math.atan2(combatant.nativeMotion?.rotationSinQ12??0,
        combatant.nativeMotion?.rotationCosQ12??4096);
      const lift=(combatant.nativeMotion?.heightNativePx ?? 0)*nativeScale;
      sprite.position.set(x - center * scale * mirror * (dress?.squashX ?? 1) + (dress?.offsetX ?? 0),
        y - bottom * scale * (dress?.squashY ?? 1) - lift);
      sprite.zIndex = y;
      // Down remains a session fact; original effect/return-to-idle timing is separate.
      sprite.alpha = combatant.nativeMotion?.alpha ?? (combatant.down ? 0.35 : 1);
      const fxBrightness = fxLayer?.brightnessFor(combatant.slot) ?? 1;
      const brightness=Math.round((focus ? 255 : 255*(view.specialPrelude?.brightnessQ12 ?? 4096)/4096)*fxBrightness);
      const nativeTint=combatant.nativeMotion?.tintRgb;
      sprite.tint=nativeTint === undefined ? brightness*0x010101
        : ((Math.round((nativeTint>>16&255)*brightness/255)<<16)
          |(Math.round((nativeTint>>8&255)*brightness/255)<<8)|Math.round((nativeTint&255)*brightness/255));
      if (fxLayer) {
        // The brief hit flash: an additive white copy of the same frame.
        const glow = dress?.flash ?? 0;
        if (!entry.flashSprite && glow > 0) {
          entry.flashSprite = new stage.PIXI.Sprite(sprite.texture);
          entry.flashSprite.blendMode = 'add';
          actorLayer.addChild(entry.flashSprite);
        }
        if (entry.flashSprite) {
          const overlay = entry.flashSprite;
          overlay.visible = glow > 0.01 && sprite.visible;
          if (overlay.visible) {
            overlay.texture = sprite.texture;
            overlay.anchor.copyFrom(sprite.anchor);
            overlay.scale.copyFrom(sprite.scale);
            overlay.position.copyFrom(sprite.position);
            overlay.rotation = sprite.rotation;
            overlay.zIndex = sprite.zIndex + 0.01;
            overlay.tint = 0xffffff;
            overlay.alpha = Math.min(1, glow) * sprite.alpha;
          }
        }
        // Local-space box the camera frames and the layer dresses.
        const top = motion ? motion.baseBounds[1] * packedScale / resolution : trim.y - texture.orig.height * sprite.anchor.y;
        const bodyHeight = Math.max(8, (bottom - top) * scale);
        const bodyWidth = Math.max(8, (motion ? (motion.baseBounds[2] - motion.baseBounds[0]) * packedScale / resolution : trim.width) * scale);
        slotInfos.set(combatant.slot, {slot:combatant.slot, x, y:y-lift, groundY:y, liftNative:(combatant.nativeMotion?.heightNativePx ?? 0),
          top:y-lift-bodyHeight, height:bodyHeight, width:bodyWidth,
          facing:combatant.stand.facing, team:combatant.team, down:combatant.down,
          left:x-bodyWidth/2, right:x+bodyWidth/2, bottom:y});
      }
      if (fxLayer) {
        // Field interaction from the fighter's own native motion (never the
        // hit jitter): a landing when its height returns to the ground, run
        // dust while it moves fast on the ground, and an afterimage on a dash.
        const liftNative = combatant.nativeMotion?.heightNativePx ?? 0;
        const stand = {x, y}, previous = entry.lastStand, previousSprite = entry.lastSprite;
        entry.ghostMs = (entry.ghostMs ?? 0) + layoutDtMs;
        entry.stepMs = (entry.stepMs ?? 0) + layoutDtMs;
        if (previous && layoutDtMs > 0 && !combatant.down) {
          const dx = stand.x - previous.x;
          const speed = Math.hypot(dx, stand.y - previous.y) / layoutDtMs * 16.7 / Math.max(0.01, nativeScale);
          if ((entry.lastLift ?? 0) > 1.5 && liftNative <= 0.25) motionEvents.push({type:'LANDED', slot:combatant.slot});
          if (liftNative <= 0.25 && speed > 1.6 && entry.stepMs > 110) {
            entry.stepMs = 0;
            motionEvents.push({type:'STEP', slot:combatant.slot, direction:Math.sign(dx)});
          }
          if (previousSprite && speed > 3 && entry.ghostMs > 45) {
            entry.ghostMs = 0;
            fxLayer.ghost({...previousSprite, tint:combatant.team === localTeam ? 0x7cc8ff : 0xffa070});
          }
        }
        entry.lastStand = stand;
        entry.lastLift = liftNative;
        entry.lastSprite = {texture:sprite.texture, anchorX:sprite.anchor.x, anchorY:sprite.anchor.y,
          scaleX:sprite.scale.x, scaleY:sprite.scale.y, x:sprite.x, y:sprite.y, rotation:sprite.rotation};
      }
      // Baked casts are keyed by the drawn horizontal scale sign (+1 = authored
      // pixels, unmirrored), so the shadow takes the sprite's mirror, not stand.facing.
      const grounded=groundShadows?.update({slot:combatant.slot,actor:entry.actor,motion,facing:mirror,
        rotation:sprite.rotation,x,y,nativeScale,heightNativePx:combatant.nativeMotion?.heightNativePx,alpha:sprite.alpha});
      if(!grounded) graphic.ellipse(x, y + scale, trim.width * scale * 0.42, Math.max(1, trim.width * scale * 0.13))
        .fill({color:0x000000,alpha:0.22});
      rendered.add(combatant.slot);
    }
    groundShadows?.end();
    return rendered;
  }

  function layoutFieldArt() {
    if (!fieldArt) {
      productionArtLayer.visible = false;
      return null;
    }
    const { worldWidthPx, worldHeightPx } = fieldArt.field;
    // Keep particles, shadow anchors, native bodies and projectiles in one
    // stable presentation world while the existing camera handles rotation.
    if (responsiveLayout) {
      productionArtLayer.visible = true;
      productionArtLayer.scale.set(1);
      productionArtLayer.position.set(0, 0);
      return {x:0, y:0, width:worldWidthPx, height:worldHeightPx};
    }
    const fit = Math.min(app.screen.width / worldWidthPx, app.screen.height / worldHeightPx);
    productionArtLayer.visible = true;
    productionArtLayer.scale.set(fit);
    productionArtLayer.position.set(
      (app.screen.width - worldWidthPx * fit) / 2,
      (app.screen.height - worldHeightPx * fit) / 2
    );
    return {x:(app.screen.width-worldWidthPx*fit)/2, y:(app.screen.height-worldHeightPx*fit)/2,
      width:worldWidthPx*fit, height:worldHeightPx*fit};
  }

  function redraw() {
    if (disposed) return;
    const view = source.getView();
    onView?.({...view,openingFxVisible:Boolean(fxLayer && fieldArt && view.opening?.cue)});
    const frame = source.getFrame();
    lastViewport = { width: app.screen.width, height: app.screen.height };
    const rect = { x: 0, y: 0, width: app.screen.width, height: app.screen.height };
    const dtMs = pendingDtMs;
    pendingDtMs = 0;
    layoutDtMs = dtMs;

    letterbox.clear();
    graphic.clear();
    clip.clear().rect(0,0,rect.width,rect.height).fill(0xffffff);
    let artRect=rect;
    if (fieldArt) {
      // Under the dynamic camera the mirrored arena continues the floor; the
      // letterbox only shows beyond it, painted as a dark stage edge.
      letterbox.rect(rect.x, rect.y, rect.width, rect.height).fill(fxLayer ? 0x0a1419 : PALETTE.letterbox);
      artRect = layoutFieldArt();
      drawStandMarkers(graphic, artRect, view, layoutCharacters(artRect, view));
    } else {
      productionArtLayer.visible = false;
      drawField(graphic, rect, frame, view);
    }
    const nativeScale = artRect.width / (fieldArt?.field.nativeWidthPx ?? 416);
    // Dynamic presentation: events from this view, then the camera for it.
    let camera = {zoom:1, x:0, y:0};
    let fxContext = null;
    if (fxLayer && fieldArt) {
      const events = [...tracker.consume(view), ...motionEvents];
      camera = director.update({dtMs, viewport:{width:rect.width, height:rect.height}, art:artRect,
        subjects:[...slotInfos.values()], points:fxLayer.projectilePoints()});
      fxContext = {artRect, nativeScale, localTeam, opening:view.opening, viewport:{width:rect.width, height:rect.height},
        slotInfo:slot => slotInfos.get(slot) ?? null,
        opponentsOf:slot => view.combatants.filter(c => c.present && !c.down && c.team !== view.combatants[slot]?.team).map(c => c.slot),
        camera:{...camera, director}};
      fxLayer.update(view, fxContext, dtMs, events);
      for (const event of events) fx?.onEvent?.(event);
    }
    effectSprites?.update(view.nativeLifecycle?.effectActors ?? [], artRect,
      nativeScale, view.specialPrelude?.brightnessQ12 ?? 4096);
    const focus=view.specialPrelude;
    const actor=focus ? view.combatants[focus.slot] : null;
    // The original prelude zoom composes over the camera in screen space.
    const anchorLocalX=artRect.x+(actor?.stand.x??.5)*artRect.width, anchorLocalY=artRect.y+(actor?.stand.y??.5)*artRect.height;
    const prelude=battleFocusViewport({width:rect.width,height:rect.height,
      anchorX:camera.zoom*anchorLocalX+camera.x, anchorY:camera.zoom*anchorLocalY+camera.y,
      zoomQ12:focus?.zoomQ12,reducedMotion});
    const transform=Object.freeze({zoom:prelude.zoom*camera.zoom, x:prelude.zoom*camera.x+prelude.x, y:prelude.zoom*camera.y+prelude.y,
      anchorX:prelude.anchorX, anchorY:prelude.anchorY});
    world.scale.set(transform.zoom);
    world.position.set(transform.x,transform.y);
    lastCamera = fxLayer ? {...camera, total:transform.zoom} : null;
    const backdrop=fxLayer?.brightnessFor(null) ?? 1;
    const brightness=Math.round(255*(focus?.brightnessQ12??4096)/4096*backdrop);
    letterbox.tint=brightness*0x010101;
    productionArtLayer.tint=brightness*0x010101;
    graphic.tint=brightness*0x010101;
    if (fxLayer && fxContext) fxLayer.updateScreen({viewport:{width:rect.width, height:rect.height}, view,
      ctx:{...fxContext, camera:{zoom:transform.zoom, x:transform.x, y:transform.y, director}}, dtMs});
    drawBattleDigitalCurtain(curtain,rect.width,rect.height,focus,reducedMotion);
    focusPlacement=focus ? {...transform,nativeScale,
      width:rect.width,height:rect.height,reducedMotion}:null;
    fieldPlacement={...transform,artRect:{...artRect},width:rect.width,height:rect.height,
      nativeScale,reducedMotion};
  }

  function advance(ticker) {
    if (disposed) return;
    if(globalThis.document?.hidden){pendingFrames=0;resumeWithoutDelta=true;return;}
    if(resumeWithoutDelta){resumeWithoutDelta=false;pendingFrames=0;redraw();return;}
    const openingCue=source.getView().opening?.cue ?? null;
    if(openingCue && openingCue!==lastTickerOpeningCue){
      // Assets may become ready between callbacks. Present the first cue before
      // consuming any elapsed time from the task that loaded those assets.
      lastTickerOpeningCue=openingCue;pendingFrames=0;redraw();return;
    }
    // The battle stops itself: the source's session ends on a wipe or on the
    // clock passing 7200, and a stopped battle is still drawn.
    if (autoAdvance && !source.getFrame().outcome.ended) {
      const elapsed=ticker?.deltaMS??nativeFrameMs;
      if(!Number.isFinite(elapsed)||elapsed<0)throw new TypeError('BATTLE_INVALID_FRAME_ELAPSED');
      pendingFrames += elapsed/nativeFrameMs;
      while(pendingFrames+1e-9>=1 && !disposed && !source.getFrame().outcome.ended){
        pendingFrames=Math.max(0,pendingFrames-1);
        const beforeOpening=source.getView().opening;
        source.tick();
        frames += 1;
        if(beforeOpening?.armed && beforeOpening.phase!=='ACTIVE'){
          const afterOpening=source.getView().opening;
          // Never accumulate asset waits or skip a cue on a long foreground frame.
          if(beforeOpening.phase==='WAITING_ASSETS' || beforeOpening.phase!==afterOpening?.phase){pendingFrames=0;break;}
        }
      }
    }
    if(disposed)return;
    fieldArt?.update(ticker?.deltaMS ?? 0);
    // Presentation time for the dynamic layer; it keeps animating through the
    // original hit pause, when the battle frame itself holds still.
    pendingDtMs += Math.min(100, Math.max(0, ticker?.deltaMS ?? nativeFrameMs));
    lastTickerOpeningCue=source.getView().opening?.cue ?? null;
    redraw();
  }

  let unobserveResize=()=>{};
  // Inputs remain caller-owned until the first draw succeeds. The app already
  // releases them when this mount rejects; the scene only owns its new nodes.
  let ownsInputs=false;
  // Local verification only: ?battleFxDebug on a loopback host exposes this
  // scene's diagnostics to automated review captures.
  const debugHook = fxLayer && ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname)
    && String(globalThis.location?.search ?? '').includes('battleFxDebug');
  let presentation = null;
  if (debugHook) globalThis.__championshipBattleDiagnostics = () => presentation?.getDiagnostics();
  // Same loopback-only switch: a read-only per-slot record of the published
  // battle view (state, notification, world point, target, timers), used to
  // measure stalls in normal play. It reads; it never steps or writes.
  if (debugHook) globalThis.__championshipBattleState = () => {
    const view = source.getView(), flow = view.nativeLifecycle?.normalFlow?.slots ?? [];
    const reactions = view.nativeLifecycle?.reactions?.combatants ?? [];
    return {clock: view.clock?.frames ?? null, animationFrame: view.animationFrame ?? null, ended: !!view.outcome?.ended,
      slots: view.combatants.map((c, i) => c?.present ? {slot: i, team: c.team, speciesId: c.speciesId, name: c.displayName,
        hp: c.hp.current, sp: c.resource.current, cooldown: c.cooldown, status: c.status.code, down: c.down, engaged: c.engaged,
        state: flow[i]?.state ?? null, target: flow[i]?.targetSlot ?? null, point: flow[i]?.point ?? null,
        launches: flow[i]?.launches ?? null, notification: reactions[i]?.notification ?? null, counter: reactions[i]?.counter ?? null,
        suspended: reactions[i]?.suspended ?? null} : null)};
  };

  presentation = Object.freeze({
    /** Exposed so a test can drive the scene without a ticker. */
    redraw,
    advance,
    getFocusPlacement:()=>focusPlacement ? Object.freeze({...focusPlacement}) : null,
    getFieldPlacement:()=>fieldPlacement ? Object.freeze({...fieldPlacement,artRect:{...fieldPlacement.artRect}}) : null,

    getDiagnostics() {
      return Object.freeze({
        scene: "VS5_BATTLE_FIELD",
        contractVersion: contract.id,
        frames,
        pendingFrames,
        specialPrelude:source.getView().specialPrelude ?? null,
        focusPlacement,
        arena: source.getFrame().arena.identifier,
        outcome: source.getFrame().outcome,
        viewport: Object.freeze({ ...lastViewport }),
        effectSprites:effectSprites?.getDiagnostics() ?? null,
        dynamicFx:fxLayer ? Object.freeze({...fxLayer.getDiagnostics(), camera:lastCamera,
          bodies:[...slotInfos.values()].map(b=>Object.freeze({slot:b.slot,x:Math.round(b.x),groundY:Math.round(b.groundY),top:Math.round(b.top),width:Math.round(b.width)})),
          director:director.getState()}) : null,
        groundShadows:groundShadows?.getDiagnostics() ?? null,
        characters: Object.freeze([...actors].map(([slot, entry]) => Object.freeze({
          slot, speciesId: entry.speciesId, entityId: entry.actor.entityId,
          rendered: entry.actor.sprite.visible,
          position: Object.freeze({x:entry.actor.sprite.x,y:entry.actor.sprite.y}),
          alpha:entry.actor.sprite.alpha,tint:entry.actor.sprite.tint,
          nativeSizing: entry.actor.nativeSizing,
          animation: entry.actor.battleAnimator?.getSnapshot() ?? null,
          animationBinding: entry.actor.battleAnimator ? 'RAW_REQUESTS_EXISTING_DISPATCH_TIMING_PARTIAL'
            : "STATIC_IDENTITY_BATTLE_ACTIONS_REQUIRE_TRACE"
        }))),
        art: fieldArt
          ? Object.freeze({
            assetId: fieldArt.assetId,
            role: "LICENSED_PIXEL_RUNTIME",
            promoted: true,
            fieldId: fieldArt.field.fieldId
          })
          : Object.freeze({ assetId: TEMPORARY_ART_ID, role: "PROCEDURAL_FALLBACK", promoted: false })
      });
    },

    dispose() {
      if (disposed) return disposal;
      disposed = true;
      unobserveResize();
      globalThis.document?.removeEventListener?.('visibilitychange',visibilityChanged);
      app.ticker.remove(advance);
      if (fieldArt?.displayObject.parent === productionArtLayer) {
        productionArtLayer.removeChild(fieldArt.displayObject);
      }
      if (scene.parent) scene.parent.removeChild(scene);
      effectSprites?.dispose();
      continuation?.destroy({children:true}); continuationTexture?.destroy(true);
      fxLayer?.dispose();
      if (debugHook && globalThis.__championshipBattleDiagnostics) delete globalThis.__championshipBattleDiagnostics;
      if (debugHook && globalThis.__championshipBattleState) delete globalThis.__championshipBattleState;
      const shadowDisposal=groundShadows?.dispose();
      scene.destroy({ children: true });
      actors.clear();
      disposal=Promise.allSettled([...(ownsInputs
        ?[fieldArt?.dispose(),characterRoster?.dispose(),effectArt?.dispose()]:[]),shadowDisposal]);
      // The Application belongs to the stage and outlives this scene.
      return disposal;
    }
  });
  try {
    unobserveResize=stage.onResize(redraw);
    globalThis.document?.addEventListener?.('visibilitychange',visibilityChanged);
    app.ticker.add(advance);
    redraw();
    ownsInputs=true;
  } catch(error) {
    try{await presentation.dispose();}catch{/* Preserve the original mount error. */}
    throw error;
  }
  return presentation;
}
