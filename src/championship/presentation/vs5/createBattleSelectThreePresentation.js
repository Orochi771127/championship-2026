// VS5 -- bounded Three.js presentation for the Battle menu cube.
//
// WHY A CUBE, AND WHY THESE FACES
// -------------------------------
// The original presents the battle menu as a rotating box, not a list. The model
// battle_menu/launcher13.nsbmd includes the following named material groups:
//
//     launcher13 / main / box / text
//     _00_edge  _01_edgelight                 the box's edge trim
//     _02_champ_bg   _02_champ_l   _02_champ_u
//     _03_title_bg   _03_title_l   _03_title_u
//     _04_free_bg    _04_free_l    _04_free_u
//     _05_tushin_bg
//
// These four identities agree with the help topics. The source ALSO contains
// _06_password and _07_rensyu groups; this is the Owner-requested four-face
// batch, not a claim that the original contains only four menu identities.
// _l/_u meanings and original face directions are not traced. The artwork's
// background/emblem/label split and orientation are PRODUCT_AUTHORED.
//
// THIS CARRIES NO ROM GEOMETRY
// ----------------------------
// Like the Gate world sphere, the box here is original-created Championship 2026
// geometry. The cartridge model supplies reference names and a box structure.
// No MDL0 is loaded, no TEX0 is decoded, and
// the palette and proportions are this product's own.
//
// It holds no gameplay state, router, save authority or ticker. Selection always
// leaves through the injected onSelect.

import * as THREE from "../../../../node_modules/three/build/three.module.js";
import { BATTLE_FACE_LABELS } from "../../text/zhHant.js";
import { BATTLE_CUBE_ART_ID, resolveBattleCubeArt } from "./battleCubeArt.js";

/** ROM_VERIFIED identities; this four-entry subset does not establish the original total. */
export const BATTLE_CUBE_FACES = Object.freeze([
  Object.freeze({ id: "CHAMPIONSHIP", node: "_02_champ", label: BATTLE_FACE_LABELS.CHAMPIONSHIP, helpTopic: 72 }),
  Object.freeze({ id: "TITLE_MATCH", node: "_03_title", label: BATTLE_FACE_LABELS.TITLE_MATCH, helpTopic: 71 }),
  Object.freeze({ id: "FREE_BATTLE", node: "_04_free", label: BATTLE_FACE_LABELS.FREE_BATTLE, helpTopic: 70 }),
  Object.freeze({ id: "LINK_BATTLE", node: "_05_tushin", label: BATTLE_FACE_LABELS.LINK_BATTLE, helpTopic: 73 })
]);

export const BATTLE_CUBE_FACE_EVIDENCE = "ROM_VERIFIED";
export const BATTLE_CUBE_SOURCE_MODEL = "battle_menu/launcher13.nsbmd";
/** Which face sits on which side of the box in the original is not traced. */
export const BATTLE_CUBE_ORIENTATION_EVIDENCE = "PRODUCT_AUTHORED";

const FACE_COLOUR = Object.freeze({
  CHAMPIONSHIP: 0xd8b45c,
  TITLE_MATCH: 0xc4694c,
  FREE_BATTLE: 0x5d9fb5,
  LINK_BATTLE: 0x6f8f74
});

const EDGE_COLOUR = 0x1a2c38;
const UNLABELLED_COLOUR = 0x24404f;

/**
 * Face materials in Three's BoxGeometry order: +X, -X, +Y, -Y, +Z, -Z.
 *
 * The four labelled faces take the four side positions so that rotating about Y
 * cycles through them; the top and bottom stay plain. That arrangement is this
 * product's choice -- see BATTLE_CUBE_ORIENTATION_EVIDENCE.
 */
const SIDE_ORDER = Object.freeze(["TITLE_MATCH", "LINK_BATTLE", null, null, "CHAMPIONSHIP", "FREE_BATTLE"]);

function faceMaterials() {
  return SIDE_ORDER.map((faceId) => new THREE.MeshStandardMaterial({
    color: faceId ? FACE_COLOUR[faceId] : UNLABELLED_COLOUR,
    roughness: 0.55,
    metalness: 0.18,
    emissive: 0x000000
  }));
}

/**
 * Mount the battle cube.
 *
 * @param {object} binding
 * @param {HTMLElement} binding.host
 * @param {(faceId: string) => void} binding.onSelect
 * @param {Set<string>|null} [binding.available] face ids that lead somewhere
 */
export function mountBattleSelectThreePresentation({ host, onSelect, available = null, textureLoader = new THREE.TextureLoader() } = {}) {
  if (!host || typeof onSelect !== "function") {
    throw new Error("CHAMPIONSHIP_BATTLE_CUBE_INVALID_BINDING");
  }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { return mountFlatFallback({ host, onSelect, available }); }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "cm-vs5-cube__canvas";
  renderer.domElement.dataset.renderer = "THREE_BOUNDED_BATTLE_SELECT";
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "戰鬥選單立方體，拖曳或使用左右方向鍵旋轉");
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.touchAction = "none";

  // Every face also exists as a real button. The box is the original's
  // presentation; the buttons are how it stays operable without a pointer drag.
  const overlay = document.createElement("div");
  overlay.className = "cm-vs5-cube__faces";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "對戰模式");

  host.append(renderer.domElement, overlay);

  const scene = new THREE.Scene();
  scene.name = "battle_select_bounded_scene";
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 0.9, 6.4);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0x9fd0dd, 0x0a151d, 2.0));
  const key = new THREE.DirectionalLight(0xffe9b8, 2.6);
  key.position.set(3.4, 4.2, 4.0);
  scene.add(key);

  const materials = faceMaterials();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), materials);
  cube.name = "launcher13_box_equivalent";
  scene.add(cube);

  // _00_edge / _01_edgelight in the original: the box is outlined, not bare.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: EDGE_COLOUR })
  );
  cube.add(edges);

  let selected = null;
  const buttons = new Map();

  for (const face of BATTLE_CUBE_FACES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-vs5-cube__face";
    button.dataset.faceId = face.id;
    button.dataset.romNode = face.node;
    button.textContent = face.label;
    const reachable = available === null || available.has(face.id);
    button.disabled = !reachable;
    if (!reachable) {
      button.dataset.state = "NOT_IMPLEMENTED";
      button.title = "此模式尚未開放";
    }
    button.addEventListener("click", () => {
      if (button.disabled) return;
      selected = face.id;
      paint();
      draw();
      onSelect(face.id);
    });
    overlay.append(button);
    buttons.set(face.id, button);
  }

  function paint() {
    SIDE_ORDER.forEach((faceId, index) => {
      if (!faceId) return;
      materials[index].emissive.setHex(faceId === selected ? 0x2a2410 : 0x000000);
    });
    for (const [faceId, button] of buttons) {
      button.setAttribute("aria-pressed", String(faceId === selected));
    }
  }

  let disposed = false;
  let spin = 0.6;
  let dragging = false;
  let lastX = 0;
  const textures = new Set();
  const textureStates = Object.fromEntries(BATTLE_CUBE_FACES.map(face => [face.id, "UNAVAILABLE"]));

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, Math.round(width * 0.72));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // Drawn ON DEMAND, never on a loop. This product runs exactly one ticker and
  // it belongs to the Pixi stage; a second animation loop here would be a second
  // ticker, which the architecture forbids. The Gate world sphere is drawn the
  // same way -- the box turns when the player turns it.
  function draw() {
    if (disposed) return;
    cube.rotation.y = spin;
    cube.rotation.x = Math.sin(spin * 0.5) * 0.12;
    renderer.render(scene, camera);
  }

  const startDrag = (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    renderer.domElement.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!dragging) return;
    spin += (event.clientX - lastX) * 0.01;
    lastX = event.clientX;
    draw();
  };
  const endDrag = () => { dragging = false; };
  const rotateKey = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    spin += event.key === "ArrowLeft" ? -Math.PI / 2 : Math.PI / 2;
    draw();
  };
  renderer.domElement.addEventListener("pointerdown", startDrag);
  renderer.domElement.addEventListener("pointermove", moveDrag);
  renderer.domElement.addEventListener("pointerup", endDrag);
  renderer.domElement.addEventListener("pointercancel", endDrag);
  renderer.domElement.addEventListener("lostpointercapture", endDrag);
  renderer.domElement.addEventListener("keydown", rotateKey);
  const restored = () => { if (!disposed) draw(); };
  renderer.domElement.addEventListener("webglcontextrestored", restored);
  const observer = new ResizeObserver(() => { if (!disposed) { resize(); draw(); } });
  observer.observe(host);

  const ready = Promise.all(resolveBattleCubeArt().map(async face => {
    textureStates[face.id] = "LOADING";
    try {
      const texture = await textureLoader.loadAsync(face.url);
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      textures.add(texture);
      const material = materials[SIDE_ORDER.indexOf(face.id)];
      material.map = texture;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
      textureStates[face.id] = "READY";
      draw();
    } catch {
      if (!disposed) textureStates[face.id] = "FALLBACK_COLOUR";
    }
    if (!disposed) host.dataset.cubeTextures = String(textures.size);
  }));

  resize();
  paint();
  draw();

  return Object.freeze({
    ready,
    getSelected() {
      return selected;
    },

    getDiagnostics() {
      return Object.freeze({
        renderer: "THREE_BOUNDED_BATTLE_SELECT",
        rendererCount: 1,
        sceneScope: "BATTLE_SELECT_ONLY",
        faceCount: BATTLE_CUBE_FACES.length,
        faceEvidence: BATTLE_CUBE_FACE_EVIDENCE,
        orientationEvidence: BATTLE_CUBE_ORIENTATION_EVIDENCE,
        sourceModel: BATTLE_CUBE_SOURCE_MODEL,
        modelRights: "ORIGINAL_CREATED",
        romModelLoaded: false,
        decodedTextureLoaded: false,
        selectionAuthority: "INJECTED_ON_SELECT_INTENT",
        artAssetId: BATTLE_CUBE_ART_ID,
        textureCount: textures.size,
        textureStates: Object.freeze({ ...textureStates }),
        rotation: spin,
        disposed
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      for (const [type, handler] of [["pointerdown", startDrag], ["pointermove", moveDrag], ["pointerup", endDrag], ["pointercancel", endDrag], ["lostpointercapture", endDrag], ["keydown", rotateKey], ["webglcontextrestored", restored]]) renderer.domElement.removeEventListener(type, handler);
      for (const texture of textures) texture.dispose();
      textures.clear();
      cube.geometry.dispose();
      edges.geometry.dispose();
      edges.material.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      overlay.remove();
      delete host.dataset.cubeTextures;
    }
  });
}

function mountFlatFallback({ host, onSelect, available }) {
  const grid = document.createElement("div");
  grid.className = "cm-vs5-cube__fallback";
  grid.setAttribute("aria-label", "對戰模式");
  const art = resolveBattleCubeArt();
  let selected = null;
  for (const face of BATTLE_CUBE_FACES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-vs5-cube__face";
    button.dataset.faceId = face.id;
    button.disabled = available !== null && !available.has(face.id);
    const entry = art.find(row => row.id === face.id);
    if (entry) {
      const img = document.createElement("img");
      img.src = entry.url;
      img.alt = "";
      img.addEventListener("error", () => img.remove(), { once: true });
      button.append(img);
    }
    button.append(document.createTextNode(face.label));
    button.addEventListener("click", () => { if (!button.disabled) { selected = face.id; onSelect(face.id); } });
    grid.append(button);
  }
  host.append(grid);
  return Object.freeze({
    ready: Promise.resolve(),
    getSelected: () => selected,
    getDiagnostics: () => Object.freeze({ renderer: "DOM_BATTLE_CUBE_FALLBACK", faceCount: 4, textureCount: 0, artAssetId: BATTLE_CUBE_ART_ID }),
    dispose: () => grid.remove()
  });
}
