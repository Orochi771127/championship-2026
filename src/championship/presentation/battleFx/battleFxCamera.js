// Dynamic battle presentation -- the camera director.
//
// OWNER_APPROVED_ADAPTATION 2026-10-12. Pure presentation maths over the
// scene's existing layout coordinates ("local": the arena contain-fit at zoom
// 1). The director only returns a world transform for the existing Pixi world
// container; it never moves a combatant, so stand positions, collision and the
// battle clock are untouched. It advances on the presentation's elapsed time
// handed in by the scene (the one Pixi ticker), never on its own clock.
//
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
 * The shot for one framing box: zoom and centre, clamped so the visible region
 * never leaves the arena. `art` is the arena rectangle in local coordinates.
 */
export function battleFxFrameShot({viewport, art, box, maxZoomFactor = 1.75, boost = 0, responsiveLayout = false}) {
  const cover = Math.max(viewport.width / art.width, viewport.height / art.height);
  const maxZoom = cover * maxZoomFactor;
  let minimumZoom = cover;
  let zoom = cover, cx = art.x + art.width / 2, cy = art.y + art.height / 2, want = null;
  if (box) {
    const width = Math.max(1, box.right - box.left), height = Math.max(1, box.bottom - box.top);
    // Room for the overhead bars and words above, and the shadow below.
    const padX = width * 0.12 + 16, padTop = height * 0.12 + 28, padBottom = height * 0.08 + 12;
    const fit = Math.min(viewport.width / (width + padX * 2), viewport.height / (height + padTop + padBottom));
    // The wide host must fit the selected action, even when arena cover would
    // cut off a tall group. Mirrored floor continuation remains presentation.
    if (responsiveLayout) minimumZoom = Math.min(cover, fit);
    zoom = clamp(fit * (1 + boost), minimumZoom, maxZoom);
    want = {left: box.left - padX, right: box.right + padX, top: box.top - padTop, bottom: box.bottom + padBottom};
    cx = (want.left + want.right) / 2;
    cy = (want.top + want.bottom) / 2;
  }
  const place = z => {
    const halfW = viewport.width / (2 * z), halfH = viewport.height / (2 * z);
    // The original's movement can carry fighters past the arena picture; the
    // shot follows them there (the scene continues the floor with mirrored
    // arena copies). Without that need the arena fills the frame.
    const over = {
      left: want ? Math.min(Math.max(0, art.x - want.left), halfW) : 0,
      right: want ? Math.min(Math.max(0, want.right - art.x - art.width), halfW) : 0,
      top: want ? Math.min(Math.max(0, art.y - want.top), halfH) : 0,
      bottom: want ? Math.min(Math.max(0, want.bottom - art.y - art.height), halfH) : 0
    };
    return {...battleFxClampCentre({cx, cy, halfW, halfH, art, over}), halfW, halfH, over};
  };
  let placed = place(zoom);
  // Near an edge the clamp moves the centre off the fighters; back the zoom
  // off (never below cover) until the framed group is inside the shot again.
  for (let i = 0; box && i < 12 && zoom > minimumZoom; i++) {
    const inside = box.left >= placed.x - placed.halfW && box.right <= placed.x + placed.halfW
      && box.top - 18 >= placed.y - placed.halfH && box.bottom <= placed.y + placed.halfH;
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

// Smooth, deterministic noise for shake (no Math.random on the ticker).
function shakeNoise(t, seed) {
  return Math.sin(t * 0.037 + seed) * 0.55 + Math.sin(t * 0.061 + seed * 2.3) * 0.3 + Math.sin(t * 0.113 + seed * 4.1) * 0.15;
}

export function createBattleFxCamera({reducedMotion = false, responsiveLayout = false} = {}) {
  let zoom = null, cx = 0, cy = 0, over = {left: 0, right: 0, top: 0, bottom: 0};
  let punch = 0, trauma = 0, time = 0;
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
    if (reducedMotion || !Array.isArray(list) || !list.length) return;
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
    punch(amount) { if (!reducedMotion) punch = Math.min(0.14, punch + amount); },
    /** Trauma in 0..1; displacement grows with its square. */
    shake(amount) { if (!reducedMotion) trauma = Math.min(1, trauma + amount); },
    /** A burst of ordinary hits gets one camera response; a heavy hit can override it. */
    impact(tier) {
      const strength = tier === 'heavy' ? 2 : tier === 'medium' ? 1 : 0;
      if (reducedMotion || !strength || (time - lastImpact < 180 && strength <= lastImpactStrength)) return false;
      lastImpact = time; lastImpactStrength = strength;
      punch = Math.min(0.14, punch + (strength === 2 ? 0.07 : 0.035));
      trauma = Math.min(1, trauma + (strength === 2 ? 0.5 : 0.22));
      return true;
    },
    /** points are live projectiles: the shot follows a move to its target. */
    update({dtMs = 16.7, viewport, art, subjects, points = []}) {
      time += Math.max(0, dtMs);
      const stage = current();
      const standing = subjects.filter(s => s && !s.down);
      let framing = stage?.slots ? subjects.filter(s => s && stage.slots.has(s.slot) && (stage.includeDown || !s.down)) : [];
      const focused = framing.map(s => s.slot);
      if (!framing.length) framing = standing.length ? standing : subjects.filter(Boolean);
      // A close push-in on one fighter holds; otherwise a live shot widens the frame to its path.
      const follow = stage && stage.boost >= 0.3 ? [] : points.map(p => ({left: p.x - 12, right: p.x + 12, top: p.y - 12, bottom: p.y + 12}));
      const shot = battleFxFrameShot({viewport, art, box: battleFxUnionBox([...framing, ...follow]),
        // An ordinary shot stays within 1.7x cover; a staged push-in may reach 2.3x.
        boost: focused.length ? stage.boost : 0, responsiveLayout, maxZoomFactor: reducedMotion ? 1.3 : focused.length ? 2.3 : 1.7});
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
      punch *= 1 - battleFxApproach(dtMs, 140);
      trauma = Math.max(0, trauma - dtMs / 1000 * 1.9);
      const total = zoom * (1 + punch);
      // Re-clamp after the punch so a punched frame looks no further past an
      // arena edge than the shot needed.
      const halfW = viewport.width / (2 * total), halfH = viewport.height / (2 * total);
      const limit = {left: Math.min(over.left, halfW), right: Math.min(over.right, halfW),
        top: Math.min(over.top, halfH), bottom: Math.min(over.bottom, halfH)};
      const {x: px, y: py} = battleFxClampCentre({cx, cy, halfW, halfH, art, over: limit});
      const amplitude = Math.min(viewport.width, viewport.height) * 0.022 * trauma * trauma;
      const sx = amplitude * shakeNoise(time, 1.7), sy = amplitude * shakeNoise(time, 5.3);
      return Object.freeze({zoom: total, x: viewport.width / 2 - total * px + sx, y: viewport.height / 2 - total * py + sy,
        centerX: px, centerY: py, punch, trauma, focused});
    },
    getState: () => Object.freeze({zoom, cx, cy, punch, trauma,
      stages: stages.map(s => ({slots: s.slots ? [...s.slots] : null, boost: s.boost, endMs: s.endMs}))})
  });
}
