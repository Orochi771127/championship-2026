// Burst key presses -- OWNER_APPROVED_ADAPTATION 2026-11-09 (AWAKENING_OVERDRIVE_20261109).
//
// One burst key, two calls: a tap is the standard burst; holding it for holdMs (the key fills while held) or
// tapping twice within doubleTapMs calls the over-limit burst. A single tap waits doubleTapMs for a second one
// before it calls the standard burst. Enter / Space behave the same (hold the key for the over-limit burst).
// DOM only: the caller decides what each call does.
export function bindOverLimitPress(button, { holdMs, doubleTapMs, onStandard, onOverLimit, ready = () => true }) {
  let holdTimer = null, tapTimer = null, held = false, pressing = false;
  const clear = () => { clearTimeout(holdTimer); holdTimer = null; button.classList.remove("is-charging"); };
  const fire = (call) => { clearTimeout(tapTimer); tapTimer = null; clear(); call(); };
  function press() {
    if (pressing || !ready()) return;
    pressing = true; held = false;
    button.style.setProperty("--hold-ms", `${holdMs}ms`);
    button.classList.add("is-charging");
    holdTimer = setTimeout(() => { held = true; fire(onOverLimit); }, holdMs);
  }
  function release() {
    if (!pressing) return;
    pressing = false;
    if (held) return;
    clear();
    if (!ready()) return;
    if (tapTimer) { fire(onOverLimit); return; }
    tapTimer = setTimeout(() => { tapTimer = null; onStandard(); }, doubleTapMs);
  }
  const cancel = () => { if (pressing && !held) { pressing = false; clear(); } };
  const down = (event) => {
    if (event.button > 0) return;
    event.preventDefault();
    try { button.setPointerCapture?.(event.pointerId); } catch { /* a pointer the browser no longer tracks: the press still counts */ }
    press();
  };
  const key = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.type === "keydown") { if (!event.repeat) press(); } else release();
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", cancel);
  button.addEventListener("keydown", key);
  button.addEventListener("keyup", key);
  return () => {
    clear(); clearTimeout(tapTimer);
    button.removeEventListener("pointerdown", down); button.removeEventListener("pointerup", release);
    button.removeEventListener("pointercancel", cancel); button.removeEventListener("keydown", key); button.removeEventListener("keyup", key);
  };
}
