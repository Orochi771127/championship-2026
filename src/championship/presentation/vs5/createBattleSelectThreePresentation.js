// VS5 -- bounded Three.js presentation for the Battle menu prism.
//
// WHY A PRISM (Owner 2026-11-09)
// ------------------------------
// The original presents the battle menu as a rotating box, not a list (model
// battle_menu/launcher13.nsbmd, material groups _02_champ .. _05_tushin; the
// mode identities agree with the help-bank dispatch traced on 2026-09-14). The
// Owner asked for a commercial-grade redesign: a polygon that turns like the
// box, whose faces ARE the mode keys -- the row of mode buttons under the box
// is gone, and tapping a face does what its button did. The prism has one face
// per mode, so six modes make a hexagonal prism and a seventh mode, added to
// BATTLE_CUBE_FACES, makes it heptagonal with no other change.
//
// THIS CARRIES NO ROM GEOMETRY OR ART
// -----------------------------------
// The prism, its face panels (background, emblem, name, tagline) and the
// pedestal are drawn here from code. No MDL0 or TEX0 is loaded. The four-face
// texture pack (art:battle-select:menu-cube:v1) is kept for the flat fallback
// shown when WebGL is unavailable.
//
// It holds no gameplay state, router, save authority or ticker. The prism is
// drawn on demand; the short settle after a swipe or a press runs on the
// injected ticker (the application's one Pixi ticker) and leaves it as soon as
// the prism comes to rest. Without a ticker, or under reduced motion, the prism
// lands on its face at once. Selection always leaves through onSelect.

import * as THREE from "../../../../node_modules/three/build/three.module.js";
import { BATTLE_FACE_LABELS, battleFaceLabel, battleFaceTagline, battlePrismLabel } from "../../text/zhHant.js";
import { uiText } from "../../text/uiText.js";
import { cappedPixelRatio, currentQuality, prefersReducedMotion } from "../presentationPreferences.js";
import { BATTLE_CUBE_ART_ID, resolveBattleCubeArt } from "./battleCubeArt.js";
import { bindBattlePrismSpin, prismFrontIndex, prismSettleTurn, prismShape, prismTurnFor } from "./battlePrismSpin.js";

/**
 * Mode identities confirmed against OVL10's original help-bank dispatch, in
 * the order they sit round the prism. `accent` matches the arcade key colours
 * the mode buttons used, so a returning player finds each mode in its colour.
 */
export const BATTLE_CUBE_FACES = Object.freeze([
  // Owner 2026-11-10: the product's progression lives behind one face (no new menu modes).
  Object.freeze({ id: "JOURNEY", node: "product_journey", label: BATTLE_FACE_LABELS.JOURNEY, accent: "#6ff7ff", glyph: "tower" }),
  Object.freeze({ id: "CHAMPIONSHIP", node: "_02_champ", label: BATTLE_FACE_LABELS.CHAMPIONSHIP, helpTopic: 72, accent: "#ffd23f", glyph: "crown" }),
  Object.freeze({ id: "TITLE_MATCH", node: "_03_title", label: BATTLE_FACE_LABELS.TITLE_MATCH, helpTopic: 71, accent: "#ff9f1c", glyph: "medal" }),
  Object.freeze({ id: "FREE_BATTLE", node: "_04_free", label: BATTLE_FACE_LABELS.FREE_BATTLE, helpTopic: 70, accent: "#3ddc84", glyph: "swords" }),
  Object.freeze({ id: "LINK_BATTLE", node: "_05_tushin", label: BATTLE_FACE_LABELS.LINK_BATTLE, helpTopic: 73, accent: "#2ec4f1", glyph: "link" }),
  Object.freeze({ id: "PASSWORD_BATTLE", node: "_06_password", label: BATTLE_FACE_LABELS.PASSWORD_BATTLE, accent: "#a259ff", glyph: "key" }),
  Object.freeze({ id: "PRACTICE_BATTLE", node: "_07_rensyu", label: BATTLE_FACE_LABELS.PRACTICE_BATTLE, accent: "#ff6fb5", glyph: "target" })
]);

export const BATTLE_CUBE_FACE_EVIDENCE = "ROM_VERIFIED";
export const BATTLE_CUBE_SOURCE_MODEL = "battle_menu/launcher13.nsbmd";
/** Which face sits where round the prism is the product's choice. */
export const BATTLE_CUBE_ORIENTATION_EVIDENCE = "PRODUCT_AUTHORED";

// One face is drawn 512 x 640; the panel keeps that 4:5 portrait shape at any
// face count, and the prism widens instead.
const FACE_PX = Object.freeze({ width: 512, height: 640 });
const FACE_WIDTH = 1.42;
const FACE_HEIGHT = FACE_WIDTH * FACE_PX.height / FACE_PX.width;
const SPRING = Object.freeze({ stiffness: 170, damping: 20 });

const glyphs = {
  crown(c) {
    c.beginPath();
    c.moveTo(12, 74); c.lineTo(8, 30); c.lineTo(31, 50); c.lineTo(50, 16); c.lineTo(69, 50); c.lineTo(92, 30); c.lineTo(88, 74);
    c.closePath(); c.fill();
    c.fillRect(12, 80, 76, 10);
    for (const [x, y] of [[8, 28], [50, 13], [92, 28]]) { c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); }
  },
  medal(c) {
    c.beginPath(); c.moveTo(26, 6); c.lineTo(44, 6); c.lineTo(52, 40); c.lineTo(38, 44); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(74, 6); c.lineTo(56, 6); c.lineTo(48, 40); c.lineTo(62, 44); c.closePath(); c.fill();
    c.beginPath(); c.arc(50, 64, 28, 0, Math.PI * 2); c.fill();
    c.save(); c.globalCompositeOperation = "destination-out";
    star(c, 50, 65, 16, 7); c.restore();
  },
  swords(c) {
    for (const side of [-1, 1]) {
      c.save(); c.translate(50, 52); c.rotate(side * Math.PI / 4);
      c.beginPath(); c.moveTo(-5, 24); c.lineTo(-5, -34); c.lineTo(0, -44); c.lineTo(5, -34); c.lineTo(5, 24); c.closePath(); c.fill();
      c.fillRect(-16, 22, 32, 7);
      c.fillRect(-4, 29, 8, 14);
      c.beginPath(); c.arc(0, 46, 5, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  },
  link(c) {
    c.lineWidth = 11;
    c.beginPath(); c.arc(36, 60, 20, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(64, 60, 20, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 6; c.lineCap = "round";
    for (const r of [12, 24]) { c.beginPath(); c.arc(50, 34, r, Math.PI * 1.22, Math.PI * 1.78); c.stroke(); }
  },
  key(c) {
    c.beginPath();
    c.moveTo(50, 6); c.lineTo(88, 20); c.lineTo(84, 58); c.quadraticCurveTo(76, 84, 50, 96); c.quadraticCurveTo(24, 84, 16, 58); c.lineTo(12, 20);
    c.closePath(); c.fill();
    c.save(); c.globalCompositeOperation = "destination-out";
    c.beginPath(); c.arc(50, 42, 11, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(44, 48); c.lineTo(56, 48); c.lineTo(60, 74); c.lineTo(40, 74); c.closePath(); c.fill();
    c.restore();
  },
  target(c) {
    c.lineWidth = 8;
    for (const r of [40, 25]) { c.beginPath(); c.arc(50, 52, r, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.arc(50, 52, 10, 0, Math.PI * 2); c.fill();
    c.lineWidth = 6;
    for (const [x1, y1, x2, y2] of [[50, 2, 50, 16], [50, 88, 50, 102], [0, 52, 14, 52], [86, 52, 100, 52]]) {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
  },
  tower(c) {
    c.beginPath(); c.moveTo(50, 4); c.lineTo(64, 22); c.lineTo(36, 22); c.closePath(); c.fill();
    c.fillRect(38, 24, 24, 20); c.fillRect(33, 46, 34, 22); c.fillRect(27, 70, 46, 24);
    c.save(); c.globalCompositeOperation = "destination-out";
    for (const [x, y, w, h] of [[46, 29, 8, 9], [44, 52, 12, 10], [42, 76, 16, 18]]) c.fillRect(x, y, w, h);
    c.restore();
  },
  hexagon(c) {
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c[i ? "lineTo" : "moveTo"](50 + 40 * Math.cos(a), 52 + 40 * Math.sin(a)); }
    c.closePath(); c.fill();
  }
};

function star(c, x, y, outer, inner) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer, a = -Math.PI / 2 + i * Math.PI / 5;
    c[i ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a));
  }
  c.closePath(); c.fill();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function fitFont(c, text, weight, size, family, maxWidth, minimum) {
  do { c.font = `${weight} ${size}px ${family}`; size -= 2; }
  while (c.measureText(text).width > maxWidth && size >= minimum);
}

/** Paint one face panel: frame, emblem, mode name and its one-line description. */
export function paintPrismFace(c, face, { fontFamily, open }) {
  const { width: w, height: h } = FACE_PX;
  const accent = open ? face.accent : "#77708f";
  c.clearRect(0, 0, w, h);
  // Body: deep arcade violet, lighter at the top like a lit screen.
  const body = c.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, "#3a2a7a"); body.addColorStop(0.55, "#1e1748"); body.addColorStop(1, "#110c2a");
  c.fillStyle = body; c.fillRect(0, 0, w, h);
  // A soft diagonal sheen.
  const sheen = c.createLinearGradient(0, 0, w, h * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)"); sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  c.fillStyle = sheen; c.fillRect(0, 0, w, h);
  // Accent frame and header bar.
  c.save();
  c.shadowColor = accent; c.shadowBlur = 22;
  c.lineWidth = 8; c.strokeStyle = accent;
  roundRect(c, 22, 22, w - 44, h - 44, 26); c.stroke();
  c.restore();
  c.fillStyle = accent;
  roundRect(c, w / 2 - 92, 22, 184, 18, 9); c.fill();
  // Corner brackets.
  c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 5; c.lineCap = "round";
  for (const [x, y, dx, dy] of [[46, 70, 1, 1], [w - 46, 70, -1, 1], [46, h - 46, 1, -1], [w - 46, h - 46, -1, -1]]) {
    c.beginPath(); c.moveTo(x, y + dy * 30); c.lineTo(x, y); c.lineTo(x + dx * 30, y); c.stroke();
  }
  // Emblem on a halo.
  const halo = c.createRadialGradient(w / 2, 238, 10, w / 2, 238, 160);
  halo.addColorStop(0, `${accent}66`); halo.addColorStop(1, `${accent}00`);
  c.fillStyle = halo; c.fillRect(0, 60, w, 360);
  // The emblem is cut on its own sheet first, so its holes never reach the panel.
  const mark = c.canvas.ownerDocument?.createElement("canvas");
  const m = mark?.getContext("2d");
  if (m) {
    mark.width = mark.height = 220;
    m.translate(15, 8); m.scale(1.9, 1.9);
    m.fillStyle = "#ffffff"; m.strokeStyle = "#ffffff";
    (glyphs[face.glyph] ?? glyphs.hexagon)(m);
    c.save();
    c.shadowColor = accent; c.shadowBlur = 18;
    c.drawImage(mark, w / 2 - 110, 238 - 110);
    c.restore();
  }
  // Divider.
  c.fillStyle = `${accent}aa`; c.fillRect(w / 2 - 120, 392, 240, 4);
  // Name and description.
  c.textAlign = "center"; c.textBaseline = "middle";
  const name = battleFaceLabel(face.id);
  fitFont(c, name, 800, 72, fontFamily, w - 96, 28);
  c.lineWidth = 10; c.strokeStyle = "#120c2c"; c.lineJoin = "round";
  c.strokeText(name, w / 2, 460, w - 96);
  c.fillStyle = "#ffffff";
  c.fillText(name, w / 2, 460, w - 96);
  const tagline = open ? battleFaceTagline(face.id) : uiText("此模式尚未開放");
  fitFont(c, tagline, 600, 30, fontFamily, w - 110, 16);
  c.fillStyle = open ? "#d9d2ff" : "#a59fbd";
  c.fillText(tagline, w / 2, 528, w - 110);
}

function makePedestalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  if (!c) return null;
  const glow = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, "rgba(255,255,255,0.85)"); glow.addColorStop(0.45, "rgba(255,255,255,0.28)"); glow.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = glow; c.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Mount the battle prism.
 *
 * @param {object} binding
 * @param {HTMLElement} binding.host
 * @param {(faceId: string) => void} binding.onSelect
 * @param {Set<string>|null} [binding.available] face ids that lead somewhere
 * @param {{add: Function, remove: Function, deltaMS: number}|null} [binding.ticker] the app's one ticker
 */
export function mountBattleSelectThreePresentation({ host, onSelect, available = null, ticker = null, faces = BATTLE_CUBE_FACES } = {}) {
  if (!host || typeof onSelect !== "function" || !Array.isArray(faces) || faces.length < 3) {
    throw new Error("CHAMPIONSHIP_BATTLE_CUBE_INVALID_BINDING");
  }

  let renderer;
  // The quality tier, read when the prism mounts: next Battle menu for a change.
  const quality = currentQuality();
  try { renderer = new THREE.WebGLRenderer({ antialias: quality.threeAntialias, alpha: true }); }
  catch { return mountFlatFallback({ host, onSelect, available }); }
  renderer.setPixelRatio(cappedPixelRatio(quality.threePixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "cm-vs5-cube__canvas";
  canvas.dataset.renderer = "THREE_BOUNDED_BATTLE_SELECT";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", battlePrismLabel("canvas"));
  canvas.tabIndex = 0;

  const sides = faces.length;
  const shape = prismShape(sides);
  const radius = FACE_WIDTH / shape.faceWidth;
  const open = faces.map(face => available === null || available.has(face.id));

  // The stage: canvas, two turn keys at its sides and the caption under it.
  const stage = document.createElement("div");
  stage.className = "cm-vs5-prism";
  const turnKey = (direction) => {
    const key = document.createElement("button");
    key.type = "button";
    key.className = `cm-vs5-prism__turn cm-vs5-prism__turn--${direction < 0 ? "previous" : "next"}`;
    key.setAttribute("aria-label", battlePrismLabel(direction < 0 ? "previous" : "next"));
    key.addEventListener("click", () => stepFace(direction));
    return key;
  };
  const caption = document.createElement("div");
  caption.className = "cm-vs5-prism__caption";
  caption.setAttribute("aria-live", "polite");
  const captionName = document.createElement("strong");
  captionName.className = "cm-vs5-prism__name";
  const captionTagline = document.createElement("span");
  captionTagline.className = "cm-vs5-prism__tagline";
  const captionHint = document.createElement("span");
  captionHint.className = "cm-vs5-prism__hint";
  const dots = document.createElement("span");
  dots.className = "cm-vs5-prism__dots";
  dots.setAttribute("aria-hidden", "true");
  const dotNodes = faces.map(() => dots.appendChild(document.createElement("i")));
  caption.append(dots, captionName, captionTagline, captionHint);
  stage.append(canvas, turnKey(-1), turnKey(1));

  // Every face is still a real button, for keyboards and screen readers. They
  // are not drawn: the prism's faces are the keys now. Focusing one turns the
  // prism to it; pressing it is the same as tapping its face.
  const overlay = document.createElement("div");
  overlay.className = "cm-vs5-cube__faces";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", uiText("對戰模式"));

  host.append(stage, caption, overlay);
  host.dataset.prismSides = String(sides);

  const scene = new THREE.Scene();
  scene.name = "battle_select_bounded_scene";
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const distance = Math.max(6.7, radius * 4.6);
  camera.position.set(0, distance * 0.2, distance);
  camera.lookAt(0, -0.3, 0);

  scene.add(new THREE.HemisphereLight(0xc9bcff, 0x120b2c, 1.7));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.0);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ff7ff, 1.3);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  const prism = new THREE.Group();
  prism.name = "battle_prism";
  scene.add(prism);
  const disposables = [];
  const keep = (thing) => { disposables.push(thing); return thing; };

  // Core: a dark gunmetal prism the panels sit on. CylinderGeometry places its
  // corners from thetaStart, so -step/2 centres face i at angle i * step.
  const thetaStart = -shape.step / 2;
  const bodyMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x1c1738, metalness: 0.55, roughness: 0.42, flatShading: true }));
  const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(radius, radius, FACE_HEIGHT, sides, 1, false, thetaStart)), bodyMaterial);
  prism.add(body);
  // Caps with neon edges, top and bottom.
  const capMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x3a2f78, metalness: 0.7, roughness: 0.3, flatShading: true, emissive: 0x150f33 }));
  const neon = keep(new THREE.LineBasicMaterial({ color: 0x6ff7ff, transparent: true, opacity: 0.9 }));
  for (const side of [1, -1]) {
    const capGeometry = keep(new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.14, sides, 1, false, thetaStart));
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = side * (FACE_HEIGHT / 2 + 0.07);
    cap.add(new THREE.LineSegments(keep(new THREE.EdgesGeometry(capGeometry)), neon));
    prism.add(cap);
  }
  // Corner pillars.
  const pillarMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x9a90d6, metalness: 0.8, roughness: 0.25, emissive: 0x241b55 }));
  const pillarGeometry = keep(new THREE.BoxGeometry(0.08, FACE_HEIGHT + 0.02, 0.08));
  for (let v = 0; v < sides; v++) {
    const angle = thetaStart + v * shape.step;
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(radius * Math.sin(angle), 0, radius * Math.cos(angle));
    pillar.rotation.y = angle;
    prism.add(pillar);
  }

  // Face panels: one canvas each, lit from inside like a screen.
  const fontFamily = globalThis.getComputedStyle?.(host).fontFamily || "system-ui, sans-serif";
  const panelGeometry = keep(new THREE.PlaneGeometry(FACE_WIDTH * 0.9, FACE_HEIGHT * 0.92));
  const frameGeometry = keep(new THREE.EdgesGeometry(panelGeometry));
  const panels = faces.map((face, index) => {
    const art = document.createElement("canvas");
    art.width = FACE_PX.width; art.height = FACE_PX.height;
    const context = art.getContext("2d");
    if (context) paintPrismFace(context, face, { fontFamily, open: open[index] });
    const texture = keep(new THREE.CanvasTexture(art));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const material = keep(new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture,
      emissiveIntensity: 0.4, roughness: 0.38, metalness: 0.08 }));
    const mesh = new THREE.Mesh(panelGeometry, material);
    const angle = index * shape.step;
    const out = radius * shape.apothem + 0.012;
    mesh.position.set(out * Math.sin(angle), 0, out * Math.cos(angle));
    mesh.rotation.y = angle;
    mesh.userData.faceIndex = index;
    const frame = new THREE.LineSegments(frameGeometry, keep(new THREE.LineBasicMaterial({ color: new THREE.Color(face.accent), transparent: true, opacity: 0 })));
    frame.position.z = 0.004;
    mesh.add(frame);
    prism.add(mesh);
    return { face, art, context, texture, material, mesh, frame };
  });

  // Pedestal: a glowing pool and a ring in the prism's own shape, tinted with
  // the colour of the face in front.
  const floorY = -FACE_HEIGHT / 2 - 0.42;
  const poolTexture = makePedestalTexture();
  if (poolTexture) keep(poolTexture);
  const pool = new THREE.Mesh(keep(new THREE.CircleGeometry(radius * 1.6, 48)),
    keep(new THREE.MeshBasicMaterial({ map: poolTexture, color: 0x7a5cff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = floorY;
  scene.add(pool);
  const ringMaterial = keep(new THREE.MeshBasicMaterial({ color: 0x6ff7ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(radius * 1.18, radius * 1.3, sides, 1, thetaStart - Math.PI / 2)), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = floorY + 0.01;
  scene.add(ring);
  // Ring and prism turn together so the floor shows the same polygon.
  const syncRing = () => { ring.rotation.z = prism.rotation.y; };

  let disposed = false;
  let selected = null;
  let hovered = -1;
  let turn = 0, target = 0, velocity = 0, animating = false;
  let front = 0;
  const buttons = new Map();

  faces.forEach((face, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-vs5-cube__face";
    button.dataset.faceId = face.id;
    button.dataset.romNode = face.node;
    button.textContent = battleFaceLabel(face.id);
    button.disabled = !open[index];
    if (!open[index]) {
      button.dataset.state = "NOT_IMPLEMENTED";
      button.title = uiText("此模式尚未開放");
    }
    button.addEventListener("focus", () => { host.dataset.prismFocus = "true"; turnTo(index); });
    button.addEventListener("blur", () => { delete host.dataset.prismFocus; });
    button.addEventListener("click", () => {
      if (!button.disabled) pressFace(index);
    });
    overlay.append(button);
    buttons.set(face.id, button);
  });

  const fx = (kind) => {
    try { host.dispatchEvent(new CustomEvent("cm-fx", { bubbles: true, detail: { kind } })); } catch { /* no effects */ }
  };

  function pressFace(index) {
    if (disposed) return;
    if (!open[index]) { fx("denied"); return; }
    turnTo(index);
    selected = faces[index].id;
    paint();
    fx("open");
    onSelect(selected);
  }

  function paint() {
    panels.forEach((panel, index) => {
      const lit = index === front ? 0.78 : index === hovered ? 0.6 : 0.36;
      panel.material.emissiveIntensity = open[index] ? lit : 0.22;
      panel.frame.material.opacity = faces[index].id === selected ? 1 : 0;
    });
    const face = faces[front];
    const colour = new THREE.Color(face.accent);
    ringMaterial.color.copy(colour);
    pool.material.color.copy(colour).lerp(new THREE.Color(0x7a5cff), 0.45);
    host.style.setProperty("--prism-accent", face.accent);
    captionName.textContent = battleFaceLabel(face.id);
    captionTagline.textContent = open[front] ? battleFaceTagline(face.id) : uiText("此模式尚未開放");
    captionHint.textContent = face.id === selected ? battlePrismLabel("current") : battlePrismLabel("enter");
    captionHint.hidden = !open[front];
    caption.dataset.faceId = face.id;
    dotNodes.forEach((dot, index) => { dot.dataset.active = String(index === front); });
    for (const [faceId, button] of buttons) button.setAttribute("aria-pressed", String(faceId === selected));
  }

  function applyTurn() {
    prism.rotation.y = turn;
    syncRing();
    const next = prismFrontIndex(turn, sides);
    if (next !== front) {
      front = next;
      fx("toggle");
      paint();
    }
    draw();
  }

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, Math.round(width * 0.82));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // Drawn ON DEMAND, never on a loop of its own.
  function draw() {
    if (disposed || globalThis.document?.hidden) return;
    renderer.render(scene, camera);
  }

  // The settle: a lightly under-damped spring on the injected ticker, removed
  // the moment the prism is at rest.
  const settle = () => {
    if (disposed) { stopSettling(); return; }
    const dt = Math.min(0.05, Math.max(0.001, (ticker?.deltaMS ?? 16.7) / 1000));
    velocity += (SPRING.stiffness * (target - turn) - SPRING.damping * velocity) * dt;
    turn += velocity * dt;
    if (Math.abs(target - turn) < 0.0008 && Math.abs(velocity) < 0.01) {
      turn = target; velocity = 0;
      stopSettling();
    }
    applyTurn();
  };
  function stopSettling() {
    if (!animating) return;
    animating = false;
    ticker?.remove?.(settle);
  }
  function settleTo(next, launch = 0) {
    target = next;
    if (!ticker || typeof ticker.add !== "function" || prefersReducedMotion()) {
      turn = target; velocity = 0; applyTurn(); return;
    }
    velocity = launch;
    if (!animating) { animating = true; ticker.add(settle); }
  }
  function turnTo(index) { settleTo(prismTurnFor(index, animating ? target : turn, sides)); }
  function stepFace(direction) {
    const base = animating ? target : turn;
    settleTo(prismTurnFor((prismFrontIndex(base, sides) + direction + sides) % sides, base - direction * shape.step, sides));
  }

  const onVisibilityChange = () => {
    if (!disposed && !globalThis.document?.hidden) draw();
  };
  globalThis.document?.addEventListener?.("visibilitychange", onVisibilityChange);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const faceAt = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld();
    prism.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    // Solid surfaces only: neon and frame lines have a wide pick threshold and
    // would claim taps meant for the face beside them.
    const hit = raycaster.intersectObject(prism, true).find(entry => entry.object.isMesh);
    if (!hit) return null;
    // A press on the frame, a pillar or a cap is a press on the face in front.
    return hit.object.userData.faceIndex ?? front;
  };
  const controls = bindBattlePrismSpin({
    canvas,
    sides: () => sides,
    onTurn(delta) {
      stopSettling();
      velocity = 0;
      turn += delta;
      target = turn;
      applyTurn();
    },
    onRelease(launch) { settleTo(prismSettleTurn(turn, launch, sides), launch); },
    onTap(event) {
      const index = faceAt(event);
      if (index !== null) pressFace(index);
    },
    onStep: stepFace,
    onActivate() { pressFace(front); }
  });
  const onHover = (event) => {
    if (event.pointerType !== "mouse" || controls.isDragging()) return;
    const index = faceAt(event);
    canvas.style.cursor = index === null ? "" : open[index] ? "pointer" : "not-allowed";
    const next = index ?? -1;
    if (next !== hovered) { hovered = next; paint(); draw(); }
  };
  const onLeave = () => { if (hovered !== -1) { hovered = -1; paint(); draw(); } };
  canvas.addEventListener("pointermove", onHover);
  canvas.addEventListener("pointerleave", onLeave);
  const restored = () => { if (!disposed) draw(); };
  canvas.addEventListener("webglcontextrestored", restored);
  const observer = new ResizeObserver(() => { if (!disposed) { resize(); draw(); } });
  observer.observe(host);

  // Text drawn before the UI font arrives is repainted once it has.
  const repaintFaces = () => {
    if (disposed) return;
    panels.forEach((panel, index) => {
      if (!panel.context) return;
      paintPrismFace(panel.context, panel.face, { fontFamily, open: open[index] });
      panel.texture.needsUpdate = true;
    });
    draw();
  };
  const fontsReady = globalThis.document?.fonts?.ready;
  const ready = (fontsReady ? Promise.resolve(fontsReady).catch(() => {}) : Promise.resolve()).then(() => {
    repaintFaces();
    if (!disposed) host.dataset.cubeTextures = String(panels.length);
  });

  resize();
  applyTurn();
  paint();
  draw();

  return Object.freeze({
    ready,
    getSelected() {
      return selected;
    },
    /** Turn a face to the front without pressing it (keyboard focus, QA). */
    showFace(faceId) {
      const index = faces.findIndex(face => face.id === faceId);
      if (index >= 0) turnTo(index);
    },

    getDiagnostics() {
      return Object.freeze({
        renderer: "THREE_BOUNDED_BATTLE_SELECT",
        rendererCount: 1,
        sceneScope: "BATTLE_SELECT_ONLY",
        shape: "PRISM",
        faceCount: sides,
        frontFace: faces[front].id,
        faceEvidence: BATTLE_CUBE_FACE_EVIDENCE,
        orientationEvidence: BATTLE_CUBE_ORIENTATION_EVIDENCE,
        sourceModel: BATTLE_CUBE_SOURCE_MODEL,
        modelRights: "ORIGINAL_CREATED",
        romModelLoaded: false,
        decodedTextureLoaded: false,
        selectionAuthority: "INJECTED_ON_SELECT_INTENT",
        faceArt: "PROCEDURAL_PANELS",
        textureCount: panels.length,
        turn,
        targetTurn: target,
        settling: animating,
        settleDriver: ticker ? "INJECTED_TICKER" : "IMMEDIATE",
        rotationMode: "PRISM_SPIN",
        dragging: controls.isDragging(),
        disposed
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      stopSettling();
      observer.disconnect();
      controls.dispose();
      globalThis.document?.removeEventListener?.("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("pointermove", onHover);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextrestored", restored);
      for (const thing of disposables) thing.dispose();
      renderer.dispose();
      // This private canvas is retired permanently; dispose alone releases
      // Three resources but leaves its browser WebGL context alive until GC.
      renderer.forceContextLoss();
      stage.remove();
      caption.remove();
      overlay.remove();
      delete host.dataset.cubeTextures;
      delete host.dataset.prismSides;
      delete host.dataset.prismFocus;
      host.style.removeProperty("--prism-accent");
    }
  });
}

function mountFlatFallback({ host, onSelect, available }) {
  const grid = document.createElement("div");
  grid.className = "cm-vs5-cube__fallback";
  grid.setAttribute("aria-label", uiText("對戰模式"));
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
    button.append(document.createTextNode(battleFaceLabel(face.id)));
    button.addEventListener("click", () => { if (!button.disabled) { selected = face.id; onSelect(face.id); } });
    grid.append(button);
  }
  host.append(grid);
  return Object.freeze({
    ready: Promise.resolve(),
    getSelected: () => selected,
    showFace() {},
    getDiagnostics: () => Object.freeze({ renderer: "DOM_BATTLE_CUBE_FALLBACK", faceCount: BATTLE_CUBE_FACES.length, textureCount: 0, artAssetId: BATTLE_CUBE_ART_ID }),
    dispose: () => grid.remove()
  });
}
