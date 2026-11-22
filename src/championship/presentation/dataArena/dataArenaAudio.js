// Data Arena -- Remastered Broadcast-Mastered Procedural 666-Move & Combat SFX Engine (2026-11-22).
//
// Powered by `combatMoveAudioEngine.js` (dual-stage Compressor + Brickwall Limiter +
// High-Shelf ear-fatigue EQ + WaveShaper warmth + Stereo Pan + White/Pink/Brown/Crackle
// noise banks + true 2-operator FM synthesis + Sqrt concurrent-voice auto-ducking).
// Zero external audio files; routes through settings.audio's shared "sfx" category.

import { createCombatMoveAudioEngine } from "../combatMoveAudioEngine.js";

const NOOP_AUDIO = Object.freeze({
  play() {},
  playWindup() {},
  playMove() {},
  playImpact() {},
  setLaser() {},
  suspend() {},
  getDiagnostics() {
    return { available: false, voices: 0, played: 0, movesPlayed: 0, impactsPlayed: 0, windupsPlayed: 0 };
  },
  dispose() {},
  available: false
});

export function createDataArenaAudio({ bus } = {}) {
  const output = bus?.output?.("sfx") ?? null;
  if (!output) return NOOP_AUDIO;
  return createCombatMoveAudioEngine({ getOutput: () => output });
}
