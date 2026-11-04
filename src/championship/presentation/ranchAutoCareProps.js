// Ranch auto-care props (Owner 2026-11-03, AUTO_CARE_3D_20261103): the 3D cleaning robot
// and the feeding tower, drawn in the ranch's own Three scene so they share its depth,
// light and shadows with the cages and the partners. The machines' behaviour lives in
// raising/autoCareMachines.js; this module only draws a frame of it.
//
// Models come from the Blender 5.2 producer (scripts/blender/build_auto_care_3d_props.py).
// Until they load -- or if they never do -- built-in meshes of the same shape stand in,
// so the machines are always solid 3D. Driven by the ranch scene's render(); no ticker.
import * as THREE from '../../../node_modules/three/build/three.module.js';
import { ranchNativeToWorld } from './ranchThreeCoordinates.js';
import { meatArc } from '../raising/autoCareMachines.js';

const ART = 'assets/production/items/auto-care-3d-r1/';
export const AUTO_CARE_MODEL_URLS = Object.freeze({ cleaner: `${ART}auto_cleaner_bot.glb`, feeder: `${ART}auto_feeder_tower.glb` });
const CYAN = 0x18d8ff, GREEN = 0x46ff86, AMBER = 0xffae20, GOLD = 0xffd75a;

/** World direction of a native heading (radians in the native ground plane), as a Y rotation for a +X-forward model. */
function yawFor(x, y, heading) {
  const a = ranchNativeToWorld(x, y), b = ranchNativeToWorld(x + Math.cos(heading), y + Math.sin(heading));
  return Math.atan2(-(b.z - a.z), b.x - a.x);
}
const easeOut = (t) => 1 - (1 - t) ** 3;

// ---- built-in stand-ins (same proportions as the Blender models) ----
function standMaterial(color, { emissive = 0, metal = 0.3, rough = 0.35, opacity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: emissive ? color : 0x000000,
    emissiveIntensity: emissive, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}
function builtInCleaner() {
  const root = new THREE.Group(); root.name = 'AutoCleanerBot';
  const body = new THREE.Group(); body.name = 'Body'; root.add(body);
  const shell = standMaterial(0xdce3ec), trim = standMaterial(0x1b1f2b, { rough: .55 });
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .22, 48), shell); skirt.position.y = .15; body.add(skirt);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.5, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  dome.scale.y = .22; dome.position.y = .26; body.add(dome);
  const bumper = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .12, 32, 1, true, -Math.PI * .34 + Math.PI / 2, Math.PI * .68), trim);
  bumper.position.y = .11; body.add(bumper);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .62), standMaterial(CYAN, { emissive: 3 })); sensor.name = 'Sensor';
  sensor.position.set(.6, .11, 0); body.add(sensor);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.37, .026, 8, 40), standMaterial(GREEN, { emissive: 4 })); halo.name = 'Halo';
  halo.rotation.x = Math.PI / 2; halo.position.y = .32; body.add(halo);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), standMaterial(CYAN, { emissive: 3 })); tail.name = 'Light_Tail';
  tail.position.set(-.56, .12, 0); body.add(tail);
  for (const [name, z] of [['Brush_L', -.36], ['Brush_R', .36]]) {
    const brush = new THREE.Group(); brush.name = name; brush.position.set(.34, .012, z);
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.2, .012, .022), standMaterial(0x338ad8, { rough: .7 }));
      arm.position.x = .1; const pivot = new THREE.Group(); pivot.rotation.y = k * Math.PI * 2 / 3; pivot.add(arm); brush.add(pivot);
    }
    body.add(brush);
  }
  return root;
}
function builtInFeeder() {
  const root = new THREE.Group(); root.name = 'AutoFeederTower';
  const base = new THREE.Group(); base.name = 'Base'; root.add(base);
  const shell = standMaterial(0xdce3ec), trim = standMaterial(0x1b1f2b, { rough: .5 });
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.46, .5, .34, 40), shell); foot.position.y = .17; base.add(foot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.47, .03, 8, 40), standMaterial(AMBER, { emissive: 4 })); ring.name = 'BaseRing';
  ring.rotation.x = Math.PI / 2; ring.position.y = .1; base.add(ring);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .68, 36, 1, true), standMaterial(0x9ff2ff, { opacity: .32, rough: .05 }));
  hopper.name = 'Hopper'; hopper.position.y = .77; base.add(hopper);
  const store = new THREE.Group(); store.name = 'Meat_Store';
  for (const [x, y, z] of [[.1, .55, .05], [-.1, .56, .08], [.02, .6, -.12], [-.06, .7, -.02], [.1, .72, -.06], [.04, .84, .04]]) {
    const chunk = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), standMaterial(0xc4482e, { rough: .55 })); chunk.position.set(x, y, z); store.add(chunk);
  }
  base.add(store);
  for (const y of [.4, 1.12]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .05, 36), trim); c.position.y = y; base.add(c); }
  const turret = new THREE.Group(); turret.name = 'Turret'; turret.position.y = 1.15; base.add(turret);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell); head.scale.y = .75; head.position.y = .03; turret.add(head);
  const nozzle = new THREE.Group(); nozzle.name = 'Nozzle'; nozzle.position.set(.18, .14, 0); nozzle.rotation.z = .49; turret.add(nozzle);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.085, .1, .3, 20), trim); barrel.rotation.z = -Math.PI / 2; barrel.position.x = .15; nozzle.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(.085, .02, 8, 20), standMaterial(AMBER, { emissive: 3 })); muzzle.name = 'Muzzle';
  muzzle.rotation.y = Math.PI / 2; muzzle.position.x = .3; nozzle.add(muzzle);
  const meat = new THREE.Group(); meat.name = 'Meat';
  const chunk = new THREE.Mesh(new THREE.SphereGeometry(.16, 18, 10), standMaterial(0xc4482e, { rough: .55 })); chunk.scale.set(1.25, .9, .95); meat.add(chunk);
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .3, 10), standMaterial(0xf7eed6, { rough: .4 }));
  bone.rotation.z = Math.PI / 2; bone.position.x = .22; meat.add(bone);
  meat.visible = false; root.add(meat);
  return root;
}

/** A soft round contact shadow drawn once (works in every quality tier, shadow maps or not). */
function contactShadowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'), grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(10,8,30,0.55)'); grad.addColorStop(.6, 'rgba(10,8,30,0.28)'); grad.addColorStop(1, 'rgba(10,8,30,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Props for one ranch scene. `load(url)` returns a glTF (the scene's own GLTFLoader);
 * `groundHeight(x, y)` the walk surface height (world units) under a native point.
 */
export function createRanchAutoCareProps(scene, { load = null, groundHeight = () => 0, castShadow = true } = {}) {
  const templates = { cleaner: builtInCleaner(), feeder: builtInFeeder() };
  const source = { cleaner: 'BUILT_IN', feeder: 'BUILT_IN' };
  const live = new Map(), trails = new Map(), shadowTexture = contactShadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  let disposed = false;
  if (typeof load === 'function') for (const kind of ['cleaner', 'feeder']) {
    Promise.resolve().then(() => load(AUTO_CARE_MODEL_URLS[kind])).then((gltf) => {
      if (disposed || !gltf?.scene) return;
      templates[kind] = gltf.scene; source[kind] = 'GLB';
      // Rebuild instances on the next frame from the authored model.
      for (const [key, item] of live) if (item.kind === kind) { scene.remove(item.root); live.delete(key); }
    }).catch(() => {});
  }

  function instance(kind) {
    const root = templates[kind].clone(true), parts = {};
    root.traverse((o) => {
      if (o.name) parts[o.name] = o;
      if (o.isMesh) {
        o.castShadow = castShadow; o.receiveShadow = false;
        // Glowing parts get their own material so each machine can pulse alone.
        if (o.material?.emissiveIntensity > 0 || /Halo|Sensor|Muzzle|BaseRing|Light_Tail|HeadRing|Core/.test(o.name)) o.material = o.material.clone();
      }
    });
    // The thrown meat flies above everything on the ground: drawn last, never hidden by a partner's billboard.
    parts.Meat?.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.depthTest = false; o.renderOrder = 10; } });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = -1;
    const group = new THREE.Group(); group.add(root, shadow);
    scene.add(group);
    return { kind, root: group, model: root, parts, shadow, glow: 0 };
  }
  const emissive = (part, color, intensity) => {
    part?.traverse?.((o) => { if (o.material) { if (color !== null) o.material.emissive?.setHex(color); o.material.emissiveIntensity = intensity; } });
  };

  function placeAt(item, x, y, lift = 0) {
    const h = groundHeight(x, y) ?? 0, w = ranchNativeToWorld(x, y, h + lift);
    item.root.position.set(w.x, w.y, w.z);
    item.shadow.position.y = .012 - lift;
  }

  function syncCleaner(m, time) {
    let item = live.get(m.key);
    if (!item) { item = instance('cleaner'); live.set(m.key, item); }
    item.seen = true;
    placeAt(item, m.x, m.y);
    item.model.rotation.y = yawFor(m.x, m.y, m.heading);
    const p = item.parts;
    if (p.Brush_L) p.Brush_L.rotation.y = m.brush;
    if (p.Brush_R) p.Brush_R.rotation.y = -m.brush;
    // Power-down: the lid sinks, the halo dims and the robot folds away.
    const retire = m.retire == null ? 0 : Math.min(1, m.retire);
    const squash = m.mode === 'SWEEP' ? 1 + .05 * Math.sin(time * 40) : 1;
    item.model.scale.set(squash * (1 - retire * .35), (1 - retire * .7), squash * (1 - retire * .35));
    item.shadow.scale.setScalar(1.45 * (1 - retire * .4));
    const alert = m.alert > 0;
    emissive(p.Halo, GREEN, (alert ? 6 + 4 * Math.sin(time * 30) : 3.4 + .8 * Math.sin(time * 3)) * (1 - retire));
    emissive(p.Sensor, alert ? GREEN : CYAN, (alert ? (Math.sin(time * 26) > 0 ? 7 : 1.5) : 3.2) * (1 - retire));
    emissive(p.Light_Tail, null, (Math.sin(time * 9) > .2 ? 4 : .6) * (1 - retire));
    // Sweep whirl and radar ripple: simple rings around the robot, gone when idle.
    item.whirl ??= (() => {
      // A suction whirl: two counter-turning rings and four sparkles that fly in.
      const whirl = new THREE.Group(), material = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0, depthWrite: false });
      for (const [r, y] of [[.78, .16], [.58, .34]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .06, 6, 40, Math.PI * 1.5), material); ring.rotation.x = Math.PI / 2; ring.position.y = y; whirl.add(ring); }
      const star = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      whirl.stars = [0, 1, 2, 3].map((k) => { const s = new THREE.Mesh(new THREE.OctahedronGeometry(.09), star); whirl.add(s); s.phase = k / 4; return s; });
      whirl.material = material; whirl.starMaterial = star;
      item.root.add(whirl); return whirl;
    })();
    item.ripple ??= (() => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .03; item.root.add(ring); return ring;
    })();
    const sweeping = m.mode === 'SWEEP';
    item.whirl.material.opacity = sweeping ? .7 + .2 * Math.sin(time * 30) : 0;
    item.whirl.starMaterial.opacity = sweeping ? .95 : 0;
    item.whirl.children[0].rotation.z = time * 16; item.whirl.children[1].rotation.z = -time * 22;
    item.whirl.scale.setScalar(sweeping ? 1 + .18 * Math.sin(time * 22) : 1);
    for (const s of item.whirl.stars) {
      const k = (time * 2.5 + s.phase) % 1, a = s.phase * Math.PI * 2 + time * 6;
      s.position.set(Math.cos(a) * (1.1 - k), .25 + .5 * (1 - k), Math.sin(a) * (1.1 - k)); s.rotation.y = time * 8;
    }
    const ripple = alert ? 1 - m.alert / .8 : 1;
    item.ripple.material.opacity = alert ? .7 * (1 - ripple) : 0;
    item.ripple.scale.setScalar(.6 + 1.6 * easeOut(ripple));
  }

  function syncFeeder(f, time) {
    let item = live.get(f.key);
    if (!item) { item = instance('feeder'); live.set(f.key, item); }
    item.seen = true;
    placeAt(item, f.x, f.y);
    const p = item.parts, retire = f.retire == null ? 0 : Math.min(1, f.retire);
    if (p.Turret) p.Turret.rotation.y = yawFor(f.x, f.y, f.yaw);
    // Charge: a springy squash while aiming, a stretch as it fires, then settle.
    let sy = 1;
    if (f.phase === 'AIM') sy = 1 - .12 * Math.sin(Math.min(1, f.t / .2) * Math.PI / 2);
    else if (f.phase === 'THROW') sy = 1 + .1 * Math.exp(-f.t * 9) * Math.cos(f.t * 30);
    const base = p.Base ?? item.model;
    base.scale.set(1 / Math.sqrt(sy) * (1 - retire * .3), sy * (1 - retire * .6), 1 / Math.sqrt(sy) * (1 - retire * .3));
    item.shadow.scale.setScalar(1.35);
    emissive(p.BaseRing, null, (f.noMeat ? (Math.sin(time * 6) > 0 ? 3 : .4) : 3.2 + .6 * Math.sin(time * 2.4)) * (1 - retire));
    const flash = f.phase === 'AIM' ? f.t / .2 : f.phase === 'THROW' ? Math.max(0, 1 - f.t / .15) : 0;
    emissive(p.Muzzle, null, 2 + 9 * flash);
    if (p.Meat_Store) p.Meat_Store.visible = !f.noMeat;
    // The thrown meat and its golden dotted trail.
    const meat = p.Meat;
    if (meat) {
      const flying = f.phase === 'THROW' && f.from && f.to;
      meat.visible = Boolean(flying);
      if (flying) {
        const arc = meatArc(f.from, f.to, f.t / .55), h = groundHeight(arc.x, arc.y) ?? 0;
        item.root.updateMatrixWorld(true);
        const w = ranchNativeToWorld(arc.x, arc.y, h + arc.z / 16), local = meat.parent.worldToLocal(new THREE.Vector3(w.x, w.y, w.z));
        meat.position.copy(local); meat.rotation.set(arc.spin, arc.spin * .6, arc.spin * .3);
        meat.scale.setScalar(2.1);
      }
      syncTrail(f, flying);
    }
  }

  function syncTrail(f, flying) {
    let trail = trails.get(f.key);
    if (flying && !trail) {
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const a = meatArc(f.from, f.to, i / 24), h = groundHeight(a.x, a.y) ?? 0, w = ranchNativeToWorld(a.x, a.y, h + a.z / 16);
        points.push(new THREE.Vector3(w.x, w.y, w.z));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color: GOLD, dashSize: .14, gapSize: .1, transparent: true, opacity: .95, depthWrite: false }));
      line.computeLineDistances(); line.renderOrder = 9; line.material.depthTest = false; scene.add(line);
      trail = { line, fade: 1, total: line.geometry.attributes.position.count };
      trails.set(f.key, trail);
    }
    if (!trail) return;
    trail.seen = true;
    if (flying) {
      // The trail draws behind the meat as it flies.
      trail.line.geometry.setDrawRange(0, Math.max(2, Math.ceil(trail.total * Math.min(1, f.t / .55))));
      trail.fade = 1;
    } else trail.fade -= .06;
    trail.line.material.opacity = Math.max(0, .95 * trail.fade);
    if (trail.fade <= 0) { scene.remove(trail.line); trail.line.geometry.dispose(); trail.line.material.dispose(); trails.delete(f.key); }
  }

  /** Draw one frame: `frame` from the app's auto-care world (native px). */
  function sync(frame, { time = 0, visible = true } = {}) {
    for (const item of live.values()) item.seen = false;
    for (const trail of trails.values()) trail.seen = false;
    if (visible && frame) {
      for (const m of frame.cleaners ?? []) syncCleaner(m, time);
      for (const f of frame.feeders ?? []) syncFeeder(f, time);
    }
    for (const [key, item] of live) {
      item.root.visible = item.seen;
      if (!item.seen && !visible) continue;
      if (!item.seen) { scene.remove(item.root); live.delete(key); }
    }
    for (const [key, trail] of trails) if (!trail.seen && !visible) trail.line.visible = false;
  }

  function dispose() {
    disposed = true;
    for (const item of live.values()) scene.remove(item.root);
    for (const trail of trails.values()) { scene.remove(trail.line); trail.line.geometry.dispose(); trail.line.material.dispose(); }
    live.clear(); trails.clear();
    shadowTexture.dispose(); shadowMaterial.dispose(); shadowGeometry.dispose();
  }
  return { sync, dispose, diagnostics: () => ({ source: { ...source }, machines: live.size,
    cleaners: [...live.values()].filter((i) => i.kind === 'cleaner' && i.root.visible).length,
    feeders: [...live.values()].filter((i) => i.kind === 'feeder' && i.root.visible).length }) };
}
