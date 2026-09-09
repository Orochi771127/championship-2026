// Championship 2026 -- the single PixiJS stage host.
//
// WHY THIS EXISTS
// ---------------
// VS1 rendered one screen, so the Raising field could own its own Application.
// VS2 adds a second playable field, and the Owner renderer policy allows exactly
// one Pixi bootstrap and one Application-owned ticker for the whole product. A
// second Application bootstrap is forbidden and the migration firewall counts
// them, so the one bootstrap lives here and every playable field becomes a SCENE
// on this stage.
//
// The stage owns the Application, the canvas, its placement in the DOM, and the
// resize signal. It owns no gameplay state, no save state, no routing, and no
// scene content. A scene owns its own container, its own pointer handlers and
// its own ticker callback, and removes all three when it is disposed.

const MAX_DEVICE_RESOLUTION = 2;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assertHost(canvasHost) {
  if (!canvasHost || typeof canvasHost.appendChild !== "function" || typeof canvasHost.getBoundingClientRect !== "function") {
    throw new TypeError("The Championship Pixi stage requires a canvas host element");
  }
  return canvasHost;
}

/**
 * Create the one Championship PixiJS Application.
 *
 * Call this once per page. `main.js` holds the single instance and hands it to
 * whichever field scene is currently mounted.
 */
export async function createChampionshipPixiStage({ PIXI, canvasHost }) {
  const required = ["Application", "Assets", "Container", "Graphics", "AnimatedSprite", "Sprite", "Spritesheet", "Rectangle"];
  if (!PIXI || required.some((key) => typeof PIXI[key] !== "function" && typeof PIXI[key] !== "object")) {
    throw new TypeError("The Championship Pixi stage requires the PixiJS v8 presentation API");
  }
  let host = assertHost(canvasHost);
  const rect = host.getBoundingClientRect();

  const app = new PIXI.Application();
  await app.init({
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: clamp(Number(globalThis.devicePixelRatio) || 1, 1, MAX_DEVICE_RESOLUTION),
    autoStart: true,
    sharedTicker: false,
    powerPreference: "high-performance",
    eventFeatures: { move: true, globalMove: true, click: true, wheel: false }
  });

  app.canvas.classList.add("cm-field-canvas");
  app.canvas.setAttribute("aria-hidden", "true");
  app.canvas.tabIndex = -1;
  app.canvas.style.touchAction = "none";
  app.stage.eventMode = "static";
  host.appendChild(app.canvas);

  let destroyed = false;
  let contextLost = false;
  let resumeAfterRestore = false;
  const resizeListeners = new Set();
  const contextLostListeners = new Set();
  const contextRestoredListeners = new Set();

  function applySize() {
    if (destroyed || contextLost) return;
    const bounds = host.getBoundingClientRect();
    app.renderer.resize(Math.max(1, Math.round(bounds.width)), Math.max(1, Math.round(bounds.height)));
    app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);
    for (const listener of [...resizeListeners]) {
      try { listener(); } catch { /* a failing observer must not break the stage */ }
    }
  }

  function handleContextLost(event) {
    event.preventDefault();
    if (destroyed || contextLost) return;
    resumeAfterRestore = app.ticker.started;
    contextLost = true;
    app.stop();
    app.canvas.hidden = true;
    for (const listener of [...contextLostListeners]) {
      try { listener(); } catch { /* as above */ }
    }
  }

  function handleContextRestored() {
    if (destroyed || !contextLost) return;
    // Pixi installed its restoration listener during init, before this host.
    // Its renderer restores GPU resources on the SAME Application and canvas.
    contextLost = false;
    applySize();
    app.canvas.hidden = false;
    for (const listener of [...contextRestoredListeners]) {
      try { listener(); } catch { /* observers must not prevent restoration */ }
    }
    // Clock observers reset before ticking; suspended time is never simulated.
    if (resumeAfterRestore) app.start();
    resumeAfterRestore = false;
  }

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => applySize()) : null;
  if (resizeObserver) resizeObserver.observe(host);
  else globalThis.addEventListener?.("resize", applySize);
  app.canvas.addEventListener("webglcontextlost", handleContextLost);
  app.canvas.addEventListener("webglcontextrestored", handleContextRestored);
  applySize();

  return Object.freeze({
    PIXI,
    app,

    get screen() {
      return app.screen;
    },

    get contextLost() {
      return contextLost;
    },

    /**
     * Move the canvas into a new screen's field host.
     *
     * Screens come and go; the Application does not. Re-parenting the existing
     * canvas is what keeps the bootstrap count at one across a screen change.
     */
    attach(nextHost) {
      if (destroyed) throw new Error("CHAMPIONSHIP_PIXI_STAGE_DESTROYED");
      const target = assertHost(nextHost);
      if (target !== host) {
        resizeObserver?.unobserve(host);
        host = target;
        resizeObserver?.observe(host);
      }
      if (app.canvas.parentNode !== host) host.appendChild(app.canvas);
      applySize();
      return this;
    },

    /** A scene subscribes for the one resize signal instead of observing itself. */
    onResize(listener) {
      resizeListeners.add(listener);
      return () => resizeListeners.delete(listener);
    },

    onContextLost(listener) {
      contextLostListeners.add(listener);
      return () => contextLostListeners.delete(listener);
    },

    onContextRestored(listener) {
      contextRestoredListeners.add(listener);
      return () => contextRestoredListeners.delete(listener);
    },

    /**
     * Mark the shared canvas as belonging to the mounted scene.
     *
     * The Application is shared, but the canvas still needs a per-scene hook for
     * scene-specific styling and QA selectors. Returns an unmark function the
     * scene calls on dispose.
     */
    markScene(className) {
      app.canvas.classList.add(className);
      return () => app.canvas.classList.remove(className);
    },

    /** Create a scene root already added to the stage. The caller destroys it. */
    createSceneRoot(label) {
      const root = new PIXI.Container({ isRenderGroup: true, label });
      app.stage.addChild(root);
      return root;
    },

    getDiagnostics() {
      return Object.freeze({
        renderer: "CHAMPIONSHIP_SINGLE_PIXI_STAGE",
        applicationCount: 1,
        ticker: "APPLICATION_OWNED",
        threeUsed: false,
        sceneCount: app.stage.children.length,
        contextLost,
        viewport: Object.freeze({ width: app.screen.width, height: app.screen.height })
      });
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      resizeListeners.clear();
      contextLostListeners.clear();
      contextRestoredListeners.clear();
      resizeObserver?.disconnect();
      if (!resizeObserver) globalThis.removeEventListener?.("resize", applySize);
      app.canvas.removeEventListener("webglcontextlost", handleContextLost);
      app.canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    }
  });
}
