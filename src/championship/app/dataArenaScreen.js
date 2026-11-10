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
import { DATA_ARENA_KITS, DATA_ARENA_MATE, DATA_ARENA_MAX_STEPS_PER_FRAME, DATA_ARENA_PARTNERS, DATA_ARENA_STEP_SECONDS, DATA_ARENA_TIMELINE,
  DATA_ARENA_TOURNAMENT } from "../modes/dataArena/dataArenaConfig.js";
import { dataArenaUpgrade, previewDataArenaUpgrade } from "../modes/dataArena/dataArenaUpgrades.js";
import { loadStylesheet } from './loadStylesheet.js';
import { createLoadAttempt, LOAD_MAX_MS } from './loadWatchdog.js';
import { gachaTicketImage } from "./cyberGachaIcons.js";
import { createDataArenaRecordStore } from "../modes/dataArena/dataArenaSave.js";
import { createChampionshipDataArenaPort } from "./ChampionshipPersistentSavePort.js";
import { dataArenaCast, loadDataArenaCharacter } from "../presentation/dataArena/dataArenaRoster.js";
import { mountDataArenaScene } from "../presentation/dataArena/dataArenaPixiScene.js";
import { loadDataArenaEnvironment } from "../presentation/dataArena/dataArenaEnvironment.js";
import { loadDataArenaInteractionArt } from "../presentation/dataArena/dataArenaInteractionArt.js";
import { createDataArenaAudio } from "../presentation/dataArena/dataArenaAudio.js";
import { selectDataArenaMusic } from "../presentation/originalMusicCatalog.js";
import { createPixiAssetScope, loadPixiCharacterRuntimeBundle } from "../presentation/pixiCharacterRuntimeBundle.js";
import { arenaText as t } from "../text/dataArenaText.js";
import { createSkillCutInLayer } from "../presentation/juicy/skillCutIn.js";
import { juicyPortrait, juicyPresentationEnabled } from "../presentation/juicy/juicyArt.js";

import { RELAY_ROSTER, relayPartner } from '../modes/dataArena/dataArenaRelayRoster.js';
import { RELAY_MAP_IDS } from '../modes/dataArena/dataArenaRelayMaps.js';
import { DATA_ARENA_RELAY, RELAY_ACTION_PROFILES, relayTeamIds, RELAY_LOADOUTS, relayKit, relayMove, relayEffectStyle, relayMoveElement } from '../modes/dataArena/dataArenaRelay.js';
import { relayOwnMoveInfo, relayBasicRecord } from '../modes/dataArena/dataArenaRelayKits.js';
import { battleMoveName } from '../text/battleMoveNames.js';
import { speciesTaxonomyForId, elementMatchup, elementMultiplierPercent, factionResonance } from '../contracts/speciesTaxonomy.js';
import { burstBasesFor, burstFormsFor, isBurstForm } from '../contracts/productBurstEvolution.js';
import { speciesName } from '../text/zhHant.js';
import { uiText } from '../text/uiText.js';
import { bindOverLimitPress } from './ui/overLimitPress.js';
import { OVER_LIMIT_RULES } from '../contracts/productAwakeningOverdrive.js';
import { taxonomyText } from '../text/taxonomyText.js';
import { taxonomyBadgeRow, resonanceStrip, taxonomyGlyph, TAXONOMY_COLORS, svgElement } from '../presentation/taxonomyBadgeArt.js';
import { elementChartButton } from './elementChartModal.js';
import { loadOriginalVfxCellArt } from '../presentation/vfx/originalVfxCellArt.js';
import { dataArenaEntries, dataArenaEntryUsable, dataArenaPartnerPower } from '../modes/dataArena/dataArenaEligibility.js';

const STEP_MS = DATA_ARENA_STEP_SECONDS * 1000;
const MOVE_KEYS = Object.freeze({ KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] });
const GAME_KEYS = new Set([...Object.keys(MOVE_KEYS), "Space", "ShiftLeft", "ShiftRight", "Tab", "KeyQ", "KeyE", "KeyR", "KeyF", "KeyC", "KeyB",
  "KeyJ", "KeyK", "KeyL", "KeyX", "Escape", "KeyP", "Digit1", "Digit2", "Digit3", "Digit4"]);
// Skill keys -> kit slot (moves 2-4). Slot 1 (the beam) is held: left mouse, 1 or J.
const SKILL_KEYS = Object.freeze({ Digit2: 0, KeyK: 0, Digit3: 1, KeyL: 1, KeyQ: 1, Digit4: 2, KeyE: 2 });
const BEAM_KEYS = new Set(["Digit1", "KeyJ"]);
const SLOT_KEYS = Object.freeze(["RMB·2", "Q·3", "E·4"]);
// Keyboard and mouse names only where a mouse plays; touch names the wheel's discs (Owner 2026-11-02).
const KIT_KEYS = Object.freeze({ basic: "LMB·1", ult: "R" });
const kitKey = (touch, slot) => touch ? (slot === "basic" ? t("kit.basic") : slot === "ult" ? t("kit.ult") : t("kit.slot", { n: slot + 1 }))
  : (KIT_KEYS[slot] ?? SLOT_KEYS[slot]);
const MODES = Object.freeze(["TOURNAMENT", "HARBOR", "RELAY"]);
// Mode cartridge glyphs (stroked SVG paths in a 24 grid): crossed blades, a wave, a relay bolt.
const MODE_GLYPHS = Object.freeze({
  TOURNAMENT: "M4 20 15 9M15 9l1-5 4 4-5 1M20 20 9 9M9 9 8 4 4 8l5 1M6 15l3 3M18 15l-3 3",
  HARBOR: "M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M12 3v8M8 7l4-4 4 4",
  RELAY: "M13 2 5 13h6l-2 9 9-12h-6l1-8z"
});
function glyph(path, className = "da-glyph") {
  const svg = svgElement("svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", className);
  const stroke = svgElement("path");
  stroke.setAttribute("d", path);
  svg.appendChild(stroke);
  return svg;
}
// A partner's own move keeps its approved battle name; the arena line says what it does here.
const ownMoveText = (id) => { const own = relayOwnMoveInfo(id); return own && `${battleMoveName(own.record) ?? id}｜${t(`relay.style.${own.style}`)}${t(`relay.palette.${own.palette}`)}`; };
const moveText = (id) => ownMoveText(id) ?? t(`move.${id}`);
const moveName = (id) => moveText(id).split(/\s*[｜|]\s*/)[0];
const moveEffect = (id) => moveText(id).split(/\s*[｜|]\s*/)[1] ?? "";
const basicName = (partnerId) => { const record = relayBasicRecord(relayPartner(partnerId)?.speciesIndex); return (record !== null && battleMoveName(record)) || t(`move.${RELAY_ACTION_PROFILES[partnerId].basic}`); };
// Skill-button colour key only: relay partners carry their roster element.
const LEGACY_ELEMENTS = Object.freeze({ "ember-lizard": "fire", "corona-cub": "light", "frost-drake": "frost" });
const partnerElement = (id) => relayPartner(id)?.element ?? LEGACY_ELEMENTS[id] ?? "physical";
/** A short haptic tick on Android; iOS and desktop ignore it. */
function tick() { try { globalThis.navigator?.vibrate?.(8); } catch { /* unsupported */ } }

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
/** Cooldown share for the pie mask; past half a turn the second half shows. */
function setCool(node, value) {
  node.style.setProperty("--cool", value);
  node.classList.toggle("is-cool-late", Number(value) > 0.5);
}
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ensureStylesheet() {
  return Promise.all([
    loadStylesheet(new URL('./dataArena.css', import.meta.url).href),
    loadStylesheet(new URL('./ui/juicyShowcase.css', import.meta.url).href)
  ]);
}

/**
 * Open the arena. `ensureStage(host, signal)` returns the shared Championship
 * Pixi stage attached to `host`; `audioBus`/`music` are the product's.
 */
export async function openDataArena({ ensureStage, audioBus = null, music = null, storage = null, reducedMotion = false,
  resolutionCap = 2, onExit = () => {}, onVictory = null, href = globalThis.location?.href, qa = false, seed = null, progress = null,
  burstPlanOf = null, sponsor = null, syncPowerOf = null, onSyncResult = null, syncPanelFor = null, campaign = null, onCampaignResult = null }) {
  await ensureStylesheet();
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let port = null;
  try { port = storage ? createChampionshipDataArenaPort({ storage }) : null; } catch { port = null; }
  const records = createDataArenaRecordStore({ port });
  const cast = dataArenaCast(href, {includeRelay:true});
  const coarse = globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const settings = records.get().settings;
  let shake = settings.shake && !reducedMotion;
  let quality = settings.quality === "auto" ? (coarse || Math.min(innerWidth, innerHeight) < 500 ? "low" : "high") : settings.quality;
  // Burst evolution (OWNER_APPROVED_ADAPTATION 2026-11-02): former 覺醒體/究極體 are a 成熟期's burst forms in the
  // relay too, so they are not picked; a saved pick of one becomes the 成熟期 that bursts into it.
  const relayIndexOf = id => Number(String(relayPartner(id)?.speciesId ?? '').split('-').at(-1));
  // Stage 5/6 entries (the ROM's 224-227 duplicates too) and the alternate forms are never picked.
  const relayBurstOnly = p => (p?.generationIndex ?? 0) >= 5 || isBurstForm(p?.speciesIndex);
  const relayPickable = id => {
    if (!String(id ?? '').startsWith('relay-') || !relayPartner(id) || !relayBurstOnly(relayPartner(id))) return id;
    const base = burstBasesFor(relayIndexOf(id)).map(i => `relay-species-${String(i).padStart(3, '0')}`).find(b => relayPartner(b));
    return base ?? RELAY_ROSTER.find(p => !relayBurstOnly(p))?.id ?? id;
  };
  // Awakening raising (Owner 2026-11-02): a relay entry raised on the ranch bursts into the form that partner
  // learned. Owner 2026-11-08: only that -- a Dex-only or rental entry, or a partner that learned no form, never
  // bursts (null), as in the auto battle.
  const relayBurstPlanOf = id => {
    const instanceId = entryOf('RELAY', id)?.instanceId ?? null;
    return instanceId && typeof burstPlanOf === 'function' ? burstPlanOf(instanceId) ?? null : null;
  };
  const relayBurstMembers = id => {
    const plan = relayBurstPlanOf(id);
    return [plan?.via, plan?.form].filter(Number.isInteger)
      .map(form => cast.partners.find(m => m.partnerId === `relay-species-${String(form).padStart(3, '0')}` || m.speciesId === `species-${String(form).padStart(3, '0')}`) ?? null);
  };
  let partnerId = relayPickable(records.get().lastPartnerId);
  const relayLoadouts = records.get().relayLoadouts ?? {};
  let relayReserveId=relayPickable(records.get().relayReserveId),relayThirdId=relayPickable(records.get().relayThirdId),relayArenaId=records.get().relayArenaId;
  let gameMode = MODES.includes(records.get().lastMode) ? records.get().lastMode : "TOURNAMENT";
  // Journey zone stage (Owner 2026-11-10): RELAY on its own field against its own three rivals, with
  // buff picks between waves; mode and field are fixed and the arena's own records keep their choices.
  if (campaign) { gameMode = "RELAY"; relayArenaId = campaign.field; }
  const campaignCast = campaign ? campaign.rivals.map((r) => cast.partners.find((p) => p.speciesId === r.speciesId) ?? null) : null;
  const rivalName = (rivalId) => cast.rivals.find((rival) => rival.rivalId === rivalId)?.name
    ?? campaignCast?.[campaign.rivals.findIndex((r) => r.id === rivalId)]?.name ?? "";
  // Entry rights (Owner 2026-11-02): partners raised on the ranch or lit in the
  // Dex fight; a thin save is lent practice partners. Tournament and harbor share three kits.
  const roster = (list) => list.map(({ id, speciesId }) => ({ id, speciesId }));
  // Owner 2026-11-08: of several held individuals of one species, the one that learned a burst form fights for it.
  const learnedFirst = progress?.ownedInstances && typeof burstPlanOf === "function"
    ? { ...progress, ownedInstances: [...progress.ownedInstances].sort((x, y) => Number(!burstPlanOf(x.instanceId)) - Number(!burstPlanOf(y.instanceId))) }
    : progress;
  const entryLists = { TOURNAMENT: dataArenaEntries(roster(DATA_ARENA_PARTNERS), learnedFirst), RELAY: dataArenaEntries(roster(RELAY_ROSTER.filter((p) => !relayBurstOnly(p))), learnedFirst) };
  entryLists.HARBOR = entryLists.TOURNAMENT;
  const entriesFor = (mode) => entryLists[mode] ?? entryLists.TOURNAMENT;
  const entryOf = (mode, id) => entriesFor(mode).find((row) => row.id === id) ?? null;
  let partnerPower = {};
  // Sync Level (Owner 2026-11-09): a ranch partner's level multiplies its entry power.
  const withSyncPower = (power) => {
    if (typeof syncPowerOf !== "function") return power;
    const next = { ...power };
    for (const row of entriesFor(gameMode)) if (row.instanceId && next[row.id] !== undefined) next[row.id] *= syncPowerOf(row.instanceId) ?? 1;
    return Object.freeze(next);
  };
  const fighterInstances = () => [...new Set((gameMode === "RELAY" ? [partnerId, relayReserveId, relayThirdId] : [partnerId])
    .map((id) => entryOf(gameMode, id)?.instanceId ?? null).filter(Boolean))];

  // ------------------------------------------------------------------ DOM skeleton
  const root = el("div", "da-root");
  root.dataset.state = "SELECT";
  root.dataset.mode = gameMode;
  root.dataset.quality = quality;
  if (reducedMotion) root.dataset.motion = "reduced";
  root.setAttribute("role", "application");
  root.setAttribute("aria-label", t("mode.title"));
  const field = el("div", "da-field");
  // Arcade theme (Owner 2026-10-28): a power skill's cut-in strip with a 35 %
  // spotlight on the caster. DOM only; the arena keeps stepping underneath.
  const cutIn = juicyPresentationEnabled(document) ? createSkillCutInLayer({ host: field, spotlight: true }) : null;
  const hud = el("div", "da-hud");
  const overlay = el("div", "da-overlay");
  // Menus and result cards wear the game's arcade paper (ui/tokens.css) under any theme.
  overlay.dataset.palette = "arcade";
  const touch = el("div", "da-touch");
  touch.hidden = true;
  root.append(field, hud, touch, overlay);
  // Mounted on <html>, not <body>: in landscape the product scales <body> into
  // its 9:16 frame (portraitFrame.js), and that transform would trap this
  // fixed full-viewport field inside the frame. The title stays framed below.
  document.documentElement.appendChild(root);
  document.documentElement.classList.add("da-open");
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { signal });
  root.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });

  let stage = null, scene = null, sim = null, audio = null;
  let environment = null;
  let interactionArt = null;
  const qaRecentEvents=[];
  const bundles = new Map();
  let bundleScope = null;
  let tickerCallback = null;
  let accumulator = 0;
  let paused = false;
  let qualityReloading = false;
  let matchId = 0;
  let result = null, staked = null;

  // ------------------------------------------------------------------ input
  const keys = new Set();
  const latch = { dash: false, surge: false, ride: false, cast: null, ult: false, castAuto: false, castAim: null, switchPartner: false, burst: false, overLimit: false };
  const pointer = { x: null, y: null, fire: false };
  const sticks = { move: null, aim: null };
  let aimVector = { x: 1, y: 0 };
  let touchActive = coarse;
  let basicPointerId = null;
  // Touch aim (Owner 2026-11-04): a tapped move auto-aims at the nearest rival; held and dragged, the move or the basic
  // points where the thumb pulls (a zone lands as far as the pull) and casts on release.
  const AIM_DEAD = 14, AIM_PULL = 60;
  let held = null, basicOrigin = null, basicAim = null;
  const aimOf = (origin, event) => { const dx = event.clientX - origin.ox, dy = event.clientY - origin.oy, length = Math.hypot(dx, dy);
    return length < AIM_DEAD ? null : { x: dx / length, y: dy / length, power: Math.min(1, length / AIM_PULL) }; };
  const heldMove = key => { const kit = sim?.getState().player.kit, id = key === 'ult' ? kit?.ultimate : kit?.moves?.[key]; return id ? sim.moveInfo(id, key === 'ult') : null; };
  const aimReach = (move, power) => { const range = move?.range ?? move?.distance ?? 320; return move?.type === 'ZONE' ? Math.max(70, range * power) : range; };
  // The one aim guide drawn while a thumb points a move: its direction and where it lands, nothing else.
  function aimGuide() {
    const state = sim?.getState();
    const aim = held?.aim ?? basicAim;
    if (!state || !aim) return null;
    const move = held?.aim ? heldMove(held.key) : sim.moveInfo(RELAY_ACTION_PROFILES[state.player.partnerId]?.basic ?? '');
    if (!move) return null;
    const angle = Math.atan2(aim.y, aim.x);
    if (move.type === 'NOVA') return { angle: null, length: 0, radius: move.radius };
    if (move.type === 'ZONE') return { angle, length: aimReach(move, aim.power), radius: move.radius };
    return { angle, length: move.type === 'LUNGE' ? move.distance : Math.min(move.range ?? 400, 520), radius: 0 };
  }
  root.dataset.input = touchActive ? 'touch' : 'mouse';
  touch.hidden = !touchActive;

  function buildInput() {
    let mx = 0, my = 0;
    for (const code of keys) { const v = MOVE_KEYS[code]; if (v) { mx += v[0]; my += v[1]; } }
    if (sticks.move?.vector) { mx += sticks.move.vector.x; my += sticks.move.vector.y; }
    const state = sim.getState();
    const body = state.player.state === "RIDING" ? state.mate : state.player;
    let aimX = null, aimY = null, fire = pointer.fire || basicPointerId !== null || [...BEAM_KEYS].some((code) => keys.has(code));
    if (sticks.aim?.vector && Math.hypot(sticks.aim.vector.x, sticks.aim.vector.y) > 0.28) {
      const v = sticks.aim.vector, length = Math.hypot(v.x, v.y);
      aimVector = { x: v.x / length, y: v.y / length };
      fire = true;
    }
    const pointed = latch.castAim ?? basicAim;
    if (pointed) aimVector = { x: pointed.x, y: pointed.y };
    const reach = latch.castAim?.reach ?? 320;
    if (touchActive && !pointer.mouse) { aimX = body.x + aimVector.x * reach; aimY = body.y + aimVector.y * reach; }
    else if (pointer.x !== null && pointer.mouse && scene) { const w = scene.screenToWorld(pointer.x, pointer.y); aimX = w.x; aimY = w.y; }
    else { const auto = sim.autoAimPoint(); aimX = auto.x; aimY = auto.y; } // keyboard only: lock onto the nearest visible target
    // Without a mouse (keyboard, or a tapped touch button) skills auto-aim; the aim stick or mouse aims by hand.
    const manualTouch = touchActive && (pointed || (sticks.aim?.vector && Math.hypot(sticks.aim.vector.x, sticks.aim.vector.y) > 0.28));
    const autoAim = latch.castAuto || (!pointer.mouse && !manualTouch);
    const input = { moveX: mx, moveY: my, aimX, aimY, fire, dash: latch.dash, surge: latch.surge, ride: latch.ride, cast: latch.cast, ult: latch.ult, autoAim, switchPartner: latch.switchPartner, burst: latch.burst, overLimit: latch.overLimit };
    latch.dash = latch.surge = latch.ride = latch.ult = latch.castAuto = false;
    latch.cast = null; latch.castAim = null; latch.switchPartner = false; latch.burst = false; latch.overLimit = false;
    return input;
  }

  window.addEventListener("keydown", (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    const playing = root.dataset.state === "PLAY";
    if (event.code === "Escape" || event.code === "KeyP") {
      if (event.code === "Escape" && root.dataset.state === "LOADING") { event.preventDefault(); cancelMatchLoad(); }
      else if (root.dataset.state === "PLAY" || root.dataset.state === "PAUSE") { event.preventDefault(); togglePause(); }
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
    if (event.code === "Space" || event.code.startsWith("Shift") || event.code === "Tab") latch.dash = true;
    if (event.code in SKILL_KEYS) latch.cast = SKILL_KEYS[event.code];
    if (event.code === "KeyR") latch.ult = true;
    if (event.code === "KeyX") latch.switchPartner = gameMode === "RELAY" ? "first" : true;
    // B taps the burst; holding it for the over-limit time calls the over-limit burst (AWAKENING_OVERDRIVE_20261109).
    if (event.code === "KeyB") { clearTimeout(burstKeyTimer); burstKeyTimer = setTimeout(() => { burstKeyTimer = null; latch.overLimit = true; }, OVER_LIMIT_RULES.holdMs); }
    if (event.code === "KeyF") latch.surge = true;
    if (event.code === "KeyC") { if (gameMode === "RELAY") latch.switchPartner = "second"; else latch.ride = true; }
  }, { signal, capture: true });
  let burstKeyTimer = null;
  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
    if (event.code === "KeyB" && burstKeyTimer) { clearTimeout(burstKeyTimer); burstKeyTimer = null; latch.burst = true; }
  }, { signal, capture: true });
  window.addEventListener("blur", releaseInputs, { signal });
  function releaseInputs() {
    keys.clear(); clearTimeout(burstKeyTimer); burstKeyTimer = null; Object.assign(latch, { dash:false, surge:false, ride:false, cast:null, ult:false, castAuto:false, castAim:null, switchPartner:false, burst:false, overLimit:false }); held = basicOrigin = basicAim = null; pointer.fire = false; sticks.move = sticks.aim = null;
    basicPointerId = null;
    for (const node of touch.querySelectorAll('.is-pressed')) node.classList.remove('is-pressed');
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
    if (touchActive) { touchActive = false; touch.hidden = true; root.dataset.input = 'mouse'; }
    if (event.button === 0) pointer.fire = true;
    if (event.button === 2) latch.cast = 0;
    field.setPointerCapture?.(event.pointerId);
  }, { signal });
  field.addEventListener("pointerup", (event) => { if (event.button === 0) pointer.fire = false; }, { signal });
  field.addEventListener("pointercancel", () => { pointer.fire = false; }, { signal });

  // Touch: two floating sticks (left half moves, right half aims and fires) and buttons.
  const moveStick = makeStick("da-stick--move"), aimStick = makeStick("da-stick--aim");
  const touchButtons = el("div", "da-touch__buttons");
  const moveHint = el('div', 'da-move-hint', t('relay.touch.move'));
  moveHint.setAttribute('aria-hidden', 'true');
  const basicButton = button('da-tbtn da-tbtn--basic', '', () => {}, signal);
  basicButton.append(el('span', 'da-tbtn__label', t('relay.touch.basic')), el('span', 'da-tbtn__meta', '0 TP'));
  basicButton.setAttribute('aria-label', t('relay.touch.attack'));
  basicButton.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopPropagation();
    if (root.dataset.state !== 'PLAY' || basicPointerId !== null) return;
    basicPointerId = event.pointerId; pointer.mouse = false; basicOrigin = { ox: event.clientX, oy: event.clientY }; basicAim = null;
    basicButton.setPointerCapture?.(event.pointerId);
    basicButton.classList.add('is-pressed');
    tick();
  }, {signal});
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) basicButton.addEventListener(type, event => {
    if (basicPointerId === event.pointerId) { basicPointerId = null; basicOrigin = basicAim = null; basicButton.classList.remove('is-pressed'); }
  }, {signal});
  basicButton.addEventListener('pointermove', event => { if (basicPointerId === event.pointerId && basicOrigin) basicAim = aimOf(basicOrigin, event); }, {signal});
  const dashButton = button("da-tbtn da-tbtn--dash", t("touch.dash"), () => {}, signal);
  const surgeButton = button("da-tbtn da-tbtn--surge", t("touch.surge"), () => {}, signal);
  const rideButton = button("da-tbtn da-tbtn--ride", t("touch.ride"), () => {}, signal);
  const switchButton = button("da-tbtn da-tbtn--switch", t("relay.switch"), () => {}, signal);
  const switchButton2 = button("da-tbtn da-tbtn--switch2", t("relay.switch"), () => {}, signal);
  // The player's call for a full burst gauge, beside the switch (awakening raising, 2026-11-02).
  const burstButton = button("da-tbtn da-tbtn--burst", t("relay.touch.burst"), () => {}, signal);
  const ultButton = button("da-tbtn da-tbtn--ult", t("touch.ult"), () => {}, signal);
  const skillButtons = [0, 1, 2].map((slot) => button(`da-tbtn da-tbtn--skill da-tbtn--s${slot + 1}`, String(slot + 2), () => {}, signal));
  // A tapped skill auto-aims at the nearest visible rival; a held one is pointed by hand (see aimGuide).
  const press = (key) => () => {
    if (key === "ult") latch.ult = true;
    else if (typeof key === "number") latch.cast = key;
    else if (key === "switch1") latch.switchPartner = Number(switchButton.dataset.targetSlot || 0) || "first";
    else if (key === "switch2") latch.switchPartner = Number(switchButton2.dataset.targetSlot || 0) || "second";
    else latch[key] = true;
    if (key === "ult" || typeof key === "number") latch.castAuto = true;
  };
  for (const [node, key] of [[switchButton, "switch1"], [switchButton2, "switch2"], [burstButton, "burst"], [dashButton, "dash"], [surgeButton, "surge"], [rideButton, "ride"], [ultButton, "ult"], ...skillButtons.map((node, slot) => [node, slot])]) {
    const fire = press(key), aimed = key === "ult" || typeof key === "number";
    // The burst key: a tap bursts, a long press or a double tap goes over the limit (AWAKENING_OVERDRIVE_20261109).
    if (key === "burst") bindOverLimitPress(node, { holdMs: OVER_LIMIT_RULES.holdMs, doubleTapMs: OVER_LIMIT_RULES.doubleTapMs,
      ready: () => root.dataset.state === "PLAY", onStandard: () => { latch.burst = true; tick(); }, onOverLimit: () => { latch.overLimit = true; tick(); } });
    else node.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); if (root.dataset.state === "PLAY") {
      if (aimed) held = { key, id: event.pointerId, ox: event.clientX, oy: event.clientY, aim: null }; else { fire(); tick(); }
      node.setPointerCapture?.(event.pointerId); node.classList.add("is-pressed"); } }, { signal });
    if (aimed) {
      node.addEventListener("pointermove", (event) => { if (held?.key === key && held.id === event.pointerId) held.aim = aimOf(held, event); }, { signal });
      node.addEventListener("pointerup", (event) => {
        if (held?.key !== key || held.id !== event.pointerId) return;
        const aim = held.aim; held = null;
        if (root.dataset.state !== "PLAY") return;
        fire(); tick();
        if (aim) { latch.castAuto = false; latch.castAim = { x: aim.x, y: aim.y, reach: aimReach(heldMove(key), aim.power) }; }
      }, { signal });
      node.addEventListener("pointercancel", () => { if (held?.key === key) held = null; }, { signal });
    }
    for (const end of ["pointerup", "pointercancel", "pointerleave"]) node.addEventListener(end, () => node.classList.remove("is-pressed"), { signal });
    const ring = el("span", "da-tbtn__cooldown");
    node.replaceChildren(el('span', 'da-tbtn__label', node.textContent), ring, el('span', 'da-tbtn__meta'));
    touchButtons.appendChild(node);
  }
  // Dual reserve tag buttons show each reserve partner's portrait, element ring, advantage badge and HP gauge.
  for (const btn of [switchButton, switchButton2]) {
    const avatar = el('img', 'da-tbtn__avatar');
    avatar.alt = ''; avatar.decoding = 'async';
    const adv = el('span', 'da-tbtn__adv', t('relay.touch.advantage'));
    adv.setAttribute('aria-hidden', 'true');
    const gauge = el('span', 'da-tbtn__reserve');
    gauge.setAttribute('aria-hidden', 'true');
    btn.append(avatar, adv, gauge);
  }
  touchButtons.appendChild(basicButton);
  touch.append(moveHint, moveStick.base, aimStick.base, touchButtons);
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
    if (!touchActive) { touchActive = true; touch.hidden = false; root.dataset.input = 'touch'; }
    pointer.mouse = false;
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
    // The white ghost holds the old value and shrinks after the hit (CSS delay).
    hudRefs.hpGhost = el("span", "da-bar__ghost");
    const hpBar = el("div", "da-bar da-bar--hp"); hpBar.append(el("span", "da-bar__label", t("hud.hp")), hudRefs.hpGhost, hudRefs.hpFill);
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
    hudRefs.combo = el("div", "da-hud__combo");
    hudRefs.combo.hidden = true;
    top.append(left, center, right, pause, hudRefs.combo);
    // The rival's bar is a slim strip tucked under the top bar, never over the field (Owner 2026-11-02).
    hudRefs.boss = el("div", "da-boss");
    hudRefs.bossElement = el("span", "da-boss__element");
    hudRefs.bossName = el("span", "da-boss__name", gameMode === "TOURNAMENT" ? "" : cast.boss.name);
    hudRefs.bossFill = el("span", "da-bar__fill");
    hudRefs.bossGhost = el("span", "da-bar__ghost");
    hudRefs.bossFlash = el("span", "da-bar__flash");
    const bossBar = el("div", "da-bar da-bar--boss"); bossBar.append(hudRefs.bossGhost, hudRefs.bossFill, hudRefs.bossFlash);
    hudRefs.bossTeam = el("span", "da-boss__team");
    hudRefs.bossTeamRows = [0, 1, 2].map((index) => {
      const pip = el("span", "da-boss__pip");
      pip.append(el("span", "da-boss__pip-no", String(index + 1)), el("span", "da-boss__pip-hp"));
      return pip;
    });
    hudRefs.bossTeam.append(...hudRefs.bossTeamRows);
    hudRefs.bossShield = el("span", "da-boss__shield");
    hudRefs.boss.append(hudRefs.bossElement, hudRefs.bossName, bossBar, hudRefs.bossTeam, hudRefs.bossShield);
    hudRefs.boss.hidden = true;
    const bottom = el("div", "da-hud__bottom");
    hudRefs.heatFill = el("span", "da-bar__fill");
    hudRefs.heat = el("div", "da-bar da-bar--heat"); hudRefs.heat.append(el("span", "da-bar__label", t("hud.heat")), hudRefs.heatFill);
    hudRefs.energyFill = el("span", "da-bar__fill");
    hudRefs.energy = el("div", "da-bar da-bar--energy"); hudRefs.energy.append(el("span", "da-bar__label", gameMode === "RELAY" ? "TP" : t("hud.energy")), hudRefs.energyFill);
    hudRefs.energyText = el("span", "da-bar__value"); hudRefs.energy.appendChild(hudRefs.energyText);
    const gauges = el("div", "da-gauges"); gauges.append(hudRefs.heat, hudRefs.energy);
    if (gameMode === 'RELAY') left.appendChild(hudRefs.energy);
    // Kit: three skills (energy + cooldown) and the ultimate (charge). The beam is the heat gauge.
    hudRefs.slots = [];
    const kit = el("div", "da-kit");
    // A burst fighter uses its form's relay role (Owner 2026-11-08, BURST_TRUE_FORM_20261108).
    const currentPartner = sim?.getState().player.formPartnerId ?? sim?.getState().player.partnerId ?? partnerId;
    root.dataset.element = partnerElement(currentPartner);
    const activeKit = gameMode === "RELAY" ? relayKit(currentPartner, relayLoadouts[currentPartner]) : DATA_ARENA_KITS[currentPartner];
    const kitMoves = activeKit?.moves ?? [];
    kitMoves.forEach((id, slot) => {
      const node = button("da-slot", "", () => { if (root.dataset.state === "PLAY") { latch.cast = slot; latch.castAuto = !pointer.mouse; } }, signal);
      const cool = el("span", "da-slot__cool");
      node.append(el("span", "da-slot__key", SLOT_KEYS[slot]), el("span", "da-slot__name", moveName(id)), cool);
      node.title = `${moveName(id)} — ${moveEffect(id)}`;
      hudRefs.slots.push(node);
      kit.appendChild(node);
    });
    hudRefs.ult = button("da-slot da-slot--ult", "", () => { if (root.dataset.state === "PLAY") { latch.ult = true; latch.castAuto = !pointer.mouse; } }, signal);
    hudRefs.ult.append(el("span", "da-slot__key", "R"), el("span", "da-slot__name", moveName(activeKit?.ultimate ?? "")), el("span", "da-slot__charge"), el('span', 'da-slot__meta'));
    kit.appendChild(hudRefs.ult);
    for (const [slot, node] of skillButtons.entries()) node.firstChild.textContent = kitMoves[slot] ? moveName(kitMoves[slot]) : "";
    ultButton.firstChild.textContent = t(gameMode === 'RELAY' ? 'relay.touch.ult' : 'touch.ult');
    hudRefs.dash = el("div", "da-chip", t("hud.dash"));
    hudRefs.surge = el("div", "da-chip da-chip--harbor", t("hud.surge"));
    hudRefs.ride = el("div", "da-chip da-chip--harbor", t("hud.ride"));
    hudRefs.switch = button('da-relay-switch', t('relay.switch'), () => { if (root.dataset.state === 'PLAY') latch.switchPartner = true; }, signal);
    hudRefs.burst = button('da-relay-burst', t('relay.burst.button'), () => {}, signal);
    bindOverLimitPress(hudRefs.burst, { holdMs: OVER_LIMIT_RULES.holdMs, doubleTapMs: OVER_LIMIT_RULES.doubleTapMs,
      ready: () => root.dataset.state === 'PLAY', onStandard: () => { latch.burst = true; }, onOverLimit: () => { latch.overLimit = true; } });
    hudRefs.overLimit = el('p', 'da-over-limit');
    hudRefs.overLimit.hidden = true;
    hudRefs.overLimit.setAttribute('role', 'status');
    hudRefs.team = el('div', 'da-relay-team');
    // Mini tags for seats 1, 2 and 3 (number, name, a health sliver) and the trio's
    // faction resonance as one small badge on the same row, inside the top bar.
    hudRefs.teamRows = [0, 1, 2].map((index) => {
      const tag = el('div', 'da-mini');
      tag.append(el('span', 'da-mini__no', String(index + 1)), el('span', 'da-mini__name'), el('span', 'da-mini__hp'), el('span', 'da-mini__state'));
      return tag;
    });
    hudRefs.team.append(...hudRefs.teamRows);
    const resonance = sim?.getState().relay?.resonance ?? [];
    if (resonance.length) { hudRefs.resonance = resonanceStrip(resonance, {hint: false}); hudRefs.resonance.classList.add('da-hud__resonance'); hudRefs.team.appendChild(hudRefs.resonance); }
    left.appendChild(hudRefs.team);
    bottom.append(hudRefs.switch, hudRefs.burst, gauges, kit, hudRefs.dash, hudRefs.surge, hudRefs.ride);
    hudRefs.banner = el("div", "da-banner");
    hudRefs.banner.hidden = true;
    // Track three: one tactical line under the rival strip (see tactical()).
    hudRefs.tactical = el("div", "da-tactical");
    hudRefs.tactical.setAttribute("aria-live", "polite");
    tacticalLast = null;
    hudRefs.vignette = el("div", "da-vignette");
    hud.append(hudRefs.vignette, top, hudRefs.boss, hudRefs.tactical, hudRefs.banner, bottom);
    if (hudRefs.overLimit) hud.append(hudRefs.overLimit);
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
  // The rival bar drops at once, its ghost follows late, and a hit flashes it white.
  const bossWidth = (node, share) => {
    const previous = Number(node.dataset.share ?? 1);
    width(node, share); width(hudRefs.bossGhost, share); node.dataset.share = String(share);
    if (share < previous && !reducedMotion) hudRefs.bossFlash.animate?.([{ opacity: 0.85 }, { opacity: 0 }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
  };
  function updateHud() {
    const snap = sim.getSnapshot();
    const p = snap.player, m = snap.mate;
    put("hp", hudRefs.hpFill, width, Math.round((p.hp / p.maxHp) * 200) / 200);
    put("hpGhost", hudRefs.hpGhost, width, Math.round((p.hp / p.maxHp) * 200) / 200);
    put("hpText", hudRefs.hpText, text, `${p.hp}/${p.maxHp}`);
    put("mate", hudRefs.mateFill, width, Math.round((m.hp / m.maxHp) * 100) / 100);
    put("mateDown", hudRefs.mateFill.parentElement, (node, v) => node.classList.toggle("is-down", v), m.state === "DOWNED");
    put("revives", hudRefs.revives, text, t("hud.revives", { count: p.revives }));
    const objective = snap.objective;
    const comboCount = snap.combo?.active && snap.combo.count >= 2 ? snap.combo.count : 0;
    put("combo", hudRefs.combo, (node, count) => {
      node.hidden = count < 2;
      if (count >= 2) {
        node.textContent = t("hud.combo", { count });
        node.dataset.tier = count >= 8 ? "max" : count >= 4 ? "high" : "mid";
      }
    }, comboCount);
    if (objective.id === 'RELAY') {
      put('timer', hudRefs.timer, text, formatTime(objective.timeLeft));
      put('timerLow', hudRefs.timer, (node, v) => node.classList.toggle('is-low', v), objective.timeLeft <= 30);
      put('lowTimeVignette', hudRefs.vignette, (node, v) => node.classList.toggle('is-final30', v), objective.timeLeft <= 30);
      put('phase', hudRefs.phase, text, t('mode.RELAY'));
      const rivalsAlive = snap.relay.rivalsAlive ?? (3 - snap.relay.enemyIndex);
      put('objective', hudRefs.objective, text, t('relay.remaining', { count: rivalsAlive }));
      snap.relay.team.forEach((member, index) => {
        if (!hudRefs.teamRows[index]) return;
        // Burst evolution: the form's name while burst; the gauge or a mark in the tag's own state slot.
        const name = member.burst?.phase === 'BURST' ? speciesName(member.burst.form) : cast.partners.find(p => p.partnerId === member.partnerId)?.name ?? '';
        const state = member.burst ? member.burst.phase === 'CHARGING' ? `⚡${member.burst.gauge}%` : member.burst.phase === 'READY' ? t('relay.burst.ready')
          : member.burst.phase === 'BURST' ? t('relay.burst.mark') : '' : '';
        const share = Math.round(Math.max(0, member.hp) / member.maxHp * 20) / 20;
        put(`team${index}`, hudRefs.teamRows[index], (node, value) => {
          const [active, hp, label, shown, phase] = value.split('|');
          node.classList.toggle('is-active', active === '1'); node.classList.toggle('is-down', Number(hp) <= 0);
          node.children[1].textContent = label; node.children[2].style.setProperty('--hp', hp); node.children[3].textContent = shown;
          node.dataset.burst = phase; node.title = `${label} ${member.hp}/${member.maxHp}`;
        }, `${index === snap.relay.active ? 1 : 0}|${share}|${name}|${state}|${member.burst?.phase ?? ''}`);
      });
      if (Array.isArray(snap.relay.rivalTeam)) {
        snap.relay.rivalTeam.forEach((rm, idx) => {
          if (!hudRefs.bossTeamRows[idx]) return;
          const rShare = Math.round(Math.max(0, rm.hp) / Math.max(1, rm.maxHp) * 20) / 20;
          put(`bossTeam${idx}`, hudRefs.bossTeamRows[idx], (node, val) => {
            const [act, hpShare] = val.split('|');
            node.classList.toggle('is-active', act === '1');
            node.classList.toggle('is-down', Number(hpShare) <= 0);
            node.children[1].style.setProperty('--hp', hpShare);
          }, `${rm.active ? 1 : 0}|${rShare}`);
        });
      }
      put('tpFull', hudRefs.energy, (node, v) => node.classList.toggle('is-full', v), snap.kit.energy >= DATA_ARENA_RELAY.ultimateTp);
      // The burst call: the button fills with the gauge and glows while READY until pressed (Owner 2026-11-08).
      const own = snap.relay.burst;
      const burstState = !own || own.phase === 'SPENT' || own.phase === 'WEAK' ? 'none' : own.phase;
      const burstFill = own?.phase === 'CHARGING' ? Math.round(own.gauge / 5) * 5 / 100 : 1;
      for (const [key, node] of [['burstBtn', hudRefs.burst], ['tburst', burstButton]])
        put(key, node, (n, value) => { const [phase, fill] = value.split('|'); n.dataset.burst = phase; n.hidden = phase === 'none'; n.style.setProperty('--burst', fill);
          n.classList.toggle('is-ready', phase === 'READY'); }, `${burstState}|${burstFill}`);
      // The over-limit countdown, then the exhaustion it may end in.
      const overState = own?.phase === 'BURST' && own.overLimit ? 'over' : own?.phase === 'EXHAUSTED' ? 'exhausted' : 'none';
      const overLeft = overState === 'none' || !Number.isFinite(own.until) ? 0 : Math.max(0, Math.ceil(own.until - snap.time));
      put('overLimit', hudRefs.overLimit, (n, value) => { const [state, left] = value.split('|'); n.hidden = state === 'none'; n.dataset.state = state;
        n.textContent = state === 'none' ? '' : uiText(state === 'exhausted' ? 'BATTLE_EXHAUSTED' : 'BATTLE_OVER_LIMIT_LEFT', { name: '', seconds: Number(left) }); }, `${overState}|${overLeft}`);
      if (snap.relay.rivalBurst?.warn && !rivalBurstWarned) { rivalBurstWarned = true; audio?.play('warn'); tactical(t('relay.burst.rivalWarn'), { tone: 'warn', key: 'burst-warn' }); }
      if (!snap.relay.rivalBurst?.warn) rivalBurstWarned = false;
      const cooldown = snap.relay.switchCooldown;
      const label = cooldown > 0 ? `${t('relay.switch')} ${Math.ceil(cooldown)}s` : t('relay.switch');
      put('switch', hudRefs.switch, text, label);
      const reserves = snap.relay.team
        .map((member, index) => ({ member, index }))
        .filter((entry) => entry.index !== snap.relay.active);
      const activeRival = snap.rivals[0];
      const rivalElement = activeRival ? speciesTaxonomyForId(activeRival.speciesId)?.element ?? null : null;
      [switchButton, switchButton2].forEach((btn, btnIdx) => {
        const entry = reserves[btnIdx];
        if (!entry) {
          btn.hidden = true;
          return;
        }
        btn.hidden = false;
        const { member, index } = entry;
        const slotNo = index + 1;
        const pArt = partnerArt(member.partnerId)?.portraitUrl ?? '';
        const pName = member.burst?.phase === 'BURST' ? speciesName(member.burst.form) : (cast.partners.find(cp => cp.partnerId === member.partnerId)?.name ?? t('relay.touch.switch'));
        const elKey = partnerElement(member.partnerId);
        const memberTaxElement = speciesTaxonomyForId(member.speciesId)?.element ?? null;
        const hpShare = Math.round(Math.max(0, member.hp) / Math.max(1, member.maxHp) * 20) / 20;
        const down = member.hp <= 0;
        const counters = !down && Boolean(rivalElement && ((memberTaxElement && elementMultiplierPercent(memberTaxElement, rivalElement) > 100) || (elKey === 'nature' && rivalElement === 'WATER')));
        const metaText = down ? 'KO' : cooldown > 0 ? `${Math.ceil(cooldown)}s` : `${Math.round(member.tp)}TP`;
        const coolShare = down ? 1 : Math.round(cooldown / DATA_ARENA_RELAY.switchCooldown * 40) / 40;
        put(`tswitch_${btnIdx}`, btn, (node, value) => {
          const [slotStr, nameStr, metaStr, hpStr, downStr, advStr, elStr, artUrl] = value.split('|');
          node.dataset.targetSlot = slotStr;
          node.dataset.element = elStr;
          node.dataset.advantage = advStr;
          node.classList.toggle('is-down', downStr === '1');
          node.classList.toggle('is-cooling', cooldown > 0 || downStr === '1');
          node.firstChild.textContent = nameStr;
          node.querySelector('.da-tbtn__meta').textContent = metaStr;
          node.querySelector('.da-tbtn__reserve')?.style.setProperty('--reserve-hp', hpStr);
          const img = node.querySelector('.da-tbtn__avatar');
          if (img && artUrl && img.getAttribute('src') !== artUrl) img.src = artUrl;
        }, `${slotNo}|${pName}|${metaText}|${hpShare}|${down ? 1 : 0}|${counters ? 1 : 0}|${elKey}|${pArt}`);
        put(`tswitchCool_${btnIdx}`, btn, (node, value) => setCool(node, value), coolShare);
      });
    } else if (objective.id === "DUEL") {
      const final = objective.round === objective.rounds;
      put("timer", hudRefs.timer, text, formatTime(objective.timeLeft));
      put("timerLow", hudRefs.timer, (node, v) => node.classList.toggle("is-low", v), objective.status === "FIGHT" && objective.timeLeft <= 10);
      put("phase", hudRefs.phase, text, final ? t("bracket.final") : t("hud.round", objective));
      put("objective", hudRefs.objective, text, objective.rivalId ? `VS ${rivalName(objective.rivalId)}` : "");
    } else {
      put("timer", hudRefs.timer, text, formatTime(DATA_ARENA_TIMELINE.limit - snap.time));
      put("phase", hudRefs.phase, text, t(`phase.${snap.phase}`));
      const objectiveText = objective.done ? `${t(`objective.${objective.id}`, objective)} ✓`
        : objective.id === "GUARDIAN" && objective.shielded ? t("objective.GUARDIAN.shield") : t(`objective.${objective.id}`, objective);
      put("objective", hudRefs.objective, text, objectiveText);
    }
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
      if (gameMode === 'RELAY') put('tdashPips', dashButton.querySelector('.da-tbtn__meta'), text, pips);
      put("tsurge", surgeButton, (node, v) => { node.classList.toggle("is-cooling", v > 0); setCool(node, v.toFixed(2)); }, Math.round(surgeShare * 50) / 50);
      put("tride", rideButton, (node, v) => { node.firstChild.textContent = t(v[0] === "1" ? "hud.dismount" : "touch.ride"); node.classList.toggle("is-cooling", v[2] === "0"); }, riding ? "1|1" : `0|${rideReady ? 1 : 0}`);
    }
    const kit = snap.kit;
    put("tpText", hudRefs.energyText, text, `${kit.energy}/${kit.energyMax}`);
    put("energy", hudRefs.energyFill, width, Math.round((kit.energy / kit.energyMax) * 100) / 100);
    kit.moves.forEach((move, slot) => {
      const cool = move.cooldownMax > 0 ? Math.round((move.cooldown / move.cooldownMax) * 40) / 40 : 0;
      const value = `${cool}|${move.ready ? 1 : 0}|${kit.energy >= move.energy ? 1 : 0}|${kit.casting === move.id ? 1 : 0}`;
      const apply = (node, v) => { const [c, ready, energy, casting] = v.split("|"); setCool(node, c); node.classList.toggle("is-cooling", Number(c) > 0);
        node.classList.toggle("is-noenergy", energy === "0"); node.classList.toggle("is-ready", ready === "1"); node.classList.toggle("is-casting", casting === "1"); };
      if (hudRefs.slots[slot]) put(`slot${slot}`, hudRefs.slots[slot], apply, value);
      if (touchActive && skillButtons[slot]) put(`tslot${slot}`, skillButtons[slot], apply, value);
      if (gameMode === 'RELAY' && touchActive) put(`tslotMeta${slot}`, skillButtons[slot].querySelector('.da-tbtn__meta'), text, move.cooldown > 0 ? `${(Math.ceil(move.cooldown * 10) / 10).toFixed(1)}s` : `${move.energy} TP`);
    });
    const ultReady = gameMode === 'RELAY' ? kit.energy >= DATA_ARENA_RELAY.ultimateTp && kit.ultimateCooldown <= 0 : kit.ult >= kit.ultMax;
    const ultValue = `${gameMode === 'RELAY' ? Math.min(1, kit.energy / DATA_ARENA_RELAY.ultimateTp) : Math.round((kit.ult / kit.ultMax) * 40) / 40}|${ultReady ? 1 : 0}`;
    if (gameMode === 'RELAY') {
      const meta = kit.ultimateCooldown > 0 ? `${Math.ceil(kit.ultimateCooldown)}s` : '80 TP';
      put('ultMeta', hudRefs.ult.querySelector('.da-slot__meta'), text, meta);
      put('tultMeta', ultButton.querySelector('.da-tbtn__meta'), text, meta);
      put('tultLabel', ultButton.firstChild, text, t('relay.touch.ult'));
      put('tultCooldown', ultButton, (node, value) => { setCool(node, value); node.classList.toggle('is-cooling', value > 0); }, Math.round(kit.ultimateCooldown / 12 * 50) / 50);
    }
    const applyUlt = (node, v) => { const [charge, ready] = v.split("|"); node.style.setProperty("--charge", charge); node.classList.toggle("is-ready", ready === "1"); };
    put("ult", hudRefs.ult, applyUlt, ultValue);
    if (touchActive) put("tult", ultButton, applyUlt, ultValue);
    const boss = snap.boss;
    const rival = snap.rivals[0];
    if (rival) {
      put("bossShown", hudRefs.boss, (node, v) => { node.hidden = !v; }, true);
      // Burst evolution: a burst relay rival goes by its form's name.
      const rivalBurst = snap.relay?.rivalBurst;
      put("bossName", hudRefs.bossName, text, rivalBurst?.phase === 'BURST' ? speciesName(rivalBurst.form) : rivalName(rival.id));
      put("bossElement", hudRefs.bossElement, (node, speciesId) => {
        const element = speciesTaxonomyForId(speciesId)?.element ?? null;
        node.replaceChildren(...(element ? [taxonomyGlyph(`element.${element}`, 16)] : []));
        node.style.setProperty('--tax-color', element ? TAXONOMY_COLORS[`element.${element}`] ?? '#cbd5e1' : 'transparent');
      }, rival.speciesId ?? '');
      put("bossHp", hudRefs.bossFill, bossWidth, Math.round((rival.hp / rival.maxHp) * 200) / 200);
      put("bossShield", hudRefs.bossShield, text, rival.rooted ? "❄" : rival.slowed ? "≋" : rival.casting ? "!" : "");
    } else {
      put("bossShown", hudRefs.boss, (node, v) => { node.hidden = !v; }, Boolean(boss && boss.state !== "DOWN"));
      if (boss) {
        put("bossHp", hudRefs.bossFill, bossWidth, Math.round((boss.hp / boss.maxHp) * 200) / 200);
        put("bossShield", hudRefs.bossShield, text, boss.shielded ? "🛡" : boss.enraged ? "!!" : "");
      }
    }
    put("lowHp", hudRefs.vignette, (node, v) => node.classList.toggle("is-low", v), p.hp / p.maxHp < 0.3 && p.state !== "DOWNED");
    root.dataset.playerState = p.state;
  }

  // ------------------------------------------------------------------ combat telemetry (Owner 2026-11-02)
  // Three tracks, and no boxed text over the field:
  //  1. beside a body: frameless outlined words and numbers drawn by the scene;
  //  2. on a skill button: a short flag, a shake and the TP bar flashing red;
  //  3. one tactical line under the rival strip: at most one at a time, a
  //     repeat within 1.8 s counts up (×2) instead of stacking a second line.
  const toastThrottle = new Map();
  function toast(message, { x = null, y = null, tone = "info", key = message, gap = 900 } = {}) {
    const now = performance.now();
    if (now - (toastThrottle.get(key) ?? -1e9) < gap) return;
    toastThrottle.set(key, now);
    if (x !== null && scene?.floatText) scene.floatText(x, y, message, tone);
    else tactical(message, { tone, key });
  }
  const TACTICAL_MERGE_MS = 1800;
  let tacticalLast = null, tacticalTimer = null;
  function tactical(message, { tone = "warn", key = message, ms = 2200 } = {}) {
    const strip = hudRefs.tactical;
    if (!strip) return;
    const now = performance.now();
    clearTimeout(tacticalTimer);
    if (tacticalLast && tacticalLast.key === key && now - tacticalLast.at < TACTICAL_MERGE_MS && tacticalLast.node.isConnected) {
      tacticalLast.count++; tacticalLast.at = now;
      tacticalLast.node.querySelector(".da-tactical__count").textContent = t("tactical.count", { count: tacticalLast.count });
      if (!reducedMotion) tacticalLast.node.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
    } else {
      // The previous line leaves upward at once; the new one slides in.
      for (const old of strip.querySelectorAll(".da-tactical__line:not(.is-leaving)")) {
        old.classList.add("is-leaving");
        const leave = reducedMotion ? null : old.animate?.([{ opacity: 0.6, transform: "translateY(-4px)" }, { opacity: 0, transform: "translateY(-16px)" }], { duration: 120, easing: "ease-in", fill: "forwards" });
        if (leave) leave.onfinish = () => old.remove(); else old.remove();
      }
      const line = el("div", "da-tactical__line");
      line.dataset.tone = tone;
      line.append(el("span", "da-tactical__mark"), el("span", "da-tactical__text", message), el("span", "da-tactical__count"));
      strip.appendChild(line);
      if (!reducedMotion) line.animate?.([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, delay: 60, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      tacticalLast = { key, count: 1, at: now, node: line };
    }
    tacticalTimer = setTimeout(() => { for (const line of strip.querySelectorAll(".da-tactical__line")) line.remove(); tacticalLast = null; }, ms);
  }
  /** Track two: a flag on the skill's own button (desktop slot and touch disc), plus a shake when refused. */
  function buttonFlag(slot, message, { tone = "warn", shake = false } = {}) {
    const nodes = slot === "ult" ? [hudRefs.ult, ultButton] : slot === "switch" ? [hudRefs.switch, switchButton]
      : slot === "surge" ? [hudRefs.surge, surgeButton] : slot === "ride" ? [hudRefs.ride, rideButton] : [hudRefs.slots?.[slot], skillButtons[slot]];
    for (const node of nodes) {
      // Buttons clip their cooldown pie, so the flag sits on the button's positioned parent, just above it.
      const host = node?.offsetParent;
      if (!node?.isConnected || !host || node.offsetWidth === 0) continue;
      let flag = buttonFlags.get(node);
      if (!flag?.isConnected) { flag = el("span", "da-flag"); flag.setAttribute("aria-hidden", "true"); host.appendChild(flag); buttonFlags.set(node, flag); }
      flag.textContent = message; flag.dataset.tone = tone;
      flag.style.left = `${node.offsetLeft + node.offsetWidth / 2}px`;
      flag.style.top = `${node.offsetTop}px`;
      flag.classList.remove("is-showing"); void flag.offsetWidth; flag.classList.add("is-showing");
      node.classList.toggle("is-boost", tone === "good");
      node.classList.toggle("is-refused", tone !== "good");
      // Timers end the flag, so it still shows (statically) where low quality turns CSS animation off.
      clearTimeout(flagTimers.get(node));
      flagTimers.set(node, setTimeout(() => { node.classList.remove("is-boost", "is-refused"); flag.classList.remove("is-showing"); }, 900));
      if (shake && !reducedMotion) node.animate?.([{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "-3px 0" }, { translate: "0 0" }],
        { duration: 180, easing: "ease-out" });
    }
  }
  const buttonFlags = new WeakMap(), flagTimers = new WeakMap();
  function flashTp() {
    const bar = hudRefs.energy;
    if (!bar) return;
    bar.classList.remove("is-short"); void bar.offsetWidth; bar.classList.add("is-short");
    clearTimeout(tpFlashTimer); tpFlashTimer = setTimeout(() => bar.classList.remove("is-short"), 360);
  }
  let tpFlashTimer = null;
  let bannerTimer = null;
  let rivalBurstWarned = false;
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
        case 'RELAY_SWITCH': releaseInputs(); buildHud(); audio?.play('capture'); toast(t('relay.switched'), { x: event.x, y: event.y - 70, tone: 'good', key: 'relay-switch' }); break;
        case 'RELAY_TAG_BURST': audio?.play('slam'); break;
        case 'RELAY_PERFECT_SWITCH': audio?.play('perfect'); toast(t('relay.perfectSwitch'), { x: event.x, y: event.y - 84, tone: 'crit', key: 'perfect-switch', gap: 400 }); break;
        case 'TRI_LINK_RUSH': audio?.play('roar'); banner(t('relay.triLink'), 'good', 1800); break;
        case 'SUPER_CORE_WARNING': audio?.play('warn'); tactical(t('arena.SUPER_CORE.warn'), { tone: 'warn', ms: 2400 }); break;
        case 'SUPER_CORE_ACTIVE': audio?.play('level'); tactical(t('arena.SUPER_CORE.active'), { tone: 'good', ms: 2400 }); break;
        case 'RIVAL_KO': audio?.play('kill'); break;
        case 'RELAY_INTRO': banner(t('relay.ready'), 'phase', 2000); break;
        case 'RELAY_RIVAL': audio?.play('warn'); tactical(t('relay.rival'), { tone: 'warn', key: 'relay-rival' }); break;
        // Awakening raising (2026-11-02): a full gauge waits for the player's call.
        case 'BURST_READY': if (event.side === 'player') { audio?.play('pickup'); tactical(t('relay.burst.readyCall'), { tone: 'good', key: 'burst-ready' }); } break;
        // Burst evolution (2026-11-02): the call-out names the form.
        case 'BURST': audio?.play(event.side === 'player' ? 'pickup' : 'warn'); if (event.side === 'player' && gameMode === 'RELAY') { releaseInputs(); buildHud(); }
          banner(t(`relay.burst.${event.side}`, { name: speciesName(event.form) }), event.side === 'player' ? 'good' : 'warn', 1600); break;
        // The form's kit leaves with it.
        case 'BURST_END': if (event.side === 'player' && gameMode === 'RELAY') { releaseInputs(); buildHud(); } break;
        // Stage three arena zones and cover (2026-10-28).
        case 'ARENA_WARNING': audio?.play('warn'); tactical(t(`arena.${event.kind}.warn`), { tone: 'warn', ms: 2400 }); break;
        case 'ARENA_ACTIVE': tactical(t(`arena.${event.kind}.active`), { tone: 'good' }); break;
        case 'ARENA_CLAIM':
          audio?.play('pickup');
          // A cooldown cut belongs on the buttons it shortens, not beside the partner.
          if (event.kind === 'ECHO' && event.team === 0) { for (const slot of [0, 1, 2]) buttonFlag(slot, t('fct.cooldown', { amount: event.amount }), { tone: 'good' }); break; }
          toast(t(`arena.${event.kind}.claim`, { amount: event.amount }), { x: event.x, y: event.y - 60, tone: event.team === 0 ? 'good' : 'warn', key: `arena-claim-${event.team}` }); break;
        case 'EFFECTIVE': toast(t(`fct.${event.mult > 1 ? 'effective' : 'resisted'}.${event.target}`), { x: event.x, y: event.y - 64,
          tone: event.mult > 1 ? 'crit' : 'info', key: `effective-${event.target}-${event.mult > 1}`, gap: 700 }); break;
        case 'ARENA_PRESSURE': tactical(t('arena.VENT.pressure'), { tone: 'warn', key: 'arena-pressure' }); break;
        case 'PROP_DESTROYED': if (gameMode === 'RELAY') tactical(t('arena.coverBroken'), { tone: 'warn', key: 'cover-broken' }); break;
        case 'RELAY_END': releaseInputs(); break;
        case "LASER_HIT": audio?.play("hit"); break;
        case "ENEMY_KILLED": audio?.play("kill"); break;
        case "PLAYER_HIT": audio?.play("hurt"); flashVignette(); break;
        case "DASH": audio?.play("dash"); break;
        case "PERFECT_DODGE": audio?.play("perfect"); toast(t("fct.perfect"), { x: event.x, y: event.y - 64, tone: "dodge", key: "perfect", gap: 600 }); break;
        case "ELEMENT_CHAIN": tactical(t(`toast.chain.${event.kind}`), { tone: "chain", key: `chain-${event.kind}` }); break;
        case "FIRE_IGNITE": if (event.source !== "SPREAD") audio?.play("ignite"); break;
        case "FIRE_OUT": audio?.play("splash"); break;
        case "ICE_FORM": if (event.source === "POD") audio?.play("burst"); break;
        case "ICE_CRACK_WARN": {
          audio?.play("crack");
          const state = sim.getState();
          if (Math.hypot(state.player.x - event.x, state.player.y - event.y) < 260) tactical(t("toast.iceWarn"), { tone: "warn", key: "ice" });
          break;
        }
        case "FELL_IN_WATER": audio?.play("splash"); toast(t("toast.fall"), { x: event.x, y: event.y - 60, tone: "warn", key: "fall", gap: 1500 }); break;
        case "RECOVERED": audio?.play("ui"); break;
        case "SURGE": audio?.play("surge"); break;
        case "SURGE_REFUSED": if (event.reason === "COOLDOWN") buttonFlag("surge", t("btn.cooling"), { shake: true }); break;
        case "RIDE_REFUSED": buttonFlag("ride", t("btn.far"), { shake: true }); break;
        case "MOUNTED": audio?.play("ui"); break;
        case "DISMOUNT": if (event.mode === "THROWN") { const p = sim.getState().player; toast(t("toast.thrown"), { x: p.x, y: p.y - 70, tone: "warn" }); } break;
        case "POD_BURST": audio?.play("burst"); break;
        case "SHARD_BLOCK": audio?.play("block"); break;
        case "OVERHEAT": audio?.play("overheat"); toast(t("toast.overheat"), { x: sim.getState().player.x, y: sim.getState().player.y - 70, tone: "warn", key: "overheat", gap: 1500 }); break;
        case "MATE_DOWN": tactical(t("toast.mateDown"), { tone: "warn", key: "mate-down" }); break;
        case "MATE_REVIVED": if (event.rescued) { audio?.play("capture"); toast(t("toast.rescue"), { x: event.x, y: event.y - 60, tone: "good" }); } break;
        case "CORE_OUT": audio?.play("capture"); toast(t("toast.core"), { x: event.x, y: event.y - 40, tone: "good" }); break;
        case "BEACON_CAPTURED": audio?.play("capture"); toast(t("toast.beacon"), { x: event.x, y: event.y - 40, tone: "good" }); break;
        case "BEACON_PROGRESS": audio?.play("pickup"); break;
        case "BOSS_SHIELD_DOWN": tactical(t("toast.shieldDown"), { tone: "good" }); break;
        case "LEVEL_UP": audio?.play("level"); break;
        case "PICKUP": audio?.play("pickup"); break;
        case "CHEER": audio?.play("cheer"); tactical(t("hud.cheer"), { tone: "good", key: "cheer" }); break;
        case "CROWD": if (event.source !== "BOSS_DOWN") audio?.play("cheer"); break;
        case "PHASE_WARNING":
          if (gameMode === "TOURNAMENT") break;
          audio?.play("warn");
          tactical(t(`warn.${event.id}`, { name: cast.boss.name }), { tone: "warn", ms: Math.max(2000, event.inSeconds * 1000) });
          break;
        case "PHASE":
          if (event.id !== "WARMUP") tactical(t(`phase.${event.id}`), { tone: event.id === "GUARDIAN" ? "boss" : "phase" });
          if (event.id === "GUARDIAN") music?.setScene(selectDataArenaMusic(gameMode === "RELAY" ? "TOURNAMENT" : gameMode), `arena:${matchId}`);
          break;
        case "BRIDGE_LIFTED": tactical(t("toast.bridge"), { tone: "warn", key: "bridge" }); break;
        case "BOSS_SPAWN": audio?.play("roar"); break;
        case "BOSS_ENRAGE": audio?.play("roar"); tactical(t("toast.bossEnrage"), { tone: "boss" }); break;
        case "SLAM": audio?.play("slam"); break;
        case "WALL_SLAM": audio?.play("slam"); toast(t(event.target === "rival" ? "fct.wallSlamRival" : "fct.wallSlam"), { x: event.x, y: event.y - 60, tone: event.target === "rival" ? "crit" : "warn", key: `slam-${event.target}`, gap: 800 }); break;
        case "BOSS_DOWN": audio?.play("burst"); break;
        case "PLAYER_RESPAWN": tactical(t("toast.respawn"), { tone: "good" }); break;
        case "ROUND_INTRO": {
          const final = event.round === event.rounds - 1;
          audio?.play("warn");
          banner(t(final ? "round.final" : "round.intro", { round: event.round + 1, name: rivalName(event.rivalId) }), final ? "boss" : "phase", DATA_ARENA_TOURNAMENT.introSeconds * 1000 - 300);
          music?.setScene(selectDataArenaMusic(gameMode === "RELAY" ? "TOURNAMENT" : gameMode), `arena:${matchId}`);
          break;
        }
        case "ROUND_START": audio?.play("roar"); banner(t("round.fight"), "good", 900); break;
        case "ROUND_WON": audio?.play("capture"); banner(t(event.reason === "TIME" ? "round.wonTime" : "round.won"), "good", 2000); break;
        case "ROUND_LOST": audio?.play("slam"); banner(t(event.reason === "TIME" ? "round.lostTime" : "round.lost"), "boss", 2000); break;
        case "CAST_REFUSED": {
          const slot = Number.isInteger(event.slot) ? event.slot : "ult";
          if (event.reason === "ENERGY") { buttonFlag(slot, t("btn.noTp"), { shake: true }); flashTp(); }
          else if (event.reason === "COOLDOWN") buttonFlag(slot, t("btn.cooling"), { shake: true });
          else if (event.reason === "ULT_NOT_READY") { buttonFlag("ult", t(gameMode === "RELAY" ? "btn.noTp" : "btn.charging"), { shake: true }); if (gameMode === "RELAY") flashTp(); }
          break;
        }
        case "ULT_READY": audio?.play("level"); buttonFlag("ult", t("btn.ready"), { tone: "good" }); break;
        case "CAST_RELEASE": if (event.team === "player") audio?.play(gameMode === 'RELAY' ? relayEffectStyle(event.moveId, relayPartner(sim.getState().player.formPartnerId ?? sim.getState().player.partnerId)?.element).cue : event.moveType === 'LUNGE' ? 'dash' : 'burst'); break;
        case "ULT_CAST": audio?.play("roar"); ultCutIn(event); break;
        case "NOVA": case "ZONE_BURST": audio?.play("burst"); break;
        case "CANCEL": if (event.rule === "BARRIER_BLOCKS_SHOT") { audio?.play("block"); toast(t("fct.blocked"), { x: event.x, y: event.y - 40, tone: "good", key: "blocked", gap: 1200 }); } break;
        case "RIVAL_HIT": case "SKILL_HIT": audio?.play("hit"); break;
        case "RIVAL_DODGE": toast(t("fct.dodge"), { x: event.x, y: event.y - 64, tone: "dodge", key: "rival-dodge", gap: 450 }); break;
        case "OFFER": showLevelUp(event.options); break;
        case "RESULT": showResult(); break;
        default: break;
      }
    }
  }
  function ultCutIn(event) {
    if (!cutIn || !sim) return;
    const state = sim.getState();
    const mine = event.team === "player";
    // Rival casters are matched by id, else by position; the cast names them
    // by their definition id.
    const rival = mine ? null : state.rivals.find((r) => r.id === event.casterId) ?? state.rivals.filter((r) => r.hp > 0)
      .sort((a, b) => Math.hypot(a.x - event.x, a.y - event.y) - Math.hypot(b.x - event.x, b.y - event.y))[0];
    const activeBurstForm = mine ? state.relay?.team?.[state.relay.active]?.burst : state.relay?.rivalBurst;
    const speciesId = activeBurstForm?.phase === "BURST" && activeBurstForm.form
      ? `species-${String(activeBurstForm.form).padStart(3, "0")}`
      : (mine ? state.player.speciesId : rival?.speciesId);
    const focus = scene?.worldToScreen(event.x, event.y - 30);
    const element = speciesTaxonomyForId(speciesId)?.element ?? (mine ? partnerElement(state.player.partnerId) : null);
    const casterName = activeBurstForm?.phase === "BURST" && activeBurstForm.form
      ? speciesName(activeBurstForm.form)
      : (mine ? cast.partners.find((p) => p.speciesId === speciesId)?.name ?? "" : rivalName(rival?.definitionId ?? rival?.id));
    cutIn.play({ team: mine ? "ally" : "enemy", portrait: juicyPortrait(speciesId), moveName: moveName(event.moveId),
      casterName, palette: element ?? (mine ? "light" : "dark"), focus });
  }
  let vignetteTimer = null;
  function flashVignette() {
    hudRefs.vignette?.classList.add("is-hit");
    clearTimeout(vignetteTimer);
    vignetteTimer = setTimeout(() => hudRefs.vignette?.classList.remove("is-hit"), 180);
  }

  // ------------------------------------------------------------------ loop
  const frameCost = [];
  let frameFault = null;
  // The ticker is the product's shared one: an exception thrown from a listener
  // would stop its loop for everything. Contain it, report it once, keep going.
  function frame(ticker) {
    try { frameBody(ticker); }
    catch (error) {
      if (!frameFault) { frameFault = error; console.error("DATA_ARENA_FRAME_FAULT", error); }
    }
  }
  function frameBody(ticker) {
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
    if(qa&&events.length){qaRecentEvents.push(...events.map(e=>({...e,matchId})));if(qaRecentEvents.length>128)qaRecentEvents.splice(0,qaRecentEvents.length-128);}
    if (events.length) handleEvents(events);
    const state = sim.getState();
    audio?.setLaser(state.laser.firing && root.dataset.state === "PLAY" && !paused, state.laser.heat / sim.stats.heatCapacity);
    scene.setAimGuide?.(touchActive && root.dataset.state === "PLAY" ? aimGuide() : null);
    scene.render(dtMs, paused || document.hidden);
    if (root.dataset.state !== "SELECT") updateHud();
    frameCost.push(performance.now() - started);
    if (frameCost.length > 240) frameCost.shift();
  }

  // ------------------------------------------------------------------ assets
  async function loadCast(selectedPartnerId, owner) {
    owner.signal.throwIfAborted();
    const partner = cast.partners.find((p) => p.partnerId === selectedPartnerId);
    // A relay fighter's burst form (and each rival's) is drawn mid-match, so its art loads up front.
    const relayTeam = gameMode === 'RELAY' ? relayTeamIds(selectedPartnerId, relayReserveId, relayThirdId) : [];
    const rivalCast = campaignCast ? campaignCast.filter(Boolean) : cast.rivals.slice(0, 3);
    const rivalForms = gameMode === 'RELAY' ? rivalCast.map(r => { const form = burstFormsFor(Number(String(r.speciesId).split('-').at(-1))).find(f => f.tier === 1)?.form;
      return form === undefined ? null : cast.partners.find(m => m.speciesId === `species-${String(form).padStart(3, '0')}`) ?? null; }) : [];
    const candidates = (gameMode === 'RELAY' ? [...cast.partners.filter(p => relayTeam.includes(p.partnerId)), ...relayTeam.flatMap(relayBurstMembers), ...rivalCast, ...rivalForms] : gameMode === "TOURNAMENT" ? [partner, ...cast.rivals] : [partner, cast.mate, cast.boss]).filter((member) => member?.art);
    // A relay partner or burst form can also be a rival. Deduplicate before
    // starting parallel loads so one species always has one owning bundle.
    const wanted = [...new Map(candidates.map(member => [member.speciesId, member])).values()];
    bundleScope ??= createPixiAssetScope(stage.PIXI, href, { signal });
    let failed = false;
    // Release a partner no longer on the field.
    for (const [speciesId, bundle] of bundles) {
      if (!wanted.some((member) => member.speciesId === speciesId)) {
        bundles.delete(speciesId);
        await owner.wait(releaseArenaResource(bundle));
        owner.signal.throwIfAborted();
      }
    }
    await Promise.all(wanted.filter((member) => !bundles.has(member.speciesId)).map(async (member) => {
      try {
        const bundle = await owner.own(loadDataArenaCharacter({PIXI:bundleScope,art:member.art,signal:owner.signal}));
        owner.signal.throwIfAborted();
        bundles.set(member.speciesId, bundle);
        owner.transfer(bundle);
      } catch (error) {
        owner.signal.throwIfAborted();
        failed = true;
        if (!signal.aborted) console.warn("DATA_ARENA_ART_FALLBACK", member.speciesId, error?.message);
      }
    }));
    return !failed;
  }

  function mountScene() {
    scene?.dispose();
    scene = mountDataArenaScene({ stage, sim, cast, bundles, quality, reducedMotion, shake, partnerId, environment, interactionArt, effectArt });
    root.dataset.quality = quality;
    stage.setResolutionCap(quality === "low" ? 1 : Math.min(2, resolutionCap));
  }

  let startingMatch = false;
  let matchLoad = null;
  // Original remade effect cells (VFX_FIVE_LAYER_20261101), loaded once per screen and kept across matches.
  let effectArt = null;
  const arenaDisposals = new WeakMap();
  // Release display objects synchronously, then let their asynchronous asset
  // cleanup finish independently. Recovery must not wait on a stuck unload.
  function releaseArenaResource(resource) {
    if (!resource) return Promise.resolve();
    if (arenaDisposals.has(resource)) return arenaDisposals.get(resource);
    let pending;
    try { pending = Promise.resolve(resource.dispose?.()); }
    catch (error) { pending = Promise.reject(error); }
    const settled = pending.catch(error => console.error("DATA_ARENA_CLEANUP_FAILED", error));
    arenaDisposals.set(resource, settled);
    return settled;
  }
  function releaseMatch({ keepCast = false, keepEffects = false, keepAudio = false } = {}) {
    const clean = action => { try { action(); } catch (error) { console.error("DATA_ARENA_CLEANUP_FAILED", error); } };
    clean(() => { if (tickerCallback && stage) stage.app.ticker.remove(tickerCallback); });
    tickerCallback = null;
    const resources = [scene, environment, interactionArt];
    scene = null; environment = null; interactionArt = null;
    if (!keepAudio) { resources.push(audio); audio = null; }
    if (!keepEffects) { resources.push(effectArt); effectArt = null; }
    if (!keepCast) { resources.push(...bundles.values()); bundles.clear(); bundleScope = null; }
    sim = null; result = null; paused = false; accumulator = 0; qaRecentEvents.length = 0;
    clearTimeout(bannerTimer); clearTimeout(vignetteTimer);
    clean(releaseInputs);
    clean(() => stage?.setResolutionCap(resolutionCap));
    return Promise.all(resources.map(releaseArenaResource));
  }
  function cancelMatchLoad() {
    const owner = matchLoad;
    if (!owner || signal.aborted) return;
    // Retire the attempt before aborting it. A retry can start immediately;
    // the old catch/finally must not clear that retry's state or resources.
    matchLoad = null; startingMatch = false;
    owner.cancel();
    void releaseMatch();
    showSelect();
  }
  async function optionalMatchArt(owner, pending, warning) {
    try { return await owner.own(pending); }
    catch (error) {
      owner.signal.throwIfAborted();
      console.warn(warning, error?.message);
      return null;
    }
  }
  async function startMatch() {
    if (startingMatch || qualityReloading || signal.aborted) return;
    startingMatch = true;
    const owner = matchLoad = createLoadAttempt({ timeoutMs: LOAD_MAX_MS });
    const abort = () => owner.cancel(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      await startMatchBody(owner);
    } catch (error) {
      if (matchLoad !== owner || signal.aborted) return;
      // A failed asynchronous start must not strand the player in LOADING.
      // Report the original failure, but keep cleanup failures from hiding it.
      console.error("DATA_ARENA_START_FAILED", error);
      owner.cancel(error);
      void releaseMatch();
      root.dataset.state = "ERROR";
      const panel = el("div", "da-panel");
      const notice = el("p", "da-note", t(error?.message === "LOAD_TIMEOUT" ? "loading.timeout" : "loading.error"));
      notice.setAttribute("role", "status");
      panel.append(el("h2", "da-title", t("mode.title")), notice);
      const retry = button("da-btn da-btn--primary", t("result.retry"), () => void startMatch(), signal);
      retry.dataset.autofocus = "1";
      const actions = el("div", "da-actions");
      actions.append(retry, button("da-btn", t("select.back"), () => close(), signal));
      panel.appendChild(actions);
      showOverlay(panel);
    } finally {
      signal.removeEventListener("abort", abort);
      owner.stopTimer();
      if (matchLoad === owner) { matchLoad = null; startingMatch = false; }
    }
  }

  async function startMatchBody(owner) {
    root.dataset.state = "LOADING";
    const panel = el("div", "da-panel da-panel--loading");
    const notice = el("p", "da-note", t("loading"));
    notice.setAttribute("role", "status");
    const cancel = button("da-btn da-btn--primary", t("loading.cancel"), cancelMatchLoad, signal);
    cancel.dataset.autofocus = "1";
    const actions = el("div", "da-actions");
    actions.append(cancel, button("da-btn", t("select.back"), () => close(), signal));
    panel.append(notice, actions);
    showOverlay(panel);
    // The stage belongs to the application, not this attempt. Its existing
    // signal gate prevents a late init from reattaching over another screen.
    stage ??= await owner.wait(ensureStage(field, owner.signal));
    owner.signal.throwIfAborted();
    // Drop the previous match's scene BEFORE loadCast releases bundles it may
    // still draw from (mode or partner change from the result screen).
    await owner.wait(releaseMatch({ keepCast: true, keepEffects: true, keepAudio: true }));
    const ok = await owner.wait(loadCast(partnerId, owner));
    owner.signal.throwIfAborted();
    matchId++;
    const matchSeed = seed ?? ((Date.now() ^ (matchId * 2654435761)) >>> 0);
    const relayBurstPlans = gameMode === "RELAY" ? Object.fromEntries(relayTeamIds(partnerId, relayReserveId, relayThirdId).map(id => [id, relayBurstPlanOf(id)]).filter(([, plan]) => plan !== undefined)) : {};
    // A Journey zone stage carries no contract: it pays its own stars and prizes.
    // A sponsor contract armed in the battle menu takes its stake as a tournament or relay starts (AWAKENING_OVERDRIVE_20261109).
    const makeSim = (rivalBoostPercent) => createDataArenaSimulation({ seed: matchSeed, partnerId, quality, mode: gameMode, partnerPower, rivalBoostPercent,
      ...(gameMode==="RELAY"?{relayLoadouts,relayReserveId,relayThirdId,relayArenaId,portrait:globalThis.innerHeight>globalThis.innerWidth,
      relayBurstPlans, relayManualBurst: true, relayRivals: campaign?.rivals ?? null, relayBuffPicks: Boolean(campaign)}:{}) });
    sim = makeSim(0);
    staked = null;
    // A Journey zone stage carries no contract: it pays its own stars and prizes.
    if (!campaign && (gameMode === "RELAY" || gameMode === "TOURNAMENT") && sponsor?.begin) {
      // Arena rivals are a fixed bracket built tougher than any seat, so the sponsor keeps plain odds here; the stake
      // cap and the daily limit still hold (Owner 2026-11-10).
      staked = sponsor.begin({});
      if (staked?.ok && staked.foeBoostPercent > 0) sim = makeSim(staked.foeBoostPercent);
    }
    // Harbor art is loaded on entry only; a failed pack keeps the playable
    // geometry and existing presentation available. No character texture changes.
    if (gameMode === 'HARBOR' || gameMode === 'TOURNAMENT' || gameMode === 'RELAY') {
      const next = await optionalMatchArt(owner, loadDataArenaEnvironment({ PIXI: stage.PIXI, renderer:stage.app.renderer, map: sim.grid.map, quality, href, signal:owner.signal }), "DATA_ARENA_ENVIRONMENT_FALLBACK");
      owner.signal.throwIfAborted(); environment = next; owner.transfer(next);
    }
    const nextInteraction = await optionalMatchArt(owner, loadDataArenaInteractionArt({PIXI:stage.PIXI,map:sim.grid.map,quality,href,signal:owner.signal}), "DATA_ARENA_INTERACTION_ART_FALLBACK");
    owner.signal.throwIfAborted(); interactionArt = nextInteraction; owner.transfer(nextInteraction);
    // Controlled harnesses load this screen without its imports: no original cells there.
    if (!effectArt && typeof loadOriginalVfxCellArt === "function") {
      const next = await optionalMatchArt(owner, loadOriginalVfxCellArt({
        PIXI: createPixiAssetScope(stage.PIXI, href, { signal: owner.signal }), href, fetchImpl: owner.fetch
      }), "DATA_ARENA_ORIGINAL_VFX_FALLBACK");
      owner.signal.throwIfAborted(); effectArt = next; owner.transfer(next);
    }
    owner.signal.throwIfAborted();
    root.dataset.seed = String(matchSeed);
    root.dataset.mode = gameMode;
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
    music?.setScene(selectDataArenaMusic(gameMode), `arena:${matchId}`);
    if (!ok) tactical(t("loading.failed"), { tone: "warn", key: "art" });
    if (gameMode === "HARBOR") banner(t("phase.WARMUP"), "phase", 2200);
    else handleEvents(sim.drainEvents()); // the first ROUND_INTRO was queued at construction
    field.focus?.({ preventScroll: true });
  }

  // ------------------------------------------------------------------ overlays
  function showOverlay(panel) {
    overlay.replaceChildren(panel);
    overlay.hidden = false;
    if (!reducedMotion && quality !== 'low') panel.animate?.(
      [{opacity:0, transform:'translateY(8px)'}, {opacity:1, transform:'translateY(0)'}],
      {duration:180, easing:'cubic-bezier(.2,.8,.2,1)'});
    const first = panel.querySelector("[data-autofocus]") ?? panel.querySelector("button");
    first?.focus({ preventScroll: true });
  }
  function hideOverlay() { overlay.hidden = true; overlay.replaceChildren(); }

  // Select (Owner 2026-11-02): a fixed armour head, a scrolling body (mode
  // cartridges, one intel line, the squad dock with its seat cards and skill
  // chips, the partner list) and a fixed action bar. No native <select>: the
  // roster drawer and the chip rows are buttons, so phones never open the system wheel.
  const partnerName = (id) => cast.partners.find((p) => p.partnerId === id)?.name ?? "";
  const partnerArt = (id) => cast.partners.find((p) => p.partnerId === id)?.art ?? null;
  const usableIds = (mode) => entriesFor(mode).filter(dataArenaEntryUsable).map((row) => row.id);
  const stageOf = (id) => relayPartner(id)?.generationIndex ?? 3;
  function portrait(id, className = "da-partner__art") {
    const art = partnerArt(id);
    if (!art) return el("span", `${className} da-partner__art--fallback`);
    const img = el("img", className);
    img.alt = ""; img.decoding = "async"; img.loading = "lazy";
    img.addEventListener("error", () => img.replaceWith(el("span", `${className} da-partner__art--fallback`)), { once: true, signal });
    img.src = art.portraitUrl;
    return img;
  }
  function entryTag(entry) {
    const tag = el("span", "da-entry", t(`entry.${entry}`));
    tag.dataset.entry = entry;
    return tag;
  }
  /** Keep the chosen partners inside the mode's entry list; the relay trio stays three different partners. */
  function settleTeam() {
    const rows = entriesFor(gameMode).filter(dataArenaEntryUsable);
    const preferred = [
      ...rows.filter((row) => row.entry !== "RENTAL").map((row) => row.id),
      ...rows.filter((row) => row.entry === "RENTAL").map((row) => row.id)
    ];
    const open = rows.map((row) => row.id);
    if (!open.includes(partnerId) || (gameMode === "RELAY" && !relayReserveId && entryOf(gameMode, partnerId)?.entry === "RENTAL" && preferred[0])) {
      partnerId = preferred[0] ?? open[0];
    }
    if (gameMode === "RELAY") {
      if (!open.includes(relayReserveId) || relayReserveId === partnerId) {
        relayReserveId = preferred.find((id) => id !== partnerId) ?? null;
      }
      if (!open.includes(relayThirdId) || relayThirdId === partnerId || relayThirdId === relayReserveId) {
        relayThirdId = preferred.find((id) => id !== partnerId && id !== relayReserveId) ?? null;
      }
    }
    if (!RELAY_MAP_IDS.includes(relayArenaId)) relayArenaId = RELAY_MAP_IDS[0];
  }
  const teamIds = () => gameMode === "RELAY" ? [partnerId, relayReserveId, relayThirdId].filter(Boolean) : [partnerId];
  const RELAY_LIST_SIZE = 12;

  function showSelect() {
    root.dataset.state = "SELECT";
    const panel = el("div", "da-panel da-panel--select");
    const head = el("header", "da-panel__head");
    const eyebrow = el("p", "da-eyebrow");
    head.append(eyebrow, el("h2", "da-title", campaign ? campaign.title : t("mode.title")));
    // Mode: three cartridges side by side; the picked one names its rules on the intel line below.
    const modes = el("div", "da-modes");
    if (campaign) modes.hidden = true;
    modes.setAttribute("role", "radiogroup");
    modes.setAttribute("aria-label", t("mode.heading"));
    for (const id of MODES) {
      const card = button("da-mode", "", () => { if (gameMode === id) return; gameMode = id; tick(); refresh(); }, signal);
      card.setAttribute("role", "radio");
      card.dataset.mode = id;
      card.title = t(`mode.${id}.desc`);
      card.append(glyph(MODE_GLYPHS[id], "da-mode__glyph"), el("strong", "da-mode__name", t(`mode.${id}`)), el("span", "da-mode__desc", t(`mode.${id}.short`)));
      modes.appendChild(card);
    }
    const intel = el("p", "da-intel");
    intel.setAttribute("aria-live", "polite");
    const maps = el("div", "da-maps");
    if (campaign) maps.hidden = true;
    maps.setAttribute("role", "radiogroup");
    maps.setAttribute("aria-label", t("relay.map"));
    RELAY_MAP_IDS.forEach((id, index) => {
      const chip = button("da-chip-btn da-map", t(`relay.map.${index + 1}`), () => { relayArenaId = id; refresh(); }, signal);
      chip.setAttribute("role", "radio");
      chip.dataset.map = id;
      maps.appendChild(chip);
    });
    // Squad dock: the seats, the lit resonance and the swap control.
    const dock = el("section", "da-dock");
    dock.setAttribute("aria-label", t("seat.heading"));
    const list = el("div", "da-partners");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", t("select.heading"));
    const listHead = el("div", "da-listhead");
    const kitPreview = el("div", "da-kitview");
    const note = el("p", "da-note"), best = el("p", "da-note"), goal = el('p', 'da-next-goal');
    const summary = el("div", "da-summary");
    summary.append(note, best, goal);
    let openChips = null; // `${partnerId}:${slot}` of the skill slot showing its choices
    let fillSeat = 0;     // relay list taps fill the first seat, then the second

    function seatCard(id, seat) {
      const row = entryOf(gameMode, id);
      const card = el("article", "da-seat");
      card.dataset.seat = seat;
      card.dataset.partner = id ?? "";
      const label = el("span", "da-seat__label", t(`seat.${seat}`));
      if (!id) { card.classList.add("is-empty"); card.append(label, el("p", "da-note", t("seat.empty"))); return card; }
      const taxonomy = speciesTaxonomyForId(cast.partners.find((p) => p.partnerId === id)?.speciesId);
      const art = el("div", "da-seat__art");
      art.append(portrait(id, "da-seat__img"));
      const body = el("div", "da-seat__body");
      const title = el("div", "da-seat__title");
      title.append(el("span", "da-seat__stage", t(`relay.stage.${stageOf(id)}`)), el("strong", "da-seat__name", partnerName(id)));
      if (row) title.appendChild(entryTag(row.entry));
      const tags = el("div", "da-taxonomy");
      tags.append(taxonomyBadgeRow(taxonomy), elementChartButton(taxonomy?.element ?? null));
      body.append(label, title);
      if (gameMode === "HARBOR" && relayPartner(id)?.canSwim) tags.appendChild(el("span", "da-entry da-entry--swim", t("harbor.swim")));
      const seatIdx = seat === "third" ? 2 : seat === "reserve" ? 1 : 0;
      const change = button("da-seat__change", t("seat.change"), () => openDrawer(seatIdx), signal);
      change.setAttribute("aria-label", `${t("seat.change")}：${t(`seat.${seat}`)}`);
      // Badges, the matchup and the skill chips run the card's full width under the portrait row.
      card.append(art, body, change, tags);
      const matchup = taxonomy ? elementMatchup(taxonomy.element) : null;
      if (matchup) card.append(el("p", "da-matchup", taxonomyText("chart.focus", { element: taxonomyText(`element.${taxonomy.element}`),
        beats: taxonomyText(`element.${matchup.beats}`), beatenBy: taxonomyText(`element.${matchup.beatenBy}`) })));
      if (gameMode === "RELAY") card.appendChild(skillChips(id));
      return card;
    }
    /** TP cost and cooldown as two short tokens that never wrap mid-value. */
    function cost(move) {
      const line = el("span", "da-skill__cost");
      line.append(el("span", "", `${move.energy} TP`), ...(move.cooldown ? [el("span", "", `${move.cooldown}s`)] : []));
      return line;
    }
    /** Relay loadout: three tappable skill slots and the power move; a slot opens its choices as chips. */
    function skillChips(id) {
      const selected = relayKit(id, relayLoadouts[id]);
      const wrap = el("div", "da-chips");
      const slots = el("div", "da-chips__slots");
      selected.moves.forEach((moveId, slot) => {
        const move = relayMove(moveId);
        const chip = button("da-skill", "", () => { openChips = openChips === `${id}:${slot}` ? null : `${id}:${slot}`; refresh(); }, signal);
        chip.dataset.element = relayMoveElement(moveId, partnerElement(id));
        chip.dataset.slot = String(slot);
        chip.setAttribute("aria-expanded", String(openChips === `${id}:${slot}`));
        chip.setAttribute("aria-label", `${partnerName(id)} ${kitKey(true, slot)} ${moveName(moveId)}`);
        chip.append(el("span", "da-skill__key", kitKey(touchActive, slot)), el("strong", "da-skill__name", moveName(moveId)), cost(move));
        slots.appendChild(chip);
      });
      const ult = el("div", "da-skill da-skill--ult");
      ult.append(el("span", "da-skill__key", kitKey(touchActive, "ult")), el("strong", "da-skill__name", moveName(selected.ultimate)), cost({ energy: DATA_ARENA_RELAY.ultimateTp }));
      slots.appendChild(ult);
      wrap.appendChild(slots);
      const [openId, openSlot] = (openChips ?? "").split(":");
      if (openId === id) {
        const slot = Number(openSlot);
        const choices = el("div", "da-chips__choices");
        choices.setAttribute("role", "listbox");
        choices.setAttribute("aria-label", `${partnerName(id)} ${kitKey(true, slot)}`);
        for (const moveId of RELAY_LOADOUTS[id]) {
          const move = relayMove(moveId);
          const at = selected.moves.indexOf(moveId);
          const choice = button("da-skill da-skill--choice", "", () => {
            const moves = [...selected.moves], other = moves.indexOf(moveId);
            if (other >= 0) moves[other] = moves[slot];
            moves[slot] = moveId;
            relayLoadouts[id] = relayKit(id, moves).moves; records.setRelayLoadout(id, relayLoadouts[id]);
            openChips = null; tick(); refresh();
          }, signal);
          choice.setAttribute("role", "option");
          choice.setAttribute("aria-selected", String(at === slot));
          choice.dataset.element = relayMoveElement(moveId, partnerElement(id));
          choice.dataset.move = moveId;
          choice.append(el("strong", "da-skill__name", moveName(moveId)), cost(move),
            el("span", "da-skill__effect", moveEffect(moveId)), ...(at >= 0 && at !== slot ? [el("span", "da-skill__key", kitKey(touchActive, at))] : []));
          choices.appendChild(choice);
        }
        wrap.appendChild(choices);
      }
      return wrap;
    }
    function partnerCard(row) {
      const id = row.id, partner = DATA_ARENA_PARTNERS.find((p) => p.id === id) ?? relayPartner(id);
      const usable = dataArenaEntryUsable(row);
      const card = button("da-partner", "", () => pickFromList(row), signal);
      card.setAttribute("role", "radio");
      card.dataset.partner = id;
      card.dataset.entry = row.entry;
      const art = el("span", "da-partner__frame");
      art.append(portrait(id), el("span", "da-partner__seat"));
      const taxonomy = speciesTaxonomyForId(partner.speciesId);
      const head = el("span", "da-partner__head");
      head.append(el("strong", "da-partner__name", usable ? partnerName(id) : t("entry.unknownName")), entryTag(row.entry));
      card.append(art, head);
      if (!usable) { card.append(el("span", "da-partner__perk", t("entry.lockedHint"))); return card; }
      card.append(taxonomyBadgeRow(taxonomy));
      if (gameMode === "HARBOR" && partner.canSwim) card.append(el("span", "da-entry da-entry--swim", t("harbor.swim")));
      if (partner.perk) card.append(el("span", "da-partner__perk", t(`perk.${partner.perk}`)));
      const stats = el("span", "da-partner__stats");
      const meter = (label, value, max) => { const line = el("span", "da-meter"); line.append(el("span", "", label)); const bar = el("span", "da-meter__bar"); bar.style.setProperty("--v", Math.min(1, value / max).toFixed(2)); line.append(bar); return line; };
      stats.append(meter(t("stat.hp"), partner.hp, 140), meter(t("stat.laser"), partner.laserDps, 60), meter(t("stat.speed"), partner.speed, 280));
      const own = gameMode === "RELAY" ? relayKit(id, relayLoadouts[id]) : DATA_ARENA_KITS[id];
      const pills = el("span", "da-partner__skills");
      pills.setAttribute("aria-hidden", "true");
      pills.append(...(own?.moves ?? []).map((move) => el("span", "da-pill", moveName(move))),
        ...(own?.ultimate ? [el("span", "da-pill da-pill--ult", `${moveName(own.ultimate)}${gameMode === "RELAY" ? ` · ${DATA_ARENA_RELAY.ultimateTp} TP` : ""}`)] : []));
      card.append(stats, pills);
      return card;
    }
    function pickFromList(row) {
      if (!dataArenaEntryUsable(row)) { hint(t("entry.lockedHint")); return; }
      tick();
      if (gameMode !== "RELAY") partnerId = row.id;
      else if (row.id === partnerId) fillSeat = 0;
      else if (row.id === relayReserveId) fillSeat = 1;
      else if (row.id === relayThirdId) fillSeat = 2;
      else {
        if (fillSeat === 0) partnerId = row.id;
        else if (fillSeat === 1) relayReserveId = row.id;
        else relayThirdId = row.id;
        fillSeat = (fillSeat + 1) % 3;
      }
      refresh();
    }
    let hintTimer = null;
    const hintLine = el("p", "da-hint");
    hintLine.setAttribute("role", "status");
    hintLine.hidden = true;
    function hint(message) {
      hintLine.textContent = message; hintLine.hidden = false;
      clearTimeout(hintTimer); hintTimer = setTimeout(() => { hintLine.hidden = true; }, 2600);
    }

    // The roster drawer: portraits on a grid, stage filters, and locked species as silhouettes on request.
    let drawerAll = false, drawerStage = null, drawerSeat = 0;
    const drawer = el("div", "da-drawer");
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", t("drawer.title"));
    function openDrawer(seat) { drawerSeat = seat; drawer.hidden = false; renderDrawer(); drawer.querySelector(".da-drawer__close")?.focus({ preventScroll: true }); }
    function closeDrawer() { drawer.hidden = true; drawer.replaceChildren(); panel.querySelector(".da-seat__change")?.focus({ preventScroll: true }); }
    function renderDrawer() {
      const rows = entriesFor(gameMode);
      const sheet = el("div", "da-drawer__sheet");
      const top = el("header", "da-drawer__head");
      const drawerSeatKey = gameMode === "RELAY" ? (drawerSeat === 2 ? "third" : drawerSeat === 1 ? "reserve" : "first") : gameMode === "HARBOR" ? "first" : "ace";
      const seatName = t(`seat.${drawerSeatKey}`);
      top.append(el("strong", "da-drawer__title", t("drawer.title")), el("span", "da-drawer__seat", t("drawer.forSeat", { seat: seatName })),
        button("da-drawer__close", t("drawer.close"), closeDrawer, signal));
      const filters = el("div", "da-drawer__filters");
      const toggle = el("div", "da-segment");
      for (const all of [false, true]) {
        const option = button("da-chip-btn", t(all ? "drawer.all" : "drawer.unlocked"), () => { drawerAll = all; renderDrawer(); }, signal);
        option.setAttribute("aria-pressed", String(drawerAll === all));
        toggle.appendChild(option);
      }
      const stages = el("div", "da-segment da-segment--stage");
      for (const stage of [null, ...new Set(rows.map((row) => stageOf(row.id)))].sort((a, b) => (a ?? 0) - (b ?? 0))) {
        const option = button("da-chip-btn", stage === null ? t("drawer.stageAll") : t(`relay.stage.${stage}`), () => { drawerStage = stage; renderDrawer(); }, signal);
        option.setAttribute("aria-pressed", String(drawerStage === stage));
        stages.appendChild(option);
      }
      const usable = rows.filter(dataArenaEntryUsable).length;
      filters.append(toggle, stages, el("span", "da-drawer__count", t("drawer.count", { count: usable, total: rows.length })));
      const grid = el("div", "da-drawer__grid");
      for (const row of rows) {
        if (!drawerAll && !dataArenaEntryUsable(row)) continue;
        if (drawerStage !== null && stageOf(row.id) !== drawerStage) continue;
        const open = dataArenaEntryUsable(row);
        const taken = teamIds().indexOf(row.id);
        const cell = button("da-roster", "", () => {
          if (!open) { drawerHint.textContent = t("entry.lockedHint"); drawerHint.hidden = false; return; }
          tick();
          if (gameMode !== "RELAY") partnerId = row.id;
          else if (drawerSeat === 0) {
            if (row.id === relayReserveId) relayReserveId = partnerId;
            else if (row.id === relayThirdId) relayThirdId = partnerId;
            partnerId = row.id;
          } else if (drawerSeat === 1) {
            if (row.id === partnerId) partnerId = relayReserveId;
            else if (row.id === relayThirdId) relayThirdId = relayReserveId;
            relayReserveId = row.id;
          } else {
            if (row.id === partnerId) partnerId = relayThirdId;
            else if (row.id === relayReserveId) relayReserveId = relayThirdId;
            relayThirdId = row.id;
          }
          closeDrawer(); refresh();
        }, signal);
        cell.dataset.partner = row.id;
        cell.dataset.entry = row.entry;
        if (taken >= 0) cell.dataset.seat = taken === 2 ? "third" : taken === 1 ? "reserve" : "first";
        const taxonomy = speciesTaxonomyForId(cast.partners.find((p) => p.partnerId === row.id)?.speciesId);
        const art = el("span", "da-roster__frame");
        art.append(portrait(row.id, "da-roster__art"));
        cell.append(art, el("strong", "da-roster__name", open ? partnerName(row.id) : t("entry.unknownName")), el("span", "da-roster__stage", t(`relay.stage.${stageOf(row.id)}`)));
        if (open) cell.append(taxonomyBadgeRow(taxonomy));
        cell.append(entryTag(row.entry));
        grid.appendChild(cell);
      }
      if (!grid.children.length) grid.appendChild(el("p", "da-note", t("drawer.none")));
      const drawerHint = el("p", "da-hint");
      drawerHint.setAttribute("role", "status");
      drawerHint.hidden = true;
      sheet.append(top, filters, drawerHint, grid);
      drawer.replaceChildren(sheet);
    }
    drawer.addEventListener("click", (event) => { if (event.target === drawer) closeDrawer(); }, { signal });
    drawer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeDrawer(); } }, { signal });

    function refresh() {
      settleTeam();
      root.dataset.mode = gameMode;
      panel.dataset.mode = gameMode;
      music?.setScene(selectDataArenaMusic(gameMode), `arena-select:${gameMode}`);
      eyebrow.textContent = t(`mode.${gameMode}`);
      for (const node of modes.children) node.setAttribute("aria-checked", String(node.dataset.mode === gameMode));
      intel.textContent = t(`intel.${gameMode}`);
      maps.hidden = Boolean(campaign) || gameMode !== "RELAY";
      for (const node of maps.children) node.setAttribute("aria-checked", String(node.dataset.map === relayArenaId));
      // The dock: one ace seat in the tournament, the partner plus the fixed harbor mate, or the relay pair.
      const seats = el("div", "da-dock__seats");
      if (gameMode === "TOURNAMENT") seats.append(seatCard(partnerId, "ace"));
      else if (gameMode === "HARBOR") {
        const mate = el("article", "da-seat da-seat--mate");
        mate.dataset.seat = "mate";
        const art = el("div", "da-seat__art"); art.appendChild(cast.mate.art ? Object.assign(el("img", "da-seat__img"), { alt: "", src: cast.mate.art.portraitUrl }) : el("span", "da-seat__img da-partner__art--fallback"));
        const body = el("div", "da-seat__body");
        body.append(el("span", "da-seat__label", t("seat.mate")), el("strong", "da-seat__name", cast.mate.name), el("p", "da-matchup", t("seat.mateNote")));
        mate.append(art, body);
        seats.append(seatCard(partnerId, "first"), mate);
      } else {
        seats.append(seatCard(partnerId, "first"), seatCard(relayReserveId, "reserve"), seatCard(relayThirdId, "third"));
        const swap = button("da-dock__swap", t("seat.swap"), () => { [partnerId, relayReserveId, relayThirdId] = [relayReserveId, relayThirdId, partnerId]; tick(); refresh(); }, signal);
        swap.setAttribute("aria-label", t("seat.swapLabel"));
        swap.disabled = !relayReserveId || !relayThirdId;
        seats.insertBefore(swap, seats.children[1]);
      }
      const side = el("div", "da-dock__side");
      if (gameMode === "RELAY") side.append(resonanceStrip(factionResonance(teamIds().map((id) => speciesTaxonomyForId(relayPartner(id)?.speciesId)?.faction))));
      const rental = teamIds().some((id) => entryOf(gameMode, id)?.entry === "RENTAL");
      if (rental) side.append(el("p", "da-rental-note", t("entry.rentalHint")));
      dock.replaceChildren(seats, side);
      // The list: the mode's partners. Relay shows the seated trio and the first
      // usable partners (raised ones lead); the drawer holds the whole roster.
      const team = teamIds();
      const usableRows = entriesFor(gameMode).filter(dataArenaEntryUsable);
      const rows = gameMode !== "RELAY" ? entriesFor(gameMode)
        : [...usableRows.filter((row) => team.includes(row.id)), ...usableRows.filter((row) => !team.includes(row.id)).slice(0, RELAY_LIST_SIZE - team.length)];
      list.replaceChildren(...rows.map(partnerCard));
      for (const node of list.children) {
        const seat = team.indexOf(node.dataset.partner);
        node.setAttribute("aria-checked", String(seat >= 0));
        const seatBadgeKey = seat === 2 ? "seat.badge.third" : seat === 1 ? "seat.badge.reserve" : "seat.badge.first";
        node.querySelector(".da-partner__seat").textContent = seat < 0 ? "" : t(gameMode === "RELAY" ? seatBadgeKey : "seat.badge.ace");
        node.dataset.seat = seat < 0 ? "" : seat === 2 ? "third" : seat === 1 ? "reserve" : "first";
      }
      const fillSeatKey = fillSeat === 2 ? "seat.third" : fillSeat === 1 ? "seat.reserve" : "seat.first";
      listHead.replaceChildren(el("h3", "da-subtitle", t("select.heading")),
        el("span", "da-listhead__note", gameMode === "RELAY" ? t("select.fillHint", { seat: t(fillSeatKey) }) : ""),
        button("da-chip-btn", t("drawer.open", { count: usableRows.length }), () => openDrawer(gameMode === "RELAY" ? fillSeat : 0), signal));
      // The kit list stays for the tournament and harbor kits; relay shows its slots on the seat cards.
      kitPreview.hidden = gameMode === "RELAY";
      if (gameMode !== "RELAY") {
        const kit = DATA_ARENA_KITS[partnerId];
        const rows = [[kitKey(touchActive, "basic"), t(`move.beam.${partnerId}`), t("kit.beam")],
          ...kit.moves.map((id, slot) => [kitKey(touchActive, slot), moveName(id), moveEffect(id)]), [kitKey(touchActive, "ult"), moveName(kit.ultimate), moveEffect(kit.ultimate)]];
        kitPreview.replaceChildren(el("h3", "da-subtitle", t("kit.heading")));
        for (const [key, name, effect] of rows) {
          const row = el("div", "da-kitview__row");
          row.append(el("span", "da-kitview__key", key), el("strong", "", name), el("span", "da-kitview__effect", effect));
          kitPreview.appendChild(row);
        }
      }
      note.textContent = gameMode === "RELAY" ? t("relay.team", { names: team.map(partnerName).join("、") }) : gameMode === "TOURNAMENT" ? t("select.rivals", { names: cast.rivals.map((r) => r.name).join("、") }) : t("select.mate", { name: cast.mate.name });
      const entry = records.get().modes[gameMode] ?? { bestScore: 0, wins: 0, runs: 0 };
      best.textContent = t(gameMode === "TOURNAMENT" ? "select.best.T" : "select.best", { score: entry.bestScore.toLocaleString(), wins: entry.wins, runs: entry.runs });
      goal.textContent = t(entry.runs === 0 ? `goal.first.${gameMode}` : entry.wins === 0 ? `goal.win.${gameMode}` : 'goal.best', {score:entry.bestScore.toLocaleString()});
      start.disabled = gameMode === "RELAY" ? team.length < 3 : !partnerId;
      if (!drawer.hidden) renderDrawer();
    }
    const actions = el("div", "da-actions");
    const start = button("da-btn da-btn--primary", t("select.start"), () => {
      partnerPower = withSyncPower(dataArenaPartnerPower(entriesFor(gameMode)));
      records.setLastPartner(partnerId); if (!campaign) { records.setLastMode(gameMode); if(gameMode==="RELAY")records.setRelayTeam(relayReserveId,relayArenaId,relayThirdId); } audio?.play?.("ui"); showBriefing();
    }, signal);
    start.dataset.autofocus = "1";
    actions.append(start, button("da-btn", t("select.back"), () => close(), signal));
    // The head and the action bar stay put; only the body scrolls, with room
    // under its last card so the bar never covers it.
    const body = el("div", "da-panel__body");
    body.append(modes, intel, maps, dock, hintLine, listHead, list, kitPreview, summary);
    refresh();
    panel.append(head, body, actions, drawer);
    showOverlay(panel);
  }

  function showBriefing() {
    root.dataset.state = "BRIEF";
    const panel = el("div", "da-panel da-panel--brief");
    const duel = gameMode !== "HARBOR";
    panel.append(el("h2", "da-title", t("brief.heading")), el("p", "da-goal", t(gameMode === "RELAY" ? "relay.goal" : duel ? "brief.T.goal" : "brief.goal")));
    const listing = el("ul", "da-controls");
    const lines = gameMode === 'RELAY' && touchActive ? ['brief.touch.move', 'relay.touch.attack', 'relay.touch.buttons'] : duel
      ? (touchActive ? ["brief.T.touch.move", "brief.T.touch.buttons"] : ["brief.T.kb.move", "brief.T.kb.beam", "brief.T.kb.skills", "brief.T.kb.ult", "brief.T.kb.dash", "brief.T.kb.aim", "brief.kb.pause"])
      : (touchActive ? ["brief.touch.move", "brief.touch.aim", "brief.touch.buttons"] : ["brief.kb.move", "brief.kb.aim", "brief.kb.dash", "brief.kb.surge", "brief.kb.ride", "brief.kb.pause"]);
    for (const key of lines) listing.appendChild(el("li", "", t(gameMode === 'RELAY' && key === 'brief.T.kb.beam' ? 'relay.attack' : gameMode === 'RELAY' && key === 'brief.T.kb.ult' ? 'relay.ult' : key)));
    if (gameMode === 'RELAY') listing.appendChild(el('li', '', t(touchActive ? 'relay.touch.controls' : 'relay.controls')));
    const go = button("da-btn da-btn--primary", t("brief.go"), () => { records.markBriefingSeen(); void startMatch(); }, signal);
    go.dataset.autofocus = "1";
    panel.append(listing, el("p", "da-tips", t(gameMode === "RELAY" ? "relay.materials" : duel ? "brief.T.tips" : "brief.tips")), go);
    showOverlay(panel);
  }

  function showLevelUp(options) {
    root.dataset.state = "LEVEL";
    releaseInputs();
    const panel = el("div", "da-panel da-panel--level");
    const tournament = sim.getSnapshot().tournament;
    if (campaign) {
      // A Journey zone stage: its own guards and lead, the next one up after this pick.
      panel.append(el("h2", "da-title", t("bracket.heading")));
      const bracket = el("ol", "da-bracket"), current = sim.getState().relay?.enemyIndex ?? 0;
      campaign.rivals.forEach((rival, index) => {
        const name = campaignCast[index]?.name ?? "";
        const item = el("li", `da-bracket__step${index < current ? " is-done" : ""}${index === current ? " is-next" : ""}`,
          index < current ? t("bracket.done", { name }) : index === current ? t("bracket.next", { name }) : name);
        if (index === campaign.rivals.length - 1) item.appendChild(el("span", "da-bracket__tag", t("bracket.final")));
        bracket.appendChild(item);
      });
      panel.appendChild(bracket);
    } else if (tournament) {
      panel.append(el("h2", "da-title", t("bracket.heading")));
      const bracket = el("ol", "da-bracket");
      tournament.order.forEach((rivalId, index) => {
        const done = tournament.results.some((entry) => entry.round === index && entry.won);
        const next = index === tournament.round + 1;
        const item = el("li", `da-bracket__step${done ? " is-done" : ""}${next ? " is-next" : ""}`,
          done ? t("bracket.done", { name: rivalName(rivalId) }) : next ? t("bracket.next", { name: rivalName(rivalId) }) : rivalName(rivalId));
        if (index === tournament.order.length - 1) item.appendChild(el("span", "da-bracket__tag", t("bracket.final")));
        bracket.appendChild(item);
      });
      panel.appendChild(bracket);
    } else panel.append(el("h2", "da-title", t("level.heading")), el("p", "da-note", t("level.hint")));
    const cards = el("div", "da-cards");
    options.forEach((id, index) => {
      const upgrade = dataArenaUpgrade(id);
      const [name, effect] = t(`up.${id}`).split(/\s*[｜|]\s*/);
      const preview = previewDataArenaUpgrade(sim.getState().upgrades, id);
      const card = button(`da-card da-card--${upgrade.track.toLowerCase()}`, "", () => {
        if (root.dataset.state !== 'LEVEL' || !sim.choose(id)) return;
        for (const control of cards.children) control.disabled = true;
        audio?.play("ui");
        if (sim.getState().mode === "PLAY") { hideOverlay(); root.dataset.state = "PLAY"; }
      }, signal);
      card.append(el("span", "da-card__key", String(index + 1)), el("span", "da-card__track", t(`level.track.${upgrade.track}`)),
        el("strong", "da-card__name", name), el("span", "da-card__effect", effect ?? ""),
        el("span", "da-card__rank", Number.isFinite(upgrade.max) ? t('level.change', {before:preview.before, after:preview.after, max:upgrade.max}) : ""));
      card.dataset.upgrade = id;
      const values = el('span', 'da-card__preview');
      for (const effect of preview.effects) {
        const format = value => effect.kind === 'toggle' ? t(value ? 'pause.on' : 'pause.off')
          : `${value > 0 ? '+' : ''}${Number((value * (effect.kind === 'percent' ? 100 : 1)).toFixed(2))}${effect.kind === 'percent' ? '%' : ''}`;
        values.append(el('span', '', `${t(`effect.${effect.key}`)}: ${format(effect.before)} → ${format(effect.after)}`));
      }
      values.append(el('small', '', t(id === 'patch' ? 'level.healNow' : 'level.bonusNote')));
      card.append(values);
      if (index === 0) card.dataset.autofocus = "1";
      cards.appendChild(card);
    });
    panel.appendChild(cards);
    showOverlay(panel);
  }

  function togglePause(force = null) {
    if (qualityReloading) return;
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
    const qualityToggle = button("da-btn da-toggle", `${t("pause.quality")}：${t(`pause.quality.${quality}`)}`, async () => {
      if(qualityReloading||signal.aborted)return;
      qualityReloading=true;
      const controls=[...panel.querySelectorAll('button:not(.da-btn--quiet)')].map(control=>[control,control.disabled]);
      for(const[control]of controls)control.disabled=true;
      try{
      quality = quality === "high" ? "low" : "high"; records.setSettings({ quality });
      scene?.dispose();scene=null;
      await interactionArt?.dispose();interactionArt=null;
      if (environment) {
        // A quality change swaps environment pixels as well as renderer scale.
        // The paused scene releases its objects before its textures are unloaded.
        scene?.dispose(); scene = null;
        await environment.dispose(); environment = null;
        try { environment = await loadDataArenaEnvironment({ PIXI: stage.PIXI, renderer:stage.app.renderer, map: sim.grid.map, quality, href, signal }); }
        catch (error) { if (!signal.aborted) console.warn("DATA_ARENA_ENVIRONMENT_FALLBACK", error?.message); }
        if (signal.aborted) { await environment?.dispose(); environment = null; return; }
      }
      try{interactionArt=await loadDataArenaInteractionArt({PIXI:stage.PIXI,map:sim.grid.map,quality,href,signal});}
      catch(error){if(!signal.aborted)console.warn("DATA_ARENA_INTERACTION_ART_FALLBACK",error?.message);}
      if(signal.aborted){await interactionArt?.dispose();interactionArt=null;return;}
      mountScene();
      qualityToggle.textContent = `${t("pause.quality")}：${t(`pause.quality.${quality}`)}`;
      }finally{
        qualityReloading=false;
        if(!signal.aborted)for(const[control,disabled]of controls)control.disabled=disabled;
      }
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
    // The ranch partners behind the relay seats (by species): a beacon's and a contract's rewards land on them.
    const snap = sim.getSnapshot?.() ?? null;
    const held = progress?.ownedInstances ?? [];
    const partyIds = [...new Set((snap?.relay?.team ?? [{ speciesId: partnerId }]).map((member) => held.find((entry) => entry.speciesId === String(member.speciesId ?? '').replace(/^relay-/, ''))?.instanceId).filter(Boolean))];
    // Cyber Gachapon: the host settles a win like an AI match (a ticket 60% of the time, a cup 2-4 more) and
    // spends an armed bounty beacon on it (Owner 2026-11-10).
    let gachaTickets = 0;
    let campaignOutcome = null;
    if (campaign && typeof onCampaignResult === "function") {
      try { campaignOutcome = onCampaignResult({ outcome: result.outcome, timeSeconds: result.timeSeconds, fainted: result.relayFainted ?? 0 }); } catch { campaignOutcome = null; }
    }
    if (!campaign && result.outcome === "VICTORY" && typeof onVictory === "function") {
      try { gachaTickets = onVictory({ tournament: Boolean(result.tournament), partyIds })?.granted ?? 0; } catch { gachaTickets = 0; }
    }
    // Sync EXP for the ranch partners that fought; the host settles it into the save.
    let syncPanel = null;
    if (typeof onSyncResult === "function") {
      try {
        const record = onSyncResult({ instanceIds: fighterInstances(), won: result.outcome === "VICTORY", attemptId: `arena:${matchId}` });
        syncPanel = record && typeof syncPanelFor === "function" ? syncPanelFor(record) : null;
      } catch { syncPanel = null; }
    }
    // The staked contract settles on this result: downs are relay partners left at 0 HP.
    let sponsorResult = null;
    if (staked?.ok) {
      const downs = (snap?.relay?.team ?? []).filter((member) => member.hp <= 0).length;
      try { sponsorResult = sponsor.settle({ won: result.outcome === "VICTORY", partnerDowns: downs, seconds: result.timeSeconds, partyIds }); } catch { sponsorResult = null; }
      staked = null;
    }
    const best = records.get().modes[result.mode]?.bestScore ?? records.get().bestScore;
    music?.setScene(result.outcome === "VICTORY" ? "victory" : "defeat", `arena-result:${matchId}`);
    const panel = el("div", `da-panel da-panel--result da-result--${result.outcome.toLowerCase()}`);
    const cup = result.tournament;
    panel.append(el("h2", "da-title", cup ? (result.outcome === "VICTORY" ? t("result.champion") : t("result.out", { round: cup.reachedRound })) : t(`result.${result.outcome}`)));
    const score = el("div", "da-result__score");
    score.append(el("span", "da-result__label", t("result.score")), el("strong", "", result.score.toLocaleString()));
    if (newBest) score.appendChild(el("span", "da-badge", t("result.newBest")));
    panel.append(score, el("p", "da-note", t("result.best", { score: best.toLocaleString() })));
    if (cup) {
      const rounds = el("ol", "da-bracket da-bracket--result");
      for (const entry of cup.results) {
        rounds.appendChild(el("li", `da-bracket__step${entry.won ? " is-done" : " is-lost"}`,
          t("result.rounds", { name: rivalName(entry.rivalId), state: t(entry.won ? "result.roundWon" : "result.roundLost"), time: formatTime(entry.seconds) })));
      }
      panel.append(rounds, el("p", "da-result__line", t("result.tStats", { moves: result.stats.movesCast, ults: result.stats.ultimates, blocks: result.stats.barrierBlocks, perfect: result.stats.perfectDodges, dodges: result.stats.rivalDodges })));
    } else {
      panel.append(
        el("p", "da-result__line", [t("result.time", { time: formatTime(result.timeSeconds) }), t("result.kills", { count: result.kills }), t("result.level", { level: result.level })].join("　")),
        el("p", "da-result__line", t("result.breakdown", result.breakdown)),
        el("p", "da-result__line", t("result.stats", { perfect: result.stats.perfectDodges, chains: result.stats.chains, rescues: result.stats.rescues, cheers: result.cheers })));
    }
    if (gachaTickets > 0) {
      const drop = el("p", "da-result__line da-result__gacha", `+${gachaTickets}`);
      drop.prepend(gachaTicketImage("cm-gacha-drop-ticket"));
      drop.dataset.gachaTickets = String(gachaTickets);
      panel.append(drop);
    }
    if (campaignOutcome) {
      const stars = el("p", "da-result__stars", "★".repeat(campaignOutcome.stars) + "☆".repeat(3 - campaignOutcome.stars));
      stars.dataset.stars = String(campaignOutcome.stars);
      panel.append(stars, ...(campaignOutcome.lines ?? []).map((line) => el("p", "da-result__line da-result__campaign", line)));
    }
    if (syncPanel) { panel.append(syncPanel.node); signal.addEventListener("abort", () => syncPanel.dispose(), { once: true }); }
    if (sponsorResult?.ok) {
      const line = el("p", "da-result__line da-result__sponsor", sponsorResult.met ? uiText("SPONSOR_WON", { bits: sponsorResult.payout }) : uiText("SPONSOR_LOST", { bits: sponsorResult.stake }));
      line.dataset.met = String(sponsorResult.met);
      panel.append(line);
    }
    const actions = el("div", "da-actions");
    const retry = button("da-btn da-btn--primary", t("result.retry"), () => { syncPanel?.dispose(); void startMatch(); }, signal);
    retry.dataset.autofocus = "1";
    actions.append(retry, button("da-btn", t("result.change"), () => showSelect(), signal), button("da-btn da-btn--quiet", t("result.exit"), () => close(), signal));
    panel.append(actions, el("p", "da-fineprint", t(saved ? "result.recordNote" : "result.recordOff")));
    // A short beat so the crowd reaction and the last hit read before the panel.
    setTimeout(() => { if (!signal.aborted && root.dataset.state === "RESULT") { showOverlay(panel); syncPanel?.play(); } }, 900);
  }

  // ------------------------------------------------------------------ teardown
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    const owner = matchLoad; matchLoad = null; startingMatch = false;
    owner?.cancel();
    lifetime.abort();
    void releaseArenaResource(cutIn);
    void releaseMatch();
    root.remove();
    document.documentElement.classList.remove("da-open");
    if (qa) delete globalThis.__dataArenaQA;
    onExit();
  }

  if (qa) {
    // Read-only observation for automated browser QA; it cannot drive the match.
    globalThis.__dataArenaQA = Object.freeze({
      snapshot: () => (sim ? sim.getSnapshot() : null),
      events:()=>JSON.parse(JSON.stringify(qaRecentEvents)),
      state: () => root.dataset.state,
      diagnostics: () => {
        const sorted = [...frameCost].sort((a, b) => a - b);
        return { frameFault: frameFault ? String(frameFault.message ?? frameFault) : null, tickerListeners: stage?.app.ticker.count ?? null, scene: scene?.getDiagnostics() ?? null, stage: stage?.getDiagnostics() ?? null, bundles: [...bundles.keys()],
          arenaUpdateMs: sorted.length ? { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * 0.95)] } : null };
      },
      worldToScreen: (x, y) => (scene ? scene.worldToScreen(x, y) : null),
      // Loopback review only (Journey zones, 2026-11-10): end the current relay wave so the
      // between-wave buff pick and the stage result can be checked. Public hosts never get it.
      ...(["localhost", "127.0.0.1", "[::1]", "::1"].includes(globalThis.location?.hostname) ? { endRelayWave: () => {
        const state = sim?.getState(); if (!state?.relay || !state.rivals[0]) return false; state.rivals[0].hp = 0; return true; } } : {}),
      entities: () => {
        if (!sim) return null;
        const state = sim.getState();
        return { enemies: state.enemies.map(({ x, y, kind }) => ({ x, y, kind })),
          projectiles: state.projectiles.map(({ x, y, vx, vy, owner, kind, radius }) => ({ x, y, vx, vy, owner, kind, radius })),
          surfaceUnderPlayer: sim.grid.surfaceAt(state.player.x, state.player.y) };
      },
      telegraphs: () => (sim ? sim.getState().telegraphs.map(({ kind, x, y, radius, angle, t: age, duration }) => ({ kind, x, y, radius, angle, age, duration })) : []),
      // Presentation only: plays the worst-case telemetry burst (two hits and a dodge
      // beside the rival, cover broken then a steam chain twice, a cooldown cut on
      // the skills) through the same three tracks. The simulation is not touched.
      telemetryProbe: () => {
        if (!sim || !scene || root.dataset.state !== "PLAY") return false;
        const state = sim.getState(), rival = state.rivals.find((r) => r.hp > 0) ?? state.player;
        scene.damageNumber?.(rival.x, rival.y - 56, 14, 0xffffff); scene.damageNumber?.(rival.x, rival.y - 56, 42, 0xffffff);
        toast(t("fct.dodge"), { x: rival.x, y: rival.y - 64, tone: "dodge", key: "probe-dodge", gap: 0 });
        tactical(t("arena.coverBroken"), { tone: "warn", key: "cover-broken" });
        tactical(t("toast.chain.STEAM"), { tone: "chain", key: "chain-STEAM" });
        tactical(t("toast.chain.STEAM"), { tone: "chain", key: "chain-STEAM" });
        for (const slot of [0, 1, 2]) buttonFlag(slot, t("fct.cooldown", { amount: 2 }), { tone: "good" });
        return true;
      }
    });
  }

  showSelect();
  return Object.freeze({ close, get state() { return root.dataset.state; } });
}
