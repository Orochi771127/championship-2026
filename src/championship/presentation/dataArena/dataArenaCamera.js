// Data Arena -- follow camera (pure presentation maths).
//
// Reuses the battle director's exponential approach (battleFxApproach) and
// arena-edge clamp (battleFxClampCentre) instead of a second easing model.
// It never moves a body: it returns a world transform for the scene's world
// container, advanced on the one Pixi ticker's elapsed time.
//
//  * smooth follow with velocity look-ahead and a small lean toward the aim;
//  * the player is kept inside a safe inner box whatever the smoothing lag;
//  * the view is clamped to the harbor, centred when the harbor is smaller;
//  * gentle dynamic zoom: wider while threats crowd in or the guardian is up;
//  * duel framing: with an opponent given, centre between the two (biased to the
//    player) and widen just enough that both stay on screen;
//  * trauma shake for close impacts, off with reduced motion or "shake off".

import { battleFxApproach, battleFxClampCentre } from "../battleFx/battleFxCamera.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Base zoom: about 1150 x 700 world px of view area, never narrower than 560 px. */
export function dataArenaBaseZoom(viewportWidth, viewportHeight) {
  const area = Math.sqrt((viewportWidth * viewportHeight) / (1150 * 700));
  return clamp(Math.min(area, viewportWidth / 560), 0.42, 1.6);
}

export function createDataArenaCamera({ worldWidth, worldHeight, reducedMotion = false, shake = true, cover = false, artBounds = null } = {}) {
  let x = worldWidth / 2, y = worldHeight / 2, zoom = null, trauma = 0, time = 0;
  let shakeEnabled = Boolean(shake) && !reducedMotion;
  return Object.freeze({
    setShake(enabled) { shakeEnabled = Boolean(enabled) && !reducedMotion; if (!shakeEnabled) trauma = 0; },
    /** Trauma in 0..1; displacement grows with its square. */
    addTrauma(amount) { if (shakeEnabled) trauma = Math.min(1, trauma + amount); },
    snap(targetX, targetY) { x = targetX; y = targetY; },
    update({ dtMs, viewport, target, velocity = { x: 0, y: 0 }, aim = null, threat = 0, opponent = null }) {
      time += Math.max(0, dtMs);
      const base = dataArenaBaseZoom(viewport.width, viewport.height);
      let wanted = base * (1 - 0.14 * clamp(threat, 0, 1));
      let focusX = target.x, focusY = target.y;
      if (opponent) {
        // HUD chrome takes ~150 px at the top and ~90 px at the bottom; leave room for both bodies.
        const dx = Math.abs(opponent.x - target.x), dy = Math.abs(opponent.y - target.y);
        const fit = Math.min(viewport.width / (dx + 320), (viewport.height - 250) / (dy + 240));
        wanted = clamp(Math.min(wanted, fit), Math.max(0.42, base * 0.42), wanted);
        // Centre the pair in the band between the top HUD (rival bar) and the bottom kit bar.
        const z = zoom ?? wanted;
        focusX = target.x + (opponent.x - target.x) * 0.42; focusY = target.y + (opponent.y - target.y) * 0.42 - 55 / z; // tall sprites (the champion) clear the rival bar
      }
      if(cover)wanted=Math.max(wanted,viewport.width/worldWidth,viewport.height/worldHeight);
      if (zoom === null) zoom = wanted;
      else zoom += (wanted - zoom) * battleFxApproach(dtMs, reducedMotion ? 1400 : 650);
      if(cover)zoom=Math.max(zoom,viewport.width/worldWidth,viewport.height/worldHeight);
      const look = (reducedMotion ? 0.18 : 0.32) * (opponent ? 0.4 : 1);
      let lx = clamp(velocity.x * look, -170, 170), ly = clamp(velocity.y * look, -130, 130);
      if (aim && !opponent) { lx += clamp((aim.x - target.x) * 0.16, -110, 110); ly += clamp((aim.y - target.y) * 0.16, -90, 90); }
      const k = battleFxApproach(dtMs, reducedMotion ? 260 : 140);
      x += (focusX + lx - x) * k; y += (focusY + ly - y) * k;
      const halfW = viewport.width / (2 * zoom), halfH = viewport.height / (2 * zoom);
      // Keep the player well inside the frame even when the follow lags a dash.
      const boxW = halfW * 0.62, boxH = halfH * 0.58;
      x = clamp(x, target.x - boxW, target.x + boxW); y = clamp(y, target.y - boxH, target.y + boxH);
      const placed = battleFxClampCentre({ cx: x, cy: y, halfW, halfH, art: artBounds ?? { x: 0, y: 0, width: worldWidth, height: worldHeight } });
      x = placed.x; y = placed.y;
      // In a duel the bottom kit bar must never cover the player at the arena's south
      // edge: past the floor clamp, nudge the view down just enough (at most the bar).
      if (opponent && !cover) y = Math.min(placed.y + 110 / zoom, Math.max(y, target.y - (halfH - 110 / zoom)));
      trauma = Math.max(0, trauma - (dtMs / 1000) * 1.6);
      const amplitude = shakeEnabled ? Math.min(viewport.width, viewport.height) * 0.018 * trauma * trauma : 0;
      const sx = amplitude * Math.sin(time * 0.047 + 1.3), sy = amplitude * Math.sin(time * 0.071 + 4.1);
      return Object.freeze({ zoom, x: viewport.width / 2 - zoom * x + sx, y: viewport.height / 2 - zoom * y + sy,
        centerX: x, centerY: y, halfW, halfH, trauma });
    }
  });
}
