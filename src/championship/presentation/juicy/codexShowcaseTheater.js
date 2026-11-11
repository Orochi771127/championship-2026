// CodexShowcaseTheater -- the Dex detail's holo viewer and preview sandbox
// (Owner direction 2026-10-28).
//
//  * Portrait <-> in-game motion toggle on the hero frame, with turn and
//    action (idle / walk / attack / cheer) controls.
//  * "Preview special": the species' signature move against a training dummy:
//    wind-up squash, 35 % spotlight and the cut-in strip, the move's own
//    effect (its theme's vines, missiles, lightning... with the battle's real
//    effect cells on top, 2026-10-28 fix), a 60 ms hit-stop, the dummy's
//    element-tinted flash and knockback, and the move's real power as an
//    arcing number.
//  * "Preview evolution": the shared CyberMorphEvolutionRunner from this form
//    to a route's target.
//  * Unregistered species and routes without a completion record play in
//    "encrypted signal" mode: the motion and the energy are shown and the body
//    stays a cyan cipher silhouette. Owner 2026-10-28: the move's name is
//    always shown (a special preview never reads 【 ？？？？ 】); an
//    undiscovered caster keeps its name hidden.
//
// The sandbox is ONE overlay node per Dex screen, created on first use and
// reused for every preview. It is DOM + Web Animations only (no canvas, no
// WebGL), it reads catalogs and never calls an intent, so no save value can
// change. Closing a preview or leaving the detail cancels every animation and
// timer it started and drops the images it set.
import movesCatalog from "../../../data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import { listProductOriginalMoveRecords } from "../../contracts/productOriginalSpecies.js";
import { battleFxFamilyName, battleFxMoveBanks, describeBattleFxMove, BATTLE_FX_PALETTES } from "../battleFx/battleFxRecipes.js";
import { moveVfxTheme } from "../battleFx/moveVfxThemes.js";
import { resolveMoveVfx } from "../vfx/unifiedMoveVfxResolver.js";
import { ceremonyEnvironment, playCeremonySound } from "../ceremony/ceremonyRunner.js";
import { juicyText } from "../../text/juicyShowcaseText.js";
import { applyJuicyPalette, juicyNode, juicyPortrait } from "./juicyArt.js";
import { playCyberMorphEvolution } from "./cyberMorphEvolutionRunner.js";
import { createSkillCutInLayer } from "./skillCutIn.js";
import { createShowcaseBankCells } from "./showcaseBankCells.js";
import { playShowcaseBakedPiece, preloadShowcaseBakedPieces } from "./showcaseBakedPiece.js";
import { moveVfxChoreography } from "../vfx/moveVfxChoreography.js";
import { SHOWCASE_CARRIER_STYLES, SHOWCASE_STREAM_STYLES, playShowcaseStyle, showcaseStyleIsMelee } from "./showcaseMoveVfx.js";
import { SHOWCASE_ACTIONS, SHOWCASE_ATTACK_SEQUENCE, createSpriteMotion, loadShowcaseMotionShared, showcaseFitScale,
  showcaseMotionAvailable } from "./spriteMotionPlayer.js";

// The baked move pieces (about 3.7 MB of text) start loading with the Dex, ahead of the first preview's hit.
if (typeof preloadShowcaseBakedPieces === "function" && typeof document !== "undefined") preloadShowcaseBakedPieces();
const moveRecords = new Map([...(movesCatalog.records ?? []), ...listProductOriginalMoveRecords()].map(record => [record.recordIndex, record]));

/**
 * A move's preview look: its theme (style, element, stage tier; see
 * moveVfxThemes.js), the palette that element names, the battle form, and the
 * effect banks the battle plays for it.
 */
/** The baked look a contact piece plays in the Dex (flurry and drop by their drawing; the first layer of a pair). */
const SHOWCASE_FLURRY = Object.freeze({ leaf: "flurry-leaf", feather_sm: "flurry-feather", shard: "flurry-shard", bubble_sm: "flurry-bubble", note: "flurry-note",
  heart: "flurry-heart", fish_0: "flurry-bubble", mushroom: "flurry-spore", ghost: "flurry-note", cherry: "flurry-leaf" });
const SHOWCASE_DROP = Object.freeze({ bomb: "drop-bomb", mushroom: "flurry-spore", gear: "drop-rock", bone: "drop-rock", cherry: "drop-rock" });
export function showcasePieceLook({ piece, sprite = null } = {}) {
  if (piece === "flurry") return SHOWCASE_FLURRY[sprite] ?? "flurry-leaf";
  if (piece === "drop") return SHOWCASE_DROP[sprite] ?? "drop";
  if (piece === "jaws-horn") return "jaws";
  if (piece === "scissor") return "slash";
  return piece;
}
export function showcaseMoveLook(recordIndex) {
  const record = moveRecords.get(recordIndex);
  const look = record ? describeBattleFxMove(record) : null;
  const theme = moveVfxTheme(recordIndex);
  // One element authority for every view (VFX_FIVE_LAYER_20261101): the name,
  // the record, its bank, then the caster's taxonomy element.
  const vfx = record ? resolveMoveVfx(record) : null;
  const palette = vfx?.paletteKey ?? (theme && BATTLE_FX_PALETTES[theme.element] ? theme.element : look?.palette ?? "neutral");
  const recordBanks = record ? battleFxMoveBanks(record) : [];
  // A record that names no bank plays the presentation's original fallback cells.
  const banks = recordBanks.length ? recordBanks : Object.freeze((vfx?.cells ?? []).map(cell => Object.freeze({ role: cell.role, bankId: cell.bankId,
    sequence: cell.sequence, family: battleFxFamilyName(cell.bankId), fallback: true })));
  return Object.freeze({ form: look?.form ?? "projectile", palette, style: theme?.style ?? (look?.form === "melee" ? "strike" : "holy"),
    element: vfx?.element ?? "NEUTRAL", elementSource: vfx?.elementSource ?? "NONE", tier: theme?.tier ?? 2, themeSource: theme?.source ?? null,
    banks, cellHue: vfx?.cellHue ?? 0, cellTint: vfx?.cellTint ?? 0xffffff, accent: vfx?.accent ?? null, overlay: vfx?.overlay ?? null, decal: vfx?.decal ?? "crack", storm: vfx?.storm ?? "burst" });
}

/** How long a special preview waits for the effect atlas before it plays without it (ms). */
export const SHOWCASE_CELL_WAIT_MS = 2500;

/** The special demo's beats in ms (wind-up, cut-in, travel, contact, end). */
export const SHOWCASE_SPECIAL_TIMING = Object.freeze({ windup: 240, squash: 140, cutIn: 390, travel: 700, contact: 1000, hitStop: 60, end: 1950 });

const node = juicyNode;
const button = (doc, className, text, label = null) => {
  const element = node(doc, "button", className, text);
  element.type = "button";
  if (label) element.setAttribute("aria-label", label);
  return element;
};

export function createCodexShowcase({ doc = globalThis.document, overlayHost = doc?.body, fetchImpl = undefined } = {}) {
  const heroes = new Set();
  let theater = null;
  let disposed = false;
  // The battle's effect cells, requested when the Dex detail shows its first
  // "preview special" button (VFX_FIVE_LAYER_20261101: no first-play miss).
  let bankCells = null, cellsReady = false;
  const ensureBankCells = () => {
    if (!bankCells) {
      bankCells = createShowcaseBankCells({ doc, fetchImpl });
      if (typeof preloadShowcaseBakedPieces === "function") preloadShowcaseBakedPieces();
      const own = bankCells;
      own.ready.then(() => { if (bankCells === own) cellsReady = true; }, () => { if (bankCells === own) cellsReady = true; });
    }
    return bankCells;
  };
  let opens = 0, specials = 0, evolutions = 0;

  // ------------------------------------------------------------ hero viewer
  /** Add the portrait/motion toggle to a Dex hero frame. Returns false when no motion exists here. */
  function attachHero(holder, { speciesId }) {
    if (disposed || !holder || !showcaseMotionAvailable(speciesId)) return false;
    holder.dataset.view = "portrait";
    holder.classList.add("cm-dex-hero--showcase");
    const toggle = node(doc, "div", "cm-showcase-toggle");
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", juicyText("view.label"));
    // Drawn CSS icons, never emoji: a colour-emoji fallback font rendered the
    // runner as stray punctuation on some phones (Owner 2026-10-29).
    const portraitButton = button(doc, "cm-showcase-toggle__option", juicyText("view.portrait"));
    const motionButton = button(doc, "cm-showcase-toggle__option", juicyText("view.motion"));
    portraitButton.dataset.view = "portrait";
    motionButton.dataset.view = "motion";
    toggle.append(portraitButton, motionButton);
    const panel = node(doc, "div", "cm-showcase-motion");
    panel.hidden = true;
    const pad = node(doc, "i", "cm-showcase-motion__pad");
    const spriteHost = node(doc, "div", "cm-showcase-motion__sprite");
    const status = node(doc, "p", "cm-showcase-motion__status", juicyText("motion.loading"));
    // The controls sit in their own full-width bar under the frame, so every
    // key keeps a full touch target however narrow the hero column is.
    const controls = node(doc, "div", "cm-showcase-motion__controls");
    const turn = button(doc, "cm-showcase-motion__turn", `↻ ${juicyText("turn")}`);
    const actions = node(doc, "div", "cm-showcase-motion__actions");
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", juicyText("action"));
    const actionButtons = SHOWCASE_ACTIONS.map(action => {
      const element = button(doc, "cm-showcase-motion__action", juicyText(`action.${action.id}`));
      element.dataset.action = action.id;
      element.setAttribute("aria-pressed", String(action.id === "stand"));
      actions.append(element);
      return element;
    });
    controls.append(turn, actions);
    controls.hidden = true;
    panel.append(pad, spriteHost, status);
    holder.append(toggle, panel);
    holder.after(controls);

    const abort = new AbortController();
    let sprite = null, loading = null, view = "portrait";
    const reduced = () => ceremonyEnvironment(doc).reduced;
    function paintToggle() {
      holder.dataset.view = view;
      portraitButton.setAttribute("aria-pressed", String(view === "portrait"));
      motionButton.setAttribute("aria-pressed", String(view === "motion"));
      panel.hidden = view !== "motion";
      controls.hidden = view !== "motion" || !sprite;
      if (view === "motion") sprite?.resume(); else sprite?.pause();
    }
    function select(action) {
      const chosen = SHOWCASE_ACTIONS.find(entry => entry.id === action) ?? SHOWCASE_ACTIONS[0];
      for (const element of actionButtons) element.setAttribute("aria-pressed", String(element.dataset.action === chosen.id));
      sprite?.play(chosen.sequence);
      panel.dataset.action = chosen.id;
    }
    function ensureSprite() {
      if (sprite || loading) return;
      loading = loadShowcaseMotionShared(speciesId, { fetchImpl }).then(motion => {
        if (abort.signal.aborted || disposed) return;
        // The feet stand on the pad's centre (--foot-y in the stylesheet: 40 px + 6 %).
        const box = spriteHost.getBoundingClientRect?.() ?? { width: 0, height: 0 };
        const room = box.width > 0 && box.height > 0 ? { width: box.width * 0.92, height: box.height * 0.94 - 40 - 10 } : { width: 140, height: 140 };
        sprite = createSpriteMotion({ doc, motion, scale: showcaseFitScale(motion, room), reducedMotion: reduced() });
        spriteHost.append(sprite.element);
        sprite.setFacing(1);
        status.hidden = true;
        controls.hidden = view !== "motion";
        select("stand");
        turn.setAttribute("aria-label", `${juicyText("turn")} · ${juicyText("motion.facing.right")}`);
      }).catch(error => {
        if (abort.signal.aborted) return;
        status.textContent = juicyText("motion.unavailable");
        panel.dataset.error = String(error?.message ?? error);
      });
    }
    portraitButton.addEventListener("click", () => { view = "portrait"; paintToggle(); });
    motionButton.addEventListener("click", () => { view = "motion"; paintToggle(); ensureSprite(); });
    turn.addEventListener("click", () => {
      if (!sprite) return;
      const facing = sprite.setFacing(-sprite.getFacing());
      turn.setAttribute("aria-label", `${juicyText("turn")} · ${juicyText(facing > 0 ? "motion.facing.right" : "motion.facing.left")}`);
    });
    for (const element of actionButtons) element.addEventListener("click", () => select(element.dataset.action));
    paintToggle();
    const entry = {
      dispose() {
        abort.abort();
        sprite?.dispose();
        sprite = null;
        toggle.remove();
        panel.remove();
        controls.remove();
        holder.classList.remove("cm-dex-hero--showcase");
        delete holder.dataset.view;
      },
      state: () => ({ view, loaded: Boolean(sprite), facing: sprite?.getFacing() ?? null, sequence: sprite?.getSequence() ?? null })
    };
    heroes.add(entry);
    return true;
  }

  // ----------------------------------------------------------- the sandbox
  function ensureTheater() {
    if (theater) return theater;
    const root = node(doc, "div", "cm-showcase");
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    const scrim = node(doc, "div", "cm-showcase__scrim");
    const frame = node(doc, "section", "cm-showcase__frame");
    const head = node(doc, "header", "cm-showcase__head");
    const badge = node(doc, "span", "cm-showcase__badge", juicyText("preview.badge"));
    const title = node(doc, "strong", "cm-showcase__title");
    const close = button(doc, "cm-showcase__close", "✕", juicyText("preview.close"));
    head.append(badge, title, close);
    const stage = node(doc, "div", "cm-showcase__stage");
    // The sequencer's beats are Web Animations on this node, so a hit-stop
    // pause (or a slowed document timeline) holds the whole sequence together.
    const clock = node(doc, "i", "cm-showcase__clock");
    const foot = node(doc, "footer", "cm-showcase__foot");
    const note = node(doc, "p", "cm-showcase__note");
    note.hidden = true;
    const replay = button(doc, "cm-showcase__replay", `↻ ${juicyText("preview.replay")}`);
    replay.hidden = true;
    foot.append(note, replay);
    frame.append(head, stage, foot, clock);
    root.append(scrim, frame);
    overlayHost.append(root);
    theater = { root, frame, title, close, stage, clock, note, replay, timers: new Set(), run: null, cutIn: null, sprite: null, opener: null, payload: null, kind: null };
    close.addEventListener("click", () => closeTheater());
    scrim.addEventListener("click", () => closeTheater());
    replay.addEventListener("click", () => { if (theater.payload) start(theater.kind, theater.payload); });
    root.addEventListener("keydown", event => { if (event.key === "Escape" && !theater.run) { event.stopPropagation(); closeTheater(); } });
    return theater;
  }

  function later(ms, fn) {
    const timers = theater.timers;
    const live = () => !disposed && theater && !theater.root.hidden;
    if (typeof theater.clock.animate === "function") {
      const beat = theater.clock.animate([{ visibility: "visible" }, { visibility: "visible" }], { duration: Math.max(1, ms) });
      timers.add(beat);
      beat.finished.then(() => { timers.delete(beat); if (live()) fn(); }, () => timers.delete(beat));
      return;
    }
    const id = globalThis.setTimeout(() => { timers.delete(id); if (live()) fn(); }, ms);
    timers.add(id);
  }

  /** Stop whatever the sandbox shows; the overlay itself is kept for reuse. */
  function clearStage() {
    if (!theater) return;
    for (const timer of theater.timers) { if (typeof timer?.cancel === "function") timer.cancel(); else globalThis.clearTimeout(timer); }
    theater.timers.clear();
    theater.run?.dispose();
    theater.run = null;
    theater.cutIn?.dispose();
    theater.cutIn = null;
    theater.sprite?.dispose();
    theater.sprite = null;
    for (const animation of theater.stage.getAnimations?.({ subtree: true }) ?? []) { try { animation.cancel(); } catch { /* gone */ } }
    for (const image of theater.stage.querySelectorAll("img")) image.removeAttribute("src");
    theater.stage.replaceChildren();
    theater.note.hidden = true;
    theater.replay.hidden = true;
  }

  function closeTheater() {
    if (!theater || theater.root.hidden) return;
    clearStage();
    theater.root.hidden = true;
    theater.payload = null;
    const opener = theater.opener;
    theater.opener = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function start(kind, payload) {
    const view = ensureTheater();
    clearStage();
    view.kind = kind;
    view.payload = payload;
    view.runId = (view.runId ?? 0) + 1; // a replay is a new run, even with the same payload
    view.root.hidden = false;
    view.root.dataset.kind = kind;
    view.root.dataset.encrypted = String(Boolean(payload.encrypted));
    view.root.setAttribute("aria-label", payload.title);
    view.title.textContent = payload.title;
    opens++;
    if (kind === "special") playSpecial(payload); else playEvolution(payload);
    view.close.focus({ preventScroll: true });
  }

  function finishRun() {
    if (!theater) return;
    theater.replay.hidden = false;
    if (theater.payload?.lockedNote) { theater.note.textContent = `🔒 ${theater.payload.lockedNote}`; theater.note.hidden = false; }
  }

  // ---------------------------------------------------- evolution preview
  function playEvolution(payload) {
    evolutions++;
    theater.stage.dataset.mode = "evolution";
    theater.run = playCyberMorphEvolution({ host: theater.stage, doc, mode: "preview", from: payload.from, to: payload.to,
      traits: payload.traits, special: payload.special, encrypted: payload.encrypted, lockedNote: payload.lockedNote,
      onDone: () => { if (theater) { theater.run = null; finishRun(); } } });
  }

  // ------------------------------------------------------- special preview
  function figure(className) {
    const element = node(doc, "div", `cm-showcase__fighter ${className}`);
    const padNode = node(doc, "i", "cm-showcase__pad");
    const body = node(doc, "div", "cm-showcase__body");
    element.append(padNode, body);
    return { element, body };
  }

  function playSpecial(payload) {
    specials++;
    const runId = theater.runId;
    const env = ceremonyEnvironment(doc);
    const full = env.motion !== "reduced";
    const T = SHOWCASE_SPECIAL_TIMING;
    const stage = theater.stage;
    stage.dataset.mode = "special";
    const arena = node(doc, "div", "cm-showcase__arena");
    arena.dataset.form = payload.look.form;
    arena.dataset.style = payload.look.style;
    applyJuicyPalette(arena, payload.look.palette);
    arena.append(node(doc, "i", "cm-showcase__grid"));
    // Signature backdrop and ground marks sit behind the fighters (VFX_FIVE_LAYER_20261101).
    const backdrop = node(doc, "div", "cm-showcase__backdrop");
    arena.append(backdrop);
    const caster = figure("cm-showcase__fighter--caster");
    const dummy = figure("cm-showcase__fighter--dummy");
    const charge = node(doc, "i", "cm-showcase__charge");
    const glint = node(doc, "i", "cm-showcase__glint");
    caster.element.append(charge, glint);
    const target = node(doc, "div", "cm-showcase__dummy");
    target.append(node(doc, "i", "cm-showcase__dummy-post"), node(doc, "i", "cm-showcase__dummy-face"));
    dummy.body.append(target);
    dummy.element.append(node(doc, "span", "cm-showcase__tag", juicyText("preview.dummy")));
    const fx = node(doc, "div", "cm-showcase__fx");
    arena.append(caster.element, dummy.element, fx);
    stage.append(arena);
    theater.cutIn = createSkillCutInLayer({ host: stage, doc, spotlight: true });

    // The caster: in-game motion when this build has it, else the portrait,
    // else (encrypted) a cipher silhouette.
    let visual = null;
    if (payload.encrypted && payload.portrait?.src) {
      // A viewable but unregistered partner: its outline as a cyan data body.
      visual = node(doc, "div", "cm-showcase__cipher cm-showcase__cipher--outline");
      const url = `url("${String(payload.portrait.src).replace(/"/g, "%22")}")`;
      visual.style.setProperty("-webkit-mask-image", url);
      visual.style.setProperty("mask-image", url);
    } else if (payload.encrypted) {
      visual = node(doc, "div", "cm-showcase__cipher");
      visual.append(node(doc, "span", "", "？"));
    } else if (payload.portrait?.src) {
      visual = node(doc, "img", "cm-showcase__portrait");
      visual.alt = ""; visual.decoding = "async"; visual.src = payload.portrait.src;
    }
    if (visual) caster.body.append(visual);
    if (!payload.encrypted && showcaseMotionAvailable(payload.speciesId)) {
      void loadShowcaseMotionShared(payload.speciesId, { fetchImpl }).then(motion => {
        if (!theater || theater.runId !== runId || theater.sprite) return;
        // One cell of the real motion, its feet on the pad's centre (.cm-showcase__body --foot-y).
        const box = caster.body.getBoundingClientRect?.() ?? { width: 0, height: 0 };
        const room = box.width > 0 ? { width: box.width * 1.05, height: box.height * 0.92 } : { width: 120, height: 120 };
        // A ranged special is cast standing on the pad; a melee one keeps its leap.
        const sprite = createSpriteMotion({ doc, motion, scale: showcaseFitScale(motion, room), reducedMotion: !full,
          grounded: !showcaseStyleIsMelee(payload.look.style) });
        sprite.setFacing(1);
        sprite.play(theater.attacking ? SHOWCASE_ATTACK_SEQUENCE : 0, { loop: !theater.attacking });
        visual?.remove();
        caster.body.append(sprite.element);
        theater.sprite = sprite;
      }).catch(() => {});
    }
    theater.attacking = false;

    const animate = (element, keyframes, options) => element?.animate?.(keyframes, { fill: "both", ...options }) ?? null;
    const point = (element, at = 0.45) => {
      const box = element.getBoundingClientRect(), base = stage.getBoundingClientRect();
      return { x: box.left - base.left + box.width / 2, y: box.top - base.top + box.height * at, top: box.top - base.top, w: box.width, h: box.height };
    };
    // The caster's feet: the pad's centre, 1 % above the slot's bottom edge (the stylesheet's --foot-y).
    const casterFoot = () => {
      const box = caster.body.getBoundingClientRect(), base = stage.getBoundingClientRect();
      return { x: box.left - base.left + box.width / 2, y: box.bottom - base.top - box.height * 0.01 };
    };
    // Breaths, beams and bubbles leave the head (the muzzle of the release
    // cell); without the motion, the same rule on the drawn portrait.
    const casterPoint = () => {
      const foot = casterFoot();
      const muzzle = theater.sprite?.muzzle();
      if (muzzle) {
        const h = theater.sprite.bodyHeight();
        return { x: foot.x + muzzle.dx, y: foot.y + muzzle.dy, top: foot.y - h, w: theater.sprite.width, h, foot };
      }
      const body = point(visual ?? caster.body, 0);
      return { x: body.x + body.w * 0.26, y: body.top + body.h * 0.34, top: body.top, w: body.w, h: body.h, foot };
    };
    const dummyPoint = () => point(target.querySelector(".cm-showcase__dummy-face") ?? dummy.body, 0.5);
    const spawn = (className, x, y) => {
      const element = node(doc, "i", className);
      element.style.left = `${Math.round(x)}px`;
      element.style.top = `${Math.round(y)}px`;
      fx.append(element);
      return element;
    };

    // 0) The effect atlas is requested when the button appears; a first play
    // waits for it (up to SHOWCASE_CELL_WAIT_MS) so it never misses the cells.
    let begun = false;
    const begin = () => {
      if (begun || !theater || theater.runId !== runId) return;
      begun = true;
      delete stage.dataset.cells;
      sequence();
    };
    if (bankCells && !cellsReady) {
      // The give-up beat is a sandbox timer, so closing the preview cancels the wait too.
      stage.dataset.cells = "loading";
      later(SHOWCASE_CELL_WAIT_MS, begin);
      bankCells.ready.then(begin, begin);
    } else begin();
    function sequence() {
    // 1) Wind-up: squash 1.12 x 0.88 for 140 ms, a glint, a ring closing in.
    later(T.windup, () => {
      if (full) {
        animate(caster.body, [{ transform: "scale(1, 1)" }, { transform: "scale(1.12, 0.88)", offset: 0.5 }, { transform: "scale(1, 1)" }],
          { duration: T.squash * 2, easing: "ease-out" });
        animate(glint, [{ opacity: 0, transform: "translate(-50%, -50%) scale(0.4)" }, { opacity: 1, offset: 0.4, transform: "translate(-50%, -50%) scale(1.1)" },
          { opacity: 0, transform: "translate(-50%, -50%) scale(1.4)" }], { duration: 320 });
        animate(charge, [{ opacity: 0.95, transform: "translateX(-50%) scale(1.9)" }, { opacity: 0, transform: "translateX(-50%) scale(0.25)" }],
          { duration: 460, easing: "cubic-bezier(.5,0,.9,.6)" });
        // The element orb swells at the muzzle while four glints spiral into it.
        const at = casterPoint();
        const orb = spawn("cm-vfx cm-vfx--orb", at.x, at.y);
        animate(orb, [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, offset: 0.6, transform: "scale(1.15)" }, { opacity: 0.9, transform: "scale(0.85)" }],
          { duration: 520, easing: "ease-out" });
        later(560, () => orb.remove());
        for (let i = 0; i < 4; i++) {
          const glintNode = spawn("cm-vfx cm-vfx--orbglint", at.x, at.y), a = i * Math.PI / 2;
          animate(glintNode, [{ opacity: 0, transform: `rotate(${a}rad) translateX(34px) scale(1.2)` }, { opacity: 1, offset: 0.3 },
            { opacity: 0.2, transform: `rotate(${a + Math.PI * 1.6}rad) translateX(0) scale(0.4)` }], { duration: 480, easing: "ease-in" });
          later(500, () => glintNode.remove());
        }
      }
    });
    // 2) The cut-in strip with the 35 % spotlight on the caster's head, and the
    // attack motion once through. The move leaves on its release cell (the
    // forward-most frame: the open mouth or the swing), not on a fixed clock.
    later(T.cutIn, () => {
      // A ~0.53 s element storm behind the fighters, stepped at 15 fps and faded by weights.
      const storm = node(doc, "i", "cm-showcase__storm");
      storm.dataset.storm = payload.look.storm;
      backdrop.append(storm);
      const weights = [0.38, 0.72, 0.86, 0.86, 0.82, 0.74, 0.62, 0.48, 0.32, 0];
      animate(storm, weights.map((opacity, i) => ({ opacity, offset: i / (weights.length - 1),
        transform: full ? `rotate(${(i * 4).toFixed(0)}deg) scale(${(1 + i * 0.012).toFixed(3)})` : "none", easing: "step-end" })), { duration: full ? 530 : 360 });
      later(full ? 560 : 380, () => storm.remove());
      const at = casterPoint();
      theater.cutIn?.play({ team: "ally", portrait: payload.portrait, silhouette: payload.encrypted, palette: payload.look.palette,
        moveName: payload.move?.name ?? "", casterName: payload.name || "？？？？", focus: at });
      theater.attacking = true;
      theater.sprite?.play(SHOWCASE_ATTACK_SEQUENCE, { loop: false });
      const release = theater.sprite ? Math.min(520, Math.max(120, theater.sprite.releaseMs(SHOWCASE_ATTACK_SEQUENCE) + 40)) : T.travel - T.cutIn;
      theater.root.dataset.release = String(release);
      later(release, travel);
    });
    }
    // The theme's effect: the move's own vines, missiles, bolts... (showcaseMoveVfx.js),
    // with the battle's effect cells riding on them once the atlas is in.
    const cells = bankCells;
    // 3.2x..4.2x native: the cells read at phone size (VFX_FIVE_LAYER_20261101).
    const cellScale = () => Math.max(3.2, Math.min(4.2, (stage.getBoundingClientRect?.().width ?? 300) / 90));
    const bank = role => payload.look.banks.find(entry => entry.role === role) ?? null;
    const playCell = (role, x, y, host = null, options = {}) => {
      const entry = typeof role === "string" ? bank(role) : role;
      if (!cells || !entry || !cells.has(entry.bankId, entry.sequence)) return null;
      const anchor = host ?? spawn("cm-showcase__cell-anchor", x, y);
      if (!host && options.angle) anchor.style.transform = `rotate(${options.angle}rad)`;
      const cell = cells.play(entry.bankId, entry.sequence, anchor, { nativeScale: options.scale ?? cellScale(),
        hue: options.hue ?? payload.look.cellHue, tint: options.hue === 0 ? 0xffffff : payload.look.cellTint, duration: options.duration ?? null, flip: options.flip ?? false });
      if (!cell) { if (!host) anchor.remove(); return null; }
      later(Math.min(1400, Number(cell.dataset.lifetime) || 600), () => { if (host) cell.remove(); else anchor.remove(); });
      return cell;
    };
    // The move's own cells laid along a stream style's path: a line from the
    // muzzle (flame, beam, sound), a fall from above (thunder, holy) or a run
    // along the ground (vine, thorn, quake).
    function streamCells(mode, from, to, ground) {
      const role = bank("body") ? "body" : bank("launch") ? "launch" : null;
      if (!role || !cells) return 0;
      const step = Math.max(18, 8 * cellScale());
      const start = mode === "sky" ? { x: to.x, y: Math.max(0, to.y - 150) } : mode === "ground" ? { x: from.foot.x + 24, y: from.foot.y - 4 } : from;
      const end = mode === "ground" ? { x: ground.x, y: ground.y - 4 } : to;
      const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      // Butt the cells end to end: never spread them wider than one cell apart.
      const count = Math.max(2, Math.min(full ? 24 : 6, Math.ceil(length / step) + 1));
      for (let i = 0; i < count; i++) {
        later(i * (mode === "sky" ? 20 : 30), () => {
          const t = count > 1 ? i / (count - 1) : 1;
          playCell(role, start.x + dx * t, start.y + dy * t, null, { angle: mode === "line" ? angle : 0, duration: 380 });
        });
      }
      return count;
    }
    const styleContext = () => {
      const from = casterPoint(), to = dummyPoint();
      const foot = point(dummy.body, 1);
      return { doc, spawn, animate, later, full, from, to, tier: payload.look.tier,
        ground: { x: foot.x, y: foot.top + foot.h - 4 }, casterGround: from.foot,
        carry: (element, first) => { if (first && SHOWCASE_CARRIER_STYLES.includes(payload.look.style)) playCell(bank("body") ? "body" : "launch", 0, 0, element); } };
    };
    // 3) The move travels by style, from the muzzle; contact follows the flight.
    function travel() {
      later(T.contact - T.travel, contact);
      const from = casterPoint(), to = dummyPoint();
      fx.dataset.spawnY = String(Math.round(from.y));
      fx.dataset.footY = String(Math.round(from.foot.y));
      fx.dataset.bodyH = String(Math.round(from.h));
      const dx = to.x - from.x;
      const style = payload.look.style;
      playCell("launch", from.x, from.y) ?? playCell("prepare", from.x, from.y);
      // Release: a shock ring across the shot and seven recoil sparks at the muzzle.
      if (!showcaseStyleIsMelee(style) && full) {
        const aim = Math.atan2(to.y - from.y, to.x - from.x);
        const ringNode = spawn("cm-vfx cm-vfx--muzzlering", from.x, from.y);
        animate(ringNode, [{ opacity: 1, transform: `rotate(${aim}rad) scale(0.3, 0.5)` }, { opacity: 0, transform: `rotate(${aim}rad) scale(0.9, 1.6)` }], { duration: 200, easing: "ease-out" });
        later(220, () => ringNode.remove());
        for (let i = 0; i < 7; i++) {
          const spark = spawn("cm-showcase__spark", from.x, from.y), a = aim + Math.PI + (i - 3) * 0.3;
          animate(spark, [{ opacity: 1, transform: `translate(-50%, -50%) rotate(${a}rad) translateX(0) scaleX(0.8)` },
            { opacity: 0, transform: `translate(-50%, -50%) rotate(${a}rad) translateX(${26 + (i % 3) * 8}px) scaleX(0.3)` }], { duration: 240, easing: "ease-out" });
          later(260, () => spark.remove());
        }
      }
      if (showcaseStyleIsMelee(style)) {
        const reach = dx - to.w * 0.55;
        animate(caster.element, [{ transform: "translateX(0)" }, { transform: `translateX(${reach}px)`, offset: 0.4 },
          { transform: `translateX(${reach}px)`, offset: 0.7 }, { transform: "translateX(0)" }], { duration: 760, easing: "ease-in-out" });
        for (let i = 1; i <= 3 && full; i++) {
          later(70 * i, () => {
            const ghost = theater.sprite?.snapshot() ?? (visual ? visual.cloneNode(true) : null);
            if (!ghost) return;
            const box = point(caster.body, 0.45);
            const holder = spawn("cm-showcase__ghost", box.x, box.top + box.h);
            holder.append(ghost);
            animate(holder, [{ opacity: 0.55 }, { opacity: 0 }], { duration: 300, easing: "ease-out" });
          });
        }
      } else {
        const context = styleContext();
        playShowcaseStyle("travel", style, context);
        if (SHOWCASE_STREAM_STYLES[style]) streamCells(SHOWCASE_STREAM_STYLES[style], context.from, context.to, context.ground);
      }
    }
    // 4) Contact: 60 ms hit-stop, then flash, knockback, sparks and the number.
    function contact() {
      later(T.end - T.contact, () => { theater.sprite?.play(33); finishRun(); });
      // Everything on the stage and every pending beat holds for 60 ms.
      const paused = [];
      for (const animation of [...(stage.getAnimations?.({ subtree: true }) ?? []), ...theater.timers]) {
        if (animation?.playState === "running") { animation.pause(); paused.push(animation); }
      }
      stage.dataset.hitStop = "true";
      const resume = () => {
        if (!theater || theater.runId !== runId) return;
        delete stage.dataset.hitStop;
        for (const animation of paused) { try { animation.play(); } catch { /* cancelled */ } }
        impact();
      };
      if (typeof theater.clock.animate === "function") {
        const hold = theater.clock.animate([{ visibility: "visible" }, { visibility: "visible" }], { duration: T.hitStop });
        theater.timers.add(hold);
        hold.finished.then(() => { theater?.timers.delete(hold); resume(); }, () => theater?.timers.delete(hold));
      } else later(T.hitStop, resume);
    }
    function impact() {
      const to = dummyPoint();
      playCeremonySound("impact", doc);
      const core = spawn("cm-showcase__impact", to.x, to.y);
      animate(core, [{ opacity: 1, transform: "translate(-50%, -50%) scale(0.3)" }, { opacity: 0.9, offset: 0.3, transform: "translate(-50%, -50%) scale(1)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.6)" }], { duration: 300, easing: "ease-out" });
      playShowcaseStyle("impact", payload.look.style, styleContext());
      // The move's own piece (refinement pass 5): the same baked contact as in battle (the Dex keeps
      // its own impact flash), so the Dex shows each move as it lands in a fight.
      const choreo = typeof moveVfxChoreography === "function" ? moveVfxChoreography(payload.move?.recordIndex) : null;
      if (choreo?.contact && typeof playShowcaseBakedPiece === "function") {
        const body = point(dummy.body, 1), palette = BATTLE_FX_PALETTES[payload.look.palette] ?? BATTLE_FX_PALETTES.neutral;
        // sized to the stage, not the dummy's thin post: a fighter is about a quarter of the stage wide
        const width = Math.max(110, stage.getBoundingClientRect().width * 0.3), groundY = body.top + body.h;
        playShowcaseBakedPiece({ doc, layer: fx, name: showcasePieceLook(choreo.contact), palette, x: to.x, y: to.y, groundY, width, scale: choreo.contact.scale ?? 1 });
      }
      const carried = SHOWCASE_CARRIER_STYLES.includes(payload.look.style) || SHOWCASE_STREAM_STYLES[payload.look.style];
      if (!carried) playCell("body", to.x, to.y);
      playCell("hit", to.x, to.y);
      later(90, () => playCell("extra", to.x, to.y, null, { scale: cellScale() * 1.1 }));
      if (payload.look.accent) playCell(payload.look.accent, to.x, to.y, null, { hue: 0 });
      // The struck body keeps the element a moment: embers, rime, sparks, bubbles.
      if (payload.look.overlay) for (let i = 0; i < 2; i++) later(i * 300, () => playCell(payload.look.overlay, to.x + (i ? 10 : -8), to.y - 6, null, { hue: 0, duration: 420, scale: cellScale() * 0.8 }));
      // A four-second ground mark under the dummy.
      const groundAt = point(dummy.body, 1);
      const mark = node(doc, "i", "cm-showcase__decal");
      mark.dataset.decal = payload.look.decal;
      mark.style.left = `${Math.round(groundAt.x)}px`;
      mark.style.top = `${Math.round(groundAt.top + groundAt.h - 6)}px`;
      backdrop.append(mark);
      animate(mark, [{ opacity: 0 }, { opacity: 1, offset: 0.03 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 4000, easing: "linear" });
      for (let i = 0; i < (full ? 6 : 0); i++) {
        const spark = spawn("cm-showcase__spark", to.x, to.y);
        const angle = (Math.PI * 2 * i) / 6 + (i % 2) * 0.2, reach = 46 + (i % 3) * 16;
        animate(spark, [{ opacity: 1, transform: `translate(-50%, -50%) rotate(${angle}rad) translateX(0) scaleX(1)` },
          { opacity: 0, transform: `translate(-50%, -50%) rotate(${angle}rad) translateX(${reach}px) scaleX(0.3)` }],
          { duration: 360, easing: "cubic-bezier(.1,.7,.3,1)" });
      }
      // The dummy: white flash, element rim, knockback 11 px along the hit.
      animate(target, [{ filter: "brightness(3.2) saturate(0)" }, { offset: 0.35, filter: "brightness(1.6) drop-shadow(0 0 6px var(--jc-main))" },
        { filter: "brightness(1) drop-shadow(0 0 0 transparent)" }], { duration: 300 });
      if (full) {
        animate(dummy.body, [{ transform: "translateX(0)" }, { transform: "translateX(11px) rotate(4deg)", offset: 0.25 }, { transform: "translateX(0) rotate(0)" }],
          { duration: 300, easing: "cubic-bezier(.2,.8,.3,1)" });
        // The signature lens: 1.22x toward the hit for 260 ms, with the shake folded in.
        arena.style.transformOrigin = `${Math.round(to.x)}px ${Math.round(to.y)}px`;
        animate(arena, [{ transform: "translate(0,0) scale(1)" }, { transform: "translate(3px,-2px) scale(1.18)", offset: 0.2 },
          { transform: "translate(-2px,2px) scale(1.22)", offset: 0.4 }, { transform: "translate(1px,-1px) scale(1.12)", offset: 0.7 },
          { transform: "translate(0,0) scale(1)" }], { duration: 260, easing: "ease-out" });
      }
      // The move's catalog power, popped as a critical-style number on a parabola.
      const value = payload.encrypted ? "???" : String(payload.move?.power ?? "");
      if (value) {
        const number = spawn("cm-showcase__damage", to.x, to.top);
        number.dataset.critical = "true";
        number.append(node(doc, "i", "cm-showcase__star"), node(doc, "span", "cm-showcase__damage-value", value));
        number.setAttribute("aria-label", juicyText("preview.power", { value }));
        const arc = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8, x = 46 * t, y = -96 * t + 120 * t * t;
          arc.push({ offset: t, opacity: t > 0.85 ? 0 : 1, transform: `translate(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px) scale(${t < 0.12 ? 2 : 1.4})` });
        }
        animate(number, full ? arc : [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 900, easing: "linear" });
      }
    }
  }

  // --------------------------------------------------------------- buttons
  /** "Preview special" for a species; null when it has no signature move. */
  function specialButton({ speciesIndex, speciesId, name, move, encrypted = false, silhouette = false }) {
    if (disposed || !move) return null;
    const element = button(doc, "cm-showcase-cta cm-showcase-cta--special", `🎬 ${juicyText("preview.special")}`);
    element.dataset.showcase = "special";
    element.dataset.encrypted = String(Boolean(encrypted));
    ensureBankCells();
    element.addEventListener("click", () => {
      ensureBankCells();
      start("special", { title: encrypted ? `${juicyText("encrypted")} · ${move.name}` : `${name} · ${move.name}`,
        speciesIndex, speciesId, name, move, look: showcaseMoveLook(move.recordIndex), encrypted,
        portrait: encrypted && !silhouette ? null : juicyPortrait(speciesIndex), lockedNote: encrypted ? juicyText("locked.species") : null });
      theater.opener = element;
    });
    return element;
  }

  /** "Preview evolution" for one route of the shown species. */
  function evolutionButton({ from, to, encrypted = false, traits = null, special = null }) {
    if (disposed) return null;
    const element = button(doc, "cm-showcase-cta cm-showcase-cta--evolution", `✨ ${juicyText("preview.evolution")}`);
    element.dataset.showcase = "evolution";
    element.dataset.encrypted = String(Boolean(encrypted));
    element.addEventListener("click", () => {
      start("evolution", { title: `${from.name} → ${to.name || "？？？？"}`, from, to, traits: encrypted ? null : traits,
        special, encrypted, lockedNote: encrypted ? juicyText("locked.route") : null });
      theater.opener = element;
    });
    return element;
  }

  return Object.freeze({
    attachHero,
    specialButton,
    evolutionButton,
    close: closeTheater,
    /** Release the detail's viewers and stop any preview (the sandbox node is kept). */
    resetDetail() {
      for (const entry of heroes) entry.dispose();
      heroes.clear();
      closeTheater();
    },
    getDiagnostics: () => Object.freeze({ opens, specials, evolutions, heroes: [...heroes].map(entry => entry.state()),
      open: Boolean(theater && !theater.root.hidden), timers: theater?.timers.size ?? 0,
      animations: theater?.stage.getAnimations?.({ subtree: true }).length ?? 0, sandboxNodes: theater ? 1 : 0 }),
    dispose() {
      if (disposed) return;
      for (const entry of heroes) entry.dispose();
      heroes.clear();
      if (theater) { clearStage(); theater.root.remove(); theater = null; }
      bankCells?.dispose();
      bankCells = null;
      cellsReady = false;
      disposed = true;
    }
  });
}
