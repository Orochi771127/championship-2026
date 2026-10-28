// Data Arena -- the harbor tile grid and its element rules.
//
// Pure data and rules; no DOM, no Pixi, no clock of its own. The simulation
// steps it with the fixed step and reads the events it returns.
//
// ELEMENT RULES (the contract the tests pin):
//  * FIRE burns only on flammable cells that are not wet and not ash. A burning
//    cell heats its four neighbours every `fireTick`; a neighbour ignites when
//    its heat reaches 1. A cell burns `fireBurnSeconds`, then becomes ash.
//  * WATER (surge, tide bolt) puts a burning cell out and leaves it wet; a wet
//    cell cannot ignite until it dries. Putting fire out is an element chain.
//  * CRYO turns a WATER cell into ICE for a limited time. ICE is walkable. In
//    its last `iceWarnSeconds` it is CRACKING (announced once) and the nav stops
//    routing new paths over it. When it melts, anything standing on it falls
//    into the water (the simulation handles the safe recovery).
//  * An EMBER shot landing on ice takes `emberIceMelt` seconds off it.
//  * THUNDER on conductive water (open WATER or SHALLOW; ice insulates, dry
//    ground never conducts) charges every connected conductive cell within
//    `shockRadius` for `shockSeconds`, owned by the caster's team. Charge is
//    read by whoever owns damage; the grid only holds where and how long.
//    Freezing a charged cell clears its charge.
//  * NATURAL ICE (arena maps with `naturalIce` rects): a permanent sheet over
//    WATER (ice = Infinity, so the existing countdown never touches it). HEAT
//    wears its integrity down; at zero it joins the ordinary CRACKING warning
//    and melt, so walkers on it fall exactly as on melted temporary ice. An
//    opened natural cell refreezes on a timer or at once under COLD.
//  * LAVA (arena maps): walkable and hot. WATER/COLD crusts it into cooled rock
//    for `lavaCoolSeconds`; the last `lavaWarnSeconds` announce the reheat once,
//    then the cell is lava again. Re-cooling resets the timer (no stacking).

import { DATA_ARENA_GRID_RULES, DATA_ARENA_MAP, DATA_ARENA_TERRAIN } from "./dataArenaConfig.js";
import { dataArenaPropSpecs } from "./dataArenaProps.js";

const T = DATA_ARENA_TERRAIN;

export function createDataArenaGrid({ map = DATA_ARENA_MAP, rules = DATA_ARENA_GRID_RULES } = {}) {
  const { cols, rows, cell } = map;
  const count = cols * rows;
  const terrain = new Uint8Array(count);
  const flammable = new Uint8Array(count);
  const fire = new Float32Array(count); // seconds of burn left; 0 = not burning
  const heat = new Float32Array(count);
  const wet = new Float32Array(count);
  const ash = new Float32Array(count);
  const ice = new Float32Array(count); // seconds of ice left on a water cell
  const iceWarned = new Uint8Array(count);
  // Match-scoped appearance is separate from the short anti-reignition timer.
  const scorch = new Uint8Array(count);
  const charge = new Float32Array(count); // seconds of charge left
  const chargeTeam = new Int8Array(count).fill(-1);
  const naturalIce = new Uint8Array(count);
  const iceIntegrity = new Float32Array(count);
  const refreeze = new Float32Array(count); // seconds until an opened natural cell refreezes
  const cooled = new Float32Array(count); // seconds of crust left on a lava cell
  const cooledWarned = new Uint8Array(count);
  const propIndex = new Int16Array(count); propIndex.fill(-1);
  // A monotonically increasing revision of everything navigation reads.
  let navRevision = 1;
  let fireTimer = 0;
  let burningCount = 0;
  let iceCount = 0;
  let chargedCount = 0;
  let chargeWarned = false;
  let naturalCount = 0;
  let refreezeCount = 0;
  let cooledCount = 0;
  let lavaCount = 0;

  const index = (c, r) => r * cols + c;
  const inBounds = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const cellOf = (x) => Math.floor(x / cell);

  for (const [c0, r0, w, h, kind] of map.rects) {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (inBounds(c, r)) terrain[index(c, r)] = kind;
  }
  const stage = map.stage;
  if (stage) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (Math.hypot(c + 0.5 - (stage.col + 0.5), r + 0.5 - (stage.row + 0.5)) <= stage.radius && terrain[index(c, r)] === T.GROUND) {
      terrain[index(c, r)] = T.STAGE;
    }
  }
  for (const [c, r] of map.pylons) terrain[index(c, r)] = T.SOLID;
  for (const [c0, r0, w, h] of map.flammable) {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) {
      if (inBounds(c, r) && terrain[index(c, r)] === T.GROUND) flammable[index(c, r)] = 1;
    }
  }
  for (const [c0, r0, w, h] of map.naturalIce ?? []) {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) {
      const i = index(c, r);
      if (inBounds(c, r) && terrain[i] === T.WATER && !naturalIce[i]) { naturalIce[i] = 1; naturalCount++; }
    }
  }
  function restoreNaturalIce() {
    iceCount = 0;
    for (let i = 0; i < count; i++) {
      if (naturalIce[i]) { ice[i] = Infinity; iceIntegrity[i] = rules.naturalIceIntegrity; refreeze[i] = 0; iceWarned[i] = 0; }
      if (ice[i] > 0) iceCount++;
    }
    refreezeCount = 0;
  }
  restoreNaturalIce();
  for (let i = 0; i < count; i++) if (terrain[i] === T.LAVA) lavaCount++;
  const props = dataArenaPropSpecs(map).map((spec, pi) => {
    const cells = [];
    for (let r=spec.row;r<spec.row+spec.height;r++) for(let c=spec.col;c<spec.col+spec.width;c++) {
      const i=index(c,r); cells.push(i); propIndex[i]=pi;
      if (spec.combustible) flammable[i]=1;
    }
    return {...spec, cells, hp:spec.maxHp, destroyed:false, charred:false, hits:0};
  });

  const isWaterTerrain = (i) => terrain[i] === T.WATER;
  const isSolid = (i) => terrain[i] === T.SOLID || terrain[i] === T.STANDS;
  const isConductive = (i) => (terrain[i] === T.WATER && ice[i] <= 0) || terrain[i] === T.SHALLOW;

  /** What a body standing on this cell stands on. */
  function surface(i) {
    if (i < 0 || i >= count) return "OUT";
    if (isSolid(i)) return "SOLID";
    if (isWaterTerrain(i)) return ice[i] > 0 ? (ice[i] <= rules.iceWarnSeconds ? "ICE_CRACKING" : "ICE") : "WATER";
    if (terrain[i] === T.SHALLOW) return "SHALLOW";
    if (terrain[i] === T.LAVA) return cooled[i] > 0 ? (cooled[i] <= rules.lavaWarnSeconds ? "COOLED_ROCK_REHEATING" : "COOLED_ROCK") : "LAVA";
    return "GROUND";
  }

  function surfaceAt(x, y) {
    const c = cellOf(x), r = cellOf(y);
    return inBounds(c, r) ? surface(index(c, r)) : "OUT";
  }

  /** Movement blocking per body kind. Swimmers cross open water; walkers do not. */
  function blocksMove(i, kind) {
    if (i < 0 || i >= count) return true;
    if (isSolid(i)) return true;
    if (isWaterTerrain(i) && ice[i] <= 0) return kind !== "swimmer" && kind !== "forced";
    return false;
  }

  function blocksMoveAt(c, r, kind) {
    return !inBounds(c, r) || blocksMove(index(c, r), kind);
  }

  const blocksLaser = (i) => i < 0 || i >= count || isSolid(i);

  function propAtCell(i) { const pi=propIndex[i]; return pi>=0 ? props[pi] : null; }
  function propAt(x,y) { const c=cellOf(x),r=cellOf(y); return inBounds(c,r) ? propAtCell(index(c,r)) : null; }
  function propVisualState(prop) {
    if (prop.destroyed) return "DESTROYED";
    if (prop.cells.some(i=>fire[i]>0)) return "BURNING";
    if (prop.charred) return "BURNT";
    return prop.hp < prop.maxHp*.7 ? "DAMAGED" : "INTACT";
  }
  function damageProp(prop, amount, events, cause="IMPACT", element=null) {
    if (!prop || prop.destroyed || !(amount>0)) return false;
    // RELAY cover (2026-10-28): its material's weak elements break it faster.
    const weak=Boolean(element&&prop.weak?.includes(element));
    if (weak) amount*=prop.weakScale??1;
    const beforeHp=prop.hp;prop.hp=Math.max(0,prop.hp-amount);prop.hits++;
    if (cause==="FIRE") prop.charred=true;
    const x=(prop.col+prop.width/2)*cell,y=(prop.row+prop.height/2)*cell;
    // Bound impact notifications; continuous beams must not spawn 60 bursts/s.
    const crossedDamageStep=Math.ceil(beforeHp/prop.maxHp*8)!==Math.ceil(prop.hp/prop.maxHp*8);
    if (prop.hits===1 || crossedDamageStep || prop.hp===0 || weak) events?.push({type:"PROP_HIT",id:prop.id,x,y,hp:prop.hp,maxHp:prop.maxHp,cause,material:prop.material,weak});
    if (prop.hp===0) {
      prop.destroyed=true;
      for(const i of prop.cells) {terrain[i]=T.GROUND;if(prop.charred)scorch[i]=255;}
      navRevision++;
      events?.push({type:"PROP_DESTROYED",id:prop.id,x,y,charred:prop.charred,material:prop.material});
    }
    return true;
  }
  function damagePropsInRadius(x,y,radius,amount,events,cause="IMPACT",element=null) {
    let hit=0;
    for(const prop of props) {
      if(prop.destroyed)continue;
      const nx=Math.max(prop.col*cell,Math.min(x,(prop.col+prop.width)*cell));
      const ny=Math.max(prop.row*cell,Math.min(y,(prop.row+prop.height)*cell));
      if(Math.hypot(nx-x,ny-y)<=radius && damageProp(prop,amount,events,cause,element))hit++;
    }
    return hit;
  }

  /**
   * Distance along a unit ray to the first laser-blocking cell (DDA traversal),
   * capped at maxDistance.
   */
  function raycast(x0, y0, dx, dy, maxDistance) {
    let c = cellOf(x0), r = cellOf(y0);
    if (!inBounds(c, r) || blocksLaser(index(c, r))) return 0;
    const stepC = dx > 0 ? 1 : -1, stepR = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(cell / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(cell / dy) : Infinity;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (c + 1) * cell - x0 : x0 - c * cell) / Math.abs(dx)) : Infinity;
    let tMaxY = dy !== 0 ? ((dy > 0 ? (r + 1) * cell - y0 : y0 - r * cell) / Math.abs(dy)) : Infinity;
    for (let guard = 0; guard < cols + rows + 4; guard++) {
      let t;
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; c += stepC; }
      else { t = tMaxY; tMaxY += tDeltaY; r += stepR; }
      if (t >= maxDistance) return maxDistance;
      if (!inBounds(c, r) || blocksLaser(index(c, r))) return t;
    }
    return maxDistance;
  }

  function ignite(i, events, source = "SPREAD") {
    if (i < 0 || i >= count || !flammable[i] || fire[i] > 0 || wet[i] > 0 || ash[i] > 0) return false;
    fire[i] = rules.fireBurnSeconds;
    scorch[i] = Math.max(scorch[i],70);
    heat[i] = 0;
    burningCount++;
    navRevision++;
    events?.push({ type: "FIRE_IGNITE", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, source });
    return true;
  }

  function igniteAt(x, y, events, source) {
    const c = cellOf(x), r = cellOf(y);
    return inBounds(c, r) ? ignite(index(c, r), events, source) : false;
  }

  function forCellsInRadius(x, y, radiusCells, visit) {
    const c0 = cellOf(x), r0 = cellOf(y), span = Math.ceil(radiusCells);
    const limit = radiusCells * cell;
    for (let r = r0 - span; r <= r0 + span; r++) for (let c = c0 - span; c <= c0 + span; c++) {
      if (!inBounds(c, r)) continue;
      const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell;
      if (Math.hypot(cx - x, cy - y) <= limit + cell * 0.5) visit(index(c, r), cx, cy);
    }
  }

  /** Water on an area: put out fire and leave the cells wet. Returns cells put out. */
  function applyWater(x, y, radiusCells, events) {
    let out = 0;
    forCellsInRadius(x, y, radiusCells, (i, cx, cy) => {
      if (fire[i] > 0) {
        fire[i] = 0; burningCount--; out++; navRevision++;
        events?.push({ type: "FIRE_OUT", cell: i, x: cx, y: cy });
      }
      if (flammable[i]) { wet[i] = rules.wetSeconds; heat[i] = 0; }
    });
    return out;
  }

  function freezeCell(i, seconds, events, source) {
    if (i < 0 || i >= count || !isWaterTerrain(i)) return false;
    const was = ice[i];
    if (was >= seconds) return false;
    if (was <= 0) { iceCount++; navRevision++; }
    if (charge[i] > 0) { charge[i] = 0; chargeTeam[i] = -1; chargedCount--; }
    ice[i] = seconds;
    iceWarned[i] = 0;
    events?.push({ type: "ICE_FORM", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, source, seconds });
    return true;
  }

  /**
   * A cryo pod bursting on a bank freezes a three-cell-wide column straight
   * across the channel, from the first water cell to the far bank: a bridge.
   * Returns the number of cells frozen.
   */
  function applyCryoColumn(x, y, seconds, events) {
    const c0 = cellOf(x), r0 = cellOf(y);
    let direction = 0;
    for (const dr of [1, -1]) if (inBounds(c0, r0 + dr) && isWaterTerrain(index(c0, r0 + dr))) { direction = dr; break; }
    if (!direction) return 0;
    let frozen = 0;
    for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc;
      for (let r = r0 + direction; inBounds(c, r) && isWaterTerrain(index(c, r)); r += direction) {
        if (freezeCell(index(c, r), seconds, events, "POD")) frozen++;
      }
    }
    return frozen;
  }

  /** An ember landing on ice shortens it. */
  function meltAt(x, y, seconds, events) {
    const c = cellOf(x), r = cellOf(y);
    if (!inBounds(c, r)) return false;
    const i = index(c, r);
    if (ice[i] <= 0) return false;
    ice[i] = Math.max(0.01, ice[i] - seconds);
    events?.push({ type: "ICE_MELT_HIT", cell: i, x: (c + 0.5) * cell, y: (r + 0.5) * cell });
    return true;
  }

  /**
   * Heat lands at (x, y): natural ice inside `radius` cells loses integrity
   * with linear falloff; temporary ice loses `amount / 25` seconds. One call
   * is one application per cell (callers dedupe repeated hits). Returns the
   * number of cells that started cracking.
   */
  function heatIceAt(x, y, { radius = 2.5, amount = 50, source = "HEAT" } = {}, events) {
    let cracked = 0, heated = 0;
    forCellsInRadius(x, y, radius, (i, cx, cy) => {
      if (!(ice[i] > 0)) return;
      // Full strength within one cell of the impact, then linear to the edge.
      const d = Math.hypot(cx - x, cy - y), reach = (radius + 0.5) * cell;
      const falloff = d <= cell ? 1 : Math.max(0, 1 - (d - cell) / Math.max(1, reach - cell));
      if (falloff <= 0) return;
      heated++;
      if (ice[i] === Infinity) {
        iceIntegrity[i] -= amount * falloff;
        if (iceIntegrity[i] <= 0) { iceIntegrity[i] = 0; ice[i] = rules.iceWarnSeconds; cracked++; }
      } else {
        ice[i] = Math.max(0.01, ice[i] - amount * falloff / 25);
      }
    });
    if (heated) events?.push({ type: "ICE_HEATED", x, y, cells: heated, cracked, source });
    return cracked;
  }

  /**
   * Cold lands at (x, y): opened natural cells refreeze at once; other open
   * water freezes temporarily for `seconds`. Returns the cells frozen.
   */
  function coolAt(x, y, { radius = 2, seconds = rules.lensIceSeconds, source = "COLD" } = {}, events) {
    let frozen = 0;
    forCellsInRadius(x, y, radius, (i) => {
      if (!isWaterTerrain(i) || ice[i] > 0) return;
      if (naturalIce[i]) {
        ice[i] = Infinity; iceIntegrity[i] = rules.naturalIceIntegrity; iceWarned[i] = 0;
        if (refreeze[i] > 0) { refreeze[i] = 0; refreezeCount--; }
        if (charge[i] > 0) { charge[i] = 0; chargeTeam[i] = -1; chargedCount--; }
        iceCount++; navRevision++; frozen++;
        events?.push({ type: "ICE_FORM", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, source, seconds: Infinity });
      } else if (freezeCell(i, seconds, events, source)) frozen++;
    });
    return frozen;
  }

  /**
   * Water or cold lands at (x, y): lava inside `radius` cells crusts over for
   * `seconds` (a re-cooled cell is reset to the full time, never extended past
   * it). Returns the number of lava cells cooled.
   */
  function coolLavaAt(x, y, { radius = 2.5, seconds = rules.lavaCoolSeconds, source = "WATER" } = {}, events) {
    let n = 0;
    forCellsInRadius(x, y, radius, (i) => {
      if (terrain[i] !== T.LAVA) return;
      if (!(cooled[i] > 0)) { cooledCount++; navRevision++; }
      cooled[i] = Math.max(cooled[i], seconds);
      cooledWarned[i] = 0;
      n++;
    });
    if (n) events?.push({ type: "LAVA_COOLED", x, y, cells: n, seconds, source });
    return n;
  }

  /**
   * Thunder lands at (x, y). Charge floods the connected conductive cells
   * (4-neighbour) within `radius` cells. Dry ground stops it, so a bank or a
   * sandbar is a refuge. Returns the cells charged (0 on dry ground).
   */
  function applyShock(x, y, { team = -1, seconds = rules.shockSeconds, radius = rules.shockRadius, source = "THUNDER" } = {}, events) {
    const c0 = cellOf(x), r0 = cellOf(y);
    if (!inBounds(c0, r0) || !isConductive(index(c0, r0)) || !(seconds > 0)) return 0;
    const start = index(c0, r0);
    const seen = new Uint8Array(count);
    const queue = [start];
    seen[start] = 1;
    const cells = [];
    const limit = radius * radius;
    while (queue.length) {
      const i = queue.pop();
      const c = i % cols, r = (i - c) / cols;
      if ((c - c0) * (c - c0) + (r - r0) * (r - r0) > limit) continue;
      cells.push(i);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inBounds(c + dc, r + dr)) continue;
        const n = index(c + dc, r + dr);
        if (!seen[n] && isConductive(n)) { seen[n] = 1; queue.push(n); }
      }
    }
    for (const i of cells) {
      if (charge[i] <= 0) chargedCount++;
      charge[i] = Math.max(charge[i], seconds);
      chargeTeam[i] = team;
    }
    chargeWarned = false;
    events?.push({ type: "SHOCK_CHARGE", x: (c0 + 0.5) * cell, y: (r0 + 0.5) * cell, cells: cells.length, team, seconds, source });
    return cells.length;
  }

  /** The charge under a point, or null when the cell is not charged. */
  function chargeAt(x, y) {
    const c = cellOf(x), r = cellOf(y);
    if (!inBounds(c, r)) return null;
    const i = index(c, r);
    return charge[i] > 0 ? { seconds: charge[i], team: chargeTeam[i], cell: i, fading: charge[i] <= rules.shockWarnSeconds } : null;
  }

  /** The tide opens: the retractable bridge lifts and its cells become water. */
  function openTide(events) {
    let changed = 0;
    for (let i = 0; i < count; i++) if (terrain[i] === T.BRIDGE) { terrain[i] = T.WATER; changed++; }
    if (changed) { navRevision++; events?.push({ type: "BRIDGE_LIFTED", cells: changed }); }
    return changed;
  }

  function step(dt, events) {
    // Charge: count down; announce the fade once per burst, then the clear.
    if (chargedCount > 0) {
      let fading = 0;
      for (let i = 0; i < count; i++) {
        if (charge[i] <= 0) continue;
        charge[i] -= dt;
        if (charge[i] <= 0) { charge[i] = 0; chargeTeam[i] = -1; chargedCount--; }
        else if (charge[i] <= rules.shockWarnSeconds) fading++;
      }
      if (fading && !chargeWarned) { chargeWarned = true; events.push({ type: "SHOCK_FADING", cells: fading }); }
      if (chargedCount === 0) events.push({ type: "SHOCK_CLEARED" });
    }
    // Ice: count down, warn once, melt.
    if (iceCount > 0) {
      for (let i = 0; i < count; i++) {
        if (ice[i] <= 0) continue;
        const before = ice[i];
        ice[i] -= dt;
        if (!iceWarned[i] && ice[i] <= rules.iceWarnSeconds) {
          iceWarned[i] = 1; navRevision++;
          events.push({ type: "ICE_CRACK_WARN", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell });
        }
        if (ice[i] <= 0 && before > 0) {
          ice[i] = 0; iceCount--; navRevision++;
          if (naturalIce[i]) { refreeze[i] = rules.naturalRefreezeSeconds; refreezeCount++; }
          events.push({ type: "ICE_MELT", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, natural: Boolean(naturalIce[i]) });
        }
      }
    }
    // Cooled lava: count down, warn once per cell, then molten again.
    if (cooledCount > 0) {
      let warned = 0, restored = 0;
      for (let i = 0; i < count; i++) {
        if (!(cooled[i] > 0)) continue;
        cooled[i] -= dt;
        if (cooled[i] <= 0) { cooled[i] = 0; cooledWarned[i] = 0; cooledCount--; navRevision++; restored++; }
        else if (!cooledWarned[i] && cooled[i] <= rules.lavaWarnSeconds) { cooledWarned[i] = 1; warned++; }
      }
      if (warned) events.push({ type: "LAVA_REHEAT_WARN", cells: warned });
      if (restored) events.push({ type: "LAVA_RESTORED", cells: restored });
    }
    // Opened natural ice closes again on its own timer.
    if (refreezeCount > 0) {
      for (let i = 0; i < count; i++) {
        if (!(refreeze[i] > 0)) continue;
        refreeze[i] -= dt;
        if (refreeze[i] > 0) continue;
        refreeze[i] = 0; refreezeCount--;
        if (ice[i] > 0) continue;
        ice[i] = Infinity; iceIntegrity[i] = rules.naturalIceIntegrity; iceWarned[i] = 0; iceCount++; navRevision++;
        if (charge[i] > 0) { charge[i] = 0; chargeTeam[i] = -1; chargedCount--; }
        events.push({ type: "ICE_FORM", cell: i, x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, source: "NATURAL_REFREEZE", seconds: Infinity });
      }
    }
    for (let i = 0; i < count; i++) {
      if (wet[i] > 0) wet[i] = Math.max(0, wet[i] - dt);
      if (ash[i] > 0) ash[i] = Math.max(0, ash[i] - dt);
    }
    if (burningCount <= 0) { fireTimer = 0; return; }
    for (const prop of props) if (!prop.destroyed && prop.cells.some(i=>fire[i]>0)) damageProp(prop,prop.burnDps*dt,events,"FIRE");
    for (let i = 0; i < count; i++) {
      if (fire[i] <= 0) continue;
      scorch[i]=Math.min(255,Math.max(scorch[i],Math.round(70+(1-fire[i]/rules.fireBurnSeconds)*185)));
      fire[i] -= dt;
      if (fire[i] <= 0) {
        fire[i] = 0; burningCount--; ash[i] = rules.ashSeconds; scorch[i]=255; navRevision++;
        events.push({ type: "FIRE_BURNT_OUT", cell: i });
      }
    }
    fireTimer += dt;
    if (fireTimer < rules.fireTick) return;
    fireTimer -= rules.fireTick;
    // Heat is accumulated first, then applied, so spread order never depends
    // on scan direction.
    const toIgnite = [];
    for (let i = 0; i < count; i++) {
      if (fire[i] <= 0) continue;
      const c = i % cols, r = (i - c) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inBounds(c + dc, r + dr)) continue;
        const n = index(c + dc, r + dr);
        if (!flammable[n] || fire[n] > 0 || wet[n] > 0 || ash[n] > 0) continue;
        heat[n] += rules.fireSpreadHeat;
        if (heat[n] >= 1) toIgnite.push(n);
      }
    }
    for (const n of toIgnite) ignite(n, events, "SPREAD");
  }

  /** Fresh round: transient hazards clear; match damage/scorch/terrain persist. */
  function resetDynamic() {
    fire.fill(0); heat.fill(0); wet.fill(0); ash.fill(0); ice.fill(0); iceWarned.fill(0);
    charge.fill(0); chargeTeam.fill(-1); chargedCount = 0; chargeWarned = false;
    burningCount = 0; iceCount = 0; fireTimer = 0; navRevision++;
    restoreNaturalIce(); // authored sheets are terrain, not transient hazards
    cooled.fill(0); cooledWarned.fill(0); cooledCount = 0;
  }

  return Object.freeze({
    resetDynamic, map,
    cols, rows, cell, count, terrain, flammable, fire, wet, ash, ice, scorch, props, charge, chargeTeam,
    naturalIce, iceIntegrity, refreeze, cooled,
    propAtCell, propAt, propVisualState, damageProp, damagePropsInRadius,
    index, inBounds, cellOf,
    get navRevision() { return navRevision; },
    get burningCount() { return burningCount; },
    get iceCount() { return iceCount; },
    get chargedCount() { return chargedCount; },
    get naturalCount() { return naturalCount; },
    get lavaCount() { return lavaCount; },
    get cooledCount() { return cooledCount; },
    surface, surfaceAt, blocksMove, blocksMoveAt, blocksLaser, isSolid, isWaterTerrain, isConductive,
    raycast, ignite, igniteAt, applyWater, freezeCell, applyCryoColumn, meltAt, openTide, applyShock, chargeAt,
    heatIceAt, coolAt, coolLavaAt, step,
    burningAt(x, y) { const c = cellOf(x), r = cellOf(y); return inBounds(c, r) && fire[index(c, r)] > 0; },
    /** Nearest cell a walker may safely stand on (not solid, not open water, not burning). */
    nearestSafeCell(x, y) {
      const c0 = cellOf(x), r0 = cellOf(y);
      for (let radius = 0; radius < Math.max(cols, rows); radius++) {
        let best = null, bestDistance = Infinity;
        for (let r = r0 - radius; r <= r0 + radius; r++) for (let c = c0 - radius; c <= c0 + radius; c++) {
          if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== radius || !inBounds(c, r)) continue;
          const i = index(c, r);
          if (isSolid(i) || isWaterTerrain(i) || fire[i] > 0) continue;
          const cx = (c + 0.5) * cell, cy = (r + 0.5) * cell, d = Math.hypot(cx - x, cy - y);
          if (d < bestDistance) { bestDistance = d; best = { x: cx, y: cy, cell: i }; }
        }
        if (best) return best;
      }
      return null;
    }
  });
}
