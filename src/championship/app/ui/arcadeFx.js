// Arcade UI motion and sound (Owner 2026-10-26): every press, card, sheet and result
// gets the arcade rebuild's synthesized sound and screen-space juice.
//
// Sound: the rebuild's SoundEngine voices (cyber-partner-arcade src/core/sound.js),
// synthesized from oscillators and a noise burst, played through the product audio
// bus's sfx category so mute, master and sfx volume apply. Nothing is decoded from a
// file; a cue that cannot play is silent rather than queued.
//
// Juice: one fixed, click-through canvas of pixel particles, floating numbers,
// stepped shake, toasts, squash-and-stretch and 3D card tilt. Particles animate in a
// requestAnimationFrame loop that runs only while particles are alive; it is
// presentation-only and never touches simulation, input or the Pixi ticker.
//
// Screens ask for a result effect with one DOM event, so no game module imports this:
//   target.dispatchEvent(new CustomEvent("cm-fx", { bubbles: true, detail: { kind, text } }))
// kinds: purchase · denied · snap · unsnap · open · close · toggle · sparkle · levelup · shutter

const INK = "#14141f";

// ---------------------------------------------------------------- sound

export class ArcadeSound {
  constructor(getOutput) {
    this.getOutput = getOutput;
    this.noiseBuffers = new WeakMap();
    this.lastHoverAt = -Infinity;
  }
  /** The bus output when it can play right now, else null. */
  out() {
    const output = this.getOutput?.();
    const context = output?.context;
    return context && output.destination && context.state === "running" ? output : null;
  }
  noiseBuffer(context) {
    let buffer = this.noiseBuffers.get(context);
    if (!buffer) {
      buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate)), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffers.set(context, buffer);
    }
    return buffer;
  }
  tone(o, { type = "square", f0, f1 = f0, dur, gain = 0.2, delay = 0, attack = 0.002, sweep = "exp" }) {
    const ctx = o.context, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (sweep === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else osc.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }
  noise(o, { dur, gain = 0.2, delay = 0, filter = "bandpass", f0 = 1200, f1 = f0, q = 1 }) {
    const ctx = o.context, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const biq = ctx.createBiquadFilter();
    biq.type = filter;
    biq.Q.value = q;
    biq.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) biq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biq).connect(g).connect(o.destination);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }
  /** Play one named cue; false when it could not play. */
  play(name, arg) {
    const o = this.out();
    const voice = ARCADE_CUES[name];
    if (!o || !voice) return false;
    if (name === "hover") {
      const now = globalThis.performance?.now?.() ?? Date.now();
      if (now - this.lastHoverAt < 45) return false;
      this.lastHoverAt = now;
    }
    voice(this, o, arg);
    return true;
  }
}

/** The rebuild's voices, unchanged in pitch, length and gain. */
export const ARCADE_CUES = Object.freeze({
  hover: (s, o) => s.tone(o, { type: "triangle", f0: 900, f1: 1300, dur: 0.025, gain: 0.16, attack: 0.001 }),
  click: (s, o) => {
    s.tone(o, { type: "square", f0: 320, f1: 90, dur: 0.075, gain: 0.13 });
    s.tone(o, { type: "triangle", f0: 320, f1: 90, dur: 0.075, gain: 0.3 });
    s.noise(o, { dur: 0.018, gain: 0.12, filter: "highpass", f0: 3000 });
  },
  snap: (s, o) => {
    s.tone(o, { type: "square", f0: 220, f1: 200, dur: 0.042, gain: 0.16 });
    s.tone(o, { type: "triangle", f0: 220, dur: 0.042, gain: 0.22 });
    s.tone(o, { type: "square", f0: 440, f1: 430, dur: 0.048, gain: 0.14, delay: 0.042 });
    s.tone(o, { type: "triangle", f0: 440, dur: 0.048, gain: 0.2, delay: 0.042 });
    s.noise(o, { dur: 0.03, gain: 0.18, filter: "bandpass", f0: 2400, q: 2 });
    s.noise(o, { dur: 0.05, gain: 0.12, filter: "lowpass", f0: 500, delay: 0.04 });
  },
  unsnap: (s, o) => {
    s.tone(o, { type: "square", f0: 440, f1: 380, dur: 0.04, gain: 0.12 });
    s.tone(o, { type: "triangle", f0: 220, f1: 150, dur: 0.06, gain: 0.22, delay: 0.04 });
    s.noise(o, { dur: 0.08, gain: 0.16, filter: "lowpass", f0: 900, f1: 200 });
  },
  burst: (s, o, delay = 0) => {
    s.noise(o, { dur: 0.7, gain: 0.45, filter: "lowpass", f0: 6000, f1: 120, delay });
    s.tone(o, { type: "sine", f0: 140, f1: 38, dur: 0.6, gain: 0.55, delay });
    for (const f of [1047, 1319, 1568, 2093]) s.tone(o, { type: "triangle", f0: f, dur: 0.9, gain: 0.07, delay: delay + 0.02 });
  },
  hit: (s, o) => {
    s.noise(o, { dur: 0.11, gain: 0.4, filter: "lowpass", f0: 2600, f1: 300 });
    s.tone(o, { type: "square", f0: 190, f1: 55, dur: 0.12, gain: 0.2 });
  },
  crit: (s, o) => {
    ARCADE_CUES.hit(s, o);
    s.noise(o, { dur: 0.25, gain: 0.3, filter: "bandpass", f0: 4000, f1: 800, q: 1.4, delay: 0.02 });
    s.tone(o, { type: "square", f0: 1568, f1: 2093, dur: 0.12, gain: 0.09, delay: 0.05 });
    s.tone(o, { type: "sine", f0: 90, f1: 32, dur: 0.35, gain: 0.5 });
  },
  chirp: (s, o, pitch = 1) => {
    const p = pitch * (0.94 + Math.random() * 0.12);
    s.tone(o, { type: "triangle", f0: 620 * p, f1: 1180 * p, dur: 0.09, gain: 0.22 });
    s.tone(o, { type: "square", f0: 1180 * p, f1: 760 * p, dur: 0.11, gain: 0.07, delay: 0.085 });
    s.tone(o, { type: "sine", f0: 900 * p, f1: 1400 * p, dur: 0.07, gain: 0.15, delay: 0.17 });
  },
  whoosh: (s, o) => s.noise(o, { dur: 0.16, gain: 0.2, filter: "bandpass", f0: 600, f1: 3200, q: 1.5 }),
  sparkle: (s, o) => [2093, 2637, 3136].forEach((f, i) => s.tone(o, { type: "triangle", f0: f, dur: 0.12, gain: 0.08, delay: i * 0.05 })),
  levelup: (s, o) => [523, 659, 784, 1047].forEach((f, i) => {
    s.tone(o, { type: "square", f0: f, dur: 0.1, gain: 0.08, delay: i * 0.07 });
    s.tone(o, { type: "triangle", f0: f, dur: 0.14, gain: 0.14, delay: i * 0.07 });
  }),
  card: (s, o) => {
    s.noise(o, { dur: 0.09, gain: 0.14, filter: "highpass", f0: 2500 });
    s.tone(o, { type: "triangle", f0: 1200, f1: 1800, dur: 0.06, gain: 0.1 });
  },
  toggle: (s, o, on = true) => {
    s.noise(o, { dur: 0.03, gain: 0.3, filter: "bandpass", f0: on ? 2600 : 1600, q: 3 });
    s.tone(o, { type: "square", f0: on ? 600 : 300, f1: on ? 900 : 200, dur: 0.05, gain: 0.12, delay: 0.02 });
  },
  coin: (s, o) => {
    s.tone(o, { type: "square", f0: 988, dur: 0.07, gain: 0.1 });
    s.tone(o, { type: "square", f0: 1319, dur: 0.22, gain: 0.1, delay: 0.07 });
    s.tone(o, { type: "triangle", f0: 2637, dur: 0.18, gain: 0.06, delay: 0.07 });
  },
  back: (s, o) => {
    s.tone(o, { type: "triangle", f0: 520, f1: 300, dur: 0.07, gain: 0.22 });
    s.tone(o, { type: "square", f0: 260, f1: 180, dur: 0.05, gain: 0.06, delay: 0.03 });
  },
  denied: (s, o) => {
    s.tone(o, { type: "square", f0: 200, dur: 0.08, gain: 0.12 });
    s.tone(o, { type: "square", f0: 150, dur: 0.1, gain: 0.12, delay: 0.09 });
  },
  // Owner 2026-10-29: the brag card's camera shutter: a bright click, the
  // mirror's slap and a short film-advance whirr.
  shutter: (s, o) => {
    s.noise(o, { dur: 0.025, gain: 0.32, filter: "highpass", f0: 4200 });
    s.tone(o, { type: "square", f0: 1900, f1: 900, dur: 0.03, gain: 0.08 });
    s.noise(o, { dur: 0.06, gain: 0.22, filter: "bandpass", f0: 1400, f1: 600, q: 1.8, delay: 0.045 });
    s.tone(o, { type: "triangle", f0: 240, f1: 110, dur: 0.07, gain: 0.18, delay: 0.05 });
    s.noise(o, { dur: 0.12, gain: 0.08, filter: "bandpass", f0: 2600, f1: 3400, q: 4, delay: 0.12 });
  }
});

// ---------------------------------------------------------------- what each press sounds like

// Every pressable the arcade sheets turn into a physical key or card.
export const ARCADE_KEY_SELECTOR = [
  ".cm-title__login", ".cm-title__actions .cm-button", ".cm-title__film-watch", ".cm-title__settings", ".cm-vs2-action", ".cm-screen-primary", ".cm-screen-back", ".cm-vs5-action", ".cm-choice",
  ".cm-toolbar__tool-done", ".cm-settings__close", ".cm-settings__back", ".cm-settings__category", ".cm-hexworld__zoom",
  ".cm-hexworld__buy-land", ".cm-hexworld__cell", ".cm-dialog button", ".cm-toolbar__quick-entry", ".cm-toolbar__entry",
  ".cm-toolbar__cell", ".cm-vs2-shop__row", ".cm-vs2-shop__tab", ".cm-vs2-database__row", ".cm-vs2-database__chip",
  ".cm-vs2-gate", ".cm-vs5-cube__face", ".cm-vs5-match", ".cm-hunt-tools .cm-vs2-action", ".cm-ranch-zoom", ".cm-status-bar__matches", ".cm-arcade-key"
].join(",");
// Cards deal, tilt and squash; their press is a card flick, not a key hit.
export const ARCADE_CARD_SELECTOR = ".cm-vs2-shop__row, .cm-vs2-database__row, .cm-vs2-gate, .cm-vs5-match, .cm-vs5-match__enter, .cm-toolbar__quick-entry";
const TOGGLE_SELECTOR = ".cm-toolbar__cell, .cm-vs2-shop__tab, .cm-vs2-database__chip, .cm-vs5-cube__face, .cm-settings__category";
const BACK_SELECTOR = ".cm-screen-back, .cm-vs2-shop__close, .cm-vs2-database__close, .cm-settings__close, .cm-settings__back, [data-sfx='back']";

/** The cue a press makes: denied · back · toggle · card · click. */
export function pressCue(key) {
  if (!key) return null;
  if (key.disabled || key.getAttribute?.("aria-disabled") === "true") return "denied";
  if (key.dataset?.sfx === "silent") return null;
  if (key.matches(BACK_SELECTOR) || /^(返回|BACK|RETURN)/i.test((key.textContent ?? "").trim())) return "back";
  if (key.matches(TOGGLE_SELECTOR)) return "toggle";
  if (key.matches(ARCADE_CARD_SELECTOR)) return "card";
  return "click";
}

// ---------------------------------------------------------------- juice

function reducedMotion(doc) {
  return doc?.documentElement?.dataset?.motion === "reduced";
}
const rand = (a, b) => a + Math.random() * (b - a);

export function createArcadeJuice({ doc = globalThis.document, view = globalThis } = {}) {
  let canvas = null, ctx = null, layer = null, toasts = null, frame = 0, last = 0, dpr = 1;
  const particles = [];
  function ensure() {
    if (canvas || !doc?.body) return Boolean(canvas);
    canvas = doc.createElement("canvas");
    canvas.className = "cm-arcade-fx";
    canvas.setAttribute("aria-hidden", "true");
    layer = doc.createElement("div");
    layer.className = "cm-arcade-float";
    layer.setAttribute("aria-hidden", "true");
    toasts = doc.createElement("div");
    toasts.className = "cm-arcade-toasts";
    toasts.setAttribute("role", "status");
    doc.body.append(canvas, layer, toasts);
    ctx = canvas.getContext?.("2d") ?? null;
    return true;
  }
  function size() {
    dpr = Math.min(2, view.devicePixelRatio || 1);
    canvas.width = Math.round(view.innerWidth * dpr);
    canvas.height = Math.round(view.innerHeight * dpr);
    if (ctx) ctx.imageSmoothingEnabled = false;
  }
  function step(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.innerWidth, view.innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.max, s = Math.max(1, Math.round(p.size * (0.35 + 0.65 * k)));
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      if (p.shape === "star") {
        ctx.fillStyle = p.color;
        ctx.fillRect(x - s, y, s * 3, s);
        ctx.fillRect(x, y - s, s, s * 3);
      } else {
        ctx.fillStyle = INK;
        ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, s, s);
      }
    }
    ctx.globalAlpha = 1;
    // The loop lives only while something is moving.
    frame = particles.length ? view.requestAnimationFrame(step) : 0;
    if (!frame) { last = 0; ctx.clearRect(0, 0, view.innerWidth, view.innerHeight); }
  }
  function burst(x, y, o = {}) {
    if (!ensure() || !ctx) return;
    const { count = 6, colors = ["#ffffff", "#ffd23f"], speed = [120, 260], gravity = 520, size: sz = [4, 7],
      life = [0.45, 0.8], spread = Math.PI * 2, angle = -Math.PI / 2, shape = "mix", drag = 1.5 } = o;
    const n = reducedMotion(doc) ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread, v = rand(speed[0], speed[1]), l = rand(life[0], life[1]);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, drag, size: rand(sz[0], sz[1]),
        color: colors[i % colors.length], life: l, max: l, shape: shape === "mix" ? (i % 2 ? "star" : "square") : shape });
    }
    if (!frame) { size(); frame = view.requestAnimationFrame(step); }
  }
  function dustRing(x, y) {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      burst(x + side * rand(18, 40), y + rand(-6, 6), { count: 1, colors: [i % 3 === 0 ? "#fff6c2" : "#d8c39a"], speed: [90, 170],
        angle: side > 0 ? -0.5 : Math.PI + 0.5, spread: 0.9, gravity: 420, size: [4, 6], life: [0.35, 0.6], shape: i % 3 === 0 ? "star" : "square" });
    }
  }
  function floatText(x, y, text, { kind = "info", dir = 1 } = {}) {
    if (!ensure() || !layer) return;
    const el = doc.createElement("div");
    el.className = `cm-arcade-float__num is-${kind}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.append(el);
    if (!el.animate) { setTimeout(() => el.remove(), 900); return; }
    if (reducedMotion(doc)) {
      el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 900 }).onfinish = () => el.remove();
      return;
    }
    const big = kind === "crit", dx = dir * rand(40, 90), peak = big ? -120 : rand(-80, -60), frames = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, s = i === 0 ? 0.4 : i === 1 ? (big ? 1.7 : 1.35) : i === 2 ? (big ? 1.25 : 1) : 1;
      frames.push({ transform: `translate(-50%, -50%) translate(${dx * t}px, ${peak * 4 * t * (1 - t) + 50 * t * t}px) scale(${s}) rotate(${dir * t * (big ? 8 : 14)}deg)`, opacity: t > 0.8 ? (1 - t) * 5 : 1 });
    }
    el.animate(frames, { duration: big ? 1100 : 850, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }).onfinish = () => el.remove();
  }
  function shake(el, strength = 10, duration = 320) {
    if (!el?.animate || reducedMotion(doc)) return;
    const frames = [];
    for (let i = 0; i < 8; i++) {
      const k = 1 - i / 8;
      frames.push({ transform: `translate(${rand(-1, 1) * strength * k}px, ${rand(-1, 1) * strength * k}px) rotate(${rand(-0.6, 0.6) * k}deg)` });
    }
    frames.push({ transform: "translate(0, 0)" });
    el.animate(frames, { duration, easing: `steps(${frames.length}, end)` });
  }
  function jelly(el) {
    if (!el?.animate || reducedMotion(doc)) return;
    el.animate([{ scale: "1 1" }, { scale: "1.12 0.88" }, { scale: "0.94 1.08" }, { scale: "1.03 0.98" }, { scale: "1 1" }],
      { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  }
  function toast(text, tone = "info") {
    if (!ensure() || !toasts || !text) return;
    const el = doc.createElement("div");
    el.className = `cm-arcade-toast is-${tone}`;
    el.textContent = text;
    toasts.append(el);
    setTimeout(() => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 260); }, 1800);
  }
  function dispose() {
    if (frame) view.cancelAnimationFrame?.(frame);
    frame = 0;
    particles.length = 0;
    canvas?.remove(); layer?.remove(); toasts?.remove();
    canvas = ctx = layer = toasts = null;
  }
  return Object.freeze({ burst, dustRing, floatText, shake, jelly, toast, dispose, particleCount: () => particles.length });
}

const centerOf = (el) => {
  const r = el?.getBoundingClientRect?.();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
};

/**
 * Install once on the document: press and hover sounds by delegation, card tilt,
 * and the `cm-fx` result effects. Returns a disposer.
 */
export function installArcadeFx({ doc = globalThis.document, view = globalThis, getOutput, sound = new ArcadeSound(getOutput), juice = createArcadeJuice({ doc, view }) } = {}) {
  if (!doc?.addEventListener) return () => {};
  const keyOf = (target) => (target && typeof target.closest === "function" ? target.closest(ARCADE_KEY_SELECTOR) : null);
  let hovered = null, tilted = null;
  function onPointerOver(event) {
    if (event.pointerType === "touch") return;
    const key = keyOf(event.target);
    if (key && key !== hovered && !key.disabled) sound.play("hover");
    hovered = key;
  }
  function onPointerDown(event) {
    // Title partners answer a tap like the rebuild's parade.
    const partner = event.target?.closest?.(".cm-title__partner, .cm-title__walker");
    if (partner) {
      sound.play("chirp", partner.classList.contains("cm-title__partner--cloud") ? 1.25 : 0.85);
      juice.jelly(partner);
      const at = centerOf(partner);
      juice.burst(at.x, at.y - 40, { count: 6, colors: ["#ff6fb5", "#ffffff", "#ffd23f"], shape: "star", gravity: 300 });
      return;
    }
    const key = keyOf(event.target);
    const cue = pressCue(key);
    if (!cue) return;
    if (cue === "toggle") sound.play("toggle", key.getAttribute("aria-pressed") !== "true" && key.getAttribute("aria-selected") !== "true");
    else sound.play(cue);
    if (cue === "card") juice.jelly(key);
    if (cue === "denied") juice.shake(key, 6, 260);
  }
  // Keyboard activation (Enter / Space) is a click with detail 0.
  function onClick(event) {
    if (event.detail !== 0) return;
    const cue = pressCue(keyOf(event.target));
    if (cue) sound.play(cue === "toggle" ? "toggle" : cue);
  }
  function onPointerMove(event) {
    if (event.pointerType !== "mouse" || reducedMotion(doc)) return;
    const card = event.target?.closest?.(ARCADE_CARD_SELECTOR) ?? null;
    if (tilted && tilted !== card) resetTilt(tilted);
    tilted = card;
    if (!card) return;
    const r = card.getBoundingClientRect(), px = (event.clientX - r.left) / r.width, py = (event.clientY - r.top) / r.height;
    card.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
    card.style.setProperty("--ry", `${(px - 0.5) * 16}deg`);
    card.style.setProperty("--gx", `${px * 100}%`);
    card.style.setProperty("--gy", `${py * 100}%`);
    card.dataset.tilting = "true";
  }
  function resetTilt(card) {
    delete card.dataset.tilting;
    card.style.removeProperty("--rx");
    card.style.removeProperty("--ry");
  }
  function onFx(event) {
    const { kind, text } = event.detail ?? {};
    const at = centerOf(event.target);
    switch (kind) {
      case "purchase":
        sound.play("coin");
        juice.jelly(event.target);
        juice.burst(at.x, at.y, { count: 14, colors: ["#ffd23f", "#fff1a8", "#ffffff"], speed: [160, 340], shape: "mix" });
        if (text) juice.floatText(at.x, at.y - 20, text, { kind: "stat" });
        break;
      case "denied":
        sound.play("denied");
        juice.shake(event.target, 8, 300);
        if (text) juice.toast(text, "warn");
        break;
      case "snap":
        sound.play("snap");
        juice.jelly(event.target);
        juice.dustRing(at.x, at.y);
        break;
      case "unsnap":
        sound.play("unsnap");
        juice.burst(at.x, at.y, { count: 6, colors: ["#d8c39a", "#fff6c2"], speed: [80, 180], gravity: 380 });
        break;
      case "damage":
        // Battle plays its own hit sounds; the HUD only answers with the number and a flash.
        if (text) juice.floatText(at.x, at.y - 10, text, { kind: "dmg", dir: Math.random() < 0.5 ? -1 : 1 });
        // The struck side's plate gives a small jolt (Owner 2026-10-28).
        juice.shake(event.target?.closest?.(".cm-vs5-fighter") ?? event.target, 3, 200);
        break;
      // The brag card's photo (Owner 2026-10-29); the flash itself is the card module's.
      case "shutter": sound.play("shutter"); break;
      case "open": sound.play("whoosh"); break;
      case "close": sound.play("back"); break;
      case "toggle": sound.play("toggle", true); break;
      case "sparkle":
        sound.play("sparkle");
        juice.burst(at.x, at.y, { count: 8, colors: ["#ffffff", "#7fe9ff", "#ffd23f"], shape: "star", gravity: 120 });
        break;
      case "levelup":
        sound.play("levelup");
        juice.burst(at.x, at.y, { count: 16, colors: ["#3ddc84", "#ffd23f", "#ffffff"], speed: [180, 360] });
        if (text) juice.floatText(at.x, at.y - 24, text, { kind: "heal" });
        break;
      default: break;
    }
  }
  doc.addEventListener("pointerover", onPointerOver, { passive: true });
  doc.addEventListener("pointerdown", onPointerDown, { passive: true });
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("pointermove", onPointerMove, { passive: true });
  doc.addEventListener("cm-fx", onFx);
  return () => {
    doc.removeEventListener("pointerover", onPointerOver);
    doc.removeEventListener("pointerdown", onPointerDown);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("pointermove", onPointerMove);
    doc.removeEventListener("cm-fx", onFx);
    juice.dispose();
  };
}

/** Ask for a result effect on an element (no import of this module needed elsewhere). */
export function requestArcadeFx(target, kind, text) {
  const Event = target?.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  if (!target?.dispatchEvent || typeof Event !== "function") return;
  try { target.dispatchEvent(new Event("cm-fx", { bubbles: true, detail: { kind, text } })); } catch { /* no effects */ }
}
