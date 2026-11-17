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
const MOBILE_STANDALONE_VRAM_RESOLUTION_CAP = 1.75;

function isMobileOrStandaloneHost(win = globalThis.window) {
  if (!win) return false;
  try {
    if (win.navigator?.standalone === true) return true;
    if (win.matchMedia?.("(display-mode: standalone)")?.matches === true) return true;
    if (win.matchMedia?.("(pointer: coarse)")?.matches === true) return true;
    const ua = String(win.navigator?.userAgent ?? "");
    if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true;
  } catch {}
  return false;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// The desktop interface zoom (portraitFrame, <html data-ui-zoom>) enlarges every CSS pixel,
// so the backing store follows it: the field stays as sharp as at 100%.
function pagePixelRatio() {
  const zoom = Number(globalThis.document?.documentElement?.dataset?.uiZoom);
  return (Number(globalThis.devicePixelRatio) || 1) * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
}

/** Renderer resolution: the device pixel ratio, held between 1 and the cap (and <= 1.75 on mobile/standalone). */
export function resolutionFor(cap = MAX_DEVICE_RESOLUTION, devicePixelRatio = pagePixelRatio()) {
  const baseLimit = Number.isFinite(cap) && cap >= 1 ? cap : MAX_DEVICE_RESOLUTION;
  const limit = isMobileOrStandaloneHost() ? Math.min(baseLimit, MOBILE_STANDALONE_VRAM_RESOLUTION_CAP) : baseLimit;
  return clamp(Number(devicePixelRatio) || 1, 1, limit);
}

function assertHost(canvasHost) {
  if (!canvasHost || typeof canvasHost.appendChild !== "function" || typeof canvasHost.getBoundingClientRect !== "function") {
    throw new TypeError("The Championship Pixi stage requires a canvas host element");
  }
  return canvasHost;
}

/**
 * Keep one failing per-frame callback from freezing the whole game.
 *
 * Pixi's ticker asks for the next animation frame only after every listener
 * of this frame returned; one listener that throws stops the loop for good
 * (until the page is hidden and shown again), so every screen stood still.
 * Each listener now fails alone: the frame goes on with the next listener,
 * the error is reported once per listener, and the listener's own `once`
 * bookkeeping still runs. Nothing else about the ticker changes.
 */
const ISOLATED_EMIT = Symbol.for("championship.isolatedTickerEmit");
// reportError() raises the page's error event, so the recovery diagnostics still record it.
const reportOnce = (error) => { if (typeof globalThis.reportError === "function") globalThis.reportError(error); else console.error(error); };
export function isolateTickerListenerFailures(PIXI, { report = reportOnce } = {}) {
  const proto = PIXI?.TickerListener?.prototype;
  if (!proto || typeof proto.emit !== "function" || proto.emit[ISOLATED_EMIT]) return false;
  const emit = proto.emit;
  const reported = new WeakSet();
  const isolated = function emitIsolated(ticker) {
    try {
      return emit.call(this, ticker);
    } catch (error) {
      const redirect = this.next;
      if (this._once) this.destroy(true);
      if (this._destroyed) this.next = null;
      if (!reported.has(this)) {
        reported.add(this);
        try { report(error); } catch { /* reporting never stops the frame */ }
      }
      return redirect;
    }
  };
  isolated[ISOLATED_EMIT] = true;
  proto.emit = isolated;
  return true;
}

/**
 * Keep a shared bind group alive when one texture it last drew is destroyed.
 *
 * Pixi 8.19's BindGroup.onResourceChange destroys the WHOLE group when any of
 * its resources is destroyed. The mesh renderer keeps one shared default
 * shader whose group remembers the last mesh texture it drew; when a hunt
 * ended and its rope VFX destroyed its braid texture, that shared group died,
 * and every later rope, wire or other plain mesh threw "Cannot read
 * properties of null (reading '0')" on every frame until the page reloaded:
 * the next Hunt froze as soon as a loop was drawn (memory audit 2026-11-17).
 * A destroyed texture source or sampler is now swapped for Pixi's empty
 * texture in that slot; the mesh renderer sets its real texture again before
 * each draw. Any other destroyed resource keeps Pixi's own behaviour.
 */
const KEPT_BIND_GROUPS = Symbol.for("championship.keptBindGroups");
export function keepBindGroupsWhenTexturesGo(PIXI) {
  const proto = PIXI?.BindGroup?.prototype, empty = PIXI?.Texture?.EMPTY?.source;
  if (!proto || typeof proto.onResourceChange !== "function" || proto.onResourceChange[KEPT_BIND_GROUPS] || !empty) return false;
  const original = proto.onResourceChange;
  const kept = function onResourceChange(resource) {
    const type = resource?._resourceType;
    if (!resource?.destroyed || !this.resources || (type !== "textureSource" && type !== "textureSampler")) return original.call(this, resource);
    const placeholder = type === "textureSource" ? empty : empty.style;
    for (const index in this.resources) if (this.resources[index] === resource) this.setResource(placeholder, index);
    this._dirty = true;
  };
  kept[KEPT_BIND_GROUPS] = true;
  proto.onResourceChange = kept;
  return true;
}

/**
 * Create the one Championship PixiJS Application.
 *
 * Call this once per page. `main.js` holds the single instance and hands it to
 * whichever field scene is currently mounted.
 */
export async function createChampionshipPixiStage({ PIXI, canvasHost, resolutionCap = MAX_DEVICE_RESOLUTION, antialias = true }) {
  const required = ["Application", "Assets", "Container", "Graphics", "AnimatedSprite", "Sprite", "Spritesheet", "Rectangle"];
  if (!PIXI || required.some((key) => typeof PIXI[key] !== "function" && typeof PIXI[key] !== "object")) {
    throw new TypeError("The Championship Pixi stage requires the PixiJS v8 presentation API");
  }
  let host = assertHost(canvasHost);
  isolateTickerListenerFailures(PIXI);
  keepBindGroupsWhenTexturesGo(PIXI);
  // Layout dimensions exclude the portrait frame's outer display scale.
  // Pixi maps pointer coordinates through the canvas's actual screen rect.
  const size = () => ({width: host.clientWidth || host.getBoundingClientRect().width,
    height: host.clientHeight || host.getBoundingClientRect().height});
  const rect = size();

  const app = new PIXI.Application();
  await app.init({
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    backgroundAlpha: 0,
    // The quality preference (2026-09-29) supplies both. Antialiasing is fixed
    // for the life of the Application, so a change to it applies next launch;
    // the resolution cap can change at any time (setResolutionCap below).
    antialias: antialias !== false,
    autoDensity: true,
    resolution: resolutionFor(resolutionCap),
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
  let resolutionCapNow = resolutionCap;
  let resumeAfterRestore = false;
  const resizeListeners = new Set();
  const contextLostListeners = new Set();
  const contextRestoredListeners = new Set();

  function applySize() {
    if (destroyed || contextLost) return;
    const bounds = size();
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

  let pausedByHidden = false;
  function handleVisibilityOrForeground() {
    if (destroyed || contextLost) return;
    if (globalThis.document?.hidden === true) {
      if (app.ticker.started) {
        pausedByHidden = true;
        app.stop();
      }
      return;
    }
    applySize();
    if (pausedByHidden && !app.ticker.started) {
      pausedByHidden = false;
      app.start();
    }
  }

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => applySize()) : null;
  if (resizeObserver) resizeObserver.observe(host);
  else globalThis.addEventListener?.("resize", applySize);
  globalThis.document?.addEventListener?.("visibilitychange", handleVisibilityOrForeground);
  globalThis.addEventListener?.("pageshow", handleVisibilityOrForeground);
  globalThis.addEventListener?.("focus", handleVisibilityOrForeground);
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

    /**
     * Change the renderer resolution cap (the quality tier). The canvas keeps
     * its CSS size; only how many device pixels back it changes. Pixel art
     * stays sharp because .cm-field-canvas is drawn with image-rendering:
     * pixelated and every texture samples nearest. Scenes get the usual
     * resize signal, so anything that measures the screen re-measures.
     */
    setResolutionCap(cap) {
      resolutionCapNow = cap;
      if (destroyed || contextLost) return app.renderer.resolution;
      const next = resolutionFor(cap);
      if (next === app.renderer.resolution) return next;
      const bounds = size();
      app.renderer.resize(Math.max(1, Math.round(bounds.width)), Math.max(1, Math.round(bounds.height)), next);
      applySize();
      return app.renderer.resolution;
    },

    get resolution() {
      return app.renderer.resolution;
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
        resolution: app.renderer.resolution,
        resolutionCap: resolutionCapNow,
        antialias: antialias !== false,
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
      globalThis.document?.removeEventListener?.("visibilitychange", handleVisibilityOrForeground);
      globalThis.removeEventListener?.("pageshow", handleVisibilityOrForeground);
      globalThis.removeEventListener?.("focus", handleVisibilityOrForeground);
      app.canvas.removeEventListener("webglcontextlost", handleContextLost);
      app.canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    }
  });
}
