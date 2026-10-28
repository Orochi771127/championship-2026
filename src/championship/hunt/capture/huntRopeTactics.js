// Rope roles, item combos and rope overheat for Normal Hunt.
//
// OWNER_APPROVED_ADAPTATION 2026-10-28 (docs/coordination/OWNER_DIRECTION.md,
// MOVE_VFX_THEMES_HUNT_ROPE_TACTICS_20261028). The Owner found the top rope made
// every other tool pointless: one 究極繩 γ caught everything. The native rope
// writer (wildCaptureFlow.stepNativeRope, nativeHuntToolRules) is untouched;
// this module adjusts its inputs and outputs per rope role:
//
//   SWIFT    捕捉繩 α/β/γ  light and quick: +30 % pull damage, a 30 % faster
//            lasso cinch and wider catch margin; reaches 成長期 too.
//   TOUGH    強力繩 α/β/γ  terrain-proof: half the wear from trees and rocks
//            (blocked pulls, or the rope line crossing blocked ground); a loop
//            that holds two or more partners never snaps; reaches 成熟期 too.
//   CLONE    克隆繩 α/β/γ  data imprint: a catch earns a doubled hunt bonus,
//            but an awake, struggling partner leaves it only 35 % tolerance.
//   ULTIMATE 究極繩 α/β/γ  the only rope for 完全體 / 究極體. It throws off
//            幼年期 / 成長期 (too much force), and wild 完全體 / 究極體 start in a
//            rage guard that doubles its wear until shots, meat, a trap or
//            sleep break the guard.
//
// Combo: lure (meat) -> disable (trap / sleep / stun) -> rope capture is a
// PERFECT chain; one of the two before the rope is GOOD. A rope that breaks
// overheats for this hunt only; ownership (持有 1/1) never changes.
// Nothing here is saved except the bonus bits the Home commit credits.

export const HUNT_ROPE_ROLES = Object.freeze(['SWIFT', 'TOUGH', 'CLONE', 'ULTIMATE']);
export const HUNT_ROPE_TACTICS = Object.freeze({
  swiftDamageScale: 1.3,
  swiftCinchTicks: 14,            // native cinch is 18 ticks
  swiftCatchMargin: 21,           // px, native lasso margin is 16
  toughTerrainWearScale: 0.5,
  terrainCrossWear: 1,            // per pull tick while the rope line crosses blocked ground
  cloneAwakeTolerance: 0.35,
  ultimateRepelMaxGeneration: 3,  // 幼年期 I / II, 成長期
  rageMinGeneration: 5,           // 完全體, 究極體
  rageWearScale: 2,
  guardMax: 100,
  guardHit: Object.freeze({ shot: 25, rapidShot: 34, meat: 50, trap: 60, sleep: 50, stun: 50, blast: 40 }),
  pacifiedWindowTicks: 120,       // a partner disabled within 2 s of the bind counts as pacified
  overheatTicks: 900,             // 15 s of hunt time at the native 60 Hz
  comboBitsPerGeneration: Object.freeze({ PERFECT: 150, GOOD: 50 }),
  imprintScale: 2
});
// Generation rows a role adds beyond the ROM table (coefficient columns as the
// native rows, the hardest tier). ROM rows that already exist are never replaced.
const EXTRA_ROWS = Object.freeze({ SWIFT: Object.freeze({ 3: [80, 130, 250] }), TOUGH: Object.freeze({ 4: [80, 130, 250] }),
  CLONE: Object.freeze({}), ULTIMATE: Object.freeze({ 6: [80, 130, 250] }) });
const RAPID_SHOTS = new Set([2, 3]);
const Q12 = 4096;

/** 0..11 native rope index -> role (three tiers per role, shop order). */
export function huntRopeRole(nativeItemIndex) {
  return HUNT_ROPE_ROLES[Math.floor(nativeItemIndex / 3)] ?? null;
}

/** The ROM coefficient for this rope and partner, or the role's added row. */
export function huntRopeCoefficient(ropeRow, species) {
  const role = huntRopeRole(ropeRow.itemIndex);
  const column = Math.max((species.effectiveness?.[0] ?? 1) - 1, 0);
  const native = ropeRow.coefficients[species.generation - 1]?.[column] ?? 0;
  if (native > 0) return native;
  return EXTRA_ROWS[role]?.[species.generation]?.[column] ?? 0;
}

/** Can this rope bind this partner at all? ULTIMATE throws off the small ones. */
export function huntRopeBindRule(nativeItemIndex, generation) {
  const role = huntRopeRole(nativeItemIndex);
  if (role === 'ULTIMATE' && generation <= HUNT_ROPE_TACTICS.ultimateRepelMaxGeneration) return 'REPEL';
  return 'BIND';
}

/**
 * Role adjustments to freshly built native rope parameters.
 * `native` is nativeRopeParameters' result; `coefficient` the value above.
 */
export function huntTacticalRope(native, { nativeItemIndex, generation, maxHp, coefficient, pacified, rage }) {
  const role = huntRopeRole(nativeItemIndex);
  let { damageQ12, durability, maxDurability, baseDurability } = native;
  if (damageQ12 === 0 && coefficient > 0) damageQ12 = Math.floor(maxHp * Q12 / (coefficient * (generation === 1 ? 3 : 6)) + 0.5);
  if (role === 'SWIFT') damageQ12 = Math.round(damageQ12 * HUNT_ROPE_TACTICS.swiftDamageScale);
  if (role === 'CLONE' && !pacified) {
    const scaled = n => Math.max(60, Math.trunc(n * HUNT_ROPE_TACTICS.cloneAwakeTolerance));
    durability = scaled(durability); maxDurability = scaled(maxDurability); baseDurability = scaled(baseDurability);
  }
  return Object.freeze({ ...native, damageQ12, durability, maxDurability, baseDurability, role,
    rage: role === 'ULTIMATE' && Boolean(rage), fragile: role === 'CLONE' && !pacified, wearCarry: 0 });
}

/**
 * Re-weigh one native pull tick's wear. `previous` and `next` are the rope
 * before and after stepNativeRopeController; the native writer decided bands,
 * damage and events, this only scales the durability it removed.
 */
export function huntRopeWear(previous, next, { movementBlocked = false, terrainCrossed = false, overstretched = false, groupHold = false } = {}) {
  if (overstretched) return next;
  const role = previous.role;
  const nativeLoss = previous.durability - next.durability;
  const pulling = next.band !== 'SLACK';
  const crossWear = pulling && terrainCrossed ? HUNT_ROPE_TACTICS.terrainCrossWear : 0;
  if (nativeLoss <= 0 && crossWear === 0) return next.band === 'BROKEN' ? next : Object.freeze({ ...next, wearCarry: previous.wearCarry ?? 0 });
  // Terrain part: the native extra point for a blocked strong pull, plus the crossing.
  const blockedPart = movementBlocked && next.band === 'STRONG' ? 1 : 0;
  const terrain = Math.min(Math.max(nativeLoss, 0), blockedPart) + crossWear;
  const plain = Math.max(nativeLoss, 0) - Math.min(Math.max(nativeLoss, 0), blockedPart);
  let loss = plain + terrain * (role === 'TOUGH' ? HUNT_ROPE_TACTICS.toughTerrainWearScale : 1);
  if (previous.rage) loss *= HUNT_ROPE_TACTICS.rageWearScale;
  loss += previous.wearCarry ?? 0;
  const whole = Math.floor(loss);
  let durability = previous.durability - whole;
  let band = next.band, controllerState = next.controllerState;
  if (durability <= 0 && role === 'TOUGH' && groupHold) { durability = 1; if (band === 'BROKEN') { band = 'STRONG'; controllerState = 5; } }
  else if (durability <= 0) { durability = 0; band = 'BROKEN'; controllerState = 6; }
  else if (band === 'BROKEN') { band = 'STRONG'; controllerState = 5; }
  // A tick kept from breaking takes the strong band's cap, as the controller would.
  const maxDurability = controllerState === 5 && next.controllerState === 6 ? 2 * Math.trunc(previous.baseDurability / 5) : next.maxDurability;
  return Object.freeze({ ...next, durability, band, controllerState, maxDurability, wearCarry: loss - whole });
}

/** Does the segment a->b (Q12 world points) cross blocked terrain? */
export function huntRopeCrossesBlocked(a, b, isBlockedPixel) {
  if (typeof isBlockedPixel !== 'function') return false;
  const ax = a[0] / Q12, ay = a[1] / Q12, bx = b[0] / Q12, by = b[1] / Q12;
  const steps = Math.min(24, Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 8)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isBlockedPixel(ax + (bx - ax) * t, ay + (by - ay) * t)) return true;
  }
  return false;
}

/**
 * Per-hunt memory: guard, lure / disable chain, overheat. Watches actor states
 * once per native step; never writes an actor.
 */
export function createHuntRopeTactics({ generationOf }) {
  if (typeof generationOf !== 'function') throw Error('HUNT_ROPE_TACTICS_GENERATION_REQUIRED');
  const memory = new Map();
  const overheat = new Map();
  let frame = 0;
  const entry = actor => {
    let row = memory.get(actor.wildId);
    if (!row) {
      const generation = generationOf(actor.speciesIndex);
      row = { generation, guard: generation >= HUNT_ROPE_TACTICS.rageMinGeneration ? HUNT_ROPE_TACTICS.guardMax : 0,
        lured: false, disabled: false, lastPacified: -Infinity, lastAi: actor.aiState, lastHp: actor.currentHp,
        ropeDowned: false, ropeRole: null, combo: null, groupSerial: 0 };
      memory.set(actor.wildId, row);
    }
    return row;
  };
  const hitGuard = (row, amount) => { if (row.guard > 0) { row.guard = Math.max(0, row.guard - amount); return row.guard === 0; } return false; };
  return Object.freeze({
    /** Call after each native actor step. Returns events (guard breaks). */
    observe(actors, { shotItemIndex = null } = {}) {
      frame++;
      const events = [];
      for (const actor of actors) {
        if (!actor.actorActive) continue;
        const row = entry(actor), ai = actor.aiState, entered = ai !== row.lastAi;
        const G = HUNT_ROPE_TACTICS.guardHit;
        let broke = false;
        if (ai === 5 || actor.foodTarget?.active && actor.seekingFood) row.lured = true;
        if ([4, 5, 16, 17, 19].includes(ai) || actor.trapReady) row.lastPacified = frame;
        if (entered) {
          if (ai === 9) broke = hitGuard(row, RAPID_SHOTS.has(shotItemIndex) ? G.rapidShot : G.shot) || broke;
          if (ai === 5) broke = hitGuard(row, G.meat) || broke;
          if (ai === 16) { row.disabled = true; broke = hitGuard(row, G.trap) || broke; }
          if (ai === 4) { row.disabled = true; broke = hitGuard(row, G.sleep) || broke; }
          if (ai === 17) { row.disabled = true; broke = hitGuard(row, G.stun) || broke; }
        }
        // Lost HP outside a rope pull: a bomb, a mine or a damage wire.
        if (actor.currentHp < row.lastHp) broke = hitGuard(row, G.blast) || broke;
        if (broke) events.push({ kind: 'GUARD_BROKEN', wildId: actor.wildId });
        row.lastAi = ai; row.lastHp = actor.currentHp;
      }
      return events;
    },
    generation: actor => entry(actor).generation,
    guard: actor => entry(actor).guard,
    rage: actor => entry(actor).guard > 0,
    pacified: actor => frame - entry(actor).lastPacified <= HUNT_ROPE_TACTICS.pacifiedWindowTicks,
    /** Rope damage is not a blast: record the HP a pull left. */
    syncHp(actor) { entry(actor).lastHp = actor.currentHp; },
    markGroup(actor, serial) { entry(actor).groupSerial = serial; },
    groupHold(actor, actors) {
      const serial = entry(actor).groupSerial;
      return serial > 0 && actors.some(other => other !== actor && other.bound && !other.cardState && memory.get(other.wildId)?.groupSerial === serial);
    },
    /** A rope pull took this partner to zero HP. */
    ropeDowned(actor, role) { const row = entry(actor); row.ropeDowned = true; row.ropeRole = role; },
    /** The chain rank once the partner is on the card (cached). */
    settle(actor) {
      const row = entry(actor);
      if (row.combo) return row.combo;
      const rank = row.ropeDowned && row.lured && row.disabled ? 'PERFECT' : row.ropeDowned && (row.lured || row.disabled) ? 'GOOD' : null;
      const imprint = row.ropeDowned && row.ropeRole === 'CLONE';
      const base = rank ? HUNT_ROPE_TACTICS.comboBitsPerGeneration[rank] * Math.max(1, row.generation) : 0;
      row.combo = Object.freeze({ rank, imprint, bits: base * (imprint ? HUNT_ROPE_TACTICS.imprintScale : 1) + (imprint && !rank ? 40 * Math.max(1, row.generation) : 0) });
      return row.combo;
    },
    combo: actor => memory.get(actor.wildId)?.combo ?? null,
    overheat(itemId) { overheat.set(itemId, frame + HUNT_ROPE_TACTICS.overheatTicks); },
    overheatTicks: itemId => Math.max(0, (overheat.get(itemId) ?? 0) - frame),
    frame: () => frame
  });
}
