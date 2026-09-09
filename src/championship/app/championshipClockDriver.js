// Page-level elapsed adapter on the existing Pixi Application ticker.
// No RAF, timer, renderer or second world-clock state is created here.
//
// ROM OVL18 -> common update -> clock writer runs once per VBlank. At the
// nominal DS cadence both possible timer deltas (8752/8753) convert to 16
// elapsed units after the original integer division. Primary hardware timing
// and exact instruction receipts: docs/research/round2-clock-2026-09-05/.
export const NATIVE_CLOCK_CADENCE = Object.freeze({
  busClockHz: 33513982,
  busCyclesPerFrame: 560190,
  elapsedUnitsPerFrame: 16,
  trainingDivisor: 200,
  evidence: "DERIVED_NOMINAL_UNLAGGED_ROM_VBLANK_CADENCE"
});

// Web suspension boundary, not an original lag/catch-up rule. Hidden tabs,
// replaced sessions and long event-loop gaps never accrue offline growth.
export const MAX_CLOCK_DRIVER_GAP_MICROSECONDS = 2000000;
const FRAME_DENOMINATOR = NATIVE_CLOCK_CADENCE.busCyclesPerFrame * 1000000;

export function createChampionshipClockDriver({
  app, ticker,
  now = () => performance.now(),
  isVisible = () => true,
  isContextLost = () => false,
  isModalOpen = () => false
} = {}) {
  if (!app || typeof app.advanceNaturalClock !== "function" || typeof ticker?.add !== "function" || typeof ticker?.remove !== "function") {
    throw new TypeError("The clock driver requires the existing app and Application ticker");
  }
  let active = false;
  let disposed = false;
  let lastMicros = null;
  let frameRemainder = 0;
  let currentSession = null;
  let currentScreen = app.getScreen?.();

  function reset() {
    lastMicros = null;
    frameRemainder = 0;
    currentSession = app.getSession();
  }

  function tick() {
    if (disposed) return;
    const session = app.getSession();
    if (session !== currentSession) reset();
    if (!active || !session || !isVisible() || isContextLost() || isModalOpen()) {
      reset();
      return;
    }
    // The original Raising scene enters day-end when the clock raises its
    // flag. A restored 22:00 Home must take the same path once it is active.
    if(app.settleNaturalRaisingDay?.()){reset();return;}
    if(!app.getClockRunState().running&&!app.hasRaisingPresentation?.()){reset();return;}
    const micros = Math.round(now() * 1000);
    if (!Number.isSafeInteger(micros)) { reset(); return; }
    if (lastMicros === null) { lastMicros = micros; return; }
    const delta = micros - lastMicros;
    lastMicros = micros;
    if (delta < 0 || delta > MAX_CLOCK_DRIVER_GAP_MICROSECONDS) { frameRemainder = 0; return; }
    const numerator = frameRemainder + delta * NATIVE_CLOCK_CADENCE.busClockHz;
    const frames = Math.floor(numerator / FRAME_DENOMINATOR);
    frameRemainder = numerator % FRAME_DENOMINATOR;
    if (frames > 0){if(app.hasRaisingPresentation?.())app.advanceRaisingPresentation({frames});else app.advanceNaturalClock({ frames });}
  }

  ticker.add(tick);
  const unsubscribeScreen = app.subscribeScreen(() => {
    const next = app.getScreen?.();
    // Tool selection and HUD publications also notify this shared channel.
    // They must not discard elapsed time while the same Hunt is active.
    if (next !== currentScreen) { currentScreen = next; reset(); }
  });
  return Object.freeze({
    reset,
    setActive(value) { active = value === true; reset(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      ticker.remove(tick);
      unsubscribeScreen();
      reset();
    }
  });
}
