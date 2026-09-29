// Bounded Three.js prop for the important-highlight template: pixel shards.
//
// A fixed number of small cubes -- the pixel-stair signature in three
// dimensions -- gathers to the focus during CHARGE and bursts outward at
// BURST. It owns no loop: the template calls update(deltaMs) from the one
// Championship Pixi ticker, and the canvas stops drawing once every shard has
// landed. No pointer input, no textures, no original assets.

import * as THREE from "../../../../node_modules/three/build/three.module.js";

const SHARD_CAP = 160;
const COLOURS = Object.freeze([0xf4b740, 0xffd27a, 0x56e3c2, 0x86f2d8, 0xffffff]);

function rng(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
}

// lifeScale and antialias come from the quality tier (2026-09-29): saver keeps
// fewer, shorter-lived shards; the renderer is created per run, so a change
// applies to the next highlight. Shards are drawn behind the result plate.
export function mountHighlightBurstThree({ host, count = 96, focus = () => ({ x: 0.5, y: 0.4 }), pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1), seed = 0x5eed, lifeScale = 1, antialias = false } = {}) {
  if (!host?.ownerDocument) throw new TypeError("HIGHLIGHT_BURST_HOST_REQUIRED");
  const total = Math.max(0, Math.min(SHARD_CAP, Math.round(count)));
  const canvas = host.ownerDocument.createElement("canvas");
  canvas.className = "cm-highlight__shards";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: antialias === true, powerPreference: "low-power" });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 20);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(3, 5, 8);
  scene.add(sun);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, total));
  mesh.frustumCulled = false;
  mesh.count = total;
  scene.add(mesh);

  const random = rng(seed);
  const life = Number.isFinite(lifeScale) ? Math.min(2, Math.max(0.3, lifeScale)) : 1;
  const shards = Array.from({ length: total }, (_, index) => {
    const colour = new THREE.Color(COLOURS[index % COLOURS.length]);
    mesh.setColorAt(index, colour);
    return { p: new THREE.Vector3(), v: new THREE.Vector3(), from: new THREE.Vector3(), spin: new THREE.Vector3(random() * 6 - 3, random() * 6 - 3, random() * 6 - 3),
      rot: new THREE.Euler(random() * 6, random() * 6, 0), size: 0.12 + random() * 0.2, life: 0, ttl: (1.1 + random() * 0.5) * life };
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  let mode = "IDLE", clock = 0, convergeSeconds = 0.8, centre = new THREE.Vector3(), halfHeight = 1, halfWidth = 1;
  let frames = 0, renderMs = 0, maxRenderMs = 0, disposed = false, cleared = false;

  function resize() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfWidth = halfHeight * camera.aspect;
    const f = focus();
    centre.set((f.x * 2 - 1) * halfWidth, (1 - f.y * 2) * halfHeight, 0);
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(host);
  resize();
  // Compile the one material now, while the stage is still dimming, so the
  // first frame of CHARGE does not pay for shader compilation.
  try { renderer.compile(scene, camera); } catch { /* compiled on first draw instead */ }

  function write(index, shard, visible) {
    quaternion.setFromEuler(shard.rot);
    const s = visible ? shard.size : 0;
    scale.set(s, s, s);
    matrix.compose(shard.p, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }

  function draw() {
    const started = performance.now();
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    const spent = performance.now() - started;
    frames += 1; renderMs += spent; maxRenderMs = Math.max(maxRenderMs, spent);
  }

  return Object.freeze({
    /** CHARGE: shards start on a wide ring and ease in to the focus. */
    converge(ms = 800) {
      if (disposed) return;
      resize();
      mode = "CONVERGE"; clock = 0; convergeSeconds = Math.max(0.2, ms / 1000);
      shards.forEach((shard, index) => {
        const angle = (index / Math.max(1, total)) * Math.PI * 2 + random() * 0.4;
        const radius = Math.max(halfWidth, halfHeight) * (0.75 + random() * 0.45);
        shard.from.set(centre.x + Math.cos(angle) * radius, centre.y + Math.sin(angle) * radius, (random() - 0.5) * 6);
        shard.p.copy(shard.from);
      });
    },
    /** BURST: every shard leaves the focus at once, then falls and fades. */
    burst() {
      if (disposed) return;
      resize();
      mode = "BURST"; clock = 0;
      for (const shard of shards) {
        const theta = random() * Math.PI * 2, lift = random() * 0.9 + 0.2, speed = 7 + random() * 11;
        shard.p.copy(centre);
        shard.v.set(Math.cos(theta) * speed, Math.sin(theta) * speed * 0.8 + lift * 5, (random() - 0.5) * speed);
        shard.life = 0;
      }
    },
    update(deltaMs) {
      if (disposed || mode === "IDLE" || mode === "DONE") return;
      const dt = Math.min(0.05, Math.max(0, deltaMs / 1000));
      clock += dt;
      if (mode === "CONVERGE") {
        const t = Math.min(1, clock / convergeSeconds), eased = t * t * t;
        shards.forEach((shard, index) => {
          shard.p.lerpVectors(shard.from, centre, eased);
          shard.rot.x += shard.spin.x * dt; shard.rot.y += shard.spin.y * dt;
          write(index, shard, true);
        });
      } else {
        let alive = 0;
        shards.forEach((shard, index) => {
          shard.life += dt;
          const living = shard.life < shard.ttl;
          if (living) {
            alive += 1;
            shard.v.y -= 16 * dt;
            shard.v.multiplyScalar(1 - 1.2 * dt);
            shard.p.addScaledVector(shard.v, dt);
            shard.rot.x += shard.spin.x * dt * 2; shard.rot.y += shard.spin.y * dt * 2;
          }
          write(index, shard, living);
        });
        if (!alive) { mode = "DONE"; draw(); cleared = true; return; }
      }
      draw();
    },
    finished() { return mode === "DONE" || total === 0; },
    stats() {
      return Object.freeze({ shards: total, mode, frames, averageRenderMs: frames ? renderMs / frames : 0, maxRenderMs, cleared });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      geometry.dispose();
      material.dispose();
      mesh.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    }
  });
}
