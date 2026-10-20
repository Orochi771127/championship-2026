// Raising-only presentation input. No save, gameplay clock or actor state.
export const RAISING_OVERVIEW_ZOOM = 0.7;
export const RAISING_PINCH_THRESHOLD = 0.18;

export function pinchZoomLevel(level, ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return level;
  if (level === 1 && ratio <= 1 - RAISING_PINCH_THRESHOLD) return RAISING_OVERVIEW_ZOOM;
  if (level === RAISING_OVERVIEW_ZOOM && ratio >= 1 + RAISING_PINCH_THRESHOLD) return 1;
  return level;
}

export function bindRaisingZoomInput({canvas, window: win = globalThis, getViewport, getLevel, setLevel, cancelGesture, enabled}) {
  const points = new Map();
  let pinch = null, swallowing = false, wheelAt = -Infinity, wheelSum = 0, wheelUsed = false;
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
        pinch = {...pair(),level:getLevel(),used:false};
      }
      swallowing = true; stop(e);
    }
  };
  const move = e => {
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId,local(e));
    if (!swallowing) return;
    stop(e);
    if (points.size !== 2 || !pinch || pinch.used || !enabled()) return;
    const current=pair(), level=pinchZoomLevel(pinch.level,current.distance/Math.max(1,pinch.distance));
    if (level !== pinch.level) {pinch.used=true;setLevel(level,current.point);}
  };
  const up = e => {
    if (!points.has(e.pointerId)) return;
    points.delete(e.pointerId);
    if (swallowing) stop(e);
    if (!points.size) {pinch=null;swallowing=false;}
  };
  const wheel = e => {
    if (!enabled() || swallowing || e.ctrlKey || e.metaKey) return;
    // Leave browser page zoom alone. One deliberate wheel burst changes one
    // level, including high-resolution trackpads; jitter has a dead zone.
    e.preventDefault();
    if (e.timeStamp-wheelAt>220) {wheelSum=0;wheelUsed=false;}
    wheelAt=e.timeStamp;
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
    if (Math.sign(delta)!==Math.sign(wheelSum)) wheelSum=0;
    wheelSum+=delta;
    if (!wheelUsed&&Math.abs(wheelSum)>=40) {
      wheelUsed=true;cancelGesture();setLevel(wheelSum>0?RAISING_OVERVIEW_ZOOM:1,local(e));
    }
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
