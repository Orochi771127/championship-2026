import { uiText } from "../../text/uiText.js";
import { cappedPixelRatio, currentQuality } from "../presentationPreferences.js";
// VS2-R1 -- bounded Three.js presentation for Gate Select.
//
// This scene is original-created Championship 2026 geometry. It carries no ROM
// model, decoded texture, gameplay state, router, save authority or animation
// ticker. Selection always returns through the injected selectGate intent and
// every selected visual is repainted from the published source frame.

import * as THREE from "../../../../node_modules/three/build/three.module.js";
import { GATE_WORLD_REGIONS, gateWorldPoint, gateWorldRegion, sampleGateWorld } from './gateWorldLayout.js';

export function createGateWorldGeometry({ night = false } = {}) {
  const geometry = new THREE.SphereGeometry(2.08, 96, 64);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const point = new THREE.Vector3(), color = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).normalize();
    const surface = sampleGateWorld(point.toArray());
    position.setXYZ(index, point.x * surface.radius, point.y * surface.radius, point.z * surface.radius);
    color.setHex(surface.color);
    if (night) color.multiplyScalar(0.34);
    color.toArray(colors, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// All static landmarks share one geometry/material per paired state. Their
// coordinates use the same authored region frame as the terrain and marker.
export function createGateLandmarkGeometry() {
  const positions = [], normals = [], colors = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const region of GATE_WORLD_REGIONS) {
    function add(source, tint, east, north, height = 0, yaw = 0) {
      const direction = new THREE.Vector3(...gateWorldPoint(region, east, north));
      const surface = sampleGateWorld(direction.toArray());
      const orientation = new THREE.Quaternion().setFromUnitVectors(up, direction);
      orientation.multiply(new THREE.Quaternion().setFromAxisAngle(up, yaw));
      const transform = new THREE.Matrix4().compose(direction.clone().multiplyScalar(surface.radius + height), orientation, new THREE.Vector3(1, 1, 1));
      const geometry = source.index ? source.toNonIndexed() : source.clone();
      geometry.applyMatrix4(transform);
      const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
      const color = new THREE.Color(tint);
      for (let i = 0; i < p.count; i += 1) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        colors.push(color.r, color.g, color.b);
      }
      source.dispose(); geometry.dispose();
    }
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const cone = (radius, height, top = 0) => new THREE.CylinderGeometry(top, radius, height, 6);
    function tree(x, y, kind = 'round') {
      add(cone(0.024, 0.14, 0.018), 0x6c6041, x, y, 0.065);
      if (kind === 'flat') {
        const crown = new THREE.IcosahedronGeometry(0.12, 0); crown.scale(1.45, 0.32, 1);
        add(crown, 0x6e7b3d, x, y, 0.17);
      } else add(new THREE.IcosahedronGeometry(kind === 'jungle' ? 0.15 : 0.12, 0), kind === 'jungle' ? 0x2d573b : 0x416b3b, x, y, 0.18);
    }
    switch (region.landmark) {
      case 'terraces':
        for (const [x, y] of [[-0.14, 0.10], [0.15, -0.12]]) {
          add(cone(0.24, 0.12, 0.20), 0x8c5239, x, y, 0.05);
          add(cone(0.20, 0.09, 0.16), 0xc28758, x, y, 0.14);
          add(cone(0.16, 0.05, 0.15), 0xdda974, x, y, 0.21);
        } break;
      case 'crags': case 'icebergs': case 'quarry':
        for (const [x, y, h] of [[-0.14, 0.12, 0.36], [0.14, 0.13, 0.24], [0.13, -0.14, 0.18]]) {
          add(cone(0.15, h, 0.015), region.landmark === 'icebergs' ? 0xd5e9e6 : 0x72716a, x, y, h * 0.4);
          if (region.landmark === 'icebergs') add(cone(0.07, h * 0.4), 0xf0f7ee, x, y, h * 0.8);
        }
        if (region.landmark === 'quarry') {
          add(box(0.23, 0.13, 0.12), 0x574a3d, -0.13, -0.12, 0.06);
          add(box(0.11, 0.09, 0.025), 0x231f1d, -0.13, -0.15, 0.045);
          add(box(0.20, 0.025, 0.25), 0xb2a17b, -0.13, -0.20, 0.015);
        } break;
      case 'woodland': case 'canopy': case 'wetland': case 'meadow': case 'acacias':
        for (const [x, y] of (region.landmark === 'meadow' ? [[-0.16, 0.12], [0.19, -0.10]]
          : [...[[-0.16, 0.12], [0.16, 0.14], [-0.12, -0.16], [0.19, -0.10]],
            ...(['woodland', 'canopy'].includes(region.landmark) ? [[-0.25, -0.02], [0.25, 0.02], [0.02, 0.24], [-0.02, -0.25]] : [])])) {
          tree(x, y, region.landmark === 'acacias' ? 'flat' : region.landmark === 'canopy' ? 'jungle' : 'round');
        }
        if (region.landmark === 'wetland') add(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 10), 0x4b7770, 0.16, -0.12, 0.005);
        break;
      case 'dunes':
        for (const [x, y] of [[-0.16, 0.13], [0.16, 0.13], [0.10, -0.16]]) {
          const dune = new THREE.SphereGeometry(0.20, 8, 5); dune.scale(1.5, 0.35, 0.8);
          add(dune, 0xdbb678, x, y, 0.015, 0.4);
        } break;
      case 'spring': case 'shore':
        tree(-0.16, 0.11, 'flat'); tree(region.landmark === 'shore' ? -0.14 : 0.14, -0.15, 'flat');
        if (region.landmark === 'spring') add(new THREE.CylinderGeometry(0.17, 0.19, 0.016, 12), 0x52a4b1, 0.17, 0.12, 0.01);
        else {
          add(box(0.27, 0.025, 0.07), 0xc9c09a, 0.16, 0.02, 0.03, 0.4);
        } break;
      case 'works':
        for (const [x, y] of [[-0.15, 0.12], [0.15, -0.15]]) {
          add(box(0.30, 0.12, 0.20), 0x7f8986, x, y, 0.055);
          add(box(0.32, 0.025, 0.22), 0xb3ab83, x, y, 0.13);
          add(cone(0.035, 0.26, 0.03), 0x5e6866, x + 0.04, y, 0.23);
        } break;
      case 'columns':
        for (const [x, y] of [[-0.14, 0.12], [0.15, -0.14]]) {
          add(box(0.32, 0.035, 0.19), 0xaca783, x, y, 0.02);
          add(box(0.055, 0.23, 0.07), 0xc6c2a0, x - 0.05, y, 0.15);
          add(box(0.055, 0.18, 0.07), 0xb6b08b, x + 0.05, y, 0.12);
          add(box(0.28, 0.04, 0.09), 0xc4be9a, x, y, 0.28);
        } break;
      case 'channels':
        for (const x of [-0.16, 0.16]) {
          add(box(0.17, 0.025, 0.58), 0x4c8c7f, x, 0.02, 0.012);
          for (const side of [-1, 1]) add(box(0.035, 0.07, 0.61), 0xa4a698, x + side * 0.045, 0.02, 0.04);
          add(box(0.27, 0.07, 0.10), 0x989c8f, x, -0.12, 0.09);
        } break;
      case 'caldera': {
        add(cone(0.34, 0.33, 0.13), 0x5a4941, -0.12, 0.12, 0.12);
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 10), 0xe4793d, -0.12, 0.12, 0.29);
        add(cone(0.17, 0.20, 0.02), 0x735441, 0.15, -0.13, 0.075);
        break;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
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
  if (new Set(gates.map(gate => gate.biomeId)).size !== 16 || gates.some(gate => !gateWorldRegion(gate.biomeId))) {
    throw new Error('CHAMPIONSHIP_GATE_3D_UNKNOWN_BIOME');
  }

  // The quality tier, read when the globe mounts: next Gate visit for a change.
  const quality = currentQuality();
  const renderer = new THREE.WebGLRenderer({ antialias: quality.threeAntialias, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "cm-vs2-gate3d__canvas";
  renderer.domElement.dataset.renderer = "THREE_BOUNDED_GATE_SELECT";
  renderer.domElement.dataset.interactionAuthority = "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER";
  renderer.domElement.setAttribute("aria-label", uiText("Rotatable world destination view"));
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.style.touchAction = "none";

  const overlay = document.createElement("div");
  overlay.className = "cm-vs2-gate3d__nodes";
  overlay.setAttribute("aria-label", uiText("World destination nodes"));
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

  const worldDay = new THREE.Mesh(createGateWorldGeometry(), new THREE.MeshStandardMaterial({
    name: "ORIGINAL_CREATED_WORLD_DAY", vertexColors: true, roughness: 0.82, metalness: 0.12
  }));
  worldDay.name = "world_day";
  const worldNight = new THREE.Mesh(createGateWorldGeometry({ night: true }), new THREE.MeshStandardMaterial({
    name: "ORIGINAL_CREATED_WORLD_NIGHT", vertexColors: true, roughness: 0.74, metalness: 0.22,
    emissive: 0x07121a, emissiveIntensity: 0.62
  }));
  worldNight.name = "world_night";
  worldNight.visible = false;
  const landmarks = createGateLandmarkGeometry();
  worldDay.add(new THREE.Mesh(landmarks, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 })));
  worldNight.add(new THREE.Mesh(landmarks, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x667c86, roughness: 0.94 })));
  world.add(worldDay, worldNight);

  const grid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.105, 4),
    new THREE.MeshBasicMaterial({ color: 0x79bcc4, wireframe: true, transparent: true, opacity: 0.075 })
  );
  grid.name = "ORIGINAL_CREATED_TECHNICAL_LONGITUDE_SHELL";
  grid.visible = false;
  world.add(grid);

  const equator = new THREE.Mesh(
    new THREE.TorusGeometry(2.25, 0.008, 8, 144),
    new THREE.MeshBasicMaterial({ color: 0xd2ad5d, transparent: true, opacity: 0.34 })
  );
  equator.name = "ORIGINAL_CREATED_WORLD_REFERENCE_RING";
  equator.visible = false;
  equator.rotation.x = Math.PI / 2;
  world.add(equator);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.72, 0.012, 8, 144),
    new THREE.MeshBasicMaterial({ color: 0x65b8c3, transparent: true, opacity: 0.3 })
  );
  halo.name = "ORIGINAL_CREATED_GATE_HALO";
  halo.visible = false;
  halo.rotation.set(1.18, 0.28, 0.22);
  worldRoot.add(halo);

  const neutralRingMaterial = new THREE.MeshBasicMaterial({ color: 0x7bc8d1, transparent: true, opacity: 0.82 });
  const selectedRingMaterial = new THREE.MeshBasicMaterial({ color: 0xf0d58c, transparent: true, opacity: 1 });
  const nodeRecords = [];
  const pickTargets = [];

  gates.forEach((gate) => {
    const region = gateWorldRegion(gate.biomeId);
    const direction = new THREE.Vector3(...region.direction);
    const parent = new THREE.Group();
    parent.name = `${gate.displayName}parent`;
    parent.position.copy(direction).multiplyScalar(sampleGateWorld(region.direction).radius + 0.08);
    parent.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    const node = new THREE.Group();
    node.name = gate.displayName;
    node.userData.gateId = gate.gateId;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.024, 12, 28), neutralRingMaterial);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 1),
      new THREE.MeshStandardMaterial({ color: region.accent, emissive: region.accent, emissiveIntensity: 0.28, roughness: 0.42, metalness: 0.35 })
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
    button.dataset.biomeId = gate.biomeId;
    button.setAttribute("aria-label", uiText(`Select ${gate.displayName} biome destination`));
    const indexLabel = document.createElement("span");
    indexLabel.className = "cm-vs2-gate3d__node-index";
    indexLabel.textContent = String(gate.ordinal).padStart(2, "0");
    const nameLabel = document.createElement("span");
    nameLabel.className = "cm-vs2-gate3d__node-name";
    nameLabel.textContent = uiText(gate.displayName);
    button.append(indexLabel, nameLabel);
    button.addEventListener("click", () => onSelect(gate.gateId));
    overlay.append(button);
    // Wetland pools and the quarry entrance sit below their inland markers.
    const preferLabelAbove = ['wetland', 'quarry'].includes(region.landmark);
    nodeRecords.push({ gateId: gate.gateId, parent, node, ring, button, nameLabel, preferLabelAbove });
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
    renderer.setPixelRatio(cappedPixelRatio(quality.threePixelRatioCap));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Fit the complete globe, including raised landmarks, on tall viewports.
    camera.position.z = Math.max(10.2, 2.65 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect)));
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
      const visible = facing > 0.24 && projected.z > -1 && projected.z < 1;
      record.button.hidden = !visible;
      if (!visible) continue;
      const x = THREE.MathUtils.clamp(((projected.x * 0.5) + 0.5) * width, 22, width - 22);
      const y = THREE.MathUtils.clamp(((-projected.y * 0.5) + 0.5) * height, 22, height - 22);
      record.button.style.left = `${x}px`;
      record.button.style.top = `${y}px`;
      const halfLabel = Math.min(width - 8, record.nameLabel.offsetWidth) / 2;
      const labelX = THREE.MathUtils.clamp(x, halfLabel + 4, width - halfLabel - 4);
      record.button.style.setProperty('--gate-label-offset', `${labelX - x}px`);
      const labelClearance = record.nameLabel.offsetHeight + 20;
      record.button.dataset.labelAbove = String(y > height - labelClearance || (record.preferLabelAbove && y >= labelClearance));
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
    const visible = new Set(nodeRecords.filter(record => !record.button.hidden).map(record => record.gateId));
    const gateId = raycaster.intersectObjects(pickTargets, false).find(hit => visible.has(hit.object.userData.gateId))?.object?.userData?.gateId;
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
  function onPointerCancel(event) {
    if (event.pointerId !== pointerState.id) return;
    pointerState.active = false;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerCancel);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return Object.freeze({
    render(frame) {
      const block = frame?.gateSelect;
      if (!block) return;
      const selected = new Set(block.gates.filter((gate) => gate.selected).map((gate) => gate.gateId));
      // The node label carries the gate's current availability, so a locked
      // destination reads as locked before the player has to tap it.
      const states = new Map(block.gates.map((gate) => [gate.gateId, gate.state]));
      for (const record of nodeRecords) {
        const active = selected.has(record.gateId);
        record.button.dataset.availability = states.get(record.gateId) ?? "";
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
        geographyAuthority: "OWNER_APPROVED_AUTHORED_BIOME_LAYOUT",
        biomeRegions: GATE_WORLD_REGIONS.map(region => region.biomeId),
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
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      disposeObject(scene);
      selectedRingMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      overlay.remove();
    }
  });
}
