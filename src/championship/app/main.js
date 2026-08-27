// Championship Modern -- standalone browser entry.
//
// This is the production standalone shell: the game boots, saves, and reloads
// entirely inside the Championship 2026 product boundary.
//
// The player model is direct manipulation, per ORIGINAL_RAISING_GAMEPLAY_CONTRACT:
// pick a tool, touch a creature, drag it between cages. No avatar, no D-pad, and
// no proximity rule anywhere in the product input path.

// A static JSON import, deliberately not a runtime network request: Championship
// source holds no network authority, and a static import makes the one product
// catalog this build reads a visible, compile-time dependency.
import productEntities from "../../data/championship/catalogs/entities.r1.json" with { type: "json" };

import { adaptFeedback } from "./championshipStandaloneMessages.js";
import { createChampionshipStandaloneApp } from "./championshipStandaloneApp.js";
import { RAISING_CAGES } from "./cageRoster.js";
import { createRaisingHomeP1RView } from "./raisingHomeP1RView.js";
import { createRaisingPresentationSource } from "./raisingPresentationSource.js";
import { mountRaisingFieldPixiPresentation } from "../presentation/intRh2/createRaisingFieldPixiPresentation.js";

const PIXI_V8_MODULE_URL = "../../../node_modules/pixi.js/dist/pixi.mjs";

const titleScreen = document.getElementById("cm-title");
const titleNote = document.getElementById("cm-title-note");
const newGameButton = document.getElementById("cm-new-game");
const continueButton = document.getElementById("cm-continue");
const root = document.getElementById("cm-root");

let app = null;
let view = null;

function note(message) {
  if (titleNote) titleNote.textContent = message;
}

async function mountRaisingHome() {
  titleScreen.hidden = true;
  root.hidden = false;

  view?.dispose?.();
  const source = createRaisingPresentationSource(app);
  view = await createRaisingHomeP1RView({
    root,
    source,
    async mountField({ host, source: fieldSource }) {
      try {
        const PIXI = await import(PIXI_V8_MODULE_URL);
        delete root.dataset.fieldFallback;
        return await mountRaisingFieldPixiPresentation({
          PIXI,
          canvasHost: host,
          source: fieldSource,
          onFallback(message) {
            root.dataset.fieldFallback = "true";
            console.warn(message);
          }
        });
      } catch (error) {
        root.dataset.fieldFallback = "true";
        const message = document.createElement("p");
        message.className = "int-rh2-field-fallback";
        message.textContent = "The live habitat view is unavailable. Screen controls and save remain available.";
        host.append(message);
        console.warn(`INT_RH2_PIXI_FALLBACK: ${error.message}`);
        return Object.freeze({
          render() {},
          dispose() { message.remove(); }
        });
      }
    }
  });
}

async function startNewGame() {
  newGameButton.disabled = true;
  continueButton.disabled = true;
  try {
    await app.newGame();
    await mountRaisingHome();
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
    await mountRaisingHome();
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
