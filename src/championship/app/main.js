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
import { mountBattleAudioPresentation } from '../presentation/battleAudioPresentation.js';
// The battle menu box. Its four faces are ROM_VERIFIED from launcher13.nsbmd;
// the geometry is original-created, exactly as the Gate world sphere is.
import { battleMenuLabels, speciesName, raisingDisplayName, starterName, titleEventText } from "../text/zhHant.js";
import { createBattleSelectView, createBattleFieldView, createBattleResultView } from "./vs5Screens.js";
import { loadPixiCharacterRuntimeBundle, createPixiAssetScope } from "../presentation/pixiCharacterRuntimeBundle.js";
import { applyQaUnlock, qaUnlockRequested } from "./qaUnlock.js";
import { listChampionshipGates } from "../gate/gateCatalog.js";
import { createChampionshipStatusBar } from "./championshipStatusBar.js";
import { createDigimonListView, appendCreatureDetail } from "./digimonListScreen.js";
import { createScheduleView } from "./scheduleScreen.js";
import { createChampionshipView } from "./championshipScreen.js";
import { BATTLE_OUTCOME_TEAM_ZERO_AHEAD, BATTLE_OUTCOME_TEAM_ONE_AHEAD } from "../battle/battleOutcome.js";
import { BATTLE_MATCH_LIST_CAP } from "../battle/battleMatchSelection.js";
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
import { createRanchCageArtPlan as createRaisingCageArtPlan } from "../presentation/raisingRanchArtPlan.js";
import { mountPortraitFrame } from './portraitFrame.js';
import { showChoiceDialog, isChoiceDialogOpen } from './uiDialog.js';
import { assetPrefetcher, withPrefetchedTextures } from './assetPrefetch.js';
import { createLoadWatchdog } from './loadWatchdog.js';
import { classifyBattleResultFeedback, HIGHLIGHT_DEFAULTS, highlightOverrides } from '../presentation/highlight/highlightTimeline.js';
import { createHighlightSequence } from '../presentation/highlight/createHighlightSequence.js';
import { createHighlightAudio } from '../presentation/highlight/highlightAudio.js';
import { createAutosaveScheduler } from './autosaveScheduler.js';
// Settings round (2026-09-29): player preferences, applied to the page, the
// one Pixi stage, the audio graph and the highlight template.
import { CHAMPIONSHIP_PREFERENCES_KEY, createChampionshipPreferencePort } from './ChampionshipPersistentSavePort.js';
import { createPreferenceStore } from './settings/preferenceStore.js';
import { createPreferenceEnvironment } from './settings/preferenceEnvironment.js';
import { createQualityController } from './settings/qualityController.js';
import { createSettingsPanel } from './settings/settingsPanel.js';
import { createAudioBus } from '../presentation/audioBus.js';
import { cappedPixelRatio, currentQuality, highlightMode, prefersReducedMotion } from '../presentation/presentationPreferences.js';
import { resultHeroAnchor, resultStageLight } from '../presentation/battleResultCharacters.js';
import { formatDateTime, formatList, onLocaleChange } from '../text/locale.js';
import { retranslate, setLabel, setText } from '../text/uiText.js';

const PIXI_V8_MODULE_URL = "../../../node_modules/pixi.js/dist/pixi.mjs";
// Three.js is about 2MB and only the bounded 3D views read it, so each mount is
// fetched the first time that view asks for one. The wrappers keep the same
// signature and return the same value the views already await.
const mountBattleVfxThreeOverlay = async (options) =>
  (await import("../presentation/vs5/createBattleVfxThreeOverlay.js")).mountBattleVfxThreeOverlay(options);
const mountBattleSelectThreePresentation = async (options) =>
  (await import("../presentation/vs5/createBattleSelectThreePresentation.js")).mountBattleSelectThreePresentation(options);
const mountGateSelectThreePresentation = async (options) =>
  (await import("../presentation/vs2/createGateSelectThreePresentation.js")).mountGateSelectThreePresentation(options);
const mountHighlightBurstThree = async (options) =>
  (await import("../presentation/highlight/createHighlightBurstThree.js")).mountHighlightBurstThree(options);

// battleRuntime reaches the character geometry, profiles, moves, presets and
// scripts -- about 3.7MB no screen before the battle menu reads. Every caller
// is already past that menu, so it is fetched then.
const loadBattleRuntime = async () => (await import("./battleRuntime.js")).createBattleRuntime;

// Deferring those modules buys a faster title at the cost of a slower first
// Hunt or Battle, which is the wait the player actually notices. So once a
// screen is up and the player is reading it, fetch them in the background: the
// module cache means the real entry then costs nothing. Failures are ignored --
// this is a head start, and every caller still awaits its own import.
// The Home screen's art arrives as a chain of dependent fetches: the production
// index, then a manifest for each family it draws from, then the care cells.
// None of it starts until the player has already asked for the cage, so the
// chain runs on the critical path -- measured on the deployed site over a 4G
// profile it was still fetching eight seconds after the cage was asked for, and
// the last link had not begun. Priming the same URLs while the player reads the
// title and the opening moves the whole chain off that path. It adds no bytes:
// the cage fetches exactly these, and warming only decides when.
//
// The ids are named rather than the paths so the index stays the one place that
// knows where a family lives. An id the index no longer carries simply warms
// nothing, which costs a cold fetch later and never a wrong one.
const HOME_ART_ASSET_IDS = Object.freeze([
  "art:cage:original-opus:v1",
  "art:raising-care:licensed-runtime:v1",
  "art:raising:care:r1",
  "art:toolbar:licensed-runtime:v1",
  "art:raising_home:int-rh2:temporary-presentation-bundle",
  "art:characters:licensed-internal:v1",
  "art:characters:hud:local-reference:v1",
  "art:vfx:raising-feedback:local-reference:v1",
  "art:ui:raising-header-material:tooling-pilot-r1"
]);
const RAISING_CARE_ASSET_ID = "art:raising-care:licensed-runtime:v1";

async function warmHomeArt() {
  const at = (path, base = location.href) => new URL(path, base).href;
  // Read each body so the response reaches the HTTP cache, but never parse it:
  // this is a head start, not a consumer, and parsing would spend the main
  // thread the warming is meant to protect.
  const prime = (href) => fetch(href, { priority: "low" }).then((r) => r.arrayBuffer()).catch(() => {});
  try {
    const index = await fetch(at("assets/production/ART_PRODUCTION_INDEX.json")).then((r) => r.json());
    const wanted = new Set(HOME_ART_ASSET_IDS);
    const entries = (index?.entries ?? []).filter((entry) => wanted.has(entry.assetId));
    const care = entries.find((entry) => entry.assetId === RAISING_CARE_ASSET_ID);
    await Promise.all(entries.filter((entry) => entry !== care).map((entry) => prime(at(entry.manifestPath))));
    if (!care) return;
    // The care cells are the last link in the chain and total about 10 KB, so
    // this manifest is the one worth reading rather than only caching.
    const manifest = at(care.manifestPath);
    const parsed = await fetch(manifest).then((r) => r.json()).catch(() => null);
    await Promise.all((parsed?.cells ?? []).map((cell) => prime(at(cell.file, manifest))));
  } catch {
    // A head start that fails costs the cold fetch it was avoiding, nothing more.
  }
}

let warmed = false;
function warmDeferredModules() {
  if (warmed) return;
  warmed = true;
  const warm = () => {
    for (const load of [
      () => import("./battleRuntime.js"),
      () => import("../hunt/capture/nativeHuntEntryTransaction.js"),
      () => import("../hunt/huntRuntime.js"),
      () => import("../battle/battleParty.js"),
      () => import("../presentation/licensedCharacterRoster.js"),
      () => import("../presentation/vs2/createGateSelectThreePresentation.js"),
      () => import("../presentation/vs5/createBattleSelectThreePresentation.js"),
      () => import("../presentation/vs5/createBattleVfxThreeOverlay.js"),
      () => import("../modes/createChampionshipModeShell.js"),
      () => import(PIXI_V8_MODULE_URL)
    ]) load().catch(() => {});
    void warmHomeArt();
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 1200);
}

const CHARACTER_REVIEW_RUNTIME_URL = new URLSearchParams(globalThis.location?.search ?? "").get("characterArtReview") === "m201"
  ? "assets/production/internal-character-review/m201-remix-v1/runtime.review.json"
  : null;
const LICENSED_HUNT_ART_MANIFEST_URL = "assets/production/hunt/licensed-runtime-v1/manifest.json";
// Owner 2026-10-06: the original Blender cage fields (opus rounds r1-r17) replace the
// licensed pixel fields at runtime; licensed-runtime-v1 stays stored for comparison.
const CAGE_ART_MANIFEST_URL = "assets/production/cage/original-opus-v1/manifest.json";
const LICENSED_BATTLE_ART_MANIFEST_URL = "assets/production/battle/licensed-runtime-v1/manifest.json";
const HUNT_ART_PREVIEW_FIELD = new URLSearchParams(globalThis.location?.search ?? "").get("huntArt");
const CAGE_ART_PREVIEW_FIELD = new URLSearchParams(globalThis.location?.search ?? "").get("cageArt");
const BATTLE_ART_PREVIEW_FIELD = new URLSearchParams(globalThis.location?.search ?? "").get("battleArt");
const VFX_ART_PREVIEW_SYSTEM = new URLSearchParams(globalThis.location?.search ?? "").get("vfxArt");
// Free and Practice battles run the original personality wiring (2026-10-05):
// personality picks the target selector and temper threshold, the team policy
// picks the AI profile. Every other mode keeps the baseline. ?battlePolicy=baseline
// returns these two modes to the baseline so the two can be compared.
const FREE_PRACTICE_PERSONALITY_POLICY =
  new URLSearchParams(globalThis.location?.search ?? "").get("battlePolicy") === "baseline" ? "BASELINE" : "ORIGINAL";

const titleScreen = document.getElementById("cm-title");
const titleNote = document.getElementById("cm-title-note");
const newGameButton = document.getElementById("cm-new-game");
const continueButton = document.getElementById("cm-continue");
const root = document.getElementById("cm-root");
mountPortraitFrame();
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
// Keeps the bar's bits and save readout current between screen changes.
let unsubscribeHud = null;
// Local autosave after important operations (2026-09-29); one per session.
let autosave = null;
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

// ---- Settings (2026-09-29) --------------------------------------------------
// One preference store, written only through the preference port beside the
// save port (a different key: settings can never overwrite progress). The
// environment turns it into page attributes; the quality controller owns
// data-quality; the audio bus applies the volume and mute to every sound.
function bootSettings() {
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  let port;
  try { port = createChampionshipPreferencePort({ storage }); }
  catch {
    // Storage is blocked (a privacy mode or a policy): the settings still
    // work for this visit, and say that they are not kept.
    port = Object.freeze({
      storageKey: CHAMPIONSHIP_PREFERENCES_KEY,
      read: () => Object.freeze({ text: null, error: "STORAGE_UNAVAILABLE" }),
      write: () => Object.freeze({ ok: false, error: "STORAGE_UNAVAILABLE" })
    });
  }
  const store = createPreferenceStore({ port });
  const quality = createQualityController({ preference: store.get().quality });
  const environment = createPreferenceEnvironment({ store, quality });
  const levels = () => ({ muted: store.get().muted, masterVolume: store.get().masterVolume, sfxVolume: store.get().sfxVolume });
  const audio = createAudioBus({ levels: levels() });
  store.subscribe((values, changed) => {
    if (changed.some((id) => id === "muted" || id === "masterVolume" || id === "sfxVolume")) audio.setLevels(levels());
  });
  quality.subscribe((described) => { pixiStage?.setResolutionCap(described.parameters.pixiResolutionCap); });
  // Another tab changed the settings: follow it, without writing back.
  window.addEventListener("storage", (event) => { if (event.key === CHAMPIONSHIP_PREFERENCES_KEY) store.reload(); });
  const flush = () => { try { store.flush(); } catch { /* reported by the store */ } };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  return Object.freeze({ store, environment, quality, audio });
}
const settings = bootSettings();

// When a quality sample may count: the screen is mounted and settled, the
// page is visible, and nothing is loading. A screen change restarts the clock.
let screenChangedAt = 0;
function sceneIsSettled() {
  if (document.visibilityState !== "visible" || !app || root.hidden) return false;
  if (!mountedScreen || mountedScreen !== app.getScreen() || view?.isPlayable === false) return false;
  if (performance.now() - screenChangedAt < 4000) return false;
  return !root.querySelector(".cm-vs2-field__loading:not([hidden])");
}

let settingsPanel = null;
function openSettings(from = null) {
  settingsPanel ??= createSettingsPanel({
    store: settings.store,
    environment: settings.environment,
    audio: settings.audio,
    quality: settings.quality,
    getSaveStatus: saveStatusLine,
    confirm: showChoiceDialog
  });
  settingsPanel.open({ from });
}

/** The save facts the Data & Account page shows, as a key and its values. */
function saveStatusLine() {
  const status = app?.savePort?.getStatus?.();
  if (!status || !app?.getSession?.()) return { key: "目前沒有進行中的遊戲。" };
  const when = status.savedAt ? formatDateTime(status.savedAt) : null;
  if (status.phase === "SAVE_FAILED") return { key: "上次保存失敗；可在畫面上方的保存狀態重試。" };
  if (status.phase === "SAVED" || status.phase === "RESTORED") return when ? { key: "已存到本機（{time}）。", params: { time: when } } : { key: "已存到本機。" };
  return { key: "上次寫入後遊戲又有進展，重要操作或離開頁面時會保存。" };
}

function note(message) {
  if (titleNote) setText(titleNote, message);
}

async function ensurePixiStage(canvasHost, signal) {
  const PIXI = await import(PIXI_V8_MODULE_URL);
  signal?.throwIfAborted();
  if (!pixiStage) {
    // The quality tier chooses the resolution cap (changeable later) and the
    // antialiasing (fixed for the Application's life: next launch).
    const tier = currentQuality();
    pixiStage = await createChampionshipPixiStage({ PIXI, canvasHost, resolutionCap: tier.pixiResolutionCap, antialias: tier.pixiAntialias });
    // "Auto" may step down once if frames stay long on a settled scene.
    settings.quality.attachTicker(pixiStage.app.ticker, { isStable: sceneIsSettled });
  }
  else pixiStage.attach(canvasHost);
  if (!clockDriver) {
    clockDriver = createChampionshipClockDriver({
      app, ticker: pixiStage.app.ticker,
      isVisible: () => document.visibilityState === "visible",
      isContextLost: () => pixiStage.contextLost,
      // The Management/System panel is a non-blocking toolbar overlay. Keeping
      // it open must not stop raising time or resident simulation.
      // Browser asset latency is outside the native clock. A screen publication
      // can precede its awaited mount; discard that interval without catch-up.
      isSceneReady: () => mountedScreen === app.getScreen() && view?.isPlayable !== false
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
  const PIXI = createPixiAssetScope(stage.PIXI);
  try {
    if (!CHARACTER_REVIEW_RUNTIME_URL) {
      // The roster module carries the battle character geometry and sizing --
      // about 1.9MB the title screen and the ranch never read -- so it is
      // fetched when a character bundle is actually wanted.
      const { LICENSED_CHARACTER_ASSET_ID, LICENSED_CHARACTER_MANIFEST, loadLicensedCharacterRoster } =
        await import("../presentation/licensedCharacterRoster.js");
      const indexResponse = await fetch(new URL("assets/production/ART_PRODUCTION_INDEX.json", location.href));
      if (!indexResponse.ok) return null;
      const productionIndex = await indexResponse.json();
      if (!productionIndex.entries.some((entry) => entry.assetId === LICENSED_CHARACTER_ASSET_ID && entry.runtimeEligible === true)) return null;
      const manifestUrl = new URL(LICENSED_CHARACTER_MANIFEST, location.href).href;
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`CHARACTER_MANIFEST_HTTP_${response.status}`);
      const rosterOptions={PIXI,speciesIds,sides,productionIndex,manifestUrl,manifest:await response.json()};
      if(new URLSearchParams(location.search).get('characterArtReview')==='m001'
        && ['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
        const {loadM001CharacterArtReview}=await import('../presentation/m001CharacterArtReview.js');
        return await loadM001CharacterArtReview(rosterOptions,location.href);
      }
      if(['m002','m003','m004','m005','m006','m007','m008','m009','m010','m011','m012','m101','m102','m103','m104','m105'].includes(new URLSearchParams(location.search).get('characterArtReview'))
        && ['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
        const {loadCandidateCharacterArtReview}=await import('../presentation/candidateCharacterArtReview.js');
        return await loadCandidateCharacterArtReview(rosterOptions,location.href);
      }
      return await loadLicensedCharacterRoster(rosterOptions);
    }
    return await loadPixiCharacterRuntimeBundle({
      PIXI,
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
async function loadOptionalHuntFieldArt(stage, { signal = null, onProgress = null } = {}) {
  const wanted = HUNT_ART_PREVIEW_FIELD || app.getHuntRuntime()?.world.artFieldId
    || app.getConfirmedGate()?.originalFields?.dayFieldId || null;
  if (!wanted) return null;
  let frameUrls = [];
  try {
    const response = await fetch(new URL(LICENSED_HUNT_ART_MANIFEST_URL, globalThis.location.href), { signal });
    if (!response.ok) throw new Error(`HUNT_ART_MANIFEST_HTTP_${response.status}`);
    const manifest = validateRuntimeMapArtBundle(await response.json());
    const field = manifest.fields.find((entry) => entry.fieldId === wanted);
    if (!field) return null;
    // The map frames are the heavy part of a Hunt (about a megabyte each).
    // Streaming them first gives the loading screen real progress on a slow
    // link, and the texture loader then reads the same bytes instead of
    // downloading them again.
    frameUrls = field.frames.map((frame) => new URL(frame.src.replaceAll("\\", "/"), globalThis.location.href).href);
    const report = () => onProgress?.(assetPrefetcher.progress(frameUrls));
    const stopReporting = assetPrefetcher.subscribe(report);
    try { await assetPrefetcher.fetchAll(frameUrls, { signal }); } finally { stopReporting(); }
    if (signal?.aborted) return null;
    const PIXI = withPrefetchedTextures(createPixiAssetScope(stage.PIXI), (url) => assetPrefetcher.blobOf(url));
    return await createRuntimeMapArtFieldLoader({ PIXI }).load({ manifest, fieldId: wanted });
  } catch (error) {
    if (!signal?.aborted) console.warn(`CHAMPIONSHIP_HUNT_ART_FALLBACK: ${error.message}`);
    return null;
  } finally {
    // Textures now hold the pixels; the downloaded copies can go.
    assetPrefetcher.forget(frameUrls);
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
    const response = await fetch(new URL(CAGE_ART_MANIFEST_URL, globalThis.location.href));
    if (!response.ok) throw new Error(`CAGE_ART_MANIFEST_HTTP_${response.status}`);
    const manifest = validateRuntimeMapArtBundle(await response.json());
    const cageFrame = app.getCageEditFrame();
    const plan = createRaisingCageArtPlan({ manifest,
      placements: cageFrame?.placements ?? [],
      layoutVersion: cageFrame?.layoutVersion,
      unlockedCount: cageFrame?.unlockedCount,
      expansion: cageFrame?.expansion ?? null,
      previewFieldId: CAGE_ART_PREVIEW_FIELD || null });
    return await createRuntimeMapArtTileSetLoader({ PIXI: stage.PIXI }).load({
      manifest,
      placements: plan.placements,
      residentViewport: plan.residentViewport,
      wrapWidthPx: plan.wrapWidthPx,
      ...(plan.fold ? { fold: plan.fold } : {}),
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
    isPlayable: false,
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
    // The full record in the detail sheet is the roster's own projection and
    // row renderer, so Home and the roster can never disagree.
    getRosterEntry: (creatureId) => projectRoster().find((entry) => entry.instanceId === creatureId) ?? null,
    renderCreatureDetail: appendCreatureDetail,
    openRoster: () => runToolbarMenuEntry({ id: "digimon", screen: CHAMPIONSHIP_SCREENS.DIGIMON_LIST }),
    // The select hint is for the first day of a new game, read from the game's
    // own calendar rather than a private storage flag (one save, one writer).
    firstRunHint: (() => { const c = app.getCalendar(); return (c.year ?? 0) === 0 && c.season === 0 && c.dayOfSeason === 0; })(),
    async mountField({ host, source: fieldSource,onTrainingFrame }) {
      let characterBundle = null;
      let fieldArt = null;
      let feedbackArt = null;
      try {
        const stage = await ensurePixiStage(host);
        // The three art loads need the stage and nothing from each other, but
        // they were awaited in a row, so Home waited out three manifest chains
        // end to end. Run them together. Settling rather than racing keeps the
        // catch below able to dispose whatever did load when one of them fails.
        const [review, cage, reactions] = await Promise.allSettled([
          loadOptionalCharacterReview(stage, fieldSource.getFrame().residents.map((resident) => resident.speciesId)),
          loadOptionalCageFieldArt(stage),
          loadRegisteredRaisingFeedbackArt({ PIXI: stage.PIXI, baseUrl: location.href })
        ]);
        characterBundle = review.status === "fulfilled" ? review.value : null;
        fieldArt = cage.status === "fulfilled" ? cage.value : null;
        // Reaction art has always been optional: Home draws without it.
        feedbackArt = reactions.status === "fulfilled" ? reactions.value : null;
        if (reactions.status === "rejected") console.warn("Raising reaction art unavailable", reactions.reason);
        if (review.status === "rejected") throw review.reason;
        if (cage.status === "rejected") throw cage.reason;
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
    watchLoad: createLoadWatchdog,
    async mountField({ host, source: fieldSource, onActorFrame, onProgress, signal }) {
      let characterBundle = null;
      let fieldArt = null;
      let feedbackArt = null;
      const owned = new Set();
      const releaseArt = () => {
        for (const art of owned) void Promise.resolve(art?.dispose()).catch(error => console.warn('Hunt art cleanup failed', error));
        owned.clear();
      };
      const own = promise => promise.then(art => {
        if (signal.aborted) { void Promise.resolve(art?.dispose()).catch(error => console.warn('Hunt art cleanup failed', error)); return null; }
        if (art) owned.add(art);
        return art;
      });
      signal.addEventListener('abort', releaseArt, { once: true });
      try {
        const stage = await ensurePixiStage(host, signal);
        signal.throwIfAborted();
        const speciesIds = fieldSource.field.getView({
          viewportWidth: stage.app.screen.width, viewportHeight: stage.app.screen.height
        }).wildCreatures.map((wild) => wild.speciesId);
        const loaded = await Promise.allSettled([
          own(loadOptionalCharacterReview(stage, speciesIds)),
          own(loadOptionalHuntFieldArt(stage, { signal, onProgress })),
          own(loadRegisteredHuntFeedbackArt({PIXI:createPixiAssetScope(stage.PIXI),baseUrl:location.href,
            kinds:fieldSource.getFrame().huntField.toolState?.tools.map(tool=>tool.subtype??tool.id)??null}))
        ]);
        [characterBundle, fieldArt, feedbackArt] = loaded.map((result) =>
          result.status === 'fulfilled' ? result.value : null);
        for (const result of loaded) if (result.status === 'rejected') {
          console.warn('Hunt art unavailable', result.reason);
        }
        // An exit received during loading must not attach the abandoned field
        // or start its native actor ticker. The serial mount then returns Home.
        if (signal.aborted || app.getScreen() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD) {
          releaseArt();
          return { isPlayable: false, render() {}, dispose() {} };
        }
        delete root.dataset.fieldFallback;
        const scene = await mountHuntFieldPixiPresentation({
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
        // The mounted scene now owns these bundles and releases them on exit.
        owned.clear();
        return scene;
      } catch (error) {
        releaseArt();
        if (signal.aborted) return { isPlayable: false, render() {}, dispose() {} };
        return fieldFallback(host, error);
      } finally { signal.removeEventListener('abort', releaseArt); }
    }
  });
}

// --- VS5 Auto Battle -------------------------------------------------------
// The runtime holds the chosen match and the live session between the three
// screens; the views below are handed only what they draw.
let battleRuntime = null;
let battleAttemptId = null;
let battleProgressBefore = null;

// Entry publishes BATTLE_FIELD synchronously, before an async enterMatch
// resolves. Its subscriber must already see the prepared simulation and ID.
// Keep the previous runtime alive until entry accepts; a refusal restores it.
async function enterPreparedBattle(prepared, attemptId, enter) {
  const previous = { runtime: battleRuntime, attemptId: battleAttemptId, progress: battleProgressBefore };
  battleRuntime = prepared;
  battleAttemptId = attemptId;
  battleProgressBefore = { rank: app.getTamerRank(), badges: app.getBattleBadges(),
    shopIds: app.getShopFrame().listings.map(item => item.shopRecordIndex) };
  let accepted = false;
  try {
    const result = await enter();
    accepted = result.ok && !result.duplicate;
    if (accepted) previous.runtime?.dispose();
    return result;
  } finally {
    if (!accepted) {
      battleRuntime = previous.runtime;
      battleAttemptId = previous.attemptId;
      battleProgressBefore = previous.progress;
      prepared.dispose();
    }
  }
}

/**
 * A tournament round is an ordinary battle whose opponent came from the run's
 * own pool. Draw once, build the match on that team, then open the attempt.
 */
async function enterChampionshipRound(playerInstanceIds) {
  if (!pixiStage || pixiStage.contextLost || !pixiStage.app.ticker.started) {
    return { ok: false, reason: "BATTLE_NOT_READY", message: "遊戲場景尚未就緒，請返回牧場後重試。" };
  }
  const run = app.getChampionshipRun();
  if (!run) return { ok: false, reason: "NO_CHAMPIONSHIP_RUNNING" };
  const party=await app.prepareChampionshipBattle(playerInstanceIds);
  if(!party.ok)return party;
  const {rngPreparation,opponent}=party;
  const prepared = (await loadBattleRuntime())({ schedule: app.getBattleSchedule(), mode: 0, battleType: 0,
    rng: rngPreparation.rng, playerIndividuals:party.individuals,arenaIndex:10 });
  try {
    prepared.chooseChampionshipRound({ category: run.category, teamIndex: opponent.teamIndex,cursor:run.cursor,totalRounds:run.totalRounds });
    prepared.startMatch();
    const attemptId = `battle:${app.getBattleEconomyState().nextSequence}`;
    const result = await enterPreparedBattle(prepared, attemptId,
      () => app.enterChampionshipRound({ attemptId, playerInstanceIds,rngPreparation }));
    return result;
  } catch (error) {
    prepared.dispose();
    console.warn(`CHAMPIONSHIP_ROUND_PREPARE: ${error.message}`);
    return { ok: false, reason: "BATTLE_NOT_READY" };
  }
}

async function mountBattleSelect() {
  battleRuntime?.dispose();
  battleRuntime = (await loadBattleRuntime())({ schedule: app.getBattleSchedule(), mode:1, battleType:0 });
  battleAttemptId = null;
  battleProgressBefore = null;
  return createBattleSelectView({
    root,
    matches: battleRuntime.listMatches(),
    arenaChoices:battleRuntime.listSelectableArenas(),
    getPracticeSelection:async()=>({candidates:await app.getBattlePartyCandidates(null)}),
    getPasswordSelection:async()=>({maxLength:22,candidates:await app.getPasswordTeamCandidates(),
      createPassword:instanceIds=>app.createTeamPassword(instanceIds)}),
    getLinkSelection:async()=>({
      candidates:await app.getBattlePartyCandidates(null),
      createInvite:instanceIds=>app.createLinkBattleInvite(instanceIds),
      prepareGuest:(inviteCode,instanceIds)=>app.prepareLinkBattle({role:'GUEST',inviteCode,instanceIds}),
      prepareHost:(inviteCode,replyCode)=>app.prepareLinkBattle({role:'HOST',inviteCode,replyCode})
    }),
    getPartySelection:async(recordIndex,mode)=>mode==='FREE_BATTLE'
      ?{candidates:await app.getBattlePartyCandidates(null),limit:app.getFreeBattleMatches().find(m=>m.id===recordIndex)?.slots??3}
      :{candidates:await app.getBattlePartyCandidates(recordIndex),limit:await app.getBattlePartyLimit(recordIndex)},
    getModeMatches:async mode=>mode==='TITLE_MATCH'?battleRuntime.listMatches():app.openFreeBattle().map(match=>({
      ...match,recordIndex:match.id,title:uiText('{kind} — {species}',{kind:uiText(match.kind==='SINGLE'?'單隻對戰':'三隻對戰'),species:formatList(match.speciesIndices.map(index=>speciesName(index)))})})),
    menuCopy: battleMenuLabels(),
    onOpenChampionship() { app.openChampionship(); },
    async onEnter(recordIndex,playerInstanceIds,mode,selectedArena=null) {
      // Battle simulation uses this existing Application's ticker. Do not
      // charge for a session that cannot start advancing on the shared stage.
      if (!pixiStage || pixiStage.contextLost || !pixiStage.app.ticker.started) {
        return { ok: false, reason: "BATTLE_NOT_READY", message: "遊戲場景尚未就緒，請返回牧場後重試。" };
      }
      if(mode==='FREE_BATTLE'){
        const party=await app.prepareFreeBattle(recordIndex,playerInstanceIds,selectedArena);if(!party.ok)return party;
        const prepared=(await loadBattleRuntime())({mode:2,battleType:0,playerIndividuals:party.individuals,rng:party.rngPreparation.rng,
          personalityPolicy:FREE_PRACTICE_PERSONALITY_POLICY});
        try{
          prepared.chooseFreeBattle({presetIndices:party.match.presetIndices,arenaIndex:party.arenaIndex});prepared.startMatch();
          const attemptId=`battle:${app.getBattleEconomyState().nextSequence}`;
          return await enterPreparedBattle(prepared,attemptId,()=>app.enterFreeBattle({attemptId,playerInstanceIds,rngPreparation:party.rngPreparation}));
        }catch(error){prepared.dispose();console.warn(`FREE_BATTLE_PREPARE: ${error.message}`);return {ok:false,reason:'BATTLE_NOT_READY'};}
      }
      if(mode==='PRACTICE_BATTLE'){
        const party=await app.preparePracticeBattle(playerInstanceIds,selectedArena);if(!party.ok)return party;
        const prepared=(await loadBattleRuntime())({mode:5,battleType:0,playerIndividuals:party.parties[0],opponentIndividuals:party.parties[1],rng:party.rngPreparation.rng,
          personalityPolicy:FREE_PRACTICE_PERSONALITY_POLICY});
        try{
          prepared.choosePracticeBattle({arenaIndex:party.arenaIndex});prepared.startMatch();
          const attemptId=`battle:${app.getBattleEconomyState().nextSequence}`;
          return await enterPreparedBattle(prepared,attemptId,()=>app.enterPracticeBattle({attemptId,playerInstanceIds:playerInstanceIds.flat(),rngPreparation:party.rngPreparation}));
        }catch(error){prepared.dispose();console.warn(`PRACTICE_BATTLE_PREPARE: ${error.message}`);return {ok:false,reason:'BATTLE_NOT_READY'};}
      }
      if(mode==='PASSWORD_BATTLE'){
        const party=await app.preparePasswordBattle(playerInstanceIds);if(!party.ok)return party;
        const prepared=(await loadBattleRuntime())({mode:4,battleType:0,playerIndividuals:party.parties[0],opponentIndividuals:party.parties[1],rng:party.rngPreparation.rng});
        try{
          prepared.choosePasswordBattle({arenaIndex:party.arenaIndex});prepared.startMatch();
          const attemptId=`battle:${app.getBattleEconomyState().nextSequence}`;
          return await enterPreparedBattle(prepared,attemptId,()=>app.enterPasswordBattle({attemptId,passwords:party.passwords,rngPreparation:party.rngPreparation}));
        }catch(error){prepared.dispose();console.warn(`PASSWORD_BATTLE_PREPARE: ${error.message}`);return {ok:false,reason:'BATTLE_NOT_READY'};}
      }
      if(mode==='LINK_BATTLE'){
        const party=playerInstanceIds;if(!party?.ok)return party??{ok:false,reason:'LINK_BATTLE_NOT_READY'};
        const prepared=(await loadBattleRuntime())({mode:3,battleType:0,playerIndividuals:party.parties[0],opponentIndividuals:party.parties[1],
          localTeamIndex:party.localTeamIndex,rng:party.rngPreparation.rng});
        try{
          prepared.chooseLinkBattle({arenaIndex:party.arenaIndex});prepared.startMatch();
          const attemptId=`battle:${app.getBattleEconomyState().nextSequence}`;
          return await enterPreparedBattle(prepared,attemptId,()=>app.enterLinkBattle({attemptId,linkKey:party.linkKey,rngPreparation:party.rngPreparation}));
        }catch(error){prepared.dispose();console.warn(`LINK_BATTLE_PREPARE: ${error.message}`);return {ok:false,reason:'BATTLE_NOT_READY'};}
      }
      const party=await app.prepareBattleParty(recordIndex,playerInstanceIds);
      if(!party.ok)return party;
      const rngPreparation=app.prepareBattleRng();
      const prepared = (await loadBattleRuntime())({ schedule: app.getBattleSchedule(), mode:1, battleType:0,playerIndividuals:party.individuals,rng:rngPreparation.rng });
      try {
        prepared.chooseMatch(recordIndex);
        // Build before charging. startMatch creates the session but never ticks
        // it; a renderer subscribes only after registration succeeds.
        prepared.startMatch();
        const context = prepared.getEconomyContext();
        const attemptId = `battle:${app.getBattleEconomyState().nextSequence}`;
        const result = await enterPreparedBattle(prepared, attemptId,
          () => app.enterMatch({ ...context, attemptId,playerInstanceIds,rngPreparation }));
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
    localTeamIndex:activeRuntime.localTeamIndex(),
    hudArt,
    askToLeave: showChoiceDialog,
    mountField({ host,onReady,onError }) {
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
          const loaded=await Promise.allSettled([
            loadOptionalBattleFieldArt(stage,source),
            loadOptionalCharacterReview(stage,source.getFrame().combatants.filter(entry=>entry.present&&entry.speciesId).map(entry=>entry.speciesId)),
            loadRegisteredBattleEffectArt({PIXI:stage.PIXI,baseUrl:location.href})
          ]);
          [fieldArt,characterRoster,effectArt]=loaded.map(result=>result.status==='fulfilled'?result.value:null);
          for(const result of loaded)if(result.status==='rejected')console.warn('Battle art unavailable',result.reason);
          if (disposed) {
            await effectArt?.dispose();await fieldArt?.dispose();await characterRoster?.dispose();return;
          }
          delete root.dataset.fieldFallback;
          vfxOverlay = await loadOptionalBattleVfxOverlay(host, stage, source, () => scene?.getFocusPlacement(), () => scene?.getFieldPlacement());
          if (disposed) {
            await vfxOverlay?.dispose();await effectArt?.dispose();await fieldArt?.dispose();await characterRoster?.dispose();return;
          }
          // Audio is optional presentation; an unavailable decoder/sample must
          // never prevent the existing battle scene from starting.
          // Through the product audio bus: master volume, sound effects
          // volume and mute apply to the battle's own samples too.
          battleAudio = await mountBattleAudioPresentation({source,output:settings.audio.output('sfx')}).catch(error=>{
            console.warn('Battle audio unavailable',error);return null;
          });
          scene = await mountBattleFieldPixiPresentation({ stage, source, fieldArt, characterRoster, effectArt,onView:frame=>view.render(frame) });
          if (disposed) {
            await battleAudio?.dispose();
            await vfxOverlay?.dispose();
            scene?.dispose();
            return;
          }
          onReady?.();
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
          onError?.();
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
  // QA reads each slot's personality wiring and what it decided here.
  const showPersonality = new URLSearchParams(location.search).get('presentation') === 'developer';
  // The session advances itself; this repaints the DOM beside the scene and
  // moves on to the result once the battle has judged itself.
  activeRuntime.observe((observed) => {
    if (battleRuntime !== activeRuntime || battleAttemptId !== activeAttemptId) return;
    view.render(observed);
    if (showPersonality) root.dataset.battlePersonality = battlePersonalityReadout(activeRuntime);
    if (observed.outcome.ended && app.getScreen() === CHAMPIONSHIP_SCREENS.BATTLE_FIELD) {
      app.finishMatch({ ...activeRuntime.getSettlementResult(), attemptId: activeAttemptId });
      // The settlement (prize, rank, titles) is committed in the session; the
      // result screen is a safe place to write it.
      autosave?.request('settlement');
    }
  });
  return view;
}

/** Developer readout: per slot, the wiring a battle received and its tallies. */
function battlePersonalityReadout(runtime) {
  const d = runtime.getPersonalityDiagnostics();
  return JSON.stringify({ policy: d.policy, frame: d.frame, ended: d.ended, slots: d.slots.map((s) => s && {
    slot: s.slot, team: s.team, personality: s.personality, tactic: s.tactic, profile: s.profile, policy: s.policy, fallback: s.fallback,
    selector: d.decisions.findLast((x) => x.slot === s.slot)?.selector ?? null, decisions: s.decisions, action: s.action,
    targeted: s.targeted, move: s.move, temper: s.temper, launched: s.launched, refused: s.refused, gateTargets: s.gateTargets }) });
}

async function mountHuntResult() {
  // The hunt result named the catch but never showed it. Load the same
  // registered portrait bank the battle result and the Raising home use, on
  // demand and the same way: a bank that fails to load must not take the
  // screen down with it, because this is where the catch is named and saved.
  const hudArt = await loadRegisteredCharacterHudArt({ baseUrl: location.href }).catch(() => null);
  return createHuntResultView({ root, source: expeditionSource, hudArt });
}

/**
 * The important-highlight template on the result stage. The view says where
 * the plate is and which settled figure it shows; this supplies the one Pixi
 * ticker, the synthesized cues and the bounded Three.js shards. Any failure
 * lands the plate at once: a presentation must never hold back a result.
 */
function playResultHighlight(request, getStage, getAnchor = null) {
  let sequence = null, skipRequested = false, disposed = false;
  const land = () => { if (!disposed) { request.onValue(request.target); request.onPhase('DONE'); } };
  (async () => {
    // The view calls this while it is still being built; the stage is asked
    // for only after the caller has had the chance to attach it.
    await Promise.resolve();
    const stage = await Promise.resolve(getStage()).catch(() => null);
    if (disposed) return;
    if (!stage || skipRequested) { land(); return; }
    // The player's preferences, resolved when the run starts: motion, the
    // highlight length, and the quality tier's shards, marks and decoration.
    const reducedMotion = prefersReducedMotion();
    const mode = highlightMode();
    const tier = currentQuality();
    sequence = createHighlightSequence({
      host: request.host, focus: request.focus, anchor: getAnchor, ticker: stage.app.ticker, target: request.target, reducedMotion,
      timing: highlightOverrides({ mode, quality: tier }),
      decor: tier.highlightDecor, shardLife: tier.highlightShardLife,
      burstPixelRatio: cappedPixelRatio(tier.threePixelRatioCap), burstAntialias: tier.threeAntialias,
      audio: createHighlightAudio({ gain: HIGHLIGHT_DEFAULTS.audioGain, output: settings.audio.output('sfx') }),
      mountBurst: mountHighlightBurstThree,
      onPhase: request.onPhase, onValue: request.onValue
    });
    // QA reads the run's own measurements (frame times, phases, cues) here.
    void sequence.done.then((summary) => {
      if (disposed) return;
      request.host.dataset.highlightSummary = JSON.stringify({ phase: summary.phase, elapsedMs: summary.elapsedMs,
        skipped: summary.skipped, target: summary.target, shownValue: summary.shownValue, frames: summary.frames,
        audio: summary.audio, burst: summary.burst, reducedMotion: summary.timing.reducedMotion, totalMs: summary.timing.totalMs,
        mode, quality: document.documentElement.dataset.quality ?? null, particles: summary.timing.particleCount,
        stairs: summary.timing.stairSteps, decor: summary.decor, anchor: summary.anchor, focus: summary.focus });
    });
    sequence.start();
  })().catch((error) => { console.warn('Result highlight unavailable', error); land(); });
  return {
    skip() { skipRequested = true; if (sequence) return sequence.skip(); land(); return true; },
    dispose() { disposed = true; sequence?.dispose(); sequence = null; }
  };
}

async function mountBattleResult() {
  // The result consumes the app's actual receipt, including loss and clamping.
  const chosen = battleRuntime.getChosenMatch?.() ?? null;
  const record=app.getTitleProgress().record;
  const hudArt=await loadRegisteredCharacterHudArt({baseUrl:location.href}).catch(()=>null);
  const receipt = app.getBattleReceipt();
  const progression = battleProgressBefore?{rankBefore:battleProgressBefore.rank,rankAfter:app.getTamerRank(),
    earnedTitles:app.getBattleBadges().filter(id=>!battleProgressBefore.badges.includes(id)).map(id=>({id,name:titleEventText(id,'name',uiText('頭銜 {id}',{id}))}))}:null;
  // Only this attempt's own settled receipt can earn the highlight.
  const tier = classifyBattleResultFeedback({ receipt, attemptId: battleAttemptId, progression });
  const feedback = tier === 'highlight'
    ? { tier, settlement: receipt.rewardBits > 0 ? { credited: receipt.credited, rewardBits: receipt.rewardBits, clamped: receipt.clamped === true } : null }
    : { tier };
  let stageReady = null;
  // Which of the three result slots will show a character, so the highlight's
  // light can fall where they stand (resultHeroAnchor, same frame layout).
  const heroSlots = (() => {
    try { return hudArt ? battleRuntime.getResultParticipants().slice(0, 3).map((entry, index) => (entry ? index : -1)).filter((index) => index >= 0) : []; }
    catch { return []; }
  })();
  let characterHostNode = null;
  const heroAnchor = () => {
    const box = characterHostNode?.getBoundingClientRect?.();
    return box && heroSlots.length ? resultHeroAnchor({ width: box.width, height: box.height, slots: heroSlots }) : null;
  };
  const resultView=createBattleResultView({
    root,
    outcome: battleRuntime.outcome(),
    receipt,
    feedback,
    highlight: (request) => playResultHighlight(request, () => stageReady, heroAnchor),
    matchTitle: chosen?.link?uiText('通訊對戰'):chosen?.password?uiText('密碼對戰'):chosen?.practice?uiText('練習對戰'):chosen?.freeBattle?uiText('自由對戰')
      :chosen?.championship?uiText('{event} 第 {round} 戰',{event:uiText(chosen.recordIndex===0?'冠軍大會':'世界大會'),round:chosen.cursor+1})
      :chosen?titleEventText(chosen.recordIndex,"name",chosen.title):null,
    hudArt,
    // exitBattle returns to the tournament board while the run is still owed
    // a round; the verdict is already recorded when this result mounts.
    exitLabel:chosen?.championship&&app.getChampionshipRun()?.continues?uiText('返回賽事'):undefined,
    statistics:{battles:record?.battles??null,winPercent:nativeBattleWinPercent(record),titleCount:app.getBattleBadges().length},
    unlocks:battleProgressBefore?app.getShopFrame().listings.filter(item=>!battleProgressBefore.shopIds.includes(item.shopRecordIndex)).map(item=>({name:uiText(item.displayName)})):[],
    progression,
    onExit() {
      battleRuntime?.dispose();
      battleRuntime = null;
      battleAttemptId = null;
      app.leaveScreen();
    }
  });
  characterHostNode = resultView.getCharacterHost();
  // The stage light pools under the characters that are present.
  {
    const box = characterHostNode.getBoundingClientRect?.();
    const light = box && heroSlots.length ? resultStageLight({ width: box.width, height: box.height, slots: heroSlots }) : null;
    const stageNode = characterHostNode.parentElement;
    if (light && stageNode?.style) {
      stageNode.style.setProperty("--result-light-x", `${(light.x * 100).toFixed(2)}%`);
      stageNode.style.setProperty("--result-light-w", `${(light.width * 100).toFixed(2)}%`);
    }
  }
  stageReady = ensurePixiStage(characterHostNode);
  let resultCharacters=null;
  try{
    const participants=battleRuntime.getResultParticipants(),stage=await stageReady;
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
    // Multiple publications may queue behind one async mount. Re-check after
    // acquiring it, so a queued HUD update cannot remount the same scene.
    if (target === mountedScreen) return;
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
      onRename(instanceId, name) {
        const result = app.renameRosterInstance(instanceId, name);
        if (result.ok) autosave?.request('rename');
        return result.ok ? { ...result, entries: projectRoster() } : result;
      },
      onExit() { app.leaveScreen(); }
    });
    else if (target === CHAMPIONSHIP_SCREENS.CHAMPIONSHIP) {
      view = createChampionshipView({
        root,
        source: {
          getCategories: () => app.getChampionshipCategories(),
          getRun: () => app.getChampionshipRun(),
          getPartySelection:async()=>({candidates:await app.getBattlePartyCandidates(null),limit:3}),
          intents: {
            open: (category) => app.beginChampionship(category),
            enterRound: ids => enterChampionshipRound(ids),
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
        onToggleRegistration(recordIndex){app.toggleTitleRegistration(recordIndex);autosave?.request('registration');return app.getTitleProgress();},
        onToggleChampionship(){app.toggleChampionshipRegistration();autosave?.request('registration');return app.getTitleProgress();},
        onExit() { app.leaveScreen(); }
      });
    }
    else if (target === CHAMPIONSHIP_SCREENS.HELP) view = createHelpView({
      root,
      onExit() { app.leaveScreen(); }
    });
    else if (target === CHAMPIONSHIP_SCREENS.TAMER_INFO) {
      // OVL4 0210BB9C reads rank capacity/slots and lifetime completion counters.
      const shopFrame = app.getShopFrame?.() ?? null;
      view = createTamerInfoView({
        root,
        walletBits: Number.isInteger(shopFrame?.bits) ? shopFrame.bits : null,
        titleCount:app.getBattleBadges().filter(id=>id>=0&&id<61).length,
        registeredCount:app.getDatabaseFrame().registeredCount,
        battleRecord:app.getTitleProgress().record??null,
        tamerRank: app.getTamerRank?.() ?? null,
        trainerName:app.getOpeningState()?.trainerName??null,
        onExit() { app.leaveScreen(); }
      });
    }
    else if (target === CHAMPIONSHIP_SCREENS.GATE_SELECT) view = await mountGateSelect();
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) view = createHuntLoadoutView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_FIELD) view = await mountHuntField();
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_RESULT) view = await mountHuntResult();
    else if (target === CHAMPIONSHIP_SCREENS.BATTLE_SELECT) view = await mountBattleSelect();
    else if (target === CHAMPIONSHIP_SCREENS.BATTLE_FIELD) view = await mountBattleField();
    else if (target === CHAMPIONSHIP_SCREENS.BATTLE_RESULT) view = await mountBattleResult();
    mountedScreen = target;
    screenChangedAt = performance.now();
    // One attribute every screen carries, whichever view family drew it. The
    // views' own data-screen stays theirs (the status bar also carries one).
    root.dataset.activeScreen = target;
    warmDeferredModules();
  } finally {
    release();
  }

  // A screen change that arrived while this mount was in flight.
  if (app.getScreen() !== mountedScreen) await mountCurrentScreen();
}

// An explicit acceptance-testing grant, off unless the address asks for it.
// It grants the three resources the original's rules read and changes none of
// the rules, so a gate that opens here opened through its own admission check.
function applyQaUnlockIfRequested() {
  if (!qaUnlockRequested(globalThis.location?.search ?? "")) return;
  const granted = applyQaUnlock(app, listChampionshipGates());
  console.info("CHAMPIONSHIP_QA_UNLOCK", granted);
}

async function openGameplay() {
  titleScreen.hidden = true;
  root.hidden = false;
  applyQaUnlockIfRequested();

  unsubscribeExpedition?.();
  unsubscribeScreen?.();
  unsubscribeCalendar?.();
  autosave?.dispose();
  // While a confirmation is open the player is still deciding: wait for it.
  autosave = createAutosaveScheduler({ route: () => (isChoiceDialogOpen() ? null : safeSaveRoute()), onChange: () => refreshStatusBar() });
  // A purchase, a confirmed cage layout or a Database rename asks for a save.
  expeditionSource = createGateHuntPresentationSource(app, { onCommitted: (reason) => autosave?.request(reason) });

  // One subscription repaints the mounted view; a screen change swaps it.
  unsubscribeExpedition = expeditionSource.subscribe((frame) => {
    refreshStatusBar();
    if (frame.screen !== mountedScreen) return;
    if (frame.screen === CHAMPIONSHIP_SCREENS.RAISING_HOME) return;
    view?.render?.(frame);
  });
  let calendarKey = "";
  async function refreshCalendarViews() {
    const calendar = app.getCalendar();
    const key = `${calendar.year}:${calendar.season}:${calendar.dayOfSeason}:${calendar.clockMinutes}:${app.getTamerRank()}`;
    if (key === calendarKey) return;
    calendarKey = key;
    refreshStatusBar();
    if (mountedScreen !== app.getScreen()) return;
    if (app.getScreen() === CHAMPIONSHIP_SCREENS.SCHEDULE) {
      view?.render?.({ calendar, eligibleRecordIndices: app.getAvailableBattleRecordIndices(),progress:app.getTitleProgress() });
    } else if (app.getScreen() === CHAMPIONSHIP_SCREENS.BATTLE_SELECT) {
      const current = (await loadBattleRuntime())({ schedule: app.getBattleSchedule(), mode:1, battleType:0 });
      view?.render?.({ matches: current.listMatches() });
      current.dispose();
    }
  }
  unsubscribeScreen = app.subscribeScreen(() => {
    refreshStatusBar(); refreshToolbarMode(); void refreshCalendarViews(); void mountCurrentScreen();
  });
  unsubscribeCalendar = app.getSession().subscribeRaisingHome(refreshCalendarViews);
  unsubscribeHud?.();
  {
    const stopShop = app.subscribeShop(refreshStatusBar);
    // Any successful write (autosave, page hide, Save & Quit, the day change,
    // the hunt's home commit) covers every change made before it.
    const stopSave = app.savePort?.subscribe?.((status) => {
      if (status?.phase === "SAVED") autosave?.settled();
      refreshStatusBar();
    });
    unsubscribeHud = () => { stopShop?.(); stopSave?.(); };
  }

  if (!statusBar) {
    // No End Day here any more: the original puts it in the toolbar's
    // MANAGEMENT submenu, and that is where it now lives.
    statusBar = createChampionshipStatusBar({ root: document.body,
      // Today's title matches open the same Battle menu the System menu reaches.
      onOpenMatches: () => { if (!app.hasRaisingPresentation() && app.getScreen() === CHAMPIONSHIP_SCREENS.RAISING_HOME) app.openBattle(); },
      onOpenSave: () => { void openSaveDetails(); } });
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
  // Product-authored System entry (2026-09-29): the settings screen. It opens
  // over the current screen and changes nothing in the session.
  // Focus returns to the Menu button: the menu item itself is gone by then.
  if (entry.action === "OPEN_SETTINGS") { openSettings(document.querySelector('.cm-toolbar__cell[data-menu-id="SYSTEM"]')); return; }
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

/**
 * Owner 2026-09-16: the Raising Home SAVE button is gone, so the session is
 * written when the page goes away instead. A phone browser discards a
 * backgrounded tab without warning, and Save & Quit is otherwise the only way
 * back to disk. A real-time save and an account sign-in are the intended
 * replacements; this is the bridge to them.
 *
 * It carries the guards the button had: Raising Home only, and never while a
 * day change, an evolution, a confirmation or a letter owns the screen. The
 * port refuses outright during a battle or a hunt commit, so a refusal is
 * logged rather than shown -- the player has already left the page.
 */
// Owner 2026-09-28 QA: a purchase made in the Shop was lost when the page was
// left from the Shop, because only Raising Home wrote on hide. These screens
// hold no half-finished transaction: whatever they changed (a purchase, a
// confirmed cage layout, a rename, a registration) is already complete in the
// session, so writing it is what Save & Quit would do. The Hunt field, a
// capture waiting on the memory card and a running or unsettled battle stay
// excluded -- the save port refuses those anyway, and the hunt's entry fee
// must not persist without the hunt it paid for.
// 2026-09-29: the battle result joins them. It mounts only after the match
// has settled (prize, rank and titles are already in the session), so a page
// closed on the result no longer loses the win; app.save() still refuses any
// battle that is running or unsettled.
const HIDE_SAVE_SCREENS = new Set([
  CHAMPIONSHIP_SCREENS.SHOP, CHAMPIONSHIP_SCREENS.DATABASE, CHAMPIONSHIP_SCREENS.CAGE_EDIT,
  CHAMPIONSHIP_SCREENS.DIGIMON_LIST, CHAMPIONSHIP_SCREENS.SCHEDULE, CHAMPIONSHIP_SCREENS.HELP,
  CHAMPIONSHIP_SCREENS.TAMER_INFO, CHAMPIONSHIP_SCREENS.GATE_SELECT, CHAMPIONSHIP_SCREENS.HUNT_LOADOUT,
  CHAMPIONSHIP_SCREENS.BATTLE_SELECT, CHAMPIONSHIP_SCREENS.CHAMPIONSHIP, CHAMPIONSHIP_SCREENS.BATTLE_RESULT
]);

/**
 * The save call for the current screen, or null when writing now would not be
 * safe. Shared by the page-hide save and the autosave after important
 * operations, so both obey the same guards: Raising Home only between its
 * lifecycle moments (a day change, an evolution, a confirmation or a letter
 * owns the screen), other screens only from the list above.
 */
function safeSaveRoute() {
  if (!app || !mountedScreen || mountedScreen !== app.getScreen()) return null;
  if (mountedScreen === CHAMPIONSHIP_SCREENS.RAISING_HOME) {
    if (!raisingSource) return null;
    const lifecycle = raisingSource.getFrame()?.lifecycle;
    if (lifecycle?.day || lifecycle?.evolution || lifecycle?.confirmation) return null;
    const mailbox = lifecycle?.mailbox;
    if (mailbox?.queue?.some((entry) => entry.id === mailbox.activeId)) return null;
    return () => raisingSource.intents.requestSave();
  }
  if (!HIDE_SAVE_SCREENS.has(mountedScreen) || app.hasRaisingPresentation()) return null;
  return () => app.save();
}

function autosaveOnHide() {
  const route = safeSaveRoute();
  if (!route) return;
  try { route(); }
  catch (error) { console.warn(`CHAMPIONSHIP_AUTOSAVE_ON_HIDE: ${error.message}`); }
}

/**
 * What "saved" means in this build, from the save indicator. Local only: this
 * build has no account and no cloud copy, and says so. A failed write offers
 * the port's own retry, which rebuilds the current session rather than
 * replaying stale bytes.
 */
async function openSaveDetails() {
  const status = app?.savePort?.getStatus?.();
  if (!status) return;
  // The save time in the reader's own date and clock format.
  const when = status.savedAt ? formatDateTime(status.savedAt) : null;
  const where = uiText("存檔只保存在這台裝置的這個瀏覽器。目前沒有帳號或雲端同步，換裝置或清除網站資料後無法取回。");
  const how = uiText("購買、改名、確認設施配置、報名與對戰結算後會自動保存；離開頁面、換日與「保存並結束」也會保存。");
  if (status.phase === "SAVE_FAILED") {
    const reason = uiText(status.lastCode === "CHAMPIONSHIP_MODERN_SAVE_CONFLICT"
      ? "另一個分頁已寫入較新的存檔，這個分頁不會覆蓋它。請關閉其他分頁後重新開啟遊戲。"
      : "這次沒有寫入本機存檔。可以再試一次；若仍失敗，請確認瀏覽器沒有封鎖網站資料或處於私密瀏覽。");
    const choice = await showChoiceDialog({
      title: uiText("保存失敗"),
      message: `${reason}\n${where}`,
      actions: status.canRetry
        ? [{ id: "close", label: uiText("關閉"), tone: "secondary" }, { id: "retry", label: uiText("再試一次"), tone: "primary" }]
        : [{ id: "close", label: uiText("關閉"), tone: "secondary" }],
      cancelId: "close"
    });
    if (choice === "retry") {
      try { app.persistenceFacade().retry(); } catch (error) { console.warn(`CHAMPIONSHIP_SAVE_RETRY: ${error.message}`); }
      refreshStatusBar();
    }
    return;
  }
  const pending = (autosave?.inspect().pending.length ?? 0) > 0;
  const state = pending ? uiText("有變更正在等待寫入。")
    : status.phase === "DIRTY" ? (when ? uiText("上次寫入後遊戲又有進展（上次：{time}）。", { time: when }) : uiText("上次寫入後遊戲又有進展。"))
    : (when ? uiText("已存到本機（{time}）。", { time: when }) : uiText("已存到本機。"));
  await showChoiceDialog({ title: uiText("存檔狀態"), message: `${state}\n${how}\n${where}`, actions: [{ id: "close", label: uiText("知道了"), tone: "primary" }], cancelId: "close" });
}

/** Save & Quit returns to the title, which is where the original ends a session. */
async function returnToTitle() {
  clockDriver?.setActive(false);
  autosave?.dispose();autosave=null;
  statusBar?.dispose();statusBar=null;
  unsubscribeCalendar?.();
  unsubscribeCalendar = null;
  unsubscribeHud?.();
  unsubscribeHud = null;
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
  if (titleSettingsButton) titleSettingsButton.hidden = false;
  newGameButton.disabled = false;
  refreshContinue();
}

/**
 * The roster the Digimon screen lists.
 *
 * One instance resolver shared with Raising Home. Species classification is
 * catalog data; individual values come from the canonical persisted profile.
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
      // The starter's name is set by the opening; collected ones can be renamed.
      renameable: source?.kind !== "STARTER"
        && Boolean(app.getRaisingState()?.collection?.some((entry) => entry.instanceId === instanceId)),
      stats: profile,
      identity: identity && {
        ...identity,
        // Eggs (0..7) and the four past the run carry no name; absent, not blank.
        speciesName: speciesName(identity.recordIndex, NAME_BY_INDEX.get(identity.recordIndex) ?? null),
        familyOrdinal: identity.familyBits === 0 ? null : 32-Math.clz32((identity.familyBits & -identity.familyBits)>>>0)
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
    // Product readouts on the same bar (2026-09-29): bits held, today's title
    // matches (the same capped list the Battle menu shows), the save state.
    reading.bits = app.getShopFrame()?.bits ?? null;
    reading.todayMatches = Math.min(app.getAvailableBattleRecordIndices().length, BATTLE_MATCH_LIST_CAP);
    const status = app.savePort?.getStatus?.() ?? null;
    reading.save = status ? { ...status, autosavePending: (autosave?.inspect().pending.length ?? 0) > 0 } : null;
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
    // newGame clears the previous save before the first write, so until the
    // page is next hidden there would be no save at all. Write the new game
    // once now, through the same port, so Continue always has something.
    try { app.save(); } catch (error) { console.warn(`CHAMPIONSHIP_NEW_GAME_SAVE: ${error.message}`); }
    await openGameplay();
    return true;
  } catch (error) {
    console.warn(error);
    newGameButton.disabled = false;
    if (titleSettingsButton) titleSettingsButton.hidden = false;
    refreshContinue();
    note(uiText("無法開始新遊戲：{reason}", { reason: uiText(error.message) }));
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
    note(uiText("無法讀取存檔：{reason}", { reason: uiText(error.message) }));
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
  // With a save to go back to, Continue is the expected choice: it comes first
  // and carries the primary style. New Game follows and asks before replacing.
  if (loadable && titleActions.firstElementChild !== continueButton) titleActions.prepend(continueButton);
  if (!loadable && titleActions.firstElementChild !== newGameButton) titleActions.prepend(newGameButton);
  continueButton.classList.toggle("cm-button--primary", loadable);
  newGameButton.classList.toggle("cm-button--primary", !loadable);
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

const titleSettingsButton = document.getElementById("cm-title-settings");

/**
 * After a language switch: relabel everything that outlives a screen (the
 * title, the status bar, the toolbar) and the screen that is showing, in
 * place. Nothing is remounted, so the page, its selection and its scroll stay.
 */
function relabelChrome() {
  document.title = uiText("數碼獸冠軍賽 — 2026");
  const heading = titleScreen.querySelector(".cm-title__name");
  // The logo is drawn brand art and keeps its Chinese; English readers get
  // the name through the heading's label.
  if (heading) {
    heading.lang = "zh-Hant";
    if (document.documentElement.lang === "en") heading.setAttribute("aria-label", "Digimon Championship");
    else heading.removeAttribute("aria-label");
  }
  retranslate(titleScreen);
  statusBar?.relabel?.();
  refreshStatusBar();
  toolbar?.relabel?.();
  if (view?.relabel) view.relabel();
  else retranslate(root);
}

function boot() {
  // Title labels that the language setting can change.
  setText(newGameButton, "開始新遊戲");
  setText(continueButton, "繼續遊戲");
  if (titleSettingsButton) {
    setLabel(titleSettingsButton, "aria-label", "設定");
    setLabel(titleSettingsButton, "title", "設定");
    titleSettingsButton.addEventListener("click", () => openSettings(titleSettingsButton));
    // The page ships the gear hidden, like the disabled LOGIN button: on a slow
    // link it would otherwise show (and ignore taps) until this module loads.
    titleSettingsButton.hidden = false;
  }
  relabelChrome();
  onLocaleChange(() => relabelChrome());
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
  newGameButton.addEventListener("click", async () => {
    // The opening ends by replacing whatever is stored, so a player who
    // already has a game is asked first, while nothing has changed yet.
    const inspected = app.inspectSave();
    if (inspected.present) {
      const name = starterName(inspected.save?.creature?.displayName ?? "");
      const choice = await showChoiceDialog({
        title: uiText("要開始新遊戲嗎？"),
        message: name
          ? uiText("目前存檔「{name}」會在完成開場命名後被新遊戲取代，而且無法復原。想接著玩請選「繼續遊戲」。", { name })
          : uiText("目前的存檔會在完成開場命名後被新遊戲取代，而且無法復原。想接著玩請選「繼續遊戲」。"),
        actions: [
          { id: "cancel", label: uiText("取消"), tone: "secondary" },
          { id: "new", label: uiText("開始新遊戲"), tone: "danger" }
        ],
        cancelId: "cancel"
      });
      if (choice !== "new") return;
    }
    titleActions.hidden=true;note('');if(titleSettingsButton)titleSettingsButton.hidden=true;openingPresentation.begin();
  });
  continueButton.addEventListener("click", () => { void continueGame(); });
  installHomeEntries();
  refreshContinue();
  loginButton.disabled=false;
  // The title is the longest idle moment the player gives us: they are reading
  // it before pressing LOGIN. Warming only from mountCurrentScreen missed it
  // entirely, because the title is not mounted through there, so the first Hunt
  // still paid a cold fetch. Start the head start here.
  warmDeferredModules();

  // Background/unload resets elapsed measurement, and now also writes the
  // session: the Raising Home SAVE button was removed on 2026-09-16, so leaving
  // the page is what commits it. Save & Quit still commits explicitly.
  window.addEventListener("pagehide", () => { clockDriver?.reset(); autosaveOnHide(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") autosaveOnHide();
  });
}

boot();

export { adaptFeedback };
