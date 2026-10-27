// Loads the vendored supabase-js UMD build on demand (OWNER_APPROVED_ADAPTATION
// 2026-10-28). The file is copied from the pinned npm package into
// assets/production/public-runtime/vendor-supabase.js by the public-program
// recipe (PUBLIC_PROGRAM_SOURCES), exactly as pixi is; no CDN, no remote URL.
// It is fetched only when a cloud is configured and the player is online, so
// offline play never pays for it.

const VENDOR_URL = new URL("../../../assets/production/public-runtime/vendor-supabase.js", import.meta.url).href;
let loading = null;

export function supabaseVendorUrl() { return VENDOR_URL; }

/** Resolves the UMD global ({ createClient }) or rejects; one in-flight load. */
export function loadSupabaseLibrary({ doc = globalThis.document, win = globalThis, timeoutMs = 20000 } = {}) {
  if (win?.supabase?.createClient) return Promise.resolve(win.supabase);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (!doc?.createElement) { loading = null; reject(new Error("SUPABASE_LOADER_NO_DOCUMENT")); return; }
    const script = doc.createElement("script");
    script.src = VENDOR_URL; script.async = true; script.dataset.vendor = "supabase";
    const timer = setTimeout(() => { script.remove(); loading = null; reject(new Error("SUPABASE_LOADER_TIMEOUT")); }, timeoutMs);
    script.addEventListener("load", () => { clearTimeout(timer); if (win.supabase?.createClient) resolve(win.supabase); else { loading = null; reject(new Error("SUPABASE_LOADER_NO_GLOBAL")); } }, { once: true });
    script.addEventListener("error", () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error("SUPABASE_LOADER_FAILED")); }, { once: true });
    (doc.head ?? doc.body ?? doc.documentElement).append(script);
  });
  return loading;
}
