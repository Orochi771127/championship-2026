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
import { createMoveVfxSetPieces, loadMoveVfxPieceSprites, paintBakedPieceFrames, GLOW_ALPHA } from "../vfx/moveVfxSetPieces.js";
import { resolveMoveSpecV2 } from "../../modes/dataArena/dataArenaMoveCatalogV2.js";
import { createVolumetricSheetCache } from "./dataArenaVolumetricCache.js";
import { renderVolumetricWave3D, renderVolumetricTornado3D } from "./dataArenaVolumetricFx3D.js";
import { renderVolumetricGroundSpike3D, renderVolumetricBurrowMound3D } from "./dataArenaVolumetricTerrain3D.js";
import {
  renderVolumetricCraterShockwave3D,
  renderVolumetricBeam3D,
  renderVolumetricMeteor3D,
  renderVolumetricPsychicCage3D
} from "./dataArenaVolumetricCombat3D.js";
import {
  renderVolumetricSlashArc3D,
  renderVolumetricOrb3D,
  renderVolumetricAuraPillar3D
} from "./dataArenaVolumetricClose3D.js";

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
  const shotLayer = new PIXI.Container();
  shotLayer.label = "pixelfx v2 shots";
  front.addChild(shotLayer);
  const puddleLayer = new PIXI.Container();
  puddleLayer.label = "pixelfx v2 ground surfaces";
  (ground ?? front).addChild(puddleLayer);

  const PUDDLE_PIXELFX = Object.freeze({
    WATER_PUDDLE: { piece: "mark-ripple", paletteKey: "water", fps: 12, alpha: 0.78 },
    POISON_POOL: { piece: "splat", paletteKey: "dark", fps: 10, alpha: 0.82 },
    ICE_PATCH: { piece: "mark-frost", paletteKey: "ice", fps: 10, alpha: 0.85 },
    FIRE_PATCH: { piece: "core", paletteKey: "fire", fps: 14, alpha: 0.82 },
    VINE_PATCH: { piece: "mark-roots", paletteKey: "nature", fps: 10, alpha: 0.84 },
    ELECTRIFIED_WATER: { piece: "mark-ripple", paletteKey: "thunder", fps: 16, alpha: 0.86 },
    MUD_PATCH: { piece: "prop-dust", paletteKey: "earth", fps: 8, alpha: 0.78 }
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
    /** Clean release: routes signature 3D releases (Beam / Slash / Claws / DashCone) through the zero-lag GPU sheet cache! */
    release({ x, y, angle = 0, moveId, melee = false }) {
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      // Move #1: DRAG_WAVE mounts its full 3D curling wave on its moving projectile!
      if (spec.v2Archetype === "DRAG_WAVE") {
        playPiece(pieces, "muzzle", { x, y, angle, palette: pal, scale: 0.72, groundY: y + 28 });
        stats.releases++;
        return;
      }
      // Move #6: STREAM_BEAM mounts our 3D cylindrical spiral energy cannon (cached GPU sheet!)
      if (spec.v2Archetype === "STREAM_BEAM" && !melee) {
        const beamPal = ["light", "fire", "water", "ice", "thunder", "dark", "nature"].includes(spec.paletteKey) ? spec.paletteKey : "light";
        const scale = spec.tier === "ultimate" ? 1.92 : 1.62;
        const len = 112;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const fx = volCache.spawn({
          layer: shotLayer, keyPrefix: `beam|${beamPal}`, width: 180, height: 140, frameCount: 7,
          directional: true, angle, anchorX: 0.5, anchorY: 0.58,
          x: x + cosA * len * 0.36 * scale, y: y + 8 + sinA * len * 0.36 * 0.56 * scale,
          durationSec: spec.tier === "ultimate" ? 0.66 : 0.44, scale,
          renderForAngle: (ctx, snapped, phase) => renderVolumetricBeam3D(ctx, { width: 180, height: 140, angle: snapped, phase, paletteKey: beamPal, length: len })
        });
        if (fx) { stats.releases++; return; }
      }
      // Move #9: Close-combat / Mobility 3D Crescent Slash, Triple Claws, or Supersonic Dash Cone!
      if (melee || ["FLURRY_COMBO", "MULTI_DASH", "SHADOW_BACKSTAB", "UTURN_STRIKE", "GUARD_BREAK_SLAM"].includes(spec.v2Archetype)) {
        const variant = spec.v2Archetype === "MULTI_DASH" ? "dashcone"
          : (spec.contactLook === "claws" || spec.v2Archetype === "FLURRY_COMBO") ? "claws" : "slash";
        const cPal = spec.paletteKey || "fire";
        const fx = volCache.spawn({
          layer: shotLayer, keyPrefix: `slash|${variant}|${cPal}`, width: 120, height: 104, frameCount: 6,
          directional: true, angle, anchorX: 0.5, anchorY: 0.66, x, y: y + 10,
          durationSec: 0.30, scale: spec.v2Archetype === "GUARD_BREAK_SLAM" ? 1.55 : 1.32,
          renderForAngle: (ctx, snapped, phase) => renderVolumetricSlashArc3D(ctx, { width: 120, height: 104, angle: snapped, phase, paletteKey: cPal, variant })
        });
        if (fx) { stats.releases++; return; }
      }
      const pieceName = melee ? (spec.releaseLook || "slash")
        : (spec.tier === "ultimate" ? "muzzle-spiral" : "muzzle");
      playPiece(pieces, pieceName, { x, y, angle, palette: pal, scale: melee ? 0.95 : 0.78, groundY: y + 28 });
      stats.releases++;
    },
    /** Clean looping 3D cached GPU projectiles: Wave (`DRAG_WAVE`) + 3D Hovering Orbs / Crystal Darts (`HOMING_ORB`, `VOLLEY_BARRAGE`)! */
    projectile({ follow, moveId, angle = 0, lifeMs = 1200 }) {
      if (typeof follow !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      // Move #1: True 3D Volumetric Curling Ocean Wave (8-dir LRU GPU cached!)
      if (spec.v2Archetype === "DRAG_WAVE") {
        const wavePal = ["water", "ice", "fire", "dark"].includes(spec.paletteKey) ? spec.paletteKey : "water";
        const fx = volCache.spawn({
          layer: shotLayer, keyPrefix: `wave|${wavePal}`, width: 136, height: 116, frameCount: 8,
          directional: true, angle, follow, anchorX: 0.5, anchorY: 0.70, yOffset: 12,
          durationSec: Math.min(1.15, Math.max(0.65, lifeMs / 1000)), scale: 1.55,
          renderForAngle: (ctx, snapped, phase) => renderVolumetricWave3D(ctx, { width: 136, height: 116, angle: snapped, phase, paletteKey: wavePal })
        });
        if (fx) { stats.projectiles++; return true; }
      }
      // Move #10: True 3D Hovering Elemental Orbs & Faceted Shard Darts (with grounded Z=0 shadow!)
      if (spec.v2Archetype === "HOMING_ORB" || spec.v2Archetype === "VOLLEY_BARRAGE") {
        const variant = spec.v2Archetype === "VOLLEY_BARRAGE" ? "dart" : "orb";
        const oPal = spec.paletteKey || "fire";
        const fx = volCache.spawn({
          layer: shotLayer, keyPrefix: `proj|${variant}|${oPal}`, width: 88, height: 80, frameCount: 6,
          directional: true, angle, follow, anchorX: 0.5, anchorY: 0.68, yOffset: 14,
          durationSec: 0.42, scale: variant === "dart" ? 1.15 : 1.25, loop: true,
          renderForAngle: (ctx, snapped, phase) => renderVolumetricOrb3D(ctx, { width: 88, height: 80, angle: snapped, phase, paletteKey: oPal, variant })
        });
        if (fx) { stats.projectiles++; return true; }
      }
      // Fallback: crisp dark-rimmed patch-gg/pixelfx shot
      const sheet = shotSheet(spec.flightLook, spec.paletteKey);
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
      const scale = Math.max(1.55, Math.min(2.6, (BODY * 0.82) / Math.max(24, sheet.body.w)));
      bodySprite.scale.set(scale);
      glowSprite?.scale.set(scale * 2);
      liveShots.push({ follow, sheet, bodySprite, glowSprite, scale, age: 0, maxAge: lifeMs / 1000, prevX: null, prevY: null, angle });
      stats.projectiles++;
      return true;
    },
    /** Strict One-Beat-One-Hero Contact with unified dark-rimmed PixelFX impact! */
    hit({ x, y, groundY = y, moveId, heavy = false, angle = 0 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      if (heavy && !reducedMotion) {
        playPiece(pieces, "impact-frame", { x, y, angle, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.72, groundY });
      }
      const contactPiece = (spec.v2Archetype === "DRAG_WAVE" || spec.contactLook === "wave")
        ? (spec.paletteKey === "water" || spec.paletteKey === "ice" ? "flurry-bubble" : "ring-burst")
        : spec.contactLook;
      playPiece(pieces, contactPiece, { x, y, angle, palette: pal, scale: Math.min(1.45, spec.scale * (heavy ? 1.15 : 0.96)), groundY, at: "contact" });
      if (heavy && groundPieces && !reducedMotion && spec.groundLook !== "mark-ripple") {
        playPiece(groundPieces, spec.groundLook, { x, y: groundY, palette: pal, scale: 0.85, groundY });
        holdMs = Math.max(holdMs, 55);
      }
      stats.hits++;
    },
    /** Clean area burst: ONE scaled centerpiece on impact (3D meteor/vortex zones stay single-layer crisp!). */
    area({ x, y, radius = 100, moveId }) {
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      if (spec.v2Archetype === "METEOR_RAIN") {
        if (!reducedMotion) {
          playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.9, groundY: y + 18 });
        }
        stats.hits++;
        return true;
      }
      const scale = Math.max(1.0, Math.min(1.9, radius / 92));
      playPiece(pieces, spec.contactLook, { x, y, palette: pal, scale, groundY: y + 18, at: "contact" });
      if (groundPieces && !reducedMotion && spec.groundLook !== "mark-ripple") {
        playPiece(groundPieces, spec.groundLook, { x, y: y + 12, palette: pal, scale: scale * 0.75, groundY: y + 12 });
      }
      stats.hits++;
      return true;
    },
    /** Clean ultimate: crisp pixelfx rune/impact opening + hero centerpiece. */
    ult({ moveId, center }) {
      if (!center) return;
      const spec = resolveMoveSpecV2(moveId);
      const pal = paletteFor(spec.paletteKey);
      if (groundPieces) playPiece(groundPieces, "sigil-cast", { x: center.x, y: center.y + 24, palette: pal, scale: 1.35, groundY: center.y + 24 });
      playPiece(pieces, "impact-frame", { x: center.x, y: center.y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 1.0, groundY: center.y + 24 });
      holdMs = Math.max(holdMs, 65);
      stats.ults++;
    },
    /** Move #11: True 3D Rising Spiral Power-Up Spire & Emerald Heal Sanctuary Pillar! */
    buff({ x, y, paletteKey = "light", piece = "buff-atk" }) {
      const bPal = paletteKey || "light";
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `aura|buff|${bPal}`, width: 128, height: 136, frameCount: 8,
        directional: false, anchorX: 0.5, anchorY: 0.78, x, y: y + 14, durationSec: 0.65, scale: 1.28,
        renderForAngle: (ctx, _ang, phase) => renderVolumetricAuraPillar3D(ctx, { width: 128, height: 136, phase, paletteKey: bPal, variant: "buff" })
      });
      if (!fx) playPiece(pieces, piece, { x, y, palette: paletteFor(bPal), scale: 1.15, groundY: y + 14 });
    },
    heal({ x, y }) {
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: "aura|heal|nature", width: 128, height: 136, frameCount: 8,
        directional: false, anchorX: 0.5, anchorY: 0.78, x, y: y + 14, durationSec: 0.72, scale: 1.32,
        renderForAngle: (ctx, _ang, phase) => renderVolumetricAuraPillar3D(ctx, { width: 128, height: 136, phase, paletteKey: "nature", variant: "heal" })
      });
      if (!fx) playPiece(pieces, "heal", { x, y, palette: BATTLE_FX_PALETTES.nature, scale: 1.15, groundY: y + 14 });
    },
    parry({ x, y }) {
      playPiece(pieces, "ring-pop", { x, y, palette: BATTLE_FX_PALETTES.light, scale: 1.1, groundY: y + 14 });
    },
    clash({ x, y }) {
      playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.9, groundY: y + 18 });
      playPiece(pieces, "ring-pop", { x, y, palette: BATTLE_FX_PALETTES.thunder, scale: 1.25, groundY: y + 18 });
      holdMs = Math.max(holdMs, 50);
      stats.clashes++;
      return true;
    },
    /** Move #1 (Surf-Rider): True 3D curling ocean wave mounted behind the dashing surfer! */
    surfWave({ follow, angle = 0, moveId = "surfRush", durationSec = 0.62 }) {
      if (typeof follow !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      const wavePal = ["water", "ice", "fire", "dark"].includes(spec.paletteKey) ? spec.paletteKey : "water";
      const fx = volCache.spawn({
        layer: ground ?? shotLayer, keyPrefix: `wave|${wavePal}`, width: 136, height: 116, frameCount: 8,
        directional: true, angle, follow, anchorX: 0.5, anchorY: 0.70, leadOffset: -18, yOffset: 6,
        durationSec, scale: 1.48,
        renderForAngle: (ctx, snapped, phase) => renderVolumetricWave3D(ctx, { width: 136, height: 116, angle: snapped, phase, paletteKey: wavePal })
      });
      if (fx) { stats.releases++; return true; }
      return false;
    },
    /** Move #2: True 3D Volumetric Tornado / Storm Vortex (8-dir LRU GPU cached; supports elemental combo evolution!) */
    vortex({ x, y, angle = 0, moveId = "vortex", durationSec = 1.05, radius = 118, paletteKey = null }) {
      const spec = resolveMoveSpecV2(moveId);
      const rawPal = paletteKey || spec.paletteKey;
      const tPal = ["wind", "water", "ice", "nature", "dark", "fire", "earth", "thunder", "light"].includes(rawPal) ? rawPal : "wind";
      const scale = Math.max(1.35, Math.min(2.05, (radius / 118) * 1.55));
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `tornado|${tPal}`, width: 136, height: 136, frameCount: 8,
        directional: true, angle, anchorX: 0.5, anchorY: 0.80, x, y: y + 10, durationSec, scale,
        renderForAngle: (ctx, snapped, phase) => renderVolumetricTornado3D(ctx, { width: 136, height: 136, angle: snapped, phase, paletteKey: tPal })
      });
      if (fx) { stats.releases++; return true; }
      return false;
    },
    /** Directional Shield-Wall Shatter: impact-frame + forward flying debris burst along strikeAngle! */
    wallShatter({ x, y, angle = 0, material = "STONE" }) {
      const mat = String(material ?? "STONE").toUpperCase();
      const palette = COVER_PALETTE[mat] ?? COVER_PALETTE.STONE;
      playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.92, groundY: y + 18 });
      playPiece(pieces, "prop-dust", { x, y: y - 10, groundY: y, palette, scale: 1.48 });
      const shardPiece = mat === "ICE" ? "flurry-shard" : mat === "WOOD" ? "flurry-leaf" : "stream";
      playPiece(pieces, shardPiece, { x: x + Math.cos(angle) * 26, y: y + Math.sin(angle) * 26, angle, palette, scale: 1.32, groundY: y + 16 });
      holdMs = Math.max(holdMs, 56);
      stats.props++;
      return true;
    },
    /** Cross-Ring Surface / Status Reaction burst (e.g. Poison Pool + Fire gasoline blast, Water + Ice flash freeze, Water + Thunder shock!) */
    surfaceBurst({ x, y, radius = 100, paletteKey = "fire", kind = "POISON_IGNITE" }) {
      const pal = paletteFor(paletteKey || "fire");
      const scale = Math.max(1.05, Math.min(1.9, radius / 86));
      if (kind === "POISON_IGNITE" || kind === "WILDFIRE_IGNITE" || kind === "ECLIPSE_BURST") {
        volCache.spawn({
          layer: shotLayer, keyPrefix: `crater|${paletteKey || "fire"}`, width: 160, height: 124, frameCount: 8,
          directional: false, anchorX: 0.5, anchorY: 0.64, x, y: y + 4, durationSec: 0.56, scale: scale * 1.15,
          renderForAngle: (ctx, _ang, phase) => renderVolumetricCraterShockwave3D(ctx, { width: 160, height: 124, phase, paletteKey: paletteKey || "fire" })
        });
        playPiece(pieces, "impact-frame", { x, y, palette: { core: 0xffffff, main: 0xffffff, edge: 0xffffff, flat: true }, scale: 0.95, groundY: y + 18 });
        holdMs = Math.max(holdMs, 55);
      } else if (kind === "WATER_FREEZE" || kind === "FLASH_FREEZE" || kind === "TOXIC_FROST") {
        playPiece(pieces, "flurry-shard", { x, y, palette: BATTLE_FX_PALETTES.ice, scale: scale * 1.15, groundY: y + 14 });
        playPiece(pieces, "ring-burst", { x, y, palette: BATTLE_FX_PALETTES.ice, scale, groundY: y + 14 });
      } else if (kind === "WATER_ELECTRIFY" || kind === "ELECTRO_CHARGE" || kind === "CONDUCT") {
        playPiece(pieces, "bolt", { x, y, palette: BATTLE_FX_PALETTES.thunder, scale: scale * 1.15, groundY: y + 14 });
        playPiece(pieces, "ring-pop", { x, y, palette: BATTLE_FX_PALETTES.thunder, scale, groundY: y + 14 });
      } else {
        playPiece(pieces, "ring-burst", { x, y, palette: pal, scale, groundY: y + 14 });
      }
      stats.hits++;
      return true;
    },
    /** Move #4B: True 3D Volumetric Ground Spike (8-dir LRU GPU cached!) */
    groundSpike({ x, y, angle = 0, moveId = "shardVolley", durationSec = 0.68, scale = 1.48 }) {
      const spec = resolveMoveSpecV2(moveId);
      const sPal = ["earth", "ice", "nature", "fire", "dark", "thunder", "water"].includes(spec.paletteKey) ? spec.paletteKey : "earth";
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `spike|${sPal}`, width: 116, height: 116, frameCount: 7,
        directional: true, angle, anchorX: 0.5, anchorY: 0.76, x, y: y + 6, durationSec, scale,
        renderForAngle: (ctx, snapped, phase) => renderVolumetricGroundSpike3D(ctx, { width: 116, height: 116, angle: snapped, phase, paletteKey: sPal })
      });
      if (fx) { stats.releases++; return true; }
      return false;
    },
    /** Move #4A: True 3D Volumetric Burrow Mound (8-dir LRU GPU cached!) */
    burrowMound({ follow, angle = 0, moveId = "own-63", durationSec = 0.60, scale = 1.48 }) {
      if (typeof follow !== "function") return false;
      const spec = resolveMoveSpecV2(moveId);
      const bPal = spec.paletteKey === "water" ? "water" : spec.paletteKey === "ice" ? "ice" : "earth";
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `burrow|${bPal}`, width: 112, height: 96, frameCount: 6,
        directional: true, angle, follow, anchorX: 0.5, anchorY: 0.68, yOffset: 4, durationSec, scale, loop: true,
        renderForAngle: (ctx, snapped, phase) => renderVolumetricBurrowMound3D(ctx, { width: 112, height: 96, angle: snapped, phase, paletteKey: bPal })
      });
      if (fx) { stats.releases++; return true; }
      return false;
    },
    /** Move #5: True 3D Volumetric Seismic Crater & Expanding Shockwave Ring (LRU GPU cached!) */
    craterShockwave({ x, y, moveId = "quakeSlam", radius = 140, durationSec = 0.58 }) {
      const spec = resolveMoveSpecV2(moveId);
      const cPal = ["earth", "fire", "ice", "thunder", "nature", "dark", "water", "light"].includes(spec.paletteKey) ? spec.paletteKey : "earth";
      const scale = Math.max(1.3, Math.min(2.05, (radius / 120) * 1.48));
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `crater|${cPal}`, width: 160, height: 124, frameCount: 8,
        directional: false, anchorX: 0.5, anchorY: 0.64, x, y: y + 4, durationSec, scale,
        renderForAngle: (ctx, _ang, phase) => renderVolumetricCraterShockwave3D(ctx, { width: 160, height: 124, phase, paletteKey: cPal })
      });
      if (fx) { stats.hits++; return true; }
      return false;
    },
    /** Move #7: True 3D Falling Flaming Meteor OR Storm-Cloud Thunder Pillar + 3D Blast (LRU GPU cached!) */
    meteorDrop({ x, y, moveId = "flameRing", durationSec = 0.92, radius = 110 }) {
      const spec = resolveMoveSpecV2(moveId);
      const mPal = ["fire", "thunder", "ice", "dark", "earth", "light", "water", "nature"].includes(spec.paletteKey) ? spec.paletteKey : "fire";
      const variant = mPal === "thunder" ? "thunder" : "meteor";
      const scale = Math.max(1.4, Math.min(1.95, (radius / 100) * 1.55));
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `meteor|${variant}|${mPal}`, width: 148, height: 196, frameCount: 9,
        directional: false, anchorX: 0.5, anchorY: 0.82, x, y: y + 6, durationSec: Math.max(0.65, durationSec), scale,
        renderForAngle: (ctx, _ang, phase) => renderVolumetricMeteor3D(ctx, { width: 148, height: 196, phase, paletteKey: mPal, variant })
      });
      if (fx) { stats.releases++; return true; }
      return false;
    },
    /** Move #8: True 3D Gyroscopic Telekinesis Field OR 3D Hexagonal Energy Cage (LRU GPU cached!) */
    psychicCage({ x, y, follow = null, moveId = "nightPulse", mode = "telekinesis", durationSec = 0.85, radius = 100 }) {
      const spec = resolveMoveSpecV2(moveId);
      const pPal = ["dark", "light", "thunder", "ice", "fire", "nature", "water"].includes(spec.paletteKey) ? spec.paletteKey : "dark";
      const scale = Math.max(1.3, Math.min(1.85, (radius / 100) * 1.45));
      const fx = volCache.spawn({
        layer: shotLayer, keyPrefix: `cage|${mode}|${pPal}`, width: 148, height: 148, frameCount: 8,
        directional: false, anchorX: 0.5, anchorY: 0.74, x, y: y + 6, follow, durationSec, scale,
        renderForAngle: (ctx, _ang, phase) => renderVolumetricPsychicCage3D(ctx, { width: 148, height: 148, phase, paletteKey: pPal, mode })
      });
      if (fx) { stats.releases++; return true; }
      return false;
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
      playPiece(pieces, "stream", { x, y, angle, palette: paletteFor(spec.paletteKey), scale: 1.15, groundY: y + 20 });
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
          const sheet = shotSheet(cfg.piece, cfg.paletteKey);
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
        const rot = s.sheet.upright ? 0 : s.angle;
        const flipY = (!s.sheet.upright && Math.cos(rot) < 0) ? -1 : 1;
        s.bodySprite.rotation = rot;
        s.bodySprite.scale.set(s.scale, s.scale * flipY);
        if (s.glowSprite && s.sheet.glow) {
          s.glowSprite.texture = s.sheet.glow.textures[idx % s.sheet.glow.textures.length];
          s.glowSprite.position.set(Math.round(pos.x), Math.round(pos.y));
          s.glowSprite.rotation = rot;
          s.glowSprite.scale.set(s.scale * 2, s.scale * 2 * flipY);
        }
      }
    },
    holding: () => holdMs > 0,
    getDiagnostics: () => Object.freeze({
      ...stats,
      liveShots: liveShots.length,
      volumetricCache: volCache.getDiagnostics(),
      pieces: pieces?.getDiagnostics?.() ?? null
    }),
    dispose() {
      volCache.dispose();
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
