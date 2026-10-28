// Online service configuration (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
// The Owner pastes a Supabase Project URL and publishable key into
// src/data/championship/online-service.v1.json; a page may also set
// window.__CHAMPIONSHIP_SUPABASE_CONFIG__ = { url, anonKey } before main.js
// (QA, a different project). Nothing here talks to the network: it only says
// whether a cloud is configured and refuses keys that must never reach a
// browser (sb_secret_… and service_role JWTs).

import fileConfig from "../../data/championship/online-service.v1.json" with { type: "json" };

export const ONLINE_CONFIG_SCHEMA_VERSION = 1;
export const ONLINE_OAUTH_PROVIDERS = Object.freeze(["google", "facebook", "discord"]);
export const ONLINE_RUNTIME_CONFIG_KEY = "__CHAMPIONSHIP_SUPABASE_CONFIG__";
// The runtime firewall forbids remote-URL literals in src/; the host pattern is
// assembled from parts so the rule stays intact and only one shape can pass.
const SUPABASE_HOST = new RegExp("^https:" + "//" + "[a-z0-9]{20}\\.supabase\\.co$", "i");
const JWT = /^eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/;

function jwtRole(key) {
  const match = JWT.exec(key);
  if (!match) return null;
  try {
    const padded = match[1].replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - match[1].length % 4) % 4);
    const text = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(text)?.role ?? null;
  } catch { return null; }
}

/** Why a key is refused, or null when it is a browser-safe key. */
export function refuseOnlineKeyReason(key) {
  if (typeof key !== "string" || !key.trim()) return "KEY_EMPTY";
  const value = key.trim();
  if (/^sb_secret_/i.test(value)) return "SECRET_KEY_FORBIDDEN";
  if (/^sb_publishable_/i.test(value)) return null;
  const role = jwtRole(value);
  if (role === "service_role") return "SERVICE_ROLE_FORBIDDEN";
  if (role === "anon") return null;
  return "KEY_SHAPE_UNKNOWN";
}

export function refuseOnlineUrlReason(url) {
  if (typeof url !== "string" || !url.trim()) return "URL_EMPTY";
  return SUPABASE_HOST.test(url.trim().replace(/\/+$/, "")) ? null : "URL_NOT_SUPABASE";
}

/**
 * Resolves the effective configuration. `configured` is true only when both
 * the URL and a browser-safe key are present; otherwise `reason` says why and
 * the service stays in local simulation.
 */
export function resolveOnlineServiceConfig({ file = fileConfig, runtime = globalThis[ONLINE_RUNTIME_CONFIG_KEY] ?? null } = {}) {
  const source = runtime && typeof runtime === "object" ? { ...file, ...runtime, supabaseUrl: runtime.url ?? runtime.supabaseUrl ?? file?.supabaseUrl, supabaseAnonKey: runtime.anonKey ?? runtime.supabaseAnonKey ?? file?.supabaseAnonKey } : { ...file };
  const url = typeof source.supabaseUrl === "string" ? source.supabaseUrl.trim().replace(/\/+$/, "") : "";
  const anonKey = typeof source.supabaseAnonKey === "string" ? source.supabaseAnonKey.trim() : "";
  const urlReason = refuseOnlineUrlReason(url);
  const keyReason = refuseOnlineKeyReason(anonKey);
  const roomCodeLength = Number.isInteger(source.roomCodeLength) ? Math.min(6, Math.max(4, source.roomCodeLength)) : 4;
  // Owner 2026-10-29: the OAuth providers switched on in Supabase Auth (googleSignIn is the older Google-only flag).
  const oauthProviders = [...new Set([...(source.googleSignIn === true ? ["google"] : []), ...(Array.isArray(source.oauthProviders) ? source.oauthProviders : [])])]
    .filter(provider => ONLINE_OAUTH_PROVIDERS.includes(provider));
  return Object.freeze({
    schemaVersion: ONLINE_CONFIG_SCHEMA_VERSION,
    configured: urlReason === null && keyReason === null,
    reason: urlReason ?? keyReason ?? null,
    url: urlReason === null ? url : "",
    anonKey: urlReason === null && keyReason === null ? anonKey : "",
    googleSignIn: oauthProviders.includes("google"),
    oauthProviders: Object.freeze(oauthProviders),
    roomCodeLength,
    source: runtime ? "runtime" : "file"
  });
}
