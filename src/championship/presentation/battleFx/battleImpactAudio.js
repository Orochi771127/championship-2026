// Remastered Procedural Battle & 666-Move Foley Synthesizer (Web Audio API, 2026-11-22).
//
// Powered by `combatMoveAudioEngine.js` (dual-stage Compressor + Brickwall Limiter +
// High-Shelf EQ + WaveShaper warmth + Stereo Pan + White/Pink/Brown/Crackle noise banks
// + 2-operator FM synthesis + canonical 10-element acoustic timbres).
// Zero ROM samples, zero external audio assets, zero extra AudioContexts: plugs directly
// into the shared product SFX bus (`settings.audio.output('sfx')`).

import { createCombatMoveAudioEngine } from "../combatMoveAudioEngine.js";
import { resolveMoveSpecV2 } from "../../modes/dataArena/dataArenaMoveCatalogV2.js";

function normalizeTurnMoveId(moveId) {
  if (typeof moveId === "number" && Number.isInteger(moveId) && moveId >= 31) return `own-${moveId}`;
  return moveId ?? null;
}

function statusCueFor(status) {
  const s = String(status ?? "").toUpperCase();
  if (/SLEEP|SLP|HYPNO|4/.test(s)) return "sleep";
  if (/FREEZE|FRZ|ROOT|ICE|3/.test(s)) return "freezeSnap";
  if (/PARA|PAR|STUN|SHOCK|2/.test(s)) return "paralyze";
  if (/POISON|PSN|TOX|VENOM|1/.test(s)) return "poison";
  if (/BURN|BRN|FIRE|5/.test(s)) return "burn";
  return "slow";
}

export function createBattleImpactAudio({ getOutput, now = () => Date.now() } = {}) {
  const engine = createCombatMoveAudioEngine({ getOutput, now });

  function playMove({ moveId = null, element = null, archetype = null, ultimate = false, pan = 0 } = {}) {
    const normId = normalizeTurnMoveId(moveId);
    const spec = normId != null ? resolveMoveSpecV2(normId) : null;
    return engine.playMove({
      archetype: archetype ?? spec?.v2Archetype ?? "HOMING_ORB",
      element: element ?? spec?.paletteKey ?? null,
      moveId: normId,
      phase: "release",
      ultimate: Boolean(ultimate),
      pan
    });
  }

  function playHit({ tier = "light", critical = false, combo = 1, element = null, moveId = null, effectiveness = "neutral", guarded = false, pan = 0 } = {}) {
    const normId = normalizeTurnMoveId(moveId);
    return engine.playImpact({
      tier: critical ? "crit" : tier,
      critical: Boolean(critical),
      combo,
      element,
      moveId: normId,
      effectiveness,
      guarded: Boolean(guarded),
      pan
    });
  }

  function playStatus({ status = null, pan = 0 } = {}) {
    return engine.playCue(statusCueFor(status), { pan });
  }

  function playKo({ pan = 0 } = {}) {
    return engine.playCue("ko", { pan });
  }

  function playUltimate({ element = null, moveId = null, pan = 0 } = {}) {
    const normId = normalizeTurnMoveId(moveId);
    const ok = engine.playCue("ultimate", { pan });
    if (ok && (element || normId)) {
      const spec = normId != null ? resolveMoveSpecV2(normId) : null;
      engine.playMove({
        archetype: spec?.v2Archetype ?? "STREAM_BEAM",
        element: element ?? spec?.paletteKey ?? null,
        moveId: normId,
        ultimate: true,
        pan
      });
    }
    return ok;
  }

  function playSupport(kind = "support", { pan = 0 } = {}) {
    const cue = kind === "skillCard" ? "skillCard" : kind === "heal" ? "heal" : "support";
    return engine.playCue(cue, { pan });
  }

  function playDropPick() {
    return engine.playDropPick();
  }

  return Object.freeze({
    playMove,
    playHit,
    playStatus,
    playKo,
    playUltimate,
    playSupport,
    playDropPick,
    getDiagnostics: () => engine.getDiagnostics(),
    dispose: () => engine.dispose()
  });
}
