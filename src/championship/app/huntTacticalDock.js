// Hunt tactical dock gestures (Owner 2026-10-28, OWNER_APPROVED_ADAPTATION of
// presentation). The Hunt tool row is a floating glass dock: the rope keeps a
// fixed primary slot and the other tools ride a belt that scrolls sideways.
//
//   tap            selects the tool (the button's own click, unchanged)
//   sideways drag  scrolls the belt: native pan on touch, drag-to-scroll with
//                  a mouse or pen, and a vertical wheel turns the belt
//   drag up        on a lure or a trap, lifts the item off the belt; the field
//                  shows a landing ring and releasing over the ground places
//                  it there through the same tool path a tap on the field uses
//
// Input isolation: the dock owns its gestures. Moves and touches on it never
// propagate to the scene, a drag never ends as a click on the key it began
// on, and the field is only ever touched through `onDeploy`. Pointer-down is
// left to reach the document so the arcade key sound still plays; the field
// canvas is a sibling of the dock, never an ancestor, so it does not see it.
//
// No timers, no animation frames: positions follow pointer events only.

export const HUNT_DOCK_DEPLOY_DISTANCE = 18;
export const HUNT_DOCK_SCROLL_DISTANCE = 8;

/** Which belt label a tool wears. Keys are zh-Hant copy for uiText. */
export const HUNT_DOCK_TOOL_TAGS = Object.freeze({ HAND: "收取", ROPE: "主武", SHOT: "射擊", WIRE: "鋼索", ENTRAP: "誘餌", DAMAGE_TRAP: "陷阱" });
/** Tools placed on the ground with a tap: these can also be dragged onto the field. */
export const HUNT_DOCK_DEPLOY_TOOLS = Object.freeze(["ENTRAP", "DAMAGE_TRAP"]);
export function huntDockDeployable(toolId) { return HUNT_DOCK_DEPLOY_TOOLS.includes(toolId); }

export function mountHuntTacticalDock({
  dock, belt, layer, doc = dock?.ownerDocument ?? globalThis.document,
  isWide = () => false, enabled = () => true,
  canDeployAt = () => false, onDeployStart = () => {}, onDeployMove = () => {}, onDeploy = () => false, onDeployEnd = () => {}
} = {}) {
  if (!dock || !belt) throw new TypeError("HUNT_DOCK_REQUIRES_DOCK_AND_BELT");
  const life = new AbortController(), signal = life.signal;
  let press = null, suppressClick = false, ring = null, ghost = null;

  // ---- belt overflow: fade the edge that has more tools behind it ----------
  function refresh() {
    const max = belt.scrollWidth - belt.clientWidth;
    dock.dataset.overflowStart = String(belt.scrollLeft > 2);
    dock.dataset.overflowEnd = String(max - belt.scrollLeft > 2);
  }
  belt.addEventListener("scroll", refresh, { passive: true, signal });
  // A vertical wheel turns the belt when it can scroll; the page never moves.
  belt.addEventListener("wheel", event => {
    if (isWide() || Math.abs(event.deltaY) <= Math.abs(event.deltaX) || belt.scrollWidth <= belt.clientWidth) return;
    belt.scrollLeft += event.deltaY; event.preventDefault();
  }, { passive: false, signal });
  // A key reached with the keyboard slides fully into view.
  belt.addEventListener("focusin", event => { try { event.target?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); } catch { /* older engines */ } }, { signal });

  // ---- the landing ring and the lifted item --------------------------------
  function local(clientX, clientY) {
    const rect = layer.getBoundingClientRect(), scale = rect.width / (layer.offsetWidth || rect.width || 1) || 1;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }
  function showLift(button, clientX, clientY) {
    ring = doc.createElement("span"); ring.className = "cm-hunt-deploy-ring"; ring.setAttribute("aria-hidden", "true");
    ghost = doc.createElement("span"); ghost.className = "cm-hunt-deploy-ghost"; ghost.setAttribute("aria-hidden", "true");
    ghost.dataset.tool = button.dataset.tool ?? "";
    const icon = button.querySelector(".cm-hunt-tools__icon");
    if (icon?.getAttribute("src") && !icon.hidden) { const img = doc.createElement("img"); img.src = icon.getAttribute("src"); img.alt = ""; img.draggable = false; ghost.append(img); }
    else ghost.textContent = (button.querySelector(".cm-hunt-tools__name")?.textContent ?? "").slice(0, 2);
    layer.append(ring, ghost);
    moveLift(clientX, clientY);
  }
  function moveLift(clientX, clientY) {
    const point = local(clientX, clientY), valid = Boolean(canDeployAt(clientX, clientY));
    for (const node of [ring, ghost]) { node?.style.setProperty("--x", `${Math.round(point.x)}px`); node?.style.setProperty("--y", `${Math.round(point.y)}px`); }
    if (ring) ring.dataset.valid = String(valid);
    if (ghost) ghost.dataset.valid = String(valid);
    return valid;
  }
  function clearLift() { ring?.remove(); ghost?.remove(); ring = null; ghost = null; }

  // ---- one gesture at a time ------------------------------------------------
  function end(event, commit) {
    if (!press) return;
    const ended = press; press = null;
    try { if (ended.captured && ended.button.hasPointerCapture?.(ended.id)) ended.button.releasePointerCapture(ended.id); } catch { /* already released */ }
    delete dock.dataset.gesture;
    if (ended.mode === "deploy") {
      const valid = commit && moveLift(event.clientX, event.clientY);
      clearLift();
      const accepted = valid ? Boolean(onDeploy({ tool: ended.tool, clientX: event.clientX, clientY: event.clientY })) : false;
      onDeployEnd({ tool: ended.tool, placed: accepted, dropped: Boolean(commit) });
    }
    suppressClick = Boolean(commit) && (ended.mode === "deploy" || ended.mode === "scroll");
  }

  dock.addEventListener("pointerdown", event => {
    if (press || event.button > 0) return;
    const button = event.target?.closest?.("button[data-tool]");
    const onBelt = belt.contains(event.target);
    if (!button && !onBelt) return;
    suppressClick = false;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType, button, onBelt,
      tool: button?.dataset.tool ?? null, scroll: belt.scrollLeft, mode: "pending", captured: false };
  }, { signal });

  dock.addEventListener("pointermove", event => {
    if (!press || event.pointerId !== press.id) return;
    event.stopPropagation();
    const dx = event.clientX - press.x, dy = event.clientY - press.y;
    if (press.mode === "pending") {
      const lift = isWide() ? -dx >= HUNT_DOCK_DEPLOY_DISTANCE && -dx > Math.abs(dy) : -dy >= HUNT_DOCK_DEPLOY_DISTANCE && -dy > Math.abs(dx);
      if (lift && press.button && !press.button.disabled && huntDockDeployable(press.tool) && enabled()) {
        press.mode = "deploy"; dock.dataset.gesture = "deploy";
        try { press.button.setPointerCapture(press.id); press.captured = true; } catch { /* the pointer is gone */ }
        onDeployStart({ tool: press.tool });
        showLift(press.button, event.clientX, event.clientY);
        onDeployMove({ tool: press.tool, valid: moveLift(event.clientX, event.clientY) });
        return;
      }
      if (press.onBelt && !isWide() && Math.abs(dx) >= HUNT_DOCK_SCROLL_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        press.mode = "scroll"; dock.dataset.gesture = "scroll";
        // Touch pans natively (touch-action: pan-x); a mouse or pen drags the belt here.
        if (press.type !== "touch") { try { (press.button ?? belt).setPointerCapture(press.id); press.captured = true; } catch { /* gone */ } }
      }
    }
    if (press.mode === "scroll" && press.type !== "touch") { belt.scrollLeft = press.scroll - dx; event.preventDefault(); }
    if (press.mode === "deploy") { event.preventDefault(); onDeployMove({ tool: press.tool, valid: moveLift(event.clientX, event.clientY) }); }
  }, { signal });

  dock.addEventListener("pointerup", event => { if (press && event.pointerId === press.id) end(event, true); }, { signal });
  // A native pan takes the pointer: that is the belt scrolling, not a tap.
  dock.addEventListener("pointercancel", event => { if (press && event.pointerId === press.id) end(event, false); }, { signal });
  dock.addEventListener("lostpointercapture", event => { if (press?.mode === "deploy" && event.pointerId === press.id) end(event, false); }, { signal });
  // A drag never ends as a click on the key it began on.
  dock.addEventListener("click", event => {
    if (!suppressClick) return;
    suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
  }, { capture: true, signal });
  // Touches on the dock stay in the dock; a lift stops the page from panning.
  dock.addEventListener("touchstart", event => event.stopPropagation(), { passive: true, signal });
  dock.addEventListener("touchmove", event => { event.stopPropagation(); if (press?.mode === "deploy" && event.cancelable) event.preventDefault(); }, { passive: false, signal });
  dock.addEventListener("contextmenu", event => { if (press?.mode === "deploy") event.preventDefault(); }, { signal });
  doc.addEventListener?.("keydown", event => { if (event.key === "Escape" && press?.mode === "deploy") end(event, false); }, { signal });
  doc.defaultView?.addEventListener?.("resize", refresh, { signal });

  refresh();
  return Object.freeze({
    refresh,
    get gesture() { return press?.mode ?? null; },
    dispose() { if (press) end({ clientX: press.x, clientY: press.y }, false); life.abort(); clearLift(); }
  });
}
