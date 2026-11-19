import { factionResonance, speciesTaxonomyForId } from "../contracts/speciesTaxonomy.js";
import { uiText } from "../text/uiText.js";

/**
 * Computes strictly telemetry-backed post-battle diagnosis lines from the
 * settled match record. Every item corresponds to an observed metric from this
 * battle (never fabricated causes).
 *
 * @param {object} input
 * @param {object|null} input.outcome
 * @param {object|null} [input.tacticRecord]  raw record from battleRuntime.getTacticRecord()
 * @param {object|null} [input.summary]       presentation damage/KO tally
 * @param {Array<object>} [input.participants] battle participants (team 0 = player)
 * @param {(id: string) => object|null} [input.syncOf]
 * @param {object|null} [input.skillCardState] { hand: string[], playedIds: string[] }
 * @returns {{ title: string, items: Array<{ kind: string, text: string }>, won: boolean } | null}
 */
export function buildBattleResultDiagnosis({
  outcome = null,
  tacticRecord = null,
  summary = null,
  participants = [],
  syncOf = null,
  skillCardState = null
} = {}) {
  if (!outcome || typeof outcome !== "object") return null;
  const won = outcome.winningTeam === 0;
  const playerTeam = Array.isArray(participants)
    ? participants.filter((p) => p && (p.team === 0 || p.side === "player"))
    : [];
  const factions = playerTeam.map((p) => speciesTaxonomyForId(p.speciesId)?.faction);
  const activeResonances = factionResonance(factions);
  const hasResonance = activeResonances.length > 0;
  const items = [];

  if (won) {
    if (hasResonance) {
      items.push({ kind: "resonance", text: uiText("DIAG_WIN_RESONANCE") });
    }
    const playerRows = (summary?.rows ?? []).filter((row) => row.side === "player" && row.damage > 0);
    if (playerRows.length) {
      const mvp = [...playerRows].sort((a, b) => b.damage - a.damage)[0];
      items.push({
        kind: "mvp",
        text: uiText("DIAG_WIN_MVP", { name: mvp.name, dmg: Number(mvp.damage).toLocaleString("en-US") })
      });
    }
    const playedCount = Array.isArray(skillCardState?.playedIds) ? skillCardState.playedIds.length : 0;
    if (playedCount > 0) {
      items.push({ kind: "cards", text: uiText("DIAG_WIN_CARDS", { n: playedCount }) });
    }
    return items.length ? Object.freeze({ title: uiText("DIAG_WIN_TITLE"), items: Object.freeze(items), won: true }) : null;
  }

  // Defeat or draw: surface up to 3 concrete, observed levers the player can change next match.
  const locals = Array.isArray(tacticRecord?.local) ? tacticRecord.local : [];

  const tpDry = locals
    .filter((entry) => Number.isFinite(entry.spEmptySeconds) && entry.spEmptySeconds >= 4)
    .sort((a, b) => b.spEmptySeconds - a.spEmptySeconds)[0];
  if (tpDry) {
    items.push({
      kind: "tp-dry",
      text: uiText("DIAG_TP_DRY", { name: tpDry.displayName ?? "", sec: Math.round(tpDry.spEmptySeconds) })
    });
  }

  const earlyKo = locals
    .filter((entry) => Number.isFinite(entry.downAt) && entry.downAt > 0 && entry.downAt <= 18)
    .sort((a, b) => a.downAt - b.downAt)[0];
  if (earlyKo) {
    items.push({
      kind: "early-ko",
      text: uiText("DIAG_EARLY_KO", { name: earlyKo.displayName ?? "", sec: Math.max(1, Math.round(earlyKo.downAt)) })
    });
  }

  if (typeof syncOf === "function") {
    const cappedPartner = playerTeam
      .map((p) => ({ partner: p, sync: p.instanceId ? syncOf(p.instanceId) : null }))
      .find((row) => row.sync?.capped);
    if (cappedPartner) {
      items.push({
        kind: "star-capped",
        text: uiText("DIAG_STAR_CAPPED", {
          name: cappedPartner.partner.displayName ?? "",
          star: cappedPartner.sync.star,
          cap: cappedPartner.sync.cap
        })
      });
    }
  }

  if (playerTeam.length >= 2 && !hasResonance) {
    items.push({ kind: "no-resonance", text: uiText("DIAG_NO_RESONANCE") });
  }

  // Close-fight check: if opponent team lost >= 65% of its total max HP (observed from final participants or summary).
  const foeTeam = Array.isArray(participants)
    ? participants.filter((p) => p && (p.team === 1 || p.side === "opponent"))
    : [];
  const foeMaxHp = foeTeam.reduce((sum, p) => sum + (Number.isFinite(p.maxHp) && p.maxHp > 0 ? p.maxHp : 0), 0);
  const foeCurHp = foeTeam.reduce((sum, p) => sum + (Number.isFinite(p.currentHp) && p.currentHp > 0 ? p.currentHp : 0), 0);
  if (foeMaxHp > 0) {
    const dealtRatio = Math.max(0, Math.min(1, (foeMaxHp - foeCurHp) / foeMaxHp));
    if (dealtRatio >= 0.65) {
      items.push({ kind: "close-fight", text: uiText("DIAG_CLOSE_FIGHT", { pct: Math.round(dealtRatio * 100) }) });
    }
  }

  return items.length
    ? Object.freeze({ title: uiText("DIAG_TITLE"), items: Object.freeze(items.slice(0, 3)), won: false })
    : null;
}
