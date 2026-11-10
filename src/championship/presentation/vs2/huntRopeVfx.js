// Hunt rope VFX (Owner 2026-11-11, HUNT_ROPE_VFX_20261111: 「現在就好像一個很便宜的線」).
//
// Presentation only: it reads the published tool state (drawn path, closure, tether, snap) and the wild
// list, and never writes the hunt. One HD-pixel look: a braided two-strand rope texture bent along the
// path with Pixi's MeshRope (nearest filtering keeps the pixels), an energy glow rope under it, and
// square pixel sparks. Layers:
//   drawing  -- the rope follows the finger, a bright head, sparks shed along it, the start point pulses
//               once the head comes back round;
//   cinch    -- on release the drawn loop pulls tight toward its centre; a hit bursts on every partner it
//               bound, a miss lets the loop drop and puff;
//   bound    -- a glowing rope coil at the bound partner's feet;
//   tether   -- the pull: sags when slack (cyan), nearly straight under pull (amber), taut and humming
//               under a strong pull (red); a worn rope flickers and frays;
//   snap     -- the rope breaks at the middle, both halves whip back, sparks burst.
// World units: the hunt world (2 per native pixel). Reduced motion keeps every state readable, still.

const TRAIL_POINTS = 64, LOOP_POINTS = 48, TETHER_POINTS = 28;
const FRAME_MS = 1000 / 60;

export const HUNT_ROPE_VFX = Object.freeze({
  ropeScale: 0.85,        // rope thickness = 8 px texture x 0.85 = about 7 world units
  glowScale: 1.6,         // glow thickness = 16 px x 1.6 = about 26 world units
  bands: Object.freeze({
    SLACK: Object.freeze({ glow: 0x6fe3ff, alpha: 0.32, sag: 22 }),
    PULL: Object.freeze({ glow: 0xffb340, alpha: 0.6, sag: 7 }),
    STRONG: Object.freeze({ glow: 0xff4a24, alpha: 0.85, sag: 0 }),
    BROKEN: Object.freeze({ glow: 0xff4a24, alpha: 0.85, sag: 0 })
  }),
  drawGlow: 0x6fe3ff, cinchGlow: 0xffd34d, missGlow: 0x9aa7b0,
  worn: 0.3               // durability share below which the rope flickers and frays
});

/** An 8x8 two-strand braid; the colours run along x so MeshRope repeats it down the rope. */
function braidCanvas() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const g = c.getContext('2d');
  const put = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    if (y === 0 || y === 7) { put(x, y, '#3b1f10'); continue; }
    const strandA = ((x + y) % 8) < 4;
    let col = strandA ? '#e9a24a' : '#a95a24';
    if (strandA && y <= 2) col = '#ffe2a0';            // lit top edge of the light strand
    if (!strandA && y >= 5) col = '#6d3416';           // shaded underside of the dark strand
    if (((x + y) % 8) === 0) col = '#4a2612';          // the groove between strands
    put(x, y, col);
  }
  return c;
}
/** A soft band across the rope: white, fading at both edges. */
function glowCanvas() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 16;
  const g = c.getContext('2d'), img = g.createImageData(4, 16);
  for (let y = 0; y < 16; y++) {
    const a = Math.exp(-(((y - 7.5) / 4.2) ** 2));
    for (let x = 0; x < 4; x++) img.data.set([255, 255, 255, Math.round(255 * a)], (y * 4 + x) * 4);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** `count` points evenly spaced along a polyline (world units); null when it is too short. */
export function resamplePath(path, count, closed = false) {
  const pts = closed && path.length > 2 ? [...path, path[0]] : path;
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = lengths.at(-1);
  if (!(total > 1)) return null;
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const d = total * k / (count - 1);
    while (j < pts.length - 1 && lengths[j] < d) j++;
    const span = lengths[j] - lengths[j - 1] || 1, t = (d - lengths[j - 1]) / span;
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t });
  }
  return { points: out, length: total };
}

/** The tether's curve: a sag below the straight line, plus a hum across it when taut. */
export function tetherCurve(from, to, { sag = 0, hum = 0, phase = 0, count = TETHER_POINTS } = {}) {
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), bell = 4 * t * (1 - t);
    const wave = hum ? Math.sin(phase + t * Math.PI * 6) * hum * bell : 0;
    out.push({ x: from[0] + dx * t + nx * wave, y: from[1] + dy * t + sag * bell + ny * wave });
  }
  return out;
}

export function createHuntRopeVfx({ PIXI, layer }) {
  const root = new PIXI.Container({ label: 'hunt rope vfx' });
  root.eventMode = 'none';
  layer.addChild(root);
  const ropeTexture = PIXI.Texture.from(braidCanvas());
  ropeTexture.source.scaleMode = 'nearest';
  const glowTexture = PIXI.Texture.from(glowCanvas());
  const makeRope = (count, texture, scale, glow) => {
    const points = Array.from({ length: count }, () => new PIXI.Point(0, 0));
    const mesh = new PIXI.MeshRope({ texture, points, textureScale: scale });
    if (glow) mesh.blendMode = 'add';
    mesh.visible = false;
    return { mesh, points };
  };
  // Back to front: glows under ropes, sparks and bursts on top.
  const trailGlow = makeRope(TRAIL_POINTS, glowTexture, HUNT_ROPE_VFX.glowScale, true);
  const loopGlow = makeRope(LOOP_POINTS, glowTexture, HUNT_ROPE_VFX.glowScale, true);
  const tetherGlow = makeRope(TETHER_POINTS, glowTexture, HUNT_ROPE_VFX.glowScale, true);
  const trailRope = makeRope(TRAIL_POINTS, ropeTexture, HUNT_ROPE_VFX.ropeScale);
  const loopRope = makeRope(LOOP_POINTS, ropeTexture, HUNT_ROPE_VFX.ropeScale);
  const tetherRope = makeRope(TETHER_POINTS, ropeTexture, HUNT_ROPE_VFX.ropeScale);
  const snapA = makeRope(TETHER_POINTS / 2, ropeTexture, HUNT_ROPE_VFX.ropeScale);
  const snapB = makeRope(TETHER_POINTS / 2, ropeTexture, HUNT_ROPE_VFX.ropeScale);
  const under = new PIXI.Graphics(), over = new PIXI.Graphics();
  root.addChild(under, trailGlow.mesh, loopGlow.mesh, tetherGlow.mesh, trailRope.mesh, loopRope.mesh, tetherRope.mesh,
    snapA.mesh, snapB.mesh, over);

  const setRope = (rope, pts) => {
    if (!pts) { rope.mesh.visible = false; return; }
    for (let i = 0; i < rope.points.length; i++) { const p = pts[Math.min(i, pts.length - 1)]; rope.points[i].set(p.x, p.y); }
    rope.mesh.visible = true;
  };
  const sparks = [], bursts = [];
  let lastPath = null, fizzle = null, cinch = null, snap = null, snapSerial = null, closureSerial = null;
  let boundBefore = new Set();
  const spark = (x, y, vx, vy, color, life, size = 2) => { if (sparks.length < 160) sparks.push({ x, y, vx, vy, color, life, age: 0, size }); };
  const burst = (x, y, kind, now, reduced) => {
    bursts.push({ x, y, kind, start: now });
    if (reduced) return;
    const n = kind === 'BIND' ? 12 : kind === 'SNAP' ? 14 : 8;
    const colors = kind === 'MISS' ? [0xb7c0c6, 0x8b969e] : kind === 'SNAP' ? [0xfff0c0, 0xff9a3c, 0xff4a24] : [0xfff3b0, 0xffd34d, 0xff9a3c];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * 0.4, v = (kind === 'MISS' ? 0.8 : 2.2) * (0.6 + Math.random() * 0.6);
      spark(x, y, Math.cos(a) * v, Math.sin(a) * v * (kind === 'MISS' ? 0.4 : 0.8) - (kind === 'MISS' ? 0.4 : 0.6),
        colors[i % colors.length], kind === 'MISS' ? 420 : 380, kind === 'BIND' ? 3 : 2);
    }
  };

  function update({ tools, wilds = [], now = performance.now(), reduced = false } = {}) {
    under.clear(); over.clear();
    const t = now / 1000;
    // ---- drawing
    const path = tools?.lassoPath?.length > 1 ? tools.lassoPath : null;
    const trail = path ? resamplePath(path, TRAIL_POINTS) : null;
    setRope(trailRope, trail?.points); setRope(trailGlow, trail?.points);
    if (trail) {
      trailGlow.mesh.tint = HUNT_ROPE_VFX.drawGlow; trailGlow.mesh.alpha = 0.5 + (reduced ? 0 : 0.15 * Math.sin(t * 9));
      trailRope.mesh.alpha = 1;
      const head = path.at(-1), start = path[0];
      over.circle(head.x, head.y, 9).fill({ color: 0x6fe3ff, alpha: 0.25 });
      over.rect(head.x - 4, head.y - 1, 8, 2).fill({ color: 0xffffff, alpha: 0.95 });
      over.rect(head.x - 1, head.y - 4, 2, 8).fill({ color: 0xffffff, alpha: 0.95 });
      if (!reduced && Math.random() < 0.7) spark(head.x + (Math.random() - 0.5) * 6, head.y + (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.5, Math.random() < 0.5 ? 0x9ff0ff : 0xffe2a0, 320);
      // The start point calls the finger home once the stroke has gone a fair way round.
      if (trail.length > 80 && Math.hypot(head.x - start.x, head.y - start.y) < 46) {
        const pulse = reduced ? 0.5 : Math.sin(t * 12) * 0.5 + 0.5;
        over.circle(start.x, start.y, 10 + pulse * 5).stroke({ color: 0xffffff, width: 2, alpha: 0.5 + pulse * 0.45 });
        over.rect(start.x - 3, start.y - 3, 6, 6).fill({ color: 0xffd34d, alpha: 0.95 });
      }
      lastPath = path; fizzle = null;
    } else if (lastPath) {
      // The finger lifted: a recognised loop becomes a cinch below; anything else drops and fades.
      if (!tools?.closure) fizzle = { path: lastPath, start: now };
      lastPath = null;
    }
    // ---- cinch on release
    const closure = tools?.closure ?? null;
    if (closure && closure.serial !== closureSerial) {
      closureSerial = closure.serial;
      const loop = closure.trail?.length > 2 ? closure.trail : Array.from({ length: 24 }, (_, i) =>
        ({ x: closure.x + 48 * Math.cos(i / 24 * Math.PI * 2), y: closure.y + 32 * Math.sin(i / 24 * Math.PI * 2) }));
      const shape = resamplePath(loop, LOOP_POINTS, true);
      cinch = shape ? { points: shape.points, cx: closure.x, cy: closure.y, start: now,
        duration: Math.max(1, closure.ticks) * FRAME_MS, resolved: false } : null;
      boundBefore = new Set(wilds.filter((w) => w.bound).map((w) => w.wildId));
      fizzle = null;
    }
    if (cinch) {
      const k = Math.min(1, (now - cinch.start) / cinch.duration), ease = 1 - (1 - k) ** 3;
      if (!closure && !cinch.resolved) {
        cinch.resolved = true; cinch.resolvedAt = now;
        const caught = wilds.filter((w) => w.bound && !boundBefore.has(w.wildId));
        cinch.hit = caught.length > 0;
        for (const w of caught) burst(w.worldX, w.worldY - (w.worldZ ?? 0) - 10, 'BIND', now, reduced);
        if (!caught.length) burst(cinch.cx, cinch.cy, 'MISS', now, reduced);
      }
      const after = cinch.resolved ? Math.min(1, (now - cinch.resolvedAt) / 260) : 0;
      const squeeze = reduced ? 0.4 : 0.55 * ease + (cinch.hit ? 0.35 * after : 0);
      const drop = cinch.resolved && !cinch.hit ? 14 * after : 0;
      const pts = cinch.points.map((p) => ({ x: cinch.cx + (p.x - cinch.cx) * (1 - squeeze), y: cinch.cy + (p.y - cinch.cy) * (1 - squeeze) + drop }));
      setRope(loopRope, pts); setRope(loopGlow, pts);
      const fade = 1 - after;
      loopRope.mesh.alpha = fade; loopGlow.mesh.alpha = (0.45 + 0.4 * ease) * fade;
      loopGlow.mesh.tint = cinch.resolved && !cinch.hit ? HUNT_ROPE_VFX.missGlow : HUNT_ROPE_VFX.cinchGlow;
      if (cinch.resolved && after >= 1) { cinch = null; setRope(loopRope, null); setRope(loopGlow, null); }
    } else { setRope(loopRope, null); setRope(loopGlow, null); }
    // ---- a stroke that was not a loop drops away
    if (fizzle && !trail) {
      const k = Math.min(1, (now - fizzle.start) / 260);
      const pts = resamplePath(fizzle.path, TRAIL_POINTS)?.points.map((p) => ({ x: p.x, y: p.y + 10 * k * k }));
      setRope(trailRope, pts); trailRope.mesh.alpha = 1 - k;
      if (k >= 1) { fizzle = null; setRope(trailRope, null); }
    }
    // ---- bound coils
    for (const w of wilds) {
      if (!w.bound || w.state === 'ON_CARD' || w.cardState) continue;
      const x = w.worldX, y = w.worldY - (w.worldZ ?? 0) - 3, pulse = reduced ? 0.5 : Math.sin(t * 5 + x) * 0.5 + 0.5;
      under.ellipse(x, y, 20, 8).fill({ color: 0xffd34d, alpha: 0.12 + 0.08 * pulse });
      under.ellipse(x, y, 15, 6).stroke({ color: 0x3b1f10, width: 4.5, alpha: 0.9 });
      under.ellipse(x, y, 15, 6).stroke({ color: 0xe9a24a, width: 2.5, alpha: 0.95 });
      under.ellipse(x, y - 0.8, 15, 6).stroke({ color: 0xffe2a0, width: 0.9, alpha: 0.6 + 0.3 * pulse });
      under.rect(x + 13, y - 3, 5, 5).fill({ color: 0xe9a24a }).stroke({ color: 0x3b1f10, width: 1 });   // the knot
    }
    // ---- the tether
    const rope = tools?.rope ?? null;
    if (rope) {
      const band = HUNT_ROPE_VFX.bands[rope.band] ?? HUNT_ROPE_VFX.bands.SLACK;
      const share = rope.capacity > 0 ? rope.durability / rope.capacity : 1, worn = share < HUNT_ROPE_VFX.worn;
      const hum = reduced ? 0 : rope.band === 'STRONG' ? 1.8 : worn ? 0.8 : 0;
      const pts = tetherCurve(rope.from, rope.to, { sag: band.sag, hum, phase: t * 55 });
      setRope(tetherRope, pts); setRope(tetherGlow, pts);
      tetherGlow.mesh.tint = band.glow;
      tetherGlow.mesh.alpha = band.alpha * (rope.band === 'STRONG' && !reduced ? 0.8 + 0.2 * Math.sin(t * 30) : 1);
      tetherRope.mesh.alpha = 1;
      tetherRope.mesh.tint = worn && !reduced && Math.floor(now / 90) % 2 ? 0xff9a8a : 0xffffff;
      // The grip at the finger and the anchor at the partner.
      over.circle(rope.to[0], rope.to[1], 7).fill({ color: band.glow, alpha: 0.3 });
      over.rect(rope.to[0] - 3, rope.to[1] - 3, 6, 6).fill({ color: 0xfff3d0 }).stroke({ color: 0x3b1f10, width: 1 });
      over.circle(rope.from[0], rope.from[1], 5).fill({ color: band.glow, alpha: 0.35 });
      if (!reduced && (rope.band === 'STRONG' || worn) && Math.random() < (worn ? 0.6 : 0.4)) {
        const p = pts[Math.floor(Math.random() * pts.length)];
        spark(p.x, p.y, (Math.random() - 0.5) * 1.2, -0.3 - Math.random() * 0.6, worn ? 0xffb090 : 0xffd34d, 260);
      }
    } else { setRope(tetherRope, null); setRope(tetherGlow, null); }
    // ---- the snap
    const s = tools?.snap ?? null;
    if (s && s.serial !== snapSerial) {
      snap = { from: s.from, to: s.to, start: now };
      burst((s.from[0] + s.to[0]) / 2, (s.from[1] + s.to[1]) / 2, 'SNAP', now, reduced);
      snapSerial = s.serial;
    }
    if (snap) {
      const k = Math.min(1, (now - snap.start) / (reduced ? 160 : 300)), ease = 1 - (1 - k) ** 2;
      const mid = [(snap.from[0] + snap.to[0]) / 2, (snap.from[1] + snap.to[1]) / 2];
      const half = (end, rope) => {
        const tip = [mid[0] + (end[0] - mid[0]) * ease, mid[1] + (end[1] - mid[1]) * ease];
        const whip = reduced ? 0 : 10 * (1 - k);
        setRope(rope, tetherCurve(end, tip, { sag: 6 * k, hum: whip, phase: k * 18, count: rope.points.length }));
        rope.mesh.alpha = 1 - k * k;
      };
      half(snap.from, snapA); half(snap.to, snapB);
      if (k >= 1) { snap = null; setRope(snapA, null); setRope(snapB, null); }
    }
    // ---- bursts and sparks
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], k = (now - b.start) / (b.kind === 'MISS' ? 420 : 340);
      if (k >= 1) { bursts.splice(i, 1); continue; }
      const color = b.kind === 'MISS' ? 0xc9d1d6 : b.kind === 'SNAP' ? 0xffb340 : 0xffd34d;
      over.ellipse(b.x, b.y + (b.kind === 'BIND' ? 8 : 0), 10 + 30 * k, (10 + 30 * k) * 0.45).stroke({ color, width: 3 * (1 - k), alpha: 1 - k });
      if (b.kind !== 'MISS' && k < 0.35) over.circle(b.x, b.y, 12 * (1 - k / 0.35)).fill({ color: 0xffffff, alpha: 0.8 * (1 - k / 0.35) });
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += FRAME_MS; p.x += p.vx; p.y += p.vy; p.vy += 0.06;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      const a = 1 - p.age / p.life;
      over.rect(Math.round(p.x) - p.size / 2, Math.round(p.y) - p.size / 2, p.size, p.size).fill({ color: p.color, alpha: a });
    }
  }

  return Object.freeze({
    update,
    getDiagnostics: () => ({ trail: trailRope.mesh.visible, loop: loopRope.mesh.visible, tether: tetherRope.mesh.visible,
      snap: snapA.mesh.visible, sparks: sparks.length, bursts: bursts.length }),
    destroy() {
      root.destroy({ children: true });
      ropeTexture.destroy(true); glowTexture.destroy(true);
    }
  });
}
