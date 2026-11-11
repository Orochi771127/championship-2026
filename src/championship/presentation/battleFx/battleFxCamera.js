// Dynamic battle presentation -- the camera director.
//
// OWNER_APPROVED_ADAPTATION 2026-10-12. Pure presentation maths over the
// scene's existing layout coordinates ("local": the arena contain-fit at zoom
// 1). The director only returns a world transform for the existing Pixi world
// container; it never moves a combatant, so stand positions, collision and the
// battle clock are untouched. It advances on the presentation's elapsed time
// handed in by the scene (the one Pixi ticker), never on its own clock.
//
// The ordinary battle scene uses boundedMap: cover with dynamic tracking.
// Legacy focus framing remains available to bounded presentation callers.
// Framing follows the action the way an arena broadcast does: the arena always
// fills the field (no letterbox), the shot frames every fighter, and while a
// move or a knockout is in focus it tightens on that pair. Hits add a short
// zoom punch and trauma-based shake. Reduced motion keeps a steady wide shot
// with no punch and no shake.
//
// A calm shot (Owner 2026-11-11: 「畫面都會一直跳動」). Measured on a phone
// recording, the shot never rested for more than 0.6 s and turned round more
// than three times a second. Five rules now keep it still unless the fight
// itself moves:
//   - a chosen framing holds for BATTLE_FX_FRAMING_HOLD_MS before another may
//     replace it, and the wide shot and the pair shot switch with hysteresis;
//   - the framed box is eased: it grows at once (nobody is cut off), shrinks
//     slowly (an attack cell's wide frame no longer pumps the zoom), and moves
//     from one framing to the next instead of jumping there;
//   - the shot rests: it does not move while what it wants lies within a small
//     window of where it is, then goes there in one eased move;
//   - an ordinary attack no longer re-aims the shot; only a signature move and
//     a knockout stage one;
//   - a medium hit shakes lightly and does not zoom; a heavy hit zooms half as
//     far, and both answer at most once in BATTLE_FX_IMPACT_GAP_MS.

/** How long an ordinary framing holds before a different one may replace it. */
export const BATTLE_FX_FRAMING_HOLD_MS = 1100;
/** The quickest two camera answers to hits may follow each other. */
export const BATTLE_FX_IMPACT_GAP_MS = 380;
/** A scattered group returns to the wide shot only once it fits this share of the window. */
export const BATTLE_FX_WIDE_RETURN = 0.9;
/** The resting shot: it stays put while its wanted centre is within this many screen px and its wanted zoom within this share. */
export const BATTLE_FX_REST_PX = 14;
export const BATTLE_FX_REST_ZOOM = 0.05;
/** A rival pair replaces the held pair only when it is this much nearer. */
export const BATTLE_FX_PAIR_SWITCH = 0.75;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// The original freezes the whole battle for 48..60 frames at a knockout (its
// own pause counter, world +0x1F134), and for 2..12 frames at an ordinary hit.
// Measured over six battles, a fifth of all battle time was that counter
// running, and after every knockout the survivors stood still for about a
// second (Owner 2026-11-11: 「角色打到一半會突然站在原地不動」). The battle
// itself is untouched: while the counter is above a hit-stop's length the
// scene plays those same frames three at a time, so the long freeze takes
// about 0.4 s and a hit-stop keeps its full length. No frame is skipped.
export const BATTLE_FX_LONG_PAUSE_FRAMES = 12;
export const BATTLE_FX_LONG_PAUSE_PACE = 3;
/** Playback pace for this published view: 1, or the long-freeze pace. */
export function battleFxFreezePace(view, reducedMotion = false) {
  const pause = Number(view?.nativeLifecycle?.timing?.pause) || 0;
  return !reducedMotion && pause > BATTLE_FX_LONG_PAUSE_FRAMES ? BATTLE_FX_LONG_PAUSE_PACE : 1;
}

/** How long a HUD row must stay smaller before the safe window grows back. */
export const BATTLE_FX_INSET_RELEASE_MS = 4000;
/**
 * Steady HUD insets. The rows the camera keeps clear of are measured from the
 * page, and the record row grows by about 30 px each time a signature move's
 * banner shows, then shrinks back. Followed as measured, the safe window (and
 * with it the smallest zoom) changed in one frame at every signature move.
 * A row that grows is followed quickly; a row that shrinks is believed only
 * after BATTLE_FX_INSET_RELEASE_MS, so a passing banner moves nothing twice.
 * A new viewport size starts afresh.
 */
export function createBattleFxSteadyInsets({reducedMotion = false} = {}) {
  let held = null;
  return function steady(raw, dtMs, viewport) {
    if (!raw) { held = null; return null; }
    const width = viewport?.width ?? 0, height = viewport?.height ?? 0;
    if (!held || held.width !== width || held.height !== height || reducedMotion) {
      held = {top: raw.top, bottom: raw.bottom, width, height, low: {top: 0, bottom: 0}};
      return {top: raw.top, bottom: raw.bottom};
    }
    const grow = battleFxApproach(dtMs, 140), release = battleFxApproach(dtMs, 420);
    for (const side of ['top', 'bottom']) {
      const want = Number(raw[side]) || 0;
      if (want >= held[side]) {
        held.low[side] = 0;
        held[side] += (want - held[side]) * grow;
        if (want - held[side] < 0.5) held[side] = want;
      } else {
        held.low[side] += Math.max(0, dtMs);
        if (held.low[side] > BATTLE_FX_INSET_RELEASE_MS) {
          held[side] += (want - held[side]) * release;
          if (held[side] - want < 0.5) held[side] = want;
        }
      }
    }
    return {top: held.top, bottom: held.bottom};
  };
}

/** Smoothing factor for an exponential approach over `dtMs` with time constant `tauMs`. */
export function battleFxApproach(dtMs, tauMs) {
  if (!(dtMs > 0)) return 0;
  return 1 - Math.exp(-dtMs / Math.max(1, tauMs));
}

/** Union of boxes [left, top, right, bottom]; null when empty. */
export function battleFxUnionBox(boxes) {
  let box = null;
  for (const b of boxes) {
    if (!b || ![b.left, b.top, b.right, b.bottom].every(Number.isFinite)) continue;
    box = box ? {left: Math.min(box.left, b.left), top: Math.min(box.top, b.top), right: Math.max(box.right, b.right), bottom: Math.max(box.bottom, b.bottom)}
      : {left: b.left, top: b.top, right: b.right, bottom: b.bottom};
  }
  return box;
}

/**
 * The HUD-aware safe window (Owner 2026-11-03): the screen strip between the
 * floating HUD rows, where every fighter must stay visible. `insets` are the
 * screen pixels the top HUD (arena badge + opponent cards) and the bottom HUD
 * (player cards + record) cover. Without insets the window is the viewport.
 */
export function battleFxSafeWindow(viewport, insets = null) {
  let top = clamp(Number(insets?.top) || 0, 0, viewport.height * 0.45);
  let bottom = clamp(Number(insets?.bottom) || 0, 0, viewport.height * 0.45);
  // A short landscape field cannot give the HUD rows most of its height: past
  // 45 % together they shrink in proportion, so a group still fits the window.
  const limit = viewport.height * 0.45;
  if (top + bottom > limit) { const k = limit / (top + bottom); top *= k; bottom *= k; }
  const height = Math.max(1, viewport.height - top - bottom);
  return Object.freeze({top, bottom, height, centerY: top + height / 2});
}

/**
 * The smallest zoom that still paints the arena over the safe window: the
 * full width, and the safe height. Under a HUD row the picture may run out;
 * the HUD covers that strip, so the fighters can use the whole safe window.
 */
export function battleFxSafeCover(viewport, art, insets = null) {
  const safe = battleFxSafeWindow(viewport, insets);
  return Math.max(viewport.width / art.width, safe.height / art.height);
}

/**
 * The shot for one framing box: zoom and centre, clamped so the visible region
 * never leaves the arena. `art` is the arena rectangle in local coordinates.
 */
export function battleFxFrameShot({viewport, art, box, maxZoomFactor = 1.75, boost = 0, responsiveLayout = false, boundedMap = false, insets = null}) {
  const safe = battleFxSafeWindow(viewport, insets);
  const fullCover = Math.max(viewport.width / art.width, viewport.height / art.height);
  // A bounded map with HUD insets may pull back until the art covers only the safe window.
  const cover = boundedMap && insets ? battleFxSafeCover(viewport, art, insets) : fullCover;
  const maxZoom = fullCover * maxZoomFactor;
  let minimumZoom = cover;
  let zoom = cover, cx = art.x + art.width / 2, cy = art.y + art.height / 2, want = null;
  if (box) {
    const width = Math.max(1, box.right - box.left), height = Math.max(1, box.bottom - box.top);
    // Room for the overhead bars and words above, and the shadow below.
    const padX = width * 0.12 + 16, padTop = height * 0.12 + 28, padBottom = height * 0.08 + 12;
    const fit = Math.min(viewport.width / (width + padX * 2), safe.height / (height + padTop + padBottom));
    // The wide host must fit the selected action, even when arena cover would
    // cut off a tall group. Space outside the art belongs to the stage backdrop.
    if (responsiveLayout && !boundedMap) minimumZoom = Math.min(cover, fit);
    zoom = clamp(fit * (1 + boost), minimumZoom, Math.max(minimumZoom, maxZoom));
    want = {left: box.left - padX, right: box.right + padX, top: box.top - padTop, bottom: box.bottom + padBottom};
    cx = (want.left + want.right) / 2;
    cy = (want.top + want.bottom) / 2;
  }
  const place = z => {
    const halfW = viewport.width / (2 * z), halfH = viewport.height / (2 * z);
    // The framed group's centre sits on the safe window's centre, not the screen's.
    const shift = (safe.centerY - viewport.height / 2) / z;
    // The original's movement can carry fighters past the arena picture; the
    // legacy shot may follow them there. Ordinary battles use boundedMap
    // and constrain the visible viewport to the real map, except the strips
    // under the HUD rows, which may run past the picture's top and bottom.
    const over = {
      left: !boundedMap && want ? Math.min(Math.max(0, art.x - want.left), halfW) : 0,
      right: !boundedMap && want ? Math.min(Math.max(0, want.right - art.x - art.width), halfW) : 0,
      top: !boundedMap && want ? Math.min(Math.max(0, art.y - want.top), halfH) : boundedMap ? safe.top / z : 0,
      bottom: !boundedMap && want ? Math.min(Math.max(0, want.bottom - art.y - art.height), halfH) : boundedMap ? safe.bottom / z : 0
    };
    return {...battleFxClampCentre({cx, cy: cy - shift, halfW, halfH, art, over}), halfW, halfH, over};
  };
  let placed = place(zoom);
  // Near an edge the clamp moves the centre off the fighters; back the zoom
  // off (never below cover) until the framed group is inside the safe window again.
  for (let i = 0; box && i < 12 && zoom > minimumZoom; i++) {
    const top = placed.y - placed.halfH + safe.top / zoom, bottom = placed.y + placed.halfH - safe.bottom / zoom;
    const inside = box.left >= placed.x - placed.halfW && box.right <= placed.x + placed.halfW
      && box.top - 18 >= top && box.bottom <= bottom;
    if (inside) break;
    zoom = Math.max(minimumZoom, zoom * 0.92);
    placed = place(zoom);
  }
  return {zoom, cx: placed.x, cy: placed.y, cover, maxZoom, over: placed.over};
}

/** Keep the view inside the arena, past each edge only by that side's allowance. */
export function battleFxClampCentre({cx, cy, halfW, halfH, art, over = {left: 0, right: 0, top: 0, bottom: 0}}) {
  const lowX = art.x + halfW - over.left, highX = art.x + art.width - halfW + over.right;
  const lowY = art.y + halfH - over.top, highY = art.y + art.height - halfH + over.bottom;
  return {x: lowX > highX ? (lowX + highX) / 2 : clamp(cx, lowX, highX), y: lowY > highY ? (lowY + highY) / 2 : clamp(cy, lowY, highY)};
}

/** Constrain the composed camera on every frame, including shake and native zoom. */
export function clampBattleCameraToMap({viewport, art, transform, anchor = null, box = null, insets = null}) {
  // With HUD insets the art need only cover the safe window; the strips under
  // the HUD rows may show the backdrop, and the framed box keeps clear of them.
  const safe=battleFxSafeWindow(viewport,insets);
  const cover=insets ? battleFxSafeCover(viewport,art,insets) : Math.max(viewport.width/art.width,viewport.height/art.height);
  const fit=box ? Math.min(Math.max(1,viewport.width-16)/Math.max(1,box.right-box.left),
    Math.max(1,safe.height-32)/Math.max(1,box.bottom-box.top)) : Infinity;
  const zoom=Math.max(cover,Math.min(transform.zoom,fit));
  const cx=(viewport.width/2-transform.x)/transform.zoom,cy=(viewport.height/2-transform.y)/transform.zoom;
  const minX=viewport.width-(art.x+art.width)*zoom,maxX=-art.x*zoom;
  const minY=viewport.height-safe.bottom-(art.y+art.height)*zoom,maxY=safe.top-art.y*zoom;
  let x=clamp(viewport.width/2-cx*zoom,minX,maxX),y=clamp(viewport.height/2-cy*zoom,minY,maxY);
  if(box){
    let lowX=Math.max(minX,8-box.left*zoom),highX=Math.min(maxX,viewport.width-8-box.right*zoom);
    let lowY=Math.max(minY,safe.top+24-box.top*zoom),highY=Math.min(maxY,viewport.height-safe.bottom-8-box.bottom*zoom);
    // Near cover capacity, give up padding before clipping a body that can fit.
    if(lowX>highX){lowX=Math.max(minX,-box.left*zoom);highX=Math.min(maxX,viewport.width-box.right*zoom);}
    if(lowY>highY){lowY=Math.max(minY,safe.top-box.top*zoom);highY=Math.min(maxY,viewport.height-safe.bottom-box.bottom*zoom);}
    if(lowX<=highX)x=clamp(x,lowX,highX);
    if(lowY<=highY)y=clamp(y,lowY,highY);
  }
  return Object.freeze({...transform,zoom,x,y,
    centerX:(viewport.width/2-x)/zoom,centerY:(viewport.height/2-y)/zoom,
    ...(anchor ? {anchorX:anchor.x*zoom+x,anchorY:anchor.y*zoom+y} : {})});
}

// Smooth, deterministic noise for shake (no Math.random on the ticker).
function shakeNoise(t, seed) {
  return Math.sin(t * 0.037 + seed) * 0.55 + Math.sin(t * 0.061 + seed * 2.3) * 0.3 + Math.sin(t * 0.113 + seed * 4.1) * 0.15;
}

export function createBattleFxCamera({reducedMotion = false, responsiveLayout = false, fullArena = false, boundedMap = false, wideCover = false} = {}) {
  let zoom = null, cx = 0, cy = 0, over = {left: 0, right: 0, top: 0, bottom: 0};
  let punch = 0, trauma = 0, time = 0;
  // The push actually drawn: it follows `punch` over about two frames instead of landing in one.
  let punchNow = 0;
  // Directional kick (Owner 2026-11-03): a hit nudges the shot along the blow, then settles in ~220 ms.
  let kickX = 0, kickY = 0;
  // Slow motion on a signature hit or the final knockout: playback pacing only.
  let slowMs = 0;
  // Signature-hit lens (VFX_FIVE_LAYER_20261101): a short push toward the hit point.
  let lens = null;
  let lastImpact = -Infinity, lastImpactStrength = 0;
  let previousViewport = null;
  // The calm shot: the framing in force (its slots, when it was chosen, whether it is the wide shot)
  // and the eased box the shot and the map clamp both frame.
  let held = {key: null, slots: [], at: -Infinity, wide: true};
  let easedBox = null, boxMoving = false, boxTravel = null;
  // The box the caller's map clamp keeps on screen: the eased framing, or the caster's own body while
  // the original prelude runs. The change from one to the other travels (it used to switch in a frame,
  // which let the clamped zoom leap).
  let clampHeld = {key: 'N', box: null, travel: null};
  const mixBox = (a, b, k) => ({left: a.left + (b.left - a.left) * k, top: a.top + (b.top - a.top) * k,
    right: a.right + (b.right - a.right) * k, bottom: a.bottom + (b.bottom - a.bottom) * k});
  // Whether the shot is on its way somewhere (true) or resting (false).
  let chasing = true;
  const keyOf = list => list.map(s => s.slot).sort((a, b) => a - b).join(',');
  const SIDES = ['left', 'top', 'right', 'bottom'];
  function easeBox(target, dtMs, snap) {
    if (!target) { easedBox = null; boxMoving = false; boxTravel = null; return null; }
    if (!easedBox || snap) { easedBox = {...target}; boxMoving = false; boxTravel = null; return easedBox; }
    if (boxMoving && !boxTravel) {
      // Between two framings the box travels on an ease-in-out, longer for a longer way (0.32..0.9 s),
      // so the shot neither jumps nor starts at full speed.
      const far = Math.max(...SIDES.map(side => Math.abs(target[side] - easedBox[side])));
      boxTravel = {from: {...easedBox}, start: time - Math.max(0, dtMs), duration: clamp(260 + far * 0.9, 320, 900)};
    }
    if (boxTravel) {
      const k = clamp((time - boxTravel.start) / boxTravel.duration, 0, 1), eased = k * k * (3 - 2 * k);
      for (const side of SIDES) easedBox[side] = boxTravel.from[side] + (target[side] - boxTravel.from[side]) * eased;
      if (k >= 1) { boxTravel = null; boxMoving = false; }
      return easedBox;
    }
    // Within one framing an edge grows at once (nobody is cut off) and shrinks slowly.
    const shrink = battleFxApproach(dtMs, 420);
    for (const side of SIDES) {
      const d = target[side] - easedBox[side], growing = side === 'left' || side === 'top' ? d < 0 : d > 0;
      easedBox[side] += d * (growing ? 1 : shrink);
    }
    return easedBox;
  }
  let stages = []; // [{slots:Set|null, boost, includeDown, endMs, priority}]
  const current = () => { while (stages.length && time >= stages[0].endMs) stages.shift(); return stages[0] ?? null; };
  /**
   * A short shot list: each stage frames its slots (null: everyone standing)
   * for its duration, tightened by a positive boost or opened by a negative
   * one. A running signature shot (boost >= 0.25) is not cut by a lesser one.
   */
  function sequence(list) {
    if (fullArena || reducedMotion || !Array.isArray(list) || !list.length) return;
    const active = current();
    if (active && active.priority > 0 && (list[0].boost ?? 0) < 0.25) return;
    let start = time;
    stages = list.map(stage => {
      const boost = stage.boost ?? 0, entry = {slots: stage.slots ? new Set(stage.slots) : null, boost,
        includeDown: Boolean(stage.includeDown), endMs: start + stage.durationMs, priority: boost >= 0.25 ? 1 : 0};
      start += stage.durationMs;
      return entry;
    });
  }
  return Object.freeze({
    sequence,
    /** One-stage shot on these slots for durationMs, tightened by boost. */
    focus(slots, durationMs, boost = 0.12) { sequence([{slots, durationMs, boost}]); },
    /** A short zoom punch, e.g. 0.04 for a solid hit. */
    punch(amount) { if (!fullArena && !reducedMotion) punch = Math.min(0.14, punch + amount); },
    /** Trauma in 0..1; displacement grows with its square. */
    shake(amount) { if (!fullArena && !reducedMotion) trauma = Math.min(1, trauma + amount); },
    /**
     * Signature hit: push in by `amount` (0.18..0.25 -> 1.18x..1.25x) toward a
     * local point for `ms`, easing in fast and back out. Reduced motion and the
     * full-arena view keep their steady shot.
     */
    lens({x, y, amount = 0.22, ms = 260}) {
      if (fullArena || reducedMotion || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      lens = {x, y, amount: Math.min(0.25, Math.max(0, amount)), age: 0, life: Math.max(60, ms)};
      return true;
    },
    /** A burst of ordinary hits gets one camera response; a heavy hit can override it. */
    impact(tier, direction = 0) {
      const strength = tier === 'heavy' ? 2 : tier === 'medium' ? 1 : 0;
      if (fullArena || reducedMotion || !strength || (time - lastImpact < BATTLE_FX_IMPACT_GAP_MS && strength <= lastImpactStrength)) return false;
      lastImpact = time; lastImpactStrength = strength;
      // A heavy hit pushes the shot in by about 5 % toward the contact; a medium
      // one only shakes lightly, so a running exchange does not pump the zoom.
      if (strength === 2) punch = Math.min(0.14, punch + 0.05);
      trauma = Math.min(1, trauma + (strength === 2 ? 0.3 : 0.1));
      const sign = Math.sign(direction);
      if (sign) { kickX = sign * (strength === 2 ? 5 : 2); kickY = strength === 2 ? 2 : 0; }
      return true;
    },
    /**
     * Slow the presentation's playback to 35 % for `ms` (signature hit, final K.O.).
     * The scene paces its frame steps by timeScale(); every frame still runs.
     */
    slowMo(ms = 180) { if (!fullArena && !reducedMotion) slowMs = Math.max(slowMs, Math.min(400, ms)); },
    timeScale: () => slowMs > 0 ? 0.35 : 1,
    /** points are live projectiles: the shot follows a move to its target. */
    update({dtMs = 16.7, viewport, art, subjects, points = [], insets = null, prelude = false}) {
      time += Math.max(0, dtMs);
      slowMs = Math.max(0, slowMs - Math.max(0, dtMs));
      if (fullArena) {
        // Keep the complete authored map and any edge-crossing bodies in one
        // contain transform. Recompute immediately on resize, with no stale
        // camera tween, focus zoom or impact shake that could crop the map.
        const bounds = battleFxUnionBox([
          {left:art.x, top:art.y, right:art.x+art.width, bottom:art.y+art.height},
          ...subjects.filter(Boolean).map(s => ({left:s.left-8, top:s.top-28, right:s.right+8, bottom:s.bottom+12})),
          ...points.map(p => ({left:p.x-12, top:p.y-12, right:p.x+12, bottom:p.y+12}))
        ]);
        zoom = Math.min(viewport.width / Math.max(1, bounds.right-bounds.left),
          viewport.height / Math.max(1, bounds.bottom-bounds.top));
        cx = (bounds.left+bounds.right)/2; cy = (bounds.top+bounds.bottom)/2;
        return Object.freeze({zoom, x:viewport.width/2-zoom*cx, y:viewport.height/2-zoom*cy,
          centerX:cx, centerY:cy, punch:0, trauma:0, focused:[]});
      }
      const stage = current();
      // A bounded shot fits its group into the safe window between the HUD rows.
      const safe = battleFxSafeWindow(viewport, boundedMap ? insets : null);
      const roomCover = boundedMap && insets ? battleFxSafeCover(viewport, art, insets) : Math.max(viewport.width/art.width, viewport.height/art.height);
      const cameraSubjects=boundedMap ? subjects.map(s=>s?.framingBounds?{...s,...s.framingBounds}:s) : subjects;
      const standing = cameraSubjects.filter(s => s && !s.down);
      let framing = stage?.slots ? cameraSubjects.filter(s => s && stage.slots.has(s.slot) && (stage.includeDown || !s.down)) : [];
      const focused = framing.map(s => s.slot);
      // HUD-aware shot (Owner 2026-11-03): a focus tightens on its subjects but
      // keeps every standing fighter in the safe window while the group fits;
      // only a group too wide for it falls back to the focused subjects.
      const focusSet = framing;
      const tooBig=(list,share=1)=>{const group=battleFxUnionBox(list);return group&&((group.right-group.left)*roomCover>viewport.width*share || (group.bottom-group.top)*roomCover>safe.height*share);};
      if (framing.length && boundedMap && insets) framing = [...new Set([...framing, ...standing])];
      let wide = true;
      if (!framing.length) {
        framing = standing.length ? standing : cameraSubjects.filter(Boolean);
        if (boundedMap && framing.length > 2) {
          // When scattered groups cannot share the frame, follow the active
          // engagement or nearest opposing pair. Other actors keep real positions.
          // Hysteresis: a pair shot goes back to the wide shot only once the group fits with room to spare.
          if (tooBig(framing, held.wide ? 1 : BATTLE_FX_WIDE_RETURN)) {
            const scoreOf = (a, b) => Math.hypot((a.left+a.right-b.left-b.right)/2, a.bottom-b.bottom)
              + (a.engaged||b.engaged ? 0 : art.width+art.height);
            let pair = null, score = Infinity;
            for (const a of standing) for (const b of standing) if (a.slot<b.slot && a.team!==b.team) {
              const distance = scoreOf(a, b);
              if (distance<score) {score=distance;pair=[a,b];}
            }
            // The pair already on screen stays unless another is clearly nearer.
            const kept = !held.wide && held.slots.length === 2 ? held.slots.map(slot => standing.find(s => s.slot === slot)) : [];
            if (kept.length === 2 && kept.every(Boolean) && kept[0].team !== kept[1].team && scoreOf(kept[0], kept[1]) * BATTLE_FX_PAIR_SWITCH <= score) pair = kept;
            if (pair) { framing=pair; wide=false; }
          }
        }
      }
      if(boundedMap&&framing.length>1){
        if(tooBig(framing)&&focusSet.length&&focusSet.length<framing.length)framing=focusSet;
        if(framing.length>1&&tooBig(framing))framing=[framing.find(s=>s.engaged)??framing[0]];
      }
      // An ordinary framing holds: a different one may replace it only after the hold, or once a
      // fighter it shows has gone down or the group no longer fits. A staged shot (signature move,
      // knockout) always takes over at once.
      if (!focused.length && held.key !== null && keyOf(framing) !== held.key && time - held.at < BATTLE_FX_FRAMING_HOLD_MS && !reducedMotion) {
        const kept = held.slots.map(slot => cameraSubjects.find(s => s && s.slot === slot && !s.down));
        if (kept.every(Boolean) && kept.length && !(kept.length > 1 && tooBig(kept))) { framing = kept; wide = held.wide; }
      }
      const framingKey = keyOf(framing);
      if (framingKey !== held.key) {
        // The first framing and a resize place the box at once; any later change travels there.
        boxMoving = held.key !== null; boxTravel = null;
        held = {key: framingKey, slots: framing.map(s => s.slot), at: time, wide};
      } else held.wide = wide;
      // A close push-in on one fighter holds; otherwise a live shot widens the frame to its path.
      const follow = stage && stage.boost >= 0.3 ? [] : points.map(p => ({left: p.x - 12, right: p.x + 12, top: p.y - 12, bottom: p.y + 12}));
      const resizing = responsiveLayout && previousViewport !== null
        && (previousViewport.width !== viewport.width || previousViewport.height !== viewport.height);
      // The eased box: what the shot frames and what the map clamp keeps on screen.
      const frameBox = easeBox(battleFxUnionBox(framing), dtMs, zoom === null || resizing || reducedMotion || !(dtMs > 0));
      const shot = battleFxFrameShot({viewport, art, box: battleFxUnionBox([frameBox, ...follow]),
        // An ordinary shot stays within 1.7x cover; a staged push-in may reach 2.3x.
        boost: focused.length ? stage.boost : 0, responsiveLayout, boundedMap, insets: boundedMap ? insets : null,
        // The wide cover shot gains room for a staged push-in (a move, a knockout).
        maxZoomFactor: wideCover ? (focused.length && stage.boost > 0 ? 1.05 + stage.boost : 1.05) : reducedMotion ? 1.3 : focused.length ? 2.3 : 1.7});
      const resized = resizing;
      previousViewport = {width:viewport.width, height:viewport.height};
      // Reframe on the existing resize draw, without advancing shot time or
      // replacing the director. No tween from stale screen geometry.
      if (resized || (zoom === null && responsiveLayout) || (zoom === null && reducedMotion)) {
        zoom = shot.zoom; cx = shot.cx; cy = shot.cy; over = {...shot.over};
      } else if (zoom === null) {
        // Open on the whole arena, then push in: the first frames are the wide shot.
        zoom = shot.cover; cx = art.x + art.width / 2; cy = art.y + art.height / 2;
      } else if (dtMs > 0) {
        // The shot rests: while what it wants is within a small window of where it is, it does not
        // move at all (a fighter stepping about no longer drags the picture). Past the window, during
        // a staged shot, or while the box travels, it goes there and settles before it rests again.
        // The map clamp below still keeps every framed fighter on screen while it rests.
        const offset = Math.hypot((shot.cx - cx) * zoom, (shot.cy - cy) * zoom), scale = Math.abs(shot.zoom / zoom - 1);
        if (!chasing && (offset > BATTLE_FX_REST_PX || scale > BATTLE_FX_REST_ZOOM || stage || boxTravel)) chasing = true;
        const pan = battleFxApproach(dtMs, reducedMotion ? 700 : 300);
        if (chasing) {
          zoom += (shot.zoom - zoom) * battleFxApproach(dtMs, reducedMotion ? 900 : 420);
          cx += (shot.cx - cx) * pan; cy += (shot.cy - cy) * pan;
          if (offset < 1.5 && scale < 0.004 && !stage && !boxTravel) chasing = false;
        }
        for (const side of ['left', 'right', 'top', 'bottom']) over[side] += (shot.over[side] - over[side]) * pan;
      }
      punch *= 1 - battleFxApproach(dtMs, 110);
      punchNow += (punch - punchNow) * battleFxApproach(dtMs, 34);
      const settle = 1 - battleFxApproach(dtMs, 70);
      kickX *= settle; kickY *= settle;
      trauma = Math.max(0, trauma - dtMs / 1000 * 1.9);
      if (boundedMap) zoom = Math.max(shot.cover, zoom);
      let lensK = 0;
      if (lens) {
        lens.age += Math.max(0, dtMs);
        const k = lens.age / lens.life;
        // In over the first 40 % of its life, out over the rest.
        lensK = k >= 1 ? 0 : k < 0.4 ? Math.sin(k / 0.4 * Math.PI / 2) : Math.cos((k - 0.4) / 0.6 * Math.PI / 2);
        if (k >= 1) lens = null;
      }
      const total = zoom * (1 + punchNow) * (1 + (lens ? lens.amount * lensK : 0));
      const lensBox = lensK > 0 ? {left: lens.x - 24, right: lens.x + 24, top: lens.y - 40, bottom: lens.y + 24} : null;
      const withLens = box => !box ? (lensBox ? {...lensBox} : null) : lensBox ? mixBox(box, lensBox, lensK) : {...box};
      // The clamp box for the caller: the caster alone during the original prelude, the framing otherwise.
      const preludeBox = prelude && focusSet.length ? battleFxUnionBox(focusSet) : null;
      const clampKey = preludeBox ? `P${keyOf(focusSet)}` : 'N';
      if (clampKey !== clampHeld.key) clampHeld = {key: clampKey, box: clampHeld.box, travel: clampHeld.box && dtMs > 0 ? {from: {...clampHeld.box}, start: time - dtMs} : null};
      let clampBox = preludeBox ?? frameBox;
      if (clampBox && clampHeld.travel) {
        const k = clamp((time - clampHeld.travel.start) / 420, 0, 1);
        clampBox = mixBox(clampHeld.travel.from, clampBox, k * k * (3 - 2 * k));
        if (k >= 1) clampHeld.travel = null;
      }
      clampHeld.box = clampBox ? {...clampBox} : null;
      // The lens biases this frame's centre only; the tweened centre is untouched.
      // It leans toward the hit by a fifth of the way, and by no more than 36 screen px: a hit far from
      // the centre used to throw the whole picture sideways in one frame.
      const lean = lensK > 0 ? Math.min(0.2 * lensK, 36 * lensK / Math.max(1, Math.hypot(lens.x - cx, lens.y - cy) * total)) : 0;
      const lx = cx + (lensK > 0 ? (lens.x - cx) * lean : 0), ly = cy + (lensK > 0 ? (lens.y - cy) * lean : 0);
      // Re-clamp after the punch so a punched frame looks no further past an
      // arena edge than the shot needed.
      const halfW = viewport.width / (2 * total), halfH = viewport.height / (2 * total);
      const limit = {left: Math.min(over.left, halfW), right: Math.min(over.right, halfW),
        top: Math.min(over.top, halfH), bottom: Math.min(over.bottom, halfH)};
      const {x: px, y: py} = battleFxClampCentre({cx: lx, cy: ly, halfW, halfH, art, over: limit});
      const amplitude = Math.min(viewport.width, viewport.height) * 0.022 * trauma * trauma;
      const sx = amplitude * shakeNoise(time, 1.7) + kickX, sy = amplitude * shakeNoise(time, 5.3) + kickY;
      const result = {zoom: total, x: viewport.width / 2 - total * px + sx, y: viewport.height / 2 - total * py + sy,
        centerX: px, centerY: py, punch, trauma, focused, framedSlots:framing.map(s=>s.slot),
        // While the lens pushes in, the box closes on the hit point with it, so the map clamp lets the
        // zoom through without a leap (it used to swap boxes in one frame).
        framingBox:withLens(frameBox), clampBox:withLens(clampBox), lens: lensK,
        // The focused subjects alone (null without a focus), for a caller's own close shot.
        focusBox: focusSet.length ? battleFxUnionBox(focusSet) : null};
      return boundedMap ? clampBattleCameraToMap({viewport,art,transform:result,box:result.framingBox,insets}) : Object.freeze(result);
    },
    getState: () => Object.freeze({zoom, cx, cy, punch, trauma, framing: {slots: [...held.slots], wide: held.wide, heldMs: Math.max(0, time - held.at), moving: boxMoving, resting: !chasing}, lens: lens ? {amount: lens.amount, age: lens.age, life: lens.life} : null,
      stages: stages.map(s => ({slots: s.slots ? [...s.slots] : null, boost: s.boost, endMs: s.endMs}))})
  });
}
