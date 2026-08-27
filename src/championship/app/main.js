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
import { createChampionshipPixiStage } from "../presentation/championshipPixiStage.js";
import { mountRaisingFieldPixiPresentation } from "../presentation/intRh2/createRaisingFieldPixiPresentation.js";
import { mountHuntFieldPixiPresentation } from "../presentation/vs2/createHuntFieldPixiPresentation.js";

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

  // The expedition entry point. Raising Home is Codex's P1R screen, and
  // navigation is Claude's lane, so this is appended as a neutral runtime
  // control instead of being edited into the P1R view. It disappears with the
  // screen, because the P1R dispose clears the root.
  const entry = document.createElement("button");
  entry.type = "button";
  entry.className = "cm-button cm-button--primary cm-vs2-entry";
  entry.dataset.cmAction = "open-gate";
  entry.dataset.uiAuthority = "CLAUDE_NEUTRAL_RUNTIME_SHELL_AWAITING_P1R";
  entry.textContent = "Go to the gates";
  root.append(entry);

  return Object.freeze({
    render: p1r.render,
    inspect: p1r.inspect,
    dispose() {
      entry.remove();
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
    else if (target === CHAMPIONSHIP_SCREENS.GATE_SELECT) view = createGateSelectView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) view = createHuntLoadoutView({ root, source: expeditionSource });
    else if (target === CHAMPIONSHIP_SCREENS.HUNT_FIELD) view = await mountHuntField();
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

/** The Raising Home screen owns the only entry into the expedition flow. */
function installGateEntry() {
  root.addEventListener("click", (event) => {
    const trigger = event.target?.closest?.("[data-cm-action='open-gate']");
    if (!trigger) return;
    event.preventDefault();
    expeditionSource?.intents.openGate();
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
  installGateEntry();
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
