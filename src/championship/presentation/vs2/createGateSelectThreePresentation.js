// VS2-R1 -- bounded Three.js presentation for Gate Select.
//
// This scene is original-created Championship 2026 geometry. It carries no ROM
// model, decoded texture, gameplay state, router, save authority or animation
// ticker. Selection always returns through the injected selectGate intent and
// every selected visual is repainted from the published source frame.

import * as THREE from "../../../../node_modules/three/build/three.module.js";

const NODE_PALETTE = Object.freeze([
  0xd08a58, 0x9ca5aa, 0x659f9a, 0xe0b75e,
  0x78aeb8, 0x6eaa78, 0x89b765, 0xb5d8df,
  0x68a568, 0xb78b5d, 0xd5bd69, 0xb28f72,
  0xc6a363, 0x62a9bb, 0x79919a, 0xd46e4f
]);

function terrainValue(position) {
  const { x, y, z } = position;
  return (
    Math.sin((x * 2.7) + (z * 1.3)) +
    Math.cos((y * 4.1) - (x * 1.9)) +
    Math.sin((z * 5.3) + (y * 2.2))
  ) / 3;
}

function createWorldGeometry({ night = false } = {}) {
  const geometry = new THREE.SphereGeometry(2.08, 72, 48);
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  const ocean = new THREE.Color(night ? 0x05111d : 0x0b3442);
  const land = new THREE.Color(night ? 0x123338 : 0x356b62);
  const ridge = new THREE.Color(night ? 0x32493f : 0x7e8b64);

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).normalize();
    const value = terrainValue(point);
    const color = value > 0.24 ? ridge : value > -0.08 ? land : ocean;
    const latitudeLight = 0.82 + (Math.abs(point.y) * 0.16);
    colors[index * 3] = color.r * latitudeLight;
    colors[(index * 3) + 1] = color.g * latitudeLight;
    colors[(index * 3) + 2] = color.b * latitudeLight;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function fibonacciDirection(index, count) {
  const offset = 2 / count;
  const y = ((index * offset) - 1) + (offset / 2);
  const radius = Math.sqrt(1 - (y * y));
  const phi = index * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(phi) * radius, y, Math.sin(phi) * radius).normalize();
}

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) if (material) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function mountGateSelectThreePresentation({ host, gates, onSelect }) {
  if (!host || !Array.isArray(gates) || gates.length !== 16 || typeof onSelect !== "function") {
    throw new Error("CHAMPIONSHIP_GATE_3D_INVALID_BINDING");
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "cm-vs2-gate3d__canvas";
  renderer.domElement.dataset.renderer = "THREE_BOUNDED_GATE_SELECT";
  renderer.domElement.dataset.interactionAuthority = "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER";
  renderer.domElement.setAttribute("aria-label", "Rotatable world destination view");
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.style.touchAction = "none";

  const overlay = document.createElement("div");
  overlay.className = "cm-vs2-gate3d__nodes";
  overlay.setAttribute("aria-label", "World destination nodes");
  host.append(renderer.domElement, overlay);

  const scene = new THREE.Scene();
  scene.name = "gate_select_bounded_scene";
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.name = "PRODUCT_AUTHORED_GATE_CAMERA";
  camera.position.set(0, 0.05, 10.2);

  scene.add(new THREE.HemisphereLight(0x91c7d1, 0x071018, 2.15));
  const keyLight = new THREE.DirectionalLight(0xffdf9a, 3.3);
  keyLight.position.set(4.2, 3.5, 5.5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x55c8dc, 9, 14, 2);
  rimLight.position.set(-4.2, -1.4, 3.8);
  scene.add(rimLight);

  const worldRoot = new THREE.Group();
  worldRoot.name = "world_root";
  worldRoot.rotation.set(-0.16, 0.42, -0.04);
  scene.add(worldRoot);

  const world = new THREE.Group();
  world.name = "world";
  worldRoot.add(world);

  const worldDay = new THREE.Mesh(createWorldGeometry(), new THREE.MeshStandardMaterial({
    name: "ORIGINAL_CREATED_WORLD_DAY", vertexColors: true, roughness: 0.82, metalness: 0.12
  }));
  worldDay.name = "world_day";
  const worldNight = new THREE.Mesh(createWorldGeometry({ night: true }), new THREE.MeshStandardMaterial({
    name: "ORIGINAL_CREATED_WORLD_NIGHT", vertexColors: true, roughness: 0.74, metalness: 0.22,
    emissive: 0x07121a, emissiveIntensity: 0.62
  }));
  worldNight.name = "world_night";
  worldNight.visible = false;
  world.add(worldDay, worldNight);

  const grid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.105, 4),
    new THREE.MeshBasicMaterial({ color: 0x79bcc4, wireframe: true, transparent: true, opacity: 0.075 })
  );
  grid.name = "ORIGINAL_CREATED_TECHNICAL_LONGITUDE_SHELL";
  world.add(grid);

  const equator = new THREE.Mesh(
    new THREE.TorusGeometry(2.25, 0.008, 8, 144),
    new THREE.MeshBasicMaterial({ color: 0xd2ad5d, transparent: true, opacity: 0.34 })
  );
  equator.name = "ORIGINAL_CREATED_WORLD_REFERENCE_RING";
  equator.rotation.x = Math.PI / 2;
  world.add(equator);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.72, 0.012, 8, 144),
    new THREE.MeshBasicMaterial({ color: 0x65b8c3, transparent: true, opacity: 0.3 })
  );
  halo.name = "ORIGINAL_CREATED_GATE_HALO";
  halo.rotation.set(1.18, 0.28, 0.22);
  worldRoot.add(halo);

  const neutralRingMaterial = new THREE.MeshBasicMaterial({ color: 0x7bc8d1, transparent: true, opacity: 0.82 });
  const selectedRingMaterial = new THREE.MeshBasicMaterial({ color: 0xf0d58c, transparent: true, opacity: 1 });
  const nodeRecords = [];
  const pickTargets = [];

  gates.forEach((gate, index) => {
    const direction = fibonacciDirection(index, gates.length);
    const parent = new THREE.Group();
    parent.name = `${gate.displayName}parent`;
    parent.position.copy(direction).multiplyScalar(2.16);
    parent.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    const node = new THREE.Group();
    node.name = gate.displayName;
    node.userData.gateId = gate.gateId;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.024, 12, 28), neutralRingMaterial);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 1),
      new THREE.MeshStandardMaterial({ color: NODE_PALETTE[index], emissive: NODE_PALETTE[index], emissiveIntensity: 0.28, roughness: 0.42, metalness: 0.35 })
    );
    ring.userData.gateId = gate.gateId;
    core.userData.gateId = gate.gateId;
    node.add(ring, core);
    parent.add(node);
    worldRoot.add(parent);
    pickTargets.push(core, ring);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-vs2-gate3d__node-hit";
    button.dataset.gateId = gate.gateId;
    button.setAttribute("aria-label", `Select ${gate.displayName} biome destination`);
    const indexLabel = document.createElement("span");
    indexLabel.className = "cm-vs2-gate3d__node-index";
    indexLabel.textContent = String(gate.ordinal).padStart(2, "0");
    const nameLabel = document.createElement("span");
    nameLabel.className = "cm-vs2-gate3d__node-name";
    nameLabel.textContent = gate.displayName;
    button.append(indexLabel, nameLabel);
    button.addEventListener("click", () => onSelect(gate.gateId));
    overlay.append(button);
    nodeRecords.push({ gateId: gate.gateId, parent, node, ring, button });
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerState = { active: false, id: -1, x: 0, y: 0, moved: 0 };
  const projected = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  let disposed = false;

  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }

  function positionNodeButtons() {
    cameraDirection.copy(camera.position).normalize();
    const width = Math.max(44, host.clientWidth);
    const height = Math.max(44, host.clientHeight);
    for (const record of nodeRecords) {
      record.parent.getWorldPosition(worldPosition);
      const facing = worldPosition.clone().normalize().dot(cameraDirection);
      projected.copy(worldPosition).project(camera);
      const visible = facing > 0.12 && projected.z > -1 && projected.z < 1;
      record.button.hidden = !visible;
      if (!visible) continue;
      const x = THREE.MathUtils.clamp(((projected.x * 0.5) + 0.5) * width, 22, width - 22);
      const y = THREE.MathUtils.clamp(((-projected.y * 0.5) + 0.5) * height, 22, height - 22);
      record.button.style.left = `${x}px`;
      record.button.style.top = `${y}px`;
    }
  }

  function draw() {
    if (disposed) return;
    camera.updateMatrixWorld(true);
    worldRoot.updateMatrixWorld(true);
    positionNodeButtons();
    renderer.render(scene, camera);
  }

  function selectFromCanvas(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = (((event.clientX - rect.left) / rect.width) * 2) - 1;
    pointer.y = -((((event.clientY - rect.top) / rect.height) * 2) - 1);
    raycaster.setFromCamera(pointer, camera);
    const gateId = raycaster.intersectObjects(pickTargets, false)[0]?.object?.userData?.gateId;
    if (gateId) onSelect(gateId);
  }

  function onPointerDown(event) {
    pointerState.active = true;
    pointerState.id = event.pointerId;
    pointerState.x = event.clientX;
    pointerState.y = event.clientY;
    pointerState.moved = 0;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!pointerState.active || event.pointerId !== pointerState.id) return;
    const dx = event.clientX - pointerState.x;
    const dy = event.clientY - pointerState.y;
    pointerState.x = event.clientX;
    pointerState.y = event.clientY;
    pointerState.moved += Math.abs(dx) + Math.abs(dy);
    worldRoot.rotation.y += dx * 0.008;
    worldRoot.rotation.x = THREE.MathUtils.clamp(worldRoot.rotation.x + (dy * 0.006), -0.72, 0.72);
    draw();
  }

  function onPointerUp(event) {
    if (!pointerState.active || event.pointerId !== pointerState.id) return;
    if (pointerState.moved < 7) selectFromCanvas(event);
    pointerState.active = false;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerUp);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return Object.freeze({
    render(frame) {
      const block = frame?.gateSelect;
      if (!block) return;
      const selected = new Set(block.gates.filter((gate) => gate.selected).map((gate) => gate.gateId));
      for (const record of nodeRecords) {
        const active = selected.has(record.gateId);
        record.ring.material = active ? selectedRingMaterial : neutralRingMaterial;
        record.node.scale.setScalar(active ? 1.32 : 1);
        record.button.dataset.selected = String(active);
        record.button.setAttribute("aria-pressed", String(active));
      }
      draw();
    },
    getDiagnostics() {
      return Object.freeze({
        renderer: "THREE_BOUNDED_GATE_SELECT",
        rendererCount: 1,
        sceneScope: "GATE_SELECT_ONLY",
        selectionAuthority: "PUBLISHED_SOURCE_FRAME_AND_SELECT_GATE_INTENT",
        modelRights: "ORIGINAL_CREATED",
        sourceAssetCount: 0,
        romModelLoaded: false,
        decodedTextureLoaded: false,
        earthUsed: false,
        dayNightPairedStates: 2,
        activePreviewState: "PRODUCT_AUTHORED_DAY_PREVIEW",
        cameraAuthority: "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER",
        rotationAuthority: "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER",
        inputAuthority: "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER",
        hitTestAuthority: "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER",
        originalRotationParityClaimed: false,
        renderLoop: "NONE_EVENT_DRIVEN"
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      disposeObject(scene);
      selectedRingMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      overlay.remove();
    }
  });
}
