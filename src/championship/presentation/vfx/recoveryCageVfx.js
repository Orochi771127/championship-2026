// Passive infirmary feedback observed in video2.MOV (2026-09-12): a short,
// compact cyan/green starburst appears on the resident when HP rises. The
// existing traced Raising writer remains authoritative for the HP change.
// This module never heals, schedules, or invents a cage-effect magnitude.

import { CAGE_TRAINING_CHANNELS, getCageTraining } from "../../cage/cageEffects.js";

const freeze = Object.freeze;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const RECOVERY_CAGE_VFX_DURATION_MS = 420;
export const RECOVERY_CAGE_VFX_EVIDENCE = "VIDEO_OBSERVED_ON_VERIFIED_HP_WRITE";
export const RECOVERY_CAGE_VFX_ART = "ORIGINAL_CREATED_VECTOR";

export function isRecoveryCageDefinition(cageDefinitionIndex) {
  if (!Number.isInteger(cageDefinitionIndex)) return false;
  return getCageTraining(cageDefinitionIndex)?.channels.some(
    (channel) => channel.id === CAGE_TRAINING_CHANNELS.RECOVER_HP_STRESS
  ) === true;
}

export function shouldStartRecoveryCageVfx(previous, current) {
  return Number.isFinite(previous?.currentHp)
    && Number.isFinite(current?.currentHp)
    && current.currentHp > previous.currentHp
    && isRecoveryCageDefinition(current.cageDefinitionIndex);
}

export function recoveryCageVfxFrame(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= RECOVERY_CAGE_VFX_DURATION_MS) {
    return freeze({ visible: false, progress: 1, alpha: 0, scale: 0 });
  }
  const progress = clamp01(elapsedMs / RECOVERY_CAGE_VFX_DURATION_MS);
  const attack = clamp01(progress / 0.24);
  const release = clamp01((1 - progress) / 0.5);
  return freeze({
    visible: true,
    progress,
    alpha: Math.min(1, attack * 1.45) * release,
    scale: 0.38 + Math.sin(Math.min(1, progress / 0.72) * Math.PI / 2) * 0.78,
    haloScale: 0.62 + progress * 0.92,
    rayRotation: progress * Math.PI * 0.42
  });
}
