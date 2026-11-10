// Hunt wire VFX (Owner 2026-11-11, HUNT_WIRE_VFX_20261111: the wires were 「一個很便宜的線」 too).
//
// Presentation only: it reads the published wire objects (from, to, state, valid, item, hit) and never
// writes the hunt. The same HD-pixel language as the rope (huntRopeVfx.js): a pixel steel cable bent with
// MeshRope, an additive glow, pixel posts and square sparks. One look per native wire kind:
//   標準鋼索 (BLOCK, items 0-1) -- steel cable, cool cyan; a partner that meets it makes it hum and spark;
//   磁力鋼索 (BIND, items 2-3)  -- violet field: rings run along the cable, motes orbit, a held partner pulses;
//   電擊鋼索 (DAMAGE, items 4-5) -- crackling pixel lightning along the cable; a partner that meets it is struck.
// While the wire is being dragged it is a holographic dashed line (the kind's colour, or red when too short).
// A new wire shoots out from its first post; a wire about to expire flickers; a removed one fades out.
// HUNT_ROPE_TIERS_20261111: a β wire (odd item) runs as a twin cable with a second lamp on each post and
// a stronger effect (more field rings, a third bolt, more sparks); α is the single cable.

const CABLE_POINTS = 24, FRAME_MS = 1000 / 60;

export const HUNT_WIRE_VFX = Object.freeze({
  kinds: Object.freeze({
    BLOCK: Object.freeze({ glow: 0x5fe8ff, core: 0xd8f6ff, alpha: 0.4 }),
    BIND: Object.freeze({ glow: 0xb06bff, core: 0xe7d2ff, alpha: 0.55 }),
    DAMAGE: Object.freeze({ glow: 0xffe14a, core: 0xfffbe0, alpha: 0.6 })
  }),
  invalid: 0xff5a4a,
  cableScale: 0.6,   // 8 px texture x 0.6 = about 5 world units thick
  glowScale: 1.3,
  deployMs: 200, fadeMs: 260,
  expiringTicks: 120, // the last 2 s of a wire's 600 ticks
  twinGap: 3          // β: each cable sits this far either side of the line
});

/** Native wire item index -> kind (0-1 standard, 2-3 magnetic, 4-5 electric). */
export const wireKind = (itemIndex) => (itemIndex >= 4 ? 'DAMAGE' : itemIndex >= 2 ? 'BIND' : 'BLOCK');
/** Native wire item index -> tier: 0 α, 1 β. */
export const wireTier = (itemIndex) => (Number.isInteger(itemIndex) ? itemIndex % 2 : 0);

/** A jagged bolt from a to b: `segments` pieces, offsets across the line up to `amp`, pixel-snapped. */
export function lightningPath(a, b, { segments = 8, amp = 6, random = Math.random } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, off = i === 0 || i === segments ? 0 : (random() * 2 - 1) * amp;
    out.push({ x: Math.round(a[0] + dx * t + nx * off), y: Math.round(a[1] + dy * t + ny * off) });
  }
  return out;
}

function steelCanvas() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const g = c.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    let col;
    if (y === 0 || y === 7) col = '#1d2a33';
    else {
      const twist = ((x * 2 + y) % 8) < 4;
      col = twist ? '#9fb4c0' : '#5d7381';
      if (y === 2 && twist) col = '#f2fbff';
      if (y >= 5 && !twist) col = '#3c4d58';
    }
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function glowCanvas() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 16;
  const g = c.getContext('2d'), img = g.createImageData(4, 16);
  for (let y = 0; y < 16; y++) {
    const a = Math.exp(-(((y - 7.5) / 4) ** 2));
    for (let x = 0; x < 4; x++) img.data.set([255, 255, 255, Math.round(255 * a)], (y * 4 + x) * 4);
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createHuntWireVfx({ PIXI, layer }) {
  // Headless renderers (tests, a stubbed PIXI) have no canvas or MeshRope: draw nothing, keep the API.
  if (typeof document === 'undefined' || !PIXI?.MeshRope || !PIXI?.Texture?.from) {
    return Object.freeze({ update() {}, getDiagnostics: () => ({ disabled: true }), destroy() {} });
  }
  const root = new PIXI.Container({ label: 'hunt wire vfx' });
  root.eventMode = 'none';
  layer.addChild(root);
  const steel = PIXI.Texture.from(steelCanvas()); steel.source.scaleMode = 'nearest';
  const glow = PIXI.Texture.from(glowCanvas());
  const under = new PIXI.Graphics(), over = new PIXI.Graphics();
  const glowLayer = new PIXI.Container(), cableLayer = new PIXI.Container();
  root.addChild(under, glowLayer, cableLayer, over);
  const live = new Map(); // slot -> {glow, cable, kind, firstSeen, last, fadingFrom}
  const sparks = [];
  const spark = (x, y, vx, vy, color, life, size = 2) => { if (sparks.length < 160) sparks.push({ x, y, vx, vy, color, life, age: 0, size }); };
  const rope = (texture, scale, add) => {
    const points = Array.from({ length: CABLE_POINTS }, () => new PIXI.Point(0, 0));
    const mesh = new PIXI.MeshRope({ texture, points, textureScale: scale });
    if (add) mesh.blendMode = 'add';
    return { mesh, points };
  };
  const drop = (entry) => { entry.glow.mesh.destroy(); entry.cable.mesh.destroy(); entry.twin?.mesh.destroy(); };
  const place = (r, pts) => { for (let i = 0; i < r.points.length; i++) r.points[i].set(pts[i].x, pts[i].y); };
  const line = (a, b, k = 1, hum = 0, phase = 0) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    return Array.from({ length: CABLE_POINTS }, (_, i) => {
      const t = (i / (CABLE_POINTS - 1)) * k, bell = hum ? Math.sin(Math.PI * t / Math.max(k, 1e-3)) : 0;
      const w = hum ? Math.sin(phase + t * 20) * hum * bell : 0;
      return { x: a[0] + dx * t + nx * w, y: a[1] + dy * t + ny * w };
    });
  };
  const post = (g, x, y, color, lit, twin = false) => {
    g.ellipse(x, y + 3, 6, 2.5).fill({ color: 0x0b1116, alpha: 0.45 });
    g.rect(x - 2.5, y - 12, 5, 14).fill({ color: 0x4b5d68 }).stroke({ color: 0x1d2a33, width: 1 });
    g.rect(x - 1.5, y - 11, 1, 12).fill({ color: 0x9fb4c0 });
    g.rect(x - 3.5, y - 15, 7, 4).fill({ color: lit ? color : 0x5d7381 }).stroke({ color: 0x1d2a33, width: 1 });
    if (lit) g.circle(x, y - 13, 7).fill({ color, alpha: 0.28 });
    if (twin) g.rect(x - 2.5, y - 7, 5, 2).fill({ color: lit ? color : 0x5d7381 });   // β: the second lamp
  };

  function update({ objects = [], now = performance.now(), reduced = false } = {}) {
    under.clear(); over.clear();
    const t = now / 1000, seen = new Set();
    for (const o of objects) {
      if (o.kind !== 'WIRE') continue;
      const key = o.slot ?? `${o.from}`; seen.add(key);
      const kind = wireKind(o.itemIndex), tier = wireTier(o.itemIndex), twin = tier === 1, style = HUNT_WIRE_VFX.kinds[kind];
      const from = [o.from[0], o.from[1] - 12], to = [o.to[0], o.to[1] - 12];   // cable runs between the post tops
      if (o.state !== 5) {
        // Dragging: a holographic dashed guide, the kind's colour or red when it is too short.
        const color = o.valid ? style.glow : HUNT_WIRE_VFX.invalid, len = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const dash = 6, gap = 4, shift = reduced ? 0 : (t * 40) % (dash + gap);
        for (let d = -shift; d < len; d += dash + gap) {
          const a = Math.max(0, d) / (len || 1), b = Math.min(len, d + dash) / (len || 1);
          if (b <= 0) continue;
          over.moveTo(from[0] + (to[0] - from[0]) * a, from[1] + (to[1] - from[1]) * a)
            .lineTo(from[0] + (to[0] - from[0]) * b, from[1] + (to[1] - from[1]) * b).stroke({ color, width: 3, alpha: 0.9 });
        }
        over.circle(to[0], to[1], 8).stroke({ color, width: 1.5, alpha: 0.6 });
        post(under, o.from[0], o.from[1], color, true, twin);
        post(under, o.to[0], o.to[1], color, o.valid, twin);
        // A new wire is being laid in this slot: the one it replaces goes now, so the new one shoots out fresh.
        const old = live.get(key);
        if (old) { drop(old); live.delete(key); }
        continue;
      }
      let entry = live.get(key);
      if (!entry || entry.kind !== kind || entry.tier !== tier || entry.fadingFrom) {
        if (entry) drop(entry);
        entry = { kind, tier, glow: rope(glow, HUNT_WIRE_VFX.glowScale * (twin ? 1.25 : 1), true), cable: rope(steel, HUNT_WIRE_VFX.cableScale, false),
          twin: twin ? rope(steel, HUNT_WIRE_VFX.cableScale, false) : null, firstSeen: now };
        glowLayer.addChild(entry.glow.mesh); cableLayer.addChild(entry.cable.mesh);
        if (entry.twin) cableLayer.addChild(entry.twin.mesh);
        live.set(key, entry);
        if (!reduced) for (let i = 0; i < 6; i++) spark(from[0], from[1], (Math.random() - 0.5) * 1.6, -Math.random() * 1.4, style.core, 300);
      }
      entry.last = { from, to, o, kind };
      const deploy = Math.min(1, (now - entry.firstSeen) / (reduced ? 1 : HUNT_WIRE_VFX.deployMs));
      const expiring = o.remaining !== null && o.remaining < HUNT_WIRE_VFX.expiringTicks;
      const flicker = expiring && !reduced && Math.floor(now / 110) % 2 === 0 ? 0.35 : 1;
      const hum = o.hit && !reduced ? 2.2 : 0;
      const pts = line(from, to, deploy, hum, t * 60);
      place(entry.glow, pts);
      if (entry.twin) {
        const len0 = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1, gx = -(to[1] - from[1]) / len0 * HUNT_WIRE_VFX.twinGap, gy = (to[0] - from[0]) / len0 * HUNT_WIRE_VFX.twinGap;
        place(entry.cable, pts.map((p) => ({ x: p.x + gx, y: p.y + gy })));
        place(entry.twin, pts.map((p) => ({ x: p.x - gx, y: p.y - gy })));
      } else place(entry.cable, pts);
      for (const c of [entry.cable, entry.twin]) {
        if (!c) continue;
        c.mesh.visible = true; c.mesh.alpha = flicker; c.mesh.tint = kind === 'BLOCK' ? 0xffffff : style.core;
      }
      entry.glow.mesh.visible = true;
      entry.glow.mesh.tint = style.glow;
      entry.glow.mesh.alpha = style.alpha * flicker * (o.hit ? 1.6 : 1) * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 6));
      post(under, o.from[0], o.from[1], style.glow, true, twin); post(under, o.to[0], o.to[1], style.glow, deploy >= 1, twin);
      if (deploy < 1) { const head = pts.at(-1); over.circle(head.x, head.y, 4).fill({ color: 0xffffff, alpha: 0.9 }); continue; }
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (kind === 'BIND') {
        // Field rings run from both posts to the middle; motes orbit the cable.
        const rings = twin ? 6 : 4;
        for (let i = 0; i < rings; i++) {
          const k = reduced ? i / rings : (t * 0.8 + i / rings) % 1, side = i % 2 ? k / 2 : 1 - k / 2;
          const x = from[0] + (to[0] - from[0]) * side, y = from[1] + (to[1] - from[1]) * side;
          over.ellipse(x, y, 3 + 4 * (1 - Math.abs(0.5 - side) * 2), 7 + 6 * (1 - Math.abs(0.5 - side) * 2))
            .stroke({ color: style.glow, width: 1.5, alpha: 0.75 * flicker });
        }
        if (!reduced && Math.random() < 0.35) {
          const s = Math.random(), x = from[0] + (to[0] - from[0]) * s, y = from[1] + (to[1] - from[1]) * s;
          spark(x, y + (Math.random() < 0.5 ? -6 : 6), (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, Math.random() < 0.5 ? 0xd9b8ff : 0x8a4dff, 420);
        }
        if (o.hit && o.hitPoint) for (let r = 0; r < 2; r++) {
          const k = reduced ? 0.5 : (t * 2 + r / 2) % 1;
          over.ellipse(o.hitPoint[0], o.hitPoint[1] - 10, 10 + 14 * k, (10 + 14 * k) * 0.7).stroke({ color: style.glow, width: 2, alpha: 1 - k });
        }
      } else if (kind === 'DAMAGE') {
        // Crackling: two bolts along the cable, redrawn every few frames.
        const beat = reduced ? 0 : Math.floor(now / 60);
        let seed = (beat * 9301 + (o.slot ?? 0) * 49297) % 233280;
        const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        for (const [w, a] of twin ? [[2.5, 1], [1.5, 0.8], [1, 0.6]] : [[2, 1], [1, 0.7]]) {
          const bolt = lightningPath(from, to, { segments: Math.max(4, Math.round(len / 10)), amp: 5, random });
          over.moveTo(bolt[0].x, bolt[0].y); for (const p of bolt.slice(1)) over.lineTo(p.x, p.y);
          over.stroke({ color: a === 1 ? style.core : style.glow, width: w, alpha: a * flicker });
        }
        if (!reduced && Math.random() < 0.3) for (const p of [o.from, o.to]) spark(p[0], p[1] - 14, (Math.random() - 0.5) * 1.6, -Math.random() * 1.2, 0xfff3b0, 220);
        if (o.hit && o.hitPoint) {
          const bolt = lightningPath([o.hitPoint[0], o.hitPoint[1] - 34], [o.hitPoint[0], o.hitPoint[1] - 6], { segments: 5, amp: 6, random });
          over.moveTo(bolt[0].x, bolt[0].y); for (const p of bolt.slice(1)) over.lineTo(p.x, p.y);
          over.stroke({ color: 0xffffff, width: 2.5, alpha: 0.95 });
          over.circle(o.hitPoint[0], o.hitPoint[1] - 10, 14).fill({ color: style.glow, alpha: 0.3 });
        }
      } else if (o.hit && o.hitPoint && !reduced && Math.random() < 0.8) {
        for (let i = 0; i < (twin ? 4 : 2); i++) spark(o.hitPoint[0], o.hitPoint[1] - 12, (Math.random() - 0.5) * 2.4, -Math.random() * 1.8, i ? 0xffffff : 0x9ff0ff, 260);
      }
    }
    // Wires that went away fade out where they stood.
    for (const [key, entry] of live) {
      if (seen.has(key)) continue;
      if (!entry.last) { drop(entry); live.delete(key); continue; }
      entry.fadingFrom ??= now;
      const k = Math.min(1, (now - entry.fadingFrom) / HUNT_WIRE_VFX.fadeMs);
      entry.cable.mesh.alpha = 1 - k; entry.glow.mesh.alpha = (1 - k) * 0.4;
      if (entry.twin) entry.twin.mesh.alpha = 1 - k;
      if (k >= 1) { drop(entry); live.delete(key); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += FRAME_MS; p.x += p.vx; p.y += p.vy; p.vy += 0.05;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      over.rect(Math.round(p.x) - p.size / 2, Math.round(p.y) - p.size / 2, p.size, p.size).fill({ color: p.color, alpha: 1 - p.age / p.life });
    }
  }

  return Object.freeze({
    update,
    getDiagnostics: () => ({ wires: live.size, sparks: sparks.length }),
    destroy() { root.destroy({ children: true }); steel.destroy(true); glow.destroy(true); }
  });
}
