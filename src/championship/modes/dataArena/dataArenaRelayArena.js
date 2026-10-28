// RELAY stage three (OWNER_APPROVED_ADAPTATION 2026-10-28, ARENA_RELAY_KITS_20261028):
// destructible cover and timed arena zones on the eleven relay fields.
//
// Pure rules on the fixed step: no DOM, no Pixi, no clock, no Math.random.
// Cover and zones are game data laid over the existing field grids; they are
// never inferred from illustration pixels. Original layouts and numbers.
import { DATA_ARENA_TERRAIN as T } from './dataArenaConfig.js';

// Material per field: hit points, the elements that break it faster, and
// whether fire catches it. Weak hits deal 1.4x to cover only.
export const RELAY_COVER_MATERIALS = Object.freeze({
  STONE: Object.freeze({ hp: 150, weak: Object.freeze(['earth', 'water', 'physical']), combustible: false }),
  WOOD: Object.freeze({ hp: 110, weak: Object.freeze(['fire', 'storm']), combustible: true }),
  BASALT: Object.freeze({ hp: 180, weak: Object.freeze(['water', 'earth', 'physical']), combustible: false }),
  CORAL: Object.freeze({ hp: 130, weak: Object.freeze(['earth', 'nature', 'physical']), combustible: false }),
  ICE: Object.freeze({ hp: 100, weak: Object.freeze(['fire', 'physical', 'earth']), combustible: false }),
  SANDSTONE: Object.freeze({ hp: 130, weak: Object.freeze(['water', 'nature', 'physical']), combustible: false }),
  CRYSTAL: Object.freeze({ hp: 140, weak: Object.freeze(['storm', 'shadow', 'light']), combustible: false }),
  METAL: Object.freeze({ hp: 170, weak: Object.freeze(['earth', 'fire', 'physical']), combustible: false })
});
export const RELAY_COVER_WEAKNESS = 1.4;

// Landscape cell rectangles [col, row, width, height] between the two spawns
// (player 32,19 / rival 19,19), symmetric about the lane's centre.
export const RELAY_COVER_LAYOUTS = Object.freeze({
  pair: [[24, 14, 2, 3], [26, 22, 2, 3]],
  gate: [[25, 13, 2, 3], [25, 23, 2, 3]],
  quad: [[20, 13, 2, 2], [30, 13, 2, 2], [20, 24, 2, 2], [30, 24, 2, 2]],
  stagger: [[23, 14, 2, 2], [27, 23, 2, 2]]
});

// Field -> cover material, layout and arena event theme.
export const RELAY_FIELD_THEMES = Object.freeze({
  field_bm01_01: Object.freeze({ material: 'STONE', layout: 'quad', event: 'ECHO' }),
  field_bm02_01: Object.freeze({ material: 'WOOD', layout: 'pair', event: 'BLOOM' }),
  field_bm03_01: Object.freeze({ material: 'BASALT', layout: 'stagger', event: 'VENT' }),
  field_bm04_01: Object.freeze({ material: 'CORAL', layout: 'pair', event: 'TIDE' }),
  field_bm05_01: Object.freeze({ material: 'ICE', layout: 'gate', event: 'UPDRAFT' }),
  field_bm06_01: Object.freeze({ material: 'SANDSTONE', layout: 'gate', event: 'RECHARGE' }),
  field_bm07_01: Object.freeze({ material: 'CRYSTAL', layout: 'quad', event: 'RECHARGE' }),
  field_bm08_01: Object.freeze({ material: 'STONE', layout: 'quad', event: 'ECHO' }),
  field_bm09_01: Object.freeze({ material: 'STONE', layout: 'pair', event: 'BLOOM' }),
  field_bm10_01: Object.freeze({ material: 'METAL', layout: 'stagger', event: 'UPDRAFT' }),
  field_bm11_01: Object.freeze({ material: 'METAL', layout: 'gate', event: 'ECHO' })
});

export const RELAY_ARENA_RULES = Object.freeze({ firstWarning: 8, warningSeconds: 2.5, activeSeconds: 6, intervalSeconds: 22, claimSeconds: 0.7,
  healShare: 0.06, tpGain: 20, cooldownCut: 2, speedScale: 1.15, coverPressure: 0.25, zoneRadius: 68, aiReach: 420 });
// Contested zones above and below the centre lane (landscape cells).
const ZONE_TARGETS = Object.freeze([[25, 10], [26, 28]]);

const dryKinds = new Set([T.GROUND, T.SHALLOW]);
/**
 * Validated cover blocks and zone cells for one field, in landscape cells.
 * `cells[r][c]` is the field's terrain kind, `ice` marks natural-ice cells.
 * A block is dropped when it touches non-walkable ground, sits within three
 * cells of a spawn, or would cut the two spawns apart.
 */
export function relayFieldLayout(fieldId, cells, ice, playerSpawn, rivalSpawn) {
  const theme = RELAY_FIELD_THEMES[fieldId];
  if (!theme) return { cover: [], zones: [], theme: null };
  const rows = cells.length, cols = cells[0].length;
  const dry = (c, r) => r >= 0 && r < rows && c >= 0 && c < cols && (dryKinds.has(cells[r][c]) || ice.has(`${c},${r}`));
  const blocked = new Set();
  const connected = () => {
    const key = (c, r) => `${c},${r}`, seen = new Set([key(...playerSpawn)]), queue = [playerSpawn];
    for (let i = 0; i < queue.length; i++) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = [queue[i][0] + dc, queue[i][1] + dr], k = key(...p);
      if (!seen.has(k) && dry(...p) && !blocked.has(k)) { seen.add(k); queue.push(p); }
    }
    return seen.has(key(...rivalSpawn));
  };
  const cover = [];
  for (const [c, r, w, h] of RELAY_COVER_LAYOUTS[theme.layout]) {
    const own = [];
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) own.push([x, y]);
    const near = own.some(([x, y]) => [playerSpawn, rivalSpawn].some(([sx, sy]) => Math.max(Math.abs(x - sx), Math.abs(y - sy)) <= 3));
    if (near || !own.every(([x, y]) => dry(x, y))) continue;
    for (const [x, y] of own) blocked.add(`${x},${y}`);
    if (connected()) cover.push([c, r, w, h]);
    else for (const [x, y] of own) blocked.delete(`${x},${y}`);
  }
  // Each zone sits on the nearest walkable, uncovered cell to its target.
  const zones = ZONE_TARGETS.map(([tc, tr]) => {
    let best = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!dry(c, r) || blocked.has(`${c},${r}`)) continue;
      const d = Math.hypot(c - tc, r - tr);
      if (!best || d < best.d) best = { c, r, d };
    }
    return [best.c, best.r];
  });
  return { cover, zones, theme };
}

/**
 * Timed arena zones for one relay match. `bodies()` returns the active
 * [player, rival] bodies; effects call back into the simulation so HP, TP,
 * cooldowns and dashes keep their single owner.
 */
export function createRelayArenaEvents({ map, grid, emit, now, bodies, effects }) {
  const theme = RELAY_FIELD_THEMES[map.battleFieldId] ?? null;
  const R = RELAY_ARENA_RULES;
  const zones = (map.arenaZones ?? []).map(([c, r], id) => ({ id, x: (c + 0.5) * map.cell, y: (r + 0.5) * map.cell, radius: R.zoneRadius }));
  const state = { kind: theme?.event ?? null, phase: 'DORMANT', remaining: R.firstWarning, cycle: -1, claimed: [false, false], channel: [0, 0], zones };
  let phaseKey = '', pressured = -1;
  const zoneAt = (body) => zones.find(z => Math.hypot(body.x - z.x, body.y - z.y) <= z.radius) ?? null;
  const live = (body) => body && body.hp > 0;
  function useful(body, team) {
    switch (state.kind) {
      case 'ECHO': return Object.values(body.cooldowns ?? {}).some(t => t > 0.1);
      case 'BLOOM': return body.hp < body.maxHp;
      case 'VENT': return effects.dashMissing(body, team) || body.energy < effects.tpMax;
      case 'TIDE': return body.burn > 0 || body.slow > 0 || body.root > 0;
      case 'RECHARGE': return body.energy < effects.tpMax;
      default: return false; // UPDRAFT has no claim: it speeds whoever stands inside.
    }
  }
  function claim(body, team, zone) {
    const amount = state.kind === 'BLOOM' ? Math.max(1, Math.round(body.maxHp * R.healShare)) : state.kind === 'RECHARGE' ? R.tpGain
      : state.kind === 'VENT' ? Math.round(R.tpGain * 0.75) : state.kind === 'ECHO' ? R.cooldownCut : 0;
    if (state.kind === 'ECHO') for (const id in body.cooldowns) body.cooldowns[id] = Math.max(0, body.cooldowns[id] - R.cooldownCut);
    if (state.kind === 'BLOOM') effects.heal(body, team, amount);
    if (state.kind === 'RECHARGE' || state.kind === 'VENT') body.energy = Math.min(effects.tpMax, body.energy + amount);
    if (state.kind === 'VENT') effects.refillDash(body, team);
    if (state.kind === 'TIDE') { body.burn = 0; body.slow = 0; body.slowTimer = 0; body.root = 0; }
    emit({ type: 'ARENA_CLAIM', kind: state.kind, team, x: zone.x, y: zone.y, amount });
  }
  function pressure() {
    // Thermal vents crack every standing cover block once per active phase.
    const events = [];
    for (const prop of grid.props) if (!prop.destroyed) grid.damageProp(prop, prop.maxHp * R.coverPressure, events, 'PRESSURE');
    for (const event of events) emit({ ...event, t: now() });
    emit({ type: 'ARENA_PRESSURE', kind: state.kind });
  }
  function step(dt, roundTime) {
    if (!state.kind || !zones.length) return;
    if (roundTime < R.firstWarning) { state.phase = 'DORMANT'; state.remaining = R.firstWarning - roundTime; return; }
    const cycle = Math.floor((roundTime - R.firstWarning) / R.intervalSeconds), into = roundTime - R.firstWarning - cycle * R.intervalSeconds;
    if (cycle !== state.cycle) { state.cycle = cycle; state.claimed = [false, false]; state.channel = [0, 0]; }
    state.phase = into < R.warningSeconds ? 'WARNING' : into < R.warningSeconds + R.activeSeconds ? 'ACTIVE' : 'DORMANT';
    state.remaining = state.phase === 'WARNING' ? R.warningSeconds - into : state.phase === 'ACTIVE' ? R.warningSeconds + R.activeSeconds - into : R.intervalSeconds - into;
    const key = `${cycle}:${state.phase}`;
    if (key !== phaseKey) {
      phaseKey = key;
      if (state.phase === 'WARNING') emit({ type: 'ARENA_WARNING', kind: state.kind, zones: zones.map(z => ({ x: z.x, y: z.y, radius: z.radius })) });
      if (state.phase === 'ACTIVE') emit({ type: 'ARENA_ACTIVE', kind: state.kind });
    }
    if (state.phase !== 'ACTIVE') { state.channel = [0, 0]; return; }
    if (state.kind === 'VENT' && pressured !== cycle) { pressured = cycle; pressure(); }
    bodies().forEach((body, team) => {
      const zone = live(body) ? zoneAt(body) : null;
      if (!state.claimed[team] && zone && state.kind !== 'UPDRAFT' && useful(body, team)) {
        state.channel[team] = Math.min(R.claimSeconds, state.channel[team] + dt);
        if (state.channel[team] + 1e-8 >= R.claimSeconds) { state.claimed[team] = true; state.channel[team] = 0; claim(body, team, zone); }
      } else state.channel[team] = 0;
    });
  }
  return Object.freeze({
    state, step,
    /** Movement multiplier: updraft zones speed whoever stands inside while active. */
    speedScale(body) { return state.kind === 'UPDRAFT' && state.phase === 'ACTIVE' && live(body) && zoneAt(body) ? R.speedScale : 1; },
    /** A zone worth walking to for the rival (team 1), or null. */
    rivalTarget(body) {
      if (state.phase !== 'ACTIVE' || state.remaining < 1 || state.claimed[1] || !live(body) || (state.kind !== 'UPDRAFT' && !useful(body, 1))) return null;
      const zone = [...zones].sort((a, b) => Math.hypot(body.x - a.x, body.y - a.y) - Math.hypot(body.x - b.x, body.y - b.y))[0];
      return zone && Math.hypot(body.x - zone.x, body.y - zone.y) <= R.aiReach ? { x: zone.x, y: zone.y } : null;
    }
  });
}
