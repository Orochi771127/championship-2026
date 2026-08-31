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
import productEntities from "../../data/championship/catalogs/entities.r1.json" with { type: "json" };

import { adaptFeedback } from "./championshipStandaloneMessages.js";
import { createChampionshipStandaloneApp } from "./championshipStandaloneApp.js";
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
import { mountGateSelectThreePresentation } from "../presentation/vs2/createGateSelectThreePresentation.js";

const PIXI_V8_MODULE_URL = "../../../node_modules/pixi.js/dist/pixi.mjs";

const titleScreen = document.getElementById("cm-title");
const titleNote = document.getElementById("cm-title-note");
const newGameButton = document.getElementById("cm-new-game");
const continueButton = document.getElementById("cm-continue");
const root = document.getElementById("cm-root");

let app = null;
let view = null;
let raisingSource = null;
let expeditionSource = null;
let unsubscribeScreen = null;
let unsubscribeExpedition = null;
let mountedScreen = null;
let mounting = null;

// The one Pixi Application for the whole product. Created lazily on the first
// field mount and re-attached to whichever screen's field host is current.
let pixiStage = null;

function note(message) {
  if (titleNote) titleNote.textContent = message;
}

async function ensurePixiStage(canvasHost) {
  const PIXI = await import(PIXI_V8_MODULE_URL);
  if (!pixiStage) pixiStage = await createChampionshipPixiStage({ PIXI, canvasHost });
  else pixiStage.attach(canvasHost);
  return pixiStage;
}

/** Shared fallback: a field that cannot start must never take the screen with it. */
function fieldFallback(host, error) {
  root.dataset.fieldFallback = "true";
  const message = document.createElement("p");
  message.className = "int-rh2-field-fallback";
  message.textContent = "The live field view is unavailable. Screen controls and save remain available.";
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
  const p1r = await createRaisingHomeP1RView({
    root,
    source: raisingSource,
    async mountField({ host, source: fieldSource }) {
      try {
        const stage = await ensurePixiStage(host);
        delete root.dataset.fieldFallback;
        return await mountRaisingFieldPixiPresentation({
          stage,
          source: fieldSource,
          onFallback(message) {
            root.dataset.fieldFallback = "true";
            console.warn(message);
          }
        });
      } catch (error) {
        return fieldFallback(host, error);
      }
    }
  });

  // The expedition entry point is presentation-only. Navigation remains the
  // published openGate intent below; this control holds no screen state.
  const entry = document.createElement("button");
  entry.type = "button";
  entry.className = "cm-button cm-button--primary cm-vs2-entry cm-vs2-entry--gates";
  entry.dataset.cmAction = "open-gate";
  entry.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  entry.setAttribute("aria-label", "Open Gate Select");
  entry.textContent = "GATES";
  const shopEntry = document.createElement("button");
  shopEntry.type = "button";
  shopEntry.className = "cm-button cm-button--primary cm-vs2-entry cm-vs2-entry--shop";
  shopEntry.dataset.cmAction = "open-shop";
  shopEntry.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  shopEntry.setAttribute("aria-label", "Open Shop");
  shopEntry.textContent = "SHOP";
  const databaseEntry = document.createElement("button");
  databaseEntry.type = "button";
  databaseEntry.className = "cm-button cm-button--primary cm-vs2-entry cm-vs2-entry--database";
  databaseEntry.dataset.cmAction = "open-database";
  databaseEntry.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  databaseEntry.setAttribute("aria-label", "Open Database");
  databaseEntry.textContent = "DATA";
  const cageEntry = document.createElement("button");
  cageEntry.type = "button";
  cageEntry.className = "cm-button cm-button--primary cm-vs2-entry cm-vs2-entry--cage";
  cageEntry.dataset.cmAction = "open-cage";
  cageEntry.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  cageEntry.setAttribute("aria-label", "Open Cage editor");
  cageEntry.textContent = "CAGE";
  const homeEntries = document.createElement("nav");
  homeEntries.className = "cm-vs2-home-entries";
  homeEntries.setAttribute("aria-label", "Home destinations");
  homeEntries.append(cageEntry, databaseEntry, shopEntry, entry);
  root.append(homeEntries);

  return Object.freeze({
    render: p1r.render,
    inspect: p1r.inspect,
    dispose() {
      homeEntries.remove();
      p1r.dispose();
    }
  });
}

async function mountHuntField() {
  return createHuntFieldView({
    root,
    source: expeditionSource,
    async mountField({ host, source: fieldSource }) {
      try {
        const stage = await ensurePixiStage(host);
        delete root.dataset.fieldFallback;
        return await mountHuntFieldPixiPresentation({
          stage,
          source: fieldSource,
          onFallback(message) {
            root.dataset.fieldFallback = "true";
            console.warn(message);
          }
        });
      } catch (error) {
        return fieldFallback(host, error);
      }
    }
  });
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
    else if (target === CHAMPIONSHIP_SCREENS.GATE_SELECT) view = await mountGateSelect();
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) view = createHuntLoadoutView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_FIELD) view = await mountHuntField();
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_RESULT) view = createHuntResultView({ root, source: expeditionSource });
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
  expeditionSource = createGateHuntPresentationSource(app);

  // One subscription repaints the mounted view; a screen change swaps it.
  unsubscribeExpedition = expeditionSource.subscribe((frame) => {
    if (frame.screen !== mountedScreen) return;
    if (frame.screen === CHAMPIONSHIP_SCREENS.RAISING_HOME) return;
    view?.render?.(frame);
  });
  unsubscribeScreen = app.subscribeScreen(() => { void mountCurrentScreen(); });

  mountedScreen = null;
  await mountCurrentScreen();
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
    const cage = event.target?.closest?.("[data-cm-action='open-cage']");
    if (!cage) return;
    event.preventDefault();
    expeditionSource?.intents.openCageEdit();
  });
}

async function startNewGame() {
  newGameButton.disabled = true;
  continueButton.disabled = true;
  try {
    await app.newGame();
    await openGameplay();
  } catch (error) {
    note(`Could not start a new game: ${error.message}`);
    newGameButton.disabled = false;
    refreshContinue();
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
    note(`Could not load your saved game: ${error.message}`);
    newGameButton.disabled = false;
  }
}

function refreshContinue() {
  const inspected = app.inspectSave();
  continueButton.disabled = !inspected.present;
  if (inspected.present) {
    note(`Saved game found: ${inspected.save.creature.displayName}.`);
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
    note(`Championship 2026 could not start: ${error.message}`);
    newGameButton.disabled = true;
    continueButton.disabled = true;
    return;
  }

  newGameButton.addEventListener("click", () => { void startNewGame(); });
  continueButton.addEventListener("click", () => { void continueGame(); });
  installHomeEntries();
  refreshContinue();

  // Closing the tab should not silently lose the session.
  const persistOnHide = () => {
    if (!app?.getSession()) return;
    try { app.save(); } catch { /* a failed autosave must not block unload */ }
  };
  window.addEventListener("pagehide", persistOnHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistOnHide();
  });
}

boot();

export { adaptFeedback };
