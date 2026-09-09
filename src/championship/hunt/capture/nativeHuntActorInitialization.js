// OVL0 0210D240 / 0210D5DC and 0211B13C..0211B2F0.
// Functional inputs only; no renderer, private file, clock or RNG authority.

export function initializeNativeHuntAi(rng) {
  const lifetime = (Math.trunc(119 * rng.next(0xb3) / 102) + 10) * 60;
  // The first B2 selects +.5 versus -.5; the second selects the heading.
  // When the first draw is zero and the second positive, truncation after
  // subtracting .5 produces one Q12 unit less. Keep this rare native branch.
  const positive = Math.trunc(359 * rng.next(0xb2) / 102) > 0;
  const heading = Math.trunc(Math.trunc(359 * rng.next(0xb2) / 102) * 4096 + (positive ? 0.5 : -0.5)) || 0;
  return { state:0, field054:-1, field1d8:lifetime, field1e0:heading, followFlag:0, followTarget:0 };
}

export function nativeHuntInitialSpeed({ movementBase, aiSelectors }, trait) {
  if (!Number.isFinite(movementBase) || !Array.isArray(aiSelectors) || aiSelectors.length !== 2
      || !Number.isInteger(trait)) throw new Error("NATIVE_HUNT_SPEED_INPUT_REQUIRED");
  const factor = trait === aiSelectors[0] ? Math.fround(1.43) : trait === aiSelectors[1] ? 2 : 1;
  // 0202AD44 promotes the stored float32 to double. Native literals encode
  // double .3, float32(1.43) promoted to double, 4096, then away-from-zero .5.
  const value = (Math.fround(movementBase) - 0.3) * factor * 4096;
  return Math.trunc(value + (value > 0 ? 0.5 : -0.5));
}

export function groupNativeHuntActors(actors, { rng, readTerrain, firstIndex = 0 }) {
  if (!Array.isArray(actors) || typeof readTerrain !== "function"
      || !Number.isInteger(firstIndex) || firstIndex < 0 || firstIndex > actors.length
      || typeof rng?.next !== "function" || actors.some(a => !Number.isInteger(a?.speciesIndex) || a.speciesIndex < 0 || a.speciesIndex > 227
        || !Array.isArray(a.positionQ12) || a.positionQ12.length !== 3
        || a.positionQ12.some(n => !Number.isInteger(n) || n < -0x80000000 || n > 0x7fffffff))) throw new Error("NATIVE_HUNT_GROUP_INPUT_REQUIRED");
  // Work on owned copies. Later pairs use positions already changed by earlier
  // pairs, and any number of pairs may reposition the same second actor.
  const next = actors.map(a => ({ ...a, positionQ12:[...a.positionQ12] }));
  for (let i = firstIndex; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      if (next[i].speciesIndex !== next[j].speciesIndex) continue;
      if (rng.next(0xb2) % 100 >= 30) continue;
      for (let attempt = 0; attempt < 64; attempt++) {
        const dx = rng.next(0xb3) % 32, dy = rng.next(0xb3) % 32;
        const x = (next[i].positionQ12[0] >> 12) + dx * (rng.next(0xb3) % 2 === 0 ? 1 : -1);
        const y = (next[i].positionQ12[1] >> 12) + dy * (rng.next(0xb3) % 2 === 0 ? 1 : -1);
        if (readTerrain(Math.trunc(x / 8) || 0, Math.trunc(y / 8) || 0) === 1) continue;
        next[j].positionQ12 = [x * 4096, y * 4096, 0];
        break;
      }
    }
  }
  return next;
}
