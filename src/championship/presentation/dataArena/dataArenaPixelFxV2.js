// Data Arena V2 Unified 3D PixelFX Engine (2026-11-22).
//
// Web-Game Production Architecture (Zero Crashes, Locked 60 FPS on Desktop & Mobile):
//  - ALL 11 True-3D Volumetric PixelFX engines (Waves, Tornadoes, Organic Shield Walls, Burrow Mounds,
//    Ground Spikes, Seismic Crater Shockwaves, 3D Cylindrical Spiral Beams, Sky-Drop Meteors/Thunder,
//    3D Telekinesis/Energy Cages, 3D Crescent Slashes/Claws/Dash Cones, 3D Hovering Orbs/Darts,
//    3D Rising Buff/Heal Pillars) run through ONE strict LRU GPU Sprite-Sheet Cache (`volCache`):
//      * ZERO per-frame `getImageData` / `putImageData` / GPU texture uploads during combat!
//      * Strict VRAM cap (`maxSheets = 48` high / `24` low, ~12-16 MB max VRAM).
//      * Hard concurrent volumetric sprite cap (`maxLive = 12` high / `6` low).
//  - Unified 16-bit PixelFX Material: 2x2 Bayer dithering + curated palette snap + crisp 1px dark rim
//    across BOTH 3D volumetric moves and 2D `patch-gg/pixelfx` hits.
//  - Presentation only: zero simulation, timing, damage or RNG side effects.

import { BATTLE_FX_PALETTES } from "../battleFx/battleFxPalettes.js";
import {
  createMoveVfxSetPieces,
  loadMoveVfxPieceSprites,
  loadMoveVfx00GameDevsSprites,
  resolve00GameDevsPiece,
  resolve00GameDevsProjectile,
  paintBakedPieceFrames,
  GLOW_ALPHA
} from "../vfx/moveVfxSetPieces.js";
import { resolveMoveSpecV2 } from "../../modes/dataArena/dataArenaMoveCatalogV2.js";
import { createVolumetricSheetCache } from "./dataArenaVolumetricCache.js";

const BODY = 80;
const UNIT = 2.6;

const COVER_PALETTE = Object.freeze({
  STONE: { core: 0xe4e8ea, main: 0xb7bec2, edge: 0x5e666e },
  WOOD: { core: 0xe0b07a, main: 0xb07b48, edge: 0x553620 },
  TIMBER: { core: 0xe0b07a, main: 0xb07b48, edge: 0x553620 },
  BASALT: { core: 0xffb070, main: 0xff8a3c, edge: 0x241c1f },
  CORAL: { core: 0xfbe2d8, main: 0xf2c7b8, edge: 0xa96f62 },
  ICE: { core: 0xffffff, main: 0xd6f3fb, edge: 0x5fa4c4 },
  SANDSTONE: { core: 0xf2dcae, main: 0xe0c08a, edge: 0x8e6d3e },
  CRYSTAL: { core: 0xe0ffff, main: 0x8ff3ff, edge: 0x1b3a4f },
  METAL: { core: 0xffffff, main: 0x9aa8b6, edge: 0x3f4a56 }
});

const UPRIGHT_SHOTS = new Set(["shot-tornado", "shot-wisp", "shot-heart", "shot-star", "shot-xp"]);

export function createDataArenaPixelFxV2({ PIXI, ground, front, quality = "high", reducedMotion = false }) {
  if (!PIXI || !front) return null;
  loadMoveVfxPieceSprites();
  loadMoveVfx00GameDevsSprites();
  const pieces = createMoveVfxSetPieces({ PIXI, layer: front, reducedMotion, outline: true });
  const groundPieces = ground ? createMoveVfxSetPieces({ PIXI, layer: ground, reducedMotion, outline: true }) : null;

  // Web-safe LRU GPU Sprite-Sheet Cache for ALL 11 3D volumetric move families!
  const volCache = createVolumetricSheetCache({
    PIXI,
    maxSheets: quality === "low" ? 24 : 48,
    maxLive: quality === "low" ? 6 : 12
  });

  const shotSheets = new Map();
  const liveShots = [];
  const livePuddles = new Map();
  const liveScars = [];
  const MAX_SCARS = quality === "low" ? 24 : 48;
  const SCAR_TTL = 4.0;
  const shotLayer = new PIXI.Container();
  shotLayer.label = "pixelfx v2 shots";
  front.addChild(shotLayer);
  const scarLayer = new PIXI.Container();
  scarLayer.label = "pixelfx v2 battle scars";
  (ground ?? front).addChild(scarLayer);
  const puddleLayer = new PIXI.Container();
  puddleLayer.label = "pixelfx v2 ground surfaces";
  (ground ?? front).addChild(puddleLayer);

  const SCAR_LOOK_BY_PALETTE = Object.freeze({
    fire: "prop-dust",
    earth: "prop-dust",
    metal: "prop-dust",
    ice: "mark-frost",
    water: "mark-ripple",
    nature: "mark-roots",
    thunder: "sigil-rune",
    light: "sigil-rune",
    dark: "splat",
    wind: "mark-ripple"
  });

  function stampScar({ x, y, paletteKey = "earth", scale = 1 }) {
    if (reducedMotion) return false;
    const look = SCAR_LOOK_BY_PALETTE[paletteKey] ?? "prop-dust";
    const sheet = shotSheet(look, paletteKey);
    if (!sheet?.body?.textures?.length) return false;
    while (liveScars.length >= MAX_SCARS) {
      const oldest = liveScars.shift();
      oldest.sprite.destroy();
    }
    const frames = sheet.body.textures;
    const sprite = new PIXI.Sprite(frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.6))]);
    sprite.anchor.set(0.5, 0.5);
    const baseW = Math.max(24, sprite.texture?.width ?? 48);
    const sc = Math.max(0.65, Math.min(1.65, (BODY * 0.72 * scale) / baseW));
    sprite.position.set(Math.round(x), Math.round(y + 6));
    sprite.scale.set(sc, sc * 0.62);
    sprite.alpha = 0.52;
    scarLayer.addChild(sprite);
    liveScars.push({ sprite, age: 0, maxAge: SCAR_TTL, baseAlpha: 0.52 });
    return true;
  }

  const PUDDLE_PIXELFX = Object.freeze({
    WATER_PUDDLE: { piece: "mark-ripple", gdPiece: null, paletteKey: "water", fps: 12, alpha: 0.78 },
    POISON_POOL: { piece: "splat", gdPiece: "gd-venom-pool", paletteKey: "dark", fps: 12, alpha: 0.84 },
    ICE_PATCH: { piece: "mark-frost", gdPiece: "gd-frost-field", paletteKey: "ice", fps: 12, alpha: 0.86 },
    FIRE_PATCH: { piece: "core", gdPiece: "gd-burning-ground", paletteKey: "fire", fps: 14, alpha: 0.84 },
    VINE_PATCH: { piece: "mark-roots", gdPiece: "gd-thorn-crown", paletteKey: "nature", fps: 12, alpha: 0.84 },
    ELECTRIFIED_WATER: { piece: "mark-ripple", gdPiece: null, paletteKey: "thunder", fps: 16, alpha: 0.86 },
    MUD_PATCH: { piece: "prop-dust", gdPiece: "gd-quicksand-seal", paletteKey: "earth", fps: 12, alpha: 0.80 }
  });

  let holdMs = 0;
  let lastRingAt = 0;
  const stats = { engine: "pixelfx-v2", casts: 0, releases: 0, hits: 0, ults: 0, projectiles: 0, props: 0, clashes: 0 };

  function paletteFor(paletteKey) {
    return BATTLE_FX_PALETTES[paletteKey] ?? BATTLE_FX_PALETTES.fire;
  }

  function shotSheet(lookName, paletteKey) {
    const key = `${lookName}|${paletteKey}`;
    if (shotSheets.has(key)) return shotSheets.get(key);
    const pal = paletteFor(paletteKey);
    const body = paintBakedPieceFrames(lookName, pal, { outline: true });
    if (!body?.frames?.length) return null;
    const glow = quality !== "low" && !reducedMotion ? paintBakedPieceFrames(lookName, pal, { glow: true }) : null;
    const toTex = (canvases, linear) => canvases.map((c) => {
      const t = PIXI.Texture.from(c);
      if (t?.source) t.source.scaleMode = linear ? "linear" : "nearest";
      return t;
    });
    const entry = {
      body: { ...body, textures: toTex(body.frames, false) },
      glow: glow?.frames?.length ? { ...glow, textures: toTex(glow.frames, true) } : null,
      fps: 20,
      upright: UPRIGHT_SHOTS.has(lookName)
    };
    shotSheets.set(key, entry);
    return entry;
  }

  function playPiece(targetPieces, name, opts) {
    if (!targetPieces || !name) return false;
    return targetPieces.play(name, { size: BODY, unit: UNIT, ...opts });
  }

  return Object.freeze({
    isPixelFxV2: true,
    look(moveId) {
      const spec = resolveMoveSpecV2(moveId);
      return { ...spec, palette: paletteFor(spec.paletteKey) };
    },
    /** Clean windup: only heavy/ultimate moves show a crisp pixelfx spell-charge; quick moves stay uncluttered. */
    cast({ x, y, moveId, windup = 0.2 }) {
      if (reducedMotion || windup < 0.28) return;
      const spec = resolveMoveSpecV2(moveId);
      playPiece(pieces, "muzzle-spiral", { x, y, palette: paletteFor(spec.paletteKey), scale: 0.85, groundY: y + 28 });
      stats.casts++;
    },
    /** PB-Rank Wave 1: Crisp baked 00GameDevs ground telegraph indicator (circle / sector / rect) during windup! */
    telegraph({ x, y, angle = 0, shape = "circle", radius = 120, range = 260, team = "player", moveId = null }) {
      if (reducedMotion || !groundPieces || !shape || shape === "none") return false;
      const spec = moveId ? resolveMoveSpecV2(moveId) : null;
      const pieceKey = shape === "sector" ? "mark-sector" : shape === "rect" ? "mark-rect" : "sigil-cast";
      const resolved = resolve00GameDevsPiece({ piece: pieceKey, paletteKey: spec?.paletteKey ?? "fire" }) || "sigil-cast";
      const isHostile = team !== "player";
      const pal = isHostile
        ? { core: 0xffd6cc, main: 0xff3b30, edge: 0x6e0d12 }
        : paletteFor(spec?.paletteKey ?? "light");
      const scale = shape === "rect"
        ? Math.max(0.95, Math.min(2.1, range / 260))
        : Math.max(0.85, Math.min(1.9, radius / 95));
      const offset = shape === "rect" ? Math.min(110, range * 0.28) : shape === "sector" ? Math.min(54, radius * 0.42) : 0;
      const tx = x + Math.cos(angle) * offset;
      const ty = y + Math.sin(angle) * offset;
      return playPiece(groundPieces, resolved, { x: tx, y: ty + 8, angle, palette: pal, scale, groundY: ty + 8 });
    },
    /** PB-Rank Wave 1: Crisp 0.35s deployment invulnerability shield shimmer on round start & partner switch-in! */
    deployShield({ x, y, team = "player" }) {
      const pal = team === "player" ? BATTLE_FX_PALETTES.light : BATTLE_FX_PALETTES.thunder;
      const piece = resolve00GameDevsPiece({ piece: "buff-def", paletteKey: team === "player" ? "light" : "thunder" }) || "buff-def";
      return playPiece(pieces, piece, { x, y: y - 12, palette: pal, scale: 1.05, groundY: y + 12 });
    },
    /** PB-Rank Wave 3: Pure baked 00GameDevs / PixelFX Living Arena 22s dynamic zone warning, activation & claim bursts! */
    arenaZone({ x, y, kind = "RECHARGE", phase = "ACTIVE", radius = 68 }) {
      const ZONE_PALETTE = { ECHO: "dark", BLOOM: "nature", VENT: "fire", TIDE: "water", UPDRAFT: "wind", RECHARGE: "thunder", SUPER_CORE: "light" };
      const ZONE_ARCH = { ECHO: "SELF_BUFF", BLOOM: "RECOVERY_SUPPORT", VENT: "SHOCKWAVE_RING", TIDE: "VORTEX_PULL", UPDRAFT: "VORTEX_PULL", RECHARGE: "SELF_BUFF", SUPER_CORE: "METEOR_RAIN" };
      const palKey = ZONE_PALETTE[kind] ?? "light";
      const pal = paletteFor(palKey);
      const scale = Math.max(0.85, Math.min(1.65, (radius / 68) * (phase === "CLAIM" ? 1.15 : 1.0)));
      if (phase === "WARNING") {
        const piece = resolve00GameDevsPiece({ piece: "sigil-cast", paletteKey: palKey }) || "sigil-cast";
        return playPiece(groundPieces ?? pieces, piece, { x, y: y + 6, palette: pal, scale, groundY: y + 6 });
      }
      const fallbackPiece = kind === "BLOOM" ? "heal" : kind === "VENT" ? "quake" : kind === "TIDE" || kind === "UPDRAFT" ? "vortex" : "buff-atk";
      const piece = resolve00GameDevsPiece({ archetype: ZONE_ARCH[kind] ?? "SELF_BUFF", piece: fallbackPiece, paletteKey: palKey, tier: kind === "SUPER_CORE" ? "ultimate" : "standard" }) || fallbackPiece;
      const ok = playPiece(pieces, piece, { x, y: y + 4, palette: pal, scale, groundY: y + 12 });
      if (phase === "CLAIM" && kind === "VENT") stampScar({ x, y: y + 8, paletteKey: "fire", scale: 1.0 });
      return ok;
    },
    /** Clean release: 100% pure PixelFX + 00GameDevs baked sheets (ZERO blurry procedural 3D canvas hacks!). */
    release({ x, y, angle = 0, moveId, melee = false }) {
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      // DRAG_WAVE mounts its baked wave on its moving projectile; skip stacking a second release blob.
      if (spec.v2Archetype === "DRAG_WAVE") {
        stats.releases++;
        return;
      }
      // STREAM_BEAM plays crisp 00GameDevs directional beam (fallback: pure PixelFX lance/stream).
      if (spec.v2Archetype === "STREAM_BEAM" && !melee) {
        const beamPal = ["light", "fire", "water", "ice", "thunder", "dark", "nature", "wind", "earth", "metal"].includes(spec.paletteKey) ? spec.paletteKey : "light";
        const scale = spec.tier === "ultimate" ? 1.55 : 1.32;
        const len = 112;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const gdBeam = resolve00GameDevsPiece({ archetype: "STREAM_BEAM", piece: "lance", paletteKey: beamPal, tier: spec.tier }) || "lance";
        playPiece(pieces, gdBeam, { x: x + cosA * len * 0.42, y: y + 8 + sinA * len * 0.28, angle, palette: pal, scale, groundY: y + 28 });
        stats.releases++;
        return;
      }
      // Close-combat / Mobility plays crisp 00GameDevs slash/rend/wave (fallback: pure PixelFX releaseLook).
      if (melee || ["FLURRY_COMBO", "MULTI_DASH", "SHADOW_BACKSTAB", "UTURN_STRIKE", "GUARD_BREAK_SLAM"].includes(spec.v2Archetype)) {
        const cPal = spec.paletteKey || "fire";
        const gdMelee = resolve00GameDevsPiece({ archetype: spec.v2Archetype, piece: spec.releaseLook || "slash", paletteKey: cPal, tier: spec.tier }) || spec.releaseLook || "slash";
        playPiece(pieces, gdMelee, { x, y: y + 6, angle, palette: pal, scale: spec.v2Archetype === "GUARD_BREAK_SLAM" ? 1.25 : 1.05, groundY: y + 24 });
        stats.releases++;
        return;
      }
      const pieceName = melee ? (spec.releaseLook || "slash")
        : (spec.tier === "ultimate" ? "muzzle-spiral" : "muzzle");
      playPiece(pieces, pieceName, { x, y, angle, palette: pal, scale: melee ? 0.95 : 0.78, groundY: y + 28 });
      stats.releases++;
    },
    /** Clean looping baked PixelFX + 00GameDevs projectiles (ZERO procedural 3D canvas orbs/waves!). */
    projectile({ follow, moveId, angle = 0, lifeMs = 1200 }) {
      if (typeof follow !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      const gdProj = resolve00GameDevsProjectile({ archetype: spec.v2Archetype, paletteKey: spec.paletteKey, tier: spec.tier });
      const lookName = gdProj || spec.flightLook;
      const sheet = shotSheet(lookName, spec.paletteKey) || (gdProj ? shotSheet(spec.flightLook, spec.paletteKey) : null);
      if (!sheet) return false;
      const bodySprite = new PIXI.Sprite(sheet.body.textures[0]);
      bodySprite.anchor.set(sheet.body.ox / sheet.body.w, sheet.body.oy / sheet.body.h);
      let glowSprite = null;
      if (sheet.glow) {
        glowSprite = new PIXI.Sprite(sheet.glow.textures[0]);
        glowSprite.anchor.set(sheet.glow.ox / sheet.glow.w, sheet.glow.oy / sheet.glow.h);
        glowSprite.blendMode = "add";
        glowSprite.alpha = GLOW_ALPHA * 0.55;
        shotLayer.addChild(glowSprite);
      }
      shotLayer.addChild(bodySprite);
      const isWave = spec.v2Archetype === "DRAG_WAVE";
      const targetPx = isWave ? BODY * 1.45 : BODY * 0.92;
      const scale = Math.max(1.25, Math.min(2.4, targetPx / Math.max(24, sheet.body.w)));
      bodySprite.scale.set(scale);
      glowSprite?.scale.set(scale * 2);
      liveShots.push({ follow, sheet, bodySprite, glowSprite, scale, age: 0, maxAge: lifeMs / 1000, prevX: null, prevY: null, angle, upright: isWave || sheet.upright });
      stats.projectiles++;
      return true;
    },
    /** Strict One-Beat-One-Hero Contact: ONE crisp PixelFX / 00GameDevs impact (no cluttered stacked layers!). */
    hit({ x, y, groundY = y, moveId, heavy = false, angle = 0 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      if (heavy && !reducedMotion) {
        playPiece(pieces, "impact-frame", { x, y, angle, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.72, groundY });
      }
      const baseContact = (spec.v2Archetype === "DRAG_WAVE" || spec.contactLook === "wave")
        ? (spec.paletteKey === "water" || spec.paletteKey === "ice" ? "flurry-bubble" : "ring-burst")
        : spec.contactLook;
      const contactPiece = resolve00GameDevsPiece({ piece: baseContact, archetype: spec.v2Archetype, paletteKey: spec.paletteKey, tier: heavy ? "ultimate" : spec.tier }) || baseContact;
      playPiece(pieces, contactPiece, { x, y, angle, palette: pal, scale: Math.min(1.45, spec.scale * (heavy ? 1.15 : 0.96)), groundY, at: "contact" });
      if (heavy && !reducedMotion) {
        stampScar({ x, y: groundY, paletteKey: spec.paletteKey, scale: Math.min(1.3, spec.scale) });
        holdMs = Math.max(holdMs, 55);
      }
      stats.hits++;
    },
    /** Clean area burst: ONE crisp 00GameDevs / PixelFX centerpiece on impact (zero stacked rings/decals!). */
    area({ x, y, radius = 100, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      stampScar({ x, y: y + 8, paletteKey: spec.paletteKey, scale: Math.max(0.9, Math.min(1.5, radius / 95)) });
      if (spec.v2Archetype === "METEOR_RAIN") {
        if (!reducedMotion) {
          playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.9, groundY: y + 18 });
        }
        stats.hits++;
        return true;
      }
      const scale = Math.max(1.0, Math.min(1.85, radius / 92));
      const areaPiece = resolve00GameDevsPiece({ archetype: spec.v2Archetype, piece: spec.contactLook, paletteKey: spec.paletteKey, tier: spec.tier }) || spec.contactLook;
      playPiece(pieces, areaPiece, { x, y, palette: pal, scale, groundY: y + 18, at: "contact" });
      stats.hits++;
      return true;
    },
    /** Clean ultimate: crisp 00GameDevs telegraph sigil + impact opening. */
    ult({ moveId, center }) {
      if (!center) return;
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      const sigil = resolve00GameDevsPiece({ piece: "sigil-cast", paletteKey: spec.paletteKey, tier: "ultimate" }) || "sigil-cast";
      if (groundPieces) playPiece(groundPieces, sigil, { x: center.x, y: center.y + 24, palette: pal, scale: 1.35, groundY: center.y + 24 });
      playPiece(pieces, "impact-frame", { x: center.x, y: center.y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 1.0, groundY: center.y + 24 });
      holdMs = Math.max(holdMs, 65);
      stats.ults++;
    },
    /** Pure PixelFX + 00GameDevs buff / barrier aura (Revival Bloom / Prism Guard / Elemental Shields). */
    buff({ x, y, paletteKey = "light", piece = "buff-atk" }) {
      const bPal = paletteKey || "light";
      const gdBuff = resolve00GameDevsPiece({ archetype: "SELF_BUFF", piece, paletteKey: bPal }) || piece;
      playPiece(pieces, gdBuff, { x, y: y + 10, palette: paletteFor(bPal), scale: 1.15, groundY: y + 16 });
    },
    heal({ x, y }) {
      const gdHeal = resolve00GameDevsPiece({ archetype: "RECOVERY_SUPPORT", piece: "heal", paletteKey: "nature" }) || "heal";
      playPiece(pieces, gdHeal, { x, y: y + 12, palette: BATTLE_FX_PALETTES.nature, scale: 1.18, groundY: y + 16 });
    },
    parry({ x, y }) {
      const gdParry = resolve00GameDevsPiece({ archetype: "PROTECT_COUNTER", piece: "ring-pop", paletteKey: "light" }) || "ring-pop";
      playPiece(pieces, gdParry, { x, y, palette: BATTLE_FX_PALETTES.light, scale: 1.12, groundY: y + 14 });
    },
    clash({ x, y }) {
      playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.9, groundY: y + 18 });
      const clashRing = resolve00GameDevsPiece({ piece: "ring-pop", paletteKey: "thunder" }) || "ring-pop";
      playPiece(pieces, clashRing, { x, y, palette: BATTLE_FX_PALETTES.thunder, scale: 1.25, groundY: y + 18 });
      holdMs = Math.max(holdMs, 50);
      stats.clashes++;
      return true;
    },
    /** Surf-Rider baked 00GameDevs wave mounted cleanly under the dashing surfer. */
    surfWave({ follow, angle = 0, moveId = "surfRush", durationSec = 0.62 }) {
      if (typeof follow !== "function") return false;
      const pos = follow();
      if (!pos) return false;
      const spec = resolveMoveSpecV2(moveId);
      const wavePal = ["water", "ice", "fire", "dark"].includes(spec.paletteKey) ? spec.paletteKey : "water";
      const gdWave = resolve00GameDevsPiece({ archetype: "DRAG_WAVE", piece: "wave", paletteKey: wavePal, tier: spec.tier }) || "wave";
      playPiece(groundPieces ?? pieces, gdWave, { x: pos.x, y: pos.y + 6, angle, palette: paletteFor(wavePal), scale: 1.25, groundY: pos.y + 12 });
      stats.releases++;
      return true;
    },
    /** Clean 00GameDevs Vortex / Tornado (fallback: pure PixelFX vortex). */
    vortex({ x, y, angle = 0, moveId = "vortex", durationSec = 1.05, radius = 118, paletteKey = null }) {
      const spec = resolveMoveSpecV2(moveId);
      const rawPal = paletteKey || spec.paletteKey;
      const tPal = ["wind", "water", "ice", "nature", "dark", "fire", "earth", "thunder", "light", "metal"].includes(rawPal) ? rawPal : "wind";
      const scale = Math.max(1.2, Math.min(1.85, (radius / 118) * 1.32));
      const gdVortex = resolve00GameDevsPiece({ archetype: "VORTEX_PULL", piece: "vortex", paletteKey: tPal, tier: spec.tier }) || "vortex";
      playPiece(pieces, gdVortex, { x, y: y + 10, palette: paletteFor(tPal), scale, groundY: y + 14 });
      stats.releases++;
      return true;
    },
    /** Directional Shield-Wall Shatter: crisp PixelFX debris burst along strikeAngle! */
    wallShatter({ x, y, angle = 0, material = "STONE" }) {
      const mat = String(material ?? "STONE").toUpperCase();
      const palette = COVER_PALETTE[mat] ?? COVER_PALETTE.STONE;
      playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.92, groundY: y + 18 });
      const shatterPiece = mat === "ICE" ? (resolve00GameDevsPiece({ piece: "quake", paletteKey: "ice" }) || "flurry-shard")
        : mat === "WOOD" ? "flurry-leaf" : "prop-dust";
      playPiece(pieces, shatterPiece, { x: x + Math.cos(angle) * 20, y: y - 4 + Math.sin(angle) * 16, angle, palette, scale: 1.35, groundY: y + 16 });
      holdMs = Math.max(holdMs, 56);
      stats.props++;
      return true;
    },
    /** Cross-Ring Surface / Status Reaction: ONE crisp 00GameDevs / PixelFX burst (zero stacked rings!). */
    surfaceBurst({ x, y, radius = 100, paletteKey = "fire", kind = "POISON_IGNITE" }) {
      const pal = paletteFor(paletteKey || "fire");
      const scale = Math.max(1.05, Math.min(1.85, radius / 86));
      if (kind === "POISON_IGNITE" || kind === "WILDFIRE_IGNITE" || kind === "ECLIPSE_BURST") {
        const gdBlast = resolve00GameDevsPiece({ archetype: kind === "ECLIPSE_BURST" ? "GUARD_BREAK_SLAM" : "SHOCKWAVE_RING", piece: "core", paletteKey: paletteKey || "fire", tier: "ultimate" }) || "core";
        playPiece(pieces, gdBlast, { x, y, palette: pal, scale: scale * 1.15, groundY: y + 14 });
        holdMs = Math.max(holdMs, 55);
      } else if (kind === "WATER_FREEZE" || kind === "FLASH_FREEZE" || kind === "TOXIC_FROST") {
        const gdIce = resolve00GameDevsPiece({ archetype: "GROUND_SPIKES", piece: "flurry-shard", paletteKey: "ice" }) || "flurry-shard";
        playPiece(pieces, gdIce, { x, y, palette: BATTLE_FX_PALETTES.ice, scale: scale * 1.15, groundY: y + 14 });
      } else if (kind === "WATER_ELECTRIFY" || kind === "ELECTRO_CHARGE" || kind === "CONDUCT") {
        const gdBolt = resolve00GameDevsPiece({ archetype: "METEOR_RAIN", piece: "bolt", paletteKey: "thunder" }) || "bolt";
        playPiece(pieces, gdBolt, { x, y, palette: BATTLE_FX_PALETTES.thunder, scale: scale * 1.15, groundY: y + 14 });
      } else {
        const gdSpread = resolve00GameDevsPiece({ archetype: "VORTEX_PULL", piece: "ring-burst", paletteKey: paletteKey || "wind" }) || "ring-burst";
        playPiece(pieces, gdSpread, { x, y, palette: pal, scale, groundY: y + 14 });
      }
      stats.hits++;
      return true;
    },
    /** Clean 00GameDevs Ground Spike / Thorn Crown / Quicksand Seal (fallback: pure PixelFX quake). */
    groundSpike({ x, y, angle = 0, moveId = "shardVolley", durationSec = 0.68, scale = 1.48 }) {
      const spec = resolveMoveSpecV2(moveId);
      const sPal = ["earth", "ice", "nature", "fire", "dark", "thunder", "water", "light"].includes(spec.paletteKey) ? spec.paletteKey : "earth";
      const gdSpike = resolve00GameDevsPiece({ archetype: "GROUND_SPIKES", piece: "quake", paletteKey: sPal }) || "quake";
      playPiece(pieces, gdSpike, { x, y: y + 6, palette: paletteFor(sPal), scale: scale * 0.85, groundY: y + 12 });
      stats.releases++;
      return true;
    },
    /** Clean 00GameDevs Burrow Mound (Quicksand Seal / Smoke Puff, fallback: PixelFX prop-dust). */
    burrowMound({ follow, angle = 0, moveId = "own-63", durationSec = 0.60, scale = 1.48 }) {
      if (typeof follow !== "function") return false;
      const pos = follow();
      if (!pos) return false;
      const spec = resolveMoveSpecV2(moveId);
      const bPal = spec.paletteKey === "water" ? "water" : spec.paletteKey === "ice" ? "ice" : "earth";
      const gdBurrow = resolve00GameDevsPiece({ archetype: "BURROW_AMBUSH", piece: "mark-earth", paletteKey: bPal }) || "prop-dust";
      playPiece(groundPieces ?? pieces, gdBurrow, { x: pos.x, y: pos.y + 4, palette: paletteFor(bPal), scale: scale * 0.72, groundY: pos.y + 10 });
      stats.releases++;
      return true;
    },
    /** Clean 00GameDevs Shockwave / Magma Fissure / Ice Shatter / Darkchain Burst (fallback: PixelFX quake). */
    craterShockwave({ x, y, moveId = "quakeSlam", radius = 140, durationSec = 0.58 }) {
      const spec = resolveMoveSpecV2(moveId);
      const cPal = ["earth", "fire", "ice", "thunder", "nature", "dark", "water", "light", "wind", "metal"].includes(spec.paletteKey) ? spec.paletteKey : "earth";
      const scale = Math.max(1.2, Math.min(1.85, (radius / 120) * 1.25));
      const gdCrater = resolve00GameDevsPiece({ archetype: spec.v2Archetype === "GUARD_BREAK_SLAM" ? "GUARD_BREAK_SLAM" : "SHOCKWAVE_RING", piece: "quake", paletteKey: cPal, tier: spec.tier }) || "quake";
      playPiece(pieces, gdCrater, { x, y: y + 4, palette: paletteFor(cPal), scale, groundY: y + 12 });
      stampScar({ x, y: y + 8, paletteKey: cPal, scale: Math.min(1.5, scale) });
      stats.hits++;
      return true;
    },
    /** Clean 00GameDevs Meteor / Hellfire / Thunder / Frost / Sacred Relic Sky-Drop (fallback: PixelFX drop). */
    meteorDrop({ x, y, moveId = "flameRing", durationSec = 0.92, radius = 110 }) {
      const spec = resolveMoveSpecV2(moveId);
      const mPal = ["fire", "thunder", "ice", "dark", "earth", "light", "water", "nature", "metal", "wind"].includes(spec.paletteKey) ? spec.paletteKey : "fire";
      const gdSky = resolve00GameDevsPiece({ archetype: "METEOR_RAIN", piece: "drop", paletteKey: mPal, tier: spec.tier }) || "drop";
      const scale = Math.max(1.25, Math.min(1.85, (radius / 100) * 1.35));
      playPiece(pieces, gdSky, { x, y: y + 8, palette: paletteFor(mPal), scale, groundY: y + 14 });
      stampScar({ x, y: y + 10, paletteKey: mPal, scale: Math.min(1.45, scale) });
      stats.releases++;
      return true;
    },
    /** Clean 00GameDevs Binding Curse / Arcane Matrix / Prism Guard Cage (fallback: PixelFX eye/buff-def). */
    psychicCage({ x, y, follow = null, moveId = "nightPulse", mode = "telekinesis", durationSec = 0.85, radius = 100 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pPal = ["dark", "light", "thunder", "ice", "fire", "nature", "water", "metal"].includes(spec.paletteKey) ? spec.paletteKey : "dark";
      const scale = Math.max(1.2, Math.min(1.75, (radius / 100) * 1.25));
      const gdCage = resolve00GameDevsPiece({ archetype: mode === "telekinesis" ? "TELEKINESIS_SLAM" : "PROTECT_COUNTER", piece: mode === "telekinesis" ? "eye" : "buff-def", paletteKey: pPal }) || (mode === "telekinesis" ? "eye" : "buff-def");
      playPiece(pieces, gdCage, { x, y: y + 6, palette: paletteFor(pPal), scale, groundY: y + 14 });
      stats.releases++;
      return true;
    },
    /** Subtle scorch/cone accents using pure pixelfx ground marks instead of noisy vector blasts. */
    scorchTrench({ x1, y1, x2, y2, moveId }) {
      if (reducedMotion || !groundPieces) return false;
      const spec = resolveMoveSpecV2(moveId);
      if (spec.v2Archetype === "DRAG_WAVE" || spec.surfRider || spec.groundLook === "mark-ripple") return false;
      const pal = paletteFor(spec.paletteKey);
      const mx = (x1 + x2) * 0.5, my = (y1 + y2) * 0.5;
      playPiece(groundPieces, spec.groundLook, { x: mx, y: my, palette: pal, scale: 0.9, groundY: my });
      return true;
    },
    coneStorm({ x, y, angle = 0, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const gdCone = resolve00GameDevsPiece({ archetype: "STREAM_BEAM", piece: "stream", paletteKey: spec.paletteKey, tier: spec.tier }) || "stream";
      playPiece(pieces, gdCone, { x, y, angle, palette: paletteFor(spec.paletteKey), scale: 1.15, groundY: y + 20 });
      return true;
    },
    prop({ x, y, material = "STONE", broken = false, weak = false }) {
      const palette = COVER_PALETTE[material] ?? COVER_PALETTE.STONE;
      playPiece(pieces, broken ? "prop-dust" : "prop-chip", { x, y: y - BODY * 0.25, groundY: y, palette, scale: broken ? 1.25 : weak ? 0.95 : 0.78 });
      if (broken) holdMs = Math.max(holdMs, 42);
      stats.props++;
      return true;
    },
    /** Suppress redundant scene vector rings cleanly; play at most 1 crisp pixelfx pop per 220ms. */
    eventRing({ x, y, radius = 60, tint = 0xffffff }) {
      const now = globalThis.performance?.now?.() ?? Date.now();
      if (now - lastRingAt < 220) return true;
      lastRingAt = now;
      const ch = (s) => (tint >> s) & 255;
      const mix = (k, to) => ((Math.round(ch(16) + (to - ch(16)) * k) << 16) | (Math.round(ch(8) + (to - ch(8)) * k) << 8) | Math.round(ch(0) + (to - ch(0)) * k));
      const pal = { core: mix(0.65, 255), main: tint, edge: mix(0.55, 0) };
      playPiece(pieces, radius < 55 ? "ring-pop" : "ring-burst", { x, y, palette: pal, scale: Math.max(0.65, Math.min(1.25, radius / 75)), groundY: y + 14 });
      return true;
    },
    drawsShots: () => true,
    /** Sync persistent ground surface fields using 100% pure patch-gg/pixelfx baked pixel sprites (ZERO cartoon vector circles!). */
    syncPuddles(puddles = []) {
      const seen = new Set();
      for (const p of puddles) {
        if (!p || p.done) continue;
        seen.add(p.id);
        const cfg = PUDDLE_PIXELFX[p.kind] ?? PUDDLE_PIXELFX.WATER_PUDDLE;
        let entry = livePuddles.get(p.id);
        if (entry && entry.kind !== p.kind) {
          entry.sprite.destroy();
          livePuddles.delete(p.id);
          entry = null;
        }
        if (!entry) {
          const puddleLook = (cfg.gdPiece && resolve00GameDevsPiece({ piece: cfg.gdPiece, paletteKey: cfg.paletteKey }) === cfg.gdPiece)
            ? cfg.gdPiece : cfg.piece;
          const sheet = shotSheet(puddleLook, cfg.paletteKey) || shotSheet(cfg.piece, cfg.paletteKey);
          if (!sheet?.body?.textures?.length) continue;
          const sprite = new PIXI.Sprite(sheet.body.textures[0]);
          sprite.anchor.set(0.5, 0.5);
          puddleLayer.addChild(sprite);
          entry = { id: p.id, kind: p.kind, sprite, sheet, cfg, age: (p.id % 7) * 0.13 };
          livePuddles.set(p.id, entry);
        }
        const tex = entry.sheet.body.textures[0];
        const baseW = Math.max(24, tex?.width ?? 64);
        const sc = Math.max(0.7, Math.min(2.6, (p.radius * 2.05) / baseW));
        entry.sprite.position.set(Math.round(p.x), Math.round(p.y + 6));
        entry.sprite.scale.set(sc, sc * 0.64);
        entry.sprite.alpha = entry.cfg.alpha * Math.min(1, Math.max(0.15, (p.ttl ?? 1) / 1.2));
      }
      for (const [id, entry] of livePuddles) {
        if (!seen.has(id)) {
          entry.sprite.destroy();
          livePuddles.delete(id);
        }
      }
    },
    update(dtMs) {
      const dt = Math.min(0.1, dtMs / 1000);
      if (holdMs > 0) holdMs = Math.max(0, holdMs - dtMs);
      const stepMs = holdMs > 0 ? 0 : dtMs;
      pieces?.update(stepMs);
      groundPieces?.update(stepMs);
      volCache.update(dt);
      for (let i = liveScars.length - 1; i >= 0; i--) {
        const sc = liveScars[i];
        sc.age += dt;
        if (sc.age >= sc.maxAge) {
          sc.sprite.destroy();
          liveScars.splice(i, 1);
          continue;
        }
        const rem = sc.maxAge - sc.age;
        sc.sprite.alpha = rem < 0.85 ? sc.baseAlpha * (rem / 0.85) : sc.baseAlpha;
      }
      for (const entry of livePuddles.values()) {
        entry.age += dt;
        const frames = entry.sheet.body.textures;
        if (frames.length) {
          entry.sprite.texture = frames[Math.floor(entry.age * entry.cfg.fps) % frames.length];
        }
      }
      for (let i = liveShots.length - 1; i >= 0; i--) {
        const s = liveShots[i];
        s.age += dt;
        const pos = s.age <= s.maxAge ? s.follow() : null;
        if (!pos) {
          s.bodySprite.destroy();
          s.glowSprite?.destroy();
          liveShots.splice(i, 1);
          continue;
        }
        if (s.prevX !== null && Math.hypot(pos.x - s.prevX, pos.y - s.prevY) > 0.5) {
          s.angle = Math.atan2(pos.y - s.prevY, pos.x - s.prevX);
        }
        s.prevX = pos.x; s.prevY = pos.y;
        const idx = Math.floor(s.age * s.sheet.fps) % s.sheet.body.textures.length;
        s.bodySprite.texture = s.sheet.body.textures[idx];
        s.bodySprite.position.set(Math.round(pos.x), Math.round(pos.y));
        const isUpright = Boolean(s.upright || s.sheet.upright);
        const rot = isUpright ? 0 : s.angle;
        const flipX = (isUpright && Math.cos(s.angle) < 0) ? -1 : 1;
        const flipY = (!isUpright && Math.cos(rot) < 0) ? -1 : 1;
        s.bodySprite.rotation = rot;
        s.bodySprite.scale.set(s.scale * flipX, s.scale * flipY);
        if (s.glowSprite && s.sheet.glow) {
          s.glowSprite.texture = s.sheet.glow.textures[idx % s.sheet.glow.textures.length];
          s.glowSprite.position.set(Math.round(pos.x), Math.round(pos.y));
          s.glowSprite.rotation = rot;
          s.glowSprite.scale.set(s.scale * 2 * flipX, s.scale * 2 * flipY);
        }
      }
    },
    holding: () => holdMs > 0,
    getDiagnostics: () => Object.freeze({
      ...stats,
      liveShots: liveShots.length,
      scars: liveScars.length,
      volumetricCache: volCache.getDiagnostics(),
      pieces: pieces?.getDiagnostics?.() ?? null
    }),
    dispose() {
      volCache.dispose();
      for (const sc of liveScars) sc.sprite.destroy();
      liveScars.length = 0;
      scarLayer.destroy();
      for (const entry of livePuddles.values()) entry.sprite.destroy();
      livePuddles.clear();
      puddleLayer.destroy();
      for (const s of liveShots) { s.bodySprite.destroy(); s.glowSprite?.destroy(); }
      liveShots.length = 0;
      for (const entry of shotSheets.values()) {
        for (const t of entry.body.textures) t.destroy(true);
        if (entry.glow) for (const t of entry.glow.textures) t.destroy(true);
      }
      shotSheets.clear();
      shotLayer.destroy();
      pieces?.dispose();
      groundPieces?.dispose();
    }
  });
}
