// Data Arena -- the DOM screen, input and lifecycle (OWNER_APPROVED_ADAPTATION 2026-10-15).
//
// Opened from the title menu without a Championship session; it never touches
// the save, the router/screen stack or the standalone app. Layer contract:
//  * DOM (this file): menus, HUD, touch controls, toasts, focus and text.
//  * Pixi (presentation/dataArena): the field, as one scene on the shared
//    stage; ensureStage() hands over the product's one Application.
//  * Simulation (modes/dataArena): stepped here at a fixed 60 Hz from ONE
//    callback on that Application's ticker; levels, pause and hidden tabs stop
//    stepping. close() removes the callback, every listener (one
//    AbortController), the scene, sounds and the character bundles.

import { createDataArenaSimulation } from "../modes/dataArena/dataArenaSimulation.js";
import { DATA_ARENA_MATE, DATA_ARENA_MAX_STEPS_PER_FRAME, DATA_ARENA_PARTNERS, DATA_ARENA_STEP_SECONDS, DATA_ARENA_TIMELINE } from "../modes/dataArena/dataArenaConfig.js";
import { dataArenaUpgrade } from "../modes/dataArena/dataArenaUpgrades.js";
import { createDataArenaRecordStore } from "../modes/dataArena/dataArenaSave.js";
import { createChampionshipDataArenaPort } from "./ChampionshipPersistentSavePort.js";
import { dataArenaCast } from "../presentation/dataArena/dataArenaRoster.js";
import { mountDataArenaScene } from "../presentation/dataArena/dataArenaPixiScene.js";
import { createDataArenaAudio } from "../presentation/dataArena/dataArenaAudio.js";
import { createPixiAssetScope, loadPixiCharacterRuntimeBundle } from "../presentation/pixiCharacterRuntimeBundle.js";
import { arenaText as t } from "../text/dataArenaText.js";

const STEP_MS = DATA_ARENA_STEP_SECONDS * 1000;
const MOVE_KEYS = Object.freeze({ KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] });
const GAME_KEYS = new Set([...Object.keys(MOVE_KEYS), "Space", "ShiftLeft", "ShiftRight", "KeyQ", "KeyE", "Escape", "KeyP", "Digit1", "Digit2", "Digit3"]);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className, text, onClick, signal) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick, { signal });
  return node;
}
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

let stylesheetPromise = null;
function ensureStylesheet() {
  if (document.querySelector("link[data-data-arena-style]")) return Promise.resolve();
  stylesheetPromise ??= new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./dataArena.css?v=data-arena-r1", import.meta.url).href;
    link.dataset.dataArenaStyle = "1";
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(link);
  });
  return stylesheetPromise;
}

/**
 * Open the arena. `ensureStage(host, signal)` returns the shared Championship
 * Pixi stage attached to `host`; `audioBus`/`music` are the product's.
 */
export async function openDataArena({ ensureStage, audioBus = null, music = null, storage = null, reducedMotion = false,
  resolutionCap = 2, onExit = () => {}, href = globalThis.location?.href, qa = false, seed = null }) {
  await ensureStylesheet();
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let port = null;
  try { port = storage ? createChampionshipDataArenaPort({ storage }) : null; } catch { port = null; }
  const records = createDataArenaRecordStore({ port });
  const cast = dataArenaCast(href);
  const coarse = globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const settings = records.get().settings;
  let shake = settings.shake && !reducedMotion;
  let quality = settings.quality === "auto" ? (coarse || Math.min(innerWidth, innerHeight) < 500 ? "low" : "high") : settings.quality;
  let partnerId = records.get().lastPartnerId;

  // ------------------------------------------------------------------ DOM skeleton
  const root = el("div", "da-root");
  root.dataset.state = "SELECT";
  root.dataset.quality = quality;
  if (reducedMotion) root.dataset.motion = "reduced";
  root.setAttribute("role", "application");
  root.setAttribute("aria-label", t("mode.title"));
  const field = el("div", "da-field");
  const hud = el("div", "da-hud");
  const overlay = el("div", "da-overlay");
  const toastLayer = el("div", "da-toasts");
  toastLayer.setAttribute("aria-live", "polite");
  const touch = el("div", "da-touch");
  touch.hidden = true;
  root.append(field, hud, toastLayer, touch, overlay);
  // Mounted on <html>, not <body>: in landscape the product scales <body> into
  // its 9:16 frame (portraitFrame.js), and that transform would trap this
  // fixed full-viewport field inside the frame. The title stays framed below.
  document.documentElement.appendChild(root);
  document.documentElement.classList.add("da-open");
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { signal });
  root.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });

  let stage = null, scene = null, sim = null, audio = null;
  const bundles = new Map();
  let bundleScope = null;
  let tickerCallback = null;
  let accumulator = 0;
  let paused = false;
  let matchId = 0;
  let result = null;

  // ------------------------------------------------------------------ input
  const keys = new Set();
  const latch = { dash: false, surge: false, ride: false };
  const pointer = { x: null, y: null, fire: false };
  const sticks = { move: null, aim: null };
  let aimVector = { x: 1, y: 0 };
  let touchActive = coarse;
  touch.hidden = !touchActive;

  function buildInput() {
    let mx = 0, my = 0;
    for (const code of keys) { const v = MOVE_KEYS[code]; if (v) { mx += v[0]; my += v[1]; } }
    if (sticks.move?.vector) { mx += sticks.move.vector.x; my += sticks.move.vector.y; }
    const state = sim.getState();
    const body = state.player.state === "RIDING" ? state.mate : state.player;
    let aimX = null, aimY = null, fire = pointer.fire;
    if (sticks.aim?.vector && Math.hypot(sticks.aim.vector.x, sticks.aim.vector.y) > 0.28) {
      const v = sticks.aim.vector, length = Math.hypot(v.x, v.y);
      aimVector = { x: v.x / length, y: v.y / length };
      fire = true;
    }
    if (touchActive && !pointer.mouse) { aimX = body.x + aimVector.x * 320; aimY = body.y + aimVector.y * 320; }
    else if (pointer.x !== null && scene) { const w = scene.screenToWorld(pointer.x, pointer.y); aimX = w.x; aimY = w.y; }
    else { aimX = body.x + aimVector.x * 300; aimY = body.y + aimVector.y * 300; }
    const input = { moveX: mx, moveY: my, aimX, aimY, fire, dash: latch.dash, surge: latch.surge, ride: latch.ride };
    latch.dash = latch.surge = latch.ride = false;
    return input;
  }

  window.addEventListener("keydown", (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    const playing = root.dataset.state === "PLAY";
    if (event.code === "Escape" || event.code === "KeyP") {
      if (root.dataset.state === "PLAY" || root.dataset.state === "PAUSE") { event.preventDefault(); togglePause(); }
      return;
    }
    if (root.dataset.state === "LEVEL" && /^Digit[123]$/.test(event.code)) {
      event.preventDefault();
      overlay.querySelectorAll(".da-card")[Number(event.code.slice(5)) - 1]?.click();
      return;
    }
    if (!playing) return;
    event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === "Space" || event.code.startsWith("Shift")) latch.dash = true;
    if (event.code === "KeyQ") latch.surge = true;
    if (event.code === "KeyE") latch.ride = true;
  }, { signal, capture: true });
  window.addEventListener("keyup", (event) => keys.delete(event.code), { signal, capture: true });
  window.addEventListener("blur", releaseInputs, { signal });
  function releaseInputs() {
    keys.clear(); pointer.fire = false; sticks.move = sticks.aim = null;
    for (const knob of touch.querySelectorAll(".da-stick")) knob.hidden = true;
  }

  field.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      const rect = field.getBoundingClientRect();
      pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.mouse = true;
      // A press that began over HUD chrome still fires once it drags onto the field.
      if (root.dataset.state === "PLAY") pointer.fire = (event.buttons & 1) === 1;
    }
  }, { signal });
  field.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (root.dataset.state !== "PLAY") return;
    const rect = field.getBoundingClientRect();
    pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.mouse = true;
    if (touchActive) { touchActive = false; touch.hidden = true; }
    if (event.button === 0) pointer.fire = true;
    if (event.button === 2) latch.surge = true;
    field.setPointerCapture?.(event.pointerId);
  }, { signal });
  field.addEventListener("pointerup", (event) => { if (event.button === 0) pointer.fire = false; }, { signal });
  field.addEventListener("pointercancel", () => { pointer.fire = false; }, { signal });

  // Touch: two floating sticks (left half moves, right half aims and fires) and buttons.
  const moveStick = makeStick("da-stick--move"), aimStick = makeStick("da-stick--aim");
  const touchButtons = el("div", "da-touch__buttons");
  const dashButton = button("da-tbtn da-tbtn--dash", t("touch.dash"), () => {}, signal);
  const surgeButton = button("da-tbtn da-tbtn--surge", t("touch.surge"), () => {}, signal);
  const rideButton = button("da-tbtn da-tbtn--ride", t("touch.ride"), () => {}, signal);
  for (const [node, key] of [[dashButton, "dash"], [surgeButton, "surge"], [rideButton, "ride"]]) {
    node.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); if (root.dataset.state === "PLAY") latch[key] = true; node.classList.add("is-pressed"); }, { signal });
    for (const end of ["pointerup", "pointercancel", "pointerleave"]) node.addEventListener(end, () => node.classList.remove("is-pressed"), { signal });
    const ring = el("span", "da-tbtn__cooldown");
    node.appendChild(ring);
    touchButtons.appendChild(node);
  }
  touch.append(moveStick.base, aimStick.base, touchButtons);
  function makeStick(className) {
    const base = el("div", `da-stick ${className}`);
    const knob = el("div", "da-stick__knob");
    base.appendChild(knob);
    base.hidden = true;
    return { base, knob };
  }
  root.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || root.dataset.state !== "PLAY") return;
    if (event.target.closest(".da-tbtn, .da-hud button, .da-overlay")) return;
    event.preventDefault();
    if (!touchActive) { touchActive = true; touch.hidden = false; pointer.mouse = false; }
    const rect = root.getBoundingClientRect();
    const left = event.clientX - rect.left < rect.width * 0.5;
    const slot = left ? "move" : "aim";
    if (sticks[slot]) return;
    const visual = left ? moveStick : aimStick;
    sticks[slot] = { id: event.pointerId, ox: event.clientX, oy: event.clientY, vector: { x: 0, y: 0 }, visual };
    visual.base.hidden = false;
    visual.base.style.transform = `translate(${event.clientX - rect.left - 56}px, ${event.clientY - rect.top - 56}px)`;
    visual.knob.style.transform = "translate(0px, 0px)";
    root.setPointerCapture?.(event.pointerId);
  }, { signal, passive: false });
  root.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch") return;
    for (const slot of ["move", "aim"]) {
      const stick = sticks[slot];
      if (!stick || stick.id !== event.pointerId) continue;
      event.preventDefault();
      let dx = event.clientX - stick.ox, dy = event.clientY - stick.oy;
      const length = Math.hypot(dx, dy), max = 52;
      if (length > max) { dx = (dx / length) * max; dy = (dy / length) * max; }
      stick.vector = { x: dx / max, y: dy / max };
      stick.visual.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }, { signal, passive: false });
  const endTouch = (event) => {
    for (const slot of ["move", "aim"]) {
      const stick = sticks[slot];
      if (stick && stick.id === event.pointerId) { stick.visual.base.hidden = true; sticks[slot] = null; }
    }
  };
  root.addEventListener("pointerup", endTouch, { signal });
  root.addEventListener("pointercancel", endTouch, { signal });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { releaseInputs(); audio?.suspend(); if (root.dataset.state === "PLAY") togglePause(true); }
    accumulator = 0;
  }, { signal });

  // ------------------------------------------------------------------ HUD
  const hudRefs = {};
  function buildHud() {
    hud.replaceChildren();
    const top = el("div", "da-hud__top");
    const left = el("div", "da-hud__vitals");
    hudRefs.hpFill = el("span", "da-bar__fill");
    const hpBar = el("div", "da-bar da-bar--hp"); hpBar.append(el("span", "da-bar__label", t("hud.hp")), hudRefs.hpFill);
    hudRefs.hpText = el("span", "da-bar__value");
    hpBar.appendChild(hudRefs.hpText);
    hudRefs.mateFill = el("span", "da-bar__fill");
    const mateBar = el("div", "da-bar da-bar--mate"); mateBar.append(el("span", "da-bar__label", t("hud.mate")), hudRefs.mateFill);
    hudRefs.revives = el("span", "da-hud__revives");
    left.append(hpBar, mateBar, hudRefs.revives);
    const center = el("div", "da-hud__center");
    hudRefs.timer = el("div", "da-hud__timer");
    hudRefs.phase = el("div", "da-hud__phase");
    hudRefs.objective = el("div", "da-hud__objective");
    center.append(hudRefs.timer, hudRefs.phase, hudRefs.objective);
    const right = el("div", "da-hud__right");
    hudRefs.score = el("div", "da-hud__score");
    hudRefs.level = el("div", "da-hud__level");
    hudRefs.xpFill = el("span", "da-bar__fill");
    const xp = el("div", "da-bar da-bar--xp"); xp.appendChild(hudRefs.xpFill);
    hudRefs.hypeFill = el("span", "da-bar__fill");
    const hype = el("div", "da-bar da-bar--hype"); hype.append(el("span", "da-bar__label", t("hud.hype")), hudRefs.hypeFill);
    const pause = button("da-hud__pause", "Ⅱ", () => togglePause(), signal);
    pause.setAttribute("aria-label", t("hud.pause"));
    right.append(hudRefs.score, hudRefs.level, xp, hype);
    top.append(left, center, right, pause);
    hudRefs.boss = el("div", "da-boss");
    hudRefs.bossName = el("span", "da-boss__name", cast.boss.name);
    hudRefs.bossFill = el("span", "da-bar__fill");
    const bossBar = el("div", "da-bar da-bar--boss"); bossBar.appendChild(hudRefs.bossFill);
    hudRefs.bossShield = el("span", "da-boss__shield");
    hudRefs.boss.append(hudRefs.bossName, bossBar, hudRefs.bossShield);
    hudRefs.boss.hidden = true;
    const bottom = el("div", "da-hud__bottom");
    hudRefs.heatFill = el("span", "da-bar__fill");
    hudRefs.heat = el("div", "da-bar da-bar--heat"); hudRefs.heat.append(el("span", "da-bar__label", t("hud.heat")), hudRefs.heatFill);
    hudRefs.dash = el("div", "da-chip", t("hud.dash"));
    hudRefs.surge = el("div", "da-chip", t("hud.surge"));
    hudRefs.ride = el("div", "da-chip", t("hud.ride"));
    bottom.append(hudRefs.heat, hudRefs.dash, hudRefs.surge, hudRefs.ride);
    hudRefs.banner = el("div", "da-banner");
    hudRefs.banner.hidden = true;
    hudRefs.vignette = el("div", "da-vignette");
    hud.append(hudRefs.vignette, top, hudRefs.boss, hudRefs.banner, bottom);
    hudCache.clear();
  }
  const hudCache = new Map();
  function put(key, node, apply, value) {
    if (hudCache.get(key) === value) return;
    hudCache.set(key, value);
    apply(node, value);
  }
  const width = (node, share) => { node.style.transform = `scaleX(${Math.max(0, Math.min(1, share)).toFixed(3)})`; };
  const text = (node, value) => { node.textContent = value; };
  function updateHud() {
    const snap = sim.getSnapshot();
    const p = snap.player, m = snap.mate;
    put("hp", hudRefs.hpFill, width, Math.round((p.hp / p.maxHp) * 200) / 200);
    put("hpText", hudRefs.hpText, text, `${p.hp}/${p.maxHp}`);
    put("mate", hudRefs.mateFill, width, Math.round((m.hp / m.maxHp) * 100) / 100);
    put("mateDown", hudRefs.mateFill.parentElement, (node, v) => node.classList.toggle("is-down", v), m.state === "DOWNED");
    put("revives", hudRefs.revives, text, t("hud.revives", { count: p.revives }));
    put("timer", hudRefs.timer, text, formatTime(DATA_ARENA_TIMELINE.limit - snap.time));
    put("phase", hudRefs.phase, text, t(`phase.${snap.phase}`));
    const objective = snap.objective;
    const objectiveText = objective.done ? `${t(`objective.${objective.id}`, objective)} ✓`
      : objective.id === "GUARDIAN" && objective.shielded ? t("objective.GUARDIAN.shield") : t(`objective.${objective.id}`, objective);
    put("objective", hudRefs.objective, text, objectiveText);
    put("score", hudRefs.score, text, snap.score.toLocaleString());
    put("level", hudRefs.level, text, t("hud.level", { level: snap.level }));
    put("xp", hudRefs.xpFill, width, Math.round((snap.xp / snap.xpToNext) * 100) / 100);
    put("hype", hudRefs.hypeFill, width, snap.cheer ? 1 : snap.hype / 100);
    put("cheer", hudRefs.hypeFill.parentElement, (node, v) => node.classList.toggle("is-cheer", v), snap.cheer);
    const heatShare = snap.laser.heat / snap.laser.heatCapacity;
    put("heat", hudRefs.heatFill, width, Math.round(heatShare * 100) / 100);
    put("overheat", hudRefs.heat, (node, v) => { node.classList.toggle("is-overheat", v); node.firstChild.textContent = t(v ? "hud.overheat" : "hud.heat"); }, snap.laser.overheated);
    const dashReady = p.dashCharges > 0;
    const pips = "●".repeat(p.dashCharges) + "○".repeat(Math.max(0, p.dashMax - p.dashCharges));
    put("dash", hudRefs.dash, (node, v) => { node.classList.toggle("is-cooling", v.startsWith("0")); node.textContent = `${t("hud.dash")} ${v.slice(2)}`; }, `${dashReady ? 1 : 0}|${pips}`);
    const surgeShare = m.state === "DOWNED" ? 1 : m.surgeCooldown / m.surgeMax;
    put("surge", hudRefs.surge, (node, v) => { node.classList.toggle("is-cooling", v > 0); node.style.setProperty("--cool", v.toFixed(2)); }, Math.round(surgeShare * 50) / 50);
    const riding = p.state === "RIDING" || p.state === "MOUNTING";
    const rideReady = riding || (m.state === "FOLLOW" && Math.hypot(p.x - m.x, p.y - m.y) <= DATA_ARENA_MATE.ride.reach);
    put("ride", hudRefs.ride, (node, v) => { node.textContent = t(v[0] === "1" ? "hud.dismount" : "hud.ride"); node.classList.toggle("is-cooling", v[2] === "0"); }, riding ? "1|1" : `0|${rideReady ? 1 : 0}`);
    if (touchActive) {
      put("tdash", dashButton, (node, v) => node.classList.toggle("is-cooling", !v), dashReady);
      put("tsurge", surgeButton, (node, v) => { node.classList.toggle("is-cooling", v > 0); node.style.setProperty("--cool", v.toFixed(2)); }, Math.round(surgeShare * 50) / 50);
      put("tride", rideButton, (node, v) => { node.firstChild.textContent = t(v[0] === "1" ? "hud.dismount" : "touch.ride"); node.classList.toggle("is-cooling", v[2] === "0"); }, riding ? "1|1" : `0|${rideReady ? 1 : 0}`);
    }
    const boss = snap.boss;
    put("bossShown", hudRefs.boss, (node, v) => { node.hidden = !v; }, Boolean(boss && boss.state !== "DOWN"));
    if (boss) {
      put("bossHp", hudRefs.bossFill, width, Math.round((boss.hp / boss.maxHp) * 200) / 200);
      put("bossShield", hudRefs.bossShield, text, boss.shielded ? "🛡" : boss.enraged ? "!!" : "");
    }
    put("lowHp", hudRefs.vignette, (node, v) => node.classList.toggle("is-low", v), p.hp / p.maxHp < 0.3 && p.state !== "DOWNED");
    root.dataset.playerState = p.state;
  }

  // Toasts and banners (pooled DOM nodes, CSS animated).
  const toastPool = Array.from({ length: 6 }, () => { const node = el("div", "da-toast"); node.hidden = true; toastLayer.appendChild(node); return node; });
  let toastIndex = 0;
  const toastThrottle = new Map();
  function toast(message, { x = null, y = null, tone = "info", key = message, gap = 900 } = {}) {
    const now = performance.now();
    if (now - (toastThrottle.get(key) ?? -1e9) < gap) return;
    toastThrottle.set(key, now);
    const node = toastPool[toastIndex++ % toastPool.length];
    node.textContent = message;
    node.dataset.tone = tone;
    if (x !== null && scene) {
      const point = scene.worldToScreen(x, y);
      const fieldWidth = field.clientWidth, fieldHeight = field.clientHeight;
      node.style.left = `${Math.max(70, Math.min(fieldWidth - 70, point.x))}px`;
      node.style.top = `${Math.max(90, Math.min(fieldHeight - 160, point.y - 70))}px`;
      node.classList.remove("da-toast--center");
    } else { node.style.left = "50%"; node.style.top = "34%"; node.classList.add("da-toast--center"); }
    node.hidden = false;
    node.classList.remove("is-showing");
    void node.offsetWidth; // restart the CSS animation on a pooled node
    node.classList.add("is-showing");
  }
  let bannerTimer = null;
  function banner(message, tone = "warn", ms = 2600) {
    const node = hudRefs.banner;
    node.textContent = message; node.dataset.tone = tone; node.hidden = false;
    node.classList.remove("is-showing"); void node.offsetWidth; node.classList.add("is-showing");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { node.hidden = true; }, ms);
  }

  // ------------------------------------------------------------------ events -> DOM/audio/music
  function handleEvents(events) {
    scene?.handleEvents(events);
    for (const event of events) {
      switch (event.type) {
        case "LASER_HIT": audio?.play("hit"); break;
        case "ENEMY_KILLED": audio?.play("kill"); break;
        case "PLAYER_HIT": audio?.play("hurt"); flashVignette(); break;
        case "DASH": audio?.play("dash"); break;
        case "PERFECT_DODGE": audio?.play("perfect"); toast(t("toast.perfect"), { x: event.x, y: event.y, tone: "good", key: "perfect", gap: 600 }); break;
        case "ELEMENT_CHAIN": toast(t(`toast.chain.${event.kind}`), { x: event.x, y: event.y, tone: "chain", key: `chain-${event.kind}`, gap: 1400 }); break;
        case "FIRE_IGNITE": if (event.source !== "SPREAD") audio?.play("ignite"); break;
        case "FIRE_OUT": audio?.play("splash"); break;
        case "ICE_FORM": if (event.source === "POD") audio?.play("burst"); break;
        case "ICE_CRACK_WARN": {
          audio?.play("crack");
          const state = sim.getState();
          if (Math.hypot(state.player.x - event.x, state.player.y - event.y) < 260) toast(t("toast.iceWarn"), { tone: "warn", key: "ice" , gap: 2500 });
          break;
        }
        case "FELL_IN_WATER": audio?.play("splash"); toast(t("toast.fall"), { tone: "warn", key: "fall", gap: 1500 }); break;
        case "RECOVERED": audio?.play("ui"); break;
        case "SURGE": audio?.play("surge"); break;
        case "SURGE_REFUSED": if (event.reason === "COOLDOWN") toast(t("toast.surgeCooldown"), { tone: "info", key: "surge-cd", gap: 1200 }); break;
        case "RIDE_REFUSED": toast(t("toast.rideFar"), { tone: "info", key: "ride-far", gap: 1500 }); break;
        case "MOUNTED": audio?.play("ui"); break;
        case "DISMOUNT": if (event.mode === "THROWN") toast(t("toast.thrown"), { tone: "warn" }); break;
        case "POD_BURST": audio?.play("burst"); break;
        case "SHARD_BLOCK": audio?.play("block"); break;
        case "OVERHEAT": audio?.play("overheat"); toast(t("toast.overheat"), { x: sim.getState().player.x, y: sim.getState().player.y, tone: "warn", key: "overheat", gap: 1500 }); break;
        case "MATE_DOWN": toast(t("toast.mateDown"), { tone: "warn", key: "mate-down" }); break;
        case "MATE_REVIVED": if (event.rescued) { audio?.play("capture"); toast(t("toast.rescue"), { x: event.x, y: event.y, tone: "good" }); } break;
        case "CORE_OUT": audio?.play("capture"); toast(t("toast.core"), { x: event.x, y: event.y, tone: "good" }); break;
        case "BEACON_CAPTURED": audio?.play("capture"); toast(t("toast.beacon"), { x: event.x, y: event.y, tone: "good" }); break;
        case "BEACON_PROGRESS": audio?.play("pickup"); break;
        case "BOSS_SHIELD_DOWN": banner(t("toast.shieldDown"), "good"); break;
        case "LEVEL_UP": audio?.play("level"); break;
        case "PICKUP": audio?.play("pickup"); break;
        case "CHEER": audio?.play("cheer"); banner(t("hud.cheer"), "cheer", 2000); break;
        case "CROWD": if (event.source !== "BOSS_DOWN") audio?.play("cheer"); break;
        case "PHASE_WARNING":
          audio?.play("warn");
          banner(t(`warn.${event.id}`, { name: cast.boss.name }), "warn", Math.max(2000, event.inSeconds * 1000));
          break;
        case "PHASE":
          if (event.id !== "WARMUP") banner(t(`phase.${event.id}`), event.id === "GUARDIAN" ? "boss" : "phase", 1800);
          if (event.id === "GUARDIAN") music?.setScene("battle_final", `arena:${matchId}`);
          break;
        case "BRIDGE_LIFTED": toast(t("toast.bridge"), { tone: "warn", key: "bridge" }); break;
        case "BOSS_SPAWN": audio?.play("roar"); break;
        case "BOSS_ENRAGE": audio?.play("roar"); toast(t("toast.bossEnrage"), { tone: "warn" }); break;
        case "SLAM": audio?.play("slam"); break;
        case "BOSS_DOWN": audio?.play("burst"); break;
        case "PLAYER_RESPAWN": toast(t("toast.respawn"), { tone: "good" }); break;
        case "OFFER": showLevelUp(event.options); break;
        case "RESULT": showResult(); break;
        default: break;
      }
    }
  }
  let vignetteTimer = null;
  function flashVignette() {
    hudRefs.vignette?.classList.add("is-hit");
    clearTimeout(vignetteTimer);
    vignetteTimer = setTimeout(() => hudRefs.vignette?.classList.remove("is-hit"), 180);
  }

  // ------------------------------------------------------------------ loop
  const frameCost = [];
  function frame(ticker) {
    if (!sim || !scene) return;
    const started = performance.now();
    const dtMs = Math.min(ticker.deltaMS, 250);
    if (root.dataset.state === "PLAY" && !paused && !document.hidden) {
      accumulator += dtMs;
      let steps = 0;
      while (accumulator >= STEP_MS && steps < DATA_ARENA_MAX_STEPS_PER_FRAME) {
        sim.step(buildInput());
        accumulator -= STEP_MS;
        steps++;
        if (sim.getState().mode === "LEVEL_UP" || sim.getState().mode === "ENDED") { accumulator = 0; break; }
      }
      if (steps >= DATA_ARENA_MAX_STEPS_PER_FRAME) accumulator = 0; // drop time instead of spiralling
    } else accumulator = 0;
    const events = sim.drainEvents();
    if (events.length) handleEvents(events);
    const state = sim.getState();
    audio?.setLaser(state.laser.firing && root.dataset.state === "PLAY" && !paused, state.laser.heat / sim.stats.heatCapacity);
    scene.render(dtMs);
    if (root.dataset.state !== "SELECT") updateHud();
    frameCost.push(performance.now() - started);
    if (frameCost.length > 240) frameCost.shift();
  }

  // ------------------------------------------------------------------ assets
  async function loadCast(selectedPartnerId) {
    const wanted = [cast.partners.find((p) => p.partnerId === selectedPartnerId), cast.mate, cast.boss].filter((member) => member?.art);
    bundleScope ??= createPixiAssetScope(stage.PIXI, href, { signal });
    let failed = false;
    // Release a partner no longer on the field.
    for (const [speciesId, bundle] of bundles) {
      if (!wanted.some((member) => member.speciesId === speciesId)) { bundles.delete(speciesId); await bundle.dispose(); }
    }
    await Promise.all(wanted.filter((member) => !bundles.has(member.speciesId)).map(async (member) => {
      try {
        const bundle = await loadPixiCharacterRuntimeBundle({ PIXI: bundleScope, runtimeUrl: member.art.runtimeUrl, sides: ["main"],
          cachePrefix: `data-arena:${member.art.entityId}:` });
        // The selection's identity and source bank must match what was loaded.
        if (bundle.runtime.entityId !== member.art.entityId || bundle.runtime.sourceBankSha256 !== member.art.sourceBankSha256) {
          await bundle.dispose(); throw new Error("DATA_ARENA_ART_IDENTITY_MISMATCH");
        }
        if (signal.aborted) { await bundle.dispose(); return; }
        bundles.set(member.speciesId, bundle);
      } catch (error) {
        failed = true;
        if (!signal.aborted) console.warn("DATA_ARENA_ART_FALLBACK", member.speciesId, error?.message);
      }
    }));
    return !failed;
  }

  function mountScene() {
    scene?.dispose();
    scene = mountDataArenaScene({ stage, sim, cast, bundles, quality, reducedMotion, shake, partnerId });
    root.dataset.quality = quality;
    stage.setResolutionCap(quality === "low" ? 1 : Math.min(2, resolutionCap));
  }

  async function startMatch() {
    root.dataset.state = "LOADING";
    showOverlay(el("div", "da-panel da-panel--loading", t("loading")));
    stage ??= await ensureStage(field, signal);
    if (signal.aborted) return;
    const ok = await loadCast(partnerId);
    if (signal.aborted) return;
    matchId++;
    const matchSeed = seed ?? ((Date.now() ^ (matchId * 2654435761)) >>> 0);
    sim = createDataArenaSimulation({ seed: matchSeed, partnerId, quality });
    root.dataset.seed = String(matchSeed);
    audio ??= createDataArenaAudio({ bus: audioBus });
    mountScene();
    result = null;
    paused = false;
    accumulator = 0;
    releaseInputs();
    buildHud();
    hideOverlay();
    root.dataset.state = "PLAY";
    if (!tickerCallback) { tickerCallback = frame; stage.app.ticker.add(tickerCallback); }
    music?.setScene("battle_normal", `arena:${matchId}`);
    if (!ok) toast(t("loading.failed"), { tone: "warn", key: "art" });
    banner(t("phase.WARMUP"), "phase", 2200);
    field.focus?.({ preventScroll: true });
  }

  // ------------------------------------------------------------------ overlays
  function showOverlay(panel) {
    overlay.replaceChildren(panel);
    overlay.hidden = false;
    const first = panel.querySelector("[data-autofocus]") ?? panel.querySelector("button");
    first?.focus({ preventScroll: true });
  }
  function hideOverlay() { overlay.hidden = true; overlay.replaceChildren(); }

  function showSelect() {
    root.dataset.state = "SELECT";
    const saved = records.get();
    const panel = el("div", "da-panel da-panel--select");
    const head = el("header", "da-panel__head");
    head.append(el("p", "da-eyebrow", t("mode.subtitle")), el("h2", "da-title", t("mode.title")), el("p", "da-tagline", t("mode.tagline")));
    const list = el("div", "da-partners");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", t("select.heading"));
    for (const partner of DATA_ARENA_PARTNERS) {
      const member = cast.partners.find((p) => p.partnerId === partner.id);
      const card = button("da-partner", "", () => { partnerId = partner.id; for (const node of list.children) node.setAttribute("aria-checked", String(node === card)); }, signal);
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(partner.id === partnerId));
      if (member.art) { const img = el("img", "da-partner__art"); img.src = member.art.portraitUrl; img.alt = ""; img.decoding = "async"; card.appendChild(img); }
      else card.appendChild(el("span", "da-partner__art da-partner__art--fallback"));
      const stats = el("span", "da-partner__stats");
      const meter = (label, value, max) => { const row = el("span", "da-meter"); row.append(el("span", "", label)); const bar = el("span", "da-meter__bar"); bar.style.setProperty("--v", (value / max).toFixed(2)); row.append(bar); return row; };
      stats.append(meter(t("stat.hp"), partner.hp, 130), meter(t("stat.laser"), partner.laserDps, 60), meter(t("stat.speed"), partner.speed, 280));
      card.append(el("strong", "da-partner__name", member.name), el("span", "da-partner__perk", t(`perk.${partner.perk}`)), stats);
      list.appendChild(card);
    }
    const mate = el("p", "da-note", t("select.mate", { name: cast.mate.name }));
    const best = el("p", "da-note", t("select.best", { score: saved.bestScore.toLocaleString(), wins: saved.wins, runs: saved.runs }));
    const actions = el("div", "da-actions");
    const start = button("da-btn da-btn--primary", t("select.start"), () => { records.setLastPartner(partnerId); audio?.play?.("ui"); showBriefing(); }, signal);
    start.dataset.autofocus = "1";
    actions.append(start, button("da-btn", t("select.back"), () => close(), signal));
    panel.append(head, el("h3", "da-subtitle", t("select.heading")), list, mate, best, actions);
    showOverlay(panel);
  }

  function showBriefing() {
    root.dataset.state = "BRIEF";
    const panel = el("div", "da-panel da-panel--brief");
    panel.append(el("h2", "da-title", t("brief.heading")), el("p", "da-goal", t("brief.goal")));
    const listing = el("ul", "da-controls");
    const lines = touchActive ? ["brief.touch.move", "brief.touch.aim", "brief.touch.buttons"]
      : ["brief.kb.move", "brief.kb.aim", "brief.kb.dash", "brief.kb.surge", "brief.kb.ride", "brief.kb.pause"];
    for (const key of lines) listing.appendChild(el("li", "", t(key)));
    const go = button("da-btn da-btn--primary", t("brief.go"), () => { records.markBriefingSeen(); void startMatch(); }, signal);
    go.dataset.autofocus = "1";
    panel.append(listing, el("p", "da-tips", t("brief.tips")), go);
    showOverlay(panel);
  }

  function showLevelUp(options) {
    root.dataset.state = "LEVEL";
    releaseInputs();
    const panel = el("div", "da-panel da-panel--level");
    panel.append(el("h2", "da-title", t("level.heading")), el("p", "da-note", t("level.hint")));
    const cards = el("div", "da-cards");
    options.forEach((id, index) => {
      const upgrade = dataArenaUpgrade(id);
      const [name, effect] = t(`up.${id}`).split(/\s*[｜|]\s*/);
      const level = (sim.getState().upgrades[id] ?? 0) + 1;
      const card = button(`da-card da-card--${upgrade.track.toLowerCase()}`, "", () => {
        if (!sim.choose(id)) return;
        audio?.play("ui");
        if (sim.getState().mode === "PLAY") { hideOverlay(); root.dataset.state = "PLAY"; }
      }, signal);
      card.append(el("span", "da-card__key", String(index + 1)), el("span", "da-card__track", t(`level.track.${upgrade.track}`)),
        el("strong", "da-card__name", name), el("span", "da-card__effect", effect ?? ""),
        el("span", "da-card__rank", Number.isFinite(upgrade.max) ? t("level.rank", { level, max: upgrade.max }) : ""));
      card.dataset.upgrade = id;
      if (index === 0) card.dataset.autofocus = "1";
      cards.appendChild(card);
    });
    panel.appendChild(cards);
    showOverlay(panel);
  }

  function togglePause(force = null) {
    const next = force ?? root.dataset.state !== "PAUSE";
    if (next && root.dataset.state === "PLAY") {
      paused = true; root.dataset.state = "PAUSE"; releaseInputs(); audio?.suspend(); showPause();
    } else if (!next && root.dataset.state === "PAUSE") {
      paused = false; hideOverlay(); root.dataset.state = sim?.getState().mode === "LEVEL_UP" ? "LEVEL" : "PLAY"; accumulator = 0;
      if (root.dataset.state === "LEVEL") showLevelUp(sim.getState().offer);
    }
  }
  function showPause() {
    const panel = el("div", "da-panel da-panel--pause");
    panel.appendChild(el("h2", "da-title", t("pause.heading")));
    const resume = button("da-btn da-btn--primary", t("pause.resume"), () => togglePause(false), signal);
    resume.dataset.autofocus = "1";
    const shakeToggle = button("da-btn da-toggle", `${t("pause.shake")}：${t(shake ? "pause.on" : "pause.off")}`, () => {
      if (reducedMotion) return;
      shake = !shake; records.setSettings({ shake }); scene?.setShake(shake);
      shakeToggle.textContent = `${t("pause.shake")}：${t(shake ? "pause.on" : "pause.off")}`;
    }, signal);
    shakeToggle.disabled = reducedMotion;
    const qualityToggle = button("da-btn da-toggle", `${t("pause.quality")}：${t(`pause.quality.${quality}`)}`, () => {
      quality = quality === "high" ? "low" : "high"; records.setSettings({ quality }); mountScene();
      qualityToggle.textContent = `${t("pause.quality")}：${t(`pause.quality.${quality}`)}`;
    }, signal);
    const row = el("div", "da-actions da-actions--column");
    row.append(resume, shakeToggle, qualityToggle,
      button("da-btn", t("pause.restart"), () => { hideOverlay(); void startMatch(); }, signal),
      button("da-btn da-btn--quiet", t("pause.exit"), () => close(), signal));
    panel.appendChild(row);
    if (reducedMotion) panel.appendChild(el("p", "da-note", t("pause.motionNote")));
    showOverlay(panel);
  }

  function showResult() {
    result = sim.getState().result;
    root.dataset.state = "RESULT";
    root.dataset.outcome = result.outcome;
    releaseInputs();
    audio?.suspend();
    const { newBest, saved } = records.recordResult(result);
    const best = records.get().bestScore;
    music?.setScene(result.outcome === "VICTORY" ? "victory" : "defeat", `arena-result:${matchId}`);
    const panel = el("div", `da-panel da-panel--result da-result--${result.outcome.toLowerCase()}`);
    panel.append(el("h2", "da-title", t(`result.${result.outcome}`)));
    const score = el("div", "da-result__score");
    score.append(el("span", "da-result__label", t("result.score")), el("strong", "", result.score.toLocaleString()));
    if (newBest) score.appendChild(el("span", "da-badge", t("result.newBest")));
    panel.append(score,
      el("p", "da-note", t("result.best", { score: best.toLocaleString() })),
      el("p", "da-result__line", [t("result.time", { time: formatTime(result.timeSeconds) }), t("result.kills", { count: result.kills }), t("result.level", { level: result.level })].join("　")),
      el("p", "da-result__line", t("result.breakdown", result.breakdown)),
      el("p", "da-result__line", t("result.stats", { perfect: result.stats.perfectDodges, chains: result.stats.chains, rescues: result.stats.rescues, cheers: result.cheers })));
    const actions = el("div", "da-actions");
    const retry = button("da-btn da-btn--primary", t("result.retry"), () => void startMatch(), signal);
    retry.dataset.autofocus = "1";
    actions.append(retry, button("da-btn", t("result.change"), () => showSelect(), signal), button("da-btn da-btn--quiet", t("result.exit"), () => close(), signal));
    panel.append(actions, el("p", "da-fineprint", t(saved ? "result.recordNote" : "result.recordOff")));
    // A short beat so the crowd reaction and the last hit read before the panel.
    setTimeout(() => { if (!signal.aborted && root.dataset.state === "RESULT") showOverlay(panel); }, 900);
  }

  // ------------------------------------------------------------------ teardown
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    if (tickerCallback && stage) stage.app.ticker.remove(tickerCallback);
    tickerCallback = null;
    lifetime.abort();
    clearTimeout(bannerTimer); clearTimeout(vignetteTimer);
    audio?.dispose(); audio = null;
    scene?.dispose(); scene = null;
    sim = null;
    stage?.setResolutionCap(resolutionCap);
    await Promise.allSettled([...bundles.values()].map((bundle) => bundle.dispose()));
    bundles.clear();
    root.remove();
    document.documentElement.classList.remove("da-open");
    if (qa) delete globalThis.__dataArenaQA;
    onExit();
  }

  if (qa) {
    // Read-only observation for automated browser QA; it cannot drive the match.
    globalThis.__dataArenaQA = Object.freeze({
      snapshot: () => (sim ? sim.getSnapshot() : null),
      state: () => root.dataset.state,
      diagnostics: () => {
        const sorted = [...frameCost].sort((a, b) => a - b);
        return { tickerListeners: stage?.app.ticker.count ?? null, scene: scene?.getDiagnostics() ?? null, stage: stage?.getDiagnostics() ?? null, bundles: [...bundles.keys()],
          arenaUpdateMs: sorted.length ? { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * 0.95)] } : null };
      },
      worldToScreen: (x, y) => (scene ? scene.worldToScreen(x, y) : null),
      entities: () => {
        if (!sim) return null;
        const state = sim.getState();
        return { enemies: state.enemies.map(({ x, y, kind }) => ({ x, y, kind })),
          projectiles: state.projectiles.map(({ x, y, vx, vy, owner, kind, radius }) => ({ x, y, vx, vy, owner, kind, radius })),
          surfaceUnderPlayer: sim.grid.surfaceAt(state.player.x, state.player.y) };
      },
      telegraphs: () => (sim ? sim.getState().telegraphs.map(({ kind, x, y, radius, angle, t: age, duration }) => ({ kind, x, y, radius, angle, age, duration })) : [])
    });
  }

  showSelect();
  return Object.freeze({ close, get state() { return root.dataset.state; } });
}
