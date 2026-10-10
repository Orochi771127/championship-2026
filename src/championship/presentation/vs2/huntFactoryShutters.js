import {isApprovedOriginalPublicLocation} from '../originalRuntimeLocation.js';
// Owner-approved local presentation candidate, 2026-10-07.
// The native Hunt owner still controls escape, position, tools, RNG and lifetime.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const ART = new Set(['art:hunt:original-opus:v1', 'art:hunt:industrial-review:r1']);
const FACTORY_R3_ART = 'art:hunt:factory-r3:20261008';
const PORTALS = Object.freeze([
  { id: 'factory-west', x: 256, front: 1696, anchorY: 1616 },
  { id: 'factory-east', x: 1280, front: 1120, anchorY: 1040 }
].map(p => Object.freeze({ ...p, width: 112, height: 64 })));

export function factoryShutterSpec(field, assetId, location = globalThis.location) {
  const candidate = new URLSearchParams(location?.search ?? '').get('factoryShutters');
  // Final local intake uses the verified R3 portals in normal play, with existing colors.
  const finalArt = ['art:hunt:final-intake:20261008', 'art:hunt:final-intake-night:20261008'].includes(assetId);
  const allowedArt = finalArt || (candidate === 'r3' ? assetId === FACTORY_R3_ART : candidate === 'r1' && ART.has(assetId));
  if (!(LOOPBACK.has(location?.hostname) || (finalArt && isApprovedOriginalPublicLocation(location))) || !allowedArt
    || field?.fieldId !== 'field_hm10_01' || !field.depthOccluders) return null;
  return Object.freeze({ portals: PORTALS, sideCapWidth: finalArt || assetId === FACTORY_R3_ART ? 64 : 0, solidRegions: Object.freeze(PORTALS.map(p => Object.freeze({
    x: p.x - 96, y: p.anchorY - 160, width: 192, height: p.front - p.anchorY + 160, depth: p.front + 1
  }))), cutouts: Object.freeze(PORTALS.map(p => Object.freeze({
    x: p.x - p.width / 2, y: p.front - p.height, width: p.width, height: p.height
  }))) });
}

// Transient door mechanics, sampled only by the existing presentation ticker.
// Missing, captured or transferred actors cannot leave a stale reservation.
export function createFactoryShutterMotion(portals) {
  const states = portals.map(p => ({ ...p, openness: 0, holdMs: 0, occupants: [], phase: 'CLOSED', safetyOpen: false }));
  let resetPending = true, previousGate = null;
  return Object.freeze({
    reset() { resetPending = true; for (const s of states) { s.openness = 0; s.holdMs = 0; s.occupants = []; s.phase = 'CLOSED'; } },
    update(actors, deltaMs = 0, gateId = null) {
      const discontinuity = resetPending || previousGate !== gateId || !Number.isFinite(deltaMs) || deltaMs > 250;
      const dt = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, 250)) : 0;
      previousGate = gateId; resetPending = false;
      for (const s of states) {
        const top = s.front - s.height;
        // Include idle and collection animation actors: a visible body must never be pinched.
        const near = actors.filter(a => Number.isFinite(a.worldX) && Number.isFinite(a.worldY)
          && Math.abs(a.worldX - s.x) <= s.width / 2 + 12
          && a.worldY > top - 12 && a.worldY < s.front + 144);
        const unsafe = near.some(a => a.worldY <= s.front + 28);
        s.occupants = near.map(a => a.wildId);
        if (discontinuity) { s.openness = unsafe ? 1 : 0; s.holdMs = 0; }
        s.safetyOpen = unsafe && s.openness < 1;
        if (unsafe) s.openness = 1; // late arrival / native relocation / resumed tab
        if (near.length) s.holdMs = 120;
        else s.holdMs = Math.max(0, s.holdMs - dt);
        const target = near.length > 0 || s.holdMs > 0 ? 1 : 0;
        s.openness = Math.max(0, Math.min(1, s.openness + (target ? dt / 160 : -dt / 220)));
        s.phase = s.openness === 0 ? 'CLOSED' : s.openness === 1 ? 'OPEN' : target ? 'OPENING' : 'CLOSING';
      }
      return this.snapshot();
    },
    snapshot() { return states.map(s => ({ ...s, occupants: [...s.occupants] })); }
  });
}

export function createHuntFactoryShutters({ PIXI, layer, spec, mapSprite }) {
  if (!spec || !mapSprite) return null;
  const motion = createFactoryShutterMotion(spec.portals);
  const capTextures = [];
  const nodes = spec.portals.map(p => {
    const inside = new PIXI.Graphics(), frame = new PIXI.Graphics(), leaf = new PIXI.Graphics();
    inside.label = `factory portal interior ${p.id}`;
    frame.label = `factory portal frame ${p.id}`;
    leaf.label = `factory portal shutter ${p.id}`;
    const left = p.x - p.width / 2, top = p.front - p.height;
    inside.rect(left, top, p.width, p.height).fill(0x101d22);
    inside.zIndex = p.anchorY - 1;
    frame.rect(left - 6, top - 8, p.width + 12, 8).fill(0x71868a)
      .rect(left - 6, top, 6, p.height).rect(left + p.width, top, 6, p.height).fill(0x496268)
      .rect(left - 3, top - 3, p.width + 6, 3).fill(0xb2c1bb)
      .rect(left, p.front, p.width, 3).fill(0x253a40);
    frame.zIndex = p.front + 3; leaf.zIndex = p.front + 2.75;
    for (const node of [inside, frame, leaf]) { node.eventMode = 'none'; layer.addChild(node); }
    // Reuse the current environment frame's opaque wall pixels. Atlas edge alpha
    // leaves pinholes for large bodies; these bounded backcaps close those only.
    const capRects = [
      [p.x - 96, p.anchorY - 160, 192, top - (p.anchorY - 160)],
      [p.x - 96, top, 96 - p.width / 2, p.height],
      [p.x + p.width / 2, top, 96 - p.width / 2, p.height],
      // R3's verified opaque lower wall extends 64 px beyond each old cap.
      // Large weapons exposed atlas-alpha gaps here. Copy only these wall
      // strips; the ground above the roof and the aperture stay untouched.
      ...(spec.sideCapWidth ? [
        [p.x - 96 - spec.sideCapWidth, p.front - 128, spec.sideCapWidth, 128],
        [p.x + 96, p.front - 128, spec.sideCapWidth, 128]
      ] : [])
    ];
    const caps = capRects.map(rect => {
      const sprite = new PIXI.Sprite(); sprite.label = `factory solid backcap ${p.id}`;
      sprite.position.set(rect[0], rect[1]); sprite.zIndex = p.front + 1; sprite.eventMode = 'none'; layer.addChild(sprite);
      return { sprite, rect, source: null, cache: new Map() };
    });
    return { p, inside, frame, leaf, caps, last: null };
  });
  let disposed = false;
  return Object.freeze({
    reset() { motion.reset(); },
    sync(view, deltaMs = 0) {
      if (disposed) return;
      const states = motion.update(view.wildCreatures ?? [], deltaMs, view.gateId);
      nodes.forEach(({ p, leaf, caps }, i) => {
        const texture = mapSprite.texture, source = texture?.source;
        for (const cap of caps) {
          if (!source || cap.source === source) continue;
          if (!cap.cache.has(source)) {
            const [x,y,w,h] = cap.rect, sx = texture.width / mapSprite.width, sy = texture.height / mapSprite.height;
            const cropped = new PIXI.Texture({ source, frame: new PIXI.Rectangle(x*sx,y*sy,w*sx,h*sy) });
            cap.cache.set(source,cropped); capTextures.push(cropped);
          }
          cap.source = source; cap.sprite.texture = cap.cache.get(source);
          cap.sprite.width = cap.rect[2]; cap.sprite.height = cap.rect[3];
        }
        const h = p.height * (1 - states[i].openness), left = p.x - p.width / 2, top = p.front - p.height;
        if (nodes[i].last === h) return;
        nodes[i].last = h; leaf.clear();
        if (h <= 0) return;
        leaf.rect(left, top, p.width, h).fill(0x56787c);
        for (let y = top + 7; y < top + h - 2; y += 8) {
          leaf.rect(left, y, p.width, 1).fill(0x2b484e);
          leaf.rect(left, y + 1, p.width, 1).fill(0x6e9293);
        }
        leaf.rect(left, top + h - 2, p.width, 2).fill(0x93aaa6);
      });
    },
    getDiagnostics: () => ({ candidate: 'FACTORY_SHUTTERS_R1_LOCAL', authority: 'PRESENTATION_ONLY',
      portals: motion.snapshot(), disposed, environmentAnimationCoupled: false }),
    dispose() { if (disposed) return; disposed = true; motion.reset();
      for (const n of nodes) { for (const key of ['inside', 'frame', 'leaf']) n[key].destroy(); for (const cap of n.caps) cap.sprite.destroy(); }
      for (const texture of capTextures) texture.destroy(false); }
  });
}
