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

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

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
  const top = clamp(Number(insets?.top) || 0, 0, viewport.height * 0.45);
  const bottom = clamp(Number(insets?.bottom) || 0, 0, viewport.height * 0.45);
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
  // Directional kick (Owner 2026-11-03): a hit nudges the shot along the blow, then settles in ~220 ms.
  let kickX = 0, kickY = 0;
  // Slow motion on a signature hit or the final knockout: playback pacing only.
  let slowMs = 0;
  // Signature-hit lens (VFX_FIVE_LAYER_20261101): a short push toward the hit point.
  let lens = null;
  let lastImpact = -Infinity, lastImpactStrength = 0;
  let previousViewport = null;
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
      if (fullArena || reducedMotion || !strength || (time - lastImpact < 180 && strength <= lastImpactStrength)) return false;
      lastImpact = time; lastImpactStrength = strength;
      // An exchange pushes the shot in by about 8 % toward the contact.
      punch = Math.min(0.14, punch + (strength === 2 ? 0.1 : 0.08));
      trauma = Math.min(1, trauma + (strength === 2 ? 0.45 : 0.18));
      const sign = Math.sign(direction);
      if (sign) { kickX = sign * (strength === 2 ? 7 : 4); kickY = strength === 2 ? 2 : 1; }
      return true;
    },
    /**
     * Slow the presentation's playback to 35 % for `ms` (signature hit, final K.O.).
     * The scene paces its frame steps by timeScale(); every frame still runs.
     */
    slowMo(ms = 180) { if (!fullArena && !reducedMotion) slowMs = Math.max(slowMs, Math.min(400, ms)); },
    timeScale: () => slowMs > 0 ? 0.35 : 1,
    /** points are live projectiles: the shot follows a move to its target. */
    update({dtMs = 16.7, viewport, art, subjects, points = [], insets = null}) {
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
      if (framing.length && boundedMap && insets) framing = [...new Set([...framing, ...standing])];
      if (!framing.length) {
        framing = standing.length ? standing : cameraSubjects.filter(Boolean);
        if (boundedMap && framing.length > 2) {
          const all = battleFxUnionBox(framing), cover = roomCover;
          // When scattered groups cannot share the frame, follow the active
          // engagement or nearest opposing pair. Other actors keep real positions.
          if (all && ((all.right-all.left)*cover>viewport.width || (all.bottom-all.top)*cover>safe.height)) {
            let pair = null, score = Infinity;
            for (const a of standing) for (const b of standing) if (a.slot<b.slot && a.team!==b.team) {
              const distance = Math.hypot((a.left+a.right-b.left-b.right)/2, a.bottom-b.bottom)
                + (a.engaged||b.engaged ? 0 : art.width+art.height);
              if (distance<score) {score=distance;pair=[a,b];}
            }
            if (pair) framing=pair;
          }
        }
      }
      if(boundedMap&&framing.length>1){
        const tooBig=list=>{const group=battleFxUnionBox(list);return group&&((group.right-group.left)*roomCover>viewport.width || (group.bottom-group.top)*roomCover>safe.height);};
        if(tooBig(framing)&&focusSet.length&&focusSet.length<framing.length)framing=focusSet;
        if(framing.length>1&&tooBig(framing))framing=[framing.find(s=>s.engaged)??framing[0]];
      }
      // A close push-in on one fighter holds; otherwise a live shot widens the frame to its path.
      const follow = stage && stage.boost >= 0.3 ? [] : points.map(p => ({left: p.x - 12, right: p.x + 12, top: p.y - 12, bottom: p.y + 12}));
      const shot = battleFxFrameShot({viewport, art, box: battleFxUnionBox([...framing, ...follow]),
        // An ordinary shot stays within 1.7x cover; a staged push-in may reach 2.3x.
        boost: focused.length ? stage.boost : 0, responsiveLayout, boundedMap, insets: boundedMap ? insets : null,
        // The wide cover shot gains room for a staged push-in (a move, a knockout).
        maxZoomFactor: wideCover ? (focused.length && stage.boost > 0 ? 1.05 + stage.boost : 1.05) : reducedMotion ? 1.3 : focused.length ? 2.3 : 1.7});
      const resized = responsiveLayout && previousViewport !== null
        && (previousViewport.width !== viewport.width || previousViewport.height !== viewport.height);
      previousViewport = {width:viewport.width, height:viewport.height};
      // Reframe on the existing resize draw, without advancing shot time or
      // replacing the director. No tween from stale screen geometry.
      if (resized || (zoom === null && responsiveLayout) || (zoom === null && reducedMotion)) {
        zoom = shot.zoom; cx = shot.cx; cy = shot.cy; over = {...shot.over};
      } else if (zoom === null) {
        // Open on the whole arena, then push in: the first frames are the wide shot.
        zoom = shot.cover; cx = art.x + art.width / 2; cy = art.y + art.height / 2;
      } else if (dtMs > 0) {
        zoom += (shot.zoom - zoom) * battleFxApproach(dtMs, reducedMotion ? 900 : 320);
        const pan = battleFxApproach(dtMs, reducedMotion ? 700 : 230);
        cx += (shot.cx - cx) * pan; cy += (shot.cy - cy) * pan;
        for (const side of ['left', 'right', 'top', 'bottom']) over[side] += (shot.over[side] - over[side]) * pan;
      }
      punch *= 1 - battleFxApproach(dtMs, 110);
      const settle = 1 - battleFxApproach(dtMs, 70);
      kickX *= settle; kickY *= settle;
      trauma = Math.max(0, trauma - dtMs / 1000 * 1.9);
      if (boundedMap) zoom = Math.max(shot.cover, zoom);
      let lensK = 0;
      if (lens) {
        lens.age += Math.max(0, dtMs);
        const k = lens.age / lens.life;
        lensK = k >= 1 ? 0 : k < 0.3 ? Math.sin(k / 0.3 * Math.PI / 2) : Math.cos((k - 0.3) / 0.7 * Math.PI / 2);
        if (k >= 1) lens = null;
      }
      const total = zoom * (1 + punch) * (1 + (lens ? lens.amount * lensK : 0));
      // The lens biases this frame's centre only; the tweened centre is untouched.
      const lx = lensK > 0 ? cx + (lens.x - cx) * 0.4 * lensK : cx, ly = lensK > 0 ? cy + (lens.y - cy) * 0.4 * lensK : cy;
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
        // While the lens pushes in, frame the hit point so the map clamp lets the zoom through.
        framingBox:lensK > 0 ? {left: lens.x - 24, right: lens.x + 24, top: lens.y - 40, bottom: lens.y + 24} : battleFxUnionBox(framing), lens: lensK,
        // The focused subjects alone (null without a focus), for a caller's own close shot.
        focusBox: focusSet.length ? battleFxUnionBox(focusSet) : null};
      return boundedMap ? clampBattleCameraToMap({viewport,art,transform:result,box:result.framingBox,insets}) : Object.freeze(result);
    },
    getState: () => Object.freeze({zoom, cx, cy, punch, trauma, lens: lens ? {amount: lens.amount, age: lens.age, life: lens.life} : null,
      stages: stages.map(s => ({slots: s.slots ? [...s.slots] : null, boost: s.boost, endMs: s.endMs}))})
  });
}
