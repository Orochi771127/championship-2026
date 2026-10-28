// Community links (OWNER_APPROVED_ADAPTATION 2026-10-29): the one place the
// game's own Discord, Facebook, X / Threads and Bahamut pages are configured.
//
// Owner: paste each invite or page link between the quotes of its `url`
// (lines 17-20). A key whose url is empty shows as "coming soon". Only https
// links on that channel's own hosts are accepted; anything else is refused
// here at runtime and by tests/championship-migration-firewall-cases.mjs.
// Every link opens in a new tab with rel="noopener noreferrer", so a Home
// Screen web app keeps its game running behind it.

export const SOCIAL_LINKS_SCHEMA_VERSION = 1;
export const SOCIAL_LINK_IDS = Object.freeze(["discord", "facebook", "x", "bahamut"]);

// Brand colours from the Owner brief; glyphs are plain text, not brand art.
export const SOCIAL_LINKS = Object.freeze([
  // Owner: e.g. an invite link on discord.gg
  Object.freeze({ id: "discord", url: "", color: "#5865F2", ink: "#ffffff", glyph: "🎮" }),
  Object.freeze({ id: "facebook", url: "", color: "#1877F2", ink: "#ffffff", glyph: "📘" }),
  Object.freeze({ id: "x", url: "", color: "#14171A", ink: "#ffffff", glyph: "🐦" }),
  Object.freeze({ id: "bahamut", url: "", color: "#00B4D8", ink: "#05212b", glyph: "🔥" })
]);

// The hosts each channel may point at. Host names only: the runtime firewall
// forbids URL literals in src/ outside the configured `url` values above.
const SOCIAL_LINK_HOSTS = Object.freeze({
  discord: Object.freeze(["discord.gg", "discord.com", "www.discord.com"]),
  facebook: Object.freeze(["facebook.com", "www.facebook.com", "m.facebook.com"]),
  x: Object.freeze(["x.com", "twitter.com", "threads.net", "www.threads.net", "threads.com", "www.threads.com"]),
  bahamut: Object.freeze(["forum.gamer.com.tw", "home.gamer.com.tw", "gamer.com.tw", "www.gamer.com.tw", "m.gamer.com.tw"])
});

export function socialLinkHosts(id) {
  return SOCIAL_LINK_HOSTS[id] ?? Object.freeze([]);
}

/** Why a configured link is refused, or null when the dock may open it. */
export function refuseSocialLinkReason(id, url) {
  if (!SOCIAL_LINK_IDS.includes(id)) return "LINK_CHANNEL_UNKNOWN";
  if (typeof url !== "string" || !url.trim()) return "LINK_EMPTY";
  let parsed;
  try { parsed = new URL(url.trim()); } catch { return "LINK_INVALID"; }
  if (parsed.protocol !== "https:") return "LINK_NOT_HTTPS";
  if (parsed.username || parsed.password) return "LINK_HAS_CREDENTIALS";
  if (parsed.port) return "LINK_HAS_PORT";
  if (!socialLinkHosts(id).includes(parsed.hostname.toLowerCase())) return "LINK_HOST_NOT_ALLOWED";
  return null;
}

/**
 * The dock's keys in order: the channel, its colours, and a safe `href` or
 * null ("coming soon") with the refusal reason.
 */
export function resolveSocialLinks(links = SOCIAL_LINKS) {
  return Object.freeze(links.filter(link => SOCIAL_LINK_IDS.includes(link?.id)).map(link => {
    const reason = refuseSocialLinkReason(link.id, link.url);
    return Object.freeze({ id: link.id, color: link.color, ink: link.ink, glyph: link.glyph,
      href: reason === null ? new URL(link.url.trim()).href : null, reason });
  }));
}
