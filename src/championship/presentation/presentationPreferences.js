// What the player's display preferences mean to a presentation.
//
// The settings layer resolves each preference once and writes the result on
// <html> as a data attribute (data-motion, data-flash, data-quality); the boot
// script in championship.html does the same before the first paint. A scene
// reads them here when it mounts, so presentation never imports the settings
// store and never reads storage. With no attribute (a test page, a fixture),
// motion falls back to the system setting and everything else to the default.
//
// PRODUCT_AUTHORED presentation parameters. Nothing here may change a rule,
// a coordinate the simulation reads, a collision, or the ticker's cadence:
// the battle and the raising clock advance on the one Pixi ticker, so there
// is deliberately no frame-rate cap among these (a 30 FPS cap would change
// how often the simulation steps).

/**
 * The quality tiers. Every number is used by a real consumer:
 *  pixiResolutionCap   Pixi renderer resolution = min(devicePixelRatio, cap);
 *                      applied immediately (the one renderer is resized).
 *  pixiAntialias       MSAA on the one Pixi Application; read once when the
 *                      Application is created, so it takes effect next launch.
 *  threePixelRatioCap  bounded Three.js views (Gate globe, battle cube, battle
 *                      effects, highlight shards); next time the view mounts.
 *  threeAntialias      the same views' MSAA; next mount.
 *  highlightParticles  highlight pixel shards (hard cap 160).
 *  highlightShardLife  shard lifetime multiplier after the burst.
 *  highlightStairs     stair marks lit before the charge (key feedback, >= 2).
 *  highlightDecor      beam and shock ring: "full" or "minimal".
 *  backdropBlur        frosted panels over static content (CSS, immediate).
 *  softGlow            outer glows on chosen items (CSS, immediate).
 */
export const QUALITY_TIERS = Object.freeze({
  saver: Object.freeze({
    pixiResolutionCap: 1, pixiAntialias: false, threePixelRatioCap: 1, threeAntialias: false,
    highlightParticles: 40, highlightShardLife: 0.7, highlightStairs: 2, highlightDecor: "minimal",
    backdropBlur: false, softGlow: false
  }),
  balanced: Object.freeze({
    pixiResolutionCap: 2, pixiAntialias: true, threePixelRatioCap: 2, threeAntialias: true,
    highlightParticles: 96, highlightShardLife: 1, highlightStairs: 3, highlightDecor: "full",
    backdropBlur: true, softGlow: true
  }),
  high: Object.freeze({
    pixiResolutionCap: 3, pixiAntialias: true, threePixelRatioCap: 3, threeAntialias: true,
    highlightParticles: 160, highlightShardLife: 1.25, highlightStairs: 3, highlightDecor: "full",
    backdropBlur: true, softGlow: true
  })
});

export const QUALITY_TIER_ORDER = Object.freeze(["saver", "balanced", "high"]);

/**
 * The tier "auto" starts on, from what the browser says about the device.
 * Conservative on purpose: it never picks "high" by itself, and it picks
 * "saver" only on a clear signal (data saver on, 2 GB of memory or less, or
 * two CPU cores or fewer). Everything else starts on "balanced".
 * Mirrored by the boot script in championship.html.
 */
export function initialAutoTier({ saveData = false, deviceMemory = null, hardwareConcurrency = null } = {}) {
  if (saveData === true) return Object.freeze({ tier: "saver", reason: "SAVE_DATA" });
  if (Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2) return Object.freeze({ tier: "saver", reason: "LOW_MEMORY" });
  if (Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 && hardwareConcurrency <= 2) return Object.freeze({ tier: "saver", reason: "FEW_CORES" });
  return Object.freeze({ tier: "balanced", reason: "DEFAULT" });
}

/** What the device reports, read defensively (every field may be missing). */
export function deviceSignals(nav = globalThis.navigator) {
  return Object.freeze({
    saveData: nav?.connection?.saveData === true,
    deviceMemory: Number.isFinite(nav?.deviceMemory) ? nav.deviceMemory : null,
    hardwareConcurrency: Number.isFinite(nav?.hardwareConcurrency) ? nav.hardwareConcurrency : null
  });
}

function rootData(name, doc = globalThis.document) {
  return doc?.documentElement?.dataset?.[name];
}

/** The effective tier's parameters (never "auto": that is resolved upstream). */
export function currentQualityTier(doc) {
  const tier = rootData("quality", doc);
  return QUALITY_TIERS[tier] ? tier : "balanced";
}

export function currentQuality(doc) {
  return QUALITY_TIERS[currentQualityTier(doc)];
}

/** Device pixel ratio held to the tier's cap, never below 1. */
export function cappedPixelRatio(cap, devicePixelRatio = globalThis.devicePixelRatio) {
  const ratio = Number(devicePixelRatio) || 1;
  return Math.max(1, Math.min(cap, ratio));
}

/** Whether motion is reduced: the resolved preference, else the system setting. */
export function prefersReducedMotion(doc) {
  const motion = rootData("motion", doc);
  if (motion === "reduced") return true;
  if (motion === "full") return false;
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** Multiplier for the peak opacity of flashes: 1 standard, 0.35 soft. */
export const SOFT_FLASH_SCALE = 0.35;
export function flashScale(doc) {
  return rootData("flash", doc) === "soft" ? SOFT_FLASH_SCALE : 1;
}

/** "full" or "compact": how much of the important-highlight choreography plays. */
export function highlightMode(doc) {
  return rootData("highlight", doc) === "compact" ? "compact" : "full";
}
