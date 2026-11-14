// Turns the preference set into what the page shows.
//
// Every visible preference becomes one attribute on <html>, which the
// stylesheets and presentations read (see presentationPreferences.js):
//   data-theme        arcade (always: the three themes share the arcade interface)
//   data-theme-tone   arcade | cyber | breeze   (the palette)
//   data-theme-choice arcade | cyber | breeze
//   data-text-scale   100 | 115 | 130
//   data-hud          standard | compact
//   data-motion       full | reduced            (resolved: "system" follows the OS)
//   data-flash        standard | soft
//   data-highlight    full | compact
//   lang              zh-Hant | en
// data-quality belongs to the quality controller (it can depend on the device).
// The boot script in championship.html applies the same mapping before the
// first paint, so a saved theme never flashes the default one first.

import { resolveReducedMotion, resolveTheme, resolveThemeTone } from "./preferenceSchema.js";
import { setLocale } from "../../text/locale.js";

export const THEME_COLORS = Object.freeze({ arcade: "#2b1d4a", cyber: "#10233a", breeze: "#1d66c9" });
export const THEME_SCHEMES = Object.freeze({ arcade: "light", cyber: "light", breeze: "light" });

export function createPreferenceEnvironment({
  store,
  doc = globalThis.document,
  matchMedia = globalThis.matchMedia?.bind(globalThis),
  quality = null
} = {}) {
  if (!store) throw new TypeError("The preference environment needs a preference store");
  const darkQuery = safeQuery(matchMedia, "(prefers-color-scheme: dark)");
  const motionQuery = safeQuery(matchMedia, "(prefers-reduced-motion: reduce)");
  const listeners = new Set();
  let resolved = null;

  function compute() {
    const values = store.get();
    const prefersDark = darkQuery ? darkQuery.matches === true : true;
    const systemReduced = motionQuery?.matches === true;
    return Object.freeze({
      theme: resolveTheme(values.theme, { prefersDark }),
      themeTone: resolveThemeTone(values.theme),
      themeChoice: values.theme,
      prefersDark,
      systemReduced,
      reducedMotion: resolveReducedMotion(values.reducedMotion, { systemReduced }),
      textScale: values.textScale,
      hudDensity: values.hudDensity,
      flashIntensity: values.flashIntensity,
      highlightMode: values.highlightMode,
      locale: values.locale
    });
  }

  function apply() {
    resolved = compute();
    const root = doc?.documentElement;
    if (root) {
      root.dataset.theme = resolved.theme;
      root.dataset.themeTone = resolved.themeTone;
      root.dataset.themeChoice = resolved.themeChoice;
      root.dataset.textScale = String(resolved.textScale);
      root.dataset.hud = resolved.hudDensity;
      root.dataset.motion = resolved.reducedMotion ? "reduced" : "full";
      root.dataset.flash = resolved.flashIntensity;
      root.dataset.highlight = resolved.highlightMode;
      root.lang = resolved.locale;
      const scheme = doc.querySelector?.('meta[name="color-scheme"]');
      if (scheme) scheme.setAttribute("content", THEME_SCHEMES[resolved.themeTone]);
      const color = doc.querySelector?.('meta[name="theme-color"]');
      if (color) color.setAttribute("content", THEME_COLORS[resolved.themeTone]);
    }
    setLocale(resolved.locale);
    quality?.setPreference?.(store.get().quality);
    for (const listener of [...listeners]) { try { listener(resolved); } catch { /* an observer must not break the page */ } }
    return resolved;
  }

  const stopStore = store.subscribe(() => apply());
  const onSystemChange = () => apply();
  darkQuery?.addEventListener?.("change", onSystemChange);
  motionQuery?.addEventListener?.("change", onSystemChange);
  apply();

  return Object.freeze({
    resolved: () => resolved,
    apply,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("An environment observer must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stopStore();
      darkQuery?.removeEventListener?.("change", onSystemChange);
      motionQuery?.removeEventListener?.("change", onSystemChange);
      listeners.clear();
    }
  });
}

function safeQuery(matchMedia, query) {
  try { return typeof matchMedia === "function" ? matchMedia(query) : null; } catch { return null; }
}
