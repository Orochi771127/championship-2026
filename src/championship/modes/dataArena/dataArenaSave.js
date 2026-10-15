// Data Arena -- the mode's own local records, isolated from the game save.
//
// Schema `dataArena.v1` under its own storage key, written only through the
// product's one persistent writer (ChampionshipPersistentSavePort's
// createChampionshipDataArenaPort). It never reads, writes, migrates or clears
// the Championship save or the preference key, and nothing it stores feeds the
// Championship economy: arena results are records (best score, wins), not
// currency or items, so replaying the arena cannot farm progress.

import { DATA_ARENA_PARTNERS, DATA_ARENA_VERSION } from "./dataArenaConfig.js";

export const DATA_ARENA_RECORD_SCHEMA = DATA_ARENA_VERSION;
const QUALITY = new Set(["auto", "high", "low"]);
const MODES = ["TOURNAMENT", "HARBOR"];
const PARTNER_IDS = new Set(DATA_ARENA_PARTNERS.map((partner) => partner.id));
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1e9) : 0);

export function defaultDataArenaRecords() {
  return {
    schemaVersion: 1, kind: "DATA_ARENA_RECORDS", runs: 0, wins: 0, bestScore: 0, bestVictorySeconds: null,
    lastPartnerId: DATA_ARENA_PARTNERS[0].id, lastMode: "TOURNAMENT", partners: {}, modes: {}, settings: { shake: true, quality: "auto" }, briefingSeen: false
  };
}

/** Accept only the known shape; anything else falls back to defaults field by field. */
export function sanitizeDataArenaRecords(raw) {
  const base = defaultDataArenaRecords();
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== 1 || raw.kind !== "DATA_ARENA_RECORDS") return base;
  const partners = {};
  for (const id of PARTNER_IDS) {
    const entry = raw.partners?.[id];
    if (entry && typeof entry === "object") partners[id] = { runs: count(entry.runs), wins: count(entry.wins), bestScore: count(entry.bestScore) };
  }
  const modes = {};
  for (const id of MODES) {
    const entry = raw.modes?.[id];
    if (entry && typeof entry === "object") modes[id] = { runs: count(entry.runs), wins: Math.min(count(entry.wins), count(entry.runs)), bestScore: count(entry.bestScore), bestRound: Math.min(count(entry.bestRound), 9) };
  }
  const best = raw.bestVictorySeconds;
  return {
    ...base,
    runs: count(raw.runs), wins: Math.min(count(raw.wins), count(raw.runs)), bestScore: count(raw.bestScore),
    bestVictorySeconds: Number.isFinite(best) && best > 0 && best < 3600 ? best : null,
    lastPartnerId: PARTNER_IDS.has(raw.lastPartnerId) ? raw.lastPartnerId : base.lastPartnerId,
    partners, modes, lastMode: MODES.includes(raw.lastMode) ? raw.lastMode : base.lastMode,
    settings: { shake: raw.settings?.shake !== false, quality: QUALITY.has(raw.settings?.quality) ? raw.settings.quality : "auto" },
    briefingSeen: raw.briefingSeen === true
  };
}

/** `port` is { storageKey, read() -> {text,error}, write(text) -> {ok,error} } or null (records kept for this visit). */
export function createDataArenaRecordStore({ port = null } = {}) {
  let records = defaultDataArenaRecords();
  let persistent = Boolean(port);
  let lastError = null;
  if (port) {
    const { text, error } = port.read();
    if (error) { persistent = false; lastError = "STORAGE_UNAVAILABLE"; }
    else if (text) {
      try { records = sanitizeDataArenaRecords(JSON.parse(text)); }
      catch { lastError = "CORRUPT_RECORD_IGNORED"; }
    }
  }

  function write() {
    if (!port || !persistent) return false;
    const { ok } = port.write(JSON.stringify({ ...records, schema: DATA_ARENA_RECORD_SCHEMA }));
    lastError = ok ? null : "WRITE_FAILED";
    return ok;
  }

  return Object.freeze({
    key: port?.storageKey ?? null,
    get: () => structuredClone(records),
    get persistent() { return persistent; },
    get lastError() { return lastError; },
    setSettings(patch) {
      records.settings = sanitizeDataArenaRecords({ ...records, settings: { ...records.settings, ...patch } }).settings;
      return write();
    },
    markBriefingSeen() { if (!records.briefingSeen) { records.briefingSeen = true; return write(); } return true; },
    setLastPartner(id) { if (PARTNER_IDS.has(id)) { records.lastPartnerId = id; return write(); } return false; },
    setLastMode(mode) { if (MODES.includes(mode)) { records.lastMode = mode; return write(); } return false; },
    /** Record one finished match. Returns whether it set a new best score. */
    recordResult(result) {
      if (!result || !PARTNER_IDS.has(result.partnerId)) return { saved: false, newBest: false };
      const victory = result.outcome === "VICTORY";
      const score = count(Math.round(result.score));
      const newBest = score > records.bestScore;
      records.runs = count(records.runs + 1);
      if (victory) records.wins = count(records.wins + 1);
      records.bestScore = Math.max(records.bestScore, score);
      if (victory && Number.isFinite(result.timeSeconds) && (records.bestVictorySeconds === null || result.timeSeconds < records.bestVictorySeconds)) {
        records.bestVictorySeconds = result.timeSeconds;
      }
      const partner = records.partners[result.partnerId] ?? { runs: 0, wins: 0, bestScore: 0 };
      records.partners[result.partnerId] = { runs: partner.runs + 1, wins: partner.wins + (victory ? 1 : 0), bestScore: Math.max(partner.bestScore, score) };
      records.lastPartnerId = result.partnerId;
      const mode = MODES.includes(result.mode) ? result.mode : "HARBOR";
      const entry = records.modes[mode] ?? { runs: 0, wins: 0, bestScore: 0, bestRound: 0 };
      const reached = result.tournament ? (victory ? result.tournament.rounds : result.tournament.reachedRound) : 0;
      const newModeBest = score > entry.bestScore;
      records.modes[mode] = { runs: entry.runs + 1, wins: entry.wins + (victory ? 1 : 0), bestScore: Math.max(entry.bestScore, score), bestRound: Math.max(entry.bestRound, reached) };
      records.lastMode = mode;
      return { saved: write(), newBest: newModeBest, overallBest: newBest };
    }
  });
}
