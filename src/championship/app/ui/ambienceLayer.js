// HD-2D ambience (Owner 2026-10-27): a diorama vignette with a theme-coloured
// edge light, and a small pool of drifting particles (at most 35), over the
// hunt field and the ranch. Pure presentation: pointer-events none, one 2D
// canvas, no allocation per frame, no backdrop blur. It stops in reduced
// motion, with the saver quality and while the page is hidden.

export const AMBIENCE_PARTICLE_CAP = 35;

/** Which mood a hunt biome (or the ranch) gets. */
export const AMBIENCE_BY_BIOME = Object.freeze({
  Volcano: 'ember', Desert: 'ember', Canyon: 'ember',
  Forest: 'motes', Grass: 'motes', Jungle: 'motes', Savanna: 'motes', Damp: 'motes',
  Ice: 'snow',
  Factory: 'data', Sewer: 'data', Mine: 'data', Ruins: 'data',
  Oasis: 'sun', Seaside: 'sun', Crag: 'sun'
});

// count, colour, size px, rise px/s (negative falls), sway px, life s
const THEMES = Object.freeze({
  ember: { count: 30, color: [255, 128, 48], size: [1.5, 3.2], rise: [18, 46], sway: 14, life: [3, 6], glow: true },
  motes: { count: 26, color: [170, 255, 140], size: [1.4, 2.8], rise: [4, 14], sway: 22, life: [4, 8], glow: true },
  snow: { count: 34, color: [235, 246, 255], size: [1.6, 3.4], rise: [-30, -14], sway: 26, life: [5, 9], glow: false },
  data: { count: 24, color: [96, 240, 255], size: [1.2, 2.4], rise: [6, 18], sway: 10, life: [3, 6], glow: true },
  sun: { count: 22, color: [255, 236, 170], size: [1.2, 2.6], rise: [3, 10], sway: 18, life: [4, 8], glow: true }
});

export function ambienceTheme(biomeId, fallback = 'sun') {
  return AMBIENCE_BY_BIOME[biomeId] ?? fallback;
}

/** Mount the vignette and particles over `host`. Returns { setTheme, dispose }. */
export function mountAmbience(host, { theme = 'sun', doc = globalThis.document, view = globalThis, random = Math.random } = {}) {
  const layer = doc.createElement('div');
  layer.className = 'cm-ambience';
  layer.setAttribute('aria-hidden', 'true');
  const canvas = doc.createElement('canvas');
  canvas.className = 'cm-ambience__particles';
  layer.append(canvas);
  host.append(layer);
  const ctx = canvas.getContext?.('2d') ?? null;
  const pool = Array.from({ length: AMBIENCE_PARTICLE_CAP }, () => ({ x: 0, y: 0, size: 1, vy: 0, phase: 0, age: 0, life: 1 }));
  let current = THEMES[theme] ? theme : 'sun', frame = 0, last = 0, width = 0, height = 0, ratio = 1;
  let glowFill = '', coreFill = '';
  const paint = () => { const [r, g, b] = THEMES[current].color; glowFill = `rgba(${r},${g},${b},0.18)`; coreFill = `rgb(${r},${g},${b})`; };
  layer.dataset.theme = current;
  paint();

  const root = doc.documentElement;
  const quiet = () => root?.dataset.motion === 'reduced' || root?.dataset.quality === 'saver'
    || Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || doc.hidden;
  const span = ([a, b]) => a + random() * (b - a);
  function seed(p, anywhere) {
    const spec = THEMES[current];
    p.x = random() * width;
    p.y = anywhere ? random() * height : (spec.rise[0] > 0 ? height + 6 : -6);
    p.size = span(spec.size);
    p.vy = span(spec.rise);
    p.phase = random() * Math.PI * 2;
    p.life = span(spec.life);
    p.age = anywhere ? random() * p.life : 0;
  }
  function resize() {
    ratio = Math.min(2, view.devicePixelRatio || 1);
    width = layer.clientWidth || host.clientWidth || 0;
    height = layer.clientHeight || host.clientHeight || 0;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    for (const p of pool) seed(p, true);
  }
  function step(now) {
    frame = 0;
    if (!ctx || quiet()) { ctx?.clearRect(0, 0, canvas.width, canvas.height); last = 0; return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const spec = THEMES[current];
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < spec.count; i += 1) {
      const p = pool[i];
      p.age += dt;
      p.y -= p.vy * dt;
      p.phase += dt * 1.3;
      if (p.age > p.life || p.y < -10 || p.y > height + 10) seed(p, false);
      const fade = Math.min(1, p.age / 0.6, (p.life - p.age) / 0.8);
      const x = p.x + Math.sin(p.phase) * spec.sway * 0.4;
      ctx.globalAlpha = Math.max(0, fade) * 0.85;
      if (spec.glow) {
        ctx.fillStyle = glowFill;
        ctx.beginPath(); ctx.arc(x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = coreFill;
      ctx.beginPath(); ctx.arc(x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    frame = view.requestAnimationFrame(step);
  }
  function wake() { if (!frame && ctx && !quiet() && typeof view.requestAnimationFrame === 'function') frame = view.requestAnimationFrame(step); }
  const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(resize) : null;
  observer?.observe(layer);
  const onVisibility = () => wake();
  doc.addEventListener?.('visibilitychange', onVisibility);
  resize();
  wake();
  return Object.freeze({
    get theme() { return current; },
    setTheme(next) {
      if (!THEMES[next] || next === current) return;
      current = next;
      layer.dataset.theme = next;
      paint();
      for (const p of pool) seed(p, true);
      wake();
    },
    dispose() {
      if (frame) view.cancelAnimationFrame?.(frame);
      frame = 0;
      observer?.disconnect();
      doc.removeEventListener?.('visibilitychange', onVisibility);
      layer.remove();
    }
  });
}
