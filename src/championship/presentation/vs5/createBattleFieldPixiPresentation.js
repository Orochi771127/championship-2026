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
// Graphics, and every label on this screen belongs to the DOM view.

import contract from "../../../../docs/contracts/championship/battle-field-presentation.v1.json" with { type: "json" };
import {battleFocusViewport,drawBattleDigitalCurtain} from '../battleFocusViewport.js';
import {createBattleEffectSprites} from '../battleEffectSprites.js';

const PALETTE = Object.freeze({
  letterbox: 0xd2ebe5,
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
export async function mountBattleFieldPixiPresentation({ stage, source, fieldArt = null, characterRoster = null, effectArt = null, autoAdvance = true,
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false }) {
  assertDependencies(stage, source);
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
  world.addChild(productionArtLayer, graphic, actorLayer);
  scene.addChild(letterbox,world,curtain,clip);
  world.mask=clip;
  if (fieldArt) productionArtLayer.addChild(fieldArt.displayObject);
  const effectSprites = effectArt ? createBattleEffectSprites({PIXI:stage.PIXI, parent:actorLayer, art:effectArt}) : null;

  let disposed = false;
  let disposal = null;
  let frames = 0;
  let pendingFrames = 0;
  // Nominal NDS VBlank cadence from the existing platform-clock receipt.
  // Consume the owning Pixi ticker; never create another scheduler.
  const nativeFrameMs = 1000 * 560190 / 33513982;
  let lastViewport = { width: 0, height: 0 };
  const actors = new Map();
  let focusPlacement = null;
  let fieldPlacement = null;

  function layoutCharacters(rect, view) {
    const rendered = new Set();
    // Arena source pixels and sprite packed pixels have different enlargements.
    // Never size a creature using its atlas dimensions or a fixed circle radius.
    const nativeWidth = fieldArt?.field.nativeWidthPx;
    const nativeScale = nativeWidth > 0 ? rect.width / nativeWidth : null;
    for (const combatant of view.combatants) {
      let entry = actors.get(combatant.slot);
      if (entry && (!combatant.present || entry.speciesId !== combatant.speciesId)) {
        actorLayer.removeChild(entry.actor.sprite);
        entry.actor.sprite.destroy();
        actors.delete(combatant.slot);
        entry = null;
      }
      if (!combatant.present || !combatant.speciesId || !nativeScale) continue;
      if (!entry) {
        const actor = characterRoster?.createActor({ speciesId: combatant.speciesId, reducedMotion, presentation:'battle' });
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
        sprite.visible=false;rendered.add(combatant.slot);continue;
      }
      const texture = sprite.texture;
      const packedScale = motion?.geometry.scale ?? nativeSizing?.packedPixelsPerNativePixel;
      const resolution = texture?.source?.resolution;
      const scale = nativeScale * resolution / packedScale;
      sprite.visible = Boolean(scale > 0 && Number.isFinite(scale) && texture?.orig);
      if (!sprite.visible) continue;
      const trim = texture.trim ?? {x:0,y:0,width:texture.orig.width,height:texture.orig.height};
      const facing = combatant.stand.facing;
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
      sprite.scale.set(scale * facing, scale);
      // Numeric rotation is written by the original reaction handler. This
      // projection changes no timing or physics and resets after its exit.
      sprite.rotation=Math.atan2(combatant.nativeMotion?.rotationSinQ12??0,
        combatant.nativeMotion?.rotationCosQ12??4096);
      const lift=(combatant.nativeMotion?.heightNativePx ?? 0)*nativeScale;
      sprite.position.set(x - center * scale * facing, y - bottom * scale - lift);
      sprite.zIndex = y;
      // Down remains a session fact; original effect/return-to-idle timing is separate.
      sprite.alpha = combatant.nativeMotion?.alpha ?? (combatant.down ? 0.35 : 1);
      const brightness=focus ? 255 : Math.round(255*(view.specialPrelude?.brightnessQ12 ?? 4096)/4096);
      const nativeTint=combatant.nativeMotion?.tintRgb;
      sprite.tint=nativeTint === undefined ? brightness*0x010101
        : ((Math.round((nativeTint>>16&255)*brightness/255)<<16)
          |(Math.round((nativeTint>>8&255)*brightness/255)<<8)|Math.round((nativeTint&255)*brightness/255));
      graphic.ellipse(x, y + scale, trim.width * scale * 0.42, Math.max(1, trim.width * scale * 0.13))
        .fill({color:0x000000,alpha:0.22});
      rendered.add(combatant.slot);
    }
    return rendered;
  }

  function layoutFieldArt() {
    if (!fieldArt) {
      productionArtLayer.visible = false;
      return null;
    }
    const { worldWidthPx, worldHeightPx } = fieldArt.field;
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
    const frame = source.getFrame();
    lastViewport = { width: app.screen.width, height: app.screen.height };
    const rect = { x: 0, y: 0, width: app.screen.width, height: app.screen.height };

    letterbox.clear();
    graphic.clear();
    clip.clear().rect(0,0,rect.width,rect.height).fill(0xffffff);
    let artRect=rect;
    if (fieldArt) {
      letterbox.rect(rect.x, rect.y, rect.width, rect.height).fill(PALETTE.letterbox);
      artRect = layoutFieldArt();
      drawStandMarkers(graphic, artRect, view, layoutCharacters(artRect, view));
    } else {
      productionArtLayer.visible = false;
      drawField(graphic, rect, frame, view);
    }
    effectSprites?.update(view.nativeLifecycle?.effectActors ?? [], artRect,
      artRect.width / (fieldArt?.field.nativeWidthPx ?? 416), view.specialPrelude?.brightnessQ12 ?? 4096);
    const focus=view.specialPrelude;
    const actor=focus ? view.combatants[focus.slot] : null;
    const transform=battleFocusViewport({width:rect.width,height:rect.height,
      anchorX:artRect.x+(actor?.stand.x??.5)*artRect.width,
      anchorY:artRect.y+(actor?.stand.y??.5)*artRect.height,
      zoomQ12:focus?.zoomQ12,reducedMotion});
    world.scale.set(transform.zoom);
    world.position.set(transform.x,transform.y);
    const brightness=Math.round(255*(focus?.brightnessQ12??4096)/4096);
    letterbox.tint=brightness*0x010101;
    productionArtLayer.tint=brightness*0x010101;
    graphic.tint=brightness*0x010101;
    drawBattleDigitalCurtain(curtain,rect.width,rect.height,focus,reducedMotion);
    focusPlacement=focus ? {...transform,nativeScale:artRect.width/(fieldArt?.field.nativeWidthPx??416),
      width:rect.width,height:rect.height,reducedMotion}:null;
    fieldPlacement={...transform,artRect:{...artRect},width:rect.width,height:rect.height,
      nativeScale:artRect.width/(fieldArt?.field.nativeWidthPx??416),reducedMotion};
  }

  function advance(ticker) {
    if (disposed) return;
    // The battle stops itself: the source's session ends on a wipe or on the
    // clock passing 7200, and a stopped battle is still drawn.
    if (autoAdvance && !source.getFrame().outcome.ended) {
      const elapsed=ticker?.deltaMS??nativeFrameMs;
      if(!Number.isFinite(elapsed)||elapsed<0)throw new TypeError('BATTLE_INVALID_FRAME_ELAPSED');
      pendingFrames += elapsed/nativeFrameMs;
      while(pendingFrames+1e-9>=1 && !disposed && !source.getFrame().outcome.ended){
        pendingFrames=Math.max(0,pendingFrames-1);
        source.tick();
        frames += 1;
      }
    }
    if(disposed)return;
    fieldArt?.update(ticker?.deltaMS ?? 0);
    redraw();
  }

  const unobserveResize = stage.onResize(redraw);
  app.ticker.add(advance);
  redraw();

  return Object.freeze({
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
      app.ticker.remove(advance);
      if (fieldArt?.displayObject.parent === productionArtLayer) {
        productionArtLayer.removeChild(fieldArt.displayObject);
      }
      if (scene.parent) scene.parent.removeChild(scene);
      effectSprites?.dispose();
      scene.destroy({ children: true });
      actors.clear();
      disposal=Promise.allSettled([fieldArt?.dispose(),characterRoster?.dispose(),effectArt?.dispose()]);
      // The Application belongs to the stage and outlives this scene.
      return disposal;
    }
  });
}
