// Raising-only presentation input. No save, gameplay clock or actor state.
// Owner 2026-11-01: no on-screen button. The ranch zooms smoothly with two
// fingers (phone) or the mouse wheel (desktop), from 100% out to 50% so more
// of the ranch fits on screen.
import {RAISING_ZOOM_MIN, RAISING_ZOOM_MAX, clampRaisingZoom} from './raisingFieldViewport.js';
export {RAISING_ZOOM_MIN, RAISING_ZOOM_MAX, clampRaisingZoom};
// Fingers must move this much (as a distance ratio) before a pinch starts
// zooming, so a two-finger tap does not jitter the board.
export const RAISING_PINCH_DEAD_ZONE = 0.04;
// Wheel: zoom factor per pixel of wheel delta (100 px is about 14%).
const WHEEL_RATE = 0.0015;

/** Continuous pinch: the board follows the finger distance from where the pinch started. */
export function pinchZoomLevel(startLevel, ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return startLevel;
  return clampRaisingZoom(startLevel * ratio);
}

export function wheelZoomLevel(level, deltaPx) {
  return clampRaisingZoom(level * Math.exp(-deltaPx * WHEEL_RATE));
}

export function bindRaisingZoomInput({canvas, window: win = globalThis, getViewport, getLevel, setLevel, cancelGesture, enabled}) {
  const points = new Map();
  let pinch = null, swallowing = false;
  const local = e => {
    const rect = canvas.getBoundingClientRect();
    const size=getViewport?.();
    return {x:(e.clientX-rect.left)*(size?size.width/rect.width:1),
      y:(e.clientY-rect.top)*(size?size.height/rect.height:1)};
  };
  const pair = () => {
    const [a,b] = [...points.values()];
    return {distance:Math.hypot(a.x-b.x,a.y-b.y), point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  };
  const stop = e => {e.preventDefault();e.stopImmediatePropagation();};
  const down = e => {
    if (e.pointerType !== 'touch' || !enabled()) return;
    points.set(e.pointerId, local(e));
    if (points.size >= 2) {
      if (!swallowing) {
        cancelGesture();
        pinch = {...pair(),level:getLevel(),started:false};
      }
      swallowing = true; stop(e);
    }
  };
  const move = e => {
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId,local(e));
    if (!swallowing) return;
    stop(e);
    if (points.size !== 2 || !pinch || !enabled()) return;
    const current=pair(), ratio=current.distance/Math.max(1,pinch.distance);
    if (!pinch.started && Math.abs(ratio-1) < RAISING_PINCH_DEAD_ZONE) return;
    pinch.started=true;
    const level=pinchZoomLevel(pinch.level,ratio);
    if (Math.abs(level-getLevel())>1e-4) setLevel(level,current.point);
  };
  const up = e => {
    if (!points.has(e.pointerId)) return;
    points.delete(e.pointerId);
    if (swallowing) stop(e);
    if (!points.size) {pinch=null;swallowing=false;}
  };
  const wheel = e => {
    if (!enabled() || swallowing || e.ctrlKey || e.metaKey) return;
    // Leave browser page zoom (ctrl/meta + wheel) alone.
    e.preventDefault();
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
    const level=wheelZoomLevel(getLevel(),delta);
    if (Math.abs(level-getLevel())>1e-4) {cancelGesture();setLevel(level,local(e));}
  };
  const clear = () => {points.clear();pinch=null;swallowing=false;};
  const opts={capture:true,passive:false};
  canvas.addEventListener('pointerdown',down,opts);
  win.addEventListener('pointermove',move,opts);
  win.addEventListener('pointerup',up,opts);
  win.addEventListener('pointercancel',up,opts);
  canvas.addEventListener('wheel',wheel,{passive:false});
  win.addEventListener('blur',clear);
  return {
    isActive:()=>swallowing,
    reset:clear,
    dispose(){
      clear();canvas.removeEventListener('pointerdown',down,true);
      win.removeEventListener('pointermove',move,true);win.removeEventListener('pointerup',up,true);
      win.removeEventListener('pointercancel',up,true);canvas.removeEventListener('wheel',wheel);
      win.removeEventListener('blur',clear);
    }
  };
}
