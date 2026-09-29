// The effective quality tier, and the one conservative adjustment "auto" may make.
//
// A fixed choice (saver / balanced / high) is used as is and never changed.
// "auto" starts from the device signals (initialAutoTier) and may then step
// down ONCE, from balanced to saver, when the frame time stays long while a
// scene is settled and visible: two consecutive 5-second windows with a median
// frame time above 28 ms (under about 35 FPS). It never steps up by itself, so
// it cannot oscillate. Windows are thrown away while a screen is changing or
// loading, while the page is hidden, and whenever a single frame took longer
// than 250 ms (a tab switch or a stall is not a slow device).
//
// Sampling reads the one Pixi ticker's deltaMS from a callback on that same
// ticker: no second loop, no requestAnimationFrame.

import { QUALITY_TIERS, deviceSignals, initialAutoTier } from "../../presentation/presentationPreferences.js";

export const AUTO_QUALITY_WINDOW_MS = 5000;
export const AUTO_QUALITY_SLOW_MEDIAN_MS = 28;
export const AUTO_QUALITY_STALL_MS = 250;
export const AUTO_QUALITY_BAD_WINDOWS = 2;

const REASONS = Object.freeze({
  SAVE_DATA: "裝置開啟了省流量模式，自動使用省電。",
  LOW_MEMORY: "裝置記憶體較少，自動使用省電。",
  FEW_CORES: "裝置處理器核心較少，自動使用省電。",
  DEFAULT: "自動使用平衡。",
  SLOW_FRAMES: "畫面持續低於約 35 FPS，已自動改用省電（本次遊玩不會再改回）。"
});

export function createQualityController({
  doc = globalThis.document,
  preference = "auto",
  signals = deviceSignals()
} = {}) {
  const start = initialAutoTier(signals);
  let chosen = preference;
  let autoTier = start.tier;
  let reasonCode = start.reason;
  let steppedDown = false;
  let effective = null;
  const listeners = new Set();

  // Frame sampling state.
  let windowFrames = [];
  let windowTime = 0;
  let badWindows = 0;
  let detach = null;

  function resolve() {
    return chosen === "auto" ? autoTier : (QUALITY_TIERS[chosen] ? chosen : "balanced");
  }

  function apply() {
    const next = resolve();
    if (doc?.documentElement) doc.documentElement.dataset.quality = next;
    if (next === effective) return;
    effective = next;
    for (const listener of [...listeners]) { try { listener(describe()); } catch { /* an observer must not break quality */ } }
  }

  function describe() {
    return Object.freeze({
      preference: chosen,
      tier: effective ?? resolve(),
      parameters: QUALITY_TIERS[effective ?? resolve()],
      reason: chosen === "auto" ? REASONS[reasonCode] : null,
      reasonCode: chosen === "auto" ? reasonCode : null,
      steppedDown
    });
  }

  function resetWindow() { windowFrames = []; windowTime = 0; }

  function sample(deltaMs, stable) {
    if (chosen !== "auto" || steppedDown || autoTier === "saver") return;
    if (!stable || !(deltaMs > 0)) { resetWindow(); badWindows = 0; return; }
    if (deltaMs > AUTO_QUALITY_STALL_MS) { resetWindow(); return; }
    windowFrames.push(deltaMs);
    windowTime += deltaMs;
    if (windowTime < AUTO_QUALITY_WINDOW_MS) return;
    const sorted = [...windowFrames].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    resetWindow();
    badWindows = median > AUTO_QUALITY_SLOW_MEDIAN_MS ? badWindows + 1 : 0;
    if (badWindows >= AUTO_QUALITY_BAD_WINDOWS) {
      steppedDown = true;
      autoTier = "saver";
      reasonCode = "SLOW_FRAMES";
      apply();
    }
  }

  apply();

  return Object.freeze({
    describe,
    /** The preference changed: a fixed tier applies at once; auto resumes its own tier. */
    setPreference(value) {
      if (value === chosen) return;
      chosen = value;
      resetWindow();
      badWindows = 0;
      apply();
    },
    /**
     * Watch the one Pixi ticker. `isStable()` says whether the current frame
     * may count (a settled, visible, loaded scene).
     */
    attachTicker(ticker, { isStable = () => true } = {}) {
      detach?.();
      if (!ticker?.add) return;
      const onTick = (tick) => sample(tick?.deltaMS ?? ticker.deltaMS, isStable());
      ticker.add(onTick);
      detach = () => { ticker.remove?.(onTick); detach = null; };
    },
    /** Test and QA seam: feed one frame without a ticker. */
    sample,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A quality observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() { detach?.(); listeners.clear(); }
  });
}
