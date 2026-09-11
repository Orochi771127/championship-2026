import { uiText } from "../text/uiText.js";
// Championship Modern -- standalone browser entry.
//
// This is the production standalone shell: the game boots, saves, and reloads
// entirely inside the Championship 2026 product boundary.
//
// The player model is direct manipulation, per ORIGINAL_RAISING_GAMEPLAY_CONTRACT:
// pick a tool, touch a creature, drag it between cages. No avatar, no D-pad, and
// no proximity rule anywhere in the product input path.
//
// VS2 added a second and third screen. This file is the only place that decides
// which view is mounted, and it holds the single PixiJS stage that every playable
// field is a scene on. There is no router: it reads the application's screen
// stack and swaps views.

// A static JSON import, deliberately not a runtime network request: Championship
// source holds no network authority, and a static import makes the one product
// catalog this build reads a visible, compile-time dependency.
//
// This is the transcribed ARM9 species table, not the three invented creatures
// that used to sit here. They were removed on 2026-09-03 at the Owner's
// direction: they were never in the cartridge.
import productEntities from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };

import { adaptFeedback } from "./championshipStandaloneMessages.js";
import { createChampionshipStandaloneApp } from "./championshipStandaloneApp.js";
import { createChampionshipClockDriver } from "./championshipClockDriver.js";
import { RAISING_CAGES } from "./cageRoster.js";
import { createRaisingHomeP1RView } from "./raisingHomeP1RView.js";
import { createRaisingPresentationSource } from "./raisingPresentationSource.js";
import { createGateHuntPresentationSource } from "./gateHuntPresentationSource.js";
import { CHAMPIONSHIP_SCREENS } from "./championshipScreenStack.js";
import { createGateSelectView, createHuntLoadoutView, createHuntFieldView } from "./vs2Screens.js";
import { createHuntResultView } from "./vs3Screens.js";
import { createShopView, createDatabaseView, createCageEditView } from "./vs4Screens.js";
import { createChampionshipPixiStage } from "../presentation/championshipPixiStage.js";
import { mountRaisingFieldPixiPresentation } from "../presentation/intRh2/createRaisingFieldPixiPresentation.js";
import { mountHuntFieldPixiPresentation } from "../presentation/vs2/createHuntFieldPixiPresentation.js";
import { mountBattleFieldPixiPresentation } from "../presentation/vs5/createBattleFieldPixiPresentation.js";
import {loadRegisteredBattleEffectArt,isLocalBattleEffectPreview} from '../presentation/battleEffectArt.js';
import {loadRegisteredRaisingFeedbackArt} from '../presentation/raisingFeedbackArt.js';
import {loadRegisteredCharacterHudArt} from '../presentation/characterHudArt.js';
import {loadRegisteredHuntFeedbackArt} from '../presentation/huntFeedbackArt.js';
import {mountBattleResultCharacters} from '../presentation/battleResultCharacters.js';
import {nativeBattleWinPercent} from '../battle/nativeTitleProgression.js';
import { mountBattleVfxThreeOverlay } from "../presentation/vs5/createBattleVfxThreeOverlay.js";
import { mountBattleAudioPresentation } from '../presentation/battleAudioPresentation.js';
// The battle menu box. Its four faces are ROM_VERIFIED from launcher13.nsbmd;
// the geometry is original-created, exactly as the Gate world sphere is.
import { mountBattleSelectThreePresentation } from "../presentation/vs5/createBattleSelectThreePresentation.js";
import { BATTLE_MENU_LABELS, speciesName, raisingDisplayName, starterName, titleEventText } from "../text/zhHant.js";
import { createBattleSelectView, createBattleFieldView, createBattleResultView } from "./vs5Screens.js";
import { createBattleRuntime } from "./battleRuntime.js";
import { mountGateSelectThreePresentation } from "../presentation/vs2/createGateSelectThreePresentation.js";
import { loadPixiCharacterRuntimeBundle } from "../presentation/pixiCharacterRuntimeBundle.js";
import { LICENSED_CHARACTER_ASSET_ID, LICENSED_CHARACTER_MANIFEST, loadLicensedCharacterRoster } from "../presentation/licensedCharacterRoster.js";
import { createChampionshipStatusBar } from "./championshipStatusBar.js";
import { createDigimonListView } from "./digimonListScreen.js";
import { createScheduleView } from "./scheduleScreen.js";
import { createChampionshipView } from "./championshipScreen.js";
import { BATTLE_OUTCOME_TEAM_ZERO_AHEAD, BATTLE_OUTCOME_TEAM_ONE_AHEAD } from "../battle/battleOutcome.js";
import { createHelpView } from "./helpScreen.js";
import { createTamerInfoView } from "./tamerInfoScreen.js";
import { createOpeningPresentation } from './openingPresentation.js';
import { lookupSpeciesIdentity } from "./phase1ProductCreatures.js";
// The cartridge's own Japanese species names, recovered from txt_list_txt.dat
// at species index + 33. See scripts/build-species-names.py.
import speciesNames from "../../data/championship/catalogs/species-names.r1.json" with { type: "json" };
import { TOOLBAR_MODES, createChampionshipToolbar } from "./championshipToolbar.js";
import {
  createRuntimeMapArtFieldLoader,
  createRuntimeMapArtTileSetLoader,
  validateRuntimeMapArtBundle
} from "../presentation/runtimeMapArtBundle.js";
import { createRaisingCageArtPlan } from "../presentation/raisingCageArtPlan.js";

const PIXI_V8_MODULE_URL = "../../../node_modules/pixi.js/dist/pixi.mjs";
const CHARACTER_REVIEW_RUNTIME_URL = new URLSearchParams(globalThis.location?.search ?? "").get("characterArtReview") === "m201"
  ? "assets/production/internal-character-review/m201-remix-v1/runtime.review.json"
  : null;
const LICENSED_HUNT_ART_MANIFEST_URL = "assets/production/hunt/licensed-runtime-v1/manifest.json";
const LICENSED_CAGE_ART_MANIFEST_URL = "assets/production/cage/licensed-runtime-v1/manifest.json";
const LICENSED_BATTLE_ART_MANIFEST_URL = "assets/production/battle/licensed-runtime-v1/manifest.json";
const HUNT_ART_PREVIEW_FIELD = new URLSearchParams(globalThis.location?.search ?? "").get("huntArt");
const CAGE_ART_PREVIEW_FIELD = new URLSearchParams(globalThis.location?.search ?? "").get("cageArt");
const BATTLE_ART_PREVIEW_FIELD = new URLSearchParams(globalThis.location?.search ?? "").get("battleArt");
const VFX_ART_PREVIEW_SYSTEM = new URLSearchParams(globalThis.location?.search ?? "").get("vfxArt");

const titleScreen = document.getElementById("cm-title");
const titleNote = document.getElementById("cm-title-note");
const newGameButton = document.getElementById("cm-new-game");
const continueButton = document.getElementById("cm-continue");
const root = document.getElementById("cm-root");
const loginButton=document.getElementById('cm-login');
const titleActions=titleScreen.querySelector('.cm-title__actions');
const openingPresentation=createOpeningPresentation({host:document.getElementById('cm-opening'),onStart:startNewGame});

let app = null;
let view = null;
let raisingSource = null;
let expeditionSource = null;
let unsubscribeScreen = null;
let unsubscribeExpedition = null;
let unsubscribeCalendar = null;
let mountedScreen = null;
let mounting = null;

// The one Pixi Application for the whole product. Created lazily on the first
// field mount and re-attached to whichever screen's field host is current.
let pixiStage = null;
let clockDriver = null;

// The one persistent status bar. It lives OUTSIDE #cm-root on purpose: every
// view calls root.replaceChildren() when it mounts, which would take the bar
// with it. The original's info_bar is Shared for the same reason -- no mode
// overlay owns it.
let statusBar = null;

// The contextual toolbar. Shared like the status bar: ui/toolbar.nxr is
// attached by the ARM9 main binary, not by any mode overlay.
let toolbar = null;

function note(message) {
  if (titleNote) titleNote.textContent = uiText(message);
}

async function ensurePixiStage(canvasHost) {
  const PIXI = await import(PIXI_V8_MODULE_URL);
  if (!pixiStage) pixiStage = await createChampionshipPixiStage({ PIXI, canvasHost });
  else pixiStage.attach(canvasHost);
  if (!clockDriver) {
    clockDriver = createChampionshipClockDriver({
      app, ticker: pixiStage.app.ticker,
      isVisible: () => document.visibilityState === "visible",
      isContextLost: () => pixiStage.contextLost,
      isModalOpen: () => toolbar?.getOpenMenuId() != null
    });
    pixiStage.onContextLost(() => clockDriver.reset());
    pixiStage.onContextRestored(() => {
      clockDriver.reset();
      delete root.dataset.fieldFallback;
    });
    document.addEventListener("visibilitychange", () => clockDriver.reset());
  }
  clockDriver.setActive(!root.hidden);
  return pixiStage;
}

async function loadOptionalCharacterReview(stage, speciesIds = [], sides=['main']) {
  if(sides.includes('sub')&&!isLocalBattleEffectPreview(location.href))return null;
  try {
    if (!CHARACTER_REVIEW_RUNTIME_URL) {
      const indexResponse = await fetch(new URL("assets/production/ART_PRODUCTION_INDEX.json", location.href));
      if (!indexResponse.ok) return null;
      const productionIndex = await indexResponse.json();
      if (!productionIndex.entries.some((entry) => entry.assetId === LICENSED_CHARACTER_ASSET_ID && entry.runtimeEligible === true)) return null;
      const manifestUrl = new URL(LICENSED_CHARACTER_MANIFEST, location.href).href;
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`CHARACTER_MANIFEST_HTTP_${response.status}`);
      return await loadLicensedCharacterRoster({ PIXI: stage.PIXI, speciesIds,sides,
        productionIndex, manifestUrl, manifest: await response.json() });
    }
    return await loadPixiCharacterRuntimeBundle({
      PIXI: stage.PIXI,
      runtimeUrl: CHARACTER_REVIEW_RUNTIME_URL,
      cachePrefix: "m201-internal-review:"
    });
  } catch (error) {
    console.warn(`CHAMPIONSHIP_CHARACTER_REVIEW_FALLBACK: ${error.message}`);
    return null;
  }
}

/**
 * Licensed Hunt pixels live under assets/production only.
 *
 * Normal Gate hunts use the native entry's resolved day/night field identity.
 * hm00 is the tutorial field, not a Gate biome; ?huntArt=field_hm00_01 still
 * overlays it for visual QA without inventing a Gate mapping or changing collision.
 */
async function loadOptionalHuntFieldArt(stage) {
  const wanted = HUNT_ART_PREVIEW_FIELD || app.getHuntRuntime()?.world.artFieldId
    || app.getConfirmedGate()?.originalFields?.dayFieldId || null;
  if (!wanted) return null;
  try {
    const response = await fetch(new URL(LICENSED_HUNT_ART_MANIFEST_URL, globalThis.location.href));
    if (!response.ok) throw new Error(`HUNT_ART_MANIFEST_HTTP_${response.status}`);
    const manifest = validateRuntimeMapArtBundle(await response.json());
    if (!manifest.fields.some((field) => field.fieldId === wanted)) return null;
    return createRuntimeMapArtFieldLoader({ PIXI: stage.PIXI }).load({ manifest, fieldId: wanted });
  } catch (error) {
    console.warn(`CHAMPIONSHIP_HUNT_ART_FALLBACK: ${error.message}`);
    return null;
  }
}

/**
 * Licensed Cage pixels live under assets/production only.
 *
 * The ranch is a COMPOSITE: the player's placed cages are drawn together, edge
 * to edge, because that is what the original shows -- several cages with their
 * own floor art reading as one continuous habitat. A single cage stretched to
 * fill the field was never the original layout, it was the shape the one-field
 * loader forced.
 *
 * Placement is PRODUCT_AUTHORED; see ranchSlotGeometry.js. `?cageArt=field_cm09_01`
 * still overlays one named field on its own for visual QA.
 */
async function loadOptionalCageFieldArt(stage) {
  try {
    const response = await fetch(new URL(LICENSED_CAGE_ART_MANIFEST_URL, globalThis.location.href));
    if (!response.ok) throw new Error(`CAGE_ART_MANIFEST_HTTP_${response.status}`);
    const manifest = validateRuntimeMapArtBundle(await response.json());
    const cageFrame = app.getCageEditFrame();
    const plan = createRaisingCageArtPlan({ manifest,
      placements: cageFrame?.placements ?? [],
      layoutVersion: cageFrame?.layoutVersion,
      unlockedCount: cageFrame?.unlockedCount,
      previewFieldId: CAGE_ART_PREVIEW_FIELD || null });
    return await createRuntimeMapArtTileSetLoader({ PIXI: stage.PIXI }).load({
      manifest,
      placements: plan.placements,
      residentViewport: plan.residentViewport,
      placementEvidence: plan.placementEvidence,
      presentationMode: plan.mode
    });
  } catch (error) {
    console.warn(`CHAMPIONSHIP_CAGE_ART_FALLBACK: ${error.message}`);
    return null;
  }
}

/**
 * Licensed Battle pixels live under assets/production only.
 *
 * Default is the current match arena's catalog field (today arenaIndex 0,
 * BATTLE_NORMAL / field_bm01_01). Match-to-arena mapping is untraced.
 * `?battleArt=field_bm07_01` overlays any stored field for visual QA.
 */
async function loadOptionalBattleFieldArt(stage, source) {
  const wanted = BATTLE_ART_PREVIEW_FIELD || source?.getFrame()?.arena?.field || null;
  if (!wanted) return null;
  try {
    const response = await fetch(new URL(LICENSED_BATTLE_ART_MANIFEST_URL, globalThis.location.href));
    if (!response.ok) throw new Error(`BATTLE_ART_MANIFEST_HTTP_${response.status}`);
    const manifest = validateRuntimeMapArtBundle(await response.json());
    if (!manifest.fields.some((field) => field.fieldId === wanted)) return null;
    return createRuntimeMapArtFieldLoader({ PIXI: stage.PIXI }).load({ manifest, fieldId: wanted });
  } catch (error) {
    console.warn(`CHAMPIONSHIP_BATTLE_ART_FALLBACK: ${error.message}`);
    return null;
  }
}

/**
 * Licensed Nitro VFX: verified prelude events drive the Hyper pair. `?vfxArt=`
 * retains the explicit independent asset preview. Unknown hit/weather bindings
 * are not inferred from HP changes.
 */
async function loadOptionalBattleVfxOverlay(host, stage, source, getFocusPlacement, getFieldPlacement) {
  try {
    return await mountBattleVfxThreeOverlay({
      host,
      stage,
      systemId: VFX_ART_PREVIEW_SYSTEM,
      source: VFX_ART_PREVIEW_SYSTEM ? null : source,
      getFocusPlacement,getFieldPlacement
    });
  } catch (error) {
    console.warn(`CHAMPIONSHIP_VFX_ART_FALLBACK: ${error.message}`);
    return null;
  }
}

/** Shared fallback: a field that cannot start must never take the screen with it. */
function fieldFallback(host, error) {
  root.dataset.fieldFallback = "true";
  const message = document.createElement("p");
  message.className = "int-rh2-field-fallback";
  message.textContent = uiText("The live field view is unavailable. Screen controls and save remain available.");
  host.append(message);
  console.warn(`CHAMPIONSHIP_PIXI_FALLBACK: ${error.message}`);
  return Object.freeze({
    render() {},
    getDiagnostics() {
      return Object.freeze({ renderer: "DOM_FALLBACK", applicationCount: 0, ticker: "NONE", threeUsed: false });
    },
    dispose() { message.remove(); }
  });
}

async function mountRaisingHome() {
  raisingSource = createRaisingPresentationSource(app);
  let hudArt=null;
  try{hudArt=await loadRegisteredCharacterHudArt({baseUrl:location.href});}
  catch(error){console.warn('Character HUD art unavailable',error);}
  const p1r = await createRaisingHomeP1RView({
    root,
    hudArt,
    source: raisingSource,
    async mountField({ host, source: fieldSource,onTrainingFrame }) {
      let characterBundle = null;
      let fieldArt = null;
      let feedbackArt = null;
      try {
        const stage = await ensurePixiStage(host);
        characterBundle = await loadOptionalCharacterReview(stage, fieldSource.getFrame().residents.map((resident) => resident.speciesId));
        fieldArt = await loadOptionalCageFieldArt(stage);
        try{feedbackArt=await loadRegisteredRaisingFeedbackArt({PIXI:stage.PIXI,baseUrl:location.href});}
        catch(error){console.warn('Raising reaction art unavailable',error);}
        delete root.dataset.fieldFallback;
        return await mountRaisingFieldPixiPresentation({
          stage,
          source: fieldSource,
          fieldArt,
          characterBundle,
          feedbackArt,
          getSelectedTool: () => toolbar?.getSelectedTool() ?? null,
          onTrainingFrame,
          onActorFrame:new URLSearchParams(location.search).get('presentation')==='developer'
            ? positions=>{host.dataset.residentScreenPositions=JSON.stringify(positions);}:null,
          onFallback(message) {
            root.dataset.fieldFallback = "true";
            console.warn(message);
          }
        });
      } catch (error) {
        void fieldArt?.dispose();
        void characterBundle?.dispose();
        void feedbackArt?.dispose();
        return fieldFallback(host, error);
      }
    }
  });

  // The invented five-button nav (CAGE / DATA / SHOP / BATTLE / GATES) was
  // removed on 2026-09-03. The original reaches those destinations through the
  // toolbar's two submenus, which createChampionshipToolbar now provides.

  return Object.freeze({
    render: p1r.render,
    inspect: p1r.inspect,
    dispose() {
      p1r.dispose();
    }
  });
}

async function mountHuntField() {
  return createHuntFieldView({
    root,
    source: expeditionSource,
    async mountField({ host, source: fieldSource, onActorFrame }) {
      let characterBundle = null;
      let fieldArt = null;
      let feedbackArt = null;
      try {
        const stage = await ensurePixiStage(host);
        characterBundle = await loadOptionalCharacterReview(stage,
          fieldSource.field.getView({ viewportWidth: stage.app.screen.width, viewportHeight: stage.app.screen.height })
            .wildCreatures.map((wild) => wild.speciesId));
        fieldArt = await loadOptionalHuntFieldArt(stage);
        try{feedbackArt=await loadRegisteredHuntFeedbackArt({PIXI:stage.PIXI,baseUrl:location.href});}
        catch(error){console.warn('Hunt tool reference art unavailable',error);}
        delete root.dataset.fieldFallback;
        return await mountHuntFieldPixiPresentation({
          onActorFrame,
          stage,
          source: fieldSource,
          fieldArt,
          feedbackArt,
          characterBundle,
          onFallback(message) {
            root.dataset.fieldFallback = "true";
            console.warn(message);
          }
        });
      } catch (error) {
        void feedbackArt?.dispose();
        void fieldArt?.dispose();
        void characterBundle?.dispose();
        return fieldFallback(host, error);
      }
    }
  });
}

// --- VS5 Auto Battle -------------------------------------------------------
// The runtime holds the chosen match and the live session between the three
// screens; the views below are handed only what they draw.
let battleRuntime = null;
let battleAttemptId = null;
let battleProgressBefore = null;

/**
 * A tournament round is an ordinary battle whose opponent came from the run's
 * own pool. Draw once, build the match on that team, then open the attempt.
 */
function enterChampionshipRound() {
  if (!pixiStage || pixiStage.contextLost || !pixiStage.app.ticker.started) {
    return { ok: false, reason: "BATTLE_NOT_READY", message: "遊戲場景尚未就緒，請返回育成場景後重試。" };
  }
  const run = app.getChampionshipRun();
  if (!run) return { ok: false, reason: "NO_CHAMPIONSHIP_RUNNING" };
  const drawn = app.drawChampionshipOpponent();
  if (!drawn.ok) return drawn;
  const rngPreparation = app.prepareBattleRng();
  const prepared = createBattleRuntime({ schedule: app.getBattleSchedule(), mode: 0, battleType: 0,
    rng: rngPreparation.rng });
  try {
    prepared.chooseChampionshipRound({ category: run.category, teamIndex: drawn.opponent.teamIndex });
    prepared.startMatch();
    const attemptId = `battle:${app.getBattleEconomyState().nextSequence}`;
    const result = app.enterChampionshipRound({ attemptId, opponent: drawn.opponent });
    if (result.ok && !result.duplicate) {
      battleRuntime?.dispose();
      battleRuntime = prepared;
      battleAttemptId = attemptId;
      battleProgressBefore = { rank: app.getTamerRank(), badges: app.getBattleBadges(),
        shopIds: app.getShopFrame().listings.map((item) => item.shopRecordIndex) };
    } else prepared.dispose();
    return result;
  } catch (error) {
    prepared.dispose();
    console.warn(`CHAMPIONSHIP_ROUND_PREPARE: ${error.message}`);
    return { ok: false, reason: "BATTLE_NOT_READY" };
  }
}

function mountBattleSelect() {
  battleRuntime?.dispose();
  battleRuntime = createBattleRuntime({ schedule: app.getBattleSchedule(), mode:1, battleType:0 });
  battleAttemptId = null;
  battleProgressBefore = null;
  return createBattleSelectView({
    root,
    matches: battleRuntime.listMatches(),
    getPartySelection:recordIndex=>({candidates:app.getBattlePartyCandidates(recordIndex),limit:app.getBattlePartyLimit(recordIndex)}),
    menuCopy: BATTLE_MENU_LABELS,
    onOpenChampionship() { app.openChampionship(); },
    onEnter(recordIndex,playerInstanceIds) {
      // Battle simulation uses this existing Application's ticker. Do not
      // charge for a session that cannot start advancing on the shared stage.
      if (!pixiStage || pixiStage.contextLost || !pixiStage.app.ticker.started) {
        return { ok: false, reason: "BATTLE_NOT_READY", message: "遊戲場景尚未就緒，請返回育成場景後重試。" };
      }
      const party=app.prepareBattleParty(recordIndex,playerInstanceIds);
      if(!party.ok)return party;
      const rngPreparation=app.prepareBattleRng();
      const prepared = createBattleRuntime({ schedule: app.getBattleSchedule(), mode:1, battleType:0,playerIndividuals:party.individuals,rng:rngPreparation.rng });
      try {
        prepared.chooseMatch(recordIndex);
        // Build before charging. startMatch creates the session but never ticks
        // it; a renderer subscribes only after registration succeeds.
        prepared.startMatch();
        const context = prepared.getEconomyContext();
        const attemptId = `battle:${app.getBattleEconomyState().nextSequence}`;
        const result = app.enterMatch({ ...context, attemptId,playerInstanceIds,rngPreparation });
        if (result.ok && !result.duplicate) {
          battleRuntime?.dispose();
          battleRuntime = prepared;
          battleAttemptId = result.attempt.attemptId;
          battleProgressBefore={rank:app.getTamerRank(),badges:app.getBattleBadges(),shopIds:app.getShopFrame().listings.map(item=>item.shopRecordIndex)};
        } else prepared.dispose();
        return { ...result, wallet: app.getShopFrame().bits, entryFee: context.entryFee };
      } catch (error) {
        prepared.dispose();
        if (error.message === "BATTLE_RUNTIME_MATCH_IS_NOT_OPEN") {
          return { ok: false, reason: "MATCH_NOT_AVAILABLE", message: "目前日期或參賽資格已改變，請重新選擇賽事。" };
        }
        console.warn(`CHAMPIONSHIP_BATTLE_PREPARE: ${error.message}`);
        return { ok: false, reason: "BATTLE_NOT_READY" };
      }
    },
    onExit() { app.leaveScreen(); },
    mountCube: mountBattleSelectThreePresentation
  });
}

async function mountBattleField() {
  const activeRuntime = battleRuntime;
  const activeAttemptId = battleAttemptId;
  const source = activeRuntime.startMatch();
  let hudArt=null;
  try{hudArt=await loadRegisteredCharacterHudArt({baseUrl:location.href});}
  catch(error){console.warn('Battle HUD reference unavailable',error);}
  const view = createBattleFieldView({
    root,
    frame: { ...source.getFrame(), rosterEvidence: activeRuntime.rosterEvidence() },
    hudArt,
    mountField({ host }) {
      let disposed = false;
      let scene = null;
      let vfxOverlay = null;
      let battleAudio = null;
      void (async () => {
        let fieldArt = null;
        let characterRoster = null;
        let effectArt = null;
        try {
          const stage = await ensurePixiStage(host);
          if (disposed) return;
          fieldArt = await loadOptionalBattleFieldArt(stage, source);
          if (disposed) {
            await fieldArt?.dispose();
            return;
          }
          characterRoster = await loadOptionalCharacterReview(stage,
            source.getFrame().combatants.filter(entry => entry.present && entry.speciesId).map(entry => entry.speciesId));
          if (disposed) {
            await fieldArt?.dispose();
            await characterRoster?.dispose();
            return;
          }
          delete root.dataset.fieldFallback;
          try {
            effectArt = await loadRegisteredBattleEffectArt({PIXI:stage.PIXI, baseUrl:location.href});
          } catch (error) {
            console.warn(`CHAMPIONSHIP_BATTLE_EFFECT_ART_FALLBACK: ${error.message}`);
          }
          if (disposed) {
            await effectArt?.dispose();await fieldArt?.dispose();await characterRoster?.dispose();return;
          }
          vfxOverlay = await loadOptionalBattleVfxOverlay(host, stage, source, () => scene?.getFocusPlacement(), () => scene?.getFieldPlacement());
          if (disposed) {
            await vfxOverlay?.dispose();await effectArt?.dispose();await fieldArt?.dispose();await characterRoster?.dispose();return;
          }
          battleAudio = await mountBattleAudioPresentation({source});
          scene = await mountBattleFieldPixiPresentation({ stage, source, fieldArt, characterRoster, effectArt,onView:frame=>view.render(frame) });
          if (disposed) {
            await battleAudio?.dispose();
            await vfxOverlay?.dispose();
            scene?.dispose();
            return;
          }
        } catch (error) {
          void fieldArt?.dispose();
          void characterRoster?.dispose();
          void effectArt?.dispose();
          void vfxOverlay?.dispose();
          void battleAudio?.dispose();
          if (disposed) return;
          // This scene owns the callback on the shared ticker. A failed mount
          // cannot claim a running or naturally resolving battle.
          root.dataset.fieldFallback = "true";
          console.warn(error);
        }
      })();
      return {
        dispose() {
          disposed = true;
          void vfxOverlay?.dispose();
          void battleAudio?.dispose();
          scene?.dispose();
        }
      };
    },
    onExit() {
      app.leaveScreen();
      battleRuntime?.dispose();
      battleRuntime = null;
      battleAttemptId = null;
    }
  });
  // The session advances itself; this repaints the DOM beside the scene and
  // moves on to the result once the battle has judged itself.
  activeRuntime.observe((observed) => {
    if (battleRuntime !== activeRuntime || battleAttemptId !== activeAttemptId) return;
    view.render(observed);
    if (observed.outcome.ended && app.getScreen() === CHAMPIONSHIP_SCREENS.BATTLE_FIELD) {
      app.finishMatch({ ...activeRuntime.getSettlementResult(), attemptId: activeAttemptId });
    }
  });
  return view;
}

async function mountBattleResult() {
  // The result consumes the app's actual receipt, including loss and clamping.
  const chosen = battleRuntime.getChosenMatch?.() ?? null;
  const record=app.getTitleProgress().record;
  const hudArt=await loadRegisteredCharacterHudArt({baseUrl:location.href}).catch(()=>null);
  const resultView=createBattleResultView({
    root,
    outcome: battleRuntime.outcome(),
    receipt: app.getBattleReceipt(),
    matchTitle: chosen ? titleEventText(chosen.recordIndex, "name", chosen.title) : null,
    hudArt,
    statistics:{battles:record?.battles??null,winPercent:nativeBattleWinPercent(record),titleCount:app.getBattleBadges().length},
    unlocks:battleProgressBefore?app.getShopFrame().listings.filter(item=>!battleProgressBefore.shopIds.includes(item.shopRecordIndex)).map(item=>({name:uiText(item.displayName)})):[],
    progression:battleProgressBefore?{rankBefore:battleProgressBefore.rank,rankAfter:app.getTamerRank(),
      earnedTitles:app.getBattleBadges().filter(id=>!battleProgressBefore.badges.includes(id)).map(id=>({id,name:titleEventText(id,'name',`頭銜 ${id}`)}))}:null,
    onExit() {
      battleRuntime?.dispose();
      battleRuntime = null;
      battleAttemptId = null;
      app.leaveScreen();
    }
  });
  let resultCharacters=null;
  try{
    const participants=battleRuntime.getResultParticipants(),stage=await ensurePixiStage(resultView.getCharacterHost());
    resultCharacters=await mountBattleResultCharacters({stage,hudArt,participants,won:battleRuntime.outcome().winningTeam===0});
  }catch(error){console.warn('Battle result character reference unavailable',error);}
  return {...resultView,dispose(){resultCharacters?.dispose();resultView.dispose();}};
}

async function mountGateSelect() {
  return createGateSelectView({
    root,
    source: expeditionSource,
    mountWorld: mountGateSelectThreePresentation
  });
}

/**
 * Mount the view for the current screen.
 *
 * Serialised through `mounting` because a field mount is asynchronous and a
 * player can leave a screen before it finishes; without this, a late mount could
 * attach a disposed view over a newer one.
 */
async function mountCurrentScreen() {
  const screen = app.getScreen();
  if (screen === mountedScreen) return;

  const previous = mounting;
  let release;
  mounting = new Promise((resolve) => { release = resolve; });
  await previous;

  try {
    const target = app.getScreen();
    view?.dispose?.();
    view = null;
    if (target !== CHAMPIONSHIP_SCREENS.RAISING_HOME) raisingSource = null;

    if (target === CHAMPIONSHIP_SCREENS.RAISING_HOME) view = await mountRaisingHome();
    else if (target === CHAMPIONSHIP_SCREENS.SHOP) view = createShopView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.DATABASE) view = createDatabaseView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.CAGE_EDIT) view = createCageEditView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.DIGIMON_LIST) view = createDigimonListView({
      root,
      entries: projectRoster(),
      onExit() { app.leaveScreen(); }
    });
    else if (target === CHAMPIONSHIP_SCREENS.CHAMPIONSHIP) {
      view = createChampionshipView({
        root,
        source: {
          getCategories: () => app.getChampionshipCategories(),
          getRun: () => app.getChampionshipRun(),
          intents: {
            open: (category) => app.beginChampionship(category),
            draw: () => app.drawChampionshipOpponent(),
            enterRound: () => enterChampionshipRound(),
            settle: () => app.settleChampionship(),
            leave: () => app.leaveScreen()
          }
        }
      });
    }
    else if (target === CHAMPIONSHIP_SCREENS.SCHEDULE) {
      view = createScheduleView({
        root,
        bits: app.getShopFrame()?.bits ?? null,
        calendar: app.getCalendar(),
        eligibleRecordIndices: app.getAvailableBattleRecordIndices(),
        progress:app.getTitleProgress(),
        onToggleRegistration(recordIndex){app.toggleTitleRegistration(recordIndex);return app.getTitleProgress();},
        onToggleChampionship(){app.toggleChampionshipRegistration();return app.getTitleProgress();},
        onExit() { app.leaveScreen(); }
      });
    }
    else if (target === CHAMPIONSHIP_SCREENS.HELP) view = createHelpView({
      root,
      onExit() { app.leaveScreen(); }
    });
    else if (target === CHAMPIONSHIP_SCREENS.TAMER_INFO) {
      // Only two of the eight fields have a traced source; the view draws the
      // rest at their ROM width rather than inventing a number.
      const shopFrame = app.getShopFrame?.() ?? null;
      view = createTamerInfoView({
        root,
        walletBits: Number.isInteger(shopFrame?.bits) ? shopFrame.bits : null,
        rosterCount: projectRoster().length,
        tamerRank: app.getTamerRank?.() ?? null,
        trainerName:app.getOpeningState()?.trainerName??null,
        onExit() { app.leaveScreen(); }
      });
    }
    else if (target === CHAMPIONSHIP_SCREENS.GATE_SELECT) view = await mountGateSelect();
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) view = createHuntLoadoutView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_FIELD) view = await mountHuntField();
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_RESULT) view = createHuntResultView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.BATTLE_SELECT) view = mountBattleSelect();
    else if (target === CHAMPIONSHIP_SCREENS.BATTLE_FIELD) view = await mountBattleField();
    else if (target === CHAMPIONSHIP_SCREENS.BATTLE_RESULT) view = await mountBattleResult();
    mountedScreen = target;
  } finally {
    release();
  }

  // A screen change that arrived while this mount was in flight.
  if (app.getScreen() !== mountedScreen) await mountCurrentScreen();
}

async function openGameplay() {
  titleScreen.hidden = true;
  root.hidden = false;

  unsubscribeExpedition?.();
  unsubscribeScreen?.();
  unsubscribeCalendar?.();
  expeditionSource = createGateHuntPresentationSource(app);

  // One subscription repaints the mounted view; a screen change swaps it.
  unsubscribeExpedition = expeditionSource.subscribe((frame) => {
    refreshStatusBar();
    if (frame.screen !== mountedScreen) return;
    if (frame.screen === CHAMPIONSHIP_SCREENS.RAISING_HOME) return;
    view?.render?.(frame);
  });
  let calendarKey = "";
  function refreshCalendarViews() {
    const calendar = app.getCalendar();
    const key = `${calendar.year}:${calendar.season}:${calendar.dayOfSeason}:${calendar.clockMinutes}:${app.getTamerRank()}`;
    if (key === calendarKey) return;
    calendarKey = key;
    refreshStatusBar();
    if (mountedScreen !== app.getScreen()) return;
    if (app.getScreen() === CHAMPIONSHIP_SCREENS.SCHEDULE) {
      view?.render?.({ calendar, eligibleRecordIndices: app.getAvailableBattleRecordIndices(),progress:app.getTitleProgress() });
    } else if (app.getScreen() === CHAMPIONSHIP_SCREENS.BATTLE_SELECT) {
      const current = createBattleRuntime({ schedule: app.getBattleSchedule(), mode:1, battleType:0 });
      view?.render?.({ matches: current.listMatches() });
      current.dispose();
    }
  }
  unsubscribeScreen = app.subscribeScreen(() => {
    refreshStatusBar(); refreshToolbarMode(); refreshCalendarViews(); void mountCurrentScreen();
  });
  unsubscribeCalendar = app.getSession().subscribeRaisingHome(refreshCalendarViews);

  if (!statusBar) {
    // No End Day here any more: the original puts it in the toolbar's
    // MANAGEMENT submenu, and that is where it now lives.
    statusBar = createChampionshipStatusBar({ root: document.body });
  }
  if (!toolbar) {
    toolbar = createChampionshipToolbar({
      root: document.body,
      onMenuEntry: runToolbarMenuEntry,
      getFoodStock:()=>{const rows=app.getShopFrame()?.listings??[];return {
        feed:rows.find(r=>r.shopRecordIndex===0)?.owned,protein:rows.find(r=>r.shopRecordIndex===1)?.owned,
        medicine:rows.find(r=>r.shopRecordIndex===2)?.owned,woundMedicine:rows.find(r=>r.shopRecordIndex===3)?.owned};},
      subscribeInventory:listener=>app.subscribeShop(listener)
    });
  }
  refreshStatusBar();
  refreshToolbarMode();

  mountedScreen = null;
  await mountCurrentScreen();
}

/**
 * Toolbar mode by screen.
 *
 * ROM_VERIFIED: mode 1 is TRAINING_RAISING (called by OVL18) and mode 2 is HUNT
 * (called by OVL0). No other overlay calls the toolbar initializer, so every
 * other screen hides the bar rather than inventing a third mode.
 */
function refreshToolbarMode() {
  if (!toolbar) return;
  const screen = app.getScreen();
  if (screen === CHAMPIONSHIP_SCREENS.RAISING_HOME) toolbar.setMode(TOOLBAR_MODES.TRAINING);
  // The active Hunt presenter already exposes the equipped controllers. The
  // historical neutral eight-slot rail has no commands and duplicated it.
  else if (screen === CHAMPIONSHIP_SCREENS.HUNT_FIELD && !app.getHuntRuntime()?.getToolState?.()) toolbar.setMode(TOOLBAR_MODES.HUNT);
  else toolbar.setMode(null);
}

/** Act on a submenu entry. Entries with no destination yet never reach here. */
function runToolbarMenuEntry(entry) {
  if(app.hasRaisingPresentation())return;
  if (entry.action === "END_DAY") {
    app.requestRaisingDayEnd();
    clockDriver?.reset();
    refreshStatusBar();
    return;
  }
  if (entry.action === "SAVE_AND_QUIT") {
    try {
      if (app.save().phase === "SAVED") void returnToTitle().catch(error=>console.warn(error));
    } catch (error) {
      console.warn(`CHAMPIONSHIP_SAVE_AND_QUIT: ${error.message}`);
    }
    return;
  }
  if (entry.screen === CHAMPIONSHIP_SCREENS.CAGE_EDIT) expeditionSource?.intents.openCageEdit();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.DATABASE) expeditionSource?.intents.openDatabase();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.SHOP) expeditionSource?.intents.openShop();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.GATE_SELECT) expeditionSource?.intents.openGate();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.BATTLE_SELECT) app.openBattle();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.DIGIMON_LIST) app.openDigimonList();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.SCHEDULE) app.openSchedule();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.HELP) app.openHelp();
  else if (entry.screen === CHAMPIONSHIP_SCREENS.TAMER_INFO) app.openTamerInfo();
}

/** Save & Quit returns to the title, which is where the original ends a session. */
async function returnToTitle() {
  clockDriver?.setActive(false);
  statusBar?.dispose();statusBar=null;
  unsubscribeCalendar?.();
  unsubscribeCalendar = null;
  toolbar?.setMode(null);
  battleRuntime?.dispose();
  battleRuntime = null;
  battleAttemptId = null;
  view?.dispose?.();
  view = null;
  mountedScreen = null;
  await app.dispose();
  root.hidden = true;
  titleScreen.hidden = false;
  openingPresentation.reset();loginButton.hidden=false;titleActions.hidden=true;
  newGameButton.disabled = false;
  refreshContinue();
}

/**
 * The roster the Digimon screen lists.
 *
 * One instance resolver shared with Raising Home. Species classification is
 * catalog data; persistent player HP/TP and growth profiles remain unknown.
 */
function projectRoster() {
  const snapshot = app.getSnapshot();
  if (!snapshot) return [];
  const NAME_BY_INDEX = projectRoster.speciesNameIndex ??= new Map(
    speciesNames.records.map((record) => [record.recordIndex, record.name])
  );
  const build = ({ instanceId, displayName, speciesId, profile, source }) => {
    const identity = lookupSpeciesIdentity(productEntities, speciesId);
    return {
      displayName: raisingDisplayName({ displayName, speciesId, source }),
      instanceId,
      stats: profile,
      identity: identity && {
        ...identity,
        // Eggs (0..7) and the four past the run carry no name; absent, not blank.
        speciesName: speciesName(identity.recordIndex, NAME_BY_INDEX.get(identity.recordIndex) ?? null),
        familyOrdinal: identity.familyBits === 0 ? null : Math.log2(identity.familyBits) + 1
      }
    };
  };
  return app.getRaisingInstances().map(build);
}

/** Repaint the four info_bar fields from the R2 snapshot and the current screen. */
function refreshStatusBar() {
  if (!statusBar) return;
  const screen = app.getScreen();
  const snapshot = app.getSession()?.getRaisingHomeSnapshot?.() ?? null;
  const reading = { screen };
  if (snapshot) {
    const display = app.getCalendar();
    reading.seasonName = display.seasonName;
    reading.dayNumber = display.dayNumber;
    reading.time = display.time;
  }
  statusBar.render(reading);
  // A day may only be closed from the Training side, matching where the
  // original puts the submenu that carries it.
  statusBar.setEndDayEnabled(
    screen === CHAMPIONSHIP_SCREENS.RAISING_HOME || screen === CHAMPIONSHIP_SCREENS.CAGE_EDIT
  );
}

/** Raising Home owns the only entries into Shop and the expedition flow. */
function installHomeEntries() {
  root.addEventListener("click", (event) => {
    const gate = event.target?.closest?.("[data-cm-action='open-gate']");
    if (gate) {
      event.preventDefault();
      expeditionSource?.intents.openGate();
      return;
    }
    const shop = event.target?.closest?.("[data-cm-action='open-shop']");
    if (shop) {
      event.preventDefault();
      expeditionSource?.intents.openShop();
      return;
    }
    const database = event.target?.closest?.("[data-cm-action='open-database']");
    if (database) {
      event.preventDefault();
      expeditionSource?.intents.openDatabase();
      return;
    }
    const battle = event.target?.closest?.("[data-cm-action='open-battle']");
    if (battle) {
      event.preventDefault();
      app.openBattle();
      return;
    }
    const cage = event.target?.closest?.("[data-cm-action='open-cage']");
    if (!cage) return;
    event.preventDefault();
    expeditionSource?.intents.openCageEdit();
  });
}

async function startNewGame(names={}) {
  newGameButton.disabled = true;
  continueButton.disabled = true;
  try {
    await app.newGame(names);
    await openGameplay();
    return true;
  } catch (error) {
    console.warn(error);
    newGameButton.disabled = false;
    refreshContinue();
    note(`無法開始新遊戲：${error.message}`);
    return false;
  }
}

async function continueGame() {
  newGameButton.disabled = true;
  continueButton.disabled = true;
  try {
    const resumed = await app.continueGame();
    if (!resumed) {
      note("That saved game could not be opened. Start a new game.");
      newGameButton.disabled = false;
      return;
    }
    await openGameplay();
  } catch (error) {
    console.warn(error);
    newGameButton.disabled = false;
    refreshContinue();
    note(`無法讀取存檔：${error.message}`);
  }
}

function refreshContinue() {
  const inspected = app.inspectSave();
  // `present` only means the JSON parsed. Ask whether the save will actually
  // open, so the button is never offered for a load that cannot succeed -- a
  // save written before a schema change is present and still unopenable.
  const { loadable, reason } = app.canContinue();
  continueButton.disabled = !loadable;
  continueButton.hidden=!loadable;
  if (inspected.present && !loadable) {
    note(`A saved game was found but this build cannot open it: ${reason} Start a new game.`);
  } else if (inspected.present) {
    note(`Saved game found: ${starterName(inspected.save.creature.displayName)}.`);
  } else if (inspected.error) {
    // A malformed save must never block New Game.
    note("A saved game was found but could not be read. You can start a new game.");
  } else {
    note("");
  }
}

function boot() {
  try {
    app = createChampionshipStandaloneApp({
      storage: window.localStorage,
      catalog: productEntities,
      cages: RAISING_CAGES
    });
  } catch (error) {
    console.warn(error);
    note(`Championship 2026 could not start: ${error.message}`);
    newGameButton.disabled = true;
    continueButton.disabled = true;
    return;
  }

  loginButton.addEventListener('click',()=>{loginButton.hidden=true;titleActions.hidden=false;refreshContinue();(continueButton.disabled?newGameButton:continueButton).focus({preventScroll:true});});
  newGameButton.addEventListener("click", () => { titleActions.hidden=true;note('');openingPresentation.begin(); });
  continueButton.addEventListener("click", () => { void continueGame(); });
  installHomeEntries();
  refreshContinue();
  loginButton.disabled=false;

  // Background/unload resets elapsed measurement. Only the existing explicit
  // Save / Save and Quit actions may persist the player's session.
  window.addEventListener("pagehide", () => clockDriver?.reset());
}

boot();

export { adaptFeedback };
